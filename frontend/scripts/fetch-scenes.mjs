/*
 * Hydrates `public/scenes/` from Depot so a machine that cannot author the
 * assets can still verify them.
 *
 * `public/scenes/` is gitignored — the artist exports are ~156 MB and belong in
 * Depot, not git — and `clips-biped.glb` on top of that is a BUILD OUTPUT of
 * `npm run assets:clips`, which shells out to Blender. That is fine on a
 * workstation and impossible on a CI runner, which is how `verify:rig` came to
 * be wired into frontend CI in a state where it could only ever fail:
 *
 *   verify-rig: CANNOT RUN — no clip library, so nothing was verified.
 *   Exiting NON-ZERO on purpose: a skip must never read as a pass.
 *
 * The gate was right to refuse. What was missing is this: the same bytes the
 * deployed app loads are already published to Depot's `tutor-scenes` bucket,
 * world-readable, so CI can fetch them instead of authoring them.
 *
 * Depot is CONTENT-ADDRESSED — the filename IS the sha256 of the body — so the
 * integrity check is free and non-negotiable here: a file whose digest does not
 * match the name it was served under is discarded, never written. That matters
 * more than usual, because the point of the download is to feed a gate that
 * decides whether characters stand correctly in front of children.
 *
 * Usage:
 *   node scripts/fetch-scenes.mjs                 # every asset in the manifest
 *   node scripts/fetch-scenes.mjs clips-biped.glb # just what a gate needs
 *
 * Present files are left alone; this never overwrites locally authored work.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'public', 'scenes');

const manifest = JSON.parse(
  await import('node:fs/promises').then((fs) =>
    fs.readFile(join(ROOT, 'src', 'tutor-scene', 'sceneManifest.generated.json'), 'utf8'),
  ),
);

/*
 * The same default the app uses when VITE_SCENE_ASSET_BASE is unset in a
 * deployed environment. Overridable so this is not pinned to one hostname.
 */
const BASE =
  process.env.SCENE_ASSET_BASE ?? `https://media-b2c.littlefounders.ai/files/${manifest.bucket}`;

const requested = process.argv.slice(2);
const wanted = requested.length > 0 ? requested : Object.keys(manifest.files);

const unknown = wanted.filter((name) => !manifest.files[name]);
if (unknown.length > 0) {
  console.error(`fetch-scenes: not in the manifest: ${unknown.join(', ')}`);
  console.error(`  manifest holds: ${Object.keys(manifest.files).join(', ')}`);
  process.exit(1);
}

let fetched = 0;
let kept = 0;

for (const logicalName of wanted) {
  const target = join(OUT_DIR, logicalName);

  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`  kept    ${logicalName} (already present)`);
    kept += 1;
    continue;
  }

  const served = manifest.files[logicalName];
  const url = `${BASE}/${served}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`fetch-scenes: ${logicalName} — ${response.status} ${response.statusText}`);
    console.error(`  ${url}`);
    process.exit(1);
  }

  const body = Buffer.from(await response.arrayBuffer());

  // The name is the digest. If they disagree, something between Depot and here
  // rewrote the body, and a rig gate run against it would be meaningless.
  const expected = served.replace(/\.[^.]+$/, '');
  const actual = createHash('sha256').update(body).digest('hex');
  if (actual !== expected) {
    console.error(`fetch-scenes: ${logicalName} FAILED its content hash — discarded.`);
    console.error(`  expected ${expected}`);
    console.error(`  received ${actual}`);
    process.exit(1);
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
  console.log(`  fetched ${logicalName} (${(body.length / 1024).toFixed(0)} KB, digest verified)`);
  fetched += 1;
}

console.log(`fetch-scenes OK — ${fetched} fetched, ${kept} already present`);
