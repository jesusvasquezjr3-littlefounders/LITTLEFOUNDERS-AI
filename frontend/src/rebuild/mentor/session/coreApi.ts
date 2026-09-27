/*
 * Envelope-aware client for Core, the only service the browser calls for
 * Mentor data. Ported unchanged from `lib/api.ts` (W2 Mentor lane): the rebuilt
 * frontend imports nothing from the legacy frontend (Frontend Bible 02 rule 23;
 * `npm run spec:check`), so the Mentor session layer carries its own copy of the
 * same call. Every response is `{ data, error }`; anything else is an error,
 * never a guessed success.
 */

export const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export interface ApiError {
  code: string;
  message: string;
  /**
   * An ISO instant, present ONLY on the Mentor's `SESSION_LIMIT` refusal: the
   * server's own computed daily-cap reset time (next local midnight for the
   * learner's locale), so the client can render a real time remaining instead
   * of guessing at midnight with its own clock and timezone. Absent on every
   * other error code.
   */
  resetAt?: string;
  /** B.2's COURSE_PREREQUISITE_REQUIRED refusal; absent on every other code. */
  missingPrerequisites?: string[];
}

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
      return { data: null, error: error as ApiError };
    }
  } else if (res.ok && body.data !== null && body.data !== undefined) {
    return { data: body.data as T, error: null };
  }
  return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
}
