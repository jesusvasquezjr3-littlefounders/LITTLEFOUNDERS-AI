import { FRACTION_PART_MAX, WALL_DENOMINATORS, between, gcd, keysAre, record, whole, type Fraction } from './fractionWallModel.js';

export const CIRCLE_VISUAL = 'fraction-circles';

export type CircleOp = 'show' | 'compare' | 'add' | 'subtract';
export type ShowPayload = { op: 'show'; fraction: Fraction };
export type CirclePairPayload = { op: 'compare' | 'add' | 'subtract'; left: Fraction; right: Fraction };
export type CirclePayload = ShowPayload | CirclePairPayload;
export type CircleAnswer = { n: number; d: number };

const PAIR_OPS: readonly string[] = ['compare', 'add', 'subtract'];

const circleDenominator = (value: unknown): value is number => whole(value) && (WALL_DENOMINATORS as readonly number[]).includes(value);

/** A proper, positive fraction over a denominator a circle can be cut into. */
function proper(value: unknown): value is Fraction {
  return Array.isArray(value) && value.length === 2 && circleDenominator(value[1]) && between(value[0], 1, (value[1] as number) - 1);
}

export function circleOp(payload: unknown): CircleOp | null {
  if (!record(payload)) return null;
  return payload.op === 'show' || (typeof payload.op === 'string' && PAIR_OPS.includes(payload.op)) ? (payload.op as CircleOp) : null;
}

/** show: one fraction to build. compare, add and subtract: two fractions of one denominator, the sum never past a whole, the difference positive. */
export function isCirclePayload(value: unknown): value is CirclePayload {
  const op = circleOp(value);
  if (op === null || !record(value)) return false;
  if (op === 'show') return keysAre(value, 'op', 'fraction') && proper(value.fraction);
  if (!keysAre(value, 'op', 'left', 'right') || !proper(value.left) || !proper(value.right) || value.left[1] !== value.right[1]) return false;
  const [a, d] = value.left;
  const c = value.right[0];
  if (op === 'compare') return a !== c;
  return op === 'add' ? a + c <= d : a > c;
}

export function circlePayloadProblem(payload: unknown): string | null {
  return isCirclePayload(payload) ? null : 'The payload is not a solvable fraction-circles task';
}

/** The answer the public numbers determine: the fraction itself for show, otherwise the larger, the sum or the difference in lowest terms. */
export function circleAnswer(payload: unknown): CircleAnswer | null {
  if (!isCirclePayload(payload)) return null;
  if (payload.op === 'show') return { n: payload.fraction[0], d: payload.fraction[1] };
  const [a, d] = payload.left;
  const c = payload.right[0];
  const n = payload.op === 'compare' ? Math.max(a, c) : payload.op === 'add' ? a + c : a - c;
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}

export type CircleStanding = 'invalid' | 'incomplete' | 'wrong' | 'right';

const part = (value: unknown): value is number => between(value, 0, FRACTION_PART_MAX);

/** show asks for the exact form (that many slices, that many shaded); the other operations take any form of the same value. */
export function circleReadsAsAnswer(payload: CirclePayload, answer: CircleAnswer, n: number, d: number): boolean {
  return payload.op === 'show' ? n === answer.n && d === answer.d : n * answer.d === answer.n * d;
}

/** Where a response stands: shaded slices over slices cut, or typed numerator over denominator, either 0 while nothing is entered. */
export function standCircle(payload: unknown, response: unknown): CircleStanding {
  const answer = circleAnswer(payload);
  if (answer === null || !isCirclePayload(payload) || !record(response) || !keysAre(response, 'n', 'd') || !part(response.n) || !part(response.d)) return 'invalid';
  if (response.n === 0 || response.d === 0) return 'incomplete';
  return circleReadsAsAnswer(payload, answer, response.n, response.d) ? 'right' : 'wrong';
}

/** A key is reachable only when it is a fraction a learner can meet: positive, in range, and reading as the answer. */
export function circleKeyProblem(payload: unknown, key: unknown): string | null {
  const answer = circleAnswer(payload);
  if (answer === null || !isCirclePayload(payload)) return 'The payload is not a solvable fraction-circles task';
  if (!record(key) || !keysAre(key, 'n', 'd') || !between(key.n, 1, FRACTION_PART_MAX) || !between(key.d, 1, FRACTION_PART_MAX)) return 'The key is a numerator and a denominator';
  return circleReadsAsAnswer(payload, answer, key.n, key.d) ? null : 'The key is not the answer the numbers determine';
}
