import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEmailDashboard } from '../AdminEmailDashboard';

const { mockApi, mockGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ roles: ['admin'], getToken: mockGetToken }),
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
  Area: () => <g data-testid="email-area" />,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const entries = [
  {
    id: 'log-1',
    messageId: 'message-1',
    to: 'parent@example.com',
    subject: 'Welcome',
    status: 'relayed',
    templateType: 'auth',
    locale: 'en-US',
    detail: { html: true },
    createdAt: '2026-08-08T10:00:00Z',
  },
];

const summary = {
  total: 10,
  statuses: { relayed: 8, failed: 1, queued: 1 },
  templates: { auth: 10 },
  locales: { 'en-US': 10 },
  trend: [{ date: '2026-08-08', count: 1 }],
};

beforeEach(() => {
  mockGetToken.mockResolvedValue('fake-token');
  mockApi.mockImplementation((path: string) => {
    if (path.startsWith('/admin/emails/logs')) return Promise.resolve({ data: { entries, total: 1 }, error: null });
    if (path === '/admin/emails/summary') return Promise.resolve({ data: summary, error: null });
    return Promise.resolve({ data: {}, error: null });
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/emails']}>
      <AdminEmailDashboard />
    </MemoryRouter>,
  );
}

describe('AdminEmailDashboard', () => {
  it('renders operational metrics, trend, and the responsive history surface', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('admin.emails.totalSent')).toBeInTheDocument());
    expect(screen.getByText('admin.emails.trendTitle')).toBeInTheDocument();
    expect(screen.getByTestId('email-area')).toBeInTheDocument();
    expect(screen.getAllByText('parent@example.com').length).toBeGreaterThan(0);
    expect(document.querySelector('select')).toBeNull();
    expect(mockApi).toHaveBeenCalledWith(expect.stringContaining('/admin/emails/logs?limit=25&offset=0'), { token: 'fake-token' });
  });

  it('sends status filters to the server instead of filtering only the visible page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('parent@example.com').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'admin.emails.filterStatus: admin.emails.allStatuses' }));
    fireEvent.click(screen.getByRole('option', { name: 'admin.emails.status.failed' }));

    await waitFor(() => expect(mockApi).toHaveBeenCalledWith(expect.stringContaining('status=failed'), { token: 'fake-token' }));
  });
});
