// GameEngineBridge — unit tests. GAME_ENGINE.md §5 (determinism & replay), §9
// (tick ceiling).
//
// WHY THIS FILE EXISTS. `bridge.ts` is 162+ lines of pure TypeScript — no Phaser, no
// DOM, only `core/types` and one `core/kernel` constant — and it is the exact code
// that decides which tick every child's input gets stamped with, i.e. the input the
// server later replays to derive XP. It had zero tests despite that. Nothing here
// needs a mechanic, a scene or a browser: a tiny toy `Simulator`, declared below in
// the same house style as `core/replay.test.ts`, is enough to exercise the bridge in
// complete isolation from any real mechanic.

import { describe, expect, it } from 'vitest'

import { MAX_CATCH_UP_TICKS } from '@/game-engine/core/kernel'
import { TICK_MS } from '@/game-engine/core/types'
import type { GameInputEvent, SimInit, SimResult, SimSnapshot, Simulator } from '@/game-engine/core/types'

import { GameEngineBridge } from './bridge'

// ---- A toy mechanic ------------------------------------------------------------
// `tap` advances a counter by one; `nudge` is declared but never moves the counter,
// so a test can prove a KNOWN-but-inert action is still accepted (queued) while an
// UNDECLARED action is rejected outright. `round` increments once per `step()` call
// regardless of events, i.e. once per tick — the toy's own proof that a value read
// off `finishPayload` came from the simulator's state and not from an invented
// stand-in (round only equals tick count if it was actually derived, tick by tick).
// The toy never sets `finished` from the target reaching some magic number in most
// tests (`target` is set absurdly high) so that `isDone()` is driven by `maxTicks`
// alone where a test wants that — and set low where a test wants natural completion.

interface ToyState {
  readonly tapCount: number
  readonly round: number
  readonly target: number
  readonly finished: boolean
}

function toySimulator(target: number): Simulator<ToyState> {
  return {
    mechanic: 'sorter',
    actions: ['tap', 'nudge'],

    init(): ToyState {
      return { tapCount: 0, round: 0, target, finished: false }
    },

    step(state: ToyState, _tick: number, events: readonly GameInputEvent[]): ToyState {
      let tapCount = state.tapCount
      for (const event of events) {
        if (event.action === 'tap') tapCount += 1
      }
      const round = state.round + 1
      return { ...state, tapCount, round, finished: tapCount >= state.target }
    },

    snapshot(state: ToyState): SimSnapshot {
      return { finished: state.finished, score: state.tapCount, lives: null, round: state.round }
    },

    result(state: ToyState): SimResult {
      return {
        score: state.tapCount,
        finished: state.finished,
        stats: { tapCount: state.tapCount, round: state.round },
      }
    },
  }
}

const TOY_INIT: SimInit = {
  config: {},
  content: {
    items: [{ id: 'i1', label_md: 'one' }],
    feedback: { correct_md: ['ok'], incorrect_md: ['casi'], results_md: 'fin' },
  },
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null },
  seed: 4242,
}

/** A target no test drives the counter anywhere near, so `finished` never fires on
 *  its own — the tests that want `isDone()` to come from `maxTicks` alone use this. */
const NEVER_FINISHES = 1_000_000

function makeBridge(maxTicks: number, target = NEVER_FINISHES): GameEngineBridge<ToyState> {
  return new GameEngineBridge(toySimulator(target), TOY_INIT, maxTicks)
}

// ---- enqueue() — the declared-actions gate --------------------------------------

describe('GameEngineBridge — enqueue() action gate', () => {
  it('accepts an action the simulator declares', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'tap' }])
  })

  it('rejects an action the simulator does not declare', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('teleport')
    expect(bridge.inputLog).toEqual([])
  })

  it('a rejected action never reaches step(), so it never affects state', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('teleport')
    bridge.update(TICK_MS)
    expect(bridge.state.tapCount).toBe(0)
  })

  it('a declared-but-inert action (nudge) is still queued and stamped, even though the toy ignores it', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('nudge')
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'nudge' }])
  })
})

// ---- enqueue() — running/paused/done gate ---------------------------------------

describe('GameEngineBridge — enqueue() lifecycle gate', () => {
  it('rejects everything before start()', () => {
    const bridge = makeBridge(100)
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([])
  })

  it('rejects everything after stop()', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.stop()
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([])
  })

  it('rejects everything while paused', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.pause()
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([])
  })

  it('accepts again after resume()', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.pause()
    bridge.resume()
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'tap' }])
  })

  it('rejects once the simulator itself has finished', () => {
    // target 1: the very first ticked tap finishes the toy.
    const bridge = makeBridge(100, 1)
    bridge.start()
    bridge.enqueue('tap')
    bridge.update(TICK_MS)
    expect(bridge.finished).toBe(true)

    bridge.enqueue('tap')
    // The log still holds only the ONE tap that actually ran before completion.
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'tap' }])
  })

  it('rejects once maxTicks has been reached', () => {
    const bridge = makeBridge(2)
    bridge.start()
    bridge.update(2 * TICK_MS) // ticks 0 and 1 run; tick becomes 2 === maxTicks.
    expect(bridge.tick).toBe(2)

    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([])
  })

  it('stamps each accepted event with the CURRENT tick at the moment it was queued', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap') // tick 0
    bridge.update(TICK_MS) // advances to tick 1
    bridge.enqueue('tap') // tick 1
    bridge.update(2 * TICK_MS) // advances to tick 3
    bridge.enqueue('tap') // tick 3

    expect(bridge.inputLog).toEqual([
      { tick: 0, action: 'tap' },
      { tick: 1, action: 'tap' },
      { tick: 3, action: 'tap' },
    ])
  })
})

// ---- enqueue() — payload handling ------------------------------------------------

describe('GameEngineBridge — enqueue() payload', () => {
  it('carries finite slot/x/y/n through untouched', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap', { slot: 'bin-1', x: 12, y: -3.5, n: 0 })
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'tap', slot: 'bin-1', x: 12, y: -3.5, n: 0 }])
  })

  it('silently drops non-finite numeric fields rather than rejecting the whole event', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap', { x: Number.NaN, y: Number.POSITIVE_INFINITY, n: 4 })
    // The event itself is still queued (only the bad fields are stripped) — this is
    // the client-side bridge's own contract, distinct from replayGame()'s stricter
    // server-side rule of rejecting the entire log on a non-finite field.
    expect(bridge.inputLog).toEqual([{ tick: 0, action: 'tap', n: 4 }])
  })

  it('omits payload fields entirely when no payload is given', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap')
    expect(bridge.inputLog[0]).toEqual({ tick: 0, action: 'tap' })
  })
})

// ---- update() — the fixed-tick accumulator ---------------------------------------

describe('GameEngineBridge — update() accumulator', () => {
  it('advances zero ticks for a delta under one TICK_MS', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(TICK_MS - 1)
    expect(bridge.tick).toBe(0)
  })

  it('advances exactly one tick for a delta of exactly one TICK_MS', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(TICK_MS)
    expect(bridge.tick).toBe(1)
  })

  it('advances the correct whole-tick count for a delta spanning several ticks', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(3 * TICK_MS)
    expect(bridge.tick).toBe(3)
  })

  it('carries a sub-tick remainder into the NEXT update() call instead of dropping it', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(70) // 1 tick (50ms), 20ms left over in the accumulator.
    expect(bridge.tick).toBe(1)
    bridge.update(30) // 20 + 30 = 50ms — exactly one more tick.
    expect(bridge.tick).toBe(2)
  })

  it('does not tick again on a call carrying an unconsumed remainder alone', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(70) // 1 tick, 20ms remainder.
    bridge.update(10) // 20 + 10 = 30ms — still under one tick.
    expect(bridge.tick).toBe(1)
  })

  it('treats a zero or negative delta as zero elapsed time', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(0)
    bridge.update(-50)
    expect(bridge.tick).toBe(0)
  })

  it('exposes tickAlpha as the accumulator fraction of one tick', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(70) // 1 tick, 20ms remainder -> alpha 20/50.
    expect(bridge.alpha).toBeCloseTo(20 / 50, 10)
  })
})

// ---- update() — the MAX_CATCH_UP_TICKS clamp -------------------------------------

describe('GameEngineBridge — MAX_CATCH_UP_TICKS clamp', () => {
  it('never advances more than MAX_CATCH_UP_TICKS ticks in a single update() call, however large the delta', () => {
    const bridge = makeBridge(1000)
    bridge.start()
    // A wildly large delta — a stalled tab, a debugger breakpoint — must not replay
    // hundreds of ticks synchronously in one frame.
    bridge.update(10_000)
    expect(bridge.tick).toBe(MAX_CATCH_UP_TICKS)
  })

  it('the leftover time beyond the clamp is DISCARDED, not banked for the next frame', () => {
    const bridge = makeBridge(1000)
    bridge.start()
    bridge.update(10_000) // clamped to MAX_CATCH_UP_TICKS * TICK_MS before entering the accumulator.
    expect(bridge.tick).toBe(MAX_CATCH_UP_TICKS)
    // A following ordinary frame only ticks once, proving nothing overflowed forward.
    bridge.update(TICK_MS)
    expect(bridge.tick).toBe(MAX_CATCH_UP_TICKS + 1)
  })

  it('a stall recovers over several ordinary frames rather than fast-forwarding', () => {
    const bridge = makeBridge(1000)
    bridge.start()
    bridge.update(10_000)
    expect(bridge.tick).toBe(MAX_CATCH_UP_TICKS)
    bridge.update(10_000)
    expect(bridge.tick).toBe(2 * MAX_CATCH_UP_TICKS)
  })
})

// ---- maxTicks enforcement ---------------------------------------------------------

describe('GameEngineBridge — maxTicks enforcement (commit 695891c)', () => {
  it('stops the bridge exactly at the tick ceiling', () => {
    const bridge = makeBridge(3)
    bridge.start()
    bridge.update(5 * TICK_MS)
    expect(bridge.tick).toBe(3)
    expect(bridge.running).toBe(false)
  })

  it('a run that reaches the ceiling mid-loop stops taking input the SAME frame, not one frame late', () => {
    // maxTicks=3 with a single update() large enough to have crossed it mid-loop
    // (were the guard only checked at entry) proves the in-loop re-check matters.
    const bridge = makeBridge(3)
    bridge.start()
    // A clamped single frame has headroom for 5 ticks (MAX_CATCH_UP_TICKS) but the
    // ceiling is 3 — the in-loop re-check must stop it at 3, not let the clamp run it
    // all the way to 5 before the outer guard notices.
    bridge.update(5 * TICK_MS)
    expect(bridge.tick).toBe(3)
    bridge.enqueue('tap')
    expect(bridge.inputLog).toEqual([])
  })

  it('further update() calls after the ceiling are no-ops', () => {
    const bridge = makeBridge(3)
    bridge.start()
    bridge.update(3 * TICK_MS)
    expect(bridge.tick).toBe(3)
    bridge.update(3 * TICK_MS)
    expect(bridge.tick).toBe(3)
  })

  it('an invalid maxTicks (<=0 or non-finite) is treated as "no ceiling" rather than "already done"', () => {
    for (const maxTicks of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const bridge = makeBridge(maxTicks)
      bridge.start()
      bridge.update(2 * TICK_MS)
      expect(bridge.tick).toBe(2)
      expect(bridge.running).toBe(true)
    }
  })

  it('a fractional maxTicks is floored', () => {
    const bridge = makeBridge(2.9)
    bridge.start()
    bridge.update(5 * TICK_MS)
    expect(bridge.tick).toBe(2)
  })
})

// ---- finishPayload — real data, never hardcoded -----------------------------------

describe('GameEngineBridge — finishPayload', () => {
  it('reflects the real ticks/round/result reached so far even mid-run (not just at completion)', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap')
    bridge.update(3 * TICK_MS)

    const payload = bridge.finishPayload
    expect(payload.ticks).toBe(3)
    expect(payload.round).toBe(3) // the toy increments round once per step().
    expect(payload.result).toEqual(bridge.result)
    expect(payload.result.score).toBe(1) // exactly the one tap that was actually queued.
  })

  it('reflects the state at natural completion (finished via the simulator, not maxTicks)', () => {
    const bridge = makeBridge(100, 2) // finishes once 2 taps have landed.
    bridge.start()
    bridge.enqueue('tap')
    bridge.update(TICK_MS)
    bridge.enqueue('tap')
    bridge.update(TICK_MS)

    expect(bridge.finished).toBe(true)
    const payload = bridge.finishPayload
    expect(payload.ticks).toBe(2)
    expect(payload.round).toBe(2)
    expect(payload.result.finished).toBe(true)
    expect(payload.result.score).toBe(2)
  })

  it('reflects the state at ceiling completion (finished via maxTicks, simulator never set finished)', () => {
    const bridge = makeBridge(4) // NEVER_FINISHES target — only the ceiling ends this run.
    bridge.start()
    bridge.update(10 * TICK_MS) // far more than the ceiling; clamp + ceiling both apply.

    expect(bridge.tick).toBe(4)
    const payload = bridge.finishPayload
    expect(payload.ticks).toBe(4)
    expect(payload.round).toBe(4)
    // The SIMULATOR's own `finished` is still false — the ceiling ended the SESSION,
    // not the simulation's own win condition — and finishPayload must report that
    // honestly rather than lying that the simulator finished.
    expect(payload.result.finished).toBe(false)
  })

  it('always matches inputLog exactly (the log the server will replay)', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.enqueue('tap')
    bridge.update(TICK_MS)
    bridge.enqueue('tap')
    bridge.update(TICK_MS)

    expect(bridge.finishPayload.inputLog).toEqual(bridge.inputLog)
    expect(bridge.finishPayload.inputLog).toEqual([
      { tick: 0, action: 'tap' },
      { tick: 1, action: 'tap' },
    ])
  })
})

// ---- pause()/resume() semantics ----------------------------------------------------

describe('GameEngineBridge — pause()/resume()', () => {
  it('freezes the tick count while paused, however much time update() is fed', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(TICK_MS)
    expect(bridge.tick).toBe(1)

    bridge.pause()
    bridge.update(10 * TICK_MS)
    expect(bridge.tick).toBe(1)
    expect(bridge.paused).toBe(true)
  })

  it('resets the accumulator on pause, so a resumed run does not "owe" the pre-pause remainder', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(70) // 1 tick, 20ms remainder banked in the accumulator.
    expect(bridge.tick).toBe(1)

    bridge.pause()
    bridge.resume()
    // Were the 20ms remainder still banked, 20 + 30 = 50ms would tick again here.
    // It must NOT, because pause() clears the accumulator.
    bridge.update(30)
    expect(bridge.tick).toBe(1)

    // The remaining 20ms to complete a full tick from a clean zero.
    bridge.update(20)
    expect(bridge.tick).toBe(2)
  })

  it('resumes ticking normally after resume()', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.pause()
    bridge.resume()
    expect(bridge.paused).toBe(false)
    bridge.update(TICK_MS)
    expect(bridge.tick).toBe(1)
  })

  it('pause()/resume() before start() (or after stop()) are no-ops', () => {
    const bridge = makeBridge(100)
    bridge.pause()
    expect(bridge.paused).toBe(false)
    bridge.resume()
    expect(bridge.paused).toBe(false)

    bridge.start()
    bridge.stop()
    bridge.pause()
    expect(bridge.paused).toBe(false)
  })

  it('start() after stop() re-arms the bridge from a clean accumulator', () => {
    const bridge = makeBridge(100)
    bridge.start()
    bridge.update(70) // 1 tick, 20ms remainder.
    bridge.stop()
    bridge.start() // start() resets the accumulator exactly like pause() does.
    bridge.update(30)
    expect(bridge.tick).toBe(1)
  })
})
