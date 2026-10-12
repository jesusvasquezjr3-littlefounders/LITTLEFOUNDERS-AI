// Home composition "balloon": the four mentors ride a hot-air balloon among the clouds, the moment its burner roars
// and the balloon lifts.
//
// The setting is an island of sky: a soft cloud of blue that fades to nothing before the frame's borders, which is
// what lets white clouds show on the light page too. In it floats the balloon: a broad, round envelope in the brand's
// colors with a Seed on its front, and under it a wide wicker basket with a padded rim. The mentors stand on the
// basket's floor and show from the chest up over the rim; Dina, the large one, stands at the right end with her head
// over it. Puffy clouds lie below and to the sides, a second balloon and a small rainbow hang far away, birds fly
// by, and Seeds drift down on tiny parachutes.
//
// The basket is hollow (a floor, a wall all around, nothing across the top) and wide enough for the four, so no
// surface of a mentor runs through it. The ropes go up from its two ends, clear of every head.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, drawSeed, halo, lathe, mesh, seedMesh, sequence, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const BASKET = { a: 2.35, b: 1.1, power: 3.6, wall: 0.62, floor: 0.14 };
const MOUTH = 1.95; // where the envelope would close, above the basket's foot: its mouth is cut open a little higher
const HOOP = { radius: 0.86, y: 0.2 }; // the hoop around the mouth, from that point
const ENVELOPE = [[0.84, 0.2], [1.2, 0.33], [1.86, 0.73], [2.26, 1.15], [2.35, 1.46], [2.17, 1.84], [1.65, 2.12], [0.85, 2.27], [0.02, 2.3]];
const ROARS = 2.2; // the second the burner opens up
const FAR_Y = 3.9; // where the second balloon hangs
const GLOW = 0.3; // how much the envelope shines by itself: its underside faces away from the light

/** A point on the basket's outline (a rounded rectangle) and the direction that points out of it there. */
function outline(angle, a = BASKET.a, b = BASKET.b) {
  const bend = (v) => Math.sign(v) * Math.abs(v) ** (2 / BASKET.power);
  const x = a * bend(Math.cos(angle));
  const z = b * bend(Math.sin(angle));
  const nx = (Math.sign(x) * Math.abs(x / a) ** (BASKET.power - 1)) / a;
  const nz = (Math.sign(z) * Math.abs(z / b) ** (BASKET.power - 1)) / b;
  const length = Math.hypot(nx, nz) || 1;

  return { x, z, nx: nx / length, nz: nz / length };
}

// ---- the basket: a woven wall all around a wooden floor, a padded rim, and round sandbags hung on its front
function basket() {
  const group = new THREE.Group();
  const N = 220;
  // the wall's section, bottom to top outside and back down inside: [outward from the outline, height]
  const section = [[-0.17, 0.0], [-0.03, 0.05], [0.035, 0.28], [0.035, 0.5], [0.0, BASKET.wall], [-0.11, BASKET.wall], [-0.11, 0.04]];
  const weave = canvasTexture([256, 256], (g, w, h) => {
    g.fillStyle = '#b9793c';
    g.fillRect(0, 0, w, h);

    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 2; col++) {
        const x = col * 128 + (row % 2 ? 64 : 0);
        const y = row * 32;
        const strand = g.createLinearGradient(0, y, 0, y + 32);

        strand.addColorStop(0, '#e9b877');
        strand.addColorStop(0.55, '#d79d59');
        strand.addColorStop(1, '#b57a40');
        g.fillStyle = strand;
        g.beginPath();
        g.roundRect(x + 8, y + 3, 112, 26, 13);
        g.fill();
      }
    }
  });
  const positions = [];
  const uvs = [];
  const indices = [];
  const heights = [0];

  weave.wrapS = THREE.RepeatWrapping;
  weave.wrapT = THREE.RepeatWrapping;

  for (let j = 1; j < section.length; j++) heights.push(heights[j - 1] + Math.hypot(section[j][0] - section[j - 1][0], section[j][1] - section[j - 1][1]));

  for (let i = 0; i <= N; i++) {
    const at = outline((i / N) * TAU);

    section.forEach(([out, y], j) => {
      positions.push(at.x + at.nx * out, y, at.z + at.nz * out);
      uvs.push((i / N) * 26, heights[j] * 1.6);
    });
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < section.length - 1; j++) {
      const k = i * section.length + j;

      indices.push(k, k + section.length + 1, k + section.length, k, k + 1, k + section.length + 1);
    }
  }

  const wall = new THREE.BufferGeometry();

  wall.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  wall.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  wall.setIndex(indices);
  wall.computeVertexNormals();
  group.add(mesh(wall, standard(0xffffff, 0.85, { map: weave, side: THREE.DoubleSide })));

  // the floor, the padded rim and a band around the foot
  const ring = (inset, y) => Array.from({ length: 96 }, (_, i) => { const at = outline((i / 96) * TAU); return new THREE.Vector3(at.x - at.nx * inset, y, at.z - at.nz * inset); });
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(ring(0.1, 0).map((p) => new THREE.Vector2(p.x, p.z))), 1), standard(0x8a5a36, 0.9, { side: THREE.DoubleSide }));

  floor.rotation.x = Math.PI / 2;
  floor.position.y = BASKET.floor;
  floor.receiveShadow = true;
  group.add(
    floor,
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring(0.055, BASKET.wall + 0.02), true), 240, 0.085, 14, true), standard(C.indigo, 0.55)),
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring(0.12, 0.05), true), 240, 0.07, 12, true), standard(0x8a5a36, 0.8)),
  );

  // sandbags: round sacks on short ropes, along the front
  [[-1.7, C.orange], [-0.58, C.mint], [0.58, C.pink], [1.7, C.gold]].forEach(([x, color]) => {
    const z = BASKET.b + 0.13;

    group.add(cylinder(0.014, 0.014, 0.24, standard(C.cream, 0.8), x, 0.5, z - 0.02, 8), sphere(0.14, standard(color, 0.7), x, 0.29, z, 1.15), sphere(0.05, standard(C.cream, 0.8), x, 0.44, z, 0.7));
  });

  return group;
}

// ---- an envelope: a broad round balloon in gores of color, pinched a little along every seam
function envelope(colors, emblem) {
  const profile = new THREE.SplineCurve(ENVELOPE.map(([r, h]) => new THREE.Vector2(r, h))).getSpacedPoints(56);
  const gores = 12;
  const picture = canvasTexture([2048, 1024], (g, w, h) => {
    // gore `k` is centered on `k / gores` around, so the first one faces the reader
    for (let k = 0; k <= gores; k++) {
      g.fillStyle = colors[k % colors.length];
      g.fillRect(((k - 0.5) / gores) * w, 0, w / gores + 1, h);
    }

    // a deep cap over the top and a golden hem at the mouth
    g.fillStyle = '#4438cf';
    g.fillRect(0, 0, w, h * 0.075);
    g.fillStyle = '#ebb806';
    g.fillRect(0, h * 0.955, w, h * 0.045);

    if (!emblem) return;

    // the Seed, in a round window on the front gore (drawn twice: the picture meets itself there)
    for (const x of [0, w]) {
      g.save();
      g.translate(x, h * 0.52);
      g.scale(0.66, 1);
      g.fillStyle = '#fff1cf';
      g.beginPath();
      g.arc(0, 0, 78, 0, TAU);
      g.fill();
      drawSeed(g, 0, 0, 108, '#ebb806', '#4438cf');
      g.restore();
    }
  });
  const geometry = new THREE.LatheGeometry(profile, 96);
  const at = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < at.count; i++) {
    const swell = 1 + 0.035 * Math.abs(Math.cos(uv.getX(i) * TAU * (gores / 2))) * Math.sin(Math.PI * uv.getY(i));

    at.setX(i, at.getX(i) * swell);
    at.setZ(i, at.getZ(i) * swell);
  }

  geometry.computeVertexNormals();

  const group = new THREE.Group();
  const skin = new THREE.Mesh(geometry, standard(0xffffff, 0.6, { map: picture, emissive: 0xffffff, emissiveMap: picture, emissiveIntensity: GLOW, side: THREE.DoubleSide }));
  const hoop = mesh(new THREE.TorusGeometry(HOOP.radius, 0.045, 12, 64), standard(C.gold, 0.4, { metalness: 0.4 }), 0, HOOP.y, 0);

  // the envelope throws no shadow: it would put the mentors under it in shade
  skin.receiveShadow = false;
  hoop.rotation.x = Math.PI / 2;
  hoop.castShadow = false;
  group.add(skin, hoop, sphere(0.14, standard(C.gold, 0.4, { metalness: 0.4 }), 0, 2.3, 0, 0.7));

  return { group, skin, profile };
}

/** How high above its mouth the envelope's lower half is `radius` wide. */
function heightAt(profile, radius) {
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].x >= radius) return profile[i - 1].y + ((radius - profile[i - 1].x) / (profile[i].x - profile[i - 1].x)) * (profile[i].y - profile[i - 1].y);
  }

  return 0;
}

// ---- the burner under the mouth, and its flame: round shapes of fire that show between the burner and the hoop
function burner() {
  const group = new THREE.Group();
  const steel = standard(0xc9cee6, 0.3, { metalness: 0.6 });
  const flame = new THREE.Group();
  const glow = halo(0.55, 0xffb347, 0.7);
  const light = new THREE.PointLight(0xffb060, 2, 6, 1.6);

  // round shapes of fire, the pale ones in front: [x, y, z, radius, how tall for its width, color]
  for (const [x, y, z, radius, tall, color] of [[0, 0.15, 0, 0.15, 1.25, 0xff6a1a], [0.02, 0.35, 0, 0.1, 1.2, 0xff6a1a], [0, 0.13, 0.08, 0.1, 1.2, 0xffb21f], [0, 0.11, 0.15, 0.055, 1.1, 0xfff0a8]]) {
    const one = sphere(radius, new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, y, z, tall);

    one.castShadow = false;
    flame.add(one);
  }

  flame.position.y = MOUTH - 0.09;
  glow.position.set(0, MOUTH + 0.02, -0.3);
  light.position.set(0, MOUTH - 0.2, 0.7);
  group.add(cylinder(0.11, 0.13, 0.16, steel, 0, MOUTH - 0.21, 0, 24), cylinder(0.07, 0.07, 0.05, standard(C.slate, 0.4), 0, MOUTH - 0.115, 0, 20), flame, glow, light);

  // four thin arms hold it under the hoop
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;

    group.add(tube([[Math.cos(a) * 0.11, MOUTH - 0.2, Math.sin(a) * 0.11], [Math.cos(a) * HOOP.radius, MOUTH + HOOP.y, Math.sin(a) * HOOP.radius]], 0.018, steel, 6));
  }

  return { group, flame, glow, light };
}

// ---- a cloud: round puffs on a flat foot, white on top and blue underneath
function cloud(puffs, scale = 1) {
  const group = new THREE.Group();
  const top = standard(0xf6f8ff, 1, { emissive: 0x9db4ff, emissiveIntensity: 0.22 });
  const under = standard(0x9db0f4, 1, { emissive: 0x7f95e8, emissiveIntensity: 0.3 });

  for (const [x, y, z, r] of puffs) {
    const puff = sphere(r, top, x, y, z, 0.86);
    const shade = sphere(r * 0.94, under, x, y - r * 0.24, z - 0.02, 0.6);

    puff.castShadow = false;
    puff.receiveShadow = false;
    shade.castShadow = false;
    shade.receiveShadow = false;
    group.add(shade, puff);
  }

  group.scale.setScalar(scale);

  return group;
}

const BANK = [[-1.1, 0, 0, 0.55], [-0.4, 0.22, 0.05, 0.72], [0.45, 0.14, 0, 0.64], [1.15, -0.04, 0.05, 0.48], [0.1, -0.1, 0.3, 0.5], [-0.75, -0.08, 0.25, 0.45]];
const PUFF = [[-0.5, 0, 0, 0.42], [0.05, 0.14, 0, 0.52], [0.6, 0, 0.02, 0.38]];

// ---- a Seed on a tiny parachute
function parachute(color) {
  const group = new THREE.Group();
  const canopy = mesh(new THREE.SphereGeometry(0.27, 32, 14, 0, TAU, 0, Math.PI / 2), standard(color, 0.6, { side: THREE.DoubleSide }));
  const hem = mesh(new THREE.TorusGeometry(0.27, 0.022, 10, 40), standard(C.cream, 0.6));
  const seed = seedMesh(0.3);

  canopy.scale.y = 0.8;
  hem.rotation.x = Math.PI / 2;
  seed.position.y = -0.52;
  seed.castShadow = false;
  group.add(canopy, hem, seed, sphere(0.035, standard(C.cream, 0.6), 0, 0.22, 0, 0.6));

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.6;

    group.add(tube([[Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26], [Math.cos(a) * 0.03, -0.37, Math.sin(a) * 0.03]], 0.007, standard(C.cream, 0.8), 4));
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  return group;
}

// ---- a small round bird. It flies along +x.
function bird(color, wing) {
  const group = new THREE.Group();
  const body = sphere(0.1, standard(color, 0.6), 0, 0, 0);
  const beak = sphere(0.028, standard(C.gold, 0.5), 0.2, 0.03, 0);
  const tail = sphere(0.06, standard(wing, 0.6), -0.16, 0.01, 0);
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const feather = sphere(0.15, standard(wing, 0.6), 0, 0, side * 0.15);

    feather.scale.set(0.6, 0.12, 1);
    hinge.add(feather);
    hinge.position.set(0, 0.03, side * 0.04);
    group.add(hinge);

    return { hinge, side };
  });

  body.scale.set(1.5, 0.9, 0.9);
  beak.scale.set(1.6, 0.7, 0.7);
  tail.scale.set(1.3, 0.3, 0.8);
  group.add(body, sphere(0.07, standard(color, 0.6), 0.13, 0.05, 0), beak, tail, sphere(0.013, standard(C.ink, 0.4), 0.165, 0.07, 0.055), sphere(0.013, standard(C.ink, 0.4), 0.165, 0.07, -0.055));
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  return { group, wings };
}

// ---- far behind: the cloud of sky, a second balloon, a small rainbow between two clouds
function sky() {
  const group = new THREE.Group();
  const air = sprite(canvasTexture([1024, 680], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const blue = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    blue.addColorStop(0, 'rgba(126,196,255,0.95)');
    blue.addColorStop(0.5, 'rgba(112,184,255,0.86)');
    blue.addColorStop(0.8, 'rgba(120,180,255,0.34)');
    blue.addColorStop(1, 'rgba(120,180,255,0)');
    g.fillStyle = blue;
    g.fillRect(0, 0, w, w);

    // a warm patch of light high on the left, where the sun is
    const sun = g.createRadialGradient(w * 0.3, w * 0.3, 0, w * 0.3, w * 0.3, w * 0.3);

    sun.addColorStop(0, 'rgba(255,244,200,0.5)');
    sun.addColorStop(1, 'rgba(255,244,200,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);
  const bands = canvasTexture([8, 256], (g, w, h) => {
    ['#ff6fa5', '#eb7301', '#ebb806', '#05a893', '#4b94ff', '#5c55fd'].forEach((color, i, all) => {
      g.fillStyle = color;
      g.fillRect(0, (i / all.length) * h, w, h / all.length + 1);
    });
  });
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.92, 96, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ map: bands, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const uv = arc.geometry.attributes.uv;
  const at = arc.geometry.attributes.position;

  // the rainbow's colors run from its outer edge to its inner one
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, (Math.hypot(at.getX(i), at.getY(i)) - 0.56) / 0.36);

  const rainbow = new THREE.Group();

  arc.renderOrder = 1;
  rainbow.add(arc, cloud(PUFF, 0.5), cloud(PUFF, 0.5));
  rainbow.children[1].position.set(-0.74, 0, 0.1);
  rainbow.children[2].position.set(0.74, 0, 0.1);
  rainbow.position.set(4.0, 3.75, -7);

  const far = new THREE.Group();
  const second = envelope(['#05a893', '#fff1cf', '#ff6fa5', '#fff1cf'], false);
  const tiny = lathe([[0, 0], [0.5, 0], [0.62, 0.12], [0.62, 0.55], [0.55, 0.62], [0, 0.62]], standard(0xc98a4b, 0.85));

  second.group.position.y = 1.6;
  tiny.position.y = 0;
  far.add(second.group, tiny);

  for (const side of [-1, 1]) far.add(tube([[side * 0.58, 0.6, 0], [side * 0.9, 1.85, 0]], 0.03, standard(C.cream, 0.8), 4));

  far.scale.setScalar(0.32);
  far.position.set(-4.5, FAR_Y, -7);
  far.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  air.position.set(0, 1.85, -10);
  air.scale.set(11.9, 7.9, 1);
  group.add(air, rainbow, far);

  return { group, far };
}

export function build(scene, { loop, heights, curve, jump, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const balloon = new THREE.Group();
  const top = envelope(['#5c55fd', '#fff1cf', '#eb7301', '#fff1cf'], true);
  const fire = burner();
  const behind = sky();

  top.group.position.y = MOUTH;
  balloon.add(basket(), top.group, fire.group);

  // the ropes: from the two ends of the rim up to the envelope's flank, clear of every head
  for (const side of [-1, 1]) {
    for (const z of [-0.5, 0.5]) {
      const foot = outline(Math.atan2(z, side * 1.6));
      const reach = Math.hypot(1.9, 0.4);
      const knot = [side * 1.9, MOUTH + heightAt(top.profile, reach), z * 0.8];

      balloon.add(tube([[foot.x - foot.nx * 0.055, BASKET.wall + 0.06, foot.z - foot.nz * 0.055], knot], 0.022, standard(C.cream, 0.8), 6), sphere(0.05, standard(C.gold, 0.4, { metalness: 0.4 }), ...knot));
    }
  }

  // clouds below and to the sides, each drifting a little on its own
  const clouds = [[BANK, 0.8, -2.45, 0.22, -1.5, 0], [BANK, 0.8, 2.55, 0.28, -2.0, 1.7], [PUFF, 0.56, -2.8, 0.12, -0.4, 4.4], [PUFF, 0.52, 2.85, 0.1, -0.5, 5.2]].map(([puffs, scale, x, y, z, phase]) => {
    const one = cloud(puffs, scale);

    one.position.set(x, y, z);
    set.add(one);

    return { one, x, phase };
  });

  set.add(behind.group, balloon);

  // Seeds on parachutes, and birds
  const chutes = [[C.pink, 3.1, 2.0, 0.2, 0], [C.gold, -3.05, 1.5, 0.3, 3.6]].map(([color, x, y, z, phase]) => {
    const one = parachute(color);

    fx.add(one);

    return { one, x, y, z, phase };
  });
  const flock = [[0xff8a5c, 0xe0603a, -3.0, 2.4, -0.6, 0], [0xffb347, 0xeb7301, -2.9, 3.05, -1.2, 2.1], [0xff6fa5, 0xd94c86, -3.15, 2.72, -1.6, 4.2]].map(([color, wing, x, y, z, phase]) => {
    const one = bird(color, wing);

    fx.add(one.group);

    return { ...one, x, y, z, phase };
  });

  const cast = {
    // Liruf watches the birds go by on his side, and hops when the burner roars
    liruf: { x: -1.58, z: 0.4, yaw: 0.3, act: {
      hop: jump(2.55, 0.12), yaw: [[0, -0.6], [1.9, -0.6], [2.5, 0.3], [4.6, 0.3], [5.8, -0.6], [L, -0.6]], pitch: [[0, -0.06], [1.9, -0.06], [2.5, -0.34], [4.4, -0.2], [5.6, -0.06], [L, -0.06]],
      lean: [[0, 0.1], [2.5, -0.1], [3.4, 0.06], [L, 0.1]], roll: [[0, -0.12], [2.5, 0.12], [5, -0.12], [L, -0.12]], tilt: [[0, -0.05], [2.5, 0.05], [5, -0.05], [L, -0.05]],
    } },
    // Zara leans out over the rim with both hands on it to look at the clouds, then waves at the reader with her left
    // hand, the one on the open side (her waving arm is set in `update`)
    zara: { x: -0.68, z: 0.6, yaw: 0.08, act: {
      lean: [[0, 0.22], [1.5, 0.22], [2.3, -0.04], [5.6, -0.04], [6.6, 0.22], [L, 0.22]], pitch: [[0, 0.22], [1.5, 0.22], [2.3, -0.16], [5.6, -0.1], [6.6, 0.22], [L, 0.22]],
      yaw: [[0, -0.25], [1.6, -0.25], [2.4, 0], [L, -0.25]], roll: [[0, 0.06], [2.4, -0.06], [3.4, 0.14], [5.4, 0.14], [L, 0.06]],
      hop: [[0, 0], [2.1, 0], [2.45, 0.07], [2.8, 0], [L, 0]],
    } },
    // Rho looks straight up into the fire, and comes down in a nod
    rho: { x: 0.47, z: 0.5, yaw: -0.08, act: {
      hop: jump(2.7, 0.07), pitch: [[0, -0.08], [1.9, -0.08], [2.5, -0.5], [3.3, -0.5], [3.8, 0.14], [4.4, -0.08], [L, -0.08]],
      lean: [[0, 0], [2.5, -0.16], [3.3, -0.16], [3.8, 0.06], [4.4, 0], [L, 0]], roll: [[0, 0.1], [2.5, -0.06], [4.6, 0.1], [L, 0.1]], yaw: [[0, 0.1], [2.5, -0.1], [5, 0.1], [L, 0.1]],
    } },
    // Dina has her nose out over the rim after a Seed drifting past, and her ears fly
    dina: { x: 1.64, z: 0.05, yaw: -0.16, act: {
      yaw: [[0, 0.5], [1.9, 0.5], [2.6, -0.1], [4.4, -0.1], [5.6, 0.5], [L, 0.5]], pitch: [[0, -0.05], [1.9, -0.05], [2.6, -0.42], [3.6, -0.2], [5.6, -0.05], [L, -0.05]],
      roll: [[0, 0.16], [2.6, -0.1], [5, 0.16], [L, 0.16]], rear: [[0, 0], [2.1, 0], [2.6, 0.3], [3.3, 0], [L, 0]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z + 0.5, y: 0.6, height: heights[name] * 0.8, peak: 2.6, clear: name === 'dina' ? 0.8 : undefined }));
  const holds = [[0, 1], [1.5, 1], [2.2, 0], [5.8, 0], [6.7, 1], [L, 1]];
  const waves = [[0, 0], [2.3, 0], [2.8, 1], [5.0, 1], [5.7, 0], [L, 0]];
  const effects = [sparkles(fx, { loop, actors, each: 5, colors: [0xffffff, 0xfff0b8, 0xffe08a] })];

  scene.add(set, fx);

  return {
    cast,
    still: 3.0,
    camera: { y: 2.4, dist: 15, lookY: 2.17 },
    ready(rigs) {
      for (const [name, rig] of Object.entries(rigs)) rig.seatIn(balloon, { x: cast[name].x, y: BASKET.floor, z: cast[name].z, yaw: cast[name].yaw });
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const ease = (u) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };
      // the burner: a pilot flame, a roar that holds for a second and a half, and back
      const roar = ease((t - ROARS) / 0.3) * (1 - ease((t - ROARS - 1.5) / 0.6));
      // the balloon answers a moment later: it rises, then sinks back before the loop ends
      const lift = ease((t - ROARS - 0.3) / 1.6) * (1 - ease((t - 5.2) / 2.4));
      const flicker = 1 + Math.sin(w * 24) * 0.06 + Math.sin(w * 37) * 0.04;

      balloon.position.y = Math.sin(w) * 0.05 + lift * 0.16;
      balloon.rotation.z = Math.sin(w + 1) * 0.012;
      fire.flame.scale.set((0.7 + roar * 0.45) * (2 - flicker), (0.6 + roar * 0.75) * flicker, (0.7 + roar * 0.45) * (2 - flicker));
      fire.glow.scale.setScalar((0.5 + roar * 1.2) * flicker);
      fire.glow.material.opacity = 0.45 + roar * 0.4;
      fire.light.intensity = 1.5 + roar * 11 * flicker;
      top.skin.material.emissiveIntensity = GLOW + roar * 0.14;

      // Zara's hands come forward onto the rim while she leans out
      const hold = curve(holds, t);

      const wave = curve(waves, t);

      for (const side of ['Left', 'Right']) {
        rigs.zara.rot(`${side}Arm`, X, -hold * 0.3);
        rigs.zara.rot(`${side}ForeArm`, X, -hold * 1.0);
      }

      rigs.zara.rot('LeftArm', Z, wave * 0.5);
      rigs.zara.rot('LeftForeArm', Z, wave * 2.1 + wave * Math.sin(w * 12) * 0.25);

      for (const { one, x, phase } of clouds) one.position.x = x + Math.sin(w + phase) * 0.1;

      behind.far.position.y = FAR_Y + Math.sin(w + 2) * 0.1;

      for (const { one, x, y, z, phase } of chutes) {
        one.position.set(x + Math.sin(w + phase) * 0.12, y + Math.sin(w * 2 + phase) * 0.1 - Math.sin(w + phase) * 0.08, z);
        one.rotation.z = Math.cos(w + phase) * 0.16;
      }

      for (const { group, wings, x, y, z, phase } of flock) {
        const a = w + phase;

        group.position.set(x + Math.sin(a) * 0.26, y + Math.sin(a * 2) * 0.06, z + Math.cos(a) * 0.3);
        group.rotation.set(0, Math.atan2(Math.sin(a) * 0.3, Math.cos(a) * 0.3), Math.cos(a * 2) * 0.12);

        for (const { hinge, side } of wings) hinge.rotation.x = -side * (0.1 + Math.sin(w * 8 + phase * 3) * 0.6);
      }

      for (const effect of effects) effect(t);
    },
  };
}
