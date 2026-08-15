#!/usr/bin/env node
/*
 * Copies the Basis Universal transcoder out of `three` and into `public/basis/`.
 *
 * WHY A COPY STEP: three's KTX2Loader loads its transcoder at RUNTIME from a
 * URL prefix (`setTranscoderPath`), not through an ESM import, so Vite never
 * sees it and never bundles it. The two files therefore have to exist as real
 * static assets under `public/`.
 *
 * WHY NOT COMMIT THEM: they are build outputs of a dependency we already pin.
 * Committing a .wasm blob means it silently drifts from the `three` version
 * that is actually installed — and a transcoder/loader version mismatch fails
 * as a corrupt-texture error, which is a miserable thing to debug. Copying on
 * every dev/build run makes drift structurally impossible.
 *
 * WHY NOT A CDN: an external origin at runtime is a hard no — it is a
 * third-party request on a page children use, and it breaks the moment the CDN
 * does.
 */
import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const FILES = ['basis_transcoder.js', 'basis_transcoder.wasm'];
const from = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const to = join(root, 'public', 'basis');

try {
  await access(from);
} catch {
  // `three` not installed yet (a bare checkout running lint, say). Skipping is
  // correct: the copy is a build input, and failing here would break scripts
  // that have nothing to do with 3D.
  console.log('copy-3d-decoders: three/examples/jsm/libs/basis not found — skipped');
  process.exit(0);
}

await mkdir(to, { recursive: true });
for (const file of FILES) {
  await copyFile(join(from, file), join(to, file));
}
console.log(`copy-3d-decoders: copied ${FILES.length} Basis transcoder files to public/basis/`);
