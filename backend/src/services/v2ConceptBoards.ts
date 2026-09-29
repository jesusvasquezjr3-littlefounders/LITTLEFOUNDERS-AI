import { z } from 'zod';

/*
 * Canonical models, contracts and scorers of the Appendix A Part 3 concept
 * boards (GAP-FIX-R1 learning; B.7 part 2). Each board composes Part 2
 * primitives; each model is pure and computed once: Core validates and grades
 * with this file, and the browser draws from its generated copy
 * (frontend/src/rebuild/learning/v2ConceptBoards.generated.ts,
 * agent/tools/sync-v2-concept-boards.mjs, spec:check). Integers in minor
 * units and basis points throughout; zod only (the file is copied verbatim).
 *
 *   money.amortization.v2      loan amortization, step-by-step scrub (6)
 *   econ.supply-demand.v2      supply and demand, drag point + curve shift (2, 12)
 *   money.opportunity-cost.v2  constrained trade-off chooser (11)
 *   money.inflation.v2         inflation, slider + zoom (1, 16)
 *   money.rule-of-72.v2        Rule of 72, slider + threshold marker (1, 10)
 *   money.debt-payoff.v2       snowball vs avalanche, what-if + ghost trace (5, 15)
 *   money.diversification.v2   allocation with a dependent risk/return point (3, 2)
 *   money.lemonade-stand.v2    guided sandbox + running ledger + waterfall (8, 13)
 * Marginal tax gains its Sankey on the existing tax-bracket board (9).
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const int = z.number().int().safe();
const nonneg = int.nonnegative();
const positive = int.positive();
const label = z.string().trim().min(1).max(40);
const currency = z.enum(['coins', 'local']);

/* ── Pure models ─────────────────────────────────────────────────────────── */

export interface AmortizationRow { month: number; payment: number; interest: number; principal: number; balance: number }
/** Monthly amortization; each month's interest is rounded to the minor unit, the last payment clears the balance. */
export function amortizationSchedule(principal: number, annualRateBps: number, months: number): AmortizationRow[] {
  const r = annualRateBps / 10_000 / 12;
  const payment = r === 0 ? Math.ceil(principal / months) : Math.ceil(principal * r / (1 - (1 + r) ** -months));
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let month = 1; month <= months && balance > 0; month += 1) {
    const interest = Math.round(balance * r);
    const due = Math.min(payment, balance + interest);
    const principalPart = due - interest;
    balance -= principalPart;
    rows.push({ month, payment: due, interest, principal: principalPart, balance });
  }
  return rows;
}

export interface Line { intercept: number; slope: number }
/** Linear demand P = a − bQ and supply P = c + dQ, each shifted by whole steps; the equilibrium price and quantity (two decimals). */
export function equilibrium(demand: Line, supply: Line, shiftStep: number, demandShift: number, supplyShift: number): { quantity: number; price: number } {
  const a = demand.intercept + demandShift * shiftStep;
  const c = supply.intercept + supplyShift * shiftStep;
  const quantity = (a - c) / (demand.slope + supply.slope);
  return { quantity: Math.round(quantity * 100) / 100, price: Math.round((a - demand.slope * quantity) * 100) / 100 };
}

/** Compound growth by whole years with rounding to the minor unit each year. */
export function compoundValue(principal: number, rateBps: number, years: number): number {
  let value = principal;
  for (let year = 0; year < years; year += 1) value = Math.round(value * (10_000 + rateBps) / 10_000);
  return value;
}

/** The first whole year the value is at least double, and the Rule of 72's estimate. */
export function doublingYears(rateBps: number): { exact: number; ruleOf72: number } {
  let years = 0; let value = 1_000_000;
  while (value < 2_000_000 && years < 200) { value = Math.round(value * (10_000 + rateBps) / 10_000); years += 1; }
  return { exact: years, ruleOf72: Math.round(7_200 / rateBps * 100) / 100 };
}

export interface Debt { id: string; balance: number; rate_bps: number; minimum: number }
export interface PayoffResult { months: number; totalInterest: number; order: string[]; balances: number[]; firstClearMonth: number }
/** Snowball (smallest balance first) or avalanche (highest rate first) with a fixed monthly budget; the monthly total balance is the trace. */
export function payoff(debts: readonly Debt[], budget: number, strategy: 'snowball' | 'avalanche'): PayoffResult {
  const state = debts.map((d) => ({ ...d }));
  const order: string[] = []; const balances: number[] = [];
  let months = 0; let totalInterest = 0; let firstClearMonth = 0;
  while (state.some((d) => d.balance > 0) && months < 600) {
    months += 1;
    for (const d of state) if (d.balance > 0) { const interest = Math.round(d.balance * d.rate_bps / 10_000 / 12); d.balance += interest; totalInterest += interest; }
    let left = budget;
    for (const d of state) if (d.balance > 0) { const pay = Math.min(d.minimum, d.balance, left); d.balance -= pay; left -= pay; }
    const targets = state.filter((d) => d.balance > 0).sort((x, y) => strategy === 'snowball' ? x.balance - y.balance || y.rate_bps - x.rate_bps : y.rate_bps - x.rate_bps || x.balance - y.balance);
    for (const d of targets) { if (left <= 0) break; const pay = Math.min(d.balance, left); d.balance -= pay; left -= pay; }
    for (const d of state) if (d.balance === 0 && !order.includes(d.id)) order.push(d.id);
    if (firstClearMonth === 0 && order.length > 0) firstClearMonth = months;
    balances.push(state.reduce((s, d) => s + d.balance, 0));
  }
  return { months, totalInterest, order, balances, firstClearMonth };
}

export interface Asset { id: string; return_bps: number; risk_bps: number }
/** Weighted return and (uncorrelated) risk of a portfolio: diversifying lowers risk faster than it lowers return. */
export function portfolio(assets: readonly Asset[], weights: Readonly<Record<string, number>>): { returnBps: number; riskBps: number } {
  const w = (asset: Asset) => (weights[asset.id] ?? 0) / 100;
  return {
    returnBps: Math.round(assets.reduce((s, a) => s + w(a) * a.return_bps, 0)),
    riskBps: Math.round(Math.sqrt(assets.reduce((s, a) => s + (w(a) * a.risk_bps) ** 2, 0))),
  };
}

export interface StandPayload { cost_per_cup_minor: number; fixed_cost_minor: number; max_price_minor: number; price_step_minor: number; demand_at_zero: number; cups_lost_per_step: number; max_cups: number }
/** One day at the stand: cups sold is the smaller of cups made and demand at that price; the waterfall is revenue − cups − fixed = profit. */
export function lemonadeDay(stand: StandPayload, price: number, cupsMade: number): { sold: number; revenue: number; cupCost: number; fixed: number; profit: number } {
  const demand = Math.max(0, stand.demand_at_zero - stand.cups_lost_per_step * (price / stand.price_step_minor));
  const sold = Math.min(cupsMade, Math.floor(demand));
  const revenue = sold * price; const cupCost = cupsMade * stand.cost_per_cup_minor;
  return { sold, revenue, cupCost, fixed: stand.fixed_cost_minor, profit: revenue - cupCost - stand.fixed_cost_minor };
}

/* ── Contracts ───────────────────────────────────────────────────────────── */

const base = {
  id, prompt: z.string().trim().min(1).max(500),
  help: z.array(z.string().trim().min(1).max(160)).min(1).max(2).optional(),
  // GAP-FIX-R6 (B.20, Bible 02 §9.2): the same authored feedback banner every v2 segment may carry (v2SegmentFamilies' v2SegmentFeedback).
  feedback: z.object({ met: z.string().trim().min(1).max(160).optional(), not_yet: z.string().trim().min(1).max(160).optional() }).strict()
    .refine((value) => value.met !== undefined || value.not_yet !== undefined, 'Feedback needs met or not_yet').optional(),
  item_role: z.enum(['practice', 'transfer']).optional(),
  knowledge_component_id: id.optional(),
  // Appendix P Part 8 (GAP-FIX-R2): the same pre/post phase and representation variant every v2 segment may carry.
  item_phase: z.enum(['pre', 'post']).optional(),
  variant: id.optional(),
};
const grading = z.enum(['server', 'none']);
const visual = <T extends string>(type: T) => z.object({ type: z.literal(type) }).strict();
const grid = (min: number, max: number, step: number) => step > 0 && max > min && (max - min) % step === 0;

export const amortizationPayload = z.object({ currency, principal_minor: positive.max(10_000_000), rate_bps: nonneg.max(3_000), months: positive.min(3).max(60) }).strict();
export const supplyDemandPayload = z.object({
  demand: z.object({ intercept: positive.max(1_000), slope: positive.max(100) }).strict(),
  supply: z.object({ intercept: nonneg.max(1_000), slope: positive.max(100) }).strict(),
  shift_step: positive.max(100), max_shift: positive.max(5),
  labels: z.object({ price: label, quantity: label, demand: label, supply: label }).strict(),
}).strict().refine((v) => v.demand.intercept - v.max_shift * v.shift_step > v.supply.intercept + v.max_shift * v.shift_step, 'Curves must cross at every shift');
export const opportunityPayload = z.object({ tokens: positive.min(2).max(10), options: z.array(z.object({ id, label, cost: positive.max(10) }).strict()).min(3).max(6) }).strict()
  .refine((v) => new Set(v.options.map((o) => o.id)).size === v.options.length && v.options.reduce((s, o) => s + o.cost, 0) > v.tokens, 'The options must cost more than the tokens');
export const inflationPayload = z.object({
  currency, price_minor: positive.max(1_000_000), min_rate_bps: positive.max(2_000), max_rate_bps: positive.max(2_000), rate_step_bps: positive,
  min_years: positive.max(40), max_years: positive.max(40), year_step: positive, prediction_step_minor: positive, prediction_max_minor: positive.max(100_000_000),
}).strict().refine((v) => grid(v.min_rate_bps, v.max_rate_bps, v.rate_step_bps) && grid(v.min_years, v.max_years, v.year_step)
  && compoundValue(v.price_minor, v.max_rate_bps, v.max_years) <= v.prediction_max_minor && (v.prediction_max_minor - v.price_minor) % v.prediction_step_minor === 0, 'Invalid inflation range');
export const ruleOf72Payload = z.object({ currency, principal_minor: positive.max(1_000_000), min_rate_bps: positive.min(100).max(2_400), max_rate_bps: positive.min(100).max(2_400), rate_step_bps: positive }).strict()
  .refine((v) => grid(v.min_rate_bps, v.max_rate_bps, v.rate_step_bps), 'Invalid rate range');
export const debtPayload = z.object({
  currency, budget_minor: positive.max(1_000_000),
  debts: z.array(z.object({ id, label, balance_minor: positive.max(10_000_000), rate_bps: nonneg.max(4_000), minimum_minor: positive.max(1_000_000) }).strict()).min(2).max(3),
}).strict().refine((v) => v.debts.reduce((s, d) => s + d.minimum_minor, 0) <= v.budget_minor
  && payoff(v.debts.map((d) => ({ id: d.id, balance: d.balance_minor, rate_bps: d.rate_bps, minimum: d.minimum_minor })), v.budget_minor, 'avalanche').months < 600, 'The budget must cover the minimums and clear the debts');
export const diversificationPayload = z.object({ assets: z.array(z.object({ id, label, return_bps: nonneg.max(3_000), risk_bps: nonneg.max(6_000) }).strict()).min(2).max(3), step: z.union([z.literal(5), z.literal(10), z.literal(25)]) }).strict()
  .refine((v) => new Set(v.assets.map((a) => a.id)).size === v.assets.length, 'Duplicate assets');
export const lemonadePayload = z.object({
  currency, cost_per_cup_minor: positive.max(10_000), fixed_cost_minor: nonneg.max(100_000), max_price_minor: positive.max(100_000), price_step_minor: positive.max(10_000),
  demand_at_zero: positive.max(500), cups_lost_per_step: positive.max(100), max_cups: positive.max(500),
}).strict().refine((v) => v.max_price_minor % v.price_step_minor === 0, 'The price grid must reach the maximum');

export const v2ConceptSegments = [
  z.object({ ...base, type: z.literal('money.amortization.v2'), grading, visual: visual('amortization'), payload: amortizationPayload }).strict(),
  z.object({ ...base, type: z.literal('econ.supply-demand.v2'), grading, visual: visual('supply-demand'), payload: supplyDemandPayload }).strict(),
  z.object({ ...base, type: z.literal('money.opportunity-cost.v2'), grading: z.literal('none'), visual: visual('token-chooser'), payload: opportunityPayload }).strict(),
  z.object({ ...base, type: z.literal('money.inflation.v2'), grading, visual: visual('inflation'), payload: inflationPayload }).strict(),
  z.object({ ...base, type: z.literal('money.rule-of-72.v2'), grading, visual: visual('doubling'), payload: ruleOf72Payload }).strict(),
  z.object({ ...base, type: z.literal('money.debt-payoff.v2'), grading, visual: visual('debt-race'), payload: debtPayload }).strict(),
  z.object({ ...base, type: z.literal('money.diversification.v2'), grading, visual: visual('portfolio'), payload: diversificationPayload }).strict(),
  z.object({ ...base, type: z.literal('money.lemonade-stand.v2'), grading, visual: visual('lemonade-stand'), payload: lemonadePayload }).strict(),
] as const;
export type V2ConceptSegment = z.infer<(typeof v2ConceptSegments)[number]>;
export type V2ConceptType = V2ConceptSegment['type'];
export const V2_CONCEPT_TYPES = v2ConceptSegments.map((schema) => schema.shape.type.value) as readonly V2ConceptType[];

/** Every concept board is for teens (Appendix A Part 3), except opportunity cost and the lemonade stand (all tiers). */
export function conceptAllowed(type: V2ConceptType, ageBand: string): boolean {
  return type === 'money.opportunity-cost.v2' || type === 'money.lemonade-stand.v2' || ageBand === '13-17' || ageBand === 'adult';
}

export const V2_CONCEPT_RUBRICS = {
  'money.amortization.v2': z.object({ month: positive.max(60) }).strict(),
  'econ.supply-demand.v2': z.object({ curve: z.enum(['demand', 'supply']), direction: z.union([z.literal(1), z.literal(-1)]) }).strict(),
  'money.inflation.v2': z.object({ tolerance_minor: nonneg }).strict(),
  'money.rule-of-72.v2': z.object({ tolerance_years: nonneg.max(3) }).strict(),
  'money.debt-payoff.v2': z.object({ ask: z.enum(['least_interest', 'first_debt_cleared_sooner']) }).strict(),
  'money.diversification.v2': z.object({ max_risk_bps: positive, min_return_bps: nonneg }).strict(),
  'money.lemonade-stand.v2': z.object({ target_profit_minor: int }).strict(),
} as const;

/* ── Grading (Part 7): verdict and closed diagnostic code, or invalid ─────── */

export type ConceptGrade = { verdict: 'met' | 'review' | 'invalid' | 'valid'; diagnostic: 'none' | 'structure' | 'value' | 'tolerance' | 'outcome' };
const INVALID: ConceptGrade = { verdict: 'invalid', diagnostic: 'none' };
const rec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (v: unknown, keys: string[]): v is Record<string, unknown> => rec(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const onGrid = (v: unknown, min: number, max: number, step: number): v is number => whole(v) && v >= min && v <= max && (v - min) % step === 0;
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;

export function gradeConcept(segment: V2ConceptSegment, response: unknown, rubric?: unknown): ConceptGrade {
  const result = (met: boolean, miss: ConceptGrade['diagnostic'] = 'value'): ConceptGrade => ({ verdict: met ? 'met' : 'review', diagnostic: met ? 'none' : miss });
  switch (segment.type) {
    case 'money.amortization.v2': {
      const p = segment.payload;
      const rows = amortizationSchedule(p.principal_minor, p.rate_bps, p.months);
      if (!has(response, ['month', 'balance']) || !onGrid(response.month, 0, rows.length, 1) || typeof response.balance !== 'string' || !NUMBER.test(response.balance)) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.amortization.v2'].safeParse(rubric);
      if (!key.success || key.data.month > rows.length) return INVALID;
      if (response.month !== key.data.month) return result(false, 'structure');
      return result(Math.abs(Number(response.balance) - rows[key.data.month - 1]!.balance) <= 1);
    }
    case 'econ.supply-demand.v2': {
      const p = segment.payload;
      if (!has(response, ['demand_shift', 'supply_shift', 'price']) || !onGrid(response.demand_shift, -p.max_shift, p.max_shift, 1)
        || !onGrid(response.supply_shift, -p.max_shift, p.max_shift, 1) || !['up', 'down', 'same'].includes(response.price as string)) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['econ.supply-demand.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      const expectShift = key.data.curve === 'demand' ? { demand_shift: key.data.direction, supply_shift: 0 } : { demand_shift: 0, supply_shift: key.data.direction };
      if (response.demand_shift !== expectShift.demand_shift || response.supply_shift !== expectShift.supply_shift) return result(false, 'structure');
      const before = equilibrium(p.demand, p.supply, p.shift_step, 0, 0).price;
      const after = equilibrium(p.demand, p.supply, p.shift_step, expectShift.demand_shift, expectShift.supply_shift).price;
      return result(response.price === (after > before ? 'up' : after < before ? 'down' : 'same'), 'outcome');
    }
    case 'money.inflation.v2': {
      const p = segment.payload;
      if (!has(response, ['rateBps', 'years', 'predictionMinor']) || !onGrid(response.rateBps, p.min_rate_bps, p.max_rate_bps, p.rate_step_bps)
        || !onGrid(response.years, p.min_years, p.max_years, p.year_step) || !onGrid(response.predictionMinor, p.price_minor, p.prediction_max_minor, p.prediction_step_minor)) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.inflation.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      return result(Math.abs(response.predictionMinor - compoundValue(p.price_minor, response.rateBps, response.years)) <= key.data.tolerance_minor, 'tolerance');
    }
    case 'money.rule-of-72.v2': {
      const p = segment.payload;
      if (!has(response, ['rateBps', 'years']) || !onGrid(response.rateBps, p.min_rate_bps, p.max_rate_bps, p.rate_step_bps) || !onGrid(response.years, 1, 100, 1)) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.rule-of-72.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      return result(Math.abs(response.years - doublingYears(response.rateBps).exact) <= key.data.tolerance_years, 'tolerance');
    }
    case 'money.debt-payoff.v2': {
      if (!has(response, ['strategy']) || (response.strategy !== 'snowball' && response.strategy !== 'avalanche')) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.debt-payoff.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      const debts = segment.payload.debts.map((d) => ({ id: d.id, balance: d.balance_minor, rate_bps: d.rate_bps, minimum: d.minimum_minor }));
      const snow = payoff(debts, segment.payload.budget_minor, 'snowball'); const ava = payoff(debts, segment.payload.budget_minor, 'avalanche');
      const score = (r: PayoffResult) => key.data.ask === 'least_interest' ? r.totalInterest : r.firstClearMonth;
      const mine = response.strategy === 'snowball' ? score(snow) : score(ava);
      return result(mine <= Math.min(score(snow), score(ava)), 'outcome');
    }
    case 'money.diversification.v2': {
      const p = segment.payload;
      if (!has(response, ['weights']) || !rec(response.weights) || Object.keys(response.weights).length !== p.assets.length) return INVALID;
      const weights = response.weights as Record<string, unknown>;
      if (p.assets.some((a) => !onGrid(weights[a.id], 0, 100, p.step))) return INVALID;
      // Conservation: the whole portfolio is always 100%.
      if (p.assets.reduce((s, a) => s + (weights[a.id] as number), 0) !== 100) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.diversification.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      const point = portfolio(p.assets, weights as Record<string, number>);
      return result(point.riskBps <= key.data.max_risk_bps && point.returnBps >= key.data.min_return_bps, point.riskBps > key.data.max_risk_bps ? 'structure' : 'value');
    }
    case 'money.lemonade-stand.v2': {
      const p = segment.payload;
      if (!has(response, ['price', 'cups']) || !onGrid(response.price, 0, p.max_price_minor, p.price_step_minor) || !onGrid(response.cups, 0, p.max_cups, 1)) return INVALID;
      if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
      const key = V2_CONCEPT_RUBRICS['money.lemonade-stand.v2'].safeParse(rubric);
      if (!key.success) return INVALID;
      return result(lemonadeDay(p, response.price, response.cups).profit >= key.data.target_profit_minor);
    }
    case 'money.opportunity-cost.v2':
      return INVALID;
  }
}

/** A well-formed response for the contract validator. */
export function conceptSampleResponse(segment: V2ConceptSegment): unknown {
  switch (segment.type) {
    case 'money.amortization.v2': return { month: 0, balance: String(segment.payload.principal_minor) };
    case 'econ.supply-demand.v2': return { demand_shift: 0, supply_shift: 0, price: 'same' };
    case 'money.inflation.v2': return { rateBps: segment.payload.min_rate_bps, years: segment.payload.min_years, predictionMinor: segment.payload.price_minor };
    case 'money.rule-of-72.v2': return { rateBps: segment.payload.min_rate_bps, years: 1 };
    case 'money.debt-payoff.v2': return { strategy: 'snowball' };
    case 'money.diversification.v2': return { weights: Object.fromEntries(segment.payload.assets.map((a, i) => [a.id, i === 0 ? 100 : 0])) };
    case 'money.lemonade-stand.v2': return { price: 0, cups: 0 };
    case 'money.opportunity-cost.v2': return null;
  }
}
