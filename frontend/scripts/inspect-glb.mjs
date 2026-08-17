#!/usr/bin/env node
/*
 * inspect-glb — reads a .glb and reports everything the Tutor pipeline needs to
 * decide what to do with it: real-world size, complexity, texture inventory,
 * rig presence and animation clips.
 *
 * Read-only by design. `optimize-glb.mjs` changes assets; this one only ever
 * looks, so it is safe to point at an artist's working files.
 *
 * Usage: npm run assets:inspect -- <file.glb> [more.glb ...]
 */
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: npm run assets:inspect -- <file.glb> [more.glb ...]');
  process.exit(2);
}

// The decoder is required to READ an already-optimized asset: meshopt-encoded
// buffers are opaque without it, and gltf-transform refuses rather than
// silently reporting an empty document.
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
});
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

/**
 * World-space bounds, computed by walking the scene graph and transforming each
 * primitive's POSITION accessor min/max by its node's world matrix.
 *
 * The accessor min/max alone are LOCAL and would report a wrong height for any
 * model whose root node carries a scale — which is most exports, since DCC unit
 * conversion usually lands there rather than being baked into the vertices.
 */
function worldBounds(document) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (node, parent) => {
    const world = mulMat4(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      /*
       * glTF spec: "the transform of the skinned mesh node MUST be ignored".
       * A skinned mesh is rendered in the SKELETON's space, driven by joint
       * matrices and inverse bind matrices — which cancel to identity in the
       * bind pose, so the raw POSITION min/max already ARE the bind-pose world
       * bounds. Applying the node matrix on top (this function's first version
       * did) reported every character as ~0.01 m tall, because the exporter
       * had parked unit conversion on exactly that node.
       */
      const matrix = node.getSkin() ? IDENTITY : world;
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (!position) continue;
        const lo = position.getMin([]);
        const hi = position.getMax([]);
        // All 8 corners: a rotated box's extremes are not the transformed min/max.
        for (let corner = 0; corner < 8; corner++) {
          const point = [corner & 1 ? hi[0] : lo[0], corner & 2 ? hi[1] : lo[1], corner & 4 ? hi[2] : lo[2]];
          const w = applyMat4(matrix, point);
          for (let axis = 0; axis < 3; axis++) {
            if (w[axis] < min[axis]) min[axis] = w[axis];
            if (w[axis] > max[axis]) max[axis] = w[axis];
          }
        }
      }
    }
    for (const child of node.listChildren()) visit(child, world);
  };

  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) visit(node, IDENTITY);
  }
  return Number.isFinite(min[0]) ? { min, max } : null;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4x4 multiply, matching glTF's matrix layout. */
function mulMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function applyMat4(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

for (const file of files) {
  const path = resolve(file);
  const bytes = (await stat(path)).size;
  const document = await io.read(path);
  const root = document.getRoot();

  let triangles = 0;
  let primitives = 0;
  let skinned = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives += 1;
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      triangles += Math.floor((indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3);
      if (primitive.getAttribute('JOINTS_0')) skinned += 1;
    }
  }

  const textures = root.listTextures().map((texture) => {
    const size = texture.getSize();
    return { size: size ? `${size[0]}x${size[1]}` : '?', mime: texture.getMimeType(), bytes: texture.getImage()?.byteLength ?? 0 };
  });
  const textureBytes = textures.reduce((sum, texture) => sum + texture.bytes, 0);

  const bounds = worldBounds(document);
  const animations = root.listAnimations().map((animation) => {
    // Clip length is the largest sampler input time across its channels.
    let duration = 0;
    for (const sampler of animation.listSamplers()) {
      const input = sampler.getInput();
      if (input) duration = Math.max(duration, input.getMax([])[0] ?? 0);
    }
    return `${animation.getName() || '(unnamed)'} ${duration.toFixed(2)}s`;
  });

  console.log(`\n${'='.repeat(64)}\n${basename(path)}  —  ${mb(bytes)}\n${'='.repeat(64)}`);
  console.log(`  triangles      ${fmt(triangles)}`);
  console.log(`  primitives     ${primitives}  (≈ draw calls)`);
  console.log(`  materials      ${root.listMaterials().length}`);
  console.log(`  meshes/nodes   ${root.listMeshes().length} / ${root.listNodes().length}`);
  console.log(`  skins          ${root.listSkins().length}  (skinned primitives: ${skinned})`);
  console.log(`  animations     ${animations.length ? animations.join(', ') : 'none'}`);
  console.log(`  textures       ${textures.length}  —  ${mb(textureBytes)} (${((textureBytes / bytes) * 100).toFixed(0)}% of file)`);
  for (const texture of textures) console.log(`    · ${texture.size.padEnd(11)} ${texture.mime}  ${mb(texture.bytes)}`);
  /*
   * KHR_mesh_quantization stores positions as normalized integers and moves the
   * dequantization scale into the node transform, so the accessor min/max are
   * in quantized units and the bind-pose shortcut above does not apply. Rather
   * than print a confidently wrong height (it reads ~65,000), the measurement
   * is withheld — real-world size is read from the SOURCE export, which is
   * where the pipeline needs it anyway (/AGENTS.md §1.14).
   */
  const quantized = root.listExtensionsUsed().some((e) => e.extensionName === 'KHR_mesh_quantization');
  if (quantized) {
    console.log('  world size     n/a — mesh is quantized; measure the source export instead');
  } else if (bounds) {
    const size = [0, 1, 2].map((axis) => bounds.max[axis] - bounds.min[axis]);
    console.log(`  world size     X ${size[0].toFixed(3)}  Y ${size[1].toFixed(3)}  Z ${size[2].toFixed(3)}  (glTF units = metres)`);
    console.log(`  ground offset  minY ${bounds.min[1].toFixed(3)}  ${Math.abs(bounds.min[1]) < 0.01 ? '✓ feet at origin' : '⚠ not resting on y=0'}`);
  }
  console.log(`  extensions     ${root.listExtensionsUsed().map((e) => e.extensionName).join(', ') || 'none'}`);
}
console.log('');
