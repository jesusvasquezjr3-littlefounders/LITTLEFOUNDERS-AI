// Runner — the PURE simulator (GAME_ENGINE.md §5, brief §4).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no I/O, no mutation of the
// state handed in. Fixed 50ms ticks. Only the §5-allowed arithmetic; no transcendental
// is reached for at all (the one periodic motion in the mechanic is a TRIANGLE wave
// built from integer division, so `core/mathd.ts` is not needed here).
//
// Two engine-level rules the kernel documents and this file honours:
//  - PER-ENTITY TIMERS. A moving obstacle's phase is `tick - entity.bornAt`, and a
//    `sudden` obstacle arms from its OWN distance to the avatar. There is no shared
//    accumulator anywhere, so N entities never advance N times too fast.
//  - BATCHED REMOVALS. Collisions are resolved over the whole entity array and the
//    survivors are produced in ONE filter, so several pickups on the same tick are one
//    state transition rather than the first pickup plus a stalled world.
//
// RANDOMNESS. Spawning needs a seeded stream, but a live `Rng` object held in state
// would be a mutable box smuggled through a "pure" `step`: two callers stepping the
// same state would get different worlds, and the replay path branches exactly like
// that in tests. So `init` draws a fixed TAPE of values from `core/rng.ts` and the
// state carries only an integer cursor into it. Reading the tape is pure, the cursor
// is part of the returned state, and stepping the same state twice is identical by
// construction. The tape wraps, so it can never run dry mid-run.

import { createRng } from '@/game-engine/core/rng'
import {
  applyPenalty,
  comboMultiplier,
  survivalScore,
  targetScore,
  weightedScore,
} from '@/game-engine/core/scoring'
import type {
  GameInputEvent,
  Rng,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '@/game-engine/core/types'

import type {
  RunnerConfig,
  RunnerContent,
  RunnerHold,
  RunnerPattern,
  RunnerRole,
  RunnerSurface,
  RunnerVariant,
  RunnerVerticalMotion,
} from './schema'

/** The three logical inputs. `hold_*` stay valid actions even when the manifest
 *  disables holding, so a log recorded by a client that emitted them replays instead
 *  of being rejected for an `unknown_action`. */
export const RUNNER_ACTIONS = ['act', 'hold_start', 'hold_end'] as const

/** Draws reserved per tick on the random tape. Spawning consumes ~1 draw per tick on
 *  average (a pattern is at least `min_gap_units` apart), so 4 is generous headroom;
 *  the tape wraps rather than overflowing, which keeps a pathological manifest
 *  deterministic instead of undefined. */
const DRAWS_PER_TICK = 4

/** Hard ceiling on patterns materialised in a single tick — a runaway manifest must
 *  degrade to a sparser world, never to a frozen main thread. */
const MAX_SPAWNS_PER_TICK = 8

/** Upper bound for the bots' arc search: no configured jump can stay airborne longer
 *  (max impulse 200 / min gravity 1 lands by tick 400). */
const MAX_ARC_TICKS = 400

/** Which family the action model belongs to. `flip` is a two-track `lane` whose tracks
 *  are the floor and the ceiling — the same integration, so it is not a third path. */
export type RunnerFamily = 'vertical' | 'discrete'

export interface RunnerEntity {
  /** Monotonic within a run: identity for a batched removal, never an array index. */
  key: number
  role: RunnerRole
  /** The catalog item this entity carries, or null for a pure obstacle. */
  itemId: string | null
  /** World x of the left edge (the world scrolls; the avatar's x is fixed). */
  x: number
  /** Base top y; `moving` entities oscillate around it. */
  y: number
  w: number
  h: number
  variant: RunnerVariant
  /** The tick this entity was spawned on — its OWN timer base. */
  bornAt: number
  amplitude: number
  periodTicks: number
  revealUnits: number
}

export interface RunnerState {
  config: RunnerConfig
  family: RunnerFamily
  /** Resolved lane top-y values; empty for the vertical family. */
  lanes: readonly number[]
  transitionTicks: number
  goodIds: readonly string[]
  badIds: readonly string[]
  /** The seeded random tape (see the module note). */
  draws: readonly number[]
  drawCursor: number

  tick: number
  distance: number
  /** High-water distance: a checkpoint respawn rewinds `distance`, never progress. */
  reach: number
  checkpoint: number
  spawnCursor: number
  nextKey: number
  entities: readonly RunnerEntity[]

  /** Vertical family: signed displacement from the rest line, and its velocity. */
  offset: number
  vy: number
  grounded: boolean
  jumpsUsed: number
  holding: boolean
  holdLeft: number

  /** Discrete family: the committed lane, the lane being left, and the ticks left. */
  lane: number
  laneFrom: number
  transitionLeft: number

  invulnerableUntil: number
  combo: number
  comboBest: number
  points: number
  collected: number
  missed: number
  wrong: number
  crashes: number
  acts: number
  lives: number | null
  finished: boolean
  reachedTarget: boolean
}

// ---- Geometry helpers (shared with the view, so both agree to the pixel) ----------

/** Speed of the world at `tick`, from the manifest's phase ramp. */
export function speedAt(config: RunnerConfig, tick: number): number {
  let speed = 1
  for (const phase of config.speed.phases) {
    if (phase.from_tick <= tick) speed = phase.units_per_tick
  }
  return speed
}

/** Index of the active speed phase — the HUD's "round". */
export function phaseIndexAt(config: RunnerConfig, tick: number): number {
  let index = 0
  for (const [i, phase] of config.speed.phases.entries()) {
    if (phase.from_tick <= tick) index = i
  }
  return index
}

/**
 * Symmetric triangle wave in [-amplitude, +amplitude] over `periodTicks`, built from
 * integer division and `Math.round` only. A sine here would be a banned transcendental
 * for a motion no child can tell apart from a triangle.
 */
export function triangleOffset(elapsed: number, periodTicks: number, amplitude: number): number {
  if (periodTicks < 2 || amplitude === 0) return 0
  const cycles = Math.floor(elapsed / periodTicks)
  const phase = elapsed - cycles * periodTicks
  const half = Math.floor(periodTicks / 2)
  if (half < 1) return 0
  const up = phase <= half ? phase : Math.max(0, periodTicks - phase)
  return Math.round((amplitude * 2 * up) / half) - amplitude
}

/** Current top y of an entity — its base y plus its own oscillation phase. */
export function entityTopY(entity: RunnerEntity, tick: number): number {
  if (entity.variant !== 'moving') return entity.y
  return entity.y + triangleOffset(tick - entity.bornAt, entity.periodTicks, entity.amplitude)
}

/** A `sudden` entity is inert AND invisible until it is within `reveal_units` of the
 *  avatar's leading edge. Everything else is always armed. */
export function isEntityArmed(entity: RunnerEntity, state: RunnerState): boolean {
  if (entity.variant !== 'sudden') return true
  const front = state.distance + state.config.world.avatar_x + state.config.world.avatar_w
  return entity.x - front <= entity.revealUnits
}

/** Top y of the avatar's hit box. Discrete transitions INTERPOLATE, so a late switch
 *  still clips the lane being left. */
export function avatarTopY(state: RunnerState): number {
  if (state.family === 'vertical') {
    return state.config.world.ground_y - state.offset - state.config.world.avatar_h
  }
  const to = state.lanes[state.lane] ?? 0
  const from = state.lanes[state.laneFrom] ?? to
  if (state.transitionLeft <= 0 || state.transitionTicks <= 0) return to
  const done = state.transitionTicks - state.transitionLeft
  return from + Math.round(((to - from) * done) / state.transitionTicks)
}

/** World x of the avatar's left edge. */
export function avatarLeftX(state: RunnerState): number {
  return state.distance + state.config.world.avatar_x
}

const FALLBACK_MOTION: RunnerVerticalMotion = { dir: 1, impulse: 1, gravity: 1, max_jumps: 1 }
const FALLBACK_HOLD: RunnerHold = { enabled: false, glide_gravity: 0, max_hold_ticks: 0 }

/** The surface under the avatar right now (contextual model only). */
export function surfaceAt(config: RunnerConfig, distance: number): RunnerSurface {
  if (config.action.model !== 'contextual') return 'ground'
  let surface: RunnerSurface = 'ground'
  for (const stop of config.action.surfaces) {
    if (stop.from_units <= distance) surface = stop.surface
  }
  return surface
}

/** The motion block the single button currently means. This is the whole `contextual`
 *  mechanic: one action, a different physics block per surface. */
export function activeMotion(state: RunnerState): { motion: RunnerVerticalMotion; hold: RunnerHold } {
  const action = state.config.action
  if (action.model === 'jump') return { motion: action.jump, hold: action.hold }
  if (action.model === 'contextual') {
    const surface = surfaceAt(state.config, state.distance)
    return { motion: action.effects[surface], hold: action.hold }
  }
  return { motion: FALLBACK_MOTION, hold: FALLBACK_HOLD }
}

// ---- Random tape ------------------------------------------------------------------

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

function pickPattern(patterns: readonly RunnerPattern[], roll: number): RunnerPattern | null {
  if (patterns.length === 0) return null
  let total = 0
  for (const pattern of patterns) total += pattern.weight
  const last = patterns[patterns.length - 1] ?? null
  if (total <= 0) return last
  let ticket = Math.floor(roll * total)
  if (ticket >= total) ticket = total - 1
  if (ticket < 0) ticket = 0
  let accumulated = 0
  for (const pattern of patterns) {
    accumulated += pattern.weight
    if (ticket < accumulated) return pattern
  }
  return last
}

function pickId(ids: readonly string[], roll: number): string | null {
  if (ids.length === 0) return null
  let index = Math.floor(roll * ids.length)
  if (index >= ids.length) index = ids.length - 1
  if (index < 0) index = 0
  return ids[index] ?? null
}

// ---- Setup -------------------------------------------------------------------------

function familyOf(config: RunnerConfig): RunnerFamily {
  return config.action.model === 'lane' || config.action.model === 'flip' ? 'discrete' : 'vertical'
}

function resolveLanes(config: RunnerConfig): number[] {
  const action = config.action
  if (action.model === 'lane') {
    const out: number[] = []
    for (let i = 0; i < action.lanes.count; i += 1) out.push(action.lanes.top_y + i * action.lanes.gap)
    return out
  }
  // Flip: index 0 is the ceiling, index 1 the floor, and the avatar starts on the floor.
  if (action.model === 'flip') return [action.flip.ceiling_y, action.flip.floor_y]
  return []
}

function transitionTicksOf(config: RunnerConfig): number {
  const action = config.action
  if (action.model === 'lane') return action.lanes.transition_ticks
  if (action.model === 'flip') return action.flip.transition_ticks
  return 0
}

function startLane(config: RunnerConfig): number {
  return config.action.model === 'flip' ? 1 : 0
}

// ---- Step ---------------------------------------------------------------------------

function applyAct(state: RunnerState): RunnerState {
  const next = { ...state, acts: state.acts + 1 }
  if (state.family === 'discrete') {
    // A switch in flight is COMMITTED: re-tapping mid-transition would let a player
    // hover between lanes, which turns a timing skill into a mashing one.
    if (state.transitionLeft > 0 || state.lanes.length === 0) return next
    return {
      ...next,
      laneFrom: state.lane,
      lane: (state.lane + 1) - Math.floor((state.lane + 1) / state.lanes.length) * state.lanes.length,
      transitionLeft: state.transitionTicks,
    }
  }
  const { motion } = activeMotion(state)
  if (state.grounded) {
    return { ...next, vy: motion.dir * motion.impulse, grounded: false, jumpsUsed: 1 }
  }
  if (state.jumpsUsed < motion.max_jumps) {
    return { ...next, vy: motion.dir * motion.impulse, jumpsUsed: state.jumpsUsed + 1 }
  }
  return next
}

function integrate(state: RunnerState): RunnerState {
  if (state.family === 'discrete') {
    if (state.transitionLeft <= 0) return state
    return { ...state, transitionLeft: state.transitionLeft - 1 }
  }

  const { motion, hold } = activeMotion(state)
  if (state.grounded) {
    return { ...state, offset: 0, vy: 0, holdLeft: hold.max_hold_ticks }
  }

  // Gliding only ever slows the DESCENT: holding on the way up would be a second,
  // hidden action, and the mechanic is built around exactly one.
  const descending = motion.dir * state.vy < 0
  const gliding = hold.enabled && state.holding && state.holdLeft > 0 && descending
  const gravity = gliding ? hold.glide_gravity : motion.gravity

  const vy = state.vy - motion.dir * gravity
  const offset = state.offset + vy
  const holdLeft = gliding ? state.holdLeft - 1 : state.holdLeft

  if (motion.dir * offset <= 0) {
    return { ...state, offset: 0, vy: 0, grounded: true, jumpsUsed: 0, holdLeft }
  }
  return { ...state, offset, vy, holdLeft }
}

function despawn(state: RunnerState): RunnerState {
  const kept: RunnerEntity[] = []
  let missed = state.missed
  for (const entity of state.entities) {
    if (entity.x + entity.w >= state.distance) {
      kept.push(entity)
      continue
    }
    if (entity.role === 'good') missed += 1
  }
  if (kept.length === state.entities.length && missed === state.missed) return state
  return { ...state, entities: kept, missed }
}

function spawn(state: RunnerState, tick: number): RunnerState {
  const config = state.config
  const horizon = state.distance + config.world.width + config.spawn.lead_units
  if (state.spawnCursor > horizon) return state

  const added: RunnerEntity[] = []
  let cursor = state.spawnCursor
  let key = state.nextKey
  let draw = state.drawCursor
  let guard = 0

  while (cursor <= horizon && guard < MAX_SPAWNS_PER_TICK) {
    guard += 1
    const eligible: RunnerPattern[] = []
    for (const pattern of config.spawn.patterns) {
      if ((pattern.min_distance_units ?? 0) <= cursor) eligible.push(pattern)
    }
    const pool = eligible.length > 0 ? eligible : config.spawn.patterns
    const pattern = pickPattern(pool, drawAt(state.draws, draw))
    draw += 1
    if (pattern === null) break

    for (const element of pattern.elements) {
      let itemId: string | null = null
      if (element.role === 'good') {
        itemId = pickId(state.goodIds, drawAt(state.draws, draw))
        draw += 1
      } else if (element.role === 'bad') {
        itemId = pickId(state.badIds, drawAt(state.draws, draw))
        draw += 1
        // A manifest with no avoidable items simply has no traps: skip rather than
        // spawn an unlabelled one the view could not name.
        if (itemId === null) continue
      }
      added.push({
        key,
        role: element.role,
        itemId,
        x: cursor + element.dx,
        y: element.y,
        w: element.w,
        h: element.h,
        variant: element.variant,
        bornAt: tick,
        amplitude: element.amplitude ?? 0,
        periodTicks: element.period_ticks ?? 0,
        revealUnits: element.reveal_units ?? 0,
      })
      key += 1
    }

    const span = config.spawn.max_gap_units - config.spawn.min_gap_units + 1
    const gap = config.spawn.min_gap_units + Math.floor(drawAt(state.draws, draw) * span)
    draw += 1
    cursor = cursor + pattern.length_units + gap
  }

  if (added.length === 0) {
    return { ...state, spawnCursor: cursor, drawCursor: draw }
  }
  return {
    ...state,
    entities: [...state.entities, ...added],
    spawnCursor: cursor,
    nextKey: key,
    drawCursor: draw,
  }
}

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  // Strict on every edge: touching exactly is CLEARING, which is what makes a
  // frame-perfect jump land as a success rather than as a crash.
  return ax + aw > bx && ax < bx + bw && ay + ah > by && ay < by + bh
}

function respawn(state: RunnerState): RunnerState {
  const config = state.config
  const target =
    config.lives.policy === 'checkpoint'
      ? Math.floor(state.distance / config.lives.checkpoint_every_units) *
        config.lives.checkpoint_every_units
      : 0
  return {
    ...state,
    distance: target,
    checkpoint: target,
    // Cleared, not rewound: re-spawning from the seeded tape keeps the stream moving
    // forward, so a respawn can never loop the same world forever.
    entities: [],
    spawnCursor: target + config.world.width,
    offset: 0,
    vy: 0,
    grounded: true,
    jumpsUsed: 0,
    holding: false,
    lane: startLane(config),
    laneFrom: startLane(config),
    transitionLeft: 0,
  }
}

function collide(state: RunnerState, tick: number): RunnerState {
  const config = state.config
  const ax = avatarLeftX(state)
  const ay = avatarTopY(state)
  const aw = config.world.avatar_w
  const ah = config.world.avatar_h

  const removed: number[] = []
  let combo = state.combo
  let comboBest = state.comboBest
  let points = state.points
  let collected = state.collected
  let wrong = state.wrong
  let crashed = false

  for (const entity of state.entities) {
    if (!isEntityArmed(entity, state)) continue
    const ey = entityTopY(entity, tick)
    if (!overlaps(ax, ay, aw, ah, entity.x, ey, entity.w, entity.h)) continue

    if (entity.role === 'obstacle') {
      if (tick < state.invulnerableUntil) continue
      crashed = true
      removed.push(entity.key)
      continue
    }
    if (entity.role === 'good') {
      points += config.scoring.collect_points * comboMultiplier(combo, config.scoring.combo)
      combo += 1
      if (combo > comboBest) comboBest = combo
      collected += 1
      removed.push(entity.key)
      continue
    }
    wrong += 1
    combo = 0
    removed.push(entity.key)
  }

  if (removed.length === 0 && !crashed) return state

  // ONE removal pass for every entity resolved this tick (kernel rule 2).
  const kept: RunnerEntity[] = []
  for (const entity of state.entities) {
    if (!removed.includes(entity.key)) kept.push(entity)
  }

  let next: RunnerState = {
    ...state,
    entities: kept,
    combo,
    comboBest,
    points,
    collected,
    wrong,
  }

  if (!crashed) return next

  next = {
    ...next,
    crashes: next.crashes + 1,
    combo: 0,
    invulnerableUntil: tick + config.lives.respawn_invulnerable_ticks,
  }

  if (next.lives === null) {
    // Cheer mode has NO fail state: a crash is a stumble that costs score and combo,
    // never the run and never the distance already earned.
    return next
  }

  const lives = next.lives - 1
  if (lives <= 0) return { ...next, lives: 0, finished: true }
  return { ...respawn(next), lives }
}

function computeScore(state: RunnerState): number {
  const weights = state.config.scoring
  const distancePart = survivalScore(state.reach, state.config.target_distance)
  const collectPart = targetScore(state.points, weights.collect_target)
  const blend = weightedScore([
    { value: distancePart, weight: weights.distance_weight },
    { value: collectPart, weight: weights.collect_weight },
  ])
  const afterWrong = applyPenalty(blend, state.wrong, weights.wrong_penalty_pct)
  return applyPenalty(afterWrong, state.crashes, weights.crash_penalty_pct)
}

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

// ---- The simulator --------------------------------------------------------------------

export const runnerSimulator: Simulator<RunnerState> = {
  mechanic: 'runner',
  actions: RUNNER_ACTIONS,

  init(input: SimInit): RunnerState {
    // The document was validated by `runnerConfigSchema`/`runnerContentSchema` before
    // it ever reached a simulator (core/schema.ts `parseGameDocument`, and the pipeline's
    // `gate` stage server-side), so this narrows rather than trusts.
    const config = input.config as unknown as RunnerConfig
    const content = input.content as unknown as RunnerContent

    const family = familyOf(config)
    const lanes = resolveLanes(config)
    const lane = startLane(config)

    return {
      config,
      family,
      lanes,
      transitionTicks: transitionTicksOf(config),
      goodIds: content.roles.collect,
      badIds: content.roles.avoid,
      draws: buildDraws(input.seed, config.max_ticks),
      drawCursor: 0,

      tick: 0,
      distance: 0,
      reach: 0,
      checkpoint: 0,
      spawnCursor: config.world.width,
      nextKey: 1,
      entities: [],

      offset: 0,
      vy: 0,
      grounded: true,
      jumpsUsed: 0,
      holding: false,
      holdLeft: config.action.model === 'lane' || config.action.model === 'flip'
        ? 0
        : config.action.hold.max_hold_ticks,

      lane,
      laneFrom: lane,
      transitionLeft: 0,

      invulnerableUntil: 0,
      combo: 0,
      comboBest: 0,
      points: 0,
      collected: 0,
      missed: 0,
      wrong: 0,
      crashes: 0,
      acts: 0,
      lives: input.scoring.lives ?? null,
      finished: false,
      reachedTarget: false,
    }
  },

  step(state: RunnerState, tick: number, events: readonly GameInputEvent[]): RunnerState {
    if (state.finished) return state
    let next: RunnerState = { ...state, tick }

    // 1. inputs — the WHOLE batch, never an early return after the first event.
    for (const event of events) {
      if (event.action === 'act') next = applyAct(next)
      else if (event.action === 'hold_start') next = { ...next, holding: true }
      else if (event.action === 'hold_end') next = { ...next, holding: false }
    }

    // 2. the avatar's own motion, 3. the world advance, 4. spawning, 5. collisions.
    next = integrate(next)
    const distance = next.distance + speedAt(next.config, tick)
    next = { ...next, distance, reach: Math.max(next.reach, distance) }
    next = despawn(next)
    next = spawn(next, tick)
    next = collide(next, tick)

    // 6. terminal conditions.
    const reachedTarget = next.reach >= next.config.target_distance
    const outOfTime = tick + 1 >= next.config.max_ticks
    return {
      ...next,
      reachedTarget,
      finished: next.finished || reachedTarget || outOfTime,
    }
  },

  snapshot(state: RunnerState): SimSnapshot {
    return {
      finished: state.finished,
      score: computeScore(state),
      lives: state.lives,
      round: phaseIndexAt(state.config, state.tick) + 1,
    }
  },

  result(state: RunnerState): SimResult {
    return {
      score: computeScore(state),
      finished: state.finished,
      // Derived aggregates ONLY — this is exactly what `game_attempts.stats` may hold,
      // and a tick-resolution trace of a child at play is never one of them (§11).
      stats: {
        distance: state.reach,
        collected: state.collected,
        missed: state.missed,
        wrong: state.wrong,
        crashes: state.crashes,
        points: state.points,
        combo_best: state.comboBest,
        acts: state.acts,
        ticks: state.tick + 1,
        reached_target: state.reachedTarget ? 1 : 0,
      },
    }
  },

  bots: {
    perfect(state: RunnerState, tick: number): GameInputEvent[] {
      return perfectBot(state, tick)
    },
    random(state: RunnerState, tick: number, rng: Rng): GameInputEvent[] {
      return randomBot(state, tick, rng)
    },
  },
}
