// `story` family — payload Zod schemas (LESSON_ENGINE.md §5.1, types 1–5).
// Content types carry NO answer schema: they are ungraded, ship with `xp: 0`
// and always count as complete on advance (§3).

import { z } from 'zod'
import {
  characterActionSchema,
  characterEmotionSchema,
  characterIdSchema,
  iconName,
  imageUrl,
  markdownLite,
  segmentSchema,
} from '../../core/schemaBase'

/** Icon tint vocabulary — mirrors BigIconTile's tint prop (core/primitives). */
const artTint = z.enum(['primary', 'accent', 'success', 'warning', 'delight'])

export const storyDialogue = segmentSchema(
  'story_dialogue',
  z.object({
    lines: z
      .array(
        z.object({
          character: characterIdSchema,
          emotion: characterEmotionSchema.optional(),
          action: characterActionSchema.optional(),
          text_md: markdownLite,
        }),
      )
      .min(1)
      .max(12),
  }),
)

export const storyScene = segmentSchema(
  'story_scene',
  z.object({
    backdrop: z.enum(['band', 'inverse', 'base']),
    character: characterIdSchema.optional(),
    emotion: characterEmotionSchema.optional(),
    action: characterActionSchema.optional(),
    body_md: markdownLite,
    art: z.object({ icon: iconName, image_url: imageUrl.optional(), tint: artTint }).optional(),
  }),
)

export const keyIdeas = segmentSchema(
  'key_ideas',
  z.object({
    ideas: z
      .array(
        z.object({
          icon: iconName,
          image_url: imageUrl.optional(),
          title: z.string().min(1).max(80),
          body_md: markdownLite,
        }),
      )
      .min(2)
      .max(5),
  }),
)

export const conceptReveal = segmentSchema(
  'concept_reveal',
  z.object({
    cards: z
      .array(
        z.object({
          front_md: markdownLite,
          back_md: markdownLite,
          icon: iconName.optional(),
          image_url: imageUrl.optional(),
        }),
      )
      .min(2)
      .max(6),
  }),
)

export const checkpoint = segmentSchema(
  'checkpoint',
  z.object({
    recap_md: markdownLite,
    mood_prompt_md: markdownLite.optional(),
  }),
)

export const storySchemas = [
  storyDialogue,
  storyScene,
  keyIdeas,
  conceptReveal,
  checkpoint,
] as const

export type StoryDialogueSegment = z.infer<typeof storyDialogue>
export type StorySceneSegment = z.infer<typeof storyScene>
export type KeyIdeasSegment = z.infer<typeof keyIdeas>
export type ConceptRevealSegment = z.infer<typeof conceptReveal>
export type CheckpointSegment = z.infer<typeof checkpoint>
