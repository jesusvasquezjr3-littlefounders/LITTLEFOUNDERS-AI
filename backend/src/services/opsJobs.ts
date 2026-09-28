import { z } from 'zod';
import { insertAuditLog, serviceRest } from './supabaseRest.js';
import { getOverdueRetroChecks, RETRO_CHECK_DAYS } from './contentRelease.js';

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
 */

export const OPS_JOBS = ['vault_backup', 'pulse_backup', 'vault_drift'] as const;
export type OpsJob = (typeof OPS_JOBS)[number];

/**
 * All three run once a day (vault-drift 07:30, vault-backup 08:00,
 * pulse-backup 08:30 UTC). 36 hours is a day plus half a day of slack for an
 * ordinary late or retried run, without hiding a genuinely missed day.
 */
export const OPS_JOB_STALE_HOURS: Record<OpsJob, number> = {
  vault_backup: 36,
  pulse_backup: 36,
  vault_drift: 36,
};

export const opsJobAction = (job: OpsJob): string => `ops.${job}.completed`;

export const OpsHeartbeatBody = z
  .object({
    job: z.enum(OPS_JOBS),
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
    lastAttemptOk: lastAttempt ? lastAttempt.detail?.ok === true : null,
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
 * Every job's status. Null when a READ failed: a database outage is a 502,
 * never "the backups have never run" (§1.14).
 */
export async function getOpsJobStatus(now: Date = new Date()): Promise<{ jobs: OpsJobStatus[]; anyStale: boolean; contentRetroChecks: ContentRetroCheckStatus } | null> {
  const overdue = getOverdueRetroChecks();
  const reads = await Promise.all(
    OPS_JOBS.flatMap((job) => {
      const action = encodeURIComponent(opsJobAction(job));
      return [
        serviceRest<unknown>(`/audit_logs?action=eq.${action}&detail->>ok=eq.true&select=created_at,detail&order=created_at.desc&limit=1`),
        serviceRest<unknown>(`/audit_logs?action=eq.${action}&select=created_at,detail&order=created_at.desc&limit=1`),
      ];
    }),
  );
  const parsed = reads.map((rows) => Rows.safeParse(rows));
  if (parsed.some((result) => !result.success)) return null;
  const jobs = OPS_JOBS.map((job, index) => {
    const ok = parsed[index * 2]!;
    const attempt = parsed[index * 2 + 1]!;
    return judgeOpsJob(job, ok.success ? ok.data[0] : undefined, attempt.success ? attempt.data[0] : undefined, now);
  });
  const overdueChecks = await overdue;
  if (overdueChecks === null) return null;
  return { jobs, anyStale: jobs.some((job) => job.stale), contentRetroChecks: { overdue: overdueChecks, windowDays: RETRO_CHECK_DAYS } };
}
