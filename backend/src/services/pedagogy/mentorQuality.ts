/*
 * Product C.24 (with C.21's anomaly flags): THE CONSOLIDATED MENTOR-QUALITY
 * AND ENGAGEMENT-HEALTH SIGNALS, their regression thresholds and their named
 * owners. PURE: the evaluation loop (`evaluationLoop.ts`) fetches the rows
 * and stores what this decides; the staff dashboard reads the stored result.
 *
 * One registry (`SIGNALS`) is the single place Appendix C's engagement-health
 * and learning-outcome metrics and this Block's Mentor signals converge
 * (Appendix E §3.1 Tier 3). Every entry names:
 *   - the requirement it verifies, and its Appendix C/F category;
 *   - the OWNER ROLE whose named person must review it (Appendix F §1.4
 *     "named owners"); a breach is not a display, it opens a flag assigned
 *     to that role, and only a person named for that role can acknowledge or
 *     resolve it (`mentorQualityDashboard.ts`);
 *   - its threshold, or "diagnostic" (no fixed target: a baseline and a trend);
 *   - honestly, whether it is instrumented at all. A metric another Block owns
 *     that has no data source yet is listed as `not_instrumented` with the
 *     requirement that must instrument it, never silently left off, and one
 *     read by another service is `external`.
 *
 * ANOMALY FLAGS (C.21, Appendix E §3.1 Tier 3): a spike (a rate over its
 * ceiling or drifting up), a drop (a floor missed, the bond proxy falling
 * against its own baseline), a zero-tolerance or hard-invariant violation,
 * and DISPARITIES: a persona clearly worse than the other personas, or, within
 * one persona, a demographic subgroup (age tier, locale) clearly worse than
 * the rest ("a persona producing disproportionately negative affect signals
 * for a demographic subgroup").
 *
 * GOVERNANCE. Everything here is Tier 3 (fully automated measurement and
 * flagging): its output is information for a human, never a live decision
 * that reaches a child. Every numeric threshold is "proposed, pending
 * calibration" and recorded in docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 *
 * Vocabularies (owner roles, flag kinds, categories) are HAND-MIRRORED in
 * the migration CHECKs and the rebuilt staff client; `npm run
 * evaluation-loop:check` keeps them identical.
 */

import { TRANSCRIPT_RUBRIC, RULES_CRITERIA, rubricCriterion, type CriterionKind } from './transcriptRubric.js';
import type { ScoreOutcome } from './transcriptScoring.js';
import { summarizeMasteryEvidence, MENTOR_INTEGRITY_THRESHOLDS, type TrajectoryEvidenceRow } from './mentorIntegrity.js';
import { ALLIANCE_THRESHOLDS, summarizeBondProxy, summarizeRenegotiation, type AllianceSessionRow, type RenegotiationRow } from './alliance.js';
import { summarizeRouting, type RoutingRow } from './spacedReview.js';
import { evaluateDialogueKillSwitch, type CalibrationOutcomeRow } from './dialogueCalibration.js';
import { summarizeLadder, type LadderEventRow } from './liveContentGovernance.js';
import { summarizeDefaultToInaction, TELEMETRY_THRESHOLDS, type TelemetrySessionRow } from './behavioralTelemetry.js';
import { summarizeTriggerRate, type ClosedSessionRow, type SignalEventRow } from './sessionEnd.js';

export const OWNER_ROLES = ['pedagogical_lead', 'safety_trust_lead', 'engineering_lead'] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export const SIGNAL_CATEGORIES = [
  'pedagogy',
  'relational',
  'safety_governance',
  'pipeline',
  'learning_outcome',
  'engagement_health',
] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const FLAG_KINDS = [
  'threshold_breach',
  'zero_tolerance',
  'upward_drift',
  'relative_drop',
  'persona_disparity',
  'subgroup_disparity',
  'source_unavailable',
] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export const FLAG_SEVERITIES = ['review', 'urgent'] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

export const FLAG_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export type SignalStatus = 'ok' | 'breach' | 'insufficient_data' | 'diagnostic' | 'unavailable' | 'not_instrumented' | 'external';

export type ThresholdKind = CriterionKind | 'relative_drop' | 'band' | 'none';

export interface SignalDefinition {
  id: string;
  category: SignalCategory;
  requirement: string;
  owner: OwnerRole;
  threshold: { kind: ThresholdKind; value: number | null; upper?: number };
  /** Minimum sample before a rate can breach (hard invariants and zero tolerance breach on one). */
  minSample: number;
  /** Where the number comes from, for the reader. */
  source: string;
  /** For `not_instrumented` / `external`: the requirement or tool that owns the data. */
  pending?: string;
  instrumented: 'yes' | 'not_instrumented' | 'external';
}

/**
 * EVERY THRESHOLD IS "PROPOSED, PENDING CALIBRATION" (Appendix F Part 1.4).
 * See docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md.
 */
export const MENTOR_QUALITY_THRESHOLDS = {
  /** The dashboard's current window, and the equal window before it for drift (days). */
  windowDays: 30,
  /** The bond proxy's own baseline: the days before the current window. */
  bondBaselineDays: 90,
  /** Appendix F Stage 7 relative drop of the bond proxy (the SPEC's proposed 15%). */
  bondDropShare: ALLIANCE_THRESHOLDS.bondDropShare,
  bondBaselineMinAnswers: 50,
  bondCurrentMinAnswers: 30,
  /** A rate drifting up by more than this (absolute) against the prior window is flagged. */
  driftTolerance: MENTOR_INTEGRITY_THRESHOLDS.answerRevealDriftTolerance,
  /** Disparity: a group's rate at least this multiple of the rest ... */
  disparityRatio: 2,
  /** ... and at least this many points above it ... */
  disparityMinGap: 0.05,
  /** ... with at least this many opportunities on each side. */
  disparityMinSample: 30,
  /** A persona's bond score below this share of the other personas' mean is a disparity. */
  bondDisparityShare: 0.85,
  /** Evaluation Pipeline Coverage floor (Appendix F §1.4 "near 100%"). */
  coverageFloor: 0.95,
  coverageMinSessions: 20,
  /** Sessions that ended less than this long ago are not yet due for scoring (their close writes may still land). */
  scoringGraceMinutes: 10,
  /** Appendix F §1.4 freshness SLA: every consolidated signal updated within 24 hours. */
  freshnessHours: 24,
  /** Appendix F §1.4 named-owner review cadence (days). */
  reviewCadenceDays: 7,
  /** Appendix C §1.1 Desirable-Difficulty band (B.19). */
  practiceBand: { low: 0.7, high: 0.85 },
  practiceMinAttempts: 30,
  /** Mastery for Time-to-Mastery: the Mentor's mastery display posterior. */
  masteryPosterior: 0.85,
} as const;

const T = MENTOR_QUALITY_THRESHOLDS;

function rubricSignal(criterion: string): SignalDefinition {
  const c = rubricCriterion(criterion)!;
  const category: SignalCategory =
    c.requirement === 'C.13' || c.requirement === 'C.14' ? 'pedagogy' : c.requirement === 'C.9' ? 'safety_governance' : 'relational';
  const owner: OwnerRole = c.requirement === 'C.9' ? 'safety_trust_lead' : 'pedagogical_lead';
  return {
    id: `rubric.${c.id}`,
    category,
    requirement: c.requirement,
    owner,
    threshold: { kind: c.kind, value: c.target },
    minSample: c.kind === 'ceiling' ? MENTOR_INTEGRITY_THRESHOLDS.answerRevealMinTurns : c.kind === 'floor' ? ALLIANCE_THRESHOLDS.reportMinSessions : 1,
    source: `transcript scoring (${c.id}), tutor_transcript_score`,
    instrumented: 'yes',
  };
}

const notInstrumented = (
  id: string,
  category: SignalCategory,
  requirement: string,
  owner: OwnerRole,
  pending: string,
): SignalDefinition => ({
  id,
  category,
  requirement,
  owner,
  threshold: { kind: 'none', value: null },
  minSample: 0,
  source: 'no data source yet',
  pending,
  instrumented: 'not_instrumented',
});

export const SIGNALS: readonly SignalDefinition[] = [
  // ── Appendix F §1.1 real-time pedagogical effectiveness ──
  { id: 'mastery.corroboration_compliance', category: 'pedagogy', requirement: 'C.10', owner: 'pedagogical_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'tutor_trajectory_step', instrumented: 'yes' },
  { id: 'mastery.reversal_rate', category: 'pedagogy', requirement: 'C.10', owner: 'pedagogical_lead', threshold: { kind: 'ceiling', value: MENTOR_INTEGRITY_THRESHOLDS.masteryReversalCeiling }, minSample: MENTOR_INTEGRITY_THRESHOLDS.masteryReversalMinDeclarations, source: 'tutor_trajectory_step (90-day reversal window)', instrumented: 'yes' },
  rubricSignal('hint_repeat'),
  notInstrumented('rubric.tell_honored', 'pedagogy', 'C.13', 'pedagogical_lead', 'C.23: a calibrated transcript judge (judge-only criterion)'),
  rubricSignal('self_explanation'),
  { id: 'spaced_review.routing', category: 'pedagogy', requirement: 'C.11', owner: 'pedagogical_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'tutor_review_routing (rule re-evaluation)', instrumented: 'yes' },
  { id: 'disposition.completeness', category: 'pedagogy', requirement: 'C.7', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'learner_disposition_profile, tutor_sessions', instrumented: 'yes' },
  { id: 'session_end.trigger_rate', category: 'pedagogy', requirement: 'C.8', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 50, source: 'tutor_session_end_signal, tutor_sessions', instrumented: 'yes' },
  // ── Appendix F §1.2 relational and affective health ──
  { id: 'alliance.bond_proxy', category: 'relational', requirement: 'C.15', owner: 'pedagogical_lead', threshold: { kind: 'relative_drop', value: T.bondDropShare }, minSample: T.bondCurrentMinAnswers, source: 'tutor_session_alliance.bond_proxy', instrumented: 'yes' },
  rubricSignal('goal_agreement'),
  { id: 'alliance.renegotiation', category: 'relational', requirement: 'C.15', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'tutor_alliance_renegotiation', instrumented: 'yes' },
  rubricSignal('answer_reveal'),
  rubricSignal('false_affirmation'),
  rubricSignal('praise_specificity'),
  rubricSignal('check_in'),
  { id: 'telemetry.default_to_inaction', category: 'relational', requirement: 'C.9', owner: 'pedagogical_lead', threshold: { kind: 'floor', value: TELEMETRY_THRESHOLDS.defaultToInactionFloor }, minSample: TELEMETRY_THRESHOLDS.reportMinEvaluatedTurns, source: 'tutor_sessions telemetry counts', instrumented: 'yes' },
  { id: 'telemetry.friction_rate', category: 'relational', requirement: 'C.9', owner: 'safety_trust_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.disparityMinSample, source: 'tutor_telemetry_firing joined to the session persona, age tier and locale', instrumented: 'yes' },
  rubricSignal('closing_script'),
  { id: 'dialogue.ab_outcome', category: 'relational', requirement: 'C.17', owner: 'pedagogical_lead', threshold: { kind: 'hard_invariant', value: 0 }, minSample: 1, source: 'tutor_dialogue_calibration (enrolled sessions)', instrumented: 'yes' },
  rubricSignal('controlling_language'),
  // ── Appendix F §1.3 safety and governance ──
  rubricSignal('emotion_label'),
  { id: 'judge.content_calibration', category: 'safety_governance', requirement: 'C.5', owner: 'safety_trust_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'tutor_content_judge_calibration, the live-content gate', instrumented: 'yes' },
  { id: 'kill_switch.open', category: 'safety_governance', requirement: 'C.21', owner: 'safety_trust_lead', threshold: { kind: 'hard_invariant', value: 0 }, minSample: 1, source: 'audit_logs mentor.kill_switch.* (every Stage 7 rollback)', instrumented: 'yes' },
  { id: 'bias_audit.coverage', category: 'safety_governance', requirement: 'C.20', owner: 'safety_trust_lead', threshold: { kind: 'floor', value: 1 }, minSample: 1, source: 'Oracle bias audit', pending: 'npm --prefix oracle run bias-audit; .github/workflows/mentor-bias-audit.yml', instrumented: 'external' },
  notInstrumented('transcript_judge.agreement', 'safety_governance', 'C.23', 'safety_trust_lead', 'C.23: the transcript-judge calibration process (S06.14)'),
  notInstrumented('governance.tier_compliance', 'safety_governance', 'C.22', 'safety_trust_lead', 'C.22: the Tier-Compliance Audit (S06.14)'),
  // ── Appendix F §1.4 QA and pipeline ──
  { id: 'evaluation.coverage', category: 'pipeline', requirement: 'C.21', owner: 'engineering_lead', threshold: { kind: 'floor', value: T.coverageFloor }, minSample: T.coverageMinSessions, source: 'tutor_sessions.evaluation_rubric_hash', instrumented: 'yes' },
  { id: 'content_ladder.distribution', category: 'pipeline', requirement: 'C.6', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'tutor_content_ladder_events', instrumented: 'yes' },
  { id: 'simulated_student.pass_rate', category: 'pipeline', requirement: 'C.21', owner: 'engineering_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 0, source: 'Oracle pedagogy gym', pending: 'npm --prefix oracle run gym:pedagogy (CI)', instrumented: 'external' },
  notInstrumented('canary.regression_rate', 'pipeline', 'C.22', 'engineering_lead', 'Appendix F Stage 5 canary rollout (not built)'),
  // ── Appendix C §1.1 learning outcomes ──
  { id: 'learning.delayed_retention', category: 'learning_outcome', requirement: 'B.6', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'spaced-review first attempts (admin_retention_at_distance)', instrumented: 'yes' },
  { id: 'learning.practice_success_band', category: 'learning_outcome', requirement: 'B.19', owner: 'pedagogical_lead', threshold: { kind: 'band', value: T.practiceBand.low, upper: T.practiceBand.high }, minSample: T.practiceMinAttempts, source: 'kc_attempt (Mentor practice)', instrumented: 'yes' },
  { id: 'learning.time_to_mastery', category: 'learning_outcome', requirement: 'B.19', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'kc_attempt (attempts to the mastery posterior)', instrumented: 'yes' },
  notInstrumented('learning.transfer_success', 'learning_outcome', 'B.7', 'pedagogical_lead', 'B.7/B.12 practice-vs-transfer tagging'),
  notInstrumented('learning.judgment_quality', 'learning_outcome', 'B.12', 'pedagogical_lead', 'B.12 judgment-quality signal'),
  notInstrumented('learning.bridge_conversion', 'learning_outcome', 'B.13', 'pedagogical_lead', 'B.13 Family Hub bridge events'),
  notInstrumented('learning.decision_journal', 'learning_outcome', 'B.9', 'pedagogical_lead', 'B.9 narrative-state event log'),
  // ── Appendix C §1.2 engagement health ──
  notInstrumented('engagement.session_efficiency', 'engagement_health', 'B.28', 'pedagogical_lead', 'client instrumentation of graded vs total time'),
  notInstrumented('engagement.mentor_resolution', 'engagement_health', 'B.28', 'pedagogical_lead', 'B.28 Mentor resolution events'),
  notInstrumented('engagement.streak_anxiety', 'engagement_health', 'B.21', 'safety_trust_lead', 'B.21 notification and session-restart logs'),
  notInstrumented('engagement.rest_day_use', 'engagement_health', 'B.21', 'pedagogical_lead', 'B.21 rest-day event log'),
  notInstrumented('engagement.dark_pattern_audit', 'engagement_health', 'B.25', 'safety_trust_lead', 'B.25 per-release manual audit'),
  notInstrumented('engagement.variable_ratio_audit', 'engagement_health', 'B.22', 'safety_trust_lead', 'B.22 per-release manual audit'),
  notInstrumented('engagement.reward_framing', 'engagement_health', 'B.20', 'pedagogical_lead', 'B.20 reward-moment copy audit'),
  notInstrumented('engagement.autonomy_adoption', 'engagement_health', 'B.24', 'pedagogical_lead', 'B.24 choice-event log'),
  notInstrumented('engagement.parent_time_to_value', 'engagement_health', 'B.10', 'pedagogical_lead', 'B.10 client timing'),
] as const;

export function signalDefinition(id: string): SignalDefinition | undefined {
  return SIGNALS.find((s) => s.id === id);
}

// ── The rows the loop fetches ───────────────────────────────────────────────

export interface ScoreRow {
  session_id: string | null;
  character: string;
  tier: number;
  locale: string;
  criterion: string;
  outcome: ScoreOutcome;
  numerator: number;
  denominator: number;
  session_ended_at: string;
}

export interface WindowSessionRow extends ClosedSessionRow, TelemetrySessionRow {
  tier: number;
  locale: string;
  ended_at: string;
  turn_count: number;
  evaluation_rubric_hash: string | null;
}

export interface FiringRow {
  session_id: string | null;
  character: string;
  mode: string;
  outcome: string;
}

export interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

export interface KcAttemptRow {
  user_id: string;
  kc_id: string;
  correct: boolean;
  p_known_after: number | string;
  created_at: string;
}

export interface QualitySources {
  now: Date;
  rubricHash: string;
  /** Sessions that ended in the current window. */
  sessions: WindowSessionRow[] | null;
  scores: ScoreRow[] | null;
  priorScores: ScoreRow[] | null;
  firings: FiringRow[] | null;
  endSignals: SignalEventRow[] | null;
  alliance: AllianceSessionRow[] | null;
  allianceBaseline: AllianceSessionRow[] | null;
  renegotiations: RenegotiationRow[] | null;
  /** From `windowDays + reversal window` before now (the reversal rule looks back). */
  trajectory: TrajectoryEvidenceRow[] | null;
  routing: RoutingRow[] | null;
  dialogue: CalibrationOutcomeRow[] | null;
  ladder: LadderEventRow[] | null;
  liveGate: { calibration: string; suspended: { category: string; reasons: string[] }[] } | null;
  killSwitchAudit: AuditRow[] | null;
  completeness: { active: number; current: number } | null;
  kcAttempts: KcAttemptRow[] | null;
  retention: { bucket: string; n: number; avg_first_attempt_score: number }[] | null;
}

// ── What the loop stores ────────────────────────────────────────────────────

export interface Breakdown {
  key: string;
  value: number | null;
  sample: number;
  status: SignalStatus;
}

export interface SignalReading {
  id: string;
  status: SignalStatus;
  value: number | null;
  sample: number;
  breakdown: Breakdown[];
  /** Small, closed-vocabulary numbers for the reader (never text, never an id). */
  detail: Record<string, number | string | null>;
  sourceLatestAt: string | null;
}

export interface Anomaly {
  signalId: string;
  kind: FlagKind;
  /** 'all', or 'persona:<c>', 'persona:<c>/tier:<n>', 'persona:<c>/locale:<l>', 'category:<x>', 'component:<x>'. */
  scope: string;
  value: number | null;
  threshold: number | null;
  owner: OwnerRole;
  requirement: string;
  severity: FlagSeverity;
  evidence: Record<string, number | string | null>;
}

export const dedupKey = (a: Pick<Anomaly, 'signalId' | 'kind' | 'scope'>): string => `${a.signalId}|${a.kind}|${a.scope}`;

// ── Helpers ─────────────────────────────────────────────────────────────────

const latest = (values: (string | null | undefined)[]): string | null =>
  values.reduce<string | null>((max, v) => (v && (max === null || v > max) ? v : max), null);

function reading(id: string, patch: Partial<SignalReading> & { status: SignalStatus }): SignalReading {
  return { id, value: null, sample: 0, breakdown: [], detail: {}, sourceLatestAt: null, ...patch };
}

function anomalyFor(def: SignalDefinition, kind: FlagKind, scope: string, value: number | null, threshold: number | null, evidence: Anomaly['evidence'], owner?: OwnerRole): Anomaly {
  const urgent = kind === 'zero_tolerance' || kind === 'source_unavailable' || def.threshold.kind === 'hard_invariant' || def.threshold.kind === 'zero_tolerance';
  return {
    signalId: def.id,
    kind,
    scope,
    value,
    threshold,
    owner: owner ?? def.owner,
    requirement: def.requirement,
    severity: urgent ? 'urgent' : 'review',
    evidence,
  };
}

/** A rate per group; "clearly worse than the rest" by ratio, gap and sample on both sides. */
export function disparities(groups: { key: string; hits: number; n: number }[]): { key: string; rate: number; rest: number; n: number; restN: number }[] {
  const out: { key: string; rate: number; rest: number; n: number; restN: number }[] = [];
  for (const g of groups) {
    const restHits = groups.filter((o) => o.key !== g.key).reduce((s, o) => s + o.hits, 0);
    const restN = groups.filter((o) => o.key !== g.key).reduce((s, o) => s + o.n, 0);
    if (g.n < T.disparityMinSample || restN < T.disparityMinSample) continue;
    const rate = g.hits / g.n;
    const rest = restHits / restN;
    if (rate - rest >= T.disparityMinGap && rate >= rest * T.disparityRatio) out.push({ key: g.key, rate, rest, n: g.n, restN });
  }
  return out;
}

function groupBy<R>(rows: readonly R[], key: (r: R) => string): Map<string, R[]> {
  const map = new Map<string, R[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

// ── The rubric signals (C.21 transcript scoring, aggregated) ────────────────

function rubricReading(def: SignalDefinition, criterion: string, scores: ScoreRow[], prior: ScoreRow[] | null, anomalies: Anomaly[]): SignalReading {
  const c = rubricCriterion(criterion)!;
  const rows = scores.filter((r) => r.criterion === criterion && r.outcome !== 'not_applicable');
  const sum = (rs: ScoreRow[]) => ({ num: rs.reduce((s, r) => s + r.numerator, 0), den: rs.reduce((s, r) => s + r.denominator, 0) });
  const failSessions = rows.filter((r) => r.outcome === 'fail').length;
  const { num, den } = sum(rows);
  const rate = den === 0 ? null : num / den;
  const sourceLatestAt = latest(rows.map((r) => r.session_ended_at));

  const statusOf = (value: number | null, n: number, fails: number): SignalStatus => {
    if (value === null) return 'insufficient_data';
    switch (c.kind) {
      case 'diagnostic':
        return 'diagnostic';
      case 'hard_invariant':
      case 'zero_tolerance':
        return fails > 0 ? 'breach' : 'ok';
      case 'ceiling':
        return n < def.minSample ? 'insufficient_data' : value > (c.target ?? 0) ? 'breach' : 'ok';
      case 'floor':
        return n < def.minSample ? 'insufficient_data' : value < (c.target ?? 1) ? 'breach' : 'ok';
    }
  };

  // Rate-type criteria are judged on the pooled counts; invariant-type on sessions.
  const invariant = c.kind === 'hard_invariant' || c.kind === 'zero_tolerance';
  const value = invariant ? (rows.length === 0 ? null : failSessions / rows.length) : rate;
  const sample = invariant ? rows.length : c.kind === 'floor' ? den : den;
  const status = statusOf(invariant ? value : rate, invariant ? rows.length : den, failSessions);

  const breakdown: Breakdown[] = [];
  for (const [character, rs] of groupBy(rows, (r) => r.character)) {
    const s = sum(rs);
    const fails = rs.filter((r) => r.outcome === 'fail').length;
    const v = invariant ? fails / rs.length : s.den === 0 ? null : s.num / s.den;
    breakdown.push({ key: `persona:${character}`, value: v, sample: invariant ? rs.length : s.den, status: statusOf(invariant ? v : v, invariant ? rs.length : s.den, fails) });
  }
  breakdown.sort((a, b) => a.key.localeCompare(b.key));

  if (invariant && failSessions > 0) {
    anomalies.push(anomalyFor(def, 'zero_tolerance', 'all', value, 0, { sessions: failSessions, scored: rows.length }));
  }
  if (c.kind === 'ceiling' || c.kind === 'floor') {
    for (const b of breakdown) {
      if (b.status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', b.key, b.value, c.target, { opportunities: b.sample }));
    }
    if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', rate, c.target, { opportunities: den }));
    // Upward drift of a ceiling rate against the prior window, per persona (Appendix F "any upward drift").
    if (c.kind === 'ceiling' && prior !== null) {
      const priorRows = prior.filter((r) => r.criterion === criterion && r.outcome !== 'not_applicable');
      for (const [character, rs] of groupBy(rows, (r) => r.character)) {
        const now = sum(rs);
        const before = sum(priorRows.filter((r) => r.character === character));
        if (now.den < def.minSample || before.den < def.minSample) continue;
        const delta = now.num / now.den - before.num / before.den;
        if (delta > T.driftTolerance) {
          anomalies.push(anomalyFor(def, 'upward_drift', `persona:${character}`, now.num / now.den, before.num / before.den, { opportunities: now.den, priorOpportunities: before.den }));
        }
      }
    }
    // Persona and subgroup disparities on the session fail share.
    const sessionFail = (rs: ScoreRow[]) => ({ hits: rs.filter((r) => r.outcome === 'fail').length, n: rs.length });
    for (const d of disparities([...groupBy(rows, (r) => r.character)].map(([k, rs]) => ({ key: `persona:${k}`, ...sessionFail(rs) })))) {
      anomalies.push(anomalyFor(def, 'persona_disparity', d.key, d.rate, d.rest, { sessions: d.n, otherSessions: d.restN }));
    }
    for (const [character, rs] of groupBy(rows, (r) => r.character)) {
      for (const dim of ['tier', 'locale'] as const) {
        const groups = [...groupBy(rs, (r) => String(r[dim]))].map(([k, g]) => ({ key: `persona:${character}/${dim}:${k}`, ...sessionFail(g) }));
        for (const d of disparities(groups)) {
          anomalies.push(anomalyFor(def, 'subgroup_disparity', d.key, d.rate, d.rest, { sessions: d.n, otherSessions: d.restN }, 'safety_trust_lead'));
        }
      }
    }
  }

  return reading(def.id, {
    status,
    value,
    sample,
    breakdown,
    detail: { failedSessions: failSessions, scoredSessions: rows.length, numerator: num, denominator: den },
    sourceLatestAt,
  });
}

// ── The consolidated evaluation ─────────────────────────────────────────────

export function evaluateSignals(src: QualitySources): { readings: SignalReading[]; anomalies: Anomaly[] } {
  const anomalies: Anomaly[] = [];
  const readings: SignalReading[] = [];
  const unavailable = (def: SignalDefinition): SignalReading => {
    anomalies.push(anomalyFor(def, 'source_unavailable', 'all', null, null, {}, 'engineering_lead'));
    return reading(def.id, { status: 'unavailable' });
  };

  for (const def of SIGNALS) {
    if (def.instrumented === 'not_instrumented') {
      readings.push(reading(def.id, { status: 'not_instrumented' }));
      continue;
    }
    if (def.instrumented === 'external') {
      readings.push(reading(def.id, { status: 'external' }));
      continue;
    }
    if (def.id.startsWith('rubric.')) {
      const criterion = def.id.slice('rubric.'.length);
      if (!RULES_CRITERIA.includes(criterion)) {
        readings.push(reading(def.id, { status: 'not_instrumented' }));
        continue;
      }
      readings.push(src.scores === null ? unavailable(def) : rubricReading(def, criterion, src.scores, src.priorScores, anomalies));
      continue;
    }
    readings.push(evaluateOne(def, src, anomalies, unavailable));
  }
  return { readings, anomalies };
}

function evaluateOne(
  def: SignalDefinition,
  src: QualitySources,
  anomalies: Anomaly[],
  unavailable: (def: SignalDefinition) => SignalReading,
): SignalReading {
  switch (def.id) {
    case 'mastery.corroboration_compliance':
    case 'mastery.reversal_rate': {
      if (src.trajectory === null) return unavailable(def);
      const since = src.now.getTime() - T.windowDays * 86_400_000;
      const inWindow = src.trajectory.filter((r) => Date.parse(r.created_at) >= since);
      const sourceLatestAt = latest(src.trajectory.map((r) => r.created_at));
      if (def.id === 'mastery.corroboration_compliance') {
        const s = summarizeMasteryEvidence(inWindow);
        const status: SignalStatus = s.complianceRate === null ? 'insufficient_data' : s.complianceRate < 1 ? 'breach' : 'ok';
        if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', s.complianceRate, 1, { moves: s.triggers, compliant: s.compliant }));
        return reading(def.id, { status, value: s.complianceRate, sample: s.triggers, detail: { underRollback: s.underRollback }, sourceLatestAt });
      }
      const s = summarizeMasteryEvidence(src.trajectory);
      const status: SignalStatus = s.reversalStatus === 'defect' ? 'breach' : s.reversalStatus === 'ok' ? 'ok' : 'insufficient_data';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', s.reversalRate, def.threshold.value, { declarations: s.declarations, reversals: s.reversals }));
      return reading(def.id, { status, value: s.reversalRate, sample: s.declarations, detail: { reversals: s.reversals }, sourceLatestAt });
    }
    case 'spaced_review.routing': {
      if (src.routing === null) return unavailable(def);
      const s = summarizeRouting(src.routing);
      const status: SignalStatus = s.status === 'defect' ? 'breach' : s.status === 'ok' ? 'ok' : 'insufficient_data';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', s.compliance.rate, 1, { decisions: s.decisions, misroutes: s.compliance.mismatches.length }));
      return reading(def.id, { status, value: s.compliance.rate, sample: s.decisions, detail: { misroutes: s.compliance.mismatches.length }, sourceLatestAt: latest(src.routing.map((r) => r.created_at)) });
    }
    case 'disposition.completeness': {
      if (src.completeness === null) return unavailable(def);
      const { active, current } = src.completeness;
      return reading(def.id, { status: active === 0 ? 'insufficient_data' : 'diagnostic', value: active === 0 ? null : Math.min(current, active) / active, sample: active });
    }
    case 'session_end.trigger_rate': {
      if (src.sessions === null || src.endSignals === null) return unavailable(def);
      const s = summarizeTriggerRate(src.sessions, src.endSignals);
      return reading(def.id, {
        status: s.triggerStatus === 'insufficient_data' ? 'insufficient_data' : 'diagnostic',
        value: s.triggerRate,
        sample: s.evaluatedSessions,
        detail: { precision: s.precision, labelledFirings: s.labelledFirings },
        sourceLatestAt: latest(src.sessions.map((r) => r.ended_at)),
      });
    }
    case 'alliance.bond_proxy':
      return bondReading(def, src, anomalies, unavailable);
    case 'alliance.renegotiation': {
      if (src.renegotiations === null) return unavailable(def);
      const s = summarizeRenegotiation(src.renegotiations);
      return reading(def.id, { status: s.rate === null ? 'insufficient_data' : 'diagnostic', value: s.rate, sample: s.patterns, detail: { improved: s.improved, notImproved: s.notImproved }, sourceLatestAt: latest(src.renegotiations.map((r) => r.created_at)) });
    }
    case 'telemetry.default_to_inaction': {
      if (src.sessions === null) return unavailable(def);
      const s = summarizeDefaultToInaction(src.sessions);
      const status: SignalStatus = s.status === 'defect' ? 'breach' : s.status === 'ok' ? 'ok' : 'insufficient_data';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', s.rate, def.threshold.value, { evaluatedTurns: s.evaluatedTurns }));
      return reading(def.id, {
        status,
        value: s.rate,
        sample: s.evaluatedTurns,
        breakdown: Object.entries(s.byPersona).map(([c, p]) => ({ key: `persona:${c}`, value: p.rate, sample: p.evaluatedTurns, status: 'diagnostic' as const })),
        sourceLatestAt: latest(src.sessions.map((r) => r.ended_at)),
      });
    }
    case 'telemetry.friction_rate':
      return frictionReading(def, src, anomalies, unavailable);
    case 'dialogue.ab_outcome': {
      if (src.dialogue === null) return unavailable(def);
      const verdict = evaluateDialogueKillSwitch(src.dialogue);
      const enrolled = src.dialogue.filter((r) => r.assignment === 'experiment').length;
      const status: SignalStatus = enrolled === 0 ? 'insufficient_data' : verdict.tripped ? 'breach' : 'ok';
      for (const r of verdict.regressions) anomalies.push(anomalyFor(def, 'threshold_breach', `band:${r.band}/outcome:${r.outcome}`, null, null, { enrolledSessions: enrolled }));
      return reading(def.id, { status, value: verdict.regressions.length, sample: enrolled, detail: { regressions: verdict.regressions.length } });
    }
    case 'judge.content_calibration': {
      if (src.liveGate === null) return unavailable(def);
      const passed = src.liveGate.calibration === 'passed';
      const tripped = src.liveGate.suspended.filter((s) => s.reasons.some((r) => r === 'concordance_below_floor' || r === 'review_rate_below_floor'));
      if (!passed) anomalies.push(anomalyFor(def, 'threshold_breach', 'all', 0, 1, { calibration: src.liveGate.calibration }));
      for (const s of tripped) anomalies.push(anomalyFor(def, 'threshold_breach', `category:${s.category}`, null, null, { reasons: s.reasons.join(',') }));
      return reading(def.id, {
        status: !passed || tripped.length > 0 ? 'breach' : 'ok',
        value: passed ? 1 : 0,
        sample: 1,
        detail: { calibration: src.liveGate.calibration, suspendedCategories: src.liveGate.suspended.length },
      });
    }
    case 'kill_switch.open': {
      if (src.killSwitchAudit === null) return unavailable(def);
      const open = openKillSwitches(src.killSwitchAudit);
      for (const o of open) anomalies.push(anomalyFor(def, 'threshold_breach', `component:${o.key}`, null, null, { since: o.triggeredAt }));
      return reading(def.id, {
        status: open.length > 0 ? 'breach' : 'ok',
        value: open.length,
        sample: src.killSwitchAudit.length,
        breakdown: open.map((o) => ({ key: `component:${o.key}`, value: 1, sample: 1, status: 'breach' as const })),
        sourceLatestAt: latest(src.killSwitchAudit.map((r) => r.created_at)),
      });
    }
    case 'evaluation.coverage': {
      if (src.sessions === null) return unavailable(def);
      const due = src.now.getTime() - T.scoringGraceMinutes * 60_000;
      const eligible = src.sessions.filter((s) => s.turn_count > 0 && Date.parse(s.ended_at) <= due);
      const scored = eligible.filter((s) => s.evaluation_rubric_hash !== null).length;
      const value = eligible.length === 0 ? null : scored / eligible.length;
      const status: SignalStatus = value === null || eligible.length < def.minSample ? 'insufficient_data' : value < T.coverageFloor ? 'breach' : 'ok';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', value, T.coverageFloor, { eligible: eligible.length, scored }));
      return reading(def.id, {
        status,
        value,
        sample: eligible.length,
        detail: { currentRubric: eligible.filter((s) => s.evaluation_rubric_hash === src.rubricHash).length },
        sourceLatestAt: latest(src.sessions.map((s) => s.ended_at)),
      });
    }
    case 'content_ladder.distribution': {
      if (src.ladder === null) return unavailable(def);
      const s = summarizeLadder(src.ladder);
      return reading(def.id, {
        status: s.served === 0 ? 'insufficient_data' : 'diagnostic',
        value: s.liveShare,
        sample: s.served,
        breakdown: [
          { key: 'rung:catalog', value: s.catalogShare, sample: s.served, status: 'diagnostic' },
          { key: 'rung:bank', value: s.bankShare, sample: s.served, status: 'diagnostic' },
          { key: 'rung:live', value: s.liveShare, sample: s.served, status: 'diagnostic' },
        ],
        detail: { refusals: s.refusals },
        sourceLatestAt: latest(src.ladder.map((r) => r.created_at)),
      });
    }
    case 'learning.delayed_retention': {
      if (src.retention === null) return unavailable(def);
      const n = src.retention.reduce((s, b) => s + b.n, 0);
      return reading(def.id, {
        status: n === 0 ? 'insufficient_data' : 'diagnostic',
        value: n === 0 ? null : src.retention.reduce((s, b) => s + b.avg_first_attempt_score * b.n, 0) / n / 100,
        sample: n,
        breakdown: src.retention.map((b) => ({ key: `days:${b.bucket}`, value: b.avg_first_attempt_score / 100, sample: b.n, status: 'diagnostic' as const })),
      });
    }
    case 'learning.practice_success_band':
    case 'learning.time_to_mastery':
      return practiceReading(def, src, anomalies, unavailable);
    default:
      return reading(def.id, { status: 'not_instrumented' });
  }
}

const bondValue = (a: string | null): number | null => (a === 'yes' ? 1 : a === 'partly' ? 0.5 : a === 'no' ? 0 : null);

function bondReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.alliance === null || src.allianceBaseline === null) return unavailable(def);
  const current = summarizeBondProxy(src.alliance);
  const baseline = summarizeBondProxy(src.allianceBaseline);
  const answered = Object.values(current).reduce((s, p) => s + p.answered, 0);
  const pooled = src.alliance.map((r) => bondValue(r.bond_proxy)).filter((v): v is number => v !== null);
  const breakdown: Breakdown[] = [];
  let breached = false;
  for (const [character, p] of Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) {
    const base = baseline[character];
    let status: SignalStatus = p.answered < T.bondCurrentMinAnswers || p.score === null ? 'insufficient_data' : 'diagnostic';
    if (status === 'diagnostic' && base && base.score !== null && base.answered >= T.bondBaselineMinAnswers && base.score > 0) {
      const drop = (base.score - p.score!) / base.score;
      if (drop > T.bondDropShare) {
        status = 'breach';
        breached = true;
        anomalies.push(anomalyFor(def, 'relative_drop', `persona:${character}`, p.score, base.score, { answers: p.answered, baselineAnswers: base.answered }));
      }
    }
    breakdown.push({ key: `persona:${character}`, value: p.score, sample: p.answered, status });
  }
  // A persona clearly below the other personas (Appendix F: "a persona scoring meaningfully below the others").
  const judged = breakdown.filter((b) => b.value !== null && b.sample >= T.bondCurrentMinAnswers);
  for (const b of judged) {
    const others = judged.filter((o) => o.key !== b.key);
    if (others.length === 0) continue;
    const mean = others.reduce((s, o) => s + o.value!, 0) / others.length;
    if (mean > 0 && b.value! < mean * T.bondDisparityShare) {
      breached = true;
      anomalies.push(anomalyFor(def, 'persona_disparity', b.key, b.value, mean, { answers: b.sample }));
    }
  }
  return reading(def.id, {
    status: answered < T.bondCurrentMinAnswers ? 'insufficient_data' : breached ? 'breach' : 'diagnostic',
    value: pooled.length === 0 ? null : pooled.reduce((s, v) => s + v, 0) / pooled.length,
    sample: answered,
    breakdown,
    sourceLatestAt: latest(src.alliance.map((r) => r.created_at)),
  });
}

function frictionReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.sessions === null || src.firings === null) return unavailable(def);
  const evaluated = src.sessions.filter((s) => s.telemetry_mode !== null);
  const fired = new Set(src.firings.filter((f) => f.session_id !== null).map((f) => f.session_id!));
  const hit = (rs: WindowSessionRow[]) => ({ hits: rs.filter((s) => fired.has(s.id)).length, n: rs.length });
  const all = hit(evaluated);
  const breakdown: Breakdown[] = [...groupBy(evaluated, (s) => s.character)].map(([c, rs]) => {
    const h = hit(rs);
    return { key: `persona:${c}`, value: h.n === 0 ? null : h.hits / h.n, sample: h.n, status: 'diagnostic' as const };
  });
  let breached = false;
  for (const [character, rs] of groupBy(evaluated, (s) => s.character)) {
    for (const dim of ['tier', 'locale'] as const) {
      const groups = [...groupBy(rs, (s) => String(s[dim]))].map(([k, g]) => ({ key: `persona:${character}/${dim}:${k}`, ...hit(g) }));
      for (const d of disparities(groups)) {
        breached = true;
        anomalies.push(anomalyFor(def, 'subgroup_disparity', d.key, d.rate, d.rest, { sessions: d.n, otherSessions: d.restN }));
      }
    }
  }
  return reading(def.id, {
    status: all.n < def.minSample ? 'insufficient_data' : breached ? 'breach' : 'diagnostic',
    value: all.n === 0 ? null : all.hits / all.n,
    sample: all.n,
    breakdown: breakdown.sort((a, b) => a.key.localeCompare(b.key)),
    sourceLatestAt: latest(src.sessions.map((s) => s.ended_at)),
  });
}

function practiceReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.kcAttempts === null) return unavailable(def);
  const sourceLatestAt = latest(src.kcAttempts.map((r) => r.created_at));
  if (def.id === 'learning.practice_success_band') {
    const n = src.kcAttempts.length;
    const correct = src.kcAttempts.filter((r) => r.correct).length;
    const rate = n === 0 ? null : correct / n;
    const outside: Breakdown[] = [];
    for (const [kc, rs] of groupBy(src.kcAttempts, (r) => r.kc_id)) {
      if (rs.length < T.practiceMinAttempts) continue;
      const r = rs.filter((x) => x.correct).length / rs.length;
      if (r < T.practiceBand.low || r > T.practiceBand.high) outside.push({ key: `kc:${kc}`, value: r, sample: rs.length, status: 'breach' });
    }
    const status: SignalStatus = rate === null || n < def.minSample ? 'insufficient_data' : rate < T.practiceBand.low || rate > T.practiceBand.high ? 'breach' : 'ok';
    if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', rate, rate! < T.practiceBand.low ? T.practiceBand.low : T.practiceBand.high, { attempts: n }));
    return reading(def.id, { status, value: rate, sample: n, breakdown: outside.slice(0, 20), detail: { kcsOutsideBand: outside.length }, sourceLatestAt });
  }
  // Time-to-Mastery: attempts until the posterior first reaches the bar, for
  // learner × KC pairs whose FIRST attempt is inside the window (diagnostic).
  const pairs = groupBy([...src.kcAttempts].sort((a, b) => a.created_at.localeCompare(b.created_at)), (r) => `${r.user_id}|${r.kc_id}`);
  const counts: number[] = [];
  for (const rs of pairs.values()) {
    const at = rs.findIndex((r) => Number(r.p_known_after) >= T.masteryPosterior);
    if (at >= 0) counts.push(at + 1);
  }
  counts.sort((a, b) => a - b);
  const median = counts.length === 0 ? null : counts.length % 2 === 1 ? counts[(counts.length - 1) / 2]! : (counts[counts.length / 2 - 1]! + counts[counts.length / 2]!) / 2;
  return reading(def.id, { status: counts.length === 0 ? 'insufficient_data' : 'diagnostic', value: median, sample: counts.length, detail: { pairs: pairs.size }, sourceLatestAt });
}

/** Every Stage 7 rollback whose latest event is a trigger (still in force). */
export function openKillSwitches(rows: readonly AuditRow[]): { key: string; triggeredAt: string }[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const open = new Map<string, string>();
  for (const row of ordered) {
    const match = /^mentor\.kill_switch\.([a-z_]+)\.(triggered|resolved)$/.exec(row.action);
    if (!match) continue;
    const scoped = match[1] === 'live_content' ? `${match[1]}:${String(row.detail?.category)}:${String(row.detail?.cause)}` : match[1]!;
    if (match[2] === 'triggered') {
      if (!open.has(scoped)) open.set(scoped, row.created_at);
    } else open.delete(scoped);
  }
  return [...open.entries()].map(([key, triggeredAt]) => ({ key, triggeredAt })).sort((a, b) => a.key.localeCompare(b.key));
}

// ── Freshness and owner review (read time) ──────────────────────────────────

/** Monday (UTC) of the ISO week containing `d`, as YYYY-MM-DD. */
export function isoWeekStart(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() - ((copy.getUTCDay() + 6) % 7));
  return copy.toISOString().slice(0, 10);
}

export function freshness(computedAt: string | null, now: Date): { ageHours: number | null; stale: boolean } {
  if (computedAt === null) return { ageHours: null, stale: true };
  const ageHours = (now.getTime() - Date.parse(computedAt)) / 3_600_000;
  return { ageHours, stale: ageHours > T.freshnessHours };
}

/**
 * Dashboard Usage Rate (Appendix F §1.4): the share of named owners who
 * signed their weekly review. The CURRENT week is still open, so the rate is
 * judged on the last complete week; the current week is shown for progress.
 */
export function reviewCompletion(
  owners: { owner_role: string; user_id: string }[],
  reviews: { owner_role: string; reviewer_id: string | null; week_start: string }[],
  now: Date,
): { week: string; previousWeek: string; named: number; reviewedThisWeek: number; reviewedPreviousWeek: number; previousRate: number | null; missingRoles: OwnerRole[] } {
  const week = isoWeekStart(now);
  const previousWeek = isoWeekStart(new Date(now.getTime() - 7 * 86_400_000));
  const done = (w: string) => owners.filter((o) => reviews.some((r) => r.week_start === w && r.owner_role === o.owner_role && r.reviewer_id === o.user_id)).length;
  const reviewedPreviousWeek = done(previousWeek);
  return {
    week,
    previousWeek,
    named: owners.length,
    reviewedThisWeek: done(week),
    reviewedPreviousWeek,
    previousRate: owners.length === 0 ? null : reviewedPreviousWeek / owners.length,
    missingRoles: OWNER_ROLES.filter((role) => !owners.some((o) => o.owner_role === role)),
  };
}

/** The rubric as the dashboard shows it (id, requirement, kind, who can score it). */
export function rubricSummary(): { id: string; requirement: string; kind: CriterionKind; scoredBy: readonly string[]; target: number | null }[] {
  return TRANSCRIPT_RUBRIC.map((c) => ({ id: c.id, requirement: c.requirement, kind: c.kind, scoredBy: c.scoredBy, target: c.target }));
}
