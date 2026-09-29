import { describe, expect, it } from 'vitest';
import { SPACED_REVIEW_THRESHOLDS } from '../tutor/spacedReview.js';
import { dialoguePolicy } from '../tutor/dialogueCalibration.js';
import {
  CALIBRATION_PERSONAS,
  REVIEW_PERSONAS,
  runCalibrationPersona,
  runReviewCalibrationGym,
  runReviewPersona,
} from '../tutor/reviewCalibrationGym.js';

/*
 * C.11 / C.17 against Appendix F Part 3 Stage 2's simulated learners. Every
 * persona passes on the proposed defaults AND is proven able to FAIL: a
 * persona no regression can turn red is decoration.
 */

const review = (name: string) => REVIEW_PERSONAS.find((p) => p.name === name)!;
const calibration = (name: string) => CALIBRATION_PERSONAS.find((p) => p.name === name)!;
const T = SPACED_REVIEW_THRESHOLDS;

describe('the spaced-review router and the dialogue calibration against the simulated learners', () => {
  it('passes every persona on the proposed defaults', () => {
    const { ok, review: r, calibration: c } = runReviewCalibrationGym();
    expect([...r, ...c].flatMap((x) => x.problems.map((p) => `${x.persona}: ${p}`))).toEqual([]);
    expect(r.map((x) => x.persona).sort()).toEqual([
      'far_below_learner',
      'forgetting_reviewer',
      'gaming_rapid_guesser',
      'late_session_struggler',
      'near_miss_slipper',
    ]);
    expect(c.map((x) => x.persona).sort()).toEqual(['adult_control', 'polite_teen', 'reactant_teen', 'teen_control', 'young_hint_seeker']);
    expect(ok).toBe(true);
  });

  it('no routing record, for any persona, carries an emotion label or anything but ids, labels and numbers', () => {
    for (const p of REVIEW_PERSONAS) {
      // Whole words: the outcome label "retired" is not the emotion "tired".
      expect(JSON.stringify(runReviewPersona(p).report), p.name).not.toMatch(
        /\b(?:frustrat\w*|bored|angry|sad|anxious|tired|emotion\w*|mood|feel\w*|user\w*|nickname)\b/i,
      );
    }
  });
});

describe('every persona can turn red (mutation checks)', () => {
  it('near_miss_slipper: a floor above the belief sends the slip cross-session', () => {
    expect(runReviewPersona(review('near_miss_slipper'), { ...T, nearThresholdFloor: 0.99 }).problems).not.toEqual([]);
  });
  it('near_miss_slipper: a gap no session reaches never re-checks it', () => {
    expect(runReviewPersona(review('near_miss_slipper'), { ...T, reexposureGapTurns: 50 }).problems).not.toEqual([]);
  });
  it('late_session_struggler: a rule blind to the wrap-up crams the last minutes', () => {
    expect(runReviewPersona(review('late_session_struggler'), { ...T, minMsUntilWrap: 0 }).problems).not.toEqual([]);
  });
  it('far_below_learner: a floor of zero treats teaching as review', () => {
    expect(runReviewPersona(review('far_below_learner'), { ...T, nearThresholdFloor: 0 }).problems).not.toEqual([]);
  });
  it('forgetting_reviewer: without a cap the failing KC is never handed off', () => {
    expect(runReviewPersona(review('forgetting_reviewer'), { ...T, maxReexposuresPerKc: 99 }).problems).not.toEqual([]);
  });
  it('gaming_rapid_guesser: a zero gap counts every massed miss as spaced', () => {
    expect(runReviewPersona(review('gaming_rapid_guesser'), { ...T, reexposureGapTurns: 0, maxReexposuresPerKc: 99 }).problems).not.toEqual([]);
  });
  it('reactant_teen: the control policy in its place is not autonomy-supportive (no ask-first, no option wording)', () => {
    expect(runCalibrationPersona(calibration('reactant_teen'), (band) => dialoguePolicy(band, 'control')).problems).not.toEqual([]);
  });
  it('young_hint_seeker: the full ladder in its place takes four requests to the tell', () => {
    expect(runCalibrationPersona(calibration('young_hint_seeker'), (_band, variant) => dialoguePolicy('tween', variant)).problems).not.toEqual([]);
  });
  it('adult_control: the calibrated policy in its place is not the control arm', () => {
    expect(runCalibrationPersona(calibration('adult_control'), (band) => dialoguePolicy(band, 'calibrated')).problems).not.toEqual([]);
  });
  it('teen_control: a gate keyed on the variant (the pre-fix policy) lets every order through the control arm', () => {
    const variantKeyed = (band: Parameters<typeof dialoguePolicy>[0], variant: Parameters<typeof dialoguePolicy>[1]) => ({
      ...dialoguePolicy(band, variant),
      controllingGate: variant === 'calibrated' && (band === 'teen' || band === 'adult'),
    });
    expect(runCalibrationPersona(calibration('teen_control'), variantKeyed).problems).toHaveLength(3);
    expect(runCalibrationPersona(calibration('adult_control'), variantKeyed).problems).not.toEqual([]);
  });
  it('polite_teen: a gate that flags every sentence turns it red', () => {
    const noisy = (band: Parameters<typeof dialoguePolicy>[0], variant: Parameters<typeof dialoguePolicy>[1]) => dialoguePolicy(band, variant);
    const result = runCalibrationPersona({ ...calibration('polite_teen'), drafts: ['You have to try it.'] }, noisy);
    expect(result.problems).not.toEqual([]);
  });
});
