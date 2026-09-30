#!/usr/bin/env node
// Appendix J Part 1.4 and Part 3 Stage 7, E.7 (gap-fix round 7, social): the
// QUARTERLY Block E review, calendar-triggered.
//
// The Block E Threshold Recalibration Log and the regulatory watch list live
// in docs/rebuild/policies/SOCIAL-GOVERNANCE.md §1.2 and §1.3, each row with
// its own due date (block-e-review-cadence.mjs), and release readiness fails
// on an overdue one. This is the calendar trigger: on the first day of each
// calendar quarter, block-e-reviews-quarterly.yml runs this tool and opens one
// issue for the Safety/Trust Lead listing every threshold (value, enforcing
// function, last review, next due date and whether it is overdue) and every
// watch-list item to re-check with counsel, whether or not one is due yet.
//
//   node agent/tools/block-e-reviews-quarterly.mjs --issue-file issue.md \
//     --title-file title.txt [--now 2026-10-01T09:00:00Z] [--root <repo>]
//
// Exit 0: the issue body and title were written from a readable log.
// Exit 1: the log was missing or malformed (the issue is still written and
// says so: the review is due regardless) or the arguments were wrong.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWNER, POLICY, readBlockELog, validDate } from './block-e-review-cadence.mjs';

export const ISSUE_LABEL = 'block-e-review';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** "2026-Q4" for any instant in October to December 2026 (UTC). */
export function quarterLabel(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('quarterLabel: not a date');
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export const issueTitle = (now) => `Quarterly Block E review: ${quarterLabel(now)}`;

/** The last day of the calendar quarter holding `date` (YYYY-MM-DD). */
export function quarterEnd(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 3, 0)).toISOString().slice(0, 10);
}

/** "overdue", "due this quarter" or "not yet due" for a due date seen on `today`. */
export function dueState(due, today) {
  if (!validDate(due)) return 'no valid due date';
  return today > due ? 'overdue' : due <= quarterEnd(today) ? 'due this quarter' : 'not yet due';
}

const code = (text) => (text ? text : '(not stated)');

export function buildIssue(markdown, now, runUrl = '') {
  const today = now.toISOString().slice(0, 10);
  const log = readBlockELog(markdown);
  const lines = [
    `The ${quarterLabel(now)} Block E (social layer) review: Appendix J Part 1.4 Threshold Recalibration Log and Part 3 Stage 7, and the E.7 regulatory re-check.`,
    '',
    `- Owner: ${OWNER} (the regulatory re-check with counsel).`,
    `- Log: \`${POLICY}\` sections 1.2 (thresholds), 1.3 (watch list) and 1.4 (record).`,
    '- An engineering note never counts as the review; only the Safety/Trust Lead\'s recorded review does.',
    '',
  ];
  if (log.failures.length > 0) {
    lines.push('### The log could not be read', '', ...log.failures.map((f) => `- ${f}`), '', 'The review is still due; fix the log when recording it.', '');
  }
  lines.push('### Thresholds to recalibrate (section 1.2)', '');
  if (log.thresholds.length === 0) lines.push('- None could be read from the log.');
  for (const t of log.thresholds) {
    lines.push(`- **${t.name}**: ${code(t.value)}. Enforced in ${code(t.enforcedIn)}. Last reviewed ${code(t.last)}; next due **${code(t.due)}** (${dueState(t.due, today)}).`);
  }
  lines.push('', '### Regulatory watch list to re-check (section 1.3)', '');
  if (log.watch.length === 0) lines.push('- None could be read from the log.');
  for (const w of log.watch) {
    lines.push(`- **${w.item}**: ${code(w.why)}. Status: ${code(w.status)}. Last re-checked ${w.last ?? 'not yet'}; next due **${code(w.due)}** (${dueState(w.due, today)}).`);
  }
  lines.push(
    '',
    '### To complete it',
    '',
    '1. Review every threshold against its Appendix J metric and production readings; update its value, "Last reviewed" and "Next review due" (at most a quarter ahead in the first year).',
    '2. Re-check every watch-list item against current primary sources with counsel; update its status and both dates.',
    '3. Add a row to section 1.4 naming the reviewer and the outcome.',
    '',
    'Release readiness fails while any row is overdue (`node agent/tools/block-e-review-cadence.mjs --strict`), and `guardrails:check` fails on an overdue threshold. Close this issue when the review is recorded.',
  );
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return { body: lines.join('\n'), ok: log.failures.length === 0, log };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issueFile = arg('--issue-file');
  const titleFile = arg('--title-file');
  const root = arg('--root') ?? ROOT;
  const now = new Date(arg('--now') ?? Date.now());
  if (!issueFile || !titleFile || Number.isNaN(now.getTime())) {
    console.error('Usage: block-e-reviews-quarterly.mjs --issue-file <path> --title-file <path> [--now <ISO instant>] [--root <repo>]');
    process.exit(1);
  }
  let markdown = null;
  try { markdown = readFileSync(join(root, POLICY), 'utf8'); } catch { /* reported as missing */ }
  const issue = buildIssue(markdown, now, process.env.RUN_URL ?? '');
  writeFileSync(issueFile, issue.body);
  writeFileSync(titleFile, issueTitle(now));
  console.log(issue.ok ? `${issue.log.thresholds.length} thresholds and ${issue.log.watch.length} watch-list items listed` : `unreadable: ${issue.log.failures.join('; ')}`);
  process.exit(issue.ok ? 0 : 1);
}
