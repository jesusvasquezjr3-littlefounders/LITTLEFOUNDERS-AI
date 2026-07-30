// `defender` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `defenderSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import type { DefenderConfig, DefenderTowerType } from './schema'
import {
  TERRAIN_EXIT,
  TERRAIN_ROCK,
  cellCentre,
  cellCol,
  cellRow,
  chooseNextCell,
  isBuildable,
  towerTypeAt,
  wouldSeal,
} from './simulate'
import type { DefenderState } from './simulate'

/** Cells the bots' route walk will follow before giving up. */
const MAX_ROUTE_LENGTH = 400

// ---- Bots -----------------------------------------------------------------------------------

/** How many towers the competent bot is willing to own before it starts banking gold.
 *  Deliberately bounded: a bot that spends every coin the moment it has one would fail
 *  the very savings signal the mechanic scores. */
function botTowerCap(config: DefenderConfig): number {
  return Math.min(10, 2 + config.waves.length * 2)
}

/** The cells the current shortest route actually walks, from every entry. The bots score
 *  a candidate build site by how much of THIS they cover. */
function routeCells(state: DefenderState, dist: readonly number[]): number[] {
  const route: number[] = []
  for (const entry of state.entryCells) {
    let cell = entry
    let steps = 0
    while (steps < MAX_ROUTE_LENGTH) {
      steps += 1
      if (!route.includes(cell)) route.push(cell)
      if ((state.terrain[cell] ?? TERRAIN_ROCK) === TERRAIN_EXIT) break
      const next = chooseNextCell(
        state.config,
        state.cols,
        state.rows,
        state.terrain,
        dist,
        cell,
      )
      if (next < 0 || next === cell) break
      cell = next
    }
  }
  return route
}

interface BotChoice {
  type: DefenderTowerType
  cost: number
}

/**
 * What the competent bot buys next, in priority order:
 *  1. an ANSWER to a threat it has none for (air, then stealth) — a gap that no amount
 *     of extra damage fixes;
 *  2. one ECONOMY tower before the first wave, if it can still afford a weapon after —
 *     the lesson the mechanic teaches, played;
 *  3. otherwise the best damage per gold per tick.
 */
function pickTowerType(state: DefenderState): BotChoice | null {
  const config = state.config
  const flyers = config.enemies.some((enemy) => enemy.behavior?.flying === true)
  const stealth = config.enemies.some((enemy) => enemy.behavior?.stealth === true)
  const haveAir = state.towers.some((tower) => tower.targetsAir && tower.damage > 0)
  const haveStealth = state.towers.some((tower) => tower.detectsStealth && tower.damage > 0)
  const haveGround = state.towers.some((tower) => tower.targetsGround && tower.damage > 0)

  const cheapest = (predicate: (type: DefenderTowerType) => boolean): BotChoice | null => {
    let best: DefenderTowerType | null = null
    for (const type of config.towers) {
      if (!predicate(type)) continue
      if (best === null || type.cost < best.cost) best = type
    }
    return best === null ? null : { type: best, cost: best.cost }
  }

  if (!haveGround) {
    const pick = cheapest((type) => type.targets_ground && type.damage > 0)
    if (pick !== null) return pick
  }
  if (flyers && !haveAir) {
    const pick = cheapest((type) => type.targets_air && type.damage > 0)
    if (pick !== null) return pick
  }
  if (stealth && !haveStealth) {
    const pick = cheapest((type) => type.detects_stealth === true && type.damage > 0)
    if (pick !== null) return pick
  }
  if (state.wavesStarted <= 1 && !state.towers.some((tower) => tower.income > 0)) {
    const pick = cheapest((type) => (type.income_per_wave ?? 0) > 0)
    if (pick !== null) return pick
  }

  let best: DefenderTowerType | null = null
  let bestValue = -1
  for (const type of config.towers) {
    if (type.damage <= 0 || !type.targets_ground) continue
    const value = (type.damage * 1000) / (type.fire_interval_ticks * type.cost)
    if (best === null || value > bestValue) {
      best = type
      bestValue = value
    }
  }
  return best === null ? null : { type: best, cost: best.cost }
}

/**
 * The build site: the free, buildable cell covering the most route, ties resolved to the
 * lowest cell index, and the first such cell that does not seal the path.
 *
 * EVERY free cell is a candidate, including the ones covering nothing — an economy tower
 * has range 0 and covers no route at all, and a "best coverage" filter that dropped it
 * would leave the bot with an unaffordable pick it could never place and no fallback,
 * i.e. a run in which it never builds anything again.
 */
function pickBuildCell(state: DefenderState, range: number, blocks: boolean): number {
  const route = routeCells(state, state.dist)
  const rangeSq = range * range
  const candidates: { cell: number; cover: number }[] = []
  const size = state.cols * state.rows
  for (let cell = 0; cell < size; cell += 1) {
    if (!isBuildable(state.terrain, cell)) continue
    if ((state.towerAt[cell] ?? 0) !== 0 || (state.wallAt[cell] ?? 0) > 0) continue
    const centre = cellCentre(state.cols, cell)
    let cover = 0
    for (const routeCell of route) {
      const target = cellCentre(state.cols, routeCell)
      const dx = target.x - centre.x
      const dy = target.y - centre.y
      if (dx * dx + dy * dy <= rangeSq) cover += 1
    }
    candidates.push({ cell, cover })
  }
  candidates.sort((a, b) => (a.cover === b.cover ? a.cell - b.cell : b.cover - a.cover))

  let attempts = 0
  for (const candidate of candidates) {
    if (attempts >= 8) break
    if (!blocks) return candidate.cell
    attempts += 1
    if (!wouldSeal(state, candidate.cell, state.towers, state.towerAt, state.wallAt, state.enemies)) {
      return candidate.cell
    }
  }
  return -1
}

/**
 * The §9 winnability gate's competent player. It answers every threat class the manifest
 * declares, buys the economy tower the lesson is about, places for coverage, upgrades the
 * tower it already owns when a branch is cheaper than a new tower, and then BANKS the
 * rest — which is what the score's economy signal is measuring.
 *
 * One action per tick keeps the log small and its intent readable in a bot trace.
 */
function perfectBot(state: DefenderState, tick: number): GameInputEvent[] {
  if (state.finished) return []

  const cap = botTowerCap(state.config)
  if (state.towers.length < cap) {
    const choice = pickTowerType(state)
    if (choice !== null && state.gold >= choice.cost) {
      const blocks = state.config.build.towers_block_path && choice.type.blocks_path
      const cell = pickBuildCell(state, choice.type.range_mcells, blocks)
      if (cell >= 0) {
        return [
          {
            tick,
            action: 'build_tower',
            slot: choice.type.id,
            x: cellCol(state.cols, cell),
            y: cellRow(state.cols, cell),
          },
        ]
      }
    }
    return []
  }

  // The board is built. Upgrade the earliest tower with an affordable next rung, keeping
  // a reserve so the savings signal still has something to pay for.
  const reserve = state.config.efficiency.gold_surplus_target
  for (const tower of state.towers) {
    const type = towerTypeAt(state.config, tower.typeIndex)
    const branches = type?.upgrades
    if (branches === undefined) continue
    const branch =
      tower.branchId === null
        ? branches[0]
        : branches.find((candidate) => candidate.id === tower.branchId)
    if (branch === undefined) continue
    const tier = branch.tiers[tower.branchTier]
    if (tier === undefined) continue
    if (state.gold - tier.cost < reserve) continue
    return [
      {
        tick,
        action: 'upgrade',
        slot: branch.id,
        x: cellCol(state.cols, tower.cell),
        y: cellRow(state.cols, tower.cell),
      },
    ]
  }
  return []
}

/**
 * Arbitrary play: most ticks it does nothing, otherwise it taps a random cell with a
 * random purchase. It must NOT reach `pass_score` — if it does, the manifest is not
 * measuring anything and the pipeline rejects it.
 */
function randomBot(state: DefenderState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (rng.next() < 0.7) return []

  const size = state.cols * state.rows
  const cell = rng.int(size)
  const x = cellCol(state.cols, cell)
  const y = cellRow(state.cols, cell)
  const roll = rng.int(4)

  if (roll === 0) return [{ tick, action: 'build_wall', x, y }]
  if (roll === 1) return [{ tick, action: 'sell', x, y }]
  const type = state.config.towers[rng.int(state.config.towers.length)]
  if (type === undefined) return []
  return [{ tick, action: 'build_tower', slot: type.id, x, y }]
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<DefenderState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const defenderBots: GameBots<DefenderState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
