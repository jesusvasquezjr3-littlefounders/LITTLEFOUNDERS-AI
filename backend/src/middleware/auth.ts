import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from '../config.js';
import { fail } from '../lib/http.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { getOwnRoles } from '../services/supabaseRest.js';

export interface AuthedUser {
  id: string;
  email: string;
  /** The raw access token, for RLS-enforced PostgREST calls on the user's behalf. */
  accessToken: string;
}

/** Typed accessor for the user set by requireAuth. */
export function authedUser(res: Response): AuthedUser {
  return res.locals.user as AuthedUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyAccessToken(token, getConfig().SUPABASE_JWT_SECRET) : null;
  if (!claims || claims.role !== 'authenticated') {
    fail(res, 401, 'UNAUTHORIZED', 'A valid session is required');
    return;
  }
  res.locals.user = { id: claims.sub, email: claims.email, accessToken: token } satisfies AuthedUser;
  next();
}

/**
 * Requires the user to have AT LEAST ONE of the specified roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(allowedRoles: string[]) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = authedUser(res);
    if (!user) {
      fail(res, 401, 'UNAUTHORIZED', 'A valid session is required');
      return;
    }

    try {
      const dbRoles = await getOwnRoles(user.accessToken, user.id);
      if (!dbRoles) {
        fail(res, 502, 'INTERNAL', 'Failed to verify permissions');
        return;
      }

      const hasRole = dbRoles.some((r) => allowedRoles.includes(r.role));
      if (!hasRole) {
        fail(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource');
        return;
      }
      
      next();
    } catch {
      fail(res, 500, 'INTERNAL', 'Permission check failed');
    }
  };
}

/** Validates the INTERNAL_API_KEY header for service-to-service calls. */
export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get('x-internal-api-key') ?? '';
  const expected = getConfig().INTERNAL_API_KEY;
  
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    fail(res, 403, 'FORBIDDEN', 'Invalid internal API key');
    return;
  }
  next();
}
