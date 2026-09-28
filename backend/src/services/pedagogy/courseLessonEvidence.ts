/*
 * GAP-FIX-R1 learning (owner review P-09, approved: "yes, for the topic's
 * primary skill only, as a new course_lesson evidence source"; B.6 "same
 * mastery model and review cards").
 *
 * A graded course lesson is evidence on the topic's primary knowledge
 * component. It goes through the Mentor's own `recordAttempt` (BKT update,
 * FSRS review, kc_attempt row with source 'course_lesson'), so the Mentor's
 * map and the course path read one mastery model.
 *
 * Idempotent per grade receipt: a v2 grade is keyed by its one-use attempt
 * nonce, a v1 completion by its run. A key already on file never moves the
 * posterior again (0206's partial unique index is the database backstop).
 * Best-effort like every pedagogy step: a failure here never fails a grade.
 */

import type { SegmentBase } from '../../lesson-contract/core/types.js';
import { getV2PriorFirstUnaidedStage, serviceRest } from '../supabaseRest.js';
import { topicTeaches } from '../narrative/narrativeData.js';
import { recordAttempt, type AttemptOutcome } from './recordAttempt.js';
import { getLearnerMastery } from './kcData.js';
import { cpaEntryStage, masteryFadeCount, type CpaStage } from '../v2SegmentFamilies.js';

const RECEIPT_KEY = /^(v1|v2):[A-Za-z0-9_:.-]{8,200}$/;

/** The receipt key for a v2 grade (its signed nonce) or a v1 completion (its run). */
export function courseReceiptKey(kind: 'v1' | 'v2', id: string): string | null {
  const key = `${kind}:${id}`;
  return RECEIPT_KEY.test(key) ? key : null;
}

export async function recordCourseLessonEvidence(input: {
  userId: string; topicId: string; receiptKey: string | null; score: number;
}): Promise<AttemptOutcome | 'duplicate' | null> {
  try {
    if (!input.receiptKey || !RECEIPT_KEY.test(input.receiptKey)) return null;
    const teaches = await topicTeaches([input.topicId]);
    // topicTeaches orders the primary link first; a topic with no teaching link records nothing.
    const primary = teaches?.get(input.topicId)?.[0];
    if (!primary) return null;
    const prior = await serviceRest<Array<{ id: string }>>(
      `/kc_attempt?user_id=eq.${encodeURIComponent(input.userId)}&receipt_key=eq.${encodeURIComponent(input.receiptKey)}&select=id&limit=1`,
    );
    if (prior === null) return null;
    if (prior.length > 0) return 'duplicate';
    const segment = { id: input.receiptKey, type: 'course_lesson', payload: {} } as unknown as SegmentBase;
    return await recordAttempt({
      userId: input.userId, sessionId: null, segmentId: null, kcId: primary.id, segment, submission: null,
      score: Math.max(0, Math.min(100, Math.round(input.score))), attemptNumber: 1, source: 'course_lesson', strategy: null,
      receiptKey: input.receiptKey,
    });
  } catch (error) {
    console.error('[pedagogy] course-lesson evidence threw', error);
    return null;
  }
}

/** The learner's posterior on the topic's primary KC; 0 without a row; null when a read fails (keep the authored fade). */
export async function topicPrimaryPKnown(userId: string, topicId: string): Promise<number | null> {
  const teaches = await topicTeaches([topicId]);
  const primary = teaches?.get(topicId)?.[0];
  if (!teaches) return null;
  if (!primary) return null;
  const mastery = await getLearnerMastery(userId);
  if (mastery === null) return null;
  return mastery.find((row) => row.kc_id === primary.id)?.p_known ?? 0;
}

/**
 * M9–M10 (GAP-FIX-R1): the delivered worked examples fade by the learner's
 * mastery of the topic's primary KC, chosen on Core. Presentation only: the
 * scorer grades the same response steps whatever the fade.
 */
/**
 * GAP-FIX-R2 (Appendix P Part 4.4): the entry stage of an M1 progression for
 * this learner, from the topic's primary-KC mastery and their last first
 * unaided stage on the same fading group. Concrete when either read fails:
 * scaffolding is the safe default, never a skipped representation.
 */
export async function cpaEntryFor(userId: string, topicId: string, fadingGroupId: string): Promise<CpaStage> {
  const [pKnown, prior] = await Promise.all([
    topicPrimaryPKnown(userId, topicId).catch(() => null),
    getV2PriorFirstUnaidedStage(userId, fadingGroupId).catch(() => null),
  ]);
  return cpaEntryStage(pKnown, prior);
}

export async function applyMasteryFade<T extends { segments?: unknown }>(document: T, userId: string, topicId: string): Promise<T> {
  const segments = Array.isArray(document.segments) ? document.segments as Array<Record<string, unknown>> : [];
  if (!segments.some((segment) => segment.type === 'math.worked-example.v2')) return document;
  const pKnown = await topicPrimaryPKnown(userId, topicId).catch(() => null);
  if (pKnown === null) return document;
  return { ...document, segments: segments.map((segment) => {
    if (segment.type !== 'math.worked-example.v2') return segment;
    const payload = segment.payload as { steps: unknown[] } & Record<string, unknown>;
    return { ...segment, payload: { ...payload, fade_count: masteryFadeCount(payload.steps.length, pKnown) } };
  }) };
}
