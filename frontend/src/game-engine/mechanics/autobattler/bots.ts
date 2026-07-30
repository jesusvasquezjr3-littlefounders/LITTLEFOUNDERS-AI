// `autobattler` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `autobattlerSimulator`, `register.ts` pulled them into the mechanic's lazy
// chunk and the browser shipped a working cheat: lift the function out of the emitted
// JS, run it headless, POST the log, collect the XP without ever playing.
//
// The bots exist for the `simulate` winnability gate (gamegen) and for the test suites.
// Neither runs in a browser, so both import THIS module directly, and nothing on the
// client import graph — `register.ts`, `components.tsx`, `GamePlayer` — may reference
// it. `Simulator` has no `bots` member at all (core/types.ts), so a bot-less simulator
// is the NORMAL shape: that is what stops the leak from being re-opened by someone
// helpfully "completing" the simulator literal.
//
// Everything here is still bound by the §5 determinism contract. The bots drive the same
// `step()` the browser and Core run, so a bot reaching for `Math.random()` would make the
// gate measure a run nobody can reproduce.

import type { GameBots, GameInputEvent, Rng } from '@/game-engine/core/types'

import {
  AUTOBATTLER_ACTIONS,
  benchUnits,
  cellColOf,
  cellRowOf,
  findMergeable,
  placedUnits,
  unitCapOf,
} from './simulate'
import type { AutobattlerState, AutobattlerUnitInstance } from './simulate'

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

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<AutobattlerState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const autobattlerBots: GameBots<AutobattlerState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
