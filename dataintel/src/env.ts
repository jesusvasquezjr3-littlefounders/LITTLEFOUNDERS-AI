import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4008),

  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars'),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  DUCKDB_PATH: z.string().min(1).default('./duckdb/dataintel.db'),

  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = Object.freeze(Env.parse(process.env));
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
