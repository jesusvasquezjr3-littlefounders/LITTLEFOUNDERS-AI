import type { PlaceValuePayload } from './v2SegmentFamilies.generated';

/** One trade on the base-ten board (M5): regroup up, or borrow down for a subtraction. */
export type PlaceTrade = 'ten' | 'hundred' | 'borrow-ten' | 'borrow-hundred';
export interface PlaceColumns { hundreds: number; tens: number; ones: number }
export interface PlaceValueBoardState extends PlaceColumns {
  mode: 'compose' | 'subtract';
  /** What a subtraction takes away, column by column (all zero when composing). */
  take: PlaceColumns;
  /** Which trades are physically possible next (the board never hints which one is needed). */
  can: Record<PlaceTrade, boolean>;
  /** Composing: every column is under ten. Subtracting: every column can give what is taken. */
  ready: boolean;
  /** The written result once ready: the regrouped digits, or the difference. */
  result: PlaceColumns | null;
}

/** The start columns of a payload (Core's placeValueScorerPayload, re-derived here for the board). */
export function placeValueStart(payload: PlaceValuePayload): { mode: 'compose' | 'subtract'; start: PlaceColumns; take: PlaceColumns } {
  const split = (value: number): PlaceColumns => ({ hundreds: Math.floor(value / 100), tens: Math.floor(value / 10) % 10, ones: value % 10 });
  if (!('mode' in payload)) return { mode: 'compose', start: { hundreds: 0, tens: 0, ones: payload.total }, take: split(0) };
  if (payload.mode === 'compose') return { mode: 'compose', start: { ...payload.start }, take: split(0) };
  return { mode: 'subtract', start: split(payload.minuend), take: split(payload.subtrahend) };
}

/** Replays a trade sequence from the start; null when any trade is impossible (conservation holds at every step). */
export function placeValueReplay(payload: PlaceValuePayload, trades: readonly PlaceTrade[]): PlaceValueBoardState | null {
  const { mode, start, take } = placeValueStart(payload);
  let { hundreds, tens, ones } = start;
  for (const trade of trades) {
    if (mode === 'compose' && (trade === 'borrow-ten' || trade === 'borrow-hundred')) return null;
    if (mode === 'subtract' && (trade === 'ten' || trade === 'hundred')) return null;
    if (trade === 'ten') { if (ones < 10) return null; ones -= 10; tens += 1; }
    else if (trade === 'hundred') { if (tens < 10 || hundreds >= 9) return null; tens -= 10; hundreds += 1; }
    else if (trade === 'borrow-ten') { if (tens < 1 || ones > 9) return null; tens -= 1; ones += 10; }
    else { if (hundreds < 1 || tens > 9) return null; hundreds -= 1; tens += 10; }
  }
  const can: Record<PlaceTrade, boolean> = mode === 'compose'
    ? { ten: ones >= 10, hundred: tens >= 10 && hundreds < 9, 'borrow-ten': false, 'borrow-hundred': false }
    : { ten: false, hundred: false, 'borrow-ten': tens >= 1 && ones <= 9, 'borrow-hundred': hundreds >= 1 && tens <= 9 };
  const ready = mode === 'compose' ? ones < 10 && tens < 10 : ones >= take.ones && tens >= take.tens && hundreds >= take.hundreds;
  const result = !ready ? null : mode === 'compose' ? { hundreds, tens, ones }
    : { hundreds: hundreds - take.hundreds, tens: tens - take.tens, ones: ones - take.ones };
  return { mode, hundreds, tens, ones, take, can, ready, result };
}

/** Legacy two-place view used by the pilot tests: `trades` ten-for-one trades from `total` loose ones. */
export function placeValueState(total: number, trades: number): { tens: number; ones: number; total: number; canTrade: boolean; canUndo: boolean } | null {
  if (!Number.isSafeInteger(total) || total < 10 || total > 29 || !Number.isSafeInteger(trades)
    || trades < 0 || trades > Math.floor(total / 10)) return null;
  const ones = total - trades * 10;
  return { tens: trades, ones, total, canTrade: ones >= 10, canUndo: trades > 0 };
}
