import { z } from 'zod';
import { hzBase, hzId, hzServer, hzVisual } from '../shared.js';
import type { HorizonteAgeScope } from '../types.js';
import {
  CARD_LIMITS, CASH, COMPOUNDINGS, COMPOUND_EXPLANATIONS, COMPOUND_PRINCIPAL, COMPOUND_RATE, COMPOUND_YEARS, EFFECTIVE_NOMINAL,
  TV_AMOUNT, TV_PAYMENTS, TV_RATE, challengeReachable, compoundCents, isRatePayload, meetsChallenge, nearestOption,
} from './model.js';

export const COMPOUND_TYPE = 'money.compound-interest.v2';
export const TIME_VALUE_TYPE = 'money.time-value.v2';
export const RATE_RETURN_TYPE = 'money.rate-return.v2';

const whole = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const tolerance = z.object({ absolute: z.string().max(32).optional(), relative_bps: z.number().int().min(0).max(10_000).optional() }).strict();

/* ── F1.10 compound interest: predict, slide, reveal, explain ── */

export const compoundPayload = z.object({
  principalCents: whole(COMPOUND_PRINCIPAL.min, COMPOUND_PRINCIPAL.max),
  /** The question's fixed case, and where the two sliders open. */
  scenario: z.object({ rate: whole(COMPOUND_RATE.min, COMPOUND_RATE.max), years: whole(COMPOUND_YEARS.min, COMPOUND_YEARS.max) }).strict(),
  options: z.array(z.object({ id: hzId, cents: whole(1, MAX_SAFE) }).strict()).min(3).max(5),
  /** The public challenge for the sliders: reach `minimumCents` in at most `maximumYears` years. */
  challenge: z.object({ minimumCents: whole(1, MAX_SAFE), maximumYears: whole(COMPOUND_YEARS.min, COMPOUND_YEARS.max) }).strict(),
  explain: z.array(z.enum(COMPOUND_EXPLANATIONS)).min(3).max(4),
}).strict().superRefine((payload, ctx) => {
  const truth = compoundCents(payload.principalCents, payload.scenario.rate, payload.scenario.years);
  if (truth === null) { ctx.addIssue({ code: 'custom', path: ['scenario'], message: 'The scenario is outside the model range' }); return; }
  if (new Set(payload.options.map((option) => option.id)).size !== payload.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option ids are unique' });
  if (new Set(payload.options.map((option) => option.cents)).size !== payload.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option amounts are unique' });
  if (nearestOption(payload.options, truth) === null) ctx.addIssue({ code: 'custom', path: ['options'], message: 'One option must be nearest the true value, with no tie' });
  if (new Set(payload.explain).size !== payload.explain.length || !payload.explain.includes('interest-on-interest')) ctx.addIssue({ code: 'custom', path: ['explain'], message: 'Explanations are unique and include the real one' });
  if (!challengeReachable(payload.principalCents, payload.challenge)) ctx.addIssue({ code: 'custom', path: ['challenge'], message: 'No slider position meets the challenge' });
  if (meetsChallenge(payload.principalCents, payload.challenge, payload.scenario.rate, payload.scenario.years)) ctx.addIssue({ code: 'custom', path: ['challenge'], message: 'The sliders already meet the challenge when they open' });
});

/* ── F2.11 time value of money and annuities ── */

const orderTask = z.object({ kind: z.literal('order'), side: z.enum(['receive', 'pay']), amountsCents: z.array(whole(TV_AMOUNT.min, TV_AMOUNT.max)).min(TV_PAYMENTS.min).max(TV_PAYMENTS.max) }).strict();
const annuityTask = z.object({ kind: z.literal('annuity'), timing: z.enum(['end', 'start']), amountCents: whole(TV_AMOUNT.min, TV_AMOUNT.max), count: whole(TV_PAYMENTS.min, TV_PAYMENTS.max) }).strict();

export const timeValuePayload = z.object({
  rateBps: whole(TV_RATE.min, TV_RATE.max),
  /** The value the learner types for the arrangement they built: its worth today, or at the end of the timeline. */
  ask: z.enum(['present', 'future']),
  task: z.discriminatedUnion('kind', [orderTask, annuityTask]),
}).strict().superRefine((payload, ctx) => {
  if (payload.task.kind === 'order' && new Set(payload.task.amountsCents).size !== payload.task.amountsCents.length) ctx.addIssue({ code: 'custom', path: ['task', 'amountsCents'], message: 'Payment amounts differ, so exactly one order is best' });
});

/* ── F2.12 effective rate, credit card, NPV and IRR ── */

const flows = z.array(whole(0, CASH.amount.max)).min(CASH.flows.min).max(CASH.flows.max);
export const ratePayload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('effective'), nominalBps: whole(EFFECTIVE_NOMINAL.min, EFFECTIVE_NOMINAL.max), periodsPerYear: z.number().refine((n) => (COMPOUNDINGS as readonly number[]).includes(n)) }).strict(),
  z.object({
    kind: z.literal('card'), ask: z.enum(['months', 'interest']), balanceCents: whole(CARD_LIMITS.balance.min, CARD_LIMITS.balance.max), aprBps: whole(CARD_LIMITS.apr.min, CARD_LIMITS.apr.max),
    minimumPctBps: whole(CARD_LIMITS.pct.min, CARD_LIMITS.pct.max), floorCents: whole(CARD_LIMITS.floor.min, CARD_LIMITS.floor.max),
  }).strict(),
  z.object({ kind: z.literal('npv'), rateBps: whole(CASH.rate.min, CASH.rate.max), outlayCents: whole(CASH.amount.min, CASH.amount.max), flowsCents: flows }).strict(),
  z.object({ kind: z.literal('irr'), outlayCents: whole(CASH.amount.min, CASH.amount.max), flowsCents: flows }).strict(),
]).superRefine((payload, ctx) => {
  if (!isRatePayload(payload)) ctx.addIssue({ code: 'custom', message: 'The case is outside the model: a card must pay off within 600 months, an IRR needs inflows that beat the outlay' });
});

const VISUAL_OF_KIND = { effective: 'effective-rate', card: 'card-payoff', npv: 'cash-flow', irr: 'cash-flow' } as const;

export const FIN1_SEGMENTS = [
  z.object({ ...hzBase, type: z.literal(COMPOUND_TYPE), grading: hzServer, visual: hzVisual('compound-interest'), payload: compoundPayload }).strict(),
  z.object({ ...hzBase, type: z.literal(TIME_VALUE_TYPE), grading: hzServer, visual: hzVisual('time-value'), payload: timeValuePayload }).strict(),
  z.object({
    ...hzBase, type: z.literal(RATE_RETURN_TYPE), grading: hzServer,
    visual: z.union([hzVisual('effective-rate'), hzVisual('card-payoff'), hzVisual('cash-flow')]), payload: ratePayload,
  }).strict().superRefine((value, ctx) => {
    if (value.visual.type !== VISUAL_OF_KIND[value.payload.kind]) ctx.addIssue({ code: 'custom', path: ['visual'], message: 'The visual matches the kind of case' });
  }),
] as const;

/** The private answer keys. The scorer checks every key against the model, so a wrong key never grades anyone. */
export const FIN1_RUBRICS = {
  [COMPOUND_TYPE]: z.object({ predictOption: hzId, explainId: z.enum(COMPOUND_EXPLANATIONS) }).strict(),
  [TIME_VALUE_TYPE]: z.object({
    solutions: z.array(z.record(hzId, z.array(hzId).max(32))).min(1).max(8),
    tolerance, review: tolerance.optional(),
  }).strict(),
  [RATE_RETURN_TYPE]: z.object({ target: z.string().max(32), tolerance: tolerance.optional(), review: tolerance.optional() }).strict(),
} as const;

export const FIN1_AGE_SCOPE: Readonly<Record<string, HorizonteAgeScope>> = {
  [COMPOUND_TYPE]: { ages: [10, 17], adult: true },
  [TIME_VALUE_TYPE]: { ages: [14, 17], adult: true },
  [RATE_RETURN_TYPE]: { ages: [15, 17], adult: true },
};
