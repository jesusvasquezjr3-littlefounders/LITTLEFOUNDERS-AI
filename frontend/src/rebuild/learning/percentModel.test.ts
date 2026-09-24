import { describe, expect, it } from 'vitest';
import { percentOutcome } from './percentModel';

describe('bounded percent exploration', () => {
  it('links discount and sample-tax outcomes to the same integer percent', () => {
    expect(percentOutcome({ baseUnits: 200, step: 5, initialPercent: 25, mode: 'discount' }, 25)).toEqual({ change: 50, final: 150 });
    expect(percentOutcome({ baseUnits: 200, step: 5, initialPercent: 25, mode: 'tax' }, 25)).toEqual({ change: 50, final: 250 });
    expect(percentOutcome({ baseUnits: 100, step: 5, initialPercent: 20, mode: 'discount' }, 100)).toEqual({ change: 100, final: 0 });
  });

  it('refuses off-grid, fractional, unsafe and impossible scenarios instead of rounding an answer', () => {
    const valid = { baseUnits: 200, step: 5, initialPercent: 25, mode: 'discount' as const };
    for (const [scenario, percent] of [
      [valid, 23], [valid, 101], [valid, -5], [valid, 5.5],
      [{ ...valid, baseUnits: 201 }, 25], [{ ...valid, step: 7 }, 28],
      [{ ...valid, initialPercent: 23 }, 25], [{ ...valid, baseUnits: Number.MAX_SAFE_INTEGER }, 25],
    ] as const) expect(percentOutcome(scenario, percent)).toBeNull();
  });

  it('preserves exact price conservation across every permitted 5% input', () => {
    for (const mode of ['discount', 'tax'] as const) for (const baseUnits of [100, 200, 1000]) {
      const scenario = { baseUnits, step: 5, initialPercent: 20, mode };
      for (let percent = 0; percent <= 100; percent += 5) {
        const result = percentOutcome(scenario, percent);
        expect(result).not.toBeNull();
        if (!result) continue;
        expect(result.change).toBe(baseUnits * percent / 100);
        expect(mode === 'discount' ? result.final + result.change : result.final - result.change).toBe(baseUnits);
      }
    }
  });
});
