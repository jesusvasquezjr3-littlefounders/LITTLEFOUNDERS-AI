import { Suspense, lazy, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Locale } from '../../design/copyBudget';
import { Button } from '../../design/controls';
import { chartFacts, chartReads, chartTable, chartTree, hierarchyValue, isReadingChart, shares, valueExtent, waterfallSteps, type ChartData, type ChartKind, type ReadingChartKind } from './chartModel.generated';
import { readingCell, readingDescription, readingWord } from './readingWords';
import './charts.css';

const ReadingPlot = lazy(() => import('./readingCharts'));

/*
 * B.7 part 1 (GAP-FIX-R1 learning; Appendix A Part 1; Bible 05 V1/V6): the
 * in-house SVG teaching charts. Every kind draws from the canonical chart
 * model Core validated (chartModel.generated.ts), so the drawing, the
 * Show-as-table rows and the accessible description carry the same numbers.
 * Each chart is one role="img" with a name and a description, can be read as
 * a table, draws up to three series in sky, mint and berry with a pattern as
 * a second channel (solid, stripes, dots). No stock chart library, no animation.
 *
 * GAP-FIX-R3 (Bible 02 D1 and rule 1; 05 §5): words are never cut. Every word
 * label (categories, lanes, nodes, bones, point labels) is HTML placed over
 * the SVG in the viewBox's proportions, at caption size, and wraps within the
 * room its mark gives it. The SVG carries marks, numerals and single symbols
 * only. A label that still does not fit (a word wider than its room, more
 * lines than its room holds, outside the drawing, or over another label) is
 * not drawn: the chart draws fewer labels and the Show-as-table rows carry
 * every one, never an ellipsis.
 */

/** One word label over the drawing, in viewBox units. */
export interface ChartTag {
  key: string; text: string; x: number; y: number;
  /** The width the label may wrap within. */
  room: number;
  align?: 'start' | 'middle' | 'end'; valign?: 'top' | 'middle' | 'bottom';
  /** How many lines the room holds. */
  lines?: number;
  /** A link or cause label: quieter than a mark's own name. */
  edge?: boolean;
}
type Tags = ChartTag[];
const tag = (out: Tags, value: ChartTag): null => { out.push(value); return null; };

export const chartCopy: Record<Locale, { showTable: string; showChart: string; table: string; category: string; value: string; target: string; delta: string; total: string; from: string; to: string; each: (n: string) => string }> = {
  'en-US': { showTable: 'Show as table', showChart: 'Show chart', table: 'Chart data', category: 'Item', value: 'Value', target: 'Goal', delta: 'Change', total: 'Total', from: 'From', to: 'To', each: (n) => `Each icon is ${n}` },
  'es-MX': { showTable: 'Ver tabla', showChart: 'Ver gráfica', table: 'Datos de la gráfica', category: 'Elemento', value: 'Valor', target: 'Meta', delta: 'Cambio', total: 'Total', from: 'De', to: 'A', each: (n) => `Cada ícono vale ${n}` },
  'pt-BR': { showTable: 'Ver tabela', showChart: 'Ver gráfico', table: 'Dados do gráfico', category: 'Item', value: 'Valor', target: 'Meta', delta: 'Mudança', total: 'Total', from: 'De', to: 'Para', each: (n) => `Cada ícone vale ${n}` },
};

export const HUES = ['var(--sky-strong)', 'var(--mint-strong)', 'var(--berry-strong)'];
export const W = 320; export const H = 180; const PAD = 28;

export function Patterns({ prefix }: { prefix: string }) {
  return <defs>
    {HUES.map((hue, index) => <pattern key={index} id={`${prefix}-${index}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={index === 1 ? 'rotate(45)' : undefined}>
      <rect width="6" height="6" fill={hue} />
      {index === 1 ? <rect width="2" height="6" fill="var(--surface)" /> : index === 2 ? <circle cx="3" cy="3" r="1.2" fill="var(--surface)" /> : null}
    </pattern>)}
  </defs>;
}
export const fillOf = (prefix: string, index: number) => `url(#${prefix}-${index % 3})`;

/** `embedded`: the chart sits inside a board that already offers its own table, so it drops its own toggle (one "Show as table" per board). */
export function TeachingChart({ kind, data, title, locale, embedded = false }: { kind: ChartKind; data: ChartData; title: string; locale: Locale; embedded?: boolean }) {
  const t = chartCopy[locale];
  const [table, setTable] = useState(false);
  const id = useId().replace(/:/g, '');
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const reading = isReadingChart(kind);
  const facts = reading ? readingDescription(locale, chartReads(kind, data), number.format) : chartFacts(kind, data).map((fact) => `${fact.label}: ${number.format(fact.value)}`).join('; ');
  const model = chartTable(kind, data);
  const canvas = useRef<HTMLDivElement>(null);
  useFittedTags(canvas);
  const labels: Tags = [];
  const drawing = table || reading ? null : draw(kind, data, id, locale, labels);
  const word = (text: string) => (reading ? readingCell(locale, text) : text);
  return <figure className="lf-chart" data-chart-kind={kind}>
    <figcaption className="lf-chart-head"><span data-copy-role="heading">{title}</span>
      {embedded ? null : <Button onClick={() => setTable((value) => !value)}>{table ? t.showChart : t.showTable}</Button>}</figcaption>
    {table ? <table className="lf-learning-table lf-chart-table" aria-label={t.table}>
      <thead><tr><th scope="col" data-copy-role="data">{t.category}</th>{model.columns.map((column) => <th key={column} scope="col" data-copy-role="data">{reading ? readingWord(locale, column) : column}</th>)}</tr></thead>
      <tbody>{model.rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => index === 0
        ? <th key={index} scope="row" data-copy-role="data">{typeof cell === 'number' ? number.format(cell) : word(cell)}</th>
        : <td key={index} data-copy-role="data">{typeof cell === 'number' ? number.format(cell) : word(cell)}</td>)}</tr>)}</tbody>
    </table> : reading ? <Suspense fallback={<div className="lf-chart-plot" aria-busy="true" data-copy-role="data"><div className="lf-chart-canvas" /></div>}>
      <ReadingPlot kind={kind as ReadingChartKind} data={data} title={title} locale={locale} id={id} description={facts} />
    </Suspense> : <div className="lf-chart-plot" role="img" aria-label={title} aria-describedby={`${id}-desc`} data-copy-role="data">
      {/* 05 §5: words are HTML over the SVG (`labels`), the SVG itself carries marks, numerals and symbols. */}
      <div ref={canvas} className="lf-chart-canvas"><svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false"><Patterns prefix={id} />{drawing}</svg>
        {labels.map((label) => <ChartLabel key={label.key} label={label} />)}</div>
      <p id={`${id}-desc`} className="lf-visually-hidden">{facts}</p>
      {legend(kind, data, id)}
      {kind === 'pictogram' && data.icon_value ? <p className="lf-chart-note" data-copy-role="data">{t.each(number.format(data.icon_value))}</p> : null}
    </div>}
  </figure>;
}

const SHIFT = { start: '0%', middle: '-50%', end: '-100%', top: '0%', bottom: '-100%' } as const;

export function ChartLabel({ label }: { label: ChartTag }) {
  const align = label.align ?? 'middle'; const valign = label.valign ?? 'middle';
  const style: CSSProperties = {
    left: `${label.x / W * 100}%`, top: `${label.y / H * 100}%`, maxInlineSize: `${Math.max(0, label.room) / W * 100}%`,
    transform: `translate(${SHIFT[align]}, ${valign === 'middle' ? '-50%' : SHIFT[valign]})`,
  };
  return <span className={`lf-chart-tag${label.edge ? ' lf-chart-tag--edge' : ''}`} data-copy-role="data" data-align={align}
    data-lines={label.lines ?? 2} style={style}>{label.text}</span>;
}

/**
 * Draws fewer labels, never shorter ones: after layout, a label whose longest
 * word is wider than its room, that needs more lines than its room holds, that
 * leaves the drawing or that lands on an earlier label is hidden
 * (`data-fit="no"`). Re-measured on resize and when the web fonts arrive.
 */
export function useFittedTags(canvas: React.RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const host = canvas.current;
    if (!host) return;
    let live = true;
    const fit = () => {
      if (!live) return;
      const box = host.getBoundingClientRect();
      if (box.width === 0) return;
      const placed: DOMRect[] = [];
      let dropped = 0;
      for (const element of host.querySelectorAll<HTMLElement>('.lf-chart-tag')) {
        const rect = element.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 16;
        const lines = Number(element.dataset.lines ?? 2);
        // The text's own extent, not the rounded scroll width: a word 0.6 px wider than its room still overflows it.
        const range = document.createRange();
        range.selectNodeContents(element);
        const inked = range.getBoundingClientRect?.().width ?? 0;
        const fits = element.scrollWidth <= element.clientWidth + 1 && inked <= rect.width + 0.25 && rect.height <= lines * lineHeight + 1
          && rect.left >= box.left - 1 && rect.right <= box.right + 1
          && !placed.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top);
        if (fits) { placed.push(rect); element.removeAttribute('data-fit'); } else { element.dataset.fit = 'no'; dropped += 1; }
      }
      host.dataset.labelsDropped = String(dropped);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(host);
    void document.fonts?.ready.then(fit);
    // GAP-FIX-R4 (WCAG 1.4.12): a user style sheet that widens letter or word spacing changes no box size, so a
    // style added to the page (or a style on the root) re-measures the labels too.
    const styles = typeof MutationObserver === 'undefined' ? null : new MutationObserver(fit);
    styles?.observe(document.head, { childList: true, subtree: true, characterData: true });
    styles?.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    styles?.observe(host, { characterData: true, subtree: true });
    return () => { live = false; observer?.disconnect(); styles?.disconnect(); };
  });
}

function legend(kind: ChartKind, data: ChartData, prefix: string): ReactNode {
  const perCategory = kind === 'pie' || kind === 'donut' || kind === 'waffle' || kind === 'venn';
  const items = perCategory ? data.categories.map((c) => c.label) : data.series.length > 1 ? data.series.map((s) => s.label) : [];
  if (items.length === 0) return null;
  return <ul className="lf-chart-legend">{items.map((item, index) => <li key={item} data-copy-role="data">
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect width="12" height="12" rx="2" fill={fillOf(prefix, index)} /></svg>{item}</li>)}</ul>;
}

const scaleY = (value: number, [low, high]: [number, number]) => H - PAD - (value - low) / (high - low) * (H - 2 * PAD);
const scaleX = (value: number, [low, high]: [number, number]) => PAD + (value - low) / (high - low) * (W - 2 * PAD);

/** Category names: under each column (wrapping within its band), or above each bar of a horizontal chart. */
function axisLabels(data: ChartData, out: Tags, horizontal = false): ReactNode {
  const n = Math.max(1, data.categories.length);
  for (const [i, c] of data.categories.entries()) {
    if (horizontal) tag(out, { key: `cat:${c.id}`, text: c.label, x: PAD, y: PAD + i * (H - 2 * PAD) / n + 1, room: W - 2 * PAD, align: 'start', valign: 'top', lines: 1 });
    else tag(out, { key: `cat:${c.id}`, text: c.label, x: PAD + (i + 0.5) * (W - 2 * PAD) / n, y: H - PAD + 3, room: (W - 2 * PAD) / n - 2, valign: 'top' });
  }
  return null;
}

function draw(kind: ChartKind, data: ChartData, prefix: string, locale: Locale, out: Tags): ReactNode {
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
      return <><line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />{bars}{pareto}{axisLabels(data, out)}</>;
    }
    case 'bar': {
      const [low, high] = extent;
      const bandY = (H - 2 * PAD) / n;
      return <>{data.categories.map((c, i) => data.series.map((s, k) => {
        // The name sits above its bar (a word never squeezes into the left margin).
        const h = bandY * 0.45 / data.series.length;
        const value = s.values[i] ?? 0;
        const x0 = scaleX(0, [low, high]); const x1 = scaleX(value, [low, high]);
        return <rect key={`${c.id}-${s.id}`} x={Math.min(x0, x1)} y={PAD + i * bandY + bandY * 0.5 + k * h} width={Math.abs(x1 - x0)} height={h} fill={fillOf(prefix, k)} />;
      }))}{axisLabels(data, out, true)}</>;
    }
    case 'waterfall': {
      const steps = waterfallSteps(data);
      return <><line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />
        {steps.map((step, i) => { const y0 = scaleY(step.start, extent); const y1 = scaleY(step.end, extent);
          return <rect key={data.categories[i]!.id} x={PAD + i * band + band * 0.15} y={Math.min(y0, y1)} width={band * 0.7} height={Math.max(1, Math.abs(y1 - y0))} fill={fillOf(prefix, step.delta < 0 ? 2 : 1)} />; })}
        {axisLabels(data, out)}</>;
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
        {tag(out, { key: `cat:${c.id}`, text: c.label, x: 4, y: 10 + (i + 0.5) * rowH, room: 70, align: 'start' })}
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
        {tag(out, { key: `cat:${c.id}`, text: c.label, x: Number(point(i, max * 1.2).split(',')[0]), y: Number(point(i, max * 1.2).split(',')[1]), room: 80 })}</g>)}
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
      return <>{kind === 'sparkline' ? null : <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} className="lf-chart-axis" />}{stacked ? [...shapes].reverse() : shapes}{kind === 'sparkline' ? null : axisLabels(data, out)}</>;
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
    case 'sankey': return sankey(data, prefix, out);
    case 'flowchart': case 'decision-tree': case 'tree': case 'org-chart': return diagram(kind === 'org-chart' ? 'tree' : kind, data, out);
    default: return situational(kind, data, prefix, extent, out);
  }
}

/* ── GAP-FIX-R2 (B.7 part 1): the remaining Appendix A situational kinds ─── */

function situational(kind: ChartKind, data: ChartData, prefix: string, extent: [number, number], out: Tags): ReactNode {
  const n = Math.max(1, data.categories.length);
  switch (kind) {
    case 'candlestick': {
      // A rising candle is hollow with the sky outline, a falling one filled berry: never colour alone (05 §2).
      const rows = data.ohlc ?? []; const band = (W - 2 * PAD) / Math.max(1, rows.length);
      return <>{rows.map((r, i) => { const x = PAD + (i + 0.5) * band; const up = r.close >= r.open;
        const top = scaleY(Math.max(r.open, r.close), extent); const bottom = scaleY(Math.min(r.open, r.close), extent);
        return <g key={r.id}><line x1={x} x2={x} y1={scaleY(r.high, extent)} y2={scaleY(r.low, extent)} className="lf-chart-stem" />
          <rect x={x - band * 0.3} y={top} width={band * 0.6} height={Math.max(1, bottom - top)} fill={up ? 'var(--surface)' : fillOf(prefix, 2)} stroke={up ? HUES[0] : HUES[2]} strokeWidth="2" />
          {tag(out, { key: `row:${r.id}`, text: r.label, x, y: H - PAD + 3, room: band - 2, valign: 'top' })}</g>; })}</>;
    }
    case 'box-plot': {
      const rows = data.boxes ?? []; const band = (W - 2 * PAD) / Math.max(1, rows.length);
      return <>{rows.map((r, i) => { const x = PAD + (i + 0.5) * band; const w = band * 0.5;
        return <g key={r.id}><line x1={x} x2={x} y1={scaleY(r.max, extent)} y2={scaleY(r.min, extent)} className="lf-chart-stem" />
          <line x1={x - w / 4} x2={x + w / 4} y1={scaleY(r.max, extent)} y2={scaleY(r.max, extent)} className="lf-chart-stem" />
          <line x1={x - w / 4} x2={x + w / 4} y1={scaleY(r.min, extent)} y2={scaleY(r.min, extent)} className="lf-chart-stem" />
          <rect x={x - w / 2} y={scaleY(r.q3, extent)} width={w} height={Math.max(1, scaleY(r.q1, extent) - scaleY(r.q3, extent))} fill={fillOf(prefix, i)} fillOpacity={0.6} />
          <line x1={x - w / 2} x2={x + w / 2} y1={scaleY(r.median, extent)} y2={scaleY(r.median, extent)} className="lf-chart-target" />
          {tag(out, { key: `row:${r.id}`, text: r.label, x, y: H - PAD + 3, room: band - 2, valign: 'top' })}</g>; })}</>;
    }
    case 'marimekko': {
      // Column width is the column's share of the whole; each stack is 100% of its column.
      const totals = data.categories.map((_, i) => data.series.reduce((sum, series) => sum + (series.values[i] ?? 0), 0));
      const grand = totals.reduce((a, b) => a + b, 0) || 1; let left = PAD;
      return <>{data.categories.map((c, i) => { const width = (W - 2 * PAD) * totals[i]! / grand; const x = left; left += width; let top = 0;
        return <g key={c.id}>{data.series.map((series, k) => { const share = (series.values[i] ?? 0) / (totals[i] || 1);
          const y0 = scaleY(top, [0, 1]); top += share; const y1 = scaleY(top, [0, 1]);
          return <rect key={series.id} x={x} y={y1} width={Math.max(0, width - 2)} height={Math.max(0, y0 - y1)} fill={fillOf(prefix, k)} />; })}
          {tag(out, { key: `cat:${c.id}`, text: c.label, x: x + width / 2, y: H - PAD + 3, room: width - 2, valign: 'top' })}</g>; })}</>;
    }
    case 'bump': {
      const k = data.series.length; const x = (i: number) => PAD + i * (W - 2 * PAD) / Math.max(1, n - 1);
      const y = (rank: number) => PAD + (rank - 1) * (H - 2 * PAD) / Math.max(1, k - 1);
      return <>{data.series.map((series, j) => <g key={series.id}>
        <polyline points={series.values.map((rank, i) => `${x(i)},${y(rank)}`).join(' ')} className="lf-chart-line" stroke={HUES[j]} strokeDasharray={j === 1 ? '6 3' : j === 2 ? '2 3' : undefined} />
        {series.values.map((rank, i) => <circle key={i} cx={x(i)} cy={y(rank)} r="5" fill={fillOf(prefix, j)} />)}</g>)}
        {Array.from({ length: k }, (_, r) => <text key={r} x={PAD - 10} y={y(r + 1)} textAnchor="end" dominantBaseline="middle" className="lf-chart-label">{r + 1}</text>)}
        {axisLabels(data, out)}</>;
    }
    case 'connected-scatter': {
      const points = data.points ?? [];
      const xs: [number, number] = [Math.min(0, ...points.map((p) => p.x)), Math.max(1, ...points.map((p) => p.x))];
      const ys: [number, number] = [Math.min(0, ...points.map((p) => p.y)), Math.max(1, ...points.map((p) => p.y))];
      return <><line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="lf-chart-axis" /><line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} className="lf-chart-axis" />
        <polyline points={points.map((p) => `${scaleX(p.x, xs)},${scaleY(p.y, ys)}`).join(' ')} className="lf-chart-line" stroke={HUES[0]} />
        {points.map((p, i) => <g key={p.id}><circle cx={scaleX(p.x, xs)} cy={scaleY(p.y, ys)} r={i === points.length - 1 ? 6 : 4} fill={fillOf(prefix, i === points.length - 1 ? 2 : 0)} />
          {i === 0 || i === points.length - 1 ? tag(out, { key: `pt:${p.id}`, text: p.label, x: scaleX(p.x, xs) + (scaleX(p.x, xs) > W / 2 ? -7 : 7), y: scaleY(p.y, ys) - 6,
            room: 96, align: scaleX(p.x, xs) > W / 2 ? 'end' : 'start', valign: 'bottom', lines: 1 }) : null}</g>)}</>;
    }
    case 'venn': {
      const sets = data.categories; const r = sets.length === 2 ? 58 : 50;
      const centers = sets.length === 2 ? [[W / 2 - 34, H / 2], [W / 2 + 34, H / 2]] : [[W / 2 - 30, H / 2 - 18], [W / 2 + 30, H / 2 - 18], [W / 2, H / 2 + 28]];
      const at = (ids: string[]) => { const picked = ids.map((id) => sets.findIndex((set) => set.id === id)).filter((index) => index >= 0);
        const cx = picked.reduce((sum, index) => sum + centers[index]![0]!, 0) / picked.length; const cy = picked.reduce((sum, index) => sum + centers[index]![1]!, 0) / picked.length;
        if (picked.length === 1) { const ox = cx - W / 2; const oy = cy - H / 2; const len = Math.hypot(ox, oy) || 1; return [cx + ox / len * 22, cy + oy / len * 22]; }
        return [cx, cy]; };
      return <>{sets.map((set, i) => <circle key={set.id} cx={centers[i]![0]} cy={centers[i]![1]} r={r} fill={fillOf(prefix, i)} fillOpacity={0.35} stroke={HUES[i]} strokeWidth="2" />)}
        {(data.regions ?? []).map((region) => { const [x, y] = at(region.sets);
          return <text key={[...region.sets].sort().join('+')} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="lf-chart-stat lf-chart-stat--small">{region.value}</text>; })}</>;
    }
    case 'treemap': case 'icicle': case 'sunburst': return hierarchy(kind, data, prefix, out);
    case 'swimlane': return swimlane(data, out);
    case 'ishikawa': return fishbone(data, out);
    case 'mind-map': return mindMap(data, prefix, out);
    default: return null;
  }
}

function hierarchy(kind: ChartKind, data: ChartData, prefix: string, out: Tags): ReactNode {
  const tree = chartTree(data);
  if (typeof tree === 'string') return null;
  const value = (id: string) => hierarchyValue(data, id, tree.children);
  const label = (id: string) => data.nodes?.find((node) => node.id === id)?.label ?? id;
  const top = tree.children.get(tree.root) ?? [];
  const marks: ReactNode[] = [];
  if (kind === 'treemap') {
    // Slice-and-dice: top-level groups across, their children down, each group one hue with its pattern.
    let x = PAD / 2; const total = value(tree.root) || 1;
    top.forEach((group, g) => { const width = (W - PAD) * value(group) / total; let y = 8; const kids = tree.children.get(group) ?? [group];
      kids.forEach((kid) => { const height = (H - 16) * value(kid) / (value(group) || 1);
        marks.push(<g key={kid}><rect x={x} y={y} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} fill={fillOf(prefix, g)} fillOpacity={0.75} className="lf-chart-tile" />
          {width > 36 && height > 16 ? tag(out, { key: `node:${kid}`, text: label(kid), x: x + 4, y: y + 3, room: width - 8, align: 'start', valign: 'top', lines: Math.max(1, Math.floor((height - 6) / 15)) }) : null}</g>); y += height; });
      x += width; });
    return <>{marks}</>;
  }
  if (kind === 'icicle') {
    const rowH = (H - 16) / (Math.max(...tree.depth.values()) + 1);
    const place = (id: string, x: number, width: number, g: number) => { const d = tree.depth.get(id)!;
      marks.push(<g key={id}><rect x={x} y={8 + d * rowH} width={Math.max(0, width - 2)} height={rowH - 2} fill={d === 0 ? 'var(--sunken)' : fillOf(prefix, g)} fillOpacity={d === 0 ? 1 : 0.9 - d * 0.15} className="lf-chart-tile" />
        {width > 30 ? tag(out, { key: `node:${id}`, text: label(id), x: x + 4, y: 8 + d * rowH + rowH / 2, room: width - 8, align: 'start', lines: Math.max(1, Math.floor((rowH - 6) / 15)) }) : null}</g>);
      let left = x; for (const kid of tree.children.get(id) ?? []) { const w = width * value(kid) / (value(id) || 1); place(kid, left, w, d === 0 ? (tree.children.get(id) ?? []).indexOf(kid) : g); left += w; } };
    place(tree.root, PAD / 2, W - PAD, 0);
    return <>{marks}</>;
  }
  // Sunburst: rings by depth, the root a centre disc.
  const cx = W / 2; const cy = H / 2; const ring = 26;
  const arc = (r0: number, r1: number, a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0; const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M ${p(r1, 0)} A ${r1} ${r1} 0 1 1 ${p(r1, Math.PI)} A ${r1} ${r1} 0 1 1 ${p(r1, 0)} M ${p(r0, 0)} A ${r0} ${r0} 0 1 0 ${p(r0, Math.PI)} A ${r0} ${r0} 0 1 0 ${p(r0, 0)} Z`;
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`; };
  const place = (id: string, a0: number, a1: number, g: number) => { const d = tree.depth.get(id)!;
    if (d > 0) marks.push(<path key={id} d={arc(18 + (d - 1) * ring, 18 + d * ring - 2, a0, a1)} fill={fillOf(prefix, g)} fillOpacity={1 - (d - 1) * 0.2} className="lf-chart-slice" />);
    let start = a0; for (const kid of tree.children.get(id) ?? []) { const span = (a1 - a0) * value(kid) / (value(id) || 1); place(kid, start, start + span, d === 0 ? (tree.children.get(id) ?? []).indexOf(kid) : g); start += span; } };
  place(tree.root, -Math.PI / 2, Math.PI * 1.5, 0);
  return <><circle cx={cx} cy={cy} r={16} fill="var(--sunken)" />{marks}</>;
}

function swimlane(data: ChartData, out: Tags): ReactNode {
  const lanes = data.categories; const nodes = data.nodes ?? []; const links = data.links ?? [];
  const laneH = (H - 8) / Math.max(1, lanes.length); const order = new Map(nodes.map((node, i) => [node.id, i]));
  const box = { w: 64, h: Math.min(32, laneH - 6) }; const colW = (W - 70 - box.w) / Math.max(1, nodes.length - 1);
  const at = (id: string) => { const node = nodes.find((item) => item.id === id)!; const lane = lanes.findIndex((l) => l.id === node.lane);
    return { x: 62 + order.get(id)! * colW, y: 4 + lane * laneH + laneH / 2 - box.h / 2 }; };
  // The lane bands are the ground the steps sit on, not data marks (05 §2): decoration for the board audit.
  return <>{lanes.map((lane, i) => <g key={lane.id}><rect x={2} y={4 + i * laneH} width={W - 4} height={laneH - 2} className="lf-chart-lane" data-board-decoration="lane" />
    {tag(out, { key: `lane:${lane.id}`, text: lane.label, x: 6, y: 4 + i * laneH + laneH / 2, room: 52, align: 'start', lines: Math.max(1, Math.floor((laneH - 4) / 15)) })}</g>)}
    {links.map((l, i) => { const a = at(l.from); const b = at(l.to);
      return <line key={i} x1={a.x + box.w} y1={a.y + box.h / 2} x2={b.x} y2={b.y + box.h / 2} className="lf-chart-edge" />; })}
    {nodes.map((node) => { const p = at(node.id); return <g key={node.id} className="lf-chart-box lf-chart-box--step"><rect x={p.x} y={p.y} width={box.w} height={box.h} rx="6" />
      {tag(out, { key: `node:${node.id}`, text: node.label, x: p.x + box.w / 2, y: p.y + box.h / 2, room: box.w - 4, lines: Math.max(1, Math.floor(box.h / 15)) })}</g>; })}</>;
}

function fishbone(data: ChartData, out: Tags): ReactNode {
  const tree = chartTree(data);
  if (typeof tree === 'string') return null;
  const label = (id: string) => data.nodes?.find((node) => node.id === id)?.label ?? id;
  const bones = tree.children.get(tree.root) ?? []; const spineY = H / 2; const head = W - 70;
  const per = Math.ceil(bones.length / 2); const step = (head - 30) / Math.max(1, per);
  return <><line x1={20} x2={head} y1={spineY} y2={spineY} className="lf-chart-spine" />
    <g className="lf-chart-box lf-chart-box--outcome"><rect x={head} y={spineY - 16} width={64} height={32} rx="4" />
      {tag(out, { key: `node:${tree.root}`, text: label(tree.root), x: head + 32, y: spineY, room: 60 })}</g>
    {bones.map((bone, i) => { const up = i % 2 === 0; const x = 40 + Math.floor(i / 2) * step + step * 0.6; const y = up ? 22 : H - 22;
      return <g key={bone}><line x1={x - 30} y1={y} x2={x} y2={spineY} className="lf-chart-edge" />
        {tag(out, { key: `node:${bone}`, text: label(bone), x: x - 30, y: up ? y - 3 : y + 3, room: step * 0.9, valign: up ? 'bottom' : 'top', lines: 1 })}
        {(tree.children.get(bone) ?? []).map((cause, k) => { const t = (k + 1) / ((tree.children.get(bone) ?? []).length + 1);
          const cx2 = x - 30 + 30 * t; const cy2 = y + (spineY - y) * t;
          return <g key={cause}><line x1={cx2 - 26} x2={cx2} y1={cy2} y2={cy2} className="lf-chart-edge" />
            {tag(out, { key: `node:${cause}`, text: label(cause), x: cx2 - 28, y: cy2, room: 60, align: 'end', lines: 1, edge: true })}</g>; })}</g>; })}</>;
}

function mindMap(data: ChartData, prefix: string, out: Tags): ReactNode {
  const tree = chartTree(data);
  if (typeof tree === 'string') return null;
  const cx = W / 2; const cy = H / 2; const pos = new Map<string, [number, number]>([[tree.root, [cx, cy]]]);
  const place = (id: string, a0: number, a1: number) => { const kids = tree.children.get(id) ?? []; const d = tree.depth.get(id)! + 1;
    kids.forEach((kid, i) => { const a = a0 + (a1 - a0) * (i + 0.5) / kids.length; pos.set(kid, [cx + Math.cos(a) * d * 52, cy + Math.sin(a) * d * 34]);
      place(kid, a0 + (a1 - a0) * i / kids.length, a0 + (a1 - a0) * (i + 1) / kids.length); }); };
  place(tree.root, -Math.PI, Math.PI);
  const branch = (id: string): number => { let at = id; let up = (data.links ?? []).find((l) => l.to === at)?.from;
    while (up && up !== tree.root) { at = up; up = (data.links ?? []).find((l) => l.to === at)?.from; }
    return (tree.children.get(tree.root) ?? []).indexOf(at); };
  return <>{(data.links ?? []).map((l, i) => { const a = pos.get(l.from)!; const b = pos.get(l.to)!;
    return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="lf-chart-edge" />; })}
    {(data.nodes ?? []).map((node) => { const [x, y] = pos.get(node.id)!; const root = node.id === tree.root;
      return <g key={node.id}><ellipse cx={x} cy={y} rx={root ? 36 : 30} ry={root ? 16 : 12} fill={root ? 'var(--sunken)' : fillOf(prefix, Math.max(0, branch(node.id)))} fillOpacity={root ? 1 : 0.45} className="lf-chart-bubble" />
        {tag(out, { key: `node:${node.id}`, text: node.label, x, y, room: root ? 70 : 58 })}</g>; })}</>;
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

type SankeyLayout = { paths: string[]; nodes: { id: string; label: string; x: number; y: number; height: number; last: boolean; room: number }[] };

function sankeyLayout(data: ChartData): SankeyLayout {
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
  const paths = links.map((l) => {
    const a = pos.get(l.from)!; const b = pos.get(l.to)!; const h = l.value! * scale;
    const y0 = y.get(l.from)! + (cursorOut.get(l.from) ?? 0); cursorOut.set(l.from, (cursorOut.get(l.from) ?? 0) + h);
    const y1 = y.get(l.to)! + (cursorIn.get(l.to) ?? 0); cursorIn.set(l.to, (cursorIn.get(l.to) ?? 0) + h);
    const x0 = colX(a.col, a.cols) + 10; const x1 = colX(b.col, b.cols); const mid = (x0 + x1) / 2;
    return `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h} C ${mid} ${y1 + h}, ${mid} ${y0 + h}, ${x0} ${y0 + h} Z`;
  });
  return { paths, nodes: nodes.map((node) => { const p = pos.get(node.id)!;
    return { id: node.id, label: node.label, x: colX(p.col, p.cols), y: y.get(node.id)!, height: Math.max(2, through(node.id) * scale), last: p.col === p.cols - 1,
      room: (W - 60) / Math.max(1, p.cols - 1) - 18 }; }) };
}

function sankey(data: ChartData, prefix: string, out: Tags): ReactNode {
  const layout = sankeyLayout(data);
  for (const node of layout.nodes) tag(out, { key: `node:${node.id}`, text: node.label, x: node.last ? node.x - 4 : node.x + 14, y: node.y + node.height / 2,
    room: node.room, align: node.last ? 'end' : 'start' });
  return <>{layout.paths.map((d, i) => <path key={i} d={d} fill={fillOf(prefix, i)} fillOpacity={0.55} />)}
    {layout.nodes.map((node) => <rect key={node.id} x={node.x} y={node.y} width="10" height={node.height} className="lf-chart-node" />)}</>;
}

function diagram(kind: ChartKind, data: ChartData, out: Tags): ReactNode {
  const nodes = data.nodes ?? []; const links = data.links ?? [];
  const pos = layers(nodes, links);
  const box = { w: 78, h: 32 };
  // Top-down for trees and decision trees, left-right for flowcharts.
  const at = (nodeId: string) => { const p = pos.get(nodeId)!;
    return kind === 'flowchart' ? { x: 8 + p.col * (W - box.w - 16) / Math.max(1, p.cols - 1), y: 10 + (p.row + 0.5) * (H - 20) / p.rows - box.h / 2 }
      : { x: 8 + (p.row + 0.5) * (W - 16) / p.rows - box.w / 2, y: 8 + p.col * (H - box.h - 16) / Math.max(1, p.cols - 1) }; };
  return <>{links.map((l, i) => { const a = at(l.from); const b = at(l.to);
    const x1 = a.x + (kind === 'flowchart' ? box.w : box.w / 2); const y1 = a.y + (kind === 'flowchart' ? box.h / 2 : box.h);
    const x2 = b.x + (kind === 'flowchart' ? 0 : box.w / 2); const y2 = b.y + (kind === 'flowchart' ? box.h / 2 : 0);
    return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} className="lf-chart-edge" />
      {l.label ? tag(out, { key: `link:${i}`, text: l.label, x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 2, room: 56, valign: 'bottom', lines: 1, edge: true }) : null}</g>; })}
    {nodes.map((node) => { const p = at(node.id);
      return <g key={node.id} className={`lf-chart-box lf-chart-box--${node.kind ?? 'step'}`}><rect x={p.x} y={p.y} width={box.w} height={box.h} rx={node.kind === 'question' ? 2 : 10} />
        {tag(out, { key: `node:${node.id}`, text: node.label, x: p.x + box.w / 2, y: p.y + box.h / 2, room: box.w - 4 })}</g>; })}</>;
}
