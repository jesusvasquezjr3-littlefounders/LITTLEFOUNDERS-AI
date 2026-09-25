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
 *   - Any further route given in AUDIT_ROUTES (comma-separated paths of the
 *     real app, e.g. an authenticated route on a dev server with a session).
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
];

/** Extra real-app routes from AUDIT_ROUTES. */
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
