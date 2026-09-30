import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_WINDOW_DAYS, judge, loadProduction, normalizeReply, REVERT_TITLE, UNREAD_TITLE, windowStart,
} from './check-family-production-integrity.mjs';

/*
 * Gap-fix round 8 (Appendix H 1.3 D.4, 1.4, Part 3 Stage 7): the production
 * Unauthorized State-Transition count and the Retention-Policy Compliance
 * Audit are judged at release (--strict) and every day (--watch), and a
 * regression opens the Stage 7 revert decision. Every population the check
 * must refuse: a bypass on any table, an overdue retention row, an unreadable
 * or foreign reply, a missing section; and the one it must let through with a
 * warning: a machine with no production credentials.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const tool = join(repo, 'agent/tools/check-family-production-integrity.mjs');
const SINCE = '2026-09-28T10:00:00.000Z';
const core = (integrity, retention) => ({
  success: true,
  data: {
    days: 1,
    stateIntegrity: { since: SINCE, tables: integrity, transitions: 0, outsideService: 0 },
    retention: retention === null ? null : { pass: true, overdue: 0, tables: retention },
  },
});
const CLEAN_STATE = [{ table: 'tasks', transitions: 9, outsideService: 0 }, { table: 'banking_accounts', transitions: 2, outsideService: 0 }];
const CLEAN_RETENTION = [{ dataClass: 'records', table: 'tasks', retainDays: 400, overdue: 0 }];

function run(args, env = {}) {
  const clean = { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ...env };
  try {
    return { code: 0, out: execFileSync(process.execPath, [tool, ...args], { cwd: repo, env: clean, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'family-integrity-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('normalizes Core\'s envelope, the bare object and the raw RPC rows to one shape', () => {
  const expected = { integrity: [{ table: 'tasks', transitions: 9, outsideService: 1 }], retention: [{ table: 'tasks', dataClass: 'records', retainDays: 400, overdue: 2 }] };
  const enveloped = normalizeReply(core([{ table: 'tasks', transitions: 9, outsideService: 1 }], [{ dataClass: 'records', table: 'tasks', retainDays: 400, overdue: 2 }]));
  assert.deepEqual({ integrity: enveloped.integrity, retention: enveloped.retention }, expected);
  assert.equal(enveloped.since, SINCE);
  const raw = normalizeReply({
    family_state_integrity: [{ table_name: 'tasks', transitions: '9', outside_service: '1' }],
    family_retention_compliance: [{ data_class: 'records', table_name: 'tasks', retain_days: 400, overdue: 2 }],
  });
  assert.deepEqual({ integrity: raw.integrity, retention: raw.retention }, expected);
});

test('a foreign or malformed reply is unreadable, never zero', () => {
  for (const reply of [null, 'html', { error: 'nope' }, { data: { stateIntegrity: { tables: [{ table: 'tasks' }] } } }, { family_state_integrity: [{ table_name: 'tasks', transitions: -1, outside_service: 0 }] }]) {
    assert.equal(normalizeReply(reply).integrity, null, JSON.stringify(reply));
  }
});

test('a clean production reply passes strict and watch', () => {
  for (const mode of [{ strict: true }, { watch: true }]) {
    const verdict = judge({ integrity: CLEAN_STATE, retention: CLEAN_RETENTION, since: SINCE, source: 'x', ...mode });
    assert.deepEqual(verdict.failures, []);
    assert.equal(verdict.notice, null);
  }
});

test('--strict fails on an outside-service transition on any table, naming the table', () => {
  const integrity = [...CLEAN_STATE, { table: 'guardian_links', transitions: 3, outsideService: 1 }];
  const verdict = judge({ integrity, retention: CLEAN_RETENTION, since: SINCE, source: 'x', strict: true });
  assert.equal(verdict.failures.length, 1);
  assert.match(verdict.failures[0], /guardian_links has 1 of 3 transition\(s\) outside the service role since 2026-09-28/);
  // Without --strict the same finding only warns.
  const soft = judge({ integrity, retention: CLEAN_RETENTION, since: SINCE, source: 'x' });
  assert.deepEqual(soft.failures, []);
  assert.equal(soft.warnings.length, 1);
});

test('--strict fails on an overdue retention row, naming the table; --watch only warns on it', () => {
  const retention = [...CLEAN_RETENTION, { dataClass: 'evidence', table: 'tasks.evidence', retainDays: 30, overdue: 4 }];
  const strict = judge({ integrity: CLEAN_STATE, retention, since: SINCE, source: 'x', strict: true });
  assert.deepEqual(strict.failures, ['Retention-Policy Compliance Audit: tasks.evidence (evidence, 30 days) holds 4 row(s) past its period (target 0, Appendix H 1.4)']);
  const watch = judge({ integrity: CLEAN_STATE, retention, since: SINCE, source: 'x', watch: true });
  assert.deepEqual(watch.failures, []);
  assert.equal(watch.warnings.length, 1);
});

test('--watch writes the Stage 7 revert-candidate notice, naming the table and the window', () => {
  const integrity = [{ table: 'banking_accounts', transitions: 2, outsideService: 2 }, { table: 'tasks', transitions: 1, outsideService: 0 }];
  const verdict = judge({ integrity, retention: CLEAN_RETENTION, since: SINCE, source: 'x', watch: true, runUrl: 'https://example.invalid/run/1' });
  assert.equal(verdict.failures.length, 1);
  const [title, ...body] = verdict.notice.split('\n');
  assert.equal(title, `# ${REVERT_TITLE} (banking_accounts, since ${SINCE})`);
  assert.match(body.join('\n'), /reverted rather than patched forward/);
  assert.match(body.join('\n'), /Run: https:\/\/example\.invalid\/run\/1/);
});

test('an unreadable reply fails the watch with its own notice, and fails strict when a named source was unreadable', () => {
  const watch = judge({ integrity: null, retention: null, since: SINCE, unread: 'reply.json is missing', failed: true, watch: true });
  assert.equal(watch.failures.length, 1);
  assert.equal(watch.notice.split('\n')[0], `# ${UNREAD_TITLE}`);
  const strict = judge({ integrity: null, retention: null, since: SINCE, unread: 'the database answered 500', failed: true, strict: true });
  assert.equal(strict.failures.length, 1);
  const missingSection = judge({ integrity: CLEAN_STATE, retention: null, since: SINCE, source: 'x', strict: true });
  assert.deepEqual(missingSection.failures, ['x carries no readable retention audit (Appendix H 1.4)']);
});

test('no credentials and no export: a warning, not a failure, even under --strict', () => {
  const verdict = judge({ integrity: null, retention: null, since: SINCE, unread: 'no --export file and no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in this environment', strict: true });
  assert.deepEqual(verdict.failures, []);
  assert.match(verdict.warnings[0], /did not run/);
});

test('the window starts at --since, else at the last release tag, else 30 days back', () => {
  const now = new Date('2026-09-29T00:00:00Z');
  assert.equal(windowStart({ argv: ['--since=2026-09-01'], now }).since, '2026-09-01T00:00:00.000Z');
  assert.equal(windowStart({ now, lastReleaseTagDate: () => ({ name: 'v1.4.0', date: '2026-09-20T12:00:00+00:00' }) }).since, '2026-09-20T12:00:00.000Z');
  assert.equal(windowStart({ now }).since, new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 86400000).toISOString());
  assert.throws(() => windowStart({ argv: ['--since=yesterday-ish'], now }));
});

test('reads both RPCs with the service role, read only, over the window', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), method: init.method });
    const rows = url.endsWith('family_state_integrity')
      ? [{ table_name: 'tasks', transitions: 3, outside_service: 0 }]
      : [{ data_class: 'records', table_name: 'tasks', retain_days: 400, overdue: 0 }];
    return { ok: true, status: 200, json: async () => rows };
  };
  const loaded = await loadProduction({ env: { SUPABASE_URL: 'https://db.example.invalid/', SUPABASE_SERVICE_ROLE_KEY: 'k' }, readFile: () => '', fetchImpl, since: SINCE });
  assert.deepEqual(calls.map((c) => [c.url, c.body]), [
    ['https://db.example.invalid/rest/v1/rpc/family_state_integrity', { p_since: SINCE }],
    ['https://db.example.invalid/rest/v1/rpc/family_retention_compliance', {}],
  ]);
  assert.deepEqual(loaded.integrity, [{ table: 'tasks', transitions: 3, outsideService: 0 }]);
  const refused = await loadProduction({ env: { SUPABASE_URL: 'https://db.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'k' }, readFile: () => '', fetchImpl: async () => ({ ok: false, status: 404 }), since: SINCE });
  assert.equal(refused.failed, true);
  assert.equal(refused.integrity, null);
});

test('CLI: SKIP without credentials, exit 1 and a notice file on a bypass under --watch', () => {
  const skip = run(['--strict']);
  assert.equal(skip.code, 0, skip.out);
  assert.match(skip.out, /SKIP/);
  withDir((dir) => {
    const reply = join(dir, 'reply.json');
    const notice = join(dir, 'notice.md');
    writeFileSync(reply, JSON.stringify(core([{ table: 'redemptions', transitions: 5, outsideService: 1 }], CLEAN_RETENTION)));
    const bad = run(['--watch', `--export=${reply}`, `--notify-file=${notice}`]);
    assert.equal(bad.code, 1, bad.out);
    assert.match(readFileSync(notice, 'utf8'), /^# Block D Stage 7: revert candidate \(redemptions, since 2026-09-28T10:00:00\.000Z\)/);
    writeFileSync(reply, JSON.stringify(core(CLEAN_STATE, CLEAN_RETENTION)));
    rmSync(notice);
    const good = run(['--strict', `--export=${reply}`, `--notify-file=${notice}`]);
    assert.equal(good.code, 0, good.out);
    assert.match(good.out, /OK/);
    assert.equal(existsSync(notice), false);
    writeFileSync(reply, '<html>502 Bad Gateway</html>');
    assert.equal(run(['--watch', `--export=${reply}`, `--notify-file=${notice}`]).code, 1);
    assert.match(readFileSync(notice, 'utf8'), /could not read the metric/);
  });
});

test('release readiness runs the strict production check right after the Block D database proofs', () => {
  const script = readFileSync(join(repo, 'agent/tools/release-readiness.sh'), 'utf8').replace(/\r\n/g, '\n');
  const verify = script.indexOf('npm run family:db-verify');
  const check = script.indexOf('node agent/tools/check-family-production-integrity.mjs --strict');
  assert.ok(verify > 0 && check > verify, 'check-family-production-integrity.mjs --strict must follow npm run family:db-verify');
  assert.equal(script.slice(verify, check).split('\n').filter((line) => line.trim() && !line.trim().startsWith('#')).length, 1, 'nothing but comments between the two');
});

test('the daily watch workflow reads Core\'s internal route and opens the Stage 7 issue on failure', () => {
  const workflow = readFileSync(join(repo, '.github/workflows/family-integrity-watch.yml'), 'utf8');
  assert.match(workflow, /\/api\/v1\/internal\/ops\/family-integrity\?days=1/);
  assert.match(workflow, /check-family-production-integrity\.mjs --watch --export=reply\.json --notify-file=notice\.md/);
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /gh issue create/);
});
