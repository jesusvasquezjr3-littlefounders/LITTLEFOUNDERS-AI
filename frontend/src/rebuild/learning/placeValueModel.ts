export interface PlaceValueState { tens: number; ones: number; total: number; canTrade: boolean; canUndo: boolean }

/** Keeps the concrete blocks and written digits derived from one integer state. */
export function placeValueState(total: number, trades: number): PlaceValueState | null {
  if (!Number.isSafeInteger(total) || total < 10 || total > 29 || !Number.isSafeInteger(trades)
    || trades < 0 || trades > Math.floor(total / 10)) return null;
  const ones = total - trades * 10;
  return { tens: trades, ones, total, canTrade: ones >= 10, canUndo: trades > 0 };
}
