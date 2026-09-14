import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon, Dropdown, Badge, SectionHeading, StatCard, Table, LoadingOverlay } from '@/components/ui';
import type { DropdownOption, TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, Unavailable } from './adminShared';
import {
  IntelExportCard,
  IntelPeriodPicker,
  StaffExclusionNote,
  intelWindowQuery,
  type IntelSelection,
} from './intel/IntelControls';
import {
  ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, AreaChart, Area, Cell, ComposedChart, LabelList,
} from 'recharts';
import type { TooltipProps } from 'recharts';

/*
 * /admin/intel — full analytics dashboard powered by the dataintel service.
 * Core proxies dataintel at /api/v1/admin/intel/*; every endpoint is called
 * via api() with token auth. The workspace prioritizes decision-ready
 * evidence rather than exposing unfinished configuration surfaces.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'home' | 'trends' | 'funnels' | 'learning' | 'retention' | 'people' | 'experiments' | 'alerts';

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
  avg_seconds_before_abandon: number | null;
}

interface IntelCalibrationEntry {
  lesson_id: string;
  lesson_slug: string;
  segment_id: string;
  attempts: number;
  learners: number;
  avg_score: number;
  avg_attempts_per_learner: number;
  hint_rate: number | null;
  first_try_avg_score: number | null;
}

interface IntelEngagementEntry {
  user_id: string;
  engagement_score: number;
  lessons_completed: number;
  longest_streak: number;
  sessions_30d: number;
  active_days_30d: number;
}

/** Mirrors the backend's FamilyEngagementRow (services/insights.ts) as-is — a
 * DB-view read, not a proxied /admin/intel/* endpoint, so the fields stay
 * snake_case rather than being camelCased like the other Intel* entries. */
interface IntelFamilyEntry {
  family_id: string;
  family_created_at: string;
  members: number;
  tasks_created: number;
  tasks_completed: number;
  last_task_at: string | null;
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

interface IntelQualityReport {
  generatedAt: string;
  freshness: Array<{
    source: string;
    lastSyncedAt: string | null;
    rowsSynced: number;
    lastError: string | null;
    stale: boolean;
  }>;
  events: {
    total: number;
    idempotencyCoveragePct: number;
    contextCoveragePct: number;
    lateArrivalPct: number;
  };
  attempts: {
    total: number;
    skillCoveragePct: number;
    timingCoveragePct: number;
    documentVersionCoveragePct: number;
  };
}

interface IntelSkillHealth {
  skillKey: string;
  courseId: string | null;
  topicId: string | null;
  learners: number;
  attempts: number;
  avgMasteryProbability: number;
  lowMasteryPct: number;
  avgSecondsPerAttempt: number | null;
  hintRate: number;
  priority: 'review' | 'monitor' | 'insufficient_evidence';
}

type EvidenceStatus = 'awaiting_evidence' | 'limited' | 'sufficient';
type AttentionStatus = 'awaiting_evidence' | 'monitor' | 'review' | 'healthy';

interface IntelLearningTrendPoint {
  date: string;
  attempts: number;
  learners: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
}

interface IntelCourseHealth {
  courseId: string;
  courseSlug: string | null;
  courseTitleEn: string | null;
  courseTitleEs: string | null;
  courseTitlePt: string | null;
  lessons: number;
  segments: number;
  learners: number;
  attempts: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
  hintRate: number | null;
  retryRate: number | null;
  avgSecondsPerAttempt: number | null;
  starts: number;
  completions: number;
  abandons: number;
  abandonRate: number | null;
  evidenceStatus: EvidenceStatus;
  attention: AttentionStatus;
}

interface IntelLessonHealth extends IntelCourseHealth {
  lessonId: string;
  lessonSlug: string | null;
  lessonTitleEn: string | null;
  lessonTitleEs: string | null;
  lessonTitlePt: string | null;
}

interface IntelLearnerProfile {
  userId: string;
  role: string | null;
  coursesTouched: number;
  lessonsTouched: number;
  attempts: number;
  avgScore: number | null;
  firstTryAvgScore: number | null;
  hintRate: number | null;
  retryRate: number | null;
  avgMasteryProbability: number | null;
  skillsNeedingSupport: number;
  recommendedAction: 'remediate' | 'practice' | 'retrieve' | 'continue' | null;
  lastActiveAt: string | null;
  evidenceStatus: EvidenceStatus;
}

interface IntelLearningOverview {
  snapshot: {
    courses: number;
    lessons: number;
    attempts: number;
    learners: number;
    avgScore: number | null;
    firstTryAvgScore: number | null;
    hintRate: number | null;
    retryRate: number | null;
    avgSecondsPerAttempt: number | null;
    evidenceStatus: EvidenceStatus;
  };
  trends: IntelLearningTrendPoint[];
  courses: IntelCourseHealth[];
  lessons: IntelLessonHealth[];
  learners: IntelLearnerProfile[];
}

interface IntelLearnerDetail {
  profile: IntelLearnerProfile | null;
  trends: IntelLearningTrendPoint[];
  courses: IntelCourseHealth[];
  lessons: IntelLessonHealth[];
  states: Array<{
    skillKey: string;
    masteryProbability: number;
    evidenceCount: number;
    recommendedAction: 'remediate' | 'practice' | 'retrieve' | 'continue';
  }>;
}

interface IntelAdminUser {
  userId: string;
  displayName: string;
  username: string | null;
}

interface IntelBundle {
  consent: { kidsTotal: number; kidsConsented: number } | null;
  summary: IntelSummary | null;
  trends: IntelTrendPoint[] | null;
  funnel: IntelFunnelStep[] | null;
  cohorts: IntelCohortEntry[] | null;
  families: IntelFamilyEntry[] | null;
  dropoff: IntelDropoffEntry[] | null;
  calibration: IntelCalibrationEntry[] | null;
  engagement: IntelEngagementEntry[] | null;
  churnRisk: IntelChurnEntry[] | null;
  sessions: IntelSessionEntry[] | null;
  anomalies: IntelAnomaly[] | null;
  experiments: IntelExperiment[] | null;
  alerts: IntelAlert[] | null;
  quality: IntelQualityReport | null;
  skillHealth: IntelSkillHealth[] | null;
  learningOverview: IntelLearningOverview | null;
  users: IntelAdminUser[] | null;
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
/*
 * Chart chrome. These MUST be wrapped in rgb() like the series colours above:
 * the design tokens hold space-separated CHANNELS (`--lf-outline: 226 232 240`),
 * not colours, so a bare `var(--lf-outline)` resolves to an invalid value and
 * SVG silently falls back to black. Every grid line, axis line and tick label
 * in this console was rendering black in both themes because of it.
 */
const SVG_OUTLINE = 'rgb(var(--lf-outline))';
const SVG_CONTENT = 'rgb(var(--lf-content))';
const SVG_CONTENT_MUTED = 'rgb(var(--lf-content-muted))';
const SVG_DELIGHT = 'rgb(var(--lf-delight))';



const METRIC_KEYS: DropdownOption<string>[] = [
  { value: 'dau', label: '' },
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
  { key: 'learning', icon: 'school' },
  { key: 'retention', icon: 'grid_view' },
  { key: 'people', icon: 'groups' },
  { key: 'experiments', icon: 'science' },
  { key: 'alerts', icon: 'notifications' },
];

/** Worst first: the row an operator must act on should not need hunting for. */
const CHURN_ORDER = ['high', 'medium', 'at_risk', 'active'] as const;

const CHURN_COLORS: Record<string, string> = {
  high: SVG_ERROR,
  medium: SVG_WARNING,
  at_risk: SVG_ACCENT,
  active: SVG_SUCCESS,
};

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

/*
 * Every analytical panel on this page is a ChartCard, so the study's lockup
 * goes in HERE rather than at nineteen call sites — but the icon and the hue
 * are REQUIRED props rather than defaults, because a lockup whose colour is
 * the same everywhere has stopped saying anything (/DESIGN.md: "the hue is
 * load-bearing"). Churn is warning, retention is success, an anomaly feed is
 * warning; a caller has to decide what its panel IS.
 */
function ChartCard({
  title,
  subtitle,
  icon,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  tone: 'accent' | 'delight' | 'success' | 'warning' | 'error' | 'muted';
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <SectionHeading icon={icon} tone={tone} as="h3" className={subtitle ? 'mb-1' : 'mb-0'}>
          {title}
        </SectionHeading>
        {subtitle ? <p className="lf-caption text-content-muted">{subtitle}</p> : null}
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

      <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="lf-label text-content">{t('admin.intel.home.consentTitle')}</p>
          <p className="lf-caption mt-1 text-content-muted">{t('admin.intel.home.consentHint')}</p>
        </div>
        <p className="lf-headline tabular-nums text-primary">
          {data.consent ? `${nf.format(data.consent.kidsConsented)} / ${nf.format(data.consent.kidsTotal)}` : t('admin.intel.home.consentPending')}
        </p>
      </Card>

      <ChartCard icon="show_chart" tone="accent" title={t(`${'admin.intel.trends.dauTitle'}`) || `DAU (${days}d)`} subtitle={String(t('admin.intel.trends.sparklineHint'))}>
        {data.trends && data.trends.length > 0 ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer>
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SVG_PRIMARY} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={SVG_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} width={50} />
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
        <ChartCard icon="trending_up" tone="delight" title={t('admin.intel.adoption.title')} subtitle={t('admin.intel.adoption.subtitle')}>
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <BarChart data={data.summary.adoption} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis dataKey="role" type="category" tick={{ fontSize: 11, fill: SVG_CONTENT }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="users" fill={SVG_PRIMARY} radius={[0, 4, 4, 0]} name={t('admin.intel.adoption.current')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}

      {data.anomalies && data.anomalies.filter((a) => !a.resolved).length > 0 ? (
        <ChartCard icon="crisis_alert" tone="warning" title={t('admin.intel.anomalies.title')} subtitle={t('admin.intel.anomalies.subtitle')}>
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

      <ChartCard icon="timeline" tone="accent" title={t('admin.intel.trends.title')} subtitle={t('admin.intel.trends.subtitle')}>
        {data.trends && data.trends.length > 0 ? (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SVG_PRIMARY} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={SVG_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} width={50} />
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
      <ChartCard icon="filter_alt" tone="delight" title={t('admin.intel.funnel.title')} subtitle={t('admin.intel.funnel.subtitle')}>
        {data.funnel && data.funnel.length > 0 ? (
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <BarChart data={data.funnel} margin={{ top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} vertical={false} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: SVG_CONTENT }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} width={50} />
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
        <ChartCard icon="stairs" tone="delight" title={t('admin.intel.funnel.stepTitle')} subtitle={t('admin.intel.funnel.stepSubtitle')}>
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
  const questTotals = useMemo(() => {
    const families = data.families ?? [];
    return families.reduce(
      (acc, f) => ({ created: acc.created + f.tasks_created, completed: acc.completed + f.tasks_completed }),
      { created: 0, completed: 0 },
    );
  }, [data.families]);
  const questCompletionRate = questTotals.created > 0 ? questTotals.completed / questTotals.created : null;
  const questFamilies = useMemo(
    () => (data.families ? [...data.families].sort((a, b) => b.tasks_created - a.tasks_created).slice(0, 25) : []),
    [data.families],
  );

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

  const palette = [SVG_PRIMARY, SVG_ACCENT, SVG_SUCCESS, SVG_WARNING, SVG_DELIGHT, SVG_ERROR, SVG_CONTENT_MUTED, 'rgb(var(--lf-content-faint))'];

  return (
    <div className="flex flex-col gap-6">
      <ChartCard icon="grid_view" tone="success" title={t('admin.intel.retention.cohortTitle')} subtitle={t('admin.intel.retention.cohortSubtitle')}>
        {chartData.length > 0 && cohortLabels.length > 0 ? (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} unit="%" width={45} />
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
        <ChartCard icon="blur_on" tone="success" title={t('admin.intel.retention.heatmapTitle')} subtitle={t('admin.intel.retention.heatmapSubtitle')}>
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
                                className="lf-caption inline-block rounded-sm px-2 py-0.5 text-content"
                                style={{ backgroundColor: `color-mix(in srgb, rgb(var(--lf-primary)) ${Math.round(pct * 100)}%, transparent)` }}
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

      {/* Task/quest completion — the one retention signal the backend
          (services/insights.ts readFamilyEngagement, 0024) has computed all
          along without a console to show it in. */}
      <ChartCard icon="task_alt" tone="accent" title={t('admin.intel.retention.questTitle')} subtitle={t('admin.intel.retention.questSubtitle')}>
        {questFamilies.length > 0 ? (
          <div className="flex flex-col gap-4">
            <StatCard
              dense
              icon={<Icon name="task_alt" />}
              tone="accent"
              value={questCompletionRate === null ? '—' : pf.format(questCompletionRate)}
              label={t('admin.intel.retention.kpiQuestCompletion')}
              className="w-fit shadow-glass border border-outline/50"
            />
            <Table<IntelFamilyEntry>
              rows={questFamilies}
              rowKey={(r) => r.family_id}
              columns={[
                { key: 'members', header: t('admin.intel.retention.colMembers'), cell: (r) => r.members.toLocaleString(), numeric: true },
                { key: 'assigned', header: t('admin.intel.retention.colTasksAssigned'), cell: (r) => r.tasks_created.toLocaleString(), numeric: true, primary: true },
                { key: 'completed', header: t('admin.intel.retention.colTasksCompleted'), cell: (r) => r.tasks_completed.toLocaleString(), numeric: true },
                {
                  key: 'last',
                  header: t('admin.intel.retention.colLastActivity'),
                  cell: (r) => (r.last_task_at ? new Date(r.last_task_at).toLocaleDateString() : '—'),
                },
              ] satisfies TableColumn<IntelFamilyEntry>[]}
            />
          </div>
        ) : (
          <EmptyChartIcon name="task_alt" />
        )}
      </ChartCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Learning tab                                                       */
/* ------------------------------------------------------------------ */

function EvidenceBadge({ status, t }: { status: EvidenceStatus; t: (key: string) => string }) {
  const tone = status === 'sufficient'
    ? 'bg-success-soft text-success-strong'
    : status === 'limited'
      ? 'bg-warning-soft text-warning-strong'
      : 'bg-surface-sunken text-content-muted';
  return <Badge className={tone}>{t(`admin.intel.learning.evidence.${status}`)}</Badge>;
}

function AttentionBadge({ status, t }: { status: AttentionStatus; t: (key: string) => string }) {
  const tone = status === 'review'
    ? 'bg-error-soft text-error-strong'
    : status === 'healthy'
      ? 'bg-success-soft text-success-strong'
      : status === 'monitor'
        ? 'bg-warning-soft text-warning-strong'
        : 'bg-surface-sunken text-content-muted';
  return <Badge className={tone}>{t(`admin.intel.learning.attention.${status}`)}</Badge>;
}

function CatalogDetailDialog({ item, kind, onClose, t, nf, pf }: {
  item: IntelCourseHealth | IntelLessonHealth;
  kind: 'course' | 'lesson';
  onClose: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  nf: Intl.NumberFormat;
  pf: Intl.NumberFormat;
}) {
  const isLesson = kind === 'lesson';
  const title = isLesson
    ? (item as IntelLessonHealth).lessonTitleEn || (item as IntelLessonHealth).lessonSlug || t('admin.intel.learning.untitledLesson')
    : item.courseTitleEn || item.courseSlug || t('admin.intel.learning.untitledCourse');
  const metric = (value: number | null, format: 'number' | 'percent' = 'number') => value === null
    ? t('admin.intel.learning.unavailable')
    : format === 'percent' ? pf.format(value / 100) : nf.format(value);
  return (
    <AdminDialog title={title} onClose={onClose} className="max-w-5xl">
      <div className="flex flex-col gap-6 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <AttentionBadge status={item.attention} t={t} />
          <EvidenceBadge status={item.evidenceStatus} t={t} />
          <Badge className="bg-surface-sunken text-content-muted">{isLesson ? t('admin.intel.learning.lesson') : t('admin.intel.learning.course')}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard dense icon={<Icon name="groups" />} label={t('admin.intel.learning.colLearners')} value={nf.format(item.learners)} />
          <StatCard dense icon={<Icon name="assignment_turned_in" />} label={t('admin.intel.learning.attemptsLabel')} value={nf.format(item.attempts)} />
          <StatCard dense icon={<Icon name="grade" />} label={t('admin.intel.learning.colScore')} value={metric(item.avgScore, 'percent')} />
          <StatCard dense icon={<Icon name="tips_and_updates" />} label={t('admin.intel.learning.colHints')} value={item.hintRate === null ? t('admin.intel.learning.unavailable') : pf.format(item.hintRate)} />
        </div>
        <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.colFirstTry')}</p><p className="lf-number mt-1 text-content">{metric(item.firstTryAvgScore, 'percent')}</p></div>
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.retryRate')}</p><p className="lf-number mt-1 text-content">{item.retryRate === null ? t('admin.intel.learning.unavailable') : pf.format(item.retryRate)}</p></div>
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.colAbandon')}</p><p className="lf-number mt-1 text-content">{item.abandonRate === null ? t('admin.intel.learning.unavailable') : pf.format(item.abandonRate / 100)}</p></div>
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.colStarts')}</p><p className="lf-number mt-1 text-content">{nf.format(item.starts)}</p></div>
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.colCompleted')}</p><p className="lf-number mt-1 text-content">{nf.format(item.completions)}</p></div>
          <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.avgTime')}</p><p className="lf-number mt-1 text-content">{item.avgSecondsPerAttempt === null ? t('admin.intel.learning.unavailable') : t('admin.intel.learning.seconds', { count: Math.round(item.avgSecondsPerAttempt) })}</p></div>
        </Card>
        <p className="lf-caption text-content-muted">{t(`admin.intel.learning.evidenceHint.${item.evidenceStatus}`)}</p>
      </div>
    </AdminDialog>
  );
}

function LearningTab({ data, t, nf, pf, onInspectLearner }: {
  data: IntelBundle;
  t: (k: string, options?: Record<string, unknown>) => string;
  nf: Intl.NumberFormat;
  pf: Intl.NumberFormat;
  onInspectLearner: (userId: string) => void;
}) {
  const [directory, setDirectory] = useState<'courses' | 'lessons' | 'learners'>('courses');
  const [detail, setDetail] = useState<{ kind: 'course' | 'lesson'; item: IntelCourseHealth | IntelLessonHealth } | null>(null);
  const overview = data.learningOverview;
  const usersById = useMemo(() => new Map((data.users ?? []).map((user) => [user.userId, user])), [data.users]);
  const score = (value: number | null) => value === null ? t('admin.intel.learning.unavailable') : pf.format(value / 100);

  if (!overview || !overview.snapshot) return <Unavailable code="DATA_UNAVAILABLE" />;

  const snapshotTone = overview.snapshot.evidenceStatus === 'sufficient' ? 'secondary' : overview.snapshot.evidenceStatus === 'limited' ? 'accent' : 'primary';
  const directoryButtons: Array<{ key: 'courses' | 'lessons' | 'learners'; icon: string }> = [
    { key: 'courses', icon: 'menu_book' },
    { key: 'lessons', icon: 'article' },
    { key: 'learners', icon: 'groups' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary-soft blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="lf-eyebrow text-accent">{t('admin.intel.learning.commandKicker')}</p>
              <h2 className="lf-headline mt-1 text-content">{t('admin.intel.learning.commandTitle')}</h2>
              <p className="lf-caption mt-2 text-content-muted">{t('admin.intel.learning.commandSubtitle')}</p>
            </div>
            <EvidenceBadge status={overview.snapshot.evidenceStatus} t={t} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard dense tone={snapshotTone} icon={<Icon name="account_tree" />} label={t('admin.intel.learning.catalogCourses')} value={nf.format(overview.snapshot.courses)} />
            <StatCard dense tone={snapshotTone} icon={<Icon name="article" />} label={t('admin.intel.learning.catalogLessons')} value={nf.format(overview.snapshot.lessons)} />
            <StatCard dense tone={snapshotTone} icon={<Icon name="assignment_turned_in" />} label={t('admin.intel.learning.attemptsLabel')} value={nf.format(overview.snapshot.attempts)} />
            <StatCard dense tone={snapshotTone} icon={<Icon name="groups" />} label={t('admin.intel.learning.activeLearners')} value={nf.format(overview.snapshot.learners)} />
          </div>
          <p className="lf-caption text-content-muted">{t(`admin.intel.learning.evidenceHint.${overview.snapshot.evidenceStatus}`)}</p>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <ChartCard icon="monitoring" tone="accent" title={t('admin.intel.learning.pulseTitle')} subtitle={t('admin.intel.learning.pulseSubtitle')}>
          {overview.trends.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={overview.trends} margin={{ left: 4, right: 8 }}>
                  <defs><linearGradient id="learningAttemptFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SVG_PRIMARY} stopOpacity={0.3} /><stop offset="100%" stopColor={SVG_PRIMARY} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="volume" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} width={38} />
                  <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip content={<CustomTooltip />} /><Legend />
                  <Area yAxisId="volume" type="monotone" dataKey="attempts" name={t('admin.intel.learning.attemptsLabel')} stroke={SVG_PRIMARY} fill="url(#learningAttemptFill)" strokeWidth={2.5} />
                  <Line yAxisId="score" type="monotone" dataKey="avgScore" name={t('admin.intel.learning.colScore')} stroke={SVG_SUCCESS} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChartIcon name="monitoring" />}
        </ChartCard>
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <SectionHeading icon="checklist" tone="success" as="h3" className="mb-1">{t('admin.intel.learning.readinessTitle')}</SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.intel.learning.readinessSubtitle')}</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><span className="lf-caption text-content-muted">{t('admin.intel.learning.colScore')}</span><span className="lf-number text-content">{score(overview.snapshot.avgScore)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="lf-caption text-content-muted">{t('admin.intel.learning.colFirstTry')}</span><span className="lf-number text-content">{score(overview.snapshot.firstTryAvgScore)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="lf-caption text-content-muted">{t('admin.intel.learning.colHints')}</span><span className="lf-number text-content">{overview.snapshot.hintRate === null ? t('admin.intel.learning.unavailable') : pf.format(overview.snapshot.hintRate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="lf-caption text-content-muted">{t('admin.intel.learning.retryRate')}</span><span className="lf-number text-content">{overview.snapshot.retryRate === null ? t('admin.intel.learning.unavailable') : pf.format(overview.snapshot.retryRate)}</span></div>
          </div>
          {data.quality ? <p className="lf-caption border-t border-outline/60 pt-3 text-content-muted">{t('admin.intel.learning.syncCoverage', { count: nf.format(data.quality.attempts.total) })}</p> : null}
        </Card>
      </div>

      <ChartCard icon="folder_open" tone="accent" title={t('admin.intel.learning.directoryTitle')} subtitle={t('admin.intel.learning.directorySubtitle')}>
        <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-md border border-outline/30 bg-surface-sunken p-1">
          {directoryButtons.map(({ key, icon }) => <button key={key} type="button" onClick={() => setDirectory(key)} className={cn('flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 lf-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', directory === key ? 'bg-surface text-content shadow-glass-sm' : 'text-content-muted hover:text-content')}><Icon name={icon} className="!text-[17px]" />{t(`admin.intel.learning.directory.${key}`)}</button>)}
        </div>
        {directory === 'courses' ? <Table<IntelCourseHealth> rows={overview.courses} rowKey={(row) => row.courseId} onRowClick={(item) => setDetail({ kind: 'course', item })} columns={[
          { key: 'course', header: t('admin.intel.learning.course'), primary: true, cell: (row) => <div><p>{row.courseTitleEn || row.courseSlug || t('admin.intel.learning.untitledCourse')}</p><p className="lf-caption text-content-muted">{t('admin.intel.learning.lessonsCount', { count: row.lessons })}</p></div> },
          { key: 'attention', header: t('admin.intel.learning.colPriority'), cell: (row) => <AttentionBadge status={row.attention} t={t} /> },
          { key: 'evidence', header: t('admin.intel.learning.evidenceLabel'), cell: (row) => <EvidenceBadge status={row.evidenceStatus} t={t} /> },
          { key: 'learners', header: t('admin.intel.learning.colLearners'), cell: (row) => nf.format(row.learners), numeric: true },
          { key: 'score', header: t('admin.intel.learning.colScore'), cell: (row) => score(row.avgScore), numeric: true },
          { key: 'attempts', header: t('admin.intel.learning.attemptsLabel'), cell: (row) => nf.format(row.attempts), numeric: true },
          { key: 'open', header: t('admin.intel.learning.colDetail'), cell: (row) => <AdminAction icon="open_in_full" onClick={() => setDetail({ kind: 'course', item: row })}>{t('admin.intel.learning.inspect')}</AdminAction> },
        ] satisfies TableColumn<IntelCourseHealth>[]} /> : null}
        {directory === 'lessons' ? <Table<IntelLessonHealth> rows={overview.lessons} rowKey={(row) => row.lessonId} onRowClick={(item) => setDetail({ kind: 'lesson', item })} columns={[
          { key: 'lesson', header: t('admin.intel.learning.colLesson'), primary: true, cell: (row) => <div><p>{row.lessonTitleEn || row.lessonSlug || t('admin.intel.learning.untitledLesson')}</p><p className="lf-caption text-content-muted">{row.courseTitleEn || row.courseSlug || t('admin.intel.learning.untitledCourse')}</p></div> },
          { key: 'attention', header: t('admin.intel.learning.colPriority'), cell: (row) => <AttentionBadge status={row.attention} t={t} /> },
          { key: 'evidence', header: t('admin.intel.learning.evidenceLabel'), cell: (row) => <EvidenceBadge status={row.evidenceStatus} t={t} /> },
          { key: 'learners', header: t('admin.intel.learning.colLearners'), cell: (row) => nf.format(row.learners), numeric: true },
          { key: 'first', header: t('admin.intel.learning.colFirstTry'), cell: (row) => score(row.firstTryAvgScore), numeric: true },
          { key: 'open', header: t('admin.intel.learning.colDetail'), cell: (row) => <AdminAction icon="open_in_full" onClick={() => setDetail({ kind: 'lesson', item: row })}>{t('admin.intel.learning.inspect')}</AdminAction> },
        ] satisfies TableColumn<IntelLessonHealth>[]} /> : null}
        {directory === 'learners' ? <Table<IntelLearnerProfile> rows={overview.learners} rowKey={(row) => row.userId} onRowClick={(row) => onInspectLearner(row.userId)} columns={[
          { key: 'learner', header: t('admin.intel.learning.learner'), primary: true, cell: (row) => <div><p>{usersById.get(row.userId)?.displayName || usersById.get(row.userId)?.username || t('admin.intel.learning.privateLearner')}</p><p className="lf-caption text-content-muted">{row.role || t('admin.intel.learning.roleUnavailable')}</p></div> },
          { key: 'action', header: t('admin.intel.learning.recommendation'), cell: (row) => row.recommendedAction ? <Badge className="bg-primary-soft text-primary">{t(`admin.intel.learning.action.${row.recommendedAction}`)}</Badge> : <EvidenceBadge status={row.evidenceStatus} t={t} /> },
          { key: 'mastery', header: t('admin.intel.learning.colMastery'), cell: (row) => row.avgMasteryProbability === null ? t('admin.intel.learning.unavailable') : pf.format(row.avgMasteryProbability), numeric: true },
          { key: 'support', header: t('admin.intel.learning.supportSkills'), cell: (row) => nf.format(row.skillsNeedingSupport), numeric: true },
          { key: 'attempts', header: t('admin.intel.learning.attemptsLabel'), cell: (row) => nf.format(row.attempts), numeric: true },
          { key: 'open', header: t('admin.intel.learning.colDetail'), cell: (row) => <AdminAction icon="person_search" onClick={() => onInspectLearner(row.userId)}>{t('admin.intel.learning.inspect')}</AdminAction> },
        ] satisfies TableColumn<IntelLearnerProfile>[]} /> : null}
      </ChartCard>

      <ChartCard icon="psychology" tone="success" title={t('admin.intel.learning.skillHealthTitle')} subtitle={t('admin.intel.learning.skillHealthSubtitle')}>
        {data.skillHealth && data.skillHealth.length > 0 ? <Table<IntelSkillHealth> rows={data.skillHealth} rowKey={(row) => row.skillKey} columns={[
          { key: 'skill', header: t('admin.intel.learning.colSkill'), cell: (row) => row.skillKey, primary: true },
          { key: 'priority', header: t('admin.intel.learning.colPriority'), cell: (row) => <Badge className={row.priority === 'review' ? 'bg-error-soft text-error-strong' : row.priority === 'monitor' ? 'bg-warning-soft text-warning-strong' : 'bg-surface-sunken text-content-muted'}>{t(`admin.intel.learning.priority.${row.priority}`)}</Badge> },
          { key: 'learners', header: t('admin.intel.learning.colLearners'), cell: (row) => nf.format(row.learners), numeric: true },
          { key: 'mastery', header: t('admin.intel.learning.colMastery'), cell: (row) => pf.format(row.avgMasteryProbability), numeric: true },
          { key: 'hints', header: t('admin.intel.learning.colHints'), cell: (row) => pf.format(row.hintRate), numeric: true },
        ] satisfies TableColumn<IntelSkillHealth>[]} /> : <EmptyChartIcon name="psychology" />}
      </ChartCard>
      {detail ? <CatalogDetailDialog item={detail.item} kind={detail.kind} onClose={() => setDetail(null)} t={t} nf={nf} pf={pf} /> : null}
    </div>
  );
}

function LearnerDetailDialog({ detail, learner, loading, onClose, t, nf, pf }: {
  detail: IntelLearnerDetail | null;
  learner: IntelAdminUser | undefined;
  loading: boolean;
  onClose: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  nf: Intl.NumberFormat;
  pf: Intl.NumberFormat;
}) {
  const title = learner?.displayName || learner?.username || t('admin.intel.learning.privateLearner');
  const profile = detail?.profile;
  return (
    <AdminDialog title={title} onClose={onClose} className="max-w-6xl">
      <div className="flex flex-col gap-6 pt-5">
        {loading ? <div className="flex min-h-48 items-center justify-center"><Icon name="progress_activity" className="animate-spin text-primary" /></div> : profile ? <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard dense icon={<Icon name="assignment_turned_in" />} label={t('admin.intel.learning.attemptsLabel')} value={nf.format(profile.attempts)} />
            <StatCard dense icon={<Icon name="grade" />} label={t('admin.intel.learning.colScore')} value={profile.avgScore === null ? t('admin.intel.learning.unavailable') : pf.format(profile.avgScore / 100)} />
            <StatCard dense icon={<Icon name="psychology" />} label={t('admin.intel.learning.colMastery')} value={profile.avgMasteryProbability === null ? t('admin.intel.learning.unavailable') : pf.format(profile.avgMasteryProbability)} />
            <StatCard dense icon={<Icon name="support" />} label={t('admin.intel.learning.supportSkills')} value={nf.format(profile.skillsNeedingSupport)} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]">
            <ChartCard icon="monitoring" tone="accent" title={t('admin.intel.learning.learnerPulseTitle')} subtitle={t('admin.intel.learning.learnerPulseSubtitle')}>
              {detail.trends.length > 0 ? <div className="h-[260px] w-full"><ResponsiveContainer><ComposedChart data={detail.trends}><CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="attempts" name={t('admin.intel.learning.attemptsLabel')} fill={SVG_PRIMARY} radius={[4, 4, 0, 0]} /></ComposedChart></ResponsiveContainer></div> : <EmptyChartIcon name="monitoring" />}
            </ChartCard>
            <Card className="flex flex-col gap-3 p-5">
              <div><p className="lf-label text-content">{t('admin.intel.learning.recommendation')}</p><p className="lf-caption mt-1 text-content-muted">{t('admin.intel.learning.recommendationHint')}</p></div>
              {profile.recommendedAction ? <Badge className="w-fit bg-primary-soft text-primary">{t(`admin.intel.learning.action.${profile.recommendedAction}`)}</Badge> : <EvidenceBadge status={profile.evidenceStatus} t={t} />}
              <div className="border-t border-outline/60 pt-3"><p className="lf-caption text-content-muted">{t('admin.intel.learning.firstTry')}</p><p className="lf-number mt-1 text-content">{profile.firstTryAvgScore === null ? t('admin.intel.learning.unavailable') : pf.format(profile.firstTryAvgScore / 100)}</p></div>
              <div><p className="lf-caption text-content-muted">{t('admin.intel.learning.colHints')}</p><p className="lf-number mt-1 text-content">{profile.hintRate === null ? t('admin.intel.learning.unavailable') : pf.format(profile.hintRate)}</p></div>
            </Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard icon="menu_book" tone="accent" title={t('admin.intel.learning.learnerCoursesTitle')} subtitle={t('admin.intel.learning.learnerCoursesSubtitle')}>
              {detail.courses.length ? <Table<IntelCourseHealth> rows={detail.courses} rowKey={(row) => row.courseId} columns={[
                { key: 'course', header: t('admin.intel.learning.course'), primary: true, cell: (row) => row.courseTitleEn || row.courseSlug || t('admin.intel.learning.untitledCourse') },
                { key: 'score', header: t('admin.intel.learning.colScore'), numeric: true, cell: (row) => row.avgScore === null ? t('admin.intel.learning.unavailable') : pf.format(row.avgScore / 100) },
                { key: 'attempts', header: t('admin.intel.learning.attemptsLabel'), numeric: true, cell: (row) => nf.format(row.attempts) },
              ] satisfies TableColumn<IntelCourseHealth>[]} /> : <EmptyChartIcon name="menu_book" />}
            </ChartCard>
            <ChartCard icon="psychology" tone="success" title={t('admin.intel.learning.learnerSkillsTitle')} subtitle={t('admin.intel.learning.learnerSkillsSubtitle')}>
              {detail.states.length ? <Table<typeof detail.states[number]> rows={detail.states} rowKey={(row) => row.skillKey} columns={[
                { key: 'skill', header: t('admin.intel.learning.colSkill'), primary: true, cell: (row) => row.skillKey },
                { key: 'mastery', header: t('admin.intel.learning.colMastery'), numeric: true, cell: (row) => pf.format(row.masteryProbability) },
                { key: 'action', header: t('admin.intel.learning.recommendation'), cell: (row) => <Badge className="bg-primary-soft text-primary">{t(`admin.intel.learning.action.${row.recommendedAction}`)}</Badge> },
              ] satisfies TableColumn<typeof detail.states[number]>[]} /> : <EmptyChartIcon name="psychology" />}
            </ChartCard>
          </div>
        </> : <AdminEmpty icon="psychology" message={t('admin.intel.learning.learnerNoEvidence')} />}
      </div>
    </AdminDialog>
  );
}

/* ------------------------------------------------------------------ */
/*  People tab                                                         */
/* ------------------------------------------------------------------ */

function PeopleTab({ data, t, pf: _pf }: { data: IntelBundle; t: (k: string) => string; pf: Intl.NumberFormat }) {
  /*
   * Churn buckets are ORDERED severity levels, not nominal slices of a whole.
   * They were drawn as a pie, which fails twice over: it throws the ordering
   * away (a pie has no "worse than" direction) and it asks the reader to
   * compare angles, which is measurably less accurate than comparing the
   * lengths of bars sharing a baseline. Severity order is fixed here rather
   * than left to object-key order so "high" is always the top row.
   */
  const churnData = useMemo(() => {
    if (!data.churnRisk) return [];
    const buckets: Record<string, number> = {};
    data.churnRisk.forEach((r) => { buckets[r.risk_level] = (buckets[r.risk_level] ?? 0) + 1; });
    const total = Object.values(buckets).reduce((sum, n) => sum + n, 0);
    return CHURN_ORDER.filter((name) => buckets[name] !== undefined).map((name) => ({
      name,
      value: buckets[name] ?? 0,
      share: total > 0 ? (buckets[name] ?? 0) / total : 0,
    }));
  }, [data.churnRisk]);

  return (
    <div className="flex flex-col gap-6">
      <ChartCard icon="leaderboard" tone="delight" title={t('admin.intel.people.leaderboardTitle')} subtitle={t('admin.intel.people.leaderboardSubtitle')}>
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

      <ChartCard icon="person_off" tone="warning" title={t('admin.intel.people.churnTitle')} subtitle={t('admin.intel.people.churnSubtitle')}>
        {churnData.length > 0 ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <BarChart data={churnData} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SVG_OUTLINE} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: SVG_CONTENT_MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={92}
                  tick={{ fontSize: 11, fill: SVG_CONTENT }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(name: string) => t(`admin.intel.people.churnLevels.${name}`)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: SVG_OUTLINE, fillOpacity: 0.25 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={34}>
                  {churnData.map((d) => (
                    <Cell key={d.name} fill={CHURN_COLORS[d.name] ?? SVG_PRIMARY} />
                  ))}
                  {/* Count AND share: the count is what you act on, the share
                      is what the pie was there to convey. Both, or neither
                      question gets answered. */}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value: number) => {
                      const row = churnData.find((d) => d.value === value);
                      return row ? `${value} · ${Math.round(row.share * 100)}%` : String(value);
                    }}
                    style={{ fontSize: 11, fill: SVG_CONTENT_MUTED }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartIcon name="pie_chart" />
        )}
      </ChartCard>

      {data.churnRisk && data.churnRisk.length > 0 ? (
        <ChartCard icon="table_rows" tone="warning" title={t('admin.intel.people.churnTableTitle')}>
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
        <ChartCard icon="science" tone="delight" title={t('admin.intel.experiments.listTitle')} subtitle={t('admin.intel.experiments.listSubtitle')}>
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
        <ChartCard icon="notifications_active" tone="warning" title={t('admin.intel.alerts.listTitle')} subtitle={t('admin.intel.alerts.listSubtitle')}>
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
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export function AdminIntelPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => searchParams.get('focus') === 'learning' ? 'learning' : 'home');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selection, setSelection] = useState<IntelSelection>({ days: 30 });
  const days = selection.days;
  /*
   * One serialized window for every request on the page. Thirteen of the
   * seventeen requests used to ignore the period control entirely, so the
   * console showed lifetime figures under a "last 7 days" label.
   */
  const windowQuery = intelWindowQuery(selection);
  // Cohort retention is expressed in weeks, so the same selection is converted
  // rather than left pinned at a hard-coded 12.
  const cohortWeeks = Math.max(1, Math.min(52, Math.round(days / 7)));
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [learnerDetail, setLearnerDetail] = useState<IntelLearnerDetail | null>(null);
  const [learnerDetailLoading, setLearnerDetailLoading] = useState(false);

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
      engagementR, churnR, sessionsR, experimentsR, alertsR, consentR, qualityR, skillHealthR, learningOverviewR, usersR,
    ] = await Promise.allSettled([
      get<IntelSummary>(`/admin/intel/metrics/summary?${windowQuery}`),
      get<IntelTrendPoint[]>(`/admin/intel/metrics/trends?metric=dau&granularity=day&${windowQuery}`),
      get<IntelAnomaly[]>(`/admin/intel/anomalies/active?${windowQuery}`),
      get<IntelFunnelStep[]>(`/admin/intel/funnels/activation?${windowQuery}`),
      get<IntelCohortEntry[]>(`/admin/intel/retention/cohorts?weeks=${cohortWeeks}`),
      get<IntelDropoffEntry[]>(`/admin/intel/lessons/dropoff?limit=25&${windowQuery}`),
      get<IntelCalibrationEntry[]>(`/admin/intel/lessons/calibration?minLearners=2&limit=50&${windowQuery}`),
      get<IntelEngagementEntry[]>(`/admin/intel/engagement/leaderboard?limit=50&${windowQuery}`),
      get<IntelChurnEntry[]>(`/admin/intel/churn/risk?limit=100&${windowQuery}`),
      get<IntelSessionEntry[]>(`/admin/intel/sessions/depth?limit=200&${windowQuery}`),
      get<IntelExperiment[]>('/admin/intel/experiments'),
      get<IntelAlert[]>('/admin/intel/alerts'),
      get<{ families: IntelFamilyEntry[]; consent: { kidsTotal: number; kidsConsented: number } }>('/admin/insights/families?limit=100'),
      get<IntelQualityReport>(`/admin/intel/quality?${windowQuery}`),
      get<{ skills: IntelSkillHealth[] }>(`/admin/intel/learning/content-health?limit=50&${windowQuery}`),
      get<IntelLearningOverview>(`/admin/intel/learning/overview?limit=100&${windowQuery}`),
      get<{ users: IntelAdminUser[] }>('/admin/users'),
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
        consent: unwrap<{ families: IntelFamilyEntry[]; consent: { kidsTotal: number; kidsConsented: number } }>(consentR)?.consent ?? null,
        summary: summaryData,
        trends: unwrap<IntelTrendPoint[]>(trendsR),
        anomalies: unwrap<IntelAnomaly[]>(anomaliesR),
        funnel: unwrap<IntelFunnelStep[]>(funnelR),
        cohorts: unwrap<IntelCohortEntry[]>(cohortsR),
        families: unwrap<{ families: IntelFamilyEntry[]; consent: { kidsTotal: number; kidsConsented: number } }>(consentR)?.families ?? null,
        dropoff: unwrap<IntelDropoffEntry[]>(dropoffR),
        calibration: unwrap<IntelCalibrationEntry[]>(calibrationR),
        engagement: unwrap<IntelEngagementEntry[]>(engagementR),
        churnRisk: unwrap<IntelChurnEntry[]>(churnR),
        sessions: unwrap<IntelSessionEntry[]>(sessionsR),
        experiments: unwrap<IntelExperiment[]>(experimentsR),
        alerts: unwrap<IntelAlert[]>(alertsR),
        quality: unwrap<IntelQualityReport>(qualityR),
        skillHealth: unwrap<{ skills: IntelSkillHealth[] }>(skillHealthR)?.skills ?? null,
        learningOverview: unwrap<IntelLearningOverview>(learningOverviewR),
        users: unwrap<{ users: IntelAdminUser[] }>(usersR)?.users ?? null,
      },
    });
  }, [getToken, days]);

  useEffect(() => { void load(); }, [load]);

  const inspectLearner = useCallback(async (userId: string) => {
    setSelectedLearnerId(userId);
    setLearnerDetail(null);
    setLearnerDetailLoading(true);
    const token = await getToken();
    const result = await api<IntelLearnerDetail>(`/admin/intel/learning/learners/${userId}?days=${days}&limit=100`, { token });
    setLearnerDetail(result.error ? null : result.data);
    setLearnerDetailLoading(false);
  }, [days, getToken]);

  const nf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const pf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 }), [i18n.resolvedLanguage]);
  const pdf = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }), [i18n.resolvedLanguage]);

  if (state.status === 'loading') return <LoadingOverlay />;

  return (
    <AdminPage titleKey="admin.intel.title" subtitleKey="admin.intel.subtitle">
      <div className="flex flex-col gap-3 rounded-md border border-outline/70 bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="lf-caption text-content-muted">{t('admin.intel.filters.period')}</span>
            <IntelPeriodPicker selection={selection} onChange={setSelection} />
          </label>
          <IntelExportCard selection={selection} />
        </div>
        <StaffExclusionNote windowQuery={windowQuery} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto bg-surface-sunken p-1 rounded-md border border-outline/30">
        {TABS_WITH_ICONS.map(({ key: k, icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'flex items-center gap-1.5 min-h-11 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-150',
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
          {tab === 'learning' && <LearningTab data={state.data} t={t} nf={nf} pf={pf} onInspectLearner={inspectLearner} />}
          {tab === 'retention' && <RetentionTab data={state.data} t={t} pf={pdf} />}
          {tab === 'people' && <PeopleTab data={state.data} t={t} pf={pf} />}
          {tab === 'experiments' && <ExperimentsTab data={state.data} t={t} />}
          {tab === 'alerts' && <AlertsTab data={state.data} t={t} />}
          {selectedLearnerId ? <LearnerDetailDialog detail={learnerDetail} loading={learnerDetailLoading} learner={state.data.users?.find((user) => user.userId === selectedLearnerId)} onClose={() => { setSelectedLearnerId(null); setLearnerDetail(null); }} t={t} nf={nf} pf={pf} /> : null}
        </>
      )}
    </AdminPage>
  );
}

export default AdminIntelPage;
