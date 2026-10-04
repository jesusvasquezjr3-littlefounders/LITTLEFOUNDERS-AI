import { z } from 'zod';

/*
 * Canonical chart model for the v2 teaching-chart segment (GAP-FIX-R1
 * learning; B.7 part 1, Appendix A Part 1, Bible 05 V1/V6). Core validates
 * every delivered chart with it, and the browser draws from the generated
 * copy (frontend/src/rebuild/learning/charts/chartModel.generated.ts,
 * agent/tools/sync-v2-chart-model.mjs, spec:check), so the numbers a learner
 * reads, the Show-as-table rows and the accessible description are computed
 * once. Self-contained (zod only): the file is copied byte for byte.
 */

/** Appendix A Part 1 "Core" types: every one ships in the first release. */
export const CORE_CHART_KINDS = [
  'bar', 'column', 'grouped-bar', 'stacked-bar', 'diverging-bar', 'pie', 'donut', 'waterfall', 'radar', 'bullet',
  'line', 'area', 'stacked-area', 'time-series', 'sparkline', 'calendar-heatmap', 'scatter', 'bubble', 'sankey',
  'flowchart', 'decision-tree', 'tree', 'pictogram', 'waffle', 'stat-tile',
] as const;

/**
 * Appendix A Part 1 "Situational" types, each gated by age pathway and course
 * subject (SITUATIONAL_CHART_GATES). GAP-FIX-R2 (B.7 part 1) adds the learner-
 * facing situational kinds the first round left out: candlestick (OHLC),
 * Marimekko, treemap, sunburst, icicle, box plot, connected scatter, bump,
 * org chart, swimlane, Venn (as a counted chart; the Euler placement task
 * stays `logic.euler.v2`), Ishikawa (fishbone) and mind map. Strip plot and
 * funnel stay out: Appendix A names no learner use for them.
 */
export const SITUATIONAL_CHART_KINDS = ['stacked-bar-100', 'stacked-area-100', 'lollipop', 'slope', 'step', 'histogram', 'pareto', 'gauge',
  'candlestick', 'marimekko', 'treemap', 'sunburst', 'icicle', 'box-plot', 'connected-scatter', 'bump', 'org-chart', 'swimlane', 'venn',
  'ishikawa', 'mind-map'] as const;
/**
 * Horizonte F1.0: twelve reading charts. Each one answers a question a learner
 * asks of a table of numbers (which row is biggest, how far did it move, how
 * unequal is it, how sure is the forecast, what shape do the samples take).
 * They live in their own list so the 46 earlier kinds and their gates stay
 * pinned; the browser draws them from one lazy chunk (charts/readingCharts.tsx).
 */
export const READING_CHART_KINDS = ['dot-plot', 'dumbbell', 'xy-heatmap', 'error-bars', 'funnel', 'lorenz-curve', 'fan-chart', 'density-plot',
  'violin-plot', 'timeline', 'scatter-regression', 'parallel-coordinates'] as const;
export type ReadingChartKind = (typeof READING_CHART_KINDS)[number];
export const CHART_KINDS = [...CORE_CHART_KINDS, ...SITUATIONAL_CHART_KINDS, ...READING_CHART_KINDS] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

const READING_SET = new Set<string>(READING_CHART_KINDS);
export function isReadingChart(kind: string): kind is ReadingChartKind {
  return READING_SET.has(kind);
}

type AgeBand = '6-9' | '10-12' | '13-17' | 'adult';
type ChartGate = { bands: readonly AgeBand[]; subjects: readonly string[] | null };
/** Appendix A's gate for each situational type: the age pathways and course subjects it may appear in (null: any subject). */
export const SITUATIONAL_CHART_GATES: Readonly<Record<(typeof SITUATIONAL_CHART_KINDS)[number], ChartGate>> = {
  'stacked-bar-100': { bands: ['13-17', 'adult'], subjects: null }, // teens comparing allocation strategies
  'stacked-area-100': { bands: ['13-17', 'adult'], subjects: null }, // teens, longer horizons
  lollipop: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // long skill lists
  slope: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // this month vs last
  step: { bands: ['13-17', 'adult'], subjects: ['financial-education', 'investing'] }, // rate changes, tax brackets
  histogram: { bands: ['13-17', 'adult'], subjects: null }, // teens, spread of a variable
  pareto: { bands: ['13-17', 'adult'], subjects: ['entrepreneurship', 'financial-education'] }, // which expenses drive most spending
  gauge: { bands: ['13-17', 'adult'], subjects: null }, // one hero KPI, used sparingly
  candlestick: { bands: ['13-17', 'adult'], subjects: ['investing'] }, // Investing course, teens only (and the adult chapters)
  marimekko: { bands: ['13-17', 'adult'], subjects: ['entrepreneurship'] }, // teens, market-share style Entrepreneurship content
  treemap: { bands: ['13-17', 'adult'], subjects: ['investing'] }, // portfolio holdings by sector (Investing, teens)
  sunburst: { bands: ['13-17', 'adult'], subjects: null }, // spending category -> subcategory drill-down
  icicle: { bands: ['13-17', 'adult'], subjects: null }, // same use as sunburst, alternate layout
  'box-plot': { bands: ['13-17', 'adult'], subjects: null }, // teens, comparing cohort savings amounts
  'connected-scatter': { bands: ['13-17', 'adult'], subjects: ['investing'] }, // teens, price vs. time in Investing
  bump: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // "most popular savings goals this month"
  'org-chart': { bands: ['13-17', 'adult'], subjects: ['entrepreneurship'] }, // Entrepreneurship, "build your team"
  swimlane: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // "parent approval -> child request -> bank" process explainer
  venn: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // "savers AND investors AND budgeters", 2-3 sets
  ishikawa: { bands: ['13-17', 'adult'], subjects: ['entrepreneurship'] }, // teens: "why did my business idea fail"
  'mind-map': { bands: ['10-12', '13-17', 'adult'], subjects: null }, // organizing a broad topic (plan and notebook)
};

const FROM_TEN: readonly AgeBand[] = ['10-12', '13-17', 'adult'];
const FROM_THIRTEEN: readonly AgeBand[] = ['13-17', 'adult'];
/** F1.0 gates: none of the twelve opens to 6-9; the plain comparisons start at 10, the statistical readings at 13. */
export const READING_CHART_GATES: Readonly<Record<ReadingChartKind, ChartGate>> = {
  'dot-plot': { bands: FROM_TEN, subjects: null }, // ranking many rows without a bar's ink
  dumbbell: { bands: FROM_TEN, subjects: null }, // before and after, or me and the class
  'xy-heatmap': { bands: FROM_TEN, subjects: null }, // two things at once: day by activity
  'error-bars': { bands: FROM_THIRTEEN, subjects: null }, // how sure an average is
  funnel: { bands: FROM_TEN, subjects: ['entrepreneurship'] }, // visitors to buyers
  'lorenz-curve': { bands: FROM_THIRTEEN, subjects: ['financial-education'] }, // how evenly money is shared
  'fan-chart': { bands: FROM_THIRTEEN, subjects: ['investing', 'financial-education'] }, // a forecast that widens
  'density-plot': { bands: FROM_THIRTEEN, subjects: null }, // the shape of a sample
  'violin-plot': { bands: FROM_THIRTEEN, subjects: null }, // shapes side by side
  timeline: { bands: FROM_TEN, subjects: null }, // events and spans in order
  'scatter-regression': { bands: FROM_TEN, subjects: null }, // a trend through the dots
  'parallel-coordinates': { bands: FROM_THIRTEEN, subjects: null }, // several measures per item
};

/** The subject a course id belongs to (course ids start with their subject). */
export function chartSubject(courseId: string): string {
  return ['financial-education', 'investing', 'entrepreneurship'].find((subject) => courseId === subject || courseId.startsWith(`${subject}-`)) ?? courseId;
}

/** Whether a chart kind may appear in a document of this pathway and course. Core types are always allowed. */
export function chartAllowed(kind: ChartKind, ageBand: AgeBand, courseId: string): boolean {
  const gate = (SITUATIONAL_CHART_GATES as Record<string, ChartGate>)[kind] ?? (READING_CHART_GATES as Record<string, ChartGate>)[kind];
  if (!gate) return true;
  return gate.bands.includes(ageBand) && (gate.subjects === null || gate.subjects.includes(chartSubject(courseId)));
}

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const label = z.string().trim().min(1).max(40);
const finite = z.number().finite().min(-1_000_000_000).max(1_000_000_000);

export const chartDataSchema = z.object({
  unit: z.enum(['coins', 'local', 'percent', 'count', 'days', 'points']),
  categories: z.array(z.object({ id, label }).strict()).max(12).default([]),
  /** Up to three series: sky, mint and berry, each also carried by a pattern. */
  series: z.array(z.object({ id, label, values: z.array(finite).max(12), /** F1.0 error bars: the half-width of each value's whisker. */ error: z.array(z.number().finite().min(0).max(1_000_000_000)).max(12).optional() }).strict()).max(3).default([]),
  target: finite.optional(),
  bands: z.array(finite).max(3).optional(),
  points: z.array(z.object({ id, label, x: finite, y: finite, size: z.number().finite().positive().max(1_000_000).optional() }).strict()).max(30).optional(),
  // GAP-FIX-R2: a hierarchy leaf's value (treemap, sunburst, icicle) and a node's lane (swimlane, a category id).
  nodes: z.array(z.object({ id, label, kind: z.enum(['start', 'step', 'question', 'outcome']).optional(),
    value: z.number().finite().positive().max(1_000_000_000).optional(), lane: id.optional() }).strict()).max(16).optional(),
  links: z.array(z.object({ from: id, to: id, value: z.number().finite().positive().max(1_000_000_000).optional(), label: z.string().trim().min(1).max(20).optional() }).strict()).max(24).optional(),
  days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().int().min(0).max(1_000) }).strict()).max(42).optional(),
  icon_value: z.number().int().positive().max(1_000).optional(),
  stat: z.object({ value: finite, delta: finite.optional() }).strict().optional(),
  /** GAP-FIX-R2 candlestick: open, high, low and close per period. */
  ohlc: z.array(z.object({ id, label, open: finite, high: finite, low: finite, close: finite }).strict()).max(20).optional(),
  /** GAP-FIX-R2 box plot: the five-number summary per group. */
  boxes: z.array(z.object({ id, label, min: finite, q1: finite, median: finite, q3: finite, max: finite }).strict()).max(6).optional(),
  /** GAP-FIX-R2 Venn: the count in each region, named by the category (set) ids it belongs to. */
  regions: z.array(z.object({ sets: z.array(id).min(1).max(3), value: z.number().int().min(0).max(1_000_000) }).strict()).max(7).optional(),
  /** F1.0 XY heatmap: the categories are the columns, `rows` the other axis, `cells` one value per column and row pair. */
  rows: z.array(z.object({ id, label }).strict()).max(8).optional(),
  cells: z.array(z.object({ col: id, row: id, value: finite }).strict()).max(96).optional(),
  /** F1.0 fan chart: nested ranges (a confidence level in percent) around the one central series, one low and high per category. */
  ranges: z.array(z.object({ level: z.number().int().min(50).max(99), low: z.array(finite).max(12), high: z.array(finite).max(12) }).strict()).max(2).optional(),
  /** F1.0 density and violin plots: the raw sample of each group (the browser smooths it). */
  samples: z.array(z.object({ id, label, values: z.array(finite).min(5).max(60) }).strict()).max(3).optional(),
  /** F1.0 timeline: a day, or a span when `end` is set; calendar days, in date order. */
  events: z.array(z.object({ id, label, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict()).max(12).optional(),
  /** F1.0 parallel coordinates: one record per line, one value per axis (the categories are the axes). */
  records: z.array(z.object({ id, label, values: z.array(finite).max(6) }).strict()).max(8).optional(),
}).strict();
export type ChartData = z.infer<typeof chartDataSchema>;

const SERIES_KINDS = new Set<ChartKind>(['bar', 'column', 'grouped-bar', 'stacked-bar', 'diverging-bar', 'pie', 'donut', 'waterfall', 'radar', 'bullet',
  'line', 'area', 'stacked-area', 'time-series', 'sparkline', 'pictogram', 'waffle', 'stat-tile', 'stacked-bar-100', 'stacked-area-100', 'lollipop',
  'slope', 'step', 'histogram', 'pareto', 'gauge', 'marimekko', 'bump', 'dot-plot', 'dumbbell', 'error-bars', 'funnel', 'lorenz-curve', 'fan-chart']);
const TREE_KINDS = new Set<ChartKind>(['tree', 'decision-tree', 'treemap', 'sunburst', 'icicle', 'org-chart', 'ishikawa', 'mind-map']);

/** A single-rooted tree over the nodes and links, or why not: root id, children and depth per node. */
export function chartTree(data: ChartData): { root: string; children: Map<string, string[]>; depth: Map<string, number> } | string {
  const nodes = data.nodes ?? []; const links = data.links ?? [];
  if (nodes.length < 2) return 'a hierarchy needs nodes and links';
  const ids = new Set(nodes.map((node) => node.id));
  if (links.some((l) => !ids.has(l.from) || !ids.has(l.to) || l.from === l.to)) return 'a hierarchy link joins two known nodes';
  const parent = new Map<string, string>();
  for (const link of links) { if (parent.has(link.to)) return 'a tree node has one parent'; parent.set(link.to, link.from); }
  const roots = nodes.filter((node) => !parent.has(node.id));
  if (roots.length !== 1) return 'a diagram has exactly one start';
  const children = new Map<string, string[]>();
  for (const link of links) children.set(link.from, [...(children.get(link.from) ?? []), link.to]);
  const depth = new Map<string, number>([[roots[0]!.id, 0]]);
  const queue = [roots[0]!.id];
  while (queue.length) { const at = queue.shift()!; for (const child of children.get(at) ?? []) { if (depth.has(child)) return 'a hierarchy has no cycles'; depth.set(child, depth.get(at)! + 1); queue.push(child); } }
  if (depth.size !== nodes.length) return 'every node hangs from the start';
  return { root: roots[0]!.id, children, depth };
}

/** A hierarchy node's value: its own value at a leaf, the sum of its children above. */
export function hierarchyValue(data: ChartData, nodeId: string, children: Map<string, string[]>): number {
  const kids = children.get(nodeId) ?? [];
  if (kids.length === 0) return data.nodes?.find((node) => node.id === nodeId)?.value ?? 0;
  return kids.reduce((sum, kid) => sum + hierarchyValue(data, kid, children), 0);
}

/** The p-th quantile (0..1) of an ascending list, by linear interpolation between the two nearest values. */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const at = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
}

/** The five-number summary, count and mean of a sample. */
export function sampleSummary(values: readonly number[]): { n: number; min: number; q1: number; median: number; q3: number; max: number; mean: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: sorted.length, min: sorted[0] ?? 0, q1: quantile(sorted, 0.25), median: quantile(sorted, 0.5), q3: quantile(sorted, 0.75), max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0 };
}

/** Least-squares line through the points, with its R squared; null when every x is the same. */
export function regressionFit(points: ReadonlyArray<{ x: number; y: number }>): { slope: number; intercept: number; r2: number } | null {
  if (points.length < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / points.length;
  const my = points.reduce((a, p) => a + p.y, 0) / points.length;
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const syy = points.reduce((a, p) => a + (p.y - my) ** 2, 0);
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

/** Lorenz curve of one series: the groups from smallest to largest, the cumulative share of people and of the total at each, and the Gini index. */
export function lorenzCurve(values: readonly number[]): { order: number[]; people: number[]; share: number[]; gini: number } {
  const order = values.map((_, index) => index).sort((a, b) => values[a]! - values[b]! || a - b);
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let run = 0;
  const people = order.map((_, i) => (i + 1) / order.length);
  const share = order.map((index) => { run += Math.max(0, values[index]!); return run / total; });
  const area = share.reduce((sum, value, i) => sum + (value + (share[i - 1] ?? 0)) / (2 * order.length), 0);
  return { order, people, share, gini: Math.min(1, Math.max(0, 1 - 2 * area)) };
}

/** Funnel stages: each value with its share of the first stage and of the stage before, in percent. */
export function funnelSteps(values: readonly number[]): Array<{ value: number; ofFirst: number; ofPrevious: number }> {
  return values.map((value, i) => ({ value, ofFirst: values[0]! > 0 ? (value / values[0]!) * 100 : 0,
    ofPrevious: i === 0 ? 100 : values[i - 1]! > 0 ? (value / values[i - 1]!) * 100 : 0 }));
}

/** A calendar day (YYYY-MM-DD) as a whole day number since 1970-01-01, or NaN when it is not a real day. */
export function dayNumber(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return Number.NaN;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
  const at = new Date(Date.UTC(year, month - 1, date));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === date ? at.getTime() / 86_400_000 : Number.NaN;
}

/** One axis of parallel coordinates: the lowest and highest value any record has there. */
export function axisExtent(data: ChartData, axis: number): [number, number] {
  const values = (data.records ?? []).map((record) => record.values[axis] ?? 0);
  return [Math.min(...values), Math.max(...values)];
}

/** A heatmap cell's value (0 when the pair has none). */
export function heatValue(data: ChartData, col: string, row: string): number {
  return data.cells?.find((cell) => cell.col === col && cell.row === row)?.value ?? 0;
}

/** Why a chart's data does not fit its kind, or null. The rules each renderer relies on (and the overflow rule) live here. */
export function chartProblem(kind: ChartKind, data: ChartData): string | null {
  const n = data.categories.length;
  const seriesOk = data.series.length > 0 && data.series.every((series) => series.values.length === n);
  if (SERIES_KINDS.has(kind) && !seriesOk && kind !== 'stat-tile' && kind !== 'gauge' && kind !== 'bullet') return 'every series needs one value per category';
  if (new Set([...data.categories.map((c) => c.id), ...data.series.map((s) => s.id)]).size !== n + data.series.length) return 'duplicate ids';
  const values = data.series.flatMap((series) => series.values);
  if (isReadingChart(kind) && [...data.categories, ...data.series, ...(data.rows ?? []), ...(data.samples ?? []), ...(data.events ?? []), ...(data.records ?? []), ...(data.points ?? [])].some((item) => item.label.startsWith('~'))) return 'a label does not start with ~';
  switch (kind) {
    case 'pie': case 'donut':
      // Appendix A: a pie reads for at most five or six parts; more goes to a bar chart.
      if (n < 2 || n > 6 || data.series.length !== 1 || values.some((v) => v < 0) || values.reduce((a, b) => a + b, 0) <= 0) return 'a pie needs 2-6 non-negative parts of one series';
      return null;
    case 'waffle':
      if (data.series.length !== 1 || values.some((v) => v < 0 || !Number.isInteger(v)) || values.reduce((a, b) => a + b, 0) !== 100) return 'a waffle needs whole percentages that add up to 100';
      return null;
    case 'pictogram':
      if (!data.icon_value || data.series.length !== 1 || values.some((v) => v < 0 || v % data.icon_value! !== 0 || v / data.icon_value! > 20)) return 'a pictogram needs values in whole icons (at most 20 per row)';
      return null;
    case 'stacked-bar': case 'stacked-bar-100': case 'stacked-area': case 'stacked-area-100': case 'grouped-bar':
      if (data.series.length < 2 || (kind !== 'grouped-bar' && values.some((v) => v < 0))) return 'a stacked or grouped chart needs 2-3 non-negative series';
      return null;
    case 'waterfall':
      if (data.series.length !== 1 || n < 2) return 'a waterfall needs one series of steps';
      return null;
    case 'radar':
      if (n < 3 || values.some((v) => v < 0)) return 'a radar needs at least three non-negative axes';
      return null;
    case 'bullet': case 'gauge':
      if (data.stat === undefined || data.target === undefined || data.target <= 0) return 'a bullet or gauge needs a value and a target';
      return null;
    case 'stat-tile':
      return data.stat === undefined ? 'a stat tile needs its value' : null;
    case 'slope':
      return n !== 2 ? 'a slope chart compares exactly two points in time' : null;
    case 'histogram': case 'pareto':
      return values.some((v) => v < 0) || data.series.length !== 1 ? 'counts are one non-negative series' : null;
    case 'scatter': case 'bubble':
      if (!data.points || data.points.length < 3 || (kind === 'bubble') !== data.points.every((p) => p.size !== undefined)) return 'scatter needs 3+ points; bubbles need a size on every point';
      return null;
    case 'calendar-heatmap':
      return !data.days || data.days.length < 7 ? 'a calendar heatmap needs at least one week of days' : null;
    case 'sankey': {
      if (!data.nodes || !data.links || data.links.some((l) => l.value === undefined)) return 'a Sankey needs nodes and valued links';
      const ids = new Set(data.nodes.map((node) => node.id));
      if (data.links.some((l) => !ids.has(l.from) || !ids.has(l.to) || l.from === l.to)) return 'a Sankey link joins two known nodes';
      // Conservation: every middle node passes on exactly what flows in.
      for (const node of data.nodes) {
        const inflow = data.links.filter((l) => l.to === node.id).reduce((s, l) => s + l.value!, 0);
        const outflow = data.links.filter((l) => l.from === node.id).reduce((s, l) => s + l.value!, 0);
        if (inflow > 0 && outflow > 0 && Math.abs(inflow - outflow) > 1e-9) return `flow into ${node.id} must equal flow out`;
      }
      return null;
    }
    case 'candlestick': {
      const rows = data.ohlc ?? [];
      if (rows.length < 2 || new Set(rows.map((row) => row.id)).size !== rows.length) return 'a candlestick chart needs two or more periods';
      if (rows.some((row) => row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close) || row.low < 0)) return 'each candle keeps low <= open, close <= high';
      return null;
    }
    case 'box-plot': {
      const rows = data.boxes ?? [];
      if (rows.length < 1 || new Set(rows.map((row) => row.id)).size !== rows.length) return 'a box plot needs one or more groups';
      if (rows.some((row) => !(row.min <= row.q1 && row.q1 <= row.median && row.median <= row.q3 && row.q3 <= row.max))) return 'each box keeps min <= q1 <= median <= q3 <= max';
      return null;
    }
    case 'marimekko':
      if (n < 2 || data.series.length < 2 || values.some((v) => v < 0) || data.categories.some((_, i) => data.series.every((series) => (series.values[i] ?? 0) === 0))) return 'a Marimekko needs 2+ columns of 2-3 non-negative series, no empty column';
      return null;
    case 'bump': {
      if (n < 2 || data.series.length < 2) return 'a bump chart ranks 2-3 series over 2+ periods';
      for (let i = 0; i < n; i += 1) {
        const ranks = data.series.map((series) => series.values[i]).sort((a, b) => (a ?? 0) - (b ?? 0));
        if (ranks.some((rank, index) => rank !== index + 1)) return 'each period ranks the series 1..k with no ties';
      }
      return null;
    }
    case 'connected-scatter':
      return !data.points || data.points.length < 3 ? 'a connected scatter needs 3+ points in time order' : null;
    case 'venn': {
      const sets = data.categories.map((c) => c.id);
      const regions = data.regions ?? [];
      if (sets.length < 2 || sets.length > 3 || regions.length < 1) return 'a Venn chart counts regions of 2-3 sets';
      const keys = regions.map((region) => [...region.sets].sort().join('+'));
      if (new Set(keys).size !== keys.length || regions.some((region) => region.sets.some((set) => !sets.includes(set)) || new Set(region.sets).size !== region.sets.length)) return 'each Venn region names distinct known sets once';
      return null;
    }
    case 'swimlane': {
      const lanes = data.categories.map((c) => c.id);
      if (lanes.length < 2 || lanes.length > 4 || !data.nodes || data.nodes.length < 2 || !data.links) return 'a swimlane needs 2-4 lanes and linked steps';
      if (data.nodes.some((node) => !node.lane || !lanes.includes(node.lane))) return 'every swimlane step sits in a lane';
      const ids = new Set(data.nodes.map((node) => node.id));
      if (data.links.some((l) => !ids.has(l.from) || !ids.has(l.to))) return 'a diagram link joins two known nodes';
      return null;
    }
    case 'treemap': case 'sunburst': case 'icicle': case 'org-chart': case 'ishikawa': case 'mind-map': {
      const tree = chartTree(data);
      if (typeof tree === 'string') return tree;
      const maxDepth = Math.max(...tree.depth.values());
      if (kind === 'treemap' || kind === 'sunburst' || kind === 'icicle') {
        const leaves = (data.nodes ?? []).filter((node) => !(tree.children.get(node.id)?.length));
        if (leaves.some((node) => node.value === undefined) || (data.nodes ?? []).some((node) => tree.children.get(node.id)?.length && node.value !== undefined)) return 'every leaf carries a value; parents are their children\'s sum';
        if (maxDepth > 3) return 'a hierarchy chart shows at most three levels';
      }
      if (kind === 'ishikawa' && (maxDepth !== 2 || (tree.children.get(tree.root) ?? []).length < 2 || (tree.children.get(tree.root) ?? []).length > 6)) return 'a fishbone has one effect, 2-6 cause bones and their causes';
      if ((kind === 'mind-map' || kind === 'org-chart') && maxDepth > 3) return 'a map shows at most three levels';
      return null;
    }
    case 'dot-plot':
      return n < 2 || n > 6 ? 'a dot plot ranks 2-6 rows' : null;
    case 'dumbbell':
      return n < 2 || n > 6 || data.series.length !== 2 ? 'a dumbbell compares two series over 2-6 rows' : null;
    case 'error-bars':
      return n < 2 || data.series.some((series) => series.error?.length !== n) ? 'error bars need two or more categories and one error per value' : null;
    case 'funnel':
      if (n < 2 || n > 6 || data.series.length !== 1 || values.some((v) => v < 0) || !(values[0]! > 0) || values.some((v, i) => i > 0 && v > values[i - 1]!)) return 'a funnel needs 2-6 stages that never grow, from a first stage above zero';
      return null;
    case 'lorenz-curve':
      if (n < 3 || data.series.length !== 1 || values.some((v) => v < 0) || values.reduce((a, b) => a + b, 0) <= 0) return 'a Lorenz curve needs 3+ groups of one non-negative series';
      return null;
    case 'fan-chart': {
      const ranges = data.ranges ?? []; const centre = data.series[0]?.values ?? [];
      if (n < 3 || data.series.length !== 1 || ranges.length < 1) return 'a fan chart needs 3+ periods, one central path and 1-2 ranges';
      if (ranges.some((range) => range.low.length !== n || range.high.length !== n || centre.some((v, i) => range.low[i]! > v || range.high[i]! < v))) return 'each range holds the central path between its low and high';
      for (let i = 1; i < ranges.length; i += 1) {
        const inner = ranges[i - 1]!; const outer = ranges[i]!;
        if (outer.level <= inner.level || outer.low.some((v, k) => v > inner.low[k]!) || outer.high.some((v, k) => v < inner.high[k]!)) return 'the wider range holds the narrower one';
      }
      return null;
    }
    case 'density-plot': case 'violin-plot': {
      const groups = data.samples ?? [];
      if (groups.length < 1 || new Set(groups.map((group) => group.id)).size !== groups.length) return 'a distribution chart needs 1-3 sample groups';
      if (groups.some((group) => Math.max(...group.values) === Math.min(...group.values))) return 'every sample group needs some spread';
      return null;
    }
    case 'timeline': {
      const events = data.events ?? [];
      if (events.length < 2 || new Set(events.map((event) => event.id)).size !== events.length) return 'a timeline needs two or more events';
      const days = events.map((event) => ({ start: dayNumber(event.date), end: event.end === undefined ? undefined : dayNumber(event.end) }));
      if (days.some((day) => Number.isNaN(day.start) || (day.end !== undefined && (Number.isNaN(day.end) || day.end < day.start)))) return 'timeline dates are real days and an event ends on or after it starts';
      if (days.some((day, i) => i > 0 && day.start < days[i - 1]!.start)) return 'timeline events run in date order';
      if (Math.max(...days.map((day) => day.end ?? day.start)) === days[0]!.start) return 'a timeline spans more than one day';
      return null;
    }
    case 'scatter-regression': {
      const points = data.points ?? [];
      if (points.length < 4 || new Set(points.map((point) => point.id)).size !== points.length) return 'a regression chart needs 4+ points';
      if (!regressionFit(points) || new Set(points.map((point) => point.y)).size < 2) return 'a regression chart needs x and y to vary';
      return null;
    }
    case 'xy-heatmap': {
      const rows = data.rows ?? []; const cells = data.cells ?? [];
      if (n < 2 || rows.length < 2 || cells.length !== n * rows.length) return 'a heatmap needs 2+ columns, 2+ rows and one cell for each pair';
      if (new Set(rows.map((row) => row.id)).size !== rows.length) return 'duplicate ids';
      if (new Set(cells.map((cell) => `${cell.row}|${cell.col}`)).size !== cells.length || cells.some((cell) => !rows.some((row) => row.id === cell.row) || !data.categories.some((c) => c.id === cell.col))) return 'each heatmap cell names a known column and row once';
      return null;
    }
    case 'parallel-coordinates': {
      const records = data.records ?? [];
      if (n < 3 || n > 6 || records.length < 2 || records.length > 8 || new Set(records.map((record) => record.id)).size !== records.length || records.some((record) => record.values.length !== n)) return 'parallel coordinates need 3-6 axes and 2-8 records with one value per axis';
      return null;
    }
    case 'flowchart': case 'decision-tree': case 'tree': {
      if (!data.nodes || data.nodes.length < 2 || !data.links) return 'a diagram needs nodes and links';
      const ids = new Set(data.nodes.map((node) => node.id));
      if (data.links.some((l) => !ids.has(l.from) || !ids.has(l.to))) return 'a diagram link joins two known nodes';
      const parents = new Map<string, number>();
      for (const link of data.links) parents.set(link.to, (parents.get(link.to) ?? 0) + 1);
      const roots = data.nodes.filter((node) => !parents.has(node.id));
      if (roots.length !== 1) return 'a diagram has exactly one start';
      if (kind !== 'flowchart' && [...parents.values()].some((count) => count > 1)) return 'a tree node has one parent';
      return null;
    }
    default:
      return null;
  }
}

/** Show as table: one row per category (or point, node link, day) with the values the chart draws. */
export function chartTable(kind: ChartKind, data: ChartData): ChartTableModel {
  if (isReadingChart(kind)) return readingTable(kind, data);
  if (kind === 'scatter' || kind === 'bubble') {
    return { columns: kind === 'bubble' ? ['x', 'y', 'size'] : ['x', 'y'], rows: (data.points ?? []).map((p) => ({ id: p.id, cells: [p.label, p.x, p.y, ...(kind === 'bubble' ? [p.size ?? 0] : [])] })) };
  }
  if (kind === 'sankey' || kind === 'flowchart' || kind === 'decision-tree' || kind === 'tree') {
    const name = new Map((data.nodes ?? []).map((node) => [node.id, node.label]));
    return { columns: ['to', ...(kind === 'sankey' ? ['value'] : [])], rows: (data.links ?? []).map((l, index) => ({ id: `${l.from}-${l.to}-${index}`,
      cells: [name.get(l.from) ?? l.from, name.get(l.to) ?? l.to, ...(kind === 'sankey' ? [l.value ?? 0] : l.label ? [l.label] : [])] })) };
  }
  if (kind === 'calendar-heatmap') return { columns: ['value'], rows: (data.days ?? []).map((d) => ({ id: d.date, cells: [d.date, d.value] })) };
  if (kind === 'connected-scatter') return { columns: ['x', 'y'], rows: (data.points ?? []).map((p) => ({ id: p.id, cells: [p.label, p.x, p.y] })) };
  if (kind === 'candlestick') return { columns: ['open', 'high', 'low', 'close'], rows: (data.ohlc ?? []).map((r) => ({ id: r.id, cells: [r.label, r.open, r.high, r.low, r.close] })) };
  if (kind === 'box-plot') return { columns: ['min', 'q1', 'median', 'q3', 'max'], rows: (data.boxes ?? []).map((r) => ({ id: r.id, cells: [r.label, r.min, r.q1, r.median, r.q3, r.max] })) };
  if (kind === 'venn') {
    const name = new Map(data.categories.map((c) => [c.id, c.label]));
    return { columns: ['value'], rows: (data.regions ?? []).map((r) => ({ id: [...r.sets].sort().join('+'), cells: [r.sets.map((set) => name.get(set) ?? set).join(' + '), r.value] })) };
  }
  if (TREE_KINDS.has(kind) || kind === 'swimlane') {
    const tree = kind === 'swimlane' ? null : chartTree(data);
    const name = new Map((data.nodes ?? []).map((node) => [node.id, node.label]));
    const valued = kind === 'treemap' || kind === 'sunburst' || kind === 'icicle';
    const lanes = new Map(data.categories.map((c) => [c.id, c.label]));
    return { columns: kind === 'swimlane' ? ['lane', 'next'] : valued ? ['parent', 'value'] : ['parent'],
      rows: (data.nodes ?? []).map((node) => {
        const up = (data.links ?? []).find((l) => l.to === node.id)?.from;
        if (kind === 'swimlane') return { id: node.id, cells: [node.label, lanes.get(node.lane ?? '') ?? '', (data.links ?? []).filter((l) => l.from === node.id).map((l) => name.get(l.to) ?? l.to).join(', ')] };
        return { id: node.id, cells: [node.label, up ? name.get(up) ?? up : '', ...(valued && typeof tree !== 'string' && tree ? [hierarchyValue(data, node.id, tree.children)] : [])] };
      }) };
  }
  if (kind === 'stat-tile' || kind === 'bullet' || kind === 'gauge') {
    return { columns: ['value'], rows: [{ id: 'value', cells: ['value', data.stat?.value ?? 0] }, ...(data.target !== undefined ? [{ id: 'target', cells: ['target', data.target] }] : []),
      ...(data.stat?.delta !== undefined ? [{ id: 'delta', cells: ['delta', data.stat.delta] }] : [])] };
  }
  if (kind === 'waterfall') {
    const running = waterfallSteps(data);
    return { columns: [data.series[0]?.label ?? 'value', 'total'], rows: data.categories.map((c, index) => ({ id: c.id, cells: [c.label, running[index]!.delta, running[index]!.end] })) };
  }
  return { columns: data.series.map((s) => s.label), rows: data.categories.map((c, index) => ({ id: c.id, cells: [c.label, ...data.series.map((s) => s.values[index] ?? 0)] })) };
}

export interface ChartTableModel { columns: string[]; rows: Array<{ id: string; cells: Array<string | number> }> }

/*
 * F1.0: a column, a table cell or a read part name that starts with `~` is a
 * word of the model ("change", "median", "low 80%"), not the author's copy: the
 * browser translates it (charts/readingWords.ts). Every other string is a
 * label the author wrote per locale, and chartProblem refuses a label that
 * starts with `~`.
 */
function readingTable(kind: ReadingChartKind, data: ChartData): ChartTableModel {
  const perCategory = (cells: (index: number) => Array<string | number>) => data.categories.map((c, i) => ({ id: c.id, cells: [c.label, ...cells(i)] }));
  const series = data.series;
  switch (kind) {
    case 'dot-plot':
      return { columns: series.map((s) => s.label), rows: perCategory((i) => series.map((s) => s.values[i] ?? 0)) };
    case 'dumbbell': {
      const [a, b] = [series[0]!, series[1]!];
      return { columns: [a.label, b.label, '~change'], rows: perCategory((i) => [a.values[i] ?? 0, b.values[i] ?? 0, (b.values[i] ?? 0) - (a.values[i] ?? 0)]) };
    }
    case 'xy-heatmap':
      return { columns: data.categories.map((c) => c.label), rows: (data.rows ?? []).map((row) => ({ id: row.id, cells: [row.label, ...data.categories.map((c) => heatValue(data, c.id, row.id))] })) };
    case 'error-bars':
      return { columns: series.flatMap((s) => [s.label, `${s.label} ±`]), rows: perCategory((i) => series.flatMap((s) => [s.values[i] ?? 0, s.error?.[i] ?? 0])) };
    case 'funnel': {
      const steps = funnelSteps(series[0]?.values ?? []);
      return { columns: ['~value', '~of first %', '~of previous %'], rows: perCategory((i) => [steps[i]!.value, steps[i]!.ofFirst, steps[i]!.ofPrevious]) };
    }
    case 'lorenz-curve': {
      const curve = lorenzCurve(series[0]?.values ?? []);
      return { columns: ['~value', '~people %', '~total %'], rows: [...curve.order.map((index, k) => ({ id: data.categories[index]!.id,
        cells: [data.categories[index]!.label, series[0]!.values[index] ?? 0, curve.people[k]! * 100, curve.share[k]! * 100] })), { id: '~gini', cells: ['~gini', curve.gini, '', ''] }] };
    }
    case 'fan-chart': {
      const ranges = data.ranges ?? [];
      return { columns: [series[0]?.label ?? '~value', ...ranges.flatMap((range) => [`~low ${range.level}%`, `~high ${range.level}%`])],
        rows: perCategory((i) => [series[0]?.values[i] ?? 0, ...ranges.flatMap((range) => [range.low[i] ?? 0, range.high[i] ?? 0])]) };
    }
    case 'density-plot': case 'violin-plot':
      return { columns: ['~n', '~min', '~q1', '~median', '~q3', '~max'], rows: (data.samples ?? []).map((group) => { const s = sampleSummary(group.values);
        return { id: group.id, cells: [group.label, s.n, s.min, s.q1, s.median, s.q3, s.max] }; }) };
    case 'timeline':
      return { columns: ['~date', '~end'], rows: (data.events ?? []).map((event) => ({ id: event.id, cells: [event.label, event.date, event.end ?? ''] })) };
    case 'scatter-regression': {
      const fit = regressionFit(data.points ?? []);
      const at = (x: number) => (fit ? fit.slope * x + fit.intercept : 0);
      return { columns: ['~x', '~y', '~fit'], rows: [...(data.points ?? []).map((p) => ({ id: p.id, cells: [p.label, p.x, p.y, at(p.x)] })),
        ...(fit ? [{ id: '~slope', cells: ['~slope', '', '', fit.slope] }, { id: '~r2', cells: ['~r2', '', '', fit.r2] }] : [])] };
    }
    case 'parallel-coordinates':
      return { columns: data.categories.map((c) => c.label), rows: (data.records ?? []).map((record) => ({ id: record.id, cells: [record.label, ...data.categories.map((_, i) => record.values[i] ?? 0)] })) };
  }
}

/** One thing a learner can tap and read: a mark's name and the numbers behind it (names starting with `~` are model words). */
export interface ChartRead { id: string; label: string; parts: Array<{ name: string; value: number }>; /** A non-numeric detail (a timeline's dates), ISO days the browser formats per locale. */ text?: string }

/** The marks of a reading chart in reading order: what tap-to-read and the next/previous buttons step through. Other kinds have none. */
export function chartReads(kind: ChartKind, data: ChartData): ChartRead[] {
  if (!isReadingChart(kind)) return [];
  const part = (name: string, value: number) => ({ name, value });
  const perCategory = (parts: (index: number) => ChartRead['parts']) => data.categories.map((c, i) => ({ id: c.id, label: c.label, parts: parts(i) }));
  const series = data.series;
  switch (kind) {
    case 'dot-plot':
      return perCategory((i) => series.map((s) => part(s.label, s.values[i] ?? 0)));
    case 'dumbbell':
      return perCategory((i) => [part(series[0]!.label, series[0]!.values[i] ?? 0), part(series[1]!.label, series[1]!.values[i] ?? 0), part('~change', (series[1]!.values[i] ?? 0) - (series[0]!.values[i] ?? 0))]);
    case 'error-bars':
      return perCategory((i) => series.flatMap((s) => [part(s.label, s.values[i] ?? 0), part(`${s.label} ±`, s.error?.[i] ?? 0)]));
    case 'funnel': {
      const steps = funnelSteps(series[0]?.values ?? []);
      return perCategory((i) => [part('~value', steps[i]!.value), part('~of first %', steps[i]!.ofFirst), ...(i > 0 ? [part('~of previous %', steps[i]!.ofPrevious)] : [])]);
    }
    case 'xy-heatmap':
      return (data.rows ?? []).flatMap((row) => data.categories.map((c) => ({ id: `${row.id}:${c.id}`, label: `${row.label}, ${c.label}`, parts: [part('~value', heatValue(data, c.id, row.id))] })));
    case 'lorenz-curve': {
      const curve = lorenzCurve(series[0]?.values ?? []);
      return curve.order.map((index, k) => ({ id: data.categories[index]!.id, label: data.categories[index]!.label,
        parts: [part('~value', series[0]!.values[index] ?? 0), part('~people %', curve.people[k]! * 100), part('~total %', curve.share[k]! * 100)] }));
    }
    case 'fan-chart':
      return perCategory((i) => [part(series[0]?.label ?? '~value', series[0]?.values[i] ?? 0),
        ...(data.ranges ?? []).flatMap((range) => [part(`~low ${range.level}%`, range.low[i] ?? 0), part(`~high ${range.level}%`, range.high[i] ?? 0)])]);
    case 'density-plot': case 'violin-plot':
      return (data.samples ?? []).map((group) => { const s = sampleSummary(group.values);
        return { id: group.id, label: group.label, parts: [part('~median', s.median), part('~q1', s.q1), part('~q3', s.q3), part('~min', s.min), part('~max', s.max)] }; });
    case 'timeline':
      return (data.events ?? []).map((event) => ({ id: event.id, label: event.label, text: event.end ? `${event.date} – ${event.end}` : event.date,
        parts: event.end ? [part('~days', dayNumber(event.end) - dayNumber(event.date))] : [] }));
    case 'scatter-regression': {
      const fit = regressionFit(data.points ?? []);
      return (data.points ?? []).map((p) => ({ id: p.id, label: p.label, parts: [part('~x', p.x), part('~y', p.y), ...(fit ? [part('~fit', fit.slope * p.x + fit.intercept)] : [])] }));
    }
    case 'parallel-coordinates':
      return (data.records ?? []).map((record) => ({ id: record.id, label: record.label, parts: data.categories.map((c, i) => part(c.label, record.values[i] ?? 0)) }));
  }
}

/** Waterfall: each step's delta and the running total it ends on (the first step starts from zero). */
export function waterfallSteps(data: ChartData): Array<{ start: number; end: number; delta: number }> {
  let total = 0;
  return (data.series[0]?.values ?? []).map((delta) => { const start = total; total += delta; return { start, end: total, delta }; });
}

/** Shares of a single series (pie, donut, 100% stacks), as fractions that add to 1. */
export function shares(values: readonly number[]): number[] {
  const sum = values.reduce((a, b) => a + Math.max(0, b), 0);
  return values.map((v) => (sum > 0 ? Math.max(0, v) / sum : 0));
}

/** The chart's value range, always including zero, for linear axes (a sample's own range, a heatmap's cell range and a forecast's own range are the exceptions). */
export function valueExtent(kind: ChartKind, data: ChartData): [number, number] {
  let values: number[];
  if (kind === 'density-plot' || kind === 'violin-plot' || kind === 'xy-heatmap') {
    const own = kind === 'xy-heatmap' ? (data.cells ?? []).map((cell) => cell.value) : (data.samples ?? []).flatMap((group) => group.values);
    const [min, max] = [Math.min(...own), Math.max(...own)];
    return own.length === 0 ? [0, 1] : [min, max === min ? min + 1 : max];
  }
  if (kind === 'fan-chart') {
    const all = [...data.series.flatMap((s) => s.values), ...(data.ranges ?? []).flatMap((range) => [...range.low, ...range.high])];
    const [min, max] = [Math.min(...all), Math.max(...all)];
    return all.length === 0 ? [0, 1] : [min, max === min ? min + 1 : max];
  }
  if (kind === 'error-bars') values = data.series.flatMap((s) => s.values.flatMap((v, i) => [v - (s.error?.[i] ?? 0), v + (s.error?.[i] ?? 0)]));
  else if (kind === 'lorenz-curve') values = [0, 1];
  else if (kind === 'stacked-bar' || kind === 'stacked-area') values = data.categories.map((_, i) => data.series.reduce((s, series) => s + (series.values[i] ?? 0), 0));
  else if (kind === 'waterfall') values = waterfallSteps(data).flatMap((step) => [step.start, step.end]);
  else if (kind === 'stacked-bar-100' || kind === 'stacked-area-100' || kind === 'marimekko') values = [0, 1];
  else if (kind === 'candlestick') values = (data.ohlc ?? []).flatMap((r) => [r.low, r.high]);
  else if (kind === 'box-plot') values = (data.boxes ?? []).flatMap((r) => [r.min, r.max]);
  else values = data.series.flatMap((s) => s.values);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  return [low, high === low ? low + 1 : high];
}

/*
 * Bible 05 §5 and 02 D1 (GAP-FIX-R3): a chart never shortens a word label.
 * Words are HTML over the drawing and wrap; when there is no room the
 * renderer draws fewer labels and the Show-as-table rows carry every one.
 */

/** The numbers the accessible description reads, in document order. */
export function chartFacts(kind: ChartKind, data: ChartData): Array<{ label: string; value: number }> {
  if (isReadingChart(kind) && !SERIES_KINDS.has(kind) && kind !== 'scatter-regression') return chartReads(kind, data).filter((read) => read.parts.length > 0).map((read) => ({ label: read.label, value: read.parts[0]!.value }));
  if (kind === 'scatter' || kind === 'bubble' || kind === 'scatter-regression') return (data.points ?? []).map((p) => ({ label: p.label, value: p.y }));
  if (kind === 'sankey') {
    const name = new Map((data.nodes ?? []).map((node) => [node.id, node.label]));
    return (data.links ?? []).map((l) => ({ label: `${name.get(l.from) ?? l.from} → ${name.get(l.to) ?? l.to}`, value: l.value ?? 0 }));
  }
  if (kind === 'calendar-heatmap') return (data.days ?? []).map((d) => ({ label: d.date, value: d.value }));
  if (kind === 'stat-tile' || kind === 'bullet' || kind === 'gauge') return [{ label: 'value', value: data.stat?.value ?? 0 }, ...(data.target !== undefined ? [{ label: 'target', value: data.target }] : [])];
  if (kind === 'flowchart' || kind === 'decision-tree' || kind === 'tree' || kind === 'org-chart' || kind === 'swimlane' || kind === 'ishikawa' || kind === 'mind-map') return [];
  if (kind === 'connected-scatter') return (data.points ?? []).map((p) => ({ label: p.label, value: p.y }));
  if (kind === 'candlestick') return (data.ohlc ?? []).map((r) => ({ label: r.label, value: r.close }));
  if (kind === 'box-plot') return (data.boxes ?? []).map((r) => ({ label: r.label, value: r.median }));
  if (kind === 'venn') { const name = new Map(data.categories.map((c) => [c.id, c.label])); return (data.regions ?? []).map((r) => ({ label: r.sets.map((set) => name.get(set) ?? set).join(' + '), value: r.value })); }
  if (kind === 'treemap' || kind === 'sunburst' || kind === 'icicle') {
    const tree = chartTree(data);
    if (typeof tree === 'string') return [];
    return (data.nodes ?? []).filter((node) => !(tree.children.get(node.id)?.length)).map((node) => ({ label: node.label, value: node.value ?? 0 }));
  }
  return data.categories.flatMap((c, i) => data.series.map((s) => ({ label: data.series.length > 1 ? `${c.label} ${s.label}` : c.label, value: s.values[i] ?? 0 })));
}
