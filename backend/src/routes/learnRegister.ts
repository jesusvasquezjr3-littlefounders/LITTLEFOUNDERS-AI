import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser } from '../middleware/auth.js';
import type { AgeScreenState } from '../services/ageScreen.js';
import { acknowledgeGraduation, noteLearnerRegister, resolveLearnerRegister } from '../services/learnerRegister.js';
import { LEARNER_REGISTER_POLICY_VERSION, REGISTERS } from '../services/learnerRegisterPolicy.js';

/*
 * /api/v1/learn/register (S05.3f, B.23). Mounted inside learnRouter, behind
 * its requireAuth + requireAgeScreen. Only the caller's own register: there is
 * no id in any path, and the client never states its age or band.
 *
 * GET  /register             the register Core resolved from age evidence, the
 *                            policy version the UI must match, and the
 *                            graduation still owed (shown once, never a
 *                            celebration: OD-7's list does not include it).
 * POST /register/graduation  the learner acknowledges the graduation into the
 *                            register they are in now. 404 when none is owed.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const GraduationBody = z.object({ register: z.enum(['transition', 'teen']) }).strict();

export function learnRegisterRouter(): Router {
  const router = Router();

  router.get('/register', async (req, res) => {
    if (Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'This read takes no parameters');
    const user = authedUser(res);
    const register = await resolveLearnerRegister(user.id, res.locals.ageScreen as AgeScreenState);
    if (!register) return fail(res, 502, DATA_UNAVAILABLE, 'Could not resolve your register');
    const status = await noteLearnerRegister(user.id, register);
    if (!status) return fail(res, 502, DATA_UNAVAILABLE, 'Could not resolve your register');
    return ok(res, {
      register,
      copy_band: REGISTERS[register].copyBand,
      policy_version: LEARNER_REGISTER_POLICY_VERSION,
      graduation: status.graduation,
    });
  });

  router.post('/register/graduation', async (req, res) => {
    const body = GraduationBody.safeParse(req.body);
    if (!body.success || Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'register must be transition or teen');
    const user = authedUser(res);
    const current = await resolveLearnerRegister(user.id, res.locals.ageScreen as AgeScreenState);
    if (!current) return fail(res, 502, DATA_UNAVAILABLE, 'Could not resolve your register');
    // Only the graduation into the register the learner is in now; a client cannot skip ahead.
    if (current !== body.data.register) return fail(res, 404, 'NO_GRADUATION', 'There is no graduation to acknowledge');
    const acknowledged = await acknowledgeGraduation(user.id, current);
    if (acknowledged === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save');
    if (!acknowledged) return fail(res, 404, 'NO_GRADUATION', 'There is no graduation to acknowledge');
    return ok(res, { acknowledged: true, register: current });
  });

  return router;
}
