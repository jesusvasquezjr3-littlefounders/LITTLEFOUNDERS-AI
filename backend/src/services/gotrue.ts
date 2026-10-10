import { z } from 'zod';
import type { Config } from '../config.js';

/*
 * The authentication service (Supabase's GoTrue), reached through the gateway. It owns the
 * accounts, issues and checks the one-time codes, talks to Google and signs the session tokens;
 * Core never stores a code or a token of its own.
 *
 * Every call carries the service key as `apikey`, because the gateway lets nobody else through
 * (database/railway/kong/kong.yml), and an explicit bearer: the anon key for a call made on behalf
 * of somebody who has not signed in, or that person's own access token. The service key is never
 * the bearer here, so no call below runs with administrator rights.
 */
const Session = z.object({
  access_token: z.string().min(20),
  refresh_token: z.string().min(8),
  expires_in: z.number().int().positive(),
  user: z.object({ id: z.uuid() }),
});

export type Session = Readonly<{ accessToken: string; refreshToken: string; expiresInSeconds: number; userId: string }>;

/** What went wrong, as far as the caller needs to tell apart. */
export type GotrueFailure = 'rejected' | 'rate_limited' | 'unavailable';

export type GotrueResult<T> = { ok: true; value: T } | { ok: false; failure: GotrueFailure };

const Settings = z.object({ external: z.object({ google: z.boolean().optional() }) });

const TIMEOUT_MS = 8000;

export type Gotrue = ReturnType<typeof createGotrue>;

export function createGotrue(config: Config) {
  const base = `${config.supabaseUrl}/auth/v1`;

  async function call(path: string, init: { method: 'GET' | 'POST'; bearer?: string; body?: object }): Promise<GotrueResult<string>> {
    let response: Response;

    try {
      response = await fetch(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: config.supabaseServiceRoleKey,
          authorization: `Bearer ${init.bearer ?? config.supabaseAnonKey}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { ok: false, failure: 'unavailable' };
    }

    if (response.ok) return { ok: true, value: await response.text() };
    if (response.status === 429) return { ok: false, failure: 'rate_limited' };
    if (response.status >= 500) return { ok: false, failure: 'unavailable' };

    return { ok: false, failure: 'rejected' };
  }

  async function session(path: string, body: object): Promise<GotrueResult<Session>> {
    const result = await call(path, { method: 'POST', body });

    if (!result.ok) return result;

    const parsed = Session.safeParse(parseJson(result.value));

    if (!parsed.success) return { ok: false, failure: 'unavailable' };

    return {
      ok: true,
      value: {
        accessToken: parsed.data.access_token,
        refreshToken: parsed.data.refresh_token,
        expiresInSeconds: parsed.data.expires_in,
        userId: parsed.data.user.id,
      },
    };
  }

  return {
    /**
     * Emails a one-time code. With `createAccount`, an address nobody has used yet gets an account
     * that stays unconfirmed until the code is entered; without it, an unknown address gets nothing.
     */
    async sendCode(email: string, options: { createAccount: boolean; locale: string }): Promise<GotrueResult<null>> {
      const result = await call('/otp', {
        method: 'POST',
        body: { email, create_user: options.createAccount, data: { locale: options.locale } },
      });

      return result.ok ? { ok: true, value: null } : result;
    },

    /** Checks a code. The service accepts each code once and only until it expires. */
    verifyCode: (email: string, code: string) => session('/verify', { type: 'email', email, token: code }),

    refresh: (refreshToken: string) => session('/token?grant_type=refresh_token', { refresh_token: refreshToken }),

    /** The second half of a Google sign-in: the code Google's round trip produced, plus the proof that this browser started it. */
    exchangeOAuthCode: (authCode: string, codeVerifier: string) =>
      session('/token?grant_type=pkce', { auth_code: authCode, code_verifier: codeVerifier }),

    /** Ends this session only (other devices stay signed in) and revokes its refresh token. */
    async signOut(accessToken: string): Promise<GotrueResult<null>> {
      const result = await call('/logout?scope=local', { method: 'POST', bearer: accessToken });

      return result.ok ? { ok: true, value: null } : result;
    },

    async googleEnabled(): Promise<boolean> {
      const result = await call('/settings', { method: 'GET' });

      if (!result.ok) return false;

      const parsed = Settings.safeParse(parseJson(result.value));

      return parsed.success && parsed.data.external.google === true;
    },

    /** Where the browser goes to choose a Google account. This one address is open at the gateway. */
    googleAuthorizeUrl(params: { redirectTo: string; codeChallenge: string }): string {
      const url = new URL(`${base}/authorize`);

      url.searchParams.set('provider', 'google');
      url.searchParams.set('redirect_to', params.redirectTo);
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', 's256');
      // Always show the account chooser, so a shared computer does not sign the next person in as the last one.
      url.searchParams.set('prompt', 'select_account');

      return url.toString();
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
