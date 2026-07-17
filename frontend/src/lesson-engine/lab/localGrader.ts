// DEV-ONLY local grader (LESSON_ENGINE.md §3, §6). Powers /dev/lesson-lab and
// fixtures. Production lessons are graded by Core server-side — this module must
// never be imported from a production route (registry-completeness test asserts
// the lab route is dev-gated).

import type { GradeMeta, Grader, LessonDocument, Verdict } from '../core/types'
import { tierFor } from '../core/types'
import { GRADERS } from '../registry'

export function createLocalGrader(fullDocument: LessonDocument): Grader {
  const { pass_threshold, max_attempts } = fullDocument.scoring
  return {
    grade(segmentId: string, answer: unknown, meta: GradeMeta): Promise<Verdict> {
      const segment = fullDocument.segments.find((s) => s.id === segmentId)
      const grader = segment ? GRADERS[segment.type] : undefined
      if (!segment || !grader) {
        return Promise.resolve({
          correct: false,
          score: 0,
          tier: 'tryAgain',
          allowRetry: true,
        })
      }
      const outcome = grader(segment, answer)
      const score = Math.max(0, Math.min(100, Math.round(outcome.score)))
      const finalAttempt = meta.attempt_number >= max_attempts
      const revealAllowed = score >= 100 || finalAttempt
      return Promise.resolve({
        correct: score >= pass_threshold,
        score,
        tier: tierFor(score, pass_threshold),
        feedback_md: outcome.feedback_md,
        // Reveal gating (§6): only when retries are exhausted or the score is 100.
        reveal: revealAllowed ? outcome.reveal : undefined,
        allowRetry: score < 100 && !finalAttempt,
      })
    },
  }
}
