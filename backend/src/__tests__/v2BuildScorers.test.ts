import { describe, expect, it } from 'vitest';
import { gradeV2Response, scoreV2Visual } from '../services/v2VisualScorer.js';
import { v2PublicLessonSchema, validateV2LessonForGrading, gradeV2Visual } from '../services/v2LessonDocument.js';

/*
 * GAP-FIX-R2 learning: $6 unit prices (Appendix P Part 3, M14), the L2 rule
 * builder graded by behaviour on hidden scenarios (Part 2, Part 4.6) and the
 * L6/$9 built flowchart evaluated on hidden cases. Every refused population
 * at the server boundary is listed.
 */

const offers = { scale: 1, offers: [{ id: 'small', quantity: 3, price: 45 }, { id: 'big', quantity: 5, price: 70 }] };
const unitKey = { unit_prices: { small: '15', big: '14' }, better_id: 'big' };

describe('$6 unit-price comparator', () => {
  it('meets exact or half-hundredth-rounded unit prices with the better choice', () => {
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '15', big: '14' }, choice: 'big' }, unitKey)).toBe('met');
    const thirds = { scale: 100, offers: [{ id: 'pack-a', quantity: 3, price: 1000 }, { id: 'pack-b', quantity: 4, price: 1400 }] }; // 3.333... and 3.50 local
    const key = { unit_prices: { 'pack-a': '10/3', 'pack-b': '7/2' }, better_id: 'pack-a' };
    expect(scoreV2Visual('money.unit-price.v2', thirds, { unit_prices: { 'pack-a': '3.33', 'pack-b': '3.5' }, choice: 'pack-a' }, key)).toBe('met');
    expect(gradeV2Response('money.unit-price.v2', thirds, { unit_prices: { 'pack-a': '3.3', 'pack-b': '3.5' }, choice: 'pack-a' }, key).diagnostic).toBe('value');
  });

  it('separates a wrong unit price (value) from a wrong choice (outcome)', () => {
    expect(gradeV2Response('money.unit-price.v2', offers, { unit_prices: { small: '15', big: '14' }, choice: 'small' }, unitKey).diagnostic).toBe('outcome');
    expect(gradeV2Response('money.unit-price.v2', offers, { unit_prices: { small: '45', big: '70' }, choice: 'big' }, unitKey).diagnostic).toBe('value');
  });

  it('refuses malformed answers and broken keys', () => {
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '15' }, choice: 'big' })).toBe('invalid');
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '-15', big: '14' }, choice: 'big' })).toBe('invalid');
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '15', big: '14' }, choice: 'other' })).toBe('invalid');
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: 'fifteen', big: '14' }, choice: 'big' })).toBe('invalid');
    // A key naming the dearer offer, or a wrong exact price, is not a key.
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '15', big: '14' }, choice: 'big' }, { ...unitKey, better_id: 'small' })).toBe('invalid');
    expect(scoreV2Visual('money.unit-price.v2', offers, { unit_prices: { small: '15', big: '14' }, choice: 'big' }, { ...unitKey, unit_prices: { small: '15', big: '14.5' } })).toBe('invalid');
  });
});

const rulePayload = (level: string) => ({ level, conditionIds: ['enough', 'want', 'sale'], actionIds: ['buy', 'wait'] });
const scenarios = [
  { enough: true, want: true, sale: false }, { enough: true, want: false, sale: false }, { enough: false, want: true, sale: true },
  { enough: false, want: false, sale: false }, { enough: true, want: true, sale: true },
];
const andKey = { target: { if: { and: [{ c: 'enough' }, { c: 'want' }] }, then: 'buy', else: 'wait' }, scenarios };

describe('L2 rule builder', () => {
  it('grades behaviour on the hidden scenarios, not layout', () => {
    const swapped = { rule: { if: { and: [{ c: 'want' }, { c: 'enough' }] }, then: 'buy', else: 'wait' } };
    expect(scoreV2Visual('logic.rule-builder.v2', rulePayload('connective'), swapped, andKey)).toBe('met');
    const inverted = { rule: { if: { or: [{ not: { c: 'enough' } }, { not: { c: 'want' } }] }, then: 'wait', else: 'buy' } };
    expect(scoreV2Visual('logic.rule-builder.v2', rulePayload('nested'), inverted, andKey)).toBe('met');
  });

  it('stores structure vs outcome diagnostics', () => {
    expect(gradeV2Response('logic.rule-builder.v2', rulePayload('connective'), { rule: { if: { c: 'enough' }, then: 'buy', else: 'wait' } }, andKey).diagnostic).toBe('structure');
    expect(gradeV2Response('logic.rule-builder.v2', rulePayload('connective'), { rule: { if: { or: [{ c: 'enough' }, { c: 'want' }] }, then: 'buy', else: 'wait' } }, andKey).diagnostic).toBe('outcome');
  });

  it('refuses shapes beyond the level, unknown tiles and keys that prove nothing', () => {
    const single = rulePayload('single');
    expect(scoreV2Visual('logic.rule-builder.v2', single, { rule: { if: { and: [{ c: 'enough' }, { c: 'want' }] }, then: 'buy', else: 'wait' } })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', rulePayload('connective'), { rule: { if: { not: { c: 'enough' } }, then: 'buy', else: 'wait' } })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', rulePayload('connective'), { rule: { if: { and: [{ and: [{ c: 'enough' }, { c: 'want' }] }, { c: 'sale' }] }, then: 'buy', else: 'wait' } })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', rulePayload('nested'), { rule: { if: { not: { not: { not: { not: { c: 'sale' } } } } }, then: 'buy', else: 'wait' } })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', single, { rule: { if: { c: 'mood' }, then: 'buy', else: 'wait' } })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', single, { rule: { if: { c: 'enough' }, then: 'steal', else: 'wait' } })).toBe('invalid');
    const answer = { rule: { if: { c: 'enough' }, then: 'buy', else: 'wait' } };
    // Fewer than five hidden scenarios, a constant target, then = else, or a scenario missing a fact.
    expect(scoreV2Visual('logic.rule-builder.v2', single, answer, { target: answer.rule, scenarios: scenarios.slice(0, 4) })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', single, answer, { target: answer.rule, scenarios: scenarios.map(() => ({ enough: true, want: true, sale: true })) })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', single, answer, { target: { ...answer.rule, else: 'buy' }, scenarios })).toBe('invalid');
    expect(scoreV2Visual('logic.rule-builder.v2', single, answer, { target: answer.rule, scenarios: [...scenarios.slice(0, 4), { enough: true }] })).toBe('invalid');
  });
});

describe('L6 / $9 built flowchart', () => {
  const payload = { mode: 'build', questionIds: ['need', 'afford'], outcomeIds: ['buy', 'save', 'skip'] };
  const cases = [
    { answers: { need: true, afford: true }, outcome: 'buy' }, { answers: { need: true, afford: false }, outcome: 'save' },
    { answers: { need: false, afford: true }, outcome: 'skip' }, { answers: { need: false, afford: false }, outcome: 'skip' },
    { answers: { need: true, afford: true }, outcome: 'buy' },
  ];
  const good = { q: 'need', yes: { q: 'afford', yes: { o: 'buy' }, no: { o: 'save' } }, no: { o: 'skip' } };
  const alsoGood = { q: 'afford', yes: { q: 'need', yes: { o: 'buy' }, no: { o: 'skip' } }, no: { q: 'need', yes: { o: 'save' }, no: { o: 'skip' } } };
  it('evaluates any tree that decides the hidden cases right', () => {
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: good }, { cases })).toBe('met');
    expect(scoreV2Visual('logic.flowchart.v2', payload, { tree: alsoGood }, { cases })).toBe('met');
    expect(gradeV2Response('money.spend-decision.v2', payload, { tree: { q: 'need', yes: { o: 'buy' }, no: { o: 'skip' } } }, { cases }).diagnostic).toBe('path');
    expect(gradeV2Response('money.spend-decision.v2', payload, { tree: { q: 'need', yes: { q: 'afford', yes: { o: 'save' }, no: { o: 'buy' } }, no: { o: 'skip' } } }, { cases }).diagnostic).toBe('outcome');
  });
  it('refuses repeated questions, unknown tiles and one-outcome keys', () => {
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: { q: 'need', yes: { q: 'need', yes: { o: 'buy' }, no: { o: 'skip' } }, no: { o: 'skip' } } })).toBe('invalid');
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: { o: 'steal' } })).toBe('invalid');
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: { q: 'need', yes: { o: 'buy' } } })).toBe('invalid');
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: good }, { cases: cases.map((item) => ({ ...item, outcome: 'buy' })) })).toBe('invalid');
    expect(scoreV2Visual('money.spend-decision.v2', payload, { tree: good }, { cases: cases.slice(0, 3) })).toBe('invalid');
  });
});

describe('the server boundary', () => {
  const document = {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'unit-prices', lesson_id: 'unit-lesson', version_id: 'rev-1',
    locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-unit-price'], adventure_scene_id: 'diorama-a',
    title: 'Price per item', required_capabilities: ['visual.ratio-table.v1', 'operation.number-input.v1', 'operation.choose-option.v1'],
    segments: [{ id: 'unit-01', type: 'money.unit-price.v2', grading: 'server', prompt: 'Find each price per sticker.', visual: { type: 'ratio-table' },
      payload: { currency: 'coins', unitLabel: 'sticker', offers: [{ id: 'small', label: 'Pack of 3', quantity: 3, price_minor: 45 }, { id: 'big', label: 'Pack of 5', quantity: 5, price_minor: 70 }] } }],
  };
  it('grades through Core and refuses tied offers, children in local currency and answer-bearing documents', () => {
    const lesson = validateV2LessonForGrading(document, { 'unit-01': unitKey }, { lessonId: 'unit-lesson', locale: 'en-US' });
    expect(lesson).not.toBeNull();
    expect(gradeV2Visual(lesson!, { 'unit-01': unitKey }, 'unit-01', { unit_prices: { small: '15', big: '14' }, choice: 'big' })?.correct).toBe(true);
    const segment = document.segments[0]!;
    const tied = { ...document, segments: [{ ...segment, payload: { ...segment.payload, offers: [segment.payload.offers[0], { ...segment.payload.offers[1], price_minor: 75 }] } }] };
    expect(v2PublicLessonSchema.safeParse(tied).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...segment, payload: { ...segment.payload, currency: 'local' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...segment, payload: { ...segment.payload, better_id: 'big' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, age_band: '6-9', eligibility: { minimum_age: 8, maximum_age: 9 } }).success).toBe(false);
  });
});

describe('notation at the server boundary (Bible 05 §5, GAP-FIX-R2)', () => {
  const worked = (notation: string | undefined, capabilities: string[]) => ({
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-13-17', chapter_id: 'compound', lesson_id: 'notation-lesson', version_id: 'rev-1',
    locale: 'pt-BR', age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 }, knowledge_component_ids: ['kc-compound-growth'], adventure_scene_id: 'diorama-a',
    title: 'Juros sobre juros', required_capabilities: capabilities,
    segments: [{ id: 'worked-01', type: 'math.worked-example.v2', grading: 'server', prompt: 'Acompanhe.', visual: { type: 'worked-example' }, payload: {
      steps: [{ id: 'grow-step', expression: '100 × 1,1²', result: '121', spokenText: 'Cem vezes 1,1 ao quadrado é 121', ...(notation ? { notation } : {}) },
        { id: 'less-step', expression: '121 − 100', result: '21', spokenText: 'Cento e vinte e um menos 100 é 21' },
        { id: 'end-step', expression: 'Juros', result: '21', spokenText: 'Os juros são 21' }], fade_count: 0, response_step_ids: ['less-step', 'end-step'] } }],
  });
  const base = ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'];
  it('requires the KaTeX capability exactly when a step declares notation, and refuses unsafe TeX', () => {
    expect(v2PublicLessonSchema.safeParse(worked('100 \\times 1.1^{2}', [...base, 'visual.math-notation.v1'])).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse(worked('100 \\times 1.1^{2}', base)).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(worked(undefined, [...base, 'visual.math-notation.v1'])).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(worked('\\href{https://x.test}{1}', [...base, 'visual.math-notation.v1'])).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(worked('\\text{hi}', [...base, 'visual.math-notation.v1'])).success).toBe(false);
  });
});

