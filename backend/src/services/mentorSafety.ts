import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { readUnder13Origin } from './ageOrigin.js';

const Verification = z.object({
  status: z.enum(['verified', 'revoked']),
  method: z.string(),
  birth_date: z.string().nullable(),
}).strict();

/** C.2/C.3 interim rule: unknown or unverified age receives minor safeguards.
 * Editable profile dates and role grants are not proof of adulthood. Only the
 * latest service-owned ID verification can exempt an active parent account.
 * This is a safety posture, not an inferred age or a pedagogical age band.
 */
export function hasVerifiedAdultEvidence(record: unknown, now = new Date()): boolean {
  const result = Verification.safeParse(record);
  if (!result.success || result.data.status !== 'verified' || result.data.method !== 'local-ocr') return false;
  const value = result.data.birth_date;
  // A revocation row (0111) carries no birth date: not evidence of anything.
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || !Number.isFinite(now.getTime())) return false;
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.getUTCMonth() < date.getUTCMonth() ||
      (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age--;
  return age >= 18;
}

export async function requiresMinorMentorSafeguards(userId: string, roles: readonly string[]): Promise<boolean> {
  if (roles.includes('kid') || !roles.includes('parent')) return true;
  // Read the latest decision, including revoked rows. Filtering to verified
  // rows would revive an older approval after a later revocation.
  const rows = await serviceRest<unknown>(
    `/parent_verifications?user_id=eq.${encodeURIComponent(userId)}&select=status,method,birth_date&order=created_at.desc,id.desc&limit=1`,
  );
  return !Array.isArray(rows) || rows.length !== 1 || !hasVerifiedAdultEvidence(rows[0]);
}

/** Distinguishes absent evidence from a revoked decision or a failed read.
 * Revocation must not be cleared by submitting the same document again.
 */
export async function readAdultVerificationStatus(userId: string, roles: readonly string[]): Promise<'verified' | 'unverified' | 'revoked' | 'ineligible' | null> {
  if (roles.includes('kid')) return 'ineligible';
  const rows = await serviceRest<unknown>(
    `/parent_verifications?user_id=eq.${encodeURIComponent(userId)}&select=status,method,birth_date&order=created_at.desc,id.desc&limit=1`,
  );
  const parsed = z.array(Verification).max(1).safeParse(rows);
  if (!parsed.success) return null;
  const record = parsed.data[0];
  if (!record) return 'unverified';
  if (record.status === 'revoked') return 'revoked';
  return roles.includes('parent') && hasVerifiedAdultEvidence(record) ? 'verified' : 'unverified';
}

/** A.2 origin restrictions survive upgrade until verified supervision/adulthood.
 * Consent alone is insufficient: a stale consent row is not a guardian link.
 */
export async function resolveMentorSafety(userId: string, roles: readonly string[]): Promise<{
  isMinor: boolean; originRestricted: boolean;
}> {
  const isMinor = await requiresMinorMentorSafeguards(userId, roles);
  if (!isMinor) return { isMinor: false, originRestricted: false };
  const origin = await readUnder13Origin(userId);
  if (origin === false) return { isMinor: true, originRestricted: false };
  // A failed origin read is not proof that this is an ordinary account.
  if (origin === null) return { isMinor: true, originRestricted: true };
  const guardians = await serviceRest<unknown>(
    `/guardian_links?kid_user_id=eq.${encodeURIComponent(userId)}&verification_status=eq.verified&select=parent_user_id`,
  );
  const parsed = z.array(z.object({ parent_user_id: z.string().uuid() })).safeParse(guardians);
  return { isMinor: true, originRestricted: !parsed.success || parsed.data.length === 0 };
}
