import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonResponse } from './helpers.js';
import { classifyLiveContent, lexicalRiskSignals } from '../services/pedagogy/contentRisk.js';
import {
  admitLiveCandidate,
  baselineRates,
  calibrationStatus,
  composeCategoryGate,
  computeCalibration,
  concordance,
  getLiveContentGate,
  judgeMatches,
  LIVE_CONTENT_FLOORS,
  LIVE_CONTENT_KILL_SWITCH_RESOLVED,
  LIVE_CONTENT_KILL_SWITCH_TRIGGERED,
  LIVE_CONTENT_THRESHOLDS,
  liveContentKillSwitchLog,
  openTrips,
  resetLiveContentGateCache,
  resolveLiveContentKillSwitch,
  reviewCoverage,
  samplingState,
  summarizeLadder,
  summarizeLiveLog,
  type CalibrationInput,
  type CalibrationRow,
  type LadderEventRow,
  type LiveLogRow,
} from '../services/pedagogy/liveContentGovernance.js';
import { calibrationInputFrom, seedSetHash, type CalibrationFile } from '../scripts/live-content-report.js';

/*
 * C.5 — the governance of the judge-approved live-generation tier
 * (Appendix E §3.1.1, Appendix F §1.3 and Part 3 Stage 7). Pure rules first,
 * then the gate as it reads the database (fetch-stubbed PostgREST).
 */

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-09-24T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const PASSED: CalibrationRow = {
  id: '99999999-9999-4999-8999-999999999999',
  judge_id: 'live_content_judge',
  kind: 'calibration',
  verifies_calibration_id: null,
  judge_model: 'qwen3-max',
  judge_prompt_hash: HASH,
  seed_set_version: 'seed.v1',
  verdict: 'passed',
  scope: ['approve'],
  created_at: daysAgo(3),
};

describe('C.5 floors and baselines (Tier-1-adjacent)', () => {
  it('keeps the Appendix E floors: 15% standard, 50% sensitive', () => {
    expect(LIVE_CONTENT_FLOORS).toEqual({ standard: 0.15, sensitive: 0.5 });
  });

  it('lets configuration RAISE a baseline and ignores any value below the floor', () => {
    expect(baselineRates({ standard: 0.3, sensitive: 0.8 })).toEqual({ rates: { standard: 0.3, sensitive: 0.8 }, ignored: [] });
    expect(baselineRates({ standard: 0.05, sensitive: 0.49 })).toEqual({
      rates: { standard: 0.15, sensitive: 0.5 },
      ignored: ['standard', 'sensitive'],
    });
    expect(baselineRates({ standard: 0, sensitive: Number.NaN }).rates).toEqual({ standard: 0.15, sensitive: 0.5 });
  });
});

describe('C.5 dynamic sampling (the SPEC: raise on an issue, restore after 5 clean batches)', () => {
  it('runs at the baseline when no issue was ever found', () => {
    expect(samplingState('standard', 0.15, null, 0)).toMatchObject({ elevated: false, rate: 0.15, decisionsToRestore: 0 });
  });

  it('raises the category to its elevated rate at the first rejection', () => {
    expect(samplingState('standard', 0.15, daysAgo(1), 0)).toMatchObject({ elevated: true, rate: 0.5, decisionsToRestore: 100 });
    expect(samplingState('sensitive', 0.5, daysAgo(1), 0)).toMatchObject({ elevated: true, rate: 1 });
  });

  it('counts only COMPLETE clean batches, and restores the baseline at exactly 5', () => {
    const batch = LIVE_CONTENT_THRESHOLDS.batchSize;
    expect(samplingState('standard', 0.15, daysAgo(1), batch * 5 - 1)).toMatchObject({ elevated: true, cleanBatches: 4, decisionsToRestore: 1 });
    expect(samplingState('standard', 0.15, daysAgo(1), batch * 5)).toMatchObject({ elevated: false, rate: 0.15, cleanBatches: 5 });
  });

  it('never runs the elevated rate below a configured baseline', () => {
    expect(samplingState('standard', 0.7, daysAgo(1), 0).rate).toBe(0.7);
  });
});

describe('C.5 the calibrated judge', () => {
  it('trusts only a passed calibration younger than the cadence', () => {
    expect(calibrationStatus([], NOW).state).toBe('uncalibrated');
    expect(calibrationStatus([{ ...PASSED, verdict: 'failed' }], NOW).state).toBe('uncalibrated');
    expect(calibrationStatus([PASSED], NOW)).toMatchObject({ state: 'passed', row: PASSED });
    expect(calibrationStatus([{ ...PASSED, created_at: daysAgo(36) }], NOW)).toMatchObject({ state: 'stale', row: null });
    // C.23: a failed recalibration after a pass un-trusts the judge, and a
    // transcript-judge row never vouches for the content judge.
    const later = { ...PASSED, id: 'later', verdict: 'failed' as const, created_at: daysAgo(1) };
    expect(calibrationStatus([later, PASSED], NOW).state).toBe('uncalibrated');
    expect(calibrationStatus([{ ...PASSED, judge_id: 'transcript_judge' }], NOW).state).toBe('uncalibrated');
    // A failed spot check requires a new calibration.
    const spot = { ...PASSED, id: 'spot', kind: 'spot_check' as const, verifies_calibration_id: PASSED.id, verdict: 'failed' as const, created_at: daysAgo(1) };
    expect(calibrationStatus([spot, PASSED], NOW).state).toBe('uncalibrated');
  });

  it('matches the approving judge by model AND prompt hash', () => {
    expect(judgeMatches(PASSED, 'qwen3-max', HASH)).toBe(true);
    expect(judgeMatches(PASSED, 'qwen3-max', 'c'.repeat(64))).toBe(false);
    expect(judgeMatches(PASSED, 'other-model', HASH)).toBe(false);
    expect(judgeMatches(PASSED, undefined, undefined)).toBe(false);
    expect(judgeMatches(null, 'qwen3-max', HASH)).toBe(false);
  });
});

describe('C.5 Stage 7 conditions', () => {
  it('concordance: insufficient data below 20 decisions, a trip below 90%', () => {
    const decisions = (approved: number, rejected: number) => [
      ...Array.from({ length: approved }, () => ({ review_verdict: 'approved' })),
      ...Array.from({ length: rejected }, () => ({ review_verdict: 'rejected' })),
    ];
    expect(concordance(decisions(15, 4))).toMatchObject({ rate: null, belowFloor: false });
    expect(concordance(decisions(18, 2))).toMatchObject({ rate: 0.9, belowFloor: false });
    expect(concordance(decisions(17, 3))).toMatchObject({ rate: 0.85, belowFloor: true });
  });

  it('review coverage is exact: fewer reviewed than floor(served × floor) is below the floor', () => {
    const rows = (served: number, reviewed: number) =>
      Array.from({ length: served }, (_, i) => ({ sampled: i < reviewed + 2, reviewed_at: i < reviewed ? daysAgo(1) : null, sample_rate: 0.15 }));
    expect(reviewCoverage('standard', rows(40, 6))).toMatchObject({ required: 6, belowFloor: false });
    expect(reviewCoverage('standard', rows(40, 5))).toMatchObject({ required: 6, belowFloor: true });
    expect(reviewCoverage('standard', rows(10, 0))).toMatchObject({ share: null, belowFloor: false });
    // A row recorded under the floor is a defect whatever the volume.
    expect(reviewCoverage('sensitive', [{ sampled: true, reviewed_at: daysAgo(1), sample_rate: 0.2 }]).belowFloor).toBe(true);
  });

  it('suspends a category for an uncalibrated or stale judge and for its own open trips only', () => {
    const sampling = samplingState('standard', 0.15, null, 0);
    expect(composeCategoryGate({ category: 'standard', calibration: 'uncalibrated', openTrips: [], sampling }).reasons).toEqual(['uncalibrated']);
    expect(composeCategoryGate({ category: 'standard', calibration: 'stale', openTrips: [], sampling }).reasons).toEqual(['calibration_stale']);
    const trips = [{ category: 'sensitive' as const, cause: 'concordance_below_floor' as const, trippedAt: daysAgo(1) }];
    expect(composeCategoryGate({ category: 'standard', calibration: 'passed', openTrips: trips, sampling }).suspended).toBe(false);
    expect(composeCategoryGate({ category: 'sensitive', calibration: 'passed', openTrips: trips, sampling }).reasons).toEqual(['concordance_below_floor']);
  });

  it('folds the trip/resolve log per category and cause, and reports resolution time', () => {
    const rows = [
      { action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(3), detail: { category: 'standard', cause: 'review_rate_below_floor' } },
      { action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(2), detail: { category: 'sensitive', cause: 'concordance_below_floor' } },
      { action: LIVE_CONTENT_KILL_SWITCH_RESOLVED, created_at: daysAgo(1), detail: { category: 'standard', cause: 'review_rate_below_floor' } },
    ];
    expect(openTrips(rows)).toEqual([{ category: 'sensitive', cause: 'concordance_below_floor', trippedAt: daysAgo(2) }]);
    const log = liveContentKillSwitchLog(rows);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ category: 'standard', resolutionHours: 48 });
    expect(log[1]).toMatchObject({ category: 'sensitive', resolvedAt: null });
  });
});

describe('C.5 admission of one candidate', () => {
  const gateWith = (overrides: Partial<Record<'standard' | 'sensitive', { suspended: boolean; reasons: string[] }>> = {}) => ({
    degraded: false,
    calibration: { state: 'passed' as const, row: PASSED, ageDays: 3 },
    ignoredBaselines: [],
    categories: {
      standard: { category: 'standard' as const, suspended: false, reasons: [], sampling: samplingState('standard', 0.15, null, 0), ...overrides.standard },
      sensitive: { category: 'sensitive' as const, suspended: false, reasons: [], sampling: samplingState('sensitive', 0.5, daysAgo(1), 3), ...overrides.sensitive },
    },
  }) as unknown as Parameters<typeof admitLiveCandidate>[0];

  it('admits at the category rate against the calibration it was judged under', () => {
    expect(admitLiveCandidate(gateWith(), 'standard', 'qwen3-max', HASH)).toEqual({ admitted: true, rate: 0.15, elevated: false, calibrationId: PASSED.id });
    expect(admitLiveCandidate(gateWith(), 'sensitive', 'qwen3-max', HASH)).toMatchObject({ admitted: true, rate: 1, elevated: true });
  });

  it('refuses a suspended category, an unknown judge and a degraded gate', () => {
    expect(admitLiveCandidate(gateWith({ standard: { suspended: true, reasons: ['concordance_below_floor'] } }), 'standard', 'qwen3-max', HASH))
      .toEqual({ admitted: false, reason: 'concordance_below_floor' });
    expect(admitLiveCandidate(gateWith(), 'standard', 'qwen3-max', 'c'.repeat(64))).toEqual({ admitted: false, reason: 'judge_not_calibrated' });
    expect(admitLiveCandidate({ ...gateWith(), degraded: true } as never, 'standard', 'qwen3-max', HASH)).toEqual({ admitted: false, reason: 'gate_unavailable' });
  });
});

describe('C.5 content-risk category (Core decides; a report may raise it, never lower it)', () => {
  it('reads the sensitive topics in all three locales', () => {
    expect(lexicalRiskSignals('Her parents are divorced and live in two homes.')).toEqual(['family_conflict']);
    expect(lexicalRiskSignals('En casa no alcanza el dinero para comer este mes.')).toEqual(['financial_hardship']);
    expect(lexicalRiskSignals('Os pais brigam por causa das dívidas.')).toEqual(['financial_hardship', 'family_conflict']);
    expect(lexicalRiskSignals('Grandpa died last spring.')).toEqual(['loss_and_grief']);
    expect(lexicalRiskSignals('Numa aposta você pode perder tudo.')).toEqual(['safety_adjacent']);
  });

  it('does not flag ordinary money and business language', () => {
    for (const text of [
      'Arma tu presupuesto para la semana.',
      'You have 20 coins and spend half of them.',
      'Better prices bring more customers.',
      'A robot costs 30 coins.',
      'Você gasta 10 moedas em materiais; se chover, não vende nada.',
      'Plan A: if it rains you sell nothing.',
    ]) expect(lexicalRiskSignals(text), text).toEqual([]);
  });

  it('takes the union with what Oracle reported, adds the session flags, and never trusts a lower report', () => {
    expect(classifyLiveContent({ texts: ['Split 12 coins.'], reportedSignals: [], sessionSafetyFlags: 0 })).toEqual({ category: 'standard', signals: [] });
    expect(classifyLiveContent({ texts: ['Split 12 coins.'], reportedSignals: ['learner_classifier_match'], sessionSafetyFlags: 0 }).category).toBe('sensitive');
    expect(classifyLiveContent({ texts: ['Split 12 coins.'], reportedSignals: [], sessionSafetyFlags: 1 }).signals).toEqual(['session_safety_event']);
    // Oracle said "standard" (no signals) about a divorce story: Core's own read wins.
    expect(classifyLiveContent({ texts: ['Mom and dad are divorced.'], reportedSignals: [], sessionSafetyFlags: 0 }).category).toBe('sensitive');
    // An unknown code (a vocabulary drift) makes the item sensitive, never ignored.
    expect(classifyLiveContent({ texts: ['Split 12 coins.'], reportedSignals: ['brand_new_code'], sessionSafetyFlags: 0 }))
      .toEqual({ category: 'sensitive', signals: ['unrecognized_signal'] });
    expect(classifyLiveContent({ texts: ['Split 12 coins.'], reportedSignals: 'standard', sessionSafetyFlags: 0 }).category).toBe('sensitive');
  });
});

describe('C.5 judge calibration (Appendix E §2.1/§3.2)', () => {
  const seedPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../oracle/src/content/judgeCalibration/seed-set.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as CalibrationFile['seedSet'] & { items: { id: string; category: 'standard' | 'sensitive'; intended: 'pass' | 'fail' }[] };
  const labels = (flip: string[] = []) =>
    Object.fromEntries(seed.items.map((i) => [i.id, flip.includes(i.id) ? (i.intended === 'pass' ? 'fail' : 'pass') : i.intended])) as Record<string, 'pass' | 'fail'>;
  const file = (over: Partial<CalibrationFile> = {}): CalibrationFile => ({
    seedSet: seed,
    ratings: [
      { rater: 'reviewer-a', source: 'human_panel', labels: labels() },
      { rater: 'reviewer-b', source: 'human_panel', labels: labels(['std-01']) },
      { rater: 'reviewer-c', source: 'human_panel', labels: labels() },
    ],
    judge: { model: 'qwen3-max', promptHash: HASH, mode: 'live', verdicts: labels() },
    ...over,
  });

  it('the seed set carries at least 20 items per category, as the record requires', () => {
    expect(seed.items.filter((i) => i.category === 'standard').length).toBeGreaterThanOrEqual(20);
    expect(seed.items.filter((i) => i.category === 'sensitive').length).toBeGreaterThanOrEqual(20);
  });

  it('every sensitive seed item reads as sensitive to the gate, and every standard one does not', () => {
    const full = JSON.parse(readFileSync(seedPath, 'utf8')) as { items: { id: string; category: string; segment: Record<string, unknown> }[] };
    for (const item of full.items) {
      const text = JSON.stringify(item.segment);
      const sensitive = lexicalRiskSignals(text).length > 0;
      expect(sensitive, `${item.id}`).toBe(item.category === 'sensitive');
    }
  });

  it('passes a live judge that agrees with a panel that agrees with itself', () => {
    const result = computeCalibration(calibrationInputFrom(file()));
    expect(result).toMatchObject({ recordable: true, verdict: 'passed', itemsStandard: 22, itemsSensitive: 22, agreementStandard: 1, agreementSensitive: 1 });
    expect(result.interRater).toBeGreaterThanOrEqual(0.85);
  });

  it('fails a judge that approves what the panel rejects', () => {
    const intendedFails = seed.items.filter((i) => i.category === 'sensitive' && i.intended === 'fail').map((i) => i.id);
    const judge = { model: 'qwen3-max', promptHash: HASH, mode: 'live' as const, verdicts: labels(intendedFails.slice(0, 3)) };
    const result = computeCalibration(calibrationInputFrom(file({ judge })));
    expect(result.verdict).toBe('failed');
    expect(result.agreementSensitive).toBeLessThan(0.9);
    expect(result.disagreements.map((d) => d.id)).toEqual(intendedFails.slice(0, 3));
  });

  it('fails a panel that does not agree with itself, whatever the judge does', () => {
    const everything = seed.items.map((i) => i.id);
    const ratings = [
      { rater: 'a', source: 'human_panel', labels: labels() },
      { rater: 'b', source: 'human_panel', labels: labels(everything.filter((_, i) => i % 3 === 0)) },
    ];
    const result = computeCalibration(calibrationInputFrom(file({ ratings })));
    expect(result.interRater).toBeLessThan(0.85);
    expect(result.verdict).toBe('failed');
  });

  it('refuses to record a dry run, a replay, the author\'s labels or a single rater', () => {
    const dry = computeCalibration(calibrationInputFrom(file({ judge: { model: 'm', promptHash: HASH, mode: 'dry_run', verdicts: labels() } })));
    expect(dry.recordable).toBe(false);
    expect(dry.refusals.join()).toContain('not obtained live');
    const replay = computeCalibration(calibrationInputFrom(file({ judge: { model: 'm', promptHash: HASH, mode: 'replay', verdicts: labels() } })));
    expect(replay.recordable).toBe(false);
    const author = computeCalibration(calibrationInputFrom(file({ ratings: [
      { rater: 'seed-author', source: 'author_intended', labels: labels() },
      { rater: 'b', source: 'human_panel', labels: labels() },
    ] })));
    expect(author.refusals.join()).toContain('not from the human panel');
    const single = computeCalibration(calibrationInputFrom(file({ ratings: [{ rater: 'a', source: 'human_panel', labels: labels() }] })));
    expect(single.refusals.join()).toContain('two human raters');
    expect(single.verdict).toBe('failed');
  });

  it('refuses an item without a label from every rater and the judge', () => {
    const partial = labels();
    delete partial['std-01'];
    const result = computeCalibration(calibrationInputFrom(file({ judge: { model: 'm', promptHash: HASH, mode: 'live', verdicts: partial } })));
    expect(result.recordable).toBe(false);
  });

  it('hashes the seed items itself: any edit changes the hash a calibration is recorded against', () => {
    const edited = seed.items.map((i, n) => (n === 0 ? { ...i, intended: 'fail' as const } : i));
    expect(seedSetHash(seed.items)).not.toBe(seedSetHash(edited));
    expect(calibrationInputFrom(file()).seedSet.hash).toBe(seedSetHash(seed.items));
  });

  it('a threshold tie is a fail on the human side (half the panel suspects a defect)', () => {
    const input: CalibrationInput = {
      seedSet: { version: 'x', hash: HASH, items: [{ id: 'one', category: 'standard' }] },
      ratings: [
        { rater: 'a', source: 'human_panel', labels: { one: 'pass' } },
        { rater: 'b', source: 'human_panel', labels: { one: 'fail' } },
      ],
      judge: { model: 'm', promptHash: HASH, mode: 'live', verdicts: { one: 'pass' } },
    };
    expect(computeCalibration(input).disagreements).toEqual([{ id: 'one', category: 'standard', human: 'fail', judge: 'pass' }]);
  });
});

describe('C.5/C.6 reports (pure)', () => {
  it('summarizes the live log per category, with the backlog past the SLA', () => {
    const row = (over: Partial<LiveLogRow>): LiveLogRow => ({
      risk_category: 'standard', sampled: false, sample_rate: 0.15, elevated: false, review_verdict: null, review_issue: null,
      reviewed_at: null, calibration_id: PASSED.id, segment_type: 'quiz_mcq', created_at: daysAgo(1), ...over,
    });
    const [standard, sensitive] = summarizeLiveLog([
      row({ sampled: true, review_verdict: 'rejected', review_issue: 'safety', reviewed_at: daysAgo(1) }),
      row({ sampled: true, created_at: daysAgo(9) }),
      row({ risk_category: 'sensitive', sample_rate: 0.5, sampled: true, review_verdict: 'approved', reviewed_at: daysAgo(1) }),
    ], NOW);
    expect(standard).toMatchObject({ served: 2, sampled: 2, decided: 1, rejectedSafety: 1, backlogPastSla: 1, belowFloorRows: 0 });
    expect(sensitive).toMatchObject({ served: 1, approved: 1 });
  });

  it('ranks unmet demand and reports the live share per week (C.6 measure)', () => {
    const ev = (over: Partial<LadderEventRow>): LadderEventRow => ({
      outcome: 'catalog', route: 'named_skill', kc_id: null, skill_key: null, tier: 2, locale: 'en-US', reason: null, created_at: daysAgo(1), ...over,
    });
    const summary = summarizeLadder([
      ev({}),
      ev({ outcome: 'bank', route: 'kc_pack', skill_key: 'kc:biz.goods-vs-services' }),
      ev({ outcome: 'live_served', route: 'verify' }),
      ev({ outcome: 'needs_generation', route: 'none', skill_key: 'kc:money.percent-intro', tier: 3 }),
      ev({ outcome: 'needs_generation', route: 'none', skill_key: 'kc:money.percent-intro', tier: 3 }),
      ev({ outcome: 'live_suspended', route: 'none', skill_key: 'kc:biz.risk-and-reward', tier: 3, reason: 'uncalibrated' }),
    ]);
    expect(summary.served).toBe(3);
    expect(summary.bankShare).toBeCloseTo(1 / 3);
    expect(summary.unmetDemand[0]).toMatchObject({ pattern: 'kc:money.percent-intro|t3|en-US', invitations: 2 });
    expect(summary.unmetDemand[1]).toMatchObject({ suspended: 1 });
    expect(summary.weekly).toHaveLength(1);
  });
});

// ── the gate, read from the database ─────────────────────────────────────────

interface World {
  calibration?: CalibrationRow[] | 'fail';
  audit?: { action: string; created_at: string; detail: Record<string, unknown> }[];
  latestIssue?: { reviewed_at: string }[];
  clean?: number;
  concordanceRows?: { review_verdict: string }[];
  coverageRows?: { sampled: boolean; reviewed_at: string | null; sample_rate: number }[];
  auditWrites?: string[];
}

function stubWorld(world: World) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      const method = init?.method ?? 'GET';
      if (url.includes('/mentor_judge_calibration')) {
        if (world.calibration === 'fail') return Promise.resolve(new Response(null, { status: 500 }));
        return Promise.resolve(jsonResponse(200, world.calibration ?? []));
      }
      if (url.includes('/audit_logs')) {
        if (method === 'POST') {
          world.auditWrites?.push(String(init?.body));
          return Promise.resolve(new Response(null, { status: 201 }));
        }
        return Promise.resolve(jsonResponse(200, world.audit ?? []));
      }
      if (url.includes('/tutor_live_content_log')) {
        if (url.includes('review_verdict=eq.rejected')) return Promise.resolve(jsonResponse(200, world.latestIssue ?? []));
        if (url.includes('review_verdict=eq.approved')) return Promise.resolve(jsonResponse(200, Array.from({ length: world.clean ?? 0 }, (_, i) => ({ id: String(i) }))));
        if (url.includes('calibration_id=eq.')) return Promise.resolve(jsonResponse(200, world.concordanceRows ?? []));
        if (url.includes('created_at=gte.')) return Promise.resolve(jsonResponse(200, world.coverageRows ?? []));
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }),
  );
}

describe('C.5 the gate from the database', () => {
  beforeEach(() => resetLiveContentGateCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLiveContentGateCache();
  });

  it('suspends every category while the judge is uncalibrated (the state until the owner runs it)', async () => {
    stubWorld({});
    const gate = await getLiveContentGate(NOW);
    expect(gate.degraded).toBe(false);
    expect(gate.categories.standard).toMatchObject({ suspended: true, reasons: ['uncalibrated'] });
    expect(gate.categories.sensitive).toMatchObject({ suspended: true, reasons: ['uncalibrated'] });
  });

  it('opens with a passed, current calibration and clean history', async () => {
    stubWorld({ calibration: [PASSED] });
    const gate = await getLiveContentGate(NOW);
    expect(gate.categories.standard).toMatchObject({ suspended: false, sampling: { rate: 0.15, elevated: false } });
    expect(gate.categories.sensitive).toMatchObject({ suspended: false, sampling: { rate: 0.5 } });
  });

  it('elevates a category after a staff rejection', async () => {
    stubWorld({ calibration: [PASSED], latestIssue: [{ reviewed_at: daysAgo(1) }], clean: 30 });
    const gate = await getLiveContentGate(NOW);
    expect(gate.categories.standard.sampling).toMatchObject({ elevated: true, rate: 0.5, cleanBatches: 1, decisionsToRestore: 70 });
  });

  it('TRIPS on concordance below the floor, writes the audit row, and suspends', async () => {
    const auditWrites: string[] = [];
    stubWorld({
      calibration: [PASSED],
      concordanceRows: [...Array(16).fill({ review_verdict: 'approved' }), ...Array(4).fill({ review_verdict: 'rejected' })],
      auditWrites,
    });
    const gate = await getLiveContentGate(NOW);
    expect(gate.categories.standard.reasons).toContain('concordance_below_floor');
    expect(auditWrites.some((w) => w.includes(LIVE_CONTENT_KILL_SWITCH_TRIGGERED) && w.includes('concordance_below_floor'))).toBe(true);
  });

  it('TRIPS when staff review falls below the floor', async () => {
    const auditWrites: string[] = [];
    stubWorld({
      calibration: [PASSED],
      coverageRows: Array.from({ length: 40 }, (_, i) => ({ sampled: i < 6, reviewed_at: i < 2 ? daysAgo(10) : null, sample_rate: 0.15 })),
      auditWrites,
    });
    const gate = await getLiveContentGate(NOW);
    expect(gate.categories.standard.reasons).toContain('review_rate_below_floor');
    expect(auditWrites.join()).toContain('review_rate_below_floor');
  });

  it('holds an open trip from the log without re-evaluating it', async () => {
    stubWorld({
      calibration: [PASSED],
      audit: [{ action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(2), detail: { category: 'sensitive', cause: 'concordance_below_floor' } }],
    });
    const gate = await getLiveContentGate(NOW);
    expect(gate.categories.sensitive.reasons).toEqual(['concordance_below_floor']);
    expect(gate.categories.standard.suspended).toBe(false);
  });

  it('fails CLOSED when it cannot read its state', async () => {
    stubWorld({ calibration: 'fail' });
    const gate = await getLiveContentGate(NOW);
    expect(gate.degraded).toBe(true);
    expect(admitLiveCandidate(gate, 'standard', 'qwen3-max', HASH)).toEqual({ admitted: false, reason: 'gate_unavailable' });
  });

  it('refuses to resolve a concordance trip before a passed calibration recorded after it', async () => {
    stubWorld({
      calibration: [PASSED],
      audit: [{ action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(1), detail: { category: 'standard', cause: 'concordance_below_floor' } }],
    });
    const refused = await resolveLiveContentKillSwitch({ category: 'standard', cause: 'concordance_below_floor', note: 'root cause found', now: NOW });
    expect(refused).toMatchObject({ ok: false });
    expect((refused as { why: string }).why).toContain('after the trip');

    const auditWrites: string[] = [];
    stubWorld({
      calibration: [{ ...PASSED, created_at: new Date(NOW.getTime() - 3_600_000).toISOString() }],
      audit: [{ action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(1), detail: { category: 'standard', cause: 'concordance_below_floor' } }],
      auditWrites,
    });
    expect(await resolveLiveContentKillSwitch({ category: 'standard', cause: 'concordance_below_floor', note: 'recalibrated judge', now: NOW })).toEqual({ ok: true });
    expect(auditWrites.join()).toContain(LIVE_CONTENT_KILL_SWITCH_RESOLVED);
  });

  it('refuses to resolve a review-rate trip while coverage is still below the floor', async () => {
    stubWorld({
      calibration: [PASSED],
      audit: [{ action: LIVE_CONTENT_KILL_SWITCH_TRIGGERED, created_at: daysAgo(1), detail: { category: 'standard', cause: 'review_rate_below_floor' } }],
      coverageRows: Array.from({ length: 40 }, () => ({ sampled: true, reviewed_at: null, sample_rate: 0.15 })),
    });
    const result = await resolveLiveContentKillSwitch({ category: 'standard', cause: 'review_rate_below_floor', note: 'backlog cleared', now: NOW });
    expect(result).toMatchObject({ ok: false });
  });
});
