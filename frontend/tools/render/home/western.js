// Home composition "western": a duel at sunset in the street of a small town of the old west, played for fun with
// water balloons. The four mentors face each other in two pairs across the street; balloons fly over the gap
// between them in high arcs and burst on the dust, never on anybody.
//
// The setting is an island: a round piece of dusty street with red earth underneath. At the back, the wooden front
// of a saloon (no word on it: its plaque carries a Seed) with a round-topped doorway, two swinging doors and two
// round windows that glow. Each pair has its supply of balloons beside it: the left pair's float in a round-ended
// water trough, the right pair's waits on a barrel. Nothing stands behind Dina, who is large. A tumbleweed rolls
// out through the swinging doors into the open street between the two pairs, turns and rolls back in, while no
// balloon is bursting there. Far behind, a large sun goes down over round hills where two round cacti grow, inside
// a cloud of sunset colors that fades to nothing before the frame's borders.
//
// Liruf, Zara and Dina wear a round wide-brimmed hat that follows the head (Liruf's sits behind his eyes, which are
// the top of his head); Rho keeps his own cap. Nobody holds
// anything that looks like a weapon: a balloon appears over a mentor and is thrown, headed or bounced away.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const STREET = { radius: 3.25, z: -0.5 };
const SALOON = { z: -2.62 };
const TROUGH = { x: -2.76, z: -0.3 };
const BARREL = { x: 2.74, z: 0.5 };
const FLIGHT = 1.2; // seconds a balloon is in the air
// the balloons: who sends each, when, from where (over the sender), and where it bursts on the street
const SHOTS = [
  { by: 'rho', at: 1.2, from: [0.5, 1.74, 0.5], to: [-0.24, 0.05, 0.3], color: 0x35c8b0 },
  { by: 'zara', at: 2.0, from: [-0.5, 1.22, 0.9], to: [0.08, 0.05, -0.15], color: 0xff6fa5 },
  { by: 'liruf', at: 2.35, from: [-1.64, 2.0, 0.0], to: [-0.06, 0.05, -0.6], color: 0x4b94ff },
  { by: 'dina', at: 3.4, from: [1.5, 2.0, 0.2], to: [-0.16, 0.05, -0.35], color: 0xf2bf2a },
  { by: 'rho', at: 5.6, from: [0.5, 1.74, 0.5], to: [-0.2, 0.05, -0.5], color: 0x8f8aff },
];

// ---- the street: pale dust with wheel ruts and pebbles, a soft edge, red earth underneath
function street() {
  const group = new THREE.Group();
  const next = sequence(47);
  const R = STREET.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    g.fillStyle = '#e9c88f';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 150;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,236,190,0.4)' : 'rgba(196,140,84,0.26)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // two soft wheel ruts across the street
    g.strokeStyle = 'rgba(176,120,70,0.3)';
    g.lineWidth = 26;
    g.lineCap = 'round';

    for (const y of [0.56, 0.68]) {
      g.beginPath();
      g.moveTo(w * 0.04, w * y);
      g.bezierCurveTo(w * 0.3, w * (y + 0.03), w * 0.7, w * (y - 0.03), w * 0.96, w * y);
      g.stroke();
    }

    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 3 ? 'rgba(170,116,70,0.5)' : 'rgba(255,244,214,0.7)';
      g.beginPath();
      g.ellipse(next() * w, next() * w, 5 + next() * 9, 4 + next() * 6, 0, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xc98b55, 0.95), standard(0xffffff, 0.95, { map: picture }), standard(0xa8562f, 0.95)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0xdcb47a, 0.95), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.66], [1.2, -0.62], [2.2, -0.46], [2.9, -0.26], [R - 0.04, -0.1]], standard(0xb5623a, 0.95)));

  return group;
}

/** A board with round corners and round edges, `w` by `h`, standing on y = 0 with its middle on x = 0. `r` rounds its top corners. */
function board(w, h, depth, r, material) {
  const shape = new THREE.Shape();

  shape.moveTo(-w / 2, 0);
  shape.lineTo(-w / 2, h - r);
  shape.absarc(-w / 2 + r, h - r, r, Math.PI, Math.PI / 2, true);
  shape.lineTo(w / 2 - r, h);
  shape.absarc(w / 2 - r, h - r, r, Math.PI / 2, 0, true);
  shape.lineTo(w / 2, 0);
  shape.closePath();

  return mesh(new THREE.ExtrudeGeometry(shape, { depth: depth - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 5, curveSegments: 24 }), material, 0, 0, -depth / 2 + 0.06);
}

// ---- the saloon's front: planks, a false front with a plaque, an awning on two posts, a round-topped doorway
// with two swinging doors, two round windows
function saloon() {
  const group = new THREE.Group();
  const wood = standard(0xd39a5f, 0.85);
  const dark = standard(0xa86a3c, 0.85);
  const trim = standard(0xf3dfb8, 0.8);
  const red = standard(0xd6533a, 0.75);
  const planks = canvasTexture([1024, 768], (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(140,84,44,0.4)';
    g.lineWidth = 7;
    g.lineCap = 'round';

    for (let y = 70; y < h; y += 92) {
      g.beginPath();
      g.moveTo(30, y);
      g.lineTo(w - 30, y);
      g.stroke();
    }
  });
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.1), new THREE.MeshBasicMaterial({ map: planks, transparent: true, depthWrite: false }));

  lines.position.set(0, 1.1, 0.172);
  lines.renderOrder = 3;
  group.add(board(3.1, 2.25, 0.34, 0.2, wood), lines);

  // the false front over it, with a round plaque that carries a Seed
  const front = board(2.0, 0.78, 0.3, 0.36, wood);
  const plaque = new THREE.Mesh(new THREE.CircleGeometry(0.25, 48), new THREE.MeshBasicMaterial({
    map: canvasTexture([256, 256], (g, s) => {
      g.fillStyle = '#fff1cf';
      g.beginPath();
      g.arc(s / 2, s / 2, s / 2 - 4, 0, TAU);
      g.fill();
      drawSeed(g, s / 2, s / 2, s * 0.6, '#ebb806', '#2b3050');
    }),
    transparent: true, toneMapped: false,
  }));

  front.position.y = 2.2;
  plaque.position.set(0, 2.58, 0.165);
  plaque.renderOrder = 3;
  group.add(front, plaque, mesh(new THREE.TorusGeometry(0.26, 0.035, 12, 48), dark, 0, 2.58, 0.16));

  // the awning: a round-edged roof on two round posts
  group.add(box(3.4, 0.16, 0.8, red, 0, 2.02, 0.5, 0.08), box(3.4, 0.1, 0.1, trim, 0, 1.94, 0.86, 0.05));

  for (const x of [-1.56, 1.56]) group.add(cylinder(0.06, 0.07, 1.95, trim, x, 0.975, 0.8, 20), sphere(0.1, trim, x, 0.06, 0.8, 0.7));

  // the doorway: a warm room behind a round-topped arch
  const arch = new THREE.Shape();

  arch.moveTo(-0.5, 0);
  arch.lineTo(-0.5, 1.2);
  arch.absarc(0, 1.2, 0.5, Math.PI, 0, true);
  arch.lineTo(0.5, 0);
  arch.closePath();

  const room = new THREE.Mesh(new THREE.ShapeGeometry(arch, 32), lit(0xffc670, 1.5));
  const roomLight = new THREE.PointLight(0xffc880, 5, 4.5, 1.8);

  room.position.set(0, 0.02, 0.176);
  roomLight.position.set(0, 1.2, 0.9);
  group.add(room, roomLight);
  group.add(tube([[-0.55, 0.02, 0.19], [-0.55, 1.2, 0.19], [-0.39, 1.59, 0.19], [0, 1.75, 0.19], [0.39, 1.59, 0.19], [0.55, 1.2, 0.19], [0.55, 0.02, 0.19]], 0.055, dark, 48));

  // the swinging doors: each on its own hinge at the doorway's side
  const doors = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const leaf = box(0.44, 0.62, 0.05, trim, -side * 0.24, 0, 0, 0.1);

    hinge.position.set(side * 0.49, 0.92, 0.24);
    hinge.add(leaf);

    for (const y of [-0.16, 0, 0.16]) hinge.add(box(0.3, 0.05, 0.02, dark, -side * 0.24, y, 0.03, 0.02));

    group.add(hinge);

    return { hinge, side };
  });

  // two round windows that glow
  for (const x of [-1.08, 1.08]) {
    const pane = cylinder(0.24, 0.24, 0.04, lit(0xffd98a, 1.7), x, 1.28, 0.165, 40);

    pane.rotation.x = Math.PI / 2;
    pane.castShadow = false;
    group.add(pane, mesh(new THREE.TorusGeometry(0.25, 0.045, 12, 48), dark, x, 1.28, 0.175), cylinder(0.02, 0.02, 0.48, dark, x, 1.28, 0.19, 10), cylinder(0.02, 0.02, 0.48, dark, x, 1.28, 0.19, 10).rotateZ(Math.PI / 2));
  }

  // a step of planks before the door
  group.add(box(1.5, 0.1, 0.5, dark, 0, 0.05, 0.5, 0.05));

  return { group, doors };
}

// ---- the water trough: a long wooden tub with round ends and two iron hoops, on two feet, full to the brim. Its
// long side runs along z here.
function trough() {
  const group = new THREE.Group();
  const wood = standard(0xb87a48, 0.85);
  const iron = standard(0x5d4a3a, 0.5, { metalness: 0.4 });
  const long = 1.85; // how much longer than wide
  const tub = lathe([[0, 0.2], [0.24, 0.2], [0.29, 0.26], [0.31, 0.56], [0.33, 0.62], [0.3, 0.64], [0.27, 0.6], [0, 0.6]], wood);
  const water = cylinder(0.275, 0.275, 0.02, new THREE.MeshStandardMaterial({ color: 0x6fc4ff, roughness: 0.1, emissive: 0x2f8fe0, emissiveIntensity: 0.45 }), 0, 0.61, 0, 48);

  tub.scale.z = long;
  water.scale.z = long;
  water.castShadow = false;
  group.add(tub, water);

  for (const y of [0.34, 0.52]) {
    const hoop = mesh(new THREE.TorusGeometry(0.305, 0.018, 8, 48), iron, 0, y, 0);

    hoop.rotation.x = Math.PI / 2;
    hoop.scale.y = long;
    group.add(hoop);
  }

  for (const z of [-0.3, 0.3]) group.add(box(0.56, 0.22, 0.14, standard(0x8f5a33, 0.85), 0, 0.11, z, 0.06));

  return { group, water };
}

function barrel(height, radius) {
  const group = new THREE.Group();
  const iron = standard(0x5d4a3a, 0.5, { metalness: 0.4 });
  const r = radius;

  group.add(lathe([[0, 0], [r * 0.8, 0], [r * 0.86, height * 0.06], [r, height * 0.4], [r, height * 0.6], [r * 0.86, height * 0.94], [r * 0.8, height], [0, height]], standard(0xc0844c, 0.8)));

  for (const [y, k] of [[0.2, 0.93], [0.8, 0.93]]) group.add(mesh(new THREE.TorusGeometry(r * k, 0.022, 10, 48), iron, 0, height * y, 0).rotateX(Math.PI / 2));

  return group;
}

/** A water balloon: round, a little heavier below, with a small knot on top and a shine. */
function balloon(color, radius = 0.15) {
  const group = new THREE.Group();
  const skin = standard(color, 0.22, { emissive: color, emissiveIntensity: 0.18 });
  const body = mesh(new THREE.SphereGeometry(radius, 40, 28), skin);
  const shine = sprite(TEXTURES.dot, 0xffffff, 9);

  body.scale.y = 1.08;
  shine.scale.set(radius * 0.7, radius * 0.4, 1);
  shine.material.rotation = 0.6;
  shine.material.opacity = 0.9;
  shine.position.set(-radius * 0.38, radius * 0.4, radius * 0.8);
  group.add(body, sphere(radius * 0.17, skin, 0, radius * 1.1, 0, 0.8), shine);

  return group;
}

/** A round hat with a wide brim that curls up at both sides and a band, one unit wide at the crown: scaled to each head. */
function hat(color, band) {
  const group = new THREE.Group();
  const felt = lathe([[0, 0.02], [1.7, 0], [2.0, 0.03], [2.08, 0.1], [1.96, 0.17], [1.1, 0.2], [1.0, 0.34], [0.97, 0.8], [0.86, 1.04], [0.5, 1.14], [0, 1.1]], standard(color, 0.85));
  const at = felt.geometry.attributes.position;

  // the brim curls up toward its two sides
  for (let i = 0; i < at.count; i++) {
    const side = Math.abs(at.getX(i));

    if (side > 1) at.setY(i, at.getY(i) + ((side - 1) / 1.08) ** 2 * 0.42);
  }

  felt.geometry.computeVertexNormals();
  group.add(felt, cylinder(1.03, 1.05, 0.18, standard(band, 0.6), 0, 0.32, 0, 48));

  return group;
}

// each hat: the crown's radius, where its brim sits from the head bone (up, and forward along the snout), how far it
// tips back, and how tall its crown is (Dina's has room for her crest)
const HATS = { liruf: [0.16, 0.5, -0.2, -0.5, 1], zara: [0.16, 0.17, 0.0, -0.12, 1], dina: [0.21, 0.29, 0.13, -0.1, 1.5] };

// ---- far behind: a cloud of sunset colors, the sun going down, two rows of round hills
function sunset() {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const warm = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    warm.addColorStop(0, 'rgba(255,170,96,0.96)');
    warm.addColorStop(0.45, 'rgba(255,128,110,0.88)');
    warm.addColorStop(0.8, 'rgba(214,96,160,0.34)');
    warm.addColorStop(1, 'rgba(214,96,160,0)');
    g.fillStyle = warm;
    g.fillRect(0, 0, w, w);

    // paler and yellower around the sun, violet high up
    for (const [x, y, r, color, a] of [[0.3, 0.52, 0.3, '255,226,140', 0.8], [0.62, 0.22, 0.3, '150,100,220', 0.4]]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},${a})`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,250,214,1)'], [0.7, 'rgba(255,226,140,1)'], [0.98, 'rgba(255,196,110,1)'], [1, 'rgba(255,196,110,0)']]), transparent: true, depthWrite: false, toneMapped: false }));
  const shine = halo(2.3, 0xffe2a0, 0.55);
  // one row of hills: round backs, fading out at the foot and at both ends
  const hills = (seed, color) => canvasTexture([2048, 512], (g, w, h) => {
    const pick = sequence(seed);
    let x = -120;

    g.fillStyle = color;

    while (x < w + 100) {
      const r = 190 + pick() * 190;

      g.beginPath();
      g.ellipse(x + r, h * 0.92, r, h * (0.36 + pick() * 0.44), 0, 0, TAU);
      g.fill();
      x += r * (0.9 + pick() * 0.6);
    }

    for (const [x0, y0, x1, y1, stops] of [[0, 0, 0, h, [[0, 1], [0.55, 1], [0.95, 0]]], [0, 0, w, 0, [[0, 0], [0.14, 1], [0.86, 1], [1, 0]]]]) {
      const fade = g.createLinearGradient(x0, y0, x1, y1);

      for (const [at, a] of stops) fade.addColorStop(at, `rgba(0,0,0,${a})`);

      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
    }

    g.globalCompositeOperation = 'source-over';
  });

  cloud.position.set(0, 1.15, -9);
  cloud.scale.set(10.6, 5.2, 1);
  shine.position.set(-2.75, 1.8, -8.4);
  shine.renderOrder = 1;
  sun.position.set(-2.75, 1.8, -8.3);
  sun.renderOrder = 1;
  group.add(cloud, shine, sun);

  // two round cacti far away on the hills to the right: a trunk and two arms with round ends, a flower on top
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({
    map: canvasTexture([512, 512], (g, s) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';

      for (const [x, foot, tall, wide, color] of [[0.34, 0.86, 0.6, 62, '#3f9c62'], [0.76, 0.9, 0.36, 44, '#4dab6e']]) {
        g.strokeStyle = color;
        g.lineWidth = wide;
        g.beginPath();
        g.moveTo(s * x, s * foot);
        g.lineTo(s * x, s * (foot - tall));
        g.stroke();
        g.lineWidth = wide * 0.62;

        for (const [side, low, up] of [[-1, 0.42, 0.26], [1, 0.58, 0.2]]) {
          g.beginPath();
          g.moveTo(s * x, s * (foot - tall * low));
          g.lineTo(s * x + side * wide * 1.25, s * (foot - tall * low));
          g.lineTo(s * x + side * wide * 1.25, s * (foot - tall * (low + up)));
          g.stroke();
        }

        g.fillStyle = '#ff8fb8';
        g.beginPath();
        g.arc(s * x, s * (foot - tall) - wide * 0.5, wide * 0.24, 0, TAU);
        g.fill();
      }
    }),
    transparent: true, depthWrite: false, toneMapped: false,
  }));

  far.position.set(4.3, 1.12, -6.8);
  far.renderOrder = 4;
  group.add(far);

  for (const [seed, color, y, z, wide, tall, order] of [[3, '#c9627e', 1.25, -8, 9.6, 2.3, 2], [8, '#b5533f', 0.85, -7, 8.8, 2.0, 3]]) {
    const row = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), new THREE.MeshBasicMaterial({ map: hills(seed, color), transparent: true, depthWrite: false, toneMapped: false }));

    row.position.set(0, y, z);
    row.renderOrder = order;
    group.add(row);
  }

  return group;
}

// ---- the tumbleweed: a ball of dry round twigs
function tumbleweed(radius) {
  const group = new THREE.Group();
  const next = sequence(77);
  const twig = [standard(0xc9a05a, 0.9), standard(0xa8813f, 0.9)];

  for (let i = 0; i < 9; i++) {
    const loop = mesh(new THREE.TorusGeometry(radius * (0.78 + next() * 0.22), 0.016, 6, 40), twig[i % 2]);

    loop.rotation.set(next() * Math.PI, next() * Math.PI, next() * Math.PI);
    group.add(loop);
  }

  return group;
}

export function build(scene, { loop, heights, jump, tuck, curve, number, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const next = sequence(15);
  const bar = saloon();
  const drink = trough();
  const weed = tumbleweed(0.22);

  set.add(place(street(), 0, STREET.z), shadowCatcher(STREET.radius - 0.12, 0.008, STREET.z, 0.34), sunset());
  set.add(decal(radial([[0, 'rgba(120,60,60,0.28)'], [0.6, 'rgba(120,60,60,0.14)'], [1, 'rgba(120,60,60,0)']]), 0, -0.75, STREET.z, 3.2, 2.0, 0));
  set.add(place(bar.group, 0, SALOON.z), place(drink.group, TROUGH.x, TROUGH.z, 0.12), weed);

  // the left pair's supply floats in the trough; the right pair's waits on a barrel
  const floating = [[0.32, 0xff6fa5], [0.0, 0x4b94ff], [-0.32, 0xf2bf2a]].map(([z, color], k) => {
    const one = balloon(color, 0.13);

    one.position.set(0, 0.7, z);
    drink.group.add(one);

    return { one, phase: k * 2.1 };
  });
  const stock = new THREE.Group();

  stock.add(barrel(0.7, 0.27), place(balloon(0x35c8b0, 0.14), 0.0, 0.0, 0, 0.85));
  set.add(place(stock, BARREL.x, BARREL.z));

  const cast = {
    // Liruf heads his balloon away with a jump, and ducks when one bursts near
    liruf: { x: -1.84, z: -0.1, yaw: 0.5, act: {
      hop: jump(2.3, 0.26), tuck: tuck(2.3, 0.8), lean: [[0, 0.06], [1.9, 0.14], [2.3, -0.16], [2.8, 0.1], [3.3, 0.04], [L, 0.06]],
      pitch: [[0, -0.1], [1.9, 0.1], [2.3, -0.36], [2.9, -0.05], [4.2, -0.25], [5.2, -0.1], [L, -0.1]], yaw: [[0, 0.25], [2.3, 0.1], [3.4, 0.4], [5.2, 0.4], [6.4, 0.25], [L, 0.25]],
      roll: [[0, -0.1], [2.3, 0.12], [4.2, -0.12], [L, -0.1]], tilt: [[0, 0], [1.25, -0.1], [1.9, 0], [L, 0]],
    } },
    // Zara swings her arm back and tosses hers underarm, then watches it come down
    zara: { x: -0.96, z: 0.42, yaw: 0.55, act: {
      hop: jump(4.3, 0.14), tuck: tuck(4.3, 0.5), lean: [[0, 0], [1.6, -0.12], [2.0, 0.2], [2.5, 0.08], [3.2, 0], [L, 0]],
      pitch: [[0, -0.08], [1.6, -0.2], [2.1, 0.05], [2.6, -0.24], [3.2, 0.0], [4.3, -0.2], [L, -0.08]], yaw: [[0, 0.3], [1.3, 0.45], [3.4, 0.45], [4.6, 0.1], [L, 0.3]],
      roll: [[0, 0.06], [1.6, -0.1], [2.1, 0.1], [4, -0.06], [L, 0.06]], tilt: [[0, 0], [1.6, -0.08], [2.05, 0.1], [2.7, 0], [L, 0]], turn: [[0, 0], [1.6, -0.25], [2.05, 0.25], [2.8, 0], [L, 0]],
    } },
    // Rho bounces his off with a hop, twice, and leans back out of the way of Zara's
    rho: { x: 0.7, z: 0.42, yaw: -0.6, act: {
      hop: [[0, 0], [0.65, 0], [0.88, -0.035], [1.2, 0.2], [1.5, -0.03], [1.7, 0], [5.05, 0], [5.28, -0.035], [5.6, 0.17], [5.9, -0.03], [6.1, 0], [L, 0]], tuck: [[0, 0], [0.9, 0], [1.2, 0.7], [1.5, 0], [5.3, 0], [5.6, 0.6], [5.9, 0], [L, 0]],
      lean: [[0, 0], [0.8, 0.12], [1.2, -0.14], [1.7, 0.04], [2.9, 0.0], [3.3, -0.22], [4.0, -0.04], [L, 0]], pitch: [[0, -0.1], [1.2, -0.32], [1.8, -0.05], [3.3, 0.12], [4.2, -0.1], [5.6, -0.3], [6.2, -0.1], [L, -0.1]],
      yaw: [[0, -0.3], [2.4, -0.4], [3.3, -0.15], [4.6, -0.35], [L, -0.3]], roll: [[0, 0.08], [1.2, -0.1], [3.3, 0.12], [5.6, -0.08], [L, 0.08]], tilt: [[0, 0], [3.3, 0.1], [4.0, 0], [L, 0]],
    } },
    // Dina rears up to send hers, and shakes her head at the splashes
    dina: { x: 1.9, z: -0.15, yaw: -0.3, act: {
      hop: jump(3.4, 0.1), rear: [[0, 0], [2.95, 0], [3.4, 0.75], [4.0, 0], [L, 0]], pitch: [[0, -0.2], [2.4, -0.05], [3.4, -0.4], [4.2, -0.15], [L, -0.2]],
      yaw: [[0, -0.4], [1.6, -0.5], [2.5, -0.25], [3.4, -0.45], [5, -0.3], [L, -0.4]], roll: [[0, 0.14], [2.45, -0.14], [2.75, 0.14], [3.05, -0.08], [3.4, 0.06], [5, 0.14], [L, 0.14]],
    } },
  };
  const names = Object.keys(cast);
  const actors = names.map((name) => ({ x: cast[name].x, z: cast[name].z, height: heights[name], peak: { liruf: 2.3, zara: 4.3, rho: 1.2, dina: 3.4 }[name], clear: { liruf: 0.6, dina: 0.8 }[name] }));

  // the balloons in flight, each with its burst: a crown of drops, a ring on the dust and a wet patch that dries
  const drop = radial([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(214,240,255,1)'], [0.8, 'rgba(110,190,255,0.95)'], [1, 'rgba(110,190,255,0)']], 64);
  const wet = radial([[0, 'rgba(112,74,48,0.62)'], [0.75, 'rgba(112,74,48,0.5)'], [1, 'rgba(112,74,48,0)']], 128);
  const shots = SHOTS.map((shot, n) => {
    const ball = balloon(shot.color, 0.16);
    // the crown: round drops of water thrown up and out in a fan, an outer ring of fourteen and a slower inner one
    const drops = Array.from({ length: 22 }, (_, k) => {
      const one = sprite(drop, 0xffffff, 9);
      const outer = k < 14;
      const lift = 0.45 + ((outer ? k : k - 14) / (outer ? 13 : 7)) * (Math.PI - 0.9) + (next() - 0.5) * 0.3;
      const speed = (outer ? 2.1 : 1.3) * (0.72 + next() * 0.5);

      fx.add(one);

      return { one, vx: Math.cos(lift) * speed, vz: (next() - 0.5) * 0.4, vy: Math.sin(lift) * speed + 0.4, size: 0.045 + next() * next() * 0.1 };
    });
    const ring = decal(TEXTURES.ring, shot.to[0], 0.02, shot.to[2], 1, 1, 3);
    const patch = decal(wet, shot.to[0], 0.012, shot.to[2], 0.52, 0.4, 2);

    const flash = halo(0.5, 0xd8f1ff, 0.7);

    flash.renderOrder = 8;
    ring.material.color.set(0xd8f1ff);
    fx.add(ball, ring, patch, flash);

    return { ...shot, ball, drops, ring, patch, flash, spin: n * 1.3 };
  });
  // Zara's toss: her left arm, the one toward the other pair, swings back, then forward and up, under the brim of
  // her hat all the way
  const back = [[0, 0], [1.2, 0], [1.75, 1], [1.9, 1], [2.05, 0], [L, 0]];
  const through = [[0, 0], [1.9, 0], [2.1, 1], [2.5, 0.85], [3.1, 0], [L, 0]];
  const effects = [
    sparkles(fx, { loop, actors, each: 5, colors: [0xffffff, 0xfff0b8, 0xbfe9ff] }),
    landings(fx, { actors, color: 0xfff0d2 }),
    // dust in the low sun, drifting up over the whole street
    rising(fx, { loop, at: { x: 0, y: 0.1, z: -1.0 }, radius: 2.7, height: 2.2, count: 26, color: [0xffe6b0, 0xfff6dc], size: [0.03, 0.07], seed: 6, sway: 0.2, depth: 0.5 }),
  ];
  // where the tumbleweed is along the street (z): out before the door from the loop's end to its start, inside the rest
  const rolling = [[0, -1.3], [1.3, -1.3], [2.25, -3.1], [7.3, -3.1], [L, -1.3]];
  // puffs of dust the tumbleweed leaves
  const puffs = Array.from({ length: 5 }, () => {
    const one = sprite(TEXTURES.dot, 0xf4dcae, 4);

    fx.add(one);

    return one;
  });
  const hats = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.62,
    camera: { y: 2.3, dist: 14.0, lookY: 1.15 },
    ready(rigs) {
      const at = new THREE.Vector3();

      // each hat is set on its head once, at rest, and belongs to the head bone from then on
      for (const [name, [radius, up, forward, tip, tall]] of Object.entries(HATS)) {
        const rig = rigs[name];
        const one = hat(0xb9814a, name === 'zara' ? 0xd6533a : C.indigoDeep);
        const facing = rig.holder.rotation.y;
        const f = number(`${name}f`, forward);

        rig.holder.updateWorldMatrix(true, true);
        rig.head.getWorldPosition(at);
        one.scale.setScalar(number(`${name}r`, radius));
        one.scale.y *= tall;
        one.position.set(at.x + Math.sin(facing) * f, at.y + number(`${name}u`, up), at.z + Math.cos(facing) * f);
        one.rotation.set(number(`${name}t`, tip), facing, 0, 'YXZ');
        scene.add(one);
        one.updateMatrixWorld(true);
        rig.head.attach(one);
        hats.push(one);
      }
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const swing = curve(back, t) * 0.7 - curve(through, t) * 1.25;

      rigs.zara.rot('LeftArm', X, swing);
      rigs.zara.rot('LeftArm', Z, Math.abs(swing) * 0.2);
      rigs.zara.rot('RightArm', X, -swing * 0.25);

      for (const { at, from, to, ball, drops, ring, patch, flash, spin } of shots) {
        const since = (((t - at) % loop) + loop) % loop;
        const u = since / FLIGHT;
        // it swells over its sender for half a second before it leaves
        const before = (((at - t) % loop) + loop) % loop;
        const grown = before < 0.55 ? 1 - before / 0.55 : 0;

        ball.visible = u < 1 || grown > 0;

        if (u < 1) {
          // a high arc: straight across, and a parabola up to 2.7 m
          const top = 2.7 - Math.max(from[1], to[1]);
          const rise = from[1] + (to[1] - from[1]) * u + 4 * top * u * (1 - u);

          ball.position.set(from[0] + (to[0] - from[0]) * u, rise, from[2] + (to[2] - from[2]) * u);
          ball.rotation.z = spin + u * 5 * Math.sign(from[0] - to[0]);
          ball.scale.set(1 + Math.sin(u * 30) * 0.06, 1 - Math.sin(u * 30) * 0.06, 1);
        } else {
          ball.position.set(from[0], from[1] + Math.sin(w * 4) * 0.02, from[2]);
          ball.rotation.z = 0;
          ball.scale.setScalar(Math.max(0.001, grown * (1 + Math.sin(grown * Math.PI) * 0.2)));
        }

        const burst = since - FLIGHT;

        for (const { one, vx, vz, vy, size } of drops) {
          const y = to[1] + vy * burst - 6.5 * burst * burst;

          one.visible = burst > 0 && y > 0;
          one.position.set(to[0] + vx * burst, y, to[2] + vz * burst + 0.05);
          one.scale.setScalar(size * (1.25 - burst * 0.4));
          one.material.opacity = Math.min(1, 1.6 - burst * 1.6);
        }

        const r = burst / 0.6;
        const f = burst / 0.4;

        flash.visible = f > 0 && f < 1;
        flash.position.set(to[0], 0.22 + f * 0.2, to[2] + 0.08);
        flash.scale.set(0.4 + f * 0.6, 0.25 + f * 0.3, 1);
        flash.material.opacity = 0.6 * (1 - f);

        ring.visible = r > 0 && r < 1;
        ring.scale.setScalar(0.3 + r * 0.9);
        ring.material.opacity = 0.85 * (1 - r);
        patch.visible = burst > 0 && burst < 3.2;
        patch.material.opacity = Math.min(1, burst / 0.15) * Math.max(0, 1 - burst / 3.2);
      }

      // the tumbleweed comes out through the swinging doors, stops in the open street, and rolls back in before the
      // first balloon bursts there; it turns as far as it travels, and the doors give way as it passes
      const wz = curve(rolling, t);
      const out = Math.max(0, Math.min(1, (wz + 2.2) / 0.5));

      weed.position.set(0, 0.22 + (1 - out) * 0.1 + Math.abs(Math.sin(w * 6)) * 0.09 * out, wz);
      weed.rotation.set(wz * 4.5, 0.4, 0.3);
      puffs.forEach((one, k) => {
        const pz = curve(rolling, t, 0.1 + k * 0.09);

        one.position.set(0, 0.1 + k * 0.025, pz);
        one.scale.setScalar(0.18 + k * 0.06);
        one.material.opacity = pz > -2.3 && Math.abs(pz - wz) > 0.02 ? 0.3 * (1 - k / 5) : 0;
      });

      const push = Math.exp(-(((wz + 2.4) / 0.4) ** 2));

      for (const { hinge, side } of bar.doors) hinge.rotation.y = side * (0.12 + Math.sin(w * 3 + side) * 0.2 - push * 1.1);

      drink.water.material.emissiveIntensity = 0.4 + Math.sin(w * 4) * 0.08;

      for (const { one, phase } of floating) {
        one.position.y = 0.72 + Math.sin(w * 3 + phase) * 0.025;
        one.rotation.z = Math.sin(w * 2 + phase) * 0.2;
      }

      for (const effect of effects) effect(t);
    },
  };
}
