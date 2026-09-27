import fixtures from './staffConsoleFixtures.json';
import sections from './staffSectionFixtures.json';
import type { StaffApi, StaffResult } from './staffConsoleApi';

/*
 * Development fixtures for the rebuilt staff console (the development
 * preview's `staff-console-*` screens). The same JSON answers the audit's
 * synthetic Core on the real routes (scripts/audits/lanes/staff.mjs), so the
 * preview and the audited routes render the same data: a stress-length name
 * and address, every verification status, an old grant due for review, a
 * pattern case, a failed email and one service down.
 *
 * W2T.2 adds the Content, Generation and Mentor-quality answers from
 * staffSectionFixtures.json: a stress-length course and lesson, a B.3
 * incident, a live activity with and without a risk category, packs, a run
 * with a failed, a salvaged and a skipped lesson, and a live run that trips
 * the cost, cache and failure alerts.
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
  return sectionAnswer(route, query, empty) ?? { ok: false, code: 'NOT_FOUND' };
}

/**
 * W2T.2: Content, Generation and Mentor quality (staffSectionFixtures.json;
 * the audit's synthetic Core answers from the same file). Empty is a new
 * deployment: no courses, nothing to review, no runs, no generation data
 * (Core answers the analytics and coach reads with DATA_UNAVAILABLE then).
 */
export function sectionAnswer(route: string, query: URLSearchParams, empty: boolean): StaffResult<unknown> | null {
  const ok = (data: unknown): StaffResult<unknown> => ({ ok: true, data });
  const g = sections.generation;
  if (route === '/admin/content') return ok(empty ? { courses: [], summary: { courses: { total: 0 }, lessons: { total: 0 } }, courseAssemblyIncidents: [] } : sections.content);
  if (route === '/admin/moderation') return ok(empty ? { lessons: [], total: 0 } : sections.moderation);
  if (route.startsWith('/admin/moderation/')) return route.endsWith(sections.lessonDetail.id) ? ok(sections.lessonDetail) : ok({ ...sections.lessonDetail, ...sections.moderation.lessons.find((lesson) => route.endsWith(lesson.id)) });
  if (route === '/admin/tutor/review-queue') return ok(empty ? { segments: [], total: 0 } : sections.liveQueue);
  if (route === '/admin/tutor/live-content/status') return ok(sections.liveStatus);
  if (route === '/admin/tutor/packs') return ok(empty ? { packs: [], total: 0 } : sections.packs);
  if (route === '/admin/content/learning-quality') return ok(sections.learningQuality);
  if (route === '/admin/generation') return ok(empty ? { tracks: [], runs: [] } : g.overview);
  if (route === '/admin/generation/live') return ok(empty ? { activeRuns: [] } : g.live);
  if (route.startsWith('/admin/generation/runs/')) return ok(g.runDetail);
  if (route.startsWith('/admin/generation/slots/')) return ok(g.slotDetail);
  if (route.startsWith('/admin/generation/snapshots/')) return ok(g.snapshots);
  if (route === '/admin/generation/compare') return query.get('runA') && query.get('runB') ? ok(g.compare) : { ok: false, code: 'VALIDATION_ERROR' };
  if (route === '/admin/generation/analytics') return empty ? { ok: false, code: 'DATA_UNAVAILABLE' } : ok(g.analytics);
  if (route === '/admin/generation/coach') return empty ? { ok: false, code: 'DATA_UNAVAILABLE' } : ok(g.coach);
  if (route === '/admin/mentor-quality') return ok(sections.mentorQuality);
  return null;
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
