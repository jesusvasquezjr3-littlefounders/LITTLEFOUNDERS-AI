import { z } from 'zod';
import { getVerifiedGuardiansOfKid, hasCurrentSocialApproval, isFollowing, serviceRest, tutorBadgeVisible, type ListedUser } from './supabaseRest.js';
import { reviewProfileFields } from './profileFieldSafety.js';
import { hasCurrentTeenConsent, readSocialTier, type SocialTier } from './socialTier.js';
import { isTeenProfileDiscoverable } from './teenDiscoverability.js';

/*
 * Who may see whom (E.1, E.8, E.13). Mirrors public.social_subject_visible
 * (migration social_tier_enforcement), which enforces the same rule for any
 * browser read of the follow graph.
 *
 *   full  the whole public profile, and the account appears in lists
 *   card  only a private card (username, cartoon avatar, cover preset) and a
 *         way to ask the teen to connect: E.8's private-by-default teen
 *   none  404, indistinguishable from "no such account"
 *
 * By the subject's tier:
 *   adult     full for any viewer with a social layer
 *   guardian  full for the linked family; for an outsider only through a
 *             current guardian approval, and never while the child's name or
 *             handle is flagged by the E.13 review
 *   teen      full for the teen's verified guardian (if one exists), for an
 *             account the teen accepted, and for an account the teen chose to
 *             follow; card for everyone else; none while flagged
 *   closed    none
 * A closed viewer (guest, unscreened) sees nobody but itself. Any unreadable
 * input is "none".
 */

export type ProfileAccess = 'full' | 'card' | 'none';
export interface SocialFields { username: string | null; displayName: string | null }

const UUID = z.string().uuid();
const Guardians = z.array(UUID);

async function readSocialFields(userId: string): Promise<SocialFields | null> {
  const rows = z.array(z.object({ username: z.string().nullable(), display_name: z.string().nullable() })).length(1).safeParse(
    await serviceRest<unknown>(`/profiles?user_id=eq.${encodeURIComponent(userId)}&select=username,display_name&limit=1`),
  );
  return rows.success ? { username: rows.data[0]!.username, displayName: rows.data[0]!.display_name } : null;
}

/** E.13: a minor's flagged name or handle stays inside the family. An unreadable profile counts as flagged. */
async function isFlagged(userId: string, fields?: SocialFields): Promise<boolean> {
  const current = fields ?? await readSocialFields(userId);
  return current === null || reviewProfileFields(current).flagged;
}

async function inFamily(viewerId: string, subjectId: string): Promise<boolean | null> {
  const guardians = await getVerifiedGuardiansOfKid(subjectId);
  if (!Guardians.safeParse(guardians).success) return null;
  if (guardians!.includes(viewerId)) return true;
  if (guardians!.length === 0) return false;
  const viewerGuardians = await getVerifiedGuardiansOfKid(viewerId);
  if (!Guardians.safeParse(viewerGuardians).success) return null;
  return viewerGuardians!.some((id) => guardians!.includes(id));
}

export async function profileAccess(viewerId: string, subjectId: string, fields?: SocialFields, tiers?: { viewer: SocialTier | null; subject: SocialTier | null }): Promise<ProfileAccess> {
  if (!UUID.safeParse(viewerId).success || !UUID.safeParse(subjectId).success) return 'none';
  if (viewerId === subjectId) return 'full';
  const [viewerTier, subjectTier] = tiers
    ? [tiers.viewer, tiers.subject]
    : await Promise.all([readSocialTier(viewerId), readSocialTier(subjectId)]);
  if (viewerTier === null || subjectTier === null || viewerTier === 'closed') return 'none';
  switch (subjectTier) {
    case 'adult':
      return 'full';
    case 'guardian': {
      const family = await inFamily(viewerId, subjectId);
      if (family === null) return 'none';
      if (family) return 'full';
      if (await isFlagged(subjectId, fields)) return 'none';
      return await hasCurrentSocialApproval(viewerId, subjectId) ? 'full' : 'none';
    }
    case 'teen': {
      const guardians = await getVerifiedGuardiansOfKid(subjectId);
      if (!Guardians.safeParse(guardians).success) return 'none';
      if (guardians!.includes(viewerId)) return 'full';
      if (await isFlagged(subjectId, fields)) return 'none';
      if (await hasCurrentTeenConsent(viewerId, subjectId)) return 'full';
      if (await isFollowing(subjectId, viewerId)) return 'full';
      // S-03 (OD-27): a 16- or 17-year-old who opted in, and is still eligible,
      // is discoverable. The database re-checks eligibility on every read.
      if (await isTeenProfileDiscoverable(subjectId)) return 'full';
      return 'card';
    }
    default:
      return 'none';
  }
}

/** The whole profile, and presence in lists. */
export async function mayDiscoverProfile(viewerId: string, subjectId: string, fields?: SocialFields): Promise<boolean> {
  return await profileAccess(viewerId, subjectId, fields) === 'full';
}

/**
 * Filters a list to the accounts this viewer may see in full, and applies
 * E.5 to each card: the list used to carry the bare parent role as a Tutor
 * badge, which is exactly the platform-wide trust signal E.5 removed from the
 * profile itself.
 */
export async function visibleSocialUsers(viewerId: string, users: ListedUser[]): Promise<ListedUser[]> {
  const checked = await Promise.all(users.map(async (user) => {
    if (!await mayDiscoverProfile(viewerId, user.userId, { username: user.username, displayName: user.displayName })) return null;
    const isTutor = user.isTutor ? await tutorBadgeVisible(viewerId, user.userId) : false;
    return { ...user, isTutor };
  }));
  return checked.filter((user): user is ListedUser => user !== null);
}

/** Whether the viewer is in the subject's linked family (guardian or shared guardian). null: unreadable. */
export { inFamily as isSocialFamily };
