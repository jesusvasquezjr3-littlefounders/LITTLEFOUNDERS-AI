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
 *
 * TWO RULES THIS FILE ENFORCES, both learned the hard way:
 *
 * 1. A BLANK value is an UNSET value (see `readEnv`). Railway/Vercel/Docker all
 *    hand a cleared variable to the process as `""`, not as an absent key, and
 *    `z.url().optional()` / `z.coerce.number()` reject `""` — so "operator
 *    cleared PICTUREGEN_URL" used to crash the CLI with a raw ZodError before
 *    `--dry-run` could even run. Clearing a variable must be as safe as never
 *    setting it.
 *
 * 2. CREDENTIAL SHAPE IS NEVER A BOOT-TIME FAILURE. Length rules on credentials
 *    live at the point of USE (`require*Keys()` for the outbound keys,
 *    `MIN_INTERNAL_KEY_LENGTH` below for the inbound one), not in the schema.
 *    gamegen is already deployed with an INTERNAL_API_KEY that predates the
 *    length rule; if the schema rejected it, `getConfig()` would throw at import
 *    time in index.ts, the listener would never open, /health would never answer
 *    and the platform would restart-loop the container forever — §1.14's exact
 *    failure class ("liveness must not depend on optional infrastructure"). The
 *    protection is not dropped, it is MOVED: a too-short inbound key is treated
 *    as UNSET, which makes app.ts's fail-closed branch answer 401 to every
 *    /api/v1 request. A weak key therefore authorizes strictly LESS than before
 *    (before: it either killed the service or, at 16+ chars, was accepted), and
 *    the service stays alive to say so.
 */

/** Listener port when nothing valid is configured — the single source of truth. */
export const DEFAULT_PORT = 4003;

/**
 * Minimum credential lengths. These are TRUNCATION/TYPO guards, not entropy
 * proofs — a copy-paste that lost half the key is the failure they catch. They
 * are enforced where the credential is USED, never at parse time (see rule 2).
 */
export const MIN_INTERNAL_KEY_LENGTH = 16;
const MIN_DEEPSEEK_KEY_LENGTH = 8;
const MIN_QWEN_KEY_LENGTH = 8;
const MIN_PICTUREGEN_KEY_LENGTH = 16;
const MIN_SUPABASE_KEY_LENGTH = 8;

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),

  // ---- Service-to-service auth (/AGENTS.md §1.5) ----
  // Validates the inbound x-internal-api-key on the /api/v1 prefix. Optional so
  // /health and the CLI work without it; app.ts FAILS CLOSED when it is unset
  // (an absent key must never make an absent header a match). The length rule
  // is applied in getConfig() as a downgrade-to-unset, NOT here as a rejection —
  // see rule 2 in the header comment.
  INTERNAL_API_KEY: z.string().optional(),

  // ---- Author provider (DeepSeek) — `plan`, `author`, `localize` ----
  // Length checked by requireGenerationKeys(), right before money is spent.
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-pro'),

  // ---- Judge provider (Qwen) — deliberately DECORRELATED from the author
  // (gamegen/AGENTS.md: rubric = concept_fit, fun_agency, clarity, kid_safety,
  // difficulty_fairness; kid_safety is a hard floor, not an average input).
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  QWEN_JUDGE_MODEL: z.string().min(1).default('qwen3-max'),

  // ---- Prism (picturegen/, port 4007) — the ONLY image source, `illustrate`.
  // Unset = the stage is not configured; the run must refuse rather than
  // silently ship art-less sprites (requireIllustrationKeys below).
  PICTUREGEN_URL: z.url().optional(),
  PICTUREGEN_INTERNAL_KEY: z.string().optional(),

  // ---- Vault writes (`publish` — service role, bypasses RLS by design;
  // game_documents has RLS enabled with ZERO policies because `validation` is
  // server-only, so the service role is the only reader/writer) ----
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

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

/**
 * A configuration problem stated for a HUMAN OPERATOR: which variables are
 * wrong, what is wrong with each, and where to fix them. Callers print
 * `err.message` and exit — never a stack trace, which points at this file
 * instead of at the variable the operator has to change.
 */
export class ConfigError extends Error {
  /** The offending variable names, for callers that want them structurally. */
  readonly variables: readonly string[];

  constructor(message: string, variables: readonly string[]) {
    super(message);
    this.name = 'ConfigError';
    this.variables = variables;
  }
}

/**
 * Reads the environment with BLANK == UNSET.
 *
 * Every deploy target we use (Railway, Docker, `--env-file`) delivers a cleared
 * variable as the empty string, and `.optional()` only admits `undefined`. So
 * `PICTUREGEN_URL=` used to be a hard parse failure while deleting the variable
 * entirely was fine — an operator-hostile distinction with no upside. A value
 * that is empty or only whitespace is dropped here so it takes the schema's
 * default (or stays optional) exactly as an absent variable would.
 *
 * Non-blank values are passed through VERBATIM: trimming a credential would
 * silently change a secret, which is a different bug.
 */
function readEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value.trim() === '') continue;
    out[key] = value;
  }
  return out;
}

function configErrorFromZod(error: z.ZodError): ConfigError {
  const variables: string[] = [];
  const lines: string[] = [];
  for (const issue of error.issues) {
    const name = issue.path.map(String).join('.') || '(root)';
    if (!variables.includes(name)) variables.push(name);
    lines.push(`  - ${name}: ${issue.message}`);
  }
  return new ConfigError(
    [
      `gamegen: invalid configuration — ${variables.length} variable(s) rejected:`,
      ...lines,
      '',
      'Fix them in gamegen/.env locally, or in the service variables on Railway.',
      'An EMPTY value counts as UNSET (so clearing a variable is always safe); a WRONG value does not.',
      'gamegen/.env.example documents the expected shape of every variable.',
    ].join('\n'),
    variables,
  );
}

let cached: Config | null = null;

/**
 * Parses (once) and FREEZES the config. Throws `ConfigError` — never a raw
 * ZodError — so every caller can print something an operator can act on.
 */
export function getConfig(): Config {
  if (cached) return cached;

  const parsed = Env.safeParse(readEnv(process.env));
  if (!parsed.success) throw configErrorFromZod(parsed.error);
  const config = parsed.data;

  /*
   * A too-short inbound key is DOWNGRADED TO UNSET rather than rejected. It is
   * the one credential the HTTP service itself reads, so rejecting it at parse
   * time would take /health down with it (§1.14). Unset is the fail-closed
   * state: app.ts answers 401 to every /api/v1 request when there is no key, so
   * a truncated key can never authorize anything — which is the entire point of
   * the length rule. Loud, because a silent downgrade would look like a working
   * deploy that quietly rejects every internal caller.
   */
  const inbound = config.INTERNAL_API_KEY;
  if (inbound !== undefined && inbound.length < MIN_INTERNAL_KEY_LENGTH) {
    console.error(
      `[gamegen] INTERNAL_API_KEY is set but shorter than ${MIN_INTERNAL_KEY_LENGTH} characters — it looks truncated, ` +
        `so it is being treated as UNSET. /health keeps answering; /api/v1 will refuse EVERY request with 401 ` +
        `until a full-length key is configured.`,
    );
    config.INTERNAL_API_KEY = undefined;
  }

  cached = Object.freeze(config);
  return cached;
}

/** Test-only escape hatch: forces the next getConfig() to re-read process.env. */
export function resetConfigCache(): void {
  cached = null;
}

/**
 * The listener port, resolved so that it CANNOT throw (§1.14).
 *
 * index.ts must open its socket even when the configuration is broken: a
 * process that dies before `listen()` fails the platform healthcheck, gets
 * restarted, dies again, and never gets to tell anyone why. So a config failure
 * is printed in full and the service boots DEGRADED instead — /health answers,
 * and /api/v1 stays closed because the guard cannot obtain a key.
 */
export function getBootPort(): number {
  try {
    return getConfig().PORT;
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : err);
    // PORT may itself be the broken variable; fall back to the platform's raw
    // value when it is usable, so the healthcheck still finds us.
    const raw = Number(process.env.PORT);
    const port = Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_PORT;
    console.error(
      `[gamegen] booting DEGRADED on :${port} — /health will answer so the platform does not restart-loop us, ` +
        `but /api/v1 stays closed until the configuration above is fixed.`,
    );
    return port;
  }
}

interface CredentialCheck {
  name: string;
  value: string | undefined;
  /** 1 = presence only (URLs are shape-checked by the schema). */
  min: number;
}

/**
 * Builds the one refusal message an operator needs: every missing/malformed
 * variable for this stage at once, not the first one and then another run.
 */
function requireCredentials(stage: string, checks: readonly CredentialCheck[]): void {
  const variables: string[] = [];
  const problems: string[] = [];
  for (const check of checks) {
    if (check.value === undefined) {
      variables.push(check.name);
      problems.push(`  - ${check.name}: not set`);
    } else if (check.value.length < check.min) {
      variables.push(check.name);
      problems.push(`  - ${check.name}: set but shorter than ${check.min} characters — it looks truncated`);
    }
  }
  if (problems.length === 0) return;
  throw new ConfigError(
    [
      `gamegen: cannot run the ${stage} stage — ${variables.length} variable(s) missing or malformed:`,
      ...problems,
      '',
      'Set them in gamegen/.env — never committed (/AGENTS.md §1.10).',
      '`npm run generate -- --dry-run` needs none of them.',
    ].join('\n'),
    variables,
  );
}

/**
 * Lazy gate for the paid stages (`plan`, `author`, `judge`, `localize`).
 * NEVER called at import time, at /health, or by any test/CI path — only by the
 * CLI right before it would spend money, and skipped entirely for `--dry-run`
 * (which is why a keyless dry-run test can exist at all). This is also where the
 * outbound keys' length rules live, so a truncated key is caught before the
 * provider round-trip instead of taking the whole service down at boot.
 */
export function requireGenerationKeys(): void {
  const c = getConfig();
  requireCredentials('generation', [
    { name: 'DEEPSEEK_API_KEY', value: c.DEEPSEEK_API_KEY, min: MIN_DEEPSEEK_KEY_LENGTH },
    { name: 'QWEN_API_KEY', value: c.QWEN_API_KEY, min: MIN_QWEN_KEY_LENGTH },
  ]);
}

/**
 * `illustrate` talks to Prism. Checked lazily for the same reason as above.
 * Missing config is a REFUSAL, not a skip: an un-illustrated game manifest is
 * a different (worse) product, not the same one minus a nicety.
 */
export function requireIllustrationKeys(): void {
  const c = getConfig();
  requireCredentials('illustration', [
    { name: 'PICTUREGEN_URL', value: c.PICTUREGEN_URL, min: 1 },
    { name: 'PICTUREGEN_INTERNAL_KEY', value: c.PICTUREGEN_INTERNAL_KEY, min: MIN_PICTUREGEN_KEY_LENGTH },
  ]);
}

/** `publish` needs Vault write access (service role). Same lazy reasoning. */
export function requirePublishKeys(): void {
  const c = getConfig();
  requireCredentials('publish', [
    { name: 'SUPABASE_URL', value: c.SUPABASE_URL, min: 1 },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: c.SUPABASE_SERVICE_ROLE_KEY, min: MIN_SUPABASE_KEY_LENGTH },
  ]);
}
