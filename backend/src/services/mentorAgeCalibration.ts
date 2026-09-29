import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { declaredBandForDate, type AgeScreenState } from './ageScreen.js';

export const MentorAgeTier = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type MentorAgeTier = z.infer<typeof MentorAgeTier>;
const Rows = z.array(z.object({ tier: MentorAgeTier }).strict()).max(1);

/** A coarse under-13 declaration alone is explicitly unknown for pedagogy. */
export function knownMentorAgeTier(birthDate: string | null, state: AgeScreenState, now = new Date()): MentorAgeTier | null {
  if (state.required) return null;
  if (!state.protectedOrigin && (state.ageBand === '13_to_17' || state.ageBand === 'adult')) return 3;
  if (!birthDate || declaredBandForDate(birthDate, now) !== 'under_13') return null;
  const born = new Date(`${birthDate}T00:00:00.000Z`);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age--;
  return age <= 7 ? 1 : age <= 9 ? 2 : 3;
}

/** Missing calibration and failed reads are different; neither invents age. */
export async function readMentorAgeCalibration(userId: string): Promise<{ tier: MentorAgeTier | null } | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const result = Rows.safeParse(await serviceRest<unknown>(
    `/mentor_age_calibrations?user_id=eq.${encodeURIComponent(userId)}&select=tier&limit=1`,
  ));
  return result.success ? { tier: result.data[0]?.tier ?? null } : null;
}

/**
 * Internal socket admission resolves evidence again; a legacy session tier is
 * not age evidence. The birth date read here travels no further than Core
 * (C.17 derives the dialogue band from it; Oracle only ever sees the band).
 */
export async function resolveInternalMentorAge(
  userId: string,
  state: AgeScreenState,
): Promise<{ tier: MentorAgeTier | null; birthDate: string | null } | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const profiles = z.array(z.object({ birth_date: z.string().nullable() })).length(1).safeParse(
    await serviceRest<unknown>(`/profiles?user_id=eq.${encodeURIComponent(userId)}&select=birth_date&limit=1`),
  );
  if (!profiles.success) return null;
  const birthDate = profiles.data[0]!.birth_date;
  const known = knownMentorAgeTier(birthDate, state);
  if (known !== null) return { tier: known, birthDate };
  const calibrated = await readMentorAgeCalibration(userId);
  return calibrated === null ? null : { tier: calibrated.tier, birthDate };
}

/** First-write wins. A replay can return the earlier tier, never an upgrade. */
export async function recordMentorAgeCalibration(userId: string, tier: MentorAgeTier): Promise<MentorAgeTier | null> {
  if (!z.uuid().safeParse(userId).success || !MentorAgeTier.safeParse(tier).success) return null;
  const result = MentorAgeTier.safeParse(await serviceRest<unknown>('/rpc/record_mentor_age_calibration', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_tier: tier }),
  }));
  return result.success ? result.data : null;
}

// ── C.1 / Appendix F 1.3 Age-Tier Calibration Coverage Rate (GAP-FIX-R3) ────

const count = z.coerce.number().int().nonnegative();
const CoverageRows = z
  .array(
    z.object({
      sessions: count,
      unknown_age_sessions: count,
      calibrated_before_start: count,
      coverage: z.coerce.number().min(0).max(1).nullable(),
    }),
  )
  .length(1);

export interface AgeCalibrationCoverage {
  sessions: number;
  unknownAgeSessions: number;
  calibratedBeforeStart: number;
  coverage: number | null;
}

/**
 * mentor_age_calibration_coverage over [from, to): the Mentor sessions of
 * learners Core could not place in a teaching tier, and how many had the
 * explicit calibration before they started (a hard invariant at 100%). Null
 * when the read failed or the numbers do not add up (never a guess).
 */
export async function readAgeCalibrationCoverage(from: Date, to: Date): Promise<AgeCalibrationCoverage | null> {
  const parsed = CoverageRows.safeParse(
    await serviceRest<unknown>('/rpc/mentor_age_calibration_coverage', {
      method: 'POST',
      body: JSON.stringify({ p_from: from.toISOString(), p_to: to.toISOString() }),
    }),
  );
  if (!parsed.success) return null;
  const r = parsed.data[0]!;
  if (r.unknown_age_sessions > r.sessions || r.calibrated_before_start > r.unknown_age_sessions) return null;
  return {
    sessions: r.sessions,
    unknownAgeSessions: r.unknown_age_sessions,
    calibratedBeforeStart: r.calibrated_before_start,
    coverage: r.coverage,
  };
}
