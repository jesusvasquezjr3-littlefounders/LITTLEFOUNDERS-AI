import { describe, expect, it } from 'vitest';
import {
  Bone,
  Box3,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { modelBounds, modelFooting } from './modelBounds';

/*
 * THE SHIP-BLOCKER THIS MODULE EXISTS FOR, in the smallest form that still has
 * it: measure a model, then attach it to a scaled group and measure again. The
 * two answers must be the same number, because the question — how big is this
 * export — has nothing to do with where the object is currently hanging.
 *
 * `Box3.setFromObject` answers a DIFFERENT question and every assertion below
 * pins that difference down rather than assuming it, because the two calls look
 * identical at a call site and the product shipped with the wrong one.
 */

/** A model shaped like the real ones: a nested node with its own transform. */
function buildPlainModel(): Object3D {
  const root = new Object3D();
  const node = new Object3D();
  node.position.set(0.1, 0.25, -0.4);
  node.rotation.y = 0.7;
  const mesh = new Mesh(new BoxGeometry(0.4, 1.2, 0.3), new MeshBasicMaterial());
  node.add(mesh);
  root.add(node);
  return root;
}

/**
 * A model shaped like the CAST: every character is a `SkinnedMesh`, whose
 * vertices live in bind space and are only in the right place once the bones
 * have moved them. Reading `geometry.boundingBox` for one of these measures
 * something that is never drawn — it collapsed the three bipeds' contact
 * shadows to a centimetre — so the object-level box has to win, exactly as
 * `Box3.expandByObject` makes it win.
 */
function buildSkinnedModel(): { root: Object3D; skeleton: Skeleton } {
  const geometry = new BoxGeometry(0.5, 1, 0.5);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));

  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
  const bone = new Bone();
  mesh.add(bone);
  mesh.updateMatrixWorld(true);
  // Bound with the bone at the origin, so its inverse is the identity and any
  // later move of the bone is a real skin displacement rather than a no-op.
  const skeleton = new Skeleton([bone]);
  mesh.bind(skeleton);

  // Now pose it: the skin sits 2 m above where the raw vertices are.
  bone.position.set(0, 2, 0);
  mesh.updateMatrixWorld(true);
  skeleton.update();

  const root = new Object3D();
  root.add(mesh);
  return { root, skeleton };
}

/** The parenting that broke it: Dina's own scale, on an island-sized offset. */
function attachToStage(model: Object3D): Group {
  const stage = new Group();
  stage.position.set(0.73, 0.18, 1.26);
  stage.scale.setScalar(1.9 / 0.028);
  stage.add(model);
  stage.updateMatrixWorld(true);
  return stage;
}

const box = (b: Box3) => ({
  min: [b.min.x, b.min.y, b.min.z].map((v) => Number(v.toFixed(6))),
  max: [b.max.x, b.max.y, b.max.z].map((v) => Number(v.toFixed(6))),
});

describe('modelBounds', () => {
  it('reproduces setFromObject exactly while the model has no parent', () => {
    const model = buildPlainModel();
    expect(box(modelBounds(model))).toEqual(box(new Box3().setFromObject(model)));
  });

  it('reproduces setFromObject exactly for a SKINNED model with no parent', () => {
    const { root } = buildSkinnedModel();
    expect(box(modelBounds(root))).toEqual(box(new Box3().setFromObject(root)));
  });

  it('reads the POSED box of a skinned mesh, not its bind-space geometry', () => {
    const { root } = buildSkinnedModel();
    const measured = modelBounds(root);
    // The bone lifted the skin 2 m; the raw geometry box is centred on zero.
    expect(measured.min.y).toBeCloseTo(1.5, 5);
    expect(measured.max.y).toBeCloseTo(2.5, 5);
  });

  it('gives the SAME answer once the model is attached to a scaled group', () => {
    const model = buildPlainModel();
    const before = box(modelBounds(model));
    attachToStage(model);
    expect(box(modelBounds(model))).toEqual(before);
  });

  it('gives the same answer for a skinned model attached to a scaled group', () => {
    const { root } = buildSkinnedModel();
    const before = box(modelBounds(root));
    attachToStage(root);
    expect(box(modelBounds(root))).toEqual(before);
  });

  it('is what setFromObject is NOT — the defect, stated as a test', () => {
    const model = buildPlainModel();
    const before = box(new Box3().setFromObject(model));
    attachToStage(model);
    // 67.9x taller. This is the reading `Character3D` used to take on a remount,
    // and it is why Dina's contact shadow reached 221 m across.
    expect(box(new Box3().setFromObject(model))).not.toEqual(before);
  });
});

describe('modelFooting', () => {
  /** Dina's measured scale — the outlier, exported in Unreal units. */
  const DINA_SCALE = 1.9 / 0.028;

  it('survives the remount that broke the island', () => {
    const model = buildPlainModel();
    const before = modelFooting(model, DINA_SCALE);
    attachToStage(model);
    const after = modelFooting(model, DINA_SCALE);
    expect(after.footOffset).toBeCloseTo(before.footOffset, 6);
    expect(after.footprint).toBeCloseTo(before.footprint, 6);
  });

  it('scales the export into scene metres', () => {
    const root = new Object3D();
    root.add(new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()));
    // A 4-tall box centred on the origin: its lowest point is 2 below, so it
    // must be lifted by 2 x scale, and its widest span is 2 x scale wide.
    const { footOffset, footprint } = modelFooting(root, 3);
    expect(footOffset).toBeCloseTo(6, 6);
    expect(footprint).toBeCloseTo(3, 6);
  });

  it('reports zeros for a model with no geometry rather than infinities', () => {
    expect(modelFooting(new Object3D(), 2)).toEqual({ footOffset: 0, footprint: 0 });
  });

  it('ignores a translation of the model itself the same way three does', () => {
    const model = buildPlainModel();
    const plain = modelBounds(model).getSize(new Vector3());
    model.position.set(5, 5, 5);
    // The model's OWN transform is part of the answer — `setFromObject` includes
    // it too — but it must not change the SIZE.
    expect(modelBounds(model).getSize(new Vector3()).length()).toBeCloseTo(plain.length(), 6);
  });
});
