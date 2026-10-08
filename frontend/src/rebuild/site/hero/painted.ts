import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * One draw call per prop. A prop is drawn from several simple solids (a rocket
 * is a body, a nose, three fins, a window); painting each solid a vertex colour
 * and merging them gives one mesh and one shared material instead of one draw
 * call per solid. The repo's scene budget counts draw calls, not triangles,
 * because on a phone state changes are what stall the GPU.
 */

export type PaintedPart = readonly [geometry: BufferGeometry, color: string];

export function painted(parts: readonly PaintedPart[]): BufferGeometry {
  const merged = mergeGeometries(parts.map(([geometry, hex]) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    flat.deleteAttribute('uv');
    const count = flat.getAttribute('position').count;
    const color = new Color(hex);
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) data.set([color.r, color.g, color.b], i * 3);
    flat.setAttribute('color', new Float32BufferAttribute(data, 3));
    return flat;
  }));
  if (!merged) throw new Error('hero props: parts have mismatched attributes');
  return merged;
}

/** Shared by every painted prop, so the GPU switches material once, not once per prop. */
export const paintedMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
