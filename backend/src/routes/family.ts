import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { assembleCourseTree } from '../services/courseTree.js';
import {
  getConsentsForKids,
  getRolesForGate,
  grantAnalyticsConsent,
  insertLearningEvents,
  revokeAnalyticsConsent,
  stampRole,
} from '../services/insights.js';
import {
  getAdventuresByCourseIds,
  getGamesForTopics,
  getKidGameProgress,
  getKidLearningStats,
  getKidLessonProgress,
  getKidProfiles,
  getKidsGameProgress,
  getLessonsByTopicIds,
  getPublishedCourseBySlug,
  getSagasByAdventureIds,
  getTopicsBySagaIds,
  getVerifiedKidLinks,
  type GameProgressRow,
} from '../services/supabaseRest.js';

/*
 * /api/v1/family — the parent dashboard's data plane (roadmap.sh Teams
 * analog, 2026-07-25 analysis: 'watch someone's learning on a map' is the
 * feature people pay per-seat for; here it IMPLEMENTS the parent-visibility
 * product invariant, /AGENTS.md §1.9).
 *
 * Access model (§1.3 DB-AND-app-layer): the surface is parent-role gated,
 * and every kid read re-verifies a VERIFIED guardian_links row for THIS
 * caller before any service-role fetch. Course CONTENT is read with the
 * PARENT's own token (published-chain RLS does the filtering); only the
 * kid's progress/stats rows use the service role — and only the whitelisted
 * fields the dashboard shows.
 */

const NOT_FOUND = 'NOT_FOUND';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';

/*
 * Game activity rollup (GAME_ENGINE.md §6-§7). Games are the second category
 * of kid activity, so the parent surfaces carry them alongside lessons — §1.9
 * parent visibility is an invariant, and a dashboard that showed only lessons
 * once games ship would under-report what a child actually does here.
 *
 * `xpEarned` is a COMPONENT of the kid's learning_stats.xp_points, not an
 * addition to it: POST /games/:id/complete folds game XP into the same
 * counter. Never sum it with `stats.xpPoints`.
 */
interface GameRollup {
  /** Distinct games with at least one recorded play. */
  gamesPlayed: number;
  gamesPassed: number;
  /** Total play-throughs across those games. */
  totalPlays: number;
  xpEarned: number;
  lastPlayedAt: string | null;
}

/** Later of two ISO timestamps, parsed rather than string-compared (offsets differ). */
function laterTimestamp(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return tb > ta ? b : a;
}

/** Pure fold over already-fetched game_progress rows — no I/O, no defaults invented for a failed read. */
function foldGameProgress(rows: readonly GameProgressRow[]): GameRollup {
  const rollup: GameRollup = { gamesPlayed: 0, gamesPassed: 0, totalPlays: 0, xpEarned: 0, lastPlayedAt: null };
  for (const row of rows) {
    if (row.plays > 0) rollup.gamesPlayed += 1;
    if (row.passed) rollup.gamesPassed += 1;
    rollup.totalPlays += row.plays;
    rollup.xpEarned += row.xp_earned;
    rollup.lastPlayedAt = laterTimestamp(rollup.lastPlayedAt, row.last_played_at);
  }
  return rollup;
}

export function familyRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(['parent']));

  /** The caller's verified kids, with whitelisted display fields. */
  router.get('/kids', async (_req, res) => {
    const user = authedUser(res);
    const links = await getVerifiedKidLinks(user.id);
    if (!links) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    const profiles = await getKidProfiles(links.map((l) => l.kid_user_id));
    if (!profiles) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load kid profiles');
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    // Consent state rides along so the dashboard can render the toggle
    // without an extra round trip. A failed lookup FAILS the request like
    // every sibling lookup above: rendering "off" while collection continues
    // would mislead the parent in exactly the §1.9-sensitive direction.
    const consents = await getConsentsForKids(links.map((l) => l.kid_user_id));
    if (!consents) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load consent state');
    // Lifetime game rollup per kid, one round trip for the whole family.
    // FAILS the request like every sibling lookup instead of degrading to
    // zeros: telling a parent "0 games played" when the read merely failed
    // under-reports their child's activity — the §1.9-sensitive direction.
    const gameRows = await getKidsGameProgress(links.map((l) => l.kid_user_id));
    if (!gameRows) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load game activity');
    const gameRowsByKid = new Map<string, GameProgressRow[]>();
    for (const row of gameRows) {
      const bucket = gameRowsByKid.get(row.user_id);
      if (bucket) bucket.push(row);
      else gameRowsByKid.set(row.user_id, [row]);
    }
    return ok(res, {
      kids: links.map((l) => ({
        userId: l.kid_user_id,
        displayName: byId.get(l.kid_user_id)?.display_name ?? null,
        username: byId.get(l.kid_user_id)?.username ?? null,
        analyticsConsent: consents.get(l.kid_user_id) ?? false,
        games: foldGameProgress(gameRowsByKid.get(l.kid_user_id) ?? []),
      })),
    });
  });

  /*
   * Analytics consent for a kid — the §1.9 parental gate (/INSIGHTS.md).
   * Grant and revoke are BOTH re-guarded by a verified guardian_links row
   * for THIS caller; the consent row records who granted and when, and a
   * revocation keeps the row (audit) while stopping collection immediately.
   */
  router.post('/kids/:kidId/analytics-consent', async (req, res) => {
    const parsedKidId = z.string().uuid().safeParse(req.params.kidId);
    if (!parsedKidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const kidId = parsedKidId.data;
    const user = authedUser(res);
    const links = await getVerifiedKidLinks(user.id);
    if (!links) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!links.some((l) => l.kid_user_id === kidId)) {
      return fail(res, 403, 'FORBIDDEN', 'No verified guardian link for this kid');
    }
    const granted = await grantAnalyticsConsent(kidId, user.id);
    if (granted === null) return fail(res, 502, DATA_UNAVAILABLE, 'Consent could not be stored');
    // The PARENT's decision is itself family conduct. Subject is the parent;
    // no kid identifier enters the row. Recorded only when the state actually
    // changed — re-tapping an already-on toggle is not a new decision.
    if (granted === 'changed') {
      void insertLearningEvents([{ user_id: user.id, role: 'parent', event: 'consent_grant', route_class: 'family' }]);
    }
    return ok(res, { kidId, analyticsConsent: true });
  });

  router.delete('/kids/:kidId/analytics-consent', async (req, res) => {
    const parsedKidId = z.string().uuid().safeParse(req.params.kidId);
    if (!parsedKidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const kidId = parsedKidId.data;
    const user = authedUser(res);
    const links = await getVerifiedKidLinks(user.id);
    if (!links) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!links.some((l) => l.kid_user_id === kidId)) {
      return fail(res, 403, 'FORBIDDEN', 'No verified guardian link for this kid');
    }
    const revoked = await revokeAnalyticsConsent(kidId);
    if (revoked === null) return fail(res, 502, DATA_UNAVAILABLE, 'Consent could not be revoked');
    if (revoked === 'changed') {
      void insertLearningEvents([{ user_id: user.id, role: 'parent', event: 'consent_revoke', route_class: 'family' }]);
    }
    return ok(res, { kidId, analyticsConsent: false });
  });

  /** A kid's territory for one course: the SAME CourseTree shape the kid sees, computed from THEIR progress, plus a stats strip and this course's game activity. */
  router.get('/kids/:kidId/courses/:slug/territory', async (req, res) => {
    const user = authedUser(res);
    const kidId = req.params.kidId as string;

    // Guard first: a verified guardian link for THIS caller and THIS kid.
    const links = await getVerifiedKidLinks(user.id);
    if (!links) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!links.some((l) => l.kid_user_id === kidId)) {
      return fail(res, 403, 'FORBIDDEN', 'No verified guardian link for this kid');
    }

    // Content through the parent's OWN token — published-chain RLS filters.
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.slug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');
    const adventures = await getAdventuresByCourseIds(user.accessToken, [course.id]);
    if (!adventures) return fail(res, 502, DATA_UNAVAILABLE, 'Content service unreachable');
    const sagas = await getSagasByAdventureIds(user.accessToken, adventures.map((a) => a.id));
    if (!sagas) return fail(res, 502, DATA_UNAVAILABLE, 'Content service unreachable');
    const topics = await getTopicsBySagaIds(user.accessToken, sagas.map((s) => s.id));
    if (!topics) return fail(res, 502, DATA_UNAVAILABLE, 'Content service unreachable');
    const lessons = await getLessonsByTopicIds(user.accessToken, topics.map((t) => t.id));
    if (!lessons) return fail(res, 502, DATA_UNAVAILABLE, 'Content service unreachable');

    // Games hang off the SAME topics as lessons (0027), so this course's games
    // come from the topic ids already resolved above — still the parent's own
    // token, still the published-chain policy doing the filtering.
    const gameRows = await getGamesForTopics(user.accessToken, topics.map((t) => t.id));
    if (!gameRows) return fail(res, 502, DATA_UNAVAILABLE, 'Content service unreachable');

    // The KID's rows — service role, post-guard, whitelisted fields only.
    const progress = await getKidLessonProgress(kidId, lessons.map((l) => l.id));
    if (!progress) return fail(res, 502, DATA_UNAVAILABLE, 'Progress unreachable');
    const gameProgress = await getKidGameProgress(kidId, gameRows.map((g) => g.id));
    if (!gameProgress) return fail(res, 502, DATA_UNAVAILABLE, 'Game progress unreachable');
    const statsRows = await getKidLearningStats(kidId);
    if (!statsRows) return fail(res, 502, DATA_UNAVAILABLE, 'Stats unreachable');

    // Server-side capture: a parent looking at a kid's territory IS the
    // family-conduct signal (/INSIGHTS.md). The subject of the event is the
    // CALLER, never the kid — no kid identifier enters the row. The caller
    // goes through the SAME role policy as ingest: roles resolved with the
    // service role, kid-wins stamping, and a kid-anomaly (kid+parent, a §1.3
    // bug this codebase defends against elsewhere) records nothing rather
    // than bypassing the consent gate under a hard-coded 'parent'.
    // Fire-and-forget: telemetry must not add latency or failure modes here.
    void (async () => {
      const callerRoles = await getRolesForGate(user.id);
      if (!callerRoles || callerRoles.length === 0 || callerRoles.includes('kid')) return;
      const storedEvent = await insertLearningEvents([
        { user_id: user.id, role: stampRole(callerRoles), event: 'territory_view', route_class: 'family' },
      ]);
      if (!storedEvent) console.warn('[backend] territory_view event dropped (Vault unavailable)');
    })();

    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress);
    const stats = statsRows[0] ?? null;

    // Game activity for THIS course, shaped as a sibling of `tree` rather than
    // folded into it: assembleCourseTree() is shared verbatim with routes/
    // learn.ts, and every item carries `topicId` so the territory view can hang
    // each game off the topic node it reinforces without a second contract.
    const progressByGame = new Map(gameProgress.map((p) => [p.game_id, p]));
    const gameItems = gameRows
      .slice()
      .sort((a, b) => (a.topic_id === b.topic_id ? a.position - b.position : a.topic_id < b.topic_id ? -1 : 1))
      .map((g) => {
        const played = progressByGame.get(g.id);
        return {
          gameId: g.id,
          topicId: g.topic_id,
          slug: g.slug,
          title: g.title,
          mechanic: g.mechanic,
          tier: g.tier,
          position: g.position,
          xpMax: g.xp_max,
          estimatedMinutes: g.estimated_minutes,
          // No row yet = never played. Zeros here are the ABSENCE of a play,
          // not a swallowed failure: a failed read already 502'd above.
          bestScore: played?.best_score ?? 0,
          passed: played?.passed ?? false,
          plays: played?.plays ?? 0,
          xpEarned: played?.xp_earned ?? 0,
          lastPlayedAt: played?.last_played_at ?? null,
        };
      });

    return ok(res, {
      tree,
      // Course-scoped totals (the /kids rollup is the lifetime one).
      games: { totals: foldGameProgress(gameProgress), items: gameItems },
      stats: stats
        ? {
            xpPoints: stats.xp_points,
            lessonsCompleted: stats.lessons_completed,
            streakDays: stats.streak_days,
            longestStreak: stats.longest_streak,
            lastActiveDate: stats.last_active_date,
          }
        : null,
    });
  });

  return router;
}
