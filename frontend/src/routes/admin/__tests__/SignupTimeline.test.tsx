import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('exposes preset buttons as the only range control, with no drag Brush', () => {
    /*
     * The chart carried BOTH preset buttons and a drag Brush, two controls
     * setting the same range with no way to tell which the figures obeyed.
     * The Brush also failed the touch rule — a drag-only affordance with no
     * tap equivalent. The presets are that equivalent and stayed.
     */
    render(<SignupTimeline />);
    expect(screen.queryByRole('button', { name: 'zoom' })).not.toBeInTheDocument();
  });
});
