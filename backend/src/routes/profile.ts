import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import {
  deleteFollow,
  findProfileByUsername,
  getAvatarByUserId,
  getFollowCounts,
  getFullOwnProfile,
  getOwnAvatar,
  hasRole,
  insertFollow,
  isFollowing,
  patchOwnProfile,
  upsertOwnAvatar,
  type FullProfileRow,
} from '../services/supabaseRest.js';

/*
 * Profile identity (Jesús, 2026-07-12):
 *  - Covers are token-gradient PRESETS only — the API accepts a preset id,
 *    never binary data. No image upload path exists (NON-NEGOTIABLE).
 *  - Avatars are DiceBear Avataaars OPTION SETS (validated jsonb), rendered
 *    client-side — again: no images.
 *  - Public profiles (avatar/cover/name/@username) require a session and are
 *    served exclusively here with whitelisted fields; table RLS stays tight.
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

/** /api/v1/profile — the signed-in user's own profile. */
export function ownProfileRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    const [profiles, avatars, counts] = await Promise.all([
      getFullOwnProfile(user.accessToken, user.id),
      getOwnAvatar(user.accessToken, user.id),
      getFollowCounts(user.id),
    ]);
    if (!profiles?.[0]) return fail(res, 502, 'INTERNAL', 'Profile unreachable');
    return ok(res, {
      ...publicShape(profiles[0], avatars?.[0]?.options ?? {}),
      email: user.email,
      locale: profiles[0].locale,
      theme: profiles[0].theme,
      followers: counts.followers,
      following: counts.following,
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

  router.get('/:username', async (req, res) => {
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const user = authedUser(res);
    const [avatars, counts, following, tutor] = await Promise.all([
      getAvatarByUserId(profile.user_id),
      getFollowCounts(profile.user_id),
      isFollowing(user.id, profile.user_id),
      hasRole(profile.user_id, 'parent'),
    ]);
    return ok(res, {
      ...publicShape(profile, avatars?.[0]?.options ?? {}),
      followers: counts.followers,
      following: counts.following,
      isFollowing: following,
      isSelf: profile.user_id === user.id,
      isTutor: tutor,
    });
  });

  router.post('/:username/follow', async (req, res) => {
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const user = authedUser(res);
    if (profile.user_id === user.id) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot follow yourself');
    const done = await insertFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not follow');
    return ok(res, { following: true });
  });

  router.delete('/:username/follow', async (req, res) => {
    const profile = await resolve(req.params.username.toLowerCase());
    if (!profile) return fail(res, 404, 'NOT_FOUND', 'No such profile');
    const user = authedUser(res);
    const done = await deleteFollow(user.accessToken, user.id, profile.user_id);
    if (!done) return fail(res, 502, 'INTERNAL', 'Could not unfollow');
    return ok(res, { following: false });
  });

  return router;
}
