// `sorter` — the four regression classes GAME_ENGINE.md §14 requires of a mechanic:
// determinism, the winnability gate, schema bounds, and the mechanic's own rules.

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'

import { sorterBots } from './bots'
import { sorterFixtures } from './fixtures'
import { sorterConfigSchema, sorterContentSchema, SORTER_SPRITE_SLOTS } from './schema'
import { sorterSimulator, type SorterState } from './simulate'

const SEED = 20260730

function maxTicksOf(document: GameDocument): number {
  const config = sorterConfigSchema.parse(document.config)
  return config.round.tick_budget
}

function initOf(document: GameDocument, seed = SEED): SorterState {
  const input: SimInit = {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
  return sorterSimulator.init(input)
}

/** Advance a state through a scripted log without going near replayGame's caps —
 *  used by the rule tests, which care about one transition, not a whole run. */
function stepThrough(
  start: SorterState,
  ticks: number,
  events: readonly GameInputEvent[],
): SorterState {
  let state = start
  for (let tick = 0; tick < ticks; tick += 1) {
    state = sorterSimulator.step(
      state,
      tick,
      events.filter((event) => event.tick === tick),
    )
  }
  return state
}

describe('sorter fixtures', () => {
  it('ships at least two playable manifests', () => {
    expect(sorterFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of sorterFixtures) {
    describe(document.meta.slug, () => {
      it('passes the config and content schemas', () => {
        expect(() => sorterConfigSchema.parse(document.config)).not.toThrow()
        expect(() => sorterContentSchema.parse(document.content)).not.toThrow()
      })

      it('binds only declared sprite slots', () => {
        const declared: readonly string[] = SORTER_SPRITE_SLOTS
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

      it('declares as many containers as the config says', () => {
        const config = sorterConfigSchema.parse(document.config)
        expect(document.content.categories?.length).toBe(config.category_count)
      })
    })
  }
})

describe('sorter determinism', () => {
  for (const document of sorterFixtures) {
    it(`replays identically twice — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: sorterSimulator,
        document,
        seed: SEED,
        bot: sorterBots.perfect,
        maxTicks,
      })

      const first = replayGame({ simulator: sorterSimulator, document, seed: SEED, inputLog, maxTicks })
      const second = replayGame({ simulator: sorterSimulator, document, seed: SEED, inputLog, maxTicks })

      expect(first.ok).toBe(true)
      expect(second).toEqual(first)
    })

    it(`replay derives the same result the live run produced — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const bot = runBot({
        simulator: sorterSimulator,
        document,
        seed: SEED,
        bot: sorterBots.perfect,
        maxTicks,
      })
      const replay = replayGame({
        simulator: sorterSimulator,
        document,
        seed: SEED,
        inputLog: bot.inputLog,
        maxTicks,
      })
      expect(replay.ok && replay.result).toEqual(bot.result)
    })

    it(`the seed shuffles the deck and nothing else — ${document.meta.slug}`, () => {
      const idsOf = (state: SorterState) =>
        [
          ...new Set([
            ...state.deck.map((entry) => entry.itemId),
            ...state.active.map((entity) => entity.itemId),
          ]),
        ].sort()
      const authored = document.content.items.map((item) => item.id).sort()
      // Deck + tray together always cover every authored item; only the ORDER moves,
      // so a seed can change what a child sees first but never what exists.
      expect(idsOf(initOf(document, SEED))).toEqual(authored)
      expect(idsOf(initOf(document, SEED + 1))).toEqual(authored)
    })

    it(`the same seed rebuilds the identical opening state — ${document.meta.slug}`, () => {
      expect(initOf(document, SEED)).toEqual(initOf(document, SEED))
    })
  }
})

describe('sorter winnability gate', () => {
  for (const document of sorterFixtures) {
    it(`the perfect bot reaches pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { result } = runBot({
        simulator: sorterSimulator,
        document,
        seed: SEED,
        bot: sorterBots.perfect,
        maxTicks,
      })
      expect(result.finished).toBe(true)
      expect(result.stats.missed).toBe(0)
      expect(result.stats.wrong).toBe(0)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    })

    it(`the random bot does NOT reach pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      // Several seeds: one lucky run must not be able to hide a manifest that a
      // coin-flip can beat.
      for (const seed of [SEED, SEED + 7, SEED + 101, SEED + 4242]) {
        const { result } = runBot({
          simulator: sorterSimulator,
          document,
          seed,
          bot: sorterBots.random,
          maxTicks,
        })
        expect(result.score).toBeLessThan(document.scoring.pass_score)
      }
    })
  }
})

describe('sorter schema bounds', () => {
  const validConfig = sorterFixtures[0]?.config

  it('rejects a category_count above the report ceiling of 8', () => {
    const parsed = sorterConfigSchema.safeParse({ ...validConfig, category_count: 9 })
    expect(parsed.success).toBe(false)
  })

  it('rejects a category_count below 2', () => {
    const parsed = sorterConfigSchema.safeParse({ ...validConfig, category_count: 1 })
    expect(parsed.success).toBe(false)
  })

  it('rejects a static manifest whose elements move', () => {
    const parsed = sorterConfigSchema.safeParse({
      ...validConfig,
      mode: 'static',
      ladder: [
        {
          spawn_interval_ticks: 2,
          fall_speed: 4,
          speed_variance: 0,
          max_active: 4,
          item_tiers: [1],
          points_per_correct: 5,
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a trap with no misconception to teach', () => {
    const parsed = sorterContentSchema.safeParse({
      categories: [
        { id: 'a', label_md: 'A' },
        { id: 'b', label_md: 'B' },
      ],
      items: [
        { id: 'one', label_md: 'Uno', category: 'a' },
        { id: 'two', label_md: 'Dos', category: 'b' },
        { id: 'trap', label_md: 'Trampa' },
      ],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Fin' },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an item pointing at an undeclared container', () => {
    const parsed = sorterContentSchema.safeParse({
      categories: [
        { id: 'a', label_md: 'A' },
        { id: 'b', label_md: 'B' },
      ],
      items: [
        { id: 'one', label_md: 'Uno', category: 'a' },
        { id: 'two', label_md: 'Dos', category: 'zzz' },
      ],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Fin' },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('sorter rules', () => {
  const cheer = sorterFixtures[0]
  const arcade = sorterFixtures[1]

  it('a wrong drop costs exactly what the arcade manifest says', () => {
    if (arcade === undefined) throw new Error('fixture missing')
    const config = sorterConfigSchema.parse(arcade.config)
    const penalty = config.penalty.wrong_drop
    expect(penalty.lives).toBeGreaterThan(0)
    expect(penalty.return_item).toBe(false)

    const start = initOf(arcade)
    const entity = start.active[0]
    if (entity === undefined) throw new Error('initial_fill produced no element')
    // Deliberately the WRONG container: the first declared id that is not its own.
    const wrongSlot = start.categories.find((id) => id !== entity.categoryId)
    if (wrongSlot === undefined) throw new Error('need at least two containers')

    const after = stepThrough(start, 1, [{ tick: 0, action: 'place', slot: wrongSlot, n: entity.uid }])

    expect(after.wrong).toBe(1)
    expect(after.correct).toBe(0)
    expect(after.combo).toBe(0)
    expect(after.lives).toBe((arcade.scoring.lives ?? 0) - penalty.lives)
    // return_item false → the element was consumed, not handed back.
    expect(after.active.some((candidate) => candidate.uid === entity.uid)).toBe(false)
  })

  it('a wrong drop hands the element back in the cheer manifest', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = sorterConfigSchema.parse(cheer.config)
    expect(config.penalty.wrong_drop.return_item).toBe(true)

    const start = initOf(cheer)
    const entity = start.active[0]
    if (entity === undefined) throw new Error('initial_fill produced no element')
    const wrongSlot = start.categories.find((id) => id !== entity.categoryId)
    if (wrongSlot === undefined) throw new Error('need at least two containers')

    const after = stepThrough(start, 1, [{ tick: 0, action: 'place', slot: wrongSlot, n: entity.uid }])

    expect(after.wrong).toBe(1)
    // Cheer mode has no fail state at all.
    expect(after.lives).toBeNull()
    expect(after.active.some((candidate) => candidate.uid === entity.uid)).toBe(true)
  })

  it('a correct placement pays the rung points times the combo multiplier', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = sorterConfigSchema.parse(cheer.config)
    const rung = config.ladder[0]
    if (rung === undefined) throw new Error('empty ladder')

    const start = initOf(cheer)
    const sortable = start.active.filter((entity) => entity.categoryId !== null)
    const first = sortable[0]
    if (first?.categoryId == null) throw new Error('no sortable element in the tray')

    const after = stepThrough(start, 1, [
      { tick: 0, action: 'place', slot: first.categoryId, n: first.uid },
    ])

    expect(after.correct).toBe(1)
    expect(after.combo).toBe(1)
    // First hit of a run is always 1x — the streak BEFORE the hit is 0.
    expect(after.points).toBe(rung.points_per_correct)
  })

  it('ignores a placement naming an undeclared container instead of scoring it', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const start = initOf(cheer)
    const entity = start.active[0]
    if (entity === undefined) throw new Error('initial_fill produced no element')

    const after = stepThrough(start, 1, [
      { tick: 0, action: 'place', slot: 'not-a-container', n: entity.uid },
    ])

    expect(after.wrong).toBe(0)
    expect(after.correct).toBe(0)
    expect(after.active.some((candidate) => candidate.uid === entity.uid)).toBe(true)
  })

  it('removes several elements on the SAME tick in one batch', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const start = initOf(cheer)
    const sortable = start.active.filter((entity) => entity.categoryId !== null).slice(0, 3)
    expect(sortable.length).toBe(3)

    const events: GameInputEvent[] = sortable.map((entity) => ({
      tick: 0,
      action: 'place',
      slot: entity.categoryId ?? '',
      n: entity.uid,
    }))
    const after = stepThrough(start, 1, events)

    expect(after.correct).toBe(3)
    for (const entity of sortable) {
      expect(after.active.some((candidate) => candidate.uid === entity.uid)).toBe(false)
    }
  })

  it('a trap that leaves a falling field is not a miss', () => {
    if (arcade === undefined) throw new Error('fixture missing')
    expect(sorterConfigSchema.parse(arcade.config).mode).toBe('falling')

    // The shipped manifest ends after three misses, which is long before the deck
    // cycles round to a trap — so this variant only removes the life cost, leaving
    // the escape rule itself untouched.
    const document = JSON.parse(JSON.stringify(arcade)) as GameDocument
    const config = sorterConfigSchema.parse(document.config)
    config.penalty.miss.lives = 0
    document.config = config

    // Play out the whole budget doing NOTHING: every real element is missed, every
    // trap is merely avoided, and nothing is ever counted as a mistake.
    let state = initOf(document)
    for (let tick = 0; tick < config.round.tick_budget && !state.finished; tick += 1) {
      state = sorterSimulator.step(state, tick, [])
    }
    expect(state.avoided).toBeGreaterThan(0)
    expect(state.missed).toBeGreaterThan(0)
    expect(state.wrong).toBe(0)
  })

  it('discard is inert when the manifest offers no discard target', () => {
    if (arcade === undefined) throw new Error('fixture missing')
    const start = initOf(arcade)
    const entity = start.active[0]
    if (entity === undefined) throw new Error('initial_fill produced no element')

    const after = stepThrough(start, 1, [{ tick: 0, action: 'discard', n: entity.uid }])

    expect(after.correct).toBe(0)
    expect(after.wrong).toBe(0)
    expect(after.active.some((candidate) => candidate.uid === entity.uid)).toBe(true)
  })
})
