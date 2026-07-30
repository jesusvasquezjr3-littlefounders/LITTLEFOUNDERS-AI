// `runner` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `runnerSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import type { GameBots, GameInputEvent, Rng } from '../../core/types.js'

import type { RunnerVerticalMotion } from './schema.js'
import { activeMotion, entityTopY, isEntityArmed, speedAt } from './simulate.js'
import type { RunnerEntity, RunnerState } from './simulate.js'

/** Upper bound for the bots' arc search: no configured jump can stay airborne longer
 *  (max impulse 200 / min gravity 1 lands by tick 400). */
const MAX_ARC_TICKS = 400

// ---- Bots ----------------------------------------------------------------------------

/** Vertical displacement `t` ticks after the action, for the integration above:
 *  `offset(t) = impulse*t - gravity*t*(t+1)/2`. `t*(t+1)` is always even, so this is
 *  exact integer arithmetic — the bot and the simulator cannot drift apart. */
function arcAt(motion: RunnerVerticalMotion, t: number): number {
  if (t <= 0) return 0
  return motion.impulse * t - (motion.gravity * t * (t + 1)) / 2
}

/** The window of ticks (after acting) during which the avatar is at least `need` away
 *  from the rest line. `{ t0: -1 }` means the action can never reach that clearance. */
function arcWindow(motion: RunnerVerticalMotion, need: number): { t0: number; t1: number } {
  let t0 = -1
  let t1 = -1
  for (let t = 1; t <= MAX_ARC_TICKS; t += 1) {
    const value = arcAt(motion, t)
    if (value <= 0) break
    if (value >= need) {
      if (t0 < 0) t0 = t
      t1 = t
    }
  }
  return { t0, t1 }
}

interface HazardWindow {
  /** First step index (1 = the tick after acting) at which the boxes overlap in x. */
  first: number
  /** Last such step index. */
  last: number
  entity: RunnerEntity
}

/** The x-overlap window of every armed hazard ahead, nearest first. Distance advances
 *  by exactly `speed` per tick, so this is arithmetic rather than a search. */
function hazardWindows(state: RunnerState, tick: number): HazardWindow[] {
  const config = state.config
  const speed = speedAt(config, tick)
  const front = state.distance + config.world.avatar_x + config.world.avatar_w
  const back = state.distance + config.world.avatar_x
  const out: HazardWindow[] = []
  for (const entity of state.entities) {
    if (entity.role === 'good') continue
    if (!isEntityArmed(entity, state)) continue
    const gapFront = entity.x - front
    const gapBack = entity.x + entity.w - back
    if (gapBack <= 0) continue
    const first = Math.floor(gapFront / speed) + 1
    const last = Math.ceil(gapBack / speed) - 1
    if (last < first) continue
    out.push({ first, last, entity })
  }
  out.sort((a, b) => (a.first === b.first ? a.entity.key - b.entity.key : a.first - b.first))
  return out
}

/**
 * The `perfect` bot — the §9 winnability gate's "this game is beatable" half.
 *
 * It is not a script: it derives, from the manifest's own physics, the window of ticks
 * during which acting NOW would clear the nearest hazard, and acts in the MIDDLE of
 * that window. Acting at either edge would pass on a fixture and fail on a slightly
 * different one, which is exactly the kind of fragile gate that lets an unwinnable game
 * reach a child.
 */
function perfectBot(state: RunnerState, tick: number): GameInputEvent[] {
  if (state.finished) return []
  const act: GameInputEvent[] = [{ tick, action: 'act' }]
  const windows = hazardWindows(state, tick)
  const nearest = windows[0]
  if (nearest === undefined) return []

  if (state.family === 'discrete') {
    if (state.transitionLeft > 0) return []
    const lanes = state.lanes
    if (lanes.length < 2) return []
    const config = state.config
    const speed = speedAt(config, tick)
    const transition = state.transitionTicks
    // Enough lead to finish the switch, plus the ticks the avatar's own width spends
    // inside the hazard's column.
    const lead = transition + Math.ceil(config.world.avatar_w / speed) + 2

    const threatens = (laneIndex: number, window: HazardWindow, until: number): boolean => {
      const laneY = lanes[laneIndex]
      if (laneY === undefined) return false
      if (window.first > until) return false
      const ey = entityTopY(window.entity, tick)
      return laneY < ey + window.entity.h && laneY + config.world.avatar_h > ey
    }

    const current = state.lane
    const candidate = (current + 1) - Math.floor((current + 1) / lanes.length) * lanes.length
    let danger: HazardWindow | null = null
    for (const window of windows) {
      if (threatens(current, window, lead)) {
        danger = window
        break
      }
    }
    if (danger === null) return []
    for (const window of windows) {
      // Refuse to switch into a lane that is blocked over the same stretch.
      if (threatens(candidate, window, danger.last + transition + 2)) return []
    }
    return act
  }

  if (!state.grounded) return []
  const { motion } = activeMotion(state)
  const config = state.config
  const groundY = config.world.ground_y
  const avatarH = config.world.avatar_h

  const ey = entityTopY(nearest.entity, tick)
  // How far from the rest line the avatar must travel to clear this box: over the top
  // when the action lifts, under the bottom when it dives.
  const need =
    motion.dir === 1 ? groundY - ey : ey + nearest.entity.h + avatarH - groundY
  if (need <= 0) return []

  const { t0, t1 } = arcWindow(motion, need)
  if (t0 < 0) return act // unclearable content: act anyway rather than stand still

  const span = nearest.last - nearest.first
  const lo = t0
  const hi = Math.max(lo, t1 - span)
  const targetFirst = Math.floor((lo + hi) / 2)
  return nearest.first <= targetFirst ? act : []
}

/** Chance denominator for the `random` bot: it acts on ~1 tick in 12. Mashing must NOT
 *  be a complete strategy (§9) — this bot is the half of the gate that proves it. */
const RANDOM_ACT_ODDS = 12

function randomBot(state: RunnerState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  return rng.int(RANDOM_ACT_ODDS) === 0 ? [{ tick, action: 'act' }] : []
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<RunnerState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const runnerBots: GameBots<RunnerState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
