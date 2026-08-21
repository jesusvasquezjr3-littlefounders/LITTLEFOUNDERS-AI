import masks from './walkMasks.generated.json';

/*
 * Which parts of an island a character may stand on.
 *
 * WHY THIS HAD TO EXIST. The placement solver scores a surface by how flat and
 * open it is, and a body of water is the flattest, most open surface on a
 * diorama — so on `diorama-b` it beat every patch of grass and the entire cast
 * stood in the pond. Every pairing, both characters, for as long as the island
 * had shipped. Geometry alone cannot see the difference: the island is ONE mesh
 * with ONE material, the water is not a separate node, the mesh is quantized so
 * the water is not even exactly planar, and there are no vertex colours. There
 * is no measurement of the shape that says "you would drown here".
 *
 * So the semantics come from the only place that has them — the island's own
 * base-colour texture — and they are resolved AT BUILD TIME, by
 * `scripts/generate-walkmask.ts`, into a grid that is committed and can be
 * looked at. That split is the point:
 *
 *   - a wrong classification shows up as a visibly wrong mask in the repo,
 *     not as a character standing in a lake in production;
 *   - the runtime cost is one array index, so this cannot regress the frame
 *     budget the whole quality system exists to protect;
 *   - the rule can be corrected, or a mask hand-edited, without shipping new
 *     placement code.
 *
 * The mask is stored in METRES in the island's own placed coordinate frame —
 * the same frame `Diorama.tsx` puts the island in — so it needs no knowledge of
 * where the scene sits. Changing an island's `targetWidthM` invalidates it;
 * regenerate with `npm run assets:walkmask`.
 */

export interface WalkMask {
  /** Cells per side. */
  resolution: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Row-major bitset, one bit per cell, 1 = walkable. */
  cells: Uint8Array;
}

interface StoredMask {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  walkable: string;
}

const RESOLUTION: number = masks.resolution;
const STORED = masks.islands as Readonly<Record<string, StoredMask>>;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const cache = new Map<string, WalkMask | null>();

/**
 * The mask for an island, or `null` when none was baked for it.
 *
 * `null` is NOT "everything is walkable" and callers must not treat it as such
 * — it means nobody has checked this island, which is exactly the state
 * diorama-b was in. `walkabilityFor` turns it into an explicit decision.
 */
export function maskFor(sceneId: string): WalkMask | null {
  const cached = cache.get(sceneId);
  if (cached !== undefined) return cached;

  const stored = STORED[sceneId];
  const mask: WalkMask | null = stored
    ? {
        resolution: RESOLUTION,
        minX: stored.minX,
        maxX: stored.maxX,
        minZ: stored.minZ,
        maxZ: stored.maxZ,
        cells: decode(stored.walkable),
      }
    : null;
  cache.set(sceneId, mask);
  return mask;
}

/** Whether a single cell is marked walkable. Out of range reads as NOT walkable. */
export function isCellWalkable(mask: WalkMask, x: number, z: number): boolean {
  const { resolution, minX, maxX, minZ, maxZ } = mask;
  const gx = Math.floor(((x - minX) / (maxX - minX)) * resolution);
  const gz = Math.floor(((z - minZ) / (maxZ - minZ)) * resolution);
  // Off the grid is off the island: refusing is the same answer the ground
  // sampler gives by returning null rather than 0 (/AGENTS.md §1.14).
  if (gx < 0 || gz < 0 || gx >= resolution || gz >= resolution) return false;
  const bit = gz * resolution + gx;
  return ((mask.cells[bit >> 3] ?? 0) >> (bit & 7)) % 2 === 1;
}

/**
 * A predicate for `findStandingSpots`, or `null` when this island has no mask.
 *
 * Returning `null` rather than an always-true predicate is deliberate: the
 * caller has to decide what an unmasked island means, and say so out loud,
 * instead of inheriting "anything goes" by accident.
 */
export function walkabilityFor(sceneId: string): ((x: number, z: number) => boolean) | null {
  const mask = maskFor(sceneId);
  if (!mask) return null;
  return (x, z) => isCellWalkable(mask, x, z);
}
