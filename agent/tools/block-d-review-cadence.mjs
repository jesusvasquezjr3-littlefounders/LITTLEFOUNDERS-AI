// block-d-review-cadence.mjs — the due dates of the three recurring human
// Block D reviews that Appendix H names, read from their own logs.
//
//   - Threshold Recalibration Log (Appendix H Part 1.4): "every threshold
//     reviewed at least once per defined cadence (proposed: quarterly for the
//     first year)", docs/operations/BLOCK-D-THRESHOLD-LOG.md;
//   - No-Unbacked-Guarantee Audit (Part 1.3, "scheduled manual audit
//     (quarterly, proposed)"), docs/operations/NO-UNBACKED-GUARANTEE.md;
//   - Scope-Disclosure Presence & Accuracy Audit (Part 1.3, quarterly),
//     docs/operations/BLOCK-D-SCOPE-STATEMENT.md.
//
// Each log's table has a `Kind` column: `engineering` rows record what a lane
// did (values set, a pre-audit) and never count as the review; only a `human`
// row does. Each log also states, machine-readably, when the first human
// review is due ("First human review due: YYYY-MM-DD", one quarter after the
// release that ships S07.3). The next review is due:
//   - on that first date while no human review is recorded;
//   - QUARTER_DAYS after the latest human review, and for the threshold log
//     (quarterly for the first year, then yearly) YEAR_DAYS once four human
//     reviews, the first year's, are recorded.
// check-block-d-thresholds.mjs, check-no-unbacked-guarantee.mjs and
// check-block-d-scope.mjs warn when a review is overdue and fail under
// --strict (release readiness); block-d-reviews-quarterly.mjs opens the
// quarter's issue listing all three. Mirrors the Appendix G recalibration
// check in check-block-d-research.mjs.

export const QUARTER_DAYS = 90;
export const YEAR_DAYS = 365;
/** The number of human reviews that make up the threshold log's quarterly first year. */
export const FIRST_YEAR_REVIEWS = 4;
const KINDS = ['engineering', 'human'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const REVIEWS = [
  {
    id: 'thresholds',
    title: 'Block D Threshold Recalibration',
    spec: 'Appendix H Part 1.4',
    doc: 'docs/operations/BLOCK-D-THRESHOLD-LOG.md',
    heading: 'Review history',
    owner: 'Pedagogical Lead, with Product',
    cadence: 'quarterly-then-yearly',
    record: 'Review every threshold against its metric (the "What a recalibration looks at" list), then add a `human` row to the review history.',
  },
  {
    id: 'no-unbacked-guarantee',
    title: 'No-Unbacked-Guarantee Audit',
    spec: 'Appendix H Part 1.3 (D.7)',
    doc: 'docs/operations/NO-UNBACKED-GUARANTEE.md',
    heading: 'Audit log',
    owner: 'Pedagogical Lead, with the Engineering Lead (plus one reviewer who did not build the change)',
    cadence: 'quarterly',
    record: 'Run the checklist in "The quarterly audit (human)", then add a `human` row to the audit log.',
  },
  {
    id: 'scope-disclosure',
    title: 'Scope-Disclosure Presence & Accuracy Audit',
    spec: 'Appendix H Part 1.3 (D.20)',
    doc: 'docs/operations/BLOCK-D-SCOPE-STATEMENT.md',
    heading: 'Audit log',
    owner: 'Product, with the Pedagogical Lead',
    cadence: 'quarterly',
    record: 'Check the four points of the quarterly audit, then add a `human` row to the audit log.',
  },
];

const DAY_MS = 86_400_000;
const utc = (date) => Date.parse(`${date}T00:00:00Z`);
/** `date` plus `days` whole days, as YYYY-MM-DD (UTC calendar arithmetic). */
export function addDays(date, days) {
  return new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10);
}
const validDate = (value) => ISO.test(value ?? '') && Number.isFinite(utc(value)) && new Date(utc(value)).toISOString().slice(0, 10) === value;

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

/** The rows of the table under `## <heading>`, as objects keyed by the header's lower-cased column names. */
export function readReviewTable(markdown, heading) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return null;
  const table = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (line.startsWith('|')) table.push(line);
    else if (table.length > 0) break;
  }
  if (table.length < 2) return { columns: table.length ? cells(table[0]).map((c) => c.toLowerCase()) : [], rows: [] };
  const columns = cells(table[0]).map((c) => c.toLowerCase());
  const rows = table.slice(1).filter((line) => !/^\|[\s|:-]+\|$/.test(line)).map((line) => {
    const values = cells(line);
    return Object.fromEntries(columns.map((column, i) => [column, values[i] ?? '']));
  });
  return { columns, rows };
}

/** The log's stated first due date ("First human review due: YYYY-MM-DD"), or null. */
export function readFirstDue(markdown) {
  const match = /First human review due:\**\s*(\d{4}-\d{2}-\d{2})/.exec(markdown);
  return match && validDate(match[1]) ? match[1] : null;
}

/**
 * When `review` is next due, from its log's text. Returns the parse failures
 * (a missing table or Kind column, an undated row, an unknown kind, no first
 * due date) and, when the log is readable, the schedule.
 */
export function reviewSchedule(markdown, review) {
  const failures = [];
  const where = `${review.doc}`;
  if (markdown === null || markdown === undefined) return { failures: [`${where} is missing`], due: null, lastHuman: null, humanReviews: 0 };
  const table = readReviewTable(markdown, review.heading);
  const firstDue = readFirstDue(markdown);
  if (!firstDue) failures.push(`${where}: no machine-readable "First human review due: YYYY-MM-DD" line`);
  if (!table) return { failures: [...failures, `${where}: no "## ${review.heading}" table`], due: null, lastHuman: null, humanReviews: 0 };
  if (!table.columns.includes('date') || !table.columns.includes('kind')) failures.push(`${where}: the ${review.heading} table needs Date and Kind columns`);
  const human = [];
  for (const row of table.rows) {
    if (!validDate(row.date)) failures.push(`${where}: a ${review.heading} row has no valid date ("${row.date}")`);
    else if (!KINDS.includes(row.kind)) failures.push(`${where}: the ${row.date} row's kind is "${row.kind}", not one of ${KINDS.join(' or ')}`);
    else if (row.kind === 'human') human.push(row.date);
  }
  human.sort();
  const lastHuman = human.at(-1) ?? null;
  if (failures.length > 0) return { failures, due: null, lastHuman, humanReviews: human.length };
  const interval = review.cadence === 'quarterly-then-yearly' && human.length >= FIRST_YEAR_REVIEWS ? YEAR_DAYS : QUARTER_DAYS;
  const due = lastHuman ? addDays(lastHuman, interval) : firstDue;
  return { failures, due, lastHuman, humanReviews: human.length, interval: lastHuman ? interval : null };
}

/**
 * The gate half: parse failures always fail; an overdue review warns, and
 * fails under `strict` (release readiness), as the Appendix G recalibration does.
 */
export function checkReviewCadence({ markdown, review, today, strict = false }) {
  const schedule = reviewSchedule(markdown, review);
  const failures = [...schedule.failures];
  const warnings = [];
  if (schedule.due && today > schedule.due) {
    (strict ? failures : warnings).push(`the ${review.title} (${review.spec}) was due ${schedule.due} and no human review is recorded in ${review.doc} since ${schedule.lastHuman ?? 'the start'}`);
  }
  return { failures, warnings, schedule };
}

/** Prints warnings and failures of a cadence check; returns whether it failed. */
export function reportCadence(result) {
  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  for (const failure of result.failures) console.error(`FAIL: ${failure}`);
  return result.failures.length > 0;
}
