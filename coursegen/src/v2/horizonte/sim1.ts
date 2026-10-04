import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const SIM1_CAPABILITIES = {
  'math.chance-sim.v2': ['visual.chance-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'math.galton-sim.v2': ['visual.galton-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.coverage-sim.v2': ['visual.coverage-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.bootstrap-sim.v2': ['visual.bootstrap-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
} as const;

const CHANCE = 'math.chance-sim.v2';
const GALTON = 'math.galton-sim.v2';
const COVERAGE = 'stats.coverage-sim.v2';
const BOOTSTRAP = 'stats.bootstrap-sim.v2';

const SIM1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: CHANCE,
    lines: [
      `${CHANCE}: ages 10-14 only, never the adult pathway. A coin (2 weights), a die (6) or a spinner (3 to 8), each weight a whole number from 1 to 12, and an event that is a proper, non-empty set of faces in rising order.`,
      `${CHANCE}: the chance of the event is 5% to 95% and the payload never carries it; the key is that chance as a reduced fraction. The learner runs 3 to 8 rising stops up to 5000, and the run is graded by replaying the server seed.`,
      `${CHANCE}: the prompt writes the tolerance in digits ("within 4 points of its chance") and the floor of the run ("at least 1000 times"). The floor is one of the stops, at least 20 and never the first, and the tolerance must be reachable at the last stop (5 standard deviations), or the run can miss by luck.`,
    ],
  },
  {
    type: GALTON,
    lines: [
      `${GALTON}: ages 14-17 and the adult pathway only. A Galton board or a random walk of 3 to 10 rows, the chance of going right a multiple of 10 from 10 to 90, and the bin whose share is read (0 to rows).`,
      `${GALTON}: the key is the exact chance of that bin as a reduced fraction, between 5% and 95%; the payload never carries it. Stops, floor and tolerance follow the same rules as the chance piece, with balls up to 3000.`,
      `${GALTON}: the prompt writes the tolerance in digits and names the bin or the number of steps to the right in digits.`,
    ],
  },
  {
    type: COVERAGE,
    lines: [
      `${COVERAGE}: ages 16-17 and the adult pathway only. The true share is a fraction from 1/5 to 4/5 with a denominator up to 20; levels are 2 to 5 rising picks from 50, 80, 90, 95 and 99, and sizes 2 to 5 rising counts from 10 to 400.`,
      `${COVERAGE}: the start is one of the choices, and the goal is how many of 100 intervals must cover the truth (50 to 99), written in digits in the prompt. The key is the lowest level that reaches the goal reliably at some size; it must sit above the start level.`,
      `${COVERAGE}: pick a goal that the key level reaches and a lower level misses on most seeds (a lucky run at a lower level is still met). The payload never carries the key, and the prompt never names the level.`,
    ],
  },
  {
    type: BOOTSTRAP,
    lines: [
      `${BOOTSTRAP}: ages 16-17 and the adult pathway only. Four to ten whole values on an axis 4 to 20 steps wide, at least 3 of them different, and a level of 80, 90 or 95.`,
      `${BOOTSTRAP}: the key is the exact low and high total the percentile bootstrap tends to; the payload never carries it. Stops are 3 to 8 rising counts up to 3000, the floor is a stop of at least 50 and never the first, and the tolerance (1 to 40 sum steps) must be reachable at the last stop.`,
      `${BOOTSTRAP}: the prompt writes the floor of the run and the level in digits ("at least 500 resamples", "the middle 90%").`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export type Fraction = { num: number; den: number };

const gcd = (a: bigint, b: bigint): bigint => { let x = a; let y = b; while (y > 0n) { [x, y] = [y, x % y]; } return x; };
export function reduceFraction(num: bigint, den: bigint): Fraction {
  const divisor = gcd(num, den) || 1n;
  return { num: Number(num / divisor), den: Number(den / divisor) };
}

/* Chance and Galton: mirrored from backend/src/services/horizonte/sim1/model.ts. */
export const STOPS_MIN = 3;
export const STOPS_MAX = 8;
export const CHANCE_TRIALS_LIMIT = 5000;
export const GALTON_BALLS_LIMIT = 3000;
export const FLOOR_MIN = 20;
const SOLVE_SIGMAS = 5;
const WEIGHT_MAX = 12;
const SPINNER_MIN = 3;
const SPINNER_MAX = 8;

export function isStops(value: unknown, limit: number): value is number[] {
  return Array.isArray(value) && value.length >= STOPS_MIN && value.length <= STOPS_MAX
    && value.every((stop, index) => inRange(stop, 1, limit) && (index === 0 || stop > (value[index - 1] as number)));
}

export const isFloor = (floor: unknown, stops: readonly number[]): floor is number => whole(floor) && floor >= FLOOR_MIN && stops.indexOf(floor) > 0;

export function chanceInBand(chance: Fraction): boolean {
  const num = BigInt(chance.num);
  const den = BigInt(chance.den);
  return num * 20n >= den && num * 20n <= den * 19n;
}

export function solvableAt(chance: Fraction, trials: number, tolerance: number): boolean {
  const num = BigInt(chance.num);
  const den = BigInt(chance.den);
  return BigInt(SOLVE_SIGMAS * SOLVE_SIGMAS) * 10000n * num * (den - num) <= BigInt(tolerance * tolerance) * BigInt(trials) * den * den;
}

function runProblem(chance: Fraction, runs: unknown, minimum: unknown, tolerance: unknown, limit: number, noun: string): string | null {
  if (!isStops(runs, limit)) return `The ${noun} stops are 3 to 8 rising counts up to ${limit}`;
  if (!isFloor(minimum, runs)) return `The ${noun} floor must be one of the stops, at least ${FLOOR_MIN} and never the first`;
  if (!inRange(tolerance, 1, 25)) return `The ${noun} tolerance is 1 to 25 percentage points`;
  if (!chanceInBand(chance)) return `The chance of the ${noun} event must be between 5% and 95%`;
  if (!solvableAt(chance, runs[runs.length - 1] as number, tolerance)) return `The ${noun} tolerance is too tight for the last stop: a full run would miss it by luck`;
  return null;
}

export function machineOf(value: unknown): { kind: string; weights: number[] } | null {
  if (!hasOnly(value, ['kind', 'weights'])) return null;
  const { kind, weights } = value;
  if (!Array.isArray(weights) || !weights.every((weight) => inRange(weight, 1, WEIGHT_MAX))) return null;
  const sized = kind === 'coin' ? weights.length === 2 : kind === 'die' ? weights.length === 6 : kind === 'spinner' && weights.length >= SPINNER_MIN && weights.length <= SPINNER_MAX;
  return sized ? { kind: kind as string, weights: weights as number[] } : null;
}

export function eventOf(value: unknown, faces: number): number[] | null {
  return Array.isArray(value) && value.length >= 1 && value.length < faces
    && value.every((face, index) => inRange(face, 0, faces - 1) && (index === 0 || face > (value[index - 1] as number))) ? (value as number[]) : null;
}

export function binChance(rows: number, rightPct: number, bin: number): Fraction {
  let choose = 1n;
  for (let step = 1; step <= bin; step += 1) choose = (choose * BigInt(rows - bin + step)) / BigInt(step);
  return reduceFraction(choose * BigInt(rightPct / 10) ** BigInt(bin) * BigInt(10 - rightPct / 10) ** BigInt(rows - bin), 10n ** BigInt(rows));
}

/* Coverage and bootstrap: mirrored from backend/src/services/horizonte/sim1/interval.ts. */
export const LEVELS = [50, 80, 90, 95, 99];
const Z_THOUSANDTHS: Record<number, number> = { 50: 674, 80: 1282, 90: 1645, 95: 1960, 99: 2576 };
export const SAMPLES = 100;
export const SOLVE_TAIL = 1e-5;
export const BOOTSTRAP_LEVELS = [80, 90, 95];

function covers(hits: number, size: number, truth: Fraction, level: number): boolean {
  const z = BigInt(Z_THOUSANDTHS[level] ?? 0);
  if (hits <= 0 || hits >= size) return false;
  const gap = BigInt(hits) * BigInt(truth.den) - BigInt(truth.num) * BigInt(size);
  return gap * gap * BigInt(size) * 1_000_000n <= z * z * BigInt(hits) * BigInt(size - hits) * BigInt(truth.den) * BigInt(truth.den);
}

export function binomialPmf(trials: number, p: number): number[] {
  const logFactorial = new Array<number>(trials + 1).fill(0);
  for (let index = 1; index <= trials; index += 1) logFactorial[index] = (logFactorial[index - 1] as number) + Math.log(index);
  const logP = Math.log(p);
  const logQ = Math.log(1 - p);
  return Array.from({ length: trials + 1 }, (_, hits) =>
    Math.exp((logFactorial[trials] as number) - (logFactorial[hits] as number) - (logFactorial[trials - hits] as number) + hits * logP + (trials - hits) * logQ));
}

export function binomialAtLeast(trials: number, p: number, k: number): number {
  if (k <= 0) return 1;
  if (k > trials || p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.min(1, binomialPmf(trials, p).reduce((total, mass, hits) => (hits >= k ? total + mass : total), 0));
}

export function coverageChance(truth: Fraction, level: number, size: number): number {
  const pmf = binomialPmf(size, truth.num / truth.den);
  return Math.min(1, pmf.reduce((total, mass, hits) => (covers(hits, size, truth, level) ? total + mass : total), 0));
}

export function solveCoverage(truth: Fraction, levels: readonly number[], sizes: readonly number[], covered: number): number | null {
  for (const level of levels) {
    if (sizes.some((size) => binomialAtLeast(SAMPLES, coverageChance(truth, level, size), covered) >= 1 - SOLVE_TAIL)) return level;
  }
  return null;
}

export const isLevels = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= 2 && value.length <= 5 && value.every((level, index) => LEVELS.includes(level as number) && (index === 0 || level > (value[index - 1] as number)));

export const isSizes = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= 2 && value.length <= 5 && value.every((size, index) => inRange(size, 10, 400) && (index === 0 || size > (value[index - 1] as number)));

export function truthOf(value: unknown): Fraction | null {
  if (!hasOnly(value, ['num', 'den']) || !inRange(value.den, 2, 20) || !inRange(value.num, 1, value.den - 1)) return null;
  return 5 * value.num >= value.den && 5 * value.num <= 4 * value.den ? { num: value.num, den: value.den } : null;
}

function exactSumCounts(data: readonly number[]): bigint[] {
  const top = data.length * Math.max(...data) + 1;
  let counts: bigint[] = new Array<bigint>(top).fill(0n);
  counts[0] = 1n;
  for (let pick = 0; pick < data.length; pick += 1) {
    const next: bigint[] = new Array<bigint>(top).fill(0n);
    for (let sum = 0; sum < top; sum += 1) {
      const count = counts[sum] as bigint;
      if (count === 0n) continue;
      for (const value of data) if (sum + value < top) next[sum + value] = (next[sum + value] as bigint) + count;
    }
    counts = next;
  }
  return counts;
}

export function exactEdges(data: readonly number[], level: number): { low: number; high: number } {
  const counts = exactSumCounts(data);
  const total = BigInt(data.length) ** BigInt(data.length);
  const tail = BigInt(100 - level);
  let running = 0n;
  let low = -1;
  let high = -1;
  for (let sum = 0; sum < counts.length; sum += 1) {
    running += counts[sum] as bigint;
    if (low < 0 && running * 200n >= tail * total) low = sum;
    if (high < 0 && running * 200n >= (200n - tail) * total) high = sum;
  }
  return { low, high };
}

function cumulativeShare(counts: readonly bigint[], total: bigint, sum: number): number {
  if (sum < 0) return 0;
  let running = 0n;
  for (let index = 0; index <= Math.min(sum, counts.length - 1); index += 1) running += counts[index] as bigint;
  return Number((running * 1_000_000_000_000n) / total) / 1e12;
}

function edgeReach(counts: readonly bigint[], total: bigint, resamples: number, rank: number, exact: number, tolerance: number): number {
  const upper = binomialAtLeast(resamples, cumulativeShare(counts, total, exact + tolerance), rank);
  const lower = binomialAtLeast(resamples, cumulativeShare(counts, total, exact - tolerance - 1), rank);
  return Math.max(0, upper - lower);
}

export function bootstrapSolvable(data: readonly number[], level: number, resamples: number, tolerance: number): boolean {
  const counts = exactSumCounts(data);
  const total = BigInt(data.length) ** BigInt(data.length);
  const exact = exactEdges(data, level);
  const rank = Math.trunc((resamples * (100 - level)) / 200);
  const low = edgeReach(counts, total, resamples, rank + 1, exact.low, tolerance);
  const high = edgeReach(counts, total, resamples, resamples - rank, exact.high, tolerance);
  return Math.max(0, 1 - (1 - low) - (1 - high)) >= 1 - SOLVE_TAIL;
}

const namesNumber = (prompt: unknown, value: unknown): boolean =>
  typeof prompt === 'string' && whole(value) && new RegExp(`(?<![\\d.,])${value}(?!\\d|[.,]\\d)`).test(prompt);

type Report = (message: string) => void;
type Check = (segment: Record<string, unknown>, payload: Record<string, unknown>, key: { target?: unknown } | null | undefined, report: Report) => void;

function visit(document: { segments?: unknown }, answerKeys: Record<string, unknown> | undefined, type: string, visual: string, check: Check): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    if (segment.type !== type) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const report: Report = (message) => problems.push({ gate: 4, segmentId, message });
    if ((segment.visual as { type?: unknown } | undefined)?.type !== visual) report(`The ${type} visual must be ${visual}`);
    const payload = segment.payload;
    if (!record(payload)) { report('The payload is missing'); continue; }
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? (answerKeys[segmentId] as { target?: unknown } | null) : undefined;
    check(segment, payload, key, report);
  }
  return problems;
}

/** The key must be the chance of the event as the exact reduced fraction the payload implies. */
function fractionKey(key: { target?: unknown } | null | undefined, chance: Fraction, noun: string, report: Report): void {
  if (key === undefined) return;
  const target = key?.target;
  if (!hasOnly(target, ['num', 'den']) || target.num !== chance.num || target.den !== chance.den) report(`The ${noun} target must be ${chance.num}/${chance.den}, the exact reduced chance`);
}

const chanceGate: Check = (segment, payload, key, report) => {
  const machine = machineOf(payload.machine);
  if (!machine) return report('A coin has 2 weights, a die 6 and a spinner 3 to 8, each from 1 to 12');
  const faces = machine.kind === 'coin' ? 2 : machine.kind === 'die' ? 6 : machine.weights.length;
  const event = eventOf(payload.event, faces);
  if (!event) return report('The event is a non-empty, proper set of faces in rising order');
  const total = machine.weights.reduce((sum, weight) => sum + weight, 0);
  const chance = reduceFraction(BigInt(event.reduce((sum, face) => sum + (machine.weights[face] ?? 0), 0)), BigInt(total));
  const problem = runProblem(chance, payload.stops, payload.minTrials, payload.tolerance, CHANCE_TRIALS_LIMIT, 'chance');
  if (problem) return report(problem);
  if (!namesNumber(segment.prompt, payload.tolerance)) report('The chance prompt must write the tolerance in digits');
  fractionKey(key, chance, 'chance', report);
};

const galtonGate: Check = (segment, payload, key, report) => {
  const { view, rows, rightPct, bin } = payload;
  if ((view !== 'board' && view !== 'walk') || !inRange(rows, 3, 10) || !inRange(rightPct, 10, 90) || rightPct % 10 !== 0 || !inRange(bin, 0, rows)) {
    return report('The Galton board has 3 to 10 rows, a chance of going right that is a multiple of 10 from 10 to 90, and a bin from 0 to the rows');
  }
  const chance = binChance(rows, rightPct, bin);
  const problem = runProblem(chance, payload.stops, payload.minBalls, payload.tolerance, GALTON_BALLS_LIMIT, 'Galton');
  if (problem) return report(problem);
  if (!namesNumber(segment.prompt, payload.tolerance)) report('The Galton prompt must write the tolerance in digits');
  if (!namesNumber(segment.prompt, bin)) report('The Galton prompt must write the bin in digits');
  fractionKey(key, chance, 'Galton', report);
};

const coverageGate: Check = (segment, payload, key, report) => {
  const truth = truthOf(payload.truth);
  if (!truth) return report('The truth is a share between 1/5 and 4/5 with a denominator up to 20');
  const { levels, sizes, start, goal } = payload;
  if (!isLevels(levels)) return report('The levels are 2 to 5 rising picks from 50, 80, 90, 95 and 99');
  if (!isSizes(sizes)) return report('The sizes are 2 to 5 rising counts from 10 to 400');
  if (!hasOnly(start, ['level', 'size']) || !levels.includes(start.level as number) || !sizes.includes(start.size as number)) return report('The start level and size are among the choices');
  if (!hasOnly(goal, ['covered']) || !inRange(goal.covered, 50, 99)) return report('The goal is 50 to 99 intervals out of 100');
  const answer = solveCoverage(truth, levels, sizes, goal.covered);
  if (answer === null) return report(`No level and size reach ${goal.covered} covering intervals out of 100 reliably`);
  if (answer <= (start.level as number)) return report('The goal is already reached at the start level; the answer must be a level above it');
  if (!namesNumber(segment.prompt, goal.covered)) report('The coverage prompt must write the goal number of intervals in digits');
  if (key === undefined) return;
  const target = key?.target;
  if (!hasOnly(target, ['level']) || target.level !== answer) report(`The coverage target must be level ${answer}, the lowest that reaches the goal`);
};

const bootstrapGate: Check = (segment, payload, key, report) => {
  const { axis, data, level, stops, tolerance, minResamples } = payload;
  if (!hasOnly(axis, ['min', 'max']) || !inRange(axis.min, 0, 100) || !inRange(axis.max, 0, 100) || axis.max - axis.min < 4 || axis.max - axis.min > 20) return report('The axis runs from 0 to 100 and is 4 to 20 steps wide');
  if (!Array.isArray(data) || data.length < 4 || data.length > 10 || !data.every((value) => inRange(value, axis.min as number, axis.max as number)) || new Set(data).size < 3) {
    return report('The data are 4 to 10 whole values on the axis with at least 3 different');
  }
  if (!BOOTSTRAP_LEVELS.includes(level as number)) return report('The level is 80, 90 or 95');
  if (!isStops(stops, 3000)) return report('The stops are 3 to 8 rising counts up to 3000');
  if (!whole(minResamples) || minResamples < 50 || stops.indexOf(minResamples) <= 0) return report('The floor is one of the stops, at least 50 and never the first');
  if (!inRange(tolerance, 1, 40)) return report('The tolerance is 1 to 40 sum steps');
  const values = data as number[];
  if (!bootstrapSolvable(values, level as number, stops[stops.length - 1] as number, tolerance)) return report('The tolerance is too tight for the last stop: a full run would miss it by luck');
  if (!namesNumber(segment.prompt, minResamples)) report('The bootstrap prompt must write the floor of resamples in digits');
  if (!namesNumber(segment.prompt, level)) report('The bootstrap prompt must write the level in digits');
  if (key === undefined) return;
  const exact = exactEdges(values, level as number);
  const target = key?.target;
  if (!hasOnly(target, ['low', 'high']) || target.low !== exact.low || target.high !== exact.high) report(`The bootstrap target must be low ${exact.low} and high ${exact.high}, the exact edges of the middle ${level}%`);
};

/** Gate 4 (solvability), hand-mirrored from Core: every key is the one answer the payload allows and the run can reach it with the stops given. */
function sim1Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  return [
    ...visit(document, answerKeys, CHANCE, 'chance-sim', chanceGate),
    ...visit(document, answerKeys, GALTON, 'galton-sim', galtonGate),
    ...visit(document, answerKeys, COVERAGE, 'coverage-sim', coverageGate),
    ...visit(document, answerKeys, BOOTSTRAP, 'bootstrap-sim', bootstrapGate),
  ];
}

export const sim1 = {
  id: 'sim1',
  capabilities: SIM1_CAPABILITIES,
  guidance: SIM1_GUIDANCE,
  gates: sim1Gates,
} as const satisfies ForgeHorizontePack;
