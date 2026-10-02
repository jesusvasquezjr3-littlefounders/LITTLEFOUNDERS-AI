import { isRecord, isWholeIn, exactKeys, sameMultiset, type ArrangePiece, type ClassState, type Solution } from './arrange.js';

/** F2.1: x squared, x and 1 tiles, positive and negative. A zero pair is one positive and one negative tile of the same kind. */
export const TILE_KINDS = ['sq', 'bar', 'unit'] as const;
export type TileKind = (typeof TILE_KINDS)[number];
export const TILE_CLASSES = ['sq-pos', 'sq-neg', 'bar-pos', 'bar-neg', 'unit-pos', 'unit-neg'] as const;
export type TileClass = (typeof TILE_CLASSES)[number];
export type TileCounts = Readonly<Record<TileClass, number>>;
export const TILE_SLOTS = ['mat', 'zero'] as const;
export const TILE_MAX_PER_CLASS = 12;
export const TILE_MAX_TOTAL = 24;

export const tileClass = (kind: TileKind, positive: boolean): TileClass => `${kind}-${positive ? 'pos' : 'neg'}`;
export const tileKind = (cls: string): TileKind => cls.slice(0, cls.indexOf('-')) as TileKind;
export const tileIsPositive = (cls: string): boolean => cls.endsWith('-pos');
export const oppositeTile = (cls: string): TileClass => tileClass(tileKind(cls), !tileIsPositive(cls));

export const tileTotal = (counts: TileCounts): number => TILE_CLASSES.reduce((sum, cls) => sum + counts[cls], 0);

/** The public tile counts, or null: exactly the six classes, whole numbers, 1 to 24 tiles, at least one zero pair to find. */
export function readTileCounts(value: unknown): TileCounts | null {
  if (!isRecord(value) || !exactKeys(value, TILE_CLASSES)) return null;
  if (!TILE_CLASSES.every((cls) => isWholeIn(value[cls], 0, TILE_MAX_PER_CLASS))) return null;
  const counts = value as unknown as TileCounts;
  return tileTotal(counts) <= TILE_MAX_TOTAL && zeroPairsIn(counts) > 0 ? counts : null;
}

export const zeroPairsIn = (counts: TileCounts): number => TILE_KINDS.reduce((sum, kind) => sum + Math.min(counts[tileClass(kind, true)], counts[tileClass(kind, false)]), 0);

export function tilePieces(counts: TileCounts): ArrangePiece[] {
  return TILE_CLASSES.flatMap((cls) => Array.from({ length: counts[cls] }, (_, index) => ({ id: `${cls}-${index + 1}`, cls, home: 'mat' })));
}

/** The zero set is a set of pairs: per kind, as many positive tiles as negative ones. */
export function zeroBalanced(zero: readonly string[]): boolean {
  return TILE_KINDS.every((kind) => zero.filter((cls) => cls === tileClass(kind, true)).length === zero.filter((cls) => cls === tileClass(kind, false)).length);
}

/** The state with every zero pair set aside: the one answer. */
export function reducedTiles(counts: TileCounts): Solution {
  const mat: string[] = []; const zero: string[] = [];
  for (const kind of TILE_KINDS) {
    const positive = counts[tileClass(kind, true)]; const negative = counts[tileClass(kind, false)];
    const pairs = Math.min(positive, negative);
    for (let index = 0; index < pairs; index += 1) zero.push(tileClass(kind, true), tileClass(kind, false));
    for (let index = pairs; index < positive; index += 1) mat.push(tileClass(kind, true));
    for (let index = pairs; index < negative; index += 1) mat.push(tileClass(kind, false));
  }
  return { mat: mat.sort(), zero: zero.sort() };
}

/** The key is the state with every zero pair set aside, and nothing else. */
export function tileSolutionFits(solution: ClassState, counts: TileCounts): boolean {
  const reduced = reducedTiles(counts);
  return TILE_SLOTS.every((slot) => sameMultiset(solution[slot] ?? [], reduced[slot] ?? [])) && Object.keys(solution).every((slot) => (TILE_SLOTS as readonly string[]).includes(slot));
}

export const tileTex = (counts: TileCounts): string => {
  const parts: string[] = [];
  for (const kind of TILE_KINDS) {
    const face = kind === 'sq' ? 'x^2' : kind === 'bar' ? 'x' : '1';
    for (const positive of [true, false]) {
      const count = counts[tileClass(kind, positive)];
      if (count === 0) continue;
      const magnitude = kind === 'unit' ? String(count) : count === 1 ? face : `${count}${face}`;
      parts.push(`${positive ? '+' : '-'}${magnitude}`);
    }
  }
  const text = parts.join('');
  return text.startsWith('+') ? text.slice(1) : text;
};
