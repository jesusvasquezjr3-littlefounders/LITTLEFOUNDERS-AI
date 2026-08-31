import type { Response } from 'express';

/**
 * Envelope error response (/AGENTS.md §1.6).
 *
 * `extra` merges additional, typed fields onto `error` alongside `code` and
 * `message` — the envelope shape itself (`{ data: null, error: {...} }`)
 * never changes, only what `error` carries. Used sparingly: today, only the
 * Tutor's `SESSION_LIMIT` refusal, which needs the actual computed reset
 * instant on the wire rather than making the client guess at local midnight
 * with its own (possibly wrong) clock and timezone.
 */
export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return res.status(status).json({ data: null, error: { code, message, ...extra } });
}

/** Envelope success response. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data, error: null });
}
