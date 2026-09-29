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
import { judgeTrust, type CalibrationRecordRow } from './judgeCalibration.js';
import { summarizeCanaryArms } from './mentorCanary.js';
import { classifyTrend, TREND_MIN_WEEKLY_SAMPLE, TREND_TOLERANCE, TREND_WINDOW_WEEKS, type TrendStatus } from '../engagementHealth.js';
import { JUDGMENT_DIVERGENCE_FLOOR, JUDGMENT_MIN_ATTEMPTS } from '../learningQuality.js';

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

/** 'trend': Appendix C's "hold steady or improve" metrics, judged by classifyTrend (engagementHealth.ts). */
/** 'release_non_decline': Appendix C 1.1 Delayed Retention, per KC against the latest recorded release (release 1 is the baseline). */
export type ThresholdKind = CriterionKind | 'relative_drop' | 'band' | 'trend' | 'release_non_decline' | 'none';

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
  /**
   * Appendix C 1.1 Delayed Retention (GAP-FIX-R4): "no decline release over
   * release". A KC x window whose correct share falls more than this
   * (absolute) below the latest recorded release is a decline, judged only
   * when both periods saw at least `retentionMinLearners` learners in it.
   */
  retentionDeclineTolerance: 0.05,
  retentionMinLearners: 20,
  /**
   * B.28 engagement health (Appendix C §1.2): the last 4 weeks against the 4
   * before; a move of more than 10% in the metric's bad direction is a
   * regression (engagementHealth.ts owns the numbers; mirrored here for the reader).
   */
  engagementTrendTolerance: TREND_TOLERANCE,
  engagementTrendMinWeeklySample: TREND_MIN_WEEKLY_SAMPLE,
  /** B.9 / B.13 / B.21 / B.24 diagnostics: below this many opportunities the reading is insufficient_data. */
  narrativeMinSample: 20,
  restDayMinLapses: 20,
  autonomyMinOffers: 20,
  /**
   * Appendix C 1.2 per-release manual audits (B.25, B.22, B.20; GAP-FIX-R2):
   * the latest recorded audit must be a pass and no older than this. 45 days
   * is the release cadence docs/rebuild/DARK-PATTERN-AUDIT.md already binds
   * `release:readiness` to.
   */
  releaseAuditCadenceDays: 45,
  /** Appendix C 1.2 Parent Time-to-Value, "proposed: 3 minutes": the median, signup to first insight. */
  parentTimeToValueSeconds: 180,
  parentTimeToValueMinSample: 20,
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

/**
 * Signals taken OFF the registry, with the reason written down (never
 * silently dropped). The dashboard lists them so a reader sees why.
 */
export const RETIRED_SIGNALS: readonly { id: string; requirement: string; reason: string }[] = [
  {
    id: 'engagement.streak_anxiety',
    requirement: 'B.21',
    reason:
      'Appendix C defines it as the correlation between session restarts and streak-at-risk notifications. The product sends no ' +
      'streak-at-risk notification and Frontend Bible 02 section 9.6 forbids loss-framed streak copy, so the correlation has no ' +
      'trigger to measure. The control is the B.25 dark-pattern audit (item DP-09: no re-engagement notification), which this ' +
      'dashboard now reads as engagement.dark_pattern_audit. Reinstate the signal if a streak notification is ever built.',
  },
];

/** The per-release manual audits (release_audit_results.audit_kind) and the signal each one feeds. */
export const RELEASE_AUDIT_KINDS = ['dark_pattern', 'variable_ratio', 'reward_framing'] as const;
export type ReleaseAuditKind = (typeof RELEASE_AUDIT_KINDS)[number];
export const RELEASE_AUDIT_SIGNAL: Record<ReleaseAuditKind, string> = {
  dark_pattern: 'engagement.dark_pattern_audit',
  variable_ratio: 'engagement.variable_ratio_audit',
  reward_framing: 'engagement.reward_framing',
};

export const SIGNALS: readonly SignalDefinition[] = [
  // ── Appendix F §1.1 real-time pedagogical effectiveness ──
  { id: 'mastery.corroboration_compliance', category: 'pedagogy', requirement: 'C.10', owner: 'pedagogical_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'tutor_trajectory_step', instrumented: 'yes' },
  { id: 'mastery.reversal_rate', category: 'pedagogy', requirement: 'C.10', owner: 'pedagogical_lead', threshold: { kind: 'ceiling', value: MENTOR_INTEGRITY_THRESHOLDS.masteryReversalCeiling }, minSample: MENTOR_INTEGRITY_THRESHOLDS.masteryReversalMinDeclarations, source: 'tutor_trajectory_step (90-day reversal window)', instrumented: 'yes' },
  rubricSignal('hint_repeat'),
  rubricSignal('tell_honored'),
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
  { id: 'transcript_judge.agreement', category: 'safety_governance', requirement: 'C.23', owner: 'safety_trust_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'mentor_judge_calibration (the transcript judge: latest calibration and spot checks)', instrumented: 'yes' },
  { id: 'governance.tier_compliance', category: 'safety_governance', requirement: 'C.22', owner: 'safety_trust_lead', threshold: { kind: 'zero_tolerance', value: 0 }, minSample: 0, source: 'the repository gate (Tier 1 change record, automated-origin fence)', pending: 'npm run governance:check -- --release (release-readiness); the repo-gates workflow on every push', instrumented: 'external' },
  // GAP-FIX-R3 (Appendix F 1.3): the only Part 1 metrics for C.1-C.4.
  { id: 'safety.fracture_closure', category: 'safety_governance', requirement: 'C.2', owner: 'safety_trust_lead', threshold: { kind: 'zero_tolerance', value: 0 }, minSample: 0, source: 'the per-release Fracture-Closure Verification: every C.2/C.3/C.4 safeguard keys off the minor indicator or a guardian link, never the kid role alone', pending: 'npm run minor-safeguards:check -- --report=<file> (release-readiness); the repo-gates workflow on every push', instrumented: 'external' },
  { id: 'safety.age_tier_calibration', category: 'safety_governance', requirement: 'C.1', owner: 'safety_trust_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'mentor_age_calibration_coverage: unknown-age sessions with the explicit calibration before they started', instrumented: 'yes' },
  // ── Appendix F §1.4 QA and pipeline ──
  { id: 'evaluation.coverage', category: 'pipeline', requirement: 'C.21', owner: 'engineering_lead', threshold: { kind: 'floor', value: T.coverageFloor }, minSample: T.coverageMinSessions, source: 'tutor_sessions.evaluation_rubric_hash', instrumented: 'yes' },
  { id: 'content_ladder.distribution', category: 'pipeline', requirement: 'C.6', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'tutor_content_ladder_events', instrumented: 'yes' },
  { id: 'simulated_student.pass_rate', category: 'pipeline', requirement: 'C.21', owner: 'engineering_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 0, source: 'Oracle pedagogy gym', pending: 'npm --prefix oracle run gym:pedagogy (CI)', instrumented: 'external' },
  { id: 'canary.regression_rate', category: 'pipeline', requirement: 'C.22', owner: 'engineering_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 0, source: 'Stage 5 outcomes in the change-proposal records', pending: 'npm run governance:check -- --report (docs/rebuild/mentor/governance/proposals)', instrumented: 'external' },
  // GAP-FIX-R3 (Appendix F Stage 5): each running canary against its matched control, so a person reads canary-arm transcripts before release.
  { id: 'canary.arm_comparison', category: 'pipeline', requirement: 'C.22', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.disparityMinSample, source: 'tutor_sessions.canary_arm with the rules-scored transcripts of each arm (npm run tutor:canary-report draws the reading sample)', instrumented: 'yes' },
  // ── Appendix C §1.1 learning outcomes ──
  // GAP-FIX-R4: the SPEC's definition (review cards 30/60/90 days after first mastery, per KC), judged release over release.
  { id: 'learning.delayed_retention', category: 'learning_outcome', requirement: 'B.6', owner: 'pedagogical_lead', threshold: { kind: 'release_non_decline', value: T.retentionDeclineTolerance }, minSample: T.retentionMinLearners, source: 'learning_delayed_retention: first spaced review 30/60/90 days after first mastery, per KC; against learning_retention_release_baseline (the latest recorded release)', instrumented: 'yes' },
  { id: 'learning.practice_success_band', category: 'learning_outcome', requirement: 'B.19', owner: 'pedagogical_lead', threshold: { kind: 'band', value: T.practiceBand.low, upper: T.practiceBand.high }, minSample: T.practiceMinAttempts, source: 'kc_attempt (Mentor practice)', instrumented: 'yes' },
  { id: 'learning.time_to_mastery', category: 'learning_outcome', requirement: 'B.19', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'kc_attempt, every evidence source (attempts to the mastery posterior), per KC and per age band (learning_kc_learner_age_bands)', instrumented: 'yes' },
  { id: 'learning.transfer_success', category: 'learning_outcome', requirement: 'B.7', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: 1, source: 'v2 grade receipts tagged practice or transfer (learning_transfer_success)', instrumented: 'yes' },
  // Appendix C: "the two signals should meaningfully diverge" — a floor on the divergent share (learningQuality.ts).
  { id: 'learning.judgment_quality', category: 'learning_outcome', requirement: 'B.12', owner: 'pedagogical_lead', threshold: { kind: 'floor', value: JUDGMENT_DIVERGENCE_FLOOR }, minSample: JUDGMENT_MIN_ATTEMPTS, source: 'learning_judgment_differentiation (0129)', instrumented: 'yes' },
  { id: 'learning.bridge_conversion', category: 'learning_outcome', requirement: 'B.13', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.narrativeMinSample, source: 'learning_narrative_metrics (0127): prompts converted within 7 days', instrumented: 'yes' },
  { id: 'learning.decision_journal', category: 'learning_outcome', requirement: 'B.9', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.narrativeMinSample, source: 'learning_narrative_metrics (0127): entries recorded and resurfaced', instrumented: 'yes' },
  // ── Appendix C §1.2 engagement health ──
  { id: 'engagement.session_efficiency', category: 'engagement_health', requirement: 'B.28', owner: 'pedagogical_lead', threshold: { kind: 'trend', value: T.engagementTrendTolerance }, minSample: T.engagementTrendMinWeeklySample, source: 'learning_session_efficiency (0136), weekly; higher is better', instrumented: 'yes' },
  { id: 'engagement.mentor_resolution', category: 'engagement_health', requirement: 'B.28', owner: 'pedagogical_lead', threshold: { kind: 'trend', value: T.engagementTrendTolerance }, minSample: T.engagementTrendMinWeeklySample, source: 'mentor_resolution_efficiency (0136), weekly median turns; lower is better', instrumented: 'yes' },
  { id: 'engagement.rest_day_use', category: 'engagement_health', requirement: 'B.21', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.restDayMinLapses, source: 'learning_rest_day_utilization (0134)', instrumented: 'yes' },
  // Per-release manual audits (Appendix C Part 3 Stage 3), recorded by the named owner (release_audit_results).
  { id: 'engagement.dark_pattern_audit', category: 'engagement_health', requirement: 'B.25', owner: 'safety_trust_lead', threshold: { kind: 'zero_tolerance', value: 0 }, minSample: 1, source: 'release_audit_results (dark_pattern): findings in the latest release audit', instrumented: 'yes' },
  { id: 'engagement.variable_ratio_audit', category: 'engagement_health', requirement: 'B.22', owner: 'safety_trust_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'release_audit_results (variable_ratio): the latest release audit passed', instrumented: 'yes' },
  { id: 'engagement.reward_framing', category: 'engagement_health', requirement: 'B.20', owner: 'pedagogical_lead', threshold: { kind: 'hard_invariant', value: 1 }, minSample: 1, source: 'release_audit_results (reward_framing): the latest release audit passed', instrumented: 'yes' },
  { id: 'engagement.autonomy_adoption', category: 'engagement_health', requirement: 'B.24', owner: 'pedagogical_lead', threshold: { kind: 'diagnostic', value: null }, minSample: T.autonomyMinOffers, source: 'learning_autonomy_adoption (0134), per lever', instrumented: 'yes' },
  { id: 'engagement.parent_time_to_value', category: 'engagement_health', requirement: 'B.10', owner: 'pedagogical_lead', threshold: { kind: 'ceiling', value: T.parentTimeToValueSeconds }, minSample: T.parentTimeToValueMinSample, source: 'parent_time_to_value: median seconds from parent_signup_completed to parent_first_value', instrumented: 'yes' },
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
  /** The KC's catalog key, for a readable breakdown (absent: the id is shown). */
  kc_key?: string;
  /** kc_attempt.source; the practice band reads Mentor practice ('segment_grade') only. Absent: Mentor practice. */
  source?: string;
  correct: boolean;
  p_known_after: number | string;
  created_at: string;
}

/** One KC x window of learning_delayed_retention (0237), or of a recorded release. */
export interface RetentionCell {
  kc_key: string;
  window_days: number;
  learners: number;
  correct: number;
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
  /** C.23: every judge's recorded calibration runs and spot checks. */
  judgeCalibrations: CalibrationRecordRow[] | null;
  killSwitchAudit: AuditRow[] | null;
  completeness: { active: number; current: number } | null;
  kcAttempts: KcAttemptRow[] | null;
  /** Appendix C 1.1 Delayed Retention (0237) over the current period: since the latest recorded release (or the window). */
  retention: RetentionCell[] | null;
  /** GAP-FIX-R4: the latest recorded release's frozen cells (null: no release recorded yet, or the read failed). */
  retentionBaseline?: { releaseId: string; cells: RetentionCell[] } | null;
  /** GAP-FIX-R4: each learner's age band (0237 learning_kc_learner_age_bands) for Time-to-Mastery. Optional. */
  ageBands?: { user_id: string; age_band: string }[] | null;
  /**
   * Appendix C 1.1 / 1.2 sources the Learning Quality tab already reads
   * (learningQuality.ts, engagementHealth.ts); each is null when its read failed.
   */
  learning: LearningSignalSources;
  /** GAP-FIX-R1 (Appendix C 1.1): first-try success per KC and item role, from v2 receipts (0207). Optional: absent before the loop reads it. */
  transfer?: { kc: string; item_role: 'practice' | 'transfer'; first_attempts: number; successes: number }[] | null;
  /** GAP-FIX-R2 (Appendix C 1.2): the recorded per-release audits, newest first. Optional: absent before the loop reads it. */
  releaseAudits?: ReleaseAuditRow[] | null;
  /** GAP-FIX-R2 (Appendix C 1.2): parent_time_to_value over the window. Optional: absent before the loop reads it. */
  parentTimeToValue?: { signups: number; reached: number; medianSeconds: number | null; p75Seconds: number | null; withinTarget: number } | null;
  /** GAP-FIX-R3 (C.22 Stage 5): sessions of the window that ran a canary arm. Optional: absent before the loop reads it. */
  canaryArms?: CanaryArmRow[] | null;
  /** GAP-FIX-R3 (C.1, Appendix F 1.3): mentor_age_calibration_coverage over the window. Optional: absent before the loop reads it. */
  ageCalibration?: AgeCalibrationCoverage | null;
}

export interface CanaryArmRow {
  id: string;
  canary_proposal_id: string;
  canary_arm: 'canary' | 'control';
  ended_at: string | null;
}

export interface AgeCalibrationCoverage {
  sessions: number;
  unknownAgeSessions: number;
  calibratedBeforeStart: number;
  coverage: number | null;
}

export interface ReleaseAuditRow {
  audit_kind: ReleaseAuditKind;
  release_id: string;
  result: 'pass' | 'fail';
  finding_count: number;
  recorded_at: string;
}

export interface LearningSignalSources {
  judgment: { lesson_id: string; attempts: number; correct_not_sound: number; incorrect_sound: number }[] | null;
  narrative: {
    journal_entries_recorded: number; journal_entries_resurfaced: number;
    bridge_prompts_offered: number; bridge_prompts_converted_7d: number; bridge_self_commitments: number;
  } | null;
  sessionEfficiency: { week_start: string; learners: number; efficiency_ratio: number | null }[] | null;
  mentorResolution: { week_start: string; intent: string; resolved_sessions: number; median_turns: number | null }[] | null;
  restDays: { learners_with_lapse: number; kept_by_rest_days: number; utilization_rate: number | null; rest_days_used: number } | null;
  autonomy: { lever: string; offered: number; exercised: number; adoption_rate: number | null }[] | null;
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
    case 'transcript_judge.agreement': {
      if (src.judgeCalibrations === null) return unavailable(def);
      const trust = judgeTrust('transcript_judge', src.judgeCalibrations, src.now);
      const trusted = trust.state === 'passed';
      // Appendix F §1.3: below threshold, or not re-checked on the cadence, is
      // a breach (a spot check below threshold also requires recalibration).
      if (!trusted) anomalies.push(anomalyFor(def, 'threshold_breach', 'all', 0, 1, { calibration: trust.state }));
      return reading(def.id, {
        status: trusted ? 'ok' : 'breach',
        value: trusted ? 1 : 0,
        sample: 1,
        detail: { calibration: trust.state, scopeCriteria: trust.scope.length, dueSoon: trust.dueSoon ? 1 : 0, ageDays: trust.ageDays },
        sourceLatestAt: trust.latest?.created_at ?? null,
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
    case 'learning.delayed_retention':
      return retentionReading(def, src, anomalies, unavailable);
    case 'learning.practice_success_band':
    case 'learning.time_to_mastery':
      return practiceReading(def, src, anomalies, unavailable);
    case 'learning.judgment_quality':
    case 'learning.bridge_conversion':
    case 'learning.decision_journal':
    case 'engagement.rest_day_use':
    case 'engagement.autonomy_adoption':
      return learningReading(def, src.learning, anomalies, unavailable);
    case 'engagement.session_efficiency':
    case 'engagement.mentor_resolution':
      return trendReading(def, src.learning, anomalies, unavailable);
    case 'learning.transfer_success': {
      // Appendix C 1.1: success on transfer items, beside practice success on the same KCs.
      // null = the read failed (unavailable); undefined = a source set built before 0207 (no evidence yet).
      if (src.transfer === null) return unavailable(def);
      const all = src.transfer ?? [];
      const share = (role: 'practice' | 'transfer', rows = all) => {
        const picked = rows.filter((r) => r.item_role === role);
        const n = picked.reduce((s, r) => s + r.first_attempts, 0);
        return { n, value: n === 0 ? null : picked.reduce((s, r) => s + r.successes, 0) / n };
      };
      const transfer = share('transfer');
      const kcs = [...new Set(all.map((r) => r.kc))].sort();
      return reading(def.id, {
        status: transfer.n === 0 ? 'insufficient_data' : 'diagnostic',
        value: transfer.value,
        sample: transfer.n,
        breakdown: kcs.flatMap((kc) => (['practice', 'transfer'] as const).map((role) => {
          const s = share(role, all.filter((r) => r.kc === kc));
          return { key: `kc:${kc}/${role}`, value: s.value, sample: s.n, status: 'diagnostic' as const };
        })),
        detail: { practiceShare: share('practice').value ?? -1 },
      });
    }
    case 'engagement.dark_pattern_audit':
    case 'engagement.variable_ratio_audit':
    case 'engagement.reward_framing':
      return releaseAuditReading(def, src, anomalies, unavailable);
    case 'engagement.parent_time_to_value': {
      // null = the read failed; undefined = a source set built before the loop read it (no evidence yet).
      if (src.parentTimeToValue === null) return unavailable(def);
      const p = src.parentTimeToValue ?? { signups: 0, reached: 0, medianSeconds: null, p75Seconds: null, withinTarget: 0 };
      const status: SignalStatus = p.medianSeconds === null || p.reached < def.minSample ? 'insufficient_data'
        : p.medianSeconds > T.parentTimeToValueSeconds ? 'breach' : 'ok';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', p.medianSeconds, T.parentTimeToValueSeconds, { reached: p.reached, signups: p.signups }));
      return reading(def.id, {
        status,
        value: p.medianSeconds,
        sample: p.reached,
        detail: { signups: p.signups, reached: p.reached, p75Seconds: p.p75Seconds, withinTarget: p.withinTarget },
      });
    }
    case 'safety.age_tier_calibration': {
      // null = the read failed; undefined = a source set built before the loop read it (no evidence yet).
      if (src.ageCalibration === null) return unavailable(def);
      const c = src.ageCalibration ?? { sessions: 0, unknownAgeSessions: 0, calibratedBeforeStart: 0, coverage: null };
      const missed = c.unknownAgeSessions - c.calibratedBeforeStart;
      const status: SignalStatus = c.unknownAgeSessions === 0 ? 'insufficient_data' : missed > 0 ? 'breach' : 'ok';
      if (status === 'breach') {
        anomalies.push(anomalyFor(def, 'threshold_breach', 'all', c.coverage, 1, { unknownAgeSessions: c.unknownAgeSessions, uncalibrated: missed }));
      }
      return reading(def.id, {
        status,
        value: c.coverage,
        sample: c.unknownAgeSessions,
        detail: { sessions: c.sessions, unknownAgeSessions: c.unknownAgeSessions, uncalibrated: missed },
      });
    }
    case 'canary.arm_comparison':
      return canaryReading(def, src, anomalies, unavailable);
    default:
      return reading(def.id, { status: 'not_instrumented' });
  }
}

/**
 * GAP-FIX-R3 (C.22, Appendix F Part 3 Stage 5): each running canary against
 * its matched control arm, on the rules-scored transcripts of each arm (a
 * session that failed any rules criterion counts once). A canary arm clearly
 * worse than its control (the disparity rule: ratio, gap and sample on both
 * sides) opens a flag for the pedagogical lead: a person reads canary-arm
 * transcripts (`npm run tutor:canary-report -- --proposal=<id> --sample=20`)
 * before the proposal may be released or must be rolled back.
 */
function canaryReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.canaryArms === null || src.scores === null) return unavailable(def);
  const arms = src.canaryArms ?? [];
  if (arms.length === 0) return reading(def.id, { status: 'insufficient_data', detail: { canaries: 0 } });
  const breakdown: Breakdown[] = [];
  let regressions = 0;
  const proposals = [...groupBy(arms, (r) => r.canary_proposal_id)].sort(([a], [b]) => a.localeCompare(b));
  for (const [proposalId, rows] of proposals) {
    const summary = summarizeCanaryArms(rows, src.scores);
    const canary = { sessions: summary.canary.sessions, n: summary.canary.scored, hits: summary.canary.failing };
    const control = { sessions: summary.control.sessions, n: summary.control.scored, hits: summary.control.failing };
    const regression = disparities([
      { key: 'canary', hits: canary.hits, n: canary.n },
      { key: 'control', hits: control.hits, n: control.n },
    ]).find((d) => d.key === 'canary');
    const enough = canary.n >= def.minSample && control.n >= def.minSample;
    const armStatus: SignalStatus = regression ? 'breach' : enough ? 'diagnostic' : 'insufficient_data';
    for (const [arm, stats] of [['canary', canary], ['control', control]] as const) {
      breakdown.push({ key: `proposal:${proposalId}/arm:${arm}`, value: stats.n === 0 ? null : stats.hits / stats.n, sample: stats.n, status: arm === 'canary' ? armStatus : 'diagnostic' });
    }
    if (regression) {
      regressions += 1;
      anomalies.push(anomalyFor(def, 'threshold_breach', `proposal:${proposalId}`, regression.rate, regression.rest, {
        canarySessions: canary.sessions,
        controlSessions: control.sessions,
        canaryScored: canary.n,
        controlScored: control.n,
      }));
    }
  }
  return reading(def.id, {
    status: regressions > 0 ? 'breach' : 'diagnostic',
    value: regressions,
    sample: arms.filter((r) => r.canary_arm === 'canary').length,
    breakdown,
    detail: { canaries: proposals.length, regressions, canarySessions: arms.filter((r) => r.canary_arm === 'canary').length, controlSessions: arms.filter((r) => r.canary_arm === 'control').length },
    sourceLatestAt: latest(arms.map((r) => r.ended_at)),
  });
}

/**
 * Appendix C 1.2's per-release manual audits (B.25, B.22, B.20). The latest
 * recorded audit of the kind decides: a fail breaches (a dark-pattern finding
 * is zero-tolerance), and so does an audit older than the release cadence or
 * none at all (a promise not currently kept reads as a breach, never as calm).
 */
function releaseAuditReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.releaseAudits === null) return unavailable(def);
  // A source set built before the loop read the audits carries no evidence either way.
  if (src.releaseAudits === undefined) return reading(def.id, { status: 'insufficient_data', detail: { cadenceDays: T.releaseAuditCadenceDays } });
  const kind = RELEASE_AUDIT_KINDS.find((k) => RELEASE_AUDIT_SIGNAL[k] === def.id)!;
  const rows = src.releaseAudits.filter((r) => r.audit_kind === kind).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const latest = rows[0];
  if (!latest) {
    anomalies.push(anomalyFor(def, 'threshold_breach', 'all', null, T.releaseAuditCadenceDays, { audits: 0 }));
    return reading(def.id, { status: 'breach', detail: { audits: 0, cadenceDays: T.releaseAuditCadenceDays } });
  }
  const ageDays = Math.floor((src.now.getTime() - Date.parse(latest.recorded_at)) / 86_400_000);
  const failed = latest.result === 'fail';
  const stale = ageDays > T.releaseAuditCadenceDays;
  const value = def.id === 'engagement.dark_pattern_audit' ? latest.finding_count : failed ? 0 : 1;
  if (failed) {
    anomalies.push(anomalyFor(def, def.threshold.kind === 'zero_tolerance' ? 'zero_tolerance' : 'threshold_breach', 'all', value, def.threshold.value, { findings: latest.finding_count, ageDays }));
  } else if (stale) {
    anomalies.push(anomalyFor(def, 'threshold_breach', 'audit_age', ageDays, T.releaseAuditCadenceDays, { ageDays }));
  }
  return reading(def.id, {
    status: failed || stale ? 'breach' : 'ok',
    value,
    sample: rows.length,
    detail: { result: latest.result, findings: latest.finding_count, ageDays, cadenceDays: T.releaseAuditCadenceDays },
    sourceLatestAt: latest.recorded_at,
  });
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

/**
 * Appendix C 1.1 Delayed Retention Rate (GAP-FIX-R4): the share of learners
 * answering the review card correctly 30 / 60 / 90 days after first mastery,
 * per KC. Target: the first recorded release is the baseline, then no decline
 * release over release. Each KC x window of the current period is compared
 * with the latest recorded release; a fall of more than the tolerance, with
 * enough learners on both sides, is a breach for that cell.
 */
function retentionReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.retention === null) return unavailable(def);
  const cells = src.retention.filter((c) => c.learners > 0);
  const learners = cells.reduce((s, c) => s + c.learners, 0);
  const correct = cells.reduce((s, c) => s + c.correct, 0);
  const baseline = src.retentionBaseline ?? null;
  const base = new Map((baseline?.cells ?? []).map((c) => [`${c.kc_key}|${c.window_days}`, c]));
  let compared = 0;
  let declined = 0;
  const breakdown: Breakdown[] = cells
    .map((c): Breakdown => {
      const share = c.correct / c.learners;
      const prior = base.get(`${c.kc_key}|${c.window_days}`);
      const key = `kc:${c.kc_key}/days:${c.window_days}`;
      if (!prior || prior.learners < T.retentionMinLearners || c.learners < T.retentionMinLearners) {
        return { key, value: share, sample: c.learners, status: baseline ? 'insufficient_data' : 'diagnostic' };
      }
      compared += 1;
      const priorShare = prior.correct / prior.learners;
      if (share < priorShare - T.retentionDeclineTolerance) {
        declined += 1;
        anomalies.push(anomalyFor(def, 'relative_drop', key, share, priorShare, { learners: c.learners, baselineLearners: prior.learners, release: baseline!.releaseId }));
        return { key, value: share, sample: c.learners, status: 'breach' };
      }
      return { key, value: share, sample: c.learners, status: 'ok' };
    })
    .sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
  // No release recorded yet: this period is the release-1 baseline being established (diagnostic, never a pass).
  const status: SignalStatus = learners === 0 ? 'insufficient_data'
    : !baseline ? 'diagnostic'
      : declined > 0 ? 'breach' : compared > 0 ? 'ok' : 'insufficient_data';
  return reading(def.id, {
    status,
    value: learners === 0 ? null : correct / learners,
    sample: learners,
    breakdown,
    detail: { baselineRelease: baseline?.releaseId ?? null, kcs: new Set(cells.map((c) => c.kc_key)).size, compared, declined },
  });
}

/** Age bands Time-to-Mastery is segmented by (Appendix C 1.1), in display order. */
export const MASTERY_AGE_BANDS = ['6-9', '10-12', '13-17', 'adult', 'unknown'] as const;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

function practiceReading(def: SignalDefinition, src: QualitySources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  if (src.kcAttempts === null) return unavailable(def);
  const sourceLatestAt = latest(src.kcAttempts.map((r) => r.created_at));
  if (def.id === 'learning.practice_success_band') {
    // B.19's band is about practice exercises: the Mentor's graded practice, not course-lesson evidence.
    const practice = src.kcAttempts.filter((r) => (r.source ?? 'segment_grade') === 'segment_grade');
    const n = practice.length;
    const correct = practice.filter((r) => r.correct).length;
    const rate = n === 0 ? null : correct / n;
    const outside: Breakdown[] = [];
    for (const [kc, rs] of groupBy(practice, (r) => r.kc_key ?? r.kc_id)) {
      if (rs.length < T.practiceMinAttempts) continue;
      const r = rs.filter((x) => x.correct).length / rs.length;
      if (r < T.practiceBand.low || r > T.practiceBand.high) outside.push({ key: `kc:${kc}`, value: r, sample: rs.length, status: 'breach' });
    }
    const status: SignalStatus = rate === null || n < def.minSample ? 'insufficient_data' : rate < T.practiceBand.low || rate > T.practiceBand.high ? 'breach' : 'ok';
    if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', rate, rate! < T.practiceBand.low ? T.practiceBand.low : T.practiceBand.high, { attempts: n }));
    return reading(def.id, { status, value: rate, sample: n, breakdown: outside.slice(0, 20), detail: { kcsOutsideBand: outside.length }, sourceLatestAt });
  }
  // Time-to-Mastery (Appendix C 1.1, diagnostic): attempts until the
  // posterior first reaches the bar, per learner x KC in the window, from
  // every evidence source (B.6: one mastery model). The median overall, and
  // per KC and per age band (GAP-FIX-R4), to be read beside the practice band.
  const bands = new Map((src.ageBands ?? []).map((r) => [r.user_id, r.age_band]));
  const pairs = groupBy([...src.kcAttempts].sort((a, b) => a.created_at.localeCompare(b.created_at)), (r) => `${r.user_id}|${r.kc_id}`);
  const counts: number[] = [];
  const byKc = new Map<string, number[]>();
  const byBand = new Map<string, number[]>();
  for (const rs of pairs.values()) {
    const at = rs.findIndex((r) => Number(r.p_known_after) >= T.masteryPosterior);
    if (at < 0) continue;
    counts.push(at + 1);
    const kc = rs[0]!.kc_key ?? rs[0]!.kc_id;
    byKc.set(kc, [...(byKc.get(kc) ?? []), at + 1]);
    const band = bands.get(rs[0]!.user_id) ?? 'unknown';
    byBand.set(band, [...(byBand.get(band) ?? []), at + 1]);
  }
  const breakdown: Breakdown[] = [
    ...MASTERY_AGE_BANDS.filter((b) => byBand.has(b)).map((b): Breakdown => ({ key: `band:${b}`, value: median(byBand.get(b)!), sample: byBand.get(b)!.length, status: 'diagnostic' })),
    ...[...byKc.keys()].sort().map((kc): Breakdown => ({ key: `kc:${kc}`, value: median(byKc.get(kc)!), sample: byKc.get(kc)!.length, status: 'diagnostic' })),
  ];
  return reading(def.id, {
    status: counts.length === 0 ? 'insufficient_data' : 'diagnostic',
    value: median(counts),
    sample: counts.length,
    breakdown,
    detail: { pairs: pairs.size, kcs: byKc.size, ageBands: src.ageBands ? 'read' : 'unavailable' },
    sourceLatestAt,
  });
}

// ── Appendix C 1.1 / 1.2 signals the Learning Quality tab already computes ─

function learningReading(def: SignalDefinition, l: LearningSignalSources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  const rate = (num: number, den: number) => (den === 0 ? null : num / den);
  switch (def.id) {
    case 'learning.judgment_quality': {
      if (l.judgment === null) return unavailable(def);
      const attempts = l.judgment.reduce((s, r) => s + r.attempts, 0);
      const divergent = l.judgment.reduce((s, r) => s + r.correct_not_sound + r.incorrect_sound, 0);
      const value = rate(divergent, attempts);
      const status: SignalStatus = value === null || attempts < def.minSample ? 'insufficient_data' : value < JUDGMENT_DIVERGENCE_FLOOR ? 'breach' : 'ok';
      if (status === 'breach') anomalies.push(anomalyFor(def, 'threshold_breach', 'all', value, JUDGMENT_DIVERGENCE_FLOOR, { attempts }));
      const breakdown: Breakdown[] = l.judgment
        .filter((r) => r.attempts >= JUDGMENT_MIN_ATTEMPTS)
        .map((r) => {
          const v = (r.correct_not_sound + r.incorrect_sound) / r.attempts;
          return { key: `lesson:${r.lesson_id}`, value: v, sample: r.attempts, status: v < JUDGMENT_DIVERGENCE_FLOOR ? 'breach' as const : 'ok' as const };
        })
        .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
        .slice(0, 20);
      return reading(def.id, { status, value, sample: attempts, breakdown, detail: { lessons: l.judgment.length, divergent } });
    }
    case 'learning.bridge_conversion': {
      if (l.narrative === null) return unavailable(def);
      const n = l.narrative;
      const value = rate(n.bridge_prompts_converted_7d, n.bridge_prompts_offered);
      return reading(def.id, {
        status: value === null || n.bridge_prompts_offered < def.minSample ? 'insufficient_data' : 'diagnostic', value, sample: n.bridge_prompts_offered,
        detail: { converted: n.bridge_prompts_converted_7d, selfCommitments: n.bridge_self_commitments },
      });
    }
    case 'learning.decision_journal': {
      if (l.narrative === null) return unavailable(def);
      const n = l.narrative;
      const value = rate(n.journal_entries_resurfaced, n.journal_entries_recorded);
      return reading(def.id, {
        status: value === null || n.journal_entries_recorded < def.minSample ? 'insufficient_data' : 'diagnostic', value, sample: n.journal_entries_recorded,
        detail: { recorded: n.journal_entries_recorded, resurfaced: n.journal_entries_resurfaced },
      });
    }
    case 'engagement.rest_day_use': {
      if (l.restDays === null) return unavailable(def);
      const r = l.restDays;
      return reading(def.id, {
        status: r.utilization_rate === null || r.learners_with_lapse < def.minSample ? 'insufficient_data' : 'diagnostic', value: r.utilization_rate, sample: r.learners_with_lapse,
        detail: { keptByRestDays: r.kept_by_rest_days, restDaysUsed: r.rest_days_used },
      });
    }
    default: {
      if (l.autonomy === null) return unavailable(def);
      const offered = l.autonomy.reduce((s, r) => s + r.offered, 0);
      const exercised = l.autonomy.reduce((s, r) => s + r.exercised, 0);
      const value = rate(exercised, offered);
      return reading(def.id, {
        status: value === null || offered < def.minSample ? 'insufficient_data' : 'diagnostic', value, sample: offered,
        breakdown: l.autonomy.map((r) => ({ key: `lever:${r.lever}`, value: r.adoption_rate, sample: r.offered, status: 'diagnostic' as const })),
        detail: { exercised },
      });
    }
  }
}

/**
 * Appendix C 1.2's two B.28 metrics: "hold steady or improve". The weekly
 * series is judged by classifyTrend (the Learning Quality tab's own rule);
 * a regression in the bad direction is a breach for the named owner.
 */
function trendReading(def: SignalDefinition, l: LearningSignalSources, anomalies: Anomaly[], unavailable: (d: SignalDefinition) => SignalReading): SignalReading {
  const efficiency = def.id === 'engagement.session_efficiency';
  const points = efficiency
    ? l.sessionEfficiency?.map((r) => ({ week_start: r.week_start, value: r.efficiency_ratio, sample: r.learners })) ?? null
    : l.mentorResolution?.filter((r) => r.intent === 'all').map((r) => ({ week_start: r.week_start, value: r.median_turns, sample: r.resolved_sessions })) ?? null;
  if (points === null) return unavailable(def);
  const trend: TrendStatus = classifyTrend(points, efficiency ? 'higher-is-better' : 'lower-is-better');
  const usable = points.filter((p) => p.value !== null && p.sample >= TREND_MIN_WEEKLY_SAMPLE).sort((a, b) => a.week_start.localeCompare(b.week_start));
  const recent = usable.slice(-TREND_WINDOW_WEEKS);
  const value = recent.length === 0 ? null : recent[recent.length - 1]!.value;
  const status: SignalStatus = trend === 'insufficient_data' ? 'insufficient_data' : trend === 'regression' ? 'breach' : 'diagnostic';
  if (trend === 'regression') {
    anomalies.push(anomalyFor(def, efficiency ? 'relative_drop' : 'upward_drift', 'all', value, TREND_TOLERANCE, { weeks: usable.length }));
  }
  return reading(def.id, {
    status,
    value,
    sample: recent.reduce((s, p) => s + p.sample, 0),
    breakdown: usable.slice(-TREND_WINDOW_WEEKS * 2).map((p) => ({ key: `week:${p.week_start}`, value: p.value, sample: p.sample, status: 'diagnostic' as const })),
    detail: { trend, weeks: usable.length },
    sourceLatestAt: usable.length === 0 ? null : usable[usable.length - 1]!.week_start,
  });
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
