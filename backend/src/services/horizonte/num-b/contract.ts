import { z } from 'zod';
import { hzBase, hzServer, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import { ARRAY_MAX_SIDE, AREA_SIDE_MAX, DIVISOR_MAX, payloadProblem } from './arrayAreaModel.js';
import { FRACTION_PART_MAX, fractionPayloadProblem } from './fractionWallModel.js';
import { RATIO_UNITS, RATIO_VALUE_MAX, ratioPayloadProblem } from './ratioLineModel.js';

const side = (max: number) => z.number().int().min(1).max(max);
const fraction = z.tuple([z.number().int().min(1).max(11), z.number().int().min(2).max(12)]);
const unit = z.enum(RATIO_UNITS);

/** F1.4: a rows-by-columns array, a multiplication box split into two partial products, or a missing-area rectangle for division. The payload carries only the public numbers, never the answer. */
export const arrayAreaPayload = z.union([
  z.object({ rows: side(ARRAY_MAX_SIDE), columns: side(ARRAY_MAX_SIDE) }).strict(),
  z.object({ across: side(AREA_SIDE_MAX), down: side(AREA_SIDE_MAX) }).strict(),
  z.object({ dividend: side(DIVISOR_MAX * AREA_SIDE_MAX), divisor: side(DIVISOR_MAX) }).strict(),
]);

/** F1.5: a double number line with one value given, or a two-part ratio tape sharing a whole. Units are a closed set, so the payload is the same in every language. */
export const ratioLinePayload = z.union([
  z.object({ units: z.tuple([unit, unit]), base: z.tuple([side(12), side(12)]), given: z.object({ line: z.enum(['top', 'bottom']), value: side(RATIO_VALUE_MAX) }).strict() }).strict(),
  z.object({ unit, parts: z.tuple([side(9), side(9)]), whole: side(RATIO_VALUE_MAX), ask: z.enum(['a', 'b']) }).strict(),
]);

/** F1.6: an equivalent fraction on the wall, a sum or difference on bars, a product on a grid, or a measuring quotient. */
export const fractionWallPayload = z.union([
  z.object({ op: z.literal('equivalent'), fraction, denominator: z.number().int().min(2).max(12) }).strict(),
  z.object({ op: z.enum(['add', 'subtract', 'multiply', 'divide']), left: fraction, right: fraction }).strict(),
]);

export const NUM_B_SEGMENTS = [
  z.object({
    ...hzBase, type: z.literal('math.array-area.v2'), grading: hzServer,
    visual: z.union([hzVisual('array'), hzVisual('area-model'), hzVisual('area-division')]), payload: arrayAreaPayload,
  }).strict().superRefine((value, ctx) => {
    const problem = payloadProblem(value.visual.type, value.payload);
    if (problem) ctx.addIssue({ code: 'custom', path: ['visual'], message: problem });
  }),
  z.object({
    ...hzBase, type: z.literal('math.ratio-line.v2'), grading: hzServer,
    visual: z.union([hzVisual('double-number-line'), hzVisual('ratio-tape')]), payload: ratioLinePayload,
  }).strict().superRefine((value, ctx) => {
    const problem = ratioPayloadProblem(value.visual.type, value.payload);
    if (problem) ctx.addIssue({ code: 'custom', path: ['visual'], message: problem });
  }),
  z.object({
    ...hzBase, type: z.literal('math.fraction-wall.v2'), grading: hzServer,
    visual: z.union([hzVisual('fraction-wall'), hzVisual('fraction-bars'), hzVisual('fraction-product'), hzVisual('fraction-measure')]), payload: fractionWallPayload,
  }).strict().superRefine((value, ctx) => {
    const problem = fractionPayloadProblem(value.visual.type, value.payload);
    if (problem) ctx.addIssue({ code: 'custom', path: ['visual'], message: problem });
  }),
] as const;

export const NUM_B_RUBRICS = {
  'math.array-area.v2': z.object({ value: z.number().int().min(1).max(AREA_SIDE_MAX * AREA_SIDE_MAX) }).strict(),
  'math.ratio-line.v2': z.object({ value: z.number().int().min(1).max(RATIO_VALUE_MAX) }).strict(),
  'math.fraction-wall.v2': z.object({ n: z.number().int().min(1).max(FRACTION_PART_MAX), d: z.number().int().min(1).max(FRACTION_PART_MAX) }).strict(),
} as const;

export const NUM_B_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  'math.array-area.v2': { ages: [8, 12], adult: false },
  'math.ratio-line.v2': { ages: [10, 12], adult: false },
  'math.fraction-wall.v2': { ages: [8, 12], adult: false },
};
