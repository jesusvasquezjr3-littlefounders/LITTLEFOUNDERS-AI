import { z } from 'zod';
import { createHash } from 'node:crypto';
import { serviceRest } from './supabaseRest.js';

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

export async function createTutorSession(input: CreateSessionInput): Promise<TutorSessionRow | null> {
  const rows = await serviceRest<TutorSessionRow[]>('/tutor_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: input.userId,
      locale: input.locale,
      tier: input.tier,
      character: input.character,
      companion: input.companion,
      diorama: input.diorama,
      intent: input.intent,
      course_id: input.courseId,
      topic_id: input.topicId,
      skill_key: input.skillKey,
      voice_used: input.voiceUsed,
      consent_id: input.consentId,
    }),
  });
  return rows?.[0] ?? null;
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

export async function closeTutorSession(input: {
  sessionId: string;
  closeReason: string;
  turnCount: number;
  segmentCount: number;
  costUsd: number;
}): Promise<boolean> {
  const res = await serviceRest<unknown>(`/tutor_sessions?id=eq.${eu(input.sessionId)}&ended_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      ended_at: new Date().toISOString(),
      close_reason: input.closeReason,
      turn_count: input.turnCount,
      segment_count: input.segmentCount,
      cost_usd: input.costUsd,
    }),
  });
  return res !== null;
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
 * Write one store and its ledger row. Returns false if either write failed —
 * and the caller treats false as "the memory did not advance", never retrying
 * blindly: the review runs again after the next session anyway.
 */
export async function writeLearnerMemory(input: {
  userId: string;
  store: 'learner' | 'pedagogy';
  content: string;
  actor: string;
  sessionId: string | null;
}): Promise<boolean> {
  const existing = await serviceRest<{ content: string }[]>(
    `/learner_memory?user_id=eq.${eu(input.userId)}&store=eq.${input.store}&select=content`,
  );
  const before = existing?.[0]?.content ?? null;
  if (before === input.content) return true; // nothing new — no ledger noise

  const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
  const stored = await serviceRest<unknown>(`/learner_memory?on_conflict=user_id,store`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: input.userId,
      store: input.store,
      content: input.content,
      updated_at: new Date().toISOString(),
    }),
  });
  if (stored === null) return false;

  /*
   * The ledger row is what makes auto-write acceptable (owner decision
   * 2026-08-29): every belief the system holds about a child traces to the
   * write that created it. A failed ledger write is LOUD — the store already
   * changed, and an unaudited change is the one condition this table exists
   * to prevent.
   */
  const ledgered = await serviceRest<unknown>(`/learner_memory_ledger`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: input.userId,
      store: input.store,
      actor: input.actor,
      before_hash: before === null ? null : sha(before),
      after_hash: sha(input.content),
      session_id: input.sessionId,
    }),
  });
  if (ledgered === null) {
    console.error(
      `[tutor] learner_memory ledger write FAILED for user ${input.userId} store ${input.store} — the store changed without an audit row`,
    );
  }
  return true;
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
    }),
  });
  return res !== null;
}

export async function listTutorTurns(sessionId: string): Promise<TutorTurnRow[] | null> {
  return serviceRest<TutorTurnRow[]>(
    `/tutor_turns?session_id=eq.${eu(sessionId)}&select=id,session_id,seq,speaker,text,emotion,action,audio_path,source,created_at&order=seq.asc`,
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

/** Sessions the learner has already started today, in their own local date. */
export async function countSessionsSince(userId: string, sinceIso: string): Promise<number | null> {
  const rows = await serviceRest<{ id: string }[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&started_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
  );
  if (rows === null) return null;
  return rows.length;
}

