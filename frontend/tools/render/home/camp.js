// Home composition "camp": the four mentors around a campfire at night, the moment the story reaches its best part:
// the fire flares up and a shooting star crosses the sky.
//
// The setting is an island: a round clearing of grass with earth underneath. The fire burns at the front, in the
// middle, so its light falls warm on the four faces; two marshmallows on sticks are stuck in the ground beside it
// (nobody holds them). Behind the mentors, in the gap between the two pairs, a round tent glows from inside. On the
// left, clear of everybody, a young pine with a round crown, and a lantern on the grass in front of it. On the
// right, beyond Dina and with air between them, a round log to sit on with a mug of cocoa left on it. Far
// behind, a moon and stars hang in a cloud of deep indigo: the cloud is what lets them show on the light page too,
// and it fades to nothing before the frame's borders. Fireflies drift through.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.25, z: -0.6 };
const FIRE = { x: -0.2, z: 1.5 };
const TENT = { x: -0.2, z: -2.45 };
const PINE = { x: -3.05, z: -0.6 };
const LANTERN = { x: -2.55, z: 0.95 };
const SEAT = { x: 2.87, z: -0.1 };
const FLARES = 2.0; // the second the fire flares up
const STAR = { from: 2.0, lasts: 0.95 }; // when the shooting star crosses

// ---- the ground: night grass, a round of bare earth where the fire burns, small pale flowers
function ground() {
  const group = new THREE.Group();
  const next = sequence(43);
  const R = GROUND.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const px = (v) => ((v / R + 1) / 2) * w;

    g.fillStyle = '#3f9f63';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 130;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(104,196,118,0.5)' : 'rgba(34,120,86,0.45)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 130; i++) {
      g.fillStyle = ['#ffffff', '#cfd0ff', '#fff0b8'][i % 3];
      g.beginPath();
      g.arc(next() * w, next() * w, 4 + next() * 4, 0, TAU);
      g.fill();
    }

    // the earth around the fire, soft at its edge
    // on this picture, across is the clearing's depth and down is its left
    const fx = px(FIRE.z - GROUND.z);
    const fz = px(-FIRE.x);
    const earth = g.createRadialGradient(fx, fz, 0, fx, fz, (0.72 / (R * 2)) * w);

    earth.addColorStop(0, 'rgba(120,82,52,1)');
    earth.addColorStop(0.7, 'rgba(132,92,58,1)');
    earth.addColorStop(1, 'rgba(132,92,58,0)');
    g.fillStyle = earth;
    g.fillRect(0, 0, w, w);
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x2f8a52, 0.9), standard(0xffffff, 0.95, { map: picture }), standard(C.earth, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x379a5a, 0.95), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.78], [1.2, -0.72], [2.2, -0.52], [2.9, -0.28], [R - 0.04, -0.1]], standard(C.earth, 0.95)));

  return group;
}

// ---- a pine: a trunk and a crown of three round tiers, the lowest the widest
function pine(height, seed) {
  const group = new THREE.Group();
  const greens = [standard(0x1f7a55, 0.9), standard(0x279062, 0.9), standard(0x30a570, 0.9)];
  const next = sequence(seed);
  const crown = new THREE.Group();

  group.add(cylinder(0.11, 0.16, height * 0.45, standard(0x7c5230, 0.9), 0, height * 0.225, 0, 20));

  for (let i = 0; i < 3; i++) {
    const r = height * (0.22 - i * 0.055);
    const tier = sphere(r, greens[i], (next() - 0.5) * 0.08, height * (0.2 + i * 0.185), 0, 0.82);

    crown.add(tier);
  }

  crown.position.y = height * 0.3;
  group.add(crown);

  return { group, crown };
}

// ---- the tent: a round dome in panels, its cloth lit from inside, with a closed door
function tent() {
  const group = new THREE.Group();
  const cloth = canvasTexture([1024, 512], (g, w, h) => {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#7a74ff' : '#9a95ff';
      g.fillRect(((k - 0.5) / 8) * w, 0, w / 8 + 1, h);
    }

    // the light inside is strongest low down
    const warm = g.createLinearGradient(0, h * 0.25, 0, h);

    warm.addColorStop(0, 'rgba(255,214,150,0)');
    warm.addColorStop(1, 'rgba(255,214,150,0.55)');
    g.fillStyle = warm;
    g.fillRect(0, 0, w, h);

    // the door, in the middle of the picture: a round arch, its flaps closed and darker than the cloth (the fire
    // burns in front of it and has to stand out), with a line of light where they meet
    g.fillStyle = '#4b40dc';
    g.beginPath();
    g.moveTo(w / 2 - 70, h);
    g.lineTo(w / 2 - 70, h * 0.62);
    g.quadraticCurveTo(w / 2 - 70, h * 0.34, w / 2, h * 0.34);
    g.quadraticCurveTo(w / 2 + 70, h * 0.34, w / 2 + 70, h * 0.62);
    g.lineTo(w / 2 + 70, h);
    g.fill();
    g.strokeStyle = '#3a2fc0';
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.stroke();
    g.strokeStyle = 'rgba(255,214,140,0.95)';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(w / 2, h * 0.4);
    g.lineTo(w / 2, h);
    g.stroke();
  });
  const dome = lathe([[1.22, 0], [1.2, 0.22], [1.06, 0.68], [0.76, 1.1], [0.38, 1.37], [0.02, 1.46]], standard(0xffffff, 0.8, { map: cloth, emissive: 0xffffff, emissiveMap: cloth, emissiveIntensity: 0.55 }));
  const hem = mesh(new THREE.TorusGeometry(1.22, 0.05, 12, 96), standard(C.indigoDeep, 0.8), 0, 0.04, 0);
  const light = new THREE.PointLight(0xffd9a0, 2.5, 4, 1.8);

  // the picture's middle faces the reader
  dome.rotation.y = Math.PI;
  hem.rotation.x = Math.PI / 2;
  light.position.set(0, 0.6, 1.5);
  group.add(dome, hem, sphere(0.09, standard(C.gold, 0.4, { metalness: 0.4 }), 0, 1.48, 0), light);

  return { group, dome };
}

// ---- the fire: a ring of stones, crossed logs, and flames that are round tongues, one inside the other
function campfire() {
  const group = new THREE.Group();
  const next = sequence(5);
  const stones = [standard(C.stone, 0.95), standard(0xa9adc6, 0.95), standard(C.stoneDark, 0.95)];
  const bark = standard(0x6e4526, 0.9);
  const flames = new THREE.Group();

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const r = 0.085 + next() * 0.03;

    group.add(sphere(r, stones[i % 3], Math.cos(a) * 0.38, r * 0.5, Math.sin(a) * 0.38, 0.7));
  }

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;

    group.add(tube([[Math.cos(a) * 0.27, 0.05, Math.sin(a) * 0.27], [Math.cos(a + Math.PI) * 0.08, 0.2, Math.sin(a + Math.PI) * 0.08]], 0.05, bark, 8));
  }

  // The fire is made of round shapes, the red ones behind, the pale ones in front, each wobbling on its own:
  // [x, y, z, radius, how tall for its width, color]. It stands no higher than a mentor's hip.
  const shapes = [
    [0, 0.27, -0.05, 0.2, 1.15, 0xff5a1f], [-0.15, 0.21, 0, 0.12, 1.1, 0xff5a1f], [0.16, 0.2, 0, 0.115, 1.1, 0xff5a1f], [0.03, 0.47, -0.04, 0.125, 1.2, 0xff5a1f], [-0.03, 0.61, -0.03, 0.07, 1.15, 0xff5a1f],
    [0, 0.23, 0.07, 0.15, 1.1, 0xff9a1f], [0.02, 0.41, 0.06, 0.095, 1.2, 0xff9a1f], [0, 0.18, 0.15, 0.1, 1.05, 0xffd84a], [0, 0.15, 0.21, 0.055, 1, 0xfff3b8],
  ].map(([x, y, z, radius, tall, color], i) => {
    const one = sphere(radius, new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, y, z, tall);

    one.castShadow = false;
    one.receiveShadow = false;
    flames.add(one);

    return { one, x, y, tall, phase: i * 1.9 };
  });

  const glow = halo(0.8, 0xff9a3c, 0.5);
  const light = new THREE.PointLight(0xff9440, 14, 8, 1.5);

  glow.position.set(0, 0.4, -0.3);
  light.position.set(0, 0.75, 0.05);
  group.add(flames, glow, light);

  return { group, flames, shapes, glow, light };
}

// ---- a lantern: a round glass of light between a foot and a cap, with a ring to carry it by
function lantern() {
  const group = new THREE.Group();
  const iron = standard(C.slate, 0.5, { metalness: 0.3 });
  const glow = halo(0.42, 0xffd36b, 0.55);
  const light = new THREE.PointLight(0xffd08a, 3, 3.5, 1.8);
  const ring = mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 28), iron, 0, 0.47, 0);

  glow.position.y = 0.2;
  light.position.set(0, 0.25, 0.2);
  group.add(lathe([[0, 0], [0.12, 0], [0.13, 0.03], [0.09, 0.07], [0, 0.07]], iron), sphere(0.115, lit(0xffe08a, 2.0), 0, 0.2, 0, 1.15), lathe([[0, 0.31], [0.11, 0.31], [0.12, 0.34], [0.05, 0.4], [0, 0.41]], iron), ring, glow, light);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;

    group.add(cylinder(0.008, 0.008, 0.26, iron, Math.cos(a) * 0.105, 0.19, Math.sin(a) * 0.105, 6));
  }

  return group;
}

// ---- a round log to sit on, with a mug of cocoa left on it
function seat() {
  const group = new THREE.Group();
  const height = 0.4;
  const rings = canvasTexture([256, 256], (g, w) => {
    g.fillStyle = '#e9c38d';
    g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(160,104,58,0.6)';
    g.lineWidth = 5;

    for (const r of [0.14, 0.26, 0.37]) { g.beginPath(); g.arc(w / 2, w / 2, w * r, 0, TAU); g.stroke(); }
  });
  const top = mesh(new THREE.CircleGeometry(0.21, 40), standard(0xffffff, 0.8, { map: rings }), 0, height + 0.002, 0);
  const handle = mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 24), standard(C.red, 0.5), 0.09, height + 0.08, 0);

  top.rotation.x = -Math.PI / 2;
  group.add(
    lathe([[0, 0], [0.26, 0], [0.27, 0.05], [0.24, 0.14], [0.23, height - 0.03], [0.21, height], [0, height]], standard(0x8a5a36, 0.9)), top,
    lathe([[0, 0], [0.065, 0], [0.078, 0.02], [0.082, 0.155], [0, 0.155]], standard(C.red, 0.5), 0, height, 0, 24), handle,
    sphere(0.022, standard(0xffffff, 0.6), -0.015, height + 0.16, 0.015, 0.7),
  );

  return group;
}

/** A short thick stick stuck upright in the ground, a round marshmallow on its end. */
function marshmallow(lean) {
  const group = new THREE.Group();

  group.add(
    cylinder(0.028, 0.032, 0.36, standard(0x8a5a36, 0.8), 0, 0.17, 0, 12),
    lathe([[0, 0], [0.05, 0], [0.078, 0.03], [0.08, 0.1], [0.05, 0.135], [0, 0.14]], standard(0xffffff, 0.6, { emissive: 0xffb07a, emissiveIntensity: 0.35 }), 0, 0.33, 0, 24),
    sphere(0.05, standard(0xe8a45c, 0.6), 0, 0.455, 0, 0.45),
  );
  group.rotation.z = lean;

  return group;
}

// ---- far behind: a cloud of deep indigo with stars in it, and the moon
function sky(fx, loop) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(30,26,104,0.96)');
    deep.addColorStop(0.55, 'rgba(40,34,132,0.84)');
    deep.addColorStop(0.82, 'rgba(60,52,172,0.3)');
    deep.addColorStop(1, 'rgba(60,52,172,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // a paler band low down, like the last light over a horizon
    const low = g.createRadialGradient(w / 2, w * 0.66, 0, w / 2, w * 0.66, w * 0.34);

    low.addColorStop(0, 'rgba(120,110,255,0.3)');
    low.addColorStop(1, 'rgba(120,110,255,0)');
    g.fillStyle = low;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);
  const face = canvasTexture([256, 256], (g, w) => {
    g.fillStyle = '#fff3c9';
    g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(226,196,130,0.6)';

    for (const [x, y, r] of [[0.3, 0.35, 0.09], [0.62, 0.3, 0.06], [0.55, 0.62, 0.11], [0.28, 0.66, 0.05], [0.78, 0.55, 0.045]]) { g.beginPath(); g.arc(w * x, w * y, w * r, 0, TAU); g.fill(); }
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }));
  const shine = halo(1.2, 0xfff0c0, 0.4);

  moon.position.set(2.6, 3.5, -7);
  moon.renderOrder = 1;
  shine.position.set(2.6, 3.5, -7.1);
  shine.renderOrder = 1;
  cloud.position.set(0, 1.5, -8);
  cloud.scale.set(10.6, 6.3, 1);
  group.add(cloud, shine, moon);

  const next = sequence(17);
  const updates = [];

  for (let i = 0; i < 60; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(next());
    const star = sprite(i % 5 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0xfff0b8, 0xdcd9ff][i % 3], 1);
    const size = (i % 5 ? 0.05 : 0.2) + next() * 0.07;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    star.position.set(Math.cos(a) * r * 4.6, 1.75 + Math.sin(a) * r * 2.6, -7.5);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.55 + 0.45 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = twinkle;
    });
  }

  return { group, update: (t) => { for (const update of updates) update(t); } };
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

export function build(scene, { loop, heights, curve, jump, tuck, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const fire = campfire();
  const home = tent();
  const far = sky(fx, loop);
  const tree = pine(1.85, 3);

  set.add(place(ground(), 0, GROUND.z), shadowCatcher(GROUND.radius - 0.1, 0.008, GROUND.z, 0.32), far.group);
  set.add(decal(radial([[0, 'rgba(40,40,120,0.3)'], [0.6, 'rgba(40,40,120,0.15)'], [1, 'rgba(40,40,120,0)']]), 0, -0.84, GROUND.z, 3.7, 3.4, 0));
  // the fire's light on the grass, fading to nothing
  set.add(decal(radial([[0, 'rgba(255,170,70,0.5)'], [0.4, 'rgba(255,150,60,0.22)'], [1, 'rgba(255,150,60,0)']]), FIRE.x, 0.012, FIRE.z - 0.3, 2.2, 1.7, 2));
  set.add(place(fire.group, FIRE.x, FIRE.z), place(home.group, TENT.x, TENT.z));
  set.add(place(marshmallow(0.12), FIRE.x - 0.44, FIRE.z + 0.4), place(marshmallow(-0.12), FIRE.x + 0.44, FIRE.z + 0.4));
  set.add(place(tree.group, PINE.x, PINE.z), place(lantern(), LANTERN.x, LANTERN.z), place(seat(), SEAT.x, SEAT.z, 0.5));

  // sparks thrown up when the fire flares, and the shooting star
  const next = sequence(61);
  const burst = Array.from({ length: 18 }, () => {
    const spark = sprite(TEXTURES.dot, [0xffb347, 0xffe27a, 0xff7a2a][Math.floor(next() * 3)], 8);

    fx.add(spark);

    return { spark, vx: (next() - 0.5) * 1.3, vy: 1.6 + next() * 1.5, size: 0.05 + next() * 0.06, delay: next() * 0.2 };
  });
  const streak = sprite(canvasTexture([256, 32], (g, w, h) => {
    const tail = g.createLinearGradient(0, 0, w, 0);

    tail.addColorStop(0, 'rgba(255,255,255,0)');
    tail.addColorStop(0.8, 'rgba(255,244,200,0.9)');
    tail.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = tail;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2, h / 2.6, 0, 0, TAU);
    g.fill();
  }), 0xffffff, 2);
  const head = sprite(TEXTURES.star, 0xfff4c8, 2);

  fx.add(streak, head);

  const cast = {
    // Liruf leans in to hear, and jumps the highest when the fire flares
    liruf: { x: -2.04, z: -0.15, yaw: 0.42, act: {
      hop: jump(2.15, 0.26), tuck: tuck(2.15, 0.9), yaw: [[0, 0.3], [2.15, 0.2], [3.4, 0.3], [L, 0.3]],
      pitch: [[0, 0.16], [1.7, 0.2], [2.15, -0.3], [3.0, -0.1], [4.6, 0.1], [L, 0.16]], lean: [[0, 0.16], [1.7, 0.2], [2.15, -0.16], [2.9, -0.1], [4.6, 0.1], [L, 0.16]],
      roll: [[0, 0.1], [2.15, -0.12], [4.6, 0.12], [L, 0.1]], tilt: [[0, 0.05], [2.15, -0.1], [3.2, 0], [L, 0.05]],
    } },
    // Zara sees the shooting star first and points up at it
    zara: { x: -1.06, z: 0.3, yaw: 0.14, act: {
      hop: [[0, 0], [1.85, 0], [2.05, -0.03], [2.3, 0.12], [2.6, 0], [L, 0]], tuck: [[0, 0], [2.05, 0], [2.3, 0.3], [2.6, 0], [L, 0]],
      yaw: [[0, 0.25], [1.8, 0.25], [2.3, -0.4], [3.4, -0.4], [4.2, 0.1], [5.4, 0.1], [6.4, 0.25], [L, 0.25]],
      pitch: [[0, 0.14], [1.8, 0.14], [2.3, -0.42], [3.4, -0.42], [4.2, -0.06], [6.4, 0.14], [L, 0.14]], lean: [[0, 0.06], [2.3, -0.12], [3.6, -0.06], [5, 0.06], [L, 0.06]],
      roll: [[0, 0.06], [2.3, -0.1], [4.2, 0.1], [L, 0.06]],
    } },
    // Rho tells the story: he sways with it, and springs up at its best part
    rho: { x: 0.74, z: 0.35, yaw: -0.16, act: {
      hop: jump(2.05, 0.2), tuck: tuck(2.05, 0.7), turn: [[0, -0.2], [0.8, 0.12], [1.6, -0.14], [2.05, 0], [5.2, 0], [6.4, 0.14], [7.2, -0.2], [L, -0.2]],
      yaw: [[0, -0.3], [0.8, 0.25], [1.6, -0.25], [2.05, 0], [4.8, 0], [6.4, 0.25], [7.2, -0.3], [L, -0.3]], pitch: [[0, 0.1], [1.6, 0.16], [2.05, -0.3], [2.5, 0.12], [3.1, -0.14], [3.7, 0.1], [4.6, -0.06], [L, 0.1]],
      lean: [[0, 0.14], [1.6, 0.2], [2.05, -0.18], [2.5, 0.08], [3.1, -0.08], [3.7, 0.06], [L, 0.14]], roll: [[0, -0.1], [0.8, 0.1], [1.6, -0.1], [2.05, 0.08], [4.4, -0.08], [L, -0.1]],
      tilt: [[0, -0.05], [0.8, 0.05], [1.6, -0.05], [2.05, 0], [L, -0.05]],
    } },
    // Dina warms her nose at the fire, rears up at the flare, then follows the star
    dina: { x: 1.96, z: -0.2, yaw: -0.52, act: {
      hop: jump(2.4, 0.12), rear: [[0, 0], [1.95, 0], [2.4, 1], [3.1, 0], [L, 0]],
      yaw: [[0, -0.1], [2.4, -0.2], [4.4, -0.2], [5.6, -0.1], [L, -0.1]], pitch: [[0, 0.3], [1.9, 0.3], [2.4, -0.4], [3.2, -0.3], [4.6, -0.3], [5.8, 0.3], [L, 0.3]],
      roll: [[0, 0.16], [2.4, -0.1], [5, 0.16], [L, 0.16]],
    } },
  };
  const peaks = { liruf: 2.15, zara: 2.3, rho: 2.05, dina: 2.4 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, name, height: heights[name], peak: peaks[name] }));
  const points = [[0, 0], [1.9, 0], [2.4, 1], [3.9, 1], [4.6, 0], [L, 0]];
  const effects = [
    far.update,
    sparkles(fx, { loop, actors: actors.filter(({ name }) => name === 'liruf' || name === 'zara'), each: 4, seed: 37, colors: [0xffffff, 0xfff0b8, 0xffd9a0] }),
    twinkles(fx, loop, [[cast.rho.x + 0.1, 1.95, 0.6, 0.15], [cast.dina.x + 0.55, 2.2, 0.3, 0.18], [cast.dina.x - 0.3, 2.35, 0.3, 0.14]], peaks.dina),
    landings(fx, { actors: actors.filter(({ peak }) => peak !== peaks.zara), color: 0xffe6c0 }),
    // sparks out of the fire, and fireflies all through the clearing
    rising(fx, { loop, at: { x: FIRE.x, y: 0.5, z: FIRE.z }, radius: 0.2, height: 1.9, count: 24, color: [0xffb347, 0xffe27a, 0xff7a2a], size: [0.03, 0.07], seed: 9, sway: 0.1, depth: 0.3 }),
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -1.0 }, radius: 2.9, height: 2.5, count: 26, color: [0xfff59a, 0xd8ff8a], size: [0.035, 0.08], seed: 6, sway: 0.16, depth: 0.7 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.4,
    camera: { y: 2.3, dist: 14.2, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - FLARES;
      // the flare: up in a fifth of a second, and back down over the next second and a half
      const flare = since > 0 ? Math.min(1, since / 0.2) * Math.max(0, 1 - Math.max(0, since - 0.5) / 1.4) : 0;

      for (const { one, x, y, tall, phase } of fire.shapes) {
        const swell = 1 + Math.sin(w * 9 + phase) * 0.09;

        // the higher a shape is, the more it sways
        one.position.x = x + Math.sin(w * 7 + phase) * 0.05 * y;
        one.position.y = y + Math.sin(w * 11 + phase) * 0.03 * y;
        one.scale.set(2 - swell, tall * swell, 2 - swell);
      }

      fire.flames.scale.set(1 + flare * 0.15, 1 + flare * 0.32, 1 + flare * 0.15);

      const flicker = 1 + Math.sin(w * 13) * 0.08 + Math.sin(w * 21) * 0.05;

      fire.light.intensity = (13 + flare * 12) * flicker;
      fire.glow.scale.setScalar(1.6 * (1 + flare * 0.5) * flicker);
      fire.glow.material.opacity = 0.42 + flare * 0.25;

      for (const { spark, vx, vy, size, delay } of burst) {
        const s = since - delay;

        spark.visible = s > 0 && s < 1.5;
        spark.position.set(FIRE.x + vx * 0.6 * s, 0.6 + vy * s - 0.5 * s * s, FIRE.z + 0.05);
        spark.scale.setScalar(size * (1 - s / 2.2));
        spark.material.opacity = Math.max(0, 1 - s / 1.5);
      }

      // the shooting star, down across the cloud from the upper left
      const u = (t - STAR.from) / STAR.lasts;
      const at = [-3.1 + u * 2.3, 3.95 - u * 0.99];

      streak.visible = u > 0 && u < 1;
      head.visible = streak.visible;
      streak.position.set(at[0] - 0.62, at[1] + 0.267, -7.4);
      streak.scale.set(1.4, 0.09, 1);
      streak.material.rotation = -0.407;
      streak.material.opacity = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) ** 0.5;
      head.position.set(at[0], at[1], -7.4);
      head.scale.setScalar(0.42);
      head.material.opacity = streak.material.opacity;
      head.material.rotation = w * 3;

      // Zara's right arm goes up to point at it
      const pointing = curve(points, t);

      rigs.zara.rot('RightArm', Z, -pointing * 1.9);
      rigs.zara.rot('RightForeArm', Z, -pointing * 0.4);

      home.dome.material.emissiveIntensity = 0.55 + Math.sin(w * 2) * 0.05;

      tree.crown.rotation.z = Math.sin(w) * 0.02;

      for (const effect of effects) effect(t);
    },
  };
}
