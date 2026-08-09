import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnalyticsGeoMap } from './AnalyticsGeoMap';

const { mockAdminData, mockFilter } = vi.hoisted(() => ({
  mockAdminData: vi.fn(),
  mockFilter: vi.fn(),
}));

vi.mock('../adminShared', () => ({ useAdminData: mockAdminData }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => values?.count ? `${key} ${values.count}` : key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

beforeEach(() => {
  mockFilter.mockClear();
  mockAdminData.mockReturnValue({
    data: {
      state: 'ready',
      data: {
        period: '30d',
        dimension: 'country',
        rows: [
          { label: 'US', visitors: 20, pageviews: 30, bounceRate: 40, visitDuration: 60 },
          { label: 'MX', visitors: 10, pageviews: 15, bounceRate: 45, visitDuration: 50 },
        ],
      },
    },
  });
});

describe('AnalyticsGeoMap', () => {
  it('renders ranked countries from the real breakdown and filters on selection', () => {
    render(<AnalyticsGeoMap period="30d" filterQuery="" onFilter={mockFilter} />);

    expect(screen.getByText('🇺🇸 United States')).toBeInTheDocument();
    expect(screen.getByText('🇲🇽 Mexico')).toBeInTheDocument();
    const countryButtons = screen.getAllByRole('button', { name: /United States/ });
    fireEvent.click(countryButtons[countryButtons.length - 1]!);
    expect(mockFilter).toHaveBeenCalledWith('country', 'US');
  });
});
