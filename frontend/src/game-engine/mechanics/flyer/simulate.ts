// Flyer — the PURE simulator (GAME_ENGINE.md §5, §13; brief §4).
//
// DELIBERATELY 2.5D, NOT 6DoF (owner-approved, /GAME_ENGINE.md §13). Forward motion is
// a tick advance; the player steers pitch (climb/dive → altitude and speed) and an
// optional lane-like yaw. The three reasons, restated so this file stands alone:
// touch-first input on a phone cannot honestly express six degrees of freedom and
// §1.11 forbids a desktop-only control scheme; a full flight model overwhelms a 6–12
// year old and turns the money concept into decoration; and a deterministic replay
// budget is far easier to guarantee in 2.5D, since §5 bans exactly the transcendentals
// a full orientation model wants. Full 6DoF stays possible later behind this same
// manifest. The flight fantasy is NOT dropped — mount, energy, thermals, storms,
// armament and aerial enemies are all simulated here.
//
// PURITY. No React, no DOM, no `Date.now()`, no `Math.random()`, no I/O, no mutation of
// the state handed in. Fixed 50ms ticks. All trigonometry goes through `core/mathd.ts`
// (`dsin`/`dcos`), never `Math.sin`/`Math.cos`, because ECMAScript leaves those
// implementation-defined and Core re-derives every reward by replaying this simulator.
//
// Two engine-level rules the kernel documents and this file honours:
//  - PER-ENTITY TIMERS. An orbiting enemy's phase is `(tick - entity.bornAt) *
//    degrees_per_tick` and every weapon cooldown lives ON its entity. There is no
//    shared accumulator anywhere, so N enemies never advance N times too fast — that
//    exact bug made N bombs tick N times too fast in v1.
//  - BATCHED REMOVALS. Every collision this tick is resolved over the whole entity
//    array and the survivors are produced in ONE filter, so several simultaneous
//    pickups are one state transition rather than the first pickup plus a stalled
//    world (v1 dropped all but the first and stalled motion that frame).
//
// RANDOMNESS. Spawning and turbulence need a seeded stream, but a live `Rng` object
// held in state would be a mutable box smuggled through a "pure" `step`. So `init`
// draws a fixed TAPE of values from `core/rng.ts` and the state carries only an integer
// cursor into it. Reading the tape is pure, the cursor is part of the returned state,
// and stepping the same state twice is identical by construction. The tape wraps, so it
// can never run dry mid-run.
//
// THE STALL CONDITION (also documented on `stallSchema`): the mount stalls when
// `speed < flight.stall.speed` while its nose is above the glide band. While stalled the
// pitch is forced to `stall.pitch_deg`, climb/dive commands are ignored for
// `control_lockout_ticks`, energy regen is blocked and the mount sinks an extra
// `stall.sink_per_tick`. It recovers when `speed >= stall.recover_speed`.
//
// THE ENERGY CURVE: climbing drains, gliding (nose below the band) regenerates,
// level flight trickles, a thermal pays the most, the beam drains while held, and each
// climb/dive/lane COMMAND costs a flat manoeuvre fee. At zero energy a climb is refused
// and the beam cuts out — the mount still flies and can still glide back up its
// reserve, so running dry is a setback, never a dead end. Thermals are the income and
// sharp manoeuvres are the expense; that is the sentence this mechanic teaches.

import { dcos, dsin } from '@/game-engine/core/mathd'
import { createRng } from '@/game-engine/core/rng'
import {
  applyPenalty,
  comboMultiplier,
  efficiencyScore,
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
  FlyerConfig,
  FlyerContent,
  FlyerElementRole,
  FlyerEnemyPattern,
  FlyerEnemyType,
  FlyerPattern,
} from './schema'

/** The five logical inputs. `lane` stays a VALID action even when the manifest
 *  disables lanes, so a log recorded by a client that emitted it replays instead of
 *  being rejected for an `unknown_action`. */
export const FLYER_ACTIONS = ['climb', 'dive', 'fire', 'beam_start', 'beam_end', 'lane'] as const

/** Draws reserved per tick on the random tape: one for turbulence plus headroom for a
 *  spawn burst. The tape wraps rather than overflowing, which keeps a pathological
 *  manifest deterministic instead of undefined. */
const DRAWS_PER_TICK = 6

/** Hard ceiling on patterns materialised in a single tick — a runaway manifest must
 *  degrade to a sparser sky, never to a frozen main thread. */
const MAX_SPAWNS_PER_TICK = 6

/** Pitch is clamped here so `dsin` never sees a vertical attitude, which would make
 *  the forward advance meaningless in a mechanic whose forward motion is constant. */
const MAX_PITCH_DEG = 85

// ---- State -----------------------------------------------------------------------

export interface FlyerEntity {
  /** Monotonic within a run: identity for a batched removal, never an array index. */
  key: number
  role: FlyerElementRole
  /** The catalog item this entity carries, or null for terrain and zones. */
  itemId: string | null
  /** For `enemy` entities: which declared type it instantiates. */
  enemyTypeId: string | null
  /** World x of the left edge (the sky scrolls; the mount's x is fixed). */
  x: number
  y: number
  w: number
  h: number
  lane: number
  /** The tick this entity was spawned on — its OWN timer base. */
  bornAt: number
  /** Enemy hit points; 0 for everything else. */
  hp: number
  /** Orbit anchor, drifting on its own; unused by the other patterns. */
  anchorX: number
  anchorY: number
  /** Per-entity weapon timer. */
  fireCooldown: number
}

export interface FlyerShot {
  key: number
  x: number
  y: number
  w: number
  h: number
  lane: number
  /** World units per tick; positive for the mount's shots, negative for an enemy's. */
  vx: number
  damage: number
  fromMount: boolean
  /** World units of travel left before the shot fizzles. */
  rangeLeft: number
}

export interface FlyerState {
  config: FlyerConfig
  enemyTypes: readonly FlyerEnemyType[]
  goodIds: readonly string[]
  badIds: readonly string[]
  /** The seeded random tape (see the module note). */
  draws: readonly number[]
  drawCursor: number

  /** Upgrade-resolved constants, computed ONCE at init so the hot loop never re-reads
   *  the upgrades block (and so "where did this number come from" has one answer). */
  turnRate: number
  energyCapacity: number
  armour: number
  damageScale: number

  tick: number
  distance: number
  /** High-water distance — the survival signal. */
  reach: number

  altitude: number
  pitch: number
  speed: number
  /** Ticks left on the current climb/dive command, and the attitude it holds. */
  commandLeft: number
  commandPitch: number

  stalled: boolean
  stallLockLeft: number
  stalls: number

  energy: number
  /** Nominal energy drained over the run — the economy signal the score reads. */
  energySpent: number

  /** Fractional lane position (the yaw), its commanded target, both in lane units. */
  lanePos: number
  laneTarget: number

  beamOn: boolean
  beamTicks: number
  shotCooldown: number
  shotsFired: number

  hull: number
  hullMax: number
  graceUntil: number

  entities: readonly FlyerEntity[]
  shots: readonly FlyerShot[]
  spawnCursor: number
  nextKey: number

  combo: number
  comboBest: number
  points: number
  collected: number
  missed: number
  wrong: number
  enemyPoints: number
  enemiesDowned: number
  slams: number
  hits: number
  thermalTicks: number
  stormTicks: number
  commands: number

  lives: number | null
  finished: boolean
  reachedTarget: boolean
}

// ---- Small helpers ----------------------------------------------------------------

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
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
  // frame-perfect dodge land as a success rather than as a hit.
  return ax + aw > bx && ax < bx + bw && ay + ah > by && ay < by + bh
}

/** World x of the mount's left edge. */
export function mountLeftX(state: FlyerState): number {
  return state.distance + state.config.world.avatar_x
}

/** Vertical centre of the mount, in design units. */
export function mountCentreY(state: FlyerState): number {
  return state.altitude + state.config.world.mount_h / 2
}

/** Whether an entity shares the mount's lane closely enough to interact. With lanes
 *  disabled everything shares the single lane, which is what makes `lanes.enabled`
 *  a pure difficulty knob rather than a second mechanic. */
export function laneMatches(state: FlyerState, lane: number): boolean {
  if (!state.config.lanes.enabled) return true
  return Math.abs(state.lanePos - lane) <= state.config.lanes.hit_band
}

/** The beam's damage box: forward from the mount's nose, centred on it. */
export function beamBox(state: FlyerState): { x: number; y: number; w: number; h: number } {
  const beam = state.config.armament.beam
  const world = state.config.world
  return {
    x: mountLeftX(state) + world.mount_w,
    y: mountCentreY(state) - beam.width_units / 2,
    w: beam.range_units,
    h: beam.width_units,
  }
}

/** True while the mount sits inside a zone of that role. Zones ignore lanes: a
 *  thermal column and a storm cell fill the sky, they are not lane furniture. */
function insideZone(state: FlyerState, role: 'thermal' | 'storm'): boolean {
  const world = state.config.world
  const x = mountLeftX(state)
  for (const entity of state.entities) {
    if (entity.role !== role) continue
    if (overlaps(x, state.altitude, world.mount_w, world.mount_h, entity.x, entity.y, entity.w, entity.h)) {
      return true
    }
  }
  return false
}

export function isInThermal(state: FlyerState): boolean {
  return insideZone(state, 'thermal')
}

export function isInStorm(state: FlyerState): boolean {
  return insideZone(state, 'storm')
}

function enemyTypeOf(state: FlyerState, id: string | null): FlyerEnemyType | null {
  if (id === null) return null
  for (const type of state.enemyTypes) {
    if (type.id === id) return type
  }
  return null
}

/** The pattern a boss is flying right now: the LAST declared phase whose threshold the
 *  boss's remaining hit points have fallen to or below. Non-bosses fly their own. */
export function activePattern(
  type: FlyerEnemyType,
  hp: number,
): { pattern: FlyerEnemyPattern; speedMultiplier: number; fireMultiplier: number } {
  if (type.pattern !== 'boss' || type.phases === undefined) {
    return { pattern: type.pattern, speedMultiplier: 1, fireMultiplier: 1 }
  }
  const pct = type.hp > 0 ? (hp / type.hp) * 100 : 0
  let chosen = type.phases[0]
  for (const phase of type.phases) {
    if (pct <= phase.from_hp_pct) chosen = phase
  }
  if (chosen === undefined) return { pattern: 'pursuit', speedMultiplier: 1, fireMultiplier: 1 }
  return {
    pattern: chosen.pattern,
    speedMultiplier: chosen.speed_multiplier,
    fireMultiplier: chosen.fire_cooldown_multiplier,
  }
}

// ---- Random tape --------------------------------------------------------------------

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

function pickPattern(patterns: readonly FlyerPattern[], roll: number): FlyerPattern | null {
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

// ---- Input --------------------------------------------------------------------------

/** One drain, charged to both the reserve and the economy counter. Nominal, not
 *  actual: a manoeuvre attempted on an empty reserve still counts as a spend, so the
 *  score cannot be gamed by flying broke. */
function spend(state: FlyerState, amount: number): FlyerState {
  if (amount <= 0) return state
  return {
    ...state,
    energy: Math.max(0, state.energy - amount),
    energySpent: state.energySpent + amount,
  }
}

function applyEvent(state: FlyerState, event: GameInputEvent): FlyerState {
  const config = state.config
  const controlsLocked = state.stalled && state.stallLockLeft > 0

  if (event.action === 'climb') {
    if (controlsLocked) return state
    // The energy crunch, made concrete: with an empty reserve the mount simply cannot
    // pull its nose up. It can still glide, and gliding is how the reserve comes back.
    if (state.energy <= 0) return state
    const next = spend(
      { ...state, commandPitch: config.flight.climb_pitch_deg, commandLeft: config.flight.command_ticks, commands: state.commands + 1 },
      config.energy.manoeuvre_cost,
    )
    return next
  }

  if (event.action === 'dive') {
    if (controlsLocked) return state
    return spend(
      { ...state, commandPitch: config.flight.dive_pitch_deg, commandLeft: config.flight.command_ticks, commands: state.commands + 1 },
      config.energy.manoeuvre_cost,
    )
  }

  if (event.action === 'fire') {
    const projectile = config.armament.projectile
    if (!projectile.enabled || state.shotCooldown > 0) return state
    if (state.energy < projectile.energy_cost) return state
    const shot: FlyerShot = {
      key: state.nextKey,
      x: mountLeftX(state) + config.world.mount_w,
      y: mountCentreY(state) - projectile.h / 2,
      w: projectile.w,
      h: projectile.h,
      lane: state.lanePos,
      vx: projectile.speed_per_tick,
      damage: projectile.damage,
      fromMount: true,
      rangeLeft: projectile.range_units,
    }
    return spend(
      {
        ...state,
        shots: [...state.shots, shot],
        nextKey: state.nextKey + 1,
        shotCooldown: projectile.cooldown_ticks,
        shotsFired: state.shotsFired + 1,
      },
      projectile.energy_cost,
    )
  }

  if (event.action === 'beam_start') {
    if (!config.armament.beam.enabled || state.energy <= 0) return state
    return { ...state, beamOn: true }
  }

  if (event.action === 'beam_end') {
    return state.beamOn ? { ...state, beamOn: false } : state
  }

  if (event.action === 'lane') {
    const lanes = config.lanes
    if (!lanes.enabled || lanes.count < 2) return state
    // `n` names the lane outright; without it the command steps to the next lane and
    // wraps, so a client with one button is not locked out of the yaw axis.
    const stepped = state.laneTarget + 1
    const wrapped = stepped - Math.floor(stepped / lanes.count) * lanes.count
    const requested = event.n === undefined ? wrapped : Math.floor(event.n)
    const target = clamp(requested, 0, lanes.count - 1)
    if (target === state.laneTarget) return state
    return spend({ ...state, laneTarget: target, commands: state.commands + 1 }, lanes.energy_cost)
  }

  return state
}

// ---- Flight, energy, weather ---------------------------------------------------------

function flyMount(state: FlyerState, turbulenceRoll: number): FlyerState {
  const config = state.config
  const flight = config.flight
  const mount = config.mount
  const world = config.world
  const inThermal = isInThermal(state)
  const inStorm = isInStorm(state)

  // 1. Attitude. The commanded pitch holds for `command_ticks`; after that the nose
  //    self-levels at `turn_rate * (1 - inertia)` — inertia 0 is arcade (snaps back),
  //    inertia 1 is simulation (drifts until flown back by hand).
  const commandLeft = Math.max(0, state.commandLeft - 1)
  const commanded = state.commandLeft > 0
  const pitchTarget = state.stalled ? flight.stall.pitch_deg : commanded ? state.commandPitch : 0
  const rate = commanded || state.stalled ? state.turnRate : state.turnRate * (1 - flight.inertia)
  const delta = pitchTarget - state.pitch
  let pitch = state.pitch + clamp(delta, -rate, rate)

  const turbulence = inStorm ? config.environment.storm.turbulence_deg : config.weather.turbulence_deg
  if (turbulence > 0) pitch += (turbulenceRoll * 2 - 1) * turbulence
  pitch = clamp(pitch, -MAX_PITCH_DEG, MAX_PITCH_DEG)

  // 2. Speed. Thrust minus drag, then the pitch coupling: a climb trades speed for
  //    altitude and a dive trades altitude back for speed. This is the whole reason a
  //    stall exists.
  const sin = dsin(pitch)
  let speed = state.speed + mount.thrust_per_tick - mount.drag_per_tick * state.speed
  if (sin > 0) speed -= flight.climb_speed_cost * sin
  else speed += flight.dive_speed_gain * -sin
  speed = clamp(speed, mount.min_speed, mount.top_speed)

  // 3. Stall. Entered on slow + nose-up, left on recovered speed once the lockout has
  //    run out. Evaluated AFTER the speed update on purpose, so a dive that restores
  //    speed this tick also clears the stall this tick.
  let stalled = state.stalled
  let stallLockLeft = Math.max(0, state.stallLockLeft - 1)
  let stalls = state.stalls
  if (!stalled) {
    if (speed < flight.stall.speed && pitch > config.energy.glide_band_deg) {
      stalled = true
      stallLockLeft = flight.stall.control_lockout_ticks
      stalls += 1
    }
  } else if (speed >= flight.stall.recover_speed && stallLockLeft <= 0) {
    stalled = false
  }

  // 4. Altitude. Design y grows downward, so a positive pitch (nose up) SUBTRACTS.
  const lowest = world.floor_y - world.mount_h
  let altitude = state.altitude - flight.lift_per_tick * speed * sin
  if (stalled) altitude += flight.stall.sink_per_tick
  if (inThermal) altitude -= config.environment.thermal.lift_per_tick
  const grounded = altitude >= lowest
  altitude = clamp(altitude, world.ceiling_y, lowest)

  // 5. Yaw. The lane position INTERPOLATES toward its target, and the crosswind pushes
  //    it the whole time — which is what makes a crosswind something to fly against
  //    rather than a number in a config file.
  let lanePos = state.lanePos
  if (config.lanes.enabled && config.lanes.count > 1) {
    const per = 1 / config.lanes.shift_ticks
    lanePos += clamp(state.laneTarget - lanePos, -per, per)
    lanePos += config.weather.crosswind_per_tick
    lanePos = clamp(lanePos, 0, config.lanes.count - 1)
  }

  // 6. The energy curve (see the module header).
  let drain = 0
  let regen = 0
  if (!stalled) {
    if (pitch > config.energy.glide_band_deg) drain += config.energy.climb_drain_per_tick
    else if (pitch < -config.energy.glide_band_deg) regen += config.energy.glide_regen_per_tick
    else regen += config.energy.level_regen_per_tick
    if (inThermal) regen += config.energy.thermal_regen_per_tick
  }
  if (inStorm) drain += config.environment.storm.drain_per_tick
  let beamOn = state.beamOn
  if (beamOn) drain += config.armament.beam.drain_per_tick
  const energy = clamp(state.energy - drain + regen, 0, state.energyCapacity)
  if (beamOn && energy <= 0) beamOn = false

  const next: FlyerState = {
    ...state,
    pitch,
    speed,
    altitude,
    commandLeft,
    stalled,
    stallLockLeft,
    stalls,
    lanePos,
    beamOn,
    beamTicks: beamOn ? state.beamTicks + 1 : state.beamTicks,
    energy,
    energySpent: state.energySpent + drain,
    shotCooldown: Math.max(0, state.shotCooldown - 1),
    thermalTicks: inThermal ? state.thermalTicks + 1 : state.thermalTicks,
    stormTicks: inStorm ? state.stormTicks + 1 : state.stormTicks,
  }

  // Meeting the ground is a hit like any other, grace-gated so a low pass costs once.
  if (!grounded) return next
  return damageMount(next, config.environment.obstacle.damage, next.tick)
}

// ---- Damage --------------------------------------------------------------------------

/** Applies damage to the mount, honouring armour and the grace window. A depleted hull
 *  costs a life in arcade mode and is a stumble in cheer mode, which by rule has no
 *  fail state at all. */
function damageMount(state: FlyerState, raw: number, tick: number): FlyerState {
  if (tick < state.graceUntil) return state
  const taken = Math.max(0, raw - state.armour)
  const hull = state.hull - taken
  const base: FlyerState = {
    ...state,
    hits: state.hits + 1,
    combo: 0,
    graceUntil: tick + state.config.mount.hit_grace_ticks,
  }
  if (hull > 0) return { ...base, hull }
  if (base.lives === null) return { ...base, hull: base.hullMax }
  const lives = base.lives - 1
  if (lives <= 0) return { ...base, hull: 0, lives: 0, finished: true }
  return { ...base, hull: base.hullMax, lives }
}

/** Damage the mount's armament deals to one enemy, after the upgrade element match,
 *  the global damage bonus, the enemy's armour and the rain. */
function damageToEnemy(state: FlyerState, base: number, type: FlyerEnemyType, doused: boolean): number {
  const upgrades = state.config.upgrades
  let amount = base * state.damageScale
  if (
    upgrades.attack_element !== 'none' &&
    type.weak_to !== undefined &&
    type.weak_to === upgrades.attack_element
  ) {
    amount *= upgrades.element_multiplier
  }
  if (doused) amount *= state.config.weather.rain.effectiveness_pct / 100
  return Math.max(0, amount - type.armour)
}

// ---- Spawning / despawning -------------------------------------------------------------

function despawn(state: FlyerState): FlyerState {
  const kept: FlyerEntity[] = []
  let missed = state.missed
  for (const entity of state.entities) {
    if (entity.x + entity.w >= state.distance) {
      kept.push(entity)
      continue
    }
    if (entity.role === 'good') missed += 1
  }
  const shots: FlyerShot[] = []
  for (const shot of state.shots) {
    if (shot.rangeLeft > 0 && shot.x + shot.w >= state.distance) shots.push(shot)
  }
  if (
    kept.length === state.entities.length &&
    shots.length === state.shots.length &&
    missed === state.missed
  ) {
    return state
  }
  return { ...state, entities: kept, shots, missed }
}

function spawn(state: FlyerState, tick: number): FlyerState {
  const config = state.config
  const horizon = state.distance + config.world.width + config.spawn.lead_units
  if (state.spawnCursor > horizon) return state

  const added: FlyerEntity[] = []
  let cursor = state.spawnCursor
  let key = state.nextKey
  let draw = state.drawCursor
  let guard = 0

  while (cursor <= horizon && guard < MAX_SPAWNS_PER_TICK) {
    guard += 1
    const eligible: FlyerPattern[] = []
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

      let hp = 0
      let enemyTypeId: string | null = null
      // An enemy's hit box comes from its TYPE, not from the placement: the type is the
      // authority on how big that enemy is, and a pattern that could resize it would
      // make "slow and armoured" mean something different in every pattern.
      let w = element.w
      let h = element.h
      if (element.role === 'enemy') {
        const type = enemyTypeOf(state, element.enemy_type ?? null)
        if (type === null) continue
        enemyTypeId = type.id
        hp = type.hp
        w = type.w
        h = type.h
        if (type.item_id !== undefined) itemId = type.item_id
      }

      const x = cursor + element.dx
      added.push({
        key,
        role: element.role,
        itemId,
        enemyTypeId,
        x,
        y: element.y,
        w,
        h,
        lane: element.lane,
        bornAt: tick,
        hp,
        anchorX: x,
        anchorY: element.y,
        fireCooldown: 0,
      })
      key += 1
    }

    const span = config.spawn.max_gap_units - config.spawn.min_gap_units + 1
    const gap = config.spawn.min_gap_units + Math.floor(drawAt(state.draws, draw) * span)
    draw += 1
    cursor = cursor + pattern.length_units + gap
  }

  if (added.length === 0) return { ...state, spawnCursor: cursor, drawCursor: draw }
  return {
    ...state,
    entities: [...state.entities, ...added],
    spawnCursor: cursor,
    nextKey: key,
    drawCursor: draw,
  }
}

// ---- Enemy AI ---------------------------------------------------------------------------

/** Advances every enemy on its OWN timer and lets the ready ones fire. Collectibles,
 *  obstacles and zones are static furniture and are returned untouched. */
function flyEnemies(state: FlyerState, tick: number): FlyerState {
  if (state.entities.length === 0) return state
  const mountX = mountLeftX(state)
  const mountY = mountCentreY(state)

  const moved: FlyerEntity[] = []
  const fired: FlyerShot[] = []
  let key = state.nextKey
  let changed = false

  for (const entity of state.entities) {
    if (entity.role !== 'enemy') {
      moved.push(entity)
      continue
    }
    const type = enemyTypeOf(state, entity.enemyTypeId)
    if (type === null) {
      moved.push(entity)
      continue
    }
    const { pattern, speedMultiplier, fireMultiplier } = activePattern(type, entity.hp)
    let x = entity.x
    let y = entity.y
    let anchorX = entity.anchorX
    const anchorY = entity.anchorY

    if (pattern === 'circle' && type.orbit !== undefined) {
      // PER-ENTITY phase, from this entity's own birth tick.
      const phase = (tick - entity.bornAt) * type.orbit.degrees_per_tick
      anchorX = entity.anchorX - type.orbit.drift_per_tick * speedMultiplier
      x = anchorX + type.orbit.radius_units * dcos(phase)
      y = anchorY + type.orbit.radius_units * dsin(phase)
    } else if (pattern === 'pursuit' && type.pursuit !== undefined) {
      x -= type.pursuit.close_per_tick * speedMultiplier
      const dy = mountY - (y + entity.h / 2)
      const climb = type.pursuit.climb_per_tick * speedMultiplier
      y += clamp(dy, -climb, climb)
    } else if (pattern === 'retreat' && type.retreat !== undefined) {
      const gap = x - mountX
      const adjust = type.retreat.adjust_per_tick * speedMultiplier
      x += gap < type.retreat.keep_distance_units ? adjust : -adjust
    }
    // No `else`: the schema guarantees every declared pattern (and every boss phase)
    // carries its own motion block, so there is no third case to invent a speed for.
    // An enemy that somehow reached here holds station and is simply overtaken.

    let fireCooldown = Math.max(0, entity.fireCooldown - 1)
    if (type.fire.enabled && fireCooldown <= 0) {
      const gap = x - mountX
      if (gap > 0 && gap <= type.fire.range_units) {
        fired.push({
          key,
          x: x - type.fire.w,
          y: y + entity.h / 2 - type.fire.h / 2,
          w: type.fire.w,
          h: type.fire.h,
          lane: entity.lane,
          vx: -type.fire.speed_per_tick,
          damage: type.fire.damage,
          fromMount: false,
          rangeLeft: type.fire.range_units,
        })
        key += 1
        fireCooldown = Math.max(1, Math.round(type.fire.cooldown_ticks * fireMultiplier))
      }
    }

    if (x !== entity.x || y !== entity.y || fireCooldown !== entity.fireCooldown) changed = true
    moved.push({ ...entity, x, y, anchorX, fireCooldown })
  }

  if (!changed && fired.length === 0) return state
  return {
    ...state,
    entities: moved,
    shots: fired.length === 0 ? state.shots : [...state.shots, ...fired],
    nextKey: key,
  }
}

/** Advances every shot on its own budget. A shot that runs out of range is dropped by
 *  `despawn` on the next tick, in the same single batched pass as everything else. */
function flyShots(state: FlyerState): FlyerState {
  if (state.shots.length === 0) return state
  const moved: FlyerShot[] = []
  for (const shot of state.shots) {
    const travel = Math.abs(shot.vx)
    moved.push({ ...shot, x: shot.x + shot.vx, rangeLeft: shot.rangeLeft - travel })
  }
  return { ...state, shots: moved }
}

// ---- Collisions -------------------------------------------------------------------------

function resolveCollisions(state: FlyerState, tick: number): FlyerState {
  const config = state.config
  const world = config.world
  const ax = mountLeftX(state)
  const ay = state.altitude
  const aw = world.mount_w
  const ah = world.mount_h
  const doused =
    config.weather.rain.enabled && isInStorm(state) ? config.weather.rain.douses : 'none'

  const removedEntities: number[] = []
  const removedShots: number[] = []
  const damage: number[] = []

  let next: FlyerState = state
  let combo = state.combo
  let comboBest = state.comboBest
  let points = state.points
  let collected = state.collected
  let wrong = state.wrong
  let enemyPoints = state.enemyPoints
  let enemiesDowned = state.enemiesDowned
  let slams = state.slams
  /** At most one ram per tick, and none at all while the mount is still reeling from
   *  the last hit. Without this an overlapping boss would be billed once per tick and
   *  melt in a second — a "melee that risks a collision" has to cost something. */
  let slammed = false

  // Enemy hit points are accumulated into a parallel array so several damage sources on
  // the SAME tick (a shot, the beam and a slam) all land, rather than the first one
  // winning and the rest being lost to a stale read.
  const hpByKey = new Map<number, number>()
  for (const entity of state.entities) {
    if (entity.role === 'enemy') hpByKey.set(entity.key, entity.hp)
  }

  const hurtEnemy = (entity: FlyerEntity, amount: number): void => {
    const current = hpByKey.get(entity.key)
    if (current === undefined) return
    hpByKey.set(entity.key, current - amount)
  }

  // 1. The mount against the world.
  for (const entity of state.entities) {
    if (entity.role === 'thermal' || entity.role === 'storm') continue
    if (!laneMatches(state, entity.lane)) continue
    if (!overlaps(ax, ay, aw, ah, entity.x, entity.y, entity.w, entity.h)) continue

    if (entity.role === 'good') {
      points += config.scoring.collect_points * comboMultiplier(combo, config.scoring.combo)
      combo += 1
      if (combo > comboBest) comboBest = combo
      collected += 1
      removedEntities.push(entity.key)
      continue
    }
    if (entity.role === 'bad') {
      wrong += 1
      combo = 0
      removedEntities.push(entity.key)
      continue
    }
    if (entity.role === 'obstacle') {
      damage.push(config.environment.obstacle.damage)
      removedEntities.push(entity.key)
      continue
    }
    // enemy — the optional body slam. It is a CONSEQUENCE of contact at speed, not a
    // sixth button: ramming trades hull for damage, which is what makes it a risk.
    if (tick < state.graceUntil || slammed) continue
    const type = enemyTypeOf(state, entity.enemyTypeId)
    const slam = config.armament.slam
    if (type !== null && slam.enabled && state.speed >= slam.min_speed) {
      hurtEnemy(entity, damageToEnemy(state, slam.damage, type, false))
      slams += 1
      slammed = true
      damage.push(slam.self_damage)
      next = spend(next, slam.energy_cost)
      continue
    }
    damage.push(type?.contact_damage ?? 0)
  }

  // 2. Shots, in both directions.
  for (const shot of state.shots) {
    if (shot.fromMount) {
      for (const entity of state.entities) {
        if (entity.role !== 'enemy') continue
        if (config.lanes.enabled && Math.abs(shot.lane - entity.lane) > config.lanes.hit_band) continue
        if (!overlaps(shot.x, shot.y, shot.w, shot.h, entity.x, entity.y, entity.w, entity.h)) continue
        const type = enemyTypeOf(state, entity.enemyTypeId)
        if (type === null) continue
        hurtEnemy(entity, damageToEnemy(state, shot.damage, type, doused === 'projectile'))
        removedShots.push(shot.key)
        break
      }
      continue
    }
    if (!laneMatches(state, shot.lane)) continue
    if (!overlaps(ax, ay, aw, ah, shot.x, shot.y, shot.w, shot.h)) continue
    damage.push(shot.damage)
    removedShots.push(shot.key)
  }

  // 3. The beam — continuous damage for continuous energy, applied to everything inside
  //    its box this tick.
  if (state.beamOn && config.armament.beam.enabled) {
    const box = beamBox(state)
    for (const entity of state.entities) {
      if (entity.role !== 'enemy') continue
      if (!laneMatches(state, entity.lane)) continue
      if (!overlaps(box.x, box.y, box.w, box.h, entity.x, entity.y, entity.w, entity.h)) continue
      const type = enemyTypeOf(state, entity.enemyTypeId)
      if (type === null) continue
      hurtEnemy(
        entity,
        damageToEnemy(state, config.armament.beam.damage_per_tick, type, doused === 'beam'),
      )
    }
  }

  // 4. Downed enemies join the SAME removal batch as the pickups.
  for (const entity of state.entities) {
    if (entity.role !== 'enemy') continue
    const hp = hpByKey.get(entity.key)
    if (hp === undefined || hp > 0) continue
    const type = enemyTypeOf(state, entity.enemyTypeId)
    enemyPoints += type?.points ?? 0
    enemiesDowned += 1
    removedEntities.push(entity.key)
  }

  // Nothing touched anything and there is no enemy whose hit points could have moved:
  // hand the state straight back rather than rebuilding two arrays for nothing.
  if (
    removedEntities.length === 0 &&
    removedShots.length === 0 &&
    damage.length === 0 &&
    hpByKey.size === 0
  ) {
    return next
  }

  // ONE removal pass over each collection (the batched-removal rule).
  const entities: FlyerEntity[] = []
  for (const entity of state.entities) {
    if (removedEntities.includes(entity.key)) continue
    if (entity.role !== 'enemy') {
      entities.push(entity)
      continue
    }
    const hp = hpByKey.get(entity.key)
    entities.push(hp === undefined || hp === entity.hp ? entity : { ...entity, hp })
  }
  const shots: FlyerShot[] = []
  for (const shot of state.shots) {
    if (!removedShots.includes(shot.key)) shots.push(shot)
  }

  next = {
    ...next,
    entities,
    shots,
    combo,
    comboBest,
    points,
    collected,
    wrong,
    enemyPoints,
    enemiesDowned,
    slams,
  }

  // Damage last, and one grace window for the whole tick: three simultaneous hits are
  // one wound, not three, which is what keeps a dense pattern survivable.
  for (const amount of damage) {
    next = damageMount(next, amount, tick)
  }
  return next
}

// ---- Score ---------------------------------------------------------------------------------

function computeScore(state: FlyerState): number {
  const weights = state.config.scoring
  const blend = weightedScore([
    { value: survivalScore(state.reach, state.config.target_distance), weight: weights.distance_weight },
    { value: targetScore(state.points, weights.collect_target), weight: weights.collect_weight },
    { value: targetScore(state.enemyPoints, weights.combat_target), weight: weights.combat_weight },
    // The economy signal: a run that reached the same places on less energy scores
    // higher, which is the resource-management lesson stated in points.
    { value: efficiencyScore(state.energySpent, weights.energy_budget), weight: weights.energy_weight },
  ])
  const afterWrong = applyPenalty(blend, state.wrong, weights.wrong_penalty_pct)
  const afterHits = applyPenalty(afterWrong, state.hits, weights.hit_penalty_pct)
  return applyPenalty(afterHits, state.stalls, weights.stall_penalty_pct)
}

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

// ---- The simulator ------------------------------------------------------------------------------

export const flyerSimulator: Simulator<FlyerState> = {
  mechanic: 'flyer',
  actions: FLYER_ACTIONS,

  init(input: SimInit): FlyerState {
    // The document was validated by `flyerConfigSchema`/`flyerContentSchema` before it
    // ever reached a simulator (core/schema.ts `parseGameDocument`, and the pipeline's
    // `gate` stage server-side), so this narrows rather than trusts.
    const config = input.config as unknown as FlyerConfig
    const content = input.content as unknown as FlyerContent

    const capacity = config.energy.capacity + config.upgrades.energy_capacity_bonus
    const start = Math.min(config.energy.start, capacity)
    const midAltitude = Math.round(
      (config.world.ceiling_y + config.world.floor_y - config.world.mount_h) / 2,
    )

    return {
      config,
      enemyTypes: config.enemies,
      goodIds: content.roles.collect,
      badIds: content.roles.avoid,
      draws: buildDraws(input.seed, config.max_ticks),
      drawCursor: 0,

      turnRate: config.mount.turn_rate_deg + config.upgrades.turn_speed_bonus_deg,
      energyCapacity: capacity,
      armour: config.mount.armour + config.upgrades.armour_bonus,
      damageScale: 1 + config.upgrades.damage_bonus_pct / 100,

      tick: 0,
      distance: 0,
      reach: 0,

      altitude: midAltitude,
      pitch: 0,
      speed: config.mount.start_speed,
      commandLeft: 0,
      commandPitch: 0,

      stalled: false,
      stallLockLeft: 0,
      stalls: 0,

      energy: start,
      energySpent: 0,

      lanePos: 0,
      laneTarget: 0,

      beamOn: false,
      beamTicks: 0,
      shotCooldown: 0,
      shotsFired: 0,

      hull: config.mount.hull,
      hullMax: config.mount.hull,
      graceUntil: 0,

      entities: [],
      shots: [],
      spawnCursor: config.world.width,
      nextKey: 1,

      combo: 0,
      comboBest: 0,
      points: 0,
      collected: 0,
      missed: 0,
      wrong: 0,
      enemyPoints: 0,
      enemiesDowned: 0,
      slams: 0,
      hits: 0,
      thermalTicks: 0,
      stormTicks: 0,
      commands: 0,

      lives: input.scoring.lives ?? null,
      finished: false,
      reachedTarget: false,
    }
  },

  step(state: FlyerState, tick: number, events: readonly GameInputEvent[]): FlyerState {
    if (state.finished) return state
    let next: FlyerState = { ...state, tick }

    // 1. inputs — the WHOLE batch, never an early return after the first event.
    for (const event of events) next = applyEvent(next, event)

    // 2. flight, energy and weather; 3. the world advance; 4. spawning; 5. the enemies
    //    and every shot; 6. collisions.
    const turbulenceRoll = drawAt(next.draws, next.drawCursor)
    next = { ...next, drawCursor: next.drawCursor + 1 }
    next = flyMount(next, turbulenceRoll)

    const distance = next.distance + next.speed
    next = { ...next, distance, reach: Math.max(next.reach, distance) }

    next = despawn(next)
    next = spawn(next, tick)
    next = flyEnemies(next, tick)
    next = flyShots(next)
    next = resolveCollisions(next, tick)

    // 7. terminal conditions.
    const reachedTarget = next.reach >= next.config.target_distance
    const outOfTime = tick + 1 >= next.config.max_ticks
    return {
      ...next,
      reachedTarget,
      finished: next.finished || reachedTarget || outOfTime,
    }
  },

  snapshot(state: FlyerState): SimSnapshot {
    return {
      finished: state.finished,
      score: computeScore(state),
      lives: state.lives,
      // "Round" is the leg of the journey — the HUD's progress unit for a mechanic
      // that has waves of neither enemies nor rounds, only distance.
      round:
        state.config.target_distance > 0
          ? Math.min(5, Math.floor((state.reach / state.config.target_distance) * 5) + 1)
          : 1,
    }
  },

  result(state: FlyerState): SimResult {
    return {
      score: computeScore(state),
      finished: state.finished,
      // Derived aggregates ONLY — this is exactly what `game_attempts.stats` may hold,
      // and a tick-resolution trace of a child at play is never one of them (§11).
      stats: {
        distance: Math.round(state.reach),
        collected: state.collected,
        missed: state.missed,
        wrong: state.wrong,
        points: state.points,
        enemies_downed: state.enemiesDowned,
        enemy_points: state.enemyPoints,
        slams: state.slams,
        shots_fired: state.shotsFired,
        beam_ticks: state.beamTicks,
        hits: state.hits,
        stalls: state.stalls,
        thermal_ticks: state.thermalTicks,
        storm_ticks: state.stormTicks,
        energy_spent: Math.round(state.energySpent),
        energy_left: Math.round(state.energy),
        commands: state.commands,
        combo_best: state.comboBest,
        ticks: state.tick + 1,
        reached_target: state.reachedTarget ? 1 : 0,
      },
    }
  },

  bots: {
    perfect(state: FlyerState, tick: number): GameInputEvent[] {
      return perfectBot(state, tick)
    },
    random(state: FlyerState, tick: number, rng: Rng): GameInputEvent[] {
      return randomBot(state, tick, rng)
    },
  },
}
