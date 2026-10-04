import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';
import {
  checkPointSpacing, checkReferences, checkUniqueIds, issue, registerSolvabilityChecker, result, searchAssignments, stableKey, verifyUniqueOrCovered,
  type SearchResult, type SolvabilityChecker, type SolvabilityContext, type SolvabilityIssue, type SolvabilityResult,
} from '../solvability.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const FIN2_CAPABILITIES = {
  'money.cash-flow.v2': ['visual.statement-board.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1'],
  'reasoning.decision-grid.v2': ['visual.decision-grid.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1'],
  'plan.schedule-board.v2': ['visual.schedule-board.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1'],
} as const;

const CASH_FLOW = 'money.cash-flow.v2';
const GRID = 'reasoning.decision-grid.v2';
const SCHEDULE = 'plan.schedule-board.v2';

const FIN2_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: CASH_FLOW,
    lines: [
      `${CASH_FLOW}: ages 13-17 and the adult pathway only. 5 to 12 items, each a whole amount from 1 to 999999; the labels name every item and nothing else. The prompt is one imperative sentence that asks the learner to sort the month and say if passive income beats expenses, never the verdict.`,
      `${CASH_FLOW}: earned is pay for time, passive is money that arrives without trading hours (rent, dividends, royalties, interest), expenses are monthly costs, assets are what is owned and liabilities what is owed. Assets and liabilities are values, never added to the monthly lines.`,
      `${CASH_FLOW}: the key lists each item once and a goal token: goal-met only when the passive total is greater than the expenses total, goal-short otherwise. Equal totals are goal-short. Write both outcomes across a course, not one.`,
    ],
  },
  {
    type: GRID,
    lines: [
      `${GRID}: ages 12-17 and the adult pathway only. One piece for five shapes, chosen by the visual: swot, eisenhower, two-by-two, decision-matrix, business-canvas. The labels name every piece (and every criterion, and the six axis names of a two-by-two) and nothing else.`,
      `${GRID}: swot and eisenhower take 4 to 16 pieces, a business-canvas 5 to 16, a two-by-two 4 to 12 with one point per piece (two whole numbers from 1 to 9, never 5), a decision-matrix 2 to 5 options with 2 to 4 weighted criteria (weight 1 to 5, scores 1 to 5, no two weighted totals equal).`,
      `${GRID}: the key is { solutions } and places every piece exactly once. A two-by-two key is the quadrant each point falls in, and a decision-matrix key ranks the options highest weighted total first (rank-1 down); both are computed, so the key must equal them. The prompt names the goal as a board state, never the placement.`,
    ],
  },
  {
    type: SCHEDULE,
    lines: [
      `${SCHEDULE}: ages 12-17 and the adult pathway only. The visual is gantt, kanban or timeline. 3 to 10 tasks, each with at most 3 prerequisites that name other tasks, and no cycles. The labels name every task and nothing else.`,
      `${SCHEDULE}: a gantt gives every task a duration of 1 to 4 periods, 3 to 10 periods and optionally 1 to 3 workers, and the longest chain must fit the deadline; a timeline gives no durations and may give a due step; a kanban gives a done list, a work-in-progress limit of 1 to 4, at least one task that can start now (never more than the limit) and at least one still blocked.`,
      `${SCHEDULE}: a gantt and a timeline accept every schedule that keeps the order, the deadline and the workers, so the key lists one or more valid schedules and each must be valid. A kanban has one board (what can start now in doing, the rest in todo) and the key must equal it. The prompt asks for a plan state, such as meet every deadline, and never names the order.`,
    ],
  },
];

type Rec = Record<string, unknown>;
type Slots = Record<string, string[]>;
interface Frame { pieceIds: string[]; slotIds: string[]; capacities: Record<string, number> }

const ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;
const record = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const whole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const sorted = (list: readonly string[]): string[] => [...list].sort();
const placedIn = (slots: Slots): string[] => Object.values(slots).flat();

function keysAre(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Rec {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

const idList = (value: unknown, min: number, max: number): value is string[] =>
  Array.isArray(value) && value.length >= min && value.length <= max && value.every(isId) && new Set(value).size === value.length;

const sameKeys = (value: Rec, keys: readonly string[]): boolean => {
  const have = Object.keys(value);
  return have.length === keys.length && keys.every((key) => have.includes(key));
};

const canon = (slots: Slots): string =>
  stableKey(Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0).map(([slot, pieces]) => [slot, sorted(pieces)])));

function arrange(pieces: readonly string[], slotOf: readonly string[]): Slots {
  const slots: Slots = {};
  pieces.forEach((piece, index) => { (slots[slotOf[index]!] ??= []).push(piece); });
  return slots;
}

const MAX_SOLUTIONS = 8;
const MAX_KEY_PIECES = 16;

/** The private key, as Core's arrangement parser reads it: whole arrangements inside the frame, every piece placed at most once. */
function keyShapeProblem(frame: Frame, key: unknown): string | null {
  if (!keysAre(key, ['solutions']) || !Array.isArray(key.solutions) || key.solutions.length < 1 || key.solutions.length > MAX_SOLUTIONS) return 'The key is { solutions }: one to eight arrangements';
  for (const solution of key.solutions as unknown[]) {
    if (!record(solution)) return 'Each key solution maps a slot to a list of pieces';
    const used = new Set<string>();
    let total = 0;
    for (const [slot, pieces] of Object.entries(solution)) {
      if (!frame.slotIds.includes(slot)) return `A key solution names a slot this board does not have: ${slot}`;
      if (!Array.isArray(pieces) || pieces.length > (frame.capacities[slot] ?? 1) || pieces.length > MAX_KEY_PIECES) return `A key solution holds the slot ${slot} within its capacity`;
      for (const piece of pieces) {
        if (typeof piece !== 'string' || !frame.pieceIds.includes(piece)) return `A key solution places a piece this board does not have in ${slot}`;
        if (used.has(piece)) return 'A key solution places each piece once';
        used.add(piece);
        total += 1;
      }
    }
    if (total === 0) return 'A key solution places at least one piece';
  }
  return null;
}

const solutionsOf = (key: unknown): Slots[] => (key as { solutions: Slots[] }).solutions;

// Statement board (F2.13): hand-mirrored from backend/src/services/horizonte/fin2/statement.ts.
const LINES = ['earned', 'passive', 'expenses', 'assets', 'liabilities'] as const;
const GOAL = 'goal';
const GOAL_MET = 'goal-met';
const GOAL_SHORT = 'goal-short';
const MAX_AMOUNT = 999_999;
interface Item { id: string; amount: number }

function statementProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['items']) || !Array.isArray(payload.items)) return 'A statement payload holds only its items';
  const items = payload.items as unknown[];
  if (items.length < 5 || items.length > 12) return 'A statement has 5 to 12 items';
  const seen = new Set<string>();
  for (const item of items) {
    if (!keysAre(item, ['id', 'amount']) || !isId(item.id) || !whole(item.amount, 1, MAX_AMOUNT)) return 'Each item has an id and a whole amount per month';
    if (item.id === GOAL_MET || item.id === GOAL_SHORT || item.id === GOAL || seen.has(item.id)) return 'Item ids are unique and never a goal token';
    seen.add(item.id);
  }
  return null;
}

function statementFrame(payload: unknown): Frame | null {
  if (statementProblem(payload) !== null) return null;
  const items = (payload as { items: Item[] }).items;
  return {
    pieceIds: [...items.map((item) => item.id), GOAL_MET, GOAL_SHORT],
    slotIds: [...LINES, GOAL],
    capacities: { ...Object.fromEntries(LINES.map((line) => [line, items.length])), [GOAL]: 1 },
  };
}

const statementLabelsProblem = (payload: unknown, labels: unknown): string | null =>
  statementProblem(payload) === null && record(labels) && sameKeys(labels, (payload as { items: Item[] }).items.map((item) => item.id)) ? null : 'Labels name every item, and nothing else';

function lineTotal(slots: Slots, line: string, items: readonly Item[]): number {
  const amount = new Map(items.map((item) => [item.id, item.amount]));
  return (slots[line] ?? []).reduce((total, id) => total + (amount.get(id) ?? 0), 0);
}

function statementKeyProblem(payload: unknown, solutions: readonly Slots[]): string | null {
  if (statementProblem(payload) !== null) return 'The statement payload is malformed';
  const items = (payload as { items: Item[] }).items;
  const wanted = sorted(items.map((item) => item.id));
  for (const solution of solutions) {
    const placed = sorted(placedIn(Object.fromEntries(Object.entries(solution).filter(([slot]) => slot !== GOAL))));
    if (placed.length !== wanted.length || placed.some((id, index) => id !== wanted[index])) return 'A solution places every item on exactly one line';
    const tokens = solution[GOAL] ?? [];
    const token = lineTotal(solution, 'passive', items) > lineTotal(solution, 'expenses', items) ? GOAL_MET : GOAL_SHORT;
    if (tokens.length !== 1 || tokens[0] !== token) return 'A solution names the goal token its own totals give';
  }
  return null;
}

// Decision grid (F2.14): hand-mirrored from backend/src/services/horizonte/fin2/matrix.ts.
const GRID_VISUALS = ['swot', 'eisenhower', 'two-by-two', 'decision-matrix', 'business-canvas'] as const;
type GridVisual = (typeof GRID_VISUALS)[number];
const GRID_SLOTS = {
  swot: ['strengths', 'weaknesses', 'opportunities', 'threats'],
  eisenhower: ['do-now', 'schedule', 'delegate', 'drop'],
  'two-by-two': ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  'business-canvas': ['partners', 'activities', 'resources', 'value', 'relationships', 'channels', 'segments', 'costs', 'revenue'],
} as const satisfies Record<string, readonly string[]>;
const AXES = ['x-name', 'y-name', 'x-low', 'x-high', 'y-low', 'y-high'] as const;
const GRID_MAX = 16;
const PIECE_RANGE: Record<GridVisual, readonly [number, number]> = {
  swot: [4, GRID_MAX], eisenhower: [4, GRID_MAX], 'two-by-two': [4, 12], 'decision-matrix': [2, 5], 'business-canvas': [5, GRID_MAX],
};
interface Criterion { id: string; weight: number }
interface Grid { pieces: string[]; points?: Array<[number, number]>; criteria?: Criterion[]; scores?: number[][] }

const isGridVisual = (value: unknown): value is GridVisual => typeof value === 'string' && (GRID_VISUALS as readonly string[]).includes(value);
const rankSlot = (rank: number): string => `rank-${rank}`;

const weightedTotals = (grid: Grid): number[] =>
  (grid.scores ?? []).map((row) => row.reduce((sum, score, index) => sum + score * (grid.criteria?.[index]?.weight ?? 0), 0));

/** `ties` lets a decision matrix with equal totals through so the solvability search, not the payload rule, names the ambiguity. */
function gridProblem(visual: unknown, payload: unknown, ties = false): string | null {
  if (!isGridVisual(visual)) return 'Unknown grid visual';
  if (!record(payload) || !idList(payload.pieces, ...PIECE_RANGE[visual])) return `A ${visual} grid has ${PIECE_RANGE[visual][0]} to ${PIECE_RANGE[visual][1]} unique pieces`;
  const count = payload.pieces.length;
  const extra = ['points', 'criteria', 'scores'].filter((key) => payload[key] !== undefined);
  if (visual === 'two-by-two') {
    if (!keysAre(payload, ['pieces', 'points'])) return 'A two-by-two grid carries pieces and one point per piece';
    const points = payload.points;
    if (!Array.isArray(points) || points.length !== count) return 'A two-by-two grid carries one point per piece';
    if (!points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => whole(value, 1, 9) && value !== 5))) return 'Each point is two whole numbers from 1 to 9, never 5';
    return null;
  }
  if (visual === 'decision-matrix') {
    if (!keysAre(payload, ['pieces', 'criteria', 'scores'])) return 'A decision matrix carries pieces, criteria and scores';
    const { criteria, scores } = payload;
    if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 4) return 'A decision matrix has 2 to 4 criteria';
    if (!criteria.every((criterion) => keysAre(criterion, ['id', 'weight']) && isId(criterion.id) && whole(criterion.weight, 1, 5))) return 'Each criterion has an id and a weight from 1 to 5';
    const ids = [...(payload.pieces as string[]), ...criteria.map((criterion) => (criterion as Criterion).id)];
    if (new Set(ids).size !== ids.length) return 'Piece and criterion ids are all different';
    if (!Array.isArray(scores) || scores.length !== count || !scores.every((row) => Array.isArray(row) && row.length === criteria.length && row.every((cell) => whole(cell, 1, 5)))) return 'Scores are a whole number from 1 to 5 for every option and criterion';
    const totals = weightedTotals(payload as unknown as Grid);
    return ties || new Set(totals).size === totals.length ? null : 'Weighted totals must all differ so the ranking is not a tie';
  }
  if (!keysAre(payload, ['pieces']) || extra.length > 0) return `A ${visual} grid carries only its pieces`;
  return null;
}

function gridSlotIds(visual: GridVisual, grid: Grid): string[] {
  return visual === 'decision-matrix' ? grid.pieces.map((_, index) => rankSlot(index + 1)) : [...GRID_SLOTS[visual]];
}

function gridFrame(visual: unknown, payload: unknown, ties = false): Frame | null {
  if (gridProblem(visual, payload, ties) !== null || !isGridVisual(visual)) return null;
  const grid = payload as Grid;
  const slotIds = gridSlotIds(visual, grid);
  return { pieceIds: [...grid.pieces], slotIds, capacities: Object.fromEntries(slotIds.map((slot) => [slot, visual === 'decision-matrix' ? 1 : grid.pieces.length])) };
}

const quadrantOf = ([x, y]: readonly [number, number]): string => `${y > 5 ? 'top' : 'bottom'}-${x > 5 ? 'right' : 'left'}`;

/** The one correct arrangement of a computed grid (two-by-two, decision matrix); null when the key is authored. */
function gridExpected(visual: unknown, payload: unknown): Slots | null {
  if (gridProblem(visual, payload) !== null) return null;
  const grid = payload as Grid;
  if (visual === 'two-by-two') return arrange(grid.pieces, grid.points!.map(quadrantOf));
  if (visual === 'decision-matrix') {
    const totals = weightedTotals(grid);
    const order = grid.pieces.map((_, index) => index).sort((a, b) => totals[b]! - totals[a]!);
    return Object.fromEntries(order.map((index, place) => [rankSlot(place + 1), [grid.pieces[index]!]]));
  }
  return null;
}

function gridLabelsProblem(visual: unknown, payload: unknown, labels: unknown): string | null {
  if (gridProblem(visual, payload) !== null) return 'Labels name every piece, criterion and axis, and nothing else';
  const grid = payload as Grid;
  const ids = [...grid.pieces, ...(visual === 'decision-matrix' ? grid.criteria!.map((criterion) => criterion.id) : []), ...(visual === 'two-by-two' ? AXES : [])];
  return record(labels) && sameKeys(labels, ids) ? null : 'Labels name every piece, criterion and axis, and nothing else';
}

function gridKeyProblem(visual: unknown, payload: unknown, solutions: readonly Slots[]): string | null {
  if (gridProblem(visual, payload) !== null) return 'The grid payload is malformed';
  const wanted = sorted((payload as Grid).pieces);
  const expected = gridExpected(visual, payload);
  const canonical = expected ? canon(expected) : null;
  for (const solution of solutions) {
    const placed = sorted(placedIn(solution));
    if (placed.length !== wanted.length || placed.some((id, index) => id !== wanted[index])) return 'A solution places every piece exactly once';
    if (canonical !== null && canon(solution) !== canonical) return 'A computed grid has one solution: the key must equal it';
  }
  return null;
}

// Schedule board (F2.15): hand-mirrored from backend/src/services/horizonte/fin2/schedule.ts.
const SCHEDULE_VISUALS = ['gantt', 'kanban', 'timeline'] as const;
type ScheduleVisual = (typeof SCHEDULE_VISUALS)[number];
const PERIOD_PREFIX = 'period-';
const STEP_PREFIX = 'step-';
const MAX_DURATION = 4;
const MAX_PERIODS = 10;
const MAX_WORKERS = 3;
const MAX_LIMIT = 4;
interface Task { id: string; after: string[]; duration?: number; due?: number }
interface Plan { tasks: Task[]; periods?: number; workers?: number; done?: string[]; limit?: number }

const isScheduleVisual = (value: unknown): value is ScheduleVisual => typeof value === 'string' && (SCHEDULE_VISUALS as readonly string[]).includes(value);
const periodSlot = (period: number): string => `${PERIOD_PREFIX}${period}`;
const stepSlot = (step: number): string => `${STEP_PREFIX}${step}`;

function topologicalOrder(tasks: readonly Task[]): Task[] {
  const done = new Set<string>();
  const order: Task[] = [];
  while (order.length < tasks.length) {
    const next = tasks.find((task) => !done.has(task.id) && task.after.every((id) => done.has(id)));
    if (!next) break;
    done.add(next.id);
    order.push(next);
  }
  return order;
}

function earliestFinish(tasks: readonly Task[]): Map<string, number> {
  const finish = new Map<string, number>();
  const visit = (task: Task): number => {
    const known = finish.get(task.id);
    if (known !== undefined) return known;
    const start = 1 + Math.max(0, ...task.after.map((id) => visit(tasks.find((other) => other.id === id)!)));
    const end = start + (task.duration ?? 1) - 1;
    finish.set(task.id, end);
    return end;
  };
  tasks.forEach(visit);
  return finish;
}

const readyOf = (plan: Plan): string[] => plan.tasks.filter((task) => !plan.done!.includes(task.id) && task.after.every((id) => plan.done!.includes(id))).map((task) => task.id);

function scheduleProblem(visual: unknown, payload: unknown): string | null {
  if (!isScheduleVisual(visual)) return 'Unknown schedule visual';
  if (!keysAre(payload, ['tasks'], ['periods', 'workers', 'done', 'limit']) || !Array.isArray(payload.tasks)) return 'A schedule payload carries its tasks';
  const raw = payload.tasks as unknown[];
  if (raw.length < 3 || raw.length > 10) return 'A schedule has 3 to 10 tasks';
  for (const task of raw) {
    if (!keysAre(task, ['id', 'after'], ['duration', 'due']) || !isId(task.id) || !idList(task.after, 0, 3)) return 'Each task has an id and up to 3 prerequisites';
    if (task.duration !== undefined && !whole(task.duration, 1, MAX_DURATION)) return `A duration is a whole number of periods from 1 to ${MAX_DURATION}`;
    if (task.due !== undefined && !whole(task.due, 1, 10)) return 'A due step is a whole number from 1 to 10';
  }
  const tasks = raw as Task[];
  const ids = new Set(tasks.map((task) => task.id));
  if (ids.size !== tasks.length) return 'Task ids are unique';
  if (tasks.some((task) => task.after.some((id) => !ids.has(id) || id === task.id))) return 'Prerequisites name other tasks of this schedule';
  if (topologicalOrder(tasks).length !== tasks.length) return 'Prerequisites form a cycle';
  const has = (key: string) => payload[key] !== undefined;
  if (visual === 'gantt') {
    if (['done', 'limit'].some(has) || tasks.some((task) => task.duration === undefined || task.due !== undefined)) return 'A Gantt has durations and a deadline in periods, never due steps, done or a limit';
    if (!whole(payload.periods, 3, MAX_PERIODS) || (has('workers') && !whole(payload.workers, 1, MAX_WORKERS))) return 'A Gantt has 3 to 10 periods and optionally 1 to 3 workers';
    return Math.max(...earliestFinish(tasks).values()) <= payload.periods ? null : 'The longest chain of tasks does not fit the deadline';
  }
  if (['periods', 'workers'].some(has) || tasks.some((task) => task.duration !== undefined)) return `A ${visual} has no durations, periods or workers`;
  if (visual === 'timeline') {
    if (['done', 'limit'].some(has)) return 'A timeline has no done list or limit';
    return tasks.every((task) => task.due === undefined || task.due <= tasks.length) ? null : 'A due step is within the number of tasks';
  }
  if (!has('done') || !whole(payload.limit, 1, MAX_LIMIT) || !idList(payload.done, 1, tasks.length - 2) || tasks.some((task) => task.due !== undefined)) return 'A kanban lists what is done and a work-in-progress limit';
  const done = payload.done as string[];
  if (done.some((id) => !ids.has(id) || tasks.find((task) => task.id === id)!.after.some((before) => !done.includes(before)))) return 'Done tasks name tasks of this board and only need done tasks';
  const ready = readyOf({ tasks, done });
  if (ready.length < 1 || tasks.length - done.length - ready.length < 1) return 'A kanban has tasks that can start now and tasks still blocked';
  return ready.length <= payload.limit ? null : 'The limit holds every task that can start now';
}

function scheduleFrame(visual: unknown, payload: unknown): Frame | null {
  if (scheduleProblem(visual, payload) !== null) return null;
  const plan = payload as Plan;
  const count = plan.tasks.length;
  if (visual === 'gantt') {
    const slotIds = Array.from({ length: plan.periods! }, (_, index) => periodSlot(index + 1));
    return { pieceIds: plan.tasks.map((task) => task.id), slotIds, capacities: Object.fromEntries(slotIds.map((slot) => [slot, count])) };
  }
  if (visual === 'timeline') {
    const slotIds = Array.from({ length: count }, (_, index) => stepSlot(index + 1));
    return { pieceIds: plan.tasks.map((task) => task.id), slotIds, capacities: Object.fromEntries(slotIds.map((slot) => [slot, 1])) };
  }
  const movable = plan.tasks.map((task) => task.id).filter((id) => !plan.done!.includes(id));
  return { pieceIds: movable, slotIds: ['todo', 'doing'], capacities: { todo: movable.length, doing: plan.limit! } };
}

function kanbanExpected(plan: Plan): Slots {
  const ready = readyOf(plan);
  return { doing: ready, todo: plan.tasks.map((task) => task.id).filter((id) => !plan.done!.includes(id) && !ready.includes(id)) };
}

function startsOf(slots: Slots, prefix: string): Map<string, number> {
  const starts = new Map<string, number>();
  for (const [slot, pieces] of Object.entries(slots)) for (const id of pieces) starts.set(id, Number(slot.slice(prefix.length)));
  return starts;
}

function ganttMet(plan: Plan, slots: Slots): boolean {
  const start = startsOf(slots, PERIOD_PREFIX);
  if (start.size !== plan.tasks.length) return false;
  const end = (task: Task) => start.get(task.id)! + task.duration! - 1;
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  for (const task of plan.tasks) {
    if (end(task) > plan.periods!) return false;
    if (task.after.some((id) => start.get(task.id)! <= end(byId.get(id)!))) return false;
  }
  if (plan.workers === undefined) return true;
  for (let period = 1; period <= plan.periods!; period += 1) {
    if (plan.tasks.filter((task) => start.get(task.id)! <= period && period <= end(task)).length > plan.workers) return false;
  }
  return true;
}

function timelineMet(plan: Plan, slots: Slots): boolean {
  const step = startsOf(slots, STEP_PREFIX);
  if (step.size !== plan.tasks.length) return false;
  return plan.tasks.every((task) => (task.due === undefined || step.get(task.id)! <= task.due) && task.after.every((id) => step.get(id)! < step.get(task.id)!));
}

const scheduleLabelsProblem = (visual: unknown, payload: unknown, labels: unknown): string | null =>
  scheduleProblem(visual, payload) === null && record(labels) && sameKeys(labels, (payload as Plan).tasks.map((task) => task.id)) ? null : 'Labels name every task, and nothing else';

function scheduleKeyProblem(visual: unknown, payload: unknown, solutions: readonly Slots[]): string | null {
  if (scheduleProblem(visual, payload) !== null) return 'The schedule payload is malformed';
  const plan = payload as Plan;
  if (visual === 'kanban') {
    const expected = kanbanExpected(plan);
    const same = (a: Slots, b: Slots) => ['todo', 'doing'].every((slot) => sorted(a[slot] ?? []).join() === sorted(b[slot] ?? []).join());
    return solutions.every((solution) => same(solution, expected)) ? null : 'A kanban has one solution: the key must equal it';
  }
  const met = visual === 'gantt' ? ganttMet : timelineMet;
  return solutions.every((solution) => placedIn(solution).length === plan.tasks.length && met(plan, solution)) ? null : 'Every key solution is a complete schedule that meets the rules';
}

// Gate 4 (solvability and scope).
const BANDS: Readonly<Record<string, readonly string[]>> = {
  [CASH_FLOW]: ['13-17', 'adult'],
  [GRID]: ['10-12', '13-17', 'adult'],
  [SCHEDULE]: ['10-12', '13-17', 'adult'],
};

/** The grid and the schedule open at age 12, so a 10-12 lesson of them must carry an eligibility of 12; the Forge document holds the band alone. */
function ageProblem(type: string, document: V2DocumentLike): string | null {
  const band = typeof document.age_band === 'string' ? document.age_band : null;
  const allowed = BANDS[type]!;
  return band === null || allowed.includes(band) ? null : `This kind is for age band ${allowed.join(', ')}, not ${band}`;
}

interface Spec {
  visualMessage: string;
  visualOk: (visual: unknown) => boolean;
  payload: (visual: unknown, payload: unknown) => string | null;
  labels: (visual: unknown, payload: unknown, labels: unknown) => string | null;
  frame: (visual: unknown, payload: unknown) => Frame | null;
  key: (visual: unknown, payload: unknown, solutions: readonly Slots[]) => string | null;
}

const SPECS: Readonly<Record<string, Spec>> = {
  [CASH_FLOW]: {
    visualMessage: 'The cash flow visual must be statement-board',
    visualOk: (visual) => visual === 'statement-board',
    payload: (_visual, payload) => statementProblem(payload),
    labels: (_visual, payload, labels) => statementLabelsProblem(payload, labels),
    frame: (_visual, payload) => statementFrame(payload),
    key: (_visual, payload, solutions) => statementKeyProblem(payload, solutions),
  },
  [GRID]: {
    visualMessage: 'The decision grid visual must be swot, eisenhower, two-by-two, decision-matrix or business-canvas',
    visualOk: isGridVisual,
    payload: (visual, payload) => gridProblem(visual, payload),
    labels: gridLabelsProblem,
    frame: (visual, payload) => gridFrame(visual, payload),
    key: gridKeyProblem,
  },
  [SCHEDULE]: {
    visualMessage: 'The schedule board visual must be gantt, kanban or timeline',
    visualOk: isScheduleVisual,
    payload: scheduleProblem,
    labels: scheduleLabelsProblem,
    frame: scheduleFrame,
    key: scheduleKeyProblem,
  },
};

function fin2Gates(document: V2DocumentLike, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const type = segment.type;
    if (typeof type !== 'string' || !Object.hasOwn(SPECS, type)) continue;
    const spec = SPECS[type]!;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string) => problems.push({ gate: 4, segmentId, message });
    const visual = (segment.visual as { type?: unknown } | undefined)?.type;
    if (!spec.visualOk(visual)) { problem(spec.visualMessage); continue; }
    const age = ageProblem(type, document);
    if (age) problem(age);
    const broken = spec.payload(visual, segment.payload);
    if (broken) { problem(broken); continue; }
    const labels = spec.labels(visual, segment.payload, segment.labels);
    if (labels) problem(labels);
    if (!answerKeys || !Object.hasOwn(answerKeys, segmentId)) continue;
    const key = answerKeys[segmentId];
    const frame = spec.frame(visual, segment.payload)!;
    const shape = keyShapeProblem(frame, key);
    if (shape) { problem(shape); continue; }
    const wrong = spec.key(visual, segment.payload, solutionsOf(key));
    if (wrong) problem(wrong);
  }
  return problems;
}

// Solvability checkers (F0.4): the search runs over the same arrangements the board allows.
type Prepared = { solutions: Slots[]; issues: SolvabilityIssue[] };

function prepareKey(frame: Frame, context: SolvabilityContext, subject: string): Prepared {
  if (context.answerKey === undefined) return { solutions: [], issues: [] };
  const problem = keyShapeProblem(frame, context.answerKey);
  return problem ? { solutions: [], issues: [issue('impossible-state', `${subject}: ${problem}`)] } : { solutions: solutionsOf(context.answerKey), issues: [] };
}

function repeated(ids: readonly string[], subject: string): SolvabilityIssue[] {
  return checkUniqueIds(ids.filter((id): id is string => typeof id === 'string'), subject);
}

function covered<V>(subject: string, run: (limit: number) => SearchResult<V>, solutions: readonly Slots[], predicateGraded = false): SolvabilityResult {
  let found: SearchResult<V> | undefined;
  return verifyUniqueOrCovered((limit) => (found = run(limit)), {
    subject,
    ...(predicateGraded ? { predicateGraded: true } : {}),
    ...(!predicateGraded && solutions.length > 0 ? { acceptance: new Set(solutions.map(canon)), isSolution: (key: string) => found?.keys.includes(key) === true } : {}),
  });
}

const withKey = (outcome: SolvabilityResult, key: Prepared, extra: SolvabilityIssue[] = []): SolvabilityResult =>
  result([...key.issues, ...extra, ...outcome.issues], { ...(outcome.stats ?? {}), solutionsInKey: key.solutions.length });

export const cashFlowChecker: SolvabilityChecker = (segment, context) => {
  const subject = `cash flow ${segment.id}`;
  const items = Array.isArray(segment.payload.items) ? segment.payload.items.filter(record) : [];
  const duplicates = repeated(items.map((item) => item.id as string), 'item');
  if (duplicates.length > 0) return result(duplicates);
  const broken = statementProblem(segment.payload);
  if (broken) return result([issue('impossible-state', `${subject}: ${broken}`)]);
  const key = prepareKey(statementFrame(segment.payload)!, context, subject);
  const wrong = key.issues.length === 0 && key.solutions.length > 0 ? statementKeyProblem(segment.payload, key.solutions) : null;
  return result([...key.issues, ...(wrong ? [issue('impossible-state', `${subject}: ${wrong}`)] : [])], { items: items.length, solutionsInKey: key.solutions.length });
};

function gridVisualOf(payload: Rec, key: unknown): GridVisual | null {
  if (payload.points !== undefined) return 'two-by-two';
  if (payload.criteria !== undefined || payload.scores !== undefined) return 'decision-matrix';
  const first = record(key) && Array.isArray(key.solutions) && record(key.solutions[0]) ? Object.keys(key.solutions[0]) : [];
  return (['swot', 'eisenhower', 'business-canvas'] as const).find((visual) => first.some((slot) => (GRID_SLOTS[visual] as readonly string[]).includes(slot))) ?? null;
}

export const decisionGridChecker: SolvabilityChecker = (segment, context) => {
  const subject = `decision grid ${segment.id}`;
  const payload = segment.payload;
  const duplicates = repeated(Array.isArray(payload.pieces) ? (payload.pieces as string[]) : [], 'piece');
  if (duplicates.length > 0) return result(duplicates);
  const visual = gridVisualOf(payload, context.answerKey);
  if (visual === null) {
    const loose = keysAre(payload, ['pieces']) && idList(payload.pieces, 4, GRID_MAX);
    return result(loose ? (context.answerKey === undefined ? [] : [issue('impossible-state', `${subject}: the key names no slot of a SWOT, Eisenhower or canvas grid`)]) : [issue('impossible-state', `${subject}: a SWOT, Eisenhower or canvas grid carries only 4 to ${GRID_MAX} unique pieces`)], { pieces: Array.isArray(payload.pieces) ? payload.pieces.length : 0 });
  }
  const broken = gridProblem(visual, payload, true);
  if (broken) return result([issue('impossible-state', `${subject}: ${broken}`)]);
  const grid = payload as unknown as Grid;
  const key = prepareKey(gridFrame(visual, payload, true)!, context, subject);
  if (visual === 'two-by-two') {
    const points = grid.points!;
    const spacing = checkPointSpacing(points.map(([x, y], index) => ({ id: grid.pieces[index]!, x, y })), { minDistance: 1, subject: `${subject} points` }).map((item) => ({ ...item, severity: 'review' as const }));
    const outcome = covered(subject, (limit) => searchAssignments<string>({
      domains: grid.pieces.map(() => GRID_SLOTS['two-by-two']),
      accept: (partial, depth) => partial[depth] === quadrantOf(points[depth]!),
      key: (full) => canon(arrange(grid.pieces, full)),
      limit,
      maxNodes: context.nodeBudget,
    }), key.solutions);
    return withKey(outcome, key, spacing);
  }
  if (visual === 'decision-matrix') {
    const totals = weightedTotals(grid);
    const outcome = covered(subject, (limit) => searchAssignments<number>({
      domains: grid.pieces.map(() => grid.pieces.map((_, index) => index)),
      distinct: true,
      accept: (partial, depth) => depth === 0 || totals[partial[depth]!]! <= totals[partial[depth - 1]!]!,
      key: (full) => canon(arrange(full.map((index) => grid.pieces[index]!), full.map((_, place) => rankSlot(place + 1)))),
      limit,
      maxNodes: context.nodeBudget,
    }), key.solutions);
    return withKey(outcome, key);
  }
  const wrong = key.issues.length === 0 && key.solutions.length > 0 ? gridKeyProblem(visual, payload, key.solutions) : null;
  return result([...key.issues, ...(wrong ? [issue('impossible-state', `${subject}: ${wrong}`)] : [])], { pieces: grid.pieces.length, solutionsInKey: key.solutions.length });
};

const scheduleVisualOf = (payload: Rec): ScheduleVisual =>
  payload.periods !== undefined || payload.workers !== undefined ? 'gantt' : payload.done !== undefined || payload.limit !== undefined ? 'kanban' : 'timeline';

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

export const scheduleBoardChecker: SolvabilityChecker = (segment, context) => {
  const subject = `schedule board ${segment.id}`;
  const payload = segment.payload;
  const tasks = Array.isArray(payload.tasks) ? payload.tasks.filter(record) : [];
  const ids = tasks.map((task) => task.id).filter((id): id is string => typeof id === 'string');
  const structural = [
    ...repeated(ids, 'task'),
    ...checkReferences(tasks.flatMap((task) => (Array.isArray(task.after) ? task.after.filter((to): to is string => typeof to === 'string').map((to) => ({ from: String(task.id), to })) : [])), ids),
  ];
  if (structural.length > 0) return result(structural);
  const visual = scheduleVisualOf(payload);
  const broken = scheduleProblem(visual, payload);
  if (broken) return result([issue('impossible-state', `${subject}: ${broken}`)]);
  const plan = payload as unknown as Plan;
  const frame = scheduleFrame(visual, payload)!;
  const key = prepareKey(frame, context, subject);
  const wrong = key.issues.length === 0 && key.solutions.length > 0 ? scheduleKeyProblem(visual, payload, key.solutions) : null;
  const keyIssues = wrong ? [issue('impossible-state', `${subject}: ${wrong}`)] : [];
  if (visual === 'kanban') {
    const ready = new Set(readyOf(plan));
    const outcome = covered(subject, (limit) => searchAssignments<string>({
      domains: frame.pieceIds.map(() => ['todo', 'doing']),
      accept: (partial) => partial.filter((slot) => slot === 'doing').length <= plan.limit!,
      isSolution: (full) => full.every((slot, index) => (slot === 'doing') === ready.has(frame.pieceIds[index]!)),
      key: (full) => canon(arrange(frame.pieceIds, full)),
      limit,
      maxNodes: context.nodeBudget,
    }), key.solutions);
    return withKey(outcome, key);
  }
  const order = topologicalOrder(plan.tasks);
  const before = order.map((task) => task.after.map((id) => order.findIndex((other) => other.id === id)));
  const ids2 = order.map((task) => task.id);
  if (visual === 'gantt') {
    const length = (index: number) => order[index]!.duration!;
    const outcome = covered(subject, (limit) => searchAssignments<number>({
      domains: order.map((task) => range(1, plan.periods! - task.duration! + 1)),
      accept: (partial, depth) => {
        const start = partial[depth]!;
        if (before[depth]!.some((index) => partial[index]! + length(index) - 1 >= start)) return false;
        if (plan.workers === undefined) return true;
        for (let period = start; period < start + length(depth); period += 1) {
          let running = 0;
          for (let index = 0; index <= depth; index += 1) if (partial[index]! <= period && period <= partial[index]! + length(index) - 1) running += 1;
          if (running > plan.workers) return false;
        }
        return true;
      },
      isSolution: (full) => ganttMet(plan, arrange(ids2, full.map(periodSlot))),
      key: (full) => canon(arrange(ids2, full.map(periodSlot))),
      limit,
      maxNodes: context.nodeBudget,
    }), key.solutions, true);
    return withKey(outcome, key, keyIssues);
  }
  const outcome = covered(subject, (limit) => searchAssignments<number>({
    domains: order.map(() => range(1, order.length)),
    distinct: true,
    accept: (partial, depth) => (order[depth]!.due === undefined || partial[depth]! <= order[depth]!.due!) && before[depth]!.every((index) => partial[index]! < partial[depth]!),
    isSolution: (full) => timelineMet(plan, arrange(ids2, full.map(stepSlot))),
    key: (full) => canon(arrange(ids2, full.map(stepSlot))),
    limit,
    maxNodes: context.nodeBudget,
  }), key.solutions, true);
  return withKey(outcome, key, keyIssues);
};

registerSolvabilityChecker(CASH_FLOW, cashFlowChecker);
registerSolvabilityChecker(GRID, decisionGridChecker);
registerSolvabilityChecker(SCHEDULE, scheduleBoardChecker);

export const fin2 = {
  id: 'fin2',
  capabilities: FIN2_CAPABILITIES,
  guidance: FIN2_GUIDANCE,
  gates: fin2Gates,
} as const satisfies ForgeHorizontePack;
