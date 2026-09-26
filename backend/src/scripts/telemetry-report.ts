#!/usr/bin/env node
/*
 * `npm run tutor:telemetry-report` — the monitor for Product C.9 (the
 * Behavioral Telemetry Layer) and C.19 (the disengagement check-in),
 * Appendix F §1.2 and Part 3 Stage 7.
 *
 *   C.9    Default-to-Inaction Rate: of the learner turns the layer evaluated
 *          (act mode), the share on which it took no action. High by design;
 *          below the 85% floor it is a defect and a Stage 7 trigger. Split by
 *          persona, with the mean strength of each channel across firings
 *          (which signals are driving check-ins).
 *   C.19   Disengagement-Repair Initiation Rate: of the fired signals a Mentor
 *          turn could have carried, the share that produced the check-in. A
 *          HARD 100% invariant: one undelivered firing is a defect. Also the
 *          check-in answers and how many "not really" repairs carried an
 *          adaptation offer.
 *   Stage 7 the Kill-Switch Trigger Log (Appendix F §1.3): every automatic
 *          rollback, its cause and its resolution time, and whether one is in
 *          force now (Oracle then runs the layer in shadow).
 *
 * Reads only, except `--resolve`, which records an operator's resolution of
 * the trip in force (root-caused) in `audit_logs`, lifting the rollback for
 * new sessions. No model call; costs nothing. Operator tool:
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npm run tutor:telemetry-report -- [--since=YYYY-MM-DD] [--json] [--resolve="root cause …"]
 *
 * Exit code 1 on a defect; "insufficient data" is printed, never passed off
 * as healthy. Every threshold is provisional — see
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */

import { serviceRest } from '../services/supabaseRest.js';
import { pct } from '../services/pedagogy/mentorIntegrity.js';
import {
  KILL_SWITCH_RESOLVED,
  KILL_SWITCH_TRIGGERED,
  killSwitchLog,
  resolveKillSwitch,
  summarizeDefaultToInaction,
  summarizeRepairInitiation,
  TELEMETRY_CHANNELS,
  type TelemetryFiringRow,
  type TelemetrySessionRow,
} from '../services/pedagogy/behavioralTelemetry.js';

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
    const landed = await resolveKillSwitch(resolution.trim());
    if (!landed) throw new Error('the resolution row did NOT land in audit_logs — the rollback is still in force');
    console.log('Recorded the resolution. New sessions act again within the kill-switch cache window (10 minutes).');
    return;
  }

  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 30 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');

  const [sessions, firings, trips] = await Promise.all([
    readAll<TelemetrySessionRow>(
      `/tutor_sessions?select=id,character,telemetry_mode,telemetry_evaluated_turns,telemetry_action_turns` +
        `&telemetry_mode=not.is.null&ended_at=gte.${since.toISOString()}&order=ended_at.asc`,
    ),
    readAll<TelemetryFiringRow>(
      `/tutor_telemetry_firing?select=session_id,character,mode,outcome,repair_offered,latency_shift,rapid_response,` +
        `verbosity_drop,repeated_answer,hedging,off_topic,hint_abuse,fast_known_miss` +
        `&created_at=gte.${since.toISOString()}&order=created_at.asc`,
    ),
    readAll<{ action: string; created_at: string; detail: Record<string, unknown> | null }>(
      `/audit_logs?select=action,created_at,detail&action=in.(${KILL_SWITCH_TRIGGERED},${KILL_SWITCH_RESOLVED})&order=created_at.asc`,
    ),
  ]);
  if (sessions === null) throw new Error('could not read tutor_sessions — refusing to report on an unanswered query');
  if (firings === null) throw new Error('could not read tutor_telemetry_firing — refusing to report on an unanswered query');
  if (trips === null) throw new Error('could not read audit_logs — refusing to report on an unanswered query');

  const inaction = summarizeDefaultToInaction(sessions);
  const repair = summarizeRepairInitiation(firings);
  const log = killSwitchLog(trips);
  const inForce = log.length > 0 && log[log.length - 1]!.resolvedAt === null;
  const defects = [
    ...(inaction.status === 'defect'
      ? [`default-to-inaction ${pct(inaction.rate)} — below the 85% floor (Stage 7 trigger)`]
      : []),
    ...(repair.status === 'defect'
      ? [`disengagement-repair initiation ${pct(repair.rate)} (${repair.missed} undelivered check-in(s)) — target 100%`]
      : []),
  ];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, inaction, repair, killSwitch: { inForce, log }, defects }, null, 2));
  } else {
    console.log(`\ntutor:telemetry-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    console.log('\nC.9 Default-to-Inaction Rate (floor 85%, proposed)');
    console.log(
      `  ${pct(inaction.rate)} over ${inaction.evaluatedTurns} evaluated turn(s) in ${inaction.actSessions} act session(s) — ${inaction.status}; shadow sessions: ${inaction.shadowSessions}`,
    );
    for (const [character, p] of Object.entries(inaction.byPersona)) {
      console.log(`  ${character.padEnd(6)} ${pct(p.rate)} (${p.actionTurns}/${p.evaluatedTurns} acted)`);
    }
    console.log('  mean channel strength across act firings (diagnostic):');
    console.log(`    ${TELEMETRY_CHANNELS.map((c) => `${c} ${repair.meanStrength[c] === null ? '—' : repair.meanStrength[c]!.toFixed(2)}`).join('  ')}`);
    console.log('\nC.19 Disengagement-Repair Initiation Rate (target 100%)');
    console.log(`  ${pct(repair.rate)} — ${repair.initiated}/${repair.opportunities} carried, ${repair.missed} undelivered — ${repair.status}`);
    const outcomes = Object.entries(repair.outcomes)
      .map(([outcome, n]) => `${outcome}:${n}`)
      .join(' ');
    console.log(`  outcomes: ${outcomes || '(none)'}; repairs with an adaptation offer: ${repair.repairsWithOffer}/${repair.repairs}`);
    console.log('\nStage 7 Kill-Switch Trigger Log');
    if (log.length === 0) console.log('  no automatic rollback recorded');
    for (const entry of log) {
      console.log(
        `  ${entry.triggeredAt} ${entry.causes.join(', ')} — ${entry.resolvedAt === null ? 'IN FORCE (layer in shadow)' : `resolved after ${entry.resolutionHours!.toFixed(1)} h`}`,
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
