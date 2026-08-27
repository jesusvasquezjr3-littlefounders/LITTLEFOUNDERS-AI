import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { kidEmail } from './family.js';
import * as gotrue from '../services/gotrue.js';
import { attributeSignup, hasActiveAnalyticsConsent } from '../services/insights.js';
import { getOnboardingResponse, getOwnAvatar, getOwnProfile, getOwnRoles } from '../services/supabaseRest.js';

/** Social providers Core is willing to broker (GoTrue must also have each enabled). */
const OAUTH_PROVIDERS = ['google'] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/*
 * /api/v1/auth — email+password today; social providers (Google first, then
 * Discord/Facebook…) will add GET /auth/providers + the GoTrue /authorize
 * redirect flow here without changing existing shapes.
 *
 * Every new signup is `universal` (/AGENTS.md §1.4) — enforced by the DB
 * trigger (migration 0003), not by anything the client sends. `parentIntent`
 * only records that the user wants the Tutor upgrade; the ONLY path to the
 * `parent` role is Guardian verification (/api/v1/verification/parent).
 */

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

/*
 * AGE SCREENING, AND WHY IT IS A CHECK AND NOT A FIELD WE KEEP.
 *
 * Nothing here used to ask. The route's own comment said a fresh signup is
 * "an adult account by construction" because the DB trigger makes it
 * `universal` - but the role is our vocabulary, not a fact about the person.
 * A nine-year-old could hand us a name and an email, which is precisely the
 * collection COPPA is about, whatever we call the row.
 *
 * So the date of birth is REQUIRED to create an account and is then thrown
 * away: it gates, it is not stored. Keeping it would be collecting a second
 * piece of personal data to justify not collecting the first. Onboarding asks
 * again, optionally, and that one IS stored - because there it buys the learner
 * an age-appropriate level rather than buying us a compliance record.
 *
 * A child under the threshold is not turned away from the product: the guest
 * path collects nothing at all, and a parent can create them a proper account
 * from /family. They are turned away from GIVING US AN EMAIL.
 */
const MIN_SIGNUP_AGE_YEARS = 13;

/*
 * COMPLETED CALENDAR YEARS, in UTC — not elapsed milliseconds over an average
 * year.
 *
 * The previous implementation was `(now - born) / (365.25 days)`, and an
 * AVERAGE year cannot express a boundary that a CALENDAR defines. 365.25 is
 * longer than three years out of four, so the computed age lags the real
 * birthday and the gate opens LATE — by a fraction of a day when the window
 * holds four leap days, by more than a full day when it holds three, and it
 * shifts from year to year as that alignment moves.
 *
 * Measured on the old code before it was replaced: a child born 2013-08-27,
 * evaluated on 2026-08-27 — their thirteenth birthday — computed as 12.999316
 * at 00:00 UTC and 13.000114 at 07:00 UTC. Same child, same day, refused in
 * the morning and admitted after breakfast. Sweeping 1461 consecutive days,
 * the person turning exactly 13 that day was refused on 1095 of the 1460 that
 * have a thirteenth birthday at all - 75.0%.
 *
 * It never let an under-13 through — the drift only ever ran conservative —
 * and that is exactly why it survived: it cost signups, not safety, and a
 * refused signup does not page anybody. The one test covering this gate built
 * its fixture date with `9 * 365.25 * 24 * 3600 * 1000`, the same expression
 * as the implementation, so it agreed with the bug by construction. A test
 * written in the units of the code under test can only ever confirm it.
 */
export function yearsOld(isoDate: string, now: number): number {
  const bornMs = Date.parse(isoDate);
  if (Number.isNaN(bornMs)) return Number.NaN;
  const born = new Date(bornMs);
  const at = new Date(now);
  let years = at.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = at.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < born.getUTCDate())) {
    years -= 1;
  }
  return years;
}

const SignupBody = z.object({
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(80),
  locale: z.enum(LOCALES).default('en-US'),
  parentIntent: z.boolean().default(false),
  /** Screened against MIN_SIGNUP_AGE_YEARS and then discarded — never persisted. */
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A date of birth is required'),
  /** First-party visitor id (lf_aid) — links the signup to its acquisition source. */
  anonId: z.string().uuid().optional(),
});

/*
 * ONE FIELD, TWO KINDS OF ACCOUNT. An adult signs in with an email; a child
 * signs in with the handle their parent chose, because a child has no mailbox
 * and we do not collect one (§1.9). Rather than a second endpoint or a mode
 * toggle a nine-year-old has to understand, the identifier is accepted either
 * way and disambiguated by the one character that cannot appear in a username:
 * `@` is excluded by the `^[a-z0-9_]{3,20}$` constraint on `profiles.username`
 * (migration 0005), so the two shapes can never collide.
 *
 * `email` is kept as the field name for wire compatibility with every client
 * already sending it; `identifier` is accepted as the honest alias.
 */
const LoginBody = z
  .object({
    email: z.string().trim().max(254).optional(),
    identifier: z.string().trim().max(254).optional(),
    password: z.string().min(1).max(128),
  })
  .transform((v) => ({ identifier: v.identifier ?? v.email ?? '', password: v.password }))
  .refine((v) => v.identifier.length > 0, { message: 'An email or username is required' });

const RefreshBody = z.object({ refreshToken: z.string().min(1) });

const RecoverBody = z.object({ email: z.email().max(254) });

const ResetPasswordBody = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const ChangeEmailBody = z.object({
  newEmail: z.email().max(254),
  currentPassword: z.string().min(1).max(128),
});

const UpgradeBody = z.object({
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  /** So Core can mint a fresh session whose is_anonymous claim is already false. */
  refreshToken: z.string().min(1),
  /** First-party visitor id — attribution fires HERE, not at /auth/guest, since becoming a real account is the funnel event that matters. */
  anonId: z.string().uuid().optional(),
});

function sessionPayload(s: Partial<gotrue.GotrueSession>) {
  return s.access_token
    ? {
        accessToken: s.access_token,
        refreshToken: s.refresh_token ?? '',
        expiresIn: s.expires_in ?? 3600,
        user: s.user ? { id: s.user.id, email: s.user.email, metadata: s.user.user_metadata ?? {} } : null,
      }
    : null;
}

export function authRouter(): Router {
  const router = Router();

  router.post('/signup', authRateLimiter, async (req, res) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const age = yearsOld(parsed.data.birthDate, Date.now());
    if (!Number.isFinite(age) || age >= 120) {
      return fail(res, 400, 'VALIDATION_ERROR', 'That date of birth is not valid');
    }
    if (age < MIN_SIGNUP_AGE_YEARS) {
      // A distinct code, because the frontend must explain the way OUT of this
      // (a parent creates the account) rather than show a generic rejection.
      return fail(res, 403, 'AGE_RESTRICTED', 'An adult has to create this account');
    }

    // `birthDate` is deliberately NOT forwarded: signUp takes what it needs and
    // the date has already done its only job.
    const { data, error } = await gotrue.signUp(parsed.data);
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);

    // Attribution: which channel produced this signup (/INSIGHTS.md §7).
    // Every fresh signup is `universal` by DB trigger AND has now passed the
    // age screen above — the previous version of this comment claimed the
    // account was adult "by construction", which was an assumption about the
    // role name rather than a check on the person.
    const newUserId = data.user?.id;
    if (parsed.data.anonId && newUserId) {
      void attributeSignup(parsed.data.anonId, newUserId, ['universal']);
    }

    // Autoconfirm ON → session; OFF (prod) → email confirmation pending.
    const session = sessionPayload(data);
    return ok(res, { session, confirmationRequired: session === null }, 201);
  });

  // Guest session — Duolingo-style: start using the platform with zero signup
  // friction. This is a real auth.users row (GoTrue anonymous sign-in), so
  // every existing bootstrap trigger (profile + universal role +
  // learning_stats, migration 0003/0006) and every RLS policy already work
  // unchanged. "Guest" here is product vocabulary for GoTrue's is_anonymous —
  // unrelated to the pre-signup lf_aid marketing visitor id used elsewhere.
  router.post('/guest', authRateLimiter, async (_req, res) => {
    const { data, error } = await gotrue.signInAnonymously();
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);
    return ok(res, { session: sessionPayload(data) }, 201);
  });

  // Attach a permanent identity to the CURRENT guest session, in place — same
  // auth.users.id, so every row already written (profile, learning_stats,
  // lesson_progress) carries over with zero data migration. Never the normal
  // /signup path, which would mint a second, blank identity instead.
  router.post('/upgrade', requireAuth, authRateLimiter, async (req, res) => {
    const user = authedUser(res);
    if (!user.isGuest) {
      return fail(res, 409, 'NOT_A_GUEST', 'This account already has a permanent identity');
    }
    const parsed = UpgradeBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { error: updateError } = await gotrue.upgradeAnonymousUser(user.accessToken, {
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (updateError) {
      const status = updateError.status >= 500 ? 502 : updateError.status;
      return fail(res, status, updateError.code, updateError.message);
    }

    // The bearer token already in hand still carries the stale
    // is_anonymous:true claim until reissued — refresh immediately so the
    // session this response hands back correctly reports the account as
    // permanent from this call on, with no extra client round-trip.
    const { data: refreshed, error: refreshError } = await gotrue.refreshSession(parsed.data.refreshToken);
    if (refreshError) {
      return fail(res, 502, 'INTERNAL', 'Account upgraded but the session could not be refreshed — sign in again');
    }

    if (parsed.data.anonId) {
      void attributeSignup(parsed.data.anonId, user.id, ['universal']);
    }

    return ok(res, { session: sessionPayload(refreshed) });
  });

  router.post('/login', authRateLimiter, async (req, res) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    // A username resolves to the synthetic `.invalid` address the kid account
    // was created with - derived, never stored twice, which is also why a kid's
    // username is not editable (see family.ts kidEmail).
    const identifier = parsed.data.identifier;
    const email = identifier.includes('@') ? identifier : kidEmail(identifier.toLowerCase());
    const { data, error } = await gotrue.signInWithPassword(email, parsed.data.password);
    if (error) {
      const status = error.code === 'INVALID_CREDENTIALS' || error.code === 'EMAIL_NOT_CONFIRMED' ? 401 : error.status >= 500 ? 502 : error.status;
      return fail(res, status, error.code, error.message);
    }
    return ok(res, { session: sessionPayload(data) });
  });

  router.post('/refresh', authRateLimiter, async (req, res) => {
    const parsed = RefreshBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'refreshToken is required');
    const { data, error } = await gotrue.refreshSession(parsed.data.refreshToken);
    if (error) return fail(res, 401, 'UNAUTHORIZED', 'Session expired — sign in again');
    return ok(res, { session: sessionPayload(data) });
  });

  router.post('/logout', requireAuth, async (_req, res) => {
    await gotrue.signOut(authedUser(res).accessToken); // best-effort; token is dropped client-side regardless
    return ok(res, { signedOut: true });
  });

  // Sends the recovery.html email (email-server/AGENTS.md). Always answers
  // 200 — GoTrue itself never reveals whether the address has an account, so
  // this route doesn't either. The link lands on /reset-password carrying
  // `type=recovery` fragment tokens, which the frontend must exchange for a
  // new password rather than treat as a normal login (see /reset-password).
  router.post('/recover', authRateLimiter, async (req, res) => {
    const parsed = RecoverBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const { FRONTEND_URL } = getConfig();
    await gotrue.recover(parsed.data.email, `${FRONTEND_URL}/reset-password`);
    return ok(res, { sent: true });
  });

  // Completes a recovery link. The bearer token is the session GoTrue minted
  // when the recovery link was verified — a full, ordinary `role:
  // authenticated` session (1h, with its own refresh token), NOT a
  // single-use or short-lived credential, and requireAuth alone can't tell
  // it apart from any other valid session. GoTrue does mark HOW the session
  // was established via `amr` (`[{method: "otp", ...}]` for a verified
  // recovery/magic-link, vs `"password"`/`"oauth"` for an ordinary login) —
  // required here so a stolen ordinary access token can't be used to
  // silently set a new password with no re-auth (unlike /change-password,
  // this route intentionally never asks for the current password, since the
  // whole point of recovery is not knowing it).
  router.post('/reset-password', requireAuth, authRateLimiter, async (req, res) => {
    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    if (!user.amr.some((e) => e.method === 'otp')) {
      return fail(res, 403, 'FORBIDDEN', 'This session was not established via a password-recovery link');
    }
    const { error } = await gotrue.updateUser(user.accessToken, { password: parsed.data.password });
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);
    return ok(res, { updated: true });
  });

  // In-session password change (Settings). Re-verifies currentPassword via a
  // real GoTrue sign-in — GoTrue's `PUT /user` applies a new password to any
  // valid bearer token with no re-auth of its own, so this is the only gate.
  router.post('/change-password', requireAuth, authRateLimiter, async (req, res) => {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const { error: verifyError } = await gotrue.signInWithPassword(user.email, parsed.data.currentPassword);
    if (verifyError) return fail(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    const { error } = await gotrue.updateUser(user.accessToken, { password: parsed.data.newPassword });
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);
    return ok(res, { updated: true });
  });

  // In-session email change (Settings). Sends email_change.html to the new
  // address (and the old one, if GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED)
  // — auth.users.email does NOT change until that link is confirmed, so the
  // response only promises a pending change, never a completed one.
  router.post('/change-email', requireAuth, authRateLimiter, async (req, res) => {
    const parsed = ChangeEmailBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const { error: verifyError } = await gotrue.signInWithPassword(user.email, parsed.data.currentPassword);
    if (verifyError) return fail(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    const { FRONTEND_URL } = getConfig();
    const { error } = await gotrue.updateUser(
      user.accessToken,
      { email: parsed.data.newEmail },
      `${FRONTEND_URL}/profile/settings`,
    );
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);
    return ok(res, { pending: true });
  });

  // Which social providers are actually enabled server-side (GoTrue). The
  // frontend shows a provider's button only when it appears here, so enabling
  // Google is a pure server-side config step — no frontend redeploy needed.
  // Cheap public reads (no credentials) → covered by the global limiter (§1.14),
  // not the strict auth limiter reserved for credential attempts.
  router.get('/oauth/providers', async (_req, res) => {
    const { data } = await gotrue.getSettings();
    const external = data?.external ?? {};
    const providers = OAUTH_PROVIDERS.filter((p) => external[p] === true);
    return ok(res, { providers });
  });

  // Hand the browser the GoTrue /authorize URL for a provider. Core owns the
  // redirect_to (the frontend never needs the auth host — §1.5). The browser
  // follows this to GoTrue → the provider → back to /auth/callback.
  router.get('/oauth/:provider', (req, res) => {
    const provider = String(req.params.provider);
    if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Unsupported provider');
    }
    const { FRONTEND_URL } = getConfig();
    return ok(res, { url: gotrue.authorizeUrl(provider, `${FRONTEND_URL}/auth/callback`) });
  });

  router.get('/me', requireAuth, async (_req, res) => {
    const user = authedUser(res);
    const [profiles, roles, avatars, onboarding] = await Promise.all([
      getOwnProfile(user.accessToken, user.id),
      getOwnRoles(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
      getOnboardingResponse(user.id),
    ]);
    if (!profiles || !roles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');
    // Display-only (routes the client to /onboarding, nothing is written from
    // it) — a transient Vault miss collapses to false rather than 502ing the
    // whole /me call over a non-critical field (backend/AGENTS.md READ-MODIFY-
    // WRITE rule applies to writers, not this kind of reader).
    const onboardingComplete = (onboarding?.length ?? 0) > 0;
    const roleNames = roles.map((r) => r.role);
    // Whether the usage beacon may transmit for this account (/INSIGHTS.md).
    // Kids: only while guardian consent is active — fail-closed, so a Vault
    // hiccup silences the beacon rather than defaulting it on. Adults are
    // covered by the platform terms. The ingest route re-checks regardless;
    // this flag exists so a kid's browser does not even TRANSMIT unconsented.
    // Empty role set = unconfirmed (a lost RLS policy reads as [] here, not
    // as an error) — the beacon stays OFF rather than defaulting to adult.
    const analyticsEnabled = roleNames.length === 0
      ? false
      : roleNames.includes('kid')
        ? (await hasActiveAnalyticsConsent(user.id)) === true
        : true;
    /*
     * Was this account created just now?
     *
     * The OAuth landing has no other way to tell a first-ever Google sign-in
     * from a returning one — GoTrue hands back an identical session either
     * way — and without the distinction every social signup was invisible to
     * the acquisition funnel. Core answers it from the profile row it has
     * already fetched, so the client never has to guess.
     *
     * The window is generous relative to a redirect (seconds) and short
     * relative to a return visit (hours at least). The failure mode if it is
     * ever wrong is one event mislabelled between two funnel steps — never a
     * data-loss or access decision.
     */
    const createdAt = profiles[0]?.created_at ? Date.parse(profiles[0].created_at) : NaN;
    const newAccount = Number.isFinite(createdAt) && Date.now() - createdAt < 120_000;

    return ok(res, {
      user: { id: user.id, email: user.email },
      profile: profiles[0] ?? null,
      roles: roleNames,
      avatarOptions: avatars?.[0]?.options ?? {},
      analyticsEnabled,
      newAccount,
      isGuest: user.isGuest,
      onboardingComplete,
    });
  });

  return router;
}
