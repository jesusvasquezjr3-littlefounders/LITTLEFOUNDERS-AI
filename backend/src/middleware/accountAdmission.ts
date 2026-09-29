import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { fail } from '../lib/http.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { serviceRest } from '../services/supabaseRest.js';

/*
 * A.1 (FAQ 'cancelTutor'), Appendix M Part 2.1 criterion 2, OD-3 section 2:
 * "your child's account is paused at once, until an active Tutor supervises
 * it again", enforced on every path, not on one read.
 *
 * The pause has three layers:
 *   1. GoTrue (migration identity_enforcement): the suspension trigger bans
 *      the kid-role account and deletes its sessions and refresh tokens, so
 *      password sign-in and refresh are refused by the auth server itself.
 *   2. /auth/login and /auth/refresh re-check the marker after GoTrue
 *      answers, so a session is never handed out even where the ban is
 *      missing (a stack whose migration has not run yet).
 *   3. This middleware, mounted ahead of every product router (app.ts):
 *      an access token minted before the pause stays cryptographically valid
 *      until it expires, so Core refuses it here with 403 ACCOUNT_SUSPENDED.
 *
 * Only kid-role accounts are paused: a self-registered teen keeps Option B
 * (a personal account without a parent) when a guardian link it invited goes
 * away. The read fails closed: an unreadable marker is a 503, never a pass.
 * A request without a valid token passes through untouched; the router's own
 * requireAuth answers it, and public reads stay public.
 */

export type AccountAdmission = 'active' | 'suspended' | 'unavailable';

const Marker = z.array(z.object({ suspended_at: z.string().nullish() }).passthrough()).max(1);
const Roles = z.array(z.object({ role: z.string() }).passthrough());

/** One service-role read on the common path (no marker); the role read only when a marker exists. */
export async function readAccountAdmission(userId: string): Promise<AccountAdmission> {
  if (!z.string().uuid().safeParse(userId).success) return 'unavailable';
  const id = encodeURIComponent(userId);
  const marker = Marker.safeParse(await serviceRest<unknown>(
    `/profiles?user_id=eq.${id}&suspended_at=not.is.null&select=suspended_at&limit=1`,
  ));
  if (!marker.success) return 'unavailable';
  if (marker.data.length === 0 || !marker.data[0]!.suspended_at) return 'active';
  const roles = Roles.safeParse(await serviceRest<unknown>(`/user_roles?user_id=eq.${id}&select=role`));
  if (!roles.success) return 'unavailable';
  return roles.data.some((row) => row.role === 'kid') ? 'suspended' : 'active';
}

export const ACCOUNT_SUSPENDED_MESSAGE = 'This account is paused until a Tutor supervises it again';

/** Answers a refused admission; returns true when the caller may continue. */
export function answerAdmission(res: Response, admission: AccountAdmission): boolean {
  if (admission === 'suspended') {
    fail(res, 403, 'ACCOUNT_SUSPENDED', ACCOUNT_SUSPENDED_MESSAGE);
    return false;
  }
  if (admission === 'unavailable') {
    fail(res, 503, 'ACCOUNT_STATE_UNAVAILABLE', 'Could not confirm the account is active; try again');
    return false;
  }
  return true;
}

export async function requireActiveAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Service-to-service routes under a product prefix answer to the internal key, not to a session.
  if (req.path.startsWith('/internal/')) return void next();
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyAccessToken(token, getConfig().SUPABASE_JWT_SECRET) : null;
  if (!claims || claims.role !== 'authenticated') return void next();
  try {
    if (answerAdmission(res, await readAccountAdmission(claims.sub))) next();
  } catch {
    answerAdmission(res, 'unavailable');
  }
}

/** Every product router a signed-in child reaches (app.ts mounts the middleware ahead of them). */
export const ACTIVE_ACCOUNT_PATHS = [
  '/api/v1/events',
  '/api/v1/learn',
  '/api/v1/onboarding',
  '/api/v1/placement',
  '/api/v1/tutor',
  '/api/v1/family',
  '/api/v1/family-hub',
  '/api/v1/tasks',
  '/api/v1/banking',
  '/api/v1/wallet',
  '/api/v1/profile',
  '/api/v1/profiles',
  '/api/v1/coop-goals',
] as const;
