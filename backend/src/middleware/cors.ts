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
    /*
     * A cross-origin response's custom headers are invisible to JS unless
     * they are named here — only the CORS-safelisted set comes through by
     * default. Without this the insights export's truncation signal existed
     * on the wire and could never be read by the page that requested it,
     * which is the same as not having it: the console would present a clipped
     * file as complete. Response-only metadata, no credentials implied.
     */
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-LF-Export-Rows,X-LF-Export-Truncated,X-LF-Export-Next-Offset,X-LF-Export-Token',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
