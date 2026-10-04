import { isRecord, exactKeys, oneOf, sameMultiset, type ArrangePiece, type ClassState, type Solution } from './arrange.js';

/**
 * F2.2: an equation made of cards, `x + 3 = 7`. A card is the unknown, minus the unknown, a positive or a negative
 * number. Only additive moves exist: a supply card goes onto both sides at once, and a card meets its opposite on one
 * side and both leave. The goal is the unknown alone on one side, every other card reduced.
 */
export const CARD_SLOTS = ['left', 'right', 'bin', 'tray'] as const;
export const CARD_COMPARE = ['left', 'right'] as const;
export const DISGUISES = ['picture', 'mixed', 'notation'] as const;
export type Disguise = (typeof DISGUISES)[number];
export const CARD_MAX_NUMBER = 9;
export const CARD_MAX_SIDE = 4;
export const CARD_MAX_SUPPLY = 6;
export const UNKNOWN = 'unk';
export const UNKNOWN_NEGATIVE = 'unk-neg';

export interface CardsPayload { disguise: Disguise; left: string[]; right: string[]; supply: string[] }
export interface Linear { unknown: number; constant: number }

const NUMBER_FACE = /^(pos|neg)-([1-9])$/;

export function faceValue(face: unknown): Linear | null {
  if (face === UNKNOWN) return { unknown: 1, constant: 0 };
  if (face === UNKNOWN_NEGATIVE) return { unknown: -1, constant: 0 };
  const match = typeof face === 'string' ? NUMBER_FACE.exec(face) : null;
  return match ? { unknown: 0, constant: (match[1] === 'pos' ? 1 : -1) * Number(match[2]) } : null;
}

export const oppositeFace = (face: string): string => face === UNKNOWN ? UNKNOWN_NEGATIVE : face === UNKNOWN_NEGATIVE ? UNKNOWN : face.startsWith('pos-') ? `neg-${face.slice(4)}` : `pos-${face.slice(4)}`;
export const isUnknownFace = (face: string): boolean => face === UNKNOWN || face === UNKNOWN_NEGATIVE;

export function sumFaces(faces: readonly string[]): Linear {
  return faces.reduce<Linear>((sum, face) => {
    const value = faceValue(face) ?? { unknown: 0, constant: 0 };
    return { unknown: sum.unknown + value.unknown, constant: sum.constant + value.constant };
  }, { unknown: 0, constant: 0 });
}

const sameLinear = (a: Linear, b: Linear): boolean => a.unknown === b.unknown && a.constant === b.constant;
const difference = (left: readonly string[], right: readonly string[]): Linear => {
  const a = sumFaces(left); const b = sumFaces(right);
  return { unknown: a.unknown - b.unknown, constant: a.constant - b.constant };
};

function readFaces(value: unknown, minimum: number, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
  return value.every((face) => faceValue(face) !== null) ? [...value] as string[] : null;
}

/** The public cards, or null: a disguise, one to four cards a side, up to six supply cards, and at least one way to isolate the unknown. */
export function readCards(value: unknown): CardsPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['disguise', 'left', 'right', 'supply']) || !oneOf(DISGUISES, value.disguise)) return null;
  const left = readFaces(value.left, 1, CARD_MAX_SIDE); const right = readFaces(value.right, 1, CARD_MAX_SIDE); const supply = readFaces(value.supply, 0, CARD_MAX_SUPPLY);
  if (!left || !right || !supply) return null;
  const payload: CardsPayload = { disguise: value.disguise, left, right, supply };
  const solutions = isolations(payload);
  return solutions.length >= 1 && solutions.length <= 8 && !solutions.some((solution) => sameState(solution, startState(payload))) ? payload : null;
}

export function cardPieces(payload: CardsPayload): ArrangePiece[] {
  return [
    ...payload.left.map((cls, index) => ({ id: `left-${index + 1}`, cls, home: 'left' })),
    ...payload.right.map((cls, index) => ({ id: `right-${index + 1}`, cls, home: 'right' })),
    ...payload.supply.flatMap((cls, index) => [{ id: `supply-${index + 1}-a`, cls, home: 'tray' }, { id: `supply-${index + 1}-b`, cls, home: 'tray' }]),
  ];
}

const startState = (payload: CardsPayload): Solution => ({ left: [...payload.left].sort(), right: [...payload.right].sort() });
const sameState = (a: Solution, b: Solution): boolean => sameMultiset(a.left ?? [], b.left ?? []) && sameMultiset(a.right ?? [], b.right ?? []);

/** Opposite cards on one side cancel; what is left, sorted. */
export function reduceFaces(faces: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const face of faces) counts.set(face, (counts.get(face) ?? 0) + 1);
  const surplus: string[] = [];
  for (const [face, count] of counts) for (let index = count - (counts.get(oppositeFace(face)) ?? 0); index > 0; index -= 1) surplus.push(face);
  return surplus.sort();
}

/** The reachable fully reduced states with the unknown alone on one side, one per distinct outcome, from the public cards. */
export function isolations(payload: CardsPayload): Solution[] {
  const found = new Map<string, Solution>();
  for (let mask = 0; mask < 1 << payload.supply.length; mask += 1) {
    const used = payload.supply.filter((_, index) => (mask >> index) & 1);
    const left = reduceFaces([...payload.left, ...used]); const right = reduceFaces([...payload.right, ...used]);
    const alone = (side: string[]): boolean => side.length === 1 && side[0] === UNKNOWN;
    if (alone(left) === alone(right)) continue;
    const other = alone(left) ? right : left;
    if (other.length === 0 || other.some(isUnknownFace)) continue;
    found.set(`${left.join(',')}|${right.join(',')}`, { left, right });
  }
  return [...found.values()].sort((a, b) => `${a.left}|${a.right}`.localeCompare(`${b.left}|${b.right}`));
}

/** Whether a placement keeps the equation true and the bin cancelled: the only states the board can reach. */
export function cardsConsistent(state: ClassState, payload: CardsPayload): boolean {
  const start = difference(payload.left, payload.right);
  return sameLinear(difference(state.left ?? [], state.right ?? []), start) && sameLinear(sumFaces(state.bin ?? []), { unknown: 0, constant: 0 });
}

/** Whether a rubric solution is one this payload reaches. */
export function cardSolutionFits(solution: ClassState, payload: CardsPayload): boolean {
  if (Object.keys(solution).some((slot) => !oneOf(CARD_COMPARE, slot))) return false;
  return isolations(payload).some((reachable) => sameState(reachable, solution as Solution));
}

export const faceTex = (face: string): string => {
  const value = faceValue(face)!;
  return value.unknown !== 0 ? (value.unknown > 0 ? '+x' : '-x') : `${value.constant > 0 ? '+' : '-'}${Math.abs(value.constant)}`;
};
const sideTex = (faces: readonly string[]): string => {
  const text = faces.map(faceTex).join('');
  return text.startsWith('+') ? text.slice(1) : text;
};
export const equationTex = (payload: CardsPayload): string => `${sideTex(payload.left)}=${sideTex(payload.right)}`;

