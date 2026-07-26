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
  /*
   * Budget kill switches. These are FLOORS, not the whole story: run.ts scales the
   * effective cap with the amount of work enumerated (see `effectiveBudget`), because
   * one absolute number cannot serve both a 3-slot smoke test and a 1472-lesson
   * course. Measured on a real run: ~104k tokens and ~$0.07 per published lesson
   * INCLUDING retries, so the 5M/$50 floors below cover ~48 lessons — a mass-
   * generation audit found the old absolute-only cap killed a 1312-lesson run at
   * lesson ~82, reported from five independent angles as run-fatal.
   */
  FORGE_MAX_TOKENS_PER_RUN: z.coerce.number().int().positive().default(5_000_000),
  FORGE_MAX_USD_PER_RUN: z.coerce.number().positive().default(50),
  /*
   * Request timeouts. A fetch with NO timeout is a stall waiting to happen: a
   * half-open connection parks a pool worker forever, and with FORGE_CONCURRENCY
   * workers a long run can lose them all and hang indefinitely with no output.
   * Prism generates images (slow by nature), Vault writes are fast.
   */
  FORGE_PICTUREGEN_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  FORGE_VAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** Per-LLM-call abort ceiling. Bump per-run for known-heavy lessons (a long ordering write exceeded 120s of reasoning on every attempt — measured 2026-07-26). */
  FORGE_CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Per-slot allowance used to scale the caps above with the enumerated work. */
  FORGE_MAX_TOKENS_PER_SLOT: z.coerce.number().int().positive().default(150_000),
  FORGE_MAX_USD_PER_SLOT: z.coerce.number().positive().default(0.25),
  FORGE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  // Outer per-slot attempts: on a judge rejection or write exhaustion the slot
  // is reset and regenerated FROM SCRATCH (a fresh draw converges far better
  // than revising a bad one — measured on the 2026-07-23 QA regen). Mass
  // generation needs this to reach ~100% published without operator babysitting.
  FORGE_SLOT_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),

  // ---- cost table overrides (USD per 1K tokens / per image), env-overridable ----
  // Defaults verified against the OFFICIAL price pages on 2026-07-25 for the
  // models we actually call. DeepSeek: deepseek-v4-pro (DEEPSEEK_MODEL default)
  // = $0.435/1M input miss, $0.003625/1M input CACHE HIT, $0.87/1M output.
  // Note: the legacy names deepseek-chat/deepseek-reasoner were deprecated
  // 2026-07-24 and now alias deepseek-v4-flash modes — the previous defaults
  // here were that older model's prices. Cache-hit tokens are reported by the
  // provider automatically (prompt_cache_hit_tokens) and priced separately —
  // without the CACHED rate the ledger overstates real spend ~120x on hits.
  COST_DEEPSEEK_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.000435),
  COST_DEEPSEEK_INPUT_CACHED_PER_1K: z.coerce.number().nonnegative().default(0.0000036),
  COST_DEEPSEEK_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.00087),
  // Qwen (DashScope compatible-mode): implicit context cache bills hits at 20%
  // of the input price (usage.prompt_tokens_details.cached_tokens).
  COST_QWEN_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.0016),
  COST_QWEN_INPUT_CACHED_PER_1K: z.coerce.number().nonnegative().default(0.00032),
  COST_QWEN_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.0064),
  /*
   * Per IMAGE actually generated (a Prism cache hit costs nothing and is not
   * billed here). Image spend used to sit entirely outside the ledger and outside
   * every kill switch, so a mass run could bill tens of thousands of paid
   * qwen-image generations with nothing metering or capping them — the single
   * largest uncapped cost in the pipeline. Default = the official Model Studio
   * list price for qwen-image ($0.035/image, verified 2026-07-25; the earlier
   * 0.02 default UNDERSTATED image spend by 43%), env-overridable like the
   * token costs.
   */
  COST_QWEN_IMAGE_PER_IMAGE: z.coerce.number().nonnegative().default(0.035),
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
