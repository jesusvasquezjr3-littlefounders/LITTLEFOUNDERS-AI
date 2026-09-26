import { app, gallery, preview, shell } from './helpers.mjs';

/*
 * Lane 0 (core): the S03 component gallery, the shared shells, the preview
 * index and the standalone state screens.
 */
export const lane = 'core';

const overlays = ['dialog', 'confirm', 'sheet', 'popover', 'menu', 'toast'];

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
  // The mounted shells on real routes (W2). The page body inside each shell is still legacy and is not
  // measured (in-page.mjs skips [data-legacy-body]); the shell is, with the per-string, text-fit, tap and
  // grid rules. The one-screen rules (one h1, heading ratio, type-size count, first view) belong to the page.
  ...[
    ['/learn@shell-child-10-12', '/learn', 'shell-child', '[data-shell="learner"] [data-nav-id="mentor"]'],
    ['/profile/settings@shell-teen', '/profile/settings', 'shell-teen', '[data-shell="learner"] [data-nav-id="wallet"]'],
    ['/family@shell-tutor', '/family', 'shell-tutor', '[data-shell="tutor"] [data-nav-id="family"]'],
    ['/admin/intel@shell-staff-limited', '/admin/intel', 'shell-staff', '[data-shell="staff"] [data-nav-id="intel"]'],
  ].map(([id, path, scenario, ready]) => app(id, path, scenario, ready, { firstView: false, catalogue: true, embedded: true })),
  ...[
    ['/faq@shell-site', '/faq', '[data-shell="site"] .lf-site-footer'],
    ['/login@shell-auth', '/login', '[data-shell="auth"] [data-shell-preferences]'],
  ].map(([id, path, ready]) => app(id, path, null, ready, { firstView: false, catalogue: true, embedded: true, budget: path === '/faq' ? 'site' : 'app' })),
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
  if (path === '/learn/courses') return ok({ courses: [] });
  if (path === '/family/kids') return ok({ kids: [] });
  if (spec.adminUnavailable && path.startsWith('/admin/')) return { status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic: not available' } } };
  return undefined;
}
