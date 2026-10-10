import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { Config } from './config.js';
import { ApiError, sendData, sendError } from './lib/http.js';
import { describeError, log, toError } from './lib/log.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { cors, noStore, requireOwnOrigin } from './middleware/security.js';
import { createAccountRouter } from './routes/account.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createEmailRouter, createOneClickRouter } from './routes/email.js';
import { createHooksRouter } from './routes/hooks.js';
import { createCookies } from './services/cookies.js';
import { createGotrue } from './services/gotrue.js';
import { keyFor, type Limits } from './services/limits.js';
import { createMailer } from './services/mailer.js';
import { createUnsubscribe } from './services/unsubscribe.js';
import { createTokenVerifier } from './services/tokens.js';
import { createVault, VaultError } from './services/vault.js';

export const SERVICE = 'core';
export const VERSION = '0.1.0';

/*
 * Core: the only server the browser talks to. Order matters below: the visitor's address is
 * established first (limits count by it), then headers, then the capacity limit, then the origin
 * check, and only then is a body read.
 *
 * Two callers are not browsers and are let in before the origin check, each proving itself its own
 * way: the authentication service's hook (a signature, routes/hooks.ts) and a mail program's
 * one-click unsubscribe (the token in the link, routes/email.ts).
 */
export function createApp(config: Config, limits: Limits): express.Express {
  const app = express();
  const gotrue = createGotrue(config);
  const vault = createVault(config);
  const cookies = createCookies(config);
  const verifyToken = createTokenVerifier(config);
  const auth = createAuthMiddleware({ cookies, verifyToken, vault });
  const mailer = createMailer(config);
  const unsubscribe = createUnsubscribe(config);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);

  // Core answers JSON and redirects, never a page: nothing may be loaded, framed or sniffed from it.
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Off on purpose: Core serves no page, and this header on the redirect that ends a Google
    // sign-in would cut the small sign-in window off from the page that is waiting for it.
    crossOriginOpenerPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  }));
  app.use(noStore);

  // The platform's health check. It says nothing about what is behind Core.
  app.get('/health', (_req, res) => sendData(res, { service: SERVICE, version: VERSION, status: 'ok' }));

  // Before the per-address capacity limit: every call comes from the authentication service's one address.
  app.use('/api/v1/hooks', createHooksRouter({ config, vault, mailer, unsubscribe }));

  app.use(cors(config));
  app.use(async (req, _res, next) => {
    await limits.consume('ipGlobal', keyFor(req.ip ?? 'unknown'));
    next();
  });
  app.use('/api/v1/email', createOneClickRouter({ vault, limits, unsubscribe }));
  app.use(requireOwnOrigin(config));
  app.use(express.json({ limit: '10kb', type: 'application/json' }));

  app.use('/api/v1/auth', createAuthRouter({ config, gotrue, vault, cookies, limits, auth, verifyToken }));
  app.use('/api/v1/account', createAccountRouter({ vault, limits, auth, mailer, unsubscribe }));
  app.use('/api/v1/email', createEmailRouter({ vault, limits, unsubscribe }));
  app.use('/api/v1/admin', createAdminRouter({ vault, auth }));

  app.use((_req, _res, next) => next(new ApiError('NOT_FOUND')));

  // One place turns anything thrown into an answer. The cause is logged; the caller gets a code.
  app.use((thrown: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(thrown);
    if (thrown instanceof ApiError) return sendError(res, thrown);

    const error = toError(thrown);

    // A body that is not valid JSON, or is too large, is the caller's mistake.
    if (error.name === 'SyntaxError' || error.name === 'PayloadTooLargeError') return sendError(res, new ApiError('BAD_REQUEST'));

    log.error('request.failed', { method: req.method, route: routeOf(req), ...describeError(error) });
    sendError(res, new ApiError(error instanceof VaultError ? 'UNAVAILABLE' : 'INTERNAL'));
  });

  return app;
}

/** The route pattern, never the raw path or its query string. */
function routeOf(req: Request): string {
  const pattern: unknown = req.route && typeof req.route === 'object' && 'path' in req.route ? req.route.path : undefined;

  return `${req.baseUrl}${typeof pattern === 'string' ? pattern : ''}` || 'unmatched';
}
