import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import * as gotrue from '../services/gotrue.js';
import { getOwnProfile, getOwnRoles } from '../services/supabaseRest.js';

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

  router.post('/signup', async (req, res) => {
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

  router.post('/login', async (req, res) => {
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

  router.post('/refresh', async (req, res) => {
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

  router.get('/me', requireAuth, async (_req, res) => {
    const user = authedUser(res);
    const [profiles, roles] = await Promise.all([
      getOwnProfile(user.accessToken, user.id),
      getOwnRoles(user.accessToken, user.id),
    ]);
    if (!profiles || !roles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');
    return ok(res, {
      user: { id: user.id, email: user.email },
      profile: profiles[0] ?? null,
      roles: roles.map((r) => r.role),
    });
  });

  return router;
}
