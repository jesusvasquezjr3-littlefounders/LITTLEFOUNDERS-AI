// Zod building blocks for the lesson document — LESSON_ENGINE.md §3.
// Families build their segment schemas with segmentSchema(); the top-level
// composition (all 56 types) lives in lesson-engine/schema.ts.

import { z } from 'zod'
import { LESSON_LOCALES, LESSON_SUBJECTS } from './types'

export const idSchema = z.string().min(1).max(64)

export const markdownLite = z.string().min(1).max(4000)

export const idText = z.object({ id: idSchema, text_md: markdownLite })
export const idLabel = z.object({ id: idSchema, label: z.string().min(1).max(120) })

/** Option with the P7 rule: wrong options MUST carry a teaching rationale.
 *  Enforced at the document level where the correct id is known. */
export const optionWithRationale = z.object({
  id: idSchema,
  text_md: markdownLite,
  rationale_md: markdownLite.optional(),
})

export const characterIdSchema = z.enum(['dina', 'liruf', 'rho', 'zara'])
export const characterEmotionSchema = z.enum([
  'neutral',
  'happy',
  'excited',
  'thinking',
  'surprised',
  'encouraging',
  'proud',
])
export const characterActionSchema = z.enum([
  'idle',
  'jump',
  'hop',
  'wave',
  'point',
  'celebrate',
  'nod',
  'shake',
  'think',
  'dance',
  'peek',
  'bow',
])

/** Material Symbols icon name (content data may reference icons; rendered via <Icon>). */
export const iconName = z.string().regex(/^[a-z0-9_]+$/)

const envelopeShape = {
  id: idSchema,
  title: z.string().min(1).max(120).optional(),
  prompt_md: markdownLite,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  xp: z.number().int().min(0).max(50),
  hints: z.array(z.string().min(1).max(300)).max(2).optional(),
  explanation_md: markdownLite.optional(),
  narrator: z
    .object({ character: characterIdSchema, emotion: characterEmotionSchema.optional() })
    .optional(),
  audio_segment_id: z.string().optional(),
}

/** Factory for one segment type. Content types pass no answer schema. */
export function segmentSchema<T extends string, P extends z.ZodTypeAny, A extends z.ZodTypeAny>(
  type: T,
  payload: P,
  answer?: A,
) {
  return z.object({
    ...envelopeShape,
    type: z.literal(type),
    payload,
    ...(answer ? { answer: answer.optional() } : {}),
  })
}

export const lessonMetaSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().min(1).max(160),
  locale: z.enum(LESSON_LOCALES),
  subject: z.enum(LESSON_SUBJECTS),
  estimated_minutes: z.number().int().min(1).max(30),
  objectives: z.array(z.string().min(1).max(200)).min(1).max(6),
  cast: z.array(characterIdSchema).min(1).max(4),
})

export const lessonScoringSchema = z.object({
  pass_threshold: z.number().int().min(1).max(100).default(70),
  hint_penalty_pct: z.number().int().min(0).max(50).default(10),
  max_attempts: z.number().int().min(1).max(3).default(2),
  hearts: z.number().int().min(1).max(5).nullable().default(null),
})
