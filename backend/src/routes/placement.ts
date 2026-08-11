import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { loadCourseTree } from './learn.js';
import {
  flattenTopicsForPlacement,
  listPlacementProbes,
  listPlacementProbesForGrading,
} from '../services/courseTree.js';
import { computePlacement, gradeQuizAnswers, type ClaimedLevel } from '../services/placementAlgorithm.js';
import {
  getCoursePlacement,
  getFullOwnProfile,
  getPublishedCourseBySlug,
  insertCoursePlacement,
  insertPlacementCredits,
  patchOwnProfile,
} from '../services/supabaseRest.js';

/*
 * /api/v1/placement — the mandatory per-course placement quiz
 * (COURSE_ENGINE.md §3.2). GET serves up to 6 answer-stripped probes in
 * course order; POST grades the submission server-side and deterministically
 * (the probe CONTENT was the only thing an LLM ever touched, once per
 * catalog topic at generation time — coursegen/src/pipeline/placementProbe.ts
 * — never per learner), computes the placement, and writes the result +
 * skip-ahead credits. learn.ts's PLACEMENT_REQUIRED 403 is the real server-
 * side gate; this route is what clears it.
 */

const NOT_FOUND = 'NOT_FOUND';
const MAX_QUIZ_ANSWERS = 6;
const CLAIMED_LEVELS = ['new', 'some', 'confident'] as const;
const EDUCATION_LEVELS = ['preschool', 'elementary', 'middle', 'high', 'adult'] as const;
type Locale = 'en-US' | 'es-MX' | 'pt-BR';

function isValidPastDate(d: string): boolean {
  const t = Date.parse(d);
  return !Number.isNaN(t) && t <= Date.now() && Number(d.slice(0, 4)) >= 1900;
}

const CompletePlacementBody = z.object({
  claimedLevel: z.enum(CLAIMED_LEVELS),
  educationLevel: z.enum(EDUCATION_LEVELS),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
    .refine(isValidPastDate, 'Enter a valid birth date')
    .optional(),
  quizAnswers: z
    .array(
      z.object({
        topicId: z.string().uuid(),
        selectedIndex: z.number().int().min(0),
      }),
    )
    .max(MAX_QUIZ_ANSWERS),
});

export function placementRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/:courseSlug/probe', async (req, res) => {
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const [tree, profiles] = await Promise.all([
      loadCourseTree(user.accessToken, user.id, course),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');

    const locale = (profiles[0]?.locale as Locale | undefined) ?? 'en-US';
    const probes = listPlacementProbes(tree, locale, MAX_QUIZ_ANSWERS);

    return ok(res, {
      probes,
      // So the client can skip the age step entirely if it's already known
      // (onboarding, Settings, or a prior course's placement already asked).
      ageAlreadyKnown: Boolean(profiles[0]?.birth_date),
    });
  });

  router.post('/:courseSlug/complete', async (req, res) => {
    const parsed = CompletePlacementBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const existing = await getCoursePlacement(user.accessToken, user.id, course.id);
    if (existing === null) return fail(res, 502, 'INTERNAL', 'Could not check placement status');
    if (existing.length > 0) return fail(res, 409, 'PLACEMENT_ALREADY_COMPLETE', 'Placement was already completed for this course');

    const [tree, profiles] = await Promise.all([
      loadCourseTree(user.accessToken, user.id, course),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');

    const locale = (profiles[0]?.locale as Locale | undefined) ?? 'en-US';
    const flatTopics = flattenTopicsForPlacement(tree);
    const probesForGrading = listPlacementProbesForGrading(tree, locale);
    const graded = gradeQuizAnswers(probesForGrading, parsed.data.quizAnswers);
    const placement = computePlacement(flatTopics, parsed.data.claimedLevel as ClaimedLevel, graded);

    const recorded = await insertCoursePlacement({
      user_id: user.id,
      course_id: course.id,
      claimed_level: parsed.data.claimedLevel,
      education_level: parsed.data.educationLevel,
      quiz_answers: graded,
      start_topic_id: placement.startTopicId,
      start_lesson_id: placement.startLessonId,
      method: placement.method,
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record placement');

    if (placement.creditedLessonIds.length > 0) {
      const topicIdByLesson = new Map<string, string>();
      for (const topic of flatTopics) {
        for (const lessonId of topic.lessonIds) topicIdByLesson.set(lessonId, topic.id);
      }
      const creditRows = placement.creditedLessonIds
        .map((lessonId) => {
          const topicId = topicIdByLesson.get(lessonId);
          return topicId ? { user_id: user.id, lesson_id: lessonId, topic_id: topicId, course_id: course.id } : null;
        })
        .filter((r): r is { user_id: string; lesson_id: string; topic_id: string; course_id: string } => r !== null);
      const creditsWritten = await insertPlacementCredits(creditRows);
      if (!creditsWritten) return fail(res, 502, 'INTERNAL', 'Placement recorded, but credited lessons could not be saved');
    }

    // Same "only asked because it wasn't already known" posture as onboarding
    // — never overwrite an existing birth_date, and this is the ONE call
    // that collected it (never re-asked by a later course's placement).
    if (parsed.data.birthDate !== undefined && !profiles[0]?.birth_date) {
      await patchOwnProfile(user.accessToken, user.id, { birth_date: parsed.data.birthDate });
    }

    return ok(res, { startLessonId: placement.startLessonId, creditedLessonCount: placement.creditedLessonIds.length }, 201);
  });

  return router;
}
