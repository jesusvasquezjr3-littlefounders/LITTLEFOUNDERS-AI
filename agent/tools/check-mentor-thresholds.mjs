#!/usr/bin/env node
// check-mentor-thresholds.mjs — the quarterly human review of the Mentor's
// (Block C) Threshold Recalibration Log as a gate, not a sentence.
//
// Appendix F §1.4: "Every threshold reviewed at least once per defined cadence
// (proposed: quarterly for the first year)"; Part 3 Stage 7 runs the kill
// switches "on the cadence defined in the Threshold Recalibration Log"; C.10
// recalibrates each threshold together with the metric that watches it.
// docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md holds about a hundred
// provisional values, Stage 7 floors among them, and a lapsed review used to
// be invisible (gap-fix round 6). The log now carries a machine-readable
// "Review schedule" and a "Review history" table, and this gate reads both
// with the same parser as the Block D logs (block-d-review-cadence.mjs):
//
//   - a malformed schedule always FAILS: no first due date, no reviewers line
//     naming the Pedagogical Reviewer and the Safety/Trust Lead, no cadence
//     line, an undated or unknown-kind history row, a `human` row whose `By`
//     cell does not name both reviewers, or "Last human review" / "Next human
//     review due" lines that disagree with the history;
//   - an overdue review WARNS (spec:check, repo gates) and FAILS with
//     --strict (release readiness).
//
// mentor-thresholds-quarterly.mjs opens the quarter's review issue from the
// same schedule (.github/workflows/mentor-thresholds-quarterly.yml).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReviewCadence, readReviewTable, reportCadence } from './block-d-review-cadence.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const REVIEWERS = ['Pedagogical Reviewer', 'Safety/Trust Lead'];

export const MENTOR_THRESHOLD_REVIEW = {
  id: 'mentor-thresholds',
  title: 'Mentor (Block C) Threshold Recalibration',
  spec: 'Appendix F §1.4 and Part 3 Stage 7',
  doc: 'docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md',
  heading: 'Review history',
  owner: 'the Pedagogical Reviewer and the Safety/Trust Lead',
  cadence: 'quarterly-then-yearly',
  record:
    'Review every threshold against the metric that watches it (C.10), record any change in the change history with its evidence and previous value, add a `human` row to the review history naming both reviewers, then update the "Last human review" and "Next human review due" lines.',
};

/** The value of a `- <label>: <value>` line of the "## Review schedule" section, or null. */
function scheduleLine(section, label) {
  const match = new RegExp(`^- \\**${label}:\\**\\s*(.+)$`, 'mi').exec(section);
  return match ? match[1].replace(/\*\*/g, '').trim() : null;
}

/** The "## Review schedule" section's text, or null. */
export function scheduleSection(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === '## Review schedule');
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/**
 * Everything wrong with the log's schedule, plus the cadence verdict: parse
 * failures always fail; an overdue review warns, and fails under `strict`.
 */
export function checkMentorThresholds({ markdown, today, strict = false }) {
  const review = MENTOR_THRESHOLD_REVIEW;
  const cadence = checkReviewCadence({ markdown, review, today, strict });
  const failures = [...cadence.failures];
  if (markdown === null || markdown === undefined) return { failures, warnings: cadence.warnings, schedule: cadence.schedule };

  const section = scheduleSection(markdown);
  if (section === null) {
    failures.push(`${review.doc}: no "## Review schedule" section`);
  } else {
    const reviewers = scheduleLine(section, 'Reviewers') ?? '';
    for (const who of REVIEWERS) {
      if (!reviewers.includes(who)) failures.push(`${review.doc}: the "Reviewers" line must name the ${who} (Appendix F §1.4, C.22)`);
    }
    const cadenceLine = scheduleLine(section, 'Cadence') ?? '';
    if (!/quarterly/i.test(cadenceLine)) failures.push(`${review.doc}: the "Cadence" line must state the quarterly first-year cadence (Appendix F §1.4)`);
    const schedule = cadence.schedule;
    if (schedule.due) {
      const last = scheduleLine(section, 'Last human review');
      const next = scheduleLine(section, 'Next human review due');
      const lastStated = last === null ? undefined : /^none\b/i.test(last) ? null : (/^(\d{4}-\d{2}-\d{2})/.exec(last)?.[1] ?? undefined);
      if (lastStated === undefined) failures.push(`${review.doc}: no machine-readable "Last human review: YYYY-MM-DD | none" line`);
      else if (lastStated !== schedule.lastHuman) {
        failures.push(`${review.doc}: "Last human review" says ${lastStated ?? 'none'}, the review history says ${schedule.lastHuman ?? 'none'}`);
      }
      const nextStated = next === null ? null : (/^(\d{4}-\d{2}-\d{2})/.exec(next)?.[1] ?? null);
      if (nextStated === null) failures.push(`${review.doc}: no machine-readable "Next human review due: YYYY-MM-DD" line`);
      else if (nextStated !== schedule.due) failures.push(`${review.doc}: "Next human review due" says ${nextStated}, the schedule computes ${schedule.due}`);
    }
  }

  const table = readReviewTable(markdown, review.heading);
  if (table && !table.columns.includes('by')) failures.push(`${review.doc}: the ${review.heading} table needs a By column`);
  for (const row of table?.rows ?? []) {
    if (row.kind !== 'human') continue;
    for (const who of REVIEWERS) {
      if (!(row.by ?? '').includes(who)) failures.push(`${review.doc}: the ${row.date} human review does not name the ${who} in its By cell (both must review)`);
    }
  }
  return { failures, warnings: cadence.warnings, schedule: cadence.schedule };
}

export function readLog(root = ROOT) {
  try {
    return readFileSync(join(root, MENTOR_THRESHOLD_REVIEW.doc), 'utf8');
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes('--strict');
  const today = new Date().toISOString().slice(0, 10);
  const result = checkMentorThresholds({ markdown: readLog(), today, strict });
  if (reportCadence(result)) {
    console.error(`mentor-thresholds FAILED — fix ${MENTOR_THRESHOLD_REVIEW.doc} (Appendix F §1.4)`);
    process.exit(1);
  }
  console.log(
    `mentor-thresholds OK — the Block C Threshold Recalibration Log's review schedule is readable; last human review ${result.schedule.lastHuman ?? 'none'}; next human review due ${result.schedule.due}${strict ? ' (not overdue)' : ''}`,
  );
}
