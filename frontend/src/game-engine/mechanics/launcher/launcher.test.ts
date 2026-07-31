// `launcher` — the slice's regression tests.
//
// Five properties are load-bearing and each one has explicit coverage here:
//  1. DETERMINISM. Same seed + same input log => byte-identical SimResult, twice. This
//     is the property Core's reward path rests on (GAME_ENGINE.md §5/§6).
//  2. WINNABILITY. The `perfect` bot reaches `pass_score` on EVERY fixture and the
//     `random` bot does not — the §9 gate, run here so a fixture can never drift into
//     "unwinnable" or "spammable" without a red test.
//  3. SCHEMA. An out-of-bounds config is REJECTED, not coerced (§1.14).
//  4. THE MECHANIC'S OWN RULES. Ballistics, wind, mass, bounce materials, chained
//     explosions, guided steering, the leftover economy and the misconception penalty
//     all behave exactly as the manifest configures them — nothing is hardcoded.
//  5. THE VIEW IS A RENDERER. It emits; it never scores and never advances a tick.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'

import i18n from '@/i18n'
import { replayGame, runBot } from '@/game-engine/core/replay'
import {
  accuracyScore,
  applyPenalty,
  efficiencyScore,
  targetScore,
  weightedScore,
} from '@/game-engine/core/scoring'
import type { GameDocument, GameInputEvent, SimResult } from '@/game-engine/core/types'

import { LauncherView } from './components'
import { launcherBots } from './bots'
import { launcherFixtures } from './fixtures'
import { launcherSlice } from './register'
import {
  launcherConfigSchema,
  launcherContentSchema,
  type LauncherConfig,
  type LauncherContent,
} from './schema'
import {
  launcherSimulator,
  previewPath,
  quantizeAngle,
  quantizePower,
  targetRect,
  type LauncherState,
} from './simulate'
import { nextAimToEnqueue } from './scene'

const SEED = 424242

function configOf(document: GameDocument): LauncherConfig {
  return document.config as unknown as LauncherConfig
}

function fixture(index: number): GameDocument {
  const document = launcherFixtures[index]
  if (document === undefined) throw new Error(`fixture ${index} is missing`)
  return document
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
    simulator: launcherSimulator,
    document,
    seed,
    bot: launcherBots.perfect,
    maxTicks: configOf(document).max_ticks,
  })
}

function playRandom(document: GameDocument, seed = SEED) {
  return runBot({
    simulator: launcherSimulator,
    document,
    seed,
    bot: launcherBots.random,
    maxTicks: configOf(document).max_ticks,
  })
}

function initState(document: GameDocument, seed = SEED): LauncherState {
  return launcherSimulator.init({
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  })
}

interface FlightTrace {
  state: LauncherState
  /** Every position the shot passed through, one entry per tick. */
  path: { x: number; y: number; vx: number; vy: number }[]
  ticks: number
}

/** Fires ONE shot and steps until it resolves, optionally feeding an in-flight action
 *  (the guided `nudge`) on every tick of the flight. */
function fireOnce(
  document: GameDocument,
  angle: number,
  power: number,
  options: { nudge?: number; seed?: number } = {},
): FlightTrace {
  const config = configOf(document)
  let state = initState(document, options.seed ?? SEED)
  state = launcherSimulator.step(state, 0, [{ tick: 0, action: 'launch', x: angle, y: power }])
  const path: { x: number; y: number; vx: number; vy: number }[] = []
  let tick = 1
  while (state.projectiles.length > 0 && tick < config.max_ticks) {
    for (const projectile of state.projectiles) {
      path.push({ x: projectile.x, y: projectile.y, vx: projectile.vx, vy: projectile.vy })
    }
    const events: GameInputEvent[] =
      options.nudge === undefined ? [] : [{ tick, action: 'nudge', n: options.nudge }]
    state = launcherSimulator.step(state, tick, events)
    tick += 1
  }
  return { state, path, ticks: tick }
}

/** The furthest downrange the shot ever got — the honest read of "how far it flew". */
function reach(trace: FlightTrace): number {
  let furthest = 0
  for (const point of trace.path) furthest = Math.max(furthest, point.x)
  return furthest
}

/** Sweeps the manifest's own aim grid for the first shot satisfying `predicate`. */
function findShot(
  document: GameDocument,
  predicate: (trace: FlightTrace) => boolean,
): { angle: number; power: number; trace: FlightTrace } | null {
  const l = configOf(document).launcher
  for (let angle = l.min_angle; angle <= l.max_angle; angle += l.angle_step) {
    for (let power = l.min_power; power <= l.max_power; power += l.power_step) {
      const trace = fireOnce(document, angle, power)
      if (predicate(trace)) return { angle, power, trace }
    }
  }
  return null
}

// ---- Fixtures --------------------------------------------------------------------

describe('launcher fixtures', () => {
  it('ships at least two complete manifests', () => {
    expect(launcherFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of launcherFixtures) {
    describe(document.meta.slug, () => {
      it('passes the production config and content schemas', () => {
        expect(launcherConfigSchema.safeParse(document.config).success).toBe(true)
        expect(launcherContentSchema.safeParse(document.content).success).toBe(true)
      })

      it('declares launcher, es-MX, and a scoring block the engine understands', () => {
        expect(document.meta.mechanic).toBe('launcher')
        expect(document.meta.locale).toBe('es-MX')
        if (document.scoring.mode === 'cheer') expect(document.scoring.lives).toBeNull()
        else expect(document.scoring.lives).toBeGreaterThan(0)
      })

      it('binds only sprite slots the mechanic declares', () => {
        for (const key of Object.keys(document.skin.sprites)) {
          expect(launcherSlice.spriteSlots).toContain(key)
        }
      })
    })
  }
})

// ---- The winnability gate ----------------------------------------------------------

describe('launcher — the winnability gate (GAME_ENGINE.md §9)', () => {
  for (const document of launcherFixtures) {
    it(`${document.meta.slug}: the perfect bot reaches pass_score`, () => {
      const { result } = playPerfect(document)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
      expect(result.finished).toBe(true)
      expect(statOf(result, 'targets_destroyed')).toBe(statOf(result, 'targets_total'))
      // It never aims at a misconception: the bot models the LESSON, not just the physics.
      expect(statOf(result, 'incorrect_hits')).toBe(0)
    })

    it(`${document.meta.slug}: the random bot does NOT reach pass_score`, () => {
      const { result } = playRandom(document)
      expect(result.score).toBeLessThan(document.scoring.pass_score)
    })

    it(`${document.meta.slug}: the perfect run fits its tick and event budget`, () => {
      const config = configOf(document)
      const { inputLog } = playPerfect(document)
      for (const event of inputLog) expect(event.tick).toBeLessThanOrEqual(config.max_ticks)
      let budget = 0
      for (const round of config.rounds) budget += round.shots
      expect(inputLog.length).toBeLessThanOrEqual(budget)
    })
  }
})

// ---- Determinism -------------------------------------------------------------------

describe('launcher — determinism (GAME_ENGINE.md §5)', () => {
  for (const document of launcherFixtures) {
    it(`${document.meta.slug}: the same seed and log replay to the same result, twice`, () => {
      const { inputLog } = playPerfect(document)
      const maxTicks = configOf(document).max_ticks

      const replay = (): SimResult => {
        const outcome = replayGame({
          simulator: launcherSimulator,
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
      const maxTicks = configOf(document).max_ticks
      const outcome = replayGame({
        simulator: launcherSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks,
        maxEvents: maxTicks + 1,
      })
      expect(outcome.ok).toBe(true)
      if (!outcome.ok) return
      expect(outcome.result).toEqual(result)
    })
  }

  it('rejects a log whose ticks run backwards rather than partially crediting it', () => {
    const document = fixture(0)
    const outcome = replayGame({
      simulator: launcherSimulator,
      document,
      seed: SEED,
      inputLog: [
        { tick: 20, action: 'launch', x: 45, y: 80 },
        { tick: 5, action: 'launch', x: 45, y: 80 },
      ],
      maxTicks: configOf(document).max_ticks,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('tick_out_of_order')
  })

  it('rejects a log naming an action this mechanic does not have', () => {
    const document = fixture(0)
    const outcome = replayGame({
      simulator: launcherSimulator,
      document,
      seed: SEED,
      inputLog: [{ tick: 1, action: 'teleport' }],
      maxTicks: configOf(document).max_ticks,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('unknown_action')
  })

  it('drives the erratic target from the seeded tape, not from the wall clock', () => {
    // Fixture 2 round 2 carries the erratic target; two seeds must dress and move the
    // same layout differently, and each seed must reproduce itself exactly.
    const document = fixture(1)
    const a = initState(document, SEED)
    const b = initState(document, SEED)
    const c = initState(document, SEED + 104729)
    expect(a.draws[0]).toBe(b.draws[0])
    expect(a.draws[0]).not.toBe(c.draws[0])

    const offsetsFor = (state: LauncherState): number[] => {
      const out: number[] = []
      for (const target of state.targets) {
        for (let tick = 0; tick < 300; tick += 7) out.push(targetRect(target, tick, state.draws).x)
      }
      return out
    }
    // Round 1 has no erratic target, so compare the erratic round's shape directly by
    // advancing both runs into round 2 with no input at all.
    const advance = (state: LauncherState): LauncherState => {
      let next = state
      for (let tick = 0; tick < 460 && next.round === 0; tick += 1) {
        next = launcherSimulator.step(next, tick, [])
      }
      return next
    }
    const seededA = offsetsFor(advance(a))
    const seededB = offsetsFor(advance(b))
    const seededC = offsetsFor(advance(c))
    expect(seededA).toEqual(seededB)
    expect(seededA).not.toEqual(seededC)
  })
})

// ---- Schema bounds -------------------------------------------------------------------

describe('launcher — schema bounds (CLAUDE.md §1.14)', () => {
  const baseConfig = (): LauncherConfig => structuredClone(configOf(fixture(0)))
  const baseContent = (): LauncherContent =>
    structuredClone(fixture(0).content as unknown as LauncherContent)

  it('rejects a world narrower than the schema floor', () => {
    const config = baseConfig()
    config.world.width = 10
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an angle range that cannot be aimed', () => {
    const config = baseConfig()
    config.launcher.max_angle = config.launcher.min_angle
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a starting power outside its own range', () => {
    const config = baseConfig()
    config.launcher.start_power = config.launcher.max_power + 1
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a speed band where power changes nothing', () => {
    const config = baseConfig()
    config.launcher.speed_max = config.launcher.speed_min
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a round with fewer projectiles than correct targets', () => {
    const config = baseConfig()
    const round = config.rounds[0]
    if (round === undefined) throw new Error('round 0 is missing')
    round.shots = 1
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a round with no correct target at all', () => {
    const config = baseConfig()
    const round = config.rounds[0]
    if (round === undefined) throw new Error('round 0 is missing')
    for (const target of round.targets) target.role = 'incorrect'
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a moving target with no period', () => {
    const config = baseConfig()
    const target = config.rounds[1]?.targets[1]
    if (target === undefined) throw new Error('the moving target is missing')
    target.period_ticks = undefined
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a target that swings out of the world', () => {
    const config = baseConfig()
    const target = config.rounds[1]?.targets[1]
    if (target === undefined) throw new Error('the moving target is missing')
    target.amplitude = 600
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a circular target whose height contradicts its diameter', () => {
    const config = baseConfig()
    const target = config.rounds[0]?.targets[1]
    if (target === undefined) throw new Error('the circular target is missing')
    expect(target.shape).toBe('circle')
    target.h = target.w + 10
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects an explosive projectile that declares no blast', () => {
    const config = structuredClone(configOf(fixture(1)))
    const projectile = config.projectiles[0]
    if (projectile === undefined) throw new Error('projectile 0 is missing')
    expect(projectile.kind).toBe('explosive')
    projectile.explosive = undefined
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a breakable obstacle with no hp', () => {
    const config = structuredClone(configOf(fixture(1)))
    const obstacle = config.rounds[0]?.obstacles[0]
    if (obstacle === undefined) throw new Error('the crate is missing')
    obstacle.hp = undefined
    expect(launcherConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a misconception target with no misconception to teach', () => {
    const content = baseContent()
    const trapId = content.roles.incorrect[0]
    const trap = content.items.find((item) => item.id === trapId)
    if (trap === undefined) throw new Error('the trap item is missing')
    delete trap.misconception_md
    expect(launcherContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects an item that is both the sound choice and the misconception', () => {
    const content = baseContent()
    const correct = content.roles.correct[0]
    if (correct === undefined) throw new Error('roles.correct is empty')
    content.roles.incorrect.push(correct)
    expect(launcherContentSchema.safeParse(content).success).toBe(false)
  })
})

// ---- Ballistics ------------------------------------------------------------------------

describe('launcher — the ballistics are exactly what the manifest configures', () => {
  /** A clean firing range: one tiny correct target parked out of the flight path, so a
   *  shot flies until the ground stops it and the trace is pure physics. */
  function firingRange(mutate: (config: LauncherConfig) => void = () => {}): GameDocument {
    const document = structuredClone(fixture(0))
    const config = configOf(document)
    config.rounds = [
      {
        id: 'rango',
        shots: 20,
        max_ticks: 400,
        target_speed_permille: 1000,
        targets: [
          {
            id: 'marca',
            role: 'correct',
            item_ref: 'alcancia',
            shape: 'box',
            x: 10,
            y: 10,
            w: 6,
            h: 6,
            hp: 1,
            value: 10,
            motion: 'static',
          },
        ],
        obstacles: [],
      },
    ]
    config.launcher.min_angle = 0
    config.launcher.start_angle = 0
    mutate(config)
    expect(launcherConfigSchema.safeParse(config).success).toBe(true)
    return document
  }

  it('snaps an off-grid aim onto the manifest angle and power steps', () => {
    const config = configOf(fixture(0))
    expect(quantizeAngle(config, 47)).toBe(45)
    expect(quantizeAngle(config, 48)).toBe(50)
    expect(quantizeAngle(config, 999)).toBe(config.launcher.max_angle)
    expect(quantizeAngle(config, -999)).toBe(config.launcher.min_angle)
    expect(quantizePower(config, 74)).toBe(70)
    expect(quantizePower(config, 76)).toBe(80)

    // And the simulator applies the SAME quantization to whatever a client sends, so a
    // pull-back gesture and an angle wheel produce the same replayable shot.
    let state = initState(fixture(0))
    state = launcherSimulator.step(state, 0, [{ tick: 0, action: 'aim', x: 47.9, y: 73.4 }])
    expect(state.angle).toBe(50)
    expect(state.power).toBe(70)
  })

  it('flies farther with more power at the same angle', () => {
    const range = firingRange()
    // Both powers are chosen so the shot lands INSIDE the world: a shot that exits the
    // right edge is clipped by the boundary, which would make this pass for the wrong
    // reason.
    const soft = fireOnce(range, 45, 40)
    const hard = fireOnce(range, 45, 70)
    expect(reach(hard)).toBeGreaterThan(reach(soft))
  })

  it('flies higher and lands shorter as the angle steepens past 45°', () => {
    const range = firingRange()
    const flat = fireOnce(range, 30, 70)
    const mid = fireOnce(range, 45, 70)
    const steep = fireOnce(range, 75, 70)
    const apex = (trace: FlightTrace): number => {
      let highest = Number.POSITIVE_INFINITY
      for (const point of trace.path) highest = Math.min(highest, point.y)
      return highest
    }
    expect(reach(mid)).toBeGreaterThan(reach(flat))
    expect(reach(mid)).toBeGreaterThan(reach(steep))
    expect(apex(steep)).toBeLessThan(apex(mid))
  })

  it('lets wind push the shot downrange by exactly the configured amount', () => {
    const still = firingRange((config) => {
      config.physics.wind_x = 0
      config.physics.wind_gust = 0
    })
    const breezy = firingRange((config) => {
      config.physics.wind_x = 0.5
      config.physics.wind_gust = 0
    })
    const a = fireOnce(still, 45, 60)
    const b = fireOnce(breezy, 45, 60)
    expect(reach(b)).toBeGreaterThan(reach(a))
    expect(a.path.length).toBe(b.path.length)
  })

  it('drops a heavy projectile sooner than a light one (mass is gravity_scale)', () => {
    const heavy = firingRange((config) => {
      const projectile = config.projectiles[0]
      if (projectile === undefined) throw new Error('projectile 0 is missing')
      projectile.gravity_scale_permille = 2000
    })
    const light = firingRange((config) => {
      const projectile = config.projectiles[0]
      if (projectile === undefined) throw new Error('projectile 0 is missing')
      projectile.gravity_scale_permille = 500
    })
    const heavyShot = fireOnce(heavy, 45, 70)
    const lightShot = fireOnce(light, 45, 70)
    expect(reach(heavyShot)).toBeLessThan(reach(lightShot))
    expect(heavyShot.path.length).toBeLessThan(lightShot.path.length)
  })

  it('shortens the flight when air resistance is dialled up', () => {
    const clean = firingRange((config) => {
      config.physics.drag_permille = 0
    })
    const thick = firingRange((config) => {
      config.physics.drag_permille = 60
    })
    expect(reach(fireOnce(thick, 45, 70))).toBeLessThan(reach(fireOnce(clean, 45, 70)))
  })
})

// ---- Materials, bounces, explosions ------------------------------------------------------

describe('launcher — obstacle materials resolve exactly as declared', () => {
  /** A wall directly in front of the muzzle, so a flat shot always meets it. */
  function walled(
    material: 'deflect' | 'solid' | 'absorb',
    options: { bounces?: number; explosive?: boolean; chainDepth?: number } = {},
  ): GameDocument {
    const document = structuredClone(fixture(0))
    const config = configOf(document)
    config.launcher.min_angle = 0
    config.launcher.start_angle = 0
    const projectile = config.projectiles[0]
    if (projectile === undefined) throw new Error('projectile 0 is missing')
    projectile.bounces = options.bounces ?? 0
    projectile.restitution_permille = 1000
    if (options.explosive === true) {
      projectile.kind = 'explosive'
      projectile.explosive = { radius: 70, damage: 2, chain_depth: options.chainDepth ?? 0 }
    }
    config.rounds = [
      {
        id: 'muralla',
        shots: 4,
        max_ticks: 400,
        target_speed_permille: 1000,
        targets: [
          {
            id: 'premio',
            role: 'correct',
            item_ref: 'alcancia',
            shape: 'box',
            x: 320,
            y: 390,
            w: 60,
            h: 60,
            hp: 1,
            value: 10,
            motion: 'static',
          },
        ],
        obstacles: [
          {
            id: 'pared',
            x: 200,
            y: 300,
            w: 30,
            h: 170,
            material,
            restitution_permille: 1000,
            friction_permille: 0,
            chain: false,
          },
          {
            id: 'caja',
            x: 250,
            y: 390,
            w: 40,
            h: 60,
            material: 'breakable',
            hp: 2,
            restitution_permille: 300,
            friction_permille: 400,
            chain: true,
          },
        ],
      },
    ]
    expect(launcherConfigSchema.safeParse(config).success).toBe(true)
    return document
  }

  it('a deflecting wall reverses the shot; the same wall as solid stops it dead', () => {
    const bounced = fireOnce(walled('deflect', { bounces: 2 }), 0, 100)
    const stopped = fireOnce(walled('solid'), 0, 100)

    const reversed = bounced.path.some((point) => point.vx < 0)
    expect(reversed).toBe(true)
    // The bounce is what keeps the shot alive; the solid wall ends it on contact.
    expect(bounced.path.length).toBeGreaterThan(stopped.path.length)
    expect(bounced.state.misses).toBe(1)
    expect(stopped.state.misses).toBe(1)
  })

  it('an absorbing wall swallows the shot and its blast', () => {
    const swallowed = fireOnce(walled('absorb', { explosive: true, chainDepth: 2 }), 0, 100)
    const detonated = fireOnce(walled('solid', { explosive: true, chainDepth: 2 }), 0, 100)
    expect(swallowed.state.correctHits).toBe(0)
    // Same geometry, same shot: only the material differs, and only one of them teaches
    // the crate-and-chain lesson.
    expect(detonated.state.correctHits).toBeGreaterThan(0)
  })

  it('a chained explosion reaches a target the first blast could not', () => {
    const noChain = fireOnce(walled('solid', { explosive: true, chainDepth: 0 }), 0, 100)
    const chained = fireOnce(walled('solid', { explosive: true, chainDepth: 2 }), 0, 100)
    expect(noChain.state.correctHits).toBe(0)
    expect(chained.state.correctHits).toBe(1)
    expect(chained.state.correctDestroyed).toBe(1)
  })
})

// ---- Guided ammo --------------------------------------------------------------------------

describe('launcher — guided ammo accepts a small in-flight correction', () => {
  function guidedRange(steerAccel: number): GameDocument {
    const document = structuredClone(fixture(0))
    const config = configOf(document)
    const projectile = config.projectiles[0]
    if (projectile === undefined) throw new Error('projectile 0 is missing')
    projectile.kind = 'guided'
    projectile.guided = { steer_accel: steerAccel, max_ticks: 30 }
    config.rounds = [
      {
        id: 'guia',
        shots: 4,
        max_ticks: 400,
        target_speed_permille: 1000,
        targets: [
          {
            id: 'marca',
            role: 'correct',
            item_ref: 'alcancia',
            shape: 'box',
            x: 10,
            y: 10,
            w: 6,
            h: 6,
            hp: 1,
            value: 10,
            motion: 'static',
          },
        ],
        obstacles: [],
      },
    ]
    expect(launcherConfigSchema.safeParse(config).success).toBe(true)
    return document
  }

  it('steers only while the steering window is open, and only by steer_accel', () => {
    const range = guidedRange(0.6)
    const straight = fireOnce(range, 45, 60)
    const pushed = fireOnce(range, 45, 60, { nudge: 1 })
    const pulled = fireOnce(range, 45, 60, { nudge: -1 })
    expect(reach(pushed)).toBeGreaterThan(reach(straight))
    expect(reach(pulled)).toBeLessThan(reach(straight))

    // Zero steering acceleration means the nudge is inert — the manifest, not the code,
    // decides whether guidance exists at all.
    const inert = guidedRange(0)
    expect(reach(fireOnce(inert, 45, 60, { nudge: 1 }))).toBe(reach(fireOnce(inert, 45, 60)))
  })
})

// ---- Economy, scoring and penalties -----------------------------------------------------------

describe('launcher — the score is composed exactly from the configured weights', () => {
  for (const document of launcherFixtures) {
    it(`${document.meta.slug}: the reported score is the manifest's own formula`, () => {
      const weights = configOf(document).scoring
      const { result } = playPerfect(document)
      const blend = weightedScore([
        {
          value: accuracyScore(statOf(result, 'correct_hits'), statOf(result, 'shots_fired')),
          weight: weights.accuracy_weight,
        },
        { value: targetScore(statOf(result, 'points'), weights.points_target), weight: weights.points_weight },
        {
          value: efficiencyScore(statOf(result, 'shots_fired'), statOf(result, 'shots_budget')),
          weight: weights.leftover_weight,
        },
        {
          value: targetScore(statOf(result, 'useful_bounces'), weights.bounce_target),
          weight: weights.bounce_weight,
        },
      ])
      const afterWrong = applyPenalty(blend, statOf(result, 'incorrect_hits'), weights.wrong_penalty_pct)
      expect(result.score).toBe(applyPenalty(afterWrong, statOf(result, 'misses'), weights.miss_penalty_pct))
    })
  }

  it('pays for leftover projectiles: raising the leftover weight moves the score', () => {
    const document = fixture(0)
    const generous = structuredClone(document)
    configOf(generous).scoring.leftover_weight = 3
    const stingy = structuredClone(document)
    configOf(stingy).scoring.leftover_weight = 0

    const a = playPerfect(generous)
    const b = playPerfect(stingy)
    // Identical run (the scoring block feeds no simulation branch), different arithmetic.
    expect(statOf(a.result, 'shots_fired')).toBe(statOf(b.result, 'shots_fired'))
    expect(statOf(a.result, 'shots_fired')).toBeLessThan(statOf(a.result, 'shots_budget'))
    expect(a.result.score).not.toBe(b.result.score)
  })

  it('charges exactly wrong_penalty_pct for a shot that lands on a misconception', () => {
    const document = fixture(0)
    const found = findShot(document, (trace) => trace.state.incorrectHits === 1)
    expect(found).not.toBeNull()
    if (found === null) return

    const rate = 12
    const free = structuredClone(document)
    configOf(free).scoring.wrong_penalty_pct = 0
    const charged = structuredClone(document)
    configOf(charged).scoring.wrong_penalty_pct = rate

    const clean = fireOnce(free, found.angle, found.power)
    const punished = fireOnce(charged, found.angle, found.power)
    const cleanScore = launcherSimulator.result(clean.state).score
    const punishedScore = launcherSimulator.result(punished.state).score
    expect(punished.state.incorrectHits).toBe(1)
    expect(punishedScore).toBe(Math.max(0, cleanScore - rate))
  })

  it('costs a life in arcade mode when the manifest says a wrong hit does', () => {
    const document = fixture(1)
    const found = findShot(document, (trace) => trace.state.incorrectHits === 1)
    expect(found).not.toBeNull()
    if (found === null) return
    expect(configOf(document).scoring.lives_cost_on_wrong).toBe(true)
    expect(found.trace.state.lives).toBe((document.scoring.lives ?? 0) - 1)

    const forgiving = structuredClone(document)
    configOf(forgiving).scoring.lives_cost_on_wrong = false
    const spared = fireOnce(forgiving, found.angle, found.power)
    expect(spared.state.lives).toBe(document.scoring.lives ?? 0)
  })
})

// ---- The predictive aid --------------------------------------------------------------------------

describe('launcher — the predictive trajectory is a tier-gated manifest flag', () => {
  it('tier 1 ships the aid on and tier 2 chooses to ship it off', () => {
    const tierOne = fixture(0)
    const tierTwo = fixture(1)
    expect(tierOne.meta.tier).toBe(1)
    expect(configOf(tierOne).aim.trajectory_preview.enabled).toBe(true)
    expect(tierTwo.meta.tier).toBe(2)
    expect(configOf(tierTwo).aim.trajectory_preview.enabled).toBe(false)
  })

  it('previews the arc from the same physics, and stops where the shot would', () => {
    const document = fixture(0)
    const preview = configOf(document).aim.trajectory_preview
    const state = initState(document)
    const dots = previewPath(state, 45, 100, preview.dots, preview.tick_step)
    expect(dots.length).toBeGreaterThan(0)
    expect(dots.length).toBeLessThanOrEqual(preview.dots)
    for (const dot of dots) {
      expect(dot.y).toBeLessThan(configOf(document).world.ground_y)
      expect(dot.x).toBeGreaterThan(0)
    }
    // The dotted line is the flight, sampled: its first dot sits on the real trajectory.
    const trace = fireOnce(document, 45, 100)
    const firstDot = dots[0]
    const realPoint = trace.path[preview.tick_step - 1]
    expect(firstDot).toBeDefined()
    expect(realPoint).toBeDefined()
    if (firstDot === undefined || realPoint === undefined) return
    expect(firstDot.x).toBeCloseTo(realPoint.x, 6)
    expect(firstDot.y).toBeCloseTo(realPoint.y, 6)
  })

  it('asks for nothing when the manifest turns the aid off', () => {
    const document = fixture(1)
    const preview = configOf(document).aim.trajectory_preview
    expect(previewPath(initState(document), 45, 100, preview.dots, preview.tick_step)).toEqual([])
  })
})

// ---- The view -------------------------------------------------------------------------------------

describe('launcher — the view is a renderer (GAME_ENGINE.md §7, §10)', () => {
  afterEach(cleanup)

  const mount = (options: { paused?: boolean; reducedMotion?: boolean; index?: number } = {}) => {
    const document = fixture(options.index ?? 0)
    let state = initState(document)
    // A few ticks in, so targets, the rig and the ground band are all on screen — an
    // empty world would render nothing and prove nothing.
    for (let tick = 0; tick < 5; tick += 1) state = launcherSimulator.step(state, tick, [])
    const emit = vi.fn()
    render(
      createElement(LauncherView, {
        document,
        state,
        snapshot: launcherSimulator.snapshot(state),
        emit,
        paused: options.paused ?? false,
        reducedMotion: options.reducedMotion ?? false,
      }),
    )
    return { emit, state, document }
  }

  // Accessible names are read back through the SAME i18n instance the component uses,
  // so a copy edit never breaks the test and a missing key never silently passes as a
  // hardcoded English string.
  const named = (key: string) => screen.getByRole('button', { name: i18n.t(key) })

  it('exposes the field, the aim steppers and the launch CTA as real, named controls', () => {
    mount()
    expect(named('games.launcher.fieldLabel')).toBeInTheDocument()
    expect(named('games.launcher.control.angleUp')).toBeInTheDocument()
    expect(named('games.launcher.control.powerUp')).toBeInTheDocument()
    expect(named('games.launcher.control.fire')).toBeInTheDocument()
  })

  it('fires on a tap — a drag is never the only way to shoot (§1.11)', () => {
    const { emit } = mount()
    fireEvent.click(named('games.launcher.control.fire'))
    expect(emit).toHaveBeenCalledWith('launch')
  })

  it('aims through the steppers with the manifest step, never a hardcoded one', () => {
    const { emit, document } = mount()
    const config = configOf(document)
    fireEvent.click(named('games.launcher.control.angleUp'))
    expect(emit).toHaveBeenCalledWith('aim', {
      x: config.launcher.start_angle + config.launcher.angle_step,
      y: config.launcher.start_power,
    })
    fireEvent.click(named('games.launcher.control.powerDown'))
    expect(emit).toHaveBeenCalledWith('aim', {
      x: config.launcher.start_angle,
      y: config.launcher.start_power - config.launcher.power_step,
    })
  })

  it('still renders and still plays with reduced motion — motion is decorative only', () => {
    const { emit } = mount({ reducedMotion: true })
    fireEvent.click(named('games.launcher.control.fire'))
    expect(emit).toHaveBeenCalledWith('launch')
  })

  it('accepts no input while paused', () => {
    const { emit } = mount({ paused: true })
    fireEvent.click(named('games.launcher.fieldLabel'))
    expect(emit).not.toHaveBeenCalled()
  })

  it('offers the ammo cradle and the movement controls the manifest declares', () => {
    mount({ index: 1 })
    expect(named('games.launcher.cradleLabel')).toBeInTheDocument()
    expect(named('games.launcher.control.moveForward')).toBeInTheDocument()
  })
})

// ---- The slice ---------------------------------------------------------------------------------------

describe('launcher — the registered slice', () => {
  it('exposes the mechanic, its schemas, its sprite slots and its fixtures', () => {
    expect(launcherSlice.mechanic).toBe('launcher')
    expect(launcherSlice.fixtures).toBe(launcherFixtures)
    expect(launcherSlice.spriteSlots).toContain('launcher')
    expect(launcherSlice.spriteSlots).toContain('target_correct')
    expect(launcherSlice.simulator.actions).toEqual(['aim', 'launch', 'move', 'select', 'nudge'])
  })
})

// ---- Aim-event throttling (audit finding) -----------------------------------------
//
// `slingshotAim` used to call `this.bridge.enqueue('aim', …)` on EVERY `pointermove`
// while dragging (the browser's native pointer rate, commonly 60-240Hz), and
// `GameEngineBridge.enqueue` has no dedup of its own — every call is a permanent,
// unbounded append to `inputLog`, risking `log_too_long`/`RESULT_REJECTED` (core/
// replay.ts) for an honest run against the server's `validation.max_events` bound.
//
// The fix's actual decision logic is `nextAimToEnqueue` (scene.ts), extracted to a
// plain, framework-free function specifically so it is directly testable here: this
// project's vitest environment globally stubs the `phaser` module for every test file
// (`src/test-setup.ts`'s `vi.mock('phaser', …)`, wired in via `setupFiles`), so a real
// `Phaser.Scene`/`Phaser.Game` cannot be booted inside a unit test — confirmed no
// sibling mechanic's `scene.ts` has scene-level test coverage for the same reason.
// Testing the exact function `slingshotAim` calls (not a re-implementation of its
// logic) is the honest way to get real regression coverage under that constraint.
describe('launcher — aim-event throttling (nextAimToEnqueue)', () => {
  it('drops a sample that repeats the last quantized aim actually enqueued', () => {
    expect(nextAimToEnqueue({ angle: 45, power: 70 }, 45, 70)).toBeNull()
  })

  it('keeps a sample whenever angle or power actually changes', () => {
    expect(nextAimToEnqueue({ angle: 45, power: 70 }, 50, 70)).toEqual({ angle: 50, power: 70 })
    expect(nextAimToEnqueue({ angle: 45, power: 70 }, 45, 80)).toEqual({ angle: 45, power: 80 })
    expect(nextAimToEnqueue({ angle: 45, power: 70 }, 50, 80)).toEqual({ angle: 50, power: 80 })
  })

  it("always keeps a fresh gesture's first sample, even one that repeats the previous gesture's final aim (the pointerdown reset)", () => {
    // scene.ts resets the tracker to { angle: null, power: null } on pointerdown —
    // this is that reset state. Without it, a second shot aimed identically to the
    // first would silently emit no 'aim' event at all.
    expect(nextAimToEnqueue({ angle: null, power: null }, 45, 70)).toEqual({ angle: 45, power: 70 })
  })

  it(
    'a rapid, jittery stream of quantized samples enqueues a BOUNDED number of aim events — not one per sample — and the last one enqueued is exactly the true final sample (release fidelity)',
    () => {
      // What a real drag's pointermove flood looks like AFTER quantization: the
      // manifest's own discrete angle_step/power_step grid means many consecutive
      // raw samples collapse to the same bucket, with jitter (real touch/mouse input
      // is never perfectly smooth) sometimes revisiting a bucket it already left —
      // exactly the case a one-event-per-pointermove implementation floods on, and
      // exactly the case a naive TIME-based throttle (vs. this value-based one)
      // would not reliably collapse either.
      const SAMPLES = 300
      const quantizedStream: { angle: number; power: number }[] = []
      for (let i = 0; i < SAMPLES; i++) {
        const t = i / SAMPLES
        const angle = 15 + Math.floor(t * 12) * 5 // 12 discrete 5° steps, e.g. angle_step
        // Toggles once every 20 samples (not every sample) — an OCCASIONAL revisit of
        // the previous bucket, the realistic shape of pointer jitter, not a value that
        // never settles for two consecutive samples in a row.
        const jitterBucket = Math.floor(i / 20) % 2
        const power = 30 + (Math.floor(t * 7) + jitterBucket) * 10 // 7 discrete 10% steps + jitter
        quantizedStream.push({ angle, power })
      }

      let last: { angle: number | null; power: number | null } = { angle: null, power: null }
      const enqueued: { angle: number; power: number }[] = []
      for (const sample of quantizedStream) {
        const decision = nextAimToEnqueue(last, sample.angle, sample.power)
        if (decision) {
          enqueued.push(decision)
          last = decision
        }
      }

      expect(enqueued.length).toBeGreaterThan(0)
      // Bounded: nowhere near one-per-sample — the grid this stream sweeps has far
      // fewer than SAMPLES/4 distinct (angle, power) pairs.
      expect(enqueued.length).toBeLessThan(SAMPLES / 4)

      // The dedup guarantee itself: no two CONSECUTIVE enqueued events are identical.
      for (let i = 1; i < enqueued.length; i++) {
        const prev = enqueued[i - 1]!
        const cur = enqueued[i]!
        expect(cur.angle !== prev.angle || cur.power !== prev.power).toBe(true)
      }

      // Release fidelity: the LAST event enqueued is exactly the true final sample —
      // full precision is never lost to the dedup, so `launch` (which reads the
      // state's current angle/power, already updated by the last applied `aim`
      // event — see `applyLaunch`/`applyAim` in simulate.ts) fires with exactly
      // where the drag actually ended.
      const finalSample = quantizedStream[quantizedStream.length - 1]!
      expect(enqueued[enqueued.length - 1]).toEqual(finalSample)
    },
  )
})
