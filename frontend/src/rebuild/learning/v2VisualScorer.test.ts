import { describe, expect, it } from 'vitest';
import { scoreV2Visual } from './v2VisualScorer.generated';

describe('browser copy of the canonical v2 scorer', () => {
  it('validates semantic states without carrying a scoring rubric into the learner document', () => {
    expect(scoreV2Visual('money.allocation.v2', { total: 12, step: 1 }, { save: 4, spend: 4, share: 4 })).toBe('valid');
    expect(scoreV2Visual('money.allocation.v2', { total: 12, step: 1 }, { save: 4, spend: 4, share: 5 })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.whole.v2', { minimum: 0, maximum: 10, step: 1 }, { value: '7' })).toBe('valid');
  });

  it('keeps the worked-example semantic response aligned with Core', () => {
    const payload = { response_step_ids: ['discount-subtract', 'sale-price'] };
    const rubric = { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } };
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40', 'sale-price': '40' } }, rubric)).toBe('met');
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40', 'sale-price': '39' } }, rubric)).toBe('review');
  });
});
