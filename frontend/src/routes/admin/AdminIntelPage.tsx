import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon, Dropdown, Badge, StatCard, Table, LoadingOverlay } from '@/components/ui';
import type { DropdownOption, TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminEmpty, AdminPage, Unavailable } from './adminShared';
import {
  ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ComposedChart,
} from 'recharts';
import type { TooltipProps } from 'recharts';

/*
 * /admin/intel — full analytics dashboard powered by the dataintel service.
 * Core proxies dataintel at /api/v1/admin/intel/*; every endpoint is called
 * via api() with token auth. Nine tabs: Home, Trends, Funnels, Retention,
 * Segments, People, Experiments, Alerts, Settings.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'home' | 'trends' | 'funnels' | 'retention' | 'segments' | 'people' | 'experiments' | 'alerts' | 'settings';

interface IntelSummary {
  dau: number;
  wau: number;
  mau: number;
  totalEvents: number;
  week1Retention: number;
  activationRate: number;
  medianTimeToValue: number | null;
  peakDailyUsers: number;
  adoption: IntelAdoptionEntry[];
  anomalies: number;
}

interface IntelAdoptionEntry {
  role: string;
  routeClass: string;
  users: number;
  sessions: number;
  events: number;
}

interface IntelTrendPoint {
  date: string;
  value: number;
}

interface IntelFunnelStep {
  step: string;
  stepOrder: number;
  users: number;
  conversionFromPrevious: number | null;
  dropoffFromPrevious: number | null;
}

interface IntelCohortEntry {
  cohortWeek: string;
  weekOffset: number;
  users: number;
  cohortSize: number;
  retentionPct: number;
}

interface IntelDropoffEntry {
  lesson_id: string;
  lesson_slug: string;
  title_en: string;
  starts: number;
  completions: number;
  abandon_rate: number;
  avg_seconds_before_abandon: number;
}

interface IntelCalibrationEntry {
  lesson_id: string;
  lesson_slug: string;
  segment_id: string;
  attempts: number;
  learners: number;
  avg_score: number;
  avg_attempts_per_learner: number;
  hint_rate: number;
  first_try_avg_score: number;
}

interface IntelEngagementEntry {
  user_id: string;
  engagement_score: number;
  lessons_completed: number;
  longest_streak: number;
  sessions_30d: number;
  active_days_30d: number;
}

interface IntelChurnEntry {
  user_id: string;
  active_days_7d: number;
  active_days_14d: number;
  days_since_active: number;
  risk_level: string;
  risk_score: number;
  lessons_completed: number;
  last_event_at: string;
}

interface IntelSessionEntry {
  session_id: string;
  started_at: string;
  role: string;
  device: string;
  events: number;
  surfaces: number;
  lessons_started: number;
  visible_seconds: number;
}

interface IntelAnomaly {
  metric: string;
  date: string;
  value: number;
  expected: number;
  zScore: number;
  direction: 'up' | 'down';
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

interface IntelExperiment {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'concluded';
  metric: string;
  variantA: string;
  variantB: string;
  segmentFilter?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  concludedAt?: string;
}

interface IntelAlert {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'change_pct';
  threshold: number;
  channel: 'webhook' | 'email';
  cooldownMinutes: number;
  status: 'active' | 'paused';
  lastTriggeredAt?: string;
  createdAt: string;
}

interface IntelSegment {
  id?: string;
  name: string;
  filters: { field: string; op: 'eq' | 'neq' | 'in'; value: string | string[] }[];
}

interface IntelBundle {
  summary: IntelSummary | null;
  trends: IntelTrendPoint[] | null;
  funnel: IntelFunnelStep[] | null;
  cohorts: IntelCohortEntry[] | null;
  dropoff: IntelDropoffEntry[] | null;
  calibration: IntelCalibrationEntry[] | null;
  engagement: IntelEngagementEntry[] | null;
  churnRisk: IntelChurnEntry[] | null;
  sessions: IntelSessionEntry[] | null;
  anomalies: IntelAnomaly[] | null;
  experiments: IntelExperiment[] | null;
  alerts: IntelAlert[] | null;
  segments: IntelSegment[] | null;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; data: IntelBundle };

/* ------------------------------------------------------------------ */
/*  Error boundary                                                     */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryProps { children: React.ReactNode; fallback?: ReactNode; }
interface ErrorBoundaryState { error: Error | null; }

class ChartErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) { /* no-op */ }

  render() {
    if (this.state.error) {
      return (this.props.fallback ?? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="lf-caption text-content-muted">Chart render error</p>
        </div>
      ));
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SVG_PRIMARY = 'rgb(var(--lf-primary))';
const SVG_ACCENT = 'rgb(var(--lf-accent))';
const SVG_SUCCESS = 'rgb(var(--lf-success))';
const SVG_WARNING = 'rgb(var(--lf-warning))';
const SVG_ERROR = 'rgb(var(--lf-error))';
const SVG_DELIGHT = 'rgb(var(--lf-delight))';

const PERIOD_OPTIONS: DropdownOption<string>[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const METRIC_KEYS: DropdownOption<string>[] = [
  { value: 'dau', label: '' },
  { value: 'wau', label: '' },
  { value: 'mau', label: '' },
  { value: 'events', label: '' },
  { value: 'users', label: '' },
  { value: 'sessions', label: '' },
];

const GRANULARITY_KEYS: DropdownOption<string>[] = [
  { value: 'hour', label: '' },
  { value: 'day', label: '' },
  { value: 'week', label: '' },
];

const TABS_WITH_ICONS: { key: Tab; icon: string }[] = [
  { key: 'home', icon: 'space_dashboard' },
  { key: 'trends', icon: 'trending_up' },
  { key: 'funnels', icon: 'filter_alt' },
  { key: 'retention', icon: 'grid_view' },
  { key: 'segments', icon: 'pie_chart' },
  { key: 'people', icon: 'groups' },
  { key: 'experiments', icon: 'science' },
  { key: 'alerts', icon: 'notifications' },
  { key: 'settings', icon: 'settings' },
];

const CHURN_COLORS: Record<string, string> = {
  high: SVG_ERROR,
  medium: SVG_WARNING,
  at_risk: SVG_ACCENT,
  active: SVG_SUCCESS,
};

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="lf-title text-content">{title}</h3>
        {subtitle ? <p className="lf-caption mt-0.5 text-content-muted">{subtitle}</p> : null}
      </div>
      <ChartErrorBoundary>{children}</ChartErrorBoundary>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="lf-glass rounded-md border border-outline/50 bg-surface p-3 shadow-pop">
      <p className="lf-caption text-content-muted">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="lf-number text-content" style={{ color: p.color }}>
          {p.name}: {p.value !== undefined ? (typeof p.value === 'number' ? p.value.toLocaleString() : String(p.value)) : null}
        </p>
      ))}
    </div>
  );
}

function EmptyChartIcon({ name }: { name: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <AdminEmpty icon={name} message="" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home tab                                                           */
/* ------------------------------------------------------------------ */

function HomeTab({ data, days, t, nf, pf }: { data: IntelBundle; days: number; t: (k: string) => string; nf: Intl.NumberFormat; pf: Intl.NumberFormat }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard dense icon={<Icon name="group" />} value={data.summary ? nf.format(data.summary.dau) : ''} label={t('admin.intel.trends.metricDau')} className="shadow-glass border border-outline/50" />
        <StatCard dense icon={<Icon name="bolt" />} value={data.summary ? nf.format(data.summary.totalEvents) : ''} label={t('admin.intel.trends.metricEvents')} className="shadow-glass border border-outline/50" />
        <StatCard dense icon={<Icon name="calendar_month" />} tone="accent" value={data.summary ? pf.format(data.summary.week1Retention / 100) : ''} label={t('admin.intel.kpi.w1retention')} className="shadow-glass border border-outline/50" />
        <StatCard dense icon={<Icon name="rocket_launch" />} value={data.summary ? pf.format(data.summary.activationRate / 100) : ''} label={t('admin.intel.kpi.activation')} className="shadow-glass border border-outline/50" />
      </div>

      <ChartCard title={t(`${'admin.intel.trends.dauTitle'}`) || `DAU (${days}d)`} subtitle={String(t('admin.intel.trends.sparklineHint'))}>
        {data.trends && data.trends.length > 0 ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer>
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--lf-primary)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--lf-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lf-outline)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke={SVG_PRIMARY} fill="url(#dauFill)" strokeWidth={2} name={t('admin.intel.trends.dauTitle')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="monitoring" />
        )}
      </ChartCard>

      {data.summary?.adoption && data.summary.adoption.length > 0 ? (
        <ChartCard title={t('admin.intel.adoption.title')} subtitle={t('admin.intel.adoption.subtitle')}>
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <BarChart data={data.summary.adoption} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lf-outline)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="role" type="category" tick={{ fontSize: 11, fill: 'var(--lf-content)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="users" fill={SVG_PRIMARY} radius={[0, 4, 4, 0]} name={t('admin.intel.adoption.current')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}

      {data.anomalies && data.anomalies.filter((a) => !a.resolved).length > 0 ? (
        <ChartCard title={t('admin.intel.anomalies.title')} subtitle={t('admin.intel.anomalies.subtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.anomalies.colMetric')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.anomalies.colValue')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.anomalies.colExpected')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.anomalies.colDeviation')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.anomalies.colStart')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {data.anomalies.filter((a) => !a.resolved).map((a) => (
                  <tr key={`${a.metric}:${a.date}`} className="hover:bg-surface-sunken/50">
                    <td className="lf-body py-3 pr-4 text-content">{a.metric}</td>
                    <td className="lf-body py-3 pr-4 tabular-nums text-content">{nf.format(a.value)}</td>
                    <td className="lf-body py-3 pr-4 tabular-nums text-content-muted">{nf.format(a.expected)}</td>
                    <td className="lf-body py-3 pr-4">
                      <Badge className={a.zScore > 0 ? 'bg-error-soft text-error-strong' : 'bg-success-soft text-success-strong'}>
                        {a.zScore > 0 ? '+' : ''}{pf.format(Math.abs(a.zScore))}
                      </Badge>
                    </td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trends tab                                                         */
/* ------------------------------------------------------------------ */

function TrendsTab({ data, t }: { data: IntelBundle; t: (k: string) => string }) {
  const [metric, setMetric] = useState<string>('dau');
  const [granularity, setGranularity] = useState<string>('day');

  const metricOptions = useMemo<DropdownOption<string>[]>(() =>
    METRIC_KEYS.map((m) => ({ ...m, label: t(`admin.intel.trends.metric${m.value.charAt(0).toUpperCase()}${m.value.slice(1)}`) })),
    [t],
  );

  const granularityOptions = useMemo<DropdownOption<string>[]>(() =>
    GRANULARITY_KEYS.map((g) => ({ ...g, label: t(`admin.intel.trends.granularity${g.value.charAt(0).toUpperCase()}${g.value.slice(1)}`) })),
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Dropdown value={metric} options={metricOptions} onChange={setMetric} ariaLabel={t('admin.intel.filters.metric')} />
        <Dropdown value={granularity} options={granularityOptions} onChange={setGranularity} ariaLabel={t('admin.intel.filters.granularity')} />
      </div>

      <ChartCard title={t('admin.intel.trends.title')} subtitle={t('admin.intel.trends.subtitle')}>
        {data.trends && data.trends.length > 0 ? (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--lf-primary)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--lf-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lf-outline)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke={SVG_PRIMARY} fill="url(#trendFill)" strokeWidth={2.5} name={t('admin.intel.trends.current')} />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="show_chart" />
        )}
      </ChartCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnels tab                                                        */
/* ------------------------------------------------------------------ */

function FunnelsTab({ data, t, pf }: { data: IntelBundle; t: (k: string) => string; pf: Intl.NumberFormat }) {
  return (
    <div className="flex flex-col gap-6">
      <ChartCard title={t('admin.intel.funnel.title')} subtitle={t('admin.intel.funnel.subtitle')}>
        {data.funnel && data.funnel.length > 0 ? (
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <BarChart data={data.funnel} margin={{ top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lf-outline)" vertical={false} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: 'var(--lf-content)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="users" radius={[4, 4, 0, 0]} maxBarSize={80}>
                  {data.funnel.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? SVG_PRIMARY : i === data.funnel!.length - 1 ? SVG_SUCCESS : SVG_ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="filter_alt" />
        )}
      </ChartCard>

      {data.funnel && data.funnel.length > 0 ? (
        <ChartCard title={t('admin.intel.funnel.stepTitle')} subtitle={t('admin.intel.funnel.stepSubtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.funnel.colStep')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted text-right">{t('admin.intel.funnel.colUsers')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted text-right">{t('admin.intel.funnel.colConversion')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {data.funnel.map((s) => (
                  <tr key={s.stepOrder} className="hover:bg-surface-sunken/50">
                    <td className="lf-body py-3 pr-4 text-content">{s.step}</td>
                    <td className="lf-body py-3 pr-4 text-right tabular-nums text-content">{s.users.toLocaleString()}</td>
                    <td className="lf-body py-3 pr-4 text-right tabular-nums text-content">{s.conversionFromPrevious !== null ? pf.format(s.conversionFromPrevious / 100) : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Retention tab                                                      */
/* ------------------------------------------------------------------ */

function RetentionTab({ data, t, pf }: { data: IntelBundle; t: (k: string) => string; pf: Intl.NumberFormat }) {
  const cohortLabels = useMemo(() => {
    if (!data.cohorts) return [];
    return [...new Set(data.cohorts.map((c) => c.cohortWeek))].sort().reverse();
  }, [data.cohorts]);

  const weeks = useMemo(() => {
    if (!data.cohorts) return [];
    return [...new Set(data.cohorts.map((c) => c.weekOffset))].sort((a, b) => a - b);
  }, [data.cohorts]);

  const map = useMemo(() => {
    if (!data.cohorts) return new Map<string, IntelCohortEntry>();
    return new Map(data.cohorts.map((c) => [`${c.cohortWeek}:${c.weekOffset}`, c]));
  }, [data.cohorts]);

  const chartData = useMemo(() => {
    if (!weeks.length) return [];
    return weeks.map((w) => {
      const row: Record<string, number | string> = { week: `W${w}` };
      cohortLabels.forEach((cl) => {
        const cell = map.get(`${cl}:${w}`);
        row[cl] = cell ? cell.retentionPct * 100 : 0;
      });
      return row;
    });
  }, [weeks, cohortLabels, map]);

  const palette = [SVG_PRIMARY, SVG_ACCENT, SVG_SUCCESS, SVG_WARNING, SVG_DELIGHT, SVG_ERROR, 'var(--lf-muted)', 'var(--lf-faint)'];

  return (
    <div className="flex flex-col gap-6">
      <ChartCard title={t('admin.intel.retention.cohortTitle')} subtitle={t('admin.intel.retention.cohortSubtitle')}>
        {chartData.length > 0 && cohortLabels.length > 0 ? (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lf-outline)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--lf-content-muted)' }} axisLine={false} tickLine={false} unit="%" width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {cohortLabels.slice(0, 6).map((cl, i) => (
                  <Line key={cl} type="monotone" dataKey={cl} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="grid_view" />
        )}
      </ChartCard>

      {cohortLabels.length > 0 ? (
        <ChartCard title={t('admin.intel.retention.heatmapTitle')} subtitle={t('admin.intel.retention.heatmapSubtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-2 pr-3 text-content-muted">{t('admin.intel.retention.colCohort')}</th>
                  <th className="lf-label py-2 pr-3 text-content-muted">{t('admin.intel.retention.colSize')}</th>
                  {weeks.map((w) => (
                    <th key={w} className="lf-label py-2 pr-3 text-content-muted">W{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {cohortLabels.slice(0, 12).map((cl) => {
                  const size = map.get(`${cl}:0`)?.cohortSize ?? 0;
                  return (
                    <tr key={cl}>
                      <td className="lf-caption py-2 pr-3 text-content">{cl}</td>
                      <td className="lf-caption py-2 pr-3 text-content-muted">{size.toLocaleString()}</td>
                      {weeks.map((w) => {
                        const cell = map.get(`${cl}:${w}`);
                        const pct = cell ? cell.retentionPct : null;
                        return (
                          <td key={w} className="py-2 pr-3">
                            {pct === null ? null : (
                              <span
                                className="lf-caption inline-block rounded px-2 py-0.5 text-content"
                                style={{ backgroundColor: `color-mix(in srgb, var(--lf-primary) ${Math.round(pct * 100)}%, transparent)` }}
                              >
                                {pf.format(pct)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Segments tab                                                       */
/* ------------------------------------------------------------------ */

function SegmentsTab({ t }: { t: (k: string) => string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon name="group_work" className="!text-[40px] text-content-faint" />
      <p className="lf-label text-content">{t('admin.intel.segments.placeholder')}</p>
      <p className="lf-caption max-w-sm text-content-muted">{t('admin.intel.segments.placeholderHint')}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  People tab                                                         */
/* ------------------------------------------------------------------ */

function PeopleTab({ data, t, pf: _pf }: { data: IntelBundle; t: (k: string) => string; pf: Intl.NumberFormat }) {
  const churnData = useMemo(() => {
    if (!data.churnRisk) return [];
    const buckets: Record<string, number> = {};
    data.churnRisk.forEach((r) => { buckets[r.risk_level] = (buckets[r.risk_level] ?? 0) + 1; });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [data.churnRisk]);

  return (
    <div className="flex flex-col gap-6">
      <ChartCard title={t('admin.intel.people.leaderboardTitle')} subtitle={t('admin.intel.people.leaderboardSubtitle')}>
        {data.engagement && data.engagement.length > 0 ? (
          <Table<IntelEngagementEntry>
            rows={data.engagement.slice(0, 25)}
            rowKey={(r) => r.user_id}
            columns={[
              { key: 'score', header: t('admin.intel.people.colScore'), cell: (r) => r.engagement_score.toLocaleString(), numeric: true, primary: true },
              { key: 'lessons', header: t('admin.intel.people.colLessons'), cell: (r) => (r.lessons_completed ?? 0).toLocaleString(), numeric: true },
              { key: 'streak', header: t('admin.intel.people.colStreak'), cell: (r) => (r.longest_streak ?? 0).toLocaleString(), numeric: true },
              { key: 'sessions', header: t('admin.intel.people.colSessions30d'), cell: (r) => r.sessions_30d.toLocaleString(), numeric: true },
              { key: 'days', header: t('admin.intel.people.colDays30d'), cell: (r) => r.active_days_30d.toLocaleString(), numeric: true },
            ] satisfies TableColumn<IntelEngagementEntry>[]}
          />
        ) : (
          <EmptyChartIcon name="leaderboard" />
        )}
      </ChartCard>

      <ChartCard title={t('admin.intel.people.churnTitle')} subtitle={t('admin.intel.people.churnSubtitle')}>
        {churnData.length > 0 ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={churnData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {churnData.map((d) => (
                    <Cell key={d.name} fill={CHURN_COLORS[d.name] ?? SVG_PRIMARY} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="pie_chart" />
        )}
      </ChartCard>

      {data.churnRisk && data.churnRisk.length > 0 ? (
        <ChartCard title={t('admin.intel.people.churnTableTitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.people.colRisk')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.people.colLastActive')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.people.colLessons30d')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.people.colScore')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {data.churnRisk.map((r) => (
                  <tr key={r.user_id} className="hover:bg-surface-sunken/50">
                    <td className="lf-body py-3 pr-4">
                      <Badge className={r.risk_level === 'high' ? 'bg-error-soft text-error-strong' : r.risk_level === 'medium' ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}>
                        {r.risk_level}
                      </Badge>
                    </td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{r.last_event_at}</td>
                    <td className="lf-body py-3 pr-4 tabular-nums text-content">{r.lessons_completed.toLocaleString()}</td>
                    <td className="lf-body py-3 pr-4 tabular-nums text-content">{r.risk_score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Experiments tab                                                    */
/* ------------------------------------------------------------------ */

function ExperimentsTab({ data, t }: { data: IntelBundle; t: (k: string) => string }) {
  return (
    <div className="flex flex-col gap-6">
      {data.experiments && data.experiments.length > 0 ? (
        <ChartCard title={t('admin.intel.experiments.listTitle')} subtitle={t('admin.intel.experiments.listSubtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.experiments.colName')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.experiments.colStatus')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.experiments.colMetric')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.experiments.colControl')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.experiments.colVariant')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {data.experiments.map((ex) => (
                  <tr key={ex.id} className="hover:bg-surface-sunken/50">
                    <td className="lf-body py-3 pr-4 text-content">{ex.name}</td>
                    <td className="lf-body py-3 pr-4">
                      <Badge className={
                        ex.status === 'running' ? 'bg-success-soft text-success-strong' :
                          ex.status === 'concluded' ? 'bg-surface-sunken text-content-muted' :
                            'bg-surface-sunken text-content-faint'
                      }>
                        {t(`admin.intel.experiments.status.${ex.status}`) || ex.status}
                      </Badge>
                    </td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{ex.metric}</td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{ex.variantA}</td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{ex.variantB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Icon name="science" className="!text-[40px] text-content-faint" />
          <p className="lf-label text-content">{t('admin.intel.experiments.empty')}</p>
          <p className="lf-caption max-w-sm text-content-muted">{t('admin.intel.experiments.emptyHint')}</p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Alerts tab                                                         */
/* ------------------------------------------------------------------ */

function AlertsTab({ data, t }: { data: IntelBundle; t: (k: string) => string }) {
  return (
    <div className="flex flex-col gap-6">
      {data.alerts && data.alerts.length > 0 ? (
        <ChartCard title={t('admin.intel.alerts.listTitle')} subtitle={t('admin.intel.alerts.listSubtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline">
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colName')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colMetric')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colCondition')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colThreshold')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colChannel')}</th>
                  <th className="lf-label py-3 pr-4 text-content-muted">{t('admin.intel.alerts.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {data.alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-sunken/50">
                    <td className="lf-body py-3 pr-4 text-content">{a.name}</td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{a.metric}</td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{a.condition}</td>
                    <td className="lf-body py-3 pr-4 tabular-nums text-content">{a.threshold.toLocaleString()}</td>
                    <td className="lf-body py-3 pr-4 text-content-muted">{a.channel}</td>
                    <td className="lf-body py-3 pr-4">
                      <Badge className={a.status === 'active' ? 'bg-success-soft text-success-strong' : 'bg-surface-sunken text-content-faint'}>
                        {t(a.status === 'active' ? 'admin.intel.alerts.enabled' : 'admin.intel.alerts.disabled')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Icon name="notifications" className="!text-[40px] text-content-faint" />
          <p className="lf-label text-content">{t('admin.intel.alerts.empty')}</p>
          <p className="lf-caption max-w-sm text-content-muted">{t('admin.intel.alerts.emptyHint')}</p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings tab                                                       */
/* ------------------------------------------------------------------ */

function SettingsTab({ t }: { t: (k: string) => string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon name="settings" className="!text-[40px] text-content-faint" />
      <p className="lf-label text-content">{t('admin.intel.settings.placeholder')}</p>
      <p className="lf-caption max-w-sm text-content-muted">{t('admin.intel.settings.placeholderHint')}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export function AdminIntelPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const token = await getToken();

    const get = async <T,>(path: string): Promise<{ ok: true; data: T } | { ok: false; code: string }> => {
      const r = await api<T>(path, { token });
      if (r.error) return { ok: false, code: r.error.code };
      return { ok: true, data: r.data };
    };

    const [
      summaryR, trendsR, anomaliesR,
      funnelR, cohortsR, dropoffR, calibrationR,
      engagementR, churnR, sessionsR, experimentsR, alertsR, segmentsR,
    ] = await Promise.allSettled([
      get<IntelSummary>(`/admin/intel/metrics/summary?days=${days}`),
      get<IntelTrendPoint[]>(`/admin/intel/metrics/trends?metric=dau&granularity=day&days=${days}`),
      get<IntelAnomaly[]>('/admin/intel/anomalies/active'),
      get<IntelFunnelStep[]>('/admin/intel/funnels/activation'),
      get<IntelCohortEntry[]>('/admin/intel/retention/cohorts?weeks=12'),
      get<IntelDropoffEntry[]>('/admin/intel/lessons/dropoff?limit=25'),
      get<IntelCalibrationEntry[]>('/admin/intel/lessons/calibration?minLearners=2&limit=50'),
      get<IntelEngagementEntry[]>('/admin/intel/engagement/leaderboard?limit=50'),
      get<IntelChurnEntry[]>('/admin/intel/churn/risk?limit=100'),
      get<IntelSessionEntry[]>(`/admin/intel/sessions/depth?days=${days}&limit=200`),
      get<IntelExperiment[]>('/admin/intel/experiments'),
      get<IntelAlert[]>('/admin/intel/alerts'),
      get<IntelSegment[]>('/admin/intel/segments'),
    ]);

    const unwrap = <T,>(r: PromiseSettledResult<{ ok: true; data: T } | { ok: false; code: string }>): T | null => {
      if (r.status === 'rejected') return null;
      if (!r.value.ok) return null;
      return r.value.data;
    };

    const summaryData = unwrap<IntelSummary>(summaryR);

    setState({
      status: 'ready',
      data: {
        summary: summaryData,
        trends: unwrap<IntelTrendPoint[]>(trendsR),
        anomalies: unwrap<IntelAnomaly[]>(anomaliesR),
        funnel: unwrap<IntelFunnelStep[]>(funnelR),
        cohorts: unwrap<IntelCohortEntry[]>(cohortsR),
        dropoff: unwrap<IntelDropoffEntry[]>(dropoffR),
        calibration: unwrap<IntelCalibrationEntry[]>(calibrationR),
        engagement: unwrap<IntelEngagementEntry[]>(engagementR),
        churnRisk: unwrap<IntelChurnEntry[]>(churnR),
        sessions: unwrap<IntelSessionEntry[]>(sessionsR),
        experiments: unwrap<IntelExperiment[]>(experimentsR),
        alerts: unwrap<IntelAlert[]>(alertsR),
        segments: unwrap<IntelSegment[]>(segmentsR),
      },
    });
  }, [getToken, days]);

  useEffect(() => { void load(); }, [load]);

  const nf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const pf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 }), [i18n.resolvedLanguage]);
  const pdf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }), [i18n.resolvedLanguage]);

  if (state.status === 'loading') return <LoadingOverlay />;

  return (
    <AdminPage titleKey="admin.intel.title" subtitleKey="admin.intel.subtitle">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline/70 bg-surface p-4">
        <label className="flex flex-col gap-1">
          <span className="lf-caption text-content-muted">{t('admin.intel.filters.period')}</span>
          <Dropdown value={String(days)} options={PERIOD_OPTIONS} onChange={(v) => setDays(Number(v))} ariaLabel={t('admin.intel.filters.period')} />
        </label>
        <div className="ml-auto flex items-end gap-2">
          <Badge className="bg-surface-sunken text-content-faint">
            {t('admin.intel.export.comingSoon')}
          </Badge>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto bg-surface-sunken p-1 rounded-xl border border-outline/30">
        {TABS_WITH_ICONS.map(({ key: k, icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'flex items-center gap-1.5 min-h-10 shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              tab === k ? 'bg-surface text-content shadow-glass-sm border border-outline/30 font-bold' : 'text-content-muted hover:text-content',
            )}
          >
            <Icon name={icon} className="!text-[16px]" />
            <span>{t(`admin.intel.tabs.${k}`)}</span>
          </button>
        ))}
      </div>

      {state.status === 'error' ? (
        <div className="flex flex-col items-center gap-4">
          <Unavailable code={state.code} />
          <Button variant="secondary" onClick={load}>
            <Icon name="refresh" className="mr-1 !text-[18px]" aria-hidden />
            {t('admin.intel.retry')}
          </Button>
        </div>
      ) : (
        <>
          {tab === 'home' && <HomeTab data={state.data} days={days} t={t} nf={nf} pf={pf} />}
          {tab === 'trends' && <TrendsTab data={state.data} t={t} />}
          {tab === 'funnels' && <FunnelsTab data={state.data} t={t} pf={pf} />}
          {tab === 'retention' && <RetentionTab data={state.data} t={t} pf={pdf} />}
          {tab === 'segments' && <SegmentsTab t={t} />}
          {tab === 'people' && <PeopleTab data={state.data} t={t} pf={pf} />}
          {tab === 'experiments' && <ExperimentsTab data={state.data} t={t} />}
          {tab === 'alerts' && <AlertsTab data={state.data} t={t} />}
          {tab === 'settings' && <SettingsTab t={t} />}
        </>
      )}
    </AdminPage>
  );
}

export default AdminIntelPage;
