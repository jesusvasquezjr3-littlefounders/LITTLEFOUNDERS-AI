import { z } from 'zod';

/*
 * Env validated once at boot (agent/core/CONVENTIONS.md). Tests set
 * process.env in test-setup before the first getConfig() call.
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).catch('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  // Supabase self-hosted stack (local: Kong on :8000 — database/README.md).
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(16),

  // Service-to-service (/AGENTS.md §1.5).
  INTERNAL_API_KEY: z.string().min(16),
  PARENT_ID_CHECK_URL: z.url().default('http://localhost:4004'),
  EMAIL_SERVER_URL: z.url().optional(),

  // dataintel analytics proxy
  DATAINTEL_URL: z.string().url().default('http://localhost:4008'),
  DATAINTEL_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),
  DATAINTEL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Depot (filebase). Core only needs it for the Tutor retention sweep, which
  // must delete the tutor's stored audio as well as the database rows — a
  // cascade reaches the rows and nothing reaches the blobs.
  FILEBASE_URL: z.string().url().default('http://localhost:4006'),
  FILEBASE_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),

  // Oracle — the AI Tutor runtime (/ORACLE.md).
  //
  // Two URLs, not one, and the distinction matters. ORACLE_URL is the private
  // address Core uses for preflight and is never seen by a browser.
  // ORACLE_PUBLIC_URL is what the BROWSER opens a websocket against — the
  // fourth documented §1.5 exception — and in production those are different
  // hosts (Railway private networking vs a public domain). Defaulting the
  // public one to localhost keeps local development working with one service.
  ORACLE_URL: z.string().url().default('http://localhost:4009'),
  ORACLE_PUBLIC_URL: z.string().url().default('http://localhost:4009'),
  ORACLE_INTERNAL_KEY: z.string().min(16).default('replace-me-0123456789'),
  ORACLE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),

  // Signs the single-use, session-scoped token the browser carries to Oracle
  // (/ORACLE.md §3.2). MUST differ from INTERNAL_API_KEY: one authenticates a
  // SERVICE, this one authenticates one browser socket, and sharing them would
  // let a leaked session token call the internal API.
  //
  // NO DEFAULT, ON PURPOSE. Found live, testing as a real logged-in kid
  // account in the browser, 2026-08-30 (HIGH): this used to default to
  // 'replace-me-with-a-64-char-random-string-0000' — a value checked into
  // this very file's own git history — while oracle/src/env.ts requires the
  // SAME shared secret with no default at all. The two services deploy
  // independently (§1.5), so nothing ever forced them to agree: with
  // backend/.env missing this var (a genuine local gap, reproduced directly),
  // Core silently signed every Tutor session token with the public
  // placeholder while Oracle verified against its own real secret, and every
  // single websocket handshake failed with a signature mismatch — the ENTIRE
  // Tutor product broken, silently, with no error at boot. A shared
  // authentication secret is a security control, not an availability one
  // (§1.14 draws exactly this line for a different case): it must fail
  // CLOSED — refuse to boot — the same way oracle's own copy of this field
  // already does, not silently sign with a value anyone reading this source
  // file already knows.
  TUTOR_SESSION_SECRET: z.string().min(32, 'TUTOR_SESSION_SECRET must be at least 32 chars'),

  // v2 lesson attempts use a separate signing domain from both Oracle sessions
  // and service-to-service credentials. It is optional at process boot only so
  // an unconfigured, entirely inactive v2 catalog cannot take the established
  // v1 product offline. The v2 run and grade routes fail closed with 503 until
  // an operator supplies it; it never falls back to a checked-in placeholder.
  LESSON_ATTEMPT_SECRET: z.string().min(32, 'LESSON_ATTEMPT_SECRET must be at least 32 chars')
    .refine((value) => !value.startsWith('replace-me-'), 'LESSON_ATTEMPT_SECRET must be generated for this environment')
    .optional(),

  // C.5 / Appendix E §3.1.1: the BASELINE share of live-generated Mentor
  // activities sampled for post-hoc staff review, per content-risk category.
  // The floors (15% standard, 50% sensitive) are Tier-1-adjacent: a value
  // may RAISE the baseline, never lower it — a value below the floor is
  // ignored (the floor applies) and logged at boot of the gate. Zero, once a
  // valid choice here, is no longer possible. A quality or safety issue found
  // by staff raises the rate further, automatically, for that category
  // (services/pedagogy/liveContentGovernance.ts).
  TUTOR_LIVE_REVIEW_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.5),

  // The Tutor v3 pedagogical brain (KC graph + BKT + FSRS + session plan,
  // migration 0052). On by default WITH graceful degradation: while 0052 is
  // unapplied or unseeded every read comes back null/empty, the session
  // context simply omits the pedagogy fields, and Oracle behaves exactly as
  // v2. The switch exists to turn the brain off deliberately, not to make
  // deploys safe — the degradation does that.
  TUTOR_V3_BRAIN: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0' && v !== 'off'),

  // B.6 / OD-22 (S05.3b): which course engine the learner routes run.
  // `linear` is the legacy single flat lesson order. `pathway` is the age-
  // pathway frontier on the Mentor's knowledge graph (docs/rebuild/sprints/
  // S05-B6-PATHWAY-POLICY.md). The policy is an engineering proposal until the
  // owner accepts it (OD-22), and `pathway` reads tables the B.6 migrations
  // add, so it stays off until both are true: an operator switches it on after
  // acceptance and after the migrations are applied, never a deploy by accident.
  COURSE_PATHWAY_ENGINE: z.enum(['linear', 'pathway']).default('linear'),

  // Owner review P-09 (GAP-FIX-R3): a graded course lesson may feed the
  // Mentor's mastery model (source 'course_lesson', migration 0206) only after
  // the B.6 pathway policy is accepted (COURSE_PATHWAY_ENGINE = 'pathway') AND
  // this calibration switch is on. It stays 'off' until the calibration named in
  // docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md has passed and an
  // operator turns it on; never a deploy by accident.
  COURSE_LESSON_EVIDENCE: z.enum(['off', 'on']).default('off'),

  // C.11 (Appendix D §2.4): the cross-session scheduler's SHORT HORIZON, in
  // minutes. A graded attempt within this long of the card's last counted
  // (spaced) review is a within-session re-exposure: a success does not grow
  // the card's stability and a second lapse does not collapse it again — the
  // within-session tier owns that repetition. 0 turns the rule off (every
  // attempt counts as a spaced review, the pre-C.11 behaviour). Proposed,
  // pending calibration (docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md).
  TUTOR_REVIEW_SHORT_HORIZON_MIN: z.coerce.number().int().min(0).max(24 * 60).default(180),

  // C.17: the dialogue bands the age-band calibration A/B experiment may
  // enrol, comma-separated from tween,teen,adult. OD-26 (owner review M-12,
  // 27 September 2026) opens C.17, and only C.17, to teens 13-17 (their own
  // analytics opt-in) and tweens 10-12 (a verified guardian's analytics
  // consent, on an exact age); every other experiment keeps OD-23's
  // adults-only rule. young_child (6-9) is never accepted here, and Core's
  // resolver refuses it again. An operator can narrow the list (e.g. `adult`)
  // but never widen it past these three. Unknown names are ignored.
  MENTOR_DIALOGUE_EXPERIMENT_BANDS: z
    .string()
    .default('adult,teen,tween')
    .transform((v) =>
      v
        .split(',')
        .map((band) => band.trim())
        .filter((band): band is 'tween' | 'teen' | 'adult' => ['tween', 'teen', 'adult'].includes(band)),
    ),

  // Games in /learn (docs/games/KRV1-CONTRACT.md). KARTRUSH_URL is the game's
  // static bundle, handed to the SPA as the iframe src; the SPA accepts it only
  // if its origin is on its own hard-coded list, so a wrong value here fails
  // closed in the browser. KARTRUSH_BUILD is the deployed build id, recorded
  // with each session (1..40 characters).
  KARTRUSH_URL: z.url().default('https://kartrush-production.up.railway.app'),
  KARTRUSH_BUILD: z.string().min(1).max(40).default('unknown'),
  // The one-line AI debrief after a race (docs/games/KARTRUSH-INTEGRATION-DESIGN.md
  // section 4.2). OFF unless an operator turns it on, after the cost per line has
  // been measured and moderation has been read; Oracle carries the same switch,
  // so both must be on. GAME_AI_DAILY_LINES is the per-learner cap on generated
  // lines per local day, enforced atomically in the database; 0 disables it.
  GAME_AI_DEBRIEF: z.enum(['off', 'on']).default('off'),
  GAME_AI_DAILY_LINES: z.coerce.number().int().min(0).max(50).default(6),

  // Redis para Rate Limiting distribuido
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
});

export type Config = Readonly<Omit<z.infer<typeof Env>, 'EMAIL_SERVER_URL'> & { EMAIL_SERVER_URL: string }>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) {
    const parsed = Env.parse(process.env);
    const emailServerUrl = parsed.EMAIL_SERVER_URL
      ?? (parsed.NODE_ENV === 'production' ? 'http://email-server.railway.internal:4005' : 'http://localhost:4005');
    cached = Object.freeze({ ...parsed, EMAIL_SERVER_URL: emailServerUrl });
  }
  return cached;
}

/** Test-only escape hatch: force the next request to re-read environment variables. */
export function resetConfigForTests(): void {
  cached = null;
}
