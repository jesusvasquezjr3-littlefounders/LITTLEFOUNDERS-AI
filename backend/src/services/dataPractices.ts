import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './supabaseRest.js';

/*
 * Parental consent carries over only for the
 * practices it covered. Every data practice the rebuild introduced is listed
 * in public.data_practices; a migrated child (marked by the consent step
 * at the cutover) is subject to one only with a fresh, specific consent. The
 * database decides everything: who may say yes (a verified Tutor; a
 * self-registered 13-17 with no Tutor for the analytics classes only), whether
 * a consent still counts, and whether a practice applies. Triggers at the
 * tables enforce it for Core and Oracle alike; Core also asks before a write
 * that carries no child identifier. Core passes the caller as actor, never a
 * body field, and maps each named refusal. A failed read is never a yes.
 */

/**
 * The same question when the caller must tell a clear no apart from an
 * unreadable answer (to name the refusal): true or false only when the
 * database answered, null otherwise.
 */
export async function readDataPracticeApplies(subjectId: string, practice: string): Promise<boolean | null> {
  const answer = await rpc('data_practice_applies', { p_subject: subjectId, p_practice: practice }, z.boolean());
  return answer === UNAVAILABLE || isRefusal(answer) ? null : answer;
}
