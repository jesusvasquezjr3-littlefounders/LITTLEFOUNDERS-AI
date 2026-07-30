// `sorter` — the config + content contract (GAME_ENGINE.md §4 row 1, §7).
//
// THE POINT OF THIS FILE: v1's needs-vs-wants game hardcoded every number it used —
// the spawn table, the fall speed, the combo curve, the penalty, the colours — so a
// second instance meant a second copy of the code. Here EVERY tunable the simulator
// or the view reads lives in `config`, and every label, category and trap lives in
// `content`. A new sorter game is a new JSON document, never new code.
//
// Zod only, no React: `backend/src/game-contract/` and `gamegen/src/contract/` carry
// this module verbatim into their synchronous registry.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  itemTierEnum,
} from '@/game-engine/core/schemaBase'

// ---- Sprite slots -------------------------------------------------------------

/**
 * The sprite slot ids a sorter document may bind (`skin.sprites` keys, and the
 * `image_slot` an item/category may point at). CLOSED and generic on purpose: slot
 * ids are the interface between the generated manifest and Prism's illustrate stage,
 * so they cannot be per-document free text — an undeclared key would silently never
 * render, which is why core/schema.ts rejects it outright.
 *
 * 8 bins is the report's category ceiling; 16 item slots comfortably covers a round's
 * distinct visual subjects (an item without its own slot falls back to its Material
 * Symbols `icon`, which is always legible).
 */
export const SORTER_SPRITE_SLOTS = [
  'field',
  'tray',
  'trash',
  'bin_1',
  'bin_2',
  'bin_3',
  'bin_4',
  'bin_5',
  'bin_6',
  'bin_7',
  'bin_8',
  'item_1',
  'item_2',
  'item_3',
  'item_4',
  'item_5',
  'item_6',
  'item_7',
  'item_8',
  'item_9',
  'item_10',
  'item_11',
  'item_12',
  'item_13',
  'item_14',
  'item_15',
  'item_16',
] as const satisfies readonly string[]

export type SorterSpriteSlot = (typeof SORTER_SPRITE_SLOTS)[number]

// ---- Config -------------------------------------------------------------------

/** How elements reach the player. `static` = a tray that never moves (tier 1),
 *  `falling` = they descend and can be missed, `conveyor` = they cross sideways. */
export const SORTER_MODES = ['static', 'falling', 'conveyor'] as const
export type SorterMode = (typeof SORTER_MODES)[number]

/**
 * The playfield in DESIGN COORDINATES (core/stage.ts maps them onto the real
 * viewport). It is config rather than a constant because travel distance IS
 * difficulty in `falling`/`conveyor`: a 540-tall field at 6 px/tick gives 4.5s to
 * decide, a 320-tall one gives 2.7s.
 */
export const sorterFieldSchema = z.object({
  width: z.number().int().min(320).max(2000),
  height: z.number().int().min(240).max(1400),
  /** Spawn columns (falling) or rows (conveyor). */
  lanes: z.number().int().min(1).max(8),
  /** Rendered edge of one element, in design px. */
  item_size: z.number().int().min(24).max(240),
})

/**
 * One rung of the difficulty ladder — the shape v1's `DIFFICULTY_LEVELS` table
 * already had, lifted out of the code and into the document.
 */
export const sorterLadderLevelSchema = z.object({
  /** Ticks between spawns (50ms each). Capacity still gates the actual spawn. */
  spawn_interval_ticks: z.number().int().min(1).max(400),
  /** Design px per tick. MUST be 0 in `static` mode (refined below). */
  fall_speed: z.number().min(0).max(60),
  /** Symmetric +-jitter applied to `fall_speed`, so two elements never share a rhythm. */
  speed_variance: z.number().min(0).max(20),
  max_active: z.number().int().min(1).max(12),
  /** Which item tiers this rung draws from — the "attribute complexity" dial. */
  item_tiers: z.array(itemTierEnum).min(1).max(4),
  points_per_correct: z.number().int().min(1).max(100),
})

/** What one mistake costs. Every field is a dial: a tier-1 cheer document sets them
 *  all to zero except the combo reset, a tier-3 arcade document charges a life. */
const sorterPenaltySchema = z.object({
  /** POINTS of the 0..100 scale removed per occurrence (core/scoring applyPenalty). */
  score_pct: z.number().min(0).max(50),
  /** Lives removed per occurrence. Ignored in cheer mode, where lives is null. */
  lives: z.number().int().min(0).max(3),
  combo_reset: z.boolean(),
})

export const sorterPenaltyModelSchema = z.object({
  wrong_drop: sorterPenaltySchema.extend({
    /** The report's rule: a wrong placement RETURNS the element to play. `false`
     *  consumes it instead, which is the harsher tuning. */
    return_item: z.boolean(),
  }),
  /** A `miss` is an element with a real category leaving the field unsorted. A TRAP
   *  leaving the field is never a miss — ignoring it is the correct play. */
  miss: sorterPenaltySchema,
})

export const sorterComboSchema = z.object({
  /** Consecutive correct placements per extra multiplier step. */
  step: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(10),
})

export const sorterRoundSchema = z.object({
  target_correct: z.number().int().min(1).max(80),
  target_points: z.number().int().min(1).max(20000),
  /** Hard end of the run, in 50ms ticks. In cheer mode this is the ONLY fail-free
   *  end besides reaching the target. */
  tick_budget: z.number().int().min(20).max(12000),
})

/** Relative weights of the three 0..100 signals blended into the final score. */
export const sorterScoreWeightsSchema = z.object({
  accuracy: z.number().min(0).max(1),
  progress: z.number().min(0).max(1),
  points: z.number().min(0).max(1),
})

export const sorterConfigSchema = z
  .object({
    mode: z.enum(SORTER_MODES),
    /** The report's 2-8 container dial. Cross-checked against the declared
     *  categories by the simulator, which only ever accepts a declared container. */
    category_count: z.number().int().min(2).max(8),
    field: sorterFieldSchema,
    ladder: z.array(sorterLadderLevelSchema).min(1).max(6),
    level_up: z.object({
      /** Correct placements per rung climbed. */
      correct_per_level: z.number().int().min(1).max(40),
    }),
    combo: sorterComboSchema,
    penalty: sorterPenaltyModelSchema,
    /** Whether a discard target exists. Without one, a trap must simply be LEFT
     *  alone — which only works in a mode where elements eventually leave. */
    trash_zone: z.boolean(),
    /** Recycle the item deck once exhausted instead of ending the run. */
    repeat_items: z.boolean(),
    /** How many elements already exist at tick 0 — a `static` tray starts full, a
     *  `falling` field usually starts empty. */
    initial_fill: z.number().int().min(0).max(12),
    round: sorterRoundSchema,
    score_weights: sorterScoreWeightsSchema,
  })
  .refine(
    (config) => config.mode !== 'static' || config.ladder.every((level) => level.fall_speed === 0),
    'static mode: every ladder level must set fall_speed to 0',
  )
  .refine((config) => {
    const first = config.ladder[0]
    return first === undefined || config.initial_fill <= first.max_active
  }, 'initial_fill cannot exceed the first ladder level max_active')
  .refine(
    (config) =>
      config.score_weights.accuracy + config.score_weights.progress + config.score_weights.points >
      0,
    'score_weights: at least one signal must carry weight',
  )

export type SorterField = z.infer<typeof sorterFieldSchema>
export type SorterLadderLevel = z.infer<typeof sorterLadderLevelSchema>
export type SorterPenaltyModel = z.infer<typeof sorterPenaltyModelSchema>
export type SorterConfig = z.infer<typeof sorterConfigSchema>

// ---- Content ------------------------------------------------------------------

/**
 * Sorter content. `categories` is REQUIRED here (it is optional on the shared
 * shape): a sorter with no containers is not a harder sorter, it is a broken one.
 *
 * An item with no `category` is a TRAP — it belongs in no container. The last refine
 * is the misconception gate from the content playbook: a trap that does not explain
 * WHY it belongs nowhere teaches nothing, so it is invalid output rather than
 * merely thin output.
 */
export const sorterContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(2).max(80),
    categories: z.array(gameCategorySchema).min(2).max(8),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
  })
  .refine((content) => {
    const ids = content.categories.map((category) => category.id)
    return new Set(ids).size === ids.length
  }, 'categories: ids must be unique')
  .refine((content) => {
    const ids = content.items.map((item) => item.id)
    return new Set(ids).size === ids.length
  }, 'items: ids must be unique')
  .refine((content) => {
    const declared = new Set(content.categories.map((category) => category.id))
    return content.items.every((item) => item.category === undefined || declared.has(item.category))
  }, 'items: category must reference a declared category id')
  .refine(
    (content) =>
      content.categories.every((category) =>
        content.items.some((item) => item.category === category.id),
      ),
    'categories: every container needs at least one item that belongs in it',
  )
  .refine(
    (content) =>
      content.items.every(
        (item) => item.category !== undefined || typeof item.misconception_md === 'string',
      ),
    'items: a trap (no category) must carry misconception_md explaining why it belongs nowhere',
  )

export type SorterContent = z.infer<typeof sorterContentSchema>
export type SorterItem = SorterContent['items'][number]
export type SorterCategory = SorterContent['categories'][number]
