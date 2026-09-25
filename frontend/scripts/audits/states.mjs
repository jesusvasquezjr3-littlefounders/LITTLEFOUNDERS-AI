/*
 * What the rebuilt-app audits visit (Frontend Bible 02 §7 item 10, 03 §5, 06 §7).
 *
 * The reference audits in docs/littlefounders-spec/frontend/verification-tools
 * drive the mockup through its own state hooks (`S`, `render()`); the rebuilt
 * app has none, so every state here is reached the way a person reaches it: a
 * URL, then real pointer presses on named controls (`open`).
 *
 *   - The S03 component gallery on the development-only preview entry
 *     (`/rebuild.html?screen=system|gallery|overlays|shell…`), every overlay
 *     open and every shell state.
 *   - Every rebuilt surface the preview entry renders (lesson player states,
 *     teaching boards, results, transport states), at the ages it serves.
 *   - Rebuilt routes of the real application that render without a session
 *     (`/account-suspended`), inside the legacy app shell and its global CSS.
 *   - Rebuilt surfaces on authenticated real routes (the lesson route in
 *     every state it can show, the guest age screen, the teen analytics
 *     setting), signed in with a synthetic session and answered by the
 *     synthetic Core (`scenario`, audits/synthetic-core.mjs); `readyAll` are
 *     the selectors that prove the route reached that state, not an earlier one.
 *   - Any further route given in AUDIT_ROUTES (comma-separated paths of the
 *     real app, signed out).
 *
 * Fields: `budget` (app | site, 06 §3), `firstView` (whether the 06 §3.1
 * first-view total applies: only product screens, never a specimen sheet),
 * `catalogue` (a specimen sheet: the proportion rules about one screen's type
 * scale, radii, accents and measure do not apply, as the reference exempts its
 * `system` route), `widths` (a subset, for phone-only states), `open`
 * (selectors pressed in order after load).
 */
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
export const THEMES = ['light', 'dark'];
export const WIDTHS = [320, 375, 768, 1280];

const preview = (id, query, extra = {}) => ({ id, entry: 'preview', query, budget: 'app', firstView: true, catalogue: false, ...extra });
const gallery = (id, query, extra = {}) => preview(id, query, { firstView: false, catalogue: true, ...extra });
const shell = (id, kind, { query = {}, ...extra } = {}) => preview(id, { screen: 'shell', shell: kind, ...query }, { firstView: false, ...extra });

const overlays = ['dialog', 'confirm', 'sheet', 'popover', 'menu', 'toast'];

// Lesson and board surfaces, at the ages each one serves (as the S05 matrices run them).
const lessonSurfaces = [
  ['lesson', ['6-9', 'adult']], ['waffle', ['6-9']], ['donut', ['10-12']], ['ratiotable', ['10-12']], ['timeline', ['6-9', 'adult']],
  ['sequence', ['6-9']], ['numberline', ['6-9', '10-12']], ['goal', ['6-9', 'adult']], ['percent', ['10-12']], ['placevalue', ['6-9']],
  ['rulebuilder', ['10-12']], ['ledger', ['13-17']], ['growthcompare', ['13-17']], ['taxbracket', ['13-17']], ['fractionline', ['10-12']],
  ['fractionarea', ['6-9']], ['barmodel', ['10-12']], ['schemadiagram', ['10-12']], ['workedexample', ['10-12']], ['functionmachine', ['10-12']],
  ['cpafading', ['6-9', '10-12']], ['result', ['6-9']], ['replay', ['6-9']], ['upgrade', ['6-9']], ['invalid', ['6-9']], ['opening', ['6-9']],
  ['offline', ['6-9']], ['loaderror', ['6-9']], ['practice', ['6-9']],
];

export const STATES = [
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
  // Rebuilt product surfaces on the preview entry.
  ...lessonSurfaces.flatMap(([screen, ages]) => ages.map((age) => preview(`${screen}@${age}`, { screen, age }))),
  // Rebuilt routes of the real application (no session needed).
  { id: 'app:/account-suspended', entry: 'app', path: '/account-suspended', budget: 'app', firstView: true, catalogue: false },
  // Rebuilt surfaces on AUTHENTICATED real routes (S03.5), signed in with a synthetic session and answered by the
  // synthetic Core in audits/synthetic-core.mjs: the real route, its guards, the legacy providers and global CSS.
  ...sessionRoutes(),
];

function sessionRoutes() {
  const app = (id, path, scenario, ready, { readyAlso, ...extra } = {}) => ({ id: `app:${id}`, entry: 'app', path, scenario,
    readyAll: readyAlso ? [ready, readyAlso] : [ready], budget: 'app', firstView: true, catalogue: false, ...extra });
  return [
    // The lesson route mounts the rebuilt lesson inside the design-system root (S03.6): every screen it can show.
    app('/learn/lesson@goal-6-9', '/learn/lesson/audit-goal', 'lesson-goal', '[data-screen="goal"]'),
    app('/learn/lesson@allocation-adult', '/learn/lesson/audit-allocation', 'lesson-allocation', '[data-screen="lesson"]'),
    app('/learn/lesson@function-machine-10-12', '/learn/lesson/audit-machine', 'lesson-function-machine', '[data-screen="function-machine"]'),
    app('/learn/lesson@opening', '/learn/lesson/audit-opening', 'lesson-opening', '[data-screen="lesson-opening"]'),
    app('/learn/lesson@offline', '/learn/lesson/audit-offline', 'lesson-offline', '[data-screen="lesson-offline"]'),
    app('/learn/lesson@load-error', '/learn/lesson/audit-error', 'lesson-load-error', '[data-screen="lesson-load-error"]'),
    app('/learn/lesson@placement', '/learn/lesson/audit-placement', 'lesson-placement', '[data-screen="lesson-placement"]'),
    app('/learn/lesson@eligibility-required', '/learn/lesson/audit-required', 'lesson-eligibility-required', '[data-screen="lesson-eligibility-required"]'),
    app('/learn/lesson@eligibility-restricted', '/learn/lesson/audit-restricted', 'lesson-eligibility-restricted', '[data-screen="lesson-eligibility-restricted"]'),
    app('/learn/lesson@eligibility-unavailable', '/learn/lesson/audit-unavailable', 'lesson-eligibility-unavailable', '[data-screen="lesson-eligibility-unavailable"]'),
    // The guest's age screen, before any product route opens (A.3).
    app('/onboarding@age-screen', '/onboarding', 'age-screen', '.lf-age-date'),
    // A panel embedded in a legacy page: per-string budgets, text fit and tap gaps apply; the one-screen
    // rules (one h1, heading ratio, type-size count, first-view total) belong to the page around it.
    // Every rebuilt root on the page is measured: the analytics choice (S01) and the Mentor-memory self-review (OD-18).
    app('/profile/settings@teen', '/profile/settings', 'settings-teen', '.lf-analytics-choice [role="switch"]', {
      firstView: false, catalogue: true, embedded: true, readyAlso: '.lf-memory-self-review .lf-memory-note' }),
  ];
}

/** Extra real-app routes from AUDIT_ROUTES (signed out, no synthetic Core). */
export function extraRoutes(value = process.env.AUDIT_ROUTES) {
  return (value ?? '').split(',').map((path) => path.trim()).filter(Boolean)
    .map((path) => ({ id: `app:${path}`, entry: 'app', path, budget: 'app', firstView: true, catalogue: false }));
}

/** The URL of one state in one locale and theme. */
export function stateUrl(origin, state, locale, theme) {
  if (state.entry === 'app') {
    const url = new URL(state.path, origin);
    url.searchParams.set('lng', locale);
    return url.toString();
  }
  return `${origin}/rebuild.html?${new URLSearchParams({ locale, theme, ...state.query })}`;
}
