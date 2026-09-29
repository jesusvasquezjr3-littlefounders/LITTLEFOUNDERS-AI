import { z } from 'zod';
import { readDataPracticeApplies } from './dataPractices.js';
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
 *
 * OD-9 section 4.2 (GAP-FIX-R3, migration discoverable_profile_data_practice):
 * being discoverable is the registered data practice
 * 'sharing.discoverable_profile', a sharing surface a verified Tutor answers
 * (never the teen alone). teen_discoverable_eligible requires it to apply, so
 * a migrated teen the OD-9 consent step marked is not offered the choice
 * until its Tutor consents, and an opt-in recorded before lapses by itself.
 * Core names that reason (DATA_PRACTICE_CONSENT_REQUIRED) so Settings can say
 * why; the database stays the one authority.
 */

/** The OD-9 4.2 data practice this surface is. */
export const DISCOVERABLE_PRACTICE = 'sharing.discoverable_profile';

const UUID = z.string().uuid();

/** Opted in and still eligible. Any failure reads as not discoverable (private is the safe default). */
export async function isTeenProfileDiscoverable(userId: string): Promise<boolean> {
  if (!UUID.safeParse(userId).success) return false;
  return await serviceRest<unknown>('/rpc/teen_profile_discoverable', {
    method: 'POST', body: JSON.stringify({ p_user: userId }),
  }) === true;
}

/** Why an otherwise eligible teen is not offered the choice. */
export type DiscoverableReason = 'DATA_PRACTICE_CONSENT_REQUIRED';

export interface TeenDiscoverability {
  /** May this account opt in right now (teen tier, proven 16+, unflagged, and the OD-9 practice applies)? */
  eligible: boolean;
  /** Is the profile discoverable right now (opted in AND eligible)? */
  enabled: boolean;
  /**
   * Set only when the account would be eligible but the practice does not
   * apply (a migrated teen without a Tutor's consent). Never set for anyone
   * the S-03 rule itself excludes, so a 13-to-15-year-old is not hinted at.
   */
  reason: DiscoverableReason | null;
}

/** null: unreadable. */
export async function readTeenDiscoverability(userId: string): Promise<TeenDiscoverability | null> {
  if (!UUID.safeParse(userId).success) return null;
  const body = (fn: string) => serviceRest<unknown>(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify({ p_user: userId }) });
  const [eligible, enabled] = await Promise.all([body('teen_discoverable_eligible'), body('teen_profile_discoverable')]);
  if (typeof eligible !== 'boolean' || typeof enabled !== 'boolean') return null;
  if (eligible) return { eligible, enabled, reason: null };
  // Not eligible: name the OD-9 reason only when it is the one thing missing.
  // An unreadable answer names nothing (the choice is simply not offered).
  const [base, applies] = await Promise.all([body('teen_discoverable_base_eligible'), readDataPracticeApplies(userId, DISCOVERABLE_PRACTICE)]);
  return { eligible, enabled, reason: base === true && applies === false ? 'DATA_PRACTICE_CONSENT_REQUIRED' : null };
}

export type SetDiscoverableOutcome = 'saved' | 'not-eligible' | 'consent-required' | 'unavailable';

export async function setTeenProfileDiscoverable(userId: string, discoverable: boolean): Promise<SetDiscoverableOutcome> {
  if (!UUID.safeParse(userId).success) return 'unavailable';
  const result = await serviceRestRaw('/rpc/set_teen_profile_discoverable', {
    method: 'POST', body: JSON.stringify({ p_user: userId, p_discoverable: discoverable }),
  });
  if (result.ok) return result.body === discoverable ? 'saved' : 'unavailable';
  const message = z.object({ message: z.string() }).passthrough().safeParse(result.body);
  if (!message.success) return 'unavailable';
  if (message.data.message === 'DISCOVERABLE_NOT_ELIGIBLE') return 'not-eligible';
  return message.data.message === 'DATA_PRACTICE_CONSENT_REQUIRED' ? 'consent-required' : 'unavailable';
}
