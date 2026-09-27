// Unit tests for the OD-9 toolkit runner and the synthetic fixture generator.
// The SQL itself is proven on native PostgreSQL by prove-od9-postgres.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { commandSql, installSql, parseArgs, psqlCommand, runPsql, summarizeComparison, tally, UsageError } from './od9.mjs';
import { bandForAge, generateLegacyFixture, mulberry32, PRACTICES } from './fixtures/generate-legacy-fixture.mjs';

test('parseArgs accepts every command and refuses malformed input', () => {
  assert.deepEqual(parseArgs(['inventory', '--label', 'before']), { command: 'inventory', apply: false, label: 'before' });
  assert.equal(parseArgs(['defects', '--apply']).apply, true);
  assert.equal(parseArgs(['consent', '--cutover', '2026-10-01T00:00:00Z']).cutover, '2026-10-01T00:00:00Z');
  for (const bad of [
    [], ['drop-everything'], ['inventory'], ['inventory', '--label', 'Before!'], ['inventory', '--label', "x'; DROP TABLE y; --"],
    ['compare', '--before', 'a'], ['install', '--apply'], ['findings', '--apply'], ['defects', '--label'],
    ['defects', '--frobnicate'], ['consent', '--cutover', 'yesterday'],
  ]) assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
});

test('commandSql binds labels and the cutover as literals and wraps one JSON array', () => {
  assert.equal(commandSql(parseArgs(['inventory', '--label', 'before'])),
    "SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT * FROM od9.capture_inventory('before')) t;");
  assert.match(commandSql(parseArgs(['defects'])), /od9\.run_defects\(false, now\(\)\)/);
  assert.match(commandSql(parseArgs(['defects', '--apply', '--cutover', '2026-10-01T00:00:00Z'])),
    /od9\.run_defects\(true, '2026-10-01T00:00:00\.000Z'::timestamptz\)/);
  assert.match(commandSql(parseArgs(['kc-credit', '--apply'])), /od9\.run_kc_credit\(true\)/);
  assert.match(commandSql(parseArgs(['compare', '--before', 'before', '--after', 'after'])), /compare_inventory\('before', 'after'\)/);
});

test('summarizeComparison fails on any lost or changed promise and passes on new records only', () => {
  const same = { scope: 'family', category: 'all', subject: 'f1', verdict: 'same' };
  const category = { scope: 'category', category: 'xp', before_rows: 3, after_rows: 3, verdict: 'same' };
  assert.equal(summarizeComparison([same, category, { scope: 'account', category: 'mentor_memory', subject: 'u9', verdict: 'new_after' },
    { scope: 'identifier', category: 'username', subject: 'u9', verdict: 'new_after' }]).ok, true);
  for (const failing of [
    { scope: 'account', category: 'coin_balances', subject: 'u1', verdict: 'changed' },
    { scope: 'account', category: 'progress', subject: 'u1', verdict: 'missing_after' },
    { scope: 'family', category: 'all', subject: 'f1', verdict: 'changed' },
    { scope: 'gap', category: 'course_badges', subject: null, verdict: 'absent_after: function absent' },
    { scope: 'identifier', category: 'guardian_link', subject: 'l1', verdict: 'changed' },
    { scope: 'identifier', category: 'username', subject: 'u1', verdict: 'missing_after' },
  ]) {
    const result = summarizeComparison([same, category, failing]);
    assert.equal(result.ok, false, JSON.stringify(failing));
    assert.deepEqual(result.failures, [failing]);
  }
  assert.deepEqual(summarizeComparison([same, { ...same, subject: 'f2', verdict: 'changed' }]).families, { total: 2, same: 1 });
});

test('tally counts and sorts keys', () => {
  assert.deepEqual(tally([{ k: 'b' }, { k: 'a' }, { k: 'b' }], (r) => r.k), { a: 1, b: 2 });
});

test('psqlCommand honours LF_PG_BIN and runPsql refuses empty SQL', () => {
  assert.equal(psqlCommand({}), 'psql');
  assert.match(psqlCommand({ LF_PG_BIN: '/opt/pg/bin' }), /[\\/]opt[\\/]pg[\\/]bin[\\/]psql(\.exe)?$/);
  assert.throws(() => runPsql(undefined), TypeError);
  assert.throws(() => runPsql('   '), TypeError);
});

test('installSql loads every step in order and keeps browser roles out of od9', () => {
  const sql = installSql();
  const order = ['CREATE SCHEMA IF NOT EXISTS od9', 'od9.capture_inventory', 'od9.run_defects', 'od9.run_kc_credit', 'od9.run_consent'].map((s) => sql.indexOf(s));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), JSON.stringify(order));
  assert.match(sql, /REVOKE ALL ON SCHEMA od9 FROM PUBLIC/);
  assert.match(sql, /check_function_bodies = off/);
  for (const step of ['run_defects', 'run_kc_credit', 'run_consent']) {
    const body = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION od9.${step}(`));
    assert.match(body.slice(0, body.indexOf('END $$')), /od9\.require_rebuild_schema\(\)/, `${step} refuses the legacy schema`);
  }
});

test('the consent registry in the fixture mirrors the migration seed', () => {
  const dir = new URL('../migrations/', import.meta.url);
  const file = readdirSync(dir).find((f) => f.endsWith('_od9_legacy_migration.sql'));
  const migration = readFileSync(new URL(file, dir), 'utf8');
  const seeded = [...migration.matchAll(/\('([a-z]+\.[a-z0-9_.-]+)', '[a-z_]+', '[a-z0-9_]+', '[^']+', '[a-z_]+', (true|false),/g)].map((m) => [m[1], m[2] === 'true']);
  assert.deepEqual(seeded, PRACTICES);
});

test('the fixture is deterministic, synthetic and covers every population', () => {
  const a = generateLegacyFixture();
  const b = generateLegacyFixture();
  assert.equal(a.legacySql, b.legacySql);
  assert.equal(a.seedKcSql, b.seedKcSql);
  assert.notEqual(generateLegacyFixture({ seed: 1 }).legacySql, a.legacySql);
  assert.doesNotMatch(a.legacySql, /@(?!example\.test)[a-z0-9-]+\.[a-z]/i, 'only example.test addresses');
  const X = a.expectations;
  for (const kind of ['A5_parent_role_without_justification:mark_staff_granted', 'A5_parent_role_without_justification:review_revoked_verification',
    'A2_legacy_guest:protective_under13_marker', 'A2_legacy_guest:declare_from_birth_date', 'A3_google_no_dob:age_screen_required',
    'A4_no_age_evidence:age_screen_required', 'F2_share_without_expiry:default_expiry', 'age_declaration_from_birth_date:declare_from_birth_date']) {
    assert.ok(X.defects[kind] > 0, kind);
  }
  assert.ok(X.credits.some((c) => c.stage === 'child') && X.credits.some((c) => c.stage === 'teen'));
  assert.ok(X.badgeHolders.length >= 1);
  assert.deepEqual(Object.keys(X.consent.byGrantor).sort(), ['none_available', 'self', 'tutor']);
  assert.equal(X.consent.missing, X.consent.children * PRACTICES.length);
});

test('mulberry32 and bandForAge are stable', () => {
  const r = mulberry32(7);
  const first = [r(), r(), r()];
  const s = mulberry32(7);
  assert.deepEqual([s(), s(), s()], first);
  assert.deepEqual([null, 6, 12, 13, 17, 18].map(bandForAge), [null, 'under_13', 'under_13', '13_to_17', '13_to_17', 'adult']);
});
