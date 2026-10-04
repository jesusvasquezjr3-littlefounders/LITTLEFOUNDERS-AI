import { z } from 'zod';
import { hzBase, hzId, hzServer, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import { GRID_MAX_PIECES, gridLabelsProblem, gridProblem } from './matrix.js';
import { MAX_DURATION, MAX_LIMIT, MAX_PERIODS, MAX_WORKERS, SCHEDULE_MAX_TASKS, SCHEDULE_MIN_TASKS, scheduleLabelsProblem, scheduleProblem } from './schedule.js';
import { STATEMENT_MAX_AMOUNT, STATEMENT_MAX_ITEMS, STATEMENT_MIN_ITEMS, statementLabelsProblem, statementProblem } from './statement.js';

const label = z.string().trim().min(1).max(60);
/** Display names live next to the payload, never inside it, so the model stays language-free. */
const labels = z.record(hzId, label);
const whole = (min: number, max: number) => z.number().int().min(min).max(max);

export const statementPayload = z.object({
  items: z.array(z.object({ id: hzId, amount: whole(1, STATEMENT_MAX_AMOUNT) }).strict()).min(STATEMENT_MIN_ITEMS).max(STATEMENT_MAX_ITEMS),
}).strict();

export const gridPayload = z.object({
  pieces: z.array(hzId).min(2).max(GRID_MAX_PIECES),
  points: z.array(z.tuple([whole(1, 9), whole(1, 9)])).max(12).optional(),
  criteria: z.array(z.object({ id: hzId, weight: whole(1, 5) }).strict()).min(2).max(4).optional(),
  scores: z.array(z.array(whole(1, 5)).min(2).max(4)).max(5).optional(),
}).strict();

export const schedulePayload = z.object({
  tasks: z.array(z.object({ id: hzId, after: z.array(hzId).max(3), duration: whole(1, MAX_DURATION).optional(), due: whole(1, SCHEDULE_MAX_TASKS).optional() }).strict()).min(SCHEDULE_MIN_TASKS).max(SCHEDULE_MAX_TASKS),
  periods: whole(SCHEDULE_MIN_TASKS, MAX_PERIODS).optional(),
  workers: whole(1, MAX_WORKERS).optional(),
  done: z.array(hzId).max(SCHEDULE_MAX_TASKS).optional(),
  limit: whole(1, MAX_LIMIT).optional(),
}).strict();

const problem = (ctx: z.RefinementCtx, path: string, message: string | null) => { if (message) ctx.addIssue({ code: 'custom', path: [path], message }); };

export const FIN2_SEGMENTS = [
  /** F2.13 (N19): sort a month of money into earned, passive, expenses, assets and liabilities; the goal is passive greater than expenses. */
  z.object({
    ...hzBase, type: z.literal('money.cash-flow.v2'), grading: hzServer, visual: hzVisual('statement-board'), labels, payload: statementPayload,
  }).strict().superRefine((value, ctx) => {
    problem(ctx, 'payload', statementProblem(value.payload));
    problem(ctx, 'labels', statementLabelsProblem(value.payload, value.labels));
  }),
  /** F2.14 (N16, N17, N24, Q20, R08): SWOT, Eisenhower, a 2x2, a weighted decision matrix and a business model canvas on one grid piece. */
  z.object({
    ...hzBase, type: z.literal('reasoning.decision-grid.v2'), grading: hzServer,
    visual: z.union([hzVisual('swot'), hzVisual('eisenhower'), hzVisual('two-by-two'), hzVisual('decision-matrix'), hzVisual('business-canvas')]),
    labels, payload: gridPayload,
  }).strict().superRefine((value, ctx) => {
    problem(ctx, 'payload', gridProblem(value.visual.type, value.payload));
    problem(ctx, 'labels', gridLabelsProblem(value.visual.type, value.payload, value.labels));
  }),
  /** F2.15 (F14, O20): a Gantt, a kanban and an assemblable timeline of tasks, dependencies and deadlines. */
  z.object({
    ...hzBase, type: z.literal('plan.schedule-board.v2'), grading: hzServer,
    visual: z.union([hzVisual('gantt'), hzVisual('kanban'), hzVisual('timeline')]),
    labels, payload: schedulePayload,
  }).strict().superRefine((value, ctx) => {
    problem(ctx, 'payload', scheduleProblem(value.visual.type, value.payload));
    problem(ctx, 'labels', scheduleLabelsProblem(value.visual.type, value.payload, value.labels));
  }),
] as const;

/** The private key: one or more complete arrangements (slot id to piece ids). Never part of the public payload. */
const rubric = z.object({ solutions: z.array(z.record(hzId, z.array(hzId).max(GRID_MAX_PIECES))).min(1).max(8) }).strict();

export const FIN2_RUBRICS = {
  'money.cash-flow.v2': rubric,
  'reasoning.decision-grid.v2': rubric,
  'plan.schedule-board.v2': rubric,
} as const;

export const FIN2_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  'money.cash-flow.v2': { ages: [13, 17], adult: true },
  'reasoning.decision-grid.v2': { ages: [12, 17], adult: true },
  'plan.schedule-board.v2': { ages: [12, 17], adult: true },
};
