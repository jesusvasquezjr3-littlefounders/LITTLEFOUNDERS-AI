import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './buttons';
import { DataTable, type TableColumn } from './shells';
import './charts.css';

/*
 * The shared chart primitives of the rebuilt frontend (W2T.3): a trend over
 * ordered points (line or columns), a bar chart of categories, and a
 * sparkline. They follow Frontend Bible 05 §2, §5 and §6, which the staff
 * console's figures share with the lesson boards:
 *
 *   - series hues are `sky`, `mint` and `berry` (strong tones) in that fixed
 *     order, and from the second series on a second channel (a dashed or
 *     dotted line, a patterned column) so colour never carries a series alone;
 *     a fourth or later series takes the neutral overflow marks. `primary` is
 *     never a series: it marks the point being read (selection, 02 §4.2);
 *   - gridlines are decorative (`outline`), the base line is the 2 px `edge`;
 *   - every word is HTML beside the SVG (axis ends, legend, readout), never
 *     SVG text, so labels wrap in translation and never overlap or rotate;
 *   - the SVG is `aria-hidden`: the figure is named by its label, described by
 *     its summary (chart type, axes, key takeaway, written by the caller), and
 *     read point by point from the keyboard (arrow keys, Home, End) through a
 *     polite readout, or all at once through **Show as table** (05 §6);
 *   - no motion of their own, so reduced motion needs nothing.
 *
 * Copy is the caller's: these components hold no strings of their own.
 */

export interface VizPoint { key: string; label: string }
/** One series: a value per point (aligned with `points`), or null where nothing was measured. */
export interface VizSeries { id: string; label: string; values: readonly (number | null)[] }
export interface VizLabels {
  /** "Show as table" and "Show chart". */
  table: string; chart: string;
  /** The table's first column header (what a point is: "Day", "Week", "Run"). */
  point: string;
  /** Written in place of a missing value ("Not measured"). */
  missing: string;
  /** Appended to the plot's name for keyboard users ("Arrow keys read each point"). */
  keys: string;
}

const WIDTH = 600;
const HEIGHT = 200;
/** Series 2 and 3 carry a second channel besides the hue (05 §2 `series-pattern`). */
const DASH = ['', '10 6', '2 6'] as const;

/** A round upper bound for the scale, so the top gridline reads as a number people use. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

function seriesClass(index: number) {
  return index < 3 ? `lf-viz-series-${index + 1}` : 'lf-viz-series-overflow';
}

/**
 * A trend over ordered points (days, weeks, runs): `line` for a rate or a
 * level, `columns` for a count per point (stacked when the parts add up to a
 * whole). The first and last point labels sit under the plot, the scale's top
 * beside it; the readout names the point under the pointer or the keyboard,
 * and the latest point by default.
 */
export function TrendChart({ label, summary, points, series, format, labels, kind = 'line', stacked = false, reference }: {
  label: string; summary: string; points: readonly VizPoint[]; series: readonly VizSeries[]; format: (value: number) => string;
  labels: VizLabels; kind?: 'line' | 'columns'; stacked?: boolean;
  /** A dashed rule at one value (an average, a floor), named in the legend. */
  reference?: { label: string; value: number };
}) {
  const id = useId();
  // A pattern is referenced from CSS-free SVG paint; useId's colons are not valid in a url() fragment.
  const patternId = `lf-viz${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const count = points.length;
  // With no pointer or key on it, the readout names the latest point that has a value (a cohort's last weeks may not exist yet).
  const lastMeasured = useMemo(() => {
    for (let index = count - 1; index >= 0; index--) if (series.some((entry) => entry.values[index] !== null && entry.values[index] !== undefined)) return index;
    return count - 1;
  }, [count, series]);
  const shown = active !== null && active < count ? active : lastMeasured;
  const stackedColumns = kind === 'columns' && stacked;
  const max = useMemo(() => {
    const totals = points.map((_, index) => (stackedColumns
      ? series.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0)
      : Math.max(0, ...series.map((entry) => entry.values[index] ?? 0))));
    return niceMax(Math.max(reference?.value ?? 0, ...totals, 0));
  }, [points, series, stackedColumns, reference]);
  const y = (value: number) => HEIGHT - (value / max) * (HEIGHT - 2) - 1;
  const step = count > 1 ? WIDTH / (count - 1) : WIDTH;
  const slot = count ? WIDTH / count : WIDTH;
  const x = (index: number) => (kind === 'columns' ? index * slot + slot / 2 : count > 1 ? index * step : WIDTH / 2);

  const readout = (index: number) => {
    const point = points[index];
    if (!point) return '';
    const values = series.map((entry) => {
      const value = entry.values[index];
      const text = value === null || value === undefined ? labels.missing : format(value);
      return series.length > 1 ? `${entry.label} ${text}` : text;
    });
    return `${point.label}: ${values.join(' · ')}`;
  };
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!count) return;
    const next = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? Math.min(count - 1, shown + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? Math.max(0, shown - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !count) return;
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.min(count - 1, Math.max(0, kind === 'columns' ? Math.floor(ratio * count) : Math.round(ratio * (count - 1)))));
  };

  const columns: TableColumn<number>[] = [
    { key: 'point', label: labels.point, value: (index) => points[index]!.label },
    ...series.map((entry) => ({ key: entry.id, label: entry.label, value: (index: number) => {
      const value = entry.values[index];
      return value === null || value === undefined ? labels.missing : format(value);
    } })),
  ];

  return <figure className="lf-viz" data-viz="trend" data-kind={kind} aria-labelledby={`${id}-name`}>
    <div className="lf-viz-head">
      <figcaption className="lf-viz-caption">
        <span id={`${id}-name`} className="lf-viz-name" data-copy-role="heading">{label}</span>
        <span id={`${id}-summary`} className="lf-viz-summary" data-copy-role="body">{summary}</span>
      </figcaption>
      {count ? <Button size="sm" aria-pressed={table} onClick={() => setTable((value) => !value)}>{table ? labels.chart : labels.table}</Button> : null}
    </div>
    {count === 0 ? null : table ? <DataTable caption={label} columns={columns} rows={points.map((_, index) => index)} rowKey={(index) => points[index]!.key} /> : <>
      {series.length > 1 || reference ? <ul className="lf-viz-legend" aria-label={label}>
        {series.map((entry, index) => <li key={entry.id} className={seriesClass(index)} data-series={entry.id}>
          <svg viewBox="0 0 32 8" aria-hidden="true" className="lf-viz-key">
            {kind === 'columns' ? <rect className="lf-viz-key-fill" x="0" y="0" width="32" height="8" rx="2" style={index ? { fill: `url(#${patternId}-p${index})` } : undefined} />
              : <line className="lf-viz-key-line" x1="0" x2="32" y1="4" y2="4" strokeDasharray={DASH[Math.min(index, 2)]} />}
          </svg>
          <span data-copy-role="body">{entry.label}</span>
        </li>)}
        {reference ? <li data-series="reference">
          <svg viewBox="0 0 32 8" aria-hidden="true" className="lf-viz-key"><line className="lf-viz-reference" x1="0" x2="32" y1="4" y2="4" /></svg>
          <span data-copy-role="body">{`${reference.label}: ${format(reference.value)}`}</span>
        </li> : null}
      </ul> : null}
      <div className="lf-viz-frame">
        <span className="lf-viz-scale" data-copy-role="data">{format(max)}</span>
        <div className="lf-viz-plot" role="group" tabIndex={0} aria-label={`${label}. ${labels.keys}`} aria-describedby={`${id}-summary ${id}-readout`}
          onKeyDown={move} onPointerMove={track} onPointerDown={track} onPointerLeave={() => setActive(null)}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" className="lf-viz-svg">
            <defs>
              {[1, 2].map((index) => <pattern key={index} id={`${patternId}-p${index}`} width="6" height="6" patternUnits="userSpaceOnUse"
                className={seriesClass(index)} patternTransform={index === 1 ? 'rotate(45)' : undefined}>
                <rect className="lf-viz-pattern-ground" width="6" height="6" />
                {index === 1 ? <rect className="lf-viz-pattern-ink" width="3" height="6" /> : <circle className="lf-viz-pattern-ink" cx="3" cy="3" r="1.5" />}
              </pattern>)}
            </defs>
            {[0.5, 1].map((share) => <line key={share} className="lf-viz-grid" x1="0" x2={WIDTH} y1={y(max * share)} y2={y(max * share)} />)}
            {reference ? <line className="lf-viz-reference" x1="0" x2={WIDTH} y1={y(reference.value)} y2={y(reference.value)} /> : null}
            {kind === 'columns' ? points.map((point, index) => {
              let base = 0;
              const gap = slot > 4 ? Math.min(2, slot / 4) : 0;
              const bars = series.map((entry, seriesIndex) => {
                const value = entry.values[index] ?? 0;
                const width = stackedColumns ? slot - gap : (slot - gap) / series.length;
                const left = index * slot + gap / 2 + (stackedColumns ? 0 : seriesIndex * width);
                const top = y(stackedColumns ? base + value : value);
                const bottom = y(stackedColumns ? base : 0);
                if (stackedColumns) base += value;
                return <rect key={entry.id} className={`lf-viz-column ${seriesClass(seriesIndex)}`} x={left} width={Math.max(width, 0.5)}
                  y={top} height={Math.max(bottom - top, 0)} style={seriesIndex > 0 && seriesIndex < 3 ? { fill: `url(#${patternId}-p${seriesIndex})` } : undefined} />;
              });
              return <g key={point.key} data-active={index === shown ? 'true' : undefined}>{bars}</g>;
            }) : series.map((entry, seriesIndex) => {
              const runs: string[] = [];
              let run = '';
              entry.values.forEach((value, index) => {
                if (value === null || value === undefined) { if (run) runs.push(run); run = ''; return; }
                run += `${run ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
              });
              if (run) runs.push(run);
              return <g key={entry.id} className={seriesClass(seriesIndex)}>
                {runs.map((d) => <path key={d} className="lf-viz-line" d={d} strokeDasharray={DASH[Math.min(seriesIndex, 2)] || undefined} />)}
              </g>;
            })}
            <line className="lf-viz-base" x1="0" x2={WIDTH} y1={HEIGHT - 1} y2={HEIGHT - 1} />
            <line className="lf-viz-cursor" x1={x(shown)} x2={x(shown)} y1="0" y2={HEIGHT} />
          </svg>
        </div>
        <span className="lf-viz-scale lf-viz-scale--zero" data-copy-role="data">{format(0)}</span>
        <div className="lf-viz-axis">
          <span data-copy-role="data">{points[0]!.label}</span>
          {count > 1 ? <span data-copy-role="data">{points[count - 1]!.label}</span> : null}
        </div>
      </div>
      <p id={`${id}-readout`} className="lf-viz-readout" aria-live="polite" data-copy-role="data" data-readout={points[shown]!.key}>{readout(shown)}</p>
    </>}
  </figure>;
}

export interface VizBar { id: string; label: string; value: number; valueText: string; ugc?: boolean }

/**
 * Categories compared by length: a label, a bar on a shared baseline, and the
 * value written out. Every value is text, so the list is its own table (05 §6);
 * the bar only repeats it. `max` fixes the scale (a share of a known total).
 */
export function BarChart({ label, rows, max }: { label: string; rows: readonly VizBar[]; max?: number }) {
  const top = max ?? Math.max(0, ...rows.map((row) => row.value));
  return <ul className="lf-viz-bars" aria-label={label} data-viz="bars">
    {rows.map((row) => <li key={row.id} className="lf-viz-bar" data-bar={row.id}>
      <span className={`lf-viz-bar-label${row.ugc ? ' ugc' : ''}`} data-copy-role={row.ugc ? 'data' : 'body'}>{row.label}</span>
      <span className="lf-viz-bar-value" data-copy-role="data">{row.valueText}</span>
      <span className="lf-viz-bar-track" aria-hidden="true">
        <span className="lf-viz-bar-fill" style={{ inlineSize: `${top > 0 ? Math.min(100, Math.max(0, (row.value / top) * 100)) : 0}%` }} />
      </span>
    </li>)}
  </ul>;
}

/**
 * A small line of one series beside a figure (a metric's recent shape). It is
 * named in words (`label`: what, from, to, peak), since it has no axes.
 */
export function Sparkline({ label, values }: { label: string; values: readonly number[] }) {
  const max = Math.max(1e-9, ...values);
  const count = values.length;
  const d = values.map((value, index) => `${index ? 'L' : 'M'}${(count > 1 ? (index / (count - 1)) * 100 : 50).toFixed(1)},${(29 - (value / max) * 28).toFixed(1)}`).join('');
  return <span className="lf-viz-spark" role="img" aria-label={label}>
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path className="lf-viz-line" d={d} /></svg>
  </span>;
}
