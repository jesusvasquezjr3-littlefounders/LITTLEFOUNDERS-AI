/*
 * Shared machinery for the three gates that judge a character's MESH rather
 * than its skeleton: `verify-skin`, `verify-pose` and `verify-clearance`.
 *
 * It exists so the anatomy vocabulary and the clip composition are written
 * ONCE. `spurious()` already has a second copy in `repair-skin.py` that has to
 * be kept in step by hand — Blender cannot import this — and that is one copy
 * too many already. Three more would be the same trap AGENTS.md §5 describes
 * for the whiteboard instruments, where a shape hand-written in five places
 * silently lost a member and two boards were dropped for months.
 *
 * THE CLIP COMPOSITION HERE MUST MATCH THE RUNTIME'S. Clips are ADDITIVE:
 * `clipLibrary.ts` sanitises away every translation track, then
 * `AnimationUtils.makeClipAdditive` measures each rotation against the
 * library's own exported `emotion.rest`, and three.js applies the result on top
 * of the character's BIND rotation. Playing a clip absolutely instead re-poses
 * every character into the authoring rig's skeleton — the defect TUTOR_3D.md
 * §3 records, which collapsed Rho's feet 60.6% and Liruf's 79.4%. A gate that
 * composed clips its own way would measure that defect instead of the product.
 */
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

/* ── anatomy vocabulary ─────────────────────────────────────────────────── */

const HAND = /^(Left|Right)Hand$/;
const FORE = /^(Left|Right)ForeArm$/;
const UPPER = /^(Left|Right)Arm$/;
const SHOULDER = /^(Left|Right)Shoulder$/;
const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/;
const PELVIS = /^Hips$/;
const SPINE = /^(Spine|Spine01|Spine02)$/;
const HEAD = /^(neck|Head|head_end|headfront)$/;

export function classOf(name) {
  if (HAND.test(name)) return 'hand';
  if (FORE.test(name)) return 'fore';
  if (UPPER.test(name)) return 'upper';
  if (SHOULDER.test(name)) return 'shoulder';
  if (LEG.test(name)) return 'leg';
  if (PELVIS.test(name)) return 'pelvis';
  if (SPINE.test(name)) return 'spine';
  if (HEAD.test(name)) return 'head';
  return 'other';
}

const ARM_SIDE = new Set(['hand', 'fore', 'upper']);
const BODY_SIDE = new Set(['leg', 'pelvis', 'spine']);

/**
 * True when a face or a weight linking bones `a` and `b` cannot be anatomy.
 *
 * MIRRORED IN `repair-skin.py`. If the two ever disagree, the repair and the
 * gate that judges it stop meaning the same thing by "defect".
 *
 * The two exemptions are what keep this from flagging a correct rig. The
 * SHOULDER is how an arm attaches to a torso at all, and the upper arm meeting
 * the SPINE is the ARMPIT. Severing either makes an arm hang off the body in
 * strips — it was tried, and it looked worse than the defect it replaced.
 *
 * The armpit exemption stops at the spine and does NOT reach the pelvis. Liruf's
 * rig gives 365 of his 468 torso vertices — at 36% of his body height, which is
 * his waist — up to 0.60 of upper-arm weight, and the wider reading waved all of
 * it through. Zara's real armpit vertices sit at 66% of hers, so nothing
 * legitimate depends on it. Bone NAMES do not sit at the same height on these
 * three rigs (TUTOR_3D.md §3), so the rule names the pelvis rather than
 * trusting a `Spine02` to be low.
 */
export function spurious(a, b) {
  const x = classOf(a);
  const y = classOf(b);
  if (x === 'other' || y === 'other' || x === y) return false;
  if (ARM_SIDE.has(x) && ARM_SIDE.has(y)) return false;
  if (BODY_SIDE.has(x) && BODY_SIDE.has(y)) return false;
  if (x === 'shoulder' || y === 'shoulder') return false;
  const armSide = ARM_SIDE.has(x) ? x : y;
  const bodySide = ARM_SIDE.has(x) ? y : x;
  if (armSide === 'upper' && bodySide === 'spine') return false;
  return true;
}

/* ── maths ──────────────────────────────────────────────────────────────── */

export const IDENTITY = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export const mul = (a, b) => {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
};

export const fromTRS = (t, r, s) => {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return new Float64Array([
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]);
};

export const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const triangleArea = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  );
};

/** Shortest distance between two line segments, clamped to their extents. */
export function segmentDistance(p0, p1, q0, q1) {
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
  const w = [p0[0] - q0[0], p0[1] - q0[1], p0[2] - q0[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  const D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-12) { sN = 0; sD = 1; tN = e; tD = c; }
  else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) { sN = 0; tN = e; tD = c; }
    else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
  }
  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; }
  }
  const sc = Math.abs(sN) < 1e-12 ? 0 : sN / sD;
  const tc = Math.abs(tN) < 1e-12 ? 0 : tN / tD;
  return Math.hypot(
    w[0] + sc * u[0] - tc * v[0],
    w[1] + sc * u[1] - tc * v[1],
    w[2] + sc * u[2] - tc * v[2],
  );
}

/* ── reading ────────────────────────────────────────────────────────────── */

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

/** A character's skeleton, bind pose and skinned primitives. */
export async function readCharacter(path) {
  const doc = await io.read(path);
  const root = doc.getRoot();

  const bindLocal = new Map();
  const parentOf = new Map();
  const order = [];
  const walk = (node, parent) => {
    parentOf.set(node, parent);
    bindLocal.set(node, {
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
    });
    order.push(node);
    for (const child of node.listChildren()) walk(child, node);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n, null);

  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const names = joints.map((j) => j.getName());
  const ibmAccessor = skin.getInverseBindMatrices();
  const ibm = joints.map((_, i) => {
    const m = new Float64Array(16);
    ibmAccessor.getElement(i, m);
    return m;
  });

  const primitives = [];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('JOINTS_0') && prim.getAttribute('WEIGHTS_0')) primitives.push(prim);
    }
  }

  const byName = new Map(names.map((n, i) => [n, joints[i]]));
  return { root, joints, names, byName, ibm, bindLocal, parentOf, order, primitives };
}

/** Every vertex of every skinned primitive, with its joints, weights and rest position. */
export function readVertices({ names, primitives }) {
  const verts = [];
  const tris = [];
  let base = 0;
  for (const prim of primitives) {
    const POS = prim.getAttribute('POSITION');
    const JNT = prim.getAttribute('JOINTS_0');
    const WGT = prim.getAttribute('WEIGHTS_0');
    const idx = prim.getIndices();
    const j4 = [0, 0, 0, 0];
    const w4 = [0, 0, 0, 0];
    const p3 = [0, 0, 0];
    for (let v = 0; v < POS.getCount(); v++) {
      JNT.getElement(v, j4);
      WGT.getElement(v, w4);
      POS.getElement(v, p3);
      const bones = [];
      let best = -1;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        if (w4[k] <= 0) continue;
        bones.push({ joint: j4[k], weight: w4[k] });
        if (w4[k] > bestW) { bestW = w4[k]; best = j4[k]; }
      }
      verts.push({ pos: [...p3], bones, dominant: best < 0 ? null : names[best], joint: best });
    }
    const array = idx ? idx.getArray() : null;
    const count = array ? array.length : POS.getCount();
    for (let t = 0; t < count; t += 3) {
      tris.push(array
        ? [base + array[t], base + array[t + 1], base + array[t + 2]]
        : [base + t, base + t + 1, base + t + 2]);
    }
    base += POS.getCount();
  }
  return { verts, tris };
}

/**
 * World matrices for every node, with per-node local rotation overrides.
 *
 * `overrides` maps a bone NAME to the local rotation it should use instead of
 * its bind rotation. Everything below it inherits, which is what makes a
 * shoulder rotation carry the whole arm.
 */
export function worldMatrices(character, overrides = new Map()) {
  const { order, parentOf, bindLocal, names } = character;
  const known = new Set(names);
  const world = new Map();
  for (const node of order) {
    const local = bindLocal.get(node);
    const name = node.getName();
    const rotation = (known.has(name) && overrides.get(name)) || local.rotation;
    const m = fromTRS(local.translation, rotation, local.scale);
    const parent = parentOf.get(node);
    world.set(node, parent ? mul(world.get(parent), m) : m);
  }
  return world;
}

/** Per-joint skinning matrices: world * inverseBind. */
export function skinningMatrices(character, world) {
  return character.joints.map((joint, i) => mul(world.get(joint) ?? IDENTITY, character.ibm[i]));
}

/** Linear blend skinning. */
export function skinVertices(matrices, verts) {
  const out = new Array(verts.length);
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const p = [0, 0, 0];
    let total = 0;
    for (const { joint, weight } of v.bones) {
      total += weight;
      const q = apply(matrices[joint], v.pos);
      p[0] += weight * q[0]; p[1] += weight * q[1]; p[2] += weight * q[2];
    }
    if (total > 0 && Math.abs(total - 1) > 1e-4) { p[0] /= total; p[1] /= total; p[2] /= total; }
    out[i] = p;
  }
  return out;
}

/* ── the authored clip library ──────────────────────────────────────────── */

export const REST_CLIP = 'emotion.rest';

/**
 * Reads the authored clip library and exposes each clip as the ADDITIVE
 * per-bone deltas the runtime actually applies. See the note at the top of this
 * file: composing these any other way measures a defect the product does not
 * have.
 */
export async function readClipLibrary(path) {
  const doc = await io.read(path);
  const animations = doc.getRoot().listAnimations();

  const frames = new Map(); // clip -> { times, byTime: Map<time, Map<bone, quat>> }
  for (const anim of animations) {
    const stamps = new Set();
    const byBone = new Map();
    for (const channel of anim.listChannels()) {
      if (channel.getTargetPath() !== 'rotation') continue;
      const node = channel.getTargetNode();
      if (!node) continue;
      const sampler = channel.getSampler();
      const input = sampler.getInput();
      const output = sampler.getOutput();
      const times = [];
      const el = [0];
      for (let i = 0; i < input.getCount(); i++) { input.getElement(i, el); times.push(el[0]); }
      const values = [];
      const q = [0, 0, 0, 0];
      for (let i = 0; i < output.getCount(); i++) { output.getElement(i, q); values.push([...q]); }
      byBone.set(node.getName(), { times, values });
      for (const t of times) stamps.add(t);
    }
    frames.set(anim.getName(), { times: [...stamps].sort((a, b) => a - b), byBone });
  }

  const rotationAt = (clip, bone, time) => {
    const track = frames.get(clip)?.byBone.get(bone);
    if (!track) return null;
    let best = 0;
    for (let i = 1; i < track.times.length; i++) {
      if (Math.abs(track.times[i] - time) < Math.abs(track.times[best] - time)) best = i;
    }
    return track.values[best];
  };

  const restAt = new Map();
  const restFrame = frames.get(REST_CLIP);
  if (restFrame) {
    for (const bone of restFrame.byBone.keys()) restAt.set(bone, rotationAt(REST_CLIP, bone, 0));
  }

  return {
    names: [...frames.keys()],
    times: (clip) => frames.get(clip)?.times ?? [],
    /** The additive deltas a clip contributes at `time`, keyed by bone name. */
    deltasAt(clip, time) {
      const frame = frames.get(clip);
      const deltas = new Map();
      if (!frame) return deltas;
      for (const bone of frame.byBone.keys()) {
        const reference = restAt.get(bone);
        const value = rotationAt(clip, bone, time);
        if (!reference || !value) continue;
        deltas.set(bone, qMul(qInv(reference), value));
      }
      return deltas;
    },
  };
}

/** Turn additive deltas into the local rotations the runtime ends up with. */
export function overridesFor(character, deltas) {
  const overrides = new Map();
  for (const [bone, delta] of deltas) {
    const node = character.byName.get(bone);
    if (!node) continue;
    overrides.set(bone, qMul(node.getRotation(), delta));
  }
  return overrides;
}

/** `clipFor`'s rule: `<action>@<id>` wins for that character, else the shared clip. */
export function clipFor(library, action, characterId) {
  const override = `${action}@${characterId}`;
  return library.names.includes(override) ? override : action;
}

/** The canonical actions and emotions, as `verify-rig` enumerates them. */
export const ACTIONS = [
  'idle', 'jump', 'hop', 'wave', 'point', 'celebrate',
  'nod', 'shake', 'think', 'dance', 'peek', 'bow',
];
export const EMOTIONS = [
  'neutral', 'happy', 'excited', 'thinking', 'surprised', 'encouraging', 'proud',
];
