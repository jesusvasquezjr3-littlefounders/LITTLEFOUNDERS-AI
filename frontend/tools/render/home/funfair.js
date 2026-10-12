// Home composition "funfair": the four mentors at a small funfair at dusk, the moment the fireworks go off behind
// the big wheel.
//
// The setting is an island: a round plaza on a drum striped like a circus tent. Far behind it, on a base of its own
// and a little hazed by the dusk, the big wheel turns slowly on its A-frame, its gondolas in the brand's colors and
// bulbs running around its rim. On the left a carousel whose riders are Seeds going up and down; on the right a
// popcorn cart with a bunch of balloons tied to it. Two short masts, on the carousel and on the cart, carry a string
// of bulbs across, over every head. Behind it all, a soft cloud of dusk (it is what lets the bulbs and the fireworks
// show on the light page too, and it fades to nothing before the frame's borders), balloons rising through it and
// the fireworks: soft round bursts. Nothing stands in the front or the middle: that is the mentors' room.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube, box } from '../home-kit.js';

const PLAZA = { radius: 3.3, z: -0.6 };
const WHEEL = { x: -0.15, z: -6.6, hub: 2.15, radius: 1.6 }; // far behind the island, on a round base of its own
const MAST = 2.8; // how high the strings of bulbs are tied, over the carousel and over the cart
const HAZE = new THREE.Color(0x5c46bc); // the dusk the far wheel is seen through
const CAROUSEL = { x: -2.8, z: -1.0, scale: 0.66 };
const CART = { x: 2.58, z: -1.2, yaw: -0.12, scale: 0.88 };
const BURST = 2.0; // the second the first firework opens
const RIDE = [C.orange, C.mint, C.gold, C.sky];
const BULBS = [0xffd36b, 0xff7aa8, 0x7fe6cf];

/** Stripes of two colors side by side, `count` pairs around a turned solid. */
const stripes = (a, b, count) => canvasTexture([count * 32, 8], (g, w, h) => {
  for (let i = 0; i < count * 2; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(i * 16, 0, 16, h);
  }
});

// ---- the plaza: warm paving with trodden confetti, on a striped drum
function plaza() {
  const group = new THREE.Group();
  const next = sequence(53);
  const R = PLAZA.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1.02, '#ffd9a8');
    ring(0.93, '#ffe9c9');

    // pavers: faint seams from the middle out, and two rings across them
    g.strokeStyle = 'rgba(214,140,80,0.2)';
    g.lineWidth = 4;

    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;

      g.beginPath();
      g.moveTo(half + Math.cos(a) * half * 0.4, half + Math.sin(a) * half * 0.4);
      g.lineTo(half + Math.cos(a) * half * 0.93, half + Math.sin(a) * half * 0.93);
      g.stroke();
    }

    for (const r of [0.58, 0.76]) { g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.stroke(); }

    ring(0.4, '#ff9fc0');
    ring(0.375, '#fff3df');
    ring(0.35, '#ffdcae');

    // confetti that has already fallen
    for (let i = 0; i < 260; i++) {
      const a = next() * TAU;
      const r = Math.sqrt(next()) * half * 0.9;

      g.fillStyle = ['#5c55fd', '#eb7301', '#05a893', '#ff6fa5', '#4b94ff', '#ffffff'][i % 6];
      g.globalAlpha = 0.75;
      g.beginPath();
      g.ellipse(half + Math.cos(a) * r, half + Math.sin(a) * r, 5 + next() * 4, 3 + next() * 3, next() * 3, 0, TAU);
      g.fill();
    }

    g.globalAlpha = 1;
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xffd9a8, 0.8), standard(0xffffff, 0.85, { map: picture }), standard(C.indigoDeep, 0.8)], 0, -0.05, 0);
  const band = stripes('#e8334a', '#fff3df', 22);
  const lip = mesh(new THREE.TorusGeometry(R - 0.02, 0.085, 14, 128), standard(0xffc46b, 0.6), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.33], [2.4, -0.32], [2.95, -0.28], [3.19, -0.19], [R - 0.04, -0.1], [R - 0.04, -0.06]], standard(0xffffff, 0.75, { map: band })));

  return group;
}

/** A color seen from far away: a little of the dusk mixed into it. */
const far = (color, amount = 0.26) => new THREE.Color(color).lerp(HAZE, amount);

// ---- a gondola: a round tub under a round roof. Its origin is the axle it hangs from.
function gondola(color) {
  const group = new THREE.Group();
  const paint = standard(far(color), 0.45);
  const cream = standard(far(C.cream), 0.5);
  const roof = sphere(0.215, paint, 0, -0.07, 0, 0.42);

  group.add(lathe([[0, -0.43], [0.13, -0.43], [0.19, -0.39], [0.21, -0.31], [0.2, -0.25], [0.17, -0.23], [0, -0.23]], paint, 0, 0, 0, 40), roof, mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 40), cream, 0, -0.245, 0));
  group.children[2].rotation.x = Math.PI / 2;

  for (const side of [-1, 1]) group.add(cylinder(0.014, 0.014, 0.17, cream, side * 0.15, -0.16, 0, 10));

  return group;
}

// ---- the big wheel, the landmark of the fair: two rims, spokes, bulbs around the front rim, eight gondolas that
// always hang straight, on an A-frame of round legs and a round base of its own. It stands far behind the island,
// its colors a little hazed by the dusk.
function wheel() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const R = WHEEL.radius;
  const rimPaint = standard(far(C.indigo), 0.4);
  const spokePaint = standard(far(0xfff6e6), 0.45);
  const white = standard(far(0xfbf7ff), 0.4);
  const gold = standard(far(0xf2bf2a), 0.3, { metalness: 0.6 });
  const bulbs = BULBS.map((color) => lit(color, 2.2));
  const gondolas = [];

  spin.position.y = WHEEL.hub;

  for (const z of [-0.22, 0.22]) {
    spin.add(mesh(new THREE.TorusGeometry(R, 0.04, 12, 128), rimPaint, 0, 0, z), mesh(new THREE.TorusGeometry(R * 0.5, 0.024, 10, 96), spokePaint, 0, 0, z));

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      const spoke = cylinder(0.02, 0.02, R, spokePaint, Math.cos(a) * R / 2, Math.sin(a) * R / 2, z, 10);

      spoke.rotation.z = a - Math.PI / 2;
      spin.add(spoke);
    }
  }

  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) / 24) * TAU;
    const bulb = sphere(0.06, bulbs[i % 3], Math.cos(a) * R, Math.sin(a) * R, 0.27);

    spin.add(bulb);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const axle = cylinder(0.022, 0.022, 0.46, gold, Math.cos(a) * R, Math.sin(a) * R, 0, 12);
    const car = gondola(RIDE[i % 4]);

    axle.rotation.x = Math.PI / 2;
    car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    spin.add(axle, car);
    gondolas.push(car);
  }

  // the hub, and the A-frame that carries it: two round legs in front of the wheel and two behind
  const hub = cylinder(0.2, 0.2, 1.1, gold, 0, WHEEL.hub, 0, 40);
  const eye = sphere(0.14, lit(0xffe6a3, 1.8), 0, WHEEL.hub, 0.57, 1);

  hub.rotation.x = Math.PI / 2;
  eye.scale.z = 0.5;
  group.add(spin, hub, eye);

  for (const z of [-0.48, 0.48]) {
    for (const side of [-1, 1]) group.add(tube([[side * 1.2, 0.04, z * 1.2], [side * 0.6, WHEEL.hub * 0.5, z * 1.1], [0, WHEEL.hub, z]], 0.065, white, 24), sphere(0.14, rimPaint, side * 1.2, 0.05, z * 1.2, 0.6));
  }

  // its own round base, striped like the island's drum
  group.add(lathe([[0, -0.3], [1.5, -0.3], [1.85, -0.22], [1.95, -0.1], [1.95, -0.03], [1.88, 0], [0, 0]], standard(far(0xff9fc0), 0.8)));
  group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });

  return { group, spin, gondolas, bulbs };
}

// ---- the carousel: a round floor, a striped roof, and four Seeds that ride up and down on golden poles
function carousel() {
  const group = new THREE.Group();
  const turn = new THREE.Group();
  const gold = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const cream = standard(0xfff3df, 0.5);
  const roofPicture = stripes('#ff6fa5', '#fff3df', 8);
  const riders = [];

  group.add(lathe([[0, 0], [0.66, 0], [0.7, 0.05], [0.7, 0.11], [0.66, 0.16], [0, 0.16]], standard(C.indigo, 0.5)), mesh(new THREE.TorusGeometry(0.69, 0.03, 10, 64), gold, 0, 0.16, 0));
  group.children[1].rotation.x = Math.PI / 2;

  turn.add(
    lathe([[0, 0.16], [0.17, 0.16], [0.13, 0.26], [0.11, 1.5], [0.2, 1.62], [0, 1.62]], cream, 0, 0, 0, 32),
    lathe([[0.8, 1.56], [0.84, 1.62], [0.8, 1.7], [0.55, 1.88], [0.28, 2.06], [0.1, 2.16], [0, 2.18]], standard(0xffffff, 0.6, { map: roofPicture })),
    cylinder(0.8, 0.8, 0.03, cream, 0, 1.57, 0, 64),
    sphere(0.085, gold, 0, 2.23, 0),
  );

  // a scalloped edge of bulbs under the roof
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const bulb = sphere(0.05, i % 2 ? lit(0xffe6a3, 2.2) : gold, Math.cos(a) * 0.82, 1.55, Math.sin(a) * 0.82);

    bulb.castShadow = false;
    turn.add(bulb);
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5;
    const seed = seedMesh(0.5);

    turn.add(cylinder(0.016, 0.016, 1.42, gold, Math.cos(a) * 0.47, 0.87, Math.sin(a) * 0.47, 10));
    seed.position.set(Math.cos(a) * 0.47, 0.8, Math.sin(a) * 0.47);
    seed.rotation.y = -a + Math.PI / 2;
    turn.add(seed);
    riders.push({ seed, up: i % 2 });
  }

  group.add(turn);

  return { group, turn, riders };
}

// ---- a balloon: its origin is the knot, the string hangs under it
function balloon(color, radius = 0.17, string = 0) {
  const group = new THREE.Group();
  const skin = standard(color, 0.22, { transparent: true });
  const body = sphere(radius, skin, 0, radius * 1.18, 0, 1.18);
  const shine = sprite(TEXTURES.dot, 0xffffff, 9);

  shine.scale.set(radius * 0.5, radius * 0.7, 1);
  shine.position.set(-radius * 0.4, radius * 1.55, radius * 0.8);
  shine.material.opacity = 0.7;
  group.add(body, sphere(radius * 0.16, skin, 0, 0, 0, 0.8), shine);

  if (string) {
    const cord = tube([[0, 0, 0], [0.03, -string * 0.35, 0], [-0.03, -string * 0.7, 0], [0, -string, 0]], 0.006, new THREE.MeshBasicMaterial({ color: 0xfff6e6, transparent: true }), 16);

    cord.castShadow = false;
    group.add(cord);
  }

  return { group, skin, shine };
}

// ---- the popcorn cart: a round body on two wheels, and a glass box of popcorn under a striped hood
function cart() {
  const group = new THREE.Group();
  const red = standard(0xe8334a, 0.45);
  const cream = standard(0xfff3df, 0.5);
  const gold = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const next = sequence(19);
  const hood = stripes('#05a893', '#fff3df', 7);
  const corn = [standard(0xfff1c4, 0.8), standard(0xffe08a, 0.8)];

  group.add(box(1.0, 0.5, 0.6, red, 0, 0.62, 0, 0.16), box(1.06, 0.07, 0.66, cream, 0, 0.89, 0, 0.035), box(0.9, 0.1, 0.5, cream, 0, 0.42, 0, 0.05));

  for (const side of [-1, 1]) {
    const tyre = mesh(new THREE.TorusGeometry(0.25, 0.045, 12, 48), standard(C.ink, 0.6), side * 0.3, 0.3, 0.36);
    const disc = cylinder(0.22, 0.22, 0.05, cream, side * 0.3, 0.3, 0.36, 32);

    disc.rotation.x = Math.PI / 2;
    group.add(tyre, disc, sphere(0.06, gold, side * 0.3, 0.3, 0.4, 1));
  }

  // a Seed painted on its front, in relief
  const badge = seedMesh(0.3);

  badge.position.set(0, 0.63, 0.31);
  badge.scale.z *= 0.5;
  badge.castShadow = false;
  group.add(badge);

  // the glass box, its four round posts, the popcorn inside and the striped hood
  const pane = box(0.84, 0.5, 0.46, new THREE.MeshStandardMaterial({ color: 0xdff0ff, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false }), 0, 1.17, 0, 0.06);

  pane.castShadow = false;
  pane.renderOrder = 6;
  group.add(pane);

  for (const [x, z] of [[-0.42, -0.23], [0.42, -0.23], [-0.42, 0.23], [0.42, 0.23]]) group.add(cylinder(0.018, 0.018, 0.52, gold, x, 1.17, z, 10));

  for (let i = 0; i < 46; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(next()) * 0.3;
    const kernel = sphere(0.045 + next() * 0.02, corn[i % 2], Math.cos(a) * r * 1.2, 0.95 + (1 - r / 0.3) * 0.22 * next() + 0.02, Math.sin(a) * r * 0.6, 0.85);

    kernel.castShadow = false;
    group.add(kernel);
  }

  const roof = mesh(new THREE.SphereGeometry(0.56, 48, 20, 0, TAU, 0, Math.PI / 2), standard(0xffffff, 0.6, { map: hood }), 0, 1.42, 0);

  roof.scale.set(1, 0.55, 0.66);
  group.add(roof, box(1.14, 0.07, 0.76, cream, 0, 1.43, 0, 0.035), sphere(0.06, gold, 0, 1.76, 0));

  // the handle the balloons are tied to
  group.add(tube([[0.5, 0.8, 0], [0.66, 0.84, 0], [0.74, 0.98, 0], [0.74, 1.08, 0]], 0.022, gold, 16), sphere(0.045, gold, 0.74, 1.1, 0));

  return group;
}

/** A string of bulbs hanging between two points, sagging by `sag` in its middle. The bulbs share `materials`, in turn. */
function garland(from, to, sag, materials, every = 0.3) {
  const group = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const at = (u) => a.clone().lerp(b, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u), 0));
  const cord = tube(Array.from({ length: 13 }, (_, i) => at(i / 12).toArray()), 0.011, standard(C.slate, 0.7), 48);
  const count = Math.max(3, Math.round(a.distanceTo(b) / every));

  cord.castShadow = false;
  group.add(cord);

  for (let i = 1; i < count; i++) {
    const p = at(i / count);
    const bulb = sphere(0.055, materials[i % materials.length], p.x, p.y - 0.06, p.z, 1.15);

    bulb.castShadow = false;
    group.add(bulb);
  }

  return group;
}

// ---- far behind: the cloud of dusk
function dusk() {
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(52,38,150,0.94)');
    deep.addColorStop(0.5, 'rgba(66,46,168,0.82)');
    deep.addColorStop(0.8, 'rgba(110,72,200,0.3)');
    deep.addColorStop(1, 'rgba(110,72,200,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // the last of the sunset low in it, and a cooler patch high on the other side
    for (const [x, y, r, color, alpha] of [[0.5, 0.66, 0.36, '255,120,150', 0.5], [0.3, 0.6, 0.24, '255,170,90', 0.34], [0.7, 0.36, 0.26, '75,148,255', 0.22]]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},${alpha})`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);

  cloud.position.set(0, 1.75, -8);
  cloud.scale.set(10.6, 6.3, 1);

  return cloud;
}

/** A firework: a trail that climbs to `y`, then a soft round burst of dots that opens, sinks a little and fades. It opens at every second in `at`. */
function firework(fx, { x, y, z, radius, colors, at, seed }) {
  const next = sequence(seed);
  const glow = halo(radius * 1.1, colors[0], 0);
  const trail = sprite(TEXTURES.dot, 0xfff1c4, 2);
  const dots = [];

  glow.position.set(x, y, z - 0.05);
  glow.renderOrder = 1;
  fx.add(glow, trail);

  // three rings of dots, the outer one the largest
  for (const [k, [count, reach, size]] of [[18, 1, 0.24], [12, 0.64, 0.19], [6, 0.3, 0.15]].entries()) {
    for (let i = 0; i < count; i++) {
      const dot = sprite(TEXTURES.dot, colors[k % colors.length], 2);

      fx.add(dot);
      dots.push({ dot, a: ((i + k * 0.5) / count + next() * 0.015) * TAU, reach: reach * (0.94 + next() * 0.1), size: size * radius * (0.9 + next() * 0.25) });
    }
  }

  const LASTS = 1.9;
  const CLIMB = 0.55;

  return (t) => {
    let since = -9;

    for (const second of at) if (t - second > -CLIMB && t - second < LASTS) since = t - second;

    const climbing = since > -CLIMB && since < 0;
    const open = since >= 0;
    const u = Math.max(0, since / LASTS);
    const out = 1 - (1 - Math.min(1, u * 2.2)) ** 3;
    const fade = u < 0.08 ? u / 0.08 : Math.max(0, 1 - (u - 0.08) / 0.92) ** 1.3;

    trail.visible = climbing;

    if (climbing) {
      const c = 1 + since / CLIMB;

      trail.position.set(x, y - (1 - c) * 1.5, z);
      trail.scale.set(0.07, 0.3, 1);
      trail.material.opacity = Math.sin(c * Math.PI * 0.9) * 0.9;
    }

    glow.material.opacity = open ? fade * 0.62 : 0;
    glow.scale.setScalar(radius * 2.2 * (0.5 + out * 0.6));

    for (const { dot, a, reach, size } of dots) {
      dot.visible = open;
      dot.position.set(x + Math.cos(a) * radius * reach * out, y + Math.sin(a) * radius * reach * out - u * u * 0.22, z);
      dot.scale.setScalar(size * (1.15 - u * 0.5));
      dot.material.opacity = fade;
    }
  };
}

export function build(scene, { loop, heights, jump, tuck, curve, Z, X }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const big = wheel();
  const ride = carousel();
  const chain = BULBS.map((color) => lit(color, 2.2));

  ride.group.scale.setScalar(CAROUSEL.scale);

  set.add(place(plaza(), 0, PLAZA.z), shadowCatcher(PLAZA.radius - 0.1, 0.008, PLAZA.z, 0.32));

  // the island's own soft shadow on the page, fading to nothing well inside the frame
  set.add(decal(radial([[0, 'rgba(60,50,170,0.3)'], [0.6, 'rgba(60,50,170,0.15)'], [0.86, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.5, PLAZA.z, 4.0, 3.6, 0));
  set.add(dusk(), place(big.group, WHEEL.x, WHEEL.z), place(ride.group, CAROUSEL.x, CAROUSEL.z));

  const popcorn = cart();

  popcorn.scale.setScalar(CART.scale);
  set.add(place(popcorn, CART.x, CART.z, CART.yaw));

  // a string of bulbs from a short mast on the carousel's top to one on the cart's, high over every head
  const masts = [[CAROUSEL.x, 2.2 * CAROUSEL.scale, CAROUSEL.z], [CART.x, 1.74 * CART.scale, CART.z]];
  const brass = standard(0xf2bf2a, 0.3, { metalness: 0.6 });

  for (const [x, y, z] of masts) set.add(cylinder(0.026, 0.032, MAST - y, standard(0xfff3df, 0.5), x, (MAST + y) / 2, z, 12), sphere(0.07, brass, x, MAST + 0.04, z));

  set.add(garland([masts[0][0], MAST, masts[0][2]], [masts[1][0], MAST, masts[1][2]], 0.36, chain, 0.28));

  // the balloons tied to the cart's handle: each on its own string from the same knot
  const knot = new THREE.Vector3(0.74, 1.1, 0).multiplyScalar(CART.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), CART.yaw).add(new THREE.Vector3(CART.x, 0, CART.z));
  const bunch = new THREE.Group();

  bunch.position.copy(knot);
  [[0.02, 1.06, 0, C.indigo], [-0.25, 0.86, 0.05, C.orange], [0.27, 0.82, -0.04, C.pink], [-0.13, 1.32, -0.06, C.mint], [0.17, 1.28, 0.06, C.gold]].forEach(([x, y, z, color]) => {
    const one = balloon(color, 0.165);
    const cord = tube([[0, 0, 0], [x * 0.3, y * 0.5, z * 0.5], [x, y, z]], 0.006, standard(0xfff6e6, 0.6), 12);

    cord.castShadow = false;
    one.group.position.set(x, y, z);
    one.group.rotation.z = -x * 0.5;
    bunch.add(cord, one.group);
  });
  set.add(bunch);

  // real lights: the carousel and the cart each glow warm
  for (const [x, y, z, color, power] of [[CAROUSEL.x + 0.3, 1.2, CAROUSEL.z + 1.0, 0xffc9d9, 4], [CART.x - 0.3, 1.3, CART.z + 0.9, 0xffe0a0, 4]]) {
    const light = new THREE.PointLight(color, power, 5, 1.8);

    light.position.set(x, y, z);
    set.add(light);
  }

  const cast = {
    // Liruf is all for the carousel beside him until the first firework opens over it, and jumps the highest
    liruf: { x: -1.44, z: 0.0, yaw: 0.3, act: {
      hop: jump(2.25, 0.3), tuck: tuck(2.25, 0.9), lean: [[0, 0.06], [2.25, -0.16], [2.9, 0.08], [3.6, 0.06], [L, 0.06]],
      yaw: [[0, -0.55], [1.5, -0.55], [2.25, -0.2], [4.4, -0.2], [5.6, -0.55], [L, -0.55]], pitch: [[0, -0.05], [1.5, -0.05], [2.25, -0.4], [3.4, -0.3], [4.6, -0.05], [L, -0.05]],
      roll: [[0, -0.14], [2.25, 0.12], [4.2, -0.14], [L, -0.14]], tilt: [[0, 0], [2.25, -0.1], [3, 0], [L, 0]],
    } },
    // Zara points the first firework out with one arm (turned in `update`), then waves the reader over
    zara: { x: -0.68, z: 0.42, yaw: 0.1, act: {
      hop: jump(2.1, 0.16), tuck: tuck(2.1, 0.5), lean: [[0, 0], [2.1, -0.12], [3, -0.04], [L, 0]],
      yaw: [[0, 0], [1.6, 0], [2.2, -0.42], [3.6, -0.42], [4.4, 0], [L, 0]], pitch: [[0, -0.06], [1.6, -0.06], [2.2, -0.3], [3.6, -0.3], [4.4, -0.06], [L, -0.06]],
      roll: [[0, 0.08], [2.2, -0.1], [4.4, 0], [5.2, 0.14], [6.7, 0.14], [7.4, 0.08], [L, 0.08]], wave: [[0, 0], [4.6, 0], [5.2, 1], [6.6, 1], [7.3, 0], [L, 0]],
    } },
    // Rho bounces to the music of the carousel, and throws his head back for the fireworks a beat later
    rho: { x: 0.36, z: 0.45, yaw: -0.1, act: {
      hop: [[0, 0], [0.5, 0.05], [1, 0], [1.6, 0], [1.85, -0.035], [2.45, 0.19], [2.75, -0.03], [2.95, 0], [5, 0], [5.5, 0.06], [6, 0], [6.5, 0.05], [7, 0], [L, 0]],
      tuck: tuck(2.45, 0.7), lean: [[0, -0.03], [2.45, -0.18], [2.9, 0.06], [3.6, -0.03], [L, -0.03]],
      pitch: [[0, -0.08], [1.8, -0.08], [2.45, -0.4], [3.8, -0.32], [4.8, -0.08], [L, -0.08]], yaw: [[0, 0.1], [1.8, 0.1], [2.45, 0.34], [4, 0.34], [5, 0.1], [L, 0.1]],
      roll: [[0, 0.1], [2.45, -0.12], [4.2, 0.1], [L, 0.1]], tilt: [[0, 0], [2.45, 0.08], [3.2, 0], [L, 0]],
    } },
    // Dina has her nose in the air, after the smell of popcorn, and rears up when the sky goes off
    dina: { x: 1.24, z: 0.05, yaw: -0.2, act: {
      hop: jump(2.65, 0.12), rear: [[0, 0], [2.15, 0], [2.65, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.18], [0.8, -0.26], [1.6, -0.18], [2.65, -0.42], [3.5, -0.3], [4.6, -0.18], [5.6, -0.26], [6.6, -0.18], [L, -0.18]],
      roll: [[0, 0.2], [2.65, -0.1], [4.4, 0.2], [L, 0.2]], yaw: [[0, 0.4], [1.7, 0.4], [2.65, 0.1], [4.4, 0.1], [5.6, 0.4], [L, 0.4]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], clear: name === 'dina' ? 0.8 : 0.5, peak: { liruf: 2.25, zara: 2.1, rho: 2.45, dina: 2.65 }[name] }));
  // Zara's right arm, toward the burst on the reader's left
  const pointing = [[0, 0], [1.6, 0], [2.15, 1], [3.5, 1], [4.2, 0], [L, 0]];

  // balloons that got away, rising through the dusk well behind everything, at the sides where the sky is clear
  const next = sequence(29);
  const loose = [[-4.15, -5.2, C.pink, 0.2, 2.5], [3.7, -5.0, C.sky, 0.1, 2.95], [-3.9, -5.6, C.gold, 0.7, 2.6]].map(([x, z, color, start, from]) => {
    const one = balloon(color, 0.2, 0.55);

    one.group.traverse((o) => { o.castShadow = false; });
    fx.add(one.group);

    return { ...one, x, z, start, from, phase: next() * TAU };
  });
  const effects = [
    sparkles(fx, { loop, actors, each: 6 }),
    landings(fx, { actors, color: 0xfff0d8 }),
    firework(fx, { x: -3.25, y: 3.3, z: -7.4, radius: 0.9, colors: [0xff9a1f, 0xff4f93], at: [BURST, BURST + 4], seed: 3 }),
    firework(fx, { x: 3.2, y: 3.3, z: -7.4, radius: 0.74, colors: [0xff5f9e, 0x6fc4ff], at: [BURST + 0.15, BURST + 3.3], seed: 5 }),
    firework(fx, { x: 2.3, y: 3.95, z: -7.4, radius: 0.5, colors: [0x5fe6cf, 0xffe08a], at: [BURST + 1.0, BURST + 4.6], seed: 7 }),
    firework(fx, { x: -2.3, y: 4.0, z: -7.4, radius: 0.46, colors: [0x9f9aff, 0xffffff], at: [BURST + 1.45, BURST + 5.2], seed: 9 }),
    // popcorn jumping in the cart
    rising(fx, { loop, at: { x: CART.x, y: 0.92, z: CART.z }, radius: 0.22, height: 0.38, count: 12, color: [0xfff1c4, 0xffe08a], size: [0.05, 0.08], seed: 4, sway: 0.02 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.4,
    camera: { y: 2.3, dist: 14.6, lookY: 1.33 },
    update(t, rigs) {
      const w = (t / loop) * TAU;

      // the wheel: a quarter turn in a loop (its gondolas repeat every quarter), the gondolas always hanging straight
      big.spin.rotation.z = -w / 4;

      for (const [i, car] of big.gondolas.entries()) car.rotation.z = w / 4 + Math.sin(w * 2 + i) * 0.05;

      // the bulbs run around the rim and along the strings
      big.bulbs.forEach((bulb, i) => { bulb.emissiveIntensity = 1.1 + 1.5 * Math.max(0, Math.sin(w * 4 - (i / 3) * TAU)); });
      chain.forEach((bulb, i) => { bulb.emissiveIntensity = 1.3 + 1.3 * Math.max(0, Math.sin(w * 3 + (i / 3) * TAU)); });

      // the carousel: half a turn in a loop, its Seeds going up and down in turn
      ride.turn.rotation.y = w / 2;

      for (const { seed, up } of ride.riders) seed.position.y = 0.82 + Math.sin(w * 2 + up * Math.PI) * 0.16;

      bunch.rotation.z = Math.sin(w) * 0.05;
      bunch.rotation.x = Math.sin(w * 2 + 1) * 0.03;

      for (const { group, skin, shine, x, z, start, from, phase } of loose) {
        const rise = (start + t / loop) % 1;
        const show = Math.sin(rise * Math.PI) ** 0.6;

        group.position.set(x + Math.sin(w + phase) * 0.1, from + rise * (3.72 - from), z);
        group.rotation.z = Math.sin(w * 2 + phase) * 0.12;
        skin.opacity = show;
        shine.material.opacity = show * 0.7;
        group.children[3].material.opacity = show;
      }

      const point = curve(pointing, t);

      // Zara's arm goes up and a little forward, the hand open toward the burst. On its way up and down it swings
      // through the front, never out to the side, where Liruf stands
      rigs.zara.rot('RightArm', X, -point * 0.6 - Math.sin(point * Math.PI) * 1.1);
      rigs.zara.rot('RightArm', Z, -point * 2.2);
      rigs.zara.rot('RightForeArm', X, -point * 0.6);

      for (const effect of effects) effect(t);
    },
  };
}
