import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminUsersPage } from '../AdminUsersPage';

const { mockApi, mockGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
}));

const USERS = [
  {
    userId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Admin User',
    username: 'admin_user',
    locale: 'en-US',
    createdAt: '2026-07-12T00:00:00Z',
    birthDate: '2016-08-08',
    roles: ['admin', 'universal'],
  },
  {
    userId: '22222222-2222-4222-8222-222222222222',
    displayName: 'Kid User',
    username: 'kid_user',
    locale: 'es-MX',
    createdAt: '2026-07-13T00:00:00Z',
    birthDate: null,
    roles: ['kid'],
  },
];

vi.mock('@/lib/api', () => ({
  api: mockApi,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    roles: ['admin'],
    getToken: mockGetToken,
  }),
}));

function apiOk<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

beforeEach(() => {
  mockApi.mockImplementation((path: string) => {
    if (path === '/admin/users') return apiOk({ users: USERS });
    if (path.startsWith('/admin/users/timeline')) return apiOk({ timeline: [] });
    return apiOk({});
  });
  mockGetToken.mockResolvedValue('fake-token');
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AdminUsersPage />
    </MemoryRouter>,
  );
}

describe('AdminUsersPage', () => {
  it('shows the complete directory summary and human-readable age groups', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('admin.users.totalUsers')).toBeInTheDocument());
    expect(screen.getByText('admin.users.resultCount')).toBeInTheDocument();
    expect(screen.getAllByText('admin.users.ageGroups.9-10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0);
  });

  it('filters the directory and opens the expanded read-only inspector', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0));

    const search = screen.getByLabelText('admin.users.searchLabel');
    fireEvent.change(search, { target: { value: 'does-not-exist' } });
    expect(screen.getByText('admin.users.noMatch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('admin.users.clearFilters'));
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('admin.users.viewDetail')[0]!);
    expect(screen.getByText('admin.users.profileSnapshot')).toBeInTheDocument();
    expect(screen.getByText('admin.users.detailReadOnly')).toBeInTheDocument();
    expect(screen.getByText('11111111-1111-4111-8111-111111111111')).toBeInTheDocument();
  });
});
