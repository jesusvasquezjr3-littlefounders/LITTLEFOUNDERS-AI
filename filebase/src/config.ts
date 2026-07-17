import { z } from 'zod';

/*
 * Env is validated once at boot (agent/core/CONVENTIONS.md) — the service
 * crashes on invalid config, never at request time. Tests import getConfig()
 * after test-setup.ts has set process.env.
 *
 * INTERNAL_API_KEY has no default in production: a missing key must crash
 * boot, not silently serve unauthenticated. In development/test it falls
 * back to a fixed placeholder so `npm run dev`/`npm test` work without a
 * `.env` file.
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4006),
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars').optional(),
  // Storage root — a Railway volume mount in prod, a local dir in dev/test.
  FILEBASE_ROOT: z.string().min(1).default('./data'),
  // Max upload size in bytes (default 25MB).
  FILEBASE_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  // Optional absolute base URL for building public download URLs (e.g. the
  // Railway public domain). If unset, URLs are returned as root-relative
  // paths and the caller prefixes its own base.
  PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Config = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  INTERNAL_API_KEY: string;
  FILEBASE_ROOT: string;
  FILEBASE_MAX_BYTES: number;
  PUBLIC_BASE_URL?: string;
}>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) {
    const parsed = Env.parse(process.env);
    let internalApiKey = parsed.INTERNAL_API_KEY;
    if (!internalApiKey) {
      if (parsed.NODE_ENV === 'production') {
        throw new Error('INTERNAL_API_KEY is required in production');
      }
      internalApiKey = 'dev-internal-key';
    }
    cached = Object.freeze({ ...parsed, INTERNAL_API_KEY: internalApiKey });
  }
  return cached;
}

/** Test-only escape hatch: forces the next getConfig() call to re-read env. */
export function resetConfigForTests(): void {
  cached = null;
}
