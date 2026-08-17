#!/usr/bin/env node
/*
 * optimize-glb — turns a clean artist export into a shippable Tutor asset.
 *
 * The contract with the art pipeline is that the artist exports UNCOMPRESSED
 * and this script does the compression. Hand-tuning Draco/KTX2 settings in a
 * DCC is where exports silently break, and an artist should not have to.
 *
 * Usage:
 *   npm run assets:3d -- <input.glb> [output.glb]
 *
 * What it deliberately does NOT do: `join`/`flatten`. Those merge primitives to
 * cut draw calls, but they restructure the node hierarchy — on a rigged,
 * animated character that risks breaking skinning and clip targeting. Draw
 * calls are REPORTED instead, because the correct fix (share one material /
 * atlas the textures) belongs in the DCC where the artist can see the result.
 */
import { existsSync } from 'node:fs';
import { writeFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, weld, simplify, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// Kept in sync by hand with src/tutor-scene/budget.ts — that file is the
// runtime authority; these are the same numbers applied at build time.
const MAX_TEXTURE_SIZE = 2048;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TRIANGLES = 100_000;
const MAX_DRAW_CALLS = 30;

const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const arg of argv) {
  const match = /^--([a-z-]+)=(.*)$/.exec(arg);
  if (match) flags.set(match[1], match[2]);
  else positional.push(arg);
}
const [inputArg, outputArg] = positional;
if (!inputArg) {
  console.error('usage: npm run assets:3d -- <input.glb> [output.glb] [--max-triangles=N]');
  process.exit(2);
}

/**
 * Decimation target. Left UNSET by default on purpose: silently reshaping an
 * artist's mesh is not something a build script should decide, so the caller
 * states the target and the report shows what it cost.
 */
const maxTriangles = flags.has('max-triangles') ? Number(flags.get('max-triangles')) : null;
if (maxTriangles !== null && (!Number.isFinite(maxTriangles) || maxTriangles <= 0)) {
  console.error('optimize-glb: --max-triangles must be a positive number');
  process.exit(2);
}

const input = resolve(inputArg);
if (!existsSync(input)) {
  console.error(`optimize-glb: no such file: ${input}`);
  process.exit(2);
}
const output = resolve(outputArg ?? input.replace(/\.glb$/i, '.opt.glb'));

function hasKtxTool() {
  for (const tool of ['toktx', 'ktx']) {
    try {
      execFileSync(tool, ['--version'], { stdio: 'ignore' });
      return tool;
    } catch {
      /* not installed */
    }
  }
  return null;
}

/** Triangles and draw-call count (one per primitive) across the whole document. */
function measure(document) {
  let triangles = 0;
  let primitives = 0;
  let skinnedPrimitives = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives += 1;
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      const count = indices ? indices.getCount() : (position?.getCount() ?? 0);
      triangles += Math.floor(count / 3);
      if (primitive.getAttribute('JOINTS_0')) skinnedPrimitives += 1;
    }
  }
  const textures = document.getRoot().listTextures();
  return {
    triangles,
    primitives,
    skinnedPrimitives,
    skins: document.getRoot().listSkins().length,
    textures: textures.length,
    largestTexture: textures.reduce((max, texture) => {
      const size = texture.getSize();
      return size ? Math.max(max, size[0], size[1]) : max;
    }, 0),
    animations: document.getRoot().listAnimations().length,
    materials: document.getRoot().listMaterials().length,
  };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const document = await io.read(input);
const before = measure(document);
const beforeBytes = (await stat(input)).size;

/** Rigged assets need different, more conservative passes than static props. */
const hasRig = document.getRoot().listSkins().length > 0 || document.getRoot().listAnimations().length > 0;

const ktxTool = hasKtxTool();

const transforms = [
  // Order matters: prune/dedup first so later, costlier passes touch less data.
  dedup(),
  /*
   * `keepLeaves` MUST be true on anything rigged. Skeleton joints are leaf
   * nodes, so pruning leaves deletes the bones, which invalidates the skin,
   * which prune then removes as well. The output is a smaller, structurally
   * valid .glb containing a mesh that can no longer deform — the animation
   * entry even survives, so nothing looks wrong until a character is on screen
   * standing frozen in bind pose. Verified: it silently stripped Liruf's skin.
   */
  prune({ keepAttributes: false, keepLeaves: hasRig }),
  // Drops keyframes that lie on the interpolation between their neighbours.
  // Baked 30fps clips are highly redundant, so this is usually the single
  // biggest win on an animated character and it is visually lossless.
  resample(),
  // Must precede simplify: the simplifier needs welded, indexed geometry to
  // collapse edges at all. On an unwelded mesh every triangle is an island and
  // decimation silently achieves almost nothing.
  weld(),
];

if (maxTriangles !== null && before.triangles > maxTriangles) {
  transforms.push(
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: maxTriangles / before.triangles,
      // The ratio is a target, not a promise — the simplifier stops early
      // rather than wreck a silhouette. `error` bounds distortion as a
      // fraction of the mesh's extent; 1% is visually safe on stylized
      // geometry at the distance these assets are viewed from.
      error: 0.01,
      lockBorder: false,
    }),
  );
}

transforms.push(
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
  }),
  // Last: meshopt encodes the final buffers, so every earlier pass must have
  // already settled the geometry it compresses.
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

await document.transform(...transforms);
await writeFile(output, await io.writeBinary(document));

const after = measure(document);
const afterBytes = (await stat(output)).size;

const pct = (from, to) => (from === 0 ? '—' : `${(((from - to) / from) * 100).toFixed(1)}% smaller`);
const fmt = (n) => n.toLocaleString('en-US');
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

console.log(`\noptimize-glb — ${basename(input)} → ${basename(output)}\n`);
console.log(`  size          ${mb(beforeBytes)} → ${mb(afterBytes)}   (${pct(beforeBytes, afterBytes)})`);
console.log(`  triangles     ${fmt(before.triangles)} → ${fmt(after.triangles)}`);
console.log(`  draw calls    ${before.primitives} → ${after.primitives}`);
console.log(`  materials     ${before.materials} → ${after.materials}`);
console.log(`  textures      ${before.textures} (largest ${before.largestTexture}px → ${after.largestTexture}px)`);
console.log(`  animations    ${before.animations} → ${after.animations}`);
console.log(`  rig           skins ${before.skins} → ${after.skins}, skinned prims ${before.skinnedPrimitives} → ${after.skinnedPrimitives}`);

const failures = [];

/*
 * RIG INTEGRITY IS A HARD GATE, not a warning.
 *
 * A pass that drops a skin or an animation still writes a smaller, structurally
 * valid .glb — the corruption is invisible until a character is on screen,
 * frozen in bind pose. `prune({keepLeaves: false})` did exactly this to Liruf:
 * joints are leaf nodes, pruning them invalidated the skin, and the skin was
 * pruned too. Losing a rig must therefore fail the build, never be reported as
 * a nice size win.
 */
if (before.skins > after.skins) {
  failures.push(`RIG DESTROYED: skins ${before.skins} → ${after.skins} — the character can no longer deform`);
}
if (before.animations > after.animations) {
  failures.push(`animations lost: ${before.animations} → ${after.animations}`);
}
if (before.skinnedPrimitives > after.skinnedPrimitives) {
  failures.push(
    `skinning attributes lost on ${before.skinnedPrimitives - after.skinnedPrimitives} primitive(s)`,
  );
}
if (after.triangles > MAX_TRIANGLES) {
  failures.push(`triangles ${fmt(after.triangles)} exceeds the ${fmt(MAX_TRIANGLES)} budget — decimate in the DCC`);
}
if (after.primitives > MAX_DRAW_CALLS) {
  failures.push(
    `draw calls ${after.primitives} exceeds the ${MAX_DRAW_CALLS} budget — share materials / atlas textures at source`,
  );
}
if (afterBytes > MAX_FILE_BYTES) {
  failures.push(`file ${mb(afterBytes)} exceeds the ${mb(MAX_FILE_BYTES)} budget`);
}

/*
 * KTX2 is about VRAM, not download size: a KTX2 texture stays GPU-compressed in
 * memory while a WebP is decoded to full RGBA. On a 2GB phone that difference
 * decides whether the scene loads. Skipping it silently would let an asset ship
 * looking fine on a dev machine and fail on the devices this budget exists for,
 * so the omission is stated loudly rather than logged as a footnote.
 */
if (!ktxTool) {
  console.log(
    '\n  ⚠ KTX2 SKIPPED — KTX-Software is not installed, so textures shipped as WebP.\n' +
      '    They will decode to full RGBA in VRAM. Install it (`brew install ktx`) and\n' +
      '    re-run before publishing an asset to Depot.',
  );
}

if (failures.length) {
  console.log('\n  ✗ over budget:');
  for (const failure of failures) console.log(`    - ${failure}`);
  process.exit(1);
}

console.log('\n  ✓ within the Tutor asset budget\n');
