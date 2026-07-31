// GamePlayer contract tests — GAME_ENGINE.md §6 (the reward path), §7 (unsupported
// mechanic), §10 (pause).
//
// Everything here runs against the REAL `sorter` slice and its REAL fixtures (§1.14 —
// fixtures satisfy the production schema, tests never get a relaxed one).
//
// Copy is asserted through `i18n.t`, never through literal English: the assertions then
// hold whatever locale the detector picks, and a key that games.json does not define
// yet resolves to the key itself on BOTH sides of the comparison.
//
// STATUS (post Phaser rewrite, commits 4680a61/4530850/695891c). The Phaser rewrite
// replaced the React-DOM play surface with a `<canvas>` PhaserGameBox, and it also
// deleted the injectable-clock seam: `GamePlayerProps.scheduler` is still declared and
// still threaded down to `GameStage`, but `GameStage` (this file's production
// counterpart, player/GamePlayer.tsx) never destructures it, so it is a DEAD prop on
// the Phaser play path today — confirmed by reading GamePlayer.tsx, not assumed.
// `PhaserGameBox` runs its own Phaser-driven loop with no test seam of any kind.
//
// The tests below split cleanly along that line:
//   - `intro`/`tutorial`/`scoring modes (cheer)`/`unsupported mechanic` never depend on
//     the bridge ticking — they assert on the pre-play shell or on `doc.scoring` alone
//     — and pass UNMODIFIED under `test-setup.ts`'s Phaser mock.
//   - Everything that needs the bridge to actually start and tick (arcade lives,
//     pause/resume, completion, the hidden-tab regression) is blocked: the mock's
//     `Game` class has no `scene` manager (`game.scene.add(...)` throws inside
//     `PhaserGameBox`'s fire-and-forget `start()`) and its `events.on`/`once` never
//     invoke a listener, so `scene.start()` never runs, the bridge never advances past
//     its `create()`-time initial snapshot, and `onSnapshot`/`onFinish`/`onAutoPause`
//     never fire. These stay `.skip`, each with the specific reason at the call site
//     rather than this file's old blanket "canvas rendering requires browser E2E" —
//     that blanket line was true for exactly 0 of the 6 mock-blocked tests below for
//     the reason just given (a Game.scene/events gap, not a canvas-pixels gap) and
//     false for the 3 that pass unmodified.

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
  it('renders the concept recap before anything is playable', () => {
    render(
      <GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />,
    )

    // The lesson link (`meta.concept.recap_md`) is what makes this reinforcement.
    expect(screen.getByText(/Aprendiste que una/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: LABEL.progress })).toBeNull()
    expect(screen.getByRole('button', { name: LABEL.start })).toBeInTheDocument()
  })

  it('moves through the tutorial into play', () => {
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
  it('renders no lives at all in cheer mode', () => {
    render(
      <GamePlayer document={cheerDoc} slice={sorterSlice} seed={11} onExit={() => {}} />,
    )
    enterPlay()

    expect(screen.getByText(LABEL.score)).toBeInTheDocument()
    // Cheer mode has no fail state, so the slot is ABSENT — not a dimmed zero.
    expect(screen.queryByText(LABEL.lives)).toBeNull()
  })

  // BLOCKED: `snapshot.lives` starts at the `useState` default (`null`) and only ever
  // changes inside `BaseMechanicScene.update()`'s `_onSnapshot` callback (phaser/
  // scene.ts). Under `test-setup.ts`'s Phaser mock, `PhaserGameBox`'s `start()` throws
  // at `game.scene.add(...)` (the mocked `Game` has no `scene` property at all) before
  // it ever reaches `game.events.once('ready', ...)`, and even that listener is a
  // no-op in the mock — so the scene never boots and `onSnapshot` never fires past the
  // initial default. `manual.scheduler` is passed here but does nothing: the Phaser
  // play path has no scheduler seam (see the file header). Needs a live browser with a
  // real `Phaser.Game` (canvas + WebGL/Canvas2D context) to observe.
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
  // BLOCKED: same root cause as "renders lives in arcade mode" above — the mock
  // `Game` never actually boots a scene, so `livesChipText()` never leaves its initial
  // `null` and this loop would spin all 400 simulated frames without the lives chip
  // ever changing. `manual.scheduler` is inert on the Phaser path (see file header).
  // Needs a live browser: real ticks, a real fall-and-lose-a-life event, and a real
  // click-driven `PhaserGameBox`'s `togglePause()` round trip.
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
  //
  // PRODUCTION GAP NOW CLOSED (see `player/PhaserGameBox.tsx`'s `ready` handler and its
  // `Phaser.Core.Events.HIDDEN` listener). The prior version wired exactly ONE
  // auto-pause source, `game.events.on(Phaser.Core.Events.BLUR, ...)` — EDGE-TRIGGERED
  // on the window losing focus, verified against the installed Phaser 3.90 source
  // (node_modules/phaser/src/core/VisibilityHandler.js, Game.js `onHidden`/`start`) to
  // never inspect `document.hidden`/`visibilityState` at the moment it attaches, so a
  // document ALREADY hidden when the listener installs got no transition and therefore
  // no event at all — the ORIGINAL incident, reproducible in a real browser. Fixed by
  // (1) a one-time `globalThis.document.hidden` check right after `scene.start()`,
  // firing `onAutoPause` immediately if the run begins hidden, and (2) also listening
  // for `Phaser.Core.Events.HIDDEN` (document.visibilitychange -> hidden) alongside
  // `BLUR`, so a same-tab visibility change while the window keeps focus is covered
  // too, not just window blur.
  //
  // STILL SKIPPED — this file's jsdom Phaser mock independently can't reach ANY of
  // this: the mocked `Game` has no `scene` property, so `PhaserGameBox`'s `start()`
  // throws at `game.scene.add(...)` before it ever reaches the `ready` handler where
  // both the boot-time check and the HIDDEN/BLUR listeners live — the same root cause
  // that blocks every other bridge-driven test in this file (see the file header).
  // Closing this needs either a live browser or a `test-setup.ts` Phaser mock with a
  // working scene manager (shared infra outside this file's ownership); a headless
  // browser-level check of the fix itself was run separately in-session instead.
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
  // BLOCKED: `onComplete` fires from `handleFinish`, which only runs off
  // `BaseMechanicScene.update()`'s finished-edge check (phaser/scene.ts) — the same
  // code path that never runs under the mock (see file header: `game.scene.add`
  // throws before boot, `events.on`/`once` are no-ops). `manual.scheduler`/`FULL_FRAME_MS`
  // frames are fed to nothing; the Phaser play path is driven by Phaser's own RAF loop,
  // not this seam. Needs a live browser to reach the tick ceiling and observe
  // `onComplete`'s payload for real.
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

  // BLOCKED: same root cause — `onComplete` (and therefore the results screen) never
  // fires because the run never reaches its tick ceiling under the mock.
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
  it('renders the friendly card and never throws', () => {
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
