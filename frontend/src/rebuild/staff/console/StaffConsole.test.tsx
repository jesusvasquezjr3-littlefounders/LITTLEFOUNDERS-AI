import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-staff.json';
import enCore from '@/i18n/en-US/rebuild-core.json';
import { auditPath, reviewDue, staffViewer, type StaffApi, type StaffResult } from './staffConsoleApi';
import { chartSlice, DailyChart } from './DailyChart';
import { fixtureApi } from './staffConsoleFixtures';
import { StaffOverview } from './StaffOverview';
import { StaffUsers } from './StaffUsers';
import { StaffAccess } from './StaffAccess';
import { StaffAudit } from './StaffAudit';
import { StaffReports } from './StaffReports';
import { StaffEmails } from './StaffEmails';

/*
 * W2T.1: the rebuilt staff console at the component boundary. Every screen
 * asks Core only for what the viewer's grants open (G.1), shows loading,
 * empty, error, offline and refused states, and keeps every server contract
 * the legacy pages had (A.5 verification statuses, justification and
 * revocation; G.4 review-due grants; E.3's case resolution; server-side audit
 * and email filters). The real-route matrix (scripts/verify-staff-console.mjs)
 * repeats the population and layout checks in Chrome.
 */

const c = en.staffConsole;
const nav = enCore.appShell.staff;
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

type Handler = (path: string, body?: unknown) => StaffResult<unknown> | undefined;
function fakeApi(handler: Handler) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return (handler(path) ?? { ok: false, code: 'NOT_IN_TEST' }) as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return (handler(path, body) ?? { ok: true, data: {} }) as StaffResult<T>; },
  };
  return { api, gets, posts };
}
const ok = <T,>(data: T): StaffResult<T> => ({ ok: true, data });
const fail = (code: string): StaffResult<never> => ({ ok: false, code });

function Frame({ children, locale = 'en-US' }: { children: ReactNode; locale?: Locale }) {
  return <RebuildRoot theme="light" locale={locale}><RebuildProvider environment={{ theme: 'light', locale }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}
const viewer = (...permissions: string[]) => staffViewer(['admin'], permissions);
const superadmin = staffViewer(['superadmin'], []);
const links = (container: HTMLElement) => [...container.querySelectorAll<HTMLAnchorElement>('[data-console-section]')].map((a) => a.getAttribute('href'));

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});
afterEach(() => cleanup());

/* ------------------------------------------------------------------------- */

const OVERVIEW = (grants: string[]) => ({
  ...(grants.includes('manage_users') ? { users: { total: 3, staff: 1, byRole: { admin: 1, parent: 1, kid: 1 } } } : {}),
  ...(grants.includes('manage_content') ? { content: { courses: { published: 2, draft: 1 }, lessons: { published: 9, review: 4 }, reviewQueue: 4 } } : {}),
  ...(grants.includes('manage_support') ? { audit: { total: 77 } } : {}),
});

function overviewApi(grants: string[], health: StaffResult<unknown> = ok({ summary: { total: 2, down: 1 }, monitors: [{ id: 1, name: 'Core API', status: 1 }, { id: 2, name: 'Email', status: 0 }] })) {
  return fakeApi((path) => {
    if (path === '/admin/overview') return ok(OVERVIEW(grants));
    if (path === '/admin/health/services') return health;
    if (path === '/admin/learning/retention') return ok({ buckets: [{ bucket: '7', n: 12, avg_first_attempt_score: 81 }], byTopic: [{ slug: 'saving', title: 'Saving', n: 5, avgFirstAttemptScore: 55 }] });
    return undefined;
  });
}

describe('S1 Overview: mixed by the current grants (G.1)', () => {
  it('manage_support alone: the audit total and the support sections, nothing else requested', async () => {
    const { api, gets } = overviewApi(['manage_support']);
    const { container } = render(<Frame><StaffOverview api={api} viewer={viewer('manage_support')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.overview.body.auditEvents);
    expect(screen.getByText('77')).toBeTruthy();
    expect(links(container)).toEqual(['/admin/emails', '/admin/audit', '/admin/reports']);
    expect(gets).toEqual(['/admin/overview']);
    expect(screen.queryByText(c.overview.heading.content)).toBeNull();
    expect(screen.queryByText(c.overview.heading.health)).toBeNull();
  });

  it('manage_content: content status, the review queue, Content and Generation; no analytics reads', async () => {
    const { api, gets } = overviewApi(['manage_content']);
    const { container } = render(<Frame><StaffOverview api={api} viewer={viewer('manage_content')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText('4 lessons wait for review.');
    expect(links(container)).toEqual(['/admin/content', '/admin/generation']);
    expect(gets).toEqual(['/admin/overview']);
  });

  it('view_analytics: health in words and retention; one service down says so', async () => {
    const { api, gets } = overviewApi(['view_analytics']);
    const { container } = render(<Frame><StaffOverview api={api} viewer={viewer('view_analytics')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText('1 services are not answering.');
    expect(screen.getByText(c.overview.body.down)).toBeTruthy();
    expect(screen.getByText(c.overview.body.up)).toBeTruthy();
    await screen.findByText('7 days later');
    expect(gets.sort()).toEqual(['/admin/health/services', '/admin/learning/retention', '/admin/overview']);
    expect(links(container)).toEqual(['/admin/analytics', '/admin/intel', '/admin/mentor-quality']);
  });

  it('says when health monitoring is not configured instead of a generic failure', async () => {
    const { api } = overviewApi(['view_analytics'], fail('PULSE_UNCONFIGURED'));
    render(<Frame><StaffOverview api={api} viewer={viewer('view_analytics')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.overview.body.healthUnconfigured);
  });

  it('a superadmin sees every section, Roles & Access included, and links navigate in the app', async () => {
    const { api } = overviewApi(['manage_users', 'manage_content', 'view_analytics', 'manage_support']);
    const onNavigate = vi.fn();
    const { container } = render(<Frame><StaffOverview api={api} viewer={superadmin} onNavigate={onNavigate} /></Frame>);
    await screen.findByText(c.overview.heading.roles);
    expect(links(container)).toHaveLength(11);
    fireEvent.click(screen.getByText(c.overview.action.manageRoles));
    expect(onNavigate).toHaveBeenCalledWith('/admin/roles');
  });

  it('a grant withdrawn after the page opened reads as refused, with a retry', async () => {
    const { api, gets } = fakeApi(() => fail('FORBIDDEN'));
    render(<Frame><StaffOverview api={api} viewer={viewer('manage_support')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.common.heading.refused);
    fireEvent.click(screen.getByText(c.common.action.retry));
    await waitFor(() => expect(gets.filter((path) => path === '/admin/overview')).toHaveLength(2));
  });

  it('offline: says so in words, and a failed read shows the offline state', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const { api } = fakeApi(() => fail('OFFLINE'));
    render(<Frame><StaffOverview api={api} viewer={viewer('manage_support')} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.common.heading.offline);
    expect(screen.getByText(c.common.body.offlineNotice)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------------- */

const USERS = [
  { userId: USER, displayName: 'Alessandro_Bartolomeo_Villanueva_Rodriguez_2014', username: 'ale', locale: 'es-MX', createdAt: '2026-07-12T00:00:00Z', birthDate: '2016-08-08', roles: ['kid'], verification: null },
  { userId: OTHER, displayName: 'Paula Tutor', username: 'paula', locale: 'en-US', createdAt: '2026-07-13T00:00:00Z', birthDate: null, roles: ['parent', 'universal'], verification: 'staff-granted' },
  { userId: '33333333-3333-4333-8333-333333333333', displayName: 'Iván', username: null, locale: 'pt-BR', createdAt: '2026-07-14T00:00:00Z', birthDate: null, roles: ['parent'], verification: 'id-verified', ageRecordMinor: true },
];
function usersApi(revoke: StaffResult<unknown> = ok({ verification: 'revoked' })) {
  return fakeApi((path) => {
    if (path === '/admin/users') return ok({ users: USERS });
    if (path.startsWith('/admin/users/timeline')) return ok({ timeline: [{ date: '2026-09-01', count: 2 }, { date: '2026-09-02', count: 5 }] });
    if (path.startsWith('/admin/insights/acquisition')) return ok({ visitors: 40 });
    if (path.startsWith('/admin/insights/funnel-integrity')) return ok({ accountsCreated: 3, unobserved: 2 });
    if (path.startsWith('/admin/insights/registrations')) return ok({ entries: [{ role: 'kid', registrations: 1 }, { role: 'parent', registrations: 2 }] });
    if (path.endsWith('/verification/revoke')) return revoke;
    return undefined;
  });
}

describe('S3 Users (A.5)', () => {
  it('counts by role, language and age, and never asks analytics without view_analytics', async () => {
    const { api, gets } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    expect(screen.getAllByText(c.users.option['9-10']).length).toBeGreaterThan(0);
    expect(screen.getByText(c.users.heading.byLanguage)).toBeTruthy();
    expect(gets.some((path) => path.startsWith('/admin/insights'))).toBe(false);
    expect(screen.queryByText(c.users.heading.funnel)).toBeNull();
  });

  it('shows the visitors funnel against the server count with view_analytics', async () => {
    const { api } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users', 'view_analytics')} /></Frame>);
    await screen.findByText(c.users.heading.funnel);
    await screen.findByText('Browser analytics missed 2 of these accounts.');
    expect(screen.getByText('7.5%')).toBeTruthy();
  });

  it('three distinct verification statuses in words, never one badge', async () => {
    const { api } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    expect(screen.getByText(c.users.option['staff-granted'])).toBeTruthy();
    expect(screen.getByText(c.users.option['id-verified'])).toBeTruthy();
  });

  it('A.2/A.5: flags a Tutor whose age record says under 18, in the list and in the details, next to the revocation', async () => {
    const { api } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    expect(screen.getAllByText(c.users.option.ageRecordMinor)).toHaveLength(1);
    fireEvent.click(screen.getAllByText(c.common.action.open)[1]!);
    expect(within(await screen.findByRole('dialog')).queryByText(c.users.body.ageRecordMinor)).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: c.common.action.close }));
    fireEvent.click(screen.getAllByText(c.common.action.open)[2]!);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(c.users.body.ageRecordMinor)).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: c.users.action.revoke })).toBeTruthy();
  });

  it('filters the directory and clears the filters', async () => {
    const { api } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    fireEvent.change(screen.getByLabelText(c.users.body.search), { target: { value: 'does-not-exist' } });
    expect(screen.getByText(c.common.body.noMatch)).toBeTruthy();
    fireEvent.click(screen.getByText(c.common.action.clearFilters));
    fireEvent.change(screen.getByLabelText(c.users.body.role), { target: { value: 'kid' } });
    expect(screen.getByText('1 of 3 accounts')).toBeTruthy();
  });

  it('revokes a verification only with a reason and after a keep-first confirmation, then says so', async () => {
    const { api, posts } = usersApi();
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    fireEvent.click(screen.getAllByText(c.common.action.open)[1]!);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(OTHER)).toBeTruthy();
    expect(within(sheet).getByText(c.users.body.readOnly)).toBeTruthy();
    const revoke = within(sheet).getByRole('button', { name: c.users.action.revoke });
    expect((revoke as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText(c.users.body.reasonLabel), { target: { value: 'Fraud report #12 confirmed' } });
    fireEvent.click(within(sheet).getByRole('button', { name: c.users.action.revoke }));
    const confirm = await screen.findByRole('alertdialog');
    const buttons = within(confirm).getAllByRole('button');
    expect(buttons[0]!.textContent).toBe(c.users.action.keep);
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.click(buttons[1]!);
    await screen.findByText(c.users.body.revoked);
    expect(posts).toEqual([{ path: `/admin/users/${OTHER}/verification/revoke`, body: { reason: 'Fraud report #12 confirmed' } }]);
  });

  it('says when a revocation failed', async () => {
    const { api } = usersApi(fail('DATA_UNAVAILABLE'));
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText('3 of 3 accounts');
    fireEvent.click(screen.getAllByText(c.common.action.open)[2]!);
    const sheet = await screen.findByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText(c.users.body.reasonLabel), { target: { value: 'Mistaken grant, see ticket' } });
    fireEvent.click(within(sheet).getByRole('button', { name: c.users.action.revoke }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getAllByRole('button')[1]!);
    await screen.findByText(c.users.body.revokeFailed);
  });

  it('shows the empty directory as a state, not a blank table', async () => {
    const { api } = fakeApi((path) => (path === '/admin/users' ? ok({ users: [] }) : path.includes('timeline') ? ok({ timeline: [] }) : undefined));
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findByText(c.users.body.empty);
    await screen.findByText(c.chart.body.empty);
  });

  it('refuses a malformed payload as an error, never a crash', async () => {
    const { api } = fakeApi((path) => (path === '/admin/users' ? ok({ users: [{ nope: true }] }) : ok({})));
    render(<Frame><StaffUsers api={api} viewer={viewer('manage_users')} /></Frame>);
    await screen.findAllByText(c.common.heading.loadFailed);
  });
});

/* ------------------------------------------------------------------------- */

const OLD = '2026-01-02T12:00:00Z';
const HOLDERS = [
  { userId: USER, displayName: 'Staff One', username: 'staff_one', roles: ['admin'], permissions: ['manage_content'],
    roleAssignments: [{ role: 'admin', grantedAt: OLD, grantedBy: null }], permissionAssignments: [{ permission: 'manage_content', grantedAt: OLD, grantedBy: OTHER }], lastChangedAt: OLD },
  { userId: OTHER, displayName: 'Root', username: null, roles: ['superadmin'], permissions: [],
    roleAssignments: [{ role: 'superadmin', grantedAt: new Date().toISOString(), grantedBy: null }], permissionAssignments: [], lastChangedAt: null },
];
const REVIEWS = {
  cadenceDays: 90,
  grants: [
    { userId: USER, kind: 'role', grant: 'admin', grantedAt: OLD, lastReviewedAt: null, due: true, displayName: 'Staff One', username: 'staff_one' },
    { userId: USER, kind: 'permission', grant: 'manage_content', grantedAt: OLD, lastReviewedAt: null, due: true, displayName: 'Staff One', username: 'staff_one' },
    { userId: OTHER, kind: 'role', grant: 'superadmin', grantedAt: new Date().toISOString(), lastReviewedAt: null, due: false, displayName: 'Root', username: null },
  ],
  metrics: { total: 3, stale: 2, reviewedEver: 0, compliance: 1 / 3, staleRate: 2 / 3 },
};
function rolesApi(grant: StaffResult<unknown> = ok({ granted: true }), review: StaffResult<unknown> = ok({ recorded: true })) {
  return fakeApi((path) => {
    if (path === '/admin/roles') return ok({ holders: HOLDERS, summary: { totalHolders: 2, totalRoleAssignments: 2, totalPermissionAssignments: 1, roleCounts: { admin: 1, superadmin: 1 }, permissionCounts: {}, lastChangedAt: OLD } });
    if (path === '/admin/roles/reviews') return ok(REVIEWS);
    if (path.startsWith('/admin/roles/candidates')) return ok({ candidates: [{ userId: '44444444-4444-4444-8444-444444444444', displayName: 'Candidate', username: 'cand', roles: [] }] });
    if (path === '/admin/roles/grant') return grant;
    if (path === '/admin/roles/review') return review;
    return undefined;
  });
}

describe('S10 Roles & Access (A.5, G.1, G.4)', () => {
  it('lists the staff grants past their review, roles and staff access alike, with the log numbers (G.4)', async () => {
    const { api } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText('2 staff grants are past their 90-day review.');
    expect(screen.getByText(`Admin, last confirmed ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(OLD))}`, { exact: false })).toBeTruthy();
    expect(screen.getByText(c.access.body.reviewCompliance)).toBeTruthy();
    expect(reviewDue(REVIEWS as never).map((row) => row.grant)).toEqual(['admin', 'manage_content']);
    expect(reviewDue(null)).toEqual([]);
  });

  it('Keep access records the review with Core, and a vanished grant says so (G.4)', async () => {
    const { api, posts } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText('2 staff grants are past their 90-day review.');
    fireEvent.click(screen.getAllByRole('button', { name: c.access.action.keepAccess })[1]!);
    await screen.findByText(/kept\. The audit log has it\./);
    expect(posts).toEqual([{ path: '/admin/roles/review', body: { userId: USER, kind: 'permission', grant: 'manage_content' } }]);
    cleanup();
    const gone = rolesApi(undefined, fail('GRANT_NOT_HELD'));
    render(<Frame><StaffAccess api={gone.api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText('2 staff grants are past their 90-day review.');
    fireEvent.click(screen.getAllByRole('button', { name: c.access.action.keepAccess })[0]!);
    await screen.findByText(c.access.body.reviewNotHeld);
  });

  it('a Tutor grant needs a justification of 10 characters, which Core receives (A.5)', async () => {
    const { api, posts } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.access.heading.grant);
    fireEvent.change(screen.getByLabelText(c.access.body.userId), { target: { value: OTHER } });
    fireEvent.change(screen.getAllByLabelText(c.access.body.role)[0]!, { target: { value: 'parent' } });
    const grant = screen.getByRole('button', { name: c.access.action.grant }) as HTMLButtonElement;
    expect(grant.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(c.access.body.justification), { target: { value: 'Verified in person' } });
    expect(grant.disabled).toBe(false);
    fireEvent.click(grant);
    await screen.findByText('Tutor granted.');
    expect(posts).toEqual([{ path: '/admin/roles/grant', body: { userId: OTHER, role: 'parent', justification: 'Verified in person' } }]);
  });

  it('a minor age record refuses the Tutor grant and points to the age-correction queue (OD-3, F4-staff-ops)', async () => {
    const { api, posts } = rolesApi(fail('AGE_RECORD_MINOR'));
    const onNavigate = vi.fn();
    render(<Frame><StaffAccess api={api} onNavigate={onNavigate} /></Frame>);
    await screen.findByText(c.access.heading.grant);
    fireEvent.change(screen.getByLabelText(c.access.body.userId), { target: { value: OTHER } });
    fireEvent.change(screen.getAllByLabelText(c.access.body.role)[0]!, { target: { value: 'parent' } });
    fireEvent.change(screen.getByLabelText(c.access.body.justification), { target: { value: 'Verified in person' } });
    fireEvent.click(screen.getByRole('button', { name: c.access.action.grant }));
    await screen.findByText(c.access.body.ageRecordMinor);
    expect(screen.queryByText('Tutor granted.')).toBeNull();
    expect(posts).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: c.access.action.openAgeCorrections }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/age-corrections');
  });

  it('refuses an incomplete id before calling Core, and names a database refusal', async () => {
    const { api, posts } = rolesApi(fail('ROLE_REJECTED'));
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.access.heading.grant);
    fireEvent.change(screen.getByLabelText(c.access.body.userId), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: c.access.action.grant }));
    expect(screen.getByText(c.access.body.userIdInvalid)).toBeTruthy();
    expect(posts).toEqual([]);
    fireEvent.change(screen.getByLabelText(c.access.body.userId), { target: { value: OTHER } });
    fireEvent.click(screen.getByRole('button', { name: c.access.action.grant }));
    await screen.findByText(c.access.body.rejected);
  });

  it('finds a person from 2 characters and fills the id', async () => {
    const { api, gets } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findByText(c.access.heading.grant);
    fireEvent.click(screen.getByRole('button', { name: c.access.action.find }));
    const sheet = await screen.findByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText(c.access.body.searchPeople), { target: { value: 'C' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(gets.some((path) => path.startsWith('/admin/roles/candidates'))).toBe(false);
    fireEvent.change(within(sheet).getByLabelText(c.access.body.searchPeople), { target: { value: 'Cand' } });
    fireEvent.click(await within(sheet).findByRole('button', { name: c.access.action.choose }, { timeout: 2000 }));
    expect((screen.getByLabelText(c.access.body.userId) as HTMLInputElement).value).toBe('44444444-4444-4444-8444-444444444444');
    expect(gets).toContain('/admin/roles/candidates?q=Cand&limit=10');
  });

  it('staff access switches only for an admin; a superadmin opens everything (G.1)', async () => {
    const { api, posts } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findAllByText('Staff One');
    fireEvent.click(screen.getAllByRole('button', { name: c.access.action.manage })[0]!);
    let sheet = await screen.findByRole('dialog');
    expect(within(sheet).getAllByRole('switch')).toHaveLength(4);
    fireEvent.click(within(sheet).getByRole('switch', { name: c.permissions.option.manage_support }));
    await within(sheet).findByText(c.access.body.accessSaved);
    expect(posts).toEqual([{ path: '/admin/roles/permissions/grant', body: { userId: USER, permission: 'manage_support' } }]);
    fireEvent.click(within(sheet).getByRole('switch', { name: c.permissions.option.manage_content }));
    await waitFor(() => expect(posts.at(-1)).toEqual({ path: '/admin/roles/permissions/revoke', body: { userId: USER, permission: 'manage_content' } }));
    fireEvent.click(within(sheet).getByRole('button', { name: c.common.action.close }));
    fireEvent.click(screen.getAllByRole('button', { name: c.access.action.manage }).at(-1)!);
    sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryAllByRole('switch')).toHaveLength(0);
    expect(within(sheet).getByText(c.access.body.superadminAll)).toBeTruthy();
  });

  it('removes a role only after a keep-first confirmation', async () => {
    const { api, posts } = rolesApi();
    render(<Frame><StaffAccess api={api} onNavigate={vi.fn()} /></Frame>);
    await screen.findAllByText('Staff One');
    fireEvent.click(screen.getAllByRole('button', { name: c.access.action.manage })[0]!);
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Admin' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Staff One loses the Admin role now.')).toBeTruthy();
    expect(posts).toEqual([]);
    fireEvent.click(within(confirm).getByRole('button', { name: c.access.action.confirmRemove }));
    await waitFor(() => expect(posts).toEqual([{ path: '/admin/roles/revoke', body: { userId: USER, role: 'admin' } }]));
  });
});

/* ------------------------------------------------------------------------- */

const ENTRY = { id: 42, actorId: USER, action: 'admin.tutor_activity.review', subject: 'segment-1', detail: { status: 'approved' }, createdAt: '2026-08-09T12:00:00Z' };

describe('S9 Audit log', () => {
  it('the exact total, server paging and a read-only detail', async () => {
    const { api, gets } = fakeApi((path) => (path.startsWith('/admin/audit') ? ok({ entries: [ENTRY], total: 101, limit: 50, offset: Number(new URLSearchParams(path.split('?')[1]).get('offset')) }) : undefined));
    render(<Frame><StaffAudit api={api} /></Frame>);
    await screen.findByText('101');
    fireEvent.click(screen.getByRole('button', { name: c.common.action.next }));
    await waitFor(() => expect(gets.at(-1)).toBe('/admin/audit?limit=50&offset=50'));
    fireEvent.click(await screen.findByRole('button', { name: c.common.action.open }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(c.audit.body.immutable)).toBeTruthy();
    expect(within(sheet).getByText(/"status": "approved"/)).toBeTruthy();
  });

  it('filters on the server, and refuses an incomplete actor id or reversed dates first', async () => {
    const { api, gets } = fakeApi((path) => (path.startsWith('/admin/audit') ? ok({ entries: [ENTRY], total: 1, limit: 50, offset: 0 }) : undefined));
    render(<Frame><StaffAudit api={api} /></Frame>);
    fireEvent.click(await screen.findByRole('button', { name: c.audit.action.filters }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(c.audit.body.actor), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: c.audit.action.apply }));
    expect(screen.getByText(c.audit.body.actorInvalid)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(c.audit.body.actor), { target: { value: USER } });
    fireEvent.change(screen.getByLabelText(c.audit.body.from), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText(c.audit.body.to), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: c.audit.action.apply }));
    expect(screen.getByText(c.audit.body.dateInvalid)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(c.audit.body.to), { target: { value: '2026-09-03' } });
    fireEvent.click(screen.getByRole('button', { name: c.audit.action.apply }));
    await waitFor(() => expect(gets.at(-1)).toBe(auditPath({ action: '', actorId: USER, subject: '', from: '2026-09-02', to: '2026-09-03' }, 0)));
    expect(gets.at(-1)).toContain(`actorId=${USER}`);
    // Applying closes the sheet and says how many filters are on, with a way to clear them.
    await screen.findByText('3 filters on.');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.common.action.clearFilters }));
    await waitFor(() => expect(gets.at(-1)).toBe('/admin/audit?limit=50&offset=0'));
  });
});

/* ------------------------------------------------------------------------- */

const CASE = { subjectId: OTHER, origin: 'pattern', status: 'open', firstSeenAt: OLD, lastSeenAt: OLD, resolvedAt: null, reportCount: 3, openReportCount: 3 };

describe('E.3 Reports', () => {
  it('opens a case with its bounded reports and resolves it after confirmation', async () => {
    const { api, posts } = fakeApi((path) => {
      if (path.startsWith('/admin/reports?')) return ok({ cases: [CASE], total: 1 });
      if (path === `/admin/reports/${OTHER}`) return ok({ ...CASE, reports: [{ id: 'r1', reporterId: USER, category: 'harassment', note: 'Kept messaging', status: 'open', createdAt: OLD }] });
      return undefined;
    });
    render(<Frame><StaffReports api={api} /></Frame>);
    await screen.findByText(c.reports.body.open);
    fireEvent.click(screen.getByRole('button', { name: c.common.action.open }));
    const sheet = await screen.findByRole('dialog');
    await within(sheet).findByText(c.reports.option.harassment);
    expect(within(sheet).getByText(c.reports.body.patternHelp)).toBeTruthy();
    expect(within(sheet).getByText('Kept messaging')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: c.reports.action.resolve }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: c.reports.action.resolve }));
    await screen.findByText(c.reports.body.resolved);
    expect(posts).toEqual([{ path: `/admin/reports/${OTHER}/status`, body: { status: 'resolved' } }]);
  });

  it('a case sheet that reads on open still takes focus under React StrictMode (the useModal host race)', async () => {
    // Red before the one-line fix in design/overlays.tsx (useModal: a removed host is not ready): the trap focused
    // a panel inside the first, already removed host, and focus fell to <body> on the real /admin/reports route.
    render(<StrictMode><Frame><StaffReports api={fixtureApi('ready')} /></Frame></StrictMode>);
    const open = await screen.findAllByRole('button', { name: c.common.action.open });
    open[0]!.focus();
    fireEvent.click(open[0]!);
    const sheet = await screen.findByRole('dialog');
    expect(sheet.contains(document.activeElement)).toBe(true);
  });

  it('an empty queue is a state', async () => {
    const { api } = fakeApi(() => ok({ cases: [], total: 0 }));
    render(<Frame><StaffReports api={api} /></Frame>);
    await screen.findByText(c.reports.body.empty);
  });
});

/* ------------------------------------------------------------------------- */

const LOG = { id: 'log-1', messageId: 'message-1', to: 'parent@example.com', subject: 'Welcome', status: 'relayed', templateType: 'auth', locale: 'en-US', detail: { html: true }, createdAt: '2026-08-08T10:00:00Z' };
const SUMMARY = { total: 10, statuses: { relayed: 8, failed: 1, queued: 1 }, templates: { auth: 10 }, locales: { 'en-US': 10 }, trend: [{ date: '2026-08-08', count: 1 }] };

describe('S4 Emails', () => {
  it('asks for the first page and the 365-day summary, and filters status on the server', async () => {
    const { api, gets } = fakeApi((path) => (path.startsWith('/admin/emails/logs') ? ok({ entries: [LOG], total: 1 }) : path.startsWith('/admin/emails/summary') ? ok(SUMMARY) : undefined));
    render(<Frame><StaffEmails api={api} /></Frame>);
    await screen.findByText('parent@example.com');
    expect(gets).toContain('/admin/emails/logs?limit=25&offset=0');
    expect(gets).toContain('/admin/emails/summary?days=365');
    expect(screen.getByText('80%')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(c.emails.body.status), { target: { value: 'failed' } });
    await waitFor(() => expect(gets.at(-1)).toContain('status=failed'));
  });

  it('keeps the history usable when only the totals fail, and says which half failed', async () => {
    const { api } = fakeApi((path) => (path.startsWith('/admin/emails/logs') ? ok({ entries: [LOG], total: 1 }) : fail('DATA_UNAVAILABLE')));
    render(<Frame><StaffEmails api={api} /></Frame>);
    await screen.findByText(c.emails.body.summaryFailed);
    expect(screen.getByText('parent@example.com')).toBeTruthy();
  });

  it('both halves failing is one error with a retry', async () => {
    const { api } = fakeApi(() => fail('DATA_UNAVAILABLE'));
    render(<Frame><StaffEmails api={api} /></Frame>);
    await screen.findByText(c.common.heading.loadFailed);
    expect(screen.queryByText(c.emails.body.summaryFailed)).toBeNull();
  });
});

/* ------------------------------------------------------------------------- */

describe('the daily chart figures', () => {
  const points = [{ date: '2026-09-01', count: 1 }, { date: '2026-09-02', count: 4 }, { date: '2026-09-03', count: 2 }];
  it('daily: total, average, peak and first-to-last change of the period', () => {
    const slice = chartSlice(points, 'all', 'daily');
    expect([slice.total, slice.peak, slice.change, slice.average]).toEqual([7, 4, 1, 7 / 3]);
  });
  it('cumulative: a running total over the chosen period only', () => {
    expect(chartSlice(points, '7d', 'cumulative').values).toEqual([1, 5, 7]);
    expect(chartSlice([...Array(40)].map((_, i) => ({ date: `d${i}`, count: 1 })), '30d', 'daily').visible).toHaveLength(30);
  });
  it('draws on the design-system TrendChart: series hue (never primary), the average as a named rule, keyboard reading and a table', () => {
    const { container } = render(<Frame><DailyChart points={points} seriesLabel="Emails" defaultPeriod="all" /></Frame>);
    const figure = screen.getByRole('figure', { name: 'Emails' });
    expect(figure).toHaveTextContent('Peak 4 on');
    expect(container.querySelectorAll('.lf-viz-column.lf-viz-series-1')).toHaveLength(3);
    expect(container.querySelector('.lf-staff-plot-bar')).toBeNull();
    expect(within(figure).getByText(/^Average: /)).toBeInTheDocument();
    const readout = container.querySelector('.lf-viz-readout')!;
    expect(readout).toHaveAttribute('data-readout', '2026-09-03');
    fireEvent.keyDown(within(figure).getByRole('group'), { key: 'Home' });
    expect(readout).toHaveAttribute('data-readout', '2026-09-01');
    fireEvent.click(within(figure).getByRole('button', { name: c.chart.action.table }));
    expect(within(figure).getByRole('table')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: c.chart.option.cumulative }));
    expect(screen.getByRole('figure', { name: `Emails, ${c.chart.option.cumulative}` })).toHaveTextContent('7 in all');
    expect(container.querySelector('.lf-viz-line')).not.toBeNull();
  });
  it('page titles are the staff navigation labels', () => {
    expect(nav.users).toBe('Users');
  });
});
