import type { V2Grade } from '../../v2VisualScorer.js';
import { gradeArrangement, gradeNumberTolerance } from '../../v2AnswerShapes.js';
import type { HorizonteScorer } from '../types.js';
import { COMPOUND_TYPE, FIN1_RUBRICS, RATE_RETURN_TYPE, TIME_VALUE_TYPE, compoundPayload, ratePayload, timeValuePayload } from './contract.js';
import {
  COMPOUND_RATE, COMPOUND_YEARS, TV_VALUE_LIMIT, compoundCents, keySolutionSound, meetsChallenge, nearestOption, normalizeDecimal, rateRange, rateTarget,
  timeValueFrame, timeValueTarget, wholeBetween, type Slots,
} from './model.js';

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
/** A plain object whose own keys are the required ones plus any of the optional ones, and nothing else. */
const shaped = (value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> =>
  isRecord(value) && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const asGrade = (grade: { verdict: V2Grade['verdict']; diagnostic: V2Grade['diagnostic'] }): V2Grade => ({ verdict: grade.verdict, diagnostic: grade.diagnostic });
const payloadOf = (segment: unknown): unknown => (isRecord(segment) ? segment.payload : undefined);

/* ── F1.10 ──
 * Response { predict, rate, years, explain? }. Without `explain` the learner is still exploring: valid. With it, three
 * parts are marked against the private key and the public challenge: the prediction (the option nearest the true value),
 * the sliders (they reach the challenge) and the explanation. All three right is met; one wrong is review/miss, two
 * review/partial, all three review/value. Without a rubric (the browser) a well-formed response is only valid.
 */
function compoundGrade(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const payload = compoundPayload.safeParse(payloadOf(segment));
  if (!payload.success) return INVALID;
  const p = payload.data;
  if (!shaped(response, ['predict', 'rate', 'years'], ['explain'])) return INVALID;
  const { predict, rate, years, explain } = response;
  if (typeof predict !== 'string' || !p.options.some((option) => option.id === predict)) return INVALID;
  if (!wholeBetween(rate, COMPOUND_RATE.min, COMPOUND_RATE.max) || !wholeBetween(years, COMPOUND_YEARS.min, COMPOUND_YEARS.max)) return INVALID;
  if (explain !== undefined && (typeof explain !== 'string' || !(p.explain as readonly string[]).includes(explain))) return INVALID;
  if (rubric === undefined) return VALID;
  const key = FIN1_RUBRICS[COMPOUND_TYPE].safeParse(rubric);
  if (!key.success) return INVALID;
  const truth = compoundCents(p.principalCents, p.scenario.rate, p.scenario.years);
  if (truth === null || nearestOption(p.options, truth) !== key.data.predictOption || key.data.explainId !== 'interest-on-interest') return INVALID;
  if (explain === undefined) return VALID;
  const wrong = [predict !== key.data.predictOption, !meetsChallenge(p.principalCents, p.challenge, rate, years), explain !== key.data.explainId].filter(Boolean).length;
  if (wrong === 0) return MET;
  return { verdict: 'review', diagnostic: wrong === 1 ? 'miss' : wrong === 2 ? 'partial' : 'value' };
}

/* ── F2.11 ──
 * Response { slots, value? }: the payments the learner placed on the timeline, then the worth they typed for that very
 * arrangement. The key holds the best arrangement(s) and the number tolerance; the number's target is computed from the
 * learner's own arrangement. Without `value` the learner is still arranging: valid. Both right is met; otherwise the
 * diagnostic is the arrangement's (miss, partial, false_alarm, value) or the number's (tolerance, value), and value when both fail.
 */
function timeValueGrade(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const payload = timeValuePayload.safeParse(payloadOf(segment));
  if (!payload.success) return INVALID;
  const p = payload.data;
  const frame = timeValueFrame(p);
  const context = { pieceIds: frame.pieceIds, slotIds: frame.slotIds, repeatable: frame.repeatable };
  if (!shaped(response, ['slots'], ['value'])) return INVALID;
  if (gradeArrangement({ slots: response.slots }, undefined, context).verdict === 'invalid') return INVALID;
  const value = response.value;
  if (value !== undefined && gradeNumberTolerance({ value }, undefined, TV_VALUE_LIMIT).verdict === 'invalid') return INVALID;
  if (rubric === undefined) return VALID;

  const key = FIN1_RUBRICS[TIME_VALUE_TYPE].safeParse(rubric);
  if (!key.success) return INVALID;
  const arrangementKey = { solutions: key.data.solutions };
  for (const solution of key.data.solutions) {
    if (gradeArrangement({ slots: solution }, arrangementKey, context).verdict !== 'met' || !keySolutionSound(p, solution)) return INVALID;
    const own = timeValueTarget(p, solution);
    if (own === null || gradeNumberTolerance({ value: own }, { target: own, tolerance: key.data.tolerance, review: key.data.review }, TV_VALUE_LIMIT).verdict !== 'met') return INVALID;
  }
  if (value === undefined) return VALID;

  const target = timeValueTarget(p, response.slots as Slots);
  if (target === null) return INVALID;
  const number = gradeNumberTolerance({ value }, { target, tolerance: key.data.tolerance, review: key.data.review }, TV_VALUE_LIMIT);
  const placed = gradeArrangement({ slots: response.slots }, arrangementKey, context);
  if (number.verdict === 'invalid' || placed.verdict === 'invalid') return INVALID;
  if (number.verdict === 'met' && placed.verdict === 'met') return MET;
  if (placed.verdict === 'met') return asGrade(number);
  if (number.verdict === 'met') return asGrade(placed);
  return { verdict: 'review', diagnostic: 'value' };
}

/* ── F2.12 ──
 * Response { value, final? }: a typed number. Without `final: true` the learner is still working: valid. The key's target
 * must be the model's own answer for the case (a wrong key never grades) and its tolerance bands must be well formed; the
 * grade is then the F0.3 number.tolerance verdict (met, review/tolerance, review/value).
 */
function rateGrade(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const payload = ratePayload.safeParse(payloadOf(segment));
  if (!payload.success) return INVALID;
  const p = payload.data;
  if (!shaped(response, ['value'], ['final'])) return INVALID;
  if (response.final !== undefined && typeof response.final !== 'boolean') return INVALID;
  const range = rateRange(p);
  if (gradeNumberTolerance({ value: response.value }, undefined, range).verdict === 'invalid') return INVALID;
  if (rubric === undefined) return VALID;
  const key = FIN1_RUBRICS[RATE_RETURN_TYPE].safeParse(rubric);
  const target = rateTarget(p);
  if (!key.success || target === null || normalizeDecimal(key.data.target) !== normalizeDecimal(target)) return INVALID;
  if (gradeNumberTolerance({ value: key.data.target }, key.data, range).verdict !== 'met') return INVALID;
  if (response.final !== true) return VALID;
  return asGrade(gradeNumberTolerance({ value: response.value }, key.data, range));
}

export const FIN1_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  [COMPOUND_TYPE]: {
    grade: compoundGrade as HorizonteScorer['grade'],
    sample: ((_segment: unknown, rubric: { predictOption: string; explainId: string }) => ({
      predict: rubric.predictOption, rate: COMPOUND_RATE.max, years: COMPOUND_YEARS.max, explain: rubric.explainId,
    })) as HorizonteScorer['sample'],
  },
  [TIME_VALUE_TYPE]: {
    grade: timeValueGrade as HorizonteScorer['grade'],
    sample: ((segment: unknown, rubric: { solutions: Slots[] }) => {
      const payload = timeValuePayload.safeParse(payloadOf(segment));
      const first = rubric.solutions[0]!;
      const target = payload.success ? timeValueTarget(payload.data, first) : null;
      return target === null ? { slots: first } : { slots: first, value: target };
    }) as HorizonteScorer['sample'],
  },
  [RATE_RETURN_TYPE]: {
    grade: rateGrade as HorizonteScorer['grade'],
    sample: ((_segment: unknown, rubric: { target: string }) => ({ value: rubric.target, final: true })) as HorizonteScorer['sample'],
  },
};
