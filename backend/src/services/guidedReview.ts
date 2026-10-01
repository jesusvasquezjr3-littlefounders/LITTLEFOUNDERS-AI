import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { getTutorPreferences } from './tutorData.js';
import { GUIDED_REVIEW_MAX_TRACKED, offersGuidedReview } from './learnerRegisterPolicy.js';

/*
 * B.26 and OD-1 (S05.3f): the guided review.
 *
 * A wrong answer costs nothing: no lives, no hearts, no counter, no lockout.
 * After GUIDED_REVIEW_MISS_THRESHOLD consecutive misses on the same skill (3,
 * proposed; owned by the Pedagogical Lead), the grade response carries an
 * offer: the learner's Mentor can review that skill with them. The learner may
 * decline; nothing about the lesson changes either way. The offer repeats at
 * each further multiple of the threshold (6, 9, 12), never on every miss.
 *
 * "Same skill" is what Core can prove from its own records:
 *   - a course lesson (v1): the attempt log's skill key (course/topic), across
 *     every lesson that teaches it, most recent first;
 *   - a v2 lesson: the graded receipts of that lesson version (v2 receipts
 *     carry no skill key; one v2 lesson teaches one topic).
 * A miss is an attempt below the lesson's pass threshold (v1) or a receipt
 * whose verdict is not met (v2). Only Core's recorded grades count: a client
 * can neither trigger nor suppress the offer.
 */

export interface GuidedReviewOffer {
  /** The skill to review: a course/topic key the Mentor's weak-skill session accepts. */
  skill_key: string;
  /** The topic's title in the lesson's locale, when Core knows it. */
  skill: string | null;
  /** Consecutive misses that produced the offer. */
  misses: number;
  /** The learner's own Mentor character, who makes the offer (Bible 02: the chosen character fills every Mentor slot). */
  character: 'rho' | 'zara' | 'liruf' | 'dina';
}

/** Leading misses in a most-recent-first list of outcomes (true = met). */
export function consecutiveMisses(outcomesNewestFirst: readonly boolean[]): number {
  let misses = 0;
  for (const met of outcomesNewestFirst) {
    if (met) break;
    misses += 1;
  }
  return misses;
}

export function guidedReviewFor(input: {
  outcomesNewestFirst: readonly boolean[]; skillKey: string; skill: string | null; character?: GuidedReviewOffer['character'];
}): GuidedReviewOffer | null {
  const misses = consecutiveMisses(input.outcomesNewestFirst);
  return offersGuidedReview(misses) ? { skill_key: input.skillKey, skill: input.skill, misses, character: input.character ?? 'rho' } : null;
}

const CHARACTERS = new Set(['rho', 'zara', 'liruf', 'dina']);

/** The learner's Mentor, read only when an offer is due. A failed read keeps the catalog default. */
export async function withLearnerMentor(offer: GuidedReviewOffer | null, userId: string): Promise<GuidedReviewOffer | null> {
  if (!offer) return null;
  const preferences = await getTutorPreferences(userId).catch(() => null);
  const character = preferences && CHARACTERS.has(preferences.character) ? preferences.character as GuidedReviewOffer['character'] : offer.character;
  return { ...offer, character };
}

const WINDOW = GUIDED_REVIEW_MAX_TRACKED + 1;
const VerdictRows = z.array(z.object({ verdict: z.object({ correct: z.boolean() }).passthrough() }));

/** The learner's latest v2 receipts across versions of the lessons teaching this topic. */
export async function recentV2Outcomes(userId: string, lessonIds: readonly string[]): Promise<boolean[] | null> {
  if (!z.uuid().safeParse(userId).success || lessonIds.length === 0 || lessonIds.some(id => !z.uuid().safeParse(id).success)) return null;
  const versions = z.array(z.object({ id: z.uuid() })).safeParse(await serviceRest<unknown>(
    `/lesson_document_versions?lesson_id=in.(${lessonIds.map(encodeURIComponent).join(',')})&schema_version=eq.2&select=id`,
  ));
  if (!versions.success) return null;
  if (versions.data.length === 0) return [];
  const rows = VerdictRows.safeParse(await serviceRest<unknown>(
    `/lesson_v2_grade_receipts?user_id=eq.${encodeURIComponent(userId)}&document_version_id=in.(${versions.data.map(row => row.id).join(',')})`
    + `&select=verdict&order=created_at.desc&limit=${WINDOW}`,
  ));
  return rows.success ? rows.data.map(row => row.verdict.correct) : null;
}

/** The topic's title for the lesson's locale, falling back like the rest of Core. */
export function localizedTitle(title: unknown, locale: string): string | null {
  if (typeof title === 'string') return title.length > 0 ? title.slice(0, 80) : null;
  if (typeof title !== 'object' || title === null) return null;
  const record = title as Record<string, unknown>;
  const text = record[locale] ?? record['es-MX'] ?? record['en-US'];
  return typeof text === 'string' && text.length > 0 ? text.slice(0, 80) : null;
}
