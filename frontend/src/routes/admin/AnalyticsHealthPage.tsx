import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import {
  Badge,
  Card,
  Dropdown,
  Icon,
  StatCard,
  Table,
  TrendChart,
  type DropdownOption,
  type TableColumn,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminPage, useAdminData } from './adminShared';
import {
  BREAKDOWN_CARDS,
  PERIODS,
  filtersToQuery,
  type AnalyticsFilter,
  type BehaviorData,
  type DimensionKey,
  type HealthData,
  type OverviewData,
  type Period,
} from './analytics/analyticsShared';
import { FilterBar } from './analytics/FilterBar';
import { BreakdownCard } from './analytics/BreakdownCard';
import { ReportExportCard } from './analytics/ReportExportCard';
import { ExclusionsCard } from './analytics/ExclusionsCard';

function UnavailableCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center shadow-glass border border-outline/50">
      <Icon name="cloud_off" className="!text-[40px] text-content-faint" />
      <p className="lf-label text-content font-bold">{title}</p>
      <p className="lf-caption max-w-sm text-content-muted">{body}</p>
    </Card>
  );
}

export function AnalyticsHealthPage() {
  const { t, i18n } = useTranslation();
  const { roles } = useAuth();
  const isSuperadmin = roles.includes('superadmin');

  const [period, setPeriod] = useState<Period>('30d');
  const [filters, setFilters] = useState<AnalyticsFilter[]>([]);
  const filterQuery = filtersToQuery(filters);

  const addFilter = useCallback((dimension: DimensionKey, value: string) => {
    setFilters((fs) =>
      fs.some((f) => f.dimension === dimension && f.value === value) ? fs : [...fs, { dimension, value }],
    );
  }, []);
  const removeFilter = useCallback((index: number) => {
    setFilters((fs) => fs.filter((_, i) => i !== index));
  }, []);

  const { data: overview, reload: reloadOverview } = useAdminData<OverviewData>(`/admin/analytics/overview?period=${period}${filterQuery}`);
  const { data: behavior, reload: reloadBehavior } = useAdminData<BehaviorData>(`/admin/analytics/behavior?period=${period}`);
  const { data: health, reload: reloadHealth } = useAdminData<HealthData>('/admin/health/services');

  const handleRefresh = useCallback(() => {
    void Promise.all([reloadOverview(), reloadBehavior(), reloadHealth()]);
  }, [reloadOverview, reloadBehavior, reloadHealth]);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const nfCompact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const secondsFmt = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
  };

  const periodOptions: DropdownOption<Period>[] = PERIODS.map((p) => ({
    value: p,
    label: t(`admin.analytics.periods.${p}`),
  }));

  // Health summary metrics
  const healthMetrics = useMemo(() => {
    if (health.state !== 'ready') return null;
    const monitors = health.data.monitors;
    const totalMonitors = monitors.length;
    const pings = monitors.map((m) => m.pingMs).filter((p): p is number => p !== null);
    const avgPing = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null;
    const uptimes = monitors.map((m) => m.uptime24h).filter((u): u is number => u !== null);
    const avgUptime = uptimes.length > 0 ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : null;

    return { totalMonitors, avgPing, avgUptime };
  }, [health]);

  const healthColumns: TableColumn<HealthData['monitors'][number]>[] = [
    { key: 'name', header: t('admin.health.columns.service'), cell: (m) => <span className="font-bold">{m.name}</span>, primary: true },
    {
      key: 'status',
      header: t('admin.health.columns.status'),
      cell: (m) =>
        m.status === 1 ? (
          <Badge className="bg-success-soft text-success-strong">{t('admin.health.up')}</Badge>
        ) : (
          <Badge className="bg-error-soft text-error-strong">{t('admin.health.down')}</Badge>
        ),
    },
    {
      key: 'ping',
      header: t('admin.health.columns.latency'),
      numeric: true,
      cell: (m) => {
        if (m.pingMs === null) return null;
        const latencyTone =
          m.pingMs < 100
            ? 'bg-success-soft text-success-strong'
            : m.pingMs <= 300
            ? 'bg-warning-soft text-warning-strong'
            : 'bg-error-soft text-error-strong';
        return (
          <Badge className={cn('font-mono text-xs', latencyTone)}>
            {nf.format(m.pingMs)} ms
          </Badge>
        );
      },
    },
    {
      key: 'uptime',
      header: t('admin.health.columns.uptime24h'),
      numeric: true,
      cell: (m) => (m.uptime24h === null ? null : <span className="font-mono text-xs">{pct.format(m.uptime24h)}</span>),
    },
  ];

  return (
    <AdminPage
      titleKey="admin.analytics.title"
      subtitleKey="admin.analytics.subtitle"
      actions={
        <div className="flex items-center gap-2">
          <AdminAction tone="neutral" icon="refresh" onClick={handleRefresh}>
            {t('admin.health.refreshTelemetry')}
          </AdminAction>
          <Dropdown
            value={period}
            options={periodOptions}
            onChange={setPeriod}
            ariaLabel={t('admin.analytics.periodLabel') ?? 'Period'}
          />
        </div>
      }
    >
      {/* ── Health KPI Summary Cards ── */}
      {healthMetrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            icon={<Icon name="dns" className="!text-[24px]" />}
            value={healthMetrics.totalMonitors.toString()}
            label={t('admin.health.monitoredServices')}
            tone="primary"
          />
          <StatCard
            icon={<Icon name="speed" className="!text-[24px]" />}
            value={healthMetrics.avgPing !== null ? `${nf.format(healthMetrics.avgPing)} ms` : '—'}
            label={t('admin.health.avgLatency')}
            tone={healthMetrics.avgPing !== null && healthMetrics.avgPing <= 150 ? 'secondary' : 'accent'}
          />
          <StatCard
            icon={<Icon name="health_and_safety" className="!text-[24px]" />}
            value={healthMetrics.avgUptime !== null ? pct.format(healthMetrics.avgUptime) : '—'}
            label={t('admin.health.avgUptime')}
            tone="primary"
          />
        </div>
      )}

      {/* ── Segment filters ── */}
      <FilterBar filters={filters} onAdd={addFilter} onRemove={removeFilter} />

      {/* ── Web analytics (Plausible) ─────────────────── */}
      <section aria-labelledby="admin-web-analytics" className="flex flex-col gap-4">
        <h2 id="admin-web-analytics" className="lf-headline font-bold text-content">
          {t('admin.analytics.web.title')}
        </h2>

        {overview.state === 'error' ? (
          <UnavailableCard
            title={t('admin.analytics.unavailableTitle')}
            body={t(`errors.api.${overview.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard
                dense
                className="shadow-glass border border-outline/50"
                icon={<Icon name="group" />}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.visitors) : '…'}
                label={t('admin.analytics.web.visitors')}
              />
              <StatCard
                dense
                className="shadow-glass border border-outline/50"
                icon={<Icon name="visibility" />}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.pageviews) : '…'}
                label={t('admin.analytics.web.pageviews')}
              />
              <StatCard
                dense
                className="shadow-glass border border-outline/50"
                icon={<Icon name="reply" />}
                value={overview.state === 'ready' ? pct.format(overview.data.aggregate.bounce_rate / 100) : '…'}
                label={t('admin.analytics.web.bounceRate')}
              />
              <StatCard
                dense
                icon={<Icon name="timer" />}
                value={overview.state === 'ready' ? secondsFmt(overview.data.aggregate.visit_duration) : '…'}
                label={t('admin.analytics.web.visitDuration')}
                className="col-span-2 md:col-span-3 lg:col-span-3 shadow-glass border border-outline/50"
              />
            </div>

            <Card className="p-5 shadow-glass border border-outline/50">
              <p className="lf-label text-content-muted font-bold">{t('admin.analytics.web.trend')}</p>
              {overview.state === 'ready' && overview.data.timeseries.length > 0 ? (
                <TrendChart
                  className="mt-3"
                  ariaLabel={t('admin.analytics.web.trendAria')}
                  points={overview.data.timeseries.map((d) => ({ label: d.date, value: d.visitors }))}
                />
              ) : (
                <p className="lf-caption mt-3 text-content-faint">{t('admin.analytics.web.trendEmpty')}</p>
              )}
            </Card>
          </>
        )}
      </section>

      {/* ── Behavioral (Umami) ── */}
      <section aria-labelledby="admin-behavior" className="flex flex-col gap-4">
        <h2 id="admin-behavior" className="lf-headline font-bold text-content">
          {t('admin.analytics.behavior.title')}
        </h2>
        <p className="lf-caption -mt-2 text-content-faint">{t('admin.analytics.behavior.scopeNote')}</p>
        {behavior.state === 'error' ? (
          <UnavailableCard
            title={t('admin.analytics.unavailableTitle')}
            body={t(`errors.api.${behavior.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              dense
              icon={<Icon name="ads_click" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.pageviews) : '…'}
              label={t('admin.analytics.behavior.pageviews')}
              tone="accent"
              className="shadow-glass border border-outline/50"
            />
            <StatCard
              dense
              icon={<Icon name="person" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.visitors) : '…'}
              label={t('admin.analytics.behavior.visitors')}
              tone="accent"
              className="shadow-glass border border-outline/50"
            />
            <StatCard
              dense
              icon={<Icon name="route" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.visits) : '…'}
              label={t('admin.analytics.behavior.visits')}
              tone="accent"
              className="shadow-glass border border-outline/50"
            />
            <StatCard
              dense
              icon={<Icon name="door_open" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.bounces) : '…'}
              label={t('admin.analytics.behavior.bounces')}
              tone="accent"
              className="col-span-2 md:col-span-3 lg:col-span-3 shadow-glass border border-outline/50"
            />
          </div>
        )}
      </section>

      {/* ── Breakdowns ── */}
      <section aria-labelledby="admin-breakdowns" className="flex flex-col gap-4">
        <h2 id="admin-breakdowns" className="lf-headline font-bold text-content">
          {t('admin.analytics.breakdowns.title')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BREAKDOWN_CARDS.map((c) => (
            <BreakdownCard
              key={c.dimension}
              dimension={c.dimension}
              icon={c.icon}
              period={period}
              filterQuery={filterQuery}
              onFilter={addFilter}
            />
          ))}
        </div>
      </section>

      {/* ── Exports & controls ── */}
      <section aria-labelledby="admin-analytics-tools" className="flex flex-col gap-4">
        <h2 id="admin-analytics-tools" className="lf-headline font-bold text-content">
          {t('admin.analytics.toolsTitle')}
        </h2>
        <div className={cn('grid gap-4', isSuperadmin && 'lg:grid-cols-2')}>
          <ReportExportCard period={period} filterQuery={filterQuery} />
          {isSuperadmin && <ExclusionsCard />}
        </div>
      </section>

      {/* ── System health (Uptime Kuma) ───────────────── */}
      <section aria-labelledby="admin-health" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 id="admin-health" className="lf-headline font-bold text-content">
            {t('admin.health.title')}
          </h2>
          {health.state === 'ready' &&
            (health.data.summary.down === 0 ? (
              <Badge className="bg-success-soft text-success-strong">{t('admin.health.allUp')}</Badge>
            ) : (
              <Badge className="bg-error-soft text-error-strong">
                {t('admin.health.someDown', { count: health.data.summary.down })}
              </Badge>
            ))}
        </div>
        {health.state === 'error' ? (
          <UnavailableCard
            title={t('admin.health.unavailableTitle')}
            body={t(`errors.api.${health.code}`, { defaultValue: t('admin.health.unavailableBody') })}
          />
        ) : health.state === 'ready' ? (
          <Table columns={healthColumns} rows={health.data.monitors} rowKey={(m) => m.id} />
        ) : (
          <Card className="py-10 text-center shadow-glass border border-outline/50">
            <p className="lf-caption text-content-faint">{t('admin.health.loading')}</p>
          </Card>
        )}
      </section>
    </AdminPage>
  );
}
