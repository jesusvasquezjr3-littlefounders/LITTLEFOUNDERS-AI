import type { GateProblem } from '../../pipeline/gates.js';
import { Budget, asRecord, budgetIssue, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityIssue } from '../solvability.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const FIN1_CAPABILITIES = {
  'money.compound-interest.v2': ['visual.compound-growth.v1', 'operation.predict-option.v1', 'operation.slide-rate-years.v1', 'operation.explain-pick.v1'],
  'money.time-value.v2': ['visual.timeline.v1', 'operation.drag-chips.v1', 'operation.type-number.v1'],
  'money.rate-return.v2': ['visual.rate-case.v1', 'operation.scrub-case.v1', 'operation.type-number.v1'],
} as const;

export const COMPOUND = 'money.compound-interest.v2';
export const TIME_VALUE = 'money.time-value.v2';
export const RATE_RETURN = 'money.rate-return.v2';

const FIN1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: COMPOUND,
    lines: [
      `${COMPOUND}: ages 10-17 and the adult pathway. One deposit (whole cents), one fixed case (a whole percent from 1 to 12 and 1 to 40 whole years) and 3 to 5 predicted values, exactly one of them nearest the true compound value.`,
      `${COMPOUND}: the prompt asks the learner to predict the value of the deposit after the years at the rate, writing all three in digits, then to test it with the sliders. It never states the compound value and never says "interest on interest".`,
      `${COMPOUND}: include the simple-interest figure among the predicted values, so the common mistake is on the board. The public challenge must be reachable on the sliders and must not already hold at the fixed case.`,
      `${COMPOUND}: the explanations include the real one (interest-on-interest) next to 2 or 3 plausible wrong ones (same-each-year, rate-grows, deposit-grows). The key names the nearest option and interest-on-interest.`,
    ],
  },
  {
    type: TIME_VALUE,
    lines: [
      `${TIME_VALUE}: ages 14-17 and the adult pathway only. The rate is a whole number of basis points from 100 to 2000 and every amount is whole cents.`,
      `${TIME_VALUE}: an order task lists 2 to 5 payments with different amounts, one per year, and asks to place them so they are worth the most today (receive) or cost the least (pay); a pay task asks for the worth at the end of the timeline. An annuity task asks to place 2 to 5 equal payments at the end or at the start of each year.`,
      `${TIME_VALUE}: the prompt names the goal and the quantity to type (worth today, worth at the end) and never gives the figure. The key lists every best arrangement and a number tolerance of about 5 cents with a review band of a few dollars.`,
      `${TIME_VALUE}: the listed order of an order task must not already be the best one, and an annuity timing is written in the prompt in words ("at the end of each year", "at the start of each year").`,
    ],
  },
  {
    type: RATE_RETURN,
    lines: [
      `${RATE_RETURN}: ages 15-17 and the adult pathway only. One of four cases: effective rate of a nominal rate, a credit card paid at the minimum (months or interest), the NPV of a project at a discount rate, or the IRR of a project.`,
      `${RATE_RETURN}: the effective rate needs a compounding that changes the rate by at least a basis point (not yearly). A card pays interest plus a percent of the balance, never below the floor, and must clear within 600 months. NPV and IRR take one outlay and 2 to 5 yearly inflows whose total beats the outlay, and an IRR stays below 100 percent.`,
      `${RATE_RETURN}: the prompt says what to type and in which unit (percent, dollars or months) and never gives the figure. The key target is the model's own answer in plain decimal text; the tolerance is 0.05 for percents and dollars, 0 for months, and at least 0.1 for an IRR (the dial moves in tenths of a percent).`,
    ],
  },
];

/* ── An independent, compact copy of the fin1 model. Core and the browser own the real one; this one only exists to check the
   keys and the payloads, and the Forge test pins it to the same golden values. Money is whole cents, rates are whole basis
   points, every figure is exact in BigInt and rounded half up once. ── */

const B = 10_000n;
const whole = (value: unknown, low: number, high: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= low && value <= high;
const array = (value: unknown): value is unknown[] => Array.isArray(value);

const floorDiv = (n: bigint, d: bigint): bigint => (n % d !== 0n && n < 0n ? n / d - 1n : n / d);
const half = (n: bigint, d: bigint): bigint => floorDiv(2n * n + d, 2n * d);

export const COMPOUND_EXPLAIN = ['interest-on-interest', 'same-each-year', 'rate-grows', 'deposit-grows'] as const;
export const CARD_MONTHS_LIMIT = 600;
export const IRR_CEILING_BPS = 10_000;

/** principal * (1 + rate)^years, rounded to the cent. */
export const compoundValue = (principalCents: number, ratePercent: number, years: number): number =>
  Number(half(BigInt(principalCents) * (B + BigInt(ratePercent) * 100n) ** BigInt(years), B ** BigInt(years)));

interface Option { id: string; cents: number }
interface Challenge { minimumCents: number; maximumYears: number }

export function nearestOption(options: readonly Option[], truth: number): string | null {
  const gaps = options.map((option) => Math.abs(option.cents - truth));
  const best = Math.min(...gaps);
  return gaps.filter((gap) => gap === best).length === 1 ? options[gaps.indexOf(best)]!.id : null;
}

export const challengeMet = (principalCents: number, challenge: Challenge, rate: number, years: number): boolean =>
  years <= challenge.maximumYears && compoundValue(principalCents, rate, years) >= challenge.minimumCents;

/** How many of the 12 x 40 slider positions meet the challenge. */
export function challengePositions(principalCents: number, challenge: Challenge): number {
  let count = 0;
  for (let rate = 1; rate <= 12; rate += 1) for (let years = 1; years <= 40; years += 1) if (challengeMet(principalCents, challenge, rate, years)) count += 1;
  return count;
}

export interface CompoundPayload { principalCents: number; scenario: { rate: number; years: number }; options: Option[]; challenge: Challenge; explain: string[] }

export function readCompound(value: unknown): CompoundPayload | string {
  const p = asRecord(value);
  if (!p || Object.keys(p).sort().join() !== 'challenge,explain,options,principalCents,scenario') return 'The compound payload has principalCents, scenario, options, challenge and explain, and nothing else';
  const scenario = asRecord(p.scenario);
  const challenge = asRecord(p.challenge);
  if (!whole(p.principalCents, 100, 10_000_000)) return 'principalCents is a whole number of cents from 100 to 10000000';
  if (!scenario || !whole(scenario.rate, 1, 12) || !whole(scenario.years, 1, 40)) return 'The scenario is a whole percent from 1 to 12 and whole years from 1 to 40';
  if (!challenge || !whole(challenge.minimumCents, 1, Number.MAX_SAFE_INTEGER) || !whole(challenge.maximumYears, 1, 40)) return 'The challenge is a minimum in cents and a most years from 1 to 40';
  if (!array(p.options) || p.options.length < 3 || p.options.length > 5) return 'The compound piece has 3 to 5 predicted values';
  const options: Option[] = [];
  for (const raw of p.options) {
    const option = asRecord(raw);
    if (!option || typeof option.id !== 'string' || option.id === '' || !whole(option.cents, 1, Number.MAX_SAFE_INTEGER)) return 'Each predicted value has an id and whole cents';
    options.push({ id: option.id, cents: option.cents });
  }
  if (new Set(options.map((option) => option.id)).size !== options.length || new Set(options.map((option) => option.cents)).size !== options.length) return 'Predicted values have different ids and different amounts';
  const explain = p.explain;
  if (!array(explain) || explain.length < 3 || explain.length > 4 || explain.some((id) => typeof id !== 'string' || !(COMPOUND_EXPLAIN as readonly string[]).includes(id))
    || new Set(explain).size !== explain.length || !explain.includes('interest-on-interest')) return 'The explanations are 3 or 4 different known ids and include interest-on-interest';
  return { principalCents: p.principalCents, scenario: { rate: scenario.rate, years: scenario.years }, options, challenge: { minimumCents: challenge.minimumCents, maximumYears: challenge.maximumYears }, explain: explain as string[] };
}

export type Slots = Record<string, string[]>;
interface Flow { year: number; cents: number }
export type TimeValueTask = { kind: 'order'; side: 'receive' | 'pay'; amounts: number[] } | { kind: 'annuity'; timing: 'end' | 'start'; amount: number; count: number };
export interface TimeValuePayload { rateBps: number; ask: 'present' | 'future'; task: TimeValueTask }
type OrderPayload = TimeValuePayload & { task: Extract<TimeValueTask, { kind: 'order' }> };
type AnnuityPayload = TimeValuePayload & { task: Extract<TimeValueTask, { kind: 'annuity' }> };
const isOrder = (payload: TimeValuePayload): payload is OrderPayload => payload.task.kind === 'order';

/** The value of dated payments at year `at`: each is moved by (1 + rate)^(at - year); one exact sum, rounded once. */
export function worthAt(flows: readonly Flow[], rateBps: number, at: number): number {
  const g = B + BigInt(rateBps);
  let top = 0n;
  let bottom = 1n;
  for (const flow of flows) {
    const gap = at - flow.year;
    const n = BigInt(flow.cents) * (gap >= 0 ? g ** BigInt(gap) : B ** BigInt(-gap));
    const d = gap >= 0 ? B ** BigInt(gap) : g ** BigInt(-gap);
    top = top * d + n * bottom;
    bottom *= d;
  }
  return Number(half(top, bottom));
}

export function readTimeValue(value: unknown): TimeValuePayload | string {
  const p = asRecord(value);
  if (!p || Object.keys(p).sort().join() !== 'ask,rateBps,task') return 'The time value payload has rateBps, ask and task, and nothing else';
  if (!whole(p.rateBps, 100, 2000)) return 'rateBps is a whole number of basis points from 100 to 2000';
  if (p.ask !== 'present' && p.ask !== 'future') return 'ask is present or future';
  const task = asRecord(p.task);
  if (task?.kind === 'order' && Object.keys(task).sort().join() === 'amountsCents,kind,side' && (task.side === 'receive' || task.side === 'pay')) {
    const amounts = task.amountsCents;
    if (!array(amounts) || amounts.length < 2 || amounts.length > 5 || !amounts.every((cents) => whole(cents, 100, 5_000_000))) return 'An order task has 2 to 5 payments of whole cents from 100 to 5000000';
    if (new Set(amounts).size !== amounts.length) return 'Payment amounts differ, so exactly one order is best';
    return { rateBps: p.rateBps, ask: p.ask, task: { kind: 'order', side: task.side, amounts: amounts as number[] } };
  }
  if (task?.kind === 'annuity' && Object.keys(task).sort().join() === 'amountCents,count,kind,timing' && (task.timing === 'end' || task.timing === 'start')) {
    if (!whole(task.amountCents, 100, 5_000_000) || !whole(task.count, 2, 5)) return 'An annuity task has one amount of whole cents and 2 to 5 payments';
    return { rateBps: p.rateBps, ask: p.ask, task: { kind: 'annuity', timing: task.timing, amount: task.amountCents, count: task.count } };
  }
  return 'The task is an order task (side, amountsCents) or an annuity task (timing, amountCents, count)';
}

const yearOf = (slot: string): number | null => (/^year-(0|[1-9]\d?)$/.test(slot) ? Number(slot.slice(5)) : null);

/** The timeline horizon: the last year of the order task, or the count of the annuity. */
export const horizonOf = (payload: TimeValuePayload): number => (isOrder(payload) ? payload.task.amounts.length : (payload as AnnuityPayload).task.count);

/** The payments of an arrangement; null when a slot or piece is not on the board. */
export function flowsOf(payload: TimeValuePayload, slots: Slots): Flow[] | null {
  const flows: Flow[] = [];
  for (const [slot, pieces] of Object.entries(slots)) {
    const year = yearOf(slot);
    if (year === null || year > horizonOf(payload) || (isOrder(payload) && year < 1) || !array(pieces)) return null;
    for (const piece of pieces) {
      if (!isOrder(payload)) {
        if (piece !== 'payment') return null;
        flows.push({ year, cents: (payload as AnnuityPayload).task.amount });
        continue;
      }
      const index = typeof piece === 'string' && /^pay-[1-9]$/.test(piece) ? Number(piece.slice(4)) - 1 : -1;
      const cents = payload.task.amounts[index];
      if (cents === undefined) return null;
      flows.push({ year, cents });
    }
  }
  return flows;
}

/** What the arrangement is worth in the units the task asks for, in cents. */
export const valueOfArrangement = (payload: TimeValuePayload, flows: readonly Flow[]): number => worthAt(flows, payload.rateBps, payload.ask === 'present' ? 0 : horizonOf(payload));

/** The best slot of each payment of an order task: receive the biggest first, pay the biggest last. */
export function bestOrder(payload: OrderPayload): Slots {
  const task = payload.task;
  const ids = task.amounts.map((_, index) => `pay-${index + 1}`);
  const sorted = [...ids].sort((a, b) => (task.side === 'receive' ? -1 : 1) * (task.amounts[Number(a.slice(4)) - 1]! - task.amounts[Number(b.slice(4)) - 1]!));
  return Object.fromEntries(sorted.map((id, index) => [`year-${index + 1}`, [id]]));
}

export const startOrder = (payload: OrderPayload): Slots => Object.fromEntries(payload.task.amounts.map((_, index) => [`year-${index + 1}`, [`pay-${index + 1}`]]));

/** The one exact timing of an annuity: years 1..n at the end, years 0..n-1 at the start. */
export function annuityTiming(payload: AnnuityPayload): Slots {
  const first = payload.task.timing === 'end' ? 1 : 0;
  return Object.fromEntries(Array.from({ length: payload.task.count }, (_, index) => [`year-${first + index}`, ['payment']]));
}

const sameSlots = (a: Slots, b: Slots): boolean => {
  const keys = (slots: Slots) => Object.keys(slots).filter((slot) => (slots[slot] ?? []).length > 0).sort();
  const ka = keys(a);
  return ka.join() === keys(b).join() && ka.every((slot) => [...a[slot]!].sort().join() === [...b[slot]!].sort().join());
};

/** Every arrangement of an order task's pieces (a search the checker bounds with its budget). */
export function* permutations<T>(items: readonly T[]): Generator<T[]> {
  if (items.length <= 1) { yield [...items]; return; }
  for (let index = 0; index < items.length; index += 1) {
    for (const rest of permutations([...items.slice(0, index), ...items.slice(index + 1)])) yield [items[index]!, ...rest];
  }
}

export type RateCase =
  | { kind: 'effective'; nominalBps: number; periods: number }
  | { kind: 'card'; ask: 'months' | 'interest'; balance: number; aprBps: number; pctBps: number; floor: number }
  | { kind: 'npv'; rateBps: number; outlay: number; flows: number[] }
  | { kind: 'irr'; outlay: number; flows: number[] };

const COMPOUNDINGS = [1, 2, 4, 12, 52, 365];

export const effectiveBps = (nominalBps: number, periods: number): number => {
  const m = BigInt(periods);
  const base = B * m;
  return Number(half(((base + BigInt(nominalBps)) ** m - base ** m) * B, base ** m));
};

/** Minimum payments: interest first (APR / 12), then the payment is interest plus a percent of the balance, at least the floor, at most what is owed. */
export function cardRun(card: { balance: number; aprBps: number; pctBps: number; floor: number }): { months: number; interest: number } | null {
  let balance = BigInt(card.balance);
  let interest = 0n;
  for (let month = 1; month <= CARD_MONTHS_LIMIT; month += 1) {
    const charge = half(balance * BigInt(card.aprBps), 12n * B);
    const wanted = charge + half(balance * BigInt(card.pctBps), B);
    const floor = BigInt(card.floor);
    const minimum = wanted > floor ? wanted : floor;
    const owed = balance + charge;
    balance = owed - (owed < minimum ? owed : minimum);
    interest += charge;
    if (balance === 0n) return { months: month, interest: Number(interest) };
  }
  return null;
}

/** Sign of NPV at the rate h / 20000, exact (h counts half basis points). */
function npvSign(outlay: number, flows: readonly number[], h: number): number {
  const base = 2n * B;
  const g = base + BigInt(h);
  const n = flows.length;
  let top = -BigInt(outlay) * g ** BigInt(n);
  flows.forEach((cents, index) => { top += BigInt(cents) * base ** BigInt(index + 1) * g ** BigInt(n - index - 1); });
  return top > 0n ? 1 : top < 0n ? -1 : 0;
}

export const npvValue = (rateBps: number, outlay: number, flows: readonly number[]): number => {
  const g = B + BigInt(rateBps);
  const n = flows.length;
  let top = -BigInt(outlay) * g ** BigInt(n);
  flows.forEach((cents, index) => { top += BigInt(cents) * B ** BigInt(index + 1) * g ** BigInt(n - index - 1); });
  return Number(half(top, g ** BigInt(n)));
};

/** The rate where the NPV is zero, in whole basis points rounded half up; null when the flows have no break-even below 100 percent. */
export function irrValue(outlay: number, flows: readonly number[]): number | null {
  if (flows.reduce((sum, cents) => sum + cents, 0) <= outlay || npvSign(outlay, flows, 2 * IRR_CEILING_BPS) >= 0) return null;
  let low = 0;
  let high = 2 * IRR_CEILING_BPS;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (npvSign(outlay, flows, middle) >= 0) low = middle; else high = middle;
  }
  return Math.floor((low + 1) / 2);
}

export const centsText = (cents: number): string => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

export function readRate(value: unknown): RateCase | string {
  const p = asRecord(value);
  const keys = p ? Object.keys(p).sort().join() : '';
  const flowList = (raw: unknown): number[] | null => (array(raw) && raw.length >= 2 && raw.length <= 5 && raw.every((cents) => whole(cents, 0, 5_000_000)) ? (raw as number[]) : null);
  if (p?.kind === 'effective' && keys === 'kind,nominalBps,periodsPerYear') {
    if (!whole(p.nominalBps, 100, 6000) || typeof p.periodsPerYear !== 'number' || !COMPOUNDINGS.includes(p.periodsPerYear)) return 'An effective rate case has a nominal rate of 100 to 6000 basis points and 1, 2, 4, 12, 52 or 365 periods a year';
    return { kind: 'effective', nominalBps: p.nominalBps, periods: p.periodsPerYear };
  }
  if (p?.kind === 'card' && keys === 'aprBps,ask,balanceCents,floorCents,kind,minimumPctBps') {
    if ((p.ask !== 'months' && p.ask !== 'interest') || !whole(p.balanceCents, 10_000, 2_000_000) || !whole(p.aprBps, 500, 3600) || !whole(p.minimumPctBps, 100, 500) || !whole(p.floorCents, 1000, 5000)) {
      return 'A card case has ask (months or interest), a balance of 10000 to 2000000 cents, an APR of 500 to 3600, a minimum percent of 100 to 500 and a floor of 1000 to 5000 cents';
    }
    return { kind: 'card', ask: p.ask, balance: p.balanceCents, aprBps: p.aprBps, pctBps: p.minimumPctBps, floor: p.floorCents };
  }
  if (p?.kind === 'npv' && keys === 'flowsCents,kind,outlayCents,rateBps') {
    const flows = flowList(p.flowsCents);
    if (!whole(p.rateBps, 100, 3000) || !whole(p.outlayCents, 100, 5_000_000) || !flows) return 'An NPV case has a rate of 100 to 3000 basis points, an outlay and 2 to 5 whole inflows';
    return { kind: 'npv', rateBps: p.rateBps, outlay: p.outlayCents, flows };
  }
  if (p?.kind === 'irr' && keys === 'flowsCents,kind,outlayCents') {
    const flows = flowList(p.flowsCents);
    if (!whole(p.outlayCents, 100, 5_000_000) || !flows) return 'An IRR case has an outlay and 2 to 5 whole inflows';
    return { kind: 'irr', outlay: p.outlayCents, flows };
  }
  return 'A rate case is effective, card, npv or irr and has exactly that kind\'s fields';
}

const RATE_VISUAL = { effective: 'effective-rate', card: 'card-payoff', npv: 'cash-flow', irr: 'cash-flow' } as const;

/** The answer a case asks for as plain decimal text, or a sentence saying why the case cannot be graded. */
export function rateAnswer(rate: RateCase): { text: string; minimum: number; maximum: number } | string {
  switch (rate.kind) {
    case 'effective': {
      const bps = effectiveBps(rate.nominalBps, rate.periods);
      return bps === rate.nominalBps ? 'The compounding leaves the rate where it started (to the basis point), so there is nothing to find; use more periods or a bigger rate' : { text: centsText(bps), minimum: 0, maximum: 1000 };
    }
    case 'card': {
      const run = cardRun(rate);
      if (!run) return `The card does not clear within ${CARD_MONTHS_LIMIT} months at the minimum payment`;
      return rate.ask === 'months' ? { text: String(run.months), minimum: 0, maximum: CARD_MONTHS_LIMIT } : { text: centsText(run.interest), minimum: 0, maximum: 1_000_000 };
    }
    case 'npv': {
      const cents = npvValue(rate.rateBps, rate.outlay, rate.flows);
      return cents < -10_000_000 || cents > 100_000_000 ? 'The net value is outside what the answer box takes (-100000 to 1000000)' : { text: centsText(cents), minimum: -100_000, maximum: 1_000_000 };
    }
    case 'irr': {
      const bps = irrValue(rate.outlay, rate.flows);
      return bps === null ? 'An IRR needs inflows that beat the outlay and a break-even rate below 100 percent' : { text: centsText(bps), minimum: 0, maximum: 100 };
    }
  }
}

/* ── Keys. ── */

const DECIMAL = /^\d+(\.\d{1,6})?$/;
const scaled = (text: string): bigint => { const [integer = '0', fraction = ''] = text.split('.'); return BigInt(integer) * 1_000_000n + BigInt(fraction.padEnd(6, '0')); };
const plain = (text: string): string => (/^-?\d+(\.\d+)?$/.test(text) ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text);

/** A tolerance band is `{ absolute?, relative_bps? }` with at least one bound. Returns a sentence when it is malformed. */
function bandProblem(name: string, band: unknown): string | null {
  const record = asRecord(band);
  if (!record) return `The key's ${name} is an object with an absolute decimal, a relative_bps whole number or both`;
  const keys = Object.keys(record);
  if (keys.length === 0 || keys.some((key) => key !== 'absolute' && key !== 'relative_bps')) return `The key's ${name} has only absolute and relative_bps`;
  if (record.absolute !== undefined && (typeof record.absolute !== 'string' || !DECIMAL.test(record.absolute))) return `The key's ${name}.absolute is plain decimal text such as "0.05"`;
  if (record.relative_bps !== undefined && !whole(record.relative_bps, 0, 10_000)) return `The key's ${name}.relative_bps is a whole number from 0 to 10000`;
  return null;
}

function bandsProblem(key: Record<string, unknown>): string | null {
  const problem = bandProblem('tolerance', key.tolerance) ?? (key.review === undefined ? null : bandProblem('review', key.review));
  if (problem) return problem;
  const tolerance = asRecord(key.tolerance)!;
  const review = asRecord(key.review);
  if (review && typeof tolerance.absolute === 'string' && typeof review.absolute === 'string' && scaled(review.absolute) < scaled(tolerance.absolute)) return 'The key\'s review band is narrower than its tolerance';
  return null;
}

/* ── Gate 4 and the solvability checkers. ── */

function compoundProblems(segment: Record<string, unknown>, key: unknown, keyGiven: boolean): string[] {
  const payload = readCompound(segment.payload);
  if (typeof payload === 'string') return [payload];
  const problems: string[] = [];
  if ((segment.visual as { type?: unknown } | undefined)?.type !== 'compound-interest') problems.push('The compound piece uses the compound-interest visual');
  const truth = compoundValue(payload.principalCents, payload.scenario.rate, payload.scenario.years);
  const nearest = nearestOption(payload.options, truth);
  if (nearest === null) problems.push('Two predicted values are equally near the true value; one option must be nearest');
  if (challengePositions(payload.principalCents, payload.challenge) === 0) problems.push('No slider position meets the challenge, so the learner cannot finish it');
  if (challengeMet(payload.principalCents, payload.challenge, payload.scenario.rate, payload.scenario.years)) problems.push('The sliders already meet the challenge when they open at the fixed case');
  if (keyGiven) {
    const record = asRecord(key);
    if (!record || Object.keys(record).sort().join() !== 'explainId,predictOption') problems.push('The compound key is exactly { predictOption, explainId }');
    else {
      if (typeof record.predictOption !== 'string' || !payload.options.some((option) => option.id === record.predictOption)) problems.push('The key\'s predictOption is not one of the predicted values');
      else if (nearest !== null && record.predictOption !== nearest) problems.push(`The key's predictOption must be the value nearest ${centsText(truth)} (${nearest})`);
      if (record.explainId !== 'interest-on-interest') problems.push('The key\'s explainId must be interest-on-interest, the real reason');
    }
  }
  return problems;
}

function timeValueProblems(segment: Record<string, unknown>, key: unknown, keyGiven: boolean): string[] {
  const payload = readTimeValue(segment.payload);
  if (typeof payload === 'string') return [payload];
  const problems: string[] = [];
  if ((segment.visual as { type?: unknown } | undefined)?.type !== 'time-value') problems.push('The time value piece uses the time-value visual');
  const wanted = isOrder(payload) ? bestOrder(payload) : annuityTiming(payload as AnnuityPayload);
  if (isOrder(payload) && sameSlots(startOrder(payload), wanted)) problems.push('The listed order is already the best one, so there is nothing to arrange');
  const answer = (() => { const flows = flowsOf(payload, wanted); return flows ? valueOfArrangement(payload, flows) : null; })();
  if (answer !== null && (answer < 0 || answer > 100_000_000)) problems.push('The worth is outside what the answer box takes (0 to 1000000)');
  if (!keyGiven) return problems;
  const record = asRecord(key);
  if (!record || Object.keys(record).sort().join() !== (record.review !== undefined ? 'review,solutions,tolerance' : 'solutions,tolerance')) return [...problems, 'The time value key is { solutions, tolerance, review? }'];
  const band = bandsProblem(record);
  if (band) problems.push(band);
  const solutions = record.solutions;
  if (!array(solutions) || solutions.length < 1 || solutions.length > 8) return [...problems, 'The key lists 1 to 8 solutions'];
  let foundBest = false;
  solutions.forEach((solution, index) => {
    const slots = asRecord(solution) as Slots | undefined;
    if (!slots || !flowsOf(payload, slots)) { problems.push(`Key solution ${index + 1} places a payment on a year or piece that is not on the board`); return; }
    if (sameSlots(slots, wanted)) { foundBest = true; return; }
    problems.push(isOrder(payload)
      ? `Key solution ${index + 1} is not the best order: ${payload.task.side === 'receive' ? 'receive the biggest amount first' : 'pay the biggest amount last'}`
      : `Key solution ${index + 1} must put the payments at years ${(payload as AnnuityPayload).task.timing === 'end' ? '1 to ' + (payload as AnnuityPayload).task.count : '0 to ' + ((payload as AnnuityPayload).task.count - 1)}`);
  });
  if (!foundBest && problems.length === 0) problems.push('The key does not hold the best arrangement');
  return problems;
}

function rateProblems(segment: Record<string, unknown>, key: unknown, keyGiven: boolean): string[] {
  const rate = readRate(segment.payload);
  if (typeof rate === 'string') return [rate];
  const problems: string[] = [];
  if ((segment.visual as { type?: unknown } | undefined)?.type !== RATE_VISUAL[rate.kind]) problems.push(`The ${rate.kind} case uses the ${RATE_VISUAL[rate.kind]} visual`);
  const answer = rateAnswer(rate);
  if (typeof answer === 'string') return [...problems, answer];
  if (!keyGiven) return problems;
  const record = asRecord(key);
  if (!record || Object.keys(record).sort().join() !== (record.review !== undefined ? 'review,target,tolerance' : 'target,tolerance')) return [...problems, 'The rate key is { target, tolerance, review? }'];
  if (typeof record.target !== 'string' || plain(record.target) !== plain(answer.text)) problems.push(`The key target must be ${answer.text}, the model's own answer`);
  const band = bandsProblem(record);
  if (band) problems.push(band);
  else if (rate.kind === 'irr') {
    const absolute = (record.tolerance as { absolute?: string }).absolute;
    if (absolute === undefined || scaled(absolute) < 100_000n) problems.push('An IRR tolerance is at least 0.1 percent, the step of the rate dial');
  }
  return problems;
}

type Reader = (segment: Record<string, unknown>, key: unknown, keyGiven: boolean) => string[];
const READERS: Readonly<Record<string, Reader>> = { [COMPOUND]: compoundProblems, [TIME_VALUE]: timeValueProblems, [RATE_RETURN]: rateProblems };

/** Gate 4: the public payload is well formed and in the model, the case can be finished and is not already finished, and the key is the model's answer. */
function fin1Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const read = typeof segment.type === 'string' ? READERS[segment.type] : undefined;
    if (!read) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const keyGiven = answerKeys !== undefined && Object.hasOwn(answerKeys, segmentId);
    for (const message of read(segment, keyGiven ? answerKeys[segmentId] : undefined, keyGiven)) problems.push({ gate: 4, segmentId, message });
  }
  return problems;
}

/* ── Solvability (F0.4): the two puzzle pieces. The rate-return piece is checked in solvability-plane.ts. ── */

export const compoundChecker: SolvabilityChecker = (segment, context) => {
  const subject = `compound interest ${segment.id}`;
  const payload = readCompound(segment.payload);
  if (typeof payload === 'string') return result([issue('impossible-state', `${subject}: ${payload}`)]);
  const issues: SolvabilityIssue[] = [];
  const budget = new Budget(context.nodeBudget);
  const truth = compoundValue(payload.principalCents, payload.scenario.rate, payload.scenario.years);
  const nearest = nearestOption(payload.options, truth);
  if (nearest === null) issues.push(issue('ambiguous-solution', `${subject}: two predicted values are equally near the true value ${centsText(truth)}, so no single option is the key`));
  if (!budget.spend(12 * 40)) return result([budgetIssue(subject, budget.limit, 'that the sliders can meet the challenge')]);
  const positions = challengePositions(payload.principalCents, payload.challenge);
  if (positions === 0) issues.push(issue('no-solution', `${subject}: no rate and years on the sliders reach ${centsText(payload.challenge.minimumCents)} within ${payload.challenge.maximumYears} years`));
  else if (positions * 5 > 12 * 40 * 3) issues.push(issue('vacuous-rubric', `${subject}: most slider positions meet the challenge, so it tests nothing; raise the minimum or cut the years`, { severity: 'review' }));
  if (challengeMet(payload.principalCents, payload.challenge, payload.scenario.rate, payload.scenario.years)) issues.push(issue('impossible-state', `${subject}: the sliders already meet the challenge at the fixed case`));
  if (context.answerKey !== undefined) {
    const key = asRecord(context.answerKey);
    if (!key || typeof key.predictOption !== 'string') issues.push(issue('rubric-gap', `${subject}: the key needs a predictOption`));
    else if (!payload.options.some((option) => option.id === key.predictOption)) issues.push(issue('dangling-reference', `${subject}: the key's predictOption is not one of the options`));
    else if (nearest !== null && key.predictOption !== nearest) issues.push(issue('rubric-accepts-invalid', `${subject}: the key accepts ${String(key.predictOption)} but ${nearest} is nearest the true value`));
    if (key && key.explainId !== 'interest-on-interest') issues.push(issue('rubric-accepts-invalid', `${subject}: the key's explanation must be interest-on-interest`));
  }
  return result(issues, { truthCents: truth, positions, nodes: budget.used });
};

export const timeValueChecker: SolvabilityChecker = (segment, context) => {
  const subject = `time value ${segment.id}`;
  const payload = readTimeValue(segment.payload);
  if (typeof payload === 'string') return result([issue('impossible-state', `${subject}: ${payload}`)]);
  const issues: SolvabilityIssue[] = [];
  const budget = new Budget(context.nodeBudget);
  let best: { slots: Slots; value: number } | null = null;
  if (isOrder(payload)) {
    let ties = 0;
    const ids = payload.task.amounts.map((_, index) => `pay-${index + 1}`);
    for (const order of permutations(ids)) {
      if (!budget.spend()) return result([budgetIssue(subject, budget.limit, 'the best order')]);
      const slots: Slots = Object.fromEntries(order.map((id, index) => [`year-${index + 1}`, [id]]));
      const value = valueOfArrangement(payload, flowsOf(payload, slots)!);
      const better = best === null || (payload.task.side === 'receive' ? value > best.value : value < best.value);
      if (better) { best = { slots, value }; ties = 1; } else if (value === best!.value) ties += 1;
    }
    if (ties > 1) issues.push(issue('ambiguous-solution', `${subject}: ${ties} orders are equally good, so no single order is the key`));
    else if (best && sameSlots(best.slots, startOrder(payload))) issues.push(issue('impossible-state', `${subject}: the listed order is already the best one`));
  } else {
    const slots = annuityTiming(payload as AnnuityPayload);
    best = { slots, value: valueOfArrangement(payload, flowsOf(payload, slots)!) };
  }
  if (context.answerKey !== undefined && best) {
    const key = asRecord(context.answerKey);
    const solutions = key && array(key.solutions) ? key.solutions : null;
    if (!solutions || solutions.length === 0) issues.push(issue('rubric-gap', `${subject}: the key lists no solution`));
    else {
      let found = false;
      let bad = false;
      solutions.forEach((solution, index) => {
        const slots = asRecord(solution) as Slots | undefined;
        if (!slots || !flowsOf(payload, slots)) { bad = true; issues.push(issue('dangling-reference', `${subject}: key solution ${index + 1} uses a year or piece that is not on the board`)); }
        else if (sameSlots(slots, best!.slots)) found = true;
        else { bad = true; issues.push(issue('rubric-accepts-invalid', `${subject}: key solution ${index + 1} is not the ${isOrder(payload) ? 'best order' : 'exact annuity timing'}`)); }
      });
      if (!found && !bad) issues.push(issue('rubric-gap', `${subject}: the key does not hold the best arrangement`));
    }
  }
  return result(issues, { nodes: budget.used, ...(best ? { bestCents: best.value } : {}) });
};

registerSolvabilityChecker(COMPOUND, compoundChecker);
registerSolvabilityChecker(TIME_VALUE, timeValueChecker);

export const fin1 = {
  id: 'fin1',
  capabilities: FIN1_CAPABILITIES,
  guidance: FIN1_GUIDANCE,
  gates: fin1Gates,
} as const satisfies ForgeHorizontePack;
