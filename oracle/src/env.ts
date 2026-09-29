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
   * THE MODEL NAME IS DELIBERATELY NOT FORGE'S, and this is the one place the
   * two services should differ. `deepseek-v4-pro` is a REASONING model: asked
   * for a tutor turn it spent all 400 completion tokens on `reasoning_content`
   * ("We need answer in JSON. Need teach in Spanish es-MX…"), returned `content`
   * of length ZERO and `finish_reason: length`, and every learner got the
   * scripted MODEL_DOWN line. Measured in production 2026-08-21, not inferred.
   *
   * That model is right for Forge, which authors a whole course offline and
   * would rather think than hurry. It is wrong here, where a learner is waiting
   * and latency IS the product. `deepseek-v4-flash` is the non-reasoning
   * sibling on the same account — confirmed against /models, which lists
   * exactly deepseek-v4-flash, deepseek-v4-flash-vision-exp and
   * deepseek-v4-pro.
   *
   * The divergence is recorded in agent/tools/check-provider-parity.mjs so the
   * gate allows it knowingly. `deepseek-chat` is not an option either way: it
   * was retired 2026-07-24.
   */
  MODEL_API_BASE: z.url().default('https://api.deepseek.com/v1'),
  MODEL_API_KEY: z.string().min(8).optional(),
  MODEL_NAME: z.string().min(1).default('deepseek-v4-flash'),
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

  /*
   * THE SPEECH CACHE (/ORACLE.md §15).
   *
   * Text-to-speech is the most expensive thing this service does, and most of
   * what it says it has said before. The cache sits in front of the paid call
   * and stores a content key → Depot URL in the Redis we already run.
   *
   * Disabling it is a debugging affordance, not a posture: with it off every
   * line is synthesised and billed again, which is exactly what this work
   * removed. The TTL is generous because the value is an immutable URL to an
   * immutable clip; the only reason it expires at all is so a Depot file that
   * really did go away eventually stops being referenced.
   */
  SPEECH_CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SPEECH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(180 * 24 * 60 * 60),

  /*
   * HOW FAR A CLIP MAY BE REUSED. `scripted` (the default) shares only the
   * closed, human-written line set — audio that is identical for every learner
   * and says nothing about anybody. `all` also shares model-generated turns
   * between learners, which is more saving and a CHANGE TO A DOCUMENTED
   * PRIVACY PROMISE: a shared clip cannot be deleted with one child's session,
   * so their tutor's words would outlive the 90-day retention window
   * (/ORACLE.md §12). That is an owner decision with counsel in it. It is a
   * named flag with a default and a sign-off to record, for the same reason
   * TUTOR_VOICE_FOR_MINORS is.
   */
  SPEECH_CACHE_SCOPE: z.enum(['scripted', 'all']).default('scripted'),

  /** Session budget (/ORACLE.md §0 assumption 5, §9.5). */
  SESSION_SOFT_BUDGET_MS: z.coerce.number().int().positive().default(15 * 60_000),
  SESSION_HARD_BUDGET_MS: z.coerce.number().int().positive().default(25 * 60_000),
  SESSION_MAX_TURNS: z.coerce.number().int().positive().default(120),
  /**
   * How long a session may carry NO learner frame (keepalive pings excluded)
   * before it is closed as abandoned. Generous on purpose: a child slowly
   * working an activity sends nothing while they think, and reaping them
   * mid-thought is worse than holding an orchestrator in memory a few minutes
   * longer. What this bounds is the abandoned open tab, which previously held
   * its session until the hard budget — and the hard budget is only evaluated
   * when a turn arrives, so in practice it held it forever.
   */
  SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10 * 60_000),
  /**
   * How long a session survives its socket dropping uncleanly (owner sign-off
   * 2026-08-28, amending the old no-reconnect rule). The orchestrator — with
   * its history, its budget clock and its paid speech memo — is PARKED
   * in-process for this window; Core can mint a fresh single-use token for the
   * same session and the browser re-attaches to the conversation it left. The
   * park lives in this process's memory, so it shares the SINGLE-REPLICA
   * constraint the token nonce ledger already imposes (/ORACLE.md §16).
   */
  SESSION_RESUME_GRACE_MS: z.coerce.number().int().positive().default(90_000),
  /** Per-turn learner input cap, in characters (§5 bounds). */
  TURN_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(600),

  /**
   * Product C.10 — the corroborating-evidence requirement: how many
   * consecutive qualifying observations the pedagogy controller needs before
   * it declares mastery or triggers remediation/rescue. The SPEC's value is
   * 2, "proposed, pending data-driven validation" (Threshold Recalibration
   * Log, docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md). Changing it is
   * a Tier 1 governance change (C.22), never a tuning knob.
   *
   * The floor is 2, not 1: "no mastery or remediation decision executes on a
   * single observation" is a non-negotiable Block C constraint, so an
   * environment value cannot switch C.10 off globally (S06.15 lane review).
   * A value below 2 refuses to boot rather than weakening the rule. The only
   * sanctioned single-observation path is the per-KC Stage 7 rollback below.
   */
  TUTOR_CORROBORATION_MIN_OBSERVATIONS: z.coerce.number().int().min(2).max(5).default(2),
  /**
   * Appendix F Part 3 Stage 7 — the Extended Mastery Engine kill switch,
   * OPERATOR OVERRIDE: comma-separated `kc.key`s reverted to the pre-C.10
   * single-observation baseline until root-caused. Empty (the default) rolls
   * nothing back. The automatic rollback is Core's (`getMasteryKillSwitch`,
   * which writes `mentor.kill_switch.mastery.*` to `audit_logs` and sends the
   * tripped keys as the negotiated context field
   * `corroborationRollbackKcKeys`); the controller applies the UNION of the
   * two. This env list is NOT written to the Kill-Switch Trigger Log by
   * itself: Oracle logs it to stdout once per session in which a listed KC
   * is in the plan, and the operator who sets it records the trip in the
   * log by hand (MENTOR-INTEGRITY-POLICY.md §3.3).
   */
  TUTOR_CORROBORATION_ROLLBACK_KC_KEYS: z
    .string()
    .default('')
    .transform((raw) =>
      raw
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),
  /**
   * Product C.8/C.12 — the behavioral-signature session-end signal
   * (`tutor/sessionEndSignal.ts`). `offer` (default): the Mentor may offer to
   * stop early when the signal fires. `shadow`: computed and logged, never
   * offered. `off`: not computed. `shadow` and `off` are the Appendix F
   * Stage 7 rollback — session management reverts to the time/turn caps.
   * An unknown value falls back to `offer` rather than silently disabling it.
   */
  TUTOR_SESSION_END_SIGNAL: z.enum(['offer', 'shadow', 'off']).catch('offer').default('offer'),

  /**
   * C.9/C.19 Stage 7 kill switch for the Behavioral Telemetry Layer
   * (`tutor/behavioralTelemetry.ts`). `act` (default): a fired disengagement
   * signal makes the Mentor check in ("are we on the same page?") and routes
   * the answer through the adaptation offer. `shadow`: computed and recorded,
   * never acted on. `off`: not computed. `shadow` and `off` are the Appendix F
   * Stage 7 rollback (Default-to-Inaction Rate below 85% or Disengagement-
   * Repair Initiation Rate below 100%); session management reverts to the
   * time/turn caps. An unknown value falls back to `act`, never a silent off.
   */
  TUTOR_BEHAVIORAL_TELEMETRY: z.enum(['act', 'shadow', 'off']).catch('act').default('act'),

  /**
   * C.15 Stage 7 kill switch for the Alliance Controller
   * (`tutor/allianceController.ts`). `act` (default): the goal-agreement
   * opening move, the renegotiation trigger after repeated declined
   * adaptations, and the persona-continuity re-establishment. `shadow`:
   * the renegotiation trigger and the continuity re-establishment are
   * suspended (recorded, never acted on) and the passive bond/goal tracking
   * keeps running — the Appendix F Part 3 rollback. `off`: nothing. Core's
   * automatic rollback verdict can only make it stricter. An unknown value
   * falls back to `act`, never a silent off.
   */
  TUTOR_ALLIANCE_CONTROLLER: z.enum(['act', 'shadow', 'off']).catch('act').default('act'),

  /**
   * C.14 switch for the self-explanation move (`tutor/selfExplanation.ts`).
   * `act` (default): after a financial decision the system asks the learner
   * why, checks the reply names the idea and follows up once. `shadow`: the
   * decision points are recorded, never prompted. `off`: nothing. An unknown
   * value falls back to `act`.
   */
  TUTOR_SELF_EXPLANATION: z.enum(['act', 'shadow', 'off']).catch('act').default('act'),

  /**
   * C.11 switch for the two-tier spaced-review router
   * (`tutor/spacedReview.ts`). `act` (default): a wrong answer close to the
   * mastery threshold with budget left is brought back once more in this
   * session after a short gap (the controller's review detour); every other
   * wrong answer, and every item still open at close, is handed to Core's
   * cross-session scheduler. `shadow`: every routing decision is computed and
   * recorded, no re-exposure detour is opened — the Stage 7 rollback. `off`:
   * nothing is routed or recorded. Core's automatic verdict
   * (`spacedReviewMode`) can only make it stricter. An unknown value falls
   * back to `act`.
   */
  TUTOR_SPACED_REVIEW: z.enum(['act', 'shadow', 'off']).catch('act').default('act'),

  /**
   * C.17 switch for the age-band dialogue calibration
   * (`tutor/dialogueCalibration.ts`). `act` (default): the session runs the
   * variant Core assigned (the SPEC's calibrated register for every learner
   * outside the adults-only experiment). `off`: every session runs the
   * uniform pre-C.17 register (`control`, recorded as `operator_off`). An
   * unknown value falls back to `act`.
   */
  TUTOR_DIALOGUE_CALIBRATION: z.enum(['act', 'off']).catch('act').default('act'),

  /**
   * ORACLE.md §15.2 item 2 (narrow scope — the horizontal-scale half of that
   * item is a separate, larger, architecturally-undecided piece of work).
   *
   * Hard per-process ceiling on live tutor sessions. Before this existed,
   * `oracle/` accepted every authenticated socket unconditionally: nothing
   * counted how many were open, and each one holds a full orchestrator, its
   * transcript and (mid microphone turn) up to the streamed-audio ceiling in
   * memory for as long as it stays connected. The failure at saturation is
   * memory pressure and a slowing event loop for EVERYONE already connected —
   * the worst shape of failure, since it degrades every existing learner
   * rather than merely refusing a new one.
   *
   * The default is a conservative STARTING POINT, not a measured capacity
   * figure — this codebase has no production memory profile for a live
   * session yet (§15.2's own "unmeasured" caveat applies here too). Raise it
   * per deployment once real load is observed.
   */
  ORACLE_MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().default(200),

  /**
   * ORACLE.md §15.2 item 3 — the websocket handshake has no rate limit of its
   * own, because the WebSocketServer in `ws/server.ts` is attached directly
   * to the raw HTTP server and Express's `globalRateLimiter`
   * (`middleware/rateLimit.ts`) never sees the upgrade. See
   * `ws/handshakeRateLimit.ts` for the enforcement and why it is not simply
   * that same limiter reused.
   *
   * Per IP, not per user: the handshake is rate-limited before the token is
   * even read, so nothing about the caller's identity is known yet. Defaults
   * are generous on purpose — a household of siblings reconnecting through
   * one NAT'd IP on a flaky connection is the ordinary case this must not
   * catch, and this is defence in depth behind a control that already works
   * (Core's token minting) rather than the primary defence.
   */
  ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  /** Upstream call timeouts. A tutor that hangs is worse than one that fails. */
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  VOICE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CORE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),

  /*
   * `LIVE_REVIEW_SAMPLE_RATE` used to live here and was DEAD CONFIG — read by
   * nothing in this service. The sampling has always been Core's
   * (`TUTOR_LIVE_REVIEW_SAMPLE_RATE`, applied where segments are persisted),
   * and a knob that exists but controls nothing is worse than no knob: it
   * convinces an operator the fraction is set when it is not. Removed
   * 2026-08-28; set the rate in Core.
   */

  /**
   * THE PLATFORM-WIDE SPEND CIRCUIT BREAKER (/ORACLE.md §15.2 item 1).
   *
   * Every OTHER limit in §15 bounds what ONE session or ONE learner can cost
   * (turn caps, budget clocks, the per-day session cap). None of them bounds
   * what the PROCESS spends in total, so a provider incident that makes
   * retries pile up across many sessions at once, or a bug that multiplies
   * calls, had nothing between it and the invoice — "we would notice on the
   * bill" is not a control.
   *
   * $20/day is a deliberately conservative FIRST default, not a modelled
   * budget: /ORACLE.md's own measurement puts an ordinary session at
   * fractions of a cent and even a pathological 120-turn one at "cents", so
   * this ceiling exists to catch a MULTIPLIER-shaped bug — a retry storm, a
   * loop — rather than to cap realistic legitimate usage. Raise it
   * deliberately as real paid usage grows; a ceiling that trips on ordinary
   * Tuesday traffic is as useless as one that never trips at all.
   *
   * In-process and reset on a rolling 24h window (`session/spend-guard.ts`) —
   * deliberately NOT moved to the shared store the nonce ledger and the
   * session park now use (/ORACLE.md §16, `RUNBOOK.md` Round 143), because a
   * circuit breaker must not depend on the infrastructure it exists to
   * survive (§1.14). A process restart forgets today's running total; the
   * worst that allows is one extra day at full exposure on the day of a
   * deploy, which is a fair trade against a Redis outage silently disabling
   * the breaker entirely.
   *
   * **PER REPLICA.** At N instances the effective ceiling is this number times
   * N, because each process only ever sees its own spend. Divide it by the
   * replica count when scaling out — see `spend-guard.ts`'s own header for
   * why that is the right trade rather than an oversight.
   */
  DAILY_SPEND_CEILING_USD: z.coerce.number().positive().default(20),
  /**
   * The fraction of the ceiling that triggers a LOUD warning instead of a
   * refusal — "an alert well below it", per §15.2, so an operator has room to
   * react before a learner is ever turned away. Expressed as a fraction of
   * the ceiling rather than a second absolute dollar figure so the two stay
   * in proportion when the ceiling itself is retuned.
   */
  DAILY_SPEND_ALERT_FRACTION: z.coerce.number().positive().max(1).default(0.5),
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
