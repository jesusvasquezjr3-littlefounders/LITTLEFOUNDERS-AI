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
}

export interface RoleRow {
  role: string;
}

export function getOwnProfile(accessToken: string, userId: string): Promise<ProfileRow[] | null> {
  return rest<ProfileRow[]>(
    `/profiles?user_id=eq.${eu(userId)}&select=user_id,display_name,username,locale,theme,cover`,
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

async function countRows(pathWithFilter: string): Promise<number> {
  const res = await restRaw(pathWithFilter, serviceToken(), {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  const total = res.contentRange?.split('/')[1];
  return total && total !== '*' ? Number(total) : 0;
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

export async function getLearningStatsForUpdate(userId: string): Promise<LearningStatsForUpdateRow> {
  const rows = await rest<LearningStatsForUpdateRow[]>(
    `/learning_stats?user_id=eq.${eu(userId)}&select=xp_points,minutes_learned,lessons_completed,streak_days,longest_streak,last_active_date`,
    serviceToken(),
  );
  return rows?.[0] ?? { ...ZERO_STATS, last_active_date: null };
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
}

const COURSE_HIERARCHY_FIELDS = 'id,slug,title,description,subject,position';

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

export interface TopicHierarchyRow {
  id: string;
  saga_id: string;
  position: number;
  slug: string;
  title: Json;
}

const TOPIC_FIELDS = 'id,saga_id,position,slug,title';

export function getTopicsBySagaIds(accessToken: string, sagaIds: string[]): Promise<TopicHierarchyRow[] | null> {
  if (sagaIds.length === 0) return Promise.resolve([]);
  return rest<TopicHierarchyRow[]>(`/topics?saga_id=${inFilter(sagaIds)}&select=${TOPIC_FIELDS}`, accessToken);
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
  return rest<LessonHierarchyRow[]>(`/lessons?topic_id=${inFilter(topicIds)}&select=${LESSON_FIELDS}`, accessToken);
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
  return rest<LessonProgressRow[]>(
    `/lesson_progress?user_id=eq.${eu(userId)}&lesson_id=${inFilter(lessonIds)}&select=lesson_id,best_score,passed,attempts,xp_earned`,
    accessToken,
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
}

/** Every locale row for one lesson (≤3) — used for the caller-locale → es-MX → any fallback (LESSON_ENGINE.md §3). */
export function getLessonDocumentLocales(lessonId: string): Promise<LessonDocumentRow[] | null> {
  return rest<LessonDocumentRow[]>(
    `/lesson_documents?lesson_id=eq.${eu(lessonId)}&select=lesson_id,locale,schema_version,document,answer_keys,audio`,
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
  address: string;
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

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const rows = await rest<RoleRow[]>(`/user_roles?user_id=eq.${eu(userId)}&role=eq.${role}&select=role`, serviceToken());
  return Array.isArray(rows) && rows.length > 0;
}

/** Append-only audit entry (no PII in detail — booleans/ids only). */
export async function insertAuditLog(actorId: string, action: string, subject: string, detail: Record<string, unknown>): Promise<void> {
  await rest<unknown>('/audit_logs', serviceToken(), {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: actorId, action, subject, detail }),
  });
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
