import { requireAgeScreen } from '../middleware/ageScreen.js';
import {
  getRolesForGate,
  hasActiveAnalyticsConsent,
  insertLearningEvents,
  stampRole,
} from '../services/insights.js';
import { Router, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { getConfig } from '../config.js';
import { authedUser, requireAuth, type AuthedUser } from '../middleware/auth.js';
import { GRADERS, KEYLESS_GRADERS } from '../lesson-contract/registry.js';
import { verdictFrom } from '../lesson-contract/core/types.js';
import { assembleCourseTree, findLessonNode, summarizeCourseTree, type CourseTree } from '../services/courseTree.js';
import { completableSegmentIds, findGradingSegment, pickLessonLocale, stripAnswers, xpBySegmentId } from '../services/lessonDocument.js';
import { isCalendarDate } from '../services/streak.js';
import { lessonEligibilityForBirthDate } from '../services/lessonEligibility.js';
import { getTutorPreferences } from '../services/tutorData.js';
import { readAgeScreen, type AgeScreenState } from '../services/ageScreen.js';
import { applyCoursePathway, lessonChapterAccess, pathwayBadgeAward, type PathwayCourseTree, type PathwayView } from '../services/pathway/coursePathway.js';
import { projectCoursePath } from '../services/pathway/coursePathProjection.js';
import {
  courseEngine,
  coursePathwayInputs,
  freezeLegacyCourseBadge,
  loadLearnerPathwayContext,
  loadPathwayContent,
  recordPathwayBadge,
  type LearnerPathwayContext,
} from '../services/pathway/pathwayData.js';
import { chapterPolicy, coursePrerequisiteDecision, resolvePathway } from '../services/pathway/pathwayPolicy.js';
import { gradeV2Visual, projectV2MentorStage, stripV2MentorStage, v2CompletionRequiredSegmentIds, v2CpaAttemptPrerequisiteSegmentId, v2FirstUnaidedStage, v2GradePrerequisiteSegmentId, validateV2LessonForGrading } from '../services/v2LessonDocument.js';
import { mintLessonAttemptToken, reissueLessonAttemptToken, verifyLessonAttemptToken } from '../services/lessonAttemptToken.js';
import { getOwnLearnerIntelligence, recordExperimentExposure } from '../services/learningIntel.js';
import {
  completeLesson,
  completeV2Lesson,
  createV2LessonAttemptNonces,
  createV2LessonRun,
  getV2LessonAttemptNoncesForRecovery,
  getV2LessonRunForRecovery,
  getV2MetSegmentReceiptsForRecovery,
  recordLessonGrade,
  recordV2CpaGrade,
  recordV2LessonGrade,
  recordV2FirstUnaidedStage,
  getAdventureById,
  getAdventuresByCourseIds,
  getCoursePlacement,
  getCompletedCourseBadgesByUserId,
  getCoursePlacementsForCourses,
  getFullOwnProfile,
  getCurrentV2LessonDocumentLocales,
  getV2LessonDocumentVersion,
  getLessonById,
  getLessonDocumentLocales,
  getLessonProgressForLessons,
  getLessonsByTopicIds,
  getPlacementCreditsForCourse,
  getPlacementCreditsForCourses,
  getPublishedCourseById,
  getPublishedCourseBySlug,
  getPublishedCourseRows,
  recordCourseAssemblyIncident,
  getSagaById,
  getSagasByAdventureIds,
  getSegmentAttempts,
  getTopicById,
  getTopicsBySagaIds,
  type CourseHierarchyRow,
  type LessonHierarchyRow,
  type LessonDocumentRow,
} from '../services/supabaseRest.js';

/*
 * /api/v1/learn — server-authoritative course tree, lesson delivery and
 * grading (COURSE_ENGINE.md §2, LESSON_ENGINE.md §6-§7). Core is the ONLY
 * place unlock state and scores are computed; the client never re-derives
 * either. Grading reuses the frontend's pure validators via
 * ../lesson-contract/ (a parity-checked copy — no workspaces, /AGENTS.md §1.2).
 */

const NOT_FOUND = 'NOT_FOUND';

/** Applies an exact v2 age policy before delivery or any progress mutation. */
function hasV2LessonEligibility(res: Response, schemaVersion: number, document: unknown, birthDate: string | null | undefined): boolean {
  if (schemaVersion !== 2) return true;
  const eligibility = lessonEligibilityForBirthDate(document, birthDate);
  if (eligibility === 'eligible') return true;
  if (eligibility === 'invalid-policy') fail(res, 409, 'LESSON_ELIGIBILITY_MISSING', 'This lesson cannot open yet');
  else if (eligibility === 'unknown-age') fail(res, 403, 'LESSON_AGE_ELIGIBILITY_REQUIRED', 'Age eligibility is required for this lesson');
  else fail(res, 403, 'LESSON_AGE_RESTRICTED', 'This lesson is not available for this age');
  return false;
}

/** v2 is off until a deployment explicitly provisions its independent signer. */
function lessonAttemptSecret(): string | null {
  return getConfig().LESSON_ATTEMPT_SECRET ?? null;
}

/** One selection rule for delivery and every mutation: an activated v2 version wins; otherwise use v1. */
async function getEffectiveLessonDocumentLocales(lessonId: string): Promise<LessonDocumentRow[] | null> {
  const v2Docs = await getCurrentV2LessonDocumentLocales(lessonId);
  if (v2Docs === null || v2Docs.length > 0) return v2Docs;
  return getLessonDocumentLocales(lessonId);
}

/** A learner's course tree: the linear tree, or the pathway tree with its `pathway` view (COURSE_PATHWAY_ENGINE). */
export type LearnerCourseTree = CourseTree & { pathway?: PathwayView };

export interface LearnerCourseLoad {
  tree: LearnerCourseTree;
  /** Present in pathway mode: the learner's graph context, reused by the B.2 check and badge settlement. */
  pathway: LearnerPathwayContext | null;
}

/**
 * The pathway engine's inputs for one learner (B.6, S05.3b). Null in linear
 * mode; 'unreachable' when any read failed — never a silent linear fallback,
 * which would hand a minor chapters the safeguard closes.
 */
async function learnerPathwayContext(userId: string, ageScreen: AgeScreenState | undefined): Promise<LearnerPathwayContext | null | 'unreachable'> {
  if (courseEngine() !== 'pathway') return null;
  const screen = ageScreen ?? await readAgeScreen(userId);
  if (!screen) return 'unreachable';
  return await loadLearnerPathwayContext(userId, screen) ?? 'unreachable';
}

/**
 * Fetch the full published hierarchy for one course + this user's progress,
 * and assemble the per-user tree. In pathway mode the tree's lock state,
 * progress and placement gate come from the pathway engine instead of the
 * flat order. Returns null on a downstream fetch failure.
 */
export async function loadLearnerCourse(accessToken: string, userId: string, course: CourseHierarchyRow, ageScreen?: AgeScreenState): Promise<LearnerCourseLoad | null> {
  const adventures = await getAdventuresByCourseIds(accessToken, [course.id]);
  if (!adventures) return null;
  const sagas = await getSagasByAdventureIds(
    accessToken,
    adventures.map((a) => a.id),
  );
  if (!sagas) return null;
  const topics = await getTopicsBySagaIds(
    accessToken,
    sagas.map((s) => s.id),
  );
  if (!topics) return null;
  const lessons = await getLessonsByTopicIds(
    accessToken,
    topics.map((t) => t.id),
  );
  if (!lessons) return null;
  const progress = await getLessonProgressForLessons(
    accessToken,
    userId,
    lessons.map((l) => l.id),
  );
  if (!progress) return null;
  // Placement (0043): fetched fresh on every tree assembly — a credit
  // granted mid-session (or the placement result itself) must be reflected
  // on the very next read, never cached.
  const [placement, credits] = await Promise.all([
    getCoursePlacement(accessToken, userId, course.id),
    getPlacementCreditsForCourse(accessToken, userId, course.id),
  ]);
  if (placement === null || credits === null) return null;
  const placementCreditedLessonIds = new Set(credits.map((c) => c.lesson_id));
  const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress, placementCreditedLessonIds, placement.length > 0);
  const ctx = await learnerPathwayContext(userId, ageScreen);
  if (ctx === 'unreachable') return null;
  if (!ctx) return { tree, pathway: null };
  const content = await loadPathwayContent(adventures.map((a) => a.id), topics.map((t) => t.id), ctx.kcKeyById);
  if (!content) return null;
  const inputs = coursePathwayInputs(course, adventures.map((a) => a.id), content, ctx, placement.length > 0);
  return { tree: applyCoursePathway(tree, inputs), pathway: ctx };
}

/** The tree alone (placement, lesson context and the refreshed tree after a completion). */
export async function loadCourseTree(accessToken: string, userId: string, course: CourseHierarchyRow, ageScreen?: AgeScreenState): Promise<LearnerCourseTree | null> {
  return (await loadLearnerCourse(accessToken, userId, course, ageScreen))?.tree ?? null;
}

/**
 * Why a lesson cannot be opened, graded or completed right now, or null. The
 * same decision for all four lesson endpoints: a lesson in a chapter the age
 * safeguard closes (P4) is age-restricted whatever the learner has shown; any
 * other locked lesson is simply not on the frontier yet.
 */
export function lessonAdmissionRefusal(tree: LearnerCourseTree, lessonId: string): { code: string; message: string } | null {
  const node = findLessonNode(tree, lessonId);
  if (tree.pathway && lessonChapterAccess(tree as PathwayCourseTree, lessonId) === 'closed') {
    return { code: 'LESSON_AGE_RESTRICTED', message: 'This lesson is not available for this age' };
  }
  if (node?.state === 'locked') return { code: 'LESSON_LOCKED', message: 'This lesson is still locked' };
  if (tree.course.placementRequired) return { code: 'PLACEMENT_REQUIRED', message: "Complete this course's placement quiz first" };
  return null;
}

/**
 * Rule B4/B5 — make every badge the learner holds right now permanent, after
 * any write that can complete a course (a lesson completion, a placement) and
 * on the course read, so an interrupted write converges on the next visit.
 * Idempotent: rows are keyed by (learner, course, award) and never updated.
 *
 *  - A completed pathway records its stage credential.
 *  - A badge the live full-course rule grants that is not stored yet is frozen
 *    as `legacy` for the stage the course's legacy chapters form, so growing
 *    the catalog can never revoke it (OD-9). The migration froze every badge
 *    that existed when it ran; this covers badges earned after it.
 * Pathway mode only: the linear engine keeps the pre-B.6 behavior exactly and
 * must run before the B.6 tables exist. A failed write is logged and retried
 * on the next read; it never fails the learner's completion, which is already
 * committed.
 */
export async function settleCourseBadges(userId: string, course: CourseHierarchyRow, load: LearnerCourseLoad): Promise<void> {
  if (!load.tree.pathway || !load.pathway) return;
  const writes: Array<Promise<boolean>> = [];
  const award = pathwayBadgeAward(load.tree.pathway);
  if (award) writes.push(recordPathwayBadge(userId, course.id, award));
  const stored = load.pathway.storedBadges.get(course.id) ?? [];
  // Any stored row already makes the badge permanent (the badge RPC reads stored rows), so only an
  // UNSTORED live badge is frozen — never a legacy row invented from a stage credential.
  if (!award && stored.length === 0 && load.pathway.completedCourseSlugs.has(course.slug)) {
    writes.push(freezeLegacyCourseBadge(userId, course));
  }
  const results = await Promise.all(writes);
  if (results.some((stored) => !stored)) console.error(`[backend] could not record a course badge for "${course.slug}"; it will be retried on the next read`);
}

type CourseEntry =
  | { kind: 'open'; load: LearnerCourseLoad }
  | { kind: 'refused'; status: number; code: string; message: string; details?: Record<string, unknown> };

/*
 * B.2: course-level prerequisites are ENFORCED, not dormant. A course whose
 * declared `requires` are not met refuses to open, naming the missing
 * prerequisites so the learner knows exactly what to finish first.
 * Enforcement is on the entry point only: the shelf keeps listing the course
 * (it is a real, reachable course, with a visible first step), and earned
 * progress stays earned.
 *
 * Linear engine (S05.2ba): every declared prerequisite needs its badge.
 * Pathway engine (B.6 rule P7, S05.3b): a badge of the required course from
 * ANY stage satisfies it, a frozen legacy badge included; it is WAIVED when
 * the learner's pathway in the required course would be a younger bridge (a
 * teen or an adult facing a children's course), because OD-16 never makes an
 * older learner complete another stage's chapters; what that course teaches
 * still reaches them through the shared graph. The age safeguard runs first:
 * a course with no chapter open to this learner refuses with
 * COURSE_AGE_RESTRICTED before anything else is decided.
 */
async function courseEntry(user: AuthedUser, course: CourseHierarchyRow, ageScreen: AgeScreenState | undefined): Promise<CourseEntry> {
  const requires = Array.isArray(course.requires) ? course.requires.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0) : [];
  if (courseEngine() !== 'pathway') {
    if (requires.length > 0) {
      const completed = await getCompletedCourseBadgesByUserId(user.id);
      const completedSlugs = new Set(completed.map((badge) => badge.course_slug));
      const missing = requires.filter((slug) => !completedSlugs.has(slug));
      if (missing.length > 0) {
        return { kind: 'refused', status: 409, code: 'COURSE_PREREQUISITE_REQUIRED', message: 'Finish the prerequisite course first', details: { missingPrerequisites: missing } };
      }
    }
    const load = await loadLearnerCourse(user.accessToken, user.id, course, ageScreen);
    if (!load) return { kind: 'refused', status: 502, code: 'INTERNAL', message: 'Content service unreachable' };
    return { kind: 'open', load };
  }

  const load = await loadLearnerCourse(user.accessToken, user.id, course, ageScreen);
  if (!load || !load.tree.pathway || !load.pathway) return { kind: 'refused', status: 502, code: 'INTERNAL', message: 'Content service unreachable' };
  if (load.tree.pathway.basis === 'unavailable') {
    return { kind: 'refused', status: 403, code: 'COURSE_AGE_RESTRICTED', message: 'This course is not available for this age yet' };
  }
  const missing: string[] = [];
  for (const slug of requires) {
    const decision = await prerequisiteDecision(user.accessToken, slug, load.pathway);
    if (decision === 'unreachable') return { kind: 'refused', status: 502, code: 'INTERNAL', message: 'Content service unreachable' };
    if (decision === 'missing') missing.push(slug);
  }
  if (missing.length > 0) {
    return { kind: 'refused', status: 409, code: 'COURSE_PREREQUISITE_REQUIRED', message: 'Finish the prerequisite course first', details: { missingPrerequisites: missing } };
  }
  await settleCourseBadges(user.id, course, load);
  return { kind: 'open', load };
}

/** Rule P7 for one declared prerequisite, from the learner's own graph context. */
async function prerequisiteDecision(accessToken: string, slug: string, ctx: LearnerPathwayContext): Promise<'satisfied' | 'waived-younger-stage' | 'missing' | 'unreachable'> {
  if (ctx.completedCourseSlugs.has(slug)) return 'satisfied';
  const required = await getPublishedCourseBySlug(accessToken, slug);
  // An unpublished or unknown prerequisite can never be earned: it stays missing, as under the linear rule.
  if (!required) return 'missing';
  if ((ctx.storedBadges.get(required.id) ?? []).length > 0) return 'satisfied';
  const adventures = await getAdventuresByCourseIds(accessToken, [required.id]);
  if (!adventures) return 'unreachable';
  const content = await loadPathwayContent(adventures.map((a) => a.id), [], ctx.kcKeyById);
  if (!content) return 'unreachable';
  const inputs = coursePathwayInputs(required, adventures.map((a) => a.id), content, ctx, false);
  const resolution = resolvePathway(ctx.age, adventures.map((a) => {
    const row = content.chapters.get(a.id);
    return { id: a.id, policy: row ? chapterPolicy(row) : null };
  }));
  return coursePrerequisiteDecision(resolution, inputs.earnedStages);
}

/*
 * EVERY COURSE'S TREE, IN ONE PASS PER LEVEL.
 *
 * loadCourseTree walks adventures -> sagas -> topics -> lessons -> progress,
 * and each step needs the ids the step before returned, so that chain is
 * genuinely serial. What was NOT necessary was paying for it once per course:
 * GET /learn/courses awaited the whole chain for every published course in
 * turn, which is ~18 sequential round-trips for three courses and measured
 * 2.0-2.4 s in production, in front of the /learn spinner.
 *
 * The levels are the same five reads either way — they just take every
 * course's ids at once, which the helpers already accept (`ByCourseIds`,
 * `BySagaIds`, ...). Seven round-trips total, and CRUCIALLY the same ONE
 * request in flight at a time: running the courses concurrently instead would
 * multiply Core's outbound PostgREST connections by a number that content
 * controls, against a pool whose production size lives only in Railway.
 *
 * Trees are assembled and handed back one course at a time so the caller can
 * summarise and drop each one; peak memory stays at the raw rows plus a single
 * tree rather than every tree at once, and Railway bills Core on memory.
 *
 * Returns assembled trees and isolated per-course failures. The caller owns
 * the learner response and the staff signal, so neither can be forgotten.
 */
export interface CourseAssemblyFailure {
  course: CourseHierarchyRow;
  /** True only for the course the shelf would have selected before this failure. */
  featured: boolean;
}

export interface CourseTreeLoad {
  trees: Map<string, LearnerCourseTree>;
  failures: CourseAssemblyFailure[];
}

function featuredCourseId(
  courses: readonly CourseHierarchyRow[],
  lessonsByCourse: ReadonlyMap<string, readonly { id: string }[]>,
  progress: readonly { lesson_id: string; passed: boolean }[],
): string | null {
  const passedLessonIds = new Set(progress.filter((row) => row.passed).map((row) => row.lesson_id));
  const summaries = courses.map((course) => {
    const lessonIds = lessonsByCourse.get(course.id)?.map((lesson) => lesson.id) ?? [];
    const passed = lessonIds.filter((id) => passedLessonIds.has(id)).length;
    return { course, passed, total: lessonIds.length };
  });
  return summaries.find(({ passed, total }) => passed > 0 && passed < total)?.course.id
    ?? summaries.find(({ passed, total }) => passed < total)?.course.id
    ?? summaries[0]?.course.id
    ?? null;
}

export async function loadCourseTrees(
  accessToken: string,
  userId: string,
  courses: readonly CourseHierarchyRow[],
  ageScreen?: AgeScreenState,
): Promise<CourseTreeLoad | null> {
  if (courses.length === 0) return { trees: new Map(), failures: [] };

  const courseIds = courses.map((c) => c.id);
  const adventures = await getAdventuresByCourseIds(accessToken, courseIds);
  if (!adventures) return null;
  const sagas = await getSagasByAdventureIds(accessToken, adventures.map((a) => a.id));
  if (!sagas) return null;
  const topics = await getTopicsBySagaIds(accessToken, sagas.map((s) => s.id));
  if (!topics) return null;
  const lessons = await getLessonsByTopicIds(accessToken, topics.map((t) => t.id));
  if (!lessons) return null;
  const progress = await getLessonProgressForLessons(accessToken, userId, lessons.map((l) => l.id));
  if (!progress) return null;
  // Placement (0043) is read fresh every time, never cached: a credit granted
  // mid-session must show on the very next read.
  const placements = await getCoursePlacementsForCourses(accessToken, userId, courseIds);
  if (!placements) return null;
  const credits = await getPlacementCreditsForCourses(accessToken, userId, courseIds);
  if (!credits) return null;
  // Pathway mode (B.6): one learner context and one content read for the
  // whole shelf, like every level above.
  const ctx = await learnerPathwayContext(userId, ageScreen);
  if (ctx === 'unreachable') return null;
  const content = ctx ? await loadPathwayContent(adventures.map((a) => a.id), topics.map((t) => t.id), ctx.kcKeyById) : null;
  if (ctx && !content) return null;

  // Regroup by course. Doing this in memory is what buys the round-trips back:
  // every row above was fetched once for the whole shelf.
  const adventuresByCourse = groupBy(adventures, (a) => a.course_id);
  const sagasByAdventure = groupBy(sagas, (s) => s.adventure_id);
  const topicsBySaga = groupBy(topics, (t) => t.saga_id);
  const lessonsByTopic = groupBy(lessons, (l) => l.topic_id);
  const placedCourseIds = new Set(placements.map((p) => p.course_id));
  const creditsByCourse = groupBy(credits, (c) => c.course_id);

  const lessonsByCourse = new Map<string, LessonHierarchyRow[]>();
  for (const course of courses) {
    const courseAdventures = adventuresByCourse.get(course.id) ?? [];
    const courseSagas = courseAdventures.flatMap((a) => sagasByAdventure.get(a.id) ?? []);
    const courseTopics = courseSagas.flatMap((sg) => topicsBySaga.get(sg.id) ?? []);
    lessonsByCourse.set(course.id, courseTopics.flatMap((topic) => lessonsByTopic.get(topic.id) ?? []));
  }
  const featuredId = featuredCourseId(courses, lessonsByCourse, progress);

  const trees = new Map<string, LearnerCourseTree>();
  const failures: CourseAssemblyFailure[] = [];
  for (const course of courses) {
    const courseAdventures = adventuresByCourse.get(course.id) ?? [];
    const courseSagas = courseAdventures.flatMap((a) => sagasByAdventure.get(a.id) ?? []);
    const courseTopics = courseSagas.flatMap((sg) => topicsBySaga.get(sg.id) ?? []);
    const courseLessons = lessonsByCourse.get(course.id) ?? [];
    const courseLessonIds = new Set(courseLessons.map((l) => l.id));
    /*
     * Assembly is the only PER-COURSE failure left. Every read above is one
     * request for the whole shelf, so a read that fails takes the request down
     * (502, below) — correctly, because that is the content service being
     * unreachable rather than one bad row. But malformed rows for a single
     * course can still throw in here, and one course's data must not be able
     * to empty a learner's whole shelf.
     */
    try {
      const tree = assembleCourseTree(
        course,
        courseAdventures,
        courseSagas,
        courseTopics,
        courseLessons,
        progress.filter((row) => courseLessonIds.has(row.lesson_id)),
        new Set((creditsByCourse.get(course.id) ?? []).map((c) => c.lesson_id)),
        placedCourseIds.has(course.id),
      );
      const adventureIds = courseAdventures.map((a) => a.id);
      trees.set(course.id, ctx && content
        ? applyCoursePathway(tree, coursePathwayInputs(course, adventureIds, content, ctx, placedCourseIds.has(course.id)))
        : tree);
    } catch (error) {
      console.warn(`[backend] course tree assembly failed for "${course.slug}":`, error);
      failures.push({ course, featured: course.id === featuredId });
    }
  }
  return { trees, failures };
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

interface LessonContext {
  lessonRow: { id: string; slug: string; title: Record<string, unknown>; difficulty: number; xp_total: number; estimated_minutes: number };
  topic: { id: string; slug: string };
  course: CourseHierarchyRow;
  tree: LearnerCourseTree;
}

/** Walk lesson -> topic -> saga -> adventure -> course, then build that course's tree, to resolve one lesson's unlock state (endpoints 3-5). */
async function resolveLessonContext(accessToken: string, userId: string, lessonId: string, ageScreen?: AgeScreenState): Promise<'not_found' | 'unreachable' | LessonContext> {
  const lesson = await getLessonById(accessToken, lessonId);
  if (!lesson) return 'not_found';
  const topic = await getTopicById(accessToken, lesson.topic_id);
  if (!topic) return 'not_found';
  const saga = await getSagaById(accessToken, topic.saga_id);
  if (!saga) return 'not_found';
  const adventure = await getAdventureById(accessToken, saga.adventure_id);
  if (!adventure) return 'not_found';
  const course = await getPublishedCourseById(accessToken, adventure.course_id);
  if (!course) return 'not_found';
  const tree = await loadCourseTree(accessToken, userId, course, ageScreen);
  if (!tree) return 'unreachable';
  if (!findLessonNode(tree, lessonId)) return 'not_found';
  return { lessonRow: lesson, topic, course, tree };
}

export function learnRouter(): Router {
  const router = Router();
  router.use(requireAuth, requireAgeScreen);

  // Future Tutor-ready boundary. It returns only the caller's derived skill
  // state, never raw events, answers, or another learner's data.
  router.get('/personalization', async (_req, res) => {
    const user = authedUser(res);
    const states = await getOwnLearnerIntelligence(user.id);
    if (states === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Learning intelligence unavailable');
    return ok(res, {
      recommendation: states[0] ?? null,
      states,
    });
  });

  const ExperimentExposureBody = z.object({
    experiment_id: z.string().uuid(),
    surface: z.enum(['learn', 'tasks', 'profile', 'tutor']),
    target: z.string().regex(/^[a-z0-9._-]{1,64}$/),
  });

  // A treatment is recorded only after it rendered. Kid experimentation uses
  // the same active guardian analytics consent as behavioural measurement.
  router.post('/experiments/exposure', async (req, res) => {
    const parsed = ExperimentExposureBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid exposure');
    const user = authedUser(res);
    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    if (roles.includes('kid') && await hasActiveAnalyticsConsent(user.id) !== true) {
      return ok(res, { recorded: false }, 202);
    }
    const exposure = await recordExperimentExposure({
      userId: user.id,
      experimentId: parsed.data.experiment_id,
      surface: parsed.data.surface,
      target: parsed.data.target,
    });
    if (exposure === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Experiment exposure unavailable');
    return ok(res, { recorded: true, ...exposure });
  });

  // 1. GET /courses — published courses + rollup progress for the caller.
  router.get('/courses', async (_req, res) => {
    const user = authedUser(res);
    const courseRows = await getPublishedCourseRows(user.accessToken);
    if (!courseRows) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    /*
     * ONE SICK COURSE USED TO EMPTY THE WHOLE SHELF.
     *
     * This loop returned 502 the moment any course's tree failed to assemble,
     * so a learner with a perfectly healthy course in progress got a blank
     * /learn because some OTHER course could not be read. Drop that course
     * instead and serve the rest: it is unopenable anyway — its tree is what
     * the course page and every lesson gate need — and README's "failure must
     * be distinguishable from emptiness" rule names display-only reads as
     * exactly the case where degrading is the right answer. It is logged, so
     * the failure is visible to us even though the shelf keeps working.
     *
     * If EVERY course fails it still 502s below: that is a content-service
     * outage, not one bad row, and a learner deserves an error rather than an
     * empty product.
     *
     * ONE PASS PER LEVEL, not one pass per course. This endpoint awaited the
     * whole adventures -> sagas -> topics -> lessons -> progress chain once per
     * published course — ~18 sequential round-trips for three courses, and
     * 2.0-2.4 s measured in production, in front of the /learn spinner with the
     * SPA's own tree fetch still queued behind it. loadCourseTrees asks each
     * level for every course's ids at once: seven round-trips, whatever the
     * catalogue grows to, with the same ONE request in flight at a time.
     *
     * Concurrency was the obvious alternative and the wrong one: it multiplies
     * Core's outbound PostgREST connections by a number CONTENT controls,
     * against a pool whose production size lives only in Railway, which turns a
     * slow screen into the all-or-nothing 502 of the 2026-08-10 incident.
     *
     * Still wasteful, and left alone on purpose: summarizeCourseTree reads
     * exactly three numbers off each tree (adventure count, lesson total,
     * passed), so this assembles 8 adventures x 5 sagas x 327 topics x 475
     * lessons — placement probes and all — to produce them. Counting instead
     * would dwarf this, but `lessons` has no course_id (0007 dropped it), so
     * the level walk is the only way to enumerate a course's lessons without a
     * migration, and `progress` counts real passes UNION placement credits.
     * Getting that union wrong misreports every learner silently.
     */
    const loaded = await loadCourseTrees(user.accessToken, user.id, courseRows, res.locals.ageScreen as AgeScreenState);
    if (!loaded) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    /*
     * B.3 requires every dropped course to become a staff-visible operational
     * signal. This counter is deliberately independent from the learner's
     * response: an incident-write outage must not take the healthy shelf down.
     */
    if (loaded.failures.length > 0) {
      const signals = await Promise.allSettled(
        loaded.failures.map(({ course }) => recordCourseAssemblyIncident(course.id)),
      );
      for (const [index, signal] of signals.entries()) {
        if (signal.status === 'rejected' || signal.value !== true) {
          console.error(`[backend] could not record course assembly incident for "${loaded.failures[index]!.course.slug}"`);
        }
      }
    }

    const courses = [];
    for (const course of courseRows) {
      const tree = loaded.trees.get(course.id);
      if (!tree) {
        console.warn(`[backend] /learn/courses: dropped "${course.slug}" — tree unavailable`);
        continue;
      }
      const summary = summarizeCourseTree(course, tree);
      courses.push({
        id: summary.id,
        slug: summary.slug,
        title: summary.title,
        lessonCount: summary.lessonCount,
        subject: summary.subject,
        badgeAsset: summary.badgeAsset,
        // 0048 — a live course still missing narration/art says so on its card.
        // This handler re-lists the summary's fields by hand rather than
        // spreading it, so a field added to CourseSummary is NOT automatically
        // served: `inProgress` was computed correctly and silently dropped here,
        // and the badge never rendered in production.
        inProgress: summary.inProgress,
        adventureCount: summary.adventureCount,
        progress: summary.progress,
        // B.6 pathway mode only: the learner's stage and how this course
        // serves it. `unavailable` is the age safeguard (a 9-year-old and a
        // teen-only course); the shelf still lists it so nothing vanishes.
        ...(tree.pathway ? {
          pathway: {
            learnerStage: tree.pathway.learnerStage,
            pathwayStage: tree.pathway.pathwayStage,
            basis: tree.pathway.basis,
            recommendedLessonId: tree.nextLessonId,
          },
        } : {}),
      });
    }

    // Every published course failed to assemble: that is the content service
    // being down, not one bad row, and an empty shelf would report an outage
    // as "there are no courses" — the emptiness README warns about.
    if (courseRows.length > 0 && courses.length === 0) {
      return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    }

    const unavailableFeaturedCourse = loaded.failures.find(({ featured }) => featured)?.course;
    return ok(res, {
      courses,
      ...(unavailableFeaturedCourse ? {
        unavailableFeaturedCourse: {
          slug: unavailableFeaturedCourse.slug,
          title: unavailableFeaturedCourse.title,
        },
      } : {}),
    });
  });

  // 2. GET /courses/:slug/tree — full tree with per-node unlock state.
  router.get('/courses/:slug/tree', async (req, res) => {
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.slug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');
    const entry = await courseEntry(user, course, res.locals.ageScreen as AgeScreenState);
    if (entry.kind === 'refused') return fail(res, entry.status, entry.code, entry.message, entry.details);
    return ok(res, entry.load.tree);
  });

  /*
   * 2b. GET /courses/:slug/path — the rebuilt course path (B.6, S05.3b). The
   * same pathway decision as the tree, projected to what a learner needs on
   * one screen: chapters with their access, the frontier with titles, what is
   * blocked and why, and the skills the pathway teaches. Pathway mode only.
   */
  router.get('/courses/:slug/path', async (req, res) => {
    if (courseEngine() !== 'pathway') return fail(res, 409, 'PATHWAY_ENGINE_DISABLED', 'The course path is not enabled yet');
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.slug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');
    const entry = await courseEntry(user, course, res.locals.ageScreen as AgeScreenState);
    if (entry.kind === 'refused') return fail(res, entry.status, entry.code, entry.message, entry.details);
    if (!entry.load.tree.pathway || !entry.load.pathway) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    return ok(res, projectCoursePath(entry.load.tree as PathwayCourseTree, entry.load.pathway.kcTitles));
  });

  // 3. GET /lessons/:id — meta + client-safe document, locale-resolved.
  router.get('/lessons/:id', async (req, res) => {
    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId, res.locals.ageScreen as AgeScreenState);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const refusal = lessonAdmissionRefusal(ctx.tree, lessonId);
    if (refusal) return fail(res, 403, refusal.code, refusal.message);

    const docs = await getEffectiveLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');

    const safeDocument = stripAnswers(picked.document) as { meta?: { cast?: unknown }; scoring?: unknown };
    if (!hasV2LessonEligibility(res, picked.schema_version, picked.document, profiles?.[0]?.birth_date)) return;
    // A valid client parser is necessary but not sufficient: Core also verifies
    // the public document and its private rubric relationship before exposing a
    // v2 lesson. This prevents a malformed publication from reaching an older
    // renderer or from later becoming gradeable through a loose answer key.
    const document = picked.schema_version === 2
      ? validateV2LessonForGrading(safeDocument, picked.answer_keys, { lessonId, locale: picked.locale })
      : null;
    if (picked.schema_version === 2 && !document) {
      return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson document is not ready');
    }
    /*
     * OD-19 / S05.2bh: the compact Mentor stage projection. The learner's own
     * stored character (catalog default when never chosen) rides with the
     * document-declared scene as the response's `mentor_stage` field, while
     * the authored mentor_stage is stripped from the delivered document so
     * the answerless document and the per-learner projection never mix. A
     * preference READ failure omits the stage rather than showing the wrong
     * character (§1.14): the lesson must not depend on this cosmetic read.
     */
    const prefs = document?.mentor_stage ? await getTutorPreferences(user.id) : null;
    const mentorStage = document ? projectV2MentorStage(document, prefs?.character) : null;
    const deliveredDocument = (document ? stripV2MentorStage(safeDocument) : safeDocument) as { meta?: { cast?: unknown }; scoring?: unknown };

    return ok(res, {
      lesson: {
        id: ctx.lessonRow.id,
        slug: ctx.lessonRow.slug,
        title: ctx.lessonRow.title,
        difficulty: ctx.lessonRow.difficulty,
        xp_total: ctx.lessonRow.xp_total,
        estimated_minutes: ctx.lessonRow.estimated_minutes,
        cast: deliveredDocument.meta?.cast ?? [],
        scoring: deliveredDocument.scoring ?? null,
      },
      locale: picked.locale,
      document: deliveredDocument,
      // Echo's narration manifest (unit_id -> public MP3 url). Client-safe:
      // it references prompt/story/explanation audio only — never answers.
      audio: picked.audio ?? {},
      ...(mentorStage ? { mentor_stage: mentorStage } : {}),
    });
  });

  // 4. POST /lessons/:id/v2-runs — pins one browser play-through to the
  // selected immutable document and returns one-use tokens only for its
  // currently server-gradeable visual segments. Presentation data remains on
  // the GET route, which never contains an answer key.
  const StartV2RunBody = z.object({ run_id: z.string().uuid().optional() }).strict().optional();
  router.post('/lessons/:id/v2-runs', async (req, res) => {
    const parsed = StartV2RunBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid input');
    const secret = lessonAttemptSecret();
    if (!secret) return fail(res, 503, 'LESSON_ATTEMPT_UNAVAILABLE', 'This lesson attempt is not ready');

    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId, res.locals.ageScreen as AgeScreenState);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const refusal = lessonAdmissionRefusal(ctx.tree, lessonId);
    if (refusal) return fail(res, 403, refusal.code, refusal.message);

    const docs = await getEffectiveLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');
    if (picked.schema_version !== 2 || !picked.document_version_id) {
      return fail(res, 409, 'UNSUPPORTED_LESSON', 'This lesson does not support v2 attempts');
    }
    if (!hasV2LessonEligibility(res, picked.schema_version, picked.document, profiles?.[0]?.birth_date)) return;

    const document = validateV2LessonForGrading(stripAnswers(picked.document), picked.answer_keys, { lessonId, locale: picked.locale });
    if (!document) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson document is not ready');

    const serverSegmentIds = document.segments.filter((segment) => segment.grading === 'server').map((segment) => segment.id);
    // A reload supplies only a non-secret run ID. Core re-reads the immutable
    // row and re-signs its stored nonce JTI; the browser never persists a token.
    if (parsed.data?.run_id) {
      const prior = await getV2LessonRunForRecovery(user.id, lessonId, parsed.data.run_id);
      if (prior === undefined) return fail(res, 502, 'INTERNAL', 'Could not recover this lesson attempt');
      const priorExpiresAt = prior ? Date.parse(prior.expires_at) : Number.NaN;
      if (prior && (prior.completed_at === null || prior.completed_at === undefined) && prior.document_version_id === picked.document_version_id
        && prior.locale === document.locale && Number.isFinite(priorExpiresAt) && priorExpiresAt > Date.now()) {
        const nonces = await getV2LessonAttemptNoncesForRecovery(user.id, prior.id, prior.document_version_id);
        const receipts = await getV2MetSegmentReceiptsForRecovery(user.id, prior.id, prior.document_version_id);
        if (nonces === null || receipts === null) return fail(res, 502, 'INTERNAL', 'Could not recover this lesson attempt');
        const nonceBySegment = new Map(nonces.map((nonce) => [nonce.segment_id, nonce]));
        for (const nonce of nonces) if (nonce.consumed_at === null || nonce.consumed_at === undefined) nonceBySegment.set(nonce.segment_id, nonce);
        const exactNonceSet = serverSegmentIds.every((id) => nonceBySegment.has(id));
        const reissued = exactNonceSet ? serverSegmentIds.map((segmentId) => {
          const nonce = nonceBySegment.get(segmentId)!;
          const expiresAt = Date.parse(nonce.expires_at);
          if (!Number.isFinite(expiresAt)) return null;
          return reissueLessonAttemptToken({
            uid: user.id, vid: prior.document_version_id, lid: lessonId, loc: document.locale, sid: segmentId, rid: prior.id,
            exp: Math.floor(expiresAt / 1000), jti: nonce.jti,
          }, secret);
        }) : [];
        if (reissued.length === serverSegmentIds.length && reissued.every((value) => value !== null)) {
          const metSegmentIds = receipts
            .filter((receipt) => serverSegmentIds.includes(receipt.segment_id) && receipt.verdict?.correct === true && receipt.verdict?.score === 100)
            .map((receipt) => receipt.segment_id);
          // A CPA review is an experienced representation, not mastery. It is
          // safe to restore its public segment ID so the learner resumes the
          // next representation, while `met_segment_ids` remains the sole
          // authority for completion and non-CPA prerequisites.
          const attemptedSegmentIds = [...new Set(receipts
            .filter((receipt) => serverSegmentIds.includes(receipt.segment_id))
            .map((receipt) => receipt.segment_id))];
          return ok(res, {
            run_id: prior.id, version_id: document.version_id, expires_at: prior.expires_at, resumed: true, met_segment_ids: metSegmentIds,
            attempted_segment_ids: attemptedSegmentIds,
            attempt_tokens: Object.fromEntries(serverSegmentIds.map((segmentId, index) => [segmentId, reissued[index]!.token])),
          });
        }
      }
    }

    const runId = randomUUID();
    const issuedAt = Date.now();
    const issued = document.segments
      .filter((segment) => segment.grading === 'server')
      .map((segment) => ({ segmentId: segment.id, ...mintLessonAttemptToken({
        uid: user.id, vid: picked.document_version_id!, lid: lessonId, loc: document.locale, sid: segment.id, rid: runId,
      }, secret, issuedAt) }));
    // The strict document contract guarantees at least the selected segments;
    // an empty list would create a run that can never be completed, so refuse.
    if (issued.length === 0) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson has no gradeable segments');
    const expiresAt = issued[0]!.expiresAt;
    const createdRun = await createV2LessonRun({
      id: runId, user_id: user.id, lesson_id: lessonId, locale: document.locale,
      document_version_id: picked.document_version_id, expires_at: expiresAt,
    });
    if (!createdRun) return fail(res, 502, 'INTERNAL', 'Could not start this lesson attempt');
    const createdNonces = await createV2LessonAttemptNonces(issued.map((item) => ({
      jti: item.payload.jti, user_id: user.id, run_id: runId, document_version_id: picked.document_version_id!,
      segment_id: item.segmentId, expires_at: item.expiresAt,
    })));
    if (!createdNonces) return fail(res, 502, 'INTERNAL', 'Could not start this lesson attempt');

    return ok(res, {
      run_id: runId,
      version_id: document.version_id,
      expires_at: expiresAt,
      resumed: false,
      met_segment_ids: [],
      attempted_segment_ids: [],
      attempt_tokens: Object.fromEntries(issued.map((item) => [item.segmentId, item.token])),
    });
  });

  // 5. POST /lessons/:id/grade — server-authoritative single-segment grading.
  const LegacyGradeBody = z.object({
    segment_id: z.string().min(1),
    answer: z.unknown(),
    attempt_number: z.number().int().min(1).max(2147483647),
    // Per-lesson-entry id: the attempt cap counts only rows from this run so
    // replays start fresh (0012). Optional for legacy clients (lifetime count).
    run_id: z.string().uuid().optional(),
    // Hints the kid revealed before submitting — the server applies the penalty
    // (authoritative), so a hint actually lowers the score and a reload can't
    // launder it (0012). Optional; defaults to 0.
    hints_used: z.number().int().min(0).max(10).optional(),
    time_spent_seconds: z.number().int().min(0).max(7200).optional(),
  });
  const V2GradeBody = z.object({
    segment_id: z.string().min(1),
    answer: z.unknown(),
    run_id: z.string().uuid(),
    attempt_token: z.string().min(1).max(4_096),
  }).strict();
  const GradeBody = z.union([LegacyGradeBody, V2GradeBody]);

  router.post('/lessons/:id/grade', async (req, res) => {
    const parsed = GradeBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId, res.locals.ageScreen as AgeScreenState);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const refusal = lessonAdmissionRefusal(ctx.tree, lessonId);
    if (refusal) return fail(res, 403, refusal.code, refusal.message);

    const { segment_id: segmentId, answer } = parsed.data;
    if ('attempt_token' in parsed.data) {
      const secret = lessonAttemptSecret();
      if (!secret) return fail(res, 503, 'LESSON_ATTEMPT_UNAVAILABLE', 'This lesson attempt is not ready');
      // Authenticate the immutable version ID first, without consulting the
      // mutable current pointer. A later activation must not invalidate an
      // already-issued run or make it grade against a different document.
      const preliminary = verifyLessonAttemptToken(parsed.data.attempt_token, secret, {
        uid: user.id, lid: lessonId, sid: segmentId, rid: parsed.data.run_id,
      });
      if (preliminary.status !== 'valid') return fail(res, 403, 'INVALID_ATTEMPT_TOKEN', 'This lesson attempt is no longer valid');
      const picked = await getV2LessonDocumentVersion(preliminary.payload.vid);
      if (picked === undefined) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
      if (!picked || picked.lesson_id !== lessonId || !picked.document_version_id) {
        return fail(res, 403, 'INVALID_ATTEMPT_TOKEN', 'This lesson attempt is no longer valid');
      }
      const profiles = await getFullOwnProfile(user.accessToken, user.id);
      if (!hasV2LessonEligibility(res, picked.schema_version, picked.document, profiles?.[0]?.birth_date)) return;
      const document = validateV2LessonForGrading(stripAnswers(picked.document), picked.answer_keys, { lessonId, locale: picked.locale });
      if (!document) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson document is not ready');
      const verified = verifyLessonAttemptToken(parsed.data.attempt_token, secret, {
        uid: user.id, vid: picked.document_version_id, lid: lessonId, loc: document.locale, sid: segmentId, rid: parsed.data.run_id,
      });
      if (verified.status !== 'valid') return fail(res, 403, 'INVALID_ATTEMPT_TOKEN', 'This lesson attempt is no longer valid');
      const graded = gradeV2Visual(document, picked.answer_keys as Record<string, unknown>, segmentId, answer);
      if (!graded) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid answer for this lesson segment');
      const next = mintLessonAttemptToken({
        uid: user.id, vid: picked.document_version_id, lid: lessonId, loc: document.locale, sid: segmentId, rid: parsed.data.run_id,
      }, secret);
      const cpaPrerequisite = v2CpaAttemptPrerequisiteSegmentId(document, segmentId);
      const receipt = cpaPrerequisite === undefined
        ? await recordV2LessonGrade({
          p_user_id: user.id, p_run_id: parsed.data.run_id, p_document_version_id: picked.document_version_id,
          p_segment_id: segmentId, p_jti: verified.payload.jti,
          p_required_met_segment_id: v2GradePrerequisiteSegmentId(document, segmentId),
          p_verdict: { correct: graded.correct, score: graded.score },
          p_next_jti: next.payload.jti,
          p_next_expires_at: next.expiresAt,
        })
        : await recordV2CpaGrade({
          p_user_id: user.id, p_run_id: parsed.data.run_id, p_document_version_id: picked.document_version_id,
          p_segment_id: segmentId, p_jti: verified.payload.jti,
          p_required_attempted_segment_id: cpaPrerequisite,
          p_verdict: { correct: graded.correct, score: graded.score },
          p_next_jti: next.payload.jti,
          p_next_expires_at: next.expiresAt,
        });
      if (!receipt) return fail(res, 502, 'INTERNAL', 'Could not record the lesson attempt');
      if ('blocked' in receipt) return fail(res, 409, 'LESSON_PREREQUISITE_REQUIRED', 'Complete the previous learning step first');
      const firstUnaided = receipt.verdict.correct ? v2FirstUnaidedStage(document, segmentId) : null;
      if (firstUnaided) {
        // The route, not the browser, supplies the group and stage. This write is
        // idempotent and may be recovered on a replayed met receipt.
        await recordV2FirstUnaidedStage({ p_user_id: user.id, p_document_version_id: picked.document_version_id,
          p_fading_group_id: firstUnaided.fadingGroupId, p_stage: firstUnaided.stage, p_receipt_jti: verified.payload.jti });
      }
      const retryAttemptToken = !receipt.replayed && !receipt.verdict.correct && receipt.retry_jti === next.payload.jti ? next.token : undefined;
      return ok(res, { verdict: receipt.verdict, replayed: receipt.replayed, ...(retryAttemptToken ? { retry_attempt_token: retryAttemptToken } : {}) });
    }

    const docs = await getEffectiveLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');
    if (!hasV2LessonEligibility(res, picked.schema_version, picked.document, profiles?.[0]?.birth_date)) return;
    if (picked.schema_version === 2) {
      if (!picked.document_version_id) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson must use an immutable version');
      return fail(res, 400, 'VALIDATION_ERROR', 'A v2 attempt token is required');
    }

    // A v2-shaped body must never fall through to the legacy grade writer,
    // even if content changes between the initial selection and this request.
    if (!('attempt_number' in parsed.data)) return fail(res, 400, 'VALIDATION_ERROR', 'A legacy attempt number is required');
    const legacyAttempt = parsed.data;

    const segment = findGradingSegment(picked.document, picked.answer_keys, segmentId);
    if (!segment) return fail(res, 404, NOT_FOUND, 'No such segment');

    const grader = GRADERS[segment.type];
    // Keyless graders (memory_flip) score from the submitted board alone and
    // have no answer key — the answer-key requirement would 422 them forever.
    if (!grader || (segment.answer === undefined && !KEYLESS_GRADERS.has(segment.type))) {
      return fail(res, 422, 'UNSUPPORTED_SEGMENT', 'This segment cannot be graded');
    }

    const scoring = (picked.document as { scoring?: { pass_threshold?: number; max_attempts?: number; hint_penalty_pct?: number } }).scoring ?? {};
    const passThreshold = typeof scoring.pass_threshold === 'number' ? scoring.pass_threshold : 70;
    const maxAttempts = typeof scoring.max_attempts === 'number' ? scoring.max_attempts : 2;
    const hintPenaltyPct = typeof scoring.hint_penalty_pct === 'number' ? scoring.hint_penalty_pct : 0;
    const runId = legacyAttempt.run_id;
    const hintsUsed = legacyAttempt.hints_used ?? 0;

    const outcome = grader(segment, answer);
    // Apply the hint penalty server-side (0012): each revealed hint compounds a
    // (1 - hint_penalty_pct/100) factor. This is the ONLY place the penalty is
    // applied — the recorded score, the verdict, and /complete's recompute all
    // flow from it, so a hint truly lowers the score/XP and a reload can't
    // launder it.
    const penaltyFactor = Math.pow(1 - hintPenaltyPct / 100, hintsUsed);
    const penalizedScore = Math.max(0, Math.min(100, Math.round(outcome.score * penaltyFactor)));
    const verdict = verdictFrom(penalizedScore, passThreshold, outcome.feedback_md);
    verdict.reveal = outcome.reveal;
    const recorded = await recordLessonGrade({
      p_user_id: user.id, p_lesson_id: lessonId, p_run_id: runId ?? null,
      p_segment_id: segmentId, p_client_attempt: legacyAttempt.attempt_number,
      p_max_attempts: maxAttempts, p_hints_used: hintsUsed, p_verdict: verdict,
      p_context: {
        timeSpentSeconds: legacyAttempt.time_spent_seconds,
        courseId: ctx.course.id, topicId: ctx.topic.id,
        skillKey: `${ctx.course.slug}/${ctx.topic.slug}`.toLowerCase(),
        documentUpdatedAt: picked.updated_at,
      },
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record the attempt');
    if (recorded.exhausted) return fail(res, 409, 'ATTEMPTS_EXHAUSTED', 'No attempts remain for this segment');

    return ok(res, { verdict: recorded.verdict });
  });

  // 5. POST /lessons/:id/complete — server recomputes the lesson score from
  // recorded attempts; no client-reported scores are ever trusted.
  // `seconds_spent` is the wall-clock the player actually measured; the old
  // rounded `minutes_spent` stays accepted for compatibility. Rounding
  // seconds server-side floors at 1 minute per completion — v1 did the same
  // (a finished lesson always counts as learning time; Math.round alone
  // silently dropped every sub-30s story lesson to 0).
  const CompleteBody = z
    .object({
      minutes_spent: z.number().min(0).max(120).optional(),
      seconds_spent: z.number().int().min(0).max(7200).optional(),
      // The learner's LOCAL calendar date (YYYY-MM-DD) — the day-streak
      // anchor. A kid's day follows their wall clock, not the server's UTC
      // (in Mexico UTC day-rollover lands at 6 pm local). Optional for
      // compatibility; defaults to the server's UTC date.
      local_date: z.string().refine(isCalendarDate, 'local_date must be YYYY-MM-DD').optional(),
      // This play-through's id (0012): the results score/pass reflect THIS run,
      // not a lifetime best, so replaying a passed lesson and failing shows the
      // fail — not the historical "100" that made the results screen incoherent.
      run_id: z.string().uuid().optional(),
    })
    .refine((b) => b.minutes_spent !== undefined || b.seconds_spent !== undefined, {
      message: 'seconds_spent (or legacy minutes_spent) is required',
    });

  router.post('/lessons/:id/complete', async (req, res) => {
    const parsed = CompleteBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId, res.locals.ageScreen as AgeScreenState);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const refusal = lessonAdmissionRefusal(ctx.tree, lessonId);
    if (refusal) return fail(res, 403, refusal.code, refusal.message);

    const docs = await getEffectiveLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');
    if (!hasV2LessonEligibility(res, picked.schema_version, picked.document, profiles?.[0]?.birth_date)) return;
    if (picked.schema_version === 2) {
      if (!parsed.data.run_id) return fail(res, 400, 'VALIDATION_ERROR', 'A v2 run is required');
      const run = await getV2LessonRunForRecovery(user.id, lessonId, parsed.data.run_id);
      if (run === undefined) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
      if (!run) return fail(res, 409, 'UNSUPPORTED_LESSON', 'This lesson run is not available');
      const version = await getV2LessonDocumentVersion(run.document_version_id);
      if (version === undefined) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
      if (!version || version.lesson_id !== lessonId || version.locale !== run.locale) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson document is not ready');
      if (!hasV2LessonEligibility(res, version.schema_version, version.document, profiles?.[0]?.birth_date)) return;
      const document = validateV2LessonForGrading(stripAnswers(version.document), version.answer_keys, { lessonId, locale: version.locale });
      if (!document) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson document is not ready');
      const requiredSegmentIds = v2CompletionRequiredSegmentIds(document);
      if (requiredSegmentIds.length === 0) return fail(res, 422, 'UNSUPPORTED_LESSON', 'This lesson has no gradeable segments');
      const completion = await completeV2Lesson({
        p_user_id: user.id, p_lesson_id: lessonId, p_run_id: run.id, p_document_version_id: run.document_version_id,
        p_required_segment_ids: requiredSegmentIds, p_xp: ctx.lessonRow.xp_total,
        p_minutes: parsed.data.seconds_spent !== undefined ? Math.max(1, Math.round(parsed.data.seconds_spent / 60)) : Math.max(1, Math.round(parsed.data.minutes_spent ?? 0)),
        p_local_date: parsed.data.local_date ?? new Date().toISOString().slice(0, 10),
      });
      if (!completion) return fail(res, 409, 'UNSUPPORTED_LESSON', 'Complete every learning step first');
      if (courseEngine() === 'pathway') {
        const refreshed = await loadLearnerCourse(user.accessToken, user.id, ctx.course, res.locals.ageScreen as AgeScreenState);
        if (refreshed) await settleCourseBadges(user.id, ctx.course, refreshed);
      }
      return ok(res, completion);
    }

    const scoring = (picked.document as { scoring?: { pass_threshold?: number } }).scoring ?? {};
    const passThreshold = typeof scoring.pass_threshold === 'number' ? scoring.pass_threshold : 70;

    const gradedIds = completableSegmentIds(picked.document, picked.answer_keys, new Set(Object.keys(GRADERS)), KEYLESS_GRADERS);
    if (!gradedIds) return fail(res, 409, 'UNSUPPORTED_LESSON', 'This lesson format needs an update before it can be completed');
    const xpMap = xpBySegmentId(picked.document);

    // Score THIS run (0012): scoped to the run_id so a replay reflects the
    // play-through the kid just did, not a lifetime best. Progress below still
    // keeps the all-time best.
    const attempts = await getSegmentAttempts(user.accessToken, user.id, lessonId, parsed.data.run_id);
    if (!attempts) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    // Recorded scores already include server-side hint penalties.
    const bestBySegment = new Map<string, number>();
    for (const a of attempts) {
      if (a.score > (bestBySegment.get(a.segment_id) ?? 0)) bestBySegment.set(a.segment_id, a.score);
    }

    let weightedSum = 0;
    let totalXp = 0;
    for (const segId of gradedIds) {
      const xp = xpMap.get(segId) ?? 0;
      const best = bestBySegment.get(segId) ?? 0; // ungraded segment counts 0, per spec
      totalXp += xp;
      weightedSum += (best / 100) * xp;
    }
    // No graded weight (story-only lessons) → completing IS passing, score 100.
    // Mirrors the client's lessonScore() and LESSON_ENGINE.md §5.1 (content
    // types auto-complete). The old `? 0` made story lessons unpassable: the
    // player showed 100 while the server recorded 0/failed, so the map never
    // advanced — first real course play-through caught it (2026-07-13).
    const lessonScore = totalXp === 0 ? 100 : Math.round((weightedSum / totalXp) * 100);
    const xpEarnedThisRun = Math.round(weightedSum);
    const passedNow = lessonScore >= passThreshold;

    const completion = await completeLesson({
      p_user_id: user.id,
      p_lesson_id: lessonId,
      p_run_id: parsed.data.run_id ?? null,
      p_score: lessonScore,
      p_passed: passedNow,
      p_xp: xpEarnedThisRun,
      p_minutes: parsed.data.seconds_spent !== undefined
        ? Math.max(1, Math.round(parsed.data.seconds_spent / 60))
        : Math.round(parsed.data.minutes_spent ?? 0),
      p_local_date: parsed.data.local_date ?? new Date().toISOString().slice(0, 10),
    });
    if (!completion) return fail(res, 502, 'INTERNAL', 'Could not save lesson completion; retry this run');

    /*
     * Retention signal, recorded SERVER-side because only the server knows
     * whether the streak genuinely extended (it owns last_active_date and the
     * date maths). value = the new streak length, so "how far do streaks
     * actually get" is answerable without touching learning_stats.
     * Fire-and-forget and consent-gated like every other kid event.
     */
    // Server-authoritative lesson_complete (0072), alongside the client's own
    // emission in LessonPlayer.tsx. The client beacon can be lost (tab closed
    // before flush, a blocked request) or, in principle, spoofed — this is
    // the NSM's primary input, so it gets a server-side source that cannot
    // silently under-count. Same semantics as the client: fires on EVERY
    // passing run, not just the first (passedNow, not newlyPassed) — a
    // repeat pass is still a completion the funnel should count.
    if (completion.passed && !completion.replayed) {
      void (async () => {
        const roles = await getRolesForGate(user.id);
        if (!roles || roles.length === 0) return;
        if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
        await insertLearningEvents([{
          user_id: user.id, role: stampRole(roles), event: 'lesson_complete',
          route_class: 'learn', lesson_id: lessonId, value: lessonScore,
        }]);
      })();
    }

    // Activation milestone: the FIRST lesson this learner ever passed. Only
    // the server can assert it (it sees lessons_completed before the update),
    // and it is the single most predictive early-retention event there is.
    if (completion.first_completion && !completion.replayed) {
      void (async () => {
        const roles = await getRolesForGate(user.id);
        if (!roles || roles.length === 0) return;
        if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
        await insertLearningEvents([{
          user_id: user.id, role: stampRole(roles), event: 'first_lesson_complete',
          route_class: 'learn', lesson_id: lessonId,
        }]);
      })();
    }

    if (completion.streak_extended && !completion.replayed) {
      void (async () => {
        const roles = await getRolesForGate(user.id);
        if (!roles || roles.length === 0) return;
        if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
        await insertLearningEvents([{
          user_id: user.id, role: stampRole(roles), event: 'streak_extend',
          route_class: 'learn', value: completion.streak_days,
        }]);
      })();
    }

    // Re-fetch the tree so `progress`/`next_lesson_id` reflect the write above.
    // Pathway mode: a completion can finish the pathway, so settle its badge (B4) here too.
    const refreshed = await loadLearnerCourse(user.accessToken, user.id, ctx.course, res.locals.ageScreen as AgeScreenState);
    if (refreshed) await settleCourseBadges(user.id, ctx.course, refreshed);
    const refreshedTree = refreshed?.tree ?? null;

    return ok(res, {
      score: completion.score,
      passed: completion.passed,
      best_score: completion.best_score,
      xp_earned: completion.xp_earned,
      xp_delta: completion.xp_delta,
      streak_days: completion.streak_days,
      longest_streak: completion.longest_streak,
      streak_extended: completion.streak_extended,
      first_today: completion.first_today,
      minutes_learned: completion.minutes_learned,
      lessons_completed: completion.lessons_completed,
      progress: refreshedTree?.course.progress ?? ctx.tree.course.progress,
      next_lesson_id: refreshedTree?.nextLessonId ?? ctx.tree.nextLessonId,
    });
  });

  return router;
}
