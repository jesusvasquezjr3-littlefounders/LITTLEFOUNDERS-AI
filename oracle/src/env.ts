import { z } from 'zod';

/*
 * Oracle's configuration. Everything the Tutor runtime needs, validated at the
 * edge (/AGENTS.md §1.6) so a missing provider key is a startup failure with a
 * name rather than a 500 in front of a child three turns into a session.
 *
 * The voice and model provider keys are OPTIONAL on purpose. Oracle must boot,
 * serve /health and run a text-only session without them: §1.14's rule is that
 * liveness never depends on optional infrastructure, and a speech provider is
 * the most optional thing here — losing it costs the voice, not the lesson.
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4009),
  NODE_ENV: z.string().default('development'),

  /** Service-to-service key for Oracle's own internal HTTP surface. */
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 chars'),

  /**
   * Shared secret Core signs live-session tokens with (/ORACLE.md §3.2).
   * Distinct from INTERNAL_API_KEY: one authenticates a SERVICE, this one
   * authenticates a single browser socket for a single session. Reusing one
   * secret for both would mean a leaked session token could call the internal
   * API.
   */
  TUTOR_SESSION_SECRET: z.string().min(32, 'TUTOR_SESSION_SECRET must be at least 32 chars'),

  /** Core, for grading, progress writes and transcript persistence. */
  CORE_URL: z.url(),
  CORE_INTERNAL_KEY: z.string().min(16),

  /** Depot, for the tutor's synthesized audio. */
  DEPOT_URL: z.url().optional(),
  DEPOT_INTERNAL_KEY: z.string().min(16).optional(),

  /** Forge, for tier-3 live segment generation (/ORACLE.md §7.3). */
  COURSEGEN_URL: z.url().optional(),
  COURSEGEN_INTERNAL_KEY: z.string().min(16).optional(),

  /**
   * The pedagogical model. OpenAI-compatible transport (DeepSeek today), with
   * Qwen as the independent judge — the same split Forge uses, for the same
   * reason: an author that grades its own work grades it generously.
   */
  MODEL_API_BASE: z.url().default('https://api.deepseek.com'),
  MODEL_API_KEY: z.string().min(8).optional(),
  MODEL_NAME: z.string().min(1).default('deepseek-chat'),
  JUDGE_API_BASE: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  JUDGE_API_KEY: z.string().min(8).optional(),
  JUDGE_MODEL_NAME: z.string().min(1).default('qwen-plus'),

  /**
   * Real-time voice. `provider: none` is a first-class, tested mode — it is
   * what a deployment without an Inworld contract runs, and what every test
   * runs (/ORACLE.md §14: speech is an enhancement, the lesson is the product).
   */
  VOICE_PROVIDER: z.enum(['inworld', 'none']).default('none'),
  INWORLD_API_BASE: z.url().default('https://api.inworld.ai'),
  INWORLD_API_KEY: z.string().min(8).optional(),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /** Session budget (/ORACLE.md §0 assumption 5, §9.5). */
  SESSION_SOFT_BUDGET_MS: z.coerce.number().int().positive().default(15 * 60_000),
  SESSION_HARD_BUDGET_MS: z.coerce.number().int().positive().default(25 * 60_000),
  SESSION_MAX_TURNS: z.coerce.number().int().positive().default(120),
  /** Per-turn learner input cap, in characters (§5 bounds). */
  TURN_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(600),

  /** Upstream call timeouts. A tutor that hangs is worse than one that fails. */
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  VOICE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CORE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),

  /**
   * Fraction of live-generated segments queued for post-hoc human review
   * (/ORACLE.md §7.3). Zero is a valid deployment choice and a bad one; it is
   * not the default.
   */
  LIVE_REVIEW_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.15),
});

export type Config = Readonly<z.infer<typeof Env>>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) {
    const parsed = Env.safeParse(process.env);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`[oracle] invalid configuration — ${detail}`);
    }
    if (parsed.data.SESSION_HARD_BUDGET_MS <= parsed.data.SESSION_SOFT_BUDGET_MS) {
      // A hard stop at or before the soft close means the tutor never gets to
      // wrap up: the session dies mid-sentence every single time, which is the
      // exact failure §9.5 exists to prevent.
      throw new Error('[oracle] SESSION_HARD_BUDGET_MS must exceed SESSION_SOFT_BUDGET_MS');
    }
    cached = Object.freeze(parsed.data);
  }
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}

export const isTestOrDev =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
