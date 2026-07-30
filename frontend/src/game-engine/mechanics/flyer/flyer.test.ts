// Flyer — the slice's regression tests.
//
// Four properties are load-bearing and each one has an explicit test here:
//  1. DETERMINISM. Same seed + same input log => byte-identical SimResult, twice. This is
//     the property Core's reward path rests on (GAME_ENGINE.md §5/§6). Extra weight here
//     because this is the first mechanic to use `core/mathd.ts`: a single `Math.sin` in
//     the flight model would make the browser and Node disagree in the low bits and
//     reject an honest child's XP.
//  2. WINNABILITY. The `perfect` bot reaches `pass_score` on EVERY fixture and the
//     `random` bot does not — the §9 gate, run here so a fixture can never drift into
//     "unwinnable" or "mashable" without a red test.
//  3. SCHEMA. An out-of-bounds config is REJECTED, not coerced (§1.14).
//  4. THE MECHANIC'S OWN RULES. The stall condition and the energy curve — the two
//     mechanic-specific behaviours the spec pins — behave exactly as configured.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, SimResult } from '@/game-engine/core/types'

import { FlyerView } from './components'
import { flyerBots } from './bots'
import { flyerFixtures } from './fixtures'
import { flyerSlice } from './register'
import { flyerConfigSchema, flyerContentSchema, type FlyerConfig } from './schema'
import { flyerSimulator, type FlyerState } from './simulate'

const SEED = 987654

function configOf(document: GameDocument): FlyerConfig {
  return document.config as unknown as FlyerConfig
}

/** `SimResult.stats` is a `Record<string, number>`, so every read is `number | undefined`
 *  under `noUncheckedIndexedAccess`. A missing key is a real failure here — the simulator
 *  promises these — so it fails loudly instead of defaulting to 0. */
function statOf(result: SimResult, key: string): number {
  const value = result.stats[key]
  if (value === undefined) throw new Error(`stats.${key} is missing`)
  return value
}

function playPerfect(document: GameDocument, seed = SEED) {
  return runBot({
    simulator: flyerSimulator,
    document,
    seed,
    bot: flyerBots.perfect,
    maxTicks: configOf(document).max_ticks,
  })
}

function playRandom(document: GameDocument, seed = SEED) {
  return runBot({
    simulator: flyerSimulator,
    document,
    seed,
    bot: flyerBots.random,
    maxTicks: configOf(document).max_ticks,
  })
}

function initOf(document: GameDocument, seed = SEED): FlyerState {
  return flyerSimulator.init({
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  })
}

function fixture(index: number): GameDocument {
  const document = flyerFixtures[index]
  if (document === undefined) throw new Error(`fixture ${index} is missing`)
  return document
}

describe('flyer fixtures', () => {
  it('ships at least two complete manifests', () => {
    expect(flyerFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of flyerFixtures) {
    describe(document.meta.slug, () => {
      it('passes the production config and content schemas', () => {
        expect(flyerConfigSchema.safeParse(document.config).success).toBe(true)
        expect(flyerContentSchema.safeParse(document.content).success).toBe(true)
      })

      it('declares flyer and a locale/tier the engine understands', () => {
        expect(document.meta.mechanic).toBe('flyer')
        expect(document.meta.locale).toBe('es-MX')
        expect(document.scoring.mode === 'cheer' ? document.scoring.lives : 1).not.toBe(0)
      })

      it('binds every skin sprite key to a slot the mechanic declares', () => {
        for (const key of Object.keys(document.skin.sprites)) {
          expect(flyerSlice.spriteSlots).toContain(key)
        }
      })
    })
  }
})

describe('flyer — the winnability gate (GAME_ENGINE.md §9)', () => {
  for (const document of flyerFixtures) {
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

    // The gate must not be a single lucky seed: a fixture that is only winnable on the
    // seed the test happens to use would ship an unwinnable game to a child on any other.
    for (const seed of [12345, 777, 424242, 60606]) {
      it(`${document.meta.slug}: the gate holds on seed ${seed}`, () => {
        expect(playPerfect(document, seed).result.score).toBeGreaterThanOrEqual(
          document.scoring.pass_score,
        )
        expect(playRandom(document, seed).result.score).toBeLessThan(document.scoring.pass_score)
      })
    }

    it(`${document.meta.slug}: the run fits its tick budget`, () => {
      const { inputLog } = playPerfect(document)
      const maxTicks = configOf(document).max_ticks
      for (const event of inputLog) expect(event.tick).toBeLessThanOrEqual(maxTicks)
    })
  }
})

describe('flyer — determinism (GAME_ENGINE.md §5)', () => {
  for (const document of flyerFixtures) {
    it(`${document.meta.slug}: the same seed and log replay to the same result, twice`, () => {
      const { inputLog } = playPerfect(document)
      const maxTicks = configOf(document).max_ticks

      const replay = (): SimResult => {
        const outcome = replayGame({
          simulator: flyerSimulator,
          document,
          seed: SEED,
          inputLog,
          maxTicks,
          maxEvents: (maxTicks + 1) * 4,
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
        simulator: flyerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks: configOf(document).max_ticks,
        maxEvents: (configOf(document).max_ticks + 1) * 4,
      })
      expect(outcome.ok).toBe(true)
      if (!outcome.ok) return
      expect(outcome.result).toEqual(result)
    })

    it(`${document.meta.slug}: stepping the same state twice yields the same state`, () => {
      // The seeded TAPE, not a live Rng, is what makes this true — a mutable generator
      // smuggled through `step` would make these two diverge.
      let state = initOf(document)
      for (let tick = 0; tick < 40; tick += 1) state = flyerSimulator.step(state, tick, [])
      const a = flyerSimulator.step(state, 40, [{ tick: 40, action: 'climb' }])
      const b = flyerSimulator.step(state, 40, [{ tick: 40, action: 'climb' }])
      expect(flyerSimulator.result(b)).toEqual(flyerSimulator.result(a))
      expect(b.altitude).toBe(a.altitude)
      expect(b.speed).toBe(a.speed)
      expect(b.energy).toBe(a.energy)
    })

    it(`${document.meta.slug}: a different seed produces a different sky`, () => {
      const a = playPerfect(document, SEED)
      const b = playPerfect(document, SEED + 7919)
      expect(statOf(a.result, 'distance')).toBeGreaterThan(0)
      expect(statOf(b.result, 'distance')).toBeGreaterThan(0)
      expect(
        statOf(a.result, 'collected') !== statOf(b.result, 'collected') ||
          a.inputLog.length !== b.inputLog.length,
      ).toBe(true)
    })
  }

  it('rejects a log whose ticks run backwards rather than partially crediting it', () => {
    const document = fixture(0)
    const outcome = replayGame({
      simulator: flyerSimulator,
      document,
      seed: SEED,
      inputLog: [
        { tick: 20, action: 'climb' },
        { tick: 5, action: 'dive' },
      ],
      maxTicks: configOf(document).max_ticks,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('tick_out_of_order')
  })

  it('rejects an action this mechanic does not define', () => {
    const document = fixture(0)
    const outcome = replayGame({
      simulator: flyerSimulator,
      document,
      seed: SEED,
      inputLog: [{ tick: 1, action: 'barrel_roll' }],
      maxTicks: configOf(document).max_ticks,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('unknown_action')
  })
})

describe('flyer — schema bounds (CLAUDE.md §1.14)', () => {
  const baseConfig = (): FlyerConfig => structuredClone(configOf(fixture(1)))

  it('rejects a world narrower than the schema floor', () => {
    const config = baseConfig()
    config.world.width = 10
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a ceiling below its own floor', () => {
    const config = baseConfig()
    config.world.ceiling_y = config.world.floor_y + 10
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a stall the mount could never recover from', () => {
    const config = baseConfig()
    config.flight.stall.recover_speed = config.flight.stall.speed - 1
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a recover speed the mount cannot physically reach', () => {
    const config = baseConfig()
    config.flight.stall.recover_speed = config.mount.top_speed + 5
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a glide band wider than the climb pitch, which would make climbing free', () => {
    const config = baseConfig()
    config.energy.glide_band_deg = config.flight.climb_pitch_deg
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a mount that starts with more energy than it can hold', () => {
    const config = baseConfig()
    config.energy.start = config.energy.capacity + 1
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an enemy element naming an undeclared enemy type', () => {
    const config = baseConfig()
    for (const pattern of config.spawn.patterns) {
      for (const element of pattern.elements) {
        if (element.role === 'enemy') element.enemy_type = 'no-such-enemy'
      }
    }
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a boss whose phases do not start at full hit points', () => {
    const config = baseConfig()
    const boss = config.enemies.find((enemy) => enemy.pattern === 'boss')
    expect(boss).toBeDefined()
    if (boss?.phases === undefined) return
    const first = boss.phases[0]
    if (first === undefined) return
    first.from_hp_pct = 90
    expect(flyerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an avoidable item with no misconception to teach', () => {
    const content = structuredClone(fixture(0).content) as unknown as {
      items: { id: string; misconception_md?: string }[]
      roles: { avoid: string[] }
    }
    const trapId = content.roles.avoid[0]
    expect(trapId).toBeDefined()
    const trap = content.items.find((item) => item.id === trapId)
    if (trap === undefined) return
    delete trap.misconception_md
    expect(flyerContentSchema.safeParse(content).success).toBe(false)
  })
})

describe('flyer — the stall condition behaves exactly as configured', () => {
  /** Climbing bleeds speed; below `stall.speed` with the nose up the mount stalls, its
   *  attitude is forced to `stall.pitch_deg`, commands are ignored for the lockout, regen
   *  stops and it sinks. Recovery is `speed >= stall.recover_speed`. */
  it('enters a stall from a sustained climb and recovers on speed alone', () => {
    const document = fixture(0)
    const config = configOf(document)
    let state = initOf(document)
    let stalledAt = -1
    let recoveredAt = -1

    for (let tick = 0; tick < 400; tick += 1) {
      // Hold the nose up every tick: exactly the over-spend the mechanic warns about.
      const events = stalledAt < 0 ? [{ tick, action: 'climb' }] : []
      state = flyerSimulator.step(state, tick, events)
      if (stalledAt < 0 && state.stalled) {
        stalledAt = tick
        expect(state.speed).toBeLessThan(config.flight.stall.speed)
        expect(state.stalls).toBe(1)
      } else if (stalledAt >= 0 && recoveredAt < 0 && !state.stalled) {
        recoveredAt = tick
        expect(state.speed).toBeGreaterThanOrEqual(config.flight.stall.recover_speed)
      }
    }

    expect(stalledAt).toBeGreaterThan(0)
    expect(recoveredAt).toBeGreaterThan(stalledAt)
  })

  it('ignores climb commands while the stall lockout is running', () => {
    const document = fixture(0)
    const config = configOf(document)
    let state = initOf(document)
    for (let tick = 0; tick < 400 && !state.stalled; tick += 1) {
      state = flyerSimulator.step(state, tick, [{ tick, action: 'climb' }])
    }
    expect(state.stalled).toBe(true)
    expect(state.stallLockLeft).toBeGreaterThan(0)

    // Stepped twice from the SAME stalled state, once with a climb and once without: if
    // the lockout is real the two states are indistinguishable, attitude and reserve
    // included. No attitude was bought and no manoeuvre fee was charged.
    const next = state.tick + 1
    const idle = flyerSimulator.step(state, next, [])
    const commanded = flyerSimulator.step(state, next, [{ tick: next, action: 'climb' }])
    expect(commanded.commandPitch).toBe(idle.commandPitch)
    expect(commanded.commandLeft).toBe(idle.commandLeft)
    expect(commanded.pitch).toBe(idle.pitch)
    expect(commanded.energySpent).toBe(idle.energySpent)
    // Regen is blocked while stalled, so the reserve cannot have grown either.
    expect(commanded.energy).toBeLessThanOrEqual(state.energy)
    expect(config.flight.stall.control_lockout_ticks).toBeGreaterThan(0)
  })
})

describe('flyer — the energy curve behaves exactly as configured', () => {
  const document = fixture(0)
  const config = configOf(document)

  it('drains while climbing and regenerates while gliding, at the configured rates', () => {
    // Two runs from the SAME state, differing only in the command, so the comparison is
    // the energy curve and nothing else. Neither run touches a thermal or a storm at
    // tick 0, so the rates are the plain pitch-driven ones.
    let base = initOf(document)
    base = flyerSimulator.step(base, 0, [])

    let climbing = flyerSimulator.step(base, 1, [{ tick: 1, action: 'climb' }])
    let gliding = flyerSimulator.step(base, 1, [{ tick: 1, action: 'dive' }])
    for (let tick = 2; tick < 14; tick += 1) {
      climbing = flyerSimulator.step(climbing, tick, [])
      gliding = flyerSimulator.step(gliding, tick, [])
    }

    expect(climbing.pitch).toBeGreaterThan(config.energy.glide_band_deg)
    expect(gliding.pitch).toBeLessThan(-config.energy.glide_band_deg)
    // Climbing buys altitude with reserve; gliding sells altitude back for reserve.
    expect(climbing.altitude).toBeLessThan(base.altitude)
    expect(gliding.altitude).toBeGreaterThan(base.altitude)
    expect(climbing.energy).toBeLessThan(gliding.energy)
    // Both runs paid exactly one manoeuvre fee; only the climb also pays per-tick drain,
    // so the whole difference in "spent" is the climb itself.
    expect(gliding.energySpent).toBeCloseTo(config.energy.manoeuvre_cost, 10)
    expect(climbing.energySpent).toBeGreaterThan(gliding.energySpent)
  })

  it('refuses a climb on an empty reserve, and never refuses a dive', () => {
    const drained = { ...initOf(document), energy: 0 }
    const climb = flyerSimulator.step(drained, 0, [{ tick: 0, action: 'climb' }])
    expect(climb.commandLeft).toBe(0)
    expect(climb.commandPitch).toBe(0)

    const dive = flyerSimulator.step(drained, 0, [{ tick: 0, action: 'dive' }])
    expect(dive.commandPitch).toBe(config.flight.dive_pitch_deg)
    expect(dive.commandLeft).toBeGreaterThan(0)
  })

  it('charges the manoeuvre fee once per command, not once per tick', () => {
    const start = initOf(document)
    const commanded = flyerSimulator.step(start, 0, [{ tick: 0, action: 'dive' }])
    const idle = flyerSimulator.step(start, 0, [])
    expect(commanded.energySpent - idle.energySpent).toBeCloseTo(config.energy.manoeuvre_cost, 10)

    const nextCommanded = flyerSimulator.step(commanded, 1, [])
    // The attitude is still held, but the fee is not charged again.
    expect(nextCommanded.commandLeft).toBeGreaterThan(0)
    expect(nextCommanded.energySpent - commanded.energySpent).toBeLessThan(
      config.energy.manoeuvre_cost,
    )
  })
})

describe('flyer — the view is a renderer (GAME_ENGINE.md §7, §10)', () => {
  afterEach(cleanup)

  const mount = (index: number, options: { reducedMotion?: boolean; paused?: boolean } = {}) => {
    const document = fixture(index)
    let state = initOf(document)
    // Far enough in that entities, the ground band and the mount are all on screen — an
    // empty sky would render nothing and prove nothing.
    for (let tick = 0; tick < 120; tick += 1) state = flyerSimulator.step(state, tick, [])
    const emit = vi.fn()
    render(
      createElement(FlyerView, {
        document,
        state,
        snapshot: flyerSimulator.snapshot(state),
        emit,
        paused: options.paused ?? false,
        reducedMotion: options.reducedMotion ?? false,
      }),
    )
    return { emit, state }
  }

  /** Every control is a real <button>, so this is also the assertion that keyboard and
   *  screen-reader users can reach the whole mechanic.
   *
   *  NOTE on the name queries below: they match the ACCESSIBLE NAME, which is
   *  `t('games.flyer.action.climb')`. The `games.flyer.*` fragment is owned by the i18n
   *  surface, not by this slice, and does not exist yet — until it lands, i18next echoes
   *  the key path (which also contains "climb"/"dive"), so these assertions prove the
   *  control is reachable by name but NOT that the copy is real. Once the three locales
   *  carry the fragment, tighten this the way `runner.test.ts` does: read the expected
   *  string out of `@/i18n/en-US/games.json` and assert the name does not match
   *  /^games\./ — that is what catches a screen reader announcing a key path. */
  const controls = () => screen.getAllByRole('button')

  it('renders the stage and its controls as real buttons', () => {
    mount(0)
    // Two tap zones (climb / dive) + the climb, dive and steer controls at minimum.
    expect(controls().length).toBeGreaterThanOrEqual(5)
  })

  it('climbs and dives on a single tap — no drag required (CLAUDE.md §1.11)', () => {
    const { emit } = mount(0)
    const climb = screen.getAllByLabelText(/climb/i)[0]
    expect(climb).toBeDefined()
    if (climb === undefined) return
    fireEvent.click(climb)
    expect(emit).toHaveBeenCalledWith('climb', undefined)
  })

  it('still renders and still plays with reduced motion — motion is decorative only', () => {
    const { emit } = mount(0, { reducedMotion: true })
    const dive = screen.getAllByLabelText(/dive/i)[0]
    if (dive === undefined) return
    fireEvent.click(dive)
    expect(emit).toHaveBeenCalledWith('dive', undefined)
  })

  it('accepts no input while paused', () => {
    const { emit } = mount(0, { paused: true })
    for (const control of controls()) fireEvent.click(control)
    expect(emit).not.toHaveBeenCalled()
  })

  it('renders the armed fixture, beam, lanes, enemies and all', () => {
    const { emit } = mount(1)
    // The armed manifest exposes strictly more controls than the unarmed one.
    expect(controls().length).toBeGreaterThanOrEqual(7)
    const climb = screen.getAllByLabelText(/climb/i)[0]
    if (climb === undefined) return
    fireEvent.click(climb)
    expect(emit).toHaveBeenCalled()
  })
})

describe('flyer — the registered slice', () => {
  it('exposes the mechanic, its schemas, its sprite slots and its fixtures', () => {
    expect(flyerSlice.mechanic).toBe('flyer')
    expect(flyerSlice.fixtures).toBe(flyerFixtures)
    expect(flyerSlice.spriteSlots).toContain('mount')
    expect(flyerSlice.spriteSlots).toContain('thermal')
    expect(flyerSlice.simulator.actions).toEqual([
      'climb',
      'dive',
      'fire',
      'beam_start',
      'beam_end',
      'lane',
    ])
  })
})
