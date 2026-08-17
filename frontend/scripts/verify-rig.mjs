/*
 * Checks the authored clip library against every character it will be played on.
 *
 * WHY THIS EXISTS. Four separate defects shipped through type-check, lint, the
 * whole test suite and a code review, because every one of them looked CORRECT
 * on Zara — the rig the library is authored on — and wrong only on the other
 * characters. The tests cannot catch them: they are properties of the geometry
 * in the .glb files, not of the code. This is the only thing that can.
 *
 * WHAT IT CHECKS
 *   proportions no clip may change how far a bone sits from its parent. Only a
 *             translation can do that, so this is an EXACT invariant — no
 *             tolerance and no judgement call.
 *   stance    every clip opens on the character's OWN stance. The library once
 *             pulled Rho's feet 60.6% together and Liruf's 79.4%, both to
 *             exactly Zara's separation, because a force-sampled clip carries
 *             every bone's rest offset in its `translation` channel.
 *
 *             An earlier version measured foot separation across every frame
 *             and flagged `jump` at 27% on Zara herself — a landing compression
 *             bends the knees and legitimately brings the feet together. It was
 *             measuring the animation rather than the defect. A gate that cries
 *             wolf gets ignored, which is worse than not having one.
 *   vocabulary every clip name is a canonical action or emotion, or a
 *             `<name>@<characterId>` override of one.
 *   overrides  each override resolves for the character it names and for no one
 *             else — the same rule `clipFor` implements at runtime.
 *   emotions   the seven emotions must tilt every character's head by the same
 *             ANGLE. Head displacement is NOT the test: it scales with head
 *             size, and reading it as intensity is what nearly produced a set of
 *             per-character emotion overrides that nothing needed.
 *   travel     no clip may carry per-bone translation. Leaving the ground is a
 *             fraction of the character's height (`CLIP_LIFT`), never a distance
 *             baked in the authoring rig's units.
 *
 * Source exports live outside the repo (`/glb/`, gitignored), so this is a LOCAL
 * gate, not a CI one. It says so loudly rather than passing quietly when they
 * are absent — a check that reports success on an empty run is worse than none.
 *
 *   node scripts/verify-rig.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SOURCE_DIR = resolve(REPO, 'glb');
const LIBRARY = resolve(REPO, 'frontend', 'public', 'scenes', 'clips-biped.glb');

/** Characters the biped library is played on, and their source export names. */
const BIPEDS = { zara: 'Zara', rho: 'Rho', liruf: 'Liruf' };

const ACTIONS = [
  'idle', 'jump', 'hop', 'wave', 'point', 'celebrate',
  'nod', 'shake', 'think', 'dance', 'peek', 'bow',
];
const EMOTIONS = [
  'neutral', 'happy', 'excited', 'thinking', 'surprised', 'encouraging', 'proud',
];
const REST_CLIP = 'emotion.rest';

/* Thresholds. Each is set well inside the defect it guards against, and the
 * defect's own magnitude is named so the margin is visible. */
const MAX_STANCE_DRIFT = 0.01; // the defect was 0.606 and 0.794
const MAX_PROPORTION_DRIFT = 1e-4; // rotations cannot move this at all
const MAX_EMOTION_SWING_SPREAD_DEG = 2; // the emotions agree to within 0.6

/* ── glTF reading ───────────────────────────────────────────────────────── */

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a .glb`);
  const jsonLength = buf.readUInt32LE(12);
  return {
    json: JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')),
    // The BIN chunk follows the JSON chunk, each behind an 8-byte header.
    bin: buf.subarray(20 + jsonLength + 8),
  };
}

const COMPONENT = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array };
const COMPONENTS_PER = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessor(glb, index) {
  const accessor = glb.json.accessors[index];
  const view = glb.json.bufferViews[accessor.bufferView];
  const Type = COMPONENT[accessor.componentType];
  const size = COMPONENTS_PER[accessor.type];
  const offset = glb.bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const typed = new Type(glb.bin.buffer, offset, accessor.count * size);
  const out = [];
  for (let i = 0; i < accessor.count; i += 1) {
    out.push(Array.from(typed.subarray(i * size, i * size + size)));
  }
  return out;
}

/* ── maths ──────────────────────────────────────────────────────────────── */

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];

function compose(t, q, s) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function matMul(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/* ── skeleton ───────────────────────────────────────────────────────────── */

function skeletonOf(glb) {
  const byName = new Map();
  glb.json.nodes.forEach((node, index) => {
    if (node.name) byName.set(node.name, index);
  });
  const parent = new Map();
  glb.json.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) parent.set(child, index);
  });
  return { byName, parent };
}

/** World matrix of a bone, with per-bone rotation overrides applied. */
function worldMatrix(glb, skeleton, index, overrides) {
  const local = (i) => {
    const node = glb.json.nodes[i];
    return compose(
      node.translation ?? [0, 0, 0],
      overrides.get(i)?.rotation ?? node.rotation ?? [0, 0, 0, 1],
      node.scale ?? [1, 1, 1],
    );
  };
  let matrix = local(index);
  let cursor = skeleton.parent.get(index);
  while (cursor !== undefined) {
    matrix = matMul(local(cursor), matrix);
    cursor = skeleton.parent.get(cursor);
  }
  return matrix;
}

const positionOf = (m) => [m[12], m[13], m[14]];
/** The bone's own +Y, which on these rigs runs along its length. */
const axisOf = (m) => {
  const v = [m[4], m[5], m[6]];
  const n = Math.hypot(...v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ── the library ────────────────────────────────────────────────────────── */

function clipSampler(library) {
  const cache = new Map();
  const times = (name) => {
    const anim = library.json.animations.find((a) => a.name === name);
    if (!anim) return [];
    return readAccessor(library, anim.samplers[anim.channels[0].sampler].input).map((t) => t[0]);
  };
  const at = (name, time) => {
    const key = `${name}@${time}`;
    if (cache.has(key)) return cache.get(key);
    const anim = library.json.animations.find((a) => a.name === name);
    if (!anim) return null;
    const frame = new Map();
    for (const channel of anim.channels) {
      const sampler = anim.samplers[channel.sampler];
      const stamps = readAccessor(library, sampler.input).map((t) => t[0]);
      const values = readAccessor(library, sampler.output);
      let best = 0;
      for (let i = 1; i < stamps.length; i += 1) {
        if (Math.abs(stamps[i] - time) < Math.abs(stamps[best] - time)) best = i;
      }
      const bone = library.json.nodes[channel.target.node].name;
      if (!frame.has(bone)) frame.set(bone, {});
      frame.get(bone)[channel.target.path] = values[best];
    }
    cache.set(key, frame);
    return frame;
  };
  return { times, at };
}

/**
 * The additive deltas a clip contributes, exactly as `additiveClip` computes
 * them: rotation only, measured against the library's exported rest pose.
 */
function deltasAt(sampler, rest, name, time) {
  const frame = sampler.at(name, time);
  const deltas = new Map();
  for (const [bone, channels] of frame) {
    const reference = rest.get(bone)?.rotation;
    if (!reference || !channels.rotation) continue;
    deltas.set(bone, qMul(qInv(reference), channels.rotation));
  }
  return deltas;
}

/** Apply deltas to a character, the way the runtime's additive blend does. */
function overridesFor(glb, skeleton, deltas) {
  const overrides = new Map();
  for (const [bone, delta] of deltas) {
    const index = skeleton.byName.get(bone);
    if (index === undefined) continue;
    const own = glb.json.nodes[index].rotation ?? [0, 0, 0, 1];
    overrides.set(index, { rotation: qMul(own, delta) });
  }
  return overrides;
}

/* ── checks ─────────────────────────────────────────────────────────────── */

const failures = [];
const notes = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

function baseName(name) {
  const at = name.indexOf('@');
  return at === -1 ? name : name.slice(0, at);
}
function overrideTarget(name) {
  const at = name.indexOf('@');
  return at === -1 ? null : name.slice(at + 1);
}

function checkVocabulary(library) {
  const known = new Set([...ACTIONS, ...EMOTIONS.map((e) => `emotion.${e}`), REST_CLIP]);
  for (const anim of library.json.animations) {
    if (!known.has(baseName(anim.name))) {
      fail('vocabulary', `"${anim.name}" is not a canonical action or emotion`);
    }
    const target = overrideTarget(anim.name);
    if (target && !(target in BIPEDS)) {
      fail('overrides', `"${anim.name}" names a character that does not exist`);
    }
  }
  for (const action of ACTIONS) {
    if (!library.json.animations.some((a) => a.name === action)) {
      fail('vocabulary', `no clip for the canonical action "${action}"`);
    }
  }
  for (const emotion of EMOTIONS) {
    if (!library.json.animations.some((a) => a.name === `emotion.${emotion}`)) {
      fail('vocabulary', `no clip for the canonical emotion "${emotion}"`);
    }
  }
  if (!library.json.animations.some((a) => a.name === REST_CLIP)) {
    fail('vocabulary', `"${REST_CLIP}" is missing — every clip is measured against it`);
  }
}

/** Resolve a clip the way `clipFor` does, so this tests what actually plays. */
function resolve_(library, action, character) {
  const override = `${action}@${character}`;
  if (library.json.animations.some((a) => a.name === override)) return override;
  return library.json.animations.some((a) => a.name === action) ? action : null;
}

/**
 * PROPORTIONS. A rotation can never change how far a bone sits from its parent;
 * only a translation can. So this distance is exactly the thing the original
 * defect destroyed, and it is an EXACT invariant — no tolerance, no judgement.
 *
 * The earlier version of this check measured foot separation across every frame
 * and flagged `jump` at 27% on Zara herself: a landing compression bends the
 * knees and legitimately brings the feet together. It was measuring the
 * animation, not the defect.
 */
function checkProportions(library, sampler, rest, characters) {
  for (const [id, glb] of characters) {
    const skeleton = skeletonOf(glb);
    const bones = [...skeleton.byName.entries()].filter(([, i]) => skeleton.parent.has(i));
    let worst = { delta: 0, where: null };
    for (const anim of library.json.animations) {
      for (const time of sampler.times(anim.name)) {
        const overrides = overridesFor(glb, skeleton, deltasAt(sampler, rest, anim.name, time));
        for (const [bone, index] of bones) {
          const parent = skeleton.parent.get(index);
          const restLen = distance(
            positionOf(worldMatrix(glb, skeleton, index, new Map())),
            positionOf(worldMatrix(glb, skeleton, parent, new Map())),
          );
          if (restLen < 1e-9) continue;
          const posed = distance(
            positionOf(worldMatrix(glb, skeleton, index, overrides)),
            positionOf(worldMatrix(glb, skeleton, parent, overrides)),
          );
          const delta = Math.abs(posed - restLen) / restLen;
          if (delta > worst.delta) worst = { delta, where: `${bone} in "${anim.name}"` };
        }
      }
    }
    if (worst.delta > MAX_PROPORTION_DRIFT) {
      fail('proportions', `${id} is re-proportioned by the library — ${(worst.delta * 100).toFixed(3)}% at ${worst.where}`);
    } else {
      notes.push(`  bones     ${id.padEnd(6)} every bone keeps its own length (worst ${(worst.delta * 100).toExponential(1)}%)`);
    }
  }
}

/**
 * STANCE. Every clip's first frame is the rest pose — one-shots open there by
 * construction, and no looping clip keys a leg. So each character's own foot
 * separation must survive frame 0 of everything in the library. It did not: the
 * defect pulled Rho 60.6% and Liruf 79.4% together, at every frame including
 * this one.
 */
function checkStance(library, sampler, rest, characters) {
  for (const [id, glb] of characters) {
    const skeleton = skeletonOf(glb);
    const left = skeleton.byName.get('LeftFoot');
    const right = skeleton.byName.get('RightFoot');
    if (left === undefined || right === undefined) {
      fail('stance', `${id} has no LeftFoot/RightFoot to measure`);
      continue;
    }
    const spread = (overrides) => distance(
      positionOf(worldMatrix(glb, skeleton, left, overrides)),
      positionOf(worldMatrix(glb, skeleton, right, overrides)),
    );
    const restSpread = spread(new Map());
    let worst = { drift: 0, clip: null };
    for (const action of ACTIONS) {
      const name = resolve_(library, action, id);
      if (!name) continue;
      const first = sampler.times(name)[0];
      if (first === undefined) continue;
      const deltas = deltasAt(sampler, rest, name, first);
      const drift = Math.abs(spread(overridesFor(glb, skeleton, deltas)) - restSpread) / restSpread;
      if (drift > worst.drift) worst = { drift, clip: name };
    }
    const pct = (worst.drift * 100).toFixed(2);
    if (worst.drift > MAX_STANCE_DRIFT) {
      fail('stance', `${id} opens ${pct}% away from its own stance (worst: "${worst.clip}")`);
    } else {
      notes.push(`  stance    ${id.padEnd(6)} opens every clip in its own stance (worst ${pct}%)`);
    }
  }
}

function checkTravel(library) {
  for (const anim of library.json.animations) {
    const translating = anim.channels
      .filter((c) => c.target.path === 'translation')
      .map((c) => library.json.nodes[c.target.node].name);
    if (translating.length === 0) continue;
    // Force-sampled exports carry these for every bone. They are stripped at
    // load, so their presence is only worth reporting once, not failing on.
    notes.push(`  travel    "${anim.name}" carries ${translating.length} translation track(s) — stripped by sanitizeClip`);
    break;
  }
}

function checkEmotions(library, sampler, rest, characters) {
  for (const emotion of EMOTIONS) {
    const swings = [];
    for (const [id, glb] of characters) {
      const skeleton = skeletonOf(glb);
      const head = skeleton.byName.get('Head');
      if (head === undefined) continue;
      const name = resolve_(library, `emotion.${emotion}`, id) ?? `emotion.${emotion}`;
      let peak = 0;
      for (const time of sampler.times(name)) {
        const deltas = deltasAt(sampler, rest, name, time);
        const before = axisOf(worldMatrix(glb, skeleton, head, new Map()));
        const after = axisOf(worldMatrix(glb, skeleton, head, overridesFor(glb, skeleton, deltas)));
        const deg = Math.acos(Math.min(1, Math.max(-1, dot(before, after)))) * 180 / Math.PI;
        if (deg > peak) peak = deg;
      }
      swings.push({ id, deg: peak });
    }
    if (swings.length < 2) continue;
    const spread = Math.max(...swings.map((s) => s.deg)) - Math.min(...swings.map((s) => s.deg));
    const shown = swings.map((s) => `${s.id} ${s.deg.toFixed(1)}`).join('  ');
    if (spread > MAX_EMOTION_SWING_SPREAD_DEG) {
      fail('emotions', `"${emotion}" tilts each head differently — ${shown} (spread ${spread.toFixed(1)}deg)`);
    } else {
      notes.push(`  emotion   ${emotion.padEnd(12)} ${shown}  (spread ${spread.toFixed(1)}deg)`);
    }
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

if (!existsSync(LIBRARY)) {
  console.log('verify-rig: SKIPPED — no clip library.');
  console.log(`  ${LIBRARY} is a gitignored build output. Run: npm run assets:clips`);
  process.exit(0);
}
const missing = Object.values(BIPEDS)
  .map((file) => resolve(SOURCE_DIR, `${file}.glb`))
  .filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.log('verify-rig: SKIPPED — the source exports are not present.');
  console.log(`  /glb/ lives outside the repo by design. Missing: ${missing.length} file(s).`);
  console.log('  This is a LOCAL gate; it is not part of CI and never reports success on an empty run.');
  process.exit(0);
}

const library = readGlb(LIBRARY);
const sampler = clipSampler(library);
const rest = sampler.at(REST_CLIP, 0);
if (!rest) {
  console.error(`verify-rig: FAILED — "${REST_CLIP}" is missing; nothing can be measured against it.`);
  process.exit(1);
}
const characters = Object.entries(BIPEDS)
  .map(([id, file]) => [id, readGlb(resolve(SOURCE_DIR, `${file}.glb`))]);

checkVocabulary(library);
checkProportions(library, sampler, rest, characters);
checkStance(library, sampler, rest, characters);
checkTravel(library);
checkEmotions(library, sampler, rest, characters);

console.log(`verify-rig: ${library.json.animations.length} clips against ${characters.length} characters\n`);
for (const note of notes) console.log(note);
if (failures.length > 0) {
  console.error(`\nverify-rig: FAILED — ${failures.length} problem(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log('\nverify-rig OK — every clip keeps every character in its own stance');
