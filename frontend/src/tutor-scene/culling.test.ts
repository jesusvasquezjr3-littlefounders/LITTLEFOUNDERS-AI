import { describe, expect, it } from 'vitest';
import { isAnchorNodeVisible, stackClearance, type ViewportBox } from './culling';

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


/*
 * The second rule this file defends: two labels that name two different people
 * may not be drawn on top of each other.
 *
 * Measured on the real stage during personalization, before this existed: 7
 * mutual overlaps between the picker's own controls at 375x812 and 2 at
 * 1280x800, with the four candidates' crowns projecting into a band roughly
 * 150 px wide and the plates naming them 108 to 197 px each. A HUD label has a
 * readability floor and the character it names does not, so past a close-up the
 * labels are always wider than the heads.
 */
describe('keeping anchored peers off each other', () => {
  /** A 90x40 plate whose centre has just been projected onto (x, y). */
  const plate = (x: number, y: number, width = 90, height = 40): ViewportBox => ({
    left: x - width / 2,
    top: y - height / 2,
    width,
    height,
  });

  it('leaves a node alone when nothing is in the way', () => {
    expect(stackClearance(plate(200, 300), [], 8)).toBe(0);
    expect(stackClearance(plate(200, 300), [plate(500, 300)], 8)).toBe(0);
    // Vertically clear by more than the gap: two rows already stacked.
    expect(stackClearance(plate(200, 300), [plate(200, 200)], 8)).toBe(0);
  });

  it('lifts a node just clear of the one it landed on, gap included', () => {
    // Both centred on y=300, so they coincide exactly. The lower one has to
    // rise its own height plus the gap to sit above the other.
    expect(stackClearance(plate(200, 300), [plate(200, 300)], 8)).toBe(48);
  });

  it('clears every blocker, not merely the first one it met', () => {
    /*
     * The case a single pass gets wrong: rising off the first plate lands the
     * node on the second. Two candidates 30 px apart on screen is an ordinary
     * bearing for the picker's orbit, not a pathological one.
     */
    const lift = stackClearance(plate(200, 300), [plate(200, 300), plate(210, 270)], 8);
    expect(lift).toBe(78);
    // And the result really is clear: the lifted box sits above both.
    expect(300 - lift + 20).toBeLessThanOrEqual(270 - 20 - 8);
  });

  it('only ever moves a label UP', () => {
    /*
     * Sideways is cheaper by the ruler and wrong by the product: the plate is
     * attached to one character's head, and at 375 px the heads are about 50 px
     * apart, so a lateral escape hands the name to the neighbour. A confidently
     * wrong label is worse than an overlapping one.
     */
    for (const blocker of [plate(200, 300), plate(160, 300), plate(240, 310)]) {
      expect(stackClearance(plate(200, 300), [blocker], 8)).toBeGreaterThan(0);
    }
  });

  it('asks for nothing when it has not been measured yet', () => {
    // Half-extents are zero until a node has been laid out, and a zero box
    // overlaps nothing. Pushing it would be pushing a point.
    expect(stackClearance({ left: 200, top: 300, width: 0, height: 0 }, [plate(200, 300)], 8)).toBe(0);
  });
});
