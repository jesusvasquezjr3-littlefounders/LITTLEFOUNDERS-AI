import { z } from 'zod';
import { createHash } from 'node:crypto';
import { countServiceRows, serviceRest } from './supabaseRest.js';

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
  granted_by: string;
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

export async function listTutorSessions(userId: string, limit = 30): Promise<TutorSessionRow[] | null> {
  return serviceRest<TutorSessionRow[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&select=*&order=started_at.desc&limit=${Math.min(limit, 100)}`,
  );
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
 * `WireWhiteboard`; the two packages share no types, so the shape is
 * duplicated deliberately rather than imported.
 */
export interface TutorTurnWhiteboard {
  kind: 'sequence';
  start: number;
  steps: { op: 'add' | 'subtract' | 'multiply_percent'; value: number }[];
  unit: 'day' | 'week' | 'month' | 'year';
  values: number[];
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
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
    }),
  });
  return res !== null;
}

export async function listTutorTurns(sessionId: string): Promise<TutorTurnRow[] | null> {
  return serviceRest<TutorTurnRow[]>(
    `/tutor_turns?session_id=eq.${eu(sessionId)}&select=id,session_id,seq,speaker,text,emotion,action,audio_path,source,created_at,whiteboard&order=seq.asc`,
  );
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

export async function insertTutorSegment(input: {
  sessionId: string;
  seq: number;
  origin: 'catalog' | 'bank' | 'live';
  lessonId: string | null;
  segmentType: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  keyVerified: boolean;
  provenance: Record<string, unknown>;
  reviewStatus: 'pending' | null;
}): Promise<TutorSegmentRow | null> {
  const rows = await serviceRest<TutorSegmentRow[]>('/tutor_segments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      session_id: input.sessionId,
      seq: input.seq,
      origin: input.origin,
      lesson_id: input.lessonId,
      segment_type: input.segmentType,
      payload: input.payload,
      answer: input.answer,
      key_verified: input.keyVerified,
      provenance: input.provenance,
      review_status: input.reviewStatus,
    }),
  });
  return rows?.[0] ?? null;
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

export async function countSessionSegments(sessionId: string): Promise<number | null> {
  const rows = await serviceRest<{ seq: number }[]>(
    `/tutor_segments?session_id=eq.${eu(sessionId)}&select=seq&order=seq.desc&limit=1`,
  );
  if (rows === null) return null;
  return rows[0] === undefined ? 0 : rows[0].seq + 1;
}

// ── Packs (ladder tier 2) ───────────────────────────────────────────────────

export interface TutorPackRow {
  id: string;
  skill_key: string;
  tier: number;
  locale: string;
  pack: Record<string, unknown>;
  status: string;
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

// ── Daily budget (/ORACLE.md §15) ───────────────────────────────────────────

