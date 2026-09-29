import { readFileSync } from 'node:fs';
import { app } from './helpers.mjs';

/*
 * Lane 6 (staff): the rebuilt staff console on its real routes (W2T.1-W2T.3).
 *
 *   states     each rebuilt console screen, signed in as the population that
 *              opens it, plus its details sheets (reached by a real press) and
 *              its whole-page error, empty and refused states
 *   scenarios  staff populations by grant: a superadmin, an admin with only
 *              manage_support (the mixed Overview), only manage_content (Content,
 *              Generation), only view_analytics (Mentor quality), and the same superadmin
 *              whose Core answers every console read with an error, nothing,
 *              or a 403 (the grant withdrawn after sign-in)
 *   respond    the console's Core reads, answered from the same fixtures the
 *              preview entry uses (rebuild/staff/console/staffConsoleFixtures.json)
 */
export const lane = 'staff';

const fixtures = JSON.parse(readFileSync(new URL('../../../src/rebuild/staff/console/staffConsoleFixtures.json', import.meta.url), 'utf8'));
// W2T.2: Content, Generation and Mentor quality (the same file the preview entry answers from).
const sections = JSON.parse(readFileSync(new URL('../../../src/rebuild/staff/console/staffSectionFixtures.json', import.meta.url), 'utf8'));
// W2T.3: Analytics & Health and Learning intel (with Insights).
const insight = JSON.parse(readFileSync(new URL('../../../src/rebuild/staff/console/staffInsightFixtures.json', import.meta.url), 'utf8'));
// W2T.4: the programme metrics and support tools.
const programme = JSON.parse(readFileSync(new URL('../../../src/rebuild/staff/console/staffProgrammeFixtures.json', import.meta.url), 'utf8'));

const page = (screen) => `[data-screen="${screen}"]`;
const ready = (screen, also) => `${page(screen)} ${also}`;

export const states = [
  app('/admin@staff-super', '/admin', 'staff-super', ready('staff-overview', '[data-metric="auditEvents"]'), { readyAlso: '[data-console-section="roles"]' }),
  app('/admin@staff-support', '/admin', 'staff-support', ready('staff-overview', '[data-metric="auditEvents"]'), { readyAlso: '[data-console-section="reports"]' }),
  app('/admin/users@staff-super', '/admin/users', 'staff-super', ready('staff-users', '.lf-table-row'), { readyAlso: '.lf-viz-plot' }),
  app('/admin/users@details', '/admin/users', 'staff-super', ready('staff-users', '.lf-table-row'),
    { open: ['[data-screen="staff-users"] .lf-table-row:nth-child(3) .lf-table-cell:last-child button'] }),
  app('/admin/roles@staff-super', '/admin/roles', 'staff-super', ready('staff-roles', '.lf-table-row')),
  app('/admin/roles@holder', '/admin/roles', 'staff-super', ready('staff-roles', '.lf-table-row'),
    { open: ['[data-screen="staff-roles"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/roles@find', '/admin/roles', 'staff-super', ready('staff-roles', '[data-form="grant"]'),
    { open: ['[data-form="grant"] button[aria-haspopup="dialog"]'] }),
  app('/admin/audit@staff-super', '/admin/audit', 'staff-super', ready('staff-audit', '.lf-table-row')),
  app('/admin/audit@filters', '/admin/audit', 'staff-super', ready('staff-audit', '.lf-table-row'),
    { open: ['[data-screen="staff-audit"] .lf-staff-head-actions button[aria-haspopup="dialog"]'] }),
  app('/admin/audit@event', '/admin/audit', 'staff-super', ready('staff-audit', '.lf-table-row'),
    { open: ['[data-screen="staff-audit"] .lf-table-row:nth-child(2) .lf-table-cell:last-child button'] }),
  app('/admin/reports@staff-super', '/admin/reports', 'staff-super', ready('staff-reports', '.lf-table-row')),
  app('/admin/reports@case', '/admin/reports', 'staff-super', ready('staff-reports', '.lf-table-row'),
    { open: ['[data-screen="staff-reports"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/emails@staff-super', '/admin/emails', 'staff-super', ready('staff-emails', '.lf-table-row'), { readyAlso: '.lf-viz-plot' }),
  app('/admin/emails@email', '/admin/emails', 'staff-super', ready('staff-emails', '.lf-table-row'),
    { open: ['[data-screen="staff-emails"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/users@unavailable', '/admin/users', 'staff-unavailable', ready('staff-users', '[data-failure="loadFailed"]')),
  app('/admin@refused', '/admin', 'staff-refused', ready('staff-overview', '[data-failure="refused"]')),
  app('/admin/reports@empty', '/admin/reports', 'staff-empty', ready('staff-reports', '.lf-state--empty')),
  // W2T.4: the support tools, the family and trust metrics, and the C.24 owner roster (superadmin holds manage_users).
  app('/admin/reports@support', '/admin/reports?view=support', 'staff-support', ready('staff-reports', '[data-tool="retention-sweep"] .lf-staff-facts')),
  app('/admin/intel@families', '/admin/intel?view=families', 'staff-analytics', ready('staff-intel', '[data-metric-card="stateIntegrity"] .lf-table-row')),
  app('/admin/analytics@trust', '/admin/analytics?view=trust', 'staff-analytics', ready('staff-analytics', '[data-metric-card="accountDeletions"] .lf-staff-facts')),
  app('/admin/mentor-quality@owners', '/admin/mentor-quality', 'staff-super', ready('staff-mentor-quality', '[data-form="mentor-owner"]')),
  app('/admin/roles@empty', '/admin/roles', 'staff-empty', ready('staff-roles', '.lf-state--empty')),
  // W2T.2: Content (S2, B.3, G.2, C.5, C.6, S05.3d), Generation (S7) and Mentor quality (C.24).
  app('/admin/content@staff-super', '/admin/content', 'staff-super', ready('staff-content', '.lf-table-row'), { readyAlso: '[data-incidents]' }),
  app('/admin/content@staff-content', '/admin/content', 'staff-content', ready('staff-content', '.lf-table-row')),
  app('/admin/content@course', '/admin/content', 'staff-super', ready('staff-content', '.lf-table-row'),
    { open: ['[data-screen="staff-content"] .lf-table-row:nth-child(2) .lf-table-cell:last-child button'] }),
  app('/admin/content@review', '/admin/content?view=review', 'staff-super', ready('staff-content', '.lf-table-row')),
  app('/admin/content@lesson', '/admin/content?view=review', 'staff-super', ready('staff-content', '.lf-table-row'),
    { open: ['[data-screen="staff-content"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/content@live', '/admin/content?view=live', 'staff-super', ready('staff-content', '[data-screen="staff-live-content-packs"]'),
    { readyAlso: '[data-screen="staff-content"] .lf-table-row' }),
  app('/admin/content@activity', '/admin/content?view=live', 'staff-super', ready('staff-content', '.lf-table-row'),
    { open: ['[data-screen="staff-content"] .lf-table-row:nth-child(2) .lf-table-cell:last-child button'] }),
  app('/admin/content@quality', '/admin/content?view=quality', 'staff-super', ready('staff-content', '[data-screen="learning-quality"] form')),
  app('/admin/content@empty', '/admin/content', 'staff-empty', ready('staff-content', '.lf-state--empty')),
  app('/admin/generation@staff-super', '/admin/generation', 'staff-super', ready('staff-generation', '.lf-staff-stages')),
  app('/admin/generation@history', '/admin/generation?view=history', 'staff-content', ready('staff-generation', '.lf-table-row'),
    { readyAlso: '[data-screen="staff-generation"] .lf-viz-plot' }),
  app('/admin/generation@slot', '/admin/generation?view=history', 'staff-super', ready('staff-generation', '.lf-table-row'),
    { open: ['[data-screen="staff-generation"] .lf-table-row:nth-child(3) .lf-table-cell:last-child button'] }),
  app('/admin/generation@trends', '/admin/generation?view=trends', 'staff-super', ready('staff-generation', '.lf-viz-plot')),
  app('/admin/generation@coach', '/admin/generation?view=coach', 'staff-super', ready('staff-generation', '.lf-staff-proposals')),
  app('/admin/generation@empty', '/admin/generation', 'staff-empty', ready('staff-generation', '.lf-state--empty')),
  app('/admin/mentor-quality@staff-analytics', '/admin/mentor-quality', 'staff-analytics', ready('staff-mentor-quality', '[data-screen="staff-mentor-quality-signals"]')),
  app('/admin/mentor-quality@refused', '/admin/mentor-quality', 'staff-refused', ready('staff-mentor-quality', '[data-failure="refused"]')),
  // W2T.3: Analytics & Health (S5) in its five views, and Learning intel (S6) with Insights (S8, G.5).
  app('/admin/analytics@staff-analytics', '/admin/analytics', 'staff-analytics', ready('staff-analytics', '.lf-viz-plot'), { readyAlso: '[data-metric="external"]' }),
  app('/admin/analytics@web', '/admin/analytics?view=web', 'staff-analytics', ready('staff-analytics', '.lf-staff-map-svg'), { readyAlso: '[data-screen="staff-analytics"] .lf-table-row' }),
  app('/admin/analytics@behavior', '/admin/analytics?view=behavior', 'staff-analytics', ready('staff-analytics', '.lf-viz-plot'), { readyAlso: '.lf-viz-bars' }),
  app('/admin/analytics@health', '/admin/analytics?view=health', 'staff-analytics', ready('staff-analytics', '.lf-table-row')),
  app('/admin/analytics@tools', '/admin/analytics?view=tools', 'staff-super', ready('staff-analytics', '[data-form="exclusion"]')),
  app('/admin/analytics@empty', '/admin/analytics', 'staff-empty', ready('staff-analytics', '[data-metric="external"]')),
  app('/admin/analytics@refused', '/admin/analytics', 'staff-refused', ready('staff-analytics', '[data-failure="refused"]')),
  app('/admin/intel@staff-analytics', '/admin/intel', 'staff-analytics', ready('staff-intel', '.lf-viz-plot'), { readyAlso: '[data-metric="dau"]' }),
  app('/admin/intel@insights', '/admin/intel?view=insights', 'staff-analytics', ready('staff-intel', '.lf-table-row'), { readyAlso: '[data-screen="staff-intel"] .lf-viz-plot' }),
  app('/admin/intel@course', '/admin/intel?view=insights', 'staff-super', ready('staff-intel', '.lf-table-row'),
    { open: ['[data-screen="staff-intel"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/intel@retention', '/admin/intel?view=retention', 'staff-analytics', ready('staff-intel', '.lf-table-row')),
  app('/admin/intel@people', '/admin/intel?view=people', 'staff-analytics', ready('staff-intel', '.lf-viz-bars')),
  app('/admin/intel@operations', '/admin/intel?view=operations', 'staff-analytics', ready('staff-intel', '.lf-table-row')),
  app('/admin/intel@empty', '/admin/intel?view=insights', 'staff-empty', ready('staff-intel', '.lf-state--empty')),
  // GAP-FIX-R4 (02 §7 item 10): the E.4 age-correction queue (manage_users), its request sheet and its empty queue.
  app('/admin/age-corrections@staff-super', '/admin/age-corrections', 'staff-super', ready('staff-age-corrections', '.lf-table-row')),
  app('/admin/age-corrections@request', '/admin/age-corrections', 'staff-super', ready('staff-age-corrections', '.lf-table-row'),
    { open: ['[data-screen="staff-age-corrections"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/age-corrections@staff-users', '/admin/age-corrections', 'staff-users', ready('staff-age-corrections', '.lf-table-row'),
    { open: ['[data-screen="staff-age-corrections"] .lf-table-row:nth-child(2) .lf-table-cell:last-child button'] }),
  app('/admin/age-corrections@empty', '/admin/age-corrections', 'staff-empty', ready('staff-age-corrections', '.lf-state--empty')),
];

/*
 * GET /admin/age-corrections (backend admin routes, E.4): what Core keeps of a request, never a name or a day of
 * birth. Pending requests for the default filter; `all` adds the decided ones.
 */
const AGE_CORRECTIONS = [
  { id: 'a1f0c2d4-0000-4000-8000-000000000001', userId: '6c7e2b9a-5d41-4f3e-9a8b-1c2d3e4f5a61', status: 'pending', fromBand: '13_to_17', requestedBand: 'adult',
    requestedBirthMonth: null, reason: null, createdAt: '2026-09-26T14:05:00.000Z', decidedAt: null, decidedBy: null },
  { id: 'a1f0c2d4-0000-4000-8000-000000000002', userId: '0b9d8c7e-6f5a-4b3c-8d2e-1f0a9b8c7d62', status: 'pending', fromBand: 'adult', requestedBand: '13_to_17',
    requestedBirthMonth: '2011-04', reason: null, createdAt: '2026-09-27T09:40:00.000Z', decidedAt: null, decidedBy: null },
  { id: 'a1f0c2d4-0000-4000-8000-000000000003', userId: '3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a663', status: 'approved', fromBand: '13_to_17', requestedBand: 'adult',
    requestedBirthMonth: null, reason: 'evidence_verified', createdAt: '2026-09-20T11:00:00.000Z', decidedAt: '2026-09-21T16:30:00.000Z', decidedBy: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c64' },
];

const SUPER = { guest: false, ageBand: 'adult', roles: ['superadmin'], adminPermissions: [] };
export const scenarios = {
  'staff-super': { population: 'staff, superadmin', ...SUPER, consoleState: 'ready' },
  'staff-users': { population: 'staff, admin with manage_users only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['manage_users'], consoleState: 'ready' },
  'staff-support': { population: 'staff, admin with manage_support only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['manage_support'], consoleState: 'ready' },
  'staff-content': { population: 'staff, admin with manage_content only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['manage_content'], consoleState: 'ready' },
  'staff-analytics': { population: 'staff, admin with view_analytics only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['view_analytics'], consoleState: 'ready' },
  'staff-unavailable': { population: 'staff, superadmin; Core answers every console read with an error', ...SUPER, consoleState: 'error' },
  'staff-refused': { population: 'staff, superadmin; the grant withdrawn after sign-in (Core answers 403)', ...SUPER, consoleState: 'refused' },
  'staff-empty': { population: 'staff, superadmin; a new deployment with no data', ...SUPER, consoleState: 'empty' },
};

/** Every console request a staff scenario made (`METHOD /path (scenario)`), for verify-staff-console.mjs to prove what was never asked. */
export const consoleRequests = [];

/** Core's answers for the console, by scenario state (mirrors staffConsoleFixtures.ts fixtureAnswer). */
export function respond({ spec, scenario, path, request, ok }) {
  if (!spec.consoleState || !path.startsWith('/admin')) return undefined;
  // The synthetic Core hands lanes the pathname; the query (a breakdown's dimension, a filter) comes from the request itself.
  const search = new URL(request.url).search;
  consoleRequests.push(`${request.method} ${path}${search} (${scenario})`);
  const state = spec.consoleState;
  if (request.method === 'POST' || request.method === 'DELETE') return ok({});
  if (state === 'error') return { status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic: unavailable' } } };
  if (state === 'refused') return { status: 403, body: { data: null, error: { code: 'FORBIDDEN', message: 'Synthetic: refused' } } };
  const empty = state === 'empty';
  const route = path.split('?')[0];
  const query = new URLSearchParams(search);
  // Core projects the overview by grant: each part only for its grant (G.1).
  if (route === '/admin/overview') {
    const has = (grant) => spec.roles.includes('superadmin') || (spec.adminPermissions ?? []).includes(grant);
    const all = empty ? { users: { total: 0, staff: 0, byRole: {} }, content: { courses: {}, lessons: {}, reviewQueue: 0 }, audit: { total: 0 } } : fixtures.overview;
    return ok({ ...(has('manage_users') ? { users: all.users } : {}), ...(has('manage_content') ? { content: all.content } : {}), ...(has('manage_support') ? { audit: all.audit } : {}) });
  }
  if (route === '/admin/health/services') return ok(empty ? { summary: { total: 0, down: 0 }, monitors: [] } : fixtures.health);
  if (route === '/admin/learning/retention') return ok(empty ? { buckets: [], byTopic: [] } : fixtures.retention);
  if (route === '/admin/users') return ok({ users: empty ? [] : fixtures.users });
  if (route === '/admin/users/timeline') return ok({ timeline: empty ? [] : fixtures.timeline });
  if (route === '/admin/insights/acquisition') return ok(empty ? { visitors: 0 } : fixtures.acquisition);
  if (route === '/admin/insights/funnel-integrity') return ok(empty ? { accountsCreated: 0, unobserved: 0 } : fixtures.funnelIntegrity);
  if (route === '/admin/insights/registrations') return ok(empty ? { entries: [] } : fixtures.registrations);
  if (route === '/admin/roles') return ok(empty ? { holders: [], summary: { totalHolders: 0, totalRoleAssignments: 0, totalPermissionAssignments: 0, roleCounts: {}, permissionCounts: {}, lastChangedAt: null } } : fixtures.roles);
  if (route === '/admin/roles/candidates') return ok({ candidates: empty ? [] : fixtures.candidates });
  if (route === '/admin/audit') return ok({ entries: empty ? [] : fixtures.audit, total: empty ? 0 : 5311, limit: 50, offset: Number(query.get('offset') ?? 0) });
  if (route === '/admin/reports') return ok({ cases: empty ? [] : fixtures.cases, total: empty ? 0 : fixtures.cases.length });
  if (route.startsWith('/admin/reports/')) {
    const found = fixtures.cases.find((entry) => entry.subjectId === route.split('/')[3]);
    return found ? ok({ ...found, reports: found.origin === 'pattern' ? fixtures.caseReports : fixtures.caseReports.slice(0, 1) })
      : { status: 404, body: { data: null, error: { code: 'NOT_FOUND', message: 'Synthetic: no case' } } };
  }
  if (route === '/admin/emails/logs') return ok({ entries: empty ? [] : fixtures.emailLogs, total: empty ? 0 : 948 });
  if (route === '/admin/age-corrections') {
    const status = query.get('status') ?? 'pending';
    return ok({ requests: empty ? [] : AGE_CORRECTIONS.filter((entry) => status === 'all' || entry.status === status) });
  }
  if (route === '/admin/emails/summary') return ok(empty ? { total: 0, statuses: {}, templates: {}, locales: {}, trend: [] } : fixtures.emailSummary);
  return sectionRespond(route, query, empty, ok);
}

/** W2T.2 answers (mirrors staffConsoleFixtures.ts sectionAnswer). */
function sectionRespond(route, query, empty, ok) {
  const unavailable = { status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic: no generation data' } } };
  const g = sections.generation;
  if (route === '/admin/content') return ok(empty ? { courses: [], summary: { courses: { total: 0 }, lessons: { total: 0 } }, courseAssemblyIncidents: [] } : sections.content);
  if (route === '/admin/moderation') return ok(empty ? { lessons: [], total: 0 } : sections.moderation);
  if (route.startsWith('/admin/moderation/')) return ok({ ...sections.lessonDetail, ...(sections.moderation.lessons.find((lesson) => route.endsWith(lesson.id)) ?? {}) });
  if (route === '/admin/tutor/review-queue') return ok(empty ? { segments: [], total: 0 } : sections.liveQueue);
  if (route === '/admin/tutor/live-content/status') return ok(sections.liveStatus);
  if (route === '/admin/tutor/packs') return ok(empty ? { packs: [], total: 0 } : sections.packs);
  if (route === '/admin/content/learning-quality') return ok(sections.learningQuality);
  if (route === '/admin/generation') return ok(empty ? { tracks: [], runs: [] } : g.overview);
  if (route === '/admin/generation/live') return ok(empty ? { activeRuns: [] } : g.live);
  if (route.startsWith('/admin/generation/runs/')) return ok(g.runDetail);
  if (route.startsWith('/admin/generation/slots/')) return ok(g.slotDetail);
  if (route.startsWith('/admin/generation/snapshots/')) return ok(g.snapshots);
  if (route === '/admin/generation/compare') return query.get('runA') && query.get('runB') ? ok(g.compare) : undefined;
  if (route === '/admin/generation/analytics') return empty ? unavailable : ok(g.analytics);
  if (route === '/admin/generation/coach') return empty ? unavailable : ok(g.coach);
  if (route === '/admin/mentor-quality') return ok(sections.mentorQuality);
  return insightRespond(route, query, empty, ok);
}

/** W2T.3 answers (mirrors staffConsoleFixtures.ts insightAnswer). */
function insightRespond(route, query, empty, ok) {
  const a = insight.analytics;
  const i = insight.intel;
  if (route === '/admin/analytics/overview') return ok(empty ? { ...a.webOverview, aggregate: { visitors: 0, pageviews: 0, bounce_rate: 0, visit_duration: 0 }, timeseries: [], previous: null } : a.webOverview);
  if (route === '/admin/analytics/breakdown') {
    if (empty) return ok({ ...a.breakdown, rows: [] });
    const dimension = query.get('dimension');
    return ok(dimension === 'country' ? a.countries : dimension === 'region' ? a.regions : a.breakdown);
  }
  if (route === '/admin/analytics/behavior') return ok(empty ? { ...a.behavior, pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0, outOfBoundaryPageviews: 0 } : a.behavior);
  if (route === '/admin/analytics/behavior/series') return ok(empty ? { ...a.behaviorSeries, series: [] } : a.behaviorSeries);
  if (route === '/admin/analytics/behavior/breakdown') return ok(empty ? { ...a.behaviorBreakdown, rows: [] } : a.behaviorBreakdown);
  if (route === '/admin/analytics/exclusions') return ok(empty ? { ...a.exclusions, active: [], suggestions: [] } : a.exclusions);
  if (route === '/admin/insights/audience') return ok(empty ? { days: 30, series: [], entries: [], totals: { anonymous: 0, registered: 0, staff: 0 }, externalShare: null } : a.audience);
  if (route === '/admin/insights/activity') return ok(empty ? { days: 30, entries: [], users: [] } : a.activity);
  if (route === '/admin/insights/adoption') return ok(empty ? { entries: [] } : a.adoption);
  if (route === '/admin/insights/sessions') return ok(empty ? { entries: [] } : a.sessions);
  if (route === '/admin/intel/metrics/summary') return ok(empty ? { ...i.summary, dau: 0, wau: 0, mau: 0, totalEvents: 0, week1Retention: 0, activationRate: 0, peakDailyUsers: 0, adoption: [] } : i.summary);
  if (route === '/admin/intel/metrics/trends') return ok(empty ? [] : i.trend);
  if (route === '/admin/intel/funnels/activation') return ok(empty ? [] : i.funnel);
  if (route === '/admin/intel/anomalies/active') return ok(empty ? [] : i.anomalies);
  if (route === '/admin/intel/quality/staff-exclusion') return ok(i.staffExclusion);
  if (route === '/admin/insights/families') return ok(empty ? { summary: { ...i.families.summary, listed_children: 0 }, children: [], consent: i.families.consent } : i.families);
  if (route === '/admin/intel/retention/cohorts') return ok(empty ? [] : i.cohorts);
  if (route === '/admin/intel/churn/risk') return ok(empty ? [] : i.churn);
  if (route === '/admin/intel/experiments') return ok(empty ? [] : i.experiments);
  if (route === '/admin/intel/alerts') return ok(empty ? [] : i.alerts);
  if (route === '/admin/intel/alerts/delivery') return ok(empty ? { ...i.alertDelivery, triggered: 0, delivered: 0, failed: 0, unconfigured: 0, pending: 0, rate: null } : i.alertDelivery);
  if (route === '/admin/analytics/consent-coverage') return ok(empty ? { ...i.disclosure, teens: { active: 0, disclosed: 0, optedIn: 0, optedOut: 0, protectedOrigin: 0, measuredWithoutOptIn: 0, covered: 0 }, guests: { active: 0, suppressed: 0, measured: 0 }, covered: 0, population: 0, coverage: null, status: 'no_data' } : i.disclosure);
  if (route === '/admin/intel/learning/overview') return ok(empty ? { ...i.learning, snapshot: { courses: 0, lessons: 0, attempts: 0, learners: 0, avgScore: null, firstTryAvgScore: null, hintRate: null, retryRate: null, avgSecondsPerAttempt: null, evidenceStatus: 'awaiting_evidence' }, courses: [], lessons: [], learners: [], trends: [] } : i.learning);
  if (route === '/admin/intel/learning/content-health') return ok(empty ? { skills: [] } : i.skills);
  if (route.startsWith('/admin/intel/learning/learners/')) return ok(i.learner);
  // W2T.4 (mirrors staffConsoleFixtures.ts programmeAnswer).
  if (empty && route in programme.empty) return ok(programme.empty[route]);
  if (route in programme.routes) return ok(programme.routes[route]);
  return undefined;
}
