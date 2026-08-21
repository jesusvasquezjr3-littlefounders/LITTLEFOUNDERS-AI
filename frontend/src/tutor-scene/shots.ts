/*
 * The Tutor's shot vocabulary.
 *
 * WHY THIS IS A MODULE AND NOT A BRANCH IN THE CAMERA RIG. The stage shipped
 * with two framings decided inside `useFrame`, each of which computed an
 * ABSOLUTE camera position and wrote it every frame. That works, and it is also
 * the reason every framing change SNAPPED: there was no state between "here" and
 * "there" for anything to move through. A camera that teleports is not a
 * cheaper camera move, it is the absence of one.
 *
 * Splitting the DESTINATION from the TRAVEL fixes that in one step. Every
 * function here answers a single question — given the island, the cast and the
 * viewport, where should the camera BE for this shot — and answers it with pure
 * arithmetic. `CameraDirector` then owns the travel, and owns it once, for every
 * shot, instead of each shot reinventing it.
 *
 * PURE ON PURPOSE. Nothing here imports `three` or React, so the whole framing
 * system is testable headless the way `measurements.ts` already is. That is not
 * tidiness: framing bugs on this stage have historically been found by LOOKING,
 * because there was no way to ask "how far back does a 9.5 m island put the
 * camera on a portrait phone" without a browser and a GPU. Now there is.
 *
 * THE TRAP, recorded because it has already cost this scene once. `two-shot` and
 * `over-shoulder` orbit off the cast's facing axis. They must NEVER feed back
 * into the placement solver: if the cast re-solves to face the camera while the
 * camera is moving, the two chase each other and the characters end up facing a
 * shot that has already moved on. The camera reads placement; placement never
 * reads the camera.
 */

/** A point or a direction in scene space, in metres. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Every framing the stage can hold.
 *
 * Closed, and small enough to enumerate in a picker — which the scene lab does,
 * because a framing nobody can put on screen on demand is a framing nobody
 * verifies.
 */
export type ShotId =
  | 'establishing'
  | 'approach'
  | 'closeup'
  | 'closeup-wide'
  | 'two-shot'
  | 'over-shoulder';

export const SHOT_IDS = [
  'establishing',
  'approach',
  'closeup',
  'closeup-wide',
  'two-shot',
  'over-shoulder',
] as const satisfies readonly ShotId[];

/**
 * Who is being framed, and how big they are.
 *
 * The point is the character's MID-HEAD, not their feet and not their crown.
 * That choice is load bearing and was made by measurement: aiming at the crown
 * put the entire face in the bottom half of frame, and aiming at a fixed eye
 * height aimed at sky for Dina, who is a quadruped 0.70 m to the shoulder.
 */
export interface ShotSubject {
  x: number;
  y: number;
  z: number;
  /** Yaw the subject faces, in radians. Same convention as the placement solver. */
  facing: number;
  /** The subject's own height in metres, so every framing scales to them. */
  height: number;
}

/**
 * The composed scene's measured bounds. Supplied by the caller rather than
 * computed here, because measuring means walking an `Object3D` graph and that is
 * exactly the dependency this module exists without.
 */
export interface ShotScene {
  centre: Vec3;
  /** FULL extents of the bounding box, in metres (not half-extents). */
  size: Vec3;
}

export interface ShotContext {
  scene: ShotScene;
  /** The speaking character. Null until the placement solve lands. */
  lead: ShotSubject | null;
  /** The second character, when there is one. */
  companion: ShotSubject | null;
  /** Viewport aspect, width / height. */
  aspect: number;
  /** The camera's vertical field of view, in degrees. */
  fov: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
}

/**
 * The bearing the stage opens on, in radians about +Y.
 *
 * Derived from the placement solver's own `preferDirection` of (0.35, 0, 1)
 * rather than authored separately. The two used to be independent numbers that
 * happened to agree within four degrees — the cast gathers on the side the
 * camera opens onto because both constants said so, not because anything
 * connected them. Deriving one from the other makes the agreement a fact rather
 * than a coincidence that survives until someone tunes one of them.
 */
export const STAGE_BEARING = Math.atan2(0.35, 1);

/**
 * How far off the subject's own facing axis `closeup-wide` sits, in radians.
 *
 * /ORACLE.md §2.2's primary decision for the two characters with no mouth card
 * is "they frame wider" — their performance is posture and gesture, and a
 * dead-on close-up frames the one thing that is not working. 22 degrees is
 * enough to read as a chosen angle rather than a mistake, and little enough that
 * the face is still the subject.
 */
export const CLOSEUP_WIDE_OFF_AXIS = (22 * Math.PI) / 180;

/** How much further back `closeup-wide` sits than `closeup`. */
export const CLOSEUP_WIDE_DISTANCE = 1.35;

/**
 * Which shots FIT a measured object, and therefore must give ground when the HUD
 * eats part of the viewport.
 *
 * A fitting shot has a size requirement, so a smaller free rectangle means
 * pulling back. A close shot does not: /ORACLE.md's composition rule is that the
 * character's on-screen height does not change when a lesson plate appears, so
 * a close shot answers an inset by SHIFTING its aim and never by retreating.
 * Conflating the two is how a lesson panel silently shrinks the character it is
 * supposed to be sitting beside.
 */
export const SHOT_FITS_SCENE: Readonly<Record<ShotId, boolean>> = Object.freeze({
  establishing: true,
  approach: true,
  closeup: false,
  'closeup-wide': false,
  'two-shot': true,
  'over-shoulder': false,
});

/**
 * The ambient motion each shot wears when ambient motion is on at all.
 *
 * `orbit` is the slow circle that turns a mesh into a place. `handheld` is a
 * far smaller sway that reads as a held camera — an orbit during dialogue reads
 * as the room moving rather than the person speaking, which is a different scene
 * entirely.
 */
export const SHOT_AMBIENT: Readonly<Record<ShotId, 'orbit' | 'handheld'>> = Object.freeze({
  establishing: 'orbit',
  approach: 'orbit',
  closeup: 'handheld',
  'closeup-wide': 'handheld',
  'two-shot': 'handheld',
  'over-shoulder': 'handheld',
});

/* Small local vector helpers. Deliberately not `three`'s — see the header. */

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

/**
 * Guards the viewport numbers before any trigonometry touches them.
 *
 * A zero-height canvas is a real state — it is what jsdom reports, and what a
 * browser reports for one frame while a panel is animating open. `width / 0` is
 * `Infinity`, which propagates through `atan` into a camera position of NaN, and
 * a NaN camera renders nothing at all with no error anywhere. Substituting a
 * square viewport is wrong by a little for one frame; NaN is wrong forever.
 */
function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

function safeFovRadians(fovDegrees: number): number {
  const fov = Number.isFinite(fovDegrees) && fovDegrees > 1 && fovDegrees < 179 ? fovDegrees : 36;
  return (fov * Math.PI) / 180;
}

/** Horizontal field of view implied by a vertical one at this aspect. */
export function horizontalFov(verticalFovRadians: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect(aspect));
}

/**
 * How far back a camera must sit to contain a subject of these half-extents.
 *
 * Fits the BOX, never the bounding sphere. A sphere around a wide flat island is
 * dominated by its width, so fitting one pushed the camera about 65% further
 * back than necessary and left the island a small object in a sea of margin.
 * `fitCamera.ts` still fits a sphere and is still correct for what it does —
 * framing one unknown asset in the inspector, where over-framing is safe and
 * cropping is not.
 */
export function fitDistance(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
  verticalFovRadians: number,
  aspect: number,
): number {
  const hFov = horizontalFov(verticalFovRadians, aspect);
  const forHeight = halfHeight / Math.tan(verticalFovRadians / 2) + halfDepth;
  const forWidth = halfWidth / Math.tan(hFov / 2) + halfDepth;
  return Math.max(forHeight, forWidth);
}

/** Camera position on a bearing at a distance and elevation around a target. */
function orbitPosition(target: Vec3, bearing: number, distance: number, height: number): Vec3 {
  return vec(target.x + Math.sin(bearing) * distance, height, target.z + Math.cos(bearing) * distance);
}

/** Shortest-arc average of two yaws. Naive averaging flips across ±π. */
function blendYaw(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

/** The distance an island fit needs, shared by `establishing` and `approach`. */
function sceneFitDistance(ctx: ShotContext): number {
  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const span = Math.max(ctx.scene.size.x, ctx.scene.size.z, 1e-3);
  // Depth matters: the far edge of the island needs clearing too, so half the
  // island's own footprint is added to each requirement.
  const halfDepth = span / 2;
  const distance = fitDistance(span / 2, Math.max(ctx.scene.size.y, 1e-3) / 2, halfDepth, vFov, aspect);
  // Portrait viewports lose horizontal room, so they need a little more distance
  // for the same subject.
  return distance * (aspect < 1 ? 1.1 : 1.03);
}

function establishing(ctx: ShotContext): CameraPose {
  const distance = sceneFitDistance(ctx);
  const target = { ...ctx.scene.centre };
  return {
    // About 22 degrees above the horizon: high enough to show the island's
    // surface and read it as a place, low enough that the characters stay the
    // subject rather than being looked down on like pieces on a board.
    position: orbitPosition(target, STAGE_BEARING, distance, target.y + distance * 0.38),
    target,
    fov: ctx.fov,
    near: Math.max(distance / 200, 0.01),
    far: distance * 20,
  };
}

/**
 * A step toward the cast, on the same bearing the stage opened on.
 *
 * Holding the bearing is the whole point: `approach` is the move that makes
 * arrival feel like walking up to a place rather than cutting to a different
 * one, and a bearing change during it would make it a different place.
 */
function approach(ctx: ShotContext): CameraPose {
  const full = sceneFitDistance(ctx);
  const distance = full * 0.62;
  const leadPoint = ctx.lead ? vec(ctx.lead.x, ctx.lead.y, ctx.lead.z) : null;
  const target = leadPoint ? mix(ctx.scene.centre, leadPoint, 0.6) : { ...ctx.scene.centre };
  return {
    position: orbitPosition(target, STAGE_BEARING, distance, target.y + distance * 0.22),
    target,
    fov: ctx.fov,
    near: Math.max(distance / 200, 0.01),
    far: full * 20,
  };
}

/**
 * How far a head-and-shoulders shot of THIS subject sits.
 *
 * A fraction of the character, never a fixed number of metres. A metre-based
 * framing was measured and looked far too tight, and the reason is anatomy:
 * these are cartoon proportions and Rho's head alone is 0.81 m, 47% of his
 * height. A 0.70 m tall frame that would be a comfortable head-and-shoulders on
 * a human cropped his skull and his chin at once.
 */
function closeupDistance(subject: ShotSubject, ctx: ShotContext): number {
  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const framedHeight = subject.height * 0.7;
  return (framedHeight / 2 / Math.tan(vFov / 2)) * (aspect < 1 ? 1.18 : 1.0) + 0.15;
}

function closeup(ctx: ShotContext): CameraPose {
  const lead = ctx.lead;
  // No cast yet means the placement solve has not landed. Framing the island is
  // the honest answer; framing the origin would aim at empty sky under the
  // island and read as a broken scene rather than a loading one.
  if (!lead) return establishing(ctx);

  const distance = closeupDistance(lead, ctx);
  const target = vec(lead.x, lead.y, lead.z);
  return {
    // Standing ON the facing vector puts the camera in FRONT of the character.
    // This is the single mistake this scene has already made once: "inward" and
    // "toward the viewer" are opposites when the camera is outside the island.
    position: vec(
      lead.x + Math.sin(lead.facing) * distance,
      lead.y + lead.height * 0.04,
      lead.z + Math.cos(lead.facing) * distance,
    ),
    target,
    fov: ctx.fov,
    near: 0.01,
    far: 100,
  };
}

/**
 * The wider close shot, for the characters whose performance is their body.
 *
 * Liruf and Dina have no mouth card (/TUTOR_3D.md §7.1), so a dead-on close-up
 * frames a painted, motionless mouth at full size. /ORACLE.md §2.2's primary
 * decision for them is to frame wider and keep more of the body in shot; the
 * stage shipped §2.2's FALLBACK instead ("never close the camera on them"),
 * which left them at the island shot where nothing about them is legible either.
 *
 * So: off the facing axis, further back, and aimed BETWEEN the head and the
 * hands rather than at the head. Hands are where gesture lives, and gesture is
 * what these two say things with.
 */
function closeupWide(ctx: ShotContext): CameraPose {
  const lead = ctx.lead;
  if (!lead) return establishing(ctx);

  const distance = closeupDistance(lead, ctx) * CLOSEUP_WIDE_DISTANCE;
  const yaw = lead.facing + CLOSEUP_WIDE_OFF_AXIS;
  // Drop the aim from mid-head toward the chest so both the face and the hands
  // are inside the frame rather than the face alone at the bottom of it.
  const aimY = lead.y - lead.height * 0.13;
  const target = vec(lead.x, aimY, lead.z);
  return {
    position: vec(lead.x + Math.sin(yaw) * distance, aimY + lead.height * 0.06, lead.z + Math.cos(yaw) * distance),
    target,
    fov: ctx.fov,
    near: 0.01,
    far: 100,
  };
}

/**
 * Both characters in one frame, for the moments that are about the pair.
 *
 * With one character on stage this degrades to `closeup-wide` rather than
 * failing: a two-shot of one person IS a wider single, and a frame built around
 * an absent second subject would sit half empty pointing at nothing.
 */
function twoShot(ctx: ShotContext): CameraPose {
  const { lead, companion } = ctx;
  if (!lead || !companion) return closeupWide(ctx);

  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const mid = vec((lead.x + companion.x) / 2, (lead.y + companion.y) / 2, (lead.z + companion.z) / 2);
  const separation = Math.hypot(companion.x - lead.x, companion.z - lead.z);
  const tallest = Math.max(lead.height, companion.height);

  /*
   * The pair's separation is used UNPROJECTED, which over-frames whenever the
   * pair happens to stand along the view axis. That is the safe direction to be
   * wrong in: an over-framed two-shot is a slightly loose two-shot, while an
   * under-framed one crops a character out of a frame whose entire purpose is
   * that both of them are in it.
   */
  const halfWidth = separation / 2 + tallest * 0.42;
  const halfHeight = tallest * 0.62;
  const distance = fitDistance(halfWidth, halfHeight, tallest * 0.3, vFov, aspect) * (aspect < 1 ? 1.18 : 1.06);

  // Stand where both are facing, so the camera is in front of the pair rather
  // than behind either of them. The solver already turns each a quarter of the
  // way toward the other, so their average facing is the frame they compose.
  const yaw = blendYaw(lead.facing, companion.facing, 0.5);
  return {
    position: vec(
      mid.x + Math.sin(yaw) * distance,
      mid.y + tallest * 0.06,
      mid.z + Math.cos(yaw) * distance,
    ),
    target: mid,
    fov: ctx.fov,
    near: 0.01,
    far: Math.max(distance * 20, 100),
  };
}

/**
 * Over the lead's shoulder, onto whatever they are attending to.
 *
 * With a companion that is the companion. Without one it is the space in front
 * of the lead — which is where a live segment happens, and the reason this shot
 * exists at all: during an exercise the learner's attention belongs on the work,
 * not on the tutor's face, and an over-shoulder says so with the camera instead
 * of with a layout change.
 */
function overShoulder(ctx: ShotContext): CameraPose {
  const lead = ctx.lead;
  if (!lead) return establishing(ctx);

  const subject = ctx.companion
    ? vec(ctx.companion.x, ctx.companion.y, ctx.companion.z)
    : vec(
        lead.x + Math.sin(lead.facing) * 1.8,
        lead.y - lead.height * 0.08,
        lead.z + Math.cos(lead.facing) * 1.8,
      );

  const dx = subject.x - lead.x;
  const dz = subject.z - lead.z;
  const length = Math.hypot(dx, dz);
  // A degenerate separation (the two solved onto nearly the same spot) would
  // divide by zero; the lead's own facing is the right answer there.
  const ux = length > 1e-3 ? dx / length : Math.sin(lead.facing);
  const uz = length > 1e-3 ? dz / length : Math.cos(lead.facing);

  // Perpendicular in the XZ plane, so the lead's shoulder sits in a corner of
  // the frame instead of dead centre blocking the subject.
  const px = uz;
  const pz = -ux;

  const behind = lead.height * 0.72;
  const lateral = lead.height * 0.34;
  return {
    position: vec(
      lead.x - ux * behind + px * lateral,
      lead.y + lead.height * 0.12,
      lead.z - uz * behind + pz * lateral,
    ),
    target: subject,
    fov: ctx.fov,
    near: 0.01,
    far: 100,
  };
}

const SHOTS: Readonly<Record<ShotId, (ctx: ShotContext) => CameraPose>> = Object.freeze({
  establishing,
  approach,
  closeup,
  'closeup-wide': closeupWide,
  'two-shot': twoShot,
  'over-shoulder': overShoulder,
});

/** Resolves a shot to the pose the camera should be travelling toward. */
export function poseFor(shot: ShotId, ctx: ShotContext): CameraPose {
  return SHOTS[shot](ctx);
}

/**
 * The legacy two-value framing the stage shipped with.
 *
 * Kept because `ConversationView` still speaks it and is owned by a later
 * increment. Mapping rather than deleting is what lets the camera system land
 * without a flag day across files this change does not touch.
 */
export type LegacyFraming = 'vignette' | 'conversation';

export function shotForLegacyFraming(framing: LegacyFraming): ShotId {
  return framing === 'conversation' ? 'closeup' : 'establishing';
}
