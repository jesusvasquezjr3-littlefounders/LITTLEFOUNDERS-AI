import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkLegacyUi, FREEZE_FILE, isRemoved, resolveSpecifier } from './check-legacy-ui.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const freeze = JSON.parse(readFileSync(join(ROOT, FREEZE_FILE), 'utf8'));

/** A minimal copy of the repository: the freeze list, its listed files and the i18n loader. */
function fixture(mutate) {
  const root = mkdtempSync(join(tmpdir(), 'legacy-ui-'));
  try {
    for (const file of [FREEZE_FILE, 'frontend/src/i18n/index.ts', ...freeze.files]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(join(ROOT, file), join(root, file));
    }
    const write = (file, text) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
    mutate?.({ root, write });
    return checkLegacyUi(root).failures;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the shipped repository passes', () => {
  assert.deepEqual(checkLegacyUi(ROOT).failures, []);
});

test('a fixture copy of the frozen tree passes (the mutations below start green)', () => {
  assert.deepEqual(fixture(), []);
});

test('RED: a new file under a legacy UI directory', () => {
  const failures = fixture(({ write }) => write('frontend/src/routes/app/learn/NewLegacyPage.tsx', 'export const x = 1;\n'));
  assert.ok(failures.some((f) => f.includes('NewLegacyPage.tsx') && f.includes('new file under the legacy UI directory')), failures.join('\n'));
});

test('RED: the removed Tutor UI directory comes back', () => {
  const failures = fixture(({ write }) => write('frontend/src/tutor/ConversationView.tsx', 'export {};\n'));
  assert.ok(failures.some((f) => f.startsWith('frontend/src/tutor/ConversationView.tsx: new file')), failures.join('\n'));
});

test('RED: a rebuilt screen imports a removed legacy module (alias, relative, dynamic and mocked forms)', () => {
  const failures = fixture(({ write }) => {
    write('frontend/src/rebuild/x/A.tsx', "import { DateField } from '@/components/ui/DateField';\n");
    write('frontend/src/routes/auth/B.test.tsx', "import { ErrorBanner } from './ErrorBanner';\n");
    write('frontend/src/rebuild/x/C.tsx', "const T = lazy(() => import('@/tutor/lab/TutorLabPage'));\n");
    write('frontend/src/rebuild/x/D.test.tsx', "vi.mock('@/guided-voice/useGuidedVoice', () => ({}));\n");
  });
  for (const file of ['rebuild/x/A.tsx', 'routes/auth/B.test.tsx', 'rebuild/x/C.tsx', 'rebuild/x/D.test.tsx']) {
    assert.ok(failures.some((f) => f.startsWith(`frontend/src/${file}: imports`)), `${file}\n${failures.join('\n')}`);
  }
});

test('RED: a stale freeze entry', () => {
  const failures = fixture(({ root }) => rmSync(join(root, 'frontend/src/routes/marketing/BadgeLandingPage.tsx')));
  assert.ok(failures.some((f) => f.includes('BadgeLandingPage.tsx no longer exists')), failures.join('\n'));
});

test('RED: a legacy i18n namespace comes back', () => {
  const failures = fixture(({ root }) => {
    const file = join(root, 'frontend/src/i18n/index.ts');
    writeFileSync(file, readFileSync(file, 'utf8').replace("import enTutor from './en-US/tutor.json';", "import enTutor from './en-US/tutor.json';\nimport enAuth from './en-US/auth.json';"));
  });
  assert.ok(failures.some((f) => f.includes('loads the namespace "auth"')), failures.join('\n'));
});

test('GREEN: new route tests use rebuilt controls and the current Mentor API', () => {
  assert.deepEqual(fixture(({ write }) => {
    write('frontend/src/routes/app/learn/__tests__/Extra.test.tsx', "import { Button } from '@/rebuild/design/controls';\n");
    write('frontend/src/rebuild/x/E.tsx', "import { api } from '@/rebuild/mentor/session/tutorApi';\n");
  }), []);
});

test('the resolver maps alias, relative and preview-entry specifiers', () => {
  assert.equal(resolveSpecifier('frontend/src/routes/auth/X.tsx', '../ErrorBanner'), 'frontend/src/routes/ErrorBanner');
  assert.equal(resolveSpecifier('frontend/src/routes/auth/X.tsx', './ErrorBanner'), 'frontend/src/routes/auth/ErrorBanner');
  assert.equal(resolveSpecifier('frontend/scripts/a.mjs', '/src/tutor/x.ts'), 'frontend/src/tutor/x.ts');
  assert.equal(resolveSpecifier('frontend/src/a.ts', 'react'), null);
  assert.ok(isRemoved('frontend/src/components/ui/Table', freeze.removed));
  assert.ok(isRemoved('frontend/src/components/ui/Button', freeze.removed));
  assert.ok(!isRemoved('frontend/src/tutor-scene/CharacterLayer', freeze.removed));
});
