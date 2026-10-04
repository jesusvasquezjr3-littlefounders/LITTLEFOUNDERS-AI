import { createPrng } from '../seed/prng.js';
import { hasOnly, inRange, isStops, whole, type Fraction } from './model.js';

/** F3.2: confidence intervals that cover a known truth, and the percentile bootstrap. Integer arithmetic decides every cover. */
export const SAMPLES = 100;
export const LEVELS = [50, 80, 90, 95, 99] as const;
export type Level = (typeof LEVELS)[number];
/** The two sided z value of each level, in thousandths: a Wald interval is p-hat +/- z * sqrt(p-hat (1 - p-hat) / n). */
const Z_THOUSANDTHS: Readonly<Record<number, number>> = { 50: 674, 80: 1282, 90: 1645, 95: 1960, 99: 2576 };
export const SIZE_MIN = 10;
export const SIZE_MAX = 400;
export const CHOICES_MIN = 2;
export const CHOICES_MAX = 5;
export const TRUTH_DEN_MAX = 20;
export const COVERED_MIN = 50;
export const COVERED_MAX = 99;
/** A key is solvable when the best option reaches the goal with at least this chance. */
export const SOLVE_TAIL = 1e-5;

export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

export const isLevels = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= CHOICES_MIN && value.length <= CHOICES_MAX && value.every((level, index) => isLevel(level) && (index === 0 || level > (value[index - 1] as number)));

export const isSizes = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= CHOICES_MIN && value.length <= CHOICES_MAX && value.every((size, index) => inRange(size, SIZE_MIN, SIZE_MAX) && (index === 0 || size > (value[index - 1] as number)));

/** The true share of the population: a fraction between 1/5 and 4/5 with a denominator up to 20. */
export const isTruth = (value: unknown): value is Fraction =>
  hasOnly(value, ['num', 'den']) && inRange(value.den, 2, TRUTH_DEN_MAX) && inRange(value.num, 1, (value.den as number) - 1)
  && 5 * (value.num as number) >= (value.den as number) && 5 * (value.num as number) <= 4 * (value.den as number);

export type Choice = { level: number; size: number };

export const isChoice = (value: unknown, levels: readonly number[], sizes: readonly number[]): value is Choice =>
  hasOnly(value, ['level', 'size']) && levels.includes(value.level as number) && sizes.includes(value.size as number);

/** Does the Wald interval of k hits in n draws contain the truth num/den? Exact: (kb - an)^2 n 10^6 <= z^2 k (n - k) b^2. */
export function covers(hits: number, size: number, truth: Fraction, level: number): boolean {
  const z = BigInt(Z_THOUSANDTHS[level] ?? 0);
  if (hits <= 0 || hits >= size) return false;
  const gap = BigInt(hits) * BigInt(truth.den) - BigInt(truth.num) * BigInt(size);
  return gap * gap * BigInt(size) * 1_000_000n <= z * z * BigInt(hits) * BigInt(size - hits) * BigInt(truth.den) * BigInt(truth.den);
}

/** The ends of the Wald interval of k hits in n draws as shares from 0 to 1, for drawing it; whether it covers stays with `covers`. */
export function waldInterval(hits: number, size: number, level: number): { low: number; high: number } {
  const share = hits / size;
  const half = ((Z_THOUSANDTHS[level] ?? 0) / 1000) * Math.sqrt((share * (1 - share)) / size);
  return { low: Math.max(0, share - half), high: Math.min(1, share + half) };
}

/** The hits of each of the 100 samples, in order: size draws below the denominator per sample, a draw below the numerator is a hit. */
export function sampleHits(seed: string, truth: Fraction, size: number): number[] {
  const prng = createPrng(seed);
  const hits = new Array<number>(SAMPLES);
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    let count = 0;
    for (let draw = 0; draw < size; draw += 1) if (prng.below(truth.den) < truth.num) count += 1;
    hits[sample] = count;
  }
  return hits;
}

export function coveredCount(seed: string, truth: Fraction, choice: Choice): number {
  return sampleHits(seed, truth, choice.size).filter((hits) => covers(hits, choice.size, truth, choice.level)).length;
}

/** The pmf of Binomial(trials, p) for 0 < p < 1, from log factorials so a long run never underflows. */
function binomialPmf(trials: number, p: number): number[] {
  const logFactorial = new Array<number>(trials + 1).fill(0);
  for (let index = 1; index <= trials; index += 1) logFactorial[index] = (logFactorial[index - 1] as number) + Math.log(index);
  const logP = Math.log(p);
  const logQ = Math.log(1 - p);
  return Array.from({ length: trials + 1 }, (_, hits) =>
    Math.exp((logFactorial[trials] as number) - (logFactorial[hits] as number) - (logFactorial[trials - hits] as number) + hits * logP + (trials - hits) * logQ));
}

/** P(X >= k) for X ~ Binomial(trials, p). */
export function binomialAtLeast(trials: number, p: number, k: number): number {
  if (k <= 0) return 1;
  if (k > trials) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.min(1, binomialPmf(trials, p).reduce((total, mass, hits) => (hits >= k ? total + mass : total), 0));
}

/** The exact chance that one sample's interval covers the truth: the sum over every possible hit count. */
export function coverageChance(truth: Fraction, choice: Choice): number {
  const pmf = binomialPmf(choice.size, truth.num / truth.den);
  return Math.min(1, pmf.reduce((total, mass, hits) => (covers(hits, choice.size, truth, choice.level) ? total + mass : total), 0));
}

/** The chance a run of 100 samples at this choice covers the truth at least `covered` times. */
export const reachChance = (truth: Fraction, choice: Choice, covered: number): number => binomialAtLeast(SAMPLES, coverageChance(truth, choice), covered);

/**
 * The lowest level of `levels` that has a size reaching the goal with chance 1 - SOLVE_TAIL, or null when none does.
 * Grading counts any cell whose seeded 100 intervals reach the goal, so a lower level can still be met on a lucky run; this is only
 * the lowest level that reaches it reliably, and a fixture sets a goal that a lower level misses on most seeds.
 */
export function solveCoverage(truth: Fraction, levels: readonly number[], sizes: readonly number[], covered: number): number | null {
  for (const level of levels) if (sizes.some((size) => reachChance(truth, { level, size }, covered) >= 1 - SOLVE_TAIL)) return level;
  return null;
}

export const isCovered = (value: unknown): value is number => inRange(value, COVERED_MIN, COVERED_MAX);

/* The bootstrap: resample the data with replacement, keep the sum of each resample, read the interval off the sorted sums. */
export const BOOTSTRAP_LEVELS = [80, 90, 95] as const;
export const BOOTSTRAP_RESAMPLES_LIMIT = 3000;
export const DATA_MIN = 4;
export const DATA_MAX = 10;
export const VALUE_MAX = 100;
export const BOOT_AXIS_SPAN_MAX = 20;
export const BOOT_TOLERANCE_MAX = 40;
export const BOOT_FLOOR_MIN = 50;

export type SumEdges = { low: number; high: number };

export const isBootstrapLevel = (value: unknown): value is number => BOOTSTRAP_LEVELS.includes(value as (typeof BOOTSTRAP_LEVELS)[number]);

export function isBootAxis(value: unknown): value is { min: number; max: number } {
  if (!hasOnly(value, ['min', 'max'])) return false;
  return inRange(value.min, 0, VALUE_MAX) && inRange(value.max, 0, VALUE_MAX) && (value.max as number) - (value.min as number) >= 4 && (value.max as number) - (value.min as number) <= BOOT_AXIS_SPAN_MAX;
}

export const isBootData = (value: unknown, axis: { min: number; max: number }): value is number[] =>
  Array.isArray(value) && value.length >= DATA_MIN && value.length <= DATA_MAX && value.every((item) => inRange(item, axis.min, axis.max))
  && new Set(value).size >= 3;

export const isBootTolerance = (value: unknown): value is number => inRange(value, 1, BOOT_TOLERANCE_MAX);
export const isBootEdges = (value: unknown): value is SumEdges => hasOnly(value, ['low', 'high']) && whole(value.low) && whole(value.high) && (value.low as number) < (value.high as number);

/** The sum of each resample, in order: n draws below n per resample. A shorter run is a prefix of a longer one. */
export function resampleSums(seed: string, data: readonly number[], resamples: number): number[] {
  const prng = createPrng(seed);
  const sums = new Array<number>(resamples);
  for (let resample = 0; resample < resamples; resample += 1) {
    let sum = 0;
    for (let draw = 0; draw < data.length; draw += 1) sum += data[prng.below(data.length)] as number;
    sums[resample] = sum;
  }
  return sums;
}

/** How many sorted sums sit below the interval at each end: floor(resamples * (100 - level) / 200). */
export const edgeRank = (resamples: number, level: number): number => Math.trunc((resamples * (100 - level)) / 200);

/** The interval of the middle `level` percent of the resampled sums, as the sums at the two edges. */
export function bootstrapEdges(sums: readonly number[], level: number): SumEdges {
  const sorted = [...sums].sort((a, b) => a - b);
  const rank = edgeRank(sorted.length, level);
  return { low: sorted[rank] as number, high: sorted[sorted.length - 1 - rank] as number };
}

/** The exact distribution of one resample's sum: counts[s] sequences of n picks add to s, out of n^n. */
export function exactSumCounts(data: readonly number[]): bigint[] {
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

/** The edges the bootstrap tends to as resamples grow: the smallest sums whose cumulative share reaches each end of the middle `level` percent. */
export function exactEdges(data: readonly number[], level: number): SumEdges {
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

/** F(s) = P(sum <= s) as a double, from the exact counts. */
function cumulativeShare(counts: readonly bigint[], total: bigint, sum: number): number {
  if (sum < 0) return 0;
  let running = 0n;
  for (let index = 0; index <= Math.min(sum, counts.length - 1); index += 1) running += counts[index] as bigint;
  return Number((running * 1_000_000_000_000n) / total) / 1e12;
}

/** The chance that the order statistic of rank `rank` out of `resamples` draws falls within `tolerance` of the exact edge. */
function edgeReach(counts: readonly bigint[], total: bigint, resamples: number, rank: number, exact: number, tolerance: number): number {
  const upper = binomialAtLeast(resamples, cumulativeShare(counts, total, exact + tolerance), rank);
  const lower = binomialAtLeast(resamples, cumulativeShare(counts, total, exact - tolerance - 1), rank);
  return Math.max(0, upper - lower);
}

/** The chance the run at `resamples` lands both edges inside the tolerance of the exact ones (a union bound over the two edges). */
export function bootstrapReach(data: readonly number[], level: number, resamples: number, tolerance: number): number {
  const counts = exactSumCounts(data);
  const total = BigInt(data.length) ** BigInt(data.length);
  const exact = exactEdges(data, level);
  const rank = edgeRank(resamples, level);
  const low = edgeReach(counts, total, resamples, rank + 1, exact.low, tolerance);
  const high = edgeReach(counts, total, resamples, resamples - rank, exact.high, tolerance);
  return Math.max(0, 1 - (1 - low) - (1 - high));
}

export const isBootStops = (value: unknown): value is number[] => isStops(value, BOOTSTRAP_RESAMPLES_LIMIT);
export const isBootFloor = (floor: unknown, stops: readonly number[]): floor is number => whole(floor) && floor >= BOOT_FLOOR_MIN && stops.indexOf(floor) > 0;

export const bootstrapSolvable = (data: readonly number[], level: number, stops: readonly number[], tolerance: number): boolean =>
  bootstrapReach(data, level, stops[stops.length - 1] as number, tolerance) >= 1 - SOLVE_TAIL;
