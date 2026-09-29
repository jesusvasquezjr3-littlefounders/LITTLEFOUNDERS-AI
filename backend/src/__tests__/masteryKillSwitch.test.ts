import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Appendix F Part 3 Stage 7 — the Extended Mastery Engine automatic rollback
 * (GAP-FIX-R4). The per-KC summaries, the pure condition, and Core's
 * kill-switch state against a mocked PostgREST: a trip on one KC rolls back
 * only that KC, a compliance miss trips it, the trip holds until resolved, a
 * failed read never trips it, and decisions made under the rollback are
 * counted in `underRollback`.
 */

const rest = vi.hoisted(() => ({
  serviceRest: vi.fn<(path: string) => Promise<unknown>>(),
  insertAuditLog: vi.fn<(actor: string | null, action: string, subject: string, detail: Record<string, unknown>) => Promise<boolean>>(),
}));
vi.mock('../services/supabaseRest.js', () => rest);

const {
  evaluateMasteryKillSwitch,
  getMasteryKillSwitch,
  MASTERY_KILL_SWITCH_RESOLVED,
  MASTERY_KILL_SWITCH_TRIGGERED,
  masteryKillSwitchLog,
  masteryTripInForce,
  resetMasteryKillSwitchCache,
  resolveMasteryKillSwitch,
  summarizeMasteryEvidence,
} = await import('../services/pedagogy/mentorIntegrity.js');
type TrajectoryEvidenceRow = import('../services/pedagogy/mentorIntegrity.js').TrajectoryEvidenceRow;

const NOW = new Date('2026-09-29T12:00:00Z');
const KC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEYS: Record<string, string> = { [KC_A]: 'money.coins.count', [KC_B]: 'ent.price.set' };
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const step = (overrides: Partial<TrajectoryEvidenceRow> = {}): TrajectoryEvidenceRow => ({
  user_id: 'u',
  kc_id: KC_A,
  strategy: 'CELEBRATE',
  strategy_before: 'SOCRATIC',
  evidence_rule: 'mastery',
  evidence_observations: 2,
  evidence_required: 2,
  mastery_revoked: false,
  created_at: daysAgo(30),
  ...overrides,
});

/** `n` declarations on one KC, the first `reversed` of them revoked a day later. */
function declarations(kcId: string, n: number, reversed: number, at = 30): TrajectoryEvidenceRow[] {
  const rows: TrajectoryEvidenceRow[] = [];
  for (let i = 0; i < n; i += 1) {
    rows.push(step({ user_id: `${kcId}-u${i}`, kc_id: kcId, created_at: daysAgo(at) }));
    if (i < reversed) {
      rows.push(
        step({
          user_id: `${kcId}-u${i}`,
          kc_id: kcId,
          strategy: 'SPACED',
          evidence_rule: null,
          evidence_observations: null,
          evidence_required: null,
          mastery_revoked: true,
          created_at: daysAgo(at - 1),
        }),
      );
    }
  }
  return rows;
}

describe('summarizeMasteryEvidence — per knowledge component', () => {
  it('judges each KC on its own, with the 20-declaration floor applied per KC', () => {
    // KC A: 3/20 reversed (15%, over the ceiling). KC B: 1/19 reversed — under the floor.
    const s = summarizeMasteryEvidence([...declarations(KC_A, 20, 3), ...declarations(KC_B, 19, 1)]);
    const a = s.byKc.find((kc) => kc.kcId === KC_A)!;
    const b = s.byKc.find((kc) => kc.kcId === KC_B)!;
    expect(a).toMatchObject({ declarations: 20, reversals: 3, reversalStatus: 'defect' });
    expect(a.reversalRate).toBeCloseTo(0.15, 5);
    expect(b).toMatchObject({ declarations: 19, reversals: 1, reversalStatus: 'insufficient_data' });
    // The aggregate still exists: 4/39.
    expect(s.declarations).toBe(39);
    expect(s.reversals).toBe(4);
    expect(s.defects.some((d) => d.includes(`KC ${KC_A}`))).toBe(true);
    expect(s.defects.some((d) => d.includes(`KC ${KC_B}`))).toBe(false);
  });

  it('counts compliance misses per KC, and a miss with no KC as unattributed', () => {
    const s = summarizeMasteryEvidence([
      step(),
      step({ kc_id: KC_B, evidence_observations: 1 }),
      step({ kc_id: null, evidence_rule: null, evidence_observations: null, evidence_required: null }),
    ]);
    expect(s.byKc.find((kc) => kc.kcId === KC_A)).toMatchObject({ triggers: 1, complianceMisses: 0, complianceRate: 1 });
    expect(s.byKc.find((kc) => kc.kcId === KC_B)).toMatchObject({ triggers: 1, complianceMisses: 1, complianceRate: 0 });
    expect(s.unattributedMisses).toBe(1);
  });

  it('decisions made under the rollback are counted in underRollback, per KC and in aggregate — and are compliant', () => {
    const s = summarizeMasteryEvidence([
      step({ evidence_observations: 1, evidence_required: 1 }),
      step({ strategy: 'REMEDIATE', strategy_before: 'SOCRATIC', evidence_rule: 'remediation', evidence_observations: 1, evidence_required: 1 }),
      step({ kc_id: KC_B }),
    ]);
    expect(s.underRollback).toBe(2);
    expect(s.complianceRate).toBe(1);
    expect(s.byKc.find((kc) => kc.kcId === KC_A)).toMatchObject({ underRollback: 2, complianceMisses: 0 });
    expect(s.byKc.find((kc) => kc.kcId === KC_B)).toMatchObject({ underRollback: 0 });
  });
});

describe('evaluateMasteryKillSwitch — the Stage 7 condition, per KC', () => {
  it('a KC over the 8% ceiling trips only that KC', () => {
    const v = evaluateMasteryKillSwitch([...declarations(KC_A, 20, 3), ...declarations(KC_B, 40, 1)], NOW);
    expect(v.tripped).toBe(true);
    expect(v.causes).toEqual(['reversal_above_ceiling']);
    expect(v.kcs.map((kc) => kc.kcId)).toEqual([KC_A]);
  });

  it('ONE compliance miss in the trailing window trips its KC; an old one (legacy) does not', () => {
    const recentMiss = evaluateMasteryKillSwitch([step({ kc_id: KC_B, evidence_observations: 1, created_at: daysAgo(2) })], NOW);
    expect(recentMiss).toMatchObject({ tripped: true, causes: ['compliance_below_target'] });
    expect(recentMiss.kcs).toEqual([expect.objectContaining({ kcId: KC_B, complianceMisses: 1, causes: ['compliance_below_target'] })]);
    const legacyMiss = evaluateMasteryKillSwitch([step({ kc_id: KC_B, evidence_rule: null, created_at: daysAgo(60) })], NOW);
    expect(legacyMiss.tripped).toBe(false);
  });

  it('a healthy or thin sample does not trip', () => {
    expect(evaluateMasteryKillSwitch(declarations(KC_A, 40, 2), NOW).tripped).toBe(false); // 5%
    expect(evaluateMasteryKillSwitch(declarations(KC_A, 10, 5), NOW).tripped).toBe(false); // 50% of a thin sample
  });

  it('a compliance miss with no KC trips (logged) but names no KC to roll back', () => {
    const v = evaluateMasteryKillSwitch([step({ kc_id: null, evidence_observations: 0, created_at: daysAgo(1) })], NOW);
    expect(v).toMatchObject({ tripped: true, causes: ['compliance_below_target'], kcs: [], unattributedMisses: 1 });
  });
});

describe('the trip in force and the Kill-Switch Trigger Log', () => {
  const trig = (at: string, kcKeys: string[], causes = ['reversal_above_ceiling']) => ({
    action: MASTERY_KILL_SWITCH_TRIGGERED,
    created_at: at,
    detail: { kcKeys, causes },
  });
  const resolved = (at: string) => ({ action: MASTERY_KILL_SWITCH_RESOLVED, created_at: at, detail: { note: 'root caused' } });

  it('unions every trigger since the latest resolution; a resolution closes the whole trip', () => {
    const rows = [
      trig('2026-09-01T00:00:00Z', ['old.kc.key']),
      resolved('2026-09-02T00:00:00Z'),
      trig('2026-09-10T00:00:00Z', ['money.coins.count']),
      trig('2026-09-12T00:00:00Z', ['ent.price.set'], ['compliance_below_target']),
    ];
    expect(masteryTripInForce(rows)).toEqual({
      open: true,
      kcKeys: ['ent.price.set', 'money.coins.count'],
      causes: ['reversal_above_ceiling', 'compliance_below_target'],
      trippedAt: '2026-09-10T00:00:00Z',
      resolvedAt: '2026-09-02T00:00:00Z',
    });
    const log = masteryKillSwitchLog(rows);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ kcKeys: ['old.kc.key'], resolvedAt: '2026-09-02T00:00:00Z', resolutionHours: 24 });
    expect(log[1]).toMatchObject({ kcKeys: ['money.coins.count', 'ent.price.set'], resolvedAt: null, resolutionHours: null });
    expect(masteryTripInForce([...rows, resolved('2026-09-20T00:00:00Z')])).toMatchObject({ open: false, kcKeys: [] });
  });
});

describe('getMasteryKillSwitch — Core evaluates, logs and holds', () => {
  let audit: unknown[] | null;
  let trajectory: unknown[] | null;
  let kc: unknown[] | null;
  const paths: string[] = [];

  beforeEach(() => {
    resetMasteryKillSwitchCache();
    audit = [];
    trajectory = [];
    kc = Object.entries(KEYS).map(([id, key]) => ({ id, key }));
    paths.length = 0;
    rest.serviceRest.mockReset();
    rest.insertAuditLog.mockReset();
    rest.insertAuditLog.mockResolvedValue(true);
    rest.serviceRest.mockImplementation(async (path: string) => {
      paths.push(path);
      if (path.startsWith('/audit_logs')) return audit;
      if (path.startsWith('/tutor_trajectory_step')) return trajectory;
      if (path.startsWith('/kc?')) return kc;
      throw new Error(`unexpected read ${path}`);
    });
  });

  it('a trip on one KC rolls back only that KC, and writes the trigger row with its key, cause and numbers', async () => {
    trajectory = [...declarations(KC_A, 20, 3), ...declarations(KC_B, 40, 1)];
    const state = await getMasteryKillSwitch(NOW);
    expect(state).toMatchObject({ kcKeys: ['money.coins.count'], causes: ['reversal_above_ceiling'], degraded: false });
    expect(rest.insertAuditLog).toHaveBeenCalledTimes(1);
    const [actor, action, subject, detail] = rest.insertAuditLog.mock.calls[0]!;
    expect([actor, action, subject]).toEqual([null, 'mentor.kill_switch.mastery.triggered', 'tutor']);
    expect(detail).toMatchObject({
      component: 'extended_mastery_engine',
      causes: ['reversal_above_ceiling'],
      kcKeys: ['money.coins.count'],
      kcs: [expect.objectContaining({ kcKey: 'money.coins.count', declarations: 20, reversals: 3 })],
    });
    // No learner id, no text in the Kill-Switch Trigger Log.
    expect(JSON.stringify(detail)).not.toMatch(/user|u0|nickname|text/i);
  });

  it('a compliance miss trips its KC', async () => {
    trajectory = [step({ kc_id: KC_B, evidence_observations: 1, created_at: daysAgo(1) })];
    const state = await getMasteryKillSwitch(NOW);
    expect(state.kcKeys).toEqual(['ent.price.set']);
    expect(state.causes).toEqual(['compliance_below_target']);
    expect(rest.insertAuditLog.mock.calls[0]![3]).toMatchObject({ kcKeys: ['ent.price.set'], causes: ['compliance_below_target'] });
  });

  it('the trip holds until an operator resolves it, whatever the window now says', async () => {
    audit = [{ action: MASTERY_KILL_SWITCH_TRIGGERED, created_at: daysAgo(40), detail: { kcKeys: ['money.coins.count'], causes: ['reversal_above_ceiling'] } }];
    trajectory = declarations(KC_A, 40, 0); // healthy now
    const held = await getMasteryKillSwitch(NOW);
    expect(held).toMatchObject({ kcKeys: ['money.coins.count'], trippedAt: daysAgo(40), degraded: false });
    expect(rest.insertAuditLog).not.toHaveBeenCalled();

    // Resolved: the KC returns to the corroborated requirement, and only data since the resolution counts.
    resetMasteryKillSwitchCache();
    const resolvedAt = daysAgo(1);
    audit = [...audit, { action: MASTERY_KILL_SWITCH_RESOLVED, created_at: resolvedAt, detail: { note: 'fixed' } }];
    paths.length = 0;
    const after = await getMasteryKillSwitch(NOW);
    expect(after).toMatchObject({ kcKeys: [], trippedAt: null });
    expect(decodeURIComponent(paths.find((p) => p.startsWith('/tutor_trajectory_step'))!)).toContain(`created_at=gt.${resolvedAt}`);
  });

  it('while a trip is open, a KC already rolled back is not re-logged; a NEW KC joins the trip', async () => {
    audit = [{ action: MASTERY_KILL_SWITCH_TRIGGERED, created_at: daysAgo(5), detail: { kcKeys: ['money.coins.count'], causes: ['reversal_above_ceiling'] } }];
    trajectory = declarations(KC_A, 20, 3);
    expect((await getMasteryKillSwitch(NOW)).kcKeys).toEqual(['money.coins.count']);
    expect(rest.insertAuditLog).not.toHaveBeenCalled();

    resetMasteryKillSwitchCache();
    trajectory = [...declarations(KC_A, 20, 3), step({ kc_id: KC_B, evidence_observations: 0, created_at: daysAgo(1) })];
    const state = await getMasteryKillSwitch(NOW);
    expect(state.kcKeys).toEqual(['ent.price.set', 'money.coins.count']);
    expect(state.trippedAt).toBe(daysAgo(5));
    expect(rest.insertAuditLog).toHaveBeenCalledTimes(1);
    expect(rest.insertAuditLog.mock.calls[0]![3]).toMatchObject({ kcKeys: ['ent.price.set'] });
  });

  it('a failed read does not trip it (§1.14) and is not cached', async () => {
    trajectory = declarations(KC_A, 20, 3);
    audit = null;
    expect(await getMasteryKillSwitch(NOW)).toEqual({ kcKeys: [], trippedAt: null, causes: [], degraded: true });

    audit = [];
    trajectory = null;
    expect(await getMasteryKillSwitch(NOW)).toMatchObject({ kcKeys: [], degraded: true });

    trajectory = declarations(KC_A, 20, 3);
    kc = null;
    expect(await getMasteryKillSwitch(NOW)).toMatchObject({ kcKeys: [], degraded: true });
    expect(rest.insertAuditLog).not.toHaveBeenCalled();

    // Not cached: the next session asks again and, with every read answered, trips.
    kc = Object.entries(KEYS).map(([id, key]) => ({ id, key }));
    expect((await getMasteryKillSwitch(NOW)).kcKeys).toEqual(['money.coins.count']);
  });

  it('a failed trajectory read keeps the KCs already in force rolled back', async () => {
    audit = [{ action: MASTERY_KILL_SWITCH_TRIGGERED, created_at: daysAgo(3), detail: { kcKeys: ['money.coins.count'], causes: ['reversal_above_ceiling'] } }];
    trajectory = null;
    expect(await getMasteryKillSwitch(NOW)).toMatchObject({ kcKeys: ['money.coins.count'], degraded: true });
  });

  it('caches a healthy verdict per process', async () => {
    trajectory = declarations(KC_A, 40, 0);
    await getMasteryKillSwitch(NOW);
    const reads = rest.serviceRest.mock.calls.length;
    await getMasteryKillSwitch(new Date(NOW.getTime() + 60_000));
    expect(rest.serviceRest.mock.calls.length).toBe(reads);
  });

  it('a compliance miss with no KC opens a logged trip that rolls nothing back, once', async () => {
    trajectory = [step({ kc_id: null, evidence_observations: 0, created_at: daysAgo(1) })];
    const state = await getMasteryKillSwitch(NOW);
    expect(state.kcKeys).toEqual([]);
    expect(rest.insertAuditLog.mock.calls[0]![3]).toMatchObject({ kcKeys: [], unattributedMisses: 1, causes: ['compliance_below_target'] });

    resetMasteryKillSwitchCache();
    audit = [{ action: MASTERY_KILL_SWITCH_TRIGGERED, created_at: daysAgo(0.5), detail: { kcKeys: [], causes: ['compliance_below_target'] } }];
    await getMasteryKillSwitch(NOW);
    expect(rest.insertAuditLog).toHaveBeenCalledTimes(1);
  });

  it('the operator resolution writes mentor.kill_switch.mastery.resolved', async () => {
    expect(await resolveMasteryKillSwitch('root cause: a mis-keyed item bank')).toBe(true);
    expect(rest.insertAuditLog).toHaveBeenCalledWith(null, 'mentor.kill_switch.mastery.resolved', 'tutor', {
      component: 'extended_mastery_engine',
      note: 'root cause: a mis-keyed item bank',
    });
  });
});
