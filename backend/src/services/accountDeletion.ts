import { z } from 'zod';
import { getConfig } from '../config.js';
import { insertAuditLog, serviceRest, serviceRestRaw } from './supabaseRest.js';
import { extractBucketAndFile } from './tutorRetention.js';

/*
 * Product 10 E.6 — account deletion, one lifecycle for every path.
 *
 * Self-service (adults, parents, independent teens, unscreened accounts):
 * a request is PENDING for ACCOUNT_DELETION_GRACE_DAYS, every session is
 * signed out, and signing back in before the date lets the holder keep the
 * account. Guests and self-registered under-13 accounts are erased at once
 * (a guest cannot come back to cancel, and holding a child's data for a
 * window nobody can use is the worse outcome). A parent-created child is
 * never deleted by the child: its verified Tutor deletes it (family.ts), and
 * A.1's 90-day suspension purge runs through this same lifecycle.
 *
 * THE ERASURE is four recorded steps, each idempotent, retried by the daily
 * sweep until all four are recorded:
 *   oracle     end any live or parked Mentor session of the account, so no
 *              turn is written back after the rows are gone
 *   core       one database transaction (migration account_erasure_function):
 *              inventory, non-cascading rows, links (A.1 suspension), the
 *              auth.users row and everything that cascades from it
 *   depot      delete every stored object the inventory named
 *   dataintel  drop the account's rows from the analytics warehouse
 * complete_account_deletion refuses to mark a request completed while any
 * step is missing, so "completed" always means all four happened.
 *
 * Every read that decides something is shape-validated, and an unreadable
 * answer is 'unavailable', never "no request" (§1.14).
 */

export const ACCOUNT_DELETION_GRACE_DAYS = 14;
/** Completion SLA for Appendix J's Deletion-Request Clarity metric: within this long of the stated date. */
export const ACCOUNT_DELETION_SLA_HOURS = 48;

export const DeletionPopulation = z.enum(['adult', 'parent', 'teen', 'unscreened', 'guest', 'child', 'kid']);
export type DeletionPopulation = z.infer<typeof DeletionPopulation>;
export const DeletionInitiator = z.enum(['self', 'guardian', 'suspension_expiry']);
export type DeletionInitiator = z.infer<typeof DeletionInitiator>;
export const DeletionStatus = z.enum(['pending', 'processing', 'held', 'completed', 'cancelled']);
export type DeletionStatus = z.infer<typeof DeletionStatus>;

const timestamp = z.string().datetime({ offset: true });

export const DeletionRequestRow = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  population: DeletionPopulation,
  initiated_by: DeletionInitiator,
  status: DeletionStatus,
  requested_at: timestamp,
  scheduled_for: timestamp,
  started_at: timestamp.nullable(),
  attempts: z.number().int().min(0),
  held_reason: z.literal('open_safety_review').nullable(),
  steps: z.record(z.string(), z.unknown()),
  depot_paths: z.array(z.string()),
  anon_ids: z.array(z.string().uuid()),
  last_error: z.string().nullable(),
  cancelled_at: timestamp.nullable(),
  completed_at: timestamp.nullable(),
});
export type DeletionRequestRow = z.infer<typeof DeletionRequestRow>;

const OPEN = 'pending,processing,held';
const eu = encodeURIComponent;

/** The account's open request (pending, processing or held), null when there is none, 'unavailable' when unreadable. */
export async function readOpenDeletion(subjectId: string): Promise<DeletionRequestRow | null | 'unavailable'> {
  if (!z.string().uuid().safeParse(subjectId).success) return 'unavailable';
  const rows = await serviceRest<unknown>(
    `/account_deletion_requests?subject_id=eq.${eu(subjectId)}&status=in.(${OPEN})&select=*&limit=1`,
  );
  const parsed = z.array(DeletionRequestRow).max(1).safeParse(rows);
  if (!parsed.success) return 'unavailable';
  return parsed.data[0] ?? null;
}

type RpcFailure<Code extends string> = { error: Code | 'unavailable' };

function rpcError<Code extends string>(body: unknown, known: readonly Code[]): Code | 'unavailable' {
  const parsed = z.object({ code: z.literal('P0001'), message: z.string() }).safeParse(body);
  if (!parsed.success) return 'unavailable';
  return (known as readonly string[]).includes(parsed.data.message) ? parsed.data.message as Code : 'unavailable';
}

/** A composite RPC result: PostgREST answers a NULL row as null or as an object of nulls. */
function rowOrNull(body: unknown): DeletionRequestRow | null | 'invalid' {
  if (body === null) return null;
  if (typeof body === 'object' && body !== null && (body as Record<string, unknown>).id === null) return null;
  const parsed = DeletionRequestRow.safeParse(body);
  return parsed.success ? parsed.data : 'invalid';
}

export async function requestDeletion(input: {
  subjectId: string;
  population: DeletionPopulation;
  initiatedBy: DeletionInitiator;
  graceDays: number;
  actorId: string | null;
}): Promise<{ row: DeletionRequestRow } | RpcFailure<'DELETION_ALREADY_OPEN' | 'STAFF_ACCOUNT' | 'NO_SUCH_ACCOUNT'>> {
  const raw = await serviceRestRaw('/rpc/request_account_deletion', {
    method: 'POST',
    body: JSON.stringify({
      p_subject: input.subjectId,
      p_population: input.population,
      p_initiated_by: input.initiatedBy,
      p_grace_days: input.graceDays,
      p_actor: input.actorId,
    }),
  });
  if (!raw.ok) return { error: rpcError(raw.body, ['DELETION_ALREADY_OPEN', 'STAFF_ACCOUNT', 'NO_SUCH_ACCOUNT'] as const) };
  const row = rowOrNull(raw.body);
  return row === null || row === 'invalid' ? { error: 'unavailable' } : { row };
}

export async function cancelDeletion(subjectId: string): Promise<{ row: DeletionRequestRow } | RpcFailure<'DELETION_IN_PROGRESS' | 'NO_OPEN_DELETION'>> {
  const raw = await serviceRestRaw('/rpc/cancel_account_deletion', {
    method: 'POST',
    body: JSON.stringify({ p_subject: subjectId }),
  });
  if (!raw.ok) return { error: rpcError(raw.body, ['DELETION_IN_PROGRESS', 'NO_OPEN_DELETION'] as const) };
  const row = rowOrNull(raw.body);
  return row === null || row === 'invalid' ? { error: 'unavailable' } : { row };
}

async function claim(requestId: string): Promise<DeletionRequestRow | null | 'unavailable'> {
  const raw = await serviceRestRaw('/rpc/claim_account_deletion', {
    method: 'POST',
    body: JSON.stringify({ p_request: requestId }),
  });
  if (!raw.ok) return 'unavailable';
  const row = rowOrNull(raw.body);
  return row === 'invalid' ? 'unavailable' : row;
}

async function readRequest(requestId: string): Promise<DeletionRequestRow | null> {
  const rows = await serviceRest<unknown>(`/account_deletion_requests?id=eq.${eu(requestId)}&select=*&limit=1`);
  const parsed = z.array(DeletionRequestRow).max(1).safeParse(rows);
  return parsed.success ? parsed.data[0] ?? null : null;
}

type StepName = 'oracle' | 'core' | 'depot' | 'dataintel';

async function recordStep(requestId: string, step: StepName, result: Record<string, unknown> | null, error: string | null, depotPaths?: string[]): Promise<boolean> {
  const raw = await serviceRestRaw('/rpc/record_account_deletion_step', {
    method: 'POST',
    body: JSON.stringify({
      p_request: requestId,
      p_step: step,
      p_result: result,
      p_error: error,
      p_depot_paths: depotPaths ?? null,
    }),
  });
  return raw.ok && raw.body === true;
}

/* ── the cross-service steps ─────────────────────────────────────────────── */

const OracleErasure = z.object({ data: z.object({ live: z.number().int().min(0), parked: z.number().int().min(0) }) });

async function oracleStep(userId: string): Promise<Record<string, unknown> | string> {
  const { ORACLE_URL, ORACLE_INTERNAL_KEY, ORACLE_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${ORACLE_URL}/api/v1/tutor/erasure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': ORACLE_INTERNAL_KEY },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(ORACLE_TIMEOUT_MS),
    });
    if (!res.ok) return `status ${res.status}`;
    const parsed = OracleErasure.safeParse(await res.json().catch(() => null));
    return parsed.success ? parsed.data.data : 'unexpected response';
  } catch {
    return 'unreachable';
  }
}

const CoreErasure = z.record(z.string(), z.number().int());

async function coreStep(requestId: string): Promise<Record<string, number> | string> {
  const raw = await serviceRestRaw('/rpc/erase_account_data', {
    method: 'POST',
    body: JSON.stringify({ p_request: requestId }),
  });
  if (!raw.ok) {
    const code = z.object({ message: z.string() }).safeParse(raw.body);
    return code.success ? code.data.message.slice(0, 120) : 'unreachable';
  }
  const parsed = CoreErasure.safeParse(raw.body);
  return parsed.success ? parsed.data : 'unexpected response';
}

async function deleteDepotObject(path: string): Promise<boolean> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  const tail = extractBucketAndFile(path);
  if (!tail) return false;
  try {
    const res = await fetch(`${FILEBASE_URL}/api/v1/files/${tail}`, {
      method: 'DELETE',
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    // 404: already gone, which is the state the erasure wants.
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const DataintelErasure = z.object({ data: z.record(z.string(), z.number().int().min(0)) });

async function dataintelStep(userId: string, anonIds: string[]): Promise<Record<string, unknown> | string> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/erasure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
      body: JSON.stringify({ userId, anonIds }),
      signal: AbortSignal.timeout(DATAINTEL_TIMEOUT_MS),
    });
    if (!res.ok) return `status ${res.status}`;
    const parsed = DataintelErasure.safeParse(await res.json().catch(() => null));
    return parsed.success ? parsed.data.data : 'unexpected response';
  } catch {
    return 'unreachable';
  }
}

export interface ErasureOutcome {
  /** completed: all four steps recorded; held: an open safety review; processing: a step failed and the sweep retries; skipped: nothing to do now. */
  status: 'completed' | 'held' | 'processing' | 'skipped';
  /** True once the core step removed the account (the rest is cleanup elsewhere). */
  accountErased: boolean;
  failedStep?: 'claim' | 'oracle' | 'core' | 'depot' | 'dataintel' | 'complete';
}

async function stepFailed(row: DeletionRequestRow, step: NonNullable<ErasureOutcome['failedStep']>, reason: string, accountErased: boolean): Promise<ErasureOutcome> {
  console.error(`[account-deletion] request ${row.id}: step ${step} failed (${reason}); the daily sweep retries it`);
  await insertAuditLog(null, 'account.deletion_step_failed', row.subject_id, { request_id: row.id, step, reason });
  return { status: 'processing', accountErased, failedStep: step };
}

/**
 * Runs (or resumes) one erasure. Safe to call repeatedly and concurrently:
 * the claim is exclusive for ten minutes and every step is idempotent.
 */
export async function runAccountErasure(requestId: string): Promise<ErasureOutcome> {
  const claimed = await claim(requestId);
  if (claimed === 'unavailable') {
    console.error(`[account-deletion] request ${requestId}: claim unavailable`);
    return { status: 'processing', accountErased: false, failedStep: 'claim' };
  }
  if (claimed === null) return { status: 'skipped', accountErased: false };
  if (claimed.status === 'held') return { status: 'held', accountErased: false };
  let row = claimed;

  if (!('oracle' in row.steps)) {
    const oracle = await oracleStep(row.subject_id);
    if (typeof oracle === 'string') {
      await recordStep(row.id, 'oracle', null, oracle);
      return stepFailed(row, 'oracle', oracle, false);
    }
    if (!(await recordStep(row.id, 'oracle', oracle, null))) return stepFailed(row, 'oracle', 'record failed', false);
  }

  if (!('core' in row.steps)) {
    const core = await coreStep(row.id);
    if (typeof core === 'string') {
      await recordStep(row.id, 'core', null, core);
      return stepFailed(row, 'core', core, false);
    }
    const reread = await readRequest(row.id);
    if (!reread) return stepFailed(row, 'core', 'request unreadable after erasure', true);
    row = reread;
  }

  if (!('depot' in row.steps)) {
    const failed: string[] = [];
    let deleted = 0;
    // Sequential: Depot also serves lesson audio, and nothing waits on this.
    for (const path of row.depot_paths) {
      if (await deleteDepotObject(path)) deleted += 1;
      else failed.push(path);
    }
    if (failed.length > 0) {
      await recordStep(row.id, 'depot', null, `${failed.length} object(s) not deleted`, failed);
      return stepFailed(row, 'depot', `${failed.length} object(s) not deleted`, true);
    }
    if (!(await recordStep(row.id, 'depot', { deleted }, null, []))) return stepFailed(row, 'depot', 'record failed', true);
  }

  if (!('dataintel' in row.steps)) {
    const warehouse = await dataintelStep(row.subject_id, row.anon_ids);
    if (typeof warehouse === 'string') {
      await recordStep(row.id, 'dataintel', null, warehouse);
      return stepFailed(row, 'dataintel', warehouse, true);
    }
    if (!(await recordStep(row.id, 'dataintel', warehouse, null))) return stepFailed(row, 'dataintel', 'record failed', true);
  }

  const done = await serviceRestRaw('/rpc/complete_account_deletion', {
    method: 'POST',
    body: JSON.stringify({ p_request: row.id }),
  });
  if (!done.ok) return stepFailed(row, 'complete', 'completion refused', true);
  return { status: 'completed', accountErased: true };
}

/**
 * Request an immediate erasure (guardian or suspension purge) and run it,
 * reusing an erasure already open for the same account.
 */
export async function eraseNow(input: {
  subjectId: string;
  population: DeletionPopulation;
  initiatedBy: DeletionInitiator;
  actorId: string | null;
}): Promise<ErasureOutcome | 'staff' | 'unavailable'> {
  const created = await requestDeletion({ ...input, graceDays: 0 });
  if ('row' in created) return runAccountErasure(created.row.id);
  if (created.error === 'STAFF_ACCOUNT') return 'staff';
  if (created.error === 'NO_SUCH_ACCOUNT') return { status: 'completed', accountErased: true };
  if (created.error === 'DELETION_ALREADY_OPEN') {
    const open = await readOpenDeletion(input.subjectId);
    if (open === 'unavailable' || open === null) return 'unavailable';
    return runAccountErasure(open.id);
  }
  return 'unavailable';
}

/**
 * Ids the sweep should look at: due pending requests and stale processing
 * claims first, then held ones (re-check the review) with whatever room is
 * left, so a long safety-review queue can never starve a due erasure.
 */
export async function listSweepCandidates(limit: number, now: Date = new Date()): Promise<string[] | null> {
  const nowIso = now.toISOString();
  const stale = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const Ids = z.array(z.object({ id: z.string().uuid() }));
  const filter = `or=(and(status.eq.pending,scheduled_for.lte."${nowIso}"),and(status.eq.processing,started_at.lte."${stale}"))`;
  const due = Ids.safeParse(await serviceRest<unknown>(
    `/account_deletion_requests?select=id&${encodeURI(filter)}&order=scheduled_for.asc&limit=${limit}`,
  ));
  if (!due.success) return null;
  const room = limit - due.data.length;
  if (room <= 0) return due.data.map((row) => row.id);
  const held = Ids.safeParse(await serviceRest<unknown>(
    `/account_deletion_requests?select=id&status=eq.held&order=scheduled_for.asc&limit=${room}`,
  ));
  if (!held.success) return null;
  return [...due.data, ...held.data].map((row) => row.id);
}
