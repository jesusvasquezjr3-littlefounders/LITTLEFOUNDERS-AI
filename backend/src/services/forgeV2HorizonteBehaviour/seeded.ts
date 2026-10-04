import { SAMPLE_ATTEMPT } from '../horizonte/seed/protocol.js';
import { chanceHits, galtonHits } from '../horizonte/sim1/model.js';
import { coveredCount, resampleSums, solveCoverage } from '../horizonte/sim1/interval.js';
import { analyse, successCount } from '../horizonte/sim2/model.js';
import { isRecord, type HzBuilder, type HzSpace, type Json } from './shared.js';

/*
 * The five seeded simulations (F0.3): a response carries the seed Core issued for the attempt, and Core replays the run
 * from it. The gate has no learner, so forgeV2Behaviour.ts hands each builder its own fixed, synthetic attempt and grades
 * every state under it. A builder returns null without one, so the staff preview and every other caller still fail closed.
 *
 * What is derived here without the scorer's code: the chance of a chance or Galton piece (reduced fractions over the public
 * weights and the binomial), the exact edges of a bootstrap (the sum distribution of one resample), how a run's edges are
 * read off its sorted sums, the floor and the tolerance (integer arithmetic). What is shared with the scorer on purpose: the
 * seeded draws (pinned by the golden vectors of seed.test.ts), the coverage replay and answer, and the life-sim dynamics
 * and exact answer set. Every key is checked against its derived value; a mismatch returns null (fail closed).
 */

const gcd = (a: bigint, b: bigint): bigint => { let x = a; let y = b; while (y > 0n) { [x, y] = [y, x % y]; } return x; };
const reduced = (num: bigint, den: bigint) => { const divisor = gcd(num, den) || 1n; return { num: num / divisor, den: den / divisor }; };

const sameFraction = (key: unknown, chance: { num: bigint; den: bigint }): boolean =>
  isRecord(key) && Object.keys(key).length === 2 && BigInt(key.num) === chance.num && BigInt(key.den) === chance.den;

/** |hits / runs - num / den| <= tolerance / 100, in whole numbers. */
const near = (hits: number, runs: number, chance: { num: bigint; den: bigint }, tolerance: number): boolean => {
  const gap = BigInt(hits) * chance.den - chance.num * BigInt(runs);
  return 100n * (gap < 0n ? -gap : gap) <= BigInt(tolerance) * BigInt(runs) * chance.den;
};

const other = (char: string): string => (char === '0' ? '1' : '0');

/** Seeds that are not the attempt's: refused as a wrong seed. */
const wrongSeeds = (seed: string): string[] => [
  [...seed].reverse().join(''), SAMPLE_ATTEMPT.seed, other(seed[0]!) + seed.slice(1), seed.slice(0, -1) + other(seed.at(-1)!),
];

/** Strings that are not an attempt seed at all: wrong case, length, characters or padding. */
const malformedSeeds = (seed: string): string[] => [
  seed.toUpperCase().replace(/[0-9]/g, 'G'), seed.slice(1), `${seed}0`, '', 'g'.repeat(64), ` ${seed.slice(1)}`, `${seed.slice(0, 63)}g`, `${seed}\n`,
];

/** Everything a hostile client might send in place of a valid response: none may grade met, and none may throw. */
function hostileResponses(base: Json): unknown[] {
  const keys = Object.keys(base);
  const out: unknown[] = [null, undefined, true, 0, 'x', [], [base], Object.create(null), { seed: base.seed }, { ...base, extra: 1 }, { ...base, junk: 'x'.repeat(100_000) },
    { ...base, constructor: { prototype: {} } }, { ...base, seed: 'a'.repeat(100_000) }, { ...base, seed: [base.seed] }, { ...base, seed: { value: base.seed } },
    JSON.parse(`${JSON.stringify(base).slice(0, -1)},"__proto__":{"seed":"x","polluted":true}}`)];
  for (const key of keys) {
    const rest = { ...base };
    delete rest[key];
    out.push(rest,{ ...base, [key]: null }, { ...base, [key]: [base[key]] }, { ...base, [key]: { value: base[key] } }, { ...base, [key]: typeof base[key] === 'string' ? 7 : String(base[key]) });
    if (key !== 'seed') out.push({ ...base, [key]: Number.MAX_VALUE }, { ...base, [key]: Number.POSITIVE_INFINITY }, { ...base, [key]: Number.NaN }, { ...base, [key]: -1 }, { ...base, [key]: 1.5 });
  }
  return out;
}

const refusedWithSeeds = (seed: string, base: Json): Json[] => [
  ...wrongSeeds(seed).map((wrong) => ({ ...base, seed: wrong })), ...malformedSeeds(seed).map((bad) => ({ ...base, seed: bad })),
  { seed }, { ...base, extra: 1 }, {},
];

/** Chance, Galton and bootstrap: one response per stop of the run-length slider; the run's verdict decides met. */
function runSpace(seed: string, key: 'trials' | 'balls' | 'resamples', stops: number[], met: (runs: number) => boolean): HzSpace {
  const last = stops[stops.length - 1]!;
  const at = (runs: unknown): Json => ({ seed, [key]: runs });
  const offGrid = [1, stops[0]! + 1, last + 1, last * 2, -1, 1.5, '1', Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1].filter((value) => !stops.includes(value as number));
  return {
    attempt: { seed },
    inRange: stops.map((runs) => at(runs)),
    invalid: [at(0), ...offGrid.map(at), ...refusedWithSeeds(seed, at(last))],
    hostile: hostileResponses(at(last)),
    initial: at(0),
    expectMet: (response) => met(response[key] as number),
    expectDiagnostic: () => 'value',
  };
}

/** Memoizes a replay by run length: one gate pass asks about each stop more than once. */
const once = <T,>(replay: (runs: number) => T): ((runs: number) => T) => {
  const known = new Map<number, T>();
  return (runs) => { if (!known.has(runs)) known.set(runs, replay(runs)); return known.get(runs)!; };
};

const chanceSim: HzBuilder = (p, r, _segment, attempt) => {
  if (!attempt) return null;
  const weights = p.machine.weights as number[];
  const event = [...new Set(p.event as number[])];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const inside = event.reduce((sum, face) => sum + weights[face]!, 0);
  const chance = reduced(BigInt(inside), BigInt(total));
  if (!sameFraction(r.target, chance)) return null;
  const hits = once((runs: number) => chanceHits(attempt.seed, p.machine, p.event, runs));
  return runSpace(attempt.seed, 'trials', p.stops, (runs) => runs >= p.minTrials && near(hits(runs), runs, chance, p.tolerance));
};

const galtonSim: HzBuilder = (p, r, _segment, attempt) => {
  if (!attempt) return null;
  const choose = (n: number, k: number): bigint => { let out = 1n; for (let step = 1; step <= k; step += 1) out = (out * BigInt(n - k + step)) / BigInt(step); return out; };
  const right = BigInt(p.rightPct / 10);
  const chance = reduced(choose(p.rows, p.bin) * right ** BigInt(p.bin) * (10n - right) ** BigInt(p.rows - p.bin), 10n ** BigInt(p.rows));
  if (!sameFraction(r.target, chance)) return null;
  const hits = once((runs: number) => galtonHits(attempt.seed, { view: p.view, rows: p.rows, rightPct: p.rightPct, bin: p.bin }, runs));
  return runSpace(attempt.seed, 'balls', p.stops, (runs) => runs >= p.minBalls && near(hits(runs), runs, chance, p.tolerance));
};

/** The smallest sums whose cumulative share of the n^n equally likely resamples reaches each end of the middle `level` percent. */
function exactEdges(data: number[], level: number): { low: number; high: number } {
  let counts = new Map<number, bigint>([[0, 1n]]);
  for (let pick = 0; pick < data.length; pick += 1) {
    const next = new Map<number, bigint>();
    for (const [sum, count] of counts) for (const value of data) next.set(sum + value, (next.get(sum + value) ?? 0n) + count);
    counts = next;
  }
  const total = BigInt(data.length) ** BigInt(data.length);
  const tail = BigInt(100 - level);
  let running = 0n; let low = -1; let high = -1;
  for (const sum of [...counts.keys()].sort((a, b) => a - b)) {
    running += counts.get(sum)!;
    if (low < 0 && running * 200n >= tail * total) low = sum;
    if (high < 0 && running * 200n >= (200n - tail) * total) high = sum;
  }
  return { low, high };
}

const bootstrapSim: HzBuilder = (p, r, _segment, attempt) => {
  if (!attempt) return null;
  const exact = exactEdges(p.data, p.level);
  if (!isRecord(r.target) || Object.keys(r.target).length !== 2 || r.target.low !== exact.low || r.target.high !== exact.high) return null;
  const edges = once((runs: number) => {
    const sorted = resampleSums(attempt.seed, p.data, runs).sort((a, b) => a - b);
    const rank = Math.floor(runs * (100 - p.level) / 200);
    return { low: sorted[rank]!, high: sorted[runs - 1 - rank]! };
  });
  return runSpace(attempt.seed, 'resamples', p.stops, (runs) => runs >= p.minResamples
    && Math.abs(edges(runs).low - exact.low) <= p.tolerance && Math.abs(edges(runs).high - exact.high) <= p.tolerance);
};

/** Level and size are two sliders: every pair but the untouched start is a run, and the start is the refused "nothing set" state. */
const coverageSim: HzBuilder = (p, r, _segment, attempt) => {
  if (!attempt) return null;
  const seed = attempt.seed;
  const levels = p.levels as number[]; const sizes = p.sizes as number[];
  const answer = solveCoverage(p.truth, levels, sizes, p.goal.covered);
  if (answer === null || !isRecord(r.target) || Object.keys(r.target).length !== 1 || r.target.level !== answer) return null;
  const at = (level: unknown, size: unknown): Json => ({ seed, level, size });
  const covered = new Map<string, number>();
  const count = (level: number, size: number): number => {
    const id = `${level}/${size}`;
    if (!covered.has(id)) covered.set(id, coveredCount(seed, p.truth, { level, size }));
    return covered.get(id)!;
  };
  const inRange = levels.flatMap((level) => sizes.map((size) => at(level, size))).filter((state) => !(state.level === p.start.level && state.size === p.start.size));
  const grid = at(levels[0], sizes[0]);
  const offLevel = [...new Set([levels[0]! + 1, 97, 100, 0, -1, '90', Number.NaN])].filter((value) => !levels.includes(value as number));
  const offSize = [sizes[0]! + 1, sizes.at(-1)! + 1, 0, -1, 1.5, '20', Number.NaN].filter((value) => !sizes.includes(value as number));
  return {
    attempt,
    inRange,
    invalid: [at(p.start.level, p.start.size), ...offLevel.map((level) => at(level, sizes[0])), ...offSize.map((size) => at(levels[0], size)), ...refusedWithSeeds(seed, grid),
      { seed, level: levels[0] }, { seed, size: sizes[0] }],
    hostile: hostileResponses(at(answer, sizes.at(-1))),
    initial: at(p.start.level, p.start.size),
    expectMet: (response) => count(response.level as number, response.size as number) >= p.goal.covered,
    expectDiagnostic: () => 'value',
  };
};

/** One slider over the choices; the untouched start is the refused "nothing set" state. */
const lifeSim: HzBuilder = (p, r, _segment, attempt) => {
  if (!attempt) return null;
  const seed = attempt.seed;
  const analysis = analyse(p as never);
  const answers = isRecord(r.target) && Object.keys(r.target).length === 1 && Array.isArray(r.target.answers) ? r.target.answers as number[] : null;
  if (analysis.problem !== null || !answers || answers.length !== analysis.answers.length || answers.some((value, index) => value !== analysis.answers[index])) return null;
  const choices = p.choices as number[];
  const at = (choice: unknown): Json => ({ seed, choice });
  const offered = (value: unknown) => choices.includes(value as number);
  const offGrid = [p.start + 1, choices[0]! - 1, choices.at(-1)! + 1, -1, 1.5, '25', Number.NaN, Number.POSITIVE_INFINITY].filter((value) => !offered(value));
  const successes = new Map<number, number>();
  const wins = (choice: number): number => {
    if (!successes.has(choice)) successes.set(choice, successCount(seed, p as never, choice));
    return successes.get(choice)!;
  };
  return {
    attempt,
    inRange: choices.filter((choice) => choice !== p.start).map(at),
    invalid: [at(p.start), ...offGrid.map(at), ...refusedWithSeeds(seed, at(answers[0])), { seed, choice: undefined }],
    hostile: hostileResponses(at(answers[0])),
    initial: at(p.start),
    expectMet: (response) => answers.includes(response.choice as number) && wins(response.choice as number) >= p.goal,
    expectDiagnostic: () => 'value',
  };
};

export const SEEDED_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.chance-sim.v2': chanceSim,
  'math.galton-sim.v2': galtonSim,
  'stats.bootstrap-sim.v2': bootstrapSim,
  'stats.coverage-sim.v2': coverageSim,
  'money.life-sim.v2': lifeSim,
};
