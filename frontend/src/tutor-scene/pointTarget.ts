/*
 * Class III `point_at` (2026-09-04): turns a `pointAt` array index into a
 * DIRECTION the character's existing `point` pose can lean toward — not
 * inverse kinematics, and deliberately not: the whiteboard is a DOM
 * overlay (`/ORACLE.md`'s own "on-canvas overlays" doctrine — every plate
 * and chip is a projected DOM node, never scene geometry), so there is no
 * 3D world position for a bar to aim a bone at in the first place. What
 * DOES exist, and what this reads, is real: the target element's own
 * on-screen position, found via `data-tutor-whiteboard-item` (BarColumn's
 * own hook) relative to the whole board's own bounds
 * (`data-tutor-whiteboard`, `TutorWhiteboard.tsx`).
 *
 * A WHITEBOARD-RELATIVE bearing, not a camera-relative one, on purpose: the
 * character's own projected screen position would need hooking into
 * `ScreenAnchor.tsx`'s per-frame projector for a value nothing else needs
 * it for. Bar 0 of 5 reads as "reach left"; bar 4 of 5 reads as "reach
 * right" — coarse, but a REAL, screen-coordinate-derived difference between
 * one target and another, which is the whole gap S16's version left open
 * (a `point` that always reaches the same way regardless of what it names).
 */

export interface PointBearing {
  /** -1 (left edge of the board) .. 1 (right edge). 0 is centre. */
  x: number;
  /** -1 (top of the board) .. 1 (bottom). 0 is centre. */
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Null whenever there is nothing real to aim at — no target index, no
 * matching element, no open board, or a board measuring zero (not yet
 * laid out). The caller's own fallback IS the coarse S16 pose, so a miss
 * here costs nothing and asserts nothing.
 */
export function resolvePointBearing(
  pointAt: number | null | undefined,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): PointBearing | null {
  if (pointAt == null || !doc) return null;

  const target = doc.querySelector(`[data-tutor-whiteboard-item="${pointAt}"]`);
  const board = doc.querySelector('[data-tutor-whiteboard]');
  if (!target || !board) return null;

  const targetRect = target.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  if (boardRect.width === 0 || boardRect.height === 0) return null;

  const targetCentreX = targetRect.left + targetRect.width / 2;
  const targetCentreY = targetRect.top + targetRect.height / 2;
  const boardCentreX = boardRect.left + boardRect.width / 2;
  const boardCentreY = boardRect.top + boardRect.height / 2;

  return {
    x: clamp((targetCentreX - boardCentreX) / (boardRect.width / 2), -1, 1),
    y: clamp((targetCentreY - boardCentreY) / (boardRect.height / 2), -1, 1),
  };
}
