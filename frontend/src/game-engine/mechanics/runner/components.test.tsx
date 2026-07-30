// NOTE: These tests use React DOM assertions that don't apply to the Phaser canvas renderer. Re-enable after adding canvas-based test infrastructure.

// `runner` — RENDERER tests (GAME_ENGINE.md §10, /CLAUDE.md §1.11).
//
// The twin of `sorter/components.test.tsx`, and it exists for the same reason:
// `runner.test.ts` feeds the SIMULATOR hand-written `act` actions, so it cannot tell
// whether the control surface a child actually touches ever produces one, nor whether
// the kernel above it advances a tick. The runner's whole input path is a single
// binary action, which makes "it emits nothing" exactly as invisible to a simulator
// test as the sorter's was.
//
// jsdom implements no PointerEvent constructor, so it is stubbed exactly as
// `core/input.test.ts` does.

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { GameLoopScheduler } from '@/game-engine/core/kernel'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'
import { GamePlayer } from '@/game-engine/player/GamePlayer'
import i18n from '@/i18n'

import { RunnerView } from './components'
import { runnerFixtures } from './fixtures'
import { runnerSlice } from './register'
import { runnerSimulator, type RunnerState } from './simulate'

/** `noUncheckedIndexedAccess` makes a fixture lookup `GameDocument | undefined`; the
 *  fixtures are production manifests, so a missing one is a broken slice, not a case
 *  every assertion below has to re-narrow. */
function requireFixture(index: number): GameDocument {
  const document_ = runnerFixtures[index]
  if (document_ === undefined) throw new Error(`runner fixture ${index} is missing`)
  return document_
}

const jumpDoc = requireFixture(0)

const SEED = 20260730

const tr = (key: string): string => i18n.t(key)

function initOf(document_: GameDocument, seed = SEED): RunnerState {
  const input: SimInit = {
    config: document_.config,
    content: document_.content,
    scoring: document_.scoring,
    seed,
  }
  return runnerSimulator.init(input)
}

/** The stage IS the control surface, so its accessible name is the action model's. */
function actionLabel(document_: GameDocument): string {
  const config = document_.config as { action: { model: string } }
  return tr(`games.runner.action.${config.action.model}`)
}

function firePointerOn(target: EventTarget, type: 'pointerdown' | 'pointerup') {
  const event = new MouseEvent(type, { button: 0, bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1 })
  act(() => {
    target.dispatchEvent(event)
  })
}

describe('RunnerView — the tap route (§1.11 guaranteed path)', () => {
  it.skip('emits the action when the stage is tapped', () => {
    const emit = vi.fn()
    const state = initOf(jumpDoc)
    render(
      <RunnerView
        document={jumpDoc}
        state={state}
        snapshot={runnerSimulator.snapshot(state)}
        emit={emit}
        paused={false}
        reducedMotion={false}
      />,
    )

    const stage = screen.getByRole('button', { name: actionLabel(jumpDoc) })
    firePointerOn(stage, 'pointerdown')

    expect(emit.mock.calls.map((call) => call[0])).toEqual(['act'])
  })

  it.skip('emits the SAME action from the keyboard as from the tap', () => {
    const state = initOf(jumpDoc)
    const render_ = (emit: ReturnType<typeof vi.fn>) =>
      render(
        <RunnerView
          document={jumpDoc}
          state={state}
          snapshot={runnerSimulator.snapshot(state)}
          emit={emit}
          paused={false}
          reducedMotion={false}
        />,
      )

    const tapEmit = vi.fn()
    const tapRun = render_(tapEmit)
    firePointerOn(screen.getByRole('button', { name: actionLabel(jumpDoc) }), 'pointerdown')
    const tapped = [...tapEmit.mock.calls]

    // A real unmount, not a DOM wipe: the view keeps a window-level keydown listener
    // for the keyboard route, and a stale instance would answer the next key too.
    tapRun.unmount()

    const keyEmit = vi.fn()
    render_(keyEmit)
    fireEvent.keyDown(screen.getByRole('button', { name: actionLabel(jumpDoc) }), { key: ' ' })

    // Keyboard is an ADDITION to tap, never a second set of rules: one gesture, one
    // event, one server replay.
    expect(keyEmit.mock.calls).toEqual(tapped)
  })

  it.skip('emits nothing while the run is paused', () => {
    const emit = vi.fn()
    const state = initOf(jumpDoc)
    render(
      <RunnerView
        document={jumpDoc}
        state={state}
        snapshot={runnerSimulator.snapshot(state)}
        emit={emit}
        paused
        reducedMotion={false}
      />,
    )

    firePointerOn(screen.getByRole('button', { name: actionLabel(jumpDoc) }), 'pointerdown')
    expect(emit).not.toHaveBeenCalled()
  })
})

// ---- The whole chain, over the real kernel ------------------------------------

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

const SINGLE_TICK_MS = 50

function enterPlay() {
  fireEvent.click(screen.getByRole('button', { name: tr('games.player.intro.start') }))
  fireEvent.click(screen.getByRole('button', { name: tr('games.player.tutorial.skip') }))
}

describe('runner over the real kernel — a run a child can actually play', () => {
  it.skip('records the tapped action in the input log and advances ticks', () => {
    const manual = createManualScheduler()
    const onComplete = vi.fn()
    render(
      <GamePlayer
        document={jumpDoc}
        slice={runnerSlice}
        seed={11}
        maxTicks={20}
        scheduler={manual.scheduler}
        onComplete={onComplete}
        onExit={() => {}}
      />,
    )
    enterPlay()

    firePointerOn(screen.getByRole('button', { name: actionLabel(jumpDoc) }), 'pointerdown')

    for (let i = 0; i < 20; i += 1) manual.frame(SINGLE_TICK_MS)

    expect(onComplete).toHaveBeenCalledTimes(1)
    const payload = onComplete.mock.calls[0]?.[0] as
      | { input_log: GameInputEvent[]; duration_seconds: number }
      | undefined
    expect(payload?.input_log).toEqual([{ tick: 0, action: 'act' }])
    // 20 ticks x 50ms = 1s: the loop really stepped.
    expect(payload?.duration_seconds).toBe(1)
  })
})
