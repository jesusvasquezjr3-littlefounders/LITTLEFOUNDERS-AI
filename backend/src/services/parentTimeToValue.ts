import { z } from 'zod';
import { deterministicEventId, getRolesForGate, insertLearningEvents, stampRole } from './insights.js';
import { serviceRest } from './supabaseRest.js';

/*
 * Appendix C 1.2 "Parent Time-to-Value" (B.10, B.23) for the C.24 dashboard
 * (GAP-FIX-R2 staff-ops; migration *_parent_time_to_value.sql).
 *
 * Two server-authored events, each at most ONCE per account (a deterministic
 * idempotency key; the unique index drops a repeat):
 *   - parent_signup_completed: the adult's identity verification made them a
 *     verified parent (routes/verification.ts);
 *   - parent_first_value: the first time that parent reads a linked child's
 *     progress, the territory or the weekly narrative (routes/family.ts,
 *     routes/familyLearning.ts). The route guard already required a verified
 *     link, so "a child is linked and the parent saw the first insight".
 * Both go through insertLearningEvents, which applies the consent gate every
 * event has (an adult only with self-managed analytics allowed, H.1). Fire and
 * forget: a failed write never fails the parent's request. A process-local set
 * skips the gate reads for an account already recorded here.
 */

export type ParentJourneyEvent = 'parent_signup_completed' | 'parent_first_value';

const recorded = new Set<string>();
const RECORDED_CAP = 20_000;

export function parentJourneyEventId(event: ParentJourneyEvent, userId: string): string {
  return deterministicEventId(`${event}:${userId}`);
}

/** Records the event once for this account (fire and forget; never throws). */
export function recordParentJourneyEvent(userId: string, event: ParentJourneyEvent): void {
  const key = `${event}:${userId}`;
  if (recorded.has(key)) return;
  void (async () => {
    const roles = await getRolesForGate(userId);
    if (!roles || !roles.includes('parent')) return;
    const accepted = await insertLearningEvents([{
      user_id: userId, role: stampRole(roles), event, route_class: 'family', client_event_id: parentJourneyEventId(event, userId),
    }]);
    // Remember only an answered write (inserted, a duplicate, or a consent drop): a failed one is retried next time.
    if (accepted !== null) {
      if (recorded.size >= RECORDED_CAP) recorded.clear();
      recorded.add(key);
    }
  })().catch(() => undefined);
}

/** Test seam: forget what this process recorded. */
export function resetParentJourneyCache(): void {
  recorded.clear();
}

// ── The dashboard's read ────────────────────────────────────────────────────

const count = z.coerce.number().int().nonnegative();
const seconds = z.coerce.number().nonnegative().nullable();
const Rows = z.array(z.object({ signups: count, reached: count, median_seconds: seconds, p75_seconds: seconds, within_target: count })).length(1);

export interface ParentTimeToValue { signups: number; reached: number; medianSeconds: number | null; p75Seconds: number | null; withinTarget: number }

/** parent_time_to_value over [since, until); null when the read failed. */
export async function readParentTimeToValue(since: Date, until: Date): Promise<ParentTimeToValue | null> {
  const rows = await serviceRest<unknown>('/rpc/parent_time_to_value', {
    method: 'POST', body: JSON.stringify({ p_since: since.toISOString(), p_until: until.toISOString() }),
  });
  const parsed = Rows.safeParse(rows);
  if (!parsed.success) return null;
  const r = parsed.data[0]!;
  return { signups: r.signups, reached: r.reached, medianSeconds: r.median_seconds, p75Seconds: r.p75_seconds, withinTarget: r.within_target };
}
