import crypto from 'crypto';
import express from 'express';
import { z } from 'zod';
import { NoopAdapter, type EmailAdapter } from './services/adapter.js';

export const SERVICE = 'email-server';
export const VERSION = '0.1.0';

const SendBody = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
});

export function createApp(adapter: EmailAdapter = new NoopAdapter()): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  app.use('/api/v1/send', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = process.env.INTERNAL_API_KEY ?? '';
    
    // Check key presence securely
    if (!expected || provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      return res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
    }
    next();
  });

  app.post('/api/v1/send', async (req, res) => {
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid body' },
      });
      return;
    }
    const result = await adapter.send(parsed.data);
    res.status(202).json({ data: result, error: null });
  });

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
