// `launcher` — the config + content contract (GAME_ENGINE.md §4 row `launcher`, §7).
//
// THE POINT OF THIS FILE: v1's aiming game baked gravity, the launch-speed range, the
// angle limits, the target layout and the point values into the component, so a second
// launcher meant a second codebase and re-skinning was impossible. Here EVERY number
// that shapes physics, difficulty, economy or scoring is a manifest field — gravity,
// wind, drag, friction, restitution, projectiles per round, the leftover bonus, the
// per-kind projectile tuning, the target layouts and their motion, obstacle materials
// and the scoring weights — and `simulate.ts` / `components.tsx` read all of them from
// `config`. A new launcher game is a new JSON document, never new code.
//
// Zod only, no React and no DOM: `backend/src/game-contract/` and `gamegen/src/contract/`
// carry this module verbatim next to `simulate.ts` for the server-side replay.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  iconName,
  idString,
} from '../../core/schemaBase.js'

// ---- Declared closed sets -------------------------------------------------------

/** Sprite SLOT ids this mechanic declares. `skin.sprites` may name only these — an
 *  undeclared key would silently never render, which is a content bug the schema
 *  should catch rather than a blank rectangle a child should discover. */
export const LAUNCHER_SPRITE_SLOTS = [
  'sky',
  'ground',
  'launcher',
  'launcher_arm',
  'projectile',
  'projectile_heavy',
  'projectile_light',
  'projectile_guided',
  'projectile_explosive',
  'target_correct',
  'target_incorrect',
  'obstacle',
  'obstacle_breakable',
] as const satisfies readonly string[]
export type LauncherSpriteSlot = (typeof LAUNCHER_SPRITE_SLOTS)[number]

/** Projectile families from the report. `heavy` drops fast, `light` floats, `guided`
 *  accepts a small in-flight correction, `explosive` detonates on impact. The kind is
 *  a LABEL over the numeric tuning below — nothing in the simulator branches on it
 *  except the two blocks the schema requires it to declare. */
export const LAUNCHER_PROJECTILE_KINDS = [
  'standard',
  'heavy',
  'light',
  'guided',
  'explosive',
] as const
export type LauncherProjectileKind = (typeof LAUNCHER_PROJECTILE_KINDS)[number]

/** A target either carries the sound financial choice or a misconception. That is the
 *  whole learning binding: aiming at the right one IS the answer. */
export const LAUNCHER_TARGET_ROLES = ['correct', 'incorrect'] as const
export type LauncherTargetRole = (typeof LAUNCHER_TARGET_ROLES)[number]

/** Axis-aligned boxes and circles only (§13): the collision solver stays exact and
 *  bit-identical, which a general polygon solver would not. */
export const LAUNCHER_SHAPES = ['box', 'circle'] as const
export type LauncherShape = (typeof LAUNCHER_SHAPES)[number]

/** `static` never moves; `moving` oscillates on a per-entity triangle wave; `erratic`
 *  jumps to a new seeded offset every `period_ticks` — predictable in AMPLITUDE but not
 *  in direction, which is the report's "erratic movement" without unfair randomness. */
export const LAUNCHER_TARGET_MOTIONS = ['static', 'moving', 'erratic'] as const
export type LauncherTargetMotion = (typeof LAUNCHER_TARGET_MOTIONS)[number]

/** Obstacle materials from the report. `solid` stops a projectile dead, `deflect`
 *  bounces it (restitution + tangential friction), `absorb` swallows it with no bounce,
 *  `breakable` takes damage and can be destroyed — and, when `chain` is set, passes an
 *  explosion on. */
export const LAUNCHER_MATERIALS = ['solid', 'deflect', 'absorb', 'breakable'] as const
export type LauncherMaterial = (typeof LAUNCHER_MATERIALS)[number]

/** The launcher's own limited movement. `none` is a fixed emplacement. */
export const LAUNCHER_MOVE_AXES = ['none', 'x', 'y'] as const
export type LauncherMoveAxis = (typeof LAUNCHER_MOVE_AXES)[number]

/** Where a splitting projectile breaks apart. */
export const LAUNCHER_SPLIT_TRIGGERS = ['apex', 'impact'] as const
export type LauncherSplitTrigger = (typeof LAUNCHER_SPLIT_TRIGGERS)[number]

// ---- World & launcher -----------------------------------------------------------

/** DESIGN coordinates (core/stage.ts maps them onto the real viewport). y grows DOWN,
 *  which is the screen convention the view already uses; the simulator therefore
 *  subtracts for "up" exactly once, at launch. */
const worldSchema = z.object({
  width: z.number().int().min(320).max(2000),
  height: z.number().int().min(240).max(1200),
  /** The floor line. A projectile bounces or dies here per the environment. */
  ground_y: z.number().int().min(40).max(1200),
})

/** Limited-axis emplacement movement — the report's "may rotate or move on a limited
 *  axis". `none` disables the `move` action without making it an unknown action, so a
 *  log recorded by a client that emitted it still replays. */
const moveSchema = z.object({
  axis: z.enum(LAUNCHER_MOVE_AXES),
  min: z.number().int().min(0).max(2000),
  max: z.number().int().min(0).max(2000),
  /** Design units per `move` event. */
  step: z.number().int().min(1).max(200),
})

const launcherSchema = z.object({
  x: z.number().int().min(0).max(2000),
  y: z.number().int().min(0).max(1200),
  w: z.number().int().min(8).max(400),
  h: z.number().int().min(8).max(400),

  /** Degrees above the horizon. The aim is QUANTIZED to this grid by the simulator, so
   *  a pull-back gesture and an angle wheel produce the same discrete shots and the
   *  same replay. */
  min_angle: z.number().int().min(0).max(89),
  max_angle: z.number().int().min(1).max(90),
  angle_step: z.number().int().min(1).max(30),
  start_angle: z.number().int().min(0).max(90),

  /** Power is a 0..100 percentage of the speed band below — kid-legible, and the same
   *  number a power bar renders. */
  min_power: z.number().int().min(0).max(100),
  max_power: z.number().int().min(1).max(100),
  power_step: z.number().int().min(1).max(50),
  start_power: z.number().int().min(0).max(100),

  /** Launch speed in design units per 50ms tick at power 0 and at power 100. */
  speed_min: z.number().min(1).max(200),
  speed_max: z.number().min(1).max(200),

  /** How far (design units) a slingshot pull-back must travel for 100% power. VIEW
   *  tuning, but it lives here for the same reason everything else does: a re-skin
   *  must never require a code change. */
  pull_max_units: z.number().int().min(20).max(1200),

  move: moveSchema,
  /** Ticks after a shot resolves before the next one may be fired. */
  cooldown_ticks: z.number().int().min(0).max(200),
})

// ---- Physics --------------------------------------------------------------------

/**
 * The environment. Integration is SEMI-IMPLICIT EULER at the fixed 50ms tick
 * (velocity first, then position from the NEW velocity) — see `simulate.ts`.
 *
 * Rates are per-mille integers rather than floats so a manifest can never carry a
 * value that reads differently after a JSON round-trip.
 */
const physicsSchema = z.object({
  /** Downward acceleration, design units per tick². */
  gravity: z.number().min(0).max(20),
  /** Constant horizontal acceleration (units/tick²); negative blows left. */
  wind_x: z.number().min(-10).max(10),
  /** Peak deviation of the gust triangle wave around `wind_x`. */
  wind_gust: z.number().min(0).max(10),
  /** Full gust period in TICKS. */
  wind_period_ticks: z.number().int().min(2).max(600),
  /** Air resistance: the fraction of velocity shed each tick, in per-mille. */
  drag_permille: z.number().int().min(0).max(300),
  /** Ground bounce: how much vertical speed survives (per-mille). 0 = it sticks. */
  ground_restitution_permille: z.number().int().min(0).max(1000),
  /** Ground grip: how much horizontal speed is lost per bounce (per-mille). A slippery
   *  floor is 0, a sticky one approaches 1000. */
  ground_friction_permille: z.number().int().min(0).max(1000),
  /** Hard per-projectile flight budget — a projectile that never resolves would stall
   *  the round forever. */
  max_flight_ticks: z.number().int().min(10).max(600),
})
export type LauncherPhysics = z.infer<typeof physicsSchema>

/** Per-round environment overrides: altered gravity (including near-zero), a different
 *  wind, a slippery or sticky floor. Every field optional — an absent one inherits. */
const environmentSchema = z.object({
  gravity: z.number().min(0).max(20).optional(),
  wind_x: z.number().min(-10).max(10).optional(),
  wind_gust: z.number().min(0).max(10).optional(),
  wind_period_ticks: z.number().int().min(2).max(600).optional(),
  drag_permille: z.number().int().min(0).max(300).optional(),
  ground_restitution_permille: z.number().int().min(0).max(1000).optional(),
  ground_friction_permille: z.number().int().min(0).max(1000).optional(),
})
export type LauncherEnvironmentOverride = z.infer<typeof environmentSchema>

// ---- Projectiles ------------------------------------------------------------------

/** Detonation on impact. `chain_depth` caps how far a blast may travel through
 *  `chain` obstacles — an uncapped chain is an unbounded loop on the reward path. */
const explosiveSchema = z.object({
  radius: z.number().int().min(4).max(600),
  damage: z.number().int().min(1).max(20),
  chain_depth: z.number().int().min(0).max(4),
})

/** Break-apart. Fragments never split again (the simulator clears their split block),
 *  so `count` is a fan-out of exactly one generation. */
const splitSchema = z.object({
  count: z.number().int().min(2).max(4),
  spread_deg: z.number().int().min(1).max(80),
  trigger: z.enum(LAUNCHER_SPLIT_TRIGGERS),
  /** Fragment speed as a per-mille of the parent's speed at the split. */
  speed_permille: z.number().int().min(100).max(1500),
})

/** In-flight correction. Deliberately SMALL and time-boxed: a guided projectile that
 *  could be steered all the way to the target would delete the aiming skill the
 *  mechanic exists to teach. */
const guidedSchema = z.object({
  /** Horizontal acceleration added per `nudge`, units/tick². */
  steer_accel: z.number().min(0).max(6),
  /** Ticks after launch during which steering is accepted. */
  max_ticks: z.number().int().min(1).max(200),
})

const projectileSchema = z.object({
  id: idString,
  kind: z.enum(LAUNCHER_PROJECTILE_KINDS),
  /** Optional reference to a `content.items` entry so the ammo itself can carry the
   *  concept ("a 10-peso coin"). Optional because the two-layer document parse
   *  validates config and content separately — the view and the simulator both fall
   *  back to the kind's own sprite slot and icon when it does not resolve. */
  item_ref: idString.optional(),
  image_slot: idString.optional(),
  icon: iconName.optional(),

  radius: z.number().int().min(2).max(80),
  /** Mass proxy: > 1000 falls faster (heavy), < 1000 floats (light). */
  gravity_scale_permille: z.number().int().min(100).max(4000),
  /** Launch-speed multiplier: a heavy shot leaves the launcher slower. */
  speed_scale_permille: z.number().int().min(200).max(2000),
  damage: z.number().int().min(1).max(20),

  /** Bounces off the ground and off `deflect` obstacles before the shot dies. */
  bounces: z.number().int().min(0).max(6),
  restitution_permille: z.number().int().min(0).max(1000),
  friction_permille: z.number().int().min(0).max(1000),

  explosive: explosiveSchema.optional(),
  split: splitSchema.optional(),
  guided: guidedSchema.optional(),
})
export type LauncherProjectileConfig = z.infer<typeof projectileSchema>

// ---- Targets, obstacles, rounds -----------------------------------------------------

const targetSchema = z.object({
  id: idString,
  role: z.enum(LAUNCHER_TARGET_ROLES),
  /** Which catalog item this target represents. When absent the simulator draws one
   *  from `content.roles` on the seeded tape, so a layout can be authored once and
   *  re-dressed per seed. */
  item_ref: idString.optional(),
  shape: z.enum(LAUNCHER_SHAPES),
  /** Top-left in design units (a circle uses `w` as its diameter, and `h` must match). */
  x: z.number().int().min(0).max(2000),
  y: z.number().int().min(0).max(1200),
  w: z.number().int().min(6).max(600),
  h: z.number().int().min(6).max(600),
  hp: z.number().int().min(1).max(10),
  /** Relative worth of destroying this one, on top of the flat hit points. */
  value: z.number().int().min(1).max(100),

  motion: z.enum(LAUNCHER_TARGET_MOTIONS),
  axis: z.enum(['x', 'y']).optional(),
  amplitude: z.number().int().min(1).max(600).optional(),
  /** `moving`: full oscillation period. `erratic`: how long each seeded offset holds.
   *  A PER-ENTITY timer in both cases — never one shared accumulator. */
  period_ticks: z.number().int().min(2).max(600).optional(),

  image_slot: idString.optional(),
  icon: iconName.optional(),
})
export type LauncherTargetConfig = z.infer<typeof targetSchema>

const obstacleSchema = z.object({
  id: idString,
  x: z.number().int().min(0).max(2000),
  y: z.number().int().min(0).max(1200),
  w: z.number().int().min(4).max(2000),
  h: z.number().int().min(4).max(1200),
  material: z.enum(LAUNCHER_MATERIALS),
  /** Required for `breakable`; ignored otherwise. */
  hp: z.number().int().min(1).max(20).optional(),
  restitution_permille: z.number().int().min(0).max(1000),
  friction_permille: z.number().int().min(0).max(1000),
  /** A destroyed `chain` obstacle passes an explosion on (mechanism activation). */
  chain: z.boolean(),
  image_slot: idString.optional(),
  icon: iconName.optional(),
})
export type LauncherObstacleConfig = z.infer<typeof obstacleSchema>

const roundSchema = z.object({
  id: idString,
  /** Projectiles for this round. Unused ones feed the leftover bonus. */
  shots: z.number().int().min(1).max(20),
  /** Round tick budget — the round ends here even with ammo left. */
  max_ticks: z.number().int().min(20).max(3000),
  /** Speed ramp: every target period is divided by this per-mille, so 2000 makes the
   *  same layout move twice as fast in a later round. */
  target_speed_permille: z.number().int().min(200).max(4000),
  environment: environmentSchema.optional(),
  targets: z.array(targetSchema).min(1).max(12),
  obstacles: z.array(obstacleSchema).max(10),
})
export type LauncherRound = z.infer<typeof roundSchema>

// ---- Aim assistance ------------------------------------------------------------------

/**
 * The predictive dotted line. TIER-GATED BY THE MANIFEST (GAME_ENGINE.md §4): tier 1
 * ships it on, tier 2 may, tier 3 turns it off. It is a pure re-run of the same
 * integrator, so it never tells a child anything the physics would not — and because
 * the document's `adaptive.assist_toggleable` is always true, the view lets the player
 * switch it off even when the manifest offers it.
 */
const aimSchema = z.object({
  trajectory_preview: z.object({
    enabled: z.boolean(),
    /** Dots drawn along the predicted arc. */
    dots: z.number().int().min(0).max(40),
    /** Ticks between two dots. */
    tick_step: z.number().int().min(1).max(20),
  }),
})

// ---- Scoring weights -------------------------------------------------------------------

const comboSchema = z.object({
  step: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(10),
})

const scoringWeightsSchema = z.object({
  /** RELATIVE shares consumed by `weightedScore`. Accuracy alone would teach "spam
   *  until something lands"; leftovers alone would teach "do not shoot". */
  accuracy_weight: z.number().min(0).max(10),
  points_weight: z.number().min(0).max(10),
  leftover_weight: z.number().min(0).max(10),
  bounce_weight: z.number().min(0).max(10),

  /** Flat points for landing a hit on a correct target, before the combo multiplier. */
  hit_points: z.number().int().min(1).max(100),
  /** The points total that counts as a full points score. */
  points_target: z.number().int().min(1).max(100000),
  /** Bounces-before-a-correct-hit that count as a full bounce score. */
  bounce_target: z.number().int().min(1).max(50),

  /** Points of the 0..100 scale a hit on a misconception target costs. */
  wrong_penalty_pct: z.number().min(0).max(100),
  /** Points a shot that hits nothing at all costs. */
  miss_penalty_pct: z.number().min(0).max(100),
  /** Arcade mode only: does aiming at a misconception cost a life? */
  lives_cost_on_wrong: z.boolean(),
  combo: comboSchema,
})

// ---- The config -------------------------------------------------------------------------

export const launcherConfigSchema = z
  .object({
    world: worldSchema,
    launcher: launcherSchema,
    physics: physicsSchema,
    projectiles: z.array(projectileSchema).min(1).max(5),
    aim: aimSchema,
    rounds: z.array(roundSchema).min(1).max(6),
    scoring: scoringWeightsSchema,
    /** Hard tick budget for the whole run. */
    max_ticks: z.number().int().min(20).max(6000),
  })
  .superRefine((config, ctx) => {
    const { world, launcher } = config

    if (world.ground_y > world.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'ground_y'],
        message: 'the ground line must sit inside the world height',
      })
    }

    // ---- the aim envelope ----
    if (launcher.max_angle <= launcher.min_angle) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'max_angle'],
        message: 'max_angle must be greater than min_angle',
      })
    }
    if (launcher.start_angle < launcher.min_angle || launcher.start_angle > launcher.max_angle) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'start_angle'],
        message: 'start_angle must sit inside the angle range',
      })
    }
    if (launcher.max_power <= launcher.min_power) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'max_power'],
        message: 'max_power must be greater than min_power',
      })
    }
    if (launcher.start_power < launcher.min_power || launcher.start_power > launcher.max_power) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'start_power'],
        message: 'start_power must sit inside the power range',
      })
    }
    if (launcher.speed_max <= launcher.speed_min) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'speed_max'],
        message: 'speed_max must be greater than speed_min, or power changes nothing',
      })
    }
    if (launcher.x + launcher.w > world.width || launcher.y + launcher.h > world.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['launcher', 'x'],
        message: 'the launcher falls outside the world',
      })
    }

    // ---- limited-axis movement ----
    const move = launcher.move
    if (move.axis !== 'none') {
      if (move.max <= move.min) {
        ctx.addIssue({
          code: 'custom',
          path: ['launcher', 'move', 'max'],
          message: 'a movement axis needs max > min',
        })
      }
      const start = move.axis === 'x' ? launcher.x : launcher.y
      if (start < move.min || start > move.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['launcher', 'move'],
          message: 'the launcher must start inside its own movement range',
        })
      }
    }

    // ---- projectiles ----
    const projectileIds: string[] = []
    for (const [index, projectile] of config.projectiles.entries()) {
      if (projectileIds.includes(projectile.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['projectiles', index, 'id'],
          message: 'duplicate projectile id',
        })
      }
      projectileIds.push(projectile.id)
      // A kind that does not carry its own block would be a lie in the HUD: the child
      // would be handed "explosive" ammo that behaves exactly like a plain one.
      if (projectile.kind === 'explosive' && projectile.explosive === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['projectiles', index, 'explosive'],
          message: 'an explosive projectile must declare its blast',
        })
      }
      if (projectile.kind === 'guided' && projectile.guided === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['projectiles', index, 'guided'],
          message: 'a guided projectile must declare its steering',
        })
      }
    }

    // ---- rounds ----
    const roundIds: string[] = []
    for (const [roundIndex, round] of config.rounds.entries()) {
      if (roundIds.includes(round.id)) {
        ctx.addIssue({ code: 'custom', path: ['rounds', roundIndex, 'id'], message: 'duplicate round id' })
      }
      roundIds.push(round.id)

      const targetIds: string[] = []
      let correctTargets = 0
      for (const [targetIndex, target] of round.targets.entries()) {
        const path = ['rounds', roundIndex, 'targets', targetIndex]
        if (targetIds.includes(target.id)) {
          ctx.addIssue({ code: 'custom', path, message: 'duplicate target id in this round' })
        }
        targetIds.push(target.id)
        if (target.role === 'correct') correctTargets += 1

        if (target.shape === 'circle' && target.h !== target.w) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'a circular target uses w as its diameter, so h must equal w',
          })
        }
        if (target.motion !== 'static') {
          if (
            target.axis === undefined ||
            target.amplitude === undefined ||
            target.period_ticks === undefined
          ) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: 'a moving or erratic target needs axis, amplitude and period_ticks',
            })
          }
        }
        // The oscillation is checked at its extremes, not at rest: a target that swings
        // out of the world is unhittable for part of every cycle.
        const swingX = target.axis === 'x' ? (target.amplitude ?? 0) : 0
        const swingY = target.axis === 'y' ? (target.amplitude ?? 0) : 0
        if (
          target.x - swingX < 0 ||
          target.x + target.w + swingX > world.width ||
          target.y - swingY < 0 ||
          target.y + target.h + swingY > world.height
        ) {
          ctx.addIssue({ code: 'custom', path, message: 'the target leaves the world as it moves' })
        }
      }

      if (correctTargets === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['rounds', roundIndex, 'targets'],
          message: 'a round with no correct target teaches nothing and cannot be cleared',
        })
      }
      // The cheapest possible unwinnability check: one shot can destroy at most one
      // target without a blast, so fewer shots than correct targets is unclearable.
      if (round.shots < correctTargets) {
        ctx.addIssue({
          code: 'custom',
          path: ['rounds', roundIndex, 'shots'],
          message: 'fewer projectiles than correct targets makes the round unclearable',
        })
      }

      const obstacleIds: string[] = []
      for (const [obstacleIndex, obstacle] of round.obstacles.entries()) {
        const path = ['rounds', roundIndex, 'obstacles', obstacleIndex]
        if (obstacleIds.includes(obstacle.id)) {
          ctx.addIssue({ code: 'custom', path, message: 'duplicate obstacle id in this round' })
        }
        obstacleIds.push(obstacle.id)
        if (obstacle.material === 'breakable' && obstacle.hp === undefined) {
          ctx.addIssue({ code: 'custom', path, message: 'a breakable obstacle needs hp' })
        }
        if (obstacle.x + obstacle.w > world.width || obstacle.y + obstacle.h > world.height) {
          ctx.addIssue({ code: 'custom', path, message: 'the obstacle falls outside the world' })
        }
      }
    }

    const weights = config.scoring
    if (
      weights.accuracy_weight +
        weights.points_weight +
        weights.leftover_weight +
        weights.bounce_weight <=
      0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring'],
        message: 'at least one scoring weight must be positive',
      })
    }
  })

export type LauncherConfig = z.infer<typeof launcherConfigSchema>

// ---- The content ------------------------------------------------------------------------

/**
 * Which catalog items are the sound choice and which are the misconceptions. This is
 * what makes a launcher a LEARNING game rather than target practice: the thing a child
 * aims at IS the answer, and every wrong target has to explain itself.
 */
const launcherRolesSchema = z.object({
  correct: z.array(idString).min(1).max(20),
  incorrect: z.array(idString).max(20),
})

export const launcherContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(1).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    roles: launcherRolesSchema,
  })
  .superRefine((content, ctx) => {
    const known: string[] = []
    for (const item of content.items) known.push(item.id)

    for (const [index, id] of content.roles.correct.entries()) {
      if (!known.includes(id)) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'correct', index], message: 'unknown item id' })
      }
      if (content.roles.incorrect.includes(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'correct', index],
          message: 'an item cannot be both the sound choice and the misconception',
        })
      }
    }

    for (const [index, id] of content.roles.incorrect.entries()) {
      const item = content.items.find((candidate) => candidate.id === id)
      if (item === undefined) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'incorrect', index], message: 'unknown item id' })
        continue
      }
      // The misconception gate (GAME_ENGINE.md §9 `gate`), enforced in the schema so a
      // trap can never ship without its teaching reason: a child who avoids the wrong
      // target deserves to be told why it was wrong, not merely denied the points.
      if (item.misconception_md === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'incorrect', index],
          message: 'a misconception target must carry misconception_md',
        })
      }
    }
  })

export type LauncherContent = z.infer<typeof launcherContentSchema>
