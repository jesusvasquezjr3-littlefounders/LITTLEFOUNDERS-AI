// block-b-review-cadence.mjs — the due dates of the two recurring human
// Block B reviews that Appendix C names, read from the repository's records.
//
//   - Threshold Recalibration Log (Appendix C Part 1.3; Part 3 Stage 6):
//     "every threshold reviewed at least once per defined cadence (proposed:
//     quarterly for the first year, then per major release)",
//     docs/operations/BLOCK-B-THRESHOLD-LOG.md, `## Review history`;
//   - Age-Band Register Differentiation Audit (Part 1.3, B.23: "scheduled
//     manual audit (quarterly, proposed)"), dark-pattern checklist item
//     MN-03. Its last date is the latest of a `human` row under the log's
//     `## Register audit log` and a signed release audit in
//     docs/rebuild/audits/dark-pattern-audits.json that judged MN-03 (any
//     result but `open`).
//
// The log states one machine-readable "First human review due: YYYY-MM-DD"
// line for both. Engineering rows never count. The threshold review is then
// due 90 days after the latest human review, and 365 days after it once four
// (the first year) are recorded; the register audit stays quarterly. The
// parsing and the threshold schedule are Block D's (block-d-review-cadence.mjs,
// Appendix H 1.4 extends this same log duty), so both blocks read one way.
// check-block-b-thresholds.mjs warns when a review is overdue and fails with
// --strict (release readiness); block-b-reviews-quarterly.mjs opens the
// quarter's issue listing both.

import { addDays, QUARTER_DAYS, readFirstDue, readReviewTable, reviewSchedule } from './block-d-review-cadence.mjs';

export const LOG = 'docs/operations/BLOCK-B-THRESHOLD-LOG.md';
export const DARK_PATTERN_RECORD = 'docs/rebuild/audits/dark-pattern-audits.json';
/** The dark-pattern checklist item that is the register audit. */
export const REGISTER_AUDIT_ITEM = 'MN-03';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const REVIEWS = [
  {
    id: 'thresholds',
    title: 'Block B Threshold Recalibration',
    spec: 'Appendix C Part 1.3 and Part 3 Stage 6',
    doc: LOG,
    heading: 'Review history',
    owner: 'Pedagogical Lead, with Product and the content team',
    cadence: 'quarterly-then-yearly',
    record: 'Review every threshold against its data (the "What a recalibration looks at" list), change the constant, the log and any migration together, then add a `human` row to the review history.',
  },
  {
    id: 'register-audit',
    title: 'Age-Band Register Differentiation Audit',
    spec: `Appendix C Part 1.3 (B.23), dark-pattern checklist ${REGISTER_AUDIT_ITEM}`,
    doc: LOG,
    heading: 'Register audit log',
    also: DARK_PATTERN_RECORD,
    owner: 'Pedagogical Lead, with Product',
    cadence: 'quarterly',
    record: `Judge whether the young, transition, teen and adult registers are still genuinely distinct across new content, then add a \`human\` row to the register audit log (or judge ${REGISTER_AUDIT_ITEM} in a signed release audit).`,
  },
];

/** Dates of signed release audits that judged the register audit item (any result but open). */
export function registerAuditDates(record) {
  const failures = [];
  const dates = [];
  if (record === null || record === undefined) return { failures: [`${DARK_PATTERN_RECORD} is missing or not JSON`], dates };
  if (!Array.isArray(record.audits)) return { failures: [`${DARK_PATTERN_RECORD}: no audits array`], dates };
  for (const audit of record.audits) {
    if (audit?.kind !== 'release-audit') continue;
    const signed = typeof audit.signed_off_by === 'string' && audit.signed_off_by.trim().length >= 3;
    const result = audit.items?.[REGISTER_AUDIT_ITEM]?.result;
    if (!signed || !result || result === 'open') continue;
    if (!ISO.test(audit.date ?? '')) failures.push(`${DARK_PATTERN_RECORD}: release audit ${audit.id} has no valid date`);
    else dates.push(audit.date);
  }
  return { failures, dates: dates.sort() };
}

/**
 * When a Block B review is next due. `markdown` is the log's text; `record`
 * the parsed dark-pattern record (only the register audit reads it).
 */
export function blockBSchedule(review, { markdown, record }) {
  if (review.id === 'thresholds') return reviewSchedule(markdown, review);
  const failures = [];
  if (markdown === null || markdown === undefined) return { failures: [`${review.doc} is missing`], due: null, lastHuman: null, humanReviews: 0 };
  const firstDue = readFirstDue(markdown);
  if (!firstDue) failures.push(`${review.doc}: no machine-readable "First human review due: YYYY-MM-DD" line`);
  const table = readReviewTable(markdown, review.heading);
  const human = [];
  if (!table) failures.push(`${review.doc}: no "## ${review.heading}" table`);
  else {
    if (!table.columns.includes('date') || !table.columns.includes('kind')) failures.push(`${review.doc}: the ${review.heading} table needs Date and Kind columns`);
    for (const row of table.rows) {
      if (!ISO.test(row.date ?? '') || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date) {
        failures.push(`${review.doc}: a ${review.heading} row has no valid date ("${row.date}")`);
      } else if (!['engineering', 'human'].includes(row.kind)) failures.push(`${review.doc}: the ${row.date} row's kind is "${row.kind}", not one of engineering or human`);
      else if (row.kind === 'human') human.push(row.date);
    }
  }
  const signed = registerAuditDates(record);
  failures.push(...signed.failures);
  const all = [...human, ...signed.dates].sort();
  const lastHuman = all.at(-1) ?? null;
  if (failures.length > 0) return { failures, due: null, lastHuman, humanReviews: all.length };
  return { failures, due: lastHuman ? addDays(lastHuman, QUARTER_DAYS) : firstDue, lastHuman, humanReviews: all.length, interval: lastHuman ? QUARTER_DAYS : null };
}

/** Parse failures always fail; an overdue review warns, and fails under `strict` (release readiness). */
export function checkBlockBCadence({ markdown, record, today, strict = false }) {
  const failures = [];
  const warnings = [];
  const schedules = {};
  for (const review of REVIEWS) {
    const schedule = blockBSchedule(review, { markdown, record });
    schedules[review.id] = schedule;
    failures.push(...schedule.failures);
    if (schedule.due && today > schedule.due) {
      (strict ? failures : warnings).push(`the ${review.title} (${review.spec}) was due ${schedule.due} and no human review is recorded since ${schedule.lastHuman ?? 'the start'} (${review.doc}${review.also ? ` or ${review.also}` : ''})`);
    }
  }
  return { failures: [...new Set(failures)], warnings, schedules };
}
