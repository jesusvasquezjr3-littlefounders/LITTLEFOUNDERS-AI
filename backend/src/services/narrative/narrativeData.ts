import { z } from 'zod';
import { restBatchedByIds, serviceRest, serviceRestRaw } from '../supabaseRest.js';
import type { DecisionRecord, JournalCandidate } from './decisionJournal.js';

/*
 * B.9 (S05.3c) — every read and write the narrative layer needs. The rules
 * stay pure in decisionJournal.ts.
 *
 * FAILURE POSTURE. Readers return null on an upstream failure; the routes that
 * SERVE these records answer 502. The write that rides on a learning route
 * (recording a decision after a grade) is best-effort: it is logged and never
 * fails a grade that already committed.
 *
 * Only the service role reads these tables, after the route has checked who
 * is asking (the learner, for their own journal).
 */

const Uuid = z.string().uuid();
const eu = (value: string): string => encodeURIComponent(Uuid.parse(value));
const inList = (ids: readonly string[]): string => `in.(${ids.map((id) => Uuid.parse(id)).join(',')})`;
const Localized = z.record(z.string(), z.unknown());

// ── B.9 journal ───────────────────────────────────────────────────────────────

export async function recordDecisions(input: {
  userId: string; courseId: string; topicId: string; lessonId: string; locale: string; decisions: DecisionRecord[];
}): Promise<boolean> {
  if (input.decisions.length === 0) return true;
  const response = await serviceRestRaw('/rpc/record_learner_decisions', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: Uuid.parse(input.userId), p_course_id: Uuid.parse(input.courseId), p_topic_id: Uuid.parse(input.topicId),
      p_lesson_id: Uuid.parse(input.lessonId), p_locale: input.locale, p_decisions: input.decisions,
    }),
  });
  return response.ok;
}

const JournalRow = z.object({
  id: z.string(),
  course_id: z.string(),
  topic_id: z.string(),
  lesson_id: z.string(),
  segment_type: z.string(),
  locale: z.string(),
  situation_text: z.string(),
  first_choice_id: z.string(),
  first_choice_text: z.string(),
  choice_id: z.string(),
  choice_text: z.string(),
  outcome_text: z.string().nullable(),
  times_decided: z.number(),
  first_recorded_at: z.string(),
  recorded_at: z.string(),
}).passthrough();
export type JournalRow = z.infer<typeof JournalRow>;
const JOURNAL_FIELDS = 'id,course_id,topic_id,lesson_id,segment_type,locale,situation_text,first_choice_id,first_choice_text,choice_id,choice_text,outcome_text,times_decided,first_recorded_at,recorded_at';
const ResurfacingRow = z.object({ entry_id: z.string(), lesson_id: z.string() }).passthrough();

/** How many candidates a lesson open considers. The journal keeps everything; resurfacing looks at the recent past. */
const CANDIDATE_WINDOW = 200;

export async function journalCandidates(userId: string, courseId: string): Promise<{ candidates: JournalCandidate[]; rows: Map<string, JournalRow> } | null> {
  const [rows, resurfaced] = await Promise.all([
    serviceRest<unknown>(`/learner_decision_journal?user_id=eq.${eu(userId)}&course_id=eq.${eu(courseId)}&select=${JOURNAL_FIELDS}&order=recorded_at.desc&limit=${CANDIDATE_WINDOW}`),
    serviceRest<unknown>(`/learner_decision_resurfacings?user_id=eq.${eu(userId)}&select=entry_id,lesson_id`),
  ]);
  const parsedRows = z.array(JournalRow).safeParse(rows);
  const parsedResurfaced = z.array(ResurfacingRow).safeParse(resurfaced);
  if (!parsedRows.success || !parsedResurfaced.success) return null;
  const byEntry = new Map<string, string[]>();
  for (const r of parsedResurfaced.data) byEntry.set(r.entry_id, [...(byEntry.get(r.entry_id) ?? []), r.lesson_id]);
  return {
    candidates: parsedRows.data.filter((r) => r.course_id === courseId).map((r) => ({
      id: r.id, lessonId: r.lesson_id, topicId: r.topic_id, courseId: r.course_id, recordedAt: r.recorded_at,
      resurfacedIn: byEntry.get(r.id) ?? [],
    })),
    rows: new Map(parsedRows.data.map((r) => [r.id, r])),
  };
}

export async function recordResurfacing(entryId: string, lessonId: string, userId: string): Promise<boolean> {
  const response = await serviceRestRaw('/learner_decision_resurfacings?on_conflict=entry_id,lesson_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ entry_id: Uuid.parse(entryId), lesson_id: Uuid.parse(lessonId), user_id: Uuid.parse(userId) }),
  });
  return response.ok;
}

export async function listJournal(userId: string, limit: number, offset: number): Promise<{ rows: JournalRow[]; resurfaced: Map<string, number>; hasMore: boolean } | null> {
  const [rows, resurfaced] = await Promise.all([
    serviceRest<unknown>(`/learner_decision_journal?user_id=eq.${eu(userId)}&select=${JOURNAL_FIELDS}&order=recorded_at.desc&limit=${limit + 1}&offset=${offset}`),
    serviceRest<unknown>(`/learner_decision_resurfacings?user_id=eq.${eu(userId)}&select=entry_id,lesson_id`),
  ]);
  const parsedRows = z.array(JournalRow).safeParse(rows);
  const parsedResurfaced = z.array(ResurfacingRow).safeParse(resurfaced);
  if (!parsedRows.success || !parsedResurfaced.success) return null;
  const counts = new Map<string, number>();
  for (const r of parsedResurfaced.data) counts.set(r.entry_id, (counts.get(r.entry_id) ?? 0) + 1);
  return { rows: parsedRows.data.slice(0, limit), resurfaced: counts, hasMore: parsedRows.data.length > limit };
}

/** The learner's own right to clear their story. Progress, scores and XP are untouched. */
export async function clearJournal(userId: string): Promise<boolean> {
  const response = await serviceRestRaw(`/learner_decision_journal?user_id=eq.${eu(userId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return response.ok;
}

// ── Shared: the B.6 topic → knowledge-component links ─────────────────────────

const LinkRow = z.object({ topic_id: z.string(), kc_id: z.string(), role: z.string(), is_primary: z.boolean().optional() }).passthrough();
const KcRow = z.object({ id: z.string(), key: z.string(), title: Localized, status: z.string() }).passthrough();
export type KcRow = z.infer<typeof KcRow>;

/**
 * Every knowledge component each topic TEACHES, primary first, including
 * draft components (a component's review status does not change what a topic
 * teaches; retired ones are excluded). Null on a failed read, or before the
 * B.6 migrations exist.
 */
export async function topicTeaches(topicIds: string[]): Promise<Map<string, KcRow[]> | null> {
  if (topicIds.length === 0) return new Map();
  const links = await restBatchedByIds(topicIds, (batch) =>
    serviceRest<unknown[]>(`/topic_knowledge_components?topic_id=${inList(batch)}&select=topic_id,kc_id,role,is_primary`));
  const parsedLinks = z.array(LinkRow).safeParse(links);
  if (!parsedLinks.success) return null;
  const teaching = parsedLinks.data.filter((l) => l.role === 'teaches');
  const kcIds = [...new Set(teaching.map((l) => l.kc_id))];
  const kcs = kcIds.length === 0 ? [] : await restBatchedByIds(kcIds, (batch) =>
    serviceRest<unknown[]>(`/kc?id=${inList(batch)}&select=id,key,title,status`));
  const parsedKcs = z.array(KcRow).safeParse(kcs);
  if (!parsedKcs.success) return null;
  const kcById = new Map(parsedKcs.data.filter((k) => k.status !== 'retired').map((k) => [k.id, k]));
  const out = new Map<string, KcRow[]>();
  const ordered = [...teaching].sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || a.kc_id.localeCompare(b.kc_id));
  for (const link of ordered) {
    const kc = kcById.get(link.kc_id);
    if (!kc) continue;
    out.set(link.topic_id, [...(out.get(link.topic_id) ?? []), kc]);
  }
  return out;
}
