import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuildProvider, RebuildRoot } from '@/rebuild/design/controls';
import { OVERVIEW_SECTIONS } from '@/rebuild/staff/console/StaffOverview';
import { staffViewer } from '@/rebuild/staff/console/staffConsoleApi';
import { isRebuiltStaffPath, STAFF_ROUTE_GRANTS } from '../staffGrants';
import { STAFF_PAGES } from '../staff';
import { StaffOverviewRoute, useStaffConsole } from '../staffConsole';

/*
 * W2T.1 route contracts: the rebuilt Overview's section list mirrors the one
 * table the route guards and the staff navigation read (staffGrants.ts); the
 * rebuilt sections render outside a legacy page body; the host reads grants
 * exactly as Core's requireAdminPermission does, and talks to Core through
 * the app's own client with the staff member's session.
 */

const auth = vi.hoisted(() => ({ roles: ['admin'] as string[], adminPermissions: ['manage_support'] as string[], getToken: vi.fn(async () => 'synthetic-token') }));
const core = vi.hoisted(() => vi.fn());
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', () => ({ api: core }));

beforeEach(() => {
  core.mockReset();
  core.mockImplementation(async (path: string) => (path === '/admin/overview' ? { data: { audit: { total: 5 } }, error: null } : { data: null, error: { code: 'FORBIDDEN', message: '' } }));
});

describe('staff console routes (W2T.1)', () => {
  it('the Overview section list is the route table minus Overview and the Insights redirect', () => {
    const table = STAFF_ROUTE_GRANTS.filter((route) => route.id !== 'overview' && !route.redirectTo);
    expect(OVERVIEW_SECTIONS.map((section) => [section.id, section.path, section.grant]).sort())
      .toEqual(table.map((route) => [route.id, `/${route.path}`, route.grant]).sort());
  });

  it('marks exactly the six rebuilt sections, and every section still has a page', () => {
    expect(STAFF_ROUTE_GRANTS.filter((route) => route.rebuilt).map((route) => route.id).sort()).toEqual(['audit', 'emails', 'overview', 'reports', 'roles', 'users']);
    expect(['/admin', '/admin/users', '/admin/emails/', '/admin/audit', '/admin/reports', '/admin/roles'].every(isRebuiltStaffPath)).toBe(true);
    expect(['/admin/content', '/admin/intel', '/admin/analytics', '/admin/generation', '/admin/insights', '/learn'].some(isRebuiltStaffPath)).toBe(false);
    for (const route of STAFF_ROUTE_GRANTS) expect(STAFF_PAGES[route.id], route.id).toBeTruthy();
  });

  it('reads grants as Core does: only an admin\'s named grants count, a superadmin holds all', () => {
    expect(staffViewer(['admin'], ['manage_users', 'bogus'])).toEqual({ superadmin: false, permissions: ['manage_users'] });
    expect(staffViewer(['parent'], ['manage_users'])).toEqual({ superadmin: false, permissions: [] });
    expect(staffViewer(['superadmin'], []).superadmin).toBe(true);
  });

  it('calls Core with the session token and maps an error envelope to its code', async () => {
    let hook: ReturnType<typeof useStaffConsole> | null = null;
    function Probe() { hook = useStaffConsole(); return null; }
    render(<MemoryRouter><Probe /></MemoryRouter>);
    expect(await hook!.api.get('/admin/overview')).toEqual({ ok: true, data: { audit: { total: 5 } } });
    expect(await hook!.api.post('/admin/reports/x/status', { status: 'resolved' })).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(core).toHaveBeenCalledWith('/admin/overview', { token: 'synthetic-token' });
    expect(core).toHaveBeenCalledWith('/admin/reports/x/status', { method: 'POST', body: { status: 'resolved' }, token: 'synthetic-token' });
  });

  it('mounts the rebuilt Overview on the real host with the signed-in grants', async () => {
    render(<MemoryRouter><RebuildRoot theme="light" locale="en-US"><RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
      <StaffOverviewRoute />
    </RebuildProvider></RebuildRoot></MemoryRouter>);
    await screen.findByText('5');
    await waitFor(() => expect(core.mock.calls.map(([path]) => path)).toEqual(['/admin/overview']));
    expect(document.querySelector('[data-console-section="/admin/content"], a[href="/admin/content"]')).toBeNull();
    expect(document.querySelector('a[href="/admin/audit"]')).not.toBeNull();
  });
});
