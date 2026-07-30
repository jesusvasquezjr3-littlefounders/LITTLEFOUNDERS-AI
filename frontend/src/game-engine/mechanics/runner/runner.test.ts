// Runner — the slice's regression tests.
//
// Four properties are load-bearing and each one has an explicit test here:
//  1. DETERMINISM. Same seed + same input log => byte-identical SimResult, twice. This
//     is the property Core's reward path rests on (GAME_ENGINE.md §5/§6).
//  2. WINNABILITY. The `perfect` bot reaches `pass_score` on EVERY fixture and the
//     `random` bot does not — the §9 gate, run here so a fixture can never drift into
//     "unwinnable" or "mashable" without a red test.
//  3. SCHEMA. An out-of-bounds config is REJECTED, not coerced (§1.14).
//  4. THE MECHANIC'S OWN RULE. A wrong pickup costs exactly what the manifest says.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, SimResult } from '@/game-engine/core/types'
import enGames from '@/i18n/en-US/games.json'

import { RunnerView } from './components'
import { runnerBots } from './bots'
import { runnerFixtures } from './fixtures'
import { runnerSlice } from './register'
import { runnerConfigSchema, runnerContentSchema, type RunnerConfig } from './schema'
import { avatarTopY, runnerSimulator } from './simulate'

const SEED = 987654

function configOf(document: GameDocument): RunnerConfig {
  return document.config as unknown as RunnerConfig
}

/** `SimResult.stats` is a `Record<string, number>`, so every read is `number |
 *  undefined` under `noUncheckedIndexedAccess`. A missing key is a real failure here —
 *  the simulator promises these — so it fails loudly instead of defaulting to 0. */
function statOf(result: SimResult, key: string): number {
  const value = result.stats[key]
  if (value === undefined) throw new Error(`stats.${key} is missing`)
  return value
}

function playPerfect(document: GameDocument, seed = SEED) {
  return runBot({
    simulator: runnerSimulator,
    document,
    seed,
    bot: runnerBots.perfect,
    maxTicks: configOf(document).max_ticks,
  })
}

function playRandom(document: GameDocument, seed = SEED) {
  return runBot({
    simulator: runnerSimulator,
    document,
    seed,
    bot: runnerBots.random,
    maxTicks: configOf(document).max_ticks,
  })
}

describe('runner fixtures', () => {
  it('ships at least two complete manifests', () => {
    expect(runnerFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of runnerFixtures) {
    describe(document.meta.slug, () => {
      it('passes the production config and content schemas', () => {
        expect(runnerConfigSchema.safeParse(document.config).success).toBe(true)
        expect(runnerContentSchema.safeParse(document.content).success).toBe(true)
      })

      it('declares runner and a locale/tier the engine understands', () => {
        expect(document.meta.mechanic).toBe('runner')
        expect(document.meta.locale).toBe('es-MX')
        expect(document.scoring.mode === 'cheer' ? document.scoring.lives : 1).not.toBe(0)
      })
    })
  }
})

describe('runner — the winnability gate (GAME_ENGINE.md §9)', () => {
  for (const document of runnerFixtures) {
    it(`${document.meta.slug}: the perfect bot reaches pass_score`, () => {
      const { result } = playPerfect(document)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
      expect(result.finished).toBe(true)
      expect(statOf(result, 'reached_target')).toBe(1)
    })

    it(`${document.meta.slug}: the random bot does NOT reach pass_score`, () => {
      const { result } = playRandom(document)
      expect(result.score).toBeLessThan(document.scoring.pass_score)
    })

    it(`${document.meta.slug}: the run fits its tick budget`, () => {
      const { inputLog } = playPerfect(document)
      const maxTicks = configOf(document).max_ticks
      for (const event of inputLog) expect(event.tick).toBeLessThanOrEqual(maxTicks)
    })
  }
})

describe('runner — determinism (GAME_ENGINE.md §5)', () => {
  for (const document of runnerFixtures) {
    it(`${document.meta.slug}: the same seed and log replay to the same result, twice`, () => {
      const { inputLog } = playPerfect(document)
      const maxTicks = configOf(document).max_ticks

      const replay = (): SimResult => {
        const outcome = replayGame({
          simulator: runnerSimulator,
          document,
          seed: SEED,
          inputLog,
          maxTicks,
          maxEvents: maxTicks + 1,
        })
        if (!outcome.ok) throw new Error(`replay rejected: ${outcome.reason}`)
        return outcome.result
      }

      const first = replay()
      const second = replay()
      expect(second).toEqual(first)
      expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    })

    it(`${document.meta.slug}: the bot's own log replays to the bot's own result`, () => {
      const { result, inputLog } = playPerfect(document)
      const outcome = replayGame({
        simulator: runnerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks: configOf(document).max_ticks,
        maxEvents: configOf(document).max_ticks + 1,
      })
      expect(outcome.ok).toBe(true)
      if (!outcome.ok) return
      expect(outcome.result).toEqual(result)
    })

    it(`${document.meta.slug}: a different seed produces a different world`, () => {
      const a = playPerfect(document, SEED)
      const b = playPerfect(document, SEED + 7919)
      expect(statOf(a.result, 'distance')).toBeGreaterThan(0)
      expect(statOf(b.result, 'distance')).toBeGreaterThan(0)
      // Same simulator, different seeded pattern stream: the collected totals must not
      // be locked together, or the "seeded" spawn table is not actually seeded.
      expect(
        statOf(a.result, 'collected') !== statOf(b.result, 'collected') ||
          a.inputLog.length !== b.inputLog.length,
      ).toBe(true)
    })
  }

  it('rejects a log whose ticks run backwards rather than partially crediting it', () => {
    const document = runnerFixtures[0]
    expect(document).toBeDefined()
    if (document === undefined) return
    const outcome = replayGame({
      simulator: runnerSimulator,
      document,
      seed: SEED,
      inputLog: [
        { tick: 20, action: 'act' },
        { tick: 5, action: 'act' },
      ],
      maxTicks: configOf(document).max_ticks,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('tick_out_of_order')
  })
})

describe('runner — schema bounds (CLAUDE.md §1.14)', () => {
  const baseConfig = (): RunnerConfig => {
    const document = runnerFixtures[0]
    if (document === undefined) throw new Error('fixture 0 is missing')
    return structuredClone(configOf(document))
  }

  it('rejects a world narrower than the schema floor', () => {
    const config = baseConfig()
    config.world.width = 10
    expect(runnerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a stalled speed phase', () => {
    const config = baseConfig()
    const phase = config.speed.phases[0]
    expect(phase).toBeDefined()
    if (phase === undefined) return
    phase.units_per_tick = 0
    expect(runnerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a speed ramp that never defines tick 0', () => {
    const config = baseConfig()
    const phase = config.speed.phases[0]
    if (phase === undefined) return
    phase.from_tick = 25
    expect(runnerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an impulse that cannot beat its own gravity', () => {
    const config = baseConfig()
    if (config.action.model !== 'jump') return
    config.action.jump.impulse = config.action.jump.gravity
    expect(runnerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a moving element with no period', () => {
    const config = baseConfig()
    const pattern = config.spawn.patterns[0]
    if (pattern === undefined) return
    const element = pattern.elements[0]
    if (element === undefined) return
    element.variant = 'moving'
    element.amplitude = 10
    element.period_ticks = undefined
    expect(runnerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an avoidable item with no misconception to teach', () => {
    const document = runnerFixtures[0]
    if (document === undefined) return
    const content = structuredClone(document.content) as unknown as {
      items: { id: string; misconception_md?: string }[]
      roles: { avoid: string[] }
    }
    const trapId = content.roles.avoid[0]
    expect(trapId).toBeDefined()
    const trap = content.items.find((item) => item.id === trapId)
    if (trap === undefined) return
    delete trap.misconception_md
    expect(runnerContentSchema.safeParse(content).success).toBe(false)
  })
})

describe('runner — a wrong pickup costs exactly what the config says', () => {
  it('subtracts wrong_penalty_pct points per avoidable item taken', () => {
    const source = runnerFixtures[0]
    if (source === undefined) throw new Error('fixture 0 is missing')

    // Two documents identical except for the wrong-pickup penalty. Nothing else in the
    // simulation reads the scoring block, so the entity stream, the collisions and the
    // wrong count are the SAME run — only the arithmetic on top differs.
    const withoutPenalty = structuredClone(source)
    const withPenalty = structuredClone(source)
    const rate = 7
    for (const document of [withoutPenalty, withPenalty]) {
      const config = configOf(document)
      config.scoring.crash_penalty_pct = 0
    }
    configOf(withoutPenalty).scoring.wrong_penalty_pct = 0
    configOf(withPenalty).scoring.wrong_penalty_pct = rate

    const clean = playRandom(withoutPenalty)
    const charged = playRandom(withPenalty)

    const wrong = statOf(clean.result, 'wrong')
    expect(wrong).toBe(statOf(charged.result, 'wrong'))
    expect(wrong).toBeGreaterThan(0)
    expect(charged.result.score).toBe(Math.max(0, clean.result.score - wrong * rate))
  })

  it('never lets a wrong pickup raise the score', () => {
    const source = runnerFixtures[1]
    if (source === undefined) throw new Error('fixture 1 is missing')
    const harsh = structuredClone(source)
    configOf(harsh).scoring.wrong_penalty_pct = 100
    const base = playRandom(source)
    const punished = playRandom(harsh)
    expect(punished.result.score).toBeLessThanOrEqual(base.result.score)
  })
})

describe('runner — the view is a renderer (GAME_ENGINE.md §7, §10)', () => {
  afterEach(cleanup)

  const mount = (options: { reducedMotion?: boolean; paused?: boolean } = {}) => {
    const document = runnerFixtures[0]
    if (document === undefined) throw new Error('fixture 0 is missing')
    let state = runnerSimulator.init({
      config: document.config,
      content: document.content,
      scoring: document.scoring,
      seed: SEED,
    })
    // Far enough in that entities, a moving collectible and the ground band are all
    // on screen — an empty world would render nothing and prove nothing.
    for (let tick = 0; tick < 140; tick += 1) state = runnerSimulator.step(state, tick, [])
    const emit = vi.fn()
    render(
      createElement(RunnerView, {
        document,
        state,
        snapshot: runnerSimulator.snapshot(state),
        emit,
        paused: options.paused ?? false,
        reducedMotion: options.reducedMotion ?? false,
      }),
    )
    return { emit, state }
  }

  // The accessible name is read from the en-US fragment rather than hardcoded, so a
  // copy edit never breaks the test, and asserted to NOT look like a key path. An
  // earlier revision matched the raw 'games.runner.action.jump' instead: that passed
  // while the key was missing from all three locales and i18next was echoing the path
  // back, which is precisely how a screen reader came to announce "games.runner.action.jump".
  const stage = () => {
    const button = screen.getByRole('button', { name: enGames.runner.action.jump })
    expect(button.getAttribute('aria-label')).not.toMatch(/^games\./)
    return button
  }

  it('exposes the single action as a real, named control', () => {
    mount()
    expect(stage()).toBeInTheDocument()
  })

  it('emits the action on a pointer press — tap-first, no drag required', () => {
    const { emit } = mount()
    fireEvent.pointerDown(stage())
    expect(emit).toHaveBeenCalledWith('act')
  })

  it('still renders and still plays with reduced motion — motion is decorative only', () => {
    const { emit } = mount({ reducedMotion: true })
    fireEvent.pointerDown(stage())
    expect(emit).toHaveBeenCalledWith('act')
  })

  it('accepts no input while paused', () => {
    const { emit } = mount({ paused: true })
    fireEvent.pointerDown(stage())
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('runner — the registered slice', () => {
  it('exposes the mechanic, its schemas, its sprite slots and its fixtures', () => {
    expect(runnerSlice.mechanic).toBe('runner')
    expect(runnerSlice.fixtures).toBe(runnerFixtures)
    expect(runnerSlice.spriteSlots).toContain('avatar')
    expect(runnerSlice.simulator.actions).toEqual(['act', 'hold_start', 'hold_end'])
  })

  it('declares every sprite slot the view can ask for', () => {
    const document = runnerFixtures[0]
    if (document === undefined) return
    for (const key of Object.keys(document.skin.sprites)) {
      expect(runnerSlice.spriteSlots).toContain(key)
    }
  })
})

describe('runner — the other three action models (GAME_ENGINE.md §4)', () => {
  /** Re-skins a fixture with a different action model. This is the claim the mechanic
   *  table makes — jump / lane / flip / contextual are all MANIFEST choices over one
   *  simulator — so it is asserted rather than assumed. */
  function withAction(index: number, action: RunnerConfig['action']): GameDocument {
    const source = runnerFixtures[index]
    if (source === undefined) throw new Error(`fixture ${index} is missing`)
    const document = structuredClone(source)
    configOf(document).action = action
    return document
  }

  it('flip: the same track pair, played as a gravity flip, stays winnable', () => {
    const document = withAction(1, {
      model: 'flip',
      flip: { floor_y: 340, ceiling_y: 180, transition_ticks: 5 },
    })
    expect(runnerConfigSchema.safeParse(document.config).success).toBe(true)
    const { result } = playPerfect(document)
    expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    expect(statOf(result, 'crashes')).toBe(0)
  })

  it('contextual: one button, a different physics block per surface, stays winnable', () => {
    const document = withAction(0, {
      model: 'contextual',
      surfaces: [
        { from_units: 0, surface: 'ground' },
        { from_units: 3000, surface: 'air' },
      ],
      effects: {
        ground: { dir: 1, impulse: 15, gravity: 1, max_jumps: 1 },
        water: { dir: -1, impulse: 14, gravity: 1, max_jumps: 1 },
        air: { dir: 1, impulse: 15, gravity: 1, max_jumps: 2 },
      },
      hold: { enabled: true, glide_gravity: 0, max_hold_ticks: 8 },
    })
    expect(runnerConfigSchema.safeParse(document.config).success).toBe(true)
    const { result } = playPerfect(document)
    expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    expect(statOf(result, 'crashes')).toBe(0)
  })

  it('contextual: on a water surface the SAME action dives instead of jumping', () => {
    const document = withAction(0, {
      model: 'contextual',
      surfaces: [{ from_units: 0, surface: 'water' }],
      effects: {
        ground: { dir: 1, impulse: 15, gravity: 1, max_jumps: 1 },
        water: { dir: -1, impulse: 14, gravity: 1, max_jumps: 1 },
        air: { dir: 1, impulse: 15, gravity: 1, max_jumps: 1 },
      },
      hold: { enabled: false, glide_gravity: 0, max_hold_ticks: 0 },
    })
    let state = runnerSimulator.init({
      config: document.config,
      content: document.content,
      scoring: document.scoring,
      seed: SEED,
    })
    state = runnerSimulator.step(state, 0, [{ tick: 0, action: 'act' }])
    // Below the rest line, and therefore BELOW the resting avatar on screen.
    expect(state.offset).toBeLessThan(0)
    expect(avatarTopY(state)).toBeGreaterThan(
      configOf(document).world.ground_y - configOf(document).world.avatar_h,
    )
  })
})
