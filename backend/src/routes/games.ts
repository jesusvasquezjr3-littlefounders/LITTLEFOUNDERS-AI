import express, { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { groupGameCatalog, unlockedTopicIds } from '../services/gameCatalog.js';
import {
  countAttemptsForRun,
  getGameDocumentLocales,
  getGameDocumentLocalesForReplay,
  getGameProgressForGames,
  getGameProgressRow,
  getPublishedGameById,
  getPublishedGamesByTopicIds,
  insertGameAttempt,
  loadCourseTreeForUser,
  patchLearningStatsFromGame,
  upsertGameProgress,
  type GameRow,
} from '../services/gameData.js';
import { MAX_EVENTS_CEILING, pickGameLocale, stripValidation } from '../services/gameDocument.js';
import { deriveGameResult } from '../services/gameReplay.js';
import {
  getRolesForGate,
  hasActiveAnalyticsConsent,
  insertLearningEvents,
  stampRole,
} from '../services/insights.js';
import { isCalendarDate, isFirstActivityToday, nextStreak } from '../services/streak.js';
import {
  getAdventureById,
  getFullOwnProfile,
  getLearningStatsForUpdate,
  getPublishedCourseById,
  getPublishedCourseRows,
  getSagaById,
  getTopicById,
} from '../services/supabaseRest.js';

/*
 * /api/v1/games — server-authoritative game catalog, delivery and reward
 * (GAME_ENGINE.md §6-§8). Core is the ONLY place lock state and scores are
 * computed; the client never re-derives either.
 *
 * The reward is DERIVED, not reported: `POST /:gameId/complete` carries no score
 * at all — it carries the input log, which Core replays through the parity copy of
 * the browser's own simulator (../game-contract/, the twin of ../lesson-contract/).
 * A replay violation, an out-of-bounds result or an implausible duration is a
 * 422 RESULT_REJECTED with no partial reward.
 *
 * The server-only validation sidecar (`game_documents.validation`) is never
 * SELECTed on any path that ends at a browser — a column that was never fetched
 * cannot be leaked by a spread — and the one path that does read it
 * (`/complete`) never serializes it.
 */

const NOT_FOUND = 'NOT_FOUND';
const GAME_LOCKED = 'GAME_LOCKED';
const RESULT_REJECTED = 'RESULT_REJECTED';

/**
 * Body budget for this router. The global 64kb parser is mounted BELOW this route
 * in app.ts, so `/complete` gets its own limit instead of raising everyone's —
 * the pattern `/api/v1/events` already uses. 1mb is the ceiling implied by the
 * sidecar contract: `max_events` is capped at 20 000 and one event serializes to
 * roughly 45 bytes.
 */
const GAMES_JSON_LIMIT = '1mb';

interface GameContext {
  game: GameRow;
  /** Whether the bound topic has >= 1 lesson this user has PASSED (§8). */
  unlocked: boolean;
}

/**
 * Walk game → topic → saga → adventure → course, then assemble that course's tree,
 * to resolve one game's lock state.
 *
 * Every ancestor read uses the USER's token, so RLS's published-chain policies —
 * not this code — decide what exists for this caller; an unpublished ancestor
 * anywhere makes the game a 404, exactly as it does for a lesson.
 */
async function resolveGameContext(accessToken: string, userId: string, gameId: string): Promise<'not_found' | 'unreachable' | GameContext> {
  const game = await getPublishedGameById(gameId);
  if (!game) return 'not_found';
  const topic = await getTopicById(accessToken, game.topic_id);
  if (!topic) return 'not_found';
  const saga = await getSagaById(accessToken, topic.saga_id);
  if (!saga) return 'not_found';
  const adventure = await getAdventureById(accessToken, saga.adventure_id);
  if (!adventure) return 'not_found';
  const course = await getPublishedCourseById(accessToken, adventure.course_id);
  if (!course) return 'not_found';
  const tree = await loadCourseTreeForUser(accessToken, userId, course);
  if (!tree) return 'unreachable';
  return { game, unlocked: unlockedTopicIds(tree).has(topic.id) };
}

/** The caller's document locale: profile locale → es-MX → whatever exists. */
async function callerLocale(accessToken: string, userId: string): Promise<string | null> {
  const profiles = await getFullOwnProfile(accessToken, userId);
  return profiles?.[0]?.locale ?? null;
}

export function gamesRouter(): Router {
  const router = Router();
  // Mounted above the app-level json parser (app.ts), so this router parses its
  // own bodies — see GAMES_JSON_LIMIT. requireAuth runs FIRST: nothing here reads
  // the body before authenticating, so an anonymous caller must not be able to
  // make Core buffer and parse a megabyte before its 401.
  router.use(requireAuth, express.json({ limit: GAMES_JSON_LIMIT }));

  // 1. GET / — published games + this caller's progress, grouped course → adventure → topic.
  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    const courseRows = await getPublishedCourseRows(user.accessToken);
    if (!courseRows) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    const trees = [];
    for (const course of courseRows) {
      const tree = await loadCourseTreeForUser(user.accessToken, user.id, course);
      if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
      trees.push(tree);
    }

    // Only topics this caller can already see through the RLS-enforced tree reads
    // reach the games query — so the published-chain posture holds structurally.
    const topicIds: string[] = [];
    for (const tree of trees) {
      for (const adventure of tree.adventures) {
        for (const saga of adventure.sagas) {
          for (const topic of saga.topics) topicIds.push(topic.id);
        }
      }
    }

    const games = await getPublishedGamesByTopicIds(topicIds);
    if (!games) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const progress = await getGameProgressForGames(user.id, games.map((g) => g.id));
    if (!progress) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    return ok(res, { courses: groupGameCatalog(trees, games, progress) });
  });

  const GameIdParam = z.object({ gameId: z.string().uuid() });

  // 2. GET /:gameId — meta + the CLIENT-SAFE document, locale-resolved.
  router.get('/:gameId', async (req, res) => {
    const params = GameIdParam.safeParse(req.params);
    if (!params.success) return fail(res, 404, NOT_FOUND, 'No such game');

    const user = authedUser(res);
    const ctx = await resolveGameContext(user.accessToken, user.id, params.data.gameId);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such game');
    // The document never leaves the server for a locked game (§8).
    if (!ctx.unlocked) return fail(res, 403, GAME_LOCKED, 'Finish a lesson in this topic first');

    const docs = await getGameDocumentLocales(params.data.gameId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const picked = pickGameLocale(docs, await callerLocale(user.accessToken, user.id));
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such game');

    const progress = await getGameProgressRow(user.id, params.data.gameId);
    if (!progress) return fail(res, 502, 'INTERNAL', 'Content service unreachable');

    return ok(res, {
      game: {
        id: ctx.game.id,
        slug: ctx.game.slug,
        title: ctx.game.title,
        mechanic: ctx.game.mechanic,
        tier: ctx.game.tier,
        xp_max: ctx.game.xp_max,
        estimated_minutes: ctx.game.estimated_minutes,
        position: ctx.game.position,
        topic_id: ctx.game.topic_id,
        best_score: progress.row?.best_score ?? 0,
        plays: progress.row?.plays ?? 0,
        passed: progress.row?.passed ?? false,
        xp_earned: progress.row?.xp_earned ?? 0,
      },
      locale: picked.locale,
      // `validation` was never selected; this strips a sidecar that somehow lived
      // INSIDE the document jsonb. Defense in depth, not the primary control.
      document: stripValidation(picked.document),
    });
  });

  // 3. POST /:gameId/complete — the server REPLAYS the run and derives the reward.
  const CompleteBody = z.object({
    /** This play-through's id. Single-use: a run is credited exactly once. */
    run_id: z.string().uuid(),
    /** The PRNG seed the client played with — the replay must reproduce its stream
     *  bit for bit. It reshuffles content only; the score still comes from the
     *  replay, and the §9 winnability gate holds for every seed. */
    seed: z.number().int().min(0).max(4_294_967_295),
    input_log: z
      .array(
        z.strictObject({
          tick: z.number().int().min(0).max(200_000),
          action: z.string().min(1).max(32),
          slot: z.string().min(1).max(48).optional(),
          x: z.number().finite().optional(),
          y: z.number().finite().optional(),
          n: z.number().finite().optional(),
        }),
      )
      // The hard ceiling; the document's own `validation.max_events` tightens it
      // inside replayGame(), which the client cannot see and must not be told.
      .max(MAX_EVENTS_CEILING),
    duration_seconds: z.number().int().min(0).max(7200),
    /** The learner's LOCAL calendar date — the day-streak anchor. A kid's day
     *  follows their wall clock, not the server's UTC. */
    local_date: z.string().refine(isCalendarDate, 'local_date must be YYYY-MM-DD'),
  });

  router.post('/:gameId/complete', async (req, res) => {
    const params = GameIdParam.safeParse(req.params);
    if (!params.success) return fail(res, 404, NOT_FOUND, 'No such game');
    const parsed = CompleteBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');

    const user = authedUser(res);
    const gameId = params.data.gameId;
    const ctx = await resolveGameContext(user.accessToken, user.id, gameId);
    if (ctx === 'unreachable') return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (ctx === 'not_found') return fail(res, 404, NOT_FOUND, 'No such game');
    if (!ctx.unlocked) return fail(res, 403, GAME_LOCKED, 'Finish a lesson in this topic first');

    const docs = await getGameDocumentLocalesForReplay(gameId);
    if (!docs) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    // Resolved exactly as GET /:gameId resolved it, so the replay runs the same
    // manifest the player was served.
    const picked = pickGameLocale(docs, await callerLocale(user.accessToken, user.id));
    if (!picked) return fail(res, 404, NOT_FOUND, 'No such game');

    // A run id is single-use. XP is a high-water mark, so re-POSTing a finished
    // run pays no extra XP — but `plays` and `minutes_learned` would climb on
    // every retry, and that is reward inflation with no play behind it.
    const alreadyRecorded = await countAttemptsForRun(user.id, gameId, parsed.data.run_id);
    if (alreadyRecorded === null) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (alreadyRecorded > 0) return fail(res, 422, RESULT_REJECTED, 'run_already_recorded');

    const derived = deriveGameResult({
      rawDocument: picked.document,
      rawValidation: picked.validation,
      mechanic: ctx.game.mechanic,
      rowXpMax: ctx.game.xp_max,
      seed: parsed.data.seed,
      inputLog: parsed.data.input_log,
      durationSeconds: parsed.data.duration_seconds,
    });
    if (!derived.ok) {
      // Logged verbatim: the refusal reasons are stable structural strings, and a
      // spike in one of them is either a cheat attempt or a determinism bug — both
      // of which are invisible without this line.
      console.warn(`[games] result rejected game=${gameId} reason=${derived.reason}`);
      return fail(res, 422, RESULT_REJECTED, derived.reason);
    }
    const { score, passed, xpEarned, stats, minutesDelta } = derived.result;

    const recorded = await insertGameAttempt({
      userId: user.id,
      gameId,
      runId: parsed.data.run_id,
      score,
      durationSeconds: parsed.data.duration_seconds,
      // Derived aggregates only. The raw input log was replayed in memory above
      // and is discarded here — it is never persisted (§1.9, 0027).
      stats,
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record the attempt');

    const previous = await getGameProgressRow(user.id, gameId);
    if (!previous) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    const previousXpEarned = previous.row?.xp_earned ?? 0;
    const newBestScore = Math.max(previous.row?.best_score ?? 0, score);
    const newPlays = (previous.row?.plays ?? 0) + 1;
    const newPassed = (previous.row?.passed ?? false) || passed;
    const newXpEarned = Math.max(previousXpEarned, xpEarned);
    const xpDelta = Math.max(0, newXpEarned - previousXpEarned);

    const savedProgress = await upsertGameProgress(user.id, gameId, {
      best_score: newBestScore,
      plays: newPlays,
      passed: newPassed,
      xp_earned: newXpEarned,
      last_played_at: new Date().toISOString(),
    });
    if (!savedProgress) return fail(res, 502, 'INTERNAL', 'Could not save progress');

    // null means Vault did not answer — NOT "this learner has zero progress".
    // Abort rather than compute the update from assumed zeros: the PATCH below is
    // a blind overwrite and would erase accumulated totals that exist nowhere else
    // (§1.14, the documented incident). The attempt and progress rows above are
    // already saved, so nothing is lost by stopping; the client can retry.
    const statsRow = await getLearningStatsForUpdate(user.id);
    if (!statsRow) return fail(res, 502, 'INTERNAL', 'Progress was saved, but learning stats could not be updated');

    // Streak semantics, identical to lessons: any PASSED activity today sustains
    // or extends the day streak, anchored to last_active_date (0009) with pure
    // calendar-date maths only.
    const todayLocal = parsed.data.local_date;
    const firstToday = passed && isFirstActivityToday(statsRow.last_active_date, todayLocal);
    const newStreak = passed ? nextStreak(statsRow.last_active_date, statsRow.streak_days, todayLocal) : statsRow.streak_days;
    const streakExtended = newStreak > statsRow.streak_days;
    const newLongestStreak = Math.max(statsRow.longest_streak ?? 0, newStreak);

    // `lessons_completed` is deliberately absent from this patch — a game is not a
    // lesson (GAME_ENGINE.md §6.1).
    const statsUpdated = await patchLearningStatsFromGame(user.id, {
      xp_points: statsRow.xp_points + xpDelta,
      minutes_learned: statsRow.minutes_learned + minutesDelta,
      streak_days: newStreak,
      longest_streak: newLongestStreak,
      ...(passed ? { last_active_date: todayLocal } : {}),
    });
    if (!statsUpdated) return fail(res, 502, 'INTERNAL', 'Progress was saved, but learning stats could not be updated');

    /*
     * Recorded SERVER-side because only the server knows the DERIVED score — the
     * client's number is never trusted, so a client-emitted completion event would
     * be a claim about a reward it did not compute. Fire-and-forget and
     * consent-gated like every other kid event: a kid with no active analytics
     * consent, or a consent lookup Vault cannot answer, produces no row (§1.9,
     * fail-closed). `value` is the score — numeric only, no free text.
     *
     * `game_start` is NOT emitted here. The server cannot legitimately assert it:
     * fetching a document is not starting a game (a player can open the recap card
     * and leave), and only the client knows when the loop actually began. It stays
     * a client event on /api/v1/events.
     */
    void (async () => {
      const roles = await getRolesForGate(user.id);
      if (!roles || roles.length === 0) return;
      if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
      await insertLearningEvents([{
        user_id: user.id, role: stampRole(roles), event: 'game_complete',
        route_class: 'games', game_id: gameId, value: score,
      }]);
    })();

    if (streakExtended) {
      void (async () => {
        const roles = await getRolesForGate(user.id);
        if (!roles || roles.length === 0) return;
        if (roles.includes('kid') && (await hasActiveAnalyticsConsent(user.id)) !== true) return;
        await insertLearningEvents([{
          user_id: user.id, role: stampRole(roles), event: 'streak_extend',
          route_class: 'games', value: newStreak,
        }]);
      })();
    }

    return ok(res, {
      // THIS run's outcome, server-derived. `best_score`/`xp_earned` carry the
      // persisted all-time figures for a "today vs your best" results screen.
      score,
      passed,
      stats,
      best_score: newBestScore,
      plays: newPlays,
      xp_earned: newXpEarned,
      xp_delta: xpDelta,
      streak_days: newStreak,
      longest_streak: newLongestStreak,
      streak_extended: streakExtended,
      first_today: firstToday,
      minutes_delta: minutesDelta,
      minutes_learned: statsRow.minutes_learned + minutesDelta,
    });
  });

  return router;
}
