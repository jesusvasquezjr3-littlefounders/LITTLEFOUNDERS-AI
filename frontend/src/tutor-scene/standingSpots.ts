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
    isWalkable,
    clearance = 0,
  } = options;

  const box = new Box3().setFromObject(ground);
  if (box.isEmpty()) return [];
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const islandRadius = Math.max(size.x, size.z) / 2;
  const rayHeight = box.max.y + 1;

  const raycaster = new Raycaster();
  const prefer = preferDirection.clone().setY(0).normalize();

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
  for (const radiusFactor of [0.32, 0.45, 0.58, 0.7]) {
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

      candidates.push({
        x,
        z,
        y,
        score: flatness * 0.44 + facing * 0.24 + relativeHeight * 0.12 + room * 0.2,
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
