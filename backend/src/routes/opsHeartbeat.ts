import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { requireInternalKey } from '../middleware/auth.js';
import { readFamilyStateIntegrity } from '../services/familyLifecycle.js';
import { readRetentionCompliance } from '../services/familyRetention.js';
import { getOpsJobStatus, HEARTBEAT_JOBS, OpsHeartbeatBody, recordOpsHeartbeat } from '../services/opsJobs.js';

/*
 * H.4 (Appendix O 1.3, 2.3): the internal half of the operations watchdog.
 *
 *   POST /api/v1/internal/ops/heartbeat {job, ok, bytes?, pending?}
 *     called at the end of vault-backup.yml, pulse-backup.yml,
 *     vault-drift.yml, learning-retention.yml and insights-maintenance.yml
 *     from inside the Core container (the key never leaves it). Writes `ops.<job>.completed` to audit_logs. A write that does not
 *     land answers 502, so the job itself fails loudly instead of leaving a
 *     healthy run with no trail.
 *   GET /api/v1/internal/ops/job-status
 *     what .github/workflows/ops-job-watch.yml reads: per job `lastRunAt` and
 *     `stale`, computed in services/opsJobs.ts (the one home of each
 *     staleness constant). Staff read the same status at
 *     GET /api/v1/admin/ops/job-status.
 *   GET /api/v1/internal/ops/family-integrity?days=1
 *     gap-fix round 8 (Appendix H 1.3 D.4, 1.4, Part 3 Stage 7): what
 *     .github/workflows/family-integrity-watch.yml reads every day. The same
 *     D.4 metric staff read at GET /api/v1/admin/family/state-integrity
 *     (state transitions per table, `outsideService` = not through Core's
 *     service role, target zero) plus the Retention-Policy Compliance Audit
 *     (GET /api/v1/admin/family/retention-compliance), judged by
 *     agent/tools/check-family-production-integrity.mjs. The admin routes need
 *     a staff session, which a scheduled job does not have. An unreadable
 *     integrity metric answers 502 (the watch must fail, never read it as
 *     zero); an unreadable retention audit is `retention: null`.
 *
 * Internal-key only; no user session reaches any of these paths.
 */
export function opsHeartbeatRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  router.post('/heartbeat', async (req, res) => {
    const parsed = OpsHeartbeatBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', `job must be ${HEARTBEAT_JOBS.join('|')}, ok a boolean, bytes and pending non-negative integers`);
    }
    const recorded = await recordOpsHeartbeat(parsed.data);
    if (!recorded) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the heartbeat');
    return ok(res, { job: parsed.data.job, recorded: true }, 201);
  });

  router.get('/job-status', async (_req, res) => {
    const status = await getOpsJobStatus();
    if (!status) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load the operations job status');
    return ok(res, status);
  });

  const FamilyIntegrityQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(1) }).strict();
  router.get('/family-integrity', async (req, res) => {
    const q = FamilyIntegrityQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'days must be an integer between 1 and 365');
    const [stateIntegrity, retention] = await Promise.all([
      readFamilyStateIntegrity(new Date(Date.now() - q.data.days * 24 * 60 * 60 * 1000)),
      readRetentionCompliance(),
    ]);
    if (stateIntegrity === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load the state-integrity metric');
    return ok(res, {
      days: q.data.days,
      stateIntegrity,
      retention: retention ? { pass: retention.pass, overdue: retention.overdue, tables: retention.tables } : null,
    });
  });

  return router;
}
