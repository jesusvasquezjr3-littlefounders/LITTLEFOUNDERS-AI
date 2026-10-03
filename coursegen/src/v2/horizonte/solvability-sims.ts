import {
  Budget, asRecord, budgetIssue, checkRubricCoverage, isWhole, issue, registerSolvabilityChecker, result,
  type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import {
  BOOTSTRAP_LEVELS, CHANCE_TRIALS_LIMIT, GALTON_BALLS_LIMIT, SAMPLES, binChance, binomialAtLeast, binomialPmf, bootstrapSolvable, chanceInBand,
  coverageChance, eventOf, exactEdges, hasOnly, inRange, isFloor, isLevels, isSizes, isStops, machineOf, reduceFraction, solvableAt, solveCoverage, truthOf,
  type Fraction,
} from './sim1.js';
import { OUTCOMES, analyseChoices, payloadProblem, type Payload } from './sim2.js';

// F0.4 checkers for the five seeded simulations. Core grades them against a seeded run the gate never has, so each checker proves what the
// public payload and the exact model fix: the answer exists, a full run reaches it reliably, no neighbouring setting does, the start is not
// it. Every slider here is reversible, so no state is a dead end and none is searched for.

const CHANCE = 'math.chance-sim.v2';
const GALTON = 'math.galton-sim.v2';
const COVERAGE = 'stats.coverage-sim.v2';
const BOOTSTRAP = 'stats.bootstrap-sim.v2';
const LIFE = 'money.life-sim.v2';

/** A run that misses the tolerance more often than this is luck, not a result (the 5 sigma rule is the same idea, approximated). */
const LUCK_TAIL = 1e-4;
/** A setting below the key that still reaches the goal on this share of seeds is a second answer the key calls wrong. */
const NEAR_CERTAIN = 0.99;
const FLOOR_MIN_RESAMPLES = 50;

const pct = (share: number): string => `${(share * 100).toFixed(share >= 0.999 || share < 0.001 ? 4 : 1)}%`;

/** P(the share of `runs` lands further than `tolerance` points from the chance), summed exactly over the binomial. */
function missChance(chance: Fraction, runs: number, tolerance: number): number {
  const pmf = binomialPmf(runs, chance.num / chance.den);
  const num = BigInt(chance.num);
  const den = BigInt(chance.den);
  let inside = 0;
  for (let hits = 0; hits <= runs; hits += 1) {
    const gap = BigInt(hits) * den - num * BigInt(runs);
    if (100n * (gap < 0n ? -gap : gap) <= BigInt(tolerance) * BigInt(runs) * den) inside += pmf[hits] as number;
  }
  return Math.max(0, 1 - inside);
}

const reliableAt = (chance: Fraction, runs: number, tolerance: number): boolean => solvableAt(chance, runs, tolerance) && missChance(chance, runs, tolerance) <= LUCK_TAIL;

function targetOf(answerKey: unknown): Record<string, unknown> | undefined {
  const key = asRecord(answerKey);
  return key && Object.keys(key).length === 1 && Object.hasOwn(key, 'target') ? asRecord(key.target) : undefined;
}

const keyShape = (subject: string, shape: string): SolvabilityIssue => issue('impossible-state', `${subject}: the rubric must be { target: ${shape} }`);

/** One key string against the one string the payload implies: a wrong key is both a gap (the answer is rejected) and an acceptance of a non-answer. */
function singleKey(subject: string, given: string, implied: string): SolvabilityIssue[] {
  return checkRubricCoverage([implied], new Set([given]), { subject, isSolution: (candidate) => candidate === implied });
}

interface RunBoard { chance: Fraction; runs: number[]; floor: number; tolerance: number }

function runShape(subject: string, runs: unknown, floor: unknown, tolerance: unknown, limit: number, floorOk: (floor: unknown, runs: number[]) => boolean, toleranceMax: number): SolvabilityIssue | null {
  if (!isStops(runs, limit)) return issue('impossible-state', `${subject}: the stops must be 3 to 8 rising whole counts up to ${limit}`);
  if (!floorOk(floor, runs)) return issue('impossible-state', `${subject}: the floor must be one of the stops and never the first, so a run short of it always exists and the start can never meet it`);
  if (!inRange(tolerance, 1, toleranceMax)) return issue('impossible-state', `${subject}: the tolerance must be a whole number of points from 1 to ${toleranceMax}`);
  return null;
}

/**
 * A share read from a seeded run: the chance is derived from the public payload, a run at the last stop must land inside the tolerance
 * reliably (the pack's 5 sigma rule and the exact binomial), and the stop just below the floor must not, or the floor and not the
 * tolerance would be what separates a right run from a wrong one. One chance, so the key is the only answer to compare.
 */
function proveRun(subject: string, board: RunBoard, budget: Budget): { issues: SolvabilityIssue[]; stats: Record<string, number> } {
  const { chance, runs, floor, tolerance } = board;
  const last = runs[runs.length - 1] as number;
  const below = runs[runs.indexOf(floor) - 1] as number;
  const stats: Record<string, number> = { lastStop: last };
  if (!chanceInBand(chance)) {
    return { issues: [issue('out-of-bounds', `${subject}: the chance is ${chance.num}/${chance.den}, outside 5% to 95%, so a share in percentage points means nothing`)], stats };
  }
  if (!budget.spend(last + below)) return { issues: [budgetIssue(subject, budget.limit, 'that a full run lands inside the tolerance')], stats };
  const issues: SolvabilityIssue[] = [];
  const lastMiss = missChance(chance, last, tolerance);
  stats.lastMiss = lastMiss;
  if (!solvableAt(chance, last, tolerance) || lastMiss > LUCK_TAIL) {
    issues.push(issue('no-solution', `${subject}: a run of ${last} (the last stop) misses a tolerance of ${tolerance} points on ${pct(lastMiss)} of seeds, so the learner cannot reliably succeed`));
  }
  if (reliableAt(chance, below, tolerance)) {
    issues.push(issue('ambiguous-solution', `${subject}: ${below} runs, the stop below the floor of ${floor}, already land inside the tolerance of ${tolerance} points reliably, so the floor and not the tolerance separates a right run from a wrong one`));
  }
  return { issues, stats };
}

function chanceKey(subject: string, chance: Fraction, answerKey: unknown): SolvabilityIssue[] {
  const target = targetOf(answerKey);
  if (!hasOnly(target, ['num', 'den']) || !isWhole(target.num) || !isWhole(target.den)) return [keyShape(subject, '{ num, den } (a fraction of whole numbers)')];
  return singleKey(subject, `${target.num}/${target.den}`, `${chance.num}/${chance.den}`);
}

// A typed share has one derived answer, the exact reduced chance, so there is no second answer to look for.
const chanceChecker: SolvabilityChecker = (segment, context) => {
  const subject = `chance simulation ${segment.id}`;
  const { payload } = segment;
  const machine = machineOf(payload.machine);
  if (!machine) return result([issue('impossible-state', `${subject}: the machine is a coin (2 weights), a die (6) or a spinner (3 to 8), each weight a whole number from 1 to 12`)]);
  const faces = machine.kind === 'coin' ? 2 : machine.kind === 'die' ? 6 : machine.weights.length;
  const event = eventOf(payload.event, faces);
  if (!event) return result([issue('impossible-state', `${subject}: the event must be a non-empty, proper set of faces in rising order`)]);
  const shape = runShape(subject, payload.stops, payload.minTrials, payload.tolerance, CHANCE_TRIALS_LIMIT, isFloor, 25);
  if (shape) return result([shape]);
  const total = machine.weights.reduce((sum, weight) => sum + weight, 0);
  const chance = reduceFraction(BigInt(event.reduce((sum, face) => sum + (machine.weights[face] ?? 0), 0)), BigInt(total));
  const board: RunBoard = { chance, runs: payload.stops as number[], floor: payload.minTrials as number, tolerance: payload.tolerance as number };
  const { issues, stats } = proveRun(subject, board, new Budget(context.nodeBudget));
  if (issues.length === 0 && context.answerKey !== undefined) issues.push(...chanceKey(subject, chance, context.answerKey));
  return result(issues, stats);
};

const galtonChecker: SolvabilityChecker = (segment, context) => {
  const subject = `Galton simulation ${segment.id}`;
  const { payload } = segment;
  const { view, rows, rightPct, bin } = payload;
  if ((view !== 'board' && view !== 'walk') || !inRange(rows, 3, 10) || !inRange(rightPct, 10, 90) || rightPct % 10 !== 0 || !inRange(bin, 0, rows)) {
    return result([issue('impossible-state', `${subject}: the board has 3 to 10 rows, a chance of going right that is a multiple of 10 from 10 to 90, and a bin from 0 to the rows`)]);
  }
  const shape = runShape(subject, payload.stops, payload.minBalls, payload.tolerance, GALTON_BALLS_LIMIT, isFloor, 25);
  if (shape) return result([shape]);
  const chance = binChance(rows, rightPct, bin);
  const board: RunBoard = { chance, runs: payload.stops as number[], floor: payload.minBalls as number, tolerance: payload.tolerance as number };
  const { issues, stats } = proveRun(subject, board, new Budget(context.nodeBudget));
  if (issues.length === 0 && context.answerKey !== undefined) issues.push(...chanceKey(subject, chance, context.answerKey));
  return result(issues, stats);
};

type CoverageBoard = { truth: Fraction; levels: number[]; sizes: number[]; start: { level: number; size: number }; goal: number };

function readCoverage(subject: string, payload: Record<string, unknown>): CoverageBoard | SolvabilityIssue {
  const truth = truthOf(payload.truth);
  if (!truth) return issue('impossible-state', `${subject}: the truth must be a share from 1/5 to 4/5 with a denominator up to 20`);
  const { levels, sizes, start, goal } = payload;
  if (!isLevels(levels)) return issue('impossible-state', `${subject}: the levels must be 2 to 5 rising picks from 50, 80, 90, 95 and 99`);
  if (!isSizes(sizes)) return issue('impossible-state', `${subject}: the sizes must be 2 to 5 rising counts from 10 to 400`);
  if (!hasOnly(start, ['level', 'size']) || !levels.includes(start.level as number) || !sizes.includes(start.size as number)) {
    return issue('impossible-state', `${subject}: the start level and size must both be among the choices`);
  }
  if (!hasOnly(goal, ['covered']) || !inRange(goal.covered, 50, 99)) return issue('impossible-state', `${subject}: the goal must be 50 to 99 covering intervals out of 100`);
  return { truth, levels, sizes, start: { level: start.level as number, size: start.size as number }, goal: goal.covered };
}

// Any cell whose seeded 100 intervals cover the goal is met by design; the key names only the lowest level that reaches it reliably.
const coverageChecker: SolvabilityChecker = (segment, context) => {
  const subject = `coverage simulation ${segment.id}`;
  const board = readCoverage(subject, segment.payload);
  if ('code' in board) return result([board]);
  const { truth, levels, sizes, start, goal } = board;
  const budget = new Budget(context.nodeBudget);
  const gridCost = levels.length * sizes.reduce((sum, size) => sum + size + SAMPLES, 0);
  if (!budget.spend(2 * gridCost)) return result([budgetIssue(subject, budget.limit, 'which levels reach the goal')]);
  const answer = solveCoverage(truth, levels, sizes, goal);
  if (answer === null) return result([issue('no-solution', `${subject}: no level and size on the board reach ${goal} covering intervals out of 100 reliably, so the learner cannot succeed`)]);
  const reach = (level: number, size: number): number => binomialAtLeast(SAMPLES, coverageChance(truth, level, size), goal);
  const issues: SolvabilityIssue[] = [];
  const startReach = reach(start.level, start.size);
  if (answer <= start.level) {
    issues.push(issue('impossible-state', `${subject}: level ${start.level}, the start, already reaches the goal reliably at some size, so the answer would not be above the start`));
  } else if (startReach >= NEAR_CERTAIN) {
    issues.push(issue('impossible-state', `${subject}: the start (level ${start.level}, size ${start.size}) already reaches the goal on ${pct(startReach)} of seeds, so there is nothing to change`));
  } else {
    const rival = levels.filter((level) => level < answer).flatMap((level) => sizes.map((size) => ({ level, size, share: reach(level, size) }))).find((cell) => cell.share >= NEAR_CERTAIN);
    if (rival) {
      issues.push(issue('ambiguous-solution', `${subject}: level ${rival.level} at size ${rival.size} reaches the goal on ${pct(rival.share)} of seeds, so the board accepts it though the key says the lowest level is ${answer}`, { severity: 'review' }));
    }
  }
  if (!issues.some((item) => item.severity === 'block') && context.answerKey !== undefined) {
    const target = targetOf(context.answerKey);
    if (!hasOnly(target, ['level']) || !isWhole(target.level)) issues.push(keyShape(subject, '{ level } (a whole number)'));
    else issues.push(...singleKey(subject, String(target.level), String(answer)));
  }
  return result(issues, { answer, startReach });
};

type BootstrapBoard = { data: number[]; level: number; runs: number[]; floor: number; tolerance: number };

function readBootstrap(subject: string, payload: Record<string, unknown>): BootstrapBoard | SolvabilityIssue {
  const { axis, data, level, stops, tolerance, minResamples } = payload;
  if (!hasOnly(axis, ['min', 'max']) || !inRange(axis.min, 0, 100) || !inRange(axis.max, 0, 100) || axis.max - axis.min < 4 || axis.max - axis.min > 20) {
    return issue('impossible-state', `${subject}: the axis must run from 0 to 100 and be 4 to 20 steps wide`);
  }
  if (!Array.isArray(data) || data.length < 4 || data.length > 10 || !data.every((value) => inRange(value, axis.min as number, axis.max as number)) || new Set(data).size < 3) {
    return issue('impossible-state', `${subject}: the data must be 4 to 10 whole values on the axis with at least 3 different`);
  }
  if (!BOOTSTRAP_LEVELS.includes(level as number)) return issue('impossible-state', `${subject}: the level must be 80, 90 or 95`);
  const shape = runShape(subject, stops, minResamples, tolerance, 3000, (floor, runs) => inRange(floor, FLOOR_MIN_RESAMPLES, 3000) && runs.indexOf(floor) > 0, 40);
  if (shape) return shape;
  return { data: data as number[], level: level as number, runs: stops as number[], floor: minResamples as number, tolerance: tolerance as number };
}

// A typed pair of edges has one derived answer, the exact percentiles of every possible resample, so there is no second answer to look for.
const bootstrapChecker: SolvabilityChecker = (segment, context) => {
  const subject = `bootstrap simulation ${segment.id}`;
  const board = readBootstrap(subject, segment.payload);
  if ('code' in board) return result([board]);
  const { data, level, runs, floor, tolerance } = board;
  const last = runs[runs.length - 1] as number;
  const below = runs[runs.indexOf(floor) - 1] as number;
  const budget = new Budget(context.nodeBudget);
  const top = data.length * Math.max(...data) + 1;
  // The exact sum table is built five times below (the edges, then the table and edges again inside each reliability test).
  if (!budget.spend(5 * data.length * top + last + below)) return result([budgetIssue(subject, budget.limit, 'that a full run lands inside the tolerance')]);
  const exact = exactEdges(data, level);
  const issues: SolvabilityIssue[] = [];
  if (!bootstrapSolvable(data, level, last, tolerance)) {
    issues.push(issue('no-solution', `${subject}: ${last} resamples (the last stop) miss both edges within ${tolerance} sum steps by luck, so the learner cannot reliably succeed`));
  }
  if (bootstrapSolvable(data, level, below, tolerance)) {
    issues.push(issue('ambiguous-solution', `${subject}: ${below} resamples, the stop below the floor of ${floor}, already settle both edges within ${tolerance} sum steps reliably, so the floor and not the tolerance separates a right run from a wrong one`));
  }
  if (issues.length === 0 && context.answerKey !== undefined) {
    const target = targetOf(context.answerKey);
    if (!hasOnly(target, ['low', 'high']) || !isWhole(target.low) || !isWhole(target.high)) issues.push(keyShape(subject, '{ low, high } (whole numbers)'));
    else issues.push(...singleKey(subject, `${target.low},${target.high}`, `${exact.low},${exact.high}`));
  }
  return result(issues, { low: exact.low, high: exact.high, lastStop: last });
};

function lifeKey(subject: string, answers: readonly number[], answerKey: unknown): SolvabilityIssue[] {
  const target = targetOf(answerKey);
  const given = hasOnly(target, ['answers']) ? target.answers : undefined;
  if (!Array.isArray(given) || !given.every(isWhole)) return [keyShape(subject, '{ answers: number[] } (whole numbers)')];
  const issues = checkRubricCoverage(answers.map(String), new Set(given.map(String)), { subject, isSolution: (candidate) => answers.includes(Number(candidate)) });
  if (issues.length === 0 && (given.length !== answers.length || given.some((value, index) => value !== answers[index]))) {
    issues.push(issue('impossible-state', `${subject}: the answers must list each answer once, in the order of the choices: ${answers.join(', ')}`));
  }
  return issues;
}

// One unit of budget is one chapter state expanded into its 8 outcomes, so the largest board (8 choices, 5 chapters) costs 37,448 units.
const lifeChecker: SolvabilityChecker = (segment, context) => {
  const subject = `life simulation ${segment.id}`;
  const problem = payloadProblem(segment.payload);
  if (problem) return result([issue('impossible-state', `${subject}: ${problem}`)]);
  const payload = segment.payload as unknown as Payload;
  let perChoice = 0;
  for (let period = 0, states = 1; period < payload.periods; period += 1, states *= OUTCOMES) perChoice += states;
  const budget = new Budget(context.nodeBudget);
  if (!budget.spend(perChoice * payload.choices.length)) return result([budgetIssue(subject, budget.limit, 'which choices reach the goal')]);
  const { reach, answers, borderline } = analyseChoices(payload);
  const issues: SolvabilityIssue[] = [];
  if (answers.length === 0) {
    issues.push(issue('no-solution', `${subject}: no choice reaches ${payload.goal} of 100 futures reliably (the best reaches it on ${pct(Math.max(...reach))} of seeds), so the learner cannot succeed`));
  }
  if (borderline !== undefined) {
    const share = reach[payload.choices.indexOf(borderline)] as number;
    issues.push(issue('ambiguous-solution', `${subject}: the choice ${borderline} reaches the goal on ${pct(share)} of seeds, so it is neither an answer nor a clear miss and the replay could flip its verdict`));
  }
  if (answers.includes(payload.start)) {
    issues.push(issue('impossible-state', `${subject}: the start choice ${payload.start} is already an answer, so there is nothing to change`));
  }
  if (issues.length === 0 && context.answerKey !== undefined) issues.push(...lifeKey(subject, answers, context.answerKey));
  return result(issues, { choices: payload.choices.length, answers: answers.length });
};

const checkers: ReadonlyArray<readonly [string, SolvabilityChecker]> = [
  [CHANCE, chanceChecker], [GALTON, galtonChecker], [COVERAGE, coverageChecker], [BOOTSTRAP, bootstrapChecker], [LIFE, lifeChecker],
];
for (const [type, checker] of checkers) registerSolvabilityChecker(type, checker);
