/*
 * Envelope-aware client for Core — the ONLY service the frontend calls
 * (/AGENTS.md §1.5). Every response is { data, error } (§1.6); error codes
 * map to i18n keys `errors.api.<code>`.
 */

// Exported for the ONE caller that cannot go through api(): the insights
// beacon's pagehide flush needs `fetch(..., { keepalive: true })`.
export const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export interface ApiError {
  code: string;
  message: string;
  /**
   * An ISO instant, present ONLY on the Tutor's `SESSION_LIMIT` refusal — the
   * server's own computed daily-cap reset time (next local midnight for the
   * learner's locale), so the client can render a real time-remaining
   * instead of guessing at midnight with its own clock/timezone. Absent on
   * every other error code; do not depend on it existing.
   */
  resetAt?: string;
  /**
   * B.2's COURSE_PREREQUISITE_REQUIRED refusal carries the slugs of the
   * prerequisite courses that are not completed yet. Absent on every other
   * error code.
   */
  missingPrerequisites?: string[];
}

/**
 * A.1 (F3-identity-site): Core answers ACCOUNT_SUSPENDED on any route once a
 * child's last verified Tutor link is gone. The session holder hears it at
 * once (AuthContext drops the session and shows the paused screen), not on
 * the next /auth/me.
 */
export const ACCOUNT_SUSPENDED_EVENT = 'lf:account-suspended';

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  token?: string | null;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: options.method ?? (options.body !== undefined || options.formData ? 'POST' : 'GET'),
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    return { data: null, error: { code: 'INTERNAL', message: 'Network error' } };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('data' in body) || !('error' in body)) {
    return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
  }
  if (body.error !== null) {
    const error = body.error;
    if (body.data === null && error && typeof error === 'object'
      && 'code' in error && typeof error.code === 'string'
      && 'message' in error && typeof error.message === 'string') {
      if (error.code === 'ACCOUNT_SUSPENDED' && typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_SUSPENDED_EVENT));
      return { data: null, error: error as ApiError };
    }
  } else if (res.ok && body.data !== null && body.data !== undefined) {
    return { data: body.data as T, error: null };
  }
  return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
}
