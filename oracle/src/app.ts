import express from 'express';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { requireInternalKey } from './lib/http.js';
import { runtimeRouter } from './routes/runtime.js';
import { modelConfigured } from './model/provider.js';
import { getVoiceProvider } from './voice/index.js';
import { moderationReadiness } from './safety/moderation.js';

export const SERVICE = 'oracle';
export const VERSION = '0.1.0';

/**
 * @param liveSessions how many websocket sessions are currently open. Injected
 * rather than imported so `createApp()` stays constructible in a test without
 * standing up a websocket server.
 */
export function createApp(liveSessions: () => number = () => 0): express.Express {
  const app = express();
  app.set('trust proxy', 1);

  /*
   * /health is mounted ABOVE the rate limiter and above every optional
   * dependency (/AGENTS.md §1.14). Railway polls it continuously, so it must
   * not consume a caller's budget, and it must not fail because Redis, the
   * model provider or the voice provider are having a bad day — a service that
   * cannot answer its healthcheck gets restarted, which fixes none of those
   * and takes the working parts down too.
   *
   * The components block reports degradation without ever failing on it.
   */
  app.get('/health', (_req, res) => {
    res.json({
      data: {
        service: SERVICE,
        version: VERSION,
        status: 'ok',
        components: {
          model: modelConfigured() ? 'up' : 'down',
          voice: getVoiceProvider().available ? 'up' : 'down',
          moderation: moderationReadiness(true).ready ? 'up' : 'down',
        },
        liveSessions: liveSessions(),
      },
      error: null,
    });
  });

  app.use(globalRateLimiter);
  app.use(express.json({ limit: '256kb' }));

  app.use('/api/v1/tutor', requireInternalKey, runtimeRouter(liveSessions));

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Express identifies error middleware by arity — the 4th param must exist
  // even though nothing calls it.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[${SERVICE}] unhandled error:`, err);
    res.status(500).json({ data: null, error: { code: 'INTERNAL', message: 'Unexpected error' } });
  });

  return app;
}
