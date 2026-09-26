/*
 * State builders shared by the per-lane audit files (scripts/audits/lanes/*.mjs).
 *
 * Fields of a state: `budget` (app | site, 06 §3), `firstView` (whether the
 * 06 §3.1 first-view total applies: only product screens, never a specimen
 * sheet), `catalogue` (a specimen sheet: the proportion rules about one
 * screen's type scale, radii, accents and measure do not apply, as the
 * reference exempts its `system` route), `widths` (a subset, for phone-only
 * states), `open` (selectors pressed in order after load), `scenario` (the
 * synthetic-Core scenario an authenticated real route is signed in with) and
 * `readyAll` (the selectors that prove the route reached that state, not an
 * earlier one).
 */

/** A screen of the development-only preview entry (`/rebuild.html?…`). */
export const preview = (id, query, extra = {}) => ({ id, entry: 'preview', query, budget: 'app', firstView: true, catalogue: false, ...extra });
/** A specimen sheet of the preview entry: every string budgeted, no first-view total. */
export const gallery = (id, query, extra = {}) => preview(id, query, { firstView: false, catalogue: true, ...extra });
/** A shell state of the S03.2 gallery. */
export const shell = (id, kind, { query = {}, ...extra } = {}) => preview(id, { screen: 'shell', shell: kind, ...query }, { firstView: false, ...extra });

/** A real-application route signed in as `scenario` (null: signed out) and answered by the synthetic Core. */
export const app = (id, path, scenario, ready, { readyAlso, ...extra } = {}) => ({ id: `app:${id}`, entry: 'app', path, scenario,
  readyAll: ready ? (readyAlso ? [ready, ...[readyAlso].flat()] : [ready]) : [], budget: 'app', firstView: true, catalogue: false, ...extra });
