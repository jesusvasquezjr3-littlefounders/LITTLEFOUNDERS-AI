// `defender` — the four regression classes a mechanic owes GAME_ENGINE.md: determinism,
// the §9 winnability gate, schema bounds, and the mechanic's OWN rules (the seal
// rejection, wall redirection, mutually exclusive upgrade branches, the sell refund,
// flying enemies ignoring the labyrinth, and per-tower firing timers).

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'

import { defenderBots } from './bots'
import { defenderFixtures } from './fixtures'
import {
  DEFENDER_SPRITE_SLOTS,
  defenderConfigSchema,
  defenderContentSchema,
  type DefenderConfig,
} from './schema'
import {
  cellCol,
  cellIndex,
  cellRow,
  defenderSimulator,
  TERRAIN_EXIT,
  type DefenderState,
} from './simulate'

const SEED = 20260730

function configOf(document: GameDocument): DefenderConfig {
  return defenderConfigSchema.parse(document.config)
}

function maxTicksOf(document: GameDocument): number {
  return configOf(document).tick_budget
}

function initOf(document: GameDocument, seed = SEED): DefenderState {
  const input: SimInit = {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
  return defenderSimulator.init(input)
}

/** Advance a state through a scripted log without going near replayGame's caps — the
 *  rule tests care about one transition, not a whole run. */
function stepThrough(
  start: DefenderState,
  ticks: number,
  events: readonly GameInputEvent[],
): DefenderState {
  let state = start
  for (let tick = 0; tick < ticks; tick += 1) {
    state = defenderSimulator.step(
      state,
      tick,
      events.filter((event) => event.tick === tick),
    )
  }
  return state
}

/** A deep copy of a fixture with its config replaced — used to isolate ONE rule without
 *  weakening the shipped manifest, and re-parsed so the variant still satisfies the
 *  production schema (/CLAUDE.md §1.14 forbids relaxing it for tests). */
function variantOf(document: GameDocument, mutate: (config: DefenderConfig) => void): GameDocument {
  const clone = JSON.parse(JSON.stringify(document)) as GameDocument
  const config = configOf(clone)
  mutate(config)
  clone.config = defenderConfigSchema.parse(config)
  return clone
}

const piggy = defenderFixtures[0]
const maze = defenderFixtures[1]

if (piggy === undefined || maze === undefined) throw new Error('defender fixtures missing')

// The single-cell corridor in the maze fixture: the ONE placement that seals the board.
const mazeConfig = configOf(maze)
const MAZE_COLS = (mazeConfig.grid.map[0] ?? '').length
const CORRIDOR_COL = 6
const CORRIDOR_ROW = 4

describe('defender fixtures', () => {
  it('ships at least two playable manifests', () => {
    expect(defenderFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of defenderFixtures) {
    describe(document.meta.slug, () => {
      it('passes the config and content schemas', () => {
        expect(() => defenderConfigSchema.parse(document.config)).not.toThrow()
        expect(() => defenderContentSchema.parse(document.content)).not.toThrow()
      })

      it('binds only declared sprite slots', () => {
        const declared: readonly string[] = DEFENDER_SPRITE_SLOTS
        for (const slot of Object.keys(document.skin.sprites)) expect(declared).toContain(slot)
        for (const item of document.content.items) {
          if (item.image_slot !== undefined) expect(declared).toContain(item.image_slot)
        }
        const config = configOf(document)
        for (const enemy of config.enemies) {
          if (enemy.sprite_slot !== undefined) expect(declared).toContain(enemy.sprite_slot)
        }
        for (const tower of config.towers) {
          if (tower.sprite_slot !== undefined) expect(declared).toContain(tower.sprite_slot)
        }
      })

      it('resolves every config → content item reference', () => {
        // The two schemas cannot see each other (config and content are validated by
        // separate schemas), so the cross-reference is proven here and by the pipeline's
        // gate stage — a dangling item_id would render a nameless tower button.
        const config = configOf(document)
        const known = document.content.items.map((item) => item.id)
        for (const enemy of config.enemies) expect(known).toContain(enemy.item_id)
        for (const tower of config.towers) {
          expect(known).toContain(tower.item_id)
          for (const branch of tower.upgrades ?? []) {
            if (branch.item_id !== undefined) expect(known).toContain(branch.item_id)
          }
        }
        for (const ability of config.economy.secondary?.abilities ?? []) {
          if (ability.item_id !== undefined) expect(known).toContain(ability.item_id)
        }
        for (const heat of config.heat ?? []) {
          if (heat.item_id !== undefined) expect(known).toContain(heat.item_id)
        }
      })

      it('opens with a reachable route from every entry to a base', () => {
        const state = initOf(document)
        expect(state.entryCells.length).toBeGreaterThan(0)
        expect(state.exitCells.length).toBeGreaterThan(0)
        for (const entry of state.entryCells) {
          expect(state.dist[entry] ?? -1).toBeGreaterThanOrEqual(0)
        }
      })
    })
  }
})

describe('defender determinism', () => {
  for (const document of defenderFixtures) {
    it(`replays identically twice — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: defenderSimulator,
        document,
        seed: SEED,
        bot: defenderBots.perfect,
        maxTicks,
      })

      const first = replayGame({ simulator: defenderSimulator, document, seed: SEED, inputLog, maxTicks })
      const second = replayGame({ simulator: defenderSimulator, document, seed: SEED, inputLog, maxTicks })

      expect(first.ok).toBe(true)
      expect(second).toEqual(first)
    })

    it(`replay derives the same result the live run produced — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const bot = runBot({
        simulator: defenderSimulator,
        document,
        seed: SEED,
        bot: defenderBots.perfect,
        maxTicks,
      })
      const replay = replayGame({
        simulator: defenderSimulator,
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

    it(`the run is fully scripted: the seed changes nothing — ${document.meta.slug}`, () => {
      // Defender draws no randomness at all (waves, stats and costs are all authored),
      // so two seeds must produce the same world from the same log. If this ever fails,
      // some source of randomness has crept into the reward path.
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: defenderSimulator,
        document,
        seed: SEED,
        bot: defenderBots.perfect,
        maxTicks,
      })
      const a = replayGame({ simulator: defenderSimulator, document, seed: SEED, inputLog, maxTicks })
      const b = replayGame({
        simulator: defenderSimulator,
        document,
        seed: SEED + 9973,
        inputLog,
        maxTicks,
      })
      expect(a.ok && a.result).toEqual(b.ok && b.result)
    })
  }
})

describe('defender winnability gate', () => {
  for (const document of defenderFixtures) {
    it(`the perfect bot reaches pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { result } = runBot({
        simulator: defenderSimulator,
        document,
        seed: SEED,
        bot: defenderBots.perfect,
        maxTicks,
      })
      expect(result.finished).toBe(true)
      expect(result.stats.defeated).toBe(0)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    })

    it(`the random bot does NOT reach pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      // Several seeds: one lucky run must not be able to hide a manifest a coin-flip
      // can beat.
      for (const seed of [SEED, SEED + 7, SEED + 101, SEED + 4242]) {
        const { result } = runBot({
          simulator: defenderSimulator,
          document,
          seed,
          bot: defenderBots.random,
          maxTicks,
        })
        expect(result.score).toBeLessThan(document.scoring.pass_score)
      }
    })
  }
})

describe('defender schema bounds', () => {
  it('rejects a ragged map', () => {
    const parsed = defenderConfigSchema.safeParse(
      variantOf(piggy, (config) => {
        config.grid.map = [...config.grid.map]
      }).config,
    )
    expect(parsed.success).toBe(true)

    const ragged = JSON.parse(JSON.stringify(piggy.config)) as { grid: { map: string[] } }
    ragged.grid.map = ['#####', '#...#', '#..#', '#...#', '#####']
    expect(defenderConfigSchema.safeParse(ragged).success).toBe(false)
  })

  it('rejects a map with no base to defend', () => {
    const noExit = JSON.parse(JSON.stringify(piggy.config)) as { grid: { map: string[] } }
    noExit.grid.map = ['#####', 'S....', '#....', '#....', '#####']
    expect(defenderConfigSchema.safeParse(noExit).success).toBe(false)
  })

  it('rejects a wave that sends an enemy the manifest never declared', () => {
    const broken = JSON.parse(JSON.stringify(piggy.config)) as {
      waves: { groups: { enemy: string }[] }[]
    }
    const group = broken.waves[0]?.groups[0]
    if (group === undefined) throw new Error('fixture has no wave group')
    group.enemy = 'no-such-enemy'
    expect(defenderConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects flying enemies with nothing on the board that can reach them', () => {
    const broken = JSON.parse(JSON.stringify(maze.config)) as {
      towers: { targets_air: boolean }[]
    }
    for (const tower of broken.towers) tower.targets_air = false
    expect(defenderConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a slow cap past the ceiling that keeps enemies moving', () => {
    const broken = JSON.parse(JSON.stringify(piggy.config)) as {
      slow: { max_slow_pct: number }
    }
    broken.slow.max_slow_pct = 95
    expect(defenderConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects an archetype transform on anything but a branch’s final tier', () => {
    const broken = JSON.parse(JSON.stringify(maze.config)) as {
      towers: { upgrades?: { tiers: { transforms_to?: string }[] }[] }[]
    }
    const tier = broken.towers.find((tower) => tower.upgrades !== undefined)?.upgrades?.[0]?.tiers[0]
    if (tier === undefined) throw new Error('fixture has no upgrade branch')
    tier.transforms_to = 'area'
    expect(defenderConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects an enemy that splits into itself', () => {
    const broken = JSON.parse(JSON.stringify(maze.config)) as {
      enemies: { id: string; behavior?: { split?: { into: string; count: number } } }[]
    }
    const enemy = broken.enemies[0]
    if (enemy === undefined) throw new Error('fixture has no enemies')
    enemy.behavior = { split: { into: enemy.id, count: 2 } }
    expect(defenderConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a trap purchase with no misconception to teach', () => {
    const parsed = defenderContentSchema.safeParse({
      items: [
        { id: 'uno', label_md: 'Uno' },
        { id: 'trampa', label_md: 'Trampa', props: { trap: 1 } },
      ],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Fin' },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('defender rules', () => {
  it('refuses a placement that would seal the only corridor, and charges nothing for it', () => {
    const start = initOf(maze)
    const corridor = cellIndex(MAZE_COLS, CORRIDOR_COL, CORRIDOR_ROW)
    // Sanity: the corridor really is the only way through.
    expect(start.terrain[corridor]).not.toBe(TERRAIN_EXIT)
    expect(mazeConfig.build.towers_block_path).toBe(true)

    const after = stepThrough(start, 1, [
      { tick: 0, action: 'build_tower', slot: 'torre-cepo', x: CORRIDOR_COL, y: CORRIDOR_ROW },
    ])

    expect(after.towerAt[corridor]).toBe(0)
    expect(after.towers.length).toBe(0)
    expect(after.gold).toBe(start.gold)
    expect(after.blockedBuilds).toBe(1)
  })

  it('refuses a wall on the corridor for the same reason', () => {
    const start = initOf(maze)
    const corridor = cellIndex(MAZE_COLS, CORRIDOR_COL, CORRIDOR_ROW)
    const after = stepThrough(start, 1, [
      { tick: 0, action: 'build_wall', x: CORRIDOR_COL, y: CORRIDOR_ROW },
    ])

    expect(after.wallAt[corridor]).toBe(0)
    expect(after.gold).toBe(start.gold)
    expect(after.wallsBuilt).toBe(0)
    expect(after.blockedBuilds).toBe(1)
  })

  it('a legal wall REDIRECTS the flow instead of stopping it: the route gets longer', () => {
    const start = initOf(maze)
    const entry = start.entryCells[0]
    if (entry === undefined) throw new Error('no entry cell')
    const before = start.dist[entry] ?? -1
    expect(before).toBeGreaterThan(0)

    // One cell along the straight line, inside the left chamber: enemies must now walk
    // around it, which is exactly the labyrinth the mechanic is about.
    const after = stepThrough(start, 1, [{ tick: 0, action: 'build_wall', x: 3, y: 4 }])
    const now = after.dist[entry] ?? -1

    expect(after.wallsBuilt).toBe(1)
    expect(now).toBeGreaterThan(before)
    expect(now).toBeGreaterThanOrEqual(0)
    expect(after.gold).toBe(start.gold - mazeConfig.build.wall_cost)
  })

  it('upgrade branches are MUTUALLY EXCLUSIVE once a tower has committed to one', () => {
    const towerType = mazeConfig.towers.find((tower) => (tower.upgrades ?? []).length >= 2)
    const branches = towerType?.upgrades
    const first = branches?.[0]
    const second = branches?.[1]
    if (towerType === undefined || first === undefined || second === undefined) {
      throw new Error('fixture has no two-branch tower')
    }

    // A free cell well away from the corridor, so nothing here is about sealing.
    const built = stepThrough(initOf(maze), 1, [
      { tick: 0, action: 'build_tower', slot: towerType.id, x: 2, y: 2 },
    ])
    expect(built.towers.length).toBe(1)

    const committed = stepThrough(built, 1, [
      { tick: 0, action: 'upgrade', slot: first.id, x: 2, y: 2 },
    ])
    const upgraded = committed.towers[0]
    if (upgraded === undefined) throw new Error('tower vanished')
    expect(upgraded.branchId).toBe(first.id)
    expect(upgraded.branchTier).toBe(1)

    const refused = stepThrough(committed, 1, [
      { tick: 0, action: 'upgrade', slot: second.id, x: 2, y: 2 },
    ])
    const after = refused.towers[0]
    if (after === undefined) throw new Error('tower vanished')
    expect(after.branchId).toBe(first.id)
    expect(after.branchTier).toBe(1)
    expect(refused.gold).toBe(committed.gold)
  })

  it('selling refunds exactly the configured percentage of what was invested', () => {
    const towerType = mazeConfig.towers[0]
    if (towerType === undefined) throw new Error('fixture has no towers')
    const start = initOf(maze)
    const built = stepThrough(start, 1, [
      { tick: 0, action: 'build_tower', slot: towerType.id, x: 2, y: 2 },
    ])
    expect(built.gold).toBe(start.gold - towerType.cost)

    const sold = stepThrough(built, 1, [{ tick: 0, action: 'sell', x: 2, y: 2 }])
    const refund = Math.floor((towerType.cost * mazeConfig.build.sell_refund_pct) / 100)
    expect(sold.towers.length).toBe(0)
    expect(sold.gold).toBe(built.gold + refund)
  })

  it('a flying enemy ignores the grid entirely and arrives on the straight line', () => {
    // Wave 1 becomes one flyer and one walker, released together with no prep time. The
    // flyer's route is the diagonal; the walker's is the corridor, which costs twice as
    // much ground per cell — so the flyer must arrive first, by construction.
    const document = variantOf(maze, (config) => {
      config.prep_ticks = 0
      config.waves = [
        {
          id: 'prueba-vuelo',
          groups: [
            { enemy: 'compra-impulsiva', count: 1, interval_ticks: 1, start_tick: 0, entry: 0 },
            { enemy: 'gasto-chico', count: 1, interval_ticks: 1, start_tick: 0, entry: 0 },
          ],
          bonus_gold: 0,
        },
      ]
    })

    const state = stepThrough(initOf(document), 90, [])
    expect(state.leaked).toBe(1)
    expect(state.enemies.length).toBe(1)
    const survivor = state.enemies[0]
    if (survivor === undefined) throw new Error('the walker vanished')
    expect(survivor.flying).toBe(false)
  })

  it('every tower keeps its OWN firing timer — two towers kill faster than one', () => {
    // The v1 defect this guards: one shared cooldown accumulator that N entities each
    // decrement, so N towers fired at N times the authored rate (or, in the mirror-image
    // bug, only one of them ever fired at all).
    const document = variantOf(piggy, (config) => {
      config.prep_ticks = 0
      config.waves = [
        {
          id: 'una-sola',
          groups: [{ enemy: 'gasto-hormiga', count: 1, interval_ticks: 1, start_tick: 0, entry: 0 }],
          bonus_gold: 0,
        },
      ]
    })

    const killTick = (builds: readonly GameInputEvent[]): number => {
      let state = stepThrough(initOf(document), 1, builds)
      expect(state.towers.length).toBe(builds.length)
      for (let tick = 1; tick < 400; tick += 1) {
        state = defenderSimulator.step(state, tick, [])
        if (state.killed > 0) return tick
      }
      return -1
    }

    // Two pockets covering the same stretch of road, versus only the first of them.
    const one = killTick([{ tick: 0, action: 'build_tower', slot: 'torre-ahorro', x: 3, y: 2 }])
    const two = killTick([
      { tick: 0, action: 'build_tower', slot: 'torre-ahorro', x: 3, y: 2 },
      { tick: 0, action: 'build_tower', slot: 'torre-ahorro', x: 3, y: 4 },
    ])

    expect(one).toBeGreaterThan(0)
    expect(two).toBeGreaterThan(0)
    expect(two).toBeLessThan(one)
  })

  it('interest pays out on the gold still in hand when a wave clears', () => {
    // The learning binding, as an assertion: two identical boards, one that spent its
    // gold on a tower and one that kept it, and the saver ends the wave ahead of what a
    // bare refund would have returned.
    const document = variantOf(piggy, (config) => {
      config.prep_ticks = 0
      config.waves = [
        {
          id: 'una-sola',
          groups: [{ enemy: 'gasto-hormiga', count: 1, interval_ticks: 1, start_tick: 0, entry: 0 }],
          bonus_gold: 0,
        },
      ]
      config.tick_budget = 600
    })
    const config = configOf(document)

    let state = initOf(document)
    for (let tick = 0; tick < 600 && !state.finished; tick += 1) {
      state = defenderSimulator.step(state, tick, [])
    }
    expect(state.wavesCleared).toBe(1)

    // Starting gold + the enemy's leak (no towers were built, so it reached the base)
    // pays no bounty; what is left is the wave bonus plus interest on the balance.
    const beforeInterest = config.economy.starting_gold + config.economy.wave_clear_bonus
    const interest = Math.min(
      config.economy.interest_cap,
      Math.floor((beforeInterest * config.economy.interest_pct) / 100),
    )
    expect(interest).toBeGreaterThan(0)
    expect(state.gold).toBe(beforeInterest + interest)
  })

  it('addresses cells the same way the view does', () => {
    // The view converts a cell index back into (col, row) to place a button, and the
    // simulator converts (x, y) from the log into a cell index. A disagreement here
    // would mean a child taps one square and builds on another.
    const state = initOf(maze)
    for (let cell = 0; cell < state.cols * state.rows; cell += 1) {
      expect(cellIndex(state.cols, cellCol(state.cols, cell), cellRow(state.cols, cell))).toBe(cell)
    }
  })
})
