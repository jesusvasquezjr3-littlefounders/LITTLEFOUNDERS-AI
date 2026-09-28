import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkV2Behaviour } from '../services/forgeV2Behaviour.js';
import { amortizationSchedule, compoundValue, conceptAllowed, doublingYears, equilibrium, lemonadeDay, payoff, portfolio } from '../services/v2ConceptBoards.js';
import { gradeV2Visual, validateV2LessonForGrading } from '../services/v2LessonDocument.js';

/*
 * GAP-FIX-R1 learning (B.7 part 2, Appendix A Part 3): the canonical concept
 * models, Core's server grading of each gradable concept board, the age gate,
 * and the committed Forge fixture under the interactive-behaviour gate.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
type Row = { lesson_id: string; locale: string; document: Record<string, unknown> & { segments: Array<{ id: string; type: string }> }; answer_keys: Record<string, unknown> };
const rows = JSON.parse(readFileSync(path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json'), 'utf8')) as Row[];
const row = structuredClone(rows.find((r) => r.lesson_id === 'v2-concept-boards' && r.locale === 'en-US')!);
const document = validateV2LessonForGrading(row.document, row.answer_keys, { lessonId: 'v2-concept-boards', locale: 'en-US' })!;
const grade = (segmentId: string, response: unknown) => gradeV2Visual(document, row.answer_keys, segmentId, response);

describe('concept models', () => {
  it('amortizes a loan to zero, interest first', () => {
    const rows = amortizationSchedule(1200, 1200, 12);
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)!.balance).toBe(0);
    expect(rows.reduce((sum, r) => sum + r.principal, 0)).toBe(1200);
    expect(rows[0]!.interest).toBe(12);
    expect(rows[0]!.interest).toBeGreaterThan(rows[11]!.interest);
  });

  it('moves the equilibrium when a curve shifts, and compounds prices and doubling', () => {
    const base = equilibrium({ intercept: 100, slope: 2 }, { intercept: 10, slope: 1 }, 10, 0, 0);
    expect(base).toEqual({ quantity: 30, price: 40 });
    expect(equilibrium({ intercept: 100, slope: 2 }, { intercept: 10, slope: 1 }, 10, 1, 0).price).toBeGreaterThan(base.price);
    expect(compoundValue(100, 1000, 2)).toBe(121);
    expect(doublingYears(600)).toEqual({ exact: 12, ruleOf72: 12 });
  });

  it('simulates both debt plans: avalanche pays less interest, snowball clears a debt sooner', () => {
    const debts = [{ id: 'debt-card', balance: 1000, rate_bps: 2400, minimum: 30 }, { id: 'debt-loan', balance: 300, rate_bps: 600, minimum: 20 }];
    const snow = payoff(debts, 150, 'snowball'); const ava = payoff(debts, 150, 'avalanche');
    expect(ava.totalInterest).toBeLessThan(snow.totalInterest);
    expect(snow.firstClearMonth).toBeLessThan(ava.firstClearMonth);
    expect(snow.balances.at(-1)).toBe(0);
  });

  it('lowers risk faster than return when spreading, and runs a stand day', () => {
    const assets = [{ id: 'a', return_bps: 800, risk_bps: 2000 }, { id: 'b', return_bps: 300, risk_bps: 600 }];
    expect(portfolio(assets, { a: 100, b: 0 })).toEqual({ returnBps: 800, riskBps: 2000 });
    expect(portfolio(assets, { a: 50, b: 50 }).riskBps).toBeLessThan(1100);
    const stand = { cost_per_cup_minor: 2, fixed_cost_minor: 10, max_price_minor: 20, price_step_minor: 2, demand_at_zero: 60, cups_lost_per_step: 5, max_cups: 60 };
    expect(lemonadeDay(stand, 12, 40)).toEqual({ sold: 30, revenue: 360, cupCost: 80, fixed: 10, profit: 270 });
  });

  it('opens concept boards by age: teens, except opportunity cost and the lemonade stand', () => {
    expect(conceptAllowed('money.rule-of-72.v2', '10-12')).toBe(false);
    expect(conceptAllowed('money.rule-of-72.v2', '13-17')).toBe(true);
    expect(conceptAllowed('money.opportunity-cost.v2', '6-9')).toBe(true);
    expect(conceptAllowed('money.lemonade-stand.v2', '6-9')).toBe(true);
  });
});

describe('Core grading of the concept boards', () => {
  it('grades each board on the server with a closed diagnostic, and refuses malformed input', () => {
    const balance = amortizationSchedule(1200, 1200, 12)[5]!.balance;
    expect(grade('loan-01', { month: 6, balance: String(balance) })?.correct).toBe(true);
    expect(grade('loan-01', { month: 5, balance: String(balance) })).toMatchObject({ correct: false, diagnostic: 'structure' });
    expect(grade('loan-01', { month: 6, balance: 'lots' })).toBeNull();
    expect(grade('market-01', { demand_shift: 1, supply_shift: 0, price: 'up' })?.correct).toBe(true);
    expect(grade('market-01', { demand_shift: 1, supply_shift: 0, price: 'down' })).toMatchObject({ correct: false, diagnostic: 'outcome' });
    expect(grade('market-01', { demand_shift: 0, supply_shift: -1, price: 'up' })).toMatchObject({ correct: false, diagnostic: 'structure' });
    expect(grade('prices-01', { rateBps: 300, years: 10, predictionMinor: 130 })?.correct).toBe(true);
    expect(grade('prices-01', { rateBps: 300, years: 10, predictionMinor: 200 })).toMatchObject({ correct: false, diagnostic: 'tolerance' });
    expect(grade('prices-01', { rateBps: 350, years: 10, predictionMinor: 130 })).toBeNull();
    expect(grade('double-01', { rateBps: 600, years: 12 })?.correct).toBe(true);
    expect(grade('double-01', { rateBps: 600, years: 20 })?.correct).toBe(false);
    expect(grade('debts-01', { strategy: 'avalanche' })?.correct).toBe(true);
    expect(grade('debts-01', { strategy: 'snowball' })?.correct).toBe(false);
    expect(grade('mix-01', { weights: { 'asset-stocks': 40, 'asset-bonds': 60, 'asset-cash': 0 } })?.correct).toBe(true);
    expect(grade('mix-01', { weights: { 'asset-stocks': 100, 'asset-bonds': 0, 'asset-cash': 0 } })).toMatchObject({ correct: false, diagnostic: 'structure' });
    expect(grade('mix-01', { weights: { 'asset-stocks': 40, 'asset-bonds': 50, 'asset-cash': 0 } })).toBeNull();
    expect(grade('stand-01', { price: 12, cups: 30 })?.correct).toBe(true);
    expect(grade('stand-01', { price: 2, cups: 60 })?.correct).toBe(false);
    expect(grade('stand-01', { price: 3, cups: 30 })).toBeNull();
    expect(grade('tokens-01', {})).toBeNull();
  });

  it('refuses a teen-only board in a younger pathway on delivery', () => {
    const young = structuredClone(row.document) as Record<string, unknown>;
    young.age_band = '10-12';
    young.eligibility = { minimum_age: 10, maximum_age: 12 };
    expect(validateV2LessonForGrading(young, row.answer_keys, { lessonId: 'v2-concept-boards', locale: 'en-US' })).toBeNull();
  });

  it('passes the interactive-behaviour gate across every permitted state', () => {
    const reports = checkV2Behaviour(document, row.answer_keys);
    expect(reports).toHaveLength(7);
    expect(reports.filter((r) => !r.ok)).toEqual([]);
  });

  it('flags a rubric the board cannot miss', () => {
    const keys = structuredClone(row.answer_keys);
    keys['stand-01'] = { target_profit_minor: -1_000 };
    const report = checkV2Behaviour(document, keys).find((r) => r.segmentId === 'stand-01')!;
    expect(report.problems.join(' ')).toMatch(/trivially met/);
  });
});
