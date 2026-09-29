import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEWS } from './block-d-review-cadence.mjs';
import { buildIssue, issueTitle, quarterEnd, quarterLabel, reviewStatus } from './block-d-reviews-quarterly.mjs';

/*
 * GAP-FIX-R5 (Appendix H Parts 1.3 and 1.4): the three quarterly Block D
 * reviews are calendar-triggered. This pins agent/tools/block-d-reviews-quarterly.mjs
 * and .github/workflows/block-d-reviews-quarterly.yml: one issue opens on the
 * first day of each calendar quarter listing all three with owner, last human
 * review and next due date, and a malformed log still opens the issue while
 * turning the run red.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./block-d-reviews-quarterly.mjs', import.meta.url));
const WORKFLOW = '.github/workflows/block-d-reviews-quarterly.yml';

/** A copy of the three live logs under a scratch root, optionally rewritten. */
function scratch(rewrite = {}) {
  const root = mkdtempSync(join(tmpdir(), 'block-d-reviews-'));
  for (const review of REVIEWS) {
    const target = join(root, review.doc);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repo, review.doc), target);
    if (rewrite[review.id]) writeFileSync(target, rewrite[review.id](readFileSync(target, 'utf8')));
  }
  return root;
}

function run(root, now = '2027-01-01T09:00:00Z') {
  const dir = mkdtempSync(join(tmpdir(), 'block-d-issue-'));
  const file = (name) => join(dir, name);
  let code = 0;
  try {
    execFileSync(process.execPath, [TOOL, '--issue-file', file('issue.md'), '--title-file', file('title.txt'), '--now', now, '--root', root], { stdio: 'pipe' });
  } catch (error) {
    code = error.status;
  }
  const read = (name) => (existsSync(file(name)) ? readFileSync(file(name), 'utf8') : null);
  return { code, issue: read('issue.md'), title: read('title.txt') };
}

test('quarterLabel and quarterEnd follow the calendar quarter in UTC', () => {
  assert.equal(quarterLabel(new Date('2027-01-01T09:00:00Z')), '2027-Q1');
  assert.equal(quarterLabel(new Date('2026-12-31T23:59:59Z')), '2026-Q4');
  assert.equal(quarterEnd('2027-01-01'), '2027-03-31');
  assert.equal(quarterEnd('2026-10-01'), '2026-12-31');
  assert.equal(quarterEnd('2028-05-20'), '2028-06-30');
  assert.equal(issueTitle(new Date('2027-04-01T09:00:00Z')), 'Quarterly Block D reviews: 2027-Q2');
});

test('the live logs open one issue listing the three reviews with their owners and dates', () => {
  const result = run(scratch());
  assert.equal(result.code, 0);
  assert.equal(result.title, 'Quarterly Block D reviews: 2027-Q1');
  for (const review of REVIEWS) {
    assert.match(result.issue, new RegExp(`### ${review.title.replace(/[&]/g, '\\$&')}`));
    assert.ok(result.issue.includes(`Owner: ${review.owner}.`), review.id);
    assert.ok(result.issue.includes(review.doc), review.id);
  }
  assert.match(result.issue, /Last human review: none recorded yet/);
  assert.match(result.issue, /Next due: \*\*2027-01-15\*\* \(due this quarter\)/);
  assert.match(result.issue, /engineering pre-audit never counts/);
});

test('a review past its date is listed as overdue; one far ahead as not yet due', () => {
  assert.match(run(scratch(), '2027-02-01T09:00:00Z').issue, /\*\*2027-01-15\*\* \(overdue\)/);
  assert.match(run(scratch(), '2026-10-01T09:00:00Z').issue, /\*\*2027-01-15\*\* \(not yet due\)/);
  const human = (text) => text.replace(/(\| 2026-09-24 \| )engineering( \|)/, '$1human$2');
  const moved = run(scratch({ 'scope-disclosure': human }), '2026-10-01T09:00:00Z').issue;
  assert.match(moved, /Last human review: 2026-09-24\.\n- Next due: \*\*2026-12-23\*\* \(due this quarter\)/);
});

test('a malformed log still writes the issue and fails the run', () => {
  const result = run(scratch({ thresholds: (text) => text.replace(/\| Date \| Kind \|/, '| Date | Type |') }));
  assert.equal(result.code, 1);
  assert.equal(result.title, 'Quarterly Block D reviews: 2027-Q1');
  assert.match(result.issue, /could not be read: .*Date and Kind columns/);
  assert.match(result.issue, /No-Unbacked-Guarantee Audit/);
});

test('reviewStatus and buildIssue link the run when given one', () => {
  const statuses = REVIEWS.map((review) => reviewStatus(review, readFileSync(`${repo}${review.doc}`, 'utf8'), '2027-01-01'));
  assert.ok(statuses.every((s) => s.ok && s.due === '2027-01-15'));
  assert.match(buildIssue(statuses, new Date('2027-01-01T09:00:00Z'), 'https://example.test/run/7'), /Run: https:\/\/example\.test\/run\/7$/);
});

export function reviewsWorkflowFailures(yaml) {
  const failures = [];
  const crons = [...yaml.matchAll(/-\s*cron:\s*'([^']+)'/g)].map((m) => m[1]);
  if (crons.length !== 1) failures.push('not exactly one schedule');
  for (const cron of crons) {
    const [minute, hour, dom, month, dow] = cron.trim().split(/\s+/);
    if (!/^\d+$/.test(minute ?? '') || !/^\d+$/.test(hour ?? '') || dom !== '1' || month !== '1,4,7,10' || dow !== '*') {
      failures.push(`schedule ${cron} is not the first day of each calendar quarter`);
    }
  }
  if (!/^\s*workflow_dispatch:/m.test(yaml)) failures.push('no workflow_dispatch');
  if (!/node agent\/tools\/block-d-reviews-quarterly\.mjs --issue-file issue\.md --title-file title\.txt/.test(yaml)) failures.push('does not build the issue with the tool');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (!/if: always\(\) && hashFiles\('issue\.md'\) != ''[\s\S]*gh issue create[^\n]*--label block-d-review/.test(yaml)) failures.push('the review issue is not opened on every run');
  if (/railway|secrets\.RAILWAY/i.test(yaml)) failures.push('reaches production; the schedule lives in the repo');
  return failures;
}

test(`${WORKFLOW} opens the reviews on the first day of each calendar quarter`, () => {
  assert.deepEqual(reviewsWorkflowFailures(readFileSync(`${repo}${WORKFLOW}`, 'utf8')), []);
});

test('the workflow lint fails on a yearly or daily schedule, a skipped tool, a failure-only notice and a production call', () => {
  const real = readFileSync(`${repo}${WORKFLOW}`, 'utf8');
  assert.match(reviewsWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 1 1 *'")).join('\n'), /calendar quarter/);
  assert.match(reviewsWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 * * *'")).join('\n'), /calendar quarter/);
  assert.match(reviewsWorkflowFailures(real.replace('node agent/tools/block-d-reviews-quarterly.mjs', 'echo skipped')).join('\n'), /with the tool/);
  assert.match(reviewsWorkflowFailures(real.replace("if: always() && hashFiles('issue.md')", "if: failure() && hashFiles('issue.md')")).join('\n'), /every run/);
  assert.match(reviewsWorkflowFailures(real.replace('issues: write', 'issues: read')).join('\n'), /issues: write/);
  assert.match(reviewsWorkflowFailures(`${real}\n# npm i -g @railway/cli\n`).join('\n'), /production/);
});
