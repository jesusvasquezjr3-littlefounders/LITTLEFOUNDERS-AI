import { LANE_STATES } from './lanes/index.mjs';

/*
 * What the rebuilt-app audits visit (Frontend Bible 02 §7 item 10, 03 §5, 06 §7).
 *
 * The reference audits in docs/littlefounders-spec/frontend/verification-tools
 * drive the mockup through its own state hooks (`S`, `render()`); the rebuilt
 * app has none, so every state is reached the way a person reaches it: a URL,
 * then real pointer presses on named controls (`open`).
 *
 * The states are declared per wave-2 lane in `./lanes/<lane>.mjs` (core, site,
 * learn, mentor, family, profile, staff; the fields are documented in
 * `./lanes/helpers.mjs`), so parallel lanes never edit the same list:
 *
 *   - the S03 component gallery on the development-only preview entry
 *     (`/rebuild.html?screen=system|gallery|overlays|shell…`), every overlay
 *     open and every shell state (core);
 *   - every rebuilt surface the preview entry renders, at the ages it serves;
 *   - rebuilt routes of the real application that render without a session;
 *   - rebuilt surfaces and the mounted shells on AUTHENTICATED real routes,
 *     signed in with a synthetic session and answered by the synthetic Core
 *     (`scenario`, audits/synthetic-core.mjs); `readyAll` are the selectors
 *     that prove the route reached that state, not an earlier one;
 *   - any further route given in AUDIT_ROUTES (comma-separated paths of the
 *     real app, signed out).
 */
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
export const THEMES = ['light', 'dark'];
export const WIDTHS = [320, 375, 768, 1280];

export const STATES = LANE_STATES;

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
