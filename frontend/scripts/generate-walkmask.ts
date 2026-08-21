/*
 * generate-walkmask — bakes, per island, which ground a character may stand on.
 *
 * Fires a downward ray through every cell of a grid laid over the island,
 * reads the base-colour texel the ray lands on, and marks the cell walkable or
 * not. The output is committed as `src/tutor-scene/walkMasks.generated.json`.
 *
 * WHY A COLOUR RULE, STATED PLAINLY. There is no geometric signal to use: the
 * diorama is one mesh with one material, the pond is not a separate node, the
 * mesh is quantized so the water is not even exactly planar, and there are no
 * vertex colours. Measured on the real assets, nothing about the SHAPE
 * distinguishes the pond from the sand. The only place the meaning lives is the
 * texture, so that is where the rule reads it.
 *
 * "Cyan means water" is true of these two dioramas and is not a fact about the
 * world, which is why this runs at BUILD time and commits its answer: a wrong
 * classification is then a visibly wrong mask in a diff, reviewable before it
 * can put a child's tutor waist-deep in a lake. A future island that breaks the
 * rule gets its mask corrected here — or hand-edited — without touching any
 * placement code.
 *
 * Usage:  npm run assets:walkmask [-- --preview]
 *
 * `--preview` also writes a PNG of each mask next to the assets. The argument
 * for baking this at build time is that a bad classification is VISIBLE, and
 * that argument is worthless if nobody can actually look at it.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIsland, surfaceAt, type Rgb } from './lib/island.js';
import { SCENE_MEASUREMENTS } from '../src/tutor-scene/measurements.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, '..', 'public', 'scenes');
const OUT = resolve(HERE, '..', 'src', 'tutor-scene', 'walkMasks.generated.json');

/**
 * Grid resolution. At 96 cells a 9.5 m island resolves to ~10 cm, comfortably
 * finer than the 35 cm probe the solver uses and than any character's foot.
 */
const RESOLUTION = 96;

const preview = process.argv.includes('--preview');

/**
 * Is this texel something you can stand on?
 *
 * WATER — cyan/teal: red starved while green and blue are both high. Measured
 * on diorama-b's pond: rgb(16,155,149). A first attempt asked for "blue
 * dominant" and classified that as sand, because blue does not exceed green in
 * teal. Deep water and shallow shore both land in this band.
 */
function walkable([r, g, b]: Rgb): boolean {
  const water = b > r + 40 && b > 90 && g > r + 40;
  return !water;
}

interface Stored {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  walkable: string;
}

const islands: Record<string, Stored> = {};

for (const [id, measurement] of Object.entries(SCENE_MEASUREMENTS)) {
  const island = await loadIsland(resolve(SCENES, `${id}.glb`), measurement);
  const { min, max } = island.bounds;

  const bits = new Uint8Array(Math.ceil((RESOLUTION * RESOLUTION) / 8));
  // RGB, so the preview can show three states at once: walkable, blocked, void.
  const pixels = new Uint8Array(RESOLUTION * RESOLUTION * 3);
  let walkableCells = 0;
  let blockedCells = 0;
  let missCells = 0;

  for (let gz = 0; gz < RESOLUTION; gz += 1) {
    for (let gx = 0; gx < RESOLUTION; gx += 1) {
      // Cell CENTRE, not corner: a corner sample on the rim reads the void
      // beside the island and marks a usable cell unusable.
      const x = min.x + ((gx + 0.5) / RESOLUTION) * (max.x - min.x);
      const z = min.z + ((gz + 0.5) / RESOLUTION) * (max.z - min.z);

      const hit = surfaceAt(island, x, z);
      if (!hit) {
        // Nothing under this cell — off the island. Left as 0.
        missCells += 1;
        pixels.set([24, 26, 38], (gz * RESOLUTION + gx) * 3);
        continue;
      }
      const rgb = hit.uv && island.sample ? island.sample(hit.uv.x, hit.uv.y) : null;
      /*
       * No texture means no evidence, and no evidence must not read as
       * approval — but marking a whole untextured island unwalkable would
       * leave it with nowhere to stand at all. So it stays walkable and the
       * summary below says so out loud, which is the only honest option when
       * the rule simply cannot be applied.
       */
      if (rgb === null || walkable(rgb)) {
        const bit = gz * RESOLUTION + gx;
        bits[bit >> 3]! |= 1 << (bit & 7);
        walkableCells += 1;
        pixels.set(rgb ?? [140, 140, 140], (gz * RESOLUTION + gx) * 3);
      } else {
        blockedCells += 1;
        // Magenta: a colour no diorama contains, so a mis-marked cell is
        // impossible to mistake for scenery when the preview is opened.
        pixels.set([255, 0, 170], (gz * RESOLUTION + gx) * 3);
      }
    }
  }

  islands[id] = {
    minX: +min.x.toFixed(4),
    maxX: +max.x.toFixed(4),
    minZ: +min.z.toFixed(4),
    maxZ: +max.z.toFixed(4),
    walkable: Buffer.from(bits).toString('base64'),
  };

  const onIsland = walkableCells + blockedCells;
  console.log(
    `  ${id.padEnd(11)} ${RESOLUTION}x${RESOLUTION}  ` +
      `${walkableCells} walkable / ${blockedCells} blocked / ${missCells} off-island  ` +
      `(${onIsland > 0 ? ((blockedCells / onIsland) * 100).toFixed(1) : '0.0'}% of the island is blocked)`,
  );
  if (island.sample === null) console.log(`  ${' '.repeat(11)} NO TEXTURE — nothing could be classified`);

  if (preview) {
    const file = resolve(SCENES, `walkmask-${id}.png`);
    await sharp(Buffer.from(pixels), { raw: { width: RESOLUTION, height: RESOLUTION, channels: 3 } })
      .resize(RESOLUTION * 6, RESOLUTION * 6, { kernel: 'nearest' })
      .png()
      .toFile(file);
    console.log(`  ${' '.repeat(11)} preview → public/scenes/walkmask-${id}.png  (magenta = blocked)`);
  }
}

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _comment:
        'GENERATED by scripts/generate-walkmask.ts. One bit per grid cell, 1 = a character may stand there. ' +
        'Bounds are in METRES in the island frame Diorama.tsx places it in, so changing an island targetWidthM ' +
        'invalidates this file — rerun `npm run assets:walkmask`. Commit it: it is build input and holds no secrets.',
      resolution: RESOLUTION,
      islands,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`\ngenerate-walkmask: wrote src/tutor-scene/walkMasks.generated.json`);
