import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCK_GH, GATE } from './staff-analytics-db-verify.mjs';

// GAP-FIX-R4 (Appendix N 1.1, 1.2, 2.3, Part 3 Stage 2; Appendix O 1.1, 2.2(b),
// Part 3 Stage 2): the Block G/H database proofs run in CI on every build.
// This fails when a Block G/H verifier is left out of the runner, when one
// stops running the whole chain or ignores the cluster the runner hands it,
// or when CI or release readiness stops calling it.

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const files = readdirSync(here);

test('every Block G/H verifier exists and is listed once', () => {
  for (const name of BLOCK_GH) assert.ok(files.includes(name), `${name} is missing from database/scripts`);
  assert.equal(new Set(BLOCK_GH).size, BLOCK_GH.length);
  for (const name of ['verify-staff-ops-postgres.py', 'verify-content-release-postgres.py', 'verify-data-platform-postgres.py',
    'verify-course-publish-postgres.py', 'verify-admin-permissions-postgres.py', 'verify-analytics-disclosure-postgres.py',
    'verify-analytics-postgres.py']) assert.ok(BLOCK_GH.includes(name), name);
});

test('a verifier that cites a Block G/H clause or the staff-ops lane cannot be left out of the runner', () => {
  // The opening line of each verifier's docstring names what it proves (G.1, G.2, H.1, Appendix O, staff-ops ...).
  const blockGH = files.filter((name) => /^verify-.+\.py$/.test(name))
    .filter((name) => /\b[GH]\.\d+\b|staff-ops/i.test(read(`database/scripts/${name}`).split('\n')[0]));
  assert.ok(blockGH.length >= 7, blockGH.join(', '));
  for (const name of blockGH) assert.ok(BLOCK_GH.includes(name), `${name} cites a Block G/H clause but staff-analytics-db-verify.mjs does not run it`);
});

test('the gate runs the whole chain, on the cluster the runner hands it', () => {
  assert.equal(GATE.env.LF_PG_FULL_CHAIN, '1');
  for (const name of BLOCK_GH) {
    const source = read(`database/scripts/${name}`);
    for (const variable of ['LF_PG_PSQL', 'LF_PG_PORT', 'LF_PG_USER']) assert.ok(source.includes(variable), `${name} ignores ${variable}`);
    assert.ok(!/'-p',\s*'\d+'/.test(source), `${name} hardcodes a port`);
    assert.ok(!/BASE = \[str\(RUNTIME/.test(source), `${name} hardcodes the audit cluster's psql`);
    // Either idiom: `migrations = sorted(...)` then the loop, or a module-level
    // `MIGRATIONS = sorted(...)` the loop reads later (verify-origin-postgres.py).
    assert.match(source, /(\w+) = sorted\(\(ROOT \/ 'database\/migrations'\)\.glob\('\*\.sql'\)\)[ \t]*\n(?:[\s\S]*?\n)?\s*for migration in \1:/,
      `${name} never applies the whole chain`);
  }
  // The two proofs that tested a hand-written schema now run the real one.
  for (const name of ['verify-admin-permissions-postgres.py', 'verify-analytics-postgres.py', 'verify-course-publish-postgres.py']) {
    const source = read(`database/scripts/${name}`);
    assert.ok(!/CREATE TABLE public\.(audit_logs|learning_events|user_roles|analytics_consents|courses)\b/i.test(source), `${name} hand-writes a production table`);
  }
});

test('the kid-role consent gate and the Generation read path are proved', () => {
  const analytics = read('database/scripts/verify-analytics-postgres.py');
  assert.match(analytics, /an unconsented kid event must be dropped/);
  assert.match(analytics, /a consented kid event must be admitted/);
  const permissions = read('database/scripts/verify-admin-permissions-postgres.py');
  assert.match(permissions, /generation_runs_live/);
  assert.match(permissions, /view_analytics/);
});

test('CI, the unfiltered repo gates and release readiness call it', () => {
  assert.equal(JSON.parse(read('package.json')).scripts['staff:db-verify'], 'node database/scripts/staff-analytics-db-verify.mjs');
  assert.equal(JSON.parse(read('database/package.json')).scripts['staff:db-verify'], 'node scripts/staff-analytics-db-verify.mjs');
  assert.match(JSON.parse(read('database/package.json')).scripts.test, /scripts\/staff-analytics-db-verify\.test\.mjs/);
  for (const workflow of ['.github/workflows/database-ci.yml', '.github/workflows/repo-gates.yml']) {
    const text = read(workflow);
    assert.match(text, /\n {2}staff-db-verify:\n/, `${workflow} has no staff-db-verify job`);
    assert.ok(text.includes('node database/scripts/staff-analytics-db-verify.mjs'), workflow);
  }
  const readiness = read('agent/tools/release-readiness.sh');
  assert.ok(/^npm run staff:db-verify$/m.test(readiness));
  assert.ok(readiness.indexOf('npm run family:db-verify') < readiness.indexOf('npm run staff:db-verify'), 'staff:db-verify runs after family:db-verify');
});
