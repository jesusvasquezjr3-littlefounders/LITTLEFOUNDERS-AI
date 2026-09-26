import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRebuildNamespaces, LOCALES } from './check-rebuild-namespaces.mjs';

/* The namespace check must pass on the real tree and fail on each regression it exists to catch. */

const repo = fileURLToPath(new URL('../../', import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lf-rebuild-ns-'));
  mkdirSync(join(root, 'frontend/src/i18n'), { recursive: true });
  cpSync(resolve(repo, 'frontend/src/i18n/rebuild.ts'), join(root, 'frontend/src/i18n/rebuild.ts'));
  for (const locale of LOCALES) cpSync(resolve(repo, 'frontend/src/i18n', locale), join(root, 'frontend/src/i18n', locale), { recursive: true });
  return root;
}

test('the real tree passes', () => {
  assert.deepEqual(checkRebuildNamespaces(repo), []);
});

test('refuses an unregistered namespace, a missing one, a duplicated key and the old rebuild.json', () => {
  const root = fixture();
  try {
    const dir = join(root, 'frontend/src/i18n/es-MX');
    writeFileSync(join(dir, 'rebuild-extra.json'), '{}\n');
    rmSync(join(root, 'frontend/src/i18n/pt-BR/rebuild-staff.json'));
    const learn = JSON.parse(readFileSync(join(dir, 'rebuild-learn.json'), 'utf8'));
    writeFileSync(join(dir, 'rebuild-learn.json'), JSON.stringify({ ...learn, designSystem: {} }));
    writeFileSync(join(root, 'frontend/src/i18n/en-US/rebuild.json'), '{}\n');
    const failures = checkRebuildNamespaces(root).join('\n');
    assert.match(failures, /es-MX\/rebuild-extra\.json is not a registered namespace/);
    assert.match(failures, /pt-BR\/rebuild-staff\.json is missing/);
    assert.match(failures, /es-MX: top-level key "designSystem" is in both rebuild-core\.json and rebuild-learn\.json/);
    assert.match(failures, /en-US\/rebuild\.json exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
