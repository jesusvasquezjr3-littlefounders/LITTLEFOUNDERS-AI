// Runner — Zod config + content schemas (GAME_ENGINE.md §4 row `runner`, §7).
//
// THE WHOLE POINT OF THIS FILE: v1's endless runners hardcoded gravity, jump impulse,
// scroll speed, obstacle spacing and the point values inside the game component, so a
// second runner meant a second codebase. Here EVERY number that shapes difficulty,
// physics, spacing, economy or scoring is a manifest field, and `simulate.ts` /
// `components.tsx` read all of them from `config`. A new runner is a new JSON file.
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
} from '../../core/schemaBase.js'

// ---- Declared closed sets ------------------------------------------------------

/** Sprite SLOT ids this mechanic declares. `skin.sprites` may name only these — an
 *  undeclared key would silently never render, which is a content bug the schema
 *  should catch rather than a blank rectangle a child should discover. */
export const RUNNER_SPRITE_SLOTS = [
  'avatar',
  'avatar_action',
  'obstacle',
  'obstacle_sudden',
  'obstacle_moving',
  'collect_good',
  'collect_bad',
  'ground',
  'sky',
] as const
export type RunnerSpriteSlot = (typeof RUNNER_SPRITE_SLOTS)[number]

/** The single binary action's meaning. `jump`/`contextual` integrate a vertical
 *  offset; `lane`/`flip` step between discrete tracks. Timing is the skill in all four. */
export const RUNNER_ACTION_MODELS = ['jump', 'lane', 'flip', 'contextual'] as const
export type RunnerActionModel = (typeof RUNNER_ACTION_MODELS)[number]

/** Surfaces the CONTEXTUAL action reads: the same button means ground→jump,
 *  water→dive, air→glide. Closed, because each one needs its own motion block. */
export const RUNNER_SURFACES = ['ground', 'water', 'air'] as const
export type RunnerSurface = (typeof RUNNER_SURFACES)[number]

/** `static` never changes; `moving` oscillates on a per-entity triangle wave;
 *  `sudden` is inert (and invisible) until it is within `reveal_units` of the avatar. */
export const RUNNER_VARIANTS = ['static', 'sudden', 'moving'] as const
export type RunnerVariant = (typeof RUNNER_VARIANTS)[number]

/** `obstacle` is lethal, `good` is a concept token worth points, `bad` is the
 *  misconception the lesson taught the child to skip. */
export const RUNNER_ROLES = ['obstacle', 'good', 'bad'] as const
export type RunnerRole = (typeof RUNNER_ROLES)[number]

/** What losing a life costs: `restart` sends the run back to zero, `checkpoint`
 *  back to the last multiple of `checkpoint_every_units`. */
export const RUNNER_CHECKPOINT_POLICIES = ['restart', 'checkpoint'] as const
export type RunnerCheckpointPolicy = (typeof RUNNER_CHECKPOINT_POLICIES)[number]

// ---- Physics -------------------------------------------------------------------

/** Every physics number is an INTEGER so the whole vertical integration stays exact
 *  integer arithmetic — the strongest possible form of the §5 determinism rule, since
 *  there is then no rounding for two engines to disagree about. */
const verticalMotionSchema = z.object({
  /** +1 = the action lifts the avatar off the line (a jump); -1 = it pushes it below
   *  the line (a dive) and the restoring force points back up (buoyancy). */
  dir: z.union([z.literal(1), z.literal(-1)]),
  impulse: z.number().int().min(1).max(200),
  gravity: z.number().int().min(1).max(60),
  /** 1 = single jump, 2 = double jump, 3 = triple. */
  max_jumps: z.number().int().min(1).max(3),
})
export type RunnerVerticalMotion = z.infer<typeof verticalMotionSchema>

/** Hold-to-glide / hold-to-charge. `enabled: false` makes `hold_start`/`hold_end`
 *  inert — the events stay VALID actions so a replay of a log recorded by a client
 *  that sent them is never rejected, they simply do nothing. */
const holdSchema = z.object({
  enabled: z.boolean(),
  /** Gravity applied instead of the motion's own while gliding (0 = float). */
  glide_gravity: z.number().int().min(0).max(60),
  max_hold_ticks: z.number().int().min(0).max(200),
})
export type RunnerHold = z.infer<typeof holdSchema>

const surfaceStopSchema = z.object({
  from_units: z.number().int().min(0),
  surface: z.enum(RUNNER_SURFACES),
})

const laneBlockSchema = z.object({
  count: z.number().int().min(2).max(4),
  /** Top y (design units) of lane 0. */
  top_y: z.number().int().min(0).max(1200),
  gap: z.number().int().min(1).max(600),
  /** Ticks the avatar spends between two lanes. During the transition its hit box is
   *  INTERPOLATED, not teleported, so a switch started too late is still a collision —
   *  that is what makes the timing, and not the decision, the skill. */
  transition_ticks: z.number().int().min(1).max(40),
})

const flipBlockSchema = z.object({
  floor_y: z.number().int().min(0).max(1200),
  ceiling_y: z.number().int().min(0).max(1200),
  transition_ticks: z.number().int().min(1).max(40),
})

/** The action model, as a discriminated union: a `jump` manifest cannot carry lane
 *  settings and a `lane` manifest cannot carry a gravity, so an impossible
 *  configuration is unrepresentable rather than merely unlikely. */
const actionSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('jump'),
    jump: verticalMotionSchema,
    hold: holdSchema,
  }),
  z.object({
    model: z.literal('contextual'),
    /** Ordered surface map over world distance; entry 0 must start at unit 0. */
    surfaces: z.array(surfaceStopSchema).min(1).max(12),
    /** One motion block per surface — the SAME button, three meanings. */
    effects: z.object({
      ground: verticalMotionSchema,
      water: verticalMotionSchema,
      air: verticalMotionSchema,
    }),
    hold: holdSchema,
  }),
  z.object({ model: z.literal('lane'), lanes: laneBlockSchema }),
  z.object({ model: z.literal('flip'), flip: flipBlockSchema }),
])

// ---- World, ramp, spawning ------------------------------------------------------

const worldSchema = z.object({
  width: z.number().int().min(200).max(2000),
  height: z.number().int().min(120).max(1200),
  /** y of the line the avatar rests on in the vertical models. Unused by lane/flip. */
  ground_y: z.number().int().min(0).max(1200),
  /** The avatar's x is FIXED — the world scrolls past it. */
  avatar_x: z.number().int().min(0).max(2000),
  avatar_w: z.number().int().min(4).max(400),
  avatar_h: z.number().int().min(4).max(400),
})

/** One step of the speed ramp: from `from_tick` onward the world advances
 *  `units_per_tick` per 50ms tick. Phases, not a continuous curve, so "it got faster"
 *  is a moment a child can feel and a generator can reason about. */
const speedPhaseSchema = z.object({
  from_tick: z.number().int().min(0).max(4000),
  units_per_tick: z.number().int().min(1).max(60),
})
export type RunnerSpeedPhase = z.infer<typeof speedPhaseSchema>

const patternElementSchema = z.object({
  role: z.enum(RUNNER_ROLES),
  /** Offset from the pattern's origin, in world units. */
  dx: z.number().int().min(0).max(4000),
  /** Absolute top y in design units. */
  y: z.number().int().min(0).max(1200),
  w: z.number().int().min(1).max(600),
  h: z.number().int().min(1).max(600),
  variant: z.enum(RUNNER_VARIANTS),
  /** `moving` only: peak deviation from `y`, in units. */
  amplitude: z.number().int().min(1).max(400).optional(),
  /** `moving` only: full oscillation period, in TICKS (a per-entity timer, never a
   *  shared accumulator — the kernel's rule 1). */
  period_ticks: z.number().int().min(2).max(400).optional(),
  /** `sudden` only: how far ahead of the avatar the element arms and becomes visible. */
  reveal_units: z.number().int().min(1).max(4000).optional(),
})
export type RunnerPatternElement = z.infer<typeof patternElementSchema>

const patternSchema = z.object({
  id: idString,
  /** Relative selection weight in the seeded draw. */
  weight: z.number().int().min(1).max(100),
  /** How much world the pattern occupies before the inter-pattern gap is added. */
  length_units: z.number().int().min(1).max(4000),
  /** Progressive difficulty: the pattern is only eligible past this distance. */
  min_distance_units: z.number().int().min(0).max(200000).optional(),
  elements: z.array(patternElementSchema).min(1).max(8),
})
export type RunnerPattern = z.infer<typeof patternSchema>

const spawnSchema = z.object({
  /** How far beyond the right edge patterns are materialised. */
  lead_units: z.number().int().min(0).max(4000),
  min_gap_units: z.number().int().min(1).max(4000),
  max_gap_units: z.number().int().min(1).max(4000),
  patterns: z.array(patternSchema).min(1).max(12),
})

const livesSchema = z.object({
  policy: z.enum(RUNNER_CHECKPOINT_POLICIES),
  checkpoint_every_units: z.number().int().min(1).max(200000),
  /** Grace ticks after a respawn or a cheer-mode stumble. */
  respawn_invulnerable_ticks: z.number().int().min(0).max(200),
})

const comboSchema = z.object({
  step: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(10),
})

const scoringWeightsSchema = z.object({
  /** Weights are RELATIVE shares consumed by `weightedScore` — distance versus what
   *  the child actually collected. A runner that only paid for survival would teach
   *  "wait it out"; one that only paid for pickups would teach "ignore the hazards". */
  distance_weight: z.number().min(0).max(10),
  collect_weight: z.number().min(0).max(10),
  collect_points: z.number().int().min(1).max(100),
  /** The points total that counts as a full collection score. */
  collect_target: z.number().int().min(1).max(100000),
  /** Points of the 0..100 scale a wrong pickup costs (flat, kid-legible). */
  wrong_penalty_pct: z.number().min(0).max(100),
  crash_penalty_pct: z.number().min(0).max(100),
  combo: comboSchema,
})

// ---- The config ------------------------------------------------------------------

export const runnerConfigSchema = z
  .object({
    world: worldSchema,
    action: actionSchema,
    speed: z.object({ phases: z.array(speedPhaseSchema).min(1).max(6) }),
    spawn: spawnSchema,
    lives: livesSchema,
    scoring: scoringWeightsSchema,
    /** Distance that ends the run as a win. */
    target_distance: z.number().int().min(100).max(200000),
    /** Hard tick budget: the run ends here even if the target was never reached. */
    max_ticks: z.number().int().min(20).max(4000),
  })
  .superRefine((config, ctx) => {
    const phases = config.speed.phases
    const first = phases[0]
    if (first === undefined || first.from_tick !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['speed', 'phases', 0, 'from_tick'],
        message: 'the speed ramp must define the tick-0 phase',
      })
    }
    for (let i = 1; i < phases.length; i += 1) {
      const previous = phases[i - 1]
      const current = phases[i]
      if (previous === undefined || current === undefined) continue
      if (current.from_tick <= previous.from_tick) {
        ctx.addIssue({
          code: 'custom',
          path: ['speed', 'phases', i, 'from_tick'],
          message: 'speed phases must start at strictly increasing ticks',
        })
      }
    }

    if (config.spawn.max_gap_units < config.spawn.min_gap_units) {
      ctx.addIssue({
        code: 'custom',
        path: ['spawn', 'max_gap_units'],
        message: 'max_gap_units must be >= min_gap_units',
      })
    }

    if (config.world.ground_y > config.world.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['world', 'ground_y'],
        message: 'ground_y must sit inside the world height',
      })
    }

    for (const [patternIndex, pattern] of config.spawn.patterns.entries()) {
      for (const [elementIndex, element] of pattern.elements.entries()) {
        const path = ['spawn', 'patterns', patternIndex, 'elements', elementIndex]
        if (element.variant === 'moving') {
          if (element.amplitude === undefined || element.period_ticks === undefined) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: 'a moving element needs both amplitude and period_ticks',
            })
          }
        }
        if (element.variant === 'sudden' && element.reveal_units === undefined) {
          ctx.addIssue({ code: 'custom', path, message: 'a sudden element needs reveal_units' })
        }
        if (element.y + element.h > config.world.height) {
          ctx.addIssue({ code: 'custom', path, message: 'element falls outside the world height' })
        }
      }
    }

    const action = config.action
    if (action.model === 'jump' || action.model === 'contextual') {
      // A single upward step must clear the restoring force, otherwise the action is a
      // no-op the player cannot see and the winnability gate would fail mysteriously.
      const motions =
        action.model === 'jump'
          ? [action.jump]
          : [action.effects.ground, action.effects.water, action.effects.air]
      for (const motion of motions) {
        if (motion.impulse <= motion.gravity) {
          ctx.addIssue({
            code: 'custom',
            path: ['action'],
            message: 'impulse must exceed gravity, or the action moves the avatar nowhere',
          })
        }
      }
    }
    if (action.model === 'contextual') {
      const stops = action.surfaces
      const firstStop = stops[0]
      if (firstStop === undefined || firstStop.from_units !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['action', 'surfaces', 0, 'from_units'],
          message: 'the surface map must start at unit 0',
        })
      }
      for (let i = 1; i < stops.length; i += 1) {
        const previous = stops[i - 1]
        const current = stops[i]
        if (previous === undefined || current === undefined) continue
        if (current.from_units <= previous.from_units) {
          ctx.addIssue({
            code: 'custom',
            path: ['action', 'surfaces', i, 'from_units'],
            message: 'surface stops must be strictly increasing',
          })
        }
      }
    }
    if (action.model === 'lane') {
      const lowest = action.lanes.top_y + (action.lanes.count - 1) * action.lanes.gap
      if (lowest + config.world.avatar_h > config.world.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['action', 'lanes', 'gap'],
          message: 'the lowest lane falls outside the world height',
        })
      }
    }
    if (action.model === 'flip') {
      const lowest = Math.max(action.flip.floor_y, action.flip.ceiling_y)
      if (lowest + config.world.avatar_h > config.world.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['action', 'flip'],
          message: 'a flip track falls outside the world height',
        })
      }
    }

    if (config.scoring.distance_weight + config.scoring.collect_weight <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring'],
        message: 'at least one scoring weight must be positive',
      })
    }
  })

export type RunnerConfig = z.infer<typeof runnerConfigSchema>

// ---- The content ------------------------------------------------------------------

/** Which catalog items the runner spawns, and in which meaning. This is what makes a
 *  runner a LEARNING game: the things flying past are the concept tokens the lesson
 *  taught, not generic coins. */
const runnerRolesSchema = z.object({
  /** Items worth points — what the child should take. */
  collect: z.array(idString).min(1).max(20),
  /** Items the child should let go past. Every one of them must explain WHY. */
  avoid: z.array(idString).max(20),
})

export const runnerContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(1).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    roles: runnerRolesSchema,
  })
  .superRefine((content, ctx) => {
    const known: string[] = []
    for (const item of content.items) known.push(item.id)

    for (const [index, id] of content.roles.collect.entries()) {
      if (!known.includes(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'collect', index],
          message: 'unknown item id',
        })
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
      // trap can never ship without its teaching reason: a child who skips the wrong
      // item deserves to be told why it was wrong, not merely denied the points.
      if (item.misconception_md === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'avoid', index],
          message: 'an avoidable item must carry misconception_md',
        })
      }
    }
  })

export type RunnerContent = z.infer<typeof runnerContentSchema>
