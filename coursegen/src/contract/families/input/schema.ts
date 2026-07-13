// `input` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.3, types 14–19).

import { z } from 'zod';
import { idSchema, idText, markdownLite, segmentSchema, iconName } from '../../core/schemaBase.js';

const sceneTint = z.enum(['primary', 'accent', 'success', 'warning', 'delight']);

export const typeAnswer = segmentSchema(
  'type_answer',
  z.object({
    placeholder: z.string().min(1).max(80).optional(),
    max_chars: z.number().int().min(1).max(80),
  }),
  z.object({
    accept: z.array(z.string().min(1).max(80)).min(1),
    keywords: z.array(z.string().min(1).max(40)).min(1).optional(),
    case_sensitive: z.boolean().optional(),
  }),
);

export const fillBlank = segmentSchema(
  'fill_blank',
  z
    .object({
      /** MarkdownLite text with {{1}}, {{2}}… gap markers. */
      text_md: markdownLite,
      mode: z.enum(['typed', 'bank']),
      bank: z.array(idText).min(2).max(12).optional(),
    })
    .refine((p) => p.mode !== 'bank' || (p.bank?.length ?? 0) >= 2, {
      message: 'bank mode requires a bank of tokens',
    }),
  z.object({
    gaps: z
      .array(
        z.object({
          gap: z.number().int().min(1),
          accept: z.array(z.string().min(1).max(80)).min(1).optional(),
          bank_id: idSchema.optional(),
        }),
      )
      .min(1),
  }),
);

export const numberInput = segmentSchema(
  'number_input',
  z.object({
    unit: z.string().min(1).max(16).optional(),
    /** Suggested decimal places (enables the pad's decimal key when > 0). */
    decimals_hint: z.number().int().min(0).max(4).optional(),
  }),
  z.object({ value: z.number(), tolerance: z.number().min(0) }),
);

export const estimateSlider = segmentSchema(
  'estimate_slider',
  z.object({
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    unit: z.string().min(1).max(16).optional(),
    scale: z.enum(['linear', 'log']),
  }),
  z.object({
    value: z.number(),
    full_credit_delta: z.number().min(0),
    zero_credit_delta: z.number().positive(),
  }),
);

export const countObjects = segmentSchema(
  'count_objects',
  z.object({
    scene: z
      .array(z.object({ icon: iconName, tint: sceneTint.optional(), count: z.number().int().min(1).max(12) }))
      .min(1)
      .max(6),
    ask_icon: iconName,
  }),
  z.object({ value: z.number().int().min(0) }),
);

export const equationBuilder = segmentSchema(
  'equation_builder',
  z.object({
    /** Number/operator tiles, distractors allowed. */
    tokens: z.array(z.object({ id: idSchema, text: z.string().min(1).max(8) })).min(3).max(12),
    slots: z.number().int().min(2).max(9),
    target_result: z.number(),
  }),
  z.object({ accepted: z.array(z.string().min(1).max(80)).min(1) }),
);

export const inputSchemas = [
  typeAnswer,
  fillBlank,
  numberInput,
  estimateSlider,
  countObjects,
  equationBuilder,
] as const;

export type TypeAnswerSegment = z.infer<typeof typeAnswer>;
export type FillBlankSegment = z.infer<typeof fillBlank>;
export type NumberInputSegment = z.infer<typeof numberInput>;
export type EstimateSliderSegment = z.infer<typeof estimateSlider>;
export type CountObjectsSegment = z.infer<typeof countObjects>;
export type EquationBuilderSegment = z.infer<typeof equationBuilder>;
