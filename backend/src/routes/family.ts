import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { assembleCourseTree } from '../services/courseTree.js';
import { adminCreateUser, adminDeleteUser, adminUpdateUserPassword } from '../services/gotrue.js';
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
  grantRole,
  insertAuditLog,
  insertVerifiedGuardianLink,
  patchKidProfile,
  patchKidProfileFields,
  usernameExists,
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

/*
 * A child's `auth.users` identifier. `.invalid` is reserved by RFC 2606 so
 * the address can never resolve or receive mail - which is the point: it
 * exists because the auth table needs a unique handle, not because anyone
 * writes to it. Derived from the username so sign-in can reproduce it
 * without storing a second copy, which is also why a kid's username is not
 * editable: changing it would strand the account behind its old address.
 */
export const KID_EMAIL_DOMAIN = 'kids.littlefounders.invalid';
export function kidEmail(username: string): string {
  return `${username}@${KID_EMAIL_DOMAIN}`;
}

/*
 * A CEILING ON CHILDREN PER GUARDIAN. Not a product opinion about family size -
 * ten is far past any real one - but a bound on what a single compromised or
 * automated `parent` session can mint. Every child is a real `auth.users` row
 * and a real learner the platform will generate and store content for, so an
 * unbounded creation endpoint is an unbounded bill (/AGENTS.md §1.0). A parent
 * who genuinely needs an eleventh can be raised by hand; nobody can quietly
 * create ten thousand.
 */
const MAX_KIDS_PER_PARENT = 10;

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
   * CREATE A KID ACCOUNT AND LINK IT. §1.4 puts "manage a family / kid
   * accounts" on `parent` alone, and `parent` comes only from Guardian, so the
   * router's `requireRole(['parent'])` is the whole authorization story: the
   * adult standing behind this call has had an identity document matched.
   *
   * WHAT IS DELIBERATELY NOT COLLECTED. No email, no surname, no address for
   * the child. A handle the parent chooses, a display name, a passphrase, and
   * an optional birth date for the age band - which is the ceiling §1.9 sets
   * for what may travel with a minor ("age band + first name"). The auth user
   * needs SOME identifier, so it gets a synthetic one on a `.invalid` domain
   * (RFC 2606, reserved so it can never resolve); nothing mails it and the
   * child never sees it.
   *
   * ORDERING IS THE SAFETY PROPERTY. §1.3 says a `kid` row without a verified
   * guardian link is a bug rather than a state, so the account may not outlive
   * a failure to link it. The username is checked first (the common rejection,
   * before anything is written), then the auth user is created, and if the LINK
   * cannot be written the user is deleted again and the request fails. The role
   * grant is last, because a kid with no link and no role is inert while a kid
   * with a role and no link is exactly the state the invariant forbids.
   */
  const CreateKid = z.object({
    displayName: z.string().trim().min(1).max(80),
    // The DB's own constraint (0005), restated at the edge so a bad handle is
    // a 400 with a message rather than a 409 from Postgres after a signup.
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
    // Longer than the adult minimum on purpose: this is chosen BY an adult FOR
    // a child, typed rarely, and never rotated by the child themselves.
    passphrase: z.string().min(8).max(72),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    locale: z.enum(['en-US', 'es-MX', 'pt-BR']).default('en-US'),
  });

  router.post('/kids', async (req, res) => {
    const parent = authedUser(res);
    const parsed = CreateKid.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the child account details');
    const { displayName, username, passphrase, locale } = parsed.data;
    const birthDate = parsed.data.birthDate ?? null;

    // Counted from the VERIFIED links, which is the same source /kids reads, so
    // the cap can never disagree with what the parent sees.
    const existing = await getVerifiedKidLinks(parent.id);
    if (existing === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (existing.length >= MAX_KIDS_PER_PARENT) {
      return fail(res, 409, 'KID_LIMIT_REACHED', 'This account already has the maximum number of children');
    }

    const taken = await usernameExists(username);
    if (taken === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the username');
    if (taken) return fail(res, 409, 'USERNAME_IN_USE', 'That username is already taken');

    const created = await adminCreateUser({
      email: kidEmail(username),
      password: passphrase,
      displayName,
      locale,
    });
    if (created.error) {
      return fail(res, created.error.status >= 500 ? 502 : 400, created.error.code, created.error.message);
    }
    const kidId = created.data.id;

    const linked = await insertVerifiedGuardianLink(parent.id, kidId);
    if (!linked) {
      // The account cannot be allowed to exist unlinked (§1.3). A failed
      // rollback is logged rather than swallowed: it leaves an orphan that
      // someone has to know about.
      const undone = await adminDeleteUser(kidId);
      await insertAuditLog(parent.id, 'family.kid_create.rolled_back', kidId, {
        rollbackSucceeded: undone.error === null,
      });
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not link the child account');
    }

    const profiled = await patchKidProfile(kidId, {
      username,
      display_name: displayName,
      locale,
      birth_date: birthDate,
    });
    if (!profiled) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the child profile');

    const granted = await grantRole(kidId, 'kid', parent.id);
    if (!granted) return fail(res, 502, DATA_UNAVAILABLE, 'Could not grant the child role');

    // No handle, no display name, no birth date in the audit detail: the log is
    // append-only and readable by staff, and it needs to record that the act
    // happened, not to become a second copy of a minor's profile.
    await insertAuditLog(parent.id, 'family.kid_created', kidId, {});

    return ok(res, { kid: { userId: kidId, displayName, username } }, 201);
  });


  /*
   * MANAGING AN EXISTING CHILD. Every one of these re-verifies the guardian
   * link for THIS caller before touching anything - the router's parent gate
   * says the caller is A parent, never that they are THIS child's parent.
   */
  async function guardKid(req: { params: Record<string, string | undefined> }, res: Parameters<typeof fail>[0]): Promise<string | null> {
    const parsed = z.string().uuid().safeParse(req.params.kidId);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
      return null;
    }
    const parent = authedUser(res);
    const links = await getVerifiedKidLinks(parent.id);
    if (links === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      return null;
    }
    if (!links.some((l) => l.kid_user_id === parsed.data)) {
      // 404, not 403: a parent asking about someone else's child learns
      // nothing about whether that child exists.
      fail(res, 404, NOT_FOUND, 'No such child for this account');
      return null;
    }
    return parsed.data;
  }

  const UpdateKid = z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  });

  router.patch('/kids/:kidId', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const parsed = UpdateKid.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the child account details');
    // The USERNAME is deliberately absent: the child's auth address is derived
    // from it, so renaming the handle alone would strand the account.
    const patch: { display_name?: string; birth_date?: string | null } = {};
    if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName;
    if (parsed.data.birthDate !== undefined) patch.birth_date = parsed.data.birthDate;
    if (Object.keys(patch).length === 0) return fail(res, 400, 'VALIDATION_ERROR', 'Nothing to change');

    const ok_ = await patchKidProfileFields(kidId, patch);
    if (!ok_) return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the child profile');
    await insertAuditLog(authedUser(res).id, 'family.kid_updated', kidId, { fields: Object.keys(patch) });
    return ok(res, { kid: { userId: kidId, displayName: parsed.data.displayName ?? null } });
  });

  router.post('/kids/:kidId/passphrase', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const parsed = z.object({ passphrase: z.string().min(8).max(72) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'The passphrase must be at least 8 characters');

    const updated = await adminUpdateUserPassword(kidId, parsed.data.passphrase);
    if (updated.error) {
      return fail(res, updated.error.status >= 500 ? 502 : 400, updated.error.code, updated.error.message);
    }
    // Records THAT it changed and by whom. Never the value, and never the old
    // one: audit_logs is append-only and readable by staff.
    await insertAuditLog(authedUser(res).id, 'family.kid_passphrase_rotated', kidId, {});
    return ok(res, { rotated: true });
  });

  router.delete('/kids/:kidId', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;

    // Audited BEFORE the delete, because afterwards there is no row to name and
    // a failure mid-way would otherwise leave no trace that it was attempted.
    await insertAuditLog(authedUser(res).id, 'family.kid_delete.requested', kidId, {});
    const removed = await adminDeleteUser(kidId);
    if (removed.error) {
      return fail(res, removed.error.status >= 500 ? 502 : 400, removed.error.code, removed.error.message);
    }
    // Hard delete, and the cascade is the point: profiles, user_roles,
    // guardian_links and the learning rows all reference auth.users ON DELETE
    // CASCADE, so a guardian asking for their child to be removed gets the
    // child's data removed rather than hidden behind a flag.
    await insertAuditLog(authedUser(res).id, 'family.kid_deleted', kidId, {});
    return ok(res, { deleted: true });
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
