import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getConfig } from './config.js';
import { downloadRouter } from './routes/download.js';
import { filesRouter } from './routes/files.js';

export const SERVICE = 'filebase';
export const VERSION = '0.1.0';

export function createApp(): express.Express {
  const config = getConfig();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // Management API — service-to-service only (/AGENTS.md §1.5).
  app.use('/api/v1/files', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
      res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
      return;
    }
    next();
  });
  app.use('/api/v1/files', filesRouter());

  // Public streaming download — visibility is enforced per-object inside
  // the router (public objects are world-readable, internal ones require
  // the same key as above).
  app.use('/files', downloadRouter());

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error-handling middleware MUST have 4 params to be recognized as such
  // by Express — Express 5 forwards rejected async handler promises here.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error(`[${SERVICE}] unhandled error:`, err);
    res.status(500).json({ data: null, error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  return app;
}
