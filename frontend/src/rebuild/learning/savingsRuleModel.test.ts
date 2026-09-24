import { describe, expect, it } from 'vitest';
import { savingsRuleCases, savingsRuleOutcome } from './savingsRuleModel';

describe('savings IF–THEN rule model', () => {
  it('covers every truth-table combination and differs on exactly the one-condition cases', () => {
    const cases = savingsRuleCases(10, 2);
    expect(cases).toHaveLength(4);
    expect(cases?.map((value) => savingsRuleOutcome(value, 'and'))).toEqual([false, false, false, true]);
    expect(cases?.map((value) => savingsRuleOutcome(value, 'or'))).toEqual([false, true, true, true]);
  });

  it('refuses impossible numbers instead of treating them as a valid lesson state', () => {
    expect(savingsRuleCases(10, 10)).toBeNull();
    expect(savingsRuleCases(10, 0)).toBeNull();
    expect(savingsRuleCases(1, 1)).toBeNull();
    expect(savingsRuleOutcome({ saved: -1, goal: 10, goalDay: true }, 'and')).toBeNull();
    expect(savingsRuleOutcome({ saved: 10.5, goal: 10, goalDay: true }, 'or')).toBeNull();
  });
});
