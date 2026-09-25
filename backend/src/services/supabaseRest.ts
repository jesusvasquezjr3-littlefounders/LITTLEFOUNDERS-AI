import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { getConfig } from '../config.js';

const UUID = z.string().uuid();
const eu = (val: string) => encodeURIComponent(UUID.parse(val).toString());
const es = (val: string) => encodeURIComponent(val.toString());

/*
 * PostgREST access in two grades:
 *  - asUser(token): the USER's JWT — RLS enforced by the database. Default.
 *  - asServiceRole(): bypasses RLS. ONLY for writes the schema deliberately
 *    reserves to the service role (role grants, parent_verifications,
 *    audit_logs) — never for reads on behalf of a user.
 */

interface RestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function rest<T>(path: string, token: string, init: RestInit = {}): Promise<T | null> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  let res: globalThis.Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  // Prefer: return=minimal and 204s come back with an empty body — success.
  const text = await res.text().catch(() => '');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  username: string | null;
  locale: string;
  theme: string;
  cover: Record<string, unknown>;
  created_at: string;
}

export interface RoleRow {
  role: string;
}

export function getOwnProfile(accessToken: string, userId: string): Promise<ProfileRow[] | null> {
  return rest<ProfileRow[]>(
    `/profiles?user_id=eq.${eu(userId)}&select=user_id,display_name,username,locale,theme,cover,created_at`,
    accessToken,
  );
}

export function getOwnRoles(accessToken: string, userId: string): Promise<RoleRow[] | null> {
  return rest<RoleRow[]>(`/user_roles?user_id=eq.${eu(userId)}&select=role`, accessToken);
}

export interface AdminPermissionRow {
  permission: string;
}

/** Session-scoped RLS read: a staff member can inspect only their own grants. */
export function getOwnAdminPermissions(accessToken: string, userId: string): Promise<AdminPermissionRow[] | null> {
  return rest<AdminPermissionRow[]>(
    `/admin_permissions?user_id=eq.${eu(userId)}&select=permission`,
    accessToken,
  );
}

interface RawResult {
  ok: boolean;
  status: number;
  body: unknown;
  contentRange: string | null;
}

/** Status-aware variant for callers that must distinguish failure modes. */
async function restRaw(path: string, token: string, init: RestInit = {}): Promise<RawResult> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const text = await res.text().catch(() => '');
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, contentRange: res.headers.get('content-range') };
  } catch {
    return { ok: false, status: 0, body: null, contentRange: null };
  }
}

// ── Profile identity (0005) ─────────────────────────────────

export interface FullProfileRow {
  user_id: string;
  display_name: string;
  username: string | null;
  locale: string;
  theme: string;
  cover: Record<string, unknown>;
  birth_date: string | null;
  created_at: string;
}

export interface CompletedCourseBadgeRow {
  course_slug: string;
  course_title: Record<string, unknown>;
  badge_asset: string;
  completed_at: string | null;
}

const PROFILE_FIELDS = 'user_id,display_name,username,locale,theme,cover,birth_date,created_at';

export function getFullOwnProfile(accessToken: string, userId: string): Promise<FullProfileRow[] | null> {
  return rest<FullProfileRow[]>(`/profiles?user_id=eq.${eu(userId)}&select=${PROFILE_FIELDS}`, accessToken);
}

export interface ProfilePatch {
  display_name?: string;
  username?: string;
  locale?: string;
  cover?: Record<string, unknown>;
  birth_date?: string;
}

export type PatchOutcome = 'ok' | 'conflict' | 'error';

/** Self-update through the USER's token — RLS enforces ownership. */
export async function patchOwnProfile(accessToken: string, userId: string, patch: ProfilePatch): Promise<PatchOutcome> {
  const res = await restRaw(`/profiles?user_id=eq.${eu(userId)}`, accessToken, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (res.ok) return 'ok';
  return res.status === 409 ? 'conflict' : 'error';
}

export interface AvatarRow {
  options: Record<string, unknown>;
}

export function getOwnAvatar(accessToken: string, userId: string): Promise<AvatarRow[] | null> {
  return rest<AvatarRow[]>(`/avatars?user_id=eq.${eu(userId)}&select=options`, accessToken);
}

/** Upsert via the USER's token (avatars self insert/update policies, 0002). */
export async function upsertOwnAvatar(accessToken: string, userId: string, options: Record<string, unknown>): Promise<boolean> {
  const res = await restRaw('/avatars?on_conflict=user_id', accessToken, {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, options }),
  });
  return res.ok;
}

// Public profile surface — service role, whitelisted fields ONLY (profiles
// RLS stays self+guardian; Core is the sole public window).

export function findProfileByUsername(username: string): Promise<FullProfileRow[] | null> {
  return rest<FullProfileRow[]>(`/profiles?username=eq.${es(username)}&select=${PROFILE_FIELDS}`, serviceToken());
}

export function getAvatarByUserId(userId: string): Promise<AvatarRow[] | null> {
  return rest<AvatarRow[]>(`/avatars?user_id=eq.${eu(userId)}&select=options`, serviceToken());
}

/** Course badges are awarded only when every current non-archived lesson passed. */
export async function getCompletedCourseBadgesByUserId(userId: string): Promise<CompletedCourseBadgeRow[]> {
  const response = await restRaw('/rpc/get_completed_course_badges', serviceToken(), {
    method: 'POST',
    body: JSON.stringify({ p_user_id: UUID.parse(userId).toString() }),
  });
  return response.ok && Array.isArray(response.body) ? (response.body as CompletedCourseBadgeRow[]) : [];
}

/**
 * Return an exact PostgREST row count, preserving upstream failures as null.
 * Dashboard KPIs must never turn an unavailable count into a believable zero.
 */
export async function countServiceRows(pathWithFilter: string): Promise<number | null> {
  const res = await restRaw(pathWithFilter, serviceToken(), {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) return null;
  const total = res.contentRange?.split('/').pop();
  if (!total || total === '*' || !/^\d+$/.test(total)) return null;
  const parsed = Number(total);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function countRows(pathWithFilter: string): Promise<number> {
  return (await countServiceRows(pathWithFilter)) ?? 0;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    countRows(`/follows?followed_id=eq.${eu(userId)}&select=follower_id`),
    countRows(`/follows?follower_id=eq.${eu(userId)}&select=followed_id`),
  ]);
  return { followers, following };
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const rows = await rest<unknown[]>(
    `/follows?follower_id=eq.${eu(followerId)}&followed_id=eq.${eu(followedId)}&select=follower_id`,
    serviceToken(),
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Follow via the USER's token — RLS guarantees follower_id = auth.uid(). */
export async function insertFollow(accessToken: string, followerId: string, followedId: string): Promise<boolean> {
  const res = await restRaw('/follows?on_conflict=follower_id,followed_id', accessToken, {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ follower_id: followerId, followed_id: followedId }),
  });
  return res.ok;
}

export async function deleteFollow(accessToken: string, followerId: string, followedId: string): Promise<boolean> {
  const result = await rest<boolean>('/rpc/withdraw_social_connection', accessToken, {
    method: 'POST',
    body: JSON.stringify({ p_follower_id: UUID.parse(followerId), p_followed_id: UUID.parse(followedId) }),
  });
  return result === true;
}

// ── Learning stats (0006) ────────────────────────────────────

export interface LearningStatsRow {
  xp_points: number;
  minutes_learned: number;
  lessons_completed: number;
  streak_days: number;
  longest_streak: number;
  last_active_date?: string | null;
}

const ZERO_STATS: LearningStatsRow = { xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null };

/** Self or guardian, per RLS. Every user has a row (0006 trigger) — zeroed default is a defensive fallback only. */
export async function getLearningStats(accessToken: string, userId: string): Promise<LearningStatsRow> {
  const rows = await rest<LearningStatsRow[]>(
    `/learning_stats?user_id=eq.${eu(userId)}&select=xp_points,minutes_learned,lessons_completed,streak_days,longest_streak,last_active_date`,
    accessToken,
  );
  return rows?.[0] ?? ZERO_STATS;
}

export async function getLearningStatsByUserId(userId: string): Promise<LearningStatsRow> {
  const rows = await rest<LearningStatsRow[]>(
    `/learning_stats?user_id=eq.${eu(userId)}&select=xp_points,minutes_learned,lessons_completed,streak_days,longest_streak,last_active_date`,
    serviceToken(),
  );
  return rows?.[0] ?? ZERO_STATS;
}

/** Same row, plus `last_active_date` (0009) — the day-streak anchor `services/streak.ts` compares against. Used only by POST /learn/lessons/:id/complete. */
export interface LearningStatsForUpdateRow extends LearningStatsRow {
  /** Local calendar date (YYYY-MM-DD) of the last passed lesson, null until the first pass. */
  last_active_date: string | null;
}

/**
 * Returns null when VAULT DID NOT ANSWER — never a zeroed row.
 *
 * This distinction is load-bearing and must not be "simplified" away. The one
 * caller (POST /learn/lessons/:id/complete) does a read-modify-write:
 * it adds deltas to what this returns and PATCHes the result back. If a
 * transient PostgREST failure (a pooler blip, a restart, a statement timeout)
 * were collapsed into ZERO_STATS the way the display-only readers above do,
 * the very next PATCH would overwrite a learner's accumulated xp_points,
 * minutes_learned, lessons_completed, streak_days and longest_streak with
 * deltas-from-zero — silently, behind a 200 response. minutes_learned and both
 * streak columns exist nowhere else, so that loss is permanent.
 *
 * An empty result set is still ZERO_STATS: the 0006 trigger guarantees every
 * user has a row, so that branch is only a defensive default for a brand-new
 * account, not a failure signal.
 */
export async function getLearningStatsForUpdate(userId: string): Promise<LearningStatsForUpdateRow | null> {
  const rows = await rest<LearningStatsForUpdateRow[]>(
    `/learning_stats?user_id=eq.${eu(userId)}&select=xp_points,minutes_learned,lessons_completed,streak_days,longest_streak,last_active_date`,
    serviceToken(),
  );
  if (rows === null) return null;
  return rows[0] ?? { ...ZERO_STATS, last_active_date: null };
}

// ── Follow / block lists (0006) ──────────────────────────────

export interface ListedUser {
  userId: string;
  displayName: string;
  username: string | null;
  avatarOptions: Record<string, unknown>;
  isTutor: boolean;
}

/** Batch-hydrate raw user ids into whitelisted public cards, service role (mirrors the public-profile window). */
async function hydrateUsers(ids: string[]): Promise<ListedUser[] | null> {
  if (ids.length === 0) return [];
  const idList = ids.join(',');
  const [profiles, avatars, tutorRoles] = await Promise.all([
    rest<Pick<FullProfileRow, 'user_id' | 'display_name' | 'username'>[]>(
      `/profiles?user_id=in.(${idList})&select=user_id,display_name,username`,
      serviceToken(),
    ),
    rest<(AvatarRow & { user_id: string })[]>(`/avatars?user_id=in.(${idList})&select=user_id,options`, serviceToken()),
    rest<{ user_id: string }[]>(`/user_roles?user_id=in.(${idList})&role=eq.parent&select=user_id`, serviceToken()),
  ]);
  if (profiles === null || avatars === null || tutorRoles === null) return null;
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));
  const avatarById = new Map((avatars ?? []).map((a) => [a.user_id, a.options]));
  const tutorIds = new Set((tutorRoles ?? []).map((r) => r.user_id));

  return ids
    .map((id) => {
      const p = profileById.get(id);
      if (!p) return null;
      return {
        userId: id,
        displayName: p.display_name,
        username: p.username,
        avatarOptions: avatarById.get(id) ?? {},
        isTutor: tutorIds.has(id),
      };
    })
    .filter((u): u is ListedUser => u !== null);
}

const LIST_LIMIT = 60;

export async function listFollowers(userId: string): Promise<ListedUser[]> {
  const rows = await rest<{ follower_id: string }[]>(
    `/follows?followed_id=eq.${eu(userId)}&select=follower_id&order=created_at.desc&limit=${LIST_LIMIT}`,
    serviceToken(),
  );
  return (await hydrateUsers((rows ?? []).map((r) => r.follower_id))) ?? [];
}

export async function listFollowing(userId: string): Promise<ListedUser[]> {
  const rows = await rest<{ followed_id: string }[]>(
    `/follows?follower_id=eq.${eu(userId)}&select=followed_id&order=created_at.desc&limit=${LIST_LIMIT}`,
    serviceToken(),
  );
  return (await hydrateUsers((rows ?? []).map((r) => r.followed_id))) ?? [];
}

export async function listBlocked(userId: string): Promise<ListedUser[]> {
  const rows = await rest<{ blocked_id: string }[]>(
    `/blocks?blocker_id=eq.${eu(userId)}&select=blocked_id&order=created_at.desc&limit=${LIST_LIMIT}`,
    serviceToken(),
  );
  return (await hydrateUsers((rows ?? []).map((r) => r.blocked_id))) ?? [];
}

export async function requestSocialConnection(requesterId: string, kidId: string): Promise<string | null> {
  const result = await rest<unknown>('/rpc/request_social_connection', serviceToken(), {
    method: 'POST', body: JSON.stringify({ p_requester_id: UUID.parse(requesterId), p_kid_user_id: UUID.parse(kidId) }),
  });
  const parsed = UUID.safeParse(result);
  return parsed.success ? parsed.data : null;
}

export async function decideSocialConnectionForKid(requestId: string, kidId: string, guardianId: string, approve: boolean): Promise<'approved' | 'denied' | 'not-found' | 'forbidden' | 'conflict' | 'unavailable'> {
  // Request participants are immutable to application roles; only decision fields can change through the RPC.
  const raw = await rest<unknown>(`/social_connection_requests?id=eq.${eu(requestId)}&kid_user_id=eq.${eu(kidId)}&select=id,kid_user_id&limit=1`, serviceToken());
  const rows = z.array(z.object({ id: UUID, kid_user_id: UUID })).max(1).safeParse(raw);
  if (!rows.success) return 'unavailable';
  if (rows.data.length === 0) return 'not-found';
  if (rows.data[0]!.id !== requestId || rows.data[0]!.kid_user_id !== kidId) return 'unavailable';
  const result = await restRaw('/rpc/decide_social_connection', serviceToken(), {
    method: 'POST', body: JSON.stringify({ p_request_id: requestId, p_guardian_id: UUID.parse(guardianId), p_approve: approve }),
  });
  const expected = approve ? 'approved' : 'denied';
  if (result.ok) return result.body === expected ? expected : 'unavailable';
  const error = z.object({ code: z.literal('P0001'), message: z.string() }).safeParse(result.body);
  if (!error.success) return 'unavailable';
  if (error.data.message === 'GUARDIAN_DECISION_FORBIDDEN') return 'forbidden';
  if (error.data.message === 'SOCIAL_REQUEST_NOT_FOUND') return 'not-found';
  if (['SOCIAL_DECISION_CONFLICT', 'SOCIAL_CONNECTION_BLOCKED', 'SOCIAL_REQUEST_UNAVAILABLE'].includes(error.data.message)) return 'conflict';
  return 'unavailable';
}

export async function getPendingSocialRequests(kidId: string, offset: number) {
  const raw = await rest<unknown>(`/social_connection_requests?kid_user_id=eq.${eu(kidId)}&status=eq.pending&select=id,requester_id,kid_user_id,status,requested_at&order=requested_at.asc,id.asc&offset=${offset}&limit=${LIST_LIMIT + 1}`, serviceToken());
  const parsed = z.array(z.object({ id: UUID, requester_id: UUID, kid_user_id: UUID, status: z.literal('pending'), requested_at: z.string().datetime({ offset: true }) })).safeParse(raw);
  if (!parsed.success) return null;
  const rows = parsed.data;
  return { requests: rows.slice(0, LIST_LIMIT).filter(row => row.kid_user_id === kidId).map(row => ({ requestId: row.id, requesterId: row.requester_id, requestedAt: row.requested_at, status: row.status })), nextOffset: rows.length > LIST_LIMIT ? offset + LIST_LIMIT : null };
}

/** Bounded display-name lookup for already-authorized social-history participants. */
export async function getSocialDisplayNames(ids: string[]) {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const rows = await rest<unknown>(`/profiles?user_id=in.(${unique.map(eu).join(',')})&select=user_id,display_name`, serviceToken());
  const parsed = z.array(z.object({ user_id: UUID, display_name: z.string().nullable() })).safeParse(rows);
  return parsed.success ? parsed.data.filter(row => unique.includes(row.user_id)) : null;
}

const SocialAuditRow = z.object({
  id: z.number().int().nonnegative().refine(Number.isSafeInteger),
  actor_id: UUID.nullable(),
  action: z.enum(['social.follow', 'social.unfollow', 'social.block', 'social.unblock']),
  detail: z.object({ origin: z.literal('database-trigger'), follower_id: UUID.optional(), followed_id: UUID.optional(), blocker_id: UUID.optional(), blocked_id: UUID.optional() }),
  created_at: z.string().datetime({ offset: true }),
});

/** Only fixed social participant fields reach Family; arbitrary audit detail never does. */
export async function getGuardianSocialAuditPage(kidId: string, offset: number) {
  const id = eu(kidId);
  const raw = await rest<unknown[]>(
    `/audit_logs?select=id,actor_id,action,detail,created_at&action=in.(social.follow,social.unfollow,social.block,social.unblock)&detail->>origin=eq.database-trigger&or=(detail->>follower_id.eq.${id},detail->>followed_id.eq.${id},detail->>blocker_id.eq.${id},detail->>blocked_id.eq.${id})&order=id.desc&offset=${offset}&limit=${LIST_LIMIT + 1}`,
    serviceToken(),
  );
  if (raw === null) return null;
  const entries = [];
  for (const value of raw.slice(0, LIST_LIMIT)) {
    const parsed = SocialAuditRow.safeParse(value);
    if (!parsed.success) return null;
    const row = parsed.data;
    const follow = row.action === 'social.follow' || row.action === 'social.unfollow';
    const sourceId = follow ? row.detail.follower_id : row.detail.blocker_id;
    const targetId = follow ? row.detail.followed_id : row.detail.blocked_id;
    if (!sourceId || !targetId) return null;
    // Defense in depth: a transport/filter defect must not expose another family's log.
    if (sourceId !== kidId && targetId !== kidId) continue;
    entries.push({ id: row.id, actorId: row.actor_id, action: row.action, sourceId, targetId, createdAt: row.created_at });
  }
  return { entries, nextOffset: raw.length > LIST_LIMIT ? offset + LIST_LIMIT : null };
}

/** Guardian graph reads must distinguish an unavailable source from an empty graph. */
export async function getGuardianSocialPage(userId: string, direction: 'followers' | 'following', offset: number): Promise<{ users: ListedUser[]; nextOffset: number | null } | null> {
  const subject = direction === 'followers' ? 'followed_id' : 'follower_id';
  const member = direction === 'followers' ? 'follower_id' : 'followed_id';
  const rows = await rest<Record<string, string>[]>(
    `/follows?${subject}=eq.${eu(userId)}&select=${member}&order=created_at.desc,${member}.asc&offset=${offset}&limit=${LIST_LIMIT + 1}`,
    serviceToken(),
  );
  if (rows === null) return null;
  const users = await hydrateUsers(rows.slice(0, LIST_LIMIT).map(row => row[member]!));
  if (users === null) return null;
  return { users, nextOffset: rows.length > LIST_LIMIT ? offset + LIST_LIMIT : null };
}

/** Either direction — mirrors the DB's is_blocked(), read via the service role. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const rows = await rest<unknown[]>(
    `/blocks?select=blocker_id&or=(and(blocker_id.eq.${eu(a)},blocked_id.eq.${eu(b)}),and(blocker_id.eq.${eu(b)},blocked_id.eq.${eu(a)}))`,
    serviceToken(),
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** A prior user-owned block is enough to manage that block without profile discovery. */
export async function hasOwnBlock(accessToken: string, blockerId: string, blockedId: string): Promise<boolean> {
  const rows = await rest<unknown>(`/blocks?blocker_id=eq.${eu(blockerId)}&blocked_id=eq.${eu(blockedId)}&select=blocker_id,blocked_id&limit=1`, accessToken);
  const parsed = z.array(z.object({ blocker_id: UUID, blocked_id: UUID })).max(1).safeParse(rows);
  return parsed.success && parsed.data.some(row => row.blocker_id === blockerId && row.blocked_id === blockedId);
}

/** Pending requests can be withdrawn without an already-visible follow edge. */
export async function hasOwnOpenSocialRequest(requesterId: string, kidId: string): Promise<boolean> {
  const rows = await rest<unknown>(`/social_connection_requests?requester_id=eq.${eu(requesterId)}&kid_user_id=eq.${eu(kidId)}&status=in.(pending,approved)&select=requester_id,kid_user_id&limit=1`, serviceToken());
  const parsed = z.array(z.object({ requester_id: UUID, kid_user_id: UUID })).max(1).safeParse(rows);
  return parsed.success && parsed.data.some(row => row.requester_id === requesterId && row.kid_user_id === kidId);
}

/** Migration 0098 commits block, bidirectional cleanup and request revocation together. */
export async function blockUser(accessToken: string, blockerId: string, blockedId: string): Promise<boolean> {
  const inserted = await restRaw('/blocks', accessToken, {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ blocker_id: UUID.parse(blockerId), blocked_id: UUID.parse(blockedId) }),
  });
  return inserted.ok;
}

export async function unblockUser(accessToken: string, blockerId: string, blockedId: string): Promise<boolean> {
  const res = await restRaw(`/blocks?blocker_id=eq.${eu(blockerId)}&blocked_id=eq.${eu(blockedId)}`, accessToken, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res.ok;
}

// ── Report escalation (0108, E.3) ──────────────────────────────

export const SOCIAL_REPORT_CATEGORIES = ['unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other'] as const;
export type SocialReportCategory = (typeof SOCIAL_REPORT_CATEGORIES)[number];
export const SOCIAL_REPORT_NOTE_MAX = 140;

export function isSocialReportCategory(value: string): value is SocialReportCategory {
  return (SOCIAL_REPORT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Migration 0108's service-only transaction: inserts the report, its audit
 * row, the guardian notices and the review-case/pattern evaluation in one
 * committed step. A retry with the same open pair returns the existing
 * report receipt (the function's own idempotency), so a duplicated request
 * never double-counts the pattern.
 */
export async function submitSocialReport(reporterId: string, subjectId: string, category: SocialReportCategory, note: string | null): Promise<{ id: string } | 'invalid' | 'unavailable'> {
  const raw = await restRaw('/rpc/submit_social_report', serviceToken(), {
    method: 'POST',
    body: JSON.stringify({
      p_reporter_id: UUID.parse(reporterId),
      p_subject_id: UUID.parse(subjectId),
      p_category: category,
      p_note: note,
    }),
  });
  if (raw.ok) {
    const parsed = UUID.safeParse(raw.body);
    return parsed.success ? { id: parsed.data } : 'unavailable';
  }
  const error = z.object({ code: z.literal('P0001') }).safeParse(raw.body);
  return error.success ? 'invalid' : 'unavailable';
}

const SocialSafetyNoticeRow = z.object({
  id: UUID,
  guardian_id: UUID,
  kid_user_id: UUID,
  kind: z.literal('social.report'),
  subject_id: UUID,
  report_id: UUID.nullable(),
  created_at: z.string().datetime({ offset: true }),
});

/** Guardian-scoped safety notices, read through Core's verified-parent boundary (E.3). */
export async function getGuardianSocialNotices(guardianId: string, offset: number) {
  const raw = await rest<unknown[]>(
    `/social_safety_notices?guardian_id=eq.${eu(guardianId)}&select=id,guardian_id,kid_user_id,kind,subject_id,report_id,created_at&order=created_at.desc,id.desc&offset=${offset}&limit=${LIST_LIMIT + 1}`,
    serviceToken(),
  );
  if (raw === null) return null;
  const parsed = z.array(SocialSafetyNoticeRow).safeParse(raw);
  if (!parsed.success) return null;
  const rows = parsed.data.filter((row) => row.guardian_id === guardianId).slice(0, LIST_LIMIT);
  return {
    notices: rows.map((row) => ({
      noticeId: row.id,
      kidUserId: row.kid_user_id,
      kind: row.kind,
      subjectId: row.subject_id,
      reportId: row.report_id,
      createdAt: row.created_at,
    })),
    nextOffset: raw.length > LIST_LIMIT ? offset + LIST_LIMIT : null,
  };
}

// ── Course hierarchy (0007, COURSE_ENGINE.md §2) ─────────────
// courses -> adventures -> sagas -> topics -> lessons -> lesson_documents.
// All hierarchy reads use the USER's own token — RLS's "published + every
// ancestor published" chain (0007) already does the filtering; Core layers
// per-user UNLOCK state on top in services/courseTree.ts (never in SQL).
// lesson_documents has NO SELECT policy at all (0007) — service role only,
// see getLessonDocument below.

type Json = Record<string, unknown>;

export interface CourseHierarchyRow {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  subject: string;
  position: number;
  badge_asset: string | null;
  /** 0048 — true while the course is live but still missing narration/illustrations. */
  in_progress: boolean;
  /** 0008 course-level prerequisite edges: slugs of courses that must be completed first (B.2). */
  requires?: string[];
}

const COURSE_HIERARCHY_FIELDS = 'id,slug,title,description,subject,position,badge_asset,in_progress,requires';

export function getPublishedCourseRows(accessToken: string): Promise<CourseHierarchyRow[] | null> {
  return rest<CourseHierarchyRow[]>(`/courses?status=eq.published&select=${COURSE_HIERARCHY_FIELDS}&order=position.asc`, accessToken);
}

export async function getPublishedCourseBySlug(accessToken: string, slug: string): Promise<CourseHierarchyRow | null> {
  const rows = await rest<CourseHierarchyRow[]>(
    `/courses?slug=eq.${es(slug)}&status=eq.published&select=${COURSE_HIERARCHY_FIELDS}`,
    accessToken,
  );
  return rows?.[0] ?? null;
}

export async function getPublishedCourseById(accessToken: string, courseId: string): Promise<CourseHierarchyRow | null> {
  const rows = await rest<CourseHierarchyRow[]>(
    `/courses?id=eq.${eu(courseId)}&status=eq.published&select=${COURSE_HIERARCHY_FIELDS}`,
    accessToken,
  );
  return rows?.[0] ?? null;
}

export interface AdventureHierarchyRow {
  id: string;
  course_id: string;
  position: number;
  slug: string;
  title: Json;
  description: Json;
  theme: string;
}

const ADVENTURE_FIELDS = 'id,course_id,position,slug,title,description,theme';

/** `in.(...)` filters short-circuit to [] on an empty id list — never send `in.()` to PostgREST. */
function inFilter(ids: string[]): string {
  return `in.(${ids.map(eu).join(',')})`;
}

/**
 * Production incident 2026-08-10: `financial-education` (1,208 lessons) was
 * the first course to put enough ids into a single `in.(...)` filter to
 * build a URL past Kong's request-line limit — `getLessonProgressForLessons`
 * came back HTTP 414, `rest()` maps ANY non-2xx to null the same as a genuine
 * outage, and `GET /api/v1/learn/courses` failed 502 for every real session,
 * indistinguishable in the logs from an infrastructure problem (which is what
 * the last hour was spent chasing before finding this).
 *
 * Batches the id list so no single request-line can grow with course size.
 * Each batch is an independent, fully-qualified query — never more than
 * ID_BATCH_SIZE rows can come back per request, so this needs no PostgREST
 * page-size handling (unlike a query with no id filter at all). A null from
 * any batch propagates as null instead of returning a partial list silently.
 */
const ID_BATCH_SIZE = 150;
async function restBatchedByIds<T>(
  ids: string[],
  fetchBatch: (batch: string[]) => Promise<T[] | null>,
): Promise<T[] | null> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) {
    const page = await fetchBatch(ids.slice(i, i + ID_BATCH_SIZE));
    if (page === null) return null;
    out.push(...page);
  }
  return out;
}

export function getAdventuresByCourseIds(accessToken: string, courseIds: string[]): Promise<AdventureHierarchyRow[] | null> {
  if (courseIds.length === 0) return Promise.resolve([]);
  return rest<AdventureHierarchyRow[]>(`/adventures?course_id=${inFilter(courseIds)}&select=${ADVENTURE_FIELDS}`, accessToken);
}

export async function getAdventureById(accessToken: string, adventureId: string): Promise<AdventureHierarchyRow | null> {
  const rows = await rest<AdventureHierarchyRow[]>(`/adventures?id=eq.${eu(adventureId)}&select=${ADVENTURE_FIELDS}`, accessToken);
  return rows?.[0] ?? null;
}

export interface SagaHierarchyRow {
  id: string;
  adventure_id: string;
  position: number;
  slug: string;
  title: Json;
  icon: string;
}

const SAGA_FIELDS = 'id,adventure_id,position,slug,title,icon';

export function getSagasByAdventureIds(accessToken: string, adventureIds: string[]): Promise<SagaHierarchyRow[] | null> {
  if (adventureIds.length === 0) return Promise.resolve([]);
  return rest<SagaHierarchyRow[]>(`/sagas?adventure_id=${inFilter(adventureIds)}&select=${SAGA_FIELDS}`, accessToken);
}

export async function getSagaById(accessToken: string, sagaId: string): Promise<SagaHierarchyRow | null> {
  const rows = await rest<SagaHierarchyRow[]>(`/sagas?id=eq.${eu(sagaId)}&select=${SAGA_FIELDS}`, accessToken);
  return rows?.[0] ?? null;
}

export interface PrerequisiteEdge {
  path: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface PlacementProbeContent {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface TopicHierarchyRow {
  id: string;
  saga_id: string;
  position: number;
  slug: string;
  title: Json;
  /** Spaced-review projection (0016): 'teaching' | review kinds. */
  kind: string;
  /** Raw catalog slug paths ("adv/saga" or "adv/saga/topic") this review topic cites. */
  review_of: string[];
  /** Competency-graph projection (0042): non-obvious prerequisite edges beyond the implicit "previous lesson" one. */
  prerequisites: PrerequisiteEdge[];
  /** Competency-graph projection (0042): null until Forge authors one for this topic (COURSE_ENGINE.md §3.2). */
  placement_probe: Partial<Record<'en-US' | 'es-MX' | 'pt-BR', PlacementProbeContent>> | null;
}

const TOPIC_FIELDS = 'id,saga_id,position,slug,title,kind,review_of,prerequisites,placement_probe';

export function getTopicsBySagaIds(accessToken: string, sagaIds: string[]): Promise<TopicHierarchyRow[] | null> {
  if (sagaIds.length === 0) return Promise.resolve([]);
  return restBatchedByIds(sagaIds, (batch) =>
    rest<TopicHierarchyRow[]>(`/topics?saga_id=${inFilter(batch)}&select=${TOPIC_FIELDS}`, accessToken),
  );
}

export async function getTopicById(accessToken: string, topicId: string): Promise<TopicHierarchyRow | null> {
  const rows = await rest<TopicHierarchyRow[]>(`/topics?id=eq.${eu(topicId)}&select=${TOPIC_FIELDS}`, accessToken);
  return rows?.[0] ?? null;
}

export interface LessonHierarchyRow {
  id: string;
  topic_id: string;
  position: number;
  slug: string;
  title: Json;
  difficulty: number;
  xp_total: number;
  estimated_minutes: number;
}

const LESSON_FIELDS = 'id,topic_id,position,slug,title,difficulty,xp_total,estimated_minutes';

export function getLessonsByTopicIds(accessToken: string, topicIds: string[]): Promise<LessonHierarchyRow[] | null> {
  if (topicIds.length === 0) return Promise.resolve([]);
  return restBatchedByIds(topicIds, (batch) =>
    rest<LessonHierarchyRow[]>(`/lessons?topic_id=${inFilter(batch)}&select=${LESSON_FIELDS}`, accessToken),
  );
}

/** Single lesson by id — RLS's published-chain policy means a hit here also proves "published w/ published ancestors". */
export async function getLessonById(accessToken: string, lessonId: string): Promise<LessonHierarchyRow | null> {
  const rows = await rest<LessonHierarchyRow[]>(`/lessons?id=eq.${eu(lessonId)}&select=${LESSON_FIELDS}`, accessToken);
  return rows?.[0] ?? null;
}

export interface LessonProgressRow {
  lesson_id: string;
  best_score: number;
  passed: boolean;
  attempts: number;
  xp_earned: number;
}

export function getLessonProgressForLessons(accessToken: string, userId: string, lessonIds: string[]): Promise<LessonProgressRow[] | null> {
  if (lessonIds.length === 0) return Promise.resolve([]);
  return restBatchedByIds(lessonIds, (batch) =>
    rest<LessonProgressRow[]>(
      `/lesson_progress?user_id=eq.${eu(userId)}&lesson_id=${inFilter(batch)}&select=lesson_id,best_score,passed,attempts,xp_earned`,
      accessToken,
    ),
  );
}

export async function getLessonProgressRow(accessToken: string, userId: string, lessonId: string): Promise<LessonProgressRow | null> {
  const rows = await rest<LessonProgressRow[]>(
    `/lesson_progress?user_id=eq.${eu(userId)}&lesson_id=eq.${eu(lessonId)}&select=lesson_id,best_score,passed,attempts,xp_earned`,
    accessToken,
  );
  return rows?.[0] ?? null;
}

// ── Lesson documents (0007) — SERVICE ROLE ONLY, no SELECT policy exists ───

export interface LessonDocumentRow {
  /** Present only for an activated immutable v2 document; never exposed to the browser. */
  document_version_id?: string;
  lesson_id: string;
  locale: string;
  schema_version: number;
  document: Json;
  answer_keys: Json;
  /** Echo's narration manifest — `{version, voice_profile, units: {unit_id: {url, duration_ms, …}}}`, `{}` until narrated. */
  audio: Json;
  updated_at: string;
}

/** Every locale row for one lesson (≤3) — used for the caller-locale → es-MX → any fallback (LESSON_ENGINE.md §3). */
export function getLessonDocumentLocales(lessonId: string): Promise<LessonDocumentRow[] | null> {
  return rest<LessonDocumentRow[]>(
    `/lesson_documents?lesson_id=eq.${eu(lessonId)}&select=lesson_id,locale,schema_version,document,answer_keys,audio,updated_at`,
    serviceToken(),
  );
}

interface V2CurrentLessonDocumentPointer {
  lesson_id: string;
  locale: string;
  document_version_id: string;
}

interface V2LessonDocumentVersionRow {
  id: string;
  lesson_id: string;
  locale: string;
  schema_version: number;
  document: Json;
  answer_keys: Json;
  audio: Json;
  created_at: string;
}

/**
 * Reads only explicitly activated immutable v2 versions. An empty result is
 * an ordinary legacy fallback; null is an unavailable content service.
 */
export async function getCurrentV2LessonDocumentLocales(lessonId: string): Promise<LessonDocumentRow[] | null> {
  const pointers = await rest<V2CurrentLessonDocumentPointer[]>(
    `/lesson_document_version_current?lesson_id=eq.${eu(lessonId)}&select=lesson_id,locale,document_version_id`,
    serviceToken(),
  );
  if (pointers === null) return null;
  if (pointers.length === 0) return [];
  const ids = [...new Set(pointers.map((pointer) => pointer.document_version_id))];
  const versions = await restBatchedByIds(ids, (batch) => rest<V2LessonDocumentVersionRow[]>(
    `/lesson_document_versions?id=${inFilter(batch)}&select=id,lesson_id,locale,schema_version,document,answer_keys,audio,created_at`,
    serviceToken(),
  ));
  if (versions === null) return null;
  const byId = new Map(versions.map((version) => [version.id, version]));
  const rows: LessonDocumentRow[] = [];
  for (const pointer of pointers) {
    const version = byId.get(pointer.document_version_id);
    if (!version || version.lesson_id !== pointer.lesson_id || version.locale !== pointer.locale) return null;
    rows.push({
      document_version_id: version.id, lesson_id: version.lesson_id, locale: version.locale, schema_version: version.schema_version,
      document: version.document, answer_keys: version.answer_keys, audio: version.audio, updated_at: version.created_at,
    });
  }
  return rows;
}

/**
 * Resolves the immutable document named by an already-authenticated v2 run.
 * `undefined` is an unavailable content service; `null` is a missing or
 * malformed version and must not be mistaken for a legacy fallback.
 */
export async function getV2LessonDocumentVersion(documentVersionId: string): Promise<LessonDocumentRow | null | undefined> {
  const versions = await rest<V2LessonDocumentVersionRow[]>(
    `/lesson_document_versions?id=eq.${eu(documentVersionId)}&select=id,lesson_id,locale,schema_version,document,answer_keys,audio,created_at`,
    serviceToken(),
  );
  if (versions === null) return undefined;
  const version = versions[0];
  if (!version || version.id !== documentVersionId || version.schema_version !== 2) return null;
  return {
    document_version_id: version.id, lesson_id: version.lesson_id, locale: version.locale, schema_version: version.schema_version,
    document: version.document, answer_keys: version.answer_keys, audio: version.audio, updated_at: version.created_at,
  };
}

export interface V2LessonRunInsert {
  id: string;
  user_id: string;
  lesson_id: string;
  locale: string;
  document_version_id: string;
  expires_at: string;
}

/** A v2 run is only created by Core after it selected an activated immutable version. */
export async function createV2LessonRun(row: V2LessonRunInsert): Promise<boolean> {
  const result = await restRaw('/lesson_v2_runs', serviceToken(), {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row),
  });
  return result.ok;
}

export interface V2LessonAttemptNonceInsert {
  jti: string;
  user_id: string;
  run_id: string;
  document_version_id: string;
  segment_id: string;
  expires_at: string;
}

/** Nonces are persisted before their signed browser tokens are returned. */
export async function createV2LessonAttemptNonces(rows: V2LessonAttemptNonceInsert[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const result = await restRaw('/lesson_v2_attempt_nonces', serviceToken(), {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows),
  });
  return result.ok;
}

export interface V2LessonRunRecoveryRow {
  id: string;
  user_id: string;
  lesson_id: string;
  locale: string;
  document_version_id: string;
  expires_at: string;
  completed_at: string | null;
}

/** Service-only lookup for a checkpointed run; it never exposes the row to the browser. */
export async function getV2LessonRunForRecovery(userId: string, lessonId: string, runId: string): Promise<V2LessonRunRecoveryRow | null | undefined> {
  const rows = await rest<V2LessonRunRecoveryRow[]>(
    `/lesson_v2_runs?id=eq.${eu(runId)}&user_id=eq.${eu(userId)}&lesson_id=eq.${eu(lessonId)}&select=id,user_id,lesson_id,locale,document_version_id,expires_at,completed_at`,
    serviceToken(),
  );
  if (rows === null) return undefined;
  const row = rows[0];
  return row && row.id === runId && row.user_id === userId && row.lesson_id === lessonId ? row : null;
}

export interface V2AttemptNonceRecoveryRow {
  jti: string;
  segment_id: string;
  expires_at: string;
  consumed_at: string | null;
}

/** The JTI remains server-owned until this point; it is re-signed, never stored in the browser. */
export function getV2LessonAttemptNoncesForRecovery(userId: string, runId: string, documentVersionId: string): Promise<V2AttemptNonceRecoveryRow[] | null> {
  return rest<V2AttemptNonceRecoveryRow[]>(
    `/lesson_v2_attempt_nonces?user_id=eq.${eu(userId)}&run_id=eq.${eu(runId)}&document_version_id=eq.${eu(documentVersionId)}&select=jti,segment_id,expires_at,consumed_at`,
    serviceToken(),
  );
}

export interface V2GradeReceiptRecoveryRow {
  segment_id: string;
  verdict: { correct?: unknown; score?: unknown };
}

/** Client-safe resume projection: only completed segment IDs whose server receipt is met. */
export function getV2MetSegmentReceiptsForRecovery(userId: string, runId: string, documentVersionId: string): Promise<V2GradeReceiptRecoveryRow[] | null> {
  return rest<V2GradeReceiptRecoveryRow[]>(
    `/lesson_v2_grade_receipts?user_id=eq.${eu(userId)}&run_id=eq.${eu(runId)}&document_version_id=eq.${eu(documentVersionId)}&select=segment_id,verdict`,
    serviceToken(),
  );
}

const V2GradeReceipt = z.union([
  z.object({ replayed: z.boolean(), verdict: z.object({ correct: z.boolean(), score: z.number().int().min(0).max(100) }), retry_jti: z.string().optional() }),
  z.object({ blocked: z.literal(true) }),
]);

/** The SQL transaction atomically burns the nonce and persists its immutable verdict. */
export async function recordV2LessonGrade(payload: {
  p_user_id: string; p_run_id: string; p_document_version_id: string; p_segment_id: string; p_jti: string;
  p_required_met_segment_id: string | null;
  p_verdict: { correct: boolean; score: number };
  p_next_jti: string;
  p_next_expires_at: string;
}): Promise<z.infer<typeof V2GradeReceipt> | null> {
  const result = await rest<unknown>('/rpc/record_v2_lesson_grade_retry', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  const parsed = V2GradeReceipt.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** M1 requires an earlier representation to have been attempted, not mastered. */
export async function recordV2CpaGrade(payload: {
  p_user_id: string; p_run_id: string; p_document_version_id: string; p_segment_id: string; p_jti: string;
  p_required_attempted_segment_id: string | null;
  p_verdict: { correct: boolean; score: number };
  p_next_jti: string;
  p_next_expires_at: string;
}): Promise<z.infer<typeof V2GradeReceipt> | null> {
  const result = await rest<unknown>('/rpc/record_v2_cpa_grade_retry', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  const parsed = V2GradeReceipt.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** M1 is diagnostic-only: an unavailable diagnostic writer must never discard a valid lesson receipt. */
export async function recordV2FirstUnaidedStage(payload: {
  p_user_id: string; p_document_version_id: string; p_fading_group_id: string;
  p_stage: 'concrete' | 'pictorial' | 'abstract'; p_receipt_jti: string;
}): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_v2_first_unaided_stage', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  return result !== null;
}

// ── Lesson segment attempts (0007) — SERVICE ROLE writes, self-read RLS ────

export interface SegmentAttemptRow {
  segment_id: string;
  attempt_number: number;
  score: number;
}

const GradeReceipt = z.discriminatedUnion('exhausted', [
  z.object({ exhausted: z.literal(true) }),
  z.object({ exhausted: z.literal(false), verdict: z.object({
    correct: z.boolean(), score: z.number().min(0).max(100),
    tier: z.enum(['perfect', 'great', 'almost', 'tryAgain']),
    feedback_md: z.string().optional(), reveal: z.unknown().optional(), allowRetry: z.boolean(),
  }) }),
]);

/** Only the database transaction may allocate an attempt number or reveal the final answer. */
export async function recordLessonGrade(payload: {
  p_user_id: string; p_lesson_id: string; p_run_id: string | null; p_segment_id: string;
  p_client_attempt: number; p_max_attempts: number; p_hints_used: number;
  p_verdict: unknown; p_context: Record<string, unknown>;
}): Promise<z.infer<typeof GradeReceipt> | null> {
  const result = await rest<unknown>('/rpc/record_lesson_grade', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  const parsed = GradeReceipt.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/**
 * Self-read (RLS `user_id = auth.uid() OR verified guardian`) — the user's own
 * token is enough. When `runId` is given, only THIS run's attempts are returned
 * so /complete scores the run the kid just played, not a lifetime best (0012).
 */
export function getSegmentAttempts(accessToken: string, userId: string, lessonId: string, runId?: string): Promise<SegmentAttemptRow[] | null> {
  const runFilter = runId ? `&run_id=eq.${eu(runId)}` : '';
  return rest<SegmentAttemptRow[]>(
    `/lesson_segment_attempts?user_id=eq.${eu(userId)}&lesson_id=eq.${eu(lessonId)}${runFilter}&select=segment_id,attempt_number,score`,
    accessToken,
  );
}

/** No client INSERT/UPDATE policy (0007) — Core (service role) is the only writer. Upsert by (user_id, lesson_id). */
export async function upsertLessonProgress(
  userId: string,
  lessonId: string,
  patch: { best_score: number; passed: boolean; attempts: number; xp_earned: number; completed_at: string | null },
): Promise<boolean> {
  const res = await restRaw('/lesson_progress?on_conflict=user_id,lesson_id', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, lesson_id: lessonId, ...patch }),
  });
  return res.ok;
}

/** Learning stats are system-written only (0006) — Core applies the XP/lesson/minute/streak delta via service role. */
export async function patchLearningStats(
  userId: string,
  patch: { xp_points: number; minutes_learned: number; lessons_completed: number; streak_days: number; longest_streak?: number; last_active_date?: string },
): Promise<boolean> {
  const res = await restRaw(`/learning_stats?user_id=eq.${eu(userId)}`, serviceToken(), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

// ── Service-role writes ─────────────────────────────────────

function serviceToken(): string {
  return getConfig().SUPABASE_SERVICE_ROLE_KEY;
}

export interface ParentVerificationInsert {
  user_id: string;
  given_names: string;
  surnames: string;
  birth_date: string;
  /** A.5: no longer collected or written — the DB default covers pre-existing rows; the form claim was removed because the image content cannot validate the declaration. */
  document_type?: string;
  checks: Record<string, boolean>;
}

export async function insertParentVerification(row: ParentVerificationInsert): Promise<boolean> {
  const res = await rest<unknown>('/parent_verifications', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

/** Idempotent role grant (PK user_id+role → duplicates ignored). */
export async function grantRole(userId: string, role: string, grantedBy: string): Promise<boolean> {
  const res = await rest<unknown>('/user_roles?on_conflict=user_id,role', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, role, granted_by: grantedBy }),
  });
  return res !== null;
}

export async function grantAdminPermission(userId: string, permission: string, grantedBy: string): Promise<boolean> {
  const res = await rest<unknown>('/admin_permissions?on_conflict=user_id,permission', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, permission, granted_by: grantedBy }),
  });
  return res !== null;
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const rows = await rest<RoleRow[]>(`/user_roles?user_id=eq.${eu(userId)}&role=eq.${role}&select=role`, serviceToken());
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * E.5: the Tutor badge is a verified-adult signal, not a platform-wide
 * public badge. It is shown only when the subject is a currently ID-verified
 * parent AND the viewer has an established relationship: the subject's own
 * verified-linked kid, a mutual follow (the approved-connection gate), the
 * subject themself, or staff. A kid-role account with no established
 * relationship never sees it. An ambiguous read hides the badge (fail
 * closed — an absence is safer than an unearned trust signal).
 */
export async function tutorBadgeVisible(viewerId: string, subjectId: string): Promise<boolean> {
  if (viewerId === subjectId) return true;
  const staffViewer = await hasRole(viewerId, 'admin') || await hasRole(viewerId, 'superadmin');
  if (staffViewer) return true;
  const [linked, subjectVerification, mutualFollow] = await Promise.all([
    rest<{ id: string }[]>(
      `/guardian_links?parent_user_id=eq.${eu(subjectId)}&kid_user_id=eq.${eu(viewerId)}&verification_status=eq.verified&select=id&limit=1`,
      serviceToken(),
    ),
    rest<unknown[]>(
      `/parent_verifications?user_id=eq.${eu(subjectId)}&select=status,method,birth_date&order=created_at.desc,id.desc&limit=1`,
      serviceToken(),
    ),
    (async () => {
      const [a, b] = await Promise.all([
        rest<{ id: string }[]>(`/follows?follower_id=eq.${eu(viewerId)}&followed_id=eq.${eu(subjectId)}&select=id&limit=1`, serviceToken()),
        rest<{ id: string }[]>(`/follows?follower_id=eq.${eu(subjectId)}&followed_id=eq.${eu(viewerId)}&select=id&limit=1`, serviceToken()),
      ]);
      return Array.isArray(a) && a.length > 0 && Array.isArray(b) && b.length > 0;
    })(),
  ]);
  if (!Array.isArray(subjectVerification) || subjectVerification.length === 0) return false;
  const latest = subjectVerification[0] as { status?: unknown; method?: unknown; birth_date?: unknown } | undefined;
  if (!latest || latest.status !== 'verified' || latest.method !== 'local-ocr') return false;
  if (!Array.isArray(linked)) return false;
  return linked.length > 0 || mutualFollow;
}

export async function revokeAdminPermission(userId: string, permission: string): Promise<boolean> {
  const res = await restRaw(`/admin_permissions?user_id=eq.${eu(userId)}&permission=eq.${permission}`, serviceToken(), {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res.ok;
}

/**
 * Append-only audit entry (no PII in detail — booleans/ids only). Returns
 * whether the row landed: audit_logs is the only record of staff actions, so
 * high-stakes callers must be able to detect (and loudly log) a lost trail.
 *
 * `actorId` accepts `null` for a SYSTEM action — a scheduled job with no human
 * behind it (the tutor retention sweep, `routes/tutor.ts`'s
 * `/retention/purge`), rather than a staff member's own click. `audit_logs.
 * actor_id` has always been nullable (`0001_identity.sql`: `REFERENCES
 * auth.users(id) ON DELETE SET NULL`) for exactly this reason; fabricating an
 * id that names no real user would violate the foreign key, and attributing a
 * system action to whichever staff member happened to trigger the workflow
 * dispatch would misrepresent who did it.
 */
export async function insertAuditLog(actorId: string | null, action: string, subject: string, detail: Record<string, unknown>): Promise<boolean> {
  const res = await rest<unknown>('/audit_logs', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: actorId, action, subject, detail }),
  });
  return res !== null;
}

/**
 * Service-role PostgREST access for the STAFF CONSOLE only (services/adminData.ts).
 * Bypasses RLS, so it is gated at the route layer by requireRole(['admin',
 * 'superadmin']) — never expose this to a user-scoped path. Reads across all
 * users' rows (the console's whole job) and the review→published content gate
 * both live behind it because the schema deliberately grants admins no RLS.
 */
export function serviceRest<T>(path: string, init: RestInit = {}): Promise<T | null> {
  return rest<T>(path, serviceToken(), init);
}

/** Status-aware service-role variant for RPC receipts whose failure modes differ. */
export function serviceRestRaw(path: string, init: RestInit = {}): Promise<{ ok: boolean; body: unknown }> {
  return restRaw(path, serviceToken(), init).then(({ ok, body }) => ({ ok, body }));
}

/** B.3's operational counter is written only by Core after it isolates one bad course. */
export async function recordCourseAssemblyIncident(courseId: string): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_course_assembly_incident', serviceToken(), {
    method: 'POST',
    body: JSON.stringify({ p_course_id: UUID.parse(courseId) }),
  });
  return result !== null;
}

/** Revoke a role (DELETE). The DB's audit_role_change trigger records it; the
 * BEFORE DELETE guards (parent-cascade / last-guardian) still apply. */
export async function revokeRole(userId: string, role: string): Promise<boolean> {
  const res = await rest<unknown>(`/user_roles?user_id=eq.${eu(userId)}&role=eq.${es(role)}`, serviceToken(), {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res !== null;
}

// ── Family (guardian-brokered reads — routes/family.ts) ─────────────────────

export interface GuardianLinkRow {
  parent_user_id: string;
  kid_user_id: string;
  verification_status: string;
}

/** The caller's VERIFIED kid links. Service role: guardian_links has no parent SELECT policy; the route layer is the guard (§1.3 app-layer half). */
export function getVerifiedKidLinks(parentUserId: string): Promise<GuardianLinkRow[] | null> {
  return serviceRest<GuardianLinkRow[]>(
    `/guardian_links?parent_user_id=eq.${eu(parentUserId)}&verification_status=eq.verified&select=parent_user_id,kid_user_id,verification_status`,
  );
}

export async function hasCurrentSocialApproval(viewerId: string, subjectId: string): Promise<boolean> {
  const result = await rest<boolean>('/rpc/has_current_social_approval', serviceToken(), {
    method: 'POST',
    body: JSON.stringify({ p_viewer: UUID.parse(viewerId), p_subject: UUID.parse(subjectId) }),
  });
  return result === true;
}

/** The mirror image of getVerifiedKidLinks, read from the KID's own side — a kid's own verified guardians (routes/tasks.ts, resolving "my guardians' redemption catalog"). */
export async function getVerifiedGuardiansOfKid(kidUserId: string): Promise<string[] | null> {
  const rows = await serviceRest<{ parent_user_id: string }[]>(
    `/guardian_links?kid_user_id=eq.${eu(kidUserId)}&verification_status=eq.verified&select=parent_user_id`,
  );
  if (rows === null) return null;
  return rows.map((r) => r.parent_user_id);
}

/*
 * The link that makes a kid account legitimate. §1.3: a `kid` row without a
 * VERIFIED guardian link is a bug, not a state - so this is written `verified`
 * outright rather than `pending`. The verification already happened: only a
 * Guardian-verified `parent` can reach the route that calls this, and their
 * identity document was matched before that role was granted. A `pending` row
 * here would describe a second, imaginary check that nothing performs.
 */
export async function insertVerifiedGuardianLink(parentUserId: string, kidUserId: string): Promise<boolean> {
  const res = await rest<unknown>('/guardian_links', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      parent_user_id: parentUserId,
      kid_user_id: kidUserId,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
    }),
  });
  return res !== null;
}

/*
 * The kid's profile row. GoTrue's own trigger (migration 0011) seeds
 * display_name and locale from user_metadata; this adds what only the family
 * flow knows - the handle the child signs in with, and the birth date that
 * decides their age band.
 */
export async function patchKidProfile(
  kidUserId: string,
  patch: { username: string; display_name: string; locale: string; birth_date: string | null },
): Promise<boolean> {
  const res = await rest<unknown>(`/profiles?user_id=eq.${eu(kidUserId)}`, serviceToken(), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return res !== null;
}

/*
 * The whitelisted profile fields a guardian may change on a child. NOT the
 * username: the child's `auth.users` address is DERIVED from it, so renaming
 * the handle without renaming the address would strand the account behind an
 * identifier nothing can reproduce at sign-in.
 */
export async function patchKidProfileFields(
  kidUserId: string,
  patch: { display_name?: string; birth_date?: string | null },
): Promise<boolean> {
  const res = await rest<unknown>(`/profiles?user_id=eq.${eu(kidUserId)}`, serviceToken(), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return res !== null;
}

/*
 * Answers the question the DB's unique index would otherwise answer with a
 * 409 AFTER an auth user had already been created. Checked before anything is
 * written, so the common "that name is taken" case never leaves a half-made
 * account behind.
 */
export async function usernameExists(username: string): Promise<boolean | null> {
  const rows = await serviceRest<{ user_id: string }[]>(
    `/profiles?username=eq.${es(username)}&select=user_id&limit=1`,
  );
  if (rows === null) return null;
  return rows.length > 0;
}

export interface KidProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  /** Server-side only: feeds the F.4 share age_band computation, never a response field. */
  birth_date: string | null;
}

/** WHITELISTED kid profile fields for the family dashboard — never the whole row (mirrors the /@username whitelist discipline). */
export function getKidProfiles(kidIds: string[]): Promise<KidProfileRow[] | null> {
  if (kidIds.length === 0) return Promise.resolve([]);
  return serviceRest<KidProfileRow[]>(`/profiles?user_id=${inFilter(kidIds)}&select=user_id,display_name,username,birth_date`);
}

export interface KidLearningStatsRow {
  user_id: string;
  xp_points: number;
  lessons_completed: number;
  streak_days: number;
  longest_streak: number;
  last_active_date: string | null;
}

/** A kid's learning_stats row, read AFTER the route verified the guardian link. */
export function getKidLearningStats(kidId: string): Promise<KidLearningStatsRow[] | null> {
  return serviceRest<KidLearningStatsRow[]>(
    `/learning_stats?user_id=eq.${eu(kidId)}&select=user_id,xp_points,lessons_completed,streak_days,longest_streak,last_active_date`,
  );
}

/** A kid's lesson_progress rows, read AFTER the route verified the guardian link (parent tokens can't pass lesson_progress_select_own). */
export function getKidLessonProgress(kidId: string, lessonIds: string[]): Promise<LessonProgressRow[] | null> {
  if (lessonIds.length === 0) return Promise.resolve([]);
  return restBatchedByIds(lessonIds, (batch) =>
    serviceRest<LessonProgressRow[]>(
      `/lesson_progress?user_id=eq.${eu(kidId)}&lesson_id=${inFilter(batch)}&select=lesson_id,best_score,passed,attempts,xp_earned`,
    ),
  );
}

// ── Onboarding (0041) ────────────────────────────────────────

export interface OnboardingResponseRow {
  user_id: string;
  discovery_channel: string | null;
  account_offer_choice: string;
  completed_at: string;
}

/** Existence check — the idempotency marker for POST /onboarding/complete. Service role: Core is the only writer/reader of this system record. */
export function getOnboardingResponse(userId: string): Promise<OnboardingResponseRow[] | null> {
  return serviceRest<OnboardingResponseRow[]>(`/onboarding_responses?user_id=eq.${eu(userId)}&select=user_id,discovery_channel,account_offer_choice,completed_at`);
}

export async function insertOnboardingResponse(row: {
  user_id: string;
  discovery_channel: string | null;
  account_offer_choice: string;
}): Promise<boolean> {
  const res = await serviceRest<unknown>('/onboarding_responses', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

// ── Placement (0043) ─────────────────────────────────────────

export interface CoursePlacementRow {
  user_id: string;
  course_id: string;
  claimed_level: string;
  education_level: string;
  method: string;
  created_at: string;
}

/** Existence check + result — the idempotency marker for POST /placement/:slug/complete, and the source of CourseTree.course.placementRequired. Own-row RLS: the caller's token is enough. */
/*
 * The PLURAL placement reads exist so GET /learn/courses can ask once for the
 * whole shelf instead of once per course. Same table, same columns, one
 * `in.()` — no extra concurrency, which is the point: running the per-course
 * reads in parallel would multiply Core's outbound connections by a number
 * content controls, against a PostgREST pool sized in Railway.
 */
export function getCoursePlacementsForCourses(
  accessToken: string,
  userId: string,
  courseIds: string[],
): Promise<CoursePlacementRow[] | null> {
  if (courseIds.length === 0) return Promise.resolve([]);
  return rest<CoursePlacementRow[]>(
    `/course_placements?user_id=eq.${eu(userId)}&course_id=${inFilter(courseIds)}&select=user_id,course_id,claimed_level,education_level,method,created_at`,
    accessToken,
  );
}

/** `course_id` is selected here and not in the singular read, because the caller has to group by it. */
export function getPlacementCreditsForCourses(
  accessToken: string,
  userId: string,
  courseIds: string[],
): Promise<(PlacementCreditRow & { course_id: string })[] | null> {
  if (courseIds.length === 0) return Promise.resolve([]);
  return rest<(PlacementCreditRow & { course_id: string })[]>(
    `/placement_credits?user_id=eq.${eu(userId)}&course_id=${inFilter(courseIds)}&select=lesson_id,course_id`,
    accessToken,
  );
}

export function getCoursePlacement(accessToken: string, userId: string, courseId: string): Promise<CoursePlacementRow[] | null> {
  return rest<CoursePlacementRow[]>(
    `/course_placements?user_id=eq.${eu(userId)}&course_id=eq.${eu(courseId)}&select=user_id,course_id,claimed_level,education_level,method,created_at`,
    accessToken,
  );
}

export interface PlacementCreditRow {
  lesson_id: string;
}

export function getPlacementCreditsForCourse(accessToken: string, userId: string, courseId: string): Promise<PlacementCreditRow[] | null> {
  return rest<PlacementCreditRow[]>(`/placement_credits?user_id=eq.${eu(userId)}&course_id=eq.${eu(courseId)}&select=lesson_id`, accessToken);
}

/** Server-computed, service role — same posture as upsertLessonProgress/patchLearningStats: the client never writes its own placement result. */
export async function commitCoursePlacement(row: {
  user_id: string;
  course_id: string;
  claimed_level: string;
  education_level: string;
  quiz_answers: unknown;
  start_topic_id: string | null;
  start_lesson_id: string | null;
  method: string;
}, lessonIds: readonly string[]): Promise<'created' | 'replayed' | 'conflict' | null> {
  const result = await serviceRest<unknown>('/rpc/commit_course_placement', {
    method: 'POST', body: JSON.stringify({ p_result: row, p_lesson_ids: lessonIds }),
  });
  return result === 'created' || result === 'replayed' || result === 'conflict' ? result : null;
}

// ── Shareable achievement badges (0073) ─────────────────────

export interface BadgeShareInsert {
  token: string;
  kid_user_id: string;
  created_by: string;
  achievement_kind: 'course_badge' | 'streak' | 'goal_reached';
  achievement_label: string;
  first_name: string;
  age_band: '6-8' | '9-11' | '12-14' | null;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
  /** The exact URL Depot returned — NOT reconstructed from bucket/hash/ext (see 0073's column comment). */
  image_url: string;
  /** F.2 (0109): sent explicitly so a new share always gets the 30-day window, never a DB default drift. */
  expires_at: string;
}

/** Service role only — badge_shares has no client INSERT policy (0073). */
export async function insertBadgeShare(row: BadgeShareInsert): Promise<boolean> {
  const res = await serviceRest<unknown>('/badge_shares', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

export interface BadgeShareRow extends BadgeShareInsert {
  id: string;
  created_at: string;
  /** F.2 (0109): the window end. Enforced by Core on every public read. */
  expires_at: string;
  /** F.2 (0109): NULL = live; non-NULL = revoked and unreachable. */
  revoked_at: string | null;
}

const BADGE_SHARE_FIELDS =
  'token,kid_user_id,created_by,achievement_kind,achievement_label,first_name,age_band,image_bucket,image_hash,image_ext,image_url,id,created_at,expires_at,revoked_at';

/**
 * Looked up by the PUBLIC badge landing page (routes/badgePublic.ts) — a
 * stranger's request, so this reads ONLY by the opaque token (never by kid
 * or user id) and the route layer whitelists the response down to the four
 * display fields (no kid_user_id/created_by leaves Core on that path).
 * Deliberately does NOT filter on expires_at/revoked_at here: the public
 * route must be able to tell "revoked/expired" apart from "never existed"
 * so it can trigger the lazy image purge.
 */
export async function getBadgeShareByToken(token: string): Promise<BadgeShareRow | null> {
  const rows = await serviceRest<BadgeShareRow[]>(`/badge_shares?token=eq.${es(token)}&select=${BADGE_SHARE_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/** The parent-facing share list (routes/family.ts) — live shares only, newest first. */
export function listActiveBadgeSharesForKid(kidUserId: string): Promise<BadgeShareRow[] | null> {
  return serviceRest<BadgeShareRow[]>(
    `/badge_shares?kid_user_id=eq.${eu(kidUserId)}&revoked_at=is.null&expires_at=gt.${es(new Date().toISOString())}` +
      `&select=${BADGE_SHARE_FIELDS}&order=created_at.desc`,
  );
}

/**
 * Compare-and-swap revoke (F.2): marks the row revoked ONLY IF it is still
 * un-revoked, scoped to the token AND the kid so a guardian of kid A can
 * never touch a row whose token happens to belong to kid B. Returns the
 * updated row, or null on no-match (already revoked, or foreign row) —
 * indistinguishable from a transport failure by design (§1.14); the route
 * re-reads to give the idempotent "already revoked" answer.
 */
export async function revokeBadgeShare(token: string, kidUserId: string): Promise<BadgeShareRow | null> {
  const rows = await serviceRest<BadgeShareRow[]>(
    `/badge_shares?token=eq.${es(token)}&kid_user_id=eq.${eu(kidUserId)}&revoked_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    },
  );
  return rows?.[0] ?? null;
}

/**
 * True if some OTHER LIVE share still references this exact badge image.
 * Depot is content-addressed, so two shares of the same achievement dedupe
 * to one object — before purging a revoked/expired share's image the caller
 * must confirm nothing live still needs it. Returns null on a transport
 * failure: the caller must treat that as "still referenced" and skip the
 * delete (§1.14 — never destroy on an ambiguous read).
 */
export async function badgeShareImageStillReferencedElsewhere(
  excludeToken: string,
  bucket: string,
  hash: string,
): Promise<boolean | null> {
  const rows = await serviceRest<{ id: string }[]>(
    `/badge_shares?token=neq.${es(excludeToken)}&image_bucket=eq.${es(bucket)}&image_hash=eq.${es(hash)}` +
      `&revoked_at=is.null&expires_at=gt.${es(new Date().toISOString())}&select=id&limit=1`,
  );
  if (rows === null) return null;
  return rows.length > 0;
}

// ── Family Hub: tasks, wallet, goals, redemption catalog ────────────────────
// FAMILY_HUB.md. "Family" here is a kid + their verified guardians, derived
// from guardian_links (0074, D1) — there is no separate family/household
// entity anywhere in this schema.

export interface TaskRow {
  id: string;
  assigned_by: string;
  assigned_to: string;
  title: string;
  reward_coins: number;
  recurrence: string;
  due_at: string | null;
  status: string;
  allocated: boolean;
  created_at: string;
  evidence_bucket: string | null;
  evidence_hash: string | null;
  evidence_ext: string | null;
  evidence_uploaded_at: string | null;
  cancel_reason: string | null;
  requires_evidence: boolean;
  /** S07.3 (D.10): an expected family contribution (0-2 coins) or a paid bonus task. */
  kind: 'contribution' | 'bonus';
  /** S07.3 (D.2): the child's local day of the completion, stamped once at open -> done. */
  completed_on: string | null;
}

const TASK_FIELDS =
  'id,assigned_by,assigned_to,title,reward_coins,recurrence,due_at,status,allocated,created_at,evidence_bucket,evidence_hash,evidence_ext,evidence_uploaded_at,cancel_reason,requires_evidence,kind,completed_on';

export async function insertTask(row: {
  assigned_by: string;
  assigned_to: string;
  title: string;
  reward_coins: number;
  recurrence: string;
  due_at: string | null;
  requires_evidence: boolean;
  kind: 'contribution' | 'bonus';
}): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>('/tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

export function getTasksForKid(kidId: string): Promise<TaskRow[] | null> {
  return serviceRest<TaskRow[]>(`/tasks?assigned_to=eq.${eu(kidId)}&select=${TASK_FIELDS}&order=created_at.desc`);
}

export function getTasksForKids(kidIds: string[]): Promise<TaskRow[] | null> {
  if (kidIds.length === 0) return Promise.resolve([]);
  return serviceRest<TaskRow[]>(`/tasks?assigned_to=${inFilter(kidIds)}&select=${TASK_FIELDS}&order=created_at.desc`);
}

export async function getTaskById(taskId: string): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>(`/tasks?id=eq.${eu(taskId)}&select=${TASK_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/**
 * Attaches (or replaces) a proof-of-work photo pointer on a task — but ONLY
 * if the row is still `open` or `done` at the moment of the write, the same
 * compare-and-swap idiom `transitionTaskStatus` uses below. Without this
 * filter, a photo uploaded in the seconds between the route's earlier status
 * read and this PATCH lands on the row regardless of what happened to it in
 * between — including a parent's `approve` racing in first, attaching
 * "evidence" to a decision that has already been made. Returns null on
 * no-match exactly like transitionTaskStatus: the caller must not try to
 * tell "someone decided it first" apart from a transport failure (§1.14).
 */
export async function setTaskEvidence(
  taskId: string,
  evidence: { bucket: string; hash: string; ext: string },
): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>(`/tasks?id=eq.${eu(taskId)}&status=in.(open,done)`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      evidence_bucket: evidence.bucket,
      evidence_hash: evidence.hash,
      evidence_ext: evidence.ext,
      evidence_uploaded_at: new Date().toISOString(),
    }),
  });
  return rows?.[0] ?? null;
}

/**
 * True if some OTHER task row still points at this exact bucket/hash/ext.
 * Depot is content-addressed (identical bytes dedupe to one object), so
 * before deleting a superseded evidence photo the caller must confirm
 * nothing else still needs it — otherwise a byte-for-byte-identical replace
 * on one task could delete the photo out from under a different task that
 * happens to share the same image. Returns null on a transport failure, in
 * which case the caller must treat it as "still referenced" and skip the
 * delete (§1.14 — never destroy on an ambiguous read).
 */
export async function evidenceStillReferencedElsewhere(
  excludeTaskId: string,
  bucket: string,
  hash: string,
  ext: string,
): Promise<boolean | null> {
  const rows = await serviceRest<{ id: string }[]>(
    `/tasks?id=neq.${eu(excludeTaskId)}&evidence_bucket=eq.${es(bucket)}&evidence_hash=eq.${es(hash)}&evidence_ext=eq.${es(ext)}&select=id&limit=1`,
  );
  if (rows === null) return null;
  return rows.length > 0;
}

/**
 * Compare-and-swap status transition: succeeds only if the row's CURRENT
 * status is exactly `fromStatus`. This is the row-level conditional PATCH
 * idiom `closeTutorSession` already established (tutorData.ts) for
 * first-write-wins on a single row — correct here because every task
 * transition (open→done, done→approved, open|done→cancelled) is exactly one
 * row, unlike the wallet's multi-row aggregate which needed the 0075/0076
 * Postgres functions instead. Returns null on no-match (already transitioned,
 * or never was in `fromStatus`) exactly like a transport failure — the
 * caller cannot and must not distinguish "someone else already approved
 * this" from "the network dropped it"; either way nothing further should
 * happen from this request (§1.14).
 */
export async function transitionTaskStatus(
  taskId: string,
  fromStatus: string,
  toStatus: string,
  extra?: Record<string, unknown>,
): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>(`/tasks?id=eq.${eu(taskId)}&status=eq.${es(fromStatus)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: toStatus, ...extra }),
  });
  return rows?.[0] ?? null;
}

export interface WalletLedgerRow {
  id: number;
  kid_user_id: string;
  bucket: string;
  amount: number;
  reason: string;
  task_id: string | null;
  goal_id: string | null;
  redemption_id: string | null;
  /** S07.1: set on manual_adjustment / goal_withdrawal rows — the wallet_guardian_actions row holding the reason. */
  guardian_action_id: string | null;
  /** S07.2: set on self_income / personal_reward / goal_release rows — the teen's own wallet_self_actions row. */
  self_action_id: string | null;
  created_at: string;
}

const WALLET_LEDGER_FIELDS = 'id,kid_user_id,bucket,amount,reason,task_id,goal_id,redemption_id,guardian_action_id,self_action_id,created_at';

export function getWalletLedger(kidId: string, limit: number): Promise<WalletLedgerRow[] | null> {
  return serviceRest<WalletLedgerRow[]>(
    `/wallet_ledger?kid_user_id=eq.${eu(kidId)}&select=${WALLET_LEDGER_FIELDS}&order=created_at.desc&limit=${limit}`,
  );
}

export interface WalletBalances {
  save: number;
  spend: number;
  share: number;
}

/**
 * A bucket balance is SUM(amount), computed here rather than read from a
 * counter — /AGENTS.md §1.14: a value derived from a corrupted read must
 * degrade to "unreadable, refuse" (a `null` return), never a silently wrong
 * number. Row volume per kid is small (an occasional chore, not a
 * high-frequency ledger), so summing in Node rather than adding a
 * server-side view is the "boring, cheap, verifiable" choice (§1.0).
 */
export async function getWalletBalances(kidId: string): Promise<WalletBalances | null> {
  const rows = await serviceRest<{ bucket: string; amount: number }[]>(
    `/wallet_ledger?kid_user_id=eq.${eu(kidId)}&select=bucket,amount`,
  );
  if (rows === null) return null;
  const balances: WalletBalances = { save: 0, spend: 0, share: 0 };
  for (const row of rows) {
    if (row.bucket === 'save' || row.bucket === 'spend' || row.bucket === 'share') {
      balances[row.bucket] += row.amount;
    }
  }
  return balances;
}

// ── Task streak (0080) was a single counter maintained with the learning
// streak's all-or-nothing arithmetic. S07.3 (D.2) replaced it with recorded
// practised days and the lapse-tolerant model: services/choreStreak.ts and
// services/choreStreakData.ts. kid_task_streaks is now read only as the
// legacy floor for the best streak. ─────────────────────────────────────────

/**
 * The only path that credits a task's reward. The TOTAL is never
 * client-supplied — it is the task's own `reward_coins`, read and enforced
 * inside `allocate_task_reward` (0075/0076) — only the three-way SPLIT is,
 * and the function rejects any split that doesn't sum to exactly that total.
 * `null` means the RPC call itself failed (network/transport); `false` means
 * the function ran and refused (already allocated, wrong status, bad split,
 * bad goal tag) — the caller (the route) turns `false` into a 409 and `null`
 * into a 502, never treating either as "nothing happened, safe to retry
 * silently" for a request that could also have partially landed server-side.
 */
export async function allocateTaskReward(input: {
  taskId: string;
  kidId: string;
  save: number;
  spend: number;
  share: number;
  createdBy: string;
  goalId: string | null;
}): Promise<boolean | null> {
  const res = await serviceRest<boolean>('/rpc/allocate_task_reward', {
    method: 'POST',
    body: JSON.stringify({
      p_task_id: input.taskId,
      p_kid_user_id: input.kidId,
      p_save: input.save,
      p_spend: input.spend,
      p_share: input.share,
      p_created_by: input.createdBy,
      p_goal_id: input.goalId,
    }),
  });
  return typeof res === 'boolean' ? res : null;
}

export interface GoalRow {
  id: string;
  kid_user_id: string;
  title: string;
  target: number;
  icon: string;
  status: string;
  created_at: string;
  reached_at: string | null;
}

const GOAL_FIELDS = 'id,kid_user_id,title,target,icon,status,created_at,reached_at';

export async function insertGoal(row: { kid_user_id: string; title: string; target: number; icon: string }): Promise<GoalRow | null> {
  const rows = await serviceRest<GoalRow[]>('/savings_goals', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

export function getGoalsForKid(kidId: string): Promise<GoalRow[] | null> {
  return serviceRest<GoalRow[]>(`/savings_goals?kid_user_id=eq.${eu(kidId)}&select=${GOAL_FIELDS}&order=created_at.desc`);
}

export async function getGoalById(goalId: string): Promise<GoalRow | null> {
  const rows = await serviceRest<GoalRow[]>(`/savings_goals?id=eq.${eu(goalId)}&select=${GOAL_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/** A goal's progress is a TAG on wallet_ledger rows, never a second copy of the total (FAMILY_HUB.md §6, 0076's own header). */
export async function getGoalProgress(goalId: string): Promise<number | null> {
  const rows = await serviceRest<{ amount: number }[]>(`/wallet_ledger?goal_id=eq.${eu(goalId)}&select=amount`);
  if (rows === null) return null;
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export async function markGoalReached(goalId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/savings_goals?id=eq.${eu(goalId)}&status=eq.active`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'reached', reached_at: new Date().toISOString() }),
  });
  return res !== null;
}

export async function archiveGoal(goalId: string, kidId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/savings_goals?id=eq.${eu(goalId)}&kid_user_id=eq.${eu(kidId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'archived' }),
  });
  return res !== null;
}

export interface CatalogItemRow {
  id: string;
  parent_user_id: string;
  title: string;
  cost: number;
  active: boolean;
  created_at: string;
}

const CATALOG_FIELDS = 'id,parent_user_id,title,cost,active,created_at';

export async function insertCatalogItem(row: { parent_user_id: string; title: string; cost: number }): Promise<CatalogItemRow | null> {
  const rows = await serviceRest<CatalogItemRow[]>('/redemption_catalog', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

export function getCatalogForParent(parentId: string): Promise<CatalogItemRow[] | null> {
  return serviceRest<CatalogItemRow[]>(`/redemption_catalog?parent_user_id=eq.${eu(parentId)}&select=${CATALOG_FIELDS}&order=created_at.desc`);
}

/** Only ACTIVE items — a kid never sees something a parent turned off. */
export function getCatalogForGuardians(parentIds: string[]): Promise<CatalogItemRow[] | null> {
  if (parentIds.length === 0) return Promise.resolve([]);
  return serviceRest<CatalogItemRow[]>(
    `/redemption_catalog?parent_user_id=${inFilter(parentIds)}&active=eq.true&select=${CATALOG_FIELDS}&order=created_at.desc`,
  );
}

export async function getCatalogItemById(itemId: string): Promise<CatalogItemRow | null> {
  const rows = await serviceRest<CatalogItemRow[]>(`/redemption_catalog?id=eq.${eu(itemId)}&select=${CATALOG_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

export async function setCatalogItemActive(itemId: string, parentId: string, active: boolean): Promise<boolean> {
  const res = await serviceRest<unknown>(`/redemption_catalog?id=eq.${eu(itemId)}&parent_user_id=eq.${eu(parentId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ active }),
  });
  return res !== null;
}

export interface RedemptionRow {
  id: string;
  catalog_id: string;
  kid_user_id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  /** S07.1 (OD-21): set when a verified guardian marks the approved reward delivered. */
  fulfilled_at: string | null;
}

const REDEMPTION_FIELDS = 'id,catalog_id,kid_user_id,status,created_at,decided_at,decided_by,fulfilled_at';

export async function insertRedemption(row: { catalog_id: string; kid_user_id: string }): Promise<RedemptionRow | null> {
  const rows = await serviceRest<RedemptionRow[]>('/redemptions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

export function getRedemptionsForKid(kidId: string): Promise<RedemptionRow[] | null> {
  return serviceRest<RedemptionRow[]>(`/redemptions?kid_user_id=eq.${eu(kidId)}&select=${REDEMPTION_FIELDS}&order=created_at.desc`);
}

export function getRedemptionsForKids(kidIds: string[]): Promise<RedemptionRow[] | null> {
  if (kidIds.length === 0) return Promise.resolve([]);
  return serviceRest<RedemptionRow[]>(`/redemptions?kid_user_id=${inFilter(kidIds)}&select=${REDEMPTION_FIELDS}&order=created_at.desc`);
}

export async function getRedemptionById(redemptionId: string): Promise<RedemptionRow | null> {
  const rows = await serviceRest<RedemptionRow[]>(`/redemptions?id=eq.${eu(redemptionId)}&select=${REDEMPTION_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/**
 * Approving debits the kid's spend bucket by the catalog item's cost, checked
 * against the CURRENT balance inside the same locked transaction
 * (0075/0076's `decide_redemption`) — never trusted from a prior read here.
 * Same null/false split as `allocateTaskReward`: null is a transport
 * failure, false is a refusal (already decided, or balance now insufficient).
 */
export async function decideRedemption(redemptionId: string, approve: boolean, decidedBy: string): Promise<boolean | null> {
  const res = await serviceRest<boolean>('/rpc/decide_redemption', {
    method: 'POST',
    body: JSON.stringify({ p_redemption_id: redemptionId, p_approve: approve, p_decided_by: decidedBy }),
  });
  return typeof res === 'boolean' ? res : null;
}

// ── Digital Banking (0081) — BANKING.md Waves 0-2: a named account +
// card, automated allowance, a "Parent-Paid" savings bonus, and a spend
// limit. Still LF Coins, still closed-loop — see BANKING.md §0/§13. ──

export interface BankingAccountRow {
  kid_user_id: string;
  nickname: string;
  card_design: string;
  display_number: string;
  frozen: boolean;
  frozen_by: string | null;
  frozen_at: string | null;
  opened_by: string;
  opened_at: string;
}

const BANKING_ACCOUNT_FIELDS = 'kid_user_id,nickname,card_design,display_number,frozen,frozen_by,frozen_at,opened_by,opened_at';

/**
 * `undefined` means "couldn't check" (transport failure) — DISTINCT from
 * `null`, "confirmed no account yet." Collapsing them would show a parent
 * the "open your account" empty state over an account that actually exists,
 * on nothing worse than a blip (/AGENTS.md §1.14). The four config reads
 * below (allowance/bonus/spend-limit rules) make the same distinction for
 * the same reason.
 */
export async function getBankingAccount(kidId: string): Promise<BankingAccountRow | null | undefined> {
  const rows = await serviceRest<BankingAccountRow[]>(`/banking_accounts?kid_user_id=eq.${eu(kidId)}&select=${BANKING_ACCOUNT_FIELDS}&limit=1`);
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

/**
 * Structurally NOT a real card number: 8 digits, letter prefix, a grouping
 * (LF-####-####) no card network uses. A kid who screenshots this and types
 * it into a real payment field gets an obvious reject by FORMAT alone — see
 * `displayNumber.test.ts`, which is the regression this function exists to
 * keep passing (BANKING.md §2, §10).
 */
export function generateDisplayNumber(): string {
  const group = () => String(Math.floor(1000 + randomInt(9000))).padStart(4, '0');
  return `LF-${group()}-${group()}`;
}

export async function insertBankingAccount(row: {
  kid_user_id: string;
  nickname: string;
  card_design: string;
  opened_by: string;
}): Promise<BankingAccountRow | null> {
  const rows = await serviceRest<BankingAccountRow[]>('/banking_accounts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...row, display_number: generateDisplayNumber() }),
  });
  return rows?.[0] ?? null;
}

export async function updateBankingAccount(kidId: string, patch: { nickname?: string; card_design?: string }): Promise<BankingAccountRow | null> {
  const rows = await serviceRest<BankingAccountRow[]>(`/banking_accounts?kid_user_id=eq.${eu(kidId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return rows?.[0] ?? null;
}

export async function setBankingAccountFrozen(kidId: string, frozen: boolean, frozenBy: string): Promise<BankingAccountRow | null> {
  // A child cannot overwrite the attribution and then clear a guardian freeze.
  // The filter is checked by PostgreSQL in the same statement as the update.
  const ownership = frozenBy === kidId ? `&or=(frozen.eq.false,frozen_by.eq.${eu(kidId)})` : '';
  const rows = await serviceRest<BankingAccountRow[]>(`/banking_accounts?kid_user_id=eq.${eu(kidId)}${ownership}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ frozen, frozen_by: frozenBy, frozen_at: frozen ? new Date().toISOString() : null }),
  });
  return rows?.[0] ?? null;
}

export interface AllowanceRuleRow {
  id: string;
  kid_user_id: string;
  parent_user_id: string;
  amount: number;
  frequency: string;
  anchor_day: number;
  active: boolean;
  next_run_at: string;
  created_at: string;
}

const ALLOWANCE_RULE_FIELDS = 'id,kid_user_id,parent_user_id,amount,frequency,anchor_day,active,next_run_at,created_at';

export async function getAllowanceRule(kidId: string): Promise<AllowanceRuleRow | null | undefined> {
  const rows = await serviceRest<AllowanceRuleRow[]>(`/allowance_rules?kid_user_id=eq.${eu(kidId)}&select=${ALLOWANCE_RULE_FIELDS}&limit=1`);
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

/** One rule per kid (0081's `unique (kid_user_id)`) — an edit REPLACES the whole row, including `next_run_at`, computed fresh by the caller from today. */
export async function upsertAllowanceRule(row: {
  kid_user_id: string;
  parent_user_id: string;
  amount: number;
  frequency: string;
  anchor_day: number;
  active: boolean;
  next_run_at: string;
}): Promise<AllowanceRuleRow | null> {
  const rows = await serviceRest<AllowanceRuleRow[]>('/allowance_rules?on_conflict=kid_user_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

export interface SavingsBonusRuleRow {
  kid_user_id: string;
  parent_user_id: string;
  rate_bp: number;
  active: boolean;
  next_run_at: string;
  created_at: string;
  /** S07.3 (D.11): the rate a rule had before it moved to its child's age framing; cleared on the Tutor's next save. */
  reframed_from_rate_bp: number | null;
}

const SAVINGS_BONUS_RULE_FIELDS = 'kid_user_id,parent_user_id,rate_bp,active,next_run_at,created_at,reframed_from_rate_bp';

export async function getSavingsBonusRule(kidId: string): Promise<SavingsBonusRuleRow | null | undefined> {
  const rows = await serviceRest<SavingsBonusRuleRow[]>(`/savings_bonus_rules?kid_user_id=eq.${eu(kidId)}&select=${SAVINGS_BONUS_RULE_FIELDS}&limit=1`);
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

export interface SpendLimitRow {
  kid_user_id: string;
  parent_user_id: string;
  period: string;
  cap: number;
  active: boolean;
  created_at: string;
}

const SPEND_LIMIT_FIELDS = 'kid_user_id,parent_user_id,period,cap,active,created_at';

export async function getSpendLimit(kidId: string): Promise<SpendLimitRow | null | undefined> {
  const rows = await serviceRest<SpendLimitRow[]>(`/spend_limits?kid_user_id=eq.${eu(kidId)}&select=${SPEND_LIMIT_FIELDS}&limit=1`);
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

export async function upsertSpendLimit(row: {
  kid_user_id: string;
  parent_user_id: string;
  period: string;
  cap: number;
  active: boolean;
}): Promise<SpendLimitRow | null> {
  const rows = await serviceRest<SpendLimitRow[]>('/spend_limits?on_conflict=kid_user_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? null;
}

/**
 * Rolling window, not a calendar-aligned week/month — `spend_limits` carries
 * no anchor day (unlike allowance), and a rolling "last N days" is simpler,
 * unambiguous across time zones, and still resets continuously the way the
 * UI promises ("resets in 3 days"). Sums only `redemption` debits — a
 * `manual_adjustment` a parent grants around the limit is, by definition,
 * the parent's own exception and must never count against their own cap.
 */
export async function getSpendUsedThisPeriod(kidId: string, period: string): Promise<number | null> {
  const days = period === 'weekly' ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await serviceRest<{ amount: number }[]>(
    `/wallet_ledger?kid_user_id=eq.${eu(kidId)}&bucket=eq.spend&reason=eq.redemption&created_at=gte.${es(since)}&select=amount`,
  );
  if (rows === null) return null;
  return rows.reduce((sum, r) => sum - r.amount, 0); // debits are negative amounts; "used" reads positive
}

export interface PendingCreditRow {
  id: string;
  kid_user_id: string;
  amount: number;
  source: string;
  source_ref: string | null;
  allocated: boolean;
  created_at: string;
}

const PENDING_CREDIT_FIELDS = 'id,kid_user_id,amount,source,source_ref,allocated,created_at';

export function getPendingCreditsForKid(kidId: string): Promise<PendingCreditRow[] | null> {
  return serviceRest<PendingCreditRow[]>(
    `/pending_credits?kid_user_id=eq.${eu(kidId)}&allocated=eq.false&select=${PENDING_CREDIT_FIELDS}&order=created_at.asc`,
  );
}

export async function getPendingCreditById(creditId: string): Promise<PendingCreditRow | null> {
  const rows = await serviceRest<PendingCreditRow[]>(`/pending_credits?id=eq.${eu(creditId)}&select=${PENDING_CREDIT_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/** Mirrors allocateTaskReward's null/false split exactly (0081's `allocate_pending_credit`). */
export async function allocatePendingCredit(input: {
  creditId: string;
  kidId: string;
  save: number;
  spend: number;
  share: number;
  createdBy: string;
}): Promise<boolean | null> {
  const res = await serviceRest<boolean>('/rpc/allocate_pending_credit', {
    method: 'POST',
    body: JSON.stringify({
      p_credit_id: input.creditId,
      p_kid_user_id: input.kidId,
      p_save: input.save,
      p_spend: input.spend,
      p_share: input.share,
      p_created_by: input.createdBy,
    }),
  });
  return typeof res === 'boolean' ? res : null;
}

/**
 * The no-cron "catch up on access" job (0081's `run_due_scheduled_credits`)
 * — called at the top of every banking route that reads a kid's own data, so
 * a due allowance/bonus posts the moment anyone actually looks, never later
 * than that. `null` is a transport failure; the caller should still serve
 * the (possibly slightly stale) read rather than fail the whole request —
 * a late-arriving allowance is a UX delay, not a correctness bug, unlike
 * every OTHER function in this section.
 */
export async function runDueScheduledCredits(kidId: string): Promise<number | null> {
  const account = await getBankingAccount(kidId);
  if (account === undefined) return null;
  // Leave schedules and pending allocations untouched until the freeze lifts.
  if (account?.frozen) return 0;
  const res = await serviceRest<number>('/rpc/run_due_scheduled_credits', {
    method: 'POST',
    body: JSON.stringify({ p_kid_user_id: kidId }),
  });
  return typeof res === 'number' ? res : null;
}

/** Every ledger row in [fromISO, toISO) — the statement's only data source, re-aggregated on every read, never stored (BANKING.md §6.5). */
export function getWalletLedgerInRange(kidId: string, fromISO: string, toISO: string): Promise<WalletLedgerRow[] | null> {
  return serviceRest<WalletLedgerRow[]>(
    `/wallet_ledger?kid_user_id=eq.${eu(kidId)}&created_at=gte.${es(fromISO)}&created_at=lt.${es(toISO)}&select=${WALLET_LEDGER_FIELDS}&order=created_at.asc`,
  );
}

const LessonCompletionResult = z.object({
  score: z.number(), passed: z.boolean(), best_score: z.number(),
  xp_earned: z.number(), xp_delta: z.number(), streak_days: z.number(),
  longest_streak: z.number(), streak_extended: z.boolean(), first_today: z.boolean(),
  minutes_learned: z.number(), lessons_completed: z.number(),
  first_completion: z.boolean(), replayed: z.boolean(),
});

/** Server-graded values only; the service-only RPC commits all rewards atomically. */
export async function completeLesson(input: {
  p_user_id: string; p_lesson_id: string; p_run_id: string | null;
  p_score: number; p_passed: boolean; p_xp: number; p_minutes: number; p_local_date: string;
}): Promise<z.infer<typeof LessonCompletionResult> | null> {
  const result = await rest<unknown>('/rpc/complete_lesson', serviceToken(), {
    method: 'POST', body: JSON.stringify(input),
  });
  const parsed = LessonCompletionResult.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** Version-pinned v2 completion derives its score from immutable receipts in one database transaction. */
export async function completeV2Lesson(input: {
  p_user_id: string; p_lesson_id: string; p_run_id: string; p_document_version_id: string;
  p_required_segment_ids: string[]; p_xp: number; p_minutes: number; p_local_date: string;
}): Promise<z.infer<typeof LessonCompletionResult> | null> {
  const result = await rest<unknown>('/rpc/complete_v2_lesson', serviceToken(), {
    method: 'POST', body: JSON.stringify(input),
  });
  const parsed = LessonCompletionResult.safeParse(result);
  return parsed.success ? parsed.data : null;
}
