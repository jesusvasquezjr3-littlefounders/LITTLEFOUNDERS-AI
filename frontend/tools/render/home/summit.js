// Home composition "summit": the four mentors have reached the top of a snowy mountain at dawn, planted a flag with
// a Seed on it, and jump for joy one after another while the snow comes down.
//
// The setting is an island: the round top of the mountain, snow over rock, curved (the mentors stand lower the
// farther they are from its middle). The flag stands on the highest point, behind them and between them, its cloth
// above everybody's head. Everything else keeps to the two ends, clear of every mentor: on the left the camp's round
// lantern glows on a rock with a round pine heavy with snow behind it, and on the right the snowman they made stands
// in front of another. Behind it all the dawn: a soft cloud that goes from
// gold at the horizon to rose and to blue, the sun about to come up in it, fading to nothing before the frame's borders (it is
// also what lets the snow show on the light page).
//
// Zara wears a woolly hat, carried by her head bone so it turns and nods with her head, and Rho the cap he always
// wears. Liruf and Dina go bare-headed: his eyes and her crest are the top of their heads, and a hat would hide the
// one and be pierced by the other.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, sequence, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const PEAK = { radius: 3.35, curve: 10, z: -0.5 };
/** How far the snow is below the top of the mountain, `x` and `z` in the scene. */
const drop = (x, z) => PEAK.curve - Math.sqrt(PEAK.curve ** 2 - x * x - (z - PEAK.z) ** 2);
const FLAG = { x: -0.03, z: -1.05 };
const LANTERN = { x: -2.82, z: -0.5 };
const SNOWMAN = { x: 2.89, z: 0.72 };
const PLANTED = 2.0; // the second the first of them jumps

// ---- the top of the mountain: snow with soft blue shade, rock underneath
function peak() {
  const group = new THREE.Group();
  const R = PEAK.radius;
  const next = sequence(71);
  const picture = canvasTexture([1536, 1536], (g, w) => {
    g.fillStyle = '#e3ecff';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 160;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(170,196,255,0.16)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // small hollows the wind has left
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(140,170,235,0.22)';
      g.beginPath();
      g.ellipse(next() * w, next() * w, 10 + next() * 26, 5 + next() * 9, 0, 0, TAU);
      g.fill();
    }
  });
  const top = new THREE.RingGeometry(0.0001, R, 128, 28);
  const at = top.attributes.position;

  // a flat disc, bent down around its middle
  top.rotateX(-Math.PI / 2);

  for (let i = 0; i < at.count; i++) at.setY(i, -(PEAK.curve - Math.sqrt(PEAK.curve ** 2 - at.getX(i) ** 2 - at.getZ(i) ** 2)));

  top.computeVertexNormals();

  const snow = mesh(top, standard(0xffffff, 0.9, { map: picture }));
  const edge = PEAK.curve - Math.sqrt(PEAK.curve ** 2 - R * R);
  const lip = mesh(new THREE.TorusGeometry(R - 0.04, 0.12, 14, 128), standard(0xd3e0f8, 0.92), 0, -edge - 0.05, 0);

  snow.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(snow, lip, lathe([[0, -1.5], [1.2, -1.42], [2.4, -1.14], [3.08, -0.8], [R - 0.02, -edge - 0.08]], standard(0x6d82ad, 0.95)));

  // snow hangs over the rock in round drifts
  for (let i = 0; i < 9; i++) {
    const a = 0.25 + (i / 8) * (Math.PI - 0.5);
    const r = 0.2 + (i % 3) * 0.05;

    group.add(sphere(r, standard(0xdbe6fa, 0.92), Math.cos(a) * (R - 0.1), -edge - 0.1 - (i % 2) * 0.04, Math.sin(a) * (R - 0.1), 0.6));
  }

  return group;
}

/** A layer that shows only the shadows that fall on the snow, bent like it. */
function snowShadows() {
  const geometry = new THREE.RingGeometry(0.0001, PEAK.radius - 0.1, 96, 20);
  const at = geometry.attributes.position;

  geometry.rotateX(-Math.PI / 2);

  for (let i = 0; i < at.count; i++) at.setY(i, -(PEAK.curve - Math.sqrt(PEAK.curve ** 2 - at.getX(i) ** 2 - at.getZ(i) ** 2)) + 0.012);

  const layer = new THREE.Mesh(geometry, new THREE.ShadowMaterial({ opacity: 0.3, color: 0x2a3f9e }));

  layer.receiveShadow = true;
  layer.material.depthWrite = false;
  layer.renderOrder = 2;

  return layer;
}

// ---- the flag: a wooden pole in a heap of snow, a golden ball at its top, an orange cloth with a Seed on it
function flag() {
  const group = new THREE.Group();
  const picture = canvasTexture([512, 320], (g, w, h) => {
    g.fillStyle = '#eb7301';
    g.beginPath();
    g.roundRect(0, 0, w, h, [0, 80, 80, 0]);
    g.fill();
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 16;
    g.beginPath();
    g.roundRect(22, 22, w - 44, h - 44, [0, 60, 60, 0]);
    g.stroke();
    drawSeed(g, w / 2, h / 2, h * 0.62, '#fff1cf', '#2b3050');
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.66, 30, 1), new THREE.MeshStandardMaterial({ map: picture, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }));
  const star = sprite(TEXTURES.star, 0xffe08a, 7);
  const ball = sphere(0.075, standard(C.gold, 0.3, { metalness: 0.6, emissive: 0x7a5200, emissiveIntensity: 0.4 }), 0, 2.8, 0, 1);

  cloth.position.set(0.56, 2.4, 0);
  cloth.castShadow = true;
  star.position.set(0, 2.8, 0.1);
  group.add(cylinder(0.034, 0.042, 2.78, standard(C.wood, 0.7), 0, 1.39, 0, 20), ball, cloth, star, sphere(0.42, standard(0xeef4ff, 0.92), 0, 0.02, 0, 0.5), sphere(0.2, standard(0xe2ebfb, 0.92), 0.36, 0.0, 0.2, 0.6));

  const rest = Float32Array.from(cloth.geometry.attributes.position.array);

  return {
    group, star, ball,
    wave(w) {
      const at = cloth.geometry.attributes.position;

      for (let i = 0; i < at.count; i++) {
        const along = (rest[i * 3] + 0.53) / 1.06; // 0 at the pole, 1 at the free end

        at.setZ(i, Math.sin(along * 5.5 - w * 4) * 0.09 * along);
        at.setY(i, rest[i * 3 + 1] + Math.sin(along * 4 - w * 4) * 0.025 * along);
      }

      at.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
    },
  };
}

// ---- a round pine heavy with snow: tiers like bells, a heap of snow on each, a round top
function pine(height, spread = 0.2) {
  const group = new THREE.Group();
  const greens = [standard(0x1f7a52, 0.85), standard(0x278e5c, 0.85), standard(0x2f9e64, 0.85)];
  const snow = standard(0xf3f7ff, 0.9);
  const tiers = 4;
  const foot = height * 0.14;
  const step = (height - foot) / (tiers + 0.35);

  group.add(cylinder(height * 0.045, height * 0.06, foot + 0.1, standard(C.earth, 0.9), 0, foot / 2, 0, 20));

  for (let i = 0; i < tiers; i++) {
    const r = height * (spread - i * spread * 0.18);
    const y = foot + i * step;
    const tall = step * 1.5;

    group.add(lathe([[0, y], [r * 0.9, y], [r, y + tall * 0.07], [r * 0.9, y + tall * 0.2], [r * 0.5, y + tall * 0.66], [r * 0.3, y + tall * 0.9], [0, y + tall]], greens[i % 3], 0, 0, 0, 40));
    // the snow lies thick on the upper side of the tier
    group.add(lathe([[r * 0.94, y + tall * 0.2], [r * 1.02, y + tall * 0.25], [r * 0.98, y + tall * 0.33], [r * 0.6, y + tall * 0.68], [r * 0.4, y + tall * 0.9], [0, y + tall * 0.96]], snow, 0, 0, 0, 40));

    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + i * 0.9;

      group.add(sphere(r * 0.23, snow, Math.cos(a) * r * 0.93, y + tall * 0.23, Math.sin(a) * r * 0.93, 0.7));
    }
  }

  group.add(sphere(height * 0.075, snow, 0, height - step * 0.1, 0, 1));

  return group;
}

// ---- the camp's lantern on its rock: a round glass with a warm light, a lid with a ring to carry it by
function lantern() {
  const group = new THREE.Group();
  const red = standard(C.red, 0.45);
  const glow = halo(0.75, 0xffc766, 0.6);
  const light = new THREE.PointLight(0xffc766, 6, 5, 1.8);
  const glass = sphere(0.21, lit(0xffd98a, 2.2), 0, 0.82, 0, 1);
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.016, 10, 32), standard(C.slate, 0.4, { metalness: 0.4 }), 0, 1.16, 0);

  glass.castShadow = false;
  glow.position.y = 0.82;
  light.position.set(0.1, 0.95, 0.3);
  group.add(
    // the rock, with snow on it
    sphere(0.42, standard(0x7f93bd, 0.95), 0, 0.2, 0, 0.8), sphere(0.37, standard(0xeef4ff, 0.92), 0, 0.42, 0, 0.36),
    lathe([[0, 0.54], [0.2, 0.54], [0.22, 0.58], [0.18, 0.64], [0, 0.64]], red, 0, 0, 0, 40),
    glass,
    lathe([[0.2, 0.98], [0.22, 1.02], [0.12, 1.08], [0.05, 1.1], [0, 1.1]], red, 0, 0, 0, 40),
    ring, glow, light,
  );

  return { group, glow, glass };
}

// ---- the snowman: three balls, coal eyes, a carrot with a round end, twig arms, a scarf and a little pot for a hat
function snowman() {
  const group = new THREE.Group();
  const snow = standard(0xf6f9ff, 0.9);
  const coal = standard(C.ink, 0.6);
  const twig = standard(C.earthDark, 0.9);
  const head = new THREE.Group();
  const scarf = mesh(new THREE.TorusGeometry(0.17, 0.05, 12, 40), standard(C.indigo, 0.8), 0, 0.84, 0);
  const nose = mesh(new THREE.CapsuleGeometry(0.03, 0.14, 8, 16), standard(C.orange, 0.6), 0, 0, 0.24);

  nose.rotation.x = Math.PI / 2;
  scarf.rotation.x = Math.PI / 2;
  head.add(sphere(0.2, snow, 0, 0, 0, 1), nose, sphere(0.026, coal, -0.075, 0.06, 0.18, 1), sphere(0.026, coal, 0.075, 0.06, 0.18, 1));

  for (let i = 0; i < 5; i++) head.add(sphere(0.016, coal, (i - 2) * 0.04, -0.075 + Math.abs(i - 2) * 0.014, 0.185, 1));

  // the pot: round, with a rolled edge
  head.add(lathe([[0, 0.17], [0.15, 0.17], [0.165, 0.19], [0.13, 0.21], [0.12, 0.34], [0.09, 0.38], [0, 0.39]], standard(C.red, 0.5), 0, 0, 0, 32));
  head.position.y = 1.02;
  group.add(
    sphere(0.36, snow, 0, 0.3, 0, 0.9), sphere(0.27, snow, 0, 0.7, 0, 0.92), head, scarf,
    mesh(new THREE.CapsuleGeometry(0.045, 0.2, 8, 16), standard(C.indigo, 0.8), 0.13, 0.7, 0.2),
    sphere(0.03, coal, 0, 0.74, 0.262, 1), sphere(0.03, coal, 0, 0.62, 0.268, 1),
  );

  for (const side of [-1, 1]) {
    group.add(tube([[side * 0.24, 0.74, 0], [side * 0.36, 0.83, 0.02], [side * 0.46, 0.9, 0.03]], 0.018, twig, 12), sphere(0.03, twig, side * 0.46, 0.9, 0.03, 1));
  }

  return { group, head };
}

/** A round rock half under the snow. */
function rock(radius) {
  const group = new THREE.Group();

  group.add(sphere(radius, standard(0x7f93bd, 0.95), 0, radius * 0.3, 0, 0.7), sphere(radius * 0.92, standard(0xf4f8ff, 0.92), 0, radius * 0.72, 0, 0.42));

  return group;
}

// ---- a woolly hat: a round crown, a rolled edge, a pom-pom. One unit is the radius of the head it goes on.
function hat(color, trim) {
  const group = new THREE.Group();
  const crown = mesh(new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2), standard(color, 0.95));
  const edge = mesh(new THREE.TorusGeometry(1, 0.2, 14, 48), standard(trim, 0.95));

  crown.scale.y = 0.95;
  edge.rotation.x = Math.PI / 2;
  group.add(crown, edge, sphere(0.34, standard(trim, 0.95), 0, 1.14, 0, 1));

  return group;
}

// Zara's hat: its radius, where its edge sits from her head bone (up, and forward along the face), how far it tips back
const HAT = { radius: 0.15, up: 0.2, forward: -0.01, tip: 0.12 };

// ---- the dawn: a soft cloud, gold low down where the sun is about to come up, rose in its middle and blue above
// with the last stars in it
function dawn(fx, loop) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const mask = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    mask.addColorStop(0, 'rgba(255,255,255,0.95)');
    mask.addColorStop(0.55, 'rgba(255,255,255,0.84)');
    mask.addColorStop(0.82, 'rgba(255,255,255,0.32)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, w, w);
    // the colors go only where the cloud is
    g.globalCompositeOperation = 'source-in';

    const sky = g.createLinearGradient(0, w * 0.08, 0, w * 0.86);

    sky.addColorStop(0, '#4f6fe0');
    sky.addColorStop(0.36, '#8f8aff');
    sky.addColorStop(0.6, '#ff8fb0');
    sky.addColorStop(0.8, '#ffb46b');
    sky.addColorStop(1, '#ffd98a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, w);
    g.globalCompositeOperation = 'source-atop';

    const sun = g.createRadialGradient(w * 0.55, w * 0.56, 0, w * 0.55, w * 0.56, w * 0.3);

    sun.addColorStop(0, 'rgba(255,244,200,0.9)');
    sun.addColorStop(0.4, 'rgba(255,214,140,0.45)');
    sun.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);
  const glow = halo(2.0, 0xffe2a0, 0.5);

  glow.position.set(0.5, 1.1, -7.2);
  glow.renderOrder = 1;
  cloud.position.set(0, 1.35, -8);
  cloud.scale.set(10.4, 6.1, 1);
  group.add(cloud, glow);

  // the last stars, in the blue at the top of the cloud
  const next = sequence(43);
  const updates = [];

  for (let i = 0; i < 26; i++) {
    const star = sprite(i % 4 ? TEXTURES.dot : TEXTURES.star, 0xffffff, 1);
    const size = (i % 4 ? 0.045 : 0.17) + next() * 0.06;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);
    const x = (next() - 0.5) * 6.4;

    star.position.set(x, 2.95 + next() * (1.1 - Math.abs(x) * 0.22), -7.5);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.5 + 0.5 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = 0.25 + twinkle * 0.6;
    });
  }

  return { group, glow, update: (t) => { for (const update of updates) update(t); } };
}

/** Snow that falls through a column and comes round again: whole falls in the loop, so it never jumps. */
function snowfall(group, { loop, radius, top, bottom, count, seed }) {
  const next = sequence(seed);
  const updates = [];

  for (let i = 0; i < count; i++) {
    const flake = sprite(TEXTURES.dot, i % 3 ? 0xffffff : 0xd3e2ff, 6);
    const a = next() * TAU;
    const r = Math.sqrt(next()) * radius;
    const y0 = next();
    const size = 0.035 + next() * 0.055;
    const laps = 1 + Math.floor(next() * 2);
    const phase = next() * TAU;
    const drift = 0.1 + next() * 0.18;

    group.add(flake);
    updates.push((t) => {
      const fall = (y0 + (t / loop) * laps) % 1;

      flake.position.set(Math.cos(a) * r + Math.sin((t / loop) * TAU * 2 + phase) * drift, top - fall * (top - bottom), PEAK.z + Math.sin(a) * r * 0.8);
      flake.scale.setScalar(size);
      flake.material.opacity = 0.95 * Math.sin(fall * Math.PI) ** 0.6;
    });
  }

  return (t) => { for (const update of updates) update(t); };
}

/**
 * Stars that twinkle beside the mentors and over their heads, never in front of one: each is placed outside every
 * mentor's own room (`half` wide around `x`, from `y` up to `top`).
 */
function twinkles(group, { loop, actors, seed = 11, each = 5, colors = [0xffffff, 0xfff0b8, 0xdcd9ff] }) {
  const next = sequence(seed);
  const updates = [];
  const free = (x, y) => actors.every((a) => Math.abs(x - a.x) > a.half + 0.12 || y > a.top + 0.12);

  for (const actor of actors) {
    for (let i = 0; i < each; i++) {
      let x = 0;
      let y = 0;

      for (let k = 0; k < 16; k++) {
        const beside = k < 10 && next() < 0.7;

        x = beside ? actor.x + (next() < 0.5 ? -1 : 1) * (actor.half + 0.16 + next() * 0.3) : actor.x + (next() - 0.5) * 2 * actor.half;
        y = beside ? actor.y + (0.3 + next() * 0.8) * (actor.top - actor.y) : actor.top + 0.18 + next() * 0.3;

        if (free(x, y)) break;

        // nowhere beside it: over its head, which is always free
        y = actor.top + 0.18 + next() * 0.3;
        x = actor.x;
      }

      const s = sprite(TEXTURES.star, colors[i % colors.length]);
      const size = 0.1 + next() * 0.14;
      const speed = 1 + Math.floor(next() * 3);
      const phase = next() * TAU;

      group.add(s);
      updates.push((t) => {
        const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;
        const near = actor.peak == null ? 0.55 : 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - actor.peak) / 1.1);

        s.position.set(x, y + Math.sin((t / loop) * TAU + phase) * 0.04, actor.z + 0.3);
        s.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
        s.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
        s.material.rotation = phase + (t / loop) * TAU * 0.5;
      });
    }
  }

  return (t) => { for (const update of updates) update(t); };
}

export function build(scene, { loop, heights, jump, tuck, number, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const planted = flag();
  const lamp = lantern();
  const friend = snowman();
  const sky = dawn(fx, loop);
  const on = (object, x, z, yaw = 0, sink = 0) => place(object, x, z, yaw, -drop(x, z) - sink);

  set.add(place(peak(), 0, PEAK.z), place(snowShadows(), 0, PEAK.z), sky.group);
  set.add(decal(radial([[0, 'rgba(50,70,170,0.3)'], [0.6, 'rgba(50,70,170,0.15)'], [1, 'rgba(50,70,170,0)']]), 0, -1.6, PEAK.z, 3.8, 3.1, 0));
  set.add(on(planted.group, FLAG.x, FLAG.z, -0.12), on(lamp.group, LANTERN.x, LANTERN.z, 0, 0.04), on(friend.group, SNOWMAN.x, SNOWMAN.z, -0.6, 0.03));
  set.add(on(pine(2.7), -2.88, -1.4, 0, 0.05), on(pine(2.4), 3.17, -1.1, 0.8, 0.05));
  set.add(on(rock(0.26), -1.75, 2.2, 0, 0.02), on(rock(0.17), -1.36, 2.42, 1, 0.02), on(rock(0.22), 1.15, 2.5, 2, 0.02));

  const spot = (x, z, yaw, act) => ({ x, z, yaw, y: -drop(x, z), act });
  const cast = {
    // Liruf jumps first and highest, his head thrown back
    liruf: spot(-1.62, -0.05, 0.3, {
      hop: jump(2.0, 0.32), tuck: tuck(2.0, 0.9), lean: [[0, 0.04], [2.0, -0.14], [2.6, 0.1], [3.2, 0.04], [L, 0.04]],
      yaw: [[0, 0.3], [1.3, 0.3], [2.0, 0], [4.8, 0], [6, 0.3], [L, 0.3]], pitch: [[0, -0.2], [2.0, -0.34], [2.6, 0], [3.4, -0.1], [L, -0.2]],
      roll: [[0, -0.12], [2.0, 0.14], [3.8, -0.12], [L, -0.12]], tilt: [[0, 0], [2.0, -0.1], [2.8, 0], [L, 0]],
    }),
    // Zara jumps with her arms at her sides, lands with her hands on her hips, and looks up at the flag
    zara: spot(-0.66, 0.42, 0.1, {
      hop: jump(2.2, 0.22), tuck: tuck(2.2, 0.65), lean: [[0, 0], [2.2, -0.12], [2.9, -0.04], [L, 0]],
      pitch: [[0, -0.08], [2.2, -0.24], [3.0, -0.08], [4.4, -0.3], [5.8, -0.3], [6.6, -0.08], [L, -0.08]], yaw: [[0, 0], [3.6, 0], [4.4, 0.34], [5.8, 0.34], [6.6, 0], [L, 0]],
      roll: [[0, 0.08], [2.2, -0.08], [4.4, 0.1], [L, 0.08]], tilt: [[0, 0], [2.2, 0.04], [3.2, -0.03], [L, 0]],
    }),
    // Rho jumps a beat after her and lands in a pleased nod
    rho: spot(0.62, 0.45, -0.1, {
      hop: jump(2.4, 0.18), tuck: tuck(2.4, 0.7), lean: [[0, -0.03], [2.4, -0.16], [2.85, 0.08], [3.5, -0.03], [L, -0.03]],
      pitch: [[0, -0.12], [2.4, -0.3], [2.85, 0.14], [3.5, -0.1], [L, -0.12]], roll: [[0, 0.1], [2.4, -0.12], [4.3, 0.1], [L, 0.1]], tilt: [[0, 0], [2.4, 0.08], [3.2, 0], [L, 0]],
      yaw: [[0, -0.1], [4.6, -0.1], [5.4, 0.3], [6.4, 0.3], [7.2, -0.1], [L, -0.1]],
    }),
    // Dina rears and lifts her nose to the sky
    dina: spot(1.85, -0.1, -0.5, {
      hop: jump(2.6, 0.13), rear: [[0, 0], [2.1, 0], [2.6, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.18], [2.6, -0.46], [3.4, -0.18], [L, -0.18]],
      roll: [[0, 0.18], [2.6, -0.1], [4.4, 0.18], [L, 0.18]], yaw: [[0, 0.3], [1.6, 0.3], [2.6, 0.05], [5, 0.05], [6.4, 0.3], [L, 0.3]],
    }),
  };
  const peaks = { liruf: 2.0, zara: 2.2, rho: 2.4, dina: 2.6 };
  // each mentor's own room in the picture, as high as it jumps, which no twinkle enters
  const ROOM = { liruf: [0.56, 1.9], zara: [0.36, 2.1], rho: [0.5, 1.8], dina: [0.74, 2.0] };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, y: at.y, height: heights[name], half: ROOM[name][0], top: ROOM[name][1], peak: peaks[name] }));
  const effects = [
    sky.update,
    twinkles(fx, { loop, actors, each: 4, colors: [0xffffff, 0xfff0b8, 0xd3e2ff] }),
    // a puff of snow where each of them lands
    landings(fx, { actors, color: 0xffffff }),
    snowfall(fx, { loop, radius: 3.0, top: 3.7, bottom: -0.3, count: 90, seed: 5 }),
  ];
  scene.add(set, fx);

  return {
    cast,
    still: 2.25,
    camera: { y: 2.3, dist: 14.8, lookY: 0.76 },
    ready(rigs) {
      const at = new THREE.Vector3();

      // the hat is put on once, in the head bone's own frame, so it turns and nods with the head
      const rig = rigs.zara;
      const bone = rig.head;
      const one = hat(C.indigo, 0xfff1cf);
      const facing = rig.holder.rotation.y;
      const r = number('hr', HAT.radius);
      const f = number('hf', HAT.forward);

      rig.holder.updateWorldMatrix(true, true);
      bone.getWorldPosition(at);

      const world = new THREE.Matrix4().compose(
        new THREE.Vector3(at.x + Math.sin(facing) * f, at.y + number('hu', HAT.up), at.z + Math.cos(facing) * f),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-number('ht', HAT.tip), facing, 0, 'YXZ')),
        new THREE.Vector3(r, r, r),
      );

      one.matrixAutoUpdate = false;
      one.matrix.copy(new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(world));
      bone.add(one);
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const ease = (from, to) => { const u = Math.max(0, Math.min(1, (t - from) / (to - from))); return u * u * (3 - 2 * u); };

      // Zara's hands go to her hips after she lands, elbows out, and come down again
      const proud = ease(2.7, 3.3) * (1 - ease(6.6, 7.3));

      rigs.zara.rot('LeftArm', Z, proud * number('arm', 0.42));
      rigs.zara.rot('RightArm', Z, -proud * number('arm', 0.42));
      rigs.zara.rot('LeftForeArm', Z, -proud * number('fore', 1.25));
      rigs.zara.rot('RightForeArm', Z, proud * number('fore', 1.25));

      planted.wave(w);
      planted.star.material.rotation = w;
      planted.star.scale.setScalar(0.3 + 0.2 * Math.max(0, 1 - Math.abs(t - PLANTED - 0.2) / 0.9) + Math.sin(w * 4) * 0.03);
      planted.star.material.opacity = 0.55 + 0.4 * Math.max(0, 1 - Math.abs(t - PLANTED - 0.2) / 0.9);

      lamp.glow.material.opacity = 0.55 + Math.sin(w * 3) * 0.06 + Math.sin(w * 7) * 0.03;
      lamp.glass.material.emissiveIntensity = 2.2 + Math.sin(w * 3) * 0.25;
      friend.head.rotation.z = Math.sin(w) * 0.05;
      sky.glow.scale.setScalar(4.0 * (1 + Math.sin(w) * 0.04));

      for (const effect of effects) effect(t);
    },
  };
}
