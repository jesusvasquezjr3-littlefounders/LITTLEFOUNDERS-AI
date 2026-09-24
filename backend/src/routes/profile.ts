import { mayDiscoverProfile, visibleSocialUsers } from '../services/socialVisibility.js';
import { getRolesForGate } from '../services/insights.js';
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
  getFollowCounts,
  getFullOwnProfile,
  getLearningStats,
  getLearningStatsByUserId,
  getOwnAvatar,
  hasRole,
  hasOwnBlock,
  hasOwnOpenSocialRequest,
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

export const COVER_PRESETS = [
  'aurora',
  'sunset',
  'ocean',
  'forest',
  'candy',
  'ember',
  'midnight',
  'mint',
  'grape',
  'dawn',
] as const;

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

const CoverBody = z.object({ preset: z.enum(COVER_PRESETS) });

/*
 * Avatar options: a bounded DiceBear Avataaars option set. Closed key set,
 * small string-array/number values — anything else is rejected at the edge.
 */
const OPTION_VALUE = z.array(z.string().regex(/^[A-Za-z0-9]{1,40}$/)).max(3);
const AvatarBody = z.object({
  options: z
    .object({
      seed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
      top: OPTION_VALUE.optional(),
      hairColor: OPTION_VALUE.optional(),
      skinColor: OPTION_VALUE.optional(),
      eyes: OPTION_VALUE.optional(),
      eyebrows: OPTION_VALUE.optional(),
      mouth: OPTION_VALUE.optional(),
      facialHair: OPTION_VALUE.optional(),
      facialHairProbability: z.number().int().min(0).max(100).optional(),
      clothing: OPTION_VALUE.optional(),
      clothesColor: OPTION_VALUE.optional(),
      accessories: OPTION_VALUE.optional(),
      accessoriesProbability: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
});

function publicShape(profile: FullProfileRow, avatarOptions: Record<string, unknown>) {
  return {
    displayName: profile.display_name,
    username: profile.username,
    cover: profile.cover,
    avatarOptions,
    memberSince: profile.created_at,
  };
}

function statsShape(s: LearningStatsRow) {
  return { xpPoints: s.xp_points, minutesLearned: s.minutes_learned, lessonsCompleted: s.lessons_completed, streakDays: s.streak_days, lastActiveDate: s.last_active_date ?? null };
}

function courseBadgesShape(rows: Awaited<ReturnType<typeof getCompletedCourseBadgesByUserId>>) {
  return rows.map((row) => ({
    slug: row.course_slug,
    title: row.course_title,
    badgeAsset: row.badge_asset,
    completedAt: row.completed_at,
  }));
}

/** /api/v1/profile — the signed-in user's own profile + social lists. */
export function ownProfileRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    const [profiles, avatars, counts, stats, completedBadges] = await Promise.all([
      getFullOwnProfile(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
      getFollowCounts(user.id),
      getLearningStats(user.accessToken, user.id),
      getCompletedCourseBadgesByUserId(user.id),
    ]);
    if (!profiles?.[0]) return fail(res, 502, 'INTERNAL', 'Profile unreachable');
    return ok(res, {
      ...publicShape(profiles[0], avatars?.[0]?.options ?? {}),
      email: user.email,
      locale: profiles[0].locale,
      theme: profiles[0].theme,
      birthDate: profiles[0].birth_date,
      followers: counts.followers,
      following: counts.following,
      learningStats: statsShape(stats),
      courseBadges: courseBadgesShape(completedBadges),
    });
  });

  router.patch('/', async (req, res) => {
    const parsed = ProfilePatchBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
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
    const parsed = CoverBody.safeParse(req.body);
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

  /** Visible profile lookup: NOT_FOUND for both "doesn't exist" and "blocked" — never leaks which. */
  async function resolveVisible(username: string, viewerId: string): Promise<FullProfileRow | null> {
    const profile = await resolve(username);
    if (!profile || !await mayDiscoverProfile(viewerId, profile.user_id)) return null;
    if (profile.user_id !== viewerId && (await isBlockedEitherWay(viewerId, profile.user_id))) return null;
    return profile;
  }

  router.get('/:username', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const [avatars, counts, following, tutor, stats, completedBadges] = await Promise.all([
      getAvatarByUserId(profile.user_id),
      getFollowCounts(profile.user_id),
      isFollowing(user.id, profile.user_id),
      hasRole(profile.user_id, 'parent'),
      getLearningStatsByUserId(profile.user_id),
      getCompletedCourseBadgesByUserId(profile.user_id),
    ]);
    return ok(res, {
      ...publicShape(profile, avatars?.[0]?.options ?? {}),
      followers: counts.followers,
      following: counts.following,
      isFollowing: following,
      requiresGuardianApproval: (await getRolesForGate(profile.user_id))?.includes('kid') ?? true,
      isSelf: profile.user_id === user.id,
      isTutor: tutor,
      learningStats: statsShape(stats),
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
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot request yourself');
    const roles = await getRolesForGate(profile.user_id);
    if (!roles?.includes('kid')) return fail(res, 400, 'VALIDATION_ERROR', 'This connection does not use guardian approval');
    const requestId = await requestSocialConnection(user.id, profile.user_id);
    if (!requestId) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the connection request');
    return res.status(202).json({ data: { requestId, status: 'pending', following: false }, error: null });
  });

  router.post('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot follow yourself');
    const targetRoles = await getRolesForGate(profile.user_id);
    if (!targetRoles?.length) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check connection eligibility');
    if (targetRoles.includes('kid')) return fail(res, 403, 'GUARDIAN_APPROVAL_REQUIRED', 'A guardian must approve this connection');
    const done = await insertFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not follow');
    return ok(res, { following: true });
  });

  router.delete('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile || !(await isFollowing(user.id, profile.user_id) || await hasOwnOpenSocialRequest(user.id, profile.user_id))) return fail(res, 404, 'NOT_FOUND', 'No such profile');
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
    if (!ownsBlock && !await resolveVisible(req.params.username.toLowerCase(), user.id)) return fail(res, 404, 'NOT_FOUND', 'No such profile');
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
  // currently see (the same non-discovery boundary as block), and the session
  // user is always the reporter — the client cannot name a reporter.
  const ReportBody = z.object({
    category: z.enum(SOCIAL_REPORT_CATEGORIES),
    note: z.string().trim().min(1).max(SOCIAL_REPORT_NOTE_MAX).optional(),
  }).strict();

  router.post('/:username/report', async (req, res) => {
    const user = authedUser(res);
    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a report reason');
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot report yourself');
    const result = await submitSocialReport(user.id, profile.user_id, parsed.data.category, parsed.data.note ?? null);
    if (result === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'This report cannot be recorded');
    if (result === 'unavailable') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the report');
    return ok(res, { reported: true, reportId: result.id }, 201);
  });

  return router;
}
