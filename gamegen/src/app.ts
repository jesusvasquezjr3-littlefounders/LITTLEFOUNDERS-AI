import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getConfig } from './env.js';

export const SERVICE = 'gamegen';
export const VERSION = '0.1.0';

/** sha256 digest — always 32 bytes, so timingSafeEqual can never throw RangeError. */
function digest(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

export function createApp(): express.Express {
  const app = express();

  /*
   * /health FIRST, above every guard and every optional dependency
   * (/AGENTS.md §1.14): a service that cannot answer its platform healthcheck
   * gets restarted forever. It requires no credentials and no config.
   */
  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // Arcade is a pipeline, not a public API — requests carry small control
  // payloads only. Internal services have NO cors and NO rate limiter
  // (/AGENTS.md §1.5: never reachable from the browser).
  app.use(express.json({ limit: '256kb' }));

  /*
   * Everything under /api/v1 is service-to-service only (/AGENTS.md §1.5),
   * same header convention as the sibling internal services: x-internal-api-key,
   * compared in constant time over FIXED-WIDTH sha256 digests (§1.14). Never a
   * String.length pre-check: `String.length` counts UTF-16 code units while
   * Buffer.from() yields UTF-8 bytes, so a same-length header carrying any byte
   * >= 0x80 makes timingSafeEqual throw RangeError — a 500 instead of a 401.
   * Hashing also removes the key-length side channel.
   */
  app.use('/api/v1', (req, res, next) => {
    const expected = getConfig().INTERNAL_API_KEY;
    // FAIL CLOSED: with no key configured there is nothing to authenticate
    // against, and comparing '' with '' would make an absent header a match.
    if (!expected) {
      res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
      return;
    }
    const provided = req.get('x-internal-api-key') ?? '';
    if (!crypto.timingSafeEqual(digest(provided), digest(expected))) {
      res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
      return;
    }
    next();
  });

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error-handling middleware MUST have 4 params to be recognized as such by
  // Express — Express 5 forwards rejected async handler promises here. Even a
  // crash answers with the §1.6 envelope.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error(`[${SERVICE}] unhandled error:`, err);
    res.status(500).json({ data: null, error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  return app;
}
