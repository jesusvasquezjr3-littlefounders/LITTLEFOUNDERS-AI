// `autobattler` — the PURE simulator (GAME_ENGINE.md §5, §4 row `autobattler`).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no `%`, no transcendental.
// Core re-runs this exact code over the player's input log to derive the reward, so
// every operation here is one the ECMAScript spec pins to the last bit. Randomness
// comes only from core/rng.ts, seeded from the run.
//
// THE TICK MAPPING. The owner's report specifies a 0.5s combat tick. The engine's fixed
// tick is 50ms (`TICK_MS`), so ONE COMBAT TICK IS EXACTLY 10 ENGINE TICKS — and it is
// implemented as the integer counter `combatSubTick` counting up to
// `config.combat.engine_ticks_per_combat_tick`, never as a float accumulator. The ratio
// is config so a document can slow a battle down for tier 1, but it is always integer.
//
// TWO v1 BUGS ARE STRUCTURALLY EXCLUDED, and both cost a comment:
//  - PER-ENTITY TIMERS. Every fighter carries its OWN `cooldown` and its OWN `mana`.
//    There is no shared accumulator that N fighters decrement, so N fighters can never
//    make one clock run N times too fast.
//  - BATCHED REMOVALS. A combat tick resolves the WHOLE fighter array first and then
//    rebuilds it in ONE pass that drops every fighter that died on that tick. There is
//    no splice mid-loop and no early return, so simultaneous deaths cannot stall the
//    movement of everything else on that tick.
//
// PLAYER INPUT IS A PREPARATION-PHASE-ONLY AFFAIR. `step` ignores every event while the
// phase is `combat`: all strategy happens before the battle, and the battle resolves
// itself. That makes the input log EMPTY for the whole combat stretch, which is why
// this mechanic is the strongest determinism test in the engine — the outcome is
// derived from the seed and the board alone.
//
// DEFERRED, NOT DROPPED: cross-run meta-progression (unlockable units, cosmetics,
// persistent handicaps) is deferred platform-wide (GAME_ENGINE.md §13) and NO
// persistence layer is invented here. The WITHIN-RUN item layer below — camp drops,
// equipping, combining — is fully real.

import { createRng } from '../../core/rng.js'
import {
  applyPenalty,
  targetScore,
  weightedScore,
} from '../../core/scoring.js'
import type {
  GameInputEvent,
  Rng,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '../../core/types.js'

import type {
  AutobattlerConfig,
  AutobattlerOpponentProfile,
  AutobattlerTargeting,
} from './schema.js'

/** Every player intent. ALL of them are preparation-phase actions — during combat the
 *  log is empty by construction, because `step` ignores events outside `prep`. */
export const AUTOBATTLER_ACTIONS = [
  'buy',
  'sell',
  'place',
  'merge',
  'refresh',
  'level',
  'equip',
  'ready',
] as const
export type AutobattlerAction = (typeof AUTOBATTLER_ACTIONS)[number]

/** Odd 32-bit strides (golden ratio derived). Deriving each draw's PRNG from the seed
 *  plus the ABSOLUTE tick plus a salt keeps `step()` pure: no mutable generator is
 *  threaded through the state, so a replayed tick draws exactly what the live tick drew,
 *  and two consecutive shop rolls on the same tick still differ. */
const TICK_SEED_STRIDE = 0x9e3779b1
const SALT_STRIDE = 0x85ebca6b

/** Milli-cell resolution: 1000 units = one board cell, shared with the view. */
export const CELL_MILLI = 1000

/** A unit the player owns. `cell < 0` means it is on the bench and does NOT fight. */
export interface AutobattlerUnitInstance {
  /** Unique for the whole run — the input log addresses units by it. */
  uid: number
  typeIndex: number
  star: number
  /** Board cell index, or -1 for the bench. */
  cell: number
  /** Indices into `config.items` — the within-run item layer. */
  items: readonly number[]
}

/** One combatant. Everything time-dependent about it lives HERE, per entity. */
export interface AutobattlerFighter {
  uid: number
  /** 0 = the player's side, 1 = the opponent's. */
  side: number
  typeIndex: number
  star: number
  /** Milli-cell battlefield coordinates. */
  x: number
  y: number
  hp: number
  maxHp: number
  damage: number
  armour: number
  range: number
  moveSpeed: number
  /** In COMBAT ticks. */
  attackInterval: number
  cooldown: number
  mana: number
  manaMax: number
  manaPerAttack: number
  manaOnDamaged: number
  shield: number
  /** Percent added by the `empower` ability, for this battle only. */
  bonusDamagePct: number
}

export type AutobattlerPhase = 'prep' | 'combat' | 'over'

export interface AutobattlerState {
  config: AutobattlerConfig
  seed: number
  phase: AutobattlerPhase
  /** 0-based index into `config.rounds`. */
  round: number
  tick: number
  /** Engine ticks spent in the current phase. */
  phaseTick: number
  /** 0..engine_ticks_per_combat_tick-1. INTEGER, never a float. */
  combatSubTick: number
  /** Combat ticks elapsed in the current battle. */
  combatTick: number

  gold: number
  level: number
  xp: number
  health: number
  winStreak: number
  lossStreak: number
  roundsWon: number
  roundsLost: number

  /** One typeIndex per shop slot; -1 means the slot was bought out. */
  shop: readonly number[]
  /** How many shop rolls have happened — the salt that decorrelates two rolls. */
  rolls: number
  units: readonly AutobattlerUnitInstance[]
  nextUid: number
  /** Item ids dropped by PvE camps and not yet equipped. */
  bag: readonly string[]

  fighters: readonly AutobattlerFighter[]

  interestEarned: number
  incomeEarned: number
  streakEarned: number
  goldSpent: number
  refreshes: number
  merges: number
  itemsEquipped: number

  /** Mirrors the document's `scoring.lives`: null in cheer mode, where losing all
   *  health costs score but never the run. */
  lives: number | null
  finished: boolean
}

// ---- Small deterministic helpers ---------------------------------------------------

function tickRng(seed: number, tick: number, salt: number): Rng {
  return createRng((seed + tick * TICK_SEED_STRIDE + salt * SALT_STRIDE) >>> 0)
}

export function cellIndexOf(cols: number, col: number, row: number): number {
  return row * cols + col
}

export function cellRowOf(cols: number, cell: number): number {
  return Math.floor(cell / cols)
}

export function cellColOf(cols: number, cell: number): number {
  return cell - cellRowOf(cols, cell) * cols
}

/** The battlefield is the player's board stacked under a mirrored copy of it. */
export function fieldRows(config: AutobattlerConfig): number {
  return config.board.rows * 2
}

/** Integer power for the "how many 1-star copies is this unit worth" refund maths.
 *  A loop, not `Math.pow`: `**`/`pow` are banned by §5 for non-integer exponents and
 *  a three-iteration loop is exact for every value this schema allows. */
function copiesForStar(copiesNeeded: number, star: number): number {
  let total = 1
  for (let i = 1; i < star; i += 1) total = total * copiesNeeded
  return total
}

interface StatBonus {
  damagePct: number
  hpPct: number
  armour: number
  attackSpeedPct: number
}

const ZERO_BONUS: StatBonus = { damagePct: 0, hpPct: 0, armour: 0, attackSpeedPct: 0 }

function addBonus(a: StatBonus, b: StatBonus): StatBonus {
  return {
    damagePct: a.damagePct + b.damagePct,
    hpPct: a.hpPct + b.hpPct,
    armour: a.armour + b.armour,
    attackSpeedPct: a.attackSpeedPct + b.attackSpeedPct,
  }
}

/** One member of a side, before it becomes a fighter. */
interface RosterMember {
  typeIndex: number
  star: number
  cell: number
  items: readonly number[]
}

/**
 * The synergy matrix. A trait counts DISTINCT unit types on the side (three copies of
 * one unit is one type, exactly as the report's threshold rule implies), and effects
 * CASCADE: every rung whose count is met adds its bonuses, so 2/4/6 is three steps
 * rather than three replacements.
 *
 * Iteration is over `config.traits` in declaration order and over the roster array —
 * no Set/Map walk anywhere, per §5 rule 6.
 */
export function traitCounts(
  config: AutobattlerConfig,
  roster: readonly RosterMember[],
): number[] {
  const counts: number[] = []
  for (const trait of config.traits) {
    const counted: number[] = []
    for (const member of roster) {
      const unit = config.units[member.typeIndex]
      if (unit === undefined) continue
      if (!unit.traits.includes(trait.id)) continue
      if (counted.includes(member.typeIndex)) continue
      counted.push(member.typeIndex)
    }
    counts.push(counted.length)
  }
  return counts
}

interface TraitBonuses {
  /** Applies to every unit on the side. */
  team: StatBonus
  /** Index-aligned with `config.traits`; applies only to units carrying that trait. */
  perTrait: StatBonus[]
  counts: number[]
}

function computeTraitBonuses(
  config: AutobattlerConfig,
  roster: readonly RosterMember[],
): TraitBonuses {
  const counts = traitCounts(config, roster)
  let team = ZERO_BONUS
  const perTrait: StatBonus[] = config.traits.map(() => ZERO_BONUS)

  for (const [index, trait] of config.traits.entries()) {
    const count = counts[index] ?? 0
    let accumulated = ZERO_BONUS
    for (const threshold of trait.thresholds) {
      if (count < threshold.count) continue
      accumulated = addBonus(accumulated, {
        damagePct: threshold.damage_pct,
        hpPct: threshold.hp_pct,
        armour: threshold.armour,
        attackSpeedPct: threshold.attack_speed_pct,
      })
    }
    if (trait.scope === 'team') team = addBonus(team, accumulated)
    else perTrait[index] = accumulated
  }

  return { team, perTrait, counts }
}

function bonusFor(
  config: AutobattlerConfig,
  bonuses: TraitBonuses,
  typeIndex: number,
): StatBonus {
  let total = bonuses.team
  const unit = config.units[typeIndex]
  if (unit === undefined) return total
  for (const [index, trait] of config.traits.entries()) {
    if (!unit.traits.includes(trait.id)) continue
    total = addBonus(total, bonuses.perTrait[index] ?? ZERO_BONUS)
  }
  return total
}

/**
 * The report's optional ADJACENCY bonus: orthogonal neighbours on the placement grid.
 * `same_trait_only` turns it from "stand together" into "plan a formation", which is
 * the difficulty dial the report names.
 */
function adjacencyBonus(
  config: AutobattlerConfig,
  roster: readonly RosterMember[],
  member: RosterMember,
): { damagePct: number; armour: number } {
  const rule = config.combat.adjacency
  if (!rule.enabled || member.cell < 0) return { damagePct: 0, armour: 0 }
  const cols = config.board.cols
  const col = cellColOf(cols, member.cell)
  const row = cellRowOf(cols, member.cell)
  const self = config.units[member.typeIndex]
  let neighbours = 0

  for (const other of roster) {
    if (other.cell < 0 || other.cell === member.cell) continue
    const otherCol = cellColOf(cols, other.cell)
    const otherRow = cellRowOf(cols, other.cell)
    const distance = Math.abs(otherCol - col) + Math.abs(otherRow - row)
    if (distance !== 1) continue
    if (rule.same_trait_only) {
      const otherUnit = config.units[other.typeIndex]
      if (self === undefined || otherUnit === undefined) continue
      if (!self.traits.some((trait) => otherUnit.traits.includes(trait))) continue
    }
    neighbours += 1
  }

  return {
    damagePct: neighbours * rule.per_neighbour_damage_pct,
    armour: neighbours * rule.per_neighbour_armour,
  }
}

interface BuildFighterArgs {
  config: AutobattlerConfig
  member: RosterMember
  roster: readonly RosterMember[]
  bonuses: TraitBonuses
  /** Percent scaling for the whole side (the opponent power curve; 100 for the player). */
  powerPct: number
  side: number
  uid: number
}

function buildFighter(args: BuildFighterArgs): AutobattlerFighter | null {
  const { config, member, roster, bonuses, powerPct, side, uid } = args
  const type = config.units[member.typeIndex]
  if (type === undefined || member.cell < 0) return null

  const starMultiplier = config.merge.star_multipliers[member.star - 1] ?? 1
  let itemDamage = 0
  let itemHp = 0
  let itemArmour = 0
  let itemAttackSpeedPct = 0
  for (const itemIndex of member.items) {
    const item = config.items[itemIndex]
    if (item === undefined) continue
    itemDamage += item.damage
    itemHp += item.hp
    itemArmour += item.armour
    itemAttackSpeedPct += item.attack_speed_pct
  }

  const bonus = bonusFor(config, bonuses, member.typeIndex)
  const adjacency = adjacencyBonus(config, roster, member)
  const stats = type.stats

  const hp =
    Math.max(
      1,
      Math.round((stats.hp * starMultiplier * (100 + bonus.hpPct) * powerPct) / 10000),
    ) + itemHp
  const damage =
    Math.max(
      1,
      Math.round(
        (stats.damage *
          starMultiplier *
          (100 + bonus.damagePct + adjacency.damagePct) *
          powerPct) /
          10000,
      ),
    ) + itemDamage
  const attackSpeedPct = Math.max(
    10,
    100 + bonus.attackSpeedPct + itemAttackSpeedPct,
  )

  const cols = config.board.cols
  const col = cellColOf(cols, member.cell)
  const row = cellRowOf(cols, member.cell)
  // The player occupies the bottom half; the opponent is the mirrored top half, so an
  // opponent's row 0 (its front line) faces the player's row 0.
  const y =
    side === 0
      ? (config.board.rows + row) * CELL_MILLI + CELL_MILLI / 2
      : (config.board.rows - 1 - row) * CELL_MILLI + CELL_MILLI / 2

  return {
    uid,
    side,
    typeIndex: member.typeIndex,
    star: member.star,
    x: col * CELL_MILLI + CELL_MILLI / 2,
    y,
    hp,
    maxHp: hp,
    damage,
    armour: stats.armour + bonus.armour + adjacency.armour + itemArmour,
    range: stats.range,
    moveSpeed: stats.move_speed,
    attackInterval: Math.max(1, Math.round((stats.attack_interval * 100) / attackSpeedPct)),
    cooldown: 0,
    mana: 0,
    manaMax: stats.mana_max,
    manaPerAttack: stats.mana_per_attack,
    manaOnDamaged: stats.mana_on_damaged,
    shield: 0,
    bonusDamagePct: 0,
  }
}

// ---- The shop -------------------------------------------------------------------------

function pickRarity(weights: readonly number[], rng: Rng): number {
  let total = 0
  for (const weight of weights) total += weight
  if (total <= 0) return 1
  let ticket = Math.floor(rng.next() * total)
  if (ticket >= total) ticket = total - 1
  if (ticket < 0) ticket = 0
  let accumulated = 0
  for (const [index, weight] of weights.entries()) {
    accumulated += weight
    if (ticket < accumulated) return index + 1
  }
  return weights.length
}

/**
 * Roll one shop. Rarity is drawn from the level's weight row (the report's "rarity
 * probabilities depend on the player's level"), then a unit of that rarity is drawn
 * uniformly. When a manifest declares no unit at the drawn rarity, the search widens
 * DOWNWARD first — offering something cheaper is honest degradation; offering nothing
 * would strand a player who cannot afford to reroll.
 */
function rollShop(config: AutobattlerConfig, level: number, rng: Rng): number[] {
  const weights =
    config.shop.rarity_by_level[level - 1] ?? config.shop.rarity_by_level[0] ?? [1, 0, 0, 0]
  const out: number[] = []

  for (let slot = 0; slot < config.shop.offers; slot += 1) {
    const wanted = pickRarity(weights, rng)
    let candidates: number[] = []
    for (let rarity = wanted; rarity >= 1 && candidates.length === 0; rarity -= 1) {
      candidates = indicesOfRarity(config, rarity)
    }
    if (candidates.length === 0) {
      for (let rarity = wanted + 1; rarity <= 4 && candidates.length === 0; rarity += 1) {
        candidates = indicesOfRarity(config, rarity)
      }
    }
    if (candidates.length === 0) {
      out.push(-1)
      continue
    }
    out.push(candidates[rng.int(candidates.length)] ?? -1)
  }
  return out
}

function indicesOfRarity(config: AutobattlerConfig, rarity: number): number[] {
  const out: number[] = []
  for (const [index, unit] of config.units.entries()) {
    if (unit.rarity === rarity) out.push(index)
  }
  return out
}

// ---- Derived reads shared with the view and the bots ------------------------------------

/** How many units this player may field right now: the board's ceiling, the level's cap
 *  and the number of cells, whichever is smallest. Levelling is what raises it. */
export function unitCapOf(state: AutobattlerState): number {
  const { config } = state
  const byLevel = config.shop.level.units_by_level[state.level - 1] ?? config.board.team_size
  return Math.min(config.board.team_size, config.board.cols * config.board.rows, byLevel)
}

export function placedUnits(state: AutobattlerState): AutobattlerUnitInstance[] {
  return state.units.filter((unit) => unit.cell >= 0)
}

export function benchUnits(state: AutobattlerState): AutobattlerUnitInstance[] {
  return state.units.filter((unit) => unit.cell < 0)
}

/** The interest the player would collect if the round ended now — the number the UI has
 *  to show, because it IS the lesson (GAME_ENGINE.md §4). */
export function interestPreview(state: AutobattlerState): number {
  const { interest } = state.config.economy
  const steps = Math.min(interest.max_steps, Math.floor(state.gold / interest.gold_per_step))
  return Math.max(0, steps) * interest.amount_per_step
}

/** The base income of the round that is about to be paid. */
export function incomePreview(state: AutobattlerState): number {
  const { economy } = state.config
  return Math.min(
    economy.income_cap,
    economy.base_income + economy.income_growth_per_round * state.round,
  )
}

/** The streak bonus the CURRENT streak would pay. `n`-th entry covers a streak of n+1,
 *  and the last entry covers everything longer. */
function streakBonus(list: readonly number[], streak: number): number {
  if (list.length === 0 || streak <= 0) return 0
  const index = Math.min(streak, list.length) - 1
  return list[index] ?? 0
}

/** The trait counts of the player's current board, for the synergy banner. */
export function playerTraitCounts(state: AutobattlerState): number[] {
  return traitCounts(state.config, rosterOf(state))
}

function rosterOf(state: AutobattlerState): RosterMember[] {
  const out: RosterMember[] = []
  for (const unit of state.units) {
    if (unit.cell < 0) continue
    out.push({ typeIndex: unit.typeIndex, star: unit.star, cell: unit.cell, items: unit.items })
  }
  return out
}

// ---- Preparation-phase actions ------------------------------------------------------------

function applyXp(state: AutobattlerState): AutobattlerState {
  const { level } = state.config.shop
  let current = state.level
  let xp = state.xp
  // Bounded by `level.max`, so the loop cannot run away on a malformed threshold list.
  for (let guard = 0; guard < level.max && current < level.max; guard += 1) {
    const needed = level.xp_needed[current - 1] ?? Number.POSITIVE_INFINITY
    if (xp < needed) break
    xp -= needed
    current += 1
  }
  return { ...state, level: current, xp }
}

/** The first type with `copies_needed` same-star copies, lowest star first, or null. */
function findMergeable(state: AutobattlerState): { typeIndex: number; star: number } | null {
  const { config } = state
  for (let star = 1; star < config.merge.max_star; star += 1) {
    for (const [typeIndex] of config.units.entries()) {
      let copies = 0
      for (const unit of state.units) {
        if (unit.typeIndex === typeIndex && unit.star === star) copies += 1
      }
      if (copies >= config.merge.copies_needed) return { typeIndex, star }
    }
  }
  return null
}

/** Consume `copies_needed` copies and produce one of the next star. The survivor keeps
 *  the first BOARD cell among the consumed copies (a merge should not evict a unit the
 *  player deliberately positioned) and inherits their items. */
function mergeOnce(state: AutobattlerState, typeIndex: number, star: number): AutobattlerState {
  const { config } = state
  const consumed: number[] = []
  let cell = -1
  const items: number[] = []

  for (const unit of state.units) {
    if (consumed.length >= config.merge.copies_needed) break
    if (unit.typeIndex !== typeIndex || unit.star !== star) continue
    consumed.push(unit.uid)
    if (cell < 0 && unit.cell >= 0) cell = unit.cell
    for (const item of unit.items) items.push(item)
  }
  if (consumed.length < config.merge.copies_needed) return state

  const kept = state.units.filter((unit) => !consumed.includes(unit.uid))
  const merged: AutobattlerUnitInstance = {
    uid: state.nextUid,
    typeIndex,
    star: star + 1,
    cell,
    items: items.slice(0, 3),
  }
  return {
    ...state,
    units: [...kept, merged],
    nextUid: state.nextUid + 1,
    merges: state.merges + 1,
  }
}

function autoMerge(state: AutobattlerState): AutobattlerState {
  if (!state.config.prep.auto_merge) return state
  let next = state
  // A bounded loop, never `while (true)`: a cascade cannot exceed the star ceiling
  // times the roster size, and a runaway manifest must degrade, not hang the reward path.
  for (let guard = 0; guard < 8; guard += 1) {
    const mergeable = findMergeable(next)
    if (mergeable === null) break
    next = mergeOnce(next, mergeable.typeIndex, mergeable.star)
  }
  return next
}

function applyBuy(state: AutobattlerState, slot: number): AutobattlerState {
  const { config } = state
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.shop.length) return state
  const typeIndex = state.shop[slot]
  if (typeIndex === undefined || typeIndex < 0) return state
  const type = config.units[typeIndex]
  if (type === undefined) return state
  if (state.gold < type.cost) return state
  // A full bench with a full board has nowhere to put the unit; refusing is honest,
  // charging for a unit that vanishes is not.
  if (benchUnits(state).length >= config.board.bench_size) return state

  const shop = state.shop.map((entry, index) => (index === slot ? -1 : entry))
  const bought: AutobattlerUnitInstance = {
    uid: state.nextUid,
    typeIndex,
    star: 1,
    cell: -1,
    items: [],
  }
  const next: AutobattlerState = {
    ...state,
    gold: state.gold - type.cost,
    goldSpent: state.goldSpent + type.cost,
    xp: state.xp + config.shop.level.xp_per_buy,
    shop,
    units: [...state.units, bought],
    nextUid: state.nextUid + 1,
  }
  return autoMerge(applyXp(next))
}

function applySell(state: AutobattlerState, uid: number): AutobattlerState {
  const { config } = state
  const unit = state.units.find((candidate) => candidate.uid === uid)
  if (unit === undefined) return state
  const type = config.units[unit.typeIndex]
  if (type === undefined) return state
  const worth = type.cost * copiesForStar(config.merge.copies_needed, unit.star)
  const refund = Math.floor((worth * config.economy.sell_refund_pct) / 100)
  return {
    ...state,
    gold: state.gold + refund,
    units: state.units.filter((candidate) => candidate.uid !== uid),
    // Items on a sold unit return to the bag rather than evaporating: a child who
    // reshuffles their board should never silently lose a camp drop.
    bag: [
      ...state.bag,
      ...unit.items.map((index) => config.items[index]?.id).filter((id): id is string => id !== undefined),
    ],
  }
}

function applyPlace(
  state: AutobattlerState,
  uid: number,
  x: number | undefined,
  y: number | undefined,
): AutobattlerState {
  const { config } = state
  const unit = state.units.find((candidate) => candidate.uid === uid)
  if (unit === undefined) return state

  // A negative/absent coordinate means "send it back to the bench".
  if (x === undefined || y === undefined || x < 0 || y < 0) {
    if (unit.cell < 0) return state
    return {
      ...state,
      units: state.units.map((candidate) =>
        candidate.uid === uid ? { ...candidate, cell: -1 } : candidate,
      ),
    }
  }

  if (!Number.isInteger(x) || !Number.isInteger(y)) return state
  if (x >= config.board.cols || y >= config.board.rows) return state
  const target = cellIndexOf(config.board.cols, x, y)
  if (target === unit.cell) return state

  const occupant = state.units.find((candidate) => candidate.cell === target)
  if (occupant === undefined && unit.cell < 0 && placedUnits(state).length >= unitCapOf(state)) {
    // The level cap is the whole point of levelling; silently exceeding it would make
    // the shop economy meaningless.
    return state
  }

  const from = unit.cell
  return {
    ...state,
    units: state.units.map((candidate) => {
      if (candidate.uid === uid) return { ...candidate, cell: target }
      // A swap, not a rejection: dragging onto an occupied square is the natural way a
      // player reorders a formation.
      if (occupant !== undefined && candidate.uid === occupant.uid) {
        return { ...candidate, cell: from }
      }
      return candidate
    }),
  }
}

function applyMerge(state: AutobattlerState, typeId: string | undefined): AutobattlerState {
  const { config } = state
  if (typeId === undefined) return state
  const typeIndex = config.units.findIndex((unit) => unit.id === typeId)
  if (typeIndex < 0) return state
  for (let star = 1; star < config.merge.max_star; star += 1) {
    let copies = 0
    for (const unit of state.units) {
      if (unit.typeIndex === typeIndex && unit.star === star) copies += 1
    }
    if (copies >= config.merge.copies_needed) return mergeOnce(state, typeIndex, star)
  }
  return state
}

function applyRefresh(state: AutobattlerState, tick: number): AutobattlerState {
  const { config } = state
  if (state.gold < config.shop.refresh_cost) return state
  const rng = tickRng(state.seed, tick, state.rolls + 1)
  return {
    ...state,
    gold: state.gold - config.shop.refresh_cost,
    goldSpent: state.goldSpent + config.shop.refresh_cost,
    refreshes: state.refreshes + 1,
    shop: rollShop(config, state.level, rng),
    rolls: state.rolls + 1,
  }
}

function applyLevel(state: AutobattlerState): AutobattlerState {
  const { level } = state.config.shop
  if (state.level >= level.max) return state
  if (state.gold < level.xp_cost) return state
  return applyXp({
    ...state,
    gold: state.gold - level.xp_cost,
    goldSpent: state.goldSpent + level.xp_cost,
    xp: state.xp + level.xp_per_purchase,
  })
}

/**
 * Equip a bag item onto a unit, COMBINING when the unit already holds a partner item.
 * That is the report's "camps drop combinable items", kept honest: the recipe lives in
 * the manifest (`combines_with`/`combines_into`), never in this file.
 */
function applyEquip(
  state: AutobattlerState,
  uid: number,
  itemId: string | undefined,
): AutobattlerState {
  const { config } = state
  if (itemId === undefined) return state
  const bagIndex = state.bag.indexOf(itemId)
  if (bagIndex < 0) return state
  const incomingIndex = config.items.findIndex((item) => item.id === itemId)
  const incoming = config.items[incomingIndex]
  if (incoming === undefined) return state
  const unit = state.units.find((candidate) => candidate.uid === uid)
  if (unit === undefined) return state
  if (unit.items.length >= 3) return state

  let items: number[] = [...unit.items, incomingIndex]
  for (const heldIndex of unit.items) {
    const held = config.items[heldIndex]
    if (held === undefined) continue
    const combinedId =
      held.combines_with === itemId
        ? held.combines_into
        : incoming.combines_with === held.id
          ? incoming.combines_into
          : undefined
    if (combinedId === undefined) continue
    const combinedIndex = config.items.findIndex((item) => item.id === combinedId)
    if (combinedIndex < 0) continue
    items = [...unit.items.filter((index) => index !== heldIndex), combinedIndex]
    break
  }

  const bag = [...state.bag.slice(0, bagIndex), ...state.bag.slice(bagIndex + 1)]
  return {
    ...state,
    bag,
    itemsEquipped: state.itemsEquipped + 1,
    units: state.units.map((candidate) =>
      candidate.uid === uid ? { ...candidate, items } : candidate,
    ),
  }
}

function applyPrepAction(
  state: AutobattlerState,
  event: GameInputEvent,
  tick: number,
): AutobattlerState {
  switch (event.action) {
    case 'buy':
      return event.n === undefined ? state : applyBuy(state, event.n)
    case 'sell':
      return event.n === undefined ? state : applySell(state, event.n)
    case 'place':
      return event.n === undefined ? state : applyPlace(state, event.n, event.x, event.y)
    case 'merge':
      return applyMerge(state, event.slot)
    case 'refresh':
      return applyRefresh(state, tick)
    case 'level':
      return applyLevel(state)
    case 'equip':
      return event.n === undefined ? state : applyEquip(state, event.n, event.slot)
    case 'ready':
      return startCombat(state, tick)
    default:
      return state
  }
}

// ---- Battle setup ---------------------------------------------------------------------

function profileOf(config: AutobattlerConfig, profile: string): AutobattlerOpponentProfile {
  const profiles = config.opponent_profiles
  switch (profile) {
    case 'saver':
      return profiles.saver
    case 'rush':
      return profiles.rush
    case 'synergy':
      return profiles.synergy
    case 'mirror':
      return profiles.mirror
    default:
      return profiles.adaptive
  }
}

/**
 * The opponent's power for THIS round: the roster's own `power_pct`, modulated by its
 * personality's early/late curve, its adaptive response to the player's win streak and
 * its always-on synergy bonus. Every one of those numbers is a manifest field.
 */
function opponentPowerPct(
  state: AutobattlerState,
  basePct: number,
  profile: AutobattlerOpponentProfile,
): number {
  const roundNumber = state.round + 1
  const curve = roundNumber >= profile.late_from_round ? profile.late_power_pct : profile.early_power_pct
  const adaptive = profile.adaptive_per_win_pct * state.winStreak
  const total = curve + adaptive + profile.team_bonus_pct
  return Math.max(10, Math.round((basePct * total) / 100))
}

interface EnemyPlan {
  roster: RosterMember[]
  powerPct: number
}

function enemyPlanFor(state: AutobattlerState, rng: Rng): EnemyPlan {
  const { config } = state
  const round = config.rounds[state.round]
  if (round === undefined) return { roster: [], powerPct: 100 }

  if (round.kind === 'pve') {
    const camp = config.camps.find((candidate) => candidate.id === round.camp_id)
    if (camp === undefined) return { roster: [], powerPct: 100 }
    return { roster: rosterFromEntries(config, camp.units), powerPct: camp.power_pct }
  }

  const opponent = config.opponents.find((candidate) => candidate.id === round.opponent_id)
  if (opponent === undefined) return { roster: [], powerPct: 100 }
  const profile = profileOf(config, opponent.profile)
  const powerPct = opponentPowerPct(state, opponent.power_pct, profile)

  if (profile.mirror) {
    // The `mirror` personality fights a copy of the player's own board. Nothing else
    // teaches "your plan has a counter" as directly.
    return { roster: rosterOf(state).map((member) => ({ ...member, items: [] })), powerPct }
  }

  const roster: RosterMember[] = []
  for (const member of rosterFromEntries(config, opponent.units)) {
    // The report's CALIBRATED ERROR RATE: this AI sometimes simply fails to field a
    // unit. Seeded, so it replays exactly.
    if (rng.next() * 100 < opponent.error_rate_pct) continue
    roster.push(member)
  }
  return { roster, powerPct }
}

function rosterFromEntries(
  config: AutobattlerConfig,
  entries: readonly { unit_id: string; star: number; col: number; row: number }[],
): RosterMember[] {
  const out: RosterMember[] = []
  for (const entry of entries) {
    const typeIndex = config.units.findIndex((unit) => unit.id === entry.unit_id)
    if (typeIndex < 0) continue
    out.push({
      typeIndex,
      star: entry.star,
      cell: cellIndexOf(config.board.cols, entry.col, entry.row),
      items: [],
    })
  }
  return out
}

function startCombat(state: AutobattlerState, tick: number): AutobattlerState {
  if (state.phase !== 'prep') return state
  const rng = tickRng(state.seed, tick, state.rolls + 101)
  const playerRoster = rosterOf(state)
  const plan = enemyPlanFor(state, rng)

  const playerBonuses = computeTraitBonuses(state.config, playerRoster)
  const enemyBonuses = computeTraitBonuses(state.config, plan.roster)

  const fighters: AutobattlerFighter[] = []
  let uid = state.nextUid
  for (const member of playerRoster) {
    const fighter = buildFighter({
      config: state.config,
      member,
      roster: playerRoster,
      bonuses: playerBonuses,
      powerPct: 100,
      side: 0,
      uid,
    })
    if (fighter !== null) {
      fighters.push(fighter)
      uid += 1
    }
  }
  for (const member of plan.roster) {
    const fighter = buildFighter({
      config: state.config,
      member,
      roster: plan.roster,
      bonuses: enemyBonuses,
      powerPct: plan.powerPct,
      side: 1,
      uid,
    })
    if (fighter !== null) {
      fighters.push(fighter)
      uid += 1
    }
  }

  return {
    ...state,
    phase: 'combat',
    phaseTick: 0,
    combatSubTick: 0,
    combatTick: 0,
    fighters,
    nextUid: uid,
  }
}

// ---- Combat resolution --------------------------------------------------------------

function distanceSquared(a: AutobattlerFighter, b: AutobattlerFighter): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** Targeting. Ties break on `uid` ASCENDING, always — a stable tie-break is what makes
 *  two engines agree about which of two identical enemies gets hit. */
function pickTargetIndex(
  fighters: readonly AutobattlerFighter[],
  selfIndex: number,
  rule: AutobattlerTargeting,
): number {
  const self = fighters[selfIndex]
  if (self === undefined) return -1
  let best = -1
  let bestKey = 0

  for (const [index, other] of fighters.entries()) {
    if (other.side === self.side || other.hp <= 0) continue
    let key: number
    switch (rule) {
      case 'farthest':
        key = -distanceSquared(self, other)
        break
      case 'lowest_health':
        key = other.hp
        break
      case 'highest_damage':
        key = -other.damage
        break
      case 'lowest_armour':
        key = other.armour
        break
      default:
        key = distanceSquared(self, other)
        break
    }
    const incumbent = best < 0 ? undefined : fighters[best]
    if (
      incumbent === undefined ||
      key < bestKey ||
      (key === bestKey && other.uid < incumbent.uid)
    ) {
      best = index
      bestKey = key
    }
  }
  return best
}

function applyDamage(target: AutobattlerFighter, amount: number, minDamage: number): void {
  const dealt = Math.max(minDamage, Math.round(amount))
  if (dealt <= 0) return
  const absorbed = Math.min(target.shield, dealt)
  target.shield -= absorbed
  const remaining = dealt - absorbed
  if (remaining <= 0) return
  target.hp -= remaining
  target.mana = Math.min(target.manaMax, target.mana + target.manaOnDamaged)
}

function castAbility(
  config: AutobattlerConfig,
  fighters: AutobattlerFighter[],
  selfIndex: number,
  targetIndex: number,
): void {
  const self = fighters[selfIndex]
  if (self === undefined) return
  const type = config.units[self.typeIndex]
  if (type === undefined) return
  const ability = type.ability
  const target = targetIndex < 0 ? undefined : fighters[targetIndex]
  const minDamage = config.combat.min_damage

  switch (ability.kind) {
    case 'burst':
      if (target !== undefined) applyDamage(target, ability.power - target.armour, minDamage)
      break
    case 'splash': {
      if (target === undefined) break
      const radiusSquared = ability.radius * ability.radius
      for (const other of fighters) {
        if (other.side === self.side || other.hp <= 0) continue
        if (distanceSquared(target, other) > radiusSquared) continue
        applyDamage(other, ability.power - other.armour, minDamage)
      }
      break
    }
    case 'heal': {
      let lowest: AutobattlerFighter | undefined
      for (const other of fighters) {
        if (other.side !== self.side || other.hp <= 0) continue
        if (lowest === undefined || other.hp < lowest.hp || (other.hp === lowest.hp && other.uid < lowest.uid)) {
          lowest = other
        }
      }
      if (lowest !== undefined) lowest.hp = Math.min(lowest.maxHp, lowest.hp + ability.power)
      break
    }
    case 'shield':
      self.shield += ability.power
      break
    case 'empower':
      self.bonusDamagePct += ability.power
      break
    default:
      break
  }
}

/**
 * ONE combat tick. Fighters act in ARRAY ORDER (never a Set/Map walk), on a locally
 * cloned array; deaths are removed in a SINGLE pass afterwards so several simultaneous
 * kills are one state transition rather than the first kill plus a stalled battle.
 */
function resolveCombatTick(
  state: AutobattlerState,
  rng: Rng,
): AutobattlerFighter[] {
  const { config } = state
  const fighters = state.fighters.map((fighter) => ({ ...fighter }))

  for (let index = 0; index < fighters.length; index += 1) {
    const self = fighters[index]
    if (self === undefined || self.hp <= 0) continue
    const type = config.units[self.typeIndex]
    if (type === undefined) continue

    const rule: AutobattlerTargeting = type.targeting ?? config.combat.targeting
    const targetIndex = pickTargetIndex(fighters, index, rule)

    // A full mana bar spends the turn: casting instead of attacking keeps the ability
    // legible on screen and keeps one fighter to one action per combat tick.
    if (self.manaMax > 0 && self.mana >= self.manaMax && type.ability.kind !== 'none') {
      castAbility(config, fighters, index, targetIndex)
      self.mana = 0
      continue
    }

    if (targetIndex < 0) continue
    const target = fighters[targetIndex]
    if (target === undefined) continue

    if (distanceSquared(self, target) <= self.range * self.range) {
      if (self.cooldown > 0) {
        self.cooldown -= 1
        continue
      }
      const raw = Math.round((self.damage * (100 + self.bonusDamagePct)) / 100)
      const critical = rng.next() * 100 < config.combat.crit_chance_pct
      const swing = critical ? Math.round((raw * config.combat.crit_multiplier_pct) / 100) : raw
      applyDamage(target, swing - target.armour, config.combat.min_damage)
      self.mana = Math.min(self.manaMax, self.mana + self.manaPerAttack)
      self.cooldown = self.attackInterval - 1
      continue
    }

    const dx = target.x - self.x
    const dy = target.y - self.y
    if (Math.abs(dx) >= Math.abs(dy)) {
      self.x += Math.sign(dx) * Math.min(self.moveSpeed, Math.abs(dx))
    } else {
      self.y += Math.sign(dy) * Math.min(self.moveSpeed, Math.abs(dy))
    }
  }

  // BATCHED REMOVAL — one pass, every death on this tick at once.
  const survivors: AutobattlerFighter[] = []
  for (const fighter of fighters) {
    if (fighter.hp > 0) survivors.push(fighter)
  }
  return survivors
}

function countSide(fighters: readonly AutobattlerFighter[], side: number): number {
  let total = 0
  for (const fighter of fighters) {
    if (fighter.side === side && fighter.hp > 0) total += 1
  }
  return total
}

function resolveRound(
  state: AutobattlerState,
  playerAlive: number,
  enemyAlive: number,
  tick: number,
): AutobattlerState {
  const { config } = state

  let won: boolean
  if (enemyAlive === 0 && playerAlive > 0) won = true
  else if (playerAlive === 0 && enemyAlive > 0) won = false
  else if (config.combat.timeout_result === 'player') won = true
  else if (config.combat.timeout_result === 'enemy') won = false
  else won = playerAlive > enemyAlive

  let health = state.health
  let lives = state.lives
  let winStreak = state.winStreak
  let lossStreak = state.lossStreak
  let bag = state.bag

  if (won) {
    winStreak += 1
    lossStreak = 0
    const round = config.rounds[state.round]
    if (round?.kind === 'pve') {
      const camp = config.camps.find((candidate) => candidate.id === round.camp_id)
      if (camp !== undefined) bag = [...bag, ...camp.drops]
    }
  } else {
    winStreak = 0
    lossStreak += 1
    const damage =
      config.health.base_damage +
      config.health.per_round * state.round +
      config.health.per_survivor * enemyAlive
    health = Math.max(0, health - damage)
    // `lives` is the document's arcade budget of lost rounds; `health` is the report's
    // own damage table, which scales with the round and the surviving enemies and feeds
    // the score. Both can end an arcade run; neither ends a cheer one.
    if (lives !== null) lives = Math.max(0, lives - 1)
  }

  const income = incomePreview(state)
  const interest = interestPreview(state)
  const bonus = won
    ? streakBonus(config.economy.streak.win_bonus, winStreak)
    : streakBonus(config.economy.streak.loss_bonus, lossStreak)

  const settled: AutobattlerState = {
    ...state,
    fighters: [],
    health,
    lives,
    winStreak,
    lossStreak,
    bag,
    roundsWon: state.roundsWon + (won ? 1 : 0),
    roundsLost: state.roundsLost + (won ? 0 : 1),
    gold: state.gold + income + interest + bonus,
    incomeEarned: state.incomeEarned + income,
    interestEarned: state.interestEarned + interest,
    streakEarned: state.streakEarned + bonus,
  }

  const lastRound = state.round + 1 >= config.rounds.length
  // Cheer mode has NO fail state: health still falls (and still costs score) but it can
  // never cut a run short. Arcade mode ends the run at zero, as the report specifies.
  const knockedOut = lives !== null && (lives <= 0 || health <= 0)
  if (lastRound || knockedOut) {
    return { ...settled, phase: 'over' }
  }

  const rng = tickRng(settled.seed, tick, settled.rolls + 1)
  return {
    ...settled,
    phase: 'prep',
    round: settled.round + 1,
    phaseTick: 0,
    combatSubTick: 0,
    combatTick: 0,
    shop: rollShop(config, settled.level, rng),
    rolls: settled.rolls + 1,
  }
}

function advanceCombat(state: AutobattlerState, tick: number): AutobattlerState {
  const { config } = state
  const sub = state.combatSubTick + 1
  // The integer bridge between the engine's 50ms tick and the report's 0.5s combat tick.
  if (sub < config.combat.engine_ticks_per_combat_tick) {
    return { ...state, combatSubTick: sub }
  }

  const rng = tickRng(state.seed, tick, 7)
  const fighters = resolveCombatTick(state, rng)
  const combatTick = state.combatTick + 1
  const next: AutobattlerState = { ...state, fighters, combatSubTick: 0, combatTick }

  const playerAlive = countSide(fighters, 0)
  const enemyAlive = countSide(fighters, 1)
  if (playerAlive === 0 || enemyAlive === 0 || combatTick >= config.combat.max_combat_ticks) {
    return resolveRound(next, playerAlive, enemyAlive, tick)
  }
  return next
}

// ---- Score ------------------------------------------------------------------------------

function computeScore(state: AutobattlerState): number {
  const { config } = state
  const blend = weightedScore([
    {
      value: targetScore(state.roundsWon, config.targets.rounds_won),
      weight: config.score_weights.rounds,
    },
    { value: targetScore(state.health, config.health.start), weight: config.score_weights.health },
    {
      // The LESSON's own signal: how much the player actually earned by saving.
      value: targetScore(state.interestEarned, config.targets.interest),
      weight: config.score_weights.interest,
    },
  ])
  return applyPenalty(blend, state.roundsLost, config.loss_penalty_pct)
}

// ---- The simulator ------------------------------------------------------------------------

function init(input: SimInit): AutobattlerState {
  // The document was validated by `autobattlerConfigSchema`/`autobattlerContentSchema`
  // before it ever reached a simulator (core/schema.ts `parseGameDocument`, and the
  // pipeline's `gate` stage server-side), so this narrows rather than trusts.
  const config = input.config as unknown as AutobattlerConfig
  // `content` is deliberately NOT read here: every number the battle depends on lives in
  // `config`, and every string lives in the view. A simulation that branched on a label
  // would stop being re-skinnable by a manifest.

  const rng = createRng(input.seed)
  return {
    config,
    seed: input.seed,
    phase: 'prep',
    round: 0,
    tick: 0,
    phaseTick: 0,
    combatSubTick: 0,
    combatTick: 0,

    gold: config.economy.start_gold,
    level: 1,
    xp: 0,
    health: config.health.start,
    winStreak: 0,
    lossStreak: 0,
    roundsWon: 0,
    roundsLost: 0,

    shop: rollShop(config, 1, rng),
    rolls: 1,
    units: [],
    nextUid: 1,
    bag: [],

    fighters: [],

    interestEarned: 0,
    incomeEarned: 0,
    streakEarned: 0,
    goldSpent: 0,
    refreshes: 0,
    merges: 0,
    itemsEquipped: 0,

    lives: input.scoring.mode === 'cheer' ? null : (input.scoring.lives ?? null),
    finished: false,
  }
}

function step(
  state: AutobattlerState,
  tick: number,
  events: readonly GameInputEvent[],
): AutobattlerState {
  if (state.finished) return state
  let next: AutobattlerState = { ...state, tick }

  if (next.phase === 'prep') {
    // The WHOLE batch, in log order — never an early return after the first event.
    for (const event of events) next = applyPrepAction(next, event, tick)
    if (next.phase === 'prep') {
      const phaseTick = next.phaseTick + 1
      next = { ...next, phaseTick }
      // A player who stops deciding must never stall the run: preparation times out
      // into the battle rather than holding the round open forever.
      if (phaseTick >= next.config.prep.max_ticks) next = startCombat(next, tick)
    }
  } else if (next.phase === 'combat') {
    // Events during combat are IGNORED, not scored and not rejected: all strategy
    // happens in preparation, so a well-formed log is empty across this whole stretch.
    next = advanceCombat(next, tick)
  }

  const outOfTime = tick + 1 >= next.config.max_ticks
  return { ...next, finished: next.phase === 'over' || outOfTime }
}

function snapshot(state: AutobattlerState): SimSnapshot {
  return {
    finished: state.finished,
    score: computeScore(state),
    lives: state.lives,
    round: Math.min(state.config.rounds.length, state.round + 1),
  }
}

function result(state: AutobattlerState): SimResult {
  return {
    score: computeScore(state),
    finished: state.finished,
    // Derived aggregates ONLY — exactly what `game_attempts.stats` may hold, and never
    // anything tick-resolution about a child's session (GAME_ENGINE.md §11).
    stats: {
      rounds_won: state.roundsWon,
      rounds_lost: state.roundsLost,
      health: state.health,
      gold: state.gold,
      level: state.level,
      interest_earned: state.interestEarned,
      income_earned: state.incomeEarned,
      streak_earned: state.streakEarned,
      gold_spent: state.goldSpent,
      refreshes: state.refreshes,
      merges: state.merges,
      items_equipped: state.itemsEquipped,
      units_owned: state.units.length,
      ticks: state.tick + 1,
    },
  }
}

// ---- Bots (GAME_ENGINE.md §9 winnability gate) ---------------------------------------------

function firstFreeCell(state: AutobattlerState): number {
  const cells = state.config.board.cols * state.config.board.rows
  for (let cell = 0; cell < cells; cell += 1) {
    if (!state.units.some((unit) => unit.cell === cell)) return cell
  }
  return -1
}

/** A single legible strength ordering: stars first, then shop cost. Used by both bots
 *  and by nothing else — it is a heuristic, never part of the simulation. */
function strengthKey(state: AutobattlerState, unit: AutobattlerUnitInstance): number {
  const type = state.config.units[unit.typeIndex]
  if (type === undefined) return -1
  return unit.star * 100 + type.cost * 10 + unit.items.length
}

function strongestOf(
  state: AutobattlerState,
  units: readonly AutobattlerUnitInstance[],
): AutobattlerUnitInstance | undefined {
  let best: AutobattlerUnitInstance | undefined
  let bestKey = -1
  for (const unit of units) {
    const key = strengthKey(state, unit)
    if (key > bestKey) {
      bestKey = key
      best = unit
    }
  }
  return best
}

function weakestOf(
  state: AutobattlerState,
  units: readonly AutobattlerUnitInstance[],
): AutobattlerUnitInstance | undefined {
  let worst: AutobattlerUnitInstance | undefined
  let worstKey = Number.POSITIVE_INFINITY
  for (const unit of units) {
    const key = strengthKey(state, unit)
    if (key < worstKey) {
      worstKey = key
      worst = unit
    }
  }
  return worst
}

/**
 * The `perfect` bot — the half of the §9 gate that proves the game is BEATABLE.
 *
 * It is not a script: it plays the manifest's own economy. The rule it follows is the
 * lesson itself — field a full board first, then keep the interest cap banked and spend
 * only the surplus. `bank` is read straight out of `economy.interest`, so a document
 * that moves the cap moves the bot with it.
 *
 * One action per tick, deliberately: decisions are made against the state BEFORE the
 * tick, so batching several purchases into one tick would let the bot spend gold it no
 * longer has and mask a real affordability bug behind a silently ignored event.
 */
function perfectBot(state: AutobattlerState, tick: number): GameInputEvent[] {
  if (state.finished || state.phase !== 'prep') return []
  const { config } = state
  const bank = config.economy.interest.gold_per_step * config.economy.interest.max_steps
  const cap = unitCapOf(state)
  const placed = placedUnits(state)
  const bench = benchUnits(state)

  if (!config.prep.auto_merge) {
    const mergeable = findMergeable(state)
    if (mergeable !== null) {
      const type = config.units[mergeable.typeIndex]
      if (type !== undefined) return [{ tick, action: 'merge', slot: type.id }]
    }
  }

  // Camp drops are worth nothing in the bag. Equip onto the strongest fielded unit.
  const drop = state.bag[0]
  if (drop !== undefined && placed.length > 0) {
    const holder = strongestOf(state, placed.filter((unit) => unit.items.length < 3))
    if (holder !== undefined) return [{ tick, action: 'equip', n: holder.uid, slot: drop }]
  }

  const promote = strongestOf(state, bench)
  if (promote !== undefined) {
    const free = firstFreeCell(state)
    if (placed.length < cap && free >= 0) {
      return [
        {
          tick,
          action: 'place',
          n: promote.uid,
          x: cellColOf(config.board.cols, free),
          y: cellRowOf(config.board.cols, free),
        },
      ]
    }
    // The board is full at the level cap, so improving it means SWAPPING: `place` onto
    // an occupied square trades the two units, which is how a real player upgrades.
    const weakest = weakestOf(state, placed)
    if (weakest !== undefined && strengthKey(state, promote) > strengthKey(state, weakest)) {
      return [
        {
          tick,
          action: 'place',
          n: promote.uid,
          x: cellColOf(config.board.cols, weakest.cell),
          y: cellRowOf(config.board.cols, weakest.cell),
        },
      ]
    }
  }

  // A bench that is full blocks every future purchase; cash the weakest one in.
  if (bench.length >= config.board.bench_size) {
    const spare = weakestOf(state, bench)
    if (spare !== undefined) return [{ tick, action: 'sell', n: spare.uid }]
  }

  const needsBoard = placed.length + bench.length < cap
  const weakestPlaced = placed.length >= cap ? weakestOf(state, placed) : undefined
  const weakestCost =
    weakestPlaced === undefined ? 0 : (config.units[weakestPlaced.typeIndex]?.cost ?? 0)
  let bestSlot = -1
  let bestKey = -1
  for (const [slot, typeIndex] of state.shop.entries()) {
    if (typeIndex < 0) continue
    const type = config.units[typeIndex]
    if (type === undefined) continue
    if (state.gold < type.cost) continue
    if (bench.length >= config.board.bench_size) continue
    let owned = 0
    for (const unit of state.units) {
      if (unit.typeIndex === typeIndex && unit.star === 1) owned += 1
    }
    // Below the cap the board comes first. Above it, spend only the SURPLUS over the
    // interest cap, and only on something that genuinely improves the board: a copy
    // that stars a unit up, or a unit stronger than the weakest one already fielded.
    const surplus = state.gold - type.cost >= bank
    const worthIt =
      needsBoard || (surplus && (owned > 0 || type.cost > weakestCost))
    if (!worthIt) continue
    const key = owned * 100 + type.cost
    if (key > bestKey) {
      bestKey = key
      bestSlot = slot
    }
  }
  if (bestSlot >= 0) return [{ tick, action: 'buy', n: bestSlot }]

  // Nothing in the shop is worth buying. Reroll — but ONLY with gold the interest cap
  // does not need. Rerolling into the bank is exactly the mistake the lesson warns
  // against, so the bot never does it; rerolling the SURPLUS is the correct play,
  // because gold saved past the cap earns nothing at all.
  if (config.shop.refresh_cost > 0 && state.gold - config.shop.refresh_cost >= bank) {
    return [{ tick, action: 'refresh' }]
  }

  const levelling = config.shop.level
  if (
    placed.length >= cap &&
    state.level < levelling.max &&
    state.gold - levelling.xp_cost >= bank
  ) {
    return [{ tick, action: 'level' }]
  }

  return [{ tick, action: 'ready' }]
}

/**
 * Arbitrary play: UNIFORM over the mechanic's whole action space, with random arguments.
 * It buys at random, sells at random, rerolls the shop for no reason, drops units on
 * random squares and readies whenever the coin says so.
 *
 * Drawing from `AUTOBATTLER_ACTIONS` itself rather than a curated subset is deliberate:
 * a hand-picked "sensible random" would quietly grade the manifest against a player who
 * already knows which buttons matter, which is not what the §9 gate is asking. It must
 * NOT reach `pass_score` — if it does, the manifest is not measuring anything and the
 * pipeline rejects it. Burning gold on rerolls and selling a board it just built is
 * exactly how a mashing player forfeits the interest the lesson is about.
 */
function randomBot(state: AutobattlerState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished || state.phase !== 'prep') return []
  const action = AUTOBATTLER_ACTIONS[rng.int(AUTOBATTLER_ACTIONS.length)]
  if (action === undefined) return []

  const anyUnit = state.units[rng.int(state.units.length)]

  switch (action) {
    case 'buy':
      return [{ tick, action, n: rng.int(state.shop.length) }]
    case 'sell':
      return anyUnit === undefined ? [] : [{ tick, action, n: anyUnit.uid }]
    case 'place':
      return anyUnit === undefined
        ? []
        : [
            {
              tick,
              action,
              n: anyUnit.uid,
              x: rng.int(state.config.board.cols),
              y: rng.int(state.config.board.rows),
            },
          ]
    case 'merge': {
      const type = state.config.units[rng.int(state.config.units.length)]
      return type === undefined ? [] : [{ tick, action, slot: type.id }]
    }
    case 'equip': {
      const held = state.bag[rng.int(state.bag.length)]
      return anyUnit === undefined || held === undefined
        ? []
        : [{ tick, action, n: anyUnit.uid, slot: held }]
    }
    default:
      // `refresh`, `level` and `ready` take no arguments.
      return [{ tick, action }]
  }
}

export const autobattlerSimulator: Simulator<AutobattlerState> = {
  mechanic: 'autobattler',
  actions: AUTOBATTLER_ACTIONS,
  init,
  step,
  snapshot,
  result,
  bots: {
    perfect(state: AutobattlerState, tick: number): GameInputEvent[] {
      return perfectBot(state, tick)
    },
    random(state: AutobattlerState, tick: number, rng: Rng): GameInputEvent[] {
      return randomBot(state, tick, rng)
    },
  },
}
