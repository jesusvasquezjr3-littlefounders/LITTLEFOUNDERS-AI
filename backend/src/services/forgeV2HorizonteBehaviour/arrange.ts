import { bounded, unique, type HzSpace, type Json } from './shared.js';

export type Slots = Record<string, string[]>;
export interface Frame { pieces: string[]; slots: string[]; capacity: (slot: string) => number; repeatable?: boolean }

export const nextOf = (seed: number) => {
  let state = seed >>> 0;
  return (bound: number): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) % bound; };
};
export type Next = ReturnType<typeof nextOf>;

export const shuffle = <T,>(list: readonly T[], next: Next): T[] => {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) { const other = next(index + 1); [out[index], out[other]] = [out[other]!, out[index]!]; }
  return out;
};
export const someOf = <T,>(list: readonly T[], next: Next): T[] => shuffle(list, next).slice(0, next(list.length) + 1);

export const place = (slots: Slots): Json => ({ slots: Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0)) });

export function refused(frame: Frame, key: Slots, more: unknown[]): unknown[] {
  const slot = frame.slots[0]!;
  const piece = frame.pieces[0]!;
  const crowded = frame.repeatable ? Array.from({ length: frame.capacity(slot) + 1 }, () => piece) : [piece, piece];
  return [
    { slots: { [slot]: [] } }, { slots: { 'no-such-slot': [piece] } }, { slots: { [slot]: ['no-such-piece'] } }, { slots: { [slot]: crowded } },
    { slots: [piece] }, { slots: 'x' }, { slots: { [slot]: piece } }, { slots: { [slot]: [7] } }, { slots: key, extra: 1 }, {}, { slots: null },
    ...more,
  ];
}

/** The states a learner reaches on a slot board: the placements given, those that fit the frame, refusals, the start and the rule's own verdict. */
export function arrangement(frame: Frame, key: Slots, states: Slots[], met: (slots: Slots) => boolean, more: unknown[] = [], initial: Json = { slots: {} }): HzSpace {
  const known = new Set(frame.pieces);
  const fits = (slots: Slots): boolean => {
    const placed = Object.values(slots).flat();
    return placed.length > 0 && (frame.repeatable === true || new Set(placed).size === placed.length) && placed.every((piece) => known.has(piece))
      && Object.entries(slots).every(([slot, pieces]) => frame.slots.includes(slot) && pieces.length <= frame.capacity(slot));
  };
  const pool = unique(states.filter(fits).map(place)).filter((state) => JSON.stringify(state) !== JSON.stringify(initial));
  const keep = pool.filter((state) => met(state.slots as Slots)).slice(0, 80);
  return {
    inRange: bounded(pool, 2_400, keep),
    invalid: refused(frame, key, more),
    initial,
    expectMet: (response) => met(response.slots as Slots),
  };
}

export const fromKey = (r: Json): Slots[] => (Array.isArray(r.solutions) ? (r.solutions as Slots[]) : []);
export const onlyIn = (slots: Slots, slot: string): string[] | null => (Object.keys(slots).every((key) => key === slot) ? slots[slot] ?? [] : null);
export const sameItems = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && new Set(a).size === a.length && b.every((id) => a.includes(id));
