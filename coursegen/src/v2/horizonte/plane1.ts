import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const PLANE1_CAPABILITIES = {
  'alg.slope-triangle.v2': ['visual.slope-triangle.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'alg.rate-of-change.v2': ['visual.rate-table-graph.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'alg.linked-views.v2': ['visual.linked-views.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'fin.break-even.v2': ['visual.break-even.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'fin.cost-structure.v2': ['visual.cost-structure.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'fin.margin-markup.v2': ['visual.margin-markup.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'econ.market-shift.v2': ['visual.market-shift.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'econ.elasticity.v2': ['visual.elasticity.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
} as const;

const SLOPE = 'alg.slope-triangle.v2';
const RATE = 'alg.rate-of-change.v2';
const LINKED = 'alg.linked-views.v2';
const BREAK_EVEN = 'fin.break-even.v2';
const COST = 'fin.cost-structure.v2';
const MARKUP = 'fin.margin-markup.v2';
const MARKET = 'econ.market-shift.v2';
const ELASTICITY = 'econ.elasticity.v2';

const PLANE1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: SLOPE,
    lines: [
      `${SLOPE}: ages 13-17 only. A rising line between two whole points on a grid at most 12 wide and 24 tall, a run of 1 to 8 and a start rise away from the answer.`,
      `${SLOPE}: the answer is the rise, run times the slope, and it must be a whole number that stays on the grid. The prompt writes the run in digits and never the rise.`,
    ],
  },
  {
    type: RATE,
    lines: [
      `${RATE}: ages 13-17 only. A start point, a steady whole rate of 1 to 8 per step and the step to reach, to the right of the start.`,
      `${RATE}: the prompt writes the rate and the step in digits ("grows by 3 each step", "step 6") and never the value reached; the value reached stays on the grid.`,
    ],
  },
  {
    type: LINKED,
    lines: [
      `${LINKED}: ages 12-17 only. Two whole points, the second to the right of the first, whose slope is a whole number from -9 to 9 and whose intercept is on the grid.`,
      `${LINKED}: the prompt writes all four coordinates in digits ("(1, 5) and (3, 9)") and never the slope or the intercept; the line starts away from the answer.`,
    ],
  },
  {
    type: BREAK_EVEN,
    lines: [
      `${BREAK_EVEN}: ages 12 and up. A fixed cost, a price and a cost per unit below it; the fixed cost divides by the profit per unit so the break-even is a whole number of units within the unit limit.`,
      `${BREAK_EVEN}: the prompt writes the fixed cost, the price and the cost per unit in digits and never the break-even.`,
    ],
  },
  {
    type: COST,
    lines: [
      `${COST}: ages 12 and up. A fixed cost, a variable cost per unit and a goal average cost above the variable cost; the fixed cost divides by the gap, so the units are whole and within the limit.`,
      `${COST}: the prompt writes the fixed cost, the variable cost and the goal average in digits and never the units.`,
    ],
  },
  {
    type: MARKUP,
    lines: [
      `${MARKUP}: ages 12 and up. A cost and a markup (on cost, 5 to 300) or margin (on price, 5 to 90) percent whose price is a whole number above the cost and within the price limit.`,
      `${MARKUP}: the prompt writes the cost and the percent in digits and says whether it is a markup on the cost or a margin of the price; it never gives the price.`,
    ],
  },
  {
    type: MARKET,
    lines: [
      `${MARKET}: ages 13 and up. Demand falls and supply rises with the price; both the market before and after one shift of a curve clear at a whole price and a whole quantity inside the limits.`,
      `${MARKET}: the prompt writes the size of the shift in digits, asks whether the price goes up or down and asks for the new price; it never names the direction or the price.`,
    ],
  },
  {
    type: ELASTICITY,
    lines: [
      `${ELASTICITY}: ages 13 and up. A falling demand line that stays above zero up to the price limit and a goal elasticity as a fraction of whole numbers from 1 to 4.`,
      `${ELASTICITY}: the goal is reached at one whole price within the limit; the prompt writes the fraction in digits ("1" or "1/2") and never the price.`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export type Solved<Answer> = { answer: Answer; message?: undefined } | { answer?: undefined; message: string };
const solved =<Answer>(answer: Answer): Solved<Answer> => ({ answer });
const broken = (message: string): Solved<never> => ({ message });

type Grid = { xMax: number; yMin: number; yMax: number };
type Point = { x: number; y: number };

const GRID_RULE = 'The grid starts at x 0 and runs 4 to 12 across, from -24 up to 0 below and 4 to 24 above';

function gridOf(value: unknown): Grid | null {
  return hasOnly(value, ['xMax', 'yMin', 'yMax']) && inRange(value.xMax, 4, 12) && inRange(value.yMin, -24, 0) && inRange(value.yMax, 4, 24)
    ? { xMax: value.xMax, yMin: value.yMin, yMax: value.yMax }
    : null;
}

function pointOf(value: unknown, grid: Grid): Point | null {
  return hasOnly(value, ['x', 'y']) && inRange(value.x, 0, grid.xMax) && inRange(value.y, grid.yMin, grid.yMax) ? { x: value.x, y: value.y } : null;
}

export function solveSlope(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['grid', 'line', 'run', 'start'])) return broken('The payload is a grid, a line, a run and a start');
  const grid = gridOf(payload.grid);
  if (!grid) return broken(GRID_RULE);
  const line = hasOnly(payload.line, ['from', 'to']) ? payload.line : null;
  const from = line ? pointOf(line.from, grid) : null;
  const to = line ? pointOf(line.to, grid) : null;
  if (!from || !to || to.x <= from.x || to.y <= from.y) return broken('The line climbs between two whole points on the grid');
  const run = payload.run;
  if (!inRange(run, 1, 8) || from.x + run > grid.xMax) return broken('The run is 1 to 8 and the triangle stays on the grid');
  const up = (to.y - from.y) * run;
  const across = to.x - from.x;
  const room = grid.yMax - from.y;
  if (up % across !== 0 || up / across < 1 || up / across > room) return broken('The rise for this run is a whole number that stays on the grid');
  const rise = up / across;
  if (!inRange(payload.start, 0, room)) return broken('The rise starts on the grid');
  return payload.start === rise ? broken('The triangle starts away from the answer') : solved(rise);
}

export function solveRate(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['grid', 'origin', 'rate', 'at', 'start'])) return broken('The payload is a grid, an origin, a rate, a step and a start');
  const grid = gridOf(payload.grid);
  if (!grid) return broken(GRID_RULE);
  const origin = pointOf(payload.origin, grid);
  if (!origin) return broken('The origin is a whole point on the grid');
  const { rate, at, start } = payload;
  if (!inRange(rate, 1, 8)) return broken('The rate is a whole number from 1 to 8 per step');
  if (!inRange(at, origin.x + 1, grid.xMax)) return broken('The step to reach is right of the origin and on the grid');
  const reached = origin.y + rate * (at - origin.x);
  if (reached > grid.yMax) return broken('The value reached stays on the grid');
  if (!inRange(start, grid.yMin, grid.yMax)) return broken('The value starts on the grid');
  return start === reached ? broken('The value starts away from the answer') : solved(reached);
}

export type LineFit = { m: number; b: number };

export function solveLinked(payload: Record<string, unknown>): Solved<LineFit> {
  if (!hasOnly(payload, ['grid', 'given', 'start'])) return broken('The payload is a grid, two given points and a start');
  const grid = gridOf(payload.grid);
  if (!grid) return broken(GRID_RULE);
  const given = payload.given;
  const first = Array.isArray(given) && given.length === 2 ? pointOf(given[0], grid) : null;
  const second = Array.isArray(given) && given.length === 2 ? pointOf(given[1], grid) : null;
  if (!first || !second || second.x <= first.x) return broken('Two whole points on the grid, the second right of the first');
  const across = second.x - first.x;
  const up = second.y - first.y;
  if (up % across !== 0 || !inRange(up / across, -9, 9)) return broken('The slope through the points is a whole number from -9 to 9');
  const m = up / across;
  const b = first.y - m * first.x;
  if (!inRange(b, grid.yMin, grid.yMax)) return broken('The intercept is a whole number on the grid');
  const start = payload.start;
  if (!hasOnly(start, ['m', 'b']) || !inRange(start.m, -9, 9) || !inRange(start.b, grid.yMin, grid.yMax)) return broken('The slope and intercept start in range');
  return start.m === m && start.b === b ? broken('The line starts away from the answer') : solved({ m, b });
}

export function solveBreakEven(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['fixed', 'price', 'unit', 'maxUnits', 'start'])) return broken('The payload is a fixed cost, a price, a cost per unit, a unit limit and a start');
  const { fixed, price, unit, maxUnits, start } = payload;
  if (!inRange(fixed, 1, 1000)) return broken('The fixed cost is a whole number from 1 to 1000');
  if (!inRange(price, 2, 100) || !inRange(unit, 1, 99) || unit >= price) return broken('The price is 2 to 100 and the cost per unit is a whole number below it');
  if (!inRange(maxUnits, 4, 60)) return broken('The unit limit is 4 to 60');
  if (fixed % (price - unit) !== 0) return broken('The fixed cost divides by the profit per unit, so the break-even is a whole number');
  const units = fixed / (price - unit);
  if (!inRange(units, 1, maxUnits)) return broken('The break-even is within the unit limit');
  if (!inRange(start, 0, maxUnits)) return broken('The units start on the axis');
  return start === units ? broken('The units start away from the answer') : solved(units);
}

export function solveCost(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['fixed', 'variable', 'maxUnits', 'goal', 'start'])) return broken('The payload is a fixed cost, a variable cost, a unit limit, a goal and a start');
  const { fixed, variable, maxUnits, goal, start } = payload;
  if (!inRange(fixed, 1, 1000)) return broken('The fixed cost is a whole number from 1 to 1000');
  if (!inRange(variable, 1, 50)) return broken('The variable cost per unit is 1 to 50');
  if (!inRange(maxUnits, 4, 60)) return broken('The unit limit is 4 to 60');
  if (!hasOnly(goal, ['average']) || !inRange(goal.average, variable + 1, 200)) return broken('The goal is an average cost above the variable cost, up to 200');
  const extra = goal.average - variable;
  if (fixed % extra !== 0) return broken('The fixed cost divides by the gap to the average, so the units are a whole number');
  const units = fixed / extra;
  if (!inRange(units, 1, maxUnits)) return broken('The units that reach the goal are within the unit limit');
  if (!inRange(start, 1, maxUnits)) return broken('The units start on the axis, at 1 or more');
  return start === units ? broken('The units start away from the answer') : solved(units);
}

export function solveMarkup(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['cost', 'basis', 'percent', 'maxPrice', 'start'])) return broken('The payload is a cost, a basis, a percent, a price limit and a start');
  const { cost, basis, percent, maxPrice, start } = payload;
  if (!inRange(cost, 1, 100)) return broken('The cost is a whole number from 1 to 100');
  if (basis !== 'markup' && basis !== 'margin') return broken('The basis is markup or margin');
  const top = basis === 'markup' ? 300 : 90;
  if (!inRange(percent, 5, top)) return broken(`The ${basis} is a whole percent from 5 to ${top}`);
  if (!inRange(maxPrice, 10, 400)) return broken('The price limit is 10 to 400');
  const numerator = basis === 'markup' ? cost * (100 + percent) : cost * 100;
  const denominator = basis === 'markup' ? 100 : 100 - percent;
  if (numerator % denominator !== 0) return broken('The percent gives a whole price');
  const price = numerator / denominator;
  if (!inRange(price, cost + 1, maxPrice)) return broken('The price is above the cost and within the price limit');
  if (!inRange(start, 0, maxPrice)) return broken('The price starts on the axis');
  return start === price ? broken('The price starts away from the answer') : solved(price);
}

type Demand = { a: number; b: number };
type Supply = { c: number; d: number };

const demandOf = (value: unknown): Demand | null =>
  hasOnly(value, ['a', 'b']) && inRange(value.a, 10, 300) && inRange(value.b, 1, 10) ? { a: value.a, b: value.b } : null;
const supplyOf = (value: unknown): Supply | null =>
  hasOnly(value, ['c', 'd']) && inRange(value.c, 0, 100) && inRange(value.d, 1, 10) ? { c: value.c, d: value.d } : null;

function clearing(demand: Demand, supply: Supply): number | null {
  const gap = demand.a - supply.c;
  const slope = demand.b + supply.d;
  return gap % slope === 0 ? gap / slope : null;
}

export type MarketFit = { direction: 'up' | 'down'; price: number };

export function solveMarket(payload: Record<string, unknown>): Solved<MarketFit> {
  if (!hasOnly(payload, ['pMax', 'qMax', 'demand', 'supply', 'shift', 'start'])) return broken('The payload is a price limit, a quantity limit, demand, supply, a shift and a start');
  const { pMax, qMax, shift, start } = payload;
  if (!inRange(pMax, 4, 60)) return broken('The price limit is 4 to 60');
  if (!inRange(qMax, 20, 300)) return broken('The quantity limit is 20 to 300');
  const demand = demandOf(payload.demand);
  if (!demand) return broken('Demand is a quantity of 10 to 300 at price 0 that falls by 1 to 10 for each price step');
  const supply = supplyOf(payload.supply);
  if (!supply) return broken('Supply is a quantity of 0 to 100 at price 0 that rises by 1 to 10 for each price step');
  if (!hasOnly(shift, ['curve', 'by']) || (shift.curve !== 'demand' && shift.curve !== 'supply') || !inRange(shift.by, -60, 60) || shift.by === 0) {
    return broken('The shift moves demand or supply by 1 to 60 units, up or down');
  }
  const first = clearing(demand, supply);
  if (first === null || !inRange(first, 1, pMax) || !inRange(demand.a - demand.b * first, 1, qMax)) return broken('The market clears at a whole price and quantity inside the limits');
  const moved = shift.curve === 'demand' ? { demand: { a: demand.a + shift.by, b: demand.b }, supply } : { demand, supply: { c: supply.c + shift.by, d: supply.d } };
  const price = clearing(moved.demand, moved.supply);
  if (price === null || !inRange(price, 1, pMax) || !inRange(moved.demand.a - moved.demand.b * price, 1, qMax)) {
    return broken('After the shift the market clears at a whole price and quantity inside the limits');
  }
  if (!inRange(start, 0, pMax)) return broken('The price starts on the axis');
  if (start === price) return broken('The price starts away from the answer');
  return solved({ direction: price > first ? 'up' : 'down', price });
}

export function solveElastic(payload: Record<string, unknown>): Solved<number> {
  if (!hasOnly(payload, ['pMax', 'demand', 'goal', 'start'])) return broken('The payload is a price limit, demand, a goal and a start');
  const { pMax, goal, start } = payload;
  if (!inRange(pMax, 4, 60)) return broken('The price limit is 4 to 60');
  const demand = demandOf(payload.demand);
  if (!demand) return broken('Demand is a quantity of 10 to 300 at price 0 that falls by 1 to 10 for each price step');
  if (demand.b * pMax >= demand.a) return broken('Demand stays above zero at every price up to the limit');
  if (!hasOnly(goal, ['num', 'den']) || !inRange(goal.num, 1, 4) || !inRange(goal.den, 1, 4)) return broken('The goal elasticity is a fraction of whole numbers from 1 to 4');
  const top = goal.num * demand.a;
  const bottom = demand.b * (goal.num + goal.den);
  const price = top % bottom === 0 ? top / bottom : null;
  if (price === null || !inRange(price, 1, pMax)) return broken('The goal elasticity is reached at a whole price within the limit');
  if (!inRange(start, 1, pMax)) return broken('The price starts on the axis');
  return start === price ? broken('The price starts away from the answer') : solved(price);
}

export const namesNumber = (prompt: unknown, value: unknown): boolean =>
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

/** A gate for a type whose answer is one whole number: the payload solves, the key is that number, the prompt writes the numbers the learner needs. */
function numberGate(label: string, solve: (payload: Record<string, unknown>) => Solved<number>, named: Named): Check {
  return (segment, payload, key, report) => {
    const result = solve(payload);
    if (result.message !== undefined) return report(result.message);
    if (!named(payload).every((value) => namesNumber(segment.prompt, value))) report(`The ${label} prompt must write its numbers in digits`);
    if (key === undefined) return;
    if (key?.target !== result.answer) report(`The ${label} target must be ${result.answer}`);
  };
}

type Named = (payload: Record<string, unknown>) => unknown[];

const field = (payload: Record<string, unknown>, name: string): Record<string, unknown> => (record(payload[name]) ? (payload[name] as Record<string, unknown>) : {});

/** The numbers each prompt must write in digits, shared by the pack gate and the solvability checkers. */
export const PLANE1_NAMED = {
  [SLOPE]: (payload) => [payload.run],
  [RATE]: (payload) => [payload.rate, payload.at],
  [LINKED]: (payload) => (Array.isArray(payload.given) ? payload.given.flatMap((point: unknown) => (record(point) ? [point.x, point.y] : [undefined])) : []),
  [BREAK_EVEN]: (payload) => [payload.fixed, payload.price, payload.unit],
  [COST]: (payload) => [payload.fixed, payload.variable, field(payload, 'goal').average],
  [MARKUP]: (payload) => [payload.cost, payload.percent],
  [MARKET]: (payload) => [Math.abs(field(payload, 'shift').by as number)],
  [ELASTICITY]: (payload) => [field(payload, 'goal').num, field(payload, 'goal').den],
} as const satisfies Record<string, Named>;

const slopeGate = numberGate('slope triangle', solveSlope, PLANE1_NAMED[SLOPE]);
const rateGate = numberGate('rate of change', solveRate, PLANE1_NAMED[RATE]);
const breakEvenGate = numberGate('break-even', solveBreakEven, PLANE1_NAMED[BREAK_EVEN]);
const costGate = numberGate('cost structure', solveCost, PLANE1_NAMED[COST]);
const elasticityGate = numberGate('elasticity', solveElastic, PLANE1_NAMED[ELASTICITY]);

const markupGate: Check = (segment, payload, key, report) => {
  const result = solveMarkup(payload);
  if (result.message !== undefined) return report(result.message);
  if (!PLANE1_NAMED[MARKUP](payload).every((value) => namesNumber(segment.prompt, value))) report('The markup prompt must write the cost and the percent in digits');
  if (key === undefined) return;
  if (key?.target !== result.answer) report(`The markup target must be ${result.answer}`);
};

const linkedGate: Check = (segment, payload, key, report) => {
  const result = solveLinked(payload);
  if (result.message !== undefined) return report(result.message);
  if (!PLANE1_NAMED[LINKED](payload).every((value) => namesNumber(segment.prompt, value))) report('The linked views prompt must write both points in digits');
  if (key === undefined) return;
  const target = key?.target;
  if (!record(target) || target.m !== result.answer.m || target.b !== result.answer.b) report(`The linked views target must be slope ${result.answer.m} and intercept ${result.answer.b}`);
};

const marketGate: Check = (segment, payload, key, report) => {
  const result = solveMarket(payload);
  if (result.message !== undefined) return report(result.message);
  if (!PLANE1_NAMED[MARKET](payload).every((value) => namesNumber(segment.prompt, value))) report('The market prompt must write the size of the shift in digits');
  if (key === undefined) return;
  const target = key?.target;
  if (!record(target) || target.direction !== result.answer.direction || target.price !== result.answer.price) {
    report(`The market target must be ${result.answer.direction} at price ${result.answer.price}`);
  }
};

/** Gate 4 (solvability), hand-mirrored from Core: every key is the one answer the payload allows, and a prompt writes the numbers the learner needs. */
function plane1Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  return [
    ...visit(document, answerKeys, SLOPE, 'slope-triangle', slopeGate),
    ...visit(document, answerKeys, RATE, 'rate-table-graph', rateGate),
    ...visit(document, answerKeys, LINKED, 'linked-views', linkedGate),
    ...visit(document, answerKeys, BREAK_EVEN, 'break-even', breakEvenGate),
    ...visit(document, answerKeys, COST, 'cost-structure', costGate),
    ...visit(document, answerKeys, MARKUP, 'margin-markup', markupGate),
    ...visit(document, answerKeys, MARKET, 'market-shift', marketGate),
    ...visit(document, answerKeys, ELASTICITY, 'elasticity', elasticityGate),
  ];
}

export const plane1 = {
  id: 'plane1',
  capabilities: PLANE1_CAPABILITIES,
  guidance: PLANE1_GUIDANCE,
  gates: plane1Gates,
} as const satisfies ForgeHorizontePack;
