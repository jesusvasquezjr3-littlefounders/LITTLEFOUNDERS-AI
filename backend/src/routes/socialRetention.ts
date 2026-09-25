import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { requireInternalKey } from '../middleware/auth.js';
import { SOCIAL_RETENTION_MAX_LIMIT, runSocialGraphRetention } from '../services/socialGovernance.js';

/*
 * POST /api/v1/internal/social-retention/run — the daily E.11 sweep
 * (.github/workflows/social-retention.yml; policy SOCIAL-GOVERNANCE.md §3).
 *
 * One call runs public.run_social_graph_retention once: every retention
 * class, each bounded by `limit` rows, in one transaction that also writes
 * the `social_retention.sweep_ran` audit row (including a run that found
 * nothing, so "ran and found nothing" and "never ran" stay distinguishable).
 * `complete: false` means a class filled its page and the caller should run
 * again. A failed or malformed database answer is a 502, never zero counts.
 *
 * Internal key only: no browser, no staff session and no Tutor can trigger
 * a deletion early.
 */
const SweepBody = z.object({ limit: z.number().int().min(1).max(SOCIAL_RETENTION_MAX_LIMIT).default(500) }).strict();

export function socialRetentionSweepRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  router.post('/run', async (req, res) => {
    const parsed = SweepBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body');
    const run = await runSocialGraphRetention(parsed.data.limit);
    if (!run) return fail(res, 502, 'DATA_UNAVAILABLE', 'The social-graph retention sweep did not run');
    return ok(res, run);
  });

  return router;
}
