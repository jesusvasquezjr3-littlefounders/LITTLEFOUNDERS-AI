/*
 * verify-placement — where does the solver actually put the cast, on every
 * island, for every pairing? Headless, in seconds, with no browser.
 *
 * WHY THIS EXISTS. The placement solver was verified by looking at the product,
 * and looking is exactly what nobody does often enough: `diorama-b` put its
 * ENTIRE CAST inside the pond, and the only reason it was caught is that
 * somebody finally photographed the second island with people standing on it.
 * Numbers had been consulted and had said the opposite — that diorama-b was the
 * roomy one and therefore the answer to Dina's size. She fits, and she stands
 * in the water.
 *
 * So this runs the REAL `findStandingSpots` (imported, never reimplemented — a
 * copy would drift from the thing it certifies) against the REAL island meshes,
 * and reports what a character standing on each chosen spot would be standing
 * ON: the surface colour sampled from the island's own base texture at the hit
 * UV, the height, and whether the footprint stays inside the rim.
 *
 * The colour classifier here is for REPORTING ONLY and must never become the
 * placement rule: "blue means water" is true of these two dioramas and is not a
 * fact about the world. Placement decides from the walkability mask that the
 * asset pipeline bakes; this script's job is to tell a human whether that mask
 * is doing its job, in terms a human can check against a screenshot.
 *
 * Usage:  npm run verify:placement
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { findStandingSpots } from '../src/tutor-scene/standingSpots.js';
import type { CharacterId } from '../src/components/characters/control/types.js';

/*
 * MEASUREMENTS, not assets. `assets.ts` resolves URLs through
 * `import.meta.env`, which exists only under Vite, so importing it here would
 * make this script un-runnable outside a bundler for no reason: nothing below
 * needs a URL, only heights and footprints.
 */
import {
  CHARACTER_MEASUREMENTS,
  characterFootprintM,
  SCENE_MEASUREMENTS,
  sceneScale,
  type SceneMeasurement,
} from '../src/tutor-scene/measurements.js';
import { walkabilityFor } from '../src/tutor-scene/walkability.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, '..', 'public', 'scenes');

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

type Rgb = [number, number, number];

interface Surface {
  mesh: Mesh;
  /** Base-colour texel lookup by UV, or null when the island ships no texture. */
  sample: ((u: number, v: number) => Rgb) | null;
}

/**
 * Builds a three.js mesh of the island positioned EXACTLY as `Diorama.tsx`
 * positions it: scaled by `sceneScale`, centred on the origin in XZ, underside
 * resting on y=0.
 *
 * Every one of those three must match, and the first draft of this script got
 * the first one wrong — it scaled by the MEASURED span instead of the stored
 * `sourceWidthM`, which differ by 5% on diorama-b because the span includes the
 * palm fronds. A harness that does not reproduce the product does not certify
 * the product; it certifies a slightly different island and reports the good
 * news confidently.
 */
async function loadIsland(file: string, measurement: SceneMeasurement): Promise<Surface> {
  const doc: Document = await io.read(file);
  const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

  const position = prim.getAttribute('POSITION')!;
  const uv = prim.getAttribute('TEXCOORD_0');
  const indices = prim.getIndices();

  const positions = new Float32Array(position.getCount() * 3);
  const scratch = [0, 0, 0];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, scratch);
    positions[i * 3] = scratch[0]!;
    positions[i * 3 + 1] = scratch[1]!;
    positions[i * 3 + 2] = scratch[2]!;
    minX = Math.min(minX, scratch[0]!);
    maxX = Math.max(maxX, scratch[0]!);
    minZ = Math.min(minZ, scratch[2]!);
    maxZ = Math.max(maxZ, scratch[2]!);
  }
  const scale = sceneScale(measurement);
  for (let i = 0; i < positions.length; i += 1) positions[i]! *= scale;

  /*
   * The same recentring `Diorama.tsx` applies: both exports sit below y=0 and
   * neither is centred on the origin, so the component measures the bounds and
   * moves the island rather than asking for a re-export with a fixed pivot.
   */
  let sminX = Infinity, smaxX = -Infinity, sminY = Infinity, sminZ = Infinity, smaxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    sminX = Math.min(sminX, positions[i]!); smaxX = Math.max(smaxX, positions[i]!);
    sminY = Math.min(sminY, positions[i + 1]!);
    sminZ = Math.min(sminZ, positions[i + 2]!); smaxZ = Math.max(smaxZ, positions[i + 2]!);
  }
  const offsetX = -(sminX + smaxX) / 2;
  const offsetZ = -(sminZ + smaxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]! += offsetX;
    positions[i + 1]! -= sminY;
    positions[i + 2]! += offsetZ;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  if (uv) {
    const uvs = new Float32Array(uv.getCount() * 2);
    const t = [0, 0];
    for (let i = 0; i < uv.getCount(); i += 1) {
      uv.getElement(i, t);
      uvs[i * 2] = t[0]!;
      uvs[i * 2 + 1] = t[1]!;
    }
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  }
  if (indices) geometry.setIndex(Array.from(indices.getArray() as ArrayLike<number>));

  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);

  let sample: Surface['sample'] = null;
  const image = prim.getMaterial()?.getBaseColorTexture()?.getImage();
  if (image) {
    const { data, info } = await sharp(Buffer.from(image))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    sample = (u, v) => {
      const wrap = (x: number) => ((x % 1) + 1) % 1;
      const x = Math.min(info.width - 1, Math.floor(wrap(u) * info.width));
      const y = Math.min(info.height - 1, Math.floor(wrap(v) * info.height));
      const o = (y * info.width + x) * info.channels;
      return [data[o]!, data[o + 1]!, data[o + 2]!];
    };
  }

  return { mesh, sample };
}

/** Human-readable guess at what a texel is. Reporting only — see the header. */
function describe(rgb: Rgb | null): string {
  if (!rgb) return 'unknown';
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  /*
   * Teal, not blue: the pond texels measure rgb(16,150,155) — red-starved with
   * green and blue both high. A first pass asked for "blue dominant" and
   * labelled that water as sand/earth, which would have quietly reported the
   * pond spots as fine.
   */
  if (b > r + 40 && b > 90) return 'WATER?';
  if (g >= r - 10 && b < g - 40) return 'grass';
  if (max - min < 28) return 'rock/grey';
  return 'sand/earth';
}

const DOWN = new Vector3(0, -1, 0);

function surfaceAt(mesh: Mesh, x: number, z: number, from: number) {
  const raycaster = new Raycaster();
  raycaster.set(new Vector3(x, from, z), DOWN);
  return raycaster.intersectObject(mesh, true)[0] ?? null;
}

/** Every pairing the product can compose today. */
const PAIRINGS: Array<[CharacterId, CharacterId | null]> = [
  ['rho', 'liruf'],
  ['zara', 'liruf'],
  ['liruf', 'rho'],
  ['dina', 'liruf'],
  ['dina', null],
];

let failures = 0;

for (const [id, asset] of Object.entries(SCENE_MEASUREMENTS)) {
  const island = await loadIsland(resolve(SCENES, `${id}.glb`), asset);
  const box = new Box3().setFromObject(island.mesh);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const radius = Math.max(size.x, size.z) / 2;
  const from = box.max.y + 1;

  console.log(`\n=== ${id} — ${asset.targetWidthM} m across (radius ${radius.toFixed(2)} m) ===`);

  for (const [lead, companion] of PAIRINGS) {
    const leadFoot = characterFootprintM(CHARACTER_MEASUREMENTS[lead]);
    const secondFoot = companion ? characterFootprintM(CHARACTER_MEASUREMENTS[companion]) : 0;
    const minSeparation = Math.max(1.3, (leadFoot + secondFoot) / 2 + 0.35);

    const spots = findStandingSpots(island.mesh, {
      count: companion ? 2 : 1,
      minSeparation,
      preferDirection: new Vector3(0.35, 0, 1),
      // The SAME wiring the product uses. A gate that exercises a different
      // configuration certifies a different product.
      isWalkable: walkabilityFor(id) ?? undefined,
      clearance: Math.max(
        characterFootprintM(CHARACTER_MEASUREMENTS[lead]) / 2,
        companion ? characterFootprintM(CHARACTER_MEASUREMENTS[companion]) / 2 : 0,
      ),
    });

    const cast: CharacterId[] = companion ? [lead, companion] : [lead];
    const apart =
      spots.length > 1 ? Math.hypot(spots[0]!.x - spots[1]!.x, spots[0]!.z - spots[1]!.z) : 0;
    console.log(
      `  ${lead} + ${companion ?? '—'}  (min separation ${minSeparation.toFixed(2)} m` +
        `${apart ? `, actually ${apart.toFixed(2)} m apart` : ''})`,
    );

    for (let i = 0; i < cast.length; i += 1) {
      const who = cast[i]!;
      const spot = spots[i];
      if (!spot) {
        console.log(`      ✗ ${who.padEnd(6)} NO SPOT FOUND`);
        failures += 1;
        continue;
      }

      const hit = surfaceAt(island.mesh, spot.x, spot.z, from);
      const rgb = hit?.uv && island.sample ? island.sample(hit.uv.x, hit.uv.y) : null;
      const surface = describe(rgb);

      /*
       * Local relief: how the surface behaves at the character's OWN scale
       * rather than at the 0.35 m probe the solver uses. A spot on a pedestal
       * reads as perfectly flat close in and drops away further out, which is
       * precisely what the solver cannot currently see.
       */
      const reliefRadius = Math.max(1.0, characterFootprintM(CHARACTER_MEASUREMENTS[who]) / 2);
      let below = 0;
      let drop = 0;
      for (let a = 0; a < 8; a += 1) {
        const angle = (a / 8) * Math.PI * 2;
        const probe = surfaceAt(
          island.mesh,
          spot.x + Math.cos(angle) * reliefRadius,
          spot.z + Math.sin(angle) * reliefRadius,
          from,
        );
        if (!probe) continue;
        const delta = probe.point.y - spot.y;
        if (delta < -0.2) { below += 1; drop = Math.min(drop, delta); }
      }

      const half = characterFootprintM(CHARACTER_MEASUREMENTS[who]) / 2;
      const fromCentre = Math.hypot(spot.x - centre.x, spot.z - centre.z);
      const overhang = fromCentre + half - radius;
      const bad = surface === 'WATER?' || overhang > 0;
      if (bad) failures += 1;

      console.log(
        `      ${bad ? '✗' : '✓'} ${who.padEnd(6)} ` +
          `y=${spot.y.toFixed(2).padStart(6)}  score=${spot.score.toFixed(3)}  ` +
          `${fromCentre.toFixed(2)} m out  ` +
          `${overhang > 0 ? `OVERHANGS ${overhang.toFixed(2)} m` : `${(-overhang).toFixed(2)} m clear`}  ` +
          `${below >= 5 ? `PEDESTAL(${below}/8 down to ${drop.toFixed(2)}m)  ` : ''}` +
          `on ${surface}${rgb ? ` rgb(${rgb.join(',')})` : ''}`,
      );
    }
  }
}

console.log(
  failures === 0
    ? '\nverify-placement OK — every character stands on walkable ground, inside the rim'
    : `\nverify-placement FAILED — ${failures} placement(s) are wrong`,
);
process.exit(failures === 0 ? 0 : 1);
