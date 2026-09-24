import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, SectionHeading, StatCard, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthContext';
import { AdminAction, AdminPage, useAdminData } from './adminShared';
import {
  BEHAVIOR_CARDS,
  BREAKDOWN_CARDS,
  filtersToQuery,
  isCompleteSelection,
  periodQuery as buildPeriodQuery,
  daysForSelection,
  SECONDARY_BREAKDOWN_CARDS,
  type AnalyticsFilter,
  type BehaviorData,
  type BehaviorSeriesData,
  type DimensionKey,
  type HealthData,
  type OverviewData,
  type PeriodSelection,
} from './analytics/analyticsShared';
import { FilterBar } from './analytics/FilterBar';
import { BreakdownCard } from './analytics/BreakdownCard';
import { BehaviorBreakdownCard } from './analytics/BehaviorBreakdownCard';
import { BehaviorTrendChart } from './analytics/BehaviorTrendChart';
import { ReportExportCard } from './analytics/ReportExportCard';
import { ExclusionsCard } from './analytics/ExclusionsCard';
import { ExclusionCoverageNote } from './analytics/ExclusionCoverageNote';
import { PeriodPicker } from './analytics/PeriodPicker';
import { AudienceSection } from './analytics/AudienceSection';
import { ProductUsageSection } from './analytics/ProductUsageSection';
import { AnalyticsGeoMap } from './analytics/AnalyticsGeoMap';
import { AnalyticsTrendChart } from './analytics/AnalyticsTrendChart';

function UnavailableCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center shadow-glass border border-outline/50">
      {/* Same tile, same hue, as `Unavailable` in adminShared — one failure
          state should not look like two different ones across the console. */}
      <span className="lf-tile h-14 w-14 text-error-strong">
        <Icon name="cloud_off" className="!text-[28px]" />
      </span>
      <p className="lf-label text-content font-bold">{title}</p>
      <p className="lf-caption max-w-sm text-content-muted">{body}</p>
    </Card>
  );
}

export function AnalyticsHealthPage() {
  const { t, i18n } = useTranslation();
  const { roles, adminPermissions } = useAuth();
  const canManageExclusions = roles.includes('superadmin') || adminPermissions.includes('manage_support');

  const [selection, setSelection] = useState<PeriodSelection>({ period: '30d' });
  const [filters, setFilters] = useState<AnalyticsFilter[]>([]);
  const filterQuery = filtersToQuery(filters);
  // An incomplete custom range must not be sent: it would resolve to some
  // other window and be labelled as the one the operator was still typing.
  const periodQuery = buildPeriodQuery(isCompleteSelection(selection) ? selection : { period: '30d' });

  /*
   * The first-party views take a day count rather than a preset, because they
   * read Postgres directly instead of Plausible's date_range vocabulary. ONE
   * selection still drives both, so the two halves of this page can never
   * describe different windows — a defect this console has already had once.
   */
  const audienceDays = daysForSelection(isCompleteSelection(selection) ? selection : { period: '30d' });

  const addFilter = useCallback((dimension: DimensionKey, value: string) => {
    setFilters((fs) =>
      fs.some((f) => f.dimension === dimension && f.value === value) ? fs : [...fs, { dimension, value }],
    );
  }, []);
  const removeFilter = useCallback((index: number) => {
    setFilters((fs) => fs.filter((_, i) => i !== index));
  }, []);
  /*
   * Drop every filter on one dimension, by NAME rather than by index.
   *
   * The chip list removes by index because that is what a chip knows. The map
   * cannot: it applied a country filter three sections up the page and has no
   * idea where that chip landed. Without this, the only way out of a focused
   * console was to scroll back to the filter bar and find the chip — and on a
   * phone that bar is off-screen entirely, which is why the reported symptom
   * was "you cannot get back without reloading the page".
   */
  const clearDimension = useCallback((dimension: DimensionKey) => {
    setFilters((fs) => fs.filter((f) => f.dimension !== dimension));
  }, []);

  const { data: overview, reload: reloadOverview } = useAdminData<OverviewData>(
    `/admin/analytics/overview?${periodQuery}${filterQuery}`,
  );
  const { data: behavior, reload: reloadBehavior } = useAdminData<BehaviorData>(`/admin/analytics/behavior?${periodQuery}`);
  const { data: behaviorSeries } = useAdminData<BehaviorSeriesData>(`/admin/analytics/behavior/series?${periodQuery}`);
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

      {/*
        First-party audience FIRST, and deliberately above the Plausible block.
        Plausible answers a narrower question than it appears to — anonymous,
        consented, marketing pages only — so an operator who reads it first
        forms a picture the section below then has to correct. Our own event
        stream sees every session with the role attached, which is the only
        thing that separates staff from real people retroactively.
      */}
      <AudienceSection days={audienceDays} />

      {/*
        What the product is used FOR, from three endpoints Core has served all
        along that no screen had ever opened. Kept below Audience because "who
        was here" has to be settled before "what did they do" means anything.
      */}
      <ProductUsageSection days={audienceDays} />

      {/* ── Web analytics (Plausible) ─────────────────── */}
      <section aria-labelledby="admin-web-analytics" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading icon="public" tone="accent" id="admin-web-analytics" className="mb-0 min-w-0 flex-1">
            {t('admin.analytics.web.title')}
          </SectionHeading>
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

        {/*
          A window mismatch invalidates every figure below it, so it is stated
          before them and never merged into the quiet provenance caption.

          This is normally invisible — the server sends resolved dates and
          Plausible echoes them back unchanged. It exists because for two weeks
          it was NOT invisible: the server sent the shorthand `6mo`, Plausible
          answered for February through July, and the chart padded all of
          August with zeros and reported a traffic collapse that had not
          happened (RUNBOOK, 2026-08-27). Nothing on screen could have told an
          operator that. Now something can.
        */}
        {overview.state === 'ready' && overview.data.rangeDrift && (
          <UnavailableCard
            title={t('admin.analytics.rangeDrift.title')}
            body={t('admin.analytics.rangeDrift.body', {
              asked: `${overview.data.rangeDrift.askedFor[0]} – ${overview.data.rangeDrift.askedFor[1]}`,
              answered: `${overview.data.rangeDrift.answeredFor[0]} – ${overview.data.rangeDrift.answeredFor[1]}`,
            })}
          />
        )}

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
            {/* How far the internal-traffic exclusion actually reaches. */}
            {canManageExclusions && <ExclusionCoverageNote windowStart={overview.state === 'ready' ? overview.data.from : null} />}
            {/*
              Bounce rate and visit duration are measured on natively tracked
              visits only — imported history carries no session metrics at any
              date. Two of the four KPIs above therefore describe a different
              population than the other two, which is worth one sentence rather
              than another wrong theory about when measurement started.
            */}
            {overview.state === 'ready' && !overview.data.imports.importsIncluded && (
              <p className="lf-caption -mt-1 text-content-faint">
                {t('admin.analytics.web.nativeOnlyMetrics')}
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
          <SectionHeading icon="map" tone="delight" id="admin-geography" className="mb-1">{t('admin.analytics.geo.sectionTitle')}</SectionHeading>
          <p className="lf-caption text-content-faint">{t('admin.analytics.geo.sectionSubtitle')}</p>
        </div>
        <AnalyticsGeoMap
          periodQuery={periodQuery}
          filterQuery={filterQuery}
          onFilter={addFilter}
          onClearFilter={clearDimension}
        />
      </section>

      {/* ── Behavioral (Umami) ── */}
      <section aria-labelledby="admin-behavior" className="flex flex-col gap-4">
        <SectionHeading icon="ads_click" tone="accent" id="admin-behavior" className="mb-0">
          {t('admin.analytics.behavior.title')}
        </SectionHeading>
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

          {behavior.state === 'ready' && behavior.data.outOfBoundaryPageviews !== 0 && (
            /*
             * Contamination is disclosed, not silently corrected. Umami's API
             * has no negation filter, so `pageviews` could be fixed by
             * subtraction but `visits`/`bounces` could not — correcting only
             * the summable metric would leave the card internally
             * inconsistent. `null` reads as "unknown", never as clean.
             */
            <p className="lf-caption flex items-start gap-1.5 rounded-md bg-warning-soft p-2.5 text-warning-strong">
              <Icon name="info" className="!text-[16px] shrink-0" />
              <span>
                {behavior.data.outOfBoundaryPageviews === null
                  ? t('admin.analytics.behavior.boundaryUnknown')
                  : t('admin.analytics.behavior.boundaryNote', { count: behavior.data.outOfBoundaryPageviews })}
              </span>
            </p>
          )}

          {behaviorSeries.state === 'ready' && <BehaviorTrendChart data={behaviorSeries.data.series} />}

          {/*
            * The twelve behavioural dimensions Umami actually collects. Until
            * 2026-08-14 the console read only the five aggregate numbers
            * above, so path-level behaviour, referrers, devices, languages,
            * screens and geography were gathered and never looked at.
            */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BEHAVIOR_CARDS.map((card) => (
              <BehaviorBreakdownCard
                key={card.dimension}
                dimension={card.dimension}
                icon={card.icon}
                periodQuery={periodQuery}
              />
            ))}
          </div>
          </>
        )}
      </section>

      {/* ── Breakdowns ── */}
      <section aria-labelledby="admin-breakdowns" className="flex flex-col gap-4">
        <SectionHeading icon="pie_chart" tone="delight" id="admin-breakdowns" className="mb-0">
          {t('admin.analytics.breakdowns.title')}
        </SectionHeading>
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
        <details className="group rounded-md border border-outline/50 bg-surface-sunken/20 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><span className="lf-tile h-8 w-8 text-accent"><Icon name="manage_search" className="!text-[18px]" /></span><span><span className="lf-title block">{t('admin.analytics.breakdowns.explorerTitle')}</span><span className="lf-caption text-content-muted">{t('admin.analytics.breakdowns.explorerSubtitle')}</span></span></span>
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
        <SectionHeading icon="build" tone="muted" id="admin-analytics-tools" className="mb-0">
          {t('admin.analytics.toolsTitle')}
        </SectionHeading>
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <ReportExportCard periodQuery={periodQuery} filterQuery={filterQuery} />
          {canManageExclusions && <ExclusionsCard />}
        </div>
      </section>

      {/* ── System health (Uptime Kuma) ───────────────── */}
      <section aria-labelledby="admin-health" className="flex flex-col gap-4">
        {/*
          Health is the one section on this page whose HUE is a reading rather
          than a label: success while every monitor answers, error the moment
          one stops, muted while the answer has not come back. The badge stays
          as `meta` — a status, never a control.
        */}
        <SectionHeading
          icon="monitor_heart"
          tone={health.state !== 'ready' ? 'muted' : health.data.summary.down === 0 ? 'success' : 'error'}
          id="admin-health"
          className="mb-0"
          meta={
            health.state === 'ready' ? (
              health.data.summary.down === 0 ? (
                <Badge className="bg-success-soft text-success-strong">{t('admin.health.allUp')}</Badge>
              ) : (
                <Badge className="bg-error-soft text-error-strong">
                  {t('admin.health.someDown', { count: health.data.summary.down })}
                </Badge>
              )
            ) : undefined
          }
        >
          {t('admin.health.title')}
        </SectionHeading>
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
        <span className="lf-tile h-7 w-7 text-accent"><Icon name={icon} className="!text-[16px]" /></span>
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
      <span className="lf-tile h-9 w-9 text-accent"><Icon name={icon} className="!text-[20px]" /></span>
      <div className="min-w-0"><p className="lf-caption truncate text-content-muted">{label}</p><p className={cn('lf-number mt-1', valueClassName ?? 'text-content')}>{value}</p></div>
    </Card>
  );
}
