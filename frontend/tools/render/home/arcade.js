// Home composition "arcade": the four mentors inside a video game from the days of big pixels, jumping for the
// Seeds that hang in an arc over them. The moment is the one Liruf reaches the first Seed and it bursts into pixels.
//
// The setting is an island made of blocks, every one a cube with round corners: a floor of grass-topped blocks cut
// like a circle drawn in pixels, with a smaller layer of earth under it. At the back, on the left, a platform of two
// blocks floats with a heart of small cubes turning over it; at the right edge stands the goal, a pole on a block
// with a flag of small cubes that waves. Nothing stands behind Dina, who is large: her side of the island is open
// sky. Clouds of white cubes drift in a patch of bright sky that fades to nothing before the frame's borders.
//
// Nothing here is taken from a game that exists: no pipes, bricks, mushrooms or mystery blocks, only blocks, Seeds
// and a flag.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, mesh, radial, seedMesh, sequence, sphere, sprite, standard } from '../home-kit.js';

const CELL = 0.92; // one block of the floor
const FLOOR = { z: -0.5 };
const POLE = { x: 2.87, z: -1.42, height: 2.5, foot: 0.7 };
const PLATFORM = { x: -3.0, z: -2.2 };
/** Where the cell `i`, `j` of the floor is (i to the reader's right, j toward the reader). */
const cell = (i, j) => [i * CELL, FLOOR.z + j * CELL];
// the Seeds, in the arc of a jump from Liruf's head to Dina's
const ARC = Array.from({ length: 6 }, (_, i) => ({ x: -1.6 + i * 0.6, y: 2.2 + Math.sin((i / 5) * Math.PI) * 0.46, z: -0.25 }));
// who takes which Seed, and when
const TAKEN = [{ seed: 0, at: 2.0 }, { seed: 5, at: 3.0 }];

const CUBE = new RoundedBoxGeometry(1, 1, 1, 4, 0.16);
/** A cube with round corners, `size` on a side (or `[w, h, d]`). */
function cube(size, material, x, y, z) {
  const m = mesh(CUBE, material, x, y, z);

  if (Array.isArray(size)) m.scale.set(...size);
  else m.scale.setScalar(size);

  return m;
}

// a square with round corners: the pixel every effect here is made of
const PIXEL = canvasTexture([64, 64], (g, s) => {
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(6, 6, s - 12, s - 12, 14);
  g.fill();
});

// ---- the floor: grass-topped blocks in the shape of a circle drawn in pixels, and a layer of earth below
function floor() {
  const group = new THREE.Group();
  const grass = [standard(0x62d16c, 0.85), standard(0x56c462, 0.85)];
  const earth = [standard(0xc48447, 0.9), standard(0xb5763c, 0.9)];
  const deep = [standard(0xa2652f, 0.9), standard(0x955b29, 0.9)];

  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const d2 = i * i + j * j;
      const [x, z] = cell(i, j);
      const k = (i + j + 6) % 2;

      // a circle drawn in pixels, without its front row: the front of the island is a straight edge of five blocks
      if (d2 > 10 || j > 2) continue;

      const top = cube([CELL, 0.34, CELL], grass[k], x, -0.17, z);

      top.castShadow = false;
      group.add(top, cube([CELL * 0.97, 0.6, CELL * 0.97], earth[k], x, -0.58, z));

      // the layer below stands back from the front, so the island thins out downward
      if (d2 <= 4 && j < 2) group.add(cube([CELL * 0.97, 0.46, CELL * 0.97], deep[k], x, -1.09, z));
    }
  }

  return group;
}

/** A shape drawn in small cubes from rows of text: `X` is a cube of `color`, `o` one of `shine`. It is centered. */
function pixels(rows, size, color, shine = 0xffffff) {
  const group = new THREE.Group();
  const main = standard(color, 0.45, { emissive: color, emissiveIntensity: 0.35 });
  const light = standard(shine, 0.4, { emissive: shine, emissiveIntensity: 0.35 });

  rows.forEach((row, r) => {
    [...row].forEach((mark, c) => {
      if (mark === '.') return;

      group.add(cube(size * 0.96, mark === 'o' ? light : main, (c - (row.length - 1) / 2) * size, ((rows.length - 1) / 2 - r) * size, 0));
    });
  });

  return group;
}

const HEART_Y = 2.62;
const HEART = ['.XX.XX.', 'XoXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

// ---- a cloud of white cubes: a long row and a short one on top
function cloud(size) {
  const group = new THREE.Group();
  const white = standard(0xffffff, 0.9, { emissive: 0xffffff, emissiveIntensity: 0.3 });

  for (const [x, y] of [[-1.5, 0], [-0.5, 0], [0.5, 0], [1.5, 0], [-0.4, 0.8], [0.6, 0.8]]) {
    const one = cube(size, white, x * size * 0.92, y * size * 0.92, 0);

    one.castShadow = false;
    group.add(one);
  }

  return group;
}

// ---- the goal: a pole on a block with a golden ball on top, and a flag of small cubes, each on its own so it waves
function goal() {
  const group = new THREE.Group();
  const gold = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const colors = [standard(C.mint, 0.5, { emissive: C.mint, emissiveIntensity: 0.25 }), standard(0xfff6df, 0.6, { emissive: 0xfff6df, emissiveIntensity: 0.2 })];
  const H = POLE.height;
  const size = 0.17;
  const cloth = [];

  group.add(cube(POLE.foot, standard(C.indigo, 0.6), 0, POLE.foot / 2, 0), cylinder(0.045, 0.055, H - POLE.foot + 0.04, standard(0xf6f6fd, 0.4), 0, (H + POLE.foot) / 2, 0, 24), sphere(0.11, gold, 0, H + 0.06, 0));

  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 3; r++) {
      const one = cube(size * 0.97, colors[(c + r) % 2], 0.08 + (c + 0.5) * size, H - 0.14 - r * size, 0);

      group.add(one);
      cloth.push({ one, c });
    }
  }

  return { group, cloth };
}

/** Several jumps in one curve: `[[second, height], ...]`, each with its dip before and its settle after. */
const hops = (jumps, loop) => [[0, 0], ...jumps.flatMap(([at, h]) => [[at - 0.55, 0], [at - 0.32, -0.035], [at, h], [at + 0.3, -0.03], [at + 0.5, 0]]), [loop, 0]];
const tucks = (jumps, loop) => [[0, 0], ...jumps.flatMap(([at, amount]) => [[at - 0.3, 0], [at, amount], [at + 0.3, 0]]), [loop, 0]];

export function build(scene, { loop, heights, curve, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const next = sequence(19);

  set.add(floor());
  set.add(decal(radial([[0, 'rgba(40,60,150,0.28)'], [0.6, 'rgba(40,60,150,0.14)'], [1, 'rgba(40,60,150,0)']]), 0, -1.5, FLOOR.z - 0.5, 3.0, 1.9, 0));

  // the sky: a patch of bright blue, palest low down, that fades to nothing all around
  const sky = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const blue = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    blue.addColorStop(0, 'rgba(96,178,255,0.95)');
    blue.addColorStop(0.5, 'rgba(84,160,255,0.85)');
    blue.addColorStop(0.8, 'rgba(92,140,255,0.3)');
    blue.addColorStop(1, 'rgba(92,140,255,0)');
    g.fillStyle = blue;
    g.fillRect(0, 0, w, w);

    const low = g.createRadialGradient(w / 2, w * 0.66, 0, w / 2, w * 0.66, w * 0.36);

    low.addColorStop(0, 'rgba(200,236,255,0.5)');
    low.addColorStop(1, 'rgba(200,236,255,0)');
    g.fillStyle = low;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);

  sky.position.set(0, 0.95, -8);
  sky.scale.set(10.4, 5.3, 1);
  set.add(sky);

  const clouds = [[2.1, 2.5, -5.2, 0.32, 0], [-3.5, 1.1, -5.4, 0.3, 4.1]].map(([x, y, z, size, phase]) => {
    const one = cloud(size);

    set.add(one);

    return { one, x, y, z, phase };
  });

  // the floating platform on the left, and the heart over it
  const platform = new THREE.Group();
  const heart = pixels(HEART, 0.1, 0xff4d6d);

  for (const x of [-0.42, 0.42]) platform.add(cube([0.84, 0.3, 0.84], standard(0x62d16c, 0.85), x, 0.16, 0), cube([0.81, 0.36, 0.81], standard(0xc48447, 0.9), x, -0.12, 0));

  platform.position.set(PLATFORM.x, 0, PLATFORM.z);
  heart.position.set(PLATFORM.x, HEART_Y, PLATFORM.z);
  set.add(platform, heart);

  const flag = goal();

  flag.group.position.set(POLE.x, 0, POLE.z);
  set.add(flag.group);

  // a bush of green cubes at the left edge
  const leaf = [standard(0x2f9e58, 0.85), standard(0x3fb565, 0.85)];

  set.add(cube(0.4, leaf[0], -3.15, 0.2, 0.25), cube(0.4, leaf[1], -2.77, 0.2, 0.3), cube(0.4, leaf[1], -2.97, 0.56, 0.27));

  const leaps = { liruf: [[2.0, 0.46], [5.9, 0.2]], zara: [[2.65, 0.3], [6.5, 0.24]], rho: [[3.5, 0.22], [7.0, 0.14]], dina: [[3.0, 0.2], [5.3, 0.1]] };
  const cast = {
    // Liruf jumps the highest, straight up under the first Seed, knees tucked
    liruf: { x: -1.6, z: -0.05, yaw: 0.3, act: {
      hop: hops(leaps.liruf, L), tuck: tucks([[2.0, 1], [5.9, 0.5]], L), lean: [[0, 0.04], [1.6, 0.14], [2.0, -0.14], [2.5, 0.1], [3.2, 0.04], [L, 0.04]],
      pitch: [[0, -0.2], [1.5, -0.3], [2.0, -0.38], [2.6, 0], [4.5, -0.1], [L, -0.2]], roll: [[0, -0.1], [2.0, 0.12], [4, -0.12], [5.9, 0.1], [L, -0.1]],
      yaw: [[0, 0.1], [2.0, 0], [3.4, 0.45], [5.2, 0.45], [6.2, 0.1], [L, 0.1]],
    } },
    // Zara jumps with her arms out like wings, watching the Seeds over her
    zara: { x: -0.65, z: 0.4, yaw: 0.1, act: {
      hop: hops(leaps.zara, L), tuck: tucks([[2.65, 0.7], [6.5, 0.5]], L), lean: [[0, 0], [2.65, -0.12], [3.3, 0.04], [6.5, -0.1], [7.1, 0], [L, 0]],
      pitch: [[0, -0.22], [1.9, -0.1], [2.65, -0.32], [3.4, -0.12], [6.5, -0.3], [7.2, -0.22], [L, -0.22]], roll: [[0, 0.1], [2.0, -0.12], [3.6, 0.1], [5.6, -0.08], [L, 0.1]],
      yaw: [[0, 0.2], [1.6, -0.45], [2.5, 0], [4.4, 0.3], [L, 0.2]],
    } },
    // Rho bends his knees twice to get it right, then jumps after everybody else
    rho: { x: 0.32, z: 0.45, yaw: -0.1, act: {
      hop: hops(leaps.rho, L), tuck: tucks([[3.5, 0.8], [7.0, 0.4]], L), lean: [[0, -0.02], [1.9, 0.14], [2.3, 0], [2.9, 0.18], [3.5, -0.16], [4.0, 0.1], [4.6, -0.02], [L, -0.02]],
      pitch: [[0, -0.14], [2.0, -0.3], [3.5, -0.36], [4.0, 0.14], [4.7, -0.1], [L, -0.14]], roll: [[0, 0.1], [2.0, -0.1], [3.5, 0.1], [5.5, -0.08], [L, 0.1]],
      yaw: [[0, -0.1], [1.4, -0.5], [2.6, -0.5], [3.4, 0], [5.0, 0.45], [6.4, 0.45], [L, -0.1]],
    } },
    // Dina rears up under the last Seed
    dina: { x: 1.4, z: -0.1, yaw: -0.5, act: {
      hop: hops(leaps.dina, L), rear: [[0, 0], [2.5, 0], [3.0, 1], [3.6, 0], [L, 0]], pitch: [[0, -0.24], [3.0, -0.44], [3.8, -0.2], [L, -0.24]],
      roll: [[0, 0.16], [3.0, -0.1], [4.6, 0.16], [L, 0.16]], yaw: [[0, 0.5], [2.0, 0.6], [3.0, 0.2], [5.0, 0.3], [L, 0.5]],
    } },
  };
  const names = Object.keys(cast);
  const landed = names.flatMap((name) => leaps[name].filter(([, h]) => h > 0.15).map(([at]) => ({ x: cast[name].x, z: cast[name].z, peak: at })));

  // the Seeds, each turning at its own pace, with a soft light behind
  const seeds = ARC.map(({ x, y, z }, i) => {
    const seed = seedMesh(0.4);
    const glow = halo(0.36, 0xffe9a8, 0.5);
    const taken = TAKEN.find((take) => take.seed === i);
    // the burst: a ring of pixels that fly out and fade, and one large one that flashes
    const burst = taken ? Array.from({ length: 10 }, (_, k) => {
      const bit = sprite(PIXEL, [0xfff3b0, 0xffffff, 0xffd36b, 0x8ffbe2][k % 4], 9);

      fx.add(bit);

      return { bit, a: (k / 10) * TAU + 0.3, reach: 0.4 + next() * 0.28, size: 0.07 + next() * 0.06 };
    }) : [];
    const flash = taken ? sprite(PIXEL, 0xfff6c8, 8) : null;

    seed.castShadow = false;
    fx.add(seed, glow);

    if (flash) fx.add(flash);

    return { seed, glow, x, y, z, phase: i * 0.9, taken, burst, flash };
  });

  // pixels that twinkle around each mentor, brightest around its jump
  const twinkles = names.flatMap((name) => Array.from({ length: 6 }, (_, k) => {
    const bit = sprite(PIXEL, [0xffffff, 0xfff0b8, 0xbfe3ff][k % 3], 8);
    const a = next() * TAU;
    // beside the mentor, never over a face: the two at the ends keep theirs on the outer side
    const side = { liruf: -0.66, zara: k % 2 ? 0.42 : -0.42, rho: k % 2 ? 0.44 : -0.44, dina: 0.7 }[name] * (1 + next() * 0.4);

    fx.add(bit);

    return {
      bit, peak: leaps[name][0][0], x: cast[name].x + side, y: heights[name] * (0.4 + next() * 0.85), z: cast[name].z + 0.25 + Math.abs(Math.sin(a)) * 0.3,
      size: 0.05 + next() * 0.05, speed: 1 + Math.floor(next() * 3), phase: next() * TAU,
    };
  }));
  const effects = [landings(fx, { actors: landed, color: 0xf4ffe0 })];
  const wings = [[0, 0], [2.1, 0], [2.6, 1], [2.9, 1], [3.4, 0], [5.95, 0], [6.45, 0.8], [6.75, 0.8], [7.2, 0], [L, 0]];

  scene.add(set, fx);

  return {
    cast,
    still: 2.08,
    camera: { y: 2.3, dist: 14.6, lookY: 0.74 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      // Zara's arms open wide while she is in the air
      const open = curve(wings, t, 0.05);

      rigs.zara.rot('LeftArm', Z, open * 0.6);
      rigs.zara.rot('RightArm', Z, -open * 0.6);

      for (const { seed, glow, x, y, z, phase, taken, burst, flash } of seeds) {
        // a Seed that is taken shrinks to nothing in an instant and comes back a while later, with a small bounce
        const since = taken ? t - taken.at : -1;
        const back = (since - 2.2) / 0.5;
        const here = !taken || since < 0 ? 1 : since < 0.12 ? 1 - since / 0.12 : back <= 0 ? 0 : back >= 1 ? 1 : 1 + Math.sin(back * Math.PI) * 0.25 - (1 - back) ** 2;

        seed.position.set(x, y + Math.sin(w * 2 + phase) * 0.05, z);
        seed.rotation.y = w * 3 + phase;
        seed.scale.setScalar(0.4 * Math.max(0.0001, here));
        seed.visible = here > 0.01;
        glow.position.set(x, seed.position.y, z - 0.1);
        glow.material.opacity = 0.5 * Math.min(1, here);

        const u = since / 0.75;

        for (const { bit, a, reach, size } of burst) {
          bit.visible = u > 0 && u < 1;
          bit.position.set(x + Math.cos(a) * (0.12 + reach * (1 - (1 - u) ** 2)), y + Math.sin(a) * (0.12 + reach * (1 - (1 - u) ** 2)) + 0.06, z + 0.1);
          bit.scale.setScalar(size * (1.2 - u * 0.6));
          bit.material.opacity = Math.min(1, (1 - u) * 1.6);
        }

        if (flash) {
          const f = since / 0.3;

          flash.visible = f > 0 && f < 1;
          flash.position.set(x, y, z + 0.05);
          flash.scale.setScalar(0.25 + f * 0.45);
          flash.material.opacity = 0.85 * (1 - f);
        }
      }

      for (const { bit, peak, x, y, z, size, speed, phase } of twinkles) {
        const twinkle = Math.max(0, Math.sin(w * speed + phase)) ** 2;
        const near = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 1.1);

        bit.position.set(x, y + Math.sin(w + phase) * 0.05, z);
        bit.scale.setScalar(size * (0.3 + twinkle) * (0.7 + near));
        bit.material.opacity = Math.min(1, 0.1 + twinkle * near * 1.2);
      }

      for (const { one, x, y, z, phase } of clouds) one.position.set(x + Math.sin(w + phase) * 0.22, y + Math.sin(w * 2 + phase) * 0.03, z);

      platform.position.y = 1.88 + Math.sin(w * 2) * 0.05;
      heart.position.y = HEART_Y + Math.sin(w * 2 + 1.2) * 0.07;
      heart.rotation.y = Math.sin(w) * 0.7;
      heart.scale.setScalar(1 + Math.max(0, Math.sin(w * 4)) * 0.06);

      for (const { one, c } of flag.cloth) one.position.z = Math.sin(c * 0.9 - w * 3) * 0.035 * (c + 1);

      for (const effect of effects) effect(t);
    },
  };
}
