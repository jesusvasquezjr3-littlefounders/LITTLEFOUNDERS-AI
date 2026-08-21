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

  it('returns nothing for an empty object rather than guessing an origin', () => {
    expect(findStandingSpots(new Mesh(), { count: 2 })).toEqual([]);
  });
});
