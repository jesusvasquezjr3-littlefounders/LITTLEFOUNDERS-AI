import { z } from 'zod';
import { declaredBandForDate, readAgeScreen, type AgeScreenState } from '../ageScreen.js';
import { getRolesForGate } from '../insights.js';
import { restBatchedByIds, serviceRest } from '../supabaseRest.js';

/*
 * L-13 (owner decision OD-27 (3), 27 September 2026): "For parent-created
 * children under 13, the verified Tutor sees which option the child chose in
 * each story decision; teens' decision journals stay private." E.13
 * minimization, E.10 (no messaging) and every connection rule still apply.
 *
 * WHO. A parent-created child (the 'kid' role a verified parent grants in
 * POST /family/kids) whose age evidence says under 13 TODAY, computed on every
 * read and never stored, so the day a child turns 13 their choices go private:
 *   - a valid profile birth date decides alone: under 13 today or not;
 *   - without one, the age screen's under-13 band or the A.2 under-13 origin
 *     marker counts as under 13;
 *   - no evidence at all (no birth date and no declaration) is NOT eligible.
 * Everyone else keeps counts only: every teen (13–17, whatever the origin),
 * every self-registered account (no kid role) even when a parent linked it
 * later, and adults. The rule follows age within the one population the owner
 * named, never a role alone.
 *
 * WHAT (minimization). Per story decision: the situation (the story's own
 * question, authored lesson text, without which an option like "10 coins" is
 * meaningless) and the option the child chose (the latest one). Not the
 * outcome the story showed next, not an earlier choice the child changed, not
 * how many times it was decided or resurfaced, not when, and no journal id.
 * Texts are the snapshots stored in the LESSON's locale, so each carries it.
 *
 * WHERE IT IS ENFORCED. Core, server-side, on the verified-Tutor route that
 * already re-checks the verified link (routes/familyLearning.ts). The journal
 * stays owner-only under RLS; Core reads it with the service role after its
 * own checks. A failed eligibility read shows counts only (fail closed).
 *
 * The child keeps the right to clear their journal (DELETE /learn/journal);
 * what is cleared is gone for the Tutor too.
 */

const Uuid = z.string().uuid();
const eu = (value: string): string => encodeURIComponent(Uuid.parse(value));
const inList = (ids: readonly string[]): string => `in.(${ids.map((id) => Uuid.parse(id)).join(',')})`;

export interface TutorChoicesInput {
  roles: readonly string[];
  /** profiles.birth_date, when the parent gave one. */
  birthDate: string | null;
  /** The age screen as read now; null = not read. */
  age: Pick<AgeScreenState, 'ageBand' | 'protectedOrigin'> | null;
}

/** Pure rule: may the verified Tutor see this learner's story choices today? (see header) */
export function tutorSeesChoices(input: TutorChoicesInput, now: Date = new Date()): boolean {
  if (!input.roles.includes('kid')) return false;
  const byBirthDate = input.birthDate ? declaredBandForDate(input.birthDate, now) : null;
  if (byBirthDate !== null) return byBirthDate === 'under_13';
  if (!input.age) return false;
  return input.age.protectedOrigin || input.age.ageBand === 'under_13';
}

async function readBirthDate(userId: string): Promise<string | null | undefined> {
  const rows = await serviceRest<unknown>(`/profiles?user_id=eq.${eu(userId)}&select=birth_date&limit=1`);
  const parsed = z.array(z.object({ birth_date: z.string().nullable().optional() }).passthrough()).safeParse(rows);
  if (!parsed.success) return undefined;
  return parsed.data[0]?.birth_date ?? null;
}

/**
 * The rule, read for one learner. `age` may be passed when the caller already
 * holds it (the learner's own request). Null = a read failed.
 */
export async function readTutorSeesChoices(userId: string, age?: AgeScreenState | null, now: Date = new Date()): Promise<boolean | null> {
  const [roles, birthDate, screen] = await Promise.all([
    getRolesForGate(userId),
    readBirthDate(userId),
    age === undefined ? readAgeScreen(userId) : Promise.resolve(age),
  ]);
  if (roles === null || birthDate === undefined) return null;
  // Only a missing age screen matters when the birth date does not decide.
  const decidedByBirthDate = birthDate !== null && declaredBandForDate(birthDate, now) !== null;
  if (screen === null && !decidedByBirthDate && roles.includes('kid')) return null;
  return tutorSeesChoices({ roles, birthDate, age: screen }, now);
}

export interface TutorChoice {
  lessonId: string;
  /** The story's question, in the lesson's locale. */
  situation: string;
  /** The option the child chose (the latest one), in the lesson's locale. */
  choice: string;
  locale: string;
}

const ChoiceRow = z.object({
  lesson_id: z.string(),
  locale: z.string(),
  situation_text: z.string(),
  choice_text: z.string(),
  first_recorded_at: z.string(),
}).passthrough();

/** Story choices in these lessons, in story order (first recorded first). Only the minimized columns are selected. */
export async function readTutorChoices(kidId: string, lessonIds: string[]): Promise<TutorChoice[] | null> {
  if (lessonIds.length === 0) return [];
  const rows = await restBatchedByIds(lessonIds, (batch) => serviceRest<unknown[]>(
    `/learner_decision_journal?user_id=eq.${eu(kidId)}&lesson_id=${inList(batch)}&select=lesson_id,locale,situation_text,choice_text,first_recorded_at&order=first_recorded_at.asc`));
  const parsed = z.array(ChoiceRow).safeParse(rows);
  if (!parsed.success) return null;
  return [...parsed.data]
    .sort((a, b) => a.first_recorded_at.localeCompare(b.first_recorded_at))
    .map((r) => ({ lessonId: r.lesson_id, situation: r.situation_text, choice: r.choice_text, locale: r.locale }));
}
