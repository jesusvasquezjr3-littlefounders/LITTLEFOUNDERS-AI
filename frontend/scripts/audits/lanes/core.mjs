import { gallery, preview, shell } from './helpers.mjs';

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
];

export const scenarios = {};

export function respond() {
  return undefined;
}
