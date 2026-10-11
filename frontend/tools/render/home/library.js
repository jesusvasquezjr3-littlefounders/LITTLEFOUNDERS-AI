// Home composition "library": the four mentors in a library where the books fly. The moment: the largest book opens
// over their heads, its pages light up, and Seeds and stars rise out of it.
//
// The setting is an island: a round floor of dark honey wood with a brass edge and a round red rug in its middle (the
// mentors' room, where nothing else stands). Behind them, five tall bookcases with round tops stand in an arc, full
// of books. At the far left, a round armchair under a reading lamp, which is a real light; at the far right, a
// rolling ladder against the last bookcase. Three open books float above the mentors in a golden light, pictures
// rising out of their pages (Seeds and stars, never words), and dust drifts in the lamplight.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.4, z: -0.6 };
const CHAIR = { x: -2.62, z: 0.1 };
const LAMP = { x: -2.94, z: -0.6 };
const HERO = { x: -0.1, y: 2.5, z: -1.0 };
const OPENS = 1.5; // the second the largest book opens

const SPINES = [C.indigo, C.indigoDeep, C.orange, C.gold, C.mint, C.mintDeep, C.red, C.pink, C.sky, C.cream, C.indigoPale];

// ---- the floor: boards of dark honey wood, a brass edge
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const next = sequence(63);

    g.fillStyle = '#cf9257';
    g.fillRect(0, 0, w, w);

    // boards across, each cut in lengths, a little lighter or darker than the next
    for (let i = 0; i < 22; i++) {
      let x = -next() * 300;

      while (x < w) {
        const length = 260 + next() * 240;

        g.fillStyle = `rgba(${next() > 0.5 ? '244,190,130' : '150,92,50'},${0.1 + next() * 0.2})`;
        g.fillRect(x, (i / 22) * w, length, w / 22);
        g.fillStyle = 'rgba(110,66,36,0.45)';
        g.fillRect(x - 2, (i / 22) * w, 4, w / 22);
        x += length;
      }

      g.fillStyle = 'rgba(110,66,36,0.45)';
      g.fillRect(0, (i / 22) * w - 2, w, 4);
    }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), standard(0xffffff, 0.55, { map: top }));
  const edge = mesh(new THREE.TorusGeometry(R - 0.035, 0.05, 14, 128), standard(0xf2bf2a, 0.3, { metalness: 0.6 }), 0, -0.04, 0);

  disc.receiveShadow = true;
  edge.rotation.x = Math.PI / 2;
  group.add(disc, edge, lathe([[0, -0.4], [2.4, -0.4], [3.05, -0.3], [R - 0.04, -0.16], [R - 0.01, -0.06]], standard(0x8a5a36, 0.85)));

  return group;
}

// ---- the rug: round, deep red with cream and gold rings
function rug(radius) {
  const picture = canvasTexture([1024, 1024], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#ffe2a8');
    ring(0.95, '#b8323f');
    ring(0.8, '#ffe2a8');
    ring(0.775, '#cf4553');
    ring(0.46, '#ffe2a8');
    ring(0.435, '#b8323f');
    g.fillStyle = '#ffd36b';

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;

      g.beginPath();
      g.arc(half + Math.cos(a) * half * 0.875, half + Math.sin(a) * half * 0.875, 13, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(half + Math.cos(a + 0.2) * half * 0.62, half + Math.sin(a + 0.2) * half * 0.62, 20, 0, TAU);
      g.fill();
    }
  });
  const m = mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 96), [standard(0xffe2a8, 0.95), standard(0xffffff, 0.95, { map: picture }), standard(0xffe2a8, 0.95)], 0, 0.015, 0);

  m.castShadow = false;

  return m;
}

// ---- a tall bookcase with a round top, full of books
function bookcase(width, height, seed) {
  const group = new THREE.Group();
  const wood = standard(0xb5763f, 0.7);
  const inside = standard(0x6a4226, 0.85);
  const next = sequence(seed);
  const body = height - width / 2;
  const rows = Math.floor((body - 0.1) / 0.46);
  const tall = (body - 0.1) / rows;
  const top = cylinder(width / 2, width / 2, 0.36, wood, 0, body, 0, 64);
  const niche = cylinder(width / 2 - 0.09, width / 2 - 0.09, 0.05, inside, 0, body, 0.165, 64);

  top.rotation.x = Math.PI / 2;
  niche.rotation.x = Math.PI / 2;
  group.add(box(width, body, 0.36, wood, 0, body / 2, 0, 0.06), top, niche);

  for (let row = 0; row < rows; row++) {
    const foot = 0.08 + row * tall;
    const room = tall - 0.07;
    let x = -(width - 0.26) / 2;
    let count = 0;

    group.add(box(width - 0.18, room, 0.05, inside, 0, foot + room / 2, 0.165, 0.04));

    while (x < (width - 0.26) / 2 - 0.06) {
      const thick = Math.min(0.055 + next() * 0.05, (width - 0.26) / 2 - x);
      const up = room * (0.62 + next() * 0.3);

      count++;

      // now and then a gap between the books, with a Seed standing in it
      if (count % 7 === 4 && x < (width - 0.26) / 2 - 0.3) {
        if ((row + seed) % 2) {
          const kept = seedMesh(room * 0.6);

          kept.position.set(x + 0.09, foot + room * 0.3, 0.22);
          group.add(kept);
        }

        x += 0.18;
        continue;
      }

      const book = box(thick, up, 0.17, standard(SPINES[Math.floor(next() * SPINES.length)], 0.6), x + thick / 2, foot + up / 2, 0.21, 0.02);

      group.add(book);
      x += thick + 0.01;
    }
  }

  return group;
}

// ---- the rolling ladder: two rails, round rungs, two wheels. It leans back (toward -z) from its foot.
function ladder(height, lean) {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.6);
  const brass = standard(0xf2bf2a, 0.3, { metalness: 0.6 });

  for (const side of [-1, 1]) {
    group.add(tube([[side * 0.24, 0.07, lean], [side * 0.24, height, 0]], 0.03, wood, 8), sphere(0.07, standard(C.slate, 0.5), side * 0.24, 0.07, lean), sphere(0.045, brass, side * 0.24, height + 0.02, 0));
  }

  for (let i = 1; i <= Math.floor(height / 0.3); i++) {
    const up = i * 0.3 / height;
    const rung = cylinder(0.022, 0.022, 0.48, wood, 0, 0.07 + (height - 0.07) * up, lean * (1 - up), 10);

    rung.rotation.z = Math.PI / 2;
    group.add(rung);
  }

  return group;
}

// ---- the armchair: round everywhere, a cushion on it and a closed book left on the seat
function armchair() {
  const group = new THREE.Group();
  const velvet = standard(0x12a08c, 0.85);
  const deep = standard(0x0d8776, 0.85);
  const back = box(0.94, 0.8, 0.26, velvet, 0, 0.78, -0.3, 0.13);

  back.rotation.x = -0.14;
  group.add(
    box(0.94, 0.34, 0.82, velvet, 0, 0.31, 0, 0.15),
    box(0.6, 0.16, 0.56, deep, 0, 0.52, 0.06, 0.075),
    back,
    sphere(0.17, standard(C.gold, 0.8), -0.12, 0.72, -0.12, 0.8),
    box(0.3, 0.05, 0.22, standard(C.red, 0.6), 0.12, 0.625, 0.14, 0.022),
  );
  group.children[4].rotation.y = 0.4;

  for (const side of [-1, 1]) {
    group.add(box(0.22, 0.3, 0.76, velvet, side * 0.38, 0.6, 0.02, 0.11));

    for (const z of [-0.3, 0.3]) group.add(sphere(0.06, standard(C.woodDark, 0.6), side * 0.36, 0.07, z, 1.2));
  }

  return group;
}

// ---- the reading lamp: a round foot, a pole that bends over the armchair, a round shade
function lamp() {
  const group = new THREE.Group();
  const brass = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const shade = new THREE.Group();
  const glow = halo(0.42, 0xffd08a, 0.7);
  const light = new THREE.PointLight(0xffc878, 9, 5, 1.7);

  group.add(lathe([[0, 0], [0.2, 0], [0.22, 0.03], [0.06, 0.07], [0.03, 0.1], [0, 0.1]], brass), tube([[0, 0.08, 0], [0, 1.2, 0], [0.04, 1.75, 0.05], [0.24, 1.98, 0.2], [0.46, 1.93, 0.36]], 0.024, brass, 40));
  shade.position.set(0.5, 1.83, 0.39);
  shade.rotation.set(0.25, 0, -0.3);
  shade.add(lathe([[0.05, 0.14], [0.1, 0.11], [0.19, 0], [0.2, -0.04]], standard(0xff8f4a, 0.6, { side: THREE.DoubleSide, emissive: 0xc24a00, emissiveIntensity: 0.4 }), 0, 0, 0, 40), sphere(0.075, lit(0xfff1c4, 2.4), 0, -0.01, 0), sphere(0.05, brass, 0, 0.15, 0));
  glow.position.set(0.52, 1.74, 0.5);
  light.position.set(0.55, 1.65, 0.5);
  group.add(shade, glow, light);

  return group;
}

// soft rays of light, for behind the largest book
const RAYS = canvasTexture([512, 512], (g, s) => {
  g.translate(s / 2, s / 2);

  for (let i = 0; i < 12; i++) {
    const fade = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.5);

    fade.addColorStop(0, 'rgba(255,255,255,0.7)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, s * 0.5, (i / 12) * TAU - 0.09, (i / 12) * TAU + 0.09);
    g.closePath();
    g.fill();
  }
});

// what is on the pages: drawings only
const PAGES = [
  (g, w, h) => drawSeed(g, w / 2, h / 2, h * 0.5, '#2d2a4a', '#fff1cf'),
  (g, w, h) => {
    g.fillStyle = '#ebb806';
    g.beginPath();

    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? h * 0.12 : h * 0.26;
      const a = (i / 10) * TAU - Math.PI / 2;

      g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }

    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = '#ebb806';
    g.lineWidth = h * 0.06;
    g.fill();
    g.stroke();
  },
  (g, w, h) => {
    g.strokeStyle = '#2f9e58';
    g.lineCap = 'round';
    g.lineWidth = h * 0.05;
    g.beginPath();
    g.moveTo(w / 2, h * 0.76);
    g.quadraticCurveTo(w / 2 + 8, h * 0.56, w / 2, h * 0.42);
    g.stroke();
    g.fillStyle = '#3fb565';

    for (const side of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + side * w * 0.14, h * 0.36, w * 0.15, h * 0.07, side * -0.5, 0, TAU); g.fill(); }
  },
];

function page(draw) {
  return canvasTexture([192, 256], (g, w, h) => {
    g.fillStyle = '#fff6dc';
    g.fillRect(0, 0, w, h);
    draw(g, w, h);
  });
}

// what is on a cover: a golden Seed inside a golden line
const COVER = canvasTexture([192, 256], (g, w, h) => {
  g.strokeStyle = '#ffd36b';
  g.lineWidth = 7;
  g.beginPath();
  g.roundRect(18, 18, w - 36, h - 36, 22);
  g.stroke();
  g.translate(w / 2, h / 2);
  g.rotate(-Math.PI / 2);
  drawSeed(g, 0, 0, h * 0.4, '#ffd36b', '#b98a00');
});

// ---- an open book: two covers on a spine, a block of pages on each, a drawing on every page and a Seed on each
// cover. It lies open on its back, the spine along z; `spread(angle, thick)` closes it (the covers upright, the
// pages pressed thin between them) or opens it (flat).
function openBook(size, color, left, right) {
  const group = new THREE.Group();
  const cover = standard(color, 0.5);
  const paper = lit(0xfff1c8, 0.55);
  const halves = [[-1, left], [1, right]].map(([side, draw]) => {
    const hinge = new THREE.Group();
    const pages = new THREE.Group();
    const picture = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.4, size * 0.56), new THREE.MeshBasicMaterial({ map: page(draw), toneMapped: false }));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.44, size * 0.6), new THREE.MeshBasicMaterial({ map: COVER, transparent: true, toneMapped: false }));

    picture.rotation.x = -Math.PI / 2;
    picture.position.set(side * size * 0.235, size * 0.074, 0);
    front.rotation.x = Math.PI / 2;
    front.position.set(side * size * 0.25, -size * 0.019, 0);
    pages.add(box(size * 0.44, size * 0.06, size * 0.62, paper, side * size * 0.235, size * 0.042, 0, size * 0.028), picture);
    hinge.position.x = side * size * 0.02;
    hinge.add(box(size * 0.5, size * 0.035, size * 0.7, cover, side * size * 0.25, 0, 0, size * 0.017), pages, front);
    group.add(hinge);

    return { hinge, pages, side };
  });

  group.add(cylinder(size * 0.035, size * 0.035, size * 0.7, cover, 0, -size * 0.005, 0, 16));
  group.children[2].rotation.x = Math.PI / 2;

  return {
    group,
    paper,
    spread(angle, thick = 1) {
      for (const { hinge, pages, side } of halves) {
        hinge.rotation.z = side * angle;
        pages.scale.y = thick;
      }
    },
  };
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
  const chair = armchair();

  chair.scale.setScalar(0.82);
  set.add(place(floor(), 0, FLOOR.z), place(rug(1.9), -0.05, 0.15), shadowCatcher(FLOOR.radius - 0.08, 0.036, FLOOR.z, 0.32));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.5, FLOOR.z, 4.1, 3.4, 0));
  set.add(
    place(bookcase(1.5, 2.75, 3), -0.05, -2.9),
    place(bookcase(1.05, 2.4, 8), -1.42, -2.62, 0.14),
    place(bookcase(1.05, 2.4, 14), 1.32, -2.62, -0.14),
    place(bookcase(1.1, 2.2, 5), -2.52, -2.1, 0.28),
    place(bookcase(1.1, 2.2, 10), 2.5, -2.1, -0.28),
    place(ladder(1.95, 0.55), 2.84, -1.86, -0.28),
    place(chair, CHAIR.x, CHAIR.z, 0.5),
    place(lamp(), LAMP.x, LAMP.z, 0.1),
  );

  // the books that fly: the largest in the middle, one over each side
  const hero = openBook(1.0, C.indigo, PAGES[0], PAGES[1]);
  const others = [
    { ...openBook(0.62, C.red, PAGES[2], PAGES[0]), x: -1.78, y: 2.14, z: -0.9, yaw: 0.3, phase: 1.3 },
    { ...openBook(0.62, C.mintDeep, PAGES[1], PAGES[2]), x: 1.4, y: 2.2, z: -0.9, yaw: -0.3, phase: 3.6 },
  ];
  // golden light around each book: deep enough in color to show on the light page too
  const heroGlow = halo(1.25, 0xffb327, 0);
  const heroRays = sprite(RAYS, 0xffa200, 3);
  const heroLight = new THREE.PointLight(0xffd98a, 0, 6, 1.7);
  const flash = sprite(TEXTURES.ring, 0xfff0b8, 7);
  const fountain = new THREE.Group();

  heroGlow.renderOrder = 3;
  fx.add(hero.group, heroGlow, heroRays, heroLight, flash, fountain);

  for (const other of others) {
    other.glow = halo(0.62, 0xffb327, 0.7);
    other.glow.renderOrder = 3;
    fx.add(other.group, other.glow);
  }

  // the pictures that rise out of the pages
  const seedPicture = canvasTexture([96, 96], (g, s) => drawSeed(g, s / 2, s / 2, s * 0.8, '#ffd36b', '#2d2a4a'));
  const out = [
    rising(fountain, { loop, at: { x: 0, y: 0, z: 0 }, radius: 0.5, height: 0.82, count: 7, color: 0xffffff, size: [0.15, 0.22], texture: seedPicture, seed: 9, sway: 0.04, depth: 0.2, spin: false }),
    rising(fountain, { loop, at: { x: 0, y: 0, z: 0 }, radius: 0.55, height: 0.86, count: 12, color: [0xffe6a3, 0xffffff, 0xffc93a], size: [0.08, 0.16], texture: TEXTURES.star, seed: 12, depth: 0.2 }),
  ];

  const WONDER = [[0, 0.2], [1.3, 0.2], [2.0, 1], [4.8, 1], [5.6, 0.2], [L, 0.2]];
  const cast = {
    // Liruf follows the red book over his head, then turns to the big one as it opens, and jumps
    liruf: { x: -1.56, z: -0.05, yaw: 0.3, act: {
      hop: jump(2.35, 0.22), tuck: tuck(2.35, 0.8), yaw: [[0, -0.3], [1.4, -0.3], [2.1, 0.45], [4.8, 0.45], [6, -0.3], [L, -0.3]],
      pitch: [[0, -0.36], [1.4, -0.36], [2.1, -0.44], [4.8, -0.36], [L, -0.36]], roll: [[0, -0.12], [2.35, 0.14], [5, -0.12], [L, -0.12]],
      lean: [[0, -0.06], [2.35, -0.16], [3, -0.02], [L, -0.06]], tilt: [[0, -0.05], [2.35, 0.07], [3.2, 0], [L, -0.05]],
    } },
    // Zara looks up into the light, both hands open low at her sides
    zara: { x: -0.6, z: 0.4, yaw: 0.1, act: {
      hop: jump(2.15, 0.13), tuck: tuck(2.15, 0.45), lean: [[0, -0.02], [2.0, -0.16], [4.8, -0.12], [5.6, -0.02], [L, -0.02]], pitch: [[0, -0.1], [2.0, -0.42], [4.8, -0.34], [5.6, -0.1], [L, -0.1]],
      roll: [[0, 0.08], [2.0, -0.05], [3.4, 0.1], [4.8, -0.06], [L, 0.08]], yaw: [[0, -0.15], [2.0, 0.12], [L, -0.15]], tilt: [[0, 0], [3.4, 0.03], [L, 0]],
    } },
    // Rho reads the green book as it passes, and nods slowly: a good one
    rho: { x: 0.36, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.6, 0.14), tuck: tuck(2.6, 0.6), yaw: [[0, 0.4], [1.6, 0.4], [2.3, -0.15], [4.6, -0.15], [5.6, 0.4], [L, 0.4]],
      pitch: [[0, -0.3], [1.6, -0.3], [2.3, -0.42], [3.3, -0.12], [3.9, -0.4], [5.6, -0.3], [L, -0.3]], roll: [[0, 0.1], [2.6, -0.1], [4.4, 0.1], [L, 0.1]],
      lean: [[0, -0.05], [2.6, -0.15], [3.2, 0.03], [3.9, -0.08], [L, -0.05]],
    } },
    // Dina stretches her nose up toward the green book, and rears a little when the big one opens
    dina: { x: 1.5, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.75, 0.1), rear: [[0, 0.15], [2.2, 0.15], [2.75, 0.9], [3.6, 0.15], [L, 0.15]], pitch: [[0, -0.4], [2.75, -0.5], [3.6, -0.36], [L, -0.4]],
      roll: [[0, 0.18], [2.75, -0.1], [4.6, 0.2], [L, 0.18]], yaw: [[0, 0.1], [2, 0.3], [4, 0.45], [6, 0.2], [L, 0.1]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.35, zara: 2.15, rho: 2.6, dina: 2.75 }[name] }));
  const effects = [
    twinkles(fx, { loop, cast, peaks: { liruf: 2.35, zara: 2.15, rho: 2.6, dina: 2.75 }, colors: [0xffffff, 0xfff0b8, 0xffd36b] }),
    landings(fx, { actors, color: 0xfff3dd }),
    // dust in the light, all through the room, and a few stars out of the two smaller books
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -0.8 }, radius: 2.9, height: 2.6, count: 30, color: [0xffe9b8, 0xffffff, 0xffd98a], size: [0.025, 0.06], seed: 6, sway: 0.12, depth: 0.7 }),
    ...others.map((other, i) => rising(fx, { loop, at: { x: other.x, y: other.y + 0.15, z: other.z + 0.1 }, radius: 0.3, height: 0.7, count: 6, color: [0xffe6a3, 0xffffff], size: [0.07, 0.13], texture: i ? seedPicture : TEXTURES.star, seed: 20 + i, depth: 0.2, spin: !i })),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.4,
    camera: { y: 2.3, dist: 14.1, lookY: 1.45 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      // the largest book: closed, it opens with a small overshoot, and closes again before the loop ends
      const u = Math.max(0, Math.min(1, (t - OPENS) / 0.6));
      const closing = Math.max(0, Math.min(1, (L - 0.5 - t) / 1.1));
      const open = (u * u * (3 - 2 * u) + Math.sin(u * Math.PI) * 0.1) * closing * closing * (3 - 2 * closing);
      const y = HERO.y + Math.sin(w) * 0.06;

      hero.group.position.set(HERO.x, y, HERO.z);
      // closed, it shows its cover to the reader; it turns to face them as it opens
      hero.group.rotation.set(1.0 - (1 - open) * 0.85, (1 - open) * 1.25 + Math.sin(w) * 0.06 * (1 - open), Math.sin(w) * 0.05, 'YXZ');
      hero.spread((1 - open) * 1.39 + 0.16 + Math.sin(w * 4) * 0.035 * open, 0.24 + 0.76 * Math.min(1, open));
      hero.paper.emissiveIntensity = 0.3 + open * 0.9;
      heroGlow.position.set(HERO.x, y + 0.15, HERO.z - 0.25);
      heroGlow.material.opacity = open * 0.8;
      heroRays.position.copy(heroGlow.position);
      heroRays.scale.setScalar(2.1 * (0.6 + open * 0.4));
      heroRays.material.opacity = open * 0.5;
      heroRays.material.rotation = w * 0.25;
      heroLight.position.set(HERO.x, y - 0.2, HERO.z + 0.8);
      heroLight.intensity = open * 7;
      fountain.position.set(HERO.x, y + 0.2, HERO.z + 0.15);
      fountain.scale.setScalar(Math.max(0.001, open));
      fountain.visible = open > 0.05;

      const burst = (t - OPENS - 0.25) / 0.7;

      flash.visible = burst > 0 && burst < 1;
      flash.position.set(HERO.x, y + 0.1, HERO.z + 0.3);
      flash.scale.setScalar(0.8 + burst * 2.4);
      flash.material.opacity = 0.75 * (1 - burst);

      // the two smaller books beat their covers like wings and drift on their own paths
      for (const other of others) {
        const at = [other.x + Math.sin(w + other.phase) * 0.14, other.y + Math.sin(w * 2 + other.phase) * 0.08, other.z];

        other.group.position.set(...at);
        other.group.rotation.set(1.0, other.yaw + Math.sin(w + other.phase) * 0.12, Math.sin(w * 2 + other.phase) * 0.08, 'YXZ');
        other.spread(0.3 + Math.sin(w * 4 + other.phase) * 0.22);
        other.glow.position.set(at[0], at[1] + 0.08, at[2] - 0.2);
      }

      // Zara's hands open at her sides, as if to catch the light
      const wonder = curve(WONDER, t);

      rigs.zara.rot('LeftArm', tools.Z, wonder * 0.42);
      rigs.zara.rot('RightArm', tools.Z, -wonder * 0.42);

      for (const effect of [...effects, ...out]) effect(t);
    },
  };
}
