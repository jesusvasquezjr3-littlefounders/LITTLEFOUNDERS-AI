import { z } from 'zod';

/*
 * Env is validated once at boot — the service
 * crashes on invalid config, never at request time.
 *
 * Courier runs one of three engines:
 *   - 'noop'   — logs and reports queued; used in dev/test with no real SMTP.
 *   - 'smtp'   — submits to the SMTP server at SMTP_HOST:SMTP_PORT and nothing
 *                else: the local mail catcher, to read the emails in development.
 *   - 'haraka' — boots the Haraka SMTP engine (email-server/haraka) which
 *                relays outbound to Amazon SES. Requires the SES_* credentials.
 *
 * Default engine is 'haraka' in production, 'noop' in development and test, so `npm run dev`
 * works without SES. INTERNAL_API_KEY has no default in production: a missing key must
 * crash boot, not silently serve unauthenticated.
 */
const Env = z.object({
  // Fails closed: only the exact words 'development' and 'test' relax anything. A missing
  // value, a typo or whatever the platform injects counts as production, so a mistake can
  // never give the service a default key or the engine that sends nothing (noop).
  NODE_ENV: z.string().optional().transform((value): 'development' | 'test' | 'production' => (value === 'development' || value === 'test' ? value : 'production')),
  PORT: z.coerce.number().int().positive().default(4005),
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars').optional(),

  // Envelope/header From of every email.
  MAIL_FROM: z.string().min(3).default('LittleFounders <noreply@littlefounders.ai>'),

  // Which engine to boot. Left optional; resolved per NODE_ENV below.
  EMAIL_ENGINE: z.enum(['noop', 'smtp', 'haraka']).optional(),

  // The site's own address: the emails take their images and typeface from it and link to it.
  FRONTEND_URL: z.url().default('https://littlefounders.ai'),

  // Engine 'smtp' only: the local mail catcher (database/scripts/local-stack.sh starts one).
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),

  // Haraka: where the co-located HTTP adapter submits mail (the localhost listener of
  // haraka/config/smtp.ini, the only one there is), and the HELO/hostname Haraka announces.
  HARAKA_LOCAL_HOST: z.string().min(1).default('127.0.0.1'),
  HARAKA_LOCAL_PORT: z.coerce.number().int().positive().default(2525),
  HARAKA_HOSTNAME: z.string().min(1).default('email-server.railway.internal'),

  // Amazon SES SMTP smarthost — the last-mile relay. Required when engine=haraka.
  // SES_SMTP_USER/PASS are region-scoped SES SMTP credentials, NOT AWS keys.
  SES_RELAY_HOST: z.string().min(1).optional(),
  SES_RELAY_PORT: z.coerce.number().int().positive().default(587),
  SES_SMTP_USER: z.string().min(1).optional(),
  SES_SMTP_PASS: z.string().min(1).optional(),

  // Vault (the email_logs table) — the durable delivery history. OPTIONAL on
  // purpose: without them Courier still sends mail and still serves
  // /api/v1/logs, just from the in-process ring buffer that dies on restart.
  // `npm run dev` therefore needs no database.
  //
  // MAIL_SERVICE_KEY is this service's own key: it names the database role `mail_service`, which
  // can add, read and mark lines of the history and nothing else. The service key must NOT be
  // given to this service: it runs every backend function for any account, and it stays in Core.
  SUPABASE_URL: z.url().optional(),
  MAIL_SERVICE_KEY: z.string().min(20).optional(),
});

export type EmailEngine = 'noop' | 'smtp' | 'haraka';

export type Config = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  INTERNAL_API_KEY: string;
  MAIL_FROM: string;
  EMAIL_ENGINE: EmailEngine;
  FRONTEND_URL: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  HARAKA_LOCAL_HOST: string;
  HARAKA_LOCAL_PORT: number;
  HARAKA_HOSTNAME: string;
  SES_RELAY_HOST?: string;
  SES_RELAY_PORT: number;
  SES_SMTP_USER?: string;
  SES_SMTP_PASS?: string;
  SUPABASE_URL?: string;
  MAIL_SERVICE_KEY?: string;
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

  // The service key does not belong here. It is not read; say so, so it gets removed.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[email-server] SUPABASE_SERVICE_ROLE_KEY is set and is not used: remove it from this service (it uses MAIL_SERVICE_KEY)');
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
