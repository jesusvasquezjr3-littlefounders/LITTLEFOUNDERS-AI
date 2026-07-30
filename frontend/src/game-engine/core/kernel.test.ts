// Kernel tests — the whole point of the injectable scheduler seam.
//
// Not one of these tests reads a real clock or a real rAF: `createManualScheduler`
// supplies `now()` and the frame queue, so "advance 1000ms" is an exact statement
// about the simulation and never a timing race. The kernel is the time base the
// server's replay agrees with, so its arithmetic gets asserted, not eyeballed.

import { act, renderHook } from '@testing-library/react'

import {
  MAX_CATCH_UP_TICKS,
  MAX_FRAME_DELTA_MS,
  createGameLoop,
  useGameLoop,
  type GameLoopEventSource,
  type GameLoopScheduler,
} from '@/game-engine/core/kernel'
import { TICK_MS, type GameInputEvent, type SimInit, type Simulator } from '@/game-engine/core/types'

// ---- Doubles -----------------------------------------------------------------

interface ManualScheduler {
  scheduler: GameLoopScheduler
  /** Advance simulated time by `ms` and run every frame that was pending. */
  frame(ms: number): void
  /** Advance `totalMs` as a sequence of `stepMs` frames — a realistic rAF cadence. */
  advance(totalMs: number, stepMs?: number): void
  pendingFrames(): number
}

function createManualScheduler(): ManualScheduler {
  let now = 0
  let nextHandle = 1
  const frames = new Map<number, () => void>()

  const scheduler: GameLoopScheduler = {
    now: () => now,
    request: (callback) => {
      const handle = nextHandle
      nextHandle += 1
      frames.set(handle, callback)
      return handle
    },
    cancel: (handle) => {
      frames.delete(handle)
    },
  }

  function frame(ms: number): void {
    now += ms
    const due = [...frames.values()]
    frames.clear()
    for (const callback of due) callback()
  }

  function advance(totalMs: number, stepMs = 10): void {
    let remaining = totalMs
    while (remaining > 0) {
      const chunk = Math.min(stepMs, remaining)
      frame(chunk)
      remaining -= chunk
    }
  }

  return { scheduler, frame, advance, pendingFrames: () => frames.size }
}

interface FakeEventSource {
  target: GameLoopEventSource
  fire(type: string): void
  listenerCount(type: string): number
}

function createFakeEventSource(): FakeEventSource {
  const listeners = new Map<string, Set<() => void>>()
  const target: GameLoopEventSource = {
    addEventListener: (type, listener) => {
      const set = listeners.get(type) ?? new Set<() => void>()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener)
    },
  }
  return {
    target,
    fire: (type) => {
      for (const listener of [...(listeners.get(type) ?? [])]) listener()
    },
    listenerCount: (type) => listeners.get(type)?.size ?? 0,
  }
}

// A minimal simulator obeying the §5 purity rules: it counts ticks and records the
// event batch it was handed, which is exactly what the kernel's contract is about.
interface CounterState {
  ticks: number
  received: GameInputEvent[]
  finishAt: number | null
}

function makeSimulator(finishAt: number | null = null): Simulator<CounterState> {
  return {
    mechanic: 'sorter',
    actions: ['tap', 'drop'],
    init: (_input: SimInit): CounterState => ({ ticks: 0, received: [], finishAt }),
    step: (state, _tick, events) => ({
      ticks: state.ticks + 1,
      received: [...state.received, ...events],
      finishAt: state.finishAt,
    }),
    snapshot: (state) => ({
      finished: state.finishAt !== null && state.ticks >= state.finishAt,
      score: state.received.length,
      lives: null,
      round: 0,
    }),
    result: (state) => ({
      score: state.received.length,
      finished: state.finishAt !== null && state.ticks >= state.finishAt,
      stats: { ticks: state.ticks },
    }),
    bots: { perfect: () => [], random: () => [] },
  }
}

function initialCounterState(finishAt: number | null = null): CounterState {
  return { ticks: 0, received: [], finishAt }
}

// ---- Tick arithmetic ---------------------------------------------------------

describe('createGameLoop — fixed tick advancement', () => {
  it('advances exactly floor(elapsed / TICK_MS) ticks', () => {
    for (const elapsed of [0, 49, 50, 99, 100, 250, 999, 1000]) {
      const manual = createManualScheduler()
      const loop = createGameLoop({
        simulator: makeSimulator(),
        initialState: initialCounterState(),
        maxTicks: 10_000,
        scheduler: manual.scheduler,
        autoPause: [],
      })
      loop.start()
      manual.advance(elapsed)

      expect(loop.getTick()).toBe(Math.floor(elapsed / TICK_MS))
      expect(loop.getState().ticks).toBe(Math.floor(elapsed / TICK_MS))
      loop.stop()
    }
  })

  it('never advances a partial tick — 49ms is zero ticks, 50ms is one', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 100,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    manual.frame(49)
    expect(loop.getTick()).toBe(0)
    manual.frame(1)
    expect(loop.getTick()).toBe(1)

    loop.stop()
  })

  it('emits a snapshot on start and only on frames that advanced a tick', () => {
    const manual = createManualScheduler()
    const snapshots: number[] = []
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 100,
      scheduler: manual.scheduler,
      autoPause: [],
      onSnapshot: (_snapshot, _state, tick) => snapshots.push(tick),
    })

    loop.start()
    expect(snapshots).toEqual([0])

    manual.frame(10) // no tick owed -> no render seam
    expect(snapshots).toEqual([0])

    manual.frame(40) // crosses 50ms -> exactly one tick
    expect(snapshots).toEqual([0, 1])

    loop.stop()
  })
})

// ---- The catch-up clamp ------------------------------------------------------

describe('createGameLoop — catch-up clamp', () => {
  it('bounds a monstrous frame delta to MAX_CATCH_UP_TICKS', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    // Five simulated minutes in one frame (a restored background tab).
    manual.frame(300_000)

    expect(loop.getTick()).toBe(MAX_CATCH_UP_TICKS)
    expect(MAX_FRAME_DELTA_MS).toBe(MAX_CATCH_UP_TICKS * TICK_MS)

    loop.stop()
  })

  it('drops the clamped surplus instead of owing it to later frames', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    manual.frame(5_000)
    expect(loop.getTick()).toBe(MAX_CATCH_UP_TICKS)

    // The next quiet second runs at normal speed: the stall does not repay itself.
    manual.advance(1_000)
    expect(loop.getTick()).toBe(MAX_CATCH_UP_TICKS + 20)

    loop.stop()
  })

  it('treats a non-monotonic (backwards) clock as zero elapsed time', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 100,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    manual.frame(-500)
    expect(loop.getTick()).toBe(0)

    loop.stop()
  })
})

// ---- Pause / resume ----------------------------------------------------------

describe('createGameLoop — pause and resume', () => {
  it('halts advancement while paused and does not fast-forward on resume', () => {
    const manual = createManualScheduler()
    const pauseFlags: boolean[] = []
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
      onPauseChange: (paused) => pauseFlags.push(paused),
    })
    loop.start()

    manual.advance(100)
    expect(loop.getTick()).toBe(2)

    loop.pause()
    expect(loop.isPaused()).toBe(true)
    expect(manual.pendingFrames()).toBe(0)

    manual.advance(1_000)
    expect(loop.getTick()).toBe(2)

    loop.resume()
    expect(loop.isPaused()).toBe(false)

    // A whole second elapsed while paused; resuming owes NONE of it.
    manual.advance(40)
    expect(loop.getTick()).toBe(2)
    manual.advance(10)
    expect(loop.getTick()).toBe(3)

    expect(pauseFlags).toEqual([true, false])
    loop.stop()
  })

  it('auto-pauses when a registered source reports it should', () => {
    const manual = createManualScheduler()
    const source = createFakeEventSource()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [{ target: source.target, type: 'blur', shouldPause: () => true }],
    })
    loop.start()

    manual.advance(100)
    source.fire('blur')

    expect(loop.isPaused()).toBe(true)
    manual.advance(1_000)
    expect(loop.getTick()).toBe(2)

    loop.stop()
  })

  // THE REGRESSION THAT SHIPPED. In production the only frame source is
  // requestAnimationFrame, and a hidden tab fires none. Auto-pause is EDGE-triggered,
  // so a run launched in a background tab sees no `visibilitychange` and no `blur` —
  // nothing changed — and the loop reported `running: true, paused: false` while zero
  // ticks were physically possible: a board that looks live, taps piling up on tick 0
  // and no pause overlay to recover from.
  it('starts PAUSED when the frame source cannot deliver a frame', () => {
    const manual = createManualScheduler()
    let deliverable = false
    const pauseFlags: boolean[] = []
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: { ...manual.scheduler, canDeliverFrames: () => deliverable },
      onPauseChange: (paused) => pauseFlags.push(paused),
      autoPause: [],
    })
    loop.start()

    expect(loop.isRunning()).toBe(true)
    expect(loop.isPaused()).toBe(true)
    // Nothing pending: a paused loop must never claim a frame is about to arrive.
    expect(manual.pendingFrames()).toBe(0)
    expect(pauseFlags).toEqual([true])

    // It stays put, so "unpaused" is never a lie about a frozen simulation.
    manual.advance(10_000)
    expect(loop.getTick()).toBe(0)

    // The player's own resume is the documented way out, and it works once the frame
    // source can deliver again.
    deliverable = true
    loop.resume()
    manual.advance(100)
    expect(loop.getTick()).toBe(2)

    loop.stop()
  })

  // The binding between "hidden" and "no frames" lives in the DEFAULT scheduler, so it
  // is asserted against the default rather than a double. jsdom's rAF does fire, which
  // is precisely why this must be a declared capability and not something the loop
  // infers from watching frames arrive.
  it('the default rAF scheduler refuses to start a run in a hidden document', () => {
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    try {
      const loop = createGameLoop({
        simulator: makeSimulator(),
        initialState: initialCounterState(),
        maxTicks: 10_000,
        autoPause: [],
      })
      loop.start()

      expect(loop.isRunning()).toBe(true)
      expect(loop.isPaused()).toBe(true)
      expect(loop.getTick()).toBe(0)
      loop.stop()
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
      if (visibility !== undefined) {
        Object.defineProperty(Document.prototype, 'visibilityState', visibility)
      }
    }
  })

  it('starts normally when the frame source reports it can deliver', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: { ...manual.scheduler, canDeliverFrames: () => true },
      autoPause: [],
    })
    loop.start()

    expect(loop.isPaused()).toBe(false)
    manual.advance(100)
    expect(loop.getTick()).toBe(2)

    loop.stop()
  })

  it('ignores a source event whose shouldPause() is false', () => {
    const manual = createManualScheduler()
    const source = createFakeEventSource()
    let hidden = false
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [{ target: source.target, type: 'visibilitychange', shouldPause: () => hidden }],
    })
    loop.start()

    source.fire('visibilitychange')
    expect(loop.isPaused()).toBe(false)

    hidden = true
    source.fire('visibilitychange')
    expect(loop.isPaused()).toBe(true)

    loop.stop()
  })
})

// ---- The input log -----------------------------------------------------------

describe('createGameLoop — input log', () => {
  it('stamps every enqueued action with the current tick and delivers it there', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    loop.enqueue('tap', { slot: 'bin-a' })
    manual.advance(120)
    expect(loop.getTick()).toBe(2)

    loop.enqueue('drop', { x: 4, y: 7 })
    manual.advance(50)

    expect(loop.getInputLog()).toEqual([
      { tick: 0, action: 'tap', slot: 'bin-a' },
      { tick: 2, action: 'drop', x: 4, y: 7 },
    ])
    // The batch reached step() at exactly the tick it was stamped with.
    expect(loop.getState().received).toEqual(loop.getInputLog())

    loop.stop()
  })

  it('hands step() the FULL batch of a tick in one call (batched removals)', () => {
    const manual = createManualScheduler()
    const batches: number[] = []
    const simulator = makeSimulator()
    const loop = createGameLoop({
      simulator: {
        ...simulator,
        step: (state, tick, events) => {
          batches.push(events.length)
          return simulator.step(state, tick, events)
        },
      },
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    loop.enqueue('tap')
    loop.enqueue('tap')
    loop.enqueue('drop')
    manual.advance(50)

    expect(batches).toEqual([3])
    expect(loop.getState().ticks).toBe(1)

    loop.stop()
  })

  it('drops actions the simulator does not declare, and non-finite payload numbers', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    loop.enqueue('teleport')
    loop.enqueue('tap', { x: Number.NaN, n: 3 })
    manual.advance(50)

    expect(loop.getInputLog()).toEqual([{ tick: 0, action: 'tap', n: 3 }])

    loop.stop()
  })

  it('ignores enqueue before start and after stop', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })

    loop.enqueue('tap')
    expect(loop.getInputLog()).toEqual([])

    loop.start()
    manual.advance(50)
    loop.stop()
    loop.enqueue('tap')

    expect(loop.getInputLog()).toEqual([])
  })

  it('resets the log on a fresh start', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })

    loop.start()
    loop.enqueue('tap')
    manual.advance(50)
    expect(loop.getInputLog()).toHaveLength(1)

    loop.stop()
    loop.start()
    expect(loop.getInputLog()).toEqual([])
    expect(loop.getTick()).toBe(0)
    loop.stop()
  })
})

// ---- Termination & teardown --------------------------------------------------

describe('createGameLoop — termination and teardown', () => {
  it('stop() removes every listener and cancels the pending frame', () => {
    const manual = createManualScheduler()
    const source = createFakeEventSource()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [
        { target: source.target, type: 'blur', shouldPause: () => true },
        { target: source.target, type: 'visibilitychange', shouldPause: () => true },
      ],
    })

    loop.start()
    expect(source.listenerCount('blur')).toBe(1)
    expect(source.listenerCount('visibilitychange')).toBe(1)
    expect(manual.pendingFrames()).toBe(1)

    loop.stop()

    expect(source.listenerCount('blur')).toBe(0)
    expect(source.listenerCount('visibilitychange')).toBe(0)
    expect(manual.pendingFrames()).toBe(0)
    expect(loop.isRunning()).toBe(false)

    // A stopped loop is inert even if simulated time keeps flowing.
    manual.advance(1_000)
    expect(loop.getTick()).toBe(0)
  })

  it('stops itself at maxTicks and keeps the final state readable', () => {
    const manual = createManualScheduler()
    const source = createFakeEventSource()
    const loop = createGameLoop({
      simulator: makeSimulator(),
      initialState: initialCounterState(),
      maxTicks: 4,
      scheduler: manual.scheduler,
      autoPause: [{ target: source.target, type: 'blur', shouldPause: () => true }],
    })
    loop.start()

    manual.advance(10_000)

    expect(loop.getTick()).toBe(4)
    expect(loop.isRunning()).toBe(false)
    expect(source.listenerCount('blur')).toBe(0)
    expect(loop.getState().ticks).toBe(4)
  })

  it('stops as soon as the simulator reports finished', () => {
    const manual = createManualScheduler()
    const loop = createGameLoop({
      simulator: makeSimulator(3),
      initialState: initialCounterState(3),
      maxTicks: 10_000,
      scheduler: manual.scheduler,
      autoPause: [],
    })
    loop.start()

    manual.advance(10_000)

    expect(loop.getTick()).toBe(3)
    expect(loop.getSnapshot().finished).toBe(true)
    expect(loop.isRunning()).toBe(false)
  })
})

// ---- React binding -----------------------------------------------------------

describe('useGameLoop', () => {
  it('exposes tick-driven state and tears the loop down on unmount', () => {
    const manual = createManualScheduler()
    const simulator = makeSimulator()
    const initialState = initialCounterState()
    const source = createFakeEventSource()
    // Referentially stable, per the hook's documented contract: rebuilding this array
    // each render would tear the loop down and restart the run.
    const autoPause = [{ target: source.target, type: 'blur', shouldPause: () => true }]

    const { result, unmount } = renderHook(() =>
      useGameLoop({
        simulator,
        initialState,
        maxTicks: 10_000,
        scheduler: manual.scheduler,
        autoPause,
      }),
    )

    expect(result.current.tick).toBe(0)
    expect(source.listenerCount('blur')).toBe(1)

    act(() => {
      result.current.emit('tap')
      manual.advance(100)
    })

    expect(result.current.tick).toBe(2)
    expect(result.current.snapshot.score).toBe(1)
    expect(result.current.getInputLog()).toEqual([{ tick: 0, action: 'tap' }])

    act(() => {
      result.current.pause()
    })
    expect(result.current.paused).toBe(true)

    unmount()
    expect(source.listenerCount('blur')).toBe(0)
  })
})
