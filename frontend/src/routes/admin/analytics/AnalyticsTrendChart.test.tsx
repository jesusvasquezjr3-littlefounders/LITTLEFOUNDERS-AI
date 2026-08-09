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
  Brush: ({ onChange }: { onChange?: (range: { startIndex?: number; endIndex?: number }) => void }) => (
    <g role="button" aria-label="zoom" onClick={() => onChange?.({ startIndex: 2, endIndex: 3 })} />
  ),
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

  it('recalculates the visible summary after brush zoom', () => {
    render(<AnalyticsTrendChart data={points} />);
    fireEvent.click(screen.getByRole('button', { name: 'zoom' }));
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
