import type { ArrangementContext, SlotMap } from '../../v2AnswerShapes.js';

export type { SlotMap };

export const COM_ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;

export interface Frame { pieceIds: string[]; slotIds: string[]; capacities: Record<string, number> }

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isId = (value: unknown): value is string => typeof value === 'string' && COM_ID.test(value);
export const isWhole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

export const toContext = (frame: Frame): ArrangementContext => ({ pieceIds: frame.pieceIds, slotIds: frame.slotIds, capacities: frame.capacities });

/** Nothing placed yet: the board's start state, never a score. */
export function isUntouched(response: unknown, frame: Frame): boolean {
  if (!isRecord(response) || Object.keys(response).join() !== 'slots' || !isRecord(response.slots)) return false;
  return Object.entries(response.slots).every(([slot, pieces]) => frame.slotIds.includes(slot) && Array.isArray(pieces) && pieces.length === 0);
}

export function sameKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const have = Object.keys(value);
  return have.length === keys.length && keys.every((key) => have.includes(key));
}

/** The two lists hold the same ids, in any order, each once. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && b.every((id) => a.includes(id));
}

export const TRAY = 'tray';

export type Accepts = (piece: string, slot: string) => boolean;

export function locate(slots: SlotMap, piece: string): string | null {
  for (const [slot, pieces] of Object.entries(slots)) if (pieces.includes(piece)) return slot;
  return null;
}

/**
 * The placement after moving `piece` to `target` (a slot, or the tray to take it back). The same `slots` object comes back
 * when the move is not allowed: unknown piece or target, a full slot, or a slot that does not accept the piece.
 * A full one-piece slot swaps with its occupant instead of refusing.
 */
export function placePiece(frame: Frame, slots: SlotMap, piece: string, target: string, accepts: Accepts = () => true): SlotMap {
  const from = locate(slots, piece);
  if (!frame.pieceIds.includes(piece) || (from ?? TRAY) === target) return slots;
  if (target !== TRAY && (!frame.slotIds.includes(target) || !accepts(piece, target))) return slots;
  const next: Record<string, string[]> = Object.fromEntries(Object.entries(slots).map(([slot, pieces]) => [slot, [...pieces]]));
  if (from !== null) next[from] = next[from]!.filter((id) => id !== piece);
  if (target !== TRAY) {
    const there = next[target] ?? [];
    const capacity = frame.capacities[target] ?? 0;
    if (there.length < capacity) next[target] = [...there, piece];
    else if (capacity === 1 && there.length === 1) {
      const other = there[0]!;
      if (from !== null && !accepts(other, from)) return slots;
      next[target] = [piece];
      if (from !== null) next[from] = [...next[from]!, other];
    } else return slots;
  }
  return Object.fromEntries(Object.entries(next).filter(([, pieces]) => pieces.length > 0));
}

export const canPlace = (frame: Frame, slots: SlotMap, piece: string, target: string, accepts?: Accepts): boolean => placePiece(frame, slots, piece, target, accepts) !== slots;

export const unplaced = (frame: Frame, slots: SlotMap): string[] => frame.pieceIds.filter((id) => locate(slots, id) === null);

/** Compares the pieces of each slot as sets; use the lists themselves when the order is the answer. */
export const sameSlots = (a: SlotMap, b: SlotMap): boolean => {
  const key = (slots: SlotMap) => JSON.stringify(Object.entries(slots).filter(([, pieces]) => pieces.length > 0).map(([slot, pieces]) => [slot, [...pieces].sort()]).sort());
  return key(a) === key(b);
};

/** The response of a placement: the non-empty slots, as the arrangement shape reads them. */
export const answerOf = (slots: SlotMap): { slots: SlotMap } => ({ slots: Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0)) });
