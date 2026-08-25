import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalyticsGeoMap } from './AnalyticsGeoMap';
import { COUNTRY_SHAPE_BY_CODE, countryPosition, MICRO_STATE_CENTROIDS } from './worldGeography';

/*
 * WARM THE CODE-SPLIT CHUNK BEFORE THE CLOCK STARTS.
 *
 * `AnalyticsGeoMap` renders the map through `React.lazy(() => import('./WorldChoropleth'))`,
 * and that module pulls in `worldGeography.ts` — 171 KB of generated Natural
 * Earth outlines. `waitFor`'s default budget is 1000 ms, so a test that waits
 * for a country path is really waiting for Vite to transform ~190 KB inside
 * that second. Alone it takes ~480 ms and passes; inside the full run, with 89
 * test files competing for the same worker pool, it does not, and the failure
 * lands on whichever assertion happened to be behind the boundary.
 *
 * Importing the module here moves that transform into COLLECTION, which has no
 * deadline, so `lazy()` later resolves from Vite's module cache. It weakens no
 * assertion: the component still mounts its own lazy boundary and still has to
 * suspend and resolve it. The alternative — a longer timeout — would only
 * widen the window the race runs in.
 */
await import('./WorldChoropleth');

const { mockAdminData, mockFilter, mockClear } = vi.hoisted(() => ({
  mockAdminData: vi.fn(),
  mockFilter: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock('../adminShared', () => ({ useAdminData: mockAdminData }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => (values?.count ? `${key} ${values.count}` : key),
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

function rows(list: [string, number][]) {
  return list.map(([label, visitors]) => ({ label, visitors, pageviews: visitors * 2, bounceRate: 40, visitDuration: 60 }));
}

beforeEach(() => {
  mockFilter.mockClear();
  mockClear.mockClear();
  mockAdminData.mockReturnValue({
    data: { state: 'ready', data: { period: '30d', dimension: 'country', rows: rows([['US', 20], ['MX', 10]]) } },
  });
});

describe('worldGeography (generated)', () => {
  it('carries real country outlines, not a stylised silhouette', () => {
    const mexico = COUNTRY_SHAPE_BY_CODE.MX;
    expect(mexico).toBeTruthy();
    // A real projected border is hundreds of path commands; the map this
    // replaced drew the whole of North America with seven line segments.
    expect(mexico!.d.length).toBeGreaterThan(500);
    expect(mexico!.d.startsWith('M')).toBe(true);
  });

  it('places countries where they belong, west to east and north to south', () => {
    const [mxX, mxY] = COUNTRY_SHAPE_BY_CODE.MX!.centroid!;
    const [esX, esY] = COUNTRY_SHAPE_BY_CODE.ES!.centroid!;
    const [arX, arY] = COUNTRY_SHAPE_BY_CODE.AR!.centroid!;
    expect(mxX).toBeLessThan(esX); // Mexico is west of Spain
    expect(arY).toBeGreaterThan(mxY); // Argentina is south of Mexico
    expect(esY).toBeLessThan(arY);
    expect(arX).toBeLessThan(esX);
  });

  it('still gives a position to countries too small to draw at this resolution', () => {
    // Singapore has no 110m polygon. Losing it entirely would mean a market
    // with real visitors silently missing from the map.
    expect(COUNTRY_SHAPE_BY_CODE.SG).toBeUndefined();
    expect(MICRO_STATE_CENTROIDS.SG).toBeTruthy();
    expect(countryPosition('SG')).toBeTruthy();
    expect(countryPosition('ZZ')).toBeNull();
  });
});

describe('AnalyticsGeoMap', () => {
  it('renders ranked countries from the real breakdown and filters on selection', async () => {
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} onClearFilter={mockClear} />);

    expect(await screen.findByText('United States')).toBeInTheDocument();
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    const countryButtons = screen.getAllByRole('button', { name: /United States/ });
    fireEvent.click(countryButtons[countryButtons.length - 1]!);
    expect(mockFilter).toHaveBeenCalledWith('country', 'US');
  });

  it('draws only the countries that have traffic as interactive', async () => {
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} onClearFilter={mockClear} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /United States: 20/ }).length).toBeGreaterThan(0));
    // A country with no visitors is land, not a filter into a guaranteed-empty result.
    expect(screen.queryByRole('button', { name: /Japan/ })).toBeNull();
  });

  it('names the countries it cannot place instead of dropping them', async () => {
    mockAdminData.mockReturnValue({
      data: { state: 'ready', data: { period: '30d', dimension: 'country', rows: rows([['US', 20], ['ZZ', 5]]) } },
    });
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} onClearFilter={mockClear} />);
    await waitFor(() => expect(screen.getByText(/admin\.analytics\.geo\.unmapped/)).toBeInTheDocument());
  });
  /*
   * THE REPORTED SYMPTOM: "after zooming into the map you cannot get back to
   * the general view without reloading the page."
   *
   * Selecting a country does not just move the map — it filters the WHOLE
   * console. The map's own back control used to undo only its geometry, so the
   * page stayed focused on one country and the only release was a chip in the
   * filter bar several sections up, which on a phone is off-screen entirely.
   */
  it('offers a way back as soon as a country is selected, not only when zoomed', async () => {
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} onClearFilter={mockClear} />);

    expect(screen.queryByRole('button', { name: /backToWorld/ })).toBeNull();

    const countryButtons = await screen.findAllByRole('button', { name: /United States/ });
    fireEvent.click(countryButtons[countryButtons.length - 1]!);

    expect(await screen.findByRole('button', { name: /backToWorld/ })).toBeInTheDocument();
  });

  it('releases the console filter on the way back, not just the map zoom', async () => {
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} onClearFilter={mockClear} />);

    const countryButtons = await screen.findAllByRole('button', { name: /United States/ });
    fireEvent.click(countryButtons[countryButtons.length - 1]!);
    expect(mockFilter).toHaveBeenCalledWith('country', 'US');

    fireEvent.click(await screen.findByRole('button', { name: /backToWorld/ }));

    // Undoing the zoom without this leaves every card on the page filtered.
    expect(mockClear).toHaveBeenCalledWith('country');
    expect(screen.queryByRole('button', { name: /backToWorld/ })).toBeNull();
  });
});
