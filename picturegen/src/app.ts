import crypto from 'crypto';
import express from 'express';
import { getConfig } from './env.js';
import { picturesRouter, type PicturesRouterDeps } from './routes/pictures.js';

export const SERVICE = 'picturegen';
export const VERSION = '0.1.0';

export interface AppDeps {
  pictures?: PicturesRouterDeps;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const config = getConfig();
  const app = express();
  // Generated images are small; requests only carry label/context text.
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // Everything under /api/v1 is service-to-service only (/AGENTS.md §1.5),
  // same header convention as the sibling internal services: x-internal-api-key,
  // constant-time compared.
  app.use('/api/v1', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
      return res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
    }
    next();
  });

  app.use('/api/v1/pictures', picturesRouter(deps.pictures));

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
