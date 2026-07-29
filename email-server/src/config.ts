import { z } from 'zod';

/*
 * Env is validated once at boot (agent/core/CONVENTIONS.md) — the service
 * crashes on invalid config, never at request time.
 *
 * Courier runs one of two engines:
 *   - 'noop'   — logs and reports queued; used in dev/test with no real SMTP.
 *   - 'haraka' — boots the Haraka SMTP engine (email-server/haraka) which
 *                relays outbound to Amazon SES. Requires the SES_* credentials.
 *
 * Default engine is 'haraka' in production, 'noop' otherwise, so `npm run dev`
 * and `npm test` work without SES. INTERNAL_API_KEY has no default in
 * production: a missing key must crash boot, not silently serve unauthenticated.
 */
const Env = z.object({
  // Tolerate whatever the platform injects — Railway/Nixpacks can set NODE_ENV
  // to a value outside our enum (or empty), and boot must never crash over it.
  // We don't gate real behavior on it: EMAIL_ENGINE and INTERNAL_API_KEY are set
  // explicitly in production. A valid 'production' is honored; anything else → 'development'.
  NODE_ENV: z.enum(['development', 'test', 'production']).catch('development'),
  PORT: z.coerce.number().int().positive().default(4005),
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars').optional(),

  // Envelope/header From for our own transactional mail (GoTrue sets its own).
  MAIL_FROM: z.string().min(3).default('LittleFounders <noreply@littlefounders.ai>'),

  // Which engine to boot. Left optional; resolved per NODE_ENV below.
  EMAIL_ENGINE: z.enum(['noop', 'haraka']).optional(),

  // Haraka: where the co-located HTTP adapter submits mail (localhost listener),
  // and the HELO/hostname Haraka announces. The private submission port (587)
  // lives in haraka/config/smtp.ini; these are the knobs the supervisor needs.
  HARAKA_LOCAL_HOST: z.string().min(1).default('127.0.0.1'),
  HARAKA_LOCAL_PORT: z.coerce.number().int().positive().default(2525),
  HARAKA_HOSTNAME: z.string().min(1).default('email-server.railway.internal'),

  // Amazon SES SMTP smarthost — the last-mile relay. Required when engine=haraka.
  // SES_SMTP_USER/PASS are region-scoped SES SMTP credentials, NOT AWS keys.
  SES_RELAY_HOST: z.string().min(1).optional(),
  SES_RELAY_PORT: z.coerce.number().int().positive().default(587),
  SES_SMTP_USER: z.string().min(1).optional(),
  SES_SMTP_PASS: z.string().min(1).optional(),

  // Vault (0021 email_logs) — the durable delivery history. OPTIONAL on
  // purpose: without them Courier still sends mail and still serves
  // /api/v1/logs, just from the in-process ring buffer that dies on restart.
  // `npm run dev` and `npm test` therefore need no database.
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

export type EmailEngine = 'noop' | 'haraka';

export type Config = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  INTERNAL_API_KEY: string;
  MAIL_FROM: string;
  EMAIL_ENGINE: EmailEngine;
  HARAKA_LOCAL_HOST: string;
  HARAKA_LOCAL_PORT: number;
  HARAKA_HOSTNAME: string;
  SES_RELAY_HOST?: string;
  SES_RELAY_PORT: number;
  SES_SMTP_USER?: string;
  SES_SMTP_PASS?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const parsed = Env.parse(process.env);

  // INTERNAL_API_KEY: required in production, dev/test fallback otherwise.
  let internalApiKey = parsed.INTERNAL_API_KEY;
  if (!internalApiKey) {
    if (parsed.NODE_ENV === 'production') {
      throw new Error('INTERNAL_API_KEY is required in production');
    }
    internalApiKey = 'dev-internal-key';
  }

  // Resolve the engine: explicit env wins, else haraka in prod / noop elsewhere.
  const engine: EmailEngine = parsed.EMAIL_ENGINE ?? (parsed.NODE_ENV === 'production' ? 'haraka' : 'noop');

  // The Haraka engine cannot relay without its SES smarthost credentials.
  if (engine === 'haraka') {
    const missing = [
      ['SES_RELAY_HOST', parsed.SES_RELAY_HOST],
      ['SES_SMTP_USER', parsed.SES_SMTP_USER],
      ['SES_SMTP_PASS', parsed.SES_SMTP_PASS],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`EMAIL_ENGINE=haraka requires: ${missing.join(', ')}`);
    }
  }

  cached = Object.freeze({ ...parsed, INTERNAL_API_KEY: internalApiKey, EMAIL_ENGINE: engine });
  return cached;
}

/** Test-only escape hatch: forces the next getConfig() call to re-read env. */
export function resetConfigForTests(): void {
  cached = null;
}
