import { useId, useMemo, useState } from 'react';
import {
  Button, Card, DashboardLayout, DataTable, InlineNotice, SegmentedControl, SelectField, TextField, TrendChart, type TableColumn,
} from '../../design/controls';
import {
  change, countryLabel, coverage, EXCLUSIONS_PATH, filtersToQuery, FILTER_DIMENSIONS, isBreakdown, isExclusions, isWebOverview, MAIN_BREAKDOWNS,
  MORE_BREAKDOWNS, movingAverage, periodQuery, withFilter,
  type BreakdownRow, type DimensionKey, type PeriodSelection, type SegmentFilter,
} from './analyticsApi';
import { can, useStaffRead, type StaffApi, type StaffViewer } from './staffConsoleApi';
import { Facts, LoadFailure, Loading, Metrics, useChartLabels, useDay, useDuration, useFormats } from './ConsoleParts';
import { WorldMap } from './WorldMap';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * The Web view of Analytics & Health (W2T.3): Plausible, which by design sees
 * only anonymous, consented visitors on the marketing pages. Every block here
 * (headline figures, trend, map, breakdowns and report files) reads the same
 * window and the same segment filters, so a filter added from a breakdown row
 * or the map focuses all of them, and one list says what is on.
 *
 * Kept from the legacy page, each for a reason it learned the hard way:
 *   - the resolved window is written, not the preset's name ("this month" is
 *     the eleven days it holds), and a window Plausible answered for instead
 *     of the one asked for is an error above every figure;
 *   - each change is written with the period it compares to, and a missing
 *     comparison is "No comparison", never 0%;
 *   - bounce and visit time cover natively tracked visits only when imported
 *     history is excluded, and the page says so;
 *   - for the support grant, how far the internal-traffic exclusion reaches in
 *     this window (none, part, all), because Plausible's history cannot be
 *     rewritten by an exclusion added today.
 */

type Metric = 'visitors' | 'pageviews';

function Filters({ filters, onFilters }: { filters: readonly SegmentFilter[]; onFilters: (filters: SegmentFilter[]) => void }) {
  const { copy, locale } = useConsoleCopy();
  const t = copy.analytics;
  const [dimension, setDimension] = useState<DimensionKey>('country');
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const shown = (filter: SegmentFilter) => `${t.option[`dimension_${filter.dimension}`]}: ${filter.dimension === 'country' ? countryLabel(filter.value, locale) : filter.value}`;
  return <Card heading={t.heading.segment}>
    <form className="lf-staff-form" data-form="segment" noValidate onSubmit={(event) => {
      event.preventDefault();
      setChecked(true);
      const text = value.trim();
      if (!text) return;
      onFilters(withFilter(filters, { dimension, value: dimension === 'country' && /^[a-z]{2}$/i.test(text) ? text.toUpperCase() : text }));
      setValue('');
      setChecked(false);
    }}>
      <div className="lf-staff-filters">
        <SelectField label={t.body.filterBy} value={dimension} onChange={(event) => setDimension(event.target.value as DimensionKey)}
          options={FILTER_DIMENSIONS.map((key) => ({ value: key, label: t.option[`dimension_${key}`] }))} />
        <TextField label={t.body.filterValue} value={value} data-copy-role="data" help={dimension === 'country' ? t.body.countryHelp : undefined}
          error={checked && !value.trim() ? t.body.filterValueMissing : undefined} onChange={(event) => setValue(event.target.value)} />
      </div>
      <div className="lf-staff-actions"><Button type="submit">{t.action.addFilter}</Button></div>
    </form>
    {filters.length ? <>
      <ul className="lf-staff-rows" aria-label={t.body.activeFilters}>
        {filters.map((filter, index) => <li key={`${filter.dimension}:${filter.value}`} className="lf-staff-row" data-filter={filter.dimension}>
          <p data-copy-role="data" className="ugc">{shown(filter)}</p>
          <Button size="sm" aria-label={fill(t.action.removeFilterNamed, { filter: shown(filter) })}
            onClick={() => onFilters(filters.filter((_, at) => at !== index))}>{t.action.removeFilter}</Button>
        </li>)}
      </ul>
      <div className="lf-staff-actions"><Button size="sm" onClick={() => onFilters([])}>{copy.common.action.clearFilters}</Button></div>
    </> : <p data-copy-role="body" className="lf-staff-muted">{t.body.noFilters}</p>}
  </Card>;
}

function Breakdowns({ api, period, filterQuery, onFilter }: { api: StaffApi; period: string; filterQuery: string; onFilter: (filter: SegmentFilter) => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const duration = useDuration(locale);
  const t = copy.analytics;
  const [dimension, setDimension] = useState<DimensionKey>('page');
  const breakdown = useStaffRead(api, `/admin/analytics/breakdown?${period}&dimension=${dimension}&limit=8${filterQuery}`, isBreakdown);
  const display = (label: string) => (dimension === 'country' ? countryLabel(label, locale) : label || t.body.notRecorded);
  const columns: TableColumn<BreakdownRow>[] = [
    { key: 'label', label: t.option[`dimension_${dimension}`], value: (row) => display(row.label), ugc: true },
    { key: 'visitors', label: t.body.visitors, value: (row) => format.number(row.visitors) },
    { key: 'pageviews', label: t.body.pageviews, value: (row) => format.number(row.pageviews) },
    { key: 'bounce', label: t.body.bounceRate, value: (row) => format.percent(row.bounceRate / 100) },
    { key: 'duration', label: t.body.visitTime, value: (row) => duration(row.visitDuration) },
    { key: 'filter', label: t.body.focus, value: (row) => <Button size="sm" aria-label={fill(t.body.focusOnNamed, { value: display(row.label) })}
      onClick={() => onFilter({ dimension, value: row.label })}>{t.action.focusOn}</Button> },
  ];
  return <section className="lf-staff-section" aria-labelledby="staff-breakdowns">
    <h2 id="staff-breakdowns" data-copy-role="heading">{t.heading.breakdowns}</h2>
    <SelectField label={t.body.breakdownBy} value={dimension} onChange={(event) => setDimension(event.target.value as DimensionKey)}
      options={[...MAIN_BREAKDOWNS, ...MORE_BREAKDOWNS].map((key) => ({ value: key, label: t.option[`dimension_${key}`] }))} />
    {breakdown.load.state === 'loading' ? <Loading />
      : breakdown.load.state === 'error' ? <LoadFailure code={breakdown.load.code} onRetry={breakdown.reload} />
        : breakdown.load.state === 'ready' && breakdown.load.data.rows.length === 0 ? <p data-copy-role="body">{t.body.noRows}</p>
          : breakdown.load.state === 'ready' ? <>
            <DataTable caption={t.option[`dimension_${dimension}`]} columns={columns} rows={breakdown.load.data.rows} rowKey={(row) => row.label} />
            {breakdown.load.data.imports.importsIncluded ? null : <InlineNotice tone="info">{t.body.nativeOnlyRows}</InlineNotice>}
          </> : null}
  </section>;
}

export function StaffWeb({ api, viewer, selection, filters, onFilters }: {
  api: StaffApi; viewer: StaffViewer; selection: PeriodSelection; filters: readonly SegmentFilter[]; onFilters: (filters: SegmentFilter[]) => void;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const duration = useDuration(locale);
  const day = useDay(locale);
  const labels = useChartLabels();
  const t = copy.analytics;
  const name = useId();
  const [metric, setMetric] = useState<Metric>('visitors');
  const period = periodQuery(selection);
  const filterQuery = filtersToQuery(filters);
  const overview = useStaffRead(api, `/admin/analytics/overview?${period}${filterQuery}`, isWebOverview);
  const support = can(viewer, 'manage_support');
  const exclusions = useStaffRead(api, support ? EXCLUSIONS_PATH : null, isExclusions);
  const data = overview.load.state === 'ready' ? overview.load.data : null;
  const focusCountry = (code: string) => onFilters([...filters.filter((filter) => filter.dimension !== 'country'), { dimension: 'country', value: code }]);
  const clearCountry = () => onFilters(filters.filter((filter) => filter.dimension !== 'country'));
  const countryFilters = filters.filter((filter) => filter.dimension === 'country');
  const focused = countryFilters.length === 1 ? countryFilters[0]!.value.toUpperCase() : null;

  const signed = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }), [locale]);
  const delta = (value: number | null, higherIsBetter: boolean) => {
    if (value === null) return t.body.noComparison;
    const better = value === 0 ? null : (value > 0) === higherIsBetter;
    return `${signed.format(value)}${better === null ? '' : ` · ${better ? t.body.better : t.body.worse}`}`;
  };

  const series = data ? data.timeseries.map((point) => point[metric]) : [];
  const average = movingAverage(series);
  const cover = exclusions.load.state === 'ready' && data ? coverage(exclusions.load.data.active, data.from) : null;

  const primary = <>
    {overview.load.state === 'loading' ? <Loading />
      : overview.load.state === 'error' ? (overview.load.code === 'PULSE_UNCONFIGURED' ? <InlineNotice tone="info">{t.body.webUnconfigured}</InlineNotice>
        : <LoadFailure code={overview.load.code} onRetry={overview.reload} />)
        : data ? <>
          <p data-copy-role="data" className="lf-staff-window-text">{fill(copy.common.body.range, { from: format.calendar(data.from), to: format.calendar(data.to) })}</p>
          {data.rangeDrift ? <InlineNotice tone="error">{fill(t.body.rangeDrift, {
            from: format.calendar(data.rangeDrift.answeredFor[0]), to: format.calendar(data.rangeDrift.answeredFor[1]),
          })}</InlineNotice> : null}
          <Metrics label={t.heading.web} items={[
            { id: 'visitors', label: t.body.visitors, value: format.number(data.aggregate.visitors) },
            { id: 'pageviews', label: t.body.pageviews, value: format.number(data.aggregate.pageviews) },
            { id: 'bounceRate', label: t.body.bounceRate, value: format.percent(data.aggregate.bounce_rate / 100) },
            { id: 'visitTime', label: t.body.visitTime, value: duration(data.aggregate.visit_duration) },
          ]} />
          <Card heading={t.heading.compared}>
            {data.previous ? <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.comparedWindow, { from: format.calendar(data.previous.from), to: format.calendar(data.previous.to) })}</p> : null}
            {data.previous ? <Facts items={[
              { id: 'visitors', label: t.body.visitors, value: delta(change(data.aggregate.visitors, data.previous.visitors), true) },
              { id: 'pageviews', label: t.body.pageviews, value: delta(change(data.aggregate.pageviews, data.previous.pageviews), true) },
              { id: 'bounceRate', label: t.body.bounceRate, value: delta(change(data.aggregate.bounce_rate, data.previous.bounce_rate), false) },
              { id: 'visitTime', label: t.body.visitTime, value: delta(change(data.aggregate.visit_duration, data.previous.visit_duration), true) },
            ]} /> : <p data-copy-role="body">{t.body.noComparisonBody}</p>}
            {data.imports.importsIncluded ? null : <p data-copy-role="body" className="lf-staff-muted">{t.body.nativeOnly}</p>}
          </Card>
          {cover ? <InlineNotice tone="info">
            {cover.state === 'none' ? t.body.coverageNone : fill(cover.state === 'partial' ? t.body.coveragePartial : t.body.coverageAll,
              { date: format.date(cover.since, copy.common.body.notAvailable) })}
          </InlineNotice> : null}
          <Card heading={t.heading.webTrend}>
            <SegmentedControl legend={t.body.show} name={`${name}-metric`} value={metric} onValueChange={setMetric}
              options={[{ value: 'visitors', label: t.body.visitors }, { value: 'pageviews', label: t.body.pageviews }]} />
            {data.timeseries.length === 0 ? <p data-copy-role="body">{t.body.noData}</p> : <>
              <TrendChart label={fill(t.body.webChart, { metric: (metric === 'visitors' ? t.body.visitors : t.body.pageviews).toLocaleLowerCase(locale) })}
                summary={fill(t.body.webChartSummary, {
                  n: format.number(Math.round(series.reduce((a, b) => a + b, 0) / Math.max(series.length, 1))),
                  change: `${series.length ? (series[series.length - 1]! - series[0]! >= 0 ? '+' : '') : ''}${format.number(series.length ? series[series.length - 1]! - series[0]! : 0)}`,
                })}
                points={data.timeseries.map((point) => ({ key: point.date, label: day(point.date) }))}
                series={[
                  { id: metric, label: metric === 'visitors' ? t.body.visitors : t.body.pageviews, values: series },
                  ...(series.length >= 7 ? [{ id: 'average', label: t.body.weekAverage, values: average }] : []),
                ]} format={format.number} labels={labels} />
              <Facts items={[
                { id: 'daily', label: t.body.dailyAverage, value: format.number(Math.round(data.aggregate.visitors / Math.max(data.timeseries.length, 1))) },
                { id: 'depth', label: t.body.pagesPerVisitor, value: data.aggregate.visitors > 0 ? format.number(data.aggregate.pageviews / data.aggregate.visitors) : t.body.noData },
              ]} />
            </>}
          </Card>
        </> : null}
  </>;
  const secondary = <>
    <Filters filters={filters} onFilters={onFilters} />
    <Card heading={t.heading.geography}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.geographyIntro}</p>
      <WorldMap api={api} period={period} filterQuery={filterQuery} focused={focused} onFocusCountry={focusCountry} onClearCountry={clearCountry} />
    </Card>
  </>;
  return <>
    <DashboardLayout primary={primary} secondary={secondary} />
    <Breakdowns api={api} period={period} filterQuery={filterQuery} onFilter={(filter) => onFilters(withFilter(filters, filter))} />
  </>;
}
