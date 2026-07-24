import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Provider keys
 * (DEEPSEEK_API_KEY, QWEN_API_KEY) are OPTIONAL here on purpose — the
 * Express /health service and all offline commands (catalog:check,
 * contract:check, tests) must never require paid-API keys to run.
 * `requireGenerationKeys()` is the lazy gate the CLI calls right before it
 * would spend money (COURSE_ENGINE.md §4/§5).
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4001),

  // ---- Author / judge providers ----
  DEEPSEEK_API_KEY: z.string().min(8).optional(),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-pro'),

  QWEN_API_KEY: z.string().min(8).optional(),
  QWEN_BASE_URL: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  QWEN_JUDGE_MODEL: z.string().min(1).default('qwen3-max'),

  // ---- Images (optional — module returns NOT_CONFIGURED when key is absent) ----
  // Prism (picturegen/) — the only image source. Unset = images not
  // configured (illustrate stage skips cleanly). Gemini was DISCARDED
  // 2026-07-23: every Google image model returned quota-0 on the available key.
  PICTUREGEN_URL: z.url().optional(),
  PICTUREGEN_INTERNAL_KEY: z.string().min(16).optional(),

  // ---- Vault writes (publish stage) ----
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(8).optional(),

  // ---- filebase (lesson-images upload) ----
  FILEBASE_URL: z.url().optional(),
  FILEBASE_INTERNAL_KEY: z.string().min(8).optional(),

  // ---- service-to-service (unused by the pipeline today, kept for the /health service) ----
  INTERNAL_API_KEY: z.string().min(8).optional(),
  BACKEND_INTERNAL_URL: z.url().default('http://localhost:4000'),

  // ---- run budgets / concurrency (COURSE_ENGINE.md §4) ----
  FORGE_MAX_TOKENS_PER_RUN: z.coerce.number().int().positive().default(5_000_000),
  FORGE_MAX_USD_PER_RUN: z.coerce.number().positive().default(50),
  FORGE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  // Outer per-slot attempts: on a judge rejection or write exhaustion the slot
  // is reset and regenerated FROM SCRATCH (a fresh draw converges far better
  // than revising a bad one — measured on the 2026-07-23 QA regen). Mass
  // generation needs this to reach ~100% published without operator babysitting.
  FORGE_SLOT_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),

  // ---- cost table overrides (USD per 1K tokens / per image), env-overridable ----
  COST_DEEPSEEK_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.00027),
  COST_DEEPSEEK_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.0011),
  COST_QWEN_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.0016),
  COST_QWEN_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.0064),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = Object.freeze(Env.parse(process.env));
  return cached;
}

/** Test-only escape hatch: forces the next getConfig() to re-read process.env. */
export function resetConfigCache(): void {
  cached = null;
}

/**
 * Lazy gate for anything that actually spends money. Never called at import
 * time, at /health, or by any test/CI path — only by `cli.ts` right before
 * the `plan`/`write`/`review`/`localize`/`images` stages run for real.
 */
export function requireGenerationKeys(): void {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
  if (!c.QWEN_API_KEY) missing.push('QWEN_API_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Missing required env for generation: ${missing.join(', ')} (set them in coursegen/.env — never committed, §1.10)`,
    );
  }
}

/** Publish stage needs Vault write access. Checked lazily, same reasoning as above. */
export function requirePublishKeys(): void {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!c.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing required env for publish: ${missing.join(', ')}`);
  }
}
