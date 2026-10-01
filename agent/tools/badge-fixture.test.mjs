import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { renderBadgeFixture } from '../../frontend/scripts/audits/badge-fixture.mjs';
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
test('badge audit uses actual isolated Depot source with frontend-only dependencies', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lf-isolated-badge-'));
  try {
    for (const name of ['badge.ts', 'badgeArt.ts', 'badgeDesign.generated.ts']) cpSync(new URL('../../filebase/src/lib/' + name, import.meta.url), join(base, name));
    assert.equal(existsSync(join(base, 'node_modules')), false);
    const png = await renderBadgeFixture({ source: join(base, 'badge.ts') });
    assert.deepEqual(png, await renderBadgeFixture(), 'isolated authored source matches the repository compositor exactly');
    const metadata = await frontendRequire('sharp')(png).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 1080);
    assert.equal(metadata.height, 1920);
    assert.ok(png.length > 1000, 'real compositor output');
  } finally {
    const scoped = relative(resolve(tmpdir()), resolve(base));
    assert.ok(scoped && !scoped.startsWith('..') && !isAbsolute(scoped) && scoped.startsWith('lf-isolated-badge-'));
    rmSync(base, { recursive: true, force: true });
  }
});
