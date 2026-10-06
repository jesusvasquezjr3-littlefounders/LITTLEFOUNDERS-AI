import { z } from 'zod';
import type { AgeBand } from './ageScreen.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const eligibilitySchema = z.object({ minimum_age: z.number().int().min(0).max(119), maximum_age: z.number().int().min(0).max(119) }).strict()
  .refine((value) => value.minimum_age <= value.maximum_age, 'Invalid age range');

export type LessonEligibility = z.infer<typeof eligibilitySchema>;
export type EligibilityResult = 'eligible' | 'outside-range' | 'unknown-age' | 'invalid-policy';

/** Reads only a bounded server-side age policy; it never returns the learner's birth date or age. */
export function readLessonEligibility(document: unknown): LessonEligibility | null {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return null;
  const parsed = eligibilitySchema.safeParse((document as Record<string, unknown>).eligibility);
  return parsed.success ? parsed.data : null;
}

function ageOn(birthDate: string, now: Date): number | null {
  if (!ISO_DATE.test(birthDate) || !Number.isFinite(now.getTime())) return null;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/** Core-only eligibility check for v2 teaching representations with exact Appendix P ranges. */
export function lessonEligibilityForBirthDate(document: unknown, birthDate: string | null | undefined, now = new Date()): EligibilityResult {
  const policy = readLessonEligibility(document);
  if (!policy) return 'invalid-policy';
  if (!birthDate) return 'unknown-age';
  const age = ageOn(birthDate, now);
  if (age === null) return 'unknown-age';
  return age >= policy.minimum_age && age <= policy.maximum_age ? 'eligible' : 'outside-range';
}

/** The whole-year ages a declared band can hold. The declaration keeps a band, never the date it came from. */
const BAND_AGES: Record<AgeBand, readonly [number, number]> = { under_13: [0, 12], '13_to_17': [13, 17], adult: [18, 119] };

/**
 * The exact birth date decides when Core holds one. Accounts made through the
 * age screen keep only a band (the date is deliberately not stored, and a
 * browser identity cannot write `profiles.birth_date`), so without a date the
 * band decides when it settles the policy: wholly inside the range is
 * eligible, wholly outside is refused, and a band that straddles an edge
 * still needs the exact date and fails closed.
 */
export function lessonEligibilityFor(document: unknown, birthDate: string | null | undefined, band: AgeBand | null | undefined, now = new Date()): EligibilityResult {
  const exact = lessonEligibilityForBirthDate(document, birthDate, now);
  const policy = readLessonEligibility(document);
  if (exact !== 'unknown-age' || !policy || !band) return exact;
  const [low, high] = BAND_AGES[band];
  if (high < policy.minimum_age || low > policy.maximum_age) return 'outside-range';
  return low >= policy.minimum_age && high <= policy.maximum_age ? 'eligible' : 'unknown-age';
}
