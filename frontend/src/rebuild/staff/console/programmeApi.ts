/*
 * The trust and identity programme metrics, the
 * Mentor retention sweep status, the operations watchdog and the owner
 * roster.
 *
 * Core is the control: every path sits behind requireRole(admin|superadmin)
 * plus its named grant (backend/src/routes/admin.ts): /admin/analytics needs
 * view_analytics, /admin/tutor/retention-status and /admin/ops/job-status
 * need manage_support, and /admin/mentor-quality/owners needs manage_users.
 * The screens only choose what to ask for.
 *
 * A metric is described, not hand-rendered: its path, a headline field and
 * the supporting fields. Each field names its kind, so a rate is a percent,
 * an empty rate (no population) reads "No data yet" and never 0%, and a
 * payload whose declared fields are of the wrong type is an error state,
 * never a guessed zero. Wire shapes are hand-mirrored from Core (no shared
 * types across packages by design).
 */

export type FieldKind = 'count' | 'rate' | 'decimal' | 'date' | 'flag' | 'length' | 'hours';

export interface MetricField {
  /** The label key in `programme.option` (shared across metrics when the words are the same). */
  key: string;
  path: readonly string[];
  kind: FieldKind;
}

export type MetricTarget = 'zero' | 'full' | 'true';

export interface MetricSpec {
  id: string;
  path: (days: number) => string;
  headline?: MetricField;
  /** Targets: zero (e.g. rows past their period), full (100%) or a check that must hold. Diagnostics have none. */
  target?: MetricTarget;
  facts: readonly MetricField[];
}

const f = (key: string, kind: FieldKind, path: string | readonly string[] = key): MetricField =>
  ({ key, kind, path: typeof path === 'string' ? [path] : path });

/** Core's analytics windows accept 1-365 days (366 for two analytics reads; 365 is safe for all). */
const metricDays = (days: number) => Math.min(365, Math.max(1, Math.round(days)));
const withDays = (path: string) => (days: number) => `${path}?days=${metricDays(days)}`;
const fixed = (path: string) => () => path;

/* ---- Trust (view_analytics) ------------------------------ */

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
  // One Core read, three cards by target: zero-target
  // exposure metrics, the 100% escalation metric with the queue times, and
  // the 100% audit reconciliation.
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
      f('spUnblocks', 'count', ['auditCompleteness', 'unblocks']), f('spUnblocksAudited', 'count', ['auditCompleteness', 'unblocksAudited'])] },
  { id: 'accountDeletions', path: withDays('/admin/analytics/account-deletions'), headline: f('withinSlaRate', 'rate'),
    facts: [f('statedTimelineRate', 'rate'), f('requested', 'count', ['requested', 'total']), f('bySelf', 'count', ['requested', 'byInitiator', 'self']),
      f('byGuardian', 'count', ['requested', 'byInitiator', 'guardian']), f('bySuspension', 'count', ['requested', 'byInitiator', 'suspension_expiry']),
      f('cancelled', 'count'), f('completed', 'count'), f('openPending', 'count', ['open', 'pending']), f('openProcessing', 'count', ['open', 'processing']),
      f('openHeld', 'count', ['open', 'held']), f('openOverdue', 'count', ['open', 'overdue']), f('slaHours', 'hours')] },
];

/* ---- Reading a described metric -------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function pick(data: unknown, path: readonly string[]): unknown {
  let at: unknown = data;
  for (const key of path) {
    if (!isRecord(at)) return undefined;
    at = at[key];
  }
  return at;
}

/** Whether a field's value is of its declared kind. Rates and dates may be null (no population, never run); counts may not. */
function fieldValid(field: MetricField, value: unknown): boolean {
  switch (field.kind) {
    case 'count': case 'hours': return isNumber(value);
    case 'rate': case 'decimal': return value === null || isNumber(value);
    case 'date': return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
    case 'flag': return typeof value === 'boolean';
    case 'length': return Array.isArray(value);
  }
}

/** A path under a null parent (e.g. `lastRun` when the sweep never ran) reads as null for a date. */
export function readField(data: unknown, field: MetricField): unknown {
  if (field.kind === 'date' && field.path.length > 1 && pick(data, field.path.slice(0, -1)) === null) return null;
  return pick(data, field.path);
}

export function metricGuard(spec: MetricSpec) {
  return (value: unknown): value is Record<string, unknown> => {
    if (!isRecord(value)) return false;
    const fields = [...(spec.headline ? [spec.headline] : []), ...spec.facts];
    return fields.every((field) => fieldValid(field, readField(value, field)));
  };
}

/** Whether the headline meets the target (null when there is no target or no data). */
export function onTarget(spec: MetricSpec, value: unknown): boolean | null {
  if (!spec.target || value === null || value === undefined) return null;
  if (spec.target === 'zero') return value === 0;
  if (spec.target === 'full') return value === 1;
  return value === true;
}

/* ---- Mentor retention sweep (manage_support) --------------------------------- */

export interface RetentionSweep { lastRunAt: string | null; hoursSinceLastRun: number | null; stale: boolean }
export const RETENTION_SWEEP_PATH = '/admin/tutor/retention-status';
export const isRetentionSweep = (value: unknown): value is RetentionSweep => isRecord(value) && typeof value.stale === 'boolean'
  && (value.lastRunAt === null || typeof value.lastRunAt === 'string') && (value.hoursSinceLastRun === null || isNumber(value.hoursSinceLastRun));

/* ---- Operations watchdog (manage_support) --------------------------------- */

export const OPS_JOBS_PATH = '/admin/ops/job-status';
/**
 * The data jobs (account deletion, social and learning retention, the insights prune) are watched too.
 * So is the analytics warehouse's 400-day prune and erasure re-apply (`warehouse_retention`, read from dataintel).
 * So is the daily legacy badge-image purge.
 */
export const OPS_JOB_NAMES = [
  'vault_backup', 'pulse_backup', 'vault_drift', 'learning_retention', 'insights_prune', 'account_deletions', 'social_retention',
  'warehouse_retention',
  'badge_link_retirement',
] as const;
export type OpsJobName = (typeof OPS_JOB_NAMES)[number];
export interface OpsJob {
  job: OpsJobName; lastRunAt: string | null; hoursSinceLastRun: number | null; lastAttemptAt: string | null;
  lastAttemptOk: boolean | null; staleAfterHours: number; stale: boolean;
  /** Core could not read this job's record (the warehouse was down); always stale. */
  unreadable?: true;
}
const isNullableTime = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isOpsJob = (value: unknown): value is OpsJob => isRecord(value) && (OPS_JOB_NAMES as readonly unknown[]).includes(value.job)
  && isNullableTime(value.lastRunAt) && (value.hoursSinceLastRun === null || isNumber(value.hoursSinceLastRun)) && isNullableTime(value.lastAttemptAt)
  && (value.lastAttemptOk === null || typeof value.lastAttemptOk === 'boolean') && isNumber(value.staleAfterHours) && typeof value.stale === 'boolean'
  && (value.unreadable === undefined || value.unreadable === true);
/**
 * Warehouse alert triggers in the window that notified
 * nobody (Core's services/warehouseAlerts.ts). `undelivered: null` is a
 * warehouse Core could not read, never "all delivered".
 */
export interface UndeliveredAlerts { undelivered: number | null; windowHours: number; alerts: unknown[] }
export const undeliveredAlertsOf = (value: unknown): UndeliveredAlerts | null => {
  if (!isRecord(value) || !isRecord(value.alerts)) return null;
  const { undelivered, windowHours, alerts } = value.alerts;
  if (!(undelivered === null || (isNumber(undelivered) && undelivered >= 0)) || !isNumber(windowHours)) return null;
  return { undelivered, windowHours, alerts: Array.isArray(alerts) ? alerts : [] };
};
/** Erasures whose step failed more than `afterHours` ago and never completed. */
export interface DeletionFailures { stuck: number; afterHours: number }
const isDeletionFailures = (value: unknown): value is DeletionFailures => isRecord(value)
  && isNumber(value.stuck) && Number.isInteger(value.stuck) && value.stuck >= 0 && isNumber(value.afterHours);
/** A reply without every watched job, its `stale` boolean or the stalled-erasure count is an error state, never "healthy". */
export const isOpsJobs = (value: unknown): value is { jobs: OpsJob[]; anyStale: boolean; accountDeletionFailures: DeletionFailures } => isRecord(value)
  && Array.isArray(value.jobs) && value.jobs.every(isOpsJob) && OPS_JOB_NAMES.every((name) => (value.jobs as OpsJob[]).some((job) => job.job === name))
  && typeof value.anyStale === 'boolean' && isDeletionFailures(value.accountDeletionFailures);

/* ---- Identity metrics (view_analytics) ----------------------- */

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

/* ---- Named owners (manage_users) ---------------------------------------- */

export const OWNERS_PATH = '/admin/mentor-quality/owners';
/** Staff who could be named: an owner must be staff who can read analytics (Core refuses anyone else with NOT_ELIGIBLE_OWNER). */
export const isStaffAccount = (roles: readonly string[]) => roles.includes('admin') || roles.includes('superadmin');
