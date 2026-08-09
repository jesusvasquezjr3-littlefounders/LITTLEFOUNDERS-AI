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
  Area: () => <g data-testid="signup-area" />,
  CartesianGrid: () => null,
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

    await waitFor(() => expect(screen.getByTestId('signup-area')).toBeInTheDocument());
    expect(mockApi).toHaveBeenCalledWith('/admin/users/timeline?days=365', { token: 'fake-token' });
    expect(screen.queryByText('admin.users.timelinePeriods.30d')).not.toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('recalculates the summary when the in-chart range changes', async () => {
    render(<SignupTimeline />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'zoom' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'zoom' }));
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
