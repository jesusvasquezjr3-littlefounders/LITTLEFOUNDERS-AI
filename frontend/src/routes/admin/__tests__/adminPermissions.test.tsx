import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireStaffPermission } from '@/auth/RequireRole';
import { visibleAdminSections } from '../adminNav';

const auth = vi.hoisted(() => ({
  session: {} as object,
  roles: ['admin'] as string[],
  adminPermissions: [] as string[],
  meLoaded: true,
}));

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

beforeEach(() => {
  auth.roles = ['admin'];
  auth.adminPermissions = [];
});

function renderUsersRoute() {
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<RequireStaffPermission permission="manage_users"><p>User directory</p></RequireStaffPermission>} />
        <Route path="/learn" element={<p>Learn home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderContentRoute(path: '/admin/content' | '/admin/generation') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RequireStaffPermission permission="manage_content"><p>Content production</p></RequireStaffPermission>} />
        <Route path="/learn" element={<p>Learn home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAnalyticsRoute(path: '/admin/analytics' | '/admin/intel' | '/admin/insights') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RequireStaffPermission permission="view_analytics"><p>Analytics view</p></RequireStaffPermission>} />
        <Route path="/learn" element={<p>Learn home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSupportRoute(path: '/admin/emails' | '/admin/audit') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RequireStaffPermission permission="manage_support"><p>Support view</p></RequireStaffPermission>} />
        <Route path="/learn" element={<p>Learn home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Users staff grant in navigation and direct route', () => {
  it('hides and redirects an admin without manage_users', () => {
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === 'users')).toBe(false);
    renderUsersRoute();
    expect(screen.queryByText('User directory')).not.toBeInTheDocument();
    expect(screen.getByText('Learn home')).toBeInTheDocument();
  });

  it('admits an admin with manage_users', () => {
    auth.adminPermissions = ['manage_users'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === 'users')).toBe(true);
    renderUsersRoute();
    expect(screen.getByText('User directory')).toBeInTheDocument();
  });

  it('preserves superadmin admission without a granular grant', () => {
    auth.roles = ['superadmin'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === 'users')).toBe(true);
    renderUsersRoute();
    expect(screen.getByText('User directory')).toBeInTheDocument();
  });

  it('never grants a non-staff role the Users route even with a stray grant name', () => {
    auth.roles = ['parent'];
    auth.adminPermissions = ['manage_users'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions)).toEqual([]);
    renderUsersRoute();
    expect(screen.getByText('Learn home')).toBeInTheDocument();
  });
});

describe('Content and Generation staff grant in navigation and direct routes', () => {
  it.each(['/admin/content', '/admin/generation'] as const)('hides and redirects %s without manage_content', (path) => {
    const key = path.split('/').at(-1);
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === key)).toBe(false);
    auth.adminPermissions = ['manage_users', 'view_analytics', 'manage_support'];
    renderContentRoute(path);
    expect(screen.queryByText('Content production')).not.toBeInTheDocument();
    expect(screen.getByText('Learn home')).toBeInTheDocument();
  });

  it.each(['/admin/content', '/admin/generation'] as const)('admits %s with manage_content', (path) => {
    const key = path.split('/').at(-1);
    auth.adminPermissions = ['manage_content'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === key)).toBe(true);
    renderContentRoute(path);
    expect(screen.getByText('Content production')).toBeInTheDocument();
  });

  it('preserves Superadmin access without a granular grant', () => {
    auth.roles = ['superadmin'];
    expect(visibleAdminSections(auth.roles, []).map((section) => section.key)).toEqual(expect.arrayContaining(['content', 'generation']));
    renderContentRoute('/admin/content');
    expect(screen.getByText('Content production')).toBeInTheDocument();
  });
});

describe('Analytics, Intelligence and Insights staff grant', () => {
  it.each(['/admin/analytics', '/admin/intel', '/admin/insights'] as const)('redirects a direct %s link without view_analytics', (path) => {
    auth.adminPermissions = ['manage_users', 'manage_content', 'manage_support'];
    renderAnalyticsRoute(path);
    expect(screen.queryByText('Analytics view')).not.toBeInTheDocument();
    expect(screen.getByText('Learn home')).toBeInTheDocument();
  });

  it('shows Analytics and Intelligence links only with the grant', () => {
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).map((section) => section.key))
      .not.toEqual(expect.arrayContaining(['analytics', 'intel']));
    auth.adminPermissions = ['view_analytics'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).map((section) => section.key))
      .toEqual(expect.arrayContaining(['analytics', 'intel']));
    renderAnalyticsRoute('/admin/intel');
    expect(screen.getByText('Analytics view')).toBeInTheDocument();
  });

  it('preserves Superadmin admission', () => {
    auth.roles = ['superadmin'];
    renderAnalyticsRoute('/admin/analytics');
    expect(screen.getByText('Analytics view')).toBeInTheDocument();
  });
});

describe('Emails and Audit staff grant', () => {
  it.each(['/admin/emails', '/admin/audit'] as const)('hides and redirects %s without manage_support', (path) => {
    const key = path.split('/').at(-1);
    auth.adminPermissions = ['manage_users', 'manage_content', 'view_analytics'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === key)).toBe(false);
    renderSupportRoute(path);
    expect(screen.queryByText('Support view')).not.toBeInTheDocument();
    expect(screen.getByText('Learn home')).toBeInTheDocument();
  });

  it.each(['/admin/emails', '/admin/audit'] as const)('admits %s with manage_support', (path) => {
    const key = path.split('/').at(-1);
    auth.adminPermissions = ['manage_support'];
    expect(visibleAdminSections(auth.roles, auth.adminPermissions).some((section) => section.key === key)).toBe(true);
    renderSupportRoute(path);
    expect(screen.getByText('Support view')).toBeInTheDocument();
  });

  it('preserves Superadmin support admission without a granular grant', () => {
    auth.roles = ['superadmin'];
    renderSupportRoute('/admin/emails');
    expect(screen.getByText('Support view')).toBeInTheDocument();
  });
});
