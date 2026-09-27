import { z } from 'zod';
import { serviceRestRaw } from './supabaseRest.js';

/*
 * S-06 (owner decision OD-28): a verified Tutor may change the username of
 * their linked child whose handle is flagged (E.13).
 *
 * A parent-created child signs in with a handle, and the sign-in address is
 * derived from it (routes/family.ts kidEmail), so the two must change together.
 * public.guardian_rename_flagged_child (migration
 * guardian_child_username_change) does it in one transaction: it re-checks the
 * verified link, the kid role, that the CURRENT handle is flagged, the new
 * handle's shape, safety and uniqueness, and that the stored address is the
 * derived one; it then updates the profile, the sign-in address and GoTrue's
 * email identity, and writes the audit row. Core's own checks before the call
 * only exist to give a clear answer; the database is the boundary.
 */

export type KidRenameOutcome =
  | { status: 'renamed'; username: string }
  | {
    status:
      | 'not-guardian'
      | 'self-managed'
      | 'not-flagged'
      | 'unchanged'
      | 'unsafe'
      | 'in-use'
      | 'shape'
      | 'identifier-mismatch'
      | 'unavailable';
  };

const Refusal = z.object({ message: z.string() }).passthrough();
const REFUSALS: Record<string, Exclude<KidRenameOutcome['status'], 'renamed'>> = {
  NOT_GUARDIAN: 'not-guardian',
  ACCOUNT_SELF_MANAGED: 'self-managed',
  USERNAME_NOT_FLAGGED: 'not-flagged',
  USERNAME_UNCHANGED: 'unchanged',
  PROFILE_FIELD_UNSAFE: 'unsafe',
  USERNAME_IN_USE: 'in-use',
  USERNAME_SHAPE: 'shape',
  SIGN_IN_IDENTIFIER_MISMATCH: 'identifier-mismatch',
};

export const KID_USERNAME = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/);

export async function renameFlaggedChild(guardianId: string, kidId: string, username: string): Promise<KidRenameOutcome> {
  const ids = z.tuple([z.string().uuid(), z.string().uuid()]).safeParse([guardianId, kidId]);
  if (!ids.success) return { status: 'not-guardian' };
  const handle = KID_USERNAME.safeParse(username);
  if (!handle.success) return { status: 'shape' };
  const result = await serviceRestRaw('/rpc/guardian_rename_flagged_child', {
    method: 'POST',
    body: JSON.stringify({ p_guardian: guardianId, p_kid: kidId, p_username: handle.data }),
  });
  if (result.ok) {
    return result.body === handle.data ? { status: 'renamed', username: handle.data } : { status: 'unavailable' };
  }
  const refusal = Refusal.safeParse(result.body);
  const status = refusal.success ? REFUSALS[refusal.data.message] : undefined;
  return { status: status ?? 'unavailable' };
}
