/*
 * BKT calibration — INSTRUMENTATION, not a mastery-model change.
 *
 * `/ORACLE.md` §19.1 describes online mastery as "Four-parameter Bayesian
 * Knowledge Tracing... Degeneracy guards in schema AND code" — one FIXED set
 * of parameters per knowledge component (`kc.p_l0/p_t/p_g/p_s`), shared by
 * every learner. Migration `0052` already reserves a per-LEARNER override
 * slot for this (`learner_kc_mastery.params_override`, commented there as
 * "a later calibration step"), and `paramsOf()` in `kcData.ts` already
 * respects it when present — but nothing anywhere ever WRITES to it. The
 * plumbing for personalization exists; the calibration step that would
 * populate it responsibly does not.
 *
 * Investigated for ORACLE.md §19.5's "per-learner BKT parameters" backlog
 * item, 2026-09-01. Fitting real per-learner (or even per-learner-per-KC)
 * parameters from scratch is a genuine algorithm change with real
 * pedagogical stakes: it would touch what a live session teaches a real
 * child, and AGENTS.md's own §1.14 (four-parameter degeneracy guards
 * already fenced in the schema) exists precisely because BKT is easy to
 * mis-fit into an uninterpretable model on sparse data — and on 2026-09-01
 * this platform's own production numbers put that sparsity beyond "a risk
 * to manage": the Tutor's only real, recurring learner is the owner's own
 * account (ORACLE.md §20.4's "owner-accepted interim while the platform's
 * only active learner is the owner"), and family accounts are otherwise at
 * zero. Fitting four free parameters per KC from single-digit attempt
 * counts is the textbook overfitting case the schema's own guess/slip
 * ceilings were written to guard against, not a calibration a handful of
 * attempts can respectably support.
 *
 * So the responsible first step is not a new algorithm — it is measuring
 * whether the FIXED parameters already in production are actually a
 * problem worth solving. This module answers exactly that, using the
 * evidence `kc_attempt` (migration 0052) already accumulates: for each
 * attempt, `predictCorrect(pKnownBefore, params)` is what BKT predicted
 * BEFORE seeing the outcome — comparing that prediction's Brier score
 * against the crudest possible baseline (this KC's own empirical hit rate,
 * a single constant, no per-attempt evidence at all) is a standard,
 * conservative first read: if the fixed parameters are not already beating
 * that baseline, personalizing them is worth pursuing; if they comfortably
 * are, chasing per-learner fits is solving a problem nobody has evidenced.
 *
 * Reads only; writes nothing; changes no live session's behaviour. A verdict
 * below `minSample` attempts is reported as NOT YET EVIDENCED rather than as
 * a clean bill of health or a confirmed problem — AGENTS.md §1.14's "failure
 * must be distinguishable from emptiness" applies here exactly as it does to
 * any other read: a confident verdict from three data points is worse than
 * none, and it must not be allowed to look like one.
 */

import { predictCorrect, type BktParams } from './bkt.js';

export interface CalibrationAttempt {
  kcId: string;
  userId: string;
  correct: boolean;
  /** The BKT posterior immediately before this attempt — never the outcome. */
  pKnownBefore: number;
}

/** The one fact this module needs about a KC beyond its id: its current fixed parameters. */
export interface KcKnown {
  id: string;
  key: string;
  params: BktParams;
}

export interface KcCalibration {
  kcId: string;
  kcKey: string;
  attempts: number;
  /** Distinct learners this KC's attempts came from — a single learner's own streak is not evidence that parameters generalize. */
  learners: number;
  /** The mean of BKT's own per-attempt predictions — compare against `observedRate` for a coarse over/under-confidence read. */
  meanPredicted: number;
  observedRate: number;
  /** Brier score of BKT's per-attempt predictions. 0 is perfect; 0.25 is what "always guess 50%" scores; lower is better. */
  brierBkt: number;
  /** Brier score of a constant predictor equal to this KC's own `observedRate` — the baseline BKT has to beat to be earning its keep. */
  brierBaseline: number;
  /** `attempts >= minSample` — the line the caller draws between "read this" and "not yet". */
  sufficientEvidence: boolean;
}

export interface CalibrationReport {
  totalAttempts: number;
  /** Attempts whose `kcId` was not in the `kcs` list passed in — most commonly a retired KC not returned by `getActiveKcs()`. Not silently dropped: counted so a caller can tell "no evidence" from "evidence excluded". */
  excludedNoParams: number;
  distinctLearners: number;
  minSampleForVerdict: number;
  overall: {
    attempts: number;
    brierBkt: number | null;
    brierBaseline: number | null;
    sufficientEvidence: boolean;
  };
  /** Sorted by attempt count, descending — the KCs with the most evidence read first. */
  perKc: KcCalibration[];
}

const DEFAULT_MIN_SAMPLE = 30;

/**
 * Brier score: mean squared error between a predicted probability and the
 * 0/1 outcome it was predicting. Requires at least one pair — the caller is
 * responsible for the empty case, the same way `predictCorrect` is the
 * caller's to not call on zero evidence.
 */
function brier(pairs: ReadonlyArray<{ predicted: number; correct: boolean }>): number {
  const sum = pairs.reduce((total, p) => total + (p.predicted - (p.correct ? 1 : 0)) ** 2, 0);
  return sum / pairs.length;
}

/**
 * Builds the calibration report from raw attempt evidence and the KCs known
 * to score it against. Pure — no I/O, no clock, fully deterministic — so it
 * is testable with synthetic evidence exactly the way `bktUpdate` itself is.
 *
 * `params` is looked up per KC AS THEY ARE TODAY, from the `kcs` the caller
 * passes in. `kc_attempt` carries no per-attempt parameter snapshot, so an
 * attempt from before a KC's fixed parameters were last hand-edited is
 * scored against the CURRENT values rather than whatever was in force at
 * the time — an acceptable approximation for a coarse first read, and worth
 * remembering if a KC's numbers are ever deliberately retuned mid-history.
 */
export function calibrationReport(
  attempts: readonly CalibrationAttempt[],
  kcs: readonly KcKnown[],
  minSample: number = DEFAULT_MIN_SAMPLE,
): CalibrationReport {
  const knownByKc = new Map(kcs.map((k) => [k.id, k]));
  const learners = new Set<string>();
  const byKc = new Map<
    string,
    { known: KcKnown; learners: Set<string>; rows: Array<{ predicted: number; correct: boolean }> }
  >();
  let excludedNoParams = 0;

  for (const attempt of attempts) {
    learners.add(attempt.userId);
    const known = knownByKc.get(attempt.kcId);
    if (!known) {
      excludedNoParams += 1;
      continue;
    }
    const predicted = predictCorrect(attempt.pKnownBefore, known.params);
    const bucket = byKc.get(attempt.kcId) ?? { known, learners: new Set<string>(), rows: [] };
    bucket.learners.add(attempt.userId);
    bucket.rows.push({ predicted, correct: attempt.correct });
    byKc.set(attempt.kcId, bucket);
  }

  const perKc: KcCalibration[] = [...byKc.values()]
    .map(({ known, learners: kcLearners, rows }) => {
      const observedRate = rows.filter((r) => r.correct).length / rows.length;
      const meanPredicted = rows.reduce((total, r) => total + r.predicted, 0) / rows.length;
      const baselineRows = rows.map((r) => ({ predicted: observedRate, correct: r.correct }));
      return {
        kcId: known.id,
        kcKey: known.key,
        attempts: rows.length,
        learners: kcLearners.size,
        meanPredicted,
        observedRate,
        brierBkt: brier(rows),
        brierBaseline: brier(baselineRows),
        sufficientEvidence: rows.length >= minSample,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  const allRows = [...byKc.values()].flatMap((bucket) => bucket.rows);
  const overallObservedRate = allRows.length > 0 ? allRows.filter((r) => r.correct).length / allRows.length : 0;

  return {
    totalAttempts: attempts.length,
    excludedNoParams,
    distinctLearners: learners.size,
    minSampleForVerdict: minSample,
    overall: {
      attempts: allRows.length,
      brierBkt: allRows.length > 0 ? brier(allRows) : null,
      brierBaseline:
        allRows.length > 0 ? brier(allRows.map((r) => ({ predicted: overallObservedRate, correct: r.correct }))) : null,
      sufficientEvidence: allRows.length >= minSample,
    },
    perKc,
  };
}
