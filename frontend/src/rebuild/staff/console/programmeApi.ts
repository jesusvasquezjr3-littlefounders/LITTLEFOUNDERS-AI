import { UUID } from './staffConsoleApi';

/*
 * W2T.4: the Appendix H (family) and Appendix J/L (trust) programme metrics
 * Core has served since S07-S08 with no staff screen, the D.18 denial-reason
 * scoring sample (owner answer D-23), the D.17 support rollback of a child's
 * independence level, the Mentor retention sweep status and the C.24 owner
 * roster.
 *
 * Core is the control: every path sits behind requireRole(admin|superadmin)
 * plus its named grant (backend/src/routes/admin.ts): /admin/family and
 * /admin/analytics need view_analytics, /admin/family-autonomy and
 * /admin/tutor/retention-status need manage_support, and
 * /admin/mentor-quality/owners needs manage_users. The screens only choose
 * what to ask for.
 *
 * A metric is described, not hand-rendered: its path, a headline field, the
 * supporting fields and optional row tables. Each field names its kind, so a
 * rate is a percent, an empty rate (no population) reads "No data yet" and
 * never 0%, and a payload whose declared fields are of the wrong type is an
 * error state, never a guessed zero. Wire shapes are hand-mirrored from Core
 * (no shared types across packages by design).
 */

export type FieldKind = 'count' | 'rate' | 'decimal' | 'date' | 'flag' | 'length' | 'hours';

export interface MetricField {
  /** The label key in `programme.option` (shared across metrics when the words are the same). */
  key: string;
  path: readonly string[];
  kind: FieldKind;
  /** Core leaves the field out when there is nothing to count (e.g. no step-down by that actor): read as 0. */
  optional?: boolean;
}

export interface MetricRows {
  /** The table caption key in `programme.heading`. */
  caption: string;
  path: readonly string[];
  /** The row's own label: a field of the row, shown through `programme.option.v_<value>` when known. */
  label: string;
  /** The label column's header key in `programme.option`. */
  labelKey: string;
  columns: readonly MetricField[];
}

export type MetricTarget = 'zero' | 'full' | 'true';

export interface MetricSpec {
  id: string;
  path: (days: number) => string;
  headline?: MetricField;
  /** Appendix targets: zero (e.g. rows past their period), full (100%) or a check that must hold. Diagnostics have none. */
  target?: MetricTarget;
  facts: readonly MetricField[];
  rows?: readonly MetricRows[];
}

const f = (key: string, kind: FieldKind, path: string | readonly string[] = key, optional = false): MetricField =>
  ({ key, kind, path: typeof path === 'string' ? [path] : path, optional });

/** Core's family and analytics windows accept 1-365 days (366 for two analytics reads; 365 is safe for all). */
export const metricDays = (days: number) => Math.min(365, Math.max(1, Math.round(days)));
const withDays = (path: string) => (days: number) => `${path}?days=${metricDays(days)}`;
const fixed = (path: string) => () => path;

/* ---- Family (Appendix H, view_analytics) ---------------------------------- */

export const FAMILY_GROUPS = ['integrity', 'money', 'decisions', 'coaching'] as const;
export type FamilyGroup = (typeof FAMILY_GROUPS)[number];

export const FAMILY_METRICS: Record<FamilyGroup, readonly MetricSpec[]> = {
  integrity: [
    { id: 'stateIntegrity', path: withDays('/admin/family/state-integrity'), headline: f('outsideService', 'count'), target: 'zero',
      facts: [f('transitions', 'count')],
      rows: [{ caption: 'integrityTables', path: ['tables'], label: 'table', labelKey: 'table', columns: [f('transitions', 'count'), f('outsideService', 'count')] }] },
    { id: 'retentionCompliance', path: fixed('/admin/family/retention-compliance'), headline: f('pass', 'flag'), target: 'true',
      facts: [f('overdue', 'count'), f('lastRun', 'date', ['lastRun', 'ranAt'])],
      rows: [{ caption: 'retentionTables', path: ['tables'], label: 'table', labelKey: 'table', columns: [f('retainDays', 'count'), f('overdue', 'count')] }] },
    { id: 'insightUptime', path: withDays('/admin/family/engagement-uptime'), headline: f('probeUptime', 'rate', ['probe', 'uptime']), target: 'full',
      facts: [f('probeChecks', 'count', ['probe', 'checks']), f('requestUptime', 'rate', ['requests', 'uptime']), f('requestChecks', 'count', ['requests', 'checks']),
        f('lastChecked', 'date', ['probe', 'lastCheckedAt'])] },
  ],
  money: [
    { id: 'teenWallet', path: withDays('/admin/family/teen-wallet-adoption'), headline: f('adoptionRate', 'rate'),
      facts: [f('eligibleTeens', 'count'), f('adopters', 'count'), f('independentAdopters', 'count'), f('linkedAdopters', 'count'), f('newAdopters', 'count')] },
    { id: 'bonusComprehension', path: withDays('/admin/family/savings-bonus-comprehension'), headline: f('completionRate', 'rate'),
      facts: [f('eligible', 'count'), f('shown', 'count'), f('completed', 'count')] },
    { id: 'registers', path: fixed('/admin/family/register-distribution'), headline: f('walletHolders', 'count', 'total'), facts: [],
      rows: [{ caption: 'registerRows', path: ['registers'], label: 'register', labelKey: 'register', columns: [f('holders', 'count'), f('share', 'rate')] }] },
    { id: 'redemptionTiming', path: withDays('/admin/family/redemption-timing'), facts: [],
      rows: [
        { caption: 'afterAllowance', path: ['allowance'], label: 'bin', labelKey: 'bin', columns: [f('requests', 'count'), f('ratePer100ChildDays', 'decimal')] },
        { caption: 'afterEarned', path: ['earned'], label: 'bin', labelKey: 'bin', columns: [f('requests', 'count'), f('ratePer100ChildDays', 'decimal')] },
      ] },
    { id: 'splitEngagement', path: withDays('/admin/family/split-engagement'), headline: f('adjustedShare', 'rate'),
      facts: [f('allocations', 'count'), f('adjusted', 'count')],
      rows: [{ caption: 'splitSources', path: ['sources'], label: 'source', labelKey: 'source',
        columns: [f('allocations', 'count'), f('keptDefault', 'count'), f('adjusted', 'count'), f('adjustedShare', 'rate')] }] },
    { id: 'savePersistence', path: withDays('/admin/family/save-persistence'), headline: f('saveShare', 'rate'),
      facts: [f('children', 'count'), f('saveContributors', 'count'), f('saveCoins', 'count'), f('ownCoins', 'count')] },
    { id: 'postGoal', path: withDays('/admin/family/post-goal-motivation'),
      facts: [
        f('goalsNext', 'count', ['nextGoalWithin2Days', 'goals']), f('beforeNext', 'decimal', ['nextGoalWithin2Days', 'meanBeforePerDay']),
        f('afterNext', 'decimal', ['nextGoalWithin2Days', 'meanAfterPerDay']), f('dropNext', 'count', ['nextGoalWithin2Days', 'goalsWithDrop']),
        f('goalsNoNext', 'count', ['noNextGoalWithin2Days', 'goals']), f('beforeNoNext', 'decimal', ['noNextGoalWithin2Days', 'meanBeforePerDay']),
        f('afterNoNext', 'decimal', ['noNextGoalWithin2Days', 'meanAfterPerDay']), f('dropNoNext', 'count', ['noNextGoalWithin2Days', 'goalsWithDrop']),
      ] },
    { id: 'shareCompletion', path: withDays('/admin/family/share-completion'), headline: f('completionRate', 'rate'),
      facts: [f('pledged', 'count'), f('givenInWindow', 'count'), f('givenLater', 'count'), f('returned', 'count'), f('waiting', 'count'),
        f('holdersWithShare', 'count'), f('holdersWithoutDestination', 'count')] },
  ],
  decisions: [
    { id: 'choreTags', path: withDays('/admin/family/chore-tag-adoption'), headline: f('contributionShare', 'rate'),
      facts: [f('contributionTasks', 'count'), f('bonusTasks', 'count'), f('tutors', 'count'), f('tutorsUsingContribution', 'count')] },
    { id: 'restDays', path: withDays('/admin/family/chore-streak-rest-days'), headline: f('coveredShare', 'rate'),
      facts: [f('children', 'count'), f('restDayCovered', 'count'), f('runsEnded', 'count')] },
    { id: 'autonomyProgression', path: withDays('/admin/family/autonomy-progression'),
      facts: [f('stepDownTutor', 'count', ['stepDowns', 'tutor'], true), f('stepDownChild', 'count', ['stepDowns', 'child'], true),
        f('stepDownStaff', 'count', ['stepDowns', 'staff'], true), f('stepDownSystem', 'count', ['stepDowns', 'system'], true)],
      rows: [{ caption: 'levelRows', path: ['levels'], label: 'level', labelKey: 'level',
        columns: [f('judged', 'count'), f('progressed', 'count'), f('waiting', 'count'), f('progressionRate', 'rate')] }] },
    { id: 'talkNudges', path: withDays('/admin/family/talk-nudges'), headline: f('triggerRate', 'rate'),
      facts: [f('patterns', 'count'), f('nudged', 'count'), f('childAsks', 'count'), f('talked', 'count'), f('dismissed', 'count'), f('stillOpen', 'count')] },
    { id: 'denialActionability', path: withDays('/admin/family/denial-actionability'), headline: f('actionabilityRate', 'rate'),
      facts: [f('denials', 'count'), f('structured', 'count'), f('structuredRate', 'rate'), f('admitted', 'count'), f('scored', 'count'), f('actionable', 'count')] },
  ],
  coaching: [
    { id: 'coachingDelivery', path: fixed('/admin/family/coaching-delivery'), headline: f('deliveryRate', 'rate'),
      facts: [f('eligible', 'count'), f('delivered', 'count'), f('opened', 'count'), f('openRate', 'rate'), f('reviewedTips', 'count'), f('draftedTips', 'count')] },
    { id: 'reflections', path: withDays('/admin/family/coaching-reflections'), headline: f('firedRate', 'rate'),
      facts: [f('tutorDecisions', 'count'), f('withReflection', 'count'), f('written', 'count'), f('shared', 'count'), f('skipped', 'count')] },
    { id: 'bridge', path: fixed('/admin/family/bridge-engagement'), facts: [f('minAge', 'count')],
      rows: [{ caption: 'bridgeRows', path: ['moments'], label: 'milestone', labelKey: 'milestone',
        columns: [f('eligible', 'count'), f('engaged', 'count'), f('engagementRate', 'rate')] }] },
    { id: 'research', path: fixed('/admin/family/research-completeness'), facts: [f('windowMonths', 'count'), f('minTenureMonths', 'count')],
      rows: [{ caption: 'researchRows', path: ['cohorts'], label: 'cohort', labelKey: 'cohort',
        columns: [f('longTenure', 'count'), f('enrolled', 'count'), f('coverage', 'rate'), f('completeness', 'rate')] }] },
  ],
};

/* ---- Trust (Appendix J and L, view_analytics) ------------------------------ */

export const TRUST_METRICS: readonly MetricSpec[] = [
  { id: 'socialSafety', path: fixed('/admin/analytics/social-safety'), headline: f('reviewCoverage', 'rate'), target: 'full',
    facts: [f('guardianTierReviewCoverage', 'rate'), f('inScope', 'count', ['profileReview', 'inScope']), f('reviewed', 'count', ['profileReview', 'reviewed']),
      f('flagged', 'count', ['profileReview', 'flagged']), f('tierGuardian', 'count', ['accountsByTier', 'guardian']), f('tierTeen', 'count', ['accountsByTier', 'teen']),
      f('tierAdult', 'count', ['accountsByTier', 'adult']), f('tierClosed', 'count', ['accountsByTier', 'closed']),
      f('consentPending', 'count', ['teenConsent', 'pending']), f('consentAccepted', 'count', ['teenConsent', 'accepted']),
      f('consentDeclined', 'count', ['teenConsent', 'declined']), f('consentWithdrawn', 'count', ['teenConsent', 'withdrawnOrRemoved'])] },
  { id: 'socialGovernance', path: fixed('/admin/analytics/social-governance'), headline: f('retentionCompliant', 'flag'), target: 'true',
    facts: [f('windowsMatchPolicy', 'flag'), f('messagingSurfaceFree', 'flag'), f('messagingSurfaces', 'length'), f('unconsentedChildEdges', 'count'),
      f('offSchemaAvatars', 'count', ['offSchema', 'avatars']), f('offSchemaCovers', 'count', ['offSchema', 'covers']),
      f('overdueTeenPending', 'count', ['overdue', 'teenPending']), f('overdueGuardianPending', 'count', ['overdue', 'guardianPending']),
      f('overdueTeenClosed', 'count', ['overdue', 'teenClosed']), f('overdueGuardianClosed', 'count', ['overdue', 'guardianClosed']),
      f('overdueReportNotes', 'count', ['overdue', 'reportNotes']), f('overdueResolvedReports', 'count', ['overdue', 'resolvedReports']),
      f('overdueResolvedCases', 'count', ['overdue', 'resolvedCases']), f('overdueNotices', 'count', ['overdue', 'notices']),
      f('lastSweep', 'date', ['lastSweep', 'at'])] },
  // Appendix J E.1-E.5 (one Core read, three cards by target): zero-target
  // exposure metrics, the 100% escalation metric with the queue times, and
  // the 100% audit reconciliation with the Family panel views.
  { id: 'socialDiscovery', path: withDays('/admin/analytics/social-protection'), headline: f('spDiscoveryReached', 'count', ['discovery', 'unrelatedReached']), target: 'zero',
    facts: [f('spDiscoveryAttempts', 'count', ['discovery', 'unrelatedAttempts']), f('spResolutions', 'count', ['discovery', 'resolutions']),
      f('spBadgeUnrelated', 'count', ['tutorBadge', 'shownUnrelated']), f('spBadgeShown', 'count', ['tutorBadge', 'shown']),
      f('spAgeOther', 'count', ['ageBoundary', 'other']), f('spAgeGuardianPath', 'count', ['ageBoundary', 'guardianPath']),
      f('spAgeReviewed', 'count', ['ageBoundary', 'reviewedFunction']),
      f('spUnauthorizedRate', 'rate', ['unauthorizedConnections', 'rate']), f('spFollowAttempts', 'count', ['unauthorizedConnections', 'followAttempts']),
      f('spRefusedGuardian', 'count', ['unauthorizedConnections', 'refusedGuardianApproval']),
      f('spRefusedConsent', 'count', ['unauthorizedConnections', 'refusedSubjectConsent']),
      f('spGuardianRequests', 'count', ['unauthorizedConnections', 'guardianRequests']),
      f('spUnrelatedRequests', 'count', ['unauthorizedConnections', 'unrelatedGuardianRequests'])] },
  { id: 'socialEscalation', path: withDays('/admin/analytics/social-protection'), headline: f('spEscalationRate', 'rate', ['patternEscalation', 'rate']), target: 'full',
    facts: [f('spQualifying', 'count', ['patternEscalation', 'qualifying']), f('spEscalated', 'count', ['patternEscalation', 'escalated']),
      f('spReportsFiled', 'count', ['reports', 'filed']), f('spReportsOpen', 'count', ['reports', 'open']), f('spReportsResolved', 'count', ['reports', 'resolved']),
      f('spReportP50', 'decimal', ['reports', 'p50ResolutionHours']), f('spReportP95', 'decimal', ['reports', 'p95ResolutionHours']),
      f('spApprovalDecided', 'count', ['approvalLatency', 'guardianDecided']), f('spApprovalPending', 'count', ['approvalLatency', 'guardianPending']),
      f('spApprovalP50', 'decimal', ['approvalLatency', 'guardianP50Hours']), f('spApprovalP95', 'decimal', ['approvalLatency', 'guardianP95Hours']),
      f('spTeenDecided', 'count', ['approvalLatency', 'teenDecided']), f('spTeenP50', 'decimal', ['approvalLatency', 'teenP50Hours'])] },
  { id: 'socialAudit', path: withDays('/admin/analytics/social-protection'), headline: f('spAuditRate', 'rate', ['auditCompleteness', 'rate']), target: 'full',
    facts: [f('spFollows', 'count', ['auditCompleteness', 'follows']), f('spFollowsAudited', 'count', ['auditCompleteness', 'followsAudited']),
      f('spBlocks', 'count', ['auditCompleteness', 'blocks']), f('spBlocksAudited', 'count', ['auditCompleteness', 'blocksAudited']),
      f('spReports', 'count', ['auditCompleteness', 'reports']), f('spReportsAudited', 'count', ['auditCompleteness', 'reportsAudited']),
      f('spUnfollows', 'count', ['auditCompleteness', 'unfollows']), f('spUnfollowsAudited', 'count', ['auditCompleteness', 'unfollowsAudited']),
      f('spUnblocks', 'count', ['auditCompleteness', 'unblocks']), f('spUnblocksAudited', 'count', ['auditCompleteness', 'unblocksAudited']),
      f('spPanelViews', 'count', ['familySocialPanel', 'views']), f('spGuardians', 'count', ['familySocialPanel', 'guardiansWithLinkedChild'])] },
  { id: 'accountDeletions', path: withDays('/admin/analytics/account-deletions'), headline: f('withinSlaRate', 'rate'),
    facts: [f('statedTimelineRate', 'rate'), f('requested', 'count', ['requested', 'total']), f('bySelf', 'count', ['requested', 'byInitiator', 'self']),
      f('byGuardian', 'count', ['requested', 'byInitiator', 'guardian']), f('bySuspension', 'count', ['requested', 'byInitiator', 'suspension_expiry']),
      f('cancelled', 'count'), f('completed', 'count'), f('openPending', 'count', ['open', 'pending']), f('openProcessing', 'count', ['open', 'processing']),
      f('openHeld', 'count', ['open', 'held']), f('openOverdue', 'count', ['open', 'overdue']), f('slaHours', 'hours')] },
  { id: 'achievementSharing', path: withDays('/admin/analytics/achievement-sharing'), headline: f('persistentPublicUrls', 'count'), target: 'zero',
    facts: [f('persistentPublicUrlRate', 'rate'), f('sharesStarted', 'count', ['initiated', 'total']), f('shareSheet', 'count', ['initiated', 'shareSheet']),
      f('download', 'count', ['initiated', 'download']), f('kindBadge', 'count', ['initiated', 'byKind', 'course_badge']),
      f('kindStreak', 'count', ['initiated', 'byKind', 'streak']), f('kindGoal', 'count', ['initiated', 'byKind', 'goal_reached']),
      f('legacyTotal', 'count', ['legacyLinks', 'total']), f('legacyLive', 'count', ['legacyLinks', 'live']), f('legacyRevoked', 'count', ['legacyLinks', 'revoked']),
      f('legacyRetired', 'flag', ['legacyLinks', 'retired']), f('legacyRetires', 'date', ['legacyLinks', 'routeRetiresAt'])] },
];

/* ---- Reading a described metric -------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function pick(data: unknown, path: readonly string[]): unknown {
  let at: unknown = data;
  for (const key of path) {
    if (!isRecord(at)) return undefined;
    at = at[key];
  }
  return at;
}

/** Whether a field's value is of its declared kind. Rates and dates may be null (no population, never run); counts may not. */
export function fieldValid(field: MetricField, value: unknown): boolean {
  if (value === undefined) return Boolean(field.optional);
  switch (field.kind) {
    case 'count': case 'hours': return isNumber(value);
    case 'rate': case 'decimal': return value === null || isNumber(value);
    case 'date': return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
    case 'flag': return typeof value === 'boolean';
    case 'length': return Array.isArray(value);
  }
}

/** A path under a null parent (e.g. `lastRun` when the sweep never ran) reads as null for a date. */
function fieldValue(data: unknown, field: MetricField): unknown {
  if (field.kind === 'date' && field.path.length > 1 && pick(data, field.path.slice(0, -1)) === null) return null;
  return pick(data, field.path);
}

export function metricGuard(spec: MetricSpec) {
  return (value: unknown): value is Record<string, unknown> => {
    if (!isRecord(value)) return false;
    const fields = [...(spec.headline ? [spec.headline] : []), ...spec.facts];
    if (!fields.every((field) => fieldValid(field, fieldValue(value, field)))) return false;
    return (spec.rows ?? []).every((rows) => {
      const list = pick(value, rows.path);
      return Array.isArray(list) && list.every((row) => isRecord(row) && (typeof row[rows.label] === 'string' || isNumber(row[rows.label]))
        && rows.columns.every((column) => fieldValid(column, pick(row, column.path))));
    });
  };
}

export function readField(data: unknown, field: MetricField): unknown {
  const value = fieldValue(data, field);
  return value === undefined && field.optional ? 0 : value;
}

/** Whether the headline meets the Appendix target (null when there is no target or no data). */
export function onTarget(spec: MetricSpec, value: unknown): boolean | null {
  if (!spec.target || value === null || value === undefined) return null;
  if (spec.target === 'zero') return value === 0;
  if (spec.target === 'full') return value === 1;
  return value === true;
}

/* ---- D.18 denial-reason scoring (view_analytics; owner answer D-23) --------- */

export interface DenialReason { id: string; subject: string; outcome: string; reasonCode: string | null; reason: string | null; passesStructuralCheck: boolean }
export const DENIAL_SAMPLE_SIZE = 20;
export const denialSamplePath = (days: number) => `/admin/family/denial-reasons/sample?days=${metricDays(days)}&limit=${DENIAL_SAMPLE_SIZE}`;
export const isDenialSample = (value: unknown): value is { since: string; reasons: DenialReason[] } => isRecord(value)
  && Array.isArray(value.reasons) && value.reasons.every((r) => isRecord(r) && typeof r.id === 'string' && UUID.test(r.id)
    && typeof r.subject === 'string' && typeof r.outcome === 'string' && (r.reasonCode === null || typeof r.reasonCode === 'string')
    && (r.reason === null || typeof r.reason === 'string') && typeof r.passesStructuralCheck === 'boolean');

/* ---- D.17 support rollback (manage_support) ---------------------------------- */

export type AutonomyLevel = 1 | 2 | 3;
export interface StaffAutonomyChange { id: string; fromLevel: number; toLevel: number; by: 'tutor' | 'child' | 'staff' | 'system'; reason: string | null; createdAt: string }
export interface StaffAutonomy {
  autonomy: { inFamily: boolean; level: AutonomyLevel; levelSince: string | null; preapprovedLimit: number };
  changes: StaffAutonomyChange[];
}
const isLevel = (value: unknown): value is AutonomyLevel => value === 1 || value === 2 || value === 3;
export const isStaffAutonomy = (value: unknown): value is StaffAutonomy => isRecord(value) && isRecord(value.autonomy)
  && typeof value.autonomy.inFamily === 'boolean' && isLevel(value.autonomy.level) && isNumber(value.autonomy.preapprovedLimit)
  && (value.autonomy.levelSince === null || typeof value.autonomy.levelSince === 'string')
  && Array.isArray(value.changes) && value.changes.every((c) => isRecord(c) && typeof c.id === 'string' && isNumber(c.fromLevel) && isNumber(c.toLevel)
    && ['tutor', 'child', 'staff', 'system'].includes(c.by as string) && (c.reason === null || typeof c.reason === 'string') && typeof c.createdAt === 'string');
/** Core's LowerLevel body: a lower level (1 or 2) and a reason of at most 240 characters the database finds actionable. */
export const LOWER_REASON_MAX = 240;
export const autonomyPath = (kidId: string) => `/admin/family-autonomy/${encodeURIComponent(kidId)}`;
/** The levels a support lowering may choose: strictly below the current one. */
export const lowerLevels = (level: AutonomyLevel): AutonomyLevel[] => ([1, 2] as AutonomyLevel[]).filter((candidate) => candidate < level);

/* ---- Mentor retention sweep (manage_support) --------------------------------- */

export interface RetentionSweep { lastRunAt: string | null; hoursSinceLastRun: number | null; stale: boolean }
export const RETENTION_SWEEP_PATH = '/admin/tutor/retention-status';
export const isRetentionSweep = (value: unknown): value is RetentionSweep => isRecord(value) && typeof value.stale === 'boolean'
  && (value.lastRunAt === null || typeof value.lastRunAt === 'string') && (value.hoursSinceLastRun === null || isNumber(value.hoursSinceLastRun));

/* ---- H.4 operations watchdog (manage_support) --------------------------------- */

export const OPS_JOBS_PATH = '/admin/ops/job-status';
/** GAP-FIX-R6: the family-data jobs (account deletion, family, social and learning retention, the insights prune) are watched too. */
export const OPS_JOB_NAMES = [
  'vault_backup', 'pulse_backup', 'vault_drift', 'learning_retention', 'insights_prune', 'account_deletions', 'family_retention', 'social_retention',
] as const;
export type OpsJobName = (typeof OPS_JOB_NAMES)[number];
export interface OpsJob {
  job: OpsJobName; lastRunAt: string | null; hoursSinceLastRun: number | null; lastAttemptAt: string | null;
  lastAttemptOk: boolean | null; staleAfterHours: number; stale: boolean;
}
const isNullableTime = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isOpsJob = (value: unknown): value is OpsJob => isRecord(value) && (OPS_JOB_NAMES as readonly unknown[]).includes(value.job)
  && isNullableTime(value.lastRunAt) && (value.hoursSinceLastRun === null || isNumber(value.hoursSinceLastRun)) && isNullableTime(value.lastAttemptAt)
  && (value.lastAttemptOk === null || typeof value.lastAttemptOk === 'boolean') && isNumber(value.staleAfterHours) && typeof value.stale === 'boolean';
/** E.6: erasures whose step failed more than `afterHours` ago and never completed. */
export interface DeletionFailures { stuck: number; afterHours: number }
const isDeletionFailures = (value: unknown): value is DeletionFailures => isRecord(value)
  && isNumber(value.stuck) && Number.isInteger(value.stuck) && value.stuck >= 0 && isNumber(value.afterHours);
/** A reply without every watched job, its `stale` boolean or the stalled-erasure count is an error state, never "healthy". */
export const isOpsJobs = (value: unknown): value is { jobs: OpsJob[]; anyStale: boolean; accountDeletionFailures: DeletionFailures } => isRecord(value)
  && Array.isArray(value.jobs) && value.jobs.every(isOpsJob) && OPS_JOB_NAMES.every((name) => (value.jobs as OpsJob[]).some((job) => job.job === name))
  && typeof value.anyStale === 'boolean' && isDeletionFailures(value.accountDeletionFailures);

/* ---- Appendix M Part 1: identity metrics (view_analytics) ----------------------- */

export const identityPath = (days: number) => `/admin/analytics/identity?days=${days}`;
export type IdentityKind = 'release_gate' | 'diagnostic';
export type IdentityStatus = 'met' | 'missed' | 'no_data' | 'diagnostic';
export interface IdentityMetric {
  id: string; part: string; requirement: string; kind: IdentityKind; target: number | null;
  numerator: number; denominator: number; value: number | null; status: IdentityStatus;
}
export interface IdentityReport {
  window: { from: string; to: string; days: number };
  metrics: IdentityMetric[];
  adversarial: { id: string; requirement: string; suite: string }[];
  releaseGate: { total: number; met: number; missed: number; noData: number };
}
const isIdentityMetric = (value: unknown): value is IdentityMetric => isRecord(value) && typeof value.id === 'string'
  && (value.kind === 'release_gate' || value.kind === 'diagnostic') && ['met', 'missed', 'no_data', 'diagnostic'].includes(value.status as string)
  && isNumber(value.numerator) && isNumber(value.denominator) && (value.value === null || isNumber(value.value));
export const isIdentityReport = (value: unknown): value is IdentityReport => isRecord(value) && isRecord(value.window)
  && Array.isArray(value.metrics) && value.metrics.every(isIdentityMetric) && Array.isArray(value.adversarial)
  && value.adversarial.every((entry) => isRecord(entry) && typeof entry.id === 'string')
  && isRecord(value.releaseGate) && isNumber(value.releaseGate.total) && isNumber(value.releaseGate.met) && isNumber(value.releaseGate.missed);

/* ---- C.24 named owners (manage_users) ---------------------------------------- */

export const OWNERS_PATH = '/admin/mentor-quality/owners';
/** Staff who could be named: an owner must be staff who can read analytics (Core refuses anyone else with NOT_ELIGIBLE_OWNER). */
export const isStaffAccount = (roles: readonly string[]) => roles.includes('admin') || roles.includes('superadmin');
