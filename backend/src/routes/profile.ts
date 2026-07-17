import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import {
  blockUser,
  deleteFollow,
  findProfileByUsername,
  getAvatarByUserId,
  getFollowCounts,
  getFullOwnProfile,
  getLearningStats,
  getLearningStatsByUserId,
  getOwnAvatar,
  hasRole,
  insertFollow,
  isBlockedEitherWay,
  isFollowing,
  listBlocked,
  listFollowers,
  listFollowing,
  patchOwnProfile,
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

function isValidPastDate(d: string): boolean {
  const t = Date.parse(d);
  return !Number.isNaN(t) && t <= Date.now() && Number(d.slice(0, 4)) >= 1900;
}

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
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
      .refine(isValidPastDate, 'Enter a valid birth date')
      .optional(),
  })
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

/** /api/v1/profile — the signed-in user's own profile + social lists. */
export function ownProfileRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    const [profiles, avatars, counts, stats] = await Promise.all([
      getFullOwnProfile(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
      getFollowCounts(user.id),
      getLearningStats(user.accessToken, user.id),
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
    if (parsed.data.birthDate !== undefined) patch.birth_date = parsed.data.birthDate;

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
    return ok(res, { users });
  });

  router.get('/following', async (_req, res) => {
    const users = await listFollowing(authedUser(res).id);
    return ok(res, { users });
  });

  router.get('/blocked', async (_req, res) => {
    const users = await listBlocked(authedUser(res).id);
    return ok(res, { users });
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
    if (!profile) return null;
    if (profile.user_id !== viewerId && (await isBlockedEitherWay(viewerId, profile.user_id))) return null;
    return profile;
  }

  router.get('/:username', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const [avatars, counts, following, tutor, stats] = await Promise.all([
      getAvatarByUserId(profile.user_id),
      getFollowCounts(profile.user_id),
      isFollowing(user.id, profile.user_id),
      hasRole(profile.user_id, 'parent'),
      getLearningStatsByUserId(profile.user_id),
    ]);
    return ok(res, {
      ...publicShape(profile, avatars?.[0]?.options ?? {}),
      followers: counts.followers,
      following: counts.following,
      isFollowing: following,
      isSelf: profile.user_id === user.id,
      isTutor: tutor,
      learningStats: statsShape(stats),
    });
  });

  router.get('/:username/followers', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    return ok(res, { users: await listFollowers(profile.user_id) });
  });

  router.get('/:username/following', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    return ok(res, { users: await listFollowing(profile.user_id) });
  });

  router.post('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolveVisible(req.params.username.toLowerCase(), user.id);
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot follow yourself');
    const done = await insertFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not follow');
    return ok(res, { following: true });
  });

  router.delete('/:username/follow', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const done = await deleteFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not unfollow');
    return ok(res, { following: false });
  });

  // Block/unblock intentionally use resolve() (not resolveVisible): you must
  // be able to unblock someone whose profile a block is currently hiding.
  router.post('/:username/block', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot block yourself');
    const done = await blockUser(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not block this account');
    return ok(res, { blocked: true });
  });

  router.delete('/:username/block', async (req, res) => {
    const user = authedUser(res);
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const done = await unblockUser(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not unblock this account');
    return ok(res, { blocked: false });
  });

  return router;
}
