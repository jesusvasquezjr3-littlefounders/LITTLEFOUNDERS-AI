// The Game Engine kernel — the single time base for every mechanic.
//
// GAME_ENGINE.md §5 makes the simulation replayable server-side: Core re-runs the
// mechanic's simulator over the player's input log and DERIVES the reward. That is
// only sound if the browser advances the simulation in exactly the same units the
// server does. So this module owns one job: turn messy real time (rAF deltas, tab
// blur, a stalled main thread) into a stream of WHOLE 50ms ticks, and turn player
// gestures into an input log that replays byte-for-byte.
//
// Simulation is decoupled from rendering: rendering happens on requestAnimationFrame
// at whatever rate the device gives us, while the simulation only ever advances in
// fixed `TICK_MS` steps. A frame that owes 3 ticks runs 3 ticks; a frame that owes
// none runs none and re-renders nothing.
//
// This file is deliberately framework-agnostic (`createGameLoop`) with a thin React
// binding (`useGameLoop`) on top. It is NOT part of the backend/gamegen parity copy
// — the server never needs a clock, it uses core/replay.ts.

import { useCallback, useEffect, useRef, useState } from 'react'

import { TICK_MS, type GameInputEvent, type SimSnapshot, type Simulator } from '@/game-engine/core/types'

// ---- The catch-up clamp ------------------------------------------------------
//
// A frame delta is untrusted input. A backgrounded tab, a long GC pause or a
// breakpoint in the debugger can hand us a delta of minutes; without a bound the
// next frame would run thousands of ticks synchronously and lock the main thread
// (v1's games did exactly this on tab restore). So the delta is CLAMPED before it
// reaches the accumulator, and the per-frame tick loop carries the same bound as a
// second, independent guard.
//
// The consequence is explicit and intended: after a stall the simulation runs
// SLOW rather than fast-forwarding. Wall-clock time and simulated time are allowed
// to diverge; ticks are the only clock the simulation, the HUD and the server all
// agree on, and `duration_seconds` reported at completion is derived from ticks.

/** Maximum ticks a single rendered frame may run. */
export const MAX_CATCH_UP_TICKS = 5

/** Ceiling applied to a raw frame delta before it enters the accumulator (250ms). */
export const MAX_FRAME_DELTA_MS = MAX_CATCH_UP_TICKS * TICK_MS

// ---- Engine-level guarantees the kernel's shape enforces ---------------------
//
// Two v1 bugs are structurally impossible here, and both are contracts on the
// simulators the kernel drives:
//
// 1. PER-ENTITY TIMERS. A simulator receives `step(state, tick, events)` exactly once
//    per 50ms and the absolute `tick` index with it. Every entity's timer/age/fuse
//    MUST live in that entity's own record (or be derived from `tick - entity.bornAt`)
//    — never one accumulator shared across entities. In v1 a single shared bomb
//    timer was decremented once per bomb per frame, so N bombs detonated N times too
//    fast. The kernel gives one tick; how many entities exist is not its business,
//    and a simulator that folds them into one counter re-creates the bug.
//
// 2. BATCHED REMOVALS. `step()` takes the FULL event batch for the tick and returns
//    the COMPLETE next state. There is no per-event dispatch and no partial state:
//    N entities removed on the same tick are ONE state transition. v1 dispatched
//    only the first of several simultaneous removals and stalled every other entity's
//    motion for that frame. A simulator must therefore never return early after
//    handling the first event of a batch.

// ---- Injectable seams (the testing contract) ---------------------------------
//
// The loop never touches `performance.now()` or `requestAnimationFrame` directly:
// both arrive through `GameLoopScheduler`, and the auto-pause listeners arrive
// through `GameLoopAutoPauseSource`. Tests drive the loop by injecting a manual
// scheduler and stepping simulated milliseconds by hand — no fake timers, no wall
// clock, no flake. Production callers pass neither and get the rAF defaults.

export interface GameLoopScheduler {
  /** Monotonic milliseconds. Only ever used to compute a delta. */
  now(): number
  /** Schedule one render frame. Returns a handle for `cancel`. */
  request(callback: () => void): number
  cancel(handle: number): void
  /**
   * Can this scheduler deliver a frame RIGHT NOW? Optional; absent means "always".
   *
   * The rAF default answers `false` while the document is hidden, because browsers do
   * not fire `requestAnimationFrame` in a hidden tab at all. Without this the loop
   * could `start()` in a background tab and report `running: true, paused: false`
   * while zero ticks were physically possible — a board that looks live, a HUD that
   * says nothing is wrong, taps silently accumulating on tick 0, and no pause overlay
   * to recover from. The loop refuses to claim it is running when its own frame source
   * says it cannot run.
   */
  canDeliverFrames?(): boolean
}

/** The `addEventListener`/`removeEventListener` subset the kernel needs — `document`
 *  and `window` satisfy it structurally, and so does a test double. */
export interface GameLoopEventSource {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface GameLoopAutoPauseSource {
  target: GameLoopEventSource
  type: string
  /** Consulted when the event fires; the loop pauses only when this returns true. */
  shouldPause(): boolean
}

export interface CreateGameLoopOptions<S> {
  simulator: Simulator<S>
  initialState: S
  /** Called once at start and after any frame that advanced >= 1 tick. This is the
   *  render seam: a frame that advanced no ticks changed no simulation state, so it
   *  deliberately does not fire. */
  onSnapshot?: (snapshot: SimSnapshot, state: S, tick: number) => void
  /** Notified whenever the paused flag flips, including on auto-pause. */
  onPauseChange?: (paused: boolean) => void
  /** Hard tick budget; reaching it ends the session exactly as `finished` does. The
   *  server enforces the same bound during replay (`replayGame({ maxTicks })`). */
  maxTicks: number
  scheduler?: GameLoopScheduler
  /** Defaults to document `visibilitychange` (hidden) + window `blur`. Pass `[]` to
   *  opt out entirely. */
  autoPause?: readonly GameLoopAutoPauseSource[]
}

export interface GameLoop<S> {
  /** (Re)initialises state, tick, input log and accumulator, then starts ticking. */
  start(): void
  /** Halts ticking, detaches every listener and cancels the pending frame. The final
   *  state, tick and input log stay readable. */
  stop(): void
  pause(): void
  resume(): void
  /** Records one player intent at the CURRENT tick and queues it for that tick's
   *  `step()`. Ignored when the loop is not running or when `action` is not declared
   *  by the simulator. */
  enqueue(action: string, payload?: Omit<GameInputEvent, 'tick' | 'action'>): void
  /** The exact log the server will replay. */
  getInputLog(): readonly GameInputEvent[]
  getState(): S
  getSnapshot(): SimSnapshot
  getTick(): number
  isRunning(): boolean
  isPaused(): boolean
}

function createDefaultScheduler(): GameLoopScheduler {
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now()

  if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    return {
      now,
      request: (callback) => requestAnimationFrame(() => callback()),
      cancel: (handle) => cancelAnimationFrame(handle),
      // A hidden document fires no animation frames, so this scheduler cannot advance
      // the simulation at all until the tab is on screen again.
      canDeliverFrames: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    }
  }

  // Non-browser host (a headless harness). Handles are indirected through a map so
  // the public handle type stays `number` on every platform.
  const FALLBACK_FRAME_MS = 16
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextHandle = 1
  return {
    now,
    request: (callback) => {
      const handle = nextHandle
      nextHandle += 1
      timers.set(
        handle,
        setTimeout(() => {
          timers.delete(handle)
          callback()
        }, FALLBACK_FRAME_MS),
      )
      return handle
    },
    cancel: (handle) => {
      const timer = timers.get(handle)
      if (timer !== undefined) {
        clearTimeout(timer)
        timers.delete(handle)
      }
    },
  }
}

/** v1 kept simulating in a hidden tab: a child switched away mid-run and came back to
 *  a dead run and a lost reward. Losing focus pauses; resuming is always an explicit
 *  player action, never automatic.
 *
 *  These sources are EDGE-triggered — they only ever fire on a transition. They are
 *  therefore not enough on their own: a run that BEGINS in a hidden tab sees no
 *  transition, because nothing changed. That case is covered by the scheduler's
 *  `canDeliverFrames()` (see `GameLoopScheduler`), which `start()` consults. */
function createDefaultAutoPause(): GameLoopAutoPauseSource[] {
  const sources: GameLoopAutoPauseSource[] = []
  if (typeof document !== 'undefined') {
    sources.push({
      target: document,
      type: 'visibilitychange',
      shouldPause: () => document.visibilityState === 'hidden',
    })
  }
  if (typeof window !== 'undefined') {
    sources.push({ target: window, type: 'blur', shouldPause: () => true })
  }
  return sources
}

/** Copies only the fields the input log is allowed to carry, dropping anything
 *  non-finite. The log is the sole record of player intent and is replayed verbatim
 *  server-side, so it must never accumulate raw pointer telemetry a simulator does
 *  not consume: `emit` payloads are the mechanic's own contract, and a mechanic that
 *  works in screen pixels converts to its simulation space BEFORE calling emit. */
function buildEvent(
  tick: number,
  action: string,
  payload: Omit<GameInputEvent, 'tick' | 'action'> | undefined,
): GameInputEvent {
  const event: GameInputEvent = { tick, action }
  if (payload === undefined) return event
  if (typeof payload.slot === 'string') event.slot = payload.slot
  if (typeof payload.x === 'number' && Number.isFinite(payload.x)) event.x = payload.x
  if (typeof payload.y === 'number' && Number.isFinite(payload.y)) event.y = payload.y
  if (typeof payload.n === 'number' && Number.isFinite(payload.n)) event.n = payload.n
  return event
}

export function createGameLoop<S>(options: CreateGameLoopOptions<S>): GameLoop<S> {
  const { simulator, initialState, onSnapshot, onPauseChange, maxTicks } = options
  const scheduler = options.scheduler ?? createDefaultScheduler()
  const autoPause = options.autoPause ?? createDefaultAutoPause()
  const knownActions = new Set(simulator.actions)

  let state = initialState
  let tick = 0
  let inputLog: GameInputEvent[] = []
  let pending: GameInputEvent[] = []
  let accumulator = 0
  let lastFrameAt = 0
  let running = false
  let paused = false
  let frameHandle: number | null = null
  let detachListeners: (() => void) | null = null

  function emitSnapshot(): void {
    onSnapshot?.(simulator.snapshot(state), state, tick)
  }

  function setPaused(next: boolean): void {
    if (paused === next) return
    paused = next
    onPauseChange?.(next)
  }

  function isDone(): boolean {
    return tick >= maxTicks || simulator.snapshot(state).finished
  }

  function cancelFrame(): void {
    if (frameHandle !== null) {
      scheduler.cancel(frameHandle)
      frameHandle = null
    }
  }

  function scheduleFrame(): void {
    if (frameHandle !== null) return
    frameHandle = scheduler.request(runFrame)
  }

  function advanceOneTick(): void {
    const events = pending
    pending = []
    state = simulator.step(state, tick, events)
    tick += 1
  }

  function runFrame(): void {
    frameHandle = null
    if (!running || paused) return

    const now = scheduler.now()
    const rawDelta = now - lastFrameAt
    lastFrameAt = now
    // A negative delta means a non-monotonic clock; treat it as no time passing.
    const delta = rawDelta <= 0 ? 0 : Math.min(rawDelta, MAX_FRAME_DELTA_MS)
    accumulator += delta

    let ticksThisFrame = 0
    while (accumulator >= TICK_MS && ticksThisFrame < MAX_CATCH_UP_TICKS && !isDone()) {
      accumulator -= TICK_MS
      advanceOneTick()
      ticksThisFrame += 1
    }

    if (ticksThisFrame > 0) emitSnapshot()

    if (isDone()) {
      stop()
      return
    }
    scheduleFrame()
  }

  function attachListeners(): void {
    if (detachListeners !== null || autoPause.length === 0) return
    const bound: { source: GameLoopAutoPauseSource; listener: () => void }[] = []
    for (const source of autoPause) {
      const listener = (): void => {
        if (running && !paused && source.shouldPause()) pauseLoop()
      }
      source.target.addEventListener(source.type, listener)
      bound.push({ source, listener })
    }
    detachListeners = () => {
      for (const entry of bound) {
        entry.source.target.removeEventListener(entry.source.type, entry.listener)
      }
    }
  }

  function start(): void {
    if (running) return
    state = initialState
    tick = 0
    inputLog = []
    pending = []
    accumulator = 0
    lastFrameAt = scheduler.now()
    running = true
    setPaused(false)
    attachListeners()
    emitSnapshot()
    if (isDone()) {
      stop()
      return
    }
    // The auto-pause sources are edge-triggered, so they cannot catch a run that
    // STARTS inside the pause condition — a hidden tab fires no `visibilitychange`
    // because nothing changed. Ask the frame source directly instead: if it cannot
    // deliver, start PAUSED, so the player gets the pause overlay and its resume
    // instead of a board that looks live and can never advance a tick.
    if (scheduler.canDeliverFrames?.() === false) {
      pauseLoop()
      return
    }
    scheduleFrame()
  }

  function stop(): void {
    running = false
    cancelFrame()
    accumulator = 0
    if (detachListeners !== null) {
      detachListeners()
      detachListeners = null
    }
  }

  /** Dropping the accumulator is the point: without it, the milliseconds that elapsed
   *  while paused would be owed to the simulation and resuming would fast-forward
   *  through them. Pausing is exact because the tick is the unit. */
  function pauseLoop(): void {
    if (!running || paused) return
    setPaused(true)
    accumulator = 0
    cancelFrame()
  }

  function resumeLoop(): void {
    if (!running || !paused) return
    setPaused(false)
    accumulator = 0
    lastFrameAt = scheduler.now()
    scheduleFrame()
  }

  function enqueue(action: string, payload?: Omit<GameInputEvent, 'tick' | 'action'>): void {
    if (!running) return
    // An action the simulator does not declare would make replayGame() reject the
    // WHOLE log server-side — an honest child losing the reward for a stray emit.
    // Drop it here instead, where it costs nothing.
    if (!knownActions.has(action)) return
    const event = buildEvent(tick, action, payload)
    inputLog.push(event)
    pending.push(event)
  }

  return {
    start,
    stop,
    pause: pauseLoop,
    resume: resumeLoop,
    enqueue,
    getInputLog: () => inputLog,
    getState: () => state,
    getSnapshot: () => simulator.snapshot(state),
    getTick: () => tick,
    isRunning: () => running,
    isPaused: () => paused,
  }
}

// ---- React binding -----------------------------------------------------------

export interface UseGameLoopOptions<S> {
  simulator: Simulator<S>
  initialState: S
  maxTicks: number
  /** Defaults to true. */
  autoStart?: boolean
  scheduler?: GameLoopScheduler
  autoPause?: readonly GameLoopAutoPauseSource[]
}

export interface UseGameLoopResult<S> {
  state: S
  snapshot: SimSnapshot
  tick: number
  paused: boolean
  running: boolean
  /** The `emit` a mechanic View receives. */
  emit: (action: string, payload?: Omit<GameInputEvent, 'tick' | 'action'>) => void
  start: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  getInputLog: () => readonly GameInputEvent[]
}

/** Thin binding only: every rule lives in `createGameLoop`, so the same behaviour is
 *  testable without React and reusable from the dev lab's headless runner.
 *
 *  `simulator`, `initialState`, `scheduler` and `autoPause` MUST be referentially
 *  stable — a new identity tears the loop down and starts a fresh run (which is the
 *  correct behaviour for "play again", and a bug if it happens by accident). */
export function useGameLoop<S>(options: UseGameLoopOptions<S>): UseGameLoopResult<S> {
  const { simulator, initialState, maxTicks, autoStart = true, scheduler, autoPause } = options

  const [view, setView] = useState<{ state: S; snapshot: SimSnapshot; tick: number }>(() => ({
    state: initialState,
    snapshot: simulator.snapshot(initialState),
    tick: 0,
  }))
  const [paused, setPausedState] = useState(false)
  const [running, setRunning] = useState(false)
  const loopRef = useRef<GameLoop<S> | null>(null)

  useEffect(() => {
    const loop = createGameLoop<S>({
      simulator,
      initialState,
      maxTicks,
      scheduler,
      autoPause,
      onSnapshot: (snapshot, state, tick) => {
        setView({ state, snapshot, tick })
        setRunning(loop.isRunning())
      },
      onPauseChange: setPausedState,
    })
    loopRef.current = loop
    if (autoStart) {
      loop.start()
      setRunning(loop.isRunning())
    }
    return () => {
      loop.stop()
      loopRef.current = null
      setRunning(false)
    }
  }, [simulator, initialState, maxTicks, autoStart, scheduler, autoPause])

  const emit = useCallback<UseGameLoopResult<S>['emit']>((action, payload) => {
    loopRef.current?.enqueue(action, payload)
  }, [])

  const start = useCallback(() => {
    loopRef.current?.start()
    setRunning(loopRef.current?.isRunning() ?? false)
  }, [])
  const stop = useCallback(() => {
    loopRef.current?.stop()
    setRunning(false)
  }, [])
  const pause = useCallback(() => loopRef.current?.pause(), [])
  const resume = useCallback(() => loopRef.current?.resume(), [])
  const getInputLog = useCallback<() => readonly GameInputEvent[]>(
    () => loopRef.current?.getInputLog() ?? [],
    [],
  )

  return {
    state: view.state,
    snapshot: view.snapshot,
    tick: view.tick,
    paused,
    running,
    emit,
    start,
    stop,
    pause,
    resume,
    getInputLog,
  }
}
