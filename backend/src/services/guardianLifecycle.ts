import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { adminRevokeUserSessions } from './gotrue.js';
import { eraseNow } from './accountDeletion.js';

/*
 * A.1's two built FAQ promises:
 *
 * 1. A second verified Tutor can link to the same child. The joining parent
 *    is admitted by the family router's verified-adulthood gate BEFORE these
 *    functions run; the invite token is the only authorization a parent
 *    without an existing link gets, and it is single-use with a 7-day window.
 *
 * 2. A kid whose last verified guardian link disappears is suspended
 *    immediately and deleted if nothing reactivates it within 90 days. The
 *    suspension marker is written by migration 0110's trigger; the 90-day
 *    deletion is lazy (no scheduler exists in this stack): evaluated at the
 *    kid's own session boundary by `purgeExpiredKidSuspension`, which hard
 *    deletes only when the window has passed AND no verified link exists.
 */

export const GUARDIAN_INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const KID_SUSPENSION_DELETE_DAYS = 90;

const InviteRow = z.object({
  token: z.string(),
  kid_user_id: z.string().uuid(),
  created_by: z.string().uuid().nullable(),
  expires_at: z.string().datetime({ offset: true }),
  accepted_at: z.string().datetime({ offset: true }).nullable(),
});

const KidProfileMin = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().nullable(),
  username: z.string().nullable(),
});

export async function createGuardianInvite(kidUserId: string, createdBy: string): Promise<{ token: string; expiresAt: string } | null> {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + GUARDIAN_INVITE_LIFETIME_MS).toISOString();
  const inserted = await serviceRest<unknown>('/guardian_invites', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ kid_user_id: kidUserId, created_by: createdBy, token, expires_at: expiresAt }),
  });
  return inserted === null ? null : { token, expiresAt };
}

/** The joining parent's preview: kid display fields only — never contact data, never other guardians. */
export async function getGuardianInvitePreview(token: string): Promise<{ kidUserId: string; displayName: string | null; username: string | null; expiresAt: string; selfIssued: boolean } | null> {
  const invites = await serviceRest<unknown[]>(
    `/guardian_invites?token=eq.${encodeURIComponent(token)}&accepted_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
      `&select=token,kid_user_id,created_by,expires_at,accepted_at&limit=1`,
  );
  const parsed = z.array(InviteRow).max(1).safeParse(invites);
  if (!parsed.success || parsed.data.length === 0) return null;
  const invite = parsed.data[0]!;
  // Defensive re-check AFTER parsing: a misbehaving proxy or a query-string
  // drift must never turn a consumed invite back into a live preview.
  if (invite.accepted_at !== null || Date.parse(invite.expires_at) <= Date.now()) return null;
  const profiles = await serviceRest<unknown[]>(
    `/profiles?user_id=eq.${encodeURIComponent(invite.kid_user_id)}&select=user_id,display_name,username&limit=1`,
  );
  const profile = z.array(KidProfileMin).max(1).safeParse(profiles);
  if (!profile.success || profile.data.length === 0) return null;
  return {
    kidUserId: invite.kid_user_id,
    displayName: profile.data[0]!.display_name,
    username: profile.data[0]!.username,
    expiresAt: invite.expires_at,
    // S07.2: a teen issued this invite for their own account.
    selfIssued: invite.created_by === invite.kid_user_id,
  };
}

/** One-shot exchange; migration 0110's transaction validates, links, marks accepted and audits. */
export async function acceptGuardianInvite(token: string, acceptingParentId: string): Promise<{ kidUserId: string } | 'invalid' | 'unavailable'> {
  const raw = await serviceRestRaw('/rpc/accept_guardian_invite', {
    method: 'POST',
    body: JSON.stringify({ p_token: token, p_accepting: acceptingParentId }),
  });
  if (raw.ok) {
    const parsed = z.string().uuid().safeParse(raw.body);
    return parsed.success ? { kidUserId: parsed.data } : 'unavailable';
  }
  const error = z.object({ code: z.literal('P0001') }).safeParse(raw.body);
  return error.success ? 'invalid' : 'unavailable';
}

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
 * read NEVER deletes (§1.14: never destroy on an ambiguous read). The link
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
  // E.6: the purge is the same erasure as every other deletion (database,
  // Mentor sessions, stored files, warehouse), recorded and audited on an
  // account_deletion_requests row. 'deleted' once the account itself is gone;
  // any remaining cleanup is resumed by the daily sweep.
  const erased = await eraseNow({ subjectId: userId, population: 'kid', initiatedBy: 'suspension_expiry', actorId: null });
  return erased !== 'unavailable' && erased !== 'staff' && erased.accountErased ? 'deleted' : 'unknown';
}

/**
 * The enforcement boundary A.1's suspension promise rests on: a suspended
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
