import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Tests set
 * process.env in test-setup before the first getConfig() call.
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).catch('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  // Supabase self-hosted stack (local: Kong on :8000 — database/README.md).
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(16),

  // Service-to-service (/AGENTS.md §1.5).
  INTERNAL_API_KEY: z.string().min(16),
  PARENT_ID_CHECK_URL: z.url().default('http://localhost:4004'),
  EMAIL_SERVER_URL: z.url().optional(),

  // dataintel analytics proxy
  DATAINTEL_URL: z.string().url().default('http://localhost:4008'),
  DATAINTEL_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),
  DATAINTEL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Depot (filebase). Core only needs it for the Tutor retention sweep, which
  // must delete the tutor's stored audio as well as the database rows — a
  // cascade reaches the rows and nothing reaches the blobs.
  FILEBASE_URL: z.string().url().default('http://localhost:4006'),
  FILEBASE_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),

  // Oracle — the AI Tutor runtime (/ORACLE.md).
  //
  // Two URLs, not one, and the distinction matters. ORACLE_URL is the private
  // address Core uses for preflight and is never seen by a browser.
  // ORACLE_PUBLIC_URL is what the BROWSER opens a websocket against — the
  // fourth documented §1.5 exception — and in production those are different
  // hosts (Railway private networking vs a public domain). Defaulting the
  // public one to localhost keeps local development working with one service.
  ORACLE_URL: z.string().url().default('http://localhost:4009'),
  ORACLE_PUBLIC_URL: z.string().url().default('http://localhost:4009'),
  ORACLE_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),
  ORACLE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),

  // Signs the single-use, session-scoped token the browser carries to Oracle
  // (/ORACLE.md §3.2). MUST differ from INTERNAL_API_KEY: one authenticates a
  // SERVICE, this one authenticates one browser socket, and sharing them would
  // let a leaked session token call the internal API.
  TUTOR_SESSION_SECRET: z.string().min(32).default('replace-me-with-a-64-char-random-string-0000'),

  // Fraction of live-generated tutor segments queued for post-hoc human
  // review (/ORACLE.md §7.3). Zero is a valid deployment choice and a bad one.
  TUTOR_LIVE_REVIEW_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.15),

  // The Tutor v3 pedagogical brain (KC graph + BKT + FSRS + session plan,
  // migration 0052). On by default WITH graceful degradation: while 0052 is
  // unapplied or unseeded every read comes back null/empty, the session
  // context simply omits the pedagogy fields, and Oracle behaves exactly as
  // v2. The switch exists to turn the brain off deliberately, not to make
  // deploys safe — the degradation does that.
  TUTOR_V3_BRAIN: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0' && v !== 'off'),

  // Redis para Rate Limiting distribuido
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
});

export type Config = Readonly<Omit<z.infer<typeof Env>, 'EMAIL_SERVER_URL'> & { EMAIL_SERVER_URL: string }>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) {
    const parsed = Env.parse(process.env);
    const emailServerUrl = parsed.EMAIL_SERVER_URL
      ?? (parsed.NODE_ENV === 'production' ? 'http://email-server.railway.internal:4005' : 'http://localhost:4005');
    cached = Object.freeze({ ...parsed, EMAIL_SERVER_URL: emailServerUrl });
  }
  return cached;
}

/** Test-only escape hatch: force the next request to re-read environment variables. */
export function resetConfigForTests(): void {
  cached = null;
}
