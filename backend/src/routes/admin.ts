import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import {
  getKumaHealth,
  getPlausibleOverview,
  getPulseConfig,
  getUmamiStats,
  kumaConfigured,
  plausibleConfigured,
  umamiConfigured,
} from '../services/pulse.js';
import {
  getAdminOverview,
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

const PeriodSchema = z.object({
  period: z.enum(['day', '7d', '30d', 'month', '6mo', '12mo']).default('30d'),
});

const PULSE_UNCONFIGURED = 'PULSE_UNCONFIGURED';
const UPSTREAM_FAILED = 'UPSTREAM_FAILED';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';

const GRANTABLE_ROLES = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
const RoleMutationSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(GRANTABLE_ROLES),
});
const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function adminRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(['admin', 'superadmin']));

  /** Web-analytics overview (Plausible): aggregate KPIs + daily timeseries. */
  router.get('/analytics/overview', async (req, res) => {
    const parsed = PeriodSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'period must be one of day|7d|30d|month|6mo|12mo');
      return;
    }
    if (!plausibleConfigured(getPulseConfig())) {
      fail(res, 503, PULSE_UNCONFIGURED, 'Plausible is not configured on this deployment');
      return;
    }
    const overview = await getPlausibleOverview(parsed.data.period);
    if (!overview) {
      fail(res, 502, UPSTREAM_FAILED, 'Plausible did not answer');
      return;
    }
    ok(res, { period: parsed.data.period, ...overview });
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

  // ── Users / Support ────────────────────────────────────────────────────────
  router.get('/users', async (_req, res) => {
    const users = await listAdminUsers();
    if (!users) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load users');
    ok(res, { users });
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

  return router;
}
