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
