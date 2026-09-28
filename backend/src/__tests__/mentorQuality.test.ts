import { describe, expect, it } from 'vitest';
import {
  dedupKey,
  disparities,
  evaluateSignals,
  FLAG_KINDS,
  freshness,
  isoWeekStart,
  MENTOR_QUALITY_THRESHOLDS as T,
  openKillSwitches,
  OWNER_ROLES,
  reviewCompletion,
  SIGNALS,
  type QualitySources,
  type ScoreRow,
  type WindowSessionRow,
} from '../services/pedagogy/mentorQuality.js';
import { RULES_CRITERIA, TRANSCRIPT_RUBRIC_HASH } from '../services/pedagogy/transcriptRubric.js';
import type { AllianceSessionRow } from '../services/pedagogy/alliance.js';

/*
 * S06.13 — C.24's consolidated signals and C.21's anomaly flags, decided
 * purely from fetched rows: every threshold kind, every flag kind, the
 * disparity rules (persona and demographic subgroup), honest "not
 * instrumented" rows, fail-closed sources, freshness and owner review.
 */

const NOW = new Date('2026-09-25T12:00:00Z');
const recent = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** C.23: a passed, fresh transcript-judge calibration (the calm baseline). */
const TRANSCRIPT_CALIBRATION = {
  id: 'cal-1', judge_id: 'transcript_judge', kind: 'calibration' as const, verifies_calibration_id: null, judge_model: 'qwen3-max',
  judge_prompt_hash: 'a'.repeat(64), seed_set_version: 'transcript-gold.v1', verdict: 'passed' as const, scope: ['tell_honored'],
  created_at: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
};

function empty(): QualitySources {
  return {
    now: NOW,
    rubricHash: TRANSCRIPT_RUBRIC_HASH,
    sessions: [],
    scores: [],
    priorScores: [],
    firings: [],
    endSignals: [],
    alliance: [],
    allianceBaseline: [],
    renegotiations: [],
    trajectory: [],
    routing: [],
    dialogue: [],
    ladder: [],
    liveGate: { calibration: 'passed', suspended: [] },
    judgeCalibrations: [TRANSCRIPT_CALIBRATION],
    killSwitchAudit: [],
    completeness: { active: 0, current: 0 },
    kcAttempts: [],
    retention: [],
    engagementHealth: {
      weeks: 12,
      sessionEfficiency: { weekly: [], trend: 'insufficient_data' },
      mentorResolution: { weekly: [], trend: 'insufficient_data' },
      thresholds: { windowWeeks: 4, tolerance: 0.1, minWeeklySample: 20 },
    },
    narrative: {
      journal_entries_recorded: 0, journal_entries_resurfaced: 0, bridge_prompts_offered: 0, bridge_prompts_converted_7d: 0,
      bridge_self_commitments: 0, bridge_prompts_dismissed: 0, bridge_prompts_expired: 0,
    },
    restDays: { learners_with_lapse: 0, kept_by_rest_days: 0, restarted: 0, utilization_rate: null, rest_days_used: 0 },
    autonomy: [],
  };
}

function score(criterion: string, outcome: ScoreRow['outcome'], patch: Partial<ScoreRow> = {}): ScoreRow {
  const num = outcome === 'fail' ? 1 : 0;
  return {
    session_id: null, character: 'dina', tier: 2, locale: 'en-US', criterion, outcome,
    numerator: outcome === 'not_applicable' ? 0 : num, denominator: outcome === 'not_applicable' ? 0 : 1,
    session_ended_at: recent(2), ...patch,
  };
}

function session(i: number, patch: Partial<WindowSessionRow> = {}): WindowSessionRow {
  return {
    id: `s${i}`, character: 'dina', tier: 2, locale: 'en-US', ended_at: recent(1), turn_count: 6,
    evaluation_rubric_hash: TRANSCRIPT_RUBRIC_HASH, close_reason: 'completed', closing_script: 'completed', opening: 'greeting',
    end_signal_evaluated: true, telemetry_mode: 'act', telemetry_evaluated_turns: 10, telemetry_action_turns: 1, ...patch,
  };
}

const readingOf = (r: ReturnType<typeof evaluateSignals>, id: string) => r.readings.find((x) => x.id === id)!;

describe('C.24 registry', () => {
  it('names an owner, a requirement and a category for every signal, with unique ids', () => {
    expect(new Set(SIGNALS.map((s) => s.id)).size).toBe(SIGNALS.length);
    for (const s of SIGNALS) {
      expect(OWNER_ROLES, s.id).toContain(s.owner);
      expect(s.requirement, s.id).toMatch(/^[BC]\.\d{1,2}$/);
      expect(s.id, s.id).toMatch(/^[a-z_]+\.[a-z_]+$/);
      if (s.instrumented !== 'yes') expect(s.pending, s.id).toBeTruthy();
    }
  });

  it('consolidates the Mentor signals C.24 names and Appendix C learning and engagement metrics', () => {
    const ids = SIGNALS.map((s) => s.id);
    for (const id of ['rubric.answer_reveal', 'alliance.bond_proxy', 'telemetry.friction_rate', 'content_ladder.distribution']) expect(ids).toContain(id);
    expect(SIGNALS.some((s) => s.category === 'learning_outcome')).toBe(true);
    expect(SIGNALS.some((s) => s.category === 'engagement_health')).toBe(true);
    // Every rule-scored rubric criterion is on the dashboard.
    for (const c of RULES_CRITERIA) expect(ids).toContain(`rubric.${c}`);
  });

  it('shows a metric with no data source as not instrumented, never as healthy', () => {
    const r = evaluateSignals(empty());
    expect(readingOf(r, 'engagement.streak_anxiety').status).toBe('not_instrumented');
    expect(readingOf(r, 'learning.judgment_quality').status).toBe('not_instrumented');
    // Instrumented since gap-fix round 1: empty sources read as insufficient data, never as healthy.
    for (const id of ['engagement.session_efficiency', 'engagement.mentor_resolution', 'learning.decision_journal', 'learning.bridge_conversion', 'engagement.rest_day_use', 'engagement.autonomy_adoption', 'rubric.tell_honored']) {
      expect(readingOf(r, id).status, id).toBe('insufficient_data');
    }
    expect(readingOf(r, 'bias_audit.coverage').status).toBe('external');
    expect(r.anomalies).toEqual([]);
  });
});

describe('C.21 fail closed', () => {
  it('turns every unreadable source into an unavailable signal and an urgent flag for engineering', () => {
    const src: QualitySources = { ...empty(), scores: null, sessions: null, trajectory: null, alliance: null, killSwitchAudit: null, liveGate: null, kcAttempts: null };
    const r = evaluateSignals(src);
    for (const id of ['rubric.answer_reveal', 'evaluation.coverage', 'mastery.reversal_rate', 'alliance.bond_proxy', 'kill_switch.open', 'judge.content_calibration', 'learning.practice_success_band']) {
      expect(readingOf(r, id).status, id).toBe('unavailable');
      expect(r.anomalies.some((a) => a.signalId === id && a.kind === 'source_unavailable' && a.owner === 'engineering_lead' && a.severity === 'urgent'), id).toBe(true);
    }
  });
});

describe('C.21 anomaly flags from transcript scores', () => {
  it('opens an urgent zero-tolerance flag for ONE delivered false affirmation, whatever the sample', () => {
    const src = { ...empty(), scores: [score('false_affirmation', 'fail'), ...Array.from({ length: 40 }, () => score('false_affirmation', 'pass'))] };
    const r = evaluateSignals(src);
    expect(readingOf(r, 'rubric.false_affirmation').status).toBe('breach');
    const flag = r.anomalies.find((a) => a.signalId === 'rubric.false_affirmation');
    expect(flag).toMatchObject({ kind: 'zero_tolerance', severity: 'urgent', owner: 'pedagogical_lead', requirement: 'C.18', scope: 'all' });
  });

  it('routes a declared emotion to the Safety/Trust Lead', () => {
    const r = evaluateSignals({ ...empty(), scores: [score('emotion_label', 'fail')] });
    expect(r.anomalies.find((a) => a.signalId === 'rubric.emotion_label')).toMatchObject({ kind: 'zero_tolerance', owner: 'safety_trust_lead' });
  });

  it('flags an answer-reveal spike per persona over the ceiling, only once the sample is met', () => {
    const rows = (character: string, reveals: number, turns: number) =>
      [{ ...score('answer_reveal', reveals / turns > 0.1 ? 'fail' : 'pass', { character }), numerator: reveals, denominator: turns }];
    const small = evaluateSignals({ ...empty(), scores: rows('rho', 3, 10) });
    expect(readingOf(small, 'rubric.answer_reveal').status).toBe('insufficient_data');
    expect(small.anomalies.filter((a) => a.kind === 'threshold_breach')).toEqual([]);
    const big = evaluateSignals({ ...empty(), scores: [...rows('rho', 12, 60), ...rows('dina', 1, 60)] });
    expect(big.anomalies.some((a) => a.kind === 'threshold_breach' && a.scope === 'persona:rho')).toBe(true);
    expect(big.anomalies.some((a) => a.kind === 'threshold_breach' && a.scope === 'persona:dina')).toBe(false);
  });

  it('flags upward drift of a persona reveal rate against the previous window', () => {
    const now = [{ ...score('answer_reveal', 'pass', { character: 'zara' }), numerator: 5, denominator: 60 }];
    const before = [{ ...score('answer_reveal', 'pass', { character: 'zara', session_ended_at: recent(40) }), numerator: 1, denominator: 60 }];
    const r = evaluateSignals({ ...empty(), scores: now, priorScores: before });
    expect(r.anomalies.find((a) => a.kind === 'upward_drift')).toMatchObject({ scope: 'persona:zara', signalId: 'rubric.answer_reveal' });
    const flat = evaluateSignals({ ...empty(), scores: now, priorScores: [{ ...before[0]!, numerator: 5 }] });
    expect(flat.anomalies.some((a) => a.kind === 'upward_drift')).toBe(false);
  });

  it('flags a goal-agreement floor miss', () => {
    const rows = [...Array.from({ length: 45 }, () => score('goal_agreement', 'pass', { numerator: 1, denominator: 1 })), ...Array.from({ length: 10 }, () => score('goal_agreement', 'fail', { numerator: 0, denominator: 1 }))];
    const r = evaluateSignals({ ...empty(), scores: rows });
    expect(readingOf(r, 'rubric.goal_agreement')).toMatchObject({ status: 'breach' });
    expect(r.anomalies.some((a) => a.signalId === 'rubric.goal_agreement' && a.kind === 'threshold_breach' && a.scope === 'all')).toBe(true);
  });

  it('flags a persona disparity and, within a persona, a demographic subgroup disparity', () => {
    const many = (n: number, outcome: 'pass' | 'fail', patch: Partial<ScoreRow>) =>
      Array.from({ length: n }, () => ({ ...score('answer_reveal', outcome, patch), numerator: outcome === 'fail' ? 1 : 0, denominator: 5 }));
    // Persona: liruf fails 40% of sessions, the others 5%.
    const persona = [...many(12, 'fail', { character: 'liruf' }), ...many(18, 'pass', { character: 'liruf' }), ...many(3, 'fail', { character: 'dina' }), ...many(57, 'pass', { character: 'dina' })];
    const p = evaluateSignals({ ...empty(), scores: persona });
    expect(p.anomalies.find((a) => a.kind === 'persona_disparity')).toMatchObject({ scope: 'persona:liruf', owner: 'pedagogical_lead' });
    // Subgroup: within dina, tier 1 fails 30%, tiers 2-3 fail 3%.
    const sub = [...many(10, 'fail', { tier: 1 }), ...many(23, 'pass', { tier: 1 }), ...many(1, 'fail', { tier: 3 }), ...many(32, 'pass', { tier: 3 })];
    const s = evaluateSignals({ ...empty(), scores: sub });
    expect(s.anomalies.find((a) => a.kind === 'subgroup_disparity')).toMatchObject({ scope: 'persona:dina/tier:1', owner: 'safety_trust_lead' });
  });

  it('flags a demographic subgroup with disproportionate disengagement signals (friction)', () => {
    const sessions = [
      ...Array.from({ length: 30 }, (_, i) => session(i, { locale: 'es-MX' })),
      ...Array.from({ length: 30 }, (_, i) => session(100 + i, { locale: 'en-US' })),
    ];
    const firings = [
      ...Array.from({ length: 15 }, (_, i) => ({ session_id: `s${i}`, character: 'dina', mode: 'act', outcome: 'aligned' })),
      ...Array.from({ length: 2 }, (_, i) => ({ session_id: `s${100 + i}`, character: 'dina', mode: 'act', outcome: 'aligned' })),
    ];
    const r = evaluateSignals({ ...empty(), sessions, firings });
    expect(readingOf(r, 'telemetry.friction_rate').status).toBe('breach');
    expect(r.anomalies.find((a) => a.signalId === 'telemetry.friction_rate')).toMatchObject({ kind: 'subgroup_disparity', scope: 'persona:dina/locale:es-MX', owner: 'safety_trust_lead' });
  });

  it('requires a real gap AND a real ratio AND a real sample for a disparity', () => {
    expect(disparities([{ key: 'a', hits: 2, n: 29 }, { key: 'b', hits: 0, n: 100 }])).toEqual([]);
    expect(disparities([{ key: 'a', hits: 12, n: 100 }, { key: 'b', hits: 8, n: 100 }])).toEqual([]);
    expect(disparities([{ key: 'a', hits: 3, n: 100 }, { key: 'b', hits: 1, n: 100 }])).toEqual([]);
    expect(disparities([{ key: 'a', hits: 20, n: 100 }, { key: 'b', hits: 5, n: 100 }]).map((d) => d.key)).toEqual(['a']);
  });
});

describe('C.24 non-rubric signals', () => {
  it('flags the bond proxy dropping more than 15% below a persona baseline, and a persona clearly below the others', () => {
    const row = (character: string, answer: 'yes' | 'partly' | 'no', created: string): AllianceSessionRow => ({
      character, mode: 'act', continuity: null, continuity_move: 'not_needed', goal_agreement: 'agreed', learner_turns: 5,
      adaptation_offers: 0, adaptation_declines: 0, bond_specific_turns: 1, bond_generic_turns: 0, bond_proxy: answer, bond_proxy_at: created, created_at: created,
    });
    const baseline = Array.from({ length: 60 }, () => row('rho', 'yes', recent(60)));
    const current = [
      ...Array.from({ length: 20 }, () => row('rho', 'yes', recent(3))),
      ...Array.from({ length: 20 }, () => row('rho', 'no', recent(3))),
      ...Array.from({ length: 40 }, () => row('dina', 'yes', recent(3))),
    ];
    const r = evaluateSignals({ ...empty(), alliance: current, allianceBaseline: baseline });
    expect(readingOf(r, 'alliance.bond_proxy').status).toBe('breach');
    expect(r.anomalies.some((a) => a.kind === 'relative_drop' && a.scope === 'persona:rho')).toBe(true);
    expect(r.anomalies.some((a) => a.kind === 'persona_disparity' && a.scope === 'persona:rho')).toBe(true);
  });

  it('measures evaluation coverage over due sessions only, and flags it under the floor', () => {
    const sessions = [
      ...Array.from({ length: 18 }, (_, i) => session(i)),
      ...Array.from({ length: 4 }, (_, i) => session(50 + i, { evaluation_rubric_hash: null })),
      // Ended two minutes ago: inside the grace, not yet due, not a gap.
      session(90, { evaluation_rubric_hash: null, ended_at: new Date(NOW.getTime() - 2 * 60_000).toISOString() }),
      // No turns: never scored, never counted.
      session(91, { evaluation_rubric_hash: null, turn_count: 0 }),
    ];
    const r = evaluateSignals({ ...empty(), sessions });
    const c = readingOf(r, 'evaluation.coverage');
    expect(c.sample).toBe(22);
    expect(c.value).toBeCloseTo(18 / 22);
    expect(c.status).toBe('breach');
    expect(r.anomalies.find((a) => a.signalId === 'evaluation.coverage')).toMatchObject({ owner: 'engineering_lead', threshold: T.coverageFloor });
  });

  it('lists every Stage 7 rollback still in force, per component (live content per category and cause)', () => {
    const audit = [
      { action: 'mentor.kill_switch.alliance.triggered', created_at: recent(5), detail: {} },
      { action: 'mentor.kill_switch.alliance.resolved', created_at: recent(4), detail: {} },
      { action: 'mentor.kill_switch.behavioral_telemetry.triggered', created_at: recent(2), detail: {} },
      { action: 'mentor.kill_switch.live_content.triggered', created_at: recent(3), detail: { category: 'sensitive', cause: 'concordance_below_floor' } },
      { action: 'mentor.kill_switch.live_content.triggered', created_at: recent(3), detail: { category: 'standard', cause: 'review_rate_below_floor' } },
      { action: 'mentor.kill_switch.live_content.resolved', created_at: recent(1), detail: { category: 'standard', cause: 'review_rate_below_floor' } },
    ];
    expect(openKillSwitches(audit).map((o) => o.key)).toEqual(['behavioral_telemetry', 'live_content:sensitive:concordance_below_floor']);
    const r = evaluateSignals({ ...empty(), killSwitchAudit: audit });
    expect(readingOf(r, 'kill_switch.open')).toMatchObject({ status: 'breach', value: 2 });
    expect(r.anomalies.filter((a) => a.signalId === 'kill_switch.open').map((a) => a.scope)).toEqual([
      'component:behavioral_telemetry',
      'component:live_content:sensitive:concordance_below_floor',
    ]);
  });

  it('treats an uncalibrated content judge as a breach for the Safety/Trust Lead', () => {
    const r = evaluateSignals({ ...empty(), liveGate: { calibration: 'uncalibrated', suspended: [{ category: 'standard', reasons: ['uncalibrated'] }] } });
    expect(readingOf(r, 'judge.content_calibration').status).toBe('breach');
    expect(r.anomalies.find((a) => a.signalId === 'judge.content_calibration')).toMatchObject({ owner: 'safety_trust_lead', scope: 'all' });
  });

  it('reads the practice success band (70-85%) and time to mastery from Mentor practice', () => {
    const attempts = Array.from({ length: 40 }, (_, i) => ({ user_id: `u${i % 4}`, kc_id: 'k1', correct: i % 10 !== 0, p_known_after: i % 10 >= 2 ? 0.9 : 0.5, created_at: recent(3) }));
    const r = evaluateSignals({ ...empty(), kcAttempts: attempts });
    expect(readingOf(r, 'learning.practice_success_band')).toMatchObject({ status: 'breach', value: 0.9 });
    expect(readingOf(r, 'learning.practice_success_band').breakdown[0]).toMatchObject({ key: 'kc:k1', status: 'breach' });
    expect(readingOf(r, 'learning.time_to_mastery').status).toBe('diagnostic');
    // u0, u1 reach the bar on their 2nd attempt, u2, u3 on their 1st: median 1.5.
    expect(readingOf(r, 'learning.time_to_mastery').value).toBe(1.5);
  });

  it('never reports a diagnostic signal as a breach on its own', () => {
    const sessions = Array.from({ length: 60 }, (_, i) => session(i));
    const r = evaluateSignals({ ...empty(), sessions, scores: sessions.map(() => score('praise_specificity', 'observed', { numerator: 0, denominator: 3 })) });
    expect(readingOf(r, 'rubric.praise_specificity').status).toBe('diagnostic');
    expect(r.anomalies.filter((a) => a.signalId === 'rubric.praise_specificity')).toEqual([]);
  });
});

describe('C.24 flags, freshness and owner review', () => {
  it('uses only the migration-mirrored flag kinds and a stable de-duplication key', () => {
    const r = evaluateSignals({ ...empty(), scores: [score('false_affirmation', 'fail')], liveGate: { calibration: 'stale', suspended: [] } });
    for (const a of r.anomalies) {
      expect(FLAG_KINDS).toContain(a.kind);
      expect(a.scope).toMatch(/^[a-z]+(:[A-Za-z0-9_.:-]+)?(\/[a-z]+:[A-Za-z0-9_.:-]+)*$/);
    }
    expect(dedupKey({ signalId: 'rubric.false_affirmation', kind: 'zero_tolerance', scope: 'all' })).toBe('rubric.false_affirmation|zero_tolerance|all');
  });

  it('calls a snapshot older than 24 hours stale, and a missing one stale', () => {
    expect(freshness(new Date(NOW.getTime() - 23 * 3_600_000).toISOString(), NOW).stale).toBe(false);
    expect(freshness(new Date(NOW.getTime() - 25 * 3_600_000).toISOString(), NOW).stale).toBe(true);
    expect(freshness(null, NOW)).toEqual({ ageHours: null, stale: true });
  });

  it('judges named-owner review on the last complete ISO week and lists roles with no named owner', () => {
    expect(isoWeekStart(NOW)).toBe('2026-09-21');
    const owners = [{ owner_role: 'pedagogical_lead', user_id: 'a' }, { owner_role: 'safety_trust_lead', user_id: 'b' }];
    const reviews = [
      { owner_role: 'pedagogical_lead', reviewer_id: 'a', week_start: '2026-09-14' },
      { owner_role: 'safety_trust_lead', reviewer_id: 'a', week_start: '2026-09-14' },
      { owner_role: 'safety_trust_lead', reviewer_id: 'b', week_start: '2026-09-21' },
    ];
    const c = reviewCompletion(owners, reviews, NOW);
    expect(c).toMatchObject({ week: '2026-09-21', previousWeek: '2026-09-14', named: 2, reviewedPreviousWeek: 1, reviewedThisWeek: 1, previousRate: 0.5 });
    expect(c.missingRoles).toEqual(['engineering_lead']);
  });
});

describe('C.24 x Appendix C: the sources that already existed are read (gap-fix round 1)', () => {
  const weeks = (values: number[], sample = 30) =>
    values.map((v, i) => ({ week_start: `2026-0${Math.floor(i / 4) + 6}-${String((i % 4) * 7 + 1).padStart(2, '0')}`, value: v, sample }));

  it('flags a B.28 session-efficiency regression (higher is better) for the owner, never reads more time as success', () => {
    const points = weeks([0.6, 0.6, 0.6, 0.6, 0.4, 0.4, 0.4, 0.4]);
    const src = {
      ...empty(),
      engagementHealth: {
        ...empty().engagementHealth!,
        sessionEfficiency: {
          weekly: points.map((p) => ({ week_start: p.week_start, learners: p.sample, graded_seconds: 1, session_seconds: 2, efficiency_ratio: p.value })),
          trend: 'regression' as const,
        },
      },
    };
    const r = evaluateSignals(src);
    expect(readingOf(r, 'engagement.session_efficiency')).toMatchObject({ status: 'breach', value: 0.4 });
    expect(r.anomalies.some((a) => a.signalId === 'engagement.session_efficiency' && a.kind === 'relative_drop' && a.owner === 'pedagogical_lead')).toBe(true);
  });

  it('flags a rise in Mentor resolution turns (lower is better) and leaves a fall alone', () => {
    const rows = (values: number[]) =>
      weeks(values).map((p) => ({ week_start: p.week_start, intent: 'all', resolved_sessions: p.sample, median_turns: p.value, p75_turns: p.value + 1 }));
    const withTurns = (values: number[]) => ({
      ...empty(),
      engagementHealth: { ...empty().engagementHealth!, mentorResolution: { weekly: rows(values), trend: 'insufficient_data' as const } },
    });
    expect(readingOf(evaluateSignals(withTurns([4, 4, 4, 4, 6, 6, 6, 6])), 'engagement.mentor_resolution').status).toBe('breach');
    expect(readingOf(evaluateSignals(withTurns([6, 6, 6, 6, 4, 4, 4, 4])), 'engagement.mentor_resolution').status).toBe('ok');
  });

  it('reads B.9 resurfacing, B.13 conversion (self commitments apart), B.21 rest days and B.24 adoption as diagnostics', () => {
    const r = evaluateSignals({
      ...empty(),
      narrative: {
        journal_entries_recorded: 40, journal_entries_resurfaced: 10, bridge_prompts_offered: 25, bridge_prompts_converted_7d: 5,
        bridge_self_commitments: 3, bridge_prompts_dismissed: 4, bridge_prompts_expired: 2,
      },
      restDays: { learners_with_lapse: 30, kept_by_rest_days: 12, restarted: 18, utilization_rate: 0.4, rest_days_used: 20 },
      autonomy: [
        { lever: 'path', offered: 20, exercised: 10, adoption_rate: 0.5 },
        { lever: 'pace', offered: 10, exercised: 2, adoption_rate: 0.2 },
      ],
    });
    expect(readingOf(r, 'learning.decision_journal')).toMatchObject({ status: 'diagnostic', value: 0.25, sample: 40 });
    expect(readingOf(r, 'learning.bridge_conversion')).toMatchObject({ status: 'diagnostic', value: 0.2, detail: expect.objectContaining({ selfCommitments: 3 }) });
    expect(readingOf(r, 'engagement.rest_day_use')).toMatchObject({ status: 'diagnostic', value: 0.4, sample: 30 });
    expect(readingOf(r, 'engagement.autonomy_adoption')).toMatchObject({ status: 'diagnostic', value: 0.4, sample: 30 });
    expect(r.anomalies).toEqual([]);
  });

  it('fails closed: an unreachable RPC is an unavailable signal and an urgent flag for engineering', () => {
    const r = evaluateSignals({ ...empty(), engagementHealth: null, narrative: null, restDays: null, autonomy: null });
    for (const id of ['engagement.session_efficiency', 'engagement.mentor_resolution', 'learning.decision_journal', 'learning.bridge_conversion', 'engagement.rest_day_use', 'engagement.autonomy_adoption']) {
      expect(readingOf(r, id).status, id).toBe('unavailable');
      expect(r.anomalies.some((a) => a.signalId === id && a.kind === 'source_unavailable'), id).toBe(true);
    }
  });

  it('reads rubric.tell_honored from the rule scores as a hard invariant: one unhonoured request is urgent', () => {
    const r = evaluateSignals({ ...empty(), scores: [score('tell_honored', 'fail'), score('tell_honored', 'pass')] });
    expect(readingOf(r, 'rubric.tell_honored').status).toBe('breach');
    expect(r.anomalies.some((a) => a.signalId === 'rubric.tell_honored' && a.severity === 'urgent')).toBe(true);
  });
});
