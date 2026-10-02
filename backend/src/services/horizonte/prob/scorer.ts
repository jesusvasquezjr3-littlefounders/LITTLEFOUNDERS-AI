import type { V2Grade } from '../../v2VisualScorer.js';
import { gradeArrangement, gradeCurveParameters, gradeNumberTolerance } from '../../v2AnswerShapes.js';
import type { HorizonteScorer } from '../types.js';
import {
  CHANCE_TOLERANCE_MAX, TREE_SLOTS, chipId, hasOnly, isAskable, isChipSet, isRecord, posterior, treeBasis, treeSolution,
  type Ask, type TreeBasis, type TreeSolution,
} from './model.js';
import { ratCompare, ratEquals, ratFromInt, parseRat, rat, type Rat } from './rational.js';
import {
  INTERCEPT_RANGE_TEXT, SLOPE_RANGE_TEXT, fitOnGrid, isLineTenths, isPoints, sameLine, sseHundredths, tenthsText,
  type LineTenths, type Point,
} from './regression.js';

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const REVIEW: V2Grade = { verdict: 'review', diagnostic: 'value' };

const ZERO = ratFromInt(0);
const NEAR_CHANCE_MAX = rat(1n, 10n);
const NEAR_PARAMETER_MAX = rat(1n, 2n);
const MET_PARAMETER_MAX = rat(1n, 20n);

/** The shape ladder on the closed scorer ladder: every shape diagnostic reads "value", the one reason a response is not met. */
const ladder = (shape: { verdict: string }): V2Grade => (shape.verdict === 'met' ? MET : shape.verdict === 'review' ? REVIEW : shape.verdict === 'valid' ? VALID : INVALID);

const sameSolution = (rubric: unknown, solution: TreeSolution): boolean => {
  if (!hasOnly(rubric, ['solutions']) || !Array.isArray(rubric.solutions) || rubric.solutions.length !== 1) return false;
  const given: unknown = rubric.solutions[0];
  if (!hasOnly(given, TREE_SLOTS)) return false;
  return TREE_SLOTS.every((slot) => {
    const chips = given[slot];
    return Array.isArray(chips) && chips.length === 1 && chips[0] === solution[slot][0];
  });
};

const untouchedTree = (slots: Record<string, unknown>): boolean =>
  Object.keys(slots).every((slot) => (TREE_SLOTS as readonly string[]).includes(slot) && Array.isArray(slots[slot]) && (slots[slot] as unknown[]).length === 0);

type TreeSegment = { payload: TreeBasis & { chips: number[] } };

/**
 * invalid: malformed, a chip that is not in the tray, a chip used twice or two chips on one branch, or (with a rubric) a key
 * that is not the one tree this population grows. valid: no chip placed yet, and every well-formed tree without a rubric.
 * review: placed, but not every head count sits on its branch. met: every head count on its own branch.
 */
function gradeTree(segment: TreeSegment, response: unknown, rubric: unknown): V2Grade {
  const payload = segment?.payload;
  const basis = treeBasis(payload);
  if (!basis || !isChipSet(payload.chips, basis)) return INVALID;
  const solution = treeSolution(basis);
  if (!solution || !hasOnly(response, ['slots']) || !isRecord(response.slots)) return INVALID;
  if (rubric !== undefined && !sameSolution(rubric, solution)) return INVALID;
  if (untouchedTree(response.slots)) return VALID;
  const shape = gradeArrangement(response, rubric, { pieceIds: payload.chips.map(chipId), slotIds: [...TREE_SLOTS] });
  return ladder(shape);
}

type BayesSegment = { payload: TreeBasis & { ask: Ask } };

const allowance = (value: unknown): Rat | null => (hasOnly(value, ['absolute']) ? parseRat(value.absolute) : null);

function bandsFit(tolerance: unknown, review: unknown, metMax: Rat, nearMax: Rat): boolean {
  const met = allowance(tolerance);
  if (!met || ratCompare(met, ZERO) < 0 || ratCompare(met, metMax) > 0) return false;
  if (review === undefined) return true;
  const near = allowance(review);
  return near !== null && ratCompare(near, met) > 0 && ratCompare(near, nearMax) <= 0;
}

function chanceKey(rubric: unknown, answer: Rat): boolean {
  if (!isRecord(rubric) || !Object.keys(rubric).every((key) => ['target', 'tolerance', 'review'].includes(key))) return false;
  const target = parseRat(rubric.target);
  return target !== null && ratEquals(target, answer) && bandsFit(rubric.tolerance, rubric.review, CHANCE_TOLERANCE_MAX, NEAR_CHANCE_MAX);
}

/**
 * invalid: malformed, a chance that is not a number from 0 to 1, or (with a rubric) a key that is not the exact share asked
 * for or has a looser allowance than a hundredth. valid: the field left empty, and every well-formed chance without a rubric.
 * review: a chance away from the share. met: within the allowance of the exact share.
 */
function gradeBayes(segment: BayesSegment, response: unknown, rubric: unknown): V2Grade {
  const payload = segment?.payload;
  const basis = treeBasis(payload);
  if (!basis || !isRecord(payload) || !isAskable(basis, payload.ask as Ask)) return INVALID;
  const answer = posterior(basis, payload.ask as Ask);
  if (!answer || !hasOnly(response, ['value'])) return INVALID;
  if (rubric !== undefined && !chanceKey(rubric, answer)) return INVALID;
  if (response.value === '') return VALID;
  return ladder(gradeNumberTolerance(response, rubric, { minimum: '0', maximum: '1' }));
}

type RegressionSegment = { payload: { size: number; points: Point[]; start: LineTenths } };

function lineKey(rubric: unknown, answer: LineTenths): boolean {
  if (!isRecord(rubric) || !Object.keys(rubric).every((key) => ['family', 'target', 'parameter_tolerance', 'parameter_review'].includes(key))) return false;
  if (rubric.family !== 'line' || !hasOnly(rubric.target, ['m', 'b'])) return false;
  const slope = parseRat(rubric.target.m);
  const intercept = parseRat(rubric.target.b);
  if (!slope || !intercept || !ratEquals(slope, rat(BigInt(answer.slope), 10n)) || !ratEquals(intercept, rat(BigInt(answer.intercept), 10n))) return false;
  return bandsFit(rubric.parameter_tolerance, rubric.parameter_review, MET_PARAMETER_MAX, NEAR_PARAMETER_MAX);
}

const atStart = (response: unknown, start: LineTenths): boolean => {
  if (!hasOnly(response, ['family', 'params']) || !hasOnly(response.params, ['m', 'b'])) return false;
  const slope = parseRat(response.params.m);
  const intercept = parseRat(response.params.b);
  return slope !== null && intercept !== null && ratEquals(slope, rat(BigInt(start.slope), 10n)) && ratEquals(intercept, rat(BigInt(start.intercept), 10n));
};

/**
 * invalid: malformed, a slope or intercept outside the sliders, or (with a rubric) a key that is not the least squares line
 * of these points. valid: the line left where it started, and every well-formed line without a rubric. review: moved, but not
 * on the best line. met: within a twentieth of the best slope and intercept.
 */
function gradeRegression(segment: RegressionSegment, response: unknown, rubric: unknown): V2Grade {
  const payload = segment?.payload;
  if (!hasOnly(payload, ['size', 'points', 'start']) || !isPoints(payload.points, payload.size as number) || !isLineTenths(payload.start)) return INVALID;
  const answer = fitOnGrid(payload.points);
  if (!answer || sameLine(answer, payload.start) || sseHundredths(payload.points, answer) === 0) return INVALID;
  if (rubric !== undefined && !lineKey(rubric, answer)) return INVALID;
  const shape = gradeCurveParameters(response, rubric, { families: ['line'], ranges: { m: SLOPE_RANGE_TEXT, b: INTERCEPT_RANGE_TEXT } });
  if (shape.verdict === 'invalid') return INVALID;
  if (rubric === undefined) return VALID;
  if (shape.verdict === 'met') return MET;
  return atStart(response, payload.start) ? VALID : REVIEW;
}

const scorer = <S>(grade: (segment: S, response: unknown, rubric: unknown) => V2Grade, sample: (segment: S) => unknown): HorizonteScorer => ({
  grade: grade as unknown as HorizonteScorer['grade'],
  sample: sample as unknown as HorizonteScorer['sample'],
});

export const PROB_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'prob.tree.v2': scorer(gradeTree, () => ({ slots: {} })),
  'prob.bayes.v2': scorer(gradeBayes, () => ({ value: '' })),
  'prob.regression.v2': scorer(gradeRegression, (segment: RegressionSegment) => ({
    family: 'line', params: { m: tenthsText(segment.payload.start.slope), b: tenthsText(segment.payload.start.intercept) },
  })),
};
