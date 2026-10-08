import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { adminRevokeUserSessions } from './gotrue.js';
import { eraseNow } from './accountDeletion.js';

/*
 * The FAQ promise: a kid whose last verified guardian link disappears
 * is suspended immediately and deleted if nothing reactivates it within 90
 * days. The suspension marker (and, since identity_enforcement, the GoTrue
 * ban) is written by migration 0110's trigger. The 90-day deletion runs in
 * two places, both through `purgeExpiredKidSuspension`, which hard deletes
 * only when the window has passed AND no verified link exists: the daily
 * account-deletion sweep (`listExpiredKidSuspensions`, so a child who never
 * signs in again is still erased) and the kid's own
 * session boundary (GET /auth/me).
 */

export const KID_SUSPENSION_DELETE_DAYS = 90;

/**
 * Service-role suspension read — the browser's own profile read is not the
 * enforcing boundary. Distinguishes "no marker" (null) from "unreadable or
 * unexpected shape" ('unavailable'): the latter must never be treated as
 * evidence of an active account.
 */
export async function readKidSuspension(userId: string): Promise<string | null | 'unavailable'> {
  const rows = await serviceRest<unknown[]>(
    `/profiles?user_id=eq.${encodeURIComponent(userId)}&select=suspended_at&limit=1`,
  );
  const parsed = z.array(z.object({ suspended_at: z.string().datetime({ offset: true }).nullable() })).max(1).safeParse(rows);
  if (!parsed.success) return 'unavailable';
  if (parsed.data.length === 0) return null;
  return parsed.data[0]!.suspended_at;
}

/**
 * Lazy 90-day purge, evaluated at the kid's session boundary. Hard-deletes
 * the account ONLY when the window has passed AND no verified guardian link
 * exists. Returns 'deleted' | 'suspended' | 'active' | 'unknown' — a failed
 * read NEVER deletes (never destroy on an ambiguous read). The link
 * read is shape-validated so an empty 200 body or a proxy artifact can never
 * masquerade as an empty link set.
 */
export async function purgeExpiredKidSuspension(userId: string, suspendedAt: string, now: Date = new Date()): Promise<'deleted' | 'suspended' | 'active' | 'unknown'> {
  const since = Date.parse(suspendedAt);
  if (!Number.isFinite(since)) return 'unknown';
  if (now.getTime() - since < KID_SUSPENSION_DELETE_DAYS * 24 * 60 * 60 * 1000) return 'suspended';
  const links = await serviceRest<unknown[]>(
    `/guardian_links?kid_user_id=eq.${encodeURIComponent(userId)}&verification_status=eq.verified&select=id&limit=1`,
  );
  const parsed = z.array(z.object({ id: z.string().uuid() })).safeParse(links);
  if (!parsed.success) return 'unknown';
  if (parsed.data.length > 0) return 'active';
  // The purge is the same erasure as every other deletion (database,
  // Mentor sessions, stored files, warehouse), recorded and audited on an
  // account_deletion_requests row. 'deleted' once the account itself is gone;
  // any remaining cleanup is resumed by the daily sweep.
  const erased = await eraseNow({ subjectId: userId, population: 'kid', initiatedBy: 'suspension_expiry', actorId: null });
  return erased !== 'unavailable' && erased !== 'staff' && erased.accountErased ? 'deleted' : 'unknown';
}

const ExpiredSuspensions = z.array(z.object({
  user_id: z.string().uuid(),
  suspended_at: z.string().datetime({ offset: true }),
}));

/**
 * The scheduled purge's candidates (migration identity_enforcement): kid-role
 * accounts paused at least KID_SUSPENSION_DELETE_DAYS ago with no verified
 * link and no open deletion request. `null` = unreadable, never "none".
 */
export async function listExpiredKidSuspensions(limit: number): Promise<{ userId: string; suspendedAt: string }[] | null> {
  const raw = await serviceRestRaw('/rpc/list_expired_kid_suspensions', {
    method: 'POST',
    body: JSON.stringify({ p_older_than_days: KID_SUSPENSION_DELETE_DAYS, p_limit: limit }),
  });
  if (!raw.ok) return null;
  const parsed = ExpiredSuspensions.safeParse(raw.body);
  return parsed.success ? parsed.data.map((row) => ({ userId: row.user_id, suspendedAt: row.suspended_at })) : null;
}

/**
 * The enforcement boundary the suspension promise rests on: a suspended
 * kid's sessions are revoked so the account is unusable immediately, and the
 * lazy 90-day purge runs at the same admission point. 'unknown' means a read
 * failed — the caller must treat it as not-suspended evidence (never delete,
 * never revoke on an ambiguous read). A revocation failure is logged loudly;
 * the admission still refuses, so a kid session never proceeds while the
 * suspension marker is readable.
 */
export async function enforceKidSuspensionAtAdmission(userId: string): Promise<'deleted' | 'suspended' | 'active' | 'unknown'> {
  const suspendedAt = await readKidSuspension(userId);
  if (suspendedAt === null) return 'active';
  if (suspendedAt === 'unavailable') return 'unknown';
  const purge = await purgeExpiredKidSuspension(userId, suspendedAt);
  if (purge === 'deleted') return 'deleted';
  if (purge === 'unknown') return 'unknown';
  const revoked = await adminRevokeUserSessions(userId);
  if (revoked.error !== null) {
    console.error(`[backend] session revocation FAILED for suspended kid user=${userId} — sessions may survive until the next admission check`);
  }
  return 'suspended';
}
