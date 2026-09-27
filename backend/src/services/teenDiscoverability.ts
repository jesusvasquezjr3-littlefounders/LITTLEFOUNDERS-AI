import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * S-03 (owner decision OD-27 (2)): a 16- or 17-year-old may opt in to a
 * discoverable profile. Private stays the default for every teen; children and
 * 13-to-15-year-olds cannot opt in.
 *
 * The database decides (migration teen_discoverable_profile):
 * teen_discoverable_eligible is the teen social tier, age evidence that PROVES
 * 16 or more (a recorded birth month, S-04, or a profile birth date) and an
 * unflagged profile (E.13); teen_profile_discoverable is eligible AND opted in,
 * read at every visibility decision, so the choice lapses by itself when the
 * account stops being eligible. set_teen_profile_discoverable records the
 * choice with its audit row in one transaction; turning it off always works.
 *
 * Discoverable widens who sees the whole profile (socialVisibility's teen case,
 * and public.social_subject_visible for the browser). It changes nothing else:
 * a follow into the teen still needs the teen's consent (E.8), there is no
 * messaging (E.10), and a minor's learning stats stay hidden from others.
 */

const UUID = z.string().uuid();

/** Opted in and still eligible. Any failure reads as not discoverable (private is the safe default). */
export async function isTeenProfileDiscoverable(userId: string): Promise<boolean> {
  if (!UUID.safeParse(userId).success) return false;
  return await serviceRest<unknown>('/rpc/teen_profile_discoverable', {
    method: 'POST', body: JSON.stringify({ p_user: userId }),
  }) === true;
}

export interface TeenDiscoverability {
  /** May this account opt in right now (teen tier, proven 16+, unflagged)? */
  eligible: boolean;
  /** Is the profile discoverable right now (opted in AND eligible)? */
  enabled: boolean;
}

/** null: unreadable. */
export async function readTeenDiscoverability(userId: string): Promise<TeenDiscoverability | null> {
  if (!UUID.safeParse(userId).success) return null;
  const body = (fn: string) => serviceRest<unknown>(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify({ p_user: userId }) });
  const [eligible, enabled] = await Promise.all([body('teen_discoverable_eligible'), body('teen_profile_discoverable')]);
  if (typeof eligible !== 'boolean' || typeof enabled !== 'boolean') return null;
  return { eligible, enabled };
}

export type SetDiscoverableOutcome = 'saved' | 'not-eligible' | 'unavailable';

export async function setTeenProfileDiscoverable(userId: string, discoverable: boolean): Promise<SetDiscoverableOutcome> {
  if (!UUID.safeParse(userId).success) return 'unavailable';
  const result = await serviceRestRaw('/rpc/set_teen_profile_discoverable', {
    method: 'POST', body: JSON.stringify({ p_user: userId, p_discoverable: discoverable }),
  });
  if (result.ok) return result.body === discoverable ? 'saved' : 'unavailable';
  const message = z.object({ message: z.string() }).passthrough().safeParse(result.body);
  return message.success && message.data.message === 'DISCOVERABLE_NOT_ELIGIBLE' ? 'not-eligible' : 'unavailable';
}
