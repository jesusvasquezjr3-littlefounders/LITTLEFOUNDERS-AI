import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  addDays, checkReviewCadence, FIRST_YEAR_REVIEWS, QUARTER_DAYS, readFirstDue, readReviewTable, REVIEWS, reviewSchedule, YEAR_DAYS,
} from './block-d-review-cadence.mjs';

/*
 * GAP-FIX-R5 (Appendix H Part 1.4 and Part 1.3): the three recurring human
 * Block D reviews have a due date read from their own logs, an engineering
 * row never counts as the review, and an overdue review warns in the repo
 * gates and fails under --strict (release readiness).
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const byId = (id) => REVIEWS.find((r) => r.id === id);
const thresholds = byId('thresholds');
const quarterly = byId('scope-disclosure');

const log = (rows, { heading = 'Review history', firstDue = '2027-01-15', columns = '| Date | Kind | Keys | Decision | By |' } = {}) => [
  '# A log', '', firstDue ? `**First human review due: ${firstDue}** (one quarter after the release).` : 'No date here.', '',
  `## ${heading}`, '', columns, `|${columns.split('|').slice(1, -1).map(() => '---').join('|')}|`,
  ...rows.map(([date, kind]) => `| ${date} | ${kind} | \`x.*\` | A decision. | Someone |`), '', '## Next section', '',
].join('\n');
/** The same log under the audits' heading. */
const audit = (rows, options = {}) => log(rows, { heading: 'Audit log', ...options });

test('the cadence is quarterly, and the threshold log goes yearly after its first year', () => {
  assert.equal(QUARTER_DAYS, 90);
  assert.equal(YEAR_DAYS, 365);
  assert.equal(FIRST_YEAR_REVIEWS, 4);
  assert.deepEqual(REVIEWS.map((r) => [r.id, r.cadence]), [['thresholds', 'quarterly-then-yearly'], ['no-unbacked-guarantee', 'quarterly'], ['scope-disclosure', 'quarterly']]);
  assert.equal(addDays('2026-12-15', 90), '2027-03-15');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('names the owners Appendix H assigns', () => {
  assert.match(thresholds.owner, /Pedagogical Lead, with Product/);
  assert.match(byId('no-unbacked-guarantee').owner, /Pedagogical Lead, with the Engineering Lead/);
  assert.match(quarterly.owner, /Product, with the Pedagogical Lead/);
});

test('reads the table under its heading and the first due date', () => {
  const text = log([['2026-09-24', 'engineering'], ['2026-12-20', 'human']]);
  const table = readReviewTable(text, 'Review history');
  assert.deepEqual(table.columns, ['date', 'kind', 'keys', 'decision', 'by']);
  assert.deepEqual(table.rows.map((r) => [r.date, r.kind]), [['2026-09-24', 'engineering'], ['2026-12-20', 'human']]);
  assert.equal(readFirstDue(text), '2027-01-15');
  assert.equal(readReviewTable(text, 'Audit log'), null);
});

test('engineering rows never count: with none human, the first due date holds', () => {
  const s = reviewSchedule(log([['2026-09-24', 'engineering'], ['2026-09-25', 'engineering']]), thresholds);
  assert.deepEqual(s.failures, []);
  assert.equal(s.lastHuman, null);
  assert.equal(s.due, '2027-01-15');
});

test('a human review moves the due date one quarter past it', () => {
  const s = reviewSchedule(audit([['2026-09-24', 'engineering'], ['2027-01-10', 'human']]), quarterly);
  assert.equal(s.lastHuman, '2027-01-10');
  assert.equal(s.due, '2027-04-10');
  // Rows are not assumed to be in order.
  assert.equal(reviewSchedule(audit([['2027-04-02', 'human'], ['2027-01-10', 'human']]), quarterly).due, '2027-07-01');
});

test('the threshold log is yearly once four human reviews are recorded; the audits stay quarterly', () => {
  const four = [['2027-01-10', 'human'], ['2027-04-08', 'human'], ['2027-07-05', 'human'], ['2027-10-01', 'human']];
  assert.equal(reviewSchedule(log(four.slice(0, 3)), thresholds).due, '2027-10-03');
  assert.equal(reviewSchedule(log(four), thresholds).due, '2028-09-30');
  assert.equal(reviewSchedule(audit(four), quarterly).due, '2027-12-30');
});

test('overdue warns in the repo gates and fails under --strict', () => {
  const text = audit([['2026-09-24', 'engineering']]);
  const onTime = checkReviewCadence({ markdown: text, review: quarterly, today: '2027-01-15' });
  assert.deepEqual([onTime.failures, onTime.warnings], [[], []]);
  const late = checkReviewCadence({ markdown: text, review: quarterly, today: '2027-01-16' });
  assert.deepEqual(late.failures, []);
  assert.match(late.warnings[0], /Scope-Disclosure .* was due 2027-01-15/);
  const strict = checkReviewCadence({ markdown: text, review: quarterly, today: '2027-01-16', strict: true });
  assert.equal(strict.warnings.length, 0);
  assert.match(strict.failures[0], /was due 2027-01-15 and no human review is recorded/);
  // A later human review clears it.
  const done = checkReviewCadence({ markdown: audit([['2026-09-24', 'engineering'], ['2027-01-14', 'human']]), review: quarterly, today: '2027-04-13', strict: true });
  assert.deepEqual(done.failures, []);
});

test('a malformed log fails whatever the date: no Kind column, an unknown kind, an undated row, no first due date, no table', () => {
  const fails = (text) => reviewSchedule(text, thresholds).failures.join('\n');
  assert.match(fails(log([['2026-09-24', 'engineering']], { columns: '| Date | Keys | Decision | By | Extra |' })), /Date and Kind columns/);
  assert.match(fails(log([['2026-09-24', 'Engineering (S07 lane)']])), /kind is "Engineering \(S07 lane\)"/);
  assert.match(fails(log([['24 Sep 2026', 'human']])), /no valid date/);
  assert.match(fails(log([['2026-02-30', 'human']])), /no valid date/);
  assert.match(fails(log([['2026-09-24', 'human']], { firstDue: null })), /First human review due/);
  assert.match(fails(log([['2026-09-24', 'human']], { heading: 'History' })), /no "## Review history" table/);
  assert.match(reviewSchedule(null, thresholds).failures[0], /is missing/);
  assert.equal(checkReviewCadence({ markdown: log([['x', 'human']]), review: thresholds, today: '2026-01-01' }).failures.length, 1);
});

test('the three live logs parse, count no engineering row and are due on the first date', () => {
  for (const review of REVIEWS) {
    const text = readFileSync(`${repo}${review.doc}`, 'utf8');
    const s = reviewSchedule(text, review);
    assert.deepEqual(s.failures, [], review.id);
    const table = readReviewTable(text, review.heading);
    assert.ok(table.rows.length > 0, review.id);
    assert.ok(table.rows.every((r) => r.kind === 'engineering' || r.kind === 'human'), review.id);
    // Until a human review is recorded, each is due on its log's first date.
    if (s.lastHuman === null) assert.equal(s.due, readFirstDue(text), review.id);
    assert.ok(s.due >= '2027-01-15', `${review.id}: due ${s.due}`);
  }
});

test('each gate takes --strict and release readiness passes it to all three', () => {
  const readiness = readFileSync(`${repo}agent/tools/release-readiness.sh`, 'utf8');
  for (const tool of ['check-block-d-thresholds.mjs', 'check-no-unbacked-guarantee.mjs', 'check-block-d-scope.mjs', 'check-block-d-research.mjs']) {
    assert.match(readiness, new RegExp(`^node agent/tools/${tool.replace('.', '\\.')} --strict$`, 'm'), tool);
    assert.match(readFileSync(`${repo}agent/tools/${tool}`, 'utf8'), /process\.argv\.includes\('--strict'\)/, tool);
  }
});

test('the live gates run clean today, as the repo gates run them', () => {
  for (const tool of ['check-block-d-thresholds.mjs', 'check-no-unbacked-guarantee.mjs', 'check-block-d-scope.mjs']) {
    const out = execFileSync(process.execPath, [`${repo}agent/tools/${tool}`], { encoding: 'utf8' });
    assert.match(out, /next human (review|audit) due \d{4}-\d{2}-\d{2}/, tool);
  }
});
