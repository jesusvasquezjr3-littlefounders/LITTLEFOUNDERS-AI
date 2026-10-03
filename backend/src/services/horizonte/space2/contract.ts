import { z } from 'zod';
import { hzBase, hzServer, hzUngraded, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import { AR_OBJECT_IDS, readArPayload } from './ar.js';
import { FORMULA_LIMITS, formulaProblem, readFormulaPayload } from './field.js';
import { GLOBE_ASKS, GLOBE_LIMITS, PLACE_IDS, ROUTE_IDS, globeProblem, readGlobePayload } from './globe.js';
import { SURFACE_LIMITS, SURFACE_OPTION_IDS, readSurfacePayload, surfaceProblem } from './surface.js';

const whole = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);
const ascending = (count: { min: number; max: number }, low: number, high: number) => z.array(whole(low, high)).min(count.min).max(count.max)
  .refine((list) => list.every((entry, index) => index === 0 || entry > list[index - 1]!), 'Values must rise');

const compoundSurface = z.object({
  kind: z.literal('compound'),
  principalCents: whole(SURFACE_LIMITS.principalCents.min, SURFACE_LIMITS.principalCents.max),
  ratesBps: ascending(SURFACE_LIMITS.xCount, 0, SURFACE_LIMITS.rateBps),
  terms: ascending(SURFACE_LIMITS.yCount, 0, SURFACE_LIMITS.termYears),
}).strict();

const profitSurface = z.object({
  kind: z.literal('profit'),
  unitCostCents: whole(1, SURFACE_LIMITS.unitCostCents),
  fixedCents: whole(0, SURFACE_LIMITS.fixedCents),
  prices: ascending(SURFACE_LIMITS.xCount, 1, SURFACE_LIMITS.priceCents),
  units: ascending(SURFACE_LIMITS.yCount, 0, SURFACE_LIMITS.units),
}).strict();

const surfaceAsk = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('highest') }).strict(),
  z.object({ kind: z.literal('lowest') }).strict(),
  z.object({ kind: z.literal('reach'), targetCents: whole(-SURFACE_LIMITS.targetCents, SURFACE_LIMITS.targetCents) }).strict(),
]);

/** F4.7: a surface of two inputs and one output (compound interest or profit); the learner reads it and picks the option the question asks for. */
export const surfacePayload = z.object({
  surface: z.discriminatedUnion('kind', [compoundSurface, profitSurface]),
  ask: surfaceAsk,
  options: z.array(z.object({ id: z.enum(SURFACE_OPTION_IDS), x: whole(0, SURFACE_LIMITS.xCount.max - 1), y: whole(0, SURFACE_LIMITS.yCount.max - 1) }).strict())
    .min(SURFACE_LIMITS.options.min).max(SURFACE_LIMITS.options.max),
}).strict();

const cell = z.object({ x: whole(-FORMULA_LIMITS.coordinate, FORMULA_LIMITS.coordinate), y: whole(-FORMULA_LIMITS.coordinate, FORMULA_LIMITS.coordinate) }).strict();
const expression = z.string().min(1).max(FORMULA_LIMITS.maxChars);
const edge = whole(-FORMULA_LIMITS.coordinate, FORMULA_LIMITS.coordinate);

/**
 * F4.7 (fix round): a free-form surface z = f(x, y). The author types the formula (or, for a build, the learner does); it is read
 * by a bounded pure parser, never evaluated as code. A task asks for a slope, a gradient, the length of a gradient-descent walk,
 * or a formula through given points.
 */
export const formulaPayload = z.object({
  window: z.object({ xMin: edge, xMax: edge, yMin: edge, yMax: edge }).strict(),
  task: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('slope'), expression, axis: z.enum(['x', 'y']), at: cell }).strict(),
    z.object({ kind: z.literal('gradient'), expression, at: cell }).strict(),
    z.object({
      kind: z.literal('walk'), expression, at: cell, rate: z.object({ n: whole(1, FORMULA_LIMITS.rateNumerator), d: whole(1, FORMULA_LIMITS.rateDenominator) }).strict(),
      below: whole(-FORMULA_LIMITS.heightAbs, FORMULA_LIMITS.heightAbs), maxSteps: whole(FORMULA_LIMITS.minSteps, FORMULA_LIMITS.maxSteps),
    }).strict(),
    z.object({
      kind: z.literal('build'),
      through: z.array(z.object({ x: edge, y: edge, z: whole(-FORMULA_LIMITS.heightAbs, FORMULA_LIMITS.heightAbs) }).strict()).min(FORMULA_LIMITS.through.min).max(FORMULA_LIMITS.through.max),
    }).strict(),
  ]),
}).strict();

const placeId = z.enum(PLACE_IDS as [string, ...string[]]);

/** F4.8: routes between named places on a globe, each with a fee; the learner picks the shortest, the longest or the cheapest. */
export const globePayload = z.object({
  routes: z.array(z.object({
    id: z.enum(ROUTE_IDS), from: placeId, to: placeId, feeBps: whole(0, GLOBE_LIMITS.feeBps), flatCents: whole(0, GLOBE_LIMITS.flatCents),
  }).strict()).min(GLOBE_LIMITS.routes.min).max(GLOBE_LIMITS.routes.max),
  ask: z.enum(GLOBE_ASKS),
  sendCents: whole(GLOBE_LIMITS.sendCents.min, GLOBE_LIMITS.sendCents.max),
}).strict();

/** F4.9: one real object shown at its true size; there is no question and no answer. */
export const arPayload = z.object({ object: z.enum(AR_OBJECT_IDS as [string, ...string[]]) }).strict();

const complain = (ctx: z.RefinementCtx, message: string) => ctx.addIssue({ code: 'custom', path: ['payload'], message });

export const SPACE2_SEGMENTS = [
  z.object({
    ...hzBase, type: z.literal('math.surface.v2'), grading: hzServer, visual: hzVisual('surface'), payload: surfacePayload,
  }).strict().superRefine((value, ctx) => {
    const payload = readSurfacePayload(value.payload);
    const problem = payload ? surfaceProblem(payload) : 'The surface payload is malformed';
    if (problem) complain(ctx, problem);
  }),
  z.object({
    ...hzBase, type: z.literal('geography.globe-route.v2'), grading: hzServer, visual: hzVisual('globe-route'), payload: globePayload,
  }).strict().superRefine((value, ctx) => {
    const payload = readGlobePayload(value.payload);
    const problem = payload ? globeProblem(payload) : 'The globe payload is malformed';
    if (problem) complain(ctx, problem);
  }),
  z.object({
    ...hzBase, type: z.literal('math.surface-formula.v2'), grading: hzServer, visual: hzVisual('surface-formula'), payload: formulaPayload,
  }).strict().superRefine((value, ctx) => {
    const payload = readFormulaPayload(value.payload);
    const problem = payload ? formulaProblem(payload) : 'The formula payload is malformed';
    if (problem) complain(ctx, problem);
  }),
  z.object({
    ...hzBase, type: z.literal('space.ar-table.v2'), grading: hzUngraded, visual: hzVisual('ar-table'), payload: arPayload,
  }).strict().superRefine((value, ctx) => {
    if (!readArPayload(value.payload)) complain(ctx, 'The AR payload is malformed');
  }),
] as const;

/** Only the graded kinds carry a rubric; the AR step is not scored and has no key. */
export const SPACE2_RUBRICS = {
  'math.surface.v2': z.object({ choice: z.enum(SURFACE_OPTION_IDS) }).strict(),
  'geography.globe-route.v2': z.object({ choice: z.enum(ROUTE_IDS) }).strict(),
  /** A slope, gradient or walk keeps its exact answers as text; a build keeps one reference formula that passes through every point (proof the task is solvable). */
  'math.surface-formula.v2': z.union([
    z.object({ key: z.array(z.string().min(1).max(FORMULA_LIMITS.maxNumberChars)).min(1).max(2) }).strict(),
    z.object({ reference: z.string().min(1).max(FORMULA_LIMITS.maxChars) }).strict(),
  ]),
} as const;

export const SPACE2_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  'math.surface.v2': { ages: [15, 17], adult: true },
  'geography.globe-route.v2': { ages: [12, 17], adult: true },
  'math.surface-formula.v2': { ages: [15, 17], adult: true },
  'space.ar-table.v2': { ages: [13, 17], adult: true },
};
