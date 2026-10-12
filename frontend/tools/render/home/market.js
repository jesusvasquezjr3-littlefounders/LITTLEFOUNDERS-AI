// Home composition "market": the four mentors at a street market under paper lanterns. Zara keeps a stall, and Rho
// pays her for an orange with a Seed that flies through the air into her open hand.
//
// The setting is an island: a round square paved with cobbles around a small rosette. Three stalls stand in an arc
// at the back, each with a round-topped striped awning, a painted counter and crates of round fruit stepped up behind
// it, so the fruit shows over the mentors' heads. Half of Zara's counter is kept clear, so the Seed is seen flying
// against the open air under her awning. A string of paper lanterns hangs over the awnings between two masts, and
// petals fall slowly through their light.
//
// Nothing is priced and no sign carries a word: the only thing that changes hands is a Seed (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, glass, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const SQUARE = { radius: 3.3, z: -0.6 };
const PAYS = 1.5; // the second the Seed leaves Rho's side
const LANDS = 2.2; // the second it reaches Zara's hand
const BESIDE_RHO = new THREE.Vector3(0.62, 1.12, 0.75); // where the Seed waits, and where the orange comes to rest

const FRUIT = { apple: 0xe0272f, orange: 0xf58a07, lemon: 0xffd638, lime: 0x79c843, plum: 0x8a4fd0, peach: 0xff9e8a, melon: 0x3f9e58 };
const fruitMaterial = new Map();
const fruit = (name) => fruitMaterial.get(name) ?? fruitMaterial.set(name, standard(FRUIT[name], 0.45)).get(name);

// ---- the square: cobbles laid in rings around a rosette, a terracotta border
function square() {
  const group = new THREE.Group();
  const R = SQUARE.radius;
  const next = sequence(52);
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#c9713d');
    ring(0.955, '#e3cfa6');

    // round cobbles, ring after ring, each a little lighter or darker than its neighbor
    for (let k = 0; k < 13; k++) {
      const r = 0.92 - k * 0.052;
      const count = Math.round((r * TAU) / 0.062);

      for (let i = 0; i < count; i++) {
        const a = ((i + (k % 2) * 0.5) / count) * TAU;

        g.fillStyle = ['#f3e4c4', '#ecd9b3', '#f7ebd0', '#e6d2a8'][Math.floor(next() * 4)];
        g.beginPath();
        g.ellipse(half + Math.cos(a) * half * r, half + Math.sin(a) * half * r, half * 0.027, half * 0.022, a + Math.PI / 2, 0, TAU);
        g.fill();
      }
    }

    // the rosette in the middle: a ring of round petals around a mint heart
    ring(0.25, '#c9713d');
    ring(0.228, '#f7ebd0');

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;

      g.fillStyle = i % 2 ? '#8f8aff' : '#ffb85c';
      g.beginPath();
      g.arc(half + Math.cos(a) * half * 0.145, half + Math.sin(a) * half * 0.145, half * 0.05, 0, TAU);
      g.fill();
    }

    ring(0.075, '#05a893');
  });
  const disc = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xb9632f, 0.8), standard(0xffffff, 0.85, { map: top }), standard(C.earth, 0.9)], 0, -0.05, 0);

  disc.castShadow = false;
  group.add(disc, lathe([[0, -0.95], [1.0, -0.88], [2.1, -0.62], [2.9, -0.32], [R - 0.03, -0.1]], standard(0x9a5a34, 0.95)));

  // a soft terracotta lip over the edge
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.085, 14, 128), standard(0xc9713d, 0.85), 0, -0.05, 0);

  lip.rotation.x = Math.PI / 2;
  group.add(lip);

  return group;
}

/** A shallow wooden crate full of one kind of round fruit, tipped toward the reader. */
function crate(width, kind, radius, tip = 0.42) {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.8);
  const depth = 0.36;
  const cols = Math.max(2, Math.floor((width - 0.04) / (radius * 2)));
  const rows = Math.max(1, Math.floor((depth - 0.02) / (radius * 2)));

  group.add(box(width, 0.14, depth, wood, 0, 0.07, 0, 0.05));

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) group.add(sphere(radius, fruit(kind), (i - (cols - 1) / 2) * radius * 2, 0.12 + radius * 0.5, (j - (rows - 1) / 2) * radius * 2));
  }

  // a second layer, one fewer each way
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < Math.max(1, rows - 1); j++) group.add(sphere(radius, fruit(kind), (i - (cols - 2) / 2) * radius * 2, 0.12 + radius * 1.3, (j - (Math.max(1, rows - 1) - 1) / 2) * radius * 2));
  }

  group.rotation.x = tip;

  return group;
}

// ---- a stall: a painted counter, crates stepped up behind it, and a round-topped striped awning on two posts.
// `rows` is the front row and the back row of crates, left to right; a missing crate leaves the counter clear there.
function stall({ width, color, body, pale = '#fff1cf', rows, top = 2.0, jarOfSeeds = false }) {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.75);
  const dark = standard(C.woodDark, 0.8);
  const cloth = new THREE.Color(color);
  const css = `#${cloth.getHexString()}`;
  const R = 0.76; // the awning is an arc of a barrel this wide, `ARC` radians of it, highest in its middle
  const ARC = 2.2;
  const reach = R * Math.sin(ARC / 2);
  const foot = R * Math.cos(ARC / 2);
  const back = -0.5; // where the posts stand, behind the counter
  const middle = back + reach;

  const filled = rows[1].map((kind, i) => (kind ? i : -1)).filter((i) => i >= 0);
  const each = (width - 0.12) / rows[1].length;

  group.add(
    box(width, 0.9, 0.62, standard(body, 0.7), 0, 0.45, 0, 0.12),
    box(width + 0.08, 0.08, 0.7, dark, 0, 0.92, 0, 0.04),
    box(width - 0.34, 0.52, 0.05, standard(0xfff1cf, 0.8), 0, 0.46, 0.31, 0.025),
    // the step the back crates stand on, only as wide as they are
    box(filled.length * each, 0.34, 0.3, wood, ((filled[0] + filled[filled.length - 1]) / 2 - (rows[1].length - 1) / 2) * each, 1.12, -0.2, 0.08),
  );

  rows.forEach((kinds, k) => {
    kinds.forEach((kind, i) => {
      if (!kind) return;

      const one = crate(each - 0.06, ...kind);

      one.position.set((i - (kinds.length - 1) / 2) * each, k ? 1.3 : 0.97, k ? -0.2 : 0.14);
      group.add(one);
    });
  });

  if (jarOfSeeds) {
    // where the Seeds she is paid are kept
    const jar = new THREE.Group();

    for (const [x, y, lean] of [[-0.04, 0.12, 0.3], [0.05, 0.2, -0.4], [0, 0.3, 0.1]]) {
      const seed = seedMesh(0.17);

      seed.position.set(x, y, 0);
      seed.rotation.z = lean;
      jar.add(seed);
    }

    jar.add(lathe([[0, 0], [0.12, 0], [0.14, 0.04], [0.14, 0.3], [0.1, 0.38], [0.1, 0.42]], glass(0xd4e4ff, 0.4), 0, 0, 0, 32), cylinder(0.11, 0.11, 0.04, standard(C.gold, 0.4, { metalness: 0.5 }), 0, 0.43, 0, 32));
    jar.position.set(width / 2 - 0.18, 0.96, 0.2);
    group.add(jar);
  }

  // the awning: an arc of striped cloth on a hoop at each end, open underneath
  const stripes = canvasTexture([8, 512], (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? pale : css;
      g.fillRect(0, (i / 8) * h, w, h / 8 + 1);
    }
  });
  const long = width + 0.24;
  const awning = new THREE.Group();
  const canopy = mesh(new THREE.CylinderGeometry(R, R, long, 64, 1, true, Math.PI / 2 - ARC / 2, ARC), standard(0xffffff, 0.85, { map: stripes, side: THREE.DoubleSide }));

  canopy.rotation.z = Math.PI / 2;
  awning.add(canopy);

  for (const side of [-1, 1]) {
    const hoop = mesh(new THREE.TorusGeometry(R, 0.035, 12, 64, ARC).rotateZ(Math.PI / 2 - ARC / 2), dark, side * long / 2, 0, 0);

    hoop.rotation.y = Math.PI / 2;
    awning.add(hoop);
  }

  awning.position.set(0, top - foot, middle);
  group.add(awning);

  // a round scallop under each stripe, along the front edge
  for (let i = 0; i < 8; i++) {
    const scallop = new THREE.Mesh(new THREE.CircleGeometry(long / 16, 24, Math.PI, Math.PI), standard(i % 2 ? pale : cloth, 0.85, { side: THREE.DoubleSide }));

    scallop.position.set(-long / 2 + (i + 0.5) * (long / 8), top + 0.01, middle + reach);
    scallop.castShadow = true;
    group.add(scallop);
  }

  // the two posts at the back, and a brace from each to the front of its hoop
  for (const side of [-1, 1]) {
    const x = side * long / 2;

    group.add(
      cylinder(0.05, 0.055, top, dark, x, top / 2, back, 20),
      tube([[x, top - 0.7, back], [x, top - 0.22, back + 0.4], [x, top - 0.02, middle + reach - 0.06]], 0.03, dark, 24),
      sphere(0.055, dark, x, top, middle + reach),
      sphere(0.055, dark, x, top, back),
    );
  }

  return group;
}

// ---- a paper lantern: a round shade that gives light, a cap above and below
function lantern(color) {
  const group = new THREE.Group();
  const shade = sphere(0.17, lit(color, 1.3), 0, -0.3, 0, 1.12);
  const glow = halo(0.4, color, 0.5);
  const wood = standard(C.woodDark, 0.8);

  shade.castShadow = false;
  glow.position.y = -0.3;
  group.add(cylinder(0.008, 0.008, 0.12, wood, 0, -0.06, 0, 8), cylinder(0.06, 0.07, 0.035, wood, 0, -0.115, 0, 20), cylinder(0.06, 0.05, 0.03, wood, 0, -0.49, 0, 20), shade, glow);

  return group;
}

export function build(scene, { loop, heights, jump, tuck, Y, Z, curve }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;

  set.add(place(square(), 0, SQUARE.z), shadowCatcher(SQUARE.radius - 0.1, 0.008, SQUARE.z, 0.3));
  set.add(decal(radial([[0, 'rgba(70,50,120,0.28)'], [0.6, 'rgba(70,50,120,0.14)'], [1, 'rgba(70,50,120,0)']]), 0, -1.0, SQUARE.z, 3.8, 3.3, 0));

  // the three stalls: mint at the left, orange in the middle, Zara's indigo one at the right
  const STALLS = [
    { x: -1.95, z: -1.8, yaw: 0.4, top: 2.0, at: stall({ width: 1.5, color: C.mint, body: C.mintDeep, rows: [[['apple', 0.085], ['lime', 0.085]], [['lemon', 0.08], ['peach', 0.085]]] }) },
    { x: 0, z: -2.55, yaw: 0, top: 2.1, at: stall({ width: 1.6, color: C.orange, body: 0xd9641a, top: 2.1, rows: [[['orange', 0.09], null, ['lime', 0.085]], [['apple', 0.085], ['lemon', 0.08], ['peach', 0.085]]] }) },
    { x: 1.95, z: -1.8, yaw: -0.4, top: 2.0, at: stall({ width: 1.5, color: C.indigo, body: C.indigoDeep, jarOfSeeds: true, rows: [[null, ['orange', 0.09]], [null, ['melon', 0.13]]] }) },
  ];

  for (const { at, x, z, yaw } of STALLS) set.add(place(at, x, z, yaw));

  // a string of lanterns over the awnings, between two masts that stand at the outer corners of the side stalls
  const lanterns = [];
  const MAST = { x: 2.95, z: -1.92, top: 3.22 };
  const SHADES = [C.orange, C.pink, 0x6fa8ff, C.gold, 0x35d6b8, C.pink, C.orange];
  const along = (u) => new THREE.Vector3(-MAST.x + u * MAST.x * 2, MAST.top - 0.02 - 0.3 * 4 * u * (1 - u), MAST.z);
  const wood = standard(C.woodDark, 0.8);

  for (const side of [-1, 1]) set.add(cylinder(0.04, 0.05, MAST.top - 1.9, wood, side * MAST.x, (MAST.top + 1.9) / 2, MAST.z, 20), sphere(0.06, standard(C.gold, 0.35, { metalness: 0.6 }), side * MAST.x, MAST.top, MAST.z));

  set.add(tube(Array.from({ length: 13 }, (_, i) => along(i / 12).toArray()), 0.014, wood, 64));

  for (const [i, color] of SHADES.entries()) {
    const one = lantern(color);

    one.position.copy(along((i + 1) / (SHADES.length + 1)));
    set.add(one);
    lanterns.push({ one, phase: i * 1.3 });
  }

  for (const x of [-1.3, 1.3]) {
    const light = new THREE.PointLight(0xffc98a, 5, 5.5, 1.8);

    light.position.set(x, 2.5, -1.2);
    set.add(light);
  }

  const cast = {
    // Dina follows a falling petal with her nose, then looks up when the Seed flies
    dina: { x: -2.0, z: 0.45, yaw: 0.4, act: {
      hop: jump(3.3, 0.1), rear: [[0, 0], [5.0, 0], [5.5, 0.8], [6.1, 0], [L, 0]],
      yaw: [[0, -0.3], [0.9, -0.1], [1.7, -0.35], [2.4, 0.35], [4.2, 0.35], [5.5, 0], [7, -0.3], [L, -0.3]],
      pitch: [[0, -0.34], [0.9, -0.1], [1.7, 0.12], [2.4, -0.25], [4.2, -0.2], [5.5, -0.4], [7, -0.34], [L, -0.34]],
      roll: [[0, -0.14], [2.4, 0.16], [5.5, -0.05], [L, -0.14]],
    } },
    // Liruf cannot decide what to look at: he bounces from one stall to the next
    liruf: { x: -0.82, z: 0.2, yaw: 0.1, act: {
      hop: [[0, 0], [0.5, 0], [0.7, -0.03], [1.0, 0.18], [1.3, -0.02], [1.5, 0], [4.9, 0], [5.1, -0.03], [5.4, 0.22], [5.7, -0.02], [5.9, 0], [L, 0]],
      tuck: [[0, 0], [0.7, 0], [1.0, 0.7], [1.3, 0], [5.1, 0], [5.4, 0.8], [5.7, 0], [L, 0]],
      yaw: [[0, -0.45], [1.0, -0.45], [1.9, 0.4], [3.6, 0.4], [4.6, 0], [6.4, 0], [7.2, -0.45], [L, -0.45]],
      pitch: [[0, -0.2], [1.9, -0.1], [4.6, -0.24], [L, -0.2]], roll: [[0, -0.14], [1.9, 0.14], [4.6, -0.1], [L, -0.14]],
      lean: [[0, 0.06], [1.0, -0.1], [1.9, 0.08], [5.4, -0.12], [6.2, 0.06], [L, 0.06]], tilt: [[0, 0.05], [1.9, -0.06], [4.6, 0], [L, 0.05]],
    } },
    // Rho watches his Seed go, jumps when it lands, and nods at the orange that comes back. He stays square to the
    // reader: turned further, the far lens of his glasses shows past his face.
    rho: { x: 0.05, z: 0.45, yaw: 0, act: {
      hop: jump(2.55, 0.17), tuck: tuck(2.55, 0.7), yaw: [[0, -0.06], [1.3, 0.1], [2.2, 0.12], [3.2, -0.06], [4.6, 0.1], [5.6, 0.1], [6.6, -0.06], [L, -0.06]],
      pitch: [[0, -0.1], [1.5, -0.05], [1.9, -0.3], [2.55, -0.25], [3.0, 0.12], [3.6, -0.1], [5.4, 0.1], [6.0, 0.2], [6.5, 0.05], [L, -0.1]],
      lean: [[0, -0.03], [2.55, -0.14], [3.0, 0.08], [3.6, -0.03], [L, -0.03]], roll: [[0, 0.1], [2.2, -0.12], [3.2, 0.1], [5.4, -0.12], [6.6, 0.1], [L, 0.1]], tilt: [[0, 0], [1.6, 0.05], [2.55, 0.07], [3.3, 0], [L, 0]],
    } },
    // Zara holds out her hand for the Seed, bounces when she has it, and hands the orange over
    zara: { x: 2.1, z: 0.3, yaw: -0.4, act: {
      hop: jump(2.7, 0.14), tuck: tuck(2.7, 0.5), yaw: [[0, 0.3], [1.2, 0.1], [2.2, -0.1], [3.4, 0.35], [4.4, 0], [5.6, 0], [6.4, 0.3], [L, 0.3]],
      pitch: [[0, -0.05], [1.9, -0.12], [2.3, 0.1], [3.2, -0.08], [L, -0.05]], roll: [[0, 0.08], [2.2, -0.12], [3.4, 0.12], [5, -0.08], [L, 0.08]],
      lean: [[0, 0], [1.6, 0.08], [2.7, -0.08], [3.4, 0], [4.6, 0.08], [5.8, 0], [L, 0]], tilt: [[0, 0], [1.6, 0.05], [3.4, 0], [4.6, 0.05], [6, 0], [L, 0]],
    } },
  };
  const peaks = { dina: 3.3, liruf: 5.4, rho: 2.55, zara: 2.7 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: peaks[name] }));
  // Zara's right arm: out for the Seed, down, out again with the orange
  const reaching = [[0, 0], [1.05, 0], [1.6, 1], [3.1, 1], [3.7, 0.2], [4.2, 1], [5.5, 1], [6.1, 0], [L, 0]];

  // the Seed that pays, the orange that is bought, and the specks that follow each through the air
  const coin = seedMesh(0.4);
  const coinGlow = halo(0.36, 0xffe2a0, 0.55);
  const bought = sphere(0.12, fruit('orange'), 0, 0, 0);
  const leaf = sphere(0.035, standard(C.leaf, 0.7), 0, 0.12, 0, 0.5);
  const trail = Array.from({ length: 7 }, (_, i) => {
    const speck = sprite(i % 2 ? TEXTURES.dot : TEXTURES.star, i % 2 ? 0xffe6a3 : 0xffffff, 9);

    fx.add(speck);

    return speck;
  });
  const next = sequence(33);
  const burst = Array.from({ length: 10 }, (_, i) => {
    const star = sprite(TEXTURES.star, [0xfff3c4, 0xffffff, 0xffd36b][i % 3], 9);

    fx.add(star);

    return { star, a: (i / 10) * TAU + next() * 0.3, reach: 0.3 + next() * 0.25, size: 0.1 + next() * 0.1 };
  });

  coin.castShadow = false;
  bought.add(leaf);
  bought.castShadow = false;
  fx.add(coin, coinGlow, bought);

  const petal = canvasTexture([48, 48], (g, w) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2, w / 2, w * 0.44, w * 0.3, 0.5, 0, TAU); g.fill(); });
  const effects = [
    sparkles(fx, { loop, actors, each: 5 }),
    landings(fx, { actors, color: 0xfff0d2 }),
    // petals that fall through the lantern light, behind the mentors and at the sides
    rising(fx, { loop, at: { x: 0, y: 3.1, z: -1.2 }, radius: 3.0, height: -2.7, count: 26, color: [0xff8fb8, 0xffb7d0, 0xffc978], size: [0.05, 0.09], seed: 15, texture: petal, sway: 0.14, depth: 0.25 }),
    // motes of warm light around the lanterns
    rising(fx, { loop, at: { x: 0, y: 2.1, z: -1.7 }, radius: 2.2, height: 0.9, count: 16, color: [0xffe6a3, 0xffffff], size: [0.03, 0.06], seed: 8, texture: TEXTURES.star, depth: 0.2 }),
  ];
  const hand = new THREE.Vector3();
  const over = new THREE.Vector3();
  const arc = (from, to, u, lift, out) => {
    out.lerpVectors(from, to, u);
    out.y += Math.sin(u * Math.PI) * lift;

    return out;
  };
  const ease = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

  scene.add(set, fx);

  return {
    cast,
    still: 1.92,
    camera: { y: 2.3, dist: 14.4, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const reach = curve(reaching, t);
      const zara = rigs.zara;

      // her right arm comes up and forward, the hand open toward Rho
      zara.rot('RightArm', Z, -reach * 1.05);
      zara.rot('RightArm', Y, reach * 0.7);
      zara.rot('RightForeArm', Z, -reach * 0.35);
      zara.holder.updateWorldMatrix(true, true);
      (zara.bones.get('RightHand') ?? zara.bones.get('RightForeArm')).getWorldPosition(hand);
      over.copy(hand).add(new THREE.Vector3(-0.06, 0.26, 0.02));

      // the Seed: it appears beside Rho, flies over, rests over her hand, and is gone as her arm comes down
      const fly = ease((t - PAYS) / (LANDS - PAYS));
      const coinSize = ease((t - 0.7) / 0.35) * (1 - ease((t - 3.15) / 0.35));

      arc(BESIDE_RHO, over, fly, 0.32, coin.position);
      coin.position.y += Math.sin(w * 3) * 0.03 * (1 - Math.sin(fly * Math.PI));
      coin.rotation.set(0, w * 3 + fly * TAU, Math.sin(fly * Math.PI) * 0.5);
      coin.scale.setScalar(0.4 * coinSize);
      coin.visible = coinSize > 0.001;
      coinGlow.position.copy(coin.position);
      coinGlow.scale.setScalar(0.72 * coinSize);

      // the orange: it appears over her hand, flies back, and waits beside Rho
      const back = ease((t - 4.6) / 0.7);
      const boughtSize = ease((t - 4.15) / 0.35) * (1 - ease((t - 7.1) / 0.4));

      arc(over, BESIDE_RHO, back, 0.3, bought.position);
      bought.position.y += Math.sin(w * 3) * 0.03 * back;
      bought.rotation.set(back * TAU, 0, 0.3);
      bought.scale.setScalar(Math.max(0.0001, boughtSize));
      bought.visible = boughtSize > 0.001;

      // specks behind whichever of the two is in the air
      const flying = t < 4 ? { u: (t - PAYS) / (LANDS - PAYS), from: BESIDE_RHO, to: over, lift: 0.32 } : { u: (t - 4.6) / 0.7, from: over, to: BESIDE_RHO, lift: 0.3 };

      for (const [i, speck] of trail.entries()) {
        const u = flying.u - (i + 1) * 0.085;

        speck.visible = flying.u > 0 && flying.u < 1.5 && u > 0 && u < 1;

        if (!speck.visible) continue;

        arc(flying.from, flying.to, ease(u), flying.lift, speck.position);
        speck.scale.setScalar(0.17 - i * 0.014);
        speck.material.opacity = (1 - i / 8) * Math.min(1, (1.5 - flying.u) * 2.5);
        speck.material.rotation = w * 2 + i;
      }

      // a ring of stars where the Seed lands
      for (const { star, a, reach: far, size } of burst) {
        const u = (t - LANDS) / 0.8;

        star.visible = u > 0 && u < 1;
        star.position.set(over.x + Math.cos(a) * far * (0.3 + u), over.y + Math.sin(a) * far * (0.3 + u), over.z + 0.1);
        star.scale.setScalar(size * (1.3 - u * 0.5));
        star.material.opacity = 1 - u;
        star.material.rotation = a + u * 2;
      }

      for (const { one, phase } of lanterns) {
        one.rotation.z = Math.sin(w + phase) * 0.09;
        one.children[4].material.opacity = 0.42 + 0.12 * Math.sin(w * 2 + phase);
      }

      for (const effect of effects) effect(t);
    },
  };
}
