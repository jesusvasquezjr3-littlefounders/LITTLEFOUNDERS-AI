#!/usr/bin/env node
/*
 * `npm run tutor:alliance-report` — the monitor for Product C.15 (the
 * Alliance Controller), C.14 (the self-explanation move) and C.7 (the learner
 * disposition profile), Appendix F §1.2 and Part 3 Stage 7.
 *
 *   C.15  Goal-Agreement Completion Rate (near 100% for sessions above the
 *         turn floor; below 95% with enough sessions it is a defect), the
 *         continuity moves (first meeting, persona switch, memory gap), the
 *         Adaptation-Offer Renegotiation Trigger Rate and how often the
 *         session improved after a renegotiation (diagnostic), and the
 *         Alliance Bond Proxy Score per persona with the share of praise that
 *         named something specific (diagnostic; the Stage 7 input).
 *   C.14  Self-Explanation Quality-Check Pass Rate: first-attempt passes per
 *         concept family (diagnostic: drift in prompt design or a rising
 *         filler pattern, never a verdict on a learner).
 *   C.7   Disposition-Profile Completeness Rate: learners active in the
 *         trailing 30 days with a profile updated in the last 30 (diagnostic).
 *   Stage 7 the Alliance Controller's Kill-Switch Trigger Log.
 *
 * Reads only, except:
 *   --resolve="root cause"   records an operator's resolution of the trip in
 *                            force, lifting the rollback for new sessions;
 *   --purge-stale            the C.7 retention job: deletes disposition
 *                            profiles not updated for 365 days.
 * No model call; costs nothing. Operator tool:
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run tutor:alliance-report -- [--since=YYYY-MM-DD] [--json] [--resolve="..."] [--purge-stale]
 *
 * Exit code 1 on a defect; "insufficient data" is printed, never passed off
 * as healthy. Every threshold is provisional — see
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */

import { countServiceRows, serviceRest } from '../services/supabaseRest.js';
import { pct } from '../services/pedagogy/mentorIntegrity.js';
import {
  ALLIANCE_KILL_SWITCH_RESOLVED,
  ALLIANCE_KILL_SWITCH_TRIGGERED,
  allianceKillSwitchLog,
  resolveAllianceKillSwitch,
  summarizeBondProxy,
  summarizeCompleteness,
  summarizeGoalAgreement,
  summarizeRenegotiation,
  summarizeSelfExplanation,
  type AllianceSessionRow,
  type RenegotiationRow,
  type SelfExplanationRow,
} from '../services/pedagogy/alliance.js';
import { DISPOSITION_THRESHOLDS, purgeStaleDispositionProfiles } from '../services/pedagogy/disposition.js';

const PAGE = 1000;
const MAX_ROWS = 200_000;

/** Reads every row of a window, paginated. Null on ANY failed page (§1.14: never a partial report). */
async function readAll<T>(path: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await serviceRest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    if (page === null) return null;
    out.push(...page);
    if (page.length < PAGE) return out;
  }
  return out;
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const resolution = arg('resolve');
  if (resolution !== null) {
    if (resolution.trim().length < 10) throw new Error('--resolve needs the root cause in words (at least 10 characters)');
    const landed = await resolveAllianceKillSwitch(resolution.trim());
    if (!landed) throw new Error('the resolution row did NOT land in audit_logs — the rollback is still in force');
    console.log('Recorded the resolution. New sessions act again within the kill-switch cache window (10 minutes).');
    return;
  }
  if (process.argv.includes('--purge-stale')) {
    const purged = await purgeStaleDispositionProfiles();
    if (purged === null) throw new Error('the retention purge call FAILED — nothing is known to have been deleted');
    console.log(`Purged ${purged} disposition profile(s) not updated for ${DISPOSITION_THRESHOLDS.retentionDays} days.`);
    return;
  }

  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 30 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');
  const current = new Date(now.getTime() - DISPOSITION_THRESHOLDS.currentDays * 86_400_000).toISOString();

  const [alliance, renegotiations, explanations, trips, activeRows, currentProfiles] = await Promise.all([
    readAll<AllianceSessionRow>(
      `/tutor_session_alliance?select=character,mode,continuity,continuity_move,goal_agreement,learner_turns,adaptation_offers,` +
        `adaptation_declines,bond_specific_turns,bond_generic_turns,bond_proxy,bond_proxy_at,created_at` +
        `&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<RenegotiationRow>(
      `/tutor_alliance_renegotiation?select=character,mode,outcome,improved,created_at&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<SelfExplanationRow>(
      `/tutor_self_explanation_event?select=character,family,mode,first_quality,outcome&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<{ action: string; created_at: string; detail: Record<string, unknown> | null }>(
      `/audit_logs?select=action,created_at,detail&action=in.(${ALLIANCE_KILL_SWITCH_TRIGGERED},${ALLIANCE_KILL_SWITCH_RESOLVED})&order=created_at.asc`,
    ),
    // Learners with a session in the trailing 30 days (the completeness denominator).
    readAll<{ user_id: string }>(`/tutor_sessions?select=user_id&started_at=gte.${current}&order=started_at.asc`),
    countServiceRows(`/learner_disposition_profile?updated_at=gte.${current}&select=user_id`),
  ]);
  if (alliance === null) throw new Error('could not read tutor_session_alliance — refusing to report on an unanswered query');
  if (renegotiations === null) throw new Error('could not read tutor_alliance_renegotiation — refusing to report on an unanswered query');
  if (explanations === null) throw new Error('could not read tutor_self_explanation_event — refusing to report on an unanswered query');
  if (trips === null) throw new Error('could not read audit_logs — refusing to report on an unanswered query');
  if (activeRows === null || currentProfiles === null) throw new Error('could not read the completeness inputs — refusing to report');

  const goal = summarizeGoalAgreement(alliance);
  const renegotiation = summarizeRenegotiation(renegotiations);
  const bond = summarizeBondProxy(alliance);
  const selfExplanation = summarizeSelfExplanation(explanations);
  const completeness = summarizeCompleteness(new Set(activeRows.map((r) => r.user_id)).size, currentProfiles);
  const log = allianceKillSwitchLog(trips);
  const inForce = log.length > 0 && log[log.length - 1]!.resolvedAt === null;
  const defects = goal.status === 'defect' ? [`goal-agreement completion ${pct(goal.rate)} — below the near-100% target (95%)`] : [];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, goal, renegotiation, bond, selfExplanation, completeness, killSwitch: { inForce, log }, defects }, null, 2));
  } else {
    console.log(`\ntutor:alliance-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    console.log('\nC.15 Goal-Agreement Completion Rate (target near 100% above the 3-turn floor, proposed)');
    console.log(`  ${pct(goal.rate)} — ${goal.agreed}/${goal.eligible} eligible session(s) — ${goal.status}`);
    console.log(`  outcomes: ${Object.entries(goal.outcomes).map(([k, n]) => `${k}:${n}`).join(' ') || '(none)'}`);
    console.log(
      `  continuity: ${Object.entries(goal.continuity).map(([k, c]) => `${k}:${c.sessions} (${c.delivered} re-established)`).join(' ') || '(none)'}`,
    );
    console.log('\nC.15 Adaptation-Offer Renegotiation Trigger Rate (diagnostic)');
    console.log(
      `  ${pct(renegotiation.rate)} — ${renegotiation.delivered}/${renegotiation.patterns} decline pattern(s) renegotiated; improved ${renegotiation.improved}, not improved ${renegotiation.notImproved}, unknown ${renegotiation.unknown}; shadow ${renegotiation.shadow}`,
    );
    console.log('\nC.15 Alliance Bond Proxy Score per persona (diagnostic; 1 = "yes", 0.5 = "partly", 0 = "not really")');
    for (const [character, b] of Object.entries(bond)) {
      console.log(`  ${character.padEnd(6)} ${b.score === null ? '—' : b.score.toFixed(2)} over ${b.answered} answer(s); specific praise ${pct(b.specificShare)}`);
    }
    console.log('\nC.14 Self-Explanation Quality-Check Pass Rate (diagnostic, first attempt)');
    console.log(`  ${pct(selfExplanation.rate)} — ${selfExplanation.firstPass}/${selfExplanation.prompts} answered prompt(s); shadow ${selfExplanation.shadow}`);
    for (const [family, f] of Object.entries(selfExplanation.byFamily)) {
      console.log(`  ${family.padEnd(12)} ${f.firstPass}/${f.prompts}`);
    }
    console.log('\nC.7 Disposition-Profile Completeness Rate (diagnostic)');
    console.log(`  ${pct(completeness.rate)} — ${completeness.current}/${completeness.active} active learner(s) with a current profile`);
    console.log('\nStage 7 Alliance Controller Kill-Switch Trigger Log');
    if (log.length === 0) console.log('  no automatic rollback recorded');
    for (const entry of log) {
      console.log(
        `  ${entry.triggeredAt} ${entry.causes.join(', ')} — ${entry.resolvedAt === null ? 'IN FORCE (renegotiation and continuity in shadow)' : `resolved after ${entry.resolutionHours!.toFixed(1)} h`}`,
      );
    }
    console.log(defects.length === 0 ? '\nNo defects.' : `\nDEFECTS (${defects.length}):\n  - ${defects.join('\n  - ')}`);
  }
  if (defects.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
