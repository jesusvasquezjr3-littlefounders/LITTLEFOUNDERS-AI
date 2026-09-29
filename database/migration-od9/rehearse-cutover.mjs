#!/usr/bin/env node
// Full local rehearsal of the cutover runbook (docs/operations/CUTOVER-RUNBOOK.md)
// on a native PostgreSQL with the synthetic legacy dataset. Never the shared
// Docker stack, never production, no paid provider.
//
//   R1 freeze        the database refuses application writes; the operator's
//                    sessions (and only them) override it
//   R2 inventory     od9 before inventory and the section 4.5 spot sample
//   R3 backup        pg_dump -Fc, encrypted (AES-256-GCM), plaintext deleted
//   R4 verify backup decrypt, pg_restore --list, restore into a scratch
//                    database whose inventory must equal "before"
//   R5 plan          the ordered migration plan above the legacy baseline
//   R6 migrate       every pending migration in plan order (expand and contract)
//   R7 toolkit       seed:kc rows, then defects / kc-credit / consent: dry run,
//                    apply, re-apply; counts equal the fixture's expectations
//   R8 reconcile     after inventory + compare, spot check against "before"
//   R9 smoke         the migrated schema through the browser roles
//   R10 switch       lift the freeze; application writes work again
//   R11 post-release post-switch inventory equals "after"; findings queue
//   R11b retire      od9 retire-catalog: archive the legacy catalog, compare
//   R12 restore      the rollback: decrypt the backup into a fresh database,
//                    which must equal the pre-migration state; negative
//                    controls (a streak, one unsplit allowance payout)
//
// Cluster: LF_PG_BIN (directory with psql, pg_dump, pg_restore), LF_PG_PORT,
// LF_PG_USER, LF_PG_DATA (the data directory the server must report).
// LF_OD9_FAMILIES scales the synthetic dataset (random families, default 12).
// Report: audit-results/od9/rehearsal/<database>/rehearsal.json.
// LF_KEEP_DB=1 keeps the databases.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { run, runPsql } from './od9.mjs';
import { decryptFile, encryptFile, generateKey, readKey } from './backup-crypto.mjs';
import { generateLegacyFixture, PRACTICES } from './fixtures/generate-legacy-fixture.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MIGRATIONS = readdirSync(join(ROOT, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
const LEGACY_LAST = MIGRATIONS.findIndex((f) => f.endsWith('_rename_banking_accounts.sql'));
assert.ok(LEGACY_LAST > 0, 'legacy baseline migration not found');
const BASELINE = Number(MIGRATIONS[LEGACY_LAST].slice(0, 4));

const BIN = process.env.LF_PG_BIN ?? join(ROOT, '.codex/audit-db/pgsql/bin');
const env = { ...process.env, LF_PG_BIN: BIN };
const PORT = process.env.LF_PG_PORT ?? '15483';
const USER = process.env.LF_PG_USER ?? 'audit_owner';
const DATA = process.env.LF_PG_DATA ?? join(ROOT, '.codex/audit-db/data');
const FAMILIES = Number(process.env.LF_OD9_FAMILIES ?? 12);
assert.ok(Number.isInteger(FAMILIES) && FAMILIES >= 0 && FAMILIES <= 5000, 'LF_OD9_FAMILIES must be 0-5000');
const exe = (name) => {
  const win = join(BIN, `${name}.exe`);
  return existsSync(win) ? win : join(BIN, name);
};

// The operator's sessions override the freeze; application roles do not.
const OPERATOR = "options='-c default_transaction_read_only=off'";
const conn = (dbname, operator = true) => `host=127.0.0.1 port=${PORT} user=${USER} dbname=${dbname}${operator ? ` ${OPERATOR}` : ''}`;
const sql = (query, dbname, operator = true) => runPsql(query, { db: conn(dbname, operator), env }).trim();
const tool = (name, args) => {
  const result = spawnSync(exe(name), args, { encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr.trim() || `exited ${result.status}`}`);
  return result.stdout;
};
const cluster = ['-h', '127.0.0.1', '-p', PORT, '-U', USER];

const norm = (p) => resolve(p).replace(/\\/g, '/').toLowerCase();
if (norm(sql('SHOW data_directory', 'postgres')) !== norm(DATA)) throw new Error('Refusing an unowned database cluster (LF_PG_DATA)');

const SHIM = readFileSync(join(ROOT, 'database/scripts/verify-money-presentation-postgres.py'), 'utf8').split('SHIM = """')[1].split('"""')[0];
const AUTH_EXTRA = `
ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}'::jsonb;
CREATE TABLE auth.identities (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL, provider_id text NOT NULL);`;

const db = `lf_cut_${randomBytes(5).toString('hex')}`;
const verifyDb = `${db}_verify`;
const restoredDb = `${db}_restored`;
const WORK = join(ROOT, 'audit-results/od9/rehearsal', db);
mkdirSync(WORK, { recursive: true });
const quiet = () => {};
const cli = (dbname, args) => run({ apply: false, ...args, db: conn(dbname), out: join(WORK, dbname) }, { env, log: quiet });

const claims = (uid, role) => `SELECT set_config('request.jwt.claims', '${JSON.stringify({ role, ...(uid ? { sub: uid } : {}) })}', false), `
  + `set_config('request.jwt.claim.sub', '${uid ?? ''}', false), set_config('request.jwt.claim.role', '${role}', false);\nSET ROLE ${role};\n`;
const as = (role, uid, query) => sql(claims(uid, role) + query, db, false).split('\n').slice(1).join('\n');
const refused = (fn, token) => {
  try { fn(); } catch (error) {
    assert.ok(String(error.message).includes(token), `expected ${token}, got ${error.message}`);
    return;
  }
  throw new Error(`expected refusal ${token}`);
};

const phases = [];
const checks = [];
const phase = async (id, name, fn) => {
  const t0 = performance.now();
  const detail = await fn();
  const seconds = Math.round((performance.now() - t0) / 100) / 10;
  phases.push({ id, name, seconds, ...(detail ? { detail } : {}) });
  console.log(`ok - ${id} ${name} (${seconds}s)${detail ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const check = (label) => checks.push(label);

const fixture = generateLegacyFixture({ randomFamilies: FAMILIES });
const X = fixture.expectations;
const id = X.ids;
const keyFile = join(WORK, 'backup.key');
const plainDump = join(WORK, 'legacy.dump');
const sealed = join(WORK, 'legacy.dump.lfbk');
const started = Date.now();

try {
  await phase('R0', 'legacy platform stand-in (not part of the cutover)', () => {
    sql(`CREATE DATABASE ${db}`, 'postgres');
    sql(SHIM + AUTH_EXTRA, db);
    for (const m of MIGRATIONS.slice(0, LEGACY_LAST + 1)) sql(readFileSync(join(ROOT, 'database/migrations', m), 'utf8'), db);
    sql(fixture.legacySql, db);
    assert.equal(sql('SELECT count(*) FROM auth.users', db), String(X.accounts));
    return {
      migrations: LEGACY_LAST + 1, accounts: X.accounts,
      lessonProgress: Number(sql('SELECT count(*) FROM public.lesson_progress', db)), ledger: Number(sql('SELECT count(*) FROM public.wallet_ledger', db)),
      bytes: Number(sql('SELECT pg_database_size(current_database())', db)),
    };
  });

  await phase('R1', 'freeze', () => {
    sql(`ALTER DATABASE ${db} SET default_transaction_read_only = on`, 'postgres');
    refused(() => as('authenticated', id.kid_a_one, `UPDATE public.learning_stats SET minutes_learned = minutes_learned WHERE user_id = '${id.kid_a_one}'`),
      'read-only transaction');
    refused(() => as('service_role', null, `UPDATE public.learning_stats SET minutes_learned = minutes_learned WHERE user_id = '${id.kid_a_one}'`),
      'read-only transaction');
    check('freeze: an application session (authenticated or service_role) is refused any write with "read-only transaction"; the operator session overrides it explicitly');
    return 'application writes refused';
  });

  await phase('R2', 'before inventory and spot sample', () => {
    cli(db, { command: 'install' });
    const before = cli(db, { command: 'inventory', label: 'before' });
    assert.deepEqual(before.rows.filter((r) => r.status !== 'captured'), [], 'every promised category is readable');
    assert.equal(Number(before.rows.find((r) => r.category === 'pending_coins').total_rows), X.pendingCredits);
    assert.equal(Number(before.rows.find((r) => r.category === 'owed_task_rewards').total_rows), X.owedTasks);
    assert.equal(Number(before.rows.find((r) => r.category === 'allowance_promise').total_rows), Object.keys(X.allowance).length);
    assert.equal(Number(before.rows.find((r) => r.category === 'savings_bonus_promise').total_rows), Object.keys(X.bonus).length);
    const spot = cli(db, { command: 'spot-check', label: 'before', families: 5 });
    assert.ok(spot.accounts >= 5);
    check(`before inventory: ${before.rows.length} categories and identifier sets, no gap; spot sample of ${spot.families} families (${spot.accounts} accounts, ${spot.rows.length} readable values)`);
    return { categories: before.rows.length, spotFamilies: spot.families, spotValues: spot.rows.length };
  });

  let manifest;
  await phase('R3', 'encrypted backup', async () => {
    writeFileSync(keyFile, `${generateKey()}\n`, { mode: 0o600 });
    tool('pg_dump', [...cluster, '-d', db, '-Fc', '-f', plainDump]);
    manifest = await encryptFile(plainDump, sealed, readKey(keyFile));
    assert.equal(existsSync(plainDump), false, 'the plaintext dump is deleted');
    assert.equal(readFileSync(sealed).subarray(0, 5).toString(), 'LFBK1', 'the stored file is the encrypted container');
    assert.equal(readFileSync(sealed).includes(Buffer.from('PGDMP')), false, 'no pg_dump header in the stored file');
    check(`backup: pg_dump -Fc of ${manifest.plaintextBytes} bytes encrypted with AES-256-GCM (key fingerprint recorded, never the key); the plaintext deleted; the stored file carries no pg_dump signature`);
    return { dumpBytes: manifest.plaintextBytes, storedBytes: manifest.ciphertextBytes };
  });

  await phase('R4', 'verify backup (decrypt, list, restore to scratch, inventory)', async () => {
    const key = readKey(keyFile);
    const tampered = join(WORK, 'tampered.lfbk');
    const bytes = readFileSync(sealed);
    bytes[Math.floor(bytes.length / 2)] ^= 0x01;
    writeFileSync(tampered, bytes);
    writeFileSync(`${tampered}.manifest.json`, readFileSync(`${sealed}.manifest.json`));
    await assert.rejects(decryptFile(tampered, join(WORK, 'tampered.dump'), key), /decryption failed/);
    await assert.rejects(decryptFile(sealed, join(WORK, 'wrong.dump'), randomBytes(32)), /not the key/);
    rmSync(tampered); rmSync(`${tampered}.manifest.json`);
    await decryptFile(sealed, plainDump, key);
    const toc = tool('pg_restore', ['--list', plainDump]).split('\n').filter((l) => l && !l.startsWith(';')).length;
    sql(`CREATE DATABASE ${verifyDb}`, 'postgres');
    tool('pg_restore', [...cluster, '-d', verifyDb, '--exit-on-error', plainDump]);
    rmSync(plainDump);
    const check0 = cli(verifyDb, { command: 'inventory', label: 'backup_check' });
    assert.ok(check0.rows.length > 0);
    const verdict = cli(verifyDb, { command: 'compare', before: 'before', after: 'backup_check' });
    assert.equal(verdict.ok, true, JSON.stringify(verdict.failures.slice(0, 5)));
    const spot = cli(verifyDb, { command: 'spot-check', label: 'backup_check', from: 'before' });
    assert.equal(spot.ok, true);
    assert.equal(spot.same, spot.rows.length);
    sql(`DROP DATABASE ${verifyDb} WITH (FORCE)`, 'postgres');
    check(`backup verified: a flipped byte and a wrong key are refused; the decrypted dump matches the recorded SHA-256, lists ${toc} TOC entries and restores into a scratch database whose inventory equals "before" (${verdict.families.same}/${verdict.families.total} families) and whose spot values all match`);
    return { tocEntries: toc, families: `${verdict.families.same}/${verdict.families.total}` };
  });

  let plan;
  await phase('R5', 'migration plan', () => {
    plan = run({ command: 'plan', appliedThrough: BASELINE, out: WORK }, { log: quiet });
    assert.equal(plan.ok, true, JSON.stringify({ violations: plan.violations, undeclared: plan.undeclared }));
    assert.deepEqual(plan.pending.map((p) => p.file), MIGRATIONS.slice(LEGACY_LAST + 1));
    check(`plan above ${String(BASELINE).padStart(4, '0')}: ${plan.counts.pending} pending (${plan.counts.expand} expand, ${plan.counts.contract} contract), every stated ordering consistent with filename order`);
    return plan.counts;
  });

  await phase('R6', 'apply migrations in plan order', () => {
    const timings = [];
    for (const p of plan.pending) {
      const t0 = performance.now();
      try { sql(readFileSync(join(ROOT, 'database/migrations', p.file), 'utf8'), db); } catch (error) { throw new Error(`${p.file}: ${error.message}`); }
      timings.push({ file: p.file, phase: p.phase, ms: Math.round(performance.now() - t0) });
    }
    const sum = (ph) => Math.round(timings.filter((t) => t.phase === ph).reduce((n, t) => n + t.ms, 0) / 100) / 10;
    const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 5).map((t) => `${t.file} ${t.ms} ms`);
    check(`all ${timings.length} pending migrations applied over the frozen legacy data (expand ${sum('expand')} s, contract ${sum('contract')} s)`);
    return { expandSeconds: sum('expand'), contractSeconds: sum('contract'), slowest };
  });

  await phase('R7', 'OD-9 toolkit (dry run, apply, re-apply)', () => {
    sql(fixture.seedKcSql, db);
    sql(fixture.driftSql, db);
    cli(db, { command: 'install' });
    const dry = cli(db, { command: 'defects' });
    assert.deepEqual(Object.fromEntries(Object.entries(dry.counts).map(([k, n]) => [k.replace(':would_', ':'), n])), X.defects);
    assert.deepEqual(cli(db, { command: 'defects', apply: true }).counts, X.defects);
    const expectedCredits = new Set(X.credits.map((c) => `${c.user}|${X.kcIdByKey[c.kc]}|${c.topic}|${c.stage}`)).size;
    assert.equal(cli(db, { command: 'kc-credit' }).new_credits, expectedCredits);
    assert.equal(cli(db, { command: 'kc-credit', apply: true }).new_credits, expectedCredits);
    assert.equal(cli(db, { command: 'kc-credit', apply: true }).new_credits, 0);
    const consent = cli(db, { command: 'consent' });
    assert.equal(consent.children, X.consent.children);
    assert.equal(consent.missing, X.consent.missing);
    cli(db, { command: 'consent', apply: true });
    assert.equal(cli(db, { command: 'consent', apply: true }).missing, X.consent.missing);
    check(`toolkit: defects ${JSON.stringify(X.defects)}, ${expectedCredits} KC credits and ${X.consent.missing} consent gaps over ${X.consent.children} children, each exactly the fixture's independent expectation; re-applies write nothing new`);
    return { credits: expectedCredits, consentGaps: X.consent.missing, children: X.consent.children };
  });

  await phase('R8', 'reconcile (after inventory, compare, spot check)', () => {
    cli(db, { command: 'inventory', label: 'after' });
    const verdict = cli(db, { command: 'compare', before: 'before', after: 'after' });
    assert.equal(verdict.ok, true, JSON.stringify(verdict.failures.slice(0, 5)));
    const spot = cli(db, { command: 'spot-check', label: 'after', from: 'before' });
    assert.equal(spot.ok, true, JSON.stringify(spot.rows.filter((r) => r.verdict !== 'same').slice(0, 5)));
    check(`reconcile: 0 comparison failures, ${verdict.families.same}/${verdict.families.total} families identical, every username and guardian link unchanged; spot check ${spot.same}/${spot.rows.length} values identical across ${spot.families} families (sign-off sheet written)`);
    return { families: `${verdict.families.same}/${verdict.families.total}`, spotSame: `${spot.same}/${spot.rows.length}`, newAfter: verdict.newAfter };
  });

  await phase('R9', 'smoke checks through the browser roles', () => {
    const own = X.credits.filter((c) => c.user === id.kid_a_one).length;
    assert.equal(as('authenticated', id.kid_a_one, 'SELECT count(*) FROM public.legacy_kc_credits'), String(own));
    assert.equal(as('authenticated', id.parent_a, `SELECT count(*) FROM public.legacy_kc_credits WHERE user_id = '${id.kid_a_one}'`), String(own));
    assert.equal(as('authenticated', id.parent_c, `SELECT count(*) FROM public.legacy_kc_credits WHERE user_id = '${id.kid_a_one}'`), '0');
    assert.equal(as('service_role', null, `SELECT count(*) FROM public.get_completed_course_badges('${X.badgeHolders[0]}')`), '1');
    refused(() => as('authenticated', X.badgeHolders[0], `SELECT count(*) FROM public.get_completed_course_badges('${X.badgeHolders[0]}')`), 'permission denied');
    assert.equal(as('authenticated', id.kid_a_one, 'SELECT count(*) FROM public.data_practices'), String(PRACTICES.length));
    assert.equal(as('service_role', null, `SELECT public.has_data_practice_consent('${id.kid_a_one}', 'mentor.disposition_profile')`), 'f');
    refused(() => as('authenticated', id.kid_a_one, 'SELECT count(*) FROM od9.findings'), 'permission denied');
    refused(() => as('authenticated', id.kid_a_one, `UPDATE public.learning_stats SET minutes_learned = minutes_learned WHERE user_id = '${id.kid_a_one}'`),
      'read-only transaction');
    check('smoke: a learner reads their KC credits and a verified Tutor their child\'s (an unrelated Tutor none); Core (service role) still reads a frozen legacy badge through get_completed_course_badges, which stays closed to browser roles; the consent registry and helper answer; od9 stays closed; the freeze still holds until the switch');
    return 'passed';
  });

  await phase('R10', 'switch (lift the freeze)', () => {
    sql(`ALTER DATABASE ${db} RESET default_transaction_read_only`, 'postgres');
    as('service_role', null, `UPDATE public.learning_stats SET minutes_learned = minutes_learned WHERE user_id = '${id.kid_a_one}'`);
    check('switch: once the freeze is lifted an application write succeeds');
    return 'application writes accepted';
  });

  await phase('R11', 'post-release checks', () => {
    cli(db, { command: 'inventory', label: 'post' });
    const verdict = cli(db, { command: 'compare', before: 'after', after: 'post' });
    assert.equal(verdict.ok, true);
    const findings = cli(db, { command: 'findings' }).rows;
    const open = findings.filter((f) => ['flagged', 'review_required'].includes(f.status)).reduce((n, f) => n + Number(f.n), 0);
    check(`post-release: the post-switch inventory equals "after"; ${open} findings wait for a person (${findings.map((f) => `${f.kind}/${f.status} ${f.n}`).join(', ')})`);
    return { openFindings: open };
  });

  await phase('R11b', 'retire the legacy catalog (T plus 7 days)', () => {
    const dry = cli(db, { command: 'retire-catalog' });
    assert.equal(dry.missingCredit, 0);
    const retired = cli(db, { command: 'retire-catalog', apply: true });
    assert.equal(retired.ok, true);
    const live = sql(`SELECT count(*) FROM public.lessons WHERE status <> 'archived'`, db);
    assert.equal(live, '0');
    check(`retire-catalog: ${Object.entries(retired.counts).map(([k, n]) => `${n} ${k}`).join(', ')} archived (never deleted) after the KC credit; the pre_retire/retired comparison passes (${retired.comparison.families.same}/${retired.comparison.families.total} families)`);
    return retired.counts;
  });

  await phase('R12', 'restore rehearsal (rollback to the backup)', async () => {
    await decryptFile(sealed, plainDump, readKey(keyFile));
    sql(`CREATE DATABASE ${restoredDb}`, 'postgres');
    tool('pg_restore', [...cluster, '-d', restoredDb, '--exit-on-error', plainDump]);
    rmSync(plainDump);
    cli(restoredDb, { command: 'inventory', label: 'restored' });
    const verdict = cli(restoredDb, { command: 'compare', before: 'before', after: 'restored' });
    assert.equal(verdict.ok, true, JSON.stringify(verdict.failures.slice(0, 5)));
    assert.equal(sql("SELECT to_regclass('public.legacy_kc_credits') IS NULL AND to_regclass('public.data_practices') IS NULL", restoredDb), 't');
    assert.equal(sql('SELECT count(*) FROM od9.findings', restoredDb), '0');
    const spot = cli(restoredDb, { command: 'spot-check', label: 'restored', from: 'before' });
    assert.equal(spot.ok, true);
    // Negative control: one day of one sampled child's best streak must show up.
    const sampled = sql("SELECT user_id FROM od9.spot_values WHERE label = 'before' AND item LIKE 'learning_streak%' ORDER BY user_id LIMIT 1", restoredDb);
    sql(`UPDATE public.learning_stats SET longest_streak = longest_streak + 1 WHERE user_id = '${sampled}'`, restoredDb);
    const tamper = cli(restoredDb, { command: 'spot-check', label: 'tamper', from: 'before' });
    assert.equal(tamper.ok, false);
    assert.deepEqual(tamper.rows.filter((r) => r.verdict !== 'same').map((r) => `${r.user_id}:${r.item}`), [`${sampled}:learning_streak (current/best)`]);
    sql(`UPDATE public.learning_stats SET longest_streak = longest_streak - 1 WHERE user_id = '${sampled}'`, restoredDb);
    // Negative control (section 4.1): one sampled child's unsplit allowance payout deleted.
    const owedKid = sql(`SELECT s.user_id FROM od9.spot_values s WHERE s.label = 'before' AND s.item = 'owed coins (unsplit)'
      AND EXISTS (SELECT 1 FROM public.pending_credits p WHERE p.kid_user_id = s.user_id AND NOT p.allocated) ORDER BY s.user_id LIMIT 1`, restoredDb);
    assert.ok(owedKid, 'the spot sample holds a child with unsplit allowance');
    const owedBefore = Number(sql(`SELECT value FROM od9.spot_values WHERE label = 'before' AND user_id = '${owedKid}' AND item = 'owed coins (unsplit)'`, restoredDb));
    const [creditId, amount] = sql(`SELECT id || '|' || amount FROM public.pending_credits WHERE kid_user_id = '${owedKid}' AND NOT allocated ORDER BY id LIMIT 1`, restoredDb).split('|');
    sql(`DELETE FROM public.pending_credits WHERE id = '${creditId}'`, restoredDb);
    cli(restoredDb, { command: 'inventory', label: 'owed_tamper' });
    const lost = cli(restoredDb, { command: 'compare', before: 'restored', after: 'owed_tamper' });
    assert.equal(lost.ok, false);
    const familyKey = sql(`SELECT family_key FROM od9.inventory WHERE label = 'restored' AND user_id = '${owedKid}' LIMIT 1`, restoredDb);
    assert.deepEqual(lost.failures.map((f) => `${f.scope}:${f.category}:${f.subject}`).sort(), [`account:pending_coins:${owedKid}`, `family:all:${familyKey}`].sort());
    const owedSpot = cli(restoredDb, { command: 'spot-check', label: 'owed_tamper', from: 'before' });
    assert.equal(owedSpot.ok, false);
    assert.deepEqual(owedSpot.rows.filter((r) => r.verdict !== 'same').map((r) => `${r.user_id}:${r.item}:${r.verdict}`),
      [`${owedKid}:owed coins (unsplit):${owedBefore === Number(amount) ? 'missing_after' : 'changed'}`]);
    check(`restore:the encrypted backup decrypts and restores into a fresh database that equals the pre-migration state (${verdict.families.same}/${verdict.families.total} families, no rebuild table, no finding, every spot value); negative control: one extra day on one sampled best streak fails the spot check at exactly that value, and one deleted unsplit allowance payout fails the comparison exactly at that child's pending_coins and family and the spot check exactly at that child's owed coins`);
    return { families: `${verdict.families.same}/${verdict.families.total}` };
  });

  const report = {
    database: db, families: FAMILIES, accounts: X.accounts, legacyBaseline: MIGRATIONS[LEGACY_LAST], migrations: MIGRATIONS.length,
    seconds: Math.round((Date.now() - started) / 1000), phases, checks, backup: manifest && { ...manifest, keyFingerprint: undefined },
  };
  writeFileSync(join(WORK, 'rehearsal.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nrehearsal passed in ${report.seconds}s (${checks.length} checks); report ${join(WORK, 'rehearsal.json')}`);
} finally {
  for (const f of [plainDump, keyFile]) rmSync(f, { force: true });
  if (process.env.LF_KEEP_DB !== '1') {
    for (const d of [verifyDb, restoredDb, db]) {
      try { sql(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`, 'postgres'); } catch { /* reported by the failing phase */ }
    }
    rmSync(sealed, { force: true });
  }
}
