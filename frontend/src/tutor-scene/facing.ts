/*
 * Which way everyone standing on the island is turned.
 *
 * WHAT THIS REPLACED, AND WHY IT IS ITS OWN MODULE NOW.
 *
 * The rule used to be four lines inside `TutorScene`, and it said: yaw =
 * `atan2(spot.x, spot.z)`, i.e. point each character radially OUTWARD from the
 * island's centre, "which is toward a camera orbiting outside it". The comment
 * is the bug. The camera does not orbit; it stands at ONE bearing
 * (`shots.ts` → `STAGE_BEARING`, derived from the placement solver's own
 * `preferDirection`), so radially outward aims at the viewer for exactly the
 * arc of the island nearest them and points everybody else into the sea.
 *
 * It is measurable, and it was measured with `npm run verify:placement` before
 * anything here was written. On `diorama-a`, with the whole cast standing for
 * the personalization audition, three of the four were turned more than
 * 125 degrees off the viewer:
 *
 *     dina    39.4 deg off       liruf  137.5 deg off   <- back to the learner
 *     rho    129.4 deg off       zara   127.1 deg off   <- back to the learner
 *
 * A child choosing a tutor was choosing between the backs of three heads, on
 * the one screen whose entire job is "pick by looking at them". It was not
 * confined to the audition either: on `diorama-b` an ordinary two-person
 * session put Dr. Rho 101.5 degrees off the viewer for the whole conversation.
 *
 * The audition is where it bites hardest because the audition deliberately
 * SPREADS the cast (`standingSpots.ts` → `AUDITION_GROUPING` is negative, so
 * four candidates are a ring you look along rather than a huddle). Spreading
 * them around the island is right; spreading their FACES around it is not.
 *
 * THE RULE NOW: everybody faces the way the stage opens — the same bearing the
 * camera stands on — and then turns a little toward whoever is nearest, so a
 * group reads as people sharing a place rather than as a row of mannequins
 * aimed at a lens. The social turn is CLAMPED, because a quarter of the arc to
 * a neighbour standing behind you is a 45-degree turn, and 45 degrees is the
 * difference between glancing at someone and presenting your shoulder to the
 * learner.
 *
 * PURE, AND FREE OF `three` AND OF REACT, for the same reason `shots.ts` is:
 * `scripts/verify-placement.ts` runs the real solver against the real islands
 * with no bundler and no GPU, and it now gates this too. A facing bug that only
 * a screenshot can find is a facing bug that ships.
 *
 * IT STILL DOES NOT READ THE CAMERA, and that constraint is unchanged and
 * load-bearing. `STAGE_BEARING` is a constant of the STAGE — the direction the
 * island is composed to be seen from — not a live camera pose. Feeding the
 * actual camera in would make the cast re-solve to face a camera that is itself
 * still moving, and the two would chase each other (`shots.ts` header).
 */

/** Somewhere a character is standing, in the XZ plane. Metres. */
export interface FacingSpot {
  x: number;
  z: number;
}

/**
 * How far a character turns from the stage bearing toward their nearest
 * neighbour, as a fraction of the arc between the two.
 *
 * Unchanged from the value that shipped; what changed is what it is a fraction
 * OF. It used to modify "radially outward" and now modifies "toward the
 * learner", so the same 0.25 that used to help a pair share a place no longer
 * decides whether either of them is visible at all.
 */
export const SOCIAL_TURN = 0.25;

/**
 * The most that turn may ever be, in radians.
 *
 * 20 degrees. A quarter of the arc to a neighbour is unbounded — two characters
 * on opposite sides of the island are pi radians apart, so the quarter is 45
 * degrees — and past about 25 the near eye starts to leave and the character
 * reads as looking away from the learner rather than as glancing at a friend.
 * Clamping the gesture keeps it a gesture.
 */
export const MAX_SOCIAL_TURN = (20 * Math.PI) / 180;

/**
 * How far off the viewer a character may be turned before it is a defect.
 *
 * The gate `scripts/verify-placement.ts` applies, and it is deliberately loose:
 * the social turn is capped at 20 degrees, so anything beyond 45 means the base
 * yaw itself is wrong rather than that a gesture went a little far. Every
 * placement the solver produces today lands inside 20.
 */
export const MAX_OFF_VIEWER = Math.PI / 4;

export interface FacingOptions {
  /** Fraction of the arc to the nearest neighbour. Defaults to `SOCIAL_TURN`. */
  socialTurn?: number;
  /** Hard cap on that turn, in radians. Defaults to `MAX_SOCIAL_TURN`. */
  maxTurn?: number;
}

/** The shortest signed arc from `from` to `to`, in (-pi, pi]. */
export function shortestArc(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * The yaw each spot's occupant should be turned to, in the same convention the
 * whole stage uses: a character at yaw `t` looks along `(sin t, cos t)`, so a
 * yaw equal to the stage bearing looks straight at the viewer.
 *
 * Returns one yaw per spot, in the order given.
 */
export function solveFacings(
  spots: readonly FacingSpot[],
  bearing: number,
  options: FacingOptions = {},
): number[] {
  const socialTurn = options.socialTurn ?? SOCIAL_TURN;
  const maxTurn = options.maxTurn ?? MAX_SOCIAL_TURN;

  return spots.map((spot, index) => {
    let nearest: FacingSpot | null = null;
    let best = Infinity;
    for (let other = 0; other < spots.length; other += 1) {
      if (other === index) continue;
      const candidate = spots[other]!;
      const distance = Math.hypot(candidate.x - spot.x, candidate.z - spot.z);
      // Two people standing in the same place is a placement bug, not a
      // direction: `atan2(0, 0)` is 0, which would silently aim somebody north.
      if (distance <= 1e-6) continue;
      if (distance < best) {
        best = distance;
        nearest = candidate;
      }
    }

    if (!nearest) return bearing;

    const toward = Math.atan2(nearest.x - spot.x, nearest.z - spot.z);
    const arc = shortestArc(bearing, toward) * socialTurn;
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, arc));
    return bearing + clamped;
  });
}

/** How far a yaw is turned away from the viewer, in radians, always positive. */
export function offViewer(facing: number, bearing: number): number {
  return Math.abs(shortestArc(bearing, facing));
}
