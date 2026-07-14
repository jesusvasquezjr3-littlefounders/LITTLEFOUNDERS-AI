import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { GRADERS } from '../lesson-contract/registry.js';
import { verdictFrom } from '../lesson-contract/core/types.js';
import { assembleCourseTree, findLessonNode, summarizeCourseTree, type CourseTree } from '../services/courseTree.js';
import { findGradingSegment, gradedSegmentIds, pickLessonLocale, stripAnswers, xpBySegmentId } from '../services/lessonDocument.js';
import { isFirstActivityToday, nextStreak } from '../services/streak.js';
import {
  countSegmentAttempts,
  getAdventureById,
  getAdventuresByCourseIds,
  getFullOwnProfile,
  getLearningStatsForUpdate,
  getLessonById,
  getLessonDocumentLocales,
  getLessonProgressForLessons,
  getLessonProgressRow,
  getLessonsByTopicIds,
  getPublishedCourseById,
  getPublishedCourseBySlug,
  getPublishedCourseRows,
  getSagaById,
  getSagasByAdventureIds,
  getSegmentAttempts,
  getTopicById,
  getTopicsBySagaIds,
  insertSegmentAttempt,
  patchLearningStats,
  upsertLessonProgress,
  type CourseHierarchyRow,
} from '../services/supabaseRest.js';

/*
 * /api/v1/learn — server-authoritative course tree, lesson delivery and
 * grading (COURSE_ENGINE.md §2, LESSON_ENGINE.md §6-§7). Core is the ONLY
 * place unlock state and scores are computed; the client never re-derives
 * either. Grading reuses the frontend's pure validators via
 * ../lesson-contract/ (a parity-checked copy — no workspaces, /AGENTS.md §1.2).
 */

const NOT_FOUND = 'NOT_FOUND';

/** Fetch the full published hierarchy for one course + this user's progress, and assemble the per-user tree. Returns null on a downstream fetch failure. */
async function loadCourseTree(accessToken: string, userId: string, course: CourseHierarchyRow): Promise<CourseTree | null> {
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
  return assembleCourseTree(course, adventures, sagas, topics, lessons, progress);
}

interface LessonContext {
  lessonRow: { id: string; slug: string; title: Record<string, unknown>; difficulty: number; xp_total: number; estimated_minutes: number };
  course: CourseHierarchyRow;
  tree: CourseTree;
}

/** Walk lesson -> topic -> saga -> adventure -> course, then build that course's tree, to resolve one lesson's unlock state (endpoints 3-5). */
async function resolveLessonContext(accessToken: string, userId: string, lessonId: string): Promise<'not_found' | 'unreachable' | LessonContext> {
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
  const tree = await loadCourseTree(accessToken, userId, course);
  if (!tree) return 'unreachable';
  if (!findLessonNode(tree, lessonId)) return 'not_found';
  return { lessonRow: lesson, course, tree };
}

export function learnRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // 1. GET /courses — published courses + rollup progress for the caller.
  router.get('/courses', async (_req, res) => {
    const user = authedUser(res);
    const courseRows = await getPublishedCourseRows(user.accessToken);
    if (!courseRows) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    const courses = [];
    for (const course of courseRows) {
      const tree = await loadCourseTree(user.accessToken, user.id, course);
      if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
      const summary = summarizeCourseTree(course, tree);
      courses.push({
        id: summary.id,
        slug: summary.slug,
        title: summary.title,
        lessonCount: summary.lessonCount,
        subject: summary.subject,
        adventureCount: summary.adventureCount,
        progress: summary.progress,
      });
    }
    return ok(res, { courses });
  });

  // 2. GET /courses/:slug/tree — full tree with per-node unlock state.
  router.get('/courses/:slug/tree', async (req, res) => {
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.slug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');
    const tree = await loadCourseTree(user.accessToken, user.id, course);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    return ok(res, tree);
  });

  // 3. GET /lessons/:id — meta + client-safe document, locale-resolved.
  router.get('/lessons/:id', async (req, res) => {
    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const node = findLessonNode(ctx.tree, lessonId);
    if (node?.state === 'locked') return fail(res, 403, 'LESSON_LOCKED', 'This lesson is still locked');

    const docs = await getLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');

    const safeDocument = stripAnswers(picked.document) as { meta?: { cast?: unknown }; scoring?: unknown };

    return ok(res, {
      lesson: {
        id: ctx.lessonRow.id,
        slug: ctx.lessonRow.slug,
        title: ctx.lessonRow.title,
        difficulty: ctx.lessonRow.difficulty,
        xp_total: ctx.lessonRow.xp_total,
        estimated_minutes: ctx.lessonRow.estimated_minutes,
        cast: safeDocument.meta?.cast ?? [],
        scoring: safeDocument.scoring ?? null,
      },
      locale: picked.locale,
      document: safeDocument,
      // Echo's narration manifest (unit_id -> public MP3 url). Client-safe:
      // it references prompt/story/explanation audio only — never answers.
      audio: picked.audio ?? {},
    });
  });

  // 4. POST /lessons/:id/grade — server-authoritative single-segment grading.
  const GradeBody = z.object({
    segment_id: z.string().min(1),
    answer: z.unknown(),
    attempt_number: z.number().int().min(1),
  });

  router.post('/lessons/:id/grade', async (req, res) => {
    const parsed = GradeBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const node = findLessonNode(ctx.tree, lessonId);
    if (node?.state === 'locked') return fail(res, 403, 'LESSON_LOCKED', 'This lesson is still locked');

    const docs = await getLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');

    const { segment_id: segmentId, answer } = parsed.data;
    const segment = findGradingSegment(picked.document, picked.answer_keys, segmentId);
    if (!segment) return fail(res, 404, NOT_FOUND, 'No such segment');

    const grader = GRADERS[segment.type];
    if (!grader || segment.answer === undefined) {
      return fail(res, 422, 'UNSUPPORTED_SEGMENT', 'This segment cannot be graded');
    }

    const scoring = (picked.document as { scoring?: { pass_threshold?: number; max_attempts?: number } }).scoring ?? {};
    const passThreshold = typeof scoring.pass_threshold === 'number' ? scoring.pass_threshold : 70;
    const maxAttempts = typeof scoring.max_attempts === 'number' ? scoring.max_attempts : 2;

    // SERVER-AUTHORITATIVE: the client-declared `attempt_number` is validated
    // shape-wise but never trusted for the cap decision or the recorded row —
    // the DB's own attempt count is the only source of truth.
    const existingAttempts = await countSegmentAttempts(user.accessToken, user.id, lessonId, segmentId);
    if (existingAttempts >= maxAttempts) {
      return fail(res, 409, 'ATTEMPTS_EXHAUSTED', 'No attempts remain for this segment');
    }
    const serverAttemptNumber = existingAttempts + 1;

    const outcome = grader(segment, answer);
    const verdict = verdictFrom(outcome.score, passThreshold, outcome.feedback_md);
    const isFinalAttempt = serverAttemptNumber >= maxAttempts;
    verdict.allowRetry = verdict.score < 100 && !isFinalAttempt;
    // Reveal gating (LESSON_ENGINE.md §6): only on a perfect score or the last permitted try.
    if (verdict.score === 100 || isFinalAttempt) {
      verdict.reveal = outcome.reveal;
    }

    const recorded = await insertSegmentAttempt(user.id, lessonId, segmentId, serverAttemptNumber, verdict.score);
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record the attempt');

    return ok(res, { verdict });
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
    })
    .refine((b) => b.minutes_spent !== undefined || b.seconds_spent !== undefined, {
      message: 'seconds_spent (or legacy minutes_spent) is required',
    });

  router.post('/lessons/:id/complete', async (req, res) => {
    const parsed = CompleteBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = authedUser(res);
    const lessonId = req.params.id as string;
    const ctx = await resolveLessonContext(user.accessToken, user.id, lessonId);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such lesson');
    const node = findLessonNode(ctx.tree, lessonId);
    if (node?.state === 'locked') return fail(res, 403, 'LESSON_LOCKED', 'This lesson is still locked');

    const docs = await getLessonDocumentLocales(lessonId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    const picked = pickLessonLocale(docs, profiles?.[0]?.locale ?? null);
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such lesson');

    const scoring = (picked.document as { scoring?: { pass_threshold?: number } }).scoring ?? {};
    const passThreshold = typeof scoring.pass_threshold === 'number' ? scoring.pass_threshold : 70;

    const gradedIds = gradedSegmentIds(picked.answer_keys);
    const xpMap = xpBySegmentId(picked.document);

    const attempts = await getSegmentAttempts(user.accessToken, user.id, lessonId);
    if (!attempts) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    // Per-segment BEST raw score across every recorded attempt. Hint penalties
    // are client-side UX only (LESSON_ENGINE.md §7) — the server score here is
    // the raw grader score that was recorded at grade time.
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

    const previous = await getLessonProgressRow(user.accessToken, user.id, lessonId);
    const previousPassed = previous?.passed ?? false;
    const previousXpEarned = previous?.xp_earned ?? 0;

    const newBestScore = Math.max(previous?.best_score ?? 0, lessonScore);
    const newPassed = previousPassed || passedNow;
    const newAttempts = (previous?.attempts ?? 0) + 1;
    const newXpEarned = Math.max(previousXpEarned, xpEarnedThisRun);
    const xpDelta = Math.max(0, newXpEarned - previousXpEarned);
    const newlyPassed = newPassed && !previousPassed;

    const upserted = await upsertLessonProgress(user.id, lessonId, {
      best_score: newBestScore,
      passed: newPassed,
      attempts: newAttempts,
      xp_earned: newXpEarned,
      completed_at: new Date().toISOString(),
    });
    if (!upserted) return fail(res, 502, 'INTERNAL', 'Could not save progress');

    const stats = await getLearningStatsForUpdate(user.id);
    // Streak semantics (v1 parity / Duolingo model): ANY lesson passed today
    // sustains or extends the day streak — not only lessons never passed
    // before. Gating on `newlyPassed` meant replaying passed lessons could
    // never keep a streak alive once a course was finished.
    const firstToday = isFirstActivityToday(stats.updated_at);
    const newStreak = passedNow ? nextStreak(stats.updated_at, stats.streak_days) : stats.streak_days;
    const streakExtended = newStreak > stats.streak_days;

    const minutesDelta =
      parsed.data.seconds_spent !== undefined
        ? Math.max(1, Math.round(parsed.data.seconds_spent / 60))
        : (parsed.data.minutes_spent ?? 0);

    const statsUpdated = await patchLearningStats(user.id, {
      xp_points: stats.xp_points + xpDelta,
      minutes_learned: stats.minutes_learned + minutesDelta,
      lessons_completed: stats.lessons_completed + (newlyPassed ? 1 : 0),
      streak_days: newStreak,
    });
    if (!statsUpdated) return fail(res, 502, 'INTERNAL', 'Progress was saved, but learning stats could not be updated');

    // Re-fetch the tree so `progress`/`next_lesson_id` reflect the write above.
    const refreshedTree = await loadCourseTree(user.accessToken, user.id, ctx.course);

    return ok(res, {
      score: lessonScore,
      passed: newPassed,
      xp_earned: newXpEarned,
      xp_delta: xpDelta,
      // Day-streak facts for the results/celebration screen (v1 parity —
      // completeLesson returned new_streak/streak_extended/was_first_today).
      streak_days: newStreak,
      streak_extended: streakExtended,
      first_today: firstToday,
      minutes_learned: stats.minutes_learned + minutesDelta,
      lessons_completed: stats.lessons_completed + (newlyPassed ? 1 : 0),
      progress: refreshedTree?.course.progress ?? ctx.tree.course.progress,
      next_lesson_id: refreshedTree?.nextLessonId ?? ctx.tree.nextLessonId,
    });
  });

  return router;
}
