import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import {
  CONTENT_RESET_OPERATION,
  beginContentRetirement,
  contentRetirementStatus,
  finishContentRetirement,
  purgeRetiredContent,
} from '../services/contentRetirement.js';

const operation = z.literal(CONTENT_RESET_OPERATION);
const leaseId = z.uuid();
const beginBody = z.strictObject({ operation });
const leaseQuery = z.strictObject({ leaseId });
const purgeBody = z.strictObject({ operation, leaseId, backupSha256: z.string().regex(/^[0-9a-f]{64}$/i) });
const finishBody = z.strictObject({ operation, leaseId });

function maintenanceError(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : 'Warehouse maintenance failed';
  if (message.includes('already active') || message.includes('missing or expired')
      || message.includes('not ready to purge') || message.includes('has not completed')
      || message.includes('does not match') || message.includes('pinned content-reset scope')
      || message.includes('still contains')) {
    return { status: 409, code: 'CONTENT_RETIREMENT_CONFLICT', message };
  }
  return { status: 502, code: 'CONTENT_RETIREMENT_FAILED', message };
}

export function contentRetirementRouter(): Router {
  const router = Router();

  router.post('/content-retirement/begin', async (req, res) => {
    if (!beginBody.safeParse(req.body).success) return fail(res, 400, 'INVALID_REQUEST', 'Expected fixed content reset operation');
    try { return ok(res, await beginContentRetirement()); }
    catch (error) { const e = maintenanceError(error); return fail(res, e.status, e.code, e.message); }
  });

  router.get('/content-retirement/status', (req, res) => {
    const parsed = leaseQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'INVALID_REQUEST', 'Expected lease ID');
    try { return ok(res, contentRetirementStatus(parsed.data.leaseId)); }
    catch (error) { const e = maintenanceError(error); return fail(res, e.status, e.code, e.message); }
  });

  router.post('/content-retirement/purge', async (req, res) => {
    const parsed = purgeBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_REQUEST', 'Expected fixed operation, lease ID and verified backup SHA-256');
    try { return ok(res, await purgeRetiredContent(parsed.data.leaseId, parsed.data.backupSha256)); }
    catch (error) { const e = maintenanceError(error); return fail(res, e.status, e.code, e.message); }
  });

  router.post('/content-retirement/finish', async (req, res) => {
    const parsed = finishBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_REQUEST', 'Expected fixed operation and lease ID');
    try { await finishContentRetirement(parsed.data.leaseId); return ok(res, { finished: true }); }
    catch (error) { const e = maintenanceError(error); return fail(res, e.status, e.code, e.message); }
  });

  return router;
}
