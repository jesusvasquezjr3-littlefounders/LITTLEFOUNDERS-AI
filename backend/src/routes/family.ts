import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { firstNameOnly, purgeBadgeImageIfUnreferenced, renderAchievementImage } from '../services/badges.js';
import { acceptGuardianInvite, createGuardianInvite, getGuardianInvitePreview } from '../services/guardianLifecycle.js';
import {
  decideGuardianLink,
  getDisplayNames,
  getLinkStatus,
  isRefusal,
  listLinksForKid,
  listOwnUnverifiedLinks,
  revokeOwnGuardianLink,
  UNAVAILABLE,
} from '../services/familyLifecycle.js';
import { assembleCourseTree } from '../services/courseTree.js';
import { eraseNow } from '../services/accountDeletion.js';
import { applyCoursePathway } from '../services/pathway/coursePathway.js';
import { courseEngine, coursePathwayInputs, loadLearnerPathwayContext, loadPathwayContent, readLearnerPlacementState } from '../services/pathway/pathwayData.js';
import { adminCreateUser, adminDeleteUser, adminRevokeUserSessions, adminUpdateUserPassword } from '../services/gotrue.js';
import { KID_USERNAME, renameFlaggedChild } from '../services/kidUsername.js';
import { declaredBandForDate, readAgeScreen, recordAgeScreen } from '../services/ageScreen.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import { mayDiscoverProfile, profileAccess, visibleSocialUsers } from '../services/socialVisibility.js';
import { profileFieldFlags, reviewProfileFields } from '../services/profileFieldSafety.js';
import { getChildRoleHolders, selfIssuedInviteIds } from '../services/teenWallet.js';
import { resolveLocalToday } from '../services/choreStreak.js';
import { readStreakStates } from '../services/choreStreakData.js';
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
  getCompletedCourseBadgesByUserId,
  getGoalById,
  getGuardianSocialPage,
  getGuardianSocialAuditPage,
  getGuardianSocialNotices,
  getSocialDisplayNames,
  getPendingSocialRequests,
  decideSocialConnectionForKid,
  getKidLearningStats,
  getKidLessonProgress,
  getKidProfiles,
  getLessonsByTopicIds,
  getPublishedCourseBySlug,
  getSagasByAdventureIds,
  getTasksForKids,
  getTopicsBySagaIds,
  getVerifiedKidLinks,
  getWalletBalances,
  getBadgeShareByToken,
  listActiveBadgeSharesForKid,
  revokeBadgeShare,
  grantRole,
  insertAuditLog,
  insertAchievementShareInitiation,
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
 * editable: changing it alone would strand the account behind its old address.
 * The one exception (S-06, OD-28) is a verified Tutor renaming a FLAGGED
 * handle, which changes the handle and this address in one database
 * transaction (PUT /kids/:kidId/username below).
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
  router.use(async (_req, res, next) => {
    const user = authedUser(res);
    const roles = await getRolesForGate(user.id);
    if (!roles || await requiresMinorMentorSafeguards(user.id, roles)) {
      return fail(res, 403, 'PARENT_VERIFICATION_REQUIRED', 'Current adult identity verification is required');
    }
    return next();
  });

  /** The caller's verified kids, with whitelisted display fields. */
  router.get('/kids', async (req, res) => {
    const user = authedUser(res);
    const links = await getVerifiedKidLinks(user.id);
    if (!links) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    const kidIds = links.map((l) => l.kid_user_id);
    const profiles = await getKidProfiles(kidIds);
    if (!profiles) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load kid profiles');
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    // Consent state rides along so the dashboard can render the toggle
    // without an extra round trip. A failed lookup FAILS the request like
    // every sibling lookup above: rendering "off" while collection continues
    // would mislead the parent in exactly the §1.9-sensitive direction.
    const consents = await getConsentsForKids(kidIds);
    if (!consents) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load consent state');

    // The Family Hub landing card (FAMILY_HUB.md §7): "what needs my
    // attention" per kid, not just a name to tap into. Three numbers, each
    // already owned by tasks.ts's domain (never duplicated here, only read):
    // tasks awaiting THIS parent's approval, the kid's total LF Coins across
    // all three buckets, and their chore-completion streak (kid_task_streaks,
    // 0080 — deliberately the CHORE streak, not learning_stats' lesson
    // streak, since this card is this surface's own domain).
    const tasksByKid = await getTasksForKids(kidIds);
    if (tasksByKid === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load task summaries');
    const pendingByKid = new Map<string, number>();
    for (const t of tasksByKid) {
      if (t.status === 'done') pendingByKid.set(t.assigned_to, (pendingByKid.get(t.assigned_to) ?? 0) + 1);
    }
    const walletAndStreak = await Promise.all(kidIds.map(async (id) => ({ id, balances: await getWalletBalances(id) })));
    // S07.3 (D.2): the chore streak is computed by the lapse-tolerant model
    // from recorded practised days, as of the parent's local today.
    const streaks = await readStreakStates(kidIds, resolveLocalToday(req.query.today));
    // S07.2: which linked accounts are self-registered teens (a display hint
    // only; every account-holder control re-checks the role itself).
    const childRoleHolders = await getChildRoleHolders(kidIds);
    const walletByKid = new Map(walletAndStreak.map((w) => [w.id, w.balances]));

    return ok(res, {
      kids: links.map((l) => {
        const balances = walletByKid.get(l.kid_user_id);
        return {
          userId: l.kid_user_id,
          displayName: byId.get(l.kid_user_id)?.display_name ?? null,
          username: byId.get(l.kid_user_id)?.username ?? null,
          // E.13: which of the child's fields keeps the child hidden from
          // every approved outside connection until the Tutor changes it.
          profileReview: reviewProfileFields({
            username: byId.get(l.kid_user_id)?.username ?? null,
            displayName: byId.get(l.kid_user_id)?.display_name ?? null,
          }),
          analyticsConsent: consents.get(l.kid_user_id) ?? false,
          pendingApprovalCount: pendingByKid.get(l.kid_user_id) ?? 0,
          walletTotal: balances ? balances.save + balances.spend + balances.share : null,
          taskStreakDays: streaks?.get(l.kid_user_id)?.current ?? 0,
          accountType: childRoleHolders === null ? null : childRoleHolders.has(l.kid_user_id) ? 'child' : 'teen',
        };
      }),
    });
  });


  /*
   * CREATE A KID ACCOUNT AND LINK IT. A parent role alone is insufficient:
   * staff can grant it without ID verification. Creation independently checks
   * the current service-owned adult verification before writing a child.
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
   * cannot be written the user is deleted again and the request fails. The
   * PROFILE PATCH gets the same rollback: `profiles.username` has no NOT NULL
   * constraint (0005), so leaving a verified link with an unpatched, null
   * username is the identical orphan in a different shape - discovered
   * 2026-08-31 as a real reachability path, not a hypothetical one, because a
   * kid in that state can never be renamed (username is fixed) or removed
   * (the confirm-by-username gate in ManageKidPanel.tsx has nothing to type).
   * The role grant is last, because a kid with no link and no role is inert
   * while a kid with a role and no link is exactly the state the invariant
   * forbids.
   */
  const CreateKid = z.object({
    displayName: z.string().trim().min(1).max(80),
    // The DB's own constraint (0005), restated at the edge so a bad handle is
    // a 400 with a message rather than a 409 from Postgres after a signup.
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
    // Longer than the adult minimum on purpose: this is chosen BY an adult FOR
    // a child, typed rarely, and never rotated by the child themselves.
    passphrase: z.string().min(8).max(72),
    birthDate: z.string().refine(value => declaredBandForDate(value) !== null, 'Enter a valid birth date').nullable().optional(),
    locale: z.enum(['en-US', 'es-MX', 'pt-BR']).default('en-US'),
  });

  router.post('/kids', async (req, res) => {
    const parent = authedUser(res);
    const parsed = CreateKid.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the child account details');
    const { displayName, username, passphrase, locale } = parsed.data;
    const birthDate = parsed.data.birthDate ?? null;

    // E.13: before anything is written, neither the handle nor the name may
    // carry what would locate the child off-platform. The database refuses
    // the same values (profile_fields_guard) from any writer.
    const unsafe = [
      ...(profileFieldFlags(username).length > 0 ? ['username'] : []),
      ...(profileFieldFlags(displayName).length > 0 ? ['displayName'] : []),
    ];
    if (unsafe.length > 0) return fail(res, 422, 'PROFILE_FIELD_UNSAFE', 'That name could help someone find the child outside LittleFounders', { fields: unsafe });

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
    if (!profiled) {
      // The SAME §1.3 orphan this function already refuses to leave behind
      // after a link failure, in a different shape: `profiles.username` has
      // no NOT NULL constraint (0005_profile_identity.sql), so a kid can end
      // up with a VERIFIED guardian link and a permanently null username -
      // reachable by the parent forever, un-renameable (username is
      // deliberately not editable, ManageKidPanel.tsx), and impossible to
      // remove through the confirm-by-username safety gate on that same
      // panel. Rolling back the auth user CASCADEs through profiles,
      // user_roles and guardian_links (§1.3's own comment on DELETE
      // /kids/:kidId), so one call undoes the whole sequence exactly like
      // the insertVerifiedGuardianLink failure branch above.
      const undone = await adminDeleteUser(kidId);
      await insertAuditLog(parent.id, 'family.kid_create.rolled_back', kidId, {
        rollbackSucceeded: undone.error === null,
        stage: 'profile_patch',
      });
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the child profile');
    }

    // A parent-provided date supplies the same minimal admission evidence as
    // the standalone screen. Do not ask the child to repeat or override it.
    if (birthDate && !await recordAgeScreen(kidId, declaredBandForDate(birthDate)!)) {
      const undone = await adminDeleteUser(kidId);
      await insertAuditLog(parent.id, 'family.kid_create.rolled_back', kidId, {
        rollbackSucceeded: undone.error === null, stage: 'age_declaration',
      });
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the child age declaration');
    }
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

  /*
   * S07.2 (D.3, OD-3 Option B): a self-registered teen who linked a parent
   * keeps ownership of their own account. The family mechanics (chores,
   * approvals, reward catalog, allowance, freeze) layer onto their wallet,
   * but the account-holder controls a parent has over a child they created
   * (renaming, the birth date, the passphrase, deleting the account, the
   * analytics consent the teen manages themself under H.1, and inviting
   * another Tutor, which only the teen may do) are refused for it.
   */
  async function guardManagedChild(req: { params: Record<string, string | undefined> }, res: Parameters<typeof fail>[0]): Promise<string | null> {
    const kidId = await guardKid(req, res);
    if (!kidId) return null;
    return (await refuseSelfManaged(kidId, res)) ? null : kidId;
  }

  /** true = already responded (a self-managed teen account, or the role read failed). */
  async function refuseSelfManaged(kidId: string, res: Parameters<typeof fail>[0]): Promise<boolean> {
    const roles = await getRolesForGate(kidId);
    if (roles === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account type');
      return true;
    }
    if (!roles.includes('kid')) {
      fail(res, 403, 'ACCOUNT_SELF_MANAGED', 'This teen manages their own account');
      return true;
    }
    return false;
  }

  router.post('/kids/:kidId/social/requests/:requestId/decision', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const requestId = z.string().uuid().safeParse(req.params.requestId);
    const body = z.object({ decision: z.enum(['approve', 'deny']) }).strict().safeParse(req.body);
    if (!requestId.success || !body.success || Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid connection decision');
    const result = await decideSocialConnectionForKid(requestId.data, kidId, authedUser(res).id, body.data.decision === 'approve');
    if (result === 'not-found') return fail(res, 404, NOT_FOUND, 'No such connection request');
    if (result === 'forbidden') return fail(res, 403, 'GUARDIAN_DECISION_FORBIDDEN', 'Current guardian verification is required');
    if (result === 'conflict') return fail(res, 409, 'SOCIAL_DECISION_CONFLICT', 'This request can no longer take that decision');
    if (result === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not confirm the connection decision');
    return ok(res, { requestId: requestId.data, status: result });
  });

  router.get('/kids/:kidId/social/requests', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid request page');
    const page = await getPendingSocialRequests(kidId, query.data.offset);
    if (!page) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load connection requests');
    const ids = [...new Set(page.requests.map(item => item.requesterId))];
    // The requester chose to ask this family: a private teen's card is enough
    // to name them to the deciding guardian (E.8). A hidden or flagged
    // account stays unnamed.
    const visible = await Promise.all(ids.map(async id => await profileAccess(authedUser(res).id, id) !== 'none' ? id : null));
    const names = await getSocialDisplayNames(visible.filter((id): id is string => id !== null));
    if (!names) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load request participants');
    const nameById = new Map(names.map(row => [row.user_id, row.display_name]));
    if (!await guardKid(req, res)) return res;
    return ok(res, { ...page, requests: page.requests.map(item => ({ ...item, requesterName: nameById.get(item.requesterId) ?? null })) });
  });

  router.get('/kids/:kidId/social/audit', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid audit page');
    const page = await getGuardianSocialAuditPage(kidId, query.data.offset);
    if (!page) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load social history');
    const ids = [...new Set(page.entries.flatMap(entry => [entry.sourceId, entry.targetId, ...(entry.actorId ? [entry.actorId] : [])]))];
    const visible = await Promise.all(ids.map(async id => await mayDiscoverProfile(authedUser(res).id, id) ? id : null));
    const names = await getSocialDisplayNames(visible.filter((id): id is string => id !== null));
    if (!names) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load social participants');
    const nameById = new Map(names.map(row => [row.user_id, row.display_name]));
    if (!await guardKid(req, res)) return res;
    return ok(res, { ...page, entries: page.entries.map(entry => ({ ...entry,
      sourceName: nameById.get(entry.sourceId) ?? null,
      targetName: nameById.get(entry.targetId) ?? null,
      actorName: entry.actorId ? nameById.get(entry.actorId) ?? null : null,
    })) });
  });

  router.get('/kids/:kidId/social', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = z.object({
      direction: z.enum(['followers', 'following']),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
    }).strict().safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a social list and valid page');
    const page = await getGuardianSocialPage(kidId, query.data.direction, query.data.offset);
    if (!page) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load social connections');
    const users = await visibleSocialUsers(authedUser(res).id, page.users);
    // Recheck after service reads: revocation must not knowingly release a cached graph.
    if (!await guardKid(req, res)) return res;
    return ok(res, { users, nextOffset: page.nextOffset });
  });

  /*
   * E.3 safety notices for THIS verified guardian, across all their kids.
   * Names resolve only through the current E.1 discovery admission — a
   * reported account the guardian cannot otherwise see stays private rather
   * than having its name leaked through the notice.
   */
  router.get('/social-notices', async (req, res) => {
    const query = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid notices page');
    const guardian = authedUser(res);
    const page = await getGuardianSocialNotices(guardian.id, query.data.offset);
    if (!page) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load safety notices');
    const ids = [...new Set(page.notices.map((notice) => notice.subjectId))];
    const visible = await Promise.all(ids.map(async (id) => await mayDiscoverProfile(guardian.id, id) ? id : null));
    const names = await getSocialDisplayNames(visible.filter((id): id is string => id !== null));
    if (!names) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load notice participants');
    const nameById = new Map(names.map((row) => [row.user_id, row.display_name]));
    return ok(res, { ...page, notices: page.notices.map((notice) => ({ ...notice, subjectName: nameById.get(notice.subjectId) ?? null })) });
  });

  const UpdateKid = z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
    birthDate: z.string().refine(value => declaredBandForDate(value) !== null, 'Enter a valid birth date').nullable().optional(),
  });

  router.patch('/kids/:kidId', async (req, res) => {
    const kidId = await guardManagedChild(req, res);
    if (!kidId) return res;
    const parsed = UpdateKid.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the child account details');
    // The USERNAME is deliberately absent: the child's auth address is derived
    // from it, so renaming the handle alone would strand the account.
    const patch: { display_name?: string; birth_date?: string | null } = {};
    if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName;
    if (parsed.data.birthDate !== undefined) patch.birth_date = parsed.data.birthDate;
    if (Object.keys(patch).length === 0) return fail(res, 400, 'VALIDATION_ERROR', 'Nothing to change');
    if (patch.display_name !== undefined && profileFieldFlags(patch.display_name).length > 0) {
      return fail(res, 422, 'PROFILE_FIELD_UNSAFE', 'That name could help someone find the child outside LittleFounders', { fields: ['displayName'] });
    }

    const ok_ = await patchKidProfileFields(kidId, patch);
    if (!ok_) return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the child profile');
    await insertAuditLog(authedUser(res).id, 'family.kid_updated', kidId, { fields: Object.keys(patch) });
    return ok(res, { kid: { userId: kidId, displayName: parsed.data.displayName ?? null } });
  });

  /*
   * S-06 (owner decision OD-28): a verified Tutor may change the username of
   * their linked child when the CURRENT handle is flagged (E.13). The handle
   * and the sign-in address derived from it change together in one database
   * transaction (services/kidUsername.ts), which re-checks every rule below;
   * an unflagged handle stays locked, and a self-registered teen renames their
   * own handle. The child's sessions end afterwards, so the child signs in
   * again with the new handle; the Tutor sees whether that worked.
   */
  const RenameKid = z.object({ username: KID_USERNAME }).strict();
  const RENAME_REFUSED = {
    'not-guardian': [404, NOT_FOUND, 'No such child for this account'],
    'self-managed': [403, 'ACCOUNT_SELF_MANAGED', 'This teen manages their own account'],
    'not-flagged': [409, 'USERNAME_NOT_FLAGGED', 'This username can only be changed when it was flagged'],
    unchanged: [409, 'USERNAME_UNCHANGED', 'That is already the username'],
    unsafe: [422, 'PROFILE_FIELD_UNSAFE', 'That name could help someone find the child outside LittleFounders'],
    'in-use': [409, 'USERNAME_IN_USE', 'That username is already taken'],
    shape: [400, 'VALIDATION_ERROR', 'Use 3 to 20 lowercase letters, numbers or underscores'],
    'identifier-mismatch': [409, 'SUPPORT_REQUIRED', 'This account needs support to change its username'],
    unavailable: [502, DATA_UNAVAILABLE, 'Could not change the username'],
  } as const;

  router.put('/kids/:kidId/username', async (req, res) => {
    const kidId = await guardManagedChild(req, res);
    if (!kidId) return res;
    const parsed = RenameKid.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Use 3 to 20 lowercase letters, numbers or underscores');
    if (profileFieldFlags(parsed.data.username).length > 0) {
      return fail(res, 422, 'PROFILE_FIELD_UNSAFE', 'That name could help someone find the child outside LittleFounders', { fields: ['username'] });
    }
    const guardian = authedUser(res);
    const outcome = await renameFlaggedChild(guardian.id, kidId, parsed.data.username);
    if (outcome.status !== 'renamed') {
      const [status, code, message] = RENAME_REFUSED[outcome.status];
      return fail(res, status, code, message, outcome.status === 'unsafe' ? { fields: ['username'] } : undefined);
    }
    // The database wrote the audit row with the rename. Ending the sessions is
    // a second system (GoTrue): a failure is recorded, never hidden, and the
    // rename stands (the old handle no longer signs in either way).
    const revoked = await adminRevokeUserSessions(kidId);
    const sessionsEnded = revoked.error === null;
    if (!sessionsEnded) await insertAuditLog(guardian.id, 'family.kid_username_sessions_not_ended', kidId, {});
    return ok(res, { kid: { userId: kidId, username: outcome.username }, sessionsEnded });
  });

  router.post('/kids/:kidId/passphrase', async (req, res) => {
    const kidId = await guardManagedChild(req, res);
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
    const kidId = await guardManagedChild(req, res);
    if (!kidId) return res;

    // Audited BEFORE the erasure, because afterwards there is no row to name and
    // a failure mid-way would otherwise leave no trace that it was attempted.
    await insertAuditLog(authedUser(res).id, 'family.kid_delete.requested', kidId, {});
    // E.6: the same erasure lifecycle as every other deletion - the child's
    // database rows (one transaction), their Mentor sessions, stored files
    // and warehouse rows - immediately, because the verified Tutor decided.
    const outcome = await eraseNow({ subjectId: kidId, population: 'kid', initiatedBy: 'guardian', actorId: authedUser(res).id });
    if (outcome === 'unavailable') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not delete the account');
    if (outcome === 'staff') return fail(res, 403, 'STAFF_ACCOUNT', 'A staff account is removed by a superadmin');
    if (outcome.status === 'held') {
      return ok(res, { deleted: false, status: 'held' }, 202);
    }
    if (!outcome.accountErased) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not delete the account');
    await insertAuditLog(authedUser(res).id, 'family.kid_deleted', kidId, { status: outcome.status });
    // 'finishing': the account and its database rows are gone; stored files or
    // warehouse rows are still being cleared by the daily sweep.
    return ok(res, { deleted: true, status: outcome.status === 'completed' ? 'completed' : 'finishing' });
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
    if (await refuseSelfManaged(kidId, res)) return res;
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
    if (await refuseSelfManaged(kidId, res)) return res;
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
      if (storedEvent === null) console.warn('[backend] territory_view event dropped (Vault unavailable)');
    })();

    /*
     * The SAME tree the kid sees, so the kid's placement credits count here as
     * they do on the kid's own map (0043: credited lessons count as passed).
     * In pathway mode (B.6, S05.3b) the kid's own pathway is applied: the
     * KID's age evidence, Mentor mastery and badges — read with the service
     * role after the verified-link guard above — never the parent's.
     */
    const placementState = await readLearnerPlacementState(kidId, course.id);
    if (!placementState) return fail(res, 502, DATA_UNAVAILABLE, 'Progress unreachable');
    const linearTree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress, placementState.creditedLessonIds, placementState.hasLegacyPlacement);
    let tree = linearTree;
    if (courseEngine() === 'pathway') {
      const kidScreen = await readAgeScreen(kidId);
      const ctx = kidScreen ? await loadLearnerPathwayContext(kidId, kidScreen) : null;
      const content = ctx ? await loadPathwayContent(adventures.map((a) => a.id), topics.map((t) => t.id), ctx.kcKeyById) : null;
      if (!ctx || !content) return fail(res, 502, DATA_UNAVAILABLE, 'Progress unreachable');
      tree = applyCoursePathway(linearTree, coursePathwayInputs(course, adventures.map((a) => a.id), content, ctx, placementState.hasLegacyPlacement));
    }
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

  /*
   * ACHIEVEMENT IMAGE — "Share achievement" (Product 10 F.1 per OD-20).
   *
   * The share is a PNG handed to the verified guardian who asked, in THIS
   * response, for them to send themselves (the device share sheet where it
   * accepts files, a download otherwise). Nothing about the image is
   * persisted: no token, no row, no stored Depot object, no public URL — so
   * no stranger can open it and no messaging app can build a link preview
   * from a company-hosted page.
   *
   * F.6 STANDING CONSTRAINTS, each enforced here and pinned by
   * __tests__/achievementSharingConstraints.test.ts:
   *   1. Guardian-only initiation — the family router admits only currently
   *      ID-verified adult parents, and guardKid re-verifies a VERIFIED
   *      guardian_links row for THIS kid before anything is read (and again
   *      before the bytes leave).
   *   2. Server-side achievement verification — the label is never client
   *      text: a course title only for a course in the kid's completed list,
   *      a goal only if it is this kid's and `reached`, a streak built from
   *      the stored stat and only at MIN_SHAREABLE_STREAK_DAYS or more.
   *   3. First-name-only minimization — Depot receives exactly kind, label,
   *      FIRST name and locale; its schema refuses anything else.
   */
  const STREAK_LABELS: Record<'en-US' | 'es-MX' | 'pt-BR', (days: number) => string> = {
    'en-US': (d) => `${d}-day streak`,
    'es-MX': (d) => `Racha de ${d} días`,
    'pt-BR': (d) => `Sequência de ${d} dias`,
  };
  // Below this, a shared badge would read as noise rather than an
  // achievement. A product judgment call, not a technical one — easy to
  // retune without touching the renderer.
  const MIN_SHAREABLE_STREAK_DAYS = 3;

  // Family Hub (0079) — a reached savings goal uses the same image renderer.
  // "coins", never money (owner glossary §5).
  const GOAL_REACHED_LABELS: Record<'en-US' | 'es-MX' | 'pt-BR', (title: string, target: number) => string> = {
    'en-US': (title, target) => `Saved ${target} coins for "${title}"`,
    'es-MX': (title, target) => `Ahorró ${target} monedas para "${title}"`,
    'pt-BR': (title, target) => `Poupou ${target} moedas para "${title}"`,
  };
  // F.6 minimization: a goal title is free text a family member typed, and
  // the picture cannot be recalled once sent. A title that carries a
  // contact, link, handle, platform, school, place or birth year (the E.13
  // classifier) is left out and the label names the goal generically.
  const GOAL_REACHED_GENERIC_LABELS: Record<'en-US' | 'es-MX' | 'pt-BR', (target: number) => string> = {
    'en-US': (target) => `Saved ${target} coins for a goal`,
    'es-MX': (target) => `Ahorró ${target} monedas para una meta`,
    'pt-BR': (target) => `Poupou ${target} moedas para uma meta`,
  };

  const AchievementImageRequest = z
    .object({
      kind: z.enum(['course_badge', 'streak', 'goal_reached']),
      courseSlug: z.string().min(1).max(80).optional(),
      goalId: z.string().uuid().optional(),
      locale: z.enum(['en-US', 'es-MX', 'pt-BR']).default('en-US'),
      // What the parent's device offers for the hand-off; counted, never trusted for access.
      handoff: z.enum(['share_sheet', 'download']),
    })
    .strict();

  /*
   * The pre-OD-20 link issuer. Retired: a new share is never a link. Any
   * verified parent who reaches it (an outdated client) gets a 410 before
   * anything is read, rendered or stored.
   */
  router.post('/kids/:kidId/badge', (_req, res) =>
    fail(res, 410, 'SHARE_LINKS_RETIRED', 'Achievement links are retired; share the achievement image instead'),
  );

  router.post('/kids/:kidId/achievement-image', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const parsed = AchievementImageRequest.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the achievement request');
    const { kind, courseSlug, goalId, locale, handoff } = parsed.data;

    const profiles = await getKidProfiles([kidId]);
    if (!profiles) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child profile');
    const firstName = firstNameOnly(profiles[0]?.display_name ?? '');
    if (!firstName) return fail(res, 502, DATA_UNAVAILABLE, 'Child has no display name to show on the image');

    let label: string;
    if (kind === 'course_badge') {
      if (!courseSlug) return fail(res, 400, 'VALIDATION_ERROR', 'courseSlug is required for a course_badge');
      const completed = await getCompletedCourseBadgesByUserId(kidId);
      const earned = completed.find((c) => c.course_slug === courseSlug);
      if (!earned) return fail(res, 403, 'FORBIDDEN', 'This course badge has not been earned yet');
      const titles = earned.course_title as Record<string, string>;
      label = titles[locale] ?? titles['en-US'] ?? Object.values(titles)[0] ?? courseSlug;
    } else if (kind === 'goal_reached') {
      if (!goalId) return fail(res, 400, 'VALIDATION_ERROR', 'goalId is required for a goal_reached badge');
      const goal = await getGoalById(goalId);
      // Ownership AND achievement both re-checked server-side — the same
      // "never trust a client-supplied fact about their own achievement"
      // posture as the course_badge branch above.
      if (!goal || goal.kid_user_id !== kidId || goal.status !== 'reached') {
        return fail(res, 403, 'FORBIDDEN', 'This goal has not been reached yet');
      }
      label = profileFieldFlags(goal.title).length > 0
        ? GOAL_REACHED_GENERIC_LABELS[locale](goal.target)
        : GOAL_REACHED_LABELS[locale](goal.title, goal.target);
    } else {
      const statsRows = await getKidLearningStats(kidId);
      if (!statsRows) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load learning stats');
      const streakDays = statsRows[0]?.streak_days ?? 0;
      if (streakDays < MIN_SHAREABLE_STREAK_DAYS) {
        return fail(res, 403, 'FORBIDDEN', `A streak needs at least ${MIN_SHAREABLE_STREAK_DAYS} days before it can be shared`);
      }
      label = STREAK_LABELS[locale](streakDays);
    }
    // Depot's label ceiling; a longer goal title is shortened, never refused.
    if (label.length > 80) label = `${label.slice(0, 79)}…`;

    const png = await renderAchievementImage({ kind, label, firstName, locale });
    if (!png) return fail(res, 502, DATA_UNAVAILABLE, 'Could not render the achievement image');

    // Re-verify the guardian link after the reads, same posture as the
    // badge-link list below: a link revoked mid-request releases nothing.
    if (!await guardKid(req, res)) return res;

    // Appendix L (OD-20): one "share initiated" per rendered image, by
    // hand-off and kind. Never blocks the parent; a failed write is logged
    // because an unrecorded share is a measurement gap, not a user error.
    void insertAchievementShareInitiation({ achievement_kind: kind, handoff }).then((stored) => {
      if (!stored) console.error('[achievement-sharing] share initiation was not recorded');
    });

    // Subject is the PARENT (the caller), same posture as territory_view
    // above — a kid identifier never enters this event.
    const user = authedUser(res);
    void (async () => {
      const callerRoles = await getRolesForGate(user.id);
      if (!callerRoles || callerRoles.length === 0 || callerRoles.includes('kid')) return;
      await insertLearningEvents([
        { user_id: user.id, role: stampRole(callerRoles), event: 'badge_generated', route_class: 'family' },
      ]);
    })();

    res.status(200).set({
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      'Content-Disposition': 'attachment; filename="littlefounders-achievement.png"',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(png);
  });

  /*
   * LEGACY BADGE-LINK LIST + PER-LINK REVOKE (F.2; OD-20 keeps these for
   * links issued before the cutover, until they expire). The list feeds the Family
   * panel's "revoke this link" control; the revoke kills one link
   * immediately, independent of the underlying achievement record (the
   * badge_shares row is marked, never deleted — the achievement itself is
   * untouched), and purges the badge image's own Depot object so the image
   * URL itself stops resolving, not merely the /badge/{token} page. Both
   * routes re-verify the guardian link (guardKid) so a parent can only see
   * and revoke shares for THEIR kid.
   */
  const BadgeToken = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

  router.get('/kids/:kidId/badges', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const shares = await listActiveBadgeSharesForKid(kidId);
    if (shares === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load badge links');
    // Recheck after the service read, same posture as the social routes
    // above: a revoked guardian link must not release a cached list.
    if (!await guardKid(req, res)) return res;
    return ok(res, {
      shares: shares.map((s) => ({
        token: s.token,
        achievementKind: s.achievement_kind,
        achievementLabel: s.achievement_label,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
      })),
    });
  });

  /*
   * SECOND VERIFIED GUARDIAN (A.1). An existing verified parent mints a
   * single-use, 7-day invite for one kid; any OTHER verified adult may
   * preview it (kid display fields only) and accept it — migration 0110's
   * transaction writes the verified link, marks the invite accepted and
   * reactivates a suspended kid. The family router's verified-adulthood
   * gate already admits only ID-verified parents to every route here.
   */
  router.post('/kids/:kidId/guardian-invite', async (req, res) => {
    const kidId = await guardManagedChild(req, res);
    if (!kidId) return res;
    const parent = authedUser(res);
    const invite = await createGuardianInvite(kidId, parent.id);
    if (!invite) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the invite');
    await insertAuditLog(parent.id, 'family.second_guardian_invite_created', kidId, {});
    return ok(res, { token: invite.token, expiresAt: invite.expiresAt }, 201);
  });

  const InviteToken = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

  router.get('/guardian-invite/:token', async (req, res) => {
    const token = InviteToken.safeParse(req.params.token);
    if (!token.success || Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'Check the invite link');
    const preview = await getGuardianInvitePreview(token.data);
    if (!preview) return fail(res, 404, 'NOT_FOUND', 'No such invite');
    return ok(res, {
      kidUserId: preview.kidUserId,
      displayName: preview.displayName,
      username: preview.username,
      expiresAt: preview.expiresAt,
      // S07.2: who confirms the new Tutor once accepted. A teen confirms an
      // invite they issued themself; otherwise the child's current Tutor does.
      confirmedBy: preview.selfIssued ? 'account_holder' : 'tutor',
    });
  });

  router.post('/guardian-invite/:token/accept', async (req, res) => {
    const token = InviteToken.safeParse(req.params.token);
    if (!token.success || Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'Check the invite link');
    const parent = authedUser(res);
    const result = await acceptGuardianInvite(token.data, parent.id);
    if (result === 'invalid') return fail(res, 404, 'NOT_FOUND', 'No such invite');
    if (result === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not accept the invite');
    // S07.1 (OD-21): while the child has a verified guardian, an accepted
    // invite produces a PENDING link that guardian must confirm. The answer
    // reports what the database actually holds, never an assumed "linked".
    const status = await getLinkStatus(parent.id, result.kidUserId);
    if (status === UNAVAILABLE || status === null || (status !== 'pending' && status !== 'verified')) {
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not confirm the invite state');
    }
    return ok(res, { linked: status === 'verified', status, kidUserId: result.kidUserId });
  });

  /*
   * GUARDIAN-LINK LIFECYCLE (D.5 / OD-21). Every verified guardian of a child
   * sees the child's Tutors in every state, confirms or rejects a pending
   * second Tutor, and may step away while another verified Tutor remains.
   * The database functions re-check each actor; these routes only add the
   * family guard. Adults are shown by display name only.
   */
  router.get('/kids/:kidId/guardians', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const me = authedUser(res).id;
    const links = await listLinksForKid(kidId);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Tutors');
    const names = await getDisplayNames(links.map((l) => l.parent_user_id));
    if (names === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Tutors');
    return ok(res, {
      guardians: links.map((l) => ({
        linkId: l.id,
        displayName: names.get(l.parent_user_id) ?? null,
        status: l.verification_status,
        isMe: l.parent_user_id === me,
        since: l.verified_at ?? l.created_at,
        decidedAt: l.decided_at,
        revokedAt: l.revoked_at,
      })),
    });
  });

  const LinkDecision = z.object({ decision: z.enum(['confirm', 'reject']) }).strict();
  const LINK_REFUSALS: Record<string, { status: number; message: string }> = {
    NOT_A_GUARDIAN: { status: 404, message: 'No such pending Tutor' },
    GUARDIAN_LINK_NOT_FOUND: { status: 404, message: 'No such pending Tutor' },
    GUARDIAN_LINK_NOT_PENDING: { status: 409, message: 'This Tutor was already decided' },
    LAST_GUARDIAN: { status: 409, message: 'A child always keeps at least one verified Tutor' },
  };

  router.post('/kids/:kidId/guardians/:linkId/decision', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const linkId = z.string().uuid().safeParse(req.params.linkId);
    const parsed = LinkDecision.safeParse(req.body);
    if (!linkId.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'decision must be confirm or reject');
    const links = await listLinksForKid(kidId);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Tutors');
    if (!links.some((l) => l.id === linkId.data)) return fail(res, 404, NOT_FOUND, 'No such pending Tutor');
    const result = await decideGuardianLink(linkId.data, authedUser(res).id, parsed.data.decision === 'confirm');
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    if (isRefusal(result)) {
      const mapped = LINK_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, 'CONFLICT', 'The decision was refused');
    }
    return ok(res, { linkId: linkId.data, status: result });
  });

  router.post('/kids/:kidId/guardians/leave', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const result = await revokeOwnGuardianLink(kidId, authedUser(res).id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not step away');
    if (isRefusal(result)) {
      const mapped = LINK_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, 'CONFLICT', 'Stepping away was refused');
    }
    return ok(res, { status: 'revoked' });
  });

  /** The caller's own pending/rejected/revoked links — what an invited or departed adult sees. */
  router.get('/guardian-links/mine', async (req, res) => {
    if (Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No filters are accepted');
    const links = await listOwnUnverifiedLinks(authedUser(res).id);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your Tutor requests');
    const names = await getDisplayNames(links.map((l) => l.kid_user_id));
    if (names === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your Tutor requests');
    // S07.2: a link from a teen's own invite waits for the teen, not a Tutor.
    const selfIssued = await selfIssuedInviteIds(links.flatMap((l) => (l.verification_status === 'pending' && l.invite_id ? [l.invite_id] : [])));
    if (selfIssued === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your Tutor requests');
    return ok(res, {
      links: links.map((l) => ({
        linkId: l.id,
        kidDisplayName: names.get(l.kid_user_id) ?? null,
        status: l.verification_status,
        awaiting: l.verification_status === 'pending' ? (l.invite_id && selfIssued.has(l.invite_id) ? 'account_holder' : 'tutor') : null,
        updatedAt: l.revoked_at ?? l.decided_at ?? l.created_at,
      })),
    });
  });

  router.delete('/kids/:kidId/badges/:token', async (req, res) => {    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const token = BadgeToken.safeParse(req.params.token);
    if (!token.success || Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'Check the badge link');

    const share = await getBadgeShareByToken(token.data);
    // A foreign kid's share is indistinguishable from a missing one (404),
    // so the shape of this response never confirms a row exists.
    if (!share || share.kid_user_id !== kidId) return fail(res, 404, NOT_FOUND, 'No such badge link');
    // Idempotent: revoking an already-revoked link is a success, not an error.
    if (share.revoked_at !== null) return ok(res, { revoked: true, token: token.data });

    const revoked = await revokeBadgeShare(token.data, kidId);
    if (!revoked) {
      // CAS miss: either a concurrent revoke won, or transport failed. Only
      // the re-read can tell them apart (§1.14) — and only "already revoked
      // by someone with access to this kid" is an idempotent success.
      const again = await getBadgeShareByToken(token.data);
      if (again !== null && again.kid_user_id === kidId && again.revoked_at !== null) {
        return ok(res, { revoked: true, token: token.data });
      }
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not revoke the badge link');
    }

    // The token is dead NOW; the image purge must not gate the response.
    // A transient Depot failure here is retried by the next revoke call
    // (idempotent) or by the public route's lazy purge on an inactive share.
    const imagePurged = await purgeBadgeImageIfUnreferenced(revoked);

    void insertAuditLog(authedUser(res).id, 'family.badge_revoked', kidId, { token: token.data, imagePurged });

    return ok(res, { revoked: true, token: token.data, imagePurged });
  });

  return router;
}
