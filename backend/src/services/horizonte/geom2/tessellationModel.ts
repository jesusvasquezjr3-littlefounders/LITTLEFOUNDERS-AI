import { boundsOf, distinct, isLatticeList, pointKey, type Lattice } from './geometry.js';

export const TESSELLATION_MAX_COORDINATE = 11;
export const TESSELLATION_MIN_TILE = 2;
export const TESSELLATION_MAX_TILE = 6;
export const TESSELLATION_MAX_COPIES = 24;
const SOLVER_BUDGET = 60_000;

/**
 * A floor of square cells to cover and a tile made of cells, both named by their lower-left corner. The tile is placed by
 * translation only (a copy is slid, never turned), so the answer is the set of anchors: the corner each copy is slid to.
 */
export interface TessellationPayload { floor: Lattice[]; tile: Lattice[] }
/** The private key: how many copies an exact cover takes. */
export interface TessellationRubric { copies: number }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, required: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => keys.includes(key));
};

const byCorner = (a: Lattice, b: Lattice): number => a.x - b.x || a.y - b.y;

function connected(cells: readonly Lattice[]): boolean {
  const keys = new Set(cells.map(pointKey));
  const seen = new Set<string>([pointKey(cells[0]!)]);
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const here = queue.pop()!;
    for (const next of [{ x: here.x + 1, y: here.y }, { x: here.x - 1, y: here.y }, { x: here.x, y: here.y + 1 }, { x: here.x, y: here.y - 1 }]) {
      const key = pointKey(next);
      if (keys.has(key) && !seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen.size === cells.length;
}

export function isTessellationPayload(value: unknown): value is TessellationPayload {
  if (!isRecord(value) || !hasKeys(value, ['floor', 'tile'])) return false;
  const { floor, tile } = value;
  if (!isLatticeList(tile, TESSELLATION_MIN_TILE, TESSELLATION_MAX_TILE) || !distinct(tile) || !connected(tile)) return false;
  const origin = boundsOf(tile);
  if (origin.minX !== 0 || origin.minY !== 0) return false;
  if (!isLatticeList(floor, tile.length, tile.length * TESSELLATION_MAX_COPIES) || !distinct(floor)) return false;
  if (floor.length % tile.length !== 0) return false;
  const span = boundsOf(floor);
  return span.minX >= 0 && span.minY >= 0 && span.maxX <= TESSELLATION_MAX_COORDINATE && span.maxY <= TESSELLATION_MAX_COORDINATE;
}

export const copiesNeeded = (payload: TessellationPayload): number => payload.floor.length / payload.tile.length;

export function isTessellationRubric(value: unknown, payload: TessellationPayload): value is TessellationRubric {
  return isRecord(value) && hasKeys(value, ['copies']) && value.copies === copiesNeeded(payload);
}

/** The frame the point-set grader reads the anchors in: every corner the floor spans, at most one anchor per copy. */
export function tessellationPointContext(payload: TessellationPayload) {
  const span = boundsOf(payload.floor);
  return { minimumX: 0, maximumX: Math.max(1, span.maxX), minimumY: 0, maximumY: Math.max(1, span.maxY), step: 1, maxPoints: Math.min(64, copiesNeeded(payload)) };
}

export type Placement = { kind: 'broken' } | { kind: 'placed'; covered: number };

/** Slides the tile to each anchor: broken when a copy leaves the floor or lands on another; otherwise how many cells are covered. */
export function placeTiles(payload: TessellationPayload, anchors: readonly Lattice[]): Placement {
  const floor = new Set(payload.floor.map(pointKey));
  const used = new Set<string>();
  for (const anchor of anchors) {
    for (const cell of payload.tile) {
      const key = pointKey({ x: cell.x + anchor.x, y: cell.y + anchor.y });
      if (!floor.has(key) || used.has(key)) return { kind: 'broken' };
      used.add(key);
    }
  }
  return { kind: 'placed', covered: used.size };
}

/** An exact cover of the floor by translated copies, found by filling the first open cell each time; null when none exists. */
export function solveTiling(payload: TessellationPayload): Lattice[] | null {
  const cells = [...payload.floor].sort(byCorner);
  const tile = [...payload.tile].sort(byCorner);
  const first = tile[0]!;
  const open = new Set(cells.map(pointKey));
  const anchors: Lattice[] = [];
  let budget = SOLVER_BUDGET;
  const search = (from: number): boolean => {
    let index = from;
    while (index < cells.length && !open.has(pointKey(cells[index]!))) index += 1;
    if (index === cells.length) return true;
    if (budget <= 0) return false;
    budget -= 1;
    const anchor = { x: cells[index]!.x - first.x, y: cells[index]!.y - first.y };
    const keys = tile.map((cell) => pointKey({ x: cell.x + anchor.x, y: cell.y + anchor.y }));
    if (!keys.every((key) => open.has(key))) return false;
    for (const key of keys) open.delete(key);
    anchors.push(anchor);
    if (search(index + 1)) return true;
    anchors.pop();
    for (const key of keys) open.add(key);
    return false;
  };
  return search(0) ? anchors : null;
}

/** The floor made by sliding the tile to each anchor; the way an author builds a floor that is known to be solvable. */
export const floorFrom = (tile: readonly Lattice[], anchors: readonly Lattice[]): Lattice[] =>
  anchors.flatMap((anchor) => tile.map((cell) => ({ x: cell.x + anchor.x, y: cell.y + anchor.y }))).sort(byCorner);
