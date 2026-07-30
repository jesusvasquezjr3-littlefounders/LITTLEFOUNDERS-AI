// `stacker` — the PURE simulator, including its own small rigid-body solver
// (GAME_ENGINE.md §5, §13; brief §4).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no `%`, and no banned
// transcendental: Core re-runs this exact code over the player's input log to derive the
// reward, so every operation is one the ECMAScript spec pins to the last bit. The only
// non-elementary functions used are `dsin`/`dcos`/`datan2`/`dhypot` from core/mathd.ts,
// which are built from the allowed arithmetic on purpose. Randomness comes only from
// core/rng.ts, drawn ONCE at init.
//
// THE SOLVER (documented, because §13 makes it a contract rather than an implementation
// detail):
//
//   * Bodies are axis-aligned boxes and circles. A circle is stored square
//     (`w === h`), radius `w / 2`, so half-extents are uniform and every overlap test
//     is exact. There is NO rotation of a placed body: step rotation happens at
//     PLACEMENT (it swaps w/h on an odd 90-degree step) and never during simulation.
//     A rotated collision test cannot be made bit-identical cheaply, and §13 chose
//     reproducibility over generality.
//   * Each tick runs, in this exact order: (1) player intents, (2) external forces
//     resolved from the announced timeline, (3) forces integrated into VELOCITIES,
//     (4) EXACTLY `config.solver.iterations` VELOCITY passes (base contacts in array
//     order, then every body PAIR in ascending index order, then the base again so a
//     pass never ends with the structure sliding), (5) positions integrated, (6) exactly
//     the same number of POSITION passes, (7) brittle shatters, (8) sleep bookkeeping,
//     (9) the stability margin and hold timer, (10) the collapse test. Solving velocity
//     BEFORE moving is what makes friction able to prevent a slide rather than merely
//     report one after the fact.
//   * COLLAPSE CRITERION: see `stackerCollapseSchema`'s doc comment in schema.ts —
//     baseline crossing, leaving the field sideways, drift past `max_shift`, tilt past
//     `max_tilt_degrees` (only once the centre of mass stands `tilt_min_height` above
//     the base), or a brittle shatter when `brittle_breaks_run`.
//
// TWO v1 BUGS ARE STRUCTURALLY EXCLUDED, and both cost a comment:
//
//  - PER-ENTITY TIMERS. Every body carries its own `sleepTicks`, `placedAt` and
//    `addedMass`; each timeline event's phase is `elapsed - at_tick`, its own clock.
//    There is no shared accumulator that N bodies each advance, so N bodies can never
//    make one clock run N times too fast.
//  - BATCHED REMOVALS. Shatters and a collapse rebuild the whole body array in ONE
//    pass at the end of the tick. There is no per-event splice and no early return, so
//    several simultaneous removals are one state transition rather than the first
//    removal plus a frozen world.

import { datan2, dcos, dhypot, dsin } from '@/game-engine/core/mathd'
import { createRng } from '@/game-engine/core/rng'
import {
  applyPenalty,
  clampScore,
  efficiencyScore,
  targetScore,
  weightedScore,
} from '@/game-engine/core/scoring'
import type {
  GameInputEvent,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '@/game-engine/core/types'

import {
  costOfPiece,
  type StackerConfig,
  type StackerContent,
  type StackerPiece,
  type StackerProperty,
  type StackerShape,
} from './schema'

/**
 * The six player intents.
 *
 * `place` names a catalogue piece in `slot`, the design x in `x` and the rotation step
 * in `n`. `move` and `remove` name a placed body's uid in `n` (`move` also carries the
 * new `x`). `ready` ends the build phase early. `assist_on`/`assist_off` are the
 * player's own toggle for adaptive assistance — they travel through the LOG precisely
 * so that a replay reproduces the eased difficulty exactly (GAME_ENGINE.md §13).
 *
 * Anything else is refused by `replayGame()` before the simulator is initialised.
 */
export const STACKER_ACTIONS = [
  'place',
  'move',
  'remove',
  'ready',
  'assist_on',
  'assist_off',
] as const
export type StackerAction = (typeof STACKER_ACTIONS)[number]

/** Below this, a torque is treated as absent rather than divided by. */
const TORQUE_EPSILON = 1e-9

/** Rain's `magnitude` is mass per HUNDRED ticks, so a manifest can express a slow
 *  soak with an integer-friendly number instead of a long decimal. */
const RAIN_TICKS_PER_UNIT = 100

export type StackerPhase = 'build' | 'test'

/** One placed piece. Everything time-dependent about it lives HERE, never in a shared
 *  accumulator. */
export interface StackerBody {
  /** Unique for the whole run — the input log addresses bodies by it. */
  uid: number
  itemId: string
  /** Index into `config.catalog`; array position, so iteration order is deterministic. */
  pieceIndex: number
  shape: StackerShape
  /** Half-extents are `w / 2` and `h / 2`; a circle is stored with `w === h`. */
  w: number
  h: number
  /** Mass from the catalogue, already multiplied by a counterweight's factor. */
  baseMass: number
  /** Rain that pooled on this body. Persistent — that is what makes rain a decision. */
  addedMass: number
  /** Transient extra load from an active `load` event. Recomputed every tick. */
  loadMass: number
  friction: number
  /** Already includes an `elastic` piece's bonus, clamped into 0..1. */
  restitution: number
  property: StackerProperty
  propertyValue: number
  /** What this body cost — quoted back on a refund, so the tray price and the refund
   *  can never disagree. */
  cost: number
  /** Centre, in design coordinates (y grows downward). */
  x: number
  y: number
  vx: number
  vy: number
  /** Where the player put it. Criterion (c) measures drift from here. */
  placedX: number
  placedAt: number
  /** Contact impulse accumulated during THIS tick — the brittle test's input. */
  impulse: number
  sleepTicks: number
  asleep: boolean
}

export interface StackerState {
  config: StackerConfig
  /** Gravity resolved once at init: `dsin`/`dcos` are called exactly twice per run. */
  gx: number
  gy: number
  foundationIds: readonly string[]
  avoidIds: readonly string[]
  /** One magnitude scale per timeline event, drawn at init from the seeded PRNG. */
  gusts: readonly number[]
  seed: number

  phase: StackerPhase
  tick: number
  /** Tick at which the build phase ends on its own. */
  buildDeadline: number
  testStartTick: number

  bodies: readonly StackerBody[]
  nextUid: number
  /** Uses consumed per catalogue index, reset when an attempt restarts. */
  usesByPiece: readonly number[]

  spent: number
  refunded: number
  /** Cumulative across the whole run (stats). */
  placements: number
  /** Pieces placed in the CURRENT attempt — what the unlock ladder and `max_pieces`
   *  read, so a retry starts the catalogue over instead of inheriting a locked-out one. */
  attemptPlacements: number
  repositions: number
  removals: number
  avoidUsed: number
  collapses: number
  shattered: number

  /** Current stability margin (stabilising torque / overturning torque). */
  margin: number
  /** Consecutive ticks the current margin has met the threshold, counted ONLY while
   *  the structure actually stands at `stability.target_height` — see `step`. */
  holdTicks: number
  bestHold: number
  /** Ticks the structure spent under test AT the required height. */
  testTicks: number
  /** The LOWEST margin the structure held while under test at the required height —
   *  the honest reading of "it withstood the forces", since a peak margin during a calm
   *  stretch says nothing about the gust. */
  minTestMargin: number
  maxHeight: number

  assistOn: boolean
  lives: number | null
  won: boolean
  finished: boolean
}

// ---- Small pure helpers ---------------------------------------------------------

/** Non-negative remainder without `%` — the operator is avoided engine-wide so no
 *  reader has to reason about its sign rules on a negative rotation index. */
function wrap(value: number, modulus: number): number {
  if (modulus <= 0) return 0
  return value - Math.floor(value / modulus) * modulus
}

function massOf(body: StackerBody): number {
  return Math.max(0.0001, body.baseMass + body.addedMass + body.loadMass)
}

function baseLeftOf(config: StackerConfig): number {
  return config.field.base_x - config.field.base_width / 2
}

function baseRightOf(config: StackerConfig): number {
  return config.field.base_x + config.field.base_width / 2
}

/**
 * Height of the tallest point of the STRUCTURE above the base surface.
 *
 * Only SUPPORTED bodies count. In `drop` mode a piece released at `drop_y` is briefly
 * the highest thing on screen while it is still falling, and counting it would report a
 * finished tower one tick after the first piece left the player's hand — the height that
 * matters is the height that is standing up.
 */
export function heightOf(state: StackerState): number {
  let top = state.config.field.ground_y
  for (const body of state.bodies) {
    if (!isSupported(body, state.bodies, state.config)) continue
    top = Math.min(top, body.y - body.h / 2)
  }
  return Math.max(0, state.config.field.ground_y - top)
}

/** Money still available. Exported because the tray shows it and the bots plan with it —
 *  one function, so a child is never offered a piece the simulator then refuses. */
export function budgetLeft(state: StackerState): number {
  return state.config.economy.budget - state.spent + state.refunded
}

/**
 * Adaptive assistance is ACTIVE only when the manifest enables it, the player has
 * switched it on, and the attempt has already failed `ease_after_failures` times. All
 * three are required: help that arrives before the child has struggled is not
 * assistance, it is a difficulty cut nobody asked for.
 */
export function assistActive(state: StackerState): boolean {
  if (!state.config.assist.enabled) return false
  if (!state.assistOn) return false
  return state.collapses >= state.config.assist.ease_after_failures
}

/** The piece a catalogue index names, or undefined for an out-of-range index. */
function pieceAt(config: StackerConfig, index: number): StackerPiece | undefined {
  return config.catalog[index]
}

function catalogIndexOf(config: StackerConfig, itemId: string): number {
  for (const [index, piece] of config.catalog.entries()) {
    if (piece.item_id === itemId) return index
  }
  return -1
}

/** Geometry after step rotation: an odd 90-degree step swaps a box's w and h; a circle
 *  is rotation-invariant, and a manifest with `rotation_steps: 1` never rotates. */
export function rotatedSize(
  piece: StackerPiece,
  rotationIndex: number,
  steps: number,
): { w: number; h: number } {
  if (piece.shape === 'circle') {
    const d = Math.min(piece.w, piece.h)
    return { w: d, h: d }
  }
  const index = wrap(Math.floor(rotationIndex), steps)
  const odd = wrap(index, 2) === 1
  return odd ? { w: piece.h, h: piece.w } : { w: piece.w, h: piece.h }
}

/** Placement x, quantised to the manifest's grid and clamped inside the field so a
 *  piece can never be committed half outside the world. */
export function snapX(config: StackerConfig, x: number, w: number): number {
  const grid = config.placement.snap_grid
  const snapped = Math.round(x / grid) * grid
  const half = w / 2
  return Math.max(half, Math.min(config.field.width - half, snapped))
}

/** The y a piece would rest at if it were seated on whatever is under `x` right now. */
export function seatY(state: StackerState, x: number, w: number, h: number): number {
  let surface = state.config.field.ground_y
  for (const body of state.bodies) {
    if (Math.abs(body.x - x) >= (body.w + w) / 2) continue
    surface = Math.min(surface, body.y - body.h / 2)
  }
  return surface - h / 2
}

// ---- Forces ---------------------------------------------------------------------

export interface ActiveForces {
  /** Horizontal pressure, before the per-body area/mass conversion. */
  pressureX: number
  pressureY: number
  /** Mass added to the topmost body this tick, and it stays. */
  rainMass: number
  /** Mass on the topmost body for as long as the event lasts. */
  loadMass: number
  /** An earthquake wakes every sleeping body — that is what makes it different. */
  wakesAll: boolean
  /** Any disturbance at all is running. */
  any: boolean
}

const NO_FORCES: ActiveForces = {
  pressureX: 0,
  pressureY: 0,
  rainMass: 0,
  loadMass: 0,
  wakesAll: false,
  any: false,
}

/**
 * The disturbances running on this tick, resolved from the ANNOUNCED timeline.
 *
 * Every event's clock is its own (`elapsed - at_tick`), every magnitude carries the
 * gust scale drawn for that event at init, and assistance — when the player accepted
 * it — multiplies all of them by `assist.ease_factor`.
 */
export function forcesAt(state: StackerState, tick: number): ActiveForces {
  if (state.phase !== 'test') return NO_FORCES
  const config = state.config
  const elapsed = tick - state.testStartTick
  const ease = assistActive(state) ? config.assist.ease_factor : 1

  let pressureX = 0
  let pressureY = 0
  let rainMass = 0
  let loadMass = 0
  let wakesAll = false
  let any = false

  for (const [index, event] of config.timeline.events.entries()) {
    if (elapsed < event.at_tick) continue
    if (elapsed >= event.at_tick + event.duration_ticks) continue
    const gust = state.gusts[index] ?? 1
    const magnitude = event.magnitude * gust * ease
    const phase = elapsed - event.at_tick
    const period = event.period_ticks ?? 1
    any = true

    if (event.kind === 'wind') {
      pressureX += magnitude
    } else if (event.kind === 'vibration') {
      pressureX += magnitude * dsin((360 * phase) / period)
    } else if (event.kind === 'earthquake') {
      pressureX += magnitude * dsin((360 * phase) / period)
      pressureY += magnitude * 0.5 * dcos((360 * phase) / period)
      wakesAll = true
    } else if (event.kind === 'rain') {
      rainMass += magnitude / RAIN_TICKS_PER_UNIT
    } else {
      loadMass += magnitude
    }
  }

  return { pressureX, pressureY, rainMass, loadMass, wakesAll, any }
}

/** Index of the topmost body (ties broken by uid, never by insertion accident), or -1. */
function topmostIndex(bodies: readonly StackerBody[]): number {
  let best = -1
  let bestTop = Number.POSITIVE_INFINITY
  for (const [index, body] of bodies.entries()) {
    const top = body.y - body.h / 2
    if (top < bestTop) {
      bestTop = top
      best = index
    }
  }
  return best
}

// ---- Contacts -------------------------------------------------------------------

interface Contact {
  /** Unit normal pointing from `a` towards `b`. */
  nx: number
  ny: number
  penetration: number
}

/**
 * Overlap between two bodies, or null. Box/box uses the minimum-translation axis;
 * circle/circle uses the true centre distance; box/circle clamps the circle's centre
 * into the box. Every branch uses only `+ - * /`, `Math.abs/min/max/sign` and `dhypot`
 * (which is `Math.sqrt`, exactly specified by IEEE-754).
 *
 * `slop` widens DETECTION without inventing penetration. Two seated pieces touch with
 * exactly zero overlap, so a strict `overlap > 0` test would report no contact at all
 * and a settled tower would have no friction between its pieces — every piece above the
 * base would slide off in the first breeze. The reported `penetration` is still the real
 * overlap, floored at 0, so a merely-touching pair is never pushed apart.
 */
function contactBetween(a: StackerBody, b: StackerBody, slop: number): Contact | null {
  const aCircle = a.shape === 'circle'
  const bCircle = b.shape === 'circle'

  if (aCircle && bCircle) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const radii = a.w / 2 + b.w / 2
    const distance = dhypot(dx, dy)
    if (distance >= radii + slop) return null
    const penetration = Math.max(0, radii - distance)
    if (distance === 0) return { nx: 0, ny: 1, penetration }
    return { nx: dx / distance, ny: dy / distance, penetration }
  }

  if (aCircle !== bCircle) {
    const circle = aCircle ? a : b
    const box = aCircle ? b : a
    const radius = circle.w / 2
    const closestX = Math.max(box.x - box.w / 2, Math.min(circle.x, box.x + box.w / 2))
    const closestY = Math.max(box.y - box.h / 2, Math.min(circle.y, box.y + box.h / 2))
    const dx = circle.x - closestX
    const dy = circle.y - closestY
    const distance = dhypot(dx, dy)

    // The normal is built pointing from the BOX towards the CIRCLE, then flipped when
    // `a` is the circle, so it always points from `a` to `b`.
    let nx: number
    let ny: number
    let penetration: number
    if (distance === 0) {
      // The circle's centre is inside the box: push out along the shallower axis.
      const overlapX = box.w / 2 + radius - Math.abs(circle.x - box.x)
      const overlapY = box.h / 2 + radius - Math.abs(circle.y - box.y)
      if (overlapY <= overlapX) {
        nx = 0
        ny = Math.sign(circle.y - box.y) || 1
        penetration = overlapY
      } else {
        nx = Math.sign(circle.x - box.x) || 1
        ny = 0
        penetration = overlapX
      }
    } else {
      if (distance >= radius + slop) return null
      nx = dx / distance
      ny = dy / distance
      penetration = Math.max(0, radius - distance)
    }
    return aCircle ? { nx: -nx, ny: -ny, penetration } : { nx, ny, penetration }
  }

  const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
  const overlapY = (a.h + b.h) / 2 - Math.abs(a.y - b.y)
  if (overlapX <= -slop || overlapY <= -slop) return null
  if (overlapY <= overlapX) {
    return { nx: 0, ny: Math.sign(b.y - a.y) || 1, penetration: Math.max(0, overlapY) }
  }
  return { nx: Math.sign(b.x - a.x) || 1, ny: 0, penetration: Math.max(0, overlapX) }
}

/**
 * VELOCITY phase of one pair contact: a normal impulse with restitution, then a
 * Coulomb-clamped tangential impulse, then the adhesive bond if either side is glued.
 * It never moves a body — positions are integrated between the two phases (see
 * `simulatePhysics`).
 */
function pairVelocity(
  a: StackerBody,
  b: StackerBody,
  config: StackerConfig,
  gx: number,
  gy: number,
  loadA: number,
  loadB: number,
): void {
  const contact = contactBetween(a, b, config.stability.contact_epsilon)
  if (contact === null) return

  // Contact with an awake body wakes a sleeping one — otherwise a settled stack could
  // not be knocked over, which is the entire failure mode this mechanic teaches.
  if (!a.asleep || !b.asleep) {
    a.asleep = false
    b.asleep = false
  }

  const ima = 1 / massOf(a)
  const imb = 1 / massOf(b)
  const sum = ima + imb
  if (sum <= 0) return

  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const normalSpeed = rvx * contact.nx + rvy * contact.ny

  let jn = 0
  if (normalSpeed < 0) {
    const resting = Math.abs(normalSpeed) <= config.solver.rest_speed
    const restitution = resting ? 0 : Math.min(a.restitution, b.restitution)
    jn = (-(1 + restitution) * normalSpeed) / sum
    a.vx -= contact.nx * jn * ima
    a.vy -= contact.ny * jn * ima
    b.vx += contact.nx * jn * imb
    b.vy += contact.ny * jn * imb
    a.impulse += Math.abs(jn)
    b.impulse += Math.abs(jn)
  }

  // FRICTION IS APPLIED TO RESTING CONTACTS TOO, and that is not a detail: a stack at
  // rest has `normalSpeed === 0`, so a friction impulse derived only from the collision
  // impulse would be exactly zero and every piece above the base would slide off in the
  // first breeze. The resting capacity is `mu * N` with N the weight this contact
  // actually carries for one tick — the load of whichever body sits ON TOP of the
  // contact, which is what Coulomb friction has to work with.
  const gravityAlongNormal = Math.abs(gx * contact.nx + gy * contact.ny)
  // The normal points a -> b, and y grows downward, so `ny < 0` means b sits above a.
  const upperLoad = contact.ny < 0 ? loadB : loadA
  const restingCapacity = gravityAlongNormal * upperLoad
  const limit = Math.sqrt(a.friction * b.friction) * (Math.abs(jn) + restingCapacity)
  if (limit > 0) {
    const tx = -contact.ny
    const ty = contact.nx
    const tangentSpeed = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty
    const jt = Math.max(-limit, Math.min(limit, -tangentSpeed / sum))
    a.vx -= tx * jt * ima
    a.vy -= ty * jt * ima
    b.vx += tx * jt * imb
    b.vy += ty * jt * imb
  }

  const bond = Math.max(
    a.property === 'adhesive' ? a.propertyValue : 0,
    b.property === 'adhesive' ? b.propertyValue : 0,
  )
  if (bond > 0) {
    const dvx = b.vx - a.vx
    const dvy = b.vy - a.vy
    if (dhypot(dvx, dvy) <= bond) {
      // Glue makes the pair move as one: the momentum-preserving common velocity.
      const ma = massOf(a)
      const mb = massOf(b)
      const total = ma + mb
      const cvx = (a.vx * ma + b.vx * mb) / total
      const cvy = (a.vy * ma + b.vy * mb) / total
      a.vx = cvx
      a.vy = cvy
      b.vx = cvx
      b.vy = cvy
    }
  }
}

/** POSITION phase of one pair contact: inverse-mass-weighted separation of a real
 *  overlap. Touching bodies have zero penetration and are therefore left alone. */
function pairPosition(a: StackerBody, b: StackerBody, config: StackerConfig): void {
  const contact = contactBetween(a, b, 0)
  if (contact === null || contact.penetration <= 0) return
  const ima = 1 / massOf(a)
  const imb = 1 / massOf(b)
  const sum = ima + imb
  if (sum <= 0) return
  const correction = (contact.penetration * config.solver.position_correction) / sum
  a.x -= contact.nx * correction * ima
  a.y -= contact.ny * correction * ima
  b.x += contact.nx * correction * imb
  b.y += contact.ny * correction * imb
}

/**
 * VELOCITY phase against the base platform. A body whose CENTRE is off the platform is
 * unsupported and simply keeps falling — that is what makes placement matter.
 *
 * Friction is applied on CONTACT, not on penetration. A seated piece rests with its
 * bottom exactly on `ground_y`, i.e. zero penetration; keying friction off penetration
 * would give a settled tower a frictionless floor and let the first breeze push the
 * whole thing off the base. The limit is the Coulomb one: a contact can remove at most
 * `mu * g` of speed per tick.
 */
function baseVelocity(
  body: StackerBody,
  config: StackerConfig,
  gy: number,
  load: number,
): void {
  if (body.x < baseLeftOf(config) || body.x > baseRightOf(config)) return
  const penetration = body.y + body.h / 2 - config.field.ground_y
  if (penetration <= -config.stability.contact_epsilon) return

  if (body.vy > 0) {
    body.impulse += Math.abs(body.vy * massOf(body))
    body.vy = Math.abs(body.vy) <= config.solver.rest_speed ? 0 : -body.vy * body.restitution
  }
  // Impulse capacity `mu * g * load`, converted to the speed change it buys THIS body.
  const limit = (body.friction * Math.abs(gy) * load) / massOf(body)
  body.vx += Math.max(-limit, Math.min(limit, -body.vx))
}

/** POSITION phase against the base platform. */
function basePosition(body: StackerBody, config: StackerConfig): void {
  if (body.x < baseLeftOf(config) || body.x > baseRightOf(config)) return
  const penetration = body.y + body.h / 2 - config.field.ground_y
  if (penetration <= 0) return
  body.y -= penetration * config.solver.position_correction
}

/**
 * The mass each body actually CARRIES: its own, plus everything resting (transitively)
 * on top of it, split evenly when a piece rests on several supporters.
 *
 * This is the normal load every friction limit needs. Using a body's own mass instead
 * would give the bottom piece of a six-piece tower the friction of a single brick, and
 * the whole structure would slide off its base in a wind it should shrug off — the
 * contact under a tower carries the tower.
 *
 * Deterministic by construction: bodies are visited TOP DOWN (so a supporter is only
 * read after everything above it has contributed), the ordering ties break on `uid`, and
 * supporters are collected in array order.
 */
function supportedMasses(bodies: readonly StackerBody[], config: StackerConfig): number[] {
  const load = bodies.map((body) => massOf(body))
  const epsilon = config.stability.contact_epsilon + 1

  const order = bodies.map((_, index) => index)
  order.sort((left, right) => {
    const a = bodies[left]
    const b = bodies[right]
    if (a === undefined || b === undefined) return 0
    const topA = a.y - a.h / 2
    const topB = b.y - b.h / 2
    if (topA !== topB) return topA - topB
    return a.uid - b.uid
  })

  for (const index of order) {
    const body = bodies[index]
    if (body === undefined) continue
    const bottom = body.y + body.h / 2
    const supporters: number[] = []
    for (let other = 0; other < bodies.length; other += 1) {
      if (other === index) continue
      const candidate = bodies[other]
      if (candidate === undefined) continue
      if (Math.abs(candidate.x - body.x) >= (candidate.w + body.w) / 2) continue
      if (Math.abs(bottom - (candidate.y - candidate.h / 2)) > epsilon) continue
      supporters.push(other)
    }
    if (supporters.length === 0) continue
    const share = (load[index] ?? 0) / supporters.length
    for (const supporter of supporters) load[supporter] = (load[supporter] ?? 0) + share
  }

  return load
}

/** Whether a body is resting on the base or on another body — the precondition for
 *  falling asleep. Without it a body could sleep mid-air and hang there forever. */
function isSupported(
  body: StackerBody,
  bodies: readonly StackerBody[],
  config: StackerConfig,
): boolean {
  const epsilon = config.stability.contact_epsilon
  const bottom = body.y + body.h / 2
  if (
    body.x >= baseLeftOf(config) &&
    body.x <= baseRightOf(config) &&
    Math.abs(bottom - config.field.ground_y) <= epsilon + 1
  ) {
    return true
  }
  for (const other of bodies) {
    if (other.uid === body.uid) continue
    if (Math.abs(other.x - body.x) >= (other.w + body.w) / 2) continue
    if (Math.abs(bottom - (other.y - other.h / 2)) <= epsilon + 1) return true
  }
  return false
}

// ---- Stability ------------------------------------------------------------------

export interface StabilityReading {
  margin: number
  /** Centre of mass. */
  cx: number
  cy: number
  supportLeft: number
  supportRight: number
  /** True when at least one body actually rests on the base platform. */
  standing: boolean
}

/**
 * The report's stability metric: stabilising torque divided by overturning torque,
 * about the base edge the net horizontal force pushes towards.
 *
 * `stabilising = W * lever` where `W` is the structure's weight and `lever` is the
 * horizontal distance from the centre of mass to that pivot; `overturning = F_h * arm`
 * where `F_h` is the net horizontal force (gravity's own horizontal component plus
 * wind/vibration/earthquake pressure over the exposed area) and `arm` is the height of
 * the centre of mass above the base surface.
 *
 * Two answers are deliberate: a structure that touches nothing reports 0 (there is no
 * stability without support), and a centre of mass that has already passed the pivot
 * reports 0 as well — it is falling, not marginally stable.
 */
export function stabilityOf(state: StackerState, forces: ActiveForces): StabilityReading {
  const config = state.config
  const empty: StabilityReading = {
    margin: 0,
    cx: config.field.base_x,
    cy: config.field.ground_y,
    supportLeft: baseLeftOf(config),
    supportRight: baseRightOf(config),
    standing: false,
  }
  if (state.bodies.length === 0) return empty

  let totalMass = 0
  let totalArea = 0
  let momentX = 0
  let momentY = 0
  for (const body of state.bodies) {
    const mass = massOf(body)
    totalMass += mass
    totalArea += body.w * body.h
    momentX += body.x * mass
    momentY += body.y * mass
  }
  if (totalMass <= 0) return empty

  const cx = momentX / totalMass
  const cy = momentY / totalMass

  let supportLeft = Number.POSITIVE_INFINITY
  let supportRight = Number.NEGATIVE_INFINITY
  const epsilon = config.stability.contact_epsilon
  for (const body of state.bodies) {
    if (body.x < baseLeftOf(config) || body.x > baseRightOf(config)) continue
    if (Math.abs(body.y + body.h / 2 - config.field.ground_y) > epsilon + 1) continue
    supportLeft = Math.min(supportLeft, body.x - body.w / 2)
    supportRight = Math.max(supportRight, body.x + body.w / 2)
  }
  if (supportLeft > supportRight) return { ...empty, cx, cy }

  const pressureForce = (forces.pressureX * totalArea) / config.solver.wind_area_scale
  const horizontal = state.gx * totalMass + pressureForce
  const weight = Math.abs(state.gy) * totalMass
  const arm = Math.max(0, config.field.ground_y - cy)

  const lever = horizontal >= 0 ? supportRight - cx : cx - supportLeft
  if (lever <= 0) {
    return { margin: 0, cx, cy, supportLeft, supportRight, standing: true }
  }

  const stabilising = weight * lever
  const overturning = Math.abs(horizontal) * arm
  const margin =
    overturning <= TORQUE_EPSILON
      ? config.stability.margin_cap
      : Math.min(config.stability.margin_cap, stabilising / overturning)

  return { margin, cx, cy, supportLeft, supportRight, standing: true }
}

/** How far a body overhangs whatever supports it — the cantilever signal's input. */
function overhangOf(
  body: StackerBody,
  bodies: readonly StackerBody[],
  config: StackerConfig,
): number {
  const epsilon = config.stability.contact_epsilon + 1
  const bottom = body.y + body.h / 2
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY

  if (Math.abs(bottom - config.field.ground_y) <= epsilon) {
    left = Math.min(left, baseLeftOf(config))
    right = Math.max(right, baseRightOf(config))
  }
  for (const other of bodies) {
    if (other.uid === body.uid) continue
    if (Math.abs(other.x - body.x) >= (other.w + body.w) / 2) continue
    if (Math.abs(bottom - (other.y - other.h / 2)) > epsilon) continue
    left = Math.min(left, other.x - other.w / 2)
    right = Math.max(right, other.x + other.w / 2)
  }
  if (left > right) return 0
  return (
    Math.max(0, left - (body.x - body.w / 2)) + Math.max(0, body.x + body.w / 2 - right)
  )
}

/** The style bonus: symmetry about the base centre, plus the report's cantilevers. */
export function styleScoreOf(state: StackerState): number {
  const config = state.config
  if (state.bodies.length === 0) return 0

  let totalMass = 0
  let momentX = 0
  for (const body of state.bodies) {
    const mass = massOf(body)
    totalMass += mass
    momentX += body.x * mass
  }
  const cx = totalMass > 0 ? momentX / totalMass : config.field.base_x
  const half = Math.max(1, config.field.base_width / 2)
  const symmetry = clampScore(100 - (Math.abs(cx - config.field.base_x) / half) * 100)

  let cantilevers = 0
  for (const body of state.bodies) {
    if (overhangOf(body, state.bodies, config) >= config.style.cantilever_min_overhang) {
      cantilevers += 1
    }
  }
  const cantileverScore = targetScore(cantilevers, config.style.cantilever_target)

  return weightedScore([
    { value: symmetry, weight: config.style.symmetry_weight },
    { value: cantileverScore, weight: config.style.cantilever_weight },
  ])
}

/**
 * The blended 0..100 score. Read by `snapshot` (HUD) and `result` (the reward), so the
 * number a child watches and the number Core grants are the same function.
 */
export function sustainedMarginOf(state: StackerState): number {
  return state.testTicks > 0 ? state.minTestMargin : 0
}

export function scoreOf(state: StackerState): number {
  const config = state.config
  const heightScore = targetScore(state.maxHeight, config.stability.target_height)
  const marginScore = targetScore(sustainedMarginOf(state), config.stability.margin_threshold)
  const holdScore = targetScore(state.bestHold, config.stability.hold_ticks)
  const netSpent = Math.max(0, state.spent - state.refunded)
  // Spending nothing is not efficiency, it is abstention: a run that never placed a
  // piece scores 0 here rather than a free 100 for an untouched budget.
  const efficiency = state.placements === 0 ? 0 : efficiencyScore(netSpent, config.economy.budget)
  const style = styleScoreOf(state)

  const base =
    config.score_model === 'product'
      ? // The owner report's literal formula: height x margin x efficiency, plus a
        // style bonus. Unforgiving by design — one weak signal takes the whole score
        // down, which is a tier-3 posture, never a tier-1 one.
        clampScore(
          (heightScore / 100) * (marginScore / 100) * (efficiency / 100) * 100 +
            style * config.style.bonus_share,
        )
      : weightedScore([
          { value: heightScore, weight: config.score_weights.height },
          { value: marginScore, weight: config.score_weights.stability },
          { value: holdScore, weight: config.score_weights.hold },
          { value: efficiency, weight: config.score_weights.efficiency },
          { value: style, weight: config.score_weights.style },
        ])

  const afterCollapse = applyPenalty(base, state.collapses, config.penalty.collapse_pct)
  const afterMoves = applyPenalty(afterCollapse, state.repositions, config.penalty.reposition_pct)
  return applyPenalty(afterMoves, state.avoidUsed, config.penalty.avoid_piece_pct)
}

// ---- Player intents --------------------------------------------------------------

function makeBody(
  state: StackerState,
  piece: StackerPiece,
  pieceIndex: number,
  rotationIndex: number,
  requestedX: number,
  tick: number,
): StackerBody {
  const config = state.config
  const size = rotatedSize(piece, rotationIndex, config.placement.rotation_steps)
  const x = snapX(config, requestedX, size.w)
  const y =
    config.placement.mode === 'snap'
      ? seatY(state, x, size.w, size.h)
      : config.placement.drop_y
  const counterweight =
    piece.property === 'counterweight' ? Math.max(1, piece.property_value) : 1
  const elastic = piece.property === 'elastic' ? piece.property_value : 0

  return {
    uid: state.nextUid,
    itemId: piece.item_id,
    pieceIndex,
    shape: piece.shape,
    w: size.w,
    h: size.h,
    baseMass: piece.mass * counterweight,
    addedMass: 0,
    loadMass: 0,
    friction: piece.friction,
    restitution: Math.max(0, Math.min(1, piece.restitution + elastic)),
    property: piece.property,
    propertyValue: piece.property_value,
    cost: costOfPiece(config, piece),
    x,
    y,
    vx: 0,
    vy: 0,
    placedX: x,
    placedAt: tick,
    impulse: 0,
    // A snapped piece is seated at rest, so it starts asleep and the tower is calm from
    // the first tick; a dropped one has to fall and settle before it may sleep.
    sleepTicks: config.placement.mode === 'snap' ? config.solver.sleep_ticks : 0,
    asleep: config.placement.mode === 'snap',
  }
}

function startTest(state: StackerState, tick: number): StackerState {
  if (state.phase === 'test') return state
  return { ...state, phase: 'test', testStartTick: tick, holdTicks: 0 }
}

function applyPlace(state: StackerState, event: GameInputEvent, tick: number): StackerState {
  const config = state.config
  if (state.phase !== 'build') return state
  const itemId = event.slot
  if (itemId === undefined) return state
  const pieceIndex = catalogIndexOf(config, itemId)
  const piece = pieceAt(config, pieceIndex)
  if (piece === undefined) return state
  if (state.attemptPlacements >= config.placement.max_pieces) return state
  if (state.attemptPlacements < piece.unlock_after_pieces) return state
  const used = state.usesByPiece[pieceIndex] ?? 0
  if (used >= piece.max_uses) return state
  const cost = costOfPiece(config, piece)
  if (cost > budgetLeft(state)) return state
  const x = event.x
  if (x === undefined) return state

  const body = makeBody(state, piece, pieceIndex, event.n ?? 0, x, tick)
  const usesByPiece = state.usesByPiece.map((count, index) =>
    index === pieceIndex ? count + 1 : count,
  )

  return {
    ...state,
    bodies: [...state.bodies, body],
    nextUid: state.nextUid + 1,
    usesByPiece,
    spent: state.spent + cost,
    placements: state.placements + 1,
    attemptPlacements: state.attemptPlacements + 1,
    avoidUsed: state.avoidIds.includes(itemId) ? state.avoidUsed + 1 : state.avoidUsed,
  }
}

function applyMove(state: StackerState, event: GameInputEvent, tick: number): StackerState {
  const config = state.config
  if (state.phase !== 'build') return state
  const uid = event.n
  const requestedX = event.x
  if (uid === undefined || requestedX === undefined) return state
  const target = state.bodies.find((body) => body.uid === uid)
  if (target === undefined) return state
  const cost = config.economy.reposition_cost
  if (cost > budgetLeft(state)) return state

  const x = snapX(config, requestedX, target.w)
  const rest = state.bodies.filter((body) => body.uid !== uid)
  const moved: StackerBody = {
    ...target,
    x,
    y:
      config.placement.mode === 'snap'
        ? seatY({ ...state, bodies: rest }, x, target.w, target.h)
        : config.placement.drop_y,
    vx: 0,
    vy: 0,
    // Drift is measured from where the piece is NOW, not from where it first landed:
    // a paid reposition is a new decision, not accumulated failure.
    placedX: x,
    placedAt: tick,
    impulse: 0,
    sleepTicks: config.placement.mode === 'snap' ? config.solver.sleep_ticks : 0,
    asleep: config.placement.mode === 'snap',
  }

  return {
    ...state,
    bodies: state.bodies.map((body) => (body.uid === uid ? moved : body)),
    spent: state.spent + cost,
    repositions: state.repositions + 1,
  }
}

function applyRemove(state: StackerState, event: GameInputEvent): StackerState {
  const config = state.config
  if (state.phase !== 'build') return state
  const uid = event.n
  if (uid === undefined) return state
  const target = state.bodies.find((body) => body.uid === uid)
  if (target === undefined) return state

  const refund = Math.round((target.cost * config.economy.refund_pct) / 100)
  const usesByPiece = state.usesByPiece.map((count, index) =>
    index === target.pieceIndex ? Math.max(0, count - 1) : count,
  )

  return {
    ...state,
    bodies: state.bodies.filter((body) => body.uid !== uid),
    usesByPiece,
    refunded: state.refunded + refund,
    removals: state.removals + 1,
    attemptPlacements: Math.max(0, state.attemptPlacements - 1),
    avoidUsed: state.avoidIds.includes(target.itemId)
      ? Math.max(0, state.avoidUsed - 1)
      : state.avoidUsed,
  }
}

// ---- The tick --------------------------------------------------------------------

/** Integration + the fixed contact passes + shatters + sleep. Operates on a private
 *  copy of the body array, so the state handed in is never mutated. */
function simulatePhysics(
  state: StackerState,
  tick: number,
  forces: ActiveForces,
): { bodies: StackerBody[]; shattered: number } {
  const config = state.config
  const bodies = state.bodies.map((body) => ({ ...body, impulse: 0, loadMass: 0 }))
  if (bodies.length === 0) return { bodies, shattered: 0 }

  // Rain and load land on the roof: the topmost body carries them, which raises the
  // centre of mass and LOWERS the margin — the physical reason a downpour is a threat.
  const top = topmostIndex(bodies)
  const roof = top >= 0 ? bodies[top] : undefined
  if (roof !== undefined) {
    roof.addedMass = roof.addedMass + forces.rainMass
    roof.loadMass = forces.loadMass
  }

  for (const body of bodies) {
    const mass = massOf(body)
    const area = (body.w * body.h) / config.solver.wind_area_scale
    let ax = state.gx + (forces.pressureX * area) / mass
    let ay = state.gy + (forces.pressureY * area) / mass

    if (body.property === 'magnetic' && body.propertyValue > 0) {
      const pull = magnetAccel(body, bodies, config)
      ax += pull.ax
      ay += pull.ay
    }

    if (body.asleep) {
      // Only a disturbance strong enough to actually shift the piece wakes it; a
      // breeze that a settled stack shrugs off must not restart the jitter.
      const external = dhypot(ax - state.gx, ay - state.gy)
      if (!forces.wakesAll && external <= config.solver.sleep_speed) continue
      body.asleep = false
      body.sleepTicks = 0
    }

    body.vx = (body.vx + ax) * config.solver.damping
    body.vy = (body.vy + ay) * config.solver.damping
  }

  // The order below is the load-bearing part of the solver, and it is the standard
  // impulse-solver order for a good reason: VELOCITY constraints are solved BEFORE the
  // positions are integrated. Resolving contacts after moving would let a settled tower
  // travel one tick's worth of wind acceleration every tick and slide off its base no
  // matter how much friction the manifest declares — the drift is applied before the
  // friction that was supposed to prevent it ever runs.
  //
  // EXACTLY `config.solver.iterations` velocity passes and then exactly the same number
  // of position passes — fixed by contract (§13), never adaptive, always in array order.
  const loads = supportedMasses(bodies, config)
  for (let pass = 0; pass < config.solver.iterations; pass += 1) {
    for (const [index, body] of bodies.entries()) {
      baseVelocity(body, config, state.gy, loads[index] ?? massOf(body))
    }
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i]
      if (a === undefined) continue
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j]
        if (b === undefined) continue
        pairVelocity(
          a,
          b,
          config,
          state.gx,
          state.gy,
          loads[i] ?? massOf(a),
          loads[j] ?? massOf(b),
        )
      }
    }
    // The base constraint is enforced again at the END of the pass. Gauss-Seidel keeps
    // whatever the LAST operation left behind, and a pair impulse always hands the
    // bottom piece back a share of the stack's momentum; closing the pass on the ground
    // contact is what stops a settled tower from creeping a fraction of a unit per tick
    // for a whole storm and eventually reading as a collapse.
    for (const [index, body] of bodies.entries()) {
      baseVelocity(body, config, state.gy, loads[index] ?? massOf(body))
    }
  }

  for (const body of bodies) {
    body.x += body.vx
    body.y += body.vy
  }

  for (let pass = 0; pass < config.solver.iterations; pass += 1) {
    for (const body of bodies) basePosition(body, config)
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i]
      if (a === undefined) continue
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j]
        if (b === undefined) continue
        pairPosition(a, b, config)
      }
    }
  }

  // Shatters, collected first and applied in ONE rebuild.
  const survivors: StackerBody[] = []
  let shattered = 0
  for (const body of bodies) {
    if (body.property === 'brittle' && body.propertyValue > 0 && body.impulse > body.propertyValue) {
      shattered += 1
      continue
    }
    survivors.push(body)
  }

  for (const body of survivors) {
    const speed = body.vx * body.vx + body.vy * body.vy
    const threshold = config.solver.sleep_speed * config.solver.sleep_speed
    if (speed <= threshold && isSupported(body, survivors, config)) {
      body.sleepTicks += 1
      if (body.sleepTicks >= config.solver.sleep_ticks) {
        body.asleep = true
        body.vx = 0
        body.vy = 0
      }
    } else {
      body.sleepTicks = 0
      body.asleep = false
    }
  }

  return { bodies: survivors, shattered }
}

/** Attraction towards the NEAREST other body inside the magnet's radius. Nearest by
 *  distance, ties broken by array order — never by a Set or Map walk. */
function magnetAccel(
  body: StackerBody,
  bodies: readonly StackerBody[],
  config: StackerConfig,
): { ax: number; ay: number } {
  let bestDistance = body.propertyValue
  let bestX = 0
  let bestY = 0
  let found = false
  for (const other of bodies) {
    if (other.uid === body.uid) continue
    const dx = other.x - body.x
    const dy = other.y - body.y
    const distance = dhypot(dx, dy)
    if (distance <= 0 || distance >= bestDistance) continue
    bestDistance = distance
    bestX = dx
    bestY = dy
    found = true
  }
  if (!found || bestDistance <= 0) return { ax: 0, ay: 0 }
  return {
    ax: (bestX / bestDistance) * config.solver.magnet_pull,
    ay: (bestY / bestDistance) * config.solver.magnet_pull,
  }
}

/** The collapse test — the criterion documented on `stackerCollapseSchema`. */
function hasCollapsed(
  state: StackerState,
  bodies: readonly StackerBody[],
  reading: StabilityReading,
  tick: number,
  shattered: number,
): boolean {
  const config = state.config
  if (shattered > 0 && config.collapse.brittle_breaks_run) return true

  for (const body of bodies) {
    if (tick - body.placedAt < config.collapse.grace_ticks) continue
    if (body.y > config.field.baseline_y) return true
    if (body.x < 0 || body.x > config.field.width) return true
    if (Math.abs(body.x - body.placedX) > config.collapse.max_shift) return true
  }

  if (bodies.length === 0) return false
  const armHeight = config.field.ground_y - reading.cy
  if (armHeight < config.collapse.tilt_min_height) return false
  const tilt = Math.abs(datan2(reading.cx - config.field.base_x, armHeight))
  return tilt > config.collapse.max_tilt_degrees
}

/** A collapse: charge a life, refund part of the spend, clear the field and hand the
 *  player a fresh build phase. The attempt's catalogue unlocks restart with it — a
 *  retry that inherited a locked-out catalogue would be unwinnable. */
function afterCollapse(state: StackerState, tick: number): StackerState {
  const config = state.config
  const netSpent = Math.max(0, state.spent - state.refunded)
  const refund = Math.round((netSpent * config.economy.collapse_refund_pct) / 100)
  const lives = state.lives === null ? null : Math.max(0, state.lives - 1)

  return {
    ...state,
    bodies: [],
    usesByPiece: config.catalog.map(() => 0),
    attemptPlacements: 0,
    refunded: state.refunded + refund,
    collapses: state.collapses + 1,
    lives,
    phase: 'build',
    buildDeadline: tick + 1 + config.placement.build_ticks,
    testStartTick: 0,
    holdTicks: 0,
    margin: 0,
    finished: lives !== null && lives <= 0,
  }
}

// ---- Simulator -------------------------------------------------------------------

function init(input: SimInit): StackerState {
  // The document was validated by `stackerConfigSchema`/`stackerContentSchema` before
  // it reached a simulator (core/schema.ts `parseGameDocument`, and the pipeline's
  // `gate` stage server-side), so this narrows rather than trusts.
  const config = input.config as unknown as StackerConfig
  const content = input.content as unknown as StackerContent
  const rng = createRng(input.seed)

  // One gust scale per timeline event, drawn ONCE and in event order: the whole
  // disturbance is a single decision a child can read, and the same seed reproduces it.
  const gusts = config.timeline.events.map(() => {
    const spread = config.timeline.gust_variance
    return 1 + (rng.next() * 2 - 1) * spread
  })

  return {
    config,
    gx: config.gravity.intensity * dcos(config.gravity.direction_degrees),
    gy: config.gravity.intensity * dsin(config.gravity.direction_degrees),
    foundationIds: content.roles.foundation,
    avoidIds: content.roles.avoid,
    gusts,
    seed: input.seed,

    phase: 'build',
    tick: 0,
    buildDeadline: config.placement.build_ticks,
    testStartTick: 0,

    bodies: [],
    nextUid: 1,
    usesByPiece: config.catalog.map(() => 0),

    spent: 0,
    refunded: 0,
    placements: 0,
    attemptPlacements: 0,
    repositions: 0,
    removals: 0,
    avoidUsed: 0,
    collapses: 0,
    shattered: 0,

    margin: 0,
    holdTicks: 0,
    bestHold: 0,
    testTicks: 0,
    minTestMargin: 0,
    maxHeight: 0,

    assistOn: false,
    lives: input.scoring.mode === 'cheer' ? null : (input.scoring.lives ?? null),
    won: false,
    finished: false,
  }
}

function step(
  state: StackerState,
  tick: number,
  events: readonly GameInputEvent[],
): StackerState {
  if (state.finished) return state
  const config = state.config
  let next: StackerState = { ...state, tick }

  // 1) Player intents, in log order — the WHOLE batch, never an early return.
  for (const event of events) {
    if (event.action === 'place') next = applyPlace(next, event, tick)
    else if (event.action === 'move') next = applyMove(next, event, tick)
    else if (event.action === 'remove') next = applyRemove(next, event)
    else if (event.action === 'ready') next = startTest(next, tick)
    else if (event.action === 'assist_on') next = { ...next, assistOn: true }
    else if (event.action === 'assist_off') next = { ...next, assistOn: false }
  }

  // 2) The build clock. `ready` is the player's early exit; this is the deadline.
  if (next.phase === 'build' && tick >= next.buildDeadline) next = startTest(next, tick)

  // 3) Forces, then physics. Physics runs in BOTH phases: a dropped piece has to fall
  //    and settle during the build, and that settling is part of the skill.
  const forces = forcesAt(next, tick)
  const physics = simulatePhysics(next, tick, forces)
  next = {
    ...next,
    bodies: physics.bodies,
    shattered: next.shattered + physics.shattered,
  }

  // 4) Metrics.
  //
  // The hold clock and the margin reading run ONLY while the structure is under test
  // AND actually stands at `target_height`. A single brick is beautifully stable and it
  // is not the structure the challenge asked for; without this gate the cheapest way to
  // a full stability score would be to build nothing, which is the opposite of the
  // lesson (and exactly what the `random` bot would otherwise stumble into).
  const reading = stabilityOf(next, forces)
  const height = heightOf(next)
  const qualifies = next.phase === 'test' && height >= config.stability.target_height
  let holdTicks = next.holdTicks
  let bestHold = next.bestHold
  let testTicks = next.testTicks
  let minTestMargin = next.minTestMargin

  if (qualifies) {
    testTicks += 1
    minTestMargin = testTicks === 1 ? reading.margin : Math.min(minTestMargin, reading.margin)
    if (reading.margin >= config.stability.margin_threshold) {
      holdTicks += 1
      if (holdTicks > bestHold) bestHold = holdTicks
    } else {
      holdTicks = 0
    }
  } else if (next.phase === 'test') {
    holdTicks = 0
  }

  next = {
    ...next,
    margin: reading.margin,
    maxHeight: Math.max(next.maxHeight, height),
    holdTicks,
    bestHold,
    testTicks,
    minTestMargin,
  }

  // 5) Collapse, then the terminal conditions.
  if (hasCollapsed(next, next.bodies, reading, tick, physics.shattered)) {
    next = afterCollapse(next, tick)
  }

  const won = next.phase === 'test' && next.holdTicks >= config.stability.hold_ticks
  const outOfTime = tick + 1 >= config.round.tick_budget
  return {
    ...next,
    won: next.won || won,
    finished: next.finished || won || outOfTime,
  }
}

function snapshot(state: StackerState): SimSnapshot {
  return {
    finished: state.finished,
    score: scoreOf(state),
    lives: state.lives,
    // Attempts, 1-based: a stacker's "round" is a build-and-test cycle, and a collapse
    // starts the next one.
    round: state.collapses + 1,
  }
}

function result(state: StackerState): SimResult {
  const netSpent = Math.max(0, state.spent - state.refunded)
  return {
    score: scoreOf(state),
    finished: state.finished,
    // Derived aggregates ONLY: `game_attempts.stats` may hold exactly this and nothing
    // tick-resolution about a child's session (§11).
    stats: {
      pieces: state.bodies.length,
      placements: state.placements,
      repositions: state.repositions,
      removals: state.removals,
      collapses: state.collapses,
      shattered: state.shattered,
      avoid_used: state.avoidUsed,
      spent: netSpent,
      budget_left: state.config.economy.budget - netSpent,
      height: Math.round(state.maxHeight),
      // Margin is a ratio; x100 keeps it an integer, which is what a stats column and
      // an analytics funnel can actually aggregate.
      margin_x100: Math.round(sustainedMarginOf(state) * 100),
      hold_ticks: state.bestHold,
      won: state.won ? 1 : 0,
      assisted: assistActive(state) ? 1 : 0,
      ticks: state.tick + 1,
    },
  }
}

// ---- The assist ------------------------------------------------------------------

/**
 * The piece the assist offers, and the piece the perfect bot reaches for: the WIDEST
 * affordable, unlocked, still-available piece that fits on whatever the structure
 * currently presents, breaking ties by mass and then by cost. Width is the right
 * heuristic because the support span is the numerator of the stability margin.
 *
 * Returns `null` when nothing can be placed — which the bot reads as "the build is
 * finished" and the view reads as "no suggestion".
 */
export function suggestPiece(state: StackerState): string | null {
  const config = state.config
  if (state.attemptPlacements >= config.placement.max_pieces) return null
  const available = budgetLeft(state)

  // The widest surface a new piece may sit on without overhanging: the base while the
  // field is empty, otherwise the topmost body.
  let ceiling = config.field.base_width
  const top = topmostIndex(state.bodies)
  const roof = top >= 0 ? state.bodies[top] : undefined
  if (roof !== undefined) ceiling = roof.w

  let bestId: string | null = null
  let bestW = -1
  let bestMass = -1
  let bestCost = Number.POSITIVE_INFINITY
  for (const [index, piece] of config.catalog.entries()) {
    if (state.avoidIds.includes(piece.item_id)) continue
    if (state.attemptPlacements < piece.unlock_after_pieces) continue
    if ((state.usesByPiece[index] ?? 0) >= piece.max_uses) continue
    const cost = costOfPiece(config, piece)
    if (cost > available) continue
    const size = rotatedSize(piece, 0, config.placement.rotation_steps)
    if (size.w > ceiling) continue
    const better =
      size.w > bestW ||
      (size.w === bestW && piece.mass > bestMass) ||
      (size.w === bestW && piece.mass === bestMass && cost < bestCost)
    if (!better) continue
    bestW = size.w
    bestMass = piece.mass
    bestCost = cost
    bestId = piece.item_id
  }
  return bestId
}

export const stackerSimulator: Simulator<StackerState> = {
  mechanic: 'stacker',
  actions: STACKER_ACTIONS,
  init,
  step,
  snapshot,
  result,
}
