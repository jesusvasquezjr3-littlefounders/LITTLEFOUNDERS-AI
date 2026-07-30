// `flyer` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `flyerSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import { dsin } from '@/game-engine/core/mathd'
import type { GameBots, GameInputEvent, Rng } from '@/game-engine/core/types'

import type { FlyerElementRole } from './schema'
import {
  FLYER_ACTIONS,
  beamBox,
  clamp,
  laneMatches,
  mountCentreY,
  mountLeftX,
} from './simulate'
import type { FlyerEntity, FlyerState } from './simulate'

// ---- Bots ------------------------------------------------------------------------------------

/** How far ahead the perfect bot plans, in ticks. Long enough to cross the sky, short
 *  enough that it does not chase a token three patterns away. */
const PLAN_TICKS = 46

/** How far ahead it looks for something about to hit it, in ticks. Longer than the time
 *  a full dodge takes, or the dodge would start too late to finish. */
const DODGE_TICKS = 28

/** Vertical slack, in design units, before the bot bothers to correct. Without it the
 *  bot would re-command every tick and burn the energy budget it is supposed to husband. */
const AIM_DEADBAND = 18

/** Padding added around a hazard's box when deciding whether it is in the way, and when
 *  choosing how far past it to aim. */
const DODGE_MARGIN = 12

/** Below this fraction of capacity the bot stops climbing and goes looking for a
 *  thermal or a glide — the same call the mechanic asks a child to make. */
const LOW_ENERGY_FRACTION = 0.35

/** Speed headroom over the stall speed at which the bot pre-emptively lowers the nose. */
const STALL_MARGIN = 1.3

/** Design units of clearance the bot keeps from the ground and the ceiling. Without it a
 *  low-energy glide aims AT the floor, and meeting the ground is a hit — the bot would
 *  then spend the run being billed for the manoeuvre it chose to save energy. */
const EDGE_CLEARANCE = 40

interface Threat {
  entity: FlyerEntity
  /** World-x gap from the mount's nose. */
  gap: number
}

/** Everything relevant ahead of the mount, nearest first. Deterministic order: the
 *  sort tie-breaks on the entity key, never on insertion order. */
function ahead(state: FlyerState, roles: readonly FlyerElementRole[], horizon: number): Threat[] {
  const front = mountLeftX(state)
  const out: Threat[] = []
  for (const entity of state.entities) {
    if (!roles.includes(entity.role)) continue
    const gap = entity.x + entity.w - front
    if (gap <= 0 || gap > horizon) continue
    out.push({ entity, gap })
  }
  out.sort((a, b) => (a.gap === b.gap ? a.entity.key - b.entity.key : a.gap - b.gap))
  return out
}

function centreOf(entity: FlyerEntity): number {
  return entity.y + entity.h / 2
}

/** Design units of altitude the mount gains or loses per tick at its commanded pitch —
 *  derived from the manifest's own lift and climb pitch, never a tuned constant, so the
 *  bot stays honest on a re-skinned document. */
function climbRateOf(state: FlyerState): number {
  const rate = state.config.flight.lift_per_tick * state.speed * dsin(state.config.flight.climb_pitch_deg)
  return Math.max(0.5, rate)
}

/**
 * The `perfect` bot — the §9 winnability gate's "this game is beatable" half.
 *
 * It is not a script: every decision is derived from the manifest's own numbers. In
 * priority order it (1) refuses to stall, (2) dodges whatever is about to hit it,
 * (3) refuels when the reserve runs low — riding a thermal when one is ahead and
 * gliding otherwise, which is exactly the trade the mechanic teaches — and only then
 * (4) steers onto the nearest concept token, (5) switches lane when the token or the
 * danger is in another one, and (6) shoots what is in front of it. Commands are only
 * issued when the previous one has expired, so it husbands the energy budget the score
 * measures instead of mashing.
 */
function perfectBot(state: FlyerState, tick: number): GameInputEvent[] {
  if (state.finished) return []
  const config = state.config
  const world = config.world
  const out: GameInputEvent[] = []
  const centre = mountCentreY(state)
  const horizon = Math.max(120, state.speed * PLAN_TICKS)
  const lowest = world.floor_y - world.mount_h / 2 - EDGE_CLEARANCE
  const highest = world.ceiling_y + world.mount_h / 2 + EDGE_CLEARANCE

  // --- weapons first: they never conflict with steering ---------------------------
  const combatants = ahead(state, ['enemy'], config.armament.projectile.range_units)
  const target = combatants.find(
    (candidate) =>
      laneMatches(state, candidate.entity.lane) &&
      Math.abs(centreOf(candidate.entity) - centre) <= candidate.entity.h / 2 + world.mount_h,
  )
  if (
    target !== undefined &&
    config.armament.projectile.enabled &&
    state.shotCooldown <= 0 &&
    state.energy >= config.armament.projectile.energy_cost * 2
  ) {
    out.push({ tick, action: 'fire' })
  }
  if (config.armament.beam.enabled) {
    const box = beamBox(state)
    const inBeam = combatants.some(
      (candidate) =>
        laneMatches(state, candidate.entity.lane) &&
        candidate.entity.x < box.x + box.w &&
        candidate.entity.x + candidate.entity.w > box.x &&
        candidate.entity.y < box.y + box.h &&
        candidate.entity.y + candidate.entity.h > box.y,
    )
    const rich = state.energy > state.energyCapacity * 0.5
    if (!state.beamOn && inBeam && rich) out.push({ tick, action: 'beam_start' })
    if (state.beamOn && (!inBeam || state.energy < state.energyCapacity * 0.2)) {
      out.push({ tick, action: 'beam_end' })
    }
  }

  // --- steering --------------------------------------------------------------------
  const stallRisk = state.stalled || state.speed < config.flight.stall.speed * STALL_MARGIN
  const climbRate = climbRateOf(state)
  const lowEnergy = state.energy < state.energyCapacity * LOW_ENERGY_FRACTION

  // 1. The token to fly through: the nearest one it can actually REACH in the time it
  //    has. Chasing an unreachable token costs energy and delivers nothing, so an
  //    out-of-range one is skipped in favour of the next.
  let token: Threat | undefined
  for (const candidate of ahead(state, ['good'], horizon)) {
    if (config.lanes.enabled && Math.abs(candidate.entity.lane - state.laneTarget) > 1) continue
    const ticksToArrive = candidate.gap / Math.max(0.5, state.speed)
    if (Math.abs(centreOf(candidate.entity) - centre) <= climbRate * ticksToArrive + AIM_DEADBAND) {
      token = candidate
      break
    }
  }

  const thermal = ahead(state, ['thermal'], horizon)[0]
  let desired = token === undefined ? centre : centreOf(token.entity)
  // Refuel ONLY when the plan would cost energy. A token at or below the current
  // altitude is free to reach, so a low reserve is no reason to abandon it; a token
  // above it is a purchase, and with the reserve low the right move is to ride a
  // thermal or trade altitude back for energy first. That is the same "spend now or
  // glide and recover" call the mechanic asks the child to make.
  if (lowEnergy && desired < centre - AIM_DEADBAND) {
    desired = thermal === undefined ? centre + 70 : centreOf(thermal.entity)
  }

  // 2. Dodging overrides the plan, and picks the side of the hazard NEARER the plan, so
  //    a dodge and a pickup are the same manoeuvre whenever the geometry allows it.
  const hazards = ahead(state, ['obstacle', 'bad', 'enemy'], Math.max(140, state.speed * DODGE_TICKS))
  const blocking = hazards.find((candidate) => {
    if (!laneMatches(state, candidate.entity.lane)) return false
    const top = candidate.entity.y - DODGE_MARGIN
    const bottom = candidate.entity.y + candidate.entity.h + DODGE_MARGIN
    return state.altitude + world.mount_h > top && state.altitude < bottom
  })
  const canClimb = state.energy > config.energy.manoeuvre_cost * 2
  if (blocking !== undefined) {
    const over = blocking.entity.y - world.mount_h / 2 - DODGE_MARGIN
    const under = blocking.entity.y + blocking.entity.h + world.mount_h / 2 + DODGE_MARGIN
    // Going OVER needs a climb, and a climb needs a reserve. With the reserve empty the
    // only honest dodge is the one gravity pays for.
    const overOk = over >= highest && canClimb
    const underOk = under <= lowest
    if (overOk && underOk) {
      desired = Math.abs(over - desired) <= Math.abs(under - desired) ? over : under
    } else if (overOk) desired = over
    else if (underOk) desired = under
  }

  // 3. Never fly THROUGH a trap on the way to a token. Step 2 only looks at where the
  //    mount IS; this looks at the path it is about to take, and holds the mount on its
  //    current side of the hazard until the hazard is behind it. Without this a bot
  //    climbs to the token above and collects the misconception on the way up — which is
  //    exactly the mistake the content is trying to teach a child NOT to make.
  for (const candidate of hazards) {
    if (candidate.entity.role !== 'bad' && candidate.entity.role !== 'obstacle') continue
    if (!laneMatches(state, candidate.entity.lane)) continue
    const over = candidate.entity.y - world.mount_h / 2 - DODGE_MARGIN
    const under = candidate.entity.y + candidate.entity.h + world.mount_h / 2 + DODGE_MARGIN
    const crossing = (centre <= over && desired > over) || (centre >= under && desired < under)
    const inside = desired > over && desired < under
    if (!crossing && !inside) continue
    desired = centre <= over ? Math.min(desired, over) : Math.max(desired, under)
  }
  desired = clamp(desired, highest, lowest)

  const wantsClimb = desired < centre - AIM_DEADBAND
  const wantsDive = desired > centre + AIM_DEADBAND

  if (stallRisk && !state.stalled) {
    // Never argue with the stall: lower the nose and let the dive buy the speed back.
    if (state.commandLeft <= 0 || state.commandPitch > 0) out.push({ tick, action: 'dive' })
  } else {
    // Re-command when the previous one has expired OR when it is pulling the wrong way
    // by a wide margin — waiting out a wrong command is how a bot misses a token it
    // could have made, but overriding on every wobble is how it burns the energy budget.
    const error = Math.abs(desired - centre)
    const wrongWay = error > AIM_DEADBAND * 2
    if (wantsClimb && canClimb && (state.commandLeft <= 0 || (wrongWay && state.commandPitch < 0))) {
      out.push({ tick, action: 'climb' })
    } else if (wantsDive && (state.commandLeft <= 0 || (wrongWay && state.commandPitch > 0))) {
      out.push({ tick, action: 'dive' })
    }
  }

  // --- yaw --------------------------------------------------------------------------
  if (config.lanes.enabled && config.lanes.count > 1) {
    const settled = Math.abs(state.lanePos - state.laneTarget) < 0.2
    if (settled) {
      const escaping = blocking !== undefined
      const wanted =
        escaping
          ? (state.laneTarget + 1) - Math.floor((state.laneTarget + 1) / config.lanes.count) * config.lanes.count
          : token === undefined
            ? state.laneTarget
            : token.entity.lane
      if (wanted !== state.laneTarget) out.push({ tick, action: 'lane', n: wanted })
    }
  }

  return out
}

/** Chance denominator for the `random` bot: it acts on ~1 tick in 5. Mashing must NOT
 *  be a complete strategy (§9) — this bot is the half of the gate that proves it. */
const RANDOM_ACT_ODDS = 5

function randomBot(state: FlyerState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (rng.int(RANDOM_ACT_ODDS) !== 0) return []
  const action = FLYER_ACTIONS[rng.int(FLYER_ACTIONS.length)] ?? 'climb'
  if (action === 'lane') return [{ tick, action, n: rng.int(Math.max(1, state.config.lanes.count)) }]
  return [{ tick, action }]
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<FlyerState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const flyerBots: GameBots<FlyerState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
