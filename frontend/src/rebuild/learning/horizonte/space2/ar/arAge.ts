import { AR_ADULT_AGE, AR_PILOT_MIN_AGE } from '../ar.generated';

/*
 * F4.9: the learner's age for the AR pilot gate, from the one place the app really knows it. Core's GET /auth/age-screen
 * (the age screen every signed-in person already passes) answers with a band, never a birth date, so the gate gets the
 * lowest whole age the band allows. That is never above the real age: a 13-17 learner reads as 13, which is a minor and so
 * needs a guardian's consent too, and an unknown, unfinished or under-13 answer reads as no age at all, which keeps the
 * pilot closed. Nothing here is stored and nothing about the camera is touched.
 */

/** The age the gate reads from Core's answer, or null when there is no usable one (the gate then stays closed). */
export function arAgeFromScreen(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const screen = value as { required?: unknown; ageBand?: unknown };
  if (screen.required !== false) return null;
  if (screen.ageBand === 'adult') return AR_ADULT_AGE;
  if (screen.ageBand === '13_to_17') return AR_PILOT_MIN_AGE;
  return null;
}
