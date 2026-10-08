import { projectAvatarOptions } from './profileShape.js';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { BADGE_LINK_CUTOVER, badgeLinksRetired } from './badgeLinkWindow.js';
import { V2_DIAGNOSTIC_CODES } from './v2VisualScorer.js';

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
        // A legacy off-schema avatar is served as the default cartoon.
        avatarOptions: projectAvatarOptions(avatarById.get(id)),
        isTutor: tutorIds.has(id),
      };
    })
    .filter((u): u is ListedUser => u !== null);
}

const LIST_LIMIT = 60;

/** Whitelisted cards for ids an authorized route already resolved (teen request queue). */
export async function getSocialCards(ids: string[]): Promise<ListedUser[] | null> {
  return hydrateUsers([...new Set(ids)]);
}

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

/*
 * From a request queue ("report action for
 * unwanted contact"). An inbound connection request is the first
 * unwanted-contact event, so the person deciding it can report the requester
 * (and a teen can block them) from the queue itself: while the request is
 * pending, and for 30 days after it was closed without a connection (the
 * same window as the teen decline cooldown), so a decline is not the end of
 * the path to act on a concern.
 */
export const SOCIAL_REQUEST_ACTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a request row still admits a report (or a block) from its queue. */
export function requestStillActionable(status: string, decidedAt: string | null, closedWithoutConnection: readonly string[], now = Date.now()): boolean {
  if (status === 'pending') return true;
  if (!closedWithoutConnection.includes(status) || decidedAt === null) return false;
  const at = Date.parse(decidedAt);
  return Number.isFinite(at) && now - at <= SOCIAL_REQUEST_ACTION_DAYS * DAY_MS;
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

// ── Report escalation (0108) ──────────────────────────────

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

// ── Course hierarchy (0007) ─────────────
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
  /** 0008 course-level prerequisite edges: slugs of courses that must be completed first. */
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
export async function restBatchedByIds<T>(
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
  /** Competency-graph projection (0042): null until Forge authors one for this topic. */
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
  /** Depth/enrichment, never required for progress, badges or early-access unlocks. */
  optional_enrichment?: boolean;
}

const LESSON_FIELDS = 'id,topic_id,position,slug,title,difficulty,xp_total,estimated_minutes,optional_enrichment';

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

/** Every locale row for one lesson (≤3) — used for the caller-locale → es-MX → any fallback. */
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
 * One selection rule for learner delivery, every learner mutation and the
 * staff review preview: an activated v2 version wins; otherwise the v1 row.
 */
export async function getEffectiveLessonDocumentLocales(lessonId: string): Promise<LessonDocumentRow[] | null> {
  const v2Docs = await getCurrentV2LessonDocumentLocales(lessonId);
  if (v2Docs === null || v2Docs.length > 0) return v2Docs;
  return getLessonDocumentLocales(lessonId);
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
  /** Where a mastery-faded CPA progression starts this run. */
  cpa_entry_stage?: 'concrete' | 'pictorial' | 'abstract';
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
  cpa_entry_stage?: 'concrete' | 'pictorial' | 'abstract' | null;
  /** The approach chain the learner pinned on this run, or null before choosing. */
  approach_id?: string | null;
}

/** Service-only lookup for a checkpointed run; it never exposes the row to the browser. */
export async function getV2LessonRunForRecovery(userId: string, lessonId: string, runId: string): Promise<V2LessonRunRecoveryRow | null | undefined> {
  const rows = await rest<V2LessonRunRecoveryRow[]>(
    `/lesson_v2_runs?id=eq.${eu(runId)}&user_id=eq.${eu(userId)}&lesson_id=eq.${eu(lessonId)}&select=id,user_id,lesson_id,locale,document_version_id,expires_at,completed_at,cpa_entry_stage,approach_id`,
    serviceToken(),
  );
  if (rows === null) return undefined;
  const row = rows[0];
  return row && row.id === runId && row.user_id === userId && row.lesson_id === lessonId ? row : null;
}

/** The latest stage at which this learner first succeeded unaided on a fading group, any version. */
export async function getV2PriorFirstUnaidedStage(userId: string, fadingGroupId: string): Promise<'concrete' | 'pictorial' | 'abstract' | null> {
  const rows = await rest<Array<{ stage: string }>>(
    `/lesson_v2_first_unaided_stages?user_id=eq.${eu(userId)}&fading_group_id=eq.${eu(fadingGroupId)}&select=stage&order=created_at.desc&limit=1`,
    serviceToken(),
  );
  const stage = rows?.[0]?.stage;
  return stage === 'concrete' || stage === 'pictorial' || stage === 'abstract' ? stage : null;
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
  z.object({ replayed: z.boolean(), verdict: z.object({ correct: z.boolean(), score: z.number().int().min(0).max(100),
    // Present only on a reasoning answer; the database CHECK pins the shape.
    judgment: z.object({ quality: z.enum(['sound', 'partial', 'unsupported']) }).strict().optional(),
    // The closed diagnostic code and the help-ladder steps used (the SQL CHECK pins both). One list with the scorer.
    diagnostic: z.enum(V2_DIAGNOSTIC_CODES).optional(),
    hints_used: z.number().int().min(0).max(2).optional() }), retry_jti: z.string().optional() }),
  z.object({ blocked: z.literal(true) }),
]);

/** The verdict Core stores: score and correctness, plus the diagnostic signals the receipt CHECK pins (0205). */
export interface V2StoredVerdict {
  correct: boolean; score: number; judgment?: { quality: 'sound' | 'partial' | 'unsupported' };
  diagnostic?: string; hints_used?: number; item_role?: 'practice' | 'transfer'; kc?: string;
  detection?: { hits: number; misses: number; false_alarms: number; correct_rejections: number };
}

/** Core's record that the learner acted on a non-scored segment of a pinned run (0205). */
export async function recordV2SegmentView(payload: { p_user_id: string; p_run_id: string; p_document_version_id: string; p_segment_id: string }): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_v2_segment_view', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  return result === true;
}

/**
 * The learner's time on a
 * v2 step, an analytics field only. Set once, after the receipt (by jti) or
 * the view (jti null) exists; nothing that grades or completes reads it.
 */
export async function recordV2TimeOnTask(payload: { p_user_id: string; p_run_id: string; p_segment_id: string; p_receipt_jti: string | null; p_seconds: number }): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_v2_time_on_task', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  return result === true;
}

/**
 * Pin the learner's approach on the run (pin_v2_run_approach,
 * service role). Answers the pinned approach (an earlier pin wins), null when
 * the database refused the choice, undefined when it could not be reached.
 */
export async function pinV2RunApproach(payload: { p_user_id: string; p_run_id: string; p_approach_id: string }): Promise<string | null | undefined> {
  const result = await restRaw('/rpc/pin_v2_run_approach', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  if (!result.ok) return result.status >= 500 || result.status === 0 ? undefined : null;
  const body = result.body as unknown;
  return typeof body === 'string' ? body : null;
}

/** Client-safe resume projection of the non-scored segments already acted on in a run. */
export function getV2SegmentViewsForRecovery(userId: string, runId: string, documentVersionId: string): Promise<Array<{ segment_id: string }> | null> {
  return rest<Array<{ segment_id: string }>>(
    `/lesson_v2_segment_views?user_id=eq.${eu(userId)}&run_id=eq.${eu(runId)}&document_version_id=eq.${eu(documentVersionId)}&select=segment_id`,
    serviceToken(),
  );
}

/** The SQL transaction atomically burns the nonce and persists its immutable verdict. */
export async function recordV2LessonGrade(payload: {
  p_user_id: string; p_run_id: string; p_document_version_id: string; p_segment_id: string; p_jti: string;
  p_required_met_segment_id: string | null;
  p_verdict: V2StoredVerdict;
  p_next_jti: string;
  p_next_expires_at: string;
}): Promise<z.infer<typeof V2GradeReceipt> | null> {
  const result = await rest<unknown>('/rpc/record_v2_lesson_grade_retry', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  const parsed = V2GradeReceipt.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** CPA requires an earlier representation to have been attempted, not mastered. */
export async function recordV2CpaGrade(payload: {
  p_user_id: string; p_run_id: string; p_document_version_id: string; p_segment_id: string; p_jti: string;
  p_required_attempted_segment_id: string | null;
  p_verdict: V2StoredVerdict;
  p_next_jti: string;
  p_next_expires_at: string;
}): Promise<z.infer<typeof V2GradeReceipt> | null> {
  const result = await rest<unknown>('/rpc/record_v2_cpa_grade_retry', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  const parsed = V2GradeReceipt.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** CPA is diagnostic-only: an unavailable diagnostic writer must never discard a valid lesson receipt. */
export async function recordV2FirstUnaidedStage(payload: {
  p_user_id: string; p_document_version_id: string; p_fading_group_id: string;
  p_stage: 'concrete' | 'pictorial' | 'abstract'; p_receipt_jti: string;
}): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_v2_first_unaided_stage', serviceToken(), { method: 'POST', body: JSON.stringify(payload) });
  return result !== null;
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
 * The Tutor badge is a verified-adult signal, not a platform-wide
 * public badge. It is shown only when the subject is a currently ID-verified
 * parent AND the viewer has an established relationship: the subject's own
 * verified-linked kid, a mutual follow (the approved-connection gate), the
 * subject themself, or staff. A kid-role account with no established
 * relationship never sees it. An ambiguous read hides the badge (fail
 * closed — an absence is safer than an unearned trust signal).
 */
export async function tutorBadgeVisible(viewerId: string, subjectId: string): Promise<boolean> {
  // "Tutor" is only a currently ID-verified parent, for every viewer:
  // the subject themself and staff included (W2P.3 found the self and staff
  // shortcuts ran before this check, so anyone saw the badge on their own
  // /@username).
  const subjectVerification = await rest<unknown[]>(
    `/parent_verifications?user_id=eq.${eu(subjectId)}&select=status,method,birth_date&order=created_at.desc,id.desc&limit=1`,
    serviceToken(),
  );
  if (!Array.isArray(subjectVerification) || subjectVerification.length === 0) return false;
  const latest = subjectVerification[0] as { status?: unknown; method?: unknown; birth_date?: unknown } | undefined;
  if (!latest || latest.status !== 'verified' || latest.method !== 'local-ocr') return false;
  if (viewerId === subjectId) return true;
  const staffViewer = await hasRole(viewerId, 'admin') || await hasRole(viewerId, 'superadmin');
  if (staffViewer) return true;
  const [linked, mutualFollow] = await Promise.all([
    rest<{ id: string }[]>(
      `/guardian_links?parent_user_id=eq.${eu(subjectId)}&kid_user_id=eq.${eu(viewerId)}&verification_status=eq.verified&select=id&limit=1`,
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
  if (!Array.isArray(linked)) return false;
  return linked.length > 0 || mutualFollow;
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

/*
 * Service-role RPCs whose database function refuses by name. A refusal arrives
 * as a PostgREST error with code P0001 and a SCREAMING_SNAKE message (RAISE
 * EXCEPTION 'NAME'); `rpcRefusal()` extracts that token. Anything else (a
 * transport failure, an unexpected shape) is UNAVAILABLE and must never be
 * read as a decision.
 */
export type Refusal = { refused: string };
export const UNAVAILABLE = 'UNAVAILABLE' as const;

const RpcError = z.object({ code: z.literal('P0001'), message: z.string().regex(/^[A-Z][A-Z_]{2,63}$/) });

function rpcRefusal(body: unknown): Refusal | typeof UNAVAILABLE {
  const parsed = RpcError.safeParse(body);
  return parsed.success ? { refused: parsed.data.message } : UNAVAILABLE;
}

/** One service-role RPC: the parsed result, a named database refusal, or UNAVAILABLE (never read as a decision). */
export async function rpc<T>(name: string, args: Record<string, unknown>, shape: z.ZodType<T>): Promise<T | Refusal | typeof UNAVAILABLE> {
  const raw = await serviceRestRaw(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  if (!raw.ok) return rpcRefusal(raw.body);
  const parsed = shape.safeParse(raw.body);
  return parsed.success ? parsed.data : UNAVAILABLE;
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && 'refused' in value;
}

/** The operational counter is written only by Core after it isolates one bad course. */
export async function recordCourseAssemblyIncident(courseId: string): Promise<boolean> {
  const result = await rest<unknown>('/rpc/record_course_assembly_incident', serviceToken(), {
    method: 'POST',
    body: JSON.stringify({ p_course_id: UUID.parse(courseId) }),
  });
  return result !== null;
}

/* A role or staff-permission revocation is never a service-role DELETE: the
 * trigger could not name the revoking superadmin. It goes through Vault's
 * revoke_staff_grant (services/adminData.ts revokeStaffGrant). */

// ── Guardian links ──────────────────────────────────────────────────────────

export interface GuardianLinkRow {
  parent_user_id: string;
  kid_user_id: string;
  verification_status: string;
}

/** The caller's VERIFIED kid links. Service role: guardian_links has no parent SELECT policy; the route layer is the guard. */
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

/** The mirror image of getVerifiedKidLinks, read from the KID's own side: a kid's own verified guardians. */
export async function getVerifiedGuardiansOfKid(kidUserId: string): Promise<string[] | null> {
  const rows = await serviceRest<{ parent_user_id: string }[]>(
    `/guardian_links?kid_user_id=eq.${eu(kidUserId)}&verification_status=eq.verified&select=parent_user_id`,
  );
  if (rows === null) return null;
  return rows.map((r) => r.parent_user_id);
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

// ── Achievement sharing (0073 legacy links; legacy rows only) ─────────────
//
// badge_shares holds ONLY the legacy links issued before the cutover;
// the database refuses new rows (migration close_badge_share_links)
// and Core has no insert path. What remains here reads, revokes and sweeps
// those legacy rows until the dated removal drops the table.

export interface BadgeShareRow {
  id: string;
  token: string;
  kid_user_id: string;
  created_by: string;
  achievement_kind: 'course_badge' | 'streak' | 'goal_reached';
  achievement_label: string;
  first_name: string;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
  /** The exact URL Depot returned — NOT reconstructed from bucket/hash/ext (see 0073's column comment). */
  image_url: string;
  created_at: string;
  /** (0109): the window end. Enforced by Core on every public read. */
  expires_at: string;
  /** (0109): NULL = live; non-NULL = revoked and unreachable. */
  revoked_at: string | null;
}

const BADGE_SHARE_FIELDS =
  'id,token,kid_user_id,created_by,achievement_kind,achievement_label,first_name,image_bucket,image_hash,image_ext,image_url,created_at,expires_at,revoked_at';

/** PostgREST filter for "a legacy link that can still be live": issued before the cutover, un-revoked, inside its window. */
function liveBadgeShareFilter(): string {
  return `created_at=lt.${es(BADGE_LINK_CUTOVER)}&revoked_at=is.null&expires_at=gt.${es(new Date().toISOString())}`;
}

/**
 * Looked up by the PUBLIC badge landing page (routes/badgePublic.ts) — a
 * stranger's request, so this reads ONLY by the opaque token (never by kid
 * or user id) and the route layer whitelists the response down to the four
 * display fields (no kid_user_id/created_by leaves Core on that path).
 * Deliberately does NOT filter on liveness here: the public route must be
 * able to tell "dead" apart from "never existed" so it can trigger the lazy
 * image purge.
 */
/**
 * The locale a legacy badge link's copy was written in. A legacy row stores
 * no locale: its label was localized in the sharing Tutor's language, so this
 * reads the profile locale of the Tutor who created the share (created_by),
 * then the child's (the family's locale at creation). Only the locale column
 * is read. Null when neither is readable, and the caller falls back to en-US.
 */
export async function getBadgeShareLocale(share: Pick<BadgeShareRow, 'created_by' | 'kid_user_id'>): Promise<string | null> {
  const ids = [share.created_by, share.kid_user_id].filter((id): id is string => typeof id === 'string' && UUID.safeParse(id).success);
  if (ids.length === 0) return null;
  const rows = await serviceRest<{ user_id: string; locale: string | null }[]>(`/profiles?user_id=${inFilter(ids)}&select=user_id,locale`);
  if (!Array.isArray(rows)) return null;
  for (const id of ids) {
    const locale = rows.find((row) => row?.user_id === id)?.locale;
    if (typeof locale === 'string' && locale) return locale;
  }
  return null;
}

export async function getBadgeShareByToken(token: string): Promise<BadgeShareRow | null> {
  const rows = await serviceRest<BadgeShareRow[]>(`/badge_shares?token=eq.${es(token)}&select=${BADGE_SHARE_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
}

/**
 * True if some OTHER LIVE share still references this exact badge image.
 * Depot was content-addressed, so two shares of the same achievement
 * deduplicated to one object — before purging a dead share's image the
 * caller must confirm nothing live still needs it. Once the route is retired
 * nothing is live. Returns null on a transport failure: the caller must treat
 * that as "still referenced" and skip the delete (never destroy on an
 * ambiguous read).
 */
export async function badgeShareImageStillReferencedElsewhere(
  excludeToken: string,
  bucket: string,
  hash: string,
): Promise<boolean | null> {
  if (badgeLinksRetired()) return false;
  const rows = await serviceRest<{ id: string }[]>(
    `/badge_shares?token=neq.${es(excludeToken)}&image_bucket=eq.${es(bucket)}&image_hash=eq.${es(hash)}` +
      `&${liveBadgeShareFilter()}&select=id&limit=1`,
  );
  if (rows === null) return null;
  return rows.length > 0;
}

/**
 * One page of DEAD legacy links for the image sweep — revoked, expired or
 * issued at/after the cutover; every row once the route is retired. Rows are
 * never deleted by the sweep (the purge is idempotent: Depot answers 404 for
 * an image already gone), so paging is by a stable (created_at, id) order.
 */
export function listDeadBadgeShares(limit: number, offset: number): Promise<BadgeShareRow[] | null> {
  const dead = badgeLinksRetired()
    ? ''
    : `or=(revoked_at.not.is.null,expires_at.lte.${es(new Date().toISOString())},created_at.gte.${es(BADGE_LINK_CUTOVER)})&`;
  return serviceRest<BadgeShareRow[]>(
    `/badge_shares?${dead}select=${BADGE_SHARE_FIELDS}&order=created_at.asc,id.asc&limit=${limit}&offset=${offset}`,
  );
}

// ── Lesson completion receipts ──────────────────────────────────────────────

/**
 * The server-authored replay facts complete_lesson stores on the
 * receipt. Optional only because a receipt written before that migration is
 * replayed as it was stored.
 */
export const ReplayReceipt = z.object({
  kind: z.enum(['first', 'retry', 'replay']),
  previous_best_score: z.number().int().min(0).max(100).nullable(),
  best_score_kept: z.boolean(),
  notice: z.enum(['best_kept', 'new_best', 'none']),
  xp_policy: z.literal('improvement_only'),
}).strict();
export type ReplayReceipt = z.infer<typeof ReplayReceipt>;

/** What a completion did to the habit streak, server-authored (habit_streak_advance). */
export const CompletionStreak = z.object({
  model: z.literal('rest-days-v1'),
  outcome: z.enum(['first', 'same_day', 'extended', 'bridged', 'restarted', 'earlier_date', 'not_practised']),
  rest_days_bridged: z.number().int().nonnegative(),
  rest_days_left: z.number().int().min(0).max(2),
  milestone: z.union([z.literal(7), z.literal(30), z.literal(100)]).nullable(),
  days_practiced: z.number().int().nonnegative(),
  best: z.number().int().nonnegative(),
  /** The stored run before this completion (the restart signal). */
  run_before: z.number().int().nonnegative(),
});
export type CompletionStreak = z.infer<typeof CompletionStreak>;

const LessonCompletionResult = z.object({
  score: z.number(), passed: z.boolean(), best_score: z.number(),
  xp_earned: z.number(), xp_delta: z.number(), streak_days: z.number(),
  longest_streak: z.number(), streak_extended: z.boolean(), first_today: z.boolean(),
  minutes_learned: z.number(), lessons_completed: z.number(),
  first_completion: z.boolean(), replayed: z.boolean(),
  replay: ReplayReceipt.optional(),
  // v2 only (complete_v2_lesson): first-try accuracy and the judgment summary.
  first_try_correct: z.number().int().nonnegative().optional(),
  graded_count: z.number().int().nonnegative().optional(),
  // (complete_v2_mixed_lesson): non-scored steps acted on and help-ladder steps used.
  viewed_count: z.number().int().nonnegative().optional(),
  hints_used: z.number().int().nonnegative().optional(),
  judgment: z.object({
    assessed: z.number().int().nonnegative(), sound: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(), unsupported: z.number().int().nonnegative(),
  }).strict().optional(),
  // (*_habit_streak_completion_and_pause.sql). Optional: a receipt
  // stored before that migration is replayed as it was stored.
  streak: CompletionStreak.optional(),
  pace: z.object({ lessons_passed_today: z.number().int().nonnegative() }).optional(),
});
export type LessonCompletionResult = z.infer<typeof LessonCompletionResult>;

/**
 * Version-pinned completion of a mixed v2 document.
 * Graded segments need met receipts; non-scored segments need view receipts.
 */
export async function completeV2MixedLesson(input: {
  p_user_id: string; p_lesson_id: string; p_run_id: string; p_document_version_id: string;
  p_required_segment_ids: string[]; p_viewed_segment_ids: string[]; p_xp: number; p_minutes: number; p_local_date: string;
}): Promise<z.infer<typeof LessonCompletionResult> | null> {
  const result = await rest<unknown>('/rpc/complete_v2_mixed_lesson', serviceToken(), {
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


// ── Habit streak state, holiday pauses and pace ──────

/** The streak model's stored state (learning_stats), read with the service role. Null when Vault did not answer. */
export interface HabitStreakRow {
  streak_days: number;
  longest_streak: number | null;
  last_active_date: string | null;
  rest_days_used: number;
  days_practiced: number;
  day_lessons_passed: number;
}
const HabitStreakRowSchema = z.object({
  streak_days: z.number().int().nonnegative(),
  longest_streak: z.number().int().nonnegative().nullable().default(0),
  last_active_date: z.string().nullable(),
  // The migration's column defaults, so a row written before it reads the same.
  rest_days_used: z.number().int().min(0).max(2).default(0),
  days_practiced: z.number().int().nonnegative().default(0),
  day_lessons_passed: z.number().int().nonnegative().default(0),
});
export async function getHabitStreakRow(userId: string): Promise<HabitStreakRow | null> {
  const rows = await serviceRest<unknown[]>(
    `/learning_stats?user_id=eq.${eu(userId)}&select=streak_days,longest_streak,last_active_date,rest_days_used,days_practiced,day_lessons_passed&limit=1`,
  );
  if (rows === null) return null;
  if (rows.length === 0) return { streak_days: 0, longest_streak: 0, last_active_date: null, rest_days_used: 0, days_practiced: 0, day_lessons_passed: 0 };
  const parsed = HabitStreakRowSchema.safeParse(rows[0]);
  return parsed.success ? parsed.data : null;
}

export interface StreakPauseRow { id: string; starts_on: string; ends_on: string }
const StreakPauseRowSchema = z.object({ id: z.string().uuid(), starts_on: z.string(), ends_on: z.string() });
/** Pauses that are not cancelled and end on or after `fromDate` (the ones that can still matter). */
export async function getStreakPauses(userId: string, fromDate: string): Promise<StreakPauseRow[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/learning_streak_pauses?learner_id=eq.${eu(userId)}&cancelled_at=is.null&ends_on=gte.${es(fromDate)}&select=id,starts_on,ends_on&order=starts_on.asc&limit=50`,
  );
  const parsed = z.array(StreakPauseRowSchema).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

/** The learner's recorded local practice days in [fromDate, toDate] (0208), service role. Null when the read fails. */
export async function getPracticeDays(userId: string, fromDate: string, toDate: string): Promise<string[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/learning_practice_days?user_id=eq.${eu(userId)}&local_date=gte.${es(fromDate)}&local_date=lte.${es(toDate)}&select=local_date&order=local_date.asc&limit=14`,
  );
  const parsed = z.array(z.object({ local_date: z.string() })).safeParse(rows);
  return parsed.success ? parsed.data.map((row) => row.local_date.slice(0, 10)) : null;
}

/** Onboarding's day one, advanced atomically on the habit model (record_learning_practice_day). */
export async function recordLearningPracticeDay(userId: string, localDate: string): Promise<{ current: number } | null> {
  const result = await serviceRest<unknown>('/rpc/record_learning_practice_day', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_local_date: localDate }),
  });
  const parsed = z.object({ current: z.number().int().nonnegative() }).passthrough().safeParse(result);
  return parsed.success ? { current: parsed.data.current } : null;
}

export interface PacePreferenceRow { daily_lesson_goal: number; chosen_at: string }
/** Undefined when Vault did not answer; null when the learner never chose. */
export async function getPacePreference(userId: string): Promise<PacePreferenceRow | null | undefined> {
  const rows = await serviceRest<unknown[]>(`/learning_pace_preferences?user_id=eq.${eu(userId)}&select=daily_lesson_goal,chosen_at&limit=1`);
  if (rows === null) return undefined;
  const parsed = z.array(z.object({ daily_lesson_goal: z.number().int().min(1).max(3), chosen_at: z.string() })).safeParse(rows);
  if (!parsed.success) return undefined;
  return parsed.data[0] ?? null;
}
export async function upsertPacePreference(userId: string, goal: number): Promise<boolean> {
  const now = new Date().toISOString();
  const res = await serviceRest<unknown>('/learning_pace_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, daily_lesson_goal: goal, chosen_at: now, updated_at: now }),
  });
  return res !== null;
}
