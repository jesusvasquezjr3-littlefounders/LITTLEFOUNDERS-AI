import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNotification, evaluateOpsStatus } from './ops-job-watch.mjs';

const TOOL = fileURLToPath(new URL('./ops-job-watch.mjs', import.meta.url));
const job = (name, stale, extra = {}) => ({ job: name, stale, lastRunAt: null, hoursSinceLastRun: stale ? 50 : 3, staleAfterHours: 36, lastAttemptAt: null, lastAttemptOk: null, ...extra });
const checks = (overdue = 0) => ({ overdue, windowDays: 30 });
const reviews = (due = 0) => ({ due, windowDays: 90 });
const retention = (stale = false) => job('tutor_retention', stale);
const alerts = (undelivered = 0, list = []) => ({ undelivered, windowHours: 36, alerts: list });
const extras = { tutorRetention: retention(), contentRetroChecks: checks(), accessReviews: reviews(), alerts: alerts() };
const healthy = { data: { jobs: [job('vault_backup', false), job('pulse_backup', false), job('vault_drift', false)], anyStale: false, ...extras }, error: null };

function run(body) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-watch-'));
  const status = join(dir, 'status.json');
  const notice = join(dir, 'notice.md');
  writeFileSync(status, typeof body === 'string' ? body : JSON.stringify(body));
  try {
    execFileSync(process.execPath, [TOOL, '--status-file', status, '--notify-file', notice], { stdio: 'pipe' });
    return { code: 0, notice: existsSync(notice) ? readFileSync(notice, 'utf8') : null };
  } catch (error) {
    return { code: error.status, notice: existsSync(notice) ? readFileSync(notice, 'utf8') : null };
  }
}

test('a healthy status passes and notifies nobody', () => {
  assert.deepEqual(evaluateOpsStatus(healthy), { ok: true, stale: [], errors: [], overdueChecks: 0, dueReviews: 0, undeliveredAlerts: 0, alerts: [] });
  assert.deepEqual(run(healthy), { code: 0, notice: null });
});

test('a stale job fails the watch and writes the notice a human receives', () => {
  const body = { data: { jobs: [job('vault_backup', true, { lastAttemptAt: '2026-09-25T08:00:00Z', lastAttemptOk: false }), job('pulse_backup', false), job('vault_drift', false)], ...extras } };
  const result = run(body);
  assert.equal(result.code, 1);
  assert.match(result.notice, /vault_backup\*\*: last successful run 50 h ago \(window 36 h\)/);
  assert.match(result.notice, /\(failed\)/);
});

test('a reply without the stale boolean, a missing job or an error page is refused, never read as healthy', () => {
  assert.equal(run('<html>502 Bad Gateway</html>').code, 1);
  assert.equal(run({ data: null, error: { code: 'DATA_UNAVAILABLE' } }).code, 1);
  const missing = evaluateOpsStatus({ data: { jobs: [job('vault_backup', false), job('pulse_backup', false)], ...extras } });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.errors, ['vault_drift: missing from the reply']);
  const noFlag = evaluateOpsStatus({ data: { jobs: [job('vault_backup', false), job('pulse_backup', false), { job: 'vault_drift' }], ...extras } });
  assert.deepEqual(noFlag.errors, ["vault_drift: the reply carries no 'stale' boolean"]);
});

test('the notice names the run when the workflow passes its URL', () => {
  const notice = buildNotification({ stale: [job('vault_drift', true)], errors: [], overdueChecks: 0, dueReviews: 0 }, 'https://example.test/run/1');
  assert.match(notice, /Run: https:\/\/example\.test\/run\/1/);
});

test('G.2: an overdue retroactive release check fails the watch and is named; a reply without the count is refused', () => {
  const overdue = { data: { ...healthy.data, contentRetroChecks: checks(2) } };
  const result = run(overdue);
  assert.equal(result.code, 1);
  assert.match(result.notice, /content_retro_checks\*\*: 2 retroactive release check\(s\) past the 30-day window/);
  const noCount = evaluateOpsStatus({ data: { jobs: healthy.data.jobs, tutorRetention: retention(), accessReviews: reviews(), alerts: alerts() } });
  assert.equal(noCount.ok, false);
  assert.deepEqual(noCount.errors, ["content_retro_checks: the reply carries no 'overdue' count"]);
});

test('Appendix O 1.3: a stale Mentor retention sweep fails the watch and is named in the notice a human receives', () => {
  const body = { data: { ...healthy.data, tutorRetention: retention(true), anyStale: true } };
  const result = run(body);
  assert.equal(result.code, 1);
  assert.match(result.notice, /\*\*tutor_retention\*\*: last successful run 50 h ago \(window 36 h\)/);
  assert.match(result.notice, /outlive its 90-day window/);
});

test('Appendix O 1.3: a reply without the retention sweep, or with it under another name, is refused, never read as healthy', () => {
  const { tutorRetention: _drop, ...withoutRetention } = healthy.data;
  const missing = evaluateOpsStatus({ data: withoutRetention });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.errors, ['tutor_retention: missing from the reply']);
  const renamed = evaluateOpsStatus({ data: { ...healthy.data, tutorRetention: job('vault_backup', true) } });
  assert.equal(renamed.ok, false);
  assert.deepEqual(renamed.errors, ['tutor_retention: missing from the reply']);
  const noFlag = evaluateOpsStatus({ data: { ...healthy.data, tutorRetention: { job: 'tutor_retention' } } });
  assert.deepEqual(noFlag.errors, ["tutor_retention: the reply carries no 'stale' boolean"]);
});

test('G.4: an elevated grant past the 90-day access review fails the watch and tells the access owner', () => {
  const result = run({ data: { ...healthy.data, accessReviews: reviews(3) } });
  assert.equal(result.code, 1);
  assert.match(result.notice, /\*\*access_reviews\*\*: 3 elevated staff grant\(s\) past the 90-day access review \(G\.4\)/);
  assert.match(result.notice, /Roles & Access/);
});

test('G.4: a reply without the due count, or with a malformed one, is refused', () => {
  const { accessReviews: _drop, ...withoutReviews } = healthy.data;
  assert.deepEqual(evaluateOpsStatus({ data: withoutReviews }).errors, ["access_reviews: the reply carries no 'due' count"]);
  for (const due of [-1, 1.5, '2', null]) {
    const result = evaluateOpsStatus({ data: { ...healthy.data, accessReviews: { due, windowDays: 90 } } });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["access_reviews: the reply carries no 'due' count"]);
  }
});

test('H.3: an undelivered warehouse alert fails the watch and is named in the notice a human receives', () => {
  const failed = { alertId: 'a1', name: 'dau drop', channel: 'webhook', triggeredAt: '2026-09-29T08:00:00Z', status: 'failed', error: 'HTTP 502', attempts: 3 };
  const unconfigured = { alertId: 'a2', name: 'events `spike`\n[x](y)', channel: 'email', triggeredAt: '2026-09-29T09:00:00Z', status: 'unconfigured', error: null, attempts: 0 };
  const result = run({ data: { ...healthy.data, alerts: alerts(2, [failed, unconfigured]) } });
  assert.equal(result.code, 1);
  assert.match(result.notice, /\*\*alerts\.undelivered\*\*: 2 warehouse alert trigger\(s\) in the last 36 h notified nobody \(H\.3\)/);
  assert.match(result.notice, /"dau drop" \(webhook\) at 2026-09-29T08:00:00Z: failed, HTTP 502, 3 attempt\(s\)/);
  // Staff-authored names cannot inject markdown into the issue.
  assert.match(result.notice, /"events  spike   x \(y\)" \(email\) at 2026-09-29T09:00:00Z: unconfigured, 0 attempt\(s\)/);
});

test('H.3: a reply without the undelivered count, or with an unreadable warehouse (null), is refused, never read as healthy', () => {
  const { alerts: _drop, ...withoutAlerts } = healthy.data;
  assert.deepEqual(evaluateOpsStatus({ data: withoutAlerts }).errors, ["alerts: the reply carries no 'undelivered' count (the warehouse alert history was not read)"]);
  const unreadable = evaluateOpsStatus({ data: { ...healthy.data, alerts: alerts(null) } });
  assert.equal(unreadable.ok, false);
  assert.equal(run({ data: { ...healthy.data, alerts: alerts(null) } }).code, 1);
});

test('H.3: the notice lists at most ten undelivered alerts and counts the rest', () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ alertId: `a${i}`, name: `alert ${i}`, channel: 'webhook', triggeredAt: 't', status: 'failed', error: null, attempts: 3 }));
  const notice = buildNotification({ stale: [], errors: [], overdueChecks: 0, dueReviews: 0, undeliveredAlerts: 14, alerts: list });
  assert.equal((notice.match(/^ {2}- "alert/gm) ?? []).length, 10);
  assert.match(notice, /and 4 more\./);
});
