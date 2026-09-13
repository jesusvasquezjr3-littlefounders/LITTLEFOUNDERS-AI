import { describe, expect, it } from 'vitest';
import type { HudRect } from '../composition';
import {
  clampThenEscape,
  escapeReserved,
  overlappingPairs,
  rectsOverlap,
  type NamedRect,
} from '../hudSpace';

/*
 * THE COLLISIONS THE OWNER FOUND ON A PHONE, AS ARITHMETIC.
 *
 * Every rectangle in this file is a real `getBoundingClientRect` from a live
 * stage driven at 375x812 and at 1280x800 — the numbers the verification pass
 * came back with, not numbers anybody reasoned to. That matters twice over. It
 * is what stops the "before" cases from being a straw man, and it is what makes
 * the "after" cases a regression test rather than a restatement of the
 * implementation: the geometry below is what the DOM actually did.
 *
 * They are asserted here rather than in a render test because there is nowhere
 * else they can be. jsdom lays nothing out — every rect it reports is 0x0 — so a
 * `render()` of the shell has no geometry to check and would pass on any layout
 * whatsoever, including the broken one. The DOM-shaped half of these defects is
 * covered by `stage/__tests__/stageMic.test.tsx` (which surface is mounted at
 * all); this file covers the half that is about pixels.
 */

function rect(left: number, top: number, width: number, height: number): HudRect {
  return { left, top, width, height };
}

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

// ── The measured "before" ───────────────────────────────────────────────────

/** The greeting caption in `introducing`, at 375x812. */
const CAPTION_375 = rect(54, 31, 266, 68);
/** The way out, with its translated line, at 375x812. */
const EXIT_LABELLED_375 = rect(16, 16, 155, 44);
/** The way out with the line dropped below `md:` — icon and tap target only. */
const EXIT_ICON_375 = rect(16, 16, 52, 44);

/** `closing` at 375x812, as it shipped: four surfaces claiming one edge. */
const CLOSING_BEFORE_375 = [
  { name: 'mic orb', rect: rect(139, 632, 96, 96) },
  { name: 'see you soon', rect: rect(26, 558, 322, 118) },
  { name: 'start another session', rect: rect(86, 692, 203, 48) },
  { name: 'mic reason', rect: rect(26, 736, 322, 64) },
];

/** `unavailable`, saying the same thing twice on top of itself. */
const UNAVAILABLE_BEFORE = [
  { name: 'unavailable plate', rect: rect(26, 714, 322, 82) },
  { name: 'mic reason', rect: rect(26, 736, 322, 64) },
];

describe('the overlap check has teeth', () => {
  it('catches the greeting sitting under the way out', () => {
    // 116x29 of shared pixels, on three of three fresh mounts. The learner read
    // "…Rho. What would you like to look at together today?" with the first half
    // of the sentence behind the word "Leave".
    expect(rectsOverlap(CAPTION_375, EXIT_LABELLED_375)).toBe(true);
  });

  it('catches every collision in the goodbye at once', () => {
    const pairs = overlappingPairs(CLOSING_BEFORE_375).map(([a, b]) => `${a} / ${b}`);
    // The disabled orb, on the plate and on the one action of the phase.
    expect(pairs).toContain('mic orb / see you soon');
    expect(pairs).toContain('mic orb / start another session');
    // And that button in turn on the top of the orb's own reason line, which is
    // how "This conversation is over." ended up unreadable.
    expect(pairs).toContain('start another session / mic reason');
    expect(pairs).toHaveLength(3);
    // The surfaces that merely stack cleanly are NOT reported: a checker that
    // flags everything is a checker nobody reads.
    expect(pairs).not.toContain('see you soon / start another session');
  });

  it('catches a phase explaining itself twice', () => {
    expect(overlappingPairs(UNAVAILABLE_BEFORE)).toHaveLength(1);
  });

  it('does not report two surfaces that merely share an edge', () => {
    // A plate resting exactly on the dock's top line differs by fractions of a
    // pixel between frames. Reported, it would flicker a node in and out.
    expect(rectsOverlap(rect(0, 0, 100, 100), rect(0, 100, 100, 100))).toBe(false);
    expect(rectsOverlap(rect(0, 0, 100, 100.5), rect(0, 100, 100, 100))).toBe(false);
  });

  it('ignores a surface that is mounted but not laid out', () => {
    const pairs = overlappingPairs([
      { name: 'real', rect: rect(0, 0, 100, 100) },
      { name: 'unlaid', rect: rect(0, 0, 0, 0) },
    ]);
    expect(pairs).toHaveLength(0);
  });
});

// ── What the caption does about it ──────────────────────────────────────────

describe('escapeReserved', () => {
  function moved(box: HudRect, reserved: readonly HudRect[], viewport: { width: number; height: number }) {
    const { dx, dy } = escapeReserved(box, reserved, viewport);
    return { ...box, left: box.left + dx, top: box.top + dy, dx, dy };
  }

  it('takes the caption sideways out of the way-out chip at 375', () => {
    const after = moved(CAPTION_375, [EXIT_ICON_375], PHONE);
    expect(rectsOverlap(after, EXIT_ICON_375)).toBe(false);
    // SIDEWAYS, and that is the whole reason the chip drops its label below
    // `md:`. Down was the only other option and would have laid the greeting
    // across the character's forehead.
    expect(after.dy).toBe(0);
    expect(after.dx).toBeGreaterThan(0);
    // And it stays on the screen it was escaping into.
    expect(after.left + after.width).toBeLessThanOrEqual(PHONE.width);
  });

  it('moves as little as it possibly can', () => {
    // 68 (the chip's right edge) + 8 (the gap) − 54 (the caption's left edge).
    expect(escapeReserved(CAPTION_375, [EXIT_ICON_375], PHONE).dx).toBe(22);
  });

  it('leaves a node that is already clear exactly where it is', () => {
    const clear = rect(100, 400, 200, 60);
    expect(escapeReserved(clear, [EXIT_ICON_375], PHONE)).toEqual({ dx: 0, dy: 0 });
  });

  it('refuses rather than half-escaping when there is nowhere to go', () => {
    /*
     * A full-width band across the middle of the phone, with a caption on it and
     * no budget to clear it. A node moved most of the way out is the worst of
     * the three outcomes available: still covered, and no longer pointing at the
     * character it belongs to. Zero hands the decision back to the caller.
     */
    const band = rect(0, 300, 375, 400);
    expect(escapeReserved(rect(54, 400, 266, 68), [band], PHONE)).toEqual({ dx: 0, dy: 0 });
  });

  it('never pushes a node off the frame to satisfy a rectangle', () => {
    // Clearing this chip to the right would need 300 px on a 375 px screen.
    const wide = rect(0, 0, 300, 120);
    const box = rect(54, 60, 266, 68);
    const after = moved(box, [wide], PHONE);
    expect(after.left).toBeGreaterThanOrEqual(0);
    expect(after.left + after.width).toBeLessThanOrEqual(PHONE.width);
    // Down is what is left, and it is taken.
    expect(after.dy).toBeGreaterThan(0);
    expect(rectsOverlap(after, wide)).toBe(false);
  });

  it('clears a second surface it lands on while escaping the first', () => {
    const first = rect(0, 0, 120, 120);
    const second = rect(128, 0, 120, 200);
    const box = rect(60, 40, 60, 40);
    const after = moved(box, [first, second], DESKTOP);
    expect(rectsOverlap(after, first)).toBe(false);
    expect(rectsOverlap(after, second)).toBe(false);
  });

  it('does nothing at all when no chrome has been measured yet', () => {
    // The first frames of a route, and every unit test: an empty registry must
    // cost nothing and move nothing.
    expect(escapeReserved(CAPTION_375, [], PHONE)).toEqual({ dx: 0, dy: 0 });
  });

  it('ignores chrome that has no pixels', () => {
    expect(escapeReserved(CAPTION_375, [rect(16, 16, 0, 0)], PHONE)).toEqual({ dx: 0, dy: 0 });
  });

  it('still helps a node too wide to fit the frame on the axis it overflows', () => {
    /*
     * A three-line pt-BR caption can be wider than a phone in landscape. Holding
     * such a node to "wholly inside the frame" would refuse every candidate and
     * leave it under the chip forever, so the constraint is dropped on the axis
     * it cannot satisfy anyway — the same fallback `culling.ts` makes.
     */
    const tooWide = rect(-20, 20, 420, 60);
    const chip = rect(16, 16, 52, 44);
    const after = moved(tooWide, [chip], PHONE);
    expect(rectsOverlap(after, chip)).toBe(false);
  });
});

// ── The measured "after" ────────────────────────────────────────────────────

/*
 * NO TWO VISIBLE HUD SURFACES OVERLAP, IN ANY PHASE, AT EITHER WIDTH.
 *
 * Captured from the real `StageShell` — the one `/dev/tutor-lab` mounts, with
 * the real camera and the real anchor projector — driven through every phase at
 * exactly 375x812 and 1280x800 in a headless Chrome that genuinely reports
 * itself visible, so `SceneCanvas` drew and the projector ran. The survey is the
 * same one the lab's own readout uses: every `.lf-glass` plate and every button
 * inside `[data-tutor-stage]`, minus the instrument panel, minus the loading
 * veil, minus anything nested inside another surface.
 *
 * WHY A FIXTURE AND NOT A `render()`. jsdom reports every rectangle as 0x0, so a
 * rendered assertion here would pass on the broken layout as readily as on this
 * one. These are the numbers a browser produced; what the test defends is that
 * the ARRANGEMENT they describe is collision-free, which is the property three
 * separate bug reports were about. It goes stale the way any golden file does —
 * re-capture it when the layout changes on purpose, and the lab's live readout
 * is what catches it in the meantime.
 *
 * RE-CAPTURE IT WITH `node scripts/capture-hud-space.mjs` (2026-09-12). That
 * sentence above had no tool behind it for as long as it has existed, which
 * made "re-capture" mean "do the original verification pass again, somehow" —
 * and a fixture nobody can regenerate is one that quietly stops describing the
 * product while its assertions keep passing, because rectangles in a file do
 * not move. The script drives the same lab through the same phases at the same
 * two viewports, runs the same survey the live readout uses, and prints this
 * block ready to paste.
 *
 * Its first run found a defect these numbers had been hiding: the caption over
 * the way-out chip at 375, by 11x14. The escape ran on the node's TARGET while
 * the node painted at its SMOOTHED position, so a moving camera carried it
 * through chrome the arithmetic had already cleared. Fixed in `ScreenAnchor`;
 * the numbers below are from after that.
 *
 * The three phases below are the ones the defects were in; the other four were
 * measured in the same pass and were clean.
 */
const MEASURED: Record<string, NamedRect[]> = {
  'introducing@375': [
    { name: 'way-out', rect: rect(16, 16, 48, 48) },
    { name: 'Hi Robi. I\'m Dr. Rho.play_arrowR', rect: rect(11, 73, 353, 451) },
    { name: 'landscapeMy island', rect: rect(125, 592, 125, 48) },
    { name: 'historyPast conversationsexpand_', rect: rect(79, 648, 217, 48) },
    { name: 'or just talk to me', rect: rect(140, 704, 96, 96) },
  ],
  'conversing@375': [
    { name: 'way-out', rect: rect(16, 16, 48, 48) },
    { name: 'menuMenuexpand_more', rect: rect(238, 16, 121, 48) },
    { name: 'speech caption', rect: rect(53, 71, 267, 134) },
    { name: 'The board', rect: rect(16, 708, 343, 88) },
    { name: 'Hold to talk', rect: rect(19, 600, 96, 96) },
    { name: 'send', rect: rect(127, 626, 229, 44) },
  ],
  'closing@375': [
    { name: 'way-out', rect: rect(16, 16, 48, 48) },
    { name: 'See you soon!Saved. You can list', rect: rect(27, 644, 320, 92) },
    { name: 'Start again', rect: rect(44, 744, 110, 48) },
    { name: 'historyWhat we didexpand_more', rect: rect(162, 744, 169, 48) },
  ],
  'unavailable@375': [
    { name: 'way-out', rect: rect(16, 16, 48, 48) },
    { name: 'mic reason', rect: rect(40, 644, 295, 156) },
  ],
  'introducing@1280': [
    { name: 'way-out', rect: rect(24, 24, 164, 48) },
    { name: 'Hi Robi. I\'m Dr. Rho.play_arrowR', rect: rect(176, 72, 928, 417) },
    { name: 'landscapeMy island', rect: rect(465, 608, 125, 48) },
    { name: 'historyPast conversationsexpand_', rect: rect(598, 608, 217, 48) },
    { name: 'or just talk to me', rect: rect(584, 664, 112, 112) },
  ],
  'conversing@1280': [
    { name: 'way-out', rect: rect(24, 24, 164, 48) },
    { name: 'menuMenuexpand_more', rect: rect(1052, 24, 121, 48) },
    { name: 'Finish', rect: rect(1181, 24, 75, 48) },
    { name: 'speech caption', rect: rect(166, 80, 512, 114) },
    { name: 'The board', rect: rect(846, 80, 410, 544) },
    { name: 'Hold to talk', rect: rect(366, 612, 112, 112) },
    { name: 'send', rect: rect(186, 732, 472, 44) },
  ],
  'closing@1280': [
    { name: 'way-out', rect: rect(24, 24, 164, 48) },
    { name: 'See you soon!Saved. You can list', rect: rect(480, 614, 320, 98) },
    { name: 'Start again', rect: rect(496, 720, 110, 48) },
    { name: 'historyWhat we didexpand_more', rect: rect(614, 720, 169, 48) },
  ],
  'unavailable@1280': [
    { name: 'way-out', rect: rect(24, 24, 164, 48) },
    { name: 'mic reason', rect: rect(493, 604, 295, 172) },
  ],
}

describe('the measured stage', () => {
  for (const [where, surfaces] of Object.entries(MEASURED)) {
    it(`has no two surfaces on top of each other in ${where}`, () => {
      expect(overlappingPairs(surfaces)).toEqual([]);
    });
  }

  it('has no microphone at all in the goodbye', () => {
    // The other phases in the table carry one. This is the difference the
    // owner's phone paid for: the orb was on the button they needed.
    const names = (MEASURED['closing@375'] ?? []).map((s) => s.name);
    expect(names.some((name) => /talk|mic/i.test(name))).toBe(false);
    expect(names).toContain('Start again');
  });

  it('explains the unreachable API exactly once, at both widths', () => {
    for (const key of ['unavailable@375', 'unavailable@1280']) {
      const explanations = (MEASURED[key] ?? []).filter((s) => s.name === 'mic reason');
      expect(explanations, key).toHaveLength(1);
    }
  });

  /*
   * Only `conversing`, where a caption exists at all: the arrival's greeting is
   * printed inside the map sheet rather than over a crown, so `introducing` has
   * no anchored caption to keep clear of anything.
   *
   * The two surfaces are found by their `data-hud-surface` names rather than by
   * their text. That is not tidiness — this fixture is re-captured by
   * `scripts/capture-hud-space.mjs`, and a surface named by whatever the tutor
   * happened to be saying, in whatever locale, is a surface this assertion
   * could not find twice running.
   */
  it('keeps the caption clear of the way out at 375, where it used to sit under it', () => {
    const surfaces = MEASURED['conversing@375'] ?? [];
    const wayOut = surfaces.find((s) => s.name === 'way-out');
    const caption = surfaces.find((s) => s.name.endsWith('caption'));
    expect(wayOut).toBeDefined();
    expect(caption).toBeDefined();
    // And the way out is the SMALL one below `md:`. A 155 px labelled chip
    // spans the caption's only horizontal escape route on a 375 px screen.
    expect(wayOut?.rect.width).toBeLessThan(60);
    expect(rectsOverlap(wayOut!.rect, caption!.rect)).toBe(false);
  });
});

/*
 * THE SAME COLLISION, ARRIVING FROM THE OTHER SIDE — and this time the rule
 * rather than a snapshot of it.
 *
 * The case above asserts a set of measured rectangles do not overlap, which is
 * a photograph: it stays green while the code that produced those rectangles
 * changes underneath it. It did. Re-measured on `/dev/tutor-lab` at 375x812 in
 * `conversing` on 2026-08-22, with the ambient orbit STOPPED — which is what a
 * reduced-motion learner sees permanently — the caption was back under the way
 * out, at (55, 8, 265, 112) against (16, 16, 48, 48).
 *
 * The reason was an ORDER, not a geometry. At a close-up the speaker's crown is
 * above the top of the frame, so the caption's target is off screen; the chrome
 * escape looks at that target, finds it overlapping nothing, and correctly does
 * nothing. The frame clamp then parks it a gap below the top edge, which is
 * where the way out stands, and nothing looked again. A moving camera had been
 * hiding it: at most bearings the crown projects far enough right that the
 * plate clears the chip on its own.
 *
 * Every number below is that measurement.
 */
describe('a caption clamped back into the frame lands clear of the chrome, not on it', () => {
  const VIEWPORT = { width: 375, height: 812 };
  const GAP = 8;
  /** The way out, unlabelled below `md:`, as measured. */
  const WAY_OUT: HudRect = { left: 16, top: 16, width: 48, height: 48 };
  /** The frame the clamp parks into: the viewport, inset by the crown gap. */
  const FRAME = { left: GAP, top: GAP, width: 375 - GAP * 2, height: 812 - GAP * 2 };
  /** The caption's measured plate: 265 x 112, so half-extents of 132.5 x 56. */
  const HALF_W = 132.5;
  const HALF_H = 56;
  /** Where the projector puts it at a close-up: well above the top of the frame. */
  const TARGET_X = 187.5;
  const TARGET_Y = -200;

  const boxAt = (c: { x: number; y: number }): HudRect => ({
    left: c.x - HALF_W,
    top: c.y - HALF_H,
    width: HALF_W * 2,
    height: HALF_H * 2,
  });

  it('reproduces the shipped collision when the clamp is the last word', () => {
    // Clamping alone — no reserved chrome — is exactly the old behaviour.
    const clampedOnly = clampThenEscape(TARGET_X, TARGET_Y, HALF_W, HALF_H, FRAME, VIEWPORT, []);
    expect(boxAt(clampedOnly)).toEqual({ left: 55, top: 8, width: 265, height: 112 });
    expect(rectsOverlap(boxAt(clampedOnly), WAY_OUT)).toBe(true);
  });

  it('clears it once the escape gets to run after the clamp', () => {
    const settled = clampThenEscape(TARGET_X, TARGET_Y, HALF_W, HALF_H, FRAME, VIEWPORT, [WAY_OUT]);
    expect(rectsOverlap(boxAt(settled), WAY_OUT)).toBe(false);
  });

  it('slides ALONG the edge rather than back off it — the clamp still wins on frame', () => {
    const settled = clampThenEscape(TARGET_X, TARGET_Y, HALF_W, HALF_H, FRAME, VIEWPORT, [WAY_OUT]);
    const box = boxAt(settled);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.left + box.width).toBeLessThanOrEqual(VIEWPORT.width);
    // It moved sideways, not down: the caption stays at the top of the frame
    // where a learner is already looking for the tutor's words.
    expect(box.top).toBe(8);
  });

  it('leaves a node that needs no escape exactly where the clamp put it', () => {
    const far: HudRect = { left: 16, top: 700, width: 48, height: 48 };
    const withBlocker = clampThenEscape(TARGET_X, TARGET_Y, HALF_W, HALF_H, FRAME, VIEWPORT, [far]);
    const without = clampThenEscape(TARGET_X, TARGET_Y, HALF_W, HALF_H, FRAME, VIEWPORT, []);
    expect(withBlocker).toEqual(without);
  });
});

