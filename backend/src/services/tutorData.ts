import { z } from 'zod';
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
  return rows?.[0] ?? null;
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
 * Adds XP to a session's running total.
 *
 * READ-MODIFY-WRITE, and it REFUSES on a failed read rather than defaulting to
 * zero — §1.14's exact rule, and the exact shape of the bug that once erased a
 * child's XP, minutes, lessons and both streak columns behind a 200.
 */
export async function addSessionXp(sessionId: string, delta: number): Promise<boolean> {
  const session = await getTutorSession(sessionId);
  if (session === null) return false;
  const res = await serviceRest<unknown>(`/tutor_sessions?id=eq.${eu(sessionId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ xp_awarded: session.xp_awarded + delta }),
  });
  return res !== null;
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

/** XP already granted from tutor sessions since a cutoff, for the daily cap. */
export async function tutorXpSince(userId: string, sinceIso: string): Promise<number | null> {
  const rows = await serviceRest<{ xp_awarded: number }[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&started_at=gte.${encodeURIComponent(sinceIso)}&select=xp_awarded`,
  );
  if (rows === null) return null;
  return rows.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
}
