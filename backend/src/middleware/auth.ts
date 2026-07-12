import type { NextFunction, Request, Response } from 'express';
import { getConfig } from '../config.js';
import { fail } from '../lib/http.js';
import { verifyAccessToken } from '../lib/jwt.js';

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
