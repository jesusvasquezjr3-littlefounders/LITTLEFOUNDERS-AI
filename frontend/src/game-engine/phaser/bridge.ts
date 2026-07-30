import {
  TICK_MS,
  type GameInputEvent,
  type SimInit,
  type SimResult,
  type SimSnapshot,
  type Simulator,
} from '@/game-engine/core/types'
import { MAX_CATCH_UP_TICKS } from '@/game-engine/core/kernel'

export interface BridgeSnapshot {
  score: number
  lives: number | null
  finished: boolean
  round: number
  tick: number
  tickAlpha: number
}

export class GameEngineBridge<S> {
  readonly simulator: Simulator<S>

  private _state: S
  private _prevState: S | null = null
  private _tick = 0
  private _inputLog: GameInputEvent[] = []
  private _pending: GameInputEvent[] = []
  private _running = false
  private _paused = false
  private _lastFrameTime = 0
  private _accumulator = 0
  private _tickAlpha = 0

  constructor(simulator: Simulator<S>, init: SimInit) {
    this.simulator = simulator
    this._state = simulator.init(init)
  }

  start(): void {
    if (this._running) return
    this._running = true
    this._paused = false
    this._lastFrameTime = performance.now()
    this._accumulator = 0
    this._tickAlpha = 0
  }

  stop(): void {
    this._running = false
  }

  pause(): void {
    if (!this._running) return
    this._paused = true
    this._accumulator = 0
  }

  resume(): void {
    if (!this._running) return
    this._paused = false
    this._lastFrameTime = performance.now()
    this._accumulator = 0
    this._tickAlpha = 0
  }

  update(rawDeltaMs: number): void {
    if (!this._running || this._paused) return

    if (this.simulator.snapshot(this._state).finished) {
      this.stop()
      return
    }

    const clamped = rawDeltaMs <= 0 ? 0 : Math.min(rawDeltaMs, MAX_CATCH_UP_TICKS * TICK_MS)
    this._accumulator += clamped

    let ticksThisFrame = 0
    while (this._accumulator >= TICK_MS && ticksThisFrame < MAX_CATCH_UP_TICKS) {
      this._accumulator -= TICK_MS
      this._prevState = this._state
      const batch = this._pending
      this._pending = []
      this._state = this.simulator.step(this._state, this._tick, batch)
      this._tick += 1
      ticksThisFrame += 1
    }

    this._tickAlpha = Math.min(1, this._accumulator / TICK_MS)
  }

  enqueue(action: string, payload?: Omit<GameInputEvent, 'tick' | 'action'>): void {
    if (!this._running || this._paused) return
    const known = this.simulator.actions as readonly string[]
    if (!known.includes(action)) return

    const event: GameInputEvent = { tick: this._tick, action }
    if (payload) {
      if (typeof payload.slot === 'string') event.slot = payload.slot
      if (typeof payload.x === 'number' && Number.isFinite(payload.x)) event.x = payload.x
      if (typeof payload.y === 'number' && Number.isFinite(payload.y)) event.y = payload.y
      if (typeof payload.n === 'number' && Number.isFinite(payload.n)) event.n = payload.n
    }
    this._inputLog.push(event)
    this._pending.push(event)
  }

  get state(): S {
    return this._state
  }

  get prevState(): S | null {
    return this._prevState
  }

  get tick(): number {
    return this._tick
  }

  get alpha(): number {
    return this._tickAlpha
  }

  get snapshot(): SimSnapshot {
    return this.simulator.snapshot(this._state)
  }

  get result(): SimResult {
    return this.simulator.result(this._state)
  }

  get inputLog(): readonly GameInputEvent[] {
    return this._inputLog
  }

  get running(): boolean {
    return this._running
  }

  get paused(): boolean {
    return this._paused
  }

  get finished(): boolean {
    return this.snapshot.finished
  }

  get bridgeSnapshot(): BridgeSnapshot {
    const s = this.snapshot
    return {
      score: s.score,
      lives: s.lives,
      finished: s.finished,
      round: s.round,
      tick: this._tick,
      tickAlpha: this._tickAlpha,
    }
  }

  lerpNumber(current: number, target: number, speed = 0.35): number {
    return current + (target - current) * speed
  }
}
