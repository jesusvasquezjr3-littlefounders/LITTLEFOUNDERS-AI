import { z } from 'zod';
import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import {
  ADAPTATIONS,
  CHARACTER_IDS,
  INTENTS,
  LOCALES,
  PreviousSessionSchema,
  SkillStateSchema,
  type Locale,
} from '../context/schema.js';
import type { WireWhiteboard } from '../ws/protocol.js';

/*
 * Oracle talks to Core, and to nothing else that holds a learner's data.
 *
 * Oracle has NO database credentials, by design. Every fact about a learner
 * arrives through this file, already resolved and already scoped to one
 * person, and every write goes back the same way. That is what keeps the
 * privacy boundary auditable: there is one file to read to know everything
 * Oracle can possibly learn about a child.
 *
 * It also means Oracle cannot accidentally read another learner's row, run an
 * unscoped query, or bypass RLS — not because it is careful, but because it
 * has no connection.
 */

/** Mirrors migration 0047's tutor_sessions.close_reason CHECK constraint. */
export type CloseReason =
  | 'completed'
  | 'soft_budget'
  | 'hard_budget'
  | 'learner_left'
  | 'abandoned'
  | 'consent_revoked'
  | 'safety_stop'
  | 'error';

/**
 * One entry of the v3 session plan (Core's pedagogy/sessionPlan.ts). All of
 * it is server-derived catalog data: KC ids/keys, our localized objective and
 * remediation hints, numbers. Nothing a learner wrote.
 */
const SessionPlanEntrySchema = z
  .object({
    kcId: z.uuid(),
    kcKey: z.string().min(1).max(96),
    skillKey: z.string().min(1).max(128).nullable(),
    reason: z.enum(['review_due', 'frontier']),
    pKnown: z.number().min(0).max(1),
    targetDifficulty: z.number().int().min(1).max(5),
    objective: z.string().max(400),
    prereqKcIds: z.array(z.uuid()).max(16),
    misconceptions: z
      .array(z.object({ code: z.string().min(1).max(96), hint: z.string().max(400) }).strict())
      .max(8),
  })
  .strict();

const KcStateSchema = z
  .object({
    kcId: z.uuid(),
    kcKey: z.string().min(1).max(96),
    pKnown: z.number().min(0).max(1),
    attempts: z.number().int().nonnegative(),
  })
  .strict();

export type SessionPlanEntry = z.infer<typeof SessionPlanEntrySchema>;
export type KcState = z.infer<typeof KcStateSchema>;

/** What Core hands back when Oracle opens a session it was given a token for. */
const SessionContextSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
    /** Resolved INSIDE Core from profiles.birth_date; the date never travels. */
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    nickname: z.string().min(1).max(24),
    character: z.enum(CHARACTER_IDS),
    companion: z.enum(CHARACTER_IDS).nullable(),
    diorama: z.string().min(1).max(64),
    intent: z.enum(INTENTS),
    adaptations: z.array(z.enum(ADAPTATIONS)),
    courseContext: z
      .object({
        courseId: z.uuid().nullable(),
        courseTitle: z.string().nullable(),
        topicId: z.uuid().nullable(),
        topicTitle: z.string().nullable(),
      })
      .nullable(),
    skillStates: z.array(SkillStateSchema),
    /** The skill this session was opened about, when it was opened about one. */
    skillKey: z.string().min(1).max(128).nullable().optional(),
    /**
     * Up to three prior conversations as strict digests (/ORACLE.md §4.1,
     * owner sign-off 2026-08-28). OPTIONAL on the wire so an Oracle deployed
     * ahead of Core degrades to a tutor with no memory rather than to a
     * refused handshake; the sealed context defaults it to empty.
     */
    previousSessions: z.array(PreviousSessionSchema).max(3).optional(),
    /**
     * V4 learner brief (0053): the slow chamber's curated prose about this
     * learner. OPTIONAL on the wire — an Oracle deployed ahead of Core, or a
     * learner with no memory yet, degrades to a tutor without a brief.
     * Limits mirror the schema's hard caps.
     */
    learnerBrief: z
      .object({
        learner: z.string().min(1).max(1400).nullable(),
        pedagogy: z.string().min(1).max(2200).nullable(),
      })
      .strict()
      .nullable()
      .optional(),
    /**
     * Whether Core's OWN read of `learnerBrief` failed, as opposed to this
     * learner genuinely having no memory yet — the same "failure is not
     * emptiness" distinction `intelDegraded` already makes for `skillStates`
     * (/AGENTS.md, round 28, 2026-08-30, HIGH). OPTIONAL on the wire, so an
     * Oracle deployed ahead of Core (which does not send this field yet)
     * defaults to `false` — the same conservative default `learnerBrief`
     * itself already had before this flag existed, not a regression.
     * `session/review.ts` refuses to write over real memory when this is
     * true, rather than trusting an empty brief that might just be unread.
     */
    learnerBriefDegraded: z.boolean().optional(),
    /**
     * The v3 brain (migration 0052). OPTIONAL AND NULLABLE on the wire, and
     * that is the whole deployment story: while 0052 is unapplied, unseeded,
     * or TUTOR_V3_BRAIN is off, Core sends null (or nothing) and Oracle's
     * controller stays dormant — exactly v2 behaviour.
     */
    sessionPlan: z.array(SessionPlanEntrySchema).max(8).nullable().optional(),
    kcStates: z.array(KcStateSchema).max(40).nullable().optional(),
    /** True when this learner is a minor: forces the model moderation pass. */
    isMinor: z.boolean(),
    /** Whether an active guardian voice consent exists RIGHT NOW. */
    voiceConsent: z.boolean(),
    /** Whether personalization could actually be read (§14: failure != empty). */
    intelDegraded: z.boolean(),
  })
  .strict();

export type SessionContext = z.infer<typeof SessionContextSchema>;

const Envelope = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    data: inner.nullable(),
    error: z.object({ code: z.string(), message: z.string() }).nullable(),
  });

async function coreFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const config = getConfig();
  const response = await withTimeout(
    fetch(`${config.CORE_URL}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': config.CORE_INTERNAL_KEY,
        ...(init.headers ?? {}),
      },
    }),
    config.CORE_TIMEOUT_MS,
    `core ${path}`,
  );
  if (!response.ok) throw new Error(`core ${path} responded ${response.status}`);
  return response.json();
}

/**
 * Resolves everything Oracle is allowed to know about this session.
 *
 * Returns `null` on any failure, and the caller must REFUSE the socket rather
 * than proceeding with defaults. §1.14, stated for this specific case: an
 * unreadable context is not an empty context, and running a session as
 * "tier 2, no consent, no history" because Core hiccuped would silently open
 * a microphone we were never told we could open.
 */
export async function fetchSessionContext(sessionId: string): Promise<SessionContext | null> {
  try {
    const body = await coreFetch(`/tutor/internal/sessions/${encodeURIComponent(sessionId)}`);
    const parsed = Envelope(SessionContextSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

export interface PersistTurnInput {
  sessionId: string;
  seq: number;
  speaker: 'learner' | 'tutor' | 'system';
  text: string;
  emotion?: string | null;
  action?: string | null;
  audioPath?: string | null;
  source: 'model' | 'scripted' | 'stt';
  moderation?: Record<string, unknown>;
  /**
   * V4's live sequence board, when this tutor turn drew one — the SAME
   * object sent over the wire (see `WireWhiteboard`'s own comment), never
   * recomputed. Found by adversarial review, round 35 (2026-08-30, HIGH):
   * this field did not exist at all, so a session that used the whiteboard
   * lost it silently on replay and on the guardian transcript viewer.
   */
  whiteboard?: WireWhiteboard | null;
}

/**
 * Appends one turn to the transcript.
 *
 * Best-effort by design: a transcript write that fails must not kill a live
 * lesson, because the lesson is the product and the transcript is the record
 * of it. It returns a boolean so the caller can count failures and close the
 * session if the record is systematically not being kept — a session nobody
 * can replay and no guardian can read is a different product from the one we
 * promised.
 */
export async function persistTurn(input: PersistTurnInput): Promise<boolean> {
  try {
    const body = await coreFetch('/tutor/internal/turns', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ recorded: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.recorded === true;
  } catch {
    return false;
  }
}

export interface PersistFlagInput {
  sessionId: string;
  turnSeq: number | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  handled: 'scripted_response' | 'turn_blocked' | 'session_stopped';
}

/** Records a safety flag. Guardian-visible (/ORACLE.md §5, migration 0047). */
export async function persistSafetyFlag(input: PersistFlagInput): Promise<boolean> {
  try {
    const body = await coreFetch('/tutor/internal/flags', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ recorded: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.recorded === true;
  } catch {
    return false;
  }
}

export interface CloseSessionInput {
  sessionId: string;
  closeReason: CloseReason;
  /**
   * The TRANSCRIPT's own row count — every persisted `tutor_turns` row,
   * learner and tutor alike (`ws/server.ts`'s `transcriptSeq`, not
   * `orchestrator.turnCount`, which counts only model-produced tutor turns
   * and is right for cost/budget tracking but wrong for this). This is what
   * a parent's "N líneas" and the resume player's "line X of N" both count.
   * Found by adversarial review, 2026-08-30 (HIGH): sending the tutor-only
   * count here made a 5-tutor-turn/5-learner-turn session — 10 real rows —
   * display as "5 líneas" while its own replay showed 10, on the one page a
   * guardian can directly count the mismatch on.
   */
  turnCount: number;
  segmentCount: number;
  costUsd: number;
}

export async function closeSession(input: CloseSessionInput): Promise<boolean> {
  try {
    const body = await coreFetch(`/tutor/internal/sessions/${encodeURIComponent(input.sessionId)}/close`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ closed: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.closed === true;
  } catch {
    return false;
  }
}

/**
 * Adds an already-spent amount to a session's recorded cost, AFTER the close
 * that wrote it (round 78, 2026-08-30).
 *
 * `closeSession` above is the session's own economics, read once from the
 * orchestrator at the moment the socket closes. This is for the paid work a
 * session causes but does not finish paying for by then — today exactly one
 * caller, `session/review.ts`, whose model call is fired fire-and-forget after
 * `finish()`/`finalizeParked()` have already persisted `costUsd`. Round 64's
 * `noteGenerationCost` covers the other shape (a paid call DURING the
 * session), where the running total is still there to add to.
 *
 * Best-effort like every other write here: `false` means the cost is
 * uncounted, and the caller says so loudly rather than retrying. It never
 * throws, because its one caller must not be able to fail a review — let
 * alone a session close — over accounting.
 */
export async function addSessionCost(input: {
  sessionId: string;
  costUsd: number;
  reason: 'post_session_review';
}): Promise<boolean> {
  try {
    const body = await coreFetch(`/tutor/internal/sessions/${encodeURIComponent(input.sessionId)}/cost`, {
      method: 'POST',
      body: JSON.stringify({ costUsd: input.costUsd, reason: input.reason }),
    });
    const parsed = Envelope(z.object({ recorded: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.recorded === true;
  } catch {
    return false;
  }
}

/** A client-safe segment: Core has already stripped the answer key. */
const ServedSegmentSchema = z
  .object({
    segmentId: z.uuid(),
    seq: z.number().int().nonnegative(),
    origin: z.enum(['catalog', 'bank', 'live']),
    /** The stripped Lesson Engine segment, shape-checked by the frontend. */
    segment: z.record(z.string(), z.unknown()),
    keyVerified: z.boolean(),
    /**
     * The band the segment Core ACTUALLY chose carries — not the one we asked
     * for, which the ladder is free to miss (see `servedDifficultyOf` in
     * `backend/src/routes/tutor.ts`). `null` means the chosen segment declares
     * no usable difficulty, which is a different fact from "band 3" and is
     * kept distinguishable from it (§1.14).
     *
     * OPTIONAL ON PURPOSE, and the direction matters. This object is
     * `.strict()`, so it is the OLD-Oracle-meets-NEW-Core direction that is
     * dangerous: an unknown key fails the parse, `requestSegment` returns
     * `null`, and every single activity in every session becomes NO_SEGMENT.
     * Optional here only covers the opposite pairing (this Oracle against a
     * Core that predates the field), so the deploy ORDER is load-bearing —
     * Oracle first, then Core. Recorded in `RUNBOOK.md` Round 74.
     */
    servedDifficulty: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

/** Core could not serve from tiers 1 or 2, so tier 3 is Oracle's to author. */
const NeedsGenerationSchema = z
  .object({
    needsGeneration: z.literal(true),
    skillKey: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    difficulty: z.number().int().min(1).max(5),
    allowedTypes: z.array(z.string()),
  })
  .strict();

export type ServedSegment = z.infer<typeof ServedSegmentSchema>;
export type NeedsGeneration = z.infer<typeof NeedsGenerationSchema>;

const SegmentResponseSchema = z.union([ServedSegmentSchema, NeedsGenerationSchema]);

/** Core rejected a generated candidate, with the specific reasons. */
const RejectedSchema = z
  .object({ accepted: z.literal(false), failures: z.array(z.string()) })
  .strict();

export interface RequestSegmentInput {
  sessionId: string;
  skillKey: string;
  difficulty: number;
  framing: string;
  rationale: string;
  /** v3: the KC this activity gathers evidence for — Core stamps provenance. */
  kcId?: string | null;
  /** v3: the controller strategy in force when it was requested. */
  strategy?: string | null;
  /**
   * A hint so the ladder can prefer a VISUAL catalog segment over its own
   * frontier fallback (ROADMAP.md V4 sprint 2 backlog). Best-effort — Core
   * still serves whatever it would have otherwise when nothing matches.
   */
  preferredTypes?: readonly string[] | null;
}

/**
 * Asks Core for the next activity through the content ladder (/ORACLE.md §7).
 *
 * Core owns tiers 1 and 2 because they are database reads, and it owns the
 * VERIFICATION of tier 3 because that means re-running the real graders. What
 * comes back is either a served segment or an invitation to generate one —
 * never an error for the ordinary case of "no pack exists yet", which is the
 * state most skills are in.
 *
 * `null` means the call itself failed. The caller must say so honestly rather
 * than improvising an activity.
 */
export async function requestSegment(
  input: RequestSegmentInput,
): Promise<ServedSegment | NeedsGeneration | null> {
  try {
    const body = await coreFetch('/tutor/internal/segments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(SegmentResponseSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

/**
 * Submits a generated candidate for verification and persistence.
 *
 * Oracle does not get to decide that its own output is good enough. Core runs
 * the deterministic gates and re-executes the answer key with the real
 * graders; only what survives is stored and served, and only what the key
 * re-execution confirmed can pay XP (/ORACLE.md §7.3, §8).
 */
export async function verifyGeneratedSegment(input: {
  sessionId: string;
  segment: Record<string, unknown>;
  provenance: Record<string, unknown>;
  kcId?: string | null;
  strategy?: string | null;
}): Promise<ServedSegment | null> {
  try {
    const body = await coreFetch('/tutor/internal/segments/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const rejected = Envelope(RejectedSchema).safeParse(body);
    if (rejected.success && rejected.data.data) {
      console.warn(`[oracle] Core rejected a generated segment: ${rejected.data.data.failures.join('; ')}`);
      return null;
    }
    const parsed = Envelope(ServedSegmentSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

const VoiceCheckResultSchema = z
  .object({
    checkable: z.boolean(),
    recognized: z.boolean(),
    value: z.number().optional(),
    correct: z.boolean().optional(),
    score: z.number().int().min(0).max(100).optional(),
    misconceptionCode: z.string().nullable().optional(),
    pKnownAfter: z.number().min(0).max(1).nullable().optional(),
  })
  .strict();

export type VoiceCheckResult = z.infer<typeof VoiceCheckResultSchema>;

/**
 * v3: deterministic verification of a SPOKEN answer against the open
 * activity's stored key. Core normalizes the words to a number and runs the
 * real grader; the LLM never judges correctness (/ORACLE.md, Tutor v3).
 *
 * `null` means the call failed — the caller proceeds as a plain conversation
 * turn, which is also what `recognized: false` means. Neither is ever a
 * wrong answer.
 */
export async function voiceCheck(input: {
  sessionId: string;
  segmentId: string;
  utterance: string;
  strategy?: string | null;
}): Promise<VoiceCheckResult | null> {
  try {
    const body = await coreFetch(
      `/tutor/internal/segments/${encodeURIComponent(input.segmentId)}/voice-check`,
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: input.sessionId,
          utterance: input.utterance,
          ...(input.strategy ? { strategy: input.strategy } : {}),
        }),
      },
    );
    const parsed = Envelope(VoiceCheckResultSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

/** Whether the learner's guardian consent is STILL active. Cheap, called per turn. */
/**
 * V4: persist what the post-session review learned. Core owns the caps and
 * the append-only ledger; a false return means "did not land", and the
 * caller's answer to that is the next session's review, never a retry loop.
 *
 * `expectedBefore` is THIS SESSION'S OWN belief — `learnerBrief.learner`/
 * `.pedagogy`, read at session START — not a value re-derived at write time.
 * Found by adversarial review, round 51 (2026-08-30, MEDIUM): Core's
 * memory write used to read the CURRENT row itself, immediately
 * before its own compare-and-swap call, and compare against THAT — which by
 * construction always matches whatever is currently stored (barring a
 * sub-second race), so the optimistic-concurrency check 0059 added could
 * never actually detect the realistic case, two whole SESSIONS overlapping
 * (this product's 2-per-day cap makes "two tabs at once" ordinary, not
 * contrived): session A writes first, then session B's own fresh read sees
 * A's write, "expects" exactly that, and silently overwrites it with content
 * computed from B's OWN much-earlier, now-stale belief — zero conflict
 * reported, indistinguishable from an uncontested write. Sending the belief
 * the CONTENT was actually computed from closes that gap: Core's compare now
 * runs against what THIS proposal is really built on, so B's write correctly
 * reports 'conflict' when A already moved the row out from under it.
 */
export async function updateLearnerMemory(input: {
  userId: string;
  sessionId: string | null;
  stores: { learner: string | null; pedagogy: string | null };
  expectedBefore: { learner: string | null; pedagogy: string | null };
}): Promise<boolean> {
  try {
    const body = await coreFetch('/tutor/internal/learner-memory', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ written: z.record(z.string(), z.boolean()) })).safeParse(body);
    if (!parsed.success || parsed.data.data === null) return false;
    /*
     * EVERY STORE ACTUALLY ASKED FOR, NOT JUST "DID THE ENVELOPE PARSE".
     *
     * Found by adversarial review, round 28 (2026-08-30, HIGH): Core answers
     * this call with a real 200 even when a per-store write fails — a null
     * store in `input.stores` means "nothing proposed for it" and is
     * correctly absent from `written` (Core's own route: `if (content ===
     * null) continue`), but a store that WAS proposed and failed to persist
     * (a PostgREST error) still comes back as an ordinary 200 with
     * `written: { learner: false, ... }`. This function used to check only
     * that the envelope parsed and `data` was non-null — true in BOTH cases
     * — so a genuine write failure was reported as success. The doc comment
     * above already promises "a false return means did not land"; this is
     * the only write function in this file that was not actually keeping
     * that promise (`persistTurn`/`persistSafetyFlag` check `.recorded`,
     * `closeSession` checks `.closed`). The caller (`session/review.ts`)
     * only logs and lets the NEXT session's review try again when this
     * returns false — silently returning true instead meant a curated
     * cross-session memory note could fail to land with no retry and no
     * warning, forever.
     */
    const written = parsed.data.data.written;
    const proposedStores = (Object.keys(input.stores) as (keyof typeof input.stores)[]).filter(
      (store) => input.stores[store] !== null,
    );
    return proposedStores.every((store) => written[store] === true);
  } catch {
    return false;
  }
}

/**
 * V4 episodic recall: literal excerpts from this learner's own past sessions.
 * Failure degrades to an empty list — recall garnishes a turn, never blocks one.
 *
 * `locale` is the CURRENT session's — the language the "¿te acuerdas...?" /
 * "do you remember...?" question was actually asked in — so the query text
 * is parsed with the matching Postgres text-search configuration. Found by
 * adversarial review, round 29 (2026-08-30, HIGH): the search used to
 * hardcode Spanish regardless of locale, and Postgres's Spanish stemmer
 * actively mistransforms English/Portuguese words rather than merely
 * leaving them unstemmed — `to_tsvector('spanish','remember')` and
 * `to_tsvector('spanish','remembered')` produce two DIFFERENT stems for the
 * same root, so a query built from one inflection could not find text
 * stored in another, breaking recall unpredictably for `en-US`/`pt-BR`
 * sessions. See `database/migrations/0056_recall_locale_aware_fts.sql`.
 */
export async function recallOwnHistory(
  userId: string,
  query: string,
  locale: Locale,
): Promise<{ speaker: string; turnText: string; saidAt: string }[]> {
  try {
    const body = await coreFetch(
      `/tutor/internal/recall?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`,
    );
    const parsed = Envelope(
      z.object({
        excerpts: z.array(
          z.object({ speaker: z.string(), turnText: z.string(), saidAt: z.string() }).loose(),
        ),
      }),
    ).safeParse(body);
    return parsed.success && parsed.data.data !== null ? parsed.data.data.excerpts : [];
  } catch {
    return [];
  }
}

export async function checkVoiceConsent(userId: string): Promise<boolean | null> {
  try {
    const body = await coreFetch(`/tutor/internal/consent/${encodeURIComponent(userId)}`);
    const parsed = Envelope(z.object({ active: z.boolean() })).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data.active;
  } catch {
    return null;
  }
}
