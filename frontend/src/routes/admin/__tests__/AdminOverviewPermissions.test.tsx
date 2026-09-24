import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminOverviewPage } from '../AdminOverviewPage';

const auth = vi.hoisted(() => ({
  roles: ['admin'] as string[],
  adminPermissions: [] as string[],
  getToken: vi.fn(async () => 'synthetic-token'),
}));
const mockApi = vi.hoisted(() => vi.fn());
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

beforeEach(() => {
  auth.roles = ['admin'];
  auth.adminPermissions = [];
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/admin/overview') {
      const data: Record<string, unknown> = {};
      if (auth.adminPermissions.includes('manage_users')) data.users = { total: 2, staff: 1, byRole: { admin: 1, parent: 1 } };
      if (auth.adminPermissions.includes('manage_content')) data.content = { courses: { published: 1 }, lessons: { published: 3 }, reviewQueue: 1 };
      if (auth.adminPermissions.includes('manage_support')) data.audit = { total: 7 };
      return { data, error: null };
    }
    if (path === '/admin/health/services') return { data: { summary: { total: 0, down: 0 }, monitors: [] }, error: null };
    if (path === '/admin/learning/retention') return { data: { buckets: [], byTopic: [] }, error: null };
    throw Error(`Unexpected overview request: ${path}`);
  });
});

function renderOverview() {
  const result = render(<MemoryRouter><AdminOverviewPage /></MemoryRouter>);
  return result.container;
}

describe('Overview permission projection', () => {
  it('shows only support totals and destinations with manage_support', async () => {
    auth.adminPermissions = ['manage_support'];
    const container = renderOverview();
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/admin/overview', { token: 'synthetic-token' }));
    expect(container.querySelector('a[href="/admin/emails"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/audit"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/content"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/analytics"]')).not.toBeInTheDocument();
    expect(mockApi.mock.calls.map(([path]) => path)).toEqual(['/admin/overview']);
  });

  it('shows Content and Generation without opening analytics requests', async () => {
    auth.adminPermissions = ['manage_content'];
    const container = renderOverview();
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/admin/overview', { token: 'synthetic-token' }));
    expect(container.querySelector('a[href="/admin/content"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/generation"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/emails"]')).not.toBeInTheDocument();
    expect(mockApi.mock.calls.map(([path]) => path)).toEqual(['/admin/overview']);
  });

  it('reads health and retention only with view_analytics', async () => {
    auth.adminPermissions = ['view_analytics'];
    const container = renderOverview();
    await waitFor(() => expect(mockApi.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining([
      '/admin/overview', '/admin/health/services', '/admin/learning/retention',
    ])));
    expect(container.querySelector('a[href="/admin/analytics"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/content"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/emails"]')).not.toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});
