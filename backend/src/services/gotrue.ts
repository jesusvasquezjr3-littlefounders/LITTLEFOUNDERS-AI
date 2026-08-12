import { getConfig } from '../config.js';

/*
 * Thin GoTrue (Supabase Auth) client over fetch — Core is the only service
 * the frontend talks to (/AGENTS.md §1.5), so auth flows proxy through here.
 * Social login (Google first, then Discord/Facebook…) plugs in later via
 * GoTrue's /authorize provider flow — same envelope, new route; nothing in
 * this module's shape needs to change.
 */

export interface GotrueUser {
  id: string;
  /** null for a guest (anonymous) user — GoTrue never fabricates an email for one. */
  email: string | null;
  user_metadata?: Record<string, unknown>;
  /** GoTrue's guest-session marker — distinct from, and unrelated to, the pre-signup `lf_aid` marketing visitor id. */
  is_anonymous?: boolean;
}

export interface GotrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: GotrueUser;
}

export interface GotrueError {
  status: number;
  code: string;
  message: string;
}

type GotrueResult<T> = { data: T; error: null } | { data: null; error: GotrueError };

function authHeaders(): Record<string, string> {
  const { SUPABASE_ANON_KEY } = getConfig();
  return { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}

/** GoTrue error payloads vary by version/endpoint — normalize them. */
function normalizeError(status: number, body: Record<string, unknown>): GotrueError {
  const message = String(body.msg ?? body.error_description ?? body.message ?? body.error ?? 'Auth error');
  const lower = message.toLowerCase();
  let code = 'INTERNAL';
  if (lower.includes('already registered') || lower.includes('already been registered')) code = 'EMAIL_IN_USE';
  else if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) code = 'INVALID_CREDENTIALS';
  else if (lower.includes('not confirmed')) code = 'EMAIL_NOT_CONFIRMED';
  else if (status === 429) code = 'RATE_LIMITED';
  else if (status >= 400 && status < 500) code = 'VALIDATION_ERROR';
  return { status, code, message };
}

async function gotrue<T>(path: string, init: RequestInit): Promise<GotrueResult<T>> {
  const { SUPABASE_URL } = getConfig();
  let res: globalThis.Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, init);
  } catch {
    return { data: null, error: { status: 502, code: 'INTERNAL', message: 'Auth service unreachable' } };
  }
  if (res.status === 204) return { data: {} as T, error: null };
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { data: null, error: normalizeError(res.status, body) };
  return { data: body as T, error: null };
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  locale: string;
  parentIntent: boolean;
}

/**
 * Sign up. With email autoconfirm ON (local) GoTrue returns a session; with
 * it OFF (production) it returns only the user — callers handle both.
 */
export function signUp(input: SignUpInput): Promise<GotrueResult<Partial<GotrueSession> & { user?: GotrueUser; id?: string }>> {
  return gotrue('/signup', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        display_name: input.displayName,
        locale: input.locale,
        parent_intent: input.parentIntent,
      },
    }),
  });
}

/**
 * Guest session — GoTrue's native anonymous sign-in (`POST /signup` with no
 * email/password, gated server-side by `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED`).
 * Creates a real `auth.users` row (`is_anonymous=true`), so every existing
 * trigger/RLS policy that only checks `auth.uid() IS NOT NULL` already
 * covers it — this is "guest" product vocabulary; do not call it "anonymous"
 * outside this GoTrue-facing layer (that word already means the unrelated
 * pre-signup `lf_aid` marketing visitor id elsewhere in this codebase).
 */
export function signInAnonymously(): Promise<GotrueResult<GotrueSession>> {
  return gotrue('/signup', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data: {} }),
  });
}

/**
 * Attaches a permanent email+password identity to the CURRENT guest session
 * (`PUT /user`, authenticated as the guest). GoTrue keeps the same
 * `auth.users.id` and flips `is_anonymous` to false in place — every row
 * already written under that id (profile, learning_stats, progress) carries
 * over with zero data migration. Never call this for an already-permanent
 * user; callers must check `isGuest` first (Core does, in the route).
 */
export function upgradeAnonymousUser(
  accessToken: string,
  attrs: { email: string; password: string },
): Promise<GotrueResult<GotrueUser>> {
  return gotrue('/user', {
    method: 'PUT',
    headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(attrs),
  });
}

export function signInWithPassword(email: string, password: string): Promise<GotrueResult<GotrueSession>> {
  return gotrue('/token?grant_type=password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
}

export function refreshSession(refreshToken: string): Promise<GotrueResult<GotrueSession>> {
  return gotrue('/token?grant_type=refresh_token', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function signOut(accessToken: string): Promise<GotrueResult<Record<string, never>>> {
  return gotrue('/logout', {
    method: 'POST',
    headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Kicks off the password-recovery email (renders `recovery.html` via
 * Courier/GoTrue — email-server/AGENTS.md). GoTrue itself always answers 200
 * regardless of whether the address has an account, so this proxy leaks
 * nothing beyond what GoTrue already guards against. `redirectTo` must be in
 * `GOTRUE_URI_ALLOW_LIST`; the `type=recovery` fragment tokens land there,
 * NOT logged in — the frontend must exchange them for a password set, never
 * treat them as a normal session (unlike the OAuth/confirmation callback).
 */
export function recover(email: string, redirectTo: string): Promise<GotrueResult<Record<string, never>>> {
  const qs = new URLSearchParams({ redirect_to: redirectTo });
  return gotrue(`/recover?${qs.toString()}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
}

/**
 * Updates the CURRENT session's user attributes (`PUT /user`). Password
 * changes apply immediately; an email change does not take effect until the
 * new address confirms via the `email_change.html` template — the user's
 * `auth.users.email` stays the old value until then, so callers must not
 * assume the new address is live from this response alone.
 */
export function updateUser(
  accessToken: string,
  attrs: { email?: string; password?: string },
  redirectTo?: string,
): Promise<GotrueResult<GotrueUser>> {
  const path = redirectTo ? `/user?${new URLSearchParams({ redirect_to: redirectTo }).toString()}` : '/user';
  return gotrue(path, {
    method: 'PUT',
    headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(attrs),
  });
}

export interface GotrueSettings {
  /** Map of external (social) provider → enabled, e.g. { google: true }. */
  external?: Record<string, boolean>;
}

/** Public GoTrue settings — tells us which social providers are enabled server-side. */
export function getSettings(): Promise<GotrueResult<GotrueSettings>> {
  return gotrue('/settings', { method: 'GET', headers: authHeaders() });
}

/**
 * Provider-specific extra params forwarded verbatim by GoTrue to the
 * provider's own OAuth authorize URL (verified live: GoTrue puts these
 * straight onto the `location` redirect, unmodified — this is not a GoTrue
 * feature we're guessing at). Google's `prompt=select_account` forces its
 * account chooser even when the browser already holds a single Google
 * session — without it Google silently re-uses that session and a user
 * with multiple Google accounts never gets to pick.
 */
const PROVIDER_AUTHORIZE_PARAMS: Partial<Record<string, Record<string, string>>> = {
  google: { prompt: 'select_account' },
};

/**
 * Build the GoTrue /authorize URL the browser is redirected to for social
 * login. Uses the PUBLIC SUPABASE_URL (Kong gateway) since the browser — not
 * Core — follows this redirect. `redirectTo` must be allow-listed in GoTrue's
 * GOTRUE_URI_ALLOW_LIST.
 */
export function authorizeUrl(provider: string, redirectTo: string): string {
  const { SUPABASE_URL } = getConfig();
  const qs = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
    ...PROVIDER_AUTHORIZE_PARAMS[provider],
  });
  return `${SUPABASE_URL}/auth/v1/authorize?${qs.toString()}`;
}
