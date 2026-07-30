// `launcher` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `launcherSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import { dcos, dsin } from '../../core/mathd.js'
import type { GameBots, GameInputEvent, Rng } from '../../core/types.js'

import type { LauncherProjectileConfig } from './schema.js'
import {
  activeProjectile,
  circleHitsRect,
  environmentAt,
  hitsTargetShape,
  integrateFlight,
  launchVelocity,
  muzzlePoint,
  reflectOffRect,
  targetRect,
} from './simulate.js'
import type { LauncherState, Rect, Vec } from './simulate.js'

// ---- Bots ------------------------------------------------------------------------------------------------

interface ShotPrediction {
  /** Correct targets the shot would damage (direct hit plus any blast). */
  correct: number
  /** Misconception targets it would damage — the bot refuses these outright. */
  incorrect: number
}

/**
 * What a shot at (angle, power) fired on `tick` would do. It calls the SAME
 * `integrateFlight`, the SAME `targetRect` and the SAME collision primitives as the
 * live flight, so a prediction that says "this clears the wall and lands on the savings
 * jar" is not an estimate — it is the flight, run early.
 *
 * Deliberately simplified in one place: it resolves the FIRST impact and its blast, and
 * does not model splitting fragments. A splitting projectile therefore only ever scores
 * BETTER than the bot predicted, which is the safe direction for a winnability gate.
 */
function predictShot(
  state: LauncherState,
  angle: number,
  power: number,
  tick: number,
): ShotPrediction {
  const config = state.config
  const kind = activeProjectile(state)
  const prediction: ShotPrediction = { correct: 0, incorrect: 0 }
  if (kind === null) return prediction

  const env = environmentAt(config, state.round)
  const muzzle = muzzlePoint(state)
  const { vx, vy } = launchVelocity(config, kind, angle, power)
  const offset = kind.radius + 2
  let now: Vec = {
    x: muzzle.x + offset * dcos(angle),
    y: muzzle.y - offset * dsin(angle),
    vx,
    vy,
  }
  let bounces = 0

  for (let i = 0; i < config.physics.max_flight_ticks; i += 1) {
    const at = tick + i
    const prev = now
    now = integrateFlight(prev, env, kind, 0, at)

    if (
      now.x < -kind.radius ||
      now.x > config.world.width + kind.radius ||
      now.y > config.world.height + kind.radius
    ) {
      return prediction
    }

    if (now.y + kind.radius >= config.world.ground_y) {
      if (bounces < kind.bounces) {
        const restitution = (env.groundRestitution * kind.restitution_permille) / 1000 / 1000
        const keep = (1000 - env.groundFriction) / 1000
        now = {
          x: now.x,
          y: config.world.ground_y - kind.radius - 1,
          vx: now.vx * keep,
          vy: -Math.abs(now.vy) * restitution,
        }
        bounces += 1
      } else {
        return blastPrediction(state, kind, now, at, prediction)
      }
    }

    let stopped = false
    for (const obstacle of state.obstacles) {
      const rect: Rect = { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h }
      if (!circleHitsRect(now.x, now.y, kind.radius, rect)) continue
      if (obstacle.material === 'deflect' && bounces < kind.bounces) {
        now = reflectOffRect(
          now,
          prev,
          kind.radius,
          rect,
          obstacle.restitution,
          kind.restitution_permille,
          obstacle.friction,
        )
        bounces += 1
        break
      }
      if (obstacle.material === 'absorb') return prediction
      stopped = true
      break
    }
    if (stopped) return blastPrediction(state, kind, now, at, prediction)

    for (const target of state.targets) {
      if (target.hp <= 0) continue
      const rect = targetRect(target, at, state.draws)
      if (!hitsTargetShape(target.shape, rect, now.x, now.y, kind.radius)) continue
      if (target.role === 'correct') prediction.correct += 1
      else prediction.incorrect += 1
      return blastPrediction(state, kind, now, at, prediction)
    }
  }
  return prediction
}

/** Folds an explosive projectile's blast into a prediction. */
function blastPrediction(
  state: LauncherState,
  kind: LauncherProjectileConfig,
  at: Vec,
  tick: number,
  prediction: ShotPrediction,
): ShotPrediction {
  const explosive = kind.explosive
  if (explosive === undefined) return prediction
  for (const target of state.targets) {
    if (target.hp <= 0) continue
    const rect = targetRect(target, tick, state.draws)
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const reach = explosive.radius + Math.max(rect.w, rect.h) / 2
    const dx = cx - at.x
    const dy = cy - at.y
    if (dx * dx + dy * dy > reach * reach) continue
    if (target.role === 'correct') prediction.correct += 1
    else prediction.incorrect += 1
  }
  return prediction
}

/**
 * The `perfect` bot — the §9 winnability gate's "this game is beatable" half.
 *
 * It is not a script and it holds no answer key: it sweeps the manifest's OWN discrete
 * aim grid (`min_angle`→`max_angle` by `angle_step`, `min_power`→`max_power` by
 * `power_step`), predicts each candidate with the simulator's own physics, and takes the
 * first shot that damages a correct target while touching no misconception target. A
 * scripted "fire at 45°" bot would pass one fixture and fail the next, which is exactly
 * the fragile gate that lets an unwinnable game reach a child.
 *
 * When nothing in the grid can reach a correct target it still fires the safest
 * available shot (one that hits no misconception): standing still would stall the round
 * until its tick budget expired and hide the real failure behind a timeout.
 */
function perfectBot(state: LauncherState, tick: number): GameInputEvent[] {
  if (state.finished) return []
  if (state.projectiles.length > 0) return []
  if (state.cooldownLeft > 0) return []
  if (state.shotsLeft <= 0) return []

  const l = state.config.launcher
  let fallback: GameInputEvent | null = null

  for (let angle = l.min_angle; angle <= l.max_angle; angle += l.angle_step) {
    for (let power = l.min_power; power <= l.max_power; power += l.power_step) {
      const prediction = predictShot(state, angle, power, tick)
      if (prediction.incorrect > 0) continue
      if (prediction.correct > 0) {
        return [{ tick, action: 'launch', x: angle, y: power }]
      }
      if (fallback === null) fallback = { tick, action: 'launch', x: angle, y: power }
    }
  }
  return fallback === null ? [] : [fallback]
}

/** Chance denominator for the `random` bot: it fires on ~1 tick in 10 while it is able
 *  to. Flailing must NOT be a complete strategy (§9) — this bot is the half of the gate
 *  that proves it. */
const RANDOM_FIRE_ODDS = 10

function randomBot(state: LauncherState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (state.projectiles.length > 0) return []
  if (state.cooldownLeft > 0) return []
  if (state.shotsLeft <= 0) return []
  if (rng.int(RANDOM_FIRE_ODDS) !== 0) return []

  const l = state.config.launcher
  const angleSteps = Math.floor((l.max_angle - l.min_angle) / l.angle_step) + 1
  const powerSteps = Math.floor((l.max_power - l.min_power) / l.power_step) + 1
  return [
    {
      tick,
      action: 'launch',
      x: l.min_angle + rng.int(angleSteps) * l.angle_step,
      y: l.min_power + rng.int(powerSteps) * l.power_step,
    },
  ]
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<LauncherState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const launcherBots: GameBots<LauncherState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
