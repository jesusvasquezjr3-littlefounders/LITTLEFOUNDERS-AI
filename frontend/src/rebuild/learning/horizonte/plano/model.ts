/*
 * Plano (Horizonte F0.2): the pure model of the shared SVG plane. Nothing here touches the DOM or React, so the
 * scale, snapping, keyboard and sampling rules are unit-tested alone and a board's scorer can reuse them.
 *
 * Coordinates live in two spaces. Domain space is what the learner reads (x, y). View space is the SVG's viewBox
 * (0..width, 0..height, y growing downwards). The grid is always anchored at 0: a step of 2 snaps to ..., -2, 0, 2, ...
 */

export interface PlanoDomain { xMin: number; xMax: number; yMin: number; yMax: number }
export interface PlanoPoint { x: number; y: number }
/** The plot area in viewBox units. Only the ratio matters on screen; the SVG scales to its container. */
export interface PlanoSize { width: number; height: number }
export type PlanoAxis = 'x' | 'y';
/** `x` or `y` locks a handle to one axis (a slider along that axis). */
export type PlanoAxisLock = 'both' | 'x' | 'y';
/** One step for both axes, or one per axis. */
export type PlanoStep = number | { x: number; y: number };
/** Extra limits for one handle, inside the domain. */
export interface PlanoBounds { xMin?: number; xMax?: number; yMin?: number; yMax?: number }
/** Series hue slot: 1 sky, 2 mint, 3 berry, anything else a neutral mark (Bible 05 §2). */
export type PlanoSeries = 1 | 2 | 3 | 'neutral';

export const PLANO_VIEWBOX: PlanoSize = { width: 600, height: 400 };
/** The handle's hit area on screen (Bible 02 `target-lg`, V4). The CSS draws it with `var(--target-lg)`. */
export const HANDLE_HIT_PX = 64;
/** Shift multiplies the keyboard step by this much. */
export const COARSE_FACTOR = 5;
/** Never draw more gridlines or ticks than this per axis; past it the step is replaced by a nice one. */
export const MAX_LINES = 60;

const MAX_DECIMALS = 8;
const EPSILON = 1e-9;

export function domainProblem(domain: PlanoDomain): string | null {
  const values = [domain.xMin, domain.xMax, domain.yMin, domain.yMax];
  if (!values.every((value) => Number.isFinite(value))) return 'domain must be finite';
  if (!(domain.xMin < domain.xMax)) return 'xMin must be below xMax';
  if (!(domain.yMin < domain.yMax)) return 'yMin must be below yMax';
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How many decimals a step is written with (0.25 gives 2, 5 gives 0). */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(Math.abs(value));
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) return Math.min(MAX_DECIMALS, Number(exponent[1]) + (text.split('e')[0]!.split('.')[1]?.length ?? 0));
  return Math.min(MAX_DECIMALS, text.split('.')[1]?.length ?? 0);
}

/** Rounds away float noise (0.30000000000000004 to 0.3) and never returns -0. */
export function roundTo(value: number, decimals: number): number {
  const rounded = Number(value.toFixed(clamp(decimals, 0, MAX_DECIMALS)));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** A usable positive step, or null (no snapping). */
export function stepFor(step: PlanoStep | null | false | undefined, axis: PlanoAxis): number | null {
  if (step === null || step === undefined || step === false) return null;
  const value = typeof step === 'number' ? step : step[axis];
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The nearest grid value to `value` for a step anchored at 0. */
export function snapToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  return roundTo(Math.round(value / step) * step, decimalsOf(step));
}

const floorToStep = (value: number, step: number) => roundTo(Math.floor(value / step + EPSILON) * step, decimalsOf(step));
const ceilToStep = (value: number, step: number) => roundTo(Math.ceil(value / step - EPSILON) * step, decimalsOf(step));

/**
 * Clamps into [min, max], then snaps to the grid without leaving that range: when the nearest grid value falls
 * outside it, the closest grid value inside is used; when none exists the clamped value stands.
 */
export function snapWithin(value: number, step: number | null, min: number, max: number): number {
  const clamped = clamp(value, min, max);
  if (!step) return clamped;
  const snapped = snapToStep(clamped, step);
  if (snapped > max + EPSILON) { const inside = floorToStep(max, step); return inside >= min - EPSILON ? inside : clamped; }
  if (snapped < min - EPSILON) { const inside = ceilToStep(min, step); return inside <= max + EPSILON ? inside : clamped; }
  return snapped;
}

export interface PlanoScale { toPx(value: number): number; toValue(px: number): number }

/** A linear map from [d0, d1] to [r0, r1]; r0 > r1 inverts it (the y axis). */
export function linearScale(d0: number, d1: number, r0: number, r1: number): PlanoScale {
  const ratio = (r1 - r0) / (d1 - d0);
  return { toPx: (value) => r0 + (value - d0) * ratio, toValue: (px) => d0 + (px - r0) / ratio };
}

export interface PlanoFrame {
  domain: PlanoDomain;
  size: PlanoSize;
  x: PlanoScale;
  y: PlanoScale;
  /** Domain to viewBox units. */
  toView(point: PlanoPoint): PlanoPoint;
  /** viewBox units to domain. */
  toValue(view: PlanoPoint): PlanoPoint;
  /** Domain to a position inside the plot as percentages (0..100), clamped to the plot, for the HTML layer. */
  percent(point: PlanoPoint): { left: number; top: number };
}

export function createFrame(domain: PlanoDomain, size: PlanoSize = PLANO_VIEWBOX): PlanoFrame {
  const problem = domainProblem(domain);
  if (problem) throw new RangeError(`Plano: ${problem}`);
  const x = linearScale(domain.xMin, domain.xMax, 0, size.width);
  const y = linearScale(domain.yMin, domain.yMax, size.height, 0);
  return {
    domain, size, x, y,
    toView: (point) => ({ x: x.toPx(point.x), y: y.toPx(point.y) }),
    toValue: (view) => ({ x: x.toValue(view.x), y: y.toValue(view.y) }),
    percent: (point) => ({
      left: clamp((x.toPx(point.x) / size.width) * 100, 0, 100),
      top: clamp((y.toPx(point.y) / size.height) * 100, 0, 100),
    }),
  };
}

export interface BoxLike { left: number; top: number; width: number; height: number }

/** A pointer position in viewBox units, or null while the plot has no size (not laid out). */
export function clientToView(box: BoxLike, size: PlanoSize, clientX: number, clientY: number): PlanoPoint | null {
  if (!(box.width > 0) || !(box.height > 0)) return null;
  return { x: ((clientX - box.left) / box.width) * size.width, y: ((clientY - box.top) / box.height) * size.height };
}

/** The domain value under a pointer, or null while the plot has no size. */
export function pointerToValue(frame: PlanoFrame, box: BoxLike, clientX: number, clientY: number): PlanoPoint | null {
  const view = clientToView(box, frame.size, clientX, clientY);
  return view ? frame.toValue(view) : null;
}

export interface PlanoConstraints {
  domain: PlanoDomain;
  snap?: PlanoStep | null | false;
  bounds?: PlanoBounds;
  axis?: PlanoAxisLock;
}

/** The domain narrowed by a handle's own bounds; inverted bounds collapse onto the nearest edge. */
export function effectiveBounds(domain: PlanoDomain, bounds: PlanoBounds = {}): PlanoDomain {
  const xMin = clamp(bounds.xMin ?? domain.xMin, domain.xMin, domain.xMax);
  const xMax = clamp(bounds.xMax ?? domain.xMax, xMin, domain.xMax);
  const yMin = clamp(bounds.yMin ?? domain.yMin, domain.yMin, domain.yMax);
  const yMax = clamp(bounds.yMax ?? domain.yMax, yMin, domain.yMax);
  return { xMin, xMax, yMin, yMax };
}

/**
 * The one rule every move goes through (pointer, tap and keyboard): lock the axis against `from`, clamp to the
 * domain and the handle's bounds, snap to the grid inside those limits.
 */
export function resolvePoint(raw: PlanoPoint, from: PlanoPoint, constraints: PlanoConstraints): PlanoPoint {
  const lock = constraints.axis ?? 'both';
  const bounds = effectiveBounds(constraints.domain, constraints.bounds);
  const x = lock === 'y' ? from.x : raw.x;
  const y = lock === 'x' ? from.y : raw.y;
  return {
    x: snapWithin(x, stepFor(constraints.snap, 'x'), bounds.xMin, bounds.xMax),
    y: snapWithin(y, stepFor(constraints.snap, 'y'), bounds.yMin, bounds.yMax),
  };
}

/**
 * The fine keyboard step per axis: the caller's step, else the snap step, else a nice step of about one fiftieth of
 * the span. With a snap grid it is rounded up to a whole number of grid steps, so an arrow key always moves.
 */
export function resolveKeyStep(domain: PlanoDomain, snap?: PlanoStep | null | false, keyStep?: PlanoStep): { x: number; y: number } {
  const one = (axis: PlanoAxis, span: number) => {
    const grid = stepFor(snap, axis);
    const wanted = stepFor(keyStep, axis) ?? grid ?? niceStep(span, 50);
    return grid ? roundTo(Math.max(1, Math.round(wanted / grid)) * grid, decimalsOf(grid)) : wanted;
  };
  return { x: one('x', domain.xMax - domain.xMin), y: one('y', domain.yMax - domain.yMin) };
}

export interface PlanoMoveConfig extends PlanoConstraints {
  /** The fine keyboard step per axis (an arrow key). Shift multiplies it by `coarse`. */
  step: { x: number; y: number };
  coarse?: number;
}

export type PlanoKeyResult = { kind: 'move'; point: PlanoPoint } | { kind: 'switch'; direction: 1 | -1 };

/**
 * What a key does to the focused handle. Arrows move it by the fine step (Shift: coarse); Home and End jump to the
 * lower and upper limit of the horizontal axis (the vertical one for a handle locked to y); Page Up and Page Down
 * pick the previous or next handle. On a locked handle all four arrows run along its axis (up and right add).
 * Returns null for any other key so the browser keeps it.
 */
export function interpretKey(key: string, shift: boolean, point: PlanoPoint, config: PlanoMoveConfig): PlanoKeyResult | null {
  const lock = config.axis ?? 'both';
  const bounds = effectiveBounds(config.domain, config.bounds);
  if (key === 'PageUp') return { kind: 'switch', direction: -1 };
  if (key === 'PageDown') return { kind: 'switch', direction: 1 };
  if (key === 'Home' || key === 'End') {
    const high = key === 'End';
    const raw = lock === 'y'
      ? { x: point.x, y: high ? bounds.yMax : bounds.yMin }
      : { x: high ? bounds.xMax : bounds.xMin, y: point.y };
    return { kind: 'move', point: resolvePoint(raw, point, config) };
  }
  let dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  let dy = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
  if (!dx && !dy) return null;
  if (lock === 'x' && dy) { dx = dy; dy = 0; }
  if (lock === 'y' && dx) { dy = dx; dx = 0; }
  const factor = shift ? config.coarse ?? COARSE_FACTOR : 1;
  const raw = {
    x: roundTo(point.x + dx * config.step.x * factor, Math.max(decimalsOf(config.step.x), decimalsOf(point.x))),
    y: roundTo(point.y + dy * config.step.y * factor, Math.max(decimalsOf(config.step.y), decimalsOf(point.y))),
  };
  return { kind: 'move', point: resolvePoint(raw, point, config) };
}

/** A step of 1, 2 or 5 times a power of ten that gives about `target` intervals over `span`. */
export function niceStep(span: number, target = 5): number {
  if (!(span > 0) || !(target > 0)) return 1;
  const raw = span / target;
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / 10 ** exponent;
  const nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  return roundTo(nice * 10 ** exponent, Math.max(0, -exponent));
}

/** The multiples of `step` inside [min, max], anchored at 0. Empty for a step that is not positive. */
export function ticksAtStep(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) return [];
  const decimals = decimalsOf(step);
  const first = Math.ceil(min / step - EPSILON);
  const last = Math.floor(max / step + EPSILON);
  if (last - first + 1 > MAX_LINES) return ticksAtStep(min, max, niceStep(max - min, MAX_LINES / 4));
  const ticks: number[] = [];
  for (let index = first; index <= last; index++) ticks.push(roundTo(index * step, decimals));
  return ticks;
}

/** Ticks for an axis: the caller's step when given, otherwise a nice step for about `target` ticks. */
export function niceTicks(min: number, max: number, target = 5, step?: number): { ticks: number[]; step: number } {
  const used = step && step > 0 ? step : niceStep(max - min, target);
  return { ticks: ticksAtStep(min, max, used), step: used };
}

const formatters = new Map<string, Intl.NumberFormat>();

/** A number in the learner's locale with at most `maxFractionDigits` decimals; never "-0". */
export function formatPlanoValue(value: number, locale: string, maxFractionDigits = 2): string {
  const digits = clamp(Math.round(maxFractionDigits), 0, MAX_DECIMALS);
  const key = `${locale}|${digits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    formatters.set(key, formatter);
  }
  return formatter.format(roundTo(value, digits));
}

export interface DescribeOptions { locale: string; digits?: number; xLabel?: string; yLabel?: string; axis?: PlanoAxisLock }

/** A point in words for a screen reader and the readout ("x 3, y 4.5"); a handle locked to one axis names that axis only. */
export function describePoint(point: PlanoPoint, options: DescribeOptions): string {
  const digits = options.digits ?? 2;
  const x = `${options.xLabel ?? 'x'} ${formatPlanoValue(point.x, options.locale, digits)}`;
  const y = `${options.yLabel ?? 'y'} ${formatPlanoValue(point.y, options.locale, digits)}`;
  if (options.axis === 'x') return x;
  if (options.axis === 'y') return y;
  // A decimal comma would make "x 3,5, y 4" ambiguous.
  const separator = formatPlanoValue(0.5, options.locale, 1).includes(',') ? '; ' : ', ';
  return `${x}${separator}${y}`;
}

/** A value for a function curve: a callback of x. */
export type PlanoFn = (x: number) => number;

export interface SampleOptions {
  /** Intervals across [from, to] (points = samples + 1). Default 160, at most 600. */
  samples?: number;
  /** The visible y range, so an asymptote's jump can be told from a steep legitimate slope. */
  yMin: number;
  yMax: number;
  /** A jump bigger than this many visible heights between neighbours breaks the line. Default 2. */
  jump?: number;
}

/**
 * Samples a function into runs of points. A run ends where the function is not finite (a gap, a square root of a
 * negative) or jumps across the plot (an asymptote), so the curve is never joined over a break. A callback that
 * throws counts as not finite.
 */
export function sampleCurve(fn: PlanoFn, from: number, to: number, options: SampleOptions): PlanoPoint[][] {
  const intervals = clamp(Math.round(options.samples ?? 160), 2, 600);
  const height = options.yMax - options.yMin;
  const limit = (options.jump ?? 2) * height;
  const far = height * 50;
  const runs: PlanoPoint[][] = [];
  let run: PlanoPoint[] = [];
  let previous: number | null = null;
  const close = () => { if (run.length) runs.push(run); run = []; previous = null; };
  for (let index = 0; index <= intervals; index++) {
    const x = from + ((to - from) * index) / intervals;
    let y = Number.NaN;
    try { y = fn(x); } catch { y = Number.NaN; }
    if (!Number.isFinite(y)) { close(); continue; }
    if (previous !== null && Math.abs(y - previous) > limit) close();
    previous = y;
    run.push({ x, y: clamp(y, options.yMin - far, options.yMax + far) });
  }
  close();
  return runs;
}

const fixed = (value: number) => (Math.round(value * 100) / 100).toString();

/** An SVG path through runs of domain points (runs shorter than two points draw nothing). */
export function pathFromRuns(runs: readonly (readonly PlanoPoint[])[], frame: PlanoFrame): string {
  return runs.filter((run) => run.length > 1).map((run) => run.map((point, index) => {
    const view = frame.toView(point);
    return `${index ? 'L' : 'M'}${fixed(view.x)},${fixed(view.y)}`;
  }).join('')).join('');
}

export function pathFromPoints(points: readonly PlanoPoint[], frame: PlanoFrame, closed = false): string {
  const path = pathFromRuns([points], frame);
  return path && closed ? `${path}Z` : path;
}

/** A bound of a shaded region: a constant y, or a curve of x. */
export type PlanoBound = number | PlanoFn;

export interface PlanoBetween { upper: PlanoBound; lower: PlanoBound; from: number; to: number; samples?: number }

const boundAt = (bound: PlanoBound, x: number) => (typeof bound === 'number' ? bound : bound(x));

/** The outline of a region: its own polygon, or the band between two bounds across [from, to]. */
export function regionPolygon(region: { points?: readonly PlanoPoint[]; between?: PlanoBetween }): PlanoPoint[] {
  if (region.points) return region.points.map((point) => ({ x: point.x, y: point.y }));
  const between = region.between;
  if (!between) return [];
  const intervals = clamp(Math.round(between.samples ?? 80), 1, 400);
  const along: number[] = [];
  for (let index = 0; index <= intervals; index++) along.push(between.from + ((between.to - between.from) * index) / intervals);
  const sample = (bound: PlanoBound) => along.flatMap((x) => {
    let y = Number.NaN;
    try { y = boundAt(bound, x); } catch { y = Number.NaN; }
    return Number.isFinite(y) ? [{ x, y }] : [];
  });
  return [...sample(between.upper), ...sample(between.lower).reverse()];
}

/** The corners a table can name for a region: all vertices of a polygon, or the four corners of a band. */
export function regionCorners(region: { points?: readonly PlanoPoint[]; between?: PlanoBetween }): PlanoPoint[] {
  if (region.points) return region.points.map((point) => ({ x: point.x, y: point.y }));
  const between = region.between;
  if (!between) return [];
  const corner = (bound: PlanoBound, x: number) => {
    let y = Number.NaN;
    try { y = boundAt(bound, x); } catch { y = Number.NaN; }
    return Number.isFinite(y) ? [{ x, y }] : [];
  };
  return [...corner(between.upper, between.from), ...corner(between.upper, between.to), ...corner(between.lower, between.to), ...corner(between.lower, between.from)];
}

export interface PlanoPointLayer { id: string; x: number; y: number; label?: string; series?: PlanoSeries }
export interface PlanoPolylineLayer { id: string; points: readonly PlanoPoint[]; label?: string; series?: PlanoSeries }
export interface PlanoCurveLayer { id: string; fn: PlanoFn; from?: number; to?: number; samples?: number; label?: string; series?: PlanoSeries }
export interface PlanoRegionLayer { id: string; points?: readonly PlanoPoint[]; between?: PlanoBetween; label?: string; series?: PlanoSeries }
export interface PlanoHandleLayer {
  id: string; x: number; y: number;
  /** The handle's accessible name, and its name in the table and the announcements. */
  label: string;
  /** A short visible tag next to the handle (a numeral or one word); the accessible name stays `label`. */
  caption?: string;
  series?: PlanoSeries;
  axis?: PlanoAxisLock;
  bounds?: PlanoBounds;
  disabled?: boolean;
}

export interface PlanoTableRow { id: string; name: string; x: number; y: number }

export interface PlanoLayers {
  points?: readonly PlanoPointLayer[];
  polylines?: readonly PlanoPolylineLayer[];
  curves?: readonly PlanoCurveLayer[];
  regions?: readonly PlanoRegionLayer[];
  handles?: readonly PlanoHandleLayer[];
}

/**
 * The rows of the show-as-table equivalent, from the same layers the plane draws, so the picture and the table
 * cannot disagree: every handle and point, every vertex of a polyline or region, and each curve read at the x ticks.
 */
export function buildTableRows(layers: PlanoLayers, domain: PlanoDomain, xTicks: readonly number[]): PlanoTableRow[] {
  const rows: PlanoTableRow[] = [];
  const numbered = (id: string, label: string | undefined, points: readonly PlanoPoint[]) => points.forEach((point, index) => {
    rows.push({ id: `${id}:${index}`, name: points.length > 1 ? `${label ?? id} ${index + 1}` : label ?? id, x: point.x, y: point.y });
  });
  for (const handle of layers.handles ?? []) rows.push({ id: handle.id, name: handle.label, x: handle.x, y: handle.y });
  for (const point of layers.points ?? []) rows.push({ id: point.id, name: point.label ?? point.id, x: point.x, y: point.y });
  for (const line of layers.polylines ?? []) numbered(line.id, line.label, line.points);
  for (const curve of layers.curves ?? []) {
    const from = curve.from ?? domain.xMin;
    const to = curve.to ?? domain.xMax;
    const samples: PlanoPoint[] = [];
    for (const x of xTicks) {
      if (x < from - EPSILON || x > to + EPSILON) continue;
      let y = Number.NaN;
      try { y = curve.fn(x); } catch { y = Number.NaN; }
      if (Number.isFinite(y)) samples.push({ x, y: roundTo(y, MAX_DECIMALS) });
    }
    numbered(curve.id, curve.label, samples);
  }
  for (const region of layers.regions ?? []) numbered(region.id, region.label, regionCorners(region));
  return rows;
}

/** The series slot of each line-like layer: its own `series`, else the next of sky, mint and berry in drawing order. */
export function assignSeries(layers: PlanoLayers): { polylines: PlanoSeries[]; curves: PlanoSeries[]; regions: PlanoSeries[] } {
  let index = 0;
  const pick = (series: PlanoSeries | undefined): PlanoSeries => {
    const fallback = ((index % 3) + 1) as 1 | 2 | 3;
    index += 1;
    return series ?? fallback;
  };
  return {
    polylines: (layers.polylines ?? []).map((layer) => pick(layer.series)),
    curves: (layers.curves ?? []).map((layer) => pick(layer.series)),
    regions: (layers.regions ?? []).map((layer) => pick(layer.series)),
  };
}
