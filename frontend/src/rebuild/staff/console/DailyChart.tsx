import { useId, useMemo, useState } from 'react';
import { SegmentedControl, TrendChart } from '../../design/controls';
import type { TimelineDay } from './staffConsoleApi';
import { Metrics, useChartLabels, useDay, useFormats } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * A daily count over time (new accounts on Users, emails on Emails), drawn by
 * the design system's TrendChart (W2T.3): columns per day in the first series
 * hue with the average as a reference rule, or the running total as a line.
 * The chart never carries a reading alone: the summary metrics say the total,
 * the daily average, the peak and the change, the figure's summary names the
 * peak day, the axis the first and last day, and the readout names the day under the pointer or
 * the keyboard (the latest day by default), with Show as table.
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
  const day = useDay(locale);
  const labels = useChartLabels();
  const name = useId();
  const [metric, setMetric] = useState<Metric>('daily');
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const slice = useMemo(() => chartSlice(points, period, metric), [points, period, metric]);
  const count = slice.visible.length;
  const ends = count ? { from: format.calendar(slice.visible[0]!.date), to: format.calendar(slice.visible[count - 1]!.date) } : null;
  const range = ends ? fill(copy.chart.body.range, ends) : '';
  const peakDay = slice.visible.find((point) => point.count === slice.peak);
  const summary = !ends ? '' : metric === 'daily'
    ? fill(copy.chart.body.summaryDaily, { n: format.number(slice.peak), date: peakDay ? format.calendar(peakDay.date) : '' })
    : fill(copy.chart.body.summaryCumulative, { n: format.number(slice.total) });
  const signed = (value: number) => `${value > 0 ? '+' : ''}${format.number(value)}`;

  return <div className="lf-staff-chart">
    <div className="lf-staff-chart-controls">
      <SegmentedControl legend={copy.chart.body.metric} name={`${name}-metric`} value={metric} onValueChange={setMetric}
        options={[{ value: 'daily', label: copy.chart.option.daily }, { value: 'cumulative', label: copy.chart.option.cumulative }]} />
      <SegmentedControl legend={copy.chart.body.period} name={`${name}-period`} value={period} onValueChange={setPeriod}
        options={PERIODS.map((entry) => ({ value: entry.id, label: copy.chart.option[entry.id] }))} />
    </div>
    <Metrics label={range || seriesLabel} items={[
      { id: 'total', label: seriesLabel, value: format.number(slice.total) },
      { id: 'average', label: copy.chart.body.average, value: format.number(slice.average) },
      { id: 'peak', label: copy.chart.body.peak, value: format.number(slice.peak) },
      { id: 'change', label: copy.chart.body.change, value: signed(slice.change) },
    ]} />
    {count === 0 ? <p data-copy-role="body" className="lf-staff-muted">{copy.chart.body.empty}</p>
      // Keyed by period and metric so the readout returns to the latest day when the slice changes.
      : <TrendChart key={`${period}:${metric}`} label={metric === 'daily' ? seriesLabel : `${seriesLabel}, ${copy.chart.option.cumulative}`} summary={summary}
        kind={metric === 'daily' ? 'columns' : 'line'} format={format.number} labels={labels}
        points={slice.visible.map((point) => ({ key: point.date, label: day(point.date) }))}
        series={[{ id: 'count', label: seriesLabel, values: slice.values }]}
        reference={metric === 'daily' ? { label: copy.chart.body.averageLine, value: slice.average } : undefined} />}
  </div>;
}
