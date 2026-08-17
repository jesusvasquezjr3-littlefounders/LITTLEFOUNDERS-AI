import {
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Vector3,
  type Object3D,
  type Texture,
} from 'three';
import type { CharacterId } from '@/components/characters/control/types';
import { SCENE_ASSET_BASE, sceneAssetUrl } from './assets';
import generated from './mouthCards.generated.json';

/*
 * The Tutor cast's mouths.
 *
 * WHY THIS EXISTS AT ALL: not one jaw, mouth, brow or eye bone exists on any of
 * the four exports (/TUTOR_3D.md §3), and the mouths are PAINTED INTO THE
 * TEXTURE rather than modelled. There is no geometry to deform, so blendshapes
 * would stretch a decal rather than open a mouth, and the handoff's preferred
 * route — sliding the mouth region's UV offset — is not implementable either:
 * these exports carry a per-facet shattered UV atlas. Two probe points 4 cm
 * apart on Zara's face resolve to (0.096, 0.153) and (0.447, 0.300); there is
 * no contiguous mouth island to slide, and at this triangle density the lips
 * share a triangle with the cheek.
 *
 * So the mouth is a small CARD laid over the painted one, parented to the head
 * joint, with a viseme atlas swapped by texture offset.
 */

/** Frame order in the atlas. Must match `scripts/generate-mouth-atlas.mjs`. */
export const VISEMES = ['closed', 'A', 'E', 'I', 'O', 'U', 'MBP', 'FV'] as const;
export type Viseme = (typeof VISEMES)[number];

export const ATLAS_COLUMNS = 2;
export const ATLAS_ROWS = 4;

/**
 * Texture offset for a viseme, for a texture whose repeat is
 * (1/ATLAS_COLUMNS, 1/ATLAS_ROWS).
 *
 * Atlas row 0 is the TOP of the image while V runs upward, so the row index is
 * flipped. Getting this backwards is silent: every frame still lands on A cell,
 * just the wrong one, and the mouth animates through the right shapes in the
 * wrong order.
 */
export function visemeOffset(index: number): [number, number] {
  const wrapped = ((index % VISEMES.length) + VISEMES.length) % VISEMES.length;
  const column = wrapped % ATLAS_COLUMNS;
  const row = Math.floor(wrapped / ATLAS_COLUMNS);
  return [column / ATLAS_COLUMNS, 1 - (row + 1) / ATLAS_ROWS];
}

export function applyViseme(texture: Texture, index: number): void {
  const [x, y] = visemeOffset(index);
  texture.offset.set(x, y);
}

export interface MouthCardData {
  cols: number;
  rows: number;
  /** Grid positions in the model's own space, row-major from the bottom-left. */
  positions: readonly (readonly number[])[];
}

const CARDS = generated.characters as Partial<Record<CharacterId, { positions: number[][] }>>;

export function mouthCardFor(id: CharacterId): MouthCardData | null {
  const entry = CARDS[id];
  if (!entry) return null;
  return { cols: generated.cols, rows: generated.rows, positions: entry.positions };
}

/** Atlas image for a character, alongside the .glb it belongs to. */
export function mouthAtlasUrl(base: string, id: CharacterId): string {
  // `base` is kept in the signature so the lab and the tests can point this
  // somewhere else, but the resolution goes through the manifest: Depot serves
  // by content hash, not by name (see assets.ts).
  return base === SCENE_ASSET_BASE ? sceneAssetUrl(`mouth/${id}.png`) : `${base}/mouth/${id}.png`;
}

/*
 * The card's geometry is BAKED, not fitted at runtime. Every vertex is a
 * raycast onto the character's own face, so the card hugs a surface that bulges
 * ~1.6 cm forward across the mouth's 8.6 cm width — a flat quad tangent at the
 * centre would stand that far off the cheek at its corners, invisible head-on
 * and obvious the moment the camera orbits. Doing those raycasts in the browser
 * would mean 77 rays against a 50k-triangle skinned mesh on every load, on the
 * phones the performance budget exists for, to recompute a constant.
 */
export function buildMouthGeometry(card: MouthCardData): BufferGeometry {
  const { cols, rows, positions } = card;
  if (positions.length !== cols * rows) {
    throw new Error(`mouthCard: expected ${cols * rows} positions, got ${positions.length}`);
  }

  const vertices = new Float32Array(positions.length * 3);
  const uvs = new Float32Array(positions.length * 2);
  for (let index = 0; index < positions.length; index += 1) {
    const point = positions[index];
    // Length is checked above, but each POINT still has to be a real triple:
    // a short row would otherwise land NaN in the buffer, and a NaN position
    // silently removes the whole card from the render with no error anywhere.
    if (!point || point.length < 3) {
      throw new Error(`mouthCard: position ${index} is not an [x, y, z] triple`);
    }
    vertices[index * 3] = point[0]!;
    vertices[index * 3 + 1] = point[1]!;
    vertices[index * 3 + 2] = point[2]!;
    // UVs span one whole cell (0..1); which cell is chosen by the texture's
    // offset, so switching viseme never touches geometry.
    uvs[index * 2] = (index % cols) / (cols - 1);
    uvs[index * 2 + 1] = Math.floor(index / cols) / (rows - 1);
  }

  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < cols - 1; column += 1) {
      const a = row * cols + column;
      indices.push(a, a + 1, a + cols + 1);
      indices.push(a, a + cols + 1, a + cols);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Rewrites the card's positions from the model's own metre space into the head
 * joint's space, so the card can simply be parented to that joint and follow
 * the head for free.
 *
 * WHY WORLD MATRICES AND NOT THE BIND MATRICES: the obvious route is the
 * skeleton's inverse bind matrix, and it does not survive contact with these
 * exports. Their armature carries a 0.01 scale (the same one that makes bone
 * tails 27 units long), `bindMatrix` comes back as identity, and the head
 * joint's inverse bind matrix translates by -46.698 on Y for a joint that
 * stands 1.14 m above the character's feet — the units simply do not agree
 * with the geometry's. Feeding metres through that chain put the card 1.8 m
 * from the head; "correcting" it with the mesh's inverse world matrix put it
 * 106 m up.
 *
 * The world-matrix route needs no such agreement, and it is exact for one
 * specific reason: THE FACE DOES NOT DEFORM. There is no facial rig, so the
 * mouth is rigidly fixed to the head joint. A local offset measured while the
 * character is in ANY pose therefore stays correct in every other pose — which
 * is what makes reading the live matrices legitimate here rather than a
 * shortcut.
 */
export function toHeadLocal(geometry: BufferGeometry, head: Object3D, root: Object3D): void {
  root.updateWorldMatrix(true, true);
  head.updateWorldMatrix(true, false);

  const toBone = new Matrix4().copy(head.matrixWorld).invert().multiply(root.matrixWorld);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const point = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(toBone);
    position.setXYZ(index, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  /*
   * Make the normals agree with the side we can actually see.
   *
   * `computeVertexNormals` derives normals from triangle WINDING, and the
   * transform above can carry a negative determinant (these armatures are
   * mirrored on one axis). When it does, the faces we look at are still the
   * front faces, but their shading normals point back into the skull — so the
   * card is lit by nothing and renders SOLID BLACK over the mouth. It looks
   * exactly like a texture that failed to load, which is where the hunt for
   * this started; an unlit material "fixed" it only by not consulting normals
   * at all.
   *
   * The card is a decal on the outside of a head, so its normals must point
   * away from the joint it hangs off. That is checkable rather than assumed.
   */
  const centre = new Vector3();
  const meanNormal = new Vector3();
  const normal = geometry.getAttribute('normal') as BufferAttribute;
  const scratch = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    centre.add(scratch.fromBufferAttribute(position, index));
    meanNormal.add(scratch.fromBufferAttribute(normal, index));
  }
  centre.divideScalar(position.count);
  if (meanNormal.lengthSq() > 0 && centre.dot(meanNormal) < 0) {
    for (let index = 0; index < normal.count; index += 1) {
      normal.setXYZ(index, -normal.getX(index), -normal.getY(index), -normal.getZ(index));
    }
    normal.needsUpdate = true;
    // Winding must follow the normals, or back-face culling hides the side we
    // just decided is the front.
    const indices = geometry.getIndex();
    if (indices) {
      for (let i = 0; i < indices.count; i += 3) {
        const b = indices.getX(i + 1);
        indices.setX(i + 1, indices.getX(i + 2));
        indices.setX(i + 2, b);
      }
      indices.needsUpdate = true;
    }
  }

  geometry.computeBoundingSphere();
}
