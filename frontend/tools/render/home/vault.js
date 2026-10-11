// Home composition "vault": the four mentors in front of the great vault where the Seeds are kept, the moment its
// light flares and Seeds come floating out of the open door.
//
// The setting is an island: a round floor of pale tiles with a mint band and a brass rim. At the back, up four round
// steps, stands the vault: a steel drum with a thick round collar, and inside it a round room that glows gold, with
// a heap of Seeds on its floor and jars of Seeds on its shelves. Its door, a thick round disc with a wheel, hangs
// open on its hinges to the left. Liruf stands alone at the far left, clear of the door, and the other three stand
// to both sides of the doorway, so the reader looks straight up the steps into the room. The Seeds that float out
// leave low through the doorway, clear the collar at the right and only then climb, so none passes in front of the
// shelves.
//
// No money is shown anywhere, only Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, decal, glass, halo, landings, lathe, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES } from '../home-kit.js';

const FLOOR = { radius: 3.25, z: -0.6 };
const DAIS = { z: -2.85, top: 0.84 };
// the vault and its door are built with an opening 0.98 across its radius and stand at `scale` of that in the scene
const VAULT = { x: 0.35, z: -2.3, opening: 0.98, collar: 1.36, scale: 0.84 };
const S = VAULT.scale;
const HINGE = { x: -1.38, open: 2.2, at: [0.12, 0.66] }; // `open`: how far the door stands open, in radians from shut; `at`: the hinges' heights
const FLARE = 2.0; // the second the light inside flares

VAULT.y = DAIS.top + VAULT.opening * S;

const STEEL = 0x7f8fd6;
const STEEL_DEEP = 0x5b68b8;

/** A solid turned around the axis that points at the reader: `[radius, depth]` points, from the back to the front. */
function turned(points, material, segments = 96) {
  const m = lathe(points, material, 0, 0, 0, segments);

  m.rotation.x = Math.PI / 2;

  return m;
}

// ---- the floor: pale stone, a band of cooler tiles, mint lines, a brass rim
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#d6a02a');
    ring(0.965, '#f8f1de');
    ring(0.93, '#05a893');
    ring(0.885, '#f8f1de');

    // a broad cool band between two thin mint lines, and thin seams across it
    ring(0.8, '#05a893');
    ring(0.79, '#e7e3f6');
    ring(0.5, '#05a893');
    ring(0.49, '#f8f1de');
    g.strokeStyle = 'rgba(92,85,253,0.16)';
    g.lineWidth = 4;

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;

      g.beginPath();
      g.moveTo(half + Math.cos(a) * half * 0.5, half + Math.sin(a) * half * 0.5);
      g.lineTo(half + Math.cos(a) * half * 0.79, half + Math.sin(a) * half * 0.79);
      g.stroke();
    }

    ring(0.26, '#05a893');
    ring(0.235, '#f8f1de');
    ring(0.21, '#e6e3f6');
  });
  const disc = mesh(new THREE.CylinderGeometry(R, R, 0.08, 128), [standard(0xd6a02a, 0.35, { metalness: 0.5 }), standard(0xffffff, 0.45, { map: top }), standard(C.mintDeep, 0.8)], 0, -0.04, 0);

  disc.castShadow = false;
  group.add(disc, lathe([[0, -0.44], [2.45, -0.44], [3.03, -0.31], [R - 0.04, -0.14], [R - 0.04, -0.08]], standard(C.mintDeep, 0.7)));

  return group;
}

// ---- the steps up to the vault: four round ones, each with a soft edge
function dais() {
  const group = new THREE.Group();
  const stone = [standard(0xefeaf8, 0.55), standard(0xe2ddf2, 0.55)];

  for (let i = 0; i < 4; i++) {
    const r = 1.7 - i * 0.2;
    const y = i * 0.21;

    group.add(lathe([[0, y], [r, y], [r, y + 0.15], [r - 0.02, y + 0.19], [r - 0.06, y + 0.21], [0, y + 0.21]], stone[i % 2]));
  }

  return group;
}

/** A Seed lying where it fell: tipped over, turned by `yaw`. */
function fallen(height, x, y, z, yaw, tip = 1.35) {
  const seed = seedMesh(height);

  seed.position.set(x, y, z);
  seed.rotation.set(tip, yaw, 0, 'YXZ');

  return seed;
}

function jar(height) {
  const group = new THREE.Group();
  const r = height * 0.36;
  const seed = seedMesh(height * 0.62);

  seed.position.y = height * 0.42;
  seed.castShadow = false;
  group.add(
    seed,
    lathe([[0, 0], [r * 0.9, 0], [r, height * 0.08], [r, height * 0.7], [r * 0.72, height * 0.84], [r * 0.72, height * 0.9]], glass(0xd4e4ff, 0.55), 0, 0, 0, 32),
    lathe([[0, height * 0.88], [r * 0.8, height * 0.88], [r * 0.82, height * 0.98], [r * 0.7, height], [0, height]], standard(C.indigo, 0.5), 0, 0, 0, 32),
  );
  group.children[1].castShadow = false;

  return group;
}

// ---- the vault: a steel drum, a thick collar with brass bolts, and the golden room inside
function vault() {
  const group = new THREE.Group();
  const steel = standard(STEEL, 0.38, { metalness: 0.45 });
  const deep = standard(STEEL_DEEP, 0.45, { metalness: 0.4 });
  const brass = standard(0xf2bf2a, 0.28, { metalness: 0.7 });
  const next = sequence(19);
  const O = VAULT.opening;

  // the drum, its collar around the opening, and a brass band inside the collar
  const drum = turned([[0, -1.72], [0.75, -1.66], [1.22, -1.42], [1.43, -1.0], [1.47, -0.45], [1.43, -0.1], [1.3, -0.02]], deep);
  const collar = mesh(new THREE.TorusGeometry((VAULT.collar + O) / 2, (VAULT.collar - O) / 2, 28, 128), steel, 0, 0, 0);
  const band = mesh(new THREE.TorusGeometry(O + 0.02, 0.045, 14, 128), brass, 0, 0, 0.16);

  collar.scale.z = 1.15;
  group.add(drum, collar, band);

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.22;

    group.add(sphere(0.055, brass, Math.cos(a) * (VAULT.collar - 0.19), Math.sin(a) * (VAULT.collar - 0.19), 0.21, 1));
  }

  // the room: a round wall that gives its own golden light
  const wallPicture = canvasTexture([64, 512], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, 0, h);

    // the canvas's top is the room's mouth and its bottom the middle of the back wall
    fade.addColorStop(0, '#c96a08');
    fade.addColorStop(0.35, '#ee9416');
    fade.addColorStop(0.7, '#ffb833');
    fade.addColorStop(1, '#ffd568');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const room = turned([[0, -1.5], [0.8, -1.46], [1.16, -1.2], [1.28, -0.6], [1.18, -0.12], [O, 0]], new THREE.MeshBasicMaterial({ map: wallPicture, side: THREE.BackSide, toneMapped: false }));

  room.castShadow = false;
  room.receiveShadow = false;
  group.add(room);

  // the heap of Seeds on the room's floor
  const heap = new THREE.Group();
  const gold = standard(0xcf8600, 0.6, { emissive: 0x8a5200, emissiveIntensity: 0.5 });

  heap.position.set(0, -O + 0.02, -0.72);
  heap.add(sphere(0.86, gold, 0, -0.1, 0, 0.95), sphere(0.5, gold, -0.62, -0.14, 0.22, 0.7), sphere(0.46, gold, 0.66, -0.16, 0.2, 0.7));

  for (let i = 0; i < 22; i++) {
    const a = next() * Math.PI;
    const up = 0.12 + next() * 0.86;
    const r = 0.86 * Math.cos(up * 1.25) + 0.02;
    const seed = fallen(0.32 + next() * 0.1, Math.cos(a) * r, -0.1 + Math.sin(up * 1.25) * 0.86 * 0.95 + 0.02, Math.sin(a) * r * 0.9, next() * TAU, 1.0 + next() * 0.45);

    seed.castShadow = false;
    heap.add(seed);
  }

  // one Seed stands on the top of the heap
  const crown = seedMesh(0.4);

  crown.position.set(0, 0.93, 0);
  crown.castShadow = false;
  heap.add(crown);
  group.add(heap);

  // two shelves of jars on the back wall
  for (const [y, width, count] of [[0.28, 1.5, 4], [0.64, 1.14, 3]]) {
    const shelf = box(width, 0.06, 0.26, standard(C.woodDark, 0.7), 0, y, -1.22, 0.03);

    shelf.castShadow = false;
    group.add(shelf);

    for (let i = 0; i < count; i++) group.add(place(jar(0.27), (i - (count - 1) / 2) * 0.37, -1.2, 0, y + 0.03));
  }

  const inside = new THREE.PointLight(0xffc960, 2.5, 4.2, 1.6);
  // an aura behind the whole vault, and a gleam on the Seed that stands on the heap
  const glow = halo(2.3, 0xffcf5e, 0.5);
  const star = sprite(TEXTURES.star, 0xfff3c4, 6);

  inside.position.set(0, 0.25, -0.5);
  glow.position.set(0, 0, -1.9);
  glow.renderOrder = 1;
  star.position.set(0, -O + 0.02 + 1.0, -0.5);
  group.add(inside, glow, star);

  return { group, glow, star, inside, crown };
}

// ---- the door: a thick round disc of steel with a brass wheel, hanging open on two hinges set high on its edge
function door() {
  const leaf = new THREE.Group();
  const steel = standard(STEEL, 0.36, { metalness: 0.45 });
  const pale = standard(0xa9b4ec, 0.4, { metalness: 0.4 });
  const brass = standard(0xf2bf2a, 0.28, { metalness: 0.7 });
  const R = VAULT.opening + 0.07;
  const arm = -HINGE.x; // from the hinge to the middle of the door
  const disc = new THREE.Group();
  const wheels = [];

  disc.position.x = arm;
  disc.add(
    turned([[0, -0.15], [R - 0.12, -0.15], [R - 0.03, -0.1], [R, 0], [R - 0.03, 0.1], [R - 0.12, 0.15], [0, 0.15]], steel),
    // the plug that fills the opening when the door is shut, on the face the reader sees
    turned([[0, -0.27], [R - 0.3, -0.27], [R - 0.22, -0.22], [R - 0.2, -0.15], [0, -0.15]], pale),
  );

  // the round bolts that lock it, around its edge
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.31;
    const bolt = mesh(new THREE.CapsuleGeometry(0.045, 0.1, 8, 16), brass, Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), -0.19);

    bolt.rotation.x = Math.PI / 2;
    disc.add(bolt);
  }

  // a wheel on each face
  for (const side of [-1, 1]) {
    const wheel = new THREE.Group();

    wheel.position.z = side * (side < 0 ? 0.4 : 0.28);
    wheel.add(mesh(new THREE.TorusGeometry(0.34, 0.045, 16, 64), brass), sphere(0.1, brass, 0, 0, 0));

    for (let i = 0; i < 3; i++) {
      const spoke = mesh(new THREE.CapsuleGeometry(0.03, 0.62, 8, 16), brass);

      spoke.rotation.z = (i / 3) * Math.PI;
      wheel.add(spoke);
    }

    const axle = mesh(new THREE.CapsuleGeometry(0.05, 0.1, 8, 16), brass, 0, 0, side * (side < 0 ? 0.33 : 0.2));

    axle.rotation.x = Math.PI / 2;
    disc.add(wheel, axle);
    wheels.push(wheel);
  }

  // the two hinges: a knuckle on the wall's side and a strap across the door
  for (const y of HINGE.at) {
    const strap = arm - Math.sqrt(R * R - y * y) + 0.14; // as far as the door's edge at this height, and a little onto it

    leaf.add(
      mesh(new THREE.CapsuleGeometry(0.085, 0.2, 10, 20), brass, 0, y, 0),
      box(strap, 0.13, 0.36, pale, strap / 2 + 0.02, y, 0, 0.06),
    );
  }

  leaf.add(disc);
  leaf.rotation.y = -HINGE.open;

  return { leaf, wheels };
}

export function build(scene, { loop, heights, jump, tuck, Y, Z, curve }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const strong = vault();
  const open = door();

  set.add(place(floor(), 0, FLOOR.z), shadowCatcher(FLOOR.radius - 0.08, 0.008, FLOOR.z, 0.32));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(30,70,120,0.30)'], [0.6, 'rgba(30,70,120,0.15)'], [0.85, 'rgba(30,70,120,0.04)'], [1, 'rgba(30,70,120,0)']]), 0, -0.52, FLOOR.z, 4.1, 4.1, 0));

  strong.group.scale.setScalar(S);
  open.leaf.scale.setScalar(S);
  set.add(place(dais(), VAULT.x, DAIS.z), place(strong.group, VAULT.x, VAULT.z, 0, VAULT.y), place(open.leaf, VAULT.x + HINGE.x * S, VAULT.z + 0.2 * S, -HINGE.open, VAULT.y));

  // the hinges' plates on the collar
  for (const y of HINGE.at) set.add(box(0.22, 0.13, 0.17, standard(0xa9b4ec, 0.4, { metalness: 0.4 }), VAULT.x + (HINGE.x + 0.1) * S, VAULT.y + y * S, VAULT.z + 0.16 * S, 0.05));

  // the light that spills down the steps and over the floor
  const spill = decal(radial([[0, 'rgba(255,214,110,0.75)'], [0.5, 'rgba(255,214,110,0.32)'], [1, 'rgba(255,214,110,0)']]), VAULT.x, 0.012, -0.35, 1.1, 1.4, 1);
  const spillLight = new THREE.PointLight(0xffcf70, 7, 5.5, 1.7);

  spillLight.position.set(VAULT.x, 1.7, -1.2);
  set.add(spill, spillLight);

  const cast = {
    // Liruf stares up at the open door beside him, then jumps
    liruf: { x: -2.55, z: 0.3, yaw: 0.45, act: {
      hop: jump(2.25, 0.22), tuck: tuck(2.25, 0.8), yaw: [[0, 0.45], [1.5, 0.45], [2.25, 0.1], [4.6, 0.1], [6, 0.45], [L, 0.45]],
      pitch: [[0, -0.3], [1.6, -0.3], [2.25, -0.18], [3, -0.05], [5.5, -0.3], [L, -0.3]], roll: [[0, 0.14], [2.25, -0.12], [4, 0.14], [L, 0.14]],
      lean: [[0, -0.06], [2.25, -0.14], [2.8, 0.1], [3.5, -0.06], [L, -0.06]], tilt: [[0, 0], [2.25, -0.08], [3, 0], [L, 0]],
    } },
    // Zara shows the reader what is inside, one arm held out toward it
    zara: { x: -0.33, z: 0.55, yaw: 0.12, act: {
      hop: jump(2.0, 0.16), tuck: tuck(2.0, 0.5), lean: [[0, 0], [2.0, -0.1], [2.8, 0], [L, 0]],
      roll: [[0, 0.1], [2.0, 0.16], [4.4, -0.06], [6.4, 0.1], [L, 0.1]], pitch: [[0, -0.06], [2.0, -0.16], [2.8, -0.06], [L, -0.06]],
      yaw: [[0, 0], [3.2, 0], [4.2, 0.55], [5.6, 0.55], [6.6, 0], [L, 0]], tilt: [[0, 0], [2.0, -0.05], [3, 0], [L, 0]],
    } },
    // Rho looks up into the vault, jumps a beat later and nods
    rho: { x: 1.12, z: 0.45, yaw: -0.14, act: {
      hop: jump(2.4, 0.17), tuck: tuck(2.4, 0.7), lean: [[0, -0.05], [2.4, -0.16], [2.85, 0.08], [3.5, -0.05], [L, -0.05]],
      pitch: [[0, -0.16], [2.4, -0.3], [2.85, 0.14], [3.5, -0.12], [L, -0.16]], roll: [[0, -0.1], [2.4, 0.1], [4.3, -0.1], [L, -0.1]],
      yaw: [[0, -0.3], [1.6, -0.3], [2.4, 0], [4.8, 0], [6, -0.3], [L, -0.3]], tilt: [[0, 0], [2.4, 0.08], [3.2, 0], [L, 0]],
    } },
    // Dina rears up after a Seed that floats over her
    dina: { x: 2.17, z: -0.05, yaw: -0.5, act: {
      hop: jump(2.6, 0.12), rear: [[0, 0], [2.1, 0], [2.6, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.2], [2.6, -0.44], [3.4, -0.2], [L, -0.2]],
      roll: [[0, 0.18], [2.6, -0.1], [4.4, 0.18], [L, 0.18]], yaw: [[0, 0.3], [1.6, 0.3], [2.6, 0.05], [5, 0.05], [6.2, 0.3], [L, 0.3]],
    } },
  };
  const peaks = { liruf: 2.25, zara: 2.0, rho: 2.4, dina: 2.6 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: peaks[name] }));
  // Zara's arm: out toward the vault from the flare on, down again before the loop ends
  const showing = [[0, 0], [1.5, 0], [2.0, 1], [5.8, 1], [6.6, 0], [L, 0]];

  // Seeds that float out of the door, one after another. Each leaves low through the doorway, clears the collar at
  // the right, climbs beside it, and only then goes its own way over the vault and the mentors.
  const from = new THREE.Vector3(VAULT.x, VAULT.y - 0.2, VAULT.z - 0.3);
  const next = sequence(27);
  const adrift = [[2.25, 3.0, -0.5], [0.55, 3.3, -0.9], [2.85, 2.7, -0.6], [-0.35, 3.25, -0.8], [1.75, 3.25, -0.7], [-1.15, 3.15, -0.6], [2.55, 3.2, -0.4], [-1.95, 2.95, -0.5]].map(([x, y, z], i, all) => {
    const seed = seedMesh(0.32 + next() * 0.1);
    const glow = halo(0.4, 0xffe2a0, 0.5);
    const out = 1.2 + next() * 0.35;
    const way = new THREE.CatmullRomCurve3([from, new THREE.Vector3(VAULT.x + out, VAULT.y + 0.2, VAULT.z + 0.8), new THREE.Vector3(VAULT.x + out + 0.15, VAULT.y + 1.0, VAULT.z + 1.1), new THREE.Vector3(x, y, z)]);

    seed.castShadow = false;
    fx.add(seed, glow);

    return { seed, glow, way, start: i / all.length + 0.029, phase: next() * TAU, lean: (next() - 0.5) * 1.0, size: seed.scale.x };
  });
  // the flare: rays of small stars thrown out of the opening
  const burst = Array.from({ length: 18 }, (_, i) => {
    const star = sprite(i % 3 ? TEXTURES.star : TEXTURES.dot, [0xfff3c4, 0xffffff, 0xffd36b][i % 3], 9);
    const a = (i / 18) * TAU + next() * 0.2;

    fx.add(star);

    return { star, a, reach: 1.0 + next() * 0.7, size: 0.12 + next() * 0.14 };
  });
  const effects = [
    sparkles(fx, { loop, actors, each: 5, seed: 29, colors: [0xffffff, 0xfff0b8, 0xffd36b] }),
    landings(fx, { actors, color: 0xfff0c8 }),
    // motes of gold that rise inside the room and out of its door
    rising(fx, { loop, at: { x: VAULT.x, y: VAULT.y - 0.7, z: VAULT.z + 0.1 }, radius: 0.68, height: 1.45, count: 26, color: [0xfff3c4, 0xffffff, 0xffd36b], size: [0.03, 0.08], seed: 14, texture: TEXTURES.star, depth: 0.3 }),
    rising(fx, { loop, at: { x: VAULT.x, y: 0.25, z: -0.9 }, radius: 0.5, height: 1.3, count: 12, color: [0xfff3c4, 0xffd36b], size: [0.025, 0.06], seed: 21, depth: 0.8 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.25,
    camera: { y: 2.3, dist: 14.4, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - FLARE;
      const flare = since > -0.3 && since < 2.2 ? Math.sin(Math.min(1, (since + 0.3) / 0.5) * Math.PI / 2) * Math.max(0, 1 - Math.max(0, since - 0.2) / 2) : 0;
      const pulse = 0.5 + 0.5 * Math.sin(w * 3);

      strong.glow.material.opacity = 0.45 + pulse * 0.08 + flare * 0.3;
      strong.glow.scale.setScalar(4.6 * (1 + flare * 0.12));
      strong.inside.intensity = 2.5 + flare * 2.5;
      strong.star.scale.setScalar(0.4 + flare * 0.5);
      strong.star.material.opacity = 0.6 + flare * 0.4;
      strong.star.material.rotation = w;
      strong.crown.rotation.y = w * 2;
      spill.material.opacity = 0.75 + flare * 0.25;
      spillLight.intensity = 7 + flare * 6;

      // the wheels turn a little, as if the door had just been swung open
      for (const [i, wheel] of open.wheels.entries()) wheel.rotation.z = Math.sin(w + i) * 0.5;

      for (const { seed, glow, way, start, phase, lean, size } of adrift) {
        const u = (t / loop + start) % 1;

        way.getPoint(1 - (1 - u) ** 1.5, seed.position);
        seed.position.y += Math.sin(w * 2 + phase) * 0.04;
        seed.rotation.set(lean, w * 2 + phase, lean * 0.5);
        seed.scale.setScalar(size * Math.min(1, u / 0.12, (1 - u) / 0.12));
        glow.position.copy(seed.position);
        glow.scale.setScalar(0.8 * Math.min(1, u / 0.12, (1 - u) / 0.12));
      }

      for (const { star, a, reach, size } of burst) {
        const u = since / 1.3;

        star.visible = u > 0 && u < 1;
        star.position.set(VAULT.x + Math.cos(a) * (0.5 + reach * (1 - (1 - u) ** 2)), VAULT.y + Math.sin(a) * (0.5 + reach * (1 - (1 - u) ** 2)), VAULT.z + 0.5);
        star.scale.setScalar(size * (1.4 - u * 0.6));
        star.material.opacity = Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u) ** 0.7;
        star.material.rotation = a + u * 2;
      }

      // Zara's left arm comes up and out toward the vault behind her
      const show = curve(showing, t);

      rigs.zara.rot('LeftArm', Z, show * 1.2);
      rigs.zara.rot('LeftArm', Y, show * 0.45);
      rigs.zara.rot('LeftForeArm', Z, show * 0.15);

      for (const effect of effects) effect(t);
    },
  };
}
