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

/**
 * How much of the half-frame is kept as breathing room when the aim is clamped
 * to keep a subject on screen.
 *
 * A crown exactly on the top edge of the viewport is cropped as far as a learner
 * is concerned — the silhouette touches the bezel and reads as cut off. Six per
 * cent of the half-frame is about 24 px on a 812 px phone at a close shot, which
 * is the smallest gap that still reads as headroom.
 */
const FRAME_MARGIN = 0.06;

/**
 * How close two HUD surfaces have to be before they are treated as one.
 *
 * `hud-inset`, the widest gap the design ever leaves between a plate and what it
 * sits against. See `mergeRects` for why touching surfaces must be reduced
 * together.
 */
const MERGE_GAP_PX = 24;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Unions HUD rectangles that touch, before any of them is charged to an edge.
 *
 * TWO SURFACES THAT TOUCH ARE ONE SURFACE, as far as a camera is concerned, and
 * reducing them separately produces an answer that is wrong about both. The case
 * that forced this is the ordinary conversing phase at 375 px: the sheet sits at
 * the bottom and the microphone dock rides 12 px above it, so the dock alone is
 * a full-width band FLOATING in the middle of the screen with more room below it
 * than above. Charged on its own it is cheapest to clear from the TOP — which is
 * arithmetically true and physically absurd, because the room it points at is
 * the room the sheet is standing in. The camera would have pushed the character
 * DOWN, into the sheet, to clear the microphone.
 *
 * Merged first, the dock and the sheet are one 577 px mass anchored to the
 * bottom edge, and the answer is the obvious one. Nothing here is quadratic in
 * anything that matters: `SafeAreaSlot` is closed at three.
 */
function mergeRects(rects: readonly HudRect[]): HudRect[] {
  const merged: HudRect[] = [];

  for (const rect of rects) {
    let candidate = rect;
    // Restart after every union: absorbing one rect can bring the group within
    // touching distance of another it did not previously reach.
    let absorbed = true;
    while (absorbed) {
      absorbed = false;
      for (let i = merged.length - 1; i >= 0; i -= 1) {
        const other = merged[i];
        if (!other || !touches(candidate, other)) continue;
        merged.splice(i, 1);
        candidate = union(candidate, other);
        absorbed = true;
      }
    }
    merged.push(candidate);
  }

  return merged;
}

/** True when the two rectangles overlap or sit within `MERGE_GAP_PX` of each other. */
function touches(a: HudRect, b: HudRect): boolean {
  return (
    a.left <= b.left + b.width + MERGE_GAP_PX &&
    b.left <= a.left + a.width + MERGE_GAP_PX &&
    a.top <= b.top + b.height + MERGE_GAP_PX &&
    b.top <= a.top + a.height + MERGE_GAP_PX
  );
}

function union(a: HudRect, b: HudRect): HudRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
  };
}

/**
 * Reduces measured HUD rectangles to per-edge insets.
 *
 * A rect is charged to the edge it is CHEAPEST to clear, and "cheapest" is the
 * intrusion measured as a FRACTION OF THE AXIS IT EATS INTO — never as a raw
 * pixel count. A lesson plate inset 24 px from the bottom-right of a 1280x800
 * stage takes 35% of the width from the right and 65% of the height from the
 * bottom, so it is charged to the right and the subject moves LEFT. A bottom
 * sheet on a 375x812 phone takes 96% of the width and 47% of the height, so it
 * is charged to the bottom and the subject rides ABOVE it. One rule, both
 * answers, and no per-component "which edge am I on" prop that would eventually
 * disagree with where the component actually rendered.
 *
 * COMPARING RAW PIXELS IS THE BUG THIS REPLACED, and it only showed itself in
 * portrait, which is exactly the view the owner rejected. The real mobile sheet
 * is inset 16 px on all three sides (`hud-inset-mobile`), so it measures 343x365
 * at left 16, top 431: 359 px from the right, 381 px from the bottom. Raw pixels
 * make the RIGHT edge cheaper by 22 px, so the solver charged 96% of a phone's
 * width to a surface that is not on the right at all — it then trucked the
 * camera a third of a screen sideways AND, on a fitting shot, pulled it back by
 * the full 1.9x padding ceiling. That is the "island became a sliver" report,
 * produced by the composition solver rather than by the layout. The unit test
 * missed it because its fixture was a sheet flush to the bottom edge with no
 * inset, which is the one geometry where raw pixels happen to give the right
 * answer.
 */
export function insetsFromRects(rects: readonly HudRect[], viewport: ViewportPx): SafeAreaInsets {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return insets;
  if (viewport.width <= 0 || viewport.height <= 0) return insets;

  const usable = rects.filter((rect) => {
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return false;
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return false;
    // A zero-sized rect is a component that is mounted but not laid out yet.
    // Charging it to an edge would publish an inset for something occupying no
    // space, and the camera would compose around a panel nobody can see.
    return rect.width > 0 && rect.height > 0;
  });

  for (const rect of mergeRects(usable)) {
    const fromLeft = clamp(rect.left + rect.width, 0, viewport.width);
    const fromRight = clamp(viewport.width - rect.left, 0, viewport.width);
    const fromTop = clamp(rect.top + rect.height, 0, viewport.height);
    const fromBottom = clamp(viewport.height - rect.top, 0, viewport.height);

    const costLeft = fromLeft / viewport.width;
    const costRight = fromRight / viewport.width;
    const costTop = fromTop / viewport.height;
    const costBottom = fromBottom / viewport.height;

    const cheapest = Math.min(costLeft, costRight, costTop, costBottom);
    if (!(cheapest > 0)) continue;

    if (cheapest === costRight) insets.right = Math.max(insets.right, fromRight);
    else if (cheapest === costBottom) insets.bottom = Math.max(insets.bottom, fromBottom);
    else if (cheapest === costLeft) insets.left = Math.max(insets.left, fromLeft);
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
  /**
   * Metres about the target that MUST stay inside the frame — the pose's own
   * `keepInFrame`.
   *
   * Without it the solver is free to shift the aim as far as the free rectangle
   * asks, and on a phone that is far enough to push the top of a character's
   * head off the top of the screen: at 375x812 with the lesson sheet at HALF the
   * HUD claims 73% of the height, the clamped free rectangle recentres 235 px
   * up, and a close-up crops the crown. Composition exists to get the character
   * OUT from behind the panel, so a composition that decapitates them has failed
   * at its own job rather than traded one problem for another.
   *
   * Zero means "nothing to protect" and is the right answer for the fitting
   * shots, which answer an inset by RETREATING (`padding`) instead of by
   * shifting, and so cannot crop what they have already made room for.
   */
  keepInFrame = 0,
): Composition {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return { ...NO_COMPOSITION };
  if (viewport.width <= 0 || viewport.height <= 0) return { ...NO_COMPOSITION };
  if (!Number.isFinite(distance) || distance <= 0) return { ...NO_COMPOSITION };

  const vFov = ((Number.isFinite(ctx.fov) && ctx.fov > 1 && ctx.fov < 179 ? ctx.fov : 36) * Math.PI) / 180;
  const aspect = Number.isFinite(ctx.aspect) && ctx.aspect > 0 ? ctx.aspect : 1;
  const worldHeight = 2 * distance * Math.tan(vFov / 2);
  const worldWidth = worldHeight * aspect;
  const metresPerPx = worldHeight / viewport.height;

  const offset = freeCentreOffsetPx(insets, viewport);

  const freeWidth = Math.max(viewport.width - insets.left - insets.right, viewport.width * MIN_FREE_FRACTION);
  const freeHeight = Math.max(viewport.height - insets.top - insets.bottom, viewport.height * MIN_FREE_FRACTION);
  const padding = clamp(
    Math.max(viewport.width / freeWidth, viewport.height / freeHeight),
    1,
    MAX_PADDING,
  );

  /*
   * The most the aim may travel on each axis before the protected radius
   * touches an edge. Negative room means the subject already overflows the
   * frame — a very tight close-up — and the honest answer there is to shift by
   * nothing at all rather than to pick which side to crop.
   */
  const keep = Number.isFinite(keepInFrame) && keepInFrame > 0 ? keepInFrame : 0;
  const roomUp = Math.max((worldHeight / 2) * (1 - FRAME_MARGIN) - keep, 0);
  const roomRight = Math.max((worldWidth / 2) * (1 - FRAME_MARGIN) - keep, 0);

  return {
    right: clamp(-offset.x * metresPerPx, -roomRight, roomRight),
    up: clamp(offset.y * metresPerPx, -roomUp, roomUp),
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
