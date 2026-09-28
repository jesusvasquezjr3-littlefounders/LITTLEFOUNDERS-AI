import { z } from 'zod';
import { createHash } from 'node:crypto';
import { countServiceRows, serviceRest } from './supabaseRest.js';
import { telemetryColumns, type BehavioralTelemetryReport } from './pedagogy/behavioralTelemetry.js';

/*
 * The Tutor's data plane (migration 0047, /ORACLE.md).
 *
 * Everything here is SERVICE-ROLE, because every one of these tables has RLS
 * with no client write policy: clients read their own rows through PostgREST,
 * and every write goes through Core. That is the same posture course_placements
 * and the generation telemetry already use.
 *
 * The one rule that is not obvious from the code: there is nowhere in this file
 * to store a learner's audio, and that is deliberate rather than unfinished
 * (/ORACLE.md §0 decision 8). If a future change needs one, it needs a
 * migration, a legal review entry, and a conversation — not a column.
 */

const eu = (val: string) => encodeURIComponent(z.string().uuid().parse(val));
const es = (val: string) => encodeURIComponent(val);

export const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
export const DIORAMAS = ['diorama-a', 'diorama-b'] as const;
export const BACKDROPS = ['auto', 'dawn', 'day', 'dusk', 'night'] as const;
export const ADAPTATIONS = [
  'slower_pacing',
  'more_examples',
  'less_text',
  'more_visual',
  'repeat_before_advancing',
] as const;

export type CharacterId = (typeof CHARACTERS)[number];
export type Adaptation = (typeof ADAPTATIONS)[number];

// ── Preferences ─────────────────────────────────────────────────────────────

export interface TutorPreferencesRow {
  user_id: string;
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  backdrop: (typeof BACKDROPS)[number];
  nickname: string | null;
  adaptations: Adaptation[];
  updated_at: string;
}

/**
 * The stage a learner has chosen, or sensible defaults.
 *
 * Returns defaults for a learner who has never opened the picker, and `null`
 * only when the READ failed. Those are different states and the caller must be
 * able to tell them apart (§1.14) — "no row yet" is a first visit, "could not
 * read" is an outage, and answering the second with defaults would silently
 * discard a learner's chosen character every time PostgREST hiccuped.
 */
export async function getTutorPreferences(userId: string): Promise<TutorPreferencesRow | null> {
  const rows = await serviceRest<TutorPreferencesRow[]>(
    `/tutor_preferences?user_id=eq.${eu(userId)}&select=*`,
  );
  if (rows === null) return null;
  return (
    rows[0] ?? {
      user_id: userId,
      character: 'rho',
      companion: 'liruf',
      diorama: 'diorama-a',
      backdrop: 'auto',
      nickname: null,
      adaptations: [],
      updated_at: new Date(0).toISOString(),
    }
  );
}

export interface TutorPreferencesPatch {
  character?: CharacterId;
  companion?: CharacterId | null;
  diorama?: string;
  backdrop?: (typeof BACKDROPS)[number];
  nickname?: string | null;
  adaptations?: Adaptation[];
}

export async function upsertTutorPreferences(
  userId: string,
  patch: TutorPreferencesPatch,
): Promise<boolean> {
  const res = await serviceRest<unknown>('/tutor_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, ...patch, updated_at: new Date().toISOString() }),
  });
  return res !== null;
}

// ── Voice consent ───────────────────────────────────────────────────────────

export interface VoiceConsentRow {
  id: string;
  user_id: string;
  /** NULL once the granting guardian's account was erased (E.6); the consent was ended at that moment. */
  granted_by: string | null;
  consent_text: string;
  locale: string;
  granted_at: string;
  revoked_at: string | null;
}

/**
 * The active consent row, or `null` if there is none — and `undefined`-shaped
 * failure is represented by throwing, not by a third return value, because a
 * caller that treats "read failed" as "no consent" merely blocks a microphone
 * (safe), while one that treats it as "consent exists" opens one (not safe).
 * Returning null on failure is therefore the SAFE default here, and this is
 * the one place in the service where collapsing the two is correct.
 */
export async function getActiveVoiceConsent(userId: string): Promise<VoiceConsentRow | null> {
  const rows = await serviceRest<VoiceConsentRow[]>(
    `/tutor_voice_consent?user_id=eq.${eu(userId)}&scope=eq.tutor_voice&revoked_at=is.null&select=*&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function grantVoiceConsent(input: {
  userId: string;
  grantedBy: string;
  consentText: string;
  locale: string;
}): Promise<VoiceConsentRow | null> {
  const existing = await getActiveVoiceConsent(input.userId);
  if (existing) return existing;
  const rows = await serviceRest<VoiceConsentRow[]>('/tutor_voice_consent', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: input.userId,
      granted_by: input.grantedBy,
      scope: 'tutor_voice',
      consent_text: input.consentText,
      locale: input.locale,
    }),
  });
  if (rows?.[0]) return rows[0];
  /*
   * THE INSERT FAILED — BUT A CONCURRENT GRANT COULD HAVE WON THE RACE
   * between the `existing` check above and this insert. Found by
   * adversarial review, round 30 (2026-08-30, LOW): this is check-then-
   * insert across two round trips, not one transaction, and the partial
   * unique index (`idx_tutor_voice_consent_live`, migration 0047) makes
   * this a REAL race, not a hypothetical — two devices/tabs granting for
   * the same child at once both pass the `existing` check (neither sees
   * the other's row yet), and the SECOND insert is refused by the DB's own
   * constraint, which `serviceRest` collapses to `null` indistinguishably
   * from a genuine outage. The index guarantees data integrity either way
   * — two live rows can never exist — so re-checking here only fixes what
   * the LOSER of the race is TOLD: "consent is active" (true, and for the
   * exact same child) instead of a misleading `DATA_UNAVAILABLE`.
   */
  return getActiveVoiceConsent(input.userId);
}

/** Closes the live consent row. The row is kept — "was consent active on date X" must stay answerable. */
export async function revokeVoiceConsent(userId: string, revokedBy: string): Promise<boolean> {
  const res = await serviceRest<unknown>(
    `/tutor_voice_consent?user_id=eq.${eu(userId)}&scope=eq.tutor_voice&revoked_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked_at: new Date().toISOString(), revoked_by: revokedBy }),
    },
  );
  return res !== null;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export type TutorIntent = 'course_topic' | 'weak_skill' | 'faq' | 'open' | 'diagnostic';

export interface TutorSessionRow {
  id: string;
  user_id: string;
  locale: string;
  tier: number;
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  intent: TutorIntent;
  course_id: string | null;
  topic_id: string | null;
  skill_key: string | null;
  voice_used: boolean;
  consent_id: string | null;
  started_at: string;
  ended_at: string | null;
  close_reason: string | null;
  turn_count: number;
  segment_count: number;
  xp_awarded: number;
  cost_usd: number;
  /** The cross-session memory digest, written at close (migration 0051). */
  summary: SessionSummaryDigest | null;
}

/**
 * The digest one closed session leaves for the next (/ORACLE.md §4.1, owner
 * sign-off 2026-08-28). STRICTLY topic/skills/outcome/counters — computing it
 * from transcript text is forbidden, because this object is what the next
 * session's model context is allowed to carry. The course/topic ids stay
 * internal (the offers screen uses them to rebuild a "continue" opening);
 * only the title and the skill keys ever reach a model.
 */
export interface SessionSummaryDigest {
  topic: string | null;
  courseId: string | null;
  topicId: string | null;
  skillKeys: string[];
  outcome: 'completed' | 'left' | 'stopped';
  gradedCorrect: number;
  gradedTotal: number;
}

export interface CreateSessionInput {
  userId: string;
  locale: string;
  tier: number;
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  intent: TutorIntent;
  courseId: string | null;
  topicId: string | null;
  skillKey: string | null;
  voiceUsed: boolean;
  consentId: string | null;
}

/**
 * The result of an attempted session start against the daily cap.
 *
 * `null` on a transport/RPC failure — the caller must refuse rather than
 * assume the cap was or was not reached (§1.14): a failed call collapsed
 * into "cap reached" would wrongly turn away a learner who never actually
 * used their sessions, and collapsed into "created" would be worse.
 */
export type StartSessionResult = { status: 'created'; session: TutorSessionRow } | { status: 'cap_reached' };

/**
 * Creates a session, ATOMICALLY checked against the learner's daily cap.
 *
 * Found by adversarial review, round 34 (2026-08-30, HIGH): the previous
 * shape was a plain application-level read-then-write — count "sessions
 * today" via a separate query, compare to the cap in JS, then create the
 * session with a SEPARATE, unconditional INSERT. Two concurrent
 * session-creation requests for the same learner (a double-tap, a
 * flaky-connection retry, two open tabs) both read the same stale count
 * before either insert landed, so both independently believed a slot was
 * free and both created a session — and unlike the daily XP cap
 * (`awardTutorXp`, same fix shape) or voice consent (a partial unique
 * index), `tutor_sessions` carried no per-day uniqueness constraint at all,
 * so this did not just mislabel an error under a race, it actually
 * defeated the cap.
 *
 * `start_tutor_session_checked` (migration 0057) does the count, the cap
 * comparison and the insert inside ONE Postgres function, serialized with
 * an advisory lock keyed on the learner. An empty result set means the cap
 * was reached and nothing was inserted; staff exemption stays in the
 * CALLER, which passes an effectively unlimited `cap` for staff rather
 * than maintaining a second, unchecked insert path.
 */
export async function startTutorSessionChecked(
  input: CreateSessionInput & { sinceIso: string; cap: number },
): Promise<StartSessionResult | null> {
  const rows = await serviceRest<TutorSessionRow[]>('/rpc/start_tutor_session_checked', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: input.userId,
      p_since: input.sinceIso,
      p_cap: input.cap,
      p_locale: input.locale,
      p_tier: input.tier,
      p_character: input.character,
      p_companion: input.companion,
      p_diorama: input.diorama,
      p_intent: input.intent,
      p_course_id: input.courseId,
      p_topic_id: input.topicId,
      p_skill_key: input.skillKey,
      p_voice_used: input.voiceUsed,
      p_consent_id: input.consentId,
    }),
  });
  if (rows === null) return null;
  return rows.length > 0 ? { status: 'created', session: rows[0]! } : { status: 'cap_reached' };
}

export async function getTutorSession(sessionId: string): Promise<TutorSessionRow | null> {
  const rows = await serviceRest<TutorSessionRow[]>(`/tutor_sessions?id=eq.${eu(sessionId)}&select=*`);
  return rows?.[0] ?? null;
}

export interface TutorSessionsPage {
  sessions: TutorSessionRow[];
  /** True when at least one more session exists past this page's `offset + limit`. */
  hasMore: boolean;
}

/**
 * Newest-first, paginated (/ORACLE.md §12, guardian visibility).
 *
 * Found by adversarial review, round 110 (2026-08-31, MEDIUM,
 * guardian-dashboard-depth): this hardcoded `limit=30` with no `offset` at
 * all, so nothing upstream could EVER ask for session #31 — a family that
 * did not open the Tutor page in the last ~30 sessions lost UI access to
 * every older, non-flagged one, even though the row is still there and
 * still inside the 90-day retention window (§1.9). `limit`/`offset` follow
 * the same convention `listAudit` already established in `adminData.ts`.
 * `hasMore` is derived by requesting one row past `limit` rather than a
 * second exact COUNT query — cheaper for a list this size, and it never
 * needs to be exact, only "is there at least one more".
 */
export async function listTutorSessions(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<TutorSessionsPage | null> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const rows = await serviceRest<TutorSessionRow[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&select=*&order=started_at.desc&limit=${limit + 1}&offset=${offset}`,
  );
  if (rows === null) return null;
  const hasMore = rows.length > limit;
  return { sessions: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

/**
 * `'closed'` — this call's own write was the one that landed.
 * `'already-closed'` — the `ended_at=is.null` filter matched ZERO rows: some
 * other close (almost always `finalizeParked`, racing a busy turn past
 * `SESSION_RESUME_GRACE_MS`) already landed first, and this call's
 * `closeReason`/`costUsd` were NOT persisted.
 * `'failed'` — the HTTP call itself failed (network, parse, non-2xx).
 */
export type CloseTutorSessionOutcome = 'closed' | 'already-closed' | 'failed';

/**
 * Closes a session — but "closed" and "somebody already closed it" are not
 * the same outcome, and `Prefer: return=minimal` used to make them
 * indistinguishable: a 204 with an empty body comes back whether the
 * `ended_at=is.null` filter matched the one row this call meant to close, or
 * matched nothing because a previous call already had. `res !== null` was
 * `true` either way, so the caller (the `/sessions/:id/close` route) reported
 * success on a write that never happened.
 *
 * Found by adversarial review, round 98 (2026-08-31, MEDIUM,
 * tutor-review-sweep-92): `oracle/src/ws/server.ts`'s `finish()` calls this
 * unconditionally once a busy turn it was waiting on finally clears the
 * floor, and never checked what came back. When `finalizeParked`'s own
 * `SESSION_RESUME_GRACE_MS` timer wins the race — reachable because a busy
 * turn's own retries and tier-3 generation chain can, on their own, already
 * approach or exceed that window, with no farewell slowness involved at all
 * (`farewell()` is a fully scripted turn with no model call) — the session is
 * already recorded `learner_left` with whatever cost existed at that
 * mid-turn moment by the time `finish()`'s own `completed` close arrives.
 * That second write matched zero rows and was silently reported as a
 * success: the more accurate close reason and the turn's true final cost
 * were discarded with no trace anywhere. Exactly the §1.14 "failure
 * collapsed into emptiness" shape.
 *
 * `Prefer: return=representation` is what makes the two cases visible: an
 * empty array is a real, honest "matched nothing"; a one-row array is a real
 * update. See `RUNBOOK.md` Round 98.
 */

/**
 * How many sessions this learner has already started since `sinceIso`, or
 * `null` on a read failure.
 *
 * Found by adversarial review, round 99 (2026-08-31, HIGH): `GET /offers`
 * had no way to tell the offer screen the learner's daily cap was already
 * spent — its `canStart`/`startBlockedBy` fields reflected only Oracle's own
 * health, never `MAX_SESSIONS_PER_DAY`, so a learner who had used every
 * session today saw the identical inviting screen as one who had used none,
 * discovering the refusal only after tapping an opening and having `POST
 * /sessions` bounce them with `SESSION_LIMIT`.
 *
 * This is the SAME predicate `start_tutor_session_checked` (migration 0057)
 * evaluates inside its own advisory-locked transaction — `user_id = X AND
 * started_at >= since` — read here through PostgREST's own exact-count
 * idiom (`countServiceRows`, already used for follower counts and admin
 * dashboards) rather than a second SQL function, so there is exactly one
 * definition of "sessions today" for the two call sites to agree on. This
 * read is advisory only and never what ENFORCES the cap — that stays
 * atomic, inside the SQL function, at session-start time — it only lets the
 * offer screen say so honestly before a learner taps in and gets bounced.
 * `null` on failure is deliberate (§1.14): this is a display-only read, so
 * the caller may treat "unknown" as "not reached" rather than collapsing a
 * transient PostgREST failure into a false, and much worse, "cap reached".
 */
export function countTutorSessionsSince(userId: string, sinceIso: string): Promise<number | null> {
  return countServiceRows(`/tutor_sessions?user_id=eq.${eu(userId)}&started_at=gte.${es(sinceIso)}&select=id`);
}

export async function closeTutorSession(input: {
  sessionId: string;
  closeReason: string;
  turnCount: number;
  segmentCount: number;
  costUsd: number;
  /** C.16: the closing script Oracle used (omitted by an older Oracle). */
  closingScript?: string;
  /** C.16: the opening the session began with. */
  opening?: string;
  /** C.8/C.12: whether the session-end signal was evaluated at all. */
  endSignal?: { evaluated: boolean };
  /** C.9/C.19: how the Behavioral Telemetry Layer ran (absent while it was off). */
  behavioralTelemetry?: BehavioralTelemetryReport;
}): Promise<CloseTutorSessionOutcome> {
  const rows = await serviceRest<{ id: string }[]>(`/tutor_sessions?id=eq.${eu(input.sessionId)}&ended_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      ended_at: new Date().toISOString(),
      close_reason: input.closeReason,
      turn_count: input.turnCount,
      segment_count: input.segmentCount,
      cost_usd: input.costUsd,
      // Only named when reported, so a close from an older Oracle writes
      // exactly the columns it always did.
      ...(input.closingScript !== undefined ? { closing_script: input.closingScript } : {}),
      ...(input.opening !== undefined ? { opening: input.opening } : {}),
      ...(input.endSignal !== undefined ? { end_signal_evaluated: input.endSignal.evaluated } : {}),
      ...telemetryColumns(input.behavioralTelemetry),
    }),
  });
  if (rows === null) return 'failed';
  return rows.length > 0 ? 'closed' : 'already-closed';
}

/**
 * Adds a real, already-spent amount to a session's recorded cost.
 *
 * For the paid calls a session causes but does not finish paying for before
 * `closeTutorSession` writes `cost_usd` — today exactly one, the post-session
 * review's own model call (`oracle/src/session/review.ts`), which Oracle fires
 * fire-and-forget AFTER the close in both its close paths. Round 64 fixed the
 * same class for tier-3 generation, but that cost happens DURING the session,
 * so folding it into the orchestrator's running total was enough; there is no
 * running total left by the time this one is known.
 *
 * ADDITION IN POSTGRES, NOT HERE (migration `0062`). PostgREST can only PATCH
 * a literal, so doing this in application code would mean read-add-write —
 * the §1.14 shape that erased a child's XP behind a 200, and the shape
 * migrations 0055/0057/0059 have each already moved into the database.
 *
 * Returns the session's NEW total, or `null` when nothing was added (no such
 * session, a non-positive amount, or the call failed) — never a zero that a
 * caller could read as "recorded".
 */
export async function addTutorSessionCost(sessionId: string, costUsd: number): Promise<number | null> {
  const total = await serviceRest<number | null>('/rpc/add_tutor_session_cost', {
    method: 'POST',
    body: JSON.stringify({ p_session_id: sessionId, p_amount: costUsd }),
  });
  return typeof total === 'number' ? total : null;
}

/** Writes the memory digest onto a session that has already closed. */
export async function setSessionSummary(
  sessionId: string,
  summary: SessionSummaryDigest,
): Promise<boolean> {
  const res = await serviceRest<unknown>(`/tutor_sessions?id=eq.${eu(sessionId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ summary }),
  });
  return res !== null;
}

/**
 * The learner's most recent closed sessions THAT LEFT A DIGEST, newest first.
 * Only what the memory feature needs travels out of here: the digest and when
 * the session ended.
 */
/*
 * ─── V4 learner memory (0053) ────────────────────────────────────────────────
 *
 * Two curated prose stores per learner — LEARNER (who this child is) and
 * PEDAGOGY (what teaching works with them) — written by the post-session
 * review and injected into every session as the learner brief. The hard
 * character limits live in the schema; this layer only moves the text.
 */

export interface LearnerBrief {
  learner: string | null;
  pedagogy: string | null;
}

/**
 * `null` means the READ ITSELF failed (a transient `serviceRest` error) —
 * distinct from a real, successful query that simply found no rows yet.
 *
 * Found by adversarial review, round 28 (2026-08-30, HIGH): this used to
 * collapse both into the same `{ learner: null, pedagogy: null }` shape via
 * `rows ?? []`, throwing away the one signal (`serviceRest` returning `null`
 * specifically on failure, vs. a real `[]`) that tells them apart. The
 * caller injects this into the session as `learnerBrief`, and
 * `session/review.ts`'s post-session write treats an empty brief as "this
 * learner never had memory" and proposes a note "from scratch" — which then
 * REPLACES whatever real, accumulated memory existed. A transient read
 * failure on session N+1 could silently and permanently erase everything
 * sessions 1..N wrote, the exact §1.14 failure-must-be-distinguishable-from-
 * emptiness shape this file's own header already names for
 * `getLearningStatsForUpdate`. The route now threads this through as
 * `learnerBriefDegraded`, and `session/review.ts` refuses to run the write
 * at all when it is true, rather than writing over real data based on a
 * false "empty" premise.
 */
export async function getLearnerMemory(userId: string): Promise<LearnerBrief | null> {
  const rows = await serviceRest<{ store: string; content: string }[]>(
    `/learner_memory?user_id=eq.${eu(userId)}&select=store,content`,
  );
  if (rows === null) return null;
  const byStore = new Map(rows.map((r) => [r.store, r.content]));
  return {
    learner: byStore.get('learner') ?? null,
    pedagogy: byStore.get('pedagogy') ?? null,
  };
}

/**
 * Write BOTH memory stores and their ledger rows, ATOMICALLY — the two
 * compare-and-swaps and the two ledger rows are one Postgres call, so they
 * are one transaction.
 *
 * Found by adversarial review, round 42 (2026-08-30, MEDIUM/HIGH): this used
 * to be a plain read-then-write — GET the current content, then an
 * unconditional upsert — with nothing checking the row was still in the
 * state that was just read. Two concurrent calls for the SAME (user_id,
 * store) — the documented "dropped connection, 90s park window, quick
 * reopen" case this codebase already names elsewhere as plausibly common —
 * both read the same stale content before either write landed, each folds
 * in a DIFFERENT real observation, and whichever write lands last wins
 * outright: the other call's genuine update is silently discarded, with
 * both calls reporting success identically. Reproduced: two concurrent
 * calls off the same "before," both returned `true`, and the final stored
 * content reflected only one of them.
 *
 * `write_learner_memory_checked` (migration 0059) moves the compare and the
 * write into ONE function, serialized with a Postgres advisory lock keyed on
 * the learner — the same shape `award_tutor_xp` (migration 0055) already
 * uses for a different race, adapted for compare-and-swap instead of
 * recompute-from-source (the new CONTENT here comes from a model call that
 * cannot run inside Postgres, so the write must instead refuse when what it
 * read a moment ago no longer matches). Returns `false` for BOTH a genuine
 * transport failure and a detected conflict — the caller (Oracle's
 * post-session review) already treats `false` as "did not advance, will try
 * again next session," which is correct for either cause — but the two are
 * logged distinctly here, where the conflict is actually visible, so an
 * operator can tell a race from an outage.
 *
 * This closed the race at a SINGLE CALL's own read-write boundary — the
 * function's own comment used to admit it could not, "without a larger
 * cross-service change," protect the wider case where two whole SESSIONS
 * overlap and each one's model proposal was computed from a belief read at
 * session START, minutes before either write. That "larger change" is
 * exactly what closes it now (round 51, 2026-08-30, MEDIUM): this function
 * no longer reads the CURRENT row itself to invent an "expected before" —
 * doing that meant comparing the row against a value read moments before the
 * compare, which by construction always matches (the compare-and-swap could
 * only ever catch two calls landing within the same network round trip).
 * `expectedBefore` now comes from the CALLER — Oracle's `learnerBrief`,
 * fetched at session start, the actual belief `content` was computed from —
 * so two overlapping sessions' proposals are compared against what each one
 * genuinely started from, and the loser correctly reports 'conflict'.
 *
 * ROUND 61 (2026-08-30, MEDIUM — deferred that round, closed here as round
 * 75) then found the remaining gap, and it was on the READ side. Both of the
 * fixes above make ONE store's write correct; this route writes TWO. It used
 * to do that by looping and awaiting `writeLearnerMemory` once per store —
 * two PostgREST calls, so two transactions, with a real network-sized window
 * between the first COMMIT and the second. `getLearnerMemory`, run at the
 * START of the next session for the same learner and by the guardian dossier
 * view, could land in that window and read a TORN pair: the brand-new learner
 * note beside the pedagogy note the same review had already decided to
 * replace. Reproduced by holding the `pedagogy` call open on a
 * manually-resolved promise while the `learner` call completed and a
 * concurrent read ran — it returned `{ learner: 'NEW…', pedagogy: 'OLD…' }`.
 * It self-corrects the moment the second write lands and never crosses
 * learners, which is why it is MEDIUM; what makes it worth closing is that
 * the pair IS the next session's model prompt, and that session's own review
 * then writes its next proposal back down from it.
 *
 * `write_learner_memory_pair_checked` (migration 0061) takes both proposals
 * in ONE call. It is a thin wrapper that calls 0059's function twice — a
 * plpgsql function runs inside its caller's transaction, so that alone is the
 * whole fix, and it keeps ONE copy of the compare-and-swap, the verdict
 * vocabulary and the ledger insert rather than a second copy to drift.
 * `getLearnerMemory` reads both rows in a SINGLE statement, so it sees one
 * snapshot and therefore either both-before or both-after; splitting that
 * read into two SELECTs would reopen the same window from the other side.
 *
 * Per-store semantics are deliberately unchanged: each store is still judged
 * against its OWN `expectedBefore`, a store whose row moved under it still
 * reports 'conflict' and is still not written, and the other store still
 * lands. Only the VISIBILITY changed — the writes commit together. The
 * returned map carries one entry per store actually PROPOSED (a `null`
 * proposal means the review had nothing to say about that store, never "erase
 * it"), which is the same shape the route's own per-store loop produced and
 * the shape Oracle's `updateLearnerMemory` already checks store by store.
 */
export async function writeLearnerMemoryPair(input: {
  userId: string;
  stores: { learner: string | null; pedagogy: string | null };
  expectedBefore: { learner: string | null; pedagogy: string | null };
  actor: string;
  sessionId: string | null;
}): Promise<Partial<Record<'learner' | 'pedagogy', boolean>>> {
  const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
  const proposed = (['learner', 'pedagogy'] as const).filter((store) => input.stores[store] !== null);
  if (proposed.length === 0) return {};

  const outcomes = await serviceRest<Partial<Record<'learner' | 'pedagogy', string>>>(
    '/rpc/write_learner_memory_pair_checked',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: input.userId,
        p_learner_expected: input.expectedBefore.learner,
        p_learner_new: input.stores.learner,
        p_learner_before_hash:
          input.expectedBefore.learner === null ? null : sha(input.expectedBefore.learner),
        p_learner_after_hash: input.stores.learner === null ? null : sha(input.stores.learner),
        p_pedagogy_expected: input.expectedBefore.pedagogy,
        p_pedagogy_new: input.stores.pedagogy,
        p_pedagogy_before_hash:
          input.expectedBefore.pedagogy === null ? null : sha(input.expectedBefore.pedagogy),
        p_pedagogy_after_hash: input.stores.pedagogy === null ? null : sha(input.stores.pedagogy),
        p_actor: input.actor,
        p_session_id: input.sessionId,
      }),
    },
  );

  /*
   * A transport failure is reported as "no proposed store landed" rather than
   * as an empty map: an absent key means "nothing was proposed for that
   * store" to every caller here, so collapsing a failed call into one would
   * read as success (§1.14 — failure must be distinguishable from emptiness).
   * The same reasoning covers a verdict this layer does not recognise: only
   * the two the function documents count as landed.
   */
  const written: Partial<Record<'learner' | 'pedagogy', boolean>> = {};
  for (const store of proposed) {
    const outcome = outcomes === null ? null : outcomes[store];
    if (outcome === 'conflict') {
      console.warn(
        `[tutor] learner_memory write for user ${input.userId} store ${store} lost a concurrent write race — dropped, not overwritten`,
      );
    }
    written[store] = outcome === 'written' || outcome === 'unchanged';
  }
  return written;
}

/*
 * ─── THE MEMORY-NOTE REVIEW GATE (migrations 0068 and memory_proposal_store) ─
 *
 * `learner_memory` auto-wrote both stores for every learner. 0068 gated the
 * LEARNER store for a `kid`: its proposal parks as a pending row a verified
 * guardian decides on. C.4 and OD-18 then made the gate cover BOTH notes
 * (the learner note and the pedagogy note are the SPEC's two memory notes,
 * both model-written prose about the same child), for every reviewer the
 * route resolves: a verified guardian, or an independent teen reviewing
 * their own notes. Only a screened adult's notes still write directly.
 *
 * Nothing here re-implements the write. An approval goes through
 * `write_learner_memory_checked` (0059) for the proposal's own store — the
 * same function 0061's pair wrapper calls — so the compare-and-swap, the
 * verdict vocabulary and the append-only `learner_memory_ledger` row are
 * literally the same code for a gated write and an ungated one.
 */

export type MemoryStore = 'learner' | 'pedagogy';

/** A parked memory-note proposal awaiting its reviewer's decision. */
export interface LearnerMemoryProposalRow {
  id: string;
  user_id: string;
  /** Which note the proposal replaces (memory_proposal_store; 'learner' on every older row). */
  store: MemoryStore;
  proposed: string;
  expected_before: string | null;
  session_id: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

const PROPOSAL_COLUMNS =
  'id,user_id,store,proposed,expected_before,session_id,status,decided_by,decided_at,created_at';

/**
 * Park one proposal PER STORE for review instead of applying them.
 *
 * All rows go in ONE insert (a PostgREST array body is one statement), so a
 * review that proposed both notes never parks one and loses the other.
 *
 * The hashes are computed HERE, with the same `sha256` helper every ledger row
 * already uses, and carried on the row — so when the proposal is later
 * approved, the ledger entry it produces is byte-identical in shape to an
 * ungated write's.
 *
 * Returns false on ANY failure. The caller must refuse the whole request on
 * false rather than continuing: a parked proposal that silently failed to land
 * is a child's note that vanished, reported to Oracle as success (§1.14).
 */
export async function parkLearnerMemoryProposal(input: {
  userId: string;
  sessionId: string | null;
  proposals: ReadonlyArray<{ store: MemoryStore; proposed: string; expectedBefore: string | null }>;
}): Promise<boolean> {
  if (input.proposals.length === 0) return true;
  const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
  const res = await serviceRest<unknown>('/learner_memory_proposals', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(
      input.proposals.map((proposal) => ({
        user_id: input.userId,
        store: proposal.store,
        proposed: proposal.proposed,
        expected_before: proposal.expectedBefore,
        before_hash: proposal.expectedBefore === null ? null : sha(proposal.expectedBefore),
        after_hash: sha(proposal.proposed),
        session_id: input.sessionId,
      })),
    ),
  });
  return res !== null;
}

/**
 * One learner's still-undecided proposals, oldest first — the guardian queue.
 * `null` is a read failure and never an empty queue: the portal has to be able
 * to say "we could not load this" instead of "there is nothing to review",
 * which is the same claim with the opposite meaning for a parent.
 */
export async function listPendingLearnerMemoryProposals(
  userId: string,
  limit = 50,
): Promise<LearnerMemoryProposalRow[] | null> {
  return serviceRest<LearnerMemoryProposalRow[]>(
    `/learner_memory_proposals?user_id=eq.${eu(userId)}&status=eq.pending` +
      `&select=${PROPOSAL_COLUMNS}&order=created_at.asc&limit=${Math.min(limit, 200)}`,
  );
}

/**
 * One proposal by id, for the AUTHORIZATION step — the route has to learn
 * WHOSE note this is before it can ask whether the caller is that child's
 * verified guardian. `undefined` is "no such row", `null` is "the read
 * failed"; a route that collapses them answers 404 to an outage.
 */
export async function getLearnerMemoryProposal(
  proposalId: string,
): Promise<LearnerMemoryProposalRow | null | undefined> {
  const rows = await serviceRest<LearnerMemoryProposalRow[]>(
    `/learner_memory_proposals?id=eq.${eu(proposalId)}&select=${PROPOSAL_COLUMNS}`,
  );
  if (rows === null) return null;
  return rows[0];
}

/**
 * The guardian's verdict — the claim and the apply in ONE transaction
 * (migration 0068). The function answers with a word, not a boolean, and each
 * one means something the guardian has to be told apart from the others:
 *
 *   'written' / 'unchanged'  approved, and the store now holds the note.
 *   'rejected'               closed, the store did not move.
 *   'conflict'               the store moved since this note was written, so
 *                            nothing was applied and the row STAYS PENDING.
 *   'not_pending'            already decided by someone (or something) else.
 *
 * `null` is a transport failure and is deliberately NOT folded into any of
 * them: "we could not reach the database" and "your approval was refused
 * because the note is stale" are different sentences for a parent (§1.14).
 */
export type LearnerMemoryDecisionOutcome =
  | 'written'
  | 'unchanged'
  | 'rejected'
  | 'conflict'
  | 'not_pending';

const DECISION_OUTCOMES: readonly string[] = [
  'written',
  'unchanged',
  'rejected',
  'conflict',
  'not_pending',
];

export async function decideLearnerMemoryProposal(input: {
  proposalId: string;
  decidedBy: string;
  verdict: 'approved' | 'rejected';
  /**
   * The ledger's `actor` for an approved note. Deliberately different from
   * `oracle-post-session-review`: reading the ledger back, a guardian-
   * approved write and an auto-write must not look the same. OD-18 (C.4,
   * 2026-09-24) adds a THIRD stamp — `learner-self-approved-review` — so a
   * self-approved note can be told apart from a guardian-approved one too.
   * Defaults to the guardian stamp: every caller today is either a guardian
   * decision or the teen self-review path, and the route decides which.
   */
  actor?: string;
}): Promise<LearnerMemoryDecisionOutcome | null> {
  const outcome = await serviceRest<string>('/rpc/decide_learner_memory_proposal', {
    method: 'POST',
    body: JSON.stringify({
      p_proposal_id: input.proposalId,
      p_decided_by: input.decidedBy,
      p_verdict: input.verdict,
      p_actor: input.actor ?? 'guardian-approved-review',
    }),
  });
  // A word this layer does not recognise is a failure, not a success. The
  // function's vocabulary is closed; anything else means the two sides have
  // drifted, and guessing which way is how a rejection becomes an approval.
  if (outcome === null || !DECISION_OUTCOMES.includes(outcome)) return null;
  return outcome as LearnerMemoryDecisionOutcome;
}

/**
 * Episodic recall: literal excerpts from this learner's own past sessions.
 * ~20 ms of GIN index, zero model cost — the only memory cheap enough for
 * the conversation clock.
 *
 * `locale` picks the Postgres text-search configuration the QUERY text is
 * parsed with — the language the recall question was actually asked in.
 * Found by adversarial review, round 29 (2026-08-30, HIGH): this used to
 * hardcode Spanish (`database/migrations/0053_learner_memory.sql`'s
 * default), and Postgres's Spanish stemmer mistransforms English/
 * Portuguese words rather than merely leaving them unstemmed, breaking
 * recall unpredictably for `en-US`/`pt-BR` sessions. Defaults to `es-MX`
 * so an OLDER caller that has not been updated to send it yet keeps
 * today's (correct-for-Spanish) behaviour — see
 * `database/migrations/0056_recall_locale_aware_fts.sql`.
 */
export async function searchOwnTurns(
  userId: string,
  query: string,
  limit = 3,
  locale: 'en-US' | 'es-MX' | 'pt-BR' = 'es-MX',
): Promise<{ speaker: string; turnText: string; saidAt: string }[]> {
  const rows = await serviceRest<
    { speaker: string; turn_text: string; said_at: string }[]
  >(`/rpc/search_tutor_turns`, {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_query: query, p_limit: limit, p_locale: locale }),
  });
  return (rows ?? []).map((r) => ({ speaker: r.speaker, turnText: r.turn_text, saidAt: r.said_at }));
}

export async function listRecentSummaries(
  userId: string,
  excludeSessionId: string | null = null,
  limit = 3,
): Promise<{ summary: SessionSummaryDigest; ended_at: string }[] | null> {
  const exclude = excludeSessionId ? `&id=neq.${eu(excludeSessionId)}` : '';
  const rows = await serviceRest<{ summary: SessionSummaryDigest | null; ended_at: string | null }[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&summary=not.is.null&ended_at=not.is.null${exclude}` +
      `&select=summary,ended_at&order=ended_at.desc&limit=${Math.min(limit, 10)}`,
  );
  if (rows === null) return null;
  return rows.filter((r): r is { summary: SessionSummaryDigest; ended_at: string } =>
    Boolean(r.summary && r.ended_at),
  );
}

/**
 * Credits XP against the learner's own daily cap, ATOMICALLY.
 *
 * Found by adversarial review, 2026-08-30 (CRITICAL): the previous shape was
 * a plain application-level read-then-write — read "earned today" via a
 * separate query, compute `min(requested, cap - earnedToday)` in JS, write it
 * with an unconditional PATCH. Two concurrent grade requests for the SAME
 * learner (a fast learner clearing two segments back-to-back, a retried
 * request, two open tabs) both read the same stale total before either write
 * landed, so both spent the full remaining cap. Core has no documented
 * single-replica constraint (unlike Oracle — oracle/AGENTS.md), so an
 * in-process lock cannot close this under horizontal scaling, and the cap
 * spans every `tutor_sessions` row for a user on a given day, which a
 * row-level conditional PATCH (the `ended_at=is.null` pattern
 * `closeTutorSession` uses) cannot express across a multi-row aggregate.
 *
 * `award_tutor_xp` (migration 0055) does the read, the cap arithmetic and the
 * write inside ONE Postgres function, serialized with an advisory lock keyed
 * on the learner — correct under any number of Core replicas, because the
 * lock lives in the database. Returns the amount ACTUALLY awarded (may be
 * less than requested, or zero, once the cap is reached) — never null on
 * success, matching `award_tutor_xp`'s own `RETURNS int` (never NULL). A
 * `null` return here means the call itself failed, and the caller must
 * refuse rather than assume zero was credited (§1.14) — treating a failed
 * write as "nothing happened" would be indistinguishable from the very
 * silent-loss bug this file's `closeTutorSession` comment already warns
 * against, on the same table.
 */
export async function awardTutorXp(input: {
  sessionId: string;
  userId: string;
  sinceIso: string;
  cap: number;
  requested: number;
}): Promise<number | null> {
  if (input.requested <= 0) return 0;
  const res = await serviceRest<number>('/rpc/award_tutor_xp', {
    method: 'POST',
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_user_id: input.userId,
      p_since: input.sinceIso,
      p_cap: input.cap,
      p_requested: input.requested,
    }),
  });
  return typeof res === 'number' ? res : null;
}

// ── Turns ───────────────────────────────────────────────────────────────────

/**
 * V4's live sequence board, exactly as it was shown — the server-computed
 * `values`, never recomputed. Mirrors `oracle/src/ws/protocol.ts`'s
 * `WireSequenceBoard`; the two packages share no types, so the shape is
 * duplicated deliberately rather than imported.
 */
export interface TutorTurnSequenceBoard {
  kind: 'sequence';
  start: number;
  steps: { op: 'add' | 'subtract' | 'multiply_percent'; value: number }[];
  unit: 'day' | 'week' | 'month' | 'year';
  values: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/**
 * A live comparison between two named things, exactly as it was shown.
 * Mirrors `oracle/src/ws/protocol.ts`'s `WireWhiteboard`'s `compare` member.
 *
 * Found missing entirely during the `categories` merge (2026-09-01):
 * `compare`/`marked_line` shipped (ORACLE.md §20.5's "Two more kinds")
 * without ever gaining a persistence type or read-time re-validation branch
 * here — so a live `compare`/`marked_line` turn would have failed
 * `TutorTurnWhiteboardRowSchema` below and lost its board silently on
 * replay, the exact round-35 class this file's own header comment warns
 * about, for a kind added without the matching backend update.
 */
export interface TutorTurnCompareBoard {
  kind: 'compare';
  left: { label: string; value: number };
  right: { label: string; value: number };
  difference: number;
  greater: 'left' | 'right' | 'tie';
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/**
 * A live value placed on a line between two references, exactly as it was
 * shown. Mirrors `oracle/src/ws/protocol.ts`'s `WireWhiteboard`'s
 * `marked_line` member. See `TutorTurnCompareBoard`'s own comment above.
 */
export interface TutorTurnMarkedLineBoard {
  kind: 'marked_line';
  min: number;
  max: number;
  marks: { value: number; label: string; position: number }[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/**
 * A live categories comparison, exactly as it was shown. Mirrors
 * `oracle/src/ws/protocol.ts`'s `WireCategoriesBoard` — the first bounded
 * slice of "UI generativa acotada" (blueprint §10.4, ORACLE.md §20.5).
 */
export interface TutorTurnCategoriesBoard {
  kind: 'categories';
  categories: { label: string; value: number }[];
  values: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/**
 * A live table of coins and notes, exactly as it was shown. Mirrors
 * `oracle/src/ws/protocol.ts`'s tokens member (/TUTOR_INSTRUMENTS.md, Sprint 6).
 * `subtotals`/`total` are server-computed: the sum of a pile is the arithmetic
 * the learner is doing, so the model has no field to assert it.
 */
export interface TutorTurnTokensBoard {
  kind: 'tokens';
  groups: { denomination: number; count: number }[];
  subtotals: number[];
  total: number;
  label: string;
  /** Non-nullable alone among the kinds — a coin with no currency is not money. */
  currency: 'MXN' | 'USD' | 'BRL';
}

/** A Singapore bar model, as shown. `widths` is server-computed; the unknown's VALUE was never sent — that is the answer. */
export interface TutorTurnBarModelBoard {
  kind: 'bar_model';
  whole: { label: string; value: number };
  parts: { label: string; value: number | null }[];
  widths: number[];
  unknownIndex: number | null;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A number bond. Nothing is derived: what the server added was the REFUSAL of a bond that does not balance. */
export interface TutorTurnPartWholeBoard {
  kind: 'part_whole';
  whole: { label: string; value: number };
  left: { label: string; value: number };
  right: { label: string; value: number };
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** What came in, what went out, what is left. `kept` is server-computed — it is the thing being taught. */
export interface TutorTurnFlowBoard {
  kind: 'flow';
  income: { label: string; value: number };
  spent: { label: string; value: number };
  keptLabel: string;
  kept: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A savings goal and its progress. `remaining` is server-computed — it is the question. */
export interface TutorTurnGoalBarBoard {
  kind: 'goal_bar';
  goal: { label: string; value: number };
  saved: { label: string; value: number };
  remaining: number;
  savedFraction: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A worked calculation and its check. Both `values` and `checkValue` are server-computed. */
export interface TutorTurnWorkedBoard {
  kind: 'worked';
  start: number;
  steps: { op: 'add' | 'subtract'; value: number }[];
  values: number[];
  checkValue: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A ten frame. `frames` is server-computed; the complement to ten deliberately is not — that is usually the question. */
export interface TutorTurnTenFrameBoard {
  kind: 'ten_frame';
  count: number;
  frames: number[];
  label: string;
}

/** Counting on in jumps. `stops`/`positions` are server-computed; the line must actually ARRIVE at `to`. */
export interface TutorTurnOpenNumberLineBoard {
  kind: 'open_number_line';
  from: number;
  to: number;
  jumps: { value: number }[];
  stops: number[];
  positions: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** Rows by columns. `total` is server-computed — the product is what is being taught. */
export interface TutorTurnArrayBoard {
  kind: 'array';
  rows: number;
  columns: number;
  unitValue: number;
  total: number;
  cells: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A fraction wall. `shares` is server-computed, and a strip may never shade more pieces than it has. */
export interface TutorTurnFractionStripBoard {
  kind: 'fraction_strip';
  rows: { denominator: number; highlighted: number }[];
  shares: number[];
  label: string;
}

/** One amount split two or three ways. `pieceValues` is server-computed — it is the lesson. */
export interface TutorTurnPartitionBoard {
  kind: 'partition';
  whole: number;
  splits: { label: string; denominator: number }[];
  pieceValues: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** Options compared on price per unit. `unitPrices`/`bestIndex` are server-computed — the comparison IS the lesson. */
export interface TutorTurnTableBoard {
  kind: 'table';
  options: { label: string; price: number; units: number }[];
  unitPrices: number[];
  bestIndex: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** A balance. `tilt`/`difference` are server-computed. */
export interface TutorTurnScaleBoard {
  kind: 'scale';
  left: { label: string; value: number };
  right: { label: string; value: number };
  tilt: 'left' | 'right' | 'level';
  difference: number;
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** An ungraded sort into two bins. Neither bin may be empty — see `computeTwoBins`. */
export interface TutorTurnTwoBinsBoard {
  kind: 'two_bins';
  binLabels: [string, string];
  items: { label: string; bin: number }[];
  counts: [number, number];
  label: string;
}

/** Two overlapping sets. The overlap may not be empty — it is the whole instrument. */
export interface TutorTurnVennBoard {
  kind: 'venn';
  leftLabel: string;
  rightLabel: string;
  items: { label: string; side: 'left' | 'right' | 'both' }[];
  left: number;
  right: number;
  both: number;
  label: string;
}

/** An ordered list. `order` is server-computed — sorting is the thing being practised. */
export interface TutorTurnRankingBoard {
  kind: 'ranking';
  items: { label: string; value: number }[];
  direction: 'asc' | 'desc';
  order: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

/** Two endings side by side. The only board whose content is prose; moderation is what guards it. */
export interface TutorTurnOutcomesBoard {
  kind: 'outcomes';
  good: { label: string; detail: string };
  bad: { label: string; detail: string };
  label: string;
}

/** A trade with two parties, each judging their own side. */
export interface TutorTurnTradeBoard {
  kind: 'trade';
  left: { who: string; gives: string; gets: string };
  right: { who: string; gives: string; gets: string };
  label: string;
}

/** Likelihood as area. `shares` is server-computed from plain weights — the model states no percentage. */
export interface TutorTurnChanceBoard {
  kind: 'chance';
  outcomes: { label: string; weight: number }[];
  shares: number[];
  label: string;
}

/** Sharing with the remainder kept visible. `perBin`/`remainder` are server-computed. */
export interface TutorTurnDealBoard { kind: 'deal'; total: number; bins: string[]; perBin: number; remainder: number; label: string }
/** One payment splitting into kept and returned. `change` is server-computed. */
export interface TutorTurnChangeBoard { kind: 'change'; price: number; paid: number; change: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
/** One unit broken into many. `intoCount` is server-computed and must divide evenly. */
export interface TutorTurnRegroupBoard { kind: 'regroup'; fromDenomination: number; fromCount: number; intoDenomination: number; intoCount: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
/** Two sides as lengths that must match. An unbalanced board is refused, never drawn. */
export interface TutorTurnEquationBarBoard { kind: 'equation_bar'; left: { label: string; value: number }[]; right: { label: string; value: number }[]; total: number; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** A till receipt. `total` is server-computed — adding it up is the practice. */
export interface TutorTurnReceiptBoard { kind: 'receipt'; lines: { label: string; value: number }[]; total: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
/** Two columns and a running balance, every step server-computed. */
export interface TutorTurnLedgerBoard { kind: 'ledger'; entries: { label: string; amount: number; direction: 'in' | 'out' }[]; balances: number[]; final: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
/** Price, quantity and discount on one object. Unit and final price are server-computed. */
export interface TutorTurnPriceTagBoard { kind: 'price_tag'; item: string; price: number; units: number; discountPercent: number | null; unitPrice: number; finalPrice: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
/** Stock falling as sales happen. `left` is server-computed; selling more than you had is refused. */
export interface TutorTurnInventoryBoard { kind: 'inventory'; item: string; start: number; sold: number; left: number; label: string }
/** A total against a visible ceiling. Overspending is ALLOWED and drawn — that is the lesson. */
export interface TutorTurnBudgetPlateBoard { kind: 'budget_plate'; budget: number; items: { label: string; value: number }[]; spent: number; remaining: number; overBy: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }

/** Quantity as a count of figures. `totals` is server-computed from the icon count and what one icon is worth. */
export interface TutorTurnPictographBoard { kind: 'pictograph'; rows: { label: string; count: number }[]; unitValue: number; totals: number[]; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** Twenty beads in fives. The complement is deliberately not computed. */
export interface TutorTurnBeadStringBoard { kind: 'bead_string'; count: number; rows: number[]; label: string }
/** Counting events in fives, as they happen. */
export interface TutorTurnTallyBoard { kind: 'tally'; groups: { label: string; count: number }[]; fives: [number, number][]; label: string }
/** A share of a round whole. Shading more pieces than the circle has is refused. */
export interface TutorTurnFractionCircleBoard { kind: 'fraction_circle'; denominator: number; highlighted: number; share: number; label: string }
/** Totals decomposed inside, drawn against one shared scale. */
export interface TutorTurnStackBoard { kind: 'stack'; columns: { label: string; parts: { label: string; value: number }[] }[]; totals: number[]; max: number; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** Two trajectories at once. Tracks of different lengths are refused. */
export interface TutorTurnSequenceCompareBoard { kind: 'sequence_compare'; unit: 'day' | 'week' | 'month' | 'year'; tracks: [{ label: string; start: number; steps: { op: string; value: number }[] }, { label: string; start: number; steps: { op: string; value: number }[] }]; values: number[][]; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** Class II, S10 — NOT ungraded: `values` is server-computed, one array per branch. */
export interface TutorTurnWhatifBoard { kind: 'whatif'; start: number; unit: 'day' | 'week' | 'month' | 'year'; branches: { label: string; steps: { op: string; value: number }[] }[]; values: number[][]; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** Class II, S10 — NOT ungraded: ONE `sequence`, split at `givenCount` into the tutor's shown prefix and the learner's revealed suffix. */
export interface TutorTurnYourTurnBoard { kind: 'your_turn'; start: number; steps: { op: string; value: number }[]; givenCount: number; unit: 'day' | 'week' | 'month' | 'year'; values: number[]; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** When, not how much. Two events in one period are refused — the board exists to show ORDER. */
export interface TutorTurnTimelineBoard { kind: 'timeline'; unit: 'day' | 'week' | 'month' | 'year'; span: number; events: { label: string; at: number }[]; positions: number[]; label: string }
/** A loop that comes back to its start. The only Class I board with no numbers at all. */
export interface TutorTurnCycleBoard { kind: 'cycle'; steps: string[]; label: string }
/** Two states of the same thing. The change is server-computed. */
export interface TutorTurnBeforeAfterBoard { kind: 'before_after'; what: string; before: number; after: number; delta: number; direction: 'up' | 'down' | 'same'; label: string; currency: 'MXN' | 'USD' | 'BRL' | null }
/** Class II, S9 — items and bins the LEARNER sorts by tapping, ungraded by construction. Nothing server-computed. */
export interface TutorTurnGrabBoard { kind: 'grab'; binLabels: string[]; items: string[]; label: string }
/** Class II, S9 — an empty container the learner taps to fill, ungraded by construction. Nothing server-computed. */
export interface TutorTurnFillBoard { kind: 'fill'; container: 'ten_frame' | 'bar' | 'jar'; capacity: number; label: string }

/** Every kind a persisted turn's `whiteboard` column may carry. */
export type TutorTurnWhiteboard =
  | TutorTurnSequenceBoard
  | TutorTurnCompareBoard
  | TutorTurnMarkedLineBoard
  | TutorTurnCategoriesBoard
  | TutorTurnTokensBoard
  | TutorTurnBarModelBoard
  | TutorTurnPartWholeBoard
  | TutorTurnFlowBoard
  | TutorTurnGoalBarBoard
  | TutorTurnWorkedBoard
  | TutorTurnTenFrameBoard
  | TutorTurnOpenNumberLineBoard
  | TutorTurnArrayBoard
  | TutorTurnFractionStripBoard
  | TutorTurnPartitionBoard
  | TutorTurnTableBoard
  | TutorTurnScaleBoard
  | TutorTurnTwoBinsBoard
  | TutorTurnVennBoard
  | TutorTurnRankingBoard
  | TutorTurnOutcomesBoard
  | TutorTurnTradeBoard
  | TutorTurnChanceBoard
  | TutorTurnDealBoard
  | TutorTurnChangeBoard
  | TutorTurnRegroupBoard
  | TutorTurnEquationBarBoard
  | TutorTurnReceiptBoard
  | TutorTurnLedgerBoard
  | TutorTurnPriceTagBoard
  | TutorTurnInventoryBoard
  | TutorTurnBudgetPlateBoard
  | TutorTurnPictographBoard
  | TutorTurnBeadStringBoard
  | TutorTurnTallyBoard
  | TutorTurnFractionCircleBoard
  | TutorTurnStackBoard
  | TutorTurnSequenceCompareBoard
  | TutorTurnTimelineBoard
  | TutorTurnCycleBoard
  | TutorTurnBeforeAfterBoard
  | TutorTurnGrabBoard
  | TutorTurnFillBoard
  | TutorTurnWhatifBoard
  | TutorTurnYourTurnBoard;

/**
 * One closed step of a tray demonstration, exactly as it was sent over the
 * wire and persisted — mirrors `oracle/src/ws/protocol.ts`'s `WireDemoStep`
 * (itself mirroring `oracle/src/tutor/turnSchema.ts`'s `DemoStepSchema`).
 * `backend` and `oracle` share no types by design (see `TutorTurnWhiteboard`'s
 * own comment on this exact posture) — duplicated deliberately, not imported.
 */
export interface TutorTurnDemonstrateStep {
  kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair' | 'move';
  denomination?: number;
  ms?: number;
  item?: string;
  bucket?: string;
  left?: string;
  right?: string;
  value?: number;
}

export interface TutorTurnRow {
  id: string;
  session_id: string;
  seq: number;
  speaker: 'learner' | 'tutor' | 'system';
  text: string;
  emotion: string | null;
  action: string | null;
  audio_path: string | null;
  source: string;
  created_at: string;
  /** Null on every row that never drew a board — see migration 0058. */
  whiteboard: TutorTurnWhiteboard | null;
  /**
   * Null on every row that never demonstrated on the money tray — see
   * migration 0067. Found while investigating ORACLE.md §19.5's "replaying
   * `demonstrate` animations" backlog item, 2026-09-01: the identical gap
   * round 35 found for `whiteboard` above, on the tutor's OTHER v3 turn-
   * schema visual field.
   */
  demonstrate: TutorTurnDemonstrateStep[] | null;
  /**
   * Null on every row that never started a roleplay scene — see migration
   * 0070. A closed catalog id, not structured content — unlike
   * `whiteboard`/`demonstrate` it carries no arithmetic to re-verify at read
   * time, so it skips the raw-row/revalidator machinery those two have: a
   * malformed value's worst case is the frontend catalog not recognising the
   * id and rendering nothing, the same safe failure any unknown id already
   * has.
   */
  roleplay_scene: string | null;
  /** Null on every row whose action was not `point`, or that named no target — see migration 0071. */
  point_at: number | null;
}

/**
 * The same row, before `whiteboard`/`demonstrate` have been runtime-checked.
 * See `readTurnWhiteboard`/`readTurnDemonstrate`.
 */
type TutorTurnRawRow = Omit<TutorTurnRow, 'whiteboard' | 'demonstrate'> & {
  whiteboard: unknown;
  demonstrate: unknown;
};

const WhiteboardStepRowSchema = z
  .object({
    op: z.enum(['add', 'subtract', 'multiply_percent']),
    value: z.number().positive().max(100_000),
  })
  .strict();

/**
 * Re-derives oracle's `SequenceBoardSchema` (`oracle/src/tutor/turnSchema.ts`)
 * plus the extra bounds `computeSequence` (`oracle/src/tutor/whiteboard.ts`)
 * enforces on top of it, applied to the ALREADY-COMPUTED `values` this
 * package persists — see `TutorTurnWhiteboard`'s own comment on why the two
 * packages duplicate the shape rather than share it.
 *
 * Found by adversarial review sweep tutor-review-sweep-101 (whiteboard-at-
 * scale dimension), MEDIUM: `listTutorTurns` forwarded the JSONB column
 * straight through with only `TutorTurnRow.whiteboard: TutorTurnWhiteboard |
 * null` standing guard — a TypeScript type ASSERTION on whatever
 * `supabaseRest.ts`'s `rest<T>` handed back from `JSON.parse`, not a runtime
 * check. Migration 0058 added the column with no DB-level CHECK constraint
 * either, so a malformed or historically-stale row (from before a schema
 * tightening, or from a bug in an earlier write path — `insertTutorTurn`
 * itself validates nothing on the way in) would otherwise reach the
 * transcript/replay endpoint (`GET /sessions/:id`) exactly as if it had been
 * checked.
 *
 * Deliberately validates SHAPE and BOUNDS rather than re-running
 * `computeSequence`'s arithmetic: Oracle already computes and validates
 * these numbers TWICE before they are ever persisted (once at
 * `parseTurn`-time, once again at the wire in `ws/server.ts`, /ORACLE.md
 * §20.5) — this read path's job is to refuse a row that is no longer a
 * well-formed whiteboard by construction, not to become a third copy of the
 * arithmetic that produced it.
 */
const SequenceBoardRowSchema = z
  .object({
    kind: z.literal('sequence'),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WhiteboardStepRowSchema).min(1).max(8),
    unit: z.enum(['day', 'week', 'month', 'year']),
    /** `computeSequence`'s own running-value ceiling — see whiteboard.ts's `MAX_VALUE`. */
    values: z.array(z.number().min(0).max(10_000_000)).min(2).max(9),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const WhiteboardCompareSideRowSchema = z
  .object({
    label: z.string().min(1).max(60),
    value: z.number().min(0).max(1_000_000),
  })
  .strict();

/**
 * Re-derives oracle's `WhiteboardCompareSchema` the same way
 * `SequenceBoardRowSchema` above re-derives `SequenceBoardSchema`. No
 * cross-field check re-derives `difference`/`greater` from `left`/`right` —
 * the same restraint `sequence`'s own schema below takes with `values`: this
 * path validates the persisted shape is well-formed, not a third copy of
 * the arithmetic that produced it.
 */
const CompareBoardRowSchema = z
  .object({
    kind: z.literal('compare'),
    left: WhiteboardCompareSideRowSchema,
    right: WhiteboardCompareSideRowSchema,
    difference: z.number().min(0).max(1_000_000),
    greater: z.enum(['left', 'right', 'tie']),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const WhiteboardMarkRowSchema = z
  .object({
    value: z.number().min(0).max(1_000_000),
    label: z.string().min(1).max(60),
    position: z.number().min(0).max(1),
  })
  .strict();

/**
 * Re-derives oracle's `WhiteboardMarkedLineSchema` the same way
 * `SequenceBoardRowSchema` above re-derives `SequenceBoardSchema`. `max >
 * min` and every mark falling inside `[min, max]`, checked below in the
 * `superRefine`, are relationships between fields oracle's OWN schema
 * cannot express with a plain `.strict()` shape either
 * (`z.discriminatedUnion` cannot carry a `.refine()` per member) — this is
 * not a re-derivation of `position` itself, which stays untouched, same
 * restraint `computeSequence`'s own values get here.
 */
const MarkedLineBoardRowSchema = z
  .object({
    kind: z.literal('marked_line'),
    min: z.number().min(0).max(1_000_000),
    max: z.number().min(0).max(1_000_000),
    marks: z.array(WhiteboardMarkRowSchema).min(1).max(4),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const WhiteboardCategoryRowSchema = z
  .object({
    label: z.string().min(1).max(40),
    value: z.number().min(0).max(1_000_000),
  })
  .strict();

/**
 * Re-derives oracle's `CategoriesBoardSchema` the same way
 * `SequenceBoardRowSchema` above re-derives `SequenceBoardSchema` — the
 * first bounded slice of "UI generativa acotada" (blueprint §10.4,
 * ORACLE.md §20.5). `values` here has no separate ceiling of its own the
 * way a sequence's running total does (each category's own `value` bound
 * already IS the ceiling — there is no accumulation to overshoot it).
 */
const CategoriesBoardRowSchema = z
  .object({
    kind: z.literal('categories'),
    categories: z.array(WhiteboardCategoryRowSchema).min(2).max(6),
    values: z.array(z.number().min(0).max(1_000_000)).min(2).max(6),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const WhiteboardTokenGroupRowSchema = z
  .object({
    denomination: z.number().positive().max(1_000),
    count: z.number().int().min(1).max(12),
  })
  .strict();

/**
 * Re-derives oracle's `WhiteboardTokensSchema` the same way
 * `SequenceBoardRowSchema` above re-derives its own source, plus the bounds
 * `computeTokens` enforces on top of the per-field ones. It deliberately does
 * NOT re-check a denomination against the real denominations of the currency:
 * that table lives in Oracle, this is a display-only read, and a third copy of
 * it here could disagree with the one that actually validated the board.
 */
const TokensBoardRowSchema = z
  .object({
    kind: z.literal('tokens'),
    groups: z.array(WhiteboardTokenGroupRowSchema).min(1).max(6),
    subtotals: z.array(z.number().min(0).max(10_000_000)).min(1).max(6),
    total: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

const NamedAmountRowSchema = z
  .object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) })
  .strict();

const BarModelBoardRowSchema = z
  .object({
    kind: z.literal('bar_model'),
    whole: NamedAmountRowSchema,
    parts: z
      .array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000).nullable() }).strict())
      .min(2)
      .max(3),
    widths: z.array(z.number().min(0).max(1)).min(2).max(3),
    unknownIndex: z.number().int().min(0).max(2).nullable(),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const PartWholeBoardRowSchema = z
  .object({
    kind: z.literal('part_whole'),
    whole: NamedAmountRowSchema,
    left: NamedAmountRowSchema,
    right: NamedAmountRowSchema,
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const FlowBoardRowSchema = z
  .object({
    kind: z.literal('flow'),
    income: NamedAmountRowSchema,
    spent: NamedAmountRowSchema,
    keptLabel: z.string().min(1).max(40),
    kept: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const GoalBarBoardRowSchema = z
  .object({
    kind: z.literal('goal_bar'),
    goal: NamedAmountRowSchema,
    saved: NamedAmountRowSchema,
    remaining: z.number().min(0).max(10_000_000),
    savedFraction: z.number().min(0).max(1),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const WorkedBoardRowSchema = z
  .object({
    kind: z.literal('worked'),
    start: z.number().min(0).max(1_000_000),
    steps: z
      .array(z.object({ op: z.enum(['add', 'subtract']), value: z.number().positive().max(100_000) }).strict())
      .min(1)
      .max(4),
    values: z.array(z.number().min(0).max(10_000_000)).min(2).max(5),
    checkValue: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const TenFrameBoardRowSchema = z
  .object({
    kind: z.literal('ten_frame'),
    count: z.number().int().min(1).max(20),
    frames: z.array(z.number().int().min(0).max(10)).min(1).max(2),
    label: z.string().min(1).max(60),
  })
  .strict();

const OpenNumberLineBoardRowSchema = z
  .object({
    kind: z.literal('open_number_line'),
    from: z.number().min(0).max(1_000_000),
    to: z.number().min(0).max(1_000_000),
    jumps: z.array(z.object({ value: z.number().positive().max(100_000) }).strict()).min(1).max(5),
    stops: z.array(z.number().min(0).max(1_000_000)).min(2).max(6),
    positions: z.array(z.number().min(0).max(1)).min(2).max(6),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const ArrayBoardRowSchema = z
  .object({
    kind: z.literal('array'),
    rows: z.number().int().min(1).max(6),
    columns: z.number().int().min(1).max(6),
    unitValue: z.number().positive().max(100_000),
    total: z.number().min(0).max(10_000_000),
    cells: z.number().int().min(1).max(36),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const FractionStripBoardRowSchema = z
  .object({
    kind: z.literal('fraction_strip'),
    rows: z
      .array(
        z
          .object({
            denominator: z.number().int().min(1).max(12),
            highlighted: z.number().int().min(0).max(12),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    shares: z.array(z.number().min(0).max(1)).min(2).max(4),
    label: z.string().min(1).max(60),
  })
  .strict();

const PartitionBoardRowSchema = z
  .object({
    kind: z.literal('partition'),
    whole: z.number().positive().max(1_000_000),
    splits: z
      .array(z.object({ label: z.string().min(1).max(40), denominator: z.number().int().min(2).max(12) }).strict())
      .min(2)
      .max(3),
    pieceValues: z.array(z.number().min(0).max(1_000_000)).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const TableBoardRowSchema = z
  .object({
    kind: z.literal('table'),
    options: z
      .array(
        z
          .object({
            label: z.string().min(1).max(40),
            price: z.number().positive().max(1_000_000),
            units: z.number().positive().max(10_000),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    unitPrices: z.array(z.number().min(0).max(10_000_000)).min(2).max(4),
    bestIndex: z.number().int().min(0).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const ScaleBoardRowSchema = z
  .object({
    kind: z.literal('scale'),
    left: z.object({ label: z.string().min(1).max(60), value: z.number().min(0).max(1_000_000) }).strict(),
    right: z.object({ label: z.string().min(1).max(60), value: z.number().min(0).max(1_000_000) }).strict(),
    tilt: z.enum(['left', 'right', 'level']),
    difference: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const TwoBinsBoardRowSchema = z
  .object({
    kind: z.literal('two_bins'),
    binLabels: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
    items: z
      .array(z.object({ label: z.string().min(1).max(40), bin: z.number().int().min(0).max(1) }).strict())
      .min(2)
      .max(8),
    counts: z.tuple([z.number().int().min(0).max(8), z.number().int().min(0).max(8)]),
    label: z.string().min(1).max(60),
  })
  .strict();

const VennBoardRowSchema = z
  .object({
    kind: z.literal('venn'),
    leftLabel: z.string().min(1).max(40),
    rightLabel: z.string().min(1).max(40),
    items: z
      .array(z.object({ label: z.string().min(1).max(40), side: z.enum(['left', 'right', 'both']) }).strict())
      .min(2)
      .max(8),
    left: z.number().int().min(0).max(8),
    right: z.number().int().min(0).max(8),
    both: z.number().int().min(0).max(8),
    label: z.string().min(1).max(60),
  })
  .strict();

const RankingBoardRowSchema = z
  .object({
    kind: z.literal('ranking'),
    items: z
      .array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict())
      .min(2)
      .max(5),
    direction: z.enum(['asc', 'desc']),
    order: z.array(z.number().int().min(0).max(4)).min(2).max(5),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

const OutcomeRowSchema = z
  .object({ label: z.string().min(1).max(40), detail: z.string().min(1).max(110) })
  .strict();

const OutcomesBoardRowSchema = z
  .object({
    kind: z.literal('outcomes'),
    good: OutcomeRowSchema,
    bad: OutcomeRowSchema,
    label: z.string().min(1).max(60),
  })
  .strict();

const TradeSideRowSchema = z
  .object({
    who: z.string().min(1).max(30),
    gives: z.string().min(1).max(40),
    gets: z.string().min(1).max(40),
  })
  .strict();

const TradeBoardRowSchema = z
  .object({
    kind: z.literal('trade'),
    left: TradeSideRowSchema,
    right: TradeSideRowSchema,
    label: z.string().min(1).max(60),
  })
  .strict();

const ChanceBoardRowSchema = z
  .object({
    kind: z.literal('chance'),
    outcomes: z
      .array(z.object({ label: z.string().min(1).max(40), weight: z.number().int().min(1).max(100) }).strict())
      .min(2)
      .max(3),
    shares: z.array(z.number().min(0).max(1)).min(2).max(3),
    label: z.string().min(1).max(60),
  })
  .strict();

const CUR_ROW = z.enum(['MXN', 'USD', 'BRL']);
const NamedValueRowSchema = z
  .object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) })
  .strict();

const DealBoardRowSchema = z
  .object({
    kind: z.literal('deal'),
    total: z.number().int().min(1).max(60),
    bins: z.array(z.string().min(1).max(40)).min(2).max(6),
    perBin: z.number().int().min(0).max(60),
    remainder: z.number().int().min(0).max(6),
    label: z.string().min(1).max(60),
  })
  .strict();

const ChangeBoardRowSchema = z
  .object({
    kind: z.literal('change'),
    price: z.number().positive().max(1_000_000),
    paid: z.number().positive().max(1_000_000),
    change: z.number().min(0).max(1_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const RegroupBoardRowSchema = z
  .object({
    kind: z.literal('regroup'),
    fromDenomination: z.number().positive().max(1_000),
    fromCount: z.number().int().min(1).max(6),
    intoDenomination: z.number().positive().max(1_000),
    intoCount: z.number().int().min(1).max(60),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const EquationBarBoardRowSchema = z
  .object({
    kind: z.literal('equation_bar'),
    left: z.array(NamedValueRowSchema).min(1).max(3),
    right: z.array(NamedValueRowSchema).min(1).max(3),
    total: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

const ReceiptBoardRowSchema = z
  .object({
    kind: z.literal('receipt'),
    lines: z.array(NamedValueRowSchema).min(1).max(6),
    total: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const LedgerBoardRowSchema = z
  .object({
    kind: z.literal('ledger'),
    entries: z
      .array(
        z
          .object({
            label: z.string().min(1).max(40),
            amount: z.number().positive().max(1_000_000),
            direction: z.enum(['in', 'out']),
          })
          .strict(),
      )
      .min(2)
      .max(6),
    balances: z.array(z.number().min(0).max(10_000_000)).min(2).max(6),
    final: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const PriceTagBoardRowSchema = z
  .object({
    kind: z.literal('price_tag'),
    item: z.string().min(1).max(40),
    price: z.number().positive().max(1_000_000),
    units: z.number().positive().max(10_000),
    discountPercent: z.number().int().min(1).max(90).nullable(),
    unitPrice: z.number().min(0).max(1_000_000),
    finalPrice: z.number().min(0).max(1_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const InventoryBoardRowSchema = z
  .object({
    kind: z.literal('inventory'),
    item: z.string().min(1).max(40),
    start: z.number().int().min(1).max(40),
    sold: z.number().int().min(0).max(40),
    left: z.number().int().min(0).max(40),
    label: z.string().min(1).max(60),
  })
  .strict();

const BudgetPlateBoardRowSchema = z
  .object({
    kind: z.literal('budget_plate'),
    budget: z.number().positive().max(1_000_000),
    items: z.array(NamedValueRowSchema).min(2).max(5),
    spent: z.number().min(0).max(10_000_000),
    remaining: z.number().min(0).max(10_000_000),
    overBy: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW,
  })
  .strict();

const UnitRow = z.enum(['day', 'week', 'month', 'year']);
const SeqStepRow = z
  .object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number().positive().max(100_000) })
  .strict();
const SeqTrackRow = z
  .object({
    label: z.string().min(1).max(40),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(SeqStepRow).min(1).max(6),
  })
  .strict();

const PictographBoardRowSchema = z
  .object({
    kind: z.literal('pictograph'),
    rows: z.array(z.object({ label: z.string().min(1).max(40), count: z.number().int().min(1).max(12) }).strict()).min(2).max(4),
    unitValue: z.number().positive().max(1_000),
    totals: z.array(z.number().min(0).max(10_000_000)).min(2).max(4),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

const BeadStringBoardRowSchema = z
  .object({
    kind: z.literal('bead_string'),
    count: z.number().int().min(1).max(20),
    rows: z.array(z.number().int().min(0).max(10)).min(1).max(2),
    label: z.string().min(1).max(60),
  })
  .strict();

const TallyBoardRowSchema = z
  .object({
    kind: z.literal('tally'),
    groups: z.array(z.object({ label: z.string().min(1).max(40), count: z.number().int().min(1).max(20) }).strict()).min(2).max(5),
    fives: z.array(z.tuple([z.number().int().min(0).max(4), z.number().int().min(0).max(4)])).min(2).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

const FractionCircleBoardRowSchema = z
  .object({
    kind: z.literal('fraction_circle'),
    denominator: z.number().int().min(2).max(12),
    highlighted: z.number().int().min(0).max(12),
    share: z.number().min(0).max(1),
    label: z.string().min(1).max(60),
  })
  .strict();

const StackBoardRowSchema = z
  .object({
    kind: z.literal('stack'),
    columns: z
      .array(
        z
          .object({ label: z.string().min(1).max(40), parts: z.array(NamedValueRowSchema).min(2).max(3) })
          .strict(),
      )
      .min(2)
      .max(3),
    totals: z.array(z.number().min(0).max(10_000_000)).min(2).max(3),
    max: z.number().min(0).max(10_000_000),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

const SequenceCompareBoardRowSchema = z
  .object({
    kind: z.literal('sequence_compare'),
    unit: UnitRow,
    tracks: z.tuple([SeqTrackRow, SeqTrackRow]),
    values: z.array(z.array(z.number().min(0).max(10_000_000))).length(2),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

/** One branch of a `whatif` — `SeqTrackRow` minus its own `start` (shared at the board's top level, not per branch). */
const WhatifBranchRow = z
  .object({
    label: z.string().min(1).max(30),
    steps: z.array(SeqStepRow).min(1).max(6),
  })
  .strict();

/** Class II, S10 — NOT ungraded: `values` is server-computed, `sequence_compare`'s own shape generalised to 2-3 branches sharing one `start`. */
const WhatifBoardRowSchema = z
  .object({
    kind: z.literal('whatif'),
    start: z.number().min(0).max(1_000_000),
    unit: UnitRow,
    branches: z.array(WhatifBranchRow).min(2).max(3),
    values: z.array(z.array(z.number().min(0).max(10_000_000))).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

/** Class II, S10 — NOT ungraded: ONE `sequence`, split at `givenCount` into the tutor's shown prefix and the learner's revealed suffix. */
const YourTurnBoardRowSchema = z
  .object({
    kind: z.literal('your_turn'),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(SeqStepRow).min(2).max(7),
    givenCount: z.number().int().min(1).max(7),
    unit: UnitRow,
    values: z.array(z.number().min(0).max(10_000_000)).min(3).max(8),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

const TimelineBoardRowSchema = z
  .object({
    kind: z.literal('timeline'),
    unit: UnitRow,
    span: z.number().int().min(2).max(12),
    events: z.array(z.object({ label: z.string().min(1).max(40), at: z.number().int().min(1).max(12) }).strict()).min(2).max(5),
    positions: z.array(z.number().min(0).max(1)).min(2).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

const CycleBoardRowSchema = z
  .object({
    kind: z.literal('cycle'),
    steps: z.array(z.string().min(1).max(40)).min(3).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

const BeforeAfterBoardRowSchema = z
  .object({
    kind: z.literal('before_after'),
    what: z.string().min(1).max(40),
    before: z.number().min(0).max(1_000_000),
    after: z.number().min(0).max(1_000_000),
    delta: z.number().min(0).max(1_000_000),
    direction: z.enum(['up', 'down', 'same']),
    label: z.string().min(1).max(60),
    currency: CUR_ROW.nullable(),
  })
  .strict();

/** Class II, S9 — no computed field, see `WhiteboardGrabSchema`'s own comment (oracle/src/tutor/turnSchema.ts). */
const GrabBoardRowSchema = z
  .object({
    kind: z.literal('grab'),
    binLabels: z.array(z.string().min(1).max(40)).min(2).max(4),
    items: z.array(z.string().min(1).max(40)).min(2).max(8),
    label: z.string().min(1).max(60),
  })
  .strict();

/** Class II, S9 — no computed field, see `WhiteboardFillSchema`'s own comment (oracle/src/tutor/turnSchema.ts). */
const FillBoardRowSchema = z
  .object({
    kind: z.literal('fill'),
    container: z.enum(['ten_frame', 'bar', 'jar']),
    capacity: z.number().int().min(1).max(20),
    label: z.string().min(1).max(60),
  })
  .strict();

/*
 * The cross-field relationships no single branch's own `.strict()` shape
 * can express are checked here, AFTER the discriminated union — `.refine()`
 * on a MEMBER would wrap it in a `ZodEffects` that `z.discriminatedUnion`
 * cannot accept as a branch (it requires a literal `ZodObject` per branch to
 * read the discriminant key off), so the base shapes above stay plain and
 * this `superRefine` is the one place every kind's extra invariants live.
 * `compare` has none: nothing here relates `left`/`right` to
 * `difference`/`greater` without re-deriving the comparison itself, which
 * this path deliberately does not do (see `CompareBoardRowSchema`'s comment).
 */
const TutorTurnWhiteboardRowSchema = z
  .discriminatedUnion('kind', [
    SequenceBoardRowSchema,
    CompareBoardRowSchema,
    MarkedLineBoardRowSchema,
    CategoriesBoardRowSchema,
    TokensBoardRowSchema,
    BarModelBoardRowSchema,
    PartWholeBoardRowSchema,
    FlowBoardRowSchema,
    GoalBarBoardRowSchema,
    WorkedBoardRowSchema,
    TenFrameBoardRowSchema,
    OpenNumberLineBoardRowSchema,
    ArrayBoardRowSchema,
    FractionStripBoardRowSchema,
    PartitionBoardRowSchema,
    TableBoardRowSchema,
    ScaleBoardRowSchema,
    TwoBinsBoardRowSchema,
    VennBoardRowSchema,
    RankingBoardRowSchema,
    OutcomesBoardRowSchema,
    TradeBoardRowSchema,
    ChanceBoardRowSchema,
    DealBoardRowSchema,
    ChangeBoardRowSchema,
    RegroupBoardRowSchema,
    EquationBarBoardRowSchema,
    ReceiptBoardRowSchema,
    LedgerBoardRowSchema,
    PriceTagBoardRowSchema,
    InventoryBoardRowSchema,
    BudgetPlateBoardRowSchema,
    PictographBoardRowSchema,
    BeadStringBoardRowSchema,
    TallyBoardRowSchema,
    FractionCircleBoardRowSchema,
    StackBoardRowSchema,
    SequenceCompareBoardRowSchema,
    TimelineBoardRowSchema,
    CycleBoardRowSchema,
    BeforeAfterBoardRowSchema,
    GrabBoardRowSchema,
    FillBoardRowSchema,
    WhatifBoardRowSchema,
    YourTurnBoardRowSchema,
  ])
  .superRefine((board, ctx) => {
    if (board.kind === 'sequence') {
      if (board.values.length !== board.steps.length + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'values must carry exactly one entry per step plus the starting value',
          path: ['values'],
        });
      }
      if (board.steps.some((step) => step.op === 'multiply_percent' && step.value > 500)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "a multiply_percent step must not exceed 500 — computeSequence's own percentage ceiling",
          path: ['steps'],
        });
      }
    } else if (board.kind === 'marked_line') {
      if (board.max <= board.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'max must exceed min',
          path: ['max'],
        });
      }
      if (board.marks.some((mark) => mark.value < board.min || mark.value > board.max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'every mark value must fall within [min, max]',
          path: ['marks'],
        });
      }
    } else if (board.kind === 'timeline') {
      if (board.positions.length !== board.events.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'positions must carry exactly one entry per event',
          path: ['positions'],
        });
      }
      if (new Set(board.events.map((e) => e.at)).size !== board.events.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'two events in the same period cannot show the order this board exists to show',
          path: ['events'],
        });
      }
    } else if (board.kind === 'fraction_circle') {
      if (board.highlighted > board.denominator) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'a circle may not shade more pieces than it has',
          path: ['highlighted'],
        });
      }
    } else if (board.kind === 'ledger') {
      if (board.balances.length !== board.entries.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'balances must carry exactly one entry per ledger line',
          path: ['balances'],
        });
      }
    } else if (board.kind === 'inventory') {
      if (board.sold > board.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'you cannot sell more than you had',
          path: ['sold'],
        });
      }
    } else if (board.kind === 'ranking') {
      if (board.order.length !== board.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'order must carry exactly one entry per item',
          path: ['order'],
        });
      }
    } else if (board.kind === 'chance') {
      if (board.shares.length !== board.outcomes.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'shares must carry exactly one entry per outcome',
          path: ['shares'],
        });
      }
    } else if (board.kind === 'table') {
      if (board.unitPrices.length !== board.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'unitPrices must carry exactly one entry per option',
          path: ['unitPrices'],
        });
      }
    } else if (board.kind === 'fraction_strip') {
      if (board.shares.length !== board.rows.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'shares must carry exactly one entry per row',
          path: ['shares'],
        });
      }
      if (board.rows.some((r) => r.highlighted > r.denominator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'a strip may not shade more pieces than it has',
          path: ['rows'],
        });
      }
    } else if (board.kind === 'partition') {
      if (board.pieceValues.length !== board.splits.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pieceValues must carry exactly one entry per split',
          path: ['pieceValues'],
        });
      }
    } else if (board.kind === 'open_number_line') {
      if (board.stops.length !== board.jumps.length + 1 || board.positions.length !== board.stops.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'stops must carry one entry per jump plus the start, and positions must match stops',
          path: ['stops'],
        });
      }
    } else if (board.kind === 'bar_model') {
      if (board.widths.length !== board.parts.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'widths must carry exactly one entry per part',
          path: ['widths'],
        });
      }
      if (board.parts.filter((p) => p.value === null).length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'a bar model may have at most one unknown part',
          path: ['parts'],
        });
      }
    } else if (board.kind === 'worked') {
      if (board.values.length !== board.steps.length + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'values must carry exactly one entry per step plus the starting value',
          path: ['values'],
        });
      }
    } else if (board.kind === 'tokens') {
      if (board.subtotals.length !== board.groups.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'subtotals must carry exactly one entry per group',
          path: ['subtotals'],
        });
      }
    } else if (board.kind === 'categories') {
      if (board.values.length !== board.categories.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'values must carry exactly one entry per category',
          path: ['values'],
        });
      }
    } else if (board.kind === 'your_turn') {
      if (board.values.length !== board.steps.length + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'values must carry exactly one entry per step plus the starting value',
          path: ['values'],
        });
      }
      if (board.givenCount >= board.values.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'givenCount must leave at least one value for the learner to reveal',
          path: ['givenCount'],
        });
      }
    }
  });

/**
 * A malformed board on this DISPLAY-ONLY read degrades to no board rather
 * than failing the whole transcript fetch (§1.14: "defaulting is acceptable
 * only for display-only reads" — this data is never read, modified and
 * written back; a replay simply shows no board, exactly as it already does
 * for any row written before migration 0058). Logged loudly rather than
 * swallowed: a row that fails this check is either real storage-level
 * corruption or a write-path regression, and either is worth knowing about
 * even though the transcript viewer looks identical to a turn that never
 * drew a board at all.
 */
function readTurnWhiteboard(raw: unknown, turnId: string): TutorTurnWhiteboard | null {
  if (raw === null || raw === undefined) return null;
  const parsed = TutorTurnWhiteboardRowSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      `[tutor] tutor_turns.id=${turnId} carries a whiteboard that failed runtime validation — ` +
        'degrading to null rather than forwarding it to the transcript client: ' +
        parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    );
    return null;
  }
  return parsed.data;
}

/**
 * Re-derives oracle's `DemoStepSchema` (`oracle/src/tutor/turnSchema.ts`),
 * one closed step of a tray demonstration, plus the array-level 1-8 bound
 * `TutorTurnSchema` enforces on `demonstrate` as a whole — the same posture
 * `TutorTurnWhiteboardRowSchema` above uses for the sibling v3 visual field,
 * and for the same reason: this package and `oracle` share no types, and a
 * malformed or historically-stale row must be caught at THIS side of that
 * duplication rather than trusted on a TypeScript assertion alone (round 35 /
 * round 113's own lesson, applied here before the identical gap could repeat
 * it under a different field name).
 */
const DemonstrateStepRowSchema = z
  .object({
    // Widened to 4 families 2026-09-02 (/TUTOR_INSTRUMENTS.md Sprint 2) — see
    // `DemoStepSchema`'s own comment (oracle/src/tutor/turnSchema.ts).
    kind: z.enum(['add', 'remove', 'pause', 'place', 'assign', 'pair', 'move']),
    denomination: z.number().positive().max(10_000).optional(),
    ms: z.number().int().min(100).max(2_000).optional(),
    item: z.string().min(1).max(64).optional(),
    bucket: z.string().min(1).max(64).optional(),
    left: z.string().min(1).max(64).optional(),
    right: z.string().min(1).max(64).optional(),
    value: z.number().optional(),
  })
  .strict();

const TutorTurnDemonstrateRowSchema = z.array(DemonstrateStepRowSchema).min(1).max(8);

/**
 * A malformed demonstration on this DISPLAY-ONLY read degrades to none
 * rather than failing the whole transcript fetch — the identical §1.14
 * reasoning `readTurnWhiteboard` above already documents in full: this data
 * is read, never modified or written back, and a family's whole conversation
 * history must not go down over one corrupt row. Logged loudly rather than
 * swallowed, for the same reason.
 */
function readTurnDemonstrate(raw: unknown, turnId: string): TutorTurnDemonstrateStep[] | null {
  if (raw === null || raw === undefined) return null;
  const parsed = TutorTurnDemonstrateRowSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      `[tutor] tutor_turns.id=${turnId} carries demonstration steps that failed runtime validation — ` +
        'degrading to null rather than forwarding them to the transcript client: ' +
        parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    );
    return null;
  }
  return parsed.data;
}

export interface InsertTurnInput {
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
   * Found by adversarial review, round 35 (2026-08-30, HIGH): this field
   * did not exist at all, so a session that used the whiteboard lost it
   * silently on replay and on the guardian transcript viewer (migration
   * 0058).
   */
  whiteboard?: TutorTurnWhiteboard | null;
  /**
   * Found while investigating ORACLE.md §19.5's "replaying `demonstrate`
   * animations" backlog item, 2026-09-01 — the identical gap round 35 found
   * for `whiteboard` above, on the tutor's OTHER v3 turn-schema visual
   * field: this field did not exist at all, so a session where the tutor
   * demonstrated on the money tray lost that fact silently on replay and on
   * the guardian transcript viewer (migration 0067).
   */
  demonstrate?: TutorTurnDemonstrateStep[] | null;
  /**
   * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4, migration 0070): the same
   * live-only-field gap `demonstrate` above closes, closed identically —
   * this field did not exist at all, so a session that started a roleplay
   * scene would have lost that fact silently on replay and on the guardian
   * transcript viewer.
   */
  roleplayScene?: string | null;
  /**
   * Class III `point_at` (2026-09-04, migration 0071): the same live-only
   * gap `roleplayScene` above closes, closed identically — without this
   * column, which element a `point` gesture reached for is lost on replay
   * and on the guardian transcript viewer the instant the session ends.
   */
  pointAt?: number | null;
}

export async function insertTutorTurn(input: InsertTurnInput): Promise<boolean> {
  const res = await serviceRest<unknown>('/tutor_turns?on_conflict=session_id,seq', {
    method: 'POST',
    // Ignore-duplicates rather than merge: a retried write of the SAME turn
    // must not overwrite the original with a second attempt's text.
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      session_id: input.sessionId,
      seq: input.seq,
      speaker: input.speaker,
      text: input.text,
      emotion: input.emotion ?? null,
      action: input.action ?? null,
      audio_path: input.audioPath ?? null,
      source: input.source,
      moderation: input.moderation ?? {},
      whiteboard: input.whiteboard ?? null,
      demonstrate: input.demonstrate ?? null,
      roleplay_scene: input.roleplayScene ?? null,
      point_at: input.pointAt ?? null,
    }),
  });
  return res !== null;
}

export async function listTutorTurns(sessionId: string): Promise<TutorTurnRow[] | null> {
  const rows = await serviceRest<TutorTurnRawRow[]>(
    `/tutor_turns?session_id=eq.${eu(sessionId)}&select=id,session_id,seq,speaker,text,emotion,action,audio_path,source,created_at,whiteboard,demonstrate,roleplay_scene,point_at&order=seq.asc`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({
    ...row,
    whiteboard: readTurnWhiteboard(row.whiteboard, row.id),
    demonstrate: readTurnDemonstrate(row.demonstrate, row.id),
  }));
}

// ── Class V artifacts: plan & notebook (migration 0069, TUTOR_INSTRUMENTS.md §3.6) ──

export interface TutorPlanRow {
  user_id: string;
  content: TutorTurnWhiteboard | null;
  session_id: string | null;
  updated_at: string;
}

/**
 * The learner's current savings plan, or null — whether because they have
 * never saved one, or the read itself failed. A display-only read (never
 * read, modified and written back — `writeTutorPlan` below is an
 * independent, full-replacement write path, not a read-then-write against
 * this), so collapsing "no plan" and "fetch failed" is the same posture
 * `getTutorSession` already takes for the identical reason.
 */
export async function getTutorPlan(userId: string): Promise<TutorPlanRow | null> {
  const rows = await serviceRest<{ user_id: string; content: unknown; session_id: string | null; updated_at: string }[]>(
    `/tutor_plans?user_id=eq.${eu(userId)}&select=user_id,content,session_id,updated_at&limit=1`,
  );
  const row = rows?.[0];
  if (!row) return null;
  return { ...row, content: readTurnWhiteboard(row.content, `plan:${userId}`) };
}

/**
 * Persists `content` as the learner's whole current plan, replacing whatever
 * was there — `write_tutor_plan` (0069) is a plain UPSERT, not compare-and-
 * swap: the new content is never a merge of the old (see that migration's
 * own comment), so there is nothing to conflict against.
 */
export async function writeTutorPlan(input: { userId: string; content: unknown; sessionId: string | null }): Promise<boolean> {
  const res = await serviceRest<unknown>('/rpc/write_tutor_plan', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: input.userId, p_content: input.content, p_session_id: input.sessionId }),
  });
  return res !== null;
}

export interface TutorNotebookEntryRow {
  id: string;
  user_id: string;
  whiteboard: TutorTurnWhiteboard | null;
  session_id: string | null;
  turn_seq: number | null;
  kept_at: string;
}

/**
 * Copies `whiteboard` into a new kept-board row — never a reference, see
 * migration 0069's own header for why (sessions purge at 90 days). Returns
 * false on any failure; the caller must refuse rather than report success on
 * a "keep" that did not actually land (§1.14).
 */
export async function insertNotebookEntry(input: {
  userId: string;
  whiteboard: unknown;
  sessionId: string | null;
  turnSeq: number | null;
}): Promise<boolean> {
  const res = await serviceRest<unknown>('/tutor_notebook_entries', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: input.userId,
      whiteboard: input.whiteboard,
      session_id: input.sessionId,
      turn_seq: input.turnSeq,
    }),
  });
  return res !== null;
}

/** Newest-first. A learner's notebook is expected to stay small (a deliberate, occasional "keep this"), so no pagination yet — the same call this codebase already made for `listPendingLearnerMemoryProposals`. */
export async function listNotebookEntries(userId: string): Promise<TutorNotebookEntryRow[] | null> {
  const rows = await serviceRest<
    { id: string; user_id: string; whiteboard: unknown; session_id: string | null; turn_seq: number | null; kept_at: string }[]
  >(
    `/tutor_notebook_entries?user_id=eq.${eu(userId)}&select=id,user_id,whiteboard,session_id,turn_seq,kept_at&order=kept_at.desc`,
  );
  if (rows === null) return null;
  return rows.map((row) => ({ ...row, whiteboard: readTurnWhiteboard(row.whiteboard, `notebook:${row.id}`) }));
}

// ── Segments ────────────────────────────────────────────────────────────────

export interface TutorSegmentRow {
  id: string;
  session_id: string;
  seq: number;
  origin: 'catalog' | 'bank' | 'live';
  lesson_id: string | null;
  segment_type: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  key_verified: boolean;
  score: number | null;
  xp_awarded: number;
  attempts: number;
  provenance: Record<string, unknown>;
  review_status: string | null;
  created_at: string;
  /**
   * Set once `/internal/segments/:id/voice-check` has actually recorded real
   * pedagogy evidence for this segment (migration 0060) — never on a failed
   * upstream read, which recorded nothing. `/grade` reads this to avoid
   * calling `recordAttempt` a second time for the same real answer; see
   * `markSegmentVoiceChecked`'s own comment for the double-evidence bug this
   * closes.
   */
  voice_checked_at: string | null;
}

/*
 * THE REVIEW QUEUE READER (/ORACLE.md §7.3, closed 2026-08-28).
 *
 * Live-generated segments have been SAMPLED into `review_status='pending'`
 * since migration 0047 — and nothing read the column. §15.2 item 6 called it
 * out: post-hoc human review is one of the eight compensating controls that
 * make live generation acceptable for a minor without a human in the loop,
 * it is asserted to counsel in /LEGAL/AI_TUTOR_LEGAL_REVIEW.md §5, and a
 * control that exists only as an unread flag is a control that does not
 * exist. These two functions, plus the /admin/tutor/review-queue surface,
 * are the reader.
 */
export interface TutorReviewRow {
  id: string;
  session_id: string;
  seq: number;
  origin: string;
  segment_type: string;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
  score: number | null;
  review_status: string;
  created_at: string;
}

/** Oldest first: the queue is a backlog, and the oldest exposure ages worst. */
export async function listTutorReviewQueue(limit = 100): Promise<TutorReviewRow[] | null> {
  return serviceRest<TutorReviewRow[]>(
    `/tutor_segments?review_status=eq.pending` +
      `&select=id,session_id,seq,origin,segment_type,payload,provenance,score,review_status,created_at` +
      `&order=created_at.asc&limit=${Math.min(limit, 200)}`,
  );
}

/**
 * One verdict, and only on a row still pending — a decision already made is
 * not silently overwritten by a second reviewer's stale tab.
 */
export async function setTutorReviewStatus(
  segmentId: string,
  status: 'approved' | 'rejected',
): Promise<boolean> {
  const res = await serviceRest<unknown>(
    `/tutor_segments?id=eq.${eu(segmentId)}&review_status=eq.pending`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ review_status: status }),
    },
  );
  return res !== null;
}

/*
 * THE RETENTION SWEEP'S OWN MONITORING (/ORACLE.md §15.2 item 4, closed
 * 2026-08-31).
 *
 * The nightly sweep (`routes/tutor.ts`'s `/retention/purge`, called by
 * `.github/workflows/tutor-retention.yml`) always reported what it deleted TO
 * ITS CALLER — but its caller is a GitHub Actions runner nobody watches, and
 * if the workflow's own schedule silently stopped firing (a token expiring, a
 * repo setting, GitHub's own scheduler being late — all of which have
 * happened to OTHER cron workflows in this project), nothing here would ever
 * have noticed. A 90-day deletion promise that quietly stops being kept is,
 * in this table's own words, "the one failure here with legal weight."
 *
 * `audit_logs` is the durable record, not a new table: it is already the
 * established place a completed action leaves a permanent, append-only trace
 * (`insertAuditLog`, `services/supabaseRest.ts`) that nothing else can rewrite
 * out from under it, and it needs no new migration to carry a system action —
 * `actor_id` has always accepted NULL. `getTutorRetentionStatus` reads the
 * single most recent row back and computes how stale it is, so an operator (or
 * a future automated check hitting this route) can tell "ran last night" from
 * "has not run in three days" without grepping Railway logs by hand.
 */

/** Written by `routes/tutor.ts` after every purge that reaches the database —
 * even one that deletes zero sessions, because "the sweep ran and found
 * nothing due" and "the sweep never ran" must be distinguishable (§1.14). */
export const RETENTION_SWEEP_AUDIT_ACTION = 'tutor.retention.swept';

export interface TutorRetentionStatus {
  lastRunAt: string | null;
  /** Null only when the sweep has NEVER recorded a run — see `stale` below. */
  hoursSinceLastRun: number | null;
  /**
   * True when the most recent run is older than `RETENTION_STALE_HOURS`, OR
   * when there is no recorded run at all. The two are deliberately the SAME
   * verdict: an operator checking this does not need "how would I even know
   * how long it's been broken" as a separate question from "is it broken" —
   * both mean the 90-day promise is not currently being kept.
   */
  stale: boolean;
  lastRunDetail: Record<string, unknown> | null;
}

/**
 * The workflow runs once nightly (`0 3 * * *` UTC). 36 hours is a day plus a
 * half-day of slack for an ordinary late run — a retried GitHub Actions queue,
 * a long batch that ran past midnight — without hiding an ACTUALLY missed
 * night, which is the one thing this exists to catch.
 */
const RETENTION_STALE_HOURS = 36;

interface AuditLogRow {
  created_at: string;
  detail: Record<string, unknown>;
}

/**
 * Reads the most recent recorded sweep. `null` means the READ itself failed
 * (an unreachable database) — distinct from a `stale: true` result, which
 * means the read succeeded and found nothing recent. Collapsing those two
 * would be exactly the "upstream did not answer" defaulting §1.14 forbids: a
 * database outage would report as "the sweep has never run," which is a
 * different, and differently alarming, claim than the one that would actually
 * be true.
 */
export async function getTutorRetentionStatus(): Promise<TutorRetentionStatus | null> {
  const rows = await serviceRest<AuditLogRow[]>(
    `/audit_logs?action=eq.${es(RETENTION_SWEEP_AUDIT_ACTION)}` +
      `&select=created_at,detail&order=created_at.desc&limit=1`,
  );
  if (rows === null) return null;

  const last = rows[0];
  if (!last) return { lastRunAt: null, hoursSinceLastRun: null, stale: true, lastRunDetail: null };

  const hoursSinceLastRun = (Date.now() - new Date(last.created_at).getTime()) / (1000 * 60 * 60);
  return {
    lastRunAt: last.created_at,
    hoursSinceLastRun,
    stale: hoursSinceLastRun > RETENTION_STALE_HOURS,
    lastRunDetail: last.detail,
  };
}

/**
 * `'conflict'` — a concurrent request already claimed the identical
 * candidate for this session; the caller must re-run its own ladder
 * selection against a fresh read and retry, never treat this as a hard
 * failure. `null` — a genuine transport/DB failure (§1.14: distinguishable
 * from an ordinary "someone else got there first").
 *
 * FOUND BY ADVERSARIAL REVIEW SWEEP tutor-review-sweep-101
 * (content-ladder-correctness dimension, HIGH). This used to be a plain
 * unconditional `POST /tutor_segments` carrying a `seq` the CALLER computed
 * from a snapshot taken before the whole content ladder ran — so two
 * concurrent requests for the same session, both reading the same
 * "already served" state, both deterministically chose the SAME candidate
 * (the tier-1 rotation is seeded on the session id, not on wall-clock time)
 * and both tried to insert at the SAME `seq`. `tutor_segments` has carried
 * `UNIQUE (session_id, seq)` since `0047_tutor_oracle.sql`, so the loser's
 * insert was rejected by PostgREST — and this function returned `null`
 * exactly as it does on any other transport failure, so the route answered
 * a perfectly valid, correctly-selected catalog hit with a manufactured
 * `502 DATA_UNAVAILABLE`.
 *
 * `insert_tutor_segment_checked` (migration 0064) recomputes the next `seq`
 * AND re-checks "has this exact segment already been served to this
 * session" fresh, inside a `pg_advisory_xact_lock` keyed on the SESSION (a
 * fourth, distinct salt from `award_tutor_xp` (0), `start_tutor_session_checked`
 * (1) and the learner-memory pair (2) — this invariant is per-session, not
 * per-learner, and must never contend with any of those three). An empty
 * result set is the conflict signal; the route's own retry loop is what
 * turns that into "the next distinct candidate" rather than a 502. See
 * `RUNBOOK.md` Round 109.
 */
export async function insertTutorSegmentChecked(input: {
  sessionId: string;
  sourceKey: string | null;
  origin: 'catalog' | 'bank' | 'live';
  lessonId: string | null;
  segmentType: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  keyVerified: boolean;
  provenance: Record<string, unknown>;
  reviewStatus: 'pending' | null;
}): Promise<TutorSegmentRow | 'conflict' | null> {
  const rows = await serviceRest<TutorSegmentRow[]>('/rpc/insert_tutor_segment_checked', {
    method: 'POST',
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_source_key: input.sourceKey,
      p_origin: input.origin,
      p_lesson_id: input.lessonId,
      p_segment_type: input.segmentType,
      p_payload: input.payload,
      p_answer: input.answer,
      p_key_verified: input.keyVerified,
      p_provenance: input.provenance,
      p_review_status: input.reviewStatus,
    }),
  });
  if (rows === null) return null;
  return rows.length > 0 ? rows[0]! : 'conflict';
}

export async function getTutorSegment(segmentId: string): Promise<TutorSegmentRow | null> {
  const rows = await serviceRest<TutorSegmentRow[]>(`/tutor_segments?id=eq.${eu(segmentId)}&select=*`);
  return rows?.[0] ?? null;
}

export async function listTutorSegments(sessionId: string): Promise<TutorSegmentRow[] | null> {
  return serviceRest<TutorSegmentRow[]>(
    `/tutor_segments?session_id=eq.${eu(sessionId)}&select=*&order=seq.asc`,
  );
}

export async function recordSegmentResult(input: {
  segmentId: string;
  score: number;
  xpAwarded: number;
  attempts: number;
}): Promise<boolean> {
  const res = await serviceRest<unknown>(`/tutor_segments?id=eq.${eu(input.segmentId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      score: input.score,
      xp_awarded: input.xpAwarded,
      attempts: input.attempts,
    }),
  });
  return res !== null;
}

/**
 * THE ONE-TIME EVIDENCE MARKER (found by adversarial review, 2026-08-30,
 * HIGH). A spoken answer checked by voice records real BKT/FSRS evidence
 * through `recordAttempt`, but never touches `tutor_segments.score` — so
 * nothing on the row told `/grade` this segment's answer had already been
 * scored for the mastery model when the SAME segment was then also graded
 * through the ordinary widget path. That second call ran `recordAttempt`
 * again for the identical real answer, double-counting one child's
 * interaction into the BKT posterior and the FSRS card. `/grade` now checks
 * `voice_checked_at` before calling `recordAttempt` and skips it when
 * already set — this is the write that sets it.
 *
 * Called ONLY after voice-check's own `recordAttempt` call has actually
 * succeeded (never after a failed upstream read, which recorded nothing to
 * guard against) — and guarded to a currently-null row so a later call never
 * clobbers an earlier, real timestamp. Best-effort like the rest of this
 * file's pedagogy writes: a failed PATCH here does not un-record the
 * evidence `recordAttempt` already wrote, it only means a subsequent
 * `/grade` call could still double-count on retry, which is why it is
 * logged loudly at the call site rather than silently swallowed.
 */
export async function markSegmentVoiceChecked(segmentId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/tutor_segments?id=eq.${eu(segmentId)}&voice_checked_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ voice_checked_at: new Date().toISOString() }),
  });
  return res !== null;
}

// ── Packs (ladder tier 2) ───────────────────────────────────────────────────

export interface TutorPackRow {
  id: string;
  skill_key: string;
  tier: number;
  locale: string;
  pack: Record<string, unknown>;
  status: string;
  /** C.6 columns (curated-pack migration); absent on an older schema. */
  pack_version?: number;
  content_hash?: string | null;
  source?: string;
}

/**
 * A PUBLISHED pack only.
 *
 * `status=eq.published` is not a filter to be relaxed for testing: a pack in
 * `review` has not been read by a human, and the whole point of tier 2 is that
 * one has. The lesson pipeline pins the same rule with a test and so does this.
 */
export async function findPublishedPack(
  skillKey: string,
  tier: number,
  locale: string,
): Promise<TutorPackRow | null> {
  const rows = await serviceRest<TutorPackRow[]>(
    `/tutor_packs?skill_key=eq.${es(skillKey)}&tier=eq.${tier}&locale=eq.${es(locale)}&status=eq.published&select=*&limit=1`,
  );
  return rows?.[0] ?? null;
}

// ── Safety flags ────────────────────────────────────────────────────────────

export async function insertSafetyFlag(input: {
  sessionId: string;
  userId: string;
  turnSeq: number | null;
  category: string;
  severity: string;
  handled: string;
}): Promise<boolean> {
  const res = await serviceRest<unknown>('/tutor_safety_flags', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      session_id: input.sessionId,
      user_id: input.userId,
      turn_seq: input.turnSeq,
      category: input.category,
      severity: input.severity,
      handled: input.handled,
    }),
  });
  return res !== null;
}

export interface SafetyFlagRow {
  id: string;
  session_id: string;
  user_id: string;
  turn_seq: number | null;
  category: string;
  severity: string;
  handled: string;
  created_at: string;
}

export async function listSafetyFlags(userId: string, limit = 50): Promise<SafetyFlagRow[] | null> {
  return serviceRest<SafetyFlagRow[]>(
    `/tutor_safety_flags?user_id=eq.${eu(userId)}&select=*&order=created_at.desc&limit=${Math.min(limit, 200)}`,
  );
}

// ── Placement safety flags (0065) ────────────────────────────────────────────
//
// The SECOND, separate flags table /ORACLE.md §4.1b's own "not yet done" note
// asked for: a flagged placement-intake utterance used to be a console.error
// and nothing else, because placement runs before any `tutor_sessions` row
// exists for `tutor_safety_flags.session_id` to name. Written from
// `routes/placement.ts`'s intake handler (the one place in that whole path
// with a real `user.id`/`course.id`), read from this file's own
// `listSafetyFlags`-shaped sibling below so the guardian-visibility route in
// `routes/tutor.ts` can surface both provenances without either learning the
// other's shape.

export async function insertPlacementSafetyFlag(input: {
  userId: string;
  courseId: string | null;
  category: string;
  severity: string;
}): Promise<boolean> {
  const res = await serviceRest<unknown>('/tutor_placement_safety_flags', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: input.userId,
      course_id: input.courseId,
      category: input.category,
      severity: input.severity,
    }),
  });
  return res !== null;
}

export interface PlacementSafetyFlagRow {
  id: string;
  user_id: string;
  course_id: string | null;
  category: string;
  severity: string;
  created_at: string;
}

export async function listPlacementSafetyFlags(
  userId: string,
  limit = 50,
): Promise<PlacementSafetyFlagRow[] | null> {
  return serviceRest<PlacementSafetyFlagRow[]>(
    `/tutor_placement_safety_flags?user_id=eq.${eu(userId)}&select=*&order=created_at.desc&limit=${Math.min(limit, 200)}`,
  );
}

// ── Trajectory emission (V4 harness backlog — /ORACLE.md §20.7, migration 0066) ──

export interface TrajectoryStepInput {
  turnSeq: number;
  eventKind: 'activity_result' | 'voice_result' | 'conversation_turn' | 'stated_misconception' | 'entry_opened';
  strategyBefore: string;
  strategy: string;
  skillName: string | null;
  scaffolding: number;
  difficulty: number;
  pKnown: number | null;
  misconceptionCode: string | null;
  kcId: string | null;
  kcMode: 'new' | 'review' | 'probe' | 'remediation' | null;
  /** C.10 evidence (absent from an Oracle build that predates it). */
  evidenceRule?: 'mastery' | 'remediation' | 'rescue' | null;
  evidenceObservations?: number | null;
  evidenceRequired?: number | null;
  /** GAP-FIX-R2: correct answers the evidence chain set aside (absent from an older Oracle). */
  evidenceDiscounted?: 'none' | 'too_fast' | 'hint_assisted' | 'too_fast_and_hint_assisted' | null;
  masteryRevoked?: boolean;
}

/**
 * Bulk-inserts one session's worth of controller decisions in ONE call.
 * Oracle batches the whole session (fire-and-forget, after it ends — see
 * `oracle/src/session/trajectory.ts`) rather than one call per turn, so this
 * never adds a request to the live turn path (§2.7 of oracle/AGENTS.md).
 *
 * `on_conflict=session_id,turn_seq` + `resolution=ignore-duplicates` is the
 * same idempotency idiom `insertTutorTurn` already uses against
 * `tutor_turns`, required for the same reason: `ws/server.ts`'s `finish()`
 * and `finalizeParked()` can both fire their own post-session work for one
 * session on a documented race (see that file's own comment on
 * `runPostSessionReview`), so this batch may legitimately be POSTed twice for
 * one session — both times with byte-identical rows, since it is Oracle's own
 * in-memory step log read twice, not two different reviews.
 *
 * `steps` is never empty by the time this is called (the emitter skips a
 * session where the controller never decided anything), but an empty array
 * is a safe no-op rather than an empty PostgREST bulk-insert body either way.
 */
export async function insertTutorTrajectory(
  userId: string,
  sessionId: string,
  steps: readonly TrajectoryStepInput[],
): Promise<boolean> {
  if (steps.length === 0) return true;
  const res = await serviceRest<unknown>('/tutor_trajectory_step?on_conflict=session_id,turn_seq', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(
      steps.map((step) => ({
        session_id: sessionId,
        user_id: userId,
        turn_seq: step.turnSeq,
        event_kind: step.eventKind,
        strategy_before: step.strategyBefore,
        strategy: step.strategy,
        skill_name: step.skillName,
        scaffolding: step.scaffolding,
        difficulty: step.difficulty,
        p_known: step.pKnown,
        misconception_code: step.misconceptionCode,
        kc_id: step.kcId,
        kc_mode: step.kcMode,
        evidence_rule: step.evidenceRule ?? null,
        evidence_observations: step.evidenceObservations ?? null,
        evidence_required: step.evidenceRequired ?? null,
        // Every row carries the same keys (a PostgREST bulk insert requires it); needs migration trajectory_discounted_evidence.
        evidence_discounted: step.evidenceDiscounted ?? null,
        mastery_revoked: step.masteryRevoked ?? false,
      })),
    ),
  });
  return res !== null;
}

// ── Daily budget (/ORACLE.md §15) ───────────────────────────────────────────

