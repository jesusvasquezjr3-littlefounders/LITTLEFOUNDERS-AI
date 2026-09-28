import { describe, expect, it } from 'vitest';
import { placeValueReplay, placeValueState } from './placeValueModel';

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

  it('composes three places and replays a subtraction with borrows (GAP-FIX-R2)', () => {
    const compose = { mode: 'compose' as const, total: 235, start: { hundreds: 1, tens: 12, ones: 15 } };
    expect(placeValueReplay(compose, [])).toMatchObject({ ready: false, can: { ten: true, hundred: true } });
    expect(placeValueReplay(compose, ['ten', 'hundred'])).toMatchObject({ hundreds: 2, tens: 3, ones: 5, ready: true, result: { hundreds: 2, tens: 3, ones: 5 } });
    expect(placeValueReplay(compose, ['borrow-ten'])).toBeNull();
    const subtract = { mode: 'subtract' as const, minuend: 100, subtrahend: 37 };
    expect(placeValueReplay(subtract, [])).toMatchObject({ ready: false, can: { 'borrow-ten': false, 'borrow-hundred': true } });
    expect(placeValueReplay(subtract, ['borrow-hundred', 'borrow-ten'])).toMatchObject({ hundreds: 0, tens: 9, ones: 10, ready: true, result: { hundreds: 0, tens: 6, ones: 3 } });
    expect(placeValueReplay(subtract, ['borrow-ten'])).toBeNull();
    // Conservation: every replayed state keeps the value.
    const state = placeValueReplay(subtract, ['borrow-hundred']);
    expect((state?.hundreds ?? 0) * 100 + (state?.tens ?? 0) * 10 + (state?.ones ?? 0)).toBe(100);
  });
});
