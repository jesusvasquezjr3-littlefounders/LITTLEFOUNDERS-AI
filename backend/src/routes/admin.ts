import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { getConfig } from '../config.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
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
import { renderAnalyticsReportPdf } from '../services/analyticsReport.js';
import {
  getExcludedIps,
  getKumaHealth,
  getPlausibleBreakdown,
  getPlausibleOverview,
  getPlausibleReportData,
  getPulseConfig,
  getUmamiStats,
  kumaConfigured,
  PLAUSIBLE_DIMENSION_KEYS,
  plausibleConfigured,
  REPORT_AUDIENCES,
  umamiConfigured,
} from '../services/pulse.js';
import type { PlausibleFilter } from '../services/pulse.js';
import { insertAuditLog } from '../services/supabaseRest.js';
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
  isCourseStatus,
  isLessonStatus,
  listAdminCourses,
  listAdminUsers,
  listAudit,
  listReviewLessons,
  listRoleHolders,
  revokeRoleChecked,
  grantAdminPermissionChecked,
  revokeAdminPermissionChecked,
  setCourseStatus,
  setLessonStatus,
} from '../services/adminData.js';

/*
 * /api/v1/admin — the staff console's data plane (/AGENTS.md §1.4: admin AND
 * superadmin may read platform content/support surfaces; role-mutation
 * endpoints, when they land, gate on superadmin only). Analytics & health are
 * Core-brokered reads from Pulse (pulse/AGENTS.md #5): Plausible/Umami/Kuma
 * tokens never reach the browser, responses are cached (services/pulse.ts).
 *
 * Real authorization for anything beyond reads stays in RLS + DB triggers;
 * requireRole here is the app-layer gate (§1.3 "DB AND app layer").
 */

const PERIODS = ['day', '7d', '30d', 'month', '6mo', '12mo'] as const;
const PeriodSchema = z.object({
  period: z.enum(PERIODS).default('30d'),
});

const BreakdownQuerySchema = z.object({
  period: z.enum(PERIODS).default('30d'),
  dimension: z.enum(PLAUSIBLE_DIMENSION_KEYS),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

const ReportQuerySchema = z.object({
  period: z.enum(PERIODS).default('30d'),
  audience: z.enum(REPORT_AUDIENCES).default('full'),
});

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
});

const AdminPermissionMutationSchema = z.object({
  userId: z.string().uuid(),
  permission: z.string().min(2),
});

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
// Run ids are operator-chosen (`<track-id>--<adventure-slug>` or a default
// timestamp id) — constrain to a safe charset, never interpolate raw.
const GenerationRunParamSchema = z.object({
  runId: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/),
});

export function adminRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(['admin', 'superadmin']));

  /** Web-analytics overview (Plausible): aggregate KPIs + daily timeseries, optionally filtered. */
  router.get('/analytics/overview', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period must be one of day|7d|30d|month|6mo|12mo');
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
    const overview = await getPlausibleOverview(parsed.data.period, filters.filters);
    if (!overview) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    ok(res, { period: parsed.data.period, ...overview });
  });

  /** Top-N breakdown by one dimension (Plausible), ordered by visitors desc. */
  router.get('/analytics/breakdown', async (req, res) => {
    const parsed = BreakdownQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period day|7d|30d|month|6mo|12mo, dimension one of the console dimension keys, limit 1-50');
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
    const rows = await getPlausibleBreakdown(parsed.data.period, parsed.data.dimension, parsed.data.limit, filters.filters);
    if (!rows) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    ok(res, { period: parsed.data.period, dimension: parsed.data.dimension, rows });
  });

  /** Audience report bundle: aggregate + timeseries + the audience's top-10 breakdowns. */
  router.get('/analytics/report', async (req, res) => {
    const parsed = ReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period day|7d|30d|month|6mo|12mo, audience marketing|sales|frontend|full');
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
    const report = await getPlausibleReportData(parsed.data.period, parsed.data.audience, filters.filters);
    if (!report) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    ok(res, report);
  });

  /**
   * DOCUMENTED EXCEPTION to the §1.6 envelope (like Depot's public file
   * route): the SUCCESS path streams raw PDF bytes — a download, not an API
   * payload. Every error path still answers the normal {data,error} envelope.
   */
  router.get('/analytics/report.pdf', async (req, res) => {
    const parsed = ReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period day|7d|30d|month|6mo|12mo, audience marketing|sales|frontend|full');
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
    const report = await getPlausibleReportData(parsed.data.period, parsed.data.audience, filters.filters);
    if (!report) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    const pdf = await renderAnalyticsReportPdf(report);
    const day = report.generatedAt.slice(0, 10); // YYYY-MM-DD
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="littlefounders-analytics-${report.audience}-${report.period}-${day}.pdf"`)
      .send(pdf);
  });

  /**
   * Read-only mirror of the IPs excluded from analytics ingestion. Enforcement
   * lives in pulse-plausible's IP_BLOCKLIST env — there is deliberately NO
   * write endpoint here (changing it is an infra step in Railway variables).
   */
  router.get('/analytics/exclusions', (_req, res) => {
    ok(res, { ips: getExcludedIps() });
  });

  /** Behavioral stats (Umami): adult-surfaces product analytics. */
  router.get('/analytics/behavior', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period must be one of day|7d|30d|month|6mo|12mo');
      return;
    }
    if (!umamiConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Umami is not configured on this deployment');
      return;
    }
    const stats = await getUmamiStats(parsed.data.period);
    if (!stats) {
      fail(res, 502, UPSTREAM_FAILED, 'Umami did not answer');
      return;
    }
    ok(res, { period: parsed.data.period, ...stats });
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
    const overview = await getAdminOverview();
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
   * dashboard polls this every ~2s while a run is active to render the live
   * flow visualization — it shows slot progress per stage, cost, and image
   * counts as they happen, not just after the fact (0017's post-mortem view).
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
    const [courses, summary] = await Promise.all([listAdminCourses(), getAdminContentSummary()]);
    if (!courses || !summary) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load content');
    ok(res, { courses, summary });
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

  // ── Audit log ──────────────────────────────────────────────────────────────
  router.get('/audit', async (req, res) => {
    const q = AuditQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-200, offset >= 0');
    const entries = await listAudit(q.data.limit, q.data.offset);
    if (!entries) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the audit log');
    ok(res, { entries, limit: q.data.limit, offset: q.data.offset });
  });

  // ── Roles & Access (superadmin only — §1.4) ────────────────────────────────
  const superadminOnly = requireRole(['superadmin']);

  router.get('/roles', superadminOnly, async (_req, res) => {
    const holders = await listRoleHolders();
    if (!holders) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load role holders');
    ok(res, { holders });
  });

  router.post('/roles/grant', superadminOnly, async (req, res) => {
    const parsed = RoleMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + role required');
    const result = await grantRoleChecked(parsed.data.userId, parsed.data.role, authedUser(res).id);
    // DB triggers (superadmin-domain, admin-granter, kid-guardian) are the real
    // guardrails — a rejection there means the mutation is not allowed.
    if (!result.ok) return fail(res, 409, 'ROLE_REJECTED', 'The database rejected this role change (see role invariants)');
    ok(res, { userId: parsed.data.userId, role: parsed.data.role, granted: true });
  });

  router.post('/roles/revoke', superadminOnly, async (req, res) => {
    const parsed = RoleMutationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId (uuid) + role required');
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

  router.get('/emails/summary', async (_req, res) => {
    const { EMAIL_SERVER_URL, INTERNAL_API_KEY } = getConfig();
    try {
      const r = await fetch(`${EMAIL_SERVER_URL}/api/v1/logs/summary`, {
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
