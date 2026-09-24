import { z } from 'zod';

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
