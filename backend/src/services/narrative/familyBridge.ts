import type { AgeScreenState } from '../ageScreen.js';

/*
 * B.13 (S05.3c) — the bridge from a simulated lesson to a real family action.
 *
 * THE MILESTONE. A learner completes (passes every lesson of) a topic that
 * teaches one of the bridge knowledge components below. "Your child just
 * learned about savings goals: create a real one together?" is the SPEC's own
 * example. The component comes from the shared B.6 graph
 * (topic_knowledge_components), so the same catalog covers every course and
 * every age pathway without naming a single topic.
 *
 * THE ACTIONS are the two Family Hub flows that already produce real records:
 *   savings_goal   a real savings goal in the child's wallet (savings_goals)
 *   earning_task   a real task the guardian assigns with a coin reward (tasks)
 *
 * THE AUDIENCE follows OD-3 and Option B, never a self-declared role:
 *   guardian  the learner has at least one VERIFIED guardian link. The prompt
 *             appears in that guardian's Family Hub; only a verified guardian
 *             can act on it (Core checks, and the database re-checks).
 *   self      an independent teen (13–17, screened, not a guest, not a
 *             protected under-13 origin, no kid role, no guardian). The prompt
 *             is self-directed: the teen commits to trying it for real. It
 *             never creates a task (tasks stay guardian-only, enforced by a
 *             database CHECK), and it creates no wallet record until the
 *             personal wallet of D.3 exists (S07).
 *   none      everyone else: adults learning for themselves, guests, a child
 *             whose guardian link is gone, an unscreened account. No prompt is
 *             stored for them.
 *
 * NOT A NAG (B.25). The database allows one prompt per learner per
 * component, one open prompt per action, a 30-day cooldown per action, and a
 * quiet 14-day expiry. Every prompt can be dismissed, and a dismissal is final
 * for that component. There is no counter, no badge and no reminder.
 *
 * The catalog is a proposal recorded in the sprint record for product review.
 */

export type BridgeAction = 'savings_goal' | 'earning_task';
export type BridgeAudience = 'guardian' | 'self';

/** Knowledge-component key → the family action that practises it for real. Ordered by priority within an action. */
export const BRIDGE_CATALOG: ReadonlyArray<{ kcKey: string; action: BridgeAction }> = [
  { kcKey: 'biz.saving-goal', action: 'savings_goal' },
  { kcKey: 'life.saving-for-later', action: 'savings_goal' },
  { kcKey: 'life.goal-planning', action: 'savings_goal' },
  { kcKey: 'money.savings-plan-math', action: 'savings_goal' },
  { kcKey: 'biz.value-of-work', action: 'earning_task' },
  { kcKey: 'life.effort-and-work', action: 'earning_task' },
  { kcKey: 'life.track-earnings', action: 'earning_task' },
];

export const BRIDGE_TTL_DAYS = 14;
export const BRIDGE_COOLDOWN_DAYS = 30;

/**
 * The candidates to offer for a completed topic, in the order the database
 * should try them: the topic's own components in its authored order (primary
 * first), each mapped through the catalog.
 */
export function bridgeCandidates(topicKcKeys: readonly string[]): Array<{ kc_key: string; action: BridgeAction }> {
  const out: Array<{ kc_key: string; action: BridgeAction }> = [];
  for (const key of topicKcKeys) {
    const entry = BRIDGE_CATALOG.find((e) => e.kcKey === key);
    if (entry && !out.some((c) => c.kc_key === key)) out.push({ kc_key: key, action: entry.action });
  }
  return out;
}

export interface BridgeAudienceInput {
  roles: readonly string[];
  isGuest: boolean;
  age: AgeScreenState;
  hasVerifiedGuardian: boolean;
}

/** Who a bridge prompt for this learner is addressed to, if anyone (see header). */
export function bridgeAudience(input: BridgeAudienceInput): BridgeAudience | null {
  if (input.hasVerifiedGuardian) return 'guardian';
  const independentTeen = !input.isGuest && !input.age.required && !input.age.protectedOrigin
    && input.age.ageBand === '13_to_17' && !input.roles.includes('kid');
  return independentTeen ? 'self' : null;
}

/** The newly completed topic, if this completion finished it: every lesson passed (or placement-credited) now, and not before. */
export function topicNewlyCompleted(
  before: ReadonlyArray<{ state: string; placementCredited: boolean }> | null,
  after: ReadonlyArray<{ state: string; placementCredited: boolean }> | null,
): boolean {
  const done = (lessons: ReadonlyArray<{ state: string; placementCredited: boolean }>) =>
    lessons.length > 0 && lessons.every((l) => l.state === 'passed' || l.placementCredited);
  return after !== null && done(after) && !(before !== null && done(before));
}
