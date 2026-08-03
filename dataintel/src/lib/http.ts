import type { Response } from 'express';

export function fail(res: Response, status: number, code: string, message: string): Response {
  return res.status(status).json({ data: null, error: { code, message } });
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data, error: null });
}
