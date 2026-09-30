import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DELETION_STEP_FAILED_AUDIT_ACTION, getOpsJobStatus, HEARTBEAT_JOBS, OPS_JOB_STALE_HOURS, OPS_JOBS, opsJobAction,
  SOCIAL_RETENTION_SWEEP_AUDIT_ACTION, type HeartbeatJob, type OpsJob,
} from '../services/opsJobs.js';
import { ACCOUNT_DELETION_SWEEP_AUDIT_ACTION } from '../routes/account.js';
import { BADGE_IMAGE_SWEEP_AUDIT_ACTION } from '../routes/badgePublic.js';
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
 * Targets: every watched job in services/opsJobs.ts OPS_JOBS (the backups,
 * the drift probe, and since GAP-FIX-R6 the learning retention sweep, the
 * insights prune, the account-deletion sweep, the family retention sweep and
 * the social retention sweep, each with its own trail simulated stale, and
 * since GAP-FIX-R8 the legacy badge-image purge, drilled in its realistic
 * failure: the sweep still runs every day but a page keeps failing to purge,
 * so its latest attempt is fresh and failed while its last clean run is stale);
 * `tutor_retention`, the Mentor 90-day retention sweep (its
 * `tutor.retention.swept` trail simulated stale, Appendix O 2.3(b) names it);
 * `content_retro_checks` (G.2, an overdue retroactive release check);
 * `access_reviews` (G.4, an elevated grant past the 90-day access review);
 * `account_deletion_failures` (E.6, an erasure whose step failed more than a
 * day ago and never completed).
 * `alerts_undelivered` (H.3, GAP-FIX-R6: a warehouse alert trigger whose
 * delivery failed after its retries, read from dataintel).
 */

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '../../../agent/tools/ops-job-watch.mjs');

export interface DrillResult {
  job: DrillTarget;
  stale: boolean;
  watcherExit: number | null;
  notice: string | null;
  passed: boolean;
}

export type DrillTarget = OpsJob | 'tutor_retention' | 'content_retro_checks' | 'access_reviews' | 'account_deletion_failures' | 'alerts_undelivered';
export const DRILL_TARGETS: readonly DrillTarget[] = [...OPS_JOBS, 'tutor_retention', 'content_retro_checks', 'access_reviews', 'account_deletion_failures', 'alerts_undelivered'];
/** Targets that are a condition on the status, not a scheduled job's trail. */
const CONDITIONS: readonly DrillTarget[] = ['content_retro_checks', 'access_reviews', 'account_deletion_failures', 'alerts_undelivered'];
const DRILL_REQUEST = '00000000-0000-4000-8000-00000000d11e';

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
  if (job === 'account_deletions') return ACCOUNT_DELETION_SWEEP_AUDIT_ACTION;
  if (job === 'social_retention') return SOCIAL_RETENTION_SWEEP_AUDIT_ACTION;
  if (job === 'badge_link_retirement') return BADGE_IMAGE_SWEEP_AUDIT_ACTION;
  if ((HEARTBEAT_JOBS as readonly string[]).includes(job)) return opsJobAction(job as HeartbeatJob);
  // family_retention is read from family_retention_runs; the conditions are not scheduled jobs.
  return null;
}

function staleHours(job: DrillTarget): number {
  if (job === 'tutor_retention') return RETENTION_STALE_HOURS;
  if (CONDITIONS.includes(job)) return 0;
  return OPS_JOB_STALE_HOURS[job as OpsJob];
}

const noticeMark = (job: DrillTarget): string => (job === 'content_retro_checks' ? 'retroactive release check'
  : job === 'alerts_undelivered' ? '**alerts.undelivered**' : `**${job}**`);

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
    // D.21: the family retention sweep's own run table.
    if (url.includes('/family_retention_runs')) {
      return json([{ ran_at: job === 'family_retention' ? staleAt : freshAt, removed: {}, evidence_cleared: 0, evidence_failed: 0 }]);
    }
    // E.6: an erasure still processing whose step failed more than a day ago.
    if (url.includes('/account_deletion_requests')) return json(job === 'account_deletion_failures' ? [{ id: DRILL_REQUEST }] : []);
    // H.3: a warehouse alert whose delivery failed after its retries.
    if (url.includes('/api/v1/intel/alerts/undelivered')) return json(undelivered(job === 'alerts_undelivered' ? 1 : 0));
    const action = /action=eq\.([^&]+)/.exec(url)?.[1] ?? '';
    if (action === DELETION_STEP_FAILED_AUDIT_ACTION) {
      return json(job === 'account_deletion_failures' ? [{ detail: { request_id: DRILL_REQUEST, step: 'depot', reason: 'unreachable' } }] : []);
    }
    // F.2 (GAP-FIX-R8): the badge sweep records counts; a clean page has failed = 0.
    if (action === BADGE_IMAGE_SWEEP_AUDIT_ACTION) {
      if (job !== 'badge_link_retirement') return json([{ created_at: freshAt, detail: { scanned: 3, purged: 3, stillReferenced: 0, failed: 0 } }]);
      // The drilled failure: the last clean page is stale, the latest page ran today and could not purge two images.
      return url.includes('detail->>failed=eq.0')
        ? json([{ created_at: staleAt, detail: { scanned: 3, purged: 3, stillReferenced: 0, failed: 0 } }])
        : json([{ created_at: freshAt, detail: { scanned: 2, purged: 0, stillReferenced: 0, failed: 2 } }]);
    }
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
      : job === 'account_deletion_failures' ? (status?.accountDeletionFailures.stuck ?? 0) > 0
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
    const passed = stale && watcher.status === 1 && notice !== null && notice.includes(noticeMark(job));
    return { job, stale, watcherExit: watcher.status, notice, passed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
