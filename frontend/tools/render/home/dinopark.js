// Home composition "dinopark": the four mentors at the gate of a park of dinosaurs. Liruf, who is one, is delighted
// to be home; the others look around in awe, and an egg in the nest beside him hatches.
//
// The setting is an island: a clearing of trodden earth in the grass, with big three-toed footprints across its
// front. At the back stands the gate, wide enough for the four to stand inside it with air on both sides: two round
// log posts under a long round arch hung with round-leafed vines, a round sign with a footprint painted on it (no
// words), and a torch on each post (real lights). Outside its left post a short log fence runs to the rim, one rail
// down, and in front of that, low at the island's front, is the nest with three giant eggs: the middle one cracks,
// glows, and a tiny round head peeks out with the shell for a hat. Outside the right post a round yellow jeep of our
// own is parked, looking at the reader. Far behind, inside a soft cloud of jungle dusk that fades to nothing before
// the frame's borders, a far volcano glows and puffs. Nothing here is frightening, and nothing stands in the front
// or the middle: that is the mentors' room.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.55, z: -0.7 };
const GATE = { x: -0.14, z: -2.3, post: 2.24, height: 2.25, rise: 0.95 }; // a little to the left: Dina is the wider end of the cast
const NEST = { x: -2.0, z: 1.25, scale: 0.68 };
const JEEP = { x: 2.84, z: -0.3, yaw: 0.05, scale: 0.68 };
const VOLCANO = { x: -3.2, y: 0.55, z: -7, height: 2.25 };
const HATCH = 2.0; // the second the egg opens
const GREENS = [0x3fb565, 0x2f9e58, 0x5cc977, 0x36a85c].map((color) => standard(color, 0.8));
const WOOD = standard(0xc98f58, 0.85);
const WOOD_DARK = standard(0x9a6a3e, 0.9);
const ROPE = standard(0xf0dcae, 0.9);

/** A three-toed footprint, round everywhere, on a 2D canvas: `s` long, its toes toward `angle`. */
function footprint(g, x, y, s, angle, color) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = color;

  for (const a of [-0.66, 0, 0.66]) {
    g.save();
    g.rotate(a);
    g.beginPath();
    g.ellipse(s * 0.25, 0, s * 0.21, s * 0.12, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  g.beginPath();
  g.ellipse(-s * 0.1, 0, s * 0.2, s * 0.2, 0, 0, TAU);
  g.fill();
  g.restore();
}

// ---- the ground: grass, a clearing of trodden earth, the footprints across its front
function ground() {
  const group = new THREE.Group();
  const next = sequence(71);
  const R = GROUND.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const px = (v) => ((v / R + 1) / 2) * w;

    // the disc's own picture has the island's back on its left: turned, so that x is the island's x and y its depth
    g.setTransform(0, -1, 1, 0, 0, w);
    g.fillStyle = '#5fbb62';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 130;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(140,220,116,0.5)' : 'rgba(48,146,80,0.4)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // the clearing: earth, soft at its edge, wide across the front
    g.save();
    g.translate(w / 2, w * 0.68);
    g.scale(1, 0.7);

    const earth = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.42);

    earth.addColorStop(0, 'rgba(240,206,152,1)');
    earth.addColorStop(0.8, 'rgba(226,186,130,1)');
    earth.addColorStop(1, 'rgba(226,186,130,0)');
    g.fillStyle = earth;
    g.fillRect(-w, -w, w * 2, w * 2);
    g.restore();

    // pebbles in the earth
    for (let i = 0; i < 70; i++) {
      const a = next() * TAU;
      const r = Math.sqrt(next()) * w * 0.3;

      g.fillStyle = i % 2 ? 'rgba(255,236,200,0.6)' : 'rgba(176,130,84,0.35)';
      g.beginPath();
      g.arc(w / 2 + Math.cos(a) * r, w * 0.68 + Math.sin(a) * r * 0.68, 4 + next() * 7, 0, TAU);
      g.fill();
    }

    // the footprints: something large walked across, left foot, right foot, from the reader's left to the right
    for (const [x, z, angle] of [[-1.05, 1.72, 0.16], [-0.1, 2.42, 0.06], [0.9, 1.86, -0.06], [1.85, 2.3, -0.24]]) {
      footprint(g, px(x) + 7, px(z) + 8, 230, angle, 'rgba(255,244,214,0.9)');
      footprint(g, px(x), px(z), 230, angle, 'rgba(122,72,38,0.92)');
    }

    // small flowers in the grass at the back
    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w * 0.36;

      g.fillStyle = ['#ffffff', '#ffd36b', '#ff9fc4'][i % 3];
      g.beginPath();
      g.arc(x, y, 5 + next() * 5, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x44a253, 0.9), standard(0xffffff, 0.95, { map: picture }), standard(C.earth, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x4fae5c, 0.95), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.66], [1.3, -0.63], [2.3, -0.52], [3.1, -0.32], [R - 0.04, -0.1]], standard(0x9a6840, 0.95)));

  return group;
}

// ---- a torch: a round cup on a short arm, a flame of two round drops, its glow and its light
function torch() {
  const group = new THREE.Group();
  const flame = new THREE.Group();
  const outer = sphere(0.13, new THREE.MeshBasicMaterial({ color: 0xff8a1f, toneMapped: false }), 0, 0.12, 0, 1.35);
  const inner = sphere(0.075, new THREE.MeshBasicMaterial({ color: 0xffe27a, toneMapped: false }), 0, 0.075, 0.085, 1.3);
  const glow = halo(0.55, 0xffb24a, 0.55);
  const light = new THREE.PointLight(0xffb060, 5, 5, 1.7);

  outer.castShadow = false;
  inner.castShadow = false;
  glow.position.y = 0.14;
  light.position.set(0, 0.2, 0.25);
  flame.position.y = 0.1;
  flame.add(outer, inner);
  group.add(cylinder(0.035, 0.035, 0.3, WOOD_DARK, 0, -0.05, -0.15, 12), lathe([[0, -0.1], [0.07, -0.095], [0.12, -0.06], [0.145, 0], [0.15, 0.06], [0.135, 0.1], [0.11, 0.09], [0, 0.06]], WOOD_DARK, 0, 0, 0, 32), flame, glow, light);
  group.children[0].rotation.x = Math.PI / 2;

  return { group, flame, glow, light };
}

// ---- the gate: two round log posts, a long round arch with vines, a round sign with a footprint, a torch on each post
function gate() {
  const group = new THREE.Group();
  const sign = new THREE.Group();
  const H = GATE.height;
  const painted = canvasTexture([256, 256], (g, s) => {
    g.fillStyle = '#fff1cf';
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2, 0, TAU);
    g.fill();
    g.strokeStyle = '#eb7301';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, TAU);
    g.stroke();
    footprint(g, s / 2, s / 2 + 8, s * 0.6, -Math.PI / 2, '#4438cf');
  });
  const torches = [];

  for (const side of [-1, 1]) {
    group.add(lathe([[0, 0], [0.24, 0], [0.26, 0.07], [0.2, 0.15], [0.175, H - 0.12], [0.22, H - 0.04], [0.22, H + 0.1], [0.14, H + 0.24], [0, H + 0.28]], WOOD, side * GATE.post, 0, 0, 40));

    for (const y of [0.5, 1.35]) {
      const band = mesh(new THREE.TorusGeometry(0.195, 0.032, 10, 40), ROPE, side * GATE.post, y, 0);

      band.rotation.x = Math.PI / 2;
      group.add(band);
    }

    const one = torch();

    one.group.position.set(side * GATE.post, 1.78, 0.38);
    group.add(one.group);
    torches.push(one);
  }

  // the arch: a round log bent from post to post, bound with rope along its length
  const along = (a) => [Math.cos(a) * GATE.post, H + Math.sin(a) * GATE.rise, 0];

  group.add(tube(Array.from({ length: 33 }, (_, i) => along((i / 32) * Math.PI)), 0.17, WOOD_DARK, 96));

  for (const a of [0.3, 0.75, 1.2, Math.PI - 1.2, Math.PI - 0.75, Math.PI - 0.3]) {
    const band = mesh(new THREE.TorusGeometry(0.16, 0.032, 10, 32), ROPE, ...along(a));

    // the band's own axis is turned to run along the arch at that point
    band.rotation.set(0, Math.PI / 2, Math.atan2(Math.cos(a) * GATE.rise, -Math.sin(a) * GATE.post), 'ZYX');
    group.add(band);
  }

  // vines with round leaves hang from the arch, each on its own hinge so it can sway, none as low as a head
  const vines = [[0.52, 0.5], [0.98, 0.62], [1.38, 0.34], [Math.PI - 1.38, 0.3], [Math.PI - 0.98, 0.66], [Math.PI - 0.52, 0.46]].map(([a, length], k) => {
    const vine = new THREE.Group();
    const [x, y] = along(a);

    vine.position.set(x, y - 0.15, 0.12);
    vine.add(tube([[0, 0, 0], [0.03, -length * 0.4, 0.02], [-0.02, -length * 0.75, 0], [0.02, -length, 0.02]], 0.018, GREENS[1], 16));

    for (let i = 1; i <= Math.round(length * 7); i++) {
      const leaf = sphere(0.062, GREENS[(i + k) % GREENS.length], i % 2 ? 0.065 : -0.065, -(i / (length * 7)) * length, 0.02, 0.55);

      leaf.scale.z = 0.5;
      vine.add(leaf);
    }

    group.add(vine);

    return vine;
  });

  // the sign hangs under the middle of the arch on two ropes
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 48), new THREE.MeshStandardMaterial({ map: painted, roughness: 0.8 }));
  const board = lathe([[0, 0], [0.36, 0], [0.4, 0.04], [0.4, 0.08], [0.36, 0.12], [0, 0.12]], WOOD, 0, 0, 0, 48);

  board.rotation.x = Math.PI / 2;
  board.position.z = -0.06;
  face.position.z = 0.064;
  sign.add(board, face);

  for (const side of [-1, 1]) sign.add(cylinder(0.014, 0.014, 0.34, ROPE, side * 0.2, 0.48, 0, 8));

  sign.position.set(0, H + GATE.rise - 0.17 - 0.62, 0.02);
  group.add(sign);

  return { group, sign, torches, vines };
}

// ---- the fence: round log posts joined by two rails. In the section `open` the upper rail has come down at one end.
function fence(points, open = -1) {
  const group = new THREE.Group();

  for (const [i, [x, z]] of points.entries()) {
    group.add(lathe([[0, 0], [0.11, 0], [0.12, 0.05], [0.1, 0.1], [0.095, 0.85], [0.11, 0.9], [0.09, 0.98], [0, 1.0]], WOOD, x, 0, z, 24));

    if (i === points.length - 1) continue;

    const [nx, nz] = points[i + 1];

    for (const y of [0.36, 0.72]) {
      const fallen = i === open && y > 0.5;
      const end = fallen ? [x + (nx - x) * 0.86, 0.06, z + (nz - z) * 0.86 + 0.22] : [nx, y, nz];

      group.add(tube([[x, y, z], [(x + end[0]) / 2, (y + end[1]) / 2 - 0.02, (z + end[2]) / 2], end], 0.04, WOOD_DARK, 12));

      if (fallen) group.add(sphere(0.052, WOOD_DARK, ...end));
    }
  }

  return group;
}

/** How wide an egg `height` tall is at `v` of its height: round at both ends, the top the narrower. */
const eggRadius = (height, v) => 0.38 * height * Math.sqrt(Math.max(0, 4 * v * (1 - v))) * (1 - 0.2 * v);

/** The outline of an egg `height` tall between `from` and `to` of its height (0 the round base, 1 the top). */
const eggProfile = (height, from = 0, to = 1) => Array.from({ length: 33 }, (_, i) => {
  // the points crowd toward both ends, where the shell turns most
  const v = from + (0.5 - 0.5 * Math.cos((i / 32) * Math.PI)) * (to - from);

  return [eggRadius(height, v), v * height];
});

/** Round spots on an egg's shell, pressed flat against it. */
function spots(target, height, color, seed, from = 0.12, to = 0.9) {
  const next = sequence(seed);
  const material = standard(color, 0.6);

  for (let i = 0; i < 9; i++) {
    const v = from + next() * (to - from);
    const a = next() * TAU;
    const r = eggRadius(height, v);
    const spot = sphere(height * (0.05 + next() * 0.04), material, Math.cos(a) * r * 0.97, v * height, Math.sin(a) * r * 0.97, 1);

    spot.castShadow = false;
    target.add(spot);
  }
}

// ---- the nest: a ring of round twigs, two eggs that wait and one that hatches
function nest() {
  const group = new THREE.Group();
  const next = sequence(83);
  const shell = standard(0xfff3dc, 0.55);
  const twigs = [standard(0xa87444, 0.9), standard(0x8f5e34, 0.9), standard(0xc08a56, 0.9)];

  for (let i = 0; i < 3; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.62 - i * 0.05, 0.11 - i * 0.012, 12, 48), twigs[i], 0, 0.1 + i * 0.1, 0);

    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  // round knots in the weave, and a bed of straw inside
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + next() * 0.3;

    group.add(sphere(0.06 + next() * 0.03, twigs[i % 3], Math.cos(a) * 0.7, 0.12 + next() * 0.2, Math.sin(a) * 0.7, 0.8));
  }

  group.add(cylinder(0.56, 0.56, 0.1, standard(0xe9cf8e, 0.95), 0, 0.09, 0, 48));

  for (const [x, z, height, color, lean, seed] of [[-0.3, 0.04, 0.6, C.mint, -0.16, 5], [0.34, 0.1, 0.52, C.pink, 0.2, 9]]) {
    const egg = new THREE.Group();

    egg.add(lathe(eggProfile(height), shell, 0, 0, 0, 40));
    spots(egg, height, color, seed);
    egg.position.set(x, 0.1, z);
    egg.rotation.z = lean;
    group.add(egg);
  }

  // the egg that hatches: its lower shell, its cap, the light inside it, and the baby
  const H = 0.66;
  const CUT = 0.6;
  const hatching = new THREE.Group();
  const cap = new THREE.Group();
  const baby = new THREE.Group();
  const skin = standard(0x9be07a, 0.6);
  const rim = eggRadius(H, CUT);
  const inside = cylinder(rim * 0.94, rim * 0.94, 0.02, lit(0xffe6a3, 2), 0, CUT * H - 0.012, 0, 32);
  const glow = halo(0.6, 0xffe08a, 0);
  const light = new THREE.PointLight(0xffe0a0, 0, 3.5, 1.8);

  inside.castShadow = false;
  hatching.add(lathe(eggProfile(H, 0, CUT), shell, 0, 0, 0, 40), mesh(new THREE.TorusGeometry(rim, 0.016, 8, 40), shell, 0, CUT * H, 0), inside);
  hatching.children[1].rotation.x = Math.PI / 2;
  spots(hatching, H, C.sky, 13, 0.12, CUT - 0.08);

  // the cap's own origin is the middle of the cut, so it can lift and tip there
  const capShell = lathe(eggProfile(H, CUT, 1).map(([r, y]) => [r, y - CUT * H]), shell, 0, 0, 0, 40);
  const capRim = mesh(new THREE.TorusGeometry(rim, 0.016, 8, 40), shell);

  capRim.rotation.x = Math.PI / 2;
  cap.add(capShell, capRim);
  spots(cap, H, C.sky, 17, CUT + 0.06, 0.9);
  cap.children.slice(2).forEach((spot) => { spot.position.y -= CUT * H; });
  cap.position.y = CUT * H;

  // the baby: a round head, a round snout, two eyes, two bumps for a crest. It looks at the reader.
  baby.add(sphere(0.135, skin, 0, 0, 0), sphere(0.095, standard(0xb4ec8e, 0.6), 0, -0.035, 0.1, 0.78), sphere(0.03, skin, -0.04, 0.125, -0.02), sphere(0.03, skin, 0.045, 0.12, -0.04));

  for (const side of [-1, 1]) baby.add(sphere(0.044, standard(0xffffff, 0.3), side * 0.062, 0.045, 0.1), sphere(0.023, standard(C.ink, 0.3), side * 0.066, 0.05, 0.136), sphere(0.011, standard(C.ink, 0.5), side * 0.035, -0.02, 0.185));

  baby.traverse((o) => { o.castShadow = false; });
  glow.position.y = CUT * H + 0.05;
  light.position.set(0, CUT * H + 0.25, 0.2);
  hatching.add(baby, cap, glow, light);
  hatching.position.set(0.02, 0.1, -0.2);
  group.add(hatching);

  return { group, hatching, cap, baby, glow, light, inside, top: CUT * H };
}

// ---- the jeep: a round yellow body, round lights, a hoop over its seats with three lamps on it. Built looking
// along +z.
function jeep() {
  const group = new THREE.Group();
  const yellow = standard(0xffc21a, 0.4);
  const cream = standard(0xfff3df, 0.5);
  const dark = standard(C.ink, 0.65);
  const lamps = [];

  group.add(
    box(1.1, 0.5, 1.8, yellow, 0, 0.62, 0, 0.22),
    box(1.0, 0.2, 0.66, yellow, 0, 0.9, 0.5, 0.1),
    box(1.13, 0.09, 1.83, standard(C.indigo, 0.45), 0, 0.5, 0, 0.045),
    box(1.2, 0.13, 0.16, standard(C.slate, 0.5, { metalness: 0.3 }), 0, 0.37, 0.9, 0.065),
    box(0.46, 0.2, 0.05, cream, 0, 0.68, 0.905, 0.025),
  );

  // round slots in the grille, two big round headlights
  for (let i = 0; i < 4; i++) group.add(sphere(0.035, dark, -0.15 + i * 0.1, 0.68, 0.93, 1.6));

  for (const side of [-1, 1]) {
    const head = sphere(0.115, lit(0xfff1c4, 2.2), side * 0.38, 0.69, 0.87, 1);
    const rim = mesh(new THREE.TorusGeometry(0.12, 0.022, 10, 32), cream, side * 0.38, 0.69, 0.9);

    head.castShadow = false;
    group.add(head, rim);
    lamps.push(head.material);
  }

  for (const [x, z] of [[-0.5, -0.58], [0.5, -0.58], [-0.5, 0.58], [0.5, 0.58]]) {
    const wheel = new THREE.Group();

    wheel.add(mesh(new THREE.TorusGeometry(0.19, 0.105, 14, 40), dark), cylinder(0.15, 0.15, 0.16, cream, 0, 0, 0, 32));
    wheel.children[1].rotation.x = Math.PI / 2;
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 0.295, z);
    group.add(wheel);
  }

  // the windscreen: a round frame and its glass, leaning back
  const screen = new THREE.Group();
  const pane = box(0.86, 0.36, 0.02, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.2, 0, 0.01);

  pane.castShadow = false;
  pane.renderOrder = 6;
  screen.add(pane, mesh(new THREE.TorusGeometry(0.2, 0.03, 10, 48), cream, 0, 0.2, 0));
  screen.children[1].scale.set(2.25, 1, 1);
  screen.position.set(0, 0.96, 0.2);
  screen.rotation.x = -0.22;
  group.add(screen);

  // two seats, and the hoop over them with its three lamps
  for (const side of [-1, 1]) group.add(box(0.36, 0.42, 0.14, standard(C.indigo, 0.6), side * 0.25, 1.02, -0.3, 0.07));

  const hoop = mesh(new THREE.TorusGeometry(0.47, 0.045, 12, 48, Math.PI), cream, 0, 0.86, -0.5);

  hoop.scale.y = 1.35;
  group.add(hoop);

  for (const x of [-0.24, 0, 0.24]) {
    const lamp = sphere(0.07, lit(0xffd36b, 2), x, 0.86 + Math.sqrt(0.47 ** 2 - x * x) * 1.35 + 0.06, -0.46, 1);

    lamp.castShadow = false;
    group.add(lamp);
    lamps.push(lamp.material);
  }

  return { group, lamps };
}

// ---- far behind: the cloud of jungle dusk and the small volcano in it
function distance() {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(0,128,140,0.94)');
    deep.addColorStop(0.5, 'rgba(0,150,146,0.84)');
    deep.addColorStop(0.8, 'rgba(30,186,160,0.3)');
    deep.addColorStop(1, 'rgba(30,186,160,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // the glow of the volcano on the left, the last of the day low on the right
    for (const [x, y, r, color, alpha] of [[0.24, 0.4, 0.2, '255,150,70', 0.4], [0.62, 0.6, 0.36, '255,220,130', 0.34]]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},${alpha})`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  // the volcano is painted, pale with distance, and its foot fades into the cloud: it is far away, not on the island
  const mountain = sprite(canvasTexture([640, 448], (g, w, h) => {
    const body = g.createLinearGradient(0, h * 0.1, 0, h);

    body.addColorStop(0, 'rgba(168,140,214,0.98)');
    body.addColorStop(0.5, 'rgba(128,124,196,0.9)');
    body.addColorStop(0.9, 'rgba(60,140,150,0)');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(w * 0.02, h);
    g.bezierCurveTo(w * 0.24, h * 0.86, w * 0.36, h * 0.3, w * 0.42, h * 0.16);
    g.bezierCurveTo(w * 0.45, h * 0.09, w * 0.55, h * 0.09, w * 0.58, h * 0.16);
    g.bezierCurveTo(w * 0.64, h * 0.3, w * 0.76, h * 0.86, w * 0.98, h);
    g.closePath();
    g.fill();

    // fire in its mouth and one round stream down its side
    g.strokeStyle = '#ff9a3d';
    g.fillStyle = '#ff9a3d';
    g.lineCap = 'round';
    g.lineWidth = 12;

    for (const [x0, x1, y1] of [[0.47, 0.44, 0.34]]) {
      g.beginPath();
      g.moveTo(w * x0, h * 0.14);
      g.quadraticCurveTo((w * (x0 + x1)) / 2, h * 0.22, w * x1, h * y1);
      g.stroke();
      g.beginPath();
      g.arc(w * x1, h * y1, 10, 0, TAU);
      g.fill();
    }

    g.fillStyle = '#ffb04d';
    g.beginPath();
    g.ellipse(w / 2, h * 0.125, w * 0.07, h * 0.034, 0, 0, TAU);
    g.fill();
  }), 0xffffff, 1);
  const fire = halo(0.34, 0xffd27a, 0.9);
  const glow = halo(1.25, 0xff9a3d, 0.6);

  mountain.position.set(VOLCANO.x, VOLCANO.y + VOLCANO.height / 2, VOLCANO.z);
  mountain.scale.set(VOLCANO.height * 1.43, VOLCANO.height, 1);
  fire.position.set(VOLCANO.x, VOLCANO.y + VOLCANO.height * 0.89, VOLCANO.z + 0.05);
  fire.renderOrder = 2;
  glow.position.set(VOLCANO.x, VOLCANO.y + VOLCANO.height * 0.92, VOLCANO.z - 0.1);
  glow.renderOrder = 0;
  cloud.position.set(0, 1.8, -8.5);
  cloud.scale.set(11.2, 6.5, 1);
  cloud.renderOrder = -1;
  group.add(cloud, glow, mountain, fire);

  return { group, fire, glow };
}

export function build(scene, { loop, heights, jump, tuck, curve, X, Y, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const park = gate();
  const eggs = nest();
  const car = jeep();
  const far = distance();
  const P = GATE.post;

  set.add(place(ground(), 0, GROUND.z), shadowCatcher(GROUND.radius - 0.1, 0.008, GROUND.z, 0.32));

  // the island's own soft shadow on the page, fading to nothing well inside the frame
  set.add(decal(radial([[0, 'rgba(40,60,120,0.28)'], [0.6, 'rgba(40,60,120,0.14)'], [1, 'rgba(40,60,120,0)']]), 0, -0.6, GROUND.z, 3.9, 3.5, 0));
  set.add(far.group, place(park.group, GATE.x, GATE.z), place(eggs.group, NEST.x, NEST.z, 0.25));
  eggs.group.scale.setScalar(NEST.scale);
  car.group.scale.setScalar(JEEP.scale);
  set.add(place(car.group, JEEP.x, JEEP.z, JEEP.yaw));

  // the fence: one section outside the left post, toward the rim, its upper rail down
  set.add(fence([[GATE.x - P - 0.3, GATE.z - 0.02], [GATE.x - P - 0.62, GATE.z + 0.12]], 0));

  const cast = {
    // Liruf is home: he hops from one foot to the other beside the nest, turns to show the others, and jumps highest when the egg opens
    liruf: { x: -1.32, z: 0.0, yaw: 0.3, act: {
      hop: [[0, 0], [0.45, 0.1], [0.9, 0], [1.3, -0.03], [1.5, 0], [1.75, -0.035], [2.3, 0.32], [2.62, -0.03], [2.85, 0], [3.6, 0], [4.0, 0.12], [4.4, 0], [4.8, 0.1], [5.2, 0], [6.6, 0], [7.0, 0.09], [7.4, 0], [L, 0]],
      tuck: [[0, 0], [0.45, 0.3], [0.9, 0], [2.0, 0], [2.3, 0.9], [2.6, 0], [3.6, 0], [4.0, 0.35], [4.4, 0], [4.8, 0.3], [5.2, 0], [6.6, 0], [7.0, 0.3], [7.4, 0], [L, 0]],
      turn: [[0, 0.1], [1.4, -0.35], [3.2, -0.35], [4.4, 0.12], [5.6, 0.12], [7, 0.1], [L, 0.1]], yaw: [[0, 0.1], [1.2, -0.5], [3.2, -0.45], [4.2, 0.2], [5.8, 0.2], [L, 0.1]],
      pitch: [[0, -0.1], [1.5, 0.12], [2.3, -0.2], [3, 0.1], [4.2, -0.22], [L, -0.1]], lean: [[0, 0], [1.5, 0.1], [2.3, -0.16], [2.9, 0.12], [4, -0.08], [L, 0]],
      roll: [[0, 0.14], [1.4, -0.16], [2.3, 0.14], [3.4, -0.14], [4.6, 0.16], [6, -0.1], [L, 0.14]], tilt: [[0, 0.06], [0.45, -0.06], [0.9, 0.06], [2.3, -0.1], [3, 0], [4, 0.07], [4.8, -0.07], [5.4, 0], [7, 0.06], [L, 0.06]],
    } },
    // Zara holds her hands together in front of her (turned in `update`) and rises on her toes, all eyes for the egg
    zara: { x: -0.56, z: 0.42, yaw: 0.1, act: {
      hop: jump(2.45, 0.14), tuck: tuck(2.45, 0.4), lean: [[0, 0.04], [1.6, 0.1], [2.45, -0.08], [3.2, 0.06], [L, 0.04]],
      yaw: [[0, 0.3], [1.2, -0.5], [3.6, -0.5], [4.8, 0], [6.4, 0.3], [L, 0.3]], pitch: [[0, -0.2], [1.2, 0.1], [3.6, 0.1], [4.8, -0.14], [6.4, -0.26], [L, -0.2]],
      roll: [[0, 0.08], [1.2, -0.12], [3.6, -0.1], [4.8, 0.1], [L, 0.08]], turn: [[0, 0], [1.3, -0.2], [3.6, -0.2], [4.8, 0], [L, 0]],
    } },
    // Rho takes it all in: the arch high over him, the vines, the far mountain, leaning back to see, and jumps too
    rho: { x: 0.06, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.5, 0.17), tuck: tuck(2.5, 0.7), lean: [[0, -0.12], [1.8, -0.16], [2.6, -0.1], [3.1, 0.06], [4, -0.12], [L, -0.12]],
      yaw: [[0, 0.5], [1.4, 0.5], [2.6, -0.4], [4.4, -0.4], [5.8, 0.1], [7, 0.5], [L, 0.5]], pitch: [[0, -0.36], [1.4, -0.36], [2.6, -0.05], [3.2, 0.1], [4.4, -0.2], [5.8, -0.4], [L, -0.36]],
      roll: [[0, -0.1], [2.6, 0.12], [5, -0.12], [L, -0.1]], turn: [[0, 0.16], [2.6, -0.14], [5.4, 0.1], [L, 0.16]], tilt: [[0, 0], [2.6, 0.07], [3.4, 0], [L, 0]],
    } },
    // Dina has her nose on the footprint in front of her, lifts it at the noise of the shell, and rears up
    dina: { x: 0.9, z: 0.15, yaw: 0, act: {
      hop: jump(2.9, 0.1), rear: [[0, 0], [2.4, 0], [2.9, 0.9], [3.5, 0], [L, 0]], pitch: [[0, 0.22], [0.8, 0.3], [1.6, 0.22], [2.3, -0.1], [2.9, -0.4], [3.8, -0.2], [5.4, -0.16], [6.6, 0.2], [L, 0.22]],
      roll: [[0, 0.14], [0.8, -0.1], [1.6, 0.14], [2.9, -0.1], [4.6, 0.18], [L, 0.14]], yaw: [[0, 0.1], [1.6, 0.2], [2.4, 0.1], [4.6, 0.25], [5.8, 0.3], [L, 0.1]],
      lean: [[0, 0.1], [1.8, 0.1], [2.4, 0], [5.6, 0], [6.6, 0.1], [L, 0.1]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], clear: name === 'dina' ? 0.8 : 0.5, peak: { liruf: 2.3, zara: 2.45, rho: 2.5, dina: 2.9 }[name] }));
  // how tightly Zara's hands are held together in front of her
  const held = [[0, 0.9], [1.8, 1], [2.45, 0.8], [3.2, 1], [L, 0.9]];
  // puffs from the volcano, fireflies over the clearing, specks of light from the egg once it has opened
  const effects = [
    sparkles(fx, { loop, actors, each: 5, seed: 19 }),
    landings(fx, { actors, color: 0xf7e6c0 }),
    rising(fx, { loop, at: { x: VOLCANO.x, y: VOLCANO.y + VOLCANO.height * 0.93, z: VOLCANO.z + 0.1 }, radius: 0.14, height: 0.95, count: 6, color: [0xffd9b8, 0xffc49a, 0xffe9d6], size: [0.26, 0.44], seed: 3, sway: 0.08, depth: 0.2 }),
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -1.0 }, radius: 3.0, height: 2.5, count: 30, color: [0xfff59a, 0xd8ff8a, 0xffffff], size: [0.03, 0.075], seed: 6, sway: 0.16, depth: 0.7 }),
  ];
  const [nestX, nestZ] = [NEST.x - 0.02, NEST.z - 0.14];
  const hatchFx = new THREE.Group();
  const hatchlings = rising(hatchFx, { loop, at: { x: nestX, y: 0.45, z: nestZ }, radius: 0.24, height: 1.0, count: 14, color: [0xffe6a3, 0xffffff, 0xa8f0d6], size: [0.05, 0.12], seed: 12, texture: TEXTURES.star, sway: 0.06 });

  scene.add(set, fx, hatchFx);

  return {
    cast,
    still: 2.45,
    camera: { y: 2.3, dist: 14.6, lookY: 1.36 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - HATCH;
      // the egg: it rocks before it opens, the cap lifts with the baby under it, and both go back down before the loop ends
      const up = Math.max(0, Math.min(1, since / 0.4)) * Math.max(0, Math.min(1, (6.9 - t) / 0.5));
      const eased = up * up * (3 - 2 * up);
      const rock = t > 0.9 && t < HATCH ? Math.sin((t - 0.9) * 17) * 0.09 * ((t - 0.9) / (HATCH - 0.9)) : 0;
      const flare = since > 0 ? Math.exp(-since * 1.4) : 0;
      const peek = eased * (0.17 + Math.sin(w * 3) * 0.012);

      eggs.hatching.rotation.z = rock;
      eggs.baby.position.y = eggs.top - 0.16 + peek;
      eggs.baby.rotation.set(-0.1, eased * Math.sin(w * 2) * 0.5 + 0.35, eased * Math.sin(w * 3) * 0.12);
      eggs.cap.position.y = eggs.top + peek * 0.86;
      eggs.cap.rotation.set(-eased * 0.34, 0, eased * 0.14);
      eggs.inside.material.emissiveIntensity = 0.4 + eased * 1.8;
      eggs.glow.material.opacity = eased * 0.42 + flare * 0.5;
      eggs.glow.scale.setScalar(1.2 * (1 + flare * 0.6));
      eggs.light.intensity = eased * 3.5 + flare * 5;

      // the torches flicker, each its own way
      park.torches.forEach(({ flame, glow, light }, i) => {
        const flicker = Math.sin(w * 13 + i * 2) * 0.5 + Math.sin(w * 29 + i) * 0.3 + Math.sin(w * 7 + i * 4) * 0.2;

        flame.scale.set(1 - flicker * 0.06, 1 + flicker * 0.14, 1 - flicker * 0.06);
        flame.rotation.z = Math.sin(w * 9 + i * 3) * 0.1;
        glow.material.opacity = 0.5 + flicker * 0.1;
        light.intensity = 5 + flicker * 1.4;
      });

      park.sign.rotation.z = Math.sin(w) * 0.05;
      park.vines.forEach((vine, i) => { vine.rotation.z = Math.sin(w + i * 1.3) * 0.07; });
      far.fire.scale.setScalar(0.68 * (1 + Math.sin(w * 3) * 0.1));
      far.glow.material.opacity = 0.55 + Math.sin(w * 3) * 0.12;
      car.lamps.forEach((lamp, i) => { lamp.emissiveIntensity = i < 2 ? 2.1 : 1.2 + 1.4 * Math.max(0, Math.sin(w * 4 - i * 2.1)); });

      // Zara's hands come together in front of her chest
      const hold = curve(held, t);
      const zara = rigs.zara;

      for (const [side, sign] of [['Right', 1], ['Left', -1]]) {
        zara.rot(`${side}Arm`, X, -hold * 0.2);
        zara.rot(`${side}Arm`, Z, sign * hold * 0.1);
        zara.rot(`${side}ForeArm`, X, -hold * 1.9);
        zara.rot(`${side}ForeArm`, Y, sign * hold * 0.5);
      }

      for (const effect of effects) effect(t);

      hatchlings(t);

      for (const speck of hatchFx.children) speck.material.opacity *= eased;
    },
  };
}
