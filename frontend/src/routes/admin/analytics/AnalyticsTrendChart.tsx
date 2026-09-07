import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Point {
  date: string;
  visitors: number;
  pageviews: number;
}

interface ChartPoint extends Point {
  value: number;
  /** Trailing 7-day mean; null until a full window exists. */
  trend?: number | null;
}

type Metric = 'visitors' | 'pageviews';

/*
 * There is exactly ONE period authority on this page: the picker at the top.
 *
 * This chart used to carry its own 7d/30d/90d/all presets AND a drag Brush,
 * so the same screen offered three ways to choose a window that disagreed
 * with each other — the header could say "last 30 days" while the chart drew
 * seven, and nothing on screen explained which number the cards belonged to.
 * Both were removed rather than synchronised: a second control that can only
 * ever contradict the first is not a feature.
 *
 * The freed affordance went to something the reader actually needs.
 */

/** Trailing simple moving average — the standard smoother for daily counts. */
const SMOOTHING_WINDOW = 7;

/**
 * Daily traffic counts are dominated by weekday/weekend seasonality, so the
 * raw line answers "was Tuesday busy?" when the question is almost always
 * "is this going up?". A trailing 7-day mean removes exactly one weekly cycle,
 * which is why the window is 7 and not a rounder number.
 *
 * It is `null` until a full window exists: extending a mean over 3 points and
 * drawing it identically to a real one would invent a trend at the very edge
 * of the chart, where readers look hardest.
 */
function withMovingAverage(points: ChartPoint[]): ChartPoint[] {
  return points.map((point, index) => {
    if (index < SMOOTHING_WINDOW - 1) return { ...point, trend: null };
    let sum = 0;
    for (let i = index - SMOOTHING_WINDOW + 1; i <= index; i += 1) sum += points[i]?.value ?? 0;
    return { ...point, trend: sum / SMOOTHING_WINDOW };
  });
}

function toDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function AnalyticsTrendChart({ data }: { data: Point[] }) {
  const { t, i18n } = useTranslation();
  const [metric, setMetric] = useState<Metric>('visitors');

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric', year: 'numeric' }),
    [i18n.resolvedLanguage],
  );
  const axisDateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric' }),
    [i18n.resolvedLanguage],
  );
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const fullPoints = useMemo<ChartPoint[]>(
    () => data.map((point) => ({ ...point, value: point[metric] })),
    [data, metric],
  );
  // The window is whatever the page-level picker fetched — the whole series.
  const visibleData = useMemo(() => withMovingAverage(fullPoints), [fullPoints]);
  const showTrend = visibleData.length >= SMOOTHING_WINDOW;
  const summary = useMemo(() => {
    const values = visibleData.map((point) => point.value);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(...values, 0);
    const average = values.length ? total / values.length : 0;
    const first = values[0] ?? 0;
    const latest = values[values.length - 1] ?? 0;
    return { total, peak, average, change: latest - first, max: Math.max(peak, 1) };
  }, [visibleData]);
  const rangeStart = fullPoints[0];
  const rangeEnd = fullPoints[fullPoints.length - 1];
  const latestPoint = visibleData[visibleData.length - 1];
  const rangeLabel = rangeStart && rangeEnd
    ? t('admin.analytics.web.chartRange', {
        start: dateFormat.format(toDate(rangeStart.date)),
        end: dateFormat.format(toDate(rangeEnd.date)),
      })
    : '';
  const changeTone = summary.change >= 0 ? 'text-success' : 'text-error';

  const tooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length || !label) return null;
    const point = payload.find((item) => item.dataKey === 'value')?.payload as ChartPoint | undefined;
    if (!point) return null;
    return (
      <div className="lf-glass rounded-md border border-outline/50 bg-surface p-3 shadow-pop">
        <p className="lf-caption text-content-muted">{dateFormat.format(toDate(label))}</p>
        <p className="lf-number mt-1 text-content">{numberFormat.format(point.value)}</p>
        <p className="lf-caption text-content-muted">{t(`admin.analytics.web.${metric}`)}</p>
        <p className="lf-caption mt-2 text-content-faint">
          {numberFormat.format(point.visitors)} {t('admin.analytics.web.visitors').toLowerCase()} · {numberFormat.format(point.pageviews)} {t('admin.analytics.web.pageviews').toLowerCase()}
        </p>
      </div>
    );
  };

  if (data.length === 0) {
    return <p className="lf-caption text-content-faint">{t('admin.analytics.web.trendEmpty')}</p>;
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5" aria-label={t('admin.analytics.web.trendAria')}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="lf-label font-bold text-content-muted">{t('admin.analytics.web.trend')}</p>
          <p className="lf-caption mt-1 text-content-faint">{t('admin.analytics.web.chartSubtitle')}</p>
        </div>
        <div className="flex items-center gap-1 self-start rounded-md border border-outline/40 bg-surface-sunken p-1" role="group" aria-label={t('admin.analytics.web.metricAria')}>
          {(['visitors', 'pageviews'] as Metric[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className={cn(
                'min-h-10 rounded-full px-3 text-sm font-semibold transition-colors',
                metric === item ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content',
              )}
            >
              {t(`admin.analytics.web.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-outline/40 bg-surface-sunken/50 p-2.5">
        <div className="flex items-center gap-2">
          <Icon name="date_range" className="!text-[18px] text-primary" />
          <span className="lf-caption whitespace-nowrap text-content-muted">{rangeLabel}</span>
        </div>
        {showTrend && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded-full bg-accent" />
            <span className="lf-caption whitespace-nowrap text-content-muted">
              {t('admin.analytics.web.trendLegend', { days: SMOOTHING_WINDOW })}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('admin.analytics.web.chartSummaryAria')}>
        <Summary label={t(`admin.analytics.web.${metric}InRange`)} value={numberFormat.format(summary.total)} />
        <Summary label={t('admin.analytics.web.dailyAverage')} value={numberFormat.format(summary.average)} />
        <Summary label={t('admin.analytics.web.peakDay')} value={numberFormat.format(summary.peak)} />
        <Summary
          label={t('admin.analytics.web.chartChange')}
          value={`${summary.change >= 0 ? '+' : ''}${numberFormat.format(summary.change)}`}
          valueClassName={changeTone}
        />
      </div>

      <div className="rounded-md border border-outline/40 bg-surface-sunken/30 p-2 sm:p-3">
        <div className="h-80 w-full sm:h-96">
          <ResponsiveContainer>
            <ComposedChart data={visibleData} margin={{ top: 16, right: 8, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--lf-outline))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={36} tick={{ className: 'fill-content-faint', fontSize: 11 }} tickFormatter={(date: string) => axisDateFormat.format(toDate(date))} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} orientation="right" width={46} domain={[0, summary.max]} tick={{ className: 'fill-content-faint', fontSize: 11 }} />
              <Tooltip content={tooltip} cursor={{ stroke: 'rgb(var(--lf-primary))', strokeWidth: 1 }} />
              <Bar dataKey="value" fill="rgb(var(--lf-primary))" fillOpacity={0.14} barSize={4} isAnimationActive={false} />
              <Area type="monotone" dataKey="value" name={t(`admin.analytics.web.${metric}`)} stroke="rgb(var(--lf-primary))" strokeWidth={2.5} fill="url(#analyticsTrendFill)" dot={false} isAnimationActive={false} />
              <ReferenceLine y={summary.average} stroke="rgb(var(--lf-content-muted))" strokeDasharray="2 5" strokeOpacity={0.7}>
                <Label value={t('admin.analytics.web.average')} position="insideTopLeft" fill="rgb(var(--lf-content-muted))" fontSize={11} />
              </ReferenceLine>
              {showTrend && (
                /*
                 * Drawn after the raw series so it reads as an overlay, not a
                 * competing measurement. connectNulls stays FALSE: the first
                 * six days have no full window, and bridging that gap would
                 * draw a mean where none was computed.
                 */
                <Line
                  type="monotone"
                  dataKey="trend"
                  name={t('admin.analytics.web.trendLegend', { days: SMOOTHING_WINDOW })}
                  stroke="rgb(var(--lf-accent))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              {latestPoint && (
                <ReferenceDot x={latestPoint.date} y={latestPoint.value} r={4} fill="rgb(var(--lf-accent))" stroke="rgb(var(--lf-surface))" strokeWidth={2} label={{ value: numberFormat.format(latestPoint.value), position: 'right', fill: 'rgb(var(--lf-content))', fontSize: 12, fontWeight: 700 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Summary({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-md border border-outline/30 bg-surface-sunken/40 p-3">
      <p className="lf-caption text-content-muted">{label}</p>
      <p className={cn('lf-number mt-1 text-content', valueClassName)}>{value}</p>
    </div>
  );
}
