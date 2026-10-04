import { boundsOf, distinct, isLattice, isLatticeList, pointKey, type Lattice } from './geometry.js';

export const TESSELLATION_MAX_COORDINATE = 11;
export const TESSELLATION_MIN_TILE = 2;
export const TESSELLATION_MAX_TILE = 6;
export const TESSELLATION_MAX_COPIES = 24;
const SOLVER_BUDGET = 60_000;

/**
 * How a copy is made from the tile before it is slid to its anchor: as it is (`slide`), turned half a turn (`turn`) or
 * flipped over left to right (`flip`, a mirror image). A neighbouring copy across an edge is the tile paired with it by
 * translation, half-turn or glide reflection, the three pairings an Escher-style tiling is built from.
 */
export const TILE_MOTIONS = ['slide', 'turn', 'flip'] as const;
export type TileMotion = (typeof TILE_MOTIONS)[number];

/**
 * A floor of square cells to cover and a tile made of cells, both named by their lower-left corner. A copy is the tile made
 * by one of the offered motions and then slid so the lower-left corner of its bounding box sits on the anchor. `moves` lists the
 * motions on offer (always `slide` first); without it the tile is only slid, never turned or flipped.
 */
export interface TessellationPayload { floor: Lattice[]; tile: Lattice[]; moves?: TileMotion[] }
/** One placed copy: the motion applied to the tile and the corner it is slid to. */
export interface TileCopy { anchor: Lattice; motion: TileMotion }
/** The private key: how many copies an exact cover takes. */
export interface TessellationRubric { copies: number }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
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

/** The offered motions are `slide` first and then one or both of the others, each once, in the order of TILE_MOTIONS. */
export function isMotionList(value: unknown): value is TileMotion[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > TILE_MOTIONS.length) return false;
  const order = value.map((motion) => TILE_MOTIONS.indexOf(motion));
  return order[0] === 0 && order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1]!));
}

export function isTessellationPayload(value: unknown): value is TessellationPayload {
  if (!isRecord(value) || !hasKeys(value, ['floor', 'tile'], ['moves'])) return false;
  const { floor, tile } = value;
  if (Object.hasOwn(value, 'moves') && !isMotionList(value.moves)) return false;
  if (!isLatticeList(tile, TESSELLATION_MIN_TILE, TESSELLATION_MAX_TILE) || !distinct(tile) || !connected(tile)) return false;
  const origin = boundsOf(tile);
  if (origin.minX !== 0 || origin.minY !== 0) return false;
  if (!isLatticeList(floor, tile.length, tile.length * TESSELLATION_MAX_COPIES) || !distinct(floor)) return false;
  if (floor.length % tile.length !== 0) return false;
  const span = boundsOf(floor);
  return span.minX >= 0 && span.minY >= 0 && span.maxX <= TESSELLATION_MAX_COORDINATE && span.maxY <= TESSELLATION_MAX_COORDINATE;
}

export const copiesNeeded = (payload: TessellationPayload): number => payload.floor.length / payload.tile.length;

/** The motions a learner may use on this floor: only `slide` unless the payload lists more. */
export const offeredMotions = (payload: TessellationPayload): readonly TileMotion[] => payload.moves ?? ['slide'];

export function isTessellationRubric(value: unknown, payload: TessellationPayload): value is TessellationRubric {
  return isRecord(value) && hasKeys(value, ['copies']) && value.copies === copiesNeeded(payload);
}

/** The tile as the motion makes it, sorted, with its lower-left bounding corner still where the tile's was. */
export function orientTile(tile: readonly Lattice[], motion: TileMotion): Lattice[] {
  const span = boundsOf(tile);
  const cells = tile.map((cell): Lattice => {
    if (motion === 'turn') return { x: span.minX + span.maxX - cell.x, y: span.minY + span.maxY - cell.y };
    if (motion === 'flip') return { x: span.minX + span.maxX - cell.x, y: cell.y };
    return { x: cell.x, y: cell.y };
  });
  return cells.sort(byCorner);
}

/** The cells one copy covers on the floor: the tile made by the motion, slid to the anchor. */
export const copyCells = (tile: readonly Lattice[], copy: TileCopy): Lattice[] =>
  orientTile(tile, copy.motion).map((cell) => ({ x: cell.x + copy.anchor.x, y: cell.y + copy.anchor.y }));

/**
 * What a response says about the copies: `points` are the anchors and, only when the floor offers more than a slide, `motions`
 * says how each one is made (missing means every copy is slid). Null when the response is not exactly that.
 */
export function readCopies(payload: TessellationPayload, response: unknown): TileCopy[] | null {
  const offered = offeredMotions(payload);
  if (!isRecord(response) || !hasKeys(response, ['points'], offered.length > 1 ? ['motions'] : [])) return null;
  const { points, motions } = response;
  if (!Array.isArray(points) || points.length > copiesNeeded(payload) || !points.every(isLattice)) return null;
  if (motions !== undefined && (!Array.isArray(motions) || motions.length !== points.length)) return null;
  const copies: TileCopy[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const motion: unknown = motions === undefined ? 'slide' : (motions as unknown[])[index];
    if (typeof motion !== 'string' || !offered.includes(motion as TileMotion)) return null;
    const anchor = points[index] as Lattice;
    copies.push({ anchor: { x: anchor.x, y: anchor.y }, motion: motion as TileMotion });
  }
  return copies;
}

export type Placement = { kind: 'broken' } | { kind: 'placed'; covered: number };

/** Places each copy: broken when one leaves the floor, lands on another or uses a motion not on offer; otherwise how many cells are covered. */
export function placeCopies(payload: TessellationPayload, copies: readonly TileCopy[]): Placement {
  const floor = new Set(payload.floor.map(pointKey));
  const offered = offeredMotions(payload);
  const used = new Set<string>();
  for (const copy of copies) {
    if (!offered.includes(copy.motion)) return { kind: 'broken' };
    for (const cell of copyCells(payload.tile, copy)) {
      const key = pointKey(cell);
      if (!floor.has(key) || used.has(key)) return { kind: 'broken' };
      used.add(key);
    }
  }
  return { kind: 'placed', covered: used.size };
}

/** The slide-only form of placeCopies: every copy is the tile as it is, slid to its anchor. */
export const placeTiles = (payload: TessellationPayload, anchors: readonly Lattice[]): Placement =>
  placeCopies({ floor: payload.floor, tile: payload.tile }, anchors.map((anchor): TileCopy => ({ anchor, motion: 'slide' })));

/**
 * An exact cover of the floor by copies made with the offered motions, found by filling the first open cell each time;
 * null when none exists (or the search budget runs out). The same floor and motions always give the same cover.
 */
export function solveCover(payload: TessellationPayload): TileCopy[] | null {
  const cells = [...payload.floor].sort(byCorner);
  const signatures = new Set<string>();
  const shapes: Array<{ motion: TileMotion; cells: Lattice[] }> = [];
  for (const motion of offeredMotions(payload)) {
    const oriented = orientTile(payload.tile, motion);
    const signature = oriented.map(pointKey).join(';');
    if (!signatures.has(signature)) { signatures.add(signature); shapes.push({ motion, cells: oriented }); }
  }
  const open = new Set(cells.map(pointKey));
  const copies: TileCopy[] = [];
  let budget = SOLVER_BUDGET;
  const search = (from: number): boolean => {
    let index = from;
    while (index < cells.length && !open.has(pointKey(cells[index]!))) index += 1;
    if (index === cells.length) return true;
    for (const shape of shapes) {
      if (budget <= 0) return false;
      budget -= 1;
      const first = shape.cells[0]!;
      const anchor = { x: cells[index]!.x - first.x, y: cells[index]!.y - first.y };
      const keys = shape.cells.map((cell) => pointKey({ x: cell.x + anchor.x, y: cell.y + anchor.y }));
      if (!keys.every((key) => open.has(key))) continue;
      for (const key of keys) open.delete(key);
      copies.push({ anchor, motion: shape.motion });
      if (search(index + 1)) return true;
      copies.pop();
      for (const key of keys) open.add(key);
    }
    return false;
  };
  return search(0) ? copies : null;
}

/** The anchors of a slide-only cover (the tile never turned or flipped), or null; the form the first tessellations used. */
export function solveTiling(payload: TessellationPayload): Lattice[] | null {
  const cover = solveCover({ floor: payload.floor, tile: payload.tile });
  return cover ? cover.map((copy) => copy.anchor) : null;
}

/** The floor made by placing copies of the tile; the way an author builds a floor that is known to be solvable. */
export const floorFromCopies = (tile: readonly Lattice[], copies: readonly TileCopy[]): Lattice[] =>
  copies.flatMap((copy) => copyCells(tile, copy)).sort(byCorner);

/** The floor made by sliding the tile to each anchor. */
export const floorFrom = (tile: readonly Lattice[], anchors: readonly Lattice[]): Lattice[] =>
  floorFromCopies(tile, anchors.map((anchor): TileCopy => ({ anchor, motion: 'slide' })));
