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
 * Same reasoning as `STALL_CLEARANCE_M`, for the second prop
 * (`CrateProp.tsx`) that proves this module's own generality: a crate's
 * footprint is a fraction of a stall's, and giving it a SMALLER clearance
 * rather than reusing the stall's is the actual point of a per-kind
 * constant — a single shared radius would either crowd the stall or waste
 * ground around the crate.
 */
export const CRATE_CLEARANCE_M = 0.55;

/**
 * Every prop kind this island can place, and the clearance each one needs —
 * the lookup `TutorScene.tsx`'s own multi-prop solve reads by name so that
 * adding a THIRD kind is a one-line addition here, never a new branch at
 * every call site. Kept a plain object rather than a function: both entries
 * are compile-time constants, and a caller mapping over `props` needs
 * synchronous, allocation-free access on every render.
 */
export const PROP_CLEARANCE_M = {
  stall: STALL_CLEARANCE_M,
  crate: CRATE_CLEARANCE_M,
} as const;

export type PropKind = keyof typeof PROP_CLEARANCE_M;

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

/**
 * Solves EVERY entry in `kinds`, in order, each excluding every prop already
 * placed before it — the generalization `props` (2026-09-04) needed beyond
 * `findPropSpot`: a lone prop only ever had to answer to the island, but two
 * requested together must also answer to EACH OTHER, or nothing stops a
 * second prop's own solve from landing inside the first one's footprint the
 * same way an unwrapped character solve could before `excludingProp` existed.
 *
 * A `null` from a single kind's solve (the island had nowhere left that
 * cleared its bar) is skipped rather than aborting the rest — one prop with
 * nowhere to go is not a reason to also withhold every other prop that DID
 * find room, the same "a miss costs nothing, never everything" posture
 * `pointTarget.ts` already applies to a different kind of miss.
 *
 * Lives here, not inline in `TutorScene.tsx`'s own solve effect, for the
 * SAME reason `findPropSpot`/`excludingProp` already do: `verify-placement.ts`
 * is a headless script with no React tree to mount, and needs this exact
 * sequence to certify rather than a hand-rolled copy that could drift from
 * what the product actually runs.
 */
export function findPropSpots(
  ground: Object3D,
  isWalkable: ((x: number, z: number) => boolean) | undefined,
  kinds: readonly PropKind[],
): readonly (readonly [PropKind, StandingSpot])[] {
  const solved: (readonly [PropKind, StandingSpot])[] = [];
  let walkable = isWalkable;
  for (const kind of kinds) {
    const clearanceM = PROP_CLEARANCE_M[kind];
    const spot = findPropSpot(ground, walkable, clearanceM);
    if (!spot) continue;
    solved.push([kind, spot]);
    walkable = excludingProp(walkable, spot, clearanceM);
  }
  return solved;
}

/**
 * Composes an `isWalkable` predicate that excludes the disc around EVERY
 * solved prop in `props` (as returned by `findPropSpots`) — the multi-prop
 * sibling of `excludingProp` itself, for the character solve that must clear
 * all of them at once rather than being wrapped once per prop by hand.
 */
export function excludingProps(
  base: ((x: number, z: number) => boolean) | undefined,
  props: readonly (readonly [PropKind, StandingSpot])[],
): (x: number, z: number) => boolean {
  let walkable = base;
  for (const [kind, spot] of props) {
    walkable = excludingProp(walkable, spot, PROP_CLEARANCE_M[kind]);
  }
  return walkable ?? (() => true);
}
