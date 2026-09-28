import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { requireInternalKey } from '../middleware/auth.js';
import { serviceRestRaw } from '../services/supabaseRest.js';

/*
 * POST /api/v1/internal/learning-retention/run — the daily sweep of
 * learning_practice_days (GAP-FIX-R1, weekly streak strip; Bible 02 §9.6).
 *
 * The practice-day trigger already trims each active learner's rows past 400
 * days; this sweep covers learners who stopped practising
 * (.github/workflows/learning-retention.yml). It calls
 * public.sweep_learning_practice_days once and returns how many rows it
 * removed. A failed or malformed database answer is a 502, never a zero.
 *
 * Internal key only: no browser, no staff session and no Tutor can trigger it.
 */
const SweepBody = z.object({}).strict();
const Removed = z.number().int().min(0);

export function learningRetentionSweepRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  router.post('/run', async (req, res) => {
    if (!SweepBody.safeParse(req.body ?? {}).success) return fail(res, 400, 'VALIDATION_ERROR', 'The sweep takes no options');
    const result = await serviceRestRaw('/rpc/sweep_learning_practice_days', { method: 'POST', body: '{}' });
    const removed = result.ok ? Removed.safeParse(result.body) : null;
    if (!removed?.success) return fail(res, 502, 'DATA_UNAVAILABLE', 'The practice-day retention sweep did not run');
    return ok(res, { practiceDaysRemoved: removed.data });
  });

  return router;
}
