import { z } from 'zod';
import { insertAuditLog, serviceRest } from './supabaseRest.js';
import { getOverdueRetroChecks, RETRO_CHECK_DAYS } from './contentRelease.js';
import { getTutorRetentionStatus, RETENTION_STALE_HOURS, type TutorRetentionStatus } from './tutorData.js';
import { ACCESS_REVIEW_CADENCE_DAYS, getAccessReviewCounts } from './adminData.js';
import { ACCOUNT_DELETION_SWEEP_AUDIT_ACTION } from '../routes/account.js';
import { getUndeliveredAlerts, type UndeliveredAlertsStatus } from './warehouseAlerts.js';
import { getWarehouseMaintenance, type WarehouseMaintenanceStepStatus } from './warehouseMaintenance.js';

/*
 * H.4 and Appendix O 1.3 / 2.3: the watchdog-plus-notification pattern the
 * Mentor retention sweep already has (tutorData.ts getTutorRetentionStatus +
 * tutor-retention-watch.yml), extended to the daily database backups and the
 * schema drift probe.
 *
 * Each scheduled job ends by calling Core's internal-key heartbeat
 * (POST /api/v1/internal/ops/heartbeat) from INSIDE the Core container, the
 * way tutor-retention.yml reaches Core. The heartbeat writes
 * `ops.<job>.completed` to audit_logs with a SYSTEM actor (null): the
 * durable, append-only trail no job can rewrite. A job that stops running
 * writes nothing, which is exactly what the status below turns into
 * `stale: true`; .github/workflows/ops-job-watch.yml reads that boolean and
 * fails (and notifies) on it.
 *
 * ONE HOME FOR EACH STALENESS CONSTANT (the lesson tutor-retention-watch.yml
 * records): OPS_JOB_STALE_HOURS below. The watch workflow and the staff
 * console read `stale`, they never re-derive it.
 *
 * GAP-FIX-R3 (Appendix O 1.3 names three jobs: the Mentor retention sweep,
 * the backup and the drift probe): the retention sweep rides on the same
 * notification path. It records its own trail (`tutor.retention.swept`, not a
 * heartbeat) and its window keeps its one home, RETENTION_STALE_HOURS in
 * tutorData.ts; the status below carries it as `tutorRetention`, a fourth
 * watched job, built from getTutorRetentionStatus(). It sits beside `jobs`,
 * not inside it, because the staff console shows it on its own card and
 * `jobs` stays the heartbeat jobs.
 *
 * G.4 (quarterly access review, Appendix N 1.1): the number of elevated
 * grants past the 90-day review cadence rides here too (`accessReviews`), so
 * a due review reaches the watchdog issue instead of waiting for a
 * superadmin to open Roles & Access. It also carries `total` (every elevated
 * grant held), which the calendar-quarter review issue
 * (access-review-quarterly.yml) puts in front of the staff/access owner.
 *
 * H.3 (GAP-FIX-R6): the warehouse alert triggers that reached nobody in the
 * last 36 hours ride here as `alerts.undelivered` (services/warehouseAlerts.ts),
 * so an alert that notified nobody fails the watch and is named on the
 * watchdog issue. An unreadable warehouse is `undelivered: null`, which the
 * watcher refuses, without hiding the other jobs' verdicts.
 */

/*
 * GAP-FIX-R6 (H.4 and the Block H non-negotiable: no job whose silent failure
 * would harm family data may lack the watchdog-plus-notification pattern):
 * five more jobs keep promises made to families and are watched here too.
 *
 *   heartbeat jobs (report through POST /internal/ops/heartbeat, like the
 *   backups):
 *     learning_retention  learning-retention.yml, the 400-day practice days
 *     insights_prune      insights-maintenance.yml, prune_learning_events(400),
 *                         the H.2 raw-event window itself
 *   trail jobs (already leave their own durable record; read, never re-written):
 *     account_deletions   account-deletion.yml (E.6 erasure, A.1's 90-day
 *                         paused-child promise): `account_deletions.sweep_ran`;
 *                         a run whose paused-child candidates were unreadable
 *                         (`suspensionsUnreadable`) is a failed attempt
 *     family_retention    family-retention.yml (D.21): family_retention_runs.ran_at
 *     social_retention    social-retention.yml (E.11): `social_retention.sweep_ran`,
 *                         written by the database in the sweep's own transaction
 *
 * An erasure that stalls is watched as well: a request still `processing` with
 * an `account.deletion_step_failed` row older than DELETION_STEP_FAILURE_HOURS
 * (no later completion) is `accountDeletionFailures.stuck`, a notify condition.
 */

/*
 * GAP-FIX-R8 (H.4, Appendix O 1.2 and 1.3; the Block H non-negotiables): the
 * analytics warehouse's 400-day retention prune and its erasure re-apply keep
 * promises made to families on every sync, and they are watched as one job, `warehouse_retention`, read from dataintel
 * (services/warehouseMaintenance.ts), never through a heartbeat a job could
 * fake. It is stale when either step has no successful run inside its window
 * OR its last attempt failed (both run every sync, so a failed attempt is a
 * promise not kept right now), and when the warehouse cannot be read: that
 * case also carries `unreadable: true`, which the watcher refuses outright.
 */

/** Jobs that record themselves through the heartbeat route (scripts/ops-heartbeat.sh). */
export const HEARTBEAT_JOBS = ['vault_backup', 'pulse_backup', 'vault_drift', 'learning_retention', 'insights_prune'] as const;
export type HeartbeatJob = (typeof HEARTBEAT_JOBS)[number];
/** Jobs whose own durable trail is read directly. */
export const TRAIL_JOBS = ['account_deletions', 'family_retention', 'social_retention'] as const;
export type TrailJob = (typeof TRAIL_JOBS)[number];
/** Jobs read from the analytics warehouse's own maintenance log (dataintel). */
export const WAREHOUSE_JOBS = ['warehouse_retention'] as const;
export type WarehouseJob = (typeof WAREHOUSE_JOBS)[number];
export const OPS_JOBS = [...HEARTBEAT_JOBS, ...TRAIL_JOBS, ...WAREHOUSE_JOBS] as const;
export type OpsJob = (typeof OPS_JOBS)[number];

/**
 * Every scheduled watched job runs once a day (family retention 03:15, account
 * deletion 03:45, social retention 04:15, learning retention 04:30, vault-drift
 * and the insights prune 07:30, vault-backup 08:00, pulse-backup 08:30 UTC).
 * 36 hours is a day plus half a day of slack for an ordinary late or retried
 * run, without hiding a genuinely missed day.
 *
 * warehouse_retention runs after every warehouse sync (every 5 minutes by
 * default). It keeps the same 36 hours (one calibration value,
 * h4.ops_job_stale_hours in docs/operations/STAFF-OPS-RECALIBRATION-LOG.md):
 * a FAILED run is stale at once (judgeWarehouseRetention), so the window only
 * decides how long a sync worker that stopped altogether goes unnamed.
 */
export const OPS_JOB_STALE_HOURS: Record<OpsJob, number> = {
  vault_backup: 36,
  pulse_backup: 36,
  vault_drift: 36,
  learning_retention: 36,
  insights_prune: 36,
  account_deletions: 36,
  family_retention: 36,
  social_retention: 36,
  warehouse_retention: 36,
};

/** A step failure older than this with the request still processing is a stalled erasure (the sweep retries daily). */
export const DELETION_STEP_FAILURE_HOURS = 24;
export const DELETION_STEP_FAILED_AUDIT_ACTION = 'account.deletion_step_failed';
export const SOCIAL_RETENTION_SWEEP_AUDIT_ACTION = 'social_retention.sweep_ran';

export const opsJobAction = (job: HeartbeatJob): string => `ops.${job}.completed`;

export const OpsHeartbeatBody = z
  .object({
    job: z.enum(HEARTBEAT_JOBS),
    ok: z.boolean(),
    bytes: z.number().int().nonnegative().max(1e13).optional(),
    pending: z.number().int().nonnegative().max(10_000).optional(),
  })
  .strict();
export type OpsHeartbeat = z.infer<typeof OpsHeartbeatBody>;

/** Records one run. False when the audit row did not land: the caller must answer non-2xx so the job fails loudly. */
export async function recordOpsHeartbeat(beat: OpsHeartbeat): Promise<boolean> {
  const detail: Record<string, unknown> = { ok: beat.ok };
  if (beat.bytes !== undefined) detail.bytes = beat.bytes;
  if (beat.pending !== undefined) detail.pending = beat.pending;
  return insertAuditLog(null, opsJobAction(beat.job), beat.job, detail);
}

export interface OpsJobStatus {
  job: OpsJob;
  /** The last run that reported success. */
  lastRunAt: string | null;
  hoursSinceLastRun: number | null;
  /** The last run of any outcome (a failed run still proves the schedule fires). */
  lastAttemptAt: string | null;
  lastAttemptOk: boolean | null;
  staleAfterHours: number;
  /** No successful run within the window, or none ever: the same verdict (a promise not currently kept). */
  stale: boolean;
  lastRunDetail: Record<string, unknown> | null;
  /** GAP-FIX-R8: the job's record could not be read (the warehouse was down). Always stale; the watcher refuses it. */
  unreadable?: true;
}

const Rows = z.array(z.object({ created_at: z.string(), detail: z.record(z.string(), z.unknown()).nullable() }));
type TrailRow = z.infer<typeof Rows>[number];

/** family_retention_runs: one row per completed sweep (migration family_data_retention). */
const FamilyRuns = z.array(z.object({
  ran_at: z.string(),
  removed: z.record(z.string(), z.unknown()),
  evidence_cleared: z.number().int().nullable(),
  evidence_failed: z.number().int().nullable(),
}));

/**
 * Pure (GAP-FIX-R8): the verdict for `warehouse_retention` from dataintel's
 * maintenance steps. The job's last successful run is the OLDER of the steps'
 * last successes (the promise kept least recently binds), its last attempt the
 * older of their last attempts, and `lastAttemptOk` is false when either
 * step's last attempt failed. Null steps (the warehouse was not read) are an
 * unreadable, stale job.
 */
export function judgeWarehouseRetention(steps: WarehouseMaintenanceStepStatus[] | null, now: Date): OpsJobStatus {
  const staleAfterHours = OPS_JOB_STALE_HOURS.warehouse_retention;
  if (steps === null || steps.length === 0) {
    return {
      job: 'warehouse_retention', lastRunAt: null, hoursSinceLastRun: null, lastAttemptAt: null, lastAttemptOk: null,
      staleAfterHours, stale: true, lastRunDetail: null, unreadable: true,
    };
  }
  const oldest = (values: (string | null)[]): string | null =>
    values.some((value) => value === null) ? null : values.reduce((a, b) => (Date.parse(a!) <= Date.parse(b!) ? a : b));
  const lastRunAt = oldest(steps.map((step) => step.lastSuccessAt));
  const lastAttemptAt = oldest(steps.map((step) => step.lastAttemptAt));
  const lastAttemptOk = steps.some((step) => step.lastAttemptOk === false) ? false
    : steps.every((step) => step.lastAttemptOk === true) ? true : null;
  const hours = lastRunAt === null ? null : (now.getTime() - Date.parse(lastRunAt)) / 3_600_000;
  return {
    job: 'warehouse_retention',
    lastRunAt,
    hoursSinceLastRun: hours,
    lastAttemptAt,
    lastAttemptOk,
    staleAfterHours,
    stale: hours === null || hours > staleAfterHours || lastAttemptOk === false,
    lastRunDetail: {
      steps: steps.map((step) => ({
        step: step.step, lastSuccessAt: step.lastSuccessAt, removed: step.lastSuccessRemoved,
        lastAttemptOk: step.lastAttemptOk, lastError: step.lastError,
      })),
    },
  };
}

/** Pure: whether one trail row records a successful run of that job. */
export function runSucceeded(job: OpsJob, detail: Record<string, unknown> | null): boolean {
  if ((HEARTBEAT_JOBS as readonly string[]).includes(job)) return detail?.ok === true;
  // The sweep audits every run; one that could not read the paused children did not keep A.1's promise.
  if (job === 'account_deletions') return detail !== null && detail.suspensionsUnreadable !== true;
  // The social sweep's row and a family run row exist only for a run that completed.
  return true;
}

/** Pure: the verdict for one job from its latest successful and latest attempted rows. */
export function judgeOpsJob(
  job: OpsJob,
  lastOk: { created_at: string; detail: Record<string, unknown> | null } | undefined,
  lastAttempt: { created_at: string; detail: Record<string, unknown> | null } | undefined,
  now: Date,
): OpsJobStatus {
  const staleAfterHours = OPS_JOB_STALE_HOURS[job];
  const hours = lastOk ? (now.getTime() - Date.parse(lastOk.created_at)) / 3_600_000 : null;
  return {
    job,
    lastRunAt: lastOk?.created_at ?? null,
    hoursSinceLastRun: hours,
    lastAttemptAt: lastAttempt?.created_at ?? null,
    lastAttemptOk: lastAttempt ? runSucceeded(job, lastAttempt.detail) : null,
    staleAfterHours,
    stale: hours === null || hours > staleAfterHours,
    lastRunDetail: lastOk?.detail ?? null,
  };
}

/**
 * G.2 / Appendix N 2.3(b): the retroactive release checks past their 30-day
 * window and still open ride on the same watchdog. `overdue > 0` fails
 * ops-job-watch and opens or comments on the watchdog issue.
 */
export interface ContentRetroCheckStatus { overdue: number; windowDays: number }

/**
 * G.4: elevated staff grants past the access-review cadence (`due`, the Roles &
 * Access card's due list) and all elevated grants held (`total`, what the
 * quarterly calendar-triggered review issue asks the staff/access owner to
 * review; agent/tools/access-review-quarterly.mjs).
 */
export interface AccessReviewDueStatus { due: number; total: number; windowDays: number }

/** The Mentor retention sweep in the watched-job shape (its window stays RETENTION_STALE_HOURS in tutorData.ts). */
export interface TutorRetentionJobStatus extends Omit<OpsJobStatus, 'job'> { job: 'tutor_retention' }

/** Pure: the sweep records a row only when a purge reached the database, so its last run is also its last attempt. */
export function retentionAsJob(status: TutorRetentionStatus): TutorRetentionJobStatus {
  return {
    job: 'tutor_retention',
    lastRunAt: status.lastRunAt,
    hoursSinceLastRun: status.hoursSinceLastRun,
    lastAttemptAt: status.lastRunAt,
    lastAttemptOk: status.lastRunAt === null ? null : true,
    staleAfterHours: RETENTION_STALE_HOURS,
    stale: status.stale,
    lastRunDetail: status.lastRunDetail,
  };
}

/** E.6: erasures still processing whose step failed more than `afterHours` ago with no completion since. */
export interface AccountDeletionFailureStatus { stuck: number; afterHours: number }

export interface OpsStatus {
  jobs: OpsJobStatus[];
  tutorRetention: TutorRetentionJobStatus;
  /** Any watched job or the retention sweep stale. */
  anyStale: boolean;
  contentRetroChecks: ContentRetroCheckStatus;
  accessReviews: AccessReviewDueStatus;
  /** H.3: warehouse alert triggers that notified nobody (null count = the warehouse was not read). */
  alerts: UndeliveredAlertsStatus;
  accountDeletionFailures: AccountDeletionFailureStatus;
}

const auditPath = (action: string, extra = '') =>
  `/audit_logs?action=eq.${encodeURIComponent(action)}${extra}&select=created_at,detail&order=created_at.desc&limit=1`;

/** The jobs Core reads from its own database (audit_logs and family_retention_runs). */
const DATABASE_JOBS = [...HEARTBEAT_JOBS, ...TRAIL_JOBS] as const;
type DatabaseJob = (typeof DATABASE_JOBS)[number];

/** The latest successful and latest attempted row of one job, or null when a read failed. */
async function readTrail(job: DatabaseJob): Promise<{ ok: TrailRow | undefined; attempt: TrailRow | undefined } | null> {
  if (job === 'family_retention') {
    const parsed = FamilyRuns.safeParse(await serviceRest<unknown>('/family_retention_runs?select=ran_at,removed,evidence_cleared,evidence_failed&order=ran_at.desc&limit=1'));
    if (!parsed.success) return null;
    const run = parsed.data[0];
    const row = run ? { created_at: run.ran_at, detail: { removed: run.removed, evidenceCleared: run.evidence_cleared, evidenceFailed: run.evidence_failed } } : undefined;
    return { ok: row, attempt: row };
  }
  const [okPath, attemptPath] = job === 'account_deletions'
    ? [auditPath(ACCOUNT_DELETION_SWEEP_AUDIT_ACTION, '&detail->>suspensionsUnreadable=is.null'), auditPath(ACCOUNT_DELETION_SWEEP_AUDIT_ACTION)]
    : job === 'social_retention'
      ? [auditPath(SOCIAL_RETENTION_SWEEP_AUDIT_ACTION), auditPath(SOCIAL_RETENTION_SWEEP_AUDIT_ACTION)]
      : [auditPath(opsJobAction(job), '&detail->>ok=eq.true'), auditPath(opsJobAction(job))];
  const [okRows, attemptRows] = await Promise.all([serviceRest<unknown>(okPath), serviceRest<unknown>(attemptPath)]);
  const ok = Rows.safeParse(okRows);
  const attempt = Rows.safeParse(attemptRows);
  if (!ok.success || !attempt.success) return null;
  return { ok: ok.data[0], attempt: attempt.data[0] };
}

const ProcessingIds = z.array(z.object({ id: z.string().uuid() })).max(200);
const FailureRows = z.array(z.object({ detail: z.record(z.string(), z.unknown()).nullable() }));

/**
 * E.6: erasures that stalled. A request still `processing` with a step failure
 * recorded more than DELETION_STEP_FAILURE_HOURS ago has had no success since
 * (completion moves it out of `processing`). Null when a read failed.
 */
export async function getStuckAccountDeletions(now: Date = new Date()): Promise<number | null> {
  const open = ProcessingIds.safeParse(await serviceRest<unknown>('/account_deletion_requests?status=eq.processing&select=id&order=started_at.asc&limit=200'));
  if (!open.success) return null;
  if (open.data.length === 0) return 0;
  const ids = new Set(open.data.map((row) => row.id));
  const cutoff = new Date(now.getTime() - DELETION_STEP_FAILURE_HOURS * 3_600_000).toISOString();
  const failures = FailureRows.safeParse(await serviceRest<unknown>(
    `/audit_logs?action=eq.${encodeURIComponent(DELETION_STEP_FAILED_AUDIT_ACTION)}&created_at=lt.${encodeURIComponent(cutoff)}`
    + `&detail->>request_id=in.(${[...ids].join(',')})&select=detail&limit=1000`,
  ));
  if (!failures.success) return null;
  const stuck = new Set<string>();
  for (const row of failures.data) {
    const requestId = row.detail?.request_id;
    if (typeof requestId === 'string' && ids.has(requestId)) stuck.add(requestId);
  }
  return stuck.size;
}

/**
 * Every job's status. Null when a READ failed: a database outage is a 502,
 * never "the backups have never run" (§1.14).
 */
export async function getOpsJobStatus(now: Date = new Date()): Promise<OpsStatus | null> {
  const overdue = getOverdueRetroChecks();
  const retention = getTutorRetentionStatus(now);
  const accessCounts = getAccessReviewCounts(ACCESS_REVIEW_CADENCE_DAYS);
  const stuckDeletions = getStuckAccountDeletions(now);
  const undeliveredAlerts = getUndeliveredAlerts();
  const warehouseMaintenance = getWarehouseMaintenance();
  const trails = await Promise.all(DATABASE_JOBS.map((job) => readTrail(job)));
  if (trails.some((trail) => trail === null)) return null;
  const jobs = DATABASE_JOBS.map((job, index) => judgeOpsJob(job, trails[index]!.ok, trails[index]!.attempt, now));
  const [overdueChecks, retentionStatus, access, stuck, alerts, warehouseSteps] = await Promise.all([
    overdue, retention, accessCounts, stuckDeletions, undeliveredAlerts, warehouseMaintenance,
  ]);
  // GAP-FIX-R8: an unreadable warehouse is an unreadable, stale job, never a 502 for every job.
  jobs.push(judgeWarehouseRetention(warehouseSteps, now));
  if (overdueChecks === null || retentionStatus === null || access === null || stuck === null) return null;
  const tutorRetention = retentionAsJob(retentionStatus);
  return {
    jobs,
    tutorRetention,
    anyStale: jobs.some((job) => job.stale) || tutorRetention.stale,
    contentRetroChecks: { overdue: overdueChecks, windowDays: RETRO_CHECK_DAYS },
    accessReviews: { due: access.due, total: access.total, windowDays: ACCESS_REVIEW_CADENCE_DAYS },
    accountDeletionFailures: { stuck, afterHours: DELETION_STEP_FAILURE_HOURS },
    alerts,
  };
}
