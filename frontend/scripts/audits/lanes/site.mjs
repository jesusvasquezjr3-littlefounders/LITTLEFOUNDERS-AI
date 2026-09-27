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
  // The FAQ as it first loads is Lane 0's '/faq@shell-site' state (the same markup); these reach its other states.
  site('/faq@faq-privacy', '/faq', '[data-screen="faq"] [data-faq-item]', { open: ['[data-screen="faq"] .lf-choice-chip:nth-child(6)'] }),
  site('/faq@faq-open', '/faq', '[data-screen="faq"] [data-faq-item]',
    // The first answers, opened where the page loads: a press deeper down scrolls the list under the sticky
    // site header, and the spacing rule would then measure the scroll position rather than the layout.
    { open: ['[data-faq-item="whatIs"] button', '[data-faq-item="isFree"] button', '[data-faq-item="tryWithoutAccount"] button'] }),
  site('/legal/terms@terms', '/legal/terms', '[data-screen="legal-terms"] #c20'),
  site('/legal/privacy@privacy', '/legal/privacy', '[data-screen="legal-privacy"] [data-open="cookie-preferences"]'),
  // X2: a lazily loaded screen that failed; standalone, as the lesson player shows it.
  preview('route-error', { screen: 'route-error' }),
  preview('route-error@stale', { screen: 'route-error', stale: '1' }),

  // W2S.2: sign-in, recovery and verification (A1–A7) on the sign-in shell, and onboarding (O1). Signed out
  // (a first visit, cookie banner docked) where the route is public; signed in as the population the route serves.
  app('/login@login', '/login', null, '[data-shell="auth"] [data-screen="login"]'),
  app('/signup@signup', '/signup', null, '[data-shell="auth"] [data-screen="signup"]'),
  app('/signup@signup-tutor-intent', '/signup?intent=tutor', null, '[data-shell="auth"] [data-auth="parent-intent"]:checked'),
  app('/forgot-password@forgot', '/forgot-password', null, '[data-shell="auth"] [data-screen="forgot-password"]'),
  // A recovery link with no token in it: the expired state (the token-bearing form is previewed below).
  app('/reset-password@reset-expired', '/reset-password', null, '[data-shell="auth"] [data-screen="reset-expired"]'),
  // The provider returned an error: the way back (the success path navigates on to the age question).
  app('/auth/callback@callback-failed', '/auth/callback#error=access_denied', null, '[data-shell="auth"] [data-screen="oauth-failed"]'),
  app('/verify-parent@verify-intro', '/verify-parent', 'identity-adult', '[data-shell="auth"] [data-screen="verify-intro"]'),
  app('/verify-parent@verify-form', '/verify-parent', 'identity-adult', '[data-shell="auth"] [data-screen="verify-intro"]', { open: ['[data-auth="start"]'] }),
  app('/verify-parent@verify-already', '/verify-parent', 'identity-tutor', '[data-shell="auth"] [data-screen="verify-already"]'),
  // An account Core has not screened opens verification: the age question inside the sign-in shell (one <main>).
  app('/verify-parent@age-embedded', '/verify-parent', 'age-screen', '[data-shell="auth"] .lf-age-date'),
  app('/upgrade-account@upgrade', '/upgrade-account', 'identity-guest', '[data-shell="auth"] [data-screen="upgrade-account"]'),
  app('/onboarding@onboarding-welcome', '/onboarding', 'identity-new-guest', '[data-screen="onboarding"][data-step="welcome"]'),
  app('/onboarding@onboarding-name', '/onboarding', 'identity-new-guest', '[data-screen="onboarding"][data-step="welcome"]', { open: ['[data-onboarding="start"]'] }),
  // The states a real route cannot be made to show on demand, in the frame they have on the route.
  ...['login-google', 'signup-refused', 'signup-refused-failed', 'signup-confirm', 'forgot-sent', 'reset-form', 'reset-done', 'upgrade-error',
    'verify-failed', 'verify-success', 'verify-revoked', 'verify-ineligible', 'verify-status-error']
    .map((view) => preview(`identity@${view}`, { screen: 'identity', view })),
  ...['mentor', 'discovery', 'account'].map((step) => preview(`onboarding@${step}`, { screen: 'onboarding', step })),
  preview('onboarding@mentor-chosen-failed', { screen: 'onboarding', step: 'mentor', chosen: 'liruf', failed: '1' }),
  preview('onboarding@account-failed', { screen: 'onboarding', step: 'account', failed: '1' }),
];

export const scenarios = {
  'age-screen': { population: 'guest', guest: true, ageBand: null },
  // A signed-in adult who has not verified (the universal account a parent signs up with).
  'identity-adult': { population: 'adult, not verified', guest: false, ageBand: 'adult', verification: { verified: false } },
  // A verified parent: Core's status, not the role, says "already a Tutor".
  'identity-tutor': { population: 'verified parent (Tutor)', guest: false, ageBand: 'adult', roles: ['parent'], verification: { verified: true } },
  // A guest who finished onboarding and saves their progress (A6); screened as a teen.
  'identity-guest': { population: 'guest (screened 13-17)', guest: true, ageBand: '13-17' },
  // A guest refused at sign-up (A.2) on their first run: screened under 13, onboarding not done.
  'identity-new-guest': { population: 'guest, under-13 origin, first run', guest: true, ageBand: '6-9', onboarding: false },
  // A verified parent on the public pages: "Continue" instead of "Start free", "Open your family" instead of the sign-up.
  'site-tutor': { population: 'verified parent (Tutor) on the public site', guest: false, ageBand: 'adult', roles: ['parent'] },
};

/** Parent verification's status (A.5) and the Mentor choice onboarding saves; the providers Google sign-in reads. */
export function respond({ spec, path, request, ok }) {
  if (path === '/verification/parent' && request.method === 'GET' && spec.verification) return ok(spec.verification);
  if (path === '/auth/oauth/providers') return ok({ providers: [] });
  if (path === '/tutor/preferences' && request.method === 'PUT') return ok({ character: 'rho', companion: null, diorama: 'diorama-a', backdrop: 'day', nickname: null, adaptations: [] });
  return undefined;
}
