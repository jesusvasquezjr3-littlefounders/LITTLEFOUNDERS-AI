import { z } from 'zod';
import { answerShapeSample, V2_ANSWER_SHAPE_LIMITS, V2_CURVE_FAMILIES, type ShapeGrade, type V2AnswerShapeId } from './v2AnswerShapes.js';
import type { V2Grade } from './v2VisualScorer.js';

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const decimalText = z.string().regex(/^(-?(0|[1-9]\d{0,14})(\.\d{1,12})?|-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14})$/);
const tolerance = z.object({ absolute: decimalText.optional(), relative_bps: z.number().int().min(0).max(10_000).optional() }).strict();
const coordinate = z.number().min(-V2_ANSWER_SHAPE_LIMITS.coordinateMagnitude).max(V2_ANSWER_SHAPE_LIMITS.coordinateMagnitude);
const point = z.object({ x: coordinate, y: coordinate }).strict();
const parameterName = z.string().regex(/^[mabc]$/);
const slotMap = z.record(id, z.array(id).max(V2_ANSWER_SHAPE_LIMITS.maxCapacity));

function hasOwnProtoKey(value: unknown, depth: number): boolean {
  if (typeof value !== 'object' || value === null || depth > 8) return false;
  if (Array.isArray(value)) return value.some((item) => hasOwnProtoKey(item, depth + 1));
  return Object.keys(value).some((key) => key === '__proto__' || hasOwnProtoKey((value as Record<string, unknown>)[key], depth + 1));
}

function withoutProtoKeys(schema: z.ZodType): z.ZodType {
  return z.unknown().superRefine((value, ctx) => {
    if (hasOwnProtoKey(value, 0)) ctx.addIssue({ code: 'custom', message: 'Reserved keys are not allowed' });
  }).pipe(schema);
}

const shapeResponseSchemas: Record<V2AnswerShapeId, z.ZodType> = {
  'number.tolerance': z.object({ value: decimalText }).strict(),
  'points.set': z.object({ points: z.array(point).min(1).max(V2_ANSWER_SHAPE_LIMITS.maxPoints) }).strict(),
  'curve.parameters': z.object({ family: z.enum(V2_CURVE_FAMILIES), params: z.record(parameterName, decimalText) }).strict(),
  'arrangement.slots': z.object({ slots: slotMap }).strict(),
};

const shapeRubricSchemas: Record<V2AnswerShapeId, z.ZodType> = {
  'number.tolerance': z.object({ target: decimalText, tolerance: tolerance.optional(), review: tolerance.optional() }).strict(),
  'points.set': z.object({
    required: z.array(point).min(1).max(V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints),
    forbidden: z.array(point).max(V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints).optional(),
    snap: z.number().min(0).max(V2_ANSWER_SHAPE_LIMITS.maxSnap).optional(),
    extra: z.enum(['forbid', 'allow']).optional(),
  }).strict(),
  'curve.parameters': z.object({
    family: z.enum(V2_CURVE_FAMILIES), target: z.record(parameterName, decimalText), by: z.enum(['parameters', 'curve', 'either', 'both']).optional(),
    parameter_tolerance: tolerance.optional(), parameter_review: tolerance.optional(),
    samples: z.array(z.number().int().min(-V2_ANSWER_SHAPE_LIMITS.sampleMagnitude).max(V2_ANSWER_SHAPE_LIMITS.sampleMagnitude)).min(2).max(V2_ANSWER_SHAPE_LIMITS.curveSamples).optional(),
    curve_tolerance: tolerance.optional(), curve_review: tolerance.optional(),
  }).strict(),
  'arrangement.slots': z.object({ solutions: z.array(slotMap).min(1).max(V2_ANSWER_SHAPE_LIMITS.maxSolutions), ordered: z.boolean().optional() }).strict(),
};

const guard = (schemas: Record<V2AnswerShapeId, z.ZodType>): Record<V2AnswerShapeId, z.ZodType> => ({
  'number.tolerance': withoutProtoKeys(schemas['number.tolerance']),
  'points.set': withoutProtoKeys(schemas['points.set']),
  'curve.parameters': withoutProtoKeys(schemas['curve.parameters']),
  'arrangement.slots': withoutProtoKeys(schemas['arrangement.slots']),
});

export const answerShapeResponseSchemas = guard(shapeResponseSchemas);
export const answerShapeRubricSchemas = guard(shapeRubricSchemas);

export function answerShapeRubric(shape: V2AnswerShapeId, context?: unknown): z.ZodType {
  return answerShapeRubricSchemas[shape].superRefine((value, ctx) => {
    if (answerShapeSample(shape, value, context) === null) ctx.addIssue({ code: 'custom', message: 'The rubric does not satisfy the answer shape contract' });
  });
}

export const shapeGradeAsV2Grade = (grade: ShapeGrade): V2Grade => grade;
