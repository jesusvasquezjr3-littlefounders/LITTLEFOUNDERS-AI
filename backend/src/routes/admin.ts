import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { getConfig } from '../config.js';
import { authedUser, requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import {
  readActivationFunnel,
  readCohortRetention,
  readConsentCoverage,
  readDailyActivity,
  readDailyUsers,
  readEventExport,
  readFamilyEngagementInsight,
  readStaffInsightUptime,
  recordStaffInsightCheck,
  readFeatureAdoption,
  readLearningVelocity,
  readLessonDropoff,
  readSegmentCalibration,
  readEngagement,
  readSessionDepth,
  readTimeToValue,
  toCsv,
  DEVICES,
  LOCALES,
  RECORDABLE_EVENTS,
  ROUTE_CLASSES,
} from '../services/insights.js';
import {
  readAudience,
  readRegistrations,
  readSignupFunnelIntegrity,
  readAnonAcquisition,
} from '../services/audience.js';
import { getAchievementSharingMetrics } from '../services/achievementSharingMetrics.js';
import { getAccountDeletionMetrics } from '../services/accountDeletionMetrics.js';
import { getIdentityMetrics } from '../services/identityMetrics.js';
import { getDisclosureCoverage } from '../services/disclosureCoverage.js';
import { getOpsJobStatus } from '../services/opsJobs.js';
import {
  BYPASS_WINDOW_DAYS,
  getContentBypassReport,
  listPendingLessonVersions,
  rejectLessonVersion,
  releaseLessonVersion,
  type VersionDecision,
} from '../services/contentRelease.js';
import { readRegisterDistribution } from '../services/moneyPresentation.js';
import { renderAnalyticsReportPdf, REPORT_LOCALES, type ReportLocale } from '../services/analyticsReport.js';
import { getTutorRetentionStatus, listTutorReviewQueue } from '../services/tutorData.js';
import {
  getLiveContentGate,
  LIVE_CONTENT_FLOORS,
  LIVE_CONTENT_THRESHOLDS,
  liveReviewBacklog,
  recordLiveReview,
  resetLiveContentGateCache,
  RISK_CATEGORIES,
} from '../services/pedagogy/liveContentGovernance.js';
import { JUDGE_REGISTRY } from '../services/pedagogy/judgeCalibration.js';
import { listTutorPacks, PACK_STATUSES, setTutorPackStatus } from '../services/tutorPacks.js';
import {
  acknowledgeFlag,
  getMentorQualityDashboard,
  OWNER_ROLES,
  recordOwnerReview,
  recordReleaseAudit,
  resolveFlag,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  setOwner,
} from '../services/pedagogy/mentorQualityDashboard.js';
import { RELEASE_AUDIT_KINDS } from '../services/pedagogy/mentorQuality.js';
import {
  renderAnalyticsReportCsv,
  renderAnalyticsReportXlsx,
  renderTablesCsv,
  renderTablesXlsx,
  type ExportSheet,
} from '../services/analyticsExport.js';
import {
  getKumaHealth,
  getPlausibleBreakdown,
  getPlausibleOverview,
  getPlausibleReportData,
  getPulseConfig,
  getUmamiStats,
  getUmamiBreakdown,
  getUmamiSeries,
  UMAMI_DIMENSIONS,
  type UmamiDimension,
  kumaConfigured,
  parseRange,
  PLAUSIBLE_DIMENSION_KEYS,
  PLAUSIBLE_PERIODS,
  plausibleConfigured,
  REPORT_AUDIENCES,
  resolveRange,
  umamiConfigured,
} from '../services/pulse.js';
import type { AnalyticsRange, PlausibleFilter, PlausibleReportData } from '../services/pulse.js';
import {
  createExclusion,
  isIpExcluded,
  listActiveExclusions,
  listExclusionSuggestions,
  normalizeIp,
  parseNetwork,
  recordStaffSighting,
  revokeExclusion,
} from '../services/analyticsExclusions.js';
import { getOwnAdminPermissions, insertAuditLog } from '../services/supabaseRest.js';
import { readSocialSafetyMetrics } from '../services/socialTier.js';
import {
  REVIEW_WINDOW_DAYS,
  bandWithinGuardRails,
  loadLearningQualityReport,
  resolvePracticeReview,
  setPracticeBand,
  syncPracticeReviews,
} from '../services/learningQuality.js';
import { DEFECT_KINDS, recordContentDefectEscape } from '../services/learningQaSignals.js';
import { getStage3State, recordStage3Review, Stage3ReviewBody, STAGE3_RECORD_REFUSALS } from '../services/pedagogicalReview.js';
import { getFamilyStateIntegrity } from '../services/familyLifecycle.js';
import { readRetentionCompliance } from '../services/familyRetention.js';
import { readCoachingDelivery, readReflectionRate } from '../services/parentCoaching.js';
import { readBridgeEngagement } from '../services/moneyBridge.js';
import { readResearchCompleteness, RESEARCH_COMPLETENESS_MONTHS, RESEARCH_MIN_TENURE_MONTHS } from '../services/familyResearch.js';
import { getTeenWalletAdoption } from '../services/teenWallet.js';
import { readBonusComprehension, readChoreTagAdoption } from '../services/savingsBonus.js';
import { choreStreakRestDayUtilization } from '../services/choreStreakData.js';
import { utcDayOffset } from '../services/choreStreak.js';
import {
  readPostGoalMotivation,
  readRedemptionTiming,
  readSavePersistence,
  readShareCompletion,
  readSplitEngagement,
  SHARE_COMPLETION_WINDOW_DAYS,
} from '../services/moneyHabits.js';
import {
  AUTONOMY_PROGRESSION_WINDOW_DAYS,
  isRefusal as isAutonomyRefusal,
  listAutonomyChanges,
  readAutonomyProgression,
  readAutonomyStatus,
  readDenialActionability,
  readDenialReasonSample,
  readTalkNudgeRate,
  reasonActionable,
  scoreDenialReason,
  staffLowerAutonomy,
  toWireAutonomy,
  toWireChange,
  UNAVAILABLE as AUTONOMY_UNAVAILABLE,
} from '../services/familyAutonomy.js';
import {
  getAdminOverview,
  getAdminContentSummary,
  getReviewLessonDetail,
  getCoachReport,
  compareRuns,
  getGenerationAnalytics,
  getGenerationOverview,
  getGenerationRun,
  getHeartbeatSnapshots,
  getLearningRetention,
  getLiveGeneration,
  getSignupTimeline,
  getSlotDetail,
  grantRoleChecked,
  grantParentRoleWithJustification,
  getAccessReviewStatus,
  recordAccessReview,
  ACCESS_REVIEW_CADENCE_DAYS,
  STAFF_REVIEW_ROLES,
  STAFF_REVIEW_PERMISSIONS,
  ADMIN_PERMISSIONS,
  findRoleCandidates,
  isCourseStatus,
  isLessonStatus,
  listAdminCourses,
  listCourseAssemblyIncidents,
  listAdminUsers,
  listAudit,
  listReviewLessons,
  listRoleHolders,
  listSocialReportCases,
  getSocialReportCase,
  resolveSocialReviewCase,
  revokeParentVerification,
  grantAdminPermissionChecked,
  revokeStaffGrant,
  type StaffRevokeOutcome,
  setCourseStatus,
  setLessonStatus,
} from '../services/adminData.js';
import { readSocialGovernanceMetrics, windowsMatchPolicy } from '../services/socialGovernance.js';
import { APPROVE_REASONS, CorrectionReason, CorrectionStatus, decideCorrection, listCorrections, REJECT_REASONS } from '../services/ageCorrection.js';
import { readSocialProtectionMetrics, socialProtectionVerdicts } from '../services/socialProtection.js';

/*
 * /api/v1/admin — the staff console's data plane. Admins need a current named
 * grant for each staff surface; Superadmins retain full access. Role and grant
 * mutations require Superadmin. Analytics and health are Core-brokered Pulse
 * reads: external monitoring tokens never reach the browser.
 *
 * Route gates check the role and current grant before platform reads or writes.
 * RLS and database triggers remain the second enforcement layer.
 */

/*
 * Period selection. `period` is a Plausible preset or the literal `custom`,
 * in which case `from`/`to` carry an inclusive day range. parseRange() does
 * the real validation (well-formed days, from <= to, not in the future, not
 * absurdly long) so every analytics route agrees on what a window is.
 */
const PERIOD_VALUES = [...PLAUSIBLE_PERIODS, 'custom'] as const;
const RANGE_SHAPE = {
  period: z.enum(PERIOD_VALUES).default('30d'),
  from: z.string().optional(),
  to: z.string().optional(),
};
const PERIOD_MESSAGE = 'period must be day|7d|30d|month|6mo|12mo|year|all, or custom with from/to as YYYY-MM-DD';

const PeriodSchema = z.object({ ...RANGE_SHAPE });

const BreakdownQuerySchema = z.object({
  ...RANGE_SHAPE,
  dimension: z.enum(PLAUSIBLE_DIMENSION_KEYS),
  limit: z.coerce.number().int().min(1).max(200).default(8),
});

const UMAMI_DIMENSION_KEYS = Object.keys(UMAMI_DIMENSIONS) as [UmamiDimension, ...UmamiDimension[]];

const BehaviorBreakdownSchema = z.object({
  ...RANGE_SHAPE,
  dimension: z.enum(UMAMI_DIMENSION_KEYS),
  limit: z.coerce.number().int().min(1).max(200).default(8),
});

const ReportQuerySchema = z.object({
  ...RANGE_SHAPE,
  audience: z.enum(REPORT_AUDIENCES).default('full'),
});

/*
 * Rows per breakdown in an export. A PDF page holds about ten before it stops
 * being readable; a spreadsheet is where an analyst goes precisely to get more
 * than that, so the caller chooses instead of the format deciding for them.
 */
const ExportRowsSchema = z.object({
  rows: z.coerce.number().int().min(1).max(200).default(10),
});

/** Query → range, or null when the selection is not a window we can honour. */
function rangeFromQuery(q: { period: string; from?: string; to?: string }): AnalyticsRange | null {
  return parseRange(q.period, q.from, q.to);
}

// Plausible v2 filter clause: [operator, dimension, clauses] — validated here,
// passed through to Plausible verbatim (analytics-contract shape).
const PlausibleFiltersSchema = z.array(z.tuple([z.string(), z.string(), z.array(z.union([z.string(), z.number()]))]));

type ParsedFilters = { ok: true; filters?: PlausibleFilter[] } | { ok: false };

/** `filters` arrives as an optional JSON string in the query — parse strictly. */
function parseFilters(raw: unknown): ParsedFilters {
  if (raw === undefined) return { ok: true };
  if (typeof raw !== 'string') return { ok: false };
  try {
    const parsed = PlausibleFiltersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ok: true, filters: parsed.data } : { ok: false };
  } catch {
    return { ok: false }; // malformed JSON
  }
}

const PULSE_UNCONFIGURED = 'PULSE_UNCONFIGURED';
const UPSTREAM_FAILED = 'UPSTREAM_FAILED';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';

interface EmailLogEntry {
  /** Row identity (Vault uuid, or the message id when Courier is buffer-only). */
  id: string;
  /** The SMTP/provider Message-ID — the value to correlate with Amazon SES logs. */
  messageId: string;
  to: string;
  subject: string;
  status: string;
  templateType: string;
  locale?: string;
  userId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

const EmailLogsSchema = z.object({
  entries: z.array(z.custom<EmailLogEntry>((v) => typeof (v as Record<string, unknown>)?.id === 'string')),
  total: z.number().int().min(0),
});

const EmailLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(32).optional(),
  templateType: z.string().trim().max(64).optional(),
});

const EmailSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

const EmailTrendPointSchema = z.object({
  date: z.string().date(),
  count: z.number().int().min(0),
});

const EmailSummarySchema = z.object({
  total: z.number().int().min(0),
  statuses: z.record(z.string(), z.number().int().min(0)),
  templates: z.record(z.string(), z.number().int().min(0)),
  locales: z.record(z.string(), z.number().int().min(0)).optional(),
  trend: z.array(EmailTrendPointSchema).optional(),
});

const InsightsCalibrationQuerySchema = z.object({
  minLearners: z.coerce.number().int().min(1).max(100).default(2),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const InsightsActivityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const InsightsFamiliesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/*
 * Windows for the audience surface. 365 is the same ceiling the other insights
 * routes use; the default is 30 because that is the window an operator reads
 * without thinking about it.
 */
const AudienceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const InsightsCohortQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});

const InsightsLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/*
 * Session depth is a RECENT-sessions inspector. Its view is bounded to a
 * rolling 90 days so the window prunes the scan rather than the output (see
 * 0025 §5), and the parameter is clamped to match: accepting `days=365` and
 * silently returning nothing older than 90 would be a contract this endpoint
 * cannot honour. Long-range session volume is answered by
 * insights_daily_users.sessions, which is rolled up daily and kept forever.
 */
const InsightsDepthQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

/*
 * Export filters. Every dimension is an enum or a bounded number — an export
 * endpoint is the one place a free-form filter string would become a SQL/
 * PostgREST injection surface, so there are no free-form filters.
 */
const InsightsExportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  format: z.enum(['csv', 'json']).default('csv'),
  role: z.enum(['anon', 'universal', 'parent', 'kid', 'bigfounder', 'admin', 'superadmin']).optional(),
  event: z.enum(RECORDABLE_EVENTS).optional(),
  routeClass: z.enum(ROUTE_CLASSES).optional(),
  locale: z.enum(LOCALES).optional(),
  device: z.enum(DEVICES).optional(),
  limit: z.coerce.number().int().min(1).max(50_000).default(10_000),
  // Paging exists so "export everything" is actually reachable: a 90-day
  // window can exceed any single-response cap, and an analyst must be able to
  // walk it rather than receive a silently clipped file.
  offset: z.coerce.number().int().min(0).max(10_000_000).default(0),
  // Continuation token: the salt from page 1, so session_ref stays stable
  // across the pages of one logical export.
  exportToken: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

const TimelineQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
});

const CoachQuerySchema = z.object({
  course: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  track: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/).optional(),
});

const GRANTABLE_ROLES = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
const RoleMutationSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(GRANTABLE_ROLES),
  // A.5: a staff grant of the parent role must carry an audited
  // justification — the badge means "verified", and a staff grant is not
  // an ID check, so the reason must be reconstructable afterwards.
  justification: z.string().trim().min(10).max(200).optional(),
});

const AdminPermissionMutationSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(ADMIN_PERMISSIONS),
});

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().trim().min(1).max(100).optional(),
  actorId: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/*
 * Internal-traffic exclusions. `network` is free-form on purpose (an operator
 * types an address or a CIDR), so it is parsed by parseNetwork() — which
 * masks host bits, rejects anything unparseable and refuses a prefix broad
 * enough to silence the whole platform — before it reaches the database.
 */
const ExclusionCreateSchema = z.object({
  network: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(280).optional(),
});

const ExclusionSelfSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  reason: z.string().trim().max(280).optional(),
});

const ExclusionQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const ExclusionParamSchema = z.object({ id: z.string().uuid() });

/** Intel export window. Mirrors dataintel's contract so one selection drives both. */
const IntelExportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const RoleCandidateQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
// Run ids are operator-chosen (`<track-id>--<adventure-slug>` or a default
// timestamp id) — constrain to a safe charset, never interpolate raw.
const GenerationRunParamSchema = z.object({
  runId: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/),
});

export function adminRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(['admin', 'superadmin']));
  router.use('/users', requireAdminPermission('manage_users'));
  // E.4 (OD-3): deciding a self-registered account's age correction is a user-account decision.
  router.use('/age-corrections', requireAdminPermission('manage_users'));
  // The Content screen also loads lesson and Tutor review queues. Guard every
  // endpoint it uses, including mutations and direct API requests.
  router.use('/content', requireAdminPermission('manage_content'));
  router.use('/generation', requireAdminPermission('manage_content'));
  router.use('/moderation', requireAdminPermission('manage_content'));
  router.use('/tutor/review-queue', requireAdminPermission('manage_content'));
  // C.5/C.6: the live-content governance status and the curated-pack release
  // gate are content decisions, like the review queue.
  router.use('/tutor/live-content', requireAdminPermission('manage_content'));
  router.use('/tutor/packs', requireAdminPermission('manage_content'));
  router.use('/analytics', requireAdminPermission('view_analytics'));
  router.use('/insights', requireAdminPermission('view_analytics'));
  router.use('/intel', requireAdminPermission('view_analytics'));
  router.use(/^\/intel-export\.(?:csv|xlsx)$/, requireAdminPermission('view_analytics'));
  router.use('/health/services', requireAdminPermission('view_analytics'));
  router.use('/learning/retention', requireAdminPermission('view_analytics'));
  // C.24: the Mentor-quality dashboard is read with the analytics grant. The
  // named-owner rule for acknowledging, resolving and reviewing is enforced in
  // the service; naming an owner also needs manage_users.
  router.use('/mentor-quality', requireAdminPermission('view_analytics'));
  router.use('/mentor-quality/owners', requireAdminPermission('manage_users'));
  router.use('/emails', requireAdminPermission('manage_support'));
  router.use('/audit', requireAdminPermission('manage_support'));
  router.use('/tutor/retention-status', requireAdminPermission('manage_support'));
  // H.4: the backup and drift-probe watchdog status sits beside the retention sweep's.
  router.use('/ops', requireAdminPermission('manage_support'));
  // E.3 report escalation queue: support-adjacent tooling per G.1's mapping.
  router.use('/reports', requireAdminPermission('manage_support'));
  // D.4's Appendix H metric: a read-only integrity count, analytics-grade.
  router.use('/family', requireAdminPermission('view_analytics'));
  // S07.5 (D.17, Appendix H DoD (d)): lowering a child's independence level
  // after a support review changes a family's state, so it needs the
  // support grant, never the read-only analytics grant.
  router.use('/family-autonomy', requireAdminPermission('manage_support'));
  // IP exclusions and non-read intelligence operations change operational
  // state. A read-only analytics grant cannot authorize those changes.
  router.use('/analytics/exclusions', requireAdminPermission('manage_support'));
  const requireSupport = requireAdminPermission('manage_support');
  router.use('/intel', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    void requireSupport(req, res, next);
  });

  /*
   * Automatic detection for the exclusion panel: remember which addresses the
   * team actually works from, so excluding office/home traffic is one click
   * rather than "go find out what your IP is". Runs AFTER the role gate, so
   * only admin/superadmin addresses are ever recorded (§1.9 — no visitor,
   * parent or kid address is written here). Fire-and-forget and deduped
   * in-process: the console must not pay for it.
   */
  router.use((req, res, next) => {
    recordStaffSighting(authedUser(res).id, req.ip);
    next();
  });

  /** Web-analytics overview (Plausible): aggregate KPIs + daily timeseries, optionally filtered. */
  /*
   * Appendix L achievement-sharing metrics under OD-20 (Product 10 F.1-F.5):
   * shares initiated by hand-off and kind, the Persistent Public URL Rate
   * (target zero) and the legacy links' lifecycle. Never viewer reach.
   * Guarded by the '/analytics' view_analytics mount above.
   */
  const AchievementSharingQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }).strict();
  router.get('/analytics/achievement-sharing', async (req, res) => {
    const parsed = AchievementSharingQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer from 1 to 366');
    const metrics = await getAchievementSharingMetrics(parsed.data.days);
    if (!metrics) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load achievement-sharing metrics');
    return ok(res, metrics);
  });

  /*
   * Appendix J social-layer metrics for E.8 and E.13 (policy: SOCIAL-TIERS.md):
   * accounts by social tier (Age-Tier Differentiation), the Profile-Content
   * Safety Review Coverage (in scope / reviewed / flagged, and the same for
   * the guardian tier the metric names) and the teen consent queue. Counts
   * only; a malformed answer fails the read rather than rendering zeros.
   */
  router.get('/analytics/social-safety', async (req, res) => {
    if (Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No query fields are accepted');
    const metrics = await readSocialSafetyMetrics();
    if (!metrics) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load social-safety metrics');
    const { inScope, reviewed, guardianTierInScope, guardianTierReviewed } = metrics.profileReview;
    return ok(res, {
      ...metrics,
      reviewCoverage: inScope === 0 ? null : reviewed / inScope,
      guardianTierReviewCoverage: guardianTierInScope === 0 ? null : guardianTierReviewed / guardianTierInScope,
    });
  });

  /*
   * Appendix J metrics for E.10, E.11 and E.12 (policy: SOCIAL-GOVERNANCE.md):
   * Social-Data Retention-Policy Compliance (rows past each written window,
   * edges that expose a child without a current guardian's decision, the last
   * sweep), the live-catalog messaging scan (unreviewed schema objects, target
   * none) and Avatar/No-Upload Constraint Integrity (off-schema avatars and
   * covers). `windowsMatchPolicy` says whether the deployed database applies
   * the written windows. Counts and schema names only; a malformed answer
   * fails the read.
   */
  router.get('/analytics/social-governance', async (req, res) => {
    if (Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No query fields are accepted');
    const metrics = await readSocialGovernanceMetrics();
    if (!metrics) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load social-governance metrics');
    const overdueTotal = Object.values(metrics.overdue).reduce((sum, n) => sum + n, 0);
    return ok(res, {
      ...metrics,
      windowsMatchPolicy: windowsMatchPolicy(metrics.windows),
      retentionCompliant: overdueTotal === 0 && metrics.unconsentedChildEdges === 0,
      messagingSurfaceFree: metrics.messagingSurfaces.length === 0,
    });
  });

  /*
   * Appendix J Part 1.1-1.2 metrics for E.1-E.5 (DoD 2.1(3); migration
   * social_protection_metrics): Cross-Family Discovery Rate, Unauthorized
   * Connection Attempt Rate, Guardian-Approval Queue Latency, Report Rate and
   * Resolution Time, Repeated-Contact Pattern Escalation Rate, Age-Tier
   * Boundary Integrity, Tutor-Badge Cross-Population Visibility,
   * Family-Panel Social Visibility Adoption and Audit-Log Completeness for
   * Social Events, over the last `days`. Counts and durations only; the
   * verdicts compare them with the Appendix targets. A malformed answer
   * fails the read.
   */
  const SocialProtectionQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }).strict();
  router.get('/analytics/social-protection', async (req, res) => {
    const parsed = SocialProtectionQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer from 1 to 366');
    const metrics = await readSocialProtectionMetrics(parsed.data.days);
    if (!metrics) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load social-protection metrics');
    return ok(res, { ...metrics, ...socialProtectionVerdicts(metrics) });
  });

  /*
   * Appendix J Deletion-Request Clarity for E.6 (policy: ACCOUNT-DELETION.md):
   * requests by initiator and population, the stated-timeline rate, the
   * within-SLA completion rate and the open/overdue queue. Counts only.
   */
  const AccountDeletionQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }).strict();
  router.get('/analytics/account-deletions', async (req, res) => {
    const parsed = AccountDeletionQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer from 1 to 366');
    const metrics = await getAccountDeletionMetrics(parsed.data.days);
    if (!metrics) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load account-deletion metrics');
    return ok(res, metrics);
  });

  /*
   * Appendix M Part 1 (1.1-1.4): the Block A acquisition and identity
   * metrics (public.identity_metrics), each marked as a release-gate target
   * or diagnostic, plus the adversarial metrics with the suite that proves
   * them. Counts only; guarded by the '/analytics' view_analytics mount.
   */
  const IdentityMetricsQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }).strict();
  router.get('/analytics/identity', async (req, res) => {
    const parsed = IdentityMetricsQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer from 1 to 366');
    const report = await getIdentityMetrics(parsed.data.days);
    if (!report) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load identity metrics');
    return ok(res, report);
  });

  /*
   * Appendix O Part 1.1 (H.1): Teen/Guest Consent-Adjacent Disclosure
   * Coverage over the last `days`, against its 100% target
   * (public.analytics_disclosure_coverage). Counts only; guarded by the
   * '/analytics' view_analytics mount. A malformed answer fails the read.
   */
  const ConsentCoverageQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }).strict();
  router.get('/analytics/consent-coverage', async (req, res) => {
    const parsed = ConsentCoverageQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer from 1 to 366');
    const report = await getDisclosureCoverage(parsed.data.days);
    if (!report) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load disclosure coverage');
    return ok(res, report);
  });

  router.get('/analytics/overview', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', PERIOD_MESSAGE);
      return;
    }
    const filters = parseFilters(req.query.filters);
    if (!filters.ok) {
      fail(res, 400, 'VALIDATION_ERROR', 'filters must be a JSON array of [operator, dimension, clauses] tuples');
      return;
    }
    if (!plausibleConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Plausible is not configured on this deployment');
      return;
    }
    const overview = await getPlausibleOverview(range, filters.filters);
    if (!overview) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    // The resolved bounds travel with the payload so the UI can state the
    // window it is showing instead of restating the label it asked for.
    const resolved = resolveRange(range);
    ok(res, {
      period: parsed.data.period,
      from: resolved.from,
      to: resolved.to,
      ...overview,
    });
  });

  /** Top-N breakdown by one dimension (Plausible), ordered by visitors desc. */
  router.get('/analytics/breakdown', async (req, res) => {
    const parsed = BreakdownQuerySchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', `${PERIOD_MESSAGE}; dimension one of the console dimension keys; limit 1-200`);
      return;
    }
    const filters = parseFilters(req.query.filters);
    if (!filters.ok) {
      fail(res, 400, 'VALIDATION_ERROR', 'filters must be a JSON array of [operator, dimension, clauses] tuples');
      return;
    }
    if (!plausibleConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Plausible is not configured on this deployment');
      return;
    }
    const breakdown = await getPlausibleBreakdown(range, parsed.data.dimension, parsed.data.limit, filters.filters);
    if (!breakdown) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    // `imports` travels with the rows so a card can say "historical traffic
    // excluded" instead of leaving the reader to explain a shortfall.
    ok(res, {
      period: parsed.data.period,
      dimension: parsed.data.dimension,
      rows: breakdown.rows,
      imports: breakdown.imports,
    });
  });

  /*
   * Report exports share one front half: validate the window, gate on
   * Plausible being configured, and load the bundle. Keeping it in one place
   * is what guarantees the PDF, the CSV and the spreadsheet describe exactly
   * the same query — three formats disagreeing about the same period would
   * defeat the point of exporting at all.
   */
  async function loadReport(req: Request, res: Response): Promise<PlausibleReportData | null> {
    const parsed = ReportQuerySchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', `${PERIOD_MESSAGE}; audience marketing|sales|frontend|full`);
      return null;
    }
    const filters = parseFilters(req.query.filters);
    if (!filters.ok) {
      fail(res, 400, 'VALIDATION_ERROR', 'filters must be a JSON array of [operator, dimension, clauses] tuples');
      return null;
    }
    if (!plausibleConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Plausible is not configured on this deployment');
      return null;
    }
    const rows = ExportRowsSchema.safeParse(req.query);
    const report = await getPlausibleReportData(
      range,
      parsed.data.audience,
      filters.filters,
      rows.success ? rows.data.rows : 10,
    );
    if (!report) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return null;
    }

    /*
     * Attach OUR OWN measurement of the same window.
     *
     * Everything above comes from Plausible, which sees only anonymous,
     * consented visitors on marketing pages — so an export built from it alone
     * is systematically narrower than a reader assumes. Read in parallel and
     * degraded to `null` rather than to zeros: a report that could not read the
     * first-party views must say so, because zeros here would assert that
     * nobody visited and nobody registered, which is the exact confusion this
     * whole surface exists to end.
     */
    const days = Math.max(
      1,
      Math.min(365, Math.round((Date.parse(`${report.to}T00:00:00Z`) - Date.parse(`${report.from}T00:00:00Z`)) / 86_400_000) + 1),
    );
    const [audience, integrity, acquisition] = await Promise.all([
      readAudience(days),
      readSignupFunnelIntegrity(days),
      readAnonAcquisition(days),
    ]);

    return {
      ...report,
      firstParty:
        audience && integrity && acquisition
          ? {
              sessions: audience.totals,
              externalShare: audience.externalShare,
              accountsCreated: integrity.accountsCreated,
              signupObserved: integrity.signupComplete,
              unobserved: integrity.unobserved,
              anonymousVisitors: acquisition.visitors,
              anonymousConverted: acquisition.converted,
              conversionRate: acquisition.conversionRate,
            }
          : null,
    };
  }

  /** Filename that says what is inside it: audience, real dates, generation day. */
  function exportFilename(report: PlausibleReportData, extension: string): string {
    return `littlefounders-analytics-${report.audience}-${report.from}_to_${report.to}.${extension}`;
  }

  /** Audience report bundle: aggregate + timeseries + the audience's breakdowns. */
  router.get('/analytics/report', async (req, res) => {
    const report = await loadReport(req, res);
    if (report) ok(res, report);
  });

  /*
   * DOCUMENTED EXCEPTION to the §1.6 envelope (like Depot's public file
   * route): the SUCCESS path of the three export routes streams raw file
   * bytes — a download, not an API payload. Every error path still answers
   * the normal {data,error} envelope.
   */
  router.get('/analytics/report.pdf', async (req, res) => {
    const report = await loadReport(req, res);
    if (!report) return;
    /*
     * The document language is chosen by the operator exporting it, not by the
     * server's default: the report is sent to stakeholders who may not share
     * the exporter's UI language. An unknown value falls back to en-US rather
     * than 400 — a download is a poor place to surface a validation error, and
     * an English report is a usable one.
     */
    const requested = String(req.query.locale ?? '');
    const locale = (REPORT_LOCALES as readonly string[]).includes(requested)
      ? (requested as ReportLocale)
      : 'en-US';
    const pdf = await renderAnalyticsReportPdf(report, locale);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${exportFilename(report, 'pdf')}"`)
      .send(pdf);
  });

  router.get('/analytics/report.csv', async (req, res) => {
    const report = await loadReport(req, res);
    if (!report) return;
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${exportFilename(report, 'csv')}"`)
      .send(renderAnalyticsReportCsv(report));
  });

  router.get('/analytics/report.xlsx', async (req, res) => {
    const report = await loadReport(req, res);
    if (!report) return;
    const workbook = await renderAnalyticsReportXlsx(report);
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${exportFilename(report, 'xlsx')}"`)
      .send(workbook);
  });

  /*
   * ── Internal-traffic exclusions (Vault 0045) ─────────────────────────────
   *
   * Reads answer 502 rather than an empty list when Vault is unreachable: a
   * panel that renders "no exclusions" during an outage would tell an operator
   * their staff traffic is being counted when it is not (or the reverse), and
   * this surface exists precisely to be trusted (§1.14).
   */
  router.get('/analytics/exclusions', async (req, res) => {
    const parsed = ExclusionQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'days 1-90, limit 1-200');
      return;
    }
    const selfIp = normalizeIp(req.ip);
    const [active, suggestions, selfExcluded] = await Promise.all([
      listActiveExclusions(),
      listExclusionSuggestions(parsed.data.days, parsed.data.limit),
      isIpExcluded(req.ip),
    ]);
    if (!active || !suggestions || selfExcluded === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not read the analytics exclusion registry');
      return;
    }
    ok(res, {
      self: { ip: selfIp, excluded: selfExcluded },
      active,
      suggestions: suggestions.sightings,
      coveredAddresses: suggestions.excludedAddresses,
      windowDays: parsed.data.days,
    });
  });

  /** Exclude a network from analytics ingestion. Forward-only — never rewrites history. */
  router.post('/analytics/exclusions', async (req, res) => {
    const parsed = ExclusionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'network required, label 1-80 chars, reason up to 280 chars');
      return;
    }
    const network = parseNetwork(parsed.data.network);
    if (network === 'PREFIX_TOO_BROAD') {
      fail(res, 400, 'VALIDATION_ERROR', 'prefix too broad — use /16 or narrower for IPv4, /32 or narrower for IPv6');
      return;
    }
    if (network === 'INVALID') {
      fail(res, 400, 'VALIDATION_ERROR', 'network must be an IPv4/IPv6 address or CIDR range');
      return;
    }
    const actor = authedUser(res);
    const created = await createExclusion({
      network: network.network,
      label: parsed.data.label,
      reason: parsed.data.reason ?? null,
      createdBy: actor.id,
    });
    if (!created.ok) {
      if (created.reason === 'DUPLICATE') {
        fail(res, 409, 'CONFLICT', 'That address is already covered by an active exclusion');
        return;
      }
      fail(res, 502, DATA_UNAVAILABLE, 'Could not store the exclusion');
      return;
    }
    await insertAuditLog(actor.id, 'analytics_exclusion.create', created.row.id, {
      network: created.row.network,
      label: created.row.label,
    });
    ok(res, created.row, 201);
  });

  /**
   * One-click "stop counting me": excludes the caller's current address. This
   * is the button an operator actually reaches for — it needs no knowledge of
   * what their address is, which is the whole reason the old panel went unused.
   */
  router.post('/analytics/exclusions/self', async (req, res) => {
    const parsed = ExclusionSelfSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'label up to 80 chars, reason up to 280 chars');
      return;
    }
    const ip = normalizeIp(req.ip);
    if (!ip) {
      fail(res, 400, 'VALIDATION_ERROR', 'Could not determine your address from this request');
      return;
    }
    const network = parseNetwork(ip);
    if (typeof network === 'string') {
      fail(res, 400, 'VALIDATION_ERROR', 'Could not determine your address from this request');
      return;
    }
    const actor = authedUser(res);
    const created = await createExclusion({
      network: network.network,
      label: parsed.data.label ?? 'Staff device',
      reason: parsed.data.reason ?? null,
      createdBy: actor.id,
    });
    if (!created.ok) {
      if (created.reason === 'DUPLICATE') {
        fail(res, 409, 'CONFLICT', 'Your address is already covered by an active exclusion');
        return;
      }
      fail(res, 502, DATA_UNAVAILABLE, 'Could not store the exclusion');
      return;
    }
    await insertAuditLog(actor.id, 'analytics_exclusion.create_self', created.row.id, {
      network: created.row.network,
      label: created.row.label,
    });
    ok(res, created.row, 201);
  });

  /** Revoke an exclusion (soft — the row stays for the audit trail). */
  router.delete('/analytics/exclusions/:id', async (req, res) => {
    const parsed = ExclusionParamSchema.safeParse(req.params);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
      return;
    }
    const actor = authedUser(res);
    const revoked = await revokeExclusion(parsed.data.id, actor.id);
    if (revoked === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not revoke the exclusion');
      return;
    }
    if (revoked === false) {
      fail(res, 404, 'NOT_FOUND', 'No active exclusion with that id');
      return;
    }
    await insertAuditLog(actor.id, 'analytics_exclusion.revoke', revoked.id, { network: revoked.network });
    ok(res, revoked);
  });

  /** Behavioral stats (Umami): adult-surfaces product analytics. */
  router.get('/analytics/behavior', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', PERIOD_MESSAGE);
      return;
    }
    if (!umamiConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Umami is not configured on this deployment');
      return;
    }
    const stats = await getUmamiStats(range);
    if (!stats) {
      fail(res, 502, UPSTREAM_FAILED, 'Umami did not answer');
      return;
    }
    const resolved = resolveRange(range);
    ok(res, {
      period: parsed.data.period,
      from: resolved.from,
      to: resolved.to,
      ...stats,
    });
  });

  /*
   * Behavioural breakdowns (Umami).
   *
   * Umami holds twelve dimensions of product behaviour that nothing read until
   * now — the service exposed a five-number aggregate and no page consumed even
   * that. These mirror the Plausible breakdown/series contract exactly (same
   * range resolver, same envelope, same limits) so the two panels cannot drift
   * apart in what a period means.
   */
  router.get('/analytics/behavior/breakdown', async (req, res) => {
    const parsed = BehaviorBreakdownSchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', `${PERIOD_MESSAGE}; dimension one of the behaviour dimension keys; limit 1-200`);
      return;
    }
    if (!umamiConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Umami is not configured on this deployment');
      return;
    }
    const rows = await getUmamiBreakdown(range, parsed.data.dimension, parsed.data.limit);
    if (!rows) {
      fail(res, 502, UPSTREAM_FAILED, 'Umami did not answer');
      return;
    }
    ok(res, { period: parsed.data.period, dimension: parsed.data.dimension, rows });
  });

  router.get('/analytics/behavior/series', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', PERIOD_MESSAGE);
      return;
    }
    if (!umamiConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Umami is not configured on this deployment');
      return;
    }
    const series = await getUmamiSeries(range);
    if (!series) {
      fail(res, 502, UPSTREAM_FAILED, 'Umami did not answer');
      return;
    }
    const resolved = resolveRange(range);
    ok(res, {
      period: parsed.data.period,
      from: resolved.from,
      to: resolved.to,
      series,
    });
  });

  /*
   * Behaviour export. Umami's panel reached parity with Plausible's on
   * dimensions and series but had no download, so the one dataset an analyst
   * might want to pivot was the one they could not take with them.
   *
   * Every dimension in one file, discriminated by section — the same shape as
   * the analytics report export, so parsing one means parsing both.
   */
  router.get('/analytics/behavior/export', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    const range = parsed.success ? rangeFromQuery(parsed.data) : null;
    if (!parsed.success || !range) {
      fail(res, 400, 'VALIDATION_ERROR', PERIOD_MESSAGE);
      return;
    }
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    if (!umamiConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Umami is not configured on this deployment');
      return;
    }

    const dimensions = Object.keys(UMAMI_DIMENSIONS) as UmamiDimension[];
    const [stats, series, ...breakdowns] = await Promise.all([
      getUmamiStats(range),
      getUmamiSeries(range),
      ...dimensions.map((dimension) => getUmamiBreakdown(range, dimension, 200)),
    ]);
    // One failed dimension fails the export. A spreadsheet silently missing a
    // sheet is worse than a download that did not happen: nothing in the file
    // would say the browser breakdown is absent rather than empty.
    if (!stats || !series || breakdowns.some((rows) => rows === null)) {
      fail(res, 502, UPSTREAM_FAILED, 'Umami did not answer');
      return;
    }

    const resolved = resolveRange(range);
    const from = resolved.from;
    const to = resolved.to;
    const meta = {
      title: 'LittleFounders — behaviour',
      window: `${from} to ${to}`,
      generatedAt: new Date().toISOString(),
      notes: [
        'Source: Umami via Pulse. Adult surfaces only (marketing + signed-in parent product); never kid roles or /admin.',
        stats.outOfBoundaryPageviews === null
          ? 'Out-of-boundary pageviews: could not be read (NOT zero).'
          : `Includes ${stats.outOfBoundaryPageviews} /admin/* pageviews recorded before the 2026-08-14 tracker fix.`,
      ],
    };
    const sheets = [
      {
        name: 'summary',
        columns: ['metric', 'value'],
        rows: [
          ['pageviews', stats.pageviews],
          ['visitors', stats.visitors],
          ['visits', stats.visits],
          ['bounces', stats.bounces],
          ['totaltime_seconds', stats.totaltime],
          ['out_of_boundary_pageviews', stats.outOfBoundaryPageviews],
        ] as (string | number | null)[][],
      },
      {
        name: 'daily',
        columns: ['date', 'pageviews', 'sessions'],
        rows: series.map((point) => [point.date, point.pageviews, point.sessions]),
      },
      ...dimensions.map((dimension, index) => ({
        name: dimension,
        columns: [dimension, 'views'],
        // '' is Umami's "not recorded"; label it so a blank cell is not read
        // as a broken export.
        rows: (breakdowns[index] ?? []).map((row) => [row.label === '' ? '(not recorded)' : row.label, row.value]),
      })),
    ];

    const filename = `littlefounders-behaviour-${from}_to_${to}.${format}`;
    if (format === 'xlsx') {
      const xlsx = await renderTablesXlsx(meta, sheets);
      res
        .status(200)
        .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        .send(xlsx);
      return;
    }
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(renderTablesCsv(meta, sheets));
  });

  /** System health (Uptime Kuma): per-service status, latency, 24h uptime. */
  router.get('/health/services', async (_req, res) => {
    if (!kumaConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Uptime Kuma is not configured on this deployment');
      return;
    }
    const monitors = await getKumaHealth();
    if (!monitors) {
      fail(res, 502, UPSTREAM_FAILED, 'Uptime Kuma did not answer');
      return;
    }
    const down = monitors.filter((m) => m.status === 0).length;
    ok(res, { summary: { total: monitors.length, down }, monitors });
  });

  // ── Overview (todo de un vistazo) ──────────────────────────────────────────
  router.get('/overview', async (_req, res) => {
    const isSuperadmin = (res.locals.verifiedRoles as string[]).includes('superadmin');
    const user = authedUser(res);
    let grants: { permission: string }[] | null;
    try {
      grants = isSuperadmin ? ADMIN_PERMISSIONS.map((permission) => ({ permission }))
        : await getOwnAdminPermissions(user.accessToken, user.id);
    } catch {
      return fail(res, 502, 'INTERNAL', 'Staff permission verification unavailable');
    }
    if (!grants) return fail(res, 502, 'INTERNAL', 'Staff permission verification unavailable');
    const permissions = new Set(grants.map((row) => row.permission));
    if (permissions.size === 0) return fail(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource');
    const overview = await getAdminOverview({
      users: permissions.has('manage_users'),
      content: permissions.has('manage_content'),
      audit: permissions.has('manage_support'),
    });
    if (!overview) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load platform overview');
    ok(res, overview);
  });

  // ── Learning retention (always-on, from spaced-review attempts — 0016) ─────
  router.get('/learning/retention', async (_req, res) => {
    const retention = await getLearningRetention();
    if (!retention) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load retention data');
    ok(res, retention);
  });

  // ── Generation telemetry (0017 — coursegen's durable scoreboard) ───────────
  // The console is the ONLY reader of generation_runs/slots/tracks (service-
  // role tables, zero client policies): how each agentic run behaved — per-slot
  // outcomes, judge rubrics, failure stages, cost, cache-hit — the permanent
  // record for "what failed / what can we optimize" evaluations.
  router.get('/generation', async (_req, res) => {
    const overview = await getGenerationOverview();
    if (!overview) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load generation telemetry');
    ok(res, overview);
  });

  router.get('/generation/runs/:runId', async (req, res) => {
    const parsed = GenerationRunParamSchema.safeParse(req.params);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'runId must be a 1-200 char id (letters, digits, . _ -)');
      return;
    }
    const detail = await getGenerationRun(parsed.data.runId);
    if (!detail) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load that generation run (unknown id, or Vault unavailable)');
    ok(res, detail);
  });

  /**
   * Live heartbeat for currently-active generation runs (0018). The admin
   * dashboard hydrates and polls this every few seconds while a run is active
   * to render the live flow visualization. Supabase Realtime may accelerate
   * updates in the browser, but this Core response remains the reliable
   * baseline when a subscription is unavailable or starts after the INSERT.
   * It shows slot progress per stage, cost, and image counts as they happen,
   * not just after the fact (0017's post-mortem view).
   * Rows older than 2 minutes are stale (the run process died) and are
   * excluded by the query.
   */
  router.get('/generation/live', async (_req, res) => {
    const status = await getLiveGeneration();
    if (!status) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load live generation status');
    ok(res, status);
  });

  /**
   * Cross-run analytics: cost, quality, and failure trends aggregated across
   * all historic runs for a course (or platform-wide if no course is specified).
   * Optional query params: ?course=financial-education
   *
   * An invalid param is a 400, never a silently-ignored one: an admin query
   * string that validates loosely is how this file's audited param-handling
   * defect happened in the first place.
   */
  router.get('/generation/analytics', async (req, res) => {
    const q = CoachQuerySchema.safeParse(req.query);
    if (!q.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'course must be a valid slug (1-100 chars, lowercase letters, digits, hyphens)');
    }
    const analytics = await getGenerationAnalytics(q.data.course);
    if (!analytics) return fail(res, 502, DATA_UNAVAILABLE, 'No generation runs found for analysis');
    ok(res, analytics);
  });

  /**
   * Coach report: offline, deterministic diagnosis of the agentic pipeline's
   * behaviour across runs — failure patterns, judge quality trends, cost
   * efficiency, and proposed improvements each tied to evidence. Surface of
   * the forge:coach improvement loop (Level 2) in the admin dashboard.
   * Optional query: ?course=financial-education&track=trk-001
   */
  router.get('/generation/coach', async (req, res) => {
    const q = CoachQuerySchema.safeParse(req.query);
    if (!q.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'course must be a slug (1-100, a-z0-9-), track must be 1-200 safe chars');
    }
    const report = await getCoachReport(q.data.course, q.data.track);
    if (!report) return fail(res, 502, DATA_UNAVAILABLE, 'No generation data available for coach analysis');
    ok(res, report);
  });

  /**
   * Heartbeat snapshots: the time-series record of a run's progression —
   * every heartbeat update saved as a row (0020). Used by the admin dashboard
   * to render the run's progress curve over time.
   */
  router.get('/generation/snapshots/:runId', async (req, res) => {
    const parsed = GenerationRunParamSchema.safeParse(req.params);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'runId must be a 1-200 char id (letters, digits, . _ -)');
      return;
    }
    const snapshots = await getHeartbeatSnapshots(parsed.data.runId);
    if (!snapshots) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load heartbeat snapshots');
    ok(res, { runId: parsed.data.runId, snapshots });
  });

  /**
   * Full inspection of a single generated lesson slot: rubric, error, metrics,
   * and the run it belongs to. Used by the slot detail modal in Run History.
   */
  router.get('/generation/slots/:runId/:slotId', async (req, res) => {
    const runParsed = GenerationRunParamSchema.safeParse({ runId: req.params.runId });
    if (!runParsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'runId must be a 1-200 char id (letters, digits, . _ -)');
      return;
    }
    const detail = await getSlotDetail(runParsed.data.runId, req.params.slotId);
    if (!detail) return fail(res, 404, 'NOT_FOUND', 'Slot not found in generation telemetry');
    ok(res, detail);
  });

  /**
   * Side-by-side comparison of two generation runs. Returns per-run
   * stats + computed deltas for diff display.
   */
  router.get('/generation/compare', async (req, res) => {
    const runA = typeof req.query.runA === 'string' ? req.query.runA : '';
    const runB = typeof req.query.runB === 'string' ? req.query.runB : '';
    if (!runA || !runB) {
      fail(res, 400, 'VALIDATION_ERROR', 'Both runA and runB query params are required');
      return;
    }
    const comparison = await compareRuns(runA, runB);
    if (!comparison) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load comparison (both runs must exist in telemetry)');
    ok(res, comparison);
  });

  // ── Users / Support ────────────────────────────────────────────────────────
  router.get('/users', async (_req, res) => {
    const users = await listAdminUsers();
    if (!users) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load users');
    ok(res, { users });
  });

  /*
   * D.4 (Appendix H, "Unauthorized State-Transition Rate"): every accepted
   * chore/goal/redemption/guardian-link/freeze transition is recorded by the
   * database with the request role that caused it. outsideService counts the
   * ones that did not come through Core's service role; the target is zero.
   */
  const FamilyIntegrityQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict();

  router.get('/family/state-integrity', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await getFamilyStateIntegrity(since);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the integrity metric');
    const tables = rows.map((r) => ({ table: r.table_name, transitions: r.transitions, outsideService: r.outside_service }));
    return ok(res, {
      since: since.toISOString(),
      tables,
      transitions: tables.reduce((sum, t) => sum + t.transitions, 0),
      outsideService: tables.reduce((sum, t) => sum + t.outsideService, 0),
    });
  });

  /*
   * D.3 (Appendix H, "Teen Independent-Mode Adoption", Diagnostic, no
   * target): eligible self-registered teens today, how many used their
   * personal wallet, split by whether a parent is linked now, and how many
   * first used it inside the window. Counts only, never an identity.
   */
  router.get('/family/teen-wallet-adoption', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await getTeenWalletAdoption(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the adoption metric');
    return ok(res, {
      since: since.toISOString(),
      eligibleTeens: row.eligible_teens,
      adopters: row.adopters,
      independentAdopters: row.independent_adopters,
      linkedAdopters: row.linked_adopters,
      newAdopters: row.new_adopters,
      adoptionRate: row.eligible_teens > 0 ? row.adopters / row.eligible_teens : null,
    });
  });

  /*
   * S07.3 (Appendix H, all Diagnostic, no target; counts only, never an
   * identity):
   * - D.10 Chore-Tag Adoption Rate: chores created per kind, and the Tutors
   *   who tagged at least one chore as an expected contribution.
   * - D.2 Chore Streak rest-day utilization: missed days a rest day covered
   *   versus missed days that ended a run (the Appendix's "Chore
   *   Streak-Freeze Utilization Rate"; the product never says "freeze",
   *   owner log §5).
   * - D.11 Age-Tier Bonus Comprehension Proxy: 13-17 children shown the
   *   percentage worked example, and how many completed it.
   */
  router.get('/family/chore-tag-adoption', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readChoreTagAdoption(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the chore-tag metric');
    const total = row.contribution_tasks + row.bonus_tasks;
    return ok(res, {
      since: since.toISOString(),
      contributionTasks: row.contribution_tasks,
      bonusTasks: row.bonus_tasks,
      contributionShare: total > 0 ? row.contribution_tasks / total : null,
      tutors: row.tutors,
      tutorsUsingContribution: row.tutors_using_contribution,
    });
  });

  router.get('/family/chore-streak-rest-days', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const today = new Date().toISOString().slice(0, 10);
    const sinceDay = utcDayOffset(-q.data.days);
    const row = await choreStreakRestDayUtilization(sinceDay, today);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the rest-day metric');
    const lapses = row.restDayCovered + row.runsEnded;
    return ok(res, {
      since: sinceDay,
      children: row.children,
      restDayCovered: row.restDayCovered,
      runsEnded: row.runsEnded,
      coveredShare: lapses > 0 ? row.restDayCovered / lapses : null,
    });
  });

  router.get('/family/savings-bonus-comprehension', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readBonusComprehension(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the comprehension metric');
    return ok(res, {
      since: since.toISOString(),
      eligible: row.eligible,
      shown: row.shown,
      completed: row.completed,
      completionRate: row.shown > 0 ? row.completed / row.shown : null,
    });
  });

  /*
   * S07.4 (Appendix H, all Diagnostic, no target; counts and rates only,
   * never an identity). The behavioural ones read the consent-gated
   * family_money_events stream, so they cover only children whose analytics
   * consent (a Tutor's for a child in a family, the teen's own opt-in) was in
   * effect when the event happened:
   * - D.13 Allowance-Triggered Redemption Spike: reward requests per 100
   *   child-days by time since the last allowance and the last earned credit
   *   to Spend.
   * - D.13 Split-Ratio Engagement Quality: splits that kept the recommended
   *   default versus adjusted ones, per payout source.
   * - D.15 Save-Bucket Contribution Persistence and the Post-Goal Motivation
   *   Cliff (Save contributions per day before versus after a goal is reached,
   *   split by whether a next goal was set within 2 days).
   * - D.14 Share-Bucket Destination Completion Rate: read from the gifts
   *   themselves (bookkeeping, not behaviour), plus holders with Share coins
   *   and no destination at all.
   */
  /*
   * S07.6 (D.6) Appendix H: Staff Family-Engagement Insight Uptime (target
   * 100% once D.6 ships). Per source (the nightly probe and staff requests),
   * the checks in the window and how many returned real data. An empty window
   * is reported as no checks, never as 100%.
   */
  router.get('/family/engagement-uptime', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await readStaffInsightUptime(since);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the uptime metric');
    const bySource = (source: 'probe' | 'request') => {
      const r = rows.find((row) => row.source === source)!;
      return { checks: r.checks, ok: r.ok, uptime: r.checks > 0 ? r.ok / r.checks : null, lastOutcome: r.last_outcome, lastCheckedAt: r.last_checked_at };
    };
    return ok(res, { since: since.toISOString(), target: 1, probe: bySource('probe'), requests: bySource('request') });
  });

  /*
   * S07.6 (D.12) Appendix H (Threshold Recalibration Log): wallet holders per
   * age register, counts only. The first review of the 10- and 13-year
   * cutoffs reads this next to the D.11 comprehension proxy.
   */
  /*
   * S07.7 (D.19, D.21, D.22, D.23): the governance metrics, counts only.
   *   retention-compliance   Appendix H Retention-Policy Compliance Audit, pass
   *                          every release: rows past their period (target 0)
   *   coaching-delivery      Parent-Coaching-Tip Delivery & Engagement Rate
   *   coaching-reflections   the reflective prompt fired on every Tutor decision
   *   bridge-engagement      Real-World Bridge Engagement Rate (Diagnostic)
   *   research-completeness  Longitudinal-Hypothesis Data Completeness (Diagnostic)
   */
  router.get('/family/retention-compliance', async (_req, res) => {
    const audit = await readRetentionCompliance();
    if (audit === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the retention audit');
    return ok(res, audit);
  });

  const CoachingPeriod = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).strict();
  router.get('/family/coaching-delivery', async (req, res) => {
    const q = CoachingPeriod.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'period must be YYYY-MM');
    const metric = await readCoachingDelivery(q.data.period ?? new Date().toISOString().slice(0, 7));
    if (metric === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the coaching delivery metric');
    return ok(res, metric);
  });

  router.get('/family/coaching-reflections', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const metric = await readReflectionRate(new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000));
    if (metric === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the reflection metric');
    return ok(res, metric);
  });

  router.get('/family/bridge-engagement', async (_req, res) => {
    const metric = await readBridgeEngagement();
    if (metric === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the bridge engagement metric');
    return ok(res, metric);
  });

  const CompletenessQuery = z.object({
    months: z.coerce.number().int().min(1).max(24).default(RESEARCH_COMPLETENESS_MONTHS),
    tenure: z.coerce.number().int().min(0).max(120).default(RESEARCH_MIN_TENURE_MONTHS),
  }).strict();
  router.get('/family/research-completeness', async (req, res) => {
    const q = CompletenessQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'months must be 1 to 24 and tenure 0 to 120');
    const metric = await readResearchCompleteness(q.data.months, q.data.tenure);
    if (metric === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the completeness metric');
    return ok(res, metric);
  });

  router.get('/family/register-distribution', async (_req, res) => {
    const rows = await readRegisterDistribution();
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the register distribution');
    const total = rows.reduce((sum, r) => sum + r.holders, 0);
    return ok(res, { total, registers: rows.map((r) => ({ register: r.register, holders: r.holders, share: total > 0 ? r.holders / total : null })) });
  });

  router.get('/family/redemption-timing', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await readRedemptionTiming(since);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the redemption-timing metric');
    const byClass = (cls: 'allowance' | 'earned') => rows.filter((r) => r.credit_class === cls).map((r) => ({
      bin: r.bin, requests: r.requests, exposureHours: r.exposure_hours, ratePer100ChildDays: r.rate_per_100_child_days,
    }));
    return ok(res, { since: since.toISOString(), allowance: byClass('allowance'), earned: byClass('earned') });
  });

  router.get('/family/split-engagement', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await readSplitEngagement(since);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the split metric');
    const sources = rows.map((r) => ({
      source: r.source, allocations: r.allocations, keptDefault: r.kept_default, adjusted: r.adjusted,
      adjustedShare: r.allocations > 0 ? r.adjusted / r.allocations : null,
    }));
    const allocations = sources.reduce((sum, r) => sum + r.allocations, 0);
    const adjusted = sources.reduce((sum, r) => sum + r.adjusted, 0);
    return ok(res, { since: since.toISOString(), sources, allocations, adjusted, adjustedShare: allocations > 0 ? adjusted / allocations : null });
  });

  router.get('/family/save-persistence', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readSavePersistence(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the persistence metric');
    return ok(res, {
      since: since.toISOString(),
      children: row.children,
      saveContributors: row.save_contributors,
      saveCoins: row.save_coins,
      ownCoins: row.own_coins,
      saveShare: row.own_coins > 0 ? row.save_coins / row.own_coins : null,
    });
  });

  router.get('/family/post-goal-motivation', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await readPostGoalMotivation(since);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the post-goal metric');
    const group = (soon: boolean) => {
      const r = rows.find((x) => x.next_goal_within_2_days === soon)!;
      return { goals: r.goals, meanBeforePerDay: r.mean_before_per_day, meanAfterPerDay: r.mean_after_per_day, goalsWithDrop: r.goals_with_drop };
    };
    return ok(res, { since: since.toISOString(), nextGoalWithin2Days: group(true), noNextGoalWithin2Days: group(false) });
  });

  router.get('/family/share-completion', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readShareCompletion(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Share metric');
    return ok(res, {
      since: since.toISOString(),
      windowDays: SHARE_COMPLETION_WINDOW_DAYS,
      pledged: row.pledged,
      givenInWindow: row.given_in_window,
      givenLater: row.given_later,
      returned: row.returned,
      waiting: row.waiting,
      completionRate: row.pledged > 0 ? row.given_in_window / row.pledged : null,
      holdersWithShare: row.holders_with_share,
      holdersWithoutDestination: row.holders_without_destination,
    });
  });

  // ── S07.5 (D.17, D.18): Appendix H metrics ───────────────────────────────
  /*
   * Independence-Tier Progression Rate (Diagnostic): of the children who
   * first met the rule for a level, how many reached it within the window;
   * plus the rollback path in use (levels lowered, by who).
   */
  router.get('/family/autonomy-progression', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const data = await readAutonomyProgression(since);
    if (data === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the progression metric');
    return ok(res, {
      since: since.toISOString(),
      windowDays: AUTONOMY_PROGRESSION_WINDOW_DAYS,
      levels: data.levels.map((l) => ({ level: l.level, judged: l.judged, progressed: l.progressed, waiting: l.waiting, progressionRate: l.judged > 0 ? l.progressed / l.judged : null })),
      stepDowns: Object.fromEntries(data.stepDowns.map((d) => [d.actor_kind, d.step_downs])),
    });
  });

  /** Repeated-Denial Communication-Nudge Trigger Rate (Diagnostic): patterns recomputed from the decisions against nudges opened. */
  router.get('/family/talk-nudges', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readTalkNudgeRate(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the nudge metric');
    return ok(res, {
      since: since.toISOString(),
      patterns: row.patterns, nudged: row.nudged, triggerRate: row.patterns > 0 ? row.nudged / row.patterns : null,
      childAsks: row.child_asks, talked: row.talked, dismissed: row.dismissed, stillOpen: row.still_open,
    });
  });

  /** Denial-Reason Actionability Rate: human scores over a consent-gated sample, plus the structural compliance of every "not yet". */
  router.get('/family/denial-actionability', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const row = await readDenialActionability(since);
    if (row === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the actionability metric');
    return ok(res, {
      since: since.toISOString(),
      denials: row.denials, structured: row.structured, structuredRate: row.denials > 0 ? row.structured / row.denials : null,
      admitted: row.admitted, scored: row.scored, actionable: row.actionable, actionabilityRate: row.scored > 0 ? row.actionable / row.scored : null,
    });
  });

  const DenialSampleQuery = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).strict();

  /*
   * The sample staff score. The reason text and its code only: no child,
   * family or decision identity beyond an opaque id, and only children the
   * H.1 analytics gate admits (the database filters).
   */
  router.get('/family/denial-reasons/sample', async (req, res) => {
    const q = DenialSampleQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365 and limit 1-50');
    const since = new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000);
    const rows = await readDenialReasonSample(since, q.data.limit);
    if (rows === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the sample');
    return ok(res, {
      since: since.toISOString(),
      reasons: rows.map((r) => ({ id: r.decision_id, subject: r.subject, outcome: r.outcome, reasonCode: r.reason_code, reason: r.reason, passesStructuralCheck: reasonActionable(r.reason) })),
    });
  });

  const ScoreBody = z.object({ actionable: z.boolean() }).strict();

  router.post('/family/denial-reasons/:id/score', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const body = ScoreBody.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'actionable must be a boolean');
    const result = await scoreDenialReason(id.data, authedUser(res).id, body.data.actionable);
    if (result === AUTONOMY_UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the score');
    if (isAutonomyRefusal(result)) {
      return result.refused === 'DENIAL_SCORE_FORBIDDEN'
        ? fail(res, 403, 'FORBIDDEN', 'You do not have permission to score reasons')
        : fail(res, 404, 'NOT_FOUND', 'No such reason in the sample');
    }
    return ok(res, { scored: result });
  });

  // ── S07.5 (D.17): the product-team rollback of an independence level ────
  router.get('/family-autonomy/:kidId', async (req, res) => {
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const [status, changes] = await Promise.all([readAutonomyStatus(kidId.data), listAutonomyChanges(kidId.data, 20)]);
    if (!status || changes === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the level');
    if (!status.in_family) return fail(res, 404, 'NOT_FOUND', 'No child in a family with this id');
    return ok(res, { autonomy: toWireAutonomy(status), changes: changes.map((c) => toWireChange(c, authedUser(res).id)) });
  });

  const LowerLevel = z.object({ level: z.number().int().min(1).max(2), reason: z.string().max(240) }).strict();

  router.post('/family-autonomy/:kidId/lower', async (req, res) => {
    const actor = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const body = LowerLevel.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'A lower level and a reason are required');
    if (!reasonActionable(body.data.reason)) return fail(res, 400, 'AUTONOMY_REASON_REQUIRED', 'Say what the family can do next, in a few words');
    // The reason exists in the audit trail even if the write fails.
    await insertAuditLog(actor.id, 'family_autonomy.staff_lower', kidId.data, { level: body.data.level });
    const result = await staffLowerAutonomy(kidId.data, actor.id, body.data.level, body.data.reason.trim());
    if (result === AUTONOMY_UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not lower the level');
    if (isAutonomyRefusal(result)) {
      const status = result.refused === 'AUTONOMY_STAFF_FORBIDDEN' ? 403 : result.refused === 'AUTONOMY_NOT_IN_FAMILY' ? 404 : result.refused === 'AUTONOMY_REASON_REQUIRED' ? 400 : 409;
      return fail(res, status, result.refused, 'The change was refused');
    }
    return ok(res, { level: result });
  });

  router.get('/users/timeline', async (req, res) => {
    const q = TimelineQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 7 and 365');
    const timeline = await getSignupTimeline(q.data.days);
    ok(res, { timeline });
  });

  // A.5: the real revocation trigger path — a staff action following a
  // fraud report. The database writes the revoked row (latest-row-wins
  // resolver) and the audit row carrying the deciding actor and reason in ONE
  // transaction (revoke_parent_verification); a write Core cannot confirm
  // answers 502, never 'revoked'.
  const VerificationRevokeSchema = z.object({
    reason: z.string().trim().min(10).max(300),
  }).strict();

  router.post('/users/:userId/verification/revoke', async (req, res) => {
    const userId = z.string().uuid().safeParse(req.params.userId);
    const parsed = VerificationRevokeSchema.safeParse(req.body);
    if (!userId.success || !parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'userId must be a uuid and a reason (10-300 characters) is required');
    }
    const outcome = await revokeParentVerification(userId.data, authedUser(res).id, parsed.data.reason);
    if (outcome === 'not_found') return fail(res, 404, 'NOT_FOUND', 'No such account');
    if (outcome === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'A reason of 10-300 characters is required');
    if (outcome === 'rejected') return fail(res, 409, 'ROLE_REJECTED', 'The database refused this revocation');
    if (outcome !== 'revoked') return fail(res, 502, DATA_UNAVAILABLE, 'Could not revoke the verification');
    ok(res, { userId: userId.data, verification: 'revoked' });
  });

  // ── Content (course publish gate) ──────────────────────────────────────────
  // Vault's release_course refusal codes → §1.6 envelope errors, one distinct
  // SCREAMING_SNAKE code per cause so the console (errors.api.<CODE>) can tell
  // an archived course from a missing locale. Unknown future RPC codes degrade
  // to the generic RELEASE_BLOCKED rather than crashing the route.
  const RELEASE_REFUSALS: Record<string, { status: number; code: string }> = {
    NOT_FOUND: { status: 404, code: 'RELEASE_NOT_FOUND' },
    ARCHIVED: { status: 409, code: 'RELEASE_ARCHIVED' },
    INCOMPLETE_HIERARCHY: { status: 409, code: 'RELEASE_INCOMPLETE_HIERARCHY' },
    LESSONS_NOT_REVIEWABLE: { status: 409, code: 'RELEASE_LESSONS_NOT_REVIEWABLE' },
    INCOMPLETE_LOCALES: { status: 409, code: 'RELEASE_INCOMPLETE_LOCALES' },
    VERIFICATION_REQUIRED: { status: 409, code: 'RELEASE_VERIFICATION_REQUIRED' },
    // S05.4c: the attestation is fresh but does not pass every Forge release
    // gate Vault requires (forge_release_gates).
    VERIFICATION_INCOMPLETE: { status: 409, code: 'RELEASE_VERIFICATION_INCOMPLETE' },
    // S05.4c: release_lesson only publishes into an already-live course.
    COURSE_RELEASE_REQUIRED: { status: 409, code: 'RELEASE_COURSE_RELEASE_REQUIRED' },
    // G.3 (GAP-FIX-R5): Vault re-checks the staff actor of every status
    // decision (superadmin, or admin with manage_content).
    FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
    // GAP-FIX-R6 (Appendix C Part 3 Stage 3): Vault's release gate refuses content
    // no passing Stage 3 pedagogical review covers; the release rolled back whole.
    STAGE3_REVIEW_REQUIRED: { status: 409, code: 'RELEASE_STAGE3_REVIEW_REQUIRED' },
  };

  router.get('/content', async (_req, res) => {
    const [courses, summary, incidents] = await Promise.all([listAdminCourses(), getAdminContentSummary(), listCourseAssemblyIncidents()]);
    if (!courses || !summary || !incidents) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load content');
    const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
    ok(res, {
      courses,
      summary,
      courseAssemblyIncidents: incidents.map((incident) => ({
        ...incident,
        courseTitle: courseTitleById.get(incident.courseId) ?? incident.courseId,
      })),
    });
  });

  router.post('/content/:courseId/status', async (req, res) => {
    const courseId = z.string().uuid().safeParse(req.params.courseId);
    const status = z.string().safeParse((req.body as { status?: unknown })?.status);
    if (!courseId.success || !status.success || !isCourseStatus(status.data)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'courseId must be a uuid and status one of draft|published|archived');
    }
    const result = await setCourseStatus(courseId.data, status.data, authedUser(res).id);
    if (result.outcome === 'blocked') {
      const refusal = RELEASE_REFUSALS[result.code] ?? { status: 409, code: 'RELEASE_BLOCKED' };
      return fail(res, refusal.status, refusal.code, result.message);
    }
    if (result.outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the course');
    ok(res, { id: courseId.data, status: status.data });
  });

  // ── G.2: a new v2 version of a live lesson waits for a staff release ──────
  /*
   * Forge's reviewed publication records a pending activation for a lesson
   * that is already published (`*_v2_staff_release_approval.sql`); nothing a
   * child sees changes until a person with manage_content releases it here.
   * Vault re-checks the actor and the course's Forge verification in the same
   * transaction that moves the pointer and writes the audit row (actor = this
   * staff member). A rejection needs a reason and is audited too.
   */
  router.get('/content/lesson-versions', async (_req, res) => {
    const versions = await listPendingLessonVersions();
    if (!versions) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the pending lesson versions');
    ok(res, { versions, total: versions.length });
  });

  const VersionParams = z.object({ lessonId: z.string().uuid(), versionId: z.string().uuid() });
  const versionOutcome = (res: Response, result: VersionDecision, params: z.infer<typeof VersionParams>, status: string) => {
    if (result.outcome === 'done') return ok(res, { lessonId: params.lessonId, versionId: params.versionId, status });
    if (result.outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not decide on the lesson version');
    if (result.code === 'FORBIDDEN') return fail(res, 403, 'FORBIDDEN', result.message);
    if (result.code === 'NOT_FOUND') return fail(res, 404, 'NOT_FOUND', result.message);
    if (result.code === 'NOT_PENDING') return fail(res, 409, 'VERSION_NOT_PENDING', result.message);
    if (result.code === 'INVALID_REASON') return fail(res, 400, 'VALIDATION_ERROR', result.message);
    const refusal = RELEASE_REFUSALS[result.code] ?? { status: 409, code: 'RELEASE_BLOCKED' };
    return fail(res, refusal.status, refusal.code, result.message);
  };

  router.post('/content/lessons/:lessonId/versions/:versionId/release', async (req, res) => {
    const params = VersionParams.safeParse(req.params);
    const body = z.object({}).strict().safeParse(req.body ?? {});
    if (!params.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'lessonId and versionId must be uuids and the body empty');
    return versionOutcome(res, await releaseLessonVersion(authedUser(res).id, params.data.lessonId, params.data.versionId), params.data, 'released');
  });

  const RejectVersionBody = z.object({ reason: z.string().trim().min(10).max(600) }).strict();
  router.post('/content/lessons/:lessonId/versions/:versionId/reject', async (req, res) => {
    const params = VersionParams.safeParse(req.params);
    const body = RejectVersionBody.safeParse(req.body);
    if (!params.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'lessonId and versionId must be uuids and the reason 10-600 characters');
    return versionOutcome(res, await rejectLessonVersion(authedUser(res).id, params.data.lessonId, params.data.versionId, body.data.reason), params.data, 'rejected');
  });

  // ── Appendix C Part 3 Stage 3: the pedagogical review of a lesson or a version ──
  /*
   * GAP-FIX-R6. The Pedagogical Reviewer (manage_content, never the Content
   * Author of the same content) answers the six Block B checks and the four
   * Stage 3 questions, each with a named finding, and resolves every Stage 3
   * flag Forge raised. GET serves what the form needs for the lesson's current
   * content, or for one v2 version (?versionId=, the G.2 queue); POST records
   * the review. Vault re-checks everything and derives pass or fail; a release
   * of content no passing review covers is refused (RELEASE_STAGE3_REVIEW_REQUIRED).
   */
  const Stage3Query = z.object({ versionId: z.string().uuid().optional() }).strict();
  router.get('/content/lessons/:lessonId/pedagogical-review', async (req, res) => {
    const lessonId = z.string().uuid().safeParse(req.params.lessonId);
    const query = Stage3Query.safeParse(req.query);
    if (!lessonId.success || !query.success) return fail(res, 400, 'VALIDATION_ERROR', 'lessonId and versionId must be uuids');
    const state = await getStage3State(lessonId.data, query.data.versionId ?? null, authedUser(res).id);
    if (state === 'not_found') return fail(res, 404, 'NOT_FOUND', 'No such lesson or version');
    if (!state) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Stage 3 review');
    ok(res, state);
  });

  router.post('/content/lessons/:lessonId/pedagogical-review', async (req, res) => {
    const actor = authedUser(res);
    const lessonId = z.string().uuid().safeParse(req.params.lessonId);
    const body = Stage3ReviewBody.safeParse(req.body);
    if (!lessonId.success || !body.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Every check needs a result and a finding of 10-600 characters, and every Forge item a resolution and a note');
    }
    if (body.data.authorId === actor.id) return fail(res, 409, 'STAGE3_SELF_REVIEW', 'The Pedagogical Reviewer is never the Content Author of the same content');
    const outcome = await recordStage3Review(actor.id, lessonId.data, body.data);
    if (outcome.outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the Stage 3 review');
    if (outcome.outcome === 'refused') {
      const refusal = STAGE3_RECORD_REFUSALS[outcome.code] ?? { status: 409, code: 'STAGE3_REVIEW_REFUSED' };
      return fail(res, refusal.status, refusal.code, outcome.message);
    }
    ok(res, { reviewId: outcome.reviewId, result: outcome.result });
  });

  /*
   * G.2 / Appendix N 1.2: every bypass of the release check with its 30-day
   * retroactive check, and the Release-Verification Bypass Rate (target 0)
   * and Justification & Retroactive-Check Completeness (target 100%).
   */
  const BypassQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(BYPASS_WINDOW_DAYS) });
  router.get('/content/bypass-checks', async (req, res) => {
    const query = BypassQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be 7-365');
    const report = await getContentBypassReport(query.data.days);
    if (!report) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the release checks');
    ok(res, report);
  });

  // ── Learning quality (S05.3d: B.19 difficulty band, B.12 judgment, B.5 replay notice) ──
  // Behind '/content' → manage_content. The SQL functions re-check the actor on every write.
  const LearningQualityQuery = z.object({ days: z.coerce.number().int().min(7).max(180).default(REVIEW_WINDOW_DAYS) });
  const band = z.number().int().min(0).max(100);
  const BandBody = z.object({
    lessonId: z.string().uuid().nullable(),
    lowerPct: band, upperPct: band,
    minSample: z.number().int().min(10).max(100_000).optional(),
    rationale: z.string().trim().min(10).max(600),
  }).strict();
  const ResolveBody = z.object({
    decision: z.enum(['make_harder', 'make_easier', 'adjust_band', 'no_change']),
    note: z.string().trim().min(10).max(600),
    lowerPct: band.optional(), upperPct: band.optional(),
    minSample: z.number().int().min(10).max(100_000).optional(),
  }).strict().refine((body) => body.decision === 'adjust_band'
    ? body.lowerPct !== undefined && body.upperPct !== undefined
    : body.lowerPct === undefined && body.upperPct === undefined && body.minSample === undefined, 'A band is required only to adjust the band');

  router.get('/content/learning-quality', async (req, res) => {
    const query = LearningQualityQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be 7-180');
    const report = await loadLearningQualityReport(query.data.days);
    if (!report) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load learning quality');
    ok(res, report);
  });

  // No scheduler exists in this stack: the panel catches reviews up when it opens.
  router.post('/content/learning-quality/reviews/sync', async (_req, res) => {
    const opened = await syncPracticeReviews();
    if (opened === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check practice reviews');
    ok(res, { opened });
  });

  router.post('/content/learning-quality/reviews/:reviewId/resolve', async (req, res) => {
    const reviewId = z.string().uuid().safeParse(req.params.reviewId);
    const body = ResolveBody.safeParse(req.body);
    if (!reviewId.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid review decision');
    if (body.data.decision === 'adjust_band' && !bandWithinGuardRails(body.data.lowerPct!, body.data.upperPct!)) {
      return fail(res, 400, 'BAND_OUT_OF_RANGE', 'A band must stay within 50-95% and be at least 5 points wide');
    }
    const outcome = await resolvePracticeReview({ reviewId: reviewId.data, actorId: authedUser(res).id, ...body.data });
    if (outcome === 'not_found') return fail(res, 404, 'NOT_FOUND', 'No such review');
    if (outcome === 'already_resolved') return fail(res, 409, 'REVIEW_RESOLVED', 'This review is already resolved');
    if (outcome === 'wrong_direction') return fail(res, 409, 'WRONG_DIRECTION', 'That decision moves the lesson away from its band');
    if (outcome === 'rejected') return fail(res, 403, 'FORBIDDEN', 'The database refused this decision');
    if (outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    ok(res, { id: reviewId.data, status: 'resolved' });
  });

  // Appendix C 1.3 (GAP-FIX-R2): a defect found in released content, and the Forge gate that should have caught it.
  const DefectEscapeBody = z.object({
    lessonId: z.string().uuid(),
    gateId: z.string().regex(/^forge\.[a-z0-9][a-z0-9.-]{2,80}$/),
    kind: z.enum(DEFECT_KINDS),
  }).strict();
  router.post('/content/learning-quality/defect-escapes', async (req, res) => {
    const body = DefectEscapeBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid defect escape');
    const id = await recordContentDefectEscape({ ...body.data, actorId: authedUser(res).id });
    if (!id) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the defect escape');
    ok(res, { id, status: 'recorded' });
  });

  router.post('/content/learning-quality/bands', async (req, res) => {
    const body = BandBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid band');
    if (!bandWithinGuardRails(body.data.lowerPct, body.data.upperPct)) {
      return fail(res, 400, 'BAND_OUT_OF_RANGE', 'A band must stay within 50-95% and be at least 5 points wide');
    }
    const outcome = await setPracticeBand({ ...body.data, actorId: authedUser(res).id });
    if (outcome === 'rejected') return fail(res, 403, 'FORBIDDEN', 'The database refused this band');
    if (outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the band');
    ok(res, { lessonId: body.data.lessonId, status: 'set' });
  });

  // ── Moderation (lesson review gate, §1.9) ──────────────────────────────────
  router.get('/moderation', async (_req, res) => {
    const lessons = await listReviewLessons();
    if (!lessons) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the review queue');
    ok(res, { lessons, total: lessons.length });
  });

  router.get('/moderation/:lessonId', async (req, res) => {
    const lessonId = z.string().uuid().safeParse(req.params.lessonId);
    if (!lessonId.success) return fail(res, 400, 'VALIDATION_ERROR', 'lessonId must be a uuid');
    const lesson = await getReviewLessonDetail(lessonId.data);
    if (!lesson) return fail(res, 404, 'NOT_FOUND', 'Lesson not found');
    ok(res, lesson);
  });

  router.post('/moderation/:lessonId/status', async (req, res) => {
    const lessonId = z.string().uuid().safeParse(req.params.lessonId);
    const status = z.string().safeParse((req.body as { status?: unknown })?.status);
    if (!lessonId.success || !status.success || !isLessonStatus(status.data)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'lessonId must be a uuid and status one of draft|review|published|archived');
    }
    // Publishing a lesson is a release through Vault's release_lesson
    // preflight (Product G.2): the same Forge verification as a course release.
    const result = await setLessonStatus(lessonId.data, status.data, authedUser(res).id);
    if (result.outcome === 'blocked') {
      const refusal = RELEASE_REFUSALS[result.code] ?? { status: 409, code: 'RELEASE_BLOCKED' };
      return fail(res, refusal.status, refusal.code, result.message);
    }
    if (result.outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the lesson');
    ok(res, { id: lessonId.data, status: status.data });
  });

  // ── Tutor live-content review queue (/ORACLE.md §7.3) ─────────────────────
  /*
   * The post-hoc human review of LIVE-generated tutor activities. Segments
   * are sampled into `review_status='pending'` at persist time (this file's
   * sibling `tutorLadder`/`persistAndServe` path); this is the READER that
   * §15.2 admitted did not exist — the sampling protects nobody until a
   * human sees what it sampled. The payload includes the answer key: the
   * reviewer is staff, and judging an exercise without its answer is judging
   * half of it.
   */
  router.get('/tutor/review-queue', async (_req, res) => {
    const segments = await listTutorReviewQueue();
    if (!segments) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the tutor review queue');
    ok(res, { segments, total: segments.length });
  });

  /*
   * C.5: a staff verdict is also the INPUT of the dynamic sampling rate and
   * of the judge's concordance. A rejection is a real quality or safety
   * issue: it raises that content-risk category's sampling rate at once, and
   * too many of them suspend live generation for the category (Stage 7).
   * `issue` classifies a rejection (quality | safety); an older console that
   * sends none still records a rejection, counted as an issue of unstated
   * class. The segment status and the governance log move in ONE transaction
   * (`record_tutor_live_review`), and only on a row still pending.
   */
  const ReviewDecisionBody = z
    .object({
      status: z.enum(['approved', 'rejected']),
      issue: z.enum(['quality', 'safety']).optional(),
    })
    .strict()
    .refine((b) => b.issue === undefined || b.status === 'rejected', 'issue accompanies a rejection only');

  router.post('/tutor/review-queue/:segmentId/status', async (req, res) => {
    const segmentId = z.string().uuid().safeParse(req.params.segmentId);
    const body = ReviewDecisionBody.safeParse(req.body);
    if (!segmentId.success || !body.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'segmentId must be a uuid, status approved|rejected, issue quality|safety on a rejection only');
    }
    const actor = authedUser(res);
    const outcome = await recordLiveReview({
      segmentId: segmentId.data,
      verdict: body.data.status,
      issue: body.data.issue ?? null,
      reviewerId: actor.id,
    });
    if (outcome === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the review');
    if (outcome === 'not_pending') return fail(res, 409, 'ALREADY_DECIDED', 'This activity was already reviewed');
    // G.3: the central audit row 'admin.tutor_activity.review' is written by
    // record_tutor_live_review itself, in the transaction that records the
    // verdict (migration audited_staff_decisions): the decision and its
    // staff-wide trail commit together or not at all.
    ok(res, { id: segmentId.data, status: body.data.status, issue: body.data.issue ?? null });
  });

  /*
   * C.5: what staff need to see to act — per content-risk category, the
   * current sampling rate (baseline or elevated, and how many clean
   * decisions restore the baseline), whether live generation is suspended
   * and why, the pending review backlog past the SLA, and the judge's
   * calibration. Read-only.
   */
  router.get('/tutor/live-content/status', async (_req, res) => {
    const now = new Date();
    resetLiveContentGateCache();
    const gate = await getLiveContentGate(now);
    const backlog = await liveReviewBacklog(now);
    if (gate.degraded || backlog === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the live-content status');
    ok(res, {
      calibration: {
        state: gate.calibration.state,
        ageDays: gate.calibration.ageDays,
        judgeModel: gate.calibration.row?.judge_model ?? null,
        recordedAt: gate.calibration.row?.created_at ?? null,
        maxAgeDays: JUDGE_REGISTRY.live_content_judge.standard.maxAgeDays,
      },
      categories: RISK_CATEGORIES.map((category) => {
        const entry = gate.categories[category];
        return {
          category,
          suspended: entry.suspended,
          reasons: entry.reasons,
          rate: entry.sampling.rate,
          baseline: entry.sampling.baseline,
          floor: LIVE_CONTENT_FLOORS[category],
          elevated: entry.sampling.elevated,
          decisionsToRestore: entry.sampling.decisionsToRestore,
          pending: backlog[category].pending,
          overdue: backlog[category].overdue,
        };
      }),
      reviewSlaDays: LIVE_CONTENT_THRESHOLDS.reviewSlaDays,
    });
  });

  // ── C.6: the curated activity-pack release gate ────────────────────────────
  router.get('/tutor/packs', async (req, res) => {
    const status = z.enum(PACK_STATUSES).optional().safeParse(req.query.status);
    if (!status.success) return fail(res, 400, 'VALIDATION_ERROR', 'status must be review|published|archived');
    const packs = await listTutorPacks(status.data ?? null);
    if (!packs) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the activity packs');
    ok(res, { packs, total: packs.length });
  });

  router.post('/tutor/packs/:packId/status', async (req, res) => {
    const packId = z.string().uuid().safeParse(req.params.packId);
    const body = z.object({ status: z.enum(PACK_STATUSES) }).strict().safeParse(req.body);
    if (!packId.success || !body.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'packId must be a uuid and status review|published|archived');
    }
    const result = await setTutorPackStatus({ packId: packId.data, status: body.data.status, actorId: authedUser(res).id });
    if (result.ok) {
      // The staff answer is the release record; the pack body stays in the list read.
      const summary: Partial<typeof result.row> = { ...result.row };
      delete summary.pack;
      return ok(res, summary);
    }
    if (result.code === 'not_found') return fail(res, 404, 'NOT_FOUND', 'No such pack');
    if (result.code === 'unchanged') return fail(res, 409, 'ALREADY_DECIDED', 'The pack is already in that state, or changed meanwhile');
    if (result.code === 'invalid') {
      return fail(res, 422, 'PACK_CONTRACT_FAILED', 'The pack does not meet the tutor-pack.v1 contract', {
        failures: result.failures ?? [],
      });
    }
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the pack');
  });

  // ── C.24: the consolidated Mentor-quality and engagement-health dashboard ──
  /*
   * One read for the product/pedagogy team: every consolidated signal from
   * the evaluation loop's latest snapshot (with the ones not instrumented yet
   * listed as such), the active flags with their owner roles, the named
   * owners, and the weekly review record. A failed read is a 502, never an
   * empty, calm dashboard (§1.14).
   */
  router.get('/mentor-quality', async (_req, res) => {
    const dashboard = await getMentorQualityDashboard(new Date(), authedUser(res).id);
    if (!dashboard) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Mentor-quality dashboard');
    ok(res, dashboard);
  });

  const flagOutcome = (res: Response, result: Awaited<ReturnType<typeof acknowledgeFlag>>, id: string, status: string) => {
    if (result === 'done') return ok(res, { id, status });
    if (result === 'not_found') return fail(res, 404, 'NOT_FOUND', 'No such flag');
    if (result === 'not_owner') return fail(res, 403, 'NOT_NAMED_OWNER', 'Only a named owner of this flag\'s role can act on it');
    if (result === 'conflict') return fail(res, 409, 'ALREADY_DECIDED', 'This flag changed meanwhile');
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the flag');
  };

  router.post('/mentor-quality/flags/:flagId/acknowledge', async (req, res) => {
    const flagId = z.string().uuid().safeParse(req.params.flagId);
    const body = z.object({}).strict().safeParse(req.body ?? {});
    if (!flagId.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'flagId must be a uuid and the body empty');
    return flagOutcome(res, await acknowledgeFlag(flagId.data, authedUser(res).id), flagId.data, 'acknowledged');
  });

  const FlagResolveBody = z.object({ note: z.string().trim().min(RESOLUTION_NOTE_MIN).max(RESOLUTION_NOTE_MAX) }).strict();
  router.post('/mentor-quality/flags/:flagId/resolve', async (req, res) => {
    const flagId = z.string().uuid().safeParse(req.params.flagId);
    const body = FlagResolveBody.safeParse(req.body);
    if (!flagId.success || !body.success) {
      return fail(res, 400, 'VALIDATION_ERROR', `flagId must be a uuid and note the root cause in ${RESOLUTION_NOTE_MIN}-${RESOLUTION_NOTE_MAX} characters`);
    }
    return flagOutcome(res, await resolveFlag(flagId.data, authedUser(res).id, body.data.note), flagId.data, 'resolved');
  });

  const ReviewBody = z.object({ role: z.enum(OWNER_ROLES), note: z.string().trim().max(RESOLUTION_NOTE_MAX).optional() }).strict();
  router.post('/mentor-quality/reviews', async (req, res) => {
    const body = ReviewBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', `role must be one of ${OWNER_ROLES.join(', ')}`);
    const result = await recordOwnerReview(authedUser(res).id, body.data.role, body.data.note || null);
    if (result.ok) return ok(res, { role: body.data.role, week: result.week });
    if (result.code === 'not_owner') return fail(res, 403, 'NOT_NAMED_OWNER', 'Only a named owner of this role can sign its review');
    if (result.code === 'already') return fail(res, 409, 'ALREADY_REVIEWED', 'This week\'s review is already signed');
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the review');
  });

  /*
   * GAP-FIX-R2 (Appendix C 1.2): a named owner records a per-release manual
   * audit (B.25 dark patterns and B.22 variable-ratio rewards: the Safety and
   * Trust lead; B.20 reward framing: the pedagogical lead). A fail carries its
   * findings; a pass has none. Vault enforces the owner and writes the audit row.
   */
  const ReleaseAuditBody = z.object({
    kind: z.enum(RELEASE_AUDIT_KINDS),
    releaseId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/),
    result: z.enum(['pass', 'fail']),
    findingCount: z.number().int().min(0).max(10_000),
    note: z.string().trim().min(1).max(600).optional(),
  }).strict().refine((b) => (b.result === 'fail') === (b.findingCount > 0), 'a fail has at least one finding and a pass none');
  router.post('/mentor-quality/audits', async (req, res) => {
    const body = ReleaseAuditBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'kind, releaseId (1-64 of A-Z a-z 0-9 . _ : -), result pass|fail and findingCount (a fail has findings, a pass none) are required');
    const result = await recordReleaseAudit({ actorId: authedUser(res).id, ...body.data, note: body.data.note ?? null });
    if (result === 'recorded') return ok(res, { kind: body.data.kind, releaseId: body.data.releaseId, result: body.data.result }, 201);
    if (result === 'not_owner') return fail(res, 403, 'NOT_NAMED_OWNER', 'Only a named owner of this audit\'s role can record it');
    if (result === 'duplicate') return fail(res, 409, 'ALREADY_RECORDED', 'This release already has this audit');
    if (result === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'The database refused the audit values');
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the audit');
  });

  const OwnerBody = z.object({ role: z.enum(OWNER_ROLES), userId: z.string().uuid(), action: z.enum(['add', 'remove']) }).strict();
  router.post('/mentor-quality/owners', async (req, res) => {
    const body = OwnerBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'role, userId (uuid) and action add|remove are required');
    const result = await setOwner({ ...body.data, actorId: authedUser(res).id });
    if (result === 'done') return ok(res, body.data);
    if (result === 'not_staff') return fail(res, 422, 'NOT_ELIGIBLE_OWNER', 'A named owner must be staff who can read analytics');
    if (result === 'unchanged') return fail(res, 409, 'UNCHANGED', 'Nothing to change');
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the owners');
  });

  // ── Tutor retention sweep health (/ORACLE.md §15.2 item 4, closed 2026-08-31) ─
  /*
   * The nightly 90-day sweep reports what IT deleted to its own caller (a
   * GitHub Actions runner), but nobody was watching whether the workflow
   * itself kept firing. `getTutorRetentionStatus` reads the durable trail the
   * sweep now leaves in `audit_logs` (`routes/tutor.ts`'s `/retention/purge`)
   * and computes staleness from it — this route is the admin-visible surface
   * for that, and equally a plain HTTP+JSON target a future automated check
   * could poll.
   */
  router.get('/tutor/retention-status', async (_req, res) => {
    const status = await getTutorRetentionStatus();
    // A failed READ (database unreachable) is not the same claim as "the
    // sweep has never run" (§1.14) — the former is a 502, the latter is a 200
    // whose own `stale: true` says so.
    if (!status) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the retention sweep status');
    ok(res, status);
  });

  // ── Audit log ──────────────────────────────────────────────────────────────
  router.get('/audit', async (req, res) => {
    const q = AuditQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-200, offset >= 0, and valid audit filters are required');
    if (q.data.from && q.data.to && q.data.from > q.data.to) {
      return fail(res, 400, 'VALIDATION_ERROR', 'from must be earlier than or equal to to');
    }
    const page = await listAudit(q.data);
    if (!page) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the audit log');
    ok(res, page);
  });

  // ── Report escalation queue (E.3 — manage_support) ─────────────────────────
  /*
   * The platform-level review queue every social report routes to, plus the
   * pattern-triggered cases opened automatically by migration 0108. Reports
   * carry only the predefined category and the capped optional note; the
   * case carries the subject account id. Resolution is a staff decision and
   * records the deciding actor in the central audit trail (G.3).
   */
  const ReportsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  /*
   * E.4 (OD-3) / Appendix J 1.1: the staff-reviewed age correction queue.
   * A decision is applied and audited (G.3) by decide_age_correction in one
   * transaction; the database also refuses a requester deciding their own
   * request and a decider without manage_users.
   */
  const CorrectionQuery = z.object({
    status: z.union([CorrectionStatus, z.literal('all')]).default('pending'),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }).strict();
  router.get('/age-corrections', async (req, res) => {
    const parsed = CorrectionQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a valid status');
    const requests = await listCorrections(parsed.data.status, parsed.data.limit);
    if (!requests) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load age corrections');
    return ok(res, { requests });
  });

  const CorrectionDecision = z.object({ decision: z.enum(['approve', 'reject']), reason: CorrectionReason }).strict()
    .refine((body) => (body.decision === 'approve' ? (APPROVE_REASONS as readonly string[]) : (REJECT_REASONS as readonly string[])).includes(body.reason));
  router.post('/age-corrections/:id/decision', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const body = CorrectionDecision.safeParse(req.body ?? {});
    if (!id.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a decision and a matching reason');
    const decided = await decideCorrection(id.data, authedUser(res).id, body.data.decision === 'approve', body.data.reason);
    if (!decided.ok) return fail(res, decided.status, decided.code, 'The decision was not recorded');
    return ok(res, { id: id.data, status: decided.value });
  });

  router.get('/reports', async (req, res) => {
    const q = ReportsQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-200, offset >= 0');
    const cases = await listSocialReportCases(q.data.limit, q.data.offset);
    if (!cases) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load report cases');
    ok(res, { cases, total: cases.length });
  });

  router.get('/reports/:subjectId', async (req, res) => {
    const subjectId = z.string().uuid().safeParse(req.params.subjectId);
    if (!subjectId.success) return fail(res, 400, 'VALIDATION_ERROR', 'subjectId must be a uuid');
    const detail = await getSocialReportCase(subjectId.data);
    if (!detail) return fail(res, 404, 'NOT_FOUND', 'No report case for that account');
    ok(res, detail);
  });

  router.post('/reports/:subjectId/status', async (req, res) => {
    const subjectId = z.string().uuid().safeParse(req.params.subjectId);
    const body = z.object({ status: z.enum(['resolved']) }).strict().safeParse(req.body);
    if (!subjectId.success || !body.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'subjectId must be a uuid and status must be resolved');
    }
    const result = await resolveSocialReviewCase(subjectId.data, authedUser(res).id);
    if (result === 'not-found') return fail(res, 404, 'NOT_FOUND', 'No report case for that account');
    if (result === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not resolve the report case');
    ok(res, { subjectId: subjectId.data, status: 'resolved' });
  });

  // ── Roles & Access (superadmin only — §1.4) ────────────────────────────────
  const superadminOnly = requireRole(['superadmin']);

  router.get('/roles', superadminOnly, async (_req, res) => {
    const roles = await listRoleHolders();
    if (!roles) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load role holders');
    ok(res, roles);
  });

  router.get('/roles/candidates', superadminOnly, async (req, res) => {
    const parsed = RoleCandidateQuerySchema.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'q must contain at least 2 characters and limit must be 1-20');
    const candidates = await findRoleCandidates(parsed.data.q, parsed.data.limit);
    if (!candidates) return fail(res, 502, DATA_UNAVAILABLE, 'Could not search users for role assignment');
    ok(res, { candidates });
  });

  router.post('/roles/grant', superadminOnly, async (req, res) => {
    const parsed = RoleMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + role required');
    const actorId = authedUser(res).id;
    if (parsed.data.role === 'parent') {
      if (!parsed.data.justification) {
        return fail(res, 400, 'VALIDATION_ERROR', 'A parent-role staff grant requires a justification');
      }
      // A.5 (Appendix M 1.2, target 100%): the role and its audited
      // justification commit in ONE transaction; the database also refuses a
      // parent role that arrives any other way without an ID check.
      const outcome = await grantParentRoleWithJustification(parsed.data.userId, actorId, parsed.data.justification);
      if (outcome === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'A parent-role staff grant requires a justification');
      // OD-3 section 2: the age record outranks the grant (kid role, under-13
      // origin, declared minor band). Correct the record in the E.4 age review.
      if (outcome === 'minor_record') return fail(res, 409, 'AGE_RECORD_MINOR', 'The account age record is a minor record; correct it through the age review first');
      if (outcome === 'rejected') return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this role change (see role invariants)');
      if (outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not confirm the grant and its justification');
      return ok(res, { userId: parsed.data.userId, role: 'parent', granted: true });
    }
    const result = await grantRoleChecked(parsed.data.userId, parsed.data.role, actorId);
    // DB triggers (superadmin-domain, admin-granter, kid-guardian) are the real
    // guardrails — a rejection there means the mutation is not allowed.
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this role change (see role invariants)');
    ok(res, { userId: parsed.data.userId, role: parsed.data.role, granted: true });
  });

  /*
   * G.1 / G.4 (GAP-FIX-R5): a revocation names the revoking superadmin. Vault's
   * revoke_staff_grant removes the grant with this actor on its audit row and,
   * for an elevated grant, records the access-review decision 'revoked' in the
   * same transaction. 'not_held' is the requested end state (nothing to
   * record); a write Core cannot confirm answers 502, never 'revoked'.
   */
  const revokeOutcome = (res: Response, outcome: StaffRevokeOutcome, rejected: string, data: Record<string, unknown>) => {
    if (outcome === 'revoked' || outcome === 'not_held') return ok(res, { ...data, revoked: outcome === 'revoked' });
    if (outcome === 'forbidden') return fail(res, 403, 'FORBIDDEN', 'Only a superadmin revokes access, and never their own superadmin role');
    if (outcome === 'rejected') return fail(res, 409, 'ROLE_REJECTED', rejected);
    return fail(res, 502, DATA_UNAVAILABLE, 'Could not confirm the revocation');
  };

  router.post('/roles/revoke', superadminOnly, async (req, res) => {
    const parsed = RoleMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + role required');
    const actorId = authedUser(res).id;
    if (parsed.data.role === 'superadmin' && parsed.data.userId === actorId) {
      return fail(res, 409, 'ROLE_REJECTED', 'A superadmin cannot revoke their own superadmin access');
    }
    const outcome = await revokeStaffGrant({ actorId, subjectId: parsed.data.userId, kind: 'role', grant: parsed.data.role });
    revokeOutcome(res, outcome, 'The database rejected this role change (see role invariants)', { userId: parsed.data.userId, role: parsed.data.role });
  });

  router.post('/roles/permissions/grant', superadminOnly, async (req, res) => {
    const parsed = AdminPermissionMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + permission required');
    const result = await grantAdminPermissionChecked(parsed.data.userId, parsed.data.permission, authedUser(res).id);
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this permission change');
    ok(res, { userId: parsed.data.userId, permission: parsed.data.permission, granted: true });
  });

  router.post('/roles/permissions/revoke', superadminOnly, async (req, res) => {
    const parsed = AdminPermissionMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + permission required');
    const outcome = await revokeStaffGrant({ actorId: authedUser(res).id, subjectId: parsed.data.userId, kind: 'permission', grant: parsed.data.permission });
    revokeOutcome(res, outcome, 'The database rejected this permission change', { userId: parsed.data.userId, permission: parsed.data.permission });
  });

  // ── G.4: the quarterly access review (Appendix N 1.1) ────────────────────
  /*
   * Only elevated grants are reviewed: the admin and superadmin roles and
   * the four staff permissions, never a family role. A grant is due when
   * max(granted_at, last kept review) is older than the cadence. Recording
   * a review writes the review-log row and 'admin.access.reviewed' in one
   * transaction (record_staff_access_review).
   */
  router.get('/roles/reviews', superadminOnly, async (_req, res) => {
    const status = await getAccessReviewStatus(ACCESS_REVIEW_CADENCE_DAYS);
    if (!status) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the access-review status');
    ok(res, status);
  });

  const AccessReviewGrant = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('role'), grant: z.enum(STAFF_REVIEW_ROLES) }).strict(),
    z.object({ kind: z.literal('permission'), grant: z.enum(STAFF_REVIEW_PERMISSIONS) }).strict(),
  ]);
  const AccessReviewBody = z.object({
    userId: z.string().uuid(),
    kind: z.enum(['role', 'permission']),
    grant: z.string(),
    outcome: z.enum(['kept', 'revoked']).default('kept'),
    note: z.string().trim().min(1).max(300).regex(/^[^<>]*$/).optional(),
  }).strict();

  router.post('/roles/review', superadminOnly, async (req, res) => {
    const body = AccessReviewBody.safeParse(req.body);
    const grant = body.success ? AccessReviewGrant.safeParse({ kind: body.data.kind, grant: body.data.grant }) : null;
    if (!body.success || !grant?.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid), kind role|permission with an elevated grant, outcome kept|revoked, note up to 300 characters');
    }
    const outcome = await recordAccessReview({
      subjectId: body.data.userId, kind: grant.data.kind, grant: grant.data.grant, actorId: authedUser(res).id,
      outcome: body.data.outcome, note: body.data.note ?? null,
    });
    if (outcome === 'not_held') return fail(res, 409, 'GRANT_NOT_HELD', 'That account does not hold this grant any more');
    if (outcome === 'rejected') return fail(res, 409, 'ROLE_REJECTED', 'The database refused this review');
    if (outcome === 'unavailable') return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the review');
    ok(res, { userId: body.data.userId, kind: grant.data.kind, grant: grant.data.grant, outcome: body.data.outcome, recorded: true });
  });

  // ── H.4: the operations watchdog (manage_support) ──────────────────────────
  /*
   * The daily Vault and Pulse backups and the schema drift probe, next to
   * the retention sweep's own status: per job the last successful run and
   * `stale` (services/opsJobs.ts holds each staleness constant). A failed
   * read is a 502; "never ran" is a 200 whose `stale: true` says so.
   */
  router.get('/ops/job-status', async (_req, res) => {
    const status = await getOpsJobStatus();
    if (!status) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the operations job status');
    ok(res, status);
  });

  // ── Email (Courier proxy) ──────────────────────────────────────────────────
  router.get('/emails/logs', async (req, res) => {
    const q = EmailLogsQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-200, offset >= 0');
    const { EMAIL_SERVER_URL, INTERNAL_API_KEY } = getConfig();
    try {
      const query = new URLSearchParams({ limit: String(q.data.limit), offset: String(q.data.offset) });
      if (q.data.q) query.set('q', q.data.q);
      if (q.data.status) query.set('status', q.data.status);
      if (q.data.templateType) query.set('templateType', q.data.templateType);
      const r = await fetch(`${EMAIL_SERVER_URL}/api/v1/logs?${query.toString()}`, {
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) return fail(res, 502, 'DATA_UNAVAILABLE', 'Email server unavailable');
      const body = await r.json() as Record<string, unknown>;
      const parsed = EmailLogsSchema.safeParse(body.data ?? body);
      if (!parsed.success) return fail(res, 502, 'DATA_UNAVAILABLE', 'Invalid response from email server');
      ok(res, parsed.data);
    } catch {
      fail(res, 502, 'DATA_UNAVAILABLE', 'Email server unreachable');
    }
  });

  router.get('/emails/summary', async (req, res) => {
    const q = EmailSummaryQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 7-365');
    const { EMAIL_SERVER_URL, INTERNAL_API_KEY } = getConfig();
    try {
      const query = new URLSearchParams({ days: String(q.data.days) });
      const r = await fetch(`${EMAIL_SERVER_URL}/api/v1/logs/summary?${query.toString()}`, {
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) return fail(res, 502, 'DATA_UNAVAILABLE', 'Email server unavailable');
      const body = await r.json() as Record<string, unknown>;
      const parsed = EmailSummarySchema.safeParse(body.data ?? body);
      if (!parsed.success) return fail(res, 502, 'DATA_UNAVAILABLE', 'Invalid response from email server');
      ok(res, parsed.data);
    } catch {
      fail(res, 502, 'DATA_UNAVAILABLE', 'Email server unreachable');
    }
  });

  // ── Insights (first-party learning/usage telemetry, /INSIGHTS.md) ─────────
  // Reads the 0023 SQL views via the service role. Aggregation happens in
  // Postgres; these routes only validate, fetch, and envelope.

  router.get('/insights/calibration', async (req, res) => {
    const q = InsightsCalibrationQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'minLearners 1-100, limit 1-200');
    const rows = await readSegmentCalibration({ minLearners: q.data.minLearners, limit: q.data.limit });
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Calibration view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/activity', async (req, res) => {
    const q = InsightsActivityQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365');
    const [rows, users] = await Promise.all([
      readDailyActivity(q.data.days),
      readDailyUsers(q.data.days),
    ]);
    if (rows === null || users === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Activity view unreachable');
    // `entries` carries the per-dimension breakdown; `users` carries the
    // distinct counts. They are separate because distinct counts are not
    // additive — summing `entries[].users` counts one learner once per
    // dimension combination.
    ok(res, { days: q.data.days, entries: rows, users });
  });

  /*
   * ── Audience ────────────────────────────────────────────────────────────
   *
   * Four routes that answer "who is out there", and one of them exists to say
   * how far the other three can be trusted.
   *
   * `/audience` and `/acquisition` read the consent-gated client stream.
   * `/registrations` reads the server-side record, which no cookie banner can
   * suppress. `/funnel-integrity` sets them side by side, because on
   * 2026-08-28 the stream reported zero completed signups across 31 real
   * accounts and nothing in the console could have told an operator that.
   */
  router.get('/insights/audience', async (req, res) => {
    const q = AudienceQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365');
    const summary = await readAudience(q.data.days);
    if (summary === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Audience view unreachable');
    ok(res, { days: q.data.days, ...summary });
  });

  router.get('/insights/registrations', async (req, res) => {
    const q = AudienceQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365');
    const entries = await readRegistrations(q.data.days);
    if (entries === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Registrations view unreachable');
    ok(res, { days: q.data.days, entries, total: entries.reduce((t, e) => t + e.registrations, 0) });
  });

  router.get('/insights/funnel-integrity', async (req, res) => {
    const q = AudienceQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365');
    const integrity = await readSignupFunnelIntegrity(q.data.days);
    if (integrity === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Funnel integrity view unreachable');
    ok(res, { days: q.data.days, ...integrity });
  });

  router.get('/insights/acquisition', async (req, res) => {
    const q = AudienceQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-365');
    const summary = await readAnonAcquisition(q.data.days);
    if (summary === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Acquisition view unreachable');
    ok(res, { days: q.data.days, ...summary });
  });

  router.get('/insights/cohorts', async (req, res) => {
    const q = InsightsCohortQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'weeks 1-52');
    const rows = await readCohortRetention(q.data.weeks);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Cohort view unreachable');
    ok(res, { weeks: q.data.weeks, entries: rows });
  });

  router.get('/insights/funnel', async (_req, res) => {
    const rows = await readActivationFunnel();
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Funnel view unreachable');
    ok(res, { steps: rows });
  });

  router.get('/insights/velocity', async (req, res) => {
    const q = InsightsLimitQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-500');
    const rows = await readLearningVelocity(q.data.limit);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Velocity view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/dropoff', async (req, res) => {
    const q = InsightsLimitQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-500');
    const rows = await readLessonDropoff(q.data.limit);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Drop-off view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/adoption', async (_req, res) => {
    const rows = await readFeatureAdoption();
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Adoption view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/sessions', async (req, res) => {
    const q = InsightsDepthQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days 1-90, limit 1-1000');
    const rows = await readSessionDepth(q.data.days, q.data.limit);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Session view unreachable');
    ok(res, { entries: rows });
  });

  /*
   * Filtered export for internal analysis. Deliberately carries NO user_id or
   * anon_id (see readEventExport): a file leaves the platform's access
   * controls, so it holds behaviour and dimensions, never an identifier that
   * re-identifies a learner. Every export is written to the append-only audit
   * log — who pulled what, when.
   */
  router.get('/insights/export', async (req, res) => {
    const q = InsightsExportQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid export filters');
    const out = await readEventExport({
      sinceDays: q.data.days,
      role: q.data.role,
      event: q.data.event,
      routeClass: q.data.routeClass,
      locale: q.data.locale,
      device: q.data.device,
      limit: q.data.limit,
      offset: q.data.offset,
      token: q.data.exportToken,
    });
    if (out === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Export unavailable');

    void insertAuditLog(authedUser(res).id, 'insights.export', 'learning_events', {
      days: q.data.days, format: q.data.format, rows: out.rows.length,
      offset: q.data.offset, truncated: out.truncated,
      role: q.data.role ?? null, event: q.data.event ?? null,
    });

    /*
     * Truncation is DECLARED, never silent. A clipped CSV is indistinguishable
     * from a complete one once it is open in a spreadsheet, and a partial file
     * read as the whole picture is how an analysis reaches a confident wrong
     * conclusion. Headers carry it for both formats (a CSV body cannot hold
     * metadata without breaking the grid) and the JSON envelope repeats it.
     */
    const nextOffset = q.data.offset + out.rows.length;
    res.setHeader('X-LF-Export-Rows', String(out.rows.length));
    res.setHeader('X-LF-Export-Token', out.token);
    res.setHeader('X-LF-Export-Truncated', out.truncated ? 'true' : 'false');
    if (out.truncated) res.setHeader('X-LF-Export-Next-Offset', String(nextOffset));

    const stamp = new Date().toISOString().slice(0, 10);
    const page = q.data.offset > 0 ? `-p${q.data.offset}` : '';
    if (q.data.format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="lf-insights-${stamp}${page}.json"`);
      return ok(res, {
        rows: out.rows,
        truncated: out.truncated,
        nextOffset: out.truncated ? nextOffset : null,
        exportToken: out.token,
      });
    }
    /*
     * Deliberate §1.6 envelope exception, not an oversight: this is a file
     * download, and the frontend's export reader (AdminInsightsPage.tsx)
     * calls res.text() on this exact path and pastes the response straight
     * into the downloaded .csv Blob. Wrapping it as {data,error} would put
     * JSON syntax inside every exported spreadsheet. Truncation/paging
     * metadata already travels via the X-LF-Export-* headers above for
     * exactly this reason — a CSV body cannot carry it without breaking the
     * grid. Same posture as the JSON branch's Content-Disposition above.
     */
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lf-insights-${stamp}${page}.csv"`);
    return res.status(200).send(toCsv(out.rows));
  });

  router.get('/insights/timetovalue', async (req, res) => {
    const q = InsightsLimitQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-500');
    const rows = await readTimeToValue(q.data.limit);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Time-to-value view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/engagement', async (req, res) => {
    const q = InsightsLimitQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-500');
    const rows = await readEngagement(q.data.limit);
    if (rows === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Engagement view unreachable');
    ok(res, { entries: rows });
  });

  router.get('/insights/families', async (req, res) => {
    const q = InsightsFamiliesQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-500');
    // S07.6 (D.6): the per-child shape. Every outcome is recorded for the
    // Staff Family-Engagement Insight Uptime metric; the consent coverage is a
    // separate count and does not decide whether the insight was served.
    const [insight, consent] = await Promise.all([readFamilyEngagementInsight(q.data.limit), readConsentCoverage()]);
    await recordStaffInsightCheck(insight.ok ? 'ok' : insight.outcome);
    if (!insight.ok || consent === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Family views unreachable');
    ok(res, { summary: insight.data.summary, children: insight.data.children, consent });
  });


  /*
   * ── Intelligence console export ─────────────────────────────────────────
   *
   * Rendered HERE rather than in dataintel because the /intel proxy reads
   * upstream responses as TEXT — fine for JSON, silently corrupting for a
   * spreadsheet's bytes. Core fetches the same JSON the console renders and
   * writes the file itself.
   *
   * The window travels with every upstream call, so the file cannot describe a
   * different period than the screen did, and the provenance sheet states the
   * window, the generation time and the standing staff-exclusion caveat.
   *
   * Same documented envelope exception as the analytics exports: success is raw
   * bytes, every error path is the normal envelope.
   */
  router.get('/intel-export.:format', async (req, res) => {
    const format = req.params.format === 'xlsx' ? 'xlsx' : req.params.format === 'csv' ? 'csv' : null;
    if (!format) {
      fail(res, 400, 'VALIDATION_ERROR', 'format must be csv or xlsx');
      return;
    }
    const parsed = IntelExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'days 1-3650, optional from/to as YYYY-MM-DD');
      return;
    }
    const { days, from, to } = parsed.data;
    if ((from && !to) || (to && !from)) {
      fail(res, 400, 'VALIDATION_ERROR', 'from and to must be supplied together');
      return;
    }
    const windowQuery = from && to ? `days=${days}&from=${from}&to=${to}` : `days=${days}`;

    const pull = async <T>(path: string): Promise<T | null> => {
      try {
        const upstream = await fetch(`${DATAINTEL_URL}/api/v1/intel${path}`, {
          headers: { 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
          signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
        });
        if (!upstream.ok) return null;
        const body = (await upstream.json()) as { data?: T };
        return body.data ?? null;
      } catch {
        return null;
      }
    };

    const [engagement, dropoff, calibration, funnel, exclusion] = await Promise.all([
      pull<Record<string, unknown>[]>(`/engagement/leaderboard?limit=200&${windowQuery}`),
      pull<Record<string, unknown>[]>(`/lessons/dropoff?limit=200&${windowQuery}`),
      pull<Record<string, unknown>[]>(`/lessons/calibration?minLearners=1&limit=200&${windowQuery}`),
      pull<Record<string, unknown>[]>(`/funnels/activation?${windowQuery}`),
      pull<Record<string, unknown>>(`/quality/staff-exclusion?${windowQuery}`),
    ]);

    // Every section failing means dataintel is down, not that the window was
    // empty. An export of nothing, labelled as a period, would be read as fact.
    if (!engagement && !dropoff && !calibration && !funnel) {
      fail(res, 502, DATA_UNAVAILABLE, 'Intel service did not answer');
      return;
    }

    const table = (name: string, rows: Record<string, unknown>[] | null): ExportSheet | null => {
      if (!rows || rows.length === 0) return null;
      const columns = Object.keys(rows[0] as object);
      return {
        name,
        columns,
        rows: rows.map((row) => columns.map((c) => (row[c] === null || row[c] === undefined ? null : (row[c] as string | number)))),
      };
    };

    const sheets = [
      table('Activation funnel', funnel),
      table('Engagement', engagement),
      table('Lesson dropoff', dropoff),
      table('Segment calibration', calibration),
    ].filter((sheet): sheet is ExportSheet => sheet !== null);

    const excludedShare = typeof exclusion?.excludedShare === 'number' ? exclusion.excludedShare : null;
    const meta = {
      title: 'LittleFounders intelligence',
      window: from && to ? `${from} to ${to}` : `last ${days} days`,
      generatedAt: new Date().toISOString(),
      notes: [
        'Staff activity is excluded from every figure in this file. Admin and superadmin accounts are filtered out of the warehouse before any metric is computed.',
        excludedShare !== null
          ? `In this window ${(excludedShare * 100).toFixed(1)}% of raw events were staff activity and are not counted here.`
          : 'The staff-exclusion share could not be read for this window.',
        'Figures cover the window above only. A section missing from this file had no rows in that window.',
      ],
    };

    const stamp = (from && to ? `${from}_to_${to}` : `last-${days}d`);
    const filename = `littlefounders-intel-${stamp}.${format}`;

    if (format === 'csv') {
      res
        .status(200)
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        .send(renderTablesCsv(meta, sheets));
      return;
    }
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(await renderTablesXlsx(meta, sheets));
  });

  // ── Data Intelligence (dataintel/) proxy ────────────────────────────────────
  // Forwards analytics queries to the dataintel service (port 4008).
  // The browser talks only to Core; Core relays to dataintel with the
  // internal API key. dataintel responses are passed through unmodified
  // — they already carry the standard { data, error } envelope.

  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();

  router.use('/intel', async (req, res) => {
    // req.url is already relative to this '/intel' mount point (Express
    // strips matched prefixes progressively); req.originalUrl would still
    // carry the full /api/v1/admin/intel/... path and double it up.
    const url = `${DATAINTEL_URL}/api/v1/intel${req.url}`;
    try {
      const proxyRes = await fetch(url, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': DATAINTEL_INTERNAL_KEY,
        },
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
      });
      const contentLength = proxyRes.headers.get('content-length');
      const maxSize = 50 * 1024 * 1024;
      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'Intel response exceeds maximum size');
      }
      const body = await proxyRes.text();
      if (proxyRes.headers.get('content-type')) {
        res.setHeader('Content-Type', proxyRes.headers.get('content-type')!);
      }
      if (proxyRes.headers.get('x-lf-export-rows')) {
        res.setHeader('X-LF-Export-Rows', proxyRes.headers.get('x-lf-export-rows')!);
        res.setHeader('Access-Control-Expose-Headers', 'X-LF-Export-Rows');
      }
      return res.status(proxyRes.status).send(body);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return fail(res, 504, 'UPSTREAM_TIMEOUT', 'Intel service did not respond in time');
      }
      return fail(res, 502, 'UPSTREAM_FAILED', 'Intel service unreachable');
    }
  });

  return router;
}
