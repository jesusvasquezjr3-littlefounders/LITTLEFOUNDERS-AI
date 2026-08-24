import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAdminData } from '../adminShared';
import { countryLabel, type BreakdownData, type BreakdownRow, type DimensionKey, type PeriodQuery } from './analyticsShared';

/*
 * Geography panel. The map itself is code-split: its geometry is a ~160 KB
 * generated module (real Natural Earth outlines) that only this page ever
 * needs, so it must not sit in the bundle every visitor downloads.
 */
const WorldChoropleth = lazy(() =>
  import('./WorldChoropleth').then((module) => ({ default: module.WorldChoropleth })),
);

export function AnalyticsGeoMap({
  periodQuery,
  filterQuery,
  onFilter,
  onClearFilter,
}: {
  periodQuery: PeriodQuery;
  filterQuery: string;
  onFilter: (dimension: DimensionKey, value: string) => void;
  /** Removes every filter on one dimension. See `backToWorld`. */
  onClearFilter: (dimension: DimensionKey) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<BreakdownData>(
    `/admin/analytics/breakdown?${periodQuery}&dimension=country&limit=200${filterQuery}`,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [unplaceable, setUnplaceable] = useState<string[]>([]);

  /*
   * Region rows for the zoomed country. Held here, but FETCHED by a child that
   * only mounts while zoomed: the world view must not pay for a Plausible
   * query it will never draw.
   */
  const [regionRows, setRegionRows] = useState<BreakdownRow[]>([]);

  const selectCountry = useCallback(
    (code: string) => {
      setSelected(code);
      onFilter('country', code);
    },
    [onFilter],
  );

  /*
   * THE WAY BACK UNDOES EVERYTHING THE MAP DID, which it did not before.
   *
   * One click on a country does three things: selects it, zooms the map into
   * its regions, and focuses the WHOLE CONSOLE on it via a country filter.
   * "Back to world" undid only the zoom. The filter stayed, so every card on
   * the page kept showing one country and the only control that could release
   * it was a chip in the filter bar three sections up — off-screen on a phone,
   * which is exactly how this was reported: "you cannot get back to the
   * general view without reloading the page".
   *
   * A control that reverses an action belongs beside the action. This is that
   * control, and it is now offered whenever EITHER the zoom or the selection
   * is set, not only while zoomed — selecting a country from the list focuses
   * the console just as much as clicking the map does.
   */
  const backToWorld = useCallback(() => {
    setZoomed(null);
    setSelected(null);
    onClearFilter('country');
  }, [onClearFilter]);

  const title = t('admin.analytics.geo.title');
  const subtitle = t('admin.analytics.geo.subtitle');

  if (data.state === 'loading') {
    return (
      <MapShell title={title} subtitle={subtitle}>
        <MapState icon="progress_activity" text={t('admin.loading')} spin />
      </MapShell>
    );
  }
  if (data.state === 'error') {
    return (
      <MapShell title={title} subtitle={subtitle}>
        <MapState
          icon="cloud_off"
          text={t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
        />
      </MapShell>
    );
  }

  const rows = data.data.rows;
  if (rows.length === 0) {
    return (
      <MapShell title={title} subtitle={subtitle}>
        <MapState icon="public" text={t('admin.analytics.breakdowns.empty')} />
      </MapShell>
    );
  }

  const total = rows.reduce((sum, row) => sum + row.visitors, 0);
  const regionTotal = regionRows.reduce((sum, row) => sum + row.visitors, 0);
  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage);
  const percentFormat = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <MapShell title={title} subtitle={subtitle}>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
        {zoomed && <RegionRows country={zoomed} periodQuery={periodQuery} onRows={setRegionRows} />}
        <Suspense
          fallback={
            <div className="min-h-56 animate-pulse rounded-xl border border-outline/40 bg-surface-sunken/40" />
          }
        >
          <WorldChoropleth
            rows={rows}
            selected={selected}
            onSelect={selectCountry}
            onUnplaceable={setUnplaceable}
            zoomed={zoomed}
            onZoom={setZoomed}
            onBackToWorld={backToWorld}
            regionRows={regionRows}
          />
        </Suspense>

        <div className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="lf-label font-bold text-content">
                {zoomed
                  ? t('admin.analytics.geo.topRegions', { country: countryLabel(zoomed, i18n.resolvedLanguage) })
                  : t('admin.analytics.geo.topCountries')}
              </p>
              <p className="lf-caption mt-1 text-content-faint">
                <span className="lf-number text-content-muted">{numberFormat.format(total)}</span>{' '}
                {t('admin.analytics.geo.totalVisitorsLabel')}
              </p>
            </div>
            <span className="lf-caption rounded-full border border-outline/50 px-2 py-0.5 text-content-faint">
              {zoomed
                ? t('admin.analytics.geo.regionCount', { count: regionRows.length })
                : t('admin.analytics.geo.countryCount', { count: rows.length })}
            </span>
          </div>

          <ol className="mt-3 flex flex-col gap-2">
            {(zoomed ? regionRows : rows).slice(0, 8).map((row, index) => {
              // While zoomed the shares are of the country's own total, so the
              // percentages beside a state add up to that country, not the world.
              const base = zoomed ? regionTotal : total;
              const share = base > 0 ? row.visitors / base : 0;
              const label = zoomed ? row.label : countryLabel(row.label, i18n.resolvedLanguage);
              const isSelected = !zoomed && selected === row.label.toUpperCase();
              return (
                <li key={row.label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!zoomed) selectCountry(row.label.toUpperCase());
                    }}
                    className={cn(
                      'group flex w-full min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected
                        ? 'border-primary/60 bg-primary-soft/40'
                        : 'border-outline/30 bg-surface-sunken/30 hover:border-outline hover:bg-surface-sunken/60',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="lf-number w-5 text-content-faint">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-content" title={label}>
                        {label}
                      </span>
                      <span className="lf-number text-content">{numberFormat.format(row.visitors)}</span>
                    </span>
                    <span className="ml-8 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline/30">
                        <span
                          className="block h-full rounded-full bg-primary transition-[width] duration-300"
                          style={{ width: `${Math.max(share * 100, 2)}%` }}
                        />
                      </span>
                      <span className="lf-caption w-12 text-right text-content-muted">{percentFormat.format(share)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="lf-caption mt-3 text-content-faint">{t('admin.analytics.geo.filterHint')}</p>

          {/*
            A country the map cannot place still has real visitors. Saying so
            beats letting it vanish between a map and a top-8 list.
          */}
          {unplaceable.length > 0 && (
            <p className="lf-caption mt-2 rounded-lg border border-outline/40 bg-surface-sunken/40 p-2 text-content-muted">
              {t('admin.analytics.geo.unmapped', {
                countries: unplaceable.map((code) => countryLabel(code, i18n.resolvedLanguage)).join(', '),
              })}
            </p>
          )}
        </div>
      </div>
    </MapShell>
  );
}

/**
 * Fetches the region breakdown for one country and lifts it to the map.
 * Rendering nothing is the point: it exists so the request is tied to the zoom
 * state rather than firing on every analytics page load.
 */
function RegionRows({
  country,
  periodQuery,
  onRows,
}: {
  country: string;
  periodQuery: PeriodQuery;
  onRows: (rows: BreakdownRow[]) => void;
}) {
  const filter = encodeURIComponent(JSON.stringify([['is', 'visit:country', [country]]]));
  const { data } = useAdminData<BreakdownData>(
    `/admin/analytics/breakdown?${periodQuery}&dimension=region&limit=200&filters=${filter}`,
  );
  const rows = data.state === 'ready' ? data.data.rows : null;
  useEffect(() => {
    onRows(rows ?? []);
  }, [rows, onRows]);
  return null;
}

function MapShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <div>
        <h3 className="lf-title flex items-center gap-2 text-content">
          <Icon name="public" className="!text-[21px] text-primary" />
          {title}
        </h3>
        <p className="lf-caption mt-1 text-content-muted">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}

function MapState({ icon, text, spin = false }: { icon: string; text: string; spin?: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-outline/30 bg-surface-sunken/30 text-center">
      <Icon name={icon} className={cn('!text-[38px] text-content-faint', spin && 'animate-spin')} />
      <p className="lf-caption text-content-muted">{text}</p>
    </div>
  );
}
