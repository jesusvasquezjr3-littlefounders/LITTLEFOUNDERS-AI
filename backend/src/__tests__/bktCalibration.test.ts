import { describe, expect, it } from 'vitest';
import { calibrationReport, type CalibrationAttempt, type KcKnown } from '../services/pedagogy/bktCalibration.js';
import type { BktParams } from '../services/pedagogy/bkt.js';

/*
 * BKT calibration is INSTRUMENTATION for ORACLE.md §19.5's "per-learner BKT
 * parameters" backlog item — see `bktCalibration.ts`'s own header for the
 * full case for why this is a diagnostic and not an algorithm change. These
 * tests are the same kind `bkt.ts` itself gets in `pedagogy.test.ts`: pure
 * arithmetic, synthetic evidence, no I/O.
 */

const PARAMS: BktParams = { pL0: 0.25, pT: 0.15, pG: 0.2, pS: 0.1 };

const KC_A: KcKnown = { id: 'kc-a', key: 'money.saving', params: PARAMS };
const KC_B: KcKnown = { id: 'kc-b', key: 'money.change', params: PARAMS };

function attempt(over: Partial<CalibrationAttempt> & Pick<CalibrationAttempt, 'kcId' | 'correct'>): CalibrationAttempt {
  return { userId: 'learner-1', pKnownBefore: 0.5, ...over };
}

describe('calibrationReport — reading whether fixed BKT parameters are already earning their keep', () => {
  it('reports zero evidence honestly rather than a false verdict, on no attempts at all', () => {
    const report = calibrationReport([], [KC_A]);
    expect(report.totalAttempts).toBe(0);
    expect(report.distinctLearners).toBe(0);
    expect(report.excludedNoParams).toBe(0);
    expect(report.overall).toEqual({
      attempts: 0,
      brierBkt: null,
      brierBaseline: null,
      sufficientEvidence: false,
    });
    expect(report.perKc).toEqual([]);
  });

  it('flags a KC below the sample floor as informational only, without refusing to compute it', () => {
    const attempts = [
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.1 }),
    ];
    const report = calibrationReport(attempts, [KC_A], /* minSample */ 30);
    expect(report.perKc).toHaveLength(1);
    expect(report.perKc[0]?.attempts).toBe(2);
    expect(report.perKc[0]?.sufficientEvidence).toBe(false);
    // Still a real, computed number — "not enough evidence for a verdict" is
    // the caller's interpretation of `sufficientEvidence`, not a reason for
    // this function to withhold the arithmetic itself.
    expect(report.perKc[0]?.brierBkt).not.toBeNull();
  });

  it('marks a KC right at the sample floor as sufficient, and one short of it as not', () => {
    const twenty = Array.from({ length: 20 }, () => attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5 }));
    const nineteen = twenty.slice(0, 19);
    expect(calibrationReport(twenty, [KC_A], 20).perKc[0]?.sufficientEvidence).toBe(true);
    expect(calibrationReport(nineteen, [KC_A], 20).perKc[0]?.sufficientEvidence).toBe(false);
  });

  it('scores BKT BETTER than the flat baseline when its per-attempt predictions genuinely track the outcome', () => {
    // predictCorrect(0.9, PARAMS) ≈ 0.83, predictCorrect(0.1, PARAMS) ≈ 0.27 —
    // both attempts land where BKT's own belief pointed, so its per-attempt
    // Brier error is small. The flat baseline predicts this KC's overall
    // 50% hit rate for every attempt regardless of context, which is a much
    // worse guess on either extreme.
    const attempts = [
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.1 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.1 }),
    ];
    const kc = calibrationReport(attempts, [KC_A], 1).perKc[0];
    expect(kc?.observedRate).toBeCloseTo(0.5, 5);
    expect(kc?.brierBaseline).toBeCloseTo(0.25, 5);
    expect(kc?.brierBkt).toBeLessThan(kc?.brierBaseline ?? Infinity);
    expect(kc?.brierBkt).toBeCloseTo(0.0509, 3);
  });

  it('scores BKT WORSE than the flat baseline when its predictions are confidently wrong — the metric does not always favor it', () => {
    // The same pKnownBefore values as above, paired with the OPPOSITE
    // outcomes: BKT's confidence points the wrong way on every attempt.
    const attempts = [
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.1 }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.1 }),
    ];
    const kc = calibrationReport(attempts, [KC_A], 1).perKc[0];
    expect(kc?.observedRate).toBeCloseTo(0.5, 5);
    expect(kc?.brierBaseline).toBeCloseTo(0.25, 5);
    expect(kc?.brierBkt).toBeGreaterThan(kc?.brierBaseline ?? -Infinity);
  });

  it('excludes an attempt whose KC is not in the known set, counts it, and never lets it corrupt a real KC’s numbers', () => {
    const attempts = [
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: 'kc-retired', correct: false, pKnownBefore: 0.9, userId: 'learner-2' }),
    ];
    const report = calibrationReport(attempts, [KC_A], 1);
    expect(report.excludedNoParams).toBe(1);
    expect(report.totalAttempts).toBe(2);
    expect(report.perKc).toHaveLength(1);
    expect(report.perKc[0]?.attempts).toBe(1);
    // The excluded learner still counts toward the report's overall reach —
    // "how many distinct learners have any evidence at all" is meaningful
    // independent of whether any one KC could be scored.
    expect(report.distinctLearners).toBe(2);
  });

  it('aggregates overall by pooling every attempt, not by averaging the per-KC scores', () => {
    const attempts = [
      // KC A: 4 attempts, well-calibrated (see the dedicated test above).
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.9 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.1 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.1 }),
      // KC B: 1 attempt only.
      attempt({ kcId: KC_B.id, correct: true, pKnownBefore: 0.9, userId: 'learner-2' }),
    ];
    const report = calibrationReport(attempts, [KC_A, KC_B], 1);
    expect(report.overall.attempts).toBe(5);
    // A pooled Brier over all 5 rows, not the mean of the two KCs' own
    // scores (which would ignore that KC A contributed four times the rows).
    const kcARows = 4;
    const kcAErrorSum = 0.0509 * kcARows; // from the dedicated well-calibrated test above
    const kcBError = (0.83 - 1) ** 2; // predictCorrect(0.9, PARAMS) ≈ 0.83, correct
    const expectedOverall = (kcAErrorSum + kcBError) / 5;
    expect(report.overall.brierBkt).toBeCloseTo(expectedOverall, 2);
  });

  it('sorts KCs by how much evidence exists for them, most first', () => {
    const attempts = [
      attempt({ kcId: KC_B.id, correct: true, pKnownBefore: 0.5 }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5 }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.5, userId: 'learner-2' }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5, userId: 'learner-3' }),
    ];
    const report = calibrationReport(attempts, [KC_A, KC_B], 1);
    expect(report.perKc.map((k) => k.kcId)).toEqual([KC_A.id, KC_B.id]);
  });

  it('counts distinct learners per KC, not raw attempt counts', () => {
    const attempts = [
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5, userId: 'learner-1' }),
      attempt({ kcId: KC_A.id, correct: false, pKnownBefore: 0.5, userId: 'learner-1' }),
      attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5, userId: 'learner-2' }),
    ];
    const report = calibrationReport(attempts, [KC_A], 1);
    expect(report.perKc[0]?.attempts).toBe(3);
    expect(report.perKc[0]?.learners).toBe(2);
  });

  it('respects a caller-supplied minSample instead of the default', () => {
    const attempts = Array.from({ length: 5 }, () => attempt({ kcId: KC_A.id, correct: true, pKnownBefore: 0.5 }));
    expect(calibrationReport(attempts, [KC_A], 5).perKc[0]?.sufficientEvidence).toBe(true);
    expect(calibrationReport(attempts, [KC_A], 6).perKc[0]?.sufficientEvidence).toBe(false);
  });
});
