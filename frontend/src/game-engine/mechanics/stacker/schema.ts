// `stacker` — the config + content contract (GAME_ENGINE.md §4 row `stacker`, §7).
//
// THE POINT OF THIS FILE: v1's building game hardcoded gravity, the piece list, the
// wind gust, the budget and the score formula inside the component, so a second
// instance meant a second copy of the code. Here EVERY tunable — gravity magnitude AND
// direction (zero-G included), the piece catalogue and its special properties, the
// solver's iteration count and sleep thresholds, the announced force timeline, the
// stability threshold and hold time, the whole economy, the score model and its
// weights, and the adaptive-assistance dials — is a manifest field. `simulate.ts` and
// `components.tsx` read all of them from `config`; neither contains a tuning number.
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

// ---- Sprite slots ---------------------------------------------------------------

/**
 * The sprite slot ids a stacker document may bind (`skin.sprites` keys, and the
 * `image_slot` an item/category may point at). CLOSED: slot ids are the interface
 * between the generated manifest and Prism's illustrate stage, so an undeclared key is
 * a schema error rather than a rectangle that silently never renders.
 *
 * Every slot here is drawn by `components.tsx` — the list is not aspirational. 12 piece
 * slots covers the catalogue ceiling below; the five `force_*` slots let a document
 * illustrate its own announced disturbances, which is what makes the timeline READABLE
 * to a child instead of a surprise. (The stage backdrop is `skin.background_url`, not a
 * slot, so there is no `sky`.)
 */
export const STACKER_SPRITE_SLOTS = [
  'ground',
  'base',
  'ghost',
  'marker_target',
  'force_wind',
  'force_vibration',
  'force_earthquake',
  'force_rain',
  'force_load',
  'piece_1',
  'piece_2',
  'piece_3',
  'piece_4',
  'piece_5',
  'piece_6',
  'piece_7',
  'piece_8',
  'piece_9',
  'piece_10',
  'piece_11',
  'piece_12',
] as const satisfies readonly string[]

export type StackerSpriteSlot = (typeof STACKER_SPRITE_SLOTS)[number]

// ---- Closed sets ----------------------------------------------------------------

/** Body geometry. Restricted to these two by GAME_ENGINE.md §13: a general convex
 *  solver cannot be made bit-identical across engines, and these two have exact,
 *  branch-free overlap tests built from the §5-allowed arithmetic alone. */
export const STACKER_SHAPES = ['box', 'circle'] as const
export type StackerShape = (typeof STACKER_SHAPES)[number]

/** The report's special-property ladder. `property_value` carries the magnitude and
 *  means something different for each — see `stackerPieceSchema`. */
export const STACKER_PROPERTIES = [
  'none',
  'adhesive',
  'magnetic',
  'elastic',
  'brittle',
  'counterweight',
] as const
export type StackerProperty = (typeof STACKER_PROPERTIES)[number]

/** The announced disturbance vocabulary. Closed, because each kind has its own
 *  integration branch in the simulator — an invented kind would be inert. */
export const STACKER_FORCE_KINDS = ['wind', 'vibration', 'earthquake', 'rain', 'load'] as const
export type StackerForceKind = (typeof STACKER_FORCE_KINDS)[number]

/** `snap` seats a piece exactly on whatever is under it, at rest (the tier-1 posture:
 *  no bounce, no surprise). `drop` releases it from `drop_y` with the world's gravity
 *  acting on it, so landing itself is part of the skill. */
export const STACKER_PLACEMENT_MODES = ['drop', 'snap'] as const
export type StackerPlacementMode = (typeof STACKER_PLACEMENT_MODES)[number]

/**
 * How the five signals become one 0..100 score.
 *
 * `product` is the owner report's literal formula (height x margin x efficiency, plus
 * a style bonus). `blend` is a weighted mean of the same signals. Both ship because a
 * product zeroes the whole score on ANY single weak signal, which is the right bar for
 * a tier-3 arcade document and the wrong one for a 6-year-old's first tower — so the
 * choice is a manifest decision, not an engine opinion.
 */
export const STACKER_SCORE_MODELS = ['blend', 'product'] as const
export type StackerScoreModel = (typeof STACKER_SCORE_MODELS)[number]

// ---- Field & gravity --------------------------------------------------------------

/** The playfield in DESIGN COORDINATES (core/stage.ts maps them onto the real
 *  viewport). y grows DOWNWARD, as everywhere else in the engine. */
export const stackerFieldSchema = z.object({
  width: z.number().int().min(320).max(2000),
  height: z.number().int().min(240).max(1400),
  /** y of the base's top surface — the line pieces rest on. */
  ground_y: z.number().int().min(40).max(1400),
  /** Centre x of the base platform. */
  base_x: z.number().int().min(0).max(2000),
  /** Width of the base platform. Everything outside it is open air. */
  base_width: z.number().int().min(40).max(2000),
  /** A body whose CENTRE crosses this y has fallen off the world — criterion (a) of
   *  the collapse rule. Below `ground_y` by construction (refined). */
  baseline_y: z.number().int().min(40).max(1600),
})
export type StackerField = z.infer<typeof stackerFieldSchema>

/**
 * Gravity as a vector, in design units per tick per tick.
 *
 * `direction_degrees` is measured with the engine's screen convention: 90 points
 * straight DOWN (+y), 0 points right, 270 points up. `dsin(90)` and `dcos(90)` are
 * pinned exactly in core/mathd.ts, so the ordinary case costs no accuracy. Setting
 * `intensity` to 0 gives genuine ZERO-G, which the report asks for and which the
 * simulator handles without a special case — nothing accelerates, so a structure only
 * moves when a disturbance pushes it.
 */
export const stackerGravitySchema = z.object({
  intensity: z.number().min(0).max(40),
  direction_degrees: z.number().min(0).max(360),
})
export type StackerGravity = z.infer<typeof stackerGravitySchema>

// ---- The piece catalogue -----------------------------------------------------------

/**
 * One buildable piece. The GEOMETRY, MASS, MATERIAL and SPECIAL PROPERTY live here
 * (they are difficulty, so they belong to `config`); the piece's NAME, icon and
 * misconception live on the matching `content.items` entry (they are language, so they
 * belong to `content` and go through `localize`). `item_id` is the join.
 *
 * `property_value` is the property's magnitude, and it means a different thing per
 * property — one numeric field rather than five mutually-exclusive optional ones, so
 * an impossible combination is unrepresentable:
 *
 * | property | `property_value` means |
 * |---|---|
 * | `none` | ignored |
 * | `adhesive` | bond strength: the relative speed the glue holds before it lets go |
 * | `magnetic` | attraction radius in design units (pull strength is `solver.magnet_pull`) |
 * | `elastic` | restitution BONUS added to `restitution` (the sum is clamped to 1) |
 * | `brittle` | contact-impulse threshold above which the piece shatters |
 * | `counterweight` | mass MULTIPLIER (floored at 1, so a 0 can never erase a piece's weight) |
 */
export const stackerPieceSchema = z.object({
  /** Must name a `content.items[].id`; the simulator ignores an entry that does not. */
  item_id: idString,
  shape: z.enum(STACKER_SHAPES),
  /** Design units. A circle's radius is `min(w, h) / 2`. */
  w: z.number().int().min(8).max(400),
  h: z.number().int().min(8).max(400),
  mass: z.number().min(0.1).max(200),
  /** Coulomb coefficient. Pair friction is `sqrt(a * b)` — `Math.sqrt` is exactly
   *  specified by IEEE-754, unlike every other averaging trick worth using. */
  friction: z.number().min(0).max(1),
  restitution: z.number().min(0).max(1),
  property: z.enum(STACKER_PROPERTIES),
  property_value: z.number().min(0).max(400),
  /** Money units. Used only when `economy.use_piece_cost` is true; otherwise the cost
   *  is derived from mass and volume, which is the report's "cost proportional to
   *  mass/volume" rule. */
  cost: z.number().int().min(0).max(100000),
  /** The report's EXPANDING CATALOGUE: this piece is only placeable once the player
   *  has already placed this many pieces in the current attempt. 0 = available at once. */
  unlock_after_pieces: z.number().int().min(0).max(40),
  /** How many of this piece one attempt may use. */
  max_uses: z.number().int().min(1).max(40),
})
export type StackerPiece = z.infer<typeof stackerPieceSchema>

// ---- The announced force timeline ---------------------------------------------------

/**
 * One scheduled disturbance. `at_tick` is relative to the START OF THE TEST PHASE, so
 * a player who finishes building early meets the same timeline a player who used the
 * whole build clock does — the schedule is a property of the challenge, not of the
 * player's speed.
 *
 * ANNOUNCED is the whole point (the report's word): `timeline.announce_ticks` before
 * `at_tick` the view shows what is coming, so a collapse is a plan that was wrong, not
 * an ambush.
 *
 * | kind | effect |
 * |---|---|
 * | `wind` | steady horizontal pressure; sign of `magnitude` picks the direction |
 * | `vibration` | horizontal oscillation over `period_ticks` (small, constant) |
 * | `earthquake` | horizontal oscillation plus a vertical jolt; wakes every sleeping body |
 * | `rain` | adds mass to the TOPMOST body every tick, and it STAYS (water pools on the roof) |
 * | `load` | adds mass to the topmost body for the event's duration only |
 */
export const stackerForceEventSchema = z.object({
  id: idString,
  at_tick: z.number().int().min(0).max(4000),
  kind: z.enum(STACKER_FORCE_KINDS),
  /** Pressure (wind/vibration/earthquake) or mass per tick (rain/load). Negative is
   *  legal for the horizontal kinds and simply blows the other way. */
  magnitude: z.number().min(-400).max(400),
  duration_ticks: z.number().int().min(1).max(4000),
  /** Required by `vibration` and `earthquake` (refined below); ignored otherwise. */
  period_ticks: z.number().int().min(2).max(400).optional(),
})
export type StackerForceEvent = z.infer<typeof stackerForceEventSchema>

export const stackerTimelineSchema = z.object({
  /** How far ahead the view announces an event, in ticks. 0 = no warning (tier 3). */
  announce_ticks: z.number().int().min(0).max(400),
  /**
   * The report's SUDDEN SHAKE: each event's magnitude is scaled by
   * `1 +- gust_variance`, drawn ONCE per event from the run's seeded PRNG at init. It
   * is drawn at init rather than per tick so the whole gust is one decision a player
   * can read, and so a replay of the same seed reproduces it exactly.
   */
  gust_variance: z.number().min(0).max(0.9),
  events: z.array(stackerForceEventSchema).max(8),
})
export type StackerTimeline = z.infer<typeof stackerTimelineSchema>

// ---- Placement, economy, solver, stability ------------------------------------------

export const stackerPlacementSchema = z.object({
  mode: z.enum(STACKER_PLACEMENT_MODES),
  /** `drop` mode: the y a released piece starts from. Ignored by `snap`. */
  drop_y: z.number().int().min(0).max(1400),
  /**
   * Step rotation, in 90-degree increments: 1 = no rotation, 2 = {0, 90}, 4 = all four.
   * A box swaps `w`/`h` on an odd step; a circle is rotation-invariant. Only these
   * three values exist because a non-multiple of 90 would need a rotated collision
   * test, which §13 rules out.
   */
  rotation_steps: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  /** Placement x is quantised to this grid, so the same tap always means the same
   *  column and a replay cannot land a piece a sub-pixel away from the live run. */
  snap_grid: z.number().int().min(1).max(200),
  /** View affordance: draw the translucent piece preview before committing. */
  ghost_preview: z.boolean(),
  /** Pieces one attempt may place at once (the structure's size ceiling). */
  max_pieces: z.number().int().min(1).max(40),
  /** Ticks the BUILD phase lasts before the timeline starts on its own. The player may
   *  always start earlier with `ready`; this is the "progressively tighter time limit"
   *  difficulty dial. */
  build_ticks: z.number().int().min(20).max(4000),
})
export type StackerPlacement = z.infer<typeof stackerPlacementSchema>

export const stackerEconomySchema = z.object({
  /** Money available for the whole attempt. The concept lives here (§4 learning
   *  binding): pieces and budget ARE the trade-off the game teaches. */
  budget: z.number().int().min(1).max(1000000),
  /** true = the piece's own `cost`; false = derived from mass and area below, which is
   *  the report's "cost proportional to mass/volume". */
  use_piece_cost: z.boolean(),
  cost_per_mass: z.number().min(0).max(1000),
  /** Applied to `w * h / 1000`, so a piece's cost scales with the space it occupies. */
  cost_per_area: z.number().min(0).max(1000),
  /** Floor for a derived cost — nothing a child places is ever free. */
  min_cost: z.number().int().min(0).max(100000),
  /** PARTIAL refund on a voluntary removal (the report's word: partial). */
  refund_pct: z.number().min(0).max(100),
  /** What moving an already-placed piece costs. The report asks for repositioning to
   *  have a COST; 0 makes it free, which is the tier-1 posture. */
  reposition_cost: z.number().int().min(0).max(100000),
  /** Share of the budget returned after a collapse, so a retry is not bankrupt. */
  collapse_refund_pct: z.number().min(0).max(100),
})
export type StackerEconomy = z.infer<typeof stackerEconomySchema>

/**
 * Solver tuning. DETERMINISM OVER REALISM (§13): a FIXED iteration count, never an
 * adaptive one, and no sub-stepping — every tick does exactly `iterations` passes of
 * position correction plus impulse resolution, in array order, so two engines walk the
 * identical sequence of operations.
 */
export const stackerSolverSchema = z.object({
  /**
   * Contact-resolution passes per tick, run TWICE over (once for velocities, once for
   * positions). Fixed by contract — never adaptive (§13) — and it is a real difficulty
   * dial rather than a performance knob: the solver is Gauss-Seidel, so a constraint
   * propagates one contact per pass, and a tower taller than the iteration count keeps a
   * little residual velocity in its upper pieces. 10-12 holds a six-piece stack rigid;
   * a low count makes tall towers genuinely wobblier, which is a legitimate thing for a
   * tier-3 manifest to ask for.
   */
  iterations: z.number().int().min(1).max(16),
  /** Fraction of a measured overlap removed per pass (Baumgarte-style). 1 = rigid. */
  position_correction: z.number().min(0).max(1),
  /** Speed below which a body accumulates sleep, in design units per tick. */
  sleep_speed: z.number().min(0).max(10),
  /** Consecutive slow ticks before a body sleeps. A sleeping body is exactly still,
   *  which is what stops a settled tower from jittering itself apart over 1000 ticks. */
  sleep_ticks: z.number().int().min(1).max(200),
  /** Relative normal speed below which a contact is treated as resting (no bounce). */
  rest_speed: z.number().min(0).max(10),
  /** Per-tick velocity retention, 1 = frictionless air. */
  damping: z.number().min(0.5).max(1),
  /** Wind/vibration/earthquake pressure is multiplied by `w * h / wind_area_scale`, so
   *  a big light panel catches the gust and a small dense block shrugs it off. */
  wind_area_scale: z.number().min(1).max(100000),
  /** Attraction acceleration a magnetic piece applies inside its radius. */
  magnet_pull: z.number().min(0).max(20),
})
export type StackerSolver = z.infer<typeof stackerSolverSchema>

/**
 * The victory condition, as the report states it: a stability MARGIN (stabilising
 * torque / overturning torque) at or above `margin_threshold`, sustained for
 * `hold_ticks` while the announced timeline runs.
 */
export const stackerStabilitySchema = z.object({
  margin_threshold: z.number().min(0.1).max(50),
  /** What the margin reports when there is no overturning torque at all (a still
   *  world). Finite by contract: an Infinity would poison every downstream average. */
  margin_cap: z.number().min(1).max(1000),
  /** T_hold, in 50ms ticks. */
  hold_ticks: z.number().int().min(1).max(4000),
  /** Height above the base surface that scores a full height signal, in design units. */
  target_height: z.number().int().min(10).max(1400),
  /** How close two surfaces must be to count as touching (contact + support tests). */
  contact_epsilon: z.number().min(0).max(20),
})
export type StackerStability = z.infer<typeof stackerStabilitySchema>

/**
 * The collapse criterion, in full. A collapse is declared on the FIRST tick at which
 * any of these holds for a body that has been settled at least `grace_ticks` (so a
 * piece still falling in `drop` mode is never mistaken for a failure):
 *
 *  (a) the body's centre y passes `field.baseline_y` — it left the world downward;
 *  (b) the body's centre x leaves `[0, field.width]` — it left the world sideways;
 *  (c) the body drifted more than `max_shift` design units from where it was placed;
 *  (d) the structure's TILT — the angle between vertical and the line from the base
 *      centre to the centre of mass, via `datan2` — exceeds `max_tilt_degrees`;
 *  (e) a `brittle` piece took a contact impulse above its `property_value` and
 *      shattered, and `brittle_breaks_run` says a shatter ends the attempt.
 */
export const stackerCollapseSchema = z.object({
  max_tilt_degrees: z.number().min(1).max(89),
  /** How tall the centre of mass must stand above the base surface before criterion
   *  (d) is evaluated at all. Without it a single wide, flat slab placed a few units
   *  off-centre reads as a 50-degree "tilt" — the angle is meaningless until there is
   *  something to tip OVER. */
  tilt_min_height: z.number().min(0).max(1400),
  max_shift: z.number().min(1).max(2000),
  brittle_breaks_run: z.boolean(),
  grace_ticks: z.number().int().min(0).max(400),
})
export type StackerCollapse = z.infer<typeof stackerCollapseSchema>

/**
 * ADAPTIVE ASSISTANCE (the report's difficulty variable, GAME_ENGINE.md §4).
 *
 * WHY IT LIVES IN `config` AND NOT ONLY IN THE DOCUMENT'S `adaptive` BLOCK: `SimInit`
 * deliberately carries only `{ config, content, scoring, seed }` (core/types.ts) — the
 * simulator never sees `document.adaptive`, and it must not, because Core replays the
 * simulator to DERIVE the reward: an ease magnitude the client could vary is an ease
 * magnitude a forged log could exploit.
 *
 * So the split is: the document's `adaptive` block decides whether help is OFFERED at
 * all (the view refuses to show the toggle when `adaptive.enabled` is false, and
 * `assist_toggleable` is literal `true` so the child may always decline), and these
 * fields — which carry the SAME NAMES so the pipeline can copy them across verbatim —
 * decide what help DOES. The player's acceptance travels through the input log as the
 * `assist_on` / `assist_off` actions, so a replay reproduces it exactly, which is the
 * resolution GAME_ENGINE.md §13 anticipates for easing.
 */
export const stackerAssistSchema = z.object({
  enabled: z.boolean(),
  /** Collapses in this attempt before assistance may be switched on at all. */
  ease_after_failures: z.number().int().min(1).max(5),
  /** Every disturbance magnitude is multiplied by this while assistance is active —
   *  the report's "reduce a force by a configured percentage". */
  ease_factor: z.number().min(0.5).max(1),
  /** Whether the simulator also surfaces a suggested next piece. */
  suggest_piece: z.boolean(),
})
export type StackerAssist = z.infer<typeof stackerAssistSchema>

export const stackerStyleSchema = z.object({
  /** Relative weight of the symmetry signal inside the style bonus. */
  symmetry_weight: z.number().min(0).max(10),
  /** Relative weight of the cantilever signal inside the style bonus. */
  cantilever_weight: z.number().min(0).max(10),
  /** Design units a piece must overhang whatever supports it to count as a cantilever. */
  cantilever_min_overhang: z.number().min(1).max(400),
  /** Cantilevers needed for a full 100 on that signal. */
  cantilever_target: z.number().int().min(1).max(20),
  /** `product` model only: how much of the style score is added on top of the product. */
  bonus_share: z.number().min(0).max(1),
})
export type StackerStyle = z.infer<typeof stackerStyleSchema>

export const stackerScoreWeightsSchema = z.object({
  height: z.number().min(0).max(10),
  stability: z.number().min(0).max(10),
  hold: z.number().min(0).max(10),
  efficiency: z.number().min(0).max(10),
  style: z.number().min(0).max(10),
})
export type StackerScoreWeights = z.infer<typeof stackerScoreWeightsSchema>

/** POINTS of the 0..100 scale removed per occurrence (core/scoring `applyPenalty`) —
 *  a flat, kid-legible subtraction, never a compounding multiplier. */
export const stackerPenaltySchema = z.object({
  collapse_pct: z.number().min(0).max(50),
  reposition_pct: z.number().min(0).max(50),
  /** Charged for each piece the content marked as one to avoid. */
  avoid_piece_pct: z.number().min(0).max(50),
})
export type StackerPenalty = z.infer<typeof stackerPenaltySchema>

// ---- The config ---------------------------------------------------------------------

export const stackerConfigSchema = z
  .object({
    field: stackerFieldSchema,
    gravity: stackerGravitySchema,
    catalog: z.array(stackerPieceSchema).min(1).max(12),
    placement: stackerPlacementSchema,
    economy: stackerEconomySchema,
    solver: stackerSolverSchema,
    stability: stackerStabilitySchema,
    collapse: stackerCollapseSchema,
    timeline: stackerTimelineSchema,
    assist: stackerAssistSchema,
    style: stackerStyleSchema,
    score_model: z.enum(STACKER_SCORE_MODELS),
    score_weights: stackerScoreWeightsSchema,
    penalty: stackerPenaltySchema,
    /** Hard end of the attempt, in 50ms ticks — build phase, tests and retries all
     *  come out of this one budget. */
    round: z.object({ tick_budget: z.number().int().min(40).max(12000) }),
  })
  .superRefine((config, ctx) => {
    const { field, placement, catalog, timeline } = config

    if (field.baseline_y <= field.ground_y) {
      ctx.addIssue({
        code: 'custom',
        path: ['field', 'baseline_y'],
        message: 'baseline_y must sit BELOW ground_y (y grows downward)',
      })
    }
    if (field.ground_y > field.height) {
      ctx.addIssue({
        code: 'custom',
        path: ['field', 'ground_y'],
        message: 'ground_y must sit inside the field height',
      })
    }
    const halfBase = field.base_width / 2
    if (field.base_x - halfBase < 0 || field.base_x + halfBase > field.width) {
      ctx.addIssue({
        code: 'custom',
        path: ['field', 'base_width'],
        message: 'the base platform must fit inside the field width',
      })
    }
    if (placement.mode === 'drop' && placement.drop_y >= field.ground_y) {
      ctx.addIssue({
        code: 'custom',
        path: ['placement', 'drop_y'],
        message: 'drop mode releases a piece ABOVE the base surface',
      })
    }

    const seen: string[] = []
    for (const [index, piece] of catalog.entries()) {
      if (seen.includes(piece.item_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['catalog', index, 'item_id'],
          message: 'catalog: item_id must be unique',
        })
      }
      seen.push(piece.item_id)
      if (piece.property !== 'none' && piece.property_value <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['catalog', index, 'property_value'],
          message: 'a special property needs a magnitude above 0',
        })
      }
      if (piece.w > field.base_width && piece.h > field.base_width) {
        ctx.addIssue({
          code: 'custom',
          path: ['catalog', index],
          message: 'a piece that cannot fit on the base in any rotation is unplaceable',
        })
      }
    }

    // At least one piece must be placeable at tick 0 within the budget, or the
    // challenge is unwinnable before it starts and the §9 gate would fail with a
    // mysterious "the perfect bot scored 0" instead of a schema error here.
    const affordable = catalog.some(
      (piece) => piece.unlock_after_pieces === 0 && costOfPiece(config, piece) <= config.economy.budget,
    )
    if (!affordable) {
      ctx.addIssue({
        code: 'custom',
        path: ['economy', 'budget'],
        message: 'no unlocked piece is affordable at tick 0',
      })
    }

    let previousAt = -1
    for (const [index, event] of timeline.events.entries()) {
      if (event.at_tick <= previousAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeline', 'events', index, 'at_tick'],
          message: 'timeline events must start at strictly increasing ticks',
        })
      }
      previousAt = event.at_tick
      const periodic = event.kind === 'vibration' || event.kind === 'earthquake'
      if (periodic && event.period_ticks === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeline', 'events', index, 'period_ticks'],
          message: 'an oscillating disturbance needs period_ticks',
        })
      }
      if ((event.kind === 'rain' || event.kind === 'load') && event.magnitude <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeline', 'events', index, 'magnitude'],
          message: 'rain and load add MASS, so their magnitude must be positive',
        })
      }
    }

    const weights = config.score_weights
    if (
      weights.height + weights.stability + weights.hold + weights.efficiency + weights.style <=
      0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['score_weights'],
        message: 'score_weights: at least one signal must carry weight',
      })
    }

    // One tick of gravity adds `intensity * damping` to a body's downward speed. If a
    // contact only counts as RESTING below `rest_speed`, and `rest_speed` is under that
    // step, then every contact in a settled tower is re-classified as an impact every
    // single tick: restitution keeps firing, nothing ever comes to rest, nothing ever
    // sleeps, and the residual motion creeps the structure sideways until it reads as a
    // collapse. This is a correctness relationship between three fields, not a taste
    // preference, so it belongs in the schema rather than in a tuning comment.
    const gravityStep = config.gravity.intensity * config.solver.damping
    if (config.solver.rest_speed < gravityStep) {
      ctx.addIssue({
        code: 'custom',
        path: ['solver', 'rest_speed'],
        message: 'rest_speed must be at least gravity.intensity * solver.damping, or nothing settles',
      })
    }

    if (config.stability.margin_cap < config.stability.margin_threshold) {
      ctx.addIssue({
        code: 'custom',
        path: ['stability', 'margin_cap'],
        message: 'margin_cap must be at least margin_threshold, or victory is impossible',
      })
    }
  })

export type StackerConfig = z.infer<typeof stackerConfigSchema>

/**
 * What one piece costs in this document's economy — the report's "cost proportional to
 * mass/volume", with a manifest switch to an explicitly authored price instead.
 *
 * Exported because `simulate.ts`, the bots and the view must all quote the SAME number:
 * a tray that shows one price while the simulator charges another is the kind of
 * mismatch a child reads as the game cheating.
 *
 * Integer by construction — money in this product is a whole number of units, and a
 * fractional charge would drift between the live run and its replay.
 */
export function costOfPiece(
  config: Pick<StackerConfig, 'economy'>,
  piece: Pick<StackerPiece, 'cost' | 'mass' | 'w' | 'h'>,
): number {
  const { economy } = config
  if (economy.use_piece_cost) return Math.max(0, Math.round(piece.cost))
  const derived =
    economy.cost_per_mass * piece.mass + (economy.cost_per_area * (piece.w * piece.h)) / 1000
  return Math.max(economy.min_cost, Math.round(derived))
}

// ---- The content --------------------------------------------------------------------

/**
 * Which catalogue pieces the content recommends and which it warns against. This is
 * what makes a stacker a LEARNING game rather than a toy: `foundation` is the
 * "what a stable plan looks like" answer, and every `avoid` piece must say WHY it is a
 * bad idea — the misconception gate (GAME_ENGINE.md §9 `gate`), enforced at the schema
 * so a trap can never ship without its teaching reason.
 */
const stackerRolesSchema = z.object({
  foundation: z.array(idString).min(1).max(20),
  avoid: z.array(idString).max(20),
})

export const stackerContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(1).max(80),
    /** Optional piece FAMILIES (e.g. "ahorro", "deuda") — labels for the tray. */
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    roles: stackerRolesSchema,
  })
  .superRefine((content, ctx) => {
    const known: string[] = []
    for (const item of content.items) {
      if (known.includes(item.id)) {
        ctx.addIssue({ code: 'custom', path: ['items'], message: 'items: ids must be unique' })
      }
      known.push(item.id)
    }

    const declared: string[] = []
    for (const category of content.categories ?? []) declared.push(category.id)
    for (const [index, item] of content.items.entries()) {
      if (item.category !== undefined && !declared.includes(item.category)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'category'],
          message: 'category must reference a declared category id',
        })
      }
    }

    for (const [index, id] of content.roles.foundation.entries()) {
      if (!known.includes(id)) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'foundation', index], message: 'unknown item id' })
      }
      if (content.roles.avoid.includes(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'foundation', index],
          message: 'a piece cannot be both a foundation and one to avoid',
        })
      }
    }

    for (const [index, id] of content.roles.avoid.entries()) {
      const item = content.items.find((candidate) => candidate.id === id)
      if (item === undefined) {
        ctx.addIssue({ code: 'custom', path: ['roles', 'avoid', index], message: 'unknown item id' })
        continue
      }
      if (item.misconception_md === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['roles', 'avoid', index],
          message: 'a piece to avoid must carry misconception_md explaining why',
        })
      }
    }
  })

export type StackerContent = z.infer<typeof stackerContentSchema>
