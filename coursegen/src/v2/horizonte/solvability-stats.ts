import {
  asRecord, Budget, budgetIssue, checkRubricCoverage, exploreStateSpace, issue, registerSolvabilityChecker, result, searchArrangements, searchAssignments,
  type SearchResult, type SolvabilityChecker, type SolvabilityIssue, type SolvabilityResult,
} from '../solvability.js';
import {
  asTenths, compare, exactFit, frac, growthOf, hasOnly, INTERCEPT_TENTHS, plotOf, readNumber, SLOPE_TENTHS, SLOTS, valuesOf, ZERO,
  inRange as inProbRange, type Basis, type Counts, type Frac, type Point,
} from './prob.js';
import {
  curveAxis, dotAxis, DOT_COUNT, dotsOf, inRange, measureMet, measureValue, onGrid, reachable, solveBinomial, solveNormal, sum, type Axis,
} from './stats1.js';

/**
 * F0.4 checkers for the Horizonte statistics and probability pieces. Each one reads the public payload alone for everything the payload
 * fixes, and compares with the answer key only when there is one. The pack gates (stats1.ts, prob.ts) stay as they are: the helpers
 * imported here are theirs, and the searches below are independent encodings of the same facts, so a bug in either shows up as a
 * disagreement instead of passing quietly.
 */

const DOT_PLOT = 'stats.dot-plot.v2';
const BALANCE_POINT = 'stats.balance-point.v2';
const NORMAL = 'stats.normal.v2';
const BINOMIAL = 'stats.binomial.v2';
const CLT = 'stats.clt.v2';
const TREE = 'prob.tree.v2';
const BAYES = 'prob.bayes.v2';
const REGRESSION = 'prob.regression.v2';

const MAX_KEY_SOLUTIONS = 64;
const BINOMIAL_GRID = Array.from({ length: 19 }, (_, index) => 5 + 5 * index);

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const range = (low: number, high: number): number[] => Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index);
const failing = (code: SolvabilityIssue['code'], message: string): SolvabilityResult => result([issue(code, message)]);
const isIssue = (value: object): value is SolvabilityIssue => 'code' in value && 'severity' in value;
const stat = (budget: { used: number; limit: number }): number => Math.min(budget.used, budget.limit);

type Sole<V> = { issue: SolvabilityIssue } | { value: readonly V[] };

/** The one solution of a search, or the issue that says why there is not exactly one. */
function soleOf<V>(search: SearchResult<V>, subject: string, text: { none: string; many: string; what: string }): Sole<V> {
  if (search.count >= 2) return { issue: issue('ambiguous-solution', `${subject}: ${text.many}`) };
  if (search.budgetExceeded) return { issue: budgetIssue(subject, search.nodes, text.what) };
  if (search.count === 0) return { issue: issue('no-solution', `${subject}: ${text.none}`) };
  return { value: search.solutions[0]! };
}

/** Every stats1 rubric is { target } and nothing else; null when the key is not that. */
function targetOf(answerKey: unknown): { target: unknown } | null {
  const key = asRecord(answerKey);
  return key && Object.keys(key).length === 1 && Object.hasOwn(key, 'target') ? { target: key.target } : null;
}

const needsTarget = (subject: string): SolvabilityIssue => issue('impossible-state', `${subject}: the rubric must be { target } and nothing else`);

/** The key's one answer written as text, then compared with what the payload fixes: a missing answer is a gap, a wrong one is accepted wrongly. */
const coverKey = (subject: string, solution: string, given: string): SolvabilityIssue[] =>
  checkRubricCoverage([solution], new Set([given]), { subject, isSolution: (candidate) => candidate === solution });

// ---------------------------------------------------------------------------------------------------------------------------------
// stats.dot-plot.v2
// ---------------------------------------------------------------------------------------------------------------------------------

interface Beam { axis: Axis; dots: number[] }
interface DotBoard extends Beam { measure: 'mean' | 'median' | 'mode'; moves: number }

function readBeam(subject: string, payload: Record<string, unknown>): Beam | SolvabilityIssue {
  const axis = dotAxis(payload.axis);
  if (!axis) return issue('impossible-state', `${subject}: the axis must run from 0 to 100 and be 4 to 20 steps wide`);
  const raw = payload.dots;
  if (!Array.isArray(raw) || raw.length < DOT_COUNT.min || raw.length > DOT_COUNT.max || !raw.every(isInt)) {
    return issue('impossible-state', `${subject}: the plot holds ${DOT_COUNT.min} to ${DOT_COUNT.max} whole dots`);
  }
  const dots = dotsOf(raw, axis);
  return dots ? { axis, dots } : issue('out-of-bounds', `${subject}: a dot sits off the axis (${axis.min} to ${axis.max}), so the learner cannot see it`);
}

function readDotBoard(subject: string, payload: Record<string, unknown>): DotBoard | SolvabilityIssue {
  const beam = readBeam(subject, payload);
  if (isIssue(beam)) return beam;
  const { measure, moves } = payload;
  if (measure !== 'mean' && measure !== 'median' && measure !== 'mode') return issue('impossible-state', `${subject}: the measure is mean, median or mode`);
  if (!inRange(moves, 1, 2)) return issue('impossible-state', `${subject}: the learner may move 1 or 2 dots`);
  return { ...beam, measure, moves };
}

/** Every whole value the measure takes on some arrangement that at most `moves` single-dot moves reach from the start, found by walking those arrangements. */
function reachableValues(board: DotBoard, maxNodes: number): { values: Set<number>; states: number; nodes: number; budgetExceeded: boolean } {
  const { axis, dots, measure, moves } = board;
  const width = axis.max - axis.min + 1;
  const first = new Array<number>(width).fill(0);
  for (const dot of dots) first[dot - axis.min] = first[dot - axis.min]! + 1;
  const spread = (counts: readonly number[]): number[] => counts.flatMap((count, index) => new Array<number>(count).fill(axis.min + index));
  const values = new Set<number>();
  const explored = exploreStateSpace<number[], string>({
    initial: [first],
    moves: (counts) => {
      const out: Array<{ move: string; next: number[] }> = [];
      for (let from = 0; from < width; from += 1) {
        if (counts[from]! < 1) continue;
        for (let to = 0; to < width; to += 1) {
          if (to === from) continue;
          const next = counts.slice();
          next[from] = counts[from]! - 1;
          next[to] = counts[to]! + 1;
          out.push({ move: `${axis.min + from}>${axis.min + to}`, next });
        }
      }
      return out;
    },
    // Called once per arrangement, so it doubles as the visitor that collects the values; nothing here is a goal.
    isGoal: (counts) => {
      const value = measureValue(measure, spread(counts));
      if (value !== null) values.add(value);
      return false;
    },
    key: (counts) => counts.join(','),
    maxNodes,
    maxDepth: moves,
  });
  return { values, states: explored.reachable, nodes: explored.nodes, budgetExceeded: explored.budgetExceeded };
}

/*
 * Why the dot plot has no uniqueness proof and no dead-end search. The target lives only in the key, so the payload alone cannot name
 * the one answer: it names the set of targets some allowed move reaches, and the checker proves that set holds a value other than
 * the start's own. Several arrangements meet one target by design (the grade is the measure, not the arrangement), so the key's
 * accepted set is exactly "the arrangements within the cap whose measure is the target", which the pack's reachable() enumerates.
 * The move cap is state based (dots moved from the start), so every move can be undone; any reachable arrangement can step back to the
 * start and on to a goal, and no arrangement is a dead end. A full back-edge search would cost about 58 thousand moves on the
 * largest plot for a conclusion that follows from that symmetry.
 */
const dotPlotChecker: SolvabilityChecker = (segment, context) => {
  const subject = `dot plot ${segment.id}`;
  const board = readDotBoard(subject, segment.payload);
  if (isIssue(board)) return result([board]);
  const found = reachableValues(board, context.nodeBudget);
  const stats = { states: found.states, nodes: found.nodes };
  if (found.budgetExceeded) return result([budgetIssue(subject, found.nodes, `that ${board.moves} move(s) can change the ${board.measure}`)], stats);
  const startValue = measureValue(board.measure, board.dots);
  const targets = [...found.values].filter((value) => value !== startValue);
  if (targets.length === 0) {
    return result([issue('no-solution', `${subject}: no arrangement within ${board.moves} move(s) has a different whole ${board.measure} than the start, so there is nothing to reach`)], { ...stats, targets: 0 });
  }
  const withTargets = { ...stats, targets: targets.length };
  if (context.answerKey === undefined) return result([], withTargets);
  const read = targetOf(context.answerKey);
  if (!read) return result([needsTarget(subject)], withTargets);
  const { target } = read;
  if (!isInt(target)) return result([issue('impossible-state', `${subject}: the target must be a whole number`)], withTargets);
  if (!inRange(target, board.axis.min, board.axis.max)) return result([issue('out-of-bounds', `${subject}: the target ${target} is off the axis (${board.axis.min} to ${board.axis.max})`)], withTargets);
  if (measureMet(board.measure, board.dots, target)) return result([issue('impossible-state', `${subject}: the start already has ${board.measure} ${target}, so there is nothing to move`)], withTargets);
  if (!reachable(board.dots, board.axis, board.measure, board.moves, target)) {
    return result([issue('no-solution', `${subject}: no ${board.moves} dot move(s) bring the ${board.measure} to ${target}`)], withTargets);
  }
  return result([], withTargets);
};

// ---------------------------------------------------------------------------------------------------------------------------------
// stats.balance-point.v2
// ---------------------------------------------------------------------------------------------------------------------------------

/*
 * The pivot is a slider over whole positions with no cap, so a wrong move is undone by another and there is no dead end. The balance
 * position is found as the pivot where the pulls on the two sides cancel, which is a different statement from the mean the pack uses.
 */
const balanceChecker: SolvabilityChecker = (segment, context) => {
  const subject = `balance point ${segment.id}`;
  const beam = readBeam(subject, segment.payload);
  if (isIssue(beam)) return result([beam]);
  const { axis, dots } = beam;
  const pivot = segment.payload.pivot;
  if (!isInt(pivot)) return failing('impossible-state', `${subject}: the pivot must be a whole position`);
  if (!inRange(pivot, axis.min, axis.max)) return failing('out-of-bounds', `${subject}: the pivot starts at ${pivot}, off the axis (${axis.min} to ${axis.max})`);
  const search = searchAssignments<number>({
    domains: [range(axis.min, axis.max)],
    isSolution: ([position]) => sum(dots.map((dot) => dot - position!)) === 0,
    limit: 2,
    maxNodes: context.nodeBudget,
  });
  const stats = { nodes: search.nodes, balances: search.count };
  const sole = soleOf(search, subject, {
    none: `the dots balance at ${sum(dots)}/${dots.length}, which is not a whole position of the axis, so no pivot setting balances the beam`,
    many: 'more than one pivot position balances the beam',
    what: 'that exactly one pivot balances the beam',
  });
  if ('issue' in sole) return result([sole.issue], stats);
  const point = sole.value[0]!;
  const issues: SolvabilityIssue[] = [];
  if (pivot === point) issues.push(issue('impossible-state', `${subject}: the pivot starts on the balance point ${point}, so the beam is already level`));
  if (context.answerKey !== undefined) {
    const read = targetOf(context.answerKey);
    if (!read) issues.push(needsTarget(subject));
    else if (!isInt(read.target)) issues.push(issue('impossible-state', `${subject}: the target must be a whole position`));
    else if (!inRange(read.target, axis.min, axis.max)) issues.push(issue('out-of-bounds', `${subject}: the target ${read.target} is off the axis (${axis.min} to ${axis.max})`));
    else issues.push(...coverKey(subject, String(point), String(read.target)));
  }
  return result(issues, stats);
};

// ---------------------------------------------------------------------------------------------------------------------------------
// stats.normal.v2
// ---------------------------------------------------------------------------------------------------------------------------------

/*
 * Both curve numbers are sliders over whole steps with no cap and nothing is spent by moving them, so there is no dead end. The band
 * fixes one mean and one spread, so the answer is unique; the search proves that by trying every mean and spread the sliders offer.
 */
const normalChecker: SolvabilityChecker = (segment, context) => {
  const subject = `normal curve ${segment.id}`;
  const { payload } = segment;
  const axis = curveAxis(payload.axis);
  if (!axis) return failing('impossible-state', `${subject}: the axis must run from 0 to 200 and be at least 10 steps wide`);
  const { sdMax } = payload;
  if (!inRange(sdMax, 1, 30)) return failing('impossible-state', `${subject}: sdMax must be a whole number from 1 to 30`);
  const start = asRecord(payload.start);
  if (!start || !isInt(start.mean) || !isInt(start.sd)) return failing('impossible-state', `${subject}: the start is a whole mean and a whole spread`);
  if (!inRange(start.mean, axis.min, axis.max) || !inRange(start.sd, 1, sdMax)) return failing('out-of-bounds', `${subject}: the start must sit on the axis with a spread from 1 to ${sdMax}`);
  const band = asRecord(payload.band);
  const rule = band?.rule;
  const low = band?.low;
  const high = band?.high;
  if (!band || !inRange(rule, 1, 3) || !isInt(low) || !isInt(high)) return failing('impossible-state', `${subject}: the band is { rule: 1 to 3, low, high } with whole edges`);
  if (!inRange(low, axis.min, axis.max) || !inRange(high, axis.min, axis.max)) return failing('out-of-bounds', `${subject}: the band edges ${low} and ${high} must sit on the axis (${axis.min} to ${axis.max})`);
  if (high <= low) return failing('impossible-state', `${subject}: the band must run from a low edge up to a higher one`);
  const search = searchAssignments<number>({
    domains: [range(axis.min, axis.max), range(1, sdMax)],
    isSolution: ([mean, sd]) => mean! - rule * sd! === low && mean! + rule * sd! === high,
    limit: 2,
    maxNodes: context.nodeBudget,
  });
  const stats = { nodes: search.nodes, solutions: search.count };
  const sole = soleOf(search, subject, {
    none: `no mean on the axis and spread from 1 to ${sdMax} puts the band edges ${low} and ${high} exactly ${rule} spread(s) either side of the mean`,
    many: 'more than one curve puts the band edges where the prompt says',
    what: 'that exactly one curve fits the band',
  });
  if ('issue' in sole) return result([sole.issue], stats);
  const [mean, sd] = sole.value as [number, number];
  const pack = solveNormal(axis, band, sdMax);
  if (!pack || pack.mean !== mean || pack.sd !== sd) return result([issue('impossible-state', `${subject}: the search finds mean ${mean} and spread ${sd} but the pack solver disagrees; one of them is wrong`)], stats);
  const issues: SolvabilityIssue[] = [];
  if (start.mean === mean && start.sd === sd) issues.push(issue('impossible-state', `${subject}: the curve starts on the answer (mean ${mean}, spread ${sd}), so there is nothing to move`));
  if (context.answerKey !== undefined) {
    const read = targetOf(context.answerKey);
    const target = read ? asRecord(read.target) : undefined;
    if (!read) issues.push(needsTarget(subject));
    else if (!target || Object.keys(target).sort().join() !== 'mean,sd' || !isInt(target.mean) || !isInt(target.sd)) issues.push(issue('impossible-state', `${subject}: the target must be { mean, sd } with whole numbers`));
    else if (!inRange(target.mean, axis.min, axis.max) || !inRange(target.sd, 1, sdMax)) issues.push(issue('out-of-bounds', `${subject}: the target (mean ${target.mean}, spread ${target.sd}) is outside what the sliders offer`));
    else issues.push(...coverKey(subject, `${mean}/${sd}`, `${target.mean}/${target.sd}`));
  }
  return result(issues, stats);
};

// ---------------------------------------------------------------------------------------------------------------------------------
// stats.binomial.v2
// ---------------------------------------------------------------------------------------------------------------------------------

/*
 * The count and the percent are independent sliders with no cap, so nothing can be spent and there is no dead end. The goal mean
 * and variance fix the percent and then the count, so the answer is unique; the search tries every count and every percent on the grid.
 */
const binomialChecker: SolvabilityChecker = (segment, context) => {
  const subject = `binomial ${segment.id}`;
  const { payload } = segment;
  const { nMax } = payload;
  if (!inRange(nMax, 1, 40)) return failing('impossible-state', `${subject}: nMax must be a whole number from 1 to 40`);
  const start = asRecord(payload.start);
  if (!start || !isInt(start.n) || !isInt(start.pct)) return failing('impossible-state', `${subject}: the start is a whole count and a whole percent`);
  if (!inRange(start.n, 1, nMax) || !onGrid(start.pct)) return failing('out-of-bounds', `${subject}: the start count must be 1 to ${nMax} and the percent a multiple of 5 from 5 to 95`);
  const goal = asRecord(payload.goal);
  const mean = goal?.mean;
  const variance = goal?.variance;
  if (!goal || !inRange(mean, 1, 40) || !inRange(variance, 1, 40)) return failing('impossible-state', `${subject}: the goal mean and variance are whole numbers from 1 to 40`);
  const search = searchAssignments<number>({
    domains: [range(1, nMax), BINOMIAL_GRID],
    isSolution: ([n, pct]) => n! * pct! === 100 * mean && n! * pct! * (100 - pct!) === 10_000 * variance,
    limit: 2,
    maxNodes: context.nodeBudget,
  });
  const stats = { nodes: search.nodes, solutions: search.count };
  const sole = soleOf(search, subject, {
    none: `no count up to ${nMax} with a percent on the 5 step grid has mean ${mean} and variance ${variance}${variance >= mean ? ' (a variance at or above the mean is impossible)' : ''}`,
    many: 'more than one count and percent give this mean and variance',
    what: 'that exactly one count and percent fit the goal',
  });
  if ('issue' in sole) return result([sole.issue], stats);
  const [n, pct] = sole.value as [number, number];
  const pack = solveBinomial(goal, nMax);
  if (!pack || pack.n !== n || pack.pct !== pct) return result([issue('impossible-state', `${subject}: the search finds n ${n} at ${pct} percent but the pack solver disagrees; one of them is wrong`)], stats);
  const issues: SolvabilityIssue[] = [];
  if (start.n === n && start.pct === pct) issues.push(issue('impossible-state', `${subject}: the bars start on the answer (n ${n} at ${pct} percent), so there is nothing to move`));
  if (context.answerKey !== undefined) {
    const read = targetOf(context.answerKey);
    const target = read ? asRecord(read.target) : undefined;
    if (!read) issues.push(needsTarget(subject));
    else if (!target || Object.keys(target).sort().join() !== 'n,pct' || !isInt(target.n) || !isInt(target.pct)) issues.push(issue('impossible-state', `${subject}: the target must be { n, pct } with whole numbers`));
    else if (!inRange(target.n, 1, nMax) || !onGrid(target.pct)) issues.push(issue('out-of-bounds', `${subject}: the target (n ${target.n} at ${target.pct} percent) is outside what the sliders offer`));
    else issues.push(...coverKey(subject, `${n}/${pct}`, `${target.n}/${target.pct}`));
  }
  return result(issues, stats);
};

// ---------------------------------------------------------------------------------------------------------------------------------
// stats.clt.v2
// ---------------------------------------------------------------------------------------------------------------------------------

/*
 * The sample size is one slider with no cap, so there is no dead end. Shrinking the spread of the mean k times takes n = k squared
 * only while one draw has a spread at all; a population with all its weight on one value has none, every n then "shrinks" it, and
 * the checker refuses that as ambiguous.
 */
const cltChecker: SolvabilityChecker = (segment, context) => {
  const subject = `sampling mean ${segment.id}`;
  const { payload } = segment;
  const { weights } = payload;
  if (!Array.isArray(weights) || weights.length < 3 || weights.length > 8 || !weights.every(isInt)) return failing('impossible-state', `${subject}: the weights are 3 to 8 whole numbers`);
  if (!weights.every((weight) => inRange(weight, 0, 20))) return failing('out-of-bounds', `${subject}: every weight is from 0 to 20`);
  if (!weights.some((weight) => weight > 0)) return failing('impossible-state', `${subject}: every weight is zero, so there is no population to draw from`);
  const { nMax } = payload;
  if (!inRange(nMax, 1, 25)) return failing('impossible-state', `${subject}: nMax must be a whole number from 1 to 25`);
  const start = asRecord(payload.start);
  if (!start || !isInt(start.n)) return failing('impossible-state', `${subject}: the start is a whole sample size`);
  if (!inRange(start.n, 1, nMax)) return failing('out-of-bounds', `${subject}: the start sample size ${start.n} must be 1 to ${nMax}`);
  const goal = asRecord(payload.goal);
  const shrink = goal?.shrink;
  if (!goal || !inRange(shrink, 2, 5)) return failing('impossible-state', `${subject}: the shrink factor is a whole number from 2 to 5`);
  // One draw takes the value i + 1 with weight weights[i]; the variance of one draw, times the square of the total, is T*S2 - S1^2.
  const total = sum(weights);
  const first = sum(weights.map((weight, index) => weight * (index + 1)));
  const second = sum(weights.map((weight, index) => weight * (index + 1) * (index + 1)));
  const spread = total * second - first * first;
  if (spread === 0) return failing('ambiguous-solution', `${subject}: all the weight sits on one value, so one draw has no spread and every sample size shrinks it ${shrink} times`);
  const search = searchAssignments<number>({
    domains: [range(1, nMax)],
    // The spread of the mean of n draws is the spread of one draw over the square root of n; "k times smaller" is spread * k^2 = spread * n.
    isSolution: ([n]) => spread * shrink * shrink === spread * n!,
    limit: 2,
    maxNodes: context.nodeBudget,
  });
  const stats = { nodes: search.nodes, solutions: search.count };
  const sole = soleOf(search, subject, {
    none: `shrinking the spread ${shrink} times takes a sample size of ${shrink * shrink}, which is more than nMax ${nMax}`,
    many: 'more than one sample size shrinks the spread by this factor',
    what: 'that exactly one sample size shrinks the spread',
  });
  if ('issue' in sole) return result([sole.issue], stats);
  const n = sole.value[0]!;
  const issues: SolvabilityIssue[] = [];
  if (start.n === n) issues.push(issue('impossible-state', `${subject}: the sample size starts on the answer ${n}, so there is nothing to move`));
  if (context.answerKey !== undefined) {
    const read = targetOf(context.answerKey);
    const target = read ? asRecord(read.target) : undefined;
    if (!read) issues.push(needsTarget(subject));
    else if (!target || Object.keys(target).join() !== 'n' || !isInt(target.n)) issues.push(issue('impossible-state', `${subject}: the target must be { n } with a whole number`));
    else if (!inRange(target.n, 1, nMax)) issues.push(issue('out-of-bounds', `${subject}: the target sample size ${target.n} is outside 1 to ${nMax}`));
    else issues.push(...coverKey(subject, String(n), String(target.n)));
  }
  return result(issues, stats);
};

// ---------------------------------------------------------------------------------------------------------------------------------
// prob.tree.v2 and prob.bayes.v2 (the same population and shares)
// ---------------------------------------------------------------------------------------------------------------------------------

const GROWTH_CODES = { fields: 'impossible-state', basis: 'impossible-state', whole: 'no-solution', ties: 'ambiguous-solution' } as const;

type Tree = { basis: Basis; counts: Counts };

function growTree(subject: string, payload: Record<string, unknown>, extra: readonly string[]): Tree | SolvabilityIssue {
  const grown = growthOf(payload, extra);
  return 'problem' in grown ? issue(GROWTH_CODES[grown.problem], `${subject}: ${grown.message}`) : grown;
}

const arrangementKey = (values: readonly number[]): string => SLOTS.map((slot, index) => `${slot}=${values[index]}`).join('|');

/** The tree's relations, checked as soon as the slots they involve are filled: has + lacks = population, and each side splits by its share. */
function treeAccepts(basis: Basis): (partial: readonly number[], depth: number) => boolean {
  const { population, prior, hit, alarm } = basis;
  return (partial, depth) => {
    const [has, lacks, hasPos, hasNeg, lacksPos, lacksNeg] = partial;
    switch (depth) {
      case 0: return has! * prior.whole === population * prior.part;
      case 1: return has! + lacks! === population;
      case 2: return hasPos! * hit.whole === has! * hit.part;
      case 3: return hasPos! + hasNeg! === has!;
      case 4: return lacksPos! * alarm.whole === lacks! * alarm.part;
      default: return lacksPos! + lacksNeg! === lacks!;
    }
  };
}

function readChips(subject: string, payload: Record<string, unknown>, population: number): number[] | SolvabilityIssue {
  const chips = payload.chips;
  if (!Array.isArray(chips) || chips.length < 7 || chips.length > 10 || !chips.every(isInt)) return issue('impossible-state', `${subject}: the tray holds 7 to 10 whole counts`);
  if (!chips.every((chip) => inProbRange(chip, 1, population))) return issue('out-of-bounds', `${subject}: a chip is not a number of people from 1 to ${population}`);
  if (new Set(chips).size !== chips.length) return issue('ambiguous-solution', `${subject}: two chips carry the same count, so their ids collide and a branch cannot tell them apart`);
  return chips as number[];
}

function readTreeKey(subject: string, answerKey: unknown): Set<string> | SolvabilityIssue {
  const key = asRecord(answerKey);
  if (!key || Object.keys(key).length !== 1 || !Array.isArray(key.solutions)) return issue('impossible-state', `${subject}: the rubric must be { solutions: [...] } and nothing else`);
  if (key.solutions.length > MAX_KEY_SOLUTIONS) return issue('too-large', `${subject}: the rubric lists ${key.solutions.length} trees, more than the ${MAX_KEY_SOLUTIONS} this checker covers`);
  const accepted = new Set<string>();
  for (const [index, solution] of key.solutions.entries()) {
    const slots = asRecord(solution);
    if (!slots || !hasOnly(slots, SLOTS)) return issue('impossible-state', `${subject}: solution ${index + 1} must name exactly the six branches ${SLOTS.join(', ')}`);
    const values: number[] = [];
    for (const slot of SLOTS) {
      const chips = slots[slot];
      const match = Array.isArray(chips) && chips.length === 1 && typeof chips[0] === 'string' ? /^n-([1-9]\d{0,4})$/.exec(chips[0]) : null;
      if (!match) return issue('impossible-state', `${subject}: solution ${index + 1} must put one chip id n-<count> on branch ${slot}`);
      values.push(Number(match[1]));
    }
    accepted.add(arrangementKey(values));
  }
  return accepted;
}

/*
 * The tray starts empty and a chip can be dragged back off a branch, so no placement is a dead end and the start cannot be solved.
 * The unique tree is found by placing the tray's chips under the tree's own relations (the population splits by the prior, each side
 * splits by its share); the pack gate gets the same counts by formula, and the two must agree.
 */
const treeChecker: SolvabilityChecker = (segment, context) => {
  const subject = `probability tree ${segment.id}`;
  const grown = growTree(subject, segment.payload, ['chips']);
  if (isIssue(grown)) return result([grown]);
  const { basis, counts } = grown;
  const chips = readChips(subject, segment.payload, basis.population);
  if (isIssue(chips)) return result([chips]);
  const search = searchArrangements<number>({
    pool: chips,
    slots: SLOTS.length,
    kind: (chip) => String(chip),
    accept: treeAccepts(basis),
    key: arrangementKey,
    limit: 2,
    maxNodes: context.nodeBudget,
  });
  const stats = { nodes: search.nodes, trees: search.count };
  const sole = soleOf(search, subject, {
    none: 'no placement of the tray puts a count on each branch so that the population splits by the prior and each side by its share, which usually means a head count is missing from the tray',
    many: 'more than one placement of the tray grows a valid tree',
    what: 'that exactly one tree can be built from the tray',
  });
  if ('issue' in sole) return result([sole.issue], stats);
  const wanted = valuesOf(counts);
  if (sole.value.some((value, index) => value !== wanted[index])) return result([issue('impossible-state', `${subject}: the placement the relations allow is not the head counts the shares give; the encodings disagree`)], stats);
  if (context.answerKey === undefined) return result([], stats);
  const accepted = readTreeKey(subject, context.answerKey);
  if (accepted instanceof Set) {
    const valid = new Set(search.keys);
    return result(checkRubricCoverage(search.keys, accepted, { subject, isSolution: (candidate) => valid.has(candidate) }), stats);
  }
  return result([accepted], stats);
};

const fraction = (value: Frac): string => `${value.n}/${value.d}`;
const gapOf = (a: Frac, b: Frac): Frac => {
  const raw = frac(a.n * b.d - b.n * a.d, a.d * b.d);
  return raw.n < 0n ? { n: -raw.n, d: raw.d } : raw;
};
const ONE_HUNDREDTH = frac(1n, 100n);
const ONE_TENTH = frac(1n, 10n);

/** The numbers a learner reaches for when mixing up the cells of the 2 by 2 grid, each a different thing from the chance asked for. */
function mixUps(counts: Counts, population: number, ask: 'positive' | 'negative'): Array<{ name: string; value: Frac }> {
  const top = ask === 'positive' ? counts.hasPos : counts.hasNeg;
  const other = ask === 'positive' ? counts.lacksPos : counts.lacksNeg;
  return [
    { name: `the share of those who have it that test ${ask}`, value: frac(BigInt(top), BigInt(counts.has)) },
    { name: `the share of those who lack it that test ${ask}`, value: frac(BigInt(other), BigInt(counts.lacks)) },
    { name: 'the chance they lack it', value: frac(BigInt(other), BigInt(top + other)) },
    { name: 'the share who have it before any test', value: frac(BigInt(counts.has), BigInt(population)) },
  ];
}

function bayesKeyIssues(subject: string, answer: Frac, grid: Tree, ask: 'positive' | 'negative', answerKey: unknown): SolvabilityIssue[] {
  const key = asRecord(answerKey);
  if (!key || !Object.keys(key).every((name) => ['target', 'tolerance', 'review'].includes(name))) return [issue('impossible-state', `${subject}: the rubric carries only target, tolerance and review`)];
  const target = readNumber(key.target);
  if (!target) return [issue('impossible-state', `${subject}: the target must be a decimal or a fraction`)];
  const met = hasOnly(key.tolerance, ['absolute']) ? readNumber(key.tolerance.absolute) : null;
  if (!met || compare(met, ZERO) < 0) return [issue('impossible-state', `${subject}: the tolerance must be { absolute } with a number of at least 0`)];
  const issues = coverKey(subject, fraction(answer), fraction(target));
  if (compare(met, ONE_HUNDREDTH) > 0) issues.push(issue('rubric-accepts-invalid', `${subject}: a tolerance wider than 0.01 grades answers that are not the exact chance as right`));
  if (key.review !== undefined) {
    const near = hasOnly(key.review, ['absolute']) ? readNumber(key.review.absolute) : null;
    if (!near) issues.push(issue('impossible-state', `${subject}: the review band must be { absolute } with a number`));
    else if (compare(near, met) <= 0) issues.push(issue('vacuous-rubric', `${subject}: the review band is no wider than the tolerance, so it never fires`));
    else if (compare(near, ONE_TENTH) > 0) issues.push(issue('impossible-state', `${subject}: a review band wider than 0.1 calls far-off answers near`));
  }
  if (compare(target, answer) === 0) {
    for (const mixUp of mixUps(grid.counts, grid.basis.population, ask)) {
      if (compare(mixUp.value, answer) !== 0 && compare(gapOf(mixUp.value, target), met) <= 0) {
        issues.push(issue('rubric-accepts-invalid', `${subject}: ${mixUp.name} (${fraction(mixUp.value)}) lies within the tolerance of the answer, so a learner who mixed up the grid would be graded right`));
      }
    }
  }
  return issues;
}

/*
 * Bayes has one number to type, so the answer is unique and the checker proves what makes it gradable: the chance is computed from
 * whole counts, sits inside 1 in 20 to 19 in 20, and no mix-up of the grid's cells is accepted by the key's tolerance. There is no
 * start state to be solved and no move to be stuck in.
 */
const bayesChecker: SolvabilityChecker = (segment, context) => {
  const subject = `Bayes chance ${segment.id}`;
  const grown = growTree(subject, segment.payload, ['ask']);
  if (isIssue(grown)) return result([grown]);
  const { ask } = segment.payload;
  if (ask !== 'positive' && ask !== 'negative') return failing('impossible-state', `${subject}: the question asks about a positive or a negative result`);
  const top = ask === 'positive' ? grown.counts.hasPos : grown.counts.hasNeg;
  const bottom = ask === 'positive' ? grown.counts.hasPos + grown.counts.lacksPos : grown.counts.hasNeg + grown.counts.lacksNeg;
  const answer = frac(BigInt(top), BigInt(bottom));
  if (compare(answer, frac(1n, 20n)) < 0 || compare(answer, frac(19n, 20n)) > 0) {
    return failing('out-of-bounds', `${subject}: the chance asked for is ${top} in ${bottom}, outside 1 in 20 to 19 in 20, where it cannot be told from certainty by eye`);
  }
  if (context.answerKey === undefined) return result([], { answerNumerator: top, answerDenominator: bottom });
  return result(bayesKeyIssues(subject, answer, grown, ask, context.answerKey), { answerNumerator: top, answerDenominator: bottom });
};

// ---------------------------------------------------------------------------------------------------------------------------------
// prob.regression.v2
// ---------------------------------------------------------------------------------------------------------------------------------

const PLOT_CODES = { size: 'impossible-state', count: 'impossible-state', range: 'out-of-bounds', repeat: 'impossible-state', spread: 'impossible-state' } as const;
const HALF = frac(1n, 2n);
const ONE_TWENTIETH = frac(1n, 20n);
const tenthsOf = (tenths: number): Frac => frac(BigInt(tenths), 10n);

function readRegressionKey(subject: string, answerKey: unknown): { m: Frac; b: Frac; met: Frac; near: Frac | null } | SolvabilityIssue[] {
  const key = asRecord(answerKey);
  if (!key || !Object.keys(key).every((name) => ['family', 'target', 'parameter_tolerance', 'parameter_review'].includes(name)) || key.family !== 'line') {
    return [issue('impossible-state', `${subject}: the rubric is { family: "line", target, parameter_tolerance, parameter_review? } and nothing else`)];
  }
  const m = hasOnly(key.target, ['m', 'b']) ? readNumber(key.target.m) : null;
  const b = hasOnly(key.target, ['m', 'b']) ? readNumber(key.target.b) : null;
  if (!m || !b) return [issue('impossible-state', `${subject}: the target must be { m, b } with decimals or fractions`)];
  const met = hasOnly(key.parameter_tolerance, ['absolute']) ? readNumber(key.parameter_tolerance.absolute) : null;
  if (!met || compare(met, ZERO) < 0) return [issue('impossible-state', `${subject}: parameter_tolerance must be { absolute } with a number of at least 0`)];
  let near: Frac | null = null;
  if (key.parameter_review !== undefined) {
    near = hasOnly(key.parameter_review, ['absolute']) ? readNumber(key.parameter_review.absolute) : null;
    if (!near) return [issue('impossible-state', `${subject}: parameter_review must be { absolute } with a number`)];
  }
  return { m, b, met, near };
}

/*
 * Both sliders move in tenths with no cap, so a line is never stuck and there is no dead end. The best line is found twice: in closed
 * form by the pack and by trying every line the sliders offer, so the checker proves the closed form is the one minimum and that it
 * sits on a slider position the learner can reach exactly.
 */
const regressionChecker: SolvabilityChecker = (segment, context) => {
  const subject = `regression ${segment.id}`;
  const { payload } = segment;
  if (!Object.keys(payload).every((name) => ['size', 'points', 'start'].includes(name))) return failing('impossible-state', `${subject}: the payload carries only the grid size, the points and the start line`);
  const plotted = plotOf(payload);
  if ('problem' in plotted) return failing(PLOT_CODES[plotted.problem], `${subject}: ${plotted.message}`);
  const start = asRecord(payload.start);
  if (!start || Object.keys(start).sort().join() !== 'intercept,slope' || !isInt(start.slope) || !isInt(start.intercept)) return failing('impossible-state', `${subject}: the start line is { slope, intercept } in whole tenths`);
  if (!inProbRange(start.slope, SLOPE_TENTHS.min, SLOPE_TENTHS.max) || !inProbRange(start.intercept, INTERCEPT_TENTHS.min, INTERCEPT_TENTHS.max)) {
    return failing('out-of-bounds', `${subject}: the start line is outside the sliders (slope ${SLOPE_TENTHS.min} to ${SLOPE_TENTHS.max}, intercept ${INTERCEPT_TENTHS.min} to ${INTERCEPT_TENTHS.max} tenths)`);
  }
  const fit = exactFit(plotted.points);
  if (!fit) return failing('no-solution', `${subject}: every point has the same x, so no line is the best line`);
  const slopeTenths = asTenths(fit.slope);
  const interceptTenths = asTenths(fit.intercept);
  if (slopeTenths === null || interceptTenths === null) {
    return failing('no-solution', `${subject}: the best line has slope ${fraction(fit.slope)} and intercept ${fraction(fit.intercept)}, which are not both whole tenths, so no slider position is the best line`);
  }
  if (!inProbRange(slopeTenths, SLOPE_TENTHS.min, SLOPE_TENTHS.max) || !inProbRange(interceptTenths, INTERCEPT_TENTHS.min, INTERCEPT_TENTHS.max)) {
    return failing('out-of-bounds', `${subject}: the best line (slope ${slopeTenths / 10}, intercept ${interceptTenths / 10}) lies outside the sliders (-3 to 3, -5 to 15)`);
  }
  // Try every line the sliders offer and keep the ones with the fewest squares (in hundredths, all whole numbers).
  const budget = new Budget(context.nodeBudget);
  const points: readonly Point[] = plotted.points;
  let least = Number.POSITIVE_INFINITY;
  let best: Array<[number, number]> = [];
  search: for (let slope = SLOPE_TENTHS.min; slope <= SLOPE_TENTHS.max; slope += 1) {
    for (let intercept = INTERCEPT_TENTHS.min; intercept <= INTERCEPT_TENTHS.max; intercept += 1) {
      if (!budget.spend()) break search;
      const squares = points.reduce((total, point) => total + (10 * point.y - slope * point.x - intercept) ** 2, 0);
      if (squares < least) { least = squares; best = [[slope, intercept]]; } else if (squares === least) best.push([slope, intercept]);
    }
  }
  const stats = { nodes: stat(budget), lines: best.length };
  if (budget.exceeded) return result([budgetIssue(subject, stat(budget), 'that one slider line has the fewest squares')], stats);
  if (least === 0) return result([issue('impossible-state', `${subject}: the points all lie on one line, so there are no squares to make small`)], stats);
  if (best.length > 1) return result([issue('ambiguous-solution', `${subject}: ${best.length} slider lines tie for the fewest squares`)], stats);
  if (best[0]![0] !== slopeTenths || best[0]![1] !== interceptTenths) {
    return result([issue('impossible-state', `${subject}: the fewest squares are at slope ${best[0]![0] / 10} and intercept ${best[0]![1] / 10}, not at the closed form best line; the encodings disagree`)], stats);
  }
  const issues: SolvabilityIssue[] = [];
  if (start.slope === slopeTenths && start.intercept === interceptTenths) issues.push(issue('impossible-state', `${subject}: the line starts on the best line, so there is nothing to move`));
  if (context.answerKey !== undefined) {
    const read = readRegressionKey(subject, context.answerKey);
    if (Array.isArray(read)) return result([...issues, ...read], stats);
    const slope = tenthsOf(slopeTenths);
    const intercept = tenthsOf(interceptTenths);
    issues.push(...coverKey(subject, `${fraction(slope)}|${fraction(intercept)}`, `${fraction(read.m)}|${fraction(read.b)}`));
    if (compare(read.met, ONE_TWENTIETH) > 0) issues.push(issue('rubric-accepts-invalid', `${subject}: a tolerance wider than 0.05 grades lines that are not the best line as right`));
    if (read.near !== null) {
      if (compare(read.near, read.met) <= 0) issues.push(issue('vacuous-rubric', `${subject}: the review band is no wider than the tolerance, so it never fires`));
      else if (compare(read.near, HALF) > 0) issues.push(issue('impossible-state', `${subject}: a review band wider than 0.5 calls far-off lines near`));
    }
    // The key is centred on the line it names; count the slider positions inside its tolerance, which must be that one line only.
    const within = (tenths: number, centre: Frac): boolean => compare(gapOf(tenthsOf(tenths), centre), read.met) <= 0;
    const accepted = range(SLOPE_TENTHS.min, SLOPE_TENTHS.max).filter((tenths) => within(tenths, read.m)).length
      * range(INTERCEPT_TENTHS.min, INTERCEPT_TENTHS.max).filter((tenths) => within(tenths, read.b)).length;
    if (accepted > 1) issues.push(issue('rubric-accepts-invalid', `${subject}: the tolerance admits ${accepted} slider lines, so a line that is not the best one is graded right`));
    if (within(start.slope, read.m) && within(start.intercept, read.b)) issues.push(issue('impossible-state', `${subject}: the start line is already inside the tolerance of the target`));
  }
  return result(issues, stats);
};

registerSolvabilityChecker(DOT_PLOT, dotPlotChecker);
registerSolvabilityChecker(BALANCE_POINT, balanceChecker);
registerSolvabilityChecker(NORMAL, normalChecker);
registerSolvabilityChecker(BINOMIAL, binomialChecker);
registerSolvabilityChecker(CLT, cltChecker);
registerSolvabilityChecker(TREE, treeChecker);
registerSolvabilityChecker(BAYES, bayesChecker);
registerSolvabilityChecker(REGRESSION, regressionChecker);
