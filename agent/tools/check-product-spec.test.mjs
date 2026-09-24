import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { verifyManifest } from './check-product-spec.mjs';

test('spec integrity rejects drift, missing files, malformed entries and path traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'lf-spec-test-'));
  try {
    const hash = createHash('sha256').update('binding').digest('hex');
    const entry = `${hash}  ./rule.md`;
    writeFileSync(join(root, 'rule.md'), 'binding');
    assert.deepEqual(verifyManifest(root, entry), []);
    writeFileSync(join(root, 'rule.md'), 'changed');
    assert.match(verifyManifest(root, entry)[0], /checksum mismatch/);
    assert.match(verifyManifest(root, `${hash}  ./missing.md`)[0], /Missing/);
    assert.match(verifyManifest(root, `${hash}  ./../outside.md`)[0], /Invalid/);
    assert.match(verifyManifest(root, 'not a hash')[0], /Malformed/);
    assert.ok(verifyManifest(root, entry + '\n' + entry).some((f) => f.includes('duplicate')));
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  }
});
