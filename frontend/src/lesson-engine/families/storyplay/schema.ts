// `storyplay` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.7, types 46–50).

import { z } from 'zod'
import {
  characterEmotionSchema,
  characterIdSchema,
  iconName,
  idSchema,
  idText,
  markdownLite,
  segmentSchema,
} from '../../core/schemaBase'

const quality = z.number().min(0).max(100)

export const storyBranch = segmentSchema(
  'story_branch',
  z.object({
    start_node: idSchema,
    nodes: z
      .array(
        z.object({
          id: idSchema,
          text_md: markdownLite,
          character: characterIdSchema.optional(),
          emotion: characterEmotionSchema.optional(),
          choices: z
            .array(z.object({ id: idSchema, text_md: markdownLite, next: idSchema.nullable() }))
            .min(1)
            .max(4),
        }),
      )
      .min(2)
      .max(12),
  }),
  z.object({
    qualities: z
      .array(z.object({ node_id: idSchema, choice_id: idSchema, score: quality }))
      .min(1),
  }),
)

// Reply qualities/reactions live ONLY in the answer (server-side) — the client
// must never be able to read scores off the payload (§5.7 #47, security §3).
export const dialogueChoice = segmentSchema(
  'dialogue_choice',
  z.object({
    persona: z.object({
      character: characterIdSchema,
      name: z.string().min(1).max(60).optional(),
      role_md: markdownLite,
    }),
    opening_md: markdownLite,
    turns: z
      .array(
        z.object({
          id: idSchema,
          npc_md: markdownLite,
          replies: z.array(idText).min(2).max(4),
        }),
      )
      .min(2)
      .max(6),
  }),
  z.object({
    turns: z
      .array(
        z.object({
          turn_id: idSchema,
          qualities: z.record(idSchema, quality),
          reactions: z.record(idSchema, markdownLite).optional(),
        }),
      )
      .min(1),
  }),
)

export const flashMatch = segmentSchema(
  'flash_match',
  z.object({
    left: z.array(idText).min(3).max(8),
    right: z.array(idText).min(3).max(8),
    seconds: z.number().int().min(20).max(90),
  }),
  z.object({ pairs: z.array(z.tuple([idSchema, idSchema])).min(1) }),
)

export const lightningRound = segmentSchema(
  'lightning_round',
  z.object({
    questions: z
      .array(
        z.object({
          id: idSchema,
          prompt_md: markdownLite,
          options: z.array(idText).min(2).max(4),
        }),
      )
      .min(3)
      .max(8),
    seconds_per_q: z.number().int().min(5).max(15),
  }),
  z.object({ correct: z.record(idSchema, idSchema) }),
)

export const wouldYouRather = segmentSchema(
  'would_you_rather',
  z.object({
    a: z.object({ text_md: markdownLite, icon: iconName.optional() }),
    b: z.object({ text_md: markdownLite, icon: iconName.optional() }),
    followup_md: markdownLite.optional(),
  }),
  z.object({
    qualities: z.object({ a: quality, b: quality }),
    // ALWAYS present: both sides can be valid — the reveal teaches opportunity cost.
    reveal_md: markdownLite,
  }),
)

export const storyplaySchemas = [
  storyBranch,
  dialogueChoice,
  flashMatch,
  lightningRound,
  wouldYouRather,
] as const

export type StoryBranchSegment = z.infer<typeof storyBranch>
export type DialogueChoiceSegment = z.infer<typeof dialogueChoice>
export type FlashMatchSegment = z.infer<typeof flashMatch>
export type LightningRoundSegment = z.infer<typeof lightningRound>
export type WouldYouRatherSegment = z.infer<typeof wouldYouRather>
