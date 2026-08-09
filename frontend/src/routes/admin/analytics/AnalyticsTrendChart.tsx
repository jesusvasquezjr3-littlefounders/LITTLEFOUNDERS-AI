import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Label,
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
}

interface Range {
  startIndex: number;
  endIndex: number;
}

type Metric = 'visitors' | 'pageviews';

const RANGE_PRESETS = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: 'all', days: null },
] as const;

function validRange(range: Range, length: number): Range {
  const last = Math.max(length - 1, 0);
  const startIndex = Math.min(Math.max(range.startIndex, 0), last);
  const endIndex = Math.min(Math.max(range.endIndex, startIndex), last);
  return { startIndex, endIndex };
}

function toDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function AnalyticsTrendChart({ data }: { data: Point[] }) {
  const { t, i18n } = useTranslation();
  const [metric, setMetric] = useState<Metric>('visitors');
  const [range, setRange] = useState<Range>({ startIndex: 0, endIndex: Math.max(data.length - 1, 0) });

  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(data.length - 1, 0) });
  }, [data.length]);

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
  const selectedRange = validRange(range, fullPoints.length);
  const visibleData = useMemo(
    () => fullPoints.slice(selectedRange.startIndex, selectedRange.endIndex + 1),
    [fullPoints, selectedRange.endIndex, selectedRange.startIndex],
  );
  const summary = useMemo(() => {
    const values = visibleData.map((point) => point.value);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(...values, 0);
    const average = values.length ? total / values.length : 0;
    const first = values[0] ?? 0;
    const latest = values[values.length - 1] ?? 0;
    return { total, peak, average, change: latest - first, max: Math.max(peak, 1) };
  }, [visibleData]);
  const rangeStart = fullPoints[selectedRange.startIndex];
  const rangeEnd = fullPoints[selectedRange.endIndex];
  const latestPoint = visibleData[visibleData.length - 1];
  const selectedPreset =
    selectedRange.startIndex === 0 && selectedRange.endIndex === fullPoints.length - 1
      ? 'all'
      : RANGE_PRESETS.find(
          (preset) => preset.days !== null && selectedRange.startIndex === Math.max(fullPoints.length - preset.days, 0),
        )?.key ?? 'all';

  const rangeLabel = rangeStart && rangeEnd
    ? t('admin.analytics.web.chartRange', {
        start: dateFormat.format(toDate(rangeStart.date)),
        end: dateFormat.format(toDate(rangeEnd.date)),
      })
    : '';
  const changeTone = summary.change >= 0 ? 'text-success' : 'text-error';

  const selectPreset = (days: number | null) => {
    setRange({
      startIndex: days === null ? 0 : Math.max(fullPoints.length - days, 0),
      endIndex: Math.max(fullPoints.length - 1, 0),
    });
  };

  const tooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length || !label) return null;
    const point = payload.find((item) => item.dataKey === 'value')?.payload as ChartPoint | undefined;
    if (!point) return null;
    return (
      <div className="lf-glass rounded-lg border border-outline/50 bg-surface p-3 shadow-pop">
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
        <div className="flex items-center gap-1 self-start rounded-xl border border-outline/40 bg-surface-sunken p-1" role="group" aria-label={t('admin.analytics.web.metricAria')}>
          {(['visitors', 'pageviews'] as Metric[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors',
                metric === item ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content',
              )}
            >
              {t(`admin.analytics.web.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-outline/40 bg-surface-sunken/50 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
        <div className="flex min-w-max items-center gap-1 overflow-x-auto" role="group" aria-label={t('admin.analytics.web.rangeAria')}>
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              aria-pressed={selectedPreset === preset.key}
              onClick={() => selectPreset(preset.days)}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors',
                selectedPreset === preset.key ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content',
              )}
            >
              {t(`admin.analytics.web.range${preset.key}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-2 sm:justify-end">
          <Icon name="show_chart" className="!text-[18px] text-primary" />
          <span className="lf-caption whitespace-nowrap text-content-muted">{rangeLabel}</span>
        </div>
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

      <div className="rounded-xl border border-outline/40 bg-surface-sunken/30 p-2 sm:p-3">
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
              {latestPoint && (
                <ReferenceDot x={latestPoint.date} y={latestPoint.value} r={4} fill="rgb(var(--lf-accent))" stroke="rgb(var(--lf-surface))" strokeWidth={2} label={{ value: numberFormat.format(latestPoint.value), position: 'right', fill: 'rgb(var(--lf-content))', fontSize: 12, fontWeight: 700 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {fullPoints.length > 1 && (
          <div className="mt-2 h-24 w-full border-t border-outline/30 pt-2" aria-label={t('admin.analytics.web.chartOverviewAria')}>
            <ResponsiveContainer>
              <ComposedChart data={fullPoints} margin={{ top: 3, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsTrendOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="rgb(var(--lf-primary))" strokeWidth={1.5} fill="url(#analyticsTrendOverview)" dot={false} isAnimationActive={false} />
                <Brush dataKey="date" height={28} startIndex={selectedRange.startIndex} endIndex={selectedRange.endIndex} travellerWidth={12} stroke="rgb(var(--lf-primary))" fill="rgb(var(--lf-surface-sunken))" tickFormatter={() => ''} onChange={({ startIndex, endIndex }) => setRange({ startIndex: startIndex ?? 0, endIndex: endIndex ?? Math.max(fullPoints.length - 1, 0) })} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p className="lf-caption text-content-faint">{t('admin.analytics.web.chartZoomHint')}</p>
    </Card>
  );
}

function Summary({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-xl border border-outline/30 bg-surface-sunken/40 p-3">
      <p className="lf-caption text-content-muted">{label}</p>
      <p className={cn('lf-number mt-1 text-content', valueClassName)}>{value}</p>
    </div>
  );
}
