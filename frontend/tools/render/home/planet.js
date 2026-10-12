// Home composition "planet": the four mentors, in clear round helmets, have landed on a warm little world and found
// a plant that grows Seeds. One has just ripened: it floats out of its pod and hangs in the air between them.
//
// The setting is an island: a round piece of coral ground with patches of teal moss and rose rock underneath. In its
// middle, behind the mentors, the plant: a tall stalk whose branches end in glass pods, a Seed in each. The mentors
// stand two on each side of it, so it is seen from the ground up. Everything else keeps to the two ends, where it
// has air from every mentor: on the left a giant round mushroom whose cap is higher than anybody's head (somebody
// small looks over its top), on the right a stand of round crystals that glow, another small local behind the
// shortest. The probe the mentors brought hangs in the air above them, watching the Seed. Far behind, two suns hang
// in a cloud of plum and rose that fades to nothing before the frame's borders.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.5, z: -0.5 };
const PLANT = { x: 0, z: -1.05 };
const MUSHROOM = { x: -3.2, z: -0.6 };
const CRYSTALS = { x: 3.24, z: -0.1 };
const PROBE = { x: 1.6, y: 2.92, z: -0.7 };
const RIPE = 1.5; // the second the Seed comes out of its pod
const FLOAT = { x: -0.3, y: 1.56, z: 0.3 }; // where it hangs afterwards
const LOW = { x: -0.32, y: 2.16, z: 0.42 }; // the pod it comes out of, from the plant's foot

// ---- the ground: coral, with patches of teal moss and pale dots
function ground() {
  const group = new THREE.Group();
  const next = sequence(53);
  const R = GROUND.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    g.fillStyle = '#ff9a80';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 150;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,214,170,0.42)' : 'rgba(236,96,110,0.3)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // moss: round teal patches, soft at their edges, none where the mentors stand
    for (let i = 0; i < 46; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 26 + next() * 74;

      if (Math.abs(x - w / 2) < w * 0.36 && Math.abs(y - w * 0.56) < w * 0.11) continue;

      const moss = g.createRadialGradient(x, y, r * 0.5, x, y, r);

      moss.addColorStop(0, 'rgba(38,190,176,0.85)');
      moss.addColorStop(1, 'rgba(38,190,176,0)');
      g.fillStyle = moss;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = 'rgba(150,240,220,0.7)';
      g.beginPath();
      g.arc(x - r * 0.2, y - r * 0.2, r * 0.22, 0, TAU);
      g.fill();
    }

    for (let i = 0; i < 130; i++) {
      g.fillStyle = i % 3 ? 'rgba(255,236,210,0.75)' : 'rgba(214,76,104,0.4)';
      g.beginPath();
      g.arc(next() * w, next() * w, 3 + next() * 7, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xf07f72, 0.9), standard(0xffffff, 0.92, { map: picture }), standard(0xb65470, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0xf58a78, 0.92), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.95], [0.9, -0.9], [2.1, -0.68], [3.0, -0.36], [R - 0.04, -0.1]], standard(0xb65470, 0.95)));

  return group;
}

/** A glass pod with a Seed in it, hanging from `y` down: the Seed, its glow, and what moves. */
function pod(radius, color = 0xffb3d9) {
  const group = new THREE.Group();
  const seed = seedMesh(radius * 1.25);
  const glow = halo(radius * 2.1, color, 0.5);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.08, transparent: true, opacity: 0.3, depthWrite: false, emissive: color, emissiveIntensity: 0.35 }));

  seed.castShadow = false;
  seed.position.y = -radius;
  glow.position.y = -radius;
  shell.position.y = -radius;
  shell.renderOrder = 7;
  // the cap the pod hangs by
  group.add(glow, seed, shell, sphere(radius * 0.5, standard(C.mintDeep, 0.6), 0, -radius * 0.08, 0, 0.55));

  return { group, seed, glow, shell };
}

// ---- the plant that grows Seeds: a tall stalk that ends in a curl, branches that end in pods, round leaves
function plant() {
  const group = new THREE.Group();
  const stalk = standard(0x19a394, 0.6);
  const leaf = standard(0x2cc4ac, 0.65);
  const pods = [];
  // the stalk leans away from where the ripe Seed will hang, and its top rolls up like a fern before it opens
  const spine = [[0.02, 0, 0], [0.17, 0.8, 0], [0.15, 1.6, 0], [0.02, 2.3, 0], [0, 2.78, 0]];

  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * TAU * 1.25;
    const r = 0.27 * (1 - i / 20);

    spine.push([0.27 - Math.cos(a) * r, 2.78 + Math.sin(a) * r, 0]);
  }

  group.add(tube(spine, 0.1, stalk, 140), sphere(0.13, stalk, spine[spine.length - 1][0], spine[spine.length - 1][1], 0, 1));

  // the branches: each leaves the stalk, arches out and comes down a little to where its pod hangs
  for (const [x, y, from, r] of [[-0.9, 2.3, 1.78, 0.2], [0.88, 2.4, 1.95, 0.21], [-0.56, 2.84, 2.36, 0.17]]) {
    const one = pod(r, x < 0 ? 0xffb3d9 : 0xffd08a);

    group.add(tube([[0.06, from, 0], [x * 0.45, y + 0.02, 0.04], [x * 0.85, y + 0.14, 0.08], [x, y, 0.1]], 0.045, stalk, 32));
    one.group.position.set(x, y, 0.1);
    group.add(one.group);
    pods.push(one);
  }

  // the pod the ripe Seed comes out of: lower, on a short branch toward the reader, over where the Seed will hang
  const low = pod(0.22, 0xffd08a);

  group.add(tube([[0.12, 1.75, 0], [-0.04, 2.1, 0.16], [-0.24, 2.24, 0.32], [LOW.x, LOW.y, LOW.z]], 0.045, stalk, 32));
  low.group.position.set(LOW.x, LOW.y, LOW.z);
  low.seed.visible = false;
  group.add(low.group);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.5;
    const one = sphere(0.28, leaf, Math.cos(a) * 0.28, 0.07, Math.sin(a) * 0.28, 0.2);

    one.scale.x = 0.6;
    one.rotation.y = -a + Math.PI / 2;
    group.add(one);
  }

  return { group, pods, low };
}

// ---- a giant round mushroom: a fat stem, a cap like a cushion, spots that glow
function mushroom(height, cap, color, spot, stem = cap * 0.3) {
  const group = new THREE.Group();
  const top = sphere(cap, standard(color, 0.55), 0, height, 0, 0.5);
  const lights = [];

  group.add(
    lathe([[0, 0], [stem * 1.2, 0], [stem * 1.32, height * 0.05], [stem, height * 0.3], [stem * 0.84, height * 0.7], [stem, height * 0.96], [0, height * 0.96]], standard(0xffe6d8, 0.8), 0, 0, 0, 40),
    top,
    sphere(cap * 0.92, standard(0xffd9cc, 0.8), 0, height - cap * 0.06, 0, 0.3),
  );

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    const out = i % 2 ? 0.74 : 0.42;
    const dot = sphere(cap * (i % 2 ? 0.1 : 0.14), lit(spot, 1.3), Math.cos(a) * cap * out, height + cap * 0.5 * Math.sqrt(1 - out * out) + 0.005, Math.sin(a) * cap * out, 0.45);

    dot.castShadow = false;
    group.add(dot);
    lights.push(dot);
  }

  return { group, lights };
}

// ---- crystals without an edge: round pillars of colored glass that give a little light, the tallest at the back
function crystals() {
  const group = new THREE.Group();
  const glows = [];

  for (const [x, z, radius, height, color, lean] of [[0.04, -0.55, 0.2, 2.1, 0x4fe3d2, 0.03], [-0.03, 0, 0.18, 1.35, 0xff8fc7, -0.04], [0.02, 0.55, 0.17, 0.62, 0xa996ff, 0.03]]) {
    const pillar = mesh(new THREE.CapsuleGeometry(radius, height - radius * 2, 16, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.12, emissive: color, emissiveIntensity: 0.5 }), x, height / 2 - 0.04, z);
    const core = mesh(new THREE.CapsuleGeometry(radius * 0.3, height * 0.4, 8, 16), lit(0xffffff, 1.2, { transparent: true, opacity: 0.35 }), x - radius * 0.3, height * 0.56, z + radius * 0.8);
    const glow = halo(radius * 2.4, color, 0.42);

    pillar.rotation.z = lean;
    core.rotation.z = lean;
    core.castShadow = false;
    glow.position.set(x, height * 0.6, z - 0.1);
    group.add(glow, pillar, core);
    glows.push(glow);
  }

  return { group, glows };
}

// ---- the probe: a small round body that hangs in the air, one bright lens, an antenna, a ring of light under it
function probe() {
  const group = new THREE.Group();
  const white = standard(0xf6f6fd, 0.35);
  const dark = standard(C.slate, 0.6);
  const head = new THREE.Group();
  const tip = sphere(0.04, lit(0xff6b7a, 2.4), 0.1, 0.5, 0, 1);
  const lift = mesh(new THREE.TorusGeometry(0.16, 0.03, 12, 48), lit(0x8fd0ff, 2.2), 0, -0.2, 0);
  const band = mesh(new THREE.TorusGeometry(0.262, 0.028, 12, 64), standard(C.orange, 0.45), 0, 0, 0);
  const glow = halo(0.34, 0x8fd0ff, 0.5);

  lift.rotation.x = Math.PI / 2;
  band.rotation.x = Math.PI / 2;
  glow.position.y = -0.26;
  // the lens looks down toward the Seed
  head.add(sphere(0.085, lit(0x8fd0ff, 2.2), 0, 0, 0.2, 1), mesh(new THREE.TorusGeometry(0.09, 0.02, 10, 32), dark, 0, 0, 0.21));
  group.add(sphere(0.26, white, 0, 0, 0, 0.82), band, lift, glow, head, cylinder(0.011, 0.014, 0.3, dark, 0.1, 0.34, 0, 12), tip);

  return { group, head, tip, glow };
}

// ---- somebody who lives here: a small round body, two big eyes, two feelers with a light at each tip
function local(color, belly) {
  const group = new THREE.Group();
  const skin = standard(color, 0.6);
  const lids = [];

  group.add(sphere(0.2, skin, 0, 0, 0, 0.92), sphere(0.11, standard(belly, 0.7), 0, -0.07, 0.13, 0.8));

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();

    eye.add(sphere(0.062, standard(0xffffff, 0.3), 0, 0, 0, 1), sphere(0.034, standard(C.ink, 0.3), 0, 0, 0.038, 1), sphere(0.012, lit(0xffffff, 1.5), 0.014, 0.016, 0.066, 1));
    eye.position.set(side * 0.075, 0.06, 0.16);
    group.add(eye, tube([[side * 0.07, 0.16, 0], [side * 0.11, 0.28, 0.01], [side * 0.17, 0.35, 0.02]], 0.014, skin, 12), sphere(0.032, lit(0xfff0a0, 2.2), side * 0.17, 0.36, 0.02, 1));
    lids.push(eye);
  }

  return { group, lids };
}

/** A cluster of round lamps that grow flat on the ground. */
function buttons(colors) {
  const group = new THREE.Group();
  const glows = [];

  [[0, 0, 0.1], [0.2, 0.08, 0.065], [-0.13, 0.15, 0.05]].forEach(([x, z, r], i) => {
    const lamp = sphere(r, lit(colors[i % colors.length], 1.7), x, r * 0.42, z, 0.6);
    const glow = halo(r * 2.6, colors[i % colors.length], 0.45);

    lamp.castShadow = false;
    glow.position.set(x, r * 0.5, z);
    group.add(lamp, glow);
    glows.push(glow);
  });

  return { group, glows };
}

// ---- far behind: a cloud of plum and rose with two suns in it
function sky(fx, loop) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(118,44,132,0.94)');
    deep.addColorStop(0.5, 'rgba(176,58,124,0.84)');
    deep.addColorStop(0.8, 'rgba(240,112,104,0.34)');
    deep.addColorStop(1, 'rgba(255,150,110,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // two faint clouds of color inside it, and only inside it
    g.globalCompositeOperation = 'source-atop';

    for (const [x, y, r, color] of [[0.28, 0.4, 0.26, '255,196,120'], [0.72, 0.5, 0.26, '80,220,200']]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},0.3)`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  const suns = [[-3.3, 3.42, -6.4, 0.62, 0xffe7a6, 0xffc66b], [3.55, 3.62, -6.2, 0.3, 0xb6fff0, 0x54e0c8]].map(([x, y, z, r, color, shine]) => {
    const disc = sphere(r, lit(color, 1.6), x, y, z, 1);
    const glow = halo(r * 2.6, shine, 0.6);

    disc.castShadow = false;
    glow.position.set(x, y, z - 0.2);
    glow.renderOrder = 1;
    group.add(glow, disc);

    return { glow, r };
  });

  cloud.position.set(0, 1.62, -8);
  cloud.scale.set(10.6, 6.0, 1);
  group.add(cloud);

  const next = sequence(29);
  const updates = [];

  for (let i = 0; i < 44; i++) {
    const a = next() * TAU;
    const r = Math.sqrt(next());
    const star = sprite(i % 5 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0xffe9c0, 0xffd0e6][i % 3], 1);
    const size = (i % 5 ? 0.05 : 0.2) + next() * 0.07;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    star.position.set(Math.cos(a) * r * 4.6, 1.65 + Math.sin(a) * r * 2.5, -7.5);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.55 + 0.45 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = twinkle;
    });
  }

  return { group, suns, update: (t) => { for (const update of updates) update(t); } };
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
  const grown = plant();
  const giant = mushroom(2.55, 0.5, 0x1fb8a6, 0xfff0a0, 0.19);
  const stand = crystals();
  const scout = probe();
  const far = sky(fx, loop);
  const peekers = [
    // behind the shortest crystal, looking over it
    { ...local(0xfff0a0, 0xffffff), x: CRYSTALS.x + 0.02, y: 0.62, z: CRYSTALS.z + 0.28, yaw: -0.5, rise: 0.2, phase: 0 },
    // on the giant mushroom, looking over its top
    { ...local(0xffb14a, 0xffe6bd), x: MUSHROOM.x + 0.12, y: 2.86, z: MUSHROOM.z - 0.3, yaw: 0.35, rise: 0.2, phase: 2.6 },
  ];
  const lamps = [
    { ...buttons([0xffd36b, 0xff9ecf, 0x8ff0e0]), x: -1.75, z: 2.38, yaw: 0.2 },
    { ...buttons([0x8ff0e0, 0xffd36b, 0xff9ecf]), x: -0.2, z: 2.72, yaw: 2.1 },
    { ...buttons([0xff9ecf, 0x8ff0e0, 0xffd36b]), x: 1.5, z: 2.45, yaw: 4.0 },
  ];

  set.add(place(ground(), 0, GROUND.z), shadowCatcher(GROUND.radius - 0.1, 0.008, GROUND.z, 0.3), far.group);
  set.add(decal(radial([[0, 'rgba(96,40,120,0.3)'], [0.6, 'rgba(96,40,120,0.15)'], [1, 'rgba(96,40,120,0)']]), 0, -1.35, GROUND.z, 3.8, 3.1, 0));
  set.add(place(grown.group, PLANT.x, PLANT.z), place(giant.group, MUSHROOM.x, MUSHROOM.z), place(stand.group, CRYSTALS.x, CRYSTALS.z), place(scout.group, PROBE.x, PROBE.z, -0.75, PROBE.y));

  for (const { group, x, z, yaw } of lamps) set.add(place(group, x, z, yaw));
  for (const { group, x, y, z, yaw } of peekers) set.add(place(group, x, z, yaw, y));

  // real light from the pods, the crystals and the ripe Seed
  const podLight = new THREE.PointLight(0xffb3d9, 5, 5.5, 1.8);
  const crystalLight = new THREE.PointLight(0x7ff0e0, 5, 5, 1.8);
  const seedLight = new THREE.PointLight(0xffd070, 0, 4, 1.8);

  podLight.position.set(PLANT.x, 2.6, PLANT.z + 0.8);
  crystalLight.position.set(CRYSTALS.x - 0.5, 1.4, CRYSTALS.z + 0.6);
  set.add(podLight, crystalLight, seedLight);

  // the ripe Seed, its glow and its rays
  const ripe = seedMesh(0.44);
  const rays = sprite(TEXTURES.star, 0xffe08a, 5);
  const glow = halo(0.6, 0xffd36b, 0.6);
  const ring = sprite(TEXTURES.ring, 0xffe6a3, 7);

  ripe.castShadow = false;
  fx.add(glow, rays, ripe, ring);

  const cast = {
    // Liruf jumps when the Seed comes out, and cannot take his eyes off it
    liruf: { x: -2.17, z: -0.1, yaw: 0.42, act: {
      hop: jump(2.25, 0.2), tuck: tuck(2.25, 0.8), yaw: [[0, 0.45], [L, 0.45]], pitch: [[0, -0.2], [1.5, -0.3], [2.6, -0.02], [L, -0.2]],
      lean: [[0, 0.06], [2.25, -0.08], [2.9, 0.14], [5, 0.1], [L, 0.06]], roll: [[0, -0.12], [2.6, 0.12], [5, -0.12], [L, -0.12]], tilt: [[0, 0.02], [2.25, -0.02], [3.2, 0.04], [L, 0.02]],
    } },
    // Zara holds a hand out toward it and bobs on her toes
    zara: { x: -0.98, z: 0.38, yaw: 0.34, act: {
      hop: [[0, 0], [2.5, 0], [2.7, -0.03], [2.95, 0.1], [3.2, 0], [3.5, 0.06], [3.8, 0], [L, 0]], yaw: [[0, 0.5], [3.6, 0.5], [4.4, -0.1], [5.6, -0.1], [6.4, 0.5], [L, 0.5]],
      pitch: [[0, -0.12], [1.5, -0.26], [2.6, -0.02], [L, -0.12]], lean: [[0, 0.02], [2.6, 0.1], [5, 0.04], [L, 0.02]], roll: [[0, 0.1], [2.6, 0.16], [4.4, -0.08], [L, 0.1]], tilt: [[0, 0.02], [2.6, 0.07], [5.4, 0.02], [L, 0.02]],
    } },
    // Rho follows it down with his head, then jumps and nods
    rho: { x: 0.98, z: 0.42, yaw: -0.32, act: {
      hop: jump(3.0, 0.16), tuck: tuck(3.0, 0.7), yaw: [[0, -0.42], [L, -0.42]], pitch: [[0, -0.2], [1.5, -0.36], [2.5, -0.04], [3.0, -0.2], [3.45, 0.12], [4.1, -0.06], [L, -0.2]],
      lean: [[0, 0.03], [2.5, 0.1], [3.0, -0.1], [3.45, 0.1], [4.2, 0.03], [L, 0.03]], roll: [[0, 0.1], [2.5, -0.1], [4.6, 0.1], [L, 0.1]], tilt: [[0, -0.02], [2.5, -0.05], [4.2, -0.02], [L, -0.02]],
    } },
    // Dina stretches her nose toward it, sniffing
    dina: { x: 2.3, z: -0.12, yaw: -0.25, act: {
      hop: jump(2.6, 0.1), rear: [[0, 0], [2.15, 0], [2.6, 0.7], [3.3, 0], [L, 0]], yaw: [[0, -0.5], [L, -0.5]],
      pitch: [[0, -0.26], [1.5, -0.36], [2.6, -0.12], [4, 0.04], [5.2, -0.1], [L, -0.26]], roll: [[0, 0.2], [2.6, -0.1], [4.4, 0.2], [L, 0.2]], lean: [[0, 0], [4, 0.12], [5.4, 0.12], [6.4, 0], [L, 0]],
    } },
  };
  // each mentor's own room in the picture, helmet and all, which no twinkle enters
  const ROOM = { liruf: [0.72, 2.3], zara: [0.42, 2.15], rho: [0.56, 2.15], dina: [0.76, 2.4] };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, y: 0, height: heights[name], half: ROOM[name][0], top: ROOM[name][1], peak: { liruf: 2.25, zara: 2.95, rho: 3.0, dina: 2.6 }[name] }));
  const effects = [
    far.update,
    twinkles(fx, { loop, actors, each: 4, colors: [0xffffff, 0xfff0b8, 0xffd0e6] }),
    landings(fx, { actors, color: 0xffe3d2 }),
    // spores rise all over the ground, and specks of light from the plant
    rising(fx, { loop, at: { x: 0, y: 0.15, z: -0.6 }, radius: 3.2, height: 2.6, count: 36, color: [0xfff0a0, 0x8ff0e0, 0xffb3d9], size: [0.03, 0.075], seed: 14, sway: 0.14, depth: 0.75 }),
    rising(fx, { loop, at: { x: PLANT.x, y: 2.2, z: PLANT.z + 0.2 }, radius: 1.0, height: 1.2, count: 18, color: [0xffe6a3, 0xffd0e6], size: [0.04, 0.09], seed: 21, texture: TEXTURES.star, depth: 0.3 }),
  ];
  const helmets = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.6,
    camera: { y: 2.4, dist: 14.8, lookY: 1.34 },
    ready(rigs) {
      for (const [name, rig] of Object.entries(rigs)) {
        const [radius, up, forward] = HELMET[name];
        const bubble = helmet(number(`${name}r`, radius));

        scene.add(bubble);
        helmets.push({ rig, bubble, up: number(`${name}u`, up), forward: number(`${name}f`, forward) });
      }
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const head = new THREE.Vector3();
      const ease = (from, to) => { const u = Math.max(0, Math.min(1, (t - from) / (to - from))); return u * u * (3 - 2 * u); };

      // Zara's left arm comes up toward the Seed, the hand open under it
      const reach = ease(1.7, 2.5) * (1 - ease(6.2, 7.0));

      rigs.zara.rot('LeftArm', Z, reach * number('arm', 1.12));
      rigs.zara.rot('LeftForeArm', Z, reach * number('fore', 0.25) + reach * Math.sin(w * 4) * 0.05);

      // each helmet follows its mentor's head
      for (const { rig, bubble, up, forward } of helmets) {
        rig.holder.updateWorldMatrix(true, true);
        rig.head.getWorldPosition(head);

        const facing = rig.holder.rotation.y;

        bubble.position.set(head.x + Math.sin(facing) * forward, head.y + up, head.z + Math.cos(facing) * forward);
      }

      // the Seed leaves its pod, comes down between the mentors, hangs there, and goes back up before the loop ends
      const out = ease(RIPE - 0.5, RIPE + 1.0) * (1 - ease(6.3, 7.5));
      const size = ease(RIPE - 0.5, RIPE) * (1 - ease(7.0, 7.5));
      const from = { x: PLANT.x + LOW.x, y: LOW.y - 0.22, z: PLANT.z + LOW.z };

      ripe.position.set(from.x + (FLOAT.x - from.x) * out, from.y + (FLOAT.y - from.y) * out + Math.sin(w * 2) * 0.05 * out, from.z + (FLOAT.z - from.z) * out);
      ripe.rotation.y = w * 2;
      ripe.scale.setScalar(0.44 * Math.max(0.001, size));
      glow.position.copy(ripe.position);
      rays.position.copy(ripe.position);
      glow.scale.setScalar(1.2 * size);
      rays.scale.setScalar(1.25 * size * (0.9 + Math.sin(w * 4) * 0.1));
      rays.material.rotation = w;
      rays.material.opacity = 0.7 * size;
      seedLight.position.copy(ripe.position);
      seedLight.intensity = 5 * size;

      // a ring of light where it came out
      const pop = (t - RIPE + 0.3) / 0.9;

      ring.visible = pop > 0 && pop < 1;
      ring.position.set(from.x, from.y, from.z);
      ring.scale.setScalar(0.3 + pop * 1.5);
      ring.material.opacity = 0.8 * (1 - pop);

      // the pods breathe light, each at its own moment, and their Seeds turn
      for (const [i, one] of [...grown.pods, grown.low].entries()) {
        one.glow.material.opacity = 0.4 + 0.16 * Math.sin(w * 2 + i * 1.3);
        one.seed.rotation.y = w * (1 + (i % 2)) + i;
      }

      giant.lights.forEach((dot, i) => { dot.material.emissiveIntensity = 1.1 + 0.6 * Math.sin(w * 2 + i * 0.9); });
      stand.glows.forEach((one, i) => { one.material.opacity = 0.36 + 0.12 * Math.sin(w + i * 1.6); });
      lamps.forEach((one, i) => one.glows.forEach((glow, k) => { glow.material.opacity = 0.4 + 0.2 * Math.sin(w * 2 + i * 1.7 + k * 2.1); }));
      far.suns.forEach((sun, i) => { sun.glow.scale.setScalar(sun.r * 3.7 * (1 + 0.04 * Math.sin(w + i * 2))); });

      // the locals come up to look and duck again, and blink
      for (const { group, lids, y, rise, phase } of peekers) {
        group.position.y = y + rise * (0.5 + 0.5 * Math.sin(w + phase));
        group.rotation.z = Math.sin(w * 2 + phase) * 0.08;

        const blink = Math.abs(((t + phase) % 4) - 2) < 0.08 ? 0.12 : 1;

        for (const eye of lids) eye.scale.y = blink;
      }

      // the probe hangs in the air, its lens down on the Seed, its antenna blinking
      scout.group.position.y = PROBE.y + Math.sin(w) * 0.07;
      scout.group.rotation.z = Math.sin(w + 1) * 0.05;
      scout.head.rotation.x = 0.55 + 0.1 * out;
      scout.glow.material.opacity = 0.42 + Math.sin(w * 4) * 0.1;
      scout.tip.material.emissiveIntensity = Math.sin(w * 4) > 0 ? 2.6 : 0.5;

      for (const effect of effects) effect(t);
    },
  };
}
