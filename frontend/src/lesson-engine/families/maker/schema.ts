// `maker` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.8, types 51–56).

import { z } from 'zod'
import { idSchema, idText, markdownLite, segmentSchema } from '../../core/schemaBase'

export const robotDirSchema = z.enum(['up', 'right', 'down', 'left'])
export const robotCommandSchema = z.enum(['forward', 'left', 'right'])

const gridCoord = z.number().int().min(0).max(5)

export const codeOrder = segmentSchema(
  'code_order',
  z.object({
    blocks: z.array(idText).min(3).max(8),
    language_hint: z.string().min(1).max(40).optional(),
  }),
  z.object({ order: z.array(idSchema).min(3).max(8), accept_orders: z.array(z.array(idSchema)).optional() }),
)

export const robotPath = segmentSchema(
  'robot_path',
  z.object({
    grid: z.object({ w: z.number().int().min(3).max(6), h: z.number().int().min(3).max(6) }),
    start: z.object({ x: gridCoord, y: gridCoord, dir: robotDirSchema }),
    goal: z.object({ x: gridCoord, y: gridCoord }),
    walls: z.array(z.object({ x: gridCoord, y: gridCoord })).optional(),
    commands: z.array(robotCommandSchema).min(1).max(3),
    max_commands: z.number().int().min(1).max(20),
  }),
  // Simulated: the grader re-runs the submitted program against the payload.
  z.object({}),
)

export const debugHunt = segmentSchema(
  'debug_hunt',
  z.object({
    intro_md: markdownLite,
    blocks: z.array(idText).min(3).max(8),
  }),
  z.object({ bug_ids: z.array(idSchema).min(1), fix_md: markdownLite.optional() }),
)

export const balanceScale = segmentSchema(
  'balance_scale',
  z.object({
    left_fixed: z.array(z.object({ label: z.string().min(1).max(60), value: z.number() })).min(1).max(4),
    weights: z
      .array(z.object({ id: idSchema, label: z.string().min(1).max(60), value: z.number() }))
      .min(3)
      .max(8),
    unknown_label: z.string().min(1).max(60).optional(),
  }),
  // State check: the grader recomputes both pan sums from the payload.
  z.object({}),
)

export const measureRead = segmentSchema(
  'measure_read',
  z.object({
    instrument: z.enum(['ruler', 'thermometer', 'gauge', 'beaker']),
    min: z.number(),
    max: z.number(),
    ticks: z.number().int().min(2).max(20),
    unit: z.string().min(1).max(12),
    pointer_value: z.number(),
  }),
  z.object({ value: z.number(), tolerance: z.number().min(0) }),
)

const ioValue = z.union([z.number(), z.string().min(1).max(40)])

export const machineIo = segmentSchema(
  'machine_io',
  z.object({
    examples: z.array(z.object({ in: ioValue, out: ioValue })).min(2).max(4),
    probe_in: ioValue,
    options: z.array(idText).min(2).max(6).optional(),
  }),
  z.object({ value: z.number().optional(), correct_option_id: idSchema.optional() }),
)

export const makerSchemas = [
  codeOrder,
  robotPath,
  debugHunt,
  balanceScale,
  measureRead,
  machineIo,
] as const

export type CodeOrderSegment = z.infer<typeof codeOrder>
export type RobotPathSegment = z.infer<typeof robotPath>
export type DebugHuntSegment = z.infer<typeof debugHunt>
export type BalanceScaleSegment = z.infer<typeof balanceScale>
export type MeasureReadSegment = z.infer<typeof measureRead>
export type MachineIoSegment = z.infer<typeof machineIo>
