import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from 'three';

/*
 * HOW BIG IS THIS MODEL — asked in the model's OWN space, never in the world's.
 *
 * `Box3.setFromObject` is a WORLD-space measurement: it walks the graph and
 * transforms every geometry by its `matrixWorld`, which folds in the transform
 * of whatever the object is attached to at that instant. That is the right
 * answer for "how much room does the island occupy on stage" and the wrong one
 * for "how tall is this character's export", and the two questions look
 * identical at the call site.
 *
 * IT SHIPPED AS A SHIP-BLOCKER, and the reason it took a scene dump to see is
 * that it is only wrong on the SECOND mount. `useSceneModel` hands out the
 * loader's cached `gltf.scene` BY REFERENCE — deliberately, cloning would double
 * VRAM — so one Object3D is the model. The first time `Character3D` measures it
 * the object is unparented, world space and model space coincide, and the
 * numbers are the export's own. On a REMOUNT the object is still attached to the
 * outgoing instance's group during the incoming instance's render pass, so the
 * same call returns the box already scaled into scene metres, and the caller
 * multiplies by the character scale a second time.
 *
 * Measured on `diorama-a`, inviting Dina as the companion (which moves her
 * across the boundary split in `TutorScene`'s `Cast` and so remounts her):
 * her contact shadow went from 3.25 m across to 221.53 m — a black plane that
 * covered the whole canvas and read as "the sky turned grey" — and her feet
 * went from y=0.14 to y=-12.24, twelve metres under the island. The other three
 * characters export at scale 1.0, so the same defect only sank them by the
 * island's surface height (Liruf: 0.17 m to 0.00 m) and nobody ever saw it.
 *
 * So the measurement is done here instead, by composing LOCAL matrices down
 * from the model root. It reads nothing above `model` — there is no parent
 * matrix to read and no inverse to cancel one out — so it is parent-independent
 * by construction rather than by being called at the right moment.
 */

/**
 * The model's bounding box in the space its own transform maps into — the box
 * `Box3.setFromObject` returns when, and only when, the model has no parent.
 *
 * Returns an empty box for a model with no geometry, exactly as `setFromObject`
 * does; the caller decides whether that is a failure.
 */
export function modelBounds(model: Object3D, target: Box3 = new Box3()): Box3 {
  target.makeEmpty();

  const bounds = new Box3();
  const visit = (node: Object3D, parentMatrix: Matrix4) => {
    if (node.matrixAutoUpdate) node.updateMatrix();
    const matrix = new Matrix4().multiplyMatrices(parentMatrix, node.matrix);

    const source = boxSourceFor(node);
    if (source) target.union(bounds.copy(source).applyMatrix4(matrix));

    for (const child of node.children) visit(child, matrix);
  };

  visit(model, new Matrix4());
  return target;
}

/**
 * WHICH box describes this node — three's own rule, not a simplification of it.
 *
 * `Box3.expandByObject` prefers an OBJECT-level box when the class defines one
 * and falls back to the geometry's. That distinction is the whole cast: every
 * character is a `SkinnedMesh`, whose vertices live in the skeleton's bind space
 * and mean nothing until the bones have moved them, so its geometry box measures
 * something that is never drawn. Reading the geometry box for all four made
 * Dina's contact shadow 1.06 m across and the three bipeds' 1–2 cm.
 *
 * The object-level box is computed once and cached by three, exactly as it is
 * here: the first measurement of a character happens while the model is still
 * unparented (`Character3D` measures during render, before `<primitive>` attaches
 * it), so what gets cached is the pose in the model's own space. Everything
 * ABOVE the mesh — the node transforms this walk composes — is what a remount
 * used to corrupt, and that half is recomputed from local matrices every time.
 */
function boxSourceFor(node: Object3D): Box3 | null {
  const mesh = node as Mesh;
  const geometry = mesh.geometry;
  if (!geometry) return null;

  /*
   * Structural rather than `instanceof SkinnedMesh`, because the same rule
   * covers `InstancedMesh` and `BatchedMesh` and because it is the shape
   * `Box3.expandByObject` itself tests. `Object3D` declares neither member, so
   * the narrowing is written out rather than asserted away with `any`.
   */
  const posed = node as Object3D & { boundingBox?: Box3 | null; computeBoundingBox?: () => void };

  // `undefined` means the class has no object-level box (a plain Mesh); `null`
  // means it has one and it has not been computed yet (a SkinnedMesh, an
  // InstancedMesh). Only the second is worth computing.
  if (posed.boundingBox !== undefined) {
    if (posed.boundingBox === null) posed.computeBoundingBox?.();
    return posed.boundingBox ?? null;
  }

  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  return geometry.boundingBox;
}

/** Where a scaled model's feet go, and how much ground it covers. */
export interface ModelFooting {
  /**
   * How far to lift the model above the surface so its lowest vertex rests on
   * it, in scene metres. The exports mostly sit on y=0, but "mostly" is not a
   * contract and a character sunk a centimetre into an island reads as cheap.
   */
  footOffset: number;
  /**
   * Half the model's widest HORIZONTAL extent once scaled, in scene metres.
   *
   * Footprint, not height: a quadruped is wide and low, a human narrow and
   * tall, and a contact shadow sized off height would be absurd on both.
   */
  footprint: number;
}

/**
 * The two numbers a character needs to stand somewhere, from the model itself.
 *
 * Shared with `scripts/verify-placement.ts` rather than reimplemented there:
 * a gate that computes footing its own way certifies a different product, which
 * is the same rule the placement solver is imported under.
 */
export function modelFooting(model: Object3D, scale: number): ModelFooting {
  const box = modelBounds(model);
  if (box.isEmpty()) return { footOffset: 0, footprint: 0 };
  const size = box.getSize(new Vector3());
  return {
    footOffset: -box.min.y * scale,
    footprint: (Math.max(size.x, size.z) * scale) / 2,
  };
}

/**
 * Where a named bone sits in the MODEL's own space, or null if it has no such
 * bone.
 *
 * Same discipline as `modelBounds` above and for the same reason: it composes
 * LOCAL matrices down from the model root and reads nothing above it, so the
 * answer does not change with what the model happens to be parented to.
 *
 * This exists because a bounding box does not know where a FACE is. Framing a
 * bust as "the top of the box" is a biped assumption: it lands on Zara's head
 * and on the top of Dina's SKULL, because a quadruped's face is at the front of
 * the box, not the top of it. Both rigs carry a `head` bone, so the honest aim
 * point is to go and read it.
 */
export function boneOrigin(model: Object3D, name: string): Vector3 | null {
  const wanted = name.toLowerCase();
  let found: Vector3 | null = null;

  const visit = (node: Object3D, parentMatrix: Matrix4) => {
    if (found) return;
    if (node.matrixAutoUpdate) node.updateMatrix();
    const matrix = new Matrix4().multiplyMatrices(parentMatrix, node.matrix);
    if (node.name.toLowerCase() === wanted) {
      found = new Vector3().setFromMatrixPosition(matrix);
      return;
    }
    for (const child of node.children) visit(child, matrix);
  };

  visit(model, new Matrix4());
  return found;
}
