import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { createPrng } from '../../services/horizonte/seed/prng.js';
import { SAMPLE_ATTEMPT } from '../../services/horizonte/seed/protocol.js';
import { sim1 } from '../../services/horizonte/sim1/index.js';
import { SIM1_CAPABILITIES } from '../../services/horizonte/sim1/capabilities.js';
import { SIM1_FIXTURES } from '../../services/horizonte/sim1/fixtures.js';
import {
  binomialAtLeast, bootstrapEdges, bootstrapReach, bootstrapSolvable, coverageChance, coveredCount, covers, edgeRank, exactEdges, exactSumCounts, isBootAxis, isBootFloor, isBootStops,
  isChoice, isTruth, reachChance, resampleSums, sampleHits, solveCoverage, waldInterval,
} from '../../services/horizonte/sim1/interval.js';
import {
  binChance, binCounts, chanceFaces, chanceHits, chanceTrace, eventChance, galtonBallBins, galtonHits, galtonSteps, isEvent, isFloor, isGalton, isMachine, isRunLength, isStops, reduceFraction,
  runProblem, solvableAt, withinTolerance,
} from '../../services/horizonte/sim1/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem, isSeededHorizonteType } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Attempt = { seed: string };
type Grade = (segment: unknown, response: unknown, rubric: unknown, attempt?: Attempt) => { verdict: string; diagnostic: string };
const grade = (type: string) => sim1.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => SIM1_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const verdictOf = (id: string, response: unknown, rubric: unknown = fixture(id).rubric, attempt: Attempt | undefined = { seed: fixture(id).seed as string }) =>
  grade(segmentOf(id).type as string)(segmentOf(id), response, rubric, attempt).verdict;
const seedOf = (id: string) => fixture(id).seed as string;

function lesson(entry = SIM1_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  const type = segment.type as keyof typeof SIM1_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-sim', chapter_id: 'horizonte-sim1', lesson_id: `hz-sim1-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...SIM1_CAPABILITIES[type]], segments: [segment],
  };
}

describe('sim1 pack: F3.1 simulated chance, F3.2 intervals and resampling', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(sim1, SIM1_FIXTURES)).not.toThrow();
  });

  it('declares every segment type with a fixture, a rubric and a seeded run', () => {
    const types = Object.keys(SIM1_CAPABILITIES).sort();
    expect(types).toEqual(['math.chance-sim.v2', 'math.galton-sim.v2', 'stats.bootstrap-sim.v2', 'stats.coverage-sim.v2']);
    for (const type of types) {
      expect(SIM1_FIXTURES.some((entry) => entry.segment('en-US').type === type), type).toBe(true);
      expect(isSeededHorizonteType(type), type).toBe(true);
    }
    expect(SIM1_FIXTURES).toHaveLength(10);
  });

  it('keeps the chance maths exact', () => {
    expect(reduceFraction(6n, 36n)).toEqual({ num: 1, den: 6 });
    expect(eventChance({ kind: 'coin', weights: [1, 1] }, [0])).toEqual({ num: 1, den: 2 });
    expect(eventChance({ kind: 'die', weights: [1, 1, 1, 1, 1, 1] }, [1, 3, 5])).toEqual({ num: 1, den: 2 });
    expect(eventChance({ kind: 'spinner', weights: [2, 1, 1, 2] }, [0, 3])).toEqual({ num: 2, den: 3 });
    expect(binChance(6, 50, 3)).toEqual({ num: 5, den: 16 });
    expect(binChance(8, 50, 4)).toEqual({ num: 35, den: 128 });
    expect(binChance(4, 70, 3)).toEqual({ num: 1029, den: 2500 });
    expect(binChance(3, 50, 0)).toEqual({ num: 1, den: 8 });
    expect(withinTolerance(52, 100, { num: 1, den: 2 }, 2)).toBe(true);
    expect(withinTolerance(53, 100, { num: 1, den: 2 }, 2)).toBe(false);
    expect(withinTolerance(1, 6, { num: 1, den: 6 }, 1)).toBe(true);
    expect(solvableAt({ num: 1, den: 2 }, 5000, 4)).toBe(true);
    expect(solvableAt({ num: 1, den: 2 }, 100, 4)).toBe(false);
    expect(solvableAt({ num: 1, den: 2 }, 5000, 1)).toBe(false);
  });

  it('validates machines, events, galtons and run lengths', () => {
    expect(isMachine({ kind: 'coin', weights: [1, 1] })).toBe(true);
    expect(isMachine({ kind: 'coin', weights: [1, 1, 1] })).toBe(false);
    expect(isMachine({ kind: 'die', weights: [1, 1, 1, 1, 1] })).toBe(false);
    expect(isMachine({ kind: 'spinner', weights: [1, 1] })).toBe(false);
    expect(isMachine({ kind: 'spinner', weights: [1, 13, 1] })).toBe(false);
    expect(isMachine({ kind: 'spinner', weights: [1, 2, 3], extra: 1 })).toBe(false);
    expect(isEvent([0], 2)).toBe(true);
    expect(isEvent([0, 1], 2)).toBe(false);
    expect(isEvent([], 6)).toBe(false);
    expect(isEvent([3, 1], 6)).toBe(false);
    expect(isEvent([6], 6)).toBe(false);
    expect(isGalton({ view: 'board', rows: 6, rightPct: 50, bin: 3 })).toBe(true);
    expect(isGalton({ view: 'board', rows: 6, rightPct: 55, bin: 3 })).toBe(false);
    expect(isGalton({ view: 'board', rows: 6, rightPct: 50, bin: 7 })).toBe(false);
    expect(isGalton({ view: 'tilt', rows: 6, rightPct: 50, bin: 3 })).toBe(false);
    expect(isStops([10, 50, 200], 5000)).toBe(true);
    expect(isStops([10, 50], 5000)).toBe(false);
    expect(isStops([10, 50, 50], 5000)).toBe(false);
    expect(isStops([10, 50, 6000], 5000)).toBe(false);
    expect(isFloor(50, [10, 50, 200])).toBe(true);
    expect(isFloor(10, [10, 50, 200])).toBe(false);
    expect(isFloor(60, [10, 50, 200])).toBe(false);
    expect(isRunLength(0, [10, 50, 200])).toBe(true);
    expect(isRunLength(50, [10, 50, 200])).toBe(true);
    expect(isRunLength(7, [10, 50, 200])).toBe(false);
    expect(isRunLength('50', [10, 50, 200])).toBe(false);
    expect(runProblem({ num: 1, den: 2 }, [10, 50, 200, 1000, 5000], 1000, 4, 5000)).toBeNull();
    expect(runProblem({ num: 1, den: 2 }, [10, 50, 200], 200, 1, 5000)?.path).toBe('tolerance');
    expect(runProblem({ num: 1, den: 100 }, [10, 50, 200, 1000, 5000], 1000, 4, 5000)?.path).toBe('chance');
    expect(runProblem({ num: 1, den: 2 }, [10, 50, 200, 1000, 5000], 10, 4, 5000)?.path).toBe('floor');
  });

  it('replays a shorter run as a prefix of a longer one', () => {
    const seed = seedOf('chance-die-six');
    const machine = { kind: 'die' as const, weights: [1, 1, 1, 1, 1, 1] };
    expect(chanceFaces(seed, machine.weights, 300).slice(0, 40)).toEqual(chanceFaces(seed, machine.weights, 40));
    expect(chanceFaces(seed, machine.weights, 300)).toEqual(chanceFaces(seed, machine.weights, 300));
    expect(chanceFaces('f'.repeat(64), machine.weights, 40)).not.toEqual(chanceFaces(seed, machine.weights, 40));
    const trace = chanceTrace(seed, machine, [5], 300);
    expect(trace).toHaveLength(300);
    expect(trace[299]).toBe(chanceHits(seed, machine, [5], 300));
    expect(trace.every((hits, index) => index === 0 || hits - (trace[index - 1] as number) <= 1)).toBe(true);
    expect(chanceHits(seed, machine, [5], 0)).toBe(0);
    const steps = galtonSteps(seed, 6, 50, 200);
    expect(Array.from(galtonSteps(seed, 6, 50, 20))).toEqual(Array.from(steps.slice(0, 120)));
    const bins = galtonBallBins(steps, 6);
    expect(bins).toHaveLength(200);
    expect(bins.every((bin) => bin >= 0 && bin <= 6)).toBe(true);
    const counts = binCounts(bins, 6, 200);
    expect(counts).toHaveLength(7);
    expect(counts.reduce((total, count) => total + count, 0)).toBe(200);
    expect(counts[3]).toBe(galtonHits(seed, { view: 'board', rows: 6, rightPct: 50, bin: 3 }, 200));
    const data = [2, 3, 3, 5, 6, 8];
    expect(resampleSums(seed, data, 100).slice(0, 30)).toEqual(resampleSums(seed, data, 30));
    const prng = createPrng(seed);
    expect(prng.below(6)).toBeLessThan(6);
  });

  it('draws faces close to their weights over a long run', () => {
    const faces = chanceFaces(seedOf('chance-spinner-event'), [2, 1, 1, 2], 6000);
    const counts = [0, 1, 2, 3].map((face) => faces.filter((entry) => entry === face).length);
    expect(counts[0]! / 6000).toBeGreaterThan(0.29);
    expect(counts[0]! / 6000).toBeLessThan(0.38);
    expect(counts[1]! / 6000).toBeGreaterThan(0.13);
    expect(counts[1]! / 6000).toBeLessThan(0.2);
  });

  it('decides a cover with exact integers', () => {
    const half = { num: 1, den: 2 };
    expect(covers(50, 100, half, 95)).toBe(true);
    expect(covers(60, 100, half, 95)).toBe(false);
    expect(covers(59, 100, half, 95)).toBe(true);
    expect(covers(60, 100, half, 99)).toBe(true);
    expect(covers(0, 100, half, 99)).toBe(false);
    expect(covers(100, 100, half, 99)).toBe(false);
    expect(isTruth({ num: 3, den: 5 })).toBe(true);
    expect(isTruth({ num: 1, den: 10 })).toBe(false);
    expect(isTruth({ num: 5, den: 5 })).toBe(false);
    expect(isChoice({ level: 90, size: 30 }, [90, 95], [30, 100])).toBe(true);
    expect(isChoice({ level: 91, size: 30 }, [90, 95], [30, 100])).toBe(false);
  });

  it('samples 100 intervals and counts the covers', () => {
    const seed = seedOf('coverage-three-fifths');
    const truth = { num: 3, den: 5 };
    const hits = sampleHits(seed, truth, 100);
    expect(hits).toHaveLength(100);
    expect(hits.every((count) => count >= 0 && count <= 100)).toBe(true);
    expect(sampleHits(seed, truth, 100)).toEqual(hits);
    const covered = coveredCount(seed, truth, { level: 99, size: 100 });
    expect(covered).toBe(hits.filter((count) => covers(count, 100, truth, 99)).length);
    expect(covered).toBeGreaterThanOrEqual(92);
  });

  it('draws the Wald interval around the sample share, clamped to 0 and 1', () => {
    const { low, high } = waldInterval(60, 100, 95);
    expect(low).toBeCloseTo(0.6 - 1.96 * Math.sqrt(0.24 / 100), 10);
    expect(high).toBeCloseTo(0.6 + 1.96 * Math.sqrt(0.24 / 100), 10);
    expect(waldInterval(0, 20, 90)).toEqual({ low: 0, high: 0 });
    expect(waldInterval(2, 10, 99).low).toBe(0);
    expect(waldInterval(60, 100, 99).high - waldInterval(60, 100, 99).low).toBeGreaterThan(waldInterval(60, 100, 80).high - waldInterval(60, 100, 80).low);
  });

  it('solves the coverage key and refuses a goal no choice reaches', () => {
    const truth = { num: 3, den: 5 };
    expect(solveCoverage(truth, [80, 90, 95, 99], [20, 50, 100, 200], 75)).toBe(90);
    expect(solveCoverage(truth, [80, 90, 95, 99], [20, 50, 100, 200], 80)).toBe(95);
    expect(solveCoverage(truth, [80, 90, 95, 99], [20, 50, 100, 200], 92)).toBe(99);
    expect(solveCoverage(truth, [80, 90, 95, 99], [20, 50, 100, 200], 94)).toBeNull();
    expect(solveCoverage({ num: 1, den: 2 }, [90, 95, 99], [30, 100, 300], 85)).toBe(95);
    expect(coverageChance(truth, { level: 99, size: 100 })).toBeGreaterThan(0.97);
    expect(coverageChance(truth, { level: 80, size: 50 })).toBeLessThan(0.9);
    expect(reachChance(truth, { level: 99, size: 100 }, 92)).toBeGreaterThan(0.999);
    expect(reachChance(truth, { level: 99, size: 200 }, 92)).toBeGreaterThan(1 - 1e-5);
    expect(reachChance(truth, { level: 80, size: 20 }, 92)).toBeLessThan(0.01);
    expect(binomialAtLeast(100, 0.5, 0)).toBe(1);
    expect(binomialAtLeast(100, 0.5, 101)).toBe(0);
    expect(binomialAtLeast(100, 0.5, 50)).toBeGreaterThan(0.5);
    expect(binomialAtLeast(3000, 0.5, 1)).toBeCloseTo(1, 12);
  });

  it('finds the exact bootstrap edges and the order statistic of a run', () => {
    expect(exactEdges([2, 3, 3, 5, 6, 8], 90)).toEqual({ low: 19, high: 36 });
    expect(exactEdges([12, 15, 15, 18, 22, 25, 25, 28], 80)).toEqual({ low: 140, high: 180 });
    const counts = exactSumCounts([1, 2, 3]);
    expect(counts.reduce((total, count) => total + count, 0n)).toBe(27n);
    expect(counts[6]).toBe(7n);
    expect(edgeRank(1000, 90)).toBe(50);
    expect(edgeRank(500, 95)).toBe(12);
    expect(edgeRank(50, 80)).toBe(5);
    expect(bootstrapEdges([5, 1, 4, 2, 3, 9, 8, 7, 6, 10], 80)).toEqual({ low: 2, high: 9 });
    const sums = resampleSums(seedOf('bootstrap-six-values'), [2, 3, 3, 5, 6, 8], 3000);
    expect(sums).toHaveLength(3000);
    const edges = bootstrapEdges(sums, 90);
    expect(Math.abs(edges.low - 19)).toBeLessThanOrEqual(1);
    expect(Math.abs(edges.high - 36)).toBeLessThanOrEqual(1);
    expect(bootstrapReach([2, 3, 3, 5, 6, 8], 90, 3000, 1)).toBeGreaterThan(1 - 1e-5);
    expect(bootstrapReach([2, 3, 3, 5, 6, 8], 90, 50, 1)).toBeLessThan(0.9);
    expect(bootstrapSolvable([2, 3, 3, 5, 6, 8], 90, [50, 500, 3000], 1)).toBe(true);
    expect(bootstrapSolvable([2, 3, 3, 5, 6, 8], 90, [50, 500, 1000], 1)).toBe(false);
    expect(isBootAxis({ min: 0, max: 10 })).toBe(true);
    expect(isBootAxis({ min: 0, max: 2 })).toBe(false);
    expect(isBootAxis({ min: 0, max: 60 })).toBe(false);
    expect(isBootStops([50, 200, 3000])).toBe(true);
    expect(isBootStops([50, 200, 4000])).toBe(false);
    expect(isBootFloor(200, [50, 200, 3000])).toBe(true);
    expect(isBootFloor(50, [50, 200, 3000])).toBe(false);
  });

  it('grades a coin, a die and a spinner from the seeded replay', () => {
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 5000 })).toBe('met');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 200 })).toBe('review');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 10 })).toBe('review');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 0 })).toBe('valid');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 7 })).toBe('invalid');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 5000, extra: 1 })).toBe('invalid');
    expect(verdictOf('chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 5000 }, { target: { num: 1, den: 3 } })).toBe('invalid');
    expect(verdictOf('chance-die-six', { seed: seedOf('chance-die-six'), trials: 5000 })).toBe('met');
    expect(verdictOf('chance-die-six', { seed: seedOf('chance-die-six'), trials: 500 })).toBe('review');
    expect(verdictOf('chance-spinner-event', { seed: seedOf('chance-spinner-event'), trials: 5000 })).toBe('met');
    expect(verdictOf('chance-spinner-event', { seed: seedOf('chance-spinner-event'), trials: 100 })).toBe('review');
  });

  it('grades a Galton board and a random walk from the seeded replay', () => {
    expect(verdictOf('galton-board', { seed: seedOf('galton-board'), balls: 3000 })).toBe('met');
    expect(verdictOf('galton-board', { seed: seedOf('galton-board'), balls: 100 })).toBe('review');
    expect(verdictOf('galton-board', { seed: seedOf('galton-board'), balls: 0 })).toBe('valid');
    expect(verdictOf('galton-board', { seed: seedOf('galton-board'), balls: 7 })).toBe('invalid');
    expect(verdictOf('galton-walk', { seed: seedOf('galton-walk'), balls: 3000 })).toBe('met');
    expect(verdictOf('galton-biased', { seed: seedOf('galton-biased'), balls: 3000 })).toBe('met');
    expect(verdictOf('galton-board', { seed: seedOf('galton-board'), balls: 3000 }, { target: { num: 1, den: 3 } })).toBe('invalid');
  });

  it('grades coverage by the replay of 100 samples', () => {
    const seed = seedOf('coverage-three-fifths');
    expect(verdictOf('coverage-three-fifths', { seed, level: 99, size: 100 })).toBe('met');
    expect(verdictOf('coverage-three-fifths', { seed, level: 99, size: 200 })).toBe('met');
    expect(verdictOf('coverage-three-fifths', { seed, level: 80, size: 20 })).toBe('valid');
    expect(verdictOf('coverage-three-fifths', { seed, level: 80, size: 50 })).toBe('review');
    expect(verdictOf('coverage-three-fifths', { seed, level: 85, size: 20 })).toBe('invalid');
    expect(verdictOf('coverage-three-fifths', { seed, level: 99, size: 77 })).toBe('invalid');
    expect(verdictOf('coverage-three-fifths', { seed, level: 99, size: 100 }, { target: { level: 95 } })).toBe('invalid');
    expect(verdictOf('coverage-three-fifths', { seed, level: 99, size: 100 }, { target: { level: 80 } })).toBe('invalid');
    expect(verdictOf('coverage-one-half', { seed: seedOf('coverage-one-half'), level: 99, size: 300 })).toBe('met');
    expect(verdictOf('coverage-one-half', { seed: seedOf('coverage-one-half'), level: 90, size: 30 })).toBe('valid');
  });

  it('grades the bootstrap by the replay of the resamples', () => {
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 3000 })).toBe('met');
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 50 })).toBe('review');
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 200 })).toBe('review');
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 0 })).toBe('valid');
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 7 })).toBe('invalid');
    expect(verdictOf('bootstrap-six-values', { seed: seedOf('bootstrap-six-values'), resamples: 3000 }, { target: { low: 19, high: 37 } })).toBe('invalid');
    expect(verdictOf('bootstrap-eight-values', { seed: seedOf('bootstrap-eight-values'), resamples: 3000 })).toBe('met');
  });

  it('binds every run to the seed of the attempt', () => {
    for (const entry of SIM1_FIXTURES) {
      const type = entry.segment('en-US').type as string;
      const seed = entry.seed as string;
      const other = seed.startsWith('0') ? 'f'.repeat(64) : '0'.repeat(64);
      const met = entry.ladder.met as Record<string, unknown>;
      expect(grade(type)(entry.segment('en-US'), met, entry.rubric, { seed }).verdict, entry.id).toBe('met');
      expect(grade(type)(entry.segment('en-US'), met, entry.rubric, { seed: other }).verdict, entry.id).toBe('invalid');
      expect(grade(type)(entry.segment('en-US'), met, entry.rubric).verdict, entry.id).toBe('invalid');
      expect(grade(type)(entry.segment('en-US'), { ...met, seed: other }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
      expect(grade(type)(entry.segment('en-US'), { ...met, seed: seed.toUpperCase() }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
      expect(grade(type)(entry.segment('en-US'), { ...met, seed: 'short' }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
      const { seed: ignored, ...unseeded } = met;
      expect(ignored).toBe(seed);
      expect(grade(type)(entry.segment('en-US'), unseeded, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
    }
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const entry of SIM1_FIXTURES) {
      const type = entry.segment('en-US').type as string;
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined).verdict, entry.id).toBe('valid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.invalid, undefined).verdict, entry.id).toBe('invalid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined, { seed: entry.seed as string }).verdict, entry.id).toBe('valid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined, { seed: SAMPLE_ATTEMPT.seed }).verdict, entry.id).toBe(entry.seed === SAMPLE_ATTEMPT.seed ? 'valid' : 'invalid');
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('math.chance-sim.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('math.chance-sim.v2', '13-17', 13, 14)).toBeNull();
    expect(scope('math.chance-sim.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.chance-sim.v2', '13-17', 13, 17)).not.toBeNull();
    expect(scope('math.chance-sim.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('math.galton-sim.v2', '13-17', 14, 17)).toBeNull();
    expect(scope('math.galton-sim.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('math.galton-sim.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('stats.coverage-sim.v2', '13-17', 16, 17)).toBeNull();
    expect(scope('stats.coverage-sim.v2', '13-17', 14, 17)).not.toBeNull();
    expect(scope('stats.bootstrap-sim.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('stats.bootstrap-sim.v2', '10-12', 10, 12)).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade under the attempt seed', () => {
    for (const entry of SIM1_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of SIM1_FIXTURES) {
      const document = lesson(entry);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const attempt = { seed: entry.seed as string };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met, attempt), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toBeNull();
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met, { seed: attempt.seed.startsWith('0') ? 'f'.repeat(64) : '0'.repeat(64) }), entry.id).toBeNull();
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid, attempt), entry.id).toBeNull();
      expect(horizonteGrade({ type: entry.segment('en-US').type as string }, entry.ladder.met, entry.rubric), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const coin = lesson(fixture('chance-coin-heads'));
    const key = (target: unknown) => ({ 'chance-coin-heads': { target } });
    expect(validateV2LessonForGrading(coin, key({ num: 1, den: 3 }), { lessonId: coin.lesson_id, locale: coin.locale })).toBeNull();
    expect(gradeV2Visual(v2PublicLessonSchema.parse(coin), key({ num: 1, den: 2 }), 'chance-coin-heads', { seed: seedOf('chance-coin-heads'), trials: 200 }, { seed: seedOf('chance-coin-heads') }))
      .toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
  });

  it('refuses a payload that leaks the answer, a wrong visual, a bad setup and an out-of-scope document', () => {
    const base = lesson(fixture('chance-coin-heads'));
    const withPayload = (payload: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload }] });
    const payload = base.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, target: { num: 1, den: 2 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, seed: 'e'.repeat(64) })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, machine: { kind: 'coin', weights: [1, 1, 1] } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, event: [0, 1] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, stops: [10, 50] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, tolerance: 1, stops: [10, 50, 200, 1000, 5000] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, minTrials: 10 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'galton-sim' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 99 } }).success).toBe(false);
    const galton = lesson(fixture('galton-board'));
    const board = galton.segments[0]!.payload as Record<string, unknown>;
    const withGalton = (next: unknown) => ({ ...galton, segments: [{ ...galton.segments[0], payload: next }] });
    expect(v2PublicLessonSchema.safeParse(withGalton({ ...board, rightPct: 55 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withGalton({ ...board, bin: 9 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withGalton({ ...board, bin: 0, rightPct: 90 })).success).toBe(false);
    const coverage = lesson(fixture('coverage-three-fifths'));
    const setup = coverage.segments[0]!.payload as Record<string, unknown>;
    const withCoverage = (next: unknown) => ({ ...coverage, segments: [{ ...coverage.segments[0], payload: next }] });
    expect(v2PublicLessonSchema.safeParse(withCoverage({ ...setup, start: { level: 85, size: 20 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withCoverage({ ...setup, truth: { num: 1, den: 20 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withCoverage({ ...setup, goal: { covered: 100 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withCoverage({ ...setup, levels: [99, 95] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withCoverage({ ...setup, answer: 99 })).success).toBe(false);
    const bootstrap = lesson(fixture('bootstrap-six-values'));
    const sample = bootstrap.segments[0]!.payload as Record<string, unknown>;
    const withBootstrap = (next: unknown) => ({ ...bootstrap, segments: [{ ...bootstrap.segments[0], payload: next }] });
    expect(v2PublicLessonSchema.safeParse(withBootstrap({ ...sample, level: 85 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withBootstrap({ ...sample, data: [2, 2, 2, 2, 2, 2] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withBootstrap({ ...sample, minResamples: 50 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withBootstrap({ ...sample, edges: { low: 19, high: 36 } })).success).toBe(false);
  });
});
