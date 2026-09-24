import type { NextFunction, Request, Response } from 'express';
import { authedUser } from './auth.js';
import { readAgeScreen } from '../services/ageScreen.js';
import { fail } from '../lib/http.js';

/** Mounted after authentication: a UI redirect is not an authorization gate. */
export async function requireAgeScreen(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await readAgeScreen(authedUser(res).id);
  if (!state) { fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve age screening'); return; }
  if (state.required) { fail(res, 403, 'AGE_SCREEN_REQUIRED', 'Complete age screening first'); return; }
  res.locals.ageScreen = state;
  next();
}
