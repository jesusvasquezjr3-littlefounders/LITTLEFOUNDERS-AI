import express from 'express';
import helmet from 'helmet';
import { cors } from './middleware/cors.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { learnRouter } from './routes/learn.js';
import { ownProfileRouter, publicProfilesRouter } from './routes/profile.js';
import { verificationRouter } from './routes/verification.js';

export const SERVICE = 'backend';
export const VERSION = '0.1.0';

export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(globalRateLimiter);
  app.use(cors);
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  app.use('/api/v1/auth', authRouter());
  app.use('/api/v1/verification', verificationRouter());
  app.use('/api/v1/learn', learnRouter());
  app.use('/api/v1/profile', ownProfileRouter());
  app.use('/api/v1/profiles', publicProfilesRouter());

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
    const message = err instanceof Error && err.name === 'MulterError' ? 'Upload rejected (size/shape)' : 'Unexpected error';
    const status = err instanceof Error && err.name === 'MulterError' ? 400 : 500;
    res.status(status).json({ data: null, error: { code: status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL', message } });
  });

  return app;
}
