import { describe, expect, it } from 'vitest';
import { growthTimeline } from './growthModel';

const item = { periods: 4, minimum: 1, maximum: 4, step: 1, initial: 1 };

describe('savings timeline', () => {
  it('recomputes every point from the same amount without an accumulated rounding drift', () => {
    expect(growthTimeline(item, 3)).toEqual([
      { period: 0, balance: 0 },
      { period: 1, balance: 3 },
      { period: 2, balance: 6 },
      { period: 3, balance: 9 },
      { period: 4, balance: 12 },
    ]);
  });

  it('rejects off-grid values and unsafe totals', () => {
    expect(growthTimeline({ ...item, step: 2, maximum: 5 }, 4)).toBeNull();
    expect(growthTimeline(item, 5)).toBeNull();
    expect(growthTimeline({ ...item, periods: 25 }, 1)).toBeNull();
  });
});
