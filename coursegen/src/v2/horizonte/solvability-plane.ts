import {
  Budget, asRecord, budgetIssue, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityCode, type SolvabilityIssue,
} from '../solvability.js';
import { crossingOf, isCrossing, pointKey, readSystemPayload, sameSpots, type PlaneLine, type PlanePoint } from './alg2Model.js';
import { RATE_RETURN, cardRun, rateAnswer, readRate, type RateCase } from './fin1.js';
import {
  PLANE1_NAMED, namesNumber, solveBreakEven, solveCost, solveElastic, solveLinked, solveMarket, solveMarkup, solveRate, solveSlope, type Solved,
} from './plane1.js';

const SLOPE = 'alg.slope-triangle.v2';
const RATE = 'alg.rate-of-change.v2';
const LINKED = 'alg.linked-views.v2';
const BREAK_EVEN = 'fin.break-even.v2';
const COST = 'fin.cost-structure.v2';
const MARKUP = 'fin.margin-markup.v2';
const MARKET = 'econ.market-shift.v2';
const ELASTICITY = 'econ.elasticity.v2';
const LINE_SYSTEM = 'math.line-system.v2';

export const PLANE_SOLVABILITY_TYPES = [SLOPE, RATE, LINKED, BREAK_EVEN, COST, MARKUP, MARKET, ELASTICITY, RATE_RETURN, LINE_SYSTEM] as const;

const rec = (value: unknown): Record<string, unknown> => asRecord(value) ?? {};
const num = (value: unknown): number => (typeof value === 'number' ? value : Number.NaN);
const wholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  const record = asRecord(value);
  return !!record && Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key));
};

/* ── plane1: the eight board types. Each solver of the pack names why a payload fails; the checkers add a scan of every value the board's controls offer. ── */

const NO_ANSWER = /divides by|rise for this run|slope through the points|a whole price|clears at/;

function classify(message: string): SolvabilityCode {
  if (/away from the answer|^The payload is /.test(message)) return 'impossible-state';
  return NO_ANSWER.test(message) ? 'no-solution' : 'out-of-bounds';
}

const failure = (subject: string, message: string) => result([issue(classify(message), `${subject}: ${message}`)]);

/** The scan found none, many, or a value that is not the one the model derived. */
function diagnose(subject: string, what: string, hits: readonly string[], answer: string): SolvabilityIssue[] {
  if (hits.length === 0) return [issue('no-solution', `${subject}: no ${what} on the board's controls meets the goal`)];
  if (hits.length > 1) return [issue('ambiguous-solution', `${subject}: ${hits.length} values of the ${what} meet the goal (${hits.slice(0, 5).join(' | ')}), so no single answer is the key`)];
  if (hits[0] !== answer) return [issue('impossible-state', `${subject}: the controls meet the goal only at ${hits[0]}, but the model answer is ${answer}`)];
  return [];
}

function promptIssues(type: keyof typeof PLANE1_NAMED, subject: string, prompt: string | undefined, payload: Record<string, unknown>): SolvabilityIssue[] {
  if (prompt === undefined) return [];
  const missing = PLANE1_NAMED[type](payload).filter((value) => !namesNumber(prompt, value));
  return missing.length === 0 ? [] : [issue('no-solution', `${subject}: the prompt does not write ${missing.map(String).join(', ')} in digits, so the learner cannot read every number the answer needs`)];
}

function numberKeyIssues(subject: string, key: unknown, answer: number): SolvabilityIssue[] {
  if (!hasOnly(key, ['target']) || !wholeNumber(key.target)) return [issue('rubric-gap', `${subject}: the key is exactly { target } with a whole number, so no response can be marked right`)];
  return key.target === answer ? [] : [issue('rubric-accepts-invalid', `${subject}: the key's target ${key.target} is not the answer ${answer}, so the right value is marked wrong`)];
}

interface SingleKind {
  type: keyof typeof PLANE1_NAMED;
  label: string;
  what: string;
  solve: (payload: Record<string, unknown>) => Solved<number>;
  controls: (payload: Record<string, unknown>) => { low: number; high: number };
  meets: (payload: Record<string, unknown>, value: number) => boolean;
}

const fromOf = (p: Record<string, unknown>) => rec(rec(p.line).from);
const toOf = (p: Record<string, unknown>) => rec(rec(p.line).to);

const SINGLE_KINDS: readonly SingleKind[] = [
  {
    type: SLOPE, label: 'slope triangle', what: 'rise', solve: solveSlope,
    controls: (p) => ({ low: 0, high: num(rec(p.grid).yMax) - num(fromOf(p).y) }),
    meets: (p, rise) => rise * (num(toOf(p).x) - num(fromOf(p).x)) === (num(toOf(p).y) - num(fromOf(p).y)) * num(p.run),
  },
  {
    type: RATE, label: 'rate of change', what: 'value', solve: solveRate,
    controls: (p) => ({ low: num(rec(p.grid).yMin), high: num(rec(p.grid).yMax) }),
    meets: (p, value) => value === num(rec(p.origin).y) + num(p.rate) * (num(p.at) - num(rec(p.origin).x)),
  },
  {
    type: BREAK_EVEN, label: 'break-even', what: 'number of units', solve: solveBreakEven,
    controls: (p) => ({ low: 0, high: num(p.maxUnits) }),
    meets: (p, units) => num(p.price) * units === num(p.fixed) + num(p.unit) * units,
  },
  {
    type: COST, label: 'cost structure', what: 'number of units', solve: solveCost,
    controls: (p) => ({ low: 1, high: num(p.maxUnits) }),
    meets: (p, units) => num(p.fixed) + num(p.variable) * units === num(rec(p.goal).average) * units,
  },
  {
    type: MARKUP, label: 'margin and markup', what: 'price', solve: solveMarkup,
    controls: (p) => ({ low: 0, high: num(p.maxPrice) }),
    meets: (p, price) => price > num(p.cost) && (p.basis === 'markup'
      ? 100 * price === num(p.cost) * (100 + num(p.percent))
      : (price - num(p.cost)) * 100 === num(p.percent) * price),
  },
  {
    type: ELASTICITY, label: 'elasticity', what: 'price', solve: solveElastic,
    controls: (p) => ({ low: 1, high: num(p.pMax) }),
    meets: (p, price) => {
      const quantity = num(rec(p.demand).a) - num(rec(p.demand).b) * price;
      return quantity > 0 && num(rec(p.goal).den) * num(rec(p.demand).b) * price === num(rec(p.goal).num) * quantity;
    },
  },
];

function singleChecker(kind: SingleKind): SolvabilityChecker {
  return (segment, context) => {
    const subject = `${kind.label} ${segment.id}`;
    const solved = kind.solve(segment.payload);
    if (solved.message !== undefined) return failure(subject, solved.message);
    const budget = new Budget(context.nodeBudget);
    const { low, high } = kind.controls(segment.payload);
    const hits: string[] = [];
    for (let value = low; value <= high; value += 1) {
      if (!budget.spend()) return result([budgetIssue(subject, budget.limit, `the one ${kind.what} that meets the goal`)]);
      if (kind.meets(segment.payload, value)) hits.push(String(value));
    }
    const issues = [...diagnose(subject, kind.what, hits, String(solved.answer)), ...promptIssues(kind.type, subject, segment.prompt, segment.payload)];
    if (context.answerKey !== undefined && issues.length === 0) issues.push(...numberKeyIssues(subject, context.answerKey, solved.answer));
    return result(issues, { controls: high - low + 1, hits: hits.length, nodes: budget.used });
  };
}

const linkedChecker: SolvabilityChecker = (segment, context) => {
  const subject = `linked views ${segment.id}`;
  const payload = segment.payload;
  const solved = solveLinked(payload);
  if (solved.message !== undefined) return failure(subject, solved.message);
  const budget = new Budget(context.nodeBudget);
  const given = (payload.given as unknown[]).map(rec);
  const hits: string[] = [];
  for (let m = -9; m <= 9; m += 1) {
    for (let b = num(rec(payload.grid).yMin); b <= num(rec(payload.grid).yMax); b += 1) {
      if (!budget.spend()) return result([budgetIssue(subject, budget.limit, 'the one slope and intercept through both points')]);
      if (given.every((point) => m * num(point.x) + b === num(point.y))) hits.push(`slope ${m} and intercept ${b}`);
    }
  }
  const answer = `slope ${solved.answer.m} and intercept ${solved.answer.b}`;
  const issues = [...diagnose(subject, 'line', hits, answer), ...promptIssues(LINKED, subject, segment.prompt, payload)];
  if (context.answerKey !== undefined && issues.length === 0) {
    const key = rec(context.answerKey);
    const target = key.target;
    if (!hasOnly(context.answerKey, ['target']) || !hasOnly(target, ['m', 'b']) || !wholeNumber(target.m) || !wholeNumber(target.b)) {
      issues.push(issue('rubric-gap', `${subject}: the key is exactly { target: { m, b } } with whole numbers, so no response can be marked right`));
    } else if (target.m !== solved.answer.m || target.b !== solved.answer.b) {
      issues.push(issue('rubric-accepts-invalid', `${subject}: the key's target slope ${target.m} and intercept ${target.b} is not the line through both points (${answer}), so the right line is marked wrong`));
    }
  }
  return result(issues, { controls: budget.used, hits: hits.length, nodes: budget.used });
};

const marketChecker: SolvabilityChecker = (segment, context) => {
  const subject = `market shift ${segment.id}`;
  const payload = segment.payload;
  const solved = solveMarket(payload);
  if (solved.message !== undefined) return failure(subject, solved.message);
  const budget = new Budget(context.nodeBudget);
  const { pMax, qMax } = { pMax: num(payload.pMax), qMax: num(payload.qMax) };
  const demand = rec(payload.demand);
  const supply = rec(payload.supply);
  const shift = rec(payload.shift);
  const by = num(shift.by);
  const slopes = { b: num(demand.b), d: num(supply.d) };
  const clearingPrices = (a: number, c: number): string[] | null => {
    const found: string[] = [];
    for (let price = 0; price <= pMax; price += 1) {
      if (!budget.spend()) return null;
      const quantity = a - slopes.b * price;
      if (quantity === c + slopes.d * price && quantity >= 1 && quantity <= qMax) found.push(String(price));
    }
    return found;
  };
  const before = clearingPrices(num(demand.a), num(supply.c));
  const after = before && clearingPrices(num(demand.a) + (shift.curve === 'demand' ? by : 0), num(supply.c) + (shift.curve === 'supply' ? by : 0));
  if (!before || !after) return result([budgetIssue(subject, budget.limit, 'the price before and after the shift')]);
  const issues = [
    ...diagnose(`${subject} (before the shift)`, 'price', before, String(before[0])),
    ...diagnose(`${subject} (after the shift)`, 'price', after, String(solved.answer.price)),
    ...promptIssues(MARKET, subject, segment.prompt, payload),
  ];
  if (issues.length === 0 && Number(after[0]) === Number(before[0])) issues.push(issue('impossible-state', `${subject}: the shift leaves the price where it was, so there is no direction to name`));
  if (issues.length === 0 && (Number(after[0]) > Number(before[0]) ? 'up' : 'down') !== solved.answer.direction) {
    issues.push(issue('impossible-state', `${subject}: the prices before (${before[0]}) and after (${after[0]}) the shift do not give the model direction ${solved.answer.direction}`));
  }
  if (context.answerKey !== undefined && issues.length === 0) {
    const target = rec(context.answerKey).target;
    if (!hasOnly(context.answerKey, ['target']) || !hasOnly(target, ['direction', 'price']) || (target.direction !== 'up' && target.direction !== 'down') || !wholeNumber(target.price)) {
      issues.push(issue('rubric-gap', `${subject}: the key is exactly { target: { direction, price } } with direction up or down, so no response can be marked right`));
    } else if (target.direction !== solved.answer.direction || target.price !== solved.answer.price) {
      issues.push(issue('rubric-accepts-invalid', `${subject}: the key's target (${target.direction}, ${target.price}) is not the answer (${solved.answer.direction}, ${solved.answer.price}), so the right response is marked wrong`));
    }
  }
  return result(issues, { controls: 2 * (pMax + 1), hits: before.length + after.length, nodes: budget.used });
};

/* ── money.rate-return.v2: a typed number, so the proof is about the figure, its band and the shortcut that lands inside it. ── */

type Q = { n: bigint; d: bigint };
type Band = { absolute: Q; bps: bigint };

const DECIMAL = /^-?(0|[1-9]\d{0,14})(\.\d{1,12})?$/;
const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;
const ZERO: Q = { n: 0n, d: 1n };
const ONE: Q = { n: 1n, d: 1n };
const qAbs = (a: Q): Q => ({ n: a.n < 0n ? -a.n : a.n, d: a.d });
const qSub = (a: Q, b: Q): Q => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const qCmp = (a: Q, b: Q): number => { const left = a.n * b.d; const right = b.n * a.d; return left < right ? -1 : left > right ? 1 : 0; };

function parseQ(value: unknown): Q | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const negative = value.startsWith('-');
  const body = negative ? value.slice(1) : value;
  if (DECIMAL.test(value)) {
    const [integer = '0', fraction = ''] = body.split('.');
    return { n: BigInt(`${integer}${fraction}`) * (negative ? -1n : 1n), d: 10n ** BigInt(fraction.length) };
  }
  if (FRACTION.test(value)) {
    const [top = '0', bottom = '1'] = body.split('/');
    return { n: BigInt(top) * (negative ? -1n : 1n), d: BigInt(bottom) };
  }
  return null;
}

function show(value: Q): string {
  const scaled = (qAbs(value).n * 200n + value.d) / (2n * value.d);
  return `${value.n < 0n && scaled !== 0n ? '-' : ''}${scaled / 100n}.${String(scaled % 100n).padStart(2, '0')}`;
}

function readBand(value: unknown, name: string): Band | string {
  const record = asRecord(value);
  if (!record || Object.keys(record).some((key) => key !== 'absolute' && key !== 'relative_bps')) return `the key's ${name} has only absolute and relative_bps`;
  let absolute = ZERO;
  if (record.absolute !== undefined) {
    const parsed = parseQ(record.absolute);
    if (!parsed || parsed.n < 0n) return `the key's ${name}.absolute is plain decimal text such as "0.05"`;
    absolute = parsed;
  }
  const bps = record.relative_bps;
  if (bps !== undefined && (!wholeNumber(bps) || bps < 0 || bps > 10_000)) return `the key's ${name}.relative_bps is a whole number from 0 to 10000`;
  return { absolute, bps: BigInt(bps === undefined ? 0 : (bps as number)) };
}

function allowanceAt(band: Band, target: Q): Q {
  const relative: Q = { n: qAbs(target).n * band.bps, d: target.d * 10_000n };
  return qCmp(relative, band.absolute) > 0 ? relative : band.absolute;
}

const RATE_STEPS = { effective: 1, npv: 2, irr: 40 } as const;

function failureCode(rate: RateCase): SolvabilityCode {
  switch (rate.kind) {
    case 'effective': return 'impossible-state';
    case 'card': return 'no-solution';
    case 'npv': return 'out-of-bounds';
    case 'irr': return rate.flows.reduce((sum, cents) => sum + cents, 0) > rate.outlay ? 'out-of-bounds' : 'no-solution';
  }
}

function shortcuts(rate: RateCase): Array<{ name: string; value: Q }> {
  switch (rate.kind) {
    case 'effective': return [{ name: 'nominal rate', value: { n: BigInt(rate.nominalBps), d: 100n } }];
    case 'card': {
      const run = rate.ask === 'interest' ? cardRun(rate) : null;
      return run ? [{ name: 'flat interest on the starting balance over the same months', value: { n: BigInt(rate.balance) * BigInt(rate.aprBps) * BigInt(run.months), d: 12n * 10_000n * 100n } }] : [];
    }
    case 'npv': return [{ name: 'undiscounted total less the outlay', value: { n: BigInt(rate.flows.reduce((sum, cents) => sum + cents, 0) - rate.outlay), d: 100n } }];
    case 'irr': return [{ name: 'simple average yearly return', value: { n: BigInt(rate.flows.reduce((sum, cents) => sum + cents, 0) - rate.outlay) * 100n, d: BigInt(rate.outlay * rate.flows.length) } }];
  }
}

export const rateReturnChecker: SolvabilityChecker = (segment, context) => {
  const subject = `rate case ${segment.id}`;
  const rate = readRate(segment.payload);
  if (typeof rate === 'string') return result([issue('impossible-state', `${subject}: ${rate}`)]);
  const budget = new Budget(context.nodeBudget);
  const steps = rate.kind === 'card' ? (rate.ask === 'interest' ? 2 : 1) * 600 : RATE_STEPS[rate.kind];
  if (!budget.spend(steps)) return result([budgetIssue(subject, budget.limit, 'the model answer of the case')]);
  const answer = rateAnswer(rate);
  if (typeof answer === 'string') return result([issue(failureCode(rate), `${subject}: ${answer}`)]);
  const figure = parseQ(answer.text)!;
  const isMonths = rate.kind === 'card' && rate.ask === 'months';
  const keyed = context.answerKey !== undefined;
  const issues: SolvabilityIssue[] = [];
  let tolerance: Band = { absolute: parseQ(isMonths ? '0' : rate.kind === 'irr' ? '0.1' : '0.05')!, bps: 0n };
  let readable = true;
  if (keyed) {
    const key = asRecord(context.answerKey);
    if (!key || typeof key.target !== 'string' || Object.keys(key).some((name) => name !== 'target' && name !== 'tolerance' && name !== 'review')) {
      issues.push(issue('rubric-gap', `${subject}: the key is { target, tolerance?, review? } with the target as decimal text, so no response can be marked right`));
      readable = false;
    } else {
      const target = parseQ(key.target);
      if (!target) { issues.push(issue('rubric-gap', `${subject}: the key's target is not plain decimal text`)); readable = false; }
      else if (qCmp(target, figure) !== 0) { issues.push(issue('rubric-accepts-invalid', `${subject}: the key's target ${key.target} is not the model answer ${answer.text}, so the right figure is marked wrong`)); readable = false; }
      const met = key.tolerance === undefined ? { absolute: ZERO, bps: 0n } : readBand(key.tolerance, 'tolerance');
      if (typeof met === 'string') { issues.push(issue('rubric-gap', `${subject}: ${met}`)); readable = false; }
      else {
        tolerance = met;
        if (key.review !== undefined) {
          const near = readBand(key.review, 'review');
          if (typeof near === 'string') { issues.push(issue('rubric-gap', `${subject}: ${near}`)); readable = false; }
          else if (qCmp(allowanceAt(near, figure), allowanceAt(met, figure)) <= 0) {
            issues.push(issue('rubric-gap', `${subject}: the key's review band is not wider than its tolerance, so Core never grades the key`));
            readable = false;
          }
        }
      }
    }
  }
  if (readable) {
    const allowance = allowanceAt(tolerance, figure);
    const severity = keyed ? 'block' : 'review';
    const width = qSub(parseQ(String(answer.maximum))!, parseQ(String(answer.minimum))!);
    if (keyed && qCmp(allowance, width) >= 0) issues.push(issue('vacuous-rubric', `${subject}: the tolerance spans the whole answer range, so any value in it is marked right`));
    if (isMonths && qCmp(allowance, ONE) >= 0) issues.push(issue('rubric-accepts-invalid', `${subject}: the tolerance admits the neighbouring months as well as ${answer.text}, so the answer is not one whole number`, { severity }));
    for (const shortcut of shortcuts(rate)) {
      const gap = qAbs(qSub(shortcut.value, figure));
      if (gap.n > 0n && qCmp(gap, allowance) <= 0) {
        issues.push(issue('rubric-accepts-invalid', `${subject}: the ${shortcut.name} (${show(shortcut.value)}) is within ${show(allowance)} of the answer ${answer.text}, so the shortcut is marked right${keyed ? '' : ' at the guidance tolerance'}; tighten the tolerance or change the case`, { severity }));
      }
    }
    if (keyed && rate.kind === 'irr') {
      const hundredths = figure.n * 100n / figure.d;
      const off = hundredths % 10n < 5n ? hundredths % 10n : 10n - (hundredths % 10n);
      if (off * allowance.d > allowance.n * 100n) issues.push(issue('dead-end', `${subject}: the rate dial moves in tenths of a percent and none of its positions is within ${show(allowance)} of ${answer.text}`));
    }
  }
  return result(issues, { nodes: budget.used });
};

/* ── math.line-system.v2: markers move over a grid, the answer is the set of crossings. ── */

function crossingCount(lines: readonly PlaneLine[]): number {
  const seen = new Set<string>();
  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const at = crossingOf(lines[left]!, lines[right]!);
      if (at) seen.add(`${at.x.n}/${at.x.d},${at.y.n}/${at.y.d}`);
    }
  }
  return seen.size;
}

function systemFailure(subject: string, message: string, payload: Record<string, unknown>): SolvabilityIssue {
  if (/must differ/.test(message)) return issue('ambiguous-solution', `${subject}: ${message}; two copies of one line cross everywhere, so every point on it is an answer`);
  if (/one marker for each crossing/.test(message)) {
    const crossings = crossingCount(payload.lines as PlaneLine[]);
    const markers = (payload.start as unknown[]).length;
    return crossings > markers
      ? issue('ambiguous-solution', `${subject}: the lines cross at ${crossings} spots but there are only ${markers} markers, so any ${markers} of them would do`)
      : issue('no-solution', `${subject}: the lines cross at ${crossings} spot${crossings === 1 ? '' : 's'} for ${markers} markers, so a marker has no crossing to reach`);
  }
  if (/different spots/.test(message)) return issue('overlap', `${subject}: ${message}`);
  if (/marker starts|crossing lies|window edge|window is whole|window is 4/.test(message)) return issue('out-of-bounds', `${subject}: ${message}`);
  return issue('impossible-state', `${subject}: ${message}`);
}

export const lineSystemChecker: SolvabilityChecker = (segment, context) => {
  const subject = `line system ${segment.id}`;
  const read = readSystemPayload(segment.payload);
  if (typeof read === 'string') return result([systemFailure(subject, read, segment.payload)]);
  const budget = new Budget(context.nodeBudget);
  const step = Math.round(read.grid * 2);
  const found: PlanePoint[] = [];
  for (let x = 2 * read.window.xMin; x <= 2 * read.window.xMax; x += step) {
    for (let y = 2 * read.window.yMin; y <= 2 * read.window.yMax; y += step) {
      if (!budget.spend()) return result([budgetIssue(subject, budget.limit, 'every crossing of the lines on the grid')]);
      if (read.lines.filter((line) => line.a * x + line.b * y === 2 * line.c).length >= 2) found.push({ x: x / 2, y: y / 2 });
    }
  }
  const issues: SolvabilityIssue[] = [];
  const markers = read.start.length;
  if (found.length < markers) issues.push(issue('no-solution', `${subject}: only ${found.length} crossing${found.length === 1 ? '' : 's'} sit on the grid in the window for ${markers} markers`));
  else if (found.length > markers) issues.push(issue('ambiguous-solution', `${subject}: ${found.length} crossings sit on the grid for ${markers} markers, so no single set of spots is the key`));
  else if (sameSpots(read.start, found)) issues.push(issue('impossible-state', `${subject}: every marker already starts on a crossing, so there is nothing to move`));
  if (context.answerKey !== undefined && issues.length === 0) {
    const key = asRecord(context.answerKey);
    const required = key && hasOnly(key, ['required']) && Array.isArray(key.required) ? key.required : null;
    const spots: PlanePoint[] = [];
    if (!required || !required.every((item) => hasOnly(item, ['x', 'y']) && Number.isFinite(item.x) && Number.isFinite(item.y) && typeof item.x === 'number' && typeof item.y === 'number')) {
      issues.push(issue('rubric-gap', `${subject}: the key is exactly { required: [{ x, y }, ...] } with finite coordinates, so no response can be marked right`));
    } else {
      for (const item of required as PlanePoint[]) spots.push({ x: item.x, y: item.y });
      for (const spot of spots) {
        if (!isCrossing(read.lines, spot)) issues.push(issue('rubric-accepts-invalid', `${subject}: the key requires (${spot.x}, ${spot.y}), which is not a crossing of two lines`));
      }
      const keyed = new Set(spots.map(pointKey));
      if (keyed.size !== spots.length) issues.push(issue('rubric-gap', `${subject}: the key lists the same spot twice, so a marker is left without a crossing`));
      const left = found.filter((spot) => !keyed.has(pointKey(spot)));
      if (left.length > 0) issues.push(issue('rubric-gap', `${subject}: the key leaves out the crossing at ${left.slice(0, 3).map((spot) => `(${spot.x}, ${spot.y})`).join(', ')}, so a right answer is marked wrong`));
      if (issues.length === 0 && spots.length !== markers) issues.push(issue('rubric-gap', `${subject}: the key lists ${spots.length} spots for ${markers} markers`));
      if (issues.length === 0 && sameSpots(read.start, spots)) issues.push(issue('impossible-state', `${subject}: the key is already met by the markers' start`));
    }
  }
  return result(issues, { lattice: Math.floor((2 * (read.window.xMax - read.window.xMin)) / step + 1) * Math.floor((2 * (read.window.yMax - read.window.yMin)) / step + 1), crossings: found.length, nodes: budget.used });
};

for (const kind of SINGLE_KINDS) registerSolvabilityChecker(kind.type, singleChecker(kind));
registerSolvabilityChecker(LINKED, linkedChecker);
registerSolvabilityChecker(MARKET, marketChecker);
registerSolvabilityChecker(RATE_RETURN, rateReturnChecker);
registerSolvabilityChecker(LINE_SYSTEM, lineSystemChecker);
