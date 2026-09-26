import fixtures from './staffConsoleFixtures.json';
import type { StaffApi, StaffResult } from './staffConsoleApi';

/*
 * Development fixtures for the rebuilt staff console (the development
 * preview's `staff-console-*` screens). The same JSON answers the audit's
 * synthetic Core on the real routes (scripts/audits/lanes/staff.mjs), so the
 * preview and the audited routes render the same data: a stress-length name
 * and address, every verification status, an old grant due for review, a
 * pattern case, a failed email and one service down.
 *
 * `?state=` picks a whole-page state: loading (never answers), error, refused
 * (Core's 403), empty, or ready (default). Writes succeed unless
 * `?write=failed` or `?write=rejected`.
 */

export type FixtureState = 'ready' | 'loading' | 'error' | 'refused' | 'empty';

export function fixtureAnswer(path: string, state: FixtureState): StaffResult<unknown> | 'hold' {
  if (state === 'loading') return 'hold';
  if (state === 'error') return { ok: false, code: 'DATA_UNAVAILABLE' };
  if (state === 'refused') return { ok: false, code: 'FORBIDDEN' };
  const empty = state === 'empty';
  const ok = (data: unknown): StaffResult<unknown> => ({ ok: true, data });
  const route = path.split('?')[0]!;
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  if (route === '/admin/overview') return ok(empty ? { users: { total: 0, staff: 0, byRole: {} }, content: { courses: {}, lessons: {}, reviewQueue: 0 }, audit: { total: 0 } } : fixtures.overview);
  if (route === '/admin/health/services') return ok(empty ? { summary: { total: 0, down: 0 }, monitors: [] } : fixtures.health);
  if (route === '/admin/learning/retention') return ok(empty ? { buckets: [], byTopic: [] } : fixtures.retention);
  if (route === '/admin/users') return ok({ users: empty ? [] : fixtures.users });
  if (route === '/admin/users/timeline') return ok({ timeline: empty ? [] : fixtures.timeline });
  if (route === '/admin/insights/acquisition') return ok(empty ? { visitors: 0 } : fixtures.acquisition);
  if (route === '/admin/insights/funnel-integrity') return ok(empty ? { accountsCreated: 0, unobserved: 0 } : fixtures.funnelIntegrity);
  if (route === '/admin/insights/registrations') return ok(empty ? { entries: [] } : fixtures.registrations);
  if (route === '/admin/roles') return ok(empty ? { holders: [], summary: { totalHolders: 0, totalRoleAssignments: 0, totalPermissionAssignments: 0, roleCounts: {}, permissionCounts: {}, lastChangedAt: null } } : fixtures.roles);
  if (route === '/admin/roles/candidates') return ok({ candidates: empty ? [] : fixtures.candidates });
  if (route === '/admin/audit') {
    const entries = empty ? [] : fixtures.audit;
    return ok({ entries, total: empty ? 0 : 5311, limit: 50, offset: Number(query.get('offset') ?? 0) });
  }
  if (route === '/admin/reports') return ok({ cases: empty ? [] : fixtures.cases, total: empty ? 0 : fixtures.cases.length });
  if (route.startsWith('/admin/reports/')) {
    const subject = route.split('/')[3];
    const found = fixtures.cases.find((entry) => entry.subjectId === subject);
    return found ? ok({ ...found, reports: found.origin === 'pattern' ? fixtures.caseReports : fixtures.caseReports.slice(0, 1) }) : { ok: false, code: 'NOT_FOUND' };
  }
  if (route === '/admin/emails/logs') return ok({ entries: empty ? [] : fixtures.emailLogs, total: empty ? 0 : 948 });
  if (route === '/admin/emails/summary') return ok(empty ? { total: 0, statuses: {}, templates: {}, locales: {}, trend: [] } : fixtures.emailSummary);
  return { ok: false, code: 'NOT_FOUND' };
}

/** A StaffApi answered from the fixtures, for the preview entry. */
export function fixtureApi(state: FixtureState, write: 'ok' | 'failed' | 'rejected' = 'ok'): StaffApi {
  const answer = (path: string) => {
    const result = fixtureAnswer(path, state);
    return result === 'hold' ? new Promise<never>(() => {}) : Promise.resolve(result);
  };
  return {
    get: <T,>(path: string) => answer(path) as Promise<StaffResult<T>>,
    post: <T,>() => Promise.resolve((write === 'ok' ? { ok: true, data: {} } : { ok: false, code: write === 'rejected' ? 'ROLE_REJECTED' : 'DATA_UNAVAILABLE' }) as StaffResult<T>),
  };
}
