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
  getKidLearningStats,
  getKidLessonProgress,
  getKidProfiles,
  getLessonsByTopicIds,
  getPublishedCourseBySlug,
  getSagasByAdventureIds,
  getTopicsBySagaIds,
  getVerifiedKidLinks,
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
    return ok(res, {
      kids: links.map((l) => ({
        userId: l.kid_user_id,
        displayName: byId.get(l.kid_user_id)?.display_name ?? null,
        username: byId.get(l.kid_user_id)?.username ?? null,
        analyticsConsent: consents.get(l.kid_user_id) ?? false,
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

  /** A kid's territory for one course: the SAME CourseTree shape the kid sees, computed from THEIR progress, plus a stats strip. */
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

    // The KID's rows — service role, post-guard, whitelisted fields only.
    const progress = await getKidLessonProgress(kidId, lessons.map((l) => l.id));
    if (!progress) return fail(res, 502, DATA_UNAVAILABLE, 'Progress unreachable');
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

    return ok(res, {
      tree,
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
