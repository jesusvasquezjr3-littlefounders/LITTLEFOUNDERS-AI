#!/usr/bin/env node
/*
 * `npm run tutor:integrity-report` — the Mentor-integrity monitor for
 * Product C.10 and C.18 (Appendix F §1.1–1.2, Part 3 Stage 7).
 *
 *   C.10  Corroborating-Evidence Compliance Rate and Mastery Declaration
 *         Reversal Rate, from the Extended Mastery Engine event log
 *         (`tutor_trajectory_step`).
 *   C.18  Answer-Reveal Rate per persona and per session, the delivered
 *         false-affirmation count, and the specific-vs-generic praise share,
 *         from `tutor_turn_honesty`.
 *
 * Reads only, except `--resolve`, which records an operator's resolution of
 * the Extended Mastery Engine's Stage 7 automatic rollback
 * (`mentor.kill_switch.mastery.resolved`, with the root cause in words): the
 * rolled-back KCs return to the corroborated requirement for new sessions
 * within the kill-switch cache window. Costs nothing (no model call).
 * Operator tool — same posture as `audit:bkt-calibration`:
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npm run tutor:integrity-report -- [--since=YYYY-MM-DD] [--json] [--resolve="root cause …"]
 *
 * The window is `--since` (default: 30 days ago) to now; the answer-reveal
 * DRIFT check compares it with the equally long window before it. Exit code
 * 1 when any defect is found (a compliance miss, a reveal rate over the
 * ceiling or drifting up, a delivered false affirmation, a reversal rate over
 * the Stage 7 ceiling) so a scheduled run can page someone; "insufficient
 * data" is printed, never passed off as healthy. Every threshold is
 * provisional — see docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */

import { serviceRest } from '../services/supabaseRest.js';
import {
  MASTERY_KILL_SWITCH_RESOLVED,
  MASTERY_KILL_SWITCH_TRIGGERED,
  masteryKillSwitchLog,
  MENTOR_INTEGRITY_THRESHOLDS,
  pct,
  resolveMasteryKillSwitch,
  summarizeHonesty,
  summarizeMasteryEvidence,
  type HonestyRow,
  type MasteryAuditRow,
  type TrajectoryEvidenceRow,
} from '../services/pedagogy/mentorIntegrity.js';

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
    const landed = await resolveMasteryKillSwitch(resolution.trim());
    if (!landed) throw new Error('the resolution row did NOT land in audit_logs — the rollback is still in force');
    console.log('Recorded the resolution. New sessions use the corroborated requirement again within the kill-switch cache window (10 minutes).');
    return;
  }

  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 30 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');
  const priorSince = new Date(since.getTime() - (now.getTime() - since.getTime()));
  // The reversal window reaches back past `since` so a declaration made just
  // before the window can still be joined to a contradiction inside it.
  const trajectorySince = new Date(
    since.getTime() - MENTOR_INTEGRITY_THRESHOLDS.masteryReversalWindowDays * 86_400_000,
  );

  const honestyCols =
    'session_id,character,sequence_kind,reveal_sanctioned,reveal_key_match,reveal_self_answered,reveal_phrase,false_affirmation_caught,false_affirmation_delivered,praise';
  const [current, prior, trajectory, trips] = await Promise.all([
    readAll<HonestyRow>(
      `/tutor_turn_honesty?select=${honestyCols}&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<HonestyRow>(
      `/tutor_turn_honesty?select=${honestyCols}&created_at=gte.${priorSince.toISOString()}&created_at=lt.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<TrajectoryEvidenceRow>(
      `/tutor_trajectory_step?select=user_id,kc_id,strategy,strategy_before,evidence_rule,evidence_observations,evidence_required,mastery_revoked,created_at&created_at=gte.${trajectorySince.toISOString()}&order=created_at.asc`,
    ),
    readAll<MasteryAuditRow>(
      `/audit_logs?select=action,created_at,detail&action=in.(${MASTERY_KILL_SWITCH_TRIGGERED},${MASTERY_KILL_SWITCH_RESOLVED})&order=created_at.asc`,
    ),
  ]);
  if (current === null || prior === null) {
    throw new Error('could not read tutor_turn_honesty — refusing to report on an unanswered query');
  }
  if (trajectory === null) {
    throw new Error('could not read tutor_trajectory_step — refusing to report on an unanswered query');
  }
  if (trips === null) throw new Error('could not read audit_logs — refusing to report on an unanswered query');

  const honesty = summarizeHonesty(current, prior);
  // Compliance is judged on the window itself; reversals may reach back.
  const inWindow = trajectory.filter((r) => new Date(r.created_at) >= since);
  const mastery = summarizeMasteryEvidence(trajectory);
  const compliance = summarizeMasteryEvidence(inWindow);
  const defects = [...compliance.defects, ...honesty.defects, ...mastery.defects.filter((d) => d.includes('reversal'))];
  if (compliance.unattributedMisses > 0) {
    defects.push(`C.10 ${compliance.unattributedMisses} compliance miss(es) carry no KC — no per-KC rollback can address them, root-cause each one`);
  }
  const log = masteryKillSwitchLog(trips);
  const inForce = log.length > 0 && log[log.length - 1]!.resolvedAt === null;
  // The per-KC table shows only what Stage 7 acts on: a KC over the ceiling or with a compliance miss.
  const complianceById = new Map(compliance.byKc.map((kc) => [kc.kcId, kc]));
  const flaggedKcs = mastery.byKc
    .map((kc) => ({ ...kc, complianceMisses: complianceById.get(kc.kcId)?.complianceMisses ?? 0 }))
    .filter((kc) => kc.reversalStatus === 'defect' || kc.complianceMisses > 0);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, honesty, compliance, mastery, flaggedKcs, killSwitch: { inForce, log }, defects }, null, 2));
  } else {
    console.log(`\ntutor:integrity-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    console.log('\nC.10 Extended Mastery Engine');
    console.log(
      `  corroborating-evidence compliance: ${pct(compliance.complianceRate)} of ${compliance.triggers} consequential move(s)` +
        (compliance.underRollback > 0 ? `  [${compliance.underRollback} under a Stage 7 rollback]` : ''),
    );
    console.log(
      `  mastery declaration reversal rate: ${pct(mastery.reversalRate)} (${mastery.reversals}/${mastery.declarations}) — ${mastery.reversalStatus}`,
    );
    if (flaggedKcs.length > 0) {
      console.log('  knowledge components meeting the Stage 7 condition (per KC, 20-declaration floor each):');
      for (const kc of flaggedKcs.slice(0, 40)) {
        console.log(
          `    ${kc.kcId} reversal ${pct(kc.reversalRate)} (${kc.reversals}/${kc.declarations}) — ${kc.reversalStatus}; compliance misses ${kc.complianceMisses}; under rollback ${kc.underRollback}`,
        );
      }
    }
    console.log('\nStage 7 Kill-Switch Trigger Log (Extended Mastery Engine)');
    if (log.length === 0) console.log('  no automatic rollback recorded');
    for (const entry of log) {
      console.log(
        `  ${entry.triggeredAt} ${entry.causes.join(', ')} [${entry.kcKeys.join(', ') || 'no attributable KC'}] — ${entry.resolvedAt === null ? 'IN FORCE (single-observation baseline for these KCs)' : `resolved after ${entry.resolutionHours!.toFixed(1)} h`}`,
      );
    }
    console.log('\nC.18 Answer-reveal rate by persona (unsanctioned reveals / sequence turns)');
    for (const p of honesty.personas) {
      console.log(
        `  ${p.character.padEnd(6)} ${pct(p.rate).padStart(6)}  (${p.unsanctionedReveals}/${p.sequenceTurns}, prior ${pct(p.priorRate)}) — ${p.status}`,
      );
    }
    const flagged = honesty.sessions.filter((s) => s.status === 'defect').slice(0, 20);
    if (flagged.length > 0) {
      console.log('  sessions to review (rate over the ceiling):');
      for (const s of flagged) console.log(`    ${s.sessionId} (${s.character}) ${pct(s.rate)} of ${s.sequenceTurns}`);
    }
    console.log(
      `\nC.18 Sycophancy audit: ${honesty.falseAffirmations.caught} false affirmation(s) caught and repaired, ` +
        `${honesty.falseAffirmations.delivered} delivered (zero tolerance); specific praise share ${pct(honesty.praise.specificShare)}`,
    );
    console.log(defects.length === 0 ? '\nNo defects.' : `\nDEFECTS (${defects.length}):\n  - ${defects.join('\n  - ')}`);
  }
  if (defects.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
