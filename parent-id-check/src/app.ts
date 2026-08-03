import crypto from 'crypto';
import express from 'express';
import { getConfig } from './config.js';
import { verificationsRouter } from './routes/verifications.js';
import { recognize as defaultRecognize, type RecognizeFn } from './services/ocr.js';

export const SERVICE = 'parent-id-check';
export const VERSION = '0.1.0';

export interface AppDeps {
  /** Injectable OCR for tests; defaults to the tesseract.js worker. */
  recognize?: RecognizeFn;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const config = getConfig();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  // Everything below /internal is service-to-service only (/AGENTS.md §1.5).
  app.use('/internal', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
      return res
        .status(401)
        .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
    }
    next();
  });

  app.use('/internal/v1/verifications', verificationsRouter(deps.recognize ?? defaultRecognize));

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
