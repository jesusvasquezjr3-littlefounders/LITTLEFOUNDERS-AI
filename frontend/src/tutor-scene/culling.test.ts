import { describe, expect, it } from 'vitest';
import { isAnchorNodeVisible, type ViewportBox } from './culling';

/*
 * The rule this file defends: a node the learner cannot fully read is not on
 * screen, and therefore is not focusable.
 *
 * The projector cannot be stepped through by a test — it lives in `useFrame`,
 * with a camera and a WebGL context neither of which jsdom has. So the geometry
 * lives here, on its own, and this is the only place the rule is actually
 * checked. Every case below is written as a position the camera really produces
 * during a shot change, because that is when a chip crosses the frame edge.
 */

/** A 1280x800 desktop stage, `fixed inset-0`, so the canvas IS the viewport. */
const DESKTOP: ViewportBox = { left: 0, top: 0, width: 1280, height: 800 };

/** A 375x667 phone. */
const PHONE: ViewportBox = { left: 0, top: 0, width: 375, height: 667 };

/** The scene lab, where the canvas is a panel partway down a scrolling page. */
const PANEL: ViewportBox = { left: 240, top: 120, width: 800, height: 480 };

describe('isAnchorNodeVisible', () => {
  it('keeps a chip that is comfortably inside the frame', () => {
    expect(isAnchorNodeVisible(640, 400, 60, 18, DESKTOP)).toBe(true);
  });

  it('CULLS a chip whose centre is inside but whose edge is cut off', () => {
    /*
     * THE DEFECT, in one assertion. A 120 px wide chip centred 40 px from the
     * right edge is 20 px over it: visible as a sliver, and under the old
     * centre-plus-96px test entirely un-culled, so a keyboard user tabbed onto
     * a control whose label ran off the screen.
     */
    expect(isAnchorNodeVisible(1240, 400, 60, 18, DESKTOP)).toBe(false);
  });

  it('CULLS a chip whose centre is past the edge by less than the old margin', () => {
    // Centre 60 px outside the right edge: inside the old 96 px margin, so it
    // survived every previous frame. Half of it was still on screen.
    expect(isAnchorNodeVisible(1340, 400, 60, 18, DESKTOP)).toBe(false);
  });

  it('keeps a chip resting exactly against an edge', () => {
    // Touching is inside. A strict inequality here would cull a chip the
    // composition deliberately places flush with the safe area.
    expect(isAnchorNodeVisible(60, 400, 60, 18, DESKTOP)).toBe(true);
    expect(isAnchorNodeVisible(1220, 400, 60, 18, DESKTOP)).toBe(true);
  });

  it('culls on the vertical axis too, which is where the sky runes leave', () => {
    expect(isAnchorNodeVisible(640, 10, 60, 18, DESKTOP)).toBe(false);
    expect(isAnchorNodeVisible(640, 795, 60, 18, DESKTOP)).toBe(false);
  });

  it('applies to the canvas rect, not to the window, so the scene lab agrees', () => {
    // Dead centre of the page but 100 px above the panel: on screen, and not on
    // the STAGE. The projector publishes canvas-relative pixels for exactly
    // this reason.
    expect(isAnchorNodeVisible(640, 20, 60, 18, PANEL)).toBe(false);
    expect(isAnchorNodeVisible(640, 360, 60, 18, PANEL)).toBe(true);
  });

  it('treats an unmeasured node as a point rather than as infinitely large', () => {
    // Half-extents are zero until a node has been measured at a size. Culling
    // those outright would hide the caption, whose anchored node is genuinely
    // 0x0 with the text absolutely positioned inside it.
    expect(isAnchorNodeVisible(640, 400, 0, 0, DESKTOP)).toBe(true);
    expect(isAnchorNodeVisible(-1, 400, 0, 0, DESKTOP)).toBe(false);
  });

  it('falls back to the centre for a node bigger than the frame', () => {
    /*
     * A plate that wraps to three lines in pt-BR can be wider than a phone.
     * "Wholly inside" is unsatisfiable for it, and permanently culling the one
     * surface carrying the tutor's words would be a far worse bug than the one
     * this replaces. It stays reachable while its centre is on screen.
     */
    expect(isAnchorNodeVisible(187, 333, 220, 40, PHONE)).toBe(true);
    expect(isAnchorNodeVisible(-5, 333, 220, 40, PHONE)).toBe(false);
  });

  it('grows the cull zone with the depth scale, because the caller passes it in', () => {
    // Same node, same place, twice the on-screen size: at 1x it fits, at 2x its
    // edge is over the line. The projector multiplies before it asks.
    expect(isAnchorNodeVisible(1200, 400, 70, 18, DESKTOP)).toBe(true);
    expect(isAnchorNodeVisible(1200, 400, 140, 36, DESKTOP)).toBe(false);
  });
});
