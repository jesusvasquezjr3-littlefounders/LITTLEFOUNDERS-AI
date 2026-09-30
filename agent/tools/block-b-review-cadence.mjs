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

/*
 * Appendix C Part 1.3 "Defect Escape Rate" / Part 3 Stage 6 (gap-fix round 7):
 * every defect escape opens a gate-effectiveness review in the database
 * (gate_effectiveness_reviews). One left open longer than the Block B
 * recalibration cadence warns here and fails under --strict (release
 * readiness). The value is logged as `gate_effectiveness.review_max_open_days`
 * and must equal Core's GATE_REVIEW_MAX_OPEN_DAYS (the staff panel's flag).
 */
export const GATE_REVIEW_MAX_OPEN_DAYS = 90;
const OWNER_LABEL = { pedagogical_lead: 'the Pedagogical Lead', content_engineering: 'content engineering' };

/** Whole days from an ISO timestamp to a YYYY-MM-DD day, or null when unparsable. */
function daysOpen(openedAt, today) {
  const opened = typeof openedAt === 'string' ? Date.parse(openedAt) : NaN;
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(opened) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - opened) / 86_400_000));
}

/**
 * `reviews`: the rows of gate_effectiveness_reviews_open() (review_id,
 * gate_id, owner_role, opened_at), or null when they could not be read
 * (`unread` says why). A malformed row fails; an overdue review warns, and
 * fails under `strict`; an unread source only warns, since a clean repo gate
 * has no database to read.
 */
export function checkGateEffectivenessReviews({ reviews, unread = null, today, strict = false, maxOpenDays = GATE_REVIEW_MAX_OPEN_DAYS }) {
  const failures = [];
  const warnings = [];
  if (reviews === null || reviews === undefined) {
    warnings.push(`open gate-effectiveness reviews were not checked (${unread ?? 'no source'}); pass --gate-reviews=<file.json> or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
    return { failures, warnings, overdue: [] };
  }
  if (!Array.isArray(reviews)) return { failures: ['gate-effectiveness reviews: expected a JSON array of open reviews'], warnings, overdue: [] };
  const overdue = [];
  for (const review of reviews) {
    const age = daysOpen(review?.opened_at, today);
    if (typeof review?.review_id !== 'string' || typeof review?.gate_id !== 'string' || age === null) {
      failures.push(`gate-effectiveness reviews: a row has no review id, gate or opening time (${JSON.stringify(review)})`);
      continue;
    }
    if (age > maxOpenDays) {
      overdue.push(review.review_id);
      const owner = OWNER_LABEL[review.owner_role] ?? review.owner_role ?? 'its owner';
      (strict ? failures : warnings).push(`the gate-effectiveness review ${review.review_id} for ${review.gate_id} (Appendix C 1.3 / Stage 6) has been open ${age} days, longer than ${maxOpenDays}; ${owner} must record why the gate missed the defect and what changed`);
    }
  }
  return { failures, warnings, overdue };
}

/**
 * Where the open reviews come from: `--gate-reviews=<file>` (an export of
 * gate_effectiveness_reviews_open()), else the service-role RPC when
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in this environment (a
 * read; nothing is written), else unread. `failed` marks a named source that
 * could not be read.
 */
export async function loadOpenGateReviews({ argv = [], env = {}, readFile, fetchImpl = globalThis.fetch }) {
  const flag = argv.find((arg) => arg.startsWith('--gate-reviews='));
  if (flag) {
    const path = flag.slice('--gate-reviews='.length);
    try { return { reviews: JSON.parse(readFile(path)), source: path }; }
    catch (error) { return { reviews: null, unread: `${path} is missing or not JSON: ${error.message}`, failed: true }; }
  }
  const base = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { reviews: null, unread: 'no --gate-reviews file and no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in this environment' };
  try {
    const res = await fetchImpl(`${base}/rest/v1/rpc/gate_effectiveness_reviews_open`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!res.ok) return { reviews: null, unread: `the database answered ${res.status} (is the gate_effectiveness_reviews migration applied?)`, failed: true };
    return { reviews: await res.json(), source: `${base} (service role)` };
  } catch (error) {
    return { reviews: null, unread: `the database could not be reached: ${error.message}`, failed: true };
  }
}
