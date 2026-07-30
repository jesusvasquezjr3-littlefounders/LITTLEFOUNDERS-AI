import { DEFAULT_MAX_EVENTS_PER_TICK, replayGame, runBot } from '@/game-engine/core/replay'
import type {
  GameDocument,
  GameInputEvent,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '@/game-engine/core/types'

// ---- A toy mechanic ----------------------------------------------------------
// A counter that advances on `tap` and finishes at `scoring.target`. It obeys the §5
// rules (pure, integer ticks, allowed arithmetic only, no randomness) so that what the
// tests prove about replayGame is not an artefact of a sloppy stand-in.

const TARGET = 8

interface ToyState {
  readonly count: number
  readonly events: number
  readonly target: number
  readonly finished: boolean
}

const toySimulator: Simulator<ToyState> = {
  mechanic: 'sorter',
  actions: ['tap', 'wait'],

  init({ scoring }: SimInit): ToyState {
    return { count: 0, events: 0, target: scoring.target ?? TARGET, finished: false }
  },

  step(state: ToyState, _tick: number, events: readonly GameInputEvent[]): ToyState {
    if (state.finished) return state
    let count = state.count
    let seen = state.events
    for (const event of events) {
      seen += 1
      if (event.action === 'tap') count += 1
    }
    const capped = Math.min(count, state.target)
    return { ...state, count: capped, events: seen, finished: capped >= state.target }
  },

  snapshot(state: ToyState): SimSnapshot {
    return { finished: state.finished, score: score(state), lives: null, round: 0 }
  },

  result(state: ToyState): SimResult {
    return {
      score: score(state),
      finished: state.finished,
      stats: { count: state.count, events: state.events },
    }
  },

  bots: {
    // One tap per tick: reaches the target in exactly `target` ticks.
    perfect(): GameInputEvent[] {
      return [{ tick: 0, action: 'tap' }]
    },
    // A bot that never acts — the "must NOT pass" side of the winnability gate.
    random(): GameInputEvent[] {
      return []
    },
  },
}

function score(state: ToyState): number {
  return Math.round((state.count / state.target) * 100)
}

const toyDocument: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'toy-counter',
    title: 'Toy Counter',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: { topic_path: 'a/b/c', recap_md: 'recap' },
    tier: 1,
    estimated_minutes: 1,
  },
  skin: { palette: 'navy-papaya', sprites: {} },
  config: {},
  content: {
    items: [{ id: 'i1', label_md: 'one' }],
    feedback: { correct_md: ['ok'], incorrect_md: ['casi'], results_md: 'fin' },
  },
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: TARGET },
}

/** A clean, accepted log: one tap per tick for `count` ticks starting at tick 0. */
function tapLog(count: number): GameInputEvent[] {
  const log: GameInputEvent[] = []
  for (let tick = 0; tick < count; tick += 1) log.push({ tick, action: 'tap' })
  return log
}

const MAX_TICKS = 100
const MAX_EVENTS = 50

function replay(inputLog: readonly GameInputEvent[], maxEvents = MAX_EVENTS) {
  return replayGame({
    simulator: toySimulator,
    document: toyDocument,
    seed: 4242,
    inputLog,
    maxTicks: MAX_TICKS,
    maxEvents,
  })
}

describe('replayGame — valid logs', () => {
  it('replays a valid log to the expected score and stats', () => {
    const outcome = replay(tapLog(TARGET))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.score).toBe(100)
    expect(outcome.result.finished).toBe(true)
    expect(outcome.result.stats).toEqual({ count: TARGET, events: TARGET })
  })

  it('scores a partial log partially and does not mark it finished', () => {
    const outcome = replay(tapLog(TARGET / 2))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.score).toBe(50)
    expect(outcome.result.finished).toBe(false)
  })

  it('scores an empty log as zero rather than rejecting it', () => {
    const outcome = replay([])
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.score).toBe(0)
  })

  it('hands each tick exactly the events stamped with that tick', () => {
    // Three taps on tick 0, one on tick 5, one on tick 5 again.
    const outcome = replay([
      { tick: 0, action: 'tap' },
      { tick: 0, action: 'tap' },
      { tick: 0, action: 'tap' },
      { tick: 5, action: 'tap' },
      { tick: 5, action: 'tap' },
    ])
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.stats.events).toBe(5)
    expect(outcome.result.stats.count).toBe(5)
  })

  it('ignores events stamped after the simulation has already finished', () => {
    const outcome = replay([...tapLog(TARGET), { tick: 90, action: 'tap' }])
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    // The run ended at the target, so the late tap was never delivered.
    expect(outcome.result.stats.events).toBe(TARGET)
    expect(outcome.result.score).toBe(100)
  })

  it('stops at maxTicks when the simulation never finishes', () => {
    const outcome = replayGame({
      simulator: toySimulator,
      document: toyDocument,
      seed: 1,
      // A single tick of budget: tick 0 is stepped and the run stops there.
      inputLog: [{ tick: 0, action: 'tap' }],
      maxTicks: 0,
      maxEvents: MAX_EVENTS,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.finished).toBe(false)
    expect(outcome.result.stats.count).toBe(1)
  })
})

describe('replayGame — determinism', () => {
  it('replays the same log identically twice', () => {
    const log = tapLog(TARGET - 1)
    expect(replay(log)).toEqual(replay(log))
  })

  it('does not mutate the input log', () => {
    const log = tapLog(4)
    const snapshot = JSON.parse(JSON.stringify(log)) as GameInputEvent[]
    replay(log)
    expect(log).toEqual(snapshot)
  })
})

describe('replayGame — rejected logs', () => {
  it('rejects an out-of-order tick', () => {
    const outcome = replay([
      { tick: 0, action: 'tap' },
      { tick: 7, action: 'tap' },
      { tick: 3, action: 'tap' },
    ])
    expect(outcome).toEqual({ ok: false, reason: 'tick_out_of_order' })
  })

  it('accepts a repeated tick (non-decreasing, not strictly increasing)', () => {
    const outcome = replay([
      { tick: 2, action: 'tap' },
      { tick: 2, action: 'tap' },
    ])
    expect(outcome.ok).toBe(true)
  })

  it('rejects an unknown action', () => {
    const outcome = replay([
      { tick: 0, action: 'tap' },
      { tick: 1, action: 'teleport' },
    ])
    expect(outcome).toEqual({ ok: false, reason: 'unknown_action' })
  })

  it('rejects a tick beyond maxTicks', () => {
    const outcome = replay([{ tick: MAX_TICKS + 1, action: 'tap' }])
    expect(outcome).toEqual({ ok: false, reason: 'tick_after_max' })
  })

  it('accepts a tick exactly at maxTicks', () => {
    const outcome = replay([{ tick: MAX_TICKS, action: 'tap' }])
    expect(outcome.ok).toBe(true)
  })

  it('rejects a log over the caller-supplied cap', () => {
    const outcome = replay(tapLog(6), 5)
    expect(outcome).toEqual({ ok: false, reason: 'log_too_long' })
  })

  it('rejects a negative tick', () => {
    const outcome = replay([{ tick: -1, action: 'tap' }])
    expect(outcome).toEqual({ ok: false, reason: 'tick_negative' })
  })

  it('rejects a non-integer tick', () => {
    const outcome = replay([{ tick: 1.5, action: 'tap' }])
    expect(outcome).toEqual({ ok: false, reason: 'tick_not_integer' })
  })

  it('rejects a NaN tick', () => {
    const outcome = replay([{ tick: Number.NaN, action: 'tap' }])
    expect(outcome).toEqual({ ok: false, reason: 'tick_not_integer' })
  })

  it('rejects non-finite numeric payload fields', () => {
    for (const event of [
      { tick: 0, action: 'tap', x: Number.NaN },
      { tick: 0, action: 'tap', y: Number.POSITIVE_INFINITY },
      { tick: 0, action: 'tap', n: Number.NEGATIVE_INFINITY },
    ]) {
      expect(replay([event])).toEqual({ ok: false, reason: 'non_finite_payload' })
    }
  })

  it('accepts finite numeric payload fields, including zero and negatives', () => {
    const outcome = replay([{ tick: 0, action: 'tap', x: 0, y: -12.5, n: 3 }])
    expect(outcome.ok).toBe(true)
  })

  it('rejects an invalid maxTicks instead of stepping', () => {
    for (const maxTicks of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const outcome = replayGame({
        simulator: toySimulator,
        document: toyDocument,
        seed: 1,
        inputLog: tapLog(1),
        maxTicks,
        maxEvents: MAX_EVENTS,
      })
      expect(outcome).toEqual({ ok: false, reason: 'invalid_max_ticks' })
    }
  })

  it('rejects an invalid cap instead of stepping', () => {
    const outcome = replay(tapLog(1), -1)
    expect(outcome).toEqual({ ok: false, reason: 'invalid_max_events' })
  })

  it('falls back to the per-tick budget when no cap is supplied', () => {
    const maxTicks = 3
    const budget = (maxTicks + 1) * DEFAULT_MAX_EVENTS_PER_TICK
    const overBudget: GameInputEvent[] = []
    for (let i = 0; i < budget + 1; i += 1) overBudget.push({ tick: 0, action: 'tap' })

    const outcome = replayGame({
      simulator: toySimulator,
      document: toyDocument,
      seed: 1,
      inputLog: overBudget,
      maxTicks,
    })
    expect(outcome).toEqual({ ok: false, reason: 'log_too_long' })
  })

  it('reports the FIRST violation when a log breaks several rules', () => {
    const outcome = replay([
      { tick: 5, action: 'tap' },
      { tick: 1, action: 'teleport' },
    ])
    expect(outcome).toEqual({ ok: false, reason: 'tick_out_of_order' })
  })
})

describe('runBot', () => {
  it('drives the perfect bot to the target', () => {
    const { result, inputLog } = runBot({
      simulator: toySimulator,
      document: toyDocument,
      seed: 99,
      bot: toySimulator.bots.perfect,
      maxTicks: MAX_TICKS,
    })
    expect(result.finished).toBe(true)
    expect(result.score).toBe(100)
    expect(inputLog).toHaveLength(TARGET)
  })

  it('stamps every emitted event with the tick it was produced on', () => {
    const { inputLog } = runBot({
      simulator: toySimulator,
      document: toyDocument,
      seed: 99,
      bot: toySimulator.bots.perfect,
      maxTicks: MAX_TICKS,
    })
    expect(inputLog.map((event) => event.tick)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it("produces a log that replays to the bot's own result", () => {
    const { result, inputLog } = runBot({
      simulator: toySimulator,
      document: toyDocument,
      seed: 99,
      bot: toySimulator.bots.perfect,
      maxTicks: MAX_TICKS,
    })
    const outcome = replay(inputLog)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result).toEqual(result)
  })

  it('does not reach the target with a no-op bot', () => {
    const { result, inputLog } = runBot({
      simulator: toySimulator,
      document: toyDocument,
      seed: 99,
      bot: toySimulator.bots.random,
      maxTicks: MAX_TICKS,
    })
    expect(result.finished).toBe(false)
    expect(result.score).toBe(0)
    expect(result.score).toBeLessThan(toyDocument.scoring.pass_score)
    expect(inputLog).toEqual([])
  })

  it('is deterministic for a fixed seed', () => {
    const run = () =>
      runBot({
        simulator: toySimulator,
        document: toyDocument,
        seed: 12345,
        bot: toySimulator.bots.perfect,
        maxTicks: MAX_TICKS,
      })
    expect(run()).toEqual(run())
  })

  it('honours the tick budget', () => {
    const { result, inputLog } = runBot({
      simulator: toySimulator,
      document: toyDocument,
      seed: 7,
      bot: toySimulator.bots.perfect,
      maxTicks: 2,
    })
    // Ticks 0, 1 and 2 are all playable, so three taps fit inside a budget of 2.
    expect(inputLog).toHaveLength(3)
    expect(result.finished).toBe(false)
  })
})
