import { describe, expect, it } from 'vitest';
import { taxBracketModel } from '../services/v2TaxBracket.js';

const brackets = [
  { upToMinor: 10_000, rateBasisPoints: 1_000 },
  { upToMinor: 30_000, rateBasisPoints: 2_000 },
  { upToMinor: null, rateBasisPoints: 3_000 },
] as const;

describe('canonical marginal tax-bracket model', () => {
  it('fills brackets in order and keeps a higher marginal rate from taxing earlier income again', () => {
    expect(taxBracketModel(40_000, brackets)).toEqual({
      incomeMinor: 40_000,
      slices: [
        { lowerMinor: 0, upperMinor: 10_000, taxableMinor: 10_000, taxMinor: 1_000, rateBasisPoints: 1_000 },
        { lowerMinor: 10_000, upperMinor: 30_000, taxableMinor: 20_000, taxMinor: 4_000, rateBasisPoints: 2_000 },
        { lowerMinor: 30_000, upperMinor: null, taxableMinor: 10_000, taxMinor: 3_000, rateBasisPoints: 3_000 },
      ],
      totalTaxMinor: 8_000, takeHomeMinor: 32_000, marginalRateBasisPoints: 3_000, averageRateBasisPoints: 2_000,
    });
  });

  it('rejects malformed boundaries and uses zero rates for no income', () => {
    expect(taxBracketModel(0, brackets)).toMatchObject({ totalTaxMinor: 0, takeHomeMinor: 0, marginalRateBasisPoints: 0, averageRateBasisPoints: 0 });
    expect(taxBracketModel(10_000, [{ upToMinor: null, rateBasisPoints: 1_000 }, { upToMinor: 20_000, rateBasisPoints: 2_000 }])).toBeNull();
    expect(taxBracketModel(10_000, [{ upToMinor: 10_000, rateBasisPoints: 1_000 }, { upToMinor: 10_000, rateBasisPoints: 2_000 }])).toBeNull();
  });
});
