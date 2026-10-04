import type { V2Grade } from '../../v2VisualScorer.js';
import { SAMPLE_ATTEMPT, isAttemptSeed, seedsEqual, type HorizonteAttempt } from '../seed/protocol.js';
import type { HorizonteScorer } from '../types.js';
import {
  bootstrapEdges, bootstrapSolvable, coveredCount, exactEdges, isBootAxis, isBootData, isBootFloor, isBootStops, isBootTolerance, isBootstrapLevel,
  isChoice, isCovered, isLevels, isSizes, isTruth, resampleSums, solveCoverage, type Choice,
} from './interval.js';
import {
  CHANCE_TRIALS_LIMIT, GALTON_BALLS_LIMIT, binChance, chanceHits, eventChance, facesOf, galtonHits, hasOnly, isEvent, isFraction, isGalton, isMachine, isRunLength,
  runProblem, sameFraction, withinTolerance, type Fraction, type Galton, type Machine,
} from './model.js';

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const REVIEW: V2Grade = { verdict: 'review', diagnostic: 'value' };

/** The run has started: the key is met, anything else well-formed is review. */
const started = (met: boolean): V2Grade => (met ? MET : REVIEW);

const rubricTarget = (rubric: unknown): unknown => (hasOnly(rubric, ['target']) ? rubric.target : undefined);

/**
 * The seed a response carries must be the one Core derived from the verified token. With a key (Core) a missing attempt fails
 * closed; without one (the browser, advisory) any well-formed seed passes, and a given attempt still has to match.
 */
function seedHeld(seed: unknown, attempt: HorizonteAttempt | undefined, rubric: unknown): boolean {
  if (!isAttemptSeed(seed)) return false;
  if (attempt) return seedsEqual(seed, attempt.seed);
  return rubric === undefined;
}

type ChanceSegment = { payload: { machine: Machine; event: number[]; stops: number[]; tolerance: number; minTrials: number } };

/**
 * invalid: malformed, a seed that is not this attempt's, a run that is not a stop, or a key that is not the chance of the event.
 * valid: the run not started. review: run, but short of the floor or off the chance by more than the tolerance. met: the seeded
 * run at that length has a share within the tolerance of the chance, at or past the floor.
 */
function gradeChance(segment: ChanceSegment, response: unknown, rubric: unknown, attempt?: HorizonteAttempt): V2Grade {
  const payload = segment?.payload;
  if (!payload || !isMachine(payload.machine) || !isEvent(payload.event, facesOf(payload.machine.kind, payload.machine.weights))) return INVALID;
  const chance = eventChance(payload.machine, payload.event);
  if (runProblem(chance, payload.stops, payload.minTrials, payload.tolerance, CHANCE_TRIALS_LIMIT)) return INVALID;
  if (!hasOnly(response, ['seed', 'trials']) || !seedHeld(response.seed, attempt, rubric) || !isRunLength(response.trials, payload.stops)) return INVALID;
  if (rubric === undefined) return VALID;
  const target = rubricTarget(rubric);
  if (!isFraction(target) || !sameFraction(target, chance)) return INVALID;
  const trials = response.trials as number;
  if (trials === 0) return VALID;
  return started(trials >= payload.minTrials && withinTolerance(chanceHits(response.seed as string, payload.machine, payload.event, trials), trials, chance, payload.tolerance));
}

type GaltonSegment = { payload: Galton & { stops: number[]; tolerance: number; minBalls: number } };

/** As the chance piece, over the balls of a Galton board or the walkers of a random walk, and the share that ends in one bin. */
function gradeGalton(segment: GaltonSegment, response: unknown, rubric: unknown, attempt?: HorizonteAttempt): V2Grade {
  const payload = segment?.payload;
  if (!payload || !isGalton({ view: payload.view, rows: payload.rows, rightPct: payload.rightPct, bin: payload.bin })) return INVALID;
  const chance = binChance(payload.rows, payload.rightPct, payload.bin);
  if (runProblem(chance, payload.stops, payload.minBalls, payload.tolerance, GALTON_BALLS_LIMIT)) return INVALID;
  if (!hasOnly(response, ['seed', 'balls']) || !seedHeld(response.seed, attempt, rubric) || !isRunLength(response.balls, payload.stops)) return INVALID;
  if (rubric === undefined) return VALID;
  const target = rubricTarget(rubric);
  if (!isFraction(target) || !sameFraction(target, chance)) return INVALID;
  const balls = response.balls as number;
  if (balls === 0) return VALID;
  const galton: Galton = { view: payload.view, rows: payload.rows, rightPct: payload.rightPct, bin: payload.bin };
  return started(balls >= payload.minBalls && withinTolerance(galtonHits(response.seed as string, galton, balls), balls, chance, payload.tolerance));
}

type CoverageSegment = { payload: { truth: Fraction; levels: number[]; sizes: number[]; start: Choice; goal: { covered: number } } };

/**
 * invalid: malformed, a level or size that is not a choice, a seed that is not this attempt's, or a key that is not the lowest
 * level that reaches the goal reliably (or that is the start). valid: the start untouched. met: the seeded 100 intervals of the
 * chosen level and size cover the truth at least the goal number of times, as the board shows.
 */
function gradeCoverage(segment: CoverageSegment, response: unknown, rubric: unknown, attempt?: HorizonteAttempt): V2Grade {
  const payload = segment?.payload;
  if (!payload || !isTruth(payload.truth) || !isLevels(payload.levels) || !isSizes(payload.sizes) || !isChoice(payload.start, payload.levels, payload.sizes)) return INVALID;
  if (!hasOnly(payload.goal, ['covered']) || !isCovered(payload.goal.covered)) return INVALID;
  if (!hasOnly(response, ['seed', 'level', 'size']) || !seedHeld(response.seed, attempt, rubric)) return INVALID;
  const choice = { level: response.level, size: response.size };
  if (!isChoice(choice, payload.levels, payload.sizes)) return INVALID;
  if (rubric === undefined) return VALID;
  const target = rubricTarget(rubric);
  const answer = solveCoverage(payload.truth, payload.levels, payload.sizes, payload.goal.covered);
  if (answer === null || !hasOnly(target, ['level']) || target.level !== answer || answer <= payload.start.level) return INVALID;
  if (choice.level === payload.start.level && choice.size === payload.start.size) return VALID;
  return started(coveredCount(response.seed as string, payload.truth, choice) >= payload.goal.covered);
}

type BootstrapSegment = {
  payload: { axis: { min: number; max: number }; data: number[]; level: number; stops: number[]; tolerance: number; minResamples: number };
};

/**
 * invalid: malformed, a run that is not a stop, a seed that is not this attempt's, or a key that is not the bootstrap interval the
 * data tend to. valid: no resample drawn. met: at or past the floor, with both edges of the sorted sums within the tolerance of the
 * key; review: drawn, but short of that.
 */
function gradeBootstrap(segment: BootstrapSegment, response: unknown, rubric: unknown, attempt?: HorizonteAttempt): V2Grade {
  const payload = segment?.payload;
  if (!payload || !isBootAxis(payload.axis) || !isBootData(payload.data, payload.axis) || !isBootstrapLevel(payload.level)) return INVALID;
  if (!isBootStops(payload.stops) || !isBootFloor(payload.minResamples, payload.stops) || !isBootTolerance(payload.tolerance)) return INVALID;
  if (!hasOnly(response, ['seed', 'resamples']) || !seedHeld(response.seed, attempt, rubric) || !isRunLength(response.resamples, payload.stops)) return INVALID;
  if (rubric === undefined) return VALID;
  const exact = exactEdges(payload.data, payload.level);
  const target = rubricTarget(rubric);
  if (!hasOnly(target, ['low', 'high']) || target.low !== exact.low || target.high !== exact.high || !bootstrapSolvable(payload.data, payload.level, payload.stops, payload.tolerance)) return INVALID;
  const resamples = response.resamples as number;
  if (resamples === 0) return VALID;
  const edges = bootstrapEdges(resampleSums(response.seed as string, payload.data, resamples), payload.level);
  return started(resamples >= payload.minResamples && Math.abs(edges.low - exact.low) <= payload.tolerance && Math.abs(edges.high - exact.high) <= payload.tolerance);
}

const scorer = <S>(grade: (segment: S, response: unknown, rubric: unknown, attempt?: HorizonteAttempt) => V2Grade, sample: (segment: S) => unknown): HorizonteScorer => ({
  grade: grade as unknown as HorizonteScorer['grade'],
  sample: sample as unknown as HorizonteScorer['sample'],
});

const SAMPLE_SEED = SAMPLE_ATTEMPT.seed;

/** A sample is the run not started, under the fixed sample attempt: it proves the key is the solved one, never that it is met. */
export const SIM1_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.chance-sim.v2': scorer(gradeChance, () => ({ seed: SAMPLE_SEED, trials: 0 })),
  'math.galton-sim.v2': scorer(gradeGalton, () => ({ seed: SAMPLE_SEED, balls: 0 })),
  'stats.coverage-sim.v2': scorer(gradeCoverage, (segment: CoverageSegment) => ({ seed: SAMPLE_SEED, level: segment.payload.start.level, size: segment.payload.start.size })),
  'stats.bootstrap-sim.v2': scorer(gradeBootstrap, () => ({ seed: SAMPLE_SEED, resamples: 0 })),
};
