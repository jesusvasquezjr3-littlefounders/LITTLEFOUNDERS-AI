import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { plane1 } from '../../services/horizonte/plane1/index.js';
import { PLANE1_CAPABILITIES } from '../../services/horizonte/plane1/capabilities.js';
import { PLANE1_FIXTURES } from '../../services/horizonte/plane1/fixtures.js';
import { solveBreakEven, solveCostStructure, solveMarginMarkup } from '../../services/horizonte/plane1/finance.js';
import { clearingPrice, elasticPrice, shiftedMarket, solveElasticity, solveMarketShift } from '../../services/horizonte/plane1/market.js';
import { isGrid, isLine, riseForRun, solveLinkedViews, solveRateOfChange, solveSlopeTriangle } from '../../services/horizonte/plane1/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: string) => plane1.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => PLANE1_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const payloadOf = (id: string) => segmentOf(id).payload as Record<string, unknown>;
const verdictOf = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric).verdict;

function lesson(entry = PLANE1_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  const type = segment.type as keyof typeof PLANE1_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-plane', chapter_id: 'horizonte-plane1', lesson_id: `hz-plane1-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...PLANE1_CAPABILITIES[type]], segments: [segment],
  };
}

describe('plane1 pack: F1.9 slope and linked views, F1.11 break-even and cost structure, F1.12 supply and demand', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(plane1, PLANE1_FIXTURES)).not.toThrow();
  });

  it('declares every segment type with a fixture, a rubric, a scorer and a scope', () => {
    const types = Object.keys(PLANE1_CAPABILITIES).sort();
    expect(types).toEqual([
      'alg.linked-views.v2', 'alg.rate-of-change.v2', 'alg.slope-triangle.v2', 'econ.elasticity.v2', 'econ.market-shift.v2',
      'fin.break-even.v2', 'fin.cost-structure.v2', 'fin.margin-markup.v2',
    ]);
    for (const type of types) {
      expect(PLANE1_FIXTURES.some((entry) => entry.segment('en-US').type === type), type).toBe(true);
      expect(plane1.scorers[type], type).toBeTruthy();
      expect(plane1.ageScope[type], type).toBeTruthy();
      expect((plane1.rubrics as Record<string, unknown>)[type], type).toBeTruthy();
    }
    expect(PLANE1_FIXTURES).toHaveLength(12);
  });

  it('keeps the grid and the slope model exact and total', () => {
    const grid = { xMax: 8, yMin: 0, yMax: 8 };
    expect(isGrid(grid)).toBe(true);
    expect(isGrid({ xMax: 3, yMin: 0, yMax: 8 })).toBe(false);
    expect(isGrid({ xMax: 8, yMin: 1, yMax: 8 })).toBe(false);
    expect(isGrid({ xMax: 8, yMin: 0, yMax: 8, extra: 1 })).toBe(false);
    expect(isGrid({ xMax: 8.5, yMin: 0, yMax: 8 })).toBe(false);
    const line = { from: { x: 1, y: 1 }, to: { x: 4, y: 7 } };
    expect(isLine(line, grid)).toBe(true);
    expect(isLine({ from: line.to, to: line.from }, grid)).toBe(false);
    expect(isLine({ from: { x: 1, y: 1 }, to: { x: 4, y: 1 } }, grid)).toBe(false);
    expect(isLine({ from: { x: 1, y: 1 }, to: { x: 9, y: 7 } }, grid)).toBe(false);
    expect(riseForRun(line, 3)).toBe(6);
    expect(riseForRun(line, 1)).toBe(2);
    expect(riseForRun({ from: { x: 0, y: 1 }, to: { x: 6, y: 5 } }, 3)).toBe(2);
    expect(riseForRun({ from: { x: 0, y: 1 }, to: { x: 6, y: 5 } }, 2)).toBeNull();
  });

  it('solves the slope triangle and refuses a payload with no whole answer', () => {
    expect(solveSlopeTriangle(payloadOf('slope-triangle-run'))).toEqual({ ok: true, answer: 6 });
    expect(solveSlopeTriangle(payloadOf('slope-triangle-gentle'))).toEqual({ ok: true, answer: 2 });
    const base = payloadOf('slope-triangle-gentle');
    expect(solveSlopeTriangle({ ...base, run: 2 }).ok).toBe(false);
    expect(solveSlopeTriangle({ ...base, run: 9 }).ok).toBe(false);
    expect(solveSlopeTriangle({ ...base, start: 2 }).ok).toBe(false);
    expect(solveSlopeTriangle({ ...base, start: 8 }).ok).toBe(false);
    expect(solveSlopeTriangle({ ...base, extra: 1 }).ok).toBe(false);
    expect(solveSlopeTriangle({ ...base, run: 6, line: { from: { x: 4, y: 1 }, to: { x: 8, y: 5 } } }).ok).toBe(false);
    expect(solveSlopeTriangle(null).ok).toBe(false);
    expect(solveSlopeTriangle('x').ok).toBe(false);
  });

  it('grades the slope triangle', () => {
    expect(verdictOf('slope-triangle-run', { rise: 6 })).toBe('met');
    expect(verdictOf('slope-triangle-run', { rise: 3 })).toBe('review');
    expect(verdictOf('slope-triangle-run', { rise: 2 })).toBe('valid');
    expect(verdictOf('slope-triangle-run', { rise: 8 })).toBe('invalid');
    expect(verdictOf('slope-triangle-run', { rise: 2.5 })).toBe('invalid');
    expect(verdictOf('slope-triangle-run', { rise: 6, extra: 1 })).toBe('invalid');
    expect(verdictOf('slope-triangle-run', { rise: 6 }, { target: 5 })).toBe('invalid');
    expect(verdictOf('slope-triangle-run', { rise: 6 }, { target: 6, extra: 1 })).toBe('invalid');
    expect(verdictOf('slope-triangle-gentle', { rise: 2 })).toBe('met');
    expect(grade('alg.slope-triangle.v2')(segmentOf('slope-triangle-run'), { rise: 3 }, fixture('slope-triangle-run').rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(grade('alg.slope-triangle.v2')(segmentOf('slope-triangle-run'), { rise: 6 }, fixture('slope-triangle-run').rubric)).toEqual({ verdict: 'met', diagnostic: 'none' });
  });

  it('solves and grades the rate of change', () => {
    expect(solveRateOfChange(payloadOf('rate-of-change-steps'))).toEqual({ ok: true, answer: 20 });
    const base = payloadOf('rate-of-change-steps');
    expect(solveRateOfChange({ ...base, rate: 9 }).ok).toBe(false);
    expect(solveRateOfChange({ ...base, rate: 8 }).ok).toBe(false);
    expect(solveRateOfChange({ ...base, at: 0 }).ok).toBe(false);
    expect(solveRateOfChange({ ...base, at: 11 }).ok).toBe(false);
    expect(solveRateOfChange({ ...base, start: 20 }).ok).toBe(false);
    expect(verdictOf('rate-of-change-steps', { y: 20 })).toBe('met');
    expect(verdictOf('rate-of-change-steps', { y: 17 })).toBe('review');
    expect(verdictOf('rate-of-change-steps', { y: 8 })).toBe('valid');
    expect(verdictOf('rate-of-change-steps', { y: 25 })).toBe('invalid');
    expect(verdictOf('rate-of-change-steps', { y: 20 }, { target: 21 })).toBe('invalid');
  });

  it('solves and grades the linked views', () => {
    expect(solveLinkedViews(payloadOf('linked-views-line'))).toEqual({ ok: true, answer: { m: 2, b: 3 } });
    const base = payloadOf('linked-views-line');
    expect(solveLinkedViews({ ...base, given: [{ x: 1, y: 5 }, { x: 3, y: 8 }] }).ok).toBe(false);
    expect(solveLinkedViews({ ...base, given: [{ x: 3, y: 9 }, { x: 1, y: 5 }] }).ok).toBe(false);
    expect(solveLinkedViews({ ...base, given: [{ x: 1, y: 5 }] }).ok).toBe(false);
    expect(solveLinkedViews({ ...base, given: [{ x: 1, y: 5 }, { x: 2, y: 20 }] }).ok).toBe(false);
    expect(solveLinkedViews({ ...base, start: { m: 2, b: 3 } }).ok).toBe(false);
    expect(solveLinkedViews({ ...base, given: [{ x: 0, y: 4 }, { x: 4, y: 0 }], start: { m: 1, b: 0 } })).toEqual({ ok: true, answer: { m: -1, b: 4 } });
    expect(solveLinkedViews({ ...base, given: [{ x: 0, y: 4 }, { x: 4, y: 3 }], start: { m: 1, b: 0 } }).ok).toBe(false);
    expect(verdictOf('linked-views-line', { m: 2, b: 3 })).toBe('met');
    expect(verdictOf('linked-views-line', { m: 2, b: 4 })).toBe('review');
    expect(verdictOf('linked-views-line', { m: 3, b: 3 })).toBe('review');
    expect(verdictOf('linked-views-line', { m: 1, b: 0 })).toBe('valid');
    expect(verdictOf('linked-views-line', { m: 10, b: 3 })).toBe('invalid');
    expect(verdictOf('linked-views-line', { m: 2 })).toBe('invalid');
    expect(verdictOf('linked-views-line', { m: 2, b: 3 }, { target: { m: 2, b: 4 } })).toBe('invalid');
    expect(verdictOf('linked-views-line', { m: 2, b: 3 }, { target: 3 })).toBe('invalid');
  });

  it('solves and grades the break-even', () => {
    expect(solveBreakEven(payloadOf('break-even-stand'))).toEqual({ ok: true, answer: 20 });
    const base = payloadOf('break-even-stand');
    expect(solveBreakEven({ ...base, fixed: 61 }).ok).toBe(false);
    expect(solveBreakEven({ ...base, unit: 5 }).ok).toBe(false);
    expect(solveBreakEven({ ...base, maxUnits: 10 }).ok).toBe(false);
    expect(solveBreakEven({ ...base, start: 20 }).ok).toBe(false);
    expect(verdictOf('break-even-stand', { units: 20 })).toBe('met');
    expect(verdictOf('break-even-stand', { units: 19 })).toBe('review');
    expect(verdictOf('break-even-stand', { units: 5 })).toBe('valid');
    expect(verdictOf('break-even-stand', { units: 41 })).toBe('invalid');
    expect(verdictOf('break-even-stand', { units: 20 }, { target: 15 })).toBe('invalid');
  });

  it('solves and grades the cost structure', () => {
    expect(solveCostStructure(payloadOf('cost-structure-average'))).toEqual({ ok: true, answer: 40 });
    const base = payloadOf('cost-structure-average');
    expect(solveCostStructure({ ...base, goal: { average: 5 } }).ok).toBe(false);
    expect(solveCostStructure({ ...base, goal: { average: 9 } })).toEqual({ ok: true, answer: 30 });
    expect(solveCostStructure({ ...base, goal: { average: 7 } }).ok).toBe(false);
    expect(solveCostStructure({ ...base, goal: { average: 6 } }).ok).toBe(false);
    expect(solveCostStructure({ ...base, start: 40 }).ok).toBe(false);
    expect(solveCostStructure({ ...base, start: 0 }).ok).toBe(false);
    expect(verdictOf('cost-structure-average', { units: 40 })).toBe('met');
    expect(verdictOf('cost-structure-average', { units: 30 })).toBe('review');
    expect(verdictOf('cost-structure-average', { units: 10 })).toBe('valid');
    expect(verdictOf('cost-structure-average', { units: 0 })).toBe('invalid');
    expect(verdictOf('cost-structure-average', { units: 40 }, { target: 24 })).toBe('invalid');
  });

  it('prices a markup on cost and a margin on price', () => {
    expect(solveMarginMarkup(payloadOf('markup-price'))).toEqual({ ok: true, answer: 60 });
    expect(solveMarginMarkup(payloadOf('margin-price'))).toEqual({ ok: true, answer: 80 });
    const markup = payloadOf('markup-price');
    expect(solveMarginMarkup({ ...markup, basis: 'margin' })).toEqual({ ok: true, answer: 80 });
    expect(solveMarginMarkup({ ...markup, basis: 'margin', percent: 45 }).ok).toBe(false);
    expect(solveMarginMarkup({ ...markup, percent: 51 }).ok).toBe(false);
    expect(solveMarginMarkup({ ...markup, percent: 301 }).ok).toBe(false);
    expect(solveMarginMarkup({ ...markup, maxPrice: 50 }).ok).toBe(false);
    expect(solveMarginMarkup({ ...markup, basis: 'discount' }).ok).toBe(false);
    expect(solveMarginMarkup({ ...payloadOf('margin-price'), percent: 91 }).ok).toBe(false);
    expect(solveMarginMarkup({ ...payloadOf('margin-price'), percent: 30 }).ok).toBe(false);
    expect(verdictOf('markup-price', { price: 60 })).toBe('met');
    expect(verdictOf('markup-price', { price: 50 })).toBe('review');
    expect(verdictOf('markup-price', { price: 40 })).toBe('valid');
    expect(verdictOf('markup-price', { price: 101 })).toBe('invalid');
    expect(verdictOf('margin-price', { price: 80 })).toBe('met');
    expect(verdictOf('margin-price', { price: 75 })).toBe('review');
    expect(verdictOf('margin-price', { price: 80 }, { target: 75 })).toBe('invalid');
  });

  it('clears a market and shifts a curve with whole numbers', () => {
    const market = { demand: { a: 60, b: 4 }, supply: { c: 0, d: 2 } };
    expect(clearingPrice(market)).toBe(10);
    expect(clearingPrice({ demand: { a: 61, b: 4 }, supply: { c: 0, d: 2 } })).toBeNull();
    expect(shiftedMarket(market, { curve: 'demand', by: 12 }).demand.a).toBe(72);
    expect(shiftedMarket(market, { curve: 'supply', by: -6 }).supply.c).toBe(-6);
    expect(clearingPrice(shiftedMarket(market, { curve: 'demand', by: 12 }))).toBe(12);
    expect(solveMarketShift(payloadOf('market-shift-demand'))).toEqual({ ok: true, answer: { direction: 'up', price: 12 } });
    expect(solveMarketShift(payloadOf('market-shift-supply'))).toEqual({ ok: true, answer: { direction: 'down', price: 11 } });
    const base = payloadOf('market-shift-demand');
    expect(solveMarketShift({ ...base, shift: { curve: 'demand', by: 0 } }).ok).toBe(false);
    expect(solveMarketShift({ ...base, shift: { curve: 'demand', by: 5 } }).ok).toBe(false);
    expect(solveMarketShift({ ...base, shift: { curve: 'tax', by: 12 } }).ok).toBe(false);
    expect(solveMarketShift({ ...base, shift: { curve: 'demand', by: -12 } })).toEqual({ ok: true, answer: { direction: 'down', price: 8 } });
    expect(solveMarketShift({ ...base, pMax: 11 }).ok).toBe(false);
    expect(solveMarketShift({ ...base, start: 12 }).ok).toBe(false);
    expect(solveMarketShift({ ...base, qMax: 22 }).ok).toBe(false);
  });

  it('grades the market shift on the choice and the price together', () => {
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 12 })).toBe('met');
    expect(verdictOf('market-shift-demand', { direction: 'down', price: 12 })).toBe('review');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 11 })).toBe('review');
    expect(verdictOf('market-shift-demand', { direction: 'unset', price: 12 })).toBe('review');
    expect(verdictOf('market-shift-demand', { direction: 'unset', price: 10 })).toBe('valid');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 10 })).toBe('review');
    expect(verdictOf('market-shift-demand', { direction: 'sideways', price: 10 })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 17 })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { direction: 'up' })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { price: 12 })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 12 }, { target: { direction: 'down', price: 12 } })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 12 }, { target: { direction: 'up', price: 13 } })).toBe('invalid');
    expect(verdictOf('market-shift-demand', { direction: 'up', price: 12 }, { target: 12 })).toBe('invalid');
    expect(verdictOf('market-shift-supply', { direction: 'down', price: 11 })).toBe('met');
    expect(verdictOf('market-shift-supply', { direction: 'up', price: 11 })).toBe('review');
  });

  it('solves and grades the elasticity', () => {
    expect(elasticPrice({ a: 60, b: 2 }, { num: 1, den: 1 })).toBe(15);
    expect(elasticPrice({ a: 90, b: 3 }, { num: 1, den: 2 })).toBe(10);
    expect(elasticPrice({ a: 90, b: 3 }, { num: 2, den: 1 })).toBe(20);
    expect(elasticPrice({ a: 61, b: 2 }, { num: 1, den: 1 })).toBeNull();
    expect(solveElasticity(payloadOf('elasticity-unit'))).toEqual({ ok: true, answer: 15 });
    expect(solveElasticity(payloadOf('elasticity-half'))).toEqual({ ok: true, answer: 10 });
    const base = payloadOf('elasticity-unit');
    expect(solveElasticity({ ...base, pMax: 30 }).ok).toBe(false);
    expect(solveElasticity({ ...base, goal: { num: 1, den: 3 } }).ok).toBe(false);
    expect(solveElasticity({ ...base, goal: { num: 5, den: 1 } }).ok).toBe(false);
    expect(solveElasticity({ ...base, start: 15 }).ok).toBe(false);
    expect(solveElasticity({ ...base, pMax: 14 }).ok).toBe(false);
    expect(verdictOf('elasticity-unit', { price: 15 })).toBe('met');
    expect(verdictOf('elasticity-unit', { price: 14 })).toBe('review');
    expect(verdictOf('elasticity-unit', { price: 5 })).toBe('valid');
    expect(verdictOf('elasticity-unit', { price: 0 })).toBe('invalid');
    expect(verdictOf('elasticity-unit', { price: 15 }, { target: 10 })).toBe('invalid');
    expect(verdictOf('elasticity-half', { price: 10 })).toBe('met');
    expect(verdictOf('elasticity-half', { price: 15 })).toBe('review');
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const entry of PLANE1_FIXTURES) {
      const type = entry.segment('en-US').type as string;
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined).verdict, entry.id).toBe('valid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.invalid, undefined).verdict, entry.id).toBe('invalid');
    }
  });

  it('is total on garbage segments and responses', () => {
    for (const type of Object.keys(PLANE1_CAPABILITIES)) {
      for (const segment of [undefined, null, 0, 'x', [], {}, { payload: null }, { payload: 'x' }, { payload: {} }]) {
        for (const response of [undefined, null, 0, 'x', [], {}]) expect(grade(type)(segment, response, undefined).verdict, type).toBe('invalid');
      }
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('alg.slope-triangle.v2', '13-17', 13, 14)).toBeNull();
    expect(scope('alg.slope-triangle.v2', '10-12', 12, 12)).not.toBeNull();
    expect(scope('alg.slope-triangle.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('alg.rate-of-change.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('alg.linked-views.v2', '10-12', 12, 12)).toBeNull();
    expect(scope('alg.linked-views.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('alg.linked-views.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('fin.break-even.v2', '10-12', 12, 12)).toBeNull();
    expect(scope('fin.break-even.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('fin.break-even.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('fin.cost-structure.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('fin.margin-markup.v2', '10-12', 11, 12)).not.toBeNull();
    expect(scope('econ.market-shift.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('econ.market-shift.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('econ.market-shift.v2', '10-12', 12, 12)).not.toBeNull();
    expect(scope('econ.elasticity.v2', '13-17', 14, 17)).toBeNull();
    expect(scope('econ.elasticity.v2', '10-12', 10, 12)).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade', () => {
    for (const entry of PLANE1_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of PLANE1_FIXTURES) {
      const document = lesson(entry);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteGrade({ type: entry.segment('en-US').type as string }, entry.ladder.met, entry.rubric), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const breakEven = lesson(fixture('break-even-stand'));
    const key = (target: unknown) => ({ 'break-even-stand': { target } });
    expect(validateV2LessonForGrading(breakEven, key(19), { lessonId: breakEven.lesson_id, locale: breakEven.locale })).toBeNull();
    expect(gradeV2Visual(v2PublicLessonSchema.parse(breakEven), key(20), 'break-even-stand', { units: 19 })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
  });

  it('refuses a payload that leaks the answer, a wrong visual, an unsolvable setup and an out-of-scope document', () => {
    const base = lesson(fixture('break-even-stand'));
    const withPayload = (payload: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload }] });
    const payload = base.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, target: 20 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, fixed: 61 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, price: 2 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, start: 20 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'cost-structure' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const market = lesson(fixture('market-shift-demand'));
    const shifted = market.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...market, segments: [{ ...market.segments[0], payload: { ...shifted, shift: { curve: 'demand', by: 5 } } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...market, segments: [{ ...market.segments[0], payload: { ...shifted, direction: 'up' } }] }).success).toBe(false);
    const slope = lesson(fixture('slope-triangle-run'));
    const triangle = slope.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...slope, segments: [{ ...slope.segments[0], payload: { ...triangle, run: 5 } }] }).success).toBe(false);
    const linked = lesson(fixture('linked-views-line'));
    const views = linked.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...linked, segments: [{ ...linked.segments[0], payload: { ...views, given: [{ x: 1, y: 5 }, { x: 3, y: 8 }] } }] }).success).toBe(false);
  });
});
