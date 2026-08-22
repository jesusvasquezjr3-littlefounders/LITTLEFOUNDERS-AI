/*
 * Is an anchored node actually READABLE where the projector just put it?
 *
 * This module imports NOTHING on purpose, exactly like `anchors.ts`: the answer
 * is arithmetic, and arithmetic can be unit-tested. The projector that calls it
 * runs inside `useFrame`, which no test in this repo can step through, so the
 * only way this rule gets checked is by living outside the frame loop.
 *
 * WHY THE BOX AND NOT THE CENTRE POINT. The projector positions a node by its
 * CENTRE — its transform ends in `translate(-50%, -50%)` — so a test on the
 * centre alone knows nothing about where the node's edges are. The first version
 * culled on the centre plus a flat 96 px margin, which kept a node un-hidden and
 * un-inert while its centre was up to 96 px OUTSIDE the frame. A chip in that
 * state straddles the screen edge as a sliver, or is off screen entirely if it
 * is small, and it stays fully focusable either way: a keyboard user tabbing
 * through the HUD lands on a control they cannot read, and the focus ring goes
 * somewhere they cannot see. The margin was never the bug. Measuring the wrong
 * shape was.
 */

/** A rectangle in CSS pixels, viewport-relative — normally the canvas's own. */
export interface ViewportBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * True when a node centred on (`x`, `y`) with these half-extents is WHOLLY
 * inside `view`.
 *
 * Wholly, not partly, and that is the whole point. "Partly inside" is precisely
 * the state a half-cut control is in, and a control the learner can only half
 * read must not be in the tab order or under a thumb. The cost is that an
 * anchored node pops out at the edge instead of sliding off it, which is the
 * right trade here: every anchored node mirrors a pickable mesh that is still
 * on screen, so what disappears is the label, never the affordance.
 *
 * Half-extents are passed in already multiplied by the node's depth scale. The
 * projector owns that scale and this file owns no units.
 */
export function isAnchorNodeVisible(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  view: ViewportBox,
): boolean {
  return (
    fitsOnAxis(x, halfWidth, view.left, view.width) && fitsOnAxis(y, halfHeight, view.top, view.height)
  );
}

/**
 * One axis of the test.
 *
 * A node BIGGER than the view on this axis can never satisfy "wholly inside",
 * and culling it forever would be a worse defect than the one this replaces: a
 * plate that wraps to three lines in pt-BR is taller than a 375 px phone in
 * landscape, and the learner would simply lose it. For that case the test falls
 * back to the centre, which keeps the node reachable while at least half of it
 * is on screen — the best available answer when "all of it" is unreachable.
 *
 * A node that has never been measured has a half-extent of zero, so it reduces
 * to the same centre test rather than being treated as infinitely large.
 */
function fitsOnAxis(centre: number, half: number, start: number, extent: number): boolean {
  const end = start + extent;
  if (half * 2 >= extent) return centre >= start && centre <= end;
  return centre - half >= start && centre + half <= end;
}
