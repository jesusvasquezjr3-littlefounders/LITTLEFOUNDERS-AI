import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * A.2, A.5, E.4, OD-3 section 2 (F3-identity-site finish): the accounts that
 * hold the parent role while their own age record says a minor (a kid-role
 * account, an under-13 origin, or an effective declared band of under 13 or
 * 13 to 17). guard_parent_verification_age stops new verified ID checks for
 * them; accounts verified before it keep the role until staff review them
 * (revoke, or approve an E.4 age correction). Never demoted automatically:
 * the age record itself may be the error.
 *
 * Read from public.list_minor_record_tutors (migration tutor_age_record_review).
 * A missing or malformed answer is null, never an empty set: the staff list
 * and the release gate must not report "none" when nothing was read.
 */
const Rows = z.array(z.object({ user_id: z.string().uuid() }));

export async function listMinorRecordTutors(): Promise<Set<string> | null> {
  const raw = await serviceRest<unknown>('/rpc/list_minor_record_tutors', { method: 'POST', body: '{}' });
  const parsed = Rows.safeParse(raw);
  return parsed.success ? new Set(parsed.data.map((row) => row.user_id)) : null;
}
