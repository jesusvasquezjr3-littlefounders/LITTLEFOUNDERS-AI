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
  RETIRED_SIGNALS,
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
    learning: {
      judgment: [],
      narrative: { journal_entries_recorded: 0, journal_entries_resurfaced: 0, bridge_prompts_offered: 0, bridge_prompts_converted_7d: 0, bridge_self_commitments: 0 },
      sessionEfficiency: [],
      mentorResolution: [],
      restDays: { learners_with_lapse: 0, kept_by_rest_days: 0, utilization_rate: null, rest_days_used: 0 },
      autonomy: [],
    },
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
    // GAP-FIX-R2: every Appendix C signal now has a source; streak anxiety is retired with its reason, never silently dropped.
    expect(SIGNALS.filter((s) => s.instrumented === 'not_instrumented').map((s) => s.id)).toEqual([]);
    expect(r.readings.some((x) => x.id === 'engagement.streak_anxiety')).toBe(false);
    expect(RETIRED_SIGNALS.find((x) => x.id === 'engagement.streak_anxiety')?.reason).toMatch(/no\s+streak-at-risk notification/);
    // Instrumented since gap-fix rounds 1 and 2: empty sources read as insufficient data, never as healthy.
    for (const id of ['learning.judgment_quality', 'learning.transfer_success', 'engagement.session_efficiency', 'engagement.mentor_resolution', 'learning.decision_journal', 'learning.bridge_conversion', 'engagement.rest_day_use', 'engagement.autonomy_adoption', 'rubric.tell_honored',
      'engagement.dark_pattern_audit', 'engagement.variable_ratio_audit', 'engagement.reward_framing', 'engagement.parent_time_to_value']) {
      expect(readingOf(r, id).status, id).toBe('insufficient_data');
    }
    expect(readingOf(r, 'bias_audit.coverage').status).toBe('external');
    expect(r.anomalies).toEqual([]);
  });
});

describe('GAP-FIX-R4: Delayed Retention as Appendix C 1.1 defines it', () => {
  const cell = (kc: string, days: number, learners: number, correct: number) => ({ kc_key: kc, window_days: days, learners, correct });

  it('is judged release over release, not diagnostic', () => {
    const def = SIGNALS.find((s) => s.id === 'learning.delayed_retention')!;
    expect(def.threshold).toEqual({ kind: 'release_non_decline', value: T.retentionDeclineTolerance });
    expect(def.minSample).toBe(T.retentionMinLearners);
    expect(def.source).toMatch(/learning_delayed_retention/);
    expect(def.source).not.toMatch(/admin_retention_at_distance/);
  });

  it('with no recorded release, reads the period as the release-1 baseline being set (diagnostic, never a pass)', () => {
    const r = evaluateSignals({ ...empty(), retention: [cell('money.saving', 30, 40, 32), cell('money.saving', 60, 10, 6)], retentionBaseline: null });
    const reading = readingOf(r, 'learning.delayed_retention');
    expect(reading).toMatchObject({ status: 'diagnostic', value: 38 / 50, sample: 50 });
    expect(reading.detail).toMatchObject({ baselineRelease: null, kcs: 1 });
    expect(reading.breakdown.map((b) => [b.key, b.status])).toEqual([['kc:money.saving/days:30', 'diagnostic'], ['kc:money.saving/days:60', 'diagnostic']]);
    expect(r.anomalies.filter((a) => a.signalId === 'learning.delayed_retention')).toEqual([]);
  });

  it('breaches one KC x window that fell more than the tolerance below the latest release, and passes a flat one', () => {
    const r = evaluateSignals({
      ...empty(),
      retention: [cell('money.saving', 30, 40, 28), cell('money.saving', 90, 30, 24), cell('money.pricing', 60, 25, 20), cell('money.pricing', 30, 5, 0)],
      retentionBaseline: { releaseId: '2026.09.1', cells: [cell('money.saving', 30, 50, 40), cell('money.saving', 90, 30, 24), cell('money.pricing', 60, 30, 23), cell('money.pricing', 30, 30, 24)] },
    });
    const reading = readingOf(r, 'learning.delayed_retention');
    expect(reading.status).toBe('breach');
    const byKey = Object.fromEntries(reading.breakdown.map((b) => [b.key, b.status]));
    // 70% against 80%: a decline. 80% against 80%: flat is the floor. 80% against 76.7%: an improvement. 5 learners: too few to judge.
    expect(byKey).toEqual({
      'kc:money.pricing/days:30': 'insufficient_data', 'kc:money.pricing/days:60': 'ok',
      'kc:money.saving/days:30': 'breach', 'kc:money.saving/days:90': 'ok',
    });
    const flags = r.anomalies.filter((a) => a.signalId === 'learning.delayed_retention');
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: 'relative_drop', scope: 'kc:money.saving/days:30', value: 0.7, threshold: 0.8, owner: 'pedagogical_lead', requirement: 'B.6' });
    // The flag scope fits the flag table's CHECK (0145).
    expect(flags[0]!.scope).toMatch(/^[a-z]+(:[A-Za-z0-9_.:-]+)?(\/[a-z]+:[A-Za-z0-9_.:-]+)*$/);
  });

  it('is ok when every compared cell held, and unavailable when the read failed', () => {
    const held = evaluateSignals({ ...empty(), retention: [cell('money.saving', 30, 40, 31)], retentionBaseline: { releaseId: 'r1', cells: [cell('money.saving', 30, 40, 32)] } });
    expect(readingOf(held, 'learning.delayed_retention').status).toBe('ok');
    const failed = evaluateSignals({ ...empty(), retention: null });
    expect(readingOf(failed, 'learning.delayed_retention').status).toBe('unavailable');
    expect(failed.anomalies.some((a) => a.signalId === 'learning.delayed_retention' && a.kind === 'source_unavailable')).toBe(true);
  });
});

describe('C.24 consolidates the Learning Quality tab (Appendix C 1.1 and 1.2)', () => {
  const week = (i: number) => new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString().slice(0, 10);
  const learning = (patch: Partial<QualitySources['learning']>): QualitySources => ({ ...empty(), learning: { ...empty().learning, ...patch } });

  it('marks the seven Block B metrics instrumented, with their Appendix C threshold kind', () => {
    const kinds = Object.fromEntries(SIGNALS.map((s) => [s.id, [s.instrumented, s.threshold.kind]]));
    expect(kinds['learning.judgment_quality']).toEqual(['yes', 'floor']);
    expect(kinds['learning.bridge_conversion']).toEqual(['yes', 'diagnostic']);
    expect(kinds['learning.decision_journal']).toEqual(['yes', 'diagnostic']);
    expect(kinds['engagement.session_efficiency']).toEqual(['yes', 'trend']);
    expect(kinds['engagement.mentor_resolution']).toEqual(['yes', 'trend']);
    expect(kinds['engagement.rest_day_use']).toEqual(['yes', 'diagnostic']);
    expect(kinds['engagement.autonomy_adoption']).toEqual(['yes', 'diagnostic']);
  });

  it('breaches judgment quality when it tracks correctness, and reads the narrative, rest-day and autonomy rates', () => {
    const r = evaluateSignals(learning({
      judgment: [{ lesson_id: 'l1', attempts: 100, correct_not_sound: 3, incorrect_sound: 2 }],
      narrative: { journal_entries_recorded: 40, journal_entries_resurfaced: 16, bridge_prompts_offered: 20, bridge_prompts_converted_7d: 5, bridge_self_commitments: 2 },
      restDays: { learners_with_lapse: 32, kept_by_rest_days: 8, utilization_rate: 0.25, rest_days_used: 12 },
      autonomy: [{ lever: 'path', offered: 10, exercised: 4, adoption_rate: 0.4 }, { lever: 'pace', offered: 10, exercised: 6, adoption_rate: 0.6 }],
    }));
    expect(readingOf(r, 'learning.judgment_quality')).toMatchObject({ status: 'breach', value: 0.05, sample: 100 });
    expect(r.anomalies.some((a) => a.signalId === 'learning.judgment_quality' && a.kind === 'threshold_breach')).toBe(true);
    expect(readingOf(r, 'learning.bridge_conversion')).toMatchObject({ status: 'diagnostic', value: 0.25 });
    expect(readingOf(r, 'learning.decision_journal')).toMatchObject({ status: 'diagnostic', value: 0.4 });
    expect(readingOf(r, 'engagement.rest_day_use')).toMatchObject({ status: 'diagnostic', value: 0.25, sample: 32 });
    expect(readingOf(r, 'engagement.autonomy_adoption')).toMatchObject({ status: 'diagnostic', value: 0.5, sample: 20 });
  });

  it('flags a declining session efficiency and a rising resolution turn count as regressions', () => {
    const series = (from: number, to: number) => Array.from({ length: 8 }, (_, i) => ({ i, v: i < 4 ? from : to }));
    const r = evaluateSignals(learning({
      sessionEfficiency: series(0.6, 0.4).map(({ i, v }) => ({ week_start: week(i), learners: 40, efficiency_ratio: v })),
      mentorResolution: series(4, 6).map(({ i, v }) => ({ week_start: week(i), intent: 'all', resolved_sessions: 40, median_turns: v })),
    }));
    expect(readingOf(r, 'engagement.session_efficiency')).toMatchObject({ status: 'breach', value: 0.4 });
    expect(readingOf(r, 'engagement.mentor_resolution')).toMatchObject({ status: 'breach', value: 6 });
    expect(r.anomalies.find((a) => a.signalId === 'engagement.session_efficiency')?.kind).toBe('relative_drop');
    expect(r.anomalies.find((a) => a.signalId === 'engagement.mentor_resolution')?.kind).toBe('upward_drift');
    const steady = evaluateSignals(learning({
      sessionEfficiency: series(0.5, 0.52).map(({ i, v }) => ({ week_start: week(i), learners: 40, efficiency_ratio: v })),
    }));
    expect(readingOf(steady, 'engagement.session_efficiency').status).toBe('diagnostic');
    expect(readingOf(steady, 'engagement.mentor_resolution').status).toBe('insufficient_data');
  });

  it('turns an unreadable learning source into unavailable, never a calm zero', () => {
    const r = evaluateSignals(learning({ judgment: null, narrative: null, sessionEfficiency: null, mentorResolution: null, restDays: null, autonomy: null }));
    for (const id of ['learning.judgment_quality', 'learning.bridge_conversion', 'learning.decision_journal', 'engagement.session_efficiency', 'engagement.mentor_resolution', 'engagement.rest_day_use', 'engagement.autonomy_adoption']) {
      expect(readingOf(r, id).status, id).toBe('unavailable');
    }
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

  it('shows an Extended Mastery Engine trip (mentor.kill_switch.mastery.*) until an operator resolves it (GAP-FIX-R4)', () => {
    const tripped = [
      { action: 'mentor.kill_switch.mastery.triggered', created_at: recent(3), detail: { kcKeys: ['money.coins.count'], causes: ['reversal_above_ceiling'] } },
      // A second KC joining the same open trip is still one open rollback.
      { action: 'mentor.kill_switch.mastery.triggered', created_at: recent(2), detail: { kcKeys: ['ent.price.set'], causes: ['compliance_below_target'] } },
    ];
    expect(openKillSwitches(tripped)).toEqual([{ key: 'mastery', triggeredAt: recent(3) }]);
    const r = evaluateSignals({ ...empty(), killSwitchAudit: tripped });
    expect(readingOf(r, 'kill_switch.open')).toMatchObject({ status: 'breach', value: 1 });
    expect(r.anomalies.filter((a) => a.signalId === 'kill_switch.open').map((a) => a.scope)).toEqual(['component:mastery']);
    const resolved = [...tripped, { action: 'mentor.kill_switch.mastery.resolved', created_at: recent(1), detail: { note: 'root caused' } }];
    expect(readingOf(evaluateSignals({ ...empty(), killSwitchAudit: resolved }), 'kill_switch.open')).toMatchObject({ status: 'ok', value: 0 });
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

  it('GAP-FIX-R4: reads Time-to-Mastery per KC and per age band, from every evidence source', () => {
    const at = (user: string, kc: string, p: number, source = 'segment_grade') => ({ user_id: user, kc_id: `id-${kc}`, kc_key: kc, source, correct: true, p_known_after: p, created_at: recent(3) });
    const attempts = [
      at('a', 'money.saving', 0.5), at('a', 'money.saving', 0.9),
      at('b', 'money.saving', 0.4, 'course_lesson'), at('b', 'money.saving', 0.6, 'course_lesson'), at('b', 'money.saving', 0.9, 'course_lesson'),
      at('c', 'money.pricing', 0.95), at('d', 'money.pricing', 0.3),
    ];
    const r = evaluateSignals({ ...empty(), kcAttempts: attempts, ageBands: [{ user_id: 'a', age_band: '6-9' }, { user_id: 'b', age_band: '6-9' }, { user_id: 'c', age_band: '13-17' }] });
    const ttm = readingOf(r, 'learning.time_to_mastery');
    expect(ttm).toMatchObject({ status: 'diagnostic', value: 2, sample: 3 });
    expect(ttm.breakdown).toEqual([
      { key: 'band:6-9', value: 2.5, sample: 2, status: 'diagnostic' },
      { key: 'band:13-17', value: 1, sample: 1, status: 'diagnostic' },
      { key: 'kc:money.pricing', value: 1, sample: 1, status: 'diagnostic' },
      { key: 'kc:money.saving', value: 2.5, sample: 2, status: 'diagnostic' },
    ]);
    // A learner with no age record reads as unknown, never as a guessed band.
    const unknown = evaluateSignals({ ...empty(), kcAttempts: attempts, ageBands: null });
    expect(readingOf(unknown, 'learning.time_to_mastery').breakdown[0]).toMatchObject({ key: 'band:unknown', sample: 3 });
    // The practice band keeps to the Mentor's graded practice: course-lesson evidence is not a practice exercise.
    expect(readingOf(r, 'learning.practice_success_band').sample).toBe(4);
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

describe('C.24 x Appendix C: minimum samples and the tell invariant (gap-fix round 1)', () => {
  it('reads a diagnostic below its minimum opportunities (20) as insufficient data, never as a rate', () => {
    const r = evaluateSignals({
      ...empty(),
      learning: {
        ...empty().learning,
        narrative: { journal_entries_recorded: 5, journal_entries_resurfaced: 2, bridge_prompts_offered: 4, bridge_prompts_converted_7d: 1, bridge_self_commitments: 0 },
        restDays: { learners_with_lapse: 3, kept_by_rest_days: 1, utilization_rate: 0.33, rest_days_used: 1 },
        autonomy: [{ lever: 'path', offered: 5, exercised: 2, adoption_rate: 0.4 }],
      },
    });
    for (const id of ['learning.decision_journal', 'learning.bridge_conversion', 'engagement.rest_day_use', 'engagement.autonomy_adoption']) {
      expect(readingOf(r, id).status, id).toBe('insufficient_data');
    }
  });

  it('reads rubric.tell_honored from the rule scores as a hard invariant: one unhonoured request is urgent', () => {
    const r = evaluateSignals({ ...empty(), scores: [score('tell_honored', 'fail'), score('tell_honored', 'pass')] });
    expect(readingOf(r, 'rubric.tell_honored').status).toBe('breach');
    expect(r.anomalies.some((a) => a.signalId === 'rubric.tell_honored' && a.severity === 'urgent')).toBe(true);
  });
});

describe('GAP-FIX-R2: the per-release manual audits and Parent Time-to-Value (Appendix C 1.2)', () => {
  const audit = (kind: 'dark_pattern' | 'variable_ratio' | 'reward_framing', result: 'pass' | 'fail', days: number, findings = result === 'fail' ? 2 : 0) =>
    ({ audit_kind: kind, release_id: `r-${kind}-${days}`, result, finding_count: findings, recorded_at: recent(days) });

  it('reads the latest audit of each kind: a recent pass is ok and opens nothing', () => {
    const r = evaluateSignals({ ...empty(), releaseAudits: [audit('dark_pattern', 'pass', 3), audit('dark_pattern', 'fail', 60), audit('variable_ratio', 'pass', 10), audit('reward_framing', 'pass', 44)] });
    expect(readingOf(r, 'engagement.dark_pattern_audit')).toMatchObject({ status: 'ok', value: 0, sample: 2 });
    expect(readingOf(r, 'engagement.variable_ratio_audit')).toMatchObject({ status: 'ok', value: 1 });
    expect(readingOf(r, 'engagement.reward_framing')).toMatchObject({ status: 'ok', value: 1 });
    expect(r.anomalies.filter((a) => a.signalId.startsWith('engagement.'))).toEqual([]);
  });

  it('a failed dark-pattern audit is a zero-tolerance breach for the Safety and Trust lead; a failed reward-framing audit flags the pedagogical lead', () => {
    const r = evaluateSignals({ ...empty(), releaseAudits: [audit('dark_pattern', 'fail', 1, 3), audit('variable_ratio', 'pass', 1), audit('reward_framing', 'fail', 1)] });
    expect(readingOf(r, 'engagement.dark_pattern_audit')).toMatchObject({ status: 'breach', value: 3 });
    expect(r.anomalies.find((a) => a.signalId === 'engagement.dark_pattern_audit')).toMatchObject({ kind: 'zero_tolerance', owner: 'safety_trust_lead', severity: 'urgent' });
    expect(r.anomalies.find((a) => a.signalId === 'engagement.reward_framing')).toMatchObject({ kind: 'threshold_breach', owner: 'pedagogical_lead', value: 0 });
  });

  it('an audit older than the release cadence, or none at all, is a breach, never calm; an unreadable table is unavailable', () => {
    const stale = evaluateSignals({ ...empty(), releaseAudits: [audit('dark_pattern', 'pass', T.releaseAuditCadenceDays + 1)] });
    expect(readingOf(stale, 'engagement.dark_pattern_audit').status).toBe('breach');
    expect(stale.anomalies.find((a) => a.signalId === 'engagement.dark_pattern_audit')).toMatchObject({ scope: 'audit_age', threshold: T.releaseAuditCadenceDays });
    expect(readingOf(stale, 'engagement.variable_ratio_audit')).toMatchObject({ status: 'breach', detail: { audits: 0 } });
    const down = evaluateSignals({ ...empty(), releaseAudits: null });
    expect(readingOf(down, 'engagement.reward_framing').status).toBe('unavailable');
  });

  it('Parent Time-to-Value: the median against the proposed 3 minutes, with a minimum sample', () => {
    const p = (medianSeconds: number | null, reached: number) => ({ signups: reached + 5, reached, medianSeconds, p75Seconds: medianSeconds, withinTarget: 0 });
    expect(T.parentTimeToValueSeconds).toBe(180);
    expect(readingOf(evaluateSignals({ ...empty(), parentTimeToValue: p(400, T.parentTimeToValueMinSample - 1) }), 'engagement.parent_time_to_value').status).toBe('insufficient_data');
    expect(readingOf(evaluateSignals({ ...empty(), parentTimeToValue: p(150, T.parentTimeToValueMinSample) }), 'engagement.parent_time_to_value')).toMatchObject({ status: 'ok', value: 150 });
    const slow = evaluateSignals({ ...empty(), parentTimeToValue: p(400, T.parentTimeToValueMinSample) });
    expect(readingOf(slow, 'engagement.parent_time_to_value')).toMatchObject({ status: 'breach', value: 400 });
    expect(slow.anomalies.find((a) => a.signalId === 'engagement.parent_time_to_value')).toMatchObject({ kind: 'threshold_breach', owner: 'pedagogical_lead', threshold: 180 });
    expect(readingOf(evaluateSignals({ ...empty(), parentTimeToValue: null }), 'engagement.parent_time_to_value').status).toBe('unavailable');
  });
});

describe('gap-fix round 6: the equity-drift audit and the threshold-review cadence on the C.24 dashboard', () => {
  it('registers safety.equity_drift (Appendix D 3.7, Safety/Trust Lead) and governance.threshold_review (Appendix F 1.4) as external, zero-tolerance signals', () => {
    expect(SIGNALS.find((s) => s.id === 'safety.equity_drift')).toMatchObject({
      category: 'safety_governance', requirement: 'C.18', owner: 'safety_trust_lead', instrumented: 'external', threshold: { kind: 'zero_tolerance', value: 0 },
    });
    expect(SIGNALS.find((s) => s.id === 'safety.equity_drift')?.pending).toMatch(/equity-audit -- --check/);
    expect(SIGNALS.find((s) => s.id === 'governance.threshold_review')).toMatchObject({
      category: 'pipeline', owner: 'pedagogical_lead', instrumented: 'external', threshold: { kind: 'zero_tolerance', value: 0 },
    });
    expect(SIGNALS.find((s) => s.id === 'governance.threshold_review')?.pending).toMatch(/check-mentor-thresholds\.mjs --strict/);
    for (const id of ['safety.equity_drift', 'governance.threshold_review']) expect(readingOf(evaluateSignals(empty()), id).status).toBe('external');
  });
});

describe('GAP-FIX-R3: the C.1-C.4 safety metrics and the Stage 5 canary reading (Appendix F 1.3, Part 3)', () => {
  it('registers Fracture-Closure Verification (external, zero tolerance) and Age-Tier Calibration Coverage (hard invariant 100%) for the Safety and Trust lead', () => {
    expect(SIGNALS.find((s) => s.id === 'safety.fracture_closure')).toMatchObject({
      requirement: 'C.2', owner: 'safety_trust_lead', instrumented: 'external', threshold: { kind: 'zero_tolerance', value: 0 },
    });
    expect(SIGNALS.find((s) => s.id === 'safety.fracture_closure')?.pending).toMatch(/minor-safeguards:check/);
    expect(SIGNALS.find((s) => s.id === 'safety.age_tier_calibration')).toMatchObject({
      requirement: 'C.1', owner: 'safety_trust_lead', instrumented: 'yes', threshold: { kind: 'hard_invariant', value: 1 },
    });
    expect(SIGNALS.find((s) => s.id === 'canary.arm_comparison')).toMatchObject({ requirement: 'C.22', owner: 'pedagogical_lead', instrumented: 'yes' });
    expect(readingOf(evaluateSignals(empty()), 'safety.fracture_closure').status).toBe('external');
  });

  it('Age-Tier Calibration Coverage: every unknown-age session calibrated is ok; one missed is an urgent breach; none yet is insufficient; an unreadable RPC is unavailable', () => {
    const c = (unknownAgeSessions: number, calibratedBeforeStart: number) => ({
      sessions: unknownAgeSessions + 40, unknownAgeSessions, calibratedBeforeStart,
      coverage: unknownAgeSessions === 0 ? null : calibratedBeforeStart / unknownAgeSessions,
    });
    expect(readingOf(evaluateSignals({ ...empty(), ageCalibration: c(12, 12) }), 'safety.age_tier_calibration')).toMatchObject({ status: 'ok', value: 1, sample: 12 });
    const missed = evaluateSignals({ ...empty(), ageCalibration: c(12, 11) });
    expect(readingOf(missed, 'safety.age_tier_calibration')).toMatchObject({ status: 'breach', detail: { uncalibrated: 1 } });
    expect(missed.anomalies.find((a) => a.signalId === 'safety.age_tier_calibration')).toMatchObject({
      kind: 'threshold_breach', owner: 'safety_trust_lead', severity: 'urgent', requirement: 'C.1', threshold: 1,
    });
    expect(readingOf(evaluateSignals({ ...empty(), ageCalibration: c(0, 0) }), 'safety.age_tier_calibration').status).toBe('insufficient_data');
    const down = evaluateSignals({ ...empty(), ageCalibration: null });
    expect(readingOf(down, 'safety.age_tier_calibration').status).toBe('unavailable');
    expect(down.anomalies.find((a) => a.signalId === 'safety.age_tier_calibration')).toMatchObject({ kind: 'source_unavailable' });
  });

  const PROPOSAL = 'P-2026-10-01-latency-z';
  function canaryWorld(canaryFails: number, controlFails: number, perArm = 40): QualitySources {
    const canaryArms: NonNullable<QualitySources['canaryArms']> = [];
    const scores: ScoreRow[] = [];
    for (const [arm, fails] of [['canary', canaryFails], ['control', controlFails]] as const) {
      for (let i = 0; i < perArm; i += 1) {
        const id = `${arm}-${i}`;
        canaryArms.push({ id, canary_proposal_id: PROPOSAL, canary_arm: arm, ended_at: recent(1) });
        scores.push(score('hint_repeat', i < fails ? 'fail' : 'pass', { session_id: id }));
        scores.push(score('check_in', 'not_applicable', { session_id: id }));
      }
    }
    return { ...empty(), canaryArms, scores };
  }

  it('canary against control: comparable arms read as diagnostic, with each arm in the breakdown', () => {
    const r = evaluateSignals(canaryWorld(2, 2));
    const reading = readingOf(r, 'canary.arm_comparison');
    expect(reading).toMatchObject({ status: 'diagnostic', value: 0, sample: 40, detail: { canaries: 1, regressions: 0, canarySessions: 40, controlSessions: 40 } });
    expect(reading.breakdown.map((b) => b.key)).toEqual([`proposal:${PROPOSAL}/arm:canary`, `proposal:${PROPOSAL}/arm:control`]);
    expect(r.anomalies.filter((a) => a.signalId === 'canary.arm_comparison')).toEqual([]);
  });

  it('a canary arm clearly worse than its control opens a flag for the pedagogical lead, scoped to the proposal', () => {
    const r = evaluateSignals(canaryWorld(12, 2));
    expect(readingOf(r, 'canary.arm_comparison')).toMatchObject({ status: 'breach', value: 1 });
    const flag = r.anomalies.find((a) => a.signalId === 'canary.arm_comparison');
    expect(flag).toMatchObject({ kind: 'threshold_breach', scope: `proposal:${PROPOSAL}`, owner: 'pedagogical_lead', requirement: 'C.22' });
    expect(flag?.scope).toMatch(/^[a-z]+(:[A-Za-z0-9_.:-]+)?(\/[a-z]+:[A-Za-z0-9_.:-]+)*$/);
    // A control arm worse than the canary is not a canary regression.
    expect(evaluateSignals(canaryWorld(2, 12)).anomalies.filter((a) => a.signalId === 'canary.arm_comparison')).toEqual([]);
  });

  it('too few scored sessions is never a regression; no canary is insufficient data; an unreadable source is unavailable', () => {
    expect(evaluateSignals(canaryWorld(10, 0, 12)).anomalies.filter((a) => a.signalId === 'canary.arm_comparison')).toEqual([]);
    expect(readingOf(evaluateSignals({ ...empty(), canaryArms: [] }), 'canary.arm_comparison').status).toBe('insufficient_data');
    expect(readingOf(evaluateSignals({ ...empty(), canaryArms: null }), 'canary.arm_comparison').status).toBe('unavailable');
    expect(readingOf(evaluateSignals({ ...canaryWorld(2, 2), scores: null }), 'canary.arm_comparison').status).toBe('unavailable');
  });
});
