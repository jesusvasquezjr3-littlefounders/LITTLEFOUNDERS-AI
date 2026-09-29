#!/usr/bin/env node
// Appendix H Parts 1.3 and 1.4 (GAP-FIX-R5): the QUARTERLY Block D reviews,
// calendar-triggered.
//
// Three recurring human reviews have a quarterly cadence in Appendix H: the
// Threshold Recalibration Log (Part 1.4), the No-Unbacked-Guarantee Audit and
// the Scope-Disclosure Presence & Accuracy Audit (Part 1.3). Their logs carry
// their own due dates (block-d-review-cadence.mjs), and release readiness
// fails on an overdue one. This is the calendar trigger: on the first day of
// each calendar quarter, block-d-reviews-quarterly.yml runs this tool and
// opens one issue listing all three, with each owner, the last human review,
// the next due date and whether it is overdue, whether or not one is due yet.
//
//   node agent/tools/block-d-reviews-quarterly.mjs --issue-file issue.md \
//     --title-file title.txt [--now 2026-10-01T09:00:00Z] [--root <repo>]
//
// Exit 0: the issue body and title were written from readable logs.
// Exit 1: a log was missing or malformed (the issue is still written and says
// so: the reviews are due regardless) or the arguments were wrong.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEWS, reviewSchedule } from './block-d-review-cadence.mjs';

export const ISSUE_LABEL = 'block-d-review';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** "2026-Q4" for any instant in October to December 2026 (UTC). */
export function quarterLabel(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('quarterLabel: not a date');
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export const issueTitle = (now) => `Quarterly Block D reviews: ${quarterLabel(now)}`;

/** One review's line in the issue: its schedule from its own log, or why the log could not be read. */
export function reviewStatus(review, markdown, today) {
  const schedule = reviewSchedule(markdown, review);
  if (schedule.failures.length > 0) return { review, ok: false, problem: schedule.failures.join('; ') };
  const state = today > schedule.due ? 'overdue' : schedule.due <= quarterEnd(today) ? 'due this quarter' : 'not yet due';
  return { review, ok: true, due: schedule.due, lastHuman: schedule.lastHuman, state };
}

/** The last day of the calendar quarter holding `date` (YYYY-MM-DD). */
export function quarterEnd(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const end = new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 3, 0));
  return end.toISOString().slice(0, 10);
}

export function buildIssue(statuses, now, runUrl = '') {
  const lines = [
    `The ${quarterLabel(now)} Block D reviews (Appendix H Parts 1.3 and 1.4). Each is a human review; an engineering pre-audit never counts as one.`,
    '',
  ];
  for (const s of statuses) {
    const r = s.review;
    lines.push(`### ${r.title} (${r.spec})`, `- Owner: ${r.owner}.`, `- Log: \`${r.doc}\`.`);
    if (s.ok) {
      lines.push(`- Last human review: ${s.lastHuman ?? 'none recorded yet'}.`, `- Next due: **${s.due}** (${s.state}).`);
    } else {
      lines.push(`- The log could not be read: ${s.problem}. The review is still due; fix the log when recording it.`);
    }
    lines.push(`- To complete it: ${r.record}`, '');
  }
  lines.push('Release readiness fails while any of these is overdue (`--strict` on each gate). Close this issue when all three are recorded, or when each is recorded as not yet due.');
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
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
    console.error('Usage: block-d-reviews-quarterly.mjs --issue-file <path> --title-file <path> [--now <ISO instant>] [--root <repo>]');
    process.exit(1);
  }
  const today = now.toISOString().slice(0, 10);
  const statuses = REVIEWS.map((review) => {
    let markdown = null;
    try { markdown = readFileSync(join(root, review.doc), 'utf8'); } catch { /* reported as missing */ }
    return reviewStatus(review, markdown, today);
  });
  writeFileSync(issueFile, buildIssue(statuses, now, process.env.RUN_URL ?? ''));
  writeFileSync(titleFile, issueTitle(now));
  for (const s of statuses) console.log(`${s.review.id}: ${s.ok ? `due ${s.due} (${s.state})` : `unreadable: ${s.problem}`}`);
  process.exit(statuses.every((s) => s.ok) ? 0 : 1);
}
