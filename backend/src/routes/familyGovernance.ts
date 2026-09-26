import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireInternalKey, requireRole } from '../middleware/auth.js';
import { requireWalletAccess } from '../middleware/walletAccess.js';
import { getVerifiedKidLinks, insertAuditLog } from '../services/supabaseRest.js';
import { isRefusal, UNAVAILABLE } from '../services/familyLifecycle.js';
import { DATA_POLICY, runFamilyRetention } from '../services/familyRetention.js';
import { deliverTip, markTip, reviewedTipIds, toWireTip } from '../services/parentCoaching.js';
import { BRIDGE_MILESTONES, BRIDGE_STEPS, markBridge, readBridge, toWireBridge } from '../services/moneyBridge.js';
import { readResearch, RESEARCH_DISCLOSURE_VERSION, setResearch, toWireResearch } from '../services/familyResearch.js';

/*
 * /api/v1/family-hub — S07.7, the governance half of Block D:
 *
 *   GET  /coaching                     D.23  this month's reviewed tip (Tutor)
 *   POST /coaching/:id/opened|dismissed D.23  the Tutor read or closed it
 *   GET  /data-policy                  D.21  how long each kind of data is kept
 *   GET  /kids/:kidId/research         D.22  a child's research participation (their Tutor)
 *   PUT  /kids/:kidId/research         D.22  the Tutor says yes or no
 *   GET  /research/me                  D.22  the participant's own view
 *   PUT  /research/me                  D.22  a no from the participant (a child's own no
 *                                            counts); a yes only from an adult
 *   GET  /bridge                       D.19  the older-teen bridge (wallet holders)
 *   POST /bridge                       D.19  tick or untick one checklist entry
 *   POST /internal/retention/run       D.21  the nightly sweep and photo purge
 *
 * The database decides every rule (eligibility by age evidence, who may say
 * yes, which tip may be delivered, what is past its period). Core admits by
 * role first, passes the CALLER as actor (never a body field), and maps each
 * named refusal. A failed read is 502, never a decision.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const NOT_FOUND = 'NOT_FOUND';

const REFUSALS: Record<string, { status: number; message: string }> = {
  COACHING_NOT_ELIGIBLE: { status: 403, message: 'Coaching is for a verified Tutor' },
  COACHING_NOT_FOUND: { status: 404, message: 'No such tip' },
  BRIDGE_NOT_ELIGIBLE: { status: 403, message: 'This opens at 15' },
  BRIDGE_MOMENT_FIRST: { status: 409, message: 'Mark the moment first' },
  BRIDGE_ENTRY_INVALID: { status: 400, message: 'Check the moment and the step' },
  RESEARCH_CONSENT_NOT_ALLOWED: { status: 403, message: 'This account cannot give that answer' },
  RESEARCH_DISCLOSURE_STALE: { status: 409, message: 'Read the latest description first' },
};

function refuse(res: Parameters<typeof fail>[0], refused: string) {
  const known = REFUSALS[refused];
  return known ? fail(res, known.status, refused, known.message) : fail(res, 502, DATA_UNAVAILABLE, 'The request was refused');
}

const uuid = z.string().uuid();

export function familyGovernanceRouter(): Router {
  const router = Router();

  // ── Internal: the nightly retention job (never a browser) ──────────────
  const RunBody = z.object({ limit: z.number().int().min(1).max(1000).optional() }).strict();
  router.post('/internal/retention/run', requireInternalKey, async (req, res) => {
    const body = RunBody.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit must be 1 to 1000');
    const run = await runFamilyRetention(body.data.limit);
    // NOT "nothing was due": an unreachable database is how a retention
    // promise quietly becomes forever.
    if (!run) return fail(res, 502, DATA_UNAVAILABLE, 'The retention sweep could not run');
    if (run.evidence.failed > 0) console.error(`[family-retention] run ${run.runId}: ${run.evidence.failed} photo(s) wait for the next night`);
    const audited = await insertAuditLog(null, 'family.retention_sweep', 'family_retention_runs', { runId: run.runId, removed: run.removed, evidence: run.evidence });
    if (!audited) console.error('[family-retention] the sweep ran but its audit row was not written');
    return ok(res, run);
  });

  router.use(requireAuth);

  async function isTutorOf(parentId: string, kidId: string): Promise<boolean | null> {
    const links = await getVerifiedKidLinks(parentId);
    if (links === null) return null;
    return links.some((l) => l.kid_user_id === kidId);
  }

  // ── D.23: the monthly tip ───────────────────────────────────────────────
  router.get('/coaching', requireRole(['parent']), async (_req, res) => {
    const tutor = authedUser(res);
    const reviewed = reviewedTipIds();
    const row = await deliverTip(tutor.id, reviewed);
    if (row === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the tip');
    if (isRefusal(row)) return refuse(res, row.refused);
    return ok(res, { tip: row ? toWireTip(row) : null });
  });

  const markTipRoute = (action: 'opened' | 'dismissed'): RequestHandler => async (req, res) => {
    const tutor = authedUser(res);
    const id = uuid.safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const row = await markTip(id.data, tutor.id, action);
    if (row === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record it');
    if (isRefusal(row)) return refuse(res, row.refused);
    return ok(res, { tip: toWireTip(row) });
  };
  router.post('/coaching/:id/opened', requireRole(['parent']), markTipRoute('opened'));
  router.post('/coaching/:id/dismissed', requireRole(['parent']), markTipRoute('dismissed'));

  // ── D.21: what a family is told, from the numbers the database enforces ─
  router.get('/data-policy', (_req, res) => ok(res, { classes: DATA_POLICY }));

  // ── D.22: research participation ───────────────────────────────────────
  router.get('/kids/:kidId/research', requireRole(['parent']), async (req, res) => {
    const tutor = authedUser(res);
    const kidId = uuid.safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const linked = await isTutorOf(tutor.id, kidId.data);
    if (linked === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!linked) return fail(res, 404, NOT_FOUND, 'No such child for this account');
    const state = await readResearch(kidId.data);
    if (state === UNAVAILABLE || isRefusal(state)) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load research participation');
    return ok(res, { research: toWireResearch(state), currentVersion: RESEARCH_DISCLOSURE_VERSION });
  });

  const SetResearch = z.object({ participate: z.boolean(), disclosureVersion: z.number().int().min(1).optional() }).strict()
    .refine((v) => !v.participate || v.disclosureVersion !== undefined, { message: 'A yes names the description it answers' });

  router.put('/kids/:kidId/research', requireRole(['parent']), async (req, res) => {
    const tutor = authedUser(res);
    const kidId = uuid.safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const body = SetResearch.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'participate must be a boolean; a yes names the description version');
    const linked = await isTutorOf(tutor.id, kidId.data);
    if (linked === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!linked) return fail(res, 404, NOT_FOUND, 'No such child for this account');
    const state = await setResearch(kidId.data, tutor.id, body.data.participate, body.data.disclosureVersion ?? RESEARCH_DISCLOSURE_VERSION);
    if (state === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the answer');
    if (isRefusal(state)) return refuse(res, state.refused);
    await insertAuditLog(tutor.id, body.data.participate ? 'family.research_yes' : 'family.research_no', kidId.data, { version: body.data.disclosureVersion ?? null });
    return ok(res, { research: toWireResearch(state), currentVersion: RESEARCH_DISCLOSURE_VERSION });
  });

  router.get('/research/me', requireWalletAccess('holder'), async (_req, res) => {
    const me = authedUser(res);
    const state = await readResearch(me.id);
    if (state === UNAVAILABLE || isRefusal(state)) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load research participation');
    return ok(res, { research: toWireResearch(state), currentVersion: RESEARCH_DISCLOSURE_VERSION });
  });

  router.put('/research/me', requireWalletAccess('holder'), async (req, res) => {
    const me = authedUser(res);
    const body = SetResearch.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'participate must be a boolean; a yes names the description version');
    const state = await setResearch(me.id, me.id, body.data.participate, body.data.disclosureVersion ?? RESEARCH_DISCLOSURE_VERSION);
    if (state === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the answer');
    if (isRefusal(state)) return refuse(res, state.refused);
    await insertAuditLog(me.id, body.data.participate ? 'family.research_yes_self' : 'family.research_no_self', me.id, {});
    return ok(res, { research: toWireResearch(state), currentVersion: RESEARCH_DISCLOSURE_VERSION });
  });

  // ── D.19: the older-teen bridge ─────────────────────────────────────────
  router.get('/bridge', requireWalletAccess('holder'), async (_req, res) => {
    const me = authedUser(res);
    const state = await readBridge(me.id);
    if (state === UNAVAILABLE || isRefusal(state)) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the bridge');
    return ok(res, toWireBridge(state));
  });

  const MarkBridge = z.object({ milestone: z.enum(BRIDGE_MILESTONES), step: z.number().int().min(0).max(BRIDGE_STEPS), done: z.boolean() }).strict();
  router.post('/bridge', requireWalletAccess('holder'), async (req, res) => {
    const me = authedUser(res);
    const body = MarkBridge.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'A moment, a step from 0 to 3 and done');
    const state = await markBridge(me.id, body.data.milestone, body.data.step, body.data.done);
    if (state === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save it');
    if (isRefusal(state)) return refuse(res, state.refused);
    return ok(res, toWireBridge(state));
  });

  return router;
}
