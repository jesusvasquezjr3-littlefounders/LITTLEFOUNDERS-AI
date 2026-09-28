#!/usr/bin/env node
// ops-job-watch.mjs — H.4 / Appendix O 1.3 and 2.3: turns Core's operations
// job status into a verdict and a HUMAN NOTIFICATION.
//
// .github/workflows/ops-job-watch.yml asks Core (from inside the container,
// like tutor-retention-watch.yml) for GET /api/v1/internal/ops/job-status,
// writes the reply to a file and runs:
//
//   node agent/tools/ops-job-watch.mjs --status-file status.json --notify-file notice.md
//
// Exit 0: every job (vault_backup, pulse_backup, vault_drift) ran within its
// window. Exit 1: a job is stale, OR the reply is not a status at all. The
// staleness itself is NEVER re-derived here: Core's services/opsJobs.ts holds
// each constant and says `stale`; a reply without that boolean is refused,
// because an error page read as "nothing is stale" would fake a healthy
// morning. On exit 1 the notice file holds the issue body the workflow posts
// (it opens or comments on one GitHub issue, so a human is told).
//
// The local drill (backend `npm run ops:drill`) feeds this a status that a
// stale heartbeat produced and checks that it fails and writes the notice.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WATCHED_JOBS = ['vault_backup', 'pulse_backup', 'vault_drift'];
export const ISSUE_TITLE = 'Operations watchdog: a scheduled job has gone quiet';

/** @returns {{ ok: boolean, stale: object[], errors: string[] }} */
export function evaluateOpsStatus(body) {
  const errors = [];
  const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
    return { ok: false, stale: [], errors: ['the reply carries no jobs list; refusing to report a health check that did not happen'] };
  }
  const byJob = new Map(data.jobs.map((job) => [job?.job, job]));
  const stale = [];
  for (const name of WATCHED_JOBS) {
    const job = byJob.get(name);
    if (!job) {
      errors.push(`${name}: missing from the reply`);
      continue;
    }
    if (typeof job.stale !== 'boolean') {
      errors.push(`${name}: the reply carries no 'stale' boolean`);
      continue;
    }
    if (job.stale) stale.push(job);
  }
  return { ok: stale.length === 0 && errors.length === 0, stale, errors };
}

const hours = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.floor(value)} h ago` : 'never');

export function buildNotification(result, runUrl = '') {
  const lines = [
    `The operations watchdog found ${result.stale.length} stale job(s) and ${result.errors.length} unreadable status(es).`,
    '',
  ];
  for (const job of result.stale) {
    lines.push(`- **${job.job}**: last successful run ${hours(job.hoursSinceLastRun)} (window ${job.staleAfterHours ?? '?'} h); last attempt ${job.lastAttemptAt ?? 'never'}${job.lastAttemptOk === false ? ' (failed)' : ''}.`);
  }
  for (const error of result.errors) lines.push(`- ${error}`);
  lines.push('', 'A missed backup means no restore point for that day; a missed drift probe means production schema state is unknown.');
  lines.push('Runbook: docs/operations/GOVERNANCE.md section 4.');
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const statusFile = arg('--status-file');
  const notifyFile = arg('--notify-file');
  let body;
  try {
    body = JSON.parse(readFileSync(statusFile ?? 0, 'utf8'));
  } catch {
    body = null;
  }
  const result = evaluateOpsStatus(body);
  if (result.ok) {
    console.log(`ops-job-watch: ${WATCHED_JOBS.length} job(s) healthy`);
    process.exit(0);
  }
  const notice = buildNotification(result, process.env.RUN_URL ?? '');
  if (notifyFile) writeFileSync(notifyFile, notice + '\n', 'utf8');
  for (const job of result.stale) console.error(`::error::${job.job} is STALE (last successful run ${hours(job.hoursSinceLastRun)})`);
  for (const error of result.errors) console.error(`::error::${error}`);
  process.exit(1);
}
