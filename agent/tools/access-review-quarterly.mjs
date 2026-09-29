#!/usr/bin/env node
// G.4 / Appendix N 1.1: the QUARTERLY, CALENDAR-TRIGGERED access review.
//
// The SPEC proposes "quarterly, calendar-triggered, owned by the staff/access
// owner". ops-job-watch.mjs already fails the daily watch while any elevated
// grant is past its rolling 90 days; that is the per-grant trigger. This is
// the calendar trigger: on the first day of each calendar quarter,
// access-review-quarterly.yml asks Core for its operations status and this
// tool writes the review issue the staff/access owner works through, whether
// or not anything is already due.
//
//   node agent/tools/access-review-quarterly.mjs --status-file status.json \
//     --issue-file issue.md --title-file title.txt [--now 2026-10-01T09:00:00Z]
//
// The counts are never re-derived here: `accessReviews.due` and
// `accessReviews.total` come from staff_access_review_status (Core's
// services/opsJobs.ts). A reply without them does NOT skip the quarter: the
// issue is still written (the review is due regardless), it says the counts
// could not be read, and the tool exits 1 so the run is red.
//
// Exit 0: the issue body and title were written from a readable status.
// Exit 1: the status was unreadable (the issue is still written) or the
// arguments were wrong.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ISSUE_LABEL = 'access-review';

/** "2026-Q4" for any instant in October to December 2026 (UTC). */
export function quarterLabel(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('quarterLabel: not a date');
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export const issueTitle = (now) => `Quarterly access review: ${quarterLabel(now)}`;

const count = (value) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** @returns {{ ok: boolean, due: number | null, total: number | null, windowDays: number | null, error: string | null }} */
export function readAccessReviews(body) {
  const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  const reviews = data && typeof data === 'object' ? data.accessReviews : undefined;
  const due = count(reviews?.due);
  const total = count(reviews?.total);
  const windowDays = count(reviews?.windowDays);
  if (due === null || total === null || windowDays === null || due > total) {
    return { ok: false, due: null, total: null, windowDays: null, error: 'the operations status carries no readable accessReviews { due, total, windowDays }' };
  }
  return { ok: true, due, total, windowDays, error: null };
}

export function buildIssue(result, now, runUrl = '') {
  const lines = [
    `The ${quarterLabel(now)} access review is open (G.4, docs/operations/GOVERNANCE.md section 2). Owner: the staff/access owner.`,
    '',
  ];
  if (result.ok) {
    lines.push(`- Elevated grants held (Admin/Superadmin roles and staff permissions): **${result.total}**.`);
    lines.push(`- Already past the ${result.windowDays}-day review: **${result.due}**.`);
  } else {
    lines.push(`- The counts could not be read: ${result.error}. The review is still due; read them on the staff console.`);
  }
  lines.push(
    '',
    'To complete the review:',
    '1. Open the staff console, Roles & Access.',
    '2. Check every elevated grant against actual usage, not only the ones listed as due.',
    '3. For each one, choose Keep access (recorded in the access-review log) or revoke it.',
    '4. Close this issue when no grant is left unreviewed this quarter.',
  );
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const statusFile = arg('--status-file');
  const issueFile = arg('--issue-file');
  const titleFile = arg('--title-file');
  if (!statusFile || !issueFile || !titleFile) {
    console.error('usage: access-review-quarterly.mjs --status-file <json> --issue-file <md> --title-file <txt> [--now <iso>]');
    process.exit(1);
  }
  const now = arg('--now') ? new Date(arg('--now')) : new Date();
  let body = null;
  try {
    body = JSON.parse(readFileSync(statusFile, 'utf8'));
  } catch {
    body = null;
  }
  const result = readAccessReviews(body);
  writeFileSync(titleFile, issueTitle(now));
  writeFileSync(issueFile, buildIssue(result, now, process.env.RUN_URL ?? ''));
  if (!result.ok) {
    console.error(`::error::${result.error}`);
    process.exit(1);
  }
  console.log(`${issueTitle(now)}: ${result.total} elevated grant(s), ${result.due} past the ${result.windowDays}-day review`);
}
