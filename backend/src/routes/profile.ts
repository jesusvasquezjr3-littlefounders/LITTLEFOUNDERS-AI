import { isSocialFamily, profileAccess, visibleSocialUsers, type ProfileAccess } from '../services/socialVisibility.js';
import { getRolesForGate } from '../services/insights.js';
import { reviewProfileFields, profileFieldFlags } from '../services/profileFieldSafety.js';
import { AvatarOptions, COVER_PRESETS, projectAvatarOptions, projectCover } from '../services/profileShape.js';
import {
  MINOR_SOCIAL_TIERS,
  decideTeenConnection,
  getPendingTeenRequests,
  hasPendingTeenRequest,
  readSocialTier,
  removeSocialFollower,
  requestTeenConnection,
  type SocialTier,
} from '../services/socialTier.js';
import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import {
  blockUser,
  deleteFollow,
  findProfileByUsername,
  getAvatarByUserId,
  getCompletedCourseBadgesByUserId,
  getFullOwnProfile,
  hasCurrentSocialApproval,
  getLearningStats,
  getLearningStatsByUserId,
  getOwnAvatar,
  hasOwnBlock,
  hasOwnOpenSocialRequest,
  getSocialCards,
  insertFollow,
  requestSocialConnection,
  isBlockedEitherWay,
  isFollowing,
  listBlocked,
  listFollowers,
  listFollowing,
  patchOwnProfile,
  submitSocialReport,
  SOCIAL_REPORT_CATEGORIES,
  SOCIAL_REPORT_NOTE_MAX,
  unblockUser,
  upsertOwnAvatar,
  tutorBadgeVisible,
  hasRole,
  type FullProfileRow,
  type LearningStatsRow,
} from '../services/supabaseRest.js';

/*
 * Profile identity (Jesús, 2026-07-12):
 *  - Covers are token-gradient PRESETS only — the API accepts a preset id,
 *    never binary data. No image upload path exists (NON-NEGOTIABLE).
 *  - Avatars are DiceBear Avataaars OPTION SETS (validated jsonb), rendered
 *    client-side — again: no images.
 *  - Public profiles (avatar/cover/name/@username) require a session and are
 *    served exclusively here with whitelisted fields; table RLS stays tight.
 *
 * Extended 2026-07-12: birth date (personal data, any user — distinct from
 * Guardian's verified adult birth_date), real learning stats (xp/minutes/
 * lessons/streak — zeroed until the lesson engine exists, never faked), and
 * the social graph's second edge: blocking. A block removes any existing
 * follow in either direction and hides both profiles from each other
 * (mutual 404 — never leaks WHO blocked whom).
 */

// E.12: the cover preset list and the avatar option set live in
// services/profileShape.ts, next to the read-side projection.
export { COVER_PRESETS } from '../services/profileShape.js';

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const ProfilePatchBody = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_RE, 'Username must be 3-20 chars: a-z, 0-9, _')
      .optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

const CoverRequest = z.object({ preset: z.enum(COVER_PRESETS) });

/*
 * Avatar options: a bounded DiceBear Avataaars option set (profileShape.ts).
 * Closed key set, small string-array/number values: anything else is
 * rejected at the edge, and the database refuses it from every other writer.
 */
const AvatarBody = z.object({ options: AvatarOptions });


function publicShape(profile: FullProfileRow, avatarOptions: unknown) {
  return {
    displayName: profile.display_name,
    username: profile.username,
    cover: projectCover(profile.cover),
    avatarOptions: projectAvatarOptions(avatarOptions),
    memberSince: profile.created_at,
  };
}

/*
 * E.9: no follower or following COUNT leaves Core, on any profile surface.
 * The lists themselves stay (people can still see who they are connected
 * to); the number that invites comparison with others does not exist on the
 * wire, so no screen can put it next to XP, streaks or badges.
 *
 * E.13: a minor's activity date is a pattern-of-life signal that locates the
 * child in time; it is withheld from every viewer but the child.
 */
function statsShape(s: LearningStatsRow, withActivityDate = true) {
  return { xpPoints: s.xp_points, minutesLearned: s.minutes_learned, lessonsCompleted: s.lessons_completed, streakDays: s.streak_days, lastActiveDate: withActivityDate ? s.last_active_date ?? null : null };
}

function courseBadgesShape(rows: Awaited<ReturnType<typeof getCompletedCourseBadgesByUserId>>) {
  return rows.map((row) => ({
    slug: row.course_slug,
    title: row.course_title,
    badgeAsset: row.badge_asset,
    completedAt: row.completed_at,
  }));
}

/*
 * How the viewer may connect to the subject (E.1 + E.8), decided by tier:
 *   follow           an open follow (the subject is an adult and the viewer
 *                    may make its own connections)
 *   guardianRequest  a request the subject's guardian decides (child)
 *   teenRequest      a request the teen decides (independent teen)
 *   managed          the viewer is a child: its Tutor manages its connections
 *   none             self, or the viewer has no social layer
 */
type ConnectionMode = 'follow' | 'guardianRequest' | 'teenRequest' | 'managed' | 'none';

async function connectionMode(viewerId: string, subjectId: string, viewerTier: SocialTier, subjectTier: SocialTier): Promise<ConnectionMode | null> {
  if (viewerId === subjectId || viewerTier === 'closed' || subjectTier === 'closed') return 'none';
  if (subjectTier === 'guardian') return 'guardianRequest';
  if (viewerTier === 'guardian') {
    if (subjectTier === 'teen') return 'managed';
    const family = await isSocialFamily(subjectId, viewerId);
    if (family === null) return null;
    return family || await hasCurrentSocialApproval(subjectId, viewerId) ? 'follow' : 'managed';
  }
  return subjectTier === 'teen' ? 'teenRequest' : 'follow';
}

/**
 * OD-6, E.5: the Tutor pill for this viewer. Only an account that holds the
 * parent role and is a currently ID-verified parent is a Tutor, and the
 * relationship rule of `tutorBadgeVisible` decides who else sees it. The
 * people lists apply the same role gate (socialVisibility).
 */
async function tutorVerdict(viewerId: string, subjectId: string): Promise<boolean> {
  if (!(await hasRole(subjectId, 'parent'))) return false;
  return tutorBadgeVisible(viewerId, subjectId);
}

/** The fields a minor may not set to something that locates them off-platform (E.13). */
function unsafeFields(fields: { username?: string; displayName?: string }): ('username' | 'displayName')[] {
  const out: ('username' | 'displayName')[] = [];
  if (fields.username !== undefined && profileFieldFlags(fields.username).length > 0) out.push('username');
  if (fields.displayName !== undefined && profileFieldFlags(fields.displayName).length > 0) out.push('displayName');
  return out;
}

/** /api/v1/profile — the signed-in user's own profile + social lists. */
export function ownProfileRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    const [profiles, avatars, stats, completedBadges, tier, tutor] = await Promise.all([
      getFullOwnProfile(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
      getLearningStats(user.accessToken, user.id),
      getCompletedCourseBadgesByUserId(user.id),
      readSocialTier(user.id),
      tutorVerdict(user.id, user.id),
    ]);
    if (!profiles?.[0]) return fail(res, 502, 'INTERNAL', 'Profile unreachable');
    const minor = tier === null || MINOR_SOCIAL_TIERS.includes(tier);
    return ok(res, {
      ...publicShape(profiles[0], avatars?.[0]?.options ?? {}),
      email: user.email,
      locale: profiles[0].locale,
      theme: profiles[0].theme,
      birthDate: profiles[0].birth_date,
      learningStats: statsShape(stats),
      courseBadges: courseBadgesShape(completedBadges),
      // OD-6, E.5: the owner's own Tutor verdict (a currently ID-verified
      // parent), the same one other people's views are bound to.
      isTutor: tutor,
      // E.8: the account's own social tier, so the owner sees why their
      // profile is private and where their requests are. Unreadable = null.
      social: { tier, privateProfile: tier !== 'adult' },
      // E.13: the owner (a minor) learns which field hides their profile.
      profileReview: minor
        ? reviewProfileFields({ username: profiles[0].username, displayName: profiles[0].display_name })
        : { flagged: false, fields: [] },
    });
  });

  router.patch('/', async (req, res) => {
    const parsed = ProfilePatchBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    // A.6: the kid-role Settings screen must not silently edit the profile
    // username — the sign-in identifier derives from it (kidEmail), so an
    // unsupervised change strands the account behind its old handle. Kid
    // accounts keep display name and locale; the username is fixed.
    if (parsed.data.username !== undefined) {
      const roles = await getRolesForGate(user.id);
      if (roles === null) return fail(res, 502, 'INTERNAL', 'Could not verify account roles');
      if (roles.includes('kid')) return fail(res, 403, 'KID_USERNAME_LOCKED', 'A child account cannot change its username');
    }
    // E.13: a minor's name and handle are reviewed before the write; the
    // database refuses the same values from any writer (profile_fields_guard).
    if (parsed.data.username !== undefined || parsed.data.displayName !== undefined) {
      const tier = await readSocialTier(user.id);
      if (tier === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check the account tier');
      if (MINOR_SOCIAL_TIERS.includes(tier)) {
        const fields = unsafeFields({ username: parsed.data.username, displayName: parsed.data.displayName });
        if (fields.length > 0) return fail(res, 422, 'PROFILE_FIELD_UNSAFE', 'That name could help someone find you outside LittleFounders', { fields });
      }
    }
    const patch: Record<string, string> = {};
    if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName;
    if (parsed.data.username !== undefined) patch.username = parsed.data.username;
    if (parsed.data.locale !== undefined) patch.locale = parsed.data.locale;

    const outcome = await patchOwnProfile(user.accessToken, user.id, patch);
    if (outcome === 'conflict') return fail(res, 409, 'USERNAME_TAKEN', 'That @username is already in use');
    if (outcome === 'error') return fail(res, 502, 'INTERNAL', 'Could not update the profile');
    return ok(res, { updated: true });
  });

  router.put('/cover', async (req, res) => {
    const parsed = CoverRequest.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Unknown cover preset');
    const user = authedUser(res);
    const outcome = await patchOwnProfile(user.accessToken, user.id, { cover: { preset: parsed.data.preset } });
    if (outcome !== 'ok') return fail(res, 502, 'INTERNAL', 'Could not update the cover');
    return ok(res, { updated: true, cover: { preset: parsed.data.preset } });
  });

  router.put('/avatar', async (req, res) => {
    const parsed = AvatarBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid avatar options');
    }
    const user = authedUser(res);
    const saved = await upsertOwnAvatar(user.accessToken, user.id, parsed.data.options);
    if (!saved) return fail(res, 502, 'INTERNAL', 'Could not save the avatar');
    return ok(res, { updated: true });
  });

  router.get('/followers', async (_req, res) => {
    const users = await listFollowers(authedUser(res).id);
    return ok(res, { users: await visibleSocialUsers(authedUser(res).id, users) });
  });

  router.get('/following', async (_req, res) => {
    const users = await listFollowing(authedUser(res).id);
    return ok(res, { users: await visibleSocialUsers(authedUser(res).id, users) });
  });

  router.get('/blocked', async (_req, res) => {
    const users = await listBlocked(authedUser(res).id);
    return ok(res, { users: await visibleSocialUsers(authedUser(res).id, users) });
  });

  /*
   * E.8: the independent teen's own connection requests. The subject is
   * always the session; nobody else can read or decide this queue, and no
   * guardian is asked (OD-3: none exists in this flow).
   */
  router.get('/connection-requests', async (req, res) => {
    const query = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid request page');
    const user = authedUser(res);
    const page = await getPendingTeenRequests(user.id, query.data.offset);
    if (!page) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load connection requests');
    const cards = await getSocialCards(page.requests.map((request) => request.requesterId));
    if (!cards) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load who asked');
    const byId = new Map(cards.map((card) => [card.userId, card]));
    return ok(res, {
      requests: page.requests.map((request) => {
        const card = byId.get(request.requesterId);
        return {
          requestId: request.requestId,
          requestedAt: request.requestedAt,
          requester: card ? { username: card.username, displayName: card.displayName, avatarOptions: card.avatarOptions } : null,
        };
      }),
      nextOffset: page.nextOffset,
    });
  });

  router.post('/connection-requests/:requestId/decision', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.requestId);
    const body = z.object({ decision: z.enum(['accept', 'decline']) }).strict().safeParse(req.body);
    if (!id.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose accept or decline');
    if (Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No query fields are accepted');
    const result = await decideTeenConnection(id.data, authedUser(res).id, body.data.decision === 'accept');
    if (result === 'not-found') return fail(res, 404, 'NOT_FOUND', 'No such connection request');
    if (result === 'conflict') return fail(res, 409, 'SOCIAL_DECISION_CONFLICT', 'This request can no longer take that decision');
    if (result === 'review') return fail(res, 403, 'PROFILE_REVIEW_REQUIRED', 'Change your name before you connect');
    if (result === 'unavailable') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not confirm the decision');
    return ok(res, { requestId: id.data, status: result });
  });

  /** E.8: the followed account removes a follower (the teen manages its own connections). */
  router.delete('/followers/:username', async (req, res) => {
    const user = authedUser(res);
    const username = req.params.username.toLowerCase();
    if (!USERNAME_RE.test(username)) return fail(res, 404, 'NOT_FOUND', 'No such follower');
    const rows = await findProfileByUsername(username);
    const follower = rows?.[0];
    if (!follower || follower.user_id === user.id || !await isFollowing(follower.user_id, user.id)) return fail(res, 404, 'NOT_FOUND', 'No such follower');
    const removed = await removeSocialFollower(user.id, follower.user_id);
    if (removed === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not remove this follower');
    if (!removed) return fail(res, 404, 'NOT_FOUND', 'No such follower');
    return ok(res, { removed: true });
  });

  return router;
}

/** /api/v1/profiles/:username — public profiles (session required). */
export function publicProfilesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  async function resolve(username: string): Promise<FullProfileRow | null> {
    if (!USERNAME_RE.test(username)) return null;
    const rows = await findProfileByUsername(username);
    return rows?.[0] ?? null;
  }

  interface Resolved { profile: FullProfileRow; access: Exclude<ProfileAccess, 'none'>; viewerTier: SocialTier; subjectTier: SocialTier }

  /**
   * Profile lookup with the E.1/E.8/E.13 access verdict. NOT_FOUND for "doesn't
   * exist", "blocked" and "not visible" alike — never leaks which. A private
   * teen resolves to 'card'; callers that need the whole profile require 'full'.
   */
  async function resolveAccess(username: string, viewerId: string): Promise<Resolved | null> {
    const profile = await resolve(username);
    if (!profile) return null;
    if (profile.user_id !== viewerId && (await isBlockedEitherWay(viewerId, profile.user_id))) return null;
    const [viewerTier, subjectTier] = await Promise.all([readSocialTier(viewerId), readSocialTier(profile.user_id)]);
    if (viewerTier === null || subjectTier === null) return null;
    const access = await profileAccess(viewerId, profile.user_id,
      { username: profile.username, displayName: profile.display_name }, { viewer: viewerTier, subject: subjectTier });
    return access === 'none' ? null : { profile, access, viewerTier, subjectTier };
  }

  async function resolveVisible(username: string, viewerId: string): Promise<FullProfileRow | null> {
    const resolved = await resolveAccess(username, viewerId);
    return resolved?.access === 'full' ? resolved.profile : null;
  }

  router.get('/:username', async (req, res) => {
    const user = authedUser(res);
    const resolved = await resolveAccess(req.params.username.toLowerCase(), user.id);
    if (!resolved) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const { profile, access, viewerTier, subjectTier } = resolved;
    const [avatars, connection] = await Promise.all([
      getAvatarByUserId(profile.user_id),
      connectionMode(user.id, profile.user_id, viewerTier, subjectTier),
    ]);
    if (connection === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check connection eligibility');
    const avatarOptions = avatars?.[0]?.options ?? {};
    if (access === 'card') {
      // E.8 private-by-default teen: who they are is not shown until they accept.
      const requestPending = await hasPendingTeenRequest(user.id, profile.user_id);
      if (requestPending === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check the request');
      return ok(res, {
        visibility: 'private',
        username: profile.username,
        cover: projectCover(profile.cover),
        avatarOptions: projectAvatarOptions(avatarOptions),
        isSelf: false,
        isFollowing: false,
        requiresGuardianApproval: false,
        connection,
        requestPending,
      });
    }
    const [following, tutor, stats, completedBadges] = await Promise.all([
      isFollowing(user.id, profile.user_id),
      // E.5: the badge is a verified-adult signal shown only inside an
      // established relationship (linked kid, mutual approved follow, self,
      // staff) — never to an unconnected kid-role viewer.
      tutorVerdict(user.id, profile.user_id),
      getLearningStatsByUserId(profile.user_id),
      getCompletedCourseBadgesByUserId(profile.user_id),
    ]);
    const isSelf = profile.user_id === user.id;
    return ok(res, {
      visibility: 'full',
      ...publicShape(profile, avatarOptions),
      isFollowing: following,
      requiresGuardianApproval: subjectTier === 'guardian',
      connection,
      isSelf,
      isTutor: tutor,
      learningStats: statsShape(stats, isSelf || !MINOR_SOCIAL_TIERS.includes(subjectTier)),
      courseBadges: courseBadgesShape(completedBadges),
    });
  });

  router.get('/:username/followers', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    return ok(res, { users: await visibleSocialUsers(user.id, await listFollowers(profile.user_id)) });
  });

  router.get('/:username/following', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    return ok(res, { users: await visibleSocialUsers(user.id, await listFollowing(profile.user_id)) });
  });

  router.post('/:username/connection-request', async (req, res) => {
    const user = authedUser(res);
    if (!z.object({}).strict().safeParse(req.body ?? {}).success) return fail(res, 400, 'VALIDATION_ERROR', 'No request identity fields are accepted');
    const resolved = await resolveAccess(req.params.username.toLowerCase(), user.id);
    if (!resolved) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const { profile, access, viewerTier, subjectTier } = resolved;
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot request yourself');
    if (subjectTier === 'guardian') {
      // E.1: only an already-visible relationship may ask a child's guardian.
      if (access !== 'full') return fail(res, 404, 'NOT_FOUND', 'No such profile');
      const requestId = await requestSocialConnection(user.id, profile.user_id);
      if (!requestId) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the connection request');
      return res.status(202).json({ data: { requestId, status: 'pending', following: false, decidedBy: 'guardian' }, error: null });
    }
    if (subjectTier !== 'teen') return fail(res, 400, 'VALIDATION_ERROR', 'This connection does not use approval');
    // E.8: the teen decides. A child cannot ask (its Tutor manages its connections).
    if (viewerTier === 'guardian') return fail(res, 403, 'GUARDIAN_MANAGED_CONNECTIONS', 'A Tutor manages this account\'s connections');
    const outcome = await requestTeenConnection(user.id, profile.user_id);
    switch (outcome.status) {
      case 'pending':
        return res.status(202).json({ data: { requestId: outcome.requestId, status: 'pending', following: false, decidedBy: 'subject' }, error: null });
      case 'cooldown': return fail(res, 409, 'SOCIAL_REQUEST_COOLDOWN', 'You can ask again later');
      case 'limit': return fail(res, 429, 'SOCIAL_REQUEST_LIMIT', 'Too many requests are waiting');
      case 'connected': return fail(res, 409, 'SOCIAL_ALREADY_CONNECTED', 'You are already connected');
      case 'review': return fail(res, 403, 'PROFILE_REVIEW_REQUIRED', 'Change your name before you connect');
      case 'managed': return fail(res, 403, 'GUARDIAN_MANAGED_CONNECTIONS', 'A Tutor manages this account\'s connections');
      case 'unavailable': return fail(res, 404, 'NOT_FOUND', 'No such profile');
      default: return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the connection request');
    }
  });

  router.post('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const resolved = await resolveAccess(req.params.username.toLowerCase(), user.id);
    if (!resolved) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const { profile, viewerTier, subjectTier } = resolved;
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot follow yourself');
    if (subjectTier === 'guardian') return fail(res, 403, 'GUARDIAN_APPROVAL_REQUIRED', 'A guardian must approve this connection');
    if (subjectTier === 'teen') return fail(res, 403, 'SUBJECT_CONSENT_REQUIRED', 'This account decides who connects');
    const mode = await connectionMode(user.id, profile.user_id, viewerTier, subjectTier);
    if (mode === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check connection eligibility');
    if (mode === 'managed') return fail(res, 403, 'GUARDIAN_MANAGED_CONNECTIONS', 'A Tutor manages this account\'s connections');
    if (mode !== 'follow') return fail(res, 403, 'SOCIAL_UNAVAILABLE', 'Connections are not available for this account');
    if (MINOR_SOCIAL_TIERS.includes(viewerTier)) {
      const own = await getFullOwnProfile(user.accessToken, user.id);
      if (!own?.[0]) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check your profile');
      if (reviewProfileFields({ username: own[0].username, displayName: own[0].display_name }).flagged) {
        const family = await isSocialFamily(profile.user_id, user.id);
        if (!family) return fail(res, 403, 'PROFILE_REVIEW_REQUIRED', 'Change your name before you connect');
      }
    }
    const done = await insertFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not follow');
    return ok(res, { following: true });
  });

  router.delete('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile || !(await isFollowing(user.id, profile.user_id)
      || await hasOwnOpenSocialRequest(user.id, profile.user_id)
      || await hasPendingTeenRequest(user.id, profile.user_id) === true)) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const done = await deleteFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not unfollow');
    return ok(res, { following: false });
  });

  // A block owner may manage their own existing block even when it hides a profile.
  router.post('/:username/block', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot block yourself');
    const ownsBlock = await hasOwnBlock(user.accessToken, user.id, profile.user_id);
    // A private teen's card is enough to block it: protection never needs more access.
    if (!ownsBlock && !await resolveAccess(req.params.username.toLowerCase(), user.id)) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const done = await blockUser(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not block this account');
    return ok(res, { blocked: true });
  });

  router.delete('/:username/block', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile || !await hasOwnBlock(user.accessToken, user.id, profile.user_id)) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const done = await unblockUser(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not unblock this account');
    return ok(res, { blocked: false });
  });

  // E.3: report a profile. Bounded, child-safe input: a predefined category
  // and an optional short note. The target must be a profile the caller can
  // currently reach (the same non-discovery boundary as block; a private
  // teen's card counts), and the session user is always the reporter.
  const ReportBody = z.object({
    category: z.enum(SOCIAL_REPORT_CATEGORIES),
    note: z.string().trim().min(1).max(SOCIAL_REPORT_NOTE_MAX).optional(),
  }).strict();

  router.post('/:username/report', async (req, res) => {
    const user = authedUser(res);
    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a report reason');
    const resolved = await resolveAccess(req.params.username.toLowerCase(), user.id);
    if (!resolved) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const { profile } = resolved;
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot report yourself');
    const result = await submitSocialReport(user.id, profile.user_id, parsed.data.category, parsed.data.note ?? null);
    if (result === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'This report cannot be recorded');
    if (result === 'unavailable') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the report');
    return ok(res, { reported: true, reportId: result.id }, 201);
  });

  return router;
}
