// Home composition "timetravel": the four mentors have just arrived from another time. Their time machine, a small
// round silver car, has drawn an arc of light around them and stopped, and the portal it came through is still
// open behind them.
//
// The setting is an island: a round square of blue cobbles. At the back floats the portal, which is also a great
// clock: a golden ring with twelve round studs and no numerals, two hands that spin, and a whirl of light inside.
// Gears and small alarm clocks float out of it to both sides. The car is parked on the left, whole and in the
// clear, at the end of its own two trails of fire-colored light, seen from behind: a glass dome, two rings of light
// around its tail, a round dish on its roof.
// It is a car of our own, round everywhere, and resembles none from a film. Nothing stands in the front or the
// middle: that is the mentors' room, and the trails are only light on the cobbles.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES } from '../home-kit.js';

const SQUARE = { radius: 3.3, z: -0.6 };
const PORTAL = { x: 0.6, y: 2.64, z: -2.95, radius: 1.0 };
// the arc the car drove: its middle, its radius, half the distance between the wheels, and how much of a turn it is
const TRACK = { x: 0.15, z: -0.55, radius: 2.45, gauge: 0.48, span: 0.43 };
const CAR = { at: Math.PI + 0.22, scale: 1 }; // where on the circle it stopped, in radians from the circle's right through its front
const ARRIVE = 2.0; // the second the portal flashes

// ---- the square: rings of round cobbles, a pale lip, rock underneath
function square() {
  const group = new THREE.Group();
  const next = sequence(61);
  const R = SQUARE.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;

    g.fillStyle = '#6a75b2';
    g.fillRect(0, 0, w, w);
    g.lineCap = 'round';

    // each ring of cobbles is a ring of short round strokes, every stone a shade of its own
    for (let ring = 1; ring <= 13; ring++) {
      const r = (ring / 13.4) * half;
      const count = Math.max(6, Math.round(ring * 5.6));
      const start = next() * TAU;

      g.lineWidth = half / 13.4 - 12;

      for (let i = 0; i < count; i++) {
        const a = start + (i / count) * TAU;
        const gap = 0.13 / ring + 0.035;

        g.strokeStyle = ['#838dc6', '#7b86c0', '#8a94cc', '#808ac4', '#7681bc'][Math.floor(next() * 5)];
        g.beginPath();
        g.arc(half, half, r, a + gap, a + TAU / count - gap);
        g.stroke();
      }
    }

    g.fillStyle = '#8f98cc';
    g.beginPath();
    g.arc(half, half, half / 13.4 * 0.55, 0, TAU);
    g.fill();
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xaab2dc, 0.8), standard(0xffffff, 0.85, { map: picture }), standard(C.stoneDark, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.02, 0.085, 14, 128), standard(0xb7bee6, 0.8), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.42], [1.2, -0.4], [2.2, -0.32], [2.9, -0.2], [R - 0.05, -0.1]], standard(0x8a90bc, 0.95)));

  return group;
}

/** A ring lying on the cobbles whose picture runs around it: `u` goes once around, from the island's right through its front. */
function around(inner, outer, picture, y) {
  const geometry = new THREE.RingGeometry(inner, outer, 160, 1);
  const uv = geometry.attributes.uv;
  const at = geometry.attributes.position;

  for (let i = 0; i < uv.count; i++) {
    // the ring is laid flat by turning it about x, which sends its own +y to the back of the island
    const a = Math.atan2(-at.getY(i), at.getX(i));

    uv.setXY(i, (((a / TAU) % 1) + 1) % 1, (Math.hypot(at.getX(i), at.getY(i)) - inner) / (outer - inner));
  }

  const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: picture, transparent: true, depthWrite: false, toneMapped: false }));

  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  ring.renderOrder = 3;

  return ring;
}

// ---- the trails the car's wheels left: two arcs of light the color of fire, brightest behind the car and fainter
// the older they are
function trails() {
  const group = new THREE.Group();
  /** A picture that fades along the circle (from the car, backward along its path) and across the trail. */
  const light = (core) => canvasTexture([1024, 32], (g, w, h) => {
    for (let x = 0; x < w; x++) {
      // the car came round through the front, its angle growing: `age` is 0 right behind it and 1 a whole turn back
      const age = ((CAR.at - (x / w) * TAU + TAU * 2) % TAU) / TAU;
      // the trails begin in the front right, where the car came out of nowhere, well clear of where Dina stands
      const along = (age < 0.015 ? age / 0.015 : 0.55 + 0.45 * (1 - age) ** 1.5) * Math.max(0, Math.min(1, (TRACK.span - age) / 0.12));
      const across = g.createLinearGradient(0, 0, 0, h);

      if (core) {
        across.addColorStop(0, 'rgba(255,214,90,0)');
        across.addColorStop(0.3, `rgba(255,222,110,${along})`);
        across.addColorStop(0.5, `rgba(255,252,226,${along})`);
        across.addColorStop(0.7, `rgba(255,222,110,${along})`);
        across.addColorStop(1, 'rgba(255,214,90,0)');
      } else {
        across.addColorStop(0, 'rgba(255,120,60,0)');
        across.addColorStop(0.5, `rgba(255,128,56,${along * 0.8})`);
        across.addColorStop(1, 'rgba(255,120,60,0)');
      }

      g.fillStyle = across;
      g.fillRect(x, 0, 1, h);
    }
  });

  for (const side of [-1, 1]) {
    const r = TRACK.radius + side * TRACK.gauge;

    group.add(around(r - 0.3, r + 0.3, light(false), 0.011), around(r - 0.13, r + 0.13, light(true), 0.013));
  }

  return group;
}

/** A gear with round teeth, facing the reader. */
function gear(radius, material, teeth = 9) {
  const group = new THREE.Group();

  group.add(mesh(new THREE.TorusGeometry(radius, radius * 0.24, 14, 48), material), mesh(new THREE.TorusGeometry(radius * 0.3, radius * 0.13, 12, 32), material));

  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;

    group.add(sphere(radius * 0.21, material, Math.cos(a) * radius * 1.24, Math.sin(a) * radius * 1.24, 0));
  }

  for (let i = 0; i < 3; i++) {
    const spoke = cylinder(radius * 0.085, radius * 0.085, radius * 1.9, material, 0, 0, 0, 10);

    spoke.rotation.z = (i / 3) * Math.PI;
    group.add(spoke);
  }

  return group;
}

/** A small alarm clock with two round bells and no numerals, facing the reader. Its hands turn about their own ends. */
function alarmClock(radius, color) {
  const group = new THREE.Group();
  const paint = standard(color, 0.4);
  const ink = standard(C.ink, 0.5);
  const gold = standard(0xf2bf2a, 0.3, { metalness: 0.6 });
  const body = lathe([[0, 0], [radius * 0.92, 0], [radius, radius * 0.07], [radius, radius * 0.37], [radius * 0.92, radius * 0.44], [0, radius * 0.44]], paint, 0, 0, 0, 48);
  const face = mesh(new THREE.CircleGeometry(radius * 0.8, 48), standard(0xfffaf0, 0.6), 0, 0, radius * 0.225);
  const hands = [[0.56, 0.11], [0.38, 0.13]].map(([length, width], i) => {
    const hand = new THREE.Group();

    hand.add(box(radius * width, radius * length, radius * 0.05, ink, 0, radius * length * 0.42, 0, radius * 0.05));
    hand.position.z = radius * (0.25 + i * 0.03);
    group.add(hand);

    return hand;
  });

  body.rotation.x = Math.PI / 2;
  body.position.z = -radius * 0.22;
  face.castShadow = false;
  group.add(body, face, sphere(radius * 0.09, gold, 0, 0, radius * 0.31));

  for (let i = 0; i < 4; i++) group.add(sphere(radius * 0.06, ink, Math.sin((i / 4) * TAU) * radius * 0.66, Math.cos((i / 4) * TAU) * radius * 0.66, radius * 0.23, 1));

  for (const side of [-1, 1]) group.add(sphere(radius * 0.36, gold, side * radius * 0.62, radius * 0.92, 0, 0.8), sphere(radius * 0.16, paint, side * radius * 0.6, -radius * 1.02, 0));

  group.add(sphere(radius * 0.13, gold, 0, radius * 1.16, 0));

  return { group, hands };
}

// ---- the portal: a great clock with a whirl of light where its face would be
function portal() {
  const group = new THREE.Group();
  const R = PORTAL.radius;
  const gold = standard(0xf2bf2a, 0.25, { metalness: 0.7, emissive: 0x7a5200, emissiveIntensity: 0.35 });
  /** A whirl: arms that wind out from the middle, over a round glow when `glow` is given. */
  const whirl = (arms, color, width, glow) => canvasTexture([1024, 1024], (g, w) => {
    const half = w / 2;

    if (glow) {
      const fill = g.createRadialGradient(half, half, 0, half, half, half);

      for (const [at, stop] of glow) fill.addColorStop(at, stop);

      g.fillStyle = fill;
      g.fillRect(0, 0, w, w);
    }

    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = color;

    for (let k = 0; k < arms; k++) {
      // each arm is drawn in pieces, wider toward the rim
      for (let i = 0; i < 240; i++) {
        const [u0, u1] = [i / 240, (i + 2) / 240];
        const at = (u) => [half + Math.cos((k / arms) * TAU + u * 4.6) * u * half * 0.96, half + Math.sin((k / arms) * TAU + u * 4.6) * u * half * 0.96];

        g.lineWidth = width * (0.3 + u0 * 1.2);
        g.beginPath();
        g.moveTo(...at(u0));
        g.lineTo(...at(u1));
        g.stroke();
      }
    }

    // nothing at the rim: the whirl has no edge of its own
    const mask = g.createRadialGradient(half, half, 0, half, half, half);

    mask.addColorStop(0, '#fff');
    mask.addColorStop(0.86, '#fff');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = mask;
    g.fillRect(0, 0, w, w);
  });
  const layer = (picture, z, order) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 96), new THREE.MeshBasicMaterial({ map: picture, transparent: true, depthWrite: false, toneMapped: false }));

    disc.position.z = z;
    disc.renderOrder = order;
    group.add(disc);

    return disc;
  };
  const deep = layer(whirl(5, 'rgba(255,255,255,0.5)', 30, [[0, '#ffffff'], [0.16, '#d9fbff'], [0.42, '#59c8ff'], [0.72, '#6a5cff'], [1, '#4a2fc0']]), -0.04, 1);
  const veil = layer(whirl(3, 'rgba(255,150,205,0.6)', 22), -0.02, 2);
  const glow = halo(R * 1.75, 0x7fd8ff, 0.5);
  const hands = [[1.0, 0.11], [0.66, 0.14]].map(([length, width], i) => {
    const hand = new THREE.Group();

    hand.add(box(width, length, 0.05, standard(C.ink, 0.45), 0, length * 0.4, 0, 0.05), sphere(width * 0.62, standard(C.ink, 0.45), 0, length * 0.9, 0, 1));
    hand.position.z = 0.06 + i * 0.05;
    group.add(hand);

    return hand;
  });
  const hub = seedMesh(0.3);

  glow.position.z = -0.3;
  glow.renderOrder = 0;
  // the hands turn on a golden Seed
  hub.material = standard(0xf2bf2a, 0.28, { metalness: 0.7, emissive: 0x7a5200, emissiveIntensity: 0.5 });
  hub.position.z = 0.18;
  hub.castShadow = false;
  group.add(glow, mesh(new THREE.TorusGeometry(R, 0.1, 20, 128), gold), hub);

  // twelve round studs where the hours are, the four quarters larger and lit
  const studs = lit(0xfff1c4, 1.6);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const stud = sphere(i % 3 ? 0.055 : 0.085, i % 3 ? gold : studs, Math.cos(a) * R, Math.sin(a) * R, 0.09, 1);

    stud.castShadow = false;
    group.add(stud);
  }

  return { group, deep, veil, glow, hands, studs };
}

// ---- the time machine: a round silver car with a glass dome, rings of light around its tail and a dish on its roof.
// It is built looking along +z; what the reader sees is its tail.
function car() {
  const group = new THREE.Group();
  const silver = standard(0xd3d9ee, 0.34, { metalness: 0.55 });
  const dark = standard(C.slate, 0.5, { metalness: 0.2 });
  const body = sphere(1, silver, 0, 0.56, 0);
  const belly = sphere(1, dark, 0, 0.36, 0);
  const dome = sphere(0.43, new THREE.MeshStandardMaterial({ color: 0x6fd0ff, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }), 0, 0.86, 0.12);
  const belt = new THREE.TorusGeometry(1, 0.045, 12, 96);
  const shine = sprite(TEXTURES.dot, 0xffffff, 10);

  body.scale.set(0.56, 0.36, 0.98);
  belly.scale.set(0.5, 0.2, 0.9);
  dome.scale.set(1, 0.9, 1.15);
  dome.castShadow = false;
  dome.renderOrder = 6;
  shine.scale.set(0.22, 0.1, 1);
  shine.material.rotation = 0.6;
  shine.material.opacity = 0.85;
  shine.position.set(-0.2, 1.08, -0.2);
  // an orange belt around its middle
  belt.rotateX(Math.PI / 2);

  const stripe = mesh(belt, standard(C.orange, 0.4), 0, 0.45, 0);

  stripe.scale.set(0.555, 1, 0.975);
  group.add(stripe, body, belly, dome, shine, sphere(0.15, standard(C.indigo, 0.6), -0.19, 0.84, 0.0), sphere(0.15, standard(C.indigo, 0.6), 0.19, 0.84, 0.0));

  // four round wheels, a ring of light in each
  for (const [x, z] of [[-0.5, -0.58], [0.5, -0.58], [-0.5, 0.58], [0.5, 0.58]]) {
    const wheel = new THREE.Group();

    wheel.add(mesh(new THREE.TorusGeometry(0.15, 0.08, 14, 40), standard(C.ink, 0.7)), cylinder(0.13, 0.13, 0.13, silver, 0, 0, 0, 32), mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 32), lit(0x7fe8ff, 2.2), 0, 0, Math.sign(x) * 0.07));
    wheel.children[1].rotation.x = Math.PI / 2;
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 0.23, z);
    group.add(wheel);
  }

  // the rings of light around its tail, one inside the other, and a smaller one around its nose
  const rings = [[-0.56, 0.6, 0.47], [-0.82, 0.47, 0.37], [0.74, 0.47, 0.36]].map(([z, rx, ry], i) => {
    const ring = mesh(new THREE.TorusGeometry(1, 0.032 / rx, 12, 96), lit(i < 2 ? 0x6fe6ff : 0xffd36b, 2), 0, 0.56, z);

    ring.scale.set(rx, ry, rx);
    ring.castShadow = false;
    group.add(ring);

    return ring;
  });

  // the dish on its roof, on a bent stalk, looking up and back, with a bead of light at its middle
  const dish = new THREE.Group();
  const bead = sphere(0.05, lit(0xff9a3d, 2.4), 0, 0.17, 0);

  bead.castShadow = false;
  dish.add(lathe([[0, 0], [0.1, 0.008], [0.2, 0.04], [0.27, 0.1], [0.29, 0.13], [0.26, 0.12], [0.19, 0.07], [0.1, 0.04], [0, 0.035]], silver, 0, 0, 0, 48), cylinder(0.01, 0.01, 0.14, dark, 0, 0.1, 0, 8), bead);
  dish.position.set(0, 1.34, -0.42);
  dish.rotation.x = -0.75;
  group.add(dish, cylinder(0.024, 0.03, 0.34, silver, 0, 1.12, -0.36, 12));
  group.children[group.children.length - 1].rotation.x = -0.2;

  // two round tail lights, two round head lights, a Seed for a badge on its tail
  const badge = seedMesh(0.2);

  badge.position.set(0, 0.68, -0.93);
  badge.scale.z *= 0.5;
  badge.castShadow = false;
  group.add(badge);

  for (const side of [-1, 1]) {
    const tail = sphere(0.075, lit(0xff5f9e, 2.2), side * 0.3, 0.6, -0.9, 1);
    const front = sphere(0.085, lit(0xfff1c4, 2.2), side * 0.3, 0.58, 0.9, 1);

    tail.castShadow = false;
    front.castShadow = false;
    group.add(tail, front);
  }

  return { group, rings, bead, dish };
}

export function build(scene, { loop, heights, jump, tuck, curve, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const gate = portal();
  const machine = car();
  const next = sequence(47);
  const onCircle = (a, radius) => [TRACK.x + Math.cos(a) * radius, TRACK.z + Math.sin(a) * radius];
  const [carX, carZ] = onCircle(CAR.at, TRACK.radius);

  set.add(place(square(), 0, SQUARE.z), place(trails(), TRACK.x, TRACK.z), shadowCatcher(SQUARE.radius - 0.1, 0.008, SQUARE.z, 0.34));

  // the island's own soft shadow on the page, fading to nothing well inside the frame
  set.add(decal(radial([[0, 'rgba(50,50,150,0.3)'], [0.6, 'rgba(50,50,150,0.15)'], [1, 'rgba(50,50,150,0)']]), 0, -0.6, SQUARE.z, 3.9, 3.5, 0));
  gate.group.position.set(PORTAL.x, PORTAL.y, PORTAL.z);
  // the car came round through the front and stopped on the left, its nose toward the back of the island
  machine.group.scale.setScalar(CAR.scale);
  set.add(gate.group, place(machine.group, carX, carZ, -CAR.at));

  // real lights: the portal lights the mentors from behind, the car's rings light the cobbles around it
  const portalLight = new THREE.PointLight(0x8fdcff, 8, 7.5, 1.6);
  const carLight = new THREE.PointLight(0x7fe8ff, 4, 3.5, 1.8);

  portalLight.position.set(PORTAL.x, PORTAL.y - 0.2, PORTAL.z + 1.1);
  carLight.position.set(carX + 0.3, 0.9, carZ + 1.0);
  set.add(portalLight, carLight);

  // what floats out of the portal: gears and alarm clocks, the farther from it the larger
  const metals = [standard(0xf2bf2a, 0.28, { metalness: 0.7 }), standard(0xd9dcf0, 0.28, { metalness: 0.7 }), standard(0xe58a4e, 0.3, { metalness: 0.65 })];
  const floating = [
    { kind: 'gear', x: -2.25, y: 2.62, z: -2.0, size: 0.26, metal: 0, turns: 1 },
    { kind: 'clock', x: -1.4, y: 3.34, z: -2.5, size: 0.23, color: C.pink, turns: -2 },
    { kind: 'gear', x: -0.8, y: 3.7, z: -2.9, size: 0.14, metal: 1, turns: -2 },
    { kind: 'gear', x: 2.02, y: 3.68, z: -2.9, size: 0.15, metal: 2, turns: 2 },
    { kind: 'clock', x: 2.62, y: 3.24, z: -2.5, size: 0.25, color: C.mint, turns: 2 },
    { kind: 'gear', x: 3.1, y: 2.5, z: -2.2, size: 0.21, metal: 1, turns: -1 },
  ].map((spec) => {
    const one = spec.kind === 'gear' ? { group: gear(spec.size, metals[spec.metal]), hands: [] } : alarmClock(spec.size, spec.color);

    one.group.traverse((o) => { o.castShadow = false; });
    fx.add(one.group);

    return { ...spec, ...one, phase: next() * TAU };
  });

  const cast = {
    // Liruf looks over at the car beside him, cannot believe it, and jumps the highest
    liruf: { x: -0.78, z: 0.0, yaw: 0.3, act: {
      hop: jump(2.2, 0.3), tuck: tuck(2.2, 0.9), lean: [[0, 0.05], [2.2, -0.14], [2.8, 0.1], [3.5, 0.05], [L, 0.05]],
      yaw: [[0, 0.5], [1.5, 0.5], [2.2, 0], [4.6, 0], [5.6, -0.45], [6.8, -0.45], [7.6, 0.5], [L, 0.5]], pitch: [[0, -0.1], [2.2, -0.32], [3, -0.06], [5.6, -0.2], [L, -0.1]],
      roll: [[0, 0.14], [2.2, -0.12], [4, 0.12], [5.6, -0.14], [L, 0.14]], tilt: [[0, 0], [2.2, -0.1], [3, 0], [L, 0]],
    } },
    // Zara opens her arms low and wide (turned in `update`): here we are! Then she looks around the square
    zara: { x: 0.1, z: 0.42, yaw: 0.1, act: {
      hop: jump(2.15, 0.2), tuck: tuck(2.15, 0.6), lean: [[0, 0], [2.15, -0.14], [2.9, -0.04], [L, 0]], pitch: [[0, -0.06], [2.15, -0.26], [3, -0.1], [L, -0.06]],
      turn: [[0, 0], [3.4, 0], [4.4, 0.3], [5.4, 0.3], [6.4, -0.25], [7.2, -0.25], [L, 0]], yaw: [[0, 0], [3.2, 0], [4.2, 0.3], [5.4, 0.3], [6.3, -0.3], [7.2, -0.3], [L, 0]],
      roll: [[0, 0.08], [2.15, -0.08], [4.4, 0.1], [6.4, -0.1], [L, 0.08]],
    } },
    // Rho follows the clocks floating overhead, one side and then the other, and jumps a beat later
    rho: { x: 0.98, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.4, 0.18), tuck: tuck(2.4, 0.7), lean: [[0, -0.06], [2.4, -0.18], [2.85, 0.06], [3.5, -0.06], [L, -0.06]],
      yaw: [[0, -0.45], [1.4, -0.45], [2.4, 0], [3.6, 0.45], [5.6, 0.45], [6.8, -0.45], [L, -0.45]], pitch: [[0, -0.34], [1.4, -0.34], [2.4, -0.2], [2.85, 0.1], [3.6, -0.34], [L, -0.34]],
      roll: [[0, 0.1], [2.4, -0.1], [4.4, 0.1], [L, 0.1]], tilt: [[0, 0], [2.4, 0.08], [3.2, 0], [L, 0]],
    } },
    // Dina watches a gear drift over her, then rears up at the light
    dina: { x: 1.98, z: 0.05, yaw: -0.2, act: {
      hop: jump(2.6, 0.12), rear: [[0, 0], [2.1, 0], [2.6, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.16], [2.6, -0.42], [3.4, -0.2], [L, -0.16]],
      roll: [[0, 0.16], [2.6, -0.12], [4.4, 0.18], [L, 0.16]], yaw: [[0, 0.5], [1.5, 0.5], [2.6, 0.1], [4.6, 0.1], [5.8, 0.5], [L, 0.5]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], clear: name === 'dina' ? 0.8 : 0.5, peak: { liruf: 2.2, zara: 2.15, rho: 2.4, dina: 2.6 }[name] }));
  // how far Zara's arms are open
  const open = [[0, 0.25], [1.7, 0.2], [2.15, 1], [3.3, 1], [4.2, 0.35], [L, 0.25]];
  // the ring of light the portal throws when they arrive
  const flash = sprite(TEXTURES.ring, 0xbff4ff, 3);

  flash.position.set(PORTAL.x, PORTAL.y, PORTAL.z + 0.12);
  fx.add(flash);

  // specks of light that leave the portal's middle, winding out past its rim
  const motes = Array.from({ length: 30 }, (_, i) => {
    const mote = sprite(i % 4 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0x8fe6ff, 0xffd36b, 0xff9fc4][i % 4], 4);

    fx.add(mote);

    return { mote, a: next() * TAU, start: next(), laps: 1 + Math.floor(next() * 2), size: (i % 4 ? 0.07 : 0.2) * (0.7 + next() * 0.6) };
  });
  // beads of light that run along the trails toward the car
  const runners = [-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, i) => {
    const bead = sprite(TEXTURES.dot, 0xfff3c4, 4);

    bead.scale.setScalar(0.3);
    fx.add(bead);

    return { bead, radius: TRACK.radius + side * TRACK.gauge, start: i / 5 + (side > 0 ? 0.1 : 0) };
  }));
  const effects = [
    sparkles(fx, { loop, actors, each: 6, colors: [0xffffff, 0xc9f6ff, 0xfff0b8] }),
    landings(fx, { actors, color: 0xdff6ff }),
    // sparks off the rings around the car's tail
    rising(fx, { loop, at: { x: carX + 0.15, y: 0.5, z: carZ + 0.6 }, radius: 0.6, height: 1.3, count: 16, color: [0x9ff0ff, 0xffffff, 0xffd36b], size: [0.05, 0.13], seed: 6, texture: TEXTURES.star, sway: 0.08, depth: 0.3 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.3,
    camera: { y: 2.3, dist: 14.6, lookY: 1.38 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - ARRIVE;
      // the portal flares as they arrive and settles again
      const flare = since > 0 ? Math.exp(-since * 1.1) : Math.exp(since * 3) * 0.35;

      gate.deep.rotation.z = -w * 2;
      gate.veil.rotation.z = w * 3;
      gate.veil.material.opacity = 0.75 + Math.sin(w * 4) * 0.2;
      gate.glow.material.opacity = 0.42 + flare * 0.4;
      gate.glow.scale.setScalar(PORTAL.radius * 3.5 * (1 + flare * 0.12));
      gate.studs.emissiveIntensity = 1.2 + flare * 1.6;
      // the hands go backward: the long one four times round in a loop, the short one once
      gate.hands[0].rotation.z = w * 4;
      gate.hands[1].rotation.z = w;
      portalLight.intensity = 7 + flare * 9;

      const u = since / 1.1;

      flash.visible = u > 0 && u < 1;
      flash.scale.setScalar(PORTAL.radius * 2 * (0.9 + u * 0.8));
      flash.material.opacity = 0.9 * (1 - u) ** 1.5;

      for (const { mote, a, start, laps, size } of motes) {
        const out = (start + (t / loop) * laps) % 1;
        const r = out * PORTAL.radius * 1.5;

        mote.position.set(PORTAL.x + Math.cos(a + out * 3.2) * r, PORTAL.y + Math.sin(a + out * 3.2) * r, PORTAL.z + 0.14);
        mote.scale.setScalar(size * (0.5 + out));
        mote.material.opacity = Math.sin(out * Math.PI) ** 0.8;
      }

      for (const item of floating) {
        const bob = Math.sin(w + item.phase);

        item.group.position.set(item.x + Math.cos(w + item.phase) * 0.07, item.y + bob * 0.08, item.z);

        if (item.kind === 'gear') item.group.rotation.set(0.25 * Math.sin(w + item.phase), 0.3 * bob, w * item.turns);
        else {
          item.group.rotation.set(0, 0.25 * bob, Math.sin(w * 2 + item.phase) * 0.16);
          item.hands[0].rotation.z = w * item.turns * 2;
          item.hands[1].rotation.z = w * item.turns;
        }
      }

      // the car hums: its rings light up one after another, the dish turns, the bead blinks
      machine.rings.forEach((ring, i) => { ring.material.emissiveIntensity = 1.3 + 1.9 * Math.max(0, Math.sin(w * 4 - i * 1.6)); });
      machine.dish.rotation.y = Math.sin(w * 2) * 0.5;
      machine.bead.material.emissiveIntensity = 1.4 + 1.6 * Math.max(0, Math.sin(w * 8));
      machine.group.position.y = Math.abs(Math.sin(w * 8)) * 0.006;
      carLight.intensity = 3.4 + Math.sin(w * 4) * 1.2;

      // the beads run the arc once a loop, the same way the car came
      for (const { bead, radius, start } of runners) {
        const lap = (start + t / loop) % 1;
        const a = CAR.at - (1 - lap) * TAU * TRACK.span;

        bead.position.set(TRACK.x + Math.cos(a) * radius, 0.05, TRACK.z + Math.sin(a) * radius);
        bead.material.opacity = Math.sin(lap * Math.PI) ** 0.6 * (0.25 + lap * 0.75);
      }

      // Zara's arms open low and wide, palms out
      const wide = curve(open, t);

      rigs.zara.rot('LeftArm', Z, wide * 0.62);
      rigs.zara.rot('LeftForeArm', Z, wide * 0.3);
      rigs.zara.rot('RightArm', Z, -wide * 0.62);
      rigs.zara.rot('RightForeArm', Z, -wide * 0.3);

      for (const effect of effects) effect(t);
    },
  };
}
