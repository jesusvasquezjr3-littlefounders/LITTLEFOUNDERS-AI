import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { isRefusal, rpc, UNAVAILABLE, type Refusal } from './familyLifecycle.js';

/*
 * S07.4 — the Block D habit mechanics:
 *  - D.13 a recommended default split with an easy override (the holder's own
 *    usual split), measured by consent-gated split and redemption-timing
 *    events the database writes itself;
 *  - D.14 a real destination for the Share pocket (share destinations and
 *    gifts, settled by whoever chose the destination with a note the child
 *    reads);
 *  - D.15 the next-goal prompt at the celebration of a reached goal;
 *  - D.16 a goal's progress split by provenance (own / bonus / family).
 *
 * Every write is a service-role RPC into the S07.4 migrations: the database
 * re-derives who may act (the holder, a verified guardian, the destination's
 * steward), serializes on the holder's wallet lock and audits in the same
 * transaction. Core's route guards answer first, but they are not the
 * boundary. A transport failure is UNAVAILABLE and is never read as a
 * decision.
 */

export { isRefusal, UNAVAILABLE };
export type { Refusal };

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));
const Count = z.number().int().nonnegative();
/** PostgREST renders bigint/numeric as numbers or numeric strings depending on the column; accept both, never NaN. */
const Num = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]).transform((v) => Number(v));
const Int = Num.pipe(z.number().int());

// ── D.13: the usual split ──────────────────────────────────────────────────

/** The platform recommendation, mirrored from wallet_recommended_split() and pinned by the Block D threshold log. */
export const RECOMMENDED_SAVE_PCT = 50;
export const RECOMMENDED_SPEND_PCT = 40;
export const RECOMMENDED_SHARE_PCT = 10;
export const RECOMMENDED_SPLIT = { save: RECOMMENDED_SAVE_PCT, spend: RECOMMENDED_SPEND_PCT, share: RECOMMENDED_SHARE_PCT } as const;

/** The most coins one Share gift may carry (share_gift_pledge; threshold log). */
export const SHARE_GIFT_MAX_COINS = 1000;

export interface UsualSplit { save: number; spend: number; share: number; custom: boolean }

const UsualSplitRows = z.array(z.object({ save_pct: Int, spend_pct: Int, share_pct: Int, custom: z.boolean() }).strict()).length(1);

export async function readUsualSplit(holderId: string): Promise<UsualSplit | null> {
  const rows = UsualSplitRows.safeParse(await serviceRest<unknown>('/rpc/wallet_usual_split', {
    method: 'POST', body: JSON.stringify({ p_holder: UUID.parse(holderId) }),
  }));
  if (!rows.success) return null;
  const [row] = rows.data;
  return { save: row!.save_pct, spend: row!.spend_pct, share: row!.share_pct, custom: row!.custom };
}

export function setUsualSplit(holderId: string, actorId: string, split: { save: number; spend: number; share: number }) {
  return rpc('set_wallet_usual_split', {
    p_holder: UUID.parse(holderId), p_actor: UUID.parse(actorId), p_save: split.save, p_spend: split.spend, p_share: split.share,
  }, z.literal(true));
}

/**
 * Whole coins for an amount under a ratio, exactly as wallet_split_coins()
 * computes the recorded default: each pocket gets the floor of its share, and
 * the one or two coins left go to the largest remainders (ties: Save, Spend,
 * Share). The frontend mirrors it too; all three are pinned to one fixture.
 */
export function splitCoins(amount: number, pct: { save: number; spend: number; share: number }) {
  const parts = [pct.save, pct.spend, pct.share].map((p, ord) => ({ ord, base: Math.floor((amount * p) / 100), rem: (amount * p) % 100 }));
  const left = amount - parts.reduce((sum, p) => sum + p.base, 0);
  const ranked = [...parts].sort((a, b) => b.rem - a.rem || a.ord - b.ord);
  const extra = new Set(ranked.slice(0, left).map((p) => p.ord));
  const coins = parts.map((p) => p.base + (extra.has(p.ord) ? 1 : 0));
  return { save: coins[0]!, spend: coins[1]!, share: coins[2]! };
}

// ── D.16: goal progress by provenance ──────────────────────────────────────

export interface GoalProgress { own: number; bonus: number; family: number; total: number }

const BreakdownRows = z.array(z.object({ goal_id: z.string().uuid(), own: Int, bonus: Int, family: Int, total: Int }).strict());

/** Provenance for each goal id; null = unreadable (the caller refuses rather than showing a mixed number). */
export async function getGoalBreakdowns(goalIds: string[]): Promise<Map<string, GoalProgress> | null> {
  if (goalIds.length === 0) return new Map();
  const rows = BreakdownRows.safeParse(await serviceRest<unknown>('/rpc/goal_progress_breakdown', {
    method: 'POST', body: JSON.stringify({ p_goal_ids: goalIds.map((id) => UUID.parse(id)) }),
  }));
  if (!rows.success || rows.data.length !== new Set(goalIds).size) return null;
  return new Map(rows.data.map((r) => [r.goal_id, { own: r.own, bonus: r.bonus, family: r.family, total: r.total }]));
}

// ── D.15: the next step of a reached goal ──────────────────────────────────

export const NEXT_STEP_STATES = ['pending', 'prompted', 'set', 'declined'] as const;
export type NextStepState = (typeof NEXT_STEP_STATES)[number];
const NextStepRows = z.array(z.object({ goal_id: z.string().uuid(), state: z.enum(NEXT_STEP_STATES), reached_at: z.string(), next_goal_id: z.string().uuid().nullable() }).strict());
export type NextStepRow = z.infer<typeof NextStepRows>[number];

export async function getNextSteps(goalIds: string[]): Promise<Map<string, NextStepRow> | null> {
  if (goalIds.length === 0) return new Map();
  const ids = goalIds.map((id) => eu(id)).join(',');
  const rows = NextStepRows.safeParse(await serviceRest<unknown>(`/goal_next_steps?goal_id=in.(${ids})&select=goal_id,state,reached_at,next_goal_id`));
  return rows.success ? new Map(rows.data.map((r) => [r.goal_id, r])) : null;
}

export function markNextStepSeen(holderId: string, goalId: string) {
  return rpc('goal_next_step_seen', { p_holder: UUID.parse(holderId), p_goal: UUID.parse(goalId) }, z.boolean());
}

export function declineNextStep(holderId: string, goalId: string) {
  return rpc('goal_next_step_decline', { p_holder: UUID.parse(holderId), p_goal: UUID.parse(goalId) }, z.boolean());
}

// ── D.14: the Share destination ────────────────────────────────────────────

export const DESTINATION_KINDS = ['charity', 'gift', 'community'] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

const DestinationRows = z.array(z.object({
  id: z.string().uuid(),
  holder_user_id: z.string().uuid(),
  title: z.string(),
  kind: z.enum(DESTINATION_KINDS),
  chosen_by: z.enum(['tutor', 'holder']),
  status: z.enum(['active', 'archived']),
  created_at: z.string(),
}).strict());
export type DestinationRow = z.infer<typeof DestinationRows>[number];

const GiftRows = z.array(z.object({
  id: z.string().uuid(),
  holder_user_id: z.string().uuid(),
  destination_id: z.string().uuid(),
  amount: Count,
  status: z.enum(['pledged', 'given', 'returned']),
  pledged_at: z.string(),
  settled_at: z.string().nullable(),
  settled_by: z.string().uuid().nullable(),
  note: z.string().nullable(),
}).strict());
export type GiftRow = z.infer<typeof GiftRows>[number];

export async function listShareDestinations(holderId: string): Promise<DestinationRow[] | null> {
  const rows = DestinationRows.safeParse(await serviceRest<unknown>(
    `/share_destinations?holder_user_id=eq.${eu(holderId)}&select=id,holder_user_id,title,kind,chosen_by,status,created_at&order=created_at.desc&limit=50`,
  ));
  return rows.success ? rows.data : null;
}

export async function listShareGifts(holderId: string): Promise<GiftRow[] | null> {
  const rows = GiftRows.safeParse(await serviceRest<unknown>(
    `/share_gifts?holder_user_id=eq.${eu(holderId)}&select=id,holder_user_id,destination_id,amount,status,pledged_at,settled_at,settled_by,note&order=pledged_at.desc&limit=50`,
  ));
  return rows.success ? rows.data : null;
}

export async function getShareGift(giftId: string): Promise<GiftRow | null | undefined> {
  const rows = GiftRows.safeParse(await serviceRest<unknown>(
    `/share_gifts?id=eq.${eu(giftId)}&select=id,holder_user_id,destination_id,amount,status,pledged_at,settled_at,settled_by,note&limit=1`,
  ));
  if (!rows.success) return undefined;
  return rows.data[0] ?? null;
}

export async function getShareDestination(destinationId: string): Promise<DestinationRow | null | undefined> {
  const rows = DestinationRows.safeParse(await serviceRest<unknown>(
    `/share_destinations?id=eq.${eu(destinationId)}&select=id,holder_user_id,title,kind,chosen_by,status,created_at&limit=1`,
  ));
  if (!rows.success) return undefined;
  return rows.data[0] ?? null;
}

export function createShareDestination(input: { holderId: string; actorId: string; title: string; kind: DestinationKind }) {
  return rpc('share_destination_create', {
    p_holder: UUID.parse(input.holderId), p_actor: UUID.parse(input.actorId), p_title: input.title, p_kind: input.kind,
  }, UUID);
}

export function archiveShareDestination(destinationId: string, actorId: string) {
  return rpc('share_destination_archive', { p_destination: UUID.parse(destinationId), p_actor: UUID.parse(actorId) }, z.boolean());
}

export function pledgeShareGift(holderId: string, destinationId: string, amount: number) {
  return rpc('share_gift_pledge', { p_holder: UUID.parse(holderId), p_destination: UUID.parse(destinationId), p_amount: amount }, UUID);
}

export function settleShareGift(input: { giftId: string; actorId: string; outcome: 'given' | 'returned'; note: string | null }) {
  return rpc('share_gift_settle', {
    p_gift: UUID.parse(input.giftId), p_actor: UUID.parse(input.actorId), p_outcome: input.outcome, p_note: input.note,
  }, z.enum(['given', 'returned']));
}

// ── Appendix H diagnostics (no target; counts and rates only) ──────────────

async function rows<T>(fn: string, args: Record<string, unknown>, shape: z.ZodType<T>): Promise<T | null> {
  const parsed = shape.safeParse(await serviceRest<unknown>(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }));
  return parsed.success ? parsed.data : null;
}

const NullableNum = z.union([Num, z.null()]);

export function readRedemptionTiming(since: Date) {
  return rows('family_redemption_credit_timing', { p_since: since.toISOString() }, z.array(z.object({
    credit_class: z.enum(['allowance', 'earned']),
    bin: z.enum(['0_24h', '24_72h', '72_168h', '168h_plus', 'none']),
    requests: Int,
    exposure_hours: NullableNum,
    rate_per_100_child_days: NullableNum,
  }).strict()).length(10));
}

export function readSplitEngagement(since: Date) {
  return rows('family_split_engagement', { p_since: since.toISOString() }, z.array(z.object({
    source: z.enum(['allowance', 'income', 'task']), allocations: Int, kept_default: Int, adjusted: Int,
  }).strict()).length(3));
}

export function readSavePersistence(since: Date) {
  return rows('family_save_contribution_persistence', { p_since: since.toISOString() }, z.array(z.object({
    children: Int, save_contributors: Int, save_coins: Int, own_coins: Int,
  }).strict()).length(1)).then((r) => (r ? r[0]! : null));
}

export function readPostGoalMotivation(since: Date) {
  return rows('family_post_goal_motivation', { p_since: since.toISOString() }, z.array(z.object({
    next_goal_within_2_days: z.boolean(), goals: Int, mean_before_per_day: Num, mean_after_per_day: Num, goals_with_drop: Int,
  }).strict()).length(2));
}

/** Appendix H's completion window for a Share gift (threshold log). */
export const SHARE_COMPLETION_WINDOW_DAYS = 14;

export function readShareCompletion(since: Date) {
  return rows('share_gift_completion', { p_since: since.toISOString(), p_window_days: SHARE_COMPLETION_WINDOW_DAYS }, z.array(z.object({
    pledged: Int, given_in_window: Int, given_later: Int, returned: Int, waiting: Int, holders_with_share: Int, holders_without_destination: Int,
  }).strict()).length(1)).then((r) => (r ? r[0]! : null));
}
