// Home composition "fair": the four mentors at an invention fair, presenting what they built, the moment all three
// inventions go off at once.
//
// The setting is an island: a round wooden stage with a striped skirt, like the base of a carousel, kept clear for
// the mentors. Their three inventions are shown above and behind them, each on a round stand that floats over a
// ring of light, under a cloth with a rosette pinned to it: on the left a small robot with a round body, one big
// eye that blinks and an aerial; in the middle, a little higher, a machine of gears and pipes that puffs small
// colored clouds; on the right a model volcano that bubbles over with foam. A string of round flags hangs over
// everything between two striped poles at the sides of the stage.
import * as THREE from 'three';
import { C, TAU, canvasTexture, confetti, cylinder, decal, landings, lathe, lit, mesh, place, radial, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const STAGE = { radius: 3.3, z: -0.6 };
const ROBOT = { x: -2.12, z: -2.2, height: 2.06 };
const MACHINE = { x: 0, z: -2.2, height: 2.08 };
const VOLCANO = { x: 2.12, z: -2.2, height: 2.06 };
const LINE = { z: -1.2, reach: 3.0, ends: 3.52, sag: 0.14 };
const GO = 1.8; // the second the three inventions go off

// ---- the stage: planks of pale wood inside a darker ring, a striped skirt underneath
function stage() {
  const group = new THREE.Group();
  const R = STAGE.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const next = sequence(91);

    g.fillStyle = '#f0c796';
    g.fillRect(0, 0, w, w);

    // planks, each a little lighter or darker than the next, with seams between them
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(${i % 2 ? '255,236,200' : '214,160,104'},${0.12 + next() * 0.16})`;
      g.fillRect(0, (i / 16) * w, w, w / 16);
      g.fillStyle = 'rgba(168,106,60,0.4)';
      g.fillRect(0, (i / 16) * w - 2, w, 4);

      for (let k = 0; k < 3; k++) g.fillRect(next() * w, (i / 16) * w, 4, w / 16);
    }

    // the ring around them
    g.strokeStyle = '#c98a54';
    g.lineWidth = half * 0.09;
    g.beginPath();
    g.arc(half, half, half * 0.955, 0, TAU);
    g.stroke();
    g.strokeStyle = '#fff1cf';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(half, half, half * 0.9, 0, TAU);
    g.stroke();
  });
  const stripes = canvasTexture([1024, 8], (g, w, h) => {
    for (let i = 0; i < 32; i++) {
      g.fillStyle = i % 2 ? '#fff1cf' : '#ff6fa5';
      g.fillRect((i / 32) * w, 0, w / 32 + 1, h);
    }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), standard(0xffffff, 0.75, { map: top }));
  const edge = mesh(new THREE.TorusGeometry(R - 0.03, 0.05, 14, 128), standard(C.gold, 0.4, { metalness: 0.4 }), 0, -0.04, 0);

  disc.receiveShadow = true;
  edge.rotation.x = Math.PI / 2;
  group.add(disc, edge, lathe([[0, -0.34], [2.4, -0.34], [3.0, -0.27], [3.2, -0.16], [R - 0.03, -0.06]], standard(0xffffff, 0.8, { map: stripes })));

  return group;
}

// ---- a rosette: a ring of round pleats, a button, two tails
function rosette(size, color, button = C.gold) {
  const group = new THREE.Group();
  const cloth = standard(color, 0.6);

  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;

    group.add(sphere(size * 0.34, cloth, Math.cos(a) * size * 0.72, Math.sin(a) * size * 0.72, 0, 1));
    group.children[group.children.length - 1].scale.z = 0.4;
  }

  for (const side of [-1, 1]) {
    const tail = sphere(1, cloth, side * size * 0.38, -size * 1.5, -0.01, 1);

    tail.scale.set(size * 0.3, size * 0.95, size * 0.1);
    tail.rotation.z = side * 0.22;
    group.add(tail);
  }

  const middle = sphere(size * 0.66, standard(button, 0.35, { metalness: 0.3 }), 0, 0, size * 0.1, 1);

  middle.scale.z = 0.35;
  group.add(middle);

  return group;
}

// ---- a display stand: a round drum under a cloth, a rosette on its front, a ring of light under it (it floats)
function stand(radius, cloth, ribbon, light) {
  const group = new THREE.Group();
  const badge = rosette(0.11, ribbon);
  const ring = mesh(new THREE.TorusGeometry(radius * 0.62, 0.028, 12, 64), lit(light, 2.2), 0, -0.36, 0);
  const glow = sprite(TEXTURES.dot, light, 3);

  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  glow.position.y = -0.4;
  glow.scale.set(radius * 2.4, radius * 0.9, 1);
  glow.material.opacity = 0.55;
  group.add(
    lathe([[0, -0.3], [radius * 0.72, -0.3], [radius * 0.94, -0.24], [radius, -0.08], [radius * 1.02, -0.02], [radius, 0], [0, 0]], standard(cloth, 0.8)),
    cylinder(radius * 1.03, radius * 1.03, 0.05, standard(C.cream, 0.6), 0, 0, 0, 64),
    ring, glow,
  );
  badge.position.set(0, -0.12, radius + 0.02);
  group.add(badge);

  return { group, ring };
}

// ---- a pole for the string of flags: striped, on a round foot, a golden ball on top
function pole(height) {
  const group = new THREE.Group();
  const stripes = canvasTexture([8, 256], (g, w, h) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 2 ? '#fff1cf' : '#ff6fa5';
      g.fillRect(0, (i / 12) * h, w, h / 12 + 1);
    }
  });

  group.add(
    lathe([[0, 0], [0.2, 0], [0.22, 0.04], [0.12, 0.1], [0.06, 0.16], [0, 0.16]], standard(C.gold, 0.4, { metalness: 0.4 })),
    cylinder(0.04, 0.045, height, standard(0xffffff, 0.6, { map: stripes }), 0, height / 2, 0, 20),
    sphere(0.085, standard(C.gold, 0.35, { metalness: 0.5 }), 0, height + 0.05, 0),
  );

  return group;
}

// ---- the robot: a round body, a head with one big eye that blinks, an aerial, two small arms
function robot() {
  const group = new THREE.Group();
  const shell = standard(C.sky, 0.35, { metalness: 0.2 });
  const pale = standard(0xf3f4ff, 0.35);
  const dark = standard(C.slate, 0.5);
  const head = new THREE.Group();
  const eye = new THREE.Group();
  const beacon = sphere(0.045, lit(C.orange, 1.5), 0, 0.38, 0);
  const dial = mesh(new THREE.CircleGeometry(0.075, 32), lit(0x35e0b8, 1.2), 0, 0.33, 0.243);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();

    arm.position.set(side * 0.23, 0.4, 0);
    arm.add(tube([[0, 0, 0], [side * 0.1, -0.04, 0.02], [side * 0.17, 0.04, 0.04]], 0.026, dark, 12), sphere(0.05, pale, side * 0.18, 0.05, 0.04));
    group.add(arm);

    return { arm, side };
  });

  group.add(
    cylinder(0.17, 0.2, 0.07, dark, 0, 0.035, 0, 32),
    sphere(0.25, shell, 0, 0.32, 0, 1),
    mesh(new THREE.TorusGeometry(0.085, 0.016, 10, 32), standard(C.gold, 0.3, { metalness: 0.5 }), 0, 0.33, 0.24),
    dial,
    cylinder(0.06, 0.07, 0.08, dark, 0, 0.58, 0, 20),
  );

  head.position.y = 0.74;
  head.add(sphere(0.19, pale, 0, 0, 0, 0.88), cylinder(0.012, 0.012, 0.2, dark, 0, 0.26, 0, 8), beacon);
  head.children[0].scale.x = 1.15;

  for (const side of [-1, 1]) head.add(sphere(0.05, standard(C.gold, 0.3, { metalness: 0.5 }), side * 0.215, 0, 0, 1));

  // the eye: a dark round glass, a bright ring, a shine
  eye.position.set(0, 0.01, 0.165);
  eye.add(sphere(0.095, dark, 0, 0, 0, 1), sphere(0.062, lit(0x8fe0ff, 1.6), 0, 0, 0.045, 1), sphere(0.032, standard(C.ink, 0.3), 0, 0, 0.085, 1), sphere(0.014, lit(0xffffff, 2), 0.02, 0.022, 0.108, 1));
  eye.children[0].scale.z = 0.5;
  eye.children[1].scale.z = 0.5;
  eye.children[2].scale.z = 0.5;
  head.add(eye);
  group.add(head);

  return { group, head, eye, beacon, arms };
}

/** A wheel with round teeth, facing +z. */
function gear(radius, teeth, color) {
  const group = new THREE.Group();
  const metal = standard(color, 0.35, { metalness: 0.5 });

  group.add(mesh(new THREE.TorusGeometry(radius * 0.72, radius * 0.24, 12, 40), metal), sphere(radius * 0.3, metal, 0, 0, 0, 1));

  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;

    group.add(sphere(radius * 0.2, metal, Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }

  for (let i = 0; i < 3; i++) {
    const spoke = cylinder(radius * 0.09, radius * 0.09, radius * 1.4, metal, 0, 0, 0, 10);

    spoke.rotation.z = (i / 3) * Math.PI;
    group.add(spoke);
  }

  return group;
}

// ---- the machine: a round boiler with brass bands, two gears, a gauge, pipes, and a funnel that puffs clouds
function machine() {
  const group = new THREE.Group();
  const brass = standard(0xf2bf2a, 0.3, { metalness: 0.65 });
  const paint = standard(C.indigo, 0.4);
  const pipe = standard(C.mint, 0.4);
  const big = gear(0.15, 9, 0xf08a1c);
  const small = gear(0.1, 7, 0xf2bf2a);
  const needle = new THREE.Group();
  const mouth = new THREE.Object3D();
  const horn = new THREE.Group();
  const valve = mesh(new THREE.TorusGeometry(0.07, 0.02, 10, 28), standard(C.red, 0.4), 0.52, 0.52, 0.06);

  group.add(cylinder(0.3, 0.34, 0.1, standard(C.slate, 0.5), 0, 0.05, 0, 48), sphere(0.36, paint, 0, 0.44, 0, 0.95));

  for (const y of [-0.13, 0.13]) {
    const band = mesh(new THREE.TorusGeometry(0.335, 0.022, 10, 64), brass, 0, 0.44 + y, 0);

    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  big.position.set(-0.17, 0.38, 0.37);
  small.position.set(0.085, 0.3, 0.39);
  group.add(big, small);

  // a gauge: a white face in a brass ring, a needle that trembles
  needle.position.set(0.16, 0.6, 0.31);
  needle.add(cylinder(0.008, 0.008, 0.06, standard(C.red, 0.4), 0, 0.03, 0.012, 8));
  group.add(mesh(new THREE.CircleGeometry(0.075, 32), standard(0xffffff, 0.4), 0.16, 0.6, 0.305), mesh(new THREE.TorusGeometry(0.078, 0.016, 10, 32), brass, 0.16, 0.6, 0.305), needle);
  group.children[group.children.length - 3].rotation.set(-0.3, 0.42, 0);
  group.children[group.children.length - 2].rotation.set(-0.3, 0.42, 0);
  needle.rotation.set(-0.3, 0.42, 0);

  // the pipes: one winds up to the funnel, one loops out of the side with a valve on it
  group.add(
    tube([[-0.05, 0.74, 0], [-0.12, 0.88, 0], [-0.02, 0.97, 0], [0.12, 0.98, 0], [0.2, 1.06, 0]], 0.055, pipe, 32),
    horn,
    tube([[0.3, 0.6, 0], [0.5, 0.66, 0.03], [0.55, 0.42, 0.05], [0.4, 0.2, 0.03], [0.28, 0.14, 0]], 0.04, brass, 32),
    valve,
  );
  // the funnel: a round bell with a soft lip, leaning to one side
  horn.position.set(0.2, 1.04, 0);
  horn.rotation.z = -0.75;
  horn.add(lathe([[0.05, -0.02], [0.065, 0.06], [0.1, 0.13], [0.16, 0.2]], brass, 0, 0, 0, 40), mesh(new THREE.TorusGeometry(0.16, 0.024, 12, 48), brass, 0, 0.2, 0));
  horn.children[0].material = standard(0xf2bf2a, 0.3, { metalness: 0.65, side: THREE.DoubleSide });
  horn.children[1].rotation.x = Math.PI / 2;
  mouth.position.set(0.2 + Math.sin(0.75) * 0.28, 1.04 + Math.cos(0.75) * 0.28, 0);
  group.add(mouth);

  return { group, big, small, needle, valve, mouth };
}

// ---- the model volcano: a round cone of painted paper on a green base, foam running over its top
function volcano() {
  const group = new THREE.Group();
  const foam = standard(0xff8a3c, 0.5, { emissive: 0xc23a00, emissiveIntensity: 0.35 });
  const next = sequence(5);

  group.add(
    cylinder(0.44, 0.46, 0.05, standard(0x62bb55, 0.8), 0, 0.025, 0, 48),
    lathe([[0, 0.04], [0.4, 0.04], [0.37, 0.1], [0.28, 0.26], [0.2, 0.42], [0.15, 0.54], [0.13, 0.6], [0.1, 0.62], [0.06, 0.56], [0, 0.52]], standard(0x9c6a48, 0.9)),
    sphere(0.115, foam, 0, 0.6, 0, 0.5),
  );

  // foam running down the sides, and three small round trees of green paper at the foot
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    const length = 0.12 + next() * 0.16;
    const run = sphere(1, foam, Math.cos(a) * (0.13 + length * 0.3), 0.58 - length * 0.55, Math.sin(a) * (0.13 + length * 0.3), 1);

    run.scale.set(0.04, length * 0.6, 0.04);
    run.rotation.set(Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5);
    group.add(run);
  }

  for (const [x, z] of [[-0.3, 0.2], [0.28, 0.24], [0.05, 0.36]]) group.add(sphere(0.055, standard(0x3aa655, 0.8), x, 0.11, z, 1.2));

  return group;
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

export function build(scene, { loop, heights, jump, tuck }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const bot = robot();
  const engine = machine();
  const next = sequence(29);

  set.add(place(stage(), 0, STAGE.z), shadowCatcher(STAGE.radius - 0.08, 0.008, STAGE.z, 0.32));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.44, STAGE.z, 4.1, 3.4, 0));

  // the three stands float behind the mentors, over their heads, each with its invention on it
  const shown = [
    { ...ROBOT, base: stand(0.46, C.indigo, C.gold, 0x8f8aff), on: bot.group, yaw: 0.3, scale: 0.86, phase: 0 },
    { ...MACHINE, base: stand(0.48, C.mint, C.pink, 0x35e0b8), on: engine.group, yaw: 0, scale: 0.72, phase: 2.2 },
    { ...VOLCANO, base: stand(0.46, C.sky, C.red, 0x7fb4ff), on: volcano(), yaw: -0.3, scale: 1, phase: 4.1 },
  ].map(({ x, z, height, base, on, yaw, scale, phase }) => {
    const holder = new THREE.Group();

    on.position.y = 0.025;
    on.rotation.y = yaw;
    on.scale.setScalar(scale);
    holder.add(base.group, on);
    holder.position.set(x, height, z);
    set.add(holder);

    return { holder, height, phase };
  });

  set.add(place(pole(LINE.ends), -LINE.reach, LINE.z), place(pole(LINE.ends), LINE.reach, LINE.z));

  // the string of round flags, from the top of one pole to the top of the other
  const hang = (x) => LINE.ends - LINE.sag * (1 - (x / LINE.reach) ** 2);
  const colors = [C.indigo, C.gold, C.pink, C.mint, C.orange, C.sky];
  const flags = [];

  set.add(tube(Array.from({ length: 13 }, (_, i) => { const x = -LINE.reach + (i / 12) * LINE.reach * 2; return [x, hang(x), LINE.z]; }), 0.014, standard(C.cream, 0.7), 64));

  for (let i = 0; i < 15; i++) {
    const x = -LINE.reach * 0.9 + (i / 14) * LINE.reach * 1.8;
    const flag = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7, side: THREE.DoubleSide }));
    const hinge = new THREE.Group();

    flag.scale.y = 1.25;
    flag.castShadow = true;
    hinge.position.set(x, hang(x) - 0.01, LINE.z);
    hinge.rotation.z = Math.atan((2 * LINE.sag * x) / LINE.reach ** 2);
    hinge.add(flag);
    set.add(hinge);
    flags.push({ hinge, phase: next() * TAU });
  }

  // the clouds the machine puffs, blue, pink and lilac: four round puffs each, growing and fading as they go
  const puffs = Array.from({ length: 3 }, (_, i) => {
    const puff = new THREE.Group();
    const stuff = new THREE.MeshStandardMaterial({ color: [0x8fc4ff, 0xff9fc4, 0xb9a8ff][i % 3], emissive: [0x4b94ff, 0xff6fa5, 0x8f7aff][i % 3], emissiveIntensity: 0.55, roughness: 0.9, transparent: true, depthWrite: false });

    for (const [x, y, r] of [[0, 0, 0.11], [0.1, 0.03, 0.085], [-0.09, 0.04, 0.08], [0.02, 0.08, 0.075]]) puff.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), stuff).translateX(x).translateY(y));

    puff.renderOrder = 5;
    fx.add(puff);

    return { puff, stuff, at: i / 3, drift: (next() - 0.5) * 0.5 };
  });
  // the foam bubbles of the volcano: they jump out of its top and fall beside it
  const bubbles = Array.from({ length: 12 }, (_, i) => {
    const bubble = sphere(0.05 + next() * 0.035, standard([0xff8a3c, 0xffc21f, 0xff6fa5][i % 3], 0.4, { emissive: [0xc23a00, 0x9a6a00, 0xb0204f][i % 3], emissiveIntensity: 0.4 }), 0, 0, 0);

    bubble.castShadow = false;
    fx.add(bubble);

    return { bubble, at: i / 12, a: next() * TAU, reach: 0.12 + next() * 0.2, height: 0.22 + next() * 0.22 };
  });
  const top = new THREE.Vector3();
  const robotLight = new THREE.PointLight(0x8fd0ff, 2, 3, 1.8);
  const ping = sprite(TEXTURES.ring, 0xffc48a, 7);

  robotLight.position.set(ROBOT.x + 0.2, ROBOT.height + 0.9, ROBOT.z + 0.6);
  ping.renderOrder = 1;
  fx.add(robotLight, ping);

  const cast = {
    // Liruf stands by his robot, chest out, and jumps when it lights up
    liruf: { x: -1.5, z: -0.05, yaw: 0.3, act: {
      hop: jump(2.05, 0.28), tuck: tuck(2.05, 0.9), yaw: [[0, -0.55], [1.2, -0.55], [2.05, 0.1], [4.4, 0.1], [5.6, -0.55], [L, -0.55]],
      pitch: [[0, -0.1], [2.05, -0.3], [2.7, -0.05], [L, -0.1]], roll: [[0, -0.16], [2.05, 0.14], [4.6, -0.16], [L, -0.16]],
      lean: [[0, -0.1], [1.6, -0.02], [2.05, -0.16], [2.7, 0.06], [3.6, -0.1], [L, -0.1]], tilt: [[0, -0.07], [2.05, 0.08], [3, -0.07], [L, -0.07]],
    } },
    // Zara greets the visitors of the fair: a wave, the other arm at her side
    zara: { x: -0.58, z: 0.4, yaw: 0.1, act: {
      hop: jump(2.2, 0.15), tuck: tuck(2.2, 0.5), wave: [[0, 0], [1.3, 0], [1.9, 1], [4.4, 1], [5.1, 0], [L, 0]], lean: [[0, -0.04], [1.9, -0.14], [4.4, -0.1], [5.2, -0.04], [L, -0.04]], pitch: [[0, -0.06], [1.9, -0.18], [4.4, -0.12], [L, -0.06]],
      roll: [[0, 0.1], [1.9, -0.1], [3.2, 0.1], [4.4, -0.08], [L, 0.1]], yaw: [[0, -0.2], [1.9, 0], [3.2, 0.25], [4.4, -0.15], [L, -0.2]], tilt: [[0, 0], [3.2, 0.04], [L, 0]],
    } },
    // Rho, proud, rocks on his heels and nods up at the machine
    rho: { x: 0.56, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.45, 0.17), tuck: tuck(2.45, 0.7), lean: [[0, -0.12], [1.2, -0.04], [2.45, -0.18], [2.9, 0.08], [3.6, -0.12], [5.4, -0.02], [6.4, -0.12], [L, -0.12]],
      pitch: [[0, -0.14], [2.45, -0.3], [2.9, 0.16], [3.6, -0.12], [5.4, 0.1], [6, -0.14], [L, -0.14]], roll: [[0, 0.1], [2.45, -0.12], [4.2, 0.1], [L, 0.1]], tilt: [[0, 0.03], [2.45, 0.08], [3.2, -0.03], [L, 0.03]],
    } },
    // Dina watches the foam jump out of the volcano over her, and rears up
    dina: { x: 1.82, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.65, 0.12), rear: [[0, 0], [2.15, 0], [2.65, 1], [3.35, 0], [L, 0]], pitch: [[0, -0.2], [2.65, -0.42], [3.4, -0.2], [L, -0.2]],
      roll: [[0, 0.22], [2.65, -0.1], [4.4, 0.22], [L, 0.22]], yaw: [[0, 0.45], [1.6, 0.45], [2.65, 0.1], [4.6, 0.1], [6, 0.45], [L, 0.45]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.05, zara: 2.2, rho: 2.45, dina: 2.65 }[name] }));
  const effects = [
    twinkles(fx, { loop, cast, peaks: { liruf: 2.05, zara: 2.2, rho: 2.45, dina: 2.65 } }),
    landings(fx, { actors, color: 0xfff3dd }),
    confetti(fx, { at: 2.1, x: 0, z: -1.2, spread: 2.0, count: 80, colors: [0xffd36b, 0x35e0b8, 0xffffff, 0x8f8aff, 0xff7aa8, 0x4b94ff] }),
  ];
  const mouth = new THREE.Vector3();

  scene.add(set, fx);

  return {
    cast,
    still: 2.15,
    camera: { y: 2.3, dist: 14.1, lookY: 1.43 },
    update(t) {
      const w = (t / loop) * TAU;
      const since = t - GO;
      // how hard the inventions are working: gently all the time, flat out for two seconds from `GO`
      const push = since > 0 && since < 2.4 ? Math.sin((since / 2.4) * Math.PI) ** 0.5 : 0;

      // the stands bob, each at its own pace
      for (const { holder, height, phase } of shown) holder.position.y = height + Math.sin(w + phase) * 0.04;

      // the robot rocks, turns its head, blinks, and waves its arms when it goes off
      bot.group.rotation.z = Math.sin(w * 4) * 0.05;
      bot.head.rotation.y = Math.sin(w * 2) * 0.35;
      bot.head.rotation.z = Math.sin(w * 4 + 1) * 0.06;
      bot.eye.scale.y = [0.6, 3.1, 5.4].some((at) => Math.abs(t - at) < 0.07) ? 0.12 : 1;
      bot.beacon.position.y = 0.38 + Math.abs(Math.sin(w * 4)) * 0.03;
      bot.beacon.material.emissiveIntensity = 0.8 + (Math.sin(w * 8) > 0 ? 1.6 : 0) + push * 1.5;

      for (const { arm, side } of bot.arms) arm.rotation.z = side * (push * 0.9 + Math.sin(w * 8 + side) * 0.18 * (0.3 + push));

      const beep = (since - 0.05) / 0.7;

      ping.visible = beep > 0 && beep < 1;
      ping.position.set(ROBOT.x, shown[0].holder.position.y + 1.05, ROBOT.z - 0.1);
      ping.scale.setScalar(0.25 + beep * 0.9);
      ping.material.opacity = 0.8 * (1 - beep);

      // the machine: gears, a needle, a valve, and puffs out of the funnel
      const turn = w * 2 + push * Math.sin((since / 2.4) * Math.PI * 0.5) * TAU;

      engine.big.rotation.z = turn;
      engine.small.rotation.z = -turn * (9 / 7) + 0.2;
      engine.needle.rotation.z = -0.9 + push * 1.6 + Math.sin(w * 16) * 0.06;
      engine.valve.rotation.z = w * 3;
      engine.group.rotation.z = Math.sin(w * 16) * 0.006 * (1 + push * 3);
      engine.group.updateWorldMatrix(true, true);
      engine.mouth.getWorldPosition(mouth);

      for (const { puff, stuff, at, drift } of puffs) {
        const rise = ((t / loop) * 3 + at) % 1;

        puff.position.set(mouth.x + (0.62 + drift * 0.2) * rise, mouth.y - rise * 0.03 + Math.sin(w * 2 + at * TAU) * 0.02, mouth.z);
        // it shrinks away at the end instead of fading, so it keeps its color on the dark page
        puff.scale.setScalar((0.5 + rise * 0.6) * (1 + push * 0.25) * Math.min(1, (1 - rise) / 0.22) + 0.001);
        stuff.opacity = Math.min(1, rise * 6) * 0.95;
      }

      top.set(VOLCANO.x, shown[2].holder.position.y + 0.66, VOLCANO.z);

      // the volcano: bubbles of foam jump out, more of them and higher when it goes off
      for (const { bubble, at, a, reach, height } of bubbles) {
        const fly = ((t / loop) * 8 + at) % 1;
        const strength = 0.55 + push * 0.75;

        bubble.position.set(top.x + Math.cos(a) * reach * fly * strength * 1.4, top.y + (4 * fly * (1 - fly) * height - fly * 0.16) * strength, top.z + Math.sin(a) * reach * fly * strength);
        bubble.scale.setScalar(Math.sin(Math.min(1, fly * 1.15) * Math.PI) ** 0.6 * (0.8 + push * 0.5) + 0.001);
      }

      // the flags swing on their string
      for (const { hinge, phase } of flags) hinge.rotation.x = Math.sin(w * 2 + phase) * 0.22;

      for (const effect of effects) effect(t);
    },
  };
}
