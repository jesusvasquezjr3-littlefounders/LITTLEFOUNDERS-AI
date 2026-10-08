import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMentorThresholds, MENTOR_THRESHOLD_REVIEW, readLog, scheduleSection } from './check-mentor-thresholds.mjs';
import { buildIssue, issueTitle, reviewStatus } from './mentor-thresholds-quarterly.mjs';

/*
 * Gap-fix round 6 (Appendix F §1.4, Part 3 Stage 7, C.10): the quarterly
 * human review of the Mentor's Threshold Recalibration Log is scheduled,
 * tracked and flagged. This pins agent/tools/check-mentor-thresholds.mjs, its
 * wiring into spec:check and release readiness, the quarterly issue opener
 * and .github/workflows/mentor-thresholds-quarterly.yml.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const LIVE = readLog(repo);
const WORKFLOW = '.github/workflows/mentor-thresholds-quarterly.yml';
const TOOL = fileURLToPath(new URL('./mentor-thresholds-quarterly.mjs', import.meta.url));

const humanRow = (date, by = 'Ana Pérez (Pedagogical Reviewer), Luis Ortega (Safety/Trust Lead)') =>
  `| ${date} | human | All rows | Every threshold reviewed; no value changed. | ${by} |\n`;
/** The live log with rows appended to the review history and the stated dates replaced. */
function withReview(rows, last, next) {
  let text = LIVE.replace(/(\| 2026-09-29 \| engineering \| Review schedule \|[^\n]*\n)/, `$1${rows}`);
  text = text.replace(/^- Last human review: .*$/m, `- Last human review: ${last}`);
  return text.replace(/^- Next human review due: .*$/m, `- Next human review due: ${next}`);
}

test('the live log is readable, due one quarter after it was created, and not overdue today', () => {
  const result = checkMentorThresholds({ markdown: LIVE, today: '2026-09-29' });
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.schedule.due, '2026-12-23');
  assert.equal(result.schedule.lastHuman, null);
  assert.match(scheduleSection(LIVE), /Reviewers: Pedagogical Reviewer and Safety\/Trust Lead/);
});

test('an overdue review warns in spec:check and fails with --strict (release readiness)', () => {
  const late = checkMentorThresholds({ markdown: LIVE, today: '2027-01-02' });
  assert.deepEqual(late.failures, []);
  assert.match(late.warnings.join('\n'), /was due 2026-12-23/);
  const strict = checkMentorThresholds({ markdown: LIVE, today: '2027-01-02', strict: true });
  assert.match(strict.failures.join('\n'), /was due 2026-12-23/);
});

test('a human review moves the due date 90 days on, and to yearly after four', () => {
  const one = checkMentorThresholds({ markdown: withReview(humanRow('2026-12-15'), '2026-12-15', '2027-03-15'), today: '2027-01-02', strict: true });
  assert.deepEqual(one.failures, []);
  assert.equal(one.schedule.due, '2027-03-15');
  const four = ['2026-12-15', '2027-03-10', '2027-06-01', '2027-08-30'].map((d) => humanRow(d)).join('');
  const year = checkMentorThresholds({ markdown: withReview(four, '2027-08-30', '2028-08-29'), today: '2027-09-01' });
  assert.deepEqual(year.failures, []);
  assert.equal(year.schedule.due, '2028-08-29');
});

test('RED: stale "Last" / "Next" lines, a one-reviewer human row, and an engineering row never counting', () => {
  const stale = checkMentorThresholds({ markdown: withReview(humanRow('2026-12-15'), 'none', '2026-12-23'), today: '2026-12-20' });
  assert.match(stale.failures.join('\n'), /"Last human review" says none, the review history says 2026-12-15/);
  assert.match(stale.failures.join('\n'), /"Next human review due" says 2026-12-23, the schedule computes 2027-03-15/);
  const alone = checkMentorThresholds({ markdown: withReview(humanRow('2026-12-15', 'Ana Pérez (Pedagogical Reviewer)'), '2026-12-15', '2027-03-15'), today: '2026-12-20' });
  assert.match(alone.failures.join('\n'), /does not name the Safety\/Trust Lead/);
  const engineering = withReview('| 2026-12-15 | engineering | All rows | pre-audit | Engineering |\n', 'none', '2026-12-23');
  assert.equal(checkMentorThresholds({ markdown: engineering, today: '2026-12-20' }).schedule.due, '2026-12-23');
});

test('RED: a malformed schedule fails whatever the date', () => {
  const cases = [
    [LIVE.replace('## Review schedule', '## Schedule'), /no "## Review schedule" section/],
    [LIVE.replace('- Reviewers: Pedagogical Reviewer and Safety/Trust Lead', '- Reviewers: Pedagogical Reviewer'), /must name the Safety\/Trust Lead/],
    [LIVE.replace(/^- Cadence: .*$/m, '- Cadence: when convenient'), /quarterly first-year cadence/],
    [LIVE.replace(/\*\*First human review due: 2026-12-23\*\*/, 'First review soon'), /First human review due/],
    [LIVE.replace('| Date | Kind | Scope | Decision | By |', '| Date | Type | Scope | Decision | By |'), /Date and Kind columns/],
    [LIVE.replace('| 2026-09-29 | engineering | Review schedule |', '| 2026-09-29 | automated | Review schedule |'), /not one of engineering or human/],
    [null, /is missing/],
  ];
  for (const [markdown, pattern] of cases) {
    assert.match(checkMentorThresholds({ markdown, today: '2026-10-01' }).failures.join('\n'), pattern);
  }
});

test('release readiness runs the gate with --strict; it is not in the per-push spec:check', () => {
  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  assert.doesNotMatch(pkg.scripts['spec:check'], /check-mentor-thresholds/);
  const readiness = readFileSync(join(repo, 'agent/tools/release-readiness.sh'), 'utf8');
  assert.match(readiness, /^node agent\/tools\/check-mentor-thresholds\.mjs --strict$/m);
  const codeowners = readFileSync(join(repo, '.github/CODEOWNERS'), 'utf8');
  for (const file of ['/agent/tools/check-mentor-thresholds.mjs', '/agent/tools/mentor-thresholds-quarterly.mjs', `/${MENTOR_THRESHOLD_REVIEW.doc}`]) {
    assert.ok(codeowners.includes(file), file);
  }
  const out = execFileSync(process.execPath, [join(repo, 'agent/tools/check-mentor-thresholds.mjs')], { encoding: 'utf8' });
  assert.match(out, /next human review due \d{4}-\d{2}-\d{2}/);
});

// ── the quarterly issue ──

function runIssue(markdown, now) {
  const root = mkdtempSync(join(tmpdir(), 'mentor-thresholds-'));
  const target = join(root, MENTOR_THRESHOLD_REVIEW.doc);
  mkdirSync(dirname(target), { recursive: true });
  if (markdown !== null) writeFileSync(target, markdown);
  const out = mkdtempSync(join(tmpdir(), 'mentor-thresholds-issue-'));
  let code = 0;
  try {
    execFileSync(process.execPath, [TOOL, '--issue-file', join(out, 'issue.md'), '--title-file', join(out, 'title.txt'), '--now', now, '--root', root], { stdio: 'pipe' });
  } catch (error) {
    code = error.status;
  }
  const read = (name) => (existsSync(join(out, name)) ? readFileSync(join(out, name), 'utf8') : null);
  return { code, issue: read('issue.md'), title: read('title.txt') };
}

test('the quarter opens one issue for both reviewers with the due date and state', () => {
  const result = runIssue(LIVE, '2026-10-01T09:00:00Z');
  assert.equal(result.code, 0);
  assert.equal(result.title, 'Quarterly Mentor threshold review: 2026-Q4');
  assert.match(result.issue, /Owners: the Pedagogical Reviewer and the Safety\/Trust Lead/);
  assert.match(result.issue, /Last human review: none recorded yet/);
  assert.match(result.issue, /Next due: \*\*2026-12-23\*\* \(due this quarter\)/);
  assert.match(runIssue(LIVE, '2027-01-01T09:00:00Z').issue, /\*\*2026-12-23\*\* \(overdue\)/);
  assert.equal(issueTitle(new Date('2027-04-01T09:00:00Z')), 'Quarterly Mentor threshold review: 2027-Q2');
});

test('a malformed log still writes the issue and fails the run', () => {
  const result = runIssue(LIVE.replace('## Review schedule', '## Schedule'), '2026-10-01T09:00:00Z');
  assert.equal(result.code, 1);
  assert.match(result.issue, /could not be read: .*Review schedule/);
  assert.match(buildIssue(reviewStatus(LIVE, '2026-10-01'), new Date('2026-10-01T09:00:00Z'), 'https://example.test/run/9'), /Run: https:\/\/example\.test\/run\/9$/);
});

export function workflowFailures(yaml) {
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
  if (!/node agent\/tools\/mentor-thresholds-quarterly\.mjs --issue-file issue\.md --title-file title\.txt/.test(yaml)) failures.push('does not build the issue with the tool');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (/contents:\s*write/.test(yaml)) failures.push('may not write to the repository (C.22 automated-pipeline fence)');
  if (!/if: always\(\) && hashFiles\('issue\.md'\) != ''[\s\S]*gh issue create[^\n]*--label mentor-threshold-review/.test(yaml)) failures.push('the review issue is not opened on every run');
  if (/railway|secrets\.RAILWAY/i.test(yaml)) failures.push('reaches production; the schedule lives in the repo');
  return failures;
}

test(`${WORKFLOW} opens the review on the first day of each calendar quarter`, () => {
  const real = readFileSync(join(repo, WORKFLOW), 'utf8');
  assert.deepEqual(workflowFailures(real), []);
  assert.match(workflowFailures(real.replace("cron: '0 9 1 1,4,7,10 *'", "cron: '0 9 1 1 *'")).join('\n'), /calendar quarter/);
  assert.match(workflowFailures(real.replace('node agent/tools/mentor-thresholds-quarterly.mjs', 'echo skipped')).join('\n'), /with the tool/);
  assert.match(workflowFailures(real.replace("if: always() && hashFiles('issue.md')", "if: failure() && hashFiles('issue.md')")).join('\n'), /every run/);
  assert.match(workflowFailures(real.replace('contents: read', 'contents: write')).join('\n'), /may not write/);
});
