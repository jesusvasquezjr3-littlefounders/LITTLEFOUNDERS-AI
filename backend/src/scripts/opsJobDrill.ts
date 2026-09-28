import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpsJobStatus, OPS_JOB_STALE_HOURS, opsJobAction, type OpsJob } from '../services/opsJobs.js';

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
 */

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '../../../agent/tools/ops-job-watch.mjs');

export interface DrillResult {
  job: DrillTarget;
  stale: boolean;
  watcherExit: number | null;
  notice: string | null;
  passed: boolean;
}

export type DrillTarget = OpsJob | 'content_retro_checks';

const metricsRow = (overdue: number) => [{ publish_actions: 3, bypasses: 1, decided: 1, unverified: overdue, complete: 1 - overdue, overdue_open: overdue }];

export async function runOpsJobDrill(job: DrillTarget, now: Date = new Date()): Promise<DrillResult> {
  const staleAt = new Date(now.getTime() - (job === 'content_retro_checks' ? 2 : OPS_JOB_STALE_HOURS[job] + 12) * 3_600_000).toISOString();
  const freshAt = new Date(now.getTime() - 2 * 3_600_000).toISOString();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    // G.2: a retroactive release check past its 30 days, simulated through the same status read.
    if (url.includes('/rpc/content_bypass_metrics')) {
      return new Response(JSON.stringify(metricsRow(job === 'content_retro_checks' ? 1 : 0)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const action = /action=eq\.([^&]+)/.exec(url)?.[1] ?? '';
    const createdAt = job !== 'content_retro_checks' && action === opsJobAction(job) ? staleAt : freshAt;
    return new Response(JSON.stringify([{ created_at: createdAt, detail: { ok: true } }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  let status;
  try {
    status = await getOpsJobStatus(now);
  } finally {
    globalThis.fetch = original;
  }
  const stale = job === 'content_retro_checks'
    ? (status?.contentRetroChecks.overdue ?? 0) > 0
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
    const passed = stale && watcher.status === 1 && notice !== null && notice.includes(job === 'content_retro_checks' ? 'retroactive release check' : job);
    return { job, stale, watcherExit: watcher.status, notice, passed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
