/*
 * Checks that each character's SKIN can survive the poses the clips ask for.
 *
 * WHY THIS EXISTS. `verify-rig` proves a clip keeps every character in its own
 * stance and proportions — it reasons about BONES. It is blind to the mesh
 * those bones drag, and that is where Rho's worst defect lived for months.
 *
 * Rho ships from Meshy with the inner surface of each arm WELDED to the torso
 * and thigh: 91 triangles had vertices in both a hand and a hip, and the closest
 * hand vertex sat 1.2 cm from the leg. On top of that the skin weights bled
 * across the contact — 259 arm vertices carried torso/leg weight. Raising both
 * arms 120 degrees therefore dragged the LEGS 0.333 and the torso 0.275, against
 * Zara's 0.000 and 0.063, and stretched 6.53% of his triangles past double area
 * against her 0.31%. On screen the trousers shortened, the waistcoat narrowed,
 * and sheets of geometry fanned from each shoulder to the hip.
 *
 * Nothing caught it. It is a property of the geometry inside the .glb, not of
 * any code, so type-check, lint, the test suite and `verify-rig` were all green
 * across every one of the `celebrate@rho` tuning rounds in TUTOR_3D.md 4.2 —
 * rounds that were re-posing the character to dodge a modelling defect that
 * nobody had measured.
 *
 * WHAT IT CHECKS
 *   weld       no triangle may span an anatomically impossible pair of bones. A
 *              hand and a thigh sharing a face is a weld; a shoulder blending
 *              into the torso is anatomy, and Zara has 384 of those. The
 *              difference is the whole check — see `spurious()`.
 *   bleed      no vertex may carry weight from a bone on the far side of such a
 *              pair. This is what makes a hip follow a hand.
 *   isolation  raise both arms and the legs must not move. This is the property
 *              a viewer actually sees, and it is measured rather than inferred.
 *   stretch    what FRACTION of the mesh blows up in area at that pose. Guards
 *              the OTHER failure: cleaning weights while the weld stands lets
 *              hand and thigh move apart and pulls the shared sheet taut, which
 *              took Rho from 1.20% of triangles past 5x area to 2.14%. A repair
 *              that fixes isolation and fails stretch has made things worse.
 *              Measured as a fraction and never as a maximum — see the note on
 *              MAX_SEVERE_FRACTION for the Zara false alarm that taught this.
 *
 * Source exports live outside the repo (`/glb/`, gitignored), so this is a LOCAL
 * gate. It exits non-zero rather than passing quietly when they are absent: a
 * skip that reads as a pass is how a mesh defect ships behind a green tick.
 *
 *   node scripts/verify-skin.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SOURCE_DIR = resolve(REPO, 'glb');

/** The bipeds. Dina is a quadruped on her own 27-joint rig and is not checked. */
const BIPEDS = { zara: 'Zara', rho: 'Rho', liruf: 'Liruf' };

/** The pose the checks are measured at: both arms up and out. */
const RAISE_DEG = 120;

/* Thresholds. Each names the magnitude of the defect it guards against, so the
 * margin is visible rather than a number somebody once picked. */
const MAX_WELD_FACES = 0; // Rho shipped 91, Liruf 72
const MAX_BLEED_VERTS = 0; // Rho shipped 259 arm + 114 body
const MAX_LEG_DRIFT = 0.02; // Rho 0.333, Liruf 0.215; a clean rig is Zara's 0.000
const MAX_TORSO_DRIFT = 0.12; // Rho 0.275; Zara's legitimate armpit pull is 0.063
const MAX_STRETCH_FRACTION = 0.015; // Rho 0.0653; Zara, a clean mesh, is 0.0031
const SEVERE_STRETCH = 5; // a triangle at 5x its area reads as a tear, not a bend
const MAX_SEVERE_FRACTION = 0.005; // Rho 0.0120 welded, 0.0214 weights-only; Zara 0.0020

/* The WORST single triangle is reported but never failed on, and that is a
 * deliberate correction. The first version of this gate failed ZARA — the clean
 * control — on one x130 triangle, and an area floor did not rescue it because
 * the triangle is not a sliver: it is armpit skin, which genuinely stretches
 * enormously when an arm goes up 120 degrees. A maximum cannot tell that apart
 * from a defect. The FRACTION of severely stretched triangles can, because a
 * torn weld tears in dozens of places at once while anatomy stretches in one.
 * This is the same cry-wolf trap `verify-rig` documents in its own header. */

/* ── bone vocabulary ────────────────────────────────────────────────────── */

const HAND = /^(Left|Right)Hand$/;
const FORE = /^(Left|Right)ForeArm$/;
const UPPER = /^(Left|Right)Arm$/;
const SHOULDER = /^(Left|Right)Shoulder$/;
const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/;
const PELVIS = /^Hips$/;
const SPINE = /^(Spine|Spine01|Spine02)$/;

function classOf(name) {
  if (HAND.test(name)) return 'hand';
  if (FORE.test(name)) return 'fore';
  if (UPPER.test(name)) return 'upper';
  if (SHOULDER.test(name)) return 'shoulder';
  if (LEG.test(name)) return 'leg';
  if (PELVIS.test(name)) return 'pelvis';
  if (SPINE.test(name)) return 'spine';
  return 'other';
}

const ARM_SIDE = new Set(['hand', 'fore', 'upper']);
const BODY_SIDE = new Set(['leg', 'pelvis', 'spine']);

/**
 * True when a face or a weight linking bones `a` and `b` cannot be anatomy.
 *
 * The two exemptions are what keep this from flagging a correct rig. The
 * SHOULDER is how an arm attaches to a torso at all, and the upper arm meeting
 * the SPINE is the ARMPIT. Severing either is what makes an arm hang off the
 * body in strips — it was tried, and it looked worse than the defect.
 *
 * The armpit exemption stops at the spine and does NOT reach the pelvis, which
 * is the correction that finally caught Liruf. His rig gives 365 of his 468
 * torso vertices — at 36% of his body height, which is his waist — up to 0.60
 * of upper-arm weight, and an exemption written as "upper arm may touch the
 * lower torso" waved all of it through. Zara's real armpit vertices sit at 66%
 * of hers, so nothing legitimate depends on the wider reading. Bone NAMES do
 * not sit at the same height on these three rigs (TUTOR_3D 3), so the rule has
 * to name the pelvis rather than trust a `Spine02` to be low.
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

const mul = (a, b) => {
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
const fromTRS = (t, r, s) => {
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
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const IDENTITY = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A rotation of `deg` about the world Z axis, taken about the point `p`. */
function rotateAbout(p, deg) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const T = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1]);
  const R = new Float64Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const Ti = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1]);
  return mul(T, mul(R, Ti));
}

const triangleArea = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  );
};

/* ── reading a character ────────────────────────────────────────────────── */

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

async function readCharacter(path) {
  const doc = await io.read(path);
  const root = doc.getRoot();

  const world = new Map();
  const walk = (node, parent) => {
    const m = mul(parent, fromTRS(node.getTranslation(), node.getRotation(), node.getScale()));
    world.set(node, m);
    for (const child of node.listChildren()) walk(child, m);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n, IDENTITY);

  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const names = joints.map((j) => j.getName());
  const ibm = skin.getInverseBindMatrices();

  const subtree = (node, out = new Set()) => {
    out.add(node);
    for (const c of node.listChildren()) subtree(c, out);
    return out;
  };

  const primitives = [];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!prim.getAttribute('JOINTS_0') || !prim.getAttribute('WEIGHTS_0')) continue;
      primitives.push(prim);
    }
  }

  return { root, world, joints, names, ibm, subtree, primitives };
}

/** Every vertex of every skinned primitive, with its joints, weights and position. */
function readVertices({ names, primitives }) {
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
      verts.push({ pos: [...p3], bones, dominant: best < 0 ? null : names[best] });
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

/** Skin every vertex at rest and with both arms raised. */
function poseVertices(character, verts, raiseDeg) {
  const { world, joints, names, ibm, subtree } = character;
  const byName = new Map(names.map((n, i) => [n, joints[i]]));

  const deltas = [];
  for (const [bone, sign] of [['LeftArm', 1], ['RightArm', -1]]) {
    const node = byName.get(bone);
    if (!node) continue;
    deltas.push({ set: subtree(node), delta: rotateAbout(apply(world.get(node), [0, 0, 0]), sign * raiseDeg) });
  }

  const posed = new Map();
  for (const [node, m] of world) {
    let out = m;
    for (const d of deltas) if (d.set.has(node)) out = mul(d.delta, out);
    posed.set(node, out);
  }

  const matrices = (source) => joints.map((j, i) => {
    const inv = new Float64Array(16);
    ibm.getElement(i, inv);
    return mul(source.get(j) ?? IDENTITY, inv);
  });
  const restM = matrices(world);
  const poseM = matrices(posed);

  const skin = (mats, vertex) => {
    const out = [0, 0, 0];
    let total = 0;
    for (const { joint, weight } of vertex.bones) {
      total += weight;
      const q = apply(mats[joint], vertex.pos);
      out[0] += weight * q[0];
      out[1] += weight * q[1];
      out[2] += weight * q[2];
    }
    if (total > 0 && Math.abs(total - 1) > 1e-4) {
      out[0] /= total; out[1] /= total; out[2] /= total;
    }
    return out;
  };

  return {
    rest: verts.map((v) => skin(restM, v)),
    posed: verts.map((v) => skin(poseM, v)),
  };
}

/* ── the checks ─────────────────────────────────────────────────────────── */

const failures = [];
const rows = [];

function checkCharacter(id, character) {
  const { verts, tris } = readVertices(character);
  const { names } = character;

  // weld — a triangle whose corners sit on bones that cannot be adjacent
  let weld = 0;
  for (const [a, b, c] of tris) {
    const ds = [verts[a].dominant, verts[b].dominant, verts[c].dominant];
    let bad = false;
    for (let i = 0; i < ds.length && !bad; i++) {
      for (let j = i + 1; j < ds.length && !bad; j++) {
        if (ds[i] && ds[j] && spurious(ds[i], ds[j])) bad = true;
      }
    }
    if (bad) weld++;
  }

  // bleed — a vertex pulled by a bone on the far side of a spurious pair
  let bleed = 0;
  for (const v of verts) {
    if (!v.dominant) continue;
    if (v.bones.some(({ joint, weight }) => weight > 0.05 && spurious(v.dominant, names[joint]))) bleed++;
  }

  // isolation and stretch, measured at the raised pose
  const { rest, posed } = poseVertices(character, verts, RAISE_DEG);
  let legDrift = 0;
  let torsoDrift = 0;
  for (let i = 0; i < verts.length; i++) {
    const cls = verts[i].dominant ? classOf(verts[i].dominant) : 'other';
    const d = Math.hypot(
      posed[i][0] - rest[i][0],
      posed[i][1] - rest[i][1],
      posed[i][2] - rest[i][2],
    );
    if (cls === 'leg') legDrift = Math.max(legDrift, d);
    if (cls === 'pelvis' || cls === 'spine') torsoDrift = Math.max(torsoDrift, d);
  }

  const restAreas = tris.map(([a, b, c]) => triangleArea(rest[a], rest[b], rest[c]));

  let over = 0;
  let severe = 0;
  let measured = 0;
  let worst = 0;
  for (let t = 0; t < tris.length; t++) {
    const a0 = restAreas[t];
    if (a0 < 1e-12) continue;
    const [a, b, c] = tris[t];
    const ratio = triangleArea(posed[a], posed[b], posed[c]) / a0;
    measured++;
    if (ratio > 2) over++;
    if (ratio > SEVERE_STRETCH) severe++;
    if (ratio > worst) worst = ratio;
  }
  const fraction = measured > 0 ? over / measured : 0;
  const severeFraction = measured > 0 ? severe / measured : 0;

  rows.push({ id, tris: tris.length, weld, bleed, legDrift, torsoDrift, fraction, severeFraction, worst });

  const fail = (what) => failures.push(`${id}: ${what}`);
  if (weld > MAX_WELD_FACES) {
    fail(`${weld} welded triangle(s) join bones that cannot be adjacent (max ${MAX_WELD_FACES}).`);
  }
  if (bleed > MAX_BLEED_VERTS) {
    fail(`${bleed} vertex/vertices carry weight across a weld (max ${MAX_BLEED_VERTS}).`);
  }
  if (legDrift > MAX_LEG_DRIFT) {
    fail(`raising the arms moves a LEG vertex ${legDrift.toFixed(3)} (max ${MAX_LEG_DRIFT}).`);
  }
  if (torsoDrift > MAX_TORSO_DRIFT) {
    fail(`raising the arms moves a TORSO vertex ${torsoDrift.toFixed(3)} (max ${MAX_TORSO_DRIFT}).`);
  }
  if (fraction > MAX_STRETCH_FRACTION) {
    fail(`${(fraction * 100).toFixed(2)}% of triangles more than double in area (max ${(MAX_STRETCH_FRACTION * 100).toFixed(2)}%).`);
  }
  if (severeFraction > MAX_SEVERE_FRACTION) {
    fail(`${(severeFraction * 100).toFixed(2)}% of triangles grow past x${SEVERE_STRETCH} (max ${(MAX_SEVERE_FRACTION * 100).toFixed(2)}%).`);
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

const missing = Object.values(BIPEDS)
  .map((file) => resolve(SOURCE_DIR, `${file}.glb`))
  .filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error('verify-skin: CANNOT RUN — the source exports are not present.');
  console.error(`  /glb/ lives outside the repo by design. Missing: ${missing.length} file(s).`);
  console.error('  This is a LOCAL gate; it is not part of CI and never reports success on an empty run.');
  process.exit(1);
}

for (const [id, file] of Object.entries(BIPEDS)) {
  checkCharacter(id, await readCharacter(resolve(SOURCE_DIR, `${file}.glb`)));
}

console.log(`verify-skin: ${rows.length} characters, both arms raised ${RAISE_DEG} degrees\n`);
console.log('  character   tris   weld  bleed   legDrift  torsoDrift   >2x area   >5x area   worst');
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(10)} ${String(r.tris).padStart(6)} ${String(r.weld).padStart(6)} ${String(r.bleed).padStart(6)}` +
    `   ${r.legDrift.toFixed(3).padStart(8)}    ${r.torsoDrift.toFixed(3).padStart(8)}` +
    `   ${(r.fraction * 100).toFixed(2).padStart(7)}%   ${(r.severeFraction * 100).toFixed(2).padStart(7)}%  x${r.worst.toFixed(1).padStart(6)}`,
  );
}

if (failures.length > 0) {
  console.error(`\nverify-skin: FAILED — ${failures.length} problem(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log('\nverify-skin OK — every arm moves without dragging the body it hangs from');
