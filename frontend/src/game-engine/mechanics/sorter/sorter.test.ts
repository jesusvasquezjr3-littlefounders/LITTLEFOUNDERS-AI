// `sorter` — the four regression classes GAME_ENGINE.md §14 requires of a mechanic:
// determinism, the winnability gate, schema bounds, and the mechanic's own rules —
// plus the Phaser-scene input/label regression classes the mechanic-pass audit added
// (label_md resolution, the keyboard path, and the NON-static tap alternative).

import Phaser from 'phaser'
import { vi } from 'vitest'

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, GameInputEvent, SimInit } from '@/game-engine/core/types'

import { sorterBots } from './bots'
import { sorterFixtures } from './fixtures'
import { sorterConfigSchema, sorterContentSchema, SORTER_SPRITE_SLOTS } from './schema'
import {
  resolveLabel,
  cycleFocusIndex,
  resolvePlacementEvent,
  SorterScene,
  TRASH_BIN_ID,
  type BinView,
  type ItemView,
} from './scene'
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

// ---- Scene-layer regressions (mechanic-pass audit: label_md, keyboard, tap alt) ----
//
// `SorterScene` extends `Phaser.Scene`, whose real `this.add`/`this.tweens`/`this.input`
// only exist once a scene is added to a booted `Phaser.Game` — and a real boot needs a
// canvas/WebGL context jsdom does not provide (confirmed: `game.scene` stays undefined
// and 'ready' never fires under jsdom in this repo's vitest environment). Rather than
// fight that, these tests exercise the REAL prototype methods (not a reimplementation)
// against a minimal fake `this` built with `Object.create(SorterScene.prototype)`: the
// private fields the tested methods actually read (`itemViews`, `binViews`, `bridge`,
// `tweens`, `strings`, `_paused`) are set directly as own properties, and everything
// else the class does NOT touch for these code paths (`this.add`, `this.cameras`, …) is
// simply never present — a call would throw immediately if a method under test reached
// for something outside this documented surface, which is itself a useful guard.

interface FakeBridge {
  enqueue: ReturnType<typeof vi.fn>
  state: SorterState
  finished: boolean
}

/** The exact private surface `onPointerDown`/`onPointerMove`/`onPointerUp`/
 *  `handleKeyDown`/`commitPlace` read or write — typed by hand (never `SorterScene`
 *  itself, whose members are `private`) so the fake only has to satisfy this shape,
 *  not the whole class. */
interface TestableScene {
  itemViews: Map<number, ItemView>
  binViews: Map<string, BinView>
  trashView: BinView | null
  selectedItem: ItemView | null
  dragItem: ItemView | null
  kbFocusUid: number | null
  kbFocusBinId: string | null
  binGlowTarget: BinView | null
  dragStartX: number
  dragStartY: number
  dragMoved: boolean
  dragOffsetX: number
  dragOffsetY: number
  strings: Record<string, string>
  tweens: { add: (...args: unknown[]) => unknown; killTweensOf: (...args: unknown[]) => unknown }
  bridge: FakeBridge
  _paused: boolean
  onPointerDown(pointer: { x: number; y: number; worldX?: number; worldY?: number }): void
  onPointerMove(pointer: { x: number; y: number; worldX?: number; worldY?: number }): void
  onPointerUp(pointer: { x: number; y: number; worldX?: number; worldY?: number }): void
  handleKeyDown(event: { key: string }): void
  commitPlace(uid: number, binId: string): void
}

function fakeContainer(x: number, y: number): Phaser.GameObjects.Container {
  const box = {
    x,
    y,
    setDepth: () => box,
  }
  return box as unknown as Phaser.GameObjects.Container
}

function fakeBinContainer(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const box = {
    x,
    y,
    setDepth: () => box,
    getBounds: () => ({
      contains: (px: number, py: number) =>
        px >= x - w / 2 && px <= x + w / 2 && py >= y - h / 2 && py <= y + h / 2,
    }),
  }
  return box as unknown as Phaser.GameObjects.Container
}

/** Places item `uid`'s hit-box centred at `(40 * uid, 40)` and bin `index`'s at
 *  `(300 * (index + 1), 500)` — arbitrary but WIDELY separated and derived only from
 *  identity (never a magic literal a test has to keep in sync by hand), so every
 *  test below can address a specific item/bin by id without any geometry guesswork. */
function itemPosition(uid: number): { x: number; y: number } {
  return { x: 40 * uid, y: 40 }
}
function binPosition(index: number): { x: number; y: number } {
  return { x: 300 * (index + 1), y: 500 }
}

function makeFakeScene(state: SorterState, strings: Record<string, string> = {}): TestableScene {
  const fake = Object.create(SorterScene.prototype) as TestableScene
  fake.itemViews = new Map()
  fake.binViews = new Map()
  fake.trashView = null
  fake.selectedItem = null
  fake.dragItem = null
  fake.kbFocusUid = null
  fake.kbFocusBinId = null
  fake.binGlowTarget = null
  fake.dragStartX = 0
  fake.dragStartY = 0
  fake.dragMoved = false
  fake.dragOffsetX = 0
  fake.dragOffsetY = 0
  fake.strings = strings
  fake.tweens = { add: () => undefined, killTweensOf: () => undefined }
  fake.bridge = { enqueue: vi.fn(), state, finished: false }
  fake._paused = false

  for (const entity of state.active) {
    const pos = itemPosition(entity.uid)
    fake.itemViews.set(entity.uid, {
      entity,
      container: fakeContainer(pos.x, pos.y),
      rect: {} as unknown as Phaser.GameObjects.Image,
      label: {} as unknown as Phaser.GameObjects.Text,
      tierColor: 0,
      uid: entity.uid,
    })
  }

  state.categories.forEach((categoryId, index) => {
    const pos = binPosition(index)
    fake.binViews.set(categoryId, {
      categoryId,
      container: fakeBinContainer(pos.x, pos.y, 80, 80),
      rect: {} as unknown as Phaser.GameObjects.Image,
      label: {} as unknown as Phaser.GameObjects.Text,
      glow: {} as unknown as Phaser.GameObjects.Rectangle,
    })
  })

  if (state.config.trash_zone) {
    const pos = binPosition(state.categories.length)
    fake.trashView = {
      categoryId: TRASH_BIN_ID,
      container: fakeBinContainer(pos.x, pos.y, 80, 80),
      rect: {} as unknown as Phaser.GameObjects.Image,
      label: {} as unknown as Phaser.GameObjects.Text,
      glow: {} as unknown as Phaser.GameObjects.Rectangle,
    }
  }

  return fake
}

/** A single-item, single-category, NON-static (falling) synthetic state — deliberately
 *  hand-built rather than drawn from `sorterSimulator.init()`'s seeded shuffle, so
 *  which item exists and what it belongs to is a fixed fact the test asserts against,
 *  never a seed-dependent draw. */
function makeFallingSingleItemState(uid: number, categoryId: string): SorterState {
  const arcade = sorterFixtures[1]
  if (arcade === undefined) throw new Error('fixture missing')
  const config = sorterConfigSchema.parse(arcade.config)
  if (config.mode !== 'falling') throw new Error('expected the falling fixture')

  return {
    config,
    categories: [categoryId, 'other-category'],
    deck: [],
    seed: 1,
    active: [
      {
        uid,
        itemId: `item-${uid}`,
        categoryId,
        tier: 1,
        x: 0,
        y: 0,
        speed: config.ladder[0]?.fall_speed ?? 0,
        spawnedAt: 0,
      },
    ],
    nextUid: uid + 1,
    nextSpawnTick: 0,
    ticks: 0,
    correct: 0,
    wrong: 0,
    missed: 0,
    avoided: 0,
    combo: 0,
    bestCombo: 0,
    points: 0,
    lives: 3,
    finished: false,
  }
}

describe('sorter scene: label_md resolution', () => {
  it('resolves a known item id to its declared label_md', () => {
    const document = sorterFixtures[0]
    if (document === undefined) throw new Error('fixture missing')
    const itemsById = new Map(document.content.items.map((item) => [item.id, item]))
    const known = document.content.items[0]
    if (known === undefined) throw new Error('fixture has no items')

    expect(resolveLabel(itemsById, known.id)).toBe(known.label_md)
  })

  it('resolves a known category id to its declared label_md', () => {
    const document = sorterFixtures[0]
    if (document === undefined) throw new Error('fixture missing')
    const categoriesById = new Map((document.content.categories ?? []).map((c) => [c.id, c]))
    const known = document.content.categories?.[0]
    if (known === undefined) throw new Error('fixture has no categories')

    expect(resolveLabel(categoriesById, known.id)).toBe(known.label_md)
  })

  it('falls back to the raw id — never a hardcoded placeholder — for an unknown id', () => {
    const empty = new Map<string, { label_md: string }>()
    expect(resolveLabel(empty, 'mystery-id')).toBe('mystery-id')
  })
})

describe('sorter scene: cycleFocusIndex', () => {
  it('returns -1 for an empty list regardless of direction', () => {
    expect(cycleFocusIndex(0, -1, 1)).toBe(-1)
    expect(cycleFocusIndex(0, -1, -1)).toBe(-1)
  })

  it('enters a non-empty list at 0 going forward, and at the end going backward', () => {
    expect(cycleFocusIndex(3, -1, 1)).toBe(0)
    expect(cycleFocusIndex(3, -1, -1)).toBe(2)
  })

  it('wraps around both ends', () => {
    expect(cycleFocusIndex(3, 2, 1)).toBe(0)
    expect(cycleFocusIndex(3, 0, -1)).toBe(2)
  })
})

describe('sorter scene: resolvePlacementEvent', () => {
  it('a real category id resolves to a place action naming that slot', () => {
    expect(resolvePlacementEvent(7, 'ingreso')).toEqual({
      action: 'place',
      payload: { slot: 'ingreso', n: 7 },
    })
  })

  it('the trash sentinel resolves to a discard action with no slot', () => {
    expect(resolvePlacementEvent(7, TRASH_BIN_ID)).toEqual({
      action: 'discard',
      payload: { n: 7 },
    })
  })
})

describe('sorter scene: NON-static tap-select-then-tap-bin (§1.11 drag alternative)', () => {
  it('a tap that never moves selects the item instead of dragging it', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const pos = itemPosition(1)

    scene.onPointerDown(pos)
    expect(scene.dragItem?.uid).toBe(1)
    expect(scene.selectedItem).toBeNull()

    scene.onPointerUp(pos)

    expect(scene.dragItem).toBeNull()
    expect(scene.selectedItem?.uid).toBe(1)
    expect(scene.bridge.enqueue).not.toHaveBeenCalled()
  })

  it('a subsequent tap on the correct bin commits the SAME action a drag-drop would', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)
    const binPos = binPosition(0) // categories[0] === 'ingreso'

    scene.onPointerDown(itemPos)
    scene.onPointerUp(itemPos) // tap-select, no drag distance

    scene.onPointerDown(binPos) // tap the bin while an item is selected

    const expected = resolvePlacementEvent(1, 'ingreso')
    expect(scene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(scene.bridge.enqueue).toHaveBeenCalledWith(expected.action, expected.payload)
    expect(scene.selectedItem).toBeNull()
  })

  it('a drag past the movement threshold still drops normally (drag is preserved, not replaced)', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)
    const binPos = binPosition(0)

    scene.onPointerDown(itemPos)
    // Real movement — past DRAG_MOVE_THRESHOLD (12 design px) — makes this a drag.
    scene.onPointerMove({ x: binPos.x - 5, y: binPos.y })
    scene.onPointerUp(binPos)

    const expected = resolvePlacementEvent(1, 'ingreso')
    expect(scene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(scene.bridge.enqueue).toHaveBeenCalledWith(expected.action, expected.payload)
    // A true drag never arms `selectedItem` — it commits directly on drop.
    expect(scene.selectedItem).toBeNull()
  })
})

describe('sorter scene: pointer hit-testing uses camera-world coordinates, not raw canvas coordinates', () => {
  // REGRESSION (found live, not by a prior unit test): every fixture whose authored
  // `field` differs from 800x600 gets a zoomed/re-centred camera via `getWorldSize()`
  // (commit 695891c) — e.g. the arcade sorter fixture's 960x560 field zooms to ~0.833.
  // `item.container.x/y` and `bin.container.x/y` are WORLD coordinates (the field's own
  // authored space), but Phaser's `Pointer.x/y` are raw, PRE-ZOOM canvas coordinates —
  // only `Pointer.worldX/worldY` (populated by Phaser's InputManager via
  // `camera.getWorldPoint()` before any listener runs) are camera-correct. Hit-testing
  // against `x/y` instead of `worldX/worldY` means every tap on a zoomed fixture lands
  // tens-to-hundreds of design px away from where the player actually touched — this
  // was confirmed live in a browser: a tap computed against `x/y` never selected the
  // real item. These tests build a pointer whose `x/y` deliberately point at NOTHING
  // (an empty region no item/bin occupies) while `worldX/worldY` correctly addresses
  // the real target — proving the handlers key off `worldX/worldY`, not `x/y`.
  it('selects an item by worldX/worldY even when x/y point at empty space', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)

    scene.onPointerDown({ x: -9999, y: -9999, worldX: itemPos.x, worldY: itemPos.y })
    expect(scene.dragItem?.uid).toBe(1)

    scene.onPointerUp({ x: -9999, y: -9999, worldX: itemPos.x, worldY: itemPos.y })
    expect(scene.selectedItem?.uid).toBe(1)
  })

  it('commits a bin placement by worldX/worldY even when x/y point at empty space', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)
    const binPos = binPosition(0) // categories[0] === 'ingreso'

    scene.onPointerDown({ x: -9999, y: -9999, worldX: itemPos.x, worldY: itemPos.y })
    scene.onPointerUp({ x: -9999, y: -9999, worldX: itemPos.x, worldY: itemPos.y })
    scene.onPointerDown({ x: -9999, y: -9999, worldX: binPos.x, worldY: binPos.y })

    const expected = resolvePlacementEvent(1, 'ingreso')
    expect(scene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(scene.bridge.enqueue).toHaveBeenCalledWith(expected.action, expected.payload)
  })

  it('a drag tracked via worldX/worldY still drops on the correct bin when x/y point at empty space', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)
    const binPos = binPosition(0)

    scene.onPointerDown({ x: -9999, y: -9999, worldX: itemPos.x, worldY: itemPos.y })
    scene.onPointerMove({ x: -9999, y: -9999, worldX: binPos.x - 5, worldY: binPos.y })
    scene.onPointerUp({ x: -9999, y: -9999, worldX: binPos.x, worldY: binPos.y })

    const expected = resolvePlacementEvent(1, 'ingreso')
    expect(scene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(scene.bridge.enqueue).toHaveBeenCalledWith(expected.action, expected.payload)
  })

  it('falls back to x/y when worldX/worldY are absent (zoom-1 / test-fixture convention, unchanged)', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)
    const itemPos = itemPosition(1)

    scene.onPointerDown(itemPos)
    scene.onPointerUp(itemPos)
    expect(scene.selectedItem?.uid).toBe(1)
  })
})

describe('sorter scene: keyboard path (§1.11 keyboard access)', () => {
  it('Tab-to-item, Enter, Tab-to-bin, Enter enqueues the SAME action the pointer path does', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)

    scene.handleKeyDown({ key: 'Tab' }) // focuses the only item (uid 1)
    expect(scene.kbFocusUid).toBe(1)

    scene.handleKeyDown({ key: 'Enter' }) // confirms it into `selectedItem`
    expect(scene.selectedItem?.uid).toBe(1)
    expect(scene.kbFocusUid).toBeNull()

    scene.handleKeyDown({ key: 'Tab' }) // focuses categories[0] === 'ingreso'
    expect(scene.kbFocusBinId).toBe('ingreso')

    scene.handleKeyDown({ key: 'Enter' }) // commits

    const expected = resolvePlacementEvent(1, 'ingreso')
    expect(scene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(scene.bridge.enqueue).toHaveBeenCalledWith(expected.action, expected.payload)
    expect(scene.selectedItem).toBeNull()
    expect(scene.kbFocusBinId).toBeNull()
  })

  it('ArrowRight/ArrowLeft cycle bin focus identically to Tab once an item is selected', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)

    scene.handleKeyDown({ key: 'ArrowRight' })
    scene.handleKeyDown({ key: 'Enter' })
    expect(scene.selectedItem?.uid).toBe(1)

    scene.handleKeyDown({ key: 'ArrowRight' }) // -> categories[0] = 'ingreso'
    expect(scene.kbFocusBinId).toBe('ingreso')
    scene.handleKeyDown({ key: 'ArrowRight' }) // -> categories[1] = 'other-category'
    expect(scene.kbFocusBinId).toBe('other-category')
    scene.handleKeyDown({ key: 'ArrowLeft' }) // back to 'ingreso'
    expect(scene.kbFocusBinId).toBe('ingreso')
  })

  it('Escape clears keyboard focus and any pending selection without enqueuing anything', () => {
    const state = makeFallingSingleItemState(1, 'ingreso')
    const scene = makeFakeScene(state)

    scene.handleKeyDown({ key: 'Tab' })
    scene.handleKeyDown({ key: 'Enter' })
    expect(scene.selectedItem).not.toBeNull()

    scene.handleKeyDown({ key: 'Escape' })

    expect(scene.selectedItem).toBeNull()
    expect(scene.kbFocusUid).toBeNull()
    expect(scene.kbFocusBinId).toBeNull()
    expect(scene.bridge.enqueue).not.toHaveBeenCalled()
  })

  it('the keyboard path and a pointer tap-select-then-tap-bin path enqueue byte-identical calls', () => {
    const keyboardState = makeFallingSingleItemState(1, 'ingreso')
    const keyboardScene = makeFakeScene(keyboardState)
    keyboardScene.handleKeyDown({ key: 'Tab' })
    keyboardScene.handleKeyDown({ key: 'Enter' })
    keyboardScene.handleKeyDown({ key: 'Tab' })
    keyboardScene.handleKeyDown({ key: 'Enter' })

    const pointerState = makeFallingSingleItemState(1, 'ingreso')
    const pointerScene = makeFakeScene(pointerState)
    const itemPos = itemPosition(1)
    pointerScene.onPointerDown(itemPos)
    pointerScene.onPointerUp(itemPos)
    pointerScene.onPointerDown(binPosition(0))

    expect(keyboardScene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(pointerScene.bridge.enqueue).toHaveBeenCalledTimes(1)
    expect(keyboardScene.bridge.enqueue.mock.calls[0]).toEqual(pointerScene.bridge.enqueue.mock.calls[0])
  })
})

describe('sorter scene: 44px touch-target floor (§1.11)', () => {
  it('a manifest authoring a small item_size still hit-tests at the MIN_TOUCH_DESIGN_PX floor', () => {
    // A document may legally author `item_size` as low as the schema's own minimum
    // (24) — the floor must apply regardless of what a manifest declares.
    const state = makeFallingSingleItemState(1, 'ingreso')
    const tinyState: SorterState = { ...state, config: { ...state.config, field: { ...state.config.field, item_size: 24 } } }
    const scene = makeFakeScene(tinyState)

    // findItemAt is private; drive it the same way onPointerDown does — a tap 40px
    // off-centre from the item would miss a real 24px item (half-width 16) but must
    // still hit at the >=100px floor (half-width >= 50 design px).
    const pos = itemPosition(1)
    scene.onPointerDown({ x: pos.x + 40, y: pos.y })
    expect(scene.dragItem?.uid).toBe(1)
  })
})
