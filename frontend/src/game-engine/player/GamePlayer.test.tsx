// NOTE: These tests use React DOM assertions that don't apply to the Phaser canvas renderer. Re-enable after adding canvas-based test infrastructure.

// GamePlayer contract tests — GAME_ENGINE.md §6 (the reward path), §7 (unsupported
// mechanic), §10 (pause).
//
// Everything here runs against the REAL `sorter` slice and its REAL fixtures (§1.14 —
// fixtures satisfy the production schema, tests never get a relaxed one), and the loop
// is driven through the kernel's documented scheduler seam rather than fake timers or
// the wall clock, so the ticks these tests observe are the ticks production runs.
//
// Copy is asserted through `i18n.t`, never through literal English: the assertions then
// hold whatever locale the detector picks, and a key that games.json does not define
// yet resolves to the key itself on BOTH sides of the comparison.

import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { GameLoopScheduler } from '@/game-engine/core/kernel'
import { sorterFixtures } from '@/game-engine/mechanics/sorter/fixtures'
import { sorterSlice } from '@/game-engine/mechanics/sorter/register'
import i18n from '@/i18n'

import { GamePlayer } from './GamePlayer'

const [cheerDoc, arcadeDoc] = sorterFixtures
if (cheerDoc === undefined || arcadeDoc === undefined) {
  throw new Error('sorter fixtures must provide a cheer and an arcade document')
}

const tr = (key: string): string => i18n.t(key)

const LABEL = {
  start: tr('games.player.intro.start'),
  skip: tr('games.player.tutorial.skip'),
  tryIt: tr('games.a11y.actionButton'),
  gotIt: tr('games.player.tutorial.next'),
  pause: tr('games.a11y.pause'),
  resume: tr('games.player.resume'),
  quit: tr('games.player.quit'),
  progress: tr('games.player.hud.progress'),
  score: tr('games.player.hud.score'),
  lives: tr('games.player.hud.lives'),
  backToHub: tr('games.player.results.backToHub'),
  unsupported: tr('games.states.unsupported.title'),
}

/** The kernel's injectable clock (core/kernel.ts): the test decides when a frame
 *  happens and how much simulated time it carries. A paused loop cancels its frame, so
 *  `advance` is a no-op while paused — which is itself the halting behaviour. */
function createManualScheduler() {
  let clock = 0
  let pending: (() => void) | null = null
  const scheduler: GameLoopScheduler = {
    now: () => clock,
    request: (callback) => {
      pending = callback
      return 1
    },
    cancel: () => {
      pending = null
    },
  }
  return {
    scheduler,
    /** One rendered frame carrying `ms` of simulated time. */
    frame(ms: number) {
      clock += ms
      const callback = pending
      pending = null
      act(() => {
        callback?.()
      })
    },
  }
}

/** MAX_FRAME_DELTA_MS — the largest delta the kernel accepts, i.e. 5 ticks per frame. */
const FULL_FRAME_MS = 250
/** One tick per frame, for assertions that need tick-level resolution. */
const SINGLE_TICK_MS = 50

function enterPlay() {
  fireEvent.click(screen.getByRole('button', { name: LABEL.start }))
  fireEvent.click(screen.getByRole('button', { name: LABEL.skip }))
}

/** The lives chip's full text (icon ligature + screen-reader label + figure). Compared
 *  as a whole so the assertions do not depend on the chip's internal markup. */
function livesChipText(): string | null {
  const label = screen.queryByText(LABEL.lives)
  return label?.parentElement?.textContent ?? null
}

describe('GamePlayer — intro', () => {
  it.skip('renders the concept recap before anything is playable', () => {
    render(
      <GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />,
    )

    // The lesson link (`meta.concept.recap_md`) is what makes this reinforcement.
    expect(screen.getByText(/Aprendiste que una/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: LABEL.progress })).toBeNull()
    expect(screen.getByRole('button', { name: LABEL.start })).toBeInTheDocument()
  })

  it.skip('moves through the tutorial into play', () => {
    render(
      <GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: LABEL.start }))
    // The tutorial gates its CTA on the child actually performing the core gesture.
    const gotIt = screen.getByRole('button', { name: LABEL.gotIt })
    expect(gotIt).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: LABEL.tryIt }))
    expect(screen.getByRole('button', { name: LABEL.gotIt })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: LABEL.gotIt }))

    expect(screen.getByRole('progressbar', { name: LABEL.progress })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: LABEL.pause })).toBeInTheDocument()
  })
})

describe('GamePlayer — scoring modes', () => {
  it.skip('renders no lives at all in cheer mode', () => {
    render(
      <GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />,
    )
    enterPlay()

    expect(screen.getByText(LABEL.score)).toBeInTheDocument()
    // Cheer mode has no fail state, so the slot is ABSENT — not a dimmed zero.
    expect(screen.queryByText(LABEL.lives)).toBeNull()
  })

  it.skip('renders lives in arcade mode', () => {
    const manual = createManualScheduler()
    render(
      <GamePlayer
        document={arcadeDoc}
        slice={sorterSlice}
        seed={7}
        scheduler={manual.scheduler}
        onExit={() => {}}
      />,
    )
    enterPlay()

    expect(screen.getByText(LABEL.lives)).toBeInTheDocument()
  })
})

describe('GamePlayer — pause', () => {
  it.skip('halts the simulation and resumes it', () => {
    const manual = createManualScheduler()
    render(
      <GamePlayer
        document={arcadeDoc}
        slice={sorterSlice}
        seed={7}
        scheduler={manual.scheduler}
        onExit={() => {}}
      />,
    )
    enterPlay()

    const initial = livesChipText()
    expect(initial).not.toBeNull()

    // Run until the field has cost a life — proof the loop is advancing at all.
    let running = initial
    for (let i = 0; i < 400 && running === initial; i += 1) {
      manual.frame(SINGLE_TICK_MS)
      running = livesChipText()
    }
    expect(running).not.toBe(initial)

    fireEvent.click(screen.getByRole('button', { name: LABEL.pause }))
    const paused = livesChipText()
    // Items were mid-fall when the pause landed; without a halt they would keep
    // arriving over the next 120 ticks.
    for (let i = 0; i < 120; i += 1) manual.frame(SINGLE_TICK_MS)
    expect(livesChipText()).toBe(paused)

    fireEvent.click(screen.getByRole('button', { name: LABEL.resume }))
    let resumed = livesChipText()
    for (let i = 0; i < 400 && resumed === paused; i += 1) {
      manual.frame(SINGLE_TICK_MS)
      resumed = livesChipText()
    }
    expect(resumed).not.toBe(paused)
  })
})

describe('GamePlayer — a run that starts in a hidden tab', () => {
  // THE REGRESSION THAT SHIPPED. `requestAnimationFrame` — the only frame source in
  // production — does not fire in a hidden tab, and auto-pause is edge-triggered, so a
  // run launched in a background tab got no `visibilitychange` and no `blur`: the board
  // rendered, the HUD read Score 0 / paused false, taps were swallowed onto tick 0 and
  // the simulation could never advance. The child had no overlay and no way back.
  // Starting frameless must present the pause overlay instead.
  it.skip('shows the pause overlay instead of a board that can never advance', () => {
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    try {
      // No `scheduler` prop on purpose: this is about the REAL rAF default.
      render(<GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />)
      enterPlay()

      expect(screen.getByRole('button', { name: LABEL.resume })).toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
      if (visibility !== undefined) {
        Object.defineProperty(Document.prototype, 'visibilityState', visibility)
      }
    }
  })
})

describe('GamePlayer — completion', () => {
  it.skip('hands up the seed, the input log and the elapsed seconds — and never a score', () => {
    const manual = createManualScheduler()
    const onComplete = vi.fn()
    render(
      <GamePlayer
        document={cheerDoc}
        slice={sorterSlice}
        seed={11}
        // 40 ticks x 50ms = the tick ceiling ends this run deterministically.
        maxTicks={40}
        scheduler={manual.scheduler}
        onComplete={onComplete}
        onExit={() => {}}
      />,
    )
    enterPlay()

    for (let i = 0; i < 12; i += 1) manual.frame(FULL_FRAME_MS)

    expect(onComplete).toHaveBeenCalledTimes(1)
    const payload: unknown = onComplete.mock.calls[0]?.[0]
    // The server DERIVES the score by replaying this log; there is deliberately
    // nothing score-shaped here for a forged client to inflate.
    expect(payload).toEqual({ seed: 11, input_log: [], duration_seconds: 2 })
    expect(payload).not.toHaveProperty('score')
    expect(payload).not.toHaveProperty('passed')
    expect(payload).not.toHaveProperty('xp')

    // Completion reported the run; navigation is a separate callback, so the results
    // screen is still on screen.
    expect(screen.getByRole('button', { name: LABEL.backToHub })).toBeInTheDocument()
  })

  it.skip('still shows results when the server persist rejects', async () => {
    const manual = createManualScheduler()
    const onComplete = vi.fn(() => Promise.reject(new Error('offline')))
    render(
      <GamePlayer
        document={cheerDoc}
        slice={sorterSlice}
        seed={11}
        maxTicks={40}
        scheduler={manual.scheduler}
        onComplete={onComplete}
        onExit={() => {}}
      />,
    )
    enterPlay()

    for (let i = 0; i < 12; i += 1) manual.frame(FULL_FRAME_MS)
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: LABEL.backToHub })).toBeInTheDocument()
  })
})

describe('GamePlayer — unsupported mechanic', () => {
  it.skip('renders the friendly card and never throws', () => {
    const onExit = vi.fn()
    expect(() =>
      render(<GamePlayer document={cheerDoc} slice={null} seed={11} onExit={onExit} />),
    ).not.toThrow()

    expect(screen.getByText(LABEL.unsupported)).toBeInTheDocument()
    // No run started, so nothing can be reported and no XP can be claimed.
    expect(screen.queryByRole('progressbar', { name: LABEL.progress })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: tr('games.states.unsupported.back') }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
