// `analyze` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.6, types 39–45).

import { z } from 'zod'
import { idSchema, idText, idLabel, markdownLite, segmentSchema } from '../../core/schemaBase.js'

export const spotError = segmentSchema(
  'spot_error',
  z.object({
    context_md: markdownLite.optional(),
    steps: z.array(idText).min(3).max(10),
  }),
  z.object({ error_ids: z.array(idSchema).min(1), correction_md: markdownLite.optional() }),
)

export const causeEffect = segmentSchema(
  'cause_effect',
  z.object({
    events: z.array(idText).min(4).max(9),
    slots: z.number().int().min(3).max(6),
  }),
  z.object({ chain: z.array(idSchema).min(3).max(6) }),
)

export const compareTable = segmentSchema(
  'compare_table',
  z.object({
    rows: z.array(idLabel).min(2).max(4),
    cols: z.array(idLabel).min(2).max(3),
    tokens: z.array(idText).min(2).max(12),
  }),
  // Cell keys are `"rowId:colId"`.
  z.object({ cells: z.record(z.string().min(3), idSchema) }),
)

export const readChart = segmentSchema(
  'read_chart',
  z.object({
    chart: z.object({
      kind: z.enum(['bar', 'line', 'pie']),
      series: z
        .array(
          z.object({
            label: z.string().min(1).max(60),
            points: z
              .array(z.object({ x: z.union([z.string().max(24), z.number()]), y: z.number() }))
              .min(1)
              .max(12),
          }),
        )
        .min(1)
        .max(3),
      unit: z.string().max(12).optional(),
    }),
    questions: z
      .array(z.object({ id: idSchema, prompt_md: markdownLite, options: z.array(idText).min(2).max(5) }))
      .min(1)
      .max(3),
  }),
  z.object({ correct: z.record(idSchema, idSchema) }),
)

export const evidenceHunt = segmentSchema(
  'evidence_hunt',
  z.object({
    claim_md: markdownLite,
    sentences: z.array(idText).min(3).max(12),
  }),
  z.object({ evidence_ids: z.array(idSchema).min(1) }),
)

export const redFlags = segmentSchema(
  'red_flags',
  z.object({
    artifact_md: markdownLite,
    artifact_kind: z.enum(['ad', 'message', 'deal', 'website']),
    flags: z.array(idText).min(4).max(10),
  }),
  z.object({ redflag_ids: z.array(idSchema).min(1) }),
)

export const factOpinion = segmentSchema(
  'fact_opinion',
  z.object({
    statements: z.array(idText).min(3).max(8),
  }),
  // Every statement NOT in fact_ids is an opinion.
  z.object({ fact_ids: z.array(idSchema) }),
)

export const analyzeSchemas = [
  spotError,
  causeEffect,
  compareTable,
  readChart,
  evidenceHunt,
  redFlags,
  factOpinion,
] as const

export type SpotErrorSegment = z.infer<typeof spotError>
export type CauseEffectSegment = z.infer<typeof causeEffect>
export type CompareTableSegment = z.infer<typeof compareTable>
export type ReadChartSegment = z.infer<typeof readChart>
export type EvidenceHuntSegment = z.infer<typeof evidenceHunt>
export type RedFlagsSegment = z.infer<typeof redFlags>
export type FactOpinionSegment = z.infer<typeof factOpinion>
