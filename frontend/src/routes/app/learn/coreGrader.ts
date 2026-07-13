import { api } from '@/lib/api';
import type { GradeMeta, Grader, Verdict } from '@/lesson-engine/core/types';

/*
 * Production Grader (LESSON_ENGINE.md §6-§7) — POSTs each segment attempt to
 * Core's /learn/lessons/:id/grade (backend/src/routes/learn.ts). Core is the
 * single source of truth for attempt counting and the score; the
 * client-declared `attempt_number` is just the honest local counter the
 * Grader contract asks for (GradeMeta) — the server re-derives and caps it
 * independently.
 *
 * Error mapping (documented choice, per the task brief):
 *  - 409 ATTEMPTS_EXHAUSTED → mapped to a terminal Verdict (score 0,
 *    tier 'tryAgain', allowRetry false) so the player's normal feedback flow
 *    renders and closes out cleanly instead of falling into the generic
 *    lesson.gradeError path — the kid gets a real (if unhappy) verdict, not
 *    an error banner, for a state that isn't actually an outage.
 *  - Every other failure (network, 403 LESSON_LOCKED, 422
 *    UNSUPPORTED_SEGMENT, 5xx/INTERNAL) rejects the promise. That IS the
 *    correct signal for LessonPlayer.submit()'s catch block, which shows
 *    lesson.gradeError and lets the kid retry the request — never a
 *    fabricated verdict for a real outage.
 */
export function createCoreGrader(lessonId: string, getToken: () => Promise<string | null>): Grader {
  return {
    async grade(segmentId: string, answer: unknown, meta: GradeMeta): Promise<Verdict> {
      const token = await getToken();
      const { data, error } = await api<{ verdict: Verdict }>(`/learn/lessons/${lessonId}/grade`, {
        method: 'POST',
        token,
        body: { segment_id: segmentId, answer, attempt_number: meta.attempt_number },
      });
      if (error) {
        if (error.code === 'ATTEMPTS_EXHAUSTED') {
          return { correct: false, score: 0, tier: 'tryAgain', allowRetry: false };
        }
        throw new Error(error.code);
      }
      return data.verdict;
    },
  };
}
