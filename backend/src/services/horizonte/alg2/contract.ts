import { z } from 'zod';
import { hzBase, hzServer, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import { EXPRESSION_LIMITS, expressionTaskProblem, type ExpressionTask } from './expression.js';
import { GRAPH_FAMILIES, GRAPH_LIMITS, SYSTEM_LIMITS, graphPayloadProblem, systemPayloadProblem } from './model.js';

const windowNumber = (magnitude: number) => z.number().int().min(-magnitude).max(magnitude);
const sliderText = z.string().max(12);

/** D14, D27, D12, T01: sliders for the parameters of a line, a parabola or an exponential, and a window to read the curve in. The key stays in the rubric. */
export const functionGraphPayload = z.object({
  curve: z.enum(GRAPH_FAMILIES),
  form: z.enum(['standard', 'vertex']).optional(),
  start: z.record(z.string().max(2), sliderText),
  sliders: z.record(z.string().max(2), z.object({ min: sliderText, max: sliderText, step: sliderText }).strict()),
  window: z.object({
    xMin: windowNumber(GRAPH_LIMITS.windowMagnitude), xMax: windowNumber(GRAPH_LIMITS.windowMagnitude),
    yMin: windowNumber(GRAPH_LIMITS.windowMagnitude), yMax: windowNumber(GRAPH_LIMITS.windowMagnitude),
  }).strict(),
  marks: z.array(z.object({ x: windowNumber(GRAPH_LIMITS.windowMagnitude), y: windowNumber(GRAPH_LIMITS.windowMagnitude) }).strict()).max(GRAPH_LIMITS.maxMarks).optional(),
}).strict();

const systemNumber = (magnitude: number) => z.number().int().min(-magnitude).max(magnitude);
const systemCoordinate = z.number().min(-SYSTEM_LIMITS.windowMagnitude).max(SYSTEM_LIMITS.windowMagnitude);
const systemPoint = z.object({ x: systemCoordinate, y: systemCoordinate }).strict();

/** D19: two or three lines a x + b y = c and markers to move onto the crossings. */
export const lineSystemPayload = z.object({
  lines: z.array(z.object({ a: systemNumber(SYSTEM_LIMITS.coefficient), b: systemNumber(SYSTEM_LIMITS.coefficient), c: systemNumber(SYSTEM_LIMITS.constant) }).strict())
    .min(SYSTEM_LIMITS.minLines).max(SYSTEM_LIMITS.maxLines),
  window: z.object({
    xMin: windowNumber(SYSTEM_LIMITS.windowMagnitude), xMax: windowNumber(SYSTEM_LIMITS.windowMagnitude),
    yMin: windowNumber(SYSTEM_LIMITS.windowMagnitude), yMax: windowNumber(SYSTEM_LIMITS.windowMagnitude),
  }).strict(),
  grid: z.union([z.literal(0.5), z.literal(1), z.literal(2)]),
  start: z.array(systemPoint).min(1).max(SYSTEM_LIMITS.maxLines),
}).strict();

/** D42, D43, D04, D05: an expression to rewrite or an equation to solve, line by line. The reference answer stays in the rubric. */
export const expressionEditorPayload = z.object({
  task: z.enum(['rewrite', 'solve']),
  given: z.string().min(1).max(EXPRESSION_LIMITS.maxChars),
  form: z.enum(['expanded', 'factored', 'isolated', 'separated']),
  variable: z.string().regex(/^[a-z]$/),
}).strict();

type Issue = (path: string, message: string) => void;

function graphProblems(payload: z.infer<typeof functionGraphPayload>, issue: Issue): void {
  const problem = graphPayloadProblem(payload);
  if (problem) issue('curve', problem);
}

function systemProblems(payload: z.infer<typeof lineSystemPayload>, issue: Issue): void {
  const problem = systemPayloadProblem(payload);
  if (problem) issue('lines', problem);
}

function expressionProblems(payload: z.infer<typeof expressionEditorPayload>, issue: Issue): void {
  const problem = expressionTaskProblem(payload as ExpressionTask);
  if (problem) issue('given', problem);
}

const refine = <P>(check: (payload: P, issue: Issue) => void) => (value: { payload: P }, ctx: z.RefinementCtx) =>
  check(value.payload, (path, message) => ctx.addIssue({ code: 'custom', path: ['payload', path], message }));

export const ALG2_SEGMENTS = [
  z.object({ ...hzBase, type: z.literal('math.function-graph.v2'), grading: hzServer, visual: hzVisual('function-graph'), payload: functionGraphPayload }).strict().superRefine(refine(graphProblems)),
  z.object({ ...hzBase, type: z.literal('math.line-system.v2'), grading: hzServer, visual: hzVisual('line-system'), payload: lineSystemPayload }).strict().superRefine(refine(systemProblems)),
  z.object({ ...hzBase, type: z.literal('math.expression-editor.v2'), grading: hzServer, visual: hzVisual('expression-editor'), payload: expressionEditorPayload }).strict().superRefine(refine(expressionProblems)),
] as const;

const numberText = z.string().max(32).regex(/^-?(0|[1-9]\d{0,14})(\.\d{1,12})?$|^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/);
const tolerance = z.object({ absolute: numberText.optional(), relative_bps: z.number().int().min(0).max(10_000).optional() }).strict();

/** The `curve.parameters` key: the family, the target values, and how close counts. Whether it fits the payload is the scorer's check. */
export const graphRubric = z.object({
  family: z.enum(GRAPH_FAMILIES),
  target: z.record(z.string().regex(/^[mabc]$/), numberText),
  by: z.enum(['parameters', 'curve', 'either', 'both']).optional(),
  parameter_tolerance: tolerance.optional(),
  parameter_review: tolerance.optional(),
  samples: z.array(z.number().int().min(-10).max(10)).min(2).max(16).optional(),
  curve_tolerance: tolerance.optional(),
  curve_review: tolerance.optional(),
}).strict();

/** The `points.set` key: the crossings the markers must sit on. */
export const systemRubric = z.object({ required: z.array(systemPoint).min(1).max(SYSTEM_LIMITS.maxLines) }).strict();

/** The reference answer: the finished line, written the way a learner would type it. */
export const expressionRubric = z.object({ reference: z.string().min(1).max(EXPRESSION_LIMITS.maxChars) }).strict();

export const ALG2_RUBRICS = {
  'math.function-graph.v2': graphRubric,
  'math.line-system.v2': systemRubric,
  'math.expression-editor.v2': expressionRubric,
} as const;

export const ALG2_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  'math.function-graph.v2': { ages: [12, 17], adult: false },
  'math.line-system.v2': { ages: [13, 17], adult: false },
  'math.expression-editor.v2': { ages: [13, 17], adult: true },
};
