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
