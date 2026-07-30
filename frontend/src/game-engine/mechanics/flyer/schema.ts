// Flyer — Zod config + content schemas (GAME_ENGINE.md §4 row `flyer`, §7, §13).
//
// DELIBERATELY 2.5D, NOT THE REPORT'S 6DoF (owner-approved, recorded in
// /GAME_ENGINE.md §13). Forward motion is a tick advance the player does not steer;
// what the player DOES steer is pitch (climb/dive → altitude and speed) and an
// optional lane-like yaw. Three reasons, restated here because a later reader of this
// file will not have the spec open:
//   1. INPUT. A touch screen has no throttle, no rudder and no six-axis stick, and
//      /CLAUDE.md §1.11 forbids a control scheme that only works on a desktop.
//   2. COGNITIVE LOAD. For a 6–12 year old a full flight model IS the game, and the
//      money concept the lesson taught becomes decoration.
//   3. DETERMINISTIC REPLAY BUDGET. §5 bans the transcendentals a full orientation
//      model wants; 6DoF would mean a large rotation surface in `core/mathd.ts` and a
//      much wider replay-divergence risk on the reward path.
// Full 6DoF stays possible later BEHIND THIS SAME MANIFEST — it would be optional
// `config` fields, not a new document shape. The flight fantasy is NOT dropped: the
// mount, the energy reserve, the thermals, the storms, the armament and the aerial
// enemies are all here.
//
// THE WHOLE POINT OF THIS FILE: v1's flying game hardcoded gravity, energy drain, the
// beam's damage and every enemy's stats inside its component, so a second flyer meant
// a second codebase. Here EVERY number that shapes difficulty, physics, the energy
// economy, armament, enemies, weather, upgrades or scoring is a manifest field, and
// `simulate.ts` / `components.tsx` read all of them from `config`. A new flyer is a
// new JSON file.
//
// No React and no DOM here on purpose: `backend/src/game-contract/` and
// `gamegen/src/contract/` carry this module verbatim next to `simulate.ts`.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  idString,
} from '@/game-engine/core/schemaBase'

// ---- Declared closed sets ------------------------------------------------------

/** Sprite SLOT ids this mechanic declares. `skin.sprites` may name only these — an
 *  undeclared key would silently never render, which is a content bug the schema
 *  should catch rather than a blank rectangle a child should discover. */
export const FLYER_SPRITE_SLOTS = [
  'mount',
  'mount_climb',
  'mount_dive',
  'collect_good',
  'collect_bad',
  'obstacle',
  'enemy',
  'enemy_boss',
  'projectile',
  'enemy_projectile',
  'beam',
  'thermal',
  'storm',
  'sky',
] as const
export type FlyerSpriteSlot = (typeof FLYER_SPRITE_SLOTS)[number]

/** Aerial AI patterns. `circle` orbits an anchor, `pursuit` closes on the mount's
 *  altitude, `retreat` holds a stand-off range and shoots from it, `boss` switches
 *  between the other three as its own hit points fall (see `phases`). */
export const FLYER_ENEMY_PATTERNS = ['circle', 'pursuit', 'retreat', 'boss'] as const
export type FlyerEnemyPattern = (typeof FLYER_ENEMY_PATTERNS)[number]

/** What a spawned element IS. `good` carries the concept the lesson taught, `bad` is
 *  the misconception, `thermal` is the income the energy economy runs on, `storm`
 *  is the weather pocket, `obstacle` is inert terrain and `enemy` instantiates one of
 *  the declared enemy types. */
export const FLYER_ELEMENT_ROLES = [
  'good',
  'bad',
  'obstacle',
  'enemy',
  'thermal',
  'storm',
] as const
export type FlyerElementRole = (typeof FLYER_ELEMENT_ROLES)[number]

/** Attack element, from the UPGRADES block. An enemy may declare a `weak_to`, and the
 *  match multiplies damage — progression is DATA the manifest applies, never a hidden
 *  state machine the child cannot see. */
export const FLYER_ATTACK_ELEMENTS = ['none', 'flame', 'frost', 'spark'] as const
export type FlyerAttackElement = (typeof FLYER_ATTACK_ELEMENTS)[number]

/** Which armament the rain douses inside a storm. */
export const FLYER_DOUSE_TARGETS = ['none', 'beam', 'projectile'] as const
export type FlyerDouseTarget = (typeof FLYER_DOUSE_TARGETS)[number]

// ---- World and the flying mount -------------------------------------------------

const worldSchema = z.object({
  width: z.number().int().min(200).max(2000),
  height: z.number().int().min(120).max(1200),
  /** The mount's x is FIXED — the sky scrolls past it (the 2.5D deviation, §13). */
  avatar_x: z.number().int().min(0).max(2000),
  mount_w: z.number().int().min(4).max(400),
  mount_h: z.number().int().min(4).max(400),
  /** Highest reachable altitude (smallest y). The mount clamps here, it never wraps. */
  ceiling_y: z.number().int().min(0).max(1200),
  /** The ground line. Touching it is a crash, which is what makes a stall cost. */
  floor_y: z.number().int().min(1).max(1200),
})

/** The mount itself: top speed, acceleration, turn rate and toughness. Its ENERGY bar
 *  lives in its own block below, because the energy economy is the core loop and
 *  deserves to be tuned as one thing. */
const mountSchema = z.object({
  top_speed: z.number().min(1).max(60),
  /** The world never stops scrolling: a mount at zero speed would freeze the run and
   *  make "do nothing" a strategy the tick budget could not end. */
  min_speed: z.number().min(0.1).max(60),
  start_speed: z.number().min(0.1).max(60),
  /** Acceleration from the engine, per 50ms tick. */
  thrust_per_tick: z.number().min(0).max(10),
  /** Fraction of current speed lost per tick. Terminal speed is thrust/drag. */
  drag_per_tick: z.number().min(0.001).max(0.9),
  /** Degrees of pitch the mount can change per tick. The UPGRADES block adds to it. */
  turn_rate_deg: z.number().min(0.5).max(90),
  /** Toughness. Reaching 0 costs a life (arcade) or is a stumble (cheer). */
  hull: z.number().int().min(1).max(50),
  /** Flat damage reduction per hit, before the upgrade bonus. */
  armour: z.number().min(0).max(50),
  /** Invulnerable ticks after taking a hit. Without it a single obstacle would bill
   *  the mount once per tick for as long as the boxes overlap. */
  hit_grace_ticks: z.number().int().min(0).max(200),
})

/**
 * The stall block. THE DOCUMENTED STALL CONDITION:
 *   the mount stalls when `speed < stall.speed` while its nose is above the glide band
 *   (pitch > 0). While stalled the pitch is forced to `stall.pitch_deg` (a nose-down
 *   recovery attitude), climb/dive commands are ignored for `control_lockout_ticks`,
 *   energy REGEN IS BLOCKED, and the mount sinks an extra `sink_per_tick`. It recovers
 *   the moment `speed >= stall.recover_speed`.
 * That is the whole punishment for over-spending altitude: not a game over, a sink and
 * a pause — legible to a 7-year-old and recoverable by diving, which is also how the
 * energy economy says to recover.
 */
const stallSchema = z.object({
  speed: z.number().min(0).max(60),
  recover_speed: z.number().min(0).max(60),
  pitch_deg: z.number().min(-89).max(0),
  sink_per_tick: z.number().min(0).max(60),
  control_lockout_ticks: z.number().int().min(0).max(100),
})
export type FlyerStall = z.infer<typeof stallSchema>

/**
 * The flight model, dialled from ARCADE to SIMULATION with `inertia`:
 *   inertia 0 → the nose returns to level at the full turn rate the moment the command
 *               expires (instant response, no drift);
 *   inertia 1 → the nose does not self-level at all, so every attitude must be flown
 *               back by hand (drift, and stalls that must be actively recovered).
 * Everything between is a blend, because `levelling turn rate = turn_rate * (1 - inertia)`.
 */
const flightSchema = z.object({
  climb_pitch_deg: z.number().min(1).max(80),
  dive_pitch_deg: z.number().min(-80).max(-1),
  /** How long one `climb`/`dive` tap holds the commanded attitude. */
  command_ticks: z.number().int().min(1).max(60),
  inertia: z.number().min(0).max(1),
  /** Altitude change per tick = lift_per_tick * speed * dsin(pitch). */
  lift_per_tick: z.number().min(0.01).max(4),
  /** Speed bled per tick at a 90° climb, scaled by dsin(pitch). */
  climb_speed_cost: z.number().min(0).max(20),
  /** Speed gained per tick at a 90° dive, scaled by dsin(-pitch). */
  dive_speed_gain: z.number().min(0).max(20),
  stall: stallSchema,
})

/**
 * THE ENERGY CURVE — the core loop, and the whole learning binding.
 *
 *   per tick:  pitch >  glide_band_deg  →  -climb_drain_per_tick      (spending)
 *              pitch < -glide_band_deg  →  +glide_regen_per_tick      (gliding = income)
 *              otherwise (level flight) →  +level_regen_per_tick      (a trickle)
 *              inside a thermal         →  +thermal_regen_per_tick    (the big income)
 *              beam held                →  -armament.beam.drain_per_tick
 *              stalled                  →  no regen at all
 *   per command: climb / dive / lane    →  -manoeuvre_cost            (sharp = expensive)
 *   per shot:    fire                   →  -armament.projectile.energy_cost
 *
 * Clamped into [0, capacity + upgrades.energy_capacity_bonus]. At zero energy a climb
 * command is REFUSED and the beam cuts out: the mount can still fly and still glide, so
 * running dry is a setback to recover from, never a dead end. Thermals are the income
 * and sharp manoeuvres are the expense — that is the sentence the mechanic teaches.
 */
const energySchema = z.object({
  capacity: z.number().min(1).max(1000),
  start: z.number().min(0).max(1000),
  /** Pitch magnitude that still counts as level flight, in degrees. */
  glide_band_deg: z.number().min(0).max(45),
  climb_drain_per_tick: z.number().min(0).max(50),
  glide_regen_per_tick: z.number().min(0).max(50),
  level_regen_per_tick: z.number().min(0).max(50),
  /** Charged once per climb/dive/lane COMMAND — the "sharp manoeuvre" expense. */
  manoeuvre_cost: z.number().min(0).max(50),
  thermal_regen_per_tick: z.number().min(0).max(50),
  /** HUD threshold for "you are running low". Display only; never gates the sim. */
  low_threshold: z.number().min(0).max(1000),
})

// ---- Armament --------------------------------------------------------------------

/** The continuous attack: damage over time for energy per tick. */
const beamSchema = z.object({
  enabled: z.boolean(),
  damage_per_tick: z.number().min(0).max(100),
  range_units: z.number().int().min(1).max(2000),
  /** Height of the beam box, centred on the mount. */
  width_units: z.number().int().min(1).max(1200),
  drain_per_tick: z.number().min(0).max(50),
})

/** The long-range attack: burst damage on a cooldown. */
const projectileSchema = z.object({
  enabled: z.boolean(),
  damage: z.number().min(0).max(200),
  speed_per_tick: z.number().min(1).max(200),
  cooldown_ticks: z.number().int().min(1).max(200),
  energy_cost: z.number().min(0).max(100),
  range_units: z.number().int().min(1).max(4000),
  w: z.number().int().min(1).max(200),
  h: z.number().int().min(1).max(200),
})

/**
 * The optional body-slam. It is NOT a sixth action: it is what a contact collision
 * MEANS when the mount is fast enough. Keeping it a consequence rather than a button
 * is what makes it "risk the collision" instead of a free melee — and it keeps the
 * action list at the five the spec fixes.
 */
const slamSchema = z.object({
  enabled: z.boolean(),
  damage: z.number().min(0).max(200),
  /** What the mount pays for ramming. Always > 0 in practice, or it is not a risk. */
  self_damage: z.number().min(0).max(50),
  min_speed: z.number().min(0).max(60),
  energy_cost: z.number().min(0).max(100),
})

const armamentSchema = z.object({
  beam: beamSchema,
  projectile: projectileSchema,
  slam: slamSchema,
})

// ---- Aerial enemies ---------------------------------------------------------------

const orbitSchema = z.object({
  radius_units: z.number().int().min(1).max(600),
  /** Per-ENTITY phase: the angle is `(tick - bornAt) * degrees_per_tick`, never a
   *  shared accumulator (that bug made N bombs tick N times too fast in v1). */
  degrees_per_tick: z.number().min(0.1).max(45),
  /** How fast the orbit's anchor drifts toward the mount, per tick. */
  drift_per_tick: z.number().min(0).max(60),
})

const pursuitSchema = z.object({
  /** Altitude closed per tick while chasing. */
  climb_per_tick: z.number().min(0).max(60),
  /** World-x closed per tick. */
  close_per_tick: z.number().min(0).max(60),
})

const retreatSchema = z.object({
  /** Stand-off distance the enemy tries to hold, in world units. */
  keep_distance_units: z.number().int().min(1).max(3000),
  /** How fast it backs off or closes to restore that distance. */
  adjust_per_tick: z.number().min(0).max(60),
})

const enemyFireSchema = z.object({
  enabled: z.boolean(),
  cooldown_ticks: z.number().int().min(1).max(400),
  damage: z.number().min(0).max(50),
  speed_per_tick: z.number().min(1).max(200),
  range_units: z.number().int().min(1).max(4000),
  w: z.number().int().min(1).max(200),
  h: z.number().int().min(1).max(200),
})

/** One boss phase. `from_hp_pct` is the hit-point percentage AT OR BELOW which the
 *  phase takes over, so the list reads top-down from 100. */
const bossPhaseSchema = z.object({
  from_hp_pct: z.number().int().min(0).max(100),
  pattern: z.enum(['circle', 'pursuit', 'retreat']),
  speed_multiplier: z.number().min(0.1).max(5),
  fire_cooldown_multiplier: z.number().min(0.1).max(5),
})
export type FlyerBossPhase = z.infer<typeof bossPhaseSchema>

/**
 * An enemy TYPE. "Fast and elusive", "slow and armoured" and "boss with phased
 * patterns" are not three code paths — they are three rows of this table.
 */
const enemyTypeSchema = z.object({
  id: idString,
  /** Optional catalog item that names/illustrates this enemy in the view. */
  item_id: idString.optional(),
  hp: z.number().min(1).max(2000),
  armour: z.number().min(0).max(100),
  /** Movement rates live in the PATTERN block this enemy declares (`orbit`, `pursuit`,
   *  `retreat`), scaled by the active boss phase's `speed_multiplier`. There is
   *  deliberately no separate "base speed" here: two knobs for one motion is how a
   *  manifest ends up with a number that quietly does nothing. */
  pattern: z.enum(FLYER_ENEMY_PATTERNS),
  /** Damage dealt to the mount on contact. */
  contact_damage: z.number().min(0).max(50),
  /** Score awarded when it goes down. */
  points: z.number().int().min(0).max(1000),
  w: z.number().int().min(1).max(600),
  h: z.number().int().min(1).max(600),
  weak_to: z.enum(FLYER_ATTACK_ELEMENTS).optional(),
  fire: enemyFireSchema,
  orbit: orbitSchema.optional(),
  pursuit: pursuitSchema.optional(),
  retreat: retreatSchema.optional(),
  /** `boss` only: strictly decreasing `from_hp_pct`, starting at 100. */
  phases: z.array(bossPhaseSchema).min(2).max(4).optional(),
  /** `boss` only: the run's headline target. Marks it for the view and the HUD. */
  boss: z.boolean().default(false),
})
export type FlyerEnemyType = z.infer<typeof enemyTypeSchema>

// ---- Environment, weather, lanes, upgrades ------------------------------------------

const environmentSchema = z.object({
  /** Rising thermal current: free altitude. Its ENERGY income is priced in the energy
   *  block (`energy.thermal_regen_per_tick`), where the rest of the economy lives —
   *  splitting it across two blocks is how one of the two ends up unread. */
  thermal: z.object({
    lift_per_tick: z.number().min(0).max(60),
  }),
  /** Storm cell: reduced visibility (a RENDER effect), turbulence, and a slow drain. */
  storm: z.object({
    /** 0..100. The view dims the canvas to this percentage inside the cell. */
    visibility_pct: z.number().int().min(0).max(100),
    turbulence_deg: z.number().min(0).max(45),
    drain_per_tick: z.number().min(0).max(50),
  }),
  obstacle: z.object({
    damage: z.number().min(0).max(50),
  }),
})

const weatherSchema = z.object({
  /** Baseline turbulence outside a storm, in degrees of pitch jitter. */
  turbulence_deg: z.number().min(0).max(45),
  /** Lateral push, in LANE units per tick (positive = toward the higher lane index).
   *  Ignored when lanes are disabled — a crosswind with nowhere to push is not a
   *  difficulty knob, it is an invisible one. */
  crosswind_per_tick: z.number().min(-1).max(1),
  rain: z.object({
    enabled: z.boolean(),
    /** Which armament the rain douses while the mount is inside a storm cell. */
    douses: z.enum(FLYER_DOUSE_TARGETS),
    /** 0..100 — how much of that armament still works in the rain. */
    effectiveness_pct: z.number().int().min(0).max(100),
  }),
})

/** The lane-like yaw. Disabled makes `lane` an inert but VALID action, so a log
 *  recorded by a client that emitted it replays instead of being rejected. */
const lanesSchema = z.object({
  enabled: z.boolean(),
  count: z.number().int().min(1).max(4),
  /** Visual/depth separation between lanes, in design units. */
  spacing_units: z.number().int().min(1).max(400),
  /** Ticks a full one-lane shift takes. The position INTERPOLATES, so a shift started
   *  too late still clips what was in the lane being left. */
  shift_ticks: z.number().int().min(1).max(40),
  /** How close (in lanes) counts as sharing a lane for collisions. */
  hit_band: z.number().min(0.05).max(1),
  /** What one yaw command costs the reserve. Separate from `energy.manoeuvre_cost`
   *  (which prices climbs and dives) so a manifest can make the yaw the cheap axis or
   *  the expensive one. */
  energy_cost: z.number().min(0).max(50),
})

/**
 * UPGRADES — applied from the manifest, never from a hidden progression system. A
 * generated document decides how strong the mount is; the player is never asked to
 * grind for it.
 */
const upgradesSchema = z.object({
  turn_speed_bonus_deg: z.number().min(0).max(45),
  energy_capacity_bonus: z.number().min(0).max(500),
  attack_element: z.enum(FLYER_ATTACK_ELEMENTS),
  /** Damage multiplier when `attack_element` matches an enemy's `weak_to`. */
  element_multiplier: z.number().min(1).max(5),
  armour_bonus: z.number().min(0).max(50),
  damage_bonus_pct: z.number().min(0).max(200),
})

// ---- Spawning -----------------------------------------------------------------------

const patternElementSchema = z.object({
  role: z.enum(FLYER_ELEMENT_ROLES),
  /** Offset from the pattern's origin, in world units. */
  dx: z.number().int().min(0).max(4000),
  /** Absolute top y in design units. */
  y: z.number().int().min(0).max(1200),
  w: z.number().int().min(1).max(900),
  h: z.number().int().min(1).max(900),
  /** Lane this element sits in. Ignored when lanes are disabled. */
  lane: z.number().int().min(0).max(3).default(0),
  /** `enemy` only: which declared enemy type to instantiate. */
  enemy_type: idString.optional(),
})
export type FlyerPatternElement = z.infer<typeof patternElementSchema>

const patternSchema = z.object({
  id: idString,
  /** Relative selection weight in the seeded draw. */
  weight: z.number().int().min(1).max(100),
  length_units: z.number().int().min(1).max(4000),
  /** Progressive difficulty: only eligible past this distance. */
  min_distance_units: z.number().int().min(0).max(200000).optional(),
  elements: z.array(patternElementSchema).min(1).max(10),
})
export type FlyerPattern = z.infer<typeof patternSchema>

const spawnSchema = z.object({
  lead_units: z.number().int().min(0).max(4000),
  min_gap_units: z.number().int().min(1).max(4000),
  max_gap_units: z.number().int().min(1).max(4000),
  patterns: z.array(patternSchema).min(1).max(12),
})

const comboSchema = z.object({
  step: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(10),
})

/**
 * Scoring weights are RELATIVE shares consumed by `weightedScore`. Four signals,
 * because a flyer that only paid for distance would teach "hold level and wait", one
 * that only paid for combat would teach "ignore the concept tokens", and one that
 * ignored energy would delete the lesson the mechanic exists to carry.
 */
const scoringWeightsSchema = z.object({
  distance_weight: z.number().min(0).max(10),
  collect_weight: z.number().min(0).max(10),
  combat_weight: z.number().min(0).max(10),
  /** Rewards ENDING the run without having burned the whole energy budget. */
  energy_weight: z.number().min(0).max(10),
  collect_points: z.number().int().min(1).max(100),
  collect_target: z.number().int().min(1).max(100000),
  combat_target: z.number().int().min(1).max(100000),
  /** Total energy a full-marks run may spend. */
  energy_budget: z.number().min(1).max(100000),
  wrong_penalty_pct: z.number().min(0).max(100),
  hit_penalty_pct: z.number().min(0).max(100),
  stall_penalty_pct: z.number().min(0).max(100),
  combo: comboSchema,
})

// ---- The config -----------------------------------------------------------------------

export const flyerConfigSchema = z
  .object({
    world: worldSchema,
    mount: mountSchema,
    flight: flightSchema,
    energy: energySchema,
    armament: armamentSchema,
    enemies: z.array(enemyTypeSchema).max(8).default([]),
    environment: environmentSchema,
    weather: weatherSchema,
    lanes: lanesSchema,
    upgrades: upgradesSchema,
    spawn: spawnSchema,
    scoring: scoringWeightsSchema,
    /** Distance that ends the run as a win. */
    target_distance: z.number().int().min(100).max(200000),
    /** Hard tick budget: the run ends here even if the target was never reached. */
    max_ticks: z.number().int().min(20).max(4000),
  })
  .superRefine((config, ctx) => {
    const { world, mount, flight, energy, lanes, spawn, scoring } = config

    if (world.ceiling_y >= world.floor_y) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'ceiling_y'],
        message: 'the ceiling must sit above the floor',
      })
    }
    if (world.floor_y > world.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'floor_y'],
        message: 'the floor must sit inside the world height',
      })
    }
    if (world.ceiling_y + world.mount_h > world.floor_y) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'mount_h'],
        message: 'the mount does not fit between the ceiling and the floor',
      })
    }

    if (mount.min_speed > mount.top_speed) {
      ctx.addIssue({
        code: 'custom',
        path: ['mount', 'min_speed'],
        message: 'min_speed must not exceed top_speed',
      })
    }
    if (mount.start_speed < mount.min_speed || mount.start_speed > mount.top_speed) {
      ctx.addIssue({
        code: 'custom',
        path: ['mount', 'start_speed'],
        message: 'start_speed must sit between min_speed and top_speed',
      })
    }

    const stall = flight.stall
    if (stall.recover_speed < stall.speed) {
      ctx.addIssue({
        code: 'custom',
        path: ['flight', 'stall', 'recover_speed'],
        message: 'recover_speed must be >= the stall speed, or a stall never ends',
      })
    }
    if (stall.recover_speed > mount.top_speed) {
      ctx.addIssue({
        code: 'custom',
        path: ['flight', 'stall', 'recover_speed'],
        message: 'recover_speed must be reachable: it may not exceed top_speed',
      })
    }
    if (energy.glide_band_deg >= flight.climb_pitch_deg) {
      ctx.addIssue({
        code: 'custom',
        path: ['energy', 'glide_band_deg'],
        message: 'the glide band must be narrower than the climb pitch, or climbing is free',
      })
    }
    if (energy.start > energy.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['energy', 'start'],
        message: 'the mount cannot start with more energy than it can hold',
      })
    }

    if (spawn.max_gap_units < spawn.min_gap_units) {
      ctx.addIssue({
        code: 'custom',
        path: ['spawn', 'max_gap_units'],
        message: 'max_gap_units must be >= min_gap_units',
      })
    }

    const enemyIds: string[] = []
    for (const enemy of config.enemies) enemyIds.push(enemy.id)

    for (const [enemyIndex, enemy] of config.enemies.entries()) {
      const path = ['enemies', enemyIndex]
      if (enemy.pattern === 'circle' && enemy.orbit === undefined) {
        ctx.addIssue({ code: 'custom', path, message: 'a circling enemy needs an orbit block' })
      }
      if (enemy.pattern === 'pursuit' && enemy.pursuit === undefined) {
        ctx.addIssue({ code: 'custom', path, message: 'a pursuing enemy needs a pursuit block' })
      }
      if (enemy.pattern === 'retreat' && enemy.retreat === undefined) {
        ctx.addIssue({ code: 'custom', path, message: 'a retreating enemy needs a retreat block' })
      }
      if (enemy.pattern === 'boss') {
        const phases = enemy.phases
        if (phases === undefined) {
          ctx.addIssue({ code: 'custom', path, message: 'a boss needs a phase list' })
        } else {
          const first = phases[0]
          if (first === undefined || first.from_hp_pct !== 100) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'phases', 0, 'from_hp_pct'],
              message: 'the first boss phase must start at 100% hit points',
            })
          }
          for (let i = 1; i < phases.length; i += 1) {
            const previous = phases[i - 1]
            const current = phases[i]
            if (previous === undefined || current === undefined) continue
            if (current.from_hp_pct >= previous.from_hp_pct) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'phases', i, 'from_hp_pct'],
                message: 'boss phases must be listed in strictly decreasing hit-point order',
              })
            }
          }
          // Every phase names one of the three real patterns, so a boss can only ever
          // resolve to a motion the simulator implements.
          for (const [phaseIndex, phase] of phases.entries()) {
            if (phase.pattern === 'circle' && enemy.orbit === undefined) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'phases', phaseIndex],
                message: 'a circling phase needs the enemy to declare an orbit block',
              })
            }
            if (phase.pattern === 'pursuit' && enemy.pursuit === undefined) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'phases', phaseIndex],
                message: 'a pursuing phase needs the enemy to declare a pursuit block',
              })
            }
            if (phase.pattern === 'retreat' && enemy.retreat === undefined) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'phases', phaseIndex],
                message: 'a retreating phase needs the enemy to declare a retreat block',
              })
            }
          }
        }
      }
    }

    for (const [patternIndex, pattern] of spawn.patterns.entries()) {
      for (const [elementIndex, element] of pattern.elements.entries()) {
        const path = ['spawn', 'patterns', patternIndex, 'elements', elementIndex]
        if (element.y + element.h > world.height) {
          ctx.addIssue({ code: 'custom', path, message: 'element falls outside the world height' })
        }
        if (lanes.enabled && element.lane >= lanes.count) {
          ctx.addIssue({ code: 'custom', path, message: 'element sits in an undeclared lane' })
        }
        if (element.role === 'enemy') {
          if (element.enemy_type === undefined) {
            ctx.addIssue({ code: 'custom', path, message: 'an enemy element needs an enemy_type' })
          } else if (!enemyIds.includes(element.enemy_type)) {
            ctx.addIssue({ code: 'custom', path, message: 'unknown enemy_type' })
          }
        }
      }
    }

    if (
      scoring.distance_weight +
        scoring.collect_weight +
        scoring.combat_weight +
        scoring.energy_weight <=
      0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring'],
        message: 'at least one scoring weight must be positive',
      })
    }
  })

export type FlyerConfig = z.infer<typeof flyerConfigSchema>

// ---- The content ------------------------------------------------------------------

/** Which catalog items the sky carries, and in which meaning. This is what makes a
 *  flyer a LEARNING game: the tokens in the air are the concept the lesson taught, not
 *  generic rings. */
const flyerRolesSchema = z.object({
  /** Items worth points — what the child should fly through. */
  collect: z.array(idString).min(1).max(20),
  /** Items the child should leave alone. Every one of them must explain WHY. */
  avoid: z.array(idString).max(20),
})

export const flyerContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(1).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    roles: flyerRolesSchema,
  })
  .superRefine((content, ctx) => {
    const known: string[] = []
    for (const item of content.items) known.push(item.id)

    for (const [index, id] of content.roles.collect.entries()) {
      if (!known.includes(id)) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'collect', index], message: 'unknown item id' })
      }
      if (content.roles.avoid.includes(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'collect', index],
          message: 'an item cannot be both collectible and avoidable',
        })
      }
    }

    for (const [index, id] of content.roles.avoid.entries()) {
      const item = content.items.find((candidate) => candidate.id === id)
      if (item === undefined) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'avoid', index], message: 'unknown item id' })
        continue
      }
      // The misconception gate (GAME_ENGINE.md §9 `gate`), enforced at the schema so a
      // trap can never ship without its teaching reason: a child who flies around the
      // wrong token deserves to be told why it was wrong, not merely denied the points.
      if (item.misconception_md === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'avoid', index],
          message: 'an avoidable item must carry misconception_md',
        })
      }
    }
  })

export type FlyerContent = z.infer<typeof flyerContentSchema>
