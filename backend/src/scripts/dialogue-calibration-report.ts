#!/usr/bin/env node
/*
 * `npm run tutor:dialogue-calibration-report` — the monitor for Product C.17
 * (age-band dialogue calibration), Appendix F §1.2 "Age-Band Calibration A/B
 * Outcome" and the calibration's Part 3 Stage 7 rollback.
 *
 *   A/B outcome     enrolled sessions only (the H.7 experiment; adults only
 *                   until Product and Legal widen the ages, OD-23): per band,
 *                   the Alliance Bond Proxy Score (C.15) and the completed-
 *                   close share (C.16) of each arm, the calibrated − control
 *                   difference with a 95% interval, and the verdict
 *                   (improvement / non-regression / inconclusive / regression
 *                   / insufficient data).
 *   Uncontrolled    sessions OUTSIDE the experiment (every minor) on the
 *                   calibrated default, per band, beside the pre-C.17
 *                   baseline. Observational, confounded, never causal.
 *   Style audit     controlling language that reached a teen or adult in the
 *                   autonomy-supportive register (a defect), and the
 *                   assignment mix (how many sessions each reason covered).
 *   Stage 7         the Kill-Switch Trigger Log.
 *
 * Reads only, except `--resolve="root cause"` (records an operator's
 * resolution of a trip in force: new sessions run their assigned register
 * again). No model call; costs nothing. Operator tool:
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run tutor:dialogue-calibration-report -- [--since=YYYY-MM-DD] [--json] [--resolve="..."]
 *
 * Exit code 1 on a defect (a regression or delivered controlling language).
 */

import { serviceRest } from '../services/supabaseRest.js';
import { pct } from '../services/pedagogy/mentorIntegrity.js';
import {
  DIALOGUE_KILL_SWITCH_RESOLVED,
  DIALOGUE_KILL_SWITCH_TRIGGERED,
  DIALOGUE_THRESHOLDS,
  readCalibrationOutcomes,
  resolveDialogueKillSwitch,
  summarizeCalibrationExperiment,
  summarizeControllingLanguage,
  summarizeObservational,
  type DifferenceEstimate,
} from '../services/pedagogy/dialogueCalibration.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const interval = (e: DifferenceEstimate | null): string =>
  e === null ? '—' : `${e.diff >= 0 ? '+' : ''}${e.diff.toFixed(3)} [${e.low.toFixed(3)}, ${e.high.toFixed(3)}]`;
const mean = (v: number | null): string => (v === null ? '—' : v.toFixed(2));

async function main(): Promise<void> {
  const resolution = arg('resolve');
  if (resolution !== null) {
    if (resolution.trim().length < 10) throw new Error('--resolve needs the root cause in words (at least 10 characters)');
    if (!(await resolveDialogueKillSwitch(resolution.trim()))) {
      throw new Error('the resolution row did NOT land in audit_logs — the rollback is still in force');
    }
    console.log('Recorded the resolution. New sessions run their assigned register again within the cache window (10 minutes).');
    return;
  }

  const now = new Date();
  const since = arg('since') ? new Date(`${arg('since')}T00:00:00Z`) : new Date(now.getTime() - 90 * 86_400_000);
  if (Number.isNaN(since.getTime()) || since >= now) throw new Error('--since must be a past date (YYYY-MM-DD)');
  const [outcomes, trips, mix] = await Promise.all([
    readCalibrationOutcomes(since),
    serviceRest<{ action: string; created_at: string; detail: Record<string, unknown> | null }[]>(
      `/audit_logs?select=action,created_at,detail&action=in.(${DIALOGUE_KILL_SWITCH_TRIGGERED},${DIALOGUE_KILL_SWITCH_RESOLVED})&order=created_at.asc&limit=1000`,
    ),
    serviceRest<{ band: string; variant: string; assignment: string }[]>(
      `/tutor_dialogue_calibration?select=band,variant,assignment&created_at=gte.${encodeURIComponent(since.toISOString())}&limit=50000`,
    ),
  ]);
  if (outcomes === null || mix === null) throw new Error('could not read the calibration outcomes — refusing to report on an unanswered query');
  if (trips === null) throw new Error('could not read audit_logs — refusing to report on an unanswered query');

  const experiment = summarizeCalibrationExperiment(outcomes.rows);
  const observational = summarizeObservational(outcomes.rows);
  const controlling = summarizeControllingLanguage(outcomes.rows);
  const assignments = mix.reduce<Record<string, number>>((acc, r) => ({ ...acc, [`${r.band}/${r.variant}/${r.assignment}`]: (acc[`${r.band}/${r.variant}/${r.assignment}`] ?? 0) + 1 }), {});
  const lastTrip = [...trips].reverse().find((t) => t.action === DIALOGUE_KILL_SWITCH_TRIGGERED || t.action === DIALOGUE_KILL_SWITCH_RESOLVED);
  const inForce = lastTrip?.action === DIALOGUE_KILL_SWITCH_TRIGGERED;
  const defects = [
    ...experiment.flatMap((b) => [
      ...(b.bondVerdict === 'regression' ? [`${b.band}: the calibrated arm's bond proxy is significantly below control`] : []),
      ...(b.closingVerdict === 'regression' ? [`${b.band}: the calibrated arm completes significantly fewer sessions than control`] : []),
    ]),
    ...(controlling.status === 'defect' ? [`controlling language reached a learner ${controlling.delivered} time(s) in the autonomy-supportive register`] : []),
  ];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, experiment, observational, controlling, assignments, killSwitch: { inForce, trips }, defects }, null, 2));
  } else {
    console.log(`\ntutor:dialogue-calibration-report — ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
    console.log(
      `\nC.17 Age-Band Calibration A/B Outcome — enrolled sessions (per arm floor ${DIALOGUE_THRESHOLDS.minSessionsPerArm}; non-regression margin ${DIALOGUE_THRESHOLDS.nonRegressionMargin})`,
    );
    if (experiment.length === 0) console.log('  no enrolled sessions (the experiment enrols adults only until Product and Legal widen the ages, OD-23)');
    for (const b of experiment) {
      console.log(`  ${b.band}`);
      console.log(
        `    bond proxy  calibrated ${mean(b.calibrated.bondMean)} (n=${b.calibrated.bondAnswers})  control ${mean(b.control.bondMean)} (n=${b.control.bondAnswers})  diff ${interval(b.bond)} → ${b.bondVerdict}`,
      );
      console.log(
        `    completed   calibrated ${pct(b.calibrated.completedShare)} (n=${b.calibrated.closings})  control ${pct(b.control.completedShare)} (n=${b.control.closings})  diff ${interval(b.closing)} → ${b.closingVerdict}`,
      );
    }
    console.log('\nUNCONTROLLED (observational, not causal): sessions outside the experiment on the calibrated default');
    for (const [band, s] of Object.entries(observational.byBand)) {
      console.log(`  ${band.padEnd(11)} bond ${mean(s.bondMean)} (n=${s.bondAnswers}); completed ${pct(s.completedShare)} (n=${s.closings})`);
    }
    const base = observational.preC17Baseline;
    console.log(`  pre-C.17    bond ${mean(base.bondMean)} (n=${base.bondAnswers}); completed ${pct(base.completedShare)} (n=${base.closings})`);
    console.log('\nC.17 style constraint: controlling language delivered in the autonomy-supportive register (target 0)');
    console.log(`  ${controlling.delivered} over ${controlling.sessions} teen/adult calibrated session(s) — ${controlling.status}`);
    console.log('\nAssignment mix (band/variant/assignment)');
    for (const [key, n] of Object.entries(assignments)) console.log(`  ${key}: ${n}`);
    console.log('\nStage 7 dialogue-calibration Kill-Switch Trigger Log');
    if (trips.length === 0) console.log('  no automatic rollback recorded');
    for (const t of trips) console.log(`  ${t.created_at} ${t.action === DIALOGUE_KILL_SWITCH_TRIGGERED ? `TRIGGERED ${JSON.stringify(t.detail?.regressions ?? [])}` : 'resolved'}`);
    if (inForce) console.log('  IN FORCE: every new session runs the control register');
    console.log(defects.length === 0 ? '\nNo defects.' : `\nDEFECTS (${defects.length}):\n  - ${defects.join('\n  - ')}`);
  }
  if (defects.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
