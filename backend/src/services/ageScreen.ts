import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { readUnder13Origin } from './ageOrigin.js';

export const AgeBand = z.enum(['under_13', '13_to_17', 'adult']);
export type AgeBand = z.infer<typeof AgeBand>;
const BirthMonth = z.string().regex(/^\d{4}-\d{2}-01$/);
const Declaration = z.array(z.object({
  declared_age_band: AgeBand,
  declared_birth_month: BirthMonth.nullable().optional(),
}).strict()).max(1);

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

/**
 * OD-28 (S-04): the month a declared teen was born, kept so the band moves to
 * adult at 18. Only for a 13-17 band, never the day, and only from a date
 * `declaredBandForDate` already accepted. Every other band keeps no date.
 */
export function birthMonthForBand(value: string, band: AgeBand): string | null {
  if (band !== '13_to_17' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value.slice(0, 7)}-01`;
}

/**
 * True when a declared teen's month says they are 18 now. The day is not
 * kept, so the 18th birthday is read as the month's LAST day (the later,
 * protective reading): the move happens on the first day of the next month.
 * Mirrors `public.age_declaration_promotion_due` (migration
 * age_declaration_birth_month); the database decides, this only avoids a call.
 */
export function promotionDue(birthMonth: string | null | undefined, now = new Date()): boolean {
  if (!birthMonth || !BirthMonth.safeParse(birthMonth).success) return false;
  const year = Number(birthMonth.slice(0, 4));
  const month = Number(birthMonth.slice(5, 7));
  const due = Date.UTC(year + 18, month, 1); // month is 1-based: this is the first day of the NEXT month
  return now.getTime() >= due;
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
    serviceRest<unknown>(`/account_age_declarations?user_id=eq.${encodeURIComponent(userId)}&select=declared_age_band,declared_birth_month&limit=1`),
    readUnder13Origin(userId),
  ]);
  const parsed = Declaration.safeParse(rows);
  if (!parsed.success || origin === null) return null;
  // The refusal path already captured the minimum signal. It must not ask a
  // child to disclose the date a second time just to enter protected learning.
  let declared = parsed.data[0]?.declared_age_band ?? null;
  // OD-28: a declared teen whose month says 18 moves to adult. The database
  // makes the move; if it cannot confirm it, the teen band stays (protective).
  if (!origin && declared === '13_to_17' && promotionDue(parsed.data[0]?.declared_birth_month)) {
    const promoted = await serviceRest<unknown>('/rpc/promote_age_declaration', {
      method: 'POST', body: JSON.stringify({ p_user_id: userId }),
    });
    if (promoted === 'adult') declared = 'adult';
  }
  const band = origin ? 'under_13' : declared;
  return { required: band === null, ageBand: band, protectedOrigin: origin };
}

/**
 * Records the first declaration. `birthDate`, when given, is the date the
 * band was derived from: a teen's month and year are kept (OD-28), nothing
 * else of it is sent.
 */
export async function recordAgeScreen(userId: string, band: AgeBand, birthDate?: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(userId).success) return false;
  const month = birthDate ? birthMonthForBand(birthDate, band) : null;
  const saved = await serviceRest<unknown>('/rpc/record_age_declaration', {
    method: 'POST',
    body: JSON.stringify(month ? { p_user_id: userId, p_age_band: band, p_birth_month: month } : { p_user_id: userId, p_age_band: band }),
  });
  return AgeBand.safeParse(saved).success;
}
