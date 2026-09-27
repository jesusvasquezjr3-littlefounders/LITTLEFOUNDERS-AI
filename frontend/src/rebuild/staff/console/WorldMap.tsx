import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Button, Chip, InlineNotice, List, ListRow, LoadingState } from '../../design/controls';
import { countryLabel, isBreakdown, type BreakdownRow } from './analyticsApi';
import { hasRegions } from './geo/regionLoader';
import { STEP_EDGES } from './geo/steps';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { LoadFailure, Loading } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * The geography block of Analytics & Health (W2T.3): visitors by country
 * from Plausible, on the world map, and by region inside one country.
 *
 * The map is a picture; the list is the control. Choosing a country (in the
 * list, or by pressing it on the map) selects it AND focuses the whole
 * console on it with a country filter, so the way back ("Whole world") sits
 * right here and undoes all of it: the selection, the opened country and the
 * filter. The legacy map offered only a way out of the zoom; the filter stayed
 * on every block, reachable only from a chip far up the page.
 *
 * Honesty rules kept from the legacy map: a country with visitors is always
 * accounted for (drawn, plotted as a point, or named as not placeable); the
 * legend prints real visitor ranges, so a shade reads back to a number; a
 * region label Plausible reports that no outline matches is named, not
 * dropped (Plausible labels regions by name here, not by ISO code).
 */

const MapCanvas = lazy(() => import('./geo/MapCanvas'));

export function WorldMap({ api, period, filterQuery, focused, onFocusCountry, onClearCountry }: {
  api: StaffApi; period: string; filterQuery: string;
  /** The country the console is focused on (its one country filter), or null. */
  focused: string | null;
  onFocusCountry: (code: string) => void; onClearCountry: () => void;
}) {
  const { copy, locale } = useConsoleCopy();
  const t = copy.analytics;
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }), [locale]);
  const selected = focused;
  const [opened, setZoomed] = useState<string | null>(null);
  // A country is open only while it is still the focused one (a filter removed elsewhere closes it).
  const zoomed = opened && opened === focused ? opened : null;
  const [hover, setHover] = useState<{ kind: 'country' | 'region'; code: string; name: string; visitors: number } | null>(null);
  const [regionInfo, setRegionInfo] = useState<{ max: number; unresolved: string[] }>({ max: 0, unresolved: [] });
  const countries = useStaffRead(api, `/admin/analytics/breakdown?${period}&dimension=country&limit=200${filterQuery}`, isBreakdown);
  const regionFilter = zoomed ? encodeURIComponent(JSON.stringify([['is', 'visit:country', [zoomed]]])) : '';
  const regions = useStaffRead(api, zoomed ? `/admin/analytics/breakdown?${period}&dimension=region&limit=200&filters=${regionFilter}` : null, isBreakdown);
  const onRegions = useCallback((result: { max: number; unresolved: string[] }) => setRegionInfo(result), []);

  const rows = countries.load.state === 'ready' ? countries.load.data.rows : [];
  const values = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const code = row.label.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) map.set(code, (map.get(code) ?? 0) + row.visitors);
    }
    return map;
  }, [rows]);
  const regionRows: BreakdownRow[] = regions.load.state === 'ready' ? regions.load.data.rows : [];
  const [notPlaced, setNotPlaced] = useState<string[]>([]);

  const choose = (code: string) => {
    setZoomed(null);
    onFocusCountry(code);
  };
  const back = () => {
    setZoomed(null);
    setHover(null);
    onClearCountry();
  };

  if (countries.load.state === 'loading') return <Loading />;
  if (countries.load.state === 'error') {
    return countries.load.code === 'PULSE_UNCONFIGURED' ? <InlineNotice tone="info">{t.body.webUnconfigured}</InlineNotice>
      : <LoadFailure code={countries.load.code} onRetry={countries.reload} />;
  }
  if (!rows.length) return <p data-copy-role="body" className="lf-staff-muted">{t.body.mapEmpty}</p>;

  const total = [...values.values()].reduce((a, b) => a + b, 0);
  const regionTotal = regionRows.reduce((sum, row) => sum + row.visitors, 0);
  const listed = zoomed ? regionRows.slice(0, 8) : [...values].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, visitors]) => ({ label: code, visitors }));
  const legendMax = zoomed ? regionInfo.max : Math.max(0, ...values.values());
  const legend = STEP_EDGES.map((edge, index) => {
    const upper = Math.round(edge * legendMax);
    const lower = index === 0 ? 1 : Math.round((STEP_EDGES[index - 1] ?? 0) * legendMax) + 1;
    return { step: index, text: lower >= upper ? nf.format(Math.max(upper, lower)) : `${nf.format(lower)}-${nf.format(upper)}` };
  });
  const focus = hover ?? (selected && !zoomed ? { kind: 'country' as const, code: selected, name: selected, visitors: values.get(selected) ?? 0 } : null);
  const focusName = focus ? (focus.kind === 'country' ? countryLabel(focus.code, locale) : focus.name) : '';
  const base = focus?.kind === 'region' ? regionTotal : total;

  return <div className="lf-staff-map" data-map={zoomed ? 'country' : 'world'}>
    <div className="lf-staff-map-actions">
      {selected || zoomed ? <Button size="sm" onClick={back}>{t.action.wholeWorld}</Button> : null}
      {selected && !zoomed && hasRegions(selected) ? <Button size="sm" variant="brand" onClick={() => setZoomed(selected)}>
        {fill(t.action.openCountry, { country: countryLabel(selected, locale) })}
      </Button> : null}
    </div>
    <div className="lf-staff-map-frame">
      <Suspense fallback={<LoadingState label={copy.common.body.loading} lines={2} />}>
        <MapCanvas countries={values} regionRows={regionRows} selected={selected} zoomed={zoomed} onSelect={choose} onHover={setHover} onRegions={onRegions} onUnplaceable={setNotPlaced} />
      </Suspense>
    </div>
    <p className="lf-staff-map-readout" data-copy-role="data" aria-live="polite">
      {focus && focus.visitors > 0 ? fill(t.body.mapReadout, { place: focusName, n: nf.format(focus.visitors), share: pf.format(base > 0 ? focus.visitors / base : 0) })
        : t.body.mapHint}
    </p>
    <div className="lf-staff-map-legend">
      <span data-copy-role="body">{zoomed ? t.body.legendRegions : t.body.legendCountries}</span>
      <ul aria-label={zoomed ? t.body.legendRegions : t.body.legendCountries}>
        {legend.map((entry) => <li key={entry.step}><span className={`lf-staff-map-swatch lf-staff-map-step-${entry.step}`} aria-hidden="true" /><span data-copy-role="data">{entry.text}</span></li>)}
      </ul>
    </div>
    <section className="lf-staff-stack" aria-labelledby="staff-map-places">
      <h3 id="staff-map-places" data-copy-role="heading" className="lf-staff-subheading">
        {zoomed ? fill(t.heading.topRegions, { country: countryLabel(zoomed, locale) }) : t.heading.topCountries}
      </h3>
      {zoomed && regions.load.state === 'loading' ? <Loading />
        : zoomed && regions.load.state === 'error' ? <LoadFailure code={regions.load.code} onRetry={regions.reload} />
          : zoomed && !regionRows.length ? <p data-copy-role="body" className="lf-staff-muted">{t.body.noRegions}</p>
            : <List label={zoomed ? fill(t.heading.topRegions, { country: countryLabel(zoomed, locale) }) : t.heading.topCountries}>
              {listed.map((row, index) => {
                const name = zoomed ? row.label : countryLabel(row.label, locale);
                const share = pf.format((zoomed ? regionTotal : total) > 0 ? row.visitors / (zoomed ? regionTotal : total) : 0);
                return <ListRow key={row.label} titleRole="data" leading={<span className="lf-staff-place-rank" data-copy-role="data">{index + 1}</span>}
                  title={<span className="ugc" data-place={row.label}>{name}</span>} supporting={fill(t.body.placeRow, { n: nf.format(row.visitors), share })}
                  trailing={!zoomed && selected === row.label ? <Chip tone="primary" glyph="check">{t.body.focused}</Chip> : undefined}
                  onPress={zoomed ? undefined : () => choose(row.label)} />;
              })}
            </List>}
    </section>
    {notPlaced.length ? <InlineNotice tone="info">{fill(t.body.notPlaced, { places: notPlaced.map((code) => countryLabel(code, locale)).join(', ') })}</InlineNotice> : null}
    {zoomed && regionInfo.unresolved.length ? <InlineNotice tone="info">{fill(t.body.unmatchedRegions, { places: regionInfo.unresolved.slice(0, 6).join(', ') })}</InlineNotice> : null}
  </div>;
}
