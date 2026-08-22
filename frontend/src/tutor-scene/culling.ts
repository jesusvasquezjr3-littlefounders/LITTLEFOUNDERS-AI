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
 * How far UP a node must move to stop sitting on any node already placed.
 *
 * WHY THIS EXISTS. Anchored labels have a readability floor and the world does
 * not: a plate stops shrinking at `MIN_READABLE_PX` while the characters it
 * names keep receding, so at any distance past a close-up four name plates are
 * wider than the four heads they belong to. Measured on the real stage at
 * 375x812 during personalization, the four candidates' crowns projected into a
 * band roughly 150 px wide while their plates measured 108 to 197 px each: 7
 * mutual overlaps, and the learner could not tell which name went with which
 * character. At 1280x800 the same arrangement still produced 2.
 *
 * WHY UP, AND ONLY UP. The node is attached to a point in the world, so every
 * pixel sideways is a pixel of "this label belongs to THAT character" spent —
 * and with the heads 50 px apart, a sideways escape lands the name on the
 * neighbour, which is worse than an overlap because it is confidently wrong.
 * Straight up keeps the plate over its own head and spends the one thing the
 * shot is not using: the sky. `hudSpace.escapeReserved` is the four-direction
 * version and is right for what it does — a caption dodging a fixed corner chip
 * has no owner to point at.
 *
 * WHY IT IS COMPUTED PER FRAME RATHER THAN AUTHORED AS A LADDER. A fixed
 * per-candidate offset was written first, and it was correct in the screenshot
 * that justified it and wrong a few seconds later: `SHOT_AMBIENT` orbits the
 * `approach` shot, so the crowns' screen positions travel continuously. An
 * authored ladder also spends sky it does not need — at 1280 px the cast is
 * already far enough apart — and the sky is where the sun's arc lives.
 *
 * Returns 0 when nothing is in the way, which is the common case and costs one
 * pass. `placed` is expected to be short (the candidates on stage), and the
 * loop is bounded by its length: clearing one box can push a node onto the next,
 * and this runs sixty times a second behind a 3D render.
 */
export function stackClearance(
  box: ViewportBox,
  placed: readonly ViewportBox[],
  gap: number,
): number {
  if (placed.length === 0 || !(box.width > 0) || !(box.height > 0)) return 0;

  let lift = 0;
  for (let pass = 0; pass <= placed.length; pass += 1) {
    const top = box.top - lift;
    const blocker = placed.find((other) => boxesOverlap(box.left, top, box.width, box.height, other));
    if (!blocker) return lift;
    // Clear its TOP edge by the gap. Written as an absolute requirement rather
    // than an increment so two blockers cannot each be satisfied in turn while
    // the node oscillates between them.
    lift = Math.max(lift, box.top + box.height - blocker.top + gap);
  }
  return lift;
}

/** Rectangle intersection, in the same tolerance-free form the frame loop needs. */
function boxesOverlap(
  left: number,
  top: number,
  width: number,
  height: number,
  other: ViewportBox,
): boolean {
  return (
    Math.min(left + width, other.left + other.width) - Math.max(left, other.left) > 0 &&
    Math.min(top + height, other.top + other.height) - Math.max(top, other.top) > 0
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
