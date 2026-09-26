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

test('the 3D stage bridge is two named files, never a directory, and grants no legacy UI', async () => {
  const { boundaryFailures, STAGE_BRIDGES } = await import('./check-product-spec.mjs');
  const root = resolve('/repo');
  const file = (path) => resolve(root, path);
  const stage = "import { TutorStage } from '@/tutor-scene/TutorStage';\nimport { probeQuality } from '@/tutor-scene/quality';\nimport { useTheme } from '@/theme/useTheme';\n";
  assert.deepEqual(STAGE_BRIDGES, ['frontend/src/rebuild/learning/CompactMentorStage.tsx', 'frontend/src/rebuild/mentor/MentorStage.tsx']);
  assert.deepEqual(boundaryFailures(root, file('frontend/src/rebuild/learning/CompactMentorStage.tsx'), stage), []);
  assert.deepEqual(boundaryFailures(root, file('frontend/src/rebuild/mentor/MentorStage.tsx'), stage), []);
  // Relative imports resolve to the same targets.
  assert.deepEqual(boundaryFailures(root, file('frontend/src/rebuild/mentor/MentorStage.tsx'), "import { TutorStage } from '../../tutor-scene/TutorStage';"), []);
  // Any other file of the Mentor folder, a nested MentorStage, and legacy UI or session hooks from the bridge are refused.
  assert.equal(boundaryFailures(root, file('frontend/src/rebuild/mentor/SessionEnd.tsx'), stage).length, 3);
  assert.equal(boundaryFailures(root, file('frontend/src/rebuild/mentor/stage/MentorStage.tsx'), stage).length, 3);
  assert.match(boundaryFailures(root, file('frontend/src/rebuild/mentor/MentorStage.tsx'), "import { Button } from '@/components/ui';")[0], /Legacy dependency/);
  assert.match(boundaryFailures(root, file('frontend/src/rebuild/mentor/MentorStage.tsx'), "import { useTutorSession } from '@/tutor/useTutorSession';")[0], /Legacy dependency/);
  // The rebuilt UI and its copy stay open to every rebuilt file.
  assert.deepEqual(boundaryFailures(root, file('frontend/src/rebuild/mentor/CheckIn.tsx'), "import { Button } from '../design/controls';\nimport en from '@/i18n/en-US/rebuild-mentor.json';"), []);
});
