import { api } from '@/lib/api';
import type { GradeMeta, Grader, Verdict } from '@/lesson-engine/core/types';
import { guidedReviewOfferSchema, type GuidedReviewOfferValue } from '@/rebuild/learning/GuidedReviewOffer';

/*
 * Production Grader (LESSON_ENGINE.md §6-§7) — POSTs each segment attempt to
 * Core's /learn/lessons/:id/grade (backend/src/routes/learn.ts). Core is the
 * single source of truth for attempt counting and the score; the
 * client-declared `attempt_number` is just the honest local counter the
 * Grader contract asks for (GradeMeta) — the server re-derives and caps it
 * independently.
 *
 * Error mapping: EVERY failure — 409 ATTEMPTS_EXHAUSTED included — rejects the
 * promise so LessonPlayer.submit()'s catch shows the neutral gradeError state
 * and never fabricates a verdict. The old code synthesized a score-0 "fail" for
 * 409, which — combined with lifetime attempt counting — painted a 0/100 FAIL
 * over a CORRECT answer on any replay. Attempts are now run-scoped (a fresh
 * run_id per lesson entry, 0012), so a replay no longer 409s at all; the state
 * is a genuine edge, and a neutral banner is the honest response to it.
 *
 * `runId` scopes the server's attempt cap to this lesson entry; `hints_used`
 * (from the grade meta) lets the server apply the hint penalty authoritatively.
 */
export function createCoreGrader(
  lessonId: string,
  getToken: () => Promise<string | null>,
  runId?: string,
  /**
   * B.26 / OD-1 (S05.3f): after consecutive misses on one skill Core's grade
   * response carries the Mentor's guided-review offer. It rides beside the
   * verdict (never inside it), so the verdict contract is unchanged.
   */
  options: { onGuidedReview?: (offer: GuidedReviewOfferValue) => void } = {},
): Grader {
  return {
    async grade(segmentId: string, answer: unknown, meta: GradeMeta): Promise<Verdict> {
      const token = await getToken();
      const body: Record<string, unknown> = { segment_id: segmentId, answer, attempt_number: meta.attempt_number };
      if (runId) body.run_id = runId;
      if (typeof meta.hints_used === 'number') body.hints_used = meta.hints_used;
      if (typeof meta.time_spent_seconds === 'number') body.time_spent_seconds = meta.time_spent_seconds;
      const { data, error } = await api<{ verdict: Verdict; guided_review?: unknown }>(`/learn/lessons/${lessonId}/grade`, {
        method: 'POST',
        token,
        body,
      });
      if (error) throw new Error(error.code);
      const offer = guidedReviewOfferSchema.safeParse(data.guided_review);
      if (offer.success) options.onGuidedReview?.(offer.data);
      return data.verdict;
    },
  };
}
