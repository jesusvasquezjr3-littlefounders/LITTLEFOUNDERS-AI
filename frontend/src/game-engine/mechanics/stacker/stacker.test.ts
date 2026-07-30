// `stacker` — the four regression classes a mechanic owes (GAME_ENGINE.md §5, §7, §9):
// determinism, the winnability gate, schema bounds, and the mechanic's OWN rules —
// here the collapse criterion, the economy, the announced force timeline, the score
// model switch and adaptive assistance.

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'

import { stackerFixtures } from './fixtures'
import {
  costOfPiece,
  stackerConfigSchema,
  stackerContentSchema,
  STACKER_SPRITE_SLOTS,
} from './schema'
import {
  assistActive,
  budgetLeft,
  forcesAt,
  heightOf,
  scoreOf,
  stackerSimulator,
  type StackerState,
} from './simulate'

const SEED = 20260730

function maxTicksOf(document: GameDocument): number {
  return stackerConfigSchema.parse(document.config).round.tick_budget
}

function initOf(document: GameDocument, seed = SEED): StackerState {
  const input: SimInit = {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
  return stackerSimulator.init(input)
}

/** Advance a state through a scripted log without going near replayGame's caps — used
 *  by the rule tests, which care about one transition, not a whole run. */
function stepThrough(
  start: StackerState,
  ticks: number,
  events: readonly GameInputEvent[],
): StackerState {
  let state = start
  for (let tick = 0; tick < ticks; tick += 1) {
    state = stackerSimulator.step(
      state,
      tick,
      events.filter((event) => event.tick === tick),
    )
  }
  return state
}

describe('stacker fixtures', () => {
  it('ships at least two playable manifests', () => {
    expect(stackerFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of stackerFixtures) {
    describe(document.meta.slug, () => {
      it('passes the config and content schemas', () => {
        expect(() => stackerConfigSchema.parse(document.config)).not.toThrow()
        expect(() => stackerContentSchema.parse(document.content)).not.toThrow()
      })

      it('binds only declared sprite slots', () => {
        const declared: readonly string[] = STACKER_SPRITE_SLOTS
        for (const slot of Object.keys(document.skin.sprites)) {
          expect(declared).toContain(slot)
        }
        for (const item of document.content.items) {
          if (item.image_slot !== undefined) expect(declared).toContain(item.image_slot)
        }
        for (const category of document.content.categories ?? []) {
          if (category.image_slot !== undefined) expect(declared).toContain(category.image_slot)
        }
      })

      it('every catalogue piece names a real content item', () => {
        const config = stackerConfigSchema.parse(document.config)
        const ids = document.content.items.map((item) => item.id)
        for (const piece of config.catalog) expect(ids).toContain(piece.item_id)
      })

      it('the whole catalogue fits inside the budget ceiling it declares', () => {
        const config = stackerConfigSchema.parse(document.config)
        for (const piece of config.catalog) {
          expect(costOfPiece(config, piece)).toBeLessThanOrEqual(config.economy.budget)
        }
      })
    })
  }
})

describe('stacker determinism', () => {
  for (const document of stackerFixtures) {
    it(`replays identically twice — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: stackerSimulator,
        document,
        seed: SEED,
        bot: stackerSimulator.bots.perfect,
        maxTicks,
      })

      const first = replayGame({ simulator: stackerSimulator, document, seed: SEED, inputLog, maxTicks })
      const second = replayGame({ simulator: stackerSimulator, document, seed: SEED, inputLog, maxTicks })

      expect(first.ok).toBe(true)
      expect(second).toEqual(first)
    })

    it(`replay derives the same result the live run produced — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const bot = runBot({
        simulator: stackerSimulator,
        document,
        seed: SEED,
        bot: stackerSimulator.bots.perfect,
        maxTicks,
      })
      const replay = replayGame({
        simulator: stackerSimulator,
        document,
        seed: SEED,
        inputLog: bot.inputLog,
        maxTicks,
      })
      expect(replay.ok && replay.result).toEqual(bot.result)
    })

    it(`the same seed rebuilds the identical opening state — ${document.meta.slug}`, () => {
      expect(initOf(document, SEED)).toEqual(initOf(document, SEED))
    })

    it(`the seed moves the gusts and nothing else — ${document.meta.slug}`, () => {
      const a = initOf(document, SEED)
      const b = initOf(document, SEED + 1)
      // A different seed may only change the disturbance magnitudes; the catalogue, the
      // budget and the geometry are the manifest's, not the run's.
      expect({ ...a, gusts: [], seed: 0 }).toEqual({ ...b, gusts: [], seed: 0 })
      expect(a.gusts.length).toBe(stackerConfigSchema.parse(document.config).timeline.events.length)
    })
  }
})

describe('stacker winnability gate', () => {
  for (const document of stackerFixtures) {
    it(`the perfect bot reaches pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { result } = runBot({
        simulator: stackerSimulator,
        document,
        seed: SEED,
        bot: stackerSimulator.bots.perfect,
        maxTicks,
      })
      expect(result.finished).toBe(true)
      expect(result.stats.collapses).toBe(0)
      expect(result.stats.won).toBe(1)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    })

    it(`the random bot does NOT reach pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      // Several seeds: one lucky run must not be able to hide a manifest that careless
      // play can beat.
      for (const seed of [SEED, SEED + 7, SEED + 101, SEED + 4242]) {
        const { result } = runBot({
          simulator: stackerSimulator,
          document,
          seed,
          bot: stackerSimulator.bots.random,
          maxTicks,
        })
        expect(result.score).toBeLessThan(document.scoring.pass_score)
      }
    })
  }
})

describe('stacker schema bounds', () => {
  const validConfig = stackerConfigSchema.parse(stackerFixtures[0]?.config)

  it('rejects a solver with zero contact iterations', () => {
    const parsed = stackerConfigSchema.safeParse({
      ...validConfig,
      solver: { ...validConfig.solver, iterations: 0 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a baseline drawn ABOVE the base surface', () => {
    const parsed = stackerConfigSchema.safeParse({
      ...validConfig,
      field: { ...validConfig.field, baseline_y: validConfig.field.ground_y - 10 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an ease_factor below the 0.5 floor', () => {
    const parsed = stackerConfigSchema.safeParse({
      ...validConfig,
      assist: { ...validConfig.assist, ease_factor: 0.2 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an oscillating disturbance with no period', () => {
    const parsed = stackerConfigSchema.safeParse({
      ...validConfig,
      timeline: {
        ...validConfig.timeline,
        events: [{ id: 'temblor', at_tick: 10, kind: 'earthquake', magnitude: 4, duration_ticks: 40 }],
      },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a margin cap below the margin the document requires', () => {
    const parsed = stackerConfigSchema.safeParse({
      ...validConfig,
      stability: { ...validConfig.stability, margin_threshold: 4, margin_cap: 2 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a piece to avoid that teaches nothing', () => {
    const parsed = stackerContentSchema.safeParse({
      items: [
        { id: 'buena', label_md: 'Buena' },
        { id: 'mala', label_md: 'Mala' },
      ],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Fin' },
      roles: { foundation: ['buena'], avoid: ['mala'] },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('stacker rules', () => {
  const cheer = stackerFixtures[0]
  const arcade = stackerFixtures[1]

  function requireCheer(): GameDocument {
    if (cheer === undefined) throw new Error('fixture missing')
    return cheer
  }
  function requireArcade(): GameDocument {
    if (arcade === undefined) throw new Error('fixture missing')
    return arcade
  }

  it('a placement charges exactly the price the catalogue quotes', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')

    const after = stepThrough(initOf(document), 1, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 0 },
    ])

    expect(after.bodies.length).toBe(1)
    expect(after.spent).toBe(costOfPiece(config, piece))
    expect(budgetLeft(after)).toBe(config.economy.budget - costOfPiece(config, piece))
  })

  it('refuses a placement the budget cannot pay for', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')
    const broke: GameDocument = {
      ...document,
      config: { ...config, economy: { ...config.economy, budget: costOfPiece(config, piece) - 1 } },
    }

    const after = stepThrough(initOf(broke), 1, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 0 },
    ])

    expect(after.bodies.length).toBe(0)
    expect(after.spent).toBe(0)
  })

  it('refunds exactly refund_pct of what a removed piece cost', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')
    const cost = costOfPiece(config, piece)

    const after = stepThrough(initOf(document), 2, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 0 },
      { tick: 1, action: 'remove', n: 1 },
    ])

    expect(after.bodies.length).toBe(0)
    expect(after.removals).toBe(1)
    expect(after.refunded).toBe(Math.round((cost * config.economy.refund_pct) / 100))
    // A partial refund, never a full one: the report's rule, and the reason a child
    // learns to think before buying rather than to churn.
    expect(after.refunded).toBeLessThan(cost)
  })

  it('charges the reposition cost the tier-3 manifest declares, and nothing in tier 1', () => {
    const tier3 = requireArcade()
    const tier3Config = stackerConfigSchema.parse(tier3.config)
    const piece3 = tier3Config.catalog[0]
    if (piece3 === undefined) throw new Error('empty catalog')
    expect(tier3Config.economy.reposition_cost).toBeGreaterThan(0)

    const movedArcade = stepThrough(initOf(tier3), 2, [
      { tick: 0, action: 'place', slot: piece3.item_id, x: tier3Config.field.base_x, n: 0 },
      { tick: 1, action: 'move', n: 1, x: tier3Config.field.base_x + 40 },
    ])
    expect(movedArcade.repositions).toBe(1)
    expect(movedArcade.spent).toBe(
      costOfPiece(tier3Config, piece3) + tier3Config.economy.reposition_cost,
    )

    const tier1 = requireCheer()
    const tier1Config = stackerConfigSchema.parse(tier1.config)
    const piece1 = tier1Config.catalog[0]
    if (piece1 === undefined) throw new Error('empty catalog')
    expect(tier1Config.economy.reposition_cost).toBe(0)

    const movedCheer = stepThrough(initOf(tier1), 2, [
      { tick: 0, action: 'place', slot: piece1.item_id, x: tier1Config.field.base_x, n: 0 },
      { tick: 1, action: 'move', n: 1, x: tier1Config.field.base_x + 30 },
    ])
    expect(movedCheer.repositions).toBe(1)
    expect(movedCheer.spent).toBe(costOfPiece(tier1Config, piece1))
  })

  it('honours the unlock ladder: a locked piece cannot be placed yet', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    const locked = config.catalog.find((piece) => piece.unlock_after_pieces > 0)
    if (locked === undefined) throw new Error('this fixture declares no unlock ladder')

    const after = stepThrough(initOf(document), 1, [
      { tick: 0, action: 'place', slot: locked.item_id, x: config.field.base_x, n: 0 },
    ])
    expect(after.bodies.length).toBe(0)
  })

  it('step rotation swaps a box, and only on an odd step', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    expect(config.placement.rotation_steps).toBe(4)
    const piece = config.catalog.find((entry) => entry.shape === 'box' && entry.w !== entry.h)
    if (piece === undefined) throw new Error('need a non-square box to rotate')

    const upright = stepThrough(initOf(document), 1, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 0 },
    ])
    const turned = stepThrough(initOf(document), 1, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 1 },
    ])

    expect(upright.bodies[0]?.w).toBe(piece.w)
    expect(upright.bodies[0]?.h).toBe(piece.h)
    expect(turned.bodies[0]?.w).toBe(piece.h)
    expect(turned.bodies[0]?.h).toBe(piece.w)
  })

  it('a piece placed off the base falls past the baseline and collapses the attempt', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')

    // Far outside the platform: nothing holds it, so it drops through the baseline —
    // collapse criterion (a).
    const after = stepThrough(initOf(document), 200, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.width - 10, n: 0 },
    ])

    expect(after.collapses).toBeGreaterThanOrEqual(1)
    expect(after.bodies.length).toBe(0)
    // Cheer mode has no fail state: the attempt restarts instead of ending.
    expect(after.lives).toBeNull()
    expect(after.phase).toBe('build')
  })

  it('a collapse costs a life in arcade mode and refunds part of the spend', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')
    const cost = costOfPiece(config, piece)

    const after = stepThrough(initOf(document), 300, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.width - 10, n: 0 },
    ])

    expect(after.collapses).toBeGreaterThanOrEqual(1)
    expect(after.lives).toBe((document.scoring.lives ?? 0) - after.collapses)
    expect(after.refunded).toBe(Math.round((cost * config.economy.collapse_refund_pct) / 100))
  })

  it('the announced timeline only runs in the test phase, and each event on its own clock', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    const first = config.timeline.events[0]
    if (first === undefined) throw new Error('this fixture declares no timeline')

    const building = initOf(document)
    expect(forcesAt(building, 999).any).toBe(false)

    const testing: StackerState = { ...building, phase: 'test', testStartTick: 0 }
    expect(forcesAt(testing, first.at_tick - 1).any).toBe(false)
    expect(forcesAt(testing, first.at_tick).any).toBe(true)
    expect(forcesAt(testing, first.at_tick + first.duration_ticks).any).toBe(false)
  })

  it('adaptive assistance needs the manifest, the player AND a real failure', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    expect(config.assist.enabled).toBe(true)
    expect(config.assist.ease_after_failures).toBeGreaterThan(0)

    const fresh = initOf(document)
    const asked: StackerState = { ...fresh, assistOn: true }
    // Asked for, but nothing has gone wrong yet: help a child has not needed is not
    // assistance, it is a difficulty cut nobody chose.
    expect(assistActive(asked)).toBe(false)

    const struggled: StackerState = { ...asked, collapses: config.assist.ease_after_failures }
    expect(assistActive(struggled)).toBe(true)

    // Declining puts the full force back — `assist_toggleable` is literal `true`.
    expect(assistActive({ ...struggled, assistOn: false })).toBe(false)
  })

  it('assistance scales every disturbance by exactly ease_factor', () => {
    const document = requireArcade()
    const config = stackerConfigSchema.parse(document.config)
    const wind = config.timeline.events.find((event) => event.kind === 'wind')
    if (wind === undefined) throw new Error('this fixture declares no wind')

    const base: StackerState = {
      ...initOf(document),
      phase: 'test',
      testStartTick: 0,
      collapses: config.assist.ease_after_failures,
    }
    const full = forcesAt({ ...base, assistOn: false }, wind.at_tick)
    const eased = forcesAt({ ...base, assistOn: true }, wind.at_tick)

    expect(full.pressureX).not.toBe(0)
    expect(eased.pressureX).toBeCloseTo(full.pressureX * config.assist.ease_factor, 10)
  })

  it('the score model is a manifest decision, and the product model is the stricter one', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    expect(config.score_model).toBe('blend')

    // One state, two models: a run that met its height and margin but spent most of the
    // budget. `blend` averages the weak efficiency away; `product` multiplies by it.
    const state: StackerState = {
      ...initOf(document),
      placements: 4,
      spent: Math.round(config.economy.budget * 0.8),
      maxHeight: config.stability.target_height,
      testTicks: 10,
      minTestMargin: config.stability.margin_threshold,
      bestHold: config.stability.hold_ticks,
    }
    const blended = scoreOf(state)
    const multiplied = scoreOf({ ...state, config: { ...config, score_model: 'product' } })

    expect(blended).toBeGreaterThan(multiplied)
  })

  it('rain lands on the roof and lowers the margin instead of raising it', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const rain = config.timeline.events.find((event) => event.kind === 'rain')
    if (rain === undefined) throw new Error('this fixture declares no rain')

    const testing: StackerState = { ...initOf(document), phase: 'test', testStartTick: 0 }
    expect(forcesAt(testing, rain.at_tick).rainMass).toBeGreaterThan(0)
    // Mass, not pressure: rain is a load, and a load on the roof raises the centre of
    // mass, which is exactly why a soaked tower topples in a wind it survived dry.
    expect(forcesAt(testing, rain.at_tick).pressureX).toBe(0)
  })

  it('the hold clock refuses to run for a structure that never reached the target', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const piece = config.catalog[0]
    if (piece === undefined) throw new Error('empty catalog')

    // One low brick: perfectly stable, and not the structure the challenge asked for.
    const after = stepThrough(initOf(document), 400, [
      { tick: 0, action: 'place', slot: piece.item_id, x: config.field.base_x, n: 0 },
      { tick: 1, action: 'ready' },
    ])

    expect(after.phase).toBe('test')
    expect(heightOf(after)).toBeLessThan(config.stability.target_height)
    expect(after.bestHold).toBe(0)
    expect(after.testTicks).toBe(0)
    expect(after.won).toBe(false)
  })

  it('resolves several placements landing on the SAME tick in one batch', () => {
    const document = requireCheer()
    const config = stackerConfigSchema.parse(document.config)
    const first = config.catalog[0]
    const second = config.catalog[1]
    if (first === undefined || second === undefined) throw new Error('need two pieces')

    const after = stepThrough(initOf(document), 1, [
      { tick: 0, action: 'place', slot: first.item_id, x: config.field.base_x, n: 0 },
      { tick: 0, action: 'place', slot: second.item_id, x: config.field.base_x, n: 0 },
    ])

    expect(after.bodies.length).toBe(2)
    expect(after.spent).toBe(costOfPiece(config, first) + costOfPiece(config, second))
  })
})
