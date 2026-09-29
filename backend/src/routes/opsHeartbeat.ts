import { Router } from 'express';
import { fail, ok } from '../lib/http.js';
import { requireInternalKey } from '../middleware/auth.js';
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
 *
 * Internal-key only; no user session reaches either path.
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

  return router;
}
