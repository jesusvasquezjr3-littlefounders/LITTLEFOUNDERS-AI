import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { getConfig } from '../config.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
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
import {
  getAdminOverview,
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
  id: string;
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
});

const EmailSummarySchema = z.object({
  total: z.number().int().min(0),
  statuses: z.record(z.string(), z.number().int().min(0)),
  templates: z.record(z.string(), z.number().int().min(0)),
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
   * Optional query param: ?course=financial-education
   */
  router.get('/generation/analytics', async (req, res) => {
    const q = CoachQuerySchema.safeParse(req.query);
    const course = q.success ? q.data.course : undefined;
    if (!q.success && 'course' in (req.query as Record<string, unknown>)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'course must be a valid slug (1-100 chars, lowercase letters, digits, hyphens)');
    }
    const analytics = await getGenerationAnalytics(course);
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
    const course = q.success ? q.data.course : undefined;
    const track = q.success ? q.data.track : undefined;
    if (!q.success && ('course' in (req.query as Record<string, unknown>) || 'track' in (req.query as Record<string, unknown>))) {
      return fail(res, 400, 'VALIDATION_ERROR', 'course must be a slug (1-100, a-z0-9-), track must be 1-200 safe chars');
    }
    const report = await getCoachReport(course, track);
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
  router.get('/content', async (_req, res) => {
    const courses = await listAdminCourses();
    if (!courses) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load content');
    ok(res, { courses });
  });

  router.post('/content/:courseId/status', async (req, res) => {
    const courseId = z.string().uuid().safeParse(req.params.courseId);
    const status = z.string().safeParse((req.body as { status?: unknown })?.status);
    if (!courseId.success || !status.success || !isCourseStatus(status.data)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'courseId must be a uuid and status one of draft|published|archived');
    }
    const done = await setCourseStatus(courseId.data, status.data, authedUser(res).id);
    if (!done) return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the course');
    ok(res, { id: courseId.data, status: status.data });
  });

  // ── Moderation (lesson review gate, §1.9) ──────────────────────────────────
  router.get('/moderation', async (_req, res) => {
    const lessons = await listReviewLessons();
    if (!lessons) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the review queue');
    ok(res, { lessons });
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

  // ── Email (Courier proxy) ──────────────────────────────────────────────────
  router.get('/emails/logs', async (req, res) => {
    const q = EmailLogsQuerySchema.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit 1-200, offset >= 0');
    const { EMAIL_SERVER_URL, INTERNAL_API_KEY } = getConfig();
    try {
      const r = await fetch(`${EMAIL_SERVER_URL}/api/v1/logs?limit=${q.data.limit}&offset=${q.data.offset}`, {
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

  return router;
}
