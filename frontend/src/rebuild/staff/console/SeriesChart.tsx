import { useState, type PointerEvent } from 'react';
import { ProgressBar } from '../../design/controls';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * A value over ordered points (a run's lessons, runs over time, heartbeat
 * snapshots) for the Generation page (W2T.2): one series, one hue, thin bars
 * on a recessive baseline, like DailyChart. The reading never lives in the
 * bars alone: the first and last labels are written under them and the
 * readout names the point under the pointer, or the latest one. `compact`
 * draws a small multiple (one stage over time) with its label and latest
 * value only. Staff surface: no motion.
 */

export interface SeriesPoint { id: string; label: string; value: number }

const WIDTH = 600;

export function SeriesChart({ label, points, format, compact = false }: {
  label: string; points: readonly SeriesPoint[]; format: (value: number) => string; compact?: boolean;
}) {
  const { copy } = useConsoleCopy();
  const t = copy.generation.body;
  const [hover, setHover] = useState<number | null>(null);
  const height = compact ? 60 : 200;
  const count = points.length;
  const max = Math.max(1e-9, ...points.map((point) => point.value));
  const shown = hover !== null && hover < count ? hover : count - 1;
  const barWidth = count ? WIDTH / count : WIDTH;
  const gap = barWidth > 4 ? Math.min(2, barWidth / 4) : 0;
  const track = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !count) return;
    setHover(Math.min(count - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * count))));
  };
  if (count === 0) return null;
  const range = fill(t.range, { from: points[0]!.label, to: points[count - 1]!.label });
  return <figure className="lf-staff-plot" data-compact={compact ? 'true' : undefined}>
    {compact ? <figcaption className="lf-staff-plot-caption">
      <span data-copy-role="body">{label}</span>
      <span data-copy-role="data">{format(points[count - 1]!.value)}</span>
    </figcaption> : null}
    <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" className="lf-staff-plot-svg" role="img" aria-label={`${label}, ${range}`}
      onPointerMove={compact ? undefined : track} onPointerLeave={compact ? undefined : () => setHover(null)}>
      <line className="lf-staff-plot-base" x1="0" x2={WIDTH} y1={height - 0.5} y2={height - 0.5} />
      {points.map((point, index) => {
        const barHeight = (point.value / max) * (height - 2);
        return <rect key={point.id} className="lf-staff-plot-bar" data-active={!compact && index === shown ? 'true' : undefined}
          x={index * barWidth + gap / 2} y={height - 1 - barHeight} width={Math.max(barWidth - gap, 0.5)} height={Math.max(barHeight, 0)} />;
      })}
    </svg>
    {compact ? null : <>
      <figcaption className="lf-staff-plot-caption">
        <span data-copy-role="data">{points[0]!.label}</span>
        <span data-copy-role="data">{points[count - 1]!.label}</span>
      </figcaption>
      <p data-copy-role="data" className="lf-staff-plot-readout" data-readout={points[shown]!.id}>{`${points[shown]!.label}: ${format(points[shown]!.value)}`}</p>
    </>}
  </figure>;
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
