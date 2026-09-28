// GAP-FIX-R2 learning: the Stage 2 gates carried over to v2 documents
// (Appendix C Part 3 Stage 2; B.22, B.26, B.27; G.2 no exempt path).
import { describe, expect, it } from 'vitest';
import { evaluateExpression, loadCarriedCourseData, runV2CarriedGates, v2ArithmeticGate, v2RewardAndWellbeingGates, v2VocabularyGate } from '../v2/carriedGates.js';
import { V2_MANIFEST_GATES } from '../v2/release.js';

const document = (segments: unknown[], extra: Record<string, unknown> = {}) => ({
  schema_version: 2, course_id: 'financial-education', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 },
  title: 'Split your coins', segments, ...extra,
});
const allocation = (prompt: string) => ({ id: 'allocate-01', type: 'money.allocation.v2', grading: 'server', prompt, visual: { type: 'stacked-bar' },
  payload: { total: 12, step: 1, currency: 'coins' } });

describe('v2 carried gates', () => {
  it('gate 17 blocks a randomized reward on a v2 segment and reviews mystery-prize copy', () => {
    const findings = v2RewardAndWellbeingGates(document([{ ...allocation('Split 12 coins.'), xp: [5, 10] }]));
    expect(findings.some((item) => item.gate === 17 && item.severity === 'block')).toBe(true);
    const review = v2RewardAndWellbeingGates(document([allocation('Spin the wheel for a mystery prize.')]));
    expect(review.some((item) => item.gate === 17 && item.severity === 'review')).toBe(true);
  });

  it('gate 18 blocks shame and family-finance moralizing, never structural ids', () => {
    expect(v2RewardAndWellbeingGates(document([allocation('You are bad with money.')])).filter((item) => item.gate === 18 && item.severity === 'block')).not.toHaveLength(0);
    expect(v2RewardAndWellbeingGates(document([{ ...allocation('Split 12 coins.'), id: 'lazy-poor-01' }]))).toEqual([]);
  });

  it('gate 2 reads the tiers the eligibility reaches and keeps pt-BR accents apart', () => {
    const data = loadCarriedCourseData('financial-education');
    expect(v2VocabularyGate(document([allocation('Earn interest on 12 coins.')]), data).map((item) => item.gate)).toEqual([2]);
    // "Divida" (divide) is not "dívida" (debt).
    expect(v2VocabularyGate(document([allocation('Divida 12 moedas.')], { locale: 'pt-BR' }), data)).toEqual([]);
    expect(v2VocabularyGate(document([allocation('Pague a dívida.')], { locale: 'pt-BR' }), data).map((item) => item.gate)).toEqual([2]);
    // A teen lesson reaches no 6-10 tier.
    expect(v2VocabularyGate(document([allocation('Earn interest on 12 coins.')], { age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 } }), data)).toEqual([]);
    expect(v2VocabularyGate(document([allocation('Split.')], { course_id: 'no-such-course' }), loadCarriedCourseData('no-such-course')).map((item) => item.severity)).toEqual(['block']);
  });

  it('gate 4 re-executes worked steps, keys, change and unit prices', () => {
    expect(evaluateExpression('20% × 50')).toBe(10);
    expect(evaluateExpression('50 − 10')).toBe(40);
    expect(evaluateExpression('3 × 4,50')).toBe(13.5);
    expect(evaluateExpression('Sale price')).toBeNull();
    const worked = { id: 'worked-01', type: 'math.worked-example.v2', payload: { steps: [
      { id: 'step-one', expression: '20% × 50', result: '10' }, { id: 'step-two', expression: '50 − 10', result: '40' }, { id: 'step-end', expression: 'Sale price', result: '40' }] } };
    expect(v2ArithmeticGate(document([worked]), { 'worked-01': { expectedValues: { 'step-two': '40', 'step-end': '40' } } })).toEqual([]);
    expect(v2ArithmeticGate(document([worked]), { 'worked-01': { expectedValues: { 'step-two': '41', 'step-end': '40' } } }).map((item) => item.gate)).toEqual([4]);
    const change = { id: 'change-01', type: 'money.making-change.v2', payload: { price_minor: 13, paid_minor: 20 } };
    expect(v2ArithmeticGate(document([change]), { 'change-01': { change_minor: 6 } }).map((item) => item.gate)).toEqual([4]);
    const unit = { id: 'unit-01', type: 'money.unit-price.v2', payload: { currency: 'coins', offers: [{ id: 'small', quantity: 3, price_minor: 45 }] } };
    expect(v2ArithmeticGate(document([unit]), { 'unit-01': { unit_prices: { small: '15' } } })).toEqual([]);
    expect(v2ArithmeticGate(document([unit]), { 'unit-01': { unit_prices: { small: '45/2' } } }).map((item) => item.gate)).toEqual([4]);
  });

  it('runs every carried gate in one pass and lists them in the v2 publication manifest', () => {
    expect(runV2CarriedGates(document([allocation('Split 12 coins.')])).problems).toEqual([]);
    for (const id of ['forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic', 'forge.gate.17.reward-mechanics', 'forge.gate.18.wellbeing-language']) {
      expect(V2_MANIFEST_GATES).toContain(id);
    }
  });
});
