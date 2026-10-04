import { bounded, type HzSpace, type Json } from './shared.js';

export type Slots = Record<string, string[]>;

/** A slot board: the pieces, the slots, how many pieces a slot holds, and the arrangements the key names. */
export interface Board { pieces: string[]; slots: string[]; capacity: (slot: string) => number; keys: Slots[] }

export const tidy = (slots: Slots): Slots => Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0));
const canonical = (slots: Slots): string => JSON.stringify(Object.entries(tidy(slots)).map(([slot, pieces]) => [slot, [...pieces].sort()]).sort());
export const sameArrangement = (a: Slots, b: Slots): boolean => canonical(a) === canonical(b);
export const placedCount = (slots: Slots): number => Object.values(slots).reduce((sum, pieces) => sum + pieces.length, 0);

const fits = (board: Board, slots: Slots): boolean => board.slots.every((slot) => (slots[slot]?.length ?? 0) <= board.capacity(slot));
const copy = (slots: Slots): Slots => Object.fromEntries(Object.entries(slots).map(([slot, pieces]) => [slot, [...pieces]]));
const where = (slots: Slots, piece: string): string | null => Object.keys(slots).find((slot) => slots[slot]!.includes(piece)) ?? null;

/** The arrangements one step from the given ones: a piece removed, moved to another slot or placed, and two pieces swapped. */
export function neighbours(board: Board, from: Slots[], limit = 40_000): Slots[] {
  const seen = new Map<string, Slots>();
  const add = (slots: Slots) => {
    const next = tidy(slots);
    if (placedCount(next) === 0 || !fits(board, next)) return;
    const key = canonical(next);
    if (!seen.has(key)) seen.set(key, next);
  };
  for (const start of from) {
    add(start);
    for (const piece of board.pieces) {
      const here = where(start, piece);
      if (here !== null) { const removed = copy(start); removed[here] = removed[here]!.filter((id) => id !== piece); add(removed); }
      for (const slot of board.slots) {
        if (slot === here) continue;
        const moved = copy(start);
        if (here !== null) moved[here] = moved[here]!.filter((id) => id !== piece);
        moved[slot] = [...(moved[slot] ?? []), piece];
        add(moved);
      }
    }
    for (const a of board.pieces) for (const b of board.pieces) {
      const first = where(start, a); const second = where(start, b);
      if (a >= b || first === null || second === null || first === second) continue;
      const swapped = copy(start);
      swapped[first] = swapped[first]!.map((id) => (id === a ? b : id));
      swapped[second] = swapped[second]!.map((id) => (id === b ? a : id));
      add(swapped);
    }
    if (seen.size > limit) break;
  }
  return [...seen.values()];
}

/** Responses the board must refuse: malformed, off the board, a piece twice, a slot over its capacity, and nothing placed. */
export function malformed(board: Board): unknown[] {
  const [firstSlot, secondSlot] = board.slots as [string, string];
  const piece = board.pieces[0]!;
  const crowded = board.slots.find((slot) => board.pieces.length > board.capacity(slot));
  const key = tidy(board.keys[0]!);
  return [
    { slots: {} }, { slots: { [firstSlot]: [] } }, { slots: { 'no-such-slot': [piece] } }, { slots: { [firstSlot]: ['no-such-piece'] } },
    { slots: { [firstSlot]: [piece], [secondSlot]: [piece] } }, { slots: [piece] }, { slots: 'x' }, { slots: { [firstSlot]: piece } }, { slots: { [firstSlot]: [7] } },
    { slots: key, extra: 1 }, {}, { slots: null },
    ...(crowded ? [{ slots: { [crowded]: board.pieces.slice(0, board.capacity(crowded) + 1) } }] : []),
  ];
}

export interface BoardOptions {
  met: (slots: Slots) => boolean;
  initial?: Slots;
  extra?: Slots[];
  limit?: number;
}

/** A behaviour space for a slot board: the key's neighbourhood (plus any rule-met arrangements), refusals and the start. */
export function boardSpace(board: Board, options: BoardOptions): HzSpace {
  const direct = [...board.keys, ...(options.extra ?? [])].map(tidy).filter((slots) => placedCount(slots) > 0);
  const around = neighbours(board, direct.slice(0, 8));
  const seen = new Set(around.map(canonical));
  const merged = [...around, ...direct.filter((slots) => !seen.has(canonical(slots)))];
  const states = bounded(merged.map((slots) => ({ slots })), options.limit ?? 2_400, direct.slice(0, 80).map((slots) => ({ slots })));
  return {
    inRange: states,
    invalid: malformed(board),
    ...(options.initial ? { initial: { slots: options.initial } } : {}),
    expectMet: (response: Json) => options.met(response.slots as Slots),
  };
}
