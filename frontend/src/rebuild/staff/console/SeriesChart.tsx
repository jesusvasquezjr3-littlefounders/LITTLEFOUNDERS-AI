import { ProgressBar, Sparkline, TrendChart } from '../../design/controls';
import { useChartLabels } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * A value over ordered points (a run's lessons, runs over time, heartbeat
 * snapshots) for the Generation page, drawn by the design system's TrendChart
 * (W2T.3): columns in the first series hue, the latest and highest values
 * written as the figure's summary, the first and last point under the plot, the readout naming the
 * point under the pointer or the keyboard, and Show as table. `compact` draws
 * a small multiple (one stage over time) as a sparkline with its label and
 * latest value written beside it. Staff surface: no motion.
 */

export interface SeriesPoint { id: string; label: string; value: number }

export function SeriesChart({ label, points, format, compact = false }: {
  label: string; points: readonly SeriesPoint[]; format: (value: number) => string; compact?: boolean;
}) {
  const { copy } = useConsoleCopy();
  const labels = useChartLabels();
  const count = points.length;
  if (count === 0) return null;
  const last = points[count - 1]!;
  const peak = Math.max(...points.map((point) => point.value));
  const values = { latest: format(last.value), peak: format(peak) };
  if (compact) {
    return <div className="lf-staff-multiple" data-compact="true">
      <p className="lf-staff-multiple-caption">
        <span data-copy-role="body">{label}</span>
        <span data-copy-role="data">{format(last.value)}</span>
      </p>
      <Sparkline label={`${label}. ${fill(copy.chart.body.summaryLatest, values)}`} values={points.map((point) => point.value)} />
    </div>;
  }
  return <TrendChart label={label} summary={fill(copy.chart.body.summarySeries, values)} kind="columns" format={format} labels={{ ...labels, point: copy.chart.body.point_series }}
    points={points.map((point) => ({ key: point.id, label: point.label }))}
    series={[{ id: 'value', label, values: points.map((point) => point.value) }]} />;
}

/** Judge rubric means (0-5), each a labelled bar with its value written out; the floor of 4 is the bar's tone, never the only reading. */
export function JudgeScores({ label, rows, format }: {
  label: string; rows: readonly { id: string; label: string; value: number; extra?: string }[]; format: (value: number) => string;
}) {
  return <ul className="lf-staff-bars" aria-label={label}>
    {rows.map((row) => <li key={row.id} data-dimension={row.id}>
      <ProgressBar label={row.label} value={row.value} max={5} tone={row.value >= 4 ? 'primary' : 'reward'}
        valueText={row.extra ? `${format(row.value)} · ${row.extra}` : format(row.value)} />
    </li>)}
  </ul>;
}
