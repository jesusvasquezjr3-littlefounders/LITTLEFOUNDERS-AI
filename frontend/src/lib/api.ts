/*
 * Envelope-aware client for Core — the ONLY service the frontend calls
 * (/AGENTS.md §1.5). Every response is { data, error } (§1.6); error codes
 * map to i18n keys `errors.api.<code>`.
 */

const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export interface ApiError {
  code: string;
  message: string;
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

  const body = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!body || (body.data === null && body.error === null)) {
    return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
  }
  return body;
}
