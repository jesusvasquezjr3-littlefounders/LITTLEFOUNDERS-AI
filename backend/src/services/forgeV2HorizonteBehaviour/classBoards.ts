import { bounded, isRecord, type HzSpace, type Json } from './shared.js';

export interface ClassPiece { id: string; cls: string; home: string }
export type ClassState = Record<string, string[]>;

/** A board where every piece is placed once and pieces of one class are interchangeable, so a state is a list of classes per slot. */
export interface ClassBoard {
  pieces: ClassPiece[];
  slots: string[];
  compare: string[];
  consistent: (state: ClassState) => boolean;
  keys: ClassState[];
}

const blank = (board: ClassBoard): ClassState => Object.fromEntries(board.slots.map((slot) => [slot, [] as string[]]));
const key = (board: ClassBoard, state: ClassState): string => board.slots.map((slot) => `${slot}=${[...(state[slot] ?? [])].sort().join(',')}`).join(';');
const clone = (board: ClassBoard, state: ClassState): ClassState => Object.fromEntries(board.slots.map((slot) => [slot, [...(state[slot] ?? [])]]));

export function homeState(board: ClassBoard): ClassState {
  const state = blank(board);
  for (const piece of board.pieces) state[piece.home]!.push(piece.cls);
  return state;
}

/** Piece ids for a class state: a piece stays home when it can. Null when the state needs more pieces of a class than exist. */
export function expand(board: ClassBoard, state: ClassState, fromEnd = false): { slots: Record<string, string[]> } | null {
  const free = [...board.pieces];
  const slots: Record<string, string[]> = {};
  const pending: Array<[string, string]> = [];
  const take = (slot: string, cls: string, homeOnly: boolean): boolean => {
    const matches = free.map((piece, index) => ({ piece, index })).filter(({ piece }) => piece.cls === cls && (!homeOnly || piece.home === slot));
    const pick = fromEnd ? matches[matches.length - 1] : matches[0];
    if (!pick) return false;
    free.splice(pick.index, 1);
    (slots[slot] ??= []).push(pick.piece.id);
    return true;
  };
  for (const slot of board.slots) for (const cls of state[slot] ?? []) if (!take(slot, cls, true)) pending.push([slot, cls]);
  for (const [slot, cls] of pending) if (!take(slot, cls, false)) return null;
  return free.length === 0 ? { slots } : null;
}

function classesOf(response: Json, board: ClassBoard): ClassState | null {
  if (!isRecord(response.slots)) return null;
  const byId = new Map(board.pieces.map((piece) => [piece.id, piece.cls]));
  const state = blank(board);
  for (const [slot, ids] of Object.entries(response.slots)) {
    if (!board.slots.includes(slot) || !Array.isArray(ids)) return null;
    for (const id of ids) { const cls = byId.get(id); if (cls === undefined) return null; state[slot]!.push(cls); }
  }
  return state;
}

const sameMultiset = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** The rubric's own verdict: the compared slots hold what some key solution holds. */
export const metBy = (board: ClassBoard, state: ClassState): boolean =>
  board.keys.some((solution) => board.compare.every((slot) => sameMultiset(state[slot] ?? [], solution[slot] ?? [])));

function compositions(total: number, parts: number): number[][] {
  if (parts === 1) return [[total]];
  const out: number[][] = [];
  for (let first = 0; first <= total; first += 1) for (const rest of compositions(total - first, parts - 1)) out.push([first, ...rest]);
  return out;
}

const countsByClass = (pieces: ClassPiece[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const piece of pieces) counts.set(piece.cls, (counts.get(piece.cls) ?? 0) + 1);
  return counts;
};

/** Every distribution of the classes over the slots, when there are few enough to list; null otherwise. */
function everyState(board: ClassBoard, limit: number): ClassState[] | null {
  const counts = [...countsByClass(board.pieces)];
  const per = counts.map(([, count]) => compositions(count, board.slots.length));
  if (per.reduce((total, list) => total * list.length, 1) > limit) return null;
  let out: ClassState[] = [blank(board)];
  counts.forEach(([cls], index) => {
    out = out.flatMap((state) => per[index]!.map((split) => {
      const next = clone(board, state);
      split.forEach((amount, slot) => { for (let n = 0; n < amount; n += 1) next[board.slots[slot]!]!.push(cls); });
      return next;
    }));
  });
  return out;
}

function stepsFrom(board: ClassBoard, state: ClassState): ClassState[] {
  const out: ClassState[] = [];
  for (const from of board.slots) for (const cls of new Set(state[from])) for (const to of board.slots) {
    if (to === from) continue;
    const next = clone(board, state);
    next[from]!.splice(next[from]!.indexOf(cls), 1);
    next[to]!.push(cls);
    out.push(next);
  }
  return out;
}

/** Full states a key solution reaches: the compared slots as the key says, the rest of the pieces in the other slots in every consistent way. */
function keyStates(board: ClassBoard): ClassState[] {
  const found: ClassState[] = [];
  const others = board.slots.filter((slot) => !board.compare.includes(slot));
  for (const solution of board.keys) {
    const left = countsByClass(board.pieces);
    let possible = true;
    const base = blank(board);
    for (const slot of board.compare) for (const cls of solution[slot] ?? []) {
      const count = left.get(cls) ?? 0;
      if (count < 1) possible = false; else left.set(cls, count - 1);
      base[slot]!.push(cls);
    }
    if (!possible) continue;
    const rest = [...left].filter(([, count]) => count > 0);
    if (rest.length > 0 && others.length === 0) continue;
    let partial: ClassState[] = [base];
    for (const [cls, count] of rest) {
      partial = partial.flatMap((state) => compositions(count, others.length).map((split) => {
        const next = clone(board, state);
        split.forEach((amount, index) => { for (let n = 0; n < amount; n += 1) next[others[index]!]!.push(cls); });
        return next;
      })).slice(0, 4_000);
    }
    for (const state of partial) if (board.consistent(state)) found.push(state);
  }
  return found.slice(0, 64);
}

/** Responses a placement board must refuse: malformed, a piece missing or twice, an unknown slot or piece. */
export function malformedPlacements(board: ClassBoard): unknown[] {
  const home = expand(board, homeState(board))!.slots;
  const first = board.pieces[0]!;
  const other = board.slots.find((slot) => slot !== first.home)!;
  const without = Object.fromEntries(Object.entries(home).map(([slot, ids]) => [slot, ids.filter((id) => id !== first.id)]));
  return [
    { slots: {} }, { slots: without }, { slots: { ...home, 'no-such-slot': [] } }, { slots: { ...home, [other]: [...(home[other] ?? []), 'no-such-piece'] } },
    { slots: { ...home, [other]: [...(home[other] ?? []), first.id] } }, { slots: { ...home, [first.home]: [...home[first.home]!, first.id] } },
    { slots: [first.id] }, { slots: 'x' }, { slots: null }, { slots: { ...home, [other]: 'x' } }, { slots: { ...home, [other]: [7] } }, { slots: home, extra: 1 }, {},
  ];
}

/** The behaviour space of a class board: every consistent arrangement near the key (all of them when few), plus the refusals and the start. */
export function classSpace(board: ClassBoard): HzSpace {
  const start = key(board, homeState(board));
  const keys = keyStates(board);
  const all = everyState(board, 40_000);
  const seen = new Map<string, ClassState>();
  const refused: ClassState[] = [];
  const add = (state: ClassState) => {
    const id = key(board, state);
    if (id === start || seen.has(id)) return;
    if (!board.consistent(state)) { if (refused.length < 60) refused.push(state); return; }
    if (board.compare.every((slot) => (state[slot] ?? []).length === 0)) return;
    seen.set(id, state);
  };
  if (all) {
    for (const state of all) add(state);
  } else {
    for (const seed of [homeState(board), ...keys.slice(0, 8)]) {
      let layer = [seed];
      for (let depth = 0; depth < 3; depth += 1) {
        const next: ClassState[] = [];
        const layerSeen = new Set<string>();
        for (const state of layer) for (const step of stepsFrom(board, state)) {
          const id = key(board, step);
          if (layerSeen.has(id)) continue;
          layerSeen.add(id);
          next.push(step);
          add(step);
        }
        layer = next.slice(0, 4_000);
      }
    }
  }
  for (const state of keys) add(state);
  const placed = (states: ClassState[], fromEnd: boolean) => states.map((state) => expand(board, state, fromEnd)).filter((response) => response !== null);
  return {
    inRange: bounded([...placed([...seen.values()], false), ...placed([...seen.values()].slice(0, 40), true)], 2_400, placed(keys, false)),
    invalid: [...malformedPlacements(board), ...placed(refused, false)],
    initial: expand(board, homeState(board))!,
    expectMet: (response) => { const state = classesOf(response, board); return state !== null && metBy(board, state); },
  };
}
