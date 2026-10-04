import { gradeArrangement } from '../../v2AnswerShapes.js';
import type { V2Grade } from '../../v2VisualScorer.js';

export const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
export const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };

const ARRANGE_ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;
export const SLOT_CAPACITY = 32;
export const MAX_SOLUTIONS = 8;

/** Slot name to the class ids of the pieces in it. Pieces of one class are interchangeable, so a class list is the whole state. */
export type ClassState = Readonly<Record<string, readonly string[]>>;
export type Solution = Record<string, string[]>;

export interface ArrangePiece { id: string; cls: string; home: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export const isWholeIn = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export const isArrangeId = (value: unknown): value is string => typeof value === 'string' && ARRANGE_ID.test(value);

export const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value);

export function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every((name) => Object.hasOwn(value, name)) && Object.keys(value).every((name) => required.includes(name) || optional.includes(name));
}

export const countOf = (list: readonly string[], cls: string): number => list.reduce((sum, item) => sum + (item === cls ? 1 : 0), 0);

export function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

export function sameState(a: ClassState, b: ClassState, slots: readonly string[]): boolean {
  return slots.every((slot) => sameMultiset(a[slot] ?? [], b[slot] ?? []));
}

/** The piece each id sits under, from `{slots: {slot: [pieceId]}}`; null unless every piece is placed exactly once in a known slot. */
export function readPlacement(response: unknown, pieces: readonly ArrangePiece[], slotIds: readonly string[]): Map<string, string> | null {
  if (!isRecord(response) || Object.keys(response).join() !== 'slots' || !isRecord(response.slots)) return null;
  const known = new Set(pieces.map((piece) => piece.id));
  const placement = new Map<string, string>();
  for (const slot of Object.keys(response.slots)) {
    const list = response.slots[slot];
    if (!slotIds.includes(slot) || !Array.isArray(list)) return null;
    for (const id of list) {
      if (typeof id !== 'string' || !known.has(id) || placement.has(id)) return null;
      placement.set(id, slot);
    }
  }
  return placement.size === pieces.length ? placement : null;
}

export function stateOf(placement: ReadonlyMap<string, string>, pieces: readonly ArrangePiece[], slotIds: readonly string[]): Solution {
  const state: Solution = Object.fromEntries(slotIds.map((slot) => [slot, [] as string[]]));
  for (const piece of pieces) state[placement.get(piece.id)!]!.push(piece.cls);
  for (const slot of slotIds) state[slot]!.sort();
  return state;
}

export const untouched = (placement: ReadonlyMap<string, string>, pieces: readonly ArrangePiece[]): boolean => pieces.every((piece) => placement.get(piece.id) === piece.home);

/** A rubric as the F0.3 arrangement shape holds it: one to eight solutions, each slot a list of class ids; null when malformed. */
export function readSolutions(rubric: unknown, slotIds: readonly string[]): Solution[] | null {
  if (!isRecord(rubric) || !exactKeys(rubric, ['solutions'], ['ordered']) || !Array.isArray(rubric.solutions) || (rubric.ordered !== undefined && rubric.ordered !== false)) return null;
  if (rubric.solutions.length < 1 || rubric.solutions.length > MAX_SOLUTIONS) return null;
  const solutions: Solution[] = [];
  for (const raw of rubric.solutions) {
    if (!isRecord(raw)) return null;
    const solution: Solution = Object.fromEntries(slotIds.map((slot) => [slot, [] as string[]]));
    for (const slot of Object.keys(raw)) {
      const list = raw[slot];
      if (!slotIds.includes(slot) || !Array.isArray(list) || list.length > SLOT_CAPACITY || !list.every(isArrangeId)) return null;
      solution[slot] = [...list] as string[];
    }
    solutions.push(solution);
  }
  return solutions;
}

/** The F0.3 arrangement grade of a class-level state against a rubric whose solutions name classes, not pieces. */
export function gradeClasses(state: ClassState, classIds: readonly string[], slotIds: readonly string[], rubric: unknown): V2Grade {
  const slots = Object.fromEntries(slotIds.filter((slot) => (state[slot] ?? []).length > 0).map((slot) => [slot, [...state[slot]!]]));
  return gradeArrangement({ slots }, rubric, {
    pieceIds: [...new Set(classIds)], slotIds: [...slotIds],
    capacities: Object.fromEntries(slotIds.map((slot) => [slot, SLOT_CAPACITY])), repeatable: true,
  });
}

/** Turns a class-level solution back into piece ids: a piece stays home when it can, and a piece the solution leaves out stays home. Null if impossible. */
export function expandSolution(pieces: readonly ArrangePiece[], solution: ClassState, slotIds: readonly string[]): { slots: Record<string, string[]> } | null {
  const free = [...pieces];
  const slots: Record<string, string[]> = {};
  const take = (slot: string, cls: string, wantHome: boolean): boolean => {
    const index = free.findIndex((piece) => piece.cls === cls && (!wantHome || piece.home === slot));
    if (index < 0) return false;
    (slots[slot] ??= []).push(free.splice(index, 1)[0]!.id);
    return true;
  };
  const pending: Array<[string, string]> = [];
  for (const slot of slotIds) for (const cls of solution[slot] ?? []) if (!take(slot, cls, true)) pending.push([slot, cls]);
  for (const [slot, cls] of pending) if (!take(slot, cls, false)) return null;
  for (const piece of free) (slots[piece.home] ??= []).push(piece.id);
  return { slots };
}

export interface PlacementFrame {
  pieces: readonly ArrangePiece[];
  slots: readonly string[];
  /** The slots the key speaks about; the rest (a tray, a bin) are working space. */
  compare: readonly string[];
  /** The structural rules of the board: a state that breaks one can never be reached from the UI. */
  consistent: (state: Solution) => boolean;
  /** Whether a key solution is one the public payload can reach. */
  fits: (solution: Solution) => boolean;
}

export const payloadOf = (segment: unknown): unknown => (isRecord(segment) ? segment.payload : undefined);

export const homeResponse = (pieces: readonly ArrangePiece[], slots: readonly string[]): { slots: Record<string, string[]> } => ({
  slots: Object.fromEntries(slots.map((slot) => [slot, pieces.filter((piece) => piece.home === slot).map((piece) => piece.id)] as const).filter(([, list]) => list.length > 0)),
});

/**
 * invalid: malformed, or a state the board rules out. valid: the untouched start (and every well-formed response without a key,
 * as in the browser). review: changed, not the key. met: a key solution.
 */
export function gradePlacement(frame: PlacementFrame, response: unknown, rubric: unknown): V2Grade {
  const placement = readPlacement(response, frame.pieces, frame.slots);
  if (!placement) return INVALID;
  const state = stateOf(placement, frame.pieces, frame.slots);
  if (!frame.consistent(state)) return INVALID;
  if (rubric === undefined) return VALID;
  const solutions = readSolutions(rubric, frame.compare);
  if (!solutions || !solutions.every(frame.fits)) return INVALID;
  if (untouched(placement, frame.pieces)) return VALID;
  return gradeClasses(state, frame.pieces.map((piece) => piece.cls), frame.compare, rubric);
}
