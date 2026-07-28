import crypto from 'crypto';
import express from 'express';
import { z } from 'zod';
import { NoopAdapter, type EmailAdapter } from './services/adapter.js';
import { getEmailLogs, getEmailSummary, recordEmail } from './services/emailLog.js';

export const SERVICE = 'email-server';
export const VERSION = '0.2.0';

const SendBody = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  templateType: z.string().optional(),
  locale: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const LogsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createApp(adapter: EmailAdapter = new NoopAdapter()): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  app.use('/api/v1', (req, res, next) => {
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = process.env.INTERNAL_API_KEY ?? '';

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
    recordEmail(result, parsed.data, {
      templateType: parsed.data.templateType,
      locale: parsed.data.locale,
      userId: parsed.data.userId,
    });
    res.status(202).json({ data: result, error: null });
  });

  app.get('/api/v1/logs', (req, res) => {
    const parsed = LogsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query' },
      });
      return;
    }
    res.json({ data: getEmailLogs(parsed.data), error: null });
  });

  app.get('/api/v1/logs/summary', (_req, res) => {
    res.json({ data: getEmailSummary(), error: null });
  });

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // §1.6: every response uses the envelope, including 500s. Without this,
  // Express's default handler answers with an HTML page carrying a stack
  // trace — a malformed JSON body or a failed adapter.send() would both
  // leak absolute paths to the caller.
  // Express identifies error middleware by arity — the 4th param must exist.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const malformedBody = err instanceof SyntaxError && 'body' in err;
    const status = malformedBody ? 400 : 500;
    const code = malformedBody ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    const message = malformedBody ? 'Malformed JSON body' : 'Unexpected server error';
    console.error(`[${SERVICE}] ${code}:`, err);
    res.status(status).json({ data: null, error: { code, message } });
  });

  return app;
}
