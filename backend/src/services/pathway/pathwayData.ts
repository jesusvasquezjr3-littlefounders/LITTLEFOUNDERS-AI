import { z } from 'zod';
import { getConfig } from '../../config.js';
import type { AgeScreenState } from '../ageScreen.js';
import { getActiveKcs, getKcEdges, getLearnerMastery, getMemoryCards, type Localized } from '../pedagogy/kcData.js';
import { restBatchedByIds, serviceRest, serviceRestRaw } from '../supabaseRest.js';
import type { CoursePathwayInputs } from './coursePathway.js';
import { legacyCourseStage } from './coursePathway.js';
import {
  chapterPolicy,
  earnedStagesFromBadgeRows,
  learnerAgeEvidence,
  type AgeEvidence,
  type ChapterRowLite,
  type PathwayStage,
  type TopicKcs,
} from './pathwayPolicy.js';

/*
 * B.6 / S05.3b — every read and write the pathway engine needs, and nothing
 * else. coursePathway.ts stays pure; this module fetches its inputs.
 *
 * ONE BRAIN. The graph, the mastery and the review cards are the Mentor's own
 * rows, read with the Mentor's own accessors (pedagogy/kcData.ts) and filtered
 * the way the Mentor filters them: only ACTIVE KCs, and only edges whose two
 * ends are active. A topic link to a draft KC does not exist for a learner
 * until the owner activates that KC, exactly as for the Mentor.
 *
 * FAILURE POSTURE (§1.14). Every reader returns null on an upstream failure
 * and the routes answer 502. "Could not read the learner's mastery" is never
 * collapsed into "no mastery", which would re-lock work the learner has shown.
 */

export type CourseEngine = 'linear' | 'pathway';

/** COURSE_PATHWAY_ENGINE — the release switch OD-22 calls for. `linear` until the owner accepts the policy and the migrations are applied. */
export function courseEngine(): CourseEngine {
  return getConfig().COURSE_PATHWAY_ENGINE;
}

const Uuid = z.string().uuid();
const eu = (value: string): string => encodeURIComponent(Uuid.parse(value));
const STAGES = ['child', 'tween', 'teen', 'adult'] as const;

/** Everything about one learner the pathway rules read, shared by all of that learner's courses. */
export interface LearnerPathwayContext {
  age: AgeEvidence;
  mentorPKnown: Map<string, number>;
  dueReviewKcs: Set<string>;
  kcPrerequisites: Map<string, string[]>;
  kcKeyById: Map<string, string>;
  kcTitles: Map<string, Localized>;
  /** course_pathway_badges rows, by course id. */
  storedBadges: Map<string, Array<{ award_key: string; pathway_stage: string | null }>>;
  /** Course slugs whose badge the live full-course rule (or a stored row) grants today. */
  completedCourseSlugs: Set<string>;
  /** course_pathway_placements stages, by course id. */
  placedStages: Map<string, Set<PathwayStage>>;
  /** OD-24: ACTIVE KC keys credited by completed legacy topics (legacy_kc_credits). */
  legacyCreditedKcs: Set<string>;
}

const BadgeRows = z.array(z.object({
  course_id: z.string(),
  award_key: z.string(),
  pathway_stage: z.string().nullable(),
}).passthrough());
const PlacementRows = z.array(z.object({ course_id: z.string(), pathway_stage: z.enum(STAGES) }).passthrough());
const ProfileRows = z.array(z.object({ birth_date: z.string().nullable().optional() }).passthrough()).max(1);
const CompletedRows = z.array(z.object({ course_slug: z.string() }).passthrough());
const LegacyCreditRows = z.array(z.object({ kc_id: z.string() }).passthrough());

/** The badge RPC with its failure kept distinct from "no badges" (the older helper collapses both to []). */
export async function readCompletedCourseSlugs(userId: string): Promise<Set<string> | null> {
  const response = await serviceRestRaw('/rpc/get_completed_course_badges', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: Uuid.parse(userId) }),
  });
  const parsed = CompletedRows.safeParse(response.body);
  return response.ok && parsed.success ? new Set(parsed.data.map((row) => row.course_slug)) : null;
}

/**
 * Load one learner's pathway context. `ageScreen` is the server's own age
 * screening state (res.locals.ageScreen for the caller, readAgeScreen for a
 * guardian's kid); the birth date is read here with the service role and never
 * leaves Core — only the derived stage is ever served (S05.2a posture).
 */
export async function loadLearnerPathwayContext(userId: string, ageScreen: AgeScreenState, now = new Date()): Promise<LearnerPathwayContext | null> {
  if (!Uuid.safeParse(userId).success) return null;
  const [kcs, edges, mastery, cards, badges, placements, profiles, completed, legacyCredits] = await Promise.all([
    getActiveKcs(),
    getKcEdges(),
    getLearnerMastery(userId),
    getMemoryCards(userId),
    serviceRest<unknown>(`/course_pathway_badges?user_id=eq.${eu(userId)}&select=course_id,award_key,pathway_stage&limit=1000`),
    serviceRest<unknown>(`/course_pathway_placements?user_id=eq.${eu(userId)}&select=course_id,pathway_stage&limit=1000`),
    serviceRest<unknown>(`/profiles?user_id=eq.${eu(userId)}&select=birth_date&limit=1`),
    readCompletedCourseSlugs(userId),
    serviceRest<unknown>(`/legacy_kc_credits?user_id=eq.${eu(userId)}&select=kc_id&limit=10000`),
  ]);
  if (!kcs || !edges || !mastery || !cards || !completed) return null;
  const badgeRows = BadgeRows.safeParse(badges);
  const placementRows = PlacementRows.safeParse(placements);
  const profileRows = ProfileRows.safeParse(profiles);
  // A failed legacy-credit read is "unreachable", never "no credit": treating
  // it as none would re-lock work a learner completed before the cutover.
  const legacyRows = LegacyCreditRows.safeParse(legacyCredits);
  if (!badgeRows.success || !placementRows.success || !profileRows.success || !legacyRows.success) return null;

  const kcKeyById = new Map(kcs.map((kc) => [kc.id, kc.key]));
  const kcTitles = new Map(kcs.map((kc) => [kc.key, kc.title]));
  const kcPrerequisites = new Map<string, string[]>();
  for (const edge of edges) {
    // The Mentor's own rule (tutorMap/sessionPlan): an edge counts only when both ends are active.
    const from = kcKeyById.get(edge.prerequisite_kc_id);
    const to = kcKeyById.get(edge.dependent_kc_id);
    if (from && to) kcPrerequisites.set(to, [...(kcPrerequisites.get(to) ?? []), from]);
  }
  const mentorPKnown = new Map<string, number>();
  for (const row of mastery) {
    const key = kcKeyById.get(row.kc_id);
    if (key && Number.isFinite(row.p_known)) mentorPKnown.set(key, row.p_known);
  }
  const dueReviewKcs = new Set<string>();
  for (const card of cards) {
    const key = kcKeyById.get(card.kc_id);
    const due = Date.parse(card.due_at);
    if (key && Number.isFinite(due) && due <= now.getTime()) dueReviewKcs.add(key);
  }
  const storedBadges = new Map<string, Array<{ award_key: string; pathway_stage: string | null }>>();
  for (const row of badgeRows.data) storedBadges.set(row.course_id, [...(storedBadges.get(row.course_id) ?? []), row]);
  const legacyCreditedKcs = new Set<string>();
  for (const row of legacyRows.data) {
    const key = kcKeyById.get(row.kc_id);
    if (key) legacyCreditedKcs.add(key); // a draft or retired KC stays invisible, as for the Mentor
  }
  const placedStages = new Map<string, Set<PathwayStage>>();
  for (const row of placementRows.data) placedStages.set(row.course_id, new Set([...(placedStages.get(row.course_id) ?? []), row.pathway_stage]));

  const age = learnerAgeEvidence({
    birthDate: profileRows.data[0]?.birth_date ?? null,
    declaredBand: ageScreen.ageBand,
    protectedOrigin: ageScreen.protectedOrigin,
  }, now);
  return { age, mentorPKnown, dueReviewKcs, kcPrerequisites, kcKeyById, kcTitles, storedBadges, completedCourseSlugs: completed, placedStages, legacyCreditedKcs };
}

const ChapterRows = z.array(z.object({
  id: z.string(),
  course_id: z.string(),
  age_tier: z.string(),
  pathway_stage: z.string().nullable().optional(),
  eligibility_min_age: z.number().nullable().optional(),
  eligibility_max_age: z.number().nullable().optional(),
}).passthrough());
const LinkRows = z.array(z.object({ topic_id: z.string(), kc_id: z.string(), role: z.enum(['teaches', 'reviews']) }).passthrough());

/** Course-side inputs: chapter eligibility by adventure id, and ACTIVE topic→KC links by topic id. */
export interface PathwayContent {
  chapters: Map<string, ChapterRowLite & { course_id: string }>;
  topicKcs: Map<string, TopicKcs>;
}

export async function loadPathwayContent(adventureIds: string[], topicIds: string[], kcKeyById: ReadonlyMap<string, string>): Promise<PathwayContent | null> {
  const [chapterRows, linkRows] = await Promise.all([
    adventureIds.length === 0 ? Promise.resolve([]) : restBatchedByIds(adventureIds, (batch) => serviceRest<unknown[]>(
      `/adventures?id=in.(${batch.map(eu).join(',')})&select=id,course_id,age_tier,pathway_stage,eligibility_min_age,eligibility_max_age`,
    )),
    topicIds.length === 0 ? Promise.resolve([]) : restBatchedByIds(topicIds, (batch) => serviceRest<unknown[]>(
      `/topic_knowledge_components?topic_id=in.(${batch.map(eu).join(',')})&select=topic_id,kc_id,role`,
    )),
  ]);
  const chapters = ChapterRows.safeParse(chapterRows);
  const links = LinkRows.safeParse(linkRows);
  if (!chapters.success || !links.success) return null;
  const topicKcs = new Map<string, { teaches: string[]; reviews: string[] }>();
  for (const link of links.data) {
    const key = kcKeyById.get(link.kc_id);
    if (!key) continue; // a draft or retired KC: invisible, as for the Mentor
    const entry = topicKcs.get(link.topic_id) ?? { teaches: [], reviews: [] };
    (link.role === 'teaches' ? entry.teaches : entry.reviews).push(key);
    topicKcs.set(link.topic_id, entry);
  }
  for (const entry of topicKcs.values()) { entry.teaches.sort(); entry.reviews.sort(); }
  return { chapters: new Map(chapters.data.map((row) => [row.id, row])), topicKcs };
}

/**
 * The per-course inputs. Earned stages are the stored badges (B4/B5) plus,
 * when the live full-course rule grants the course badge today, the stage the
 * course's legacy chapters formed: a learner who holds the legacy badge is
 * never asked to earn the same stage twice.
 */
export function coursePathwayInputs(
  course: { id: string; slug: string },
  adventureIds: readonly string[],
  content: PathwayContent,
  ctx: LearnerPathwayContext,
  hasLegacyPlacement: boolean,
): CoursePathwayInputs {
  const chapters = new Map(adventureIds.flatMap((id) => {
    const row = content.chapters.get(id);
    return row ? [[id, row] as const] : [];
  }));
  const earnedStages = earnedStagesFromBadgeRows(ctx.storedBadges.get(course.id) ?? []);
  if (ctx.completedCourseSlugs.has(course.slug)) {
    const stage = legacyCourseStage([...chapters.values()].map((row) => chapterPolicy(row)));
    if (stage) earnedStages.add(stage);
  }
  return {
    chapters,
    topicKcs: content.topicKcs,
    kcPrerequisites: ctx.kcPrerequisites,
    age: ctx.age,
    mentorPKnown: ctx.mentorPKnown,
    dueReviewKcs: ctx.dueReviewKcs,
    earnedStages,
    placedStages: ctx.placedStages.get(course.id) ?? new Set(),
    hasLegacyPlacement,
    legacyCreditedKcs: ctx.legacyCreditedKcs,
  };
}

/**
 * Rule B4 — record an earned stage credential. Inserted once and never
 * updated or deleted: a replay is ignored by the primary key.
 */
export async function recordPathwayBadge(
  userId: string,
  courseId: string,
  award: { award_key: string; pathway_stage: string | null; basis: string },
  earnedAt = new Date(),
): Promise<boolean> {
  const result = await serviceRest<unknown>('/course_pathway_badges?on_conflict=user_id,course_id,award_key', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      user_id: Uuid.parse(userId),
      course_id: Uuid.parse(courseId),
      award_key: award.award_key,
      pathway_stage: award.pathway_stage,
      basis: award.basis,
      earned_at: earnedAt.toISOString(),
    }),
  });
  return result !== null;
}

const CompletedDates = z.array(z.object({ course_slug: z.string(), completed_at: z.string().nullable().optional() }).passthrough());

/**
 * Rule B5 after the migration's one-time backfill: freeze a badge the live
 * full-course rule grants now, as a `legacy` row for the stage the course's
 * legacy chapters form, dated when it was first earned. Returns true when
 * there is nothing to freeze or the row is stored (or already was).
 */
export async function freezeLegacyCourseBadge(userId: string, course: { id: string; slug: string }): Promise<boolean> {
  const [badges, chapters] = await Promise.all([
    serviceRestRaw('/rpc/get_completed_course_badges', { method: 'POST', body: JSON.stringify({ p_user_id: Uuid.parse(userId) }) }),
    serviceRest<unknown>(`/adventures?course_id=eq.${eu(course.id)}&select=id,course_id,age_tier,pathway_stage,eligibility_min_age,eligibility_max_age`),
  ]);
  const earned = CompletedDates.safeParse(badges.body);
  const rows = ChapterRows.safeParse(chapters);
  if (!badges.ok || !earned.success || !rows.success) return false;
  const badge = earned.data.find((row) => row.course_slug === course.slug);
  if (!badge) return true;
  const stage = legacyCourseStage(rows.data.map((row) => chapterPolicy(row)));
  const earnedAt = badge.completed_at ? new Date(badge.completed_at) : new Date();
  return recordPathwayBadge(userId, course.id, { award_key: 'legacy', pathway_stage: stage, basis: 'legacy_full_course' },
    Number.isFinite(earnedAt.getTime()) ? earnedAt : new Date());
}

export type PathwayPlacementCommit = 'created' | 'replayed' | 'conflict';

/** P6 — the stage-entry placement, written atomically with B.1's record and its credits. */
export async function commitCoursePathwayPlacement(row: {
  user_id: string;
  course_id: string;
  pathway_stage: PathwayStage;
  method: string;
  start_topic_id: string | null;
  start_lesson_id: string | null;
  credited_topics: number;
  claimed_level: string;
  education_level: string;
  quiz_answers: unknown;
}, lessonIds: readonly string[]): Promise<PathwayPlacementCommit | null> {
  const result = await serviceRest<unknown>('/rpc/commit_course_pathway_placement', {
    method: 'POST', body: JSON.stringify({ p_result: row, p_lesson_ids: lessonIds }),
  });
  return result === 'created' || result === 'replayed' || result === 'conflict' ? result : null;
}

/** A guardian's view of a kid's placement rows, service role, after the verified-link guard. */
export async function readLearnerPlacementState(userId: string, courseId: string): Promise<{ hasLegacyPlacement: boolean; creditedLessonIds: Set<string> } | null> {
  const [placements, credits] = await Promise.all([
    serviceRest<unknown>(`/course_placements?user_id=eq.${eu(userId)}&course_id=eq.${eu(courseId)}&select=course_id&limit=1`),
    serviceRest<unknown>(`/placement_credits?user_id=eq.${eu(userId)}&course_id=eq.${eu(courseId)}&select=lesson_id&limit=5000`),
  ]);
  const p = z.array(z.object({ course_id: z.string() }).passthrough()).safeParse(placements);
  const c = z.array(z.object({ lesson_id: z.string() }).passthrough()).safeParse(credits);
  if (!p.success || !c.success) return null;
  return { hasLegacyPlacement: p.data.length > 0, creditedLessonIds: new Set(c.data.map((row) => row.lesson_id)) };
}
