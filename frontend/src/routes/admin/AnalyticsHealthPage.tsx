import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, StatCard, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, AdminPage, useAdminData } from './adminShared';
import {
  BREAKDOWN_CARDS,
  filtersToQuery,
  isCompleteSelection,
  periodQuery as buildPeriodQuery,
  SECONDARY_BREAKDOWN_CARDS,
  type AnalyticsFilter,
  type BehaviorData,
  type DimensionKey,
  type HealthData,
  type OverviewData,
  type PeriodSelection,
} from './analytics/analyticsShared';
import { FilterBar } from './analytics/FilterBar';
import { BreakdownCard } from './analytics/BreakdownCard';
import { ReportExportCard } from './analytics/ReportExportCard';
import { ExclusionsCard } from './analytics/ExclusionsCard';
import { PeriodPicker } from './analytics/PeriodPicker';
import { AnalyticsGeoMap } from './analytics/AnalyticsGeoMap';
import { AnalyticsTrendChart } from './analytics/AnalyticsTrendChart';

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

  const [selection, setSelection] = useState<PeriodSelection>({ period: '30d' });
  const [filters, setFilters] = useState<AnalyticsFilter[]>([]);
  const filterQuery = filtersToQuery(filters);
  // An incomplete custom range must not be sent: it would resolve to some
  // other window and be labelled as the one the operator was still typing.
  const periodQuery = buildPeriodQuery(isCompleteSelection(selection) ? selection : { period: '30d' });

  const addFilter = useCallback((dimension: DimensionKey, value: string) => {
    setFilters((fs) =>
      fs.some((f) => f.dimension === dimension && f.value === value) ? fs : [...fs, { dimension, value }],
    );
  }, []);
  const removeFilter = useCallback((index: number) => {
    setFilters((fs) => fs.filter((_, i) => i !== index));
  }, []);

  const { data: overview, reload: reloadOverview } = useAdminData<OverviewData>(
    `/admin/analytics/overview?${periodQuery}${filterQuery}`,
  );
  const { data: behavior, reload: reloadBehavior } = useAdminData<BehaviorData>(`/admin/analytics/behavior?${periodQuery}`);
  const { data: health, reload: reloadHealth } = useAdminData<HealthData>('/admin/health/services');

  const handleRefresh = useCallback(() => {
    void Promise.all([reloadOverview(), reloadBehavior(), reloadHealth()]);
  }, [reloadOverview, reloadBehavior, reloadHealth]);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const nfDecimal = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 });
  const nfCompact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const secondsFmt = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
  };

  const webSignals = useMemo(() => {
    if (overview.state !== 'ready') return null;
    const { aggregate, timeseries } = overview.data;
    const dailyVisitors = timeseries.length ? aggregate.visitors / timeseries.length : 0;
    const pagesPerVisitor = aggregate.visitors > 0 ? aggregate.pageviews / aggregate.visitors : 0;
    const first = timeseries[0]?.visitors ?? 0;
    const last = timeseries[timeseries.length - 1]?.visitors ?? 0;
    return { dailyVisitors, pagesPerVisitor, change: last - first };
  }, [overview]);

  const behaviorSignals = useMemo(() => {
    if (behavior.state !== 'ready') return null;
    const { visits, bounces, totaltime } = behavior.data;
    return {
      bounceRate: visits > 0 ? bounces / visits : 0,
      averageTime: visits > 0 ? totaltime / visits : 0,
    };
  }, [behavior]);

  /**
   * Period-over-period change per KPI. Returns null when there is no
   * comparison — all-time, or the comparison read failed. A missing
   * comparison renders as nothing at all; showing 0% would assert a flat
   * trend that was never measured.
   */
  const deltas = useMemo(() => {
    if (overview.state !== 'ready' || !overview.data.previous) return null;
    const now = overview.data.aggregate;
    const before = overview.data.previous;
    const change = (current: number, prior: number): number | null => (prior === 0 ? null : (current - prior) / prior);
    return {
      window: `${before.from} ${t('admin.analytics.rangeTo')} ${before.to}`,
      visitors: change(now.visitors, before.visitors),
      pageviews: change(now.pageviews, before.pageviews),
      bounceRate: change(now.bounce_rate, before.bounce_rate),
      visitDuration: change(now.visit_duration, before.visit_duration),
    };
  }, [overview, t]);

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
        <div className="flex flex-wrap items-start gap-2">
          <AdminAction tone="neutral" icon="refresh" onClick={handleRefresh}>
            {t('admin.health.refreshTelemetry')}
          </AdminAction>
          <PeriodPicker selection={selection} onChange={setSelection} />
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="admin-web-analytics" className="lf-headline font-bold text-content">
            {t('admin.analytics.web.title')}
          </h2>
          {/*
            The window the figures actually cover, resolved by the server.
            Restating the label the page asked for would hide the difference
            between "this month" and the eleven days it currently contains.
          */}
          {overview.state === 'ready' && (
            <span className="lf-caption rounded-full border border-outline/50 px-3 py-1 text-content-muted">
              {overview.data.from} {t('admin.analytics.rangeTo')} {overview.data.to}
            </span>
          )}
        </div>

        {overview.state === 'error' ? (
          <UnavailableCard
            title={t('admin.analytics.unavailableTitle')}
            body={t(`errors.api.${overview.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <KpiCard
                icon="group"
                label={t('admin.analytics.web.visitors')}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.visitors) : '…'}
                change={deltas?.visitors ?? null}
                higherIsBetter
              />
              <KpiCard
                icon="visibility"
                label={t('admin.analytics.web.pageviews')}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.pageviews) : '…'}
                change={deltas?.pageviews ?? null}
                higherIsBetter
              />
              <KpiCard
                icon="reply"
                label={t('admin.analytics.web.bounceRate')}
                value={overview.state === 'ready' ? pct.format(overview.data.aggregate.bounce_rate / 100) : '…'}
                change={deltas?.bounceRate ?? null}
                higherIsBetter={false}
              />
              <KpiCard
                icon="timer"
                label={t('admin.analytics.web.visitDuration')}
                value={overview.state === 'ready' ? secondsFmt(overview.data.aggregate.visit_duration) : '…'}
                change={deltas?.visitDuration ?? null}
                higherIsBetter
              />
            </div>
            {deltas && (
              <p className="lf-caption -mt-1 text-content-faint">
                {t('admin.analytics.web.comparedWith', { window: deltas.window })}
              </p>
            )}
            {webSignals && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={t('admin.analytics.web.signalsAria')}>
                <SignalCard icon="today" label={t('admin.analytics.web.dailyAverage')} value={nf.format(Math.round(webSignals.dailyVisitors))} />
                <SignalCard icon="layers" label={t('admin.analytics.web.pagesPerVisitor')} value={nfDecimal.format(webSignals.pagesPerVisitor)} />
                <SignalCard icon="trending_up" label={t('admin.analytics.web.chartChange')} value={`${webSignals.change >= 0 ? '+' : ''}${nf.format(webSignals.change)}`} valueClassName={webSignals.change >= 0 ? 'text-success' : 'text-error'} />
              </div>
            )}
            {overview.state === 'ready' ? <AnalyticsTrendChart data={overview.data.timeseries} /> : <Card className="flex min-h-64 items-center justify-center"><p className="lf-caption text-content-faint">{t('admin.loading')}</p></Card>}
          </>
        )}
      </section>

      {/* ── Geography and audience composition ── */}
      <section aria-labelledby="admin-geography" className="flex flex-col gap-4">
        <div>
          <h2 id="admin-geography" className="lf-headline font-bold text-content">{t('admin.analytics.geo.sectionTitle')}</h2>
          <p className="lf-caption mt-1 text-content-faint">{t('admin.analytics.geo.sectionSubtitle')}</p>
        </div>
        <AnalyticsGeoMap periodQuery={periodQuery} filterQuery={filterQuery} onFilter={addFilter} />
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
          <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
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
              className="shadow-glass border border-outline/50"
            />
          </div>
          {behaviorSignals && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={t('admin.analytics.behavior.signalsAria')}>
              <SignalCard icon="speed" label={t('admin.analytics.behavior.averageTime')} value={secondsFmt(behaviorSignals.averageTime)} />
              <SignalCard icon="donut_large" label={t('admin.analytics.behavior.bounceRate')} value={pct.format(behaviorSignals.bounceRate)} />
            </div>
          )}
          </>
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
              periodQuery={periodQuery}
              filterQuery={filterQuery}
              onFilter={addFilter}
            />
          ))}
        </div>
        <details className="group rounded-lg border border-outline/50 bg-surface-sunken/20 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Icon name="manage_search" className="!text-[21px] text-primary" /><span><span className="lf-title block">{t('admin.analytics.breakdowns.explorerTitle')}</span><span className="lf-caption text-content-muted">{t('admin.analytics.breakdowns.explorerSubtitle')}</span></span></span>
            <Icon name="expand_more" className="!text-[22px] text-content-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECONDARY_BREAKDOWN_CARDS.map((c) => (
              <BreakdownCard key={c.dimension} dimension={c.dimension} icon={c.icon} periodQuery={periodQuery} filterQuery={filterQuery} onFilter={addFilter} />
            ))}
          </div>
        </details>
      </section>

      {/* ── Exports & controls ── */}
      <section aria-labelledby="admin-analytics-tools" className="flex flex-col gap-4">
        <h2 id="admin-analytics-tools" className="lf-headline font-bold text-content">
          {t('admin.analytics.toolsTitle')}
        </h2>
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <ReportExportCard periodQuery={periodQuery} filterQuery={filterQuery} />
          <ExclusionsCard />
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

/**
 * A KPI with its period-over-period movement. Direction is coloured by
 * whether the movement is GOOD, not by its sign: a bounce rate falling 20% is
 * a win and must not read as a loss.
 */
function KpiCard({
  icon,
  label,
  value,
  change,
  higherIsBetter,
}: {
  icon: string;
  label: string;
  value: string;
  change: number | null;
  higherIsBetter: boolean;
}) {
  const { i18n } = useTranslation();
  const signed = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  const good = change !== null && change >= 0 === higherIsBetter;
  return (
    <Card className="flex flex-col gap-2 border border-outline/50 p-4 shadow-glass">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="!text-[20px] text-primary" />
        <p className="lf-caption truncate text-content-muted">{label}</p>
      </div>
      <p className="lf-number text-2xl text-content">{value}</p>
      {change !== null && (
        <p className={cn('lf-caption flex items-center gap-1 font-bold', good ? 'text-success-strong' : 'text-error-strong')}>
          <Icon name={change >= 0 ? 'trending_up' : 'trending_down'} className="!text-[16px]" />
          {signed.format(change)}
        </p>
      )}
    </Card>
  );
}

function SignalCard({ icon, label, value, valueClassName }: { icon: string; label: string; value: string; valueClassName?: string }) {
  return (
    <Card className="flex items-center gap-3 border border-outline/40 p-4">
      <Icon name={icon} className="!text-[22px] text-primary" />
      <div className="min-w-0"><p className="lf-caption truncate text-content-muted">{label}</p><p className={cn('lf-number mt-1', valueClassName ?? 'text-content')}>{value}</p></div>
    </Card>
  );
}
