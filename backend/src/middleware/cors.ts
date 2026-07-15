import type { NextFunction, Request, Response } from 'express';
import { getConfig } from '../config.js';

/*
 * Minimal CORS for the one known consumer (the SPA at FRONTEND_URL) — no
 * wildcard, no dependency. Credentials stay off: auth travels in the
 * Authorization header, never cookies.
 */
export function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  
  // If an origin is provided and it doesn't match our frontend, reject preflight outright
  if (origin && origin !== getConfig().FRONTEND_URL) {
    if (req.method === 'OPTIONS') {
      res.status(403).end();
      return;
    }
    // We could reject all requests here, but standard CORS practice is to omit headers
    // and let the browser block the response, or we can just block it server-side.
    // For maximum security on an internal API, we reject it.
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'CORS policy violation' } });
    return;
  }

  if (origin === getConfig().FRONTEND_URL) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
