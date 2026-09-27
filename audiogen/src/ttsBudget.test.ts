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

// OD-28 (owner review D-03): the owner USD ceiling, priced per character.
describe('TtsCallBudget USD ceiling', () => {
  it('admits reservations until the next one would pass the ceiling, then reports exhausted', () => {
    const budget = new TtsCallBudget(undefined, { maxUsd: 1, usdPer1kChars: 0.5 });
    expect(budget.tryReserve(1000)).toBe(true); // $0.50
    expect(budget.tryReserve(800)).toBe(true); // $0.90
    expect(budget.exhausted).toBe(false);
    expect(budget.tryReserve(400)).toBe(false); // would be $1.10
    expect(budget.exhausted).toBe(true);
    expect(budget.spentUsd).toBeCloseTo(0.9, 6);
  });

  it('binds together with the call cap: whichever runs out first', () => {
    const budget = new TtsCallBudget(1, { maxUsd: 100, usdPer1kChars: 0.5 });
    expect(budget.tryReserve(10)).toBe(true);
    expect(budget.tryReserve(10)).toBe(false);
    expect(budget.exhausted).toBe(true);
  });

  it('never partially admits a refused reservation', () => {
    const budget = new TtsCallBudget(5, { maxUsd: 0.1, usdPer1kChars: 1 });
    expect(budget.tryReserve(200)).toBe(false);
    expect(budget.spentUsd).toBe(0);
    expect(budget.remainingCalls).toBe(5);
  });

  it.each([
    [{ maxUsd: 0, usdPer1kChars: 1 }],
    [{ maxUsd: Number.POSITIVE_INFINITY, usdPer1kChars: 1 }],
    [{ maxUsd: 1, usdPer1kChars: 0 }],
    [{ maxUsd: 1, usdPer1kChars: Number.NaN }],
  ])('rejects an unenforceable ceiling %o', (ceiling) => {
    expect(() => new TtsCallBudget(undefined, ceiling)).toThrow(RangeError);
  });
});
