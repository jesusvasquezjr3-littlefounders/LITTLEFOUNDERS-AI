import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireInternalKey, type AuthedUser } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import * as gotrue from '../services/gotrue.js';
import { readAgeScreen } from '../services/ageScreen.js';
import { getRolesForGate } from '../services/insights.js';
import { getVerifiedGuardiansOfKid, getVerifiedKidLinks, insertAuditLog } from '../services/supabaseRest.js';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  cancelDeletion,
  listSweepCandidates,
  readOpenDeletion,
  requestDeletion,
  runAccountErasure,
  type DeletionPopulation,
  type DeletionRequestRow,
} from '../services/accountDeletion.js';

/*
 * /api/v1/account/deletion — Product 10 E.6, the account holder's own
 * deletion (services/accountDeletion.ts has the lifecycle).
 *
 * WHO MAY DELETE THEMSELVES, decided here from server-side facts only:
 *   - a parent-created child (kid role) never: its verified Tutor deletes it
 *     from Family (403 KID_DELETION_BY_TUTOR);
 *   - a staff account never through this flow: a superadmin removes it after
 *     revoking the grants (403 STAFF_ACCOUNT; the database refuses too);
 *   - a guest, or a self-registered account whose age screen says under 13:
 *     erased now, after confirmation;
 *   - everyone else (adult, parent, independent teen 13-17, not yet
 *     screened): pending for ACCOUNT_DELETION_GRACE_DAYS, every session
 *     signed out, cancellable by signing back in.
 *
 * CONFIRMATION is server-side, not only a UI step: the body must carry
 * acknowledge:true, and the session must prove it is the holder — the current
 * password for a password session (checked by a real GoTrue sign-in, as
 * /auth/change-password does), or a sign-in within REAUTH_WINDOW_MS for an
 * OAuth or link session. A guest has nothing to re-enter.
 */

const REAUTH_WINDOW_MS = 15 * 60 * 1000;

const RequestBody = z
  .object({
    acknowledge: z.literal(true),
    currentPassword: z.string().min(1).max(200).optional(),
  })
  .strict();

type Eligibility =
  | { allowed: false; reason: 'kid' | 'staff' }
  | { allowed: true; population: DeletionPopulation; graceDays: number };

async function eligibility(user: AuthedUser): Promise<Eligibility | 'unavailable'> {
  const roles = await getRolesForGate(user.id);
  if (roles === null) return 'unavailable';
  if (roles.includes('kid')) return { allowed: false, reason: 'kid' };
  if (roles.includes('admin') || roles.includes('superadmin')) return { allowed: false, reason: 'staff' };
  if (user.isGuest) return { allowed: true, population: 'guest', graceDays: 0 };
  const screening = await readAgeScreen(user.id);
  if (screening === null) return 'unavailable';
  if (screening.ageBand === 'under_13') return { allowed: true, population: 'child', graceDays: 0 };
  if (roles.includes('parent')) return { allowed: true, population: 'parent', graceDays: ACCOUNT_DELETION_GRACE_DAYS };
  if (screening.ageBand === '13_to_17') return { allowed: true, population: 'teen', graceDays: ACCOUNT_DELETION_GRACE_DAYS };
  if (screening.ageBand === 'adult') return { allowed: true, population: 'adult', graceDays: ACCOUNT_DELETION_GRACE_DAYS };
  return { allowed: true, population: 'unscreened', graceDays: ACCOUNT_DELETION_GRACE_DAYS };
}

function reauthKind(user: AuthedUser): 'password' | 'recent_sign_in' | 'none' {
  if (user.isGuest) return 'none';
  return user.amr.some((entry) => entry.method === 'password') ? 'password' : 'recent_sign_in';
}

function recentlySignedIn(user: AuthedUser, now = Date.now()): boolean {
  const latest = Math.max(0, ...user.amr.map((entry) => (Number.isFinite(entry.timestamp) ? entry.timestamp * 1000 : 0)));
  return latest > 0 && now - latest <= REAUTH_WINDOW_MS && latest <= now + 60_000;
}

/** For a parent: how many linked children this account supervises alone (they will be paused, A.1) or with another Tutor. */
async function childImpact(userId: string): Promise<{ lastTutorOf: number; sharedTutorOf: number } | null> {
  const links = await getVerifiedKidLinks(userId);
  if (links === null) return null;
  let lastTutorOf = 0;
  let sharedTutorOf = 0;
  for (const link of links) {
    const guardians = await getVerifiedGuardiansOfKid(link.kid_user_id);
    if (guardians === null) return null;
    if (guardians.some((id) => id !== userId)) sharedTutorOf += 1;
    else lastTutorOf += 1;
  }
  return { lastTutorOf, sharedTutorOf };
}

function publicDeletion(row: DeletionRequestRow) {
  return {
    status: row.status,
    requestedAt: row.requested_at,
    scheduledFor: row.scheduled_for,
    held: row.status === 'held',
  };
}

export function accountRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/deletion', async (_req, res) => {
    const user = authedUser(res);
    const [open, allowed] = await Promise.all([readOpenDeletion(user.id), eligibility(user)]);
    if (open === 'unavailable' || allowed === 'unavailable') {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the account deletion state');
    }
    let children: { lastTutorOf: number; sharedTutorOf: number } = { lastTutorOf: 0, sharedTutorOf: 0 };
    if (allowed.allowed && allowed.population === 'parent') {
      const impact = await childImpact(user.id);
      if (impact === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the linked children');
      children = impact;
    }
    return ok(res, {
      deletion: open === null ? null : publicDeletion(open),
      eligibility: allowed.allowed
        ? {
            allowed: true,
            population: allowed.population,
            graceDays: allowed.graceDays,
            immediate: allowed.graceDays === 0,
            reauth: reauthKind(user),
            children,
          }
        : { allowed: false, reason: allowed.reason },
    });
  });

  router.post('/deletion', authRateLimiter, async (req, res) => {
    const parsed = RequestBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Confirm the deletion to continue');
    const user = authedUser(res);

    const allowed = await eligibility(user);
    if (allowed === 'unavailable') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify the account');
    if (!allowed.allowed) {
      return allowed.reason === 'kid'
        ? fail(res, 403, 'KID_DELETION_BY_TUTOR', 'A child account is deleted by its Tutor')
        : fail(res, 403, 'STAFF_ACCOUNT', 'A staff account is removed by a superadmin');
    }

    const reauth = reauthKind(user);
    if (reauth === 'password') {
      if (!parsed.data.currentPassword) return fail(res, 401, 'REAUTH_REQUIRED', 'Enter your password to confirm');
      const { error } = await gotrue.signInWithPassword(user.email, parsed.data.currentPassword);
      if (error) return fail(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    } else if (reauth === 'recent_sign_in' && !recentlySignedIn(user)) {
      return fail(res, 401, 'REAUTH_REQUIRED', 'Sign in again to confirm');
    }

    const created = await requestDeletion({
      subjectId: user.id,
      population: allowed.population,
      initiatedBy: 'self',
      graceDays: allowed.graceDays,
      actorId: user.id,
    });
    if ('error' in created) {
      if (created.error === 'DELETION_ALREADY_OPEN') return fail(res, 409, 'DELETION_ALREADY_OPEN', 'A deletion is already scheduled');
      if (created.error === 'STAFF_ACCOUNT') return fail(res, 403, 'STAFF_ACCOUNT', 'A staff account is removed by a superadmin');
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not schedule the deletion');
    }

    if (allowed.graceDays === 0) {
      const outcome = await runAccountErasure(created.row.id);
      return ok(res, {
        status: outcome.status === 'completed' ? 'completed' : outcome.status === 'held' ? 'held' : outcome.accountErased ? 'finishing' : 'processing',
        requestedAt: created.row.requested_at,
        scheduledFor: created.row.scheduled_for,
        population: allowed.population,
      });
    }

    // Signed out everywhere: a session that asked for deletion (or one stolen
    // from this person) stops here, and keeping the account needs a sign-in.
    const revoked = await gotrue.adminRevokeUserSessions(user.id);
    if (revoked.error) console.error(`[account-deletion] session revocation failed for ${user.id}; the request stands`);
    return ok(res, {
      status: 'pending',
      requestedAt: created.row.requested_at,
      scheduledFor: created.row.scheduled_for,
      population: allowed.population,
      graceDays: allowed.graceDays,
      signedOut: revoked.error === null,
    }, 202);
  });

  router.delete('/deletion', async (_req, res) => {
    const user = authedUser(res);
    const cancelled = await cancelDeletion(user.id);
    if ('error' in cancelled) {
      if (cancelled.error === 'NO_OPEN_DELETION') return fail(res, 404, 'NO_OPEN_DELETION', 'No deletion is scheduled');
      if (cancelled.error === 'DELETION_IN_PROGRESS') return fail(res, 409, 'DELETION_IN_PROGRESS', 'The deletion has already started');
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not cancel the deletion');
    }
    return ok(res, { status: 'cancelled', cancelledAt: cancelled.row.cancelled_at });
  });

  return router;
}

/*
 * POST /api/v1/internal/account-deletions/run — the daily sweep
 * (.github/workflows/account-deletion.yml). Runs every due self-service
 * request, re-checks held ones and resumes any erasure whose step failed.
 * Audited on every run, including a run that found nothing: "ran and found
 * nothing" and "never ran" must stay distinguishable (§1.14). An unreadable
 * candidate list is a 502, never a reassuring zero.
 */
export const ACCOUNT_DELETION_SWEEP_AUDIT_ACTION = 'account_deletions.sweep_ran';

const SweepBody = z.object({ limit: z.number().int().min(1).max(200).default(50) }).strict();

export function accountDeletionSweepRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  router.post('/run', async (req, res) => {
    const parsed = SweepBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body');
    const ids = await listSweepCandidates(parsed.data.limit);
    if (ids === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'The deletion sweep could not read the requests');

    const counts = { scanned: ids.length, completed: 0, held: 0, retrying: 0, skipped: 0 };
    for (const id of ids) {
      const outcome = await runAccountErasure(id);
      if (outcome.status === 'completed') counts.completed += 1;
      else if (outcome.status === 'held') counts.held += 1;
      else if (outcome.status === 'processing') counts.retrying += 1;
      else counts.skipped += 1;
    }
    const audited = await insertAuditLog(null, ACCOUNT_DELETION_SWEEP_AUDIT_ACTION, 'account_deletion_requests', { ...counts, limit: parsed.data.limit });
    if (!audited) console.error('[account-deletion] sweep audit write FAILED — the sweep ran but will not show as having run');
    return ok(res, { ...counts, limit: parsed.data.limit, complete: ids.length < parsed.data.limit });
  });

  return router;
}
