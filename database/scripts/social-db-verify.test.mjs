import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
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
