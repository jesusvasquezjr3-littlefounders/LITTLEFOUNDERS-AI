import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  BarChart, Button, Card, Chip, DashboardLayout, DataTable, EmptyState, InlineNotice, SegmentedControl, SelectField, Switch, TextField, TrendChart,
  type TableColumn,
} from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import {
  ANALYTICS_VIEWS, BEHAVIOR_DIMENSIONS, daysForSelection, EXCLUSIONS_PATH, isAcquisitionDetail, isActivity, isAdoption, isAudience,
  isBehavior, isBehaviorBreakdown, isBehaviorSeries, isExclusions, isFunnelIntegrityDetail, isHealthDetail, isSessionDepth, NETWORK, PERIODS,
  periodQuery, REPORT_AUDIENCES, REPORT_FORMATS, REPORT_ROWS, reportPath, countryLabel,
  type AcquisitionRow, type AnalyticsView, type BehaviorDimension, type Monitor, type Period, type PeriodSelection, type ReportAudience, type ReportFormat,
  type SegmentFilter,
} from './analyticsApi';
import { bandOf, INSTRUMENTED_EVENTS } from './usageShared';
import { can, useStaffRead, type StaffApi, type StaffViewer } from './staffConsoleApi';
import { Facts, LoadFailure, Loading, Metrics, RangeSheet, saveDownload, StaffPage, today, useChartLabels, useDay, useDuration, useFormats } from './ConsoleParts';
import { StaffWeb } from './StaffWeb';
import { TrustMetricsView } from './StaffProgramme';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';

/*
 * S5 Analytics & Health (view_analytics), W2T.3. One window (a Plausible
 * preset or a custom range) drives every read on the page, so no two blocks
 * can describe different periods; the first-party views receive the same
 * window as a day count. Five views, each reading only its own data:
 *
 *   Audience   our own event stream: who was here (anonymous, registered,
 *              staff), whether the signup funnel can be trusted, anonymous
 *              visitors and whether they signed up, what the product is used
 *              for, which instrumented events never fired.
 *   Web        Plausible (anonymous, consented, marketing pages): the four
 *              headline figures with their change, the trend, the map, the
 *              breakdowns, and the segment filters that focus all of them.
 *   Behaviour  Umami (marketing and signed-in adult pages; never a child's).
 *   Health     every monitored service, up or down, latency and uptime.
 *   Tools      report files (PDF, XLSX, CSV) and internal-traffic exclusions
 *              (the exclusions need manage_support; Core checks it too).
 *
 * Every figure is written as text; a chart repeats it and has Show as table.
 * H.1: the consent gate acts where events are recorded, so every count here is
 * already gated; this page reads no transcript and no wallet (G.6).
 */

export interface DeviceOptOut { optedOut: () => boolean; set: (on: boolean) => void }

/* ------------------------------------------------------------------------- */
/*  The window                                                               */
/* ------------------------------------------------------------------------- */

function WindowControl({ selection, onChange }: { selection: PeriodSelection; onChange: (selection: PeriodSelection) => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.analytics;
  const [ranging, setRanging] = useState(false);
  const initial = useMemo(() => ({ from: selection.from ?? today(), to: selection.to ?? today() }), [selection.from, selection.to]);
  return <div className="lf-staff-window">
    <SelectField label={t.body.period} value={selection.period} onChange={(event) => {
      const value = event.target.value as Period;
      if (value === 'custom') setRanging(true);
      else onChange({ period: value });
    }} options={[...PERIODS.map((period) => ({ value: period, label: t.option[`period_${period}`] })), { value: 'custom', label: t.option.period_custom }]} />
    {selection.period === 'custom' && selection.from && selection.to ? <div className="lf-staff-result-row">
      <p data-copy-role="data">{fill(copy.common.body.range, { from: format.calendar(selection.from), to: format.calendar(selection.to) })}</p>
      <Button size="sm" onClick={() => setRanging(true)}>{copy.common.action.change}</Button>
    </div> : null}
    <RangeSheet open={ranging} initial={initial} onClose={() => setRanging(false)}
      onApply={(range) => { setRanging(false); onChange({ period: 'custom', ...range }); }} />
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Audience                                                                  */
/* ------------------------------------------------------------------------- */

function AcquisitionBars({ label, rows }: { label: string; rows: readonly AcquisitionRow[] }) {
  const { copy, locale } = useConsoleCopy();
  const nf = new Intl.NumberFormat(locale);
  if (!rows.length) return null;
  return <div className="lf-staff-stack">
    <h3 data-copy-role="heading" className="lf-staff-subheading">{label}</h3>
    <BarChart label={label} rows={rows.slice(0, 6).map((row) => ({
      id: row.label, label: row.label, value: row.visitors, ugc: true,
      valueText: row.converted > 0 ? fill(copy.analytics.body.visitorsConverted, { n: nf.format(row.visitors), converted: nf.format(row.converted) }) : nf.format(row.visitors),
    }))} />
  </div>;
}

function AudienceView({ api, days }: { api: StaffApi; days: number }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.analytics;
  const [withStaff, setWithStaff] = useState(true);
  const audience = useStaffRead(api, `/admin/insights/audience?days=${days}`, isAudience);
  const integrity = useStaffRead(api, `/admin/insights/funnel-integrity?days=${days}`, isFunnelIntegrityDetail);
  const acquisition = useStaffRead(api, `/admin/insights/acquisition?days=${days}`, isAcquisitionDetail);
  const activity = useStaffRead(api, `/admin/insights/activity?days=${days}`, isActivity);
  const adoption = useStaffRead(api, '/admin/insights/adoption', isAdoption);
  const sessions = useStaffRead(api, `/admin/insights/sessions?days=${Math.min(days, 90)}&limit=1000`, isSessionDepth);
  const share = (value: number | null) => (value === null ? t.body.noData : format.percent(value));

  const surfaces = useMemo(() => {
    if (activity.load.state !== 'ready') return [];
    const by = new Map<string, { events: number; sessions: number }>();
    for (const row of activity.load.data.entries) {
      // A heartbeat carries no surface by design; counting it as one would make the biggest bar mean nothing.
      if (!row.route_class) continue;
      const entry = by.get(row.route_class) ?? { events: 0, sessions: 0 };
      entry.events += row.events;
      entry.sessions += row.sessions;
      by.set(row.route_class, entry);
    }
    return [...by].sort((a, b) => b[1].events - a[1].events);
  }, [activity.load]);
  const events = useMemo(() => {
    if (activity.load.state !== 'ready') return null;
    const seen = new Map<string, number>();
    for (const row of activity.load.data.entries) seen.set(row.event, (seen.get(row.event) ?? 0) + row.events);
    return {
      firing: INSTRUMENTED_EVENTS.filter((event) => (seen.get(event) ?? 0) > 0).map((event) => ({ event, count: seen.get(event)! })).sort((a, b) => b.count - a.count),
      silent: INSTRUMENTED_EVENTS.filter((event) => (seen.get(event) ?? 0) === 0),
    };
  }, [activity.load]);
  const depth = useMemo(() => {
    if (sessions.load.state !== 'ready') return null;
    const rows = sessions.load.data.entries.filter((row) => bandOf(row.role) !== 'staff');
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.events - b.events);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!.events;
    return { count: rows.length, median: at(0.5), p90: at(0.9), multi: rows.filter((row) => row.surfaces > 1).length / rows.length };
  }, [sessions.load]);
  const surfaceName = (value: string) => labelOf(t.option as Record<string, string>, `surface_${value}`).replace(/^surface_/, '');

  // A refusal is about the viewer, not one read: the grant was withdrawn, so every card would say the same thing
  // with its own accent retry. One failure for the view, and its retry asks again for every read.
  const reads = [audience, integrity, acquisition, activity, adoption, sessions];
  if (reads.some((read) => read.load.state === 'error' && read.load.code === 'FORBIDDEN')) {
    return <LoadFailure code="FORBIDDEN" onRetry={() => { for (const read of reads) read.reload(); }} />;
  }

  const who =audience.load.state === 'ready' ? audience.load.data : null;
  const bands = ['anonymous', 'registered', ...(withStaff ? ['staff'] as const : [])] as const;
  const primary = <>
    <Card heading={t.heading.audience}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.audienceSource}</p>
      {audience.load.state === 'loading' ? <Loading />
        : audience.load.state === 'error' ? <LoadFailure code={audience.load.code} onRetry={audience.reload} />
          : who ? <>
            <Metrics label={t.heading.audience} items={[
              { id: 'anonymous', label: t.body.band_anonymous, value: format.number(who.totals.anonymous) },
              { id: 'registered', label: t.body.band_registered, value: format.number(who.totals.registered) },
              { id: 'staff', label: t.body.band_staff, value: format.number(who.totals.staff) },
              { id: 'external', label: t.body.externalShare, value: share(who.externalShare) },
            ]} />
            <Switch label={t.body.includeStaff} checked={withStaff} onCheckedChange={setWithStaff} stateLabels={{ on: copy.common.option.on, off: copy.common.option.off }}
              help={withStaff ? undefined : t.body.staffHidden} />
            <TrendChart kind="columns" stacked label={t.body.audienceChart}
              summary={fill(t.body.audienceSummary, { share: share(who.externalShare) })}
              points={who.series.map((point) => ({ key: point.date, label: day(point.date) }))}
              series={bands.map((band) => ({ id: band, label: t.body[`band_${band}`], values: who.series.map((point) => point[band]) }))}
              format={format.number} labels={labels} />
          </> : null}
    </Card>
    <Card heading={t.heading.acquisition}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.acquisitionSource}</p>
      {acquisition.load.state === 'loading' ? <Loading />
        : acquisition.load.state === 'error' ? <LoadFailure code={acquisition.load.code} onRetry={acquisition.reload} />
          : acquisition.load.state === 'ready' ? <>
            <Metrics label={t.heading.acquisition} items={[
              { id: 'visitors', label: t.body.visitors, value: format.number(acquisition.load.data.visitors) },
              { id: 'converted', label: t.body.converted, value: format.number(acquisition.load.data.converted) },
              { id: 'conversion', label: t.body.conversion, value: share(acquisition.load.data.conversionRate) },
            ]} />
            {acquisition.load.data.visitors === 0 ? <p data-copy-role="body">{t.body.noVisitors}</p> : <div className="lf-staff-quad">
              <AcquisitionBars label={t.body.byLanding} rows={acquisition.load.data.byLandingRoute} />
              <AcquisitionBars label={t.body.byReferrer} rows={acquisition.load.data.byReferrer} />
              <AcquisitionBars label={t.body.byDevice} rows={acquisition.load.data.byDevice} />
              <AcquisitionBars label={t.body.byLanguage} rows={acquisition.load.data.byLocale} />
            </div>}
            {acquisition.load.data.noCampaignsTagged ? <InlineNotice tone="info">{t.body.noCampaigns}</InlineNotice> : null}
          </> : null}
    </Card>
    <Card heading={t.heading.usage}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.usageSource}</p>
      {activity.load.state === 'loading' ? <Loading />
        : activity.load.state === 'error' ? <LoadFailure code={activity.load.code} onRetry={activity.reload} />
          : surfaces.length === 0 ? <p data-copy-role="body">{t.body.noSurfaces}</p>
            : <BarChart label={t.heading.usage} rows={surfaces.map(([surface, counts]) => ({
              id: surface, label: surfaceName(surface), value: counts.events,
              valueText: fill(t.body.surfaceCounts, { events: format.number(counts.events), sessions: format.number(counts.sessions) }),
            }))} />}
      <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.depth}</h3>
      {sessions.load.state === 'loading' ? <Loading />
        : sessions.load.state === 'error' ? <LoadFailure code={sessions.load.code} onRetry={sessions.reload} />
          : depth === null ? <p data-copy-role="body">{t.body.noDepth}</p> : <>
            <Facts items={[
              { id: 'median', label: t.body.medianEvents, value: format.number(depth.median) },
              { id: 'p90', label: t.body.p90Events, value: format.number(depth.p90) },
              { id: 'multi', label: t.body.multiSurface, value: format.percent(depth.multi) },
            ]} />
            <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.depthNote, { n: format.number(depth.count) })}</p>
          </>}
    </Card>
  </>;

  const secondary = <>
    <Card heading={t.heading.integrity}>
      {integrity.load.state === 'loading' ? <Loading />
        : integrity.load.state === 'error' ? <LoadFailure code={integrity.load.code} onRetry={integrity.reload} />
          : integrity.load.state === 'ready' ? <>
            <Facts items={[
              { id: 'created', label: t.body.accountsCreated, value: format.number(integrity.load.data.accountsCreated) },
              { id: 'observed', label: t.body.signupObserved, value: format.number(integrity.load.data.signupComplete) },
              { id: 'share', label: t.body.observedShare, value: share(integrity.load.data.observedShare) },
            ]} />
            {integrity.load.data.unobserved > 0
              ? <InlineNotice tone="error">{fill(t.body.integrityGap, { n: format.number(integrity.load.data.unobserved) })}</InlineNotice>
              : <InlineNotice tone="success">{t.body.integrityClean}</InlineNotice>}
          </> : null}
    </Card>
    <Card heading={t.heading.instrumentation}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.instrumentationIntro}</p>
      {activity.load.state === 'loading' ? <Loading />
        : events === null ? null : <>
          {events.silent.length ? <InlineNotice tone="info">{fill(t.body.silentCount, { n: format.number(events.silent.length) })}</InlineNotice>
            : <InlineNotice tone="success">{t.body.allFiring}</InlineNotice>}
          {events.silent.length ? <>
            <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.silent}</h3>
            <ul className="lf-staff-codes" aria-label={t.body.silent}>{events.silent.map((event) => <li key={event} data-copy-role="data">{event}</li>)}</ul>
          </> : null}
          <h3 data-copy-role="heading" className="lf-staff-subheading">{t.body.firing}</h3>
          <ul className="lf-staff-codes" aria-label={t.body.firing}>
            {events.firing.map((entry) => <li key={entry.event} data-copy-role="data">{`${entry.event} · ${format.number(entry.count)}`}</li>)}
          </ul>
        </>}
    </Card>
  </>;
  return <>
    <DashboardLayout primary={primary} secondary={secondary} />
    {adoption.load.state === 'error' ? <LoadFailure code={adoption.load.code} onRetry={adoption.reload} />
      : adoption.load.state === 'ready' && adoption.load.data.entries.some((row) => row.route_class) ? <DataTable caption={t.heading.adoption}
        rows={adoption.load.data.entries.filter((row) => row.route_class)} rowKey={(row) => `${row.role}:${row.route_class}`}
        columns={[
          { key: 'role', label: t.body.role, value: (row) => labelOf(copy.roleNames.option, row.role) },
          { key: 'surface', label: t.body.surface, value: (row) => surfaceName(row.route_class ?? '') },
          { key: 'people', label: t.body.people, value: (row) => format.number(row.users) },
          { key: 'sessions', label: t.body.sessions, value: (row) => format.number(row.sessions) },
        ]} /> : null}
  </>;
}

/* ------------------------------------------------------------------------- */
/*  Behaviour                                                                 */
/* ------------------------------------------------------------------------- */

function behaviorLabel(dimension: BehaviorDimension, raw: string, locale: Locale, copy: ConsoleCopy): string {
  // Umami reports "not recorded" as an empty value; the row is kept (the column must still add up) and named.
  if (raw === '') return copy.analytics.body.notRecorded;
  if (dimension === 'country') return countryLabel(raw, locale);
  if (dimension === 'language') {
    try { return new Intl.DisplayNames([locale], { type: 'language' }).of(raw) ?? raw; } catch { return raw; }
  }
  if (dimension === 'region') {
    const [country, sub] = raw.split('-');
    return country && sub ? `${sub} · ${countryLabel(country, locale)}` : raw;
  }
  return raw;
}

function BehaviorView({ api, period }: { api: StaffApi; period: string }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const duration = useDuration(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.analytics;
  const [dimension, setDimension] = useState<BehaviorDimension>('path');
  const totals = useStaffRead(api, `/admin/analytics/behavior?${period}`, isBehavior);
  const series = useStaffRead(api, `/admin/analytics/behavior/series?${period}`, isBehaviorSeries);
  const breakdown = useStaffRead(api, `/admin/analytics/behavior/breakdown?${period}&dimension=${dimension}&limit=8`, isBehaviorBreakdown);
  const data = totals.load.state === 'ready' ? totals.load.data : null;
  const rows = breakdown.load.state === 'ready' ? breakdown.load.data.rows : [];
  const shown = rows.reduce((sum, row) => sum + row.value, 0);

  const primary = <>
    <InlineNotice tone="info">{t.body.behaviorScope}</InlineNotice>
    {totals.load.state === 'loading' ? <Loading />
      : totals.load.state === 'error' ? (totals.load.code === 'PULSE_UNCONFIGURED' ? <InlineNotice tone="info">{t.body.behaviorUnconfigured}</InlineNotice>
        : <LoadFailure code={totals.load.code} onRetry={totals.reload} />)
        : data ? <>
          <Metrics label={t.heading.behavior} items={[
            { id: 'pageviews', label: t.body.pageviews, value: format.number(data.pageviews) },
            { id: 'visitors', label: t.body.visitors, value: format.number(data.visitors) },
            { id: 'visits', label: t.body.visits, value: format.number(data.visits) },
            { id: 'bounces', label: t.body.bounces, value: format.number(data.bounces) },
            { id: 'averageTime', label: t.body.averageTime, value: data.visits > 0 ? duration(data.totaltime / data.visits) : t.body.noData },
            { id: 'bounceRate', label: t.body.bounceRate, value: data.visits > 0 ? format.percent(data.bounces / data.visits) : t.body.noData },
          ]} />
          {data.outOfBoundaryPageviews === null ? <InlineNotice tone="info">{t.body.boundaryUnknown}</InlineNotice>
            : data.outOfBoundaryPageviews > 0 ? <InlineNotice tone="info">{fill(t.body.boundaryNote, { n: format.number(data.outOfBoundaryPageviews) })}</InlineNotice> : null}
        </> : null}
    <Card heading={t.heading.behaviorTrend}>
      {series.load.state === 'loading' ? <Loading />
        : series.load.state === 'error' ? <LoadFailure code={series.load.code} onRetry={series.reload} />
          : series.load.state === 'ready' && series.load.data.series.length === 0 ? <p data-copy-role="body">{t.body.noData}</p>
            : series.load.state === 'ready' ? <TrendChart label={t.body.behaviorChart} summary={t.body.behaviorChartSummary}
              points={series.load.data.series.map((point) => ({ key: point.date, label: day(point.date) }))}
              series={[
                { id: 'pageviews', label: t.body.pageviews, values: series.load.data.series.map((point) => point.pageviews) },
                { id: 'sessions', label: t.body.visits, values: series.load.data.series.map((point) => point.sessions) },
              ]} format={format.number} labels={labels} /> : null}
    </Card>
  </>;
  const secondary = <Card heading={t.heading.behaviorBreakdown}>
    <SelectField label={t.body.breakdownBy} value={dimension} onChange={(event) => setDimension(event.target.value as BehaviorDimension)}
      options={BEHAVIOR_DIMENSIONS.map((value) => ({ value, label: t.option[`behavior_${value}`] }))} />
    {breakdown.load.state === 'loading' ? <Loading />
      : breakdown.load.state === 'error' ? <LoadFailure code={breakdown.load.code} onRetry={breakdown.reload} />
        : rows.length === 0 ? <p data-copy-role="body">{t.body.noRows}</p> : <>
          <BarChart label={t.option[`behavior_${dimension}`]} rows={rows.map((row, index) => ({
            id: `${index}:${row.label}`, label: behaviorLabel(dimension, row.label, locale, copy), value: row.value, ugc: true,
            valueText: `${format.number(row.value)} · ${format.percent(shown > 0 ? row.value / shown : 0)}`,
          }))} />
          <p data-copy-role="body" className="lf-staff-muted">{t.body.shareOfShown}</p>
        </>}
  </Card>;
  return <DashboardLayout primary={primary} secondary={secondary} />;
}

/* ------------------------------------------------------------------------- */
/*  Health                                                                    */
/* ------------------------------------------------------------------------- */

function HealthView({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.analytics;
  const health = useStaffRead(api, '/admin/health/services', isHealthDetail);
  if (health.load.state === 'loading') return <Loading />;
  if (health.load.state === 'error') {
    return health.load.code === 'PULSE_UNCONFIGURED' ? <InlineNotice tone="info">{copy.overview.body.healthUnconfigured}</InlineNotice>
      : <LoadFailure code={health.load.code} onRetry={health.reload} />;
  }
  if (health.load.state !== 'ready') return null;
  const { monitors, summary } = health.load.data;
  if (!monitors.length) return <EmptyState heading={copy.overview.body.noMonitors} />;
  const pings = monitors.map((m) => m.pingMs).filter((value): value is number => value !== null);
  const uptimes = monitors.map((m) => m.uptime24h).filter((value): value is number => value !== null);
  const ms = (value: number) => fill(t.body.milliseconds, { n: format.number(Math.round(value)) });
  const columns: TableColumn<Monitor>[] = [
    { key: 'service', label: t.body.service, value: (m) => m.name, ugc: true },
    { key: 'status', label: t.body.status, value: (m) => (m.status === 1 ? <Chip tone="success" glyph="check">{copy.overview.body.up}</Chip> : <Chip tone="error" glyph="cross">{copy.overview.body.down}</Chip>) },
    { key: 'latency', label: t.body.latency, value: (m) => (m.pingMs === null ? t.body.noData : ms(m.pingMs)) },
    { key: 'uptime', label: t.body.uptime, value: (m) => (m.uptime24h === null ? t.body.noData : format.percent(m.uptime24h)) },
  ];
  return <div className="lf-staff-section">
    {summary.down === 0 ? <InlineNotice tone="success">{copy.overview.body.allUp}</InlineNotice>
      : <InlineNotice tone="error">{fill(copy.overview.body.someDown, { n: format.number(summary.down) })}</InlineNotice>}
    <Metrics label={t.heading.health} items={[
      { id: 'monitored', label: t.body.monitored, value: format.number(summary.total) },
      { id: 'latency', label: t.body.averageLatency, value: pings.length ? ms(pings.reduce((a, b) => a + b, 0) / pings.length) : t.body.noData },
      { id: 'uptime', label: t.body.averageUptime, value: uptimes.length ? format.percent(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : t.body.noData },
    ]} />
    <DataTable caption={t.heading.health} columns={columns} rows={[...monitors].sort((a, b) => a.status - b.status)} rowKey={(m) => String(m.id)} />
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Tools: reports and exclusions                                             */
/* ------------------------------------------------------------------------- */

function ReportCard({ api, selection, filters }: { api: StaffApi; selection: PeriodSelection; filters: readonly SegmentFilter[] }) {
  const { copy, locale } = useConsoleCopy();
  const t = copy.analytics;
  const name = useId();
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [audience, setAudience] = useState<ReportAudience>('full');
  const [rows, setRows] = useState<string>('10');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed' | 'refused'>('idle');
  const download = async () => {
    if (!api.download || state === 'busy') return;
    setState('busy');
    const result = await api.download(reportPath(format, selection, filters, audience, rows, locale));
    if (!result.ok) { setState(result.code === 'FORBIDDEN' ? 'refused' : 'failed'); return; }
    saveDownload(result.data.blob, `littlefounders-analytics-${audience}-${today()}.${format}`);
    setState('done');
  };
  return <Card heading={t.heading.reports}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.reportsIntro}</p>
    <SegmentedControl legend={t.body.format} name={`${name}-format`} value={format} onValueChange={(value) => { setFormat(value); setState('idle'); }}
      options={REPORT_FORMATS.map((value) => ({ value, label: t.option[`format_${value}`] }))} />
    <div className="lf-staff-filters">
      <SelectField label={t.body.reportAudience} value={audience} help={t.body[`audience_${audience}`]}
        onChange={(event) => { setAudience(event.target.value as ReportAudience); setState('idle'); }}
        options={REPORT_AUDIENCES.map((value) => ({ value, label: t.option[`audience_${value}`] }))} />
      <SelectField label={t.body.reportRows} value={rows} help={t.body.reportRowsHelp}
        onChange={(event) => { setRows(event.target.value); setState('idle'); }}
        options={REPORT_ROWS.map((value) => ({ value, label: fill(t.option.rows, { n: value }) }))} />
    </div>
    <p data-copy-role="body" className="lf-staff-muted">{filters.length ? fill(t.body.reportFiltered, { n: String(filters.length) }) : t.body.reportWindow}</p>
    <div className="lf-staff-actions">
      <Button variant="brand" pending={state === 'busy'} pendingLabel={copy.common.action.downloading} disabled={!api.download} onClick={() => void download()}>
        {t.action.download}
      </Button>
    </div>
    {state === 'done' ? <InlineNotice tone="success" live>{t.body.downloaded}</InlineNotice> : null}
    {state === 'failed' ? <InlineNotice tone="error" live>{t.body.downloadFailed}</InlineNotice> : null}
    {state === 'refused' ? <InlineNotice tone="error" live>{copy.common.body.refused}</InlineNotice> : null}
  </Card>;
}

function ExclusionsCard({ api, device }: { api: StaffApi; device?: DeviceOptOut }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.analytics;
  const exclusions = useStaffRead(api, EXCLUSIONS_PATH, isExclusions);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [manual, setManual] = useState({ network: '', label: '' });
  const [checked, setChecked] = useState(false);
  const [optedOut, setOptedOut] = useState(() => device?.optedOut() ?? false);
  const run = useCallback(async (key: string, call: () => Promise<{ ok: boolean; code?: string }>, success: string) => {
    setBusy(key);
    setResult(null);
    const outcome = await call();
    setBusy(null);
    if (!outcome.ok) {
      setResult({ tone: 'error', text: outcome.code === 'CONFLICT' ? t.body.alreadyExcluded : outcome.code === 'VALIDATION_ERROR' ? t.body.networkRefused
        : outcome.code === 'FORBIDDEN' ? copy.common.body.refused : copy.common.body.actionFailed });
      return false;
    }
    setResult({ tone: 'success', text: success });
    exclusions.reload();
    return true;
  }, [copy, t, exclusions]);
  const post = (path: string, body: unknown) => async () => { const r = await api.post(path, body); return r.ok ? { ok: true } : { ok: false, code: r.code }; };
  const remove = (id: string) => async () => {
    if (!api.remove) return { ok: false, code: 'INTERNAL' };
    const r = await api.remove(`/admin/analytics/exclusions/${id}`);
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  };
  const networkInvalid = manual.network.trim() !== '' && !NETWORK.test(manual.network.trim());
  const labelInvalid = manual.label.trim().length > 80;

  return <Card heading={t.heading.exclusions}>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.exclusionsIntro}</p>
    <InlineNotice tone="info">{t.body.forwardOnly}</InlineNotice>
    {exclusions.load.state === 'loading' ? <Loading />
      : exclusions.load.state === 'error' ? <LoadFailure code={exclusions.load.code} onRetry={exclusions.reload} />
        : exclusions.load.state === 'ready' ? <>
          <div className="lf-staff-row" data-exclusion="self">
            <Facts items={[{ id: 'address', label: t.body.yourAddress, value: exclusions.load.data.self.ip ?? t.body.unknownAddress, ugc: true }]} />
            {exclusions.load.data.self.excluded ? <Chip tone="success" glyph="check">{t.body.selfExcluded}</Chip>
              : <Button size="sm" variant="brand" pending={busy === 'self'} pendingLabel={copy.common.action.saving} disabled={busy !== null || !exclusions.load.data.self.ip}
                onClick={() => void run('self', post('/admin/analytics/exclusions/self', { label: t.body.selfLabel }), t.body.excluded)}>{t.action.excludeSelf}</Button>}
          </div>
          {device ? <Switch label={t.body.deviceOptOut} checked={optedOut} help={t.body.deviceHelp}
            stateLabels={{ on: copy.common.option.on, off: copy.common.option.off }}
            onCheckedChange={(on) => { device.set(on); setOptedOut(on); }} /> : null}
          <h3 data-copy-role="heading" className="lf-staff-subheading">{fill(t.heading.detected, { n: format.number(exclusions.load.data.windowDays) })}</h3>
          {exclusions.load.data.suggestions.length === 0 ? <p data-copy-role="body">{t.body.noSightings}</p>
            : <ul className="lf-staff-rows">
              {exclusions.load.data.suggestions.map((sighting) => <li key={`${sighting.address}:${sighting.userId}`} className="lf-staff-row" data-sighting={sighting.address}>
                <div className="lf-staff-stack">
                  <p data-copy-role="data" className="ugc lf-staff-emphasis-small">{sighting.address}</p>
                  <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.seenBy, { name: sighting.displayName, n: format.number(sighting.hits), date: format.date(sighting.lastSeenAt, copy.common.body.notAvailable) })}</p>
                  {sighting.distinctStaffUsers > 1 ? <InlineNotice tone="info">{fill(t.body.sharedAddress, { n: format.number(sighting.distinctStaffUsers) })}</InlineNotice> : null}
                </div>
                <Button size="sm" pending={busy === sighting.address} pendingLabel={copy.common.action.saving} disabled={busy !== null}
                  onClick={() => void run(sighting.address, post('/admin/analytics/exclusions', { network: sighting.address, label: sighting.displayName.slice(0, 80) }), t.body.excluded)}>
                  {t.action.exclude}
                </Button>
              </li>)}
            </ul>}
          <h3 data-copy-role="heading" className="lf-staff-subheading">{fill(t.heading.active, { n: format.number(exclusions.load.data.active.length) })}</h3>
          {exclusions.load.data.active.length === 0 ? <p data-copy-role="body">{t.body.noExclusions}</p>
            : <ul className="lf-staff-rows">
              {exclusions.load.data.active.map((row) => <li key={row.id} className="lf-staff-row" data-exclusion={row.id}>
                <div className="lf-staff-stack">
                  <p data-copy-role="data" className="ugc lf-staff-emphasis-small">{row.network}</p>
                  <p data-copy-role="data" className="ugc lf-staff-muted">{`${row.label} · ${format.date(row.created_at, copy.common.body.notAvailable)}`}</p>
                </div>
                {api.remove ? <Button size="sm" pending={busy === row.id} pendingLabel={copy.common.action.saving} disabled={busy !== null}
                  onClick={() => void run(row.id, remove(row.id), t.body.revoked)}>{t.action.revoke}</Button> : null}
              </li>)}
            </ul>}
          <form className="lf-staff-form" data-form="exclusion" noValidate onSubmit={(event) => {
            event.preventDefault();
            setChecked(true);
            if (!manual.network.trim() || !manual.label.trim() || networkInvalid || labelInvalid) return;
            void run('manual', post('/admin/analytics/exclusions', { network: manual.network.trim(), label: manual.label.trim() }), t.body.excluded)
              .then((saved) => { if (saved) { setManual({ network: '', label: '' }); setChecked(false); } });
          }}>
            <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.manual}</h3>
            <div className="lf-staff-filters">
              <TextField label={t.body.network} value={manual.network} data-copy-role="data" help={t.body.networkHelp}
                error={checked && (networkInvalid || !manual.network.trim()) ? t.body.networkInvalid : undefined}
                onChange={(event) => setManual({ ...manual, network: event.target.value })} />
              <TextField label={t.body.networkName} value={manual.label} data-copy-role="data" maxLength={80}
                error={checked && (!manual.label.trim() || labelInvalid) ? t.body.nameRequired : undefined}
                onChange={(event) => setManual({ ...manual, label: event.target.value })} />
            </div>
            <div className="lf-staff-actions"><Button type="submit" pending={busy === 'manual'} pendingLabel={copy.common.action.saving} disabled={busy !== null}>{t.action.add}</Button></div>
          </form>
        </> : null}
    {result ? <InlineNotice tone={result.tone} live>{result.text}</InlineNotice> : null}
  </Card>;
}

function ToolsView({ api, viewer, selection, filters, device }: { api: StaffApi; viewer: StaffViewer; selection: PeriodSelection; filters: readonly SegmentFilter[]; device?: DeviceOptOut }) {
  const { copy } = useConsoleCopy();
  return <div className="lf-staff-pair">
    <ReportCard api={api} selection={selection} filters={filters} />
    {can(viewer, 'manage_support') ? <ExclusionsCard api={api} device={device} />
      : <Card heading={copy.analytics.heading.exclusions}><p data-copy-role="body">{copy.analytics.body.exclusionsNeedSupport}</p></Card>}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Page                                                                      */
/* ------------------------------------------------------------------------- */

export function StaffAnalytics({ api, viewer, device, initialView = 'audience' }: { api: StaffApi; viewer: StaffViewer; device?: DeviceOptOut; initialView?: AnalyticsView }) {
  const { copy, sections } = useConsoleCopy();
  const t = copy.analytics;
  const name = useId();
  const [view, setView] = useState<AnalyticsView>(initialView);
  const [selection, setSelection] = useState<PeriodSelection>({ period: '30d' });
  const [filters, setFilters] = useState<SegmentFilter[]>([]);
  const [generation, setGeneration] = useState(0);
  useEffect(() => { setView(initialView); }, [initialView]);
  const period = periodQuery(selection);
  const days = daysForSelection(selection);
  return <StaffPage screen="staff-analytics" title={sections.analytics}
    actions={<Button size="sm" onClick={() => setGeneration((value) => value + 1)}>{copy.common.action.refresh}</Button>}>
    <div className="lf-staff-controls">
      <SegmentedControl legend={t.body.view} name={`${name}-view`} value={view} onValueChange={setView} className="lf-staff-views"
        options={ANALYTICS_VIEWS.map((value) => ({ value, label: t.option[`view_${value}`] }))} />
      {view === 'health' ? null : <WindowControl selection={selection} onChange={setSelection} />}
    </div>
    <div key={`${view}:${generation}:${period}`} className="lf-staff-section" data-view={view}>
      {view === 'audience' ? <AudienceView api={api} days={days} />
        : view === 'web' ? <StaffWeb api={api} viewer={viewer} selection={selection} filters={filters} onFilters={setFilters} />
          : view === 'behavior' ? <BehaviorView api={api} period={period} />
            : view === 'health' ? <HealthView api={api} />
              : view === 'trust' ? <TrustMetricsView api={api} days={days} />
                : <ToolsView api={api} viewer={viewer} selection={selection} filters={filters} device={device} />}
    </div>
  </StaffPage>;
}
