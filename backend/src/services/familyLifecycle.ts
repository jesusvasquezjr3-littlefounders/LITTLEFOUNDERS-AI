import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * S07.1 — D.5 (OD-21) producing flows and the D.4 integrity metric.
 *
 * Every write here is a service-role RPC into the family_hub_* migrations:
 * the database re-derives the guardian relationship, validates the reason,
 * serializes on the child's wallet lock and audits in the same transaction.
 * Core's route guards run first (a stranger gets a 404 before any RPC), but
 * they are not the enforcing boundary — the functions and triggers are.
 *
 * RPC refusals arrive as PostgREST errors with code P0001 and a SCREAMING_SNAKE
 * message (RAISE EXCEPTION 'NOT_A_GUARDIAN' ...). `refusal()` extracts that
 * token; anything else (transport failure, unexpected shape) is 'UNAVAILABLE'
 * and must never be read as a decision.
 */

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));

export type Refusal = { refused: string };
export const UNAVAILABLE = 'UNAVAILABLE' as const;

const RpcError = z.object({ code: z.literal('P0001'), message: z.string().regex(/^[A-Z][A-Z_]{2,63}$/) });

function refusal(body: unknown): Refusal | typeof UNAVAILABLE {
  const parsed = RpcError.safeParse(body);
  return parsed.success ? { refused: parsed.data.message } : UNAVAILABLE;
}

async function rpc<T>(name: string, args: Record<string, unknown>, shape: z.ZodType<T>): Promise<T | Refusal | typeof UNAVAILABLE> {
  const raw = await serviceRestRaw(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  if (!raw.ok) return refusal(raw.body);
  const parsed = shape.safeParse(raw.body);
  return parsed.success ? parsed.data : UNAVAILABLE;
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && 'refused' in value;
}

// ── Guardian money actions ─────────────────────────────────────────────────

export const WALLET_BUCKETS = ['save', 'spend', 'share'] as const;
export type WalletBucket = (typeof WALLET_BUCKETS)[number];

export function adjustWalletAsGuardian(input: {
  kidId: string;
  actorId: string;
  bucket: WalletBucket;
  amount: number;
  reason: string;
}) {
  return rpc('guardian_adjust_wallet', {
    p_kid_user_id: UUID.parse(input.kidId),
    p_actor: UUID.parse(input.actorId),
    p_bucket: input.bucket,
    p_amount: input.amount,
    p_reason: input.reason,
  }, UUID);
}

export function withdrawGoalAsGuardian(input: {
  goalId: string;
  actorId: string;
  amount: number;
  destination: 'save' | 'spend';
  reason: string;
}) {
  return rpc('guardian_withdraw_goal', {
    p_goal_id: UUID.parse(input.goalId),
    p_actor: UUID.parse(input.actorId),
    p_amount: input.amount,
    p_destination: input.destination,
    p_reason: input.reason,
  }, UUID);
}

/** true = now fulfilled; false = not in the approved state (already delivered, or never approved). */
export function fulfillRedemptionAsGuardian(redemptionId: string, actorId: string) {
  return rpc('fulfill_redemption', { p_redemption_id: UUID.parse(redemptionId), p_actor: UUID.parse(actorId) }, z.boolean());
}

const GuardianActionRow = z.object({
  id: z.string().uuid(),
  kind: z.enum(['manual_adjustment', 'goal_withdrawal']),
  kid_user_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  bucket: z.enum(WALLET_BUCKETS),
  goal_id: z.string().uuid().nullable(),
  amount: z.number().int(),
  reason: z.string(),
  created_at: z.string(),
});
export type GuardianActionRow = z.infer<typeof GuardianActionRow>;
const GUARDIAN_ACTION_FIELDS = 'id,kind,kid_user_id,actor_user_id,bucket,goal_id,amount,reason,created_at';

export async function listGuardianActions(kidId: string, limit = 50): Promise<GuardianActionRow[] | null> {
  const rows = await serviceRest<unknown>(
    `/wallet_guardian_actions?kid_user_id=eq.${eu(kidId)}&select=${GUARDIAN_ACTION_FIELDS}&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`,
  );
  const parsed = z.array(GuardianActionRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

/** The actions behind a page of ledger rows, keyed by id — never the whole history. */
export async function getGuardianActionsByIds(ids: string[]): Promise<Map<string, GuardianActionRow> | null> {
  const unique = [...new Set(ids)].map((id) => UUID.parse(id));
  if (unique.length === 0) return new Map();
  const rows = await serviceRest<unknown>(
    `/wallet_guardian_actions?id=in.(${unique.map(encodeURIComponent).join(',')})&select=${GUARDIAN_ACTION_FIELDS}`,
  );
  const parsed = z.array(GuardianActionRow).safeParse(rows);
  return parsed.success ? new Map(parsed.data.map((row) => [row.id, row])) : null;
}

// ── Guardian links: pending / rejected / revoked ───────────────────────────

export const LINK_STATUSES = ['pending', 'verified', 'rejected', 'revoked'] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

const LinkRow = z.object({
  id: z.string().uuid(),
  parent_user_id: z.string().uuid(),
  kid_user_id: z.string().uuid(),
  verification_status: z.enum(LINK_STATUSES),
  created_at: z.string(),
  verified_at: z.string().nullable(),
  decided_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});
export type LinkRow = z.infer<typeof LinkRow>;
const LINK_FIELDS = 'id,parent_user_id,kid_user_id,verification_status,created_at,verified_at,decided_at,revoked_at';

export async function listLinksForKid(kidId: string): Promise<LinkRow[] | null> {
  const rows = await serviceRest<unknown>(`/guardian_links?kid_user_id=eq.${eu(kidId)}&select=${LINK_FIELDS}&order=created_at.asc`);
  const parsed = z.array(LinkRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

/** The caller's own links that are NOT verified — what an invited or departed adult needs to see. */
export async function listOwnUnverifiedLinks(parentId: string): Promise<LinkRow[] | null> {
  const rows = await serviceRest<unknown>(
    `/guardian_links?parent_user_id=eq.${eu(parentId)}&verification_status=in.(pending,rejected,revoked)&select=${LINK_FIELDS}&order=created_at.desc&limit=50`,
  );
  const parsed = z.array(LinkRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

export async function getLinkStatus(parentId: string, kidId: string): Promise<LinkStatus | null | typeof UNAVAILABLE> {
  const rows = await serviceRest<unknown>(
    `/guardian_links?parent_user_id=eq.${eu(parentId)}&kid_user_id=eq.${eu(kidId)}&select=verification_status&limit=1`,
  );
  const parsed = z.array(z.object({ verification_status: z.enum(LINK_STATUSES) })).max(1).safeParse(rows);
  if (!parsed.success) return UNAVAILABLE;
  return parsed.data[0]?.verification_status ?? null;
}

export function decideGuardianLink(linkId: string, actorId: string, confirm: boolean) {
  return rpc('decide_guardian_link', { p_link_id: UUID.parse(linkId), p_actor: UUID.parse(actorId), p_confirm: confirm },
    z.enum(['verified', 'rejected']));
}

export function revokeOwnGuardianLink(kidId: string, actorId: string) {
  return rpc('revoke_own_guardian_link', { p_kid_user_id: UUID.parse(kidId), p_actor: UUID.parse(actorId) }, z.literal(true));
}

const DisplayRow = z.object({ user_id: z.string().uuid(), display_name: z.string().nullable() });

/** Display names only — never usernames, contact data or birth dates. */
export async function getDisplayNames(userIds: string[]): Promise<Map<string, string | null> | null> {
  const unique = [...new Set(userIds)].map((id) => UUID.parse(id));
  if (unique.length === 0) return new Map();
  const rows = await serviceRest<unknown>(
    `/profiles?user_id=in.(${unique.map(encodeURIComponent).join(',')})&select=user_id,display_name`,
  );
  const parsed = z.array(DisplayRow).safeParse(rows);
  return parsed.success ? new Map(parsed.data.map((row) => [row.user_id, row.display_name])) : null;
}

// ── D.4 metric ─────────────────────────────────────────────────────────────

const IntegrityRow = z.object({
  table_name: z.string(),
  transitions: z.coerce.number().int().nonnegative(),
  outside_service: z.coerce.number().int().nonnegative(),
});
export type IntegrityRow = z.infer<typeof IntegrityRow>;

export async function getFamilyStateIntegrity(since: Date): Promise<IntegrityRow[] | null> {
  const raw = await serviceRestRaw('/rpc/family_state_integrity', {
    method: 'POST',
    body: JSON.stringify({ p_since: since.toISOString() }),
  });
  if (!raw.ok) return null;
  const parsed = z.array(IntegrityRow).safeParse(raw.body);
  return parsed.success ? parsed.data : null;
}
