import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpsJobStatus, OPS_JOB_STALE_HOURS, opsJobAction, type OpsJob } from '../services/opsJobs.js';
import { RETENTION_SWEEP_AUDIT_ACTION, RETENTION_STALE_HOURS } from '../services/tutorData.js';

/*
 * H.4 / Appendix O 2.3: the SIMULATED JOB-FAILURE DRILL. Appendix O is not
 * met until a simulated failure of each watched job is shown to notify a
 * human. Locally, with zero spend and no production access:
 *
 *   1. the audit trail Core reads is simulated: the chosen job's last
 *      heartbeat is older than its window, the other jobs are fresh;
 *   2. Core's real status code (services/opsJobs.ts getOpsJobStatus) turns
 *      that trail into its reply;
 *   3. the real watcher (agent/tools/ops-job-watch.mjs, what
 *      .github/workflows/ops-job-watch.yml runs) reads the reply and must
 *      fail AND write the notice the workflow posts to the watchdog issue.
 *
 * The drill passes only when all three hold for the failed job. The fetch
 * replacement lives only for the duration of step 2.
 *
 * Targets: the three heartbeat jobs; `tutor_retention`, the Mentor 90-day
 * retention sweep (its `tutor.retention.swept` trail simulated stale, Appendix
 * O 2.3(b) names it); `content_retro_checks` (G.2, an overdue retroactive
 * release check); `access_reviews` (G.4, an elevated grant past the 90-day
 * access review); `alerts_undelivered` (H.3, GAP-FIX-R6: a warehouse alert
 * trigger whose delivery failed after its retries, read from dataintel).
 */

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '../../../agent/tools/ops-job-watch.mjs');

export interface DrillResult {
  job: DrillTarget;
  stale: boolean;
  watcherExit: number | null;
  notice: string | null;
  passed: boolean;
}

export type DrillTarget = OpsJob | 'tutor_retention' | 'content_retro_checks' | 'access_reviews' | 'alerts_undelivered';
export const DRILL_TARGETS: readonly DrillTarget[] = ['vault_backup', 'pulse_backup', 'vault_drift', 'tutor_retention', 'content_retro_checks', 'access_reviews', 'alerts_undelivered'];
/** Targets that are a condition on the status, not a scheduled job's trail. */
const CONDITIONS: readonly DrillTarget[] = ['content_retro_checks', 'access_reviews', 'alerts_undelivered'];

const metricsRow = (overdue: number) => [{ publish_actions: 3, bypasses: 1, decided: 1, unverified: overdue, complete: 1 - overdue, overdue_open: overdue }];
const reviewStatus = (due: number) => ({
  cadenceDays: 90, total: 2, stale: due, reviewedEver: 1,
  grants: [{ userId: '00000000-0000-4000-8000-000000000001', kind: 'role', grant: 'admin', grantedAt: '2026-01-01T00:00:00Z', lastReviewedAt: null, due: due > 0 }],
});
/** H.3: the warehouse's undelivered-trigger read (dataintel GET /alerts/undelivered). */
const undelivered = (count: number) => ({
  data: {
    hours: 36, count,
    alerts: count === 0 ? [] : [{ alertId: '00000000-0000-4000-8000-0000000000a1', name: 'dau drop', channel: 'webhook',
      triggeredAt: '2026-09-27T08:00:00.000Z', status: 'failed', error: 'HTTP 502', attempts: 3 }],
  },
  error: null,
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** The audit action whose trail the drill makes stale, or null for a target that is not a scheduled job. */
function staleAction(job: DrillTarget): string | null {
  if (job === 'tutor_retention') return RETENTION_SWEEP_AUDIT_ACTION;
  if (CONDITIONS.includes(job)) return null;
  return opsJobAction(job as OpsJob);
}

function staleHours(job: DrillTarget): number {
  if (job === 'tutor_retention') return RETENTION_STALE_HOURS;
  if (CONDITIONS.includes(job)) return 0;
  return OPS_JOB_STALE_HOURS[job as OpsJob];
}

const NOTICE_MARK: Record<DrillTarget, string> = {
  vault_backup: '**vault_backup**',
  pulse_backup: '**pulse_backup**',
  vault_drift: '**vault_drift**',
  tutor_retention: '**tutor_retention**',
  content_retro_checks: 'retroactive release check',
  access_reviews: '**access_reviews**',
  alerts_undelivered: '**alerts.undelivered**',
};

export async function runOpsJobDrill(job: DrillTarget, now: Date = new Date()): Promise<DrillResult> {
  const staleAt = new Date(now.getTime() - (staleHours(job) + 12) * 3_600_000).toISOString();
  const freshAt = new Date(now.getTime() - 2 * 3_600_000).toISOString();
  const target = staleAction(job);
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    // G.2: a retroactive release check past its 30 days, simulated through the same status read.
    if (url.includes('/rpc/content_bypass_metrics')) return json(metricsRow(job === 'content_retro_checks' ? 1 : 0));
    // G.4: an elevated grant past the 90-day access review.
    if (url.includes('/rpc/staff_access_review_status')) return json(reviewStatus(job === 'access_reviews' ? 1 : 0));
    // H.3: a warehouse alert whose delivery failed after its retries.
    if (url.includes('/api/v1/intel/alerts/undelivered')) return json(undelivered(job === 'alerts_undelivered' ? 1 : 0));
    const action = /action=eq\.([^&]+)/.exec(url)?.[1] ?? '';
    return json([{ created_at: target !== null && action === target ? staleAt : freshAt, detail: { ok: true } }]);
  }) as typeof fetch;
  let status;
  try {
    status = await getOpsJobStatus(now);
  } finally {
    globalThis.fetch = original;
  }
  const stale = job === 'content_retro_checks' ? (status?.contentRetroChecks.overdue ?? 0) > 0
    : job === 'access_reviews' ? (status?.accessReviews.due ?? 0) > 0
      : job === 'alerts_undelivered' ? (status?.alerts.undelivered ?? 0) > 0
      : job === 'tutor_retention' ? status?.tutorRetention.stale ?? false
        : status?.jobs.find((entry) => entry.job === job)?.stale ?? false;

  const dir = mkdtempSync(join(tmpdir(), 'ops-drill-'));
  try {
    const statusFile = join(dir, 'status.json');
    const noticeFile = join(dir, 'notice.md');
    writeFileSync(statusFile, JSON.stringify({ data: status, error: null }));
    const watcher = spawnSync(process.execPath, [TOOL, '--status-file', statusFile, '--notify-file', noticeFile], { encoding: 'utf8' });
    let notice: string | null = null;
    try {
      notice = readFileSync(noticeFile, 'utf8');
    } catch {
      notice = null;
    }
    const passed = stale && watcher.status === 1 && notice !== null && notice.includes(NOTICE_MARK[job]);
    return { job, stale, watcherExit: watcher.status, notice, passed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
