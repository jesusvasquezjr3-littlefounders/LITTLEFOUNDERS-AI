import type { Response } from 'express';

/** Envelope error response (/AGENTS.md §1.6). */
export function fail(res: Response, status: number, code: string, message: string): Response {
  return res.status(status).json({ data: null, error: { code, message } });
}

/** Envelope success response. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data, error: null });
}
