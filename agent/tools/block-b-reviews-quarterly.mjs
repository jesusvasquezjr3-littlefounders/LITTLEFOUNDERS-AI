#!/usr/bin/env node
// Appendix C Part 1.3 and Part 3 Stage 6 (GAP-FIX-R6): the QUARTERLY Block B
// reviews, calendar-triggered.
//
// Two recurring human reviews have a quarterly cadence in Appendix C: the
// Threshold Recalibration Log (quarterly for the first year, then per major
// release) and the Age-Band Register Differentiation Audit (B.23, dark-pattern
// checklist MN-03). Their due dates come from docs/operations/BLOCK-B-THRESHOLD-LOG.md
// and, for the register audit, the dark-pattern record
// (block-b-review-cadence.mjs); release readiness fails on an overdue one.
// This is the calendar trigger: on the first day of each calendar quarter,
// block-b-reviews-quarterly.yml runs this tool and opens one issue listing
// both, with each owner, the last human review, the next due date and whether
// it is overdue, whether or not one is due yet.
//
//   node agent/tools/block-b-reviews-quarterly.mjs --issue-file issue.md \
//     --title-file title.txt [--now 2026-10-01T09:00:00Z] [--root <repo>]
//
// Exit 0: the issue body and title were written from readable records.
// Exit 1: a record was missing or malformed (the issue is still written and
// says so: the reviews are due regardless) or the arguments were wrong.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockBSchedule, DARK_PATTERN_RECORD, LOG, REVIEWS } from './block-b-review-cadence.mjs';
import { quarterEnd, quarterLabel } from './block-d-reviews-quarterly.mjs';

export const ISSUE_LABEL = 'block-b-review';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const issueTitle = (now) => `Quarterly Block B reviews: ${quarterLabel(now)}`;

/** One review's line in the issue: its schedule from the records, or why they could not be read. */
export function reviewStatus(review, inputs, today) {
  const schedule = blockBSchedule(review, inputs);
  if (schedule.failures.length > 0) return { review, ok: false, problem: schedule.failures.join('; ') };
  const state = today > schedule.due ? 'overdue' : schedule.due <= quarterEnd(today) ? 'due this quarter' : 'not yet due';
  return { review, ok: true, due: schedule.due, lastHuman: schedule.lastHuman, state };
}

export function buildIssue(statuses, now, runUrl = '') {
  const lines = [
    `The ${quarterLabel(now)} Block B reviews (Appendix C Part 1.3 and Part 3 Stage 6). Each is a human review; an engineering pre-audit never counts as one.`,
    '',
  ];
  for (const s of statuses) {
    const r = s.review;
    lines.push(`### ${r.title} (${r.spec})`, `- Owner: ${r.owner}.`, `- Record: \`${r.doc}\`${r.also ? ` and \`${r.also}\`` : ''}.`);
    if (s.ok) {
      lines.push(`- Last human review: ${s.lastHuman ?? 'none recorded yet'}.`, `- Next due: **${s.due}** (${s.state}).`);
    } else {
      lines.push(`- The record could not be read: ${s.problem}. The review is still due; fix the record when recording it.`);
    }
    lines.push(`- To complete it: ${r.record}`, '');
  }
  lines.push('Release readiness fails while either is overdue (`check-block-b-thresholds.mjs --strict`). Close this issue when both are recorded, or when each is recorded as not yet due.');
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
}

/** The records under `root`, as the cadence reads them (null when missing or unreadable). */
export function readInputs(root) {
  let markdown = null;
  let record = null;
  try { markdown = readFileSync(join(root, LOG), 'utf8'); } catch { /* reported as missing */ }
  try { record = JSON.parse(readFileSync(join(root, DARK_PATTERN_RECORD), 'utf8')); } catch { /* reported as missing */ }
  return { markdown, record };
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
    console.error('Usage: block-b-reviews-quarterly.mjs --issue-file <path> --title-file <path> [--now <ISO instant>] [--root <repo>]');
    process.exit(1);
  }
  const today = now.toISOString().slice(0, 10);
  const inputs = readInputs(root);
  const statuses = REVIEWS.map((review) => reviewStatus(review, inputs, today));
  writeFileSync(issueFile, buildIssue(statuses, now, process.env.RUN_URL ?? ''));
  writeFileSync(titleFile, issueTitle(now));
  for (const s of statuses) console.log(`${s.review.id}: ${s.ok ? `due ${s.due} (${s.state})` : `unreadable: ${s.problem}`}`);
  process.exit(statuses.every((s) => s.ok) ? 0 : 1);
}
