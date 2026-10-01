import crypto from 'crypto';
import express from 'express';
import { getConfig } from './env.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { intelRouter } from './routes/queries.js';
import { contentRetirementRouter } from './routes/contentRetirement.js';
import { contentRetirementGate } from './services/contentRetirement.js';
import { isReady } from './db/duckdb.js';
import { getSyncHealth } from './db/sync.js';
import { cacheClient } from './middleware/cache.js';

export const SERVICE = 'dataintel';
export const VERSION = '0.1.0';

export function createApp(): express.Express {
  const config = getConfig();
  const app = express();

  app.use(express.json({ limit: '256kb' }));

  app.get('/health', async (_req, res) => {
    // getSyncHealth() never throws and never touches duckdb while it's down
    // (AGENTS.md §1.14 — liveness must not depend on optional infrastructure).
    const sync = await getSyncHealth();
    res.json({
      data: {
        service: SERVICE,
        version: VERSION,
        status: 'ok',
        components: {
          duckdb: isReady() ? 'up' : 'down',
          redis: cacheClient.isOpen ? 'up' : 'down',
        },
        last_sync_at: sync.last_sync_at,
        sync_error: sync.sync_error,
      },
      error: null,
    });
  });

  app.use(globalRateLimiter);

  app.use('/api/v1', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (
      !crypto.timingSafeEqual(
        crypto.createHash('sha256').update(provided).digest(),
        crypto.createHash('sha256').update(expected).digest(),
      )
    ) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' },
      });
    }
    next();
  });

  app.use('/api/v1/intel', contentRetirementGate);
  app.use('/api/v1/intel', contentRetirementRouter());
  app.use('/api/v1/intel', intelRouter());

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
