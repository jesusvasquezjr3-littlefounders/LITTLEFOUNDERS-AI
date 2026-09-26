import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { GUARDIAN_INVITE_LIFETIME_MS } from './guardianLifecycle.js';
import { isRefusal, UNAVAILABLE, type Refusal } from './familyLifecycle.js';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * S07.2 — D.3 (OD-3 Option B): the self-registered teen's personal wallet.
 *
 * Every write is a service-role RPC into the independent_teen_* migrations:
 * the database re-derives eligibility BY AGE (the stored age-screen
 * declaration, the under-13 origin marker, guest status, the kid/parent/staff
 * roles and a profile birth date), serializes on the holder's wallet lock,
 * refuses while a linked guardian's freeze holds and audits in the same
 * transaction. Core's admission (`readWalletAccess`) runs first so a caller
 * without a wallet gets a 403 before any RPC, but the database is the
 * enforcing boundary.
 *
 * Refusals arrive as PostgREST P0001 errors with a SCREAMING_SNAKE message;
 * anything else is UNAVAILABLE and is never read as a decision.
 */

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));

const RpcError = z.object({ code: z.literal('P0001'), message: z.string().regex(/^[A-Z][A-Z_]{2,63}$/) });

async function rpc<T>(name: string, args: Record<string, unknown>, shape: z.ZodType<T>): Promise<T | Refusal | typeof UNAVAILABLE> {
  const raw = await serviceRestRaw(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  if (!raw.ok) {
    const parsed = RpcError.safeParse(raw.body);
    return parsed.success ? { refused: parsed.data.message } : UNAVAILABLE;
  }
  const parsed = shape.safeParse(raw.body);
  return parsed.success ? parsed.data : UNAVAILABLE;
}

export { isRefusal, UNAVAILABLE };

// ── Who holds a wallet ─────────────────────────────────────────────────────

export const HOLDER_KINDS = ['managed_child', 'teen'] as const;
export type HolderKind = (typeof HOLDER_KINDS)[number];

export interface WalletAccess {
  /** null = no wallet at all (every adult, guest and ineligible account). */
  kind: HolderKind | null;
  /** null = not read (a parent-created child is a family child whatever the count). */
  verifiedGuardians: number | null;
}

const AccessRow = z.object({
  kind: z.enum(HOLDER_KINDS).nullable(),
  verified_guardians: z.coerce.number().int().nonnegative(),
}).strict();

/** null = the read failed; the caller refuses (a failed read never admits and never reclassifies). */
export async function readWalletAccess(userId: string): Promise<WalletAccess | null> {
  if (!UUID.safeParse(userId).success) return null;
  const raw = await serviceRestRaw('/rpc/wallet_access', { method: 'POST', body: JSON.stringify({ p_user: userId }) });
  if (!raw.ok) return null;
  const parsed = AccessRow.safeParse(raw.body);
  return parsed.success ? { kind: parsed.data.kind, verifiedGuardians: parsed.data.verified_guardians } : null;
}

/** A child in a family: a parent-created child, or a teen who linked a verified parent. */
export function isFamilyChild(access: WalletAccess): boolean {
  return access.kind === 'managed_child' || (access.kind === 'teen' && (access.verifiedGuardians ?? 0) > 0);
}

// ── The teen's own money actions ───────────────────────────────────────────

export const INCOME_SOURCES = ['allowance', 'gift', 'earned'] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export function logIncome(input: {
  holderId: string;
  source: IncomeSource;
  save: number;
  spend: number;
  share: number;
  goalId: string | null;
}) {
  return rpc('teen_log_income', {
    p_holder: UUID.parse(input.holderId),
    p_source: input.source,
    p_save: input.save,
    p_spend: input.spend,
    p_share: input.share,
    p_goal_id: input.goalId === null ? null : UUID.parse(input.goalId),
  }, UUID);
}

export function createPersonalReward(holderId: string, title: string, cost: number) {
  return rpc('teen_create_personal_reward', { p_holder: UUID.parse(holderId), p_title: title, p_cost: cost }, UUID);
}

/** true = archived now; false = it already was. */
export function archivePersonalReward(holderId: string, rewardId: string) {
  return rpc('teen_archive_personal_reward', { p_holder: UUID.parse(holderId), p_reward: UUID.parse(rewardId) }, z.boolean());
}

export function claimPersonalReward(holderId: string, rewardId: string) {
  return rpc('teen_claim_personal_reward', { p_holder: UUID.parse(holderId), p_reward: UUID.parse(rewardId) }, UUID);
}

export function releaseGoal(holderId: string, goalId: string, amount: number, destination: 'save' | 'spend') {
  return rpc('teen_release_goal', {
    p_holder: UUID.parse(holderId),
    p_goal_id: UUID.parse(goalId),
    p_amount: amount,
    p_destination: destination,
  }, UUID);
}

const PersonalRewardRow = z.object({
  id: z.string().uuid(),
  holder_user_id: z.string().uuid(),
  title: z.string(),
  cost: z.number().int(),
  status: z.enum(['active', 'archived']),
  created_at: z.string(),
  archived_at: z.string().nullable(),
});
export type PersonalRewardRow = z.infer<typeof PersonalRewardRow>;
const REWARD_FIELDS = 'id,holder_user_id,title,cost,status,created_at,archived_at';

export async function listPersonalRewards(holderId: string): Promise<PersonalRewardRow[] | null> {
  const rows = await serviceRest<unknown>(
    `/personal_rewards?holder_user_id=eq.${eu(holderId)}&select=${REWARD_FIELDS}&order=created_at.desc&limit=60`,
  );
  const parsed = z.array(PersonalRewardRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const SelfActionRow = z.object({
  id: z.string().uuid(),
  kind: z.enum(['self_income', 'personal_reward', 'goal_release']),
  holder_user_id: z.string().uuid(),
  source: z.enum(INCOME_SOURCES).nullable(),
  personal_reward_id: z.string().uuid().nullable(),
  goal_id: z.string().uuid().nullable(),
  destination: z.enum(['save', 'spend']).nullable(),
});
export type SelfActionRow = z.infer<typeof SelfActionRow>;

/** The self actions behind a page of ledger rows (with the reward title), keyed by id. null = unreadable. */
export async function getSelfActionDetails(ids: string[]): Promise<Map<string, SelfActionRow & { reward_title: string | null }> | null> {
  const unique = [...new Set(ids)].map((id) => UUID.parse(id));
  if (unique.length === 0) return new Map();
  const rows = await serviceRest<unknown>(
    `/wallet_self_actions?id=in.(${unique.map(encodeURIComponent).join(',')})&select=id,kind,holder_user_id,source,personal_reward_id,goal_id,destination`,
  );
  const parsed = z.array(SelfActionRow).safeParse(rows);
  if (!parsed.success) return null;
  const rewardIds = [...new Set(parsed.data.flatMap((a) => (a.personal_reward_id ? [a.personal_reward_id] : [])))];
  let titles = new Map<string, string>();
  if (rewardIds.length > 0) {
    const rewards = await serviceRest<unknown>(`/personal_rewards?id=in.(${rewardIds.map(encodeURIComponent).join(',')})&select=id,title`);
    const parsedRewards = z.array(z.object({ id: z.string().uuid(), title: z.string() })).safeParse(rewards);
    if (!parsedRewards.success) return null;
    titles = new Map(parsedRewards.data.map((r) => [r.id, r.title]));
  }
  return new Map(parsed.data.map((a) => [a.id, { ...a, reward_title: a.personal_reward_id ? titles.get(a.personal_reward_id) ?? null : null }]));
}

// ── The teen invites a parent later (optional, teen-initiated) ─────────────

/**
 * The same single-use, 7-day invite as a second Tutor's, issued by the teen
 * for their own account. The database refuses it for anyone but the teen and
 * bounds the outstanding invites (GUARDIAN_INVITE_LIMIT); a refusal is
 * reported as such, never as a transport failure.
 */
export async function createTeenGuardianInvite(teenId: string): Promise<{ token: string; expiresAt: string } | Refusal | typeof UNAVAILABLE> {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + GUARDIAN_INVITE_LIFETIME_MS).toISOString();
  const raw = await serviceRestRaw('/guardian_invites', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ kid_user_id: UUID.parse(teenId), created_by: UUID.parse(teenId), token, expires_at: expiresAt }),
  });
  if (raw.ok) return { token, expiresAt };
  const parsed = RpcError.safeParse(raw.body);
  return parsed.success ? { refused: parsed.data.message } : UNAVAILABLE;
}

const TeenLinkRow = z.object({
  id: z.string().uuid(),
  parent_user_id: z.string().uuid(),
  verification_status: z.enum(['pending', 'verified', 'rejected', 'revoked']),
  created_at: z.string(),
  verified_at: z.string().nullable(),
  decided_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  invite_id: z.string().uuid().nullable(),
});
export type TeenLinkRow = z.infer<typeof TeenLinkRow> & { selfInvited: boolean };

/** The teen's own guardian links, each marked with whether it came from the teen's own invite. */
export async function listTeenLinks(teenId: string): Promise<TeenLinkRow[] | null> {
  const rows = await serviceRest<unknown>(
    `/guardian_links?kid_user_id=eq.${eu(teenId)}&select=id,parent_user_id,verification_status,created_at,verified_at,decided_at,revoked_at,invite_id&order=created_at.asc`,
  );
  const parsed = z.array(TeenLinkRow).safeParse(rows);
  if (!parsed.success) return null;
  const inviteIds = [...new Set(parsed.data.flatMap((l) => (l.invite_id ? [l.invite_id] : [])))];
  let own = new Set<string>();
  if (inviteIds.length > 0) {
    const invites = await serviceRest<unknown>(
      `/guardian_invites?id=in.(${inviteIds.map(encodeURIComponent).join(',')})&created_by=eq.${eu(teenId)}&select=id`,
    );
    const parsedInvites = z.array(z.object({ id: z.string().uuid() })).safeParse(invites);
    if (!parsedInvites.success) return null;
    own = new Set(parsedInvites.data.map((i) => i.id));
  }
  return parsed.data.map((l) => ({ ...l, selfInvited: l.invite_id !== null && own.has(l.invite_id) }));
}

export function teenDecideGuardianLink(linkId: string, teenId: string, confirm: boolean) {
  return rpc('teen_decide_guardian_link', { p_link_id: UUID.parse(linkId), p_teen: UUID.parse(teenId), p_confirm: confirm },
    z.enum(['verified', 'rejected']));
}

/** Which invites a parent's own pending links came from a teen (the account holder confirms those, not a Tutor). */
export async function selfIssuedInviteIds(inviteIds: string[]): Promise<Set<string> | null> {
  const unique = [...new Set(inviteIds)].map((id) => UUID.parse(id));
  if (unique.length === 0) return new Set();
  const rows = await serviceRest<unknown>(
    `/guardian_invites?id=in.(${unique.map(encodeURIComponent).join(',')})&select=id,kid_user_id,created_by`,
  );
  const parsed = z.array(z.object({ id: z.string().uuid(), kid_user_id: z.string().uuid(), created_by: z.string().uuid().nullable() })).safeParse(rows);
  return parsed.success ? new Set(parsed.data.filter((i) => i.created_by === i.kid_user_id).map((i) => i.id)) : null;
}

/** Which of these accounts hold the `kid` role (parent-created children). null = unreadable. */
export async function getChildRoleHolders(userIds: string[]): Promise<Set<string> | null> {
  const unique = [...new Set(userIds)].map((id) => UUID.parse(id));
  if (unique.length === 0) return new Set();
  const rows = await serviceRest<unknown>(`/user_roles?user_id=in.(${unique.map(encodeURIComponent).join(',')})&role=eq.kid&select=user_id`);
  const parsed = z.array(z.object({ user_id: z.string().uuid() })).safeParse(rows);
  return parsed.success ? new Set(parsed.data.map((r) => r.user_id)) : null;
}

// ── Appendix H: Teen Independent-Mode Adoption (Diagnostic) ────────────────

const AdoptionRow = z.object({
  eligible_teens: z.coerce.number().int().nonnegative(),
  adopters: z.coerce.number().int().nonnegative(),
  independent_adopters: z.coerce.number().int().nonnegative(),
  linked_adopters: z.coerce.number().int().nonnegative(),
  new_adopters: z.coerce.number().int().nonnegative(),
});
export type AdoptionRow = z.infer<typeof AdoptionRow>;

export async function getTeenWalletAdoption(since: Date): Promise<AdoptionRow | null> {
  const raw = await serviceRestRaw('/rpc/teen_wallet_adoption', { method: 'POST', body: JSON.stringify({ p_since: since.toISOString() }) });
  if (!raw.ok) return null;
  const parsed = z.array(AdoptionRow).length(1).safeParse(raw.body);
  return parsed.success ? parsed.data[0]! : null;
}
