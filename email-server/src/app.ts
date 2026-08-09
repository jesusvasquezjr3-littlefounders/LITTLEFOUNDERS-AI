import crypto from 'crypto';
import express from 'express';
import { z } from 'zod';
import { NoopAdapter, type EmailAdapter } from './services/adapter.js';
import { getEmailLogs, getEmailSummary, recordDelivery, recordEmail } from './services/emailLog.js';

export const SERVICE = 'email-server';
export const VERSION = '0.2.0';

/** Fixed-width (32-byte) digest, so timingSafeEqual can never length-mismatch. */
const digest = (v: string): Buffer => crypto.createHash('sha256').update(v, 'utf8').digest();

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
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(32).optional(),
  templateType: z.string().trim().max(64).optional(),
});

const LogsSummaryQuery = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

/*
 * What the Haraka SMTP plugin reports for mail it relayed (GoTrue auth mail).
 * `to` is NOT z.string().email() here on purpose: this records what the relay
 * actually accepted, and refusing to log an address the SMTP layer already
 * delivered to would put a hole in the audit trail.
 */
const DeliveryBody = z.object({
  messageId: z.string().min(1).max(998),
  to: z.string().min(1).max(320),
  subject: z.string().max(998).default(''),
  status: z.string().min(1).max(32).default('relayed'),
  templateType: z.string().min(1).max(64).default('auth'),
  locale: z.string().min(2).max(10).optional(),
  userId: z.string().uuid().optional(),
  detail: z.record(z.string(), z.unknown()).default({}),
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

    // Compare fixed-width digests, never the raw buffers. `provided.length`
    // counts UTF-16 code units while `Buffer.from()` yields UTF-8 bytes, so a
    // same-character-length header containing any byte >= 0x80 produced a
    // longer buffer and made timingSafeEqual THROW RangeError — surfacing as a
    // 500 (HTML, pre-error-handler) instead of a 401 envelope. Hashing also
    // removes the key-length side channel the pre-check leaked.
    if (!expected || !crypto.timingSafeEqual(digest(provided), digest(expected))) {
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
    await recordEmail(result, parsed.data, {
      templateType: parsed.data.templateType,
      locale: parsed.data.locale,
      userId: parsed.data.userId,
    });
    res.status(202).json({ data: result, error: null });
  });

  /*
   * Delivery capture for the SMTP path. Called by the Haraka plugin
   * (haraka/plugins/log_delivery.js) once a message has been successfully
   * relayed to SES, so GoTrue's auth mail — which never touches POST /send —
   * still lands in the history the admin console reads.
   */
  app.post('/api/v1/logs', async (req, res) => {
    const parsed = DeliveryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid body' },
      });
      return;
    }
    await recordDelivery(parsed.data);
    res.status(202).json({ data: { recorded: true, messageId: parsed.data.messageId }, error: null });
  });

  app.get('/api/v1/logs', async (req, res) => {
    const parsed = LogsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query' },
      });
      return;
    }
    const logs = await getEmailLogs(parsed.data);
    if (!logs) {
      res.status(502).json({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Email history unavailable' } });
      return;
    }
    res.json({ data: logs, error: null });
  });

  app.get('/api/v1/logs/summary', async (req, res) => {
    const parsed = LogsSummaryQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query' },
      });
      return;
    }
    const summary = await getEmailSummary(parsed.data.days);
    if (!summary) {
      res.status(502).json({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Email statistics unavailable' } });
      return;
    }
    res.json({ data: summary, error: null });
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
