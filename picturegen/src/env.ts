import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Services crash at
 * boot on invalid env, never at request time. Tests set process.env in
 * test-setup before the first getConfig() call.
 *
 * Prism (picturegen) is the platform's ONLY image-generation service — the
 * visual sibling of Echo (audiogen). Two DashScope surfaces are configured:
 *   1. the async text-to-image endpoint (IMAGE_*), and
 *   2. an OpenAI-compatible chat endpoint (JUDGE_*) used by the art-director
 *      judge to craft the illustration prompt.
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4007),

  // Service-to-service auth (/AGENTS.md §1.5) — validates inbound x-internal-api-key.
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars'),

  // Image provider — Qwen-Image on DashScope async text2image. Decision
  // RESOLVED (AGENTS.md): Gemini was discarded (image models quota-0).
  IMAGE_API_BASE: z.url().default('https://dashscope-intl.aliyuncs.com'),
  IMAGE_API_KEY: z.string().min(1, 'IMAGE_API_KEY is required'),
  IMAGE_MODEL: z.string().min(1).default('qwen-image'),
  IMAGE_SIZE: z.string().min(1).default('1024*1024'),

  // Art-director judge — OpenAI-compatible chat (DashScope compatible-mode).
  // JUDGE_API_KEY is optional; it falls back to IMAGE_API_KEY (same account).
  JUDGE_API_BASE: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  JUDGE_API_KEY: z.string().min(1).optional(),
  JUDGE_MODEL: z.string().min(1).default('qwen-plus'),

  // Vault (Supabase self-hosted) — service role, bypasses RLS by design.
  // The `picture_assets` cache table is a service-role-only surface.
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Filebase (Depot) — internal upload service; generated images land here.
  FILEBASE_URL: z.url(),
  FILEBASE_INTERNAL_KEY: z.string().min(16, 'FILEBASE_INTERNAL_KEY must be at least 16 chars'),

  // Overall wall-clock budget for one generation (submit + poll + download).
  PICTUREGEN_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  // Max transport attempts per HTTP call (429/5xx retried with jittered backoff).
  PICTUREGEN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = Object.freeze(Env.parse(process.env));
  return cached;
}

/** Test-only: force re-read of process.env on the next getConfig() call. */
export function resetConfigCache(): void {
  cached = null;
}

/** The judge shares the image account key unless a dedicated JUDGE_API_KEY is set. */
export function judgeApiKey(config: Config): string {
  return config.JUDGE_API_KEY ?? config.IMAGE_API_KEY;
}
