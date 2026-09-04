import { Vector3, type Object3D } from 'three';
import { findStandingSpots, type StandingSpot } from './standingSpots';

/*
 * Class III / S18 `props`: placing the FIRST object on this island that is
 * neither a character nor the camera — and the catalog's own acceptance bar
 * for this sprint is specific: "placed by the EXISTING placement solver,
 * that a character can stand beside WITHOUT BREAKING WALKABILITY." That is
 * two separate claims, and each has its own real mechanism here rather than
 * a shortcut standing in for it:
 *
 * (1) "Placed by the solver" — `findStandingSpots` is generic (`count`,
 * `isWalkable`, `preferDirection`, …; nothing in its signature or its body
 * names a character), so a prop is solved with the SAME function characters
 * are, not a parallel reimplementation. It gets a real walkability- and
 * flatness-checked spot, the same as any cast member.
 *
 * (2) "Without breaking walkability" — this is the harder claim, and it does
 * NOT fall out of (1) for free. Two independent checks, confirmed by reading
 * `standingSpots.ts` and `walkability.ts` directly: the baked walkability
 * mask only encodes water vs. land (it does not know about the island's own
 * stone table, benches or rocks either — those are caught only by the LIVE
 * flatness raycast against the registered ground mesh), and nothing in the
 * solver's own separation logic can see an object that was not itself one of
 * the spots CHOSEN IN THAT SAME CALL. A prop solved independently of the
 * cast is therefore invisible to the cast's own solve — nothing would stop a
 * character being placed on top of it.
 *
 * `excludingProp` below closes that gap the same way this codebase already
 * closes the identical gap for "what is this island's ground, semantically"
 * — by composing the CALLER-supplied `isWalkable` predicate, which is
 * exactly the extension point `standingSpots.ts`'s own docs describe
 * ("Omitting it means NOBODY HAS CHECKED this island... the caller has to
 * make that choice explicitly"). A character solve wrapped this way cannot
 * be handed a spot inside the prop's own footprint — a hard gate, the same
 * kind that already keeps a character out of the pond, not a soft scoring
 * preference that could still lose to a high enough flatness score.
 */

/**
 * Half-width/half-depth footprint a character should keep clear of a placed
 * prop, in metres. Lives here (a plain module, no React/JSX) rather than on
 * `StallProp.tsx` itself, so `verify-placement.ts` — a headless Node script
 * with no bundler and no JSX runtime — can import the ONE number it needs
 * without importing a `.tsx` React component to get it, the same caution
 * `measurements.ts`'s own header already takes for a different Vite-only
 * dependency ("nothing below needs a URL, only heights and footprints").
 */
export const STALL_CLEARANCE_M = 1.1;

/**
 * Composes an `isWalkable` predicate that also excludes a disc around
 * `prop`. `base` is optional for the same reason `FindSpotsOptions.isWalkable`
 * is — a missing mask means nobody has checked this island — and is treated
 * the same permissive way `findStandingSpots` itself treats an omitted one,
 * so this never makes a maskless island MORE restrictive than calling the
 * solver directly already would.
 */
export function excludingProp(
  base: ((x: number, z: number) => boolean) | undefined,
  prop: { x: number; z: number } | null,
  clearanceM: number,
): (x: number, z: number) => boolean {
  const walkable = base ?? (() => true);
  if (!prop) return walkable;
  const clearanceSq = clearanceM * clearanceM;
  return (x: number, z: number) => {
    if (!walkable(x, z)) return false;
    const dx = x - prop.x;
    const dz = z - prop.z;
    return dx * dx + dz * dz >= clearanceSq;
  };
}

/**
 * Solves ONE prop's spot on `ground`, or null if the island has nowhere
 * that clears the flatness/walkability/room bar for it.
 *
 * `preferDirection` defaults to the LEFT of the cast's own preferred side
 * (`TutorScene.tsx` gathers the cast toward `(0.35, 0, 1)`) rather than
 * away from camera entirely — a stall behind the cast is set dressing
 * nobody sees; the catalog's own ask is something "a character can stand
 * BESIDE," which needs it in frame. Kept off the cast's own best arc so a
 * single-item solve (which has no sibling to keep separated from) still
 * tends to land beside the scene rather than in the middle of it.
 */
export function findPropSpot(
  ground: Object3D,
  isWalkable: ((x: number, z: number) => boolean) | undefined,
  clearanceM: number,
  preferDirection: Vector3 = new Vector3(-0.9, 0, 0.55),
): StandingSpot | null {
  const spots = findStandingSpots(ground, {
    count: 1,
    isWalkable,
    clearance: clearanceM,
    preferDirection,
  });
  return spots[0] ?? null;
}
