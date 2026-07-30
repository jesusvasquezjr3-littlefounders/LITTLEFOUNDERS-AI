import { assembleCourseTree, type CourseTree } from './courseTree.js';
import {
  getAdventuresByCourseIds,
  getLessonProgressForLessons,
  getLessonsByTopicIds,
  getSagasByAdventureIds,
  getTopicsBySagaIds,
  serviceRest,
  type CourseHierarchyRow,
} from './supabaseRest.js';

/*
 * PostgREST access for the Game Engine tables (Vault 0027).
 *
 * WHY EVERY CALL HERE IS SERVICE-ROLE, and why that is not a hole:
 *
 *  - `game_documents` has RLS enabled with ZERO policies by design (0027): the
 *    sidecar and the manifest live on the same ROW, and RLS is row-level, not
 *    column-level, so any SELECT policy would hand a client the anti-cheat
 *    numbers. Core is the only possible reader.
 *  - `game_attempts` / `game_progress` have no client write policy at all — Core
 *    derives the score, so Core is the only writer. The reads below are always
 *    pinned to `user_id=eq.<the caller>`, which is exactly what the RLS SELECT
 *    policy would have allowed.
 *  - `games` DOES have a published-chain SELECT policy, and it is honoured
 *    structurally rather than by token: every call passes `status=eq.published`,
 *    and routes/games.ts only ever asks about topics it has already resolved
 *    through the USER-TOKEN course-tree reads (`getTopicById` … the RLS-enforced
 *    getters in supabaseRest.ts). A topic the user cannot see never reaches this
 *    module, so the set returned is the set the policy would have returned.
 *
 * `stats` on an attempt holds DERIVED AGGREGATES only. The raw input log is
 * replayed in memory and DISCARDED — a tick-resolution behavioural trace of a
 * child at play is exactly the data §1.9 minimalism says not to keep, and the
 * reward does not need it.
 */

type Json = Record<string, unknown>;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Ids reaching this module come from the DB or from a Zod-validated `:gameId`;
 *  the throw is a backstop against a future caller skipping the edge check, never
 *  a reachable path. */
function eu(id: string): string {
  if (!UUID_RE.test(id)) throw new Error('gameData: id is not a uuid');
  return encodeURIComponent(id);
}

/** `in.(...)` with an empty list is a PostgREST syntax error — callers short-circuit. */
function inFilter(ids: readonly string[]): string {
  return `in.(${ids.map(eu).join(',')})`;
}

// ---- The course tree (unlock state) --------------------------------------------

/**
 * Fetch one published course's full hierarchy plus this user's lesson progress and
 * assemble the per-user tree. Returns null when a fetch failed (never a partial
 * tree, which would read as "nothing is unlocked").
 *
 * Deliberately built from the SAME rows and the SAME `assembleCourseTree` the
 * learn router uses: game unlock must not become a second source of truth for
 * "has this child passed a lesson" (GAME_ENGINE.md §8). Only the fetch
 * orchestration is repeated here — `routes/learn.ts` keeps its copy private, so
 * extracting the shared loader into supabaseRest/courseTree is a follow-up for
 * that file's owner.
 */
export async function loadCourseTreeForUser(accessToken: string, userId: string, course: CourseHierarchyRow): Promise<CourseTree | null> {
  const adventures = await getAdventuresByCourseIds(accessToken, [course.id]);
  if (!adventures) return null;
  const sagas = await getSagasByAdventureIds(accessToken, adventures.map((a) => a.id));
  if (!sagas) return null;
  const topics = await getTopicsBySagaIds(accessToken, sagas.map((s) => s.id));
  if (!topics) return null;
  const lessons = await getLessonsByTopicIds(accessToken, topics.map((t) => t.id));
  if (!lessons) return null;
  const progress = await getLessonProgressForLessons(accessToken, userId, lessons.map((l) => l.id));
  if (!progress) return null;
  return assembleCourseTree(course, adventures, sagas, topics, lessons, progress);
}

// ---- games ---------------------------------------------------------------------

export interface GameRow {
  id: string;
  topic_id: string;
  position: number;
  slug: string;
  mechanic: string;
  /** Per-locale map, like every other content title — the client picks. */
  title: Json;
  tier: number;
  xp_max: number;
  estimated_minutes: number;
}

const GAME_FIELDS = 'id,topic_id,position,slug,mechanic,title,tier,xp_max,estimated_minutes';

export function getPublishedGamesByTopicIds(topicIds: readonly string[]): Promise<GameRow[] | null> {
  if (topicIds.length === 0) return Promise.resolve([]);
  return serviceRest<GameRow[]>(
    `/games?status=eq.published&topic_id=${inFilter(topicIds)}&select=${GAME_FIELDS}&order=position.asc`,
  );
}

export async function getPublishedGameById(gameId: string): Promise<GameRow | null> {
  const rows = await serviceRest<GameRow[]>(`/games?id=eq.${eu(gameId)}&status=eq.published&select=${GAME_FIELDS}`);
  return rows?.[0] ?? null;
}

// ---- game_documents -------------------------------------------------------------

export interface GameDocumentRow {
  locale: string;
  schema_version: number;
  document: Json;
}

/**
 * Every locale row for one game, CLIENT-SAFE by construction: `validation` is not
 * in the select list at all, so the sidecar never enters the process on a path
 * that ends at a browser. Not selecting it beats stripping it — a column that was
 * never fetched cannot be forgotten in a spread.
 */
export function getGameDocumentLocales(gameId: string): Promise<GameDocumentRow[] | null> {
  return serviceRest<GameDocumentRow[]>(`/game_documents?game_id=eq.${eu(gameId)}&select=locale,schema_version,document`);
}

export interface GameDocumentReplayRow extends GameDocumentRow {
  /** SERVER-ONLY (0027). Reached only from POST /complete, never serialized out. */
  validation: Json;
}

/** The reward path's read: manifest + sidecar, for the replay only. */
export function getGameDocumentLocalesForReplay(gameId: string): Promise<GameDocumentReplayRow[] | null> {
  return serviceRest<GameDocumentReplayRow[]>(
    `/game_documents?game_id=eq.${eu(gameId)}&select=locale,schema_version,document,validation`,
  );
}

// ---- game_progress ---------------------------------------------------------------

export interface GameProgressRow {
  game_id: string;
  best_score: number;
  plays: number;
  passed: boolean;
  xp_earned: number;
  last_played_at: string | null;
}

const PROGRESS_FIELDS = 'game_id,best_score,plays,passed,xp_earned,last_played_at';

export function getGameProgressForGames(userId: string, gameIds: readonly string[]): Promise<GameProgressRow[] | null> {
  if (gameIds.length === 0) return Promise.resolve([]);
  return serviceRest<GameProgressRow[]>(
    `/game_progress?user_id=eq.${eu(userId)}&game_id=${inFilter(gameIds)}&select=${PROGRESS_FIELDS}`,
  );
}

/** `null` = Vault did not answer. An ABSENT row is `{ found: true, row: null }` —
 *  "never played" and "could not read" must not collapse into one value on a path
 *  that feeds a high-water-mark update (§1.14). */
export async function getGameProgressRow(userId: string, gameId: string): Promise<{ row: GameProgressRow | null } | null> {
  const rows = await serviceRest<GameProgressRow[]>(
    `/game_progress?user_id=eq.${eu(userId)}&game_id=eq.${eu(gameId)}&select=${PROGRESS_FIELDS}`,
  );
  if (rows === null) return null;
  return { row: rows[0] ?? null };
}

export interface GameProgressPatch {
  best_score: number;
  plays: number;
  passed: boolean;
  xp_earned: number;
  last_played_at: string;
}

/** No client INSERT/UPDATE policy (0027) — Core is the only writer. Upsert by (user_id, game_id). */
export async function upsertGameProgress(userId: string, gameId: string, patch: GameProgressPatch): Promise<boolean> {
  const res = await serviceRest<unknown>('/game_progress?on_conflict=user_id,game_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, game_id: gameId, ...patch }),
  });
  return res !== null;
}

// ---- game_attempts ----------------------------------------------------------------

export interface GameAttemptInsert {
  userId: string;
  gameId: string;
  runId: string;
  /** The SERVER's replayed score. The client never sends one. */
  score: number;
  durationSeconds: number;
  /** Derived aggregates only — never the raw input log (§1.9, 0027). */
  stats: Record<string, number>;
}

export async function insertGameAttempt(attempt: GameAttemptInsert): Promise<boolean> {
  const res = await serviceRest<unknown>('/game_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: attempt.userId,
      game_id: attempt.gameId,
      run_id: attempt.runId,
      score: attempt.score,
      duration_seconds: attempt.durationSeconds,
      stats: attempt.stats,
    }),
  });
  return res !== null;
}

/**
 * How many attempts this user has already recorded for THIS run id. `null` = Vault
 * did not answer.
 *
 * A run id is single-use: XP is a high-water mark, so re-POSTing one finished run
 * pays no extra XP — but `plays` and `minutes_learned` would climb on every retry,
 * which is a reward-inflation path that costs nothing to close here.
 */
export async function countAttemptsForRun(userId: string, gameId: string, runId: string): Promise<number | null> {
  const rows = await serviceRest<{ run_id: string }[]>(
    `/game_attempts?user_id=eq.${eu(userId)}&game_id=eq.${eu(gameId)}&run_id=eq.${eu(runId)}&select=run_id`,
  );
  if (rows === null) return null;
  return rows.length;
}

// ---- learning_stats ----------------------------------------------------------------

/**
 * The columns a GAME may write (GAME_ENGINE.md §6.1). `lessons_completed` is
 * absent from this type ON PURPOSE and must never be added: a game is not a
 * lesson, and incrementing it would corrupt course progress, the parent
 * dashboard, the `lessons_completed === 0` activation milestone in
 * routes/learn.ts and every funnel in dataintel. Omitting the column from the
 * PATCH body — rather than writing back the value that was read — also means a
 * lesson completed concurrently with a game cannot be clobbered.
 */
export interface GameStatsPatch {
  xp_points: number;
  minutes_learned: number;
  streak_days: number;
  longest_streak: number;
  last_active_date?: string;
}

/** Learning stats are system-written only (0006) — service role applies the delta. */
export async function patchLearningStatsFromGame(userId: string, patch: GameStatsPatch): Promise<boolean> {
  const res = await serviceRest<unknown>(`/learning_stats?user_id=eq.${eu(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return res !== null;
}
