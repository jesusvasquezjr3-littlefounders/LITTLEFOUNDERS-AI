import { describe, expect, it } from 'vitest';
import { TtsCallBudget } from './ttsBudget.js';

describe('TtsCallBudget', () => {
  it('reserves at most the configured number of calls', () => {
    const budget = new TtsCallBudget(2);
    expect(budget.tryReserve()).toBe(true);
    expect(budget.tryReserve()).toBe(true);
    expect(budget.tryReserve()).toBe(false);
    expect(budget.remainingCalls).toBe(0);
  });

  it('treats an unset ceiling as unlimited', () => {
    const budget = new TtsCallBudget();
    expect(budget.tryReserve()).toBe(true);
    expect(budget.remainingCalls).toBeNull();
  });

  it('rejects invalid ceilings before a paid batch can start', () => {
    expect(() => new TtsCallBudget(0)).toThrow('positive integer');
    expect(() => new TtsCallBudget(1.5)).toThrow('positive integer');
  });
});
