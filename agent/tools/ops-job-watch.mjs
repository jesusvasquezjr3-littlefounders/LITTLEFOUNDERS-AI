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
// Exit 0: every job (vault_backup, pulse_backup, vault_drift, tutor_retention)
// ran within its window. Exit 1: a job is stale, OR the reply is not a status at all. The
// staleness itself is NEVER re-derived here: Core's services/opsJobs.ts holds
// each constant and says `stale`; a reply without that boolean is refused,
// because an error page read as "nothing is stale" would fake a healthy
// morning. On exit 1 the notice file holds the issue body the workflow posts
// (it opens or comments on one GitHub issue, so a human is told).
//
// The local drill (backend `npm run ops:drill`) feeds this a status that a
// stale heartbeat produced and checks that it fails and writes the notice.
//
// G.2 / Appendix N 2.3(b): the same reply carries `contentRetroChecks.overdue`,
// the retroactive release checks past their 30-day window and still open
// (Core's services/contentRelease.ts). Any overdue check fails the watch and
// is named in the notice; a reply without the number is refused, like a job
// without its `stale` boolean.
//
// Appendix O 1.3 names three jobs that each need a watchdog AND an external
// notification: the Mentor retention sweep, the backup and the drift probe.
// The retention sweep arrives as `tutorRetention` (Core builds it from
// tutorData.getTutorRetentionStatus(), the one home of its 36-hour window) and
// is judged exactly like the heartbeat jobs.
//
// G.4 / Appendix N 1.1: `accessReviews.due` is the number of elevated staff
// grants past the 90-day access review (staff_access_review_status). Any due
// grant fails the watch and is named in the notice, so the staff/access owner
// is told on the watchdog issue; a reply without the number is refused.
//
// H.3 (GAP-FIX-R6; Block H: no alert may record without a consumer):
// `alerts.undelivered` is the number of warehouse alert triggers in the last
// 36 hours that reached nobody (delivery failed after its retries, the
// channel is not configured, or no outcome was recorded; Core's
// services/warehouseAlerts.ts). Any undelivered trigger fails the watch and is
// named in the notice, so this issue is the alert's escalation channel. A reply
// without the number (the warehouse could not be read) is refused.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WATCHED_JOBS = ['vault_backup', 'pulse_backup', 'vault_drift', 'tutor_retention'];
export const ISSUE_TITLE = 'Operations watchdog: a scheduled job has gone quiet';

const count = (value) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** @returns {{ ok: boolean, stale: object[], errors: string[], overdueChecks: number, dueReviews: number, undeliveredAlerts: number, alerts: object[] }} */
export function evaluateOpsStatus(body) {
  const errors = [];
  const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
    return { ok: false, stale: [], errors: ['the reply carries no jobs list; refusing to report a health check that did not happen'], overdueChecks: 0, dueReviews: 0, undeliveredAlerts: 0, alerts: [] };
  }
  const byJob = new Map(data.jobs.map((job) => [job?.job, job]));
  // The retention sweep is reported beside the heartbeat jobs; its name must match.
  if (data.tutorRetention && typeof data.tutorRetention === 'object' && data.tutorRetention.job === 'tutor_retention') {
    byJob.set('tutor_retention', data.tutorRetention);
  }
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
  const overdueChecks = count(data.contentRetroChecks?.overdue);
  if (overdueChecks === null) errors.push("content_retro_checks: the reply carries no 'overdue' count");
  const dueReviews = count(data.accessReviews?.due);
  if (dueReviews === null) errors.push("access_reviews: the reply carries no 'due' count");
  const undeliveredAlerts = count(data.alerts?.undelivered);
  if (undeliveredAlerts === null) errors.push("alerts: the reply carries no 'undelivered' count (the warehouse alert history was not read)");
  const alerts = Array.isArray(data.alerts?.alerts) ? data.alerts.alerts.filter((alert) => alert && typeof alert === 'object') : [];
  return {
    ok: stale.length === 0 && errors.length === 0 && !overdueChecks && !dueReviews && !undeliveredAlerts,
    stale,
    errors,
    overdueChecks: overdueChecks ?? 0,
    dueReviews: dueReviews ?? 0,
    undeliveredAlerts: undeliveredAlerts ?? 0,
    alerts,
  };
}

/** Staff-authored text in a GitHub issue body: one line, no markdown code or link syntax, bounded. */
const plain = (value, fallback) => (typeof value === 'string' && value.trim() ? value.replace(/[\r\n`<>[\]|*_]/g, ' ').trim().slice(0, 80) : fallback);
const ALERT_LIST_LIMIT = 10;

const hours = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.floor(value)} h ago` : 'never');

export function buildNotification(result, runUrl = '') {
  const lines = [
    `The operations watchdog found ${result.stale.length} stale job(s) and ${result.errors.length} unreadable status(es).`,
    '',
  ];
  if (result.overdueChecks > 0) {
    lines.push(`- **content_retro_checks**: ${result.overdueChecks} retroactive release check(s) past the 30-day window (G.2). Run Forge \`verify:course\` for each course listed on the staff Content page, Live updates.`);
  }
  if (result.dueReviews > 0) {
    lines.push(`- **access_reviews**: ${result.dueReviews} elevated staff grant(s) past the 90-day access review (G.4). The staff/access owner reviews each on the staff console, Roles & Access (Keep access or revoke).`);
  }
  if (result.undeliveredAlerts > 0) {
    lines.push(`- **alerts.undelivered**: ${result.undeliveredAlerts} warehouse alert trigger(s) in the last 36 h notified nobody (H.3). Configure the channel (ALERT_WEBHOOK_URL, or ALERT_EMAIL_SERVER_URL, ALERT_EMAIL_INTERNAL_KEY and ALERT_EMAIL_TO on dataintel) or fix the receiver, then act on the alert itself (staff console, Learning intel, Experiments & alerts).`);
    for (const alert of (result.alerts ?? []).slice(0, ALERT_LIST_LIMIT)) {
      const attempts = typeof alert.attempts === 'number' ? `, ${alert.attempts} attempt(s)` : '';
      const reason = alert.error ? `, ${plain(alert.error, '')}` : '';
      lines.push(`  - "${plain(alert.name, 'unnamed alert')}" (${plain(alert.channel, 'no channel')}) at ${plain(alert.triggeredAt, '?')}: ${plain(alert.status, 'undelivered')}${reason}${attempts}`);
    }
    if ((result.alerts ?? []).length > ALERT_LIST_LIMIT) lines.push(`  - and ${result.undeliveredAlerts - ALERT_LIST_LIMIT} more.`);
  }
  for (const job of result.stale) {
    lines.push(`- **${job.job}**: last successful run ${hours(job.hoursSinceLastRun)} (window ${job.staleAfterHours ?? '?'} h); last attempt ${job.lastAttemptAt ?? 'never'}${job.lastAttemptOk === false ? ' (failed)' : ''}.`);
  }
  for (const error of result.errors) lines.push(`- ${error}`);
  lines.push('', "A missed backup means no restore point for that day; a missed drift probe means production schema state is unknown; a missed retention sweep means a child's Mentor conversation may outlive its 90-day window.");
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
  if (result.overdueChecks > 0) console.error(`::error::${result.overdueChecks} retroactive release check(s) are overdue (G.2)`);
  if (result.dueReviews > 0) console.error(`::error::${result.dueReviews} staff grant(s) are past the 90-day access review (G.4)`);
  if (result.undeliveredAlerts > 0) console.error(`::error::${result.undeliveredAlerts} warehouse alert trigger(s) notified nobody (H.3)`);
  process.exit(1);
}
