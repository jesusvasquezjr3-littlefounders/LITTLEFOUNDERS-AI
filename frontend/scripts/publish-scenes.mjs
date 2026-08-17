/*
 * Publishes the Tutor's scene assets to Depot and records where they landed.
 *
 * WHY A MANIFEST AND NOT JUST A BASE URL. Depot's download route is
 * `/files/:bucket/:hash.:ext`, and its README is explicit that the extension
 * mapping is "independent of the uploader's original filename". It is CONTENT
 * ADDRESSED: there is no route that will serve `rho.glb` under that name. So
 * setting `VITE_SCENE_ASSET_BASE` on its own 404s every asset — the deploy was
 * documented for weeks as blocked only on credentials, and that was wrong.
 *
 * This uploads each file, reads back the name Depot serves it under, and writes
 * `src/tutor-scene/sceneManifest.generated.json`. The manifest holds hashed
 * filenames only, never the host: the host differs per environment and belongs
 * in the env var. Commit the manifest — it is build input, and it contains no
 * secrets.
 *
 * Depot dedups by hash, so re-running is cheap and idempotent: unchanged files
 * come back `deduplicated: true` and nothing is stored twice.
 *
 *   FILEBASE_URL=https://depot.example  INTERNAL_API_KEY=...  \
 *     node scripts/publish-scenes.mjs [--dry-run]
 *
 * `--dry-run` means NO side effects, not "no manifest write": it contacts
 * nothing and uploads nothing. A flag that still performs the expensive half of
 * the operation is how a repair once paid for itself before it ran
 * (/AGENTS.md §1.14).
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, '..', 'public', 'scenes');
const MANIFEST = resolve(HERE, '..', 'src', 'tutor-scene', 'sceneManifest.generated.json');
const BUCKET = 'tutor-scenes';

/** Depot allowlists mime types and maps each to a fixed extension. */
const MIME = {
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

const dryRun = process.argv.includes('--dry-run');

function fail(message) {
  console.error(`publish-scenes: ${message}`);
  process.exit(1);
}

/** Every file under public/scenes, as logical paths using forward slashes. */
async function collect(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, out);
    else out.push(full);
  }
  return out;
}

const files = (await collect(SCENES).catch(() => null)) ?? fail(
  `no assets at ${SCENES}. Run: npm run assets:3d && npm run assets:mouth && npm run assets:clips`,
);

/*
 * `assets:mouth` draws an atlas for all four characters, but only the ones with
 * a fitted card ever load one — liruf and dina keep their painted mouths
 * (/TUTOR_3D.md §3.1). Publishing the other two would put ~124 kB of bytes
 * nobody requests in the bucket and quietly imply they are in use.
 */
const cards = JSON.parse(
  await readFile(resolve(HERE, '..', 'src', 'tutor-scene', 'mouthCards.generated.json'), 'utf8'),
);
const withCards = new Set(Object.keys(cards.characters ?? {}));

const planned = [];
const skipped = [];
for (const path of files) {
  const logical = relative(SCENES, path).split('\\').join('/');
  const atlas = logical.match(/^mouth\/(.+)\.png$/);
  if (atlas && !withCards.has(atlas[1])) {
    skipped.push(logical);
    continue;
  }
  const extension = logical.slice(logical.lastIndexOf('.'));
  const mime = MIME[extension];
  if (!mime) {
    fail(`${logical}: Depot does not accept "${extension}". Allowed here: ${Object.keys(MIME).join(', ')}`);
  }
  planned.push({ path, logical, mime, bytes: (await stat(path)).size });
}
planned.sort((a, b) => a.logical.localeCompare(b.logical));

const total = planned.reduce((sum, f) => sum + f.bytes, 0);
console.log(`publish-scenes: ${planned.length} files, ${(total / 1e6).toFixed(2)} MB → bucket "${BUCKET}"`);
for (const f of planned) {
  console.log(`  ${f.logical.padEnd(24)} ${String((f.bytes / 1024).toFixed(0)).padStart(6)} kB  ${f.mime}`);
}
// Named, not silently dropped: a build step that quietly omits files is how a
// missing asset becomes a mystery in production.
for (const name of skipped) {
  console.log(`  ${name.padEnd(24)}      — skipped, that character has no fitted card`);
}

if (dryRun) {
  console.log('\npublish-scenes: --dry-run — nothing was contacted and nothing was written.');
  process.exit(0);
}

const base = process.env.FILEBASE_URL;
const key = process.env.INTERNAL_API_KEY;
if (!base) fail('FILEBASE_URL is not set. It is the Depot service origin, e.g. https://depot.internal');
if (!key) fail('INTERNAL_API_KEY is not set. Depot\'s management API is internal-only.');

const published = {};
let deduped = 0;

for (const file of planned) {
  const form = new FormData();
  form.set('bucket', BUCKET);
  // These are generated geometry and generated mouth atlases: no PII, the same
  // class as lesson audio and images, and the browser loads them directly.
  form.set('visibility', 'public');
  form.set('file', new Blob([await readFile(file.path)], { type: file.mime }), file.logical);

  const response = await fetch(`${base.replace(/\/$/, '')}/api/v1/files`, {
    method: 'POST',
    headers: { 'x-internal-api-key': key, 'x-service-name': 'frontend-publish-scenes' },
    body: form,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) {
    // Depot's own message, not just the status: a bare "400" says nothing, and
    // the body is where the reason lives.
    fail(`${file.logical}: Depot responded ${response.status} — ${body?.error?.message ?? '(no body)'}`);
  }

  const url = body?.data?.url;
  if (typeof url !== 'string') fail(`${file.logical}: Depot returned no url`);
  // The manifest stores only the served NAME. The origin is per-environment and
  // lives in VITE_SCENE_ASSET_BASE, so a manifest committed from staging still
  // resolves correctly in production.
  published[file.logical] = url.slice(url.lastIndexOf('/') + 1);
  if (body.data.deduplicated) deduped += 1;
  console.log(`  ✓ ${file.logical.padEnd(24)} ${published[file.logical]}${body.data.deduplicated ? '  (already stored)' : ''}`);
}

const manifest = {
  _comment:
    'GENERATED by scripts/publish-scenes.mjs. Maps each scene asset\'s logical path to the name Depot serves it under. Depot is CONTENT-ADDRESSED, so a deployed build asks for the hash, never the original filename. Commit this file: it is build input and holds no secrets.',
  bucket: BUCKET,
  publishedAt: new Date().toISOString(),
  files: published,
};
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`\npublish-scenes: wrote ${relative(resolve(HERE, '..'), MANIFEST)}`);
console.log(`  ${planned.length} files, ${deduped} already stored`);
console.log('\nNext: commit the manifest, then set on the frontend deployment');
console.log(`  VITE_SCENE_ASSET_BASE = ${base.replace(/\/$/, '')}/files/${BUCKET}`);
