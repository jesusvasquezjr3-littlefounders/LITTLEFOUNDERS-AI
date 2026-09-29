import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifiers } from './social-db-verify.mjs';

// Appendix J 1.3: the release gate runs every social data-gateway verifier.
// A new verify-social-*.py joins by its name; the three named extras must stay.
test('social:db-verify runs every verify-social-*.py and the three named extras', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const files = readdirSync(here);
  const list = verifiers(files);
  for (const f of files.filter((name) => /^verify-social-.+\.py$/.test(name))) assert.ok(list.includes(f), f);
  for (const f of ['verify-teen-discoverable-postgres.py', 'verify-coop-goals-postgres.py', 'verify-account-erasure-postgres.py', 'verify-social-protection-postgres.py']) {
    assert.ok(list.includes(f), f);
  }
  assert.equal(new Set(list).size, list.length);
});

test('a verifier list never silently shrinks when an extra is missing from disk', () => {
  assert.deepEqual(verifiers(['verify-social-a.py', 'verify-coop-goals-postgres.py']), ['verify-social-a.py', 'verify-coop-goals-postgres.py']);
});

// Appendix J 2.2 E.1(c) / 1.3 (GAP-FIX-R5 social): the proof runs on every
// build, not only when database/ changes. The unfiltered repo gates carry the
// job, and its verifier list can never be empty or lose the discovery and
// guardian-end proofs, so a green job always means something ran.
test('the unfiltered repo gates, database CI and release readiness run it, with a non-empty list', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const list = verifiers();
  assert.ok(list.length > 0, 'social:db-verify has nothing to run');
  for (const f of ['verify-social-discovery-postgres.py', 'verify-social-guardian-end-postgres.py', 'verify-social-pattern-postgres.py', 'verify-social-request-report-postgres.py']) {
    assert.ok(list.includes(f), f);
  }
  for (const workflow of ['.github/workflows/database-ci.yml', '.github/workflows/repo-gates.yml']) {
    const text = read(workflow);
    assert.match(text, /\n {2}social-db-verify:\n/, `${workflow} has no social-db-verify job`);
    assert.ok(text.includes('node database/scripts/social-db-verify.mjs'), workflow);
  }
  const gates = read('.github/workflows/repo-gates.yml');
  assert.doesNotMatch(gates.slice(0, gates.indexOf('\njobs:')), /\n\s+paths:/, 'repo-gates.yml must stay unfiltered');
  assert.match(gates, /social-db-verify:[\s\S]*?image: postgres:17[\s\S]*?node-version: 24[\s\S]*?python-version: '3\.12'[\s\S]*?LF_PG_VERIFY_JOBS: '3'/);
  assert.equal(JSON.parse(read('package.json')).scripts['social:db-verify'], 'node database/scripts/social-db-verify.mjs');
  assert.ok(/^npm run social:db-verify$/m.test(read('agent/tools/release-readiness.sh')));
});
