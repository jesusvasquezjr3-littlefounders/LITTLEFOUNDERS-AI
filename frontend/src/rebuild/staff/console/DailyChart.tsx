import { useId, useMemo, useState, type PointerEvent } from 'react';
import { SegmentedControl } from '../../design/controls';
import type { TimelineDay } from './staffConsoleApi';
import { Metrics, useFormats } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * A daily count over time (new accounts on Users, emails on Emails): one
 * series, one axis, one hue (primary), thin bars on a recessive baseline, the
 * average as a dashed rule, and the numbers that matter written as text above
 * it. The chart never carries a reading alone: the summary metrics say the
 * total, the daily average, the peak and the change, and the readout under the
 * bars names the day a pointer is over (the latest day by default).
 *
 * The period presets are the only range control (the legacy drag brush was a
 * second, touch-hostile control for the same range). Cumulative shows the
 * running total over the chosen period. Staff surface: no motion.
 */

type Metric = 'daily' | 'cumulative';
type Period = '7d' | '30d' | '90d' | '1y' | 'all';
const PERIODS: readonly { id: Period; days: number | null }[] = [
  { id: '7d', days: 7 }, { id: '30d', days: 30 }, { id: '90d', days: 90 }, { id: '1y', days: 365 }, { id: 'all', days: null },
];

const WIDTH = 600;
const HEIGHT = 200;

/** The visible slice and its figures, for a period and metric. Pure, so the numbers are unit-tested. */
export function chartSlice(points: readonly TimelineDay[], period: Period, metric: Metric) {
  const days = PERIODS.find((entry) => entry.id === period)?.days ?? null;
  const visible = days === null ? points.slice() : points.slice(Math.max(points.length - days, 0));
  let running = 0;
  const values = visible.map((point) => (metric === 'daily' ? point.count : (running += point.count)));
  const total = visible.reduce((sum, point) => sum + point.count, 0);
  const peak = visible.reduce((max, point) => Math.max(max, point.count), 0);
  const first = visible[0]?.count ?? 0;
  const last = visible[visible.length - 1]?.count ?? 0;
  return {
    visible, values, total, peak,
    average: visible.length ? total / visible.length : 0,
    change: last - first,
    max: Math.max(1, ...values),
  };
}

export function DailyChart({ points, seriesLabel, defaultPeriod = '90d' }: { points: readonly TimelineDay[]; seriesLabel: string; defaultPeriod?: Period }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const name = useId();
  const [metric, setMetric] = useState<Metric>('daily');
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [hover, setHover] = useState<number | null>(null);
  const slice = useMemo(() => chartSlice(points, period, metric), [points, period, metric]);
  const count = slice.visible.length;
  const shown = hover !== null && hover < count ? hover : count - 1;
  const range = count ? fill(copy.chart.body.range, { from: format.calendar(slice.visible[0]!.date), to: format.calendar(slice.visible[count - 1]!.date) }) : '';
  const barWidth = count ? WIDTH / count : WIDTH;
  const gap = barWidth > 4 ? Math.min(2, barWidth / 4) : 0;
  const averageValue = metric === 'daily' ? slice.average : slice.values.reduce((sum, value) => sum + value, 0) / Math.max(count, 1);
  const averageY = HEIGHT - (averageValue / slice.max) * HEIGHT;
  const track = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !count) return;
    setHover(Math.min(count - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * count))));
  };
  const signed = (value: number) => `${value > 0 ? '+' : ''}${format.number(value)}`;

  return <div className="lf-staff-chart">
    <div className="lf-staff-chart-controls">
      <SegmentedControl legend={copy.chart.body.metric} name={`${name}-metric`} value={metric} onValueChange={setMetric}
        options={[{ value: 'daily', label: copy.chart.option.daily }, { value: 'cumulative', label: copy.chart.option.cumulative }]} />
      <SegmentedControl legend={copy.chart.body.period} name={`${name}-period`} value={period} onValueChange={(value) => { setPeriod(value); setHover(null); }}
        options={PERIODS.map((entry) => ({ value: entry.id, label: copy.chart.option[entry.id] }))} />
    </div>
    <Metrics label={range || seriesLabel} items={[
      { id: 'total', label: seriesLabel, value: format.number(slice.total) },
      { id: 'average', label: copy.chart.body.average, value: format.number(slice.average) },
      { id: 'peak', label: copy.chart.body.peak, value: format.number(slice.peak) },
      { id: 'change', label: copy.chart.body.change, value: signed(slice.change) },
    ]} />
    {count === 0 ? <p data-copy-role="body" className="lf-staff-muted">{copy.chart.body.empty}</p> : <figure className="lf-staff-plot">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="lf-staff-plot-svg" role="img"
        aria-label={`${metric === 'daily' ? seriesLabel : copy.chart.option.cumulative}, ${range}`}
        onPointerMove={track} onPointerLeave={() => setHover(null)}>
        <line className="lf-staff-plot-base" x1="0" x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} />
        {slice.values.map((value, index) => {
          const height = (value / slice.max) * (HEIGHT - 2);
          return <rect key={slice.visible[index]!.date} className="lf-staff-plot-bar" data-active={index === shown ? 'true' : undefined}
            x={index * barWidth + gap / 2} y={HEIGHT - 1 - height} width={Math.max(barWidth - gap, 0.5)} height={Math.max(height, 0)} />;
        })}
        <line className="lf-staff-plot-average" x1="0" x2={WIDTH} y1={averageY} y2={averageY} />
      </svg>
      <figcaption className="lf-staff-plot-caption">
        <span data-copy-role="data">{format.calendar(slice.visible[0]!.date)}</span>
        <span data-copy-role="body">{copy.chart.body.averageLine}: {format.number(averageValue)}</span>
        <span data-copy-role="data">{format.calendar(slice.visible[count - 1]!.date)}</span>
      </figcaption>
      <p data-copy-role="data" className="lf-staff-plot-readout" data-readout={slice.visible[shown]!.date}>
        {fill(copy.chart.body.point, { date: format.calendar(slice.visible[shown]!.date), n: format.number(slice.values[shown]!) })}
      </p>
    </figure>}
  </div>;
}
