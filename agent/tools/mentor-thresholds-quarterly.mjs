#!/usr/bin/env node
// Appendix F §1.4 / Part 3 Stage 7 (gap-fix round 6): the QUARTERLY review of
// the Mentor's (Block C) Threshold Recalibration Log, calendar-triggered.
//
// The log carries its own schedule (check-mentor-thresholds.mjs), and release
// readiness fails on an overdue review. This is the calendar trigger: on the
// first day of each calendar quarter, mentor-thresholds-quarterly.yml runs
// this tool and opens one issue for the Pedagogical Reviewer and the
// Safety/Trust Lead with the last human review, the next due date and whether
// it is overdue, whether or not one is due yet.
//
//   node agent/tools/mentor-thresholds-quarterly.mjs --issue-file issue.md \
//     --title-file title.txt [--now 2026-10-01T09:00:00Z] [--root <repo>]
//
// Exit 0: the issue body and title were written from a readable log.
// Exit 1: the log was missing or malformed (the issue is still written and
// says so: the review is due regardless) or the arguments were wrong.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quarterEnd, quarterLabel } from './block-d-reviews-quarterly.mjs';
import { checkMentorThresholds, MENTOR_THRESHOLD_REVIEW, readLog } from './check-mentor-thresholds.mjs';

export const ISSUE_LABEL = 'mentor-threshold-review';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const issueTitle = (now) => `Quarterly Mentor threshold review: ${quarterLabel(now)}`;

/** The review's state from its own log, or why the log could not be read. */
export function reviewStatus(markdown, today) {
  const result = checkMentorThresholds({ markdown, today });
  if (result.failures.length > 0) return { ok: false, problem: result.failures.join('; ') };
  const { due, lastHuman } = result.schedule;
  const state = today > due ? 'overdue' : due <= quarterEnd(today) ? 'due this quarter' : 'not yet due';
  return { ok: true, due, lastHuman, state };
}

export function buildIssue(status, now, runUrl = '') {
  const r = MENTOR_THRESHOLD_REVIEW;
  const lines = [
    `The ${quarterLabel(now)} review of the Mentor's Threshold Recalibration Log (${r.spec}). It is a human review; an engineering row never counts as one.`,
    '',
    `- Owners: ${r.owner} (both must review).`,
    `- Log: \`${r.doc}\`.`,
  ];
  if (status.ok) {
    lines.push(`- Last human review: ${status.lastHuman ?? 'none recorded yet'}.`, `- Next due: **${status.due}** (${status.state}).`);
  } else {
    lines.push(`- The log could not be read: ${status.problem}. The review is still due; fix the log when recording it.`);
  }
  lines.push(
    `- To complete it: ${r.record}`,
    '',
    'Release readiness fails while this review is overdue (`node agent/tools/check-mentor-thresholds.mjs --strict`). Close this issue when the review is recorded, or when it is recorded as not yet due.',
  );
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
    console.error('Usage: mentor-thresholds-quarterly.mjs --issue-file <path> --title-file <path> [--now <ISO instant>] [--root <repo>]');
    process.exit(1);
  }
  const status = reviewStatus(readLog(root), now.toISOString().slice(0, 10));
  writeFileSync(issueFile, buildIssue(status, now, process.env.RUN_URL ?? ''));
  writeFileSync(titleFile, issueTitle(now));
  console.log(`${MENTOR_THRESHOLD_REVIEW.id}: ${status.ok ? `due ${status.due} (${status.state})` : `unreadable: ${status.problem}`}`);
  process.exit(status.ok ? 0 : 1);
}
