// Home composition "classroom": Zara teaches, and the other three mentors, her pupils today, all know the answer at
// once: a bubble with a drawing pops over each of them, one after another.
//
// The setting is an island: a round floor of pale blue tiles with a wooden edge. On the left, the chalkboard stands
// tall on two long legs, a clock on top (dots, no numerals) and drawings only on it: a pie chart, a plant that grows
// in three steps, Seeds in rows. Zara stands under it, between its legs, one arm out to her pupils. At the far left
// a narrow bookshelf with a globe that turns, and in front of it two books with an apple on them. The pupils stand
// on a round rug on the right, a cushion in front of each. Two round toy planes fly overhead, and chalk dust drifts
// by the board.
//
// No money is shown anywhere, only Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, landings, lathe, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.4, z: -0.6 };
const BOARD = { x: -1.69, y: 2.4, z: -2.0, width: 2.3, height: 1.16 };
const APPLE = { x: -2.3, z: 1.45 };
const SHELF = { x: -2.95, z: -0.2 };
const RUG = { x: 1.1, z: 0.6, radius: 1.62 };
const ASKS = 1.2; // the second Zara turns to the board

// ---- the floor: pale blue tiles, a wooden edge
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const tile = w / 12;

    for (let i = 0; i < 12; i++) {
      for (let k = 0; k < 12; k++) {
        g.fillStyle = (i + k) % 2 ? '#b9d6f4' : '#e4eefb';
        g.fillRect(i * tile, k * tile, tile + 1, tile + 1);
      }
    }

    g.strokeStyle = '#dba06a';
    g.lineWidth = w * 0.05;
    g.beginPath();
    g.arc(w / 2, w / 2, w * 0.488, 0, TAU);
    g.stroke();
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), standard(0xffffff, 0.6, { map: top }));
  const edge = mesh(new THREE.TorusGeometry(R - 0.035, 0.05, 14, 128), standard(C.wood, 0.6), 0, -0.04, 0);

  disc.receiveShadow = true;
  edge.rotation.x = Math.PI / 2;
  group.add(disc, edge, lathe([[0, -0.4], [2.4, -0.4], [3.05, -0.3], [R - 0.04, -0.16], [R - 0.01, -0.06]], standard(C.woodDark, 0.8)));

  return group;
}

// ---- the rug: round, indigo with a ring of dots
function rug(radius) {
  const picture = canvasTexture([1024, 1024], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#fff1cf');
    ring(0.955, '#5c55fd');
    ring(0.7, '#8f8aff');
    ring(0.66, '#6f69ff');
    g.fillStyle = '#ffd36b';

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;

      g.beginPath();
      g.arc(half + Math.cos(a) * half * 0.83, half + Math.sin(a) * half * 0.83, 15, 0, TAU);
      g.fill();
    }
  });
  const m = mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 96), [standard(0xfff1cf, 0.95), standard(0xffffff, 0.95, { map: picture }), standard(0xfff1cf, 0.95)], 0, 0.015, 0);

  m.castShadow = false;

  return m;
}

function cushion(radius, color) {
  const group = new THREE.Group();

  group.add(sphere(radius, standard(color, 0.85), 0, radius * 0.36, 0, 0.4), sphere(radius * 0.13, standard(C.cream, 0.6), 0, radius * 0.72, 0, 0.6));

  return group;
}

function chalkArrow(g, x0, y, x1) {
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.moveTo(x1 - 18, y - 14);
  g.lineTo(x1, y);
  g.lineTo(x1 - 18, y + 14);
  g.stroke();
}

// ---- the chalkboard on its legs, a clock on top of it
function chalkboard() {
  const group = new THREE.Group();
  const { width, height } = BOARD;
  const wood = standard(C.wood, 0.6);
  const picture = canvasTexture([1280, Math.round((1280 * height) / width)], (g, w, h) => {
    const next = sequence(15);

    g.fillStyle = '#226b58';
    g.fillRect(0, 0, w, h);

    // where the eraser went
    for (let i = 0; i < 26; i++) {
      const x = next() * w;
      const y = next() * h;
      const smear = g.createRadialGradient(x, y, 0, x, y, 170);

      smear.addColorStop(0, 'rgba(255,255,255,0.07)');
      smear.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = smear;
      g.fillRect(x - 170, y - 170, 340, 340);
    }

    g.lineCap = 'round';
    g.lineJoin = 'round';

    // a pie chart in three parts, the largest pulled out a little
    const pie = [w * 0.27, h * 0.36, h * 0.23];

    [[0.0, 0.42, '#ffe08a', 14], [0.42, 0.74, '#ff9fc4', 0], [0.74, 1.0, '#9fd0ff', 0]].forEach(([from, to, color, out]) => {
      const middle = ((from + to) / 2) * TAU - Math.PI / 2;
      const x = pie[0] + Math.cos(middle) * out;
      const y = pie[1] + Math.sin(middle) * out;

      g.fillStyle = color;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, pie[2], from * TAU - Math.PI / 2, to * TAU - Math.PI / 2);
      g.closePath();
      g.fill();
      g.stroke();
    });

    // a plant that grows in three steps along a line of ground
    const ground = h * 0.86;

    g.strokeStyle = '#ffffff';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(w * 0.1, ground);
    g.lineTo(w * 0.66, ground);
    g.stroke();
    drawSeed(g, w * 0.16, ground - 36, 66, '#ffe08a', '#226b58');
    g.strokeStyle = '#a8f0c0';
    g.lineWidth = 11;

    for (const [x, tall] of [[0.36, 80], [0.58, 160]]) {
      g.beginPath();
      g.moveTo(w * x, ground);
      g.quadraticCurveTo(w * x + 14, ground - tall * 0.5, w * x, ground - tall);
      g.stroke();

      for (const side of [-1, 1]) {
        g.fillStyle = '#a8f0c0';
        g.beginPath();
        g.ellipse(w * x + side * 30, ground - tall * (side > 0 ? 0.62 : 0.86), 30, 15, side * -0.5, 0, TAU);
        g.fill();
      }
    }

    g.fillStyle = '#ffe08a';
    g.beginPath();
    g.arc(w * 0.58, ground - 186, 30, 0, TAU);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    chalkArrow(g, w * 0.22, ground - 60, w * 0.29);
    chalkArrow(g, w * 0.44, ground - 60, w * 0.51);

    // Seeds in rows
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) drawSeed(g, w * (0.6 + i * 0.09), h * (0.16 + row * 0.17), 86, ['#ffe08a', '#ff9fc4', '#9fd0ff'][row], '#226b58');
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: picture, roughness: 0.85, emissive: 0xffffff, emissiveMap: picture, emissiveIntensity: 0.3 }));
  const clock = new THREE.Group();

  face.position.set(0, BOARD.y, 0.041);
  face.receiveShadow = true;
  group.add(box(width + 0.16, height + 0.16, 0.07, wood, 0, BOARD.y, 0, 0.1), face);

  // the tray, two chalks and the eraser on it
  group.add(
    box(width * 0.56, 0.05, 0.12, wood, 0.2, BOARD.y - height / 2 - 0.09, 0.08, 0.022),
    box(0.2, 0.07, 0.09, standard(C.indigo, 0.9), 0.62, BOARD.y - height / 2 - 0.035, 0.09, 0.03),
  );

  for (const [x, color] of [[0.05, 0xffffff], [0.24, 0xffd36b]]) {
    const chalk = cylinder(0.02, 0.02, 0.13, standard(color, 0.9), x, BOARD.y - height / 2 - 0.045, 0.09, 12);

    chalk.rotation.z = Math.PI / 2;
    group.add(chalk);
  }

  // two long legs, each on a round foot that reaches back: the board stands above the mentors' heads
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.1);


    group.add(
      cylinder(0.035, 0.035, BOARD.y - height / 2, wood, x, (BOARD.y - height / 2) / 2 + 0.03, -0.02, 16),
      tube([[x, 0.06, -0.42], [x, 0.13, -0.2], [x, 0.06, 0.04]], 0.035, wood, 12),
      sphere(0.05, wood, x, 0.05, -0.42), sphere(0.05, wood, x, 0.05, 0.04),
    );
  }

  // the clock: a white face in an indigo ring, twelve dots, two round hands (they stand still: the loop is short)
  clock.position.set(0, BOARD.y + height / 2 + 0.34, 0.02);
  clock.scale.setScalar(0.88);
  clock.add(cylinder(0.3, 0.3, 0.08, standard(C.indigo, 0.4), 0, 0, 0, 64), cylinder(0.25, 0.25, 0.085, standard(0xffffff, 0.5), 0, 0, 0.003, 64));
  clock.children[0].rotation.x = Math.PI / 2;
  clock.children[1].rotation.x = Math.PI / 2;

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;

    clock.add(sphere(i % 3 ? 0.014 : 0.024, standard(i % 3 ? C.stoneDark : C.indigo, 0.5), Math.sin(a) * 0.205, Math.cos(a) * 0.205, 0.046));
  }

  for (const [length, thick, angle, color] of [[0.11, 0.016, -1.0, C.ink], [0.17, 0.012, 0.55, C.ink]]) {
    const one = new THREE.Group();

    one.rotation.z = -angle;
    one.add(cylinder(thick, thick, length, standard(color, 0.5), 0, length / 2, 0.05, 10));
    clock.add(one);
  }

  clock.add(sphere(0.026, standard(C.gold, 0.4), 0, 0, 0.058));
  group.add(clock);

  return group;
}

// ---- two books on the floor, an apple on them
function apple() {
  const group = new THREE.Group();
  const fruit = new THREE.Group();

  group.add(box(0.44, 0.08, 0.32, standard(C.mint, 0.6), 0, 0.04, 0, 0.032), box(0.36, 0.07, 0.27, standard(C.gold, 0.6), 0.02, 0.115, 0.01, 0.03));
  group.children[0].rotation.y = 0.2;
  group.children[1].rotation.y = -0.15;

  // round, a stalk and one leaf
  fruit.position.set(0.02, 0.26, 0.01);
  fruit.add(sphere(0.12, standard(C.red, 0.35), 0, 0, 0, 0.92), cylinder(0.01, 0.012, 0.07, standard(C.earthDark, 0.8), 0.005, 0.125, 0, 8), sphere(0.05, standard(0x3aa655, 0.7), 0.05, 0.145, 0, 0.3));
  fruit.children[2].scale.z = 0.55;
  fruit.children[2].rotation.z = 0.5;
  group.add(fruit);

  return group;
}

// ---- the globe: round lands on a blue sea, tilted on a brass arm, on a round foot. It turns.
function globe() {
  const group = new THREE.Group();
  const land = canvasTexture([512, 256], (g, w, h) => {
    const draw = sequence(4);

    g.fillStyle = '#4b94ff';
    g.fillRect(0, 0, w, h);

    // round lands, drawn twice so the picture closes on itself
    for (let i = 0; i < 16; i++) {
      const x = draw() * w;
      const y = h * (0.2 + draw() * 0.6);
      const rx = 22 + draw() * 46;
      const ry = 16 + draw() * 30;

      g.fillStyle = i % 4 ? '#58c06a' : '#8fdc86';

      for (const shift of [-w, 0, w]) { g.beginPath(); g.ellipse(x + shift, y, rx, ry, draw() * 0.2, 0, TAU); g.fill(); }
    }

    g.fillStyle = '#f3f8ff';
    g.fillRect(0, 0, w, 16);
    g.fillRect(0, h - 16, w, 16);
  });
  const ball = sphere(0.22, standard(0xffffff, 0.45, { map: land }), 0, 0, 0);

  ball.rotation.order = 'ZYX';
  ball.rotation.z = 0.4;
  group.add(ball, mesh(new THREE.TorusGeometry(0.255, 0.014, 10, 40, Math.PI), standard(0xf2bf2a, 0.3, { metalness: 0.6 })), lathe([[0, -0.36], [0.13, -0.36], [0.14, -0.33], [0.035, -0.29], [0.03, -0.25], [0, -0.25]], standard(0xf2bf2a, 0.3, { metalness: 0.6 })));
  group.children[1].rotation.z = 0.4 - Math.PI / 2;

  return { group, ball };
}

// ---- the bookshelf: narrow, round at every corner (the globe stands on it)
function shelf() {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.65);
  const inside = standard(C.woodDark, 0.8);
  const next = sequence(21);
  const colors = [C.indigo, C.orange, C.mint, C.pink, C.sky, C.gold, C.red, C.indigoPale];

  group.add(box(0.62, 1.2, 0.34, wood, 0, 0.6, 0, 0.09), box(0.47, 0.44, 0.06, inside, 0, 0.86, 0.15, 0.05), box(0.47, 0.44, 0.06, inside, 0, 0.34, 0.15, 0.05));

  // books on both shelves, a Seed kept beside them
  for (const [row, y] of [[0, 0.66], [1, 0.14]]) {
    let x = -0.2;

    for (let i = 0; i < 4; i++) {
      const thick = 0.06 + next() * 0.03;
      const tall = 0.24 + next() * 0.12;

      if (row === 1 && i === 3) {
        const kept = seedMesh(0.26);

        kept.position.set(x + 0.06, y + 0.15, 0.22);
        group.add(kept);
        continue;
      }

      const book = box(thick, tall, 0.2, standard(colors[(i + row * 3) % colors.length], 0.6), x + thick / 2, y + tall / 2, 0.2, 0.022);

      book.rotation.z = row === 0 && i === 3 ? 0.16 : 0;
      group.add(book);
      x += thick + 0.014;
    }
  }

  return group;
}

// ---- a toy plane, round all over: a body like a bean, two round wings, a round tail. Its nose points along +z.
function plane(color) {
  const group = new THREE.Group();
  const paint = standard(color, 0.5);
  const pale = standard(0xffffff, 0.5);
  const part = (material, x, y, z, sx, sy, sz) => {
    const one = sphere(1, material, x, y, z);

    one.scale.set(sx, sy, sz);
    group.add(one);

    return one;
  };

  part(paint, 0, 0, 0, 0.085, 0.08, 0.27);
  part(pale, 0, -0.005, 0.03, 0.34, 0.022, 0.1);
  part(pale, 0, 0.01, -0.21, 0.14, 0.018, 0.06);
  part(paint, 0, 0.07, -0.21, 0.018, 0.075, 0.06);
  part(standard(0x9fd0ff, 0.2), 0, 0.055, 0.09, 0.05, 0.04, 0.08);

  return group;
}

// ---- an answer: a round bubble with a small tail, and a drawing inside (never a word)
function bubble(draw) {
  const picture = canvasTexture([256, 256], (g, s) => {
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#5c55fd';
    g.lineWidth = 10;
    g.lineJoin = 'round';
    g.beginPath();
    g.arc(s / 2, s * 0.44, s * 0.38, Math.PI * 0.62, Math.PI * 2.5);
    g.quadraticCurveTo(s * 0.5, s * 0.86, s * 0.4, s * 0.95);
    g.quadraticCurveTo(s * 0.42, s * 0.84, s * 0.32, s * 0.775);
    g.closePath();
    g.fill();
    g.stroke();
    g.lineCap = 'round';
    draw(g, s / 2, s * 0.44, s);
  });
  const one = sprite(picture, 0xffffff, 7);

  one.center.set(0.4, 0.05);

  return one;
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
  const world = globe();
  const books = shelf();

  books.scale.setScalar(0.9);
  world.group.scale.setScalar(0.9);

  set.add(place(floor(), 0, FLOOR.z), place(rug(RUG.radius), RUG.x, RUG.z), shadowCatcher(FLOOR.radius - 0.08, 0.036, FLOOR.z, 0.32));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.5, FLOOR.z, 4.1, 3.4, 0));
  set.add(
    place(chalkboard(), BOARD.x, BOARD.z),
    place(books, SHELF.x, SHELF.z, 0.3),
    place(world.group, SHELF.x, SHELF.z, 0.3, 1.08 + 0.36 * 0.9),
    place(apple(), APPLE.x, APPLE.z, 0.3),
    place(cushion(0.26, C.pink), 0.1, 2.2, 0, 0.03),
    place(cushion(0.26, C.gold), 1.12, 2.24, 0, 0.03),
    place(cushion(0.26, C.mint), 2.15, 2.0, 0, 0.03),
  );

  const POINT = [[0, 0.15], [ASKS - 0.3, 0.15], [ASKS + 0.3, 1], [4.6, 1], [5.4, 0.15], [L, 0.15]];
  const cast = {
    // Zara asks: she looks at the board, one arm out to her pupils, then turns back to hear them
    zara: { x: -1.45, z: 0.25, yaw: 0.42, act: {
      hop: jump(3.3, 0.12), tuck: tuck(3.3, 0.4), turn: [[0, 0], [ASKS, 0.22], [2.4, 0.22], [3.1, -0.05], [5.4, 0], [L, 0]], yaw: [[0, 0.2], [ASKS, -0.3], [2.3, -0.3], [3.0, 0.4], [5.4, 0.3], [L, 0.2]],
      lean: [[0, 0.03], [ASKS, -0.05], [3.3, -0.1], [4, 0.03], [L, 0.03]], roll: [[0, -0.06], [ASKS, 0.1], [3.0, -0.12], [5.4, -0.06], [L, -0.06]], pitch: [[0, -0.05], [ASKS, -0.16], [3.0, -0.05], [L, -0.05]],
    } },
    // Liruf knows it first and cannot keep still: the highest jump
    liruf: { x: 0.04, z: 0.45, yaw: -0.12, act: {
      hop: [[0, 0], [1.65, 0], [1.9, -0.035], [2.2, 0.2], [2.5, -0.03], [2.62, -0.03], [2.95, 0.32], [3.3, -0.03], [3.5, 0], [L, 0]], tuck: [[0, 0], [1.9, 0], [2.2, 0.6], [2.5, 0], [2.65, 0], [2.95, 0.9], [3.3, 0], [L, 0]],
      yaw: [[0, -0.5], [1.7, -0.5], [2.2, -0.15], [5, -0.15], [6.2, -0.5], [L, -0.5]], pitch: [[0, -0.12], [2.2, -0.34], [3.6, -0.14], [L, -0.12]],
      roll: [[0, 0.14], [2.2, -0.12], [2.95, 0.14], [4.6, -0.1], [L, 0.14]], lean: [[0, 0.1], [1.7, 0.14], [2.2, -0.12], [2.6, 0.04], [2.95, -0.14], [3.6, 0.06], [L, 0.1]],
    } },
    // Rho thinks a second, then he has it: a jump and a firm nod
    rho: { x: 0.98, z: 0.5, yaw: -0.2, act: {
      hop: jump(2.7, 0.18), tuck: tuck(2.7, 0.7), yaw: [[0, -0.45], [1.6, -0.45], [2.1, 0.25], [2.5, -0.1], [5.4, -0.1], [6.4, -0.45], [L, -0.45]],
      pitch: [[0, -0.08], [1.6, -0.08], [2.1, -0.3], [2.7, -0.3], [3.15, 0.18], [3.8, -0.1], [L, -0.08]], roll: [[0, 0.12], [2.1, -0.16], [2.7, 0.06], [4.4, 0.12], [L, 0.12]],
      lean: [[0, 0.06], [2.1, 0.02], [2.7, -0.16], [3.15, 0.1], [3.8, 0], [L, 0.06]],
    } },
    // Dina rears up with hers, tail going
    dina: { x: 2.3, z: -0.1, yaw: -0.6, act: {
      hop: jump(3.0, 0.12), rear: [[0, 0], [2.5, 0], [3.0, 1], [3.7, 0], [L, 0]], pitch: [[0, -0.14], [3.0, -0.42], [3.8, -0.18], [L, -0.14]],
      roll: [[0, 0.16], [1.6, 0.24], [3.0, -0.1], [4.6, 0.16], [L, 0.16]], yaw: [[0, -0.15], [2.2, -0.15], [3.0, 0.2], [5, 0.2], [6.2, -0.15], [L, -0.15]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.95, zara: 3.3, rho: 2.7, dina: 3.0 }[name] }));

  // the answers: a Seed, a slice of the pie, a sprout
  const answers = [
    { at: 1.95, x: 0.38, y: 2.04, z: 0.5, one: bubble((g, x, y, s) => drawSeed(g, x, y, s * 0.42, '#2d2a4a', '#fff1cf')) },
    { at: 2.3, x: 1.18, y: 1.93, z: 0.55, one: bubble((g, x, y, s) => {
      g.fillStyle = '#ffd36b';
      g.beginPath();
      g.moveTo(x - s * 0.02, y + s * 0.04);
      g.arc(x - s * 0.02, y + s * 0.04, s * 0.22, -Math.PI / 2, 0.5);
      g.closePath();
      g.fill();
      g.strokeStyle = '#ff9fc4';
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.arc(x - s * 0.02, y + s * 0.04, s * 0.2, 0.85, Math.PI * 1.36);
      g.stroke();
    }) },
    { at: 2.65, x: 2.08, y: 2.12, z: 0.6, one: bubble((g, x, y, s) => {
      g.strokeStyle = '#2f9e58';
      g.lineWidth = s * 0.055;
      g.beginPath();
      g.moveTo(x, y + s * 0.22);
      g.quadraticCurveTo(x + s * 0.04, y + s * 0.05, x, y - s * 0.04);
      g.stroke();
      g.fillStyle = '#3fb565';

      for (const side of [-1, 1]) { g.beginPath(); g.ellipse(x + side * s * 0.1, y - s * 0.09, s * 0.11, s * 0.06, side * -0.55, 0, TAU); g.fill(); }
    }) },
  ];

  for (const { one } of answers) fx.add(one);

  // two toy planes, each on its own round path above the pupils, one over the other
  const planes = [[0xffb020, 1.35, 3.1, -0.9, 0.95, 0.1, 0.4], [0xff6fa5, 1.35, 3.38, -0.9, 0.8, 0.08, 0.4 + Math.PI]].map(([color, x, y, z, reach, rise, phase]) => {
    const one = plane(color);

    fx.add(one);

    return { plane: one, x, y, z, reach, rise, phase };
  });
  const effects = [
    twinkles(fx, { loop, cast, peaks: { liruf: 2.95, zara: 3.3, rho: 2.7, dina: 3.0 } }),
    landings(fx, { actors, color: 0xffffff }),
    // chalk dust by the board, in the chalks' own colors
    rising(fx, { loop, at: { x: BOARD.x, y: 1.7, z: BOARD.z + 0.4 }, radius: 1.3, height: 1.7, count: 26, color: [0xffe08a, 0xff9fc4, 0x9fd0ff, 0xffffff], size: [0.03, 0.07], seed: 6, sway: 0.1, depth: 0.2 }),
  ];
  const at = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const path = (one, w, out) => out.set(one.x + Math.sin(w + one.phase) * one.reach, one.y + Math.sin(w * 2 + one.phase) * one.rise, one.z + Math.cos(w + one.phase) * one.reach * 0.4);

  scene.add(set, fx);

  return {
    cast,
    still: 2.95,
    camera: { y: 2.3, dist: 14.1, lookY: 1.4 },
    update(t, rigs) {
      const w = (t / loop) * TAU;

      // Zara's left arm out to her pupils; her right hand opens a little as she speaks
      const point = curve(POINT, t);

      rigs.zara.rot('LeftArm', tools.Z, point * 1.3);
      rigs.zara.rot('RightArm', tools.Z, -0.2 - Math.max(0, Math.sin(w * 3)) * 0.25);

      // each answer pops, holds, bobs a little and closes
      for (const [i, { at: from, x, y, z, one }] of answers.entries()) {
        const since = t - from;
        const pop = since < 0 ? 0 : since < 0.35 ? (since / 0.35) * (1 + 0.25 * Math.sin((since / 0.35) * Math.PI)) : since < 3.4 ? 1 : Math.max(0, 1 - (since - 3.4) / 0.3);

        one.visible = pop > 0.01;
        one.position.set(x, y + Math.sin(w * 2 + i * 2) * 0.03, z);
        one.scale.setScalar(0.62 * pop);
      }

      world.ball.rotation.y = w;

      for (const one of planes) {
        path(one, w, at);
        path(one, w + 0.05, ahead);
        one.plane.position.copy(at);
        one.plane.lookAt(ahead);
        one.plane.rotateZ(Math.cos(w + one.phase) * -0.3);
      }

      for (const effect of effects) effect(t);
    },
  };
}
