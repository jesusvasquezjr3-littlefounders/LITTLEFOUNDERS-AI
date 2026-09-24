import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { readUnder13Origin } from './ageOrigin.js';

export const AgeBand = z.enum(['under_13', '13_to_17', 'adult']);
export type AgeBand = z.infer<typeof AgeBand>;
const Declaration = z.array(z.object({ declared_age_band: AgeBand }).strict()).max(1);

/** Calendar validation before classification; never persist the submitted date. */
export function declaredBandForDate(value: string, now = new Date()): AgeBand | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(now.getTime()) ||
      birth.toISOString().slice(0, 10) !== value || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  if (age < 0 || age >= 120) return null;
  return age < 13 ? 'under_13' : age < 18 ? '13_to_17' : 'adult';
}

export interface AgeScreenState {
  required: boolean;
  ageBand: AgeBand | null;
  /** Origin posture, not GoTrue anonymous status or verified adulthood. */
  protectedOrigin: boolean;
}

export async function readAgeScreen(userId: string): Promise<AgeScreenState | null> {
  if (!z.string().uuid().safeParse(userId).success) return null;
  const [rows, origin] = await Promise.all([
    serviceRest<unknown>(`/account_age_declarations?user_id=eq.${encodeURIComponent(userId)}&select=declared_age_band&limit=1`),
    readUnder13Origin(userId),
  ]);
  const parsed = Declaration.safeParse(rows);
  if (!parsed.success || origin === null) return null;
  // The refusal path already captured the minimum signal. It must not ask a
  // child to disclose the date a second time just to enter protected learning.
  const band = origin ? 'under_13' : parsed.data[0]?.declared_age_band ?? null;
  return { required: band === null, ageBand: band, protectedOrigin: origin };
}

export async function recordAgeScreen(userId: string, band: AgeBand): Promise<boolean> {
  if (!z.string().uuid().safeParse(userId).success) return false;
  const saved = await serviceRest<unknown>('/rpc/record_age_declaration', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_age_band: band }),
  });
  return AgeBand.safeParse(saved).success;
}
