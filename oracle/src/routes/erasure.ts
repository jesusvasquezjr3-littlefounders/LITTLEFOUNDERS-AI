import { Router } from 'express';
import { z } from 'zod';
import { ok, fail } from '../lib/http.js';
import { terminateSessionsForUser } from '../ws/server.js';

/*
 * POST /api/v1/tutor/erasure — Product 10 E.6, Oracle's step of an account
 * erasure. Core calls it (internal key, checked by the /api/v1/tutor mount)
 * BEFORE it removes the account's rows, so no live Mentor session keeps
 * writing about a person being erased.
 *
 * Oracle holds no database and no persistent learner memory of its own —
 * memory notes, transcripts and plans live in Core's database and go with
 * the account there. What Oracle does hold is in-process: the live socket,
 * the conversation held by its orchestrator and a parked session waiting for
 * a resume. This endpoint drops exactly that, and says how much it dropped.
 */
const ErasureBody = z.object({ userId: z.uuid() }).strict();

export function erasureRouter(): Router {
  const router = Router();
  router.post('/erasure', (req, res) => {
    const parsed = ErasureBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'userId must be a uuid');
    return ok(res, terminateSessionsForUser(parsed.data.userId));
  });
  return router;
}
