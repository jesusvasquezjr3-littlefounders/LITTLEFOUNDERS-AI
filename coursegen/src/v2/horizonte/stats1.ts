import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const STATS1_CAPABILITIES = {
  'stats.dot-plot.v2': ['visual.dot-plot.v1', 'operation.drag-point.v1', 'operation.move-menu.v1', 'operation.show-table.v1'],
  'stats.balance-point.v2': ['visual.balance-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.normal.v2': ['visual.normal-curve.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.binomial.v2': ['visual.binomial-bars.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'stats.clt.v2': ['visual.sampling-mean.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
} as const;

const DOT_PLOT = 'stats.dot-plot.v2';
const BALANCE = 'stats.balance-point.v2';
const NORMAL = 'stats.normal.v2';
const BINOMIAL = 'stats.binomial.v2';
const CLT = 'stats.clt.v2';

const STATS1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: DOT_PLOT,
    lines: [
      `${DOT_PLOT}: ages 10-14 only. Three to twelve whole dots on an axis 4 to 20 steps wide, one measure (mean, median or mode) and moves of 1 or 2.`,
      `${DOT_PLOT}: the prompt names the measure and writes the target number in digits ("Move up to two dots so the median is 6."); the payload never carries the target.`,
      `${DOT_PLOT}: choose a target that some allowed move reaches and that the start does not already have. A mode needs one most frequent value, so a tie is no mode.`,
    ],
  },
  {
    type: BALANCE,
    lines: [
      `${BALANCE}: ages 10-14 only. The dots balance on a whole position of the axis (their sum divides by their count) and the pivot starts somewhere else.`,
      `${BALANCE}: the prompt asks to slide the pivot until the beam balances and never gives the position.`,
    ],
  },
  {
    type: NORMAL,
    lines: [
      `${NORMAL}: ages 14-17 and the adult pathway only. The band is centred on a whole mean and its width is a whole number of times twice the rule (1, 2 or 3 spreads).`,
      `${NORMAL}: the prompt writes the band edges in digits and says they sit a number of standard deviations "either side of the mean"; it never gives the mean or the spread.`,
    ],
  },
  {
    type: BINOMIAL,
    lines: [
      `${BINOMIAL}: ages 14-17 and the adult pathway only. The prompt writes the goal mean and the goal variance in digits; the variance is below the mean.`,
      `${BINOMIAL}: the goal has exactly one pair: the percent is 100 minus 100 times the variance over the mean, a multiple of 5 from 5 to 95, and n is 100 times the mean over the percent, a whole number within nMax (at most 40).`,
    ],
  },
  {
    type: CLT,
    lines: [
      `${CLT}: ages 14-17 and the adult pathway only. The weights describe a population that is not a bell, 3 to 8 values, and the prompt writes in digits how many times smaller the spread of the mean must be.`,
      `${CLT}: the shrink is a whole number from 2 to 5 and the answer is its square, which must fit within nMax (at most 25).`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export type Axis = { min: number; max: number };

function axisOf(value: unknown, limit: number, spanMin: number, spanMax: number): Axis | null {
  if (!record(value) || !inRange(value.min, 0, limit) || !inRange(value.max, 0, limit)) return null;
  const span = value.max - value.min;
  return span >= spanMin && span <= spanMax ? { min: value.min, max: value.max } : null;
}

export const dotAxis = (value: unknown) => axisOf(value, 100, 4, 20);
export const curveAxis = (value: unknown) => axisOf(value, 200, 10, 200);

/** A plot holds 3 to 12 dots. */
export const DOT_COUNT = { min: 3, max: 12 } as const;

export function dotsOf(value: unknown, axis: Axis): number[] | null {
  return Array.isArray(value) && value.length >= DOT_COUNT.min && value.length <= DOT_COUNT.max && value.every((dot) => inRange(dot, axis.min, axis.max)) ? (value as number[]) : null;
}

function medianTwice(dots: readonly number[]): number {
  const sorted = [...dots].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? 2 * sorted[middle]! : sorted[middle - 1]! + sorted[middle]!;
}

function singleMode(dots: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const dot of dots) counts.set(dot, (counts.get(dot) ?? 0) + 1);
  let best = 0;
  let mode: number | null = null;
  for (const [dot, count] of counts) {
    if (count > best) { best = count; mode = dot; } else if (count === best) mode = null;
  }
  return mode;
}

export function measureMet(measure: string, dots: readonly number[], target: number): boolean {
  if (measure === 'mean') return sum(dots) === target * dots.length;
  return measure === 'median' ? medianTwice(dots) === 2 * target : singleMode(dots) === target;
}

/** The whole value a measure takes on these dots, or null when it is no whole number (a mean or a median can fall between two steps, a tie has no mode). A whole target is met exactly when it equals this value. */
export function measureValue(measure: string, dots: readonly number[]): number | null {
  if (measure === 'mean') return sum(dots) % dots.length === 0 ? sum(dots) / dots.length : null;
  if (measure === 'median') return medianTwice(dots) % 2 === 0 ? medianTwice(dots) / 2 : null;
  return measure === 'mode' ? singleMode(dots) : null;
}

/** Breadth-first over count vectors: can at most `moves` single-dot moves bring the measure to the target, from a start that does not have it? */
export function reachable(start: readonly number[], axis: Axis, measure: string, moves: number, target: number): boolean {
  if (!inRange(target, axis.min, axis.max) || measureMet(measure, start, target)) return false;
  const width = axis.max - axis.min + 1;
  const first = new Array<number>(width).fill(0);
  for (const dot of start) first[dot - axis.min] = first[dot - axis.min]! + 1;
  const expand = (counts: readonly number[]) => counts.flatMap((count, index) => new Array<number>(count).fill(axis.min + index));
  const seen = new Set<string>([first.join(',')]);
  let frontier = [first];
  for (let step = 0; step < moves; step += 1) {
    const next: number[][] = [];
    for (const counts of frontier) {
      for (let from = 0; from < width; from += 1) {
        if (counts[from]! < 1) continue;
        for (let to = 0; to < width; to += 1) {
          if (to === from) continue;
          const moved = counts.slice();
          moved[from] = counts[from]! - 1;
          moved[to] = counts[to]! + 1;
          const key = moved.join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          if (measureMet(measure, expand(moved), target)) return true;
          next.push(moved);
        }
      }
    }
    frontier = next;
  }
  return false;
}

export function solveNormal(axis: Axis, band: Record<string, unknown>, sdMax: number): { mean: number; sd: number } | null {
  const { rule, low, high } = band;
  if (!inRange(rule, 1, 3) || !inRange(low, axis.min, axis.max) || !inRange(high, axis.min, axis.max) || high <= low) return null;
  const width = high - low;
  if ((low + high) % 2 !== 0 || width % (2 * rule) !== 0) return null;
  const answer = { mean: (low + high) / 2, sd: width / (2 * rule) };
  return inRange(answer.mean, axis.min, axis.max) && inRange(answer.sd, 1, sdMax) ? answer : null;
}

export const onGrid = (pct: unknown): pct is number => inRange(pct, 5, 95) && (pct - 5) % 5 === 0;

export function solveBinomial(goal: Record<string, unknown>, nMax: number): { n: number; pct: number } | null {
  const { mean, variance } = goal;
  if (!inRange(mean, 1, 40) || !inRange(variance, 1, 40) || variance >= mean || (100 * variance) % mean !== 0) return null;
  const pct = 100 - (100 * variance) / mean;
  if (!onGrid(pct) || (100 * mean) % pct !== 0) return null;
  const n = (100 * mean) / pct;
  return inRange(n, 1, nMax) ? { n, pct } : null;
}

const namesNumber = (prompt: unknown, value: unknown): boolean =>
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

const dotPlotGate: Check = (segment, payload, key, report) => {
  const axis = dotAxis(payload.axis);
  if (!axis) return report('The dot plot axis runs from 0 to 100 and is 4 to 20 steps wide');
  const dots = dotsOf(payload.dots, axis);
  if (!dots) return report('The dot plot has 3 to 12 whole dots, each on the axis');
  const measure = payload.measure;
  if (measure !== 'mean' && measure !== 'median' && measure !== 'mode') return report('The dot plot measure is mean, median or mode');
  const moves = payload.moves;
  if (!inRange(moves, 1, 2)) return report('The dot plot lets 1 or 2 dots move');
  if (key === undefined) return;
  const target = key?.target;
  if (!inRange(target, axis.min, axis.max)) return report('The dot plot target must be a whole value on the axis');
  if (measureMet(measure, dots, target)) return report('The dot plot start must not already have the target measure');
  if (!reachable(dots, axis, measure, moves, target)) return report(`No ${moves} dot moves bring the ${measure} to ${target}`);
  if (!namesNumber(segment.prompt, target)) report('The dot plot prompt must write the target number in digits');
};

const balanceGate: Check = (_segment, payload, key, report) => {
  const axis = dotAxis(payload.axis);
  if (!axis) return report('The balance axis runs from 0 to 100 and is 4 to 20 steps wide');
  const dots = dotsOf(payload.dots, axis);
  if (!dots) return report('The beam has 3 to 12 whole dots, each on the axis');
  const total = sum(dots);
  if (total % dots.length !== 0) return report('The dots must balance on a whole position of the axis');
  const point = total / dots.length;
  if (!inRange(payload.pivot, axis.min, axis.max)) return report('The pivot must start on the axis');
  if (payload.pivot === point) return report('The pivot must start away from the balance point');
  if (key === undefined) return;
  if (key?.target !== point) report(`The balance target must be ${point}, the mean of the dots`);
};

const normalGate: Check = (segment, payload, key, report) => {
  const axis = curveAxis(payload.axis);
  if (!axis) return report('The curve axis runs from 0 to 200 and is at least 10 steps wide');
  const sdMax = payload.sdMax;
  const start = payload.start;
  if (!inRange(sdMax, 1, 30) || !record(start) || !inRange(start.mean, axis.min, axis.max) || !inRange(start.sd, 1, sdMax)) return report('The curve start is a mean on the axis and a spread from 1 to sdMax');
  const band = record(payload.band) ? payload.band : null;
  const answer = band ? solveNormal(axis, band, sdMax) : null;
  if (!band || !answer) return report('The band must be centred on a whole mean, a whole number of spreads wide, and on the axis');
  if (answer.mean === start.mean && answer.sd === start.sd) return report('The curve must start away from the answer');
  if (!namesNumber(segment.prompt, band.low) || !namesNumber(segment.prompt, band.high)) report('The normal prompt must write both band edges in digits');
  if (typeof segment.prompt !== 'string' || !/either side|cada lado/i.test(segment.prompt)) report('The normal prompt must say the band sits either side of the mean');
  if (key === undefined) return;
  const target = key?.target;
  if (!record(target) || target.mean !== answer.mean || target.sd !== answer.sd) report(`The normal target must be mean ${answer.mean} and spread ${answer.sd}`);
};

const binomialGate: Check = (segment, payload, key, report) => {
  const nMax = payload.nMax;
  const start = payload.start;
  if (!inRange(nMax, 1, 40) || !record(start) || !inRange(start.n, 1, nMax) || !onGrid(start.pct)) return report('The binomial start is a count up to nMax and a percent on the 5 step grid');
  const goal = record(payload.goal) ? payload.goal : null;
  const answer = goal ? solveBinomial(goal, nMax) : null;
  if (!goal || !answer) return report('The goal needs exactly one count and percent on the 5 step grid for its mean and variance');
  if (answer.n === start.n && answer.pct === start.pct) return report('The binomial must start away from the answer');
  if (!namesNumber(segment.prompt, goal.mean) || !namesNumber(segment.prompt, goal.variance)) report('The binomial prompt must write the goal mean and variance in digits');
  if (key === undefined) return;
  const target = key?.target;
  if (!record(target) || target.n !== answer.n || target.pct !== answer.pct) report(`The binomial target must be n ${answer.n} at ${answer.pct} percent`);
};

const cltGate: Check = (segment, payload, key, report) => {
  const weights = payload.weights;
  if (!Array.isArray(weights) || weights.length < 3 || weights.length > 8 || !weights.every((weight) => inRange(weight, 0, 20)) || !weights.some((weight) => weight > 0)) return report('The weights are 3 to 8 whole numbers from 0 to 20 and at least one is above zero');
  const nMax = payload.nMax;
  const start = payload.start;
  if (!inRange(nMax, 1, 25) || !record(start) || !inRange(start.n, 1, nMax)) return report('The sample size starts between 1 and nMax');
  const goal = record(payload.goal) ? payload.goal : null;
  if (!goal || !inRange(goal.shrink, 2, 5)) return report('The shrink factor is a whole number from 2 to 5');
  const answer = goal.shrink * goal.shrink;
  if (answer > nMax) return report(`The sample size ${answer} must fit within nMax`);
  if (answer === start.n) return report('The sample size must start away from the answer');
  if (!namesNumber(segment.prompt, goal.shrink)) report('The CLT prompt must write the shrink factor in digits');
  if (key === undefined) return;
  const target = key?.target;
  if (!record(target) || target.n !== answer) report(`The CLT target must be n ${answer}`);
};

/** Gate 4 (solvability), hand-mirrored from Core: every key is the one answer the payload allows, and a prompt writes the numbers the learner needs. */
function stats1Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  return [
    ...visit(document, answerKeys, DOT_PLOT, 'dot-plot', dotPlotGate),
    ...visit(document, answerKeys, BALANCE, 'balance-point', balanceGate),
    ...visit(document, answerKeys, NORMAL, 'normal-curve', normalGate),
    ...visit(document, answerKeys, BINOMIAL, 'binomial-bars', binomialGate),
    ...visit(document, answerKeys, CLT, 'sampling-mean', cltGate),
  ];
}

export const stats1 = {
  id: 'stats1',
  capabilities: STATS1_CAPABILITIES,
  guidance: STATS1_GUIDANCE,
  gates: stats1Gates,
} as const satisfies ForgeHorizontePack;
