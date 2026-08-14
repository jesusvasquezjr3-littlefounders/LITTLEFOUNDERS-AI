import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignupTimeline } from '../SignupTimeline';

const { mockApi, mockGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  ComposedChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Area: () => <g data-testid="signup-area" />,
  Bar: () => null,
  CartesianGrid: () => null,
  Label: () => null,
  ReferenceDot: () => null,
  ReferenceLine: ({ children }: { children?: ReactNode }) => <g>{children}</g>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Brush: ({ onChange }: { onChange?: (range: { startIndex?: number; endIndex?: number }) => void }) => (
    <g role="button" aria-label="zoom" onClick={() => onChange?.({ startIndex: 2, endIndex: 3 })} />
  ),
}));

beforeEach(() => {
  mockGetToken.mockResolvedValue('fake-token');
  mockApi.mockResolvedValue({
    data: {
      timeline: [
        { date: '2026-08-01', count: 1 },
        { date: '2026-08-02', count: 0 },
        { date: '2026-08-03', count: 5 },
        { date: '2026-08-04', count: 3 },
      ],
    },
    error: null,
  });
});

describe('SignupTimeline', () => {
  it('loads continuous history and exposes the interactive area chart', async () => {
    render(<SignupTimeline />);

    await waitFor(() => expect(screen.getAllByTestId('signup-area').length).toBeGreaterThan(0));
    expect(mockApi).toHaveBeenCalledWith('/admin/users/timeline?days=365', { token: 'fake-token' });
    expect(screen.queryByText('admin.users.timelinePeriods.30d')).not.toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('recalculates the summary when the in-chart range changes', async () => {
    render(<SignupTimeline />);

    /*
     * Wait for the DATA, not merely the chrome. The zoom control renders as
     * soon as the chart does, which is before the API promise resolves — so
     * clicking it early summarises an empty series and the assertion below
     * fails intermittently. It did exactly that in CI on 2026-08-14 and
     * blocked a deploy, having previously passed roughly five runs in six.
     * The full-range total (1 + 0 + 5 + 3) proves the fixture has landed.
     */
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'zoom' }));
    // Range covers indices 2..3, so 5 + 3.
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
  });
});
