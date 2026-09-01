/*
 * PostgREST accessors for the Tutor v3 knowledge-component tables (0052).
 * Service role only — every table here is service-role-write by design, and
 * the reads happen inside internal or owner-scoped routes.
 *
 * FAILURE POSTURE (§1.14): every reader returns null on an upstream failure,
 * never an empty default. The pedagogy pipeline reads, modifies and writes
 * back — collapsing "Vault did not answer" into "no mastery yet" would let a
 * transient blip reset a learner's posterior to the prior.
 */

import { serviceRest } from '../supabaseRest.js';
import type { BktParams } from './bkt.js';

const eu = (v: string): string => encodeURIComponent(v);

export type Localized = Partial<Record<'en-US' | 'es-MX' | 'pt-BR', string>>;

export interface KcRow {
  id: string;
  key: string;
  strand: 'money_math' | 'entrepreneurship';
  title: Localized;
  objective: Localized;
  tier_min: number;
  p_l0: number;
  p_t: number;
  p_g: number;
  p_s: number;
  skill_key: string | null;
}

const KC_FIELDS = 'id,key,strand,title,objective,tier_min,p_l0,p_t,p_g,p_s,skill_key';

/** PostgREST serializes numeric columns as JSON numbers; coerce defensively anyway. */
function coerceKc(row: KcRow): KcRow {
  return { ...row, p_l0: Number(row.p_l0), p_t: Number(row.p_t), p_g: Number(row.p_g), p_s: Number(row.p_s) };
}

export function paramsOf(kc: KcRow, override?: Partial<BktParams> | null): BktParams {
  return {
    pL0: override?.pL0 ?? kc.p_l0,
    pT: override?.pT ?? kc.p_t,
    pG: override?.pG ?? kc.p_g,
    pS: override?.pS ?? kc.p_s,
  };
}

export async function getActiveKcs(): Promise<KcRow[] | null> {
  const rows = await serviceRest<KcRow[]>(`/kc?status=eq.active&select=${KC_FIELDS}&limit=1000`);
  return rows === null ? null : rows.map(coerceKc);
}

/**
 * Whether `skillKey` names a real KC, at any status — and, separately,
 * whether that could even be determined.
 *
 * Found by adversarial review, round 47 (2026-08-30, HIGH): `weak_skill`'s
 * `skillKey` had no server-side existence check at all — a route comment
 * claimed one happened "downstream," and it did not. Deliberately not
 * restricted to `status=eq.active`: a `retired` KC is a real, previously-
 * taught skill, not injected text, and whether a retired KC should still be
 * OFFERABLE is round 37's own separate, deliberately-unresolved product
 * question (`RUNBOOK.md`) — this check exists only to distinguish a real
 * identifier from an arbitrary string, not to re-litigate that question.
 *
 * `'error' | 'not_found'` are kept apart on purpose (§1.14): a transient
 * read failure must refuse the session (502) rather than either silently
 * rejecting a real learner's real skillKey as invalid (400) or — worse —
 * treating "could not check" as "must be fine" and letting an unverified
 * string through to a child's tutor session anyway.
 */
export type KcLookup = { status: 'found'; kc: KcRow } | { status: 'not_found' } | { status: 'error' };

export async function getKcBySkillKey(skillKey: string): Promise<KcLookup> {
  const rows = await serviceRest<KcRow[]>(`/kc?skill_key=eq.${eu(skillKey)}&select=${KC_FIELDS}&limit=1`);
  if (rows === null) return { status: 'error' };
  return rows[0] ? { status: 'found', kc: coerceKc(rows[0]) } : { status: 'not_found' };
}

export interface KcEdgeRow {
  prerequisite_kc_id: string;
  dependent_kc_id: string;
}

export function getKcEdges(): Promise<KcEdgeRow[] | null> {
  return serviceRest<KcEdgeRow[]>('/kc_edge?select=prerequisite_kc_id,dependent_kc_id&limit=5000');
}

export interface MisconceptionRow {
  id: string;
  kc_id: string;
  code: string;
  remediation_hint: Localized;
  distractor_patterns: { numeric?: string[]; option_tags?: string[] };
}

export function getMisconceptionsForKcs(kcIds: string[]): Promise<MisconceptionRow[] | null> {
  if (kcIds.length === 0) return Promise.resolve([]);
  return serviceRest<MisconceptionRow[]>(
    `/misconception?kc_id=in.(${kcIds.map(eu).join(',')})&select=id,kc_id,code,remediation_hint,distractor_patterns`,
  );
}

export interface MasteryRow {
  kc_id: string;
  p_known: number;
  attempts: number;
  correct: number;
  params_override: Partial<BktParams> | null;
}

export async function getLearnerMastery(userId: string): Promise<MasteryRow[] | null> {
  const rows = await serviceRest<MasteryRow[]>(
    `/learner_kc_mastery?user_id=eq.${eu(userId)}&select=kc_id,p_known,attempts,correct,params_override&limit=1000`,
  );
  return rows === null ? null : rows.map((r) => ({ ...r, p_known: Number(r.p_known) }));
}

export async function upsertLearnerMastery(
  userId: string,
  kcId: string,
  patch: { p_known: number; attempts: number; correct: number; last_attempt_at: string },
): Promise<boolean> {
  const res = await serviceRest<unknown>('/learner_kc_mastery?on_conflict=user_id,kc_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, kc_id: kcId, ...patch, updated_at: new Date().toISOString() }),
  });
  return res !== null;
}

export interface MemoryCardRow {
  kc_id: string;
  state: 'new' | 'learning' | 'review' | 'relearning';
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due_at: string;
  last_review_at: string | null;
}

export async function getMemoryCards(userId: string): Promise<MemoryCardRow[] | null> {
  const rows = await serviceRest<MemoryCardRow[]>(
    `/memory_card?user_id=eq.${eu(userId)}&select=kc_id,state,stability,difficulty,reps,lapses,due_at,last_review_at&limit=1000`,
  );
  return rows === null
    ? null
    : rows.map((r) => ({ ...r, stability: Number(r.stability), difficulty: Number(r.difficulty) }));
}

export async function upsertMemoryCard(userId: string, kcId: string, card: MemoryCardRow): Promise<boolean> {
  const res = await serviceRest<unknown>('/memory_card?on_conflict=user_id,kc_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, ...card }),
  });
  return res !== null;
}

/** Read-then-write evidence bump; PostgREST has no atomic increment and this counter is advisory. */
export async function recordLearnerMisconception(userId: string, misconceptionId: string): Promise<boolean> {
  const existing = await serviceRest<Array<{ evidence_count: number }>>(
    `/learner_misconception?user_id=eq.${eu(userId)}&misconception_id=eq.${eu(misconceptionId)}&select=evidence_count`,
  );
  if (existing === null) return false;
  const count = (existing[0]?.evidence_count ?? 0) + 1;
  const res = await serviceRest<unknown>('/learner_misconception?on_conflict=user_id,misconception_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      misconception_id: misconceptionId,
      evidence_count: count,
      last_seen_at: new Date().toISOString(),
      resolved_at: null,
    }),
  });
  return res !== null;
}

/** Mark a learner's misconception resolved after clean evidence against it. */
export async function resolveLearnerMisconception(userId: string, misconceptionId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(
    `/learner_misconception?user_id=eq.${eu(userId)}&misconception_id=eq.${eu(misconceptionId)}&resolved_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ resolved_at: new Date().toISOString() }),
    },
  );
  return res !== null;
}

export interface KcAttemptInsert {
  user_id: string;
  kc_id: string;
  session_id: string | null;
  segment_id: string | null;
  source: 'segment_grade' | 'voice_check';
  correct: boolean;
  score: number | null;
  strategy: string | null;
  misconception_id: string | null;
  p_known_before: number;
  p_known_after: number;
}

export async function insertKcAttempt(row: KcAttemptInsert): Promise<boolean> {
  const res = await serviceRest<unknown>('/kc_attempt', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

export interface KcAttemptForSessions {
  session_id: string | null;
  kc_id: string;
  correct: boolean;
  created_at: string;
}

/**
 * This page's own evidence rows, for the guardian "what is happening"
 * narrative (/ORACLE.md §12, 2026-09-01). Bounded to the session ids the
 * caller is already displaying — never a learner-wide scan — and capped
 * defensively like every other list read in this file. `session_id` is
 * nullable on the wire (the column is `ON DELETE SET NULL`, migration
 * `0052`) even though every row THIS query can match necessarily has one,
 * by construction of the `in.(...)` filter — kept honest rather than
 * asserted away.
 */
export function getKcAttemptsForSessions(sessionIds: string[]): Promise<KcAttemptForSessions[] | null> {
  if (sessionIds.length === 0) return Promise.resolve([]);
  return serviceRest<KcAttemptForSessions[]>(
    `/kc_attempt?session_id=in.(${sessionIds.map(eu).join(',')})` +
      '&select=session_id,kc_id,correct,created_at&limit=1000',
  );
}

/**
 * Titles only, by id, for a small set already named by other evidence (the
 * narrative above). Deliberately NOT status-filtered: a retired KC is a
 * real, previously-taught skill, not injected text — the same reasoning
 * `getKcBySkillKey` already established above (round 47).
 */
export function getKcTitlesByIds(kcIds: string[]): Promise<Array<{ id: string; title: Localized }> | null> {
  if (kcIds.length === 0) return Promise.resolve([]);
  return serviceRest<Array<{ id: string; title: Localized }>>(
    `/kc?id=in.(${kcIds.map(eu).join(',')})&select=id,title&limit=1000`,
  );
}

/*
 * AGGREGATE READERS — ACROSS EVERY LEARNER, not one. Every other reader in
 * this file is scoped `user_id=eq.<one learner>` because its caller is a live
 * session or a guardian view. These two exist for `tutorCurator.ts`'s
 * propose-only curation report (V4 harness backlog: "the skill distiller/
 * curator loop") and are deliberately UNSCOPED — reading across all learners
 * with the service role, the same posture `seed-kc-graph.ts` and
 * `audit-content-bridge.ts` already use for their own operator-only reads.
 * Nothing here writes; both tables' RLS still restricts every OTHER caller
 * (a learner or their guardian) to their own rows (0052).
 *
 * Aggregated in application code rather than via a SQL view or RPC: table
 * sizes here are small (an early-stage product) and this runs on an
 * operator's own schedule, not a request path, so a second migration to add
 * a view is not warranted for what a `.reduce()` already does correctly
 * (§1.14 — prefer the boring, cheap, verifiable path).
 */

export interface KcMasteryAggregateRow {
  kcId: string;
  learnerCount: number;
  totalAttempts: number;
  totalCorrect: number;
  /** Mean of each learner's own BKT posterior, not attempt-weighted — one learner's long streak should not drown out another's. */
  avgPKnown: number;
}

/** Every `learner_kc_mastery` row with at least one real attempt, aggregated per KC. `null` on a failed read — never collapsed to an empty report (§1.14): a curation tool that cannot see real data must say so, not report a false "nothing to curate". */
export async function getAggregateMasteryByKc(): Promise<KcMasteryAggregateRow[] | null> {
  const rows = await serviceRest<{ kc_id: string; p_known: number; attempts: number; correct: number }[]>(
    '/learner_kc_mastery?select=kc_id,p_known,attempts,correct&attempts=gt.0&limit=20000',
  );
  if (rows === null) return null;

  const byKc = new Map<string, { learners: number; attempts: number; correct: number; pKnownSum: number }>();
  for (const row of rows) {
    const agg = byKc.get(row.kc_id) ?? { learners: 0, attempts: 0, correct: 0, pKnownSum: 0 };
    agg.learners += 1;
    agg.attempts += row.attempts;
    agg.correct += row.correct;
    agg.pKnownSum += Number(row.p_known);
    byKc.set(row.kc_id, agg);
  }
  return [...byKc.entries()].map(([kcId, agg]) => ({
    kcId,
    learnerCount: agg.learners,
    totalAttempts: agg.attempts,
    totalCorrect: agg.correct,
    avgPKnown: agg.pKnownSum / agg.learners,
  }));
}

export interface MisconceptionEvidenceAggregateRow {
  misconceptionId: string;
  learnerCount: number;
  totalEvidenceCount: number;
  resolvedCount: number;
}

/** Every `learner_misconception` row across every learner, aggregated per misconception id. `null` on a failed read, for the same reason as `getAggregateMasteryByKc` above. */
export async function getAggregateMisconceptionEvidence(): Promise<MisconceptionEvidenceAggregateRow[] | null> {
  const rows = await serviceRest<{ misconception_id: string; evidence_count: number; resolved_at: string | null }[]>(
    '/learner_misconception?select=misconception_id,evidence_count,resolved_at&limit=20000',
  );
  if (rows === null) return null;

  const byMisconception = new Map<string, { learners: number; evidence: number; resolved: number }>();
  for (const row of rows) {
    const agg = byMisconception.get(row.misconception_id) ?? { learners: 0, evidence: 0, resolved: 0 };
    agg.learners += 1; // one row IS one (learner, misconception) pair — the primary key of the table
    agg.evidence += row.evidence_count;
    if (row.resolved_at !== null) agg.resolved += 1;
    byMisconception.set(row.misconception_id, agg);
  }
  return [...byMisconception.entries()].map(([misconceptionId, agg]) => ({
    misconceptionId,
    learnerCount: agg.learners,
    totalEvidenceCount: agg.evidence,
    resolvedCount: agg.resolved,
  }));
}
