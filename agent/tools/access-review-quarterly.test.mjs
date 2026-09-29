import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIssue, issueTitle, quarterLabel, readAccessReviews } from './access-review-quarterly.mjs';

/*
 * G.4 / Appendix N 1.1: the access review is quarterly and calendar-triggered.
 * This pins agent/tools/access-review-quarterly.mjs and
 * .github/workflows/access-review-quarterly.yml: the issue opens on the first
 * day of each calendar quarter, carries Core's counts (never re-derived), and
 * an unreadable reply still opens the issue while turning the run red.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./access-review-quarterly.mjs', import.meta.url));
const WORKFLOW = '.github/workflows/access-review-quarterly.yml';
const status = (accessReviews) => ({ data: { jobs: [], anyStale: false, accessReviews }, error: null });

function run(body, now = '2026-10-01T09:00:00Z') {
  const dir = mkdtempSync(join(tmpdir(), 'access-review-'));
  const file = (name) => join(dir, name);
  writeFileSync(file('status.json'), typeof body === 'string' ? body : JSON.stringify(body));
  const args = [TOOL, '--status-file', file('status.json'), '--issue-file', file('issue.md'), '--title-file', file('title.txt'), '--now', now];
  let code = 0;
  try {
    execFileSync(process.execPath, args, { stdio: 'pipe' });
  } catch (error) {
    code = error.status;
  }
  const read = (name) => (existsSync(file(name)) ? readFileSync(file(name), 'utf8') : null);
  return { code, issue: read('issue.md'), title: read('title.txt') };
}

test('quarterLabel names the calendar quarter in UTC', () => {
  assert.equal(quarterLabel(new Date('2026-01-01T00:00:00Z')), '2026-Q1');
  assert.equal(quarterLabel(new Date('2026-06-30T23:59:59Z')), '2026-Q2');
  assert.equal(quarterLabel(new Date('2026-07-01T09:00:00Z')), '2026-Q3');
  assert.equal(quarterLabel(new Date('2026-12-31T12:00:00Z')), '2026-Q4');
  assert.throws(() => quarterLabel('not a date'));
});

test('a readable status opens the quarter issue with the held and due counts', () => {
  const result = run(status({ due: 2, total: 5, windowDays: 90 }));
  assert.equal(result.code, 0);
  assert.equal(result.title, 'Quarterly access review: 2026-Q4');
  assert.match(result.issue, /Elevated grants held .*\*\*5\*\*/);
  assert.match(result.issue, /past the 90-day review: \*\*2\*\*/);
  assert.match(result.issue, /Roles & Access/);
  assert.match(result.issue, /staff\/access owner/);
});

test('nothing due still opens the review: every grant is reviewed each quarter', () => {
  const result = run(status({ due: 0, total: 3, windowDays: 90 }));
  assert.equal(result.code, 0);
  assert.match(result.issue, /\*\*3\*\*/);
  assert.match(result.issue, /every elevated grant against actual usage/);
});

test('an unreadable reply still writes the issue and fails the run', () => {
  for (const body of ['<html>502</html>', '', status(undefined), status({ due: 1, windowDays: 90 }), status({ due: -1, total: 2, windowDays: 90 }), status({ due: 1.5, total: 2, windowDays: 90 }), status({ due: '1', total: 2, windowDays: 90 }), status({ due: 3, total: 2, windowDays: 90 })]) {
    const result = run(body);
    assert.equal(result.code, 1, JSON.stringify(body));
    assert.equal(result.title, 'Quarterly access review: 2026-Q4');
    assert.match(result.issue, /could not be read/);
  }
});

test('readAccessReviews accepts the bare data object and the envelope alike', () => {
  assert.equal(readAccessReviews({ accessReviews: { due: 0, total: 0, windowDays: 90 } }).ok, true);
  assert.equal(readAccessReviews(status({ due: 0, total: 0, windowDays: 90 })).ok, true);
  assert.equal(readAccessReviews(null).ok, false);
});

test('buildIssue links the run when given one', () => {
  const body = buildIssue({ ok: true, due: 0, total: 1, windowDays: 90, error: null }, new Date('2027-04-01T09:00:00Z'), 'https://example.test/run/1');
  assert.match(body, /2027-Q2/);
  assert.match(body, /Run: https:\/\/example\.test\/run\/1$/);
  assert.equal(issueTitle(new Date('2027-04-01T09:00:00Z')), 'Quarterly access review: 2027-Q2');
});

export function quarterlyWorkflowFailures(yaml) {
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
  if (!/\/api\/v1\/internal\/ops\/job-status/.test(yaml)) failures.push('does not read Core\'s operations status');
  if (!/node agent\/tools\/access-review-quarterly\.mjs --status-file status\.json --issue-file issue\.md --title-file title\.txt/.test(yaml)) failures.push('does not build the issue with the tool');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (!/if: always\(\) && hashFiles\('issue\.md'\) != ''[\s\S]*gh issue create[^\n]*--label access-review/.test(yaml)) failures.push('the review issue is not opened on every run');
  return failures;
}

test(`${WORKFLOW} opens the review on the first day of each calendar quarter`, () => {
  assert.deepEqual(quarterlyWorkflowFailures(readFileSync(`${repo}${WORKFLOW}`, 'utf8')), []);
});

test('the workflow lint fails on a yearly or daily schedule, a skipped tool and a failure-only notice', () => {
  const real = readFileSync(`${repo}${WORKFLOW}`, 'utf8');
  assert.match(quarterlyWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 1 1 *'")).join('\n'), /calendar quarter/);
  assert.match(quarterlyWorkflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 * * *'")).join('\n'), /calendar quarter/);
  assert.match(quarterlyWorkflowFailures(real.replace('node agent/tools/access-review-quarterly.mjs', 'echo skipped')).join('\n'), /with the tool/);
  assert.match(quarterlyWorkflowFailures(real.replace("if: always() && hashFiles('issue.md')", "if: failure() && hashFiles('issue.md')")).join('\n'), /every run/);
  assert.match(quarterlyWorkflowFailures(real.replace('issues: write', 'issues: read')).join('\n'), /issues: write/);
});
