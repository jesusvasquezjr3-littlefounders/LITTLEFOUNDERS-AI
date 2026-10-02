import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const PROB_CAPABILITIES = {
  'prob.tree.v2': ['visual.prob-tree.v1', 'operation.drag-chips.v1', 'operation.move-menu.v1', 'operation.show-table.v1'],
  'prob.bayes.v2': ['visual.natural-frequencies.v1', 'operation.number-input.v1', 'operation.show-table.v1'],
  'prob.regression.v2': ['visual.regression-residuals.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1', 'visual.math-notation.v1'],
} as const;

const TREE = 'prob.tree.v2';
const BAYES = 'prob.bayes.v2';
const REGRESSION = 'prob.regression.v2';

const PROB_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: TREE,
    lines: [
      `${TREE}: ages 13-17 and the adult pathway only. The payload is a population of 100 to 10000 and three shares written as a part in a whole (who has it, who of those test positive, who of the rest test positive), plus a tray of 7 to 10 counts.`,
      `${TREE}: every share must land on whole people and the six head counts (has, lacks, has and positive, has and negative, lacks and positive, lacks and negative) must all differ, because the counts are told apart by their value. The tray holds all six and 1 to 4 tempting extras, each different.`,
      `${TREE}: the prompt asks to build the tree by placing each count on its branch; it never writes a head count. The rubric is {solutions: [{has, lacks, has-pos, has-neg, lacks-pos, lacks-neg}]} with one chip id "n-<count>" per branch.`,
    ],
  },
  {
    type: BAYES,
    lines: [
      `${BAYES}: ages 13-17 and the adult pathway only. The same population and three shares as the tree, plus ask: "positive" or "negative".`,
      `${BAYES}: the prompt names the result and asks for the chance that the person truly has it ("One person tests positive. What is the chance they have it?"); it never writes the number of people or the answer. The asked chance is the head count of those who have it and got that result over everyone who got that result, between 1 in 20 and 19 in 20.`,
      `${BAYES}: the rubric is {target, tolerance: {absolute}, review?} where target is the exact chance as a fraction or a decimal and tolerance is at most 0.01.`,
    ],
  },
  {
    type: REGRESSION,
    lines: [
      `${REGRESSION}: ages 14-17 and the adult pathway only. Points are whole points on a square grid of size 6 to 20 (4 to 12 points, all different, at least 3 at different x); the line is counted in tenths: start is {slope, intercept} with slope from -30 to 30 and intercept from -50 to 150.`,
      `${REGRESSION}: the prompt asks to move the line until the squares are as small as possible; it never writes the slope or the intercept. The points must have a least squares line whose slope and intercept are both exact tenths inside the slider ranges (-3 to 3, -5 to 15), the points must not all lie on one line, and the start must not be that line.`,
      `${REGRESSION}: the rubric is {family: "line", target: {m, b}, parameter_tolerance: {absolute}, parameter_review?} with m and b the exact best slope and intercept and a tolerance of at most 0.05.`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

type Frac = { n: bigint; d: bigint };

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};
const frac = (n: bigint, d: bigint): Frac => {
  const g = gcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const compare = (a: Frac, b: Frac): number => {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
};

const DECIMAL = /^-?(0|[1-9]\d{0,14})(\.\d{1,12})?$/;
const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;

function readNumber(text: unknown): Frac | null {
  if (typeof text !== 'string' || text.length > 32) return null;
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const sign = negative ? -1n : 1n;
  if (DECIMAL.test(text)) {
    const [integer, fraction = ''] = body.split('.');
    return frac(sign * BigInt(`${integer}${fraction}`), 10n ** BigInt(fraction.length));
  }
  if (FRACTION.test(text)) {
    const [top, bottom] = body.split('/');
    return frac(sign * BigInt(top!), BigInt(bottom!));
  }
  return null;
}

const ZERO: Frac = { n: 0n, d: 1n };

type Ratio = { part: number; whole: number };
type Basis = { population: number; prior: Ratio; hit: Ratio; alarm: Ratio };
type Counts = { has: number; lacks: number; hasPos: number; hasNeg: number; lacksPos: number; lacksNeg: number };

const ratioOf = (value: unknown): Ratio | null =>
  hasOnly(value, ['part', 'whole']) && inRange(value.whole, 2, 1000) && inRange(value.part, 1, value.whole - 1) ? { part: value.part, whole: value.whole } : null;

function basisOf(payload: Record<string, unknown>): Basis | null {
  const prior = ratioOf(payload.prior);
  const hit = ratioOf(payload.hit);
  const alarm = ratioOf(payload.alarm);
  return inRange(payload.population, 100, 10_000) && prior && hit && alarm ? { population: payload.population, prior, hit, alarm } : null;
}

const share = (count: number, ratio: Ratio): number | null => {
  const scaled = count * ratio.part;
  return scaled % ratio.whole === 0 ? scaled / ratio.whole : null;
};

function countsOf(basis: Basis): Counts | null {
  const has = share(basis.population, basis.prior);
  if (has === null) return null;
  const lacks = basis.population - has;
  const hasPos = share(has, basis.hit);
  const lacksPos = share(lacks, basis.alarm);
  if (hasPos === null || lacksPos === null) return null;
  return { has, lacks, hasPos, hasNeg: has - hasPos, lacksPos, lacksNeg: lacks - lacksPos };
}

const valuesOf = (counts: Counts): number[] => [counts.has, counts.lacks, counts.hasPos, counts.hasNeg, counts.lacksPos, counts.lacksNeg];
const SLOTS = ['has', 'lacks', 'has-pos', 'has-neg', 'lacks-pos', 'lacks-neg'] as const;

type Report = (message: string) => void;
type Check = (payload: Record<string, unknown>, key: unknown, hasKey: boolean, report: Report) => void;

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
    const hasKey = answerKeys !== undefined && Object.hasOwn(answerKeys, segmentId);
    check(payload, hasKey ? answerKeys![segmentId] : undefined, hasKey, report);
  }
  return problems;
}

/** The tree a payload grows, or null after reporting why it cannot grow one. */
function growable(payload: Record<string, unknown>, extra: readonly string[], report: Report): { basis: Basis; counts: Counts } | null {
  if (!Object.keys(payload).every((name) => ['population', 'prior', 'hit', 'alarm', ...extra].includes(name))) {
    report(`The payload carries only the population, the three shares and ${extra.join(', ')}`);
    return null;
  }
  const basis = basisOf(payload);
  if (!basis) {
    report('The population is 100 to 10000 and each share is a part in a whole, with the part below the whole');
    return null;
  }
  const counts = countsOf(basis);
  if (!counts) {
    report('Every share must land on whole people');
    return null;
  }
  if (new Set(valuesOf(counts)).size !== SLOTS.length) {
    report('The six counts must all differ, so each count has one branch');
    return null;
  }
  return { basis, counts };
}

const treeGate: Check = (payload, key, hasKey, report) => {
  const grown = growable(payload, ['chips'], report);
  if (!grown) return;
  const { basis, counts } = grown;
  const chips = payload.chips;
  const tray = Array.isArray(chips) && chips.length >= 7 && chips.length <= 10 && chips.every((chip) => inRange(chip, 1, basis.population)) && new Set(chips).size === chips.length && valuesOf(counts).every((value) => chips.includes(value));
  if (!tray) return report('The tray holds the six counts and 1 to 4 more, all different, each a whole number of people up to the population');
  if (!hasKey) return;
  const wanted: Record<string, number> = { has: counts.has, lacks: counts.lacks, 'has-pos': counts.hasPos, 'has-neg': counts.hasNeg, 'lacks-pos': counts.lacksPos, 'lacks-neg': counts.lacksNeg };
  const solutions = record(key) && Array.isArray(key.solutions) ? key.solutions : null;
  const only = solutions && solutions.length === 1 ? solutions[0] : null;
  const matches = hasOnly(only, SLOTS) && SLOTS.every((slot) => {
    const given = only[slot];
    return Array.isArray(given) && given.length === 1 && given[0] === `n-${wanted[slot]}`;
  });
  if (!matches) report('The tree key must be the one arrangement with every head count on its own branch');
};

const bayesGate: Check = (payload, key, hasKey, report) => {
  const grown = growable(payload, ['ask'], report);
  if (!grown) return;
  const { counts } = grown;
  if (payload.ask !== 'positive' && payload.ask !== 'negative') return report('The question asks about a positive or a negative result');
  const top = payload.ask === 'positive' ? counts.hasPos : counts.hasNeg;
  const bottom = payload.ask === 'positive' ? counts.hasPos + counts.lacksPos : counts.hasNeg + counts.lacksNeg;
  if (20 * top < bottom || 20 * top > 19 * bottom) return report('The share asked for must be between 1 in 20 and 19 in 20');
  if (!hasKey) return;
  const answer = frac(BigInt(top), BigInt(bottom));
  const given = record(key) ? key : null;
  const target = given ? readNumber(given.target) : null;
  if (!given || !target || compare(target, answer) !== 0) return report(`The Bayes target must be ${top} in ${bottom}`);
  const met = hasOnly(given.tolerance, ['absolute']) ? readNumber(given.tolerance.absolute) : null;
  if (!met || compare(met, ZERO) < 0 || compare(met, frac(1n, 100n)) > 0) return report('The Bayes tolerance is at most 0.01');
  if (given.review === undefined) return;
  const near = hasOnly(given.review, ['absolute']) ? readNumber(given.review.absolute) : null;
  if (!near || compare(near, met) <= 0 || compare(near, frac(1n, 10n)) > 0) report('The Bayes review band is wider than the tolerance and at most 0.1');
};

type Point = { x: number; y: number };

function pointsOf(payload: Record<string, unknown>): { size: number; points: Point[] } | null {
  const { size, points } = payload;
  if (!inRange(size, 6, 20) || !Array.isArray(points) || points.length < 4 || points.length > 12) return null;
  if (!points.every((point) => hasOnly(point, ['x', 'y']) && inRange(point.x, 0, size) && inRange(point.y, 0, size))) return null;
  const list = points as Point[];
  if (new Set(list.map((point) => `${point.x},${point.y}`)).size !== list.length || new Set(list.map((point) => point.x)).size < 3) return null;
  return { size, points: list };
}

/** The least squares line in tenths, when both numbers are exact tenths inside the slider ranges. */
function fitTenths(points: readonly Point[]): { slope: number; intercept: number } | null {
  const n = points.length;
  const sx = points.reduce((sum, point) => sum + point.x, 0);
  const sy = points.reduce((sum, point) => sum + point.y, 0);
  const sxx = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const sxy = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const denominator = n * sxx - sx * sx;
  if (denominator === 0) return null;
  const slope = frac(BigInt(n * sxy - sx * sy), BigInt(denominator));
  const intercept = frac(BigInt(sy) * slope.d - slope.n * BigInt(sx), BigInt(n) * slope.d);
  const tenth = (value: Frac): number | null => {
    const scaled = frac(value.n * 10n, value.d);
    return scaled.d === 1n && scaled.n >= -1000n && scaled.n <= 1000n ? Number(scaled.n) : null;
  };
  const slopeTenths = tenth(slope);
  const interceptTenths = tenth(intercept);
  if (slopeTenths === null || interceptTenths === null || !inRange(slopeTenths, -30, 30) || !inRange(interceptTenths, -50, 150)) return null;
  return { slope: slopeTenths, intercept: interceptTenths };
}

const regressionGate: Check = (payload, key, hasKey, report) => {
  if (!Object.keys(payload).every((name) => ['size', 'points', 'start'].includes(name))) return report('The payload carries only the grid size, the points and the start line');
  const grid = pointsOf(payload);
  if (!grid) return report('The points are 4 to 12 different whole points on a grid of 6 to 20, at least 3 of them at different x');
  const start = payload.start;
  if (!hasOnly(start, ['slope', 'intercept']) || !inRange(start.slope, -30, 30) || !inRange(start.intercept, -50, 150)) return report('The start line is a slope from -30 to 30 and an intercept from -50 to 150, both in tenths');
  const fit = fitTenths(grid.points);
  if (!fit) return report('The best line must have its slope and intercept on the tenths grid, inside the slider ranges');
  if (grid.points.every((point) => 10 * point.y - fit.slope * point.x - fit.intercept === 0)) return report('The points must not all lie on one line');
  if (fit.slope === start.slope && fit.intercept === start.intercept) return report('The line must start away from the best line');
  if (!hasKey) return;
  const given = record(key) ? key : null;
  const target = given && hasOnly(given.target, ['m', 'b']) ? given.target : null;
  const m = target ? readNumber(target.m) : null;
  const b = target ? readNumber(target.b) : null;
  if (!given || given.family !== 'line' || !m || !b || compare(m, frac(BigInt(fit.slope), 10n)) !== 0 || compare(b, frac(BigInt(fit.intercept), 10n)) !== 0) {
    return report(`The regression target must be the best line, slope ${fit.slope / 10} and intercept ${fit.intercept / 10}`);
  }
  const met = hasOnly(given.parameter_tolerance, ['absolute']) ? readNumber(given.parameter_tolerance.absolute) : null;
  if (!met || compare(met, ZERO) < 0 || compare(met, frac(1n, 20n)) > 0) return report('The regression tolerance is at most 0.05');
  if (given.parameter_review === undefined) return;
  const near = hasOnly(given.parameter_review, ['absolute']) ? readNumber(given.parameter_review.absolute) : null;
  if (!near || compare(near, met) <= 0 || compare(near, frac(1n, 2n)) > 0) report('The regression review band is wider than the tolerance and at most 0.5');
};

/** Gate 4 (solvability), hand-mirrored from Core: every payload has one answer, and every key is that answer. */
function probGates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  return [
    ...visit(document, answerKeys, TREE, 'prob-tree', treeGate),
    ...visit(document, answerKeys, BAYES, 'natural-frequencies', bayesGate),
    ...visit(document, answerKeys, REGRESSION, 'regression-residuals', regressionGate),
  ];
}

export const prob = {
  id: 'prob',
  capabilities: PROB_CAPABILITIES,
  guidance: PROB_GUIDANCE,
  gates: probGates,
} as const satisfies ForgeHorizontePack;
