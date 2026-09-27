import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { readUnder13Origin } from './ageOrigin.js';

export const AgeBand = z.enum(['under_13', '13_to_17', 'adult']);
export type AgeBand = z.infer<typeof AgeBand>;
const BIRTH_MONTH_ROW = /^\d{4}-\d{2}-01$/;
const Declaration = z.array(z.object({
  declared_age_band: AgeBand,
  birth_month: z.string().regex(BIRTH_MONTH_ROW).nullable().optional(),
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

/*
 * S-04 (owner decision OD-28): the age screen may also keep a birth month, so
 * a declared teen moves to the adult tier at 18. The month is kept only with a
 * 13-to-17 declaration, only when the client sends it explicitly (`birthMonth`,
 * which must be the month of the submitted date), and only with the FIRST
 * declaration: the E.4 lock is unchanged, so a band-only teen cannot add a
 * month later to reach the adult tier sooner. A month cannot say which day, so
 * the move waits until every day of the 18th-birthday month has passed; a
 * 17-year-old is never read as an adult. This mirrors
 * public.effective_age_band (migration age_screen_birth_month) exactly.
 */
export const BirthMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'A birth month is YYYY-MM');

/** First UTC day of the month `months` after the birth month plus `years`. */
function monthAfter(birthMonth: string, years: number, months: number): number {
  const year = Number(birthMonth.slice(0, 4));
  const month = Number(birthMonth.slice(5, 7)) - 1;
  return Date.UTC(year + years, month + months, 1);
}
function startOfUtcDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** True once the recorded birth month proves the person is at least `years` old today. */
export function birthMonthProvesAge(birthMonth: string | null | undefined, years: number, now = new Date()): boolean {
  if (!birthMonth || !BirthMonth.safeParse(birthMonth.slice(0, 7)).success) return false;
  return monthAfter(birthMonth.slice(0, 7), years, 1) <= startOfUtcDay(now);
}

/** The declared band as of `now`: a 13-to-17 declaration with a birth month reads as adult after the 18th birthday month. */
export function effectiveAgeBand(declared: AgeBand, birthMonth: string | null | undefined, now = new Date()): AgeBand {
  return declared === '13_to_17' && birthMonthProvesAge(birthMonth, 18, now) ? 'adult' : declared;
}

/** Is a `YYYY-MM` month consistent with a 13-to-17 declaration today (the database checks the same)? */
export function birthMonthFitsTeenBand(birthMonth: string, now = new Date()): boolean {
  if (!BirthMonth.safeParse(birthMonth).success) return false;
  const today = startOfUtcDay(now);
  const lastDayOf18thMonth = monthAfter(birthMonth, 18, 1) - 86_400_000;
  return monthAfter(birthMonth, 13, 0) <= today && lastDayOf18thMonth > today;
}

export interface AgeScreenState {
  required: boolean;
  /** The band as of today (S-04: a teen with a birth month reads as adult after 18). */
  ageBand: AgeBand | null;
  /** Origin posture, not GoTrue anonymous status or verified adulthood. */
  protectedOrigin: boolean;
  /** S-04: a birth month was kept with the declaration. Optional so older fixtures and callers stay valid. */
  birthMonthRecorded?: boolean;
  /** S-04: the adult band comes from a declared teen's birth month (analytics carry the teen's explicit "no"). */
  adultByBirthMonth?: boolean;
}

export async function readAgeScreen(userId: string): Promise<AgeScreenState | null> {
  if (!z.string().uuid().safeParse(userId).success) return null;
  const [rows, origin] = await Promise.all([
    serviceRest<unknown>(`/account_age_declarations?user_id=eq.${encodeURIComponent(userId)}&select=declared_age_band,birth_month&limit=1`),
    readUnder13Origin(userId),
  ]);
  const parsed = Declaration.safeParse(rows);
  if (!parsed.success || origin === null) return null;
  const row = parsed.data[0];
  const birthMonth = row?.birth_month ?? null;
  // The refusal path already captured the minimum signal. It must not ask a
  // child to disclose the date a second time just to enter protected learning.
  const declared = origin ? 'under_13' : row?.declared_age_band ?? null;
  const band = declared === null ? null : effectiveAgeBand(declared, origin ? null : birthMonth);
  return {
    required: band === null,
    ageBand: band,
    protectedOrigin: origin,
    birthMonthRecorded: !origin && birthMonth !== null,
    adultByBirthMonth: !origin && declared === '13_to_17' && band === 'adult',
  };
}

/**
 * Records the first declaration. `birthMonth` (`YYYY-MM`) is kept only with a
 * 13-to-17 band (S-04); callers pass it only when the client sent it.
 */
export async function recordAgeScreen(userId: string, band: AgeBand, birthMonth: string | null = null): Promise<boolean> {
  if (!z.string().uuid().safeParse(userId).success) return false;
  if (birthMonth !== null && (band !== '13_to_17' || !BirthMonth.safeParse(birthMonth).success)) return false;
  const saved = birthMonth === null
    ? await serviceRest<unknown>('/rpc/record_age_declaration', {
      method: 'POST', body: JSON.stringify({ p_user_id: userId, p_age_band: band }),
    })
    : await serviceRest<unknown>('/rpc/record_age_screen', {
      method: 'POST', body: JSON.stringify({ p_user_id: userId, p_age_band: band, p_birth_month: `${birthMonth}-01` }),
    });
  return AgeBand.safeParse(saved).success;
}

/**
 * The `birthMonth` an age-screen or signup body may send (S-04). Returns the
 * month to keep, null when none should be kept, or 'invalid' for a month that
 * is malformed or is not the month of the submitted date.
 */
export function birthMonthToKeep(birthDate: string, birthMonth: string | undefined, band: AgeBand): string | null | 'invalid' {
  if (birthMonth === undefined) return null;
  if (!BirthMonth.safeParse(birthMonth).success || birthDate.slice(0, 7) !== birthMonth) return 'invalid';
  // Kept only for a teen: an under-13 date is never retained, and an adult has no tier to move to.
  return band === '13_to_17' ? birthMonth : null;
}
