#!/usr/bin/env node
/*
 * `npm run audit:bkt-calibration` — INSTRUMENTATION for ORACLE.md §19.5's
 * "per-learner BKT parameters" backlog item, not a mastery-model change.
 * See `services/pedagogy/bktCalibration.ts`'s own header for the full case;
 * in one line: BKT already runs on FIXED, shared-per-KC parameters, and
 * `learner_kc_mastery.params_override` (migration 0052) is a dormant slot
 * for personalizing them that nothing has ever written to. Before writing
 * to it, this measures whether the fixed parameters already in production
 * are actually a problem — comparing their per-attempt predictions against
 * the crudest baseline available (a KC's own historical hit rate) using
 * real `kc_attempt` evidence.
 *
 * Reads only; writes nothing; changes no live session's behaviour. Operator
 * tool, not CI — same posture as audit:content-bridge:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run audit:bkt-calibration
 */

import { getActiveKcs, getKcAttemptsForCalibration, paramsOf } from '../services/pedagogy/kcData.js';
import { calibrationReport, type KcKnown } from '../services/pedagogy/bktCalibration.js';

const MIN_SAMPLE = 30;

function fmt(n: number | null): string {
  return n === null ? 'n/a' : n.toFixed(3);
}

async function main(): Promise<void> {
  const [kcs, attemptRows] = await Promise.all([getActiveKcs(), getKcAttemptsForCalibration()]);
  // A null read is a FAILED fetch, never "zero evidence" (/AGENTS.md §1.14)
  // — collapsing the two would report a calibration verdict on an
  // unanswered query, exactly the silent-miss shape this audit exists to
  // avoid in the first place.
  if (kcs === null) {
    throw new Error('could not read the kc table — refusing to report calibration on an unanswered query');
  }
  if (attemptRows === null) {
    throw new Error('could not read kc_attempt — refusing to report calibration on an unanswered query');
  }

  const known: KcKnown[] = kcs.map((kc) => ({ id: kc.id, key: kc.key, params: paramsOf(kc) }));
  const report = calibrationReport(
    attemptRows.map((r) => ({
      kcId: r.kc_id,
      userId: r.user_id,
      correct: r.correct,
      pKnownBefore: r.p_known_before,
    })),
    known,
    MIN_SAMPLE,
  );

  console.log(
    `\naudit:bkt-calibration — ${report.totalAttempts} attempt(s), ${report.distinctLearners} learner(s), ` +
      `${report.excludedNoParams} excluded (KC not active).`,
  );

  if (report.overall.attempts === 0) {
    console.log(
      'No scoreable evidence yet. Nothing to conclude either way — re-run once real ' +
        'sessions have produced graded attempts against an active KC.',
    );
    return;
  }

  console.log(
    `Overall (${report.overall.attempts} attempts): BKT Brier ${fmt(report.overall.brierBkt)} vs. ` +
      `flat-baseline Brier ${fmt(report.overall.brierBaseline)}` +
      (report.overall.sufficientEvidence ? '' : `  [BELOW the ${MIN_SAMPLE}-attempt floor — informational only]`),
  );

  for (const kc of report.perKc) {
    const flag = kc.sufficientEvidence ? '' : `  [< ${MIN_SAMPLE} attempts — informational only]`;
    console.log(
      `  ${kc.kcKey}: n=${kc.attempts} (${kc.learners} learner${kc.learners === 1 ? '' : 's'}), ` +
        `mean predicted ${fmt(kc.meanPredicted)} vs. observed ${fmt(kc.observedRate)}, ` +
        `Brier ${fmt(kc.brierBkt)} vs. baseline ${fmt(kc.brierBaseline)}${flag}`,
    );
  }

  console.log(
    '\nLower Brier is better, on both sides. This compares the FIXED, shared ' +
      "parameters BKT runs on today against the crudest baseline — it does not " +
      'by itself prove a per-learner refit would do better, only whether the ' +
      'fixed parameters are already earning their keep. Treat any row flagged ' +
      'below the sample floor as no evidence yet, never as a clean bill of health.',
  );
}

main().catch((err) => {
  console.error(`::error::audit:bkt-calibration FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
