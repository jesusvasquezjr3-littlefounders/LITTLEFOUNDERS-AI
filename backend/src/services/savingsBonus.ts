import { z } from 'zod';
import { refusal, rpc, UNAVAILABLE, type Refusal } from './familyLifecycle.js';
import { serviceRest, serviceRestRaw, type SavingsBonusRuleRow } from './supabaseRest.js';

/*
 * S07.3 (D.11): the savings bonus in the framing a child can understand.
 *
 *   per_ten  under 13, or no known birth date: "for every 10 coins you keep
 *            saved, you get 1 more each week" (a fixed ratio; the Tutor only
 *            switches it on or off)
 *   percent  13 to 17: the Tutor's 0-20% weekly rate, with a worked example
 *            the teen completes
 *
 * The database decides the framing (savings_bonus_framing, by age, never
 * role), refuses a percentage for a per_ten child on every write, and credits
 * by the framing the child is in at credit time. This file mirrors the
 * arithmetic only to show the child their own next bonus; the credit is never
 * computed here.
 */

/** The fixed ratio for the younger framing: 1 coin for every 10 saved (Block D threshold log). */
export const BONUS_PER_TEN_COINS = 1;
export const BONUS_PER_TEN_UNIT = 10;
/** The same ratio as basis points, which the database stores for a per_ten rule. */
export const BONUS_PER_TEN_RATE_BP = 1000;
export const MAX_BONUS_RATE_BP = 2000;
/** The age from which the percentage framing (and its worked example) applies. */
export const PERCENT_FRAMING_MIN_AGE = 13;

export type BonusFraming = 'per_ten' | 'percent';
const Framing = z.enum(['per_ten', 'percent']).nullable();

/** 'per_ten' | 'percent', null for an account that holds no wallet, UNAVAILABLE when unreadable. */
export async function readBonusFraming(kidId: string): Promise<BonusFraming | null | typeof UNAVAILABLE> {
  const result = await rpc('savings_bonus_framing', { p_kid: z.string().uuid().parse(kidId) }, Framing);
  if (result === UNAVAILABLE || (typeof result === 'object' && result !== null && 'refused' in result)) return UNAVAILABLE;
  return result;
}

/** The bonus the next weekly credit would add for `saved` coins, exactly as the database computes it. */
export function nextBonus(framing: BonusFraming, saved: number, rateBp: number): number {
  const balance = Math.max(0, Math.trunc(saved));
  if (framing === 'per_ten') return Math.floor(balance / BONUS_PER_TEN_UNIT) * BONUS_PER_TEN_COINS;
  return Math.floor((balance * rateBp) / 10000);
}

const RuleRow = z.object({
  kid_user_id: z.string().uuid(),
  parent_user_id: z.string().uuid(),
  rate_bp: z.number().int(),
  active: z.boolean(),
  next_run_at: z.string(),
  created_at: z.string(),
  reframed_from_rate_bp: z.number().int().nullable(),
});

/** Saves a Tutor's rule; the database refuses a percentage for a per_ten child, a non-guardian and a non-holder. */
export async function saveBonusRule(row: {
  kid_user_id: string;
  parent_user_id: string;
  rate_bp: number;
  active: boolean;
  next_run_at: string;
}): Promise<SavingsBonusRuleRow | Refusal | typeof UNAVAILABLE> {
  const raw = await serviceRestRaw('/savings_bonus_rules?on_conflict=kid_user_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ ...row, reframed_from_rate_bp: null }),
  });
  if (!raw.ok) return refusal(raw.body);
  const parsed = z.array(RuleRow).length(1).safeParse(raw.body);
  return parsed.success ? parsed.data[0]! : UNAVAILABLE;
}

// ── The 13-17 worked example ────────────────────────────────────────────────

export interface ExampleProgress {
  shown: boolean;
  completed: boolean;
}

export async function readExampleProgress(userId: string): Promise<ExampleProgress | null> {
  const rows = z.array(z.object({ completed_at: z.string().nullable() })).max(1).safeParse(
    await serviceRest<unknown>(`/savings_bonus_explanations?user_id=eq.${encodeURIComponent(z.string().uuid().parse(userId))}&select=completed_at&limit=1`),
  );
  if (!rows.success) return null;
  const row = rows.data[0];
  return { shown: row !== undefined, completed: row?.completed_at != null };
}

/** 'shown' records the first view; 'answered' returns whether the answer is right at the child's current rate (checked by the database). */
export function recordExample(userId: string, input: { step: 'shown' } | { step: 'answered'; exampleSaved: number; answer: number }) {
  return rpc('record_savings_bonus_explanation', {
    p_user: z.string().uuid().parse(userId),
    p_step: input.step,
    p_example_saved: input.step === 'answered' ? input.exampleSaved : null,
    p_answer: input.step === 'answered' ? input.answer : null,
  }, z.boolean());
}

// ── Appendix H metrics (Diagnostic, counts only) ─────────────────────────────

const Comprehension = z.array(z.object({ eligible: z.number().int(), shown: z.number().int(), completed: z.number().int() })).length(1);

export async function readBonusComprehension(since: Date) {
  const parsed = Comprehension.safeParse(await serviceRest<unknown>('/rpc/savings_bonus_comprehension', {
    method: 'POST', body: JSON.stringify({ p_since: since.toISOString() }),
  }));
  return parsed.success ? parsed.data[0]! : null;
}

const TagAdoption = z.array(z.object({
  contribution_tasks: z.number().int(), bonus_tasks: z.number().int(), tutors: z.number().int(), tutors_using_contribution: z.number().int(),
})).length(1);

export async function readChoreTagAdoption(since: Date) {
  const parsed = TagAdoption.safeParse(await serviceRest<unknown>('/rpc/chore_tag_adoption', {
    method: 'POST', body: JSON.stringify({ p_since: since.toISOString() }),
  }));
  return parsed.success ? parsed.data[0]! : null;
}
