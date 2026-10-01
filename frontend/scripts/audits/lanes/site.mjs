import { readFileSync } from 'node:fs';
import { renderBadgeFixture } from '../badge-fixture.mjs';
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

// An active pre-cutover link carries a stored Depot-rendered share image,
// independent of whether its originating course remains in the catalogue.
// Render the synthetic image with today's compositor and approved house art;
// never reference retired static course badges or restore them for an audit.
const badgeImage = 'data:image/png;base64,' + (await renderBadgeFixture()).toString('base64');

// The route retires on this date (routes/marketing/BadgeLandingPage.tsx); after it every link reads as expired.
const BADGE_ROUTE_RETIRES_AT = Date.parse(readFileSync(new URL('../../../src/routes/marketing/BadgeLandingPage.tsx', import.meta.url), 'utf8')
  .match(/BADGE_LINK_ROUTE_RETIRES_AT = '([^']+)'/)[1]);

const site = (id, path, ready, extra = {}) => app(id, path, extra.scenario ?? null, ready, { budget: 'site', ...extra });

export const states = [
  app('/onboarding@age-screen', '/onboarding', 'age-screen', '.lf-age-date'),
  // GAP-FIX-R5 (02 §7 item 10, 06 §7): the age question's other two states on a real route. A parent-created child
  // with no age on record is told to ask their Tutor (A.4, GAP-FIX-R1); an unreadable answer offers a retry.
  app('/learn@age-ask-tutor', '/learn', 'age-kid-unrecorded', '[data-age-screen-state="ask-tutor"]'),
  app('/learn@age-error', '/learn', 'age-unreadable', '[data-screen="age-screen"] .lf-notice--error'),
  preview('age-screen@askTutor', { screen: 'age-screen', state: 'askTutor' }),
  preview('age-screen@error', { screen: 'age-screen', state: 'error' }),
  // H.1 (F3-identity-site): a self-registered teen's first session with no analytics choice on file opens the
  // disclosure sheet over the page, with both equal answers.
  app('/learn@teen-analytics-disclosure', '/learn', 'teen-undisclosed',
    '[role="dialog"] .lf-analytics-choice [data-analytics-choice="off"]', { readyAlso: '[role="dialog"] .lf-analytics-choice [data-analytics-choice="on"]' }),
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
  // GAP-FIX-R5 (A.1, D.3): a Tutor invite's landing, for each person who can open the link. A verified Tutor is sent
  // on to /family?join= (the family lane's route), so no state of theirs lands here.
  app('/join/:token@signed-out', '/join/auditInviteToken0123456789', null, '[data-shell="auth"] [data-screen="join-invite"] [data-join="signup"]'),
  app('/join/:token@verify', '/join/auditInviteToken0123456789', 'identity-adult', '[data-shell="auth"] [data-screen="join-invite-verify"] [data-join="verify"]'),
  app('/join/:token@child', '/join/auditInviteToken0123456789', 'identity-kid', '[data-shell="auth"] [data-screen="join-invite-child"]'),
  app('/join/:token@invalid', '/join/not-a-token', null, '[data-shell="auth"] [data-screen="join-invite-invalid"]'),
  app('/onboarding@onboarding-welcome', '/onboarding', 'identity-new-guest', '[data-screen="onboarding"][data-step="welcome"]'),
  app('/onboarding@onboarding-name', '/onboarding', 'identity-new-guest', '[data-screen="onboarding"][data-step="welcome"]', { open: ['[data-onboarding="start"]'] }),
  // The states a real route cannot be made to show on demand, in the frame they have on the route.
  // GAP-FIX-R5: verify-minor (AGE_RECORD_MINOR, F3) and the W2S.3 offline copy on the sign-in forms were never measured.
  ...['login-google', 'login-offline', 'signup-offline', 'signup-refused', 'signup-refused-failed', 'signup-confirm', 'forgot-sent', 'reset-form',
    'reset-done', 'upgrade-error', 'verify-failed', 'verify-success', 'verify-revoked', 'verify-ineligible', 'verify-minor', 'verify-status-error']
    .map((view) => preview(`identity@${view}`, { screen: 'identity', view })),
  ...['mentor', 'discovery', 'account'].map((step) => preview(`onboarding@${step}`, { screen: 'onboarding', step })),
  preview('onboarding@mentor-chosen-failed', { screen: 'onboarding', step: 'mentor', chosen: 'liruf', failed: '1' }),
  // The shared MentorChooser (08 §8): a save in flight locks the other rows.
  preview('onboarding@mentor-saving', { screen: 'onboarding', step: 'mentor', saving: 'rho' }),
  preview('onboarding@account-failed', { screen: 'onboarding', step: 'account', failed: '1' }),
  // GAP-FIX-R4 (02 §7 item 10): M7, the legacy badge-link page (OD-20), signed out as its audience meets it: a link
  // Core refuses (expired, revoked or after the cutover) and, until the route retires, a link Core still answers. It
  // renders on the single-state shell, not the site shell, so it is budgeted as the other single-state screens are.
  site('/badge/:token@expired', '/badge/audit-expired', '[data-screen="badge-landing"][data-state="expired"]', { scenario: 'badge-visitor', budget: 'app' }),
  ...(Date.now() < BADGE_ROUTE_RETIRES_AT ? [site('/badge/:token@ready', '/badge/audit-ready', '[data-screen="badge-landing"][data-state="ready"] img',
    { scenario: 'badge-visitor', budget: 'app' })] : []),
];

export const scenarios = {
  'age-screen': { population: 'guest', guest: true, ageBand: null },
  // GAP-FIX-R5: a parent-created child (kid role) with no age on record: only their Tutor can give it (A.4).
  'age-kid-unrecorded': { population: 'parent-created child, no age on record', guest: false, roles: ['kid'], ageBand: null },
  // GAP-FIX-R5: an adult whose age answer Core cannot read right now.
  'age-unreadable': { population: 'adult, age answer unreadable', guest: false, ageBand: null, ageScreenError: true },
  // GAP-FIX-R5 (H.1): a self-registered teen with no analytics choice on file.
  'teen-undisclosed': { population: 'independent teen 13-17, no analytics choice on file', guest: false, ageBand: '13-17', analyticsDisclosed: false },
  // A signed-in adult who has not verified (the universal account a parent signs up with).
  'identity-adult': { population: 'adult, not verified', guest: false, ageBand: 'adult', verification: { verified: false } },
  // A verified parent: Core's status, not the role, says "already a Tutor".
  'identity-tutor': { population: 'verified parent (Tutor)', guest: false, ageBand: 'adult', roles: ['parent'], verification: { verified: true } },
  // GAP-FIX-R5: a parent-created child (kid role) who opens a Tutor invite link.
  'identity-kid': { population: 'parent-created child 10-12', guest: false, roles: ['kid'], ageBand: '10-12' },
  // A guest who finished onboarding and saves their progress (A6); screened as a teen.
  'identity-guest': { population: 'guest (screened 13-17)', guest: true, ageBand: '13-17' },
  // A guest refused at sign-up (A.2) on their first run: screened under 13, onboarding not done.
  'identity-new-guest': { population: 'guest, under-13 origin, first run', guest: true, ageBand: '6-9', onboarding: false },
  // A verified parent on the public pages: "Continue" instead of "Start free", "Open your family" instead of the sign-up.
  // GAP-FIX-R4: a visitor with no session opening a badge link (Core answers GET /badges/:token without one).
  'badge-visitor': { population: 'visitor, signed out', guest: false, signedOut: true, ageBand: null },
  'site-tutor': { population: 'verified parent (Tutor) on the public site', guest: false, ageBand: 'adult', roles: ['parent'] },
};

/** Parent verification's status (A.5) and the Mentor choice onboarding saves; the providers Google sign-in reads. */
export function respond({ spec, path, request, ok }) {
  if (path === '/verification/parent' && request.method === 'GET' && spec.verification) return ok(spec.verification);
  if (path === '/auth/oauth/providers') return ok({ providers: [] });
  // M7: a link issued before the OD-20 cutover; Core answers only the share image and the first name.
  if (path === '/badges/audit-ready') return ok({ firstName: 'Sofía', achievementKind: 'course_badge', achievementLabel: 'Money basics',
    imageUrl: badgeImage });
  if (path.startsWith('/badges/')) return { status: 404, body: { data: null, error: { code: 'NOT_FOUND', message: 'Synthetic: expired link' } } };
  if (path === '/tutor/preferences' && request.method === 'PUT') return ok({ character: 'rho', companion: null, diorama: 'diorama-a', backdrop: 'day', nickname: null, adaptations: [] });
  return undefined;
}
