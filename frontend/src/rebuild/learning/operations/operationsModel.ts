/*
 * GAP-FIX-R1 learning (Appendix A Part 2; B.7 part 2): the pure models behind
 * the interaction primitives in operations.tsx. Nothing here draws or grades:
 * boards compute their state from the canonical concept model, and these
 * helpers only turn that state into positions, crossings and token counts.
 */

/** Pattern 10: the first index whose value reaches the threshold, or -1 while it has not. */
export function thresholdIndex(values: readonly number[], threshold: number): number {
  return values.findIndex((value) => value >= threshold);
}

/** Pattern 11: tokens left after the picked options, and whether one more option fits. */
export function tokensLeft(options: ReadonlyArray<{ id: string; cost: number }>, picked: readonly string[], tokens: number): number {
  return tokens - options.filter((option) => picked.includes(option.id)).reduce((sum, option) => sum + option.cost, 0);
}
export function canPick(option: { id: string; cost: number }, options: ReadonlyArray<{ id: string; cost: number }>, picked: readonly string[], tokens: number): boolean {
  return picked.includes(option.id) || option.cost <= tokensLeft(options, picked, tokens);
}

/** Patterns 12 and 2: one keyboard or drag step, clamped to the grid. */
export function stepValue(value: number, delta: number, min: number, max: number, step = 1): number {
  const next = Math.round((value + delta * step - min) / step) * step + min;
  return Math.min(max, Math.max(min, next));
}

/** Maps a pointer offset along one axis to the nearest grid value. */
export function valueAt(offset: number, length: number, min: number, max: number, step = 1, inverted = false): number {
  const ratio = Math.min(1, Math.max(0, length === 0 ? 0 : offset / length));
  return stepValue(min + (inverted ? 1 - ratio : ratio) * (max - min), 0, min, max, step);
}

/** A polyline through the values, scaled into a width × height box (zero at the bottom). */
export function polyline(values: readonly number[], width: number, height: number, max: number, count = values.length): string {
  if (values.length === 0) return '';
  const span = Math.max(1, count - 1);
  const top = max <= 0 ? 1 : max;
  return values.map((value, index) => `${Math.round(index / span * width * 10) / 10},${Math.round((height - Math.max(0, value) / top * height) * 10) / 10}`).join(' ');
}
