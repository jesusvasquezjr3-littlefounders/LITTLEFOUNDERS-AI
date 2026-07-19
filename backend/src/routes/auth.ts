import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import * as gotrue from '../services/gotrue.js';
import { getOwnAvatar, getOwnProfile, getOwnRoles } from '../services/supabaseRest.js';

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

const SignupBody = z.object({
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(80),
  locale: z.enum(LOCALES).default('en-US'),
  parentIntent: z.boolean().default(false),
});

const LoginBody = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

const RefreshBody = z.object({ refreshToken: z.string().min(1) });

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
    const { data, error } = await gotrue.signUp(parsed.data);
    if (error) return fail(res, error.status >= 500 ? 502 : error.status, error.code, error.message);

    // Autoconfirm ON → session; OFF (prod) → email confirmation pending.
    const session = sessionPayload(data);
    return ok(res, { session, confirmationRequired: session === null }, 201);
  });

  router.post('/login', authRateLimiter, async (req, res) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const { data, error } = await gotrue.signInWithPassword(parsed.data.email, parsed.data.password);
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
    const [profiles, roles, avatars] = await Promise.all([
      getOwnProfile(user.accessToken, user.id),
      getOwnRoles(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
    ]);
    if (!profiles || !roles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');
    return ok(res, {
      user: { id: user.id, email: user.email },
      profile: profiles[0] ?? null,
      roles: roles.map((r) => r.role),
      avatarOptions: avatars?.[0]?.options ?? {},
    });
  });

  return router;
}
