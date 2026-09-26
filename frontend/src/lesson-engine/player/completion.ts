// Server-completion contract + count-up hook for the results/celebration
// screens (LESSON_ENGINE.md §7). The shape mirrors Core's POST
// /learn/lessons/:id/complete response — day-streak facts included so the
// player can run the v1-style streak celebration without a second fetch.

import { useCountTo } from '@/components/ui/CountUp'
import { mayCelebrate, streakMilestone, type Milestone } from '@/rebuild/design/milestones'

export interface ServerCompletion {
  /** THIS run's score/pass (0012) — not a lifetime best. */
  score: number
  passed: boolean
  /** Persisted all-time best score for this lesson (for "Hoy vs Tu mejor"). */
  best_score: number
  xp_earned: number
  xp_delta: number
  streak_days: number
  /** All-time high-water mark of the day streak (0013). */
  longest_streak: number
  streak_extended: boolean
  first_today: boolean
  minutes_learned: number
  lessons_completed: number
  next_lesson_id: string | null
  /**
   * B.5 (S05.3d): Core's replay facts for this run. `notice: 'best_kept'`
   * means this run scored below the kept best, which is unchanged, and the
   * results screen must say so. XP is paid only above the XP already kept.
   */
  replay?: {
    kind: 'first' | 'retry' | 'replay'
    previous_best_score: number | null
    best_score_kept: boolean
    notice: 'best_kept' | 'new_best' | 'none'
    xp_policy: 'improvement_only'
  }
  /**
   * B.20 (S05.3e): the closed OD-7 milestone list this completion reached,
   * decided by Core. The player celebrates nothing that is not on it; an
   * older Core without the field celebrates nothing (fail closed).
   */
  celebrations?: string[]
  /** B.20 (S05.3e): the skills this lesson taught, in the learner's locale (what the XP was for). */
  recognition?: { skills: string[] }
  /** B.21 (S05.3e): what the completion did to the habit streak. */
  streak?: {
    outcome: string
    milestone: 7 | 30 | 100 | null
    rest_days_bridged: number
    rest_days_left: number
  }
}

/**
 * The results screen's REVEAL counter: zero to the final value, once.
 *
 * It delegates to `useCountTo`, which is the same loop the live XP chip in the
 * header runs. It used to be its own copy — same easing, same reduced-motion
 * check, written twice — and two counters written twice are two counters that
 * eventually behave differently for no reason anybody wrote down.
 */
export function useCountUp(target: number, durationMs = 900): number {
  return useCountTo(target, { durationMs, from: 'zero' })
}

/** mm:ss for the results Time card — never shows an estimate as real time (v1 rule). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

/**
 * B.20 / OD-7 (S05.3e): the streak takeover's only gate. A completion earns it
 * only when Core's streak reached 7, 30 or 100 days AND Core named that
 * milestone in `celebrations`. An ordinary extension, a rest day, a restart,
 * a failed run or an older Core without the fields: null, no takeover.
 */
export function streakCelebrationFor(server: ServerCompletion | null): Milestone | null {
  if (!server || !server.passed || !server.streak?.milestone) return null
  const milestone = streakMilestone(server.streak.milestone)
  return milestone && mayCelebrate(server.celebrations, milestone) ? milestone : null
}
