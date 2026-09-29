import { app, gallery, preview, shell } from './helpers.mjs';

/*
 * Lane 0 (core): the S03 component gallery, the shared shells, the preview
 * index and the standalone state screens.
 */
export const lane = 'core';

const overlays = ['dialog', 'confirm', 'sheet', 'popover', 'menu', 'toast'];
const DELETION = '[data-shell="single-state"]';

export const states = [
  // S03 component gallery (specimens: every string budgeted, no first-view total).
  gallery('system', { screen: 'system' }),
  gallery('gallery', { screen: 'gallery' }),
  gallery('overlays', { screen: 'overlays' }),
  ...overlays.map((name) => gallery(`overlays-${name}`, { screen: 'overlays' }, { open: [`[data-open=${name}]`] })),
  gallery('overlays-sheet-confirm', { screen: 'overlays' }, { open: ['[data-open=sheet]', '[data-open=sheet-confirm]'] }),
  // Shells are screens: one h1, the proportion rules, per-string budgets.
  shell('shell-learner', 'learner'),
  shell('shell-teen', 'teen'),
  shell('shell-tutor', 'tutor'),
  shell('shell-staff', 'staff'),
  shell('shell-staff-limited', 'staff-limited'),
  shell('shell-staff-menu', 'staff', { widths: [320, 375, 768], open: ['.lf-appbar-menu'] }),
  shell('shell-site', 'site', { budget: 'site' }),
  shell('shell-site-menu', 'site', { budget: 'site', widths: [320, 375, 768], open: ['.lf-site-menu'] }),
  shell('shell-auth', 'auth'),
  shell('shell-single', 'single'),
  shell('shell-single-accent', 'single', { query: { hue: 'accent' } }),
  shell('shell-table', 'table'),
  // The preview index is a developer page, not a product screen.
  gallery('preview-home', { screen: 'home' }),
  preview('practice@6-9', { screen: 'practice', age: '6-9' }),
  // Standalone state routes of the real application (no session needed).
  { id: 'app:/account-suspended', entry: 'app', path: '/account-suspended', budget: 'app', firstView: true, catalogue: false },
  app('/no/such/page@not-found', '/no/such/page', null, '[data-shell="single-state"] [data-not-found-path]'),
  // GAP-FIX-R4 (02 §7 item 10): E.6's one public deletion screen (routes/auth/AccountDeletionStatus.tsx) in every state a
  // real route shows: signed in with a deletion scheduled (and held), kept with one press, and signed out right after
  // confirming (Settings hands the outcome over in router state: scheduled, or already deleted).
  app('/account-deletion@scheduled', '/account-deletion', 'deletion-scheduled', `${DELETION} [data-deletion-audit="scheduled"]`),
  app('/account-deletion@held', '/account-deletion', 'deletion-held', `${DELETION} [data-deletion-audit="scheduled"]`),
  app('/account-deletion@kept', '/account-deletion', 'deletion-scheduled', `${DELETION} [data-deletion-audit="scheduled"]`,
    { open: [`${DELETION} [data-deletion-audit="scheduled"] .lf-button--accent`] }),
  app('/account-deletion@signed-out', '/login', null, `${DELETION} [data-deletion-audit="scheduled"]`,
    { pushState: { path: '/account-deletion', state: { deletion: { kind: 'scheduled', scheduledFor: '2026-10-13T21:00:00.000Z' } } } }),
  app('/account-deletion@deleted', '/login', null, `${DELETION} [data-deletion-audit="deleted"]`,
    { pushState: { path: '/account-deletion', state: { deletion: { kind: 'deleted', finishing: false } } } }),
  // The states only a failure or Core's own timing reaches, on the preview's full-screen layout.
  ...['processing', 'unavailable', 'loading'].map((state) => preview(`account-deletion@${state}`, { screen: 'account-deletion', state, layout: 'screen' })),
  // The mounted shells on real routes (W2): the shell and its rebuilt page, with the per-string, text-fit, tap
  // and grid rules. The one-screen rules (one h1, heading ratio, type-size count, first view) belong to each
  // page's own lane state.
  ...[
    ['/learn@shell-child-10-12', '/learn', 'shell-child', '[data-shell="learner"] [data-nav-id="mentor"]'],
    ['/profile/settings@shell-teen', '/profile/settings', 'shell-teen', '[data-shell="learner"] [data-nav-id="wallet"]'],
    // The staff console page under the shell is rebuilt (W2T.3): wait for it, or the route's loading fallback is measured.
    ['/admin/intel@shell-staff-limited', '/admin/intel', 'shell-staff', '[data-shell="staff"] [data-nav-id="intel"]', '[data-screen="staff-intel"]'],
  ].map(([id, path, scenario, ready, readyAlso]) => app(id, path, scenario, ready, { readyAlso, firstView: false, catalogue: true, embedded: true })),
  // The Tutor shell on /family with no child is the family lane's '/family@empty' state (W2F.1 rebuilt the page;
  // the same load renders the same markup, measured there with the full rules).
  // The sign-in shell on /login is measured by the site lane's '/login@login' state (W2S.2 rebuilt the page
  // under it, so the same load renders the same markup, now with the full one-screen rules).
  ...[
    ['/faq@shell-site', '/faq', '[data-shell="site"] .lf-site-footer'],
  ].map(([id, path, ready]) => app(id, path, null, ready, { firstView: false, catalogue: true, embedded: true, budget: 'site' })),
];

/*
 * Who each mounted shell is audited for: a parent-created child, an
 * independent teen (OD-3 Option B), a verified parent (the Tutor) and a staff
 * member granted only view_analytics. `wallet` is what Core's GET /wallet/access
 * answers; `mentor` the saved Mentor choice (GET /tutor/preferences).
 */
export const scenarios = {
  'shell-child': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', roles: ['kid'], mentor: 'zara' },
  'shell-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', roles: ['universal'], wallet: { holder: 'teen', familyChild: false }, mentor: 'dina' },
  'shell-tutor': { population: 'verified parent (Tutor)', guest: false, ageBand: 'adult', roles: ['parent'] },
  // The console pages under the staff shell read many analytics endpoints; here Core reports them unavailable
  // (a real state every console page handles), so the shell is measured over a page that renders, not a crash.
  // GAP-FIX-R4: an adult whose account deletion is scheduled (E.6); Core's /auth/me carries it, and every app route
  // sends them to /account-deletion until they decide.
  'deletion-scheduled': { population: 'adult, account deletion scheduled', guest: false, ageBand: 'adult', accountDeletion: { status: 'pending', scheduledFor: '2026-10-13T21:00:00.000Z' } },
  'deletion-held': { population: 'adult, account deletion held (a review is open)', guest: false, ageBand: 'adult', accountDeletion: { status: 'held', scheduledFor: '2026-10-13T21:00:00.000Z' } },
  'shell-staff': { population: 'staff, view_analytics only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['view_analytics'], adminUnavailable: true },
};

/** The shells' own reads (the wallet classification and the Mentor choice) and the empty pages under them. */
export function respond({ spec, path, request, ok }) {
  // By age, as Core classifies it: a self-registered 13-17 account holds the personal wallet (OD-3 Option B).
  if (path === '/wallet/access') return ok(spec.wallet ?? (spec.ageBand === '13-17' ? { holder: 'teen', familyChild: false } : { holder: null, familyChild: false }));
  if (path === '/tutor/preferences' && request.method === 'GET') return ok({
    character: spec.mentor ?? 'rho', companion: null, diorama: 'diorama-a', backdrop: 'day', nickname: null, adaptations: [],
    personalized: Boolean(spec.mentor), catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: [], backdrops: [], adaptations: [], articulates: ['rho', 'zara'] },
  });
  // A scenario that declares its own shelf (the learn lane's, W2L.1) or its own family (lanes/family.mjs) is answered by that lane.
  if (path === '/learn/courses' && !spec.family && !spec.shelf) return ok({ courses: [] });
  if (path === '/family/kids' && !spec.family) return ok({ kids: [] });
  if (path === '/family/guardian-links/mine' && !spec.family) return ok({ links: [] });
  // S10.3 (OD-9): no audited population is a migrated child, so no data practice asks for a specific consent.
  if (request.method === 'GET' && (path === '/family-hub/data-practices/me' || /^\/family-hub\/kids\/[^/]+\/data-practices$/.test(path))) {
    return ok({ migrated: false, hasTutor: Boolean(spec.roles?.includes('kid')), practices: [] });
  }
  // E.6: "Keep account" cancels the scheduled deletion.
  if (path === '/account/deletion' && request.method === 'DELETE' && spec.accountDeletion) return ok({ status: 'cancelled' });
  if (spec.adminUnavailable && path.startsWith('/admin/')) return { status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic: not available' } } };
  return undefined;
}
