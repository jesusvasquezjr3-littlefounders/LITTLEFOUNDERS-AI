// Home composition "race": the four mentors race small open racing cars flat out toward the reader, each in its own
// lane, just as they come out from under the chequered arch and its confetti goes off.
//
// The setting is an island: a round piece of ground with a race track across it, red and white kerbs, the asphalt
// between them and earth underneath. Behind the cars the arch, an inflated chequered tube (a pattern, never a
// word) with two round floodlights on its shoulders, which are real lights. A few tyres and a cone stand on the
// grass to one side; the road is the cars' room.
//
// The cars do not travel (the camera would have to follow them). The speed is made of everything else: each car
// sits back on its rear wheels and leans its own way, long streaks of colored air leave it and fly back, dust boils
// from its rear wheels, the road and the kerbs rush back under it stretched into lines, and each car gains and
// loses a little ground on the others. No two cars share a lane, so none hides another. Every car is a real hollow
// tub (a floor and a thin wall all round, nothing across the top), so no surface of a mentor runs into a surface of
// a car. The three bipeds sit with their legs folded inside; Rho's and Liruf's arms stay down. Dina, a quadruped,
// rides standing in a larger car with her head in the wind, like a dog in an open car.
import * as THREE from 'three';
import { C, TAU, canvasTexture, confetti, cylinder, decal, drawSeed, halo, lathe, lit, mesh, place, radial, sequence, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const GROUND = { radius: 3.65, z: -0.5 };
const ROAD = { half: 2.78, kerb: 0.2, period: 3.2 };
const ARCH = { z: -1.3, half: 3.35 };
const BURST = 2.0; // the second the arch's confetti goes off

// Where each car runs, its size against the basic one, its color and the color of the air it leaves, how it gains
// and loses ground over the loop, and how it sits: turned a few degrees, tipped back, leaning to one side.
const CARS = {
  liruf: { x: -2.12, z: -0.45, scale: 1, long: 1.35, paint: C.gold, air: 0xffc93c, surge: 0.05, phase: 0.4, yaw: 0.12, pitch: 0.06, roll: 0.03 },
  zara: { x: -0.7, z: 1.6, scale: 0.86, long: 1.35, paint: C.red, air: 0xff6f86, surge: 0.06, phase: 2.2, yaw: 0.1, pitch: 0.075, roll: -0.035 },
  rho: { x: 0.58, z: 0.1, scale: 0.95, long: 1.35, paint: C.indigo, air: 0x8f8aff, surge: 0.06, phase: 4.1, yaw: 0.21, pitch: 0.05, roll: 0.03 },
  dina: { x: 2.2, z: -0.35, scale: 1.12, long: 1.75, paint: C.mint, air: 0x2fd9b4, surge: 0.05, phase: 5.3, yaw: 0.14, pitch: 0.04, roll: -0.025 },
};
const TUB = { floor: 0.22, sill: 0.46 };
// how high above the cockpit's floor each seated mentor's hips are (level with the rim, so the mentor shows from the
// hips up), and how far the thigh and the shin fold
const SEAT = { liruf: 0.28, zara: 0.36, rho: 0.3 };
const FOLD = { liruf: [-1.35, 1.3], zara: [-1.45, 2.25], rho: [-1.35, 1.3] };

// ---- the ground: grass, the kerbs, the asphalt, and earth underneath
function ground() {
  const group = new THREE.Group();
  const R = GROUND.radius;
  const next = sequence(61);
  const picture = canvasTexture([1024, 1024], (g, w, h) => {
    const k = (ROAD.kerb / ((ROAD.half + ROAD.kerb) * 2)) * w;

    g.fillStyle = '#454a6b';
    g.fillRect(0, 0, w, h);

    // the road's own marks, drawn out into lines by the speed: each fades in and out along the road
    const line = (x, y, wide, long, color) => {
      // twice, so a line that runs off one end of the picture comes back in at the other
      for (const from of [y, y - h]) {
        const fade = g.createLinearGradient(0, from, 0, from + long);

        fade.addColorStop(0, `rgba(${color},0)`);
        fade.addColorStop(0.3, `rgba(${color},1)`);
        fade.addColorStop(0.7, `rgba(${color},1)`);
        fade.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = fade;
        g.fillRect(x, from, wide, long);
      }
    };

    for (let i = 0; i < 90; i++) line(k + next() * (w - k * 2 - 8), next() * h, 3 + next() * 5, h * (0.25 + next() * 0.4), i % 2 ? '24,26,50' : '150,158,214');

    // the kerbs: red and white, one of each to a period, their ends smeared
    for (const x of [0, w - k]) {
      g.fillStyle = '#ffffff';
      g.fillRect(x, 0, k, h);
      line(x, h * 0.06, k, h * 0.56, '229,56,59');
    }

    // a solid line inside each kerb, and the lane lines drawn out long
    g.fillStyle = '#fff6dd';
    g.fillRect(k + 12, 0, 8, h);
    g.fillRect(w - k - 20, 0, 8, h);

    [0.27, 0.5, 0.73].forEach((x, i) => line(w * x - 5, h * (0.08 + i * 0.33), 10, h * 0.72, '255,246,221'));
  });
  const full = ROAD.half + ROAD.kerb;
  const reach = R - 0.14;
  const columns = 80;
  const positions = [];
  const uvs = [];
  const index = [];

  picture.wrapT = THREE.RepeatWrapping;

  // the road is a strip cut by the island's round edge: two points to a column, the back one and the front one
  for (let i = 0; i <= columns; i++) {
    const x = -full + (i / columns) * full * 2;
    const z = Math.sqrt(reach * reach - x * x);

    positions.push(x, 0, -z, x, 0, z);
    uvs.push(i / columns, (z - GROUND.z) / ROAD.period, i / columns, (-z - GROUND.z) / ROAD.period);

    if (i < columns) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }

  const strip = new THREE.BufferGeometry();

  strip.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  strip.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  strip.setIndex(index);
  strip.computeVertexNormals();

  const road = mesh(strip, standard(0xffffff, 0.85, { map: picture }), 0, 0.006, 0);
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x3f9a4e, 0.9), standard(0x4db56a, 0.95), standard(C.earth, 0.9)], 0, -0.05, 0);
  const lip = mesh(new THREE.TorusGeometry(R - 0.03, 0.09, 14, 128), standard(0x4aa858, 0.95), 0, -0.05, 0);

  road.castShadow = false;
  top.castShadow = false;
  lip.rotation.x = Math.PI / 2;
  // the camera looks down on this island more than on the others, so its earth is a thick band before it tapers
  group.add(top, lip, road, lathe([[0, -1.1], [1.0, -1.04], [2.3, -0.82], [3.2, -0.42], [R - 0.06, -0.24], [R - 0.03, -0.18], [R - 0.03, -0.08]], standard(C.earth, 0.95)));

  return { group, picture };
}

/** A layer that shows only the shadows that fall on the island, so they stay readable on the road and the grass. */
function shadows() {
  const layer = new THREE.Mesh(new THREE.CircleGeometry(GROUND.radius - 0.1, 96), new THREE.ShadowMaterial({ opacity: 0.32, color: 0x2a1f6e }));

  layer.rotation.x = -Math.PI / 2;
  layer.position.set(0, 0.014, GROUND.z);
  layer.receiveShadow = true;
  layer.material.depthWrite = false;
  layer.renderOrder = 2;

  return layer;
}

const CHEQUER = () => {
  const picture = canvasTexture([64, 64], (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#2b3050';
    g.fillRect(0, 0, s / 2, s / 2);
    g.fillRect(s / 2, s / 2, s / 2, s / 2);
  });

  picture.wrapS = THREE.RepeatWrapping;
  picture.wrapT = THREE.RepeatWrapping;
  picture.magFilter = THREE.NearestFilter;

  return picture;
};

// ---- the arch: an inflated chequered tube on two round feet, a floodlight on each shoulder
function arch() {
  const group = new THREE.Group();
  const a = ARCH.half;
  const picture = CHEQUER();
  const hoop = tube([[-a, 0.1, 0], [-a, 1.1, 0], [-a + 0.16, 1.7, 0], [-a + 0.75, 2.17, 0], [-1.5, 2.37, 0], [0, 2.41, 0], [1.5, 2.37, 0], [a - 0.75, 2.17, 0], [a - 0.16, 1.7, 0], [a, 1.1, 0], [a, 0.1, 0]], 0.2, standard(0xffffff, 0.6, { map: picture }), 160);
  const lamps = [];

  picture.repeat.set(19, 2);
  group.add(hoop);

  for (const side of [-1, 1]) {
    const head = new THREE.Group();
    const light = new THREE.SpotLight(0xffe7bd, 34, 11, 0.62, 0.9, 1.3);
    const glow = halo(0.5, 0xffe2a0, 0.55);

    group.add(lathe([[0, 0], [0.26, 0], [0.285, 0.06], [0.27, 0.2], [0.24, 0.3], [0.22, 0.36], [0, 0.36]], standard(C.red, 0.5), side * a, 0, 0, 40));

    // the lamp: a round red housing with a bright face, turned down onto the cars
    head.add(sphere(0.25, standard(C.red, 0.45), 0, 0, 0, 1), sphere(0.21, lit(0xfff1c8, 2.8), 0, 0, 0.1, 1), glow);
    head.children[0].scale.z = 0.72;
    head.children[1].scale.z = 0.6;
    head.children[1].castShadow = false;
    glow.position.z = 0.3;
    head.position.set(side * (a - 0.95), 2.61, 0.12);
    head.rotation.set(0.5, -side * 0.3, 0);
    light.position.set(side * (a - 0.95), 2.55, 0.3);
    light.target.position.set(side * 1.2, 0.4, 2.6);
    group.add(cylinder(0.05, 0.06, 0.2, standard(C.slate, 0.45, { metalness: 0.3 }), side * (a - 0.95), 2.39, 0.06, 20), head, light, light.target);
    lamps.push({ glow, face: head.children[1] });
  }

  return { group, lamps };
}

// ---- a cone with a round top, and a few tyres piled up
function cone() {
  const group = new THREE.Group();

  group.add(
    lathe([[0, 0], [0.16, 0], [0.17, 0.025], [0.15, 0.05], [0.115, 0.06], [0.05, 0.36], [0.036, 0.4], [0, 0.415]], standard(C.orange, 0.55), 0, 0, 0, 32),
    lathe([[0.096, 0.15], [0.072, 0.262], [0.062, 0.262], [0.086, 0.15]].map(([r, h]) => [r + 0.012, h]), standard(0xffffff, 0.55), 0, 0, 0, 32),
  );

  return group;
}

function tyres() {
  const group = new THREE.Group();
  const colors = [C.indigo, C.red, 0xffffff];

  [[0, 0, 3], [0.03, 0.47, 2]].forEach(([x, z, high], k) => {
    for (let i = 0; i < high; i++) {
      const tyre = mesh(new THREE.TorusGeometry(0.135, 0.09, 14, 32), standard(colors[(i + k) % 3], 0.8), x, 0.09 + i * 0.175, z);

      tyre.rotation.x = Math.PI / 2;
      group.add(tyre);
    }
  });

  return group;
}

// the wheels' hubs: spokes painted already blurred by the speed
const SPOKES = () => canvasTexture([256, 256], (g, w) => {
  g.fillStyle = '#d5d9e8';
  g.beginPath();
  g.arc(w / 2, w / 2, w / 2, 0, TAU);
  g.fill();

  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 ? 'rgba(90,96,128,0.5)' : 'rgba(255,255,255,0.65)';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(w / 2, w / 2, 26 + i * 2.4, i * 0.7, i * 0.7 + 2.2);
    g.stroke();
  }

  g.fillStyle = '#f1f3fa';
  g.beginPath();
  g.arc(w / 2, w / 2, 24, 0, TAU);
  g.fill();
});
// the tread of a tyre that turns too fast to be seen: pale bands drawn out round it
const TREAD = () => {
  const picture = canvasTexture([64, 64], (g, s) => {
    g.fillStyle = '#2e3350';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(150,158,200,0.5)';
    g.fillRect(0, s * 0.2, s, s * 0.09);
    g.fillRect(0, s * 0.62, s, s * 0.14);
  });

  picture.wrapS = THREE.RepeatWrapping;
  picture.wrapT = THREE.RepeatWrapping;

  return picture;
};

/**
 * A small open racing car, nose toward +z, longer than it is wide: a hood that tapers forward to a round nose with a
 * wing under it, two headlights, a low windscreen, a hollow cockpit (a floor and a thin wall all round, nothing
 * across the top), a pod on each side, a round tail with a wing over it, and four wheels that stand outside the
 * body on short axles, the front ones turned a little. A white stripe runs along it and a Seed sits on its nose.
 * `long` is how long the cockpit is (Dina's is longer: she stands in it). Returns the group and its wheels, to spin.
 */
function car(color, spokes, tread, long = 1.35) {
  const group = new THREE.Group();
  const paint = standard(color, 0.3, { metalness: 0.15 });
  const white = standard(0xffffff, 0.4);
  const dark = standard(C.ink, 0.6);
  const WIDE = 0.88;
  const MID = -0.15; // the middle of the cockpit, along the car
  const front = MID + 0.455 * long + 0.04; // where the hood starts
  const back = MID - 0.55 * long + 0.1; // the middle of the tail
  // the cockpit's wall, from under the floor up its outside, over the rim and down its inside to the floor
  const tub = lathe([[0, 0.12], [0.36, 0.12], [0.5, 0.18], [0.55, 0.29], [0.548, 0.38], [0.53, 0.435], [0.5, TUB.sill], [0.47, 0.445], [0.458, 0.39], [0.455, 0.27], [0.42, TUB.floor], [0, TUB.floor]], paint, 0, 0, MID, 72);
  const inside = lathe([[0, TUB.floor + 0.004], [0.42, TUB.floor + 0.004]], standard(0x2f3352, 0.85), 0, 0, MID, 72);
  const rim = mesh(new THREE.TorusGeometry(0.5, 0.024, 12, 96), white, 0, TUB.sill, MID);
  /** A round-nosed solid lying along the car: `r` wide at its foot, `length` long, flattened to `flat` of its width. */
  const bullet = (r, length, flat, material) => {
    const geometry = new THREE.LatheGeometry([[0.0001, 0], [r, 0], [r * 0.98, length * 0.25], [r * 0.86, length * 0.55], [r * 0.62, length * 0.82], [r * 0.32, length * 0.96], [0.0001, length]].map(([x, y]) => new THREE.Vector2(x, y)), 48);

    geometry.scale(1, 1, flat);
    geometry.rotateX(Math.PI / 2);

    return mesh(geometry, material);
  };
  const hood = bullet(0.4, 1.0, 0.44, paint);
  const stripe = bullet(0.1, 0.99, 1.8, white);
  const tail = sphere(0.4, paint, 0, 0.3, back, 0.5);
  const tailStripe = sphere(0.1, white, 0, 0.31, back, 1.95);
  const wheels = [];

  for (const part of [tub, inside]) part.scale.set(WIDE, 1, long);

  rim.rotation.x = Math.PI / 2;
  rim.scale.set(WIDE, long, 1);
  tub.material.side = THREE.DoubleSide;
  inside.castShadow = false;
  hood.position.set(0, 0.3, front);
  stripe.position.set(0, 0.302, front);
  tail.scale.z = 0.85;
  tailStripe.scale.z = 3.4;
  group.add(tub, inside, rim, hood, stripe, tail, tailStripe);

  // the Seed on the nose, on a round white plate that lies on the hood
  const badge = new THREE.Group();

  badge.add(
    cylinder(0.105, 0.105, 0.02, white, 0, 0, 0, 40),
    mesh(new THREE.CircleGeometry(0.092, 40), new THREE.MeshStandardMaterial({ map: canvasTexture([128, 128], (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); drawSeed(g, s / 2, s / 2, s * 0.74, '#ebb806', '#2b3050'); }), roughness: 0.5 }), 0, 0.011, 0),
  );
  badge.children[1].rotation.x = -Math.PI / 2;
  badge.children[1].castShadow = false;
  badge.position.set(0, 0.458, front + 0.56);
  badge.rotation.x = 0.16;
  group.add(badge);

  // a low windscreen: a clear arc on the hood, in front of the cockpit and well clear of whoever is in it
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.37, 0.15, 40, 1, true, -0.95, 1.9), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  const frame = mesh(new THREE.TorusGeometry(0.33, 0.016, 10, 40, 1.9), white, 0, 0.615, front - 0.2);

  screen.position.set(0, 0.54, front - 0.2);
  screen.renderOrder = 7;
  frame.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.95);
  group.add(screen, frame);

  // the wing under the nose, the pods along the sides, and the wing over the tail on its two posts
  const bar = (length, r, material, x, y, z) => {
    const part = mesh(new THREE.CapsuleGeometry(r, length, 8, 20), material, x, y, z);

    part.rotation.z = Math.PI / 2;

    return part;
  };

  group.add(bar(0.86, 0.05, white, 0, 0.11, front + 0.9), bar(0.74, 0.07, paint, 0, 0.5, back - 0.3));

  for (const side of [-1, 1]) {
    const pod = mesh(new THREE.CapsuleGeometry(0.115, 0.5 * long, 10, 24), paint, side * 0.55, 0.23, MID);
    const plate = sphere(0.1, paint, side * 0.48, 0.13, front + 0.9, 1);
    const post = mesh(new THREE.CapsuleGeometry(0.03, 0.1, 6, 12), dark, side * 0.2, 0.44, back - 0.28);

    pod.rotation.x = Math.PI / 2;
    plate.scale.set(0.35, 1, 1.5);
    group.add(pod, plate, post);
    group.add(sphere(0.062, lit(0xfff3cf, 2.4), side * 0.21, 0.4, front + 0.5, 1), sphere(0.045, lit(0xff4a55, 1.5), side * 0.18, 0.34, back - 0.32, 1));
  }

  // the wheels: the rear ones larger, the front ones turned a little into the bend
  for (const [z, x, ring, fat, turn] of [[front + 0.48, 0.5, 0.13, 0.085, 0.2], [back + 0.12, 0.56, 0.16, 0.105, 0]]) {
    const axle = cylinder(0.035, 0.035, x * 2, dark, 0, ring + fat, z, 16);

    axle.rotation.z = Math.PI / 2;
    group.add(axle);

    for (const side of [-1, 1]) {
      const steer = new THREE.Group();
      const spin = new THREE.Group();
      const tyre = mesh(new THREE.TorusGeometry(ring, fat, 16, 40), standard(0xffffff, 0.8, { map: tread }));
      const hub = mesh(new THREE.CircleGeometry(ring * 0.9, 36), new THREE.MeshStandardMaterial({ map: spokes, roughness: 0.3, metalness: 0.3 }), side * fat * 0.7, 0, 0);
      const cap = sphere(0.045, paint, side * fat * 0.8, 0, 0, 1);

      tyre.rotation.y = Math.PI / 2;
      hub.rotation.y = (side * Math.PI) / 2;
      cap.scale.x = 0.5;
      spin.add(tyre, hub, cap);
      steer.add(spin);
      steer.position.set(side * x, ring + fat, z);
      steer.rotation.y = turn;
      group.add(steer);
      wheels.push(spin);
    }
  }

  return { group, wheels, back };
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

export function build(scene, { loop, X, number }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const land = ground();
  const gantry = arch();
  const spokes = SPOKES();
  const tread = TREAD();
  const next = sequence(19);
  const updates = [];

  set.add(place(land.group, 0, GROUND.z), shadows(), place(gantry.group, 0, ARCH.z));
  set.add(place(tyres(), -3.2, 0.42), place(cone(), -3.32, -0.3));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(60,50,170,0.3)'], [0.6, 'rgba(60,50,170,0.15)'], [1, 'rgba(60,50,170,0)']]), 0, -1.2, GROUND.z, 3.9, 3.2, 0));

  // the four cars; `lane` goes with a car along the road but does not lean with it, for the air it leaves
  const cars = Object.fromEntries(Object.entries(CARS).map(([name, at]) => {
    const ride = new THREE.Group();
    const lane = new THREE.Group();
    const built = car(at.paint, spokes, tread, at.long);

    built.group.scale.setScalar(at.scale);
    ride.add(built.group);
    ride.position.set(at.x, 0, at.z);
    lane.position.set(at.x, 0, at.z);
    set.add(ride);
    fx.add(lane);

    return [name, { ...at, ride, lane, wheels: built.wheels, back: built.back }];
  }));

  // ---- the air: long round-ended streaks, bright at the head and thinning to nothing at the tail, in the color of
  // the car they leave (so they show on the light page and on the dark one). They stay low, beside the car and
  // behind it, so none passes a mentor's head.
  const tail = canvasTexture([8, 128], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, 0, h);

    fade.addColorStop(0, '#000');
    fade.addColorStop(0.5, '#fff');
    fade.addColorStop(1, '#fff');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const TILT = 0.02;
  /** One streak in `parent`: it leaves `from`, flies `far` back and fades, `laps` times a loop. */
  const streak = (parent, { x, y, from, far, length, radius, color, laps, offset, strength = 0.95 }) => {
    const line = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 14), new THREE.MeshBasicMaterial({ color, alphaMap: tail, transparent: true, depthWrite: false, toneMapped: false }));

    // the capsule lies along the road, its bright head toward the car, its tail up and back
    line.rotation.x = Math.PI / 2 + TILT;
    line.renderOrder = 6;
    parent.add(line);
    updates.push((t) => {
      const u = (offset + (t / L) * laps) % 1;
      const back = length / 2 + u * far;

      line.position.set(x, y + back * Math.sin(TILT), from - back * Math.cos(TILT));
      line.material.opacity = strength * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7;
    });
  };

  for (const at of Object.values(cars)) {
    const s = at.scale;

    // beside the car, from its front wheels back, and behind it, from its rear wheels and its rim
    for (const side of [-1, 1]) {
      streak(at.lane, { x: side * 0.84 * s, y: 0.12 * s, from: 0.2 * s, far: 1.3, length: 1.7, radius: 0.05, color: at.air, laps: 6, offset: next() });
      streak(at.lane, { x: side * 0.76 * s, y: 0.34 * s, from: (at.back - 0.1) * s, far: 1.1, length: 1.7, radius: 0.058, color: at.air, laps: 5, offset: next() });
      streak(at.lane, { x: side * 0.3 * s, y: 0.24 * s, from: (at.back - 0.5) * s, far: 0.9, length: 1.2, radius: 0.04, color: 0xffffff, laps: 7, offset: next(), strength: 0.75 });
    }
  }

  // ---- dust boiling from the rear wheels: it spreads out to the sides, grows and thins as it falls behind
  for (const at of Object.values(cars)) {
    for (let i = 0; i < 16; i++) {
      const puff = sprite(TEXTURES.dot, i % 3 ? 0xcfb48c : 0xeadbc0, 5);
      const side = i % 2 ? 1 : -1;
      const offset = next();
      const out = 0.1 + next() * 0.4;
      const rise = 0.16 + next() * 0.36;

      at.lane.add(puff);
      updates.push((t) => {
        const u = (offset + (t / L) * 6) % 1;

        puff.position.set(side * (0.6 + out * u) * at.scale, 0.12 + u * rise, (at.back - 0.2 - u * 1.0) * at.scale);
        puff.scale.setScalar((0.24 + u * 0.62) * at.scale);
        puff.material.opacity = (1 - u) * Math.min(1, u * 8);
      });
    }
  }

  const spot = (name, act) => ({ x: CARS[name].x, z: CARS[name].z, yaw: 0, act });
  const cast = {
    // Liruf bounces in his seat as the confetti goes off, his big head thrown back
    liruf: spot('liruf', {
      hop: [[0, 0], [2.1, 0], [2.55, 0.12], [3.0, 0], [3.4, 0.06], [3.8, 0], [L, 0]], lean: [[0, -0.12], [2.55, -0.22], [3.8, -0.1], [L, -0.12]],
      pitch: [[0, -0.08], [2.55, -0.3], [3.8, -0.06], [L, -0.08]], yaw: [[0, 0.3], [2.8, 0.12], [5, 0.38], [L, 0.3]], roll: [[0, -0.1], [2.55, 0.12], [4.4, -0.12], [L, -0.1]],
    }),
    // Zara, in front, waves at the reader as she goes by
    zara: spot('zara', {
      lean: [[0, -0.12], [L, -0.12]], wave: [[0, 0], [1.1, 0], [1.7, 1], [4.3, 1], [5.0, 0], [L, 0]], yaw: [[0, 0.1], [3, -0.06], [6, 0.14], [L, 0.1]],
      roll: [[0, 0.08], [2, -0.1], [4, 0.1], [6, -0.06], [L, 0.08]], pitch: [[0, -0.1], [2, -0.2], [4.6, -0.06], [L, -0.1]], tilt: [[0, 0.03], [2, -0.04], [4, 0.04], [6, -0.03], [L, 0.03]],
    }),
    // Rho is after her: he hunches over the front of his car and never takes his eyes off her
    rho: spot('rho', {
      lean: [[0, 0.16], [2.6, 0.24], [4.4, 0.1], [L, 0.16]], yaw: [[0, -0.1], [2.2, -0.1], [3.0, -0.55], [4.2, -0.55], [5.0, -0.1], [L, -0.1]],
      pitch: [[0, -0.2], [3, -0.12], [5, -0.24], [L, -0.2]], roll: [[0, 0.08], [2, -0.08], [4, 0.1], [6, -0.08], [L, 0.08]], tilt: [[0, -0.03], [2, 0.04], [4, -0.04], [6, 0.03], [L, -0.03]],
    }),
    // Dina stands in her car with her nose up in the wind
    dina: spot('dina', {
      hop: [[0, 0], [2.3, 0], [2.6, 0.05], [2.9, 0], [L, 0]], pitch: [[0, -0.22], [2.6, -0.42], [4, -0.2], [6, -0.3], [L, -0.22]],
      roll: [[0, 0.14], [2, -0.1], [4, 0.16], [6, -0.08], [L, 0.14]], yaw: [[0, -0.3], [3, -0.12], [5.4, -0.36], [L, -0.3]],
    }),
  };
  // each mentor's own room in the picture, which no twinkle enters
  const ROOM = { liruf: [0.55, 1.6], zara: [0.5, 1.4], rho: [0.5, 1.5], dina: [0.6, 2.0] };
  const actors = Object.entries(CARS).map(([name, at]) => ({ x: at.x, z: at.z, y: 0.3, half: ROOM[name][0], top: ROOM[name][1], peak: BURST + 0.6 }));
  const effects = [
    twinkles(fx, { loop, actors, each: 4 }),
    confetti(fx, { at: BURST, x: 0, z: ARCH.z + 1.0, spread: 2.2, count: 130, colors: [0xffd36b, 0x35e0b8, 0xffffff, 0x8f8aff, 0xff7aa8, 0xeb7301] }),
  ];
  const seats = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.65,
    camera: { y: 5.9, dist: 14.7, lookY: 0.84 },
    ready(rigs) {
      const at = new THREE.Vector3();

      for (const [name, rig] of Object.entries(rigs)) {
        const { ride, scale } = cars[name];

        if (name === 'dina') {
          // she stands on the cockpit's floor
          rig.seatIn(ride, { x: 0, y: (TUB.floor + 0.008) * scale, z: number('dz', -0.16), yaw: 0 });
          continue;
        }

        // a seated driver is placed by the hips, level with the rim
        const hips = rig.bones.get('Hips').getWorldPosition(at).y - rig.holder.position.y;

        rig.seatIn(ride, { x: 0, y: (TUB.floor + number(`${name}s`, SEAT[name])) * scale - hips, z: number('sz', -0.27) * scale, yaw: 0 });
        seats.push(rig);
      }
    },
    update(t, rigs) {
      const w = (t / L) * TAU;

      // the road rushes back under the cars, a whole number of times in the loop
      land.picture.offset.y = (t / L) * 20;

      for (const { ride, lane, wheels, z, surge, phase, yaw, pitch, roll } of Object.values(cars)) {
        for (const wheel of wheels) wheel.rotation.x = w * 23;

        // each car gains and loses a little ground, weaves, and shakes with the road; it sits back on its rear wheels
        ride.position.z = z + Math.sin(w + phase) * surge;
        lane.position.z = ride.position.z;
        lane.rotation.y = yaw;
        ride.position.y = 0.02 + Math.abs(Math.sin(w * 16 + phase)) * 0.008;
        ride.rotation.y = yaw + Math.sin(w * 2 + phase) * 0.025;
        ride.rotation.z = roll + Math.sin(w * 2 + phase) * 0.014;
        ride.rotation.x = -pitch + Math.sin(w * 3 + phase) * 0.012;
      }

      // in a seat the legs are folded, out of sight inside the car
      for (const rig of seats) {
        for (const side of ['Left', 'Right']) {
          rig.rot(`${side}UpLeg`, X, FOLD[rig.name][0]);
          rig.rot(`${side}Leg`, X, FOLD[rig.name][1]);
        }
      }

      // the wind lays Dina's ears back and streams her tail out behind her
      rigs.dina.rot('earend', X, 0.7 + Math.sin(w * 12) * 0.1);
      rigs.dina.rot('R_earend', X, 0.7 + Math.sin(w * 12 + 1) * 0.1);

      for (const bone of ['tailstart', 'tail1', 'tail2']) rigs.dina.rot(bone, X, 0.2);

      // the floodlights flare as the confetti goes off
      const flare = Math.max(0, 1 - Math.abs(t - BURST) / 0.6);

      for (const { glow, face } of gantry.lamps) {
        glow.material.opacity = 0.5 + flare * 0.4 + Math.sin(w * 4) * 0.04;
        face.material.emissiveIntensity = 2.8 + flare * 2;
      }

      for (const update of updates) update(t);
      for (const effect of effects) effect(t);
    },
  };
}
