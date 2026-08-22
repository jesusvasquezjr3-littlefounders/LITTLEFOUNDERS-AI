import type { HudRect, ViewportPx } from './composition';
import { clampIntoView, type ViewportBox } from './culling';

/*
 * WHAT SPACE THE HUD HAS ALREADY TAKEN — the one idea the two halves of the
 * Tutor's chrome did not share, and the reason they kept landing on each other.
 *
 * THE STRUCTURAL BUG. The route paints two kinds of surface over one canvas.
 * VIEWPORT-anchored chrome is laid out by CSS against the window: the way out
 * at the top-left, the microphone dock at the bottom, the lesson plate. WORLD-
 * anchored chrome is laid out by the CAMERA: the speech caption rides the
 * speaker's crown, the offer chips ride their chest. Neither layout system can
 * see the other, so nothing anywhere decided who owned a given pixel — and at
 * 375 px the greeting caption and the way-out chip both claimed the top-left
 * corner. Measured on a live stage: caption (54, 31, 266, 68) against chip
 * (16, 16, 155, 44), a 116x29 overlap, on three of three fresh mounts. The
 * learner read "…Rho. What would you like to look at together today?" with
 * "Hi Robi! I'm Dr." underneath the word "Leave".
 *
 * It was never going to be fixed by a constant. The caption rides a projected
 * point, so the collision appears and disappears with the camera: any offset
 * tuned at one shot is wrong at the next.
 *
 * SO THE TWO SIDES SHARE A REGISTRY AND THIS FILE IS THE ARITHMETIC OVER IT.
 * `SafeAreaContext` publishes every viewport-anchored surface's rect;
 * `ScreenAnchor`'s projector asks `escapeReserved` where a world-anchored node
 * may stand instead; `WorldChip` asks `rectsOverlap` whether it has been painted
 * over. One vocabulary, three consumers.
 *
 * PURE, and imports only two type names — like `culling.ts` and `composition.ts`
 * and for the same reason. The projector that calls this runs inside `useFrame`,
 * which no test in this repo can step through, so the only way the rule gets
 * checked is by living outside the frame loop.
 */

/** A measured surface with a name, so a collision report can say WHICH two. */
export interface NamedRect {
  name: string;
  rect: HudRect;
}

/** How far a node has to move, in CSS pixels, to stop overlapping. */
export interface Displacement {
  dx: number;
  dy: number;
}

export const NO_DISPLACEMENT: Readonly<Displacement> = Object.freeze({ dx: 0, dy: 0 });

/**
 * Overlap this small is a rounding artefact, not a collision.
 *
 * Two surfaces that share an edge — a plate resting exactly on the dock's top
 * line — differ by fractions of a pixel between frames as the camera breathes.
 * Without the tolerance a node flips between escaping and resting on alternate
 * frames, which reads far worse than either state. The same number and the same
 * reason as `WorldChip`'s occlusion test.
 */
export const HUD_TOUCH_TOLERANCE_PX = 1;

/**
 * The breathing room left between two HUD surfaces that have been separated.
 *
 * Small on purpose. This is not `hud-inset` (the gap between chrome and the
 * screen edge, 16/24 px); it is the smallest gap that still reads as two
 * surfaces rather than one, and it is the same eight pixels the caption already
 * left between its tail and the character's hair.
 */
export const HUD_SURFACE_GAP_PX = 8;

/**
 * The most a world-anchored node may be pushed before we stop pushing, as a
 * fraction of the viewport's SHORTER side.
 *
 * A node moved far enough stops pointing at the thing it names, and a caption
 * hovering over the sea beside the speaker is a worse answer than one that
 * overlaps a chip by a few pixels. A quarter of the short side is 93 px on a
 * 375x812 phone: enough to clear a corner chip or a dock edge, nowhere near
 * enough to cross the frame.
 */
const ESCAPE_BUDGET_FRACTION = 0.25;

/** Sub-pixel slack, so a node resting exactly on the frame edge still fits. */
const EDGE_EPSILON_PX = 0.5;

/** True when two rectangles claim more than a rounding error of the same pixels. */
export function rectsOverlap(a: HudRect, b: HudRect, tolerance = HUD_TOUCH_TOLERANCE_PX): boolean {
  const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  if (!(overlapX > tolerance)) return false;
  const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return overlapY > tolerance;
}

/**
 * Every pair of surfaces in this set that are sitting on each other.
 *
 * ANY intersection counts, not a majority — the same rule `culling.ts` settled
 * on for the frame edge, and for the same reason. "Half of the goodbye plate
 * peeking out from under a disabled microphone" is exactly the state the owner
 * reported, and a majority rule would have called it fine.
 *
 * Zero-sized surfaces are skipped: a component that is mounted but not laid out
 * yet has no pixels to fight over, and charging it with a collision would report
 * a bug that is one frame old and already gone.
 */
export function overlappingPairs(
  surfaces: readonly NamedRect[],
  tolerance = HUD_TOUCH_TOLERANCE_PX,
): Array<readonly [string, string]> {
  const collisions: Array<readonly [string, string]> = [];
  for (let i = 0; i < surfaces.length; i += 1) {
    const a = surfaces[i];
    if (!a || a.rect.width <= 0 || a.rect.height <= 0) continue;
    for (let j = i + 1; j < surfaces.length; j += 1) {
      const b = surfaces[j];
      if (!b || b.rect.width <= 0 || b.rect.height <= 0) continue;
      if (rectsOverlap(a.rect, b.rect, tolerance)) collisions.push([a.name, b.name] as const);
    }
  }
  return collisions;
}

export interface EscapeOptions {
  /** Breathing room to leave once clear. Defaults to `HUD_SURFACE_GAP_PX`. */
  gap?: number;
  /** Furthest the node may be moved. Defaults to a quarter of the short side. */
  budget?: number;
}

/**
 * The shortest move that takes `box` out from under every reserved surface,
 * without leaving the frame and without travelling further than the budget.
 *
 * FOUR WAYS OUT, CHEAPEST FIRST, and the cheapest is genuinely the right one
 * here rather than merely the easy one: the node is attached to a point in the
 * world, so every pixel of displacement is a pixel of "this label belongs to
 * that character" spent. At 375 px the escape from the way-out chip is 22 px to
 * the right, which nobody will ever notice; the alternative — 37 px straight
 * down — would have laid the greeting across Dr. Rho's forehead.
 *
 * IT REFUSES RATHER THAN HALF-ESCAPING. If no direction both clears the blocker
 * and stays inside the frame within the budget, the answer is zero. A node moved
 * most of the way out is the worst of the three available outcomes: still
 * covered, and no longer pointing at anything. The caller then falls back to
 * whatever it does about occlusion — `WorldChip` hides itself, and the caption,
 * which may never hide because it is the deaf learner's whole channel
 * (/ORACLE.md §1 step 4), stays where it is and stays readable.
 */
export function escapeReserved(
  box: HudRect,
  reserved: readonly HudRect[],
  viewport: ViewportPx,
  options: EscapeOptions = {},
): Displacement {
  if (!(box.width > 0) || !(box.height > 0)) return NO_DISPLACEMENT;

  const blockers = reserved.filter((rect) => rect.width > 0 && rect.height > 0);
  if (blockers.length === 0) return NO_DISPLACEMENT;
  if (!blockers.some((rect) => rectsOverlap(box, rect))) return NO_DISPLACEMENT;

  const gap = options.gap ?? HUD_SURFACE_GAP_PX;
  const budget = options.budget ?? ESCAPE_BUDGET_FRACTION * Math.min(viewport.width, viewport.height);

  /*
   * EVERY SURFACE AT ONCE, NOT ONE AT A TIME.
   *
   * The first version of this walked the blockers, escaping whichever it was
   * currently under. It oscillated, and provably so: clearing surface A can put
   * the node on surface B, whose own cheapest escape is straight back onto A, at
   * a cost of zero. Sixty frames a second of that is a caption vibrating between
   * two wrong places.
   *
   * So the candidates are enumerated as a small lattice — every x-escape from
   * every surface (and no x-move at all) crossed with every y-escape — and the
   * cheapest combination that clears ALL of them wins. `HUD_CHROME_SLOTS` is
   * closed at four, so this is at most 81 combinations of trivial arithmetic,
   * evaluated for the one node on the route that opts into it.
   */
  const xs: number[] = [0];
  const ys: number[] = [0];
  for (const blocker of blockers) {
    xs.push(blocker.left - gap - box.left - box.width);
    xs.push(blocker.left + blocker.width + gap - box.left);
    ys.push(blocker.top - gap - box.top - box.height);
    ys.push(blocker.top + blocker.height + gap - box.top);
  }

  let best: Displacement | null = null;
  let bestCost = Infinity;

  for (const dx of xs) {
    for (const dy of ys) {
      const cost = Math.hypot(dx, dy);
      // `>=` keeps the FIRST candidate at a given cost, and the lattice is built
      // in a fixed order, so the answer does not depend on Map iteration order
      // upstream. A node that jitters between two equally good places is the bug
      // this whole function exists to remove.
      if (cost > budget || cost >= bestCost) continue;
      const moved = shift(box, dx, dy);
      if (blockers.some((rect) => rectsOverlap(moved, rect))) continue;
      if (!staysInFrame(box, { dx, dy }, viewport)) continue;
      best = { dx, dy };
      bestCost = cost;
    }
  }

  return best ?? NO_DISPLACEMENT;
}

function shift(box: HudRect, dx: number, dy: number): HudRect {
  return { left: box.left + dx, top: box.top + dy, width: box.width, height: box.height };
}

/**
 * True when the displaced box is still wholly on screen.
 *
 * A box already WIDER (or taller) than the viewport can never satisfy that on
 * the axis it overflows, and refusing every candidate on those grounds would
 * leave a three-line pt-BR caption permanently under the chip it was supposed to
 * escape. So the constraint is dropped on any axis the node cannot fit anyway —
 * the same fallback, and the same reasoning, as `culling.ts`'s `fitsOnAxis`.
 */
function staysInFrame(box: HudRect, move: Displacement, viewport: ViewportPx): boolean {
  const left = box.left + move.dx;
  const top = box.top + move.dy;
  if (viewport.width > 0 && box.width <= viewport.width) {
    if (left < -EDGE_EPSILON_PX || left + box.width > viewport.width + EDGE_EPSILON_PX) return false;
  }
  if (viewport.height > 0 && box.height <= viewport.height) {
    if (top < -EDGE_EPSILON_PX || top + box.height > viewport.height + EDGE_EPSILON_PX) return false;
  }
  return true;
}

/**
 * Park a node that has left the picture back against the frame, and then get it
 * out from under the fixed chrome AGAIN.
 *
 * THE ORDER IS THE WHOLE FUNCTION, and it is here rather than inline in
 * `ScreenAnchor` because the frame loop runs inside `useFrame`, which no test in
 * this repo can step through — so an ordering rule written there is a rule
 * nothing checks.
 *
 * The projector escapes the chrome first, on the position the camera asked for.
 * For the speech caption at a CLOSE-UP that position is off the top of the frame
 * entirely: the speaker's crown is above the viewport, the plate hangs at around
 * y = -200, it overlaps nothing, and the escape correctly does nothing. The
 * clamp then slides it back to a gap below the top edge — which is exactly where
 * the way out is standing — and for as long as nothing looked again, that was a
 * shipped collision.
 *
 * Measured on `/dev/tutor-lab` at 375x812 in `conversing`, with the ambient
 * orbit stopped, which is what a reduced-motion learner sees permanently: the
 * caption landed at (55, 8, 265, 112) against a way out at (16, 16, 48, 48).
 * /DESIGN.md → Screen Recipes → Tutor forbids that outright and names this very
 * pair among the three collisions it was written to close; a moving camera had
 * been hiding it, because at most bearings the crown projects far enough right
 * that the plate clears the chip on its own.
 *
 * Escaping SECOND cannot undo the clamp: `escapeReserved` refuses any candidate
 * that leaves the frame, so all it can do is slide the node along the edge it
 * was just parked against — 9 px to the right, in the case above.
 *
 * @param frame the box to clamp INTO, already inset by whatever gap the node
 *   should keep off the edge.
 * @param viewport the full viewport, which is what "still on screen" means to
 *   the escape.
 * @param reserved fixed chrome to clear; pass none for a node that does not
 *   avoid chrome, and the clamp happens on its own.
 */
export function clampThenEscape(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  frame: ViewportBox,
  viewport: ViewportPx,
  reserved: readonly HudRect[],
  options: EscapeOptions = {},
): { x: number; y: number } {
  const clamped = clampIntoView(x, y, halfWidth, halfHeight, frame);
  if (reserved.length === 0 || !(halfWidth > 0) || !(halfHeight > 0)) return clamped;
  const move = escapeReserved(
    {
      left: clamped.x - halfWidth,
      top: clamped.y - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    },
    reserved,
    viewport,
    options,
  );
  return { x: clamped.x + move.dx, y: clamped.y + move.dy };
}

