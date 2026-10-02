import { createPrng } from '../seed/prng.js';

export const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A plain object whose own keys are exactly `keys`: a response or rubric with an extra or missing field is malformed. */
export const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
export const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;

export const CHANCE_KINDS = ['coin', 'die', 'spinner'] as const;
export type ChanceKind = (typeof CHANCE_KINDS)[number];
export const WEIGHT_MAX = 12;
export const SPINNER_MIN = 3;
export const SPINNER_MAX = 8;
export const FACES_MAX = SPINNER_MAX;
export const STOPS_MIN = 3;
export const STOPS_MAX = 8;
export const CHANCE_TRIALS_LIMIT = 5000;
export const GALTON_BALLS_LIMIT = 3000;
export const GALTON_ROWS_MIN = 3;
export const GALTON_ROWS_MAX = 10;
export const GALTON_PCT_MIN = 10;
export const GALTON_PCT_MAX = 90;
export const GALTON_VIEWS = ['board', 'walk'] as const;
export type GaltonView = (typeof GALTON_VIEWS)[number];
export const TOLERANCE_MIN = 1;
export const TOLERANCE_MAX = 25;
export const FLOOR_MIN = 20;
/** A key is solvable when the run at the last stop lands inside the tolerance at this many standard deviations. */
export const SOLVE_SIGMAS = 5;
/** The event must be neither rare nor near certain, so a share in percentage points means something. */
export const CHANCE_LOW = { num: 1, den: 20 } as const;
export const CHANCE_HIGH = { num: 19, den: 20 } as const;

export type Fraction = { readonly num: number; readonly den: number };

const gcd = (a: bigint, b: bigint): bigint => { let x = a; let y = b; while (y > 0n) { [x, y] = [y, x % y]; } return x; };

export function reduceFraction(num: bigint, den: bigint): Fraction {
  const divisor = gcd(num, den) || 1n;
  return { num: Number(num / divisor), den: Number(den / divisor) };
}

export const isFraction = (value: unknown): value is Fraction =>
  hasOnly(value, ['num', 'den']) && inRange(value.num, 1, Number.MAX_SAFE_INTEGER) && inRange(value.den, 2, Number.MAX_SAFE_INTEGER) && (value.num as number) < (value.den as number);

export const sameFraction = (a: Fraction, b: Fraction): boolean => a.num === b.num && a.den === b.den;

export function chanceInBand(chance: Fraction): boolean {
  const num = BigInt(chance.num);
  const den = BigInt(chance.den);
  return num * BigInt(CHANCE_LOW.den) >= den * BigInt(CHANCE_LOW.num) && num * BigInt(CHANCE_HIGH.den) <= den * BigInt(CHANCE_HIGH.num);
}

/** |hits / trials - chance| <= tolerance / 100, in exact integers. */
export function withinTolerance(hits: number, trials: number, chance: Fraction, tolerance: number): boolean {
  const gap = BigInt(hits) * BigInt(chance.den) - BigInt(chance.num) * BigInt(trials);
  return 100n * (gap < 0n ? -gap : gap) <= BigInt(tolerance) * BigInt(trials) * BigInt(chance.den);
}

/** The run at `trials` lands inside the tolerance at SOLVE_SIGMAS standard deviations: 25 * 10^4 * p(1-p) <= tolerance^2 * trials. */
export function solvableAt(chance: Fraction, trials: number, tolerance: number): boolean {
  const num = BigInt(chance.num);
  const den = BigInt(chance.den);
  const sigmas = BigInt(SOLVE_SIGMAS * SOLVE_SIGMAS);
  return sigmas * 10000n * num * (den - num) <= BigInt(tolerance * tolerance) * BigInt(trials) * den * den;
}

export const isTolerance = (value: unknown): value is number => inRange(value, TOLERANCE_MIN, TOLERANCE_MAX);

/** Between 3 and 8 stops in strictly rising order, each a whole count up to `limit`: the run lengths the learner can pick. */
export function isStops(value: unknown, limit: number): value is number[] {
  return Array.isArray(value) && value.length >= STOPS_MIN && value.length <= STOPS_MAX
    && value.every((stop, index) => inRange(stop, 1, limit) && (index === 0 || stop > (value[index - 1] as number)));
}

/** The floor is one of the stops, never the first, so at least one stop always falls short of it. */
export const isFloor = (floor: unknown, stops: readonly number[]): floor is number => whole(floor) && floor >= FLOOR_MIN && stops.indexOf(floor) > 0;

/** Why the run of a chance piece cannot be set, or null: the stops, the floor, the tolerance, the band and the 5 sigma solvability at the last stop. */
export function runProblem(chance: { num: number; den: number }, runs: unknown, minimum: unknown, tolerances: unknown, limit: number): { path: string; message: string } | null {
  if (!isStops(runs, limit)) return { path: 'stops', message: 'The stops are 3 to 8 rising counts within the limit' };
  if (!isFloor(minimum, runs)) return { path: 'floor', message: 'The floor is one of the stops, at least 20 and never the first' };
  if (!isTolerance(tolerances)) return { path: 'tolerance', message: 'The tolerance is 1 to 25 percentage points' };
  if (!chanceInBand(chance)) return { path: 'chance', message: 'The chance is between 5% and 95%' };
  if (!solvableAt(chance, runs[runs.length - 1] as number, tolerances)) return { path: 'tolerance', message: 'The tolerance is too tight for the last stop: a full run would miss it by luck' };
  return null;
}

export type Machine = { kind: ChanceKind; weights: number[] };

export function facesOf(kind: ChanceKind, weights: readonly number[]): number {
  return kind === 'coin' ? 2 : kind === 'die' ? 6 : weights.length;
}

export function isMachine(value: unknown): value is Machine {
  if (!hasOnly(value, ['kind', 'weights'])) return false;
  const { kind, weights } = value;
  if (!CHANCE_KINDS.includes(kind as ChanceKind) || !Array.isArray(weights) || !weights.every((weight) => inRange(weight, 1, WEIGHT_MAX))) return false;
  return kind === 'coin' ? weights.length === 2 : kind === 'die' ? weights.length === 6 : weights.length >= SPINNER_MIN && weights.length <= SPINNER_MAX;
}

/** A non-empty, proper set of faces in rising order. */
export function isEvent(value: unknown, faces: number): value is number[] {
  return Array.isArray(value) && value.length >= 1 && value.length < faces
    && value.every((face, index) => inRange(face, 0, faces - 1) && (index === 0 || face > (value[index - 1] as number)));
}

export function eventChance(machine: Machine, event: readonly number[]): Fraction {
  const total = machine.weights.reduce((sum, weight) => sum + weight, 0);
  const inside = event.reduce((sum, face) => sum + (machine.weights[face] ?? 0), 0);
  return reduceFraction(BigInt(inside), BigInt(total));
}

/** The face of every trial, in order: one draw below the weight total per trial. A shorter run is a prefix of a longer one. */
export function chanceFaces(seed: string, weights: readonly number[], trials: number): number[] {
  const prng = createPrng(seed);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const faces = new Array<number>(trials);
  for (let trial = 0; trial < trials; trial += 1) {
    let left = prng.below(total);
    let face = 0;
    while (left >= (weights[face] as number)) { left -= weights[face] as number; face += 1; }
    faces[trial] = face;
  }
  return faces;
}

/** hits[t] is how many of the first t + 1 trials landed in the event. */
export function chanceTrace(seed: string, machine: Machine, event: readonly number[], trials: number): number[] {
  const inside = new Set(event);
  const trace = new Array<number>(trials);
  let hits = 0;
  chanceFaces(seed, machine.weights, trials).forEach((face, trial) => { if (inside.has(face)) hits += 1; trace[trial] = hits; });
  return trace;
}

export function chanceHits(seed: string, machine: Machine, event: readonly number[], trials: number): number {
  return trials === 0 ? 0 : (chanceTrace(seed, machine, event, trials)[trials - 1] as number);
}

export type Galton = { view: GaltonView; rows: number; rightPct: number; bin: number };

/** The chance that a ball ends in `bin`: C(rows, bin) * (pct/100)^bin * (1 - pct/100)^(rows - bin), exactly. */
export function binChance(rows: number, rightPct: number, bin: number): Fraction {
  let choose = 1n;
  for (let step = 1; step <= bin; step += 1) choose = (choose * BigInt(rows - bin + step)) / BigInt(step);
  const right = BigInt(rightPct / 10);
  const left = BigInt(10 - rightPct / 10);
  return reduceFraction(choose * right ** BigInt(bin) * left ** BigInt(rows - bin), 10n ** BigInt(rows));
}

export const isRightPct = (value: unknown): value is number => inRange(value, GALTON_PCT_MIN, GALTON_PCT_MAX) && (value as number) % 10 === 0;

export function isGalton(value: unknown): value is Galton {
  if (!hasOnly(value, ['view', 'rows', 'rightPct', 'bin'])) return false;
  const { view, rows, rightPct, bin } = value;
  return GALTON_VIEWS.includes(view as GaltonView) && inRange(rows, GALTON_ROWS_MIN, GALTON_ROWS_MAX) && isRightPct(rightPct) && inRange(bin, 0, rows as number);
}

/** Every peg of every ball, in order (1 is a step to the right): one draw below 100 per peg. A shorter run is a prefix of a longer one. */
export function galtonSteps(seed: string, rows: number, rightPct: number, balls: number): Uint8Array {
  const prng = createPrng(seed);
  const steps = new Uint8Array(rows * balls);
  for (let index = 0; index < steps.length; index += 1) steps[index] = prng.below(100) < rightPct ? 1 : 0;
  return steps;
}

/** The bin of each ball: how many of its pegs sent it right. */
export function galtonBallBins(steps: Uint8Array, rows: number): number[] {
  const balls = steps.length / rows;
  const bins = new Array<number>(balls);
  for (let ball = 0; ball < balls; ball += 1) {
    let right = 0;
    for (let peg = 0; peg < rows; peg += 1) right += steps[ball * rows + peg] as number;
    bins[ball] = right;
  }
  return bins;
}

export function galtonHits(seed: string, galton: Galton, balls: number): number {
  if (balls === 0) return 0;
  return galtonBallBins(galtonSteps(seed, galton.rows, galton.rightPct, balls), galton.rows).filter((bin) => bin === galton.bin).length;
}

/** The count of balls in each bin 0..rows among the first `balls`. */
export function binCounts(ballBins: readonly number[], rows: number, balls: number): number[] {
  const counts = new Array<number>(rows + 1).fill(0);
  for (let ball = 0; ball < balls; ball += 1) counts[ballBins[ball] as number] = (counts[ballBins[ball] as number] as number) + 1;
  return counts;
}

/** The run lengths a trace is read at: the stops, with 0 for a run not started. */
export const isRunLength = (value: unknown, stops: readonly number[]): value is number => value === 0 || (whole(value) && stops.includes(value));
