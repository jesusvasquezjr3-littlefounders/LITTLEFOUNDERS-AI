import type { CharacterId } from '@/components/characters/control/types';
import { CHARACTER_MEASUREMENTS } from './measurements';
import { poseFor, STAGE_BEARING, type ShotId, type ShotScene, type Vec3 } from './shots';

/*
 * NOTHING DECORATIVE COVERS THE CHARACTER'S FACE OR HANDS (Frontend Bible 08
 * §2, "stage rules"; §10 item 3).
 *
 * Both Dioramas are ONE mesh with one material (see scripts/generate-walkmask.ts):
 * the ammonite on diorama-a and the palms and bushes on diorama-b are not
 * separate nodes, so there is no prop to hide or fade. What CAN move is where
 * the Mentor stands. This module states the question the placement solver now
 * asks of every candidate spot for the lead: from each camera the Mentor stage
 * uses, does the line to the character's head and to each hand reach them
 * before it reaches the island?
 *
 * PURE ON PURPOSE, like `shots.ts`: the caller supplies `hit`, the distance to
 * the first island surface along a ray (a three.js raycast in the product and in
 * `npm run verify:placement`, a synthetic occluder in the unit test), so the
 * rule itself is tested headless.
 *
 * THE POINTS ARE PROPORTIONAL, NOT SKINNED. The character exports are
 * meshopt-quantized and skinned (`scripts/verify-placement.ts`
 * `characterStandIn` records why they cannot be measured headless), so the
 * head and hands are sampled at fractions of each character's measured height,
 * in the bind pose, facing the camera. The fractions are written per character
 * below because the cast is not one shape: Dina's head is far forward of her
 * feet, Liruf's arms are short and high.
 */

/** A point on the character, as fractions of its height: up from the feet, sideways (+ right), forward (toward the camera). */
export interface ReadablePoint { name: 'head' | 'hand_left' | 'hand_right'; up: number; side: number; forward: number }

export const READABLE_POINTS: Readonly<Record<CharacterId, readonly ReadablePoint[]>> = {
  rho: [
    { name: 'head', up: 0.82, side: 0, forward: 0.03 },
    { name: 'hand_left', up: 0.46, side: -0.2, forward: 0.06 },
    { name: 'hand_right', up: 0.46, side: 0.2, forward: 0.06 },
  ],
  zara: [
    { name: 'head', up: 0.82, side: 0, forward: 0.03 },
    { name: 'hand_left', up: 0.47, side: -0.19, forward: 0.06 },
    { name: 'hand_right', up: 0.47, side: 0.19, forward: 0.06 },
  ],
  liruf: [
    { name: 'head', up: 0.8, side: 0, forward: 0.14 },
    { name: 'hand_left', up: 0.52, side: -0.12, forward: 0.16 },
    { name: 'hand_right', up: 0.52, side: 0.12, forward: 0.16 },
  ],
  dina: [
    { name: 'head', up: 0.78, side: 0, forward: 0.42 },
    // A quadruped's "hands" are her front paws, and the stage frames her down to them.
    { name: 'hand_left', up: 0.16, side: -0.12, forward: 0.3 },
    { name: 'hand_right', up: 0.16, side: 0.12, forward: 0.3 },
  ],
};

/** The shots the Mentor stage holds: the close-up (full size) and the wide close-up (Dina on diorama-a, and the compact band). */
export const STAGE_SHOTS: readonly ShotId[] = ['closeup', 'closeup-wide'];

/** The viewports those shots are seen through: a 375 x 812 phone, a 1280 x 800 desktop, and the compact lesson band. */
export const STAGE_ASPECTS: readonly { id: string; aspect: number }[] = [
  { id: 'phone', aspect: 375 / 812 },
  { id: 'desktop', aspect: 1280 / 800 },
  { id: 'band', aspect: 2.4 },
];

/** The stage camera's vertical field of view (TutorScene's `SceneCanvas camera={{ fov: 36 }}`). */
export const STAGE_FOV = 36;

/** A surface this close in front of the point is the character's own footing, not an occluder (metres). */
export const OCCLUSION_TOLERANCE_M = 0.15;

/** Distance to the first island surface from `from` along the unit `direction`, within `far`; null when the ray is clear. */
export type RayHit = (from: Vec3, direction: Vec3, far: number) => number | null;

export interface CharacterPlacement { who: CharacterId; x: number; y: number; z: number; facing: number }

/** The character's readable points in the scene, for its placement. */
export function readablePoints(placement: CharacterPlacement): { name: ReadablePoint['name']; at: Vec3 }[] {
  const height = CHARACTER_MEASUREMENTS[placement.who].targetHeightM;
  const forward = { x: Math.sin(placement.facing), z: Math.cos(placement.facing) };
  const right = { x: Math.cos(placement.facing), z: -Math.sin(placement.facing) };
  return READABLE_POINTS[placement.who].map((p) => ({
    name: p.name,
    at: {
      x: placement.x + (right.x * p.side + forward.x * p.forward) * height,
      y: placement.y + p.up * height,
      z: placement.z + (right.z * p.side + forward.z * p.forward) * height,
    },
  }));
}

export interface Occlusion { shot: ShotId; viewport: string; point: ReadablePoint['name']; blockedAt: number; distance: number }

/**
 * Every (shot, viewport, point) whose line from the camera meets the island
 * before it meets the character. Empty means the face and hands are clear in
 * every stage shot.
 */
export function stageOcclusions(placement: CharacterPlacement, scene: ShotScene, hit: RayHit, shots: readonly ShotId[] = STAGE_SHOTS): Occlusion[] {
  const height = CHARACTER_MEASUREMENTS[placement.who].targetHeightM;
  // The subject the director frames: the mid-head, at the character's own facing (TutorScene's `focus`).
  const lead = { x: placement.x, y: placement.y + height * 0.75, z: placement.z, facing: placement.facing, height };
  const points = readablePoints(placement);
  const found: Occlusion[] = [];
  for (const shot of shots) {
    for (const viewport of STAGE_ASPECTS) {
      const pose = poseFor(shot, { scene, lead, companion: null, aspect: viewport.aspect, fov: STAGE_FOV });
      for (const point of points) {
        const d = { x: point.at.x - pose.position.x, y: point.at.y - pose.position.y, z: point.at.z - pose.position.z };
        const distance = Math.hypot(d.x, d.y, d.z);
        if (!(distance > 0)) continue;
        const direction = { x: d.x / distance, y: d.y / distance, z: d.z / distance };
        const blockedAt = hit(pose.position, direction, distance);
        if (blockedAt !== null && blockedAt < distance - OCCLUSION_TOLERANCE_M) {
          found.push({ shot, viewport: viewport.id, point: point.name, blockedAt, distance });
        }
      }
    }
  }
  return found;
}

/**
 * The facings the lead may end up with, relative to the stage bearing. The
 * placement solve lands before `facing.ts` turns the lead toward its companion
 * (measured: up to 20 degrees on both Dioramas), so the gate holds for the
 * whole band a turn can take, not for the bearing alone.
 */
export const CORRIDOR_FACING_OFFSETS: readonly number[] = [-25, -12, 0, 12, 25].map((deg) => (deg * Math.PI) / 180);

/**
 * The placement solver's gate for the lead's spot, before facings are solved.
 * `verify:placement` re-checks with the facings actually solved.
 */
export function corridorClear(who: CharacterId, spot: { x: number; y: number; z: number }, scene: ShotScene, hit: RayHit): boolean {
  return CORRIDOR_FACING_OFFSETS.every((offset) => stageOcclusions({ who, ...spot, facing: STAGE_BEARING + offset }, scene, hit).length === 0);
}
