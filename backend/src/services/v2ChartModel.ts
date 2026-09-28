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
 * Appendix A Part 1 "Situational" types drawn in the first release, each gated
 * by age pathway and course subject (SITUATIONAL_CHART_GATES). The remaining
 * situational types in Appendix A (marimekko, treemap, sunburst, icicle, box
 * plot, strip plot, connected scatter, candlestick, bump, org chart, funnel,
 * swimlane, fishbone, mind map) are not in the contract, so they cannot be
 * authored; Venn and Euler diagrams ship as `logic.euler.v2`.
 */
export const SITUATIONAL_CHART_KINDS = ['stacked-bar-100', 'stacked-area-100', 'lollipop', 'slope', 'step', 'histogram', 'pareto', 'gauge'] as const;
export const CHART_KINDS = [...CORE_CHART_KINDS, ...SITUATIONAL_CHART_KINDS] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

type AgeBand = '6-9' | '10-12' | '13-17' | 'adult';
/** Appendix A's gate for each situational type: the age pathways and course subjects it may appear in (null: any subject). */
export const SITUATIONAL_CHART_GATES: Readonly<Record<(typeof SITUATIONAL_CHART_KINDS)[number], { bands: readonly AgeBand[]; subjects: readonly string[] | null }>> = {
  'stacked-bar-100': { bands: ['13-17', 'adult'], subjects: null }, // teens comparing allocation strategies
  'stacked-area-100': { bands: ['13-17', 'adult'], subjects: null }, // teens, longer horizons
  lollipop: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // long skill lists
  slope: { bands: ['10-12', '13-17', 'adult'], subjects: null }, // this month vs last
  step: { bands: ['13-17', 'adult'], subjects: ['financial-education', 'investing'] }, // rate changes, tax brackets
  histogram: { bands: ['13-17', 'adult'], subjects: null }, // teens, spread of a variable
  pareto: { bands: ['13-17', 'adult'], subjects: ['entrepreneurship', 'financial-education'] }, // which expenses drive most spending
  gauge: { bands: ['13-17', 'adult'], subjects: null }, // one hero KPI, used sparingly
};

/** The subject a course id belongs to (course ids start with their subject). */
export function chartSubject(courseId: string): string {
  return ['financial-education', 'investing', 'entrepreneurship'].find((subject) => courseId === subject || courseId.startsWith(`${subject}-`)) ?? courseId;
}

/** Whether a chart kind may appear in a document of this pathway and course. Core types are always allowed. */
export function chartAllowed(kind: ChartKind, ageBand: AgeBand, courseId: string): boolean {
  const gate = (SITUATIONAL_CHART_GATES as Record<string, { bands: readonly AgeBand[]; subjects: readonly string[] | null }>)[kind];
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
  series: z.array(z.object({ id, label, values: z.array(finite).max(12) }).strict()).max(3).default([]),
  target: finite.optional(),
  bands: z.array(finite).max(3).optional(),
  points: z.array(z.object({ id, label, x: finite, y: finite, size: z.number().finite().positive().max(1_000_000).optional() }).strict()).max(30).optional(),
  nodes: z.array(z.object({ id, label, kind: z.enum(['start', 'step', 'question', 'outcome']).optional() }).strict()).max(16).optional(),
  links: z.array(z.object({ from: id, to: id, value: z.number().finite().positive().max(1_000_000_000).optional(), label: z.string().trim().min(1).max(20).optional() }).strict()).max(24).optional(),
  days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().int().min(0).max(1_000) }).strict()).max(42).optional(),
  icon_value: z.number().int().positive().max(1_000).optional(),
  stat: z.object({ value: finite, delta: finite.optional() }).strict().optional(),
}).strict();
export type ChartData = z.infer<typeof chartDataSchema>;

const SERIES_KINDS = new Set<ChartKind>(['bar', 'column', 'grouped-bar', 'stacked-bar', 'diverging-bar', 'pie', 'donut', 'waterfall', 'radar', 'bullet',
  'line', 'area', 'stacked-area', 'time-series', 'sparkline', 'pictogram', 'waffle', 'stat-tile', 'stacked-bar-100', 'stacked-area-100', 'lollipop',
  'slope', 'step', 'histogram', 'pareto', 'gauge']);

/** Why a chart's data does not fit its kind, or null. The rules each renderer relies on (and the overflow rule) live here. */
export function chartProblem(kind: ChartKind, data: ChartData): string | null {
  const n = data.categories.length;
  const seriesOk = data.series.length > 0 && data.series.every((series) => series.values.length === n);
  if (SERIES_KINDS.has(kind) && !seriesOk && kind !== 'stat-tile' && kind !== 'gauge' && kind !== 'bullet') return 'every series needs one value per category';
  if (new Set([...data.categories.map((c) => c.id), ...data.series.map((s) => s.id)]).size !== n + data.series.length) return 'duplicate ids';
  const values = data.series.flatMap((series) => series.values);
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
export function chartTable(kind: ChartKind, data: ChartData): { columns: string[]; rows: Array<{ id: string; cells: Array<string | number> }> } {
  if (kind === 'scatter' || kind === 'bubble') {
    return { columns: kind === 'bubble' ? ['x', 'y', 'size'] : ['x', 'y'], rows: (data.points ?? []).map((p) => ({ id: p.id, cells: [p.label, p.x, p.y, ...(kind === 'bubble' ? [p.size ?? 0] : [])] })) };
  }
  if (kind === 'sankey' || kind === 'flowchart' || kind === 'decision-tree' || kind === 'tree') {
    const name = new Map((data.nodes ?? []).map((node) => [node.id, node.label]));
    return { columns: ['to', ...(kind === 'sankey' ? ['value'] : [])], rows: (data.links ?? []).map((l, index) => ({ id: `${l.from}-${l.to}-${index}`,
      cells: [name.get(l.from) ?? l.from, name.get(l.to) ?? l.to, ...(kind === 'sankey' ? [l.value ?? 0] : l.label ? [l.label] : [])] })) };
  }
  if (kind === 'calendar-heatmap') return { columns: ['value'], rows: (data.days ?? []).map((d) => ({ id: d.date, cells: [d.date, d.value] })) };
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

/** The chart's value range, always including zero, for linear axes. */
export function valueExtent(kind: ChartKind, data: ChartData): [number, number] {
  let values: number[];
  if (kind === 'stacked-bar' || kind === 'stacked-area') values = data.categories.map((_, i) => data.series.reduce((s, series) => s + (series.values[i] ?? 0), 0));
  else if (kind === 'waterfall') values = waterfallSteps(data).flatMap((step) => [step.start, step.end]);
  else if (kind === 'stacked-bar-100' || kind === 'stacked-area-100') values = [0, 1];
  else values = data.series.flatMap((s) => s.values);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  return [low, high === low ? low + 1 : high];
}

/** Bible 05 overflow rule: a label longer than the chart can hold is shortened in the drawing; the table and the description keep it whole. */
export function fitLabel(text: string, room = 14): string {
  return text.length <= room ? text : `${text.slice(0, room - 1).trimEnd()}…`;
}

/** The numbers the accessible description reads, in document order. */
export function chartFacts(kind: ChartKind, data: ChartData): Array<{ label: string; value: number }> {
  if (kind === 'scatter' || kind === 'bubble') return (data.points ?? []).map((p) => ({ label: p.label, value: p.y }));
  if (kind === 'sankey') return (data.links ?? []).map((l) => ({ label: `${l.from}→${l.to}`, value: l.value ?? 0 }));
  if (kind === 'calendar-heatmap') return (data.days ?? []).map((d) => ({ label: d.date, value: d.value }));
  if (kind === 'stat-tile' || kind === 'bullet' || kind === 'gauge') return [{ label: 'value', value: data.stat?.value ?? 0 }, ...(data.target !== undefined ? [{ label: 'target', value: data.target }] : [])];
  if (kind === 'flowchart' || kind === 'decision-tree' || kind === 'tree') return [];
  return data.categories.flatMap((c, i) => data.series.map((s) => ({ label: data.series.length > 1 ? `${c.label} ${s.label}` : c.label, value: s.values[i] ?? 0 })));
}
