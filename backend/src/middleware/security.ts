import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Config } from '../config.js';
import { ApiError } from '../lib/http.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/*
 * Cross-site request forgery. The session is a cookie, so the browser attaches it to any request to
 * Core, whoever started it. Three independent things stop another site from using that:
 *   1. the cookies are SameSite=Strict (services/cookies.ts);
 *   2. here: a request that changes something must name its origin, and it must be ours;
 *   3. here: its body must be JSON, a type another site's form cannot send.
 * A request without an Origin header is refused, because every browser sends one on a POST.
 */
export function requireOwnOrigin(config: Config): RequestHandler {
  const allowed = new Set([config.frontendOrigin, config.publicApiOrigin]);

  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin');

    if (!origin || !allowed.has(origin)) return next(new ApiError('ORIGIN_NOT_ALLOWED'));

    const fetchSite = req.get('sec-fetch-site');

    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site') return next(new ApiError('ORIGIN_NOT_ALLOWED'));

    if (!req.is('application/json')) return next(new ApiError('UNSUPPORTED_MEDIA_TYPE'));

    next();
  };
}

/*
 * When the frontend and Core are on different origins, the browser needs to be told that the
 * frontend, and only the frontend, may read Core's answers and send the session with its requests.
 * Behind the frontend's own /api proxy the origins are the same and this does nothing.
 */
export function cors(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.vary('Origin');

    if (req.get('origin') === config.frontendOrigin && config.frontendOrigin !== config.publicApiOrigin) {
      res.set('Access-Control-Allow-Origin', config.frontendOrigin);
      res.set('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '600');
        res.status(204).end();

        return;
      }
    }

    next();
  };
}

/** Nothing Core answers may be stored by a browser or a proxy: answers hold a person's account. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
