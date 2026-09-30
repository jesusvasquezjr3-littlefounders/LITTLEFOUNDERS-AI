#!/usr/bin/env node
// block-e-review-cadence.mjs — the Block E (social layer) recurring human
// reviews as a gate, read from their own log (gap-fix round 7, social).
//
// docs/rebuild/policies/SOCIAL-GOVERNANCE.md carries two dated tables, both
// owned by the Safety/Trust Lead:
//   - §1.2 Threshold Recalibration Log (Appendix J Part 1.4: "every threshold
//     reviewed at least once per defined cadence (proposed: quarterly for the
//     first year)"; Part 3 Stage 7: the Safety/Trust Lead, on that cadence).
//     Each row states its value, where it is enforced, when it was last
//     reviewed and when the next review is due.
//   - §1.3 Regulatory watch list (E.7: the moving regulation is re-checked
//     against current primary sources, with counsel, on the Appendix B/D/G
//     cadence). Each row states when it was last re-checked (or "not yet")
//     and when the next re-check is due.
//
// The first year runs from the earliest §1.4 recalibration record (the
// policy's adoption). Inside it no due date may sit more than a quarter
// (MAX_FIRST_YEAR_DAYS) after its last review (or, for a watch-list item never
// re-checked, after the adoption); after it, no more than a year.
//
//   node agent/tools/block-e-review-cadence.mjs [--strict] [--today YYYY-MM-DD] [--root <repo>]
//     A malformed log always fails. An overdue row warns, and fails under
//     --strict (release readiness, agent/tools/release-readiness.sh). The repo
//     gates run it without --strict; `guardrails:check` separately fails on an
//     overdue §1.2 row. block-e-reviews-quarterly.mjs builds the quarter's
//     issue from the same parse.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const POLICY = 'docs/rebuild/policies/SOCIAL-GOVERNANCE.md';
export const OWNER = 'Safety/Trust Lead';
export const LOG_HEADING = '### 1.2 Threshold Recalibration Log (Block E)';
export const WATCH_HEADING = '### 1.3 Regulatory watch list';
export const RECORD_HEADING = '### 1.4 Recalibration record';
/** Block E lists at least this many thresholds (the check-social-governance.mjs floor). */
export const MIN_THRESHOLDS = 8;
/** A calendar quarter, with a day of slack for 92-day quarters. */
export const MAX_FIRST_YEAR_DAYS = 92;
export const MAX_LATER_DAYS = 366;
const FIRST_YEAR_DAYS = 365;
const NOT_YET = 'not yet';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DAY_MS = 86_400_000;
const utc = (date) => Date.parse(`${date}T00:00:00Z`);
export const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && Number.isFinite(utc(value)) && new Date(utc(value)).toISOString().slice(0, 10) === value;
export const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / DAY_MS);
export const addDays = (date, days) => new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10);

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

/** The markdown table under `heading` (up to the next heading), keyed by lower-cased header names; null when the heading is absent. */
export function tableUnder(markdown, heading) {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return null;
  const table = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,6} /.test(line)) break;
    if (line.startsWith('|')) table.push(line);
    else if (table.length > 0) break;
  }
  if (table.length === 0) return { columns: [], rows: [] };
  const columns = cells(table[0]).map((c) => c.toLowerCase());
  const rows = table.slice(1).filter((line) => !/^\|[\s|:-]+\|$/.test(line)).map((line) => {
    const values = cells(line);
    return Object.fromEntries(columns.map((column, i) => [column, values[i] ?? '']));
  });
  return { columns, rows };
}

const need = (table, columns, heading, failures) => {
  const missing = columns.filter((c) => !table.columns.includes(c));
  if (missing.length) failures.push(`${POLICY}: the "${heading.replace(/^#+ /, '')}" table needs the column(s) ${missing.map((c) => `"${c}"`).join(', ')}`);
  return missing.length === 0;
};

/**
 * Parses both dated tables. Returns { failures, adoption, thresholds, watch }:
 * failures name every malformed row; thresholds and watch carry
 * { name, value, enforcedIn, last, due } and { item, why, status, last, due }.
 */
export function readBlockELog(markdown) {
  const failures = [];
  if (markdown === null || markdown === undefined) return { failures: [`${POLICY} is missing`], adoption: null, thresholds: [], watch: [] };

  const record = tableUnder(markdown, RECORD_HEADING);
  const recordDates = (record?.rows ?? []).map((r) => r.date).filter(validDate).sort();
  const adoption = recordDates[0] ?? null;
  if (!record) failures.push(`${POLICY}: no "${RECORD_HEADING.slice(4)}" section`);
  else if (!adoption) failures.push(`${POLICY}: the recalibration record has no dated row, so the first year has no start`);
  const firstYearEnd = adoption ? addDays(adoption, FIRST_YEAR_DAYS) : null;
  const maxInterval = (from) => (firstYearEnd && from < firstYearEnd ? MAX_FIRST_YEAR_DAYS : MAX_LATER_DAYS);

  const thresholds = [];
  const log = tableUnder(markdown, LOG_HEADING);
  if (!log) failures.push(`${POLICY}: no "${LOG_HEADING.slice(4)}" section`);
  else if (need(log, ['threshold', 'current value', 'enforced in', 'last reviewed', 'next review due'], LOG_HEADING, failures)) {
    if (log.rows.length < MIN_THRESHOLDS) failures.push(`${POLICY}: the Threshold Recalibration Log lists ${log.rows.length} thresholds; Block E has at least ${MIN_THRESHOLDS}`);
    for (const row of log.rows) {
      const entry = { name: row.threshold, value: row['current value'], enforcedIn: row['enforced in'], last: row['last reviewed'], due: row['next review due'] };
      if (!entry.name) failures.push(`${POLICY}: a Threshold Recalibration Log row has no threshold name`);
      if (!validDate(entry.last) || !validDate(entry.due)) failures.push(`${POLICY}: recalibration row "${entry.name}" needs ISO "Last reviewed" and "Next review due" dates`);
      else if (entry.due <= entry.last) failures.push(`${POLICY}: recalibration row "${entry.name}" is due before it was last reviewed`);
      else if (daysBetween(entry.last, entry.due) > maxInterval(entry.last)) failures.push(`${POLICY}: recalibration row "${entry.name}" is due ${daysBetween(entry.last, entry.due)} days after its last review; the cadence allows ${maxInterval(entry.last)} (Appendix J Part 1.4)`);
      thresholds.push(entry);
    }
  }

  const watch = [];
  const list = tableUnder(markdown, WATCH_HEADING);
  if (!list) failures.push(`${POLICY}: no "${WATCH_HEADING.slice(4)}" section`);
  else if (need(list, ['item', 'why it matters here', 'status', 'last re-checked', 'next re-check due'], WATCH_HEADING, failures)) {
    if (list.rows.length === 0) failures.push(`${POLICY}: the regulatory watch list is empty (E.7)`);
    for (const row of list.rows) {
      const entry = { item: row.item, why: row['why it matters here'], status: row.status, last: row['last re-checked'], due: row['next re-check due'] };
      const neverChecked = entry.last.toLowerCase() === NOT_YET;
      if (!entry.item) failures.push(`${POLICY}: a regulatory watch-list row has no item`);
      if (!neverChecked && !validDate(entry.last)) failures.push(`${POLICY}: watch-list item "${entry.item}" needs an ISO "Last re-checked" date or "${NOT_YET}"`);
      else if (!validDate(entry.due)) failures.push(`${POLICY}: watch-list item "${entry.item}" needs an ISO "Next re-check due" date`);
      else {
        const from = neverChecked ? adoption : entry.last;
        if (from && entry.due <= from) failures.push(`${POLICY}: watch-list item "${entry.item}" is due before it was last re-checked`);
        else if (from && daysBetween(from, entry.due) > maxInterval(from)) failures.push(`${POLICY}: watch-list item "${entry.item}" is due ${daysBetween(from, entry.due)} days after ${neverChecked ? 'the adoption' : 'its last re-check'}; the cadence allows ${maxInterval(from)} (E.7)`);
      }
      if (neverChecked) entry.last = null;
      watch.push(entry);
    }
  }
  return { failures, adoption, thresholds, watch };
}

/** The rows past their due date on `today` (YYYY-MM-DD). */
export function overdueRows(log, today) {
  return [
    ...log.thresholds.filter((t) => validDate(t.due) && today > t.due).map((t) => `the Block E recalibration of "${t.name}" (Appendix J Part 1.4) was due ${t.due}; the ${OWNER} records the review in ${POLICY} §1.2 and §1.4`),
    ...log.watch.filter((w) => validDate(w.due) && today > w.due).map((w) => `the regulatory re-check of "${w.item}" (E.7) was due ${w.due}; the ${OWNER} and counsel record it in ${POLICY} §1.3 and §1.4`),
  ];
}

/** The gate: a malformed log always fails; an overdue row warns, and fails under `strict`. */
export function checkBlockEReview({ markdown, today, strict = false }) {
  const log = readBlockELog(markdown);
  const failures = [...log.failures];
  const warnings = [];
  for (const overdue of overdueRows(log, today)) (strict ? failures : warnings).push(overdue);
  const dues = [...log.thresholds, ...log.watch].map((r) => r.due).filter(validDate).sort();
  return { failures, warnings, log, nextDue: dues[0] ?? null };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = arg('--root') ?? ROOT;
  const today = arg('--today') ?? new Date().toISOString().slice(0, 10);
  if (!validDate(today)) {
    console.error('block-e-review-cadence: --today must be YYYY-MM-DD');
    process.exit(1);
  }
  let markdown = null;
  try { markdown = readFileSync(join(root, POLICY), 'utf8'); } catch { /* reported as missing */ }
  const result = checkBlockEReview({ markdown, today, strict: process.argv.includes('--strict') });
  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  for (const failure of result.failures) console.error(`FAIL: ${failure}`);
  if (result.failures.length > 0) process.exit(1);
  console.log(`block-e-review-cadence OK — ${result.log.thresholds.length} Block E thresholds and ${result.log.watch.length} watch-list items logged; earliest next review due ${result.nextDue}`);
}
