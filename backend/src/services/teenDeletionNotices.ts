import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';

/*
 * GAP-FIX-R2 (owner review D-14 (b), E.6, OD-3 section 2): a linked teen's own
 * account deletion tells each verified Tutor, notify only.
 *
 * The database writes the notices: an AFTER INSERT trigger on
 * account_deletion_requests (teen_deletion_guardian_notices) adds one row per
 * verified guardian link of a self-initiated 'teen' request, plus the audit row
 * account.deletion_guardians_notified, in the request's own transaction. Core
 * only reads them for the Tutor: the teen's display name, the scheduled date
 * and when the Tutor was told. A cancelled request drops out (no second
 * notice), the erasure removes the rows with the account, and the Tutor is
 * offered no action.
 */

const Notice = z.object({
  id: z.string().uuid(),
  teen_user_id: z.string().uuid(),
  display_name: z.string().max(120),
  scheduled_for: z.string().min(1),
  notified_at: z.string().min(1),
}).strict();

export interface TeenDeletionNotice {
  id: string;
  teenUserId: string;
  displayName: string;
  scheduledFor: string;
  notifiedAt: string;
}

/** The open deletion notices this Tutor was sent; null = unreadable (the caller answers 502, never "none"). */
export async function readTeenDeletionNotices(guardianId: string): Promise<TeenDeletionNotice[] | null> {
  const rows = await rpc('guardian_deletion_notices', { p_guardian: guardianId }, z.array(Notice));
  if (rows === UNAVAILABLE || isRefusal(rows)) return null;
  return rows.map((r) => ({ id: r.id, teenUserId: r.teen_user_id, displayName: r.display_name, scheduledFor: r.scheduled_for, notifiedAt: r.notified_at }));
}
