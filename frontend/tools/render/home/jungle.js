// Home composition "jungle": the four mentors, explorers, have found an old stone gate deep in the jungle. It lights
// up as they reach it, and a golden Seed turns over a stone stand beside them.
//
// The setting is an island: a piece of jungle floor, a clearing of sand in its middle (the mentors' room, where
// nothing else stands) and earth underneath. At the back, the gate: two pillars of round stones under a round arch,
// moss on it, vines hanging from it, a Seed set in its top and a veil of light inside. A palm leans behind it,
// broad-leaved bushes close the sides, a few mushrooms grow at the front. Butterflies and fireflies fly through,
// and rays of light fall from the upper left.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.25, z: -0.5 };
const GATE = { z: -2.35 };
const STAND = { x: -2.5, z: -0.95 };
const OPENS = 2.0; // the second the gate lights up

// ---- the ground: grass, a clearing of sand, small flowers
function ground() {
  const group = new THREE.Group();
  const next = sequence(41);
  const R = GROUND.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    g.fillStyle = '#58b85f';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 90; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 130;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(126,214,112,0.5)' : 'rgba(44,140,78,0.42)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // the clearing: sand, soft at its edge
    g.save();
    g.translate(w / 2, w * 0.6);
    g.scale(1, 0.56);

    const sand = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.4);

    sand.addColorStop(0, 'rgba(240,214,160,1)');
    sand.addColorStop(0.78, 'rgba(232,202,146,1)');
    sand.addColorStop(1, 'rgba(232,202,146,0)');
    g.fillStyle = sand;
    g.fillRect(-w, -w, w * 2, w * 2);
    g.restore();

    // small flowers in the grass, none on the sand
    for (let i = 0; i < 150; i++) {
      const x = next() * w;
      const y = next() * w;

      if (((x - w / 2) / (w * 0.4)) ** 2 + ((y - w * 0.6) / (w * 0.224)) ** 2 < 1.1) continue;

      g.fillStyle = ['#ffffff', '#ffd36b', '#ff9fc4', '#cfd0ff'][i % 4];
      g.beginPath();
      g.arc(x, y, 5 + next() * 5, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x3f9a4e, 0.9), standard(0xffffff, 0.95, { map: picture }), standard(C.earth, 0.9)], 0, -0.05, 0);

  top.castShadow = false;
  group.add(top, lathe([[0, -0.95], [0.9, -0.9], [2.0, -0.7], [2.8, -0.38], [R - 0.04, -0.1]], standard(C.earth, 0.95)));

  // a soft lip of grass over the edge, so the island has no rim
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x4aa858, 0.95), 0, -0.05, 0);

  lip.rotation.x = Math.PI / 2;
  group.add(lip);

  return group;
}

/** A leaf: `length` long, `width` at its widest, drooping by `droop` at its tip, cupped by `fold`. It grows along +x. */
function blade(length, width, droop, material, fold = 0.22) {
  // a thick round cushion, round at both ends and along every edge: a leaf with no point and no blade
  const geometry = new THREE.SphereGeometry(0.5, 28, 16);
  const at = geometry.attributes.position;

  for (let i = 0; i < at.count; i++) {
    const along = at.getX(i) + 0.5;
    const across = at.getZ(i) * 2;

    // cupped a little along its middle, and bent down toward the tip
    at.setXYZ(i, along * length, at.getY(i) * width * 0.2 - droop * along * along + across * across * fold * width * 0.5, at.getZ(i) * width);
  }

  geometry.computeVertexNormals();

  const leaf = new THREE.Mesh(geometry, material);

  leaf.castShadow = true;
  leaf.receiveShadow = true;

  return leaf;
}

const GREENS = [0x3fb565, 0x2f9e58, 0x5cc977, 0x36a85c].map((color) => standard(color, 0.8, { side: THREE.DoubleSide }));

// ---- a palm: a leaning trunk ringed like a real one, a crown of long leaves, three round nuts
function palm(height, lean, seed) {
  const group = new THREE.Group();
  const next = sequence(seed);
  const trunk = [[0, 0, 0], [lean * 0.2, height * 0.35, 0], [lean * 0.55, height * 0.7, 0.05], [lean, height, 0.1]];
  const bark = standard(0x9a6a3e, 0.9);
  const crown = new THREE.Group();

  group.add(tube(trunk, 0.13, bark, 40));

  const path = new THREE.CatmullRomCurve3(trunk.map((p) => new THREE.Vector3(...p)));

  for (let i = 1; i < 9; i++) {
    const p = path.getPoint(i / 9);
    const ring = mesh(new THREE.TorusGeometry(0.135, 0.026, 10, 32), standard(0x7c5230, 0.9), p.x, p.y, p.z);

    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  crown.position.set(lean, height, 0.1);

  for (let i = 0; i < 9; i++) {
    const leaf = blade(1.15 + next() * 0.35, 0.5, 0.7 + next() * 0.3, GREENS[i % GREENS.length], 0.32);
    const stem = new THREE.Group();

    stem.rotation.y = (i / 9) * TAU + next() * 0.3;
    leaf.rotation.z = 0.5 + next() * 0.25;
    stem.add(leaf);
    crown.add(stem);
  }

  for (let i = 0; i < 3; i++) crown.add(sphere(0.1, standard(0x6e4a2a, 0.8), Math.sin(i * 2.1) * 0.13, -0.1, Math.cos(i * 2.1) * 0.13));

  group.add(crown);

  return { group, crown };
}

// ---- a bush of broad leaves, with a flower or two
function bush(size, seed, flower = C.pink) {
  const group = new THREE.Group();
  const next = sequence(seed);

  for (let i = 0; i < 9; i++) {
    const leaf = blade(size * (0.7 + next() * 0.35), size * 0.62, size * (0.22 + next() * 0.2), GREENS[(i + seed) % GREENS.length], 0.1);
    const stem = new THREE.Group();

    stem.rotation.y = (i / 9) * TAU + next() * 0.4;
    leaf.rotation.z = 0.6 + next() * 0.5;
    stem.add(leaf);
    group.add(stem);
  }

  for (let i = 0; i < 2; i++) {
    const a = next() * TAU;
    const bloom = sphere(size * 0.11, standard(flower, 0.6), Math.cos(a) * size * 0.3, size * (0.55 + i * 0.16), Math.sin(a) * size * 0.3);

    group.add(bloom, sphere(size * 0.05, standard(C.gold, 0.5), bloom.position.x, bloom.position.y + size * 0.08, bloom.position.z));
  }

  return group;
}

// ---- the gate: two pillars of round stones, a round arch, moss, vines, a Seed in its top, light inside
function gate() {
  const group = new THREE.Group();
  const stones = [standard(C.stone, 0.95), standard(0xa9adc6, 0.95), standard(C.stoneDark, 0.95)];
  const moss = standard(C.moss, 0.95);
  const next = sequence(13);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const drum = lathe([[0, 0], [0.3, 0], [0.34, 0.07], [0.34, 0.53], [0.3, 0.6], [0, 0.6]], stones[(i + (side > 0 ? 1 : 0)) % 3], side * 1.0 + (next() - 0.5) * 0.05, i * 0.6, (next() - 0.5) * 0.05, 40);

      drum.scale.setScalar(1 - i * 0.04);
      group.add(drum);
    }

    group.add(sphere(0.2, moss, side * 1.02, 1.78, 0.2, 0.5), sphere(0.15, moss, side * 0.78, 0.05, 0.3, 0.45));
  }

  const arch = mesh(new THREE.TorusGeometry(1.0, 0.3, 20, 64, Math.PI), stones[0], 0, 1.75, 0);
  // the Seed set in the top of the arch, golden
  const emblem = seedMesh(0.5);

  emblem.material = standard(0xf2bf2a, 0.28, { metalness: 0.7, emissive: 0x7a5200, emissiveIntensity: 0.5 });
  emblem.position.set(0, 2.78, 0.3);
  group.add(arch, emblem, sphere(0.24, moss, -0.55, 2.82, 0.12, 0.45), sphere(0.17, moss, 0.75, 2.62, 0.16, 0.45), sphere(0.13, moss, 0.2, 3.03, 0.05, 0.5));

  // the light inside the gate: a round veil, brightest in its middle
  const veil = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({
    map: radial([[0, 'rgba(255,246,200,0.95)'], [0.45, 'rgba(255,214,120,0.6)'], [0.8, 'rgba(120,230,190,0.25)'], [1, 'rgba(120,230,190,0)']]),
    transparent: true, depthWrite: false, toneMapped: false,
  }));

  veil.position.set(0, 1.35, -0.05);
  veil.scale.set(0.95, 1.5, 1);
  veil.renderOrder = 1;
  group.add(veil);

  // vines hang from the arch, each on its own hinge so it can sway
  const vines = [[-0.72, 2.42, 0.9], [-0.3, 2.68, 0.55], [0.38, 2.66, 0.7], [0.8, 2.36, 1.05], [-1.2, 1.95, 0.6], [1.22, 1.9, 0.45]].map(([x, y, length], k) => {
    const vine = new THREE.Group();

    vine.position.set(x, y, 0.3);
    vine.add(tube([[0, 0, 0], [0.03, -length * 0.4, 0.02], [-0.02, -length * 0.75, 0], [0.02, -length, 0.02]], 0.02, standard(C.leafDeep, 0.9), 16));

    for (let i = 1; i <= Math.round(length * 5); i++) {
      const leaf = sphere(0.06, GREENS[(i + k) % GREENS.length], (i % 2 ? 0.06 : -0.06), -(i / (length * 5)) * length, 0.02, 0.5);

      leaf.scale.x = 0.7;
      vine.add(leaf);
    }

    group.add(vine);

    return vine;
  });

  return { group, veil, emblem, vines };
}

// ---- the stone stand with the golden Seed turning over it
function stand() {
  const group = new THREE.Group();
  const idol = seedMesh(0.5);
  const rays = sprite(TEXTURES.star, 0xffe08a, 5);
  const glow = halo(0.7, 0xffd36b, 0.55);
  const light = new THREE.PointLight(0xffd070, 6, 4.5, 1.8);

  idol.material = standard(0xf2bf2a, 0.25, { metalness: 0.75, emissive: 0x7a5200, emissiveIntensity: 0.6 });
  idol.castShadow = false;
  rays.scale.setScalar(1.5);
  rays.material.opacity = 0.75;
  light.position.y = 1.25;
  group.add(lathe([[0, 0], [0.38, 0], [0.4, 0.08], [0.29, 0.17], [0.27, 0.52], [0.35, 0.6], [0.35, 0.68], [0, 0.68]], standard(C.stone, 0.95)), sphere(0.13, standard(C.moss, 0.95), 0.22, 0.64, 0.2, 0.45), rays, glow, idol, light);

  return { group, idol, rays, glow };
}

function mushroom(height, cap, color) {
  const group = new THREE.Group();
  const top = mesh(new THREE.SphereGeometry(cap, 32, 16, 0, TAU, 0, Math.PI / 2), standard(color, 0.6), 0, height, 0);

  group.add(cylinder(cap * 0.3, cap * 0.38, height, standard(C.cream, 0.8), 0, height / 2, 0, 20), top, cylinder(cap, cap, 0.02, standard(C.cream, 0.8), 0, height, 0, 32));

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4;
    const dot = sphere(cap * 0.14, standard(0xffffff, 0.6), Math.cos(a) * cap * 0.6, height + cap * 0.72, Math.sin(a) * cap * 0.6, 0.5);

    group.add(dot);
  }

  return group;
}

function butterfly(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), material);

    wing.position.x = side * 0.075;
    wing.scale.y = 1.25;
    hinge.add(wing);
    group.add(hinge);

    return { hinge, side };
  });

  group.add(sphere(0.022, standard(C.ink, 0.6), 0, 0, 0, 3.2));
  group.rotation.x = -0.9;

  return { group, wings };
}

export function build(scene, { loop, heights, jump, tuck }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const old = gate();
  const treasure = stand();
  const palms = [{ ...palm(2.6, 0.3, 3), x: 2.05, z: -2.85, yaw: 0.2 }];

  set.add(place(ground(), 0, GROUND.z), shadowCatcher(GROUND.radius - 0.1, 0.008, GROUND.z, 0.32));
  set.add(decal(radial([[0, 'rgba(40,60,120,0.28)'], [0.6, 'rgba(40,60,120,0.14)'], [1, 'rgba(40,60,120,0)']]), 0, -1.0, GROUND.z, 3.7, 3.1, 0));
  set.add(place(old.group, 0, GATE.z), place(treasure.group, STAND.x, STAND.z));

  for (const { group, x, z, yaw } of palms) set.add(place(group, x, z, yaw));

  set.add(
    place(bush(1.05, 2), 2.6, -1.3, 0.4),
    place(bush(1.0, 5, C.orange), -2.1, -2.7, 1.1),
    place(bush(0.8, 11, 0xffffff), -2.75, -1.9, 0.2),
    place(bush(0.9, 9, 0xffffff), 1.5, -2.9, 2.0),
    place(bush(0.62, 4, C.gold), 2.55, 0.8, 0.9),
    place(bush(0.55, 6), -2.7, 0.6, 2.4),
    place(mushroom(0.26, 0.2, C.red), -2.15, 1.5),
    place(mushroom(0.17, 0.13, C.red), -1.82, 1.72),
    place(mushroom(0.13, 0.1, C.orange), -2.45, 1.82),
  );

  // rays of light from the upper left, soft on both sides
  const beam = canvasTexture([256, 8], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, w, 0);

    fade.addColorStop(0, 'rgba(255,244,196,0)');
    fade.addColorStop(0.5, 'rgba(255,244,196,1)');
    fade.addColorStop(1, 'rgba(255,244,196,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const rays = [[-2.2, 0.6, 0.3], [-1.0, 0.9, 0.22], [0.5, 0.7, 0.26], [1.8, 0.5, 0.2]].map(([x, width, opacity], i) => {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(width, 6.5), new THREE.MeshBasicMaterial({ map: beam, alphaMap: radial([[0, '#fff'], [0.55, '#bbb'], [1, '#000']]), transparent: true, depthWrite: false, toneMapped: false, opacity }));

    ray.position.set(x, 2.3, -1.55 - i * 0.05);
    ray.rotation.z = -0.42;
    ray.renderOrder = 5;
    fx.add(ray);

    return { ray, opacity, phase: i * 1.9 };
  });

  const cast = {
    // Liruf cannot take his eyes off the golden Seed beside him
    liruf: { x: -1.45, z: -0.05, yaw: 0.32, act: {
      hop: jump(3.1, 0.2), tuck: tuck(3.1, 0.7), yaw: [[0, -0.62], [L, -0.62]], pitch: [[0, -0.05], [3.1, -0.22], [3.9, -0.05], [L, -0.05]],
      roll: [[0, -0.16], [2.6, 0.1], [5, -0.16], [L, -0.16]], lean: [[0, 0.12], [3.1, 0.02], [3.9, 0.16], [6, 0.12], [L, 0.12]], tilt: [[0, -0.08], [L, -0.08]],
    } },
    // Zara jumps as the gate lights up, one hand out toward it, then waves the reader over
    zara: { x: -0.5, z: 0.4, yaw: 0.1, act: {
      hop: jump(2.1, 0.2), tuck: tuck(2.1, 0.6), wave: [[0, 0], [1.5, 0], [2.0, 1], [6.3, 1], [7, 0], [L, 0]],
      lean: [[0, 0], [2.1, -0.14], [2.9, 0], [L, 0]], roll: [[0, 0.08], [2.1, -0.08], [4.3, 0.14], [6.3, 0.14], [L, 0.08]], pitch: [[0, -0.08], [2.1, -0.25], [2.9, -0.08], [L, -0.08]],
    } },
    // Rho jumps a beat later and nods, pleased
    rho: { x: 0.55, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.3, 0.17), tuck: tuck(2.3, 0.7), lean: [[0, -0.03], [2.3, -0.16], [2.75, 0.08], [3.4, -0.03], [L, -0.03]],
      pitch: [[0, -0.1], [2.3, -0.3], [2.75, 0.14], [3.4, -0.1], [L, -0.1]], roll: [[0, 0.1], [2.3, -0.12], [4.2, 0.1], [L, 0.1]], tilt: [[0, 0], [2.3, 0.08], [3.1, 0], [L, 0]],
    } },
    // Dina follows a butterfly with her nose, and rears up after it
    dina: { x: 1.8, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.6, 0.12), rear: [[0, 0], [2.1, 0], [2.6, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.2], [2.6, -0.42], [3.4, -0.2], [L, -0.2]],
      roll: [[0, 0.2], [2.6, -0.12], [4.4, 0.2], [L, 0.2]], yaw: [[0, 0.3], [2, 0.1], [4, 0.4], [6, 0.15], [L, 0.3]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 3.1, zara: 2.1, rho: 2.3, dina: 2.6 }[name] }));
  // butterflies, each on its own closed path
  const flying = [[C.orange, 2.25, 2.15, -0.3, 0.55, 0], [0x7fb4ff, -0.6, 2.55, -1.2, 0.7, 2.1], [C.pink, -2.6, 1.9, 0.3, 0.4, 4.0]].map(([color, x, y, z, reach, phase]) => {
    const one = butterfly(color);

    fx.add(one.group);

    return { ...one, x, y, z, reach, phase };
  });
  const effects = [
    sparkles(fx, { loop, actors, each: 6 }),
    landings(fx, { actors, color: 0xf7e6c0 }),
    // fireflies all through the clearing, and specks of light rising out of the gate
    rising(fx, { loop, at: { x: 0, y: 0.25, z: -0.9 }, radius: 3.0, height: 2.6, count: 34, color: [0xfff59a, 0xd8ff8a, 0xffffff], size: [0.03, 0.075], seed: 6, sway: 0.16, depth: 0.7 }),
    rising(fx, { loop, at: { x: 0, y: 0.3, z: GATE.z + 0.2 }, radius: 0.7, height: 2.2, count: 20, color: [0xffe6a3, 0xa8f0d6], size: [0.03, 0.07], seed: 12, texture: TEXTURES.star }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.15,
    camera: { y: 2.4, dist: 14.4, lookY: 1.2 },
    update(t) {
      const w = (t / loop) * TAU;
      // the gate lights up, holds, and dims again before the loop ends
      const open = 0.55 + 0.45 * Math.max(0, Math.min(1, (t - OPENS + 0.5) / 0.5)) * Math.max(0, Math.min(1, (L - 0.6 - t) / 1.2));

      old.veil.material.opacity = open * (0.9 + Math.sin(w * 3) * 0.1);
      old.veil.scale.set(0.95 * (0.96 + open * 0.06), 1.5, 1);
      old.emblem.material.emissiveIntensity = 0.3 + open * 0.9;
      old.vines.forEach((vine, i) => { vine.rotation.z = Math.sin(w + i * 1.3) * 0.07; });

      treasure.idol.position.y = 1.2 + Math.sin(w * 2) * 0.05;
      treasure.idol.rotation.y = w * 2;
      treasure.rays.position.y = treasure.idol.position.y;
      treasure.glow.position.y = treasure.idol.position.y;
      treasure.rays.material.rotation = w;

      for (const { crown } of palms) crown.rotation.z = Math.sin(w) * 0.04;

      for (const { ray, opacity, phase } of rays) ray.material.opacity = opacity * (0.75 + 0.25 * Math.sin(w + phase));

      for (const { group, wings, x, y, z, reach, phase } of flying) {
        group.position.set(x + Math.sin(w + phase) * reach, y + Math.sin(w * 2 + phase) * reach * 0.35, z + Math.cos(w + phase) * reach * 0.4);
        group.rotation.y = Math.cos(w + phase) > 0 ? 0.6 : -0.6;

        for (const { hinge, side } of wings) hinge.rotation.y = side * (0.2 + Math.abs(Math.sin(w * 16 + phase)) * 1.0);
      }

      for (const effect of effects) effect(t);
    },
  };
}
