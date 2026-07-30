// `launcher` — the PURE simulator (GAME_ENGINE.md §5, brief §4).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no I/O, no mutation of the
// state handed in. Fixed 50ms ticks. Only the §5-allowed arithmetic; every piece of
// trigonometry goes through `core/mathd.ts` (`dsin`, `dcos`, `datan2`, `dhypot`),
// because ECMAScript leaves `Math.sin`/`cos`/`atan2`/`hypot` implementation-defined and
// one wrong bit in a projectile arc is a rejected reward for an honest child.
//
// INTEGRATOR (documented, per §4's "documented integrator"): SEMI-IMPLICIT (symplectic)
// EULER at the fixed tick — velocity is updated first, then position is advanced with
// the NEW velocity:
//     v' = (v + a) * (1 - drag)          a = gravity + wind + steering
//     p' = p + v'
// Explicit Euler drifts energy upward on a ballistic arc; RK4 costs four evaluations
// for an accuracy nobody can see at 20 frames per second. Semi-implicit Euler is
// one evaluation, stable for gravity, and — decisively — it is built from `+`, `-`,
// `*` and `/` only, so it is bit-identical in the browser's V8 and in Node.
//
// Two engine-level rules the kernel documents and this file honours:
//  - PER-ENTITY TIMERS. A moving target's phase is `tick - target.bornAt` and a guided
//    projectile's steering window is its own `guidedLeft` counter. There is no shared
//    accumulator anywhere, so N entities never advance N times too fast.
//  - BATCHED REMOVALS. Every projectile is resolved against working copies of the
//    targets and obstacles, blasts are applied afterwards, and the survivors are
//    produced in ONE filter at the end of the tick — so two targets destroyed on the
//    same tick are one state transition rather than the first one plus a stalled world.
//
// RANDOMNESS. Dressing a layout (which catalog item a target carries) and the erratic
// motion both need a seeded stream, but a live `Rng` object held in state would be a
// mutable box smuggled through a "pure" `step`. So `init` draws a fixed TAPE of values
// and the state carries only an integer cursor into it; erratic motion indexes the tape
// by (entity key, time slot) rather than consuming the cursor at all, which is what
// keeps it a pure function of the tick. The tape wraps, so it can never run dry.

import { dcos, datan2, dhypot, dsin } from '../../core/mathd.js'
import { createRng } from '../../core/rng.js'
import {
  accuracyScore,
  applyPenalty,
  comboMultiplier,
  efficiencyScore,
  targetScore,
  weightedScore,
} from '../../core/scoring.js'
import type {
  GameInputEvent,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '../../core/types.js'

import type {
  LauncherConfig,
  LauncherContent,
  LauncherMaterial,
  LauncherProjectileConfig,
  LauncherRound,
  LauncherShape,
  LauncherTargetMotion,
  LauncherTargetRole,
} from './schema.js'

/**
 * The five logical inputs.
 *  - `aim`    x = degrees above the horizon, y = power percent (both quantized here).
 *  - `launch` fires; may carry x/y so a slingshot release is ONE event rather than a
 *             stream of aim updates followed by a fire.
 *  - `move`   n = -1 | +1, one step along the launcher's limited axis.
 *  - `select` slot = a `config.projectiles[].id` — which ammo is loaded.
 *  - `nudge`  n = -1 | +1, the in-flight correction a `guided` projectile accepts.
 * All five stay valid actions even when a manifest disables the feature (no movement
 * axis, no guided ammo), so a log recorded by a client that emitted them replays
 * instead of being rejected for an `unknown_action`.
 */
export const LAUNCHER_ACTIONS = ['aim', 'launch', 'move', 'select', 'nudge'] as const

/** Draws reserved per tick on the random tape. Layout dressing costs one draw per
 *  target at round load and nothing afterwards, so 2 is generous headroom; the tape
 *  wraps rather than overflowing, which keeps a pathological manifest deterministic
 *  instead of undefined. */
const DRAWS_PER_TICK = 2

/** Ceiling on the blasts resolved in a single tick — a pathological chain must degrade
 *  to a shorter chain, never to a frozen main thread. */
const MAX_BLASTS_PER_TICK = 24

/** Nudge inputs collapsed per tick: a child mashing both directions cancels out, and a
 *  child holding one direction gets exactly one unit of steering per tick. */
const MAX_STEER_UNITS = 1

// ---- State ---------------------------------------------------------------------------

export interface LauncherTarget {
  /** Monotonic within a run: identity for a batched removal, never an array index. */
  key: number
  id: string
  role: LauncherTargetRole
  /** The catalog item this target represents, or null when the manifest bound none. */
  itemId: string | null
  shape: LauncherShape
  /** Resting top-left; motion is an offset around it. */
  baseX: number
  baseY: number
  w: number
  h: number
  hp: number
  maxHp: number
  value: number
  motion: LauncherTargetMotion
  axis: 'x' | 'y'
  amplitude: number
  /** Already scaled by the round's `target_speed_permille`. */
  periodTicks: number
  /** The tick this target entered play — its OWN timer base. */
  bornAt: number
  imageSlot: string | null
  icon: string | null
}

export interface LauncherObstacle {
  key: number
  id: string
  x: number
  y: number
  w: number
  h: number
  material: LauncherMaterial
  hp: number
  restitution: number
  friction: number
  chain: boolean
  imageSlot: string | null
  icon: string | null
}

export interface LauncherProjectile {
  key: number
  /** `config.projectiles[].id` — the tuning this shot flies with. */
  projectileId: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  bornAt: number
  bounces: number
  /** Ticks of steering left (guided ammo only) — a per-entity timer. */
  guidedLeft: number
  /** Has this shot already damaged a target? Drives the miss count. */
  hitTarget: boolean
  /** Fragments never split again and never count as a miss of their own. */
  isFragment: boolean
}

export interface LauncherState {
  config: LauncherConfig
  correctIds: readonly string[]
  incorrectIds: readonly string[]
  /** The seeded random tape (see the module note). */
  draws: readonly number[]
  drawCursor: number

  tick: number
  round: number
  roundStartTick: number
  targets: readonly LauncherTarget[]
  obstacles: readonly LauncherObstacle[]
  projectiles: readonly LauncherProjectile[]
  nextKey: number

  angle: number
  power: number
  launcherX: number
  launcherY: number
  ammoIndex: number
  cooldownLeft: number

  shotsLeft: number
  shotsFired: number
  shotBudget: number
  points: number
  combo: number
  comboBest: number
  correctHits: number
  incorrectHits: number
  correctDestroyed: number
  correctTotal: number
  misses: number
  usefulBounces: number
  roundsCleared: number

  lives: number | null
  finished: boolean
}

/** Everything the integrator reads, after the round's overrides are folded in. */
export interface LauncherEnvironment {
  gravity: number
  windX: number
  windGust: number
  windPeriod: number
  dragPermille: number
  groundRestitution: number
  groundFriction: number
}

export interface Vec {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ---- Random tape ----------------------------------------------------------------------

function buildDraws(seed: number, maxTicks: number): number[] {
  const rng = createRng(seed)
  const count = (maxTicks + 1) * DRAWS_PER_TICK
  const out: number[] = []
  for (let i = 0; i < count; i += 1) out.push(rng.next())
  return out
}

function drawAt(draws: readonly number[], cursor: number): number {
  if (draws.length === 0) return 0
  const wrapped = cursor - Math.floor(cursor / draws.length) * draws.length
  return draws[wrapped] ?? 0
}

function pickId(ids: readonly string[], roll: number): string | null {
  if (ids.length === 0) return null
  let index = Math.floor(roll * ids.length)
  if (index >= ids.length) index = ids.length - 1
  if (index < 0) index = 0
  return ids[index] ?? null
}

// ---- Geometry & environment (shared with the view, so both agree to the pixel) ---------

/**
 * Symmetric triangle wave in [-amplitude, +amplitude] over `periodTicks`, built from
 * integer division only. A sine here would be a banned transcendental for a motion no
 * child can tell apart from a triangle.
 */
export function triangleWave(elapsed: number, periodTicks: number, amplitude: number): number {
  if (periodTicks < 2 || amplitude === 0) return 0
  const cycles = Math.floor(elapsed / periodTicks)
  const phase = elapsed - cycles * periodTicks
  const half = Math.floor(periodTicks / 2)
  if (half < 1) return 0
  const up = phase <= half ? phase : Math.max(0, periodTicks - phase)
  return (amplitude * 2 * up) / half - amplitude
}

/** The round's environment: the global physics block with the round's overrides folded
 *  in. Pure and cheap, so it is recomputed rather than stored — state stays small and
 *  there is no second copy to fall out of date. */
export function environmentAt(config: LauncherConfig, roundIndex: number): LauncherEnvironment {
  const base = config.physics
  const round = config.rounds[roundIndex]
  const override = round?.environment
  return {
    gravity: override?.gravity ?? base.gravity,
    windX: override?.wind_x ?? base.wind_x,
    windGust: override?.wind_gust ?? base.wind_gust,
    windPeriod: override?.wind_period_ticks ?? base.wind_period_ticks,
    dragPermille: override?.drag_permille ?? base.drag_permille,
    groundRestitution: override?.ground_restitution_permille ?? base.ground_restitution_permille,
    groundFriction: override?.ground_friction_permille ?? base.ground_friction_permille,
  }
}

/** Wind at a tick: a constant plus a triangular gust. A pure function of the tick, so
 *  the predictive line, the bot's search and the real flight all see the same air. */
export function windAt(env: LauncherEnvironment, tick: number): number {
  return env.windX + triangleWave(tick, env.windPeriod, env.windGust)
}

/** The live top-left of a target: its resting position plus its OWN motion phase. */
export function targetRect(
  target: LauncherTarget,
  tick: number,
  draws: readonly number[],
): Rect {
  let offset = 0
  const elapsed = tick - target.bornAt
  if (target.motion === 'moving') {
    offset = Math.round(triangleWave(elapsed, target.periodTicks, target.amplitude))
  } else if (target.motion === 'erratic') {
    // Predictable in AMPLITUDE, unpredictable in direction, and constant for a whole
    // `periodTicks` window so a child always has time to aim at where it actually is.
    const slot = Math.floor(elapsed / Math.max(1, target.periodTicks))
    const roll = drawAt(draws, target.key * 31 + slot)
    offset = Math.round(target.amplitude * (2 * roll - 1))
  }
  const dx = target.axis === 'x' ? offset : 0
  const dy = target.axis === 'y' ? offset : 0
  return { x: target.baseX + dx, y: target.baseY + dy, w: target.w, h: target.h }
}

/** The launcher's muzzle in design coordinates. */
export function muzzlePoint(state: LauncherState): { x: number; y: number } {
  const l = state.config.launcher
  return { x: state.launcherX + l.w / 2, y: state.launcherY + l.h / 2 }
}

/** Launch speed for a power percentage, before the projectile's own scale. */
export function speedForPower(config: LauncherConfig, power: number): number {
  const l = config.launcher
  const clamped = Math.min(100, Math.max(0, power))
  return l.speed_min + ((l.speed_max - l.speed_min) * clamped) / 100
}

/** Snap an angle onto the manifest's grid. The pull-back gesture and the angle wheel
 *  therefore produce the SAME discrete shots — and the same replay. */
export function quantizeAngle(config: LauncherConfig, angle: number): number {
  const l = config.launcher
  if (!Number.isFinite(angle)) return l.start_angle
  const clamped = Math.min(l.max_angle, Math.max(l.min_angle, angle))
  const steps = Math.round((clamped - l.min_angle) / l.angle_step)
  return Math.min(l.max_angle, l.min_angle + steps * l.angle_step)
}

export function quantizePower(config: LauncherConfig, power: number): number {
  const l = config.launcher
  if (!Number.isFinite(power)) return l.start_power
  const clamped = Math.min(l.max_power, Math.max(l.min_power, power))
  const steps = Math.round((clamped - l.min_power) / l.power_step)
  return Math.min(l.max_power, l.min_power + steps * l.power_step)
}

export function projectileById(
  config: LauncherConfig,
  id: string,
): LauncherProjectileConfig | null {
  for (const projectile of config.projectiles) {
    if (projectile.id === id) return projectile
  }
  return null
}

/** The ammo currently loaded. Null only for an empty projectile list, which the schema
 *  forbids — the guard exists so a malformed document degrades instead of throwing on
 *  the reward path. */
export function activeProjectile(state: LauncherState): LauncherProjectileConfig | null {
  return state.config.projectiles[state.ammoIndex] ?? state.config.projectiles[0] ?? null
}

export function currentRound(state: LauncherState): LauncherRound | null {
  return state.config.rounds[state.round] ?? null
}

// ---- Collision primitives ---------------------------------------------------------------

/** Circle vs axis-aligned box. Nearest-point form: `+ - * <`, nothing else. */
export function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nx = Math.min(Math.max(cx, rect.x), rect.x + rect.w)
  const ny = Math.min(Math.max(cy, rect.y), rect.y + rect.h)
  const dx = cx - nx
  const dy = cy - ny
  return dx * dx + dy * dy < r * r
}

/** Circle vs circle, squared — no `Math.sqrt` needed for a test. */
function circleHitsCircle(
  cx: number,
  cy: number,
  r: number,
  ox: number,
  oy: number,
  orad: number,
): boolean {
  const dx = cx - ox
  const dy = cy - oy
  const sum = r + orad
  return dx * dx + dy * dy < sum * sum
}

export function hitsTargetShape(
  shape: LauncherShape,
  rect: Rect,
  cx: number,
  cy: number,
  r: number,
): boolean {
  if (shape === 'circle') {
    return circleHitsCircle(cx, cy, r, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2)
  }
  return circleHitsRect(cx, cy, r, rect)
}

/**
 * Deterministic bounce off an axis-aligned box. The reflection axis is chosen from
 * where the projectile WAS, not from the penetration depth: a shot that was clear of
 * the box in x reflects horizontally, everything else reflects vertically. That is a
 * pure sign test, so it can never disagree between two engines the way a
 * "deepest-axis" comparison of two nearly equal floats could.
 *
 * The SURFACE supplies the friction (a slippery wall keeps tangential speed, a sticky
 * one eats it); the surface and the projectile jointly supply the restitution.
 */
export function reflectOffRect(
  now: Vec,
  prev: Vec,
  radius: number,
  rect: Rect,
  surfaceRestitution: number,
  projectileRestitution: number,
  surfaceFriction: number,
): Vec {
  const restitution = (surfaceRestitution * projectileRestitution) / 1000 / 1000
  const keep = (1000 - surfaceFriction) / 1000
  const horizontal = prev.x + radius <= rect.x || prev.x - radius >= rect.x + rect.w
  if (horizontal) {
    const x = prev.x < rect.x ? rect.x - radius - 1 : rect.x + rect.w + radius + 1
    return { x, y: now.y, vx: -now.vx * restitution, vy: now.vy * keep }
  }
  const y = prev.y < rect.y ? rect.y - radius - 1 : rect.y + rect.h + radius + 1
  return { x: now.x, y, vx: now.vx * keep, vy: -now.vy * restitution }
}

/**
 * One integration step — the documented semi-implicit Euler above.
 * `steer` is the guided correction already scaled into units/tick².
 */
export function integrateFlight(
  p: Vec,
  env: LauncherEnvironment,
  kind: LauncherProjectileConfig,
  steer: number,
  tick: number,
): Vec {
  const gravity = (env.gravity * kind.gravity_scale_permille) / 1000
  const keep = (1000 - env.dragPermille) / 1000
  const vx = (p.vx + windAt(env, tick) + steer) * keep
  const vy = (p.vy + gravity) * keep
  return { x: p.x + vx, y: p.y + vy, vx, vy }
}

/** The velocity a shot leaves the muzzle with. Screen y grows DOWN, so "up" is the one
 *  negation in the whole simulator. */
export function launchVelocity(
  config: LauncherConfig,
  kind: LauncherProjectileConfig,
  angle: number,
  power: number,
): { vx: number; vy: number } {
  const speed = (speedForPower(config, power) * kind.speed_scale_permille) / 1000
  return { vx: speed * dcos(angle), vy: -speed * dsin(angle) }
}

// ---- Round loading ------------------------------------------------------------------------

interface LoadedRound {
  targets: LauncherTarget[]
  obstacles: LauncherObstacle[]
  drawCursor: number
  nextKey: number
}

function loadRound(
  config: LauncherConfig,
  roundIndex: number,
  tick: number,
  draws: readonly number[],
  startCursor: number,
  startKey: number,
  correctIds: readonly string[],
  incorrectIds: readonly string[],
): LoadedRound {
  const round = config.rounds[roundIndex]
  if (round === undefined) {
    return { targets: [], obstacles: [], drawCursor: startCursor, nextKey: startKey }
  }

  let cursor = startCursor
  let key = startKey
  const targets: LauncherTarget[] = []
  for (const target of round.targets) {
    const pool = target.role === 'correct' ? correctIds : incorrectIds
    let itemId = target.item_ref ?? null
    if (itemId === null) {
      itemId = pickId(pool, drawAt(draws, cursor))
      cursor += 1
    }
    // A faster round is the SAME layout with shorter periods (the report's "increasing
    // speed"), floored at 2 so the triangle wave never degenerates.
    const period = Math.max(
      2,
      Math.floor(((target.period_ticks ?? 2) * 1000) / round.target_speed_permille),
    )
    targets.push({
      key,
      id: target.id,
      role: target.role,
      itemId,
      shape: target.shape,
      baseX: target.x,
      baseY: target.y,
      w: target.w,
      h: target.h,
      hp: target.hp,
      maxHp: target.hp,
      value: target.value,
      motion: target.motion,
      axis: target.axis ?? 'x',
      amplitude: target.amplitude ?? 0,
      periodTicks: period,
      bornAt: tick,
      imageSlot: target.image_slot ?? null,
      icon: target.icon ?? null,
    })
    key += 1
  }

  const obstacles: LauncherObstacle[] = []
  for (const obstacle of round.obstacles) {
    obstacles.push({
      key,
      id: obstacle.id,
      x: obstacle.x,
      y: obstacle.y,
      w: obstacle.w,
      h: obstacle.h,
      material: obstacle.material,
      hp: obstacle.hp ?? 1,
      restitution: obstacle.restitution_permille,
      friction: obstacle.friction_permille,
      chain: obstacle.chain,
      imageSlot: obstacle.image_slot ?? null,
      icon: obstacle.icon ?? null,
    })
    key += 1
  }

  return { targets, obstacles, drawCursor: cursor, nextKey: key }
}

function correctTargetsIn(round: LauncherRound | undefined): number {
  if (round === undefined) return 0
  let total = 0
  for (const target of round.targets) {
    if (target.role === 'correct') total += 1
  }
  return total
}

// ---- Scoring bookkeeping --------------------------------------------------------------------

/** The mutable tally a single tick's resolution writes into. It is LOCAL to one call of
 *  `advanceProjectiles` and folded back into the new state at the end, so nothing here
 *  mutates the state that was handed in. */
interface Tally {
  points: number
  combo: number
  comboBest: number
  correctHits: number
  incorrectHits: number
  correctDestroyed: number
  misses: number
  usefulBounces: number
  lives: number | null
  failed: boolean
}

function damageTarget(
  tally: Tally,
  config: LauncherConfig,
  target: LauncherTarget,
  amount: number,
  bounces: number,
): void {
  if (target.hp <= 0) return
  target.hp -= amount
  const scoring = config.scoring
  if (target.role === 'correct') {
    tally.points += scoring.hit_points * comboMultiplier(tally.combo, scoring.combo)
    tally.combo += 1
    if (tally.combo > tally.comboBest) tally.comboBest = tally.combo
    tally.correctHits += 1
    // "Useful bounces" are the ones that happened BEFORE a correct hit — a rebound that
    // solved a shielded target, never a projectile idly rattling around the floor.
    tally.usefulBounces += bounces
    if (target.hp <= 0) {
      tally.correctDestroyed += 1
      tally.points += target.value
    }
    return
  }
  tally.incorrectHits += 1
  tally.combo = 0
  if (scoring.lives_cost_on_wrong && tally.lives !== null) {
    tally.lives -= 1
    if (tally.lives <= 0) {
      tally.lives = 0
      tally.failed = true
    }
  }
}

// ---- Input --------------------------------------------------------------------------------------

function applyAim(state: LauncherState, x: number | undefined, y: number | undefined): LauncherState {
  const angle = x === undefined ? state.angle : quantizeAngle(state.config, x)
  const power = y === undefined ? state.power : quantizePower(state.config, y)
  if (angle === state.angle && power === state.power) return state
  return { ...state, angle, power }
}

function applyMove(state: LauncherState, direction: number): LauncherState {
  const move = state.config.launcher.move
  if (move.axis === 'none' || direction === 0) return state
  const step = Math.sign(direction) * move.step
  if (move.axis === 'x') {
    const launcherX = Math.min(move.max, Math.max(move.min, state.launcherX + step))
    return launcherX === state.launcherX ? state : { ...state, launcherX }
  }
  const launcherY = Math.min(move.max, Math.max(move.min, state.launcherY + step))
  return launcherY === state.launcherY ? state : { ...state, launcherY }
}

function applySelect(state: LauncherState, slot: string | undefined): LauncherState {
  if (slot === undefined) return state
  // Selecting mid-flight would let a child swap the physics of a shot already in the
  // air, which no replay could reproduce from the log alone.
  if (state.projectiles.length > 0) return state
  for (const [index, projectile] of state.config.projectiles.entries()) {
    if (projectile.id === slot) {
      return index === state.ammoIndex ? state : { ...state, ammoIndex: index }
    }
  }
  return state
}

function applyLaunch(state: LauncherState, tick: number, event: GameInputEvent): LauncherState {
  const aimed = applyAim(state, event.x, event.y)
  if (aimed.cooldownLeft > 0) return aimed
  if (aimed.projectiles.length > 0) return aimed
  if (aimed.shotsLeft <= 0) return aimed
  const kind = activeProjectile(aimed)
  if (kind === null) return aimed

  const muzzle = muzzlePoint(aimed)
  const { vx, vy } = launchVelocity(aimed.config, kind, aimed.angle, aimed.power)
  const offset = kind.radius + 2
  const projectile: LauncherProjectile = {
    key: aimed.nextKey,
    projectileId: kind.id,
    x: muzzle.x + offset * dcos(aimed.angle),
    y: muzzle.y - offset * dsin(aimed.angle),
    vx,
    vy,
    radius: kind.radius,
    bornAt: tick,
    bounces: 0,
    guidedLeft: kind.guided?.max_ticks ?? 0,
    hitTarget: false,
    isFragment: false,
  }

  return {
    ...aimed,
    projectiles: [projectile],
    nextKey: aimed.nextKey + 1,
    shotsLeft: aimed.shotsLeft - 1,
    shotsFired: aimed.shotsFired + 1,
  }
}

// ---- Flight resolution ----------------------------------------------------------------------------

interface Blast {
  x: number
  y: number
  radius: number
  damage: number
  depth: number
  chainDepth: number
}

function splitFragments(
  parent: LauncherProjectile,
  kind: LauncherProjectileConfig,
  at: Vec,
  tick: number,
  startKey: number,
): LauncherProjectile[] {
  const split = kind.split
  if (split === undefined) return []
  const speed = (dhypot(at.vx, at.vy) * split.speed_permille) / 1000
  const heading = datan2(at.vy, at.vx)
  const out: LauncherProjectile[] = []
  const spread = split.spread_deg
  for (let i = 0; i < split.count; i += 1) {
    // Symmetric fan around the parent's heading, evaluated with the deterministic
    // trigonometry so a fragment's arc is as replayable as its parent's.
    const share = split.count === 1 ? 0 : (2 * i) / (split.count - 1) - 1
    const angle = heading + share * spread
    out.push({
      key: startKey + i,
      projectileId: parent.projectileId,
      x: at.x,
      y: at.y,
      vx: speed * dcos(angle),
      vy: speed * dsin(angle),
      radius: Math.max(2, Math.floor(kind.radius / 2)),
      bornAt: tick,
      bounces: parent.bounces,
      guidedLeft: 0,
      hitTarget: parent.hitTarget,
      isFragment: true,
    })
  }
  return out
}

function applyBlasts(
  queue: Blast[],
  targets: LauncherTarget[],
  obstacles: LauncherObstacle[],
  tally: Tally,
  config: LauncherConfig,
  tick: number,
  draws: readonly number[],
): void {
  let processed = 0
  // A plain index walk over an array the loop also appends to: chain order is the order
  // the obstacles were authored in, which is stable across engines (§5 rule 6).
  for (let i = 0; i < queue.length && processed < MAX_BLASTS_PER_TICK; i += 1) {
    const blast = queue[i]
    if (blast === undefined) continue
    processed += 1

    for (const target of targets) {
      if (target.hp <= 0) continue
      const rect = targetRect(target, tick, draws)
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      const reach = blast.radius + Math.max(rect.w, rect.h) / 2
      const dx = cx - blast.x
      const dy = cy - blast.y
      if (dx * dx + dy * dy > reach * reach) continue
      damageTarget(tally, config, target, blast.damage, 0)
    }

    for (const obstacle of obstacles) {
      if (obstacle.material !== 'breakable' || obstacle.hp <= 0) continue
      const cx = obstacle.x + obstacle.w / 2
      const cy = obstacle.y + obstacle.h / 2
      const reach = blast.radius + Math.max(obstacle.w, obstacle.h) / 2
      const dx = cx - blast.x
      const dy = cy - blast.y
      if (dx * dx + dy * dy > reach * reach) continue
      obstacle.hp -= blast.damage
      // Mechanism activation / chain destruction, depth-capped by the manifest.
      if (obstacle.hp <= 0 && obstacle.chain && blast.depth < blast.chainDepth) {
        queue.push({
          x: cx,
          y: cy,
          radius: blast.radius,
          damage: blast.damage,
          depth: blast.depth + 1,
          chainDepth: blast.chainDepth,
        })
      }
    }
  }
}

function advanceProjectiles(state: LauncherState, tick: number, steerUnits: number): LauncherState {
  if (state.projectiles.length === 0) return state

  const config = state.config
  const env = environmentAt(config, state.round)
  const groundY = config.world.ground_y
  const worldW = config.world.width
  const worldH = config.world.height

  // Working copies: everything below mutates THESE, never the state handed in.
  const targets = state.targets.map((target) => ({ ...target }))
  const obstacles = state.obstacles.map((obstacle) => ({ ...obstacle }))
  const survivors: LauncherProjectile[] = []
  const spawned: LauncherProjectile[] = []
  const blasts: Blast[] = []
  let nextKey = state.nextKey

  const tally: Tally = {
    points: state.points,
    combo: state.combo,
    comboBest: state.comboBest,
    correctHits: state.correctHits,
    incorrectHits: state.incorrectHits,
    correctDestroyed: state.correctDestroyed,
    misses: state.misses,
    usefulBounces: state.usefulBounces,
    lives: state.lives,
    failed: false,
  }

  for (const projectile of state.projectiles) {
    const kind = projectileById(config, projectile.projectileId)
    if (kind === null) continue

    const prev: Vec = {
      x: projectile.x,
      y: projectile.y,
      vx: projectile.vx,
      vy: projectile.vy,
    }
    const steer =
      projectile.guidedLeft > 0 && kind.guided !== undefined
        ? steerUnits * kind.guided.steer_accel
        : 0
    let now = integrateFlight(prev, env, kind, steer, tick)

    let bounces = projectile.bounces
    let hitTarget = projectile.hitTarget
    let alive = true
    /** An impact is what detonates and what splits; leaving the world is neither. */
    let impacted = false
    /** A split consumes the parent without it counting as a missed shot. */
    let transformed = false

    // 1. Apex split — checked on the velocity sign change, which is exact.
    if (
      !projectile.isFragment &&
      kind.split !== undefined &&
      kind.split.trigger === 'apex' &&
      prev.vy < 0 &&
      now.vy >= 0
    ) {
      for (const fragment of splitFragments(projectile, kind, now, tick, nextKey)) {
        spawned.push(fragment)
        nextKey += 1
      }
      alive = false
      transformed = true
    }

    // 2. Out of the world: no blast, no split — the shot simply left.
    if (
      alive &&
      (now.x < -projectile.radius ||
        now.x > worldW + projectile.radius ||
        now.y > worldH + projectile.radius)
    ) {
      alive = false
    }

    // 3. The ground.
    if (alive && now.y + projectile.radius >= groundY) {
      if (bounces < kind.bounces) {
        const restitution = (env.groundRestitution * kind.restitution_permille) / 1000 / 1000
        const keep = (1000 - env.groundFriction) / 1000
        now = {
          x: now.x,
          y: groundY - projectile.radius - 1,
          vx: now.vx * keep,
          vy: -Math.abs(now.vy) * restitution,
        }
        bounces += 1
      } else {
        alive = false
        impacted = true
      }
    }

    // 4. Obstacles — first overlap in authored order (arrays only, §5 rule 6).
    if (alive) {
      for (const obstacle of obstacles) {
        if (obstacle.material === 'breakable' && obstacle.hp <= 0) continue
        const rect: Rect = { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h }
        if (!circleHitsRect(now.x, now.y, projectile.radius, rect)) continue

        if (obstacle.material === 'absorb') {
          // An absorbing material swallows the shot AND its blast — that is what makes
          // it different from a solid wall, and it is the counter to explosive spam.
          alive = false
        } else if (obstacle.material === 'solid') {
          alive = false
          impacted = true
        } else if (obstacle.material === 'deflect') {
          if (bounces < kind.bounces) {
            now = reflectOffRect(
              now,
              prev,
              projectile.radius,
              rect,
              obstacle.restitution,
              kind.restitution_permille,
              obstacle.friction,
            )
            bounces += 1
          } else {
            alive = false
            impacted = true
          }
        } else {
          obstacle.hp -= kind.damage
          if (obstacle.hp <= 0 && obstacle.chain && kind.explosive !== undefined) {
            blasts.push({
              x: obstacle.x + obstacle.w / 2,
              y: obstacle.y + obstacle.h / 2,
              radius: kind.explosive.radius,
              damage: kind.explosive.damage,
              depth: 1,
              chainDepth: kind.explosive.chain_depth,
            })
          }
          alive = false
          impacted = true
        }
        break
      }
    }

    // 5. Targets — first overlap in authored order.
    if (alive) {
      for (const target of targets) {
        if (target.hp <= 0) continue
        const rect = targetRect(target, tick, state.draws)
        if (!hitsTargetShape(target.shape, rect, now.x, now.y, projectile.radius)) continue
        damageTarget(tally, config, target, kind.damage, bounces)
        hitTarget = true
        alive = false
        impacted = true
        break
      }
    }

    if (alive) {
      survivors.push({
        ...projectile,
        x: now.x,
        y: now.y,
        vx: now.vx,
        vy: now.vy,
        bounces,
        hitTarget,
        guidedLeft: Math.max(0, projectile.guidedLeft - 1),
      })
      continue
    }

    if (impacted && kind.explosive !== undefined) {
      blasts.push({
        x: now.x,
        y: now.y,
        radius: kind.explosive.radius,
        damage: kind.explosive.damage,
        depth: 0,
        chainDepth: kind.explosive.chain_depth,
      })
    }
    if (impacted && !projectile.isFragment && kind.split?.trigger === 'impact') {
      for (const fragment of splitFragments(projectile, kind, now, tick, nextKey)) {
        spawned.push(fragment)
        nextKey += 1
      }
      transformed = true
    }
    // A shot that resolved without ever touching a target is a miss. Fragments and
    // split parents are the same shot, so they are never double-counted.
    if (!hitTarget && !transformed && !projectile.isFragment) {
      tally.misses += 1
    }
  }

  applyBlasts(blasts, targets, obstacles, tally, config, tick, state.draws)

  // ONE removal pass for everything resolved this tick (kernel rule 2).
  const keptTargets: LauncherTarget[] = []
  for (const target of targets) {
    if (target.hp > 0) keptTargets.push(target)
  }
  const keptObstacles: LauncherObstacle[] = []
  for (const obstacle of obstacles) {
    if (obstacle.material !== 'breakable' || obstacle.hp > 0) keptObstacles.push(obstacle)
  }

  const projectiles = [...survivors, ...spawned]
  const wentQuiet = projectiles.length === 0
  return {
    ...state,
    targets: keptTargets,
    obstacles: keptObstacles,
    projectiles,
    nextKey,
    cooldownLeft: wentQuiet ? config.launcher.cooldown_ticks : state.cooldownLeft,
    points: tally.points,
    combo: tally.combo,
    comboBest: tally.comboBest,
    correctHits: tally.correctHits,
    incorrectHits: tally.incorrectHits,
    correctDestroyed: tally.correctDestroyed,
    misses: tally.misses,
    usefulBounces: tally.usefulBounces,
    lives: tally.lives,
    finished: state.finished || tally.failed,
  }
}

// ---- Round flow ------------------------------------------------------------------------------------

function advanceRound(state: LauncherState, tick: number): LauncherState {
  if (state.finished) return state
  if (state.projectiles.length > 0) return state

  const round = currentRound(state)
  if (round === null) return { ...state, finished: true }

  let correctLeft = 0
  for (const target of state.targets) {
    if (target.role === 'correct') correctLeft += 1
  }
  const cleared = correctLeft === 0
  const outOfShots = state.shotsLeft <= 0 && state.cooldownLeft <= 0
  const outOfTime = tick - state.roundStartTick + 1 >= round.max_ticks
  if (!cleared && !outOfShots && !outOfTime) return state

  const nextIndex = state.round + 1
  const roundsCleared = state.roundsCleared + (cleared ? 1 : 0)
  const nextRound = state.config.rounds[nextIndex]
  if (nextRound === undefined) {
    return { ...state, roundsCleared, finished: true }
  }

  const loaded = loadRound(
    state.config,
    nextIndex,
    tick + 1,
    state.draws,
    state.drawCursor,
    state.nextKey,
    state.correctIds,
    state.incorrectIds,
  )
  return {
    ...state,
    round: nextIndex,
    roundStartTick: tick + 1,
    roundsCleared,
    targets: loaded.targets,
    obstacles: loaded.obstacles,
    drawCursor: loaded.drawCursor,
    nextKey: loaded.nextKey,
    shotsLeft: nextRound.shots,
    shotBudget: state.shotBudget + nextRound.shots,
    correctTotal: state.correctTotal + correctTargetsIn(nextRound),
    cooldownLeft: 0,
    combo: 0,
  }
}

// ---- Score --------------------------------------------------------------------------------------------

function computeScore(state: LauncherState): number {
  const weights = state.config.scoring
  const accuracyPart = accuracyScore(state.correctHits, state.shotsFired)
  const pointsPart = targetScore(state.points, weights.points_target)
  // Leftover projectiles ARE the efficiency reward the report asks for: spending none
  // is 100, spending the whole budget is 0.
  const leftoverPart = efficiencyScore(state.shotsFired, state.shotBudget)
  const bouncePart = targetScore(state.usefulBounces, weights.bounce_target)

  const blend = weightedScore([
    { value: accuracyPart, weight: weights.accuracy_weight },
    { value: pointsPart, weight: weights.points_weight },
    { value: leftoverPart, weight: weights.leftover_weight },
    { value: bouncePart, weight: weights.bounce_weight },
  ])
  const afterWrong = applyPenalty(blend, state.incorrectHits, weights.wrong_penalty_pct)
  return applyPenalty(afterWrong, state.misses, weights.miss_penalty_pct)
}

// ---- The predictive aid ---------------------------------------------------------------------------------

/**
 * The dotted trajectory preview (`config.aim.trajectory_preview`, tier-gated by the
 * manifest). It re-runs the SAME integrator against the SAME environment, so it can
 * never promise an arc the physics would not fly — and it stops at the first thing the
 * shot would hit, so it is a preview and not an x-ray.
 *
 * View-only: it reads state and returns points, and nothing here ever touches the
 * simulation.
 */
export function previewPath(
  state: LauncherState,
  angle: number,
  power: number,
  dots: number,
  tickStep: number,
): { x: number; y: number }[] {
  const kind = activeProjectile(state)
  if (kind === null || dots <= 0) return []
  const config = state.config
  const env = environmentAt(config, state.round)
  const muzzle = muzzlePoint(state)
  const { vx, vy } = launchVelocity(config, kind, angle, power)
  const offset = kind.radius + 2

  let point: Vec = {
    x: muzzle.x + offset * dcos(angle),
    y: muzzle.y - offset * dsin(angle),
    vx,
    vy,
  }
  const out: { x: number; y: number }[] = []
  const step = Math.max(1, Math.floor(tickStep))
  const budget = dots * step
  for (let i = 0; i < budget; i += 1) {
    point = integrateFlight(point, env, kind, 0, state.tick + i)
    if (point.y + kind.radius >= config.world.ground_y) break
    if (point.x < 0 || point.x > config.world.width) break
    let blocked = false
    for (const obstacle of state.obstacles) {
      const rect: Rect = { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h }
      if (circleHitsRect(point.x, point.y, kind.radius, rect)) {
        blocked = true
        break
      }
    }
    if (blocked) break
    if ((i + 1) - Math.floor((i + 1) / step) * step === 0) {
      out.push({ x: point.x, y: point.y })
    }
  }
  return out
}

// ---- The simulator ---------------------------------------------------------------------------------------------

export const launcherSimulator: Simulator<LauncherState> = {
  mechanic: 'launcher',
  actions: LAUNCHER_ACTIONS,

  init(input: SimInit): LauncherState {
    // The document was validated by `launcherConfigSchema`/`launcherContentSchema`
    // before it ever reached a simulator (core/schema.ts `parseGameDocument`, and the
    // pipeline's `gate` stage server-side), so this narrows rather than trusts.
    const config = input.config as unknown as LauncherConfig
    const content = input.content as unknown as LauncherContent

    const draws = buildDraws(input.seed, config.max_ticks)
    const loaded = loadRound(
      config,
      0,
      0,
      draws,
      0,
      1,
      content.roles.correct,
      content.roles.incorrect,
    )
    const firstRound = config.rounds[0]

    return {
      config,
      correctIds: content.roles.correct,
      incorrectIds: content.roles.incorrect,
      draws,
      drawCursor: loaded.drawCursor,

      tick: 0,
      round: 0,
      roundStartTick: 0,
      targets: loaded.targets,
      obstacles: loaded.obstacles,
      projectiles: [],
      nextKey: loaded.nextKey,

      angle: config.launcher.start_angle,
      power: config.launcher.start_power,
      launcherX: config.launcher.x,
      launcherY: config.launcher.y,
      ammoIndex: 0,
      cooldownLeft: 0,

      shotsLeft: firstRound?.shots ?? 0,
      shotsFired: 0,
      shotBudget: firstRound?.shots ?? 0,
      points: 0,
      combo: 0,
      comboBest: 0,
      correctHits: 0,
      incorrectHits: 0,
      correctDestroyed: 0,
      correctTotal: correctTargetsIn(firstRound),
      misses: 0,
      usefulBounces: 0,
      roundsCleared: 0,

      lives: input.scoring.lives ?? null,
      finished: false,
    }
  },

  step(state: LauncherState, tick: number, events: readonly GameInputEvent[]): LauncherState {
    if (state.finished) return state

    // 1. the shot clock, before any input, so a launch on the tick the cooldown expires
    //    is accepted rather than silently swallowed.
    let next: LauncherState = {
      ...state,
      tick,
      cooldownLeft:
        state.projectiles.length === 0 ? Math.max(0, state.cooldownLeft - 1) : state.cooldownLeft,
    }

    // 2. inputs — the WHOLE batch, never an early return after the first event.
    let steer = 0
    for (const event of events) {
      if (event.action === 'aim') next = applyAim(next, event.x, event.y)
      else if (event.action === 'launch') next = applyLaunch(next, tick, event)
      else if (event.action === 'move') next = applyMove(next, event.n ?? 0)
      else if (event.action === 'select') next = applySelect(next, event.slot)
      else if (event.action === 'nudge') steer += Math.sign(event.n ?? 0)
    }
    steer = Math.min(MAX_STEER_UNITS, Math.max(-MAX_STEER_UNITS, steer))

    // 3. flight + collisions, 4. round flow, 5. terminal conditions.
    next = advanceProjectiles(next, tick, steer)
    next = advanceRound(next, tick)

    const outOfTime = tick + 1 >= next.config.max_ticks
    return { ...next, finished: next.finished || outOfTime }
  },

  snapshot(state: LauncherState): SimSnapshot {
    return {
      finished: state.finished,
      score: computeScore(state),
      lives: state.lives,
      round: state.round + 1,
    }
  },

  result(state: LauncherState): SimResult {
    return {
      score: computeScore(state),
      finished: state.finished,
      // Derived aggregates ONLY — this is exactly what `game_attempts.stats` may hold,
      // and a tick-resolution trace of a child at play is never one of them (§11).
      stats: {
        shots_fired: state.shotsFired,
        shots_budget: state.shotBudget,
        shots_left: state.shotsLeft,
        correct_hits: state.correctHits,
        incorrect_hits: state.incorrectHits,
        targets_destroyed: state.correctDestroyed,
        targets_total: state.correctTotal,
        misses: state.misses,
        useful_bounces: state.usefulBounces,
        points: state.points,
        combo_best: state.comboBest,
        rounds_cleared: state.roundsCleared,
        ticks: state.tick + 1,
      },
    }
  },
}
