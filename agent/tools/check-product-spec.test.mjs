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

test('GAP-FIX-R6: the legacy v1 player is reached only through its two adapters, each behind a schema-1 decision (02 rule 23, OD-24)', async () => {
  const { legacyPlayerFailures } = await import('./check-product-spec.mjs');
  const root = resolve('/repo');
  const src = (path, source) => ({ file: resolve(root, 'frontend/src', path), source });
  const staffHost = [
    "const LegacyLessonPlayer = lazy(() => import('./ScopedLessonPlayer'));",
    "const RebuiltLessonPreview = lazy(() => import('@/rebuild/staff/console/StaffLessonPreview'));",
    'export const renderLessonPreview = (request) => {',
    '  if (request.schemaVersion === 2) return <RebuiltLessonPreview request={request} />;',
    '  if (request.schemaVersion === 1) {',
    '    return <LegacyLessonPlayer document={request.document} />;',
    '  }',
    '  return null;',
    '};',
  ].join('\n');
  const learnerHost = [
    'export function isLegacyLessonDocument(document) { return document.schema_version === 1; }',
    "const LegacyLessonIsland = lazy(() => import('./LegacyLessonIsland'));",
    'if (!isLegacyLessonDocument(state.document)) return <Rebuilt />;',
    'return <LegacyLessonIsland />;',
  ].join('\n');
  const healthy = [
    src('app-routes/staffConsole.tsx', staffHost),
    src('app-routes/ScopedLessonPlayer.tsx', "import LessonPlayer from '@/lesson-engine/player/LessonPlayer';"),
    src('routes/app/learn/LessonRoute.tsx', learnerHost),
    src('routes/app/learn/LegacyLessonIsland.tsx', "import LessonPlayer from '@/lesson-engine/player/LessonPlayer';"),
    src('lesson-engine/lab/LessonLabPage.tsx', "import LessonPlayer from '../player/LessonPlayer'"),
  ];
  assert.deepEqual(legacyPlayerFailures(root, healthy), []);
  // A v2 path that falls back on the legacy player: the adapter mounted outside the schema-1 branch.
  const unguarded = staffHost.replace('  if (request.schemaVersion === 2) return <RebuiltLessonPreview request={request} />;', '  if (request.schemaVersion === 2) return <LegacyLessonPlayer document={request.document} />;');
  assert.match(legacyPlayerFailures(root, [src('app-routes/staffConsole.tsx', unguarded)])[0], /without its schema-1 guard/);
  assert.match(legacyPlayerFailures(root, [src('app-routes/staffConsole.tsx', staffHost.replace('if (request.schemaVersion === 1) {', 'if (request) {'))])[0], /without its schema-1 guard/);
  // Any other importer of the player or of an adapter.
  assert.match(legacyPlayerFailures(root, [src('app-routes/staff.tsx', "import LessonPlayer from '@/lesson-engine/player/LessonPlayer';")])[0], /outside its schema-1 adapters/);
  assert.match(legacyPlayerFailures(root, [src('app-routes/staff.tsx', "const P = lazy(() => import('./ScopedLessonPlayer'));")])[0], /outside its host/);
  assert.match(legacyPlayerFailures(root, [src('rebuild/staff/console/StaffContent.tsx', "import { LegacyLessonIsland } from '@/routes/app/learn/LegacyLessonIsland';")])[0], /outside its host/);
  // The learner route keeps its isLegacyLessonDocument decision.
  assert.match(legacyPlayerFailures(root, [src('routes/app/learn/LessonRoute.tsx', learnerHost.replace('document.schema_version === 1', 'true'))])[0], /without its schema-1 guard/);
});
