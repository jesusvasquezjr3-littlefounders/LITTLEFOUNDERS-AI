// GAP-FIX-R2 learning: the Stage 2 gates carried over to v2 documents
// (Appendix C Part 3 Stage 2; B.22, B.26, B.27; G.2 no exempt path).
import { describe, expect, it } from 'vitest';
import { evaluateExpression, loadCarriedCourseData, runV2CarriedGates, v2AgeRegisterGate, v2ArithmeticGate, v2RewardAndWellbeingGates, v2VocabularyGate } from '../v2/carriedGates.js';
import { v2TextBlocks } from '../v2/gates.js';
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
    for (const id of ['forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic', 'forge.gate.17.reward-mechanics', 'forge.gate.18.wellbeing-language', 'forge.gate.19.age-register']) {
      expect(V2_MANIFEST_GATES).toContain(id);
    }
  });

  /*
   * GAP-FIX-R6 (B.20, B.23; Bible 02 §9.2; Appendix B §1.8): gate 19 now runs on v2 documents. From age 10 every
   * graded step names what was done right in `feedback.met`, generic praise (a bare "Correct" included) blocks,
   * the feedback strings are budgeted body copy, and gate 18's shame screen reads them too.
   */
  const tween = { age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } };
  const withFeedback = (feedback: Record<string, string>) => ({ ...allocation('Split 12 coins. Save at least 3.'), feedback });
  it('gate 19 requires named feedback on every graded v2 step from age 10, and not below', () => {
    expect(v2AgeRegisterGate(document([allocation('Split 12 coins.')], tween))).toEqual([
      expect.objectContaining({ gate: 19, severity: 'block', segmentId: 'allocate-01', message: expect.stringMatching(/needs feedback\.met/) })]);
    expect(v2AgeRegisterGate(document([withFeedback({ met: 'Your plan saves the goal and uses every coin.' })], tween))).toEqual([]);
    expect(v2AgeRegisterGate(document([allocation('Split 12 coins.')]))).toEqual([]);
  });

  it('gate 19 blocks praise that names nothing and a number the step does not show; gate 18 screens feedback for shame', () => {
    for (const met of ['Great job!', 'Correct', 'That works.']) {
      expect(v2AgeRegisterGate(document([withFeedback({ met })], tween)).map((item) => `${item.gate}:${item.severity}`), met).toContain('19:block');
    }
    expect(v2AgeRegisterGate(document([withFeedback({ met: 'You saved 9 of them.' })], tween))).toEqual([
      expect.objectContaining({ gate: 19, severity: 'block', message: expect.stringMatching(/feedback\.met shows 9/) })]);
    expect(v2RewardAndWellbeingGates(document([withFeedback({ met: 'Your plan saves the goal.', not_yet: "Not yet. You're not a saver." })], tween))
      .some((item) => item.gate === 18 && item.severity === 'block')).toBe(true);
  });

  it('counts both feedback lines as body copy under the Copy Budget', () => {
    const blocks = v2TextBlocks(document([withFeedback({ met: 'Your plan saves the goal.', not_yet: 'Not yet. Move coins into savings.' })], tween));
    expect(blocks.filter((block) => block.path.startsWith('feedback.'))).toEqual([
      { segmentId: 'allocate-01', path: 'feedback.met', role: 'body', text: 'Your plan saves the goal.' },
      { segmentId: 'allocate-01', path: 'feedback.not_yet', role: 'body', text: 'Not yet. Move coins into savings.' },
    ]);
  });
});
