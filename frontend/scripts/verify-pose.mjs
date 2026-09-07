/*
 * Plays every authored clip on every character and asserts that none of them
 * DEFORMS the mesh — no stretched sheets, no crushed joints, no folds.
 *
 * WHY THIS EXISTS, and why it is not `verify-skin`. `verify-skin` measures ONE
 * synthetic pose: both arms up 120 degrees. That is enough to catch a weld,
 * because a weld is a property of the mesh that any large arm movement exposes.
 * It says nothing about the poses the product actually plays. `verify-rig`
 * plays all of them but reasons only about BONES, so between the two there was
 * a real gap: a clip could crush a shoulder or fold a knee on one character and
 * every gate would stay green.
 *
 * This closes it by playing the real library — all 23 clips, resolved through
 * the same `<action>@<id>` override rule the runtime uses — and skinning the
 * mesh at sampled frames.
 *
 * WHAT IT MEASURES, and why two directions rather than one:
 *
 *   stretch   triangles that blow up in area. This is the signature of geometry
 *             being pulled between two parts that are moving apart — the
 *             welded sheet in TUTOR_3D.md §4.2a, and the far worse version you
 *             get from cleaning skin weights while leaving the weld standing.
 *   collapse  triangles crushed to nothing. This is the OPPOSITE failure and a
 *             stretch check cannot see it: a joint that pinches shut, an elbow
 *             that folds through itself, a hand that inverts. Area ratio near
 *             zero is what that looks like numerically.
 *
 * Both are measured as FRACTIONS of the mesh, never as a maximum. `verify-skin`
 * learned that the hard way: its first version failed ZARA, the clean control,
 * on one x130 triangle that turned out to be armpit skin genuinely stretching
 * at 120 degrees. A maximum cannot tell anatomy from a defect; a fraction can,
 * because real damage shows up in dozens of triangles at once.
 *
 * FRAMES ARE SAMPLED, NOT EXHAUSTIVE. Zara is 131,506 vertices and the library
 * holds ~1,200 frames; skinning all of them for all three characters is minutes
 * of work for a local gate. `SAMPLES_PER_CLIP` evenly spaced frames, endpoints
 * always included, is what this checks. The extremes of a clip are where a
 * deformation defect lives, and the endpoints are always among them.
 *
 * Source exports live outside the repo (`/glb/`), so this is a LOCAL gate. It
 * exits non-zero rather than passing quietly when they are absent.
 *
 *   node scripts/verify-pose.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS, EMOTIONS, clipFor, readCharacter, readClipLibrary, readVertices,
  overridesFor, skinVertices, skinningMatrices, triangleArea, worldMatrices, dist,
} from './lib/skin.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SOURCE_DIR = resolve(REPO, 'glb');
const LIBRARY = resolve(REPO, 'frontend', 'public', 'scenes', 'clips-biped.glb');

const BIPEDS = { zara: 'Zara', rho: 'Rho', liruf: 'Liruf' };

/** Evenly spaced frames per clip, endpoints included. */
const SAMPLES_PER_CLIP = 21;

/* Thresholds. Each names the defect it guards against so the margin is visible.
 * They are set from the repaired characters' own measured worst clip, with room
 * above it, not from a number somebody liked. */
const STRETCH_RATIO = 2; // double area
const COLLAPSE_RATIO = 0.1; // crushed to a tenth
const MAX_STRETCH_FRACTION = 0.02; // the welded Rho reached 0.0653 at 120 degrees
const MAX_COLLAPSE_FRACTION = 0.02;
const MAX_EDGE_STRETCH_FRACTION = 0.02; // an edge at 3x its rest length
const EDGE_STRETCH = 3;

const failures = [];
const rows = [];

function sampleTimes(times) {
  if (times.length <= SAMPLES_PER_CLIP) return times;
  const out = [];
  for (let i = 0; i < SAMPLES_PER_CLIP; i++) {
    out.push(times[Math.round((i * (times.length - 1)) / (SAMPLES_PER_CLIP - 1))]);
  }
  return [...new Set(out)];
}

function measure(rest, posed, tris, restAreas, restEdges) {
  let stretched = 0;
  let collapsed = 0;
  let edgeStretched = 0;
  let measured = 0;
  let worst = 0;
  for (let t = 0; t < tris.length; t++) {
    const a0 = restAreas[t];
    if (a0 < 1e-12) continue;
    const [a, b, c] = tris[t];
    const ratio = triangleArea(posed[a], posed[b], posed[c]) / a0;
    measured++;
    if (ratio > STRETCH_RATIO) stretched++;
    if (ratio < COLLAPSE_RATIO) collapsed++;
    if (ratio > worst) worst = ratio;
    const e0 = restEdges[t];
    if (e0 > 1e-9 && dist(posed[a], posed[b]) / e0 > EDGE_STRETCH) edgeStretched++;
  }
  return {
    measured,
    stretch: measured ? stretched / measured : 0,
    collapse: measured ? collapsed / measured : 0,
    edge: measured ? edgeStretched / measured : 0,
    worst,
  };
}

async function checkCharacter(id, file, library) {
  const character = await readCharacter(resolve(SOURCE_DIR, `${file}.glb`));
  const { verts, tris } = readVertices(character);

  const restWorld = worldMatrices(character);
  const rest = skinVertices(skinningMatrices(character, restWorld), verts);
  const restAreas = tris.map(([a, b, c]) => triangleArea(rest[a], rest[b], rest[c]));
  const restEdges = tris.map(([a, b]) => dist(rest[a], rest[b]));

  let worstClip = null;
  for (const action of [...ACTIONS, ...EMOTIONS.map((e) => `emotion.${e}`)]) {
    const clip = clipFor(library, action, id);
    const times = library.times(clip);
    if (times.length === 0) {
      failures.push(`${id}: clip "${clip}" has no frames — nothing was played.`);
      continue;
    }
    for (const time of sampleTimes(times)) {
      const overrides = overridesFor(character, library.deltasAt(clip, time));
      const posed = skinVertices(
        skinningMatrices(character, worldMatrices(character, overrides)),
        verts,
      );
      const m = measure(rest, posed, tris, restAreas, restEdges);
      const severity = Math.max(m.stretch, m.collapse, m.edge);
      if (!worstClip || severity > worstClip.severity) {
        worstClip = { clip, time, severity, ...m };
      }
    }
  }

  rows.push({ id, tris: tris.length, ...worstClip });
  const at = `worst at "${worstClip.clip}" t=${worstClip.time.toFixed(2)}`;
  if (worstClip.stretch > MAX_STRETCH_FRACTION) {
    failures.push(`${id}: ${(worstClip.stretch * 100).toFixed(2)}% of triangles more than double in area — ${at} (max ${(MAX_STRETCH_FRACTION * 100).toFixed(2)}%).`);
  }
  if (worstClip.collapse > MAX_COLLAPSE_FRACTION) {
    failures.push(`${id}: ${(worstClip.collapse * 100).toFixed(2)}% of triangles crushed below a tenth of their area — ${at} (max ${(MAX_COLLAPSE_FRACTION * 100).toFixed(2)}%).`);
  }
  if (worstClip.edge > MAX_EDGE_STRETCH_FRACTION) {
    failures.push(`${id}: ${(worstClip.edge * 100).toFixed(2)}% of edges stretched past x${EDGE_STRETCH} — ${at} (max ${(MAX_EDGE_STRETCH_FRACTION * 100).toFixed(2)}%).`);
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

if (!existsSync(LIBRARY)) {
  console.error('verify-pose: CANNOT RUN — no clip library, so nothing was played.');
  console.error(`  ${LIBRARY} is a gitignored build output. Run: npm run assets:clips`);
  console.error('  Exiting NON-ZERO on purpose: a skip must never read as a pass.');
  process.exit(1);
}
const missing = Object.values(BIPEDS)
  .map((file) => resolve(SOURCE_DIR, `${file}.glb`))
  .filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error('verify-pose: CANNOT RUN — the source exports are not present.');
  console.error(`  /glb/ lives outside the repo by design. Missing: ${missing.length} file(s).`);
  console.error('  This is a LOCAL gate; it is not part of CI and never reports success on an empty run.');
  process.exit(1);
}

const library = await readClipLibrary(LIBRARY);
for (const [id, file] of Object.entries(BIPEDS)) await checkCharacter(id, file, library);

console.log(
  `verify-pose: ${ACTIONS.length + EMOTIONS.length} actions/emotions on ${rows.length} characters, `
  + `${SAMPLES_PER_CLIP} frames each\n`,
);
console.log('  character   tris    stretch  collapse   edge>3x   worst   at');
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(10)} ${String(r.tris).padStart(6)}  ${(r.stretch * 100).toFixed(2).padStart(7)}%`
    + `  ${(r.collapse * 100).toFixed(2).padStart(7)}%  ${(r.edge * 100).toFixed(2).padStart(7)}%`
    + `  x${r.worst.toFixed(1).padStart(5)}   ${r.clip} t=${r.time.toFixed(2)}`,
  );
}

if (failures.length > 0) {
  console.error(`\nverify-pose: FAILED — ${failures.length} problem(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log('\nverify-pose OK — no authored clip stretches, crushes or folds any character');
