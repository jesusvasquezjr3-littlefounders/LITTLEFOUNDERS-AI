import { readFileSync } from 'node:fs';
import { app } from './helpers.mjs';

/*
 * Lane 6 (staff): the rebuilt staff console on its real routes (W2T.1).
 *
 *   states     each rebuilt console screen, signed in as the population that
 *              opens it, plus its details sheets (reached by a real press) and
 *              its whole-page error, empty and refused states
 *   scenarios  staff populations by grant: a superadmin, an admin with only
 *              manage_support (the mixed Overview), and the same superadmin
 *              whose Core answers every console read with an error, nothing,
 *              or a 403 (the grant withdrawn after sign-in)
 *   respond    the console's Core reads, answered from the same fixtures the
 *              preview entry uses (rebuild/staff/console/staffConsoleFixtures.json)
 */
export const lane = 'staff';

const fixtures = JSON.parse(readFileSync(new URL('../../../src/rebuild/staff/console/staffConsoleFixtures.json', import.meta.url), 'utf8'));

const page = (screen) => `[data-screen="${screen}"]`;
const ready = (screen, also) => `${page(screen)} ${also}`;

export const states = [
  app('/admin@staff-super', '/admin', 'staff-super', ready('staff-overview', '[data-metric="auditEvents"]'), { readyAlso: '[data-console-section="roles"]' }),
  app('/admin@staff-support', '/admin', 'staff-support', ready('staff-overview', '[data-metric="auditEvents"]'), { readyAlso: '[data-console-section="reports"]' }),
  app('/admin/users@staff-super', '/admin/users', 'staff-super', ready('staff-users', '.lf-table-row'), { readyAlso: '.lf-staff-plot-svg' }),
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
  app('/admin/emails@staff-super', '/admin/emails', 'staff-super', ready('staff-emails', '.lf-table-row'), { readyAlso: '.lf-staff-plot-svg' }),
  app('/admin/emails@email', '/admin/emails', 'staff-super', ready('staff-emails', '.lf-table-row'),
    { open: ['[data-screen="staff-emails"] .lf-table-row:first-child .lf-table-cell:last-child button'] }),
  app('/admin/users@unavailable', '/admin/users', 'staff-unavailable', ready('staff-users', '[data-failure="loadFailed"]')),
  app('/admin@refused', '/admin', 'staff-refused', ready('staff-overview', '[data-failure="refused"]')),
  app('/admin/reports@empty', '/admin/reports', 'staff-empty', ready('staff-reports', '.lf-state--empty')),
  app('/admin/roles@empty', '/admin/roles', 'staff-empty', ready('staff-roles', '.lf-state--empty')),
];

const SUPER = { guest: false, ageBand: 'adult', roles: ['superadmin'], adminPermissions: [] };
export const scenarios = {
  'staff-super': { population: 'staff, superadmin', ...SUPER, consoleState: 'ready' },
  'staff-users': { population: 'staff, admin with manage_users only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['manage_users'], consoleState: 'ready' },
  'staff-support': { population: 'staff, admin with manage_support only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['manage_support'], consoleState: 'ready' },
  'staff-unavailable': { population: 'staff, superadmin; Core answers every console read with an error', ...SUPER, consoleState: 'error' },
  'staff-refused': { population: 'staff, superadmin; the grant withdrawn after sign-in (Core answers 403)', ...SUPER, consoleState: 'refused' },
  'staff-empty': { population: 'staff, superadmin; a new deployment with no data', ...SUPER, consoleState: 'empty' },
};

/** Every console request a staff scenario made (`METHOD /path (scenario)`), for verify-staff-console.mjs to prove what was never asked. */
export const consoleRequests = [];

/** Core's answers for the console, by scenario state (mirrors staffConsoleFixtures.ts fixtureAnswer). */
export function respond({ spec, scenario, path, request, ok }) {
  if (!spec.consoleState || !path.startsWith('/admin')) return undefined;
  consoleRequests.push(`${request.method} ${path} (${scenario})`);
  const state = spec.consoleState;
  if (request.method === 'POST') return ok({});
  if (state === 'error') return { status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic: unavailable' } } };
  if (state === 'refused') return { status: 403, body: { data: null, error: { code: 'FORBIDDEN', message: 'Synthetic: refused' } } };
  const empty = state === 'empty';
  const [route, search = ''] = path.split('?');
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
  if (route === '/admin/emails/summary') return ok(empty ? { total: 0, statuses: {}, templates: {}, locales: {}, trend: [] } : fixtures.emailSummary);
  return undefined;
}
