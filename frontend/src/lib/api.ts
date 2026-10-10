import * as z from 'zod/mini';

/*
 * The one way the browser talks to Core, the backend. The session is two cookies the page cannot
 * read (they are HttpOnly), so nothing here stores, reads or sends a token: `credentials: 'include'`
 * lets the browser attach them. Every answer has the shape `{ data, error }` and is parsed before
 * it is used; an error is a code, and the words for it come from the locale files.
 */
const BASE = (import.meta.env.VITE_BACKEND_URL ?? '').replace(/\/+$/, '');

/** The address of a Core route, for the two places that navigate to one (the Google sign-in). */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

const Failure = z.object({
  error: z.object({ code: z.string(), retryAfterSeconds: z.optional(z.number()) }),
});

export class ApiFailure extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(code: string, status: number, retryAfterSeconds: number | null = null) {
    super(code);
    this.name = 'ApiFailure';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type Request = { method?: 'GET' | 'POST' | 'PUT'; body?: Record<string, string | number | boolean> };

/** Calls Core and returns the parsed `data`. Throws `ApiFailure` for every other outcome. */
export async function api<Output>(path: string, schema: z.ZodMiniType<Output>, request: Request = {}): Promise<Output> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), {
      method: request.method ?? 'GET',
      credentials: 'include',
      headers: request.body ? { 'content-type': 'application/json' } : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
    });
  } catch {
    throw new ApiFailure('NETWORK', 0);
  }

  const text = await response.text();
  let payload: z.infer<typeof z.json> = null;

  try {
    payload = z.json().parse(JSON.parse(text));
  } catch {
    throw new ApiFailure('UNREADABLE', response.status);
  }

  if (!response.ok) {
    const failure = Failure.safeParse(payload);

    throw failure.success
      ? new ApiFailure(failure.data.error.code, response.status, failure.data.error.retryAfterSeconds ?? null)
      : new ApiFailure('UNREADABLE', response.status);
  }

  const success = z.object({ data: schema }).safeParse(payload);

  if (!success.success) throw new ApiFailure('UNREADABLE', response.status);

  return success.data.data;
}
