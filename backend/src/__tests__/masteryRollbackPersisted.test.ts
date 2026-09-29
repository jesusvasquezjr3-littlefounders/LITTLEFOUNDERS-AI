import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Appendix F Part 3 Stage 7 (C.10), the PERSISTED side of the Extended Mastery
 * Engine rollback (GAP-FIX-R4, F4-mentor-finish). The SPEC's response is
 * "revert to single-observation BKT thresholds for affected knowledge
 * components". Oracle's controller already did so for the live declaration;
 * Core's learning map, the session planner's frontier and the parent's mastery
 * evidence still demanded the C.10 corroboration for the same KC, so a KC the
 * session declared mastered stayed "in progress" everywhere else. These tests
 * pin the shared rule, the read-only key accessor (never trips, never writes,
 * a failed read keeps the stricter rule) and each of the three builders.
 */

const rest = vi.hoisted(() => ({
  serviceRest: vi.fn<(path: string) => Promise<unknown>>(),
  insertAuditLog: vi.fn<(actor: string | null, action: string, subject: string, detail: Record<string, unknown>) => Promise<boolean>>(),
}));
vi.mock('../services/supabaseRest.js', () => rest);

const { corroborationMinFor, MASTERY_CORROBORATION_MIN, MASTERY_ROLLBACK_CORROBORATION_MIN } = await import(
  '../services/pedagogy/bkt.js'
);
const { deriveNodeState, buildTutorMap } = await import('../services/pedagogy/tutorMap.js');
const { rankPlanKcs, buildSessionPlan } = await import('../services/pedagogy/sessionPlan.js');
const { displayStateOf, buildMasteryEvidence } = await import('../services/pedagogy/masteryEvidence.js');
const {
  getMasteryRollbackKcKeys,
  MASTERY_KILL_SWITCH_RESOLVED,
  MASTERY_KILL_SWITCH_TRIGGERED,
  resetMasteryKillSwitchCache,
} = await import('../services/pedagogy/mentorIntegrity.js');

const NOW = new Date('2026-09-29T12:00:00Z');
const USER = '22222222-2222-4222-8222-222222222222';
const KC_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  key: 'money.coins.count',
  strand: 'money_math' as const,
  title: { 'en-US': 'Counting coins' },
  objective: { 'en-US': 'Count coins' },
  tier_min: 1,
  p_l0: 0.3,
  p_t: 0.2,
  p_g: 0.2,
  p_s: 0.1,
  skill_key: null,
};
const KC_B = { ...KC_A, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', key: 'ent.price.set', title: { 'en-US': 'Setting a price' } };

/** Both KCs above the mastery bar, each with ONE correct answer at the end of its ledger. */
const MASTERY = [KC_A, KC_B].map((kc) => ({ kc_id: kc.id, p_known: 0.9, attempts: 4, correct: 3, params_override: null }));
const ATTEMPTS = [
  { kc_id: KC_A.id, correct: true },
  { kc_id: KC_B.id, correct: true },
  { kc_id: KC_A.id, correct: false },
  { kc_id: KC_B.id, correct: false },
];

const trigger = (keys: string[], at = '2026-09-28T10:00:00Z') => ({
  action: MASTERY_KILL_SWITCH_TRIGGERED,
  created_at: at,
  detail: { kcKeys: keys, causes: ['reversal_above_ceiling'] },
});
const resolution = (at: string) => ({ action: MASTERY_KILL_SWITCH_RESOLVED, created_at: at, detail: { note: 'root-caused' } });

function routeRest(audit: unknown[] | null) {
  rest.serviceRest.mockImplementation(async (path: string) => {
    if (path.startsWith('/audit_logs')) return audit;
    if (path.startsWith('/kc?')) return [KC_A, KC_B];
    if (path.startsWith('/kc_edge')) return [];
    if (path.startsWith('/learner_kc_mastery')) return MASTERY;
    if (path.startsWith('/memory_card')) return [];
    if (path.startsWith('/kc_attempt')) return ATTEMPTS;
    if (path.startsWith('/misconception')) return [];
    if (path.startsWith('/tutor_trajectory_step')) return [];
    return [];
  });
}

const auditReads = () => rest.serviceRest.mock.calls.filter(([p]) => p.startsWith('/audit_logs')).length;

beforeEach(() => {
  rest.serviceRest.mockReset();
  rest.insertAuditLog.mockReset();
  rest.insertAuditLog.mockResolvedValue(true);
  resetMasteryKillSwitchCache();
});

describe('the shared rule — corroborationMinFor', () => {
  it('is the C.10 rule by default and the single-observation baseline only for a rolled-back KC', () => {
    const rolled = new Set(['money.coins.count']);
    expect(MASTERY_ROLLBACK_CORROBORATION_MIN).toBe(1);
    expect(corroborationMinFor('money.coins.count', rolled)).toBe(1);
    expect(corroborationMinFor('ent.price.set', rolled)).toBe(MASTERY_CORROBORATION_MIN);
    expect(corroborationMinFor('money.coins.count')).toBe(MASTERY_CORROBORATION_MIN);
    expect(corroborationMinFor(undefined, rolled)).toBe(MASTERY_CORROBORATION_MIN);
  });

  it('the map state: one correct answer is mastered only under the rollback; a last answer wrong never is', () => {
    const base = { pKnown: 0.9, attempts: 4, reviewDue: false, prereqsMet: true };
    expect(deriveNodeState({ ...base, consecutiveCorrect: 1 })).toBe('in_progress');
    expect(deriveNodeState({ ...base, consecutiveCorrect: 1, corroborationMin: 1 })).toBe('mastered');
    expect(deriveNodeState({ ...base, consecutiveCorrect: 0, corroborationMin: 1 })).toBe('in_progress');
    // The rollback lowers only the corroboration: the posterior and evidence bars stay.
    expect(deriveNodeState({ ...base, pKnown: 0.7, consecutiveCorrect: 1, corroborationMin: 1 })).toBe('in_progress');
    expect(deriveNodeState({ ...base, attempts: 2, consecutiveCorrect: 1, corroborationMin: 1 })).toBe('in_progress');
    expect(displayStateOf({ pKnown: 0.9, attempts: 4, reviewDue: false, consecutiveCorrect: 1, corroborationMin: 1 })).toBe(
      'provisional_mastered',
    );
    expect(displayStateOf({ pKnown: 0.9, attempts: 4, reviewDue: false, consecutiveCorrect: 1 })).toBe('not_yet');
  });

  it('the planner: a rolled-back KC on one correct answer leaves the frontier; the other KC stays on it', () => {
    const streaks = new Map([
      [KC_A.id, 1],
      [KC_B.id, 1],
    ]);
    const without = rankPlanKcs([KC_A, KC_B], [], MASTERY, [], 3, streaks).map((p) => p.kc.key);
    expect(without.sort()).toEqual(['ent.price.set', 'money.coins.count']);
    const withRollback = rankPlanKcs([KC_A, KC_B], [], MASTERY, [], 3, streaks, new Set(['money.coins.count'])).map((p) => p.kc.key);
    expect(withRollback).toEqual(['ent.price.set']);
  });
});

describe('getMasteryRollbackKcKeys — read-only, never trips', () => {
  it('returns the kc keys of the trip in force, and writes nothing', async () => {
    routeRest([trigger(['money.coins.count'])]);
    expect([...(await getMasteryRollbackKcKeys(NOW))]).toEqual(['money.coins.count']);
    expect(rest.insertAuditLog).not.toHaveBeenCalled();
    // It never reads the trajectory: it does not evaluate the condition.
    expect(rest.serviceRest.mock.calls.some(([p]) => p.startsWith('/tutor_trajectory_step'))).toBe(false);
  });

  it('a resolved trip rolls nothing back', async () => {
    routeRest([trigger(['money.coins.count']), resolution('2026-09-28T12:00:00Z')]);
    expect([...(await getMasteryRollbackKcKeys(NOW))]).toEqual([]);
  });

  it('a failed read keeps the stricter C.10 rule (§1.14) and is not cached', async () => {
    routeRest(null);
    expect([...(await getMasteryRollbackKcKeys(NOW))]).toEqual([]);
    routeRest([trigger(['money.coins.count'])]);
    expect([...(await getMasteryRollbackKcKeys(NOW))]).toEqual(['money.coins.count']);
  });

  it('caches a successful read per process', async () => {
    routeRest([trigger(['money.coins.count'])]);
    await getMasteryRollbackKcKeys(NOW);
    await getMasteryRollbackKcKeys(new Date(NOW.getTime() + 60_000));
    expect(auditReads()).toBe(1);
  });
});

describe('the three persisted-side readers apply the rollback', () => {
  it('the learning map shows a rolled-back KC mastered on one correct answer; the other KC stays in progress', async () => {
    routeRest([trigger(['money.coins.count'])]);
    const map = await buildTutorMap(USER, 3, 'en-US', NOW);
    const state = Object.fromEntries((map?.nodes ?? []).map((n) => [n.kcKey, n.state]));
    expect(state).toEqual({ 'money.coins.count': 'mastered', 'ent.price.set': 'in_progress' });
    expect(rest.insertAuditLog).not.toHaveBeenCalled();
  });

  it('the learning map keeps the C.10 rule when the kill-switch read fails', async () => {
    routeRest(null);
    const map = await buildTutorMap(USER, 3, 'en-US', NOW);
    expect(map).not.toBeNull();
    expect(map!.nodes.every((n) => n.state === 'in_progress')).toBe(true);
  });

  it("the parent's mastery evidence agrees with the map", async () => {
    routeRest([trigger(['money.coins.count'])]);
    const evidence = await buildMasteryEvidence(USER, 'en-US', NOW);
    const state = Object.fromEntries((evidence?.items ?? []).map((i) => [i.kcKey, i.state]));
    expect(state).toEqual({ 'money.coins.count': 'provisional_mastered', 'ent.price.set': 'not_yet' });
  });

  it('the session plan applies exactly the keys it is given (the ones sent to the Oracle), and reads no kill switch', async () => {
    routeRest([trigger(['money.coins.count'])]);
    const strict = await buildSessionPlan(USER, 3, 'en-US');
    expect(strict?.plan.map((p) => p.kcKey).sort()).toEqual(['ent.price.set', 'money.coins.count']);
    const rolled = await buildSessionPlan(USER, 3, 'en-US', new Set(['money.coins.count']));
    expect(rolled?.plan.map((p) => p.kcKey)).toEqual(['ent.price.set']);
    expect(auditReads()).toBe(0);
  });
});
