import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalyticsGeoMap } from './AnalyticsGeoMap';
import { COUNTRY_SHAPE_BY_CODE, countryPosition, MICRO_STATE_CENTROIDS } from './worldGeography';

const { mockAdminData, mockFilter } = vi.hoisted(() => ({
  mockAdminData: vi.fn(),
  mockFilter: vi.fn(),
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
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} />);

    expect(await screen.findByText('🇺🇸 United States')).toBeInTheDocument();
    expect(screen.getByText('🇲🇽 Mexico')).toBeInTheDocument();
    const countryButtons = screen.getAllByRole('button', { name: /United States/ });
    fireEvent.click(countryButtons[countryButtons.length - 1]!);
    expect(mockFilter).toHaveBeenCalledWith('country', 'US');
  });

  it('draws only the countries that have traffic as interactive', async () => {
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /United States: 20/ }).length).toBeGreaterThan(0));
    // A country with no visitors is land, not a filter into a guaranteed-empty result.
    expect(screen.queryByRole('button', { name: /Japan/ })).toBeNull();
  });

  it('names the countries it cannot place instead of dropping them', async () => {
    mockAdminData.mockReturnValue({
      data: { state: 'ready', data: { period: '30d', dimension: 'country', rows: rows([['US', 20], ['ZZ', 5]]) } },
    });
    render(<AnalyticsGeoMap periodQuery="period=30d" filterQuery="" onFilter={mockFilter} />);
    await waitFor(() => expect(screen.getByText(/admin\.analytics\.geo\.unmapped/)).toBeInTheDocument());
  });
});
