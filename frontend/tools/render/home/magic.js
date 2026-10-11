// Home composition "magic": the four mentors in the hall of a school of magic, the moment a Seed that floats between
// them takes the spell: it lights up gold and puts out two leaves.
//
// The setting is an island: a round stone floor with a star and a moon inlaid in it, and stone underneath. Behind
// Liruf, Zara and Rho stand three pieces of the hall's round wall, each a round-topped arch of stone edged with
// round stones, set on the circle of the hall with night showing between them, each with a tall round-arched
// window that glows; an owl sits on the first. On the left a cauldron bubbles in front of a small round stand of
// potion bottles. Candles float at many heights, some of them real lights; two open books float with their pages
// turning; stars and moons drift in a cloud of night violet that fades to nothing before the frame's borders.
// Nothing stands behind Dina, who is large: her side of the hall is open to the night.
//
// Nobody holds a wand: Zara holds the spell between two low open hands and a thread of stars runs up from them to
// the Seed. No crest, scarf or anything else here belongs to a story that exists.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const HALL = { radius: 3.2, z: -0.5 };
// the wall: part of a circle around the hall's middle, from `from` to `to` (angles from the back, positive to the reader's left)
const WALL = { radius: 2.86 };
// the three pieces of wall: where on the hall's circle (the angle from the back, positive to the reader's left), how
// wide and how tall
const ARCHES = [{ angle: 0.92, width: 1.16, height: 2.56 }, { angle: 0.32, width: 0.88, height: 2.86 }, { angle: -0.22, width: 0.88, height: 2.46 }];
const CAULDRON = { x: -2.72, z: 0.42 };
const STAND = { x: -2.82, z: -1.15 };
const SEED = { x: -0.1, y: 2.02, z: 0.15 };
// the two small moons in the night behind: beside Dina and over the wall, never where a head goes
const MOONS = [[3.6, 2.45], [1.5, 3.25]];
const SPELL = 2.2; // the second the Seed takes the spell
/** A place on the wall's circle at `angle`, `r` from the hall's middle. */
const onWall = (angle, r = WALL.radius) => [-Math.sin(angle) * r, HALL.z - Math.cos(angle) * r];

// ---- the floor: stone slabs in rings, and a star and a moon inlaid in gold in its middle
function floor() {
  const group = new THREE.Group();
  const next = sequence(83);
  const R = HALL.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const tones = ['#b9b6d8', '#aeaace', '#c4c1e0', '#b3afd4'];

    g.fillStyle = '#8b87b4';
    g.fillRect(0, 0, w, w);

    for (let ring = 0; ring < 7; ring++) {
      const r0 = ring ? 70 + (ring - 1) * 110 : 0;
      const r1 = 70 + ring * 110 - 8;
      const count = ring ? 5 + ring * 3 : 1;
      const turn = next() * TAU;

      for (let i = 0; i < count; i++) {
        const a0 = turn + (i / count) * TAU + 0.012 * (7 - ring);
        const a1 = turn + ((i + 1) / count) * TAU - 0.012 * (7 - ring);

        g.fillStyle = tones[Math.floor(next() * tones.length)];
        g.beginPath();
        g.arc(half, half, r1, a0, a1);
        g.arc(half, half, Math.max(r0, 0.01), a1, a0, true);
        g.closePath();
        g.fill();
      }
    }

    // the inlay, a little before the middle so it lies in front of the mentors: a ring, a round-pointed star, a moon
    const cx = half;
    const cy = half * 1.3;

    g.strokeStyle = '#f2c84a';
    g.fillStyle = '#f2c84a';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.beginPath();
    g.arc(cx, cy, 250, 0, TAU);
    g.stroke();
    g.beginPath();

    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 78 : 196;
      const a = (i / 10) * TAU - Math.PI / 2;

      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }

    g.closePath();
    g.lineWidth = 26;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 52, 0, TAU);
    g.fill();
    g.fillStyle = tones[2];
    g.beginPath();
    g.arc(cx + 22, cy - 12, 44, 0, TAU);
    g.fill();
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x8d89b8, 0.9), standard(0xffffff, 0.7, { map: picture }), standard(0x6f6b9c, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.1, 14, 128), standard(0xc9c6e4, 0.85), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.64], [1.2, -0.6], [2.2, -0.45], [2.9, -0.26], [R - 0.04, -0.1]], standard(0x6f6b9c, 0.95)));

  return group;
}

// ---- one piece of the wall: a round-topped arch of stone with round edges, round stones of many sizes all along
// its outline so no edge of it is straight, and a tall round-arched window that gives light
function arch({ width, height }, seed) {
  const group = new THREE.Group();
  const stone = standard(0x8f89c6, 0.9);
  const pale = [standard(0xa9a4d8, 0.9), standard(0x9a94cc, 0.9), standard(0xb6b2e0, 0.9)];
  const next = sequence(seed);
  const half = width / 2;
  const spring = height - half; // where the round top starts
  const outline = new THREE.Shape();

  outline.moveTo(-half, 0);
  outline.lineTo(-half, spring);
  outline.absarc(0, spring, half, Math.PI, 0, true);
  outline.lineTo(half, 0);
  outline.closePath();
  group.add(mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.14, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 6, curveSegments: 32 }), stone, 0, 0, -0.07));

  // the stones along the outline: up one side, over the top, down the other
  const run = 2 * spring + Math.PI * half;
  let d = 0.1;

  while (d < run - 0.05) {
    const r = 0.12 + next() * 0.075;
    const a = (d - spring) / half;
    const [x, y] = d < spring ? [-half, d] : d < spring + Math.PI * half ? [-Math.cos(a) * half, spring + Math.sin(a) * half] : [half, run - d];
    const one = sphere(r, pale[Math.floor(next() * 3)], x, y, 0.02, 0.86);

    one.scale.z = 1.25;
    group.add(one);
    d += r * 1.55;
  }

  // the window
  const pane = new THREE.Shape();
  const glow = halo(1.0, 0xffd98a, 0.38);
  const light = new THREE.PointLight(0xffd9a0, 5, 6, 1.7);
  const frame = new THREE.Group();

  pane.moveTo(-0.3, 0);
  pane.lineTo(-0.3, 0.72);
  pane.absarc(0, 0.72, 0.3, Math.PI, 0, true);
  pane.lineTo(0.3, 0);
  pane.closePath();
  frame.position.set(0, height - half - 0.78, 0.175);
  glow.position.set(0, 0.55, 0.08);
  light.position.set(0, 0.55, 0.9);
  frame.add(
    new THREE.Mesh(new THREE.ShapeGeometry(pane, 32), lit(0xffe2a0, 1.9)),
    tube([[-0.32, 0, 0.02], [-0.32, 0.72, 0.02], [-0.225, 0.945, 0.02], [0, 1.04, 0.02], [0.225, 0.945, 0.02], [0.32, 0.72, 0.02], [0.32, 0, 0.02]], 0.045, pale[0], 48),
    cylinder(0.022, 0.022, 1.0, pale[0], 0, 0.5, 0.02, 10),
    cylinder(0.022, 0.022, 0.62, pale[0], 0, 0.56, 0.02, 10).rotateZ(Math.PI / 2),
    box(0.8, 0.09, 0.14, pale[0], 0, -0.03, 0.04, 0.045),
    glow, light,
  );
  group.add(frame);

  return { group, glow };
}

// ---- the owl: round, with large round eyes, sitting on top of the first piece of wall
function owl() {
  const group = new THREE.Group();
  const feather = standard(0xf1ecff, 0.9);
  const wing = standard(0xb9aef0, 0.9);
  const head = new THREE.Group();

  group.add(sphere(0.2, feather, 0, 0.2, 0, 1.1), sphere(0.13, standard(0xfff6df, 0.9), 0, 0.17, 0.11, 1.15));

  for (const side of [-1, 1]) {
    const one = sphere(0.13, wing, side * 0.17, 0.2, -0.01, 1.3);

    one.scale.x = 0.45;
    one.rotation.z = side * 0.18;
    group.add(one, sphere(0.035, standard(C.orange, 0.6), side * 0.07, 0.01, 0.12, 0.6));
  }

  head.position.y = 0.45;
  head.add(sphere(0.17, feather, 0, 0, 0, 0.92), sphere(0.03, standard(C.orange, 0.5), 0, -0.035, 0.165, 1.2));

  for (const side of [-1, 1]) {
    head.add(
      sphere(0.07, standard(0xffffff, 0.4), side * 0.075, 0.02, 0.125, 1),
      sphere(0.04, standard(C.ink, 0.3), side * 0.075, 0.02, 0.172, 1),
      sphere(0.012, lit(0xffffff, 1.2), side * 0.075 - 0.012, 0.035, 0.208, 1),
      sphere(0.05, wing, side * 0.11, 0.14, 0, 1.2),
    );
  }

  group.add(head);

  return { group, head };
}

// ---- the cauldron: a round iron pot on three round feet, full of a potion that gives light
function cauldron() {
  const group = new THREE.Group();
  const iron = standard(0x3f4266, 0.5, { metalness: 0.35 });
  const potion = cylinder(0.4, 0.4, 0.03, lit(0x52f0c0, 1.6), 0, 0.62, 0, 48);
  const glow = halo(0.75, 0x7dfbdc, 0.5);
  const light = new THREE.PointLight(0x6ff0c8, 5, 4, 1.8);

  potion.castShadow = false;
  glow.position.y = 0.72;
  light.position.set(0.2, 0.95, 0.3);
  group.add(
    // a round belly: the profile is a smooth curve, so the pot has no facets
    lathe([...Array.from({ length: 25 }, (_, i) => { const a = -Math.PI / 2 + (i / 24) * Math.PI * 0.86; return [Math.cos(a) * 0.5, 0.38 + Math.sin(a) * 0.3]; }), [0.46, 0.68], [0.44, 0.71], [0.39, 0.67], [0.39, 0.6], [0, 0.6]], iron),
    mesh(new THREE.TorusGeometry(0.445, 0.035, 12, 48), iron, 0, 0.69, 0).rotateX(Math.PI / 2),
    potion, glow, light,
  );

  for (let i = 0; i < 3; i++) group.add(sphere(0.085, iron, Math.sin((i / 3) * TAU) * 0.3, 0.07, Math.cos((i / 3) * TAU) * 0.3, 0.9));

  return { group, glow };
}

/** A round potion bottle: a flask, a short neck, a cork. */
function bottle(color, size) {
  const group = new THREE.Group();
  const glassy = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.15 });

  group.add(sphere(size, glassy, 0, size * 0.92, 0, 0.92), cylinder(size * 0.3, size * 0.36, size * 0.6, glassy, 0, size * 1.95, 0, 20), sphere(size * 0.33, standard(C.woodDark, 0.8), 0, size * 2.32, 0, 0.8));

  return group;
}

// ---- the stand: two round shelves on a round column, with the bottles on them
function stand() {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.8);

  group.add(
    lathe([[0, 0], [0.3, 0], [0.32, 0.05], [0.12, 0.12], [0.07, 0.3], [0.07, 1.16], [0, 1.16]], standard(C.woodDark, 0.8)),
    cylinder(0.44, 0.44, 0.07, wood, 0, 0.66, 0, 48), cylinder(0.34, 0.34, 0.07, wood, 0, 1.18, 0, 48),
  );

  for (const [a, r, y, color, size] of [[0.3, 0.27, 0.7, 0xff6fa5, 0.11], [2.3, 0.27, 0.7, 0x4b94ff, 0.1], [4.3, 0.27, 0.7, 0xf2bf2a, 0.09], [0.9, 0.15, 1.22, 0x8f8aff, 0.1], [3.9, 0.15, 1.22, 0x35e0b8, 0.085]]) {
    group.add(place(bottle(color, size), Math.sin(a) * r, Math.cos(a) * r, 0, y));
  }

  return group;
}

// ---- a candle that floats: a round stick of wax, a flame, a halo; `real` ones are lights
function candle(real) {
  const group = new THREE.Group();
  const flame = sprite(TEXTURES.dot, 0xffd27a, 7);
  const core = sprite(TEXTURES.dot, 0xfffbe0, 8);
  const glow = halo(0.3, 0xffc66a, 0.5);

  flame.position.y = 0.17;
  core.position.y = 0.155;
  glow.position.y = 0.17;
  group.add(cylinder(0.04, 0.045, 0.2, standard(0xfff3d6, 0.6, { emissive: 0xffe0a0, emissiveIntensity: 0.35 }), 0, 0, 0, 20), sphere(0.045, standard(0xfff3d6, 0.6, { emissive: 0xffe0a0, emissiveIntensity: 0.35 }), 0, -0.1, 0, 0.5), flame, core, glow);

  if (real) {
    const light = new THREE.PointLight(0xffc878, 2.2, 3.2, 1.8);

    light.position.y = 0.2;
    group.add(light);
  }

  return { group, flame, core, glow };
}

// ---- an open book that floats: two round-edged covers, two blocks of pages, and one page that turns
function book(cover) {
  const group = new THREE.Group();
  const paper = standard(0xfff6df, 0.9);
  const page = new THREE.Group();

  for (const side of [-1, 1]) {
    const half = new THREE.Group();

    half.rotation.z = side * 0.2;
    half.add(box(0.36, 0.035, 0.46, standard(cover, 0.6), side * 0.18, 0, 0, 0.017), box(0.32, 0.05, 0.42, paper, side * 0.17, 0.04, 0, 0.02));
    group.add(half);
  }

  page.position.y = 0.07;
  page.add(box(0.3, 0.008, 0.4, paper, 0.15, 0, 0, 0.004));
  group.add(page, cylinder(0.02, 0.02, 0.46, standard(cover, 0.6), 0, -0.01, 0, 12).rotateX(Math.PI / 2));

  return { group, page };
}

// ---- far behind: a cloud of night violet with stars and small moons that drift
function night(fx, loop) {
  const group = new THREE.Group();
  const next = sequence(57);
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(58,34,132,0.95)');
    deep.addColorStop(0.55, 'rgba(70,46,160,0.82)');
    deep.addColorStop(0.82, 'rgba(92,66,196,0.3)');
    deep.addColorStop(1, 'rgba(92,66,196,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    for (const [x, y, r, color] of [[0.34, 0.56, 0.3, '255,150,210'], [0.7, 0.42, 0.28, '90,170,255']]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},0.24)`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  const crescent = canvasTexture([128, 128], (g, s) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.4, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(s * 0.66, s * 0.42, s * 0.34, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  const updates = [];

  cloud.position.set(0.3, 1.1, -8.5);
  cloud.scale.set(10.2, 4.9, 1);
  group.add(cloud);

  for (let i = 0; i < 40; i++) {
    const moon = i < MOONS.length;
    const one = sprite(moon ? crescent : i % 4 ? TEXTURES.dot : TEXTURES.star, moon ? 0xffe9a8 : [0xffffff, 0xfff0b8, 0xe6d9ff][i % 3], 1);
    const a = next() * TAU;
    const r = Math.sqrt(next());
    const x = moon ? MOONS[i][0] : 0.3 + Math.cos(a) * r * 4.3;
    const y = moon ? MOONS[i][1] : 1.25 + Math.sin(a) * r * 1.95;
    const size = moon ? 0.34 + next() * 0.12 : (i % 4 ? 0.05 : 0.2) + next() * 0.06;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    fx.add(one);
    updates.push((t) => {
      const w = (t / loop) * TAU;
      const twinkle = moon ? 0.9 : 0.55 + 0.45 * Math.sin(w * speed + phase);

      one.position.set(x + Math.sin(w + phase) * 0.14, y + Math.cos(w + phase) * 0.08, -8);
      one.scale.setScalar(size * (0.8 + twinkle * 0.3));
      one.material.opacity = twinkle;
      one.material.rotation = moon ? Math.sin(w + phase) * 0.3 - 0.4 : 0;
    });
  }

  return { group, update: (t) => { for (const update of updates) update(t); } };
}

export function build(scene, { loop, heights, jump, tuck, curve, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const next = sequence(33);
  const far = night(fx, loop);
  const arches = ARCHES.map((spec, i) => ({ ...arch(spec, 21 + i * 8), spec }));
  const bird = owl();
  const pot = cauldron();
  const [ox, oz] = onWall(ARCHES[0].angle);

  set.add(place(floor(), 0, HALL.z), shadowCatcher(HALL.radius - 0.12, 0.008, HALL.z, 0.34), far.group);
  set.add(decal(radial([[0, 'rgba(60,40,150,0.30)'], [0.6, 'rgba(60,40,150,0.15)'], [1, 'rgba(60,40,150,0)']]), 0, -0.72, HALL.z, 3.2, 2.0, 0));
  set.add(place(bird.group, ox, oz + 0.04, -0.3, ARCHES[0].height + 0.1), place(pot.group, CAULDRON.x, CAULDRON.z), place(stand(), STAND.x, STAND.z));

  // each piece stands on the hall's circle, turned half way toward its middle
  for (const { group, spec } of arches) set.add(place(group, ...onWall(spec.angle), spec.angle * 0.5));

  // candles afloat, each at its own height and none over the owl; three of them are real lights
  const candles = [[-3.0, 2.15, -0.6, 1], [-1.2, 2.9, -0.6, 0], [0.4, 2.92, -0.6, 1], [1.45, 2.55, -1.2, 0], [2.25, 2.9, -1.2, 0], [2.9, 2.2, -0.5, 1], [2.75, 1.6, -1.9, 0]].map(([x, y, z, real], i) => {
    const one = candle(Boolean(real));

    set.add(one.group);

    return { ...one, x, y, z, phase: i * 1.37 };
  });
  const books = [[-2.75, 2.85, -0.9, C.indigo, 0.5, 0], [2.65, 2.62, -1.0, C.red, -0.45, 3.3]].map(([x, y, z, cover, yaw, phase]) => {
    const one = book(cover);

    one.group.rotation.set(0.75, yaw, 0);
    set.add(one.group);

    return { ...one, x, y, z, phase };
  });

  // the Seed, afloat in the middle; its golden twin and two leaves come out of it with the spell
  const seed = seedMesh(0.46);
  const golden = seedMesh(0.46);
  const leaves = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const leaf = sphere(0.13, standard(0x5cd97a, 0.6, { emissive: 0x2f9e58, emissiveIntensity: 0.4 }), side * 0.13, 0.05, 0, 0.42);

    leaf.scale.z = 0.6;
    leaf.castShadow = false;
    hinge.add(leaf, cylinder(0.014, 0.014, 0.1, standard(0x3fb565, 0.6), side * 0.02, -0.02, 0, 8));
    fx.add(hinge);

    return { hinge, side };
  });
  const seedGlow = halo(0.7, 0xffd36b, 0.55);
  const seedRays = sprite(TEXTURES.star, 0xffe08a, 5);
  const seedRing = sprite(TEXTURES.ring, 0xfff0b8, 6);
  const seedLight = new THREE.PointLight(0xffd070, 3, 4.5, 1.8);

  golden.material = standard(0xf2bf2a, 0.25, { metalness: 0.75, emissive: 0x8a5c00, emissiveIntensity: 0.9 });
  seed.castShadow = false;
  golden.castShadow = false;
  seedLight.position.set(SEED.x, SEED.y, SEED.z + 0.5);
  fx.add(seed, golden, seedGlow, seedRays, seedRing);
  set.add(seedLight);

  const cast = {
    // Liruf cannot believe it: he leans in, then jumps
    liruf: { x: -1.75, z: -0.05, yaw: 0.34, act: {
      hop: jump(2.7, 0.26), tuck: tuck(2.7, 0.8), lean: [[0, 0.1], [2.2, 0.16], [2.7, -0.14], [3.2, 0.1], [L, 0.1]],
      pitch: [[0, -0.3], [2.2, -0.34], [2.7, -0.4], [3.4, -0.26], [L, -0.3]], yaw: [[0, 0.4], [3.6, 0.48], [5.6, 0.3], [L, 0.4]],
      roll: [[0, -0.1], [2.7, 0.14], [4.4, -0.14], [L, -0.1]], tilt: [[0, 0.04], [2.7, 0.1], [3.4, 0.04], [L, 0.04]],
    } },
    // Zara casts: both hands low and open before her as if she held the spell, and a small rise on her toes when it takes
    zara: { x: -0.82, z: 0.4, yaw: 0.14, act: {
      hop: jump(2.35, 0.08), lean: [[0, -0.04], [1.4, 0.06], [2.3, -0.12], [3.2, -0.06], [L, -0.04]],
      pitch: [[0, -0.3], [L, -0.3]], yaw: [[0, 0.32], [L, 0.32]], roll: [[0, 0.06], [2.3, 0.12], [4.6, 0.04], [L, 0.06]],
      tilt: [[0, 0], [1.4, -0.04], [2.3, 0.05], [4.6, 0], [L, 0]],
    } },
    // Rho starts back from the light, then nods at it, pleased
    rho: { x: 0.16, z: 0.45, yaw: -0.12, act: {
      hop: jump(3.0, 0.15), tuck: tuck(3.0, 0.6), lean: [[0, 0.02], [2.1, 0.06], [2.4, -0.22], [3.0, -0.12], [3.5, 0.08], [4.2, 0], [L, 0.02]],
      pitch: [[0, -0.34], [2.4, -0.42], [3.0, -0.4], [3.5, -0.1], [4.2, -0.34], [L, -0.34]], yaw: [[0, -0.34], [L, -0.34]],
      roll: [[0, 0.1], [2.4, -0.1], [4.2, 0.1], [L, 0.1]], tilt: [[0, 0], [2.4, 0.08], [3.2, 0], [L, 0]],
    } },
    // Dina follows the Seed with her nose and rears up when it lights
    dina: { x: 2.1, z: -0.1, yaw: -0.5, act: {
      hop: jump(3.3, 0.1), rear: [[0, 0], [2.85, 0], [3.3, 0.7], [3.95, 0], [L, 0]], pitch: [[0, -0.32], [2.2, -0.38], [3.3, -0.44], [4.1, -0.3], [L, -0.32]],
      yaw: [[0, -0.16], [2.2, -0.22], [5, -0.1], [L, -0.16]], roll: [[0, 0.14], [2.4, -0.1], [4.6, 0.14], [L, 0.14]],
    } },
  };
  const names = Object.keys(cast);
  const actors = names.map((name) => ({ x: cast[name].x, z: cast[name].z, height: heights[name], peak: { liruf: 2.7, zara: 2.35, rho: 3.0, dina: 3.3 }[name], clear: { liruf: 0.6, dina: 0.8 }[name] }));

  // the thread of stars from between Zara's hands up to the Seed
  const hand = [cast.zara.x + 0.12, 1.12, cast.zara.z + 0.42];
  const thread = Array.from({ length: 9 }, (_, i) => {
    const one = sprite(TEXTURES.star, [0xffffff, 0xffe9a8, 0xd9c8ff][i % 3], 8);

    fx.add(one);

    return { one, lag: i / 9, size: 0.07 + next() * 0.06 };
  });
  // the burst of stars when the spell takes
  const burst = Array.from({ length: 14 }, (_, i) => {
    const one = sprite(TEXTURES.star, [0xffffff, 0xffe08a, 0xfff3c4, 0xd9c8ff][i % 4], 9);

    fx.add(one);

    return { one, a: (i / 14) * TAU + next() * 0.3, reach: 0.5 + next() * 0.45, size: 0.14 + next() * 0.12, delay: next() * 0.2 };
  });
  // a bubble: a round skin, strongest at its rim so it holds on a pale page, with a shine
  const bubble = canvasTexture([64, 64], (g, s) => {
    const skin = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2 - 2);

    skin.addColorStop(0, 'rgba(255,255,255,0.42)');
    skin.addColorStop(0.72, 'rgba(255,255,255,0.62)');
    skin.addColorStop(0.9, 'rgba(255,255,255,1)');
    skin.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = skin;
    g.fillRect(0, 0, s, s);
  });
  const casting = [[0, 0.75], [1.3, 0.75], [SPELL, 1], [5.4, 1], [6.6, 0.75], [L, 0.75]];
  const effects = [
    far.update,
    sparkles(fx, { loop, actors, each: 5, colors: [0xffffff, 0xfff0b8, 0xe6d9ff] }),
    landings(fx, { actors: actors.filter(({ peak }) => peak !== 2.35), color: 0xeeeaff }),
    // bubbles of every color out of the cauldron, and sparks among them
    rising(fx, { loop, at: { x: CAULDRON.x, y: 0.66, z: CAULDRON.z }, radius: 0.34, height: 1.35, count: 13, color: [0xff4f9a, 0x10bfa0, 0xf2a000, 0x6a63ff], size: [0.1, 0.2], seed: 7, texture: bubble, sway: 0.07, depth: 0.6, spin: false }),
    rising(fx, { loop, at: { x: CAULDRON.x, y: 0.7, z: CAULDRON.z }, radius: 0.3, height: 1.2, count: 8, color: [0xffffff, 0xd8fff2], size: [0.05, 0.1], seed: 3, texture: TEXTURES.star }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.55,
    camera: { y: 2.3, dist: 14.1, lookY: 1.14 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - SPELL;
      // how lit the Seed is: a little while it floats, fully from the spell until it lets go
      const lit01 = Math.max(0, Math.min(1, since / 0.3)) * Math.max(0, Math.min(1, (6.4 - t) / 0.9));
      const sy = SEED.y + Math.sin(w * 2) * 0.05;

      // Zara's arms come forward and a little apart, low, hands open
      const lift = curve(casting, t, 0.05);

      rigs.zara.rot('LeftArm', X, lift * -1.1);
      rigs.zara.rot('LeftArm', Z, lift * 0.3);
      rigs.zara.rot('RightArm', X, lift * -1.1);
      rigs.zara.rot('RightArm', Z, -lift * 0.3);

      seed.position.set(SEED.x, sy, SEED.z);
      seed.rotation.y = w * 2;
      seed.scale.setScalar(0.46 * (1 - lit01 * 0.999));
      seed.visible = lit01 < 0.98;
      golden.position.copy(seed.position);
      golden.rotation.y = w * 2;
      golden.scale.setScalar(0.46 * Math.max(0.001, lit01) * (1 + Math.sin(Math.min(1, Math.max(0, since) / 0.5) * Math.PI) * 0.25));
      golden.visible = lit01 > 0.02;

      for (const { hinge, side } of leaves) {
        hinge.position.set(SEED.x, sy + 0.25, SEED.z);
        hinge.rotation.set(0, w * 2, side * (0.5 - lit01 * 0.35 + Math.sin(w * 4) * 0.05));
        hinge.scale.setScalar(Math.max(0.001, lit01 * (1 + Math.sin(Math.min(1, Math.max(0, since - 0.15) / 0.5) * Math.PI) * 0.3)));
      }

      seedGlow.position.set(SEED.x, sy, SEED.z - 0.06);
      seedGlow.scale.setScalar(0.9 + lit01 * 0.7);
      seedGlow.material.opacity = 0.35 + lit01 * 0.35;
      seedRays.position.copy(seedGlow.position);
      seedRays.scale.setScalar(0.4 + lit01 * 1.3);
      seedRays.material.opacity = 0.2 + lit01 * 0.6;
      seedRays.material.rotation = w;
      seedLight.intensity = 2 + lit01 * 6;

      const ring = since / 0.8;

      seedRing.visible = ring > 0 && ring < 1;
      seedRing.position.set(SEED.x, sy, SEED.z);
      seedRing.scale.setScalar(0.4 + ring * 1.5);
      seedRing.material.opacity = 0.9 * (1 - ring);

      for (const { one, a, reach, size, delay } of burst) {
        const u = (since - delay) / 1.4;

        one.visible = u > 0 && u < 1;
        one.position.set(SEED.x + Math.cos(a) * (0.2 + u * reach), sy + Math.sin(a) * (0.2 + u * reach) * 0.85, SEED.z + 0.1);
        one.scale.setScalar(size * (0.5 + Math.sin(u * Math.PI)));
        one.material.opacity = Math.sin(u * Math.PI);
        one.material.rotation = a + u * 2;
      }

      // the thread: stars that leave the hand one after another and curve up to the Seed
      for (const { one, lag, size } of thread) {
        const u = (t / 1.0 + lag) % 1;
        const bend = Math.sin(u * Math.PI);

        one.position.set(hand[0] + (SEED.x - hand[0]) * u, hand[1] + (sy - 0.2 - hand[1]) * u + bend * 0.14, hand[2] + (SEED.z - hand[2]) * u + 0.05);
        one.scale.setScalar(size * (0.5 + bend * 0.8));
        one.material.opacity = bend * (0.45 + lit01 * 0.4);
        one.material.rotation = u * 3 + lag * 6;
      }

      for (const { group, flame, core, glow, x, y, z, phase } of candles) {
        const flicker = 1 + Math.sin(w * 9 + phase * 3) * 0.12 + Math.sin(w * 5 + phase) * 0.08;

        group.position.set(x + Math.sin(w + phase) * 0.05, y + Math.sin(w * 2 + phase) * 0.07, z);
        flame.scale.set(0.085 * flicker, 0.16 * flicker, 1);
        core.scale.set(0.04, 0.075 * flicker, 1);
        glow.material.opacity = 0.4 + 0.12 * flicker;
      }

      for (const { group, page, x, y, z, phase } of books) {
        // one page goes over from the right half to the left once a loop, then lies there
        const turn = Math.max(0, Math.min(1, ((((t + phase) % loop) + loop) % loop) / 1.6));

        group.position.set(x, y + Math.sin(w * 2 + phase) * 0.06, z);
        group.rotation.z = Math.sin(w + phase) * 0.08;
        page.rotation.z = 0.2 + turn * turn * (3 - 2 * turn) * (Math.PI - 0.4);
      }

      bird.head.rotation.set(Math.sin(w * 2) * 0.06, Math.sin(w) * 0.5 + 0.35, Math.sin(w * 2 + 1) * 0.08);
      pot.glow.material.opacity = 0.45 + Math.sin(w * 5) * 0.08;
      arches.forEach(({ glow }, i) => { glow.material.opacity = 0.34 + Math.sin(w * 2 + i * 2) * 0.05; });

      for (const effect of effects) effect(t);
    },
  };
}
