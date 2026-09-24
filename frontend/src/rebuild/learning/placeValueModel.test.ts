import { describe, expect, it } from 'vitest';
import { placeValueState } from './placeValueModel';

describe('place value exchange', () => {
  it('conserves the total through each ten-for-ones trade and undo', () => {
    for (let total = 10; total <= 29; total += 1) {
      for (let trades = 0; trades <= Math.floor(total / 10); trades += 1) {
        const state = placeValueState(total, trades);
        expect(state).not.toBeNull();
        expect((state?.tens ?? 0) * 10 + (state?.ones ?? 0)).toBe(total);
        expect(state?.canTrade).toBe(trades < Math.floor(total / 10));
        expect(state?.canUndo).toBe(trades > 0);
      }
    }
    expect(placeValueState(14, 0)).toMatchObject({ tens: 0, ones: 14 });
    expect(placeValueState(14, 1)).toMatchObject({ tens: 1, ones: 4 });
  });

  it('refuses non-integer, out-of-range and impossible exchanges', () => {
    for (const [total, trades] of [[9, 0], [30, 0], [14.5, 0], [14, -1], [14, 2], [14, 0.5]] as [number, number][]) {
      expect(placeValueState(total, trades)).toBeNull();
    }
  });
});
