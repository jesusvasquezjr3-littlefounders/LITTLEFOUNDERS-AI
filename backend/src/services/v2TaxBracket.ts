export type TaxBracket = { upToMinor: number | null; rateBasisPoints: number };
export type TaxBracketSlice = {
  lowerMinor: number;
  upperMinor: number | null;
  taxableMinor: number;
  taxMinor: number;
  rateBasisPoints: number;
};
export type TaxBracketResult = {
  incomeMinor: number;
  slices: TaxBracketSlice[];
  totalTaxMinor: number;
  takeHomeMinor: number;
  marginalRateBasisPoints: number;
  averageRateBasisPoints: number;
};

/**
 * Canonical minor-unit tax-bracket model for M20. Each bracket tax is rounded
 * independently to the nearest minor unit, matching how progressive brackets
 * are displayed and avoiding a browser-only aggregate rounding rule.
 */
export function taxBracketModel(incomeMinor: number, brackets: readonly TaxBracket[]): TaxBracketResult | null {
  if (!Number.isSafeInteger(incomeMinor) || incomeMinor < 0 || !brackets.length) return null;
  let lower = 0;
  let openEnded = false;
  const slices: TaxBracketSlice[] = [];
  for (const [index, bracket] of brackets.entries()) {
    if (openEnded || !Number.isSafeInteger(bracket.rateBasisPoints) || bracket.rateBasisPoints < 0 || bracket.rateBasisPoints > 10_000) return null;
    if (bracket.upToMinor !== null && (!Number.isSafeInteger(bracket.upToMinor) || bracket.upToMinor <= lower)) return null;
    if (bracket.upToMinor === null && index !== brackets.length - 1) return null;
    const upper = bracket.upToMinor;
    const taxableMinor = Math.max(0, Math.min(incomeMinor, upper ?? incomeMinor) - lower);
    const taxMinor = Math.round(taxableMinor * bracket.rateBasisPoints / 10_000);
    slices.push({ lowerMinor: lower, upperMinor: upper, taxableMinor, taxMinor, rateBasisPoints: bracket.rateBasisPoints });
    if (upper === null) openEnded = true;
    else lower = upper;
  }
  const totalTaxMinor = slices.reduce((total, slice) => total + slice.taxMinor, 0);
  const active = [...slices].reverse().find((slice) => slice.taxableMinor > 0);
  return {
    incomeMinor, slices, totalTaxMinor, takeHomeMinor: incomeMinor - totalTaxMinor,
    marginalRateBasisPoints: active?.rateBasisPoints ?? 0,
    averageRateBasisPoints: incomeMinor === 0 ? 0 : Math.round(totalTaxMinor * 10_000 / incomeMinor),
  };
}
