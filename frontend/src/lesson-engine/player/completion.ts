// Server-completion contract + count-up hook for the results/celebration
// screens (LESSON_ENGINE.md §7). The shape mirrors Core's POST
// /learn/lessons/:id/complete response — day-streak facts included so the
// player can run the v1-style streak celebration without a second fetch.

import { useEffect, useRef, useState } from 'react'

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
}

/** rAF ease-out-cubic counter (v1's useCountUp). Respects reduced motion by jumping straight to the target. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, durationMs])

  return value
}

/** mm:ss for the results Time card — never shows an estimate as real time (v1 rule). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}
