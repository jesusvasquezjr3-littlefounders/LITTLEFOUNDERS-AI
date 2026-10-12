import { Router } from 'express';
import { z } from 'zod';
import { ApiError, isErrorCode, sendData } from '../lib/http.js';
import { authOf, type AuthMiddleware } from '../middleware/auth.js';
import type { Vault } from '../services/vault.js';

/*
 * Staff actions on user types. Only a superadmin reaches them, and the database checks that again
 * (core_grant_role, guard_user_roles), so a mistake in this file cannot hand out a role. Every
 * grant and every revocation is written to the audit trail by the database.
 *
 * `superadmin` itself is not granted here: docs/security/SECURITY-GUIDE.md.
 */
const RoleBody = z.object({ userId: z.uuid(), role: z.enum(['admin', 'parent']) }).strict();

export function createAdminRouter(deps: { vault: Vault; auth: AuthMiddleware }): Router {
  const { vault, auth } = deps;
  const router = Router();

  router.use(auth.requireAuth, auth.requireRole('superadmin'));

  for (const action of ['grant', 'revoke'] as const) {
    router.post(`/roles/${action}`, async (req, res) => {
      const { userId } = authOf(req);
      const body = RoleBody.safeParse(req.body);

      if (!body.success) throw new ApiError('BAD_REQUEST');

      const outcome = action === 'grant'
        ? await vault.grantRole(userId, body.data.userId, body.data.role)
        : await vault.revokeRole(userId, body.data.userId, body.data.role);

      if (!outcome.ok) throw new ApiError(outcome.error && isErrorCode(outcome.error) ? outcome.error : 'INTERNAL');

      sendData(res, { ok: true });
    });
  }

  return router;
}
