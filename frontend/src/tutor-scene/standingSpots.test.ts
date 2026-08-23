import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { findStandingSpots } from './standingSpots';

/*
 * A flat 10 x 10 slab standing in for an island: featureless on purpose, so
 * every difference in the results comes from the option under test and not
 * from scenery.
 */
function slab(): Mesh {
  const mesh = new Mesh(new BoxGeometry(10, 0.4, 10), new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('findStandingSpots', () => {
  it('finds spots on open ground', () => {
    const spots = findStandingSpots(slab(), { count: 2, minSeparation: 1 });
    expect(spots).toHaveLength(2);
    for (const spot of spots) expect(spot.y).toBeCloseTo(0.2, 5);
  });

  it('respects the separation constraint', () => {
    const spots = findStandingSpots(slab(), { count: 2, minSeparation: 3 });
    expect(spots).toHaveLength(2);
    expect(Math.hypot(spots[0]!.x - spots[1]!.x, spots[0]!.z - spots[1]!.z)).toBeGreaterThanOrEqual(3);
  });

  it('never returns a spot the walkability predicate rejects', () => {
    /*
     * THE REGRESSION. Water is the flattest, most open surface a diorama has,
     * so shape alone ranked diorama-b's pond above every patch of grass and the
     * whole cast stood in it. Nothing here is unflat — the predicate is the only
     * thing that can keep a character out.
     */
    const spots = findStandingSpots(slab(), {
      count: 4,
      minSeparation: 0.5,
      isWalkable: (x) => x < 0,
    });
    expect(spots.length).toBeGreaterThan(0);
    for (const spot of spots) expect(spot.x).toBeLessThan(0);
  });

  it('keeps a character off the shoreline, not merely out of the water', () => {
    // Feet, not centres: a spot whose own cell is dry but whose probes are wet
    // puts the character standing in the shallows.
    const probe = 0.35;
    const spots = findStandingSpots(slab(), {
      count: 6,
      minSeparation: 0.4,
      probe,
      isWalkable: (x) => x < 0,
    });
    for (const spot of spots) expect(spot.x + probe).toBeLessThan(0);
  });

  it('prefers spots with room around them but still returns one when there is none', () => {
    /*
     * Clearance must never be a hard filter. Dina covers 2.83 m of a 6.5 m
     * island, so a requirement she cannot meet would return no spot at all —
     * and `Cast` renders nothing without a spot, which is a scene with nobody
     * in it. A cramped character beats an empty island.
     */
    const spots = findStandingSpots(slab(), {
      count: 1,
      minSeparation: 1,
      // Nothing anywhere satisfies the clearance probes.
      isWalkable: (x, z) => Math.hypot(x, z) < 0.001,
      clearance: 4,
    });
    // The hard gate still applies, so an impossible predicate yields nothing…
    expect(spots).toHaveLength(0);

    // …but a satisfiable surface with no ROOM still yields a spot.
    const cramped = findStandingSpots(slab(), {
      count: 1,
      minSeparation: 1,
      isWalkable: () => true,
      clearance: 50,
    });
    expect(cramped).toHaveLength(1);
  });

  it('scores a roomy spot above a cramped one', () => {
    const roomy = findStandingSpots(slab(), { count: 1, minSeparation: 1, clearance: 0.5 });
    const cramped = findStandingSpots(slab(), {
      count: 1,
      minSeparation: 1,
      clearance: 0.5,
      // Everything beyond a narrow band is off-limits, so no candidate has room.
      isWalkable: (x, z) => Math.abs(z) < 0.4 || Math.hypot(x, z) < 3.5,
    });
    expect(roomy[0]!.score).toBeGreaterThan(cramped[0]!.score);
  });

  it('honours the preferred direction', () => {
    const spots = findStandingSpots(slab(), {
      count: 1,
      minSeparation: 1,
      preferDirection: new Vector3(0, 0, 1),
    });
    expect(spots[0]!.z).toBeGreaterThan(0);
  });

  /*
   * THE PER-PAIR FLOOR, and why one number was not enough.
   *
   * Dina covers 2.83 m and Liruf 1.70 m, so those two genuinely need 2.61 m
   * between them. Applying that same figure to Rho and Zara, who cover 0.82 m
   * each, reserves three times the ground they occupy — and on the 6.5 m island
   * that left two of the four personalization candidates with NO SPOT FOUND
   * (`npm run verify:placement`), whose name plates were then culled and who
   * could not be chosen by looking at them at all.
   */
  it('applies a floor per PAIR, so a small character is not charged a big one’s rent', () => {
    // Member 0 is huge and needs 4 m from anyone; members 1 and 2 are small and
    // need 1 m from each other. One global 4 m floor cannot seat all three on a
    // 10 m slab; a per-pair floor can.
    const spots = findStandingSpots(slab(), {
      count: 3,
      minSeparation: 4,
      separationFor: (index, other) => (index === 0 || other === 0 ? 4 : 1),
    });

    expect(spots).toHaveLength(3);
    const apart = (a: number, b: number) =>
      Math.hypot(spots[a]!.x - spots[b]!.x, spots[a]!.z - spots[b]!.z);
    expect(apart(0, 1)).toBeGreaterThanOrEqual(4);
    expect(apart(0, 2)).toBeGreaterThanOrEqual(4);
    expect(apart(1, 2)).toBeGreaterThanOrEqual(1);
  });

  it('samples finely enough to seat a large cast when asked to', () => {
    /*
     * Density is the other half of the same failure. The default ring is what
     * two characters need and no more: measured on `diorama-a`, the surviving
     * samples sit 40 degrees apart while the gap left for the fourth candidate
     * is 27 degrees wide. The spot exists; nothing was ever sampled in it.
     */
    const coarse = findStandingSpots(slab(), { count: 6, minSeparation: 3.2 });
    const fine = findStandingSpots(slab(), { count: 6, minSeparation: 3.2, samplesPerMetre: 12 });
    expect(fine.length).toBeGreaterThanOrEqual(coarse.length);
  });

  it('can be asked to spread a cast rather than gather it', () => {
    // A pair reads as two figures sharing a place; four candidates on an
    // audition ring read as a huddle, and the huddle is what leaves the last
    // one with nowhere to stand.
    const spread = (grouping: number) => {
      const spots = findStandingSpots(slab(), { count: 3, minSeparation: 1, grouping, samplesPerMetre: 12 });
      let total = 0;
      let pairs = 0;
      for (let a = 0; a < spots.length; a += 1) {
        for (let b = a + 1; b < spots.length; b += 1) {
          total += Math.hypot(spots[a]!.x - spots[b]!.x, spots[a]!.z - spots[b]!.z);
          pairs += 1;
        }
      }
      return pairs > 0 ? total / pairs : 0;
    };
    expect(spread(-0.25)).toBeGreaterThan(spread(0.25));
  });

  it('separates a cast in DEPTH rather than across the frame when given a narrow axis', () => {
    /*
     * WHY THE PHONE WAS EMPTY, as arithmetic on a featureless slab.
     *
     * `approach` has to keep every candidate inside a horizontal field of view
     * that is 17 degrees at 375x812, so the frame's world WIDTH is set by
     * whichever of them sits furthest across it — and the island's share of the
     * screen follows from that one number. A metre spent sideways is a metre
     * the camera stands back; the same metre spent in DEPTH satisfies the same
     * separation rule and costs the framing nothing.
     *
     * The separations themselves must survive: the point is to trade one axis
     * for the other, never to let anybody stand inside anybody else.
     */
    const measure = (narrowWeight: number) => {
      const across = new Vector3(1, 0, 0);
      const spots = findStandingSpots(slab(), {
        count: 4,
        minSeparation: 1.4,
        grouping: -0.25,
        samplesPerMetre: 12,
        narrowAxis: across,
        narrowWeight,
      });
      expect(spots).toHaveLength(4);
      let widest = 0;
      let closest = Infinity;
      for (let a = 0; a < spots.length; a += 1) {
        widest = Math.max(widest, Math.abs(spots[a]!.x));
        for (let b = a + 1; b < spots.length; b += 1) {
          closest = Math.min(closest, Math.hypot(spots[a]!.x - spots[b]!.x, spots[a]!.z - spots[b]!.z));
        }
      }
      return { widest, closest };
    };

    const loose = measure(0);
    const gathered = measure(0.8);
    expect(gathered.widest).toBeLessThan(loose.widest);
    expect(gathered.closest).toBeGreaterThanOrEqual(1.4);
  });

  it('returns nothing for an empty object rather than guessing an origin', () => {
    expect(findStandingSpots(new Mesh(), { count: 2 })).toEqual([]);
  });
});
