import { useId, useState, type ReactNode } from 'react';
import type { Locale } from '../../design/copyBudget';
import { Button } from '../../design/controls';
import { chartFacts, chartTable, fitLabel, shares, valueExtent, waterfallSteps, type ChartData, type ChartKind } from './chartModel.generated';
import './charts.css';

/*
 * B.7 part 1 (GAP-FIX-R1 learning; Appendix A Part 1; Bible 05 V1/V6): the
 * in-house SVG teaching charts. Every kind draws from the canonical chart
 * model Core validated (chartModel.generated.ts), so the drawing, the
 * Show-as-table rows and the accessible description carry the same numbers.
 * Each chart is one role="img" with a name and a description, can be read as
 * a table, draws up to three series in sky, mint and berry with a pattern as
 * a second channel (solid, stripes, dots), and shortens a label that does not
 * fit (the table keeps it whole). No stock chart library, no animation.
 */

export const chartCopy: Record<Locale, { showTable: string; showChart: string; table: string; category: string; value: string; target: string; delta: string; total: string; from: string; to: string; each: (n: string) => string }> = {
  'en-US': { showTable: 'Show as table', showChart: 'Show chart', table: 'Chart data', category: 'Item', value: 'Value', target: 'Goal', delta: 'Change', total: 'Total', from: 'From', to: 'To', each: (n) => `Each icon is ${n}` },
  'es-MX': { showTable: 'Ver tabla', showChart: 'Ver gráfica', table: 'Datos de la gráfica', category: 'Elemento', value: 'Valor', target: 'Meta', delta: 'Cambio', total: 'Total', from: 'De', to: 'A', each: (n) => `Cada ícono vale ${n}` },
  'pt-BR': { showTable: 'Ver tabela', showChart: 'Ver gráfico', table: 'Dados do gráfico', category: 'Item', value: 'Valor', target: 'Meta', delta: 'Mudança', total: 'Total', from: 'De', to: 'Para', each: (n) => `Cada ícone vale ${n}` },
};

const HUES = ['var(--sky-strong)', 'var(--mint-strong)', 'var(--berry-strong)'];
const W = 320; const H = 180; const PAD = 28;

function Patterns({ prefix }: { prefix: string }) {
  return <defs>
    {HUES.map((hue, index) => <pattern key={index} id={`${prefix}-${index}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={index === 1 ? 'rotate(45)' : undefined}>
      <rect width="6" height="6" fill={hue} />
      {index === 1 ? <rect width="2" height="6" fill="var(--surface)" /> : index === 2 ? <circle cx="3" cy="3" r="1.2" fill="var(--surface)" /> : null}
    </pattern>)}
  </defs>;
}
const fillOf = (prefix: string, index: number) => `url(#${prefix}-${index % 3})`;

/** `embedded`: the chart sits inside a board that already offers its own table, so it drops its own toggle (one "Show as table" per board). */
export function TeachingChart({ kind, data, title, locale, embedded = false }: { kind: ChartKind; data: ChartData; title: string; locale: Locale; embedded?: boolean }) {
  const t = chartCopy[locale];
  const [table, setTable] = useState(false);
  const id = useId().replace(/:/g, '');
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const facts = chartFacts(kind, data).map((fact) => `${fact.label}: ${number.format(fact.value)}`).join('; ');
  const model = chartTable(kind, data);
  return <figure className="lf-chart" data-chart-kind={kind}>
    <figcaption className="lf-chart-head"><span data-copy-role="heading">{title}</span>
      {embedded ? null : <Button onClick={() => setTable((value) => !value)} aria-pressed={table}>{table ? t.showChart : t.showTable}</Button>}</figcaption>
    {table ? <table className="lf-learning-table lf-chart-table" aria-label={t.table}>
      <thead><tr><th scope="col" data-copy-role="data">{t.category}</th>{model.columns.map((column) => <th key={column} scope="col" data-copy-role="data">{column}</th>)}</tr></thead>
      <tbody>{model.rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => index === 0
        ? <th key={index} scope="row" data-copy-role="data">{cell}</th>
        : <td key={index} data-copy-role="data">{typeof cell === 'number' ? number.format(cell) : cell}</td>)}</tr>)}</tbody>
    </table> : <div className="lf-chart-plot" role="img" aria-label={title} aria-describedby={`${id}-desc`}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false"><Patterns prefix={id} />{draw(kind, data, id, locale)}</svg>
      <p id={`${id}-desc`} className="lf-visually-hidden">{facts}</p>
      {legend(kind, data, id)}
      {kind === 'pictogram' && data.icon_value ? <p className="lf-chart-note" data-copy-role="data">{t.each(number.format(data.icon_value))}</p> : null}
    </div>}
  </figure>;
}

function legend(kind: ChartKind, data: ChartData, prefix: string): ReactNode {
  const perCategory = kind === 'pie' || kind === 'donut' || kind === 'waffle';
  const items = perCategory ? data.categories.map((c) => c.label) : data.series.length > 1 ? data.series.map((s) => s.label) : [];
  if (items.length === 0) return null;
  return <ul className="lf-chart-legend">{items.map((item, index) => <li key={item} data-copy-role="data">
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect width="12" height="12" rx="2" fill={fillOf(prefix, index)} /></svg>{item}</li>)}</ul>;
}

const scaleY = (value: number, [low, high]: [number, number]) => H - PAD - (value - low) / (high - low) * (H - 2 * PAD);
const scaleX = (value: number, [low, high]: [number, number]) => PAD + (value - low) / (high - low) * (W - 2 * PAD);

function axisLabels(data: ChartData, horizontal = false): ReactNode {
  const n = Math.max(1, data.categories.length);
  return data.categories.map((c, i) => horizontal
    ? <text key={c.id} x={PAD - 4} y={PAD + (i + 0.5) * (H - 2 * PAD) / n} textAnchor="end" dominantBaseline="middle" className="lf-chart-label">{fitLabel(c.label, 8)}</text>
    : <text key={c.id} x={PAD + (i + 0.5) * (W - 2 * PAD) / n} y={H - 8} textAnchor="middle" className="lf-chart-label">{fitLabel(c.label, 10)}</text>);
}

function draw(kind: ChartKind, data: ChartData, prefix: string, locale: Locale): ReactNode {
  const n = Math.max(1, data.categories.length);
  const band = (W - 2 * PAD) / n;
  const extent = valueExtent(kind, data);
  const zeroY = scaleY(0, extent);
  switch (kind) {
    case 'column': case 'grouped-bar': case 'histogram': case 'pareto': case 'lollipop': case 'stacked-bar': case 'stacked-bar-100': case 'diverging-bar': {
      const series = data.series;
      const bars = data.categories.map((c, i) => {
        if (kind === 'stacked-bar' || kind === 'stacked-bar-100') {
          const total = series.reduce((s, x) => s + (x.values[i] ?? 0), 0) || 1;
          let top = 0;
          return series.map((s, k) => {
            const value = kind === 'stacked-bar-100' ? (s.values[i] ?? 0) / total : s.values[i] ?? 0;
            const y0 = scaleY(top, extent); top += value; const y1 = scaleY(top, extent);
            return <rect key={`${c.id}-${s.id}`} x={PAD + i * band + band * 0.15} y={y1} width={band * 0.7} height={Math.max(0, y0 - y1)} fill={fillOf(prefix, k)} />;
          });
        }
        return series.map((s, k) => {
          const width = band * 0.7 / series.length;
          const x = PAD + i * band + band * 0.15 + k * width;
          const value = s.values[i] ?? 0;
          const y = scaleY(value, extent);
          const fill = kind === 'diverging-bar' ? fillOf(prefix, value < 0 ? 2 : 1) : fillOf(prefix, k);
          return kind === 'lollipop' ? <g key={`${c.id}-${s.id}`}><line x1={x + width / 2} x2={x + width / 2} y1={zeroY} y2={y} className="lf-chart-stem" /><circle cx={x + width / 2} cy={y} r="5" fill={fill} /></g>
            : <rect key={`${c.id}-${s.id}`} x={x} y={Math.min(y, zeroY)} width={width} height={Math.abs(zeroY - y)} fill={fill} />;
        });
      });
      const pareto = kind === 'pareto' ? (() => {
        const values = data.series[0]!.values; const total = values.reduce((a, b) => a + b, 0) || 1; let run = 0;
        const points = values.map((v, i) => { run += v; return `${PAD + (i + 0.5) * band},${H - PAD - run / total * (H - 2 * PAD)}`; });
        return <polyline points={points.join(' ')} className="lf-chart-line" stroke={HUES[2]} />;
      })() : null;
      return <><line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />{bars}{pareto}{axisLabels(data)}</>;
    }
    case 'bar': {
      const [low, high] = extent;
      const bandY = (H - 2 * PAD) / n;
      return <>{data.categories.map((c, i) => data.series.map((s, k) => {
        const h = bandY * 0.7 / data.series.length;
        const value = s.values[i] ?? 0;
        const x0 = scaleX(0, [low, high]); const x1 = scaleX(value, [low, high]);
        return <rect key={`${c.id}-${s.id}`} x={Math.min(x0, x1)} y={PAD + i * bandY + bandY * 0.15 + k * h} width={Math.abs(x1 - x0)} height={h} fill={fillOf(prefix, k)} />;
      }))}{axisLabels(data, true)}</>;
    }
    case 'waterfall': {
      const steps = waterfallSteps(data);
      return <><line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />
        {steps.map((step, i) => { const y0 = scaleY(step.start, extent); const y1 = scaleY(step.end, extent);
          return <rect key={data.categories[i]!.id} x={PAD + i * band + band * 0.15} y={Math.min(y0, y1)} width={band * 0.7} height={Math.max(1, Math.abs(y1 - y0))} fill={fillOf(prefix, step.delta < 0 ? 2 : 1)} />; })}
        {axisLabels(data)}</>;
    }
    case 'pie': case 'donut': {
      const parts = shares(data.series[0]!.values);
      let angle = -Math.PI / 2;
      const r = 70; const cx = W / 2; const cy = H / 2;
      return <>{parts.map((part, i) => {
        const start = angle; angle += part * Math.PI * 2; const end = angle;
        const large = end - start > Math.PI ? 1 : 0;
        const path = part >= 0.9999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(end)} ${cy + r * Math.sin(end)} Z`;
        return <path key={data.categories[i]!.id} d={path} fill={fillOf(prefix, i)} className="lf-chart-slice" />;
      })}{kind === 'donut' ? <circle cx={cx} cy={cy} r={38} fill="var(--surface)" /> : null}</>;
    }
    case 'waffle': {
      const values = data.series[0]!.values; const cells: number[] = [];
      values.forEach((v, i) => { for (let k = 0; k < v; k += 1) cells.push(i); });
      const size = 14;
      return <>{Array.from({ length: 100 }, (_, index) => <rect key={index} x={W / 2 - 5 * (size + 2) + (index % 10) * (size + 2)} y={10 + Math.floor(index / 10) * (size + 2)}
        width={size} height={size} rx="2" fill={cells[index] === undefined ? 'var(--sunken)' : fillOf(prefix, cells[index]!)} />)}</>;
    }
    case 'pictogram': {
      const each = data.icon_value ?? 1; const rowH = (H - 2 * 10) / n;
      return <>{data.categories.map((c, i) => <g key={c.id}>
        <text x={4} y={10 + (i + 0.5) * rowH} dominantBaseline="middle" className="lf-chart-label">{fitLabel(c.label, 8)}</text>
        {Array.from({ length: Math.round((data.series[0]!.values[i] ?? 0) / each) }, (_, k) => <circle key={k} cx={80 + k * 12} cy={10 + (i + 0.5) * rowH} r="5" fill={fillOf(prefix, i)} className="lf-chart-icon" />)}
      </g>)}</>;
    }
    case 'stat-tile': case 'gauge': case 'bullet': {
      const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
      const value = data.stat?.value ?? 0;
      if (kind === 'stat-tile') {
        const spark = data.series[0]?.values ?? [];
        const [low, high] = [Math.min(...spark, 0), Math.max(...spark, 1)];
        return <><text x={W / 2} y={70} textAnchor="middle" className="lf-chart-stat">{number.format(value)}</text>
          {data.stat?.delta !== undefined ? <text x={W / 2} y={100} textAnchor="middle" className="lf-chart-label">{`${data.stat.delta >= 0 ? '+' : ''}${number.format(data.stat.delta)}`}</text> : null}
          {spark.length > 1 ? <polyline points={spark.map((v, i) => `${80 + i * 160 / (spark.length - 1)},${160 - (v - low) / (high - low || 1) * 40}`).join(' ')} className="lf-chart-line" stroke={HUES[0]} /> : null}</>;
      }
      const target = data.target ?? 1;
      if (kind === 'gauge') {
        const share = Math.max(0, Math.min(1, value / target)); const a = Math.PI * (1 - share);
        return <><path d={`M 60 150 A 100 100 0 0 1 260 150`} className="lf-chart-track" />
          <path d={`M 60 150 A 100 100 0 0 1 ${160 + 100 * Math.cos(a)} ${150 - 100 * Math.sin(a)}`} className="lf-chart-gauge" stroke={HUES[1]} />
          <text x={W / 2} y={140} textAnchor="middle" className="lf-chart-stat">{number.format(value)}</text></>;
      }
      const max = Math.max(target, value, ...(data.bands ?? [])) * 1.1;
      return <>{(data.bands ?? []).map((b, i) => <rect key={i} x={PAD} y={70} width={(W - 2 * PAD) * b / max} height={40} fill="var(--sunken)" opacity={0.5 + i * 0.2} />)}
        <rect x={PAD} y={80} width={(W - 2 * PAD) * value / max} height={20} fill={fillOf(prefix, 1)} />
        <line x1={PAD + (W - 2 * PAD) * target / max} x2={PAD + (W - 2 * PAD) * target / max} y1={60} y2={120} className="lf-chart-target" /></>;
    }
    case 'radar': {
      const cx = W / 2; const cy = H / 2; const r = 70; const max = Math.max(...data.series.flatMap((s) => s.values), 1);
      const point = (i: number, v: number) => `${cx + r * v / max * Math.cos(-Math.PI / 2 + i * 2 * Math.PI / n)},${cy + r * v / max * Math.sin(-Math.PI / 2 + i * 2 * Math.PI / n)}`;
      return <>{data.categories.map((c, i) => <g key={c.id}><line x1={cx} y1={cy} x2={point(i, max).split(',')[0]} y2={point(i, max).split(',')[1]} className="lf-chart-axis" />
        <text x={point(i, max * 1.18).split(',')[0]} y={point(i, max * 1.18).split(',')[1]} textAnchor="middle" className="lf-chart-label">{fitLabel(c.label, 8)}</text></g>)}
        {data.series.map((s, k) => <polygon key={s.id} points={s.values.map((v, i) => point(i, v)).join(' ')} fill={fillOf(prefix, k)} fillOpacity={0.45} stroke={HUES[k]} className="lf-chart-area" />)}</>;
    }
    case 'line': case 'area': case 'time-series': case 'step': case 'slope': case 'sparkline': case 'stacked-area': case 'stacked-area-100': {
      const x = (i: number) => PAD + i * (W - 2 * PAD) / Math.max(1, n - 1);
      const stacked = kind === 'stacked-area' || kind === 'stacked-area-100';
      const tops = data.categories.map(() => 0);
      const shapes = data.series.map((s, k) => {
        const values = s.values.map((v, i) => {
          if (!stacked) return v;
          const total = kind === 'stacked-area-100' ? data.series.reduce((sum, x2) => sum + (x2.values[i] ?? 0), 0) || 1 : 1;
          tops[i] = (tops[i] ?? 0) + v / total; return tops[i]!;
        });
        const pts = values.map((v, i) => [x(i), scaleY(v, extent)] as const);
        const line = kind === 'step' ? pts.flatMap(([px, py], i) => i === 0 ? [`${px},${py}`] : [`${px},${pts[i - 1]![1]}`, `${px},${py}`]).join(' ') : pts.map(([px, py]) => `${px},${py}`).join(' ');
        return <g key={s.id}>{kind === 'area' || stacked ? <polygon points={`${line} ${x(n - 1)},${zeroY} ${x(0)},${zeroY}`} fill={fillOf(prefix, k)} fillOpacity={0.5} /> : null}
          <polyline points={line} className="lf-chart-line" stroke={HUES[k]} strokeDasharray={k === 1 ? '6 3' : k === 2 ? '2 3' : undefined} />
          {kind === 'slope' || kind === 'time-series' ? pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="3.5" fill={HUES[k]} />) : null}</g>;
      });
      return <>{kind === 'sparkline' ? null : <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />}{stacked ? [...shapes].reverse() : shapes}{kind === 'sparkline' ? null : axisLabels(data)}</>;
    }
    case 'calendar-heatmap': {
      const days = data.days ?? []; const max = Math.max(1, ...days.map((d) => d.value)); const size = 18;
      return <>{days.map((d, i) => <rect key={d.date} x={PAD + (i % 7) * (size + 4)} y={10 + Math.floor(i / 7) * (size + 4)} width={size} height={size} rx="3"
        fill={d.value === 0 ? 'var(--sunken)' : HUES[0]} fillOpacity={d.value === 0 ? 1 : 0.3 + 0.7 * d.value / max} />)}</>;
    }
    case 'scatter': case 'bubble': {
      const points = data.points ?? [];
      const xs: [number, number] = [Math.min(0, ...points.map((p) => p.x)), Math.max(1, ...points.map((p) => p.x))];
      const ys: [number, number] = [Math.min(0, ...points.map((p) => p.y)), Math.max(1, ...points.map((p) => p.y))];
      const maxSize = Math.max(1, ...points.map((p) => p.size ?? 1));
      return <><line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="lf-chart-axis" /><line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} className="lf-chart-axis" />
        {points.map((p, i) => <circle key={p.id} cx={scaleX(p.x, xs)} cy={scaleY(p.y, ys)} r={kind === 'bubble' ? 4 + 14 * Math.sqrt((p.size ?? 1) / maxSize) : 5}
          fill={fillOf(prefix, i)} fillOpacity={0.75} />)}</>;
    }
    case 'sankey': return sankey(data, prefix);
    case 'flowchart': case 'decision-tree': case 'tree': return diagram(kind, data);
    default: return null;
  }
}

/** Layered positions: a node's column is its longest path from a start. */
function layers(nodes: NonNullable<ChartData['nodes']>, links: NonNullable<ChartData['links']>): Map<string, { col: number; row: number; cols: number; rows: number }> {
  const depth = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) for (const link of links) depth.set(link.to, Math.max(depth.get(link.to)!, depth.get(link.from)! + 1));
  const cols = Math.max(...depth.values()) + 1;
  const byCol = new Map<number, string[]>();
  for (const node of nodes) byCol.set(depth.get(node.id)!, [...(byCol.get(depth.get(node.id)!) ?? []), node.id]);
  const out = new Map<string, { col: number; row: number; cols: number; rows: number }>();
  for (const [col, ids] of byCol) ids.forEach((nodeId, row) => out.set(nodeId, { col, row, cols, rows: ids.length }));
  return out;
}

function sankey(data: ChartData, prefix: string): ReactNode {
  const nodes = data.nodes ?? []; const links = data.links ?? [];
  const pos = layers(nodes, links);
  const through = (nodeId: string) => Math.max(links.filter((l) => l.to === nodeId).reduce((s, l) => s + l.value!, 0), links.filter((l) => l.from === nodeId).reduce((s, l) => s + l.value!, 0));
  // Every column carries the same flow (conservation), so the first column's total sets the scale.
  const total = Math.max(1, nodes.filter((node) => pos.get(node.id)!.col === 0).reduce((sum, node) => sum + through(node.id), 0));
  const scale = (H - 40) / total;
  const colX = (col: number, cols: number) => 20 + col * (W - 60) / Math.max(1, cols - 1);
  const y = new Map<string, number>(); const cursorOut = new Map<string, number>(); const cursorIn = new Map<string, number>();
  const colY = new Map<number, number>();
  for (const node of nodes) { const p = pos.get(node.id)!; const top = colY.get(p.col) ?? 20; y.set(node.id, top); colY.set(p.col, top + through(node.id) * scale + 10); }
  return <>{links.map((l, i) => {
    const a = pos.get(l.from)!; const b = pos.get(l.to)!; const h = l.value! * scale;
    const y0 = y.get(l.from)! + (cursorOut.get(l.from) ?? 0); cursorOut.set(l.from, (cursorOut.get(l.from) ?? 0) + h);
    const y1 = y.get(l.to)! + (cursorIn.get(l.to) ?? 0); cursorIn.set(l.to, (cursorIn.get(l.to) ?? 0) + h);
    const x0 = colX(a.col, a.cols) + 10; const x1 = colX(b.col, b.cols); const mid = (x0 + x1) / 2;
    return <path key={i} d={`M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h} C ${mid} ${y1 + h}, ${mid} ${y0 + h}, ${x0} ${y0 + h} Z`} fill={fillOf(prefix, i)} fillOpacity={0.55} />;
  })}{nodes.map((node) => { const p = pos.get(node.id)!; const x = colX(p.col, p.cols);
    return <g key={node.id}><rect x={x} y={y.get(node.id)} width="10" height={Math.max(2, through(node.id) * scale)} className="lf-chart-node" />
      <text x={p.col === p.cols - 1 ? x - 4 : x + 14} y={y.get(node.id)! + Math.max(2, through(node.id) * scale) / 2} textAnchor={p.col === p.cols - 1 ? 'end' : 'start'} dominantBaseline="middle" className="lf-chart-label">{fitLabel(node.label, 12)}</text></g>; })}</>;
}

function diagram(kind: ChartKind, data: ChartData): ReactNode {
  const nodes = data.nodes ?? []; const links = data.links ?? [];
  const pos = layers(nodes, links);
  const box = { w: 78, h: 26 };
  // Top-down for trees and decision trees, left-right for flowcharts.
  const at = (nodeId: string) => { const p = pos.get(nodeId)!;
    return kind === 'flowchart' ? { x: 8 + p.col * (W - box.w - 16) / Math.max(1, p.cols - 1), y: 10 + (p.row + 0.5) * (H - 20) / p.rows - box.h / 2 }
      : { x: 8 + (p.row + 0.5) * (W - 16) / p.rows - box.w / 2, y: 8 + p.col * (H - box.h - 16) / Math.max(1, p.cols - 1) }; };
  return <>{links.map((l, i) => { const a = at(l.from); const b = at(l.to);
    const x1 = a.x + (kind === 'flowchart' ? box.w : box.w / 2); const y1 = a.y + (kind === 'flowchart' ? box.h / 2 : box.h);
    const x2 = b.x + (kind === 'flowchart' ? 0 : box.w / 2); const y2 = b.y + (kind === 'flowchart' ? box.h / 2 : 0);
    return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} className="lf-chart-edge" />
      {l.label ? <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} textAnchor="middle" className="lf-chart-edge-label">{fitLabel(l.label, 8)}</text> : null}</g>; })}
    {nodes.map((node) => { const p = at(node.id);
      return <g key={node.id} className={`lf-chart-box lf-chart-box--${node.kind ?? 'step'}`}><rect x={p.x} y={p.y} width={box.w} height={box.h} rx={node.kind === 'question' ? 2 : 10} />
        <text x={p.x + box.w / 2} y={p.y + box.h / 2} textAnchor="middle" dominantBaseline="middle" className="lf-chart-label">{fitLabel(node.label, 12)}</text></g>; })}</>;
}
