import { describe, expect, it } from 'vitest';
import { STAGE_BEARING } from './shots';
import {
  MAX_SOCIAL_TURN,
  offViewer,
  shortestArc,
  solveFacings,
  type FacingSpot,
} from './facing';

/*
 * The one property this module exists for: NOBODY HAS THEIR BACK TO THE
 * LEARNER. Everything else here is a guard on the gesture that used to be
 * allowed to break it.
 */

const deg = (radians: number) => (radians * 180) / Math.PI;

/** The audition's own placement on `diorama-a`, from `npm run verify:placement`. */
const AUDITION: readonly FacingSpot[] = [
  { x: 0.38, z: 1.51 }, // dina
  { x: 1.74, z: -1.0 }, // liruf
  { x: -1.54, z: 0.26 }, // rho
  { x: -1.05, z: -1.15 }, // zara
];

/** The old rule, kept here so the regression it caused stays legible. */
function radiallyOutward(spots: readonly FacingSpot[]): number[] {
  return spots.map((spot, index) => {
    const outward = Math.atan2(spot.x, spot.z);
    let nearest: FacingSpot | null = null;
    let best = Infinity;
    for (let other = 0; other < spots.length; other += 1) {
      if (other === index) continue;
      const candidate = spots[other]!;
      const distance = Math.hypot(candidate.x - spot.x, candidate.z - spot.z);
      if (distance < best) {
        best = distance;
        nearest = candidate;
      }
    }
    const toward = nearest ? Math.atan2(nearest.x - spot.x, nearest.z - spot.z) : outward;
    return outward + shortestArc(outward, toward) * 0.25;
  });
}

describe('who the cast is looking at', () => {
  it('turns every candidate in an audition toward the learner', () => {
    const facings = solveFacings(AUDITION, STAGE_BEARING);
    for (const facing of facings) {
      expect(deg(offViewer(facing, STAGE_BEARING))).toBeLessThanOrEqual(deg(MAX_SOCIAL_TURN) + 1e-6);
    }
  });

  it('is a real change: the rule it replaced put three of these four backs to the learner', () => {
    const before = radiallyOutward(AUDITION).map((f) => deg(offViewer(f, STAGE_BEARING)));
    // Three of the four beyond 90 degrees — a back, not a profile.
    expect(before.filter((angle) => angle > 90)).toHaveLength(3);
    const after = solveFacings(AUDITION, STAGE_BEARING).map((f) => deg(offViewer(f, STAGE_BEARING)));
    expect(after.filter((angle) => angle > 90)).toHaveLength(0);
  });

  it('still turns each character toward whoever is nearest, and not toward anyone else', () => {
    // Two people, side by side across the bearing: each should lean toward the
    // other, so their yaws differ and the signs are opposite.
    const pair: FacingSpot[] = [
      { x: -1, z: 0 },
      { x: 1, z: 0 },
    ];
    const [left, right] = solveFacings(pair, 0);
    expect(left).toBeGreaterThan(0); // leans right, toward the other
    expect(right).toBeLessThan(0); // leans left, toward the other
    expect(Math.abs(left!)).toBeCloseTo(Math.abs(right!), 6);
  });

  it('caps the lean, so a neighbour standing behind you is a glance and not a turn', () => {
    // A bearing of 0 looks along +z, so the second of these stands directly
    // BEHIND the first. A quarter of that arc is 45 degrees — the exact size of
    // turn that used to put a shoulder to the learner.
    const behind: FacingSpot[] = [
      { x: 0, z: 0 },
      { x: 0, z: -4 },
    ];
    const [front, back] = solveFacings(behind, 0);
    expect(Math.abs(front!)).toBeCloseTo(MAX_SOCIAL_TURN, 6);
    // The one at the back is already looking the other one's way, so there is
    // nothing to lean: the gesture is free exactly when it costs nothing.
    expect(back).toBeCloseTo(0, 6);
  });

  it('faces a lone character straight at the learner', () => {
    expect(solveFacings([{ x: 2, z: -3 }], STAGE_BEARING)).toEqual([STAGE_BEARING]);
  });

  it('does not aim north when two spots coincide', () => {
    // A placement bug elsewhere must not become a facing bug here: `atan2(0, 0)`
    // is 0, which would turn somebody to a yaw that has nothing to do with the
    // stage.
    const stacked: FacingSpot[] = [
      { x: 1, z: 1 },
      { x: 1, z: 1 },
    ];
    for (const facing of solveFacings(stacked, STAGE_BEARING)) {
      expect(facing).toBe(STAGE_BEARING);
    }
  });

  it('is independent of the island, because it is a property of the stage', () => {
    // The same two people, moved bodily to the far side: the old rule flipped
    // them by 180 degrees, this one does not move them at all.
    const near: FacingSpot[] = [
      { x: 0, z: 2 },
      { x: 1, z: 2 },
    ];
    const far: FacingSpot[] = [
      { x: 0, z: -2 },
      { x: 1, z: -2 },
    ];
    expect(solveFacings(near, STAGE_BEARING)).toEqual(solveFacings(far, STAGE_BEARING));
  });
});
