import { describe, expect, it } from 'vitest';
import { isCellWalkable, maskFor, walkabilityFor, type WalkMask } from './walkability';

/*
 * The shipped masks are asserted, not just the bit arithmetic.
 *
 * A unit test over a synthetic grid would have passed on the day the whole cast
 * was standing in a pond, because nothing was wrong with the arithmetic — there
 * was no mask at all. So the coordinates below are real: (1.06, 1.04) is the
 * measured centroid of diorama-b's pond in the island's placed frame.
 */

/** Little helper mirroring the generator's bit layout. */
function synthetic(resolution: number, walkable: (gx: number, gz: number) => boolean): WalkMask {
  const cells = new Uint8Array(Math.ceil((resolution * resolution) / 8));
  for (let gz = 0; gz < resolution; gz += 1) {
    for (let gx = 0; gx < resolution; gx += 1) {
      if (!walkable(gx, gz)) continue;
      const bit = gz * resolution + gx;
      cells[bit >> 3]! |= 1 << (bit & 7);
    }
  }
  return { resolution, minX: -1, maxX: 1, minZ: -1, maxZ: 1, cells };
}

describe('isCellWalkable', () => {
  it('reads the bit for the cell containing the point', () => {
    // Left half walkable, right half not.
    const mask = synthetic(8, (gx) => gx < 4);
    expect(isCellWalkable(mask, -0.9, 0)).toBe(true);
    expect(isCellWalkable(mask, -0.1, 0)).toBe(true);
    expect(isCellWalkable(mask, 0.1, 0)).toBe(false);
    expect(isCellWalkable(mask, 0.9, 0)).toBe(false);
  });

  it('distinguishes rows from columns', () => {
    const mask = synthetic(8, (gx, gz) => gx === 1 && gz === 6);
    // Cell (1, 6) spans x in [-0.75,-0.5) and z in [0.5,0.75).
    expect(isCellWalkable(mask, -0.6, 0.6)).toBe(true);
    // Transposed: if rows and columns were swapped this would also be true.
    expect(isCellWalkable(mask, 0.6, -0.6)).toBe(false);
  });

  it('treats anything outside the grid as NOT walkable', () => {
    const mask = synthetic(8, () => true);
    expect(isCellWalkable(mask, 0, 0)).toBe(true);
    expect(isCellWalkable(mask, 2, 0)).toBe(false);
    expect(isCellWalkable(mask, 0, -50)).toBe(false);
    // Exactly on the far edge is off the grid, not the last cell.
    expect(isCellWalkable(mask, 1, 0)).toBe(false);
  });
});

describe('the shipped masks', () => {
  it('blocks the pond on diorama-b', () => {
    const mask = maskFor('diorama-b');
    expect(mask).not.toBeNull();
    // Measured centroid of the water, in the frame Diorama.tsx places the
    // island in. This is the exact ground the entire cast used to stand on.
    expect(isCellWalkable(mask!, 1.06, 1.04)).toBe(false);
  });

  it('leaves the walkable ground of diorama-b alone', () => {
    const mask = maskFor('diorama-b')!;
    // Where the solver now puts the cast: grass, well clear of the water.
    expect(isCellWalkable(mask, 0, -2.9)).toBe(true);
    expect(isCellWalkable(mask, -2.5, 0)).toBe(true);
  });

  it('blocks nothing inside diorama-a, which has no water', () => {
    const mask = maskFor('diorama-a')!;
    let blocked = 0;
    for (let x = -2.4; x <= 2.4; x += 0.2) {
      for (let z = -2.4; z <= 2.4; z += 0.2) {
        if (Math.hypot(x, z) > 2.4) continue;
        if (!isCellWalkable(mask, x, z)) blocked += 1;
      }
    }
    expect(blocked).toBe(0);
  });

  it('marks the void beyond the rim unwalkable, so clearance comes for free', () => {
    const mask = maskFor('diorama-b')!;
    expect(isCellWalkable(mask, 4.9, 4.9)).toBe(false);
  });
});

describe('walkabilityFor', () => {
  it('returns a predicate for a masked island', () => {
    const predicate = walkabilityFor('diorama-b');
    expect(predicate).toBeTypeOf('function');
    expect(predicate!(1.06, 1.04)).toBe(false);
  });

  it('returns null for an unknown island rather than a permissive default', () => {
    // The distinction is the point: "nobody checked" must not arrive at the
    // solver disguised as "everything is fine" (/AGENTS.md §1.14).
    expect(walkabilityFor('diorama-does-not-exist')).toBeNull();
  });
});
