// `choice` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.2, types 6–13).

import { z } from 'zod'
import {
  idSchema,
  idText,
  idVisual,
  markdownLite,
  optionWithRationale,
  segmentSchema,
  iconName,
} from '../../core/schemaBase.js'

export const quizMcq = segmentSchema(
  'quiz_mcq',
  z.object({
    options: z.array(optionWithRationale).min(2).max(6),
    shuffle: z.boolean().optional(),
  }),
  z.object({ correct_option_id: idSchema }),
)

export const trueFalse = segmentSchema(
  'true_false',
  z.object({
    statement_md: markdownLite,
    justifications: z.array(idText).min(2).max(4).optional(),
  }),
  z.object({ is_true: z.boolean(), correct_justification_id: idSchema.optional() }),
)

export const pictureChoice = segmentSchema(
  'picture_choice',
  z.object({
    options: z
      .array(
        z.object({
          id: idSchema,
          icon: iconName,
          /** Generated illustration (Forge image pipeline) — preferred over icon when present. */
          image_url: z.string().url().optional(),
          label: z.string().min(1).max(60),
          rationale_md: markdownLite.optional(),
        }),
      )
      .min(2)
      .max(6),
  }),
  z.object({ correct_option_id: idSchema }),
)

export const oddOneOut = segmentSchema(
  'odd_one_out',
  z.object({
    items: z.array(idVisual).min(3).max(6),
    reasons: z.array(idText).min(2).max(4).optional(),
  }),
  z.object({ odd_item_id: idSchema, correct_reason_id: idSchema.optional() }),
)

export const bestDecision = segmentSchema(
  'best_decision',
  z.object({
    scenario_md: markdownLite,
    options: z
      .array(z.object({ id: idSchema, text_md: markdownLite, rationale_md: markdownLite }))
      .min(2)
      .max(4),
  }),
  z.object({ qualities: z.record(idSchema, z.number().min(0).max(100)) }),
)

export const yesNoCases = segmentSchema(
  'yes_no_cases',
  z.object({
    rule_md: markdownLite,
    cases: z.array(idVisual).min(3).max(8),
  }),
  z.object({ applies_ids: z.array(idSchema) }),
)

export const speedTap = segmentSchema(
  'speed_tap',
  z.object({
    instruction_md: markdownLite,
    items: z.array(idVisual).min(6).max(14),
    seconds: z.number().int().min(10).max(45),
  }),
  z.object({ target_ids: z.array(idSchema).min(1) }),
)

export const confidenceQuiz = segmentSchema(
  'confidence_quiz',
  z.object({
    options: z.array(optionWithRationale).min(2).max(5),
  }),
  z.object({ correct_option_id: idSchema }),
)

export const choiceSchemas = [
  quizMcq,
  trueFalse,
  pictureChoice,
  oddOneOut,
  bestDecision,
  yesNoCases,
  speedTap,
  confidenceQuiz,
] as const

export type QuizMcqSegment = z.infer<typeof quizMcq>
export type TrueFalseSegment = z.infer<typeof trueFalse>
export type PictureChoiceSegment = z.infer<typeof pictureChoice>
export type OddOneOutSegment = z.infer<typeof oddOneOut>
export type BestDecisionSegment = z.infer<typeof bestDecision>
export type YesNoCasesSegment = z.infer<typeof yesNoCases>
export type SpeedTapSegment = z.infer<typeof speedTap>
export type ConfidenceQuizSegment = z.infer<typeof confidenceQuiz>
