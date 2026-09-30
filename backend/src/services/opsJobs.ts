import { z } from 'zod';
import { insertAuditLog, serviceRest } from './supabaseRest.js';
import { getOverdueRetroChecks, RETRO_CHECK_DAYS } from './contentRelease.js';
import { getTutorRetentionStatus, RETENTION_STALE_HOURS, type TutorRetentionStatus } from './tutorData.js';
import { ACCESS_REVIEW_CADENCE_DAYS, getAccessReviewCounts } from './adminData.js';
import { ACCOUNT_DELETION_SWEEP_AUDIT_ACTION } from '../routes/account.js';
import { BADGE_IMAGE_SWEEP_AUDIT_ACTION } from '../routes/badgePublic.js';
import { getUndeliveredAlerts, type UndeliveredAlertsStatus } from './warehouseAlerts.js';

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
 * GAP-FIX-R8 (H.4, F.2 under OD-20, owner answer D-08): the daily legacy
 * badge-image purge is a family-data job too (the pictures of children's
 * achievements behind expired or revoked legacy links must stop resolving).
 *   trail job:
 *     badge_link_retirement  badge-link-retirement.yml 03:30: Core's sweep
 *                         route (routes/badgePublic.ts) writes
 *                         `badge_links.images_swept` on every page it sweeps,
 *                         with scanned/purged/failed counts; a page with
 *                         `failed > 0` is a failed attempt (the image still
 *                         resolves), so a sweep that keeps failing goes stale
 *                         exactly like one that stopped. It stays watched
 *                         until the dated removal of the workflow.
 *
 * An erasure that stalls is watched as well: a request still `processing` with
 * an `account.deletion_step_failed` row older than DELETION_STEP_FAILURE_HOURS
 * (no later completion) is `accountDeletionFailures.stuck`, a notify condition.
 */

/** Jobs that record themselves through the heartbeat route (scripts/ops-heartbeat.sh). */
export const HEARTBEAT_JOBS = ['vault_backup', 'pulse_backup', 'vault_drift', 'learning_retention', 'insights_prune'] as const;
export type HeartbeatJob = (typeof HEARTBEAT_JOBS)[number];
/** Jobs whose own durable trail is read directly. */
export const TRAIL_JOBS = ['account_deletions', 'family_retention', 'social_retention', 'badge_link_retirement'] as const;
export type TrailJob = (typeof TRAIL_JOBS)[number];
export const OPS_JOBS = [...HEARTBEAT_JOBS, ...TRAIL_JOBS] as const;
export type OpsJob = (typeof OPS_JOBS)[number];

/**
 * Every watched job runs once a day (family retention 03:15, account deletion
 * 03:45, legacy badge-image purge 03:30, social retention 04:15, learning retention 04:30, vault-drift and the
 * insights prune 07:30, vault-backup 08:00, pulse-backup 08:30 UTC). 36 hours
 * is a day plus half a day of slack for an ordinary late or retried run,
 * without hiding a genuinely missed day.
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
  badge_link_retirement: 36,
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

/** Pure: whether one trail row records a successful run of that job. */
export function runSucceeded(job: OpsJob, detail: Record<string, unknown> | null): boolean {
  if ((HEARTBEAT_JOBS as readonly string[]).includes(job)) return detail?.ok === true;
  // The sweep audits every run; one that could not read the paused children did not keep A.1's promise.
  if (job === 'account_deletions') return detail !== null && detail.suspensionsUnreadable !== true;
  // A badge sweep page whose images could not all be purged left a dead link's picture resolving (F.2).
  if (job === 'badge_link_retirement') return detail !== null && detail.failed === 0;
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

/** The latest successful and latest attempted row of one job, or null when a read failed. */
async function readTrail(job: OpsJob): Promise<{ ok: TrailRow | undefined; attempt: TrailRow | undefined } | null> {
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
      : job === 'badge_link_retirement'
        ? [auditPath(BADGE_IMAGE_SWEEP_AUDIT_ACTION, '&detail->>failed=eq.0'), auditPath(BADGE_IMAGE_SWEEP_AUDIT_ACTION)]
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
  const trails = await Promise.all(OPS_JOBS.map((job) => readTrail(job)));
  if (trails.some((trail) => trail === null)) return null;
  const jobs = OPS_JOBS.map((job, index) => judgeOpsJob(job, trails[index]!.ok, trails[index]!.attempt, now));
  const [overdueChecks, retentionStatus, access, stuck, alerts] = await Promise.all([overdue, retention, accessCounts, stuckDeletions, undeliveredAlerts]);
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
