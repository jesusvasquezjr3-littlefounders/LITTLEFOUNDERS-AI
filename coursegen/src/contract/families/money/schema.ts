// `money` family — payload/answer Zod schemas (LESSON_ENGINE.md §5.5, types 30–38).

import { z } from 'zod';
import { idSchema, idText, markdownLite, segmentSchema, iconName } from '../../core/schemaBase.js';

export const currencySchema = z.enum(['MXN', 'USD', 'BRL']);

const moneyAmount = z.number().positive().max(1_000_000);
const denomination = z.number().positive().max(10_000);

export const coinCount = segmentSchema(
  'coin_count',
  z.object({
    currency: currencySchema,
    denominations: z.array(denomination).min(2).max(9),
    target: moneyAmount,
  }),
  // Self-contained: the grader checks the tray sum against payload.target.
  z.object({}),
);

export const makeChange = segmentSchema(
  'make_change',
  z.object({
    currency: currencySchema,
    denominations: z.array(denomination).min(2).max(9),
    price: moneyAmount,
    paid_with: moneyAmount,
  }),
  // Self-contained: correct sum = paid_with − price.
  z.object({}),
);

export const piggySplit = segmentSchema(
  'piggy_split',
  z.object({
    income: moneyAmount,
    /** ISO currency code of the income (named `unit` in §5.5). */
    unit: currencySchema,
    jars: z
      .array(
        z.object({
          id: idSchema,
          label: z.string().min(1).max(60),
          icon: iconName,
          hint_md: markdownLite.optional(),
        }),
      )
      .min(2)
      .max(4),
    step: z.number().positive().optional(),
  }),
  z.object({
    targets: z.record(idSchema, z.object({ min: z.number().min(0), max: z.number().min(0) })),
    rationale_md: markdownLite.optional(),
  }),
);

export const needsWants = segmentSchema(
  'needs_wants',
  z.object({
    items: z
      .array(z.object({ id: idSchema, text_md: markdownLite, icon: iconName.optional() }))
      .min(4)
      .max(12),
  }),
  z.object({ needs_ids: z.array(idSchema) }),
);

export const priceCompare = segmentSchema(
  'price_compare',
  z.object({
    offers: z
      .array(
        z.object({
          id: idSchema,
          label: z.string().min(1).max(80),
          qty: z.number().positive(),
          unit: z.string().min(1).max(40),
          price: moneyAmount,
        }),
      )
      .min(2)
      .max(4),
    currency: currencySchema,
  }),
  z.object({ best_offer_id: idSchema }),
);

export const budgetFit = segmentSchema(
  'budget_fit',
  z.object({
    budget: moneyAmount,
    currency: currencySchema,
    items: z
      .array(
        z.object({
          id: idSchema,
          label: z.string().min(1).max(80),
          icon: iconName,
          price: moneyAmount,
          need: z.boolean().optional(),
        }),
      )
      .min(4)
      .max(10),
    must_buy_needs: z.boolean(),
  }),
  // Self-contained: constraint check against payload budget/needs.
  z.object({}),
);

export const savingsGoal = segmentSchema(
  'savings_goal',
  z.object({
    goal: moneyAmount,
    currency: currencySchema,
    weekly_options: z.array(z.number().positive()).min(1).max(4),
  }),
  // Authoring aid; the grader recomputes weeks = ceil(goal / weekly) itself.
  z.object({ correct: z.record(z.string(), z.number().int().positive()).optional() }),
);

export const fairTrade = segmentSchema(
  'fair_trade',
  z.object({
    offer_a: z.object({ label: z.string().min(1).max(60), icon: iconName, qty: z.number().positive() }),
    offer_b: z.object({ label: z.string().min(1).max(60), icon: iconName, qty: z.number().positive() }),
    rate_md: markdownLite,
  }),
  z.object({ verdict: z.enum(['fair', 'a_wins', 'b_wins']) }),
);

export const interestPeek = segmentSchema(
  'interest_peek',
  z.object({
    principal: moneyAmount,
    rate_pct: z.number().positive().max(100),
    periods: z.number().int().min(2).max(10),
    currency: currencySchema,
    prediction: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('choice'), options: z.array(idText).min(2).max(5) }),
      z.object({ kind: z.literal('slider'), min: z.number(), max: z.number() }),
    ]),
  }),
  z.object({
    correct_option_id: idSchema.optional(),
    value: z.number().optional(),
    tolerance: z.number().positive().optional(),
  }),
);

export const moneySchemas = [
  coinCount,
  makeChange,
  piggySplit,
  needsWants,
  priceCompare,
  budgetFit,
  savingsGoal,
  fairTrade,
  interestPeek,
] as const;

export type CoinCountSegment = z.infer<typeof coinCount>;
export type MakeChangeSegment = z.infer<typeof makeChange>;
export type PiggySplitSegment = z.infer<typeof piggySplit>;
export type NeedsWantsSegment = z.infer<typeof needsWants>;
export type PriceCompareSegment = z.infer<typeof priceCompare>;
export type BudgetFitSegment = z.infer<typeof budgetFit>;
export type SavingsGoalSegment = z.infer<typeof savingsGoal>;
export type FairTradeSegment = z.infer<typeof fairTrade>;
export type InterestPeekSegment = z.infer<typeof interestPeek>;
