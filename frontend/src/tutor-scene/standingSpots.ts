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
 * neighbours sit at a similar height, so it is not the top of a rock or the
 * lip of a ledge) and actually on the island. Whatever island ships next needs
 * no coordinates and no re-tuning.
 */

export interface StandingSpot {
  x: number;
  z: number;
  /** Surface height at this spot. */
  y: number;
  /** How flat and open it is, 0..1. Higher is better. */
  score: number;
}

export interface FindSpotsOptions {
  /** How many spots to return. */
  count: number;
  /** Minimum separation between chosen spots, in metres. */
  minSeparation?: number;
  /** Half-width of the flatness probe, in metres. */
  probe?: number;
  /**
   * Preferred facing direction in the XZ plane. Spots on this side score
   * higher, so characters gather where the camera opens onto the scene rather
   * than behind the scenery.
   */
  preferDirection?: Vector3;
}

const DOWN = new Vector3(0, -1, 0);

export function findStandingSpots(ground: Object3D, options: FindSpotsOptions): StandingSpot[] {
  const { count, minSeparation = 1.2, probe = 0.35, preferDirection = new Vector3(0, 0, 1) } = options;

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

  const candidates: StandingSpot[] = [];

  // Rings from just outside the centre (usually occupied by a feature) to
  // inside the rim (which is usually sloped or fenced).
  for (const radiusFactor of [0.32, 0.45, 0.58, 0.7]) {
    const radius = islandRadius * radiusFactor;
    const steps = Math.max(8, Math.round(radius * 6));
    for (let step = 0; step < steps; step++) {
      const theta = (step / steps) * Math.PI * 2;
      const x = center.x + Math.cos(theta) * radius;
      const z = center.z + Math.sin(theta) * radius;

      const y = surfaceAt(x, z);
      if (y === null) continue;

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

      candidates.push({ x, z, y, score: flatness * 0.55 + facing * 0.3 + relativeHeight * 0.15 });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Greedy selection with a separation constraint, so two characters never end
  // up standing inside one another.
  const chosen: StandingSpot[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    const clashes = chosen.some(
      (spot) => Math.hypot(spot.x - candidate.x, spot.z - candidate.z) < minSeparation,
    );
    if (!clashes) chosen.push(candidate);
  }
  return chosen;
}
