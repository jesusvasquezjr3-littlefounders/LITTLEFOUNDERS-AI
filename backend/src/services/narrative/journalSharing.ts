import { z } from 'zod';
import { readAgeScreen, type AgeScreenState } from '../ageScreen.js';
import { getRolesForGate } from '../insights.js';
import { ageFromBirthDate } from '../learnerRegister.js';
import { serviceRest } from '../supabaseRest.js';

/*
 * OD-27 (3), owner review item L-13 (Product 10 B.9/B.10): who besides the
 * learner may read the decision journal.
 *
 *   * A parent-created child (the `kid` role, a verified Tutor made the
 *     account) who is under 13: the verified Tutor sees WHICH OPTION the child
 *     chose in each story decision, with the situation it answered. Nothing
 *     else of the journal (no first choice, no outcome, no resurfacing, no
 *     score) and never the child's own reasons.
 *   * Everyone else, teens above all (parent-created or self-registered), keeps
 *     the journal private: the Tutor still sees only how many decisions there
 *     were (B.10).
 *
 * Age follows age, not role (every minor safeguard does): an exact birth date
 * decides; without one, the screened band decides (the under-13 refusal origin
 * reads as under 13). An age that cannot be established keeps the journal
 * private, the conservative reading for a privacy disclosure. The child is told
 * on their own journal when the Tutor can see their choices.
 */

export interface JournalSharingEvidence {
  roles: readonly string[];
  birthDate: string | null;
  age: Pick<AgeScreenState, 'ageBand' | 'protectedOrigin'>;
  now?: Date;
}

export function journalSharedWithTutor(input: JournalSharingEvidence): boolean {
  if (!input.roles.includes('kid')) return false;
  const exact = ageFromBirthDate(input.birthDate, input.now);
  if (exact !== null) return exact < 13;
  return input.age.protectedOrigin || input.age.ageBand === 'under_13';
}

const Profile = z.array(z.object({ birth_date: z.string().nullable() }).passthrough()).max(1);

/** Reads the evidence and applies the rule; null when any read fails (never guessed). */
export async function readJournalSharing(userId: string, age?: AgeScreenState): Promise<boolean | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const [roles, screen, profile] = await Promise.all([
    getRolesForGate(userId),
    age ? Promise.resolve(age) : readAgeScreen(userId),
    serviceRest<unknown>(`/profiles?user_id=eq.${encodeURIComponent(userId)}&select=birth_date&limit=1`),
  ]);
  const parsed = Profile.safeParse(profile);
  if (roles === null || !screen || !parsed.success) return null;
  return journalSharedWithTutor({ roles, birthDate: parsed.data[0]?.birth_date ?? null, age: screen });
}
