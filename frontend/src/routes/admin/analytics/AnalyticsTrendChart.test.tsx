import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnalyticsTrendChart } from './AnalyticsTrendChart';

const { mockTranslation } = vi.hoisted(() => ({
  mockTranslation: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      mockTranslation(key);
      if (values?.start && values?.end) return `${values.start} to ${values.end}`;
      return key;
    },
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Area: () => <g data-testid="analytics-area" />,
  Bar: () => null,
  Line: ({ dataKey }: { dataKey?: string }) => <g data-testid={`analytics-line-${String(dataKey)}`} />,
  CartesianGrid: () => null,
  Label: () => null,
  ReferenceDot: () => null,
  ReferenceLine: ({ children }: { children?: ReactNode }) => <g>{children}</g>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const points = [
  { date: '2026-08-01', visitors: 1, pageviews: 4 },
  { date: '2026-08-02', visitors: 0, pageviews: 1 },
  { date: '2026-08-03', visitors: 5, pageviews: 8 },
  { date: '2026-08-04', visitors: 3, pageviews: 5 },
];

beforeEach(() => mockTranslation.mockClear());

describe('AnalyticsTrendChart', () => {
  it('shows exact range summaries and exposes the metric switch', () => {
    render(<AnalyticsTrendChart data={points} />);

    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin.analytics.web.pageviews' })).toBeInTheDocument();
    expect(screen.getAllByTestId('analytics-area').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'admin.analytics.web.pageviews' }));
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('offers no period control of its own — the page-level picker is the only authority', () => {
    /*
     * This chart used to carry 7d/30d/90d/all presets and a drag Brush while
     * the page header carried its own picker, so one screen had three ways to
     * pick a window that could disagree. Both were removed; a regression here
     * means the contradiction is back.
     */
    render(<AnalyticsTrendChart data={points} />);
    expect(screen.queryByRole('button', { name: 'zoom' })).not.toBeInTheDocument();
    for (const key of ['range7d', 'range30d', 'range90d', 'rangeall']) {
      expect(screen.queryByRole('button', { name: `admin.analytics.web.${key}` })).not.toBeInTheDocument();
    }
    // The whole fetched series is always summarised: 1 + 0 + 5 + 3.
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('withholds the moving average until a full window exists', () => {
    // Four points cannot support a 7-day mean. Drawing one anyway would
    // invent a trend at the chart edge, which is where readers look hardest.
    render(<AnalyticsTrendChart data={points} />);
    expect(screen.queryByTestId('analytics-line-trend')).not.toBeInTheDocument();
  });

  it('draws the 7-day moving average once the series is long enough', () => {
    const long = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      visitors: i + 1,
      pageviews: (i + 1) * 2,
    }));
    render(<AnalyticsTrendChart data={long} />);
    expect(screen.getByTestId('analytics-line-trend')).toBeInTheDocument();
  });
});
