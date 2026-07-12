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
  email: string;
  user_metadata?: Record<string, unknown>;
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
