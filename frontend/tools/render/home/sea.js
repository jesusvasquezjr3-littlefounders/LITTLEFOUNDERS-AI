// Home composition "sea": the four mentors at the bottom of the sea, in clear round helmets, as a giant clam opens
// beside them and shows its pearl: a Seed that glows.
//
// The setting is an island: a round piece of sandy sea floor with rock underneath. The clam lies on the left and the
// mentors gather to its right, turned toward it, so nothing touches anybody; they move slowly, held up by the water,
// and Zara floats. Behind the clam two tall plants sway; at the back, higher than everybody's head, the small yellow
// submarine they came in waits with its propeller turning. Low round corals, small tube corals and shells lie along
// the front. Two schools of small fish swim in closed loops (one over the
// plants, one around the submarine), bubbles rise, shafts of light come down, and all of it hangs in a soft cloud of
// blue water that fades to nothing before the frame's borders.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.5, z: -0.5 };
const CLAM = { x: -2.56, z: -0.45, radius: 0.7 };
const SUB = { x: 1.95, y: 2.72, z: -2.5 };
const OPENS = 1.7; // the second the clam is open

// ---- the sea floor: sand with ripples, pebbles, and rock underneath
function floor() {
  const group = new THREE.Group();
  const next = sequence(67);
  const R = FLOOR.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    g.fillStyle = '#f3deb2';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 150;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,244,214,0.5)' : 'rgba(214,178,122,0.3)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // ripples the water has left in the sand
    g.lineCap = 'round';
    g.lineWidth = 7;

    for (let i = 0; i < 46; i++) {
      const x = next() * w;
      const y = next() * w;
      const length = 90 + next() * 170;
      const bend = (next() - 0.5) * 50;

      g.strokeStyle = i % 2 ? 'rgba(205,165,104,0.4)' : 'rgba(255,250,232,0.55)';
      g.beginPath();
      g.moveTo(x - length / 2, y);
      g.quadraticCurveTo(x, y + bend, x + length / 2, y);
      g.stroke();
    }

    for (let i = 0; i < 110; i++) {
      g.fillStyle = ['rgba(255,255,255,0.8)', 'rgba(196,150,98,0.5)', 'rgba(255,170,160,0.6)'][i % 3];
      g.beginPath();
      g.arc(next() * w, next() * w, 3 + next() * 6, 0, TAU);
      g.fill();
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xe6c58e, 0.95), standard(0xffffff, 0.95, { map: picture }), standard(0x3f7da0, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0xecd0a0, 0.95), 0, -0.05, 0);

  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  group.add(top, lip, lathe([[0, -0.95], [0.9, -0.9], [2.1, -0.68], [2.95, -0.36], [R - 0.04, -0.1]], standard(0x4a86a8, 0.95)));

  return group;
}

// ---- the giant clam: two round shells with a beaded edge, a cushion inside, and the Seed it keeps as its pearl
function clam() {
  const group = new THREE.Group();
  const R = CLAM.radius;
  const outside = standard(0xb99af2, 0.6);
  const pearl = standard(0xfff1f5, 0.3, { side: THREE.BackSide });
  const bead = standard(0xd9c6ff, 0.5);
  /** Half a shell, open side up: lilac outside, mother-of-pearl inside, round beads along its edge, a few pale spots. */
  const half = (tall) => {
    const shell = new THREE.Group();
    const bowl = new THREE.SphereGeometry(R, 56, 24, 0, TAU, Math.PI / 2, Math.PI / 2);

    shell.add(mesh(bowl, outside), mesh(bowl, pearl));
    shell.children[1].scale.setScalar(0.97);

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;

      shell.add(sphere(0.088, bead, Math.cos(a) * R * 0.99, 0, Math.sin(a) * R * 0.99, 1 / tall));
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const spot = sphere(0.1, standard(0xe7dbff, 0.6), Math.cos(a) * R * 0.66, -R * 0.74, Math.sin(a) * R * 0.66, 0.5);

      spot.castShadow = false;
      shell.add(spot);
    }

    shell.scale.y = tall;

    return shell;
  };
  const lower = half(0.5);
  const upper = half(0.72);
  const hinge = new THREE.Group();
  const seed = seedMesh(0.56);
  const rays = sprite(TEXTURES.star, 0xffe08a, 5);
  const glow = halo(0.75, 0xffd36b, 0.6);
  const light = new THREE.PointLight(0xffd070, 0, 5, 1.8);

  lower.position.y = R * 0.5 + 0.01;
  // the upper shell turns on a hinge at the back
  hinge.position.set(0, R * 0.5 + 0.03, -R * 0.94);
  upper.rotation.x = Math.PI;
  upper.position.set(0, 0, R * 0.94);
  hinge.add(upper);
  seed.castShadow = false;
  group.add(lower, hinge, sphere(0.52, standard(0xffb9cf, 0.7), 0, 0.3, 0, 0.3), seed, rays, glow, light);

  return { group, hinge, seed, rays, glow, light };
}

/**
 * A tall sea plant: a few stalks of short links, a round leaf on each, so that it bends like one. Returns the group
 * and `sway(w)`.
 */
function weed(height, seed) {
  const group = new THREE.Group();
  const next = sequence(seed);
  const greens = [0x27b08c, 0x1f9a8a, 0x44c79a, 0x2aa37c].map((color) => standard(color, 0.7));
  const links = [];
  const STEP = 0.3;

  for (let i = 0; i < 3; i++) {
    const count = Math.round((height * (0.66 + i * 0.17)) / STEP);
    const phase = next() * TAU;
    let parent = new THREE.Group();

    parent.position.set((i - 1) * 0.3, 0, (next() - 0.5) * 0.3);
    parent.rotation.y = (next() - 0.5) * 0.5;
    group.add(parent);

    for (let k = 0; k < count; k++) {
      const link = new THREE.Group();
      const side = k % 2 ? 1 : -1;
      const leaf = sphere(0.15 * (1 - (k / count) * 0.35), greens[(k + i) % greens.length], side * 0.15, STEP * 0.6, 0, 0.5);

      leaf.scale.z = 0.3;
      leaf.rotation.z = -side * 0.6;
      link.position.y = k ? STEP : 0;
      link.add(mesh(new THREE.CapsuleGeometry(0.035, STEP, 6, 12), greens[i], 0, STEP / 2, 0), leaf);

      if (k === count - 1) link.add(sphere(0.07, greens[(i + 2) % greens.length], 0, STEP + 0.04, 0, 1.2));

      parent.add(link);
      parent = link;
      links.push({ link, k, phase });
    }
  }

  group.add(sphere(0.34, standard(0x4a86a8, 0.95), 0, 0.04, 0, 0.4));

  return {
    group,
    sway(w) {
      for (const { link, k, phase } of links) {
        link.rotation.z = Math.sin(w + phase - k * 0.5) * 0.07;
        link.rotation.x = Math.cos(w + phase - k * 0.4) * 0.03;
      }
    },
  };
}

// ---- the submarine: a round yellow hull, a tower with a periscope, a big porthole, a propeller
function submarine() {
  const group = new THREE.Group();
  const yellow = standard(0xffc21a, 0.35);
  const orange = standard(C.orange, 0.4);
  const dark = standard(C.slate, 0.5, { metalness: 0.3 });
  const hull = mesh(new THREE.CapsuleGeometry(0.44, 0.8, 20, 48), yellow);
  const propeller = new THREE.Group();
  const lamp = sphere(0.1, lit(0xfff3cf, 2.4), -0.84, -0.04, 0, 1);
  const beam = halo(0.42, 0xfff0c0, 0.5);

  // the hull lies along x, its nose toward the clam
  hull.rotation.z = Math.PI / 2;
  group.add(hull, lathe([[0.3, 0], [0.33, 0.04], [0.31, 0.3], [0.26, 0.38], [0, 0.4]], yellow, 0.05, 0.36, 0, 40));

  // an orange band, and a keel for it to rest on
  const band = mesh(new THREE.TorusGeometry(0.445, 0.035, 12, 64), orange, 0.42, 0, 0);

  band.rotation.y = Math.PI / 2;
  group.add(band, sphere(0.3, orange, 0, -0.42, 0, 0.3));
  group.children[group.children.length - 1].scale.x = 2.2;

  // the periscope: up from the tower and round the corner, a lens at its end
  group.add(tube([[0.05, 0.7, 0], [0.05, 0.86, 0], [0.02, 0.93, 0], [-0.1, 0.95, 0]], 0.04, dark, 24), sphere(0.055, lit(0x8fd0ff, 1.8), -0.13, 0.95, 0, 1));

  // the porthole looks at the reader
  const pane = mesh(new THREE.CircleGeometry(0.2, 40), lit(0x9fdcff, 1.5), -0.1, 0.04, 0.438);

  pane.castShadow = false;
  group.add(mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 48), dark, -0.1, 0.04, 0.434), pane);

  // round fins at the stern, and the propeller behind them
  for (const side of [-1, 1]) {
    const fin = sphere(0.24, orange, 0.78, side * 0.3, 0, 1);

    fin.scale.set(0.9, 0.9, 0.16);
    group.add(fin);
  }

  for (let i = 0; i < 3; i++) {
    const blade = sphere(0.15, dark, 0, Math.cos((i / 3) * TAU) * 0.13, Math.sin((i / 3) * TAU) * 0.13, 1);

    blade.scale.set(0.2, 1, 1);
    propeller.add(blade);
  }

  propeller.add(sphere(0.07, orange, 0, 0, 0, 1));
  propeller.position.set(0.98, 0, 0);
  beam.position.set(-0.95, -0.04, 0);
  group.add(cylinder(0.05, 0.05, 0.16, dark, 0.9, 0, 0, 16), propeller, lamp, beam);
  group.children[group.children.length - 4].rotation.z = Math.PI / 2;

  return { group, propeller, beam };
}

/** A small round fish, nose toward +x. */
function fish(color, belly) {
  const group = new THREE.Group();
  const body = sphere(0.085, standard(color, 0.5, { emissive: color, emissiveIntensity: 0.25 }), 0, 0, 0, 0.72);
  const tail = sphere(0.06, standard(belly, 0.5, { emissive: belly, emissiveIntensity: 0.25 }), -0.13, 0, 0, 1);

  body.scale.set(1.45, 0.72, 0.55);
  tail.scale.set(0.7, 1, 0.22);
  group.add(body, tail, sphere(0.014, standard(C.ink, 0.3), 0.075, 0.016, 0.036, 1), sphere(0.014, standard(C.ink, 0.3), 0.075, 0.016, -0.036, 1));

  for (const part of group.children) part.castShadow = false;

  return { group, tail };
}

// ---- a few small tube corals: round-topped tubes with a pale mouth, low enough to lie in front of anybody's feet
function tubes() {
  const group = new THREE.Group();

  for (const [x, z, r, h, color] of [[0, 0, 0.09, 0.2, 0xff8a5c], [0.2, 0.06, 0.07, 0.13, 0xff6fa5], [-0.17, 0.08, 0.065, 0.1, 0xffb347]]) {
    const mouth = mesh(new THREE.TorusGeometry(r * 0.8, r * 0.3, 12, 32), standard(0xfff1cf, 0.6), x, h, z);

    mouth.rotation.x = Math.PI / 2;
    group.add(lathe([[0, 0], [r * 1.1, 0], [r * 0.9, h * 0.2], [r * 0.86, h * 0.8], [r, h], [r * 0.5, h - 0.02], [0, h - 0.04]], standard(color, 0.6), x, 0, z, 32), mouth);
  }

  return group;
}

/** A low round coral with winding grooves. */
function brain(radius, color, groove) {
  const picture = canvasTexture([512, 256], (g, w, h) => {
    const next = sequence(7);

    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = groove;
    g.lineWidth = 9;
    g.lineCap = 'round';

    for (let i = 0; i < 26; i++) {
      const x = next() * w;
      const y = next() * h * 0.6;

      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 30, y - 26, x + 50, y + 26, x + 80, y);
      g.stroke();
    }
  });

  return sphere(radius, standard(0xffffff, 0.8, { map: picture }), 0, radius * 0.3, 0, 0.62);
}

// a bubble: a thin ring with a shine
const BUBBLE = () => canvasTexture([64, 64], (g, s) => {
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 5, 0, TAU);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(s * 0.36, s * 0.34, s * 0.09, 0, TAU);
  g.fill();
});

// ---- the water: a soft blue cloud behind everything, and shafts of light coming down through it
function water(fx) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w * 0.56, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(20,104,178,0.94)');
    deep.addColorStop(0.5, 'rgba(22,132,196,0.84)');
    deep.addColorStop(0.8, 'rgba(60,180,214,0.34)');
    deep.addColorStop(1, 'rgba(110,214,230,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);
    // lighter toward the surface, and only inside the cloud
    g.globalCompositeOperation = 'source-atop';

    const above = g.createRadialGradient(w * 0.42, w * 0.2, 0, w * 0.42, w * 0.2, w * 0.42);

    above.addColorStop(0, 'rgba(150,236,240,0.5)');
    above.addColorStop(1, 'rgba(150,236,240,0)');
    g.fillStyle = above;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);
  const beam = canvasTexture([256, 8], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, w, 0);

    fade.addColorStop(0, 'rgba(214,248,255,0)');
    fade.addColorStop(0.5, 'rgba(214,248,255,1)');
    fade.addColorStop(1, 'rgba(214,248,255,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const ends = radial([[0, '#fff'], [0.55, '#bbb'], [1, '#000']]);
  const rays = [[-2.6, 0.9, 1], [-1.2, 1.3, 0.85], [0.3, 0.8, 0.95], [1.7, 1.2, 0.8], [2.9, 0.7, 0.9]].map(([x, width, opacity], i) => {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(width, 4.3), new THREE.MeshBasicMaterial({ map: beam, alphaMap: ends, transparent: true, depthWrite: false, toneMapped: false, opacity }));

    ray.position.set(x * 0.85, 1.9, -3.4 - i * 0.05);
    ray.rotation.z = -0.3;
    ray.renderOrder = 1;
    fx.add(ray);

    return { ray, opacity, phase: i * 1.9 };
  });

  cloud.position.set(0, 1.62, -8);
  cloud.scale.set(10.6, 6.0, 1);
  group.add(cloud);

  return { group, rays };
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

export function build(scene, { loop, heights, tuck, number, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const shell = clam();
  const sub = submarine();
  const sea = water(fx);
  const weeds = [{ ...weed(2.4, 3), x: -3.1, z: -1.55 }, { ...weed(3.0, 8), x: -3.0, z: -2.2 }];
  const bubble = BUBBLE();
  /** A push off the floor in the water: a slow rise, a long time up, a slow way down. */
  const slow = (at, height) => [[0, 0], [at - 1.5, 0], [at - 1.15, -0.04], [at, height], [at + 1.3, -0.02], [at + 1.6, 0], [L, 0]];

  set.add(place(floor(), 0, FLOOR.z), shadowCatcher(FLOOR.radius - 0.1, 0.008, FLOOR.z, 0.26), sea.group);
  set.add(decal(radial([[0, 'rgba(30,70,150,0.3)'], [0.6, 'rgba(30,70,150,0.15)'], [1, 'rgba(30,70,150,0)']]), 0, -1.1, FLOOR.z, 3.8, 3.1, 0));
  set.add(place(shell.group, CLAM.x, CLAM.z, 0.42), place(sub.group, SUB.x, SUB.z, 0.22, SUB.y), place(tubes(), 2.0, 2.5, 0.4));

  for (const { group, x, z } of weeds) set.add(place(group, x, z));

  // low things along the front: round corals, shells, pebbles
  set.add(
    place(brain(0.26, '#ff8fb0', '#ffd0dc'), -1.5, 2.5, 0.5), place(brain(0.17, '#ffb347', '#ffe0a8'), -1.08, 2.66, 2.0),
    place(brain(0.2, '#8f8aff', '#d5d2ff'), 1.3, 2.62, 1.1),
    sphere(0.1, standard(0xffffff, 0.5), 0.2, 0.05, 2.8, 0.5), sphere(0.07, standard(0xffc7d6, 0.5), 0.48, 0.035, 2.7, 0.5), sphere(0.08, standard(0xbfe9ff, 0.5), -2.5, 0.04, 1.7, 0.5),
  );

  const subLight = new THREE.PointLight(0xfff0c0, 3, 4, 1.8);

  subLight.position.set(SUB.x - 0.9, SUB.y - 0.2, SUB.z + 0.6);
  set.add(subLight);

  // two schools of fish, each on its own closed loop: over the plants, and around the submarine
  const next = sequence(37);
  const schools = [
    { x: -2.5, y: 3.05, z: -1.6, rx: 1.0, ry: 0.22, rz: 0.5, count: 6, laps: 1, colors: [[0xff7a5c, 0xffd36b], [0xffb347, 0xfff1cf]] },
    { x: SUB.x - 0.1, y: SUB.y + 0.06, z: SUB.z, rx: 1.25, ry: 0.5, rz: 0.75, count: 7, laps: -1, colors: [[0x7fd4ff, 0xffffff], [0xff8fc7, 0xffe1ef]] },
  ].map((school) => ({
    ...school,
    members: Array.from({ length: school.count }, (_, i) => {
      const one = fish(...school.colors[i % 2]);

      one.group.scale.setScalar(0.85 + next() * 0.5);
      fx.add(one.group);

      // the school is a loose bunch that takes up a third of its loop
      return { ...one, lead: (i / school.count) * TAU * 0.5 + next() * 0.12, up: (next() - 0.5) * 0.3, out: 0.86 + next() * 0.28, phase: next() * TAU };
    }),
  }));

  const spot = (x, z, yaw, act) => ({ x, z, yaw, act });
  const cast = {
    // Liruf, nearest the clam, pushes off the sand as it opens and hangs in the water, staring
    liruf: spot(-0.95, 0.26, -0.18, {
      hop: slow(2.5, 0.42), tuck: tuck(2.5, 0.7), yaw: [[0, -0.5], [L, -0.5]], pitch: [[0, 0.06], [1.7, 0.02], [2.5, -0.14], [4.2, 0.08], [L, 0.06]],
      lean: [[0, 0.08], [2.5, -0.06], [4.2, 0.14], [6, 0.08], [L, 0.08]], roll: [[0, 0.1], [2.5, -0.12], [5, 0.1], [L, 0.1]], tilt: [[0, -0.03], [2.5, 0.06], [4.4, -0.05], [L, -0.03]],
    }),
    // Zara floats, treading water with her arms out, and turns to tell the reader
    zara: spot(0.22, 0.5, -0.1, {
      still: 1, lift: [[0, 0.66], [2, 0.86], [4, 0.68], [6, 0.82], [L, 0.66]], tilt: [[0, 0.07], [2, -0.06], [4, 0.08], [6, -0.05], [L, 0.07]],
      tuck: [[0, 0.45], [2, 0.75], [4, 0.45], [6, 0.7], [L, 0.45]], yaw: [[0, -0.5], [3.4, -0.5], [4.2, 0.1], [5.6, 0.1], [6.4, -0.5], [L, -0.5]],
      lean: [[0, -0.04], [L, -0.04]], pitch: [[0, -0.02], [2, 0.06], [4.2, -0.12], [5.6, -0.12], [L, -0.02]], roll: [[0, -0.08], [4.2, 0.1], [L, -0.08]],
    }),
    // Rho leans in for a better look, then pushes off in his turn
    rho: spot(1.12, 0.5, -0.22, {
      hop: slow(5.0, 0.3), tuck: tuck(5.0, 0.6), yaw: [[0, -0.5], [L, -0.5]], pitch: [[0, 0], [2.2, 0.14], [3.4, 0.02], [5.0, -0.16], [6.2, 0], [L, 0]],
      lean: [[0, 0.04], [2.2, 0.2], [3.5, 0.08], [5.0, -0.06], [6.4, 0.04], [L, 0.04]], roll: [[0, -0.08], [2.2, 0.1], [4.4, -0.1], [L, -0.08]], tilt: [[0, -0.02], [2.2, -0.08], [3.6, -0.02], [L, -0.02]],
    }),
    // Dina paddles up off the sand with her front legs, nose toward the clam
    dina: spot(2.62, -0.1, -0.38, {
      hop: slow(3.3, 0.24), rear: [[0, 0], [2.2, 0], [3.3, 0.6], [4.6, 0], [L, 0]], yaw: [[0, -0.5], [L, -0.5]],
      pitch: [[0, -0.12], [3.3, -0.3], [4.8, -0.06], [L, -0.12]], roll: [[0, 0.16], [3.3, -0.1], [5.2, 0.16], [L, 0.16]],
    }),
  };
  const peaks = { liruf: 2.5, rho: 5.0, dina: 3.3 };
  // each mentor's own room in the picture, helmet and all and as high as it floats, which no twinkle enters
  const ROOM = { liruf: [0.72, 2.6], zara: [0.5, 2.95], rho: [0.56, 2.45], dina: [0.78, 2.65] };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, y: 0, height: heights[name], half: ROOM[name][0], top: ROOM[name][1], peak: peaks[name] ?? null }));
  const effects = [
    twinkles(fx, { loop, actors, each: 3, colors: [0xffffff, 0xd6f6ff, 0xfff0b8] }),
    // sand lifts where they come back down
    landings(fx, { actors, after: 1.3, color: 0xfff0cf, lasts: 1.1 }),
    // bubbles: from the clam, from behind the submarine, under Zara's feet as she treads, and from the sand
    rising(fx, { loop, at: { x: CLAM.x + 0.1, y: 0.7, z: CLAM.z }, radius: 0.5, height: 3.0, count: 16, color: 0xffffff, size: [0.05, 0.13], seed: 3, texture: bubble, sway: 0.08, spin: false }),
    rising(fx, { loop, at: { x: SUB.x + 1.1, y: SUB.y, z: SUB.z }, radius: 0.16, height: 0.95, count: 9, color: 0xffffff, size: [0.04, 0.09], seed: 9, texture: bubble, sway: 0.05, spin: false }),
    rising(fx, { loop, at: { x: 0.4, y: 0.1, z: -1.5 }, radius: 3.0, height: 3.3, count: 26, color: 0xffffff, size: [0.035, 0.1], seed: 15, texture: bubble, sway: 0.1, depth: 0.5, spin: false }),
    rising(fx, { loop, at: { x: 0.22, y: 0.15, z: 0.5 }, radius: 0.16, height: 0.6, count: 7, color: 0xffffff, size: [0.035, 0.07], seed: 31, texture: bubble, sway: 0.04, spin: false }),
    // specks adrift in the light
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -0.6 }, radius: 3.2, height: 2.8, count: 30, color: [0xd6f6ff, 0xffffff, 0xfff0b8], size: [0.02, 0.05], seed: 22, sway: 0.16, depth: 0.75 }),
  ];
  const helmets = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.45,
    camera: { y: 2.4, dist: 14.8, lookY: 1.4 },
    ready(rigs) {
      for (const [name, rig] of Object.entries(rigs)) {
        const [radius, up, forward] = HELMET[name];
        const one = helmet(number(`${name}r`, radius));

        scene.add(one);
        helmets.push({ rig, bubble: one, up: number(`${name}u`, up), forward: number(`${name}f`, forward) });
      }
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const head = new THREE.Vector3();
      const ease = (from, to) => { const u = Math.max(0, Math.min(1, (t - from) / (to - from))); return u * u * (3 - 2 * u); };

      // Zara treads water: her arms out to her sides, rising and falling, her legs in a slow kick
      const stroke = Math.sin(w * 2);

      rigs.zara.rot('LeftArm', Z, number('arm', 0.34) + stroke * 0.12);
      rigs.zara.rot('RightArm', Z, -number('arm', 0.34) + stroke * 0.12);
      rigs.zara.rot('LeftForeArm', Z, 0.18 - stroke * 0.12);
      rigs.zara.rot('RightForeArm', Z, -0.18 - stroke * 0.12);
      rigs.zara.rot('LeftUpLeg', X, Math.sin(w * 2) * 0.16);
      rigs.zara.rot('RightUpLeg', X, -Math.sin(w * 2) * 0.16);

      // each helmet follows its mentor's head
      for (const { rig, bubble: one, up, forward } of helmets) {
        rig.holder.updateWorldMatrix(true, true);
        rig.head.getWorldPosition(head);

        const facing = rig.holder.rotation.y;

        one.position.set(head.x + Math.sin(facing) * forward, head.y + up, head.z + Math.cos(facing) * forward);
      }

      // the clam opens, holds, and closes again before the loop ends; the Seed rises a little out of it and shines
      const open = ease(OPENS - 0.9, OPENS) * (1 - ease(6.5, 7.6));

      shell.hinge.rotation.x = -(0.1 + open * 1.0) - Math.sin(w * 2) * 0.02 * open;
      shell.seed.position.y = 0.52 + open * 0.3 + Math.sin(w * 2) * 0.03 * open;
      shell.seed.rotation.y = w * 2;
      shell.seed.scale.setScalar(0.56 * (0.62 + 0.38 * open));
      shell.glow.position.copy(shell.seed.position);
      shell.rays.position.copy(shell.seed.position);
      shell.glow.scale.setScalar(1.5 * (0.3 + 0.7 * open));
      shell.glow.material.opacity = 0.6 * open;
      shell.rays.scale.setScalar(1.6 * open * (0.9 + Math.sin(w * 4) * 0.1));
      shell.rays.material.rotation = w;
      shell.rays.material.opacity = 0.75 * open;
      shell.light.position.set(0, 1.0, 0.3);
      shell.light.intensity = 7 * open;

      for (const weedy of weeds) weedy.sway(w);

      // the submarine hangs in the water, its propeller turning over slowly
      sub.group.position.y = SUB.y + Math.sin(w) * 0.06;
      sub.group.rotation.z = Math.sin(w + 1) * 0.025;
      sub.propeller.rotation.x = w * 6;
      sub.beam.material.opacity = 0.45 + Math.sin(w * 2) * 0.08;

      for (const { ray, opacity, phase } of sea.rays) ray.material.opacity = opacity * (0.7 + 0.3 * Math.sin(w + phase));

      // the fish: each follows the loop a little behind the one before it, nose first, tail beating
      for (const { x, y, z, rx, ry, rz, laps, members } of schools) {
        for (const { group, tail, lead, up, out, phase } of members) {
          const a = w * laps + lead;

          group.position.set(x + Math.cos(a) * rx * out, y + Math.sin(a * 2 + phase) * ry * 0.4 + up, z + Math.sin(a) * rz * out);
          group.rotation.y = Math.atan2(-Math.cos(a) * rz * laps, -Math.sin(a) * rx * laps) + Math.PI / 2 + Math.sin(w * 8 + phase) * 0.12;
          tail.rotation.y = Math.sin(w * 16 + phase) * 0.5;
        }
      }

      for (const effect of effects) effect(t);
    },
  };
}
