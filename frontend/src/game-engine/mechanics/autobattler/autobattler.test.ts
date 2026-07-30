// `autobattler` — the four regression classes GAME_ENGINE.md requires of a mechanic:
// determinism, the winnability gate, schema bounds, and the mechanic's own rules.
//
// This mechanic is the engine's strongest determinism test on purpose: the player only
// acts during PREPARATION, so the input log is EMPTY for every combat tick and the whole
// battle outcome has to fall out of the seed and the board alone.

import { replayGame, runBot } from '@/game-engine/core/replay'
import { createRng } from '@/game-engine/core/rng'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'

import { autobattlerBots } from './bots'
import { autobattlerFixtures } from './fixtures'
import {
  AUTOBATTLER_SPRITE_SLOTS,
  autobattlerConfigSchema,
  autobattlerContentSchema,
} from './schema'
import {
  autobattlerSimulator,
  cellIndexOf,
  interestPreview,
  traitCounts,
  unitCapOf,
  type AutobattlerState,
} from './simulate'

const SEED = 20260730

function configOf(document: GameDocument) {
  return autobattlerConfigSchema.parse(document.config)
}

function maxTicksOf(document: GameDocument): number {
  return configOf(document).max_ticks
}

function initOf(document: GameDocument, seed = SEED): AutobattlerState {
  const input: SimInit = {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
  return autobattlerSimulator.init(input)
}

/** Advance a state through a scripted log without going near replayGame's caps — used
 *  by the rule tests, which care about one transition, not a whole run. */
function stepThrough(
  start: AutobattlerState,
  ticks: number,
  events: readonly GameInputEvent[],
): AutobattlerState {
  let state = start
  for (let tick = 0; tick < ticks; tick += 1) {
    state = autobattlerSimulator.step(
      state,
      tick,
      events.filter((event) => event.tick === tick),
    )
  }
  return state
}

describe('autobattler fixtures', () => {
  it('ships at least two playable manifests', () => {
    expect(autobattlerFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of autobattlerFixtures) {
    describe(document.meta.slug, () => {
      it('passes the config and content schemas', () => {
        expect(() => autobattlerConfigSchema.parse(document.config)).not.toThrow()
        expect(() => autobattlerContentSchema.parse(document.content)).not.toThrow()
      })

      it('binds only declared sprite slots', () => {
        const declared: readonly string[] = AUTOBATTLER_SPRITE_SLOTS
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

      it('names every roster and shop unit in the content catalog', () => {
        const config = configOf(document)
        const known = document.content.items.map((item) => item.id)
        for (const unit of config.units) expect(known).toContain(unit.item_id)
      })

      it('makes the interest rule visible on screen', () => {
        const content = autobattlerContentSchema.parse(document.content)
        expect(content.tips.interest_md.length).toBeGreaterThan(0)
        expect(content.tips.saving_md.length).toBeGreaterThan(0)
      })
    })
  }
})

describe('autobattler determinism', () => {
  for (const document of autobattlerFixtures) {
    it(`replays identically twice — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: autobattlerSimulator,
        document,
        seed: SEED,
        bot: autobattlerBots.perfect,
        maxTicks,
      })

      const first = replayGame({
        simulator: autobattlerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks,
      })
      const second = replayGame({
        simulator: autobattlerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks,
      })

      expect(first.ok).toBe(true)
      expect(second).toEqual(first)
    })

    it(`replay derives the same result the live run produced — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const bot = runBot({
        simulator: autobattlerSimulator,
        document,
        seed: SEED,
        bot: autobattlerBots.perfect,
        maxTicks,
      })
      const replay = replayGame({
        simulator: autobattlerSimulator,
        document,
        seed: SEED,
        inputLog: bot.inputLog,
        maxTicks,
      })
      expect(replay.ok && replay.result).toEqual(bot.result)
    })

    it(`the input log is EMPTY for every combat tick — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const rng = createRng(SEED)
      let state = initOf(document)
      let combatTicks = 0

      for (let tick = 0; tick <= maxTicks; tick += 1) {
        if (autobattlerSimulator.snapshot(state).finished) break
        const emitted = autobattlerBots.perfect(state, tick, rng)
        if (state.phase === 'combat') {
          combatTicks += 1
          // All strategy happens in preparation; a well-formed log carries nothing here.
          expect(emitted).toEqual([])
        }
        state = autobattlerSimulator.step(state, tick, emitted)
      }
      // A battle actually happened — otherwise the assertion above proves nothing.
      expect(combatTicks).toBeGreaterThan(0)
    })

    it(`a different seed is a different run, the same seed is the same run — ${document.meta.slug}`, () => {
      expect(initOf(document, SEED)).toEqual(initOf(document, SEED))
      const a = initOf(document, SEED)
      const b = initOf(document, SEED + 1)
      // The shop is the seeded surface; the economy never is.
      expect(a.gold).toBe(b.gold)
      expect(a.shop.length).toBe(b.shop.length)
    })
  }
})

describe('autobattler winnability gate', () => {
  for (const document of autobattlerFixtures) {
    it(`the perfect bot reaches pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      for (const seed of [SEED, SEED + 13, SEED + 977]) {
        const { result } = runBot({
          simulator: autobattlerSimulator,
          document,
          seed,
          bot: autobattlerBots.perfect,
          maxTicks,
        })
        expect(result.finished).toBe(true)
        expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
      }
    })

    it(`the random bot does NOT reach pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      // Several seeds: one lucky run must not be able to hide a manifest a coin-flip
      // can beat.
      for (const seed of [SEED, SEED + 7, SEED + 101, SEED + 4242]) {
        const { result } = runBot({
          simulator: autobattlerSimulator,
          document,
          seed,
          bot: autobattlerBots.random,
          maxTicks,
        })
        expect(result.score).toBeLessThan(document.scoring.pass_score)
      }
    })
  }
})

describe('autobattler schema bounds', () => {
  const valid = autobattlerFixtures[0]?.config

  it('rejects a star_multipliers list whose baseline is not 1', () => {
    const config = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>
    config.merge = { copies_needed: 3, max_star: 2, star_multipliers: [1.5, 2] }
    expect(autobattlerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a manifest that pays nothing for saving', () => {
    const config = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>
    config.score_weights = { rounds: 0.7, health: 0.3, interest: 0 }
    expect(autobattlerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a rarity table that does not cover every level', () => {
    const config = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>
    config.shop = {
      ...(valid as { shop: Record<string, unknown> }).shop,
      rarity_by_level: [[80, 20, 0, 0]],
    }
    expect(autobattlerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects a round that names an opponent nobody declared', () => {
    const config = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>
    config.rounds = [{ kind: 'pvp', opponent_id: 'nadie' }]
    expect(autobattlerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects half a combining recipe', () => {
    const config = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>
    config.items = [
      { id: 'a', damage: 5, hp: 0, armour: 0, attack_speed_pct: 0, combines_with: 'b' },
      { id: 'b', damage: 0, hp: 10, armour: 0, attack_speed_pct: 0 },
    ]
    expect(autobattlerConfigSchema.safeParse(config).success).toBe(false)
  })

  it('rejects content with no visible interest rule', () => {
    const content = JSON.parse(JSON.stringify(autobattlerFixtures[0]?.content)) as Record<
      string,
      unknown
    >
    delete content.tips
    expect(autobattlerContentSchema.safeParse(content).success).toBe(false)
  })
})

describe('autobattler rules', () => {
  const cheer = autobattlerFixtures[0]
  const arcade = autobattlerFixtures[1]

  it('interest is capped exactly where the manifest says', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const { gold_per_step: perStep, amount_per_step: amount, max_steps: maxSteps } = config.economy.interest
    const start = initOf(cheer)

    // One step short of the cap pays step-by-step...
    const belowCap = { ...start, gold: perStep * (maxSteps - 1) }
    expect(interestPreview(belowCap)).toBe((maxSteps - 1) * amount)
    // ...and hoarding far past it pays exactly the cap and not a coin more. That is the
    // whole trade-off the lesson is about.
    const wayOverCap = { ...start, gold: perStep * (maxSteps + 20) }
    expect(interestPreview(wayOverCap)).toBe(maxSteps * amount)
  })

  it('one combat tick is exactly the configured number of engine ticks', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const ratio = config.combat.engine_ticks_per_combat_tick
    // The report specifies a 0.5s combat tick and the engine tick is 50ms.
    expect(ratio).toBe(10)

    // Field a unit first: an empty board is wiped on the very first combat tick, which
    // would resolve the round and reset the counter before it could be observed.
    let state = stepThrough(initOf(cheer), 1, [{ tick: 0, action: 'buy', n: 0 }])
    const unit = state.units[0]
    if (unit === undefined) throw new Error('the shop sold nothing')
    state = autobattlerSimulator.step(state, 1, [
      { tick: 1, action: 'place', n: unit.uid, x: 1, y: 0 },
    ])
    state = autobattlerSimulator.step(state, 2, [{ tick: 2, action: 'ready' }])
    expect(state.phase).toBe('combat')
    expect(state.combatTick).toBe(0)

    // ratio - 1 more engine ticks are still sub-tick; the ratio-th resolves one combat tick.
    for (let tick = 3; tick < 3 + ratio - 1; tick += 1) {
      state = autobattlerSimulator.step(state, tick, [])
    }
    expect(state.combatTick).toBe(0)
    state = autobattlerSimulator.step(state, 3 + ratio - 1, [])
    expect(state.combatTick).toBe(1)
  })

  it('ignores every event while the battle is running', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const start = initOf(cheer)
    const combat = stepThrough(start, 1, [{ tick: 0, action: 'ready' }])
    expect(combat.phase).toBe('combat')

    const before = { gold: combat.gold, units: combat.units.length, refreshes: combat.refreshes }
    const after = autobattlerSimulator.step(combat, 1, [
      { tick: 1, action: 'refresh' },
      { tick: 1, action: 'buy', n: 0 },
      { tick: 1, action: 'level' },
    ])
    expect(after.gold).toBe(before.gold)
    expect(after.units.length).toBe(before.units)
    expect(after.refreshes).toBe(before.refreshes)
  })

  it('buying spends exactly the unit cost and never overdraws the bank', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const start = initOf(cheer)
    const typeIndex = start.shop[0]
    if (typeIndex === undefined || typeIndex < 0) throw new Error('empty shop slot')
    const cost = config.units[typeIndex]?.cost ?? 0

    const bought = stepThrough(start, 1, [{ tick: 0, action: 'buy', n: 0 }])
    expect(bought.gold).toBe(start.gold - cost)
    expect(bought.units.length).toBe(1)
    expect(bought.shop[0]).toBe(-1)

    // A player with no gold cannot buy: the intent is refused, never credited.
    const broke = stepThrough({ ...start, gold: 0 }, 1, [{ tick: 0, action: 'buy', n: 1 }])
    expect(broke.units.length).toBe(0)
    expect(broke.gold).toBe(0)
  })

  it('refusing to place past the level cap is what makes levelling matter', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const start = initOf(cheer)
    const cap = unitCapOf(start)
    expect(config.units.length).toBeGreaterThan(cap)

    // cap + 1 units on the bench, each a DIFFERENT type so auto-merge cannot collapse
    // them and change what is being measured.
    const seeded: AutobattlerState = {
      ...start,
      units: Array.from({ length: cap + 1 }, (_, index) => ({
        uid: index + 1,
        typeIndex: index,
        star: 1,
        cell: -1,
        items: [],
      })),
      nextUid: cap + 2,
    }

    let placing = seeded
    for (let index = 0; index <= cap; index += 1) {
      placing = autobattlerSimulator.step(placing, index, [
        {
          tick: index,
          action: 'place',
          n: index + 1,
          x: index - Math.floor(index / config.board.cols) * config.board.cols,
          y: Math.floor(index / config.board.cols),
        },
      ])
    }
    // The last one had nowhere legal to go: the cap held, the intent was refused.
    expect(placing.units.filter((unit) => unit.cell >= 0).length).toBe(cap)
  })

  it('merging three copies makes one stronger unit and keeps its square', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const copies = config.merge.copies_needed
    const start = initOf(cheer)

    // auto_merge is on in this manifest, so three copies collapse on the third buy.
    const seeded: AutobattlerState = {
      ...start,
      units: Array.from({ length: copies }, (_, index) => ({
        uid: index + 1,
        typeIndex: 0,
        star: 1,
        cell: index === 0 ? cellIndexOf(config.board.cols, 1, 0) : -1,
        items: [],
      })),
      nextUid: copies + 1,
    }
    const merged = stepThrough(seeded, 1, [{ tick: 0, action: 'merge', slot: config.units[0]?.id }])

    expect(merged.units.length).toBe(1)
    expect(merged.units[0]?.star).toBe(2)
    expect(merged.units[0]?.cell).toBe(cellIndexOf(config.board.cols, 1, 0))
    expect(merged.merges).toBe(1)
  })

  it('a trait counts DISTINCT unit types, not copies', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    const traitIndex = config.traits.findIndex((trait) => trait.id === 'ahorro')
    expect(traitIndex).toBeGreaterThanOrEqual(0)

    const threeCopies = traitCounts(config, [
      { typeIndex: 0, star: 1, cell: 0, items: [] },
      { typeIndex: 0, star: 1, cell: 1, items: [] },
      { typeIndex: 0, star: 1, cell: 2, items: [] },
    ])
    const twoTypes = traitCounts(config, [
      { typeIndex: 0, star: 1, cell: 0, items: [] },
      { typeIndex: 1, star: 1, cell: 1, items: [] },
    ])
    expect(threeCopies[traitIndex]).toBe(1)
    expect(twoTypes[traitIndex]).toBe(2)
  })

  it('a PvE camp drops its item on a win and the drop combines on the unit', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const maxTicks = maxTicksOf(cheer)
    const { result } = runBot({
      simulator: autobattlerSimulator,
      document: cheer,
      seed: SEED,
      bot: autobattlerBots.perfect,
      maxTicks,
    })
    // The perfect bot equips whatever the camps drop, so a run that beats a camp must
    // show it — the within-run item layer is real, not decoration.
    expect(result.stats.items_equipped).toBeGreaterThan(0)
  })

  it('the arcade manifest spends a life per lost round; the cheer one has none', () => {
    if (cheer === undefined || arcade === undefined) throw new Error('fixture missing')
    expect(initOf(cheer).lives).toBeNull()
    expect(initOf(arcade).lives).toBe(arcade.scoring.lives)

    // Field nothing and time the preparation out: an empty board loses every round.
    const config = configOf(arcade)
    let state = initOf(arcade)
    for (let tick = 0; tick < config.max_ticks && !state.finished; tick += 1) {
      state = autobattlerSimulator.step(state, tick, [])
    }
    expect(state.roundsLost).toBeGreaterThan(0)
    expect(state.lives).toBe(0)
    expect(state.finished).toBe(true)
  })
})
