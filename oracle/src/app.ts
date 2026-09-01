import express from 'express';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { requireInternalKey } from './lib/http.js';
import { runtimeRouter } from './routes/runtime.js';
import { modelConfigured } from './model/provider.js';
import { getVoiceProvider } from './voice/index.js';
import { moderationReadiness } from './safety/moderation.js';
import { spendGuard } from './session/spend-guard.js';

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
    // A pure in-memory read (§1.14 — never coupled to anything optional, same
    // as every other field in this block), so it belongs beside them rather
    // than only in a log line: an operator watching this endpoint sees the
    // spend ceiling trip in the same place they already watch everything
    // else (/ORACLE.md §15.2 item 1).
    const spend = spendGuard.snapshot();
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
        spend: {
          todayUsd: Number(spend.spentUsd.toFixed(6)),
          ceilingUsd: spend.ceilingUsd,
          admittingNewSessions: spend.admitting,
        },
      },
      error: null,
    });
  });

  app.use(globalRateLimiter);

  /*
   * AUTHENTICATE THE INTERNAL SURFACE BEFORE PARSING A BODY FOR IT.
   *
   * The limiter above deliberately skips `/api/v1/tutor` — its only caller is
   * Core, from one address, and an IP bucket in front of a shared secret
   * defended nobody while making ~200 tutor page views able to take the
   * platform down (see middleware/rateLimit.ts). But skipping it means an
   * unauthenticated flood is no longer bounded here, and with the body parser
   * mounted first, every one of those requests would buy 256 kB of JSON
   * parsing before `requireInternalKey` got to reject it.
   *
   * So the key check moves ABOVE the parser. It reads one header and compares
   * fixed-width digests, which is as cheap as a rejection gets. The parser
   * still runs for the authenticated request that follows it.
   */
  app.use('/api/v1/tutor', requireInternalKey);
  app.use(express.json({ limit: '256kb' }));

  app.use('/api/v1/tutor', runtimeRouter(liveSessions));

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Express identifies error middleware by arity — the 4th param must exist
  // even though nothing calls it.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    /*
     * A BODY OVER THE LIMIT IS THE CALLER'S FAULT, NOT OURS.
     *
     * `express.json()` throws a typed error for an oversized or malformed body,
     * and it landed here — so a 300 kB request came back `500 INTERNAL`, which
     * tells the caller we broke and invites a retry of the exact thing that
     * cannot work. Both codes already exist in the frontend's error map
     * (§1.6); nothing was producing them. Found while checking that an
     * unauthenticated request is rejected before its body is parsed.
     */
    const status = (err as { status?: number; statusCode?: number })?.status
      ?? (err as { statusCode?: number })?.statusCode;
    const type = (err as { type?: string })?.type;

    if (status === 413 || type === 'entity.too.large') {
      res.status(413).json({
        data: null,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'That request was too large.' },
      });
      return;
    }
    if (status === 400 && typeof type === 'string' && type.startsWith('entity.')) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'That request body could not be read.' },
      });
      return;
    }

    console.error(`[${SERVICE}] unhandled error:`, err);
    res.status(500).json({ data: null, error: { code: 'INTERNAL', message: 'Unexpected error' } });
  });

  return app;
}
