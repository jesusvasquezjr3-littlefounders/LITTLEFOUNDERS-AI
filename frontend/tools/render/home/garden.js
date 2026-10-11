// Home composition "garden": the four mentors in a garden of sunflowers, where what is saved grows. The moment: the
// tallest sunflower opens, with Seeds in its face.
//
// The setting is an island: a round piece of lawn with a path of pale earth in its middle (the mentors' room, where
// nothing else stands) and earth underneath. Every plant grows out of a round mound of soil, and the mounds tell the
// story from the front to the back: Seeds just planted, sprouts, a young plant in bud, and sunflowers taller than
// the mentors. On the left a wheelbarrow full of Seeds, a bee over it; on the right a watering can floats and pours by itself over
// the young plant. Bees fly between the flowers, and a warm glow of sun sits behind the tallest one.
//
// No money is shown anywhere, only Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.35, z: -0.5 };
const HERO = { x: 0.26, z: -2.6, height: 2.62 };
const BARROW = { x: -2.68, z: 0.25 };
const CAN = { x: 2.42, y: 2.5, z: -1.0 };
const BUD = { x: 3.08, z: -1.1, height: 1.15 };
const TALL = { x: -2.3, z: -2.4 };
const OPENS = 1.55; // the second the tallest sunflower starts to open

// every mound of soil: where it is, how large, and what grows out of it
const MOUNDS = [
  [HERO.x, HERO.z, 0.42], [TALL.x, TALL.z, 0.27], [BUD.x, BUD.z, 0.34],
  [1.8, 2.1, 0.25], [0.95, 2.45, 0.25], [0.05, 2.58, 0.25],
];

const GREEN = standard(0x3aa655, 0.75);
const GREEN_DEEP = standard(0x2c8a48, 0.8);
const SOIL = standard(0x7a4a2a, 0.95);
const PETAL = [standard(0xffc21f, 0.55), standard(0xffd84d, 0.55)];
const FACE = standard(0xc97a26, 0.8);

// ---- the ground: lawn, a path of pale earth, darker soil around each mound
function ground() {
  const group = new THREE.Group();
  const next = sequence(57);
  const R = GROUND.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const px = (v) => ((v / R + 1) / 2) * w;
    const metres = (v) => (v / R) * (w / 2);

    g.fillStyle = '#7ccf62';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 130;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(168,232,120,0.5)' : 'rgba(70,168,84,0.4)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // the path: pale earth, soft at its edge
    g.save();
    g.translate(px(0.1), px(0.75));
    g.scale(1, 0.5);

    const path = g.createRadialGradient(0, 0, 0, 0, 0, metres(2.35));

    path.addColorStop(0, 'rgba(243,220,172,1)');
    path.addColorStop(0.8, 'rgba(236,208,154,1)');
    path.addColorStop(1, 'rgba(236,208,154,0)');
    g.fillStyle = path;
    g.fillRect(-w, -w, w * 2, w * 2);
    g.restore();

    // dug soil around each mound
    for (const [x, z, r] of MOUNDS) {
      const at = [px(x), px(z - GROUND.z)];
      const soil = g.createRadialGradient(at[0], at[1], 0, at[0], at[1], metres(r * 1.75));

      soil.addColorStop(0, 'rgba(110,66,36,1)');
      soil.addColorStop(0.72, 'rgba(126,78,44,0.95)');
      soil.addColorStop(1, 'rgba(126,78,44,0)');
      g.fillStyle = soil;
      g.beginPath();
      g.arc(at[0], at[1], metres(r * 1.75), 0, TAU);
      g.fill();
    }

    // daisies in the lawn, none on the path
    for (let i = 0; i < 170; i++) {
      const x = next() * w;
      const y = next() * w;

      if (((x - px(0.1)) / metres(2.5)) ** 2 + ((y - px(0.75)) / metres(1.3)) ** 2 < 1) continue;

      g.fillStyle = ['#ffffff', '#fff3a8', '#ffd0e4', '#ffffff'][i % 4];
      g.beginPath();
      g.arc(x, y, 5 + next() * 5, 0, TAU);
      g.fill();
    }
  });
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), standard(0xffffff, 0.95, { map: picture }));

  top.receiveShadow = true;
  group.add(top, lathe([[0, -0.9], [1.2, -0.86], [2.3, -0.62], [3.0, -0.32], [R - 0.04, -0.1], [R, -0.02]], standard(C.earth, 0.95)));

  // a soft lip of grass over the edge, so the island has no rim
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x62bb55, 0.95), 0, -0.07, 0);

  lip.rotation.x = Math.PI / 2;
  group.add(lip);

  return group;
}

const mound = (radius) => sphere(radius, SOIL, 0, 0, 0, 0.42);

/** A round leaf on a short stalk, growing out along +x. */
function leaf(length, material = GREEN) {
  const group = new THREE.Group();
  const blade = sphere(1, material, length * 0.58, 0, 0);

  blade.scale.set(length * 0.5, length * 0.1, length * 0.36);
  blade.rotation.x = 0.95;
  group.add(blade);

  return group;
}

// ---- a sunflower: a stem with round leaves and a head whose petals can fold over its face. The face holds Seeds.
function sunflower(height, size, seed, leaves) {
  const group = new THREE.Group();
  const next = sequence(seed);
  const bend = (next() - 0.5) * 0.3;
  const top = [bend * 0.4, height, 0.06];
  const head = new THREE.Group();
  const petals = [];

  group.add(tube([[0, 0, 0], [bend, height * 0.35, 0], [bend * 1.1, height * 0.7, 0.02], top], 0.035 + size * 0.04, GREEN, 32));

  // its leaves: how far up the stem, which side, how long
  for (const [i, [up, side, length]] of leaves.entries()) {
    const one = leaf(length, i % 2 ? GREEN_DEEP : GREEN);

    one.position.set(bend * (0.4 + up * 0.7), height * up, 0.03);
    one.rotation.set(0, side > 0 ? -0.35 : Math.PI + 0.35, 0.3);
    group.add(one);
  }

  head.position.set(top[0], top[1], top[2] + size * 0.14);
  head.add(sphere(size * 0.5, GREEN_DEEP, 0, 0, -size * 0.1, 1), cylinder(size * 0.52, size * 0.52, size * 0.1, FACE, 0, 0, 0, 48));
  head.children[0].scale.set(1, 1, 0.42);
  head.children[1].rotation.x = Math.PI / 2;

  const dome = sphere(size * 0.5, FACE, 0, 0, size * 0.04);

  dome.scale.set(1, 1, 0.2);
  head.add(dome);

  // Seeds in its face: one in the middle and two rings, their points outward
  for (const [count, radius, tall] of [[1, 0, 0.26], [6, 0.19, 0.24], [11, 0.37, 0.23]]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + radius * 4;
      const one = seedMesh(size * tall);

      one.position.set(Math.cos(a) * radius * size, Math.sin(a) * radius * size, size * 0.14 - radius * size * 0.1);
      one.rotation.z = a - Math.PI / 2;
      one.castShadow = false;
      head.add(one);
    }
  }

  // two rows of round petals, each on its own hinge
  for (const [row, count, length] of [[0, 15, 0.62], [1, 15, 0.5]]) {
    for (let i = 0; i < count; i++) {
      const spoke = new THREE.Group();
      const hinge = new THREE.Group();
      const petal = sphere(1, PETAL[row], size * length * 0.5, 0, 0);

      petal.scale.set(size * length * 0.55, size * 0.15, size * 0.035);
      spoke.rotation.z = ((i + row * 0.5) / count) * TAU;
      hinge.position.set(size * 0.44, 0, row ? size * 0.05 : 0);
      hinge.add(petal);
      spoke.add(hinge);
      head.add(spoke);
      petals.push({ hinge, row, phase: next() * TAU });
    }
  }

  group.add(head);

  /** `open` from 0 (a bud, the petals folded over the face) to 1 (wide open). */
  const set = (open, w = 0) => {
    for (const { hinge, row, phase } of petals) hinge.rotation.y = -(1 - open) * (2.05 - row * 0.2) - row * 0.16 + Math.sin(w * 2 + phase) * 0.03 * open;
  };

  set(1);

  return { group, head, set };
}

// ---- a sprout: a short stem and two round leaves
function sprout(height) {
  const group = new THREE.Group();

  group.add(tube([[0, 0, 0], [0.015, height * 0.5, 0], [0, height, 0]], 0.022, GREEN, 12));

  for (const side of [-1, 1]) {
    const one = leaf(height * 0.85, side > 0 ? GREEN : GREEN_DEEP);

    one.position.y = height * 0.96;
    one.rotation.set(0, side > 0 ? 0 : Math.PI, 0.55);
    group.add(one);
  }

  return group;
}

// ---- the young plant: a stem, leaves, and a round green bud showing a little yellow
function young(height) {
  const group = new THREE.Group();
  const top = new THREE.Group();

  group.add(tube([[0, 0, 0], [0.04, height * 0.5, 0], [0, height, 0]], 0.04, GREEN, 20));

  for (let i = 0; i < 4; i++) {
    const one = leaf(0.4 - i * 0.04, i % 2 ? GREEN_DEEP : GREEN);

    one.position.set(0.02, height * (0.3 + i * 0.17), 0);
    one.rotation.set(0, i % 2 ? -0.5 : Math.PI + 0.4, 0.4);
    group.add(one);
  }

  top.position.y = height;
  top.add(sphere(0.15, GREEN_DEEP, 0, 0.1, 0, 0.95), sphere(0.09, PETAL[1], 0, 0.2, 0, 0.8));
  group.add(top);

  return { group, top };
}

// ---- the wheelbarrow: a round tub heaped with Seeds, one wheel, two handles
function wheelbarrow() {
  const group = new THREE.Group();
  const paint = standard(C.indigo, 0.45);
  const wood = standard(C.wood, 0.7);
  const dark = standard(C.slate, 0.6);
  const next = sequence(19);
  const tub = lathe([[0, 0], [0.26, 0], [0.38, 0.08], [0.47, 0.3], [0.5, 0.36], [0.47, 0.4], [0.4, 0.37], [0, 0.37]], paint, 0, 0.3, 0);
  const heap = sphere(0.42, standard(0x2d2a4a, 0.6), 0, 0.66, 0, 0.42);
  const wheel = mesh(new THREE.TorusGeometry(0.17, 0.065, 16, 48), dark, 0.78, 0.235, 0);

  tub.scale.x = 1.3;
  heap.scale.x = 1.3;
  group.add(tub, heap, wheel, sphere(0.1, standard(C.gold, 0.4), 0.78, 0.235, 0, 1));
  group.children[3].scale.z = 0.9;

  for (let i = 0; i < 22; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(i / 22);
    const one = seedMesh(0.2 + next() * 0.05);

    one.position.set(Math.cos(a) * r * 0.46, 0.7 + (1 - r * r) * 0.15, Math.sin(a) * r * 0.34);
    one.rotation.set((next() - 0.5) * 1.6, next() * TAU, 1.2 + (next() - 0.5) * 1.2);
    group.add(one);
  }

  for (const side of [-1, 1]) {
    // the handle runs under the tub from the wheel to the grip; a leg holds the back up
    group.add(
      tube([[0.78, 0.235, side * 0.12], [0.4, 0.33, side * 0.3], [-0.5, 0.43, side * 0.36], [-1.0, 0.56, side * 0.36]], 0.03, wood, 24),
      sphere(0.05, dark, -1.02, 0.565, side * 0.36, 1),
      tube([[-0.34, 0.4, side * 0.34], [-0.38, 0.2, side * 0.36], [-0.36, 0.03, side * 0.36]], 0.028, dark, 12),
    );
  }

  group.scale.setScalar(0.76);

  return group;
}

// ---- the watering can: a round body, a long spout with a rose, a round handle. Its spout points along +x.
function wateringCan() {
  const group = new THREE.Group();
  const paint = standard(C.sky, 0.4);
  const brass = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const handle = mesh(new THREE.TorusGeometry(0.16, 0.028, 14, 40, Math.PI), paint, -0.24, 0.2, 0);
  const rose = sphere(0.085, brass, 0.6, 0.47, 0, 1);
  const mouth = new THREE.Object3D();

  handle.rotation.z = Math.PI / 2;
  rose.scale.set(0.55, 1, 1);
  rose.rotation.z = 0.75;
  mouth.position.set(0.64, 0.5, 0);
  group.add(
    lathe([[0, 0], [0.22, 0], [0.26, 0.05], [0.26, 0.32], [0.22, 0.4], [0.15, 0.42], [0, 0.42]], paint),
    mesh(new THREE.TorusGeometry(0.15, 0.022, 12, 40), brass, 0, 0.42, 0),
    tube([[0.2, 0.1, 0], [0.38, 0.24, 0], [0.58, 0.455, 0]], 0.04, paint, 16),
    handle, rose, mouth,
  );
  group.children[1].rotation.x = Math.PI / 2;

  return { group, mouth };
}

// ---- a bee: a round striped body and two wings
const STRIPES = canvasTexture([64, 64], (g, w, h) => {
  ['#ffc21f', '#2b2440', '#ffc21f', '#2b2440', '#ffc21f', '#2b2440'].forEach((color, i, all) => {
    g.fillStyle = color;
    g.fillRect(0, (i / all.length) * h, w, h / all.length + 1);
  });
});

function bee() {
  const group = new THREE.Group();
  const body = sphere(0.085, standard(0xffffff, 0.6, { map: STRIPES }), 0, 0, 0, 1);
  const pale = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false });
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), pale);

    wing.position.set(0, 0.07, 0);
    wing.scale.x = 0.62;
    hinge.position.set(-0.01, 0.06, side * 0.03);
    hinge.add(wing);
    group.add(hinge);

    return { hinge, side };
  });

  // the stripes run around the body's length
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 1.3, 1);
  body.castShadow = false;
  group.add(body, sphere(0.022, standard(0x2b2440, 0.5), 0.1, 0.02, 0.035, 1), sphere(0.022, standard(0x2b2440, 0.5), 0.1, 0.02, -0.035, 1));

  return { group, wings };
}

// ---- stars that twinkle beside the mentors and over their heads, never on them: in each gap between two
// neighbours and above each head, brightest in the second around that mentor's jump
const REACH = { liruf: [0.5, 0.5, 0, 2.0], zara: [0.34, 0.34, 0, 2.15], rho: [0.42, 0.42, 0, 1.92], dina: [0.9, 0.62, -0.42, 2.3] };

function twinkles(group, { loop, cast, peaks, colors = [0xffffff, 0xfff0b8, 0xdcd9ff], top = {} }) {
  const next = sequence(11);
  const names = Object.keys(cast).sort((a, b) => cast[a].x - cast[b].x);
  const stars = [];

  for (const [i, name] of names.entries()) {
    const [, right, head, above] = REACH[name];
    const after = names[i + 1];

    // over the head, a little to each side
    for (const side of [-1, 1]) stars.push([cast[name].x + head + side * (0.12 + next() * 0.2), (top[name] ?? above) + next() * 0.3, cast[name].z + 0.3, peaks[name]]);

    if (!after) continue;

    const from = cast[name].x + right;
    const to = cast[after].x - REACH[after][0];

    // in the gap to the next mentor, if there is one
    if (to - from > 0.14) for (const y of [0.55, 1.05]) stars.push([(from + to) / 2, y + next() * 0.2, Math.max(cast[name].z, cast[after].z) + 0.35, peaks[i % 2 ? after : name]]);
  }

  const updates = stars.map(([x, y, z, peak], i) => {
    const s = sprite(TEXTURES.star, colors[i % colors.length]);
    const size = 0.11 + next() * 0.12;
    const speed = 1 + Math.floor(next() * 3);
    const phase = next() * TAU;

    group.add(s);

    return (t) => {
      const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;
      const near = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 1.1);

      s.position.set(x, y + Math.sin((t / loop) * TAU + phase) * 0.05, z);
      s.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
      s.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
      s.material.rotation = phase + (t / loop) * TAU * 0.5;
    };
  });

  return (t) => { for (const update of updates) update(t); };
}

export function build(scene, tools) {
  const { loop, heights, jump, tuck, curve } = tools;
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const hero = sunflower(HERO.height, 0.62, 3, [[0.6, 1, 0.4], [0.655, -1, 0.3]]);
  const tall = sunflower(2.5, 0.52, 7, [[0.5, -1, 0.42], [0.62, -1, 0.36]]);
  const bud = young(BUD.height);
  const can = wateringCan();

  set.add(place(ground(), 0, GROUND.z), shadowCatcher(GROUND.radius - 0.1, 0.008, GROUND.z, 0.32));
  set.add(decal(radial([[0, 'rgba(40,60,120,0.28)'], [0.6, 'rgba(40,60,120,0.14)'], [1, 'rgba(40,60,120,0)']]), 0, -0.95, GROUND.z, 3.5, 2.3, 0));

  for (const [x, z, r] of MOUNDS) set.add(place(mound(r), x, z));

  hero.head.rotation.x = 0.12;
  tall.head.rotation.set(0.1, 0.3, 0);
  set.add(
    place(hero.group, HERO.x, HERO.z, 0, 0.1), place(tall.group, TALL.x, TALL.z, 0, 0.1),
    place(bud.group, BUD.x, BUD.z, 0.4, 0.1), place(wheelbarrow(), BARROW.x, BARROW.z, -1.2),
    place(sprout(0.23), 0.05, 2.58, 0.5, 0.08),
  );

  // Seeds just planted: half in the soil, the point up
  for (const [x, z, lean] of [[0.95, 2.45, 0.25], [1.8, 2.1, -0.3]]) {
    const planted = seedMesh(0.3);

    planted.position.set(x, 0.16, z);
    planted.rotation.set(0.1, 0.5, lean);
    set.add(planted);
  }

  can.group.rotation.z = -0.5;
  set.add(can.group);

  // the sun behind the tallest sunflower: a warm glow and soft rays that turn slowly
  const sun = halo(1.15, 0xffd36b, 0.55);
  const rays = sprite(canvasTexture([512, 512], (g, s) => {
    g.translate(s / 2, s / 2);

    for (let i = 0; i < 12; i++) {
      const fade = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.5);

      fade.addColorStop(0, 'rgba(255,255,255,0.55)');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = fade;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, s * 0.5, (i / 12) * TAU - 0.09, (i / 12) * TAU + 0.09);
      g.closePath();
      g.fill();
    }
  }), 0xffe08a, 1);
  const sunLight = new THREE.PointLight(0xffd070, 5, 5, 1.8);
  const flash = sprite(TEXTURES.ring, 0xfff0b8, 7);
  const headAt = new THREE.Vector3(HERO.x, HERO.height + 0.1, HERO.z);

  sun.position.set(headAt.x, headAt.y, headAt.z - 0.4);
  sun.renderOrder = 1;
  rays.position.copy(sun.position);
  flash.position.set(headAt.x, headAt.y, headAt.z + 0.5);
  sunLight.position.set(headAt.x, headAt.y - 0.3, headAt.z + 1.2);
  fx.add(sun, rays, flash, sunLight);

  // the water: drops that leave the rose and fall on the young plant
  const water = lit(0x6fb6ff, 0.5, { roughness: 0.2 });
  const drops = Array.from({ length: 16 }, (_, i) => {
    const drop = sphere(0.03 + (i % 3) * 0.008, water, 0, 0, 0, 1.25);

    drop.castShadow = false;
    fx.add(drop);

    return { drop, at: i / 16, fan: ((i * 7) % 5) / 4 - 0.5 };
  });

  const POINT = [[0, 0], [1.5, 0], [2.0, 1], [4.6, 1], [5.3, 0], [L, 0]];
  const cast = {
    // Liruf counts the Seeds in the wheelbarrow, then turns to the flower and jumps
    liruf: { x: -1.5, z: -0.05, yaw: 0.3, act: {
      hop: jump(2.55, 0.28), tuck: tuck(2.55, 0.85), yaw: [[0, -0.6], [1.5, -0.6], [2.2, 0.4], [4.8, 0.4], [6, -0.6], [L, -0.6]],
      pitch: [[0, 0.16], [1.5, 0.16], [2.3, -0.3], [4.8, -0.2], [6, 0.16], [L, 0.16]], roll: [[0, -0.14], [2.5, 0.12], [5, -0.14], [L, -0.14]],
      lean: [[0, 0.14], [1.6, 0.14], [2.55, -0.12], [3.2, 0.06], [6, 0.14], [L, 0.14]], tilt: [[0, -0.06], [2.55, 0.08], [3.4, 0], [L, -0.06]],
    } },
    // Zara shows the reader the flower that opens: one arm up toward it, the other at her side
    zara: { x: -0.62, z: 0.42, yaw: 0.12, act: {
      hop: jump(2.2, 0.16), tuck: tuck(2.2, 0.5), lean: [[0, 0], [2.2, -0.1], [3, 0], [L, 0]], roll: [[0, 0.06], [2.0, -0.14], [4.6, -0.14], [5.4, 0.06], [L, 0.06]],
      pitch: [[0, -0.06], [2.0, -0.2], [4.6, -0.14], [5.4, -0.06], [L, -0.06]], yaw: [[0, 0], [2.0, 0.3], [4.6, 0.3], [5.4, 0], [L, 0]], tilt: [[0, 0], [2.0, -0.05], [5, 0], [L, 0]],
    } },
    // Rho follows a bee with his eyes, and jumps a beat after the others
    rho: { x: 0.82, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.8, 0.18), tuck: tuck(2.8, 0.7), yaw: [[0, 0.3], [2, -0.3], [4, 0.1], [6, 0.5], [L, 0.3]], pitch: [[0, -0.3], [2, -0.26], [2.8, -0.38], [3.3, 0.06], [4, -0.22], [6, -0.32], [L, -0.3]],
      lean: [[0, -0.05], [2.8, -0.15], [3.25, 0.08], [3.9, -0.05], [L, -0.05]], roll: [[0, 0.1], [2, -0.1], [4, 0.08], [6, -0.06], [L, 0.1]], tilt: [[0, 0], [2.8, 0.07], [3.6, 0], [L, 0]],
    } },
    // Dina rears up toward the flower, then sniffs the air after the bees
    dina: { x: 1.95, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.4, 0.12), rear: [[0, 0], [1.9, 0], [2.4, 1], [3.1, 0], [L, 0]], pitch: [[0, -0.18], [2.4, -0.44], [3.2, -0.2], [5, -0.3], [L, -0.18]],
      roll: [[0, 0.18], [2.4, -0.1], [4.4, 0.2], [L, 0.18]], yaw: [[0, 0.35], [2, 0.1], [4.2, 0.4], [6, 0.2], [L, 0.35]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.55, zara: 2.2, rho: 2.8, dina: 2.4 }[name] }));
  // bees, each on its own closed path above the mentors
  const bees = [[1.62, 2.8, -1.0, 0.3, 0.6], [-1.22, 2.95, -1.3, 0.34, 2.6], [-2.78, 1.2, 0.35, 0.14, 4.4]].map(([x, y, z, reach, phase]) => {
    const one = bee();

    fx.add(one.group);

    return { ...one, x, y, z, reach, phase };
  });
  const effects = [
    twinkles(fx, { loop, cast, peaks: { liruf: 2.55, zara: 2.2, rho: 2.8, dina: 2.4 } }),
    landings(fx, { actors, color: 0xf7e6c0 }),
    // pollen all through the garden, and golden stars rising from the flower that opened
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -0.9 }, radius: 3.0, height: 2.6, count: 28, color: [0xfff2a0, 0xffffff, 0xffe08a], size: [0.03, 0.065], seed: 6, sway: 0.14, depth: 0.7 }),
    rising(fx, { loop, at: { x: HERO.x, y: HERO.height - 0.2, z: HERO.z + 0.5 }, radius: 0.8, height: 1.0, count: 14, color: [0xffe6a3, 0xffffff], size: [0.06, 0.13], seed: 12, texture: TEXTURES.star }),
  ];
  const mouth = new THREE.Vector3();

  scene.add(set, fx);

  return {
    cast,
    still: 2.3,
    camera: { y: 2.3, dist: 14.1, lookY: 1.2 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      // the tallest sunflower: a bud, it opens with a small overshoot, and closes again before the loop ends
      const u = Math.max(0, Math.min(1, (t - OPENS) / 0.6));
      const closing = Math.max(0, Math.min(1, (L - 0.4 - t) / 1.3));
      const open = (u * u * (3 - 2 * u) + Math.sin(u * Math.PI) * 0.12) * closing * closing * (3 - 2 * closing);

      hero.set(open, w);
      hero.head.rotation.z = Math.sin(w) * 0.05;
      hero.head.scale.setScalar(0.9 + open * 0.1);
      tall.head.rotation.z = Math.sin(w + 1.2) * 0.06;
      tall.set(1, w);

      sun.material.opacity = 0.3 + open * 0.45;
      rays.scale.setScalar(1.9 + open * 0.6);
      rays.material.opacity = 0.2 + open * 0.5;
      rays.material.rotation = w * 0.25;
      sunLight.intensity = 0.3 + open * 1.0;

      const burst = (t - OPENS - 0.15) / 0.55;

      flash.visible = burst > 0 && burst < 1;
      flash.scale.setScalar(0.6 + burst * 1.6);
      flash.material.opacity = 0.8 * (1 - burst);

      // the can floats and pours; the young plant nods under the water
      can.group.position.set(CAN.x, CAN.y + Math.sin(w * 2) * 0.05, CAN.z);
      can.group.rotation.z = -0.5 + Math.sin(w * 2 + 0.6) * 0.05;
      can.group.updateWorldMatrix(true, true);
      can.mouth.getWorldPosition(mouth);
      bud.top.rotation.z = Math.sin(w * 4) * 0.08;
      bud.group.rotation.z = Math.sin(w * 2) * 0.03;

      for (const { drop, at, fan } of drops) {
        const fall = ((t / loop) * 8 + at) % 1;
        const land = BUD.height + 0.38;

        drop.position.set(mouth.x + (BUD.x - mouth.x) * fall + fan * 0.1 * fall, mouth.y + 0.12 * fall - (mouth.y + 0.12 - land) * fall * fall, mouth.z + (BUD.z - mouth.z) * fall + fan * 0.16 * fall);
        drop.scale.setScalar(0.6 + Math.sin(fall * Math.PI) * 0.5);
        drop.scale.y *= 1.25;
      }

      // Zara's left arm, toward the flower
      const point = curve(POINT, t);

      rigs.zara.rot('LeftArm', tools.Z, point * 2.0);
      rigs.zara.rot('LeftForeArm', tools.Z, point * 0.25);

      for (const { group, wings, x, y, z, reach, phase } of bees) {
        group.position.set(x + Math.sin(w + phase) * reach, y + Math.sin(w * 2 + phase) * reach * 0.3, z + Math.cos(w + phase) * reach * 0.4);
        group.rotation.y = Math.cos(w + phase) > 0 ? 0 : Math.PI;
        group.rotation.z = Math.sin(w * 2 + phase) * 0.2;

        for (const { hinge, side } of wings) hinge.rotation.x = side * (0.3 + Math.abs(Math.sin(w * 20 + phase)) * 0.9);
      }

      for (const effect of effects) effect(t);
    },
  };
}
