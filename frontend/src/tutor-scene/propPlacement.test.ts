import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import {
  CRATE_CLEARANCE_M,
  excludingProp,
  excludingProps,
  findPropSpot,
  findPropSpots,
  PROP_CLEARANCE_M,
  STALL_CLEARANCE_M,
} from './propPlacement';

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

describe('PROP_CLEARANCE_M', () => {
  it('gives the crate a smaller clearance than the stall — the actual point of a per-kind lookup', () => {
    expect(CRATE_CLEARANCE_M).toBeLessThan(STALL_CLEARANCE_M);
    expect(PROP_CLEARANCE_M.stall).toBe(STALL_CLEARANCE_M);
    expect(PROP_CLEARANCE_M.crate).toBe(CRATE_CLEARANCE_M);
  });
});

/*
 * Class III / S18 amendment `props` generality (2026-09-04): a lone prop
 * only ever had to answer to the island — these are the tests for what
 * changes once more than one is requested at once.
 */
describe('findPropSpots', () => {
  it('solves every kind requested, each a real, distinct spot', () => {
    const solved = findPropSpots(slab(), undefined, ['stall', 'crate']);
    expect(solved.map(([kind]) => kind)).toEqual(['stall', 'crate']);
    const [, stallSpot] = solved[0]!;
    const [, crateSpot] = solved[1]!;
    expect(Math.hypot(stallSpot.x - crateSpot.x, stallSpot.z - crateSpot.z)).toBeGreaterThan(0);
  });

  it('never lets the second prop land inside the first one just-solved footprint', () => {
    // A featureless slab gives the solver no flatness signal to separate on —
    // if the second solve did not exclude the first prop's own disc, nothing
    // else here would stop them landing on the identical spot.
    const solved = findPropSpots(slab(), undefined, ['stall', 'crate']);
    const stallSpot = solved[0]![1];
    const crateSpot = solved[1]![1];
    const clear = Math.hypot(stallSpot.x - crateSpot.x, stallSpot.z - crateSpot.z);
    expect(clear).toBeGreaterThanOrEqual(STALL_CLEARANCE_M - 1e-6);
  });

  it('skips every kind rather than throwing when nothing on the island qualifies', () => {
    // The same already-proven "always false = never a spot" shape
    // `findPropSpot`'s own test above uses — here for a whole requested
    // list, proving the loop completes to an empty result rather than
    // throwing on the first kind's `null`.
    expect(findPropSpots(slab(), () => false, ['stall', 'crate'])).toEqual([]);
  });

  it('a later kind still gets attempted after an earlier one is excluded down to nothing', () => {
    // Built from a REAL solved position rather than an assumed one: find
    // where the stall alone would land, then make only a stall-clearance
    // disc around that exact point walkable. The stall still solves inside
    // its own disc; once `findPropSpots` excludes that same disc before
    // trying the crate, nothing remains at all. Proves the loop does not
    // stop just because a LATER kind comes back null — it already returned
    // the stall from before that happened.
    const freeSpot = findPropSpot(slab(), undefined, STALL_CLEARANCE_M);
    expect(freeSpot).not.toBeNull();
    const onlyNearStall = (x: number, z: number) =>
      Math.hypot(x - freeSpot!.x, z - freeSpot!.z) < STALL_CLEARANCE_M;
    const solved = findPropSpots(slab(), onlyNearStall, ['stall', 'crate']);
    expect(solved.map(([kind]) => kind)).toEqual(['stall']);
  });

  it('returns an empty list for an empty request, the byte-identical no-op every pre-generalization caller relies on', () => {
    expect(findPropSpots(slab(), undefined, [])).toEqual([]);
  });
});

describe('excludingProps', () => {
  it('excludes every solved prop at once, not only the last one composed', () => {
    const solved = findPropSpots(slab(), undefined, ['stall', 'crate']);
    const composed = excludingProps(undefined, solved);
    for (const [kind, spot] of solved) {
      expect(composed(spot.x, spot.z), `${kind} centre`).toBe(false);
    }
  });

  it('is a no-op returning the base predicate unchanged when nothing was solved', () => {
    const composed = excludingProps(() => true, []);
    expect(composed(0, 0)).toBe(true);
    expect(composed(-50, 50)).toBe(true);
  });

  it('still refuses a point the BASE predicate already refused, props or no props', () => {
    const solved = findPropSpots(slab(), undefined, ['crate']);
    const composed = excludingProps((x) => x < 0, solved);
    expect(composed(5, 5)).toBe(false);
  });
});
