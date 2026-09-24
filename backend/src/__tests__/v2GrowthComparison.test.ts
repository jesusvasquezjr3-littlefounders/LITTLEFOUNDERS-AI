import { describe, expect, it } from 'vitest';
import { growthComparison } from '../services/v2GrowthComparison.js';

describe('canonical simple and compound growth model', () => {
  it('posts to minor units and preserves the first-year equivalence', () => {
    expect(growthComparison({ principalMinor: 10_000, rateBasisPoints: 800, years: 3 })).toEqual([
      { year: 0, simpleMinor: 10_000, compoundMinor: 10_000 },
      { year: 1, simpleMinor: 10_800, compoundMinor: 10_800 },
      { year: 2, simpleMinor: 11_600, compoundMinor: 11_664 },
      { year: 3, simpleMinor: 12_400, compoundMinor: 12_597 },
    ]);
  });

  it('keeps both curves monotone and compound at or above simple for the authored range', () => {
    for (let rateBasisPoints = 200; rateBasisPoints <= 1_200; rateBasisPoints += 200) {
      const points = growthComparison({ principalMinor: 10_000, rateBasisPoints, years: 20 });
      expect(points).not.toBeNull();
      for (let year = 1; year <= 20; year += 1) {
        const previous = points?.[year - 1];
        const current = points?.[year];
        expect(current?.simpleMinor).toBeGreaterThan(previous?.simpleMinor ?? 0);
        expect(current?.compoundMinor).toBeGreaterThan(previous?.compoundMinor ?? 0);
        expect(current?.compoundMinor).toBeGreaterThanOrEqual(current?.simpleMinor ?? 0);
      }
    }
    expect(growthComparison({ principalMinor: 10_000, rateBasisPoints: 800, years: 31 })).toBeNull();
    expect(growthComparison({ principalMinor: 10_000.5, rateBasisPoints: 800, years: 10 })).toBeNull();
  });
});
