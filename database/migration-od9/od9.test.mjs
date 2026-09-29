// Unit tests for the OD-9 toolkit runner and the synthetic fixture generator.
// The SQL itself is proven on native PostgreSQL by prove-od9-postgres.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { commandSql, installSql, migrationPlan, parseArgs, planMarkdown, psqlCommand, runPsql, spotCheckMarkdown, summarizeComparison, tally, UsageError } from './od9.mjs';
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

test('the consent registry in the fixture mirrors the migration seed (every migration that registers a practice)', () => {
  const dir = new URL('../migrations/', import.meta.url);
  const migration = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(new URL(f, dir), 'utf8'))
    .filter((sql) => sql.includes('INSERT INTO public.data_practices')).join('\n');
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

test('spot-check and plan arguments are validated and bound as literals', () => {
  assert.deepEqual(parseArgs(['spot-check', '--label', 'before']), { command: 'spot-check', apply: false, label: 'before', families: 10 });
  assert.equal(parseArgs(['spot-check', '--label', 'before', '--families', '25']).families, 25);
  assert.match(commandSql(parseArgs(['spot-check', '--label', 'before', '--families', '3'])), /od9\.capture_spot_check\('before', 3, NULL\)/);
  assert.match(commandSql(parseArgs(['spot-check', '--label', 'after', '--from', 'before'])), /od9\.capture_spot_check\('after', NULL, 'before'\)/);
  assert.equal(parseArgs(['plan', '--applied-through', '0082']).appliedThrough, 82);
  for (const bad of [
    ['spot-check'], ['spot-check', '--label', 'a', '--families', '0'], ['spot-check', '--label', 'a', '--families', '501'],
    ['spot-check', '--label', 'a', '--families', '2.5'], ['spot-check', '--label', 'a', '--from', "b'"],
    ['spot-check', '--label', 'a', '--from', 'b', '--families', '3'], ['inventory', '--label', 'a', '--from', 'b'],
    ['plan'], ['plan', '--applied-through', 'latest'], ['defects', '--applied-through', '10'], ['plan', '--applied-through', '10', '--apply'],
  ]) assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
});

test('migrationPlan lists pending migrations in order and refuses an ordering the filenames break', () => {
  const header = (phase, release) => `-- x\n-- @phase: ${phase}\n${release ? `-- @after-release: none — ${release[0]}\n${release.slice(1).map((l) => `--   ${l}\n`).join('')}` : ''}--\nSELECT 1;\n`;
  const files = [
    { file: '0001_family_hub_base.sql', sql: header('expand') },
    { file: '0002_family_hub_more.sql', sql: header('expand') },
    { file: '0003_wallet_guards.sql', sql: header('contract', ['narrows writes. Apply with the Core release that ships the S07.1', 'routes, after the S07.1 family_hub_* migrations and before wallet_flows.']) },
    { file: '0004_wallet_flows.sql', sql: header('contract', ['narrows savings_bonus_rules writes; apply after wallet_guards.']) },
    { file: '0005_undeclared.sql', sql: 'SELECT 1;' },
    { file: 'README.md', sql: '' },
  ];
  const plan = migrationPlan(files, 1);
  assert.deepEqual(plan.pending.map((p) => p.file), ['0002_family_hub_more.sql', '0003_wallet_guards.sql', '0004_wallet_flows.sql', '0005_undeclared.sql']);
  assert.deepEqual(plan.counts, { pending: 4, expand: 1, contract: 2 });
  const guards = plan.pending[1];
  assert.deepEqual(guards.after, ['0001_family_hub_base.sql', '0002_family_hub_more.sql']);
  assert.deepEqual(guards.before, ['0004_wallet_flows.sql']);
  assert.match(guards.afterRelease, /S07\.1 routes, after the S07\.1 family_hub_\* migrations/);
  assert.deepEqual(plan.pending[2].after, ['0003_wallet_guards.sql'], 'a table name that is no migration is ignored');
  assert.deepEqual(plan.violations, []);
  assert.deepEqual(plan.undeclared, ['0005_undeclared.sql']);
  assert.equal(plan.ok, false);

  const swapped = migrationPlan([...files.slice(0, 2), { file: '0003_wallet_flows.sql', sql: header('contract', ['after wallet_guards.']) },
    { file: '0004_wallet_guards.sql', sql: header('contract', ['after family_hub_more and before wallet_flows.']) }], 0);
  assert.deepEqual(swapped.violations, [
    '0003_wallet_flows.sql states it applies after 0004_wallet_guards.sql, which sorts later',
    '0004_wallet_guards.sql states it applies before 0003_wallet_flows.sql, which sorts earlier',
  ]);
  assert.match(planMarkdown(swapped), /\*\*Refused:\*\*[\s\S]*\| \[ \] \| 0004_wallet_guards\.sql \| contract \| none — after family_hub_more/);
});

test('the real migration chain states no ordering its filenames break', () => {
  const dir = new URL('../migrations/', import.meta.url);
  const files = readdirSync(dir).map((file) => ({ file, sql: readFileSync(new URL(file, dir), 'utf8') }));
  const plan = migrationPlan(files, 0);
  assert.deepEqual(plan.violations, []);
  assert.ok(plan.pending.some((p) => p.after.length > 0), 'the headers do state orderings');
});

test('spotCheckMarkdown renders a sign-off sheet with every compared value', () => {
  const rows = [
    { family_key: 'aaaaaaaa-1', user_id: 'u1', username: 'kid|one', item: 'coins:save', before_value: '40', after_value: '40', verdict: 'same' },
    { family_key: 'aaaaaaaa-1', user_id: 'u1', username: null, item: 'learning_streak (current/best)', before_value: '3 / 9', after_value: '3 / 10', verdict: 'changed' },
  ];
  const md = spotCheckMarkdown({ ok: false, families: 1, accounts: 1, same: 1, changed: 1, missing: 0, newAfter: 0, rows }, { label: 'after', from: 'before' });
  assert.match(md, /before vs after/);
  assert.match(md, /\*\*a promised value changed or disappeared\*\*/);
  assert.match(md, /kid\\|one \| coins:save \| 40 \| 40 \| same/);
  assert.match(md, /\| u1 \| learning_streak \(current\/best\) \| 3 \/ 9 \| 3 \/ 10 \| changed/);
  assert.match(md, /Reviewed by \(name, role\)/);
});

test('retire-catalog: dry run by default, --apply allowed, labels defaulted and checked (OD-24)', () => {
  assert.deepEqual(parseArgs(['retire-catalog']), { command: 'retire-catalog', apply: false, before: 'before', label: 'retired' });
  assert.equal(parseArgs(['retire-catalog', '--apply', '--before', 'legacy_t0']).before, 'legacy_t0');
  for (const bad of [['retire-catalog', '--label', 'before'], ['retire-catalog', '--label', 'pre_retire'], ['retire-catalog', '--before', 'Bad Label']]) {
    assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
  }
  assert.match(commandSql(parseArgs(['retire-catalog', '--apply'])), /od9\.run_retire_catalog\(true, 'before'\)/);
});

test('retire-catalog SQL archives only, refuses before kc-credit, and never deletes (OD-24)', () => {
  const sql = readFileSync(new URL('./sql/60_retire_catalog.sql', import.meta.url), 'utf8');
  assert.match(sql, /r\.step = 'kc_credit' AND r\.mode = 'apply'/);
  assert.match(sql, /OD9_RETIRE_REFUSED/);
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\s+public\./im);
  for (const table of ['lessons', 'topics', 'sagas', 'adventures', 'courses']) assert.match(sql, new RegExp(String.raw`UPDATE public\.${table} \w+ SET status = 'archived'`));
  const dir = new URL('../migrations/', import.meta.url);
  const guard = readdirSync(dir).find((f) => f.endsWith('_legacy_catalog_delete_guard.sql'));
  assert.ok(guard, 'the delete guard migration exists');
  const migration = readFileSync(new URL(guard, dir), 'utf8');
  for (const table of ['lessons', 'topics', 'courses']) assert.match(migration, new RegExp(String.raw`BEFORE DELETE ON public\.${table}\b`));
});

test('coins owed but not split yet are inventoried and spot-checked (OD-9 section 4.1, 4.5)', () => {
  const inventory = readFileSync(new URL('./sql/10_inventory.sql', import.meta.url), 'utf8');
  const category = (name) => {
    const start = inventory.indexOf(`('${name}', `);
    assert.ok(start >= 0, `${name} category exists`);
    return inventory.slice(start, inventory.indexOf('$q$)', start));
  };
  assert.match(category('pending_coins'), /'public\.pending_credits', ARRAY\['id', 'kid_user_id', 'amount', 'source', 'allocated', 'created_at'\]/);
  assert.match(category('pending_coins'), /jsonb_build_array\(id, amount, source, allocated, created_at\)[\s\S]*ORDER BY id[\s\S]*GROUP BY kid_user_id/);
  assert.match(category('owed_task_rewards'), /WHERE status = 'approved' AND NOT allocated AND reward_coins > 0 GROUP BY assigned_to/);
  assert.match(category('chore_history'), /'reward_coins', 'allocated'/);
  assert.match(category('chore_history'), /jsonb_build_array\(id, assigned_by, title, status, reward_coins, allocated,/);

  const spot = readFileSync(new URL('./sql/50_spot_check.sql', import.meta.url), 'utf8');
  const item = spot.slice(spot.indexOf("'owed coins (unsplit)'"), spot.indexOf('WHERE o.total > 0'));
  assert.match(item, /public\.pending_credits pc WHERE pc\.kid_user_id = x\.user_id AND NOT pc\.allocated/);
  assert.match(item, /t\.status = 'approved' AND NOT t\.allocated AND t\.reward_coins > 0/);
});

test('the fixture holds owed coins and its expectation matches the SQL it writes', () => {
  const { legacySql, expectations: X } = generateLegacyFixture();
  const owed = {};
  let credits = 0;
  let tasks = 0;
  for (const m of legacySql.matchAll(/INSERT INTO public\.pending_credits \(id, kid_user_id, amount, source, allocated, created_at\) VALUES \('[^']+', '([^']+)', (\d+), 'allowance', (true|false),/g)) {
    credits += 1;
    if (m[3] === 'false') owed[m[1]] = (owed[m[1]] ?? 0) + Number(m[2]);
  }
  for (const m of legacySql.matchAll(/INSERT INTO public\.tasks \(id, assigned_by, assigned_to, title, status, reward_coins, allocated\) VALUES \('[^']+', '[^']+', '([^']+)', '[^']+', 'approved', (\d+), false\)/g)) {
    tasks += 1;
    owed[m[1]] = (owed[m[1]] ?? 0) + Number(m[2]);
  }
  assert.deepEqual(owed, X.owed);
  assert.equal(credits, X.pendingCredits);
  assert.equal(tasks, X.owedTasks);
  assert.ok(tasks > 0, 'some approved chore rewards are unsplit');
  assert.match(legacySql, /'allowance', true,/, 'an already split payout is kept too');
  // The proof's negative control deletes one of kid_c's two unsplit payouts; kid_a_one always holds one.
  const unsplitOf = (uid) => legacySql.split('\n').filter((l) => l.startsWith('INSERT INTO public.pending_credits') && l.includes(`'${uid}'`) && l.includes("'allowance', false,")).length;
  assert.equal(unsplitOf(X.ids.kid_c), 2);
  assert.ok(X.owed[X.ids.kid_a_one] > 0);
  // Families without a Family Hub record owe nothing.
  assert.equal(X.owed[X.ids.teen_indie], undefined);
});
