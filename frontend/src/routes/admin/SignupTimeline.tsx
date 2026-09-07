import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  Bar,
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
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, SectionHeading } from '@/components/ui';

interface Day {
  date: string;
  count: number;
}

interface ChartPoint extends Day {
  cumulative: number;
  value: number;
  volume: number;
}

interface Range {
  startIndex: number;
  endIndex: number;
}

type ChartMetric = 'daily' | 'cumulative';
type RangePreset = '7d' | '30d' | '90d' | '1y' | 'all';

const RANGE_PRESETS: Array<{ key: RangePreset; days: number | null }> = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '1y', days: 365 },
  { key: 'all', days: null },
];

function validRange(range: Range, length: number): Range {
  const last = Math.max(length - 1, 0);
  const startIndex = Math.min(Math.max(range.startIndex, 0), last);
  const endIndex = Math.min(Math.max(range.endIndex, startIndex), last);
  return { startIndex, endIndex };
}

function toDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function SignupTimeline() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [data, setData] = useState<Day[]>([]);
  const [range, setRange] = useState<Range>({ startIndex: 0, endIndex: 0 });
  const [metric, setMetric] = useState<ChartMetric>('daily');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      const token = await getToken();
      const result = await api<{ timeline: Day[] }>('/admin/users/timeline?days=365', { token });
      if (cancelled) return;
      if (result.error) {
        setData([]);
        setFailed(true);
      } else {
        setData(result.data.timeline);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [getToken]);

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
  const fullPoints = useMemo<ChartPoint[]>(() => {
    let cumulative = 0;
    return data.map((point) => {
      cumulative += point.count;
      return { ...point, cumulative, value: metric === 'daily' ? point.count : cumulative, volume: point.count };
    });
  }, [data, metric]);
  const selectedRange = validRange(range, fullPoints.length);
  const visibleData = useMemo(
    () => fullPoints.slice(selectedRange.startIndex, selectedRange.endIndex + 1),
    [fullPoints, selectedRange.endIndex, selectedRange.startIndex],
  );
  const summary = useMemo(() => {
    const signups = visibleData.reduce((total, point) => total + point.count, 0);
    const peak = visibleData.reduce((highest, point) => Math.max(highest, point.count), 0);
    return { signups, peak, average: visibleData.length ? signups / visibleData.length : 0 };
  }, [visibleData]);
  const chartSummary = useMemo(() => {
    const values = visibleData.map((point) => point.value);
    const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    return {
      average,
      max: Math.max(...values, 1),
      maxVolume: Math.max(...visibleData.map((point) => point.volume), 1),
    };
  }, [visibleData]);
  const rangeStart = data[selectedRange.startIndex];
  const rangeEnd = data[selectedRange.endIndex];
  const rangeLabel = rangeStart && rangeEnd
    ? t('admin.users.timelineRange', {
      start: dateFormat.format(toDate(rangeStart.date)),
      end: dateFormat.format(toDate(rangeEnd.date)),
    })
    : '';
  const latestPoint = visibleData[visibleData.length - 1];
  const firstPoint = visibleData[0];
  const change = latestPoint && firstPoint ? latestPoint.count - firstPoint.count : 0;
  const changeTone = change >= 0 ? 'text-success' : 'text-error';
  const averageStop = `${Math.max(0, Math.min(100, (1 - chartSummary.average / chartSummary.max) * 100))}%`;
  const selectedPreset: RangePreset = selectedRange.startIndex === 0 && selectedRange.endIndex === fullPoints.length - 1
    ? 'all'
    : RANGE_PRESETS.find((preset) => preset.days !== null && selectedRange.startIndex === Math.max(fullPoints.length - preset.days, 0))?.key ?? 'all';

  function selectPreset(preset: RangePreset) {
    const days = RANGE_PRESETS.find((item) => item.key === preset)?.days;
    setRange({
      startIndex: days === null || days === undefined ? 0 : Math.max(fullPoints.length - days, 0),
      endIndex: Math.max(fullPoints.length - 1, 0),
    });
  }

  if (loading) {
    return (
      <Card className="flex h-64 items-center justify-center p-4">
        <p className="lf-caption text-content-faint">{t('admin.loading')}</p>
      </Card>
    );
  }

  if (failed || data.length === 0) {
    return (
      <Card className="flex min-h-64 items-center justify-center p-4 text-center">
        <p className="lf-caption text-content-muted">{t('admin.users.timelineEmpty')}</p>
      </Card>
    );
  }

  const tooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length || !label) return null;
    const point = payload.find((item) => item.dataKey === 'value')?.payload as ChartPoint | undefined;
    if (!point) return null;
    return (
      <div className="lf-glass rounded-md border border-outline/50 bg-surface p-3 shadow-pop">
        <p className="lf-caption text-content-muted">{dateFormat.format(toDate(label))}</p>
        <p className="lf-number mt-1 text-content">{numberFormat.format(point.value)}</p>
        <p className="lf-caption text-content-muted">{t(metric === 'daily' ? 'admin.users.timelineSignups' : 'admin.users.timelineCumulative')}</p>
        <p className="lf-caption mt-2 text-content-faint">
          {numberFormat.format(point.count)} {t('admin.users.timelineVolume').toLowerCase()}
        </p>
      </div>
    );
  };

  return (
    <Card className="flex flex-col gap-4 overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionHeading icon="show_chart" tone="accent" as="h3" className="mb-1">{t('admin.users.timelineTitle')}</SectionHeading>
          <p className="lf-caption text-content-muted">{t('admin.users.timelineSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-md border border-outline/40 bg-surface-sunken p-1" role="group" aria-label={t('admin.users.timelineMetricAria')}>
          {(['daily', 'cumulative'] as ChartMetric[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold transition-colors ${metric === item ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content'}`}
            >
              {t(`admin.users.timelineMetric${item === 'daily' ? 'Daily' : 'Cumulative'}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-md border border-outline/40 bg-surface-sunken/50 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
        <div className="flex min-w-max items-center gap-1 overflow-x-auto" role="group" aria-label={t('admin.users.timelineRangeAria')}>
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              aria-pressed={selectedPreset === preset.key}
              onClick={() => selectPreset(preset.key)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold transition-colors ${selectedPreset === preset.key ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content'}`}
            >
              {t(`admin.users.timelineRange${preset.key}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-2 sm:justify-end">
          <Icon name="show_chart" className="!text-[18px] text-primary" />
          <span className="lf-caption whitespace-nowrap text-content-muted">{rangeLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('admin.users.timelineSummaryAria')}>
        <div className="rounded-md border border-outline/30 bg-surface-sunken/40 p-3">
          <p className="lf-caption text-content-muted">{t('admin.users.timelineSignups')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.signups)}</p>
        </div>
        <div className="rounded-md border border-outline/30 bg-surface-sunken/40 p-3">
          <p className="lf-caption text-content-muted">{t('admin.users.timelineDailyAverage')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.average)}</p>
        </div>
        <div className="rounded-md border border-outline/30 bg-surface-sunken/40 p-3">
          <p className="lf-caption text-content-muted">{t('admin.users.timelinePeak')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.peak)}</p>
        </div>
        <div className="rounded-md border border-outline/30 bg-surface-sunken/40 p-3">
          <p className="lf-caption text-content-muted">{t('admin.users.timelineChange')}</p>
          <p className={`lf-number mt-1 ${changeTone}`}>{change >= 0 ? '+' : ''}{numberFormat.format(change)}</p>
        </div>
      </div>

      <div className="rounded-md border border-outline/40 bg-surface-sunken/30 p-2 sm:p-3" aria-label={t('admin.users.timelineAria')}>
        <div className="h-80 w-full sm:h-96">
          <ResponsiveContainer>
            <ComposedChart data={visibleData} margin={{ top: 16, right: 8, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="signupTimelineLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lf-success))" />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-success))" />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-error))" />
                  <stop offset="100%" stopColor="rgb(var(--lf-error))" />
                </linearGradient>
                <linearGradient id="signupTimelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lf-success))" stopOpacity={0.3} />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-success))" stopOpacity={0.14} />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-error))" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="rgb(var(--lf-error))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--lf-outline))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                minTickGap={36}
                tick={{ className: 'fill-content-faint', fontSize: 11 }}
                tickFormatter={(date: string) => axisDateFormat.format(toDate(date))}
              />
              <YAxis
                yAxisId="value"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                orientation="right"
                width={42}
                domain={[0, chartSummary.max]}
                tick={{ className: 'fill-content-faint', fontSize: 11 }}
              />
              <YAxis yAxisId="volume" hide domain={[0, chartSummary.maxVolume]} />
              <Tooltip content={tooltip} cursor={{ stroke: 'rgb(var(--lf-primary))', strokeWidth: 1 }} />
              <Bar yAxisId="volume" dataKey="volume" fill="rgb(var(--lf-primary))" fillOpacity={0.18} barSize={4} isAnimationActive={false} />
              <Area
                yAxisId="value"
                type="monotone"
                dataKey="value"
                name={t(metric === 'daily' ? 'admin.users.timelineSignups' : 'admin.users.timelineCumulative')}
                stroke="url(#signupTimelineLine)"
                strokeWidth={2.5}
                fill="url(#signupTimelineFill)"
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine
                yAxisId="value"
                y={chartSummary.average}
                stroke="rgb(var(--lf-content-muted))"
                strokeDasharray="2 5"
                strokeOpacity={0.7}
              >
                <Label value={t('admin.users.timelineAverage')} position="insideTopLeft" fill="rgb(var(--lf-content-muted))" fontSize={11} />
              </ReferenceLine>
              {latestPoint && (
                <ReferenceDot
                  yAxisId="value"
                  x={latestPoint.date}
                  y={latestPoint.value}
                  r={4}
                  fill="rgb(var(--lf-accent))"
                  stroke="rgb(var(--lf-surface))"
                  strokeWidth={2}
                  label={{ value: numberFormat.format(latestPoint.value), position: 'right', fill: 'rgb(var(--lf-content))', fontSize: 12, fontWeight: 700 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/*
          * The drag Brush that lived here was removed. It duplicated the
          * preset buttons above — two controls setting the same range, so a
          * reader could not tell which one the figures obeyed — and a drag
          * handle is a poor affordance on touch, where this console is used
          * (DESIGN §Responsive: no drag-only control without a tap-accessible
          * equivalent). The presets ARE that equivalent, so the Brush and the
          * strip of chart that existed only to host it are both gone.
          */}
      </div>
      <p className="lf-caption text-content-faint">{t('admin.users.timelineZoomHint')}</p>
    </Card>
  );
}
