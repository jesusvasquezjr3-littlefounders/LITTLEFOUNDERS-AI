// Home composition "lemonade": the four mentors at their lemonade stand, a first business, the moment a Seed drops
// into the jar on its counter: the first sale.
//
// The setting is an island: a round lawn with daisies. At the back, on a round wooden deck, stands the stand: a
// counter under a round-topped awning striped yellow and pink, with a round slate on its front that shows the deal
// as a drawing (a glass for a Seed, never a word or a figure). On the counter, a big glass jug of lemonade, a stack
// of cups and the jar where the Seeds collect. Two masts rise from the stand and carry a string of lanterns shaped
// like lemons, which runs on to a lemon tree in a pot at the far left, where no mentor stands in front of it. The
// mentors are in two pairs with the stand between them, so the reader sees the counter and the Seed that flies over
// it. Bubbles rise from the jug, and slices of lemon float in the air.
//
// Nothing is priced: the only thing that pays is a Seed (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, glass, halo, landings, lathe, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const LAWN = { radius: 3.25, z: -0.6 };
const STAND = { x: 0.25, z: -1.95, deck: 0.18, masts: 3.2 }; // `masts`: how high the tips of its two masts are
const JAR = { x: 0.38, z: 0.14 }; // on the counter, from the stand's middle
const TREE = { x: -2.8, z: -0.9 };
const DROPS = 2.0; // the second the Seed lands in the jar

const YELLOW = 0xffd22e;
const PINK = 0xff7fae;
const LEMON = 0xffdf3a;

/** A slice of lemon, drawn: rind, pith, and eight round segments. */
function drawSlice(g, x, y, r) {
  g.fillStyle = '#f7c21c';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = '#fff8d6';
  g.beginPath();
  g.arc(x, y, r * 0.86, 0, TAU);
  g.fill();
  g.fillStyle = '#ffe14d';

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;

    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.14, y + Math.sin(a) * r * 0.14);
    g.arc(x, y, r * 0.76, a - 0.31, a + 0.31);
    g.closePath();
    g.fill();
  }
}

const slicePicture = canvasTexture([256, 256], (g, w) => drawSlice(g, w / 2, w / 2, w * 0.48));

function slice(radius) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), new THREE.MeshBasicMaterial({ map: slicePicture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));

  m.renderOrder = 6;

  return m;
}

function lemon(size, x, y, z, turn = 0) {
  const m = sphere(size, standard(LEMON, 0.5), x, y, z, 0.8);

  m.scale.set(1.25, 0.8, 0.8);
  m.rotation.y = turn;

  return m;
}

// ---- the lawn: grass mown in rings, daisies, earth underneath
function lawn() {
  const group = new THREE.Group();
  const next = sequence(61);
  const R = LAWN.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;

    g.fillStyle = '#7ed06a';
    g.fillRect(0, 0, w, w);

    // the mower went round and round: every other ring is a shade lighter
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = 'rgba(190,240,150,0.5)';
      g.lineWidth = half * 0.1;
      g.beginPath();
      g.arc(half, half, half * (0.15 + k * 0.2), 0, TAU);
      g.stroke();
    }

    for (let i = 0; i < 60; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 40 + next() * 110;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(170,232,120,0.3)' : 'rgba(60,160,84,0.22)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // daisies: a ring of round white petals around a yellow heart
    for (let i = 0; i < 46; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 9 + next() * 5;

      g.fillStyle = '#ffffff';

      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.047) * r, y + Math.sin(k * 1.047) * r, r * 0.62, 0, TAU); g.fill(); }

      g.fillStyle = '#ffcf2e';
      g.beginPath();
      g.arc(x, y, r * 0.6, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x55b458, 0.9), standard(0xffffff, 0.95, { map: picture }), standard(C.earth, 0.9)], 0, -0.05, 0);

  top.castShadow = false;
  group.add(top, lathe([[0, -1.0], [1.0, -0.92], [2.1, -0.65], [2.85, -0.33], [R - 0.04, -0.1]], standard(C.earth, 0.95)));

  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x66bf5c, 0.95), 0, -0.05, 0);

  lip.rotation.x = Math.PI / 2;
  group.add(lip);

  return group;
}

// ---- the jug: clear glass, lemonade inside with slices and ice in it, a round handle
function jug() {
  const group = new THREE.Group();
  const drink = new THREE.MeshStandardMaterial({ color: 0xffe36a, emissive: 0xffc93a, emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.9 });
  const body = lathe([[0, 0], [0.16, 0], [0.2, 0.04], [0.21, 0.3], [0.17, 0.44], [0.16, 0.5], [0.175, 0.54]], glass(0xe4f1ff, 0.3), 0, 0, 0, 48);
  const handle = mesh(new THREE.TorusGeometry(0.12, 0.022, 12, 40, Math.PI), glass(0xe4f1ff, 0.55), 0.2, 0.27, 0);

  body.castShadow = false;
  handle.rotation.z = -Math.PI / 2;
  handle.castShadow = false;
  group.add(lathe([[0, 0.02], [0.15, 0.02], [0.185, 0.06], [0.19, 0.3], [0.16, 0.4], [0, 0.4]], drink, 0, 0, 0, 48), body, handle);

  // slices against the glass, and round ice at the top
  for (const [a, y, lean] of [[0.2, 0.14, 0.2], [-0.9, 0.27, -0.3], [1.2, 0.3, 0.4]]) {
    const one = slice(0.075);

    one.position.set(Math.sin(a) * 0.192, y, Math.cos(a) * 0.192);
    one.rotation.set(0, a, lean, 'YXZ');
    group.add(one);
  }

  for (const [x, z] of [[-0.06, 0.04], [0.07, -0.02], [0, -0.08]]) group.add(sphere(0.05, glass(0xffffff, 0.6), x, 0.41, z, 0.8));

  return group;
}

/** A paper cup with stripes; `full` adds the drink, a straw and a slice on its rim. */
function cup(full = false) {
  const group = new THREE.Group();
  const paper = canvasTexture([256, 8], (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff6dc' : '#ff7fae'; g.fillRect((i / 8) * w, 0, w / 8 + 1, h); }
  });

  group.add(lathe([[0, 0], [0.042, 0], [0.047, 0.01], [0.062, 0.155], [0.066, 0.165]], standard(0xffffff, 0.7, { map: paper, side: THREE.DoubleSide }), 0, 0, 0, 32));

  if (full) {
    const straw = cylinder(0.008, 0.008, 0.2, standard(C.mint, 0.5), 0.02, 0.19, 0, 10);
    const one = slice(0.045);

    straw.rotation.z = -0.25;
    one.position.set(-0.058, 0.17, 0);
    one.rotation.y = 0.5;
    group.add(cylinder(0.058, 0.058, 0.01, standard(0xffe36a, 0.3, { emissive: 0xffc93a, emissiveIntensity: 0.3 }), 0, 0.15, 0, 32), straw, one);
  }

  return group;
}

// ---- the stand: a deck, a counter with the slate on its front, what is on the counter, the awning and two masts
function stand() {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.75);
  const pale = standard(C.woodPale, 0.75);
  const dark = standard(C.woodDark, 0.8);
  const width = 1.4;
  const top = 1.85;
  const R = 0.8;
  const ARC = 2.2;
  const reach = R * Math.sin(ARC / 2);
  const foot = R * Math.cos(ARC / 2);
  const back = -0.5;
  const middle = back + reach;
  const D = STAND.deck;

  group.add(
    lathe([[0, 0], [1.2, 0], [1.22, D * 0.55], [1.18, D * 0.9], [1.12, D], [0, D]], pale),
    box(width, 0.92, 0.62, wood, 0, D + 0.46, 0, 0.12),
    box(width + 0.1, 0.08, 0.72, dark, 0, D + 0.94, 0, 0.04),
  );

  // three boards across the front, and the slate hung in their middle
  for (const y of [0.2, 0.47, 0.74]) group.add(box(width - 0.14, 0.22, 0.05, pale, 0, D + y, 0.3, 0.05));

  group.add(place(board(0.4), 0, 0.36, 0, D + 0.47));

  // on the counter: the jug, the cups, and the jar for the Seeds
  const counter = D + 0.98;

  group.add(place(jug(), -0.34, 0.02, 0.5, counter));

  for (let i = 0; i < 3; i++) group.add(place(cup(), 0.02, -0.08, 0, counter + i * 0.045));

  const jar = new THREE.Group();
  const kept = [[-0.06, 0.1, 0.02, 0.4], [0.06, 0.09, -0.02, -0.5], [0, 0.11, 0.06, 0.1], [-0.02, 0.2, -0.03, -0.2], [0.05, 0.21, 0.04, 0.6]].map(([x, y, z, lean]) => {
    const seed = seedMesh(0.17);

    seed.position.set(x, y, z);
    seed.rotation.set(lean * 0.5, lean * 3, lean);
    seed.castShadow = false;
    jar.add(seed);

    return { seed, y };
  });
  const jarGlass = lathe([[0, 0], [0.13, 0], [0.165, 0.04], [0.17, 0.3], [0.13, 0.38], [0.13, 0.43], [0.145, 0.45]], glass(0xdcecff, 0.34), 0, 0, 0, 40);

  jarGlass.castShadow = false;
  jar.add(jarGlass, mesh(new THREE.TorusGeometry(0.135, 0.018, 10, 40), standard(C.gold, 0.35, { metalness: 0.6 }), 0, 0.43, 0));
  jar.children[jar.children.length - 1].rotation.x = Math.PI / 2;
  jar.position.set(JAR.x, counter, JAR.z);
  group.add(jar);

  // the awning: an arc of striped cloth on a hoop at each end, open underneath
  const stripes = canvasTexture([8, 512], (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff7fae' : '#ffd22e'; g.fillRect(0, (i / 8) * h, w, h / 8 + 1); }
  });
  const long = width + 0.3;
  const awning = new THREE.Group();
  const canopy = mesh(new THREE.CylinderGeometry(R, R, long, 64, 1, true, Math.PI / 2 - ARC / 2, ARC), standard(0xffffff, 0.85, { map: stripes, side: THREE.DoubleSide }));

  canopy.rotation.z = Math.PI / 2;
  awning.add(canopy);

  for (const side of [-1, 1]) {
    const hoop = mesh(new THREE.TorusGeometry(R, 0.035, 12, 64, ARC).rotateZ(Math.PI / 2 - ARC / 2), dark, side * long / 2, 0, 0);

    hoop.rotation.y = Math.PI / 2;
    awning.add(hoop);
  }

  awning.position.set(0, D + top - foot, middle);
  group.add(awning);

  for (let i = 0; i < 8; i++) {
    const scallop = new THREE.Mesh(new THREE.CircleGeometry(long / 16, 24, Math.PI, Math.PI), standard(i % 2 ? YELLOW : PINK, 0.85, { side: THREE.DoubleSide }));

    scallop.position.set(-long / 2 + (i + 0.5) * (long / 8), D + top + 0.01, middle + reach);
    scallop.castShadow = true;
    group.add(scallop);
  }

  for (const side of [-1, 1]) {
    const x = side * long / 2;

    group.add(
      cylinder(0.05, 0.055, top, dark, x, D + top / 2, back, 20),
      tube([[x, D + top - 0.7, back], [x, D + top - 0.22, back + 0.4], [x, D + top - 0.02, middle + reach - 0.06]], 0.03, dark, 24),
      sphere(0.055, dark, x, D + top, middle + reach),
      sphere(0.055, dark, x, D + top, back),
    );
  }

  // a mast grows out of each back post and leans outward: the string of lanterns hangs between their tips
  for (const side of [-1, 1]) {
    const x = side * long / 2;

    group.add(tube([[x, D + top - 0.05, back], [x + side * 0.22, D + top + 0.6, back], [x + side * 0.5, STAND.masts, back]], 0.035, dark, 32), sphere(0.06, standard(C.gold, 0.35, { metalness: 0.6 }), x + side * 0.5, STAND.masts, back));
  }

  return { group, kept, tips: [-1, 1].map((side) => new THREE.Vector3(STAND.x + side * (long / 2 + 0.5), STAND.masts, STAND.z + back)) };
}

// ---- the board: a round slate in a wooden rim, with the deal drawn on it (a glass, an arrow, a Seed)
function board(radius) {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.75);
  const picture = canvasTexture([512, 512], (g, w) => {
    g.fillStyle = '#2f3566';
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2, 0, TAU);
    g.fill();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // the glass, with its drink, a straw and a slice on the rim
    g.fillStyle = '#ffe14d';
    g.beginPath();
    g.moveTo(92, 215);
    g.lineTo(196, 215);
    g.lineTo(182, 350);
    g.lineTo(106, 350);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(82, 170);
    g.lineTo(104, 352);
    g.lineTo(184, 352);
    g.lineTo(206, 170);
    g.stroke();
    g.strokeStyle = '#35e0b8';
    g.beginPath();
    g.moveTo(150, 320);
    g.lineTo(178, 118);
    g.stroke();
    drawSlice(g, 92, 172, 40);

    // the arrow
    g.strokeStyle = '#ffffff';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(240, 262);
    g.lineTo(312, 262);
    g.moveTo(288, 232);
    g.lineTo(318, 262);
    g.lineTo(288, 292);
    g.stroke();

    // the Seed
    drawSeed(g, 400, 262, 170, '#ffd36b', '#2f3566');
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ map: picture, roughness: 0.8 }));
  const back = cylinder(radius + 0.02, radius + 0.02, 0.06, wood, 0, 0, 0, 64);

  face.position.z = 0.035;
  back.rotation.x = Math.PI / 2;
  group.add(back, mesh(new THREE.TorusGeometry(radius + 0.02, 0.05, 14, 64), wood), face);

  return group;
}

// ---- the lemon tree: a terracotta pot, a bent trunk, a tall round crown full of lemons
function tree() {
  const group = new THREE.Group();
  const clay = standard(0xd9743c, 0.8);
  const crown = new THREE.Group();
  const greens = [0x4fb565, 0x3fa55a, 0x63c877].map((color) => standard(color, 0.85));
  const next = sequence(44);

  group.add(
    lathe([[0, 0], [0.19, 0], [0.22, 0.04], [0.28, 0.4], [0.31, 0.43], [0.31, 0.5], [0.26, 0.51]], clay, 0, 0, 0, 40),
    cylinder(0.26, 0.26, 0.04, standard(C.earthDark, 0.95), 0, 0.46, 0, 40),
    tube([[0, 0.46, 0], [0.05, 0.95, 0.02], [-0.03, 1.45, 0], [0, 1.95, 0]], 0.055, standard(0x9a6a3e, 0.9), 24),
  );
  crown.position.y = 2.25;
  crown.add(sphere(0.5, greens[0], 0, 0, 0, 0.95), sphere(0.36, greens[1], -0.28, -0.16, 0.08, 0.9), sphere(0.36, greens[2], 0.28, -0.13, 0.05, 0.9), sphere(0.38, greens[2], -0.06, 0.36, 0.02, 0.9), sphere(0.3, greens[1], 0.18, 0.5, -0.06, 0.9));

  // lemons hang on the side the reader sees
  const fruit = [[-0.36, -0.3, 0.32], [0.04, -0.36, 0.4], [0.38, -0.24, 0.3], [-0.16, 0.06, 0.5], [0.24, 0.1, 0.44], [-0.36, 0.2, 0.26], [0.02, 0.5, 0.36], [0.3, 0.52, 0.2]].map(([x, y, z]) => {
    const one = lemon(0.08, x, y, z, 0);

    one.rotation.z = Math.PI / 2 + (next() - 0.5) * 0.5;
    crown.add(one);

    return one;
  });

  group.add(crown);

  return { group, crown, fruit };
}

// ---- a lantern shaped like a lemon, hanging from the string by a short thread
function lantern() {
  const group = new THREE.Group();
  const shade = sphere(0.13, standard(LEMON, 0.45, { emissive: 0xffc61a, emissiveIntensity: 0.75 }), 0, -0.27, 0);
  const glow = halo(0.3, 0xffe27a, 0.45);

  shade.scale.set(0.86, 1.2, 0.86);
  shade.castShadow = false;
  glow.position.y = -0.27;
  group.add(cylinder(0.007, 0.007, 0.12, standard(C.woodDark, 0.8), 0, -0.06, 0, 8), sphere(0.045, standard(C.leaf, 0.7), 0, -0.115, 0, 0.6), shade, glow);

  return { group, glow };
}

export function build(scene, { loop, heights, jump, tuck, X, Y, Z, curve }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const shop = stand();
  const lemons = tree();

  set.add(place(lawn(), 0, LAWN.z), shadowCatcher(LAWN.radius - 0.1, 0.008, LAWN.z, 0.3));
  set.add(decal(radial([[0, 'rgba(40,70,120,0.28)'], [0.6, 'rgba(40,70,120,0.14)'], [1, 'rgba(40,70,120,0)']]), 0, -1.05, LAWN.z, 3.8, 3.3, 0));
  set.add(place(shop.group, STAND.x, STAND.z), place(lemons.group, TREE.x, TREE.z));

  // the string of lanterns: from mast to mast over the stand, and on from the left mast into the tree's crown
  const lanterns = [];
  const string = (from, to, sag, count) => {
    const along = (u) => new THREE.Vector3().lerpVectors(from, to, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u), 0));

    set.add(tube(Array.from({ length: 13 }, (_, i) => along(i / 12).toArray()), 0.012, standard(C.woodDark, 0.8), 48));

    for (let i = 1; i <= count; i++) {
      const one = lantern();

      one.group.position.copy(along(i / (count + 1)));
      set.add(one.group);
      lanterns.push({ ...one, phase: lanterns.length * 1.3 });
    }
  };

  string(shop.tips[0], shop.tips[1], 0.34, 6);
  string(shop.tips[0], new THREE.Vector3(TREE.x + 0.3, 2.85, TREE.z + 0.1), 0.2, 3);

  // the sun on the stand: a warm light from the front, so the jug and the jar shine
  const sun = new THREE.PointLight(0xfff0b0, 6, 6, 1.7);

  sun.position.set(STAND.x, 2.2, 0.2);
  set.add(sun);

  const cast = {
    // Liruf follows the Seed with his eyes and jumps the highest when it lands
    liruf: { x: -1.84, z: 0.2, yaw: 0.35, act: {
      hop: jump(2.25, 0.24), tuck: tuck(2.25, 0.9), yaw: [[0, 0.2], [1.0, 0.5], [2.0, 0.55], [2.6, 0.1], [5, 0], [6.5, 0.2], [L, 0.2]],
      pitch: [[0, -0.1], [1.0, -0.34], [2.0, -0.2], [2.8, 0], [4, -0.1], [L, -0.1]], roll: [[0, -0.12], [2.25, 0.14], [4.2, -0.12], [L, -0.12]],
      lean: [[0, 0.04], [2.25, -0.12], [2.8, 0.1], [3.5, 0.04], [L, 0.04]], tilt: [[0, 0], [2.25, -0.1], [3, 0], [L, 0]],
    } },
    // Zara raises a cup of lemonade to the first sale
    zara: { x: -1.06, z: 0.5, yaw: 0.14, act: {
      hop: jump(2.35, 0.15), tuck: tuck(2.35, 0.5), lean: [[0, 0], [2.35, -0.1], [3.1, 0], [L, 0]],
      roll: [[0, 0.08], [2.35, -0.1], [4.6, 0.12], [L, 0.08]], pitch: [[0, -0.06], [2.35, -0.2], [3.1, -0.06], [L, -0.06]],
      yaw: [[0, 0], [1.2, 0.3], [2.0, 0.35], [2.8, 0], [L, 0]],
    } },
    // Rho jumps a beat later and lands in a proud nod
    rho: { x: 1.3, z: 0.5, yaw: -0.14, act: {
      hop: jump(2.55, 0.17), tuck: tuck(2.55, 0.7), lean: [[0, -0.03], [2.55, -0.16], [3.0, 0.08], [3.7, -0.03], [L, -0.03]],
      pitch: [[0, -0.1], [1.2, -0.26], [2.55, -0.3], [3.0, 0.14], [3.7, -0.1], [L, -0.1]], roll: [[0, 0.1], [2.55, -0.12], [4.4, 0.1], [L, 0.1]],
      yaw: [[0, 0], [1.2, -0.18], [2.0, -0.2], [2.8, 0], [L, 0]], tilt: [[0, 0], [2.55, 0.08], [3.3, 0], [L, 0]],
    } },
    // Dina sniffs up at a slice of lemon floating over her, and rears when the Seed lands
    dina: { x: 2.5, z: 0.15, yaw: -0.5, act: {
      hop: jump(2.8, 0.12), rear: [[0, 0], [2.3, 0], [2.8, 1], [3.5, 0], [L, 0]], pitch: [[0, -0.3], [2.8, -0.44], [3.6, -0.15], [5.5, -0.3], [L, -0.3]],
      roll: [[0, 0.2], [2.8, -0.1], [4.6, 0.2], [L, 0.2]], yaw: [[0, -0.25], [1.6, -0.25], [2.8, 0.2], [5, 0.2], [6.4, -0.25], [L, -0.25]],
    } },
  };
  const peaks = { liruf: 2.25, zara: 2.35, rho: 2.55, dina: 2.8 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: peaks[name] }));
  // Zara's cup: held at her chest, raised when the Seed lands, lowered again
  const toast = [[0, 0.35], [1.4, 0.35], [2.0, 0.72], [4.4, 0.72], [5.2, 0.35], [L, 0.35]];
  const held = cup(true);

  held.scale.setScalar(1.25);
  fx.add(held);

  // the Seed that pays: it comes in over the mentors' heads, and drops under the awning into the jar
  const jarAt = new THREE.Vector3(STAND.x + JAR.x, STAND.deck + 0.98 + 0.34, STAND.z + JAR.z);
  const hover = new THREE.Vector3(STAND.x - 0.1, 2.3, 0.7);
  const coin = seedMesh(0.4);
  const coinGlow = halo(0.4, 0xffe2a0, 0.55);
  const trail = Array.from({ length: 7 }, (_, i) => {
    const speck = sprite(i % 2 ? TEXTURES.dot : TEXTURES.star, i % 2 ? 0xffe6a3 : 0xffffff, 9);

    fx.add(speck);

    return speck;
  });
  const next = sequence(12);
  const burst = Array.from({ length: 12 }, (_, i) => {
    const star = sprite(TEXTURES.star, [0xfff3c4, 0xffffff, 0xffd36b][i % 3], 9);

    fx.add(star);

    return { star, a: (i / 12) * TAU + next() * 0.3, reach: 0.35 + next() * 0.3, size: 0.1 + next() * 0.12 };
  });
  const rings = [0, 0.25].map((delay) => {
    const ring = sprite(TEXTURES.ring, 0xffc94a, 8);

    fx.add(ring);

    return { ring, delay };
  });

  coin.castShadow = false;
  fx.add(coin, coinGlow);

  // slices of lemon that float and turn slowly, high and at the sides
  const floating = [[2.35, 2.45, -1.4, 0.16], [2.8, 3.05, -0.9, 0.19], [3.05, 2.2, -0.6, 0.14]].map(([x, y, z, r], i) => {
    const one = slice(r);

    fx.add(one);

    return { one, x, y, z, phase: i * 1.7 };
  });
  const bubble = canvasTexture([96, 96], (g, s) => {
    const shell = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.48);

    // a bubble of lemonade: yellow inside, a firm golden skin, so it reads on a pale page as well as a dark one
    shell.addColorStop(0, 'rgba(255,226,90,0.55)');
    shell.addColorStop(0.72, 'rgba(244,170,16,0.95)');
    shell.addColorStop(0.9, 'rgba(244,170,16,0.9)');
    shell.addColorStop(1, 'rgba(244,170,16,0)');
    g.fillStyle = shell;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(s * 0.36, s * 0.34, s * 0.09, s * 0.055, -0.7, 0, TAU);
    g.fill();
  });
  const effects = [
    sparkles(fx, { loop, actors, each: 5 }),
    landings(fx, { actors, color: 0xf2ffd9 }),
    // bubbles: a column of them over the jug
    rising(fx, { loop, at: { x: STAND.x - 0.34, y: STAND.deck + 1.5, z: STAND.z + 0.1 }, radius: 0.16, height: 0.55, count: 12, color: 0xffffff, size: [0.05, 0.1], seed: 3, texture: bubble, sway: 0.03, depth: 0.5, spin: false }),
  ];
  const hand = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const ease = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
  const path = (u, out) => {
    out.lerpVectors(hover, jarAt, u);
    out.y += Math.sin(u * Math.PI) * 0.25;

    return out;
  };

  scene.add(set, fx);

  return {
    cast,
    still: 1.8,
    camera: { y: 2.3, dist: 14.4, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const zara = rigs.zara;
      const up = curve(toast, t);

      // her left arm: forward from the shoulder, the forearm bent up, the cup upright in her hand
      zara.rot('LeftArm', Z, 0.4 + up * 0.5);
      zara.rot('LeftArm', Y, -1.1);
      zara.rot('LeftForeArm', X, -0.5 - up * 0.7);
      zara.rot('LeftForeArm', Z, 0.3 + up * 0.3);
      zara.holder.updateWorldMatrix(true, true);
      (zara.bones.get('LeftHand') ?? zara.bones.get('LeftForeArm')).getWorldPosition(hand);
      zara.bones.get('LeftForeArm').getWorldPosition(elbow);
      held.position.copy(hand).addScaledVector(hand.clone().sub(elbow).normalize(), 0.08);
      held.position.y -= 0.06;
      held.rotation.y = 0.6;

      // the Seed: it appears over the mentors, hangs there a moment, and flies into the jar
      const fly = ease((t - 1.35) / (DROPS - 1.35));
      // (in the jar it is the size of the Seeds already there, and it is gone before the loop starts again)
      const shown = ease((t - 0.5) / 0.35) * (1 - ease((t - DROPS + 0.08) / 0.16) * 0.58) * (1 - ease((t - 7.4) / 0.4));

      path(fly, coin.position);
      coin.position.y += Math.sin(w * 3) * 0.04 * (1 - fly);
      coin.rotation.set(0, w * 3 + fly * TAU, Math.sin(fly * Math.PI) * 0.6);
      coin.scale.setScalar(Math.max(0.0001, 0.4 * shown));
      coin.visible = shown > 0.001;
      coinGlow.position.copy(coin.position);
      coinGlow.scale.setScalar(0.8 * shown * (t < DROPS ? 1 : 0.6));

      for (const [i, speck] of trail.entries()) {
        const u = (t - 1.35) / (DROPS - 1.35) - (i + 1) * 0.09;

        speck.visible = t > 1.35 && t < DROPS + 0.5 && u > 0 && u < 1;

        if (!speck.visible) continue;

        path(ease(u), speck.position);
        speck.scale.setScalar(0.17 - i * 0.014);
        speck.material.opacity = (1 - i / 8) * Math.min(1, (DROPS + 0.5 - t) * 3);
        speck.material.rotation = w * 2 + i;
      }

      // the jar answers: its Seeds jump, stars fly out, two rings of light open
      const since = t - DROPS;
      const jolt = since > 0 && since < 1.2 ? Math.abs(Math.sin(since * 9)) * Math.exp(-since * 3) : 0;

      for (const [i, { seed, y }] of shop.kept.entries()) seed.position.y = y + jolt * (0.05 + (i % 3) * 0.025);

      for (const { star, a, reach, size: s } of burst) {
        const u = since / 0.9;

        star.visible = u > 0 && u < 1;
        star.position.set(jarAt.x + Math.cos(a) * reach * (0.3 + u), jarAt.y + 0.05 + Math.sin(a) * reach * (0.3 + u), jarAt.z + 0.25);
        star.scale.setScalar(s * (1.3 - u * 0.5));
        star.material.opacity = 1 - u;
        star.material.rotation = a + u * 2;
      }

      for (const { ring, delay } of rings) {
        const u = (since - delay) / 0.8;

        ring.visible = u > 0 && u < 1;
        ring.position.set(jarAt.x, jarAt.y, jarAt.z + 0.2);
        ring.scale.setScalar(0.3 + u * 1.1);
        ring.material.opacity = 0.8 * (1 - u);
      }

      for (const { one, x, y, z, phase } of floating) {
        one.position.set(x + Math.sin(w + phase) * 0.1, y + Math.sin(w * 2 + phase) * 0.08, z);
        one.rotation.set(Math.sin(w + phase) * 0.5, Math.sin(w + phase * 2) * 0.7, w + phase);
      }

      for (const { group, glow, phase } of lanterns) {
        group.rotation.z = Math.sin(w + phase) * 0.1;
        glow.material.opacity = 0.4 + 0.12 * Math.sin(w * 2 + phase);
      }

      lemons.crown.rotation.z = Math.sin(w) * 0.025;

      for (const [i, one] of lemons.fruit.entries()) one.rotation.x = Math.sin(w * 2 + i) * 0.12;

      for (const effect of effects) effect(t);
    },
  };
}
