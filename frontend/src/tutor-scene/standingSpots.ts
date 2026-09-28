import { Box3, Raycaster, Vector3, type Object3D } from 'three';

/*
 * Finds places on an island where a character can credibly stand.
 *
 * Hand-placing characters against one diorama does not survive contact with
 * the second: these islands are dense with rocks, a stone table, benches and
 * palms, and coordinates tuned by eye on one asset put a character standing on
 * a table or half-inside a boulder on the next. Both happened.
 *
 * So the spots are SOLVED, not authored. Candidates are sampled on rings over
 * the island, a ray finds the surface under each, and a spot is only accepted
 * if the ground there is flat (the surface normal points up), open (its
 * neighbours sit at a similar height, so it is not the top of a rock) and
 * actually on the island.
 *
 * WHAT THAT WAS MISSING, and it took a screenshot to notice: geometry says how
 * a surface BEHAVES, never what it IS. Water is the flattest, most open surface
 * a diorama has, so on `diorama-b` it outscored every patch of grass and the
 * entire cast stood in the pond — every pairing, both characters, for as long as
 * the island had shipped. No amount of tuning the flatness threshold fixes that,
 * because the pond is not badly shaped; it is beautifully shaped and wet.
 *
 * Hence `isWalkable`: the semantic half of the question, answered by the mask
 * `scripts/generate-walkmask.ts` bakes from each island's own texture and
 * resolved in `walkability.ts`. Shape is still scored here; meaning arrives
 * from there.
 */

export interface StandingSpot {
  x: number;
  z: number;
  /** Surface height at this spot. */
  y: number;
  /** How flat, open and roomy it is, 0..1. Higher is better. */
  score: number;
}

export interface FindSpotsOptions {
  /** How many spots to return. */
  count: number;
  /**
   * Minimum separation between chosen spots, in metres.
   *
   * With `separationFor` supplied this is only the SCALE for the grouping
   * preference below; the hard gate is then per pair.
   */
  minSeparation?: number;
  /**
   * The hard floor between the spot being chosen for member `index` and the
   * one already chosen for member `other`, in metres.
   *
   * A single number cannot express this cast: Dina and Liruf need 2.61 m
   * between them, while Rho and Zara need 1.18 m, and applying the first figure
   * to all four leaves two of them with nowhere to stand on `diorama-a`
   * (measured by `npm run verify:placement`). Indices are positions in the
   * caller's cast, and the k-th spot returned belongs to the k-th member, so
   * the caller can state the rule for any pair.
   */
  separationFor?: (index: number, other: number) => number;
  /** Half-width of the flatness probe, in metres. */
  probe?: number;
  /**
   * Preferred facing direction in the XZ plane. Spots on this side score
   * higher, so characters gather where the camera opens onto the scene rather
   * than behind the scenery.
   */
  preferDirection?: Vector3;
  /**
   * May a character stand at (x, z)? Baked per island; see `walkability.ts`.
   *
   * Omitting it means NOBODY HAS CHECKED this island, not that everything is
   * walkable — the caller has to make that choice explicitly, which is the
   * whole reason `walkabilityFor` returns null instead of a permissive default.
   */
  isWalkable?: (x: number, z: number) => boolean;
  /**
   * How strongly the solver pulls the cast TOGETHER, as a score weight.
   *
   * Positive is the shipped default and is what makes a pair read as two
   * figures sharing a place rather than ignoring each other across a lake.
   * NEGATIVE spreads them, which is what a personalization audition wants: four
   * candidates are a ring you look along, not a huddle, and packing the first
   * three into the highest-scoring arc leaves the fourth with nowhere to stand
   * at all on a 6.5 m island (measured by `npm run verify:placement`).
   */
  grouping?: number;
  /**
   * How finely each ring is sampled, in candidate points per metre of radius.
   *
   * The default is what two characters need and no more: a coarse ring is a
   * cheap ring, and every sample costs five raycasts against a 45k-triangle
   * island. A LARGER cast needs a finer one, and not for aesthetic reasons —
   * measured on `diorama-a`, the usable band is two rings wide, and at the
   * default density the surviving samples are 40 degrees apart while the gap
   * left for the fourth candidate is 27 degrees. The spot exists; nothing was
   * ever sampled in it.
   */
  samplesPerMetre?: number;
  /**
   * The direction that costs the CAMERA, in the XZ plane — normally the screen's
   * own horizontal axis.
   *
   * Supplying it makes the solver prefer to separate the cast ALONG THE VIEW
   * AXIS rather than across it. Depth is free: two characters a metre apart in
   * depth are a metre apart to the separation rule and cost the framing nothing,
   * because the frame's width is what a portrait phone has least of. The same
   * metre spent sideways is a metre the camera has to stand back to keep inside
   * the frame, and the retreat costs coverage as its square.
   *
   * Omitting it is the shipped two-person behaviour byte for byte: a pair is
   * framed in close-up, where the island's own extent decides nothing.
   */
  narrowAxis?: Vector3;
  /**
   * How hard that preference pushes, as a score weight against the SQUARE of the
   * off-axis distance in island radii.
   *
   * Squared rather than linear on purpose: a candidate a third of the way out is
   * barely charged, one at the rim is charged the lot. A linear penalty of any
   * useful size collapses the whole cast onto the centre line and turns an
   * audition into a queue receding from the camera.
   */
  narrowWeight?: number;
  /**
   * Which rings are sampled, as fractions of the island's radius.
   *
   * The default reaches 0.70 — nearly the rim — which is right for two people
   * sharing a place and wrong for four being LOOKED at on a phone. See
   * `AUDITION_RINGS`.
   */
  rings?: readonly number[];
  /**
   * Half the widest character's footprint, in metres. Used to PREFER spots with
   * room around them, never to reject.
   *
   * Deliberately a preference: rejecting on it can leave a large character with
   * no spot at all, and a scene with nobody in it is a far worse failure than a
   * character standing a little close to the rim. Dina covers 2.83 m on a 6.5 m
   * island — there is not always a roomy answer, and the solver still has to
   * return the best one there is.
   */
  clearance?: number;
  /**
   * May the LEAD (the first member, the one the Mentor stage frames) stand
   * here? A hard gate, like `isWalkable`: Frontend Bible 08 §2 says nothing
   * decorative covers the character's face or hands, and the Dioramas are one
   * mesh, so the ammonite, the palms and the bushes cannot be hidden, only
   * stood clear of. `occlusion.ts` `corridorClear` answers it from the stage's
   * own camera poses. Omitted (an audition, a scene without it): every spot.
   */
  leadCorridorClear?: (spot: { x: number; y: number; z: number }) => boolean;
}

/**
 * The grouping weight a personalization audition solves with.
 *
 * Negative on purpose, and the sign is the whole content: with the shipped
 * +0.25 the solver packs the first three candidates into the best arc of a
 * 6.5 m island and then reports NO SPOT FOUND for the fourth, whose name plate
 * is then culled and who cannot be chosen by looking at them at all. Spreading
 * is also the composition the phase wants: a ring of candidates the camera can
 * pan along, rather than a huddle.
 */
export const AUDITION_GROUPING = -0.25;

/**
 * How finely an audition samples each ring.
 *
 * Twice the default, because four candidates have to fit where two used to and
 * the answer is a 27-degree window the coarse ring never sampled. It costs one
 * extra solve's worth of raycasts, once, on the way into a phase that is
 * already waiting on four .glb files.
 */
export const AUDITION_SAMPLES_PER_METRE = 12;

/**
 * THE RINGS AN AUDITION STANDS ON, and they stop well short of the rim.
 *
 * The default set reaches 0.70 of the island's radius, which is the right answer
 * for two people sharing a place: a close shot frames THEM and the island's
 * extent decides nothing. It is the wrong answer for four candidates on a
 * portrait phone, and the arithmetic is not close. `approach` must keep every
 * candidate inside a frame whose horizontal field of view is 17 degrees, so the
 * frame's WORLD WIDTH is fixed at roughly 2.3x the widest candidate's distance
 * from the aim — and everything else about the picture follows from that one
 * number. Measured on `diorama-a`: the cast solved out to 1.97 m either side of
 * the aim, the frame came out 5.56 m wide against a 6.5 m island, and the island
 * painted 29.9% of a 375x812 phone while the other establishing phases reached
 * 50%. Four fifths of the screen were sky and void on the one screen a child
 * chooses their tutor on.
 *
 * Pulling the rings in does not merely move people: it moves the CAMERA, because
 * the shot now holds the cast itself (`shots.ts` → `ShotContext.cast`) rather
 * than a hand-tuned fraction of the island. Gather the cast and the camera comes
 * with them.
 *
 * 0.24 is the inner limit rather than 0.32 because these islands put a feature —
 * a stone table, a fire — near the middle, and the flatness and walkability
 * gates already reject anything standing on it. A ring that is mostly rejected
 * costs raycasts and nothing else; a ring that is missing costs a candidate.
 *
 * AND 0.66 IS THE OUTER LIMIT RATHER THAN 0.50, which is the mistake this set
 * nearly shipped with. Cutting the outer rings looked like the direct way to
 * gather the cast and it is the way that loses people: run headless against the
 * real islands, a set stopping at 0.54 seats all four candidates on `diorama-a`
 * and only THREE on `diorama-b`, whose pond takes most of the inner deck. A
 * candidate with no spot has no anchor, so their plate is hidden and inert and
 * they cannot be chosen at all. The gathering is the score's job
 * (`AUDITION_NARROW_WEIGHT`), which is a PREFERENCE and degrades into "stand
 * wherever you can" — the rings only have to be there when it needs them.
 */
export const AUDITION_RINGS = [0.24, 0.34, 0.45, 0.56, 0.66] as const;

/**
 * How hard an audition prefers depth over width. See `FindSpotsOptions.narrowWeight`.
 *
 * Measured by sweeping it against the real islands and the real `approach` pose:
 * at 0 the cast spreads 1.97 m either side on `diorama-a` and the island paints
 * 30% of a phone; at 0.8 it spreads 1.12 m and paints 50%; past that the gain
 * flattens out because the island's own hold floor takes over as the binding
 * constraint, and the cast starts forming a single file receding from the
 * camera, which is a queue rather than a line-up.
 */
export const AUDITION_NARROW_WEIGHT = 0.8;

const DOWN = new Vector3(0, -1, 0);

/** The eight compass directions, for probing the room around a candidate. */
const AROUND = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return { dx: Math.cos(angle), dz: Math.sin(angle) };
});

export function findStandingSpots(ground: Object3D, options: FindSpotsOptions): StandingSpot[] {
  const {
    count,
    minSeparation = 1.2,
    separationFor,
    grouping = 0.25,
    samplesPerMetre = 6,
    probe = 0.35,
    preferDirection = new Vector3(0, 0, 1),
    narrowAxis,
    narrowWeight = 0,
    rings = [0.32, 0.45, 0.58, 0.7],
    isWalkable,
    clearance = 0,
    leadCorridorClear,
  } = options;

  const box = new Box3().setFromObject(ground);
  if (box.isEmpty()) return [];
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const islandRadius = Math.max(size.x, size.z) / 2;
  const rayHeight = box.max.y + 1;

  const raycaster = new Raycaster();
  const prefer = preferDirection.clone().setY(0).normalize();
  /*
   * The axis the camera pays for, normalised once. Zero-length is treated as
   * "no preference" rather than as a division by zero: a caller who passes
   * (0,0,0) meant to leave this off.
   */
  const narrow =
    narrowAxis && narrowAxis.lengthSq() > 1e-6 && narrowWeight > 0
      ? narrowAxis.clone().setY(0).normalize()
      : null;

  /** Surface height under (x, z), or null when the ray misses the island. */
  const surfaceAt = (x: number, z: number): number | null => {
    raycaster.set(new Vector3(x, rayHeight, z), DOWN);
    const hit = raycaster.intersectObject(ground, true)[0];
    return hit ? hit.point.y : null;
  };

  /** No mask means no evidence; the caller decided what that means. */
  const walkable = isWalkable ?? (() => true);

  const candidates: StandingSpot[] = [];

  // Rings from just outside the centre (usually occupied by a feature) to
  // inside the rim (which is usually sloped or fenced).
  for (const radiusFactor of rings) {
    const radius = islandRadius * radiusFactor;
    const steps = Math.max(8, Math.round(radius * samplesPerMetre));
    for (let step = 0; step < steps; step++) {
      const theta = (step / steps) * Math.PI * 2;
      const x = center.x + Math.cos(theta) * radius;
      const z = center.z + Math.sin(theta) * radius;

      const y = surfaceAt(x, z);
      if (y === null) continue;

      /*
       * The hard gate, and the only one that is not a matter of degree: you
       * cannot stand on this at all. Checked at the spot AND at the flatness
       * probes, because a character whose centre clears the shoreline by a
       * hair still has both feet in the lake.
       */
      if (!walkable(x, z)) continue;
      if (
        !walkable(x + probe, z) ||
        !walkable(x - probe, z) ||
        !walkable(x, z + probe) ||
        !walkable(x, z - probe)
      ) {
        continue;
      }

      // Flatness/openness: four neighbours must agree about the height here.
      // A rock top passes the surface test but fails this one, which is the
      // whole point — it is what "standing on a boulder" looks like numerically.
      const neighbours = [
        surfaceAt(x + probe, z),
        surfaceAt(x - probe, z),
        surfaceAt(x, z + probe),
        surfaceAt(x, z - probe),
      ];
      if (neighbours.some((n) => n === null)) continue;
      const spread = Math.max(...(neighbours as number[])) - Math.min(...(neighbours as number[]));
      // More than a step's worth of variation across 70 cm is not a floor.
      if (spread > 0.22) continue;

      const flatness = 1 - Math.min(spread / 0.22, 1);
      const facing = (new Vector3(x - center.x, 0, z - center.z).normalize().dot(prefer) + 1) / 2;
      // Height matters too: on these islands the walkable deck is the high
      // ground, and low hits are the surrounding rim or the underside.
      const relativeHeight = (y - box.min.y) / Math.max(size.y, 1e-6);

      /*
       * Room: how much of this character's own footprint lands on ground they
       * could also have stood on. Since the mask marks everything off the
       * island as unwalkable, this scores rim clearance and pond clearance with
       * one measurement instead of two rules that could disagree.
       */
      let room = 1;
      if (clearance > 0) {
        let clear = 0;
        for (const { dx, dz } of AROUND) {
          if (walkable(x + dx * clearance, z + dz * clearance)) clear += 1;
        }
        room = clear / AROUND.length;
      }

      /*
       * And the width this spot would cost the CAMERA. `off` is how far the
       * spot sits across the frame, in island radii; squared, so the middle of
       * the island is nearly free and the rim is expensive. Depth is not
       * charged at all — it is the axis a portrait phone has to spare.
       */
      let width = 0;
      if (narrow) {
        const off = Math.abs((x - center.x) * narrow.x + (z - center.z) * narrow.z) / islandRadius;
        width = Math.min(off, 1) ** 2 * narrowWeight;
      }

      candidates.push({
        x,
        z,
        y,
        score: flatness * 0.44 + facing * 0.24 + relativeHeight * 0.12 + room * 0.2 - width,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  /*
   * Greedy selection, with a floor AND a preference for a ceiling.
   *
   * The floor stops two characters standing inside one another. The preference
   * stops the opposite failure, which only became visible once the walkability
   * mask opened up `diorama-b`: with the pond off-limits, the two
   * highest-scoring patches of grass sat on OPPOSITE SHORES, and the solver
   * dutifully chose both. Measured 5.39 m apart on a 9.5 m island, against
   * 1.82 m on diorama-a. Nobody was standing anywhere wrong; they were simply
   * ignoring each other across a lake.
   *
   * `TutorScene` then turns each character a quarter of the way toward the
   * other, which is what makes a pair read as two figures sharing a place —
   * and that gesture means nothing at six metres.
   *
   * A preference and not a rule: on a crowded island the only spots that clear
   * the floor may all be far apart, and returning one character is worse than
   * returning two who stand further apart than ideal.
   */
  const chosen: StandingSpot[] = [];
  const remaining = [...candidates];
  while (chosen.length < count && remaining.length > 0) {
    /*
     * 08 §2: the lead's face and hands are never behind the scenery in a stage
     * shot. With nobody chosen yet a candidate's value IS its score, and
     * `remaining` is sorted by score, so the first candidate that passes the
     * gate is the best one: the raycasts stop there instead of running for
     * every sample on the island.
     */
    if (chosen.length === 0 && leadCorridorClear) {
      const found = remaining.findIndex((candidate) => leadCorridorClear(candidate));
      // No clear spot at all (an island this gate was not measured on): a lead partly
      // behind a prop beats an empty stage, and `verify:placement` names it.
      const clear = found === -1 ? 0 : found;
      chosen.push(remaining[clear]!);
      remaining.splice(clear, 1);
      continue;
    }
    let bestIndex = -1;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i]!;
      let nearest = Infinity;
      let clashes = false;
      for (let j = 0; j < chosen.length; j += 1) {
        const spot = chosen[j]!;
        const distance = Math.hypot(spot.x - candidate.x, spot.z - candidate.z);
        // The floor for THIS pair. Without `separationFor` every pair shares
        // one number, which is the shipped behaviour byte for byte.
        const floor = separationFor ? separationFor(chosen.length, j) : minSeparation;
        if (distance < floor) { clashes = true; break; }
        nearest = Math.min(nearest, distance);
      }
      if (clashes) continue;

      // 1 while comfortably close, decaying to 0 by 3.5x the floor.
      const comfortable = minSeparation * 1.6;
      const far = minSeparation * 3.5;
      const together = !Number.isFinite(nearest)
        ? 0
        : nearest <= comfortable
          ? 1
          : Math.max(0, 1 - (nearest - comfortable) / (far - comfortable));

      const value = candidate.score + (chosen.length > 0 ? together * grouping : 0);
      if (value > bestValue) { bestValue = value; bestIndex = i; }
    }

    if (bestIndex === -1) break;
    chosen.push(remaining[bestIndex]!);
    remaining.splice(bestIndex, 1);
  }
  return chosen;
}
