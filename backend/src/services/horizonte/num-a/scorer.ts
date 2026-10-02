import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import { isAbacusDigits, isRekenrekCounts } from './beads-model.js';
import { isJumpList, isZoomUnits, jumpSetup, jumpTargetReachable, landing, zoomSetup, zoomStartUnits, zoomTargetReachable } from './line-model.js';
import { balanceSetup, balanceTargetReachable, clockSetup, clockTargetReachable, isClockMinutes, isPans, isRulerEnd, panDifference, rulerSetup, rulerTargetReachable, untouchedPans } from './measure-model.js';

type Grid = number | readonly number[];

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const REVIEW: V2Grade = { verdict: 'review', diagnostic: 'value' };

const same = (a: Grid, b: Grid): boolean => (typeof a === 'number' || typeof b === 'number' ? a === b : a.length === b.length && a.every((value, index) => value === b[index]));
const payloadOf = (segment: unknown): unknown => (typeof segment === 'object' && segment !== null ? (segment as { payload?: unknown }).payload : undefined);
const startOf = (segment: unknown): unknown => { const payload = payloadOf(segment); return typeof payload === 'object' && payload !== null ? (payload as { start?: unknown }).start : undefined; };
/** The one field a response carries: any other shape, extra field or non-object is undefined, which every scorer refuses. */
const field = (response: unknown, key: string): unknown =>
  typeof response === 'object' && response !== null && !Array.isArray(response) && Object.keys(response).join() === key ? (response as Record<string, unknown>)[key] : undefined;
const copy = (value: unknown): unknown => (Array.isArray(value) ? [...value] : value);
const targetOf = (rubric: unknown): unknown => (typeof rubric === 'object' && rubric !== null && !Array.isArray(rubric) ? (rubric as { target?: unknown }).target : undefined);

/**
 * invalid: malformed, breaks a rule of the piece, or a rubric whose target is malformed or unreachable. valid: the start left
 * as it was (and every well-formed response when there is no rubric, as in the browser). review: changed, not the target.
 * met: the target. `state` is what the response comes to (counts, a landing, a difference); `start` is the same for no change.
 */
function ladder(start: Grid, state: Grid, rubric: unknown, solvable: (target: unknown) => Grid | undefined): V2Grade {
  if (rubric === undefined) return VALID;
  const target = solvable(targetOf(rubric));
  if (target === undefined) return INVALID;
  if (same(state, start)) return VALID;
  return same(state, target) ? MET : REVIEW;
}

function rekenrek(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const start = startOf(segment);
  const beads = field(response, 'beads');
  if (!isRekenrekCounts(start) || !isRekenrekCounts(beads)) return INVALID;
  return ladder(start, beads, rubric, (target) => (isRekenrekCounts(target) && !same(target, start) ? target : undefined));
}

function abacus(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const start = startOf(segment);
  if (!isAbacusDigits(start)) return INVALID;
  const digits = field(response, 'digits');
  if (!isAbacusDigits(digits, start.length)) return INVALID;
  return ladder(start, digits, rubric, (target) => (isAbacusDigits(target, start.length) && !same(target, start) ? target : undefined));
}

function emptyLine(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const setup = jumpSetup(payloadOf(segment));
  const jumps = field(response, 'jumps');
  if (!setup || !isJumpList(setup, jumps)) return INVALID;
  return ladder(setup.start, landing(setup.start, jumps), rubric, (target) => (jumpTargetReachable(setup, target) ? target : undefined));
}

function zoomLine(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const setup = zoomSetup(payloadOf(segment));
  if (!setup) return INVALID;
  const units = field(response, 'units');
  if (!isZoomUnits(setup, units)) return INVALID;
  return ladder(zoomStartUnits(setup), units, rubric, (target) => (zoomTargetReachable(setup, target) ? target : undefined));
}

function clock(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const setup = clockSetup(payloadOf(segment));
  if (!setup) return INVALID;
  const minutes = field(response, 'minutes');
  if (!isClockMinutes(minutes, setup.step)) return INVALID;
  return ladder(setup.start, minutes, rubric, (target) => (clockTargetReachable(setup, target) ? target : undefined));
}

function ruler(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const setup = rulerSetup(payloadOf(segment));
  if (!setup) return INVALID;
  const end = field(response, 'end');
  if (!isRulerEnd(setup, end)) return INVALID;
  return ladder(setup.start, end, rubric, (target) => (rulerTargetReachable(setup, target) ? target : undefined));
}

function panBalance(segment: unknown, response: unknown, rubric: unknown): V2Grade {
  const setup = balanceSetup(payloadOf(segment));
  if (!setup) return INVALID;
  const pans = field(response, 'pans');
  if (!isPans(setup, pans)) return INVALID;
  return ladder(panDifference(setup, untouchedPans(setup)), panDifference(setup, pans), rubric, (target) => (balanceTargetReachable(setup, target) ? target : undefined));
}

const scorer = (grade: (segment: unknown, response: unknown, rubric: unknown) => V2Grade, sample: (segment: unknown) => unknown): HorizonteScorer => ({
  grade: grade as HorizonteScorer['grade'],
  sample: sample as HorizonteScorer['sample'],
});

export const NUM_A_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.rekenrek.v2': scorer(rekenrek, (segment) => ({ beads: copy(startOf(segment)) })),
  'math.abacus.v2': scorer(abacus, (segment) => ({ digits: copy(startOf(segment)) })),
  'math.number-line.empty.v2': scorer(emptyLine, () => ({ jumps: [] })),
  'math.number-line.zoom.v2': scorer(zoomLine, (segment) => { const setup = zoomSetup(payloadOf(segment)); return { units: setup ? zoomStartUnits(setup) : 0 }; }),
  'math.clock.v2': scorer(clock, (segment) => ({ minutes: startOf(segment) })),
  'math.ruler.v2': scorer(ruler, (segment) => ({ end: startOf(segment) })),
  'math.pan-balance.v2': scorer(panBalance, (segment) => { const setup = balanceSetup(payloadOf(segment)); return { pans: setup ? untouchedPans(setup) : [] }; }),
};
