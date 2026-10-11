// Home composition "kitchen": the four mentors bake a cake on a budget, the moment its last piece, a large Seed,
// comes down onto the top and the cake is done.
//
// The setting is an island: a round floor of tiles on a wooden plinth. Behind the mentors, in the gap between the two
// pairs, a round kitchen island carries the cake on its stand, decorated with Seeds. On the left, clear of
// everybody, a round-shouldered oven with a glowing window, and on it the mixing bowl, where a wooden spoon stirs by
// itself and flour puffs out. The right side is Dina's (she is large, and whatever stood there would look attached
// to her), so the recipe hangs in the air high above it, a board that floats like a screen: each ingredient and
// what it costs in Seeds, as drawings (never words or figures). The ingredients still to go in (eggs, a strawberry, a flour bag, a whisk, butter) fly
// over in a high arch, one after another, well above every head.
//
// Rho and Liruf never lift their arms, so nobody holds anything: the kitchen works by itself, like a magic one.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.25, z: -0.6 };
const ISLAND = { x: 0.12, z: -1.85, top: 0.95 };
const OVEN = { x: -2.82, z: -0.85 };
const BOARD = { x: 2.8, z: -1.6, y: 2.75 };
const BOWL = { y: 1.1 }; // the oven's top, where the bowl stands
const ARCH = { x: 0.12, y: 2.35, z: -1.3, reach: 1.75, rise: 0.95 };
const LANDS = 2.0; // the second the Seed comes down onto the cake

// ---- the floor: cream and mint tiles inside a wooden rim, on a plinth
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const tile = (0.52 / (R * 2)) * w;

    g.fillStyle = '#b9793c';
    g.fillRect(0, 0, w, w);
    g.save();
    g.beginPath();
    g.arc(half, half, half * 0.955, 0, TAU);
    g.clip();
    g.fillStyle = '#fff3da';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#9fe0d2';

    // tiles laid on the diagonal, with round corners and a seam of cream between them
    g.translate(half, half);
    g.rotate(Math.PI / 4);

    for (let i = -16; i <= 16; i++) {
      for (let j = -16; j <= 16; j++) {
        if ((i + j) % 2) continue;

        g.beginPath();
        g.roundRect(i * tile + 4, j * tile + 4, tile - 8, tile - 8, 14);
        g.fill();
      }
    }

    g.restore();
    g.strokeStyle = '#e9b877';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(half, half, half * 0.955, 0, TAU);
    g.stroke();
  });
  const disc = mesh(new THREE.CylinderGeometry(R, R, 0.08, 128), [standard(0xb9793c, 0.6), standard(0xffffff, 0.5, { map: top }), standard(C.woodDark, 0.8)], 0, -0.04, 0);

  disc.castShadow = false;
  group.add(disc, lathe([[0, -0.44], [2.5, -0.44], [3.06, -0.32], [R - 0.04, -0.15], [R - 0.04, -0.08]], standard(0x8a5a36, 0.75)));

  return group;
}

// ---- the kitchen island: a round cabinet under a pale worktop
function island() {
  const group = new THREE.Group();
  const gold = standard(0xf2bf2a, 0.3, { metalness: 0.6 });

  group.add(
    lathe([[0, 0], [0.86, 0], [0.86, 0.08], [0.93, 0.1], [0.95, 0.16], [0.95, 0.8], [0.9, 0.86], [0, 0.86]], standard(C.sky, 0.55)),
    lathe([[0, 0.86], [1.02, 0.86], [1.06, 0.9], [1.02, ISLAND.top], [0, ISLAND.top]], standard(0xfff1dc, 0.4)),
    lathe([[0, 0], [0.87, 0], [0.87, 0.09], [0, 0.09]], standard(C.slate, 0.7)),
  );

  // a rail around the cabinet and round knobs on its doors
  const rail = mesh(new THREE.TorusGeometry(0.955, 0.016, 10, 96), gold, 0, 0.7, 0);

  rail.rotation.x = Math.PI / 2;
  group.add(rail);

  for (const a of [-0.62, -0.2, 0.2, 0.62]) group.add(sphere(0.04, gold, Math.sin(a) * 0.97, 0.52, Math.cos(a) * 0.97));

  return group;
}

// ---- the cake on its stand: two tiers, pink icing that runs over the edge, Seeds set all around, strawberries on top
function cake() {
  const group = new THREE.Group();
  const sponge = standard(0xffe9bd, 0.8);
  const icing = standard(0xff8fb8, 0.45);
  const tier = (radius, height, y, seeds, phase) => {
    group.add(
      lathe([[0, 0], [radius - 0.03, 0], [radius, 0.04], [radius, height - 0.04], [radius - 0.03, height], [0, height]], sponge, 0, y, 0),
      lathe([[0, height - 0.02], [radius + 0.005, height - 0.02], [radius + 0.02, height + 0.015], [radius - 0.02, height + 0.045], [0, height + 0.045]], icing, 0, y, 0),
    );

    // the icing runs down in round drops, and a Seed stands between every two
    for (let i = 0; i < seeds; i++) {
      const a = (i / seeds) * TAU + phase;
      const drop = sphere(0.05, icing, Math.sin(a) * (radius + 0.005), y + height - 0.06 - (i % 2) * 0.03, Math.cos(a) * (radius + 0.005), 1.5);
      const seed = seedMesh(height * 0.56);
      const b = a + Math.PI / seeds;

      seed.position.set(Math.sin(b) * (radius + 0.02), y + height * 0.42, Math.cos(b) * (radius + 0.02));
      seed.rotation.y = b;
      seed.castShadow = false;
      group.add(drop, seed);
    }
  };

  group.add(lathe([[0, 0], [0.24, 0], [0.26, 0.025], [0.09, 0.07], [0.075, 0.2], [0.5, 0.25], [0.53, 0.28], [0, 0.28]], standard(C.indigo, 0.4)));
  tier(0.43, 0.32, 0.28, 12, 0);
  tier(0.29, 0.27, 0.645, 9, 0.3);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.5;
    const berry = strawberry(0.5);

    berry.position.set(Math.sin(a) * 0.2, 0.955, Math.cos(a) * 0.2);
    berry.rotation.z = 0.2;
    group.add(berry);
  }

  return { group, top: 0.96 };
}

// ---- ingredients
function strawberry(scale = 1) {
  const group = new THREE.Group();
  const next = sequence(3);

  group.add(lathe([[0, 0], [0.05, 0.02], [0.105, 0.11], [0.12, 0.2], [0.09, 0.27], [0, 0.3]], standard(0xe8203a, 0.4), 0, 0, 0, 32), sphere(0.09, standard(0x3fb565, 0.7), 0, 0.285, 0, 0.3), cylinder(0.014, 0.014, 0.07, standard(0x2f9e58, 0.7), 0, 0.33, 0, 8));

  for (let i = 0; i < 12; i++) {
    const a = next() * TAU;
    const h = 0.06 + next() * 0.17;
    const r = h < 0.11 ? 0.05 + ((h - 0.02) / 0.09) * 0.055 : 0.105 + ((h - 0.11) / 0.09) * 0.015;

    group.add(sphere(0.012, standard(0xffe08a, 0.5), Math.sin(a) * r, h, Math.cos(a) * r));
  }

  group.scale.setScalar(scale);

  return group;
}

function egg() {
  const one = sphere(0.13, standard(0xf0c996, 0.45), 0, 0, 0, 1.3);

  return one;
}

function flourBag() {
  const group = new THREE.Group();
  const paper = standard(0xdcb886, 0.85);
  const label = canvasTexture([256, 256], (g, w) => {
    g.fillStyle = '#fff3da';
    g.beginPath();
    g.arc(w / 2, w / 2, w * 0.46, 0, TAU);
    g.fill();

    // an ear of wheat: round grains up a stalk
    g.strokeStyle = '#c98a2b';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w / 2, w * 0.86);
    g.lineTo(w / 2, w * 0.2);
    g.stroke();
    g.fillStyle = '#ebb806';

    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + side * 30, w * (0.28 + i * 0.13), 24, 15, side * 0.7, 0, TAU); g.fill(); }

    g.beginPath();
    g.ellipse(w / 2, w * 0.17, 15, 24, 0, 0, TAU);
    g.fill();
  });
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.12, 40), standard(0xffffff, 0.8, { map: label }));

  front.position.set(0, 0.2, 0.096);
  group.add(box(0.32, 0.4, 0.19, paper, 0, 0.2, 0, 0.07), box(0.26, 0.09, 0.12, paper, 0, 0.42, 0, 0.04), box(0.33, 0.06, 0.2, standard(C.sky, 0.6), 0, 0.045, 0, 0.03), front);
  group.children.forEach((o) => { o.position.y -= 0.22; });

  return group;
}

function whisk() {
  const group = new THREE.Group();
  const steel = standard(0xcfd4ea, 0.3, { metalness: 0.6 });

  group.add(cylinder(0.028, 0.034, 0.24, standard(C.orange, 0.5), 0, -0.2, 0, 16), sphere(0.036, standard(C.orange, 0.5), 0, -0.33, 0));

  for (let i = 0; i < 4; i++) {
    const loop = mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 40), steel, 0, 0.07, 0);

    loop.scale.y = 1.7;
    loop.rotation.y = (i / 4) * Math.PI;
    group.add(loop);
  }

  return group;
}

function butter() {
  const group = new THREE.Group();

  group.add(box(0.36, 0.035, 0.24, standard(0xfff3da, 0.6), 0, -0.07, 0, 0.015), box(0.28, 0.13, 0.16, standard(0xffd84a, 0.5), 0, 0.01, 0, 0.04));

  return group;
}

// ---- the oven: a round-shouldered stove with a window that glows, two knobs and a pale top
function oven() {
  const group = new THREE.Group();
  const enamel = standard(C.orange, 0.45);
  const window = new THREE.Group();
  const light = new THREE.PointLight(0xffb060, 4, 4.5, 1.7);
  const glow = halo(0.5, 0xffb347, 0.5);

  group.add(box(0.92, 0.98, 0.76, enamel, 0, 0.55, 0, 0.16), box(0.98, 0.08, 0.82, standard(0xfff1dc, 0.4), 0, 1.06, 0, 0.04));

  for (const x of [-0.33, 0.33]) for (const z of [-0.26, 0.26]) group.add(sphere(0.07, standard(C.slate, 0.6), x, 0.06, z, 0.9));

  // the window: a dark ring around a pane of warm light, and the shape of a cake rising inside
  window.add(mesh(new THREE.TorusGeometry(0.27, 0.045, 14, 56), standard(C.slate, 0.4)), mesh(new THREE.CircleGeometry(0.27, 48), lit(0xffb347, 1.5)));

  const rising = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xc8691a, toneMapped: false }));

  rising.position.set(0, -0.1, 0.004);
  rising.scale.x = 1.25;
  window.add(rising);
  window.position.set(0, 0.47, 0.385);
  glow.position.set(0, 0.47, 0.42);
  light.position.set(0, 0.5, 0.9);
  group.add(window, glow, light);

  for (const x of [-0.22, 0.22]) group.add(sphere(0.055, standard(0xfff1dc, 0.4), x, 0.89, 0.385, 0.9));

  // a handle across the door
  const handle = cylinder(0.022, 0.022, 0.56, standard(0xfff1dc, 0.4), 0, 0.13, 0.41, 14);

  handle.rotation.z = Math.PI / 2;
  group.add(handle, sphere(0.03, standard(0xfff1dc, 0.4), -0.28, 0.13, 0.41), sphere(0.03, standard(0xfff1dc, 0.4), 0.28, 0.13, 0.41));

  return { group, glow, light, rising };
}

// ---- the recipe: a dark board in a pale frame, afloat. Each ingredient and the Seeds it costs, and the cake under them.
function board() {
  const group = new THREE.Group();
  const W = 1.12;
  const H = 0.9;
  const picture = canvasTexture([896, 720], (g, w, h) => {
    g.fillStyle = '#fff1dc';
    g.beginPath();
    g.roundRect(0, 0, w, h, 110);
    g.fill();
    g.fillStyle = '#2b3050';
    g.beginPath();
    g.roundRect(34, 34, w - 68, h - 68, 80);
    g.fill();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const rows = [[2, (x, y) => { g.fillStyle = '#f0c996'; g.beginPath(); g.ellipse(x, y, 34, 44, 0, 0, TAU); g.fill(); }],
      [3, (x, y) => { g.fillStyle = '#e8203a'; g.beginPath(); g.moveTo(x - 38, y - 22); g.quadraticCurveTo(x - 44, y + 30, x, y + 46); g.quadraticCurveTo(x + 44, y + 30, x + 38, y - 22); g.quadraticCurveTo(x, y - 44, x - 38, y - 22); g.fill(); g.fillStyle = '#3fb565'; g.beginPath(); g.ellipse(x, y - 34, 30, 12, 0, 0, TAU); g.fill(); }],
      [1, (x, y) => { g.fillStyle = '#dcb886'; g.beginPath(); g.roundRect(x - 36, y - 44, 72, 88, 20); g.fill(); g.fillStyle = '#4b94ff'; g.beginPath(); g.roundRect(x - 36, y + 22, 72, 22, 10); g.fill(); }]];

    rows.forEach(([seeds, draw], i) => {
      const y = 132 + i * 128;

      draw(150, y);

      // what it costs: so many Seeds in a row
      g.strokeStyle = 'rgba(255,241,220,0.55)';
      g.lineWidth = 9;
      g.setLineDash([2, 22]);
      g.beginPath();
      g.moveTo(232, y);
      g.lineTo(330, y);
      g.stroke();
      g.setLineDash([]);

      for (let k = 0; k < seeds; k++) drawSeed(g, 400 + k * 96, y, 92, '#ffd36b', '#2b3050');
    });

    // under a line, the cake they add up to, and a tick: the budget holds
    g.strokeStyle = 'rgba(255,241,220,0.7)';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(110, 500);
    g.lineTo(w - 110, 500);
    g.stroke();
    g.fillStyle = '#ffe9bd';
    g.beginPath();
    g.roundRect(104, 590, 150, 62, 18);
    g.fill();
    g.beginPath();
    g.roundRect(132, 545, 94, 56, 16);
    g.fill();
    g.fillStyle = '#ff8fb8';
    g.beginPath();
    g.roundRect(100, 580, 158, 24, 12);
    g.fill();
    g.beginPath();
    g.roundRect(128, 536, 102, 22, 11);
    g.fill();

    for (let k = 0; k < 4; k++) drawSeed(g, 352 + k * 80, 596, 80, '#ffd36b', '#2b3050');

    g.strokeStyle = '#35e0b8';
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(680, 596);
    g.lineTo(716, 634);
    g.lineTo(786, 548);
    g.stroke();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: picture, transparent: true, toneMapped: false }));
  const glow = halo(0.85, 0x8f8aff, 0.3);

  face.position.z = 0.035;
  glow.position.z = -0.1;
  glow.renderOrder = 1;
  group.add(glow, box(W - 0.06, H - 0.06, 0.06, standard(0xfff1dc, 0.6), 0, 0, 0, 0.03), face);

  return group;
}

// ---- the mixing bowl, and the spoon that stirs by itself
function mixing() {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.7);
  const spoon = new THREE.Group();
  const stick = new THREE.Group();
  const scoop = sphere(0.07, wood, 0, 0.02, 0);

  group.add(
    lathe([[0, 0], [0.15, 0], [0.25, 0.06], [0.34, 0.2], [0.36, 0.31], [0.33, 0.31], [0.31, 0.22], [0, 0.22]], standard(C.indigo, 0.4)),
    cylinder(0.312, 0.312, 0.02, standard(0xffe9bd, 0.5), 0, 0.23, 0),
  );

  // the spoon leans in the batter and goes round
  scoop.scale.set(1, 1.4, 0.5);
  stick.add(cylinder(0.02, 0.024, 0.62, wood, 0, 0.33, 0, 12), scoop, sphere(0.024, wood, 0, 0.64, 0));
  stick.position.set(0.14, 0, 0);
  stick.rotation.z = -0.38;
  spoon.add(stick);
  spoon.position.y = 0.24;
  group.add(spoon);

  return { group, spoon };
}

const PUFF = radial([[0, 'rgba(226,232,255,0.95)'], [0.45, 'rgba(214,222,255,0.8)'], [0.8, 'rgba(190,202,250,0.3)'], [1, 'rgba(190,202,250,0)']], 128);

/** Soft puffs of flour that rise from `at`, swell and thin out. They are a little blue, so they show on a pale page too. */
function puffs(group, { loop, at, count, spread, height, size, seed }) {
  const next = sequence(seed);
  const updates = [];

  for (let i = 0; i < count; i++) {
    const puff = sprite(PUFF, 0xffffff, 6);
    const a = next() * TAU;
    const r = next() * spread;
    const start = (i + next() * 0.5) / count;
    const big = size[0] + next() * (size[1] - size[0]);
    const phase = next() * TAU;

    group.add(puff);
    updates.push((t) => {
      const rise = (start + t / loop) % 1;

      puff.position.set(at.x + Math.cos(a) * r * (0.4 + rise) + Math.sin((t / loop) * TAU + phase) * 0.04, at.y + rise * height, at.z + Math.sin(a) * r * 0.5);
      puff.scale.setScalar(big * (0.5 + rise * 0.9));
      puff.material.opacity = Math.sin(rise * Math.PI) ** 0.8;
    });
  }

  return (t) => { for (const update of updates) update(t); };
}

/** Stars that twinkle at set places `[x, y, z, size]`: Dina's, put by hand beside and above her, never over her. */
function twinkles(group, loop, places, peak) {
  const stars = places.map(([x, y, z, size], i) => {
    const star = sprite(TEXTURES.star, [0xffffff, 0xfff0b8][i % 2]);

    star.position.set(x, y, z);
    group.add(star);

    return { star, size, phase: i * 2.1, speed: 1 + (i % 3) };
  });

  return (t) => {
    const near = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 1.1);

    for (const { star, size, phase, speed } of stars) {
      const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;

      star.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
      star.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
      star.material.rotation = phase + (t / loop) * TAU * 0.5;
    }
  };
}

export function build(scene, { loop, heights, curve, jump, tuck, X, Y }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const baked = cake();
  const stove = oven();
  const bowl = mixing();
  const cakeAt = new THREE.Vector3(ISLAND.x, ISLAND.top + baked.top, ISLAND.z);

  set.add(place(floor(), 0, FLOOR.z), shadowCatcher(FLOOR.radius - 0.08, 0.008, FLOOR.z, 0.3));
  set.add(decal(radial([[0, 'rgba(70,50,150,0.3)'], [0.6, 'rgba(70,50,150,0.16)'], [0.85, 'rgba(70,50,150,0.04)'], [1, 'rgba(70,50,150,0)']]), 0, -0.52, FLOOR.z, 4.1, 4.1, 0));
  set.add(place(island(), ISLAND.x, ISLAND.z), place(baked.group, ISLAND.x, ISLAND.z, 0, ISLAND.top), place(stove.group, OVEN.x, OVEN.z, 0.25), place(bowl.group, OVEN.x, OVEN.z, 0, BOWL.y));

  const recipe = place(board(), BOARD.x, BOARD.z, -0.3, BOARD.y);

  set.add(recipe);

  // a warm lamp over the cake
  const lamp = new THREE.PointLight(0xffe2b0, 3, 5, 1.7);

  lamp.position.set(ISLAND.x, 2.5, ISLAND.z + 0.9);
  set.add(lamp);

  // the last piece: a large Seed that waits over the cake, comes down onto it, and lifts off again before the loop ends
  const topper = seedMesh(0.4);
  const topperGlow = halo(0.5, 0xffd36b, 0.6);
  const flash = sprite(TEXTURES.star, 0xffe08a, 7);

  topper.castShadow = false;
  topper.material.emissive.set(0x6a4a10);
  topper.material.emissiveIntensity = 0.6;
  fx.add(topper, topperGlow, flash);

  // sprinkles thrown up when it lands: they fall back onto the worktop and are gone
  const next = sequence(29);
  const sprinkles = Array.from({ length: 30 }, (_, i) => {
    const dot = sphere(0.028, new THREE.MeshBasicMaterial({ color: [0xff6fa5, 0xffd36b, 0x35e0b8, 0x8f8aff, 0xffffff, 0xeb7301][i % 6], transparent: true, toneMapped: false }), 0, 0, 0);
    const a = next() * TAU;

    dot.castShadow = false;
    fx.add(dot);

    return { dot, vx: Math.cos(a) * (0.25 + next() * 0.5), vz: Math.sin(a) * 0.25, vy: 1.9 + next() * 1.5, delay: next() * 0.12 };
  });

  // what is still to go in, flying over in an arch: each piece appears at the left end, crosses and is gone at the right
  const ring = [egg(), strawberry(1.25), flourBag(), whisk(), egg(), butter()].map((item, i, all) => {
    const holder = new THREE.Group();

    holder.add(item);
    holder.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    fx.add(holder);

    return { holder, item, at: i / all.length, spin: 1 + (i % 2), lean: (i % 3 - 1) * 0.3 };
  });

  const cast = {
    // Liruf has his eyes on the cake and jumps the highest when it is done
    liruf: { x: -1.6, z: -0.05, yaw: 0.36, act: {
      hop: jump(2.15, 0.3), tuck: tuck(2.15, 0.9), yaw: [[0, 0.5], [3.4, 0.5], [4.4, 0], [5.4, -0.3], [6.6, 0.2], [L, 0.5]],
      pitch: [[0, -0.1], [2.15, -0.3], [2.8, -0.06], [4.4, -0.42], [6.4, -0.42], [7.2, -0.1], [L, -0.1]], lean: [[0, 0.1], [1.7, 0.14], [2.15, -0.12], [2.7, 0.08], [L, 0.1]],
      roll: [[0, 0.12], [2.15, -0.1], [4.4, 0.14], [L, 0.12]], tilt: [[0, 0.05], [2.15, -0.08], [3, 0.05], [L, 0.05]],
    } },
    // Zara turns to the cake and claps
    zara: { x: -0.66, z: 0.4, yaw: 0.12, act: {
      hop: [[0, 0], [1.9, 0], [2.1, -0.03], [2.35, 0.14], [2.65, 0], [3.0, 0.08], [3.3, 0], [L, 0]], tuck: [[0, 0], [2.1, 0], [2.35, 0.3], [2.65, 0], [L, 0]],
      turn: [[0, 0.3], [1.6, 0.3], [2.6, 0.1], [5.6, 0.1], [6.8, 0.3], [L, 0.3]], yaw: [[0, 0.4], [1.8, 0.4], [2.6, 0], [5.6, 0], [6.8, 0.4], [L, 0.4]],
      lean: [[0, 0], [2.35, -0.1], [3.2, 0], [L, 0]], roll: [[0, 0.06], [2.35, -0.1], [4, 0.1], [L, 0.06]], pitch: [[0, -0.06], [2.35, -0.2], [3.3, -0.06], [L, -0.06]],
    } },
    // Rho breathes the smell in, nose up, and jumps a beat late
    rho: { x: 0.96, z: 0.45, yaw: -0.14, act: {
      hop: jump(2.45, 0.18), tuck: tuck(2.45, 0.7), turn: [[0, -0.2], [1.8, -0.2], [2.45, 0], [5.6, 0], [6.8, -0.2], [L, -0.2]],
      pitch: [[0, -0.2], [0.9, -0.34], [1.8, -0.2], [2.45, -0.3], [2.95, 0.14], [3.6, -0.1], [5.6, -0.1], [6.6, -0.34], [L, -0.2]],
      lean: [[0, -0.06], [0.9, -0.12], [1.8, -0.04], [2.45, -0.16], [2.95, 0.08], [3.6, -0.03], [L, -0.06]], roll: [[0, -0.08], [2.45, 0.1], [4.4, -0.1], [L, -0.08]], tilt: [[0, 0], [2.45, 0.07], [3.2, 0], [L, 0]],
    } },
    // Dina follows what flies over her with her nose, and rears up at the cake
    dina: { x: 2.14, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.6, 0.12), rear: [[0, 0], [2.15, 0], [2.6, 1], [3.3, 0], [L, 0]],
      yaw: [[0, 0.45], [1.6, 0.2], [2.6, -0.3], [4.2, -0.3], [5.4, 0.1], [6.8, 0.5], [L, 0.45]], pitch: [[0, -0.4], [1.6, -0.3], [2.6, -0.42], [3.4, -0.16], [4.4, -0.14], [5.6, -0.4], [L, -0.4]],
      roll: [[0, 0.2], [2.6, -0.1], [5, 0.2], [L, 0.2]],
    } },
  };
  const peaks = { liruf: 2.15, zara: 2.35, rho: 2.45, dina: 2.6 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, name, height: heights[name], peak: peaks[name] }));
  const claps = [[0, 0], [1.9, 0], [2.3, 1], [4.6, 1], [5.3, 0], [L, 0]];
  const effects = [
    sparkles(fx, { loop, actors: actors.filter(({ name }) => name === 'liruf' || name === 'zara'), each: 6, colors: [0xffffff, 0xfff0b8, 0xffc9de] }),
    twinkles(fx, loop, [[cast.rho.x - 0.1, 1.95, 0.6, 0.16], [cast.rho.x - 0.62, 0.7, 0.6, 0.14]], peaks.rho),
    twinkles(fx, loop, [[cast.dina.x + 1.2, 1.55, 0.2, 0.17], [cast.dina.x - 0.2, 2.3, 0.2, 0.15], [cast.dina.x + 1.25, 0.6, 0.3, 0.13], [cast.dina.x + 0.7, 2.1, 0.2, 0.19]], peaks.dina),
    landings(fx, { actors: actors.filter(({ peak }) => peak !== peaks.zara), color: 0xfff3dd }),
    // flour out of the bowl, warm specks in front of the oven
    puffs(fx, { loop, at: { x: OVEN.x, y: BOWL.y + 0.36, z: OVEN.z }, count: 6, spread: 0.3, height: 1.0, size: [0.28, 0.42], seed: 7 }),
    rising(fx, { loop, at: { x: OVEN.x + 0.25, y: 0.3, z: OVEN.z + 0.55 }, radius: 0.35, height: 1.0, count: 12, color: [0xffc46b, 0xfff0b8], size: [0.03, 0.06], seed: 21 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.3,
    camera: { y: 2.3, dist: 14.6, lookY: 1.38 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const ease = (u) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };
      // the Seed: waiting above, down in a third of a second, a small squash, and up again near the loop's end
      const fall = Math.min(1, Math.max(0, (t - LANDS + 0.32) / 0.32)) ** 2;
      const up = 1 - fall + ease((t - 6.5) / 1.2);
      const since = t - LANDS;
      const squash = since > 0 && since < 0.5 ? Math.sin(since * 20) * 0.14 * Math.exp(-since * 7) : 0;

      topper.position.set(cakeAt.x, cakeAt.y + 0.21 + up * 0.45 + (up > 0.02 ? Math.sin(w * 2) * 0.03 : 0), cakeAt.z);
      topper.rotation.y = up > 0.02 ? w * 2 : 0.4;
      topper.scale.set(0.4 * (1 + squash), 0.4 * (1 - squash), 0.4 * (1 + squash));
      topperGlow.position.copy(topper.position);
      topperGlow.material.opacity = 0.35 + (1 - up) * 0.3;
      flash.position.copy(topper.position);
      flash.visible = since > 0 && since < 0.9;
      flash.scale.setScalar(0.6 + since * 2.6);
      flash.material.opacity = Math.max(0, 1 - since / 0.9);
      flash.material.rotation = since * 1.5;
      lamp.intensity = 3 + Math.max(0, 1 - Math.abs(since - 0.2) / 0.8) * 5;

      for (const { dot, vx, vz, vy, delay } of sprinkles) {
        const s = since - delay;

        dot.visible = s > 0 && s < 1.25;
        dot.position.set(cakeAt.x + vx * s, Math.max(ISLAND.top + 0.03, cakeAt.y + 0.1 + vy * s - 3.2 * s * s), cakeAt.z + 0.1 + vz * s);
        dot.material.opacity = Math.min(1, (1.25 - s) / 0.35);
      }

      // each ingredient crosses the arch once in the loop, turning on itself
      for (const { holder, item, at, spin, lean } of ring) {
        const u = (at + t / loop) % 1;

        holder.position.set(ARCH.x - Math.cos(u * Math.PI) * ARCH.reach, ARCH.y + Math.sin(u * Math.PI) * ARCH.rise + Math.sin(w * 2 + at * TAU) * 0.04, ARCH.z);
        holder.scale.setScalar(Math.min(1, Math.sin(u * Math.PI) * 3.2));
        item.rotation.set(lean + Math.sin(w + at * TAU) * 0.2, w * spin + at * TAU, lean * 0.6);
      }

      bowl.spoon.rotation.y = -w * 4;
      recipe.position.y = BOARD.y + Math.sin(w + 1) * 0.04;
      stove.glow.material.opacity = 0.42 + Math.sin(w * 3) * 0.08;
      stove.light.intensity = 4 + Math.sin(w * 3) * 0.6;
      stove.rising.scale.y = 1 + 0.12 * Math.sin(w);

      // Zara claps: her elbows stay at her sides (her hair hangs over her arms and would be pulled by them), her
      // forearms come up and her open hands beat toward each other
      const clap = curve(claps, t);
      const beat = clap * (0.5 + 0.5 * Math.sin(w * 16));

      for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        rigs.zara.rot(`${side}Arm`, X, -clap * 0.15);
        rigs.zara.rot(`${side}ForeArm`, Y, -sign * clap * (0.3 + beat * 0.5));
        rigs.zara.rot(`${side}ForeArm`, X, -clap * 2.0);
      }

      for (const effect of effects) effect(t);
    },
  };
}
