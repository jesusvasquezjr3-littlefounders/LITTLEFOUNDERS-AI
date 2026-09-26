import { app, preview } from './helpers.mjs';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. The guest's age screen, before any product route opens (A.3),
 * and the rebuilt public site (W2S.1: M1–M6, the cookie choice M8, X2) on
 * their real routes, signed out (the audience of a public page) and, where
 * the page changes for them, signed in as a verified parent. A fresh visitor
 * has made no cookie choice, so every signed-out state is measured with the
 * cookie banner docked over the page, as a first visit shows it; no state
 * presses a choice (the consent cookie would outlive the state). A state's
 * ready selectors hold on load; its `open` presses come after them.
 */
export const lane = 'site';

const site = (id, path, ready, extra = {}) => app(id, path, extra.scenario ?? null, ready, { budget: 'site', ...extra });

export const states = [
  app('/onboarding@age-screen', '/onboarding', 'age-screen', '.lf-age-date'),
  site('/@landing', '/', '[data-screen="landing"] [data-slot="mentor-avatar"] img', { readyAlso: '[data-consent-banner]' }),
  site('/@landing-tutor', '/', '[data-screen="landing"] [data-cta="continue"]', { scenario: 'site-tutor' }),
  site('/@cookie-preferences', '/', '[data-consent-banner]', { open: ['[data-consent="preferences"]'] }),
  site('/how-it-works@how', '/how-it-works', '[data-screen="how-it-works"] [data-decision]'),
  site('/how-it-works@decision-picked', '/how-it-works', '[data-screen="how-it-works"] [data-decision]',
    { open: ['[data-decision="how-decision"] .lf-radio-option:last-child'] }),
  site('/families@families', '/families', '[data-screen="families"] [data-cta="become-tutor"]'),
  site('/families@chore-picked', '/families', '[data-screen="families"] [data-decision]',
    { open: ['[data-decision="families-chore"] .lf-radio-option:nth-child(3)', '[data-example="approve"]'] }),
  site('/families@families-tutor', '/families', '[data-screen="families"] a[href="/family"]', { scenario: 'site-tutor' }),
  site('/faq@faq', '/faq', '[data-screen="faq"] [data-faq-item]'),
  site('/faq@faq-open', '/faq', '[data-screen="faq"] [data-faq-item]',
    { open: ['[data-faq-item="twoParents"] button', '[data-faq-item="deleteAccount"] button', '[data-faq-item="notTaught"] button'] }),
  site('/legal/terms@terms', '/legal/terms', '[data-screen="legal-terms"] #c20'),
  site('/legal/privacy@privacy', '/legal/privacy', '[data-screen="legal-privacy"] [data-open="cookie-preferences"]'),
  // X2: a lazily loaded screen that failed; standalone, as the lesson player shows it.
  preview('route-error', { screen: 'route-error' }),
  preview('route-error@stale', { screen: 'route-error', stale: '1' }),
];

export const scenarios = {
  'age-screen': { population: 'guest', guest: true, ageBand: null },
  // A verified parent on the public pages: "Continue" instead of "Start free", "Open your family" instead of the sign-up.
  'site-tutor': { population: 'verified parent (Tutor) on the public site', guest: false, ageBand: 'adult', roles: ['parent'] },
};

export function respond() {
  return undefined;
}
