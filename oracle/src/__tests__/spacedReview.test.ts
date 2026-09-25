import { describe, expect, it } from 'vitest';
import {
  EMPTY_SPACED_REVIEW,
  reviewLeadInstruction,
  reviewResultInstruction,
  routeWrongAnswer,
  SPACED_REVIEW_THRESHOLDS,
  SpacedReviewRouter,
  SpacedReviewSnapshotSchema,
  strictestSpacedReviewMode,
  type ObserveInput,
  type RoutingInput,
} from '../tutor/spacedReview.js';
import { PedagogicalController, REVIEW_OPEN_TURNS } from '../tutor/controller.js';
import type { KcState, SessionPlanEntry } from '../core/client.js';

/*
 * C.11: the two-tier spaced-review router (Appendix D §2.4) and the
 * controller's in-session review detour. The rule is pure; the router is a
 * running count; the detour answers exactly one graded item.
 */

const T = SPACED_REVIEW_THRESHOLDS;
const ROOMY: RoutingInput = {
  planned: true,
  pBefore: 0.8,
  turnsRemaining: 60,
  msUntilWrap: 10 * 60_000,
  budgetState: 'running',
  reexposures: 0,
  queued: 0,
};

describe('routeWrongAnswer — the explicit decision rule', () => {
  it('keeps a near-threshold miss in-session when the budget allows', () => {
    expect(routeWrongAnswer(ROOMY)).toEqual({ tier: 'within_session', reason: 'near_threshold' });
    expect(routeWrongAnswer({ ...ROOMY, pBefore: T.nearThresholdFloor })).toEqual({ tier: 'within_session', reason: 'near_threshold' });
    // Above the mastery bar is "close" too: a slip or a forgetting on a KC they had.
    expect(routeWrongAnswer({ ...ROOMY, pBefore: 0.97 }).tier).toBe('within_session');
  });

  it('hands everything else to the cross-session scheduler, with the first reason that applies', () => {
    expect(routeWrongAnswer({ ...ROOMY, planned: false }).reason).toBe('no_plan_entry');
    expect(routeWrongAnswer({ ...ROOMY, budgetState: 'wrapping' }).reason).toBe('wrapping');
    expect(routeWrongAnswer({ ...ROOMY, budgetState: 'ended' }).reason).toBe('wrapping');
    expect(routeWrongAnswer({ ...ROOMY, msUntilWrap: T.minMsUntilWrap - 1 }).reason).toBe('time_budget');
    expect(routeWrongAnswer({ ...ROOMY, turnsRemaining: T.minTurnsRemaining - 1 }).reason).toBe('turn_budget');
    expect(routeWrongAnswer({ ...ROOMY, reexposures: T.maxReexposuresPerKc }).reason).toBe('reexposure_cap');
    expect(routeWrongAnswer({ ...ROOMY, pBefore: T.nearThresholdFloor - 0.001 }).reason).toBe('far_from_threshold');
    expect(routeWrongAnswer({ ...ROOMY, queued: T.maxQueued }).reason).toBe('queue_full');
    for (const input of [
      { ...ROOMY, planned: false },
      { ...ROOMY, budgetState: 'wrapping' as const },
      { ...ROOMY, msUntilWrap: 0 },
      { ...ROOMY, turnsRemaining: 0 },
      { ...ROOMY, pBefore: 0.1 },
    ]) {
      expect(routeWrongAnswer(input).tier).toBe('cross_session');
    }
  });

  it('the budget outranks proximity: a near-threshold miss in the last minutes is never crammed', () => {
    expect(routeWrongAnswer({ ...ROOMY, pBefore: 0.9, msUntilWrap: 2 * 60_000 })).toEqual({ tier: 'cross_session', reason: 'time_budget' });
    expect(routeWrongAnswer({ ...ROOMY, pBefore: 0.9, turnsRemaining: 3 })).toEqual({ tier: 'cross_session', reason: 'turn_budget' });
  });

  it('the stricter mode wins, and Core can never lift an operator off', () => {
    expect(strictestSpacedReviewMode('act', 'act')).toBe('act');
    expect(strictestSpacedReviewMode('act', 'shadow')).toBe('shadow');
    expect(strictestSpacedReviewMode('shadow', 'act')).toBe('shadow');
    expect(strictestSpacedReviewMode('off', 'act')).toBe('off');
  });
});

const miss = (kcId: string, extra: Partial<ObserveInput> = {}): ObserveInput => ({
  kcId,
  planned: true,
  correct: false,
  pBefore: 0.8,
  pAfter: 0.45,
  turnsRemaining: 60,
  msUntilWrap: 10 * 60_000,
  budgetState: 'running',
  fromDetour: false,
  ...extra,
});
const hit = (kcId: string, extra: Partial<ObserveInput> = {}): ObserveInput => miss(kcId, { correct: true, pAfter: 0.9, ...extra });
const turns = (router: SpacedReviewRouter, n: number) => {
  for (let i = 0; i < n; i += 1) router.noteLearnerTurn();
};

describe('SpacedReviewRouter — the within-session running count', () => {
  it('queues a near-threshold miss, ignores massed answers, and retires after spaced successes outnumber the misses', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    expect(router.observe(miss('kc-a'))).toBe('routed_within');
    expect(router.queuedKcIds).toEqual(['kc-a']);
    // Inside the gap: massed practice, not counted.
    turns(router, 1);
    expect(router.observe(hit('kc-a'))).toBeNull();
    turns(router, T.reexposureGapTurns);
    expect(router.observe(hit('kc-a'))).toBe('counted'); // 1 success − 1 failure = 0
    turns(router, T.reexposureGapTurns);
    expect(router.observe(hit('kc-a'))).toBe('retired'); // 2 − 1 = 1
    expect(router.queuedKcIds).toEqual([]);
    const [decision] = router.report().decisions;
    expect(decision).toMatchObject({ tier: 'within_session', reason: 'near_threshold', source: 'first_miss', outcome: 'retired', successes: 2, failures: 1 });
  });

  it('a spaced miss re-runs the rule; the earlier decision reads rerouted', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    turns(router, T.reexposureGapTurns);
    expect(router.observe(miss('kc-a'))).toBe('routed_within');
    const report = router.report();
    expect(report.decisions.map((d) => [d.source, d.outcome])).toEqual([
      ['first_miss', 'rerouted'],
      ['reexposure_miss', 'session_ended'],
    ]);
    expect(report.decisions[1]).toMatchObject({ reexposuresBefore: 1, failures: 2 });
  });

  it('a spaced miss with the budget gone hands the KC off instead of cramming it', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    turns(router, T.reexposureGapTurns);
    expect(router.observe(miss('kc-a', { msUntilWrap: 60_000 }))).toBe('routed_cross');
    expect(router.queuedKcIds).toEqual([]);
    expect(router.report().decisions.at(-1)).toMatchObject({ tier: 'cross_session', reason: 'time_budget', outcome: 'handed_off' });
    // The scheduler owns it now: later answers on it are not routed again.
    turns(router, 5);
    expect(router.observe(miss('kc-a'))).toBeNull();
    expect(router.report().decisions).toHaveLength(2);
  });

  it('caps re-exposures per KC: the next spaced miss after the cap is handed off', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    for (let i = 0; i < T.maxReexposuresPerKc - 1; i += 1) {
      turns(router, T.reexposureGapTurns);
      expect(router.observe(miss('kc-a'))).toBe('routed_within');
    }
    turns(router, T.reexposureGapTurns);
    expect(router.observe(miss('kc-a'))).toBe('routed_cross');
    expect(router.report().decisions.at(-1)).toMatchObject({ reason: 'reexposure_cap', outcome: 'handed_off' });
  });

  it('routes a far-below-threshold miss, an unplanned KC and a queue overflow cross-session', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    expect(router.observe(miss('kc-low', { pBefore: 0.2 }))).toBe('routed_cross');
    expect(router.observe(miss('kc-probe', { planned: false }))).toBe('routed_cross');
    for (const kc of ['kc-1', 'kc-2', 'kc-3']) expect(router.observe(miss(kc))).toBe('routed_within');
    expect(router.observe(miss('kc-4'))).toBe('routed_cross');
    expect(router.report().decisions.map((d) => d.reason)).toEqual([
      'far_from_threshold',
      'no_plan_entry',
      'near_threshold',
      'near_threshold',
      'near_threshold',
      'queue_full',
    ]);
    expect(router.queuedKcIds).toHaveLength(T.maxQueued);
  });

  it('a first correct answer creates no decision', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    expect(router.observe(hit('kc-a'))).toBeNull();
    expect(router.report().decisions).toEqual([]);
  });

  it('dueKcId: only in act, only while running, after the gap, never the active KC or an open detour, most overdue first', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    turns(router, 1);
    router.observe(miss('kc-b'));
    expect(router.dueKcId(null, 'running')).toBeNull(); // gap not elapsed
    turns(router, T.reexposureGapTurns);
    expect(router.dueKcId(null, 'running')).toBe('kc-a');
    expect(router.dueKcId('kc-a', 'running')).toBe('kc-b');
    expect(router.dueKcId(null, 'wrapping')).toBeNull();
    router.noteDetourOpened('kc-a');
    expect(router.dueKcId(null, 'running')).toBe('kc-b');
    expect(router.report().detoursOpened).toBe(1);
  });

  it('an abandoned detour hands the KC off; its decision reads abandoned', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    turns(router, T.reexposureGapTurns);
    router.noteDetourOpened('kc-a');
    router.noteDetourAbandoned('kc-a');
    expect(router.queuedKcIds).toEqual([]);
    expect(router.report().decisions[0]!.outcome).toBe('abandoned');
    expect(router.observe(miss('kc-a'))).toBeNull();
  });

  it('shadow records every decision and never opens a detour; off records nothing', () => {
    const shadow = new SpacedReviewRouter('shadow');
    turns(shadow, 1);
    expect(shadow.observe(miss('kc-a'))).toBe('routed_within');
    turns(shadow, T.reexposureGapTurns);
    expect(shadow.dueKcId(null, 'running')).toBeNull();
    expect(shadow.report()).toMatchObject({ mode: 'shadow', decisions: [expect.objectContaining({ tier: 'within_session' })] });
    const off = new SpacedReviewRouter('off');
    off.noteLearnerTurn();
    expect(off.observe(miss('kc-a'))).toBeNull();
    expect(off.report().decisions).toEqual([]);
    expect(off.report().learnerTurns).toBe(0);
  });

  it('itemises at most maxDecisions and counts the rest', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    for (let i = 0; i < T.maxDecisions + 5; i += 1) router.observe(miss(`kc-${i}`, { pBefore: 0.1 }));
    const report = router.report();
    expect(report.decisions).toHaveLength(T.maxDecisions);
    expect(report.overflow).toBe(5);
  });

  it('survives a snapshot round trip byte for byte, and the empty snapshot parses', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 2);
    router.observe(miss('kc-a'));
    router.observe(miss('kc-b', { pBefore: 0.1 }));
    turns(router, T.reexposureGapTurns);
    router.noteDetourOpened('kc-a');
    const snapshot = SpacedReviewSnapshotSchema.parse(JSON.parse(JSON.stringify(router.snapshot())));
    const restored = new SpacedReviewRouter('act');
    restored.restore(snapshot);
    expect(restored.snapshot()).toEqual(router.snapshot());
    expect(restored.report()).toEqual(router.report());
    expect(SpacedReviewSnapshotSchema.parse(EMPTY_SPACED_REVIEW)).toEqual(EMPTY_SPACED_REVIEW);
  });

  it('the record carries ids, labels and numbers only', () => {
    const router = new SpacedReviewRouter('act');
    turns(router, 1);
    router.observe(miss('kc-a'));
    const text = JSON.stringify(router.report());
    expect(text).not.toMatch(/user|nickname|text|say|emotion|frustrat|bored/i);
  });

  it('the review instructions name the objective and never frame the re-check as a test of a mistake', () => {
    expect(reviewLeadInstruction('Give change by counting up.')).toMatch(/Give change by counting up\./);
    expect(reviewLeadInstruction('x')).toMatch(/never as a memory test/);
    expect(reviewResultInstruction(true, 'x')).toMatch(/got it right/);
    expect(reviewResultInstruction(false, 'x')).toMatch(/do NOT drill it now/);
  });
});

// ── the controller's review detour ──────────────────────────────────────────

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const entry = (kcId: string, pKnown: number, extra: Partial<SessionPlanEntry> = {}): SessionPlanEntry => ({
  kcId,
  kcKey: `money.${kcId.slice(0, 4)}`,
  skillKey: `skill-${kcId.slice(0, 4)}`,
  reason: 'frontier',
  pKnown,
  targetDifficulty: 3,
  objective: `Objective ${kcId.slice(0, 4)}`,
  prereqKcIds: [],
  misconceptions: [],
  ...extra,
});
const states = (...ids: string[]): KcState[] => ids.map((kcId) => ({ kcId, kcKey: `money.${kcId.slice(0, 4)}`, pKnown: 0.9, attempts: 3 }));
const result = (correct: boolean) => ({ kind: 'activity_result' as const, correct, misconceptionCode: null, attemptNumber: 1, latencyMs: null });

/** Masters A (two corroborated correct answers) so the plan moves on to B. */
function pastA(): PedagogicalController {
  const controller = new PedagogicalController([entry(A, 0.9), entry(B, 0.4, { targetDifficulty: 2 })], states(A));
  let now = 0;
  controller.decide(result(true), (now += 30_000));
  const second = controller.decide(result(true), (now += 30_000));
  expect(second.strategy).toBe('CELEBRATE');
  expect(controller.activeKcId).toBe(B);
  return controller;
}

describe('PedagogicalController — the in-session review detour', () => {
  it('opens for a planned KC the plan already moved past; the active entry becomes that KC as a review', () => {
    const controller = pastA();
    expect(controller.openInSessionReview(A, 200_000)).toBe(true);
    expect(controller.inSessionReviewKcId).toBe(A);
    expect(controller.activeKcId).toBe(A);
    expect(controller.activeSkillKey).toBe(`skill-${A.slice(0, 4)}`);
    expect(controller.currentStrategy).toBe('SPACED');
    expect(controller.state()?.mode).toBe('review');
    expect(controller.targetDifficulty).toBe(3);
    // The plan pointer did not move.
    expect(controller.kcProgress).toEqual({ index: 2, of: 2 });
  });

  it('refuses: the KC being taught now, an unplanned KC, an open detour, and during a probe or a repair', () => {
    const controller = pastA();
    expect(controller.openInSessionReview(B, 1)).toBe(false); // B is the active entry
    expect(controller.openInSessionReview('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 1)).toBe(false);
    expect(controller.openInSessionReview(A, 1)).toBe(true);
    expect(controller.openInSessionReview(A, 1)).toBe(false);
    const repairing = pastA();
    repairing.restore({ ...repairing.snapshot(), strategy: 'REMEDIATE' });
    expect(repairing.openInSessionReview(A, 1)).toBe(false);
    const probing = pastA();
    probing.restore({ ...probing.snapshot(), probingKcId: A, probeReturnIndex: 1 });
    expect(probing.openInSessionReview(A, 1)).toBe(false);
  });

  it('a correct re-check closes the detour with a short FLUENCY beat — no celebration, no advance', () => {
    const controller = pastA();
    controller.openInSessionReview(A, 200_000);
    const decision = controller.decide(result(true), 260_000);
    expect(decision.strategy).toBe('FLUENCY');
    expect(decision.kcId).toBe(A);
    expect(decision.review).toEqual({ kcId: A, objective: `Objective ${A.slice(0, 4)}`, outcome: 'correct' });
    expect(decision.pKnownBefore).not.toBeNull();
    expect(controller.inSessionReviewKcId).toBeNull();
    expect(controller.activeKcId).toBe(B);
    expect(controller.kcProgress).toEqual({ index: 2, of: 2 });
  });

  it('a wrong re-check of a celebrated KC revokes its mastery (the demotion rule) and gets ONE worked example', () => {
    const controller = pastA();
    controller.openInSessionReview(A, 200_000);
    const decision = controller.decide(result(false), 260_000);
    expect(decision.strategy).toBe('WORKED');
    expect(decision.masteryRevoked).toBe(true);
    expect(controller.revokedMasteryKcIds).toContain(A);
    expect(decision.review?.outcome).toBe('wrong');
    expect(decision.misconceptionCode).toBeNull();
    expect(controller.activeKcId).toBe(B);
  });

  it('a detour the learner talks past is abandoned after REVIEW_OPEN_TURNS turns', () => {
    const controller = pastA();
    controller.openInSessionReview(A, 200_000);
    for (let i = 1; i < REVIEW_OPEN_TURNS; i += 1) {
      expect(controller.decide({ kind: 'conversation_turn' }, 200_000 + i * 30_000).review).toBeNull();
      expect(controller.inSessionReviewKcId).toBe(A);
    }
    const closing = controller.decide({ kind: 'conversation_turn' }, 400_000);
    expect(closing.review).toMatchObject({ kcId: A, outcome: 'abandoned' });
    expect(controller.inSessionReviewKcId).toBeNull();
    expect(closing.kcId).toBe(B);
  });

  it('keeps the controller active for a re-check after the whole plan completed', () => {
    const controller = new PedagogicalController([entry(A, 0.9)], states(A));
    controller.decide(result(true), 30_000);
    controller.decide(result(true), 60_000);
    expect(controller.active).toBe(false);
    expect(controller.openInSessionReview(A, 90_000)).toBe(true);
    expect(controller.active).toBe(true);
    controller.decide(result(true), 120_000);
    expect(controller.active).toBe(false);
  });

  it('the detour rides the park snapshot', () => {
    const controller = pastA();
    controller.openInSessionReview(A, 200_000);
    const restored = new PedagogicalController([entry(A, 0.9), entry(B, 0.4, { targetDifficulty: 2 })], states(A));
    restored.restore(JSON.parse(JSON.stringify(controller.snapshot())));
    expect(restored.inSessionReviewKcId).toBe(A);
    expect(restored.snapshot()).toEqual(controller.snapshot());
  });
});
