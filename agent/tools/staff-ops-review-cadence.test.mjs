import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALIBRATIONS, LOG_DOC, METRICS, ROLLBACK, buildIssue, checkDrift, checkStaffOpsReview, issueTitle,
  readCalibrations, readThresholds, repoReader, reviewSchedules, sourceFiles,
} from './staff-ops-review-cadence.mjs';

/*
 * Gap-fix round 7 staff-ops (Appendix N and Appendix O, Part 3 Stage 6; OD
 * log section 8; Appendix O 1.3 drill "quarterly otherwise"): the quarterly
 * Block G and Block H recalibration is recorded, scheduled per block and
 * flagged like Block A's. This pins the drift checks (metrics, sources,
 * calibration values against the constants and the latest migration, the
 * rollback rule), the per-block due dates, the quarterly issue and the wiring.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./staff-ops-review-cadence.mjs', import.meta.url));
const read = (path) => readFileSync(join(repo, path), 'utf8').replace(/\r\n/g, '\n');
const LOG = read(LOG_DOC);
const src = (overlay) => repoReader(repo, overlay);

const withHistory = (markdown, rows) => markdown.replace(
  /(## Review history\n\n\| Date \| Kind \| Block \| Metrics \| Decision \| By \|\n\|---\|---\|---\|---\|---\|---\|\n)/,
  `$1${rows.map(([date, kind, block]) => `| ${date} | ${kind} | ${block} | All rows | test | Lead |\n`).join('')}`,
);
const gate = (markdown, today = '2026-10-01', strict = false, overlay) => checkStaffOpsReview({ markdown, src: src(overlay), today, strict });
const has = (failures, text) => failures.some((f) => f.includes(text));

test('the live log matches every Appendix N and O metric, its sources and the calibration constants', () => {
  assert.deepEqual(checkDrift(LOG, src()), []);
  const ids = METRICS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(METRICS.filter((m) => m.block === 'G').length, 10, 'Appendix N Part 1 has ten metrics');
  assert.equal(METRICS.filter((m) => m.block === 'H').length, 14, 'Appendix O Part 1 has fourteen metrics');
  for (const id of ROLLBACK) assert.equal(METRICS.find((m) => m.id === id)?.kind, 'release gate', id);
  assert.deepEqual(readThresholds(LOG).map((r) => r.id).sort(), [...ids].sort());
  assert.deepEqual(Object.fromEntries(readCalibrations(LOG).map((c) => [c.key, c.value])), {
    'g2.retro_check_days': '30',
    'g4.access_review_cadence_days': '90',
    'h3.alert_undelivered_window_hours': '36',
    'h4.ops_job_stale_hours': '36',
    'h4.deletion_step_failure_hours': '24',
    'h7.policy_min_age': 'adults_only 18, od26_c17 10',
  });
  const result = gate(LOG, '2026-09-29');
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.schedule.blocks, { G: { lastHuman: null, due: '2026-12-31' }, H: { lastHuman: null, due: '2026-12-31' } });
  assert.ok(LOG.includes('Platform Lead') && LOG.includes('Data/Privacy Lead'));
});

test('due dates are per block: a human row resets only its block, G+H resets both, engineering never counts', () => {
  assert.deepEqual(gate(LOG, '2026-12-31').warnings, []);
  const overdue = gate(LOG, '2027-01-01');
  assert.equal(overdue.failures.length, 0);
  assert.equal(overdue.warnings.length, 2);
  assert.ok(has(overdue.warnings, 'Block G Staff Console Recalibration (Appendix N Part 3 Stage 6, Platform Lead) was due 2026-12-31'));
  const strict = gate(LOG, '2027-01-01', true);
  assert.ok(has(strict.failures, 'Block H Analytics and Operations Recalibration (Appendix O Part 3 Stage 6, Data/Privacy Lead) was due 2026-12-31'));

  const engineering = withHistory(LOG, [['2026-12-15', 'engineering', 'G+H']]);
  assert.equal(gate(engineering).schedule.blocks.G.due, '2026-12-31');

  const onlyG = withHistory(LOG, [['2026-12-15', 'human', 'G']]);
  const partial = gate(onlyG, '2027-01-01', true);
  assert.equal(partial.schedule.blocks.G.due, '2027-03-15');
  assert.equal(partial.schedule.blocks.H.due, '2026-12-31');
  assert.equal(partial.failures.length, 1);
  assert.ok(has(partial.failures, 'Block H'));

  const both = withHistory(LOG, [['2026-12-15', 'human', 'G+H']]);
  assert.deepEqual(gate(both, '2027-03-15', true).failures, []);
  assert.equal(gate(both, '2027-03-16', true).failures.length, 2);
  const latest = withHistory(LOG, [['2027-01-10', 'human', 'H'], ['2026-12-15', 'human', 'G+H']]);
  assert.equal(gate(latest).schedule.blocks.H.lastHuman, '2027-01-10');
  assert.equal(gate(latest).schedule.blocks.H.due, '2027-04-10');
});

test('a malformed history fails whatever the date', () => {
  const noDue = LOG.replace(/First human review due: \d{4}-\d{2}-\d{2}/, 'First human review due: soon');
  assert.ok(has(gate(noDue).failures, 'First human review due'));
  assert.ok(has(gate(withHistory(LOG, [['2026-10-01', 'informal', 'G']])).failures, '"informal"'));
  assert.ok(has(gate(withHistory(LOG, [['2026-10-01', 'human', 'A']])).failures, 'block is "A"'));
  assert.ok(has(gate(withHistory(LOG, [['2026-02-30', 'human', 'G']])).failures, 'no valid date ("2026-02-30")'));
  assert.ok(has(gate(null).failures, 'is missing'));
  assert.equal(reviewSchedules(null).blocks.G.due, null);
});

test('threshold drift fails: a missing metric, an unknown row, a wrong kind, block or requirement, a dropped citation', () => {
  const missing = LOG.replace(/^\| `stale_grant_rate` .*\n/m, '');
  assert.ok(has(checkDrift(missing, src()), 'Appendix N 1.1 metric stale_grant_rate (G.4) has no row'));
  const unknown = LOG.replace(/(\| `stale_grant_rate` [^\n]*\n)/, '$1| `made_up_metric` | G | 1.1 | G.4 | diagnostic | none | nowhere |\n');
  assert.ok(has(checkDrift(unknown, src()), 'made_up_metric is not an Appendix N or O Part 1 metric'));
  const kind = LOG.replace('| `stale_grant_rate` | G | 1.1 | G.4 | diagnostic |', '| `stale_grant_rate` | G | 1.1 | G.4 | release gate |');
  assert.ok(has(checkDrift(kind, src()), 'stale_grant_rate is "release gate" in the log but "diagnostic"'));
  const block = LOG.replace('| `missing_emitter_closure` | H |', '| `missing_emitter_closure` | G |');
  assert.ok(has(checkDrift(block, src()), 'missing_emitter_closure is Block "G" in the log but Block H'));
  const requirement = LOG.replace('| `live_activity_audit_completeness` | G | 1.2 | G.3 |', '| `live_activity_audit_completeness` | G | 1.2 | G.2 |');
  assert.ok(has(checkDrift(requirement, src()), 'live_activity_audit_completeness verifies "G.2" in the log but G.3'));
  const cite = LOG.replace('`content_bypass_metrics` (`backend/src/services/contentRelease.ts`)', 'the bypass log');
  assert.ok(has(checkDrift(cite, src()), "release_verification_bypass_rate's Source no longer cites content_bypass_metrics"));
  const badKind = LOG.replace('| `export_job_terminal_state` | H | 1.3 | H.3 | documentation |', '| `export_job_terminal_state` | H | 1.3 | H.3 | retired |');
  assert.ok(has(checkDrift(badKind, src()), 'has kind "retired"'));
});

test('a source that disappears from the code fails, and a retired mechanism coming back fails', () => {
  const emitter = checkDrift(LOG, src({ files: { 'frontend/src/routes/app/TutorPage.tsx': 'export default function TutorPage() {}\n' } }));
  assert.ok(has(emitter, "missing_emitter_closure: frontend/src/routes/app/TutorPage.tsx no longer contains \"trackInsight('tutor_open'\""));
  const gone = checkDrift(LOG, src({ files: { 'backend/src/scripts/opsJobDrill.ts': null } }));
  assert.ok(has(gone, 'simulated_job_failure_drill: backend/src/scripts/opsJobDrill.ts is missing'));
  const queries = read('dataintel/src/routes/queries.ts');
  const back = checkDrift(LOG, src({ files: { 'dataintel/src/routes/queries.ts': `${queries}\nrouter.post('/exports/jobs', createJob);\n` } }));
  assert.ok(has(back, 'export_job_terminal_state: dataintel/src/routes/queries.ts matches'));
});

test('calibration drift fails against the constant, every watched-job window and the latest migration', () => {
  const logged = LOG.replace('| `g4.access_review_cadence_days` | 90 |', '| `g4.access_review_cadence_days` | 60 |');
  const failures = checkDrift(logged, src());
  assert.ok(has(failures, 'g4.access_review_cadence_days: the log says 60 but backend/src/services/adminData.ts ACCESS_REVIEW_CADENCE_DAYS is 90'));
  assert.ok(has(failures, 'g4.access_review_cadence_days: the log says 60 but staff_access_review_status default (latest migration) is 90'));

  const opsJobs = read('backend/src/services/opsJobs.ts').replace('  vault_drift: 36,', '  vault_drift: 48,');
  assert.ok(has(checkDrift(LOG, src({ files: { 'backend/src/services/opsJobs.ts': opsJobs } })), 'OPS_JOB_STALE_HOURS.vault_drift is 48'));
  const tutor = read('backend/src/services/tutorData.ts').replace('export const RETENTION_STALE_HOURS = 36;', 'export const RETENTION_STALE_HOURS = 30;');
  assert.ok(has(checkDrift(LOG, src({ files: { 'backend/src/services/tutorData.ts': tutor } })), 'RETENTION_STALE_HOURS is 30'));
  const later = 'CREATE OR REPLACE FUNCTION public.content_retro_check_days() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 45 $$;';
  assert.ok(has(checkDrift(LOG, src({ migrations: [later] })), 'g2.retro_check_days: the log says 30 but content_retro_check_days() (latest migration) is 45'));
  const policy = read('dataintel/src/services/experiments.ts').replace('{ adults_only: 18, od26_c17: 10 }', '{ adults_only: 18, od26_c17: 10, teens_only: 13 }');
  assert.ok(has(checkDrift(LOG, src({ files: { 'dataintel/src/services/experiments.ts': policy } })), 'POLICY_MIN_AGE is adults_only 18, od26_c17 10, teens_only 13'));
  const unreadable = checkDrift(LOG, src({ files: { 'backend/src/services/warehouseAlerts.ts': null } }));
  assert.ok(has(unreadable, 'h3.alert_undelivered_window_hours: backend/src/services/warehouseAlerts.ts ALERT_UNDELIVERED_WINDOW_HOURS could not be read'));
  const extra = LOG.replace(/(\| `h7\.policy_min_age` [^\n]*\n)/, '$1| `h9.unknown` | 1 | H.9 | nowhere |\n');
  assert.ok(has(checkDrift(extra, src()), 'calibration h9.unknown is not read from any code'));
  assert.equal(CALIBRATIONS.length, 6);
});

test('the Stage 6 rollback rule must name its five release gates', () => {
  const dropped = LOG.replace('`watchdog_notification_coverage`.\n', 'watchdog coverage.\n');
  assert.ok(has(checkDrift(dropped, src()), 'does not name `watchdog_notification_coverage`'));
  const noSection = LOG.replace('## Stage 6 rollback rule', '## Rollback notes');
  assert.ok(has(checkDrift(noSection, src()), 'no "## Stage 6 rollback rule" section'));
  const softened = LOG.replace('**immediate rollback**', 'a follow-up ticket');
  assert.ok(has(checkDrift(softened, src()), 'no longer says "immediate rollback"'));
});

test('the quarterly issue names both owners, every release gate, the drill, the values and the rollback rule', () => {
  const body = buildIssue({ markdown: LOG, now: '2027-01-01T09:00:00Z', runUrl: 'https://example.test/run/1' });
  assert.match(body, /### Block G: Platform Lead \(Appendix N Part 3 Stage 6\)/);
  assert.match(body, /### Block H: Data\/Privacy Lead \(Appendix O Part 3 Stage 6\)/);
  assert.equal(body.match(/Next due: \*\*2026-12-31\*\* \(overdue\)/g)?.length, 2);
  for (const m of METRICS.filter((x) => x.kind === 'release gate')) assert.ok(body.includes(`- [ ] \`${m.id}\``), m.id);
  assert.ok(!body.includes('- [ ] `stale_grant_rate`'), 'a diagnostic is listed for review, not as a release gate');
  assert.match(body, /Also review: `stale_grant_rate` \(diagnostic\)/);
  assert.match(body, /- \[ \] Run `npm --prefix backend run ops:drill`/);
  assert.match(body, /`g2\.retro_check_days`: 30/);
  for (const id of ROLLBACK) assert.ok(body.includes(`\`${id}\``), id);
  assert.match(body, /Run: https:\/\/example\.test\/run\/1/);
  assert.match(buildIssue({ markdown: LOG, now: '2026-10-01T09:00:00Z' }), /Next due: \*\*2026-12-31\*\* \(due\)/);
  assert.match(buildIssue({ markdown: null, now: '2026-10-01T09:00:00Z' }), /could not be read/);
  assert.equal(issueTitle('2027-01-01T09:00:00Z'), 'Quarterly staff and operations recalibration (Blocks G and H): 2027-Q1');
});

function scratch(markdown = LOG) {
  const root = mkdtempSync(join(tmpdir(), 'staff-ops-review-'));
  for (const path of [LOG_DOC, ...sourceFiles()]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(repo, path), join(root, path));
  }
  cpSync(join(repo, 'database/migrations'), join(root, 'database/migrations'), { recursive: true });
  writeFileSync(join(root, LOG_DOC), markdown);
  return root;
}

function cli(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
}

test('the command line: the gate, --strict, drift, and the issue', () => {
  const root = scratch();
  const ok = cli(['--root', root, '--now', '2026-10-01T00:00:00Z']);
  assert.equal(ok.code, 0, ok.out);
  assert.equal(cli(['--root', root, '--now', '2027-01-02T00:00:00Z']).code, 0);
  assert.equal(cli(['--root', root, '--now', '2027-01-02T00:00:00Z', '--strict']).code, 1);
  writeFileSync(join(root, 'backend/src/services/opsJobs.ts'), read('backend/src/services/opsJobs.ts').replace('export const DELETION_STEP_FAILURE_HOURS = 24;', 'export const DELETION_STEP_FAILURE_HOURS = 12;'));
  const drift = cli(['--root', root, '--now', '2026-10-01T00:00:00Z']);
  assert.equal(drift.code, 1);
  assert.match(drift.out, /h4\.deletion_step_failure_hours: the log says 24/);

  const dir = mkdtempSync(join(tmpdir(), 'staff-ops-issue-'));
  const issue = cli(['--root', root, '--now', '2027-01-01T09:00:00Z', '--issue-file', join(dir, 'issue.md'), '--title-file', join(dir, 'title.txt')]);
  assert.equal(issue.code, 0, issue.out);
  assert.match(readFileSync(join(dir, 'issue.md'), 'utf8'), /ops:drill/);
  assert.equal(readFileSync(join(dir, 'title.txt'), 'utf8'), 'Quarterly staff and operations recalibration (Blocks G and H): 2027-Q1');
  const broken = scratch(LOG.replace(/First human review due: \d{4}-\d{2}-\d{2}/, 'First human review due: later'));
  const red = cli(['--root', broken, '--now', '2027-01-01T09:00:00Z', '--issue-file', join(dir, 'issue2.md'), '--title-file', join(dir, 'title2.txt')]);
  assert.equal(red.code, 1);
  assert.match(readFileSync(join(dir, 'issue2.md'), 'utf8'), /could not be read/);
});

test('the workflow opens the issue every calendar quarter; spec:check and release readiness call the gate', () => {
  const workflow = read('.github/workflows/staff-ops-recalibration-quarterly.yml');
  assert.match(workflow, /cron: '0 9 1 1,4,7,10 \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /node agent\/tools\/staff-ops-review-cadence\.mjs --issue-file issue\.md --title-file title\.txt/);
  assert.match(workflow, /--label staff-ops-review/);
  assert.match(workflow, /if: always\(\) && hashFiles\('issue\.md'\) != ''/);
  assert.match(workflow, /ops:drill/);
  assert.match(read('agent/tools/release-readiness.sh'), /^node agent\/tools\/staff-ops-review-cadence\.mjs --strict$/m);
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['spec:check'], /node agent\/tools\/staff-ops-review-cadence\.mjs(?! --strict)/);
  assert.match(read('docs/operations/GOVERNANCE.md'), /## 7\. Post-launch recalibration/);
  assert.match(read('.github/workflows/repo-gates.yml'), /run: node agent\/tools\/staff-ops-review-cadence\.mjs\n/);
});
