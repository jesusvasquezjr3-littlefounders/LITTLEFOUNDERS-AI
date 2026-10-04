import {
  asRecord, Budget, budgetIssue, checkRubricCoverage, exploreStateSpace, issue, mergeResults, registerSolvabilityChecker, result, stableKey,
  type SolvabilityChecker, type SolvabilityContext, type SolvabilityIssue, type SolvabilityResult,
} from '../solvability.js';
import { frameCounts } from './golden.js';
import { CHECKS, inRange, LINE_MAX, orderParts, reachableDifferences, reachableLandings, sum } from './num-a.js';
import { arrayAreaAnswer, arrayAreaKind, circleAnswer, circleOp, fractionAnswer, fractionOp, gcd, ratioAnswer, ratioKind } from './num-b.js';

const TEN_FRAME = 'math.ten-frame.v2';
const REKENREK = 'math.rekenrek.v2';
const ABACUS = 'math.abacus.v2';
const EMPTY_LINE = 'math.number-line.empty.v2';
const ZOOM_LINE = 'math.number-line.zoom.v2';
const ORDER_LINE = 'math.number-line.order.v2';
const CLOCK = 'math.clock.v2';
const RULER = 'math.ruler.v2';
const RULER_MEASURE = 'math.ruler.measure.v2';
const PAN_BALANCE = 'math.pan-balance.v2';
const ARRAY_AREA = 'math.array-area.v2';
const RATIO_LINE = 'math.ratio-line.v2';
const FRACTION_WALL = 'math.fraction-wall.v2';
const FRACTION_CIRCLES = 'math.fraction-circles.v2';

const CELLS = 10;
const BEADS = 10;
const FORM_MAX = 999;
const RATIO_ANSWER_MAX = 999 * 12;

interface Move<S> { move: string; next: S }
interface Board<S> { initial: readonly S[]; moves: (state: S) => Move<S>[]; key: (state: S) => string }

const blocked = (subject: string, message: string): SolvabilityResult => result([issue('impossible-state', `${subject}: ${message}`)]);
const targetOf = (answerKey: unknown): unknown => asRecord(answerKey)?.target;
const payloadProblem = (type: string, payload: Record<string, unknown>): string | undefined => CHECKS[type]!.payload(payload, null);
const counts = (value: unknown, length: number, max: number): value is number[] => Array.isArray(value) && value.length === length && value.every((entry) => inRange(entry, 0, max));
const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);

/** Explores the learner's own moves: the goal must be reachable and, with `full`, no reachable board may be cut off from it. */
function prove<S>(subject: string, board: Board<S>, goal: (state: S) => boolean, context: SolvabilityContext, full: boolean): SolvabilityResult {
  const explored = exploreStateSpace<S, string>({ initial: board.initial, moves: board.moves, isGoal: goal, key: board.key, maxNodes: context.nodeBudget, full });
  const stats = { reachable: explored.reachable, nodes: explored.nodes, shortest: explored.shortest ?? 0, goals: explored.goalStates, deadEnds: explored.deadEndCount };
  if (!explored.goalReached) {
    return result([explored.budgetExceeded
      ? budgetIssue(subject, explored.nodes, full ? 'that the target is reachable' : 'that the board can leave its start')
      : issue('no-solution', `${subject}: no sequence of the learner's own moves ${full ? 'reaches the target' : 'leaves the start'}, so the learner cannot succeed`)], stats);
  }
  if (!full) return result([], stats);
  if (!explored.complete) return result([budgetIssue(subject, explored.nodes, 'that no reachable board is a dead end')], stats);
  if (explored.deadEndCount > 0) {
    return result([issue('dead-end', `${subject}: ${explored.deadEndCount} reachable board(s) can never reach the target (for example ${explored.deadEnds[0]}), so one move could strand the learner`)], stats);
  }
  return result([], stats);
}

const awayFrom = <S>(board: Board<S>): ((state: S) => boolean) => {
  const home = board.key(board.initial[0]!);
  return (state) => board.key(state) !== home;
};

const typedKeyIssues = (subject: string, answerKey: unknown, field: string, answer: number): SolvabilityIssue[] => {
  const key = asRecord(answerKey);
  const given = key && Object.keys(key).join() === field ? key[field] : undefined;
  if (typeof given !== 'number' || !Number.isInteger(given)) return [issue('impossible-state', `${subject}: the key must be { ${field} } with ${field} a whole number`)];
  return checkRubricCoverage([String(answer)], new Set([String(given)]), { subject, isSolution: (candidate) => candidate === String(answer) });
};

// Graded by one final state (the key target), so ambiguity cannot arise; the proof is reach, change from the start, and no dead end.
const tenFrameChecker: SolvabilityChecker = (segment, context) => {
  const subject = `ten frame ${segment.id}`;
  const start = segment.payload.start;
  const frames = Array.isArray(start) ? start.length : 0;
  if (frames < 1 || frames > 2 || !frameCounts(start, frames)) return blocked(subject, 'the start must be one or two counts, each a whole number from 0 to 10');
  const board: Board<readonly number[]> = {
    initial: [start],
    key: (state) => state.join(','),
    moves: (state) => {
      if (frames === 1) {
        const moves: Move<readonly number[]>[] = [];
        if (state[0]! < CELLS) moves.push({ move: 'add', next: [state[0]! + 1] });
        if (state[0]! > start[0]!) moves.push({ move: 'remove', next: [state[0]! - 1] });
        return moves;
      }
      return [0, 1].filter((from) => state[from]! >= 1 && state[1 - from]! < CELLS)
        .map((from) => ({ move: `move-${from}`, next: state.map((count, index) => (index === from ? count - 1 : index === 1 - from ? count + 1 : count)) }));
    },
  };
  if (context.answerKey === undefined) return prove(subject, board, awayFrom(board), context, false);
  const target = targetOf(context.answerKey);
  if (!frameCounts(target, frames)) return blocked(subject, 'the key must be { target } with one whole count per frame, each from 0 to 10');
  if (same(target, start)) return blocked(subject, 'the target equals the start, so the board is already solved');
  return prove(subject, board, (state) => same(state, target), context, true);
};

// Graded by one final state (the key target), so ambiguity cannot arise; the proof is reach, change from the start, and no dead end.
const rekenrekChecker: SolvabilityChecker = (segment, context) => {
  const subject = `rekenrek ${segment.id}`;
  const problem = payloadProblem(REKENREK, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const start = segment.payload.start as number[];
  const board: Board<readonly number[]> = {
    initial: [start],
    key: (state) => state.join(','),
    moves: (state) => state.flatMap((count, row) => Array.from({ length: BEADS + 1 }, (_, to) => to).filter((to) => to !== count)
      .map((to) => ({ move: `row-${row}`, next: state.map((value, at) => (at === row ? to : value)) }))),
  };
  if (context.answerKey === undefined) return prove(subject, board, awayFrom(board), context, false);
  const target = targetOf(context.answerKey);
  if (!counts(target, 2, BEADS)) return blocked(subject, 'the key must be { target } with two bead counts, each a whole number from 0 to 10');
  if (same(target, start)) return blocked(subject, 'the target equals the start, so the board is already solved');
  return prove(subject, board, (state) => same(state, target), context, true);
};

const rodNext = (digit: number): number[] => {
  const base = digit >= 5 ? 5 : 0;
  const next = [digit >= 5 ? digit - 5 : digit + 5];
  for (let ones = 0; ones <= 4; ones += 1) if (base + ones !== digit) next.push(base + ones);
  return next;
};

// Graded by one final state (the key target), so ambiguity cannot arise; rods move independently, so each rod is proved on its own ten digits.
const abacusChecker: SolvabilityChecker = (segment, context) => {
  const subject = `abacus ${segment.id}`;
  const problem = payloadProblem(ABACUS, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const start = segment.payload.start as number[];
  if (context.answerKey === undefined) {
    const board: Board<readonly number[]> = {
      initial: [start],
      key: (state) => state.join(','),
      moves: (state) => state.flatMap((digit, rod) => rodNext(digit).map((to) => ({ move: `rod-${rod}`, next: state.map((value, at) => (at === rod ? to : value)) }))),
    };
    return prove(subject, board, awayFrom(board), context, false);
  }
  const target = targetOf(context.answerKey);
  if (!counts(target, start.length, 9)) return blocked(subject, 'the key must be { target } with one digit from 0 to 9 per rod of the start');
  if (same(target, start)) return blocked(subject, 'the target equals the start, so the board is already solved');
  const rod: Board<number> = { initial: Array.from({ length: 10 }, (_, digit) => digit), key: String, moves: (digit) => rodNext(digit).map((next) => ({ move: 'rod', next })) };
  const parts: SolvabilityResult[] = [];
  let spent = 0;
  for (const digit of new Set(target)) {
    const room = context.nodeBudget - spent;
    if (room < 1) return result([budgetIssue(subject, spent, 'that every rod reaches its digit')], { nodes: spent });
    const one = prove(subject, rod, (state) => state === digit, { ...context, nodeBudget: room }, true);
    spent += one.stats?.nodes ?? 0;
    parts.push(one);
    if (!one.ok) break;
  }
  return mergeResults(...parts);
};

interface Landing { pos: number; used: number }

// Graded by the landing spot alone (any jump list ending there counts), so the proof is reach, change from the start, and the Undo/Reset escape from a full jump cap.
const emptyLineChecker: SolvabilityChecker = (segment, context) => {
  const subject = `empty number line ${segment.id}`;
  const problem = payloadProblem(EMPTY_LINE, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { start, sizes, max } = segment.payload as { start: number; sizes: number[]; max: number };
  const origin: Landing = { pos: start, used: 0 };
  const board: Board<Landing> = {
    initial: [origin],
    key: (state) => `${state.pos},${state.used}`,
    moves: (state) => {
      const moves: Move<Landing>[] = [];
      if (state.used < max) {
        for (const size of sizes) for (const sign of [-1, 1]) {
          const pos = state.pos + sign * size;
          if (pos >= 0 && pos <= LINE_MAX) moves.push({ move: `jump-${sign * size}`, next: { pos, used: state.used + 1 } });
        }
      }
      if (state.used > 0) moves.push({ move: 'reset', next: origin });
      return moves;
    },
  };
  if (context.answerKey === undefined) return prove(subject, board, (state) => state.pos !== start, context, false);
  const target = targetOf(context.answerKey);
  if (!inRange(target, 0, LINE_MAX)) return blocked(subject, 'the key must be { target } with target a whole number from 0 to 1000');
  if (target === start) return blocked(subject, 'the target equals the start, so the board is already solved');
  if (!reachableLandings(start, sizes, max).has(target)) return result([issue('no-solution', `${subject}: no list of at most ${max} jumps of those sizes lands on ${target}, so the learner cannot succeed`)]);
  return prove(subject, board, (state) => state.pos === target, context, true);
};

interface Zoom { level: number; units: number; anchors: readonly number[] }

function zoomBoard(low: number, high: number, depth: number, start: number): Board<Zoom> {
  const min = low * 10 ** depth;
  const max = high * 10 ** depth;
  const tickOf = (level: number) => 10 ** (depth - level);
  const windowOf = (state: Zoom) => {
    if (state.level === 0) return { from: min, to: max };
    const parent = tickOf(state.level - 1);
    const centre = state.anchors[state.level - 1] ?? state.units;
    return { from: Math.max(min, centre - parent), to: Math.min(max, centre + parent) };
  };
  const snap = (state: Zoom, units: number) => {
    const tick = tickOf(state.level);
    const { from, to } = windowOf(state);
    return Math.min(Math.floor(to / tick) * tick, Math.max(Math.ceil(from / tick) * tick, Math.round(units / tick) * tick));
  };
  return {
    initial: [{ level: 0, units: start * 10 ** depth, anchors: [] }],
    key: (state) => `${state.level}|${state.units}|${state.anchors.join(',')}`,
    moves: (state) => {
      const tick = tickOf(state.level);
      const { from, to } = windowOf(state);
      const moves: Move<Zoom>[] = [];
      for (const units of [state.units - tick, state.units + tick]) if (units >= from && units <= to) moves.push({ move: 'step', next: { ...state, units } });
      if (state.level < depth) moves.push({ move: 'zoom-in', next: { level: state.level + 1, units: state.units, anchors: [...state.anchors.slice(0, state.level), state.units] } });
      if (state.level > 0) {
        const level = state.level - 1;
        const coarse = tickOf(level);
        const out: Zoom = { level, units: Math.round(state.units / coarse) * coarse, anchors: state.anchors.slice(0, level) };
        moves.push({ move: 'zoom-out', next: { ...out, units: snap(out, out.units) } });
      }
      return moves;
    },
  };
}

// Graded by the marker's position alone (at any zoom level), so the proof is reach through the stepper and the zoom buttons, change from the start, and no dead end.
const zoomChecker: SolvabilityChecker = (segment, context) => {
  const subject = `zoom number line ${segment.id}`;
  const problem = payloadProblem(ZOOM_LINE, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { low, high, depth, start } = segment.payload as { low: number; high: number; depth: number; start: number };
  const board = zoomBoard(low, high, depth, start);
  const home = start * 10 ** depth;
  if (context.answerKey === undefined) return prove(subject, board, (state) => state.units !== home, context, false);
  const target = targetOf(context.answerKey);
  if (!inRange(target, low * 10 ** depth, high * 10 ** depth)) return blocked(subject, 'the key must be { target } with target a whole number of the finest grid inside the window');
  if (target === home) return blocked(subject, 'the target equals the start, so the board is already solved');
  return prove(subject, board, (state) => state.units === target, context, true);
};

interface Hands { hour: number; minute: number }

// Graded by the time shown (minutes after 12:00), so the proof is reach through the hour and minute steppers, change from the start, and no dead end.
const clockChecker: SolvabilityChecker = (segment, context) => {
  const subject = `clock ${segment.id}`;
  const problem = payloadProblem(CLOCK, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { start, step } = segment.payload as { start: number; step: number };
  const minutesOf = (hands: Hands) => (hands.hour % 12) * 60 + hands.minute;
  const board: Board<Hands> = {
    initial: [{ hour: Math.floor(start / 60) % 12 || 12, minute: start % 60 }],
    key: (state) => `${state.hour}:${state.minute}`,
    moves: (state) => {
      const moves: Move<Hands>[] = [];
      if (state.hour > 1) moves.push({ move: 'hour-less', next: { ...state, hour: state.hour - 1 } });
      if (state.hour < 12) moves.push({ move: 'hour-more', next: { ...state, hour: state.hour + 1 } });
      if (state.minute - step >= 0) moves.push({ move: 'minute-less', next: { ...state, minute: state.minute - step } });
      if (state.minute + step <= 60 - step) moves.push({ move: 'minute-more', next: { ...state, minute: state.minute + step } });
      return moves;
    },
  };
  if (context.answerKey === undefined) return prove(subject, board, (state) => minutesOf(state) !== start, context, false);
  const target = targetOf(context.answerKey);
  if (!inRange(target, 0, 719) || (target % 60) % step !== 0) return blocked(subject, 'the key must be { target } with target a time from 0 to 719 minutes whose minute part is a multiple of the step');
  if (target === start) return blocked(subject, 'the target equals the start, so the board is already solved');
  return prove(subject, board, (state) => minutesOf(state) === target, context, true);
};

// Graded by the mark the bar ends on, so the proof is reach through the end stepper, change from the start, and no dead end.
const rulerChecker: SolvabilityChecker = (segment, context) => {
  const subject = `ruler ${segment.id}`;
  const problem = payloadProblem(RULER, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { from, start, max } = segment.payload as { from: number; start: number; max: number };
  const board: Board<number> = {
    initial: [start],
    key: String,
    moves: (end) => [...(end > from ? [{ move: 'shorter', next: end - 1 }] : []), ...(end < max ? [{ move: 'longer', next: end + 1 }] : [])],
  };
  if (context.answerKey === undefined) return prove(subject, board, (end) => end !== start, context, false);
  const target = targetOf(context.answerKey);
  if (!inRange(target, from + 1, max)) return blocked(subject, 'the key must be { target } with target a whole mark after the bar start and on the ruler');
  if (target === start) return blocked(subject, 'the target equals the start, so the board is already solved');
  return prove(subject, board, (end) => end === target, context, true);
};

// The payload fixes the one answer (far mark minus near mark), so the proof reads it from the payload alone and the key must be exactly that text.
const rulerMeasureChecker: SolvabilityChecker = (segment, context) => {
  const subject = `ruler reading ${segment.id}`;
  const problem = payloadProblem(RULER_MEASURE, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { from, to, max } = segment.payload as { from: number; to: number; max: number };
  const answer = to - from;
  const board: Board<number> = {
    initial: [0],
    key: String,
    moves: (length) => [...(length > 0 ? [{ move: 'less', next: length - 1 }] : []), ...(length < max ? [{ move: 'more', next: length + 1 }] : [])],
  };
  const proof = prove(subject, board, (length) => length === answer, context, true);
  if (context.answerKey === undefined || !proof.ok) return proof;
  const given = targetOf(context.answerKey);
  if (typeof given !== 'string') return mergeResults(proof, blocked(subject, 'the key must be { target } with target the length as text'));
  return mergeResults(proof, result(checkRubricCoverage([String(answer)], new Set([given]), { subject, isSolution: (candidate) => candidate === String(answer) })));
};

// Several placements are accepted by design (graded by left minus right), so the proof is that the key difference is reachable, differs from the all-in-tray start, and nothing strands the learner.
const panBalanceChecker: SolvabilityChecker = (segment, context) => {
  const subject = `pan balance ${segment.id}`;
  const problem = payloadProblem(PAN_BALANCE, segment.payload);
  if (problem !== undefined) return blocked(subject, problem);
  const { left, right, weights } = segment.payload as { left: number[]; right: number[]; weights: number[] };
  const base = sum(left) - sum(right);
  const differenceOf = (spots: readonly number[]) => base + spots.reduce((total, spot, index) => total + (spot === 1 ? weights[index]! : spot === 2 ? -weights[index]! : 0), 0);
  const board: Board<readonly number[]> = {
    initial: [weights.map(() => 0)],
    key: (state) => state.join(''),
    moves: (state) => state.flatMap((spot, index) => [0, 1, 2].filter((to) => to !== spot).map((to) => ({ move: `weight-${index}`, next: state.map((value, at) => (at === index ? to : value)) }))),
  };
  if (context.answerKey === undefined) return prove(subject, board, (state) => differenceOf(state) !== base, context, false);
  const target = targetOf(context.answerKey);
  if (typeof target !== 'number' || !Number.isInteger(target)) return blocked(subject, 'the key must be { target } with target a whole number: the left total minus the right total');
  if (target === base) return blocked(subject, 'the target equals the difference with every loose weight in the tray, so the board is already solved');
  if (!reachableDifferences(base, weights).has(target)) return result([issue('no-solution', `${subject}: no placement of the loose weights makes a difference of ${target}, so the learner cannot succeed`)]);
  return prove(subject, board, (state) => differenceOf(state) === target, context, true);
};

type Placement = Readonly<Record<number, number>>;

function placed(state: Placement, units: number, mark: number): Placement {
  const next: Record<number, number> = { ...state };
  const occupant = Object.keys(state).map(Number).find((other) => state[other] === mark);
  if (occupant !== undefined && occupant !== units) {
    if (state[units] === undefined) delete next[occupant];
    else next[occupant] = state[units]!;
  }
  next[units] = mark;
  return next;
}

const isSlotMap = (value: unknown): boolean => {
  const map = asRecord(value);
  return !!map && Object.values(map).every((pieces) => Array.isArray(pieces) && pieces.every((piece) => typeof piece === 'string'));
};

// The numbers force one arrangement; the search follows direct placements (a numbered piece is never displaced by a placement on another mark, so every board can still finish), and the key must list exactly that arrangement.
const orderChecker: SolvabilityChecker = (segment, context) => {
  const subject = `order line ${segment.id}`;
  const parts = orderParts(segment.payload);
  if (!parts) return blocked(subject, 'the payload needs a scale of 0, 1 or 2, four to twenty equal gaps, and two to six distinct numbers that each sit on a mark of the window');
  const markOf = (units: number) => (units - parts.low) / parts.step;
  const truth = Object.fromEntries(parts.values.map((units) => [`m-${markOf(units)}`, [`n-${units}`]]));
  const board: Board<Placement> = {
    initial: [{}],
    key: (state) => parts.values.map((units) => state[units] ?? '-').join(','),
    moves: (state) => parts.values.filter((units) => state[units] !== markOf(units)).map((units) => ({ move: `place-${units}`, next: placed(state, units, markOf(units)) })),
  };
  const proof = prove(subject, board, (state) => parts.values.every((units) => state[units] === markOf(units)), context, true);
  if (context.answerKey === undefined || !proof.ok) return proof;
  const solutions = asRecord(context.answerKey)?.solutions;
  if (!Array.isArray(solutions) || !solutions.every(isSlotMap)) return mergeResults(proof, blocked(subject, 'the key must be { solutions: [slotMap] } where a slot map lists the pieces of each mark'));
  const wanted = stableKey(truth);
  const issues: SolvabilityIssue[] = [];
  if (solutions.length > 1) issues.push(issue('ambiguous-solution', `${subject}: the key accepts ${solutions.length} arrangements but the numbers force exactly one`));
  issues.push(...checkRubricCoverage([wanted], new Set(solutions.map((solution) => stableKey(solution))), { subject, isSolution: (candidate) => candidate === wanted }));
  return mergeResults(proof, result(issues));
};

/** Counts the answer the way a learner would, spending one step per row, cell or repeated subtraction; null when the budget ran out. */
function countedAnswer(kind: string, payload: Record<string, number>, budget: Budget): number | null {
  if (kind === 'array') {
    let cells = 0;
    for (let row = 0; row < payload.rows!; row += 1) for (let column = 0; column < payload.columns!; column += 1) {
      if (!budget.spend()) return null;
      cells += 1;
    }
    return cells;
  }
  if (kind === 'area-model') {
    let area = 0;
    for (let row = 0; row < payload.down!; row += 1) {
      if (!budget.spend()) return null;
      area += payload.across!;
    }
    return area;
  }
  let left = payload.dividend!;
  let times = 0;
  while (left >= payload.divisor!) {
    if (!budget.spend()) return null;
    left -= payload.divisor!;
    times += 1;
  }
  return left === 0 ? times : -1;
}

// Typed value is the one answer (nothing else is graded), so the proof is that counting the payload the learner's way gives the pack's answer and the key is exactly it.
const arrayAreaChecker: SolvabilityChecker = (segment, context) => {
  const subject = `array and area ${segment.id}`;
  const kind = arrayAreaKind(segment.payload);
  const answer = arrayAreaAnswer(segment.payload);
  if (kind === null || answer === null) return blocked(subject, 'the payload must be an array {rows, columns}, an area model {across, down} or a missing-area division {dividend, divisor}');
  const budget = new Budget(context.nodeBudget);
  const counted = countedAnswer(kind, segment.payload as Record<string, number>, budget);
  if (counted === null) return result([budgetIssue(subject, budget.limit, 'that the answer can be counted')], { nodes: budget.limit });
  if (counted !== answer || counted < 1) return result([issue('no-solution', `${subject}: counting the payload gives ${counted}, not the answer the pack derives (${answer}), so the learner cannot succeed`)], { nodes: budget.used });
  return result(context.answerKey === undefined ? [] : typedKeyIssues(subject, context.answerKey, 'value', answer), { nodes: budget.used });
};

// Typed value is the one answer: the search over every value the payload bounds allow must find exactly the pack's answer.
const ratioChecker: SolvabilityChecker = (segment, context) => {
  const subject = `ratio line ${segment.id}`;
  const kind = ratioKind(segment.payload);
  const answer = ratioAnswer(segment.payload);
  if (kind === null || answer === null) return blocked(subject, 'the payload must be a double number line {units, base, given} or a ratio tape {unit, parts, whole, ask}');
  const payload = segment.payload as { base: [number, number]; given: { line: 'top' | 'bottom'; value: number }; parts: [number, number]; whole: number; ask: 'a' | 'b' };
  const holds = kind === 'double-number-line'
    ? (value: number) => value * payload.base[payload.given.line === 'top' ? 0 : 1] === payload.given.value * payload.base[payload.given.line === 'top' ? 1 : 0]
    : (value: number) => value * (payload.parts[0] + payload.parts[1]) === payload.whole * payload.parts[payload.ask === 'a' ? 0 : 1];
  const budget = new Budget(context.nodeBudget);
  const found: number[] = [];
  for (let value = 1; value <= RATIO_ANSWER_MAX; value += 1) {
    if (!budget.spend()) return result([budgetIssue(subject, budget.limit, 'that exactly one value fits the ratio')], { nodes: budget.limit });
    if (holds(value)) found.push(value);
  }
  if (found.length === 0) return result([issue('no-solution', `${subject}: no whole value fits the ratio, so the learner cannot succeed`)], { nodes: budget.used });
  if (found.length > 1) return result([issue('ambiguous-solution', `${subject}: ${found.length} values fit the ratio, so the typed answer is not unique`)], { nodes: budget.used });
  if (found[0] !== answer) return result([issue('no-solution', `${subject}: the value that fits the ratio (${found[0]}) is not the answer the pack derives (${answer})`)], { nodes: budget.used });
  return result(context.answerKey === undefined ? [] : typedKeyIssues(subject, context.answerKey, 'value', answer), { nodes: budget.used });
};

/** Every {n, d} a learner can enter that the grader accepts: the exact form, or any form of the same value. */
function acceptedForms(answer: { n: number; d: number }, exact: boolean, budget: Budget): Array<{ n: number; d: number }> | null {
  const forms: Array<{ n: number; d: number }> = [];
  for (let d = 1; d <= FORM_MAX; d += 1) {
    if (!budget.spend()) return null;
    if ((answer.n * d) % answer.d !== 0) continue;
    const n = (answer.n * d) / answer.d;
    if (n >= 1 && n <= FORM_MAX && (!exact || (n === answer.n && d === answer.d))) forms.push({ n, d });
  }
  return forms;
}

const reduced = (n: number, d: number): string => `${n / gcd(n, d)}/${d / gcd(n, d)}`;

function fractionChecker(label: string, answerOf: (payload: unknown) => { n: number; d: number } | null, exactOf: (payload: unknown) => boolean, shape: string): SolvabilityChecker {
  // The untouched response {0,0} is incomplete and a key needs n, d of 1 or more, so the start is never already solved; typing is always available to the learner.
  return (segment, context) => {
    const subject = `${label} ${segment.id}`;
    const answer = answerOf(segment.payload);
    if (answer === null) return blocked(subject, shape);
    const exact = exactOf(segment.payload);
    const budget = new Budget(context.nodeBudget);
    const forms = acceptedForms(answer, exact, budget);
    if (forms === null) return result([budgetIssue(subject, budget.limit, 'that the answer can be typed')], { nodes: budget.limit });
    if (forms.length === 0) return result([issue('no-solution', `${subject}: the answer ${answer.n}/${answer.d} cannot be entered with a numerator and denominator from 1 to ${FORM_MAX}, so the learner cannot succeed`)], { nodes: budget.used });
    const stats = { nodes: budget.used, forms: forms.length };
    if (context.answerKey === undefined) return result([], stats);
    const key = asRecord(context.answerKey);
    const n = key && Object.keys(key).sort().join() === 'd,n' ? key.n : undefined;
    const d = key ? key.d : undefined;
    if (!inRange(n, 1, FORM_MAX) || !inRange(d, 1, FORM_MAX)) return result([issue('impossible-state', `${subject}: the key must be { n, d }, both whole numbers from 1 to ${FORM_MAX}`)], stats);
    const wanted = exact ? `${answer.n}/${answer.d}` : reduced(answer.n, answer.d);
    const given = exact ? `${n}/${d}` : reduced(n, d);
    return result(checkRubricCoverage([wanted], new Set([given]), { subject, isSolution: (candidate) => candidate === wanted }), stats);
  };
}

const wallShape = 'the payload must be one fraction task: equivalent {op, fraction, denominator}, or add, subtract, multiply or divide {op, left, right} with proper fractions and a positive result';
const circleShape = 'the payload must be one circles task: show {op, fraction}, or compare, add or subtract {op, left, right} with proper fractions over one shared denominator';

const CHECKERS: Readonly<Record<string, SolvabilityChecker>> = {
  [TEN_FRAME]: tenFrameChecker,
  [REKENREK]: rekenrekChecker,
  [ABACUS]: abacusChecker,
  [EMPTY_LINE]: emptyLineChecker,
  [ZOOM_LINE]: zoomChecker,
  [ORDER_LINE]: orderChecker,
  [CLOCK]: clockChecker,
  [RULER]: rulerChecker,
  [RULER_MEASURE]: rulerMeasureChecker,
  [PAN_BALANCE]: panBalanceChecker,
  [ARRAY_AREA]: arrayAreaChecker,
  [RATIO_LINE]: ratioChecker,
  [FRACTION_WALL]: fractionChecker('fraction wall', fractionAnswer, (payload) => fractionOp(payload) === 'equivalent', wallShape),
  [FRACTION_CIRCLES]: fractionChecker('fraction circles', circleAnswer, (payload) => circleOp(payload) === 'show', circleShape),
};

for (const [type, checker] of Object.entries(CHECKERS)) registerSolvabilityChecker(type, checker);
