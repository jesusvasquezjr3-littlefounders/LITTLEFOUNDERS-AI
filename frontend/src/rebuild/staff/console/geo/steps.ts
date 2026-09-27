/*
 * The shade steps of the geography map (W2T.3), shared by the drawn map
 * (MapCanvas.tsx, its own chunk) and the legend beside it (WorldMap.tsx), so
 * the legend can print real ranges without loading the outlines.
 */

/** Upper edge of each shade, as a share of the busiest place on screen. */
export const STEP_EDGES = [0.05, 0.2, 0.45, 0.75, 1] as const;

export function stepFor(value: number, max: number): number {
  if (value <= 0 || max <= 0) return -1;
  const share = value / max;
  const index = STEP_EDGES.findIndex((edge) => share <= edge);
  return index < 0 ? STEP_EDGES.length - 1 : index;
}
