// Home composition "treasure": the four mentors on a treasure island, the moment the old chest they followed a map
// to swings open and its light bursts out. It is full of Seeds, never coins.
//
// The setting is an island in the plain sense: a round bank of sand with a ring of turquoise water around it, and the
// water is a disc that fades to nothing before the frame's borders. The chest stands on a low dune at the back, in
// the gap between the two pairs of mentors; the round map that led to it leans on the sand in front of that gap, the
// shovel lies on the sand it dug beside the map, and a crab scuttles on the map's other side, where Dina watches it.
// A palm leans out on the left, clear of everybody. Dina, the large one, has the right side to herself: the only
// thing there is a small sailing boat, out on the water with air between it and her. Seagulls turn overhead.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const SAND = { radius: 2.95, z: -0.4 };
const WATER = { rx: 3.7, rz: 4.3, z: -0.9, y: -0.07 };
const CHEST = { x: 0.2, z: -1.7, y: 0.3 };
const MAP = { x: 0.14, z: 2.0 };
const DIG = { x: -0.9, z: 2.05 };
const PALM = { x: -2.6, z: -0.8 };
const BOAT = { x: 3.24, z: -0.5 };
const CRAB = { x: 1.38, z: 2.2 };
const OPENS = 1.8; // the second the lid swings open

const SAND_COLOR = 0xf2d9a0;
const WET_SAND = 0xd9b678;

// ---- the island: a bank of sand, darker and wet where it slopes into the water
function sand() {
  const group = new THREE.Group();
  const next = sequence(57);
  const R = SAND.radius - 0.22;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const dry = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    dry.addColorStop(0, '#f7e2b0');
    dry.addColorStop(0.8, '#f2d9a0');
    dry.addColorStop(1, '#d9b678');
    g.fillStyle = dry;
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 40 + next() * 120;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,244,210,0.5)' : 'rgba(214,176,112,0.32)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // grains
    for (let i = 0; i < 260; i++) {
      g.fillStyle = i % 3 ? 'rgba(190,150,90,0.35)' : 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(next() * w, next() * w, 2 + next() * 4, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(WET_SAND, 0.9), standard(0xffffff, 0.95, { map: picture }), standard(WET_SAND, 0.9)], 0, -0.05, 0);

  top.castShadow = false;
  group.add(top, lathe([[R - 0.01, 0], [R + 0.1, -0.025], [R + 0.19, -0.08], [R + 0.26, -0.2], [R + 0.26, -0.3]], standard(WET_SAND, 0.75)));

  return group;
}

// ---- the water: a disc of turquoise, pale over the shallows, that fades to nothing; foam where it meets the sand.
// It reaches farther behind the island than in front of it, so there is sea for the boat.
function water() {
  const group = new THREE.Group();
  const sea = decal(canvasTexture([1024, 1024], (g, w) => {
    const half = w / 2;
    const deep = g.createRadialGradient(half, half, 0, half, half, half);

    deep.addColorStop(0, 'rgba(60,206,206,1)');
    deep.addColorStop(0.7, 'rgba(38,186,204,1)');
    deep.addColorStop(0.93, 'rgba(38,184,205,0.96)');
    deep.addColorStop(0.97, 'rgba(38,180,206,0.5)');
    deep.addColorStop(1, 'rgba(38,180,206,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // the shallows around the sand: the same round shape as the island, on this picture's own scale
    g.save();
    g.translate(half, half + ((SAND.z - WATER.z) / WATER.rz) * half);
    g.scale(half / WATER.rx, half / WATER.rz);

    const shallow = g.createRadialGradient(0, 0, SAND.radius, 0, 0, SAND.radius + 0.55);

    shallow.addColorStop(0, 'rgba(156,242,228,1)');
    shallow.addColorStop(0.35, 'rgba(120,232,220,0.8)');
    shallow.addColorStop(1, 'rgba(90,220,212,0)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = shallow;
    g.beginPath();
    g.arc(0, 0, SAND.radius + 0.55, 0, TAU);
    g.fill();
    g.restore();
  }), 0, WATER.y, WATER.z - SAND.z, WATER.rx, WATER.rz, 0);
  const ring = (at, width, alpha) => radial([[0, 'rgba(255,255,255,0)'], [at - width, 'rgba(255,255,255,0)'], [at, `rgba(255,255,255,${alpha})`], [at + width, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']], 1024);
  const foam = [decal(ring(0.86, 0.035, 0.95), 0, WATER.y + 0.006, 0, 1, 1, 1), decal(ring(0.86, 0.02, 0.6), 0, WATER.y + 0.004, 0, 1, 1, 1)];

  group.add(sea, ...foam);

  return { group, foam };
}

/** A palm leaf: thick and soft, round at both ends, `length` long and `width` wide, drooping by `droop` at its tip. It grows along +x. */
function frond(length, width, droop, material) {
  const geometry = new THREE.SphereGeometry(0.5, 28, 16);
  const at = geometry.attributes.position;

  for (let i = 0; i < at.count; i++) {
    const along = at.getX(i) + 0.5;
    const across = at.getZ(i) * 2;

    // a long round cushion, a little hollow along its middle, bent down toward the tip
    at.setXYZ(i, along * length, at.getY(i) * 0.14 - droop * along * along + across * across * 0.05, at.getZ(i) * width);
  }

  geometry.computeVertexNormals();

  const leaf = new THREE.Mesh(geometry, material);

  leaf.castShadow = true;
  leaf.receiveShadow = true;

  return leaf;
}

const GREENS = [0x3fb565, 0x2f9e58, 0x5cc977, 0x36a85c].map((color) => standard(color, 0.8, { side: THREE.DoubleSide }));

// ---- the palm: a leaning trunk ringed like a real one, a crown of thick round leaves, three round nuts
function palm(height, lean, seed) {
  const group = new THREE.Group();
  const next = sequence(seed);
  const trunk = [[0, 0, 0], [lean * 0.12, height * 0.35, 0], [lean * 0.5, height * 0.7, 0.05], [lean, height, 0.1]];
  const crown = new THREE.Group();

  group.add(tube(trunk, 0.13, standard(0x9a6a3e, 0.9), 40), sphere(0.42, standard(SAND_COLOR, 0.95), 0, 0, 0, 0.4));

  const path = new THREE.CatmullRomCurve3(trunk.map((p) => new THREE.Vector3(...p)));

  for (let i = 1; i < 9; i++) {
    const p = path.getPoint(i / 9);
    const ring = mesh(new THREE.TorusGeometry(0.135, 0.026, 10, 32), standard(0x7c5230, 0.9), p.x, p.y, p.z);

    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = -path.getTangent(i / 9).x * 0.9;
    group.add(ring);
  }

  crown.position.set(lean, height, 0.1);

  for (let i = 0; i < 9; i++) {
    const leaf = frond(0.84 + next() * 0.14, 0.34, 0.45 + next() * 0.2, GREENS[i % GREENS.length]);
    const stem = new THREE.Group();

    stem.rotation.y = (i / 9) * TAU + next() * 0.3;
    leaf.rotation.z = 0.42 + next() * 0.25;
    stem.add(leaf);
    crown.add(stem);
  }

  for (let i = 0; i < 3; i++) crown.add(sphere(0.1, standard(0x6e4a2a, 0.8), Math.sin(i * 2.1) * 0.13, -0.1, Math.cos(i * 2.1) * 0.13));

  group.add(crown);

  return { group, crown };
}

// ---- the chest: a rounded wooden body with golden bands, a barrel lid on a hinge, and a heap of Seeds that glows
function chest() {
  const group = new THREE.Group();
  const W = 0.98;
  const H = 0.5;
  const D = 0.68;
  const wood = standard(0x9c5b2e, 0.7);
  const woodDark = standard(0x7a4320, 0.75);
  const gold = standard(0xf2bf2a, 0.28, { metalness: 0.7 });
  const lining = new THREE.MeshBasicMaterial({ color: 0xc02a48, side: THREE.DoubleSide, toneMapped: false });
  const next = sequence(19);

  group.add(box(W, H, D, wood, 0, H / 2 + 0.03, 0, 0.11), box(W - 0.12, 0.06, D - 0.12, woodDark, 0, H + 0.015, 0, 0.03));

  for (const x of [-0.3, 0.3]) group.add(box(0.1, H + 0.03, D + 0.035, gold, x, H / 2 + 0.03, 0, 0.05));

  for (const x of [-0.38, 0.38]) for (const z of [-0.24, 0.24]) group.add(sphere(0.08, woodDark, x, 0.05, z, 0.8));

  group.add(box(0.2, 0.24, 0.06, gold, 0, H * 0.72, D / 2 + 0.012, 0.03), sphere(0.035, standard(C.ink, 0.5), 0, H * 0.68, D / 2 + 0.04));

  // the lid turns on its back edge: a deep rounded cover, red inside
  const lid = new THREE.Group();
  const round = new THREE.Shape();

  for (const [k, sx, sy] of [[0, 1, -1], [1, 1, 1], [2, -1, 1], [3, -1, -1]]) round.absarc(sx * ((W - 0.2) / 2 - 0.12), sy * ((D - 0.2) / 2 - 0.12), 0.12, (k - 1) * Math.PI / 2, k * Math.PI / 2);

  const inside = new THREE.Mesh(new THREE.ShapeGeometry(round, 12), lining);

  inside.rotation.x = Math.PI / 2;
  inside.position.set(0, -0.012, D / 2);
  lid.add(box(W, 0.34, D, wood, 0, 0.16, D / 2, 0.16), inside);

  for (const x of [-0.3, 0.3]) lid.add(box(0.1, 0.37, D + 0.035, gold, x, 0.16, D / 2, 0.05));

  lid.position.set(0, H + 0.05, -D / 2);
  group.add(lid);

  // the heap: a glowing heart with Seeds all over it, three large ones standing on top
  const heap = new THREE.Group();
  const heart = sphere(0.5, lit(0xffcf5a, 1.3), 0, 0, 0, 0.44);

  heart.scale.set(0.82, 0.44, 0.54);
  heart.castShadow = false;
  heap.add(heart);

  for (let i = 0; i < 30; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(next()) * 0.95;
    const seed = seedMesh(0.26 + next() * 0.08);

    seed.position.set(Math.cos(a) * r * 0.38, 0.2 * Math.sqrt(1 - r * r * 0.85) + 0.02, Math.sin(a) * r * 0.24);
    seed.rotation.set((next() - 0.5) * 1.5, next() * TAU, (next() - 0.5) * 1.7);
    seed.material.emissive.set(0x6a4a10);
    seed.material.emissiveIntensity = 0.55;
    heap.add(seed);
  }

  for (const [x, y, z, tilt, size] of [[-0.14, 0.38, 0.04, 0.3, 0.4], [0.16, 0.36, 0.0, -0.35, 0.38], [0.0, 0.42, -0.06, 0.02, 0.46]]) {
    const seed = seedMesh(size);

    seed.position.set(x, y, z);
    seed.rotation.set(0.1, 0.4 + x * 3, tilt);
    seed.material.emissive.set(0x6a4a10);
    seed.material.emissiveIntensity = 0.55;
    heap.add(seed);
  }

  heap.position.set(0, H + 0.02, 0);
  group.add(heap);

  return { group, lid, heap, top: H + 0.3, rim: H + 0.02 };
}

// ---- the map: a round piece of parchment with an island, a dotted path and a cross where the chest was
function map() {
  const group = new THREE.Group();
  const R = 0.4;
  const picture = canvasTexture([768, 768], (g, w) => {
    const half = w / 2;
    const paper = g.createRadialGradient(half, half, 0, half, half, half);

    paper.addColorStop(0, '#fbeccb');
    paper.addColorStop(0.8, '#f3dcab');
    paper.addColorStop(1, '#dcb877');
    g.fillStyle = paper;
    g.fillRect(0, 0, w, w);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // the sea: short round waves
    g.strokeStyle = 'rgba(52,170,196,0.75)';
    g.lineWidth = 9;

    for (const [x, y] of [[0.2, 0.3], [0.3, 0.74], [0.78, 0.28], [0.8, 0.72], [0.5, 0.86], [0.16, 0.54]]) {
      g.beginPath();
      g.arc(w * x - 20, w * y, 20, Math.PI, TAU);
      g.arc(w * x + 20, w * y, 20, Math.PI, TAU);
      g.stroke();
    }

    // the island: a soft blob of green with a sandy shore
    g.save();
    g.translate(w * 0.54, w * 0.5);
    g.rotate(-0.3);
    g.scale(1, 0.72);
    g.fillStyle = '#e9c27c';
    g.beginPath();
    g.arc(0, 0, w * 0.27, 0, TAU);
    g.fill();
    g.fillStyle = '#7fcf8a';
    g.beginPath();
    g.arc(0, 0, w * 0.21, 0, TAU);
    g.fill();
    g.restore();

    // the path: round dots from the shore to the cross
    const path = [[0.2, 0.42], [0.27, 0.36], [0.35, 0.34], [0.43, 0.37], [0.48, 0.44], [0.5, 0.52], [0.55, 0.58]];

    g.fillStyle = '#4438cf';

    for (const [x, y] of path) { g.beginPath(); g.arc(w * x, w * y, 12, 0, TAU); g.fill(); }

    g.strokeStyle = '#db1b2b';
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(w * 0.6, w * 0.58);
    g.lineTo(w * 0.72, w * 0.7);
    g.moveTo(w * 0.72, w * 0.58);
    g.lineTo(w * 0.6, w * 0.7);
    g.stroke();

    // a small palm, and the worn rim of the parchment
    g.strokeStyle = '#8a5a36';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(w * 0.6, w * 0.44);
    g.quadraticCurveTo(w * 0.61, w * 0.36, w * 0.64, w * 0.31);
    g.stroke();
    g.fillStyle = '#2f9e58';

    for (const [x, y] of [[0.6, 0.3], [0.68, 0.3], [0.64, 0.26]]) { g.beginPath(); g.ellipse(w * x, w * y, 30, 18, 0, 0, TAU); g.fill(); }

    g.strokeStyle = 'rgba(138,90,54,0.55)';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(half, half, half - 22, 0, TAU);
    g.stroke();
  });
  const paper = standard(0xe6c98f, 0.9);
  const sheet = mesh(new THREE.CylinderGeometry(R, R, 0.024, 64), [paper, standard(0xffffff, 0.85, { map: picture }), paper]);
  const edge = mesh(new THREE.TorusGeometry(R, 0.016, 10, 64), paper);
  const leaning = new THREE.Group();

  edge.rotation.x = Math.PI / 2;
  // the drawing reads upright from the front
  sheet.rotation.y = -Math.PI / 2;
  leaning.add(sheet, edge);
  leaning.rotation.x = 0.76;
  leaning.position.set(0, R * Math.sin(0.76) + 0.04, 0);

  // it leans on a hump of sand, and two round stones keep it from sliding
  const hump = sphere(0.42, standard(SAND_COLOR, 0.95), 0, 0, -0.3, 0.62);

  hump.scale.x = 1.1;
  group.add(leaning, hump, sphere(0.07, standard(C.stone, 0.9), -0.2, 0.04, 0.34, 0.75), sphere(0.06, standard(0xa9adc6, 0.9), 0.22, 0.035, 0.34, 0.75));

  return group;
}

// ---- the shovel, laid down on the sand it dug
function shovel() {
  const group = new THREE.Group();
  const tool = new THREE.Group();
  const wood = standard(C.wood, 0.7);
  const steel = standard(0xc9cee6, 0.3, { metalness: 0.6 });
  const grip = mesh(new THREE.TorusGeometry(0.085, 0.028, 12, 32), standard(C.red, 0.5), 0, 0.7, 0);
  const scoop = sphere(0.19, steel, 0, 0.1, 0);

  scoop.scale.set(0.9, 1.1, 0.2);
  tool.add(cylinder(0.032, 0.032, 0.4, wood, 0, 0.44, 0, 20), grip, scoop, sphere(0.045, steel, 0, 0.3, 0, 1.4));
  // on its side, the grip toward the reader's left
  tool.position.set(0.36, 0.12, 0.1);
  tool.rotation.z = Math.PI / 2 - 0.08;
  group.add(sphere(0.36, standard(SAND_COLOR, 0.95), 0.24, 0, -0.1, 0.36), sphere(0.2, standard(0xe8cc90, 0.95), -0.05, 0, 0.12, 0.4), tool);

  return group;
}

// ---- the boat: a small round hull with two round-cornered sails
function boat() {
  const group = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, Math.PI / 2, Math.PI / 2), standard(C.indigo, 0.5, { side: THREE.DoubleSide }));
  const deck = mesh(new THREE.CircleGeometry(1, 40), standard(C.woodPale, 0.6));
  const rail = mesh(new THREE.TorusGeometry(1, 0.1, 10, 48), standard(C.cream, 0.6));
  const sail = (width, height, color) => {
    const shape = new THREE.Shape();

    // a quarter of a round shape with every corner rounded off
    shape.moveTo(0.06, 0);
    shape.lineTo(width - 0.1, 0);
    shape.quadraticCurveTo(width, 0, width - 0.04, 0.1);
    shape.quadraticCurveTo(width * 0.5, height * 0.72, 0.1, height - 0.06);
    shape.quadraticCurveTo(0, height, 0, height - 0.1);
    shape.lineTo(0, 0.06);
    shape.quadraticCurveTo(0, 0, 0.06, 0);

    return new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), standard(color, 0.7, { side: THREE.DoubleSide }));
  };
  const main = sail(0.4, 0.78, 0xfff1dc);
  const jib = sail(0.28, 0.6, C.orange);

  hull.scale.set(0.36, 0.2, 0.2);
  deck.rotation.x = -Math.PI / 2;
  deck.scale.set(0.36, 0.2, 1);
  rail.rotation.x = Math.PI / 2;
  rail.scale.set(0.36, 0.2, 0.35);
  main.position.set(0.03, 0.1, 0);
  jib.position.set(-0.03, 0.1, 0);
  jib.scale.x = -1;
  main.castShadow = true;
  jib.castShadow = true;
  group.add(hull, deck, rail, cylinder(0.014, 0.014, 0.95, standard(C.wood, 0.7), 0, 0.46, 0, 8), sphere(0.03, standard(C.gold, 0.4, { metalness: 0.5 }), 0, 0.95, 0), main, jib);
  group.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });

  return group;
}

// ---- the crab: round, with eyes on stalks and two claws it waves
function crab() {
  const group = new THREE.Group();
  const shell = standard(0xf0552e, 0.5);
  const body = sphere(0.17, shell, 0, 0.14, 0);
  const claws = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    const claw = sphere(0.075, shell, 0, 0.1, 0.02);

    claw.scale.set(0.85, 1.15, 0.7);
    arm.add(claw, sphere(0.035, shell, 0, 0.02, 0));
    arm.position.set(side * 0.24, 0.16, 0.08);
    group.add(arm);

    return { arm, side };
  });

  body.scale.set(1.3, 0.62, 0.95);
  group.add(body);

  for (const side of [-1, 1]) {
    group.add(cylinder(0.014, 0.014, 0.1, shell, side * 0.07, 0.27, 0.09, 10), sphere(0.042, standard(0xffffff, 0.4), side * 0.07, 0.33, 0.09), sphere(0.02, standard(C.ink, 0.4), side * 0.07, 0.335, 0.125));

    for (let i = 0; i < 3; i++) {
      const leg = sphere(0.04, shell, side * (0.2 + i * 0.012), 0.05, -0.09 + i * 0.075);

      leg.scale.set(1.5, 0.75, 0.6);
      leg.rotation.z = -side * 0.7;
      group.add(leg);
    }
  }

  group.scale.setScalar(0.6);

  return { group, claws };
}

// ---- a seagull: a round white body, grey wings with dark tips, an orange beak. It flies along +x.
function gull() {
  const group = new THREE.Group();
  const white = standard(0xe4e8fb, 0.6);
  const grey = standard(0x8793c4, 0.6);
  const body = sphere(0.12, white, 0, 0, 0);
  const beak = sphere(0.032, standard(C.orange, 0.5), 0.29, 0.035, 0);
  const tail = sphere(0.07, grey, -0.2, 0.0, 0);
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const wing = sphere(0.2, grey, 0, 0, side * 0.2);
    const tip = sphere(0.085, standard(0x5a6396, 0.6), -0.02, 0, side * 0.37);

    wing.scale.set(0.55, 0.1, 1);
    tip.scale.set(0.8, 0.12, 0.9);
    hinge.add(wing, tip);
    hinge.position.set(0, 0.04, side * 0.05);
    group.add(hinge);

    return { hinge, side };
  });

  body.scale.set(1.65, 0.8, 0.8);
  beak.scale.set(1.7, 0.7, 0.7);
  tail.scale.set(1.3, 0.25, 0.8);
  group.add(body, sphere(0.075, white, 0.18, 0.05, 0), beak, tail, sphere(0.014, standard(C.ink, 0.4), 0.215, 0.07, 0.06), sphere(0.014, standard(C.ink, 0.4), 0.215, 0.07, -0.06));
  group.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });

  return { group, wings };
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

export function build(scene, { loop, heights, jump, tuck, curve, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const sea = water();
  const hoard = chest();
  const tree = palm(2.4, -0.1, 3);
  const dinghy = boat();
  const pincher = crab();

  set.add(place(sand(), 0, SAND.z), place(sea.group, 0, SAND.z), shadowCatcher(SAND.radius - 0.24, 0.008, SAND.z, 0.3));

  // the island's own soft shadow on the page, under the water's fading edge
  set.add(decal(radial([[0, 'rgba(30,70,150,0.3)'], [0.7, 'rgba(30,70,150,0.2)'], [0.9, 'rgba(30,70,150,0.06)'], [1, 'rgba(30,70,150,0)']]), 0, -0.5, WATER.z + 0.3, 4.0, 4.3, -1));

  // the dune the chest stands on
  const dune = sphere(1.05, standard(SAND_COLOR, 0.95), CHEST.x, 0, CHEST.z - 0.05, 0.34);

  dune.scale.z = 0.72;
  set.add(dune, place(hoard.group, CHEST.x, CHEST.z, 0, CHEST.y), place(map(), MAP.x, MAP.z), place(shovel(), DIG.x, DIG.z), place(tree.group, PALM.x, PALM.z));
  set.add(place(dinghy, BOAT.x, BOAT.z, 0.6, WATER.y + 0.1), decal(radial([[0, 'rgba(14,110,140,0.55)'], [1, 'rgba(14,110,140,0)']]), BOAT.x, WATER.y + 0.008, BOAT.z, 0.5, 0.3, 1));
  set.add(place(pincher.group, CRAB.x, CRAB.z, 0.1));

  // Seeds that fell out when the chest was dragged up, and a few round shells
  const next = sequence(77);

  for (const [x, z] of [[-1.9, 1.4], [0.7, 2.3]]) {
    const seed = seedMesh(0.27);

    seed.position.set(x, 0.09, z);
    seed.rotation.set(1.05, (next() - 0.5) * 0.8, (next() - 0.5) * 1.2);
    set.add(seed);
  }

  for (const [x, z, r, color] of [[-2.3, 1.05, 0.08, 0xffb3c8], [1.95, 1.75, 0.07, 0xffd9a0]]) {
    set.add(sphere(r, standard(color, 0.45), x, r * 0.4, z, 0.6));
  }

  // ---- the light out of the chest: a warm lamp, a halo, turning rays and a fan of beams
  const glowAt = new THREE.Vector3(CHEST.x, CHEST.y + hoard.top, CHEST.z);
  const lamp = new THREE.PointLight(0xffc860, 4, 6, 1.6);
  const glow = halo(1.15, 0xffc23a, 0.6);
  const rays = sprite(TEXTURES.star, 0xffd866, 5);
  const beamPicture = canvasTexture([64, 256], (g, w, h) => {
    const across = g.createLinearGradient(0, 0, w, 0);
    const along = g.createLinearGradient(0, 0, 0, h);

    across.addColorStop(0, 'rgba(255,196,48,0)');
    across.addColorStop(0.5, 'rgba(255,206,72,1)');
    across.addColorStop(1, 'rgba(255,196,48,0)');
    g.fillStyle = across;
    g.fillRect(0, 0, w, h);
    along.addColorStop(0, 'rgba(0,0,0,0)');
    along.addColorStop(0.75, 'rgba(0,0,0,0.85)');
    along.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = along;
    g.fillRect(0, 0, w, h);
  });
  const fan = new THREE.Group();
  const beams = [[-1.05, 1.5, 0.5], [-0.66, 2.15, 0.62], [-0.3, 1.75, 0.5], [0.04, 2.35, 0.7], [0.36, 1.8, 0.5], [0.7, 2.1, 0.6], [1.08, 1.45, 0.5]].map(([angle, length, width], i) => {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(width, length).translate(0, length / 2, 0), new THREE.MeshBasicMaterial({ map: beamPicture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.6 }));

    beam.rotation.z = -angle;
    beam.renderOrder = 4;
    fan.add(beam);

    return { beam, angle, phase: i * 1.7 };
  });

  lamp.position.set(CHEST.x, CHEST.y + 1.25, CHEST.z + 0.35);
  glow.position.copy(glowAt);
  rays.position.copy(glowAt);
  fan.position.set(glowAt.x, glowAt.y - 0.1, glowAt.z - 0.12);
  set.add(lamp);
  fx.add(fan, glow, rays);

  // Seeds thrown up by the burst: each rises, turns and drops back into the chest
  const thrown = [[-0.3, -0.42, 1.7, 0], [0.24, 0.38, 2.0, 0.07], [-0.08, -0.16, 2.35, 0.13], [0.34, 0.6, 1.45, 0.2], [-0.36, -0.66, 1.3, 0.26], [0.06, 0.14, 1.85, 0.33]].map(([from, to, height, delay], i) => {
    const seed = seedMesh(0.3);

    seed.castShadow = false;
    seed.material.emissive.set(0x6a4a10);
    seed.material.emissiveIntensity = 0.7;
    fx.add(seed);

    return { seed, from, to, height, delay, spin: 2 + (i % 3) };
  });

  // seagulls, each on its own closed path
  const flock = [[2.5, 3.1, -1.6, 0.75, 0.14, 0.5, 0], [0.4, 3.55, -2.6, 0.8, 0.1, 0.5, 2.4]].map(([x, y, z, rx, ry, rz, phase]) => {
    const bird = gull();

    fx.add(bird.group);

    return { ...bird, x, y, z, rx, ry, rz, phase };
  });

  // glints on the water
  const glints = [[-3.3, 0.5], [-0.9, 3.0], [1.1, 3.05], [2.6, 2.2], [3.2, -1.7], [-2.4, -2.9], [0.2, 3.3], [-2.5, 2.2], [-3.3, -1.4]].map(([x, z], i) => {
    const glint = sprite(TEXTURES.star, 0xffffff, 3);

    glint.position.set(x, WATER.y + 0.05, SAND.z + z);
    fx.add(glint);

    return { glint, phase: i * 2.3, speed: 2 + (i % 2) };
  });

  const cast = {
    // Liruf cannot take his eyes off the chest, and jumps the highest when it opens
    liruf: { x: -1.79, z: 0.05, yaw: 0.38, act: {
      hop: jump(2.0, 0.3), tuck: tuck(2.0, 0.9), yaw: [[0, 0.5], [3.4, 0.5], [4.6, -0.1], [6.2, -0.1], [7.2, 0.5], [L, 0.5]],
      pitch: [[0, -0.02], [2.0, -0.3], [2.7, -0.06], [L, -0.02]], lean: [[0, 0.12], [1.5, 0.16], [2.0, -0.12], [2.6, 0.08], [3.4, 0.12], [L, 0.12]],
      roll: [[0, 0.12], [2.0, -0.1], [4.6, 0.14], [L, 0.12]], tilt: [[0, 0.06], [2.0, -0.08], [2.8, 0.06], [L, 0.06]],
    } },
    // Zara turns to the chest and points it out with one arm, bouncing on her toes
    zara: { x: -0.88, z: 0.5, yaw: 0.12, act: {
      hop: [[0, 0], [1.75, 0], [1.95, -0.03], [2.2, 0.13], [2.5, 0], [2.85, 0.09], [3.15, 0], [L, 0]], tuck: [[0, 0], [1.95, 0], [2.2, 0.3], [2.5, 0], [L, 0]],
      turn: [[0, 0], [1.2, 0], [2.0, 0.42], [4.4, 0.42], [5.4, 0], [L, 0]], yaw: [[0, 0.1], [1.2, 0.1], [1.9, 0.5], [2.9, 0.5], [3.6, -0.3], [4.6, -0.3], [5.4, 0.1], [L, 0.1]],
      lean: [[0, 0], [2.2, -0.1], [3, 0], [L, 0]], roll: [[0, 0.06], [2.2, -0.1], [3.6, 0.12], [5.4, 0.06], [L, 0.06]], pitch: [[0, -0.06], [2.2, -0.2], [3.2, -0.06], [L, -0.06]],
    } },
    // Rho is still reading the map at his feet when the light makes him jump
    rho: { x: 1.0, z: 0.55, yaw: -0.14, act: {
      hop: jump(2.25, 0.18), tuck: tuck(2.25, 0.7), turn: [[0, 0], [1.9, 0], [2.4, -0.32], [4.8, -0.32], [5.8, 0], [L, 0]],
      yaw: [[0, -0.3], [1.7, -0.3], [2.25, -0.2], [4.8, -0.2], [5.8, -0.3], [L, -0.3]], pitch: [[0, 0.3], [1.6, 0.3], [2.25, -0.3], [2.75, 0.06], [4.8, -0.1], [5.9, 0.3], [L, 0.3]],
      lean: [[0, 0.1], [1.6, 0.1], [2.25, -0.18], [2.8, 0.04], [4.8, -0.02], [5.9, 0.1], [L, 0.1]], roll: [[0, -0.08], [2.25, 0.1], [4.4, -0.1], [L, -0.08]], tilt: [[0, 0], [2.25, 0.07], [3, 0], [L, 0]],
    } },
    // Dina has her nose on the crab, and rears up when the chest flashes behind her
    dina: { x: 2.12, z: 0.0, yaw: -0.5, act: {
      hop: jump(2.45, 0.12), rear: [[0, 0], [2.0, 0], [2.45, 1], [3.1, 0], [L, 0]],
      yaw: [[0, 0.15], [1.9, 0.15], [2.45, -0.3], [4.2, -0.35], [5.4, 0.15], [L, 0.15]], pitch: [[0, 0.38], [1.9, 0.38], [2.45, -0.4], [3.3, -0.16], [4.4, -0.12], [5.5, 0.38], [L, 0.38]],
      roll: [[0, 0.22], [1.9, 0.22], [2.45, -0.1], [5.5, 0.22], [L, 0.22]],
    } },
  };
  const peaks = { liruf: 2.0, zara: 2.2, rho: 2.25, dina: 2.45 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, name, height: heights[name], peak: peaks[name] }));
  const point = [[0, 0], [1.3, 0], [1.9, 1], [4.3, 1], [5.1, 0], [L, 0]];
  const effects = [
    sparkles(fx, { loop, actors: actors.filter(({ name }) => name === 'liruf' || name === 'zara'), each: 6, colors: [0xffffff, 0xfff0b8, 0xffe08a] }),
    twinkles(fx, loop, [[cast.rho.x - 0.1, 1.95, 0.6, 0.16], [cast.rho.x - 0.6, 1.3, 0.6, 0.14]], peaks.rho),
    twinkles(fx, loop, [[cast.dina.x + 0.6, 2.15, 0.3, 0.19], [cast.dina.x - 0.25, 2.3, 0.3, 0.15], [cast.dina.x + 1.05, 1.75, 0.3, 0.16]], peaks.dina),
    landings(fx, { actors: actors.filter(({ peak }) => peak !== peaks.zara), color: 0xfff1cc }),
    // golden stars rise out of the chest all the time, thicker in its light
    rising(fx, { loop, at: { x: CHEST.x, y: CHEST.y + 0.75, z: CHEST.z + 0.1 }, radius: 0.5, height: 2.2, count: 22, color: [0xffe08a, 0xffffff, 0xffc23a], size: [0.05, 0.12], seed: 14, texture: TEXTURES.star, sway: 0.08, depth: 0.3 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.25,
    camera: { y: 2.3, dist: 14.5, lookY: 1.32 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const ease = (u) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };
      // the lid: ajar, flung open with a little bounce, held, and let down again before the loop ends
      const open = ease((t - OPENS + 0.3) / 0.35) * (1 - ease((t - 6.3) / 1.3));
      const bounce = t > OPENS && t < OPENS + 2 ? Math.sin((t - OPENS) * 11) * 0.12 * Math.exp(-(t - OPENS) * 2.4) : 0;
      const flash = Math.max(0, 1 - Math.abs(t - OPENS - 0.25) / 0.9);

      hoard.lid.rotation.x = -(0.55 + open * 1.37 + bounce);
      // the heap swells up out of the chest as the lid lets go of it
      hoard.heap.position.y = hoard.rim - (1 - open) * 0.42;
      lamp.intensity = 2 + open * 4 + flash * 3;
      glow.scale.setScalar(2.3 * (0.55 + open * 0.5 + flash * 0.25));
      glow.material.opacity = 0.3 + open * 0.25;
      rays.scale.setScalar(1.3 + open * 1.5 + flash * 0.6);
      rays.material.opacity = 0.35 + open * 0.5;
      rays.material.rotation = w;

      for (const { beam, phase } of beams) {
        beam.scale.set(1, 0.18 + open * (0.8 + Math.sin(w * 2 + phase) * 0.12) + flash * 0.12, 1);
        beam.material.opacity = (0.16 + open * 0.42) * (0.85 + 0.15 * Math.sin(w * 3 + phase));
      }

      fan.rotation.z = Math.sin(w) * 0.05;

      for (const { seed, from, to, height, delay, spin } of thrown) {
        const u = (t - OPENS - delay) / 1.55;

        seed.visible = u > 0 && u < 1;
        seed.position.set(glowAt.x + from + (to - from) * u, glowAt.y - 0.05 + 4 * height * u * (1 - u), glowAt.z + 0.12);
        seed.rotation.set(u * spin * 2, u * TAU * spin, 0.4);
      }

      // Zara's left arm, the one toward the chest, comes up and points at it
      const pointing = curve(point, t);

      rigs.zara.rot('LeftArm', Z, pointing * 1.5);
      rigs.zara.rot('LeftForeArm', Z, pointing * 0.3);
      rigs.zara.rot('RightArm', X, -pointing * 0.2);

      // the water breathes on the shore
      sea.foam.forEach((ring, i) => {
        const breath = Math.sin(w * 2 + i * 2.2);
        const size = (SAND.radius + 0.06 + i * 0.3 + breath * 0.045) / 0.86;

        ring.scale.set(size, size, 1);
        ring.material.opacity = i ? 0.35 + breath * 0.25 : 0.8 + breath * 0.15;
      });

      for (const { glint, phase, speed } of glints) {
        const twinkle = Math.max(0, Math.sin(w * speed + phase)) ** 3;

        glint.scale.setScalar(0.08 + twinkle * 0.2);
        glint.material.opacity = twinkle;
      }

      dinghy.position.y = WATER.y + 0.1 + Math.sin(w * 2) * 0.02;
      dinghy.rotation.z = Math.sin(w * 2 + 1) * 0.04;
      dinghy.rotation.x = Math.sin(w + 0.4) * 0.03;
      tree.crown.rotation.z = Math.sin(w) * 0.04;

      // the crab: a scuttle to the side and back, claws opening and closing in the air
      pincher.group.position.x = CRAB.x + Math.sin(w) * 0.04;
      pincher.group.position.y = Math.abs(Math.sin(w * 8)) * 0.015;

      for (const { arm, side } of pincher.claws) arm.rotation.z = -side * (0.25 + Math.max(0, Math.sin(w * 2 + side)) * 0.5);

      for (const { group, wings, x, y, z, rx, ry, rz, phase } of flock) {
        const a = w + phase;

        group.position.set(x + Math.sin(a) * rx, y + Math.sin(a * 2) * ry, z + Math.cos(a) * rz);
        group.rotation.set(0, Math.atan2(Math.sin(a) * rz, Math.cos(a) * rx), Math.cos(a * 2) * 0.12);

        for (const { hinge, side } of wings) hinge.rotation.x = -side * (0.1 + Math.sin(w * 6 + phase) * 0.55);
      }

      for (const effect of effects) effect(t);
    },
  };
}
