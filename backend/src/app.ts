import express from 'express';
import helmet from 'helmet';
import { cors } from './middleware/cors.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { adminRouter } from './routes/admin.js';
import { familyRouter } from './routes/family.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { learnRouter } from './routes/learn.js';
import { onboardingRouter } from './routes/onboarding.js';
import { ownProfileRouter, publicProfilesRouter } from './routes/profile.js';
import { verificationRouter } from './routes/verification.js';

export const SERVICE = 'backend';
export const VERSION = '0.1.0';

/** HTTP status carried by a thrown middleware error, or 500 if it has none. */
function errorStatus(err: unknown): number {
  if (err instanceof Error && err.name === 'MulterError') return 400;
  const raw = (err as { status?: unknown; statusCode?: unknown } | null)?.status
    ?? (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof raw === 'number' && raw >= 400 && raw <= 599 ? raw : 500;
}

export function createApp(): express.Express {
  const app = express();
  // Core runs behind exactly one reverse proxy (Railway's edge). Without this,
  // req.ip is the proxy address and EVERY client shares one rate-limit bucket —
  // so trust one hop and key rate limits on the real client IP (X-Forwarded-For).
  app.set('trust proxy', 1);
  app.use(helmet());

  // /health is mounted ABOVE the rate limiter on purpose. It is Railway's
  // liveness probe: it must not consume the caller's 200-req/15-min budget
  // (the platform polls it continuously), and it must not depend on the Redis
  // store being reachable. Previously a Redis outage made the limiter error on
  // every request — including this one — so a degraded rate limiter failed the
  // healthcheck and took the whole service down.
  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // cors BEFORE the limiter: a 429 is a response the SPA must be able to read.
  // With the limiter first, the RATE_LIMITED envelope went out without
  // Access-Control-Allow-Origin, so the browser discarded it and the user saw
  // an opaque network error instead of "slow down".
  app.use(cors);
  // Telemetry sits ABOVE the global limiter with its own budget + json
  // parser (events.ts): beacon traffic must not drain the per-IP pool that
  // lessons and auth depend on, and a 429 here is invisible by design.
  app.use('/api/v1/events', eventsRouter());
  app.use(globalRateLimiter);
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/v1/auth', authRouter());
  app.use('/api/v1/verification', verificationRouter());
  app.use('/api/v1/learn', learnRouter());
  app.use('/api/v1/onboarding', onboardingRouter());
  app.use('/api/v1/family', familyRouter());
  app.use('/api/v1/profile', ownProfileRouter());
  app.use('/api/v1/profiles', publicProfilesRouter());
  app.use('/api/v1/admin', adminRouter());

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Envelope error handler (multer size limits, JSON parse errors, …).
  // Express identifies error middleware by arity — the 4th param must exist.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
      console.error('TEST 500 ERROR:', err);
    } else {
      console.error(`[${SERVICE}] unhandled error:`, err);
    }
    // body-parser and multer both attach an HTTP `status` to their errors
    // (400 entity.parse.failed, 413 entity.too.large). Honour it instead of
    // flattening every client mistake into 500 INTERNAL, which told the caller
    // "we broke" when in fact their body was malformed or oversized.
    const status = errorStatus(err);
    const clientError = status >= 400 && status < 500;
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : clientError ? 'VALIDATION_ERROR' : 'INTERNAL';
    const message =
      status === 413
        ? 'Request body is too large'
        : err instanceof Error && err.name === 'MulterError'
          ? 'Upload rejected (size/shape)'
          : clientError
            ? 'Malformed request body'
            : 'Unexpected error';
    res.status(status).json({ data: null, error: { code, message } });
  });

  return app;
}
