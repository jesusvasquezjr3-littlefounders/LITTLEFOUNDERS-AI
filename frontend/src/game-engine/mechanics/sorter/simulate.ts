// `sorter` — the PURE simulator (GAME_ENGINE.md §5, brief §4).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no `%`, no transcendental:
// Core re-runs this exact code over the player's input log to derive the reward, so
// every operation here is one the ECMAScript spec pins to the last bit. Randomness
// comes only from core/rng.ts.
//
// Two v1 bugs are structurally excluded and both cost a full comment:
//
//  - PER-ENTITY TIMERS. Every element carries its OWN `speed`, position and
//    `spawnedAt`. There is no shared accumulator that N elements each decrement, so
//    N elements cannot make one clock run N times too fast.
//  - BATCHED REMOVALS. A tick resolves the WHOLE event batch, then rebuilds `active`
//    in ONE pass that drops both the consumed and the escaped elements together.
//    There is no per-event dispatch and no early return, so simultaneous removals
//    cannot stall the motion of everything else on that tick.

import { createRng, shuffleWith } from '@/game-engine/core/rng'
import {
  accuracyScore,
  applyPenalty,
  comboMultiplier,
  targetScore,
  weightedScore,
} from '@/game-engine/core/scoring'
import type {
  GameInputEvent,
  GameItemTier,
  Rng,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '@/game-engine/core/types'

import type { SorterConfig, SorterContent, SorterLadderLevel } from './schema'

/** The two player intents. `place` names a container in `slot` and the element in
 *  `n`; `discard` names only the element. Anything else is refused by replayGame()
 *  before the simulator is even initialised. */
export const SORTER_ACTIONS = ['place', 'discard'] as const
export type SorterAction = (typeof SORTER_ACTIONS)[number]

/** Odd 32-bit stride (golden ratio). Deriving the tick's PRNG from `seed` and the
 *  ABSOLUTE tick keeps `step()` pure — no mutable generator is threaded through the
 *  state, so a replayed tick draws exactly what the live tick drew. */
const TICK_SEED_STRIDE = 0x9e3779b1

/** Used only if a document somehow reaches the simulator with an empty ladder (the
 *  schema forbids it). Refusing to spawn is the safe degradation: the run ends on the
 *  tick budget with no score rather than dividing by zero on the reward path. */
const FALLBACK_LEVEL: SorterLadderLevel = {
  spawn_interval_ticks: 1,
  fall_speed: 0,
  speed_variance: 0,
  max_active: 1,
  item_tiers: [1],
  points_per_correct: 1,
}

/** One element in play. Everything time-dependent about it lives HERE. */
export interface SorterEntity {
  /** Unique for the whole run — the input log addresses elements by it. */
  uid: number
  itemId: string
  /** `null` = TRAP: it belongs in no container. */
  categoryId: string | null
  tier: GameItemTier
  /** Design coordinates (core/stage.ts maps them to CSS px). */
  x: number
  y: number
  /** Design px per tick. Per-entity, never shared. */
  speed: number
  spawnedAt: number
}

interface SorterPoolEntry {
  itemId: string
  categoryId: string | null
  tier: GameItemTier
}

export interface SorterState {
  config: SorterConfig
  /** Declared container ids, in document order — a `place` naming anything else is
   *  ignored rather than counted as a mistake. */
  categories: readonly string[]
  /** Seeded, shuffled spawn QUEUE. An entry whose tier the current rung excludes is
   *  skipped over, never dropped: it becomes spawnable again when the ladder climbs
   *  to a rung that includes its tier. */
  deck: readonly SorterPoolEntry[]
  seed: number
  active: readonly SorterEntity[]
  nextUid: number
  nextSpawnTick: number
  ticks: number
  correct: number
  wrong: number
  missed: number
  /** Traps correctly LEFT ALONE until they left the field. Rewarded with nothing and
   *  punished with nothing: not acting is the right play, not a scoring event. */
  avoided: number
  combo: number
  bestCombo: number
  points: number
  lives: number | null
  finished: boolean
}

// ---- helpers ------------------------------------------------------------------

function tickRng(seed: number, tick: number): Rng {
  return createRng((seed + tick * TICK_SEED_STRIDE) >>> 0)
}

function levelIndexFor(config: SorterConfig, correct: number): number {
  const climbed = Math.floor(correct / config.level_up.correct_per_level)
  return Math.max(0, Math.min(config.ladder.length - 1, climbed))
}

function levelFor(config: SorterConfig, correct: number): SorterLadderLevel {
  return config.ladder[levelIndexFor(config, correct)] ?? FALLBACK_LEVEL
}

/**
 * Draw the first queued entry whose tier this rung includes.
 *
 * The drawn entry leaves the queue; with `repeat_items` on it is pushed to the BACK
 * instead, so the deck cycles forever. Entries the rung excludes keep their place —
 * a tier-3 item is not lost because the run was still on rung 1 when it came up.
 * Returns the new queue alongside the entry, so the caller never mutates state.
 */
function drawFromDeck(
  deck: readonly SorterPoolEntry[],
  tiers: readonly GameItemTier[],
  repeat: boolean,
): { entry: SorterPoolEntry; deck: readonly SorterPoolEntry[] } | null {
  for (let index = 0; index < deck.length; index += 1) {
    const entry = deck[index]
    if (entry === undefined) continue
    if (!tiers.includes(entry.tier)) continue
    const remaining = [...deck.slice(0, index), ...deck.slice(index + 1)]
    return { entry, deck: repeat ? [...remaining, entry] : remaining }
  }
  return null
}

function spawnEntity(
  entry: SorterPoolEntry,
  uid: number,
  tick: number,
  config: SorterConfig,
  level: SorterLadderLevel,
  rng: Rng,
): SorterEntity {
  const { field } = config
  const lane = rng.int(field.lanes)
  // Symmetric jitter around the rung's speed, floored at 0 so a large variance can
  // never reverse an element's direction of travel.
  const jitter = (rng.next() * 2 - 1) * level.speed_variance
  const speed = Math.max(0, level.fall_speed + jitter)
  const columnCentre = (lane + 0.5) * (field.width / field.lanes)
  const rowCentre = (lane + 0.5) * (field.height / field.lanes)

  if (config.mode === 'conveyor') {
    return {
      uid,
      itemId: entry.itemId,
      categoryId: entry.categoryId,
      tier: entry.tier,
      x: 0,
      y: rowCentre,
      speed,
      spawnedAt: tick,
    }
  }
  return {
    uid,
    itemId: entry.itemId,
    categoryId: entry.categoryId,
    tier: entry.tier,
    x: columnCentre,
    y: config.mode === 'falling' ? 0 : field.height / 2,
    speed,
    spawnedAt: tick,
  }
}

/** Motion is per-entity and additive: one tick advances one element by its own
 *  speed. `static` elements do not move at all and therefore can never be missed. */
function advance(entity: SorterEntity, config: SorterConfig): SorterEntity {
  if (config.mode === 'falling') return { ...entity, y: entity.y + entity.speed }
  if (config.mode === 'conveyor') return { ...entity, x: entity.x + entity.speed }
  return entity
}

function hasLeftField(entity: SorterEntity, config: SorterConfig): boolean {
  if (config.mode === 'falling') return entity.y >= config.field.height
  if (config.mode === 'conveyor') return entity.x >= config.field.width
  return false
}

/** The blended 0..100 score. Read by `snapshot` (HUD) and `result` (the reward), so
 *  the number a child watches and the number Core grants are the same function. */
function scoreOf(state: SorterState): number {
  const { config } = state
  const attempts = state.correct + state.wrong
  const blend = weightedScore([
    { value: accuracyScore(state.correct, attempts), weight: config.score_weights.accuracy },
    {
      value: targetScore(state.correct, config.round.target_correct),
      weight: config.score_weights.progress,
    },
    {
      value: targetScore(state.points, config.round.target_points),
      weight: config.score_weights.points,
    },
  ])
  // Wrong drops already lower accuracy; the extra deduction is the document's own
  // "a mistake costs this much" dial, and misses are not in the accuracy denominator
  // at all, so neither penalty double-counts the same evidence.
  const afterWrong = applyPenalty(blend, state.wrong, config.penalty.wrong_drop.score_pct)
  return applyPenalty(afterWrong, state.missed, config.penalty.miss.score_pct)
}

// ---- the simulator ------------------------------------------------------------

function init(input: SimInit): SorterState {
  const config = input.config as SorterConfig
  const content = input.content as unknown as SorterContent
  const rng = createRng(input.seed)

  let deck: readonly SorterPoolEntry[] = shuffleWith(content.items, rng).map((item) => ({
    itemId: item.id,
    categoryId: item.category ?? null,
    tier: item.tier ?? 1,
  }))

  const level = config.ladder[0] ?? FALLBACK_LEVEL
  const active: SorterEntity[] = []
  let nextUid = 1

  for (let i = 0; i < config.initial_fill; i += 1) {
    const drawn = drawFromDeck(deck, level.item_tiers, config.repeat_items)
    if (drawn === null) break
    active.push(spawnEntity(drawn.entry, nextUid, 0, config, level, rng))
    nextUid += 1
    deck = drawn.deck
  }

  return {
    config,
    categories: content.categories.map((category) => category.id),
    deck,
    seed: input.seed,
    active,
    nextUid,
    nextSpawnTick: 0,
    ticks: 0,
    correct: 0,
    wrong: 0,
    missed: 0,
    avoided: 0,
    combo: 0,
    bestCombo: 0,
    points: 0,
    lives: input.scoring.mode === 'cheer' ? null : (input.scoring.lives ?? null),
    finished: false,
  }
}

function step(
  state: SorterState,
  tick: number,
  events: readonly GameInputEvent[],
): SorterState {
  if (state.finished) return state

  const { config } = state
  const rng = tickRng(state.seed, tick)

  let correct = state.correct
  let wrong = state.wrong
  let missed = state.missed
  let avoided = state.avoided
  let combo = state.combo
  let bestCombo = state.bestCombo
  let points = state.points
  let lives = state.lives

  // Consumed this tick. Collected first, applied once — never spliced mid-loop.
  const consumed: number[] = []

  // 1) Player intents, in log order.
  for (const event of events) {
    const uid = event.n
    if (uid === undefined || !Number.isInteger(uid)) continue
    if (consumed.includes(uid)) continue
    const entity = state.active.find((candidate) => candidate.uid === uid)
    if (entity === undefined) continue

    const isTrap = entity.categoryId === null
    let placedCorrectly: boolean

    if (event.action === 'discard') {
      // A document without a discard target has no discard rule to apply; ignoring
      // the intent is honest, charging a penalty for an affordance the manifest never
      // offered is not.
      if (!config.trash_zone) continue
      placedCorrectly = isTrap
    } else if (event.action === 'place') {
      const slot = event.slot
      if (slot === undefined) continue
      // An undeclared container cannot be on screen, so this is a malformed log
      // rather than a child's mistake: ignore it instead of scoring it.
      if (!state.categories.includes(slot)) continue
      placedCorrectly = entity.categoryId === slot
    } else {
      continue
    }

    if (placedCorrectly) {
      correct += 1
      combo += 1
      if (combo > bestCombo) bestCombo = combo
      const level = levelFor(config, correct - 1)
      // `combo - 1` = the streak BEFORE this hit, so the first correct placement of a
      // run always pays 1x and the ramp is legible: "N in a row, then a bonus".
      points += level.points_per_correct * comboMultiplier(combo - 1, config.combo)
      consumed.push(uid)
      continue
    }

    wrong += 1
    const penalty = config.penalty.wrong_drop
    if (penalty.combo_reset) combo = 0
    if (lives !== null && penalty.lives > 0) lives = Math.max(0, lives - penalty.lives)
    if (!penalty.return_item) consumed.push(uid)
  }

  // 2) Motion + escapes, in ONE pass that rebuilds the whole field.
  const survivors: SorterEntity[] = []
  for (const entity of state.active) {
    if (consumed.includes(entity.uid)) continue
    const moved = advance(entity, config)
    if (!hasLeftField(moved, config)) {
      survivors.push(moved)
      continue
    }
    if (moved.categoryId === null) {
      // Letting a trap go IS the correct play (the report's "ignore" branch), so it
      // is never a miss — otherwise a manifest with no discard zone would punish
      // perfect play.
      avoided += 1
      continue
    }
    missed += 1
    const penalty = config.penalty.miss
    if (penalty.combo_reset) combo = 0
    if (lives !== null && penalty.lives > 0) lives = Math.max(0, lives - penalty.lives)
  }

  // 3) Spawn. Capacity is checked AFTER removals, so freeing a slot refills it on the
  //    same tick; the schedule only advances when a spawn actually happened.
  let deck = state.deck
  let nextUid = state.nextUid
  let nextSpawnTick = state.nextSpawnTick
  const level = levelFor(config, correct)
  if (tick >= nextSpawnTick && survivors.length < level.max_active) {
    const drawn = drawFromDeck(deck, level.item_tiers, config.repeat_items)
    if (drawn !== null) {
      survivors.push(spawnEntity(drawn.entry, nextUid, tick, config, level, rng))
      nextUid += 1
      deck = drawn.deck
      nextSpawnTick = tick + level.spawn_interval_ticks
    }
  }

  const ticks = tick + 1
  const finished =
    ticks >= config.round.tick_budget ||
    correct >= config.round.target_correct ||
    (lives !== null && lives <= 0) ||
    (deck.length === 0 && survivors.length === 0)

  return {
    ...state,
    active: survivors,
    deck,
    nextUid,
    nextSpawnTick,
    ticks,
    correct,
    wrong,
    missed,
    avoided,
    combo,
    bestCombo,
    points,
    lives,
    finished,
  }
}

function snapshot(state: SorterState): SimSnapshot {
  return {
    finished: state.finished,
    score: scoreOf(state),
    lives: state.lives,
    // The ladder rung the player has climbed to, 1-based — what the HUD calls a round.
    round: levelIndexFor(state.config, state.correct) + 1,
  }
}

function result(state: SorterState): SimResult {
  const attempts = state.correct + state.wrong
  return {
    score: scoreOf(state),
    finished: state.finished,
    // Derived aggregates only: `game_attempts.stats` may hold exactly this and
    // nothing tick-resolution about a child's session (§11).
    stats: {
      correct: state.correct,
      wrong: state.wrong,
      missed: state.missed,
      avoided: state.avoided,
      best_combo: state.bestCombo,
      points: state.points,
      accuracy: accuracyScore(state.correct, attempts),
      level: levelIndexFor(state.config, state.correct) + 1,
      ticks: state.ticks,
    },
  }
}

export const sorterSimulator: Simulator<SorterState> = {
  mechanic: 'sorter',
  actions: SORTER_ACTIONS,
  init,
  step,
  snapshot,
  result,
}
