/*
 * Plays every authored clip on every character and asserts that no body part
 * ENTERS another — a hand sunk into the torso, a forearm through a thigh, a
 * fist inside the head.
 *
 * WHY THIS EXISTS, and why the other three gates cannot see it. `verify-rig`
 * reasons about bones; `verify-skin` and `verify-pose` measure how the mesh
 * DEFORMS. Interpenetration deforms nothing at all — every triangle keeps its
 * exact area and its exact edge lengths while the hand slides inside the chest.
 * It is a pose being anatomically impossible rather than a mesh being damaged,
 * and it is invisible to every distortion metric by construction.
 *
 * TUTOR_3D.md §4.2 records this happening and being worked around by hand: an
 * automated search for a better `point@rho` "returned high-scoring poses with
 * the arm inside the torso", judged by eye, three rounds of it from the wrong
 * camera. That is the check, and it should never have been a person's job.
 *
 * HOW IT MEASURES. Each bone gets a CAPSULE fitted to the vertices it actually
 * owns: a segment along the cloud's principal axis, and a radius at the
 * PERCENTILE of the perpendicular distances rather than the maximum, so one
 * stray vertex cannot inflate a limb.
 *
 * Then it tests real VERTICES against those capsules, and never capsule against
 * capsule. That distinction is the whole gate. Capsule-to-capsule overlap adds
 * the fat of BOTH approximations, so it cannot tell a hand resting against a
 * chest from a hand buried in one — the first version did exactly that and
 * failed all three characters, flagging a BOW for bringing the head towards the
 * chest and `celebrate` for putting a forearm beside the head. Both are the
 * poses working correctly. Measuring how deep a hand's own vertices sit inside
 * the torso's volume asks the question a viewer actually asks: a hand alongside
 * the chest has its vertices outside the chest, a hand inside it does not.
 *
 * Only a sample of each part's vertices is carried, so a frame costs a few
 * thousand operations instead of re-skinning 131,506 vertices.
 *
 * EVERY MEASUREMENT IS RELATIVE TO THE REST POSE, and that is the whole design.
 * Rho stands with his hands 1.2 cm from his thighs, so his hand and leg capsules
 * already overlap before anything moves; Liruf's arms rest against his belly.
 * An absolute "do these capsules touch" test would fail all three characters
 * standing still. What matters is whether a pose drives a part FURTHER into
 * another than the character was built with — see `MAX_INTRUSION_SHARE`.
 *
 * ADJACENT BONES ARE EXEMPT. A forearm overlaps its own upper arm, a hand its
 * own forearm, a shoulder its own spine — that is a skeleton, not a collision.
 * Pairs within two steps of each other in the bone hierarchy are skipped.
 *
 * Source exports live outside the repo (`/glb/`), so this is a LOCAL gate. It
 * exits non-zero rather than passing quietly when they are absent.
 *
 *   node scripts/verify-clearance.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS, EMOTIONS, apply, classOf, clipFor, readCharacter, readClipLibrary, readVertices,
  overridesFor, segmentDistance, skinningMatrices, worldMatrices,
} from './lib/skin.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SOURCE_DIR = resolve(REPO, 'glb');
const LIBRARY = resolve(REPO, 'frontend', 'public', 'scenes', 'clips-biped.glb');

const BIPEDS = { zara: 'Zara', rho: 'Rho', liruf: 'Liruf' };

/** Bones closer than this in the hierarchy legitimately overlap. */
const ADJACENT_STEPS = 2;
/** A bone needs at least this many vertices before a capsule means anything. */
const MIN_VERTICES = 8;
/** Radius and half-length are taken at this percentile, never the maximum. */
const EXTENT_PERCENTILE = 0.85;
/** Vertices carried per part. Enough to cover a hand; cheap enough for 1,120 frames. */
const PROBES_PER_PART = 48;
/** A part can only be swallowed by one at least this much fatter than itself. */
const FATTER_BY = 1.3;

/*
 * WHAT MAY SINK INTO WHAT. Deliberately narrow, and the narrowness is the
 * honest part of this gate.
 *
 * One capsule per bone over-approximates badly on a stylised character, and the
 * HEAD is where it breaks: Liruf's head bone owns his whole snout, so its
 * capsule reaches down over his chest and his little arms — resting correctly in
 * front of him — measured as 99% buried inside his own head. Rendering that
 * frame is what settled it; the pose is fine. A gate that reports a correct pose
 * as a defect gets switched off, which is the trap `verify-rig` and
 * `verify-skin` both record in their own headers.
 *
 * So this asks only the question a capsule can actually answer, and it is also
 * the question that was asked: does a HAND or a FOREARM end up inside the TORSO
 * or a LEG. Those targets are genuinely capsule-shaped, genuinely fatter than
 * what enters them, and a hand inside a thigh is never anything but a defect.
 * Anything a capsule cannot judge is left to the eye rather than guessed at.
 */
const MAY_ENTER = {
  hand: new Set(['pelvis', 'spine', 'leg']),
  fore: new Set(['pelvis', 'spine', 'leg']),
};

/** A probe is BURIED once it is this far from the target's surface to its axis. */
const BURIED_DEPTH = 0.5;
/*
 * What share of a part's probes may be buried in another beyond the share
 * already buried at rest.
 *
 * This counts probes rather than measuring the single deepest one, and that is
 * the difference between a gate and a nuisance. By depth alone the real defect
 * — Liruf's forearms swallowed by his belly in `point@liruf`, only his claws
 * still visible — scored 0.72, while an arm merely PRESSED against a torso
 * during an anticipation beat scored 0.59 on the same character and 0.58 on
 * Rho, whose hands rest 1.2 cm from his thighs to begin with. Six points is not
 * a margin anyone should trust. By share of probes the two separate cleanly:
 * pressing puts a few surface vertices inside, burying puts most of the part in.
 */
const MAX_BURIED_SHARE = 0.25;

const failures = [];
const rows = [];

/** The dominant direction of a point cloud, by power iteration on its covariance. */
function principalAxis(points, centroid) {
  const cov = new Float64Array(9);
  for (const p of points) {
    const d = [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i * 3 + j] += d[i] * d[j];
  }
  let v = [1, 1, 1];
  for (let iter = 0; iter < 32; iter++) {
    const n = [
      cov[0] * v[0] + cov[1] * v[1] + cov[2] * v[2],
      cov[3] * v[0] + cov[4] * v[1] + cov[5] * v[2],
      cov[6] * v[0] + cov[7] * v[1] + cov[8] * v[2],
    ];
    const len = Math.hypot(...n);
    if (len < 1e-12) return [0, 1, 0];
    v = [n[0] / len, n[1] / len, n[2] / len];
  }
  return v;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/**
 * A capsule per bone, in the bone's own space, so posing it is one matrix
 * multiply. Built from the vertices the bone DOMINATES: a bone the mesh does
 * not use has no body and is skipped rather than given an invented one.
 */
function fitCapsules(character, verts) {
  const { names } = character;
  const owned = new Map();
  for (const v of verts) {
    if (v.joint < 0) continue;
    if (!owned.has(v.joint)) owned.set(v.joint, []);
    owned.get(v.joint).push(v.pos);
  }

  const capsules = new Map();
  for (const [joint, points] of owned) {
    if (points.length < MIN_VERTICES) continue;
    /*
     * Kept in MESH space, NOT the bone's local space. A skinning matrix is
     * `world * inverseBind` and already carries the conversion, so pre-applying
     * the inverse bind here would apply it twice. It did: Zara's hand came out
     * with a capsule radius of 4.411 against a body 1.61 tall, every capsule
     * swallowed every other, and the gate failed all three characters including
     * the clean control — on the first run, which is the only reason it was
     * caught rather than shipped as a threshold nobody could satisfy.
     */
    const local = points;
    const centroid = local.reduce(
      (acc, p) => [acc[0] + p[0] / local.length, acc[1] + p[1] / local.length, acc[2] + p[2] / local.length],
      [0, 0, 0],
    );
    const axis = principalAxis(local, centroid);
    const along = [];
    const across = [];
    for (const p of local) {
      const d = [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]];
      const t = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      along.push(Math.abs(t));
      across.push(Math.hypot(d[0] - t * axis[0], d[1] - t * axis[1], d[2] - t * axis[2]));
    }
    along.sort((a, b) => a - b);
    across.sort((a, b) => a - b);
    const half = percentile(along, EXTENT_PERCENTILE);
    const radius = percentile(across, EXTENT_PERCENTILE);
    if (!(radius > 0)) continue;
    capsules.set(joint, {
      name: names[joint],
      a: [centroid[0] - half * axis[0], centroid[1] - half * axis[1], centroid[2] - half * axis[2]],
      b: [centroid[0] + half * axis[0], centroid[1] + half * axis[1], centroid[2] + half * axis[2]],
      radius,
    });
  }
  return capsules;
}

/** Steps between two joints in the bone hierarchy, walking up to a common ancestor. */
function hierarchyDistance(character, i, j) {
  const { joints, parentOf } = character;
  const depth = new Map();
  let node = joints[i];
  let d = 0;
  while (node) { depth.set(node, d++); node = parentOf.get(node); }
  node = joints[j];
  d = 0;
  while (node) {
    if (depth.has(node)) return depth.get(node) + d;
    d++;
    node = parentOf.get(node);
  }
  return Infinity;
}

/** Evenly spread sample of the vertices a bone dominates, for probing. */
function probesFor(verts, joint) {
  const mine = [];
  for (const v of verts) if (v.joint === joint) mine.push(v);
  if (mine.length <= PROBES_PER_PART) return mine;
  const out = [];
  for (let i = 0; i < PROBES_PER_PART; i++) {
    out.push(mine[Math.floor((i * mine.length) / PROBES_PER_PART)]);
  }
  return out;
}

/** Linear blend skinning for a handful of vertices. */
function skinProbe(matrices, vertex) {
  const p = [0, 0, 0];
  let total = 0;
  for (const { joint, weight } of vertex.bones) {
    total += weight;
    const q = apply(matrices[joint], vertex.pos);
    p[0] += weight * q[0]; p[1] += weight * q[1]; p[2] += weight * q[2];
  }
  if (total > 0 && Math.abs(total - 1) > 1e-4) { p[0] /= total; p[1] /= total; p[2] /= total; }
  return p;
}

/**
 * What share of `i`'s probes sit BURIED inside `j` — past `BURIED_DEPTH` of the
 * way from its surface to its axis.
 *
 * Depth is measured as a share of the target's radius rather than an absolute
 * distance so the same number means the same thing on a thigh and on a chest.
 * Anything outside counts as zero: an unclamped version reads how FAR APART two
 * parts are when they do not touch, and subtracting that resting distance from
 * a pose produced intrusions of 1358% — Zara's hand rests twelve radii from her
 * spine, so any approach at all looked like a catastrophe.
 */
const buriedShare = (capsules, probes, matrices, i, j) => {
  const cj = capsules.get(j);
  const a = apply(matrices[j], cj.a);
  const b = apply(matrices[j], cj.b);
  const mine = probes.get(i);
  if (mine.length === 0) return 0;
  let buried = 0;
  for (const vertex of mine) {
    const p = skinProbe(matrices, vertex);
    const d = segmentDistance(p, p, a, b);
    if ((cj.radius - d) / cj.radius > BURIED_DEPTH) buried++;
  }
  return buried / mine.length;
};

async function checkCharacter(id, file, library) {
  const character = await readCharacter(resolve(SOURCE_DIR, `${file}.glb`));
  const { verts } = readVertices(character);
  const capsules = fitCapsules(character, verts);

  const pairs = [];
  const indices = [...capsules.keys()];
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      const i = indices[a];
      const j = indices[b];
      if (hierarchyDistance(character, i, j) <= ADJACENT_STEPS) continue;
      pairs.push([i, j]);
    }
  }

  const probes = new Map();
  for (const joint of capsules.keys()) probes.set(joint, probesFor(verts, joint));

  const restMatrices = skinningMatrices(character, worldMatrices(character));
  const restDepth = new Map();
  for (const [i, j] of pairs) {
    restDepth.set(`${i}>${j}`, buriedShare(capsules, probes, restMatrices, i, j));
    restDepth.set(`${j}>${i}`, buriedShare(capsules, probes, restMatrices, j, i));
  }

  let worst = null;
  let frames = 0;
  for (const action of [...ACTIONS, ...EMOTIONS.map((e) => `emotion.${e}`)]) {
    const clip = clipFor(library, action, id);
    const times = library.times(clip);
    if (times.length === 0) {
      failures.push(`${id}: clip "${clip}" has no frames — nothing was played.`);
      continue;
    }
    for (const time of times) {
      frames++;
      const overrides = overridesFor(character, library.deltasAt(clip, time));
      const matrices = skinningMatrices(character, worldMatrices(character, overrides));
      for (const [i, j] of pairs) {
        /*
         * Only ever SMALL part into LARGE one. Depth is a share of the target's
         * radius, so a thin target makes anything that grazes it read as buried:
         * an arm swung past a head put "Head 97% inside RightArm" on Zara's
         * `celebrate`, which is an arm beside a head and nothing else. A part
         * can only be swallowed by something bigger than itself, and that is
         * also the only direction the question was ever asked in — a hand
         * inside a torso, not a torso inside a hand.
         */
        for (const [from, into] of [[i, j], [j, i]]) {
          if (!MAY_ENTER[classOf(capsules.get(from).name)]?.has(classOf(capsules.get(into).name))) continue;
          if (capsules.get(into).radius <= capsules.get(from).radius * FATTER_BY) continue;
          const depth = buriedShare(capsules, probes, matrices, from, into);
          const share = depth - restDepth.get(`${from}>${into}`);
          if (share <= 0) continue;
          if (!worst || share > worst.share) {
            worst = { share, clip, time, a: capsules.get(from).name, b: capsules.get(into).name };
          }
        }
      }
    }
  }

  rows.push({ id, capsules: capsules.size, pairs: pairs.length, frames, worst });
  if (worst && worst.share > MAX_BURIED_SHARE) {
    failures.push(
      `${id}: ${(worst.share * 100).toFixed(0)}% of ${worst.a} is buried inside ${worst.b} `
      + `beyond what rests there, during "${worst.clip}" at t=${worst.time.toFixed(2)} `
      + `(max ${(MAX_BURIED_SHARE * 100).toFixed(0)}%).`,
    );
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

if (!existsSync(LIBRARY)) {
  console.error('verify-clearance: CANNOT RUN — no clip library, so nothing was played.');
  console.error(`  ${LIBRARY} is a gitignored build output. Run: npm run assets:clips`);
  console.error('  Exiting NON-ZERO on purpose: a skip must never read as a pass.');
  process.exit(1);
}
const missing = Object.values(BIPEDS)
  .map((file) => resolve(SOURCE_DIR, `${file}.glb`))
  .filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error('verify-clearance: CANNOT RUN — the source exports are not present.');
  console.error(`  /glb/ lives outside the repo by design. Missing: ${missing.length} file(s).`);
  console.error('  This is a LOCAL gate; it is not part of CI and never reports success on an empty run.');
  process.exit(1);
}

const library = await readClipLibrary(LIBRARY);
for (const [id, file] of Object.entries(BIPEDS)) await checkCharacter(id, file, library);

console.log('verify-clearance: every frame of every clip, each part probed against every other\n');
console.log('  character     parts  pairs  frames   deepest intrusion');
for (const r of rows) {
  const worst = r.worst
    ? `${(r.worst.share * 100).toFixed(0)}% of ${r.worst.a} in ${r.worst.b} (${r.worst.clip} t=${r.worst.time.toFixed(2)})`
    : 'none — nothing ever entered anything';
  console.log(
    `  ${r.id.padEnd(9)} ${String(r.capsules).padStart(8)} ${String(r.pairs).padStart(6)} `
    + `${String(r.frames).padStart(7)}   ${worst}`,
  );
}

if (failures.length > 0) {
  console.error(`\nverify-clearance: FAILED — ${failures.length} problem(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log('\nverify-clearance OK — no clip drives any body part into another');
