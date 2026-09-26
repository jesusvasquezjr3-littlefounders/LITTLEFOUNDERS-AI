import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE, type Refusal } from './familyLifecycle.js';

/*
 * S07.7 — D.23: coaching for the Tutor, not only controls.
 *
 *   The reflective prompt. Before a Tutor's yes or "not yet" is sent, the
 *   rebuilt decision surface asks what they would tell the child (Appendix G
 *   §4.2), prior to and separate from the reason the child reads (D.18). Every
 *   Tutor decision route requires `reflection` and Core records it right after
 *   the decision: 'written' (kept private in the Tutor's browser), 'shared'
 *   (sent as the note) or 'skipped'. The text itself never reaches Core.
 *
 *   The monthly tip. Tips are written from Appendix G's findings; each is
 *   delivered only after the Pedagogical Lead's review, recorded in
 *   docs/operations/parent-coaching-tips.json with a hash of the exact copy in
 *   all three locales. agent/tools/check-parent-coaching-tips.mjs fails when
 *   this list and the registry disagree, when a reviewed tip's copy changed
 *   after its review, or when a tip cites no Appendix G section. Until a tip
 *   is reviewed it is never passed to the database, so it can never be sent.
 */

export const REFLECTIONS = ['written', 'shared', 'skipped'] as const;
export type Reflection = (typeof REFLECTIONS)[number];
/** The database matches a reflection to the Tutor's decision made within this many minutes. */
export const COACHING_REFLECTION_WINDOW_MINUTES = 10;

export interface CoachingTip { id: string; appendixG: readonly string[]; reviewed: boolean }

/** Mirrors docs/operations/parent-coaching-tips.json, in delivery order. */
export const COACHING_TIPS: readonly CoachingTip[] = [
  { id: 'contribution-vs-bonus', appendixG: ['1.2'], reviewed: false },
  { id: 'price-by-effort', appendixG: ['1.2', '2.4'], reviewed: false },
  { id: 'keep-promises', appendixG: ['1.3'], reviewed: false },
  { id: 'explain-the-no', appendixG: ['4.5'], reviewed: false },
  { id: 'ask-their-view', appendixG: ['4.2'], reviewed: false },
  { id: 'money-talk-at-home', appendixG: ['1.1'], reviewed: false },
  { id: 'after-a-goal', appendixG: ['2.3'], reviewed: false },
  { id: 'limits-with-reasons', appendixG: ['2.5', '4.1'], reviewed: false },
  { id: 'grow-their-say', appendixG: ['4.3'], reviewed: false },
  { id: 'spending-is-not-failing', appendixG: ['1.3'], reviewed: false },
  { id: 'share-for-real', appendixG: ['1.4'], reviewed: false },
  { id: 'bonus-is-not-interest', appendixG: ['2.4', '3.5'], reviewed: false },
];

export function reviewedTipIds(tips: readonly CoachingTip[] = COACHING_TIPS): string[] {
  return tips.filter((t) => t.reviewed).map((t) => t.id);
}

const Delivery = z.object({
  id: z.string().uuid(), tip_id: z.string(), period: z.string().regex(/^\d{4}-\d{2}-01$/), delivered_at: z.string(),
  opened_at: z.string().nullable(), dismissed_at: z.string().nullable(),
}).strict();
export type DeliveryRow = z.infer<typeof Delivery>;

export interface WireTip { deliveryId: string; tipId: string; period: string; opened: boolean; dismissed: boolean }

export function toWireTip(row: DeliveryRow): WireTip {
  return { deliveryId: row.id, tipId: row.tip_id, period: row.period.slice(0, 7), opened: row.opened_at !== null, dismissed: row.dismissed_at !== null };
}

/** This month's tip for the Tutor (recording its delivery), or null when no reviewed tip exists. */
export function deliverTip(tutorId: string, tips: readonly string[] = reviewedTipIds()): Promise<DeliveryRow | null | Refusal | typeof UNAVAILABLE> {
  return rpc('parent_coaching_deliver', { p_tutor: tutorId, p_tips: tips }, Delivery.nullable());
}

export function markTip(deliveryId: string, tutorId: string, action: 'opened' | 'dismissed') {
  return rpc('parent_coaching_mark', { p_delivery: deliveryId, p_tutor: tutorId, p_action: action }, Delivery);
}

/**
 * Best-effort, after the decision is recorded: the decision stands either
 * way, and a missing record shows up in the reflection rate as a prompt that
 * did not fire, which is exactly what the metric is for.
 */
export async function recordReflection(tutorId: string, subject: 'task' | 'redemption' | 'level_request', subjectId: string, reflection: Reflection): Promise<boolean> {
  const result = await rpc('record_decision_reflection', { p_actor: tutorId, p_subject: subject, p_subject_id: subjectId, p_reflection: reflection }, z.string().uuid());
  if (result === UNAVAILABLE || isRefusal(result)) {
    console.error(`[parent-coaching] reflection not recorded for a ${subject} decision: ${isRefusal(result) ? result.refused : 'unavailable'}`);
    return false;
  }
  return true;
}

const Int = z.union([z.number(), z.string().regex(/^-?\d+$/)]).transform((v) => Number(v)).pipe(z.number().int().nonnegative());

/** Appendix H: Parent-Coaching-Tip Delivery & Engagement Rate for one month. */
export async function readCoachingDelivery(period: string) {
  const rows = await rpc('parent_coaching_delivery_rate', { p_period: `${period}-01` }, z.array(z.object({
    period: z.string(), eligible: Int, delivered: Int, opened: Int, dismissed: Int,
  }).strict()).length(1));
  if (rows === UNAVAILABLE || isRefusal(rows)) return null;
  const r = rows[0]!;
  return {
    period,
    eligible: r.eligible,
    delivered: r.delivered,
    opened: r.opened,
    dismissed: r.dismissed,
    // No rate for an empty month: zero eligible Tutors is not 100%.
    deliveryRate: r.eligible > 0 ? r.delivered / r.eligible : null,
    openRate: r.delivered > 0 ? r.opened / r.delivered : null,
    reviewedTips: reviewedTipIds().length,
    draftedTips: COACHING_TIPS.length,
  };
}

/** The reflective prompt fired on every Tutor decision (with_reflection / tutor_decisions). */
export async function readReflectionRate(since: Date) {
  const rows = await rpc('parent_coaching_reflection_rate', { p_since: since.toISOString() }, z.array(z.object({
    tutor_decisions: Int, with_reflection: Int, written: Int, shared: Int, skipped: Int,
  }).strict()).length(1));
  if (rows === UNAVAILABLE || isRefusal(rows)) return null;
  const r = rows[0]!;
  return {
    since: since.toISOString(),
    tutorDecisions: r.tutor_decisions,
    withReflection: r.with_reflection,
    written: r.written,
    shared: r.shared,
    skipped: r.skipped,
    firedRate: r.tutor_decisions > 0 ? r.with_reflection / r.tutor_decisions : null,
  };
}
