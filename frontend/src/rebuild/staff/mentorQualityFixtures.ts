import type { DashboardSignal, MentorQualityDashboardData, OwnerRole, SignalCategory, SignalStatus } from './mentorQualityApi';

/*
 * C.24 preview fixtures for the isolated staff surface (`?screen=staff-mentor-quality`).
 * The signal list mirrors Core's registry (id, category, owner, whether it is
 * instrumented); the readings are invented to show every status the surface
 * must render. No real learner, no real number.
 */

type Row = [string, SignalCategory, OwnerRole, DashboardSignal['instrumented']];

export const PREVIEW_SIGNAL_REGISTRY: Row[] = [
  ['mastery.corroboration_compliance', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['mastery.reversal_rate', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['rubric.hint_repeat', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['rubric.tell_honored', 'pedagogy', 'pedagogical_lead', 'not_instrumented'],
  ['rubric.self_explanation', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['spaced_review.routing', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['disposition.completeness', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['session_end.trigger_rate', 'pedagogy', 'pedagogical_lead', 'yes'],
  ['alliance.bond_proxy', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.goal_agreement', 'relational', 'pedagogical_lead', 'yes'],
  ['alliance.renegotiation', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.answer_reveal', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.false_affirmation', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.praise_specificity', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.check_in', 'relational', 'pedagogical_lead', 'yes'],
  ['telemetry.default_to_inaction', 'relational', 'pedagogical_lead', 'yes'],
  ['telemetry.friction_rate', 'relational', 'safety_trust_lead', 'yes'],
  ['rubric.closing_script', 'relational', 'pedagogical_lead', 'yes'],
  ['dialogue.ab_outcome', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.controlling_language', 'relational', 'pedagogical_lead', 'yes'],
  ['rubric.emotion_label', 'safety_governance', 'safety_trust_lead', 'yes'],
  ['judge.content_calibration', 'safety_governance', 'safety_trust_lead', 'yes'],
  ['kill_switch.open', 'safety_governance', 'safety_trust_lead', 'yes'],
  ['bias_audit.coverage', 'safety_governance', 'safety_trust_lead', 'external'],
  ['transcript_judge.agreement', 'safety_governance', 'safety_trust_lead', 'yes'],
  ['governance.tier_compliance', 'safety_governance', 'safety_trust_lead', 'external'],
  ['evaluation.coverage', 'pipeline', 'engineering_lead', 'yes'],
  ['content_ladder.distribution', 'pipeline', 'pedagogical_lead', 'yes'],
  ['simulated_student.pass_rate', 'pipeline', 'engineering_lead', 'external'],
  ['canary.regression_rate', 'pipeline', 'engineering_lead', 'external'],
  ['learning.delayed_retention', 'learning_outcome', 'pedagogical_lead', 'yes'],
  ['learning.practice_success_band', 'learning_outcome', 'pedagogical_lead', 'yes'],
  ['learning.time_to_mastery', 'learning_outcome', 'pedagogical_lead', 'yes'],
  ['learning.transfer_success', 'learning_outcome', 'pedagogical_lead', 'not_instrumented'],
  ['learning.judgment_quality', 'learning_outcome', 'pedagogical_lead', 'not_instrumented'],
  ['learning.bridge_conversion', 'learning_outcome', 'pedagogical_lead', 'not_instrumented'],
  ['learning.decision_journal', 'learning_outcome', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.session_efficiency', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.mentor_resolution', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.streak_anxiety', 'engagement_health', 'safety_trust_lead', 'not_instrumented'],
  ['engagement.rest_day_use', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.dark_pattern_audit', 'engagement_health', 'safety_trust_lead', 'not_instrumented'],
  ['engagement.variable_ratio_audit', 'engagement_health', 'safety_trust_lead', 'not_instrumented'],
  ['engagement.reward_framing', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.autonomy_adoption', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
  ['engagement.parent_time_to_value', 'engagement_health', 'pedagogical_lead', 'not_instrumented'],
];

const READINGS: Record<string, [SignalStatus, number | null, number]> = {
  'mastery.corroboration_compliance': ['ok', 1, 412],
  'mastery.reversal_rate': ['ok', 0.041, 97],
  'rubric.hint_repeat': ['ok', 0, 380],
  'rubric.self_explanation': ['diagnostic', 0.58, 214],
  'spaced_review.routing': ['ok', 1, 133],
  'disposition.completeness': ['diagnostic', 0.83, 260],
  'session_end.trigger_rate': ['insufficient_data', 0.12, 31],
  'alliance.bond_proxy': ['breach', 0.64, 188],
  'rubric.goal_agreement': ['ok', 0.97, 301],
  'alliance.renegotiation': ['diagnostic', 0.9, 20],
  'rubric.answer_reveal': ['ok', 0.062, 1840],
  'rubric.false_affirmation': ['ok', 0, 390],
  'rubric.praise_specificity': ['diagnostic', 0.71, 902],
  'rubric.check_in': ['ok', 0, 77],
  'telemetry.default_to_inaction': ['ok', 0.93, 5120],
  'telemetry.friction_rate': ['breach', 0.22, 390],
  'rubric.closing_script': ['ok', 0, 390],
  'dialogue.ab_outcome': ['insufficient_data', 0, 0],
  'rubric.controlling_language': ['ok', 0, 88],
  'rubric.emotion_label': ['breach', 0.005, 390],
  'judge.content_calibration': ['breach', 0, 1],
  'transcript_judge.agreement': ['breach', 0, 1],
  'kill_switch.open': ['ok', 0, 12],
  'evaluation.coverage': ['ok', 0.996, 390],
  'content_ladder.distribution': ['diagnostic', 0.08, 1210],
  'learning.delayed_retention': ['diagnostic', 0.74, 640],
  'learning.practice_success_band': ['ok', 0.78, 4410],
  'learning.time_to_mastery': ['diagnostic', 5, 212],
};

export function previewMentorQuality(options: { fresh?: string | null; viewer?: string | null; empty?: boolean } = {}): MentorQualityDashboardData {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const ageHours = options.fresh === 'stale' ? 30 : options.fresh === 'never' ? null : 2;
  return {
    generatedAt: new Date(now).toISOString(),
    snapshot: ageHours === null ? null : { computedAt: new Date(now - ageHours * 3_600_000).toISOString(), windowDays: 30, rubricHash: 'c2b0afe50fba8e6690b65e67f05773e42f5f1cbd53a3c016e652679035dfe5ea' },
    freshness: { ageHours, stale: ageHours === null || ageHours > 24, slaHours: 24 },
    lastRun: ageHours === null ? null : { startedAt: new Date(now - ageHours * 3_600_000).toISOString(), status: options.fresh === 'stale' ? 'partial' : 'ok', scored: 18, failed: 0, backlogBefore: 18, trigger: 'schedule' },
    signals: PREVIEW_SIGNAL_REGISTRY.map(([id, category, ownerRole, instrumented]) => {
      const r = READINGS[id];
      return {
        id, category, ownerRole, instrumented, requirement: 'C.24', threshold: { kind: 'diagnostic', value: null }, pending: null,
        reading: ageHours === null || !r ? null : { id, status: r[0], value: r[1], sample: r[2], breakdown: [] },
        stale: ageHours === null || ageHours > 24,
      };
    }),
    flags: {
      active: options.empty ? [] : [
        { id: 'flag-emotion', signalId: 'rubric.emotion_label', kind: 'zero_tolerance', requirement: 'C.9', ownerRole: 'safety_trust_lead', severity: 'urgent', scope: 'all', value: 0.005, threshold: 0, status: 'open', openedAt: '2026-09-24T10:17:00Z', lastSeenAt: '2026-09-25T10:17:00Z', seenCount: 25, resolutionNote: null },
        { id: 'flag-bond', signalId: 'alliance.bond_proxy', kind: 'relative_drop', requirement: 'C.15', ownerRole: 'pedagogical_lead', severity: 'review', scope: 'persona:rho', value: 0.64, threshold: 0.81, status: 'acknowledged', openedAt: '2026-09-22T10:17:00Z', lastSeenAt: '2026-09-25T10:17:00Z', seenCount: 73, resolutionNote: null },
        { id: 'flag-friction', signalId: 'telemetry.friction_rate', kind: 'subgroup_disparity', requirement: 'C.9', ownerRole: 'safety_trust_lead', severity: 'review', scope: 'persona:dina/locale:es-MX', value: 0.31, threshold: 0.12, status: 'open', openedAt: '2026-09-25T08:17:00Z', lastSeenAt: '2026-09-25T10:17:00Z', seenCount: 3, resolutionNote: null },
      ],
      recentlyResolved: [],
    },
    owners: [
      { role: 'pedagogical_lead', userId: 'u-ped', displayName: 'Ana', assignedAt: '2026-09-20T00:00:00Z' },
      { role: 'safety_trust_lead', userId: 'u-safe', displayName: 'Luis', assignedAt: '2026-09-20T00:00:00Z' },
    ],
    viewerOwnerRoles: options.viewer === 'none' ? [] : ['safety_trust_lead', 'pedagogical_lead'],
    reviews: {
      week: '2026-09-21', previousWeek: '2026-09-14', named: 2, reviewedThisWeek: 1, reviewedPreviousWeek: 1, previousRate: 0.5,
      missingRoles: ['engineering_lead'],
      thisWeek: [{ role: 'pedagogical_lead', reviewerId: 'u-ped', reviewedAt: '2026-09-22T09:00:00Z', openFlags: 2 }],
    },
  };
}
