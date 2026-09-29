import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCK_D, GATE } from './family-db-verify.mjs';
import { externalClusterEnv, psqlDir } from './pg-verify-runner.mjs';

// GAP-FIX-R3 (Appendix H 2.2 D.1(d), 1.3, Part 3 Stage 2): the Block D
// database proofs run in CI on every build. This fails when a Block D
// verifier is left out of the runner, when the runner stops running the whole
// chain, or when CI or release readiness stops calling it.

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const files = readdirSync(here);

test('every Block D verifier exists and is listed once', () => {
  for (const name of BLOCK_D) assert.ok(files.includes(name), `${name} is missing from database/scripts`);
  assert.equal(new Set(BLOCK_D).size, BLOCK_D.length);
  for (const name of ['verify-freeze-postgres.py', 'verify-family-state-machine-postgres.py', 'verify-teen-wallet-postgres.py',
    'verify-chore-streak-bonus-postgres.py', 'verify-money-habits-postgres.py', 'verify-autonomy-decisions-postgres.py',
    'verify-money-presentation-postgres.py', 'verify-family-governance-postgres.py', 'verify-research-reconsent-postgres.py',
    'verify-teen-deletion-notices-postgres.py', 'verify-teen-bridge-goal-postgres.py']) assert.ok(BLOCK_D.includes(name), name);
});

test('a verifier that cites a Block D clause cannot be left out of the runner', () => {
  // The opening line of each verifier's docstring names what it proves (D.1, D.4 / D.5, S07.x, owner review D-14 ...).
  const blockD = files.filter((name) => /^verify-.+\.py$/.test(name))
    .filter((name) => /\bD[.-]\d+\b|\bS07\b/.test(read(`database/scripts/${name}`).split('\n')[0]));
  assert.ok(blockD.length >= 9, blockD.join(', '));
  for (const name of blockD) assert.ok(BLOCK_D.includes(name), `${name} cites a Block D clause but family-db-verify.mjs does not run it`);
});

test('every database proof the Block D control registry names is run', () => {
  const registry = JSON.parse(read('docs/operations/block-d-controls.json'));
  const proofs = registry.controls.flatMap((c) => c.provedBy ?? []).map((e) => /^database\/scripts\/([^/]+\.py)$/.exec(e.file ?? '')?.[1]).filter(Boolean);
  assert.ok(proofs.includes('verify-freeze-postgres.py'));
  for (const name of proofs) assert.ok(BLOCK_D.includes(name), name);
});

test('the gate runs the whole chain, on the shared harness', () => {
  assert.equal(GATE.env.LF_PG_FULL_CHAIN, '1');
  for (const name of BLOCK_D) {
    const source = read(`database/scripts/${name}`);
    for (const variable of ['LF_PG_BIN', 'LF_PG_PORT', 'LF_PG_USER']) assert.ok(source.includes(variable), `${name} ignores ${variable}`);
    assert.ok(!/'-p',\s*'\d+'/.test(source), `${name} hardcodes a port`);
    // Either it honours LF_PG_FULL_CHAIN (applies every later migration) or it always applies the whole chain unconditionally.
    const wholeChain = /\n\s*for migration in MIGRATIONS:\n\s+sql\(migration\.read_text\(encoding='utf-8'\), db\)/.test(source);
    assert.ok(source.includes("os.environ.get('LF_PG_FULL_CHAIN') == '1'") || wholeChain, `${name} never runs over the whole chain`);
  }
  const freeze = read('database/scripts/verify-freeze-postgres.py');
  assert.ok(!freeze.includes("'0093_enforce_banking_freeze.sql').read_text"), 'the freeze proof applies one migration instead of the chain');
  assert.match(freeze, /for migration in MIGRATIONS:\n\s+sql\(migration\.read_text/);
});

test('CI, the unfiltered repo gates and release readiness call it', () => {
  assert.equal(JSON.parse(read('package.json')).scripts['family:db-verify'], 'node database/scripts/family-db-verify.mjs');
  assert.equal(JSON.parse(read('database/package.json')).scripts['family:db-verify'], 'node scripts/family-db-verify.mjs');
  for (const workflow of ['.github/workflows/database-ci.yml', '.github/workflows/repo-gates.yml']) {
    const text = read(workflow);
    assert.match(text, /\n {2}family-db-verify:\n/, `${workflow} has no family-db-verify job`);
    assert.ok(text.includes('node database/scripts/family-db-verify.mjs'), workflow);
  }
  assert.ok(/^npm run family:db-verify$/m.test(read('agent/tools/release-readiness.sh')));
});

test('an external cluster hands the Block D verifiers the directory of its psql', () => {
  const onPath = (dir) => (path) => path === join(dir, process.platform === 'win32' ? 'psql.exe' : 'psql');
  assert.equal(psqlDir('psql', ['/nope', '/usr/bin'].join(process.platform === 'win32' ? ';' : ':'), onPath('/usr/bin')), '/usr/bin');
  assert.equal(psqlDir('/opt/pg/bin/psql', '', () => false), '/opt/pg/bin');
  assert.equal(psqlDir('psql', '', () => false), null);
  const env = externalClusterEnv({ LF_PG_PORT: '5432', LF_PG_PSQL: 'psql' }, () => '/usr/bin');
  assert.deepEqual(env, { LF_PG_PSQL: 'psql', LF_PG_PORT: '5432', LF_PG_USER: 'postgres', LF_PG_DATA: '/var/lib/postgresql/data', LF_PG_BIN: '/usr/bin' });
  assert.equal(externalClusterEnv({ LF_PG_PORT: '5432', LF_PG_BIN: '/pg' }, () => '/usr/bin').LF_PG_BIN, '/pg');
});
