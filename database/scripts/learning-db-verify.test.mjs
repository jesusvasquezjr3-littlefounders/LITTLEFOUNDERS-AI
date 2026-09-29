import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE, LEARNING, NOT_NATIVE } from './learning-db-verify.mjs';

// GAP-FIX-R4 (Appendix C 2.2 B.1; 2.1): the learning database proofs run in CI
// on every build. This fails when a learning verifier is left out of the
// runner, when one hardcodes the audit cluster, when the runner stops running
// the whole chain, or when CI or release readiness stops calling it.

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const files = readdirSync(here);
const LEARNING_PROOF = /^verify-(placement|v2-learning|learning-r\d+|pathway-.+|completion|course-publish|grade)-postgres\.py$/;

test('every learning verifier exists and is listed once', () => {
  for (const name of LEARNING) assert.ok(files.includes(name), `${name} is missing from database/scripts`);
  assert.equal(new Set(LEARNING).size, LEARNING.length);
  for (const name of ['verify-placement-postgres.py', 'verify-v2-learning-postgres.py', 'verify-learning-r2-postgres.py', 'verify-learning-r3-postgres.py',
    'verify-learning-r4-postgres.py', 'verify-learning-r5-postgres.py', 'verify-pathway-od25-postgres.py', 'verify-completion-postgres.py', 'verify-course-publish-postgres.py']) {
    assert.ok(LEARNING.includes(name), name);
  }
});

test('a learning verifier cannot be left out of the runner without a stated reason', () => {
  const learning = files.filter((name) => LEARNING_PROOF.test(name));
  assert.ok(learning.length >= 9, learning.join(', '));
  for (const name of learning) assert.ok(LEARNING.includes(name) || NOT_NATIVE[name], `${name} is a learning proof that learning-db-verify.mjs neither runs nor excuses`);
  for (const [name, reason] of Object.entries(NOT_NATIVE)) {
    assert.ok(files.includes(name), name);
    assert.ok(!LEARNING.includes(name), name);
    assert.ok(reason.length > 40, name);
  }
});

test('the gate runs the whole chain on the shared harness, and no verifier hardcodes the audit cluster', () => {
  assert.equal(GATE.env.LF_PG_FULL_CHAIN, '1');
  for (const name of LEARNING) {
    const source = read(`database/scripts/${name}`);
    for (const variable of ['LF_PG_PORT', 'LF_PG_USER']) assert.ok(source.includes(variable), `${name} ignores ${variable}`);
    assert.ok(source.includes('LF_PG_PSQL') || source.includes('LF_PG_BIN'), `${name} ignores the configured psql`);
    assert.ok(!/'-p',\s*'\d+'/.test(source), `${name} hardcodes a port`);
    const wholeChain = /for (migration|m) in (migrations|MIGRATIONS|sorted\(\(ROOT \/ 'database\/migrations'\)\.glob\('\*\.sql'\)\)):/.test(source);
    assert.ok(source.includes("os.environ.get('LF_PG_FULL_CHAIN') == '1'") || wholeChain, `${name} never runs over the whole chain`);
    // A report goes where it is asked, never into a directory CI does not have.
    assert.ok(!/\(ROOT ?\/ ?'audit-results\/[^']+'\)\.write_text/.test(source), `${name} writes audit-results unconditionally`);
  }
});

test('CI, the backend placement E2E and release readiness call it', () => {
  assert.equal(JSON.parse(read('package.json')).scripts['learning:db-verify'], 'node database/scripts/learning-db-verify.mjs');
  assert.equal(JSON.parse(read('database/package.json')).scripts['learning:db-verify'], 'node scripts/learning-db-verify.mjs');
  const ci = read('.github/workflows/database-ci.yml');
  assert.match(ci, /\n {2}learning-db-verify:\n/, 'database-ci.yml has no learning-db-verify job');
  assert.ok(ci.includes('node database/scripts/learning-db-verify.mjs'));
  assert.ok(/^npm run learning:db-verify$/m.test(read('agent/tools/release-readiness.sh')));
  // Appendix C 2.2 B.1(b): the placement E2E runs in backend CI on a PostgreSQL service, not behind an opt-in flag.
  const backend = read('.github/workflows/backend-ci.yml');
  assert.match(backend, /image: postgres:17/);
  assert.match(backend, /LF_PG_PORT: '5432'/);
  const e2e = read('backend/src/__tests__/placement.postgres.test.ts');
  assert.ok(!e2e.includes('PLACEMENT_POSTGRES_AUDIT'), 'the placement E2E is still behind the opt-in flag');
  for (const method of ['adaptive_quiz', 'learner_chose_start', 'learner_adjusted', 'no_probe_content_fallback']) assert.ok(e2e.includes(`'${method}'`), method);
});
