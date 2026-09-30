import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICY } from './block-e-review-cadence.mjs';
import { ISSUE_LABEL, buildIssue, dueState, issueTitle, quarterEnd, quarterLabel } from './block-e-reviews-quarterly.mjs';

/*
 * Gap-fix round 7 (Appendix J Part 1.4 / Part 3 Stage 7, E.7): the quarterly
 * Block E review is calendar-triggered. This pins
 * agent/tools/block-e-reviews-quarterly.mjs and
 * .github/workflows/block-e-reviews-quarterly.yml: one issue, labelled
 * block-e-review, opens on the first day of each calendar quarter for the
 * Safety/Trust Lead listing every threshold and watch-list item, and a
 * malformed log still opens the issue while turning the run red.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./block-e-reviews-quarterly.mjs', import.meta.url));
const WORKFLOW = '.github/workflows/block-e-reviews-quarterly.yml';
const live = readFileSync(`${repo}${POLICY}`, 'utf8');

function run(markdown, now = '2027-01-01T09:00:00Z') {
  const root = mkdtempSync(join(tmpdir(), 'block-e-reviews-'));
  mkdirSync(dirname(join(root, POLICY)), { recursive: true });
  if (markdown !== null) writeFileSync(join(root, POLICY), markdown);
  const dir = mkdtempSync(join(tmpdir(), 'block-e-issue-'));
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

test('quarterLabel, quarterEnd and dueState follow the calendar quarter in UTC', () => {
  assert.equal(quarterLabel(new Date('2027-01-01T09:00:00Z')), '2027-Q1');
  assert.equal(quarterLabel(new Date('2026-12-31T23:59:59Z')), '2026-Q4');
  assert.equal(quarterEnd('2026-10-01'), '2026-12-31');
  assert.equal(issueTitle(new Date('2026-10-01T09:00:00Z')), 'Quarterly Block E review: 2026-Q4');
  assert.equal(dueState('2026-12-24', '2026-10-01'), 'due this quarter');
  assert.equal(dueState('2026-12-24', '2026-07-01'), 'not yet due');
  assert.equal(dueState('2026-12-24', '2027-01-01'), 'overdue');
  assert.equal(ISSUE_LABEL, 'block-e-review');
});

test('the live policy opens one issue listing every threshold and watch-list item for the Safety/Trust Lead', () => {
  const result = run(live, '2026-10-01T09:00:00Z');
  assert.equal(result.code, 0);
  assert.equal(result.title, 'Quarterly Block E review: 2026-Q4');
  assert.match(result.issue, /Owner: Safety\/Trust Lead/);
  assert.match(result.issue, /\*\*Teen decline cooldown\*\*: 30 days\. Enforced in `request_teen_connection`\. Last reviewed 2026-09-25; next due \*\*2026-12-24\*\* \(due this quarter\)/);
  assert.match(result.issue, /\*\*Federal KOSA\*\*: Not law when Appendix I was written\. Status: Open: re-check whether enacted\. Last re-checked not yet; next due \*\*2026-12-24\*\*/);
  assert.equal((result.issue.match(/^- \*\*/gm) ?? []).length, 14);
  assert.match(result.issue, /block-e-review-cadence\.mjs --strict/);
});

test('rows past their date are listed as overdue', () => {
  assert.match(run(live, '2027-01-01T09:00:00Z').issue, /\*\*2026-12-24\*\* \(overdue\)/);
});

test('a malformed or missing log still writes the issue and fails the run', () => {
  const broken = run(live.replace('| Status | Last re-checked | Next re-check due |', '| Status |'));
  assert.equal(broken.code, 1);
  assert.equal(broken.title, 'Quarterly Block E review: 2027-Q1');
  assert.match(broken.issue, /### The log could not be read/);
  assert.match(broken.issue, /The review is still due/);
  const missing = run(null);
  assert.equal(missing.code, 1);
  assert.match(missing.issue, /SOCIAL-GOVERNANCE\.md is missing/);
});

test('buildIssue links the run when given one', () => {
  assert.match(buildIssue(live, new Date('2027-01-01T09:00:00Z'), 'https://example.test/run/7').body, /Run: https:\/\/example\.test\/run\/7$/);
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
  if (!/node agent\/tools\/block-e-reviews-quarterly\.mjs --issue-file issue\.md --title-file title\.txt/.test(yaml)) failures.push('does not build the issue with the tool');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (!/if: always\(\) && hashFiles\('issue\.md'\) != ''[\s\S]*gh issue create[^\n]*--label block-e-review/.test(yaml)) failures.push('the review issue is not opened on every run');
  if (/railway|secrets\.RAILWAY/i.test(yaml)) failures.push('reaches production; the schedule lives in the repo');
  return failures;
}

test(`${WORKFLOW} opens the review on the first day of each calendar quarter`, () => {
  assert.deepEqual(reviewsWorkflowFailures(readFileSync(`${repo}${WORKFLOW}`, 'utf8')), []);
});

test('the workflow lint fails on a yearly or daily schedule, a skipped tool, a failure-only notice, another label and a production call', () => {
  const real = readFileSync(`${repo}${WORKFLOW}`, 'utf8');
  assert.match(reviewsWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 1 1 *'")).join('\n'), /calendar quarter/);
  assert.match(reviewsWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 * * *'")).join('\n'), /calendar quarter/);
  assert.match(reviewsWorkflowFailures(real.replace('node agent/tools/block-e-reviews-quarterly.mjs', 'echo skipped')).join('\n'), /with the tool/);
  assert.match(reviewsWorkflowFailures(real.replace("if: always() && hashFiles('issue.md')", "if: failure() && hashFiles('issue.md')")).join('\n'), /every run/);
  assert.match(reviewsWorkflowFailures(real.replace('gh issue create --title "$title" --label block-e-review', 'gh issue create --title "$title" --label block-d-review')).join('\n'), /every run/);
  assert.match(reviewsWorkflowFailures(real.replace('issues: write', 'issues: read')).join('\n'), /issues: write/);
  assert.match(reviewsWorkflowFailures(`${real}\n# npm i -g @railway/cli\n`).join('\n'), /production/);
});

test('the policy names both triggers (SOCIAL-GOVERNANCE.md section 1.2)', () => {
  const section = live.slice(live.indexOf('### 1.2 Threshold Recalibration Log (Block E)'), live.indexOf('### 1.3 Regulatory watch list'));
  assert.match(section, /block-e-reviews-quarterly\.yml/);
  assert.match(section, /`block-e-review`/);
  assert.match(section, /block-e-review-cadence\.mjs --strict/);
  assert.match(section, /release-readiness\.sh/);
});
