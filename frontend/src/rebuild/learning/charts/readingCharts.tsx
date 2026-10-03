import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Locale } from '../../design/copyBudget';
import { Button } from '../../design/controls';
import { axisExtent, chartReads, dayNumber, funnelSteps, heatValue, lorenzCurve, regressionFit, valueExtent, type ChartData, type ChartRead, type ReadingChartKind } from './chartModel.generated';
import { ChartLabel, HUES, Patterns, W, fillOf, useFittedTags, type ChartTag } from './TeachingChart';
import { readingCopy, type ReadingCopy } from './readingCopy';
import { axisShare, densities, estimateLines, heatShade, lineEnds, longestWord, lorenzPoints, markerPath, niceTicks, scaleLinear, timelineLayout, type Domain } from './readingGeometry';
import { readingPart, readingSpan, readingWord } from './readingWords';

/*
 * Horizonte F1.0: the drawing of the twelve reading charts, one lazy chunk
 * (TeachingChart.tsx loads it on the first reading chart). Same rules as the
 * other kinds (Bible 05 V1/V6): hand-written SVG in the 320 x 180 box, marks and
 * numerals in the SVG, every word an HTML label over it, sky, mint and berry
 * with a second channel (pattern, marker shape or dash), no stock library.
 *
 * Every mark can be tapped to read its numbers, and the Previous and Next
 * buttons (or the arrow keys inside the reader) walk the same marks, so a tap is
 * never the only way in (V4). The hit areas are whole rows, columns or bands:
 * the buttons carry the 48 px floor where a band is narrower.
 *
 * Fix round: a plot is only as tall as its content (`height`, the viewBox's own),
 * so the legend sits under the marks instead of under a fixed 180-unit box. The
 * words that hang below the marks are measured, not guessed (useFittedTags).
 */

interface Ctx {
  kind: ReadingChartKind; data: ChartData; locale: Locale; prefix: string; out: ChartTag[];
  at: string | null; pick: (id: string) => void;
  fmt: (value: number) => string; plain: (value: number) => string; t: ReadingCopy;
}
/** `height` is the viewBox height in units: the marks and numerals, plus the labels that sit inside them. */
interface Plot { node: ReactNode; legend?: ReactNode; height: number }

const DASH = [undefined, '6 3', '2 3'] as const;
const hue = (k: number) => HUES[k % 3];

/** The marks of one plot in three layers: highlight bands under the marks, the marks, and the invisible tap areas on top. */
function slots(c: Ctx) {
  const back: ReactNode[] = []; const front: ReactNode[] = []; const hits: ReactNode[] = [];
  const on = (id: string) => (c.at === id ? 'yes' : undefined);
  const dim = (id: string) => (c.at !== null && c.at !== id ? 'yes' : undefined);
  const tap = (id: string) => ({ className: 'lf-chart-hit', onClick: () => c.pick(id) });
  const area = (id: string, x: number, y: number, width: number, height: number) => {
    back.push(<rect key={`pick:${id}`} className="lf-chart-pick" data-on={on(id)} x={x} y={y} width={width} height={height} rx="4" />);
    hits.push(<rect key={`hit:${id}`} {...tap(id)} x={x} y={y} width={width} height={height} />);
  };
  return { front, hits, on, dim, tap, area, node: (): ReactNode => <>{back}{front}{hits}</> };
}

/** Vertical guide lines with their value numerals underneath (a numeral never carries a letter). */
function gridX(ticks: number[], x: (value: number) => number, top: number, bottom: number, plain: (value: number) => string): ReactNode {
  const label = ticks.every((value) => plain(value).length <= 6);
  return ticks.map((value) => <g key={`tx${value}`}><line x1={x(value)} x2={x(value)} y1={top} y2={bottom} className="lf-chart-guide" />
    {label ? <text x={x(value)} y={bottom + 4} textAnchor="middle" dominantBaseline="hanging" className="lf-chart-label">{plain(value)}</text> : null}</g>);
}

/** Horizontal guide lines with their value numerals on the left. */
function gridY(ticks: number[], y: (value: number) => number, left: number, right: number, plain: (value: number) => string): ReactNode {
  const label = ticks.every((value) => plain(value).length <= 6);
  return ticks.map((value) => <g key={`ty${value}`}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="lf-chart-guide" />
    {label ? <text x={left - 4} y={y(value)} textAnchor="end" dominantBaseline="middle" className="lf-chart-label">{plain(value)}</text> : null}</g>);
}

/** Rows that each hold a word label above their mark: `room` is the height to share, a row is never taller than `max` or shorter than `min` (a label needs 16). */
function rowLayout(n: number, top: number, room: number, max: number, min: number) {
  const rowH = Math.max(min, Math.min(max, room / n));
  return { rowH, top: (i: number) => top + i * rowH, mid: (i: number) => top + i * rowH + 16 + (rowH - 16) / 2 };
}

interface LegendItem { key: string; text: string; swatch?: ReactNode }

function Legend({ items }: { items: LegendItem[] }): ReactNode {
  return items.length === 0 ? null : <ul className="lf-chart-legend">{items.map((item) => <li key={item.key} data-copy-role="data">
    {item.swatch ? <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">{item.swatch}</svg> : null}{item.text}</li>)}</ul>;
}

const markerSwatch = (prefix: string, k: number) => <path d={markerPath(k, 6, 6, 4)} fill={fillOf(prefix, k)} stroke={hue(k)} strokeWidth="1.5" />;
const lineSwatch = (k: number, shape = 0) => <><line x1="0" x2="12" y1="6" y2="6" stroke={hue(k)} strokeWidth="2.5" strokeDasharray={DASH[shape % 3]} /><path d={markerPath(k, 6, 6, 2.6)} fill={hue(k)} /></>;
const seriesLegend = (c: Ctx, marker: boolean): LegendItem[] => c.data.series.map((series, k) => ({ key: series.id, text: series.label, swatch: marker ? markerSwatch(c.prefix, k) : lineSwatch(k) }));

/* ── Cleveland dot plot and dumbbell ──────────────────────────────────────── */

function pointRows(c: Ctx, connect: boolean): Plot {
  const { data } = c; const s = slots(c);
  const n = data.categories.length; const extent = valueExtent(c.kind, data);
  const L = 14; const R = W - 14; const rows = rowLayout(n, 6, 150, 36, 22);
  const x = scaleLinear(extent, [L, R]); const bottom = 6 + n * rows.rowH;
  data.categories.forEach((cat, i) => {
    const cy = rows.mid(i);
    const xs = data.series.map((series) => x(series.values[i] ?? 0));
    s.area(cat.id, 4, rows.top(i), W - 8, rows.rowH);
    c.out.push({ key: `cat:${cat.id}`, text: cat.label, x: L, y: rows.top(i), room: R - L, align: 'start', valign: 'top', lines: 1 });
    s.front.push(<g key={cat.id} className="lf-chart-emph" data-on={s.on(cat.id)}>
      <line x1={L} x2={R} y1={cy} y2={cy} className="lf-chart-guide" />
      {connect ? <line x1={Math.min(...xs)} x2={Math.max(...xs)} y1={cy} y2={cy} className="lf-chart-link" /> : null}
      {xs.map((px, k) => <path key={data.series[k]!.id} d={markerPath(k, px, cy, 4.5)} fill={fillOf(c.prefix, k)} stroke={hue(k)} strokeWidth="1.5" />)}</g>);
  });
  return { node: <>{gridX(niceTicks(extent), x, 6, bottom, c.plain)}<line x1={x(0)} x2={x(0)} y1={6} y2={bottom} className="lf-chart-baseline" />{s.node()}</>, height: bottom + 19,
    legend: <Legend items={connect || data.series.length > 1 ? seriesLegend(c, true) : []} /> };
}

/* ── XY heatmap ───────────────────────────────────────────────────────────── */

function heatmap(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const cols = data.categories; const rows = data.rows ?? []; const extent = valueExtent(c.kind, data);
  const R = W - 6; const T = 6;
  const L = Math.min(96, Math.max(44, Math.ceil(Math.max(...rows.map((row) => longestWord(row.label)))) + 12));
  const wrapped = Math.max(...rows.map((row) => estimateLines(row.label, L - 8)));
  const cw = (R - L) / cols.length; const ch = Math.max(18, Math.min(wrapped > 1 ? 38 : 34, 140 / rows.length));
  rows.forEach((row, r) => c.out.push({ key: `row:${row.id}`, text: row.label, x: 4, y: T + (r + 0.5) * ch, room: L - 8, align: 'start', lines: Math.max(1, Math.floor(ch / 16)) }));
  cols.forEach((col, k) => c.out.push({ key: `col:${col.id}`, text: col.label, x: L + (k + 0.5) * cw, y: T + rows.length * ch + 3, room: cw - 2, valign: 'top', lines: 2 }));
  rows.forEach((row, r) => cols.forEach((col, k) => {
    const value = heatValue(data, col.id, row.id); const id = `${row.id}:${col.id}`;
    const x0 = L + k * cw; const y0 = T + r * ch; const text = c.plain(value);
    s.front.push(<g key={id}><rect className="lf-chart-cell" x={x0 + 1} y={y0 + 1} width={cw - 2} height={ch - 2} rx="3" />
      <rect x={x0 + 1} y={y0 + 1} width={cw - 2} height={ch - 2} rx="3" fill={HUES[0]} fillOpacity={heatShade(value, extent)} />
      {text.length * 6.6 <= cw - 4 && ch >= 15 ? <text x={x0 + cw / 2} y={y0 + ch / 2} textAnchor="middle" dominantBaseline="middle" className="lf-chart-label">{text}</text> : null}
      <rect className="lf-chart-ring" data-on={s.on(id)} x={x0 + 1} y={y0 + 1} width={cw - 2} height={ch - 2} rx="3" /></g>);
    s.hits.push(<rect key={`hit:${id}`} {...s.tap(id)} x={x0} y={y0} width={cw} height={ch} />);
  }));
  const shade = (value: number) => <rect width="12" height="12" rx="2" fill={HUES[0]} fillOpacity={heatShade(value, extent)} />;
  return { node: s.node(), height: T + rows.length * ch + 4, legend: <Legend items={[{ key: 'low', text: c.fmt(extent[0]), swatch: shade(extent[0]) }, { key: 'high', text: c.fmt(extent[1]), swatch: shade(extent[1]) }]} /> };
}

/* ── Error bars ───────────────────────────────────────────────────────────── */

function errorBars(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const n = data.categories.length; const count = data.series.length; const extent = valueExtent(c.kind, data);
  const L = 38; const R = W - 10; const T = 12; const B = T + 144;
  const y = scaleLinear(extent, [B, T]); const band = (R - L) / n; const gap = Math.min(14, band / (count + 1));
  data.categories.forEach((cat, i) => {
    s.area(cat.id, L + i * band, T, band, B - T);
    c.out.push({ key: `cat:${cat.id}`, text: cat.label, x: L + (i + 0.5) * band, y: B + 3, room: band - 2, valign: 'top' });
    data.series.forEach((series, k) => {
      const cx = L + (i + 0.5) * band + (k - (count - 1) / 2) * gap; const v = series.values[i] ?? 0; const e = series.error?.[i] ?? 0;
      s.front.push(<g key={`${cat.id}-${series.id}`}><line x1={cx} x2={cx} y1={y(v + e)} y2={y(v - e)} className="lf-chart-whisker" />
        <line x1={cx - 3.5} x2={cx + 3.5} y1={y(v + e)} y2={y(v + e)} className="lf-chart-whisker" /><line x1={cx - 3.5} x2={cx + 3.5} y1={y(v - e)} y2={y(v - e)} className="lf-chart-whisker" />
        <path d={markerPath(k, cx, y(v), 4)} fill={fillOf(c.prefix, k)} stroke={hue(k)} strokeWidth="1.5" /></g>);
    });
  });
  return { node: <>{gridY(niceTicks(extent), y, L, R, c.plain)}<line x1={L} x2={R} y1={y(0)} y2={y(0)} className="lf-chart-baseline" />{s.node()}</>, height: B + 4,
    legend: <Legend items={data.series.length > 1 ? seriesLegend(c, true) : []} /> };
}

/* ── Sales funnel ─────────────────────────────────────────────────────────── */

function funnel(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const steps = funnelSteps(data.series[0]!.values); const n = steps.length;
  const rows = rowLayout(n, 4, 168, 44, 28); const cx = 126; const maxWidth = 200;
  const barH = Math.min(22, Math.max(8, rows.rowH - 20));
  const width = (i: number) => Math.max(2, maxWidth * steps[i]!.ofFirst / 100);
  const barTop = (i: number) => rows.top(i) + 17;
  steps.forEach((step, i) => {
    const id = data.categories[i]!.id; const y = barTop(i);
    s.area(id, 4, rows.top(i), W - 8, rows.rowH);
    c.out.push({ key: `cat:${id}`, text: data.categories[i]!.label, x: cx, y: rows.top(i), room: maxWidth, valign: 'top', lines: 1 });
    if (i + 1 < n) s.front.push(<polygon key={`drop:${id}`} className="lf-chart-drop"
      points={`${cx - width(i) / 2},${y + barH} ${cx + width(i) / 2},${y + barH} ${cx + width(i + 1) / 2},${barTop(i + 1)} ${cx - width(i + 1) / 2},${barTop(i + 1)}`} />);
    s.front.push(<g key={id}><rect x={cx - width(i) / 2} y={y} width={width(i)} height={barH} fill={fillOf(c.prefix, 0)} stroke={HUES[0]} strokeWidth="1.5" />
      <text x={W - 6} y={y + barH / 2} textAnchor="end" dominantBaseline="middle" className="lf-chart-label">{`${c.plain(Math.round(step.ofFirst))}%`}</text></g>);
  });
  return { node: s.node(), height: rows.top(n) };
}

/* ── Lorenz curve ─────────────────────────────────────────────────────────── */

function lorenz(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const curve = lorenzCurve(data.series[0]!.values); const n = data.categories.length;
  const x0 = 42; const size = 132; const y0 = 18; const y1 = y0 + size;
  const px = (value: number) => x0 + value * size; const py = (value: number) => y1 - value * size;
  const pts = lorenzPoints(curve.people, curve.share);
  const gini = new Intl.NumberFormat(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(curve.gini);
  c.out.push({ key: 'axis:y', text: c.t.total, x: 2, y: 0, room: 190, align: 'start', valign: 'top', lines: 1 });
  c.out.push({ key: 'axis:x', text: c.t.people, x: x0 + size / 2, y: y1 + 17, room: size, valign: 'top', lines: 2 });
  c.out.push({ key: 'gini', text: readingWord(c.locale, '~gini'), x: 196, y: 32, room: 118, align: 'start', valign: 'top', lines: 2 });
  c.out.push({ key: 'equal', text: c.t.equal, x: 218, y: 126, room: 96, align: 'start', lines: 2 });
  data.categories.forEach((_, k) => {
    const id = data.categories[curve.order[k]!]!.id;
    const left = k === 0 ? x0 : px((curve.people[k - 1]! + curve.people[k]!) / 2); const right = k === n - 1 ? x0 + size : px((curve.people[k]! + curve.people[k + 1]!) / 2);
    s.area(id, left, y0, right - left, size);
    s.front.push(<g key={`dot:${id}`}><circle cx={px(pts[k + 1]!.x)} cy={py(pts[k + 1]!.y)} r="3.5" fill={HUES[0]} />
      <circle className="lf-chart-ring" data-on={s.on(id)} cx={px(pts[k + 1]!.x)} cy={py(pts[k + 1]!.y)} r="7" /></g>);
  });
  const grid = [0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}>
    <line x1={x0} x2={x0 + size} y1={py(value)} y2={py(value)} className="lf-chart-guide" /><line x1={px(value)} x2={px(value)} y1={y0} y2={y1} className="lf-chart-guide" />
    <text x={x0 - 4} y={py(value)} textAnchor="end" dominantBaseline="middle" className="lf-chart-label">{c.plain(value * 100)}</text>
    <text x={px(value)} y={y1 + 4} textAnchor="middle" dominantBaseline="hanging" className="lf-chart-label">{c.plain(value * 100)}</text></g>);
  const path = pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
  return { node: <>{grid}<polygon points={path} fill={fillOf(c.prefix, 0)} fillOpacity="0.25" />
    <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} className="lf-chart-equal" />
    <polyline points={path} className="lf-chart-line" stroke={HUES[0]} />
    <line x1={196} x2={212} y1={126} y2={126} className="lf-chart-equal" />
    <text x={196} y={88} className="lf-chart-stat lf-chart-stat--mid">{gini}</text>{s.node()}</>, height: y1 + 18 };
}

/* ── Fan chart ────────────────────────────────────────────────────────────── */

function fan(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const ranges = data.ranges ?? []; const n = data.categories.length; const centre = data.series[0]!;
  const extent = valueExtent(c.kind, data); const pad = (extent[1] - extent[0]) * 0.06;
  const domain: Domain = [extent[0] - pad, extent[1] + pad];
  const L = 38; const R = W - 10; const T = 12; const B = T + 144; const band = (R - L) / n;
  const x = (i: number) => L + (i + 0.5) * band; const y = scaleLinear(domain, [B, T]);
  data.categories.forEach((cat, i) => {
    s.area(cat.id, L + i * band, T, band, B - T);
    c.out.push({ key: `cat:${cat.id}`, text: cat.label, x: x(i), y: B + 3, room: band - 2, valign: 'top' });
  });
  const shapes = [...ranges].reverse().map((range, j) => {
    const index = ranges.length - 1 - j;
    const points = `${range.high.map((v, i) => `${x(i)},${y(v)}`).join(' ')} ${range.low.map((v, i) => `${x(i)},${y(v)}`).reverse().join(' ')}`;
    return <polygon key={range.level} points={points} fill={fillOf(c.prefix, 0)} fillOpacity={0.34 - index * 0.14} stroke={index > 0 ? HUES[0] : 'none'} strokeWidth="1" strokeDasharray={index > 0 ? '4 3' : undefined} />;
  });
  const line = centre.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return { node: <>{gridY(niceTicks(domain), y, L, R, c.plain)}{shapes}{s.node()}
    <polyline points={line} className="lf-chart-line" stroke={HUES[0]} />
    {centre.values.map((v, i) => <circle key={data.categories[i]!.id} cx={x(i)} cy={y(v)} r="3.5" fill={HUES[0]} />)}</>, height: B + 4,
    legend: <Legend items={[{ key: centre.id, text: centre.label, swatch: lineSwatch(0) },
      ...ranges.map((range, index) => ({ key: `range:${range.level}`, text: c.t.range(range.level),
        swatch: <rect x="0.5" y="1.5" width="11" height="9" rx="2" fill={fillOf(c.prefix, 0)} fillOpacity={0.34 - index * 0.14 + 0.1} stroke={HUES[0]} strokeDasharray={index > 0 ? '3 2' : undefined} /> }))]} /> };
}

/* ── Density plot and violin plot ─────────────────────────────────────────── */

function density(c: Ctx): Plot {
  const groups = c.data.samples ?? []; const s = slots(c);
  const d = densities(groups.map((group) => group.values));
  const L = 28; const R = W - 12; const T = 12; const B = T + 144; const base = B - 18; const peak = base - T - 4;
  const x = scaleLinear(d.domain, [L, R]);
  groups.forEach((group, k) => {
    const line = d.positions.map((position, i) => `${x(position)},${base - d.curves[k]![i]! / d.peak * peak}`);
    const shape = `${x(d.positions[0]!)},${base} ${line.join(' ')} ${x(d.positions[d.positions.length - 1]!)},${base}`;
    const lane = base + 3 + k * 5;
    s.front.push(<g key={group.id} className="lf-chart-emph" data-on={s.on(group.id)} data-dim={s.dim(group.id)}>
      <polygon points={shape} fill={fillOf(c.prefix, k)} fillOpacity="0.45" />
      <polyline points={line.join(' ')} className="lf-chart-line" stroke={hue(k)} strokeDasharray={DASH[k % 3]} />
      {group.values.map((value, i) => <line key={i} x1={x(value)} x2={x(value)} y1={lane} y2={lane + 4} className="lf-chart-tick" stroke={hue(k)} />)}</g>);
    s.hits.push(<polygon key={`hit:${group.id}`} {...s.tap(group.id)} points={shape} />);
    s.hits.push(<rect key={`lane:${group.id}`} {...s.tap(group.id)} x={L} y={lane - 1} width={R - L} height="6" />);
  });
  return { node: <>{gridX(niceTicks(d.domain), x, T, B, c.plain)}<line x1={L} x2={R} y1={base} y2={base} className="lf-chart-baseline" />{s.node()}</>, height: B + 20,
    legend: <Legend items={groups.map((group, k) => ({ key: group.id, text: group.label, swatch: <rect x="0.5" y="1.5" width="11" height="9" rx="2" fill={fillOf(c.prefix, k)} stroke={hue(k)} strokeWidth="1.5" /> }))} /> };
}

function violin(c: Ctx): Plot {
  const groups = c.data.samples ?? []; const s = slots(c);
  const d = densities(groups.map((group) => group.values));
  const L = 38; const R = W - 10; const T = 12; const B = T + 144; const band = (R - L) / groups.length; const half = Math.min(band * 0.42, 60);
  const y = scaleLinear(d.domain, [B, T]);
  groups.forEach((group, k) => {
    const cx = L + (k + 0.5) * band; const sorted = [...group.values].sort((a, b) => a - b);
    const at = (p: number) => { const i = (sorted.length - 1) * p; const lo = Math.floor(i); return sorted[lo]! + (sorted[Math.ceil(i)]! - sorted[lo]!) * (i - lo); };
    const width = (i: number) => d.curves[k]![i]! / d.peak * half;
    const right = d.positions.map((position, i) => `${cx + width(i)},${y(position)}`);
    const left = d.positions.map((position, i) => `${cx - width(i)},${y(position)}`).reverse();
    s.area(group.id, L + k * band, T, band, B - T);
    c.out.push({ key: `cat:${group.id}`, text: group.label, x: cx, y: B + 3, room: band - 2, valign: 'top' });
    s.front.push(<g key={group.id}><polygon points={`${right.join(' ')} ${left.join(' ')}`} fill={fillOf(c.prefix, k)} fillOpacity="0.55" stroke={hue(k)} strokeWidth="1.5" strokeDasharray={DASH[k % 3]} />
      <rect x={cx - 3} y={y(at(0.75))} width="6" height={Math.max(1, y(at(0.25)) - y(at(0.75)))} className="lf-chart-inner" />
      <circle cx={cx} cy={y(at(0.5))} r="3" className="lf-chart-median" /></g>);
  });
  return { node: <>{gridY(niceTicks(d.domain), y, L, R, c.plain)}{s.node()}</>, height: B + 4 };
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

function timeline(c: Ctx): Plot {
  const events = c.data.events ?? []; const s = slots(c);
  const room = Math.min(96, Math.max(64, Math.ceil(Math.max(...events.map((event) => longestWord(event.label)))) + 6));
  const marks = timelineLayout(events.map((event) => ({ start: dayNumber(event.date), end: event.end === undefined ? undefined : dayNumber(event.end) })), 24, W - 48, room, [4, W - 4]);
  const tall = events.map((event) => Math.min(2, estimateLines(event.label, room)) * 16);
  const nearest = (dir: number) => Math.max(0, ...marks.flatMap((m, i) => (Math.abs(m.row) === 1 && Math.sign(m.row) === dir ? [tall[i]!] : [])));
  const offset = (row: number) => (Math.abs(row) === 1 ? 10 : 12 + nearest(Math.sign(row)));
  const reach = (dir: number) => Math.max(12, ...marks.flatMap((m, i) => (Math.sign(m.row) === dir ? [offset(m.row) + tall[i]!] : [])));
  const axisY = 4 + reach(-1); const height = axisY + reach(1) + 4;
  let spans = false; let days = false;
  events.forEach((event, i) => {
    const m = marks[i]!; const dir = m.row < 0 ? -1 : 1; const near = axisY + dir * offset(m.row); const span = event.end !== undefined;
    const spanWidth = Math.max(8, m.x1 - m.x0);
    if (span) spans = true; else days = true;
    c.out.push({ key: `event:${event.id}`, text: event.label, x: m.labelX, y: near, room, valign: dir < 0 ? 'bottom' : 'top', lines: 2 });
    s.front.push(<g key={event.id} className="lf-chart-emph" data-on={s.on(event.id)}>
      <line x1={m.centre} x2={m.centre} y1={axisY} y2={near} className="lf-chart-edge" />
      {span ? <rect x={m.centre - spanWidth / 2} y={axisY - 5} width={spanWidth} height="10" rx="5" fill={fillOf(c.prefix, 1)} stroke={HUES[1]} strokeWidth="1.5" />
        : <circle cx={m.centre} cy={axisY} r="5" fill={fillOf(c.prefix, 0)} stroke={HUES[0]} strokeWidth="1.5" />}</g>);
    s.hits.push(<rect key={`mark:${event.id}`} {...s.tap(event.id)} x={m.centre - spanWidth / 2 - 6} y={axisY - 12} width={spanWidth + 12} height="24" />);
    s.hits.push(<rect key={`name:${event.id}`} {...s.tap(event.id)} x={m.labelX - room / 2} y={dir < 0 ? near - tall[i]! : near} width={room} height={tall[i]} />);
  });
  return { node: <><line x1={14} x2={W - 14} y1={axisY} y2={axisY} className="lf-chart-spine" />{s.node()}</>, height,
    legend: <Legend items={[...(days ? [{ key: 'day', text: c.t.oneDay, swatch: <circle cx="6" cy="6" r="4.5" fill={fillOf(c.prefix, 0)} stroke={HUES[0]} strokeWidth="1.5" /> }] : []),
      ...(spans ? [{ key: 'span', text: c.t.span, swatch: <rect x="0" y="2.5" width="12" height="7" rx="3.5" fill={fillOf(c.prefix, 1)} stroke={HUES[1]} strokeWidth="1.5" /> }] : [])]} /> };
}

/* ── Scatter with a regression line ───────────────────────────────────────── */

function regression(c: Ctx): Plot {
  const points = c.data.points ?? []; const s = slots(c); const fit = regressionFit(points);
  if (!fit) return { node: null, height: 80 };
  const span = (values: number[]): Domain => { const lo = Math.min(...values); const hi = Math.max(...values); const pad = (hi - lo || 1) * 0.06; return [lo - pad, hi + pad]; };
  const xd = span(points.map((p) => p.x)); const yd = span(points.map((p) => p.y));
  const L = 40; const R = W - 12; const T = 12; const B = T + 144;
  const x = scaleLinear(xd, [L, R]); const y = scaleLinear(yd, [B, T]);
  const [a, b] = lineEnds(fit, xd); const clip = `${c.prefix}-clip`;
  points.forEach((p) => {
    s.front.push(<g key={p.id}><circle cx={x(p.x)} cy={y(p.y)} r="4" fill={fillOf(c.prefix, 0)} stroke={HUES[0]} strokeWidth="1.5" />
      {c.at === p.id ? <line x1={x(p.x)} x2={x(p.x)} y1={y(p.y)} y2={y(fit.slope * p.x + fit.intercept)} className="lf-chart-residual" /> : null}
      <circle className="lf-chart-ring" data-on={s.on(p.id)} cx={x(p.x)} cy={y(p.y)} r="8" /></g>);
    s.hits.push(<circle key={`hit:${p.id}`} {...s.tap(p.id)} cx={x(p.x)} cy={y(p.y)} r="9" />);
  });
  const facts = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 2 });
  return { node: <><defs><clipPath id={clip}><rect x={L} y={T} width={R - L} height={B - T} /></clipPath></defs>
    {gridY(niceTicks(yd), y, L, R, c.plain)}{gridX(niceTicks(xd), x, T, B, c.plain)}
    <line x1={x(a.x)} y1={y(a.y)} x2={x(b.x)} y2={y(b.y)} className="lf-chart-line" stroke={HUES[2]} clipPath={`url(#${clip})`} />{s.node()}</>, height: B + 20,
    legend: <Legend items={[{ key: 'fit', text: readingWord(c.locale, '~fit'), swatch: <line x1="0" x2="12" y1="6" y2="6" stroke={HUES[2]} strokeWidth="2.5" /> },
      { key: 'slope', text: `${readingWord(c.locale, '~slope')}: ${facts.format(fit.slope)}` }, { key: 'r2', text: `${readingWord(c.locale, '~r2')}: ${facts.format(fit.r2)}` }]} /> };
}

/* ── Parallel coordinates ─────────────────────────────────────────────────── */

function parallel(c: Ctx): Plot {
  const { data } = c; const s = slots(c);
  const records = data.records ?? []; const n = data.categories.length;
  const edge = Math.min(48, Math.max(30, Math.ceil(Math.max(...data.categories.map((cat) => longestWord(cat.label))) / 2) + 6));
  const L = edge; const R = W - edge; const T = 18; const B = T + 126; const step = (R - L) / (n - 1);
  const xs = data.categories.map((_, i) => L + i * step);
  const extents = data.categories.map((_, i) => axisExtent(data, i));
  const yOf = (value: number, i: number) => B - axisShare(value, extents[i]!) * (B - T);
  const axes = data.categories.map((cat, i) => <g key={cat.id}><line x1={xs[i]} x2={xs[i]} y1={T} y2={B} className="lf-chart-baseline" />
    <text x={xs[i]} y={T - 4} textAnchor="middle" className="lf-chart-label">{c.plain(extents[i]![1])}</text>
    <text x={xs[i]} y={B + 4} textAnchor="middle" dominantBaseline="hanging" className="lf-chart-label">{c.plain(extents[i]![0])}</text></g>);
  data.categories.forEach((cat, i) => c.out.push({ key: `axis:${cat.id}`, text: cat.label, x: xs[i]!, y: B + 17, room: Math.min(step - 4, 2 * Math.min(xs[i]!, W - xs[i]!) - 4), valign: 'top' }));
  const ordered = records.map((record, k) => ({ record, k })).sort((p, q) => Number(c.at === p.record.id) - Number(c.at === q.record.id));
  ordered.forEach(({ record, k }) => {
    const points = record.values.map((value, i) => `${xs[i]},${yOf(value, i)}`).join(' ');
    s.front.push(<g key={record.id} className="lf-chart-emph" data-on={s.on(record.id)} data-dim={s.dim(record.id)}>
      <polyline points={points} className="lf-chart-line" stroke={hue(k)} strokeDasharray={DASH[Math.floor(k / 3) % 3]} />
      {record.values.map((value, i) => <path key={i} d={markerPath(k, xs[i]!, yOf(value, i), 3.2)} fill={hue(k)} />)}</g>);
    s.hits.push(<polyline key={`hit:${record.id}`} {...s.tap(record.id)} className="lf-chart-hit lf-chart-hit--line" points={points} />);
  });
  return { node: <>{axes}{s.node()}</>, height: B + 18,
    legend: <Legend items={records.map((record, k) => ({ key: record.id, text: record.label, swatch: lineSwatch(k, Math.floor(k / 3)) }))} /> };
}

const PLOTS: Record<ReadingChartKind, (c: Ctx) => Plot> = {
  'dot-plot': (c) => pointRows(c, false), dumbbell: (c) => pointRows(c, true), 'xy-heatmap': heatmap, 'error-bars': errorBars, funnel, 'lorenz-curve': lorenz,
  'fan-chart': fan, 'density-plot': density, 'violin-plot': violin, timeline, 'scatter-regression': regression, 'parallel-coordinates': parallel,
};

/* ── Reader: tap a mark, or step through the marks ────────────────────────── */

function Reader({ reads, at, locale, t, step, clear }: { reads: ChartRead[]; at: string | null; locale: Locale; t: ReadingCopy; step: (by: number) => void; clear: () => void }) {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const index = reads.findIndex((read) => read.id === at); const read = reads[index];
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (by !== 0) { event.preventDefault(); step(by); } else if (event.key === 'Escape') clear();
  };
  return <div className="lf-chart-reader" role="group" aria-label={t.read} onKeyDown={keys}>
    <div className="lf-chart-readout" role="status" aria-live="polite" data-copy-role="data">
      {read ? <><strong>{read.label}</strong>
        {read.text ? <span>{readingSpan(locale, read.text)}</span> : null}
        {read.parts.map((part) => <span key={part.name}>{readingPart(locale, part.name, part.value, format.format)}</span>)}</>
        : <span data-copy-role="body">{t.hint}</span>}
    </div>
    <div className="lf-chart-steps">
      <Button size="sm" onClick={() => step(-1)}>{t.previous}</Button>
      <span className="lf-chart-position" data-copy-role="data">{index >= 0 ? t.position(index + 1, reads.length) : ''}</span>
      <Button size="sm" onClick={() => step(1)}>{t.next}</Button>
    </div>
  </div>;
}

export default function ReadingPlot({ kind, data, title, locale, id, description }: { kind: ReadingChartKind; data: ChartData; title: string; locale: Locale; id: string; description: string }) {
  const t = readingCopy[locale];
  const [at, setAt] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useFittedTags(canvas);
  const reads = chartReads(kind, data);
  const labels: ChartTag[] = [];
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const plainFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false });
  const plot = PLOTS[kind]({ kind, data, locale, prefix: id, out: labels, at, pick: (next) => setAt((now) => (now === next ? null : next)), fmt: grouped.format, plain: plainFormat.format, t });
  const index = reads.findIndex((read) => read.id === at);
  const step = (by: number) => setAt(reads[index < 0 ? (by > 0 ? 0 : reads.length - 1) : (index + by + reads.length) % reads.length]?.id ?? null);
  return <div className="lf-chart-plot" data-copy-role="data">
    <div role="img" aria-label={title} aria-describedby={`${id}-desc`}>
      <div ref={canvas} className="lf-chart-canvas lf-chart-canvas--fit" style={{ aspectRatio: `${W} / ${plot.height}`, maxInlineSize: `${Math.min((W * 16) / 9, (320 * W) / plot.height).toFixed(1)}px` }}>
        <svg viewBox={`0 0 ${W} ${plot.height}`} aria-hidden="true" focusable="false"><Patterns prefix={id} />{plot.node}</svg>
        {labels.map((label) => <ChartLabel key={label.key} label={label} height={plot.height} />)}</div>
      <p id={`${id}-desc`} className="lf-visually-hidden">{description}</p>
      {plot.legend}
    </div>
    <p className="lf-chart-note" data-copy-role="body">{t.note[kind]}</p>
    <Reader reads={reads} at={at} locale={locale} t={t} step={step} clear={() => setAt(null)} />
  </div>;
}
