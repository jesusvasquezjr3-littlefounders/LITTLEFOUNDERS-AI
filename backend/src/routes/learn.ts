import {
  getRolesForGate,
  hasActiveAnalyticsConsent,
  insertLearningEvents,
  stampRole,
} from '../services/insights.js';
import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { GRADERS, KEYLESS_GRADERS } from '../lesson-contract/registry.js';
import { verdictFrom } from '../lesson-contract/core/types.js';
import { assembleCourseTree, findLessonNode, summarizeCourseTree, type CourseTree } from '../services/courseTree.js';
import { findGradingSegment, gradedSegmentIds, pickLessonLocale, stripAnswers, xpBySegmentId } from '../services/lessonDocument.js';
import { isCalendarDate, isFirstActivityToday, nextStreak } from '../services/streak.js';
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
    // Per-lesson-entry id: the attempt cap counts only rows from this run so
    // replays start fresh (0012). Optional for legacy clients (lifetime count).
    run_id: z.string().uuid().optional(),
    // Hints the kid revealed before submitting — the server applies the penalty
    // (authoritative), so a hint actually lowers the score and a reload can't
    // launder it (0012). Optional; defaults to 0.
    hints_used: z.number().int().min(0).max(10).optional(),
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
    // Keyless graders (memory_flip) score from the submitted board alone and
    // have no answer key — the answer-key requirement would 422 them forever.
    if (!grader || (segment.answer === undefined && !KEYLESS_GRADERS.has(segment.type))) {
      return fail(res, 422, 'UNSUPPORTED_SEGMENT', 'This segment cannot be graded');
    }

    const scoring = (picked.document as { scoring?: { pass_threshold?: number; max_attempts?: number; hint_penalty_pct?: number } }).scoring ?? {};
    const passThreshold = typeof scoring.pass_threshold === 'number' ? scoring.pass_threshold : 70;
    const maxAttempts = typeof scoring.max_attempts === 'number' ? scoring.max_attempts : 2;
    const hintPenaltyPct = typeof scoring.hint_penalty_pct === 'number' ? scoring.hint_penalty_pct : 0;
    const runId = parsed.data.run_id;
    const hintsUsed = parsed.data.hints_used ?? 0;

    // SERVER-AUTHORITATIVE: the client-declared `attempt_number` is validated
    // shape-wise but never trusted for the cap decision or the recorded row —
    // the DB's own attempt count is the only source of truth. Scoped to the
    // current run (0012) so a replay starts fresh.
    const existingAttempts = await countSegmentAttempts(user.accessToken, user.id, lessonId, segmentId, runId);
    if (existingAttempts >= maxAttempts) {
      return fail(res, 409, 'ATTEMPTS_EXHAUSTED', 'No attempts remain for this segment');
    }
    const serverAttemptNumber = existingAttempts + 1;

    const outcome = grader(segment, answer);
    // Apply the hint penalty server-side (0012): each revealed hint compounds a
    // (1 - hint_penalty_pct/100) factor. This is the ONLY place the penalty is
    // applied — the recorded score, the verdict, and /complete's recompute all
    // flow from it, so a hint truly lowers the score/XP and a reload can't
    // launder it.
    const penaltyFactor = Math.pow(1 - hintPenaltyPct / 100, hintsUsed);
    const penalizedScore = Math.max(0, Math.min(100, Math.round(outcome.score * penaltyFactor)));
    const verdict = verdictFrom(penalizedScore, passThreshold, outcome.feedback_md);
    const isFinalAttempt = serverAttemptNumber >= maxAttempts;
    verdict.allowRetry = verdict.score < 100 && !isFinalAttempt;
    // Reveal gating (LESSON_ENGINE.md §6): only on a perfect score or the last permitted try.
    if (verdict.score === 100 || isFinalAttempt) {
      verdict.reveal = outcome.reveal;
    }

    const recorded = await insertSegmentAttempt(user.id, lessonId, segmentId, serverAttemptNumber, verdict.score, runId, hintsUsed);
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

    // Score THIS run (0012): scoped to the run_id so a replay reflects the
    // play-through the kid just did, not a lifetime best. Progress below still
    // keeps the all-time best.
    const attempts = await getSegmentAttempts(user.accessToken, user.id, lessonId, parsed.data.run_id);
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

    // null means Vault did not answer — NOT "this learner has zero progress".
    // Abort rather than compute the update from assumed zeros: the PATCH below
    // is a blind overwrite and would erase the learner's accumulated totals.
    // The lesson_progress row above is already saved, so nothing is lost by
    // stopping here; the client can retry the completion.
    const stats = await getLearningStatsForUpdate(user.id);
    if (!stats) return fail(res, 502, 'INTERNAL', 'Progress was saved, but learning stats could not be updated');
    // Streak semantics (v1 parity / Duolingo model): ANY lesson passed today
    // sustains or extends the day streak — anchored to last_active_date
    // (the learner's LOCAL calendar day, 0009), pure date math only.
    const todayLocal = parsed.data.local_date ?? new Date().toISOString().slice(0, 10);
    const firstToday = passedNow && isFirstActivityToday(stats.last_active_date, todayLocal);
    const newStreak = passedNow ? nextStreak(stats.last_active_date, stats.streak_days, todayLocal) : stats.streak_days;
    const streakExtended = newStreak > stats.streak_days;
    // All-time high-water mark of the day streak (0013) — the results "Mejor
    // racha" card reads this, so it's always >= the current streak (no more
    // "Mejor racha 0" next to "Racha 1").
    const newLongestStreak = Math.max(stats.longest_streak ?? 0, newStreak);

    const minutesDelta =
      parsed.data.seconds_spent !== undefined
        ? Math.max(1, Math.round(parsed.data.seconds_spent / 60))
        : (parsed.data.minutes_spent ?? 0);

    const statsUpdated = await patchLearningStats(user.id, {
      xp_points: stats.xp_points + xpDelta,
      minutes_learned: stats.minutes_learned + minutesDelta,
      lessons_completed: stats.lessons_completed + (newlyPassed ? 1 : 0),
      streak_days: newStreak,
      longest_streak: newLongestStreak,
      ...(passedNow ? { last_active_date: todayLocal } : {}),
    });
    if (!statsUpdated) return fail(res, 502, 'INTERNAL', 'Progress was saved, but learning stats could not be updated');

    /*
     * Retention signal, recorded SERVER-side because only the server knows
     * whether the streak genuinely extended (it owns last_active_date and the
     * date maths). value = the new streak length, so "how far do streaks
     * actually get" is answerable without touching learning_stats.
     * Fire-and-forget and consent-gated like every other kid event.
     */
    // Activation milestone: the FIRST lesson this learner ever passed. Only
    // the server can assert it (it sees lessons_completed before the update),
    // and it is the single most predictive early-retention event there is.
    if (newlyPassed && stats.lessons_completed === 0) {
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

    if (streakExtended) {
      void (async () => {
        const roles = await getRolesForGate(user.id);
        if (!roles || roles.length === 0) return;
        if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
        await insertLearningEvents([{
          user_id: user.id, role: stampRole(roles), event: 'streak_extend',
          route_class: 'learn', value: newStreak,
        }]);
      })();
    }

    // Re-fetch the tree so `progress`/`next_lesson_id` reflect the write above.
    const refreshedTree = await loadCourseTree(user.accessToken, user.id, ctx.course);

    return ok(res, {
      // THIS run's outcome (0012) — the results ring/title reflect the
      // play-through the kid just did, never a historical best presented as
      // the current result. `best_score` carries the persisted all-time best
      // for a "Hoy vs Tu mejor" display.
      score: lessonScore,
      passed: passedNow,
      best_score: newBestScore,
      xp_earned: newXpEarned,
      xp_delta: xpDelta,
      // Day-streak facts for the results/celebration screen (v1 parity —
      // completeLesson returned new_streak/streak_extended/was_first_today).
      streak_days: newStreak,
      longest_streak: newLongestStreak,
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
