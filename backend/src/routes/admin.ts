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
  readFamilyEngagement,
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
import { renderAnalyticsReportPdf, REPORT_LOCALES, type ReportLocale } from '../services/analyticsReport.js';
import { getTutorRetentionStatus, listTutorReviewQueue, setTutorReviewStatus } from '../services/tutorData.js';
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
  revokeRoleChecked,
  grantAdminPermissionChecked,
  revokeAdminPermissionChecked,
  setCourseStatus,
  setLessonStatus,
} from '../services/adminData.js';

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
  // The Content screen also loads lesson and Tutor review queues. Guard every
  // endpoint it uses, including mutations and direct API requests.
  router.use('/content', requireAdminPermission('manage_content'));
  router.use('/generation', requireAdminPermission('manage_content'));
  router.use('/moderation', requireAdminPermission('manage_content'));
  router.use('/tutor/review-queue', requireAdminPermission('manage_content'));
  router.use('/analytics', requireAdminPermission('view_analytics'));
  router.use('/insights', requireAdminPermission('view_analytics'));
  router.use('/intel', requireAdminPermission('view_analytics'));
  router.use(/^\/intel-export\.(?:csv|xlsx)$/, requireAdminPermission('view_analytics'));
  router.use('/health/services', requireAdminPermission('view_analytics'));
  router.use('/learning/retention', requireAdminPermission('view_analytics'));
  router.use('/emails', requireAdminPermission('manage_support'));
  router.use('/audit', requireAdminPermission('manage_support'));
  router.use('/tutor/retention-status', requireAdminPermission('manage_support'));
  // E.3 report escalation queue: support-adjacent tooling per G.1's mapping.
  router.use('/reports', requireAdminPermission('manage_support'));
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

  router.get('/users/timeline', async (req, res) => {
    const q = TimelineQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 7 and 365');
    const timeline = await getSignupTimeline(q.data.days);
    ok(res, { timeline });
  });

  // A.5: the real revocation trigger path — a staff action following a
  // fraud report. Writes a new revoked row (latest-row-wins resolver) and
  // records the deciding actor and reason in the audit trail FIRST, so the
  // reason exists even if the write itself fails.
  const VerificationRevokeSchema = z.object({
    reason: z.string().trim().min(10).max(300),
  }).strict();

  router.post('/users/:userId/verification/revoke', async (req, res) => {
    const userId = z.string().uuid().safeParse(req.params.userId);
    const parsed = VerificationRevokeSchema.safeParse(req.body);
    if (!userId.success || !parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'userId must be a uuid and a reason (10-300 characters) is required');
    }
    const actor = authedUser(res);
    await insertAuditLog(actor.id, 'admin.parent_verification.revoked', userId.data, {
      reason: parsed.data.reason,
    });
    const revoked = await revokeParentVerification(userId.data);
    if (!revoked) return fail(res, 502, DATA_UNAVAILABLE, 'Could not revoke the verification');
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
    const done = await setLessonStatus(lessonId.data, status.data, authedUser(res).id);
    if (!done) return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the lesson');
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

  router.post('/tutor/review-queue/:segmentId/status', async (req, res) => {
    const segmentId = z.string().uuid().safeParse(req.params.segmentId);
    const status = z.enum(['approved', 'rejected']).safeParse((req.body as { status?: unknown })?.status);
    if (!segmentId.success || !status.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'segmentId must be a uuid and status approved|rejected');
    }
    const actor = authedUser(res);
    const done = await setTutorReviewStatus(segmentId.data, status.data);
    if (!done) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the review');
    // G.3: the moderation decision must ALSO land in the central audit log
    // (the activity row keeps the status; the log keeps the searchable,
    // staff-wide trail of WHO approved/rejected WHAT — the same treatment
    // course/lesson status changes already receive).
    await insertAuditLog(actor.id, 'admin.tutor_activity.review', segmentId.data, { status: status.data });
    ok(res, { id: segmentId.data, status: status.data });
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
    if (parsed.data.role === 'parent' && !parsed.data.justification) {
      return fail(res, 400, 'VALIDATION_ERROR', 'A parent-role staff grant requires a justification');
    }
    const result = await grantRoleChecked(parsed.data.userId, parsed.data.role, authedUser(res).id);
    // DB triggers (superadmin-domain, admin-granter, kid-guardian) are the real
    // guardrails — a rejection there means the mutation is not allowed.
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this role change (see role invariants)');
    if (parsed.data.role === 'parent' && parsed.data.justification) {
      // A.5: the justification rides its own audit row (the grant trigger
      // records the actor/timestamp; this row carries the reason).
      await insertAuditLog(authedUser(res).id, 'admin.parent_role_justification', parsed.data.userId, {
        justification: parsed.data.justification,
      });
    }
    ok(res, { userId: parsed.data.userId, role: parsed.data.role, granted: true });
  });

  router.post('/roles/revoke', superadminOnly, async (req, res) => {
    const parsed = RoleMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + role required');
    if (parsed.data.role === 'superadmin' && parsed.data.userId === authedUser(res).id) {
      return fail(res, 409, 'ROLE_REJECTED', 'A superadmin cannot revoke their own superadmin access');
    }
    const result = await revokeRoleChecked(parsed.data.userId, parsed.data.role);
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this role change (see role invariants)');
    ok(res, { userId: parsed.data.userId, role: parsed.data.role, revoked: true });
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
    const result = await revokeAdminPermissionChecked(parsed.data.userId, parsed.data.permission);
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this permission change');
    ok(res, { userId: parsed.data.userId, permission: parsed.data.permission, revoked: true });
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
    const [families, consent] = await Promise.all([readFamilyEngagement(q.data.limit), readConsentCoverage()]);
    if (families === null || consent === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Family views unreachable');
    ok(res, { families, consent });
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
