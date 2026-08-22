import { describe, expect, it } from 'vitest';
import {
  applyComposition,
  composeFor,
  freeCentreOffsetPx,
  insetsFromRects,
  NO_INSETS,
  padDistance,
  type HudRect,
} from './composition';

/*
 * This is the arithmetic that decides whether a character is behind a panel.
 *
 * The two viewports below are the ones §1.11 makes non-negotiable, and the HUD
 * rectangles are the ones the design actually specifies: at 1280 px a floating
 * lesson plate 420 px wide inset 24 px from the bottom-right, and at 375 px a
 * bottom sheet at its HALF detent. If the sign of an offset is wrong, the camera
 * moves the character further BEHIND the panel, which looks like a tuning
 * problem and is not one.
 */

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };

/** The floating lesson plate: 420 wide, ~460 tall, inset 24 from bottom-right. */
const LESSON_PLATE: HudRect = { left: 1280 - 24 - 420, top: 800 - 24 - 460, width: 420, height: 460 };
/**
 * The bottom sheet at HALF, AS IT ACTUALLY RENDERS.
 *
 * `LessonPlate` is `inset-x-0 bottom-4 mx-auto` at `calc(100vw - 2rem)`, so it
 * is inset 16 px on the left, the right and the bottom — `hud-inset-mobile`,
 * because a slab welded to the edge of the screen is the silhouette this route
 * exists to remove. The fixture used to be a full-bleed sheet flush to the
 * bottom, which is the one geometry where the old raw-pixel edge rule happened
 * to give the right answer, and it is why the portrait bug shipped green.
 */
const SHEET: HudRect = { left: 16, top: 812 - 16 - 365, width: 375 - 32, height: 365 };

const LENS = { aspect: DESKTOP.width / DESKTOP.height, fov: 36 };

describe('insetsFromRects', () => {
  it('reports nothing when no HUD is mounted', () => {
    expect(insetsFromRects([], DESKTOP)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('charges the desktop lesson plate to the RIGHT edge', () => {
    /*
     * It intrudes 444 px from the right and 524 px from the bottom, and the
     * correct composition is to move the subject left rather than lift it 524
     * px. The rule is "cheapest edge to clear", which produces that answer here
     * and the opposite answer for the sheet below, from one rule.
     */
    const insets = insetsFromRects([LESSON_PLATE], DESKTOP);
    expect(insets.right).toBe(444);
    expect(insets.bottom).toBe(0);
    expect(insets.left).toBe(0);
    expect(insets.top).toBe(0);
  });

  it('charges the mobile sheet to the BOTTOM edge', () => {
    /*
     * THE PORTRAIT REGRESSION, and the whole reason the rule compares fractions
     * of an axis rather than pixels. The real sheet is 359 px from the right and
     * 381 px from the bottom, so raw pixels called the RIGHT edge cheaper by 22
     * px and charged 96% of a phone's width to a surface that is not on the
     * right at all. Downstream that is a third-of-a-screen sideways truck plus
     * the full 1.9x pull-back on any fitting shot: the reported "the island is a
     * sliver in portrait", produced by the camera rather than by the layout.
     */
    const insets = insetsFromRects([SHEET], MOBILE);
    expect(insets.bottom).toBe(365 + 16);
    expect(insets.right).toBe(0);
    expect(insets.left).toBe(0);
    expect(insets.top).toBe(0);
  });

  it('charges a full-bleed sheet to the BOTTOM edge as well', () => {
    // The same surface with no inset. Both geometries have to reach the same
    // answer, or the rule is a description of one fixture.
    const flush: HudRect = { left: 0, top: 812 - 365, width: 375, height: 365 };
    expect(insetsFromRects([flush], MOBILE).bottom).toBe(365);
    expect(insetsFromRects([flush], MOBILE).right).toBe(0);
  });

  it('charges the mic dock to the BOTTOM edge at both breakpoints', () => {
    /*
     * `StageShell`'s dock is `inset-x-0 mx-auto max-w-[min(30rem,92vw)]`, so it
     * is centred and near-full-width on a phone — the same shape that fooled the
     * old rule.
     */
    const phoneDock: HudRect = { left: 15, top: 812 - 12 - 180, width: 345, height: 180 };
    expect(insetsFromRects([phoneDock], MOBILE).bottom).toBe(192);
    expect(insetsFromRects([phoneDock], MOBILE).right).toBe(0);

    const deskDock: HudRect = { left: 400, top: 800 - 24 - 164, width: 480, height: 164 };
    expect(insetsFromRects([deskDock], DESKTOP).bottom).toBe(188);
    expect(insetsFromRects([deskDock], DESKTOP).right).toBe(0);
  });

  it('treats the sheet and the dock riding above it as one bottom mass', () => {
    /*
     * The ordinary conversing phase at 375 px. On its own the dock is a
     * full-width band floating in the middle of the screen with MORE room below
     * it than above, so charged separately it is cheapest to clear from the top
     * — and the camera would push the character down into the sheet to clear the
     * microphone. Two surfaces 12 px apart are one surface.
     */
    const dockAboveSheet: HudRect = { left: 15, top: 812 - 381 - 12 - 200, width: 345, height: 200 };
    const insets = insetsFromRects([SHEET, dockAboveSheet], MOBILE);
    expect(insets.bottom).toBe(812 - (812 - 381 - 12 - 200));
    expect(insets.top).toBe(0);
    expect(insets.right).toBe(0);
  });

  it('keeps the desktop corner plate and the dock beside it apart', () => {
    /*
     * The same phase at 1280 px, where the dock moves into the free width to the
     * LEFT of the plate. They are 196 px apart, so merging them would invent one
     * surface spanning the whole width and answer with a lift where the design
     * is a corner plate and a shift.
     */
    const dockBeside: HudRect = { left: 160, top: 800 - 24 - 164, width: 480, height: 164 };
    const insets = insetsFromRects([LESSON_PLATE, dockBeside], DESKTOP);
    expect(insets.right).toBe(444);
    expect(insets.bottom).toBe(188);
    expect(insets.top).toBe(0);
  });

  it('ignores a mounted-but-unlaid-out rect', () => {
    // A zero-sized rect is a component that exists and occupies nothing. Charging
    // it to an edge would compose the camera around a panel nobody can see.
    expect(insetsFromRects([{ left: 0, top: 0, width: 0, height: 0 }], DESKTOP)).toEqual(NO_INSETS);
  });

  it('keeps the deepest intrusion when two surfaces share an edge', () => {
    const smaller: HudRect = { left: 1280 - 200, top: 400, width: 200, height: 120 };
    const insets = insetsFromRects([smaller, LESSON_PLATE], DESKTOP);
    expect(insets.right).toBe(444);
  });

  it('reports nothing for a viewport that has not been measured yet', () => {
    // Distinguishable from "no HUD": both are zero, but a zero viewport must not
    // divide anything downstream.
    expect(insetsFromRects([LESSON_PLATE], { width: 0, height: 0 })).toEqual(NO_INSETS);
  });
});

describe('freeCentreOffsetPx', () => {
  it('is the viewport centre when nothing intrudes', () => {
    expect(freeCentreOffsetPx(NO_INSETS, DESKTOP)).toEqual({ x: 0, y: 0 });
  });

  it('moves left of centre when a plate sits on the right', () => {
    const offset = freeCentreOffsetPx({ ...NO_INSETS, right: 444 }, DESKTOP);
    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBe(0);
  });

  it('moves above centre when a sheet sits at the bottom', () => {
    const offset = freeCentreOffsetPx({ ...NO_INSETS, bottom: 365 }, MOBILE);
    expect(offset.y).toBeLessThan(0);
  });

  it('stops moving once the free rectangle hits its floor', () => {
    /*
     * A sheet dragged to FULL covers 88% of a phone. Obeying that literally would
     * push the camera back until the island is a speck; the clamp is what keeps
     * an extreme, temporary gesture from redefining the shot. Both the size and
     * the centre have to obey the same clamp or the composition drifts.
     */
    const half = freeCentreOffsetPx({ ...NO_INSETS, bottom: MOBILE.height * 0.7 }, MOBILE);
    const full = freeCentreOffsetPx({ ...NO_INSETS, bottom: MOBILE.height * 0.88 }, MOBILE);
    expect(full.y).toBe(half.y);
  });
});

describe('composeFor', () => {
  it('does nothing at all with no HUD', () => {
    // Compared numerically rather than structurally: a negated zero is still
    // zero, and `toEqual` distinguishes them where the arithmetic cannot.
    const composition = composeFor(NO_INSETS, DESKTOP, 4, LENS);
    expect(composition.right).toBeCloseTo(0, 12);
    expect(composition.up).toBeCloseTo(0, 12);
    expect(composition.padding).toBe(1);
  });

  it('aims RIGHT for a plate on the right, so the subject moves LEFT', () => {
    // The sign that matters. Getting it backwards moves the character further
    // behind the panel and reads as a tuning problem.
    const composition = composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, 4, LENS);
    expect(composition.right).toBeGreaterThan(0);
  });

  it('aims DOWN for a sheet at the bottom, so the subject rides above it', () => {
    const composition = composeFor({ ...NO_INSETS, bottom: 365 }, MOBILE, 4, {
      aspect: MOBILE.width / MOBILE.height,
      fov: 36,
    });
    expect(composition.up).toBeLessThan(0);
  });

  it('scales the shift with distance, because a pixel covers more world further away', () => {
    const near = composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, 3, LENS);
    const far = composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, 6, LENS);
    expect(far.right).toBeCloseTo(near.right * 2, 6);
  });

  it('never asks a shot to move closer', () => {
    expect(composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, 4, LENS).padding).toBeGreaterThanOrEqual(1);
  });

  it('caps how far back a fit may be pushed', () => {
    const composition = composeFor({ ...NO_INSETS, bottom: MOBILE.height * 0.95 }, MOBILE, 12, LENS);
    expect(composition.padding).toBeLessThanOrEqual(1.9);
  });

  it('never shifts so far that the protected radius leaves the frame', () => {
    /*
     * The decapitation guard. At 375x812 with the sheet at HALF and the dock
     * riding above it the HUD claims about 73% of the height, and the clamped
     * free rectangle asks for a 235 px lift — more than the 200 px from a
     * close-up's aim to the top of Rho's head. Composition exists to get the
     * character out from behind the panel; a composition that lifts the crown
     * off the top of the screen has failed at its own job.
     */
    const lens = { aspect: MOBILE.width / MOBILE.height, fov: 36 };
    const insets = { ...NO_INSETS, bottom: 593 };
    // A close-up of a 1.70 m character in portrait: the frame is 1.958 m tall.
    const distance = 1.958 / 2 / Math.tan((36 * Math.PI) / 180 / 2);
    const keep = 1.7 * 0.28;

    const free = composeFor(insets, MOBILE, distance, lens);
    const clamped = composeFor(insets, MOBILE, distance, lens, keep);

    expect(Math.abs(clamped.up)).toBeLessThan(Math.abs(free.up));
    // The crown stays inside the viewport with room to spare, which is the
    // assertion that actually matters.
    expect(Math.abs(clamped.up) + keep).toBeLessThan(1.958 / 2);
  });

  it('leaves a shift alone when the subject already fits with room around it', () => {
    // The introducing phase: only the dock is mounted, so the lift is small and
    // the clamp must not quietly become a second tuning knob.
    const lens = { aspect: MOBILE.width / MOBILE.height, fov: 36 };
    const insets = { ...NO_INSETS, bottom: 192 };
    const distance = 1.958 / 2 / Math.tan((36 * Math.PI) / 180 / 2);
    const free = composeFor(insets, MOBILE, distance, lens);
    const clamped = composeFor(insets, MOBILE, distance, lens, 1.7 * 0.28);
    expect(clamped.up).toBeCloseTo(free.up, 9);
  });

  it('refuses every shift when the subject is bigger than the frame', () => {
    // A tighter close-up than the frame can hold. Picking a side to crop is not
    // a composition, so nothing moves.
    // Compared numerically: a negated zero is still zero, and `toBe`
    // distinguishes them where the arithmetic cannot.
    const composition = composeFor({ ...NO_INSETS, bottom: 500 }, MOBILE, 4, LENS, 99);
    expect(composition.up).toBeCloseTo(0, 12);
    expect(composition.right).toBeCloseTo(0, 12);
  });

  it('refuses to compose against a viewport or a distance it does not have', () => {
    // "Not measured yet" must never arrive downstream disguised as a real
    // number: a NaN camera renders nothing, with no error anywhere.
    expect(composeFor({ ...NO_INSETS, right: 444 }, { width: 0, height: 0 }, 4, LENS).right).toBe(0);
    expect(composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, 0, LENS).right).toBe(0);
    expect(composeFor({ ...NO_INSETS, right: 444 }, DESKTOP, Number.NaN, LENS).right).toBe(0);
  });
});

describe('applyComposition', () => {
  const position = { x: 0, y: 2, z: 5 };
  const target = { x: 0, y: 1, z: 0 };

  it('trucks the camera rather than panning it', () => {
    /*
     * Both ends move by the same vector, so the ANGLE the subject is seen from is
     * unchanged and only its place in frame moves. Shifting the target alone
     * would swing the camera round the subject, which is the difference between
     * "the character came out from behind the panel" and "the character turned".
     */
    const moved = applyComposition(position, target, { right: 1.5, up: 0.4, padding: 1 });
    const before = { x: target.x - position.x, y: target.y - position.y, z: target.z - position.z };
    const after = {
      x: moved.target.x - moved.position.x,
      y: moved.target.y - moved.position.y,
      z: moved.target.z - moved.position.z,
    };
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(after.z).toBeCloseTo(before.z, 9);
  });

  it('moves the camera to its own right, not along a world axis', () => {
    // Looking down -Z, camera right is +X.
    const moved = applyComposition(position, target, { right: 2, up: 0, padding: 1 });
    expect(moved.position.x).toBeCloseTo(2, 6);
    expect(moved.position.z).toBeCloseTo(position.z, 6);
  });

  it('raises both ends for a positive `up`', () => {
    const moved = applyComposition(position, target, { right: 0, up: 0.75, padding: 1 });
    expect(moved.position.y).toBeCloseTo(position.y + 0.75, 6);
    expect(moved.target.y).toBeCloseTo(target.y + 0.75, 6);
  });

  it('leaves a degenerate pose alone instead of dividing by its length', () => {
    const degenerate = applyComposition(target, target, { right: 1, up: 1, padding: 1 });
    expect(degenerate.position).toEqual(target);
    expect(degenerate.target).toEqual(target);
  });
});

describe('padDistance', () => {
  it('pulls straight back along the view ray', () => {
    const target = { x: 0, y: 1, z: 0 };
    const position = { x: 0, y: 3, z: 4 };
    const padded = padDistance(position, target, 1.5);
    const before = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
    const after = Math.hypot(padded.x - target.x, padded.y - target.y, padded.z - target.z);
    expect(after).toBeCloseTo(before * 1.5, 6);
    /*
     * Same direction FROM THE TARGET. The elevation angle of an establishing
     * shot is part of the shot, and padding must dolly along the view ray rather
     * than flatten it. Measured relative to the target, not the origin: the
     * island's centre is not at 0,0,0 and the ratio of raw coordinates is not
     * preserved by a dolly that is not centred there.
     */
    expect((padded.z - target.z) / (padded.y - target.y)).toBeCloseTo(
      (position.z - target.z) / (position.y - target.y),
      9,
    );
  });

  it('is a no-op at or below unity', () => {
    const target = { x: 0, y: 0, z: 0 };
    const position = { x: 1, y: 2, z: 3 };
    expect(padDistance(position, target, 1)).toEqual(position);
    expect(padDistance(position, target, 0.5)).toEqual(position);
  });
});
