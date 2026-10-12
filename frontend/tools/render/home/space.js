// Home composition "space": the four mentors on a small moon, in clear round helmets, jumping slowly in its low
// gravity while Seeds drift around them.
//
// The setting is an island: a piece of moon with a curved, cratered top (the mentors stand lower the farther they are
// from its middle) and rock underneath. Behind them, to the left, the rocket they came in; to the right a flag with
// a Seed on it. Far behind, a ringed planet and a small moon hang in a cloud of deep indigo with stars in it: the
// cloud is what lets the stars show on the light page too, and it fades to nothing before the frame's borders.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, seedMesh, sequence, sparkles, sphere, sprite, standard, TEXTURES } from '../home-kit.js';

const MOON = { radius: 3.3, curve: 9.5, z: -0.5 };
/** How far the moon's surface is below its top, `x` and `z` in the scene. */
const drop = (x, z) => { const d2 = x * x + (z - MOON.z) ** 2; return MOON.curve - Math.sqrt(MOON.curve ** 2 - d2); };
// where the craters are, on the moon's own map (x right, z toward the reader, metres from its middle)
const CRATERS = [[-0.4, -1.9, 0.46], [1.3, -2.3, 0.3], [-2.4, 1.2, 0.3], [2.45, 1.3, 0.36], [0.25, 2.2, 0.3], [-1.3, 2.5, 0.22]];
const ROCKET = { x: -2.72, z: -1.5 };
const FLAG = { x: 2.85, z: -1.7 };

// ---- the moon
function moon() {
  const group = new THREE.Group();
  const R = MOON.radius;
  const next = sequence(31);
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const px = (v) => ((v / R + 1) / 2) * w;

    g.fillStyle = '#c9cbe6';
    g.fillRect(0, 0, w, w);

    // soft lighter and darker patches
    for (let i = 0; i < 70; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 40 + next() * 150;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.2)' : 'rgba(110,112,160,0.2)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // small pits
    for (let i = 0; i < 60; i++) {
      g.fillStyle = 'rgba(96,98,150,0.3)';
      g.beginPath();
      g.arc(next() * w, next() * w, 4 + next() * 12, 0, TAU);
      g.fill();
    }

    // the craters' floors: darker, with the shade on the side the light comes from
    for (const [x, z, r] of CRATERS) {
      const size = (r / R) * (w / 2);
      const shade = g.createRadialGradient(px(x) - size * 0.25, px(z) - size * 0.25, size * 0.1, px(x), px(z), size);

      shade.addColorStop(0, '#8689b5');
      shade.addColorStop(1, '#a9acd0');
      g.fillStyle = shade;
      g.beginPath();
      g.arc(px(x), px(z), size, 0, TAU);
      g.fill();
    }
  });
  const top = new THREE.RingGeometry(0.0001, R, 128, 28);
  const at = top.attributes.position;

  // a flat disc, bent down around its middle
  top.rotateX(-Math.PI / 2);

  for (let i = 0; i < at.count; i++) at.setY(i, -(MOON.curve - Math.sqrt(MOON.curve ** 2 - at.getX(i) ** 2 - at.getZ(i) ** 2)));

  top.computeVertexNormals();

  const surface = mesh(top, standard(0xffffff, 0.92, { map: picture }));
  const edge = MOON.curve - Math.sqrt(MOON.curve ** 2 - R * R);

  surface.castShadow = false;
  group.add(surface, lathe([[0, -1.45], [1.3, -1.38], [2.4, -1.15], [3.05, -0.85], [R, -edge]], standard(0x7f82ad, 0.95)));

  // a raised rim around each crater
  for (const [x, z, r] of CRATERS) {
    const rim = mesh(new THREE.TorusGeometry(r, r * 0.17, 14, 56), standard(0xd9dbf0, 0.9), x, -(MOON.curve - Math.sqrt(MOON.curve ** 2 - x * x - z * z)) + 0.01, z);

    rim.rotation.x = Math.PI / 2;
    rim.scale.z = 0.55;
    group.add(rim);
  }

  // a few round rocks
  for (const [x, z, r] of [[-2.75, 0.3, 0.2], [2.9, 0.1, 0.17], [1.9, -2.6, 0.24], [-1.5, -2.7, 0.16], [1.9, 2.3, 0.14], [-2.0, 2.2, 0.18]]) {
    group.add(sphere(r, standard(i5(x), 0.95), x, -(MOON.curve - Math.sqrt(MOON.curve ** 2 - x * x - z * z)) + r * 0.45, z, 0.7));
  }

  return group;
}

/** Two greys for the rocks, chosen by where the rock is. */
const i5 = (x) => (x > 0 ? 0xa3a6cb : 0x9295bd);

// ---- the rocket: a round white body, an orange nose, three round fins, a window that glows
function rocket() {
  const group = new THREE.Group();
  const white = standard(0xf6f6fd, 0.35);
  const orange = standard(C.orange, 0.4);
  const body = [[0, 0.42], [0.26, 0.42], [0.4, 0.62], [0.46, 1.05], [0.44, 1.5], [0.36, 1.86], [0.2, 2.2], [0.07, 2.36], [0, 2.4]];
  const window = new THREE.Group();

  group.add(
    lathe(body, white),
    lathe([[0.4, 1.7], [0.36, 1.86], [0.2, 2.2], [0.07, 2.36], [0, 2.4]].map(([r, h]) => [r * 1.03 + 0.004, h + 0.004]), orange),
    cylinder(0.47, 0.47, 0.13, standard(C.indigo, 0.4), 0, 0.92, 0, 64),
    cylinder(0.2, 0.3, 0.24, standard(C.slate, 0.5, { metalness: 0.3 }), 0, 0.34, 0),
  );

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const fin = sphere(0.42, orange, Math.sin(a) * 0.5, 0.44, Math.cos(a) * 0.5);

    fin.scale.set(0.16, 1.05, 0.8);
    fin.rotation.y = a;
    group.add(fin);
  }

  // the window looks toward the reader
  window.add(mesh(new THREE.TorusGeometry(0.17, 0.035, 14, 48), standard(C.indigo, 0.4)), mesh(new THREE.CircleGeometry(0.15, 40), lit(0x8fd0ff, 1.6)));
  window.position.set(Math.sin(0.35) * 0.45, 1.4, Math.cos(0.35) * 0.45);
  window.rotation.y = 0.35;
  group.add(window);
  group.rotation.z = 0.05;
  group.scale.setScalar(0.86);

  return group;
}

// ---- the flag: a pole and a cloth with a Seed on it, moving as if the mentors had just planted it
function flag() {
  const group = new THREE.Group();
  const metal = standard(0xe9eaf6, 0.35, { metalness: 0.4 });
  const picture = canvasTexture([512, 320], (g, w, h) => {
    g.fillStyle = '#5c55fd';
    g.beginPath();
    g.roundRect(0, 0, w, h, [0, 70, 70, 0]);
    g.fill();
    g.strokeStyle = '#8f8aff';
    g.lineWidth = 16;
    g.beginPath();
    g.roundRect(22, 22, w - 44, h - 44, [0, 52, 52, 0]);
    g.stroke();
    drawSeed(g, w / 2, h / 2, h * 0.62);
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.58, 28, 1), new THREE.MeshStandardMaterial({ map: picture, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }));

  cloth.position.set(0.48, 1.62, 0);
  cloth.castShadow = true;
  group.add(cylinder(0.024, 0.028, 2.0, metal, 0, 1.0, 0, 20), sphere(0.05, standard(C.gold, 0.3, { metalness: 0.6 }), 0, 2.02, 0), cloth);

  const rest = Float32Array.from(cloth.geometry.attributes.position.array);

  return {
    group,
    wave(w) {
      const at = cloth.geometry.attributes.position;

      for (let i = 0; i < at.count; i++) {
        const along = (rest[i * 3] + 0.46) / 0.92; // 0 at the pole, 1 at the free end

        at.setZ(i, Math.sin(along * 5 - w * 3) * 0.07 * along);
      }

      at.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
    },
  };
}

// ---- far behind: a cloud of deep indigo, a ringed planet, a small moon, stars
function sky(fx, loop) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(34,26,112,0.96)');
    deep.addColorStop(0.55, 'rgba(46,34,140,0.82)');
    deep.addColorStop(0.82, 'rgba(64,52,180,0.3)');
    deep.addColorStop(1, 'rgba(64,52,180,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // two faint clouds of color inside it
    for (const [x, y, r, color] of [[0.3, 0.42, 0.26, '255,111,165'], [0.68, 0.56, 0.3, '75,148,255']]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},0.26)`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  const bands = canvasTexture([512, 256], (g, w, h) => {
    ['#ffb36b', '#ff9a5c', '#ffd08a', '#ff8fa6', '#ffb36b', '#f7a15a', '#ffd9a0', '#ff9a5c'].forEach((color, i, all) => {
      g.fillStyle = color;
      g.fillRect(0, (i / all.length) * h, w, h / all.length + 1);
    });
  });
  const planet = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.95, 128, 1), new THREE.MeshBasicMaterial({
    map: canvasTexture([512, 8], (g, w, h) => {
      const fade = g.createLinearGradient(0, 0, w, 0);

      fade.addColorStop(0, 'rgba(255,225,160,0)');
      fade.addColorStop(0.25, 'rgba(255,225,160,0.85)');
      fade.addColorStop(0.55, 'rgba(255,190,150,0.5)');
      fade.addColorStop(0.75, 'rgba(255,225,160,0.8)');
      fade.addColorStop(1, 'rgba(255,225,160,0)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
    }),
    transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
  }));
  // the ring's picture runs from its inner edge to its outer one
  const uv = ring.geometry.attributes.uv;
  const at = ring.geometry.attributes.position;

  for (let i = 0; i < uv.count; i++) uv.setXY(i, (Math.hypot(at.getX(i), at.getY(i)) - 1.25) / 0.7, 0.5);

  ring.rotation.x = -1.2;
  planet.add(mesh(new THREE.SphereGeometry(1, 64, 40), standard(0xffffff, 0.8, { map: bands })), ring);
  planet.children[0].castShadow = false;
  planet.position.set(3.2, 2.55, -6);
  planet.rotation.z = 0.32;

  const small = sphere(0.3, standard(0x7fe6cf, 0.8), -3.7, 3.15, -5.2);

  small.castShadow = false;
  cloud.position.set(0, 1.2, -8);
  cloud.scale.set(10.2, 6.0, 1);
  group.add(cloud, planet, small);

  // stars inside the cloud
  const next = sequence(17);
  const updates = [];

  for (let i = 0; i < 64; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(next());
    const star = sprite(i % 5 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0xfff0b8, 0xdcd9ff][i % 3], 1);
    const size = (i % 5 ? 0.05 : 0.22) + next() * 0.07;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    star.position.set(Math.cos(a) * r * 4.5, 1.25 + Math.sin(a) * r * 2.55, -7.5);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.55 + 0.45 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = twinkle;
    });
  }

  return { group, planet, update: (t) => { for (const update of updates) update(t); } };
}

// ---- a clear round helmet: nearly invisible face on, brighter toward its edge, with a small shine
function helmet(radius) {
  const group = new THREE.Group();
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
    fragmentShader: 'varying vec3 vNormal; varying vec3 vView; void main() { float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6); gl_FragColor = vec4(mix(vec3(0.78, 0.88, 1.0), vec3(1.0), edge), 0.07 + edge * 0.85); }',
  }));
  const shine = sprite(TEXTURES.dot, 0xffffff, 10);

  bubble.renderOrder = 9;
  shine.scale.set(radius * 0.5, radius * 0.24, 1);
  shine.material.rotation = 0.7;
  shine.material.opacity = 0.9;
  shine.position.set(-radius * 0.45, radius * 0.5, radius * 0.7);
  group.add(bubble, shine);

  return group;
}

// each mentor's helmet: its size, and where its middle is from the head bone (up, and forward along the snout)
const HELMET = { zara: [0.31, 0.13, 0.02], rho: [0.47, 0.22, 0.05], liruf: [0.6, 0.2, 0.1], dina: [0.62, 0.14, 0.24] };

export function build(scene, { loop, heights, tuck, number }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const planted = flag();
  const far = sky(fx, loop);
  /** A jump in low gravity: a slow rise, a long time in the air, a slow fall. */
  const slow = (at, height) => [[0, 0], [at - 1.35, 0], [at - 1.05, -0.04], [at, height], [at + 1.05, -0.03], [at + 1.35, 0], [L, 0]];

  set.add(place(moon(), 0, MOON.z), far.group);
  set.add(place(rocket(), ROCKET.x, ROCKET.z, 0, -drop(ROCKET.x, ROCKET.z) - 0.36), place(planted.group, FLAG.x, FLAG.z, -0.2, -drop(FLAG.x, FLAG.z)));

  // the moon's own soft shadow on the page, and a little light from the rocket's window
  set.add(decal(radial([[0, 'rgba(60,50,170,0.28)'], [0.6, 'rgba(60,50,170,0.14)'], [1, 'rgba(60,50,170,0)']]), 0, -1.5, MOON.z, 3.9, 3.2, 0));

  const windowLight = new THREE.PointLight(0x8fd0ff, 2.5, 3.5, 1.8);

  windowLight.position.set(ROCKET.x + 0.4, 1.1, ROCKET.z + 0.7);
  set.add(windowLight);

  const spot = (x, z, yaw, act) => ({ x, z, yaw, y: -drop(x, z), act });
  const cast = {
    // Liruf takes the biggest jump and hangs in the air
    liruf: spot(-1.62, -0.05, 0.3, {
      hop: slow(2.3, 0.62), tuck: tuck(2.3, 0.8), lean: [[0, 0.04], [2.3, -0.14], [3.6, 0.04], [L, 0.04]], pitch: [[0, -0.1], [2.3, -0.3], [3.6, -0.1], [L, -0.1]],
      roll: [[0, -0.12], [2.3, 0.14], [4.4, -0.12], [L, -0.12]], tilt: [[0, 0], [2.3, -0.12], [3.6, 0], [L, 0]], turn: [[0, 0], [2.3, 0.25], [3.7, 0], [L, 0]],
    }),
    // Zara floats, tilting slowly, and waves
    zara: spot(-0.4, 0.42, 0.1, {
      still: 1, lift: [[0, 0.3], [2, 0.5], [4, 0.3], [6, 0.46], [L, 0.3]], tilt: [[0, -0.1], [2, 0.08], [4, -0.06], [6, 0.1], [L, -0.1]],
      tuck: [[0, 0.25], [2, 0.5], [4, 0.25], [6, 0.45], [L, 0.25]], wave: [[0, 0], [1.2, 0], [1.8, 1], [4.2, 1], [4.9, 0], [L, 0]],
      lean: [[0, -0.06], [L, -0.06]], pitch: [[0, -0.12], [L, -0.12]], roll: [[0, 0.1], [4, -0.06], [L, 0.1]],
    }),
    // Rho watches Liruf go up, then takes his own jump
    rho: spot(0.55, 0.45, -0.1, {
      hop: slow(5.4, 0.42), tuck: tuck(5.4, 0.7), yaw: [[0, -0.5], [3.2, -0.5], [4.2, 0], [6.6, 0], [7.4, -0.5], [L, -0.5]],
      pitch: [[0, -0.1], [1.4, -0.1], [2.3, -0.36], [3.4, -0.1], [5.4, -0.28], [6.4, -0.1], [L, -0.1]], lean: [[0, -0.03], [2.3, -0.1], [3.4, -0.03], [L, -0.03]], roll: [[0, 0.1], [4, -0.1], [L, 0.1]],
    }),
    // Dina rears up to sniff a Seed drifting over her
    dina: spot(1.8, -0.1, -0.5, {
      hop: slow(2.7, 0.2), rear: [[0, 0], [1.8, 0], [2.7, 1], [3.8, 0], [L, 0]], pitch: [[0, -0.2], [2.7, -0.46], [3.9, -0.2], [L, -0.2]],
      roll: [[0, 0.18], [2.7, -0.1], [4.5, 0.18], [L, 0.18]], yaw: [[0, 0.15], [L, 0.15]],
    }),
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, y: at.y, height: heights[name], peak: { liruf: 2.3, rho: 5.4, dina: 2.7 }[name] ?? null }));

  // Seeds adrift, each turning at its own pace
  const next = sequence(8);
  const adrift = [[-2.55, 2.7, -0.6], [-0.75, 3.0, -1.2], [0.45, 2.7, -0.4], [1.75, 3.0, -1.0], [3.1, 1.9, -0.2]].map(([x, y, z]) => {
    const seed = seedMesh(0.38 + next() * 0.12);
    const glow = halo(0.42, 0xffe2a0, 0.45);

    seed.castShadow = false;
    fx.add(seed, glow);

    return { seed, glow, x, y, z, phase: next() * TAU, turns: 1 + Math.floor(next() * 2), lean: (next() - 0.5) * 1.2 };
  });
  // a shooting star crosses the cloud once a loop
  const streak = sprite(TEXTURES.dot, 0xffffff, 1);

  fx.add(streak);

  const effects = [far.update, sparkles(fx, { loop, actors, each: 6 }), landings(fx, { actors, after: 1.05, color: 0xe6e7ff, lasts: 1.1 })];
  const helmets = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.45,
    camera: { y: 2.5, dist: 15.2, lookY: 0.95 },
    ready(rigs) {
      for (const [name, rig] of Object.entries(rigs)) {
        const [radius, up, forward] = HELMET[name];
        const bubble = helmet(number(`${name}r`, radius));

        scene.add(bubble);
        helmets.push({ rig, bubble, up: number(`${name}u`, up), forward: number(`${name}f`, forward) });
      }
    },
    update(t) {
      const w = (t / loop) * TAU;
      const head = new THREE.Vector3();

      // each helmet follows its mentor's head
      for (const { rig, bubble, up, forward } of helmets) {
        rig.holder.updateWorldMatrix(true, true);
        rig.head.getWorldPosition(head);

        const facing = rig.holder.rotation.y;

        bubble.position.set(head.x + Math.sin(facing) * forward, head.y + up, head.z + Math.cos(facing) * forward);
      }

      for (const { seed, glow, x, y, z, phase, turns, lean } of adrift) {
        seed.position.set(x + Math.sin(w + phase) * 0.1, y + Math.sin(w * 2 + phase) * 0.09, z);
        seed.rotation.set(lean, w * turns + phase, lean * 0.5);
        glow.position.copy(seed.position);
      }

      planted.wave(w);
      // the planet turns once on its own axis per loop; its ring and its tilt stay where they are, so the loop closes
      far.planet.children[0].rotation.y = w;

      const u = (t - 5.2) / 0.7;

      streak.visible = u > 0 && u < 1;
      streak.position.set(-3.6 + u * 3.4, 3.7 - u * 1.2, -7.4);
      streak.scale.set(0.9, 0.05, 1);
      streak.material.rotation = -0.34;
      streak.material.opacity = Math.sin(u * Math.PI);

      for (const effect of effects) effect(t);
    },
  };
}
