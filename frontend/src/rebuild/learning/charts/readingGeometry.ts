import { quantile } from './chartModel.generated';

/*
 * Horizonte F1.0: the pure geometry behind the twelve reading charts (axis
 * ticks, density estimates, timeline lanes, heat shades). No React, no DOM:
 * readingCharts.tsx only turns these numbers into SVG, and the tests pin them.
 */

export type Domain = [number, number];

/** A linear map from a domain onto a range; a flat domain maps to the middle of the range. */
export function scaleLinear([d0, d1]: Domain, [r0, r1]: Domain): (value: number) => number {
  const span = d1 - d0;
  return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0));
}

/** Round, evenly spaced axis values (1, 2 or 5 times a power of ten) inside the domain: at most about `target` of them. */
export function niceTicks([low, high]: Domain, target = 4): number[] {
  const span = high - low;
  if (!(span > 0) || !Number.isFinite(span)) return [low];
  const raw = span / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step = (unit >= 5 ? 10 : unit >= 2 ? 5 : unit >= 1 ? 2 : 1) * power;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / step - 1e-9) * step; value <= high + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

/** Silverman's rule of thumb for the smoothing width of a Gaussian density estimate. */
export function bandwidth(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 2) return 1;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const range = sorted[n - 1]! - sorted[0]!;
  const spread = Math.min(sd, iqr / 1.34) || sd || range / 6;
  return Math.max(0.9 * spread * n ** -0.2, range / 200, 1e-9);
}

/** Gaussian kernel density of a sample at each position. The area under the curve is 1. */
export function densityAt(values: readonly number[], width: number, positions: readonly number[]): number[] {
  const norm = 1 / (values.length * width * Math.sqrt(2 * Math.PI));
  return positions.map((at) => norm * values.reduce((sum, value) => sum + Math.exp(-0.5 * ((at - value) / width) ** 2), 0));
}

export interface Densities { positions: number[]; curves: number[][]; peak: number; domain: Domain }

/** Density curves of several samples over one shared stretch of the axis, so their heights compare. */
export function densities(groups: ReadonlyArray<readonly number[]>, steps = 64): Densities {
  const all = groups.flat();
  const [low, high] = [Math.min(...all), Math.max(...all)];
  const widths = groups.map((group) => bandwidth(group));
  const pad = Math.max(...widths) * 1.5;
  const domain: Domain = [low - pad, high + pad];
  const positions = Array.from({ length: steps }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / (steps - 1));
  const curves = groups.map((group, i) => densityAt(group, widths[i]!, positions));
  return { positions, curves, peak: Math.max(...curves.flat(), Number.MIN_VALUE), domain };
}

export interface TimelineMark { x0: number; x1: number; centre: number; labelX: number; row: number }

/**
 * Places each event on a time axis from `left` for `width` units and gives its
 * label one of four rows (above the axis -1, -2, below +1, +2) so neighbouring
 * labels do not land on each other. `room` is the width a label may take and
 * `bounds` the drawing's edges the label stays inside.
 */
export function timelineLayout(events: ReadonlyArray<{ start: number; end?: number }>, left: number, width: number, room: number, bounds: Domain): TimelineMark[] {
  const first = Math.min(...events.map((event) => event.start));
  const last = Math.max(...events.map((event) => event.end ?? event.start));
  const at = scaleLinear([first, last], [left, left + width]);
  const rows = [-1, 1, -2, 2];
  const used = new Map<number, number>(rows.map((row) => [row, -Infinity]));
  return events.map((event) => {
    const x0 = at(event.start);
    const x1 = at(event.end ?? event.start);
    const centre = (x0 + x1) / 2;
    const labelX = Math.min(bounds[1] - room / 2, Math.max(bounds[0] + room / 2, centre));
    const free = rows.find((row) => used.get(row)! <= labelX - room / 2 - 3);
    const row = free ?? rows.reduce((best, candidate) => (used.get(candidate)! < used.get(best)! ? candidate : best), rows[0]!);
    used.set(row, labelX + room / 2);
    return { x0, x1, centre, labelX, row };
  });
}

/** How strongly a heatmap cell is inked: a floor so the lowest cell still shows, then linear in the value. */
export function heatShade(value: number, [low, high]: Domain): number {
  return 0.14 + 0.86 * (high === low ? 1 : Math.min(1, Math.max(0, (value - low) / (high - low))));
}

/** Where a value sits on a parallel-coordinates axis, 0 at the axis' lowest value and 1 at its highest (a flat axis sits in the middle). */
export function axisShare(value: number, [low, high]: Domain): number {
  return high === low ? 0.5 : (value - low) / (high - low);
}

/** The Lorenz curve's corner points from (0, 0), in fractions of people and of the total. */
export function lorenzPoints(people: readonly number[], share: readonly number[]): Array<{ x: number; y: number }> {
  return [{ x: 0, y: 0 }, ...people.map((x, i) => ({ x, y: share[i]! }))];
}

/** The two ends of a fitted line across an x range. */
export function lineEnds(fit: { slope: number; intercept: number }, [x0, x1]: Domain): [{ x: number; y: number }, { x: number; y: number }] {
  return [{ x: x0, y: fit.slope * x0 + fit.intercept }, { x: x1, y: fit.slope * x1 + fit.intercept }];
}

/** Whole-number steps for a mark of one of the series' markers: shape 0 circle, 1 diamond, 2 triangle (the second channel beside colour). */
export function markerPath(shape: number, x: number, y: number, r: number): string {
  if (shape % 3 === 0) return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  if (shape % 3 === 1) return `M ${x} ${y - r * 1.25} L ${x + r * 1.25} ${y} L ${x} ${y + r * 1.25} L ${x - r * 1.25} ${y} Z`;
  return `M ${x} ${y - r * 1.15} L ${x + r * 1.15} ${y + r * 0.9} L ${x - r * 1.15} ${y + r * 0.9} Z`;
}
