import type { Vec3 } from './model.generated';
import { NET_SQUARES, cellKey, foldNormals, type FaceName, type NetCell } from './net.generated';

export type FoldState = 'join' | 'overlap' | 'more' | 'ok';
export type FacePair = 'fb' | 'lr' | 'tb';

const NORMAL_FACES: Readonly<Record<string, FaceName>> = {
  '0,0,1': 'front', '0,0,-1': 'back', '1,0,0': 'right', '-1,0,0': 'left', '0,1,0': 'top', '0,-1,0': 'bottom',
};

/** Opposite faces share a pair: they are the squares that can never touch on a cube. */
export const PAIR_OF: Readonly<Record<FaceName, FacePair>> = { front: 'fb', back: 'fb', left: 'lr', right: 'lr', top: 'tb', bottom: 'tb' };

export const faceOfNormal = (normal: Vec3): FaceName | null => NORMAL_FACES[normal.map((part) => (part === 0 ? 0 : part)).join()] ?? null;

/** True when every square can be reached from the first one through shared edges. */
export function joined(cells: readonly NetCell[]): boolean {
  const first = cells[0];
  if (!first) return true;
  const known = new Set(cells.map(cellKey));
  const seen = new Set([cellKey(first)]);
  const queue: NetCell[] = [first];
  for (let head = 0; head < queue.length; head += 1) {
    const [col, row] = queue[head]!;
    for (const next of [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]] as const) {
      const key = cellKey(next);
      if (known.has(key) && !seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen.size === known.size;
}

export interface Fold {
  state: FoldState;
  /** The cube face each square lands on, in the order given; empty when the squares do not fold. */
  faces: ReadonlyArray<FaceName | null>;
}

/** What folding the squares so far does: apart, onto one another, still short of six, or a cube. */
export function foldOf(cells: readonly NetCell[], total: number = NET_SQUARES): Fold {
  if (cells.length === 0) return { state: 'more', faces: [] };
  if (!joined(cells)) return { state: 'join', faces: [] };
  const normals = foldNormals(cells);
  if (!normals) return { state: 'overlap', faces: [] };
  return { state: cells.length === total ? 'ok' : 'more', faces: normals.map(faceOfNormal) };
}
