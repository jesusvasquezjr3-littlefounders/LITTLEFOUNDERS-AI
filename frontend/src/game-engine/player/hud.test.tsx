// GameHud's screen-reader live region — GAME_ENGINE.md §10 (canvas-vs-chrome boundary).
//
// The canvas is pointer-driven Phaser and out of reach for a screen reader by design;
// what this file verifies is the fallback that closes the audit finding: an AT user is
// never left silent about score/round/completion, and — just as important — is never
// spammed on ticks that changed nothing announced.
//
// `useLiveAnnouncement` is the one piece of real branching logic here (the JSX around
// it is a static `aria-live` div), so it is tested directly via `renderHook` rather than
// through the full `GameHud` render (which needs kit components, icons, etc. that would
// make this a rendering test instead of a logic test).
//
// NOT verified here (needs a real screen reader / live AT session, out of reach in this
// environment): that a mutation of this div's text is actually SPOKEN by VoiceOver/
// NVDA/JAWS with the timing and interruption behaviour `aria-live="polite"` implies.
// That is standard browser/AT behaviour this file relies on, not something jsdom can
// exercise.

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLiveAnnouncement } from './hud'

const t = (key: string, opts?: Record<string, unknown>): string => {
  if (key === 'games.a11y.live.score') return `Score ${String(opts?.['score'])}`
  if (key === 'games.a11y.live.round') return `Round ${String(opts?.['round'])}, score ${String(opts?.['score'])}`
  if (key === 'games.a11y.live.finished') return `Round complete. Final score ${String(opts?.['score'])}.`
  return key
}

describe('useLiveAnnouncement', () => {
  it('announces nothing on the first snapshot a run mounts with', () => {
    const { result } = renderHook(
      ({ snapshot }) => useLiveAnnouncement(snapshot, t),
      { initialProps: { snapshot: { score: 0, round: 0, finished: false } } },
    )
    expect(result.current).toBe('')
  })

  it('announces a score change', () => {
    const { result, rerender } = renderHook(
      ({ snapshot }) => useLiveAnnouncement(snapshot, t),
      { initialProps: { snapshot: { score: 0, round: 0, finished: false } } },
    )
    rerender({ snapshot: { score: 10, round: 0, finished: false } })
    expect(result.current).toBe('Score 10')
  })

  it('announces a round change (not a plain score restatement)', () => {
    const { result, rerender } = renderHook(
      ({ snapshot }) => useLiveAnnouncement(snapshot, t),
      { initialProps: { snapshot: { score: 10, round: 1, finished: false } } },
    )
    rerender({ snapshot: { score: 15, round: 2, finished: false } })
    expect(result.current).toBe('Round 2, score 15')
  })

  it('does not re-announce when neither score, round nor finished changed', () => {
    const { result, rerender } = renderHook(
      ({ snapshot }) => useLiveAnnouncement(snapshot, t),
      { initialProps: { snapshot: { score: 10, round: 1, finished: false } } },
    )
    rerender({ snapshot: { score: 10, round: 1, finished: false } })
    // Same primitive values -> the effect's dependency array does not change -> no
    // new message is set. A fresh, identical-looking snapshot object every tick
    // (exactly what the bridge sends) must not spam the live region.
    expect(result.current).toBe('')
  })

  it('announces completion exactly once, on the finished-false -> true edge', () => {
    const { result, rerender } = renderHook(
      ({ snapshot }) => useLiveAnnouncement(snapshot, t),
      { initialProps: { snapshot: { score: 40, round: 3, finished: false } } },
    )
    rerender({ snapshot: { score: 42, round: 3, finished: true } })
    expect(result.current).toBe('Round complete. Final score 42.')

    // Further churn after completion (e.g. a stray late snapshot) is not re-announced.
    rerender({ snapshot: { score: 42, round: 3, finished: true } })
    expect(result.current).toBe('Round complete. Final score 42.')
  })
})
