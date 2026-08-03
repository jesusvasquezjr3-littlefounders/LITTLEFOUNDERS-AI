import crypto from 'crypto';
import express from 'express';
import { getConfig } from './env.js';
import { audioRouter, type AudioRouterDeps } from './routes/audio.js';

export const SERVICE = 'audiogen';
export const VERSION = '0.1.0';

export interface AppDeps {
  audio?: AudioRouterDeps;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const config = getConfig();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // Everything below /internal is service-to-service only (/AGENTS.md §1.5),
  // same header convention as parent-id-check: x-internal-api-key.
  app.use('/internal', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
      return res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
    }
    next();
  });

  app.use('/internal/v1/audio', audioRouter(deps.audio));

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error-handling middleware MUST have 4 params to be recognized as such by
  // Express — Express 5 forwards rejected async handler promises (and body
  // parse errors) here. Last-resort §1.6 envelope guarantee: without it,
  // finalhandler answers text/html with a stack trace outside production.
  app.use(envelopeErrorHandler);

  return app;
}

// Envelope codes for client errors that middleware (body-parser et al.)
// forwards with a numeric 4xx status: 400 = entity.parse.failed, 413 =
// entity.too.large, 415 = charset/encoding.unsupported. Unlisted 4xx fall
// back to a generic BAD_REQUEST.
const CLIENT_ERROR_ENVELOPES: Record<number, { code: string; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'Malformed request body' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported request encoding' },
};

/** Numeric 4xx carried on err.status/err.statusCode, or null when absent. */
function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  const raw = typeof status === 'number' ? status : typeof statusCode === 'number' ? statusCode : null;
  return raw !== null && Number.isInteger(raw) && raw >= 400 && raw <= 499 ? raw : null;
}

// Exported so tests can mount it behind a deliberately-throwing route.
export function envelopeErrorHandler(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (res.headersSent) return next(err);
  // A forwarded error carrying a numeric 4xx status is the CLIENT's fault
  // (e.g. express.json() parse failure → 400) — honor the status instead of
  // collapsing it into a 500. Messages stay generic: err.message on
  // non-expose errors can leak internals.
  const status = clientErrorStatus(err);
  if (status !== null) {
    const envelope = CLIENT_ERROR_ENVELOPES[status] ?? { code: 'BAD_REQUEST', message: 'Request rejected' };
    res.status(status).json({ data: null, error: envelope });
    return;
  }
  console.error(`[${SERVICE}] unhandled error:`, err);
  res.status(500).json({ data: null, error: { code: 'INTERNAL', message: 'Internal server error' } });
}
