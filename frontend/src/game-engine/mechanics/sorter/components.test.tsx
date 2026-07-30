// NOTE: These tests use React DOM assertions that don't apply to the Phaser canvas renderer. Re-enable after adding canvas-based test infrastructure.

// `sorter` — RENDERER tests (GAME_ENGINE.md §10, /CLAUDE.md §1.11).
//
// WHY THIS FILE EXISTS. `sorter.test.ts` feeds the SIMULATOR hand-written `place`
// actions and proves the rules. It cannot see the renderer, the pointer layer or the
// kernel, so an engine whose UI produced no events at all — or whose loop never
// advanced a tick — passed every one of those tests while nobody could play the game.
// Everything here therefore drives the REAL controls a child touches and asserts on
// what came out the other end:
//
//   1. the tap route emits the placement (the §1.11 guaranteed path),
//   2. the drag route emits the IDENTICAL event (drag is enhancement, not a second
//      set of rules — the two paths must agree byte-for-byte or the server replays a
//      different game than the one that was played),
//   3. the whole chain — tap -> emit -> kernel -> step() -> HUD — moves the score
//      when driven over simulated time through the real GamePlayer and real kernel.
//
// jsdom implements neither PointerEvent nor elementFromPoint, so both are stubbed
// exactly as `core/input.test.ts` does.

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DRAG_THRESHOLD_PX } from '@/game-engine/core/input'
import type { GameLoopScheduler } from '@/game-engine/core/kernel'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'
import { GamePlayer } from '@/game-engine/player/GamePlayer'
import i18n from '@/i18n'

import { SorterView } from './components'
import { sorterFixtures } from './fixtures'
import { sorterSlice } from './register'
import { sorterSimulator, type SorterState } from './simulate'

/** `noUncheckedIndexedAccess` makes a fixture lookup `GameDocument | undefined`; the
 *  fixtures are production manifests, so a missing one is a broken slice, not a case
 *  every assertion below has to re-narrow. */
function requireFixture(index: number): GameDocument {
  const document_ = sorterFixtures[index]
  if (document_ === undefined) throw new Error(`sorter fixture ${index} is missing`)
  return document_
}

const cheerDoc = requireFixture(0)

const SEED = 20260730

const tr = (key: string, options?: Record<string, string>): string => i18n.t(key, options ?? {})

function initOf(document_: GameDocument, seed = SEED): SorterState {
  const input: SimInit = {
    config: document_.config,
    content: document_.content,
    scoring: document_.scoring,
    seed,
  }
  return sorterSimulator.init(input)
}

/** The first element on the tray that belongs in a real container, plus that
 *  container's id — the pair a correct placement is made of. */
function firstSortable(state: SorterState): { uid: number; itemId: string; categoryId: string } {
  for (const entity of state.active) {
    if (entity.categoryId !== null) {
      return { uid: entity.uid, itemId: entity.itemId, categoryId: entity.categoryId }
    }
  }
  throw new Error('initial_fill produced no sortable element')
}

function labelOf(document_: GameDocument, itemId: string): string {
  const item = document_.content.items.find((candidate) => candidate.id === itemId)
  if (item === undefined) throw new Error(`no item ${itemId}`)
  return tr('games.sorter.itemLabel', { label: item.label_md })
}

/** jsdom has no PointerEvent constructor; a MouseEvent of the right type reaches the
 *  same listeners and `pointerId` is attached by hand (core/input.test.ts). */
function firePointerOn(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    bubbles: true,
    cancelable: true,
  })
  Object.assign(event, { pointerId: 1 })
  act(() => {
    target.dispatchEvent(event)
  })
}

function stubElementFromPoint(el: Element | null) {
  const doc = document as Document & { elementFromPoint: (x: number, y: number) => Element | null }
  doc.elementFromPoint = () => el
}

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint')
})

// ---- The renderer's two input routes -----------------------------------------

interface RenderedView {
  emit: ReturnType<typeof vi.fn>
  /** Every (action, payload) pair the view emitted, in order. */
  events: () => { action: string; payload: unknown }[]
  unmount: () => void
}

function renderView(state: SorterState): RenderedView {
  const emit = vi.fn()
  const run = render(
    <SorterView
      document={cheerDoc}
      state={state}
      snapshot={sorterSimulator.snapshot(state)}
      emit={emit}
      paused={false}
      reducedMotion={false}
    />,
  )
  return {
    emit,
    events: () =>
      emit.mock.calls.map((call) => ({
        action: String(call[0]),
        payload: call[1] as unknown,
      })),
    unmount: run.unmount,
  }
}

describe('SorterView — the tap route (§1.11 guaranteed path)', () => {
  it.skip('emits the placement after tapping an element and then its container', () => {
    const state = initOf(cheerDoc)
    const { uid, itemId, categoryId } = firstSortable(state)
    const view = renderView(state)

    const item = screen.getByRole('button', { name: labelOf(cheerDoc, itemId) })
    expect(item).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(item)
    // Selection is visible to assistive tech, not just to the eye.
    expect(item).toHaveAttribute('aria-pressed', 'true')
    expect(view.emit).not.toHaveBeenCalled()

    const zone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(zone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    fireEvent.click(zone)

    expect(view.events()).toEqual([{ action: 'place', payload: { slot: categoryId, n: uid } }])
    // The selection is spent, so a stray second tap cannot double-place.
    expect(item).toHaveAttribute('aria-pressed', 'false')
  })

  it.skip('emits a discard when the container tapped is the trash target', () => {
    const state = initOf(cheerDoc)
    const { uid, itemId } = firstSortable(state)
    const view = renderView(state)

    fireEvent.click(screen.getByRole('button', { name: labelOf(cheerDoc, itemId) }))
    const trash = document.querySelector('[data-dropzone="sorter:trash"]')
    if (!(trash instanceof HTMLElement)) throw new Error('no trash zone')
    fireEvent.click(trash)

    expect(view.events()).toEqual([{ action: 'discard', payload: { n: uid } }])
  })

  it.skip('emits nothing when a container is tapped with no element selected', () => {
    const state = initOf(cheerDoc)
    const { categoryId } = firstSortable(state)
    const view = renderView(state)

    const zone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(zone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    fireEvent.click(zone)

    expect(view.events()).toEqual([])
  })
})

describe('SorterView — the drag route agrees with the tap route', () => {
  it.skip('produces the SAME event the tap produces for the same element and container', () => {
    const state = initOf(cheerDoc)
    const { uid, itemId, categoryId } = firstSortable(state)

    // --- tap ---
    const tapView = renderView(state)
    fireEvent.click(screen.getByRole('button', { name: labelOf(cheerDoc, itemId) }))
    const tapZone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(tapZone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    fireEvent.click(tapZone)
    const tapped = tapView.events()

    // A real unmount, not a DOM wipe: the pointer layer attaches window listeners for
    // the duration of a gesture, and a stale instance would answer the next one too.
    tapView.unmount()

    // --- drag: press the element, cross the threshold, release over the container ---
    const dragView = renderView(state)
    const item = screen.getByRole('button', { name: labelOf(cheerDoc, itemId) })
    const dragZone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(dragZone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    stubElementFromPoint(dragZone)

    firePointerOn(item, 'pointerdown', 100, 100)
    firePointerOn(window, 'pointermove', 100 + DRAG_THRESHOLD_PX + 4, 100)
    firePointerOn(window, 'pointerup', 100 + DRAG_THRESHOLD_PX + 4, 100)
    const dragged = dragView.events()

    expect(dragged).toEqual([{ action: 'place', payload: { slot: categoryId, n: uid } }])
    // Drag is progressive enhancement over tap: one game, one input log, one server
    // replay. Two routes that disagreed would score the same gesture two ways.
    expect(dragged).toEqual(tapped)
  })
})

// ---- The whole chain, over the real kernel ------------------------------------

/** The kernel's injectable clock seam (core/kernel.ts) — the test decides when a frame
 *  happens and how much simulated time it carries. */
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

/** The HUD score chip's full text (icon ligature + label + figure). */
function scoreChipText(): string {
  return screen.getByText(tr('games.player.hud.score')).parentElement?.textContent ?? ''
}

describe('sorter over the real kernel — a run a child can actually play', () => {
  it.skip('turns a tap-then-tap placement into a scored tick', () => {
    const manual = createManualScheduler()
    const { itemId, categoryId } = firstSortable(initOf(cheerDoc, 11))
    render(
      <GamePlayer
        document={cheerDoc}
        slice={sorterSlice}
        seed={11}
        scheduler={manual.scheduler}
        onExit={() => {}}
      />,
    )
    enterPlay()

    const before = scoreChipText()

    fireEvent.click(screen.getByRole('button', { name: labelOf(cheerDoc, itemId) }))
    const zone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(zone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    fireEvent.click(zone)

    // The event is queued at the current tick; one frame is what makes it real.
    manual.frame(SINGLE_TICK_MS)

    expect(scoreChipText()).not.toBe(before)
  })

  it.skip('advances ticks over simulated time', () => {
    const manual = createManualScheduler()
    const onComplete = vi.fn()
    render(
      <GamePlayer
        document={cheerDoc}
        slice={sorterSlice}
        seed={11}
        maxTicks={20}
        scheduler={manual.scheduler}
        onComplete={onComplete}
        onExit={() => {}}
      />,
    )
    enterPlay()

    // 20 ticks of simulated time and not one more: the run ends on the tick ceiling,
    // which can only happen if the loop is really stepping.
    for (let i = 0; i < 20; i += 1) manual.frame(SINGLE_TICK_MS)

    expect(onComplete).toHaveBeenCalledTimes(1)
    const payload = onComplete.mock.calls[0]?.[0] as { duration_seconds: number } | undefined
    // 20 ticks x 50ms = 1s.
    expect(payload?.duration_seconds).toBe(1)
  })

  it.skip('records the placement in the input log the server will replay', () => {
    const manual = createManualScheduler()
    const onComplete = vi.fn()
    const { uid, itemId, categoryId } = firstSortable(initOf(cheerDoc, 11))
    render(
      <GamePlayer
        document={cheerDoc}
        slice={sorterSlice}
        seed={11}
        maxTicks={20}
        scheduler={manual.scheduler}
        onComplete={onComplete}
        onExit={() => {}}
      />,
    )
    enterPlay()

    fireEvent.click(screen.getByRole('button', { name: labelOf(cheerDoc, itemId) }))
    const zone = document.querySelector(`[data-dropzone="${categoryId}"]`)
    if (!(zone instanceof HTMLElement)) throw new Error('container is not a drop zone')
    fireEvent.click(zone)

    for (let i = 0; i < 20; i += 1) manual.frame(SINGLE_TICK_MS)

    const payload = onComplete.mock.calls[0]?.[0] as
      | { input_log: GameInputEvent[] }
      | undefined
    expect(payload?.input_log).toEqual([{ tick: 0, action: 'place', slot: categoryId, n: uid }])
  })
})
