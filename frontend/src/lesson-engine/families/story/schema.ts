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

/** Highlight spans inside eavesdrop line text: `==término==`. */
export const EAVESDROP_HIGHLIGHT = /==([^=\n]+)==/g

/**
 * `eavesdrop` — an overheard conversation between canon characters, revealed
 * turn by turn, where highlighted money terms/idioms carry tap-to-explain
 * notes (LESSON_ENGINE.md §5.1, type 57). The whole artifact is generated in
 * ONE pass and gated BEFORE the kid sees turn one — the "live conversation"
 * feel with zero ungated runtime AI (Little Language Lessons' progressive
 * reveal, 2026-07-25 analysis).
 *
 * Highlights are `==término==` markers INSIDE text_md — one string, so
 * localization can never drift a term apart from its sentence — and `notes`
 * attach BY ORDER to the nth highlight of the line. The refinement pins
 * that count invariant on every locale's document (gate 1 re-validates
 * localized output).
 */
export const eavesdrop = segmentSchema(
  'eavesdrop',
  z
    .object({
      /** Scene setting ("Dina y Liruf cuentan la caja al cerrar…") — shown and narrated before line 1. */
      context_md: markdownLite,
      lines: z
        .array(
          z.object({
            character: characterIdSchema,
            emotion: characterEmotionSchema.optional(),
            text_md: markdownLite,
            /** Tap-to-explain note per ==highlight==, in order of appearance. */
            notes: z.array(markdownLite).max(3).optional(),
          }),
        )
        .min(2)
        .max(10),
    })
    .superRefine((payload, ctx) => {
      payload.lines.forEach((line, i) => {
        const highlights = [...line.text_md.matchAll(EAVESDROP_HIGHLIGHT)].length
        const notes = line.notes?.length ?? 0
        if (highlights !== notes) {
          ctx.addIssue({
            code: 'custom',
            path: ['lines', i, 'notes'],
            message: `line has ${highlights} ==highlight== span(s) but ${notes} note(s) — every highlighted term needs exactly one tap-to-explain note, in order`,
          })
        }
      })
    }),
)

export const storySchemas = [
  storyDialogue,
  storyScene,
  keyIdeas,
  conceptReveal,
  checkpoint,
  eavesdrop,
] as const

export type StoryDialogueSegment = z.infer<typeof storyDialogue>
export type StorySceneSegment = z.infer<typeof storyScene>
export type KeyIdeasSegment = z.infer<typeof keyIdeas>
export type ConceptRevealSegment = z.infer<typeof conceptReveal>
export type CheckpointSegment = z.infer<typeof checkpoint>
export type EavesdropSegment = z.infer<typeof eavesdrop>
