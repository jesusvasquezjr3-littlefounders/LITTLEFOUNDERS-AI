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
  /*
   * THE DEFAULTS ARE FORGE'S, and both halves of that matter.
   *
   * The base URL MUST carry /v1. We build the endpoint by hand —
   * `${MODEL_API_BASE}/chat/completions` — rather than through an SDK that
   * appends the version for us, so a base of https://api.deepseek.com yields
   * https://api.deepseek.com/chat/completions and 404s on every single turn.
   * That shipped: the tutor came up healthy in production, `/health` reported
   * `model: up`, and every learner got "my thoughts got tangled" instead of a
   * lesson. `coursegen/src/env.ts` has always had the /v1 here.
   *
   * And `deepseek-chat` is a DEPRECATED alias — retired 2026-07-24, now
   * pointing at a v4-flash mode rather than the model Forge actually writes
   * courses with. Two services on one account should not quietly be talking to
   * two different models; a tutor explaining a topic worse than the lesson
   * that taught it is the kind of difference nobody would think to look for.
   *
   * Keep these in step with coursegen/src/env.ts. `step=provision` copies the
   * live values across rather than trusting either file, so these are the
   * floor, not the contract.
   */
  MODEL_API_BASE: z.url().default('https://api.deepseek.com/v1'),
  MODEL_API_KEY: z.string().min(8).optional(),
  MODEL_NAME: z.string().min(1).default('deepseek-v4-pro'),
  JUDGE_API_BASE: z.url().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  JUDGE_API_KEY: z.string().min(8).optional(),
  JUDGE_MODEL_NAME: z.string().min(1).default('qwen3-max'),

  /**
   * Real-time voice. `provider: none` is a first-class, tested mode — it is
   * what a deployment without an Inworld contract runs, and what every test
   * runs (/ORACLE.md §14: speech is an enhancement, the lesson is the product).
   */
  /*
   * THE DPA GATE, made explicit (owner decision, 2026-08-21).
   *
   * A minor's voice reaching a third party needs a data-processing agreement
   * that does not exist yet (/LEGAL/AI_TUTOR_LEGAL_REVIEW.md §6). Until it
   * does, this stays FALSE and no minor's microphone opens — regardless of
   * guardian consent, which is a separate and also-required condition.
   *
   * It is a flag rather than "just don't configure a key" because those are
   * DIFFERENT facts and conflating them is how a policy decision turns into an
   * accident: a key configured for adult sessions would silently have opened
   * children's microphones too. Adults are unaffected either way, and every
   * learner keeps the full tutor — captioned, typed, and complete — so the
   * contract gates the microphone, never the product.
   *
   * Flipping it is a deployment change with an owner sign-off to record.
   */
  TUTOR_VOICE_FOR_MINORS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  VOICE_PROVIDER: z.enum(['inworld', 'none']).default('none'),
  INWORLD_API_BASE: z.url().default('https://api.inworld.ai'),
  /** Inworld issues this ALREADY base64-encoded (`keyId:secret`). Do not re-encode. */
  INWORLD_API_KEY: z.string().min(8).optional(),
  /** Verified present: inworld-tts-1, -1-max, -2, -2-flash. */
  INWORLD_TTS_MODEL: z.string().min(1).default('inworld-tts-1'),

  /*
   * THE CHARACTER VOICES (owner note, 2026-08-21).
   *
   * The cast already has voices: Echo clones them per locale from the owner's
   * reference recordings and narrates every lesson with them. The Tutor must
   * use the SAME ones, or a child who knows Dr. Rho from a lesson meets a
   * stranger. These names deliberately mirror Echo's `TTS_VOICE_<CHAR>_<LOC>`
   * so the two castings can be compared at a glance.
   *
   * All optional, and an UNSET one means that character is silent in that
   * locale — never a stock substitute (see src/voice/inworld.ts).
   * Populated by `npm run voices:clone`.
   */
  INWORLD_VOICE_DINA_EN_US: z.string().min(1).optional(),
  INWORLD_VOICE_DINA_ES_MX: z.string().min(1).optional(),
  INWORLD_VOICE_DINA_PT_BR: z.string().min(1).optional(),
  INWORLD_VOICE_LIRUF_EN_US: z.string().min(1).optional(),
  INWORLD_VOICE_LIRUF_ES_MX: z.string().min(1).optional(),
  INWORLD_VOICE_LIRUF_PT_BR: z.string().min(1).optional(),
  INWORLD_VOICE_RHO_EN_US: z.string().min(1).optional(),
  INWORLD_VOICE_RHO_ES_MX: z.string().min(1).optional(),
  INWORLD_VOICE_RHO_PT_BR: z.string().min(1).optional(),
  INWORLD_VOICE_ZARA_EN_US: z.string().min(1).optional(),
  INWORLD_VOICE_ZARA_ES_MX: z.string().min(1).optional(),
  INWORLD_VOICE_ZARA_PT_BR: z.string().min(1).optional(),

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
