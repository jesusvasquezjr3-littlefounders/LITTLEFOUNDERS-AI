import { describe, expect, it } from 'vitest';
import { growthComparison } from './growthComparisonModel.generated';

describe('simple and compound comparison model', () => {
  it('uses the same principal and annual rate, with exact minor-unit posting', () => {
    expect(growthComparison({ principalMinor: 10_000, rateBasisPoints: 800, years: 3 })).toEqual([
      { year: 0, simpleMinor: 10_000, compoundMinor: 10_000 },
      { year: 1, simpleMinor: 10_800, compoundMinor: 10_800 },
      { year: 2, simpleMinor: 11_600, compoundMinor: 11_664 },
      { year: 3, simpleMinor: 12_400, compoundMinor: 12_597 },
    ]);
  });

  it('never accepts fractional, negative, extreme or non-finite inputs', () => {
    for (const input of [
      { principalMinor: 10_000.5, rateBasisPoints: 800, years: 10 },
      { principalMinor: -100, rateBasisPoints: 800, years: 10 },
      { principalMinor: 10_000, rateBasisPoints: 0, years: 10 },
      { principalMinor: 10_000, rateBasisPoints: 1_600, years: 10 },
      { principalMinor: 10_000, rateBasisPoints: 800, years: 31 },
      { principalMinor: Number.NaN, rateBasisPoints: 800, years: 10 },
    ]) expect(growthComparison(input)).toBeNull();
  });
});
