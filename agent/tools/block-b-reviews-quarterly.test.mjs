import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DARK_PATTERN_RECORD, LOG, REVIEWS } from './block-b-review-cadence.mjs';
import { buildIssue, issueTitle, readInputs, reviewStatus } from './block-b-reviews-quarterly.mjs';

/*
 * GAP-FIX-R6 (Appendix C Part 1.3 and Part 3 Stage 6): the Block B threshold
 * review and the Age-Band Register Differentiation Audit (MN-03) are
 * calendar-triggered. This pins agent/tools/block-b-reviews-quarterly.mjs and
 * .github/workflows/block-b-reviews-quarterly.yml: one issue opens on the
 * first day of each calendar quarter listing both with owner, last human
 * review and next due date, and a malformed record still opens the issue
 * while turning the run red.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./block-b-reviews-quarterly.mjs', import.meta.url));
const WORKFLOW = '.github/workflows/block-b-reviews-quarterly.yml';

/** A copy of the live records under a scratch root, optionally rewritten. */
function scratch(rewrite = {}) {
  const root = mkdtempSync(join(tmpdir(), 'block-b-reviews-'));
  for (const file of [LOG, DARK_PATTERN_RECORD]) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repo, file), target);
    if (rewrite[file]) writeFileSync(target, rewrite[file](readFileSync(target, 'utf8')));
  }
  return root;
}

function run(root, now = '2027-01-01T09:00:00Z') {
  const dir = mkdtempSync(join(tmpdir(), 'block-b-issue-'));
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

test('the title follows the calendar quarter', () => {
  assert.equal(issueTitle(new Date('2027-04-01T09:00:00Z')), 'Quarterly Block B reviews: 2027-Q2');
});

test('the live records open one issue listing both reviews with their owners and dates', () => {
  const result = run(scratch());
  assert.equal(result.code, 0);
  assert.equal(result.title, 'Quarterly Block B reviews: 2027-Q1');
  for (const review of REVIEWS) {
    assert.ok(result.issue.includes(`### ${review.title}`), review.id);
    assert.ok(result.issue.includes(`Owner: ${review.owner}.`), review.id);
  }
  assert.ok(result.issue.includes(`\`${LOG}\` and \`${DARK_PATTERN_RECORD}\``));
  assert.equal(result.issue.match(/Last human review: none recorded yet/g)?.length, 2);
  assert.equal(result.issue.match(/Next due: \*\*2027-01-15\*\* \(due this quarter\)/g)?.length, 2);
  assert.match(result.issue, /engineering pre-audit never counts/);
});

test('a review past its date is overdue; a signed release audit that judged MN-03 moves the register audit', () => {
  assert.match(run(scratch(), '2027-02-01T09:00:00Z').issue, /\*\*2027-01-15\*\* \(overdue\)/);
  assert.match(run(scratch(), '2026-10-01T09:00:00Z').issue, /\*\*2027-01-15\*\* \(not yet due\)/);
  const signed = (text) => {
    const record = JSON.parse(text);
    const audit = structuredClone(record.audits[0]);
    Object.assign(audit, { id: '2027-01-20-release', date: '2027-01-20', kind: 'release-audit', signed_off_by: 'Pedagogical Lead' });
    audit.items['MN-03'] = { result: 'pass', evidence: 'Registers distinct.' };
    record.audits.push(audit);
    return JSON.stringify(record);
  };
  const issue = run(scratch({ [DARK_PATTERN_RECORD]: signed }), '2027-02-01T09:00:00Z').issue;
  assert.match(issue, /Last human review: 2027-01-20\.\n- Next due: \*\*2027-04-20\*\* \(not yet due\)/);
  assert.match(issue, /Block B Threshold Recalibration[\s\S]*\*\*2027-01-15\*\* \(overdue\)/);
});

test('a malformed record still writes the issue and fails the run', () => {
  const result = run(scratch({ [LOG]: (text) => text.replace('## Register audit log', '## Audits') }));
  assert.equal(result.code, 1);
  assert.equal(result.title, 'Quarterly Block B reviews: 2027-Q1');
  assert.match(result.issue, /could not be read: .*Register audit log/);
  assert.match(result.issue, /Block B Threshold Recalibration/);
});

test('reviewStatus and buildIssue link the run when given one', () => {
  const statuses = REVIEWS.map((review) => reviewStatus(review, readInputs(repo), '2027-01-01'));
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
  if (!/node agent\/tools\/block-b-reviews-quarterly\.mjs --issue-file issue\.md --title-file title\.txt/.test(yaml)) failures.push('does not build the issue with the tool');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (!/if: always\(\) && hashFiles\('issue\.md'\) != ''[\s\S]*gh issue create[^\n]*--label block-b-review/.test(yaml)) failures.push('the review issue is not opened on every run');
  if (/railway|secrets\.RAILWAY/i.test(yaml)) failures.push('reaches production; the schedule lives in the repo');
  return failures;
}

test(`${WORKFLOW} opens the reviews on the first day of each calendar quarter`, () => {
  assert.deepEqual(reviewsWorkflowFailures(readFileSync(`${repo}${WORKFLOW}`, 'utf8')), []);
});

test('the workflow lint fails on a yearly schedule, a skipped tool, a failure-only notice and a production call', () => {
  const real = readFileSync(`${repo}${WORKFLOW}`, 'utf8');
  assert.match(reviewsWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 1 1 *'")).join('\n'), /calendar quarter/);
  assert.match(reviewsWorkflowFailures(real.replace('node agent/tools/block-b-reviews-quarterly.mjs', 'echo skipped')).join('\n'), /with the tool/);
  assert.match(reviewsWorkflowFailures(real.replace("if: always() && hashFiles('issue.md')", "if: failure() && hashFiles('issue.md')")).join('\n'), /every run/);
  assert.match(reviewsWorkflowFailures(`${real}\n# npm i -g @railway/cli\n`).join('\n'), /production/);
});
