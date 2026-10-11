// The mini-games composition of the onboarding: the mentor drives an open sports car flat out along a piece of race
// track. The track is a cut-out, a thick slab of road with its kerbs, grass, cones, a tyre wall, two floodlights and
// a chequered banner, floating on the page like the studio does: no ground beyond it and no sky.
//
// The car does not travel (the camera would have to follow it). The speed is an illusion made of everything else:
// the centre line and the kerbs rush backwards under it, the wheels are a blur, streaks of air and puffs of dust
// trail behind, the car leans and shakes, and the mentor leans into it. All of it is a function of the loop's second
// and completes whole cycles, so the loop is seamless.
//
// One unit is one metre. The car is sized to its driver: `scale` 1 for the three bipeds, who sit in it; larger for
// Dina, who is a quadruped and rides standing in the cockpit with her head in the wind.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const standard = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);

  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;

  return m;
}

const box = (w, h, d, material, x, y, z, radius = 0.06) => part(new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, w / 2.01, h / 2.01, d / 2.01)), material, x, y, z);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');

  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);

  const t = new THREE.CanvasTexture(c);

  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;

  return t;
}

function sequence(seed) {
  let s = seed;

  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// What each mentor drives: the brand's colors, one each.
const PAINT = { zara: 0xdb1b2b, rho: 0x5c55fd, liruf: 0xebb806, dina: 0x05a893 };

/**
 * An open single-seat roadster, nose toward +x. Returns the group, its wheels (to spin), where a seated driver's hips
 * go and where the cockpit's floor is.
 *
 * The cockpit is a real hollow: a floor, two thin doors, the back of the bonnet in front and the tail behind, with
 * nothing across the top. The driver sits in the middle of it and touches none of its walls, so no surface of a
 * character ever runs into a surface of the car (the first version was a solid block the driver was sunk into, and
 * the owner saw the join). The opening is long, so a tail has room behind the seat. `standing` is Dina's car: she is
 * a quadruped and rides standing in the cockpit, like a dog in an open car, so it has no seat, no steering wheel and
 * no windscreen in her way.
 */
function car(color, { standing = false } = {}) {
  const group = new THREE.Group();
  const paint = standard(color, 0.28, { metalness: 0.15 });
  const dark = standard(0x23263f, 0.5);
  const inside = standard(0x2f3352, 0.8);
  const chrome = standard(0xdfe4f2, 0.2, { metalness: 0.6 });
  const WHEEL = 0.3;
  const FLOOR = 0.3; // the top of the cockpit's floor
  const SILL = 0.66; // the top of the doors
  const BACK = -0.98; // where the cockpit's opening ends, toward the tail
  const FRONT = 0.34; // and where it ends toward the nose
  const HALF = 0.6; // half the car's width
  const WALL = 0.09;
  const open = FRONT - BACK;

  group.add(
    // the floor of the car reaches almost to the road, so nothing of the driver shows under it
    box(2.5, FLOOR - 0.04, HALF * 2 - 0.08, dark, 0, (FLOOR + 0.04) / 2, 0, 0.04),
    // the bonnet, falling a little toward the nose, and the short tail
    box(1.27 - FRONT, SILL + 0.06 - 0.22, HALF * 2, paint, (1.27 + FRONT) / 2, (SILL + 0.06 + 0.22) / 2, 0, 0.12),
    box(BACK + 1.27, SILL - 0.22, HALF * 2, paint, (BACK - 1.27) / 2, (SILL + 0.22) / 2, 0, 0.12),
    // the two doors: thin walls, with the cockpit open between them
    box(open + 0.1, SILL - 0.22, WALL, paint, (FRONT + BACK) / 2, (SILL + 0.22) / 2, HALF - WALL / 2, 0.04),
    box(open + 0.1, SILL - 0.22, WALL, paint, (FRONT + BACK) / 2, (SILL + 0.22) / 2, -HALF + WALL / 2, 0.04),
    // the inside of the cockpit: its floor and the dashboard under the windscreen
    box(open, 0.03, HALF * 2 - WALL * 2, inside, (FRONT + BACK) / 2, FLOOR, 0, 0.01),
    box(0.05, SILL - FLOOR, HALF * 2 - WALL * 2, inside, FRONT - 0.03, (SILL + FLOOR) / 2, 0, 0.015),
    // a white stripe along the bonnet and the tail
    box(1.27 - FRONT - 0.06, 0.012, 0.2, standard(0xffffff, 0.4), (1.27 + FRONT) / 2, SILL + 0.063, 0, 0.004),
    box(BACK + 1.27 - 0.06, 0.012, 0.2, standard(0xffffff, 0.4), (BACK - 1.27) / 2, SILL + 0.003, 0, 0.004),
    // bumpers
    box(0.1, 0.12, HALF * 2 + 0.02, chrome, 1.28, 0.34, 0, 0.04),
    box(0.1, 0.12, HALF * 2 + 0.02, chrome, -1.28, 0.34, 0, 0.04),
  );

  if (!standing) {
    // a low seat in the middle, and behind the opening a roll hoop
    group.add(box(0.44, 0.1, 0.56, standard(0x3a3e5c, 0.75), -0.3, FLOOR + 0.06, 0, 0.04));

    const hoop = part(new THREE.TorusGeometry(0.3, 0.03, 10, 24, Math.PI), chrome, BACK - 0.12, SILL - 0.02, 0);

    hoop.rotation.y = Math.PI / 2;
    group.add(hoop);

    // the windscreen: a thin frame and a sheet of glass, leaning back, on the bonnet and clear of the driver
    const screen = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    // low, so the driver's face is above it and never behind its frame
    const pane = part(new THREE.PlaneGeometry(1.0, 0.22), glass, 0, 0.11, 0);

    pane.rotation.y = Math.PI / 2;
    pane.castShadow = false;
    screen.add(pane, box(0.035, 0.25, 0.035, chrome, 0, 0.115, -0.51, 0.012), box(0.035, 0.25, 0.035, chrome, 0, 0.115, 0.51, 0.012), box(0.035, 0.035, 1.05, chrome, 0, 0.235, 0, 0.012));
    screen.position.set(FRONT + 0.16, SILL + 0.06, 0);
    screen.rotation.z = 0.42;
    group.add(screen);

    // the steering wheel on its column, out from the dashboard, well ahead of the driver's chest
    const wheel = part(new THREE.TorusGeometry(0.14, 0.022, 12, 32), dark, FRONT - 0.2, SILL + 0.08, 0);
    const column = part(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 12), dark, FRONT - 0.1, SILL + 0.03, 0);

    wheel.rotation.set(0, Math.PI / 2, 0);
    wheel.rotateX(-0.45);
    column.rotation.z = Math.PI / 2 - 0.45;
    group.add(wheel, column);
  }

  // headlights that shine, tail lights that glow red
  for (const z of [-0.4, 0.4]) {
    group.add(part(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 2.2 }), 1.25, 0.5, z));
    group.add(box(0.05, 0.1, 0.24, new THREE.MeshStandardMaterial({ color: 0xff5a5f, emissive: 0xff2a3a, emissiveIntensity: 1.4 }), -1.28, 0.48, z, 0.02));
  }

  const lamp = new THREE.SpotLight(0xfff0c4, 14, 7, 0.5, 0.8, 1.4);

  lamp.position.set(1.3, 0.55, 0);
  lamp.target.position.set(5, 0, 0);
  group.add(lamp, lamp.target);

  // the wheels: a tyre, and a rim whose spokes are painted already blurred by the speed
  const spokes = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#c9cede';
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2, 0, TAU);
    g.fill();

    for (let i = 0; i < 40; i++) {
      g.strokeStyle = i % 2 ? 'rgba(90,96,128,0.55)' : 'rgba(255,255,255,0.6)';
      g.lineWidth = 9;
      g.beginPath();
      g.arc(w / 2, w / 2, 26 + i * 2.4, i * 0.7, i * 0.7 + 2.2);
      g.stroke();
    }

    g.fillStyle = '#eef0f8';
    g.beginPath();
    g.arc(w / 2, w / 2, 22, 0, TAU);
    g.fill();
  });
  const wheels = [];

  for (const [x, z] of [[0.82, 0.64], [0.82, -0.64], [-0.84, 0.64], [-0.84, -0.64]]) {
    const spin = new THREE.Group();
    const tyre = part(new THREE.CylinderGeometry(WHEEL, WHEEL, 0.24, 40), standard(0x1c1f32, 0.85));
    const rim = part(new THREE.CircleGeometry(WHEEL * 0.68, 40), new THREE.MeshStandardMaterial({ map: spokes, roughness: 0.3, metalness: 0.4 }), 0, 0, Math.sign(z) * 0.123);

    tyre.rotation.x = Math.PI / 2;

    if (z < 0) rim.rotation.y = Math.PI;

    spin.add(tyre, rim);
    spin.position.set(x, WHEEL, z);
    group.add(spin);
    wheels.push(spin);
    // the arch over the wheel
    group.add(part(new THREE.TorusGeometry(WHEEL + 0.07, 0.06, 10, 24, Math.PI), paint, x, WHEEL + 0.02, z * 0.97));
  }

  return { group, wheels, seat: new THREE.Vector3(-0.3, FLOOR + 0.2, 0), floor: new THREE.Vector3((FRONT + BACK) / 2, FLOOR + 0.015, 0) };
}

/** The slab of track, its dressing and its lights. The road runs along x. Returns the textures that scroll. */
function track(length, width) {
  const group = new THREE.Group();
  const THICK = 0.34;
  const road = canvasTexture(1024, 512, (g, w, h) => {
    // grass, the two kerbs in red and white blocks, the asphalt, and the centre line
    g.fillStyle = '#39b98a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d4160';
    g.fillRect(0, h * 0.17, w, h * 0.66);

    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#e5383b';
      g.fillRect(i * (w / 16), h * 0.13, w / 16, h * 0.05);
      g.fillRect(i * (w / 16), h * 0.82, w / 16, h * 0.05);
    }

    g.fillStyle = '#fff6dd';

    for (let i = 0; i < 4; i++) g.fillRect(i * (w / 4) + 20, h * 0.488, w / 4 - 110, h * 0.024);

    // a few darker patches so the asphalt is not flat
    g.fillStyle = 'rgba(20,22,40,0.12)';

    for (let i = 0; i < 26; i++) g.fillRect((i * 97) % w, h * 0.2 + ((i * 53) % (h * 0.58)), 60 + (i % 5) * 22, 5);
  });

  road.wrapS = THREE.RepeatWrapping;
  road.repeat.set(length / 4.6, 1);

  const slab = part(new RoundedBoxGeometry(length, THICK, width, 6, 0.12), [standard(0x8a5a36, 0.9), standard(0x8a5a36, 0.9), new THREE.MeshStandardMaterial({ map: road, roughness: 0.85 }), standard(0x6f4527, 0.9), standard(0x9a6840, 0.9), standard(0x9a6840, 0.9)], 0, -THICK / 2, 0);

  slab.castShadow = false;
  group.add(slab);

  const post = standard(0x3a3e5c, 0.5, { metalness: 0.3 });

  // two floodlights behind the track, their heads turned onto it: real lights
  for (const x of [-length * 0.3, length * 0.26]) {
    const head = new THREE.Group();
    const light = new THREE.SpotLight(0xffe2b0, 30, 9, 0.7, 0.9, 1.3);

    // the lamp's head: a dark housing with a bright face, tipped down onto the track
    head.add(box(0.56, 0.3, 0.14, post, 0, 0, 0, 0.04), part(new THREE.PlaneGeometry(0.48, 0.22), new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffd58a, emissiveIntensity: 2.8 }), 0, 0, 0.073));
    head.position.set(x, 2.2, -width / 2 + 0.2);
    head.rotation.x = 0.45;
    light.position.set(x, 2.2, -width / 2 + 0.3);
    light.target.position.set(x * 0.6, 0, 0.3);
    group.add(part(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 16), post, x, 1.1, -width / 2 + 0.18), part(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 24), post, x, 0.025, -width / 2 + 0.18), head, light, light.target);
  }

  // the chequered banner over the far end of the straight
  const flag = canvasTexture(512, 128, (g, w, h) => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = (x + y) % 2 ? '#ffffff' : '#23263f';
        g.fillRect(x * (w / 16), y * (h / 4), w / 16, h / 4);
      }
    }
  });
  const banner = part(new THREE.PlaneGeometry(width - 0.5, 0.34), new THREE.MeshStandardMaterial({ map: flag, roughness: 0.8, side: THREE.DoubleSide }), -length / 2 + 0.6, 2.25, 0);

  banner.rotation.y = Math.PI / 2;
  group.add(banner, part(new THREE.CylinderGeometry(0.04, 0.05, 2.45, 16), post, -length / 2 + 0.6, 1.22, -width / 2 + 0.22), part(new THREE.CylinderGeometry(0.04, 0.05, 2.45, 16), post, -length / 2 + 0.6, 1.22, width / 2 - 0.22));

  // cones along the near kerb, a wall of tyres at the far corner, two small trees on the grass
  for (const x of [-length * 0.22, length * 0.04, length * 0.3]) {
    const cone = new THREE.Group();

    cone.add(part(new THREE.ConeGeometry(0.11, 0.34, 24), standard(0xeb7301, 0.6), 0, 0.19, 0), part(new THREE.CylinderGeometry(0.085, 0.1, 0.06, 24), standard(0xffffff, 0.6), 0, 0.15, 0), box(0.26, 0.03, 0.26, standard(0xeb7301, 0.6), 0, 0.015, 0, 0.01));
    cone.position.set(x, 0, width / 2 - 0.2);
    group.add(cone);
  }

  for (let i = 0; i < 6; i++) {
    const tyre = part(new THREE.TorusGeometry(0.14, 0.075, 12, 24), standard([0x23263f, 0xdb1b2b, 0xffffff][i % 3], 0.8), length / 2 - 0.5 - (i % 3) * 0.33, 0.075 + Math.floor(i / 3) * 0.15, -width / 2 + 0.3);

    tyre.rotation.x = Math.PI / 2;
    group.add(tyre);
  }

  for (const [x, s] of [[-length * 0.44, 0.8], [length * 0.43, 0.7]]) {
    const tree = new THREE.Group();

    tree.add(part(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 12), standard(0x8a5a36, 0.9), 0, 0.25, 0), part(new THREE.SphereGeometry(0.42, 24, 16), standard(0x05a893, 0.8), 0, 0.82, 0), part(new THREE.SphereGeometry(0.3, 24, 16), standard(0x018675, 0.8), 0.22, 0.62, 0.1));
    tree.position.set(x, 0, -width / 2 + 0.28);
    tree.scale.setScalar(s);
    group.add(tree);
  }

  return { group, road };
}

/**
 * Builds the track and the car in `scene`. Returns `{ seat, update(t) }`: `seat` is the group the driver is put in
 * (its origin is where the driver's hips go) and `update` moves everything for second `t` of the loop.
 */
export function buildTrack(scene, { loop, mentor }) {
  const standing = mentor === 'dina';
  // Zara is slight: her car is a size smaller, so she is not lost in it
  const scale = standing ? 1.36 : mentor === 'zara' ? 0.86 : 1;
  const LENGTH = 3.9 * (standing ? 1.24 : mentor === 'zara' ? 0.9 : 1);
  const WIDTH = 2.8 * (standing ? 1.14 : mentor === 'zara' ? 0.92 : 1);
  const stage = new THREE.Group();
  const { group: slab, road } = track(LENGTH, WIDTH);
  const { group: body, wheels, seat, floor } = car(PAINT[mentor], { standing });
  const ride = new THREE.Group();
  const driver = new THREE.Group();
  const random = sequence(9);
  const updates = [];

  body.scale.setScalar(scale);
  ride.add(body, driver);
  ride.position.set(0.25, 0, 0.3);
  // a seated driver is placed by the hips on the seat; Dina by her feet on the cockpit's floor
  driver.position.copy(standing ? floor : seat).multiplyScalar(scale);
  stage.add(slab, ride);
  // the road runs from the far left toward the reader's right: the car comes out of the picture at an angle
  stage.rotation.y = -0.72;
  scene.add(stage);

  const dot = canvasTexture(64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });
  const streak = canvasTexture(256, 32, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);

    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, h * 0.3, w, h * 0.4);
  });

  // ---- streaks of air rushing past, alongside the car and above it
  // in the brand's indigo, orange and gold, so they show on the light page and on the dark one
  for (let i = 0; i < 26; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.045), new THREE.MeshBasicMaterial({ map: streak, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: [0x8f8aff, 0xffffff, 0xffb347, 0x8f8aff, 0xffd36b][i % 5] }));
    // behind the car at any height, in front of it only low down: never across the driver's face
    const behind = i % 3 !== 0;
    const y = behind ? 0.3 + random() * 1.5 : 0.12 + random() * 0.3;
    const z = behind ? -WIDTH / 2 + 0.2 + random() * (WIDTH / 2 - 0.65) : 1.05 + random() * (WIDTH / 2 - 1.15);
    const len = 0.9 + random() * 1.5;
    const laps = 3 + Math.floor(random() * 3);
    const offset = random();

    line.renderOrder = 6;
    stage.add(line);
    updates.push((t) => {
      const u = (offset + (t / loop) * laps) % 1;

      line.position.set(LENGTH / 2 - u * LENGTH, y, z);
      line.scale.set(len, 1 + (i % 2), 1);
      // fades in ahead of the car and out behind it, so no streak pops in or out
      line.material.opacity = 0.95 * Math.sin(u * Math.PI);
    });
  }

  // ---- dust thrown up by the rear wheels, growing and thinning as it falls behind
  for (let i = 0; i < 22; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xc9b596, transparent: true, depthWrite: false, toneMapped: false }));
    const side = i % 2 ? 0.62 : -0.62;
    const offset = random();
    const drift = (random() - 0.5) * 0.3;
    const rise = 0.25 + random() * 0.4;

    puff.renderOrder = 5;
    ride.add(puff);
    updates.push((t) => {
      const u = (offset + (t / loop) * 6) % 1;

      puff.position.set((-1.0 - u * 2.0) * scale, (0.12 + u * rise) * scale, (side + drift * u) * scale);
      puff.scale.setScalar((0.22 + u * 0.75) * scale);
      puff.material.opacity = 0.8 * (1 - u) * Math.min(1, u * 8);
    });
  }

  return {
    seat: driver,
    standing,
    update(t) {
      const w = (t / loop) * TAU;

      // the road rushes back under the car; the wheels are a blur that still turns
      road.offset.x = -((t / loop) * 14) % 1;

      for (const wheel of wheels) wheel.rotation.z = -w * 23;

      // the car leans back on its springs, rocks a little and shakes with the road
      ride.rotation.z = 0.045 + Math.sin(w * 2) * 0.01;
      ride.rotation.x = Math.sin(w * 3) * 0.012;
      ride.position.y = Math.abs(Math.sin(w * 16)) * 0.008;
      ride.position.z = 0.3 + Math.sin(w) * 0.12;

      for (const update of updates) update(t);
    },
  };
}
