import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { Session } from './gotrue.js';

/*
 * The session lives in two cookies the page's JavaScript cannot read (HttpOnly), so a script
 * injected into the page cannot carry the session away. In production they are also Secure and use
 * the `__Host-` prefix, which makes the browser refuse them unless they came over https from this
 * exact host with Path=/ and no Domain: a sibling subdomain cannot plant or overwrite them.
 *
 * SameSite=Strict keeps them out of every request another site starts. The short-lived cookie that
 * carries a Google sign-in across the round trip has to be Lax, because the browser comes back
 * from Google by a top-level navigation.
 */
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_MAX_AGE_SECONDS = 10 * 60;

const OAuthState = z.object({
  verifier: z.string().min(43).max(128),
  mode: z.enum(['popup', 'redirect']),
});

export type OAuthState = z.infer<typeof OAuthState>;

export type Cookies = ReturnType<typeof createCookies>;

export function createCookies(config: Config) {
  const prefix = config.isProduction ? '__Host-' : '';
  const names = { access: `${prefix}lf_at`, refresh: `${prefix}lf_rt`, oauth: `${prefix}lf_oauth` };
  const base: CookieOptions = { httpOnly: true, secure: config.isProduction, path: '/' };
  const strict: CookieOptions = { ...base, sameSite: 'strict' };
  const lax: CookieOptions = { ...base, sameSite: 'lax' };

  function read(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;

    if (!header) return undefined;

    const value = parseCookie(header)[name];

    return value === undefined || value === '' ? undefined : value;
  }

  return {
    accessToken: (req: Request) => read(req, names.access),
    refreshToken: (req: Request) => read(req, names.refresh),

    setSession(res: Response, session: Session): void {
      // The access cookie leaves with the token it holds; the refresh cookie outlives it.
      res.cookie(names.access, session.accessToken, { ...strict, maxAge: session.expiresInSeconds * 1000 });
      res.cookie(names.refresh, session.refreshToken, { ...strict, maxAge: REFRESH_MAX_AGE_SECONDS * 1000 });
    },

    clearSession(res: Response): void {
      res.clearCookie(names.access, strict);
      res.clearCookie(names.refresh, strict);
    },

    setOAuthState(res: Response, state: OAuthState): void {
      res.cookie(names.oauth, Buffer.from(JSON.stringify(state), 'utf8').toString('base64url'), { ...lax, maxAge: OAUTH_MAX_AGE_SECONDS * 1000 });
    },

    /** Reads the state of the Google sign-in this browser started, if any. */
    oauthState(req: Request): OAuthState | null {
      const raw = read(req, names.oauth);

      if (!raw) return null;

      try {
        const parsed = OAuthState.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));

        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    clearOAuthState(res: Response): void {
      res.clearCookie(names.oauth, lax);
    },
  };
}
