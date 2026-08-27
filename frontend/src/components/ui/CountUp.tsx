import { useEffect, useRef, useState } from 'react'

/*
 * A number that ARRIVES rather than appears.
 *
 * XP is the number a learner is playing for, and until now it changed the way a
 * variable changes: 40 became 50 between two frames and nothing said that ten of
 * those had just been earned. Counting is the cheapest gamification there is —
 * no new asset, no new screen — and it turns a value into an EVENT.
 *
 * ONE implementation, TWO behaviours, because the product genuinely needs both
 * and they are easy to confuse:
 *
 *   from: 'previous'  a LIVE number. 40 -> 50 counts the ten that were earned,
 *                     and the very first value is shown at rest, because a
 *                     lesson opening at 40 XP should read 40 rather than spend
 *                     an animation on points nobody just won.
 *   from: 0           a REVEAL. The results screen counts up from zero once, as
 *                     a summary being unveiled. `useCountUp` in the player's
 *                     `completion.ts` is this mode and nothing else — it used to
 *                     be a second copy of this loop, which is how two counters
 *                     drift into behaving differently for no stated reason.
 *
 * REDUCED MOTION IS A MODIFIER, NOT A SECOND PATH: the value still updates and
 * still lands on the same number, it simply arrives at once. Two code paths
 * would mean the accessible one is the one nobody looks at (DESIGN.md motion).
 */

const DEFAULT_DURATION_MS = 620

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ease-out cubic: fast enough to feel like a reward, slow enough to read. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3
}

export interface CountToOptions {
  durationMs?: number
  /** Where each run starts. See the note above. */
  from?: 'previous' | 'zero'
}

export function useCountTo(target: number, options: CountToOptions = {}): number {
  const { durationMs = DEFAULT_DURATION_MS, from = 'previous' } = options
  const [shown, setShown] = useState(from === 'zero' ? 0 : target)
  const settled = useRef(from === 'zero' ? 0 : target)
  const frame = useRef<number | null>(null)
  const started = useRef(from === 'zero')

  useEffect(() => {
    // A live counter shows its FIRST value at rest; a reveal animates from the
    // first render, which is the whole point of a reveal.
    if (!started.current) {
      started.current = true
      settled.current = target
      setShown(target)
      return
    }
    if (settled.current === target) return

    if (prefersReducedMotion()) {
      settled.current = target
      setShown(target)
      return
    }

    const start = from === 'zero' ? 0 : settled.current
    const delta = target - start
    // `performance.now`, not a frame count: the tween has to land on the exact
    // target whatever the frame rate did on the way there.
    const began = performance.now()
    if (from === 'zero') setShown(0)

    const step = (now: number) => {
      const t = Math.min(1, (now - began) / durationMs)
      setShown(Math.round(start + delta * ease(t)))
      if (t < 1) {
        frame.current = requestAnimationFrame(step)
      } else {
        settled.current = target
        frame.current = null
      }
    }
    frame.current = requestAnimationFrame(step)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      /*
       * An unmount or a re-target mid-count must leave the number TRUE. A
       * counter that remembers 47 while the session says 50 is a lie that
       * survives the animation that told it.
       */
      settled.current = target
    }
  }, [target, durationMs, from])

  return shown
}

export function CountUp({
  value,
  className,
  ...options
}: { value: number; className?: string } & CountToOptions) {
  return <span className={className}>{useCountTo(value, options)}</span>
}

export default CountUp
