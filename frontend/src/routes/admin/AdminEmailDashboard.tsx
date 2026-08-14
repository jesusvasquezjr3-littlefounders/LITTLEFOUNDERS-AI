import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Badge, Card, Dropdown, Icon, ProgressBar, StatCard, type DropdownOption } from '@/components/ui';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage } from './adminShared';
import { cn } from '@/lib/utils';

interface EmailEntry {
  id: string;
  messageId?: string;
  to: string;
  subject: string;
  status: string;
  templateType: string;
  locale?: string;
  userId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

interface EmailTrendPoint {
  date: string;
  count: number;
}

interface EmailChartPoint extends EmailTrendPoint {
  cumulative: number;
  value: number;
  volume: number;
}

interface EmailChartRange {
  startIndex: number;
  endIndex: number;
}

interface EmailSummary {
  total: number;
  statuses: Record<string, number>;
  templates: Record<string, number>;
  locales?: Record<string, number>;
  trend?: EmailTrendPoint[];
}

interface LogsResponse {
  entries: EmailEntry[];
  total: number;
}

const EMAIL_PAGE_SIZE = 25;
const EMAIL_TREND_DAYS = 365;
const STATUS_KEYS = ['queued', 'relayed', 'delivered', 'failed'] as const;
const EMAIL_RANGE_PRESETS: Array<{ key: '7d' | '30d' | '90d' | '1y' | 'all'; days: number | null }> = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '1y', days: 365 },
  { key: 'all', days: null },
];

const STATUS_TONES: Record<string, string> = {
  queued: 'bg-warning-soft text-warning-strong',
  relayed: 'bg-success-soft text-success-strong',
  delivered: 'bg-success-soft text-success-strong',
  failed: 'bg-error-soft text-error-strong',
};

function formatDate(value: string, locale: string, fallback: string, dateStyle: 'medium' | 'short' = 'medium'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle: dateStyle === 'short' ? undefined : 'short' }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge className={STATUS_TONES[status] ?? 'bg-surface-sunken text-content-muted'}>
      {t(`admin.emails.status.${status}`, status)}
    </Badge>
  );
}

function validChartRange(range: EmailChartRange, length: number): EmailChartRange {
  const last = Math.max(length - 1, 0);
  const startIndex = Math.min(Math.max(range.startIndex, 0), last);
  const endIndex = Math.min(Math.max(range.endIndex, startIndex), last);
  return { startIndex, endIndex };
}

function toChartDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function EmailActivityChart({ points, locale }: { points: EmailTrendPoint[]; locale: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<EmailChartRange>({ startIndex: 0, endIndex: 0 });
  const [metric, setMetric] = useState<'daily' | 'cumulative'>('daily');
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }), [locale]);
  const axisDateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale]);
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const fullPoints = useMemo<EmailChartPoint[]>(() => {
    let cumulative = 0;
    return points.map((point) => {
      cumulative += point.count;
      return { ...point, cumulative, value: metric === 'daily' ? point.count : cumulative, volume: point.count };
    });
  }, [metric, points]);
  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(fullPoints.length - 1, 0) });
  }, [fullPoints.length]);

  const selectedRange = validChartRange(range, fullPoints.length);
  const visibleData = useMemo(
    () => fullPoints.slice(selectedRange.startIndex, selectedRange.endIndex + 1),
    [fullPoints, selectedRange.endIndex, selectedRange.startIndex],
  );
  const summary = useMemo(() => {
    const emails = visibleData.reduce((total, point) => total + point.count, 0);
    const peak = visibleData.reduce((highest, point) => Math.max(highest, point.count), 0);
    return { emails, peak, average: visibleData.length ? emails / visibleData.length : 0 };
  }, [visibleData]);
  const chartSummary = useMemo(() => {
    const values = visibleData.map((point) => point.value);
    return {
      average: values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0,
      max: Math.max(...values, 1),
      maxVolume: Math.max(...visibleData.map((point) => point.volume), 1),
    };
  }, [visibleData]);
  const rangeStart = fullPoints[selectedRange.startIndex];
  const rangeEnd = fullPoints[selectedRange.endIndex];
  const rangeLabel = rangeStart && rangeEnd
    ? t('admin.emails.chartRange', { start: dateFormat.format(toChartDate(rangeStart.date)), end: dateFormat.format(toChartDate(rangeEnd.date)) })
    : '';
  const latestPoint = visibleData[visibleData.length - 1];
  const firstPoint = visibleData[0];
  const change = latestPoint && firstPoint ? latestPoint.count - firstPoint.count : 0;
  const selectedPreset = selectedRange.startIndex === 0 && selectedRange.endIndex === fullPoints.length - 1
    ? 'all'
    : EMAIL_RANGE_PRESETS.find((preset) => preset.days !== null && selectedRange.startIndex === Math.max(fullPoints.length - preset.days, 0))?.key ?? 'all';
  const averageStop = `${Math.max(0, Math.min(100, (1 - chartSummary.average / chartSummary.max) * 100))}%`;

  function selectPreset(preset: (typeof EMAIL_RANGE_PRESETS)[number]['key']) {
    const days = EMAIL_RANGE_PRESETS.find((item) => item.key === preset)?.days;
    setRange({
      startIndex: days === null || days === undefined ? 0 : Math.max(fullPoints.length - days, 0),
      endIndex: Math.max(fullPoints.length - 1, 0),
    });
  }

  const tooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length || !label) return null;
    const point = payload.find((item) => item.dataKey === 'value')?.payload as EmailChartPoint | undefined;
    if (!point) return null;
    return (
      <div className="lf-glass rounded-lg border border-outline/50 bg-surface p-3 shadow-pop">
        <p className="lf-caption text-content-muted">{dateFormat.format(toChartDate(label))}</p>
        <p className="lf-number mt-1 text-content">{numberFormat.format(point.value)}</p>
        <p className="lf-caption text-content-muted">{t(metric === 'daily' ? 'admin.emails.dailyVolume' : 'admin.emails.cumulativeVolume')}</p>
        <p className="lf-caption mt-2 text-content-faint">{numberFormat.format(point.count)} {t('admin.emails.dailyVolume').toLowerCase()}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4" role="img" aria-label={t('admin.emails.trendAria')}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-2 rounded-xl border border-outline/40 bg-surface-sunken p-1" role="group" aria-label={t('admin.emails.chartMetricAria')}>
          {(['daily', 'cumulative'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${metric === item ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content'}`}
            >
              {t(item === 'daily' ? 'admin.emails.metricDaily' : 'admin.emails.metricCumulative')}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1 xl:items-end">
          <span className="lf-caption text-content-muted">{rangeLabel}</span>
          <span className="lf-caption text-content-faint">{t('admin.emails.chartDataSource')}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-outline/40 bg-surface-sunken/50 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
        <div className="flex min-w-max items-center gap-1 overflow-x-auto" role="group" aria-label={t('admin.emails.chartRangeAria')}>
          {EMAIL_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              aria-pressed={selectedPreset === preset.key}
              onClick={() => selectPreset(preset.key)}
              className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${selectedPreset === preset.key ? 'bg-content text-surface shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content'}`}
            >
              {t(`admin.emails.range${preset.key}`)}
            </button>
          ))}
        </div>
        <span className="lf-caption whitespace-nowrap px-2 text-content-faint">{t('admin.emails.chartZoom')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('admin.emails.chartSummaryAria')}>
        <div className="rounded-xl border border-outline/30 bg-surface-sunken/40 p-3"><p className="lf-caption text-content-muted">{t('admin.emails.chartEmails')}</p><p className="lf-number mt-1 text-content">{numberFormat.format(summary.emails)}</p></div>
        <div className="rounded-xl border border-outline/30 bg-surface-sunken/40 p-3"><p className="lf-caption text-content-muted">{t('admin.emails.chartDailyAverage')}</p><p className="lf-number mt-1 text-content">{numberFormat.format(summary.average)}</p></div>
        <div className="rounded-xl border border-outline/30 bg-surface-sunken/40 p-3"><p className="lf-caption text-content-muted">{t('admin.emails.chartPeak')}</p><p className="lf-number mt-1 text-content">{numberFormat.format(summary.peak)}</p></div>
        <div className="rounded-xl border border-outline/30 bg-surface-sunken/40 p-3"><p className="lf-caption text-content-muted">{t('admin.emails.chartChange')}</p><p className={`lf-number mt-1 ${change >= 0 ? 'text-success' : 'text-error'}`}>{change >= 0 ? '+' : ''}{numberFormat.format(change)}</p></div>
      </div>

      <div className="rounded-xl border border-outline/40 bg-surface-sunken/30 p-2 sm:p-3">
        <div className="h-80 w-full sm:h-96">
          <ResponsiveContainer>
            <ComposedChart data={visibleData} margin={{ top: 16, right: 8, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="emailActivityLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lf-success))" />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-success))" />
                  <stop offset={averageStop} stopColor="rgb(var(--lf-error))" />
                  <stop offset="100%" stopColor="rgb(var(--lf-error))" />
                </linearGradient>
                <linearGradient id="emailActivityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--lf-outline))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={36} tick={{ className: 'fill-content-faint', fontSize: 11 }} tickFormatter={(date: string) => axisDateFormat.format(toChartDate(date))} />
              <YAxis yAxisId="value" allowDecimals={false} axisLine={false} tickLine={false} orientation="right" width={42} domain={[0, chartSummary.max]} tick={{ className: 'fill-content-faint', fontSize: 11 }} />
              <YAxis yAxisId="volume" hide domain={[0, chartSummary.maxVolume]} />
              <Tooltip content={tooltip} cursor={{ stroke: 'rgb(var(--lf-primary))', strokeWidth: 1 }} />
              <Bar yAxisId="volume" dataKey="volume" fill="rgb(var(--lf-primary))" fillOpacity={0.18} barSize={4} isAnimationActive={false} />
              <Area yAxisId="value" type="monotone" dataKey="value" name={t(metric === 'daily' ? 'admin.emails.dailyVolume' : 'admin.emails.cumulativeVolume')} stroke={metric === 'daily' ? 'url(#emailActivityLine)' : 'rgb(var(--lf-primary))'} strokeWidth={2.5} fill="url(#emailActivityFill)" dot={false} isAnimationActive={false} />
              <ReferenceLine yAxisId="value" y={chartSummary.average} stroke="rgb(var(--lf-content-muted))" strokeDasharray="2 5" strokeOpacity={0.7}><Label value={t('admin.emails.chartAverage')} position="insideTopLeft" fill="rgb(var(--lf-content-muted))" fontSize={11} /></ReferenceLine>
              {latestPoint && <ReferenceDot yAxisId="value" x={latestPoint.date} y={latestPoint.value} r={4} fill="rgb(var(--lf-accent))" stroke="rgb(var(--lf-surface))" strokeWidth={2} label={{ value: numberFormat.format(latestPoint.value), position: 'right', fill: 'rgb(var(--lf-content))', fontSize: 12, fontWeight: 700 }} />}
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
    </div>
  );
}

export function AdminEmailDashboard() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EmailSummary | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<EmailEntry | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const locale = i18n.resolvedLanguage ?? 'en-US';
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }), [locale]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const token = await getToken();
    const query = new URLSearchParams({ limit: String(EMAIL_PAGE_SIZE), offset: String(page * EMAIL_PAGE_SIZE) });
    const trimmedSearch = search.trim();
    if (trimmedSearch) query.set('q', trimmedSearch);
    if (statusFilter !== 'all') query.set('status', statusFilter);
    if (templateFilter !== 'all') query.set('templateType', templateFilter);
    const result = await api<LogsResponse>(`/admin/emails/logs?${query.toString()}`, { token });
    if (result.error) {
      setLogsError(result.error.code);
    } else {
      setEntries(result.data.entries);
      setTotal(result.data.total);
      setLogsError(null);
    }
    setLoadingLogs(false);
  }, [getToken, page, reloadKey, search, statusFilter, templateFilter]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    const token = await getToken();
    const result = await api<EmailSummary>(`/admin/emails/summary?days=${EMAIL_TREND_DAYS}`, { token });
    if (result.error) {
      setSummaryError(result.error.code);
    } else {
      setSummary(result.data);
      setSummaryError(null);
    }
    setLoadingSummary(false);
  }, [getToken, reloadKey]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { setPage(0); }, [search, statusFilter, templateFilter]);

  const totalPages = Math.max(1, Math.ceil(total / EMAIL_PAGE_SIZE));
  const successCount = (summary?.statuses?.relayed ?? 0) + (summary?.statuses?.delivered ?? 0);
  const successRate = summary && summary.total > 0 ? percentFormat.format(successCount / summary.total) : t('admin.emails.noData');
  const failedCount = summary?.statuses?.failed ?? 0;
  const queuedCount = summary?.statuses?.queued ?? 0;
  const failureRate = summary && summary.total > 0 ? percentFormat.format(failedCount / summary.total) : t('admin.emails.noData');
  const activeTemplatesCount = Object.keys(summary?.templates ?? {}).length;
  const statusBreakdownKeys = useMemo(() => [
    ...STATUS_KEYS,
    ...Object.keys(summary?.statuses ?? {}).filter((status) => !STATUS_KEYS.includes(status as (typeof STATUS_KEYS)[number])).sort(),
  ], [summary?.statuses]);
  const topLocale = useMemo(() => {
    const locales = Object.entries(summary?.locales ?? {});
    if (locales.length === 0) return t('admin.emails.noData');
    return locales.sort((a, b) => b[1] - a[1])[0]?.[0] ?? t('admin.emails.noData');
  }, [summary?.locales, t]);

  const templateBreakdown = useMemo(() => {
    if (!summary || summary.total === 0) return [];
    return Object.entries(summary.templates)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: count / summary.total }));
  }, [summary]);

  const localeBreakdown = useMemo(() => {
    if (!summary || summary.total === 0) return [];
    return Object.entries(summary.locales ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: count / summary.total }));
  }, [summary]);

  const templateOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: 'all', label: t('admin.emails.allTemplates') },
    ...Object.keys(summary?.templates ?? {}).sort().map((value) => ({ value, label: value })),
  ], [summary?.templates, t]);

  const statusOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: 'all', label: t('admin.emails.allStatuses') },
    ...statusBreakdownKeys.map((value) => ({ value, label: t(`admin.emails.status.${value}`, value) })),
  ], [statusBreakdownKeys, t]);

  const filteredDescription = search.trim() || statusFilter !== 'all' || templateFilter !== 'all'
    ? t('admin.emails.filteredResults', { count: total })
    : t('admin.emails.showing', { from: total ? page * EMAIL_PAGE_SIZE + 1 : 0, to: Math.min((page + 1) * EMAIL_PAGE_SIZE, total), total: numberFormat.format(total) });

  const handleCopyId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 2000);
  }, []);

  const refresh = () => setReloadKey((value) => value + 1);
  const bothUnavailable = Boolean(logsError && summaryError);

  return (
    <AdminPage titleKey="admin.emails.title" subtitleKey="admin.emails.subtitle" actions={(
      <AdminAction tone="neutral" icon="refresh" onClick={refresh}>{t('admin.emails.refresh')}</AdminAction>
    )}>
      {bothUnavailable ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Icon name="cloud_off" className="!text-[40px] text-content-faint" />
          <div>
            <p className="lf-label text-content">{t('admin.emails.loadErrorTitle')}</p>
            <p className="lf-caption mt-1 max-w-md text-content-muted">{t('admin.emails.loadErrorBody')}</p>
          </div>
          <AdminAction tone="primary" icon="refresh" onClick={refresh}>{t('admin.emails.retry')}</AdminAction>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {(logsError || summaryError) && (
            <Card className="flex flex-col gap-3 border border-warning/40 bg-warning-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Icon name="warning" className="mt-0.5 text-warning-strong" />
                <div>
                  <p className="lf-label text-content">{t('admin.emails.partialErrorTitle')}</p>
                  <p className="lf-caption mt-1 text-content-muted">
                    {logsError ? t('admin.emails.logsUnavailable') : t('admin.emails.summaryUnavailable')}
                  </p>
                </div>
              </div>
              <AdminAction tone="neutral" icon="refresh" onClick={refresh}>{t('admin.emails.retry')}</AdminAction>
            </Card>
          )}

          {loadingSummary && !summary && (
            <Card className="flex items-center justify-center gap-2 p-8 text-content-muted">
              <Icon name="progress_activity" className="animate-spin" />
              <span className="lf-caption">{t('admin.loading')}</span>
            </Card>
          )}

          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard icon={<Icon name="mail" className="!text-[24px]" />} value={numberFormat.format(summary.total)} label={t('admin.emails.totalSent')} tone="primary" />
              <StatCard icon={<Icon name="check_circle" className="!text-[24px]" />} value={successRate} label={t('admin.emails.successRate')} tone="secondary" />
              <StatCard icon={<Icon name="error" className="!text-[24px]" />} value={numberFormat.format(failedCount)} label={t('admin.emails.failed')} tone="primary" />
              <StatCard icon={<Icon name="report" className="!text-[24px]" />} value={failureRate} label={t('admin.emails.failureRate')} tone="accent" />
              <StatCard icon={<Icon name="schedule" className="!text-[24px]" />} value={numberFormat.format(queuedCount)} label={t('admin.emails.pending')} tone="accent" />
              <StatCard icon={<Icon name="layers" className="!text-[24px]" />} value={numberFormat.format(activeTemplatesCount)} label={t('admin.emails.activeTemplates')} tone="primary" />
            </div>
          )}

          {summary && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="lf-title text-content">{t('admin.emails.trendTitle')}</h2>
                    <p className="lf-caption mt-1 text-content-muted">{t('admin.emails.trendSubtitle')}</p>
                  </div>
                  <Badge className="self-start bg-surface-sunken text-content-muted">{t('admin.emails.chartWindow')}</Badge>
                </div>
                {summary.trend === undefined ? <AdminEmpty icon="cloud_off" message={t('admin.emails.trendUnavailable')} /> : summary.trend.length > 0 ? <EmailActivityChart points={summary.trend} locale={locale} /> : <AdminEmpty icon="show_chart" message={t('admin.emails.trendEmpty')} />}
              </Card>

              <Card className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="lf-title text-content">{t('admin.emails.statusBreakdown')}</h2>
                    <p className="lf-caption mt-1 text-content-muted">{t('admin.emails.statusBreakdownSubtitle')}</p>
                  </div>
                  <Icon name="fact_check" className="text-primary" />
                </div>
                <div className="flex flex-col gap-3">
                  {statusBreakdownKeys.map((status) => {
                    const count = summary.statuses?.[status] ?? 0;
                    const pct = summary.total ? count / summary.total : 0;
                    return (
                      <div key={status} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                      <span className="lf-caption text-content-muted">{t(`admin.emails.status.${status}`, status)}</span>
                          <span className="lf-caption font-semibold text-content">{numberFormat.format(count)} · {percentFormat.format(pct)}</span>
                        </div>
                        <ProgressBar value={pct * 100} tone={status === 'failed' ? 'accent' : 'primary'} label={t(`admin.emails.status.${status}`)} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {summary && (templateBreakdown.length > 0 || localeBreakdown.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {templateBreakdown.length > 0 && (
                <Card className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="lf-title text-content">{t('admin.emails.templatesBreakdown')}</h2>
                    <Badge className="bg-surface-sunken text-content-muted">{numberFormat.format(templateBreakdown.length)}</Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {templateBreakdown.slice(0, 6).map((item) => (
                      <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="lf-caption truncate font-mono text-content">{item.name}</span>
                          <span className="lf-caption shrink-0 text-content-muted">{numberFormat.format(item.count)} · {percentFormat.format(item.pct)}</span>
                        </div>
                        <ProgressBar value={item.pct * 100} label={item.name} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {localeBreakdown.length > 0 && (
                <Card className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="lf-title text-content">{t('admin.emails.localesBreakdown')}</h2>
                    <Badge className="bg-surface-sunken text-content-muted">{topLocale}</Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {localeBreakdown.slice(0, 6).map((item) => (
                      <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="lf-caption font-mono text-content">{item.name}</span>
                          <span className="lf-caption text-content-muted">{numberFormat.format(item.count)} · {percentFormat.format(item.pct)}</span>
                        </div>
                        <ProgressBar value={item.pct * 100} tone="accent" label={item.name} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          <Card className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-xl">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 !text-[18px] text-content-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('admin.emails.searchPlaceholder')}
                  aria-label={t('admin.emails.searchLabel')}
                  className="min-h-11 w-full rounded-full border border-outline/40 bg-surface-sunken pl-10 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Dropdown value={statusFilter} options={statusOptions} onChange={setStatusFilter} ariaLabel={t('admin.emails.filterStatus')} />
                {templateOptions.length > 1 && <Dropdown value={templateFilter} options={templateOptions} onChange={setTemplateFilter} ariaLabel={t('admin.emails.filterTemplate')} />}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline/30 pt-3">
              <p className="lf-caption text-content-muted">{filteredDescription}</p>
              {(search || statusFilter !== 'all' || templateFilter !== 'all') && (
                <AdminAction tone="neutral" icon="filter_alt_off" onClick={() => { setSearch(''); setStatusFilter('all'); setTemplateFilter('all'); }}>
                  {t('admin.emails.clearFilters')}
                </AdminAction>
              )}
            </div>
          </Card>

          {loadingLogs && entries.length === 0 ? (
            <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
          ) : logsError ? (
            <AdminEmpty icon="cloud_off" message={t('admin.emails.logsUnavailable')} />
          ) : entries.length === 0 ? (
            <AdminEmpty icon="mail" message={total === 0 ? t('admin.emails.empty') : t('admin.emails.noMatch')} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="hidden overflow-x-auto rounded-xl border border-outline/50 bg-surface shadow-glass md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline bg-surface-sunken/40">
                      {[t('admin.emails.colTo'), t('admin.emails.colSubject'), t('admin.emails.colType'), t('admin.emails.colLocale'), t('admin.emails.colStatus'), t('admin.emails.colDate'), t('admin.emails.colActions')].map((label, index) => (
                        <th key={label} className={cn('lf-label px-4 py-3 text-content-muted', index === 6 && 'text-right')}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/50">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        tabIndex={0}
                        onClick={() => setSelectedEntry(entry)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedEntry(entry); }}
                        className="cursor-pointer transition-colors duration-150 hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60 focus-visible:outline-none"
                      >
                        <td className="lf-body max-w-[220px] truncate px-4 py-3 font-medium">{entry.to}</td>
                        <td className="lf-body max-w-[260px] truncate px-4 py-3 text-content-muted">{entry.subject || t('admin.emails.noSubject')}</td>
                        <td className="px-4 py-3"><Badge className="bg-surface-sunken text-content-muted">{entry.templateType}</Badge></td>
                        <td className="lf-caption px-4 py-3 font-mono text-content-muted">{entry.locale || t('admin.emails.noData')}</td>
                        <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                        <td className="lf-caption whitespace-nowrap px-4 py-3 text-content-muted">{formatDate(entry.createdAt, locale, t('admin.emails.noData'))}</td>
                        <td className="px-4 py-3 text-right"><AdminAction tone="neutral" icon="visibility" onClick={() => setSelectedEntry(entry)}>{t('admin.emails.viewDetail')}</AdminAction></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {entries.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => setSelectedEntry(entry)} className="lf-glass flex min-h-11 flex-col gap-3 rounded-xl p-4 text-left transition-colors hover:bg-surface-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="lf-body truncate font-semibold text-content">{entry.to}</p>
                        <p className="lf-caption mt-1 truncate text-content-muted">{entry.subject || t('admin.emails.noSubject')}</p>
                      </div>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-outline/30 pt-3">
                      <span className="lf-caption font-mono text-content-muted">{entry.templateType} · {entry.locale || t('admin.emails.noData')}</span>
                      <span className="lf-caption text-content-faint">{formatDate(entry.createdAt, locale, t('admin.emails.noData'), 'short')}</span>
                    </div>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="lf-caption text-content-muted">{filteredDescription}</p>
                  <div className="flex gap-2">
                    <AdminAction tone="neutral" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{t('admin.emails.prev')}</AdminAction>
                    <AdminAction tone="neutral" disabled={page >= totalPages - 1} onClick={() => setPage((value) => value + 1)}>{t('admin.emails.next')}</AdminAction>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedEntry && (
            <AdminDialog title={t('admin.emails.modalTitle')} onClose={() => setSelectedEntry(null)} className="max-w-2xl gap-5">
              <div className="flex flex-wrap items-center gap-3 border-b border-outline/50 pb-3">
                <Icon name="mail" className="!text-[24px] text-primary" />
                <span className="lf-caption text-content-muted">{selectedEntry.to}</span>
                <StatusBadge status={selectedEntry.status} />
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-outline/40 bg-surface-sunken/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="lf-caption block text-content-muted">{t('admin.emails.colMessageId')}</span>
                  <span className="block truncate font-mono text-xs font-semibold text-content">{selectedEntry.messageId || selectedEntry.id}</span>
                </div>
                <AdminAction tone={copiedId ? 'success' : 'neutral'} icon={copiedId ? 'check' : 'content_copy'} onClick={() => handleCopyId(selectedEntry.messageId || selectedEntry.id)}>
                  {copiedId ? t('admin.emails.copied') : t('admin.emails.copyId')}
                </AdminAction>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-outline/30 bg-surface-sunken/30 p-4 sm:grid-cols-3">
                <div><span className="lf-caption block text-content-muted">{t('admin.emails.colType')}</span><span className="lf-caption mt-1 block font-mono text-content">{selectedEntry.templateType}</span></div>
                <div><span className="lf-caption block text-content-muted">{t('admin.emails.topLocale')}</span><span className="lf-caption mt-1 block font-mono text-content">{selectedEntry.locale || t('admin.emails.noData')}</span></div>
                <div><span className="lf-caption block text-content-muted">{t('admin.emails.colUserId')}</span><span className="lf-caption mt-1 block truncate font-mono text-content">{selectedEntry.userId || t('admin.emails.noData')}</span></div>
                <div className="col-span-2 sm:col-span-3"><span className="lf-caption block text-content-muted">{t('admin.emails.colSubject')}</span><span className="lf-body mt-1 block text-content">{selectedEntry.subject || t('admin.emails.noSubject')}</span></div>
                <div className="col-span-2 sm:col-span-3"><span className="lf-caption block text-content-muted">{t('admin.emails.colDate')}</span><span className="lf-caption mt-1 block font-mono text-content">{dateFormat.format(new Date(selectedEntry.createdAt))}</span></div>
              </div>
              {Object.keys(selectedEntry.detail).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="lf-caption font-bold text-content">{t('admin.emails.colDetail')}</span>
                  <pre className="max-h-56 overflow-x-auto rounded-xl border border-outline/40 bg-surface-sunken p-4 font-mono text-xs leading-relaxed text-content-muted">{JSON.stringify(selectedEntry.detail, null, 2)}</pre>
                </div>
              )}
              <div className="flex justify-end pt-2"><AdminAction tone="neutral" onClick={() => setSelectedEntry(null)}>{t('admin.emails.close')}</AdminAction></div>
            </AdminDialog>
          )}
        </div>
      )}
    </AdminPage>
  );
}
