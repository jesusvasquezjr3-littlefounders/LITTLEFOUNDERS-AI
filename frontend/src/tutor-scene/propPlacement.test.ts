import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { excludingProp, findPropSpot, STALL_CLEARANCE_M } from './propPlacement';

/** Same synthetic ground `standingSpots.test.ts` uses — featureless on purpose. */
function slab(): Mesh {
  const mesh = new Mesh(new BoxGeometry(10, 0.4, 10), new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('findPropSpot', () => {
  it('finds a spot on open ground', () => {
    const spot = findPropSpot(slab(), undefined, 1);
    expect(spot).not.toBeNull();
    expect(spot!.y).toBeCloseTo(0.2, 5);
  });

  it('never returns a spot the walkability predicate rejects — the same hard gate a character gets', () => {
    const spot = findPropSpot(slab(), (x) => x < 0, 1, new Vector3(1, 0, 0));
    expect(spot).not.toBeNull();
    expect(spot!.x).toBeLessThan(0);
  });

  it('returns null rather than a bad spot when nothing on the island qualifies', () => {
    const spot = findPropSpot(slab(), () => false, 1);
    expect(spot).toBeNull();
  });

  it('treats a missing mask as permissive, the same convention findStandingSpots itself uses', () => {
    // `undefined` — no island has been checked — must not behave as "nowhere is walkable."
    const spot = findPropSpot(slab(), undefined, 1);
    expect(spot).not.toBeNull();
  });
});

describe('excludingProp', () => {
  const alwaysWalkable = () => true;

  it('returns the base predicate unchanged when there is no prop to avoid', () => {
    const composed = excludingProp(alwaysWalkable, null, STALL_CLEARANCE_M);
    expect(composed(0, 0)).toBe(true);
    expect(composed(100, 100)).toBe(true);
  });

  it('excludes every point strictly inside the clearance disc around the prop', () => {
    const composed = excludingProp(alwaysWalkable, { x: 5, z: 5 }, 1);
    expect(composed(5, 5)).toBe(false);
    expect(composed(5.5, 5)).toBe(false);
    expect(composed(5, 5.9)).toBe(false);
  });

  it('allows a point exactly on or outside the clearance boundary', () => {
    const composed = excludingProp(alwaysWalkable, { x: 0, z: 0 }, 2);
    // Exactly on the boundary: allowed, not rejected — a strict "<" gate,
    // never "<=", so a character solved AT the floor is not itself excluded.
    expect(composed(2, 0)).toBe(true);
    expect(composed(0, 2.001)).toBe(true);
  });

  it('still refuses a point the BASE predicate already refused, prop or no prop', () => {
    const composed = excludingProp((x) => x < 0, { x: -10, z: -10 }, 1);
    // Well clear of the prop's own disc, but on the wrong side of the base gate.
    expect(composed(5, 5)).toBe(false);
  });

  it('treats a missing base predicate as permissive outside the excluded disc', () => {
    const composed = excludingProp(undefined, { x: 0, z: 0 }, 1);
    expect(composed(0, 0)).toBe(false);
    expect(composed(5, 5)).toBe(true);
  });

  it('composes with a real findStandingSpots solve — no character lands inside the disc', () => {
    // A regression guard for the exact defect this sprint found live: without
    // this composition, nothing stops a solved character spot from landing on
    // top of a prop that was solved independently of the cast.
    const prop = findPropSpot(slab(), undefined, 1, new Vector3(-1, 0, 0));
    expect(prop).not.toBeNull();

    const composed = excludingProp(undefined, prop, STALL_CLEARANCE_M);
    // A direct probe at the prop's own centre must be excluded...
    expect(composed(prop!.x, prop!.z)).toBe(false);
    // ...and a point one clearance-radius away in an arbitrary direction must not be.
    expect(composed(prop!.x + STALL_CLEARANCE_M + 0.5, prop!.z)).toBe(true);
  });
});
