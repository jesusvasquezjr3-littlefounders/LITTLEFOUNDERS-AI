import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getKumaHealth,
  getPlausibleOverview,
  getPulseConfig,
  getUmamiStats,
  kumaConfigured,
  plausibleConfigured,
  umamiConfigured,
} from '../services/pulse.js';

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

  return router;
}
