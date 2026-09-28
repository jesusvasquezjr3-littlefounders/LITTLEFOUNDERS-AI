/*
 * verify-placement — where does the solver actually put the cast, on every
 * island, for every pairing? Headless, in seconds, with no browser.
 *
 * WHY THIS EXISTS. The placement solver was verified by looking at the product,
 * and looking is exactly what nobody does often enough: `diorama-b` put its
 * ENTIRE CAST inside the pond, and the only reason it was caught is that
 * somebody finally photographed the second island with people standing on it.
 * Numbers had been consulted and had said the opposite — that diorama-b was the
 * roomy one and therefore the answer to Dina's size. She fits, and she stands
 * in the water.
 *
 * So this runs the REAL `findStandingSpots` (imported, never reimplemented — a
 * copy would drift from the thing it certifies) against the REAL island meshes,
 * and reports what a character standing on each chosen spot would be standing
 * ON: the surface colour sampled from the island's own base texture at the hit
 * UV, the height, and whether the footprint stays inside the rim.
 *
 * The colour classifier here is for REPORTING ONLY and must never become the
 * placement rule: "blue means water" is true of these two dioramas and is not a
 * fact about the world. Placement decides from the walkability mask that the
 * asset pipeline bakes; this script's job is to tell a human whether that mask
 * is doing its job, in terms a human can check against a screenshot.
 *
 * IT ALSO CHECKS WHICH WAY THEY ARE TURNED, added 2026-08-22, and that half was
 * missing for as long as the script existed. Every character stood on walkable
 * ground, inside the rim, at a sensible separation — and three of the four
 * personalization candidates stood with their BACKS to the learner, on the one
 * screen whose whole job is choosing a tutor by looking at them. Being in the
 * right PLACE and being turned the right WAY are two facts, and a gate that
 * only knows the first will keep reporting OK through the second.
 *
 * AND IT CHECKS WHERE THEIR FEET GO, added 2026-08-22 for the same reason: a
 * third fact the gate did not know. It certified the audition, and it certified
 * lead+companion pairs, and it never certified a character who is BOTH — which
 * is the one configuration that broke. Inviting Dina to stay while she was also
 * an audition candidate put her feet 12.24 m under the island and stretched her
 * contact shadow to 221 m across, covering the canvas; changing the island from
 * there collapsed the camera to a 70 px speck. Nothing about the PLACEMENT was
 * wrong — every spot was walkable, inside the rim and correctly turned — so a
 * gate that only asked about placement reported OK straight through it. The two
 * new sections below ask the other two questions: does the cast depend on the
 * pairing (it must not), and does a character's footing depend on how they were
 * mounted (it must not).
 *
 * AND IT CHECKS THE STALL, added 2026-09-03 for Class III / S18 `props` — the
 * first object on this island that is neither a character nor the camera.
 * `findPropSpot`/`excludingProp` (imported from `propPlacement.ts`, same "a
 * copy would drift" reasoning as every other import here) are the real
 * mechanism `TutorScene.tsx` uses to keep a character from being solved
 * inside the stall's own footprint, and that mechanism does NOT fall out of
 * the character checks above for free — this file certified placement for
 * three sprints without ever putting a second object on the island for a
 * character to avoid.
 *
 * Usage:  npm run verify:placement
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vector3,
} from 'three';
import {
  AUDITION_GROUPING,
  AUDITION_NARROW_WEIGHT,
  AUDITION_RINGS,
  AUDITION_SAMPLES_PER_METRE,
  findStandingSpots,
} from '../src/tutor-scene/standingSpots.js';
import { MAX_OFF_VIEWER, offViewer, solveFacings } from '../src/tutor-scene/facing.js';
import { STAGE_BEARING } from '../src/tutor-scene/shots.js';
import type { CharacterId } from '../src/components/characters/control/types.js';

/*
 * MEASUREMENTS, not assets. `assets.ts` resolves URLs through
 * `import.meta.env`, which exists only under Vite, so importing it here would
 * make this script un-runnable outside a bundler for no reason: nothing below
 * needs a URL, only heights and footprints.
 */
import {
  castClearanceM,
  castSeparationM,
  characterScale,
  pairSeparationM,
  CHARACTER_MEASUREMENTS,
  characterFootprintM,
  SCENE_MEASUREMENTS,
  sceneScale,
  type SceneMeasurement,
} from '../src/tutor-scene/measurements.js';
import { standingCast } from '../src/tutor-scene/cast.js';
import { corridorClear, stageOcclusions, type RayHit } from '../src/tutor-scene/occlusion.js';
import { modelFooting } from '../src/tutor-scene/modelBounds.js';
import { walkabilityFor } from '../src/tutor-scene/walkability.js';
import {
  excludingProp,
  excludingProps,
  findPropSpot,
  findPropSpots,
  PROP_CLEARANCE_M,
  STALL_CLEARANCE_M,
} from '../src/tutor-scene/propPlacement.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, '..', 'public', 'scenes');

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

type Rgb = [number, number, number];

interface Surface {
  mesh: Mesh;
  /** Base-colour texel lookup by UV, or null when the island ships no texture. */
  sample: ((u: number, v: number) => Rgb) | null;
}

/**
 * Builds a three.js mesh of the island positioned EXACTLY as `Diorama.tsx`
 * positions it: scaled by `sceneScale`, centred on the origin in XZ, underside
 * resting on y=0.
 *
 * Every one of those three must match, and the first draft of this script got
 * the first one wrong — it scaled by the MEASURED span instead of the stored
 * `sourceWidthM`, which differ by 5% on diorama-b because the span includes the
 * palm fronds. A harness that does not reproduce the product does not certify
 * the product; it certifies a slightly different island and reports the good
 * news confidently.
 */
async function loadIsland(file: string, measurement: SceneMeasurement): Promise<Surface> {
  const doc: Document = await io.read(file);
  const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

  const position = prim.getAttribute('POSITION')!;
  const uv = prim.getAttribute('TEXCOORD_0');
  const indices = prim.getIndices();

  const positions = new Float32Array(position.getCount() * 3);
  const scratch = [0, 0, 0];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, scratch);
    positions[i * 3] = scratch[0]!;
    positions[i * 3 + 1] = scratch[1]!;
    positions[i * 3 + 2] = scratch[2]!;
    minX = Math.min(minX, scratch[0]!);
    maxX = Math.max(maxX, scratch[0]!);
    minZ = Math.min(minZ, scratch[2]!);
    maxZ = Math.max(maxZ, scratch[2]!);
  }
  const scale = sceneScale(measurement);
  for (let i = 0; i < positions.length; i += 1) positions[i]! *= scale;

  /*
   * The same recentring `Diorama.tsx` applies: both exports sit below y=0 and
   * neither is centred on the origin, so the component measures the bounds and
   * moves the island rather than asking for a re-export with a fixed pivot.
   */
  let sminX = Infinity, smaxX = -Infinity, sminY = Infinity, sminZ = Infinity, smaxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    sminX = Math.min(sminX, positions[i]!); smaxX = Math.max(smaxX, positions[i]!);
    sminY = Math.min(sminY, positions[i + 1]!);
    sminZ = Math.min(sminZ, positions[i + 2]!); smaxZ = Math.max(smaxZ, positions[i + 2]!);
  }
  const offsetX = -(sminX + smaxX) / 2;
  const offsetZ = -(sminZ + smaxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]! += offsetX;
    positions[i + 1]! -= sminY;
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

  let sample: Surface['sample'] = null;
  const image = prim.getMaterial()?.getBaseColorTexture()?.getImage();
  if (image) {
    const { data, info } = await sharp(Buffer.from(image))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    sample = (u, v) => {
      const wrap = (x: number) => ((x % 1) + 1) % 1;
      const x = Math.min(info.width - 1, Math.floor(wrap(u) * info.width));
      const y = Math.min(info.height - 1, Math.floor(wrap(v) * info.height));
      const o = (y * info.width + x) * info.channels;
      return [data[o]!, data[o + 1]!, data[o + 2]!];
    };
  }

  return { mesh, sample };
}

/** Human-readable guess at what a texel is. Reporting only — see the header. */
function describe(rgb: Rgb | null): string {
  if (!rgb) return 'unknown';
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  /*
   * Teal, not blue: the pond texels measure rgb(16,150,155) — red-starved with
   * green and blue both high. A first pass asked for "blue dominant" and
   * labelled that water as sand/earth, which would have quietly reported the
   * pond spots as fine.
   */
  if (b > r + 40 && b > 90) return 'WATER?';
  if (g >= r - 10 && b < g - 40) return 'grass';
  if (max - min < 28) return 'rock/grey';
  return 'sand/earth';
}

const DOWN = new Vector3(0, -1, 0);

function surfaceAt(mesh: Mesh, x: number, z: number, from: number) {
  const raycaster = new Raycaster();
  raycaster.set(new Vector3(x, from, z), DOWN);
  return raycaster.intersectObject(mesh, true)[0] ?? null;
}

/** Every pairing the product can compose today. */
const PAIRINGS: Array<[CharacterId, CharacterId | null]> = [
  ['rho', 'liruf'],
  ['zara', 'liruf'],
  ['liruf', 'rho'],
  ['dina', 'liruf'],
  ['dina', null],
];

/**
 * The personalization audition: the WHOLE cast on the island at once.
 *
 * This is the case with no margin in it. A name plate hanging at a stage mark
 * used to label empty ground, because the scene only ever rendered the tutor
 * and their companion — so "choose by looking at them" was a menu with a 3D
 * background. Standing all four is what makes it true, and four characters
 * including a 2.83 m quadruped on a 6.5 m island is the placement problem this
 * whole solver exists for. If it cannot seat everybody, the plate for whoever
 * is left out is culled, and the learner is back to choosing from a list.
 */
const AUDITION: CharacterId[] = ['dina', 'liruf', 'rho', 'zara'];

/**
 * A stand-in for a character export, sized from its MEASURED extents.
 *
 * IT IS NOT THE .glb, AND THAT IS NOT A SHORTCUT — the shipped assets cannot
 * answer this question at all. Every character is meshopt-quantized
 * (KHR_mesh_quantization), so its POSITION accessor holds integers that only
 * become metres once the runtime dequantizes them, and every character is also
 * SKINNED, so the box that matters is the posed one rather than the bind-space
 * one. `npm run assets:inspect` says exactly that about these files — "world
 * size n/a — mesh is quantized; measure the source export instead" — and the
 * source exports are not in the repository. `CHARACTER_MEASUREMENTS` is where
 * those measurements were written down, and it is the same table the placement
 * solver separates the cast by, so it is the honest input here.
 *
 * Cross-checked against the live renderer on 2026-08-22: Dina's contact shadow
 * measures 3.25 m across in the browser, and 2 x 1.15 x half of
 * `characterFootprintM(dina)` is 3.251 m.
 *
 * What this DOES certify is the arithmetic between that table and the island —
 * feet, footprint and contact shadow, in both roles — which is what the
 * ship-blocker got wrong. That the measurement itself is parent-independent for
 * a real, skinned, nested model is certified separately and precisely by
 * `src/tutor-scene/modelBounds.test.ts`.
 */
function characterStandIn(who: CharacterId): Object3D {
  const measurement = CHARACTER_MEASUREMENTS[who];
  const half = measurement.sourceFootprintM / 2;
  const geometry = new BufferGeometry();
  // Resting on its own y=0, which is how these exports are authored and what
  // `footOffset` exists to stop being assumed.
  geometry.boundingBox = new Box3(
    new Vector3(-half, 0, -half),
    new Vector3(half, measurement.sourceHeightM, half),
  );
  const root = new Object3D();
  root.add(new Mesh(geometry, new MeshBasicMaterial()));
  return root;
}

let failures = 0;

for (const [id, asset] of Object.entries(SCENE_MEASUREMENTS)) {
  const island = await loadIsland(resolve(SCENES, `${id}.glb`), asset);
  const box = new Box3().setFromObject(island.mesh);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const radius = Math.max(size.x, size.z) / 2;
  const from = box.max.y + 1;

  console.log(`\n=== ${id} — ${asset.targetWidthM} m across (radius ${radius.toFixed(2)} m) ===`);

  /*
   * 08 §2 / §10 item 3: nothing decorative covers the lead's face or hands in
   * any stage shot. The island is the only occluder (one mesh), so this is a
   * raycast from each stage camera to the head and hands (`occlusion.ts`).
   */
  const shotScene = { centre: { x: centre.x, y: centre.y, z: centre.z }, size: { x: size.x, y: size.y, z: size.z } };
  const occluder = new Raycaster();
  const hitIsland: RayHit = (from, direction, far) => {
    occluder.set(new Vector3(from.x, from.y, from.z), new Vector3(direction.x, direction.y, direction.z));
    occluder.far = far;
    return occluder.intersectObject(island.mesh, false)[0]?.distance ?? null;
  };

  const runCast = (
    cast: readonly CharacterId[],
    label: string,
    audition = false,
    quiet = false,
  ): { seats: string; clearance: number; spots: ReturnType<typeof findStandingSpots> } => {
    const footprints = cast.map((who) => characterFootprintM(CHARACTER_MEASUREMENTS[who]));
    const minSeparation = castSeparationM(footprints);

    const spots = findStandingSpots(island.mesh, {
      count: cast.length,
      minSeparation,
      separationFor: (index, other) =>
        pairSeparationM(footprints[index] ?? 0, footprints[other] ?? 0),
      grouping: audition ? AUDITION_GROUPING : undefined,
      samplesPerMetre: audition ? AUDITION_SAMPLES_PER_METRE : undefined,
      rings: audition ? AUDITION_RINGS : undefined,
      narrowAxis: audition
        ? new Vector3(Math.cos(STAGE_BEARING), 0, -Math.sin(STAGE_BEARING))
        : undefined,
      narrowWeight: audition ? AUDITION_NARROW_WEIGHT : undefined,
      preferDirection: new Vector3(0.35, 0, 1),
      // The SAME wiring the product uses. A gate that exercises a different
      // configuration certifies a different product.
      isWalkable: walkabilityFor(id) ?? undefined,
      clearance: castClearanceM(footprints),
      // The same corridor gate the product applies to the lead (08 §2), outside an audition.
      leadCorridorClear: audition || !cast[0] ? undefined : (spot) => corridorClear(cast[0]!, spot, shotScene, hitIsland),
    });

    /*
     * Which way each of them ends up turned. The REAL rule, imported, for the
     * same reason the solver is: a copy here would certify a different product.
     */
    const facings = solveFacings(
      spots.map((spot) => ({ x: spot.x, z: spot.z })),
      STAGE_BEARING,
    );

    let closest = Infinity;
    for (let a = 0; a < spots.length; a += 1) {
      for (let b = a + 1; b < spots.length; b += 1) {
        closest = Math.min(closest, Math.hypot(spots[a]!.x - spots[b]!.x, spots[a]!.z - spots[b]!.z));
      }
    }
    if (!quiet) {
      console.log(
        `  ${label}  (min separation ${minSeparation.toFixed(2)} m` +
          `${Number.isFinite(closest) ? `, closest pair ${closest.toFixed(2)} m` : ''})`,
      );
    }

    /* Tightest rim clearance in this cast, for the sweep's summary line. */
    let tightest = Infinity;

    for (let i = 0; i < cast.length; i += 1) {
      const who = cast[i]!;
      const spot = spots[i];
      if (!spot) {
        console.log(`      ✗ ${label} — ${who.padEnd(6)} NO SPOT FOUND`);
        failures += 1;
        continue;
      }

      const hit = surfaceAt(island.mesh, spot.x, spot.z, from);
      const rgb = hit?.uv && island.sample ? island.sample(hit.uv.x, hit.uv.y) : null;
      const surface = describe(rgb);

      /*
       * Local relief: how the surface behaves at the character's OWN scale
       * rather than at the 0.35 m probe the solver uses. A spot on a pedestal
       * reads as perfectly flat close in and drops away further out, which is
       * precisely what the solver cannot currently see.
       */
      const reliefRadius = Math.max(1.0, characterFootprintM(CHARACTER_MEASUREMENTS[who]) / 2);
      let below = 0;
      let drop = 0;
      for (let a = 0; a < 8; a += 1) {
        const angle = (a / 8) * Math.PI * 2;
        const probe = surfaceAt(
          island.mesh,
          spot.x + Math.cos(angle) * reliefRadius,
          spot.z + Math.sin(angle) * reliefRadius,
          from,
        );
        if (!probe) continue;
        const delta = probe.point.y - spot.y;
        if (delta < -0.2) { below += 1; drop = Math.min(drop, delta); }
      }

      const half = characterFootprintM(CHARACTER_MEASUREMENTS[who]) / 2;
      const fromCentre = Math.hypot(spot.x - centre.x, spot.z - centre.z);
      const overhang = fromCentre + half - radius;

      /*
       * How far this character is turned away from the person watching. The
       * stage opens on ONE bearing, so this is a single number and not a range,
       * and past 45 degrees the base yaw is wrong rather than a gesture having
       * gone a little far (`facing.ts` → MAX_OFF_VIEWER).
       */
      const away = offViewer(facings[i] ?? STAGE_BEARING, STAGE_BEARING);
      const awayDeg = (away * 180) / Math.PI;
      const turnedAway = away > MAX_OFF_VIEWER;

      // The lead is the one the Mentor stage frames (close-up, wide close-up) — only outside an audition.
      const occlusions = i === 0 && !audition
        ? stageOcclusions({ who, x: spot.x, y: spot.y, z: spot.z, facing: facings[i] ?? STAGE_BEARING }, shotScene, hitIsland)
        : [];
      const occluded = occlusions.length > 0;
      if (occluded) {
        console.log(`      ✗ ${label} — ${who} OCCLUDED: ${occlusions.map((o) => `${o.shot}/${o.viewport}/${o.point}@${o.blockedAt.toFixed(2)}m of ${o.distance.toFixed(2)}m`).join(', ')}`);
      }

      const bad = surface === 'WATER?' || overhang > 0 || turnedAway || occluded;
      if (bad) failures += 1;
      tightest = Math.min(tightest, -overhang);

      if (!quiet || bad) {
        console.log(
          `      ${bad ? '✗' : '✓'} ${quiet ? `${label} — ` : ''}${who.padEnd(6)} ` +
            `y=${spot.y.toFixed(2).padStart(6)}  score=${spot.score.toFixed(3)}  ` +
            `${fromCentre.toFixed(2)} m out  ` +
            `${overhang > 0 ? `OVERHANGS ${overhang.toFixed(2)} m` : `${(-overhang).toFixed(2)} m clear`}  ` +
            `${turnedAway ? `TURNED ${awayDeg.toFixed(0)} deg FROM THE LEARNER  ` : `facing ${awayDeg.toFixed(0)} deg off  `}` +
            `${below >= 5 ? `PEDESTAL(${below}/8 down to ${drop.toFixed(2)}m)  ` : ''}` +
            `on ${surface}${rgb ? ` rgb(${rgb.join(',')})` : ''}`,
        );
      }
    }

    /*
     * A stable fingerprint of the whole seating, so the sweep can say "the same
     * people ended up in the same places" in one comparison rather than four.
     */
    const seats = cast
      .map((who, i) => {
        const spot = spots[i];
        return spot
          ? `${who}@${spot.x.toFixed(4)},${spot.z.toFixed(4)}/${(facings[i] ?? STAGE_BEARING).toFixed(4)}`
          : `${who}@NONE`;
      })
      .join(' ');

    return { seats, clearance: Number.isFinite(tightest) ? tightest : 0, spots };
  };

  for (const [lead, companion] of PAIRINGS) {
    runCast(standingCast(null, lead, companion), `${lead} + ${companion ?? '—'}`);
  }

  /*
   * THE STALL (Class III / S18 `props`), and deliberately the simplest check
   * in this file: a static, unrigged prop has no facing to get wrong and no
   * remount to drift on, so it needs neither of the two harder questions the
   * character sweeps below exist to ask. What it DOES need checking, because
   * `propPlacement.ts`'s own header explains it does NOT fall out of the
   * solver for free: that a character solved AROUND it (`excludingProp`,
   * imported rather than restated — same reasoning as everywhere else in
   * this file) never lands inside its footprint, for every pairing the
   * product can compose. `TutorScene.tsx` never applies the exclusion during
   * an audition (measured there to cost the fourth candidate their spot on
   * `diorama-a`), so this sweep does not either — it certifies the
   * combination the product actually ships, not the one it deliberately
   * does not.
   */
  console.log('  STALL: a placed prop, and the cast solved around it');
  const propIsWalkable = walkabilityFor(id) ?? undefined;
  const prop = findPropSpot(island.mesh, propIsWalkable, STALL_CLEARANCE_M);
  if (!prop) {
    console.log('      ✗ STALL — NO SPOT FOUND');
    failures += 1;
  } else {
    const propHit = surfaceAt(island.mesh, prop.x, prop.z, from);
    const propRgb = propHit?.uv && island.sample ? island.sample(propHit.uv.x, propHit.uv.y) : null;
    const propSurface = describe(propRgb);
    const propFromCentre = Math.hypot(prop.x - centre.x, prop.z - centre.z);
    const propOverhang = propFromCentre - radius;
    const propBad = propSurface === 'WATER?' || propOverhang > 0;
    if (propBad) failures += 1;
    console.log(
      `      ${propBad ? '✗' : '✓'} spot     ` +
        `y=${prop.y.toFixed(2).padStart(6)}  score=${prop.score.toFixed(3)}  ` +
        `${propFromCentre.toFixed(2)} m out  ` +
        `${propOverhang > 0 ? `OVERHANGS ${propOverhang.toFixed(2)} m` : `${(-propOverhang).toFixed(2)} m clear`}  ` +
        `on ${propSurface}${propRgb ? ` rgb(${propRgb.join(',')})` : ''}`,
    );

    for (const [lead, companion] of PAIRINGS) {
      const cast = standingCast(null, lead, companion);
      const footprints = cast.map((who) => characterFootprintM(CHARACTER_MEASUREMENTS[who]));
      const spots = findStandingSpots(island.mesh, {
        count: cast.length,
        minSeparation: castSeparationM(footprints),
        separationFor: (index, other) => pairSeparationM(footprints[index] ?? 0, footprints[other] ?? 0),
        preferDirection: new Vector3(0.35, 0, 1),
        // The SAME composition `TutorScene.tsx` applies outside an audition —
        // a copy here would certify a different product.
        isWalkable: excludingProp(propIsWalkable, prop, STALL_CLEARANCE_M),
        clearance: castClearanceM(footprints),
      });

      const label = `${lead} + ${companion ?? '—'} around the stall`;
      let anyBad = false;
      for (let i = 0; i < cast.length; i += 1) {
        const spot = spots[i];
        if (!spot) {
          console.log(`      ✗ ${label} — ${cast[i]!.padEnd(6)} NO SPOT FOUND (stall excluded)`);
          failures += 1;
          anyBad = true;
          continue;
        }
        const clear = Math.hypot(spot.x - prop.x, spot.z - prop.z);
        const bad = clear < STALL_CLEARANCE_M - 1e-6;
        if (bad) {
          failures += 1;
          anyBad = true;
          console.log(
            `      ✗ ${label} — ${cast[i]!.padEnd(6)} ${clear.toFixed(2)} m from the stall, ` +
              `inside its ${STALL_CLEARANCE_M.toFixed(2)} m exclusion`,
          );
        }
      }
      if (!anyBad) console.log(`      ✓ ${label} — every seat clears the stall`);
    }
  }

  /*
   * TWO PROPS AT ONCE (Class III / S18 amendment `props` generality,
   * 2026-09-04) — the capability the single-stall section above never
   * exercised: `findPropSpots`/`excludingProps` (imported, never restated —
   * same reasoning as everywhere else in this file) solve the stall AND a
   * crate together, on the SAME island the single-prop section just used.
   * Two things could go wrong that the section above structurally cannot
   * catch: the second prop landing inside the first one's own footprint, or
   * the character solve — now excluding BOTH — losing a seat neither prop
   * alone would have cost it.
   */
  console.log('  PROPS: two props at once, neither on top of the other');
  const twoProps = findPropSpots(island.mesh, propIsWalkable, ['stall', 'crate']);
  if (twoProps.length !== 2) {
    console.log(`      ✗ PROPS — expected 2 solved, got ${twoProps.length} (${twoProps.map(([k]) => k).join(', ') || 'none'})`);
    failures += 1;
  } else {
    const [[, stallSpot2], [, crateSpot2]] = twoProps;
    const propsClear = Math.hypot(stallSpot2.x - crateSpot2.x, stallSpot2.z - crateSpot2.z);
    const propsBad = propsClear < STALL_CLEARANCE_M - 1e-6;
    if (propsBad) failures += 1;
    console.log(
      `      ${propsBad ? '✗' : '✓'} stall/crate separation  ${propsClear.toFixed(2)} m ` +
        `(need ${STALL_CLEARANCE_M.toFixed(2)} m)`,
    );
    for (const [kind, spot] of twoProps) {
      const hit = surfaceAt(island.mesh, spot.x, spot.z, from);
      const rgb = hit?.uv && island.sample ? island.sample(hit.uv.x, hit.uv.y) : null;
      const surface = describe(rgb);
      const fromCentre = Math.hypot(spot.x - centre.x, spot.z - centre.z);
      const overhang = fromCentre - radius;
      const bad = surface === 'WATER?' || overhang > 0;
      if (bad) failures += 1;
      console.log(
        `      ${bad ? '✗' : '✓'} ${kind.padEnd(5)}   ` +
          `y=${spot.y.toFixed(2).padStart(6)}  ${fromCentre.toFixed(2)} m out  ` +
          `${overhang > 0 ? `OVERHANGS ${overhang.toFixed(2)} m` : `${(-overhang).toFixed(2)} m clear`}  ` +
          `on ${surface}${rgb ? ` rgb(${rgb.join(',')})` : ''}`,
      );
    }

    for (const [lead, companion] of PAIRINGS) {
      const cast = standingCast(null, lead, companion);
      const footprints = cast.map((who) => characterFootprintM(CHARACTER_MEASUREMENTS[who]));
      const spots = findStandingSpots(island.mesh, {
        count: cast.length,
        minSeparation: castSeparationM(footprints),
        separationFor: (index, other) => pairSeparationM(footprints[index] ?? 0, footprints[other] ?? 0),
        preferDirection: new Vector3(0.35, 0, 1),
        // The SAME composition `TutorScene.tsx` applies for a multi-prop
        // request — a copy here would certify a different product.
        isWalkable: excludingProps(propIsWalkable, twoProps),
        clearance: castClearanceM(footprints),
      });

      const label = `${lead} + ${companion ?? '—'} around both props`;
      let anyBad2 = false;
      for (let i = 0; i < cast.length; i += 1) {
        const spot = spots[i];
        if (!spot) {
          console.log(`      ✗ ${label} — ${cast[i]!.padEnd(6)} NO SPOT FOUND (both props excluded)`);
          failures += 1;
          anyBad2 = true;
          continue;
        }
        for (const [kind, propSpot2] of twoProps) {
          const clear = Math.hypot(spot.x - propSpot2.x, spot.z - propSpot2.z);
          const clearanceM = PROP_CLEARANCE_M[kind];
          if (clear < clearanceM - 1e-6) {
            failures += 1;
            anyBad2 = true;
            console.log(
              `      ✗ ${label} — ${cast[i]!.padEnd(6)} ${clear.toFixed(2)} m from the ${kind}, ` +
                `inside its ${clearanceM.toFixed(2)} m exclusion`,
            );
          }
        }
      }
      if (!anyBad2) console.log(`      ✓ ${label} — every seat clears both props`);
    }
  }

  const reference = runCast(
    AUDITION,
    'AUDITION: the whole cast, as personalization stands them',
    true,
  );

  /*
   * AUDITION *PLUS* COMPANION — the configuration that shipped broken.
   *
   * Every character, in both roles, on both islands: as an audition candidate
   * the learner has not chosen, and as an audition candidate who is ALSO the
   * session's tutor or companion. The product's own `standingCast` decides who
   * is on the island in each case, imported rather than restated, so this
   * asserts the property the whole feature rests on: WHO YOU PICK DOES NOT MOVE
   * ANYBODY. If the cast ever starts depending on the pairing — appending the
   * companion, say, which would put five characters on a 6.5 m island — the
   * solve below runs on that cast and the seats stop matching.
   */
  console.log('  AUDITION + COMPANION: every character in both roles');
  let sweepTightest = Infinity;
  let sweepCases = 0;
  for (const lead of AUDITION) {
    for (const companion of [...AUDITION.filter((who) => who !== lead), null]) {
      const cast = standingCast(AUDITION, lead, companion);
      const label = `audition, lead ${lead}, companion ${companion ?? '—'}`;
      const result = runCast(cast, label, true, true);
      sweepCases += 1;
      sweepTightest = Math.min(sweepTightest, result.clearance);
      if (result.seats !== reference.seats) {
        console.log(`      ✗ ${label} SEATS THE CAST DIFFERENTLY from the plain audition`);
        console.log(`          reference ${reference.seats}`);
        console.log(`          this case ${result.seats}`);
        failures += 1;
      }
    }
  }
  console.log(
    `      ${sweepCases} cases, tightest rim clearance ${sweepTightest.toFixed(2)} m` +
      `${sweepTightest === reference.clearance ? ' (the plain audition’s own)' : ''}`,
  );

  /*
   * WHERE THEIR FEET GO, and how big their shadow is — measured through the
   * product's own `modelFooting`, once while the export hangs free and once
   * while it hangs where `Character3D` hangs it.
   *
   * This is the assertion the ship-blocker needed and nobody had. Both readings
   * describe the same export, so they must be the same number; the broken build
   * returned 1.41 m and 96.34 m for Dina's half-footprint, because the second
   * reading was taken in world space through a 67.86x group. The two roles above
   * are exactly what decides whether that second reading ever happens, which is
   * why the sweep is per character AND per role rather than per character.
   */
  console.log('  FOOTING: the same character, measured free and measured on stage');
  const auditionSpots = reference.spots;
  let tightestShadow = Infinity;
  for (let i = 0; i < AUDITION.length; i += 1) {
    const who = AUDITION[i]!;
    const spot = auditionSpots[i];
    const scale = characterScale(CHARACTER_MEASUREMENTS[who]);
    const model = characterStandIn(who);

    const free = modelFooting(model, scale);

    /*
     * BOTH ROLES, and the difference between them is the mount and nothing
     * else. An audition extra keeps the group React first built for them; a
     * candidate invited to stay used to be torn down and rebuilt, and the
     * rebuild measured the model while it was STILL inside the outgoing group.
     * So: measure once free (the first mount), then again from inside the
     * group (every mount after it). The two are the same character.
     */
    const stage = new Group();
    stage.scale.setScalar(scale);
    stage.position.set(spot?.x ?? 0, spot?.y ?? 0, spot?.z ?? 0);
    stage.add(model);
    stage.updateMatrixWorld(true);
    const remounted = modelFooting(model, scale);

    const drift = Math.max(
      Math.abs(remounted.footOffset - free.footOffset),
      Math.abs(remounted.footprint - free.footprint),
    );

    /*
     * And what that footprint costs the ISLAND. `ContactShadow` is a flat plane
     * of `footprint * 1.15` radius laid on the surface, so it has to fit inside
     * the rim from wherever this character is standing — a blob wider than the
     * ground it is cast on hangs over the edge against open sky, and at 110 m it
     * covers the whole canvas, which is precisely how the ship-blocker LOOKED.
     */
    const shadowRadius = free.footprint * 1.15;
    const out = spot ? Math.hypot(spot.x - centre.x, spot.z - centre.z) : 0;
    const margin = radius - (out + shadowRadius);
    tightestShadow = Math.min(tightestShadow, margin);

    const bad = drift > 1e-9 || margin < 0 || !spot;
    if (bad) failures += 1;
    console.log(
      `      ${bad ? '✗' : '✓'} ${who.padEnd(6)} ` +
        `half-footprint ${free.footprint.toFixed(3)} m free / ${remounted.footprint.toFixed(3)} m remounted` +
        `${drift > 1e-9 ? '  DRIFTED' : ''}  ` +
        `lift ${free.footOffset.toFixed(3)} m  ` +
        `shadow ${(shadowRadius * 2).toFixed(2)} m across, ` +
        `${margin >= 0 ? `${margin.toFixed(2)} m inside the rim` : `OVER THE RIM BY ${(-margin).toFixed(2)} m`}`,
    );
  }
  console.log(`      tightest contact-shadow margin ${tightestShadow.toFixed(2)} m`);
}

console.log(
  failures === 0
    ? '\nverify-placement OK — every character stands on walkable ground, inside the rim, facing the learner'
    : `\nverify-placement FAILED — ${failures} placement(s) are wrong`,
);
process.exit(failures === 0 ? 0 : 1);
