import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md), then FROZEN.
 * Modeled on coursegen/src/env.ts — Arcade is Forge's twin and inherits its
 * budget/concurrency/cost posture verbatim (gamegen/AGENTS.md "Read before
 * touching").
 *
 * EVERY field here is optional or defaulted ON PURPOSE. `Env.parse({})` must
 * succeed, because:
 *   - the Express /health service must answer with zero credentials
 *     (/AGENTS.md §1.14: liveness must not depend on optional infrastructure),
 *   - `npm run generate -- --dry-run` must spend nothing AND run keyless
 *     (/GAME_ENGINE.md §9), and
 *   - offline commands (catalog:check, contract:check, vitest) never touch a
 *     paid API.
 * The lazy `require*Keys()` gates at the bottom are what actually refuse to
 * proceed, called right before money is spent — never at import time.
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4003),

  // ---- Service-to-service auth (/AGENTS.md §1.5) ----
  // Validates the inbound x-internal-api-key on the /api/v1 prefix. Optional so
  // /health and the CLI work without it; app.ts FAILS CLOSED when it is unset
  // (an absent key must never make an absent header a match).
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars').optional(),

  // ---- Author provider (DeepSeek) — `plan`, `author`, `localize` ----
  DEEPSEEK_API_KEY: z.string().min(8).optional(),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-pro'),

  // ---- Judge provider (Qwen) — deliberately DECORRELATED from the author
  // (gamegen/AGENTS.md: rubric = concept_fit, fun_agency, clarity, kid_safety,
  // difficulty_fairness; kid_safety is a hard floor, not an average input).
  QWEN_API_KEY: z.string().min(8).optional(),
  QWEN_BASE_URL: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  QWEN_JUDGE_MODEL: z.string().min(1).default('qwen3-max'),

  // ---- Prism (picturegen/, port 4007) — the ONLY image source, `illustrate`.
  // Unset = the stage is not configured; the run must refuse rather than
  // silently ship art-less sprites (requireIllustrationKeys below).
  PICTUREGEN_URL: z.url().optional(),
  PICTUREGEN_INTERNAL_KEY: z.string().min(16).optional(),

  // ---- Vault writes (`publish` — service role, bypasses RLS by design;
  // game_documents has RLS enabled with ZERO policies because `validation` is
  // server-only, so the service role is the only reader/writer) ----
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(8).optional(),

  // ---- Run budgets / concurrency (twin of coursegen's FORGE_* set) ----
  /*
   * Budget kill switches. The ledger calls checkBudget() before EVERY paid call
   * and throws BudgetExceededError, which must PROPAGATE out of every per-item
   * catch — a kill switch only exists if the error escapes (gamegen/AGENTS.md;
   * Forge's illustrateSegments swallowed it per target and kept paying past the
   * cap). Arcade's `illustrate` loops over sprite slots: identical shape,
   * identical trap.
   */
  ARCADE_MAX_TOKENS_PER_RUN: z.coerce.number().int().positive().default(5_000_000),
  ARCADE_MAX_USD_PER_RUN: z.coerce.number().positive().default(50),
  /** Per-slot allowance used to scale the run caps above with the enumerated work. */
  ARCADE_MAX_TOKENS_PER_SLOT: z.coerce.number().int().positive().default(150_000),
  ARCADE_MAX_USD_PER_SLOT: z.coerce.number().positive().default(0.25),
  ARCADE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /*
   * Outer per-slot attempts: on a judge rejection or author exhaustion the slot
   * is reset and regenerated FROM SCRATCH (a fresh draw converges better than
   * revising a bad one). Mass generation needs this to finish unattended.
   */
  ARCADE_SLOT_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  /*
   * Request timeouts. A fetch with NO timeout is a stall waiting to happen: a
   * half-open connection parks a pool worker forever, and with ARCADE_CONCURRENCY
   * workers a long run can lose them all and hang with no output. Prism
   * generates images (slow by nature), Vault writes are fast.
   */
  ARCADE_CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ARCADE_PICTUREGEN_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  ARCADE_VAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // ---- Cost table overrides (USD per 1K tokens / per image), env-overridable.
  // Values copied VERBATIM from coursegen/src/env.ts, where they were verified
  // against the official price pages on 2026-07-25 for the models we call.
  // Do not "round" these — the ledger's caps are only as honest as this table.
  //
  // DeepSeek deepseek-v4-pro: $0.435/1M input miss, $0.003625/1M input CACHE
  // HIT, $0.87/1M output. Cache-hit tokens are reported by the provider
  // (prompt_cache_hit_tokens) and priced separately — without the CACHED rate
  // the ledger overstates real spend ~120x on hits.
  COST_DEEPSEEK_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.000435),
  COST_DEEPSEEK_INPUT_CACHED_PER_1K: z.coerce.number().nonnegative().default(0.0000036),
  COST_DEEPSEEK_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.00087),
  // Qwen (DashScope compatible-mode): the implicit context cache bills hits at
  // 20% of the input price (usage.prompt_tokens_details.cached_tokens).
  COST_QWEN_INPUT_PER_1K: z.coerce.number().nonnegative().default(0.0016),
  COST_QWEN_INPUT_CACHED_PER_1K: z.coerce.number().nonnegative().default(0.00032),
  COST_QWEN_OUTPUT_PER_1K: z.coerce.number().nonnegative().default(0.0064),
  /*
   * Per IMAGE actually generated (a Prism cache hit costs nothing and is not
   * billed here). Image spend used to sit entirely outside Forge's ledger and
   * outside every kill switch — its single largest uncapped cost. Default =
   * the official Model Studio list price for qwen-image ($0.035/image).
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

function missingEnvError(stage: string, missing: readonly string[]): Error {
  return new Error(
    `Missing required env for ${stage}: ${missing.join(', ')} ` +
      `(set them in gamegen/.env — never committed, /AGENTS.md §1.10)`,
  );
}

/**
 * Lazy gate for the paid stages (`plan`, `author`, `judge`, `localize`).
 * NEVER called at import time, at /health, or by any test/CI path — only by the
 * CLI right before it would spend money, and skipped entirely for `--dry-run`
 * (which is why a keyless dry-run test can exist at all).
 */
export function requireGenerationKeys(): void {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
  if (!c.QWEN_API_KEY) missing.push('QWEN_API_KEY');
  if (missing.length > 0) throw missingEnvError('generation', missing);
}

/**
 * `illustrate` talks to Prism. Checked lazily for the same reason as above.
 * Missing config is a REFUSAL, not a skip: an un-illustrated game manifest is
 * a different (worse) product, not the same one minus a nicety.
 */
export function requireIllustrationKeys(): void {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.PICTUREGEN_URL) missing.push('PICTUREGEN_URL');
  if (!c.PICTUREGEN_INTERNAL_KEY) missing.push('PICTUREGEN_INTERNAL_KEY');
  if (missing.length > 0) throw missingEnvError('illustration', missing);
}

/** `publish` needs Vault write access (service role). Same lazy reasoning. */
export function requirePublishKeys(): void {
  const c = getConfig();
  const missing: string[] = [];
  if (!c.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!c.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) throw missingEnvError('publish', missing);
}
