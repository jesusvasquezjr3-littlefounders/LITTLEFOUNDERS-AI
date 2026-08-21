/*
 * Loads a diorama exactly as the product places it, with no browser.
 *
 * Shared by `generate-walkmask.ts` (which bakes the mask) and
 * `verify-placement.ts` (which checks the mask is doing its job). They MUST
 * agree about scale and origin down to the centimetre or the mask lands offset
 * from the ground it describes — so there is one loader, not two.
 *
 * The positioning mirrors `Diorama.tsx`: scale by `sceneScale`, centre on the
 * origin in XZ, rest the underside on y=0. An earlier draft scaled by the
 * MEASURED span instead of the stored `sourceWidthM`; those differ by 5% on
 * diorama-b because the span includes the palm fronds, and the result was a
 * harness that confidently certified a slightly different island.
 */
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  type Intersection,
} from 'three';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { sceneScale, type SceneMeasurement } from '../../src/tutor-scene/measurements.js';

export type Rgb = [number, number, number];

export interface Island {
  mesh: Mesh;
  /** Base-colour texel by UV, or null when the island ships no texture. */
  sample: ((u: number, v: number) => Rgb) | null;
  /** Axis-aligned bounds after scaling and recentring, in metres. */
  bounds: Box3;
  /** Half the widest horizontal extent, in metres. */
  radius: number;
  /** Y to fire downward probes from, safely above everything. */
  probeFrom: number;
}

let io: NodeIO | null = null;

async function reader(): Promise<NodeIO> {
  if (io) return io;
  await MeshoptDecoder.ready;
  io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io;
}

export async function loadIsland(file: string, measurement: SceneMeasurement): Promise<Island> {
  const doc: Document = await (await reader()).read(file);
  const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

  const position = prim.getAttribute('POSITION')!;
  const uv = prim.getAttribute('TEXCOORD_0');
  const indices = prim.getIndices();

  const scale = sceneScale(measurement);
  const positions = new Float32Array(position.getCount() * 3);
  const scratch = [0, 0, 0];
  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, scratch);
    positions[i * 3] = scratch[0]! * scale;
    positions[i * 3 + 1] = scratch[1]! * scale;
    positions[i * 3 + 2] = scratch[2]! * scale;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]!);
    maxX = Math.max(maxX, positions[i]!);
    minY = Math.min(minY, positions[i + 1]!);
    minZ = Math.min(minZ, positions[i + 2]!);
    maxZ = Math.max(maxZ, positions[i + 2]!);
  }
  const offsetX = -(minX + maxX) / 2;
  const offsetZ = -(minZ + maxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]! += offsetX;
    positions[i + 1]! -= minY;
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

  let sample: Island['sample'] = null;
  const image = prim.getMaterial()?.getBaseColorTexture()?.getImage();
  if (image) {
    const { data, info } = await sharp(Buffer.from(image))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    sample = (u, v) => {
      // Authored UVs routinely leave 0..1, so both axes wrap.
      const wrap = (x: number) => ((x % 1) + 1) % 1;
      const x = Math.min(info.width - 1, Math.floor(wrap(u) * info.width));
      const y = Math.min(info.height - 1, Math.floor(wrap(v) * info.height));
      const o = (y * info.width + x) * info.channels;
      return [data[o]!, data[o + 1]!, data[o + 2]!];
    };
  }

  const bounds = new Box3().setFromObject(mesh);
  const size = bounds.getSize(new Vector3());

  return {
    mesh,
    sample,
    bounds,
    radius: Math.max(size.x, size.z) / 2,
    probeFrom: bounds.max.y + 1,
  };
}

const DOWN = new Vector3(0, -1, 0);
const raycaster = new Raycaster();

/** First surface under (x, z), fired from above everything. */
export function surfaceAt(island: Island, x: number, z: number): Intersection | null {
  raycaster.set(new Vector3(x, island.probeFrom, z), DOWN);
  return raycaster.intersectObject(island.mesh, true)[0] ?? null;
}
