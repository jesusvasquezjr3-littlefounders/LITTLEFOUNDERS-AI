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
  const res = await restRaw(`/follows?follower_id=eq.${eu(followerId)}&followed_id=eq.${eu(followedId)}`, accessToken, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res.ok;
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
async function hydrateUsers(ids: string[]): Promise<ListedUser[]> {
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
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
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
  return hydrateUsers((rows ?? []).map((r) => r.follower_id));
}

export async function listFollowing(userId: string): Promise<ListedUser[]> {
  const rows = await rest<{ followed_id: string }[]>(
    `/follows?follower_id=eq.${eu(userId)}&select=followed_id&order=created_at.desc&limit=${LIST_LIMIT}`,
    serviceToken(),
  );
  return hydrateUsers((rows ?? []).map((r) => r.followed_id));
}

export async function listBlocked(userId: string): Promise<ListedUser[]> {
  const rows = await rest<{ blocked_id: string }[]>(
    `/blocks?blocker_id=eq.${eu(userId)}&select=blocked_id&order=created_at.desc&limit=${LIST_LIMIT}`,
    serviceToken(),
  );
  return hydrateUsers((rows ?? []).map((r) => r.blocked_id));
}

/** Either direction — mirrors the DB's is_blocked(), read via the service role. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const rows = await rest<unknown[]>(
    `/blocks?select=blocker_id&or=(and(blocker_id.eq.${eu(a)},blocked_id.eq.${eu(b)}),and(blocker_id.eq.${eu(b)},blocked_id.eq.${eu(a)}))`,
    serviceToken(),
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Block: the blocker's own row is a user-token write (RLS-owned); cleaning
 * up any EXISTING follow in either direction needs the service role, since
 * the reverse edge (them following the blocker) isn't the actor's own row.
 */
export async function blockUser(accessToken: string, blockerId: string, blockedId: string): Promise<boolean> {
  const inserted = await restRaw('/blocks', accessToken, {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId }),
  });
  if (!inserted.ok) return false;
  await Promise.all([
    restRaw(`/follows?follower_id=eq.${eu(blockerId)}&followed_id=eq.${eu(blockedId)}`, serviceToken(), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }),
    restRaw(`/follows?follower_id=eq.${eu(blockedId)}&followed_id=eq.${eu(blockerId)}`, serviceToken(), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }),
  ]);
  return true;
}

export async function unblockUser(accessToken: string, blockerId: string, blockedId: string): Promise<boolean> {
  const res = await restRaw(`/blocks?blocker_id=eq.${eu(blockerId)}&blocked_id=eq.${eu(blockedId)}`, accessToken, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res.ok;
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
}

const COURSE_HIERARCHY_FIELDS = 'id,slug,title,description,subject,position,badge_asset,in_progress';

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

// ── Lesson segment attempts (0007) — SERVICE ROLE writes, self-read RLS ────

export interface SegmentAttemptRow {
  segment_id: string;
  attempt_number: number;
  score: number;
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

/**
 * Count prior attempts for a segment. When `runId` is given (the client's
 * per-lesson-entry id, 0012) only rows from THAT run count, so replaying a
 * completed lesson starts each segment fresh instead of hitting the lifetime
 * cap. Omitting it keeps the legacy lifetime count.
 */
export async function countSegmentAttempts(
  accessToken: string,
  userId: string,
  lessonId: string,
  segmentId: string,
  runId?: string,
): Promise<number> {
  const runFilter = runId ? `&run_id=eq.${eu(runId)}` : '';
  const rows = await rest<unknown[]>(
    `/lesson_segment_attempts?user_id=eq.${eu(userId)}&lesson_id=eq.${eu(lessonId)}&segment_id=eq.${es(segmentId)}${runFilter}&select=segment_id`,
    accessToken,
  );
  return rows?.length ?? 0;
}

/** No client INSERT policy (0007) — Core (service role) records every graded attempt. `score` is the hint-penalized, server-authoritative score (0012). */
export async function insertSegmentAttempt(
  userId: string,
  lessonId: string,
  segmentId: string,
  attemptNumber: number,
  score: number,
  runId?: string,
  hintsUsed = 0,
  context?: {
    timeSpentSeconds?: number;
    courseId: string;
    topicId: string;
    skillKey: string;
    documentUpdatedAt: string;
    diagnosticCode?: 'initial_incorrect' | 'hint_assisted' | 'retry_recovery';
  },
): Promise<boolean> {
  const res = await rest<unknown>('/lesson_segment_attempts', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      lesson_id: lessonId,
      segment_id: segmentId,
      attempt_number: attemptNumber,
      score,
      ...(runId ? { run_id: runId } : {}),
      hints_used: hintsUsed,
      ...(context?.timeSpentSeconds !== undefined ? { time_spent_seconds: context.timeSpentSeconds } : {}),
      ...(context ? {
        course_id: context.courseId,
        topic_id: context.topicId,
        skill_key: context.skillKey,
        document_updated_at: context.documentUpdatedAt,
        ...(context.diagnosticCode ? { diagnostic_code: context.diagnosticCode } : {}),
      } : {}),
    }),
  });
  return res !== null;
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
  document_type: string;
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
}

/** WHITELISTED kid profile fields for the family dashboard — never the whole row (mirrors the /@username whitelist discipline). */
export function getKidProfiles(kidIds: string[]): Promise<KidProfileRow[] | null> {
  if (kidIds.length === 0) return Promise.resolve([]);
  return serviceRest<KidProfileRow[]>(`/profiles?user_id=${inFilter(kidIds)}&select=user_id,display_name,username`);
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
export async function insertCoursePlacement(row: {
  user_id: string;
  course_id: string;
  claimed_level: string;
  education_level: string;
  quiz_answers: unknown;
  start_topic_id: string | null;
  start_lesson_id: string | null;
  method: string;
}): Promise<boolean> {
  const res = await serviceRest<unknown>('/course_placements', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

export async function insertPlacementCredits(
  rows: Array<{ user_id: string; lesson_id: string; topic_id: string; course_id: string }>,
): Promise<boolean> {
  if (rows.length === 0) return true;
  const res = await serviceRest<unknown>('/placement_credits', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  return res !== null;
}

// ── Shareable achievement badges (0073) ─────────────────────

export interface BadgeShareInsert {
  token: string;
  kid_user_id: string;
  created_by: string;
  achievement_kind: 'course_badge' | 'streak';
  achievement_label: string;
  first_name: string;
  age_band: '6-8' | '9-11' | '12-14' | null;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
  /** The exact URL Depot returned — NOT reconstructed from bucket/hash/ext (see 0073's column comment). */
  image_url: string;
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
}

const BADGE_SHARE_FIELDS =
  'token,kid_user_id,created_by,achievement_kind,achievement_label,first_name,age_band,image_bucket,image_hash,image_ext,image_url,id,created_at';

/**
 * Looked up by the PUBLIC badge landing page (routes/badgePublic.ts) — a
 * stranger's request, so this reads ONLY by the opaque token (never by kid
 * or user id) and the route layer whitelists the response down to the four
 * display fields (no kid_user_id/created_by leaves Core on that path).
 */
export async function getBadgeShareByToken(token: string): Promise<BadgeShareRow | null> {
  const rows = await serviceRest<BadgeShareRow[]>(`/badge_shares?token=eq.${es(token)}&select=${BADGE_SHARE_FIELDS}&limit=1`);
  return rows?.[0] ?? null;
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
}

const TASK_FIELDS =
  'id,assigned_by,assigned_to,title,reward_coins,recurrence,due_at,status,allocated,created_at,evidence_bucket,evidence_hash,evidence_ext,evidence_uploaded_at';

export async function insertTask(row: {
  assigned_by: string;
  assigned_to: string;
  title: string;
  reward_coins: number;
  recurrence: string;
  due_at: string | null;
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

/** Attaches (or replaces) a proof-of-work photo pointer on a task the caller already confirmed is their own and still open for evidence (0077). */
export async function setTaskEvidence(
  taskId: string,
  evidence: { bucket: string; hash: string; ext: string },
): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>(`/tasks?id=eq.${eu(taskId)}`, {
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
export async function transitionTaskStatus(taskId: string, fromStatus: string, toStatus: string): Promise<TaskRow | null> {
  const rows = await serviceRest<TaskRow[]>(`/tasks?id=eq.${eu(taskId)}&status=eq.${es(fromStatus)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: toStatus }),
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
  created_at: string;
}

const WALLET_LEDGER_FIELDS = 'id,kid_user_id,bucket,amount,reason,task_id,goal_id,redemption_id,created_at';

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
}

const REDEMPTION_FIELDS = 'id,catalog_id,kid_user_id,status,created_at,decided_at,decided_by';

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
