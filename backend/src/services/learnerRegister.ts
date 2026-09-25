import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import type { AgeScreenState } from './ageScreen.js';
import { readMentorAgeCalibration } from './mentorAgeCalibration.js';
import {
  LEARNER_REGISTERS, graduationInto, registerForAge,
  type LearnerRegister,
} from './learnerRegisterPolicy.js';

/*
 * B.23 (S05.3f): which register a learner reads in, from Core's own age
 * evidence. Never from the client, never from role.
 *
 *   1. A valid birth date on the profile gives the exact age.
 *   2. Otherwise the age screen: an adult declaration reads as adult, a
 *      13-17 declaration as teen (neither on a protected under-13 origin).
 *   3. An under-13 learner with no birth date: the Mentor's first-write age
 *      calibration (tier 3 is 10-12, tiers 1-2 are 9 or younger).
 *   4. Nothing known: the youngest register, the most protective default.
 *
 * The register changes tone, the Mentor's presence, reward framing and social
 * mechanics (OD-4). It is not a safeguard: every minor safeguard keeps
 * following age through its own module.
 */

export function ageFromBirthDate(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const born = new Date(`${birthDate}T00:00:00.000Z`);
  if (!Number.isFinite(born.getTime()) || born.toISOString().slice(0, 10) !== birthDate || born > now) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function registerFromEvidence(input: {
  birthDate: string | null; state: AgeScreenState; calibrationTier: 1 | 2 | 3 | null; now?: Date;
}): LearnerRegister {
  const age = ageFromBirthDate(input.birthDate, input.now);
  if (age !== null) return registerForAge(age);
  if (!input.state.protectedOrigin && input.state.ageBand === 'adult') return 'adult';
  if (!input.state.protectedOrigin && input.state.ageBand === '13_to_17') return 'teen';
  if (input.calibrationTier === 3) return 'transition';
  return 'young';
}

const Profile = z.array(z.object({ birth_date: z.string().nullable() })).length(1);

/** Null when the evidence cannot be read (a failed read is never guessed into a register). */
export async function resolveLearnerRegister(userId: string, state: AgeScreenState): Promise<LearnerRegister | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const profile = Profile.safeParse(await serviceRest<unknown>(
    `/profiles?user_id=eq.${encodeURIComponent(userId)}&select=birth_date&limit=1`,
  ));
  if (!profile.success) return null;
  const birthDate = profile.data[0]!.birth_date;
  const needsCalibration = ageFromBirthDate(birthDate) === null
    && (state.protectedOrigin || state.ageBand === 'under_13' || state.ageBand === null);
  const calibration = needsCalibration ? await readMentorAgeCalibration(userId) : { tier: null };
  if (calibration === null) return null;
  return registerFromEvidence({ birthDate, state, calibrationTier: calibration.tier });
}

const RegisterList = z.array(z.enum(LEARNER_REGISTERS as [LearnerRegister, ...LearnerRegister[]]));
const Noted = z.object({ seen: RegisterList, acknowledged: RegisterList }).strict();

export interface RegisterStatus {
  register: LearnerRegister;
  graduation: { from: LearnerRegister; to: LearnerRegister } | null;
}

/** Notes the register (first sighting) and says whether a graduation into it is still owed. */
export async function noteLearnerRegister(userId: string, register: LearnerRegister): Promise<RegisterStatus | null> {
  const noted = Noted.safeParse(await serviceRest<unknown>('/rpc/note_learner_register', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_register: register }),
  }));
  if (!noted.success) return null;
  const owed = graduationInto(noted.data.seen, register);
  return { register, graduation: owed && !noted.data.acknowledged.includes(register) ? owed : null };
}

/** True once the graduation into `register` is acknowledged; false when there is none to acknowledge; null on failure. */
export async function acknowledgeGraduation(userId: string, register: LearnerRegister): Promise<boolean | null> {
  const result = z.boolean().safeParse(await serviceRest<unknown>('/rpc/acknowledge_learner_graduation', {
    method: 'POST', body: JSON.stringify({ p_user_id: userId, p_register: register }),
  }));
  return result.success ? result.data : null;
}
