import { z } from 'zod';
import { restBatchedByIds, serviceRest, serviceRestRaw } from '../supabaseRest.js';
import type { DecisionRecord, JournalCandidate } from './decisionJournal.js';
import type { BridgeAction, BridgeAudience } from './familyBridge.js';

/*
 * B.9 / B.10 / B.13 (S05.3c) — every read and write the narrative layer and
 * the family bridge need. The rules stay pure in decisionJournal.ts,
 * courseNarrative.ts and familyBridge.ts.
 *
 * FAILURE POSTURE. Readers return null on an upstream failure; the routes that
 * SERVE these records answer 502. The two writes that ride on a learning
 * route (recording a decision after a grade, offering a bridge prompt after a
 * completion) are best-effort: they are logged and never fail a grade or a
 * completion that already committed. That also keeps this code deployable
 * before its migration is applied: until then the writes fail, are logged,
 * and learning is untouched.
 *
 * Only the service role reads these tables, after the route has checked who
 * is asking (the learner for their own journal and self prompts, a verified
 * guardian for a child's narrative and guardian prompts).
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

/** Decision counts per lesson, for the guardian narrative (counts only, never the choices). */
export async function journalCountsByLesson(userId: string, lessonIds: string[]): Promise<Map<string, number> | null> {
  const rows = await restBatchedByIds(lessonIds, (batch) =>
    serviceRest<Array<{ lesson_id: string }>>(`/learner_decision_journal?user_id=eq.${eu(userId)}&lesson_id=${inList(batch)}&select=lesson_id`));
  if (rows === null) return null;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.lesson_id, (counts.get(r.lesson_id) ?? 0) + 1);
  return counts;
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

// ── B.13 bridge prompts ───────────────────────────────────────────────────────

export async function offerBridgePrompt(input: {
  learnerId: string; audience: BridgeAudience; candidates: Array<{ kc_key: string; action: BridgeAction }>;
  courseId: string; topicId: string; lessonId: string; ttlDays: number; cooldownDays: number;
}): Promise<{ offered: boolean; prompt_id?: string; kc_key?: string } | null> {
  const response = await serviceRestRaw('/rpc/offer_learning_bridge_prompt', {
    method: 'POST',
    body: JSON.stringify({
      p_learner_id: Uuid.parse(input.learnerId), p_audience: input.audience, p_candidates: input.candidates,
      p_course_id: Uuid.parse(input.courseId), p_topic_id: Uuid.parse(input.topicId), p_lesson_id: Uuid.parse(input.lessonId),
      p_ttl_days: input.ttlDays, p_cooldown_days: input.cooldownDays,
    }),
  });
  const parsed = z.object({ offered: z.boolean(), prompt_id: z.string().optional(), kc_key: z.string().optional() }).passthrough().safeParse(response.body);
  return response.ok && parsed.success ? parsed.data : null;
}

const PromptRow = z.object({
  id: z.string(),
  learner_id: z.string(),
  kc_id: z.string(),
  action: z.enum(['savings_goal', 'earning_task']),
  audience: z.enum(['guardian', 'self']),
  course_id: z.string(),
  topic_id: z.string(),
  lesson_id: z.string().nullable(),
  status: z.enum(['open', 'acted', 'dismissed', 'expired']),
  created_at: z.string(),
  expires_at: z.string(),
}).passthrough();
export type PromptRow = z.infer<typeof PromptRow>;
const PROMPT_FIELDS = 'id,learner_id,kc_id,action,audience,course_id,topic_id,lesson_id,status,created_at,expires_at';

/** Open, unexpired prompts for one learner and audience, newest first. */
export async function listOpenBridgePrompts(learnerId: string, audience: BridgeAudience, now: Date = new Date()): Promise<PromptRow[] | null> {
  const rows = await serviceRest<unknown>(
    `/learning_bridge_prompts?learner_id=eq.${eu(learnerId)}&audience=eq.${audience}&status=eq.open&select=${PROMPT_FIELDS}&order=created_at.desc&limit=20`);
  const parsed = z.array(PromptRow).safeParse(rows);
  if (!parsed.success) return null;
  return parsed.data.filter((p) => p.learner_id === learnerId && p.audience === audience && p.status === 'open' && Date.parse(p.expires_at) > now.getTime());
}

/** undefined = the read failed; null = no such prompt. */
export async function getBridgePrompt(promptId: string): Promise<PromptRow | null | undefined> {
  const rows = await serviceRest<unknown>(`/learning_bridge_prompts?id=eq.${eu(promptId)}&select=${PROMPT_FIELDS}&limit=1`);
  const parsed = z.array(PromptRow).safeParse(rows);
  if (!parsed.success) return undefined;
  return parsed.data.find((p) => p.id === promptId) ?? null;
}

const ActResult = z.object({
  status: z.enum(['acted', 'closed', 'forbidden', 'not_found', 'dismissed', 'no_wallet']),
  replayed: z.boolean().optional(),
  task_id: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
}).passthrough();
export type BridgeActResult = z.infer<typeof ActResult>;

export async function actOnBridgePrompt(input: {
  promptId: string; actorId: string; title: string | null; amount: number | null; icon: string | null; recurrence: string | null;
}): Promise<BridgeActResult | null> {
  const response = await serviceRestRaw('/rpc/act_on_learning_bridge_prompt', {
    method: 'POST',
    body: JSON.stringify({
      p_prompt_id: Uuid.parse(input.promptId), p_actor_id: Uuid.parse(input.actorId),
      p_title: input.title, p_amount: input.amount, p_icon: input.icon, p_recurrence: input.recurrence,
    }),
  });
  const parsed = ActResult.safeParse(response.body);
  return response.ok && parsed.success ? parsed.data : null;
}

export async function dismissBridgePrompt(promptId: string, actorId: string): Promise<BridgeActResult | null> {
  const response = await serviceRestRaw('/rpc/dismiss_learning_bridge_prompt', {
    method: 'POST',
    body: JSON.stringify({ p_prompt_id: Uuid.parse(promptId), p_actor_id: Uuid.parse(actorId) }),
  });
  const parsed = ActResult.safeParse(response.body);
  return response.ok && parsed.success ? parsed.data : null;
}

export async function kcRowsByIds(ids: string[]): Promise<Map<string, KcRow> | null> {
  if (ids.length === 0) return new Map();
  const rows = await restBatchedByIds(ids, (batch) => serviceRest<unknown[]>(`/kc?id=${inList(batch)}&select=id,key,title,status`));
  const parsed = z.array(KcRow).safeParse(rows);
  return parsed.success ? new Map(parsed.data.map((k) => [k.id, k])) : null;
}

// ── B.10 guardian narrative inputs ───────────────────────────────────────────

const ProgressRow = z.object({ lesson_id: z.string(), passed: z.boolean(), completed_at: z.string().nullable().optional() }).passthrough();
const LessonRow = z.object({ id: z.string(), topic_id: z.string(), title: Localized, xp_total: z.number() }).passthrough();
const TopicRow = z.object({ id: z.string(), saga_id: z.string(), title: Localized }).passthrough();
const SagaRow = z.object({ id: z.string(), adventure_id: z.string() }).passthrough();
const AdventureRow = z.object({ id: z.string(), course_id: z.string() }).passthrough();
const CourseRow = z.object({ id: z.string(), title: Localized }).passthrough();
const AttemptRow = z.object({
  lesson_id: z.string(), segment_id: z.string(), score: z.number(), created_at: z.string(),
  hints_used: z.number().nullable().optional(), diagnostic_code: z.string().nullable().optional(),
}).passthrough();

export interface KidLearningRecord {
  /** Passed lessons with a completion time, newest first. */
  completions: Array<{ lessonId: string; completedAt: string }>;
  lessons: Map<string, z.infer<typeof LessonRow>>;
  topics: Map<string, z.infer<typeof TopicRow>>;
  courseTitleByTopic: Map<string, Record<string, unknown>>;
  /** Lesson ids per topic, over every published and unpublished lesson of the topics read. */
  lessonsByTopic: Map<string, string[]>;
  /** Lessons passed or placement-credited. */
  done: Set<string>;
}

/** Everything the guardian narrative needs about one child, read with the service role after the route's verified-guardian check. */
export async function readKidLearningRecord(kidId: string): Promise<KidLearningRecord | null> {
  const [progress, credits] = await Promise.all([
    serviceRest<unknown>(`/lesson_progress?user_id=eq.${eu(kidId)}&select=lesson_id,passed,completed_at`),
    serviceRest<unknown>(`/placement_credits?user_id=eq.${eu(kidId)}&select=lesson_id`),
  ]);
  const parsedProgress = z.array(ProgressRow).safeParse(progress);
  const parsedCredits = z.array(z.object({ lesson_id: z.string() }).passthrough()).safeParse(credits);
  if (!parsedProgress.success || !parsedCredits.success) return null;
  const completions = parsedProgress.data
    .filter((r) => r.passed && typeof r.completed_at === 'string')
    .map((r) => ({ lessonId: r.lesson_id, completedAt: r.completed_at as string }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const done = new Set([...parsedProgress.data.filter((r) => r.passed).map((r) => r.lesson_id), ...parsedCredits.data.map((r) => r.lesson_id)]);

  const lessonIds = [...new Set(completions.map((c) => c.lessonId))];
  const lessonRows = await restBatchedByIds(lessonIds, (batch) => serviceRest<unknown[]>(`/lessons?id=${inList(batch)}&select=id,topic_id,title,xp_total`));
  const lessonsParsed = z.array(LessonRow).safeParse(lessonRows);
  if (!lessonsParsed.success) return null;
  const topicIds = [...new Set(lessonsParsed.data.map((l) => l.topic_id))];
  const [topicRows, siblingRows] = await Promise.all([
    restBatchedByIds(topicIds, (batch) => serviceRest<unknown[]>(`/topics?id=${inList(batch)}&select=id,saga_id,title`)),
    restBatchedByIds(topicIds, (batch) => serviceRest<unknown[]>(`/lessons?topic_id=${inList(batch)}&select=id,topic_id,title,xp_total`)),
  ]);
  const topicsParsed = z.array(TopicRow).safeParse(topicRows);
  const siblingsParsed = z.array(LessonRow).safeParse(siblingRows);
  if (!topicsParsed.success || !siblingsParsed.success) return null;
  const sagaIds = [...new Set(topicsParsed.data.map((t) => t.saga_id))];
  const sagaRows = await restBatchedByIds(sagaIds, (batch) => serviceRest<unknown[]>(`/sagas?id=${inList(batch)}&select=id,adventure_id`));
  const sagasParsed = z.array(SagaRow).safeParse(sagaRows);
  if (!sagasParsed.success) return null;
  const adventureIds = [...new Set(sagasParsed.data.map((s) => s.adventure_id))];
  const adventureRows = await restBatchedByIds(adventureIds, (batch) => serviceRest<unknown[]>(`/adventures?id=${inList(batch)}&select=id,course_id`));
  const adventuresParsed = z.array(AdventureRow).safeParse(adventureRows);
  if (!adventuresParsed.success) return null;
  const courseIds = [...new Set(adventuresParsed.data.map((a) => a.course_id))];
  const courseRows = await restBatchedByIds(courseIds, (batch) => serviceRest<unknown[]>(`/courses?id=${inList(batch)}&select=id,title`));
  const coursesParsed = z.array(CourseRow).safeParse(courseRows);
  if (!coursesParsed.success) return null;

  const sagaById = new Map(sagasParsed.data.map((s) => [s.id, s]));
  const adventureById = new Map(adventuresParsed.data.map((a) => [a.id, a]));
  const courseById = new Map(coursesParsed.data.map((c) => [c.id, c]));
  const courseTitleByTopic = new Map<string, Record<string, unknown>>();
  for (const t of topicsParsed.data) {
    const course = courseById.get(adventureById.get(sagaById.get(t.saga_id)?.adventure_id ?? '')?.course_id ?? '');
    if (course) courseTitleByTopic.set(t.id, course.title);
  }
  const lessonsByTopic = new Map<string, string[]>();
  for (const l of siblingsParsed.data) lessonsByTopic.set(l.topic_id, [...(lessonsByTopic.get(l.topic_id) ?? []), l.id]);
  return {
    completions,
    lessons: new Map([...siblingsParsed.data, ...lessonsParsed.data].map((l) => [l.id, l])),
    topics: new Map(topicsParsed.data.map((t) => [t.id, t])),
    courseTitleByTopic,
    lessonsByTopic,
    done,
  };
}

export async function readKidAttempts(kidId: string, lessonIds: string[]): Promise<Array<z.infer<typeof AttemptRow>> | null> {
  const rows = await restBatchedByIds(lessonIds, (batch) => serviceRest<unknown[]>(
    `/lesson_segment_attempts?user_id=eq.${eu(kidId)}&lesson_id=${inList(batch)}&select=lesson_id,segment_id,score,created_at,hints_used,diagnostic_code`));
  const parsed = z.array(AttemptRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}
