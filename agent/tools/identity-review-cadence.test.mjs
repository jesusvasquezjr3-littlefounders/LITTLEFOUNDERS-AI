import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IDENTITY_REVIEW, METRICS_SOURCE, buildIssue, checkIdentityReview, checkThresholdCoverage, issueTitle,
  quarterLabel, readCoreMetrics, readThresholds, unmetGates,
} from './identity-review-cadence.mjs';

/*
 * GAP-FIX-R6 identity-site (Appendix M Part 3 Stage 6): the quarterly Block A
 * recalibration is recorded, scheduled and flagged like Blocks D and E. This
 * pins the due-date logic, the drift check against Core's metrics, the
 * quarterly issue (with the missed release gates of an attached report) and
 * the wiring: the workflow, release readiness (--strict) and the repo gates.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./identity-review-cadence.mjs', import.meta.url));
const read = (path) => readFileSync(join(repo, path), 'utf8').replace(/\r\n/g, '\n');
const LOG = read(IDENTITY_REVIEW.doc);
const SOURCE = read(METRICS_SOURCE);

const withHistory = (markdown, rows) => markdown.replace(
  /(## Review history\n\n\| Date \| Kind \| Metrics \| Decision \| By \|\n\|---\|---\|---\|---\|---\|\n)/,
  `$1${rows.map(([date, kind]) => `| ${date} | ${kind} | All rows | test | Trust/Identity Lead |\n`).join('')}`,
);

test('the live log matches every metric Core reports, and states a first due date', () => {
  assert.deepEqual(checkThresholdCoverage(LOG, SOURCE), []);
  const core = readCoreMetrics(SOURCE);
  assert.ok(core.length >= 19, `only ${core.length} metrics read from ${METRICS_SOURCE}`);
  assert.ok(core.some((m) => m.id === 'post_callback_age_screen_completion' && m.kind === 'release gate'));
  assert.ok(core.some((m) => m.id === 'undated_account_backlog' && m.kind === 'diagnostic'));
  assert.ok(core.some((m) => m.id === 'age_screen_bypass' && m.kind === 'adversarial'));
  const result = checkIdentityReview({ markdown: LOG, source: SOURCE, today: '2026-09-29' });
  assert.deepEqual(result.failures, []);
  assert.equal(result.schedule.due, '2026-12-31');
  assert.ok(LOG.includes('Trust/Identity Lead'));
});

test('due-date logic: first date until a human review, then 90 days; engineering rows never count', () => {
  const none = checkIdentityReview({ markdown: LOG, source: SOURCE, today: '2026-12-31' });
  assert.deepEqual(none.warnings, []);
  const overdue = checkIdentityReview({ markdown: LOG, source: SOURCE, today: '2027-01-01' });
  assert.equal(overdue.failures.length, 0);
  assert.match(overdue.warnings[0], /was due 2026-12-31/);
  const strict = checkIdentityReview({ markdown: LOG, source: SOURCE, today: '2027-01-01', strict: true });
  assert.match(strict.failures[0], /Block A Identity Recalibration \(Appendix M Part 3 Stage 6\) was due 2026-12-31/);

  const engineeringOnly = withHistory(LOG, [['2026-12-15', 'engineering']]);
  assert.equal(checkIdentityReview({ markdown: engineeringOnly, source: SOURCE, today: '2027-01-01' }).schedule.due, '2026-12-31');

  const reviewed = withHistory(LOG, [['2026-12-15', 'human']]);
  const after = checkIdentityReview({ markdown: reviewed, source: SOURCE, today: '2027-03-15', strict: true });
  assert.equal(after.schedule.due, '2027-03-15');
  assert.deepEqual(after.failures, []);
  assert.equal(checkIdentityReview({ markdown: reviewed, source: SOURCE, today: '2027-03-16', strict: true }).failures.length, 1);
  // Quarterly stays quarterly, however many reviews are recorded.
  const many = withHistory(LOG, [['2027-01-01', 'human'], ['2027-04-01', 'human'], ['2027-07-01', 'human'], ['2027-10-01', 'human']]);
  assert.equal(checkIdentityReview({ markdown: many, source: SOURCE, today: '2027-10-02' }).schedule.due, '2027-12-30');
});

test('a malformed log fails whatever the date', () => {
  const noDue = LOG.replace(/First human review due: \d{4}-\d{2}-\d{2}/, 'First human review due: soon');
  assert.ok(checkIdentityReview({ markdown: noDue, source: SOURCE, today: '2026-10-01' }).failures.some((f) => f.includes('First human review due')));
  const badKind = withHistory(LOG, [['2026-10-01', 'informal']]);
  assert.ok(checkIdentityReview({ markdown: badKind, source: SOURCE, today: '2026-10-01' }).failures.some((f) => f.includes('"informal"')));
  assert.ok(checkIdentityReview({ markdown: null, source: SOURCE, today: '2026-10-01' }).failures[0].includes('is missing'));
});

test('drift between the log and Core fails: a missing metric, a stale row, a wrong kind or requirement', () => {
  const missing = LOG.replace(/^\| `age_screen_bypass` .*\n/m, '');
  assert.ok(checkThresholdCoverage(missing, SOURCE).some((f) => f.includes('Core reports age_screen_bypass (adversarial) but the log has no row')));
  const stale = LOG.replace(/(\| `kid_email_change_unauthorized` [^\n]*\n)/, '$1| `retired_metric` | 1.1 | A.2 | release gate | 100% | nowhere |\n');
  assert.ok(checkThresholdCoverage(stale, SOURCE).some((f) => f.includes('retired_metric is not a metric Core reports')));
  const wrongKind = LOG.replace('| `undated_account_backlog` | 1.1 | A.4 | diagnostic |', '| `undated_account_backlog` | 1.1 | A.4 | release gate |');
  assert.ok(checkThresholdCoverage(wrongKind, SOURCE).some((f) => f.includes('undated_account_backlog is "release gate" in the log but "diagnostic" in Core')));
  const wrongReq = LOG.replace('| `faq_claim_parity` | 1.4 | A.1 |', '| `faq_claim_parity` | 1.4 | A.5 |');
  assert.ok(checkThresholdCoverage(wrongReq, SOURCE).some((f) => f.includes('faq_claim_parity verifies "A.5"')));
  const coreGrew = SOURCE.replace("metric('faq_claim_parity',", "metric('new_gate', '1.4', 'A.1', 'release_gate', 0, 0),\n    metric('faq_claim_parity',");
  assert.ok(checkThresholdCoverage(LOG, coreGrew).some((f) => f.includes('Core reports new_gate')));
});

test('the quarterly issue lists the owner, the due date, every release gate and the missed gates of an attached report', () => {
  const rows = readThresholds(LOG);
  const report = { data: { metrics: [
    { id: 'post_callback_age_screen_completion', kind: 'release_gate', status: 'missed', numerator: 211, denominator: 214 },
    { id: 'entry_path_age_capture', kind: 'release_gate', status: 'no_data', numerator: 0, denominator: 0 },
    { id: 'guest_origin_flag_coverage', kind: 'release_gate', status: 'met', numerator: 4, denominator: 4 },
    { id: 'undated_account_backlog', kind: 'diagnostic', status: 'diagnostic', numerator: 3, denominator: 9 },
  ] } };
  const unmet = unmetGates(report);
  assert.deepEqual(unmet.map((g) => g.id), ['post_callback_age_screen_completion', 'entry_path_age_capture']);
  const body = buildIssue({ markdown: LOG, now: '2027-01-01T09:00:00Z', report: { ok: true, unmet }, runUrl: 'https://example.test/run/1' });
  assert.match(body, /Owner: Trust\/Identity Lead/);
  assert.match(body, /Next due: \*\*2026-12-31\*\* \(overdue\)/);
  for (const row of rows.filter((r) => r.kind === 'release gate')) assert.ok(body.includes(`\`${row.id}\``), row.id);
  assert.match(body, /\*\*`post_callback_age_screen_completion`\*\*: missed \(211 of 214\)/);
  assert.match(body, /\*\*`entry_path_age_capture`\*\*: no data/);
  assert.ok(!body.includes('**`guest_origin_flag_coverage`**'));
  assert.match(body, /Run: https:\/\/example\.test\/run\/1/);
  assert.match(buildIssue({ markdown: LOG, now: '2026-10-01T09:00:00Z' }), /No identity report was attached/);
  assert.match(buildIssue({ markdown: LOG, now: '2026-10-01T09:00:00Z', report: { ok: true, unmet: [] } }), /None: every release gate/);
  assert.throws(() => unmetGates({ data: {} }), /not an identity report/);
  assert.equal(quarterLabel('2026-11-15T00:00:00Z'), '2026-Q4');
  assert.equal(issueTitle('2027-01-01T09:00:00Z'), 'Quarterly Block A identity recalibration: 2027-Q1');
});

function scratch(markdown = LOG) {
  const root = mkdtempSync(join(tmpdir(), 'identity-review-'));
  for (const path of [IDENTITY_REVIEW.doc, METRICS_SOURCE]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(repo, path), join(root, path));
  }
  writeFileSync(join(root, IDENTITY_REVIEW.doc), markdown);
  return root;
}

function cli(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
}

test('the command line: the gate, --strict, and the issue with a readable or unreadable report', () => {
  const root = scratch();
  assert.equal(cli(['--root', root, '--now', '2026-10-01T00:00:00Z']).code, 0);
  assert.equal(cli(['--root', root, '--now', '2027-01-02T00:00:00Z']).code, 0);
  assert.equal(cli(['--root', root, '--now', '2027-01-02T00:00:00Z', '--strict']).code, 1);

  const dir = mkdtempSync(join(tmpdir(), 'identity-issue-'));
  const good = join(dir, 'report.json');
  writeFileSync(good, JSON.stringify({ data: { metrics: [{ id: 'faq_claim_parity', kind: 'release_gate', status: 'missed', numerator: 2, denominator: 3 }] } }));
  const ok = cli(['--root', root, '--now', '2027-01-01T09:00:00Z', '--issue-file', join(dir, 'issue.md'), '--title-file', join(dir, 'title.txt'), '--report', good]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(readFileSync(join(dir, 'issue.md'), 'utf8'), /\*\*`faq_claim_parity`\*\*: missed \(2 of 3\)/);
  assert.equal(readFileSync(join(dir, 'title.txt'), 'utf8'), 'Quarterly Block A identity recalibration: 2027-Q1');

  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{not json');
  const red = cli(['--root', root, '--now', '2027-01-01T09:00:00Z', '--issue-file', join(dir, 'issue2.md'), '--title-file', join(dir, 'title2.txt'), '--report', bad]);
  assert.equal(red.code, 1);
  assert.match(readFileSync(join(dir, 'issue2.md'), 'utf8'), /could not be read/);
});

test('the workflow opens the issue every calendar quarter; release readiness and the repo gates call the gate', () => {
  const workflow = read('.github/workflows/identity-recalibration-quarterly.yml');
  assert.match(workflow, /cron: '0 9 1 1,4,7,10 \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /node agent\/tools\/identity-review-cadence\.mjs --issue-file issue\.md --title-file title\.txt --report identity-report\.json/);
  assert.match(workflow, /REPORT: \$\{\{ inputs\.report \}\}/, 'the report reaches the shell through the environment, never interpolated into the script');
  assert.match(workflow, /--label identity-review/);
  assert.match(workflow, /if: always\(\) && hashFiles\('issue\.md'\) != ''/);
  assert.match(read('agent/tools/release-readiness.sh'), /^node agent\/tools\/identity-review-cadence\.mjs --strict$/m);
  assert.match(read('.github/workflows/repo-gates.yml'), /run: node agent\/tools\/identity-review-cadence\.mjs\n/);
});
