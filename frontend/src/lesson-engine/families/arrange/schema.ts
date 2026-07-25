// `arrange` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.4, types 20–29).

import { z } from 'zod'
import {
  idSchema,
  idText,
  idVisual,
  idLabel,
  markdownLite,
  segmentSchema,
  iconName,
  imageUrl,
} from '../../core/schemaBase'

/** Visual tint palette shared by icon tiles (matches BigIconTile tints). */
export const tileTint = z.enum(['primary', 'accent', 'success', 'warning', 'delight'])

export const matchPairs = segmentSchema(
  'match_pairs',
  z.object({
    // Left = the concrete things to match (coins, objects) — illustratable.
    left: z.array(idVisual).min(2).max(8),
    right: z.array(idText).min(2).max(10), // may contain distractors
  }),
  z.object({ pairs: z.array(z.tuple([idSchema, idSchema])).min(1) }),
)

/** Flow type — score is DERIVED from flips; there is NO answer key (payload only).
 *  Every card carries an icon (guaranteed visual, zero-cost) and MAY carry a
 *  generated illustration (Forge image pipeline, preferred over the icon when
 *  present) — plain text-only cards read as a flashcard drill, not a game. */
export const memoryFlip = segmentSchema(
  'memory_flip',
  z.object({
    pairs: z
      .array(
        z.object({
          a_md: markdownLite,
          a_icon: iconName,
          a_image_url: z.string().url().optional(),
          b_md: markdownLite,
          b_icon: iconName,
          b_image_url: z.string().url().optional(),
        }),
      )
      .min(3)
      .max(6),
  }),
)

export const sortBuckets = segmentSchema(
  'sort_buckets',
  z.object({
    buckets: z.array(idLabel).min(2).max(5),
    items: z.array(idVisual).min(4).max(16),
  }),
  z.object({ assignments: z.record(idSchema, idSchema) }),
)

/** `slots` — how many of `items` actually belong in the sequence (must equal
 *  `answer.order.length`). OMIT it when every item belongs (slots defaults to
 *  items.length); set it lower than items.length to include distractor steps
 *  that stay in the bank, unplaced, forever (mirrors build_sentence). Without
 *  this, a distractor item forces the player to submit items.length entries
 *  while the answer key only has order.length — an unwinnable exercise. */
export const orderSteps = segmentSchema(
  'order_steps',
  z.object({ items: z.array(idVisual).min(3).max(8), slots: z.number().int().min(3).max(8).optional() }),
  z.object({ order: z.array(idSchema).min(3), accept_orders: z.array(z.array(idSchema)).optional() }),
)

export const rankChoices = segmentSchema(
  'rank_choices',
  z.object({
    criterion_md: markdownLite,
    items: z.array(idVisual).min(3).max(7),
  }),
  z.object({ order: z.array(idSchema).min(3), accept_orders: z.array(z.array(idSchema)).optional() }),
)

export const buildSentence = segmentSchema(
  'build_sentence',
  z.object({
    tokens: z.array(idText).min(3).max(12), // distractors ok
    slots: z.number().int().min(2).max(12),
  }),
  z.object({ order: z.array(idSchema).min(2), accept_orders: z.array(z.array(idSchema)).optional() }),
)

export const timelineOrder = segmentSchema(
  'timeline_order',
  z.object({
    events: z
      .array(z.object({ id: idSchema, text_md: markdownLite, icon: iconName.optional(), image_url: imageUrl.optional() }))
      .min(3)
      .max(7),
  }),
  z.object({ order: z.array(idSchema).min(3), accept_orders: z.array(z.array(idSchema)).optional() }),
)

export const patternComplete = segmentSchema(
  'pattern_complete',
  z.object({
    sequence: z.array(z.object({ icon: iconName, image_url: imageUrl.optional(), tint: tileTint })).min(3).max(10),
    options: z.array(z.object({ id: idSchema, icon: iconName, image_url: imageUrl.optional(), tint: tileTint })).min(3).max(5),
    missing_slots: z.number().int().min(1).max(2),
  }),
  z.object({ correct: z.record(z.string().regex(/^\d+$/), idSchema) }),
)

export const groupSets = segmentSchema(
  'group_sets',
  z.object({
    set_a: z.string().min(1).max(60),
    set_b: z.string().min(1).max(60),
    items: z.array(idVisual).min(4).max(12),
  }),
  z.object({ zones: z.record(idSchema, z.enum(['a', 'b', 'both', 'none'])) }),
)

export const numberLine = segmentSchema(
  'number_line',
  z.object({
    min: z.number(),
    max: z.number(),
    ticks: z.number().int().min(2).max(40).optional(),
    labels: z.boolean().optional(),
  }),
  z.object({
    value: z.number(),
    full_credit_delta: z.number().min(0),
    zero_credit_delta: z.number().min(0),
  }),
)

export const arrangeSchemas = [
  matchPairs,
  memoryFlip,
  sortBuckets,
  orderSteps,
  rankChoices,
  buildSentence,
  timelineOrder,
  patternComplete,
  groupSets,
  numberLine,
] as const

export type MatchPairsSegment = z.infer<typeof matchPairs>
export type MemoryFlipSegment = z.infer<typeof memoryFlip>
export type SortBucketsSegment = z.infer<typeof sortBuckets>
export type OrderStepsSegment = z.infer<typeof orderSteps>
export type RankChoicesSegment = z.infer<typeof rankChoices>
export type BuildSentenceSegment = z.infer<typeof buildSentence>
export type TimelineOrderSegment = z.infer<typeof timelineOrder>
export type PatternCompleteSegment = z.infer<typeof patternComplete>
export type GroupSetsSegment = z.infer<typeof groupSets>
export type NumberLineSegment = z.infer<typeof numberLine>
