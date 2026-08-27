import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { CountUp } from '../CountUp'

/*
 * The counter is the whole of "XP animates rather than appears", so what it
 * must never do is more interesting than what it does: it must never show a
 * number that is not on its way to the true one, and it must never spend an
 * animation on a value nobody just earned.
 */

let matches = false
let now = 0
const frames: FrameRequestCallback[] = []

beforeEach(() => {
  matches = false
  now = 0
  frames.length = 0
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Runs the queued frames as if `ms` had passed since the tween began. */
function advance(ms: number) {
  now = ms
  act(() => {
    const queued = [...frames]
    frames.length = 0
    for (const frame of queued) frame(now)
  })
}

describe('CountUp', () => {
  it('SHOWS ITS FIRST VALUE AT REST — it does not count up to a number nobody earned', () => {
    /*
     * A lesson resumed at 40 XP should read 40 while the learner reads the
     * prompt. Counting from zero there would spend the one signal we have for
     * "you just earned this" on a value that was already theirs.
     */
    render(<CountUp value={40} />)
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(frames).toHaveLength(0)
  })

  it('counts from the PREVIOUS value to the new one, and lands exactly', () => {
    const { rerender } = render(<CountUp value={40} />)
    rerender(<CountUp value={50} />)

    advance(310) // half of the 620 ms tween
    const midway = Number(screen.getByText(/\d+/).textContent)
    expect(midway).toBeGreaterThan(40)
    expect(midway).toBeLessThan(50)

    advance(620)
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('lands on the target immediately under reduced motion', () => {
    // The modifier, not a second path: same final number, no frames spent.
    matches = true
    const { rerender } = render(<CountUp value={40} />)
    rerender(<CountUp value={90} />)
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(frames).toHaveLength(0)
  })

  it('from "zero" reveals, which is what the results screen does', () => {
    render(<CountUp value={30} from="zero" />)
    expect(screen.getByText('0')).toBeInTheDocument()
    advance(900)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('re-targeting mid-count still lands on the LAST value, not the one it was chasing', () => {
    /*
     * Two right answers in quick succession. A counter that finished its first
     * tween and stopped would sit at 50 while the session says 60 — a lie that
     * outlives the animation that told it.
     */
    const { rerender } = render(<CountUp value={40} />)
    rerender(<CountUp value={50} />)
    advance(200)
    rerender(<CountUp value={60} />)
    advance(2000)
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('counts DOWN as readily as up', () => {
    // Hearts and any other spendable number use the same component; a counter
    // that only handles growth would jump on the one that matters most.
    const { rerender } = render(<CountUp value={30} />)
    rerender(<CountUp value={10} />)
    advance(620)
    expect(screen.getByText('10')).toBeInTheDocument()
  })
})
