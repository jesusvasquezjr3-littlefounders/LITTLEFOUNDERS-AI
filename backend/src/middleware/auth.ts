import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../lib/http.js';
import type { Cookies } from '../services/cookies.js';
import type { TokenVerifier } from '../services/tokens.js';
import type { AccountContext, Role, Vault } from '../services/vault.js';

/** Who is asking, established by `requireAuth` for the handlers after it. */
export type Auth = Readonly<{ userId: string; sessionId: string; accessToken: string; account: AccountContext }>;

const store = new WeakMap<Request, Auth>();

/** The signed-in account of this request. Only call it behind `requireAuth`. */
export function authOf(req: Request): Auth {
  const auth = store.get(req);

  if (!auth) throw new ApiError('UNAUTHENTICATED');

  return auth;
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;

export function createAuthMiddleware(deps: { cookies: Cookies; verifyToken: TokenVerifier; vault: Vault }) {
  /*
   * A request is signed in when its access cookie holds a valid token AND the database confirms,
   * right now, that the session it names is alive and the account usable. The second check is what
   * makes signing out, a ban or a deleted account take effect at once and not when the token
   * expires. The account's roles come from that same answer, never from the token.
   */
  const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = deps.cookies.accessToken(req);

    if (!accessToken) return next(new ApiError('UNAUTHENTICATED'));

    const claims = await deps.verifyToken(accessToken);

    if (!claims) return next(new ApiError('UNAUTHENTICATED'));

    const account = await deps.vault.sessionContext(claims.userId, claims.sessionId);

    if (!account?.active) {
      deps.cookies.clearSession(res);

      return next(new ApiError('SESSION_EXPIRED'));
    }

    store.set(req, { userId: claims.userId, sessionId: claims.sessionId, accessToken, account });
    next();
  };

  /** Lets the request through when the account holds at least one of the roles. Put it after `requireAuth`. */
  const requireRole = (...allowed: Role[]): RequestHandler => (req, _res, next) => {
    const { account } = authOf(req);

    next(allowed.some((role) => account.roles.includes(role)) ? undefined : new ApiError('FORBIDDEN'));
  };

  return { requireAuth, requireRole };
}
