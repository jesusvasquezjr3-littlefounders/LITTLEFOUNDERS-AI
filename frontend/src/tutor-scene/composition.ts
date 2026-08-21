/*
 * Composing a full-bleed canvas around a HUD that covers part of it.
 *
 * THE PROBLEM. The stage is the page: the canvas runs edge to edge, and the
 * controls float on top of it. That is the whole design. But it means the
 * geometric centre of the canvas is NOT the centre of the space the learner can
 * actually see the character in — with a lesson plate inset from the
 * bottom-right at 1280 px, or a bottom sheet at 375 px, the free rectangle is
 * somewhere up and to the left of centre, and a character framed dead centre is
 * a character half behind a panel.
 *
 * The obvious fix is the wrong one. Shrinking the canvas to the free rectangle
 * reinstates exactly the letterboxed panel the owner rejected — it is the
 * rejected layout with extra steps, because the visible edge of the render is
 * what makes a stage read as a stage. So the canvas stays full-bleed and the
 * CAMERA moves instead: aim slightly away from the HUD, and the subject lands in
 * the free rectangle while the render still fills the screen.
 *
 * WHY NOT `camera.setViewOffset()`. It exists for precisely this and is the
 * documented alternative if the aim offset ever reads as a tilted horizon at
 * extreme insets. It was not chosen because every fit in `shots.ts` derives its
 * horizontal FOV from the full viewport aspect; a view offset changes the
 * effective projection without changing that aspect, so each fit would have to
 * be rewritten to agree with a sub-rectangle it cannot see. One arithmetic shift
 * at the aim is a smaller and more testable change than six fits that all have
 * to agree about a rectangle.
 *
 * PURE, like `shots.ts` and for the same reason: this is the arithmetic that
 * decides whether a character is behind a panel, and it should be answerable
 * without a browser.
 */

import type { ShotContext, Vec3 } from './shots';

/** A rectangle in CSS pixels, in the stage layer's own coordinate space. */
export interface HudRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How far the HUD intrudes from each edge, in CSS pixels. */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportPx {
  width: number;
  height: number;
}

export const NO_INSETS: Readonly<SafeAreaInsets> = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/**
 * The aim shift, in CAMERA-SPACE metres, plus how much further back a fitting
 * shot has to sit.
 */
export interface Composition {
  /** Metres to the camera's right. Positive pushes the subject LEFT on screen. */
  right: number;
  /** Metres up. Positive pushes the subject DOWN on screen. */
  up: number;
  /**
   * Multiplier on a fitting shot's distance, always >= 1. Applied only to shots
   * that fit a measured object; a close shot answers an inset by shifting, never
   * by retreating, so the character's on-screen height is identical with and
   * without a lesson plate.
   */
  padding: number;
}

export const NO_COMPOSITION: Readonly<Composition> = Object.freeze({ right: 0, up: 0, padding: 1 });

/**
 * The most the HUD is allowed to shrink the frame before we stop obeying it.
 *
 * A sheet dragged to its FULL detent covers 88% of a phone. Honouring that
 * literally would push the camera back until the island is a speck, which is a
 * worse answer than letting the sheet overlap a character the learner has
 * deliberately covered up. The clamp is what keeps an extreme, temporary gesture
 * from redefining the shot.
 */
const MIN_FREE_FRACTION = 0.42;

/** And the matching ceiling on how far back a fit may be pushed. */
const MAX_PADDING = 1.9;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Reduces measured HUD rectangles to per-edge insets.
 *
 * A rect is charged to the edge it is CHEAPEST to clear — the edge whose
 * intrusion depth is smallest. That rule is not arbitrary: a lesson plate inset
 * 24 px from the bottom-right of a 1280x800 stage intrudes 444 px from the right
 * and 524 px from the bottom, and the correct composition is to move the subject
 * LEFT, not to lift it 524 px. A full-width bottom sheet on a phone intrudes 375
 * px from the right and 365 px from the bottom, and the correct answer flips to
 * lifting. One rule produces both, which is why it is one rule and not a
 * per-component "which edge am I on" prop that would eventually disagree with
 * where the component actually rendered.
 */
export function insetsFromRects(rects: readonly HudRect[], viewport: ViewportPx): SafeAreaInsets {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return insets;
  if (viewport.width <= 0 || viewport.height <= 0) return insets;

  for (const rect of rects) {
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) continue;
    // A zero-sized rect is a component that is mounted but not laid out yet.
    // Charging it to an edge would publish an inset for something occupying no
    // space, and the camera would compose around a panel nobody can see.
    if (rect.width <= 0 || rect.height <= 0) continue;

    const fromLeft = clamp(rect.left + rect.width, 0, viewport.width);
    const fromRight = clamp(viewport.width - rect.left, 0, viewport.width);
    const fromTop = clamp(rect.top + rect.height, 0, viewport.height);
    const fromBottom = clamp(viewport.height - rect.top, 0, viewport.height);

    const cheapest = Math.min(fromLeft, fromRight, fromTop, fromBottom);
    if (cheapest <= 0) continue;

    if (cheapest === fromRight) insets.right = Math.max(insets.right, fromRight);
    else if (cheapest === fromBottom) insets.bottom = Math.max(insets.bottom, fromBottom);
    else if (cheapest === fromLeft) insets.left = Math.max(insets.left, fromLeft);
    else insets.top = Math.max(insets.top, fromTop);
  }

  return insets;
}

/**
 * The free rectangle's centre, as an offset from the viewport centre in CSS px.
 *
 * Screen coordinates: +x is right, +y is DOWN.
 */
export function freeCentreOffsetPx(insets: SafeAreaInsets, viewport: ViewportPx): { x: number; y: number } {
  const freeWidth = Math.max(viewport.width - insets.left - insets.right, viewport.width * MIN_FREE_FRACTION);
  const freeHeight = Math.max(viewport.height - insets.top - insets.bottom, viewport.height * MIN_FREE_FRACTION);

  /*
   * Recentre the CLAMPED rectangle rather than the raw one. When a sheet is
   * dragged past the clamp the free rectangle stops shrinking, and if the centre
   * kept moving anyway the subject would keep sliding out of a rectangle that
   * was no longer getting any smaller. Both halves have to obey the same clamp
   * or the composition drifts.
   */
  const leftEdge = clamp(insets.left, 0, Math.max(viewport.width - freeWidth, 0));
  const topEdge = clamp(insets.top, 0, Math.max(viewport.height - freeHeight, 0));

  return {
    x: leftEdge + freeWidth / 2 - viewport.width / 2,
    y: topEdge + freeHeight / 2 - viewport.height / 2,
  };
}

/**
 * Turns HUD insets into a camera-space aim shift in metres.
 *
 * `distance` is how far the camera is from what it is framing — metres per pixel
 * is a function of that distance, so the same 200 px plate shifts the aim much
 * further on an establishing shot than on a close-up, which is exactly right:
 * the plate covers the same pixels either way, and the world behind those pixels
 * is bigger when the camera is further away.
 *
 * Sign convention, because getting it backwards is silent and looks like a
 * tuning problem: moving the aim RIGHT pushes the subject LEFT on screen. A
 * plate on the right therefore produces a POSITIVE `right`.
 */
export function composeFor(
  insets: SafeAreaInsets,
  viewport: ViewportPx,
  distance: number,
  ctx: Pick<ShotContext, 'aspect' | 'fov'>,
): Composition {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return { ...NO_COMPOSITION };
  if (viewport.width <= 0 || viewport.height <= 0) return { ...NO_COMPOSITION };
  if (!Number.isFinite(distance) || distance <= 0) return { ...NO_COMPOSITION };

  const vFov = ((Number.isFinite(ctx.fov) && ctx.fov > 1 && ctx.fov < 179 ? ctx.fov : 36) * Math.PI) / 180;
  const worldHeight = 2 * distance * Math.tan(vFov / 2);
  const metresPerPx = worldHeight / viewport.height;

  const offset = freeCentreOffsetPx(insets, viewport);

  const freeWidth = Math.max(viewport.width - insets.left - insets.right, viewport.width * MIN_FREE_FRACTION);
  const freeHeight = Math.max(viewport.height - insets.top - insets.bottom, viewport.height * MIN_FREE_FRACTION);
  const padding = clamp(
    Math.max(viewport.width / freeWidth, viewport.height / freeHeight),
    1,
    MAX_PADDING,
  );

  return {
    right: -offset.x * metresPerPx,
    up: offset.y * metresPerPx,
    padding,
  };
}

/**
 * Applies a composition to a pose's target and position together.
 *
 * BOTH have to move, and by the same amount. Shifting only the target would
 * swing the camera round the subject like a pan, changing the angle it is seen
 * from; shifting both is a TRUCK, which changes where the subject sits in frame
 * and nothing else. The distinction is the difference between "the character
 * moved out from behind the panel" and "the character turned".
 *
 * Returns new vectors rather than mutating, so a caller can hold the raw pose
 * and recompose it every frame as a sheet is dragged.
 */
export function applyComposition(
  position: Vec3,
  target: Vec3,
  composition: Composition,
): { position: Vec3; target: Vec3 } {
  const fx = target.x - position.x;
  const fy = target.y - position.y;
  const fz = target.z - position.z;
  const length = Math.hypot(fx, fy, fz);
  if (!(length > 1e-6)) return { position: { ...position }, target: { ...target } };

  /*
   * Camera right = normalize(forward × worldUp) = (-fz, 0, fx).
   *
   * Worth writing out, because the opposite sign is plausible enough to survive
   * review and its consequence is the exact bug this module exists to prevent: a
   * negated right vector answers a plate on the right by trucking the camera
   * left, which pushes the character FURTHER behind the plate. Nothing about
   * that reads as a sign error; it reads as a composition that does not work.
   * Degenerate only when the camera looks straight down, which no shot does.
   */
  const rx = -fz;
  const rz = fx;
  const rLength = Math.hypot(rx, rz);
  const ux = rLength > 1e-6 ? rx / rLength : 1;
  const uz = rLength > 1e-6 ? rz / rLength : 0;

  const dx = ux * composition.right;
  const dz = uz * composition.right;
  const dy = composition.up;

  return {
    position: { x: position.x + dx, y: position.y + dy, z: position.z + dz },
    target: { x: target.x + dx, y: target.y + dy, z: target.z + dz },
  };
}

/**
 * Pushes a fitting shot back so the subject still fits the FREE rectangle.
 *
 * Applied only where `SHOT_FITS_SCENE` says the shot has a size requirement.
 * Everything else keeps its distance exactly, which is the rule that keeps a
 * character the same on-screen height whether or not a lesson plate is open.
 */
export function padDistance(position: Vec3, target: Vec3, padding: number): Vec3 {
  if (!Number.isFinite(padding) || padding <= 1) return { ...position };
  return {
    x: target.x + (position.x - target.x) * padding,
    y: target.y + (position.y - target.y) * padding,
    z: target.z + (position.z - target.z) * padding,
  };
}

/** Re-exposed so tests and the director agree about the horizontal FOV helper. */
export { horizontalFov } from './shots';
