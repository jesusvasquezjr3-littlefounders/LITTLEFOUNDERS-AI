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
const healthy = { data: { jobs: [job('vault_backup', false), job('pulse_backup', false), job('vault_drift', false)], anyStale: false, contentRetroChecks: checks() }, error: null };

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
  assert.deepEqual(evaluateOpsStatus(healthy), { ok: true, stale: [], errors: [], overdueChecks: 0 });
  assert.deepEqual(run(healthy), { code: 0, notice: null });
});

test('a stale job fails the watch and writes the notice a human receives', () => {
  const body = { data: { jobs: [job('vault_backup', true, { lastAttemptAt: '2026-09-25T08:00:00Z', lastAttemptOk: false }), job('pulse_backup', false), job('vault_drift', false)], contentRetroChecks: checks() } };
  const result = run(body);
  assert.equal(result.code, 1);
  assert.match(result.notice, /vault_backup\*\*: last successful run 50 h ago \(window 36 h\)/);
  assert.match(result.notice, /\(failed\)/);
});

test('a reply without the stale boolean, a missing job or an error page is refused, never read as healthy', () => {
  assert.equal(run('<html>502 Bad Gateway</html>').code, 1);
  assert.equal(run({ data: null, error: { code: 'DATA_UNAVAILABLE' } }).code, 1);
  const missing = evaluateOpsStatus({ data: { jobs: [job('vault_backup', false), job('pulse_backup', false)], contentRetroChecks: checks() } });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.errors, ['vault_drift: missing from the reply']);
  const noFlag = evaluateOpsStatus({ data: { jobs: [job('vault_backup', false), job('pulse_backup', false), { job: 'vault_drift' }], contentRetroChecks: checks() } });
  assert.deepEqual(noFlag.errors, ["vault_drift: the reply carries no 'stale' boolean"]);
});

test('the notice names the run when the workflow passes its URL', () => {
  const notice = buildNotification({ stale: [job('vault_drift', true)], errors: [], overdueChecks: 0 }, 'https://example.test/run/1');
  assert.match(notice, /Run: https:\/\/example\.test\/run\/1/);
});

test('G.2: an overdue retroactive release check fails the watch and is named; a reply without the count is refused', () => {
  const overdue = { data: { ...healthy.data, contentRetroChecks: checks(2) } };
  const result = run(overdue);
  assert.equal(result.code, 1);
  assert.match(result.notice, /content_retro_checks\*\*: 2 retroactive release check\(s\) past the 30-day window/);
  const noCount = evaluateOpsStatus({ data: { jobs: healthy.data.jobs } });
  assert.equal(noCount.ok, false);
  assert.deepEqual(noCount.errors, ["content_retro_checks: the reply carries no 'overdue' count"]);
});
