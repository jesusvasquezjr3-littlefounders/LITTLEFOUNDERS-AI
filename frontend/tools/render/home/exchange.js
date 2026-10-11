// Home composition "exchange": the four mentors on the floor of a stock exchange of Seeds, the moment the bell
// rings and the market opens up.
//
// The setting is an island: a round marble floor with a golden rim. Behind the mentors float three glass screens
// with charts (drawings only, never words or figures: the page carries the words, in three languages), and above
// them a band of light where arrows and Seeds run by. On the left a marble stand holds the golden opening bell; on
// the right a round projector holds a large Seed turning in a beam of light. Nothing stands in the front or the
// middle: that is the mentors' room, so nothing touches anybody.
//
// No money is shown anywhere, only Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, canvasTexture, confetti, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES } from '../home-kit.js';

const FLOOR = { radius: 3.3, z: -0.75 };
const BELL = { x: -2.55, z: -1.0 };
const PAD = { x: 2.62, z: -1.75 };
const RING_AT = 1.75; // the second the bell is struck

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ---- the floor: pale marble tiles around a ring of indigo and a golden rim
function floor() {
  const group = new THREE.Group();
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#d9a41a');
    ring(0.965, '#f6f1e2');
    ring(0.94, '#eceefb');

    // tiles: thin seams from the middle out, and two rings across them
    g.strokeStyle = 'rgba(92,85,253,0.16)';
    g.lineWidth = 4;

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;

      g.beginPath();
      g.moveTo(half + Math.cos(a) * half * 0.44, half + Math.sin(a) * half * 0.44);
      g.lineTo(half + Math.cos(a) * half * 0.94, half + Math.sin(a) * half * 0.94);
      g.stroke();
    }

    for (const r of [0.62, 0.78]) { g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.stroke(); }

    ring(0.44, '#5c55fd');
    ring(0.41, '#f4f1ff');
    ring(0.385, '#6f69ff');
    ring(0.2, '#7d78ff');
  });
  const disc = mesh(new THREE.CylinderGeometry(FLOOR.radius, FLOOR.radius, 0.08, 128), [standard(0xd9a41a, 0.35, { metalness: 0.5 }), standard(0xffffff, 0.42, { map: top }), standard(C.indigoDeep, 0.8)], 0, -0.04, 0);

  disc.castShadow = false;
  group.add(disc, lathe([[0, -0.42], [2.55, -0.42], [3.11, -0.3], [3.26, -0.14], [3.26, -0.08]], standard(C.indigoDeep, 0.7)));

  // small lights set into the rim, around the back half
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const lamp = sphere(0.06, lit(0xfff1c4, 2.2), Math.cos(a) * 3.13, 0.02, Math.sin(a) * 3.13, 0.6);

    lamp.castShadow = false;
    group.add(lamp);
  }

  return group;
}

// ---- a floating screen: a rounded dark glass with a chart that gives its own light
function screen(width, height, draw) {
  const group = new THREE.Group();
  const picture = canvasTexture([1024, Math.round((1024 * height) / width)], (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);

    sky.addColorStop(0, '#22265a');
    sky.addColorStop(1, '#141633');
    g.fillStyle = sky;
    roundRect(g, 0, 0, w, h, 70);
    g.fill();
    g.save();
    g.clip();

    // a faint grid of dots
    g.fillStyle = 'rgba(160,168,255,0.2)';

    for (let x = 64; x < w; x += 64) for (let y = 64; y < h; y += 64) { g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); }

    g.lineCap = 'round';
    g.lineJoin = 'round';
    draw(g, w, h);
    g.restore();

    // the rim of the glass
    g.strokeStyle = 'rgba(160,168,255,0.9)';
    g.lineWidth = 10;
    roundRect(g, 5, 5, w - 10, h - 10, 66);
    g.stroke();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: picture, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  const glow = halo(Math.max(width, height) * 0.8, 0x6f69ff, 0.35);

  glow.position.z = -0.1;
  glow.renderOrder = 1;
  face.renderOrder = 4;
  group.add(glow, face);

  return group;
}

function upArrow(g, x, y, s, color) {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = s * 0.2;
  g.beginPath();
  g.moveTo(x, y - s * 0.5);
  g.lineTo(x + s * 0.46, y + s * 0.02);
  g.lineTo(x - s * 0.46, y + s * 0.02);
  g.closePath();
  g.fill();
  g.stroke();
  g.lineWidth = s * 0.3;
  g.beginPath();
  g.moveTo(x, y + s * 0.02);
  g.lineTo(x, y + s * 0.5);
  g.stroke();
}

// the big screen: candles that climb, a golden line through them and an arrow that points up
function drawCandles(g, w, h) {
  const tops = [0.74, 0.66, 0.7, 0.58, 0.62, 0.5, 0.42, 0.47, 0.36, 0.28, 0.32, 0.2];
  const line = [];

  tops.forEach((top, i) => {
    const x = 100 + i * 62;
    const isDown = i > 0 && top > tops[i - 1];
    const y0 = h * top;
    const y1 = h * (top + 0.09 + (i % 3) * 0.02);

    g.strokeStyle = isDown ? '#ff7aa8' : '#35e0b8';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, y0 - 30);
    g.lineTo(x, y1 + 30);
    g.stroke();
    g.lineWidth = 30;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x, y1);
    g.stroke();
    line.push([x, y0 - 54]);
  });

  g.strokeStyle = '#ffd36b';
  g.lineWidth = 12;
  g.beginPath();
  line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  upArrow(g, w - 130, h * 0.3, 150, '#35e0b8');
}

// the left screen: bars that grow, with a Seed over the tallest
function drawBars(g, w, h) {
  [0.22, 0.3, 0.27, 0.42, 0.52, 0.68].forEach((size, i) => {
    const x = 150 + i * 128;
    const fill = g.createLinearGradient(0, h * (0.86 - size), 0, h * 0.86);

    fill.addColorStop(0, '#7fb4ff');
    fill.addColorStop(1, '#5c55fd');
    g.strokeStyle = fill;
    g.lineWidth = 72;
    g.beginPath();
    g.moveTo(x, h * 0.84);
    g.lineTo(x, h * (0.86 - size));
    g.stroke();
  });
  drawSeed(g, 150 + 5 * 128, h * 0.1, 96);
}

// the right screen: a ring in three parts around a Seed
function drawRing(g, w, h) {
  const r = h * 0.3;

  g.lineWidth = 62;
  [[0.02, 0.4, '#ffd36b'], [0.46, 0.72, '#35e0b8'], [0.78, 0.96, '#7fb4ff']].forEach(([from, to, color]) => {
    g.strokeStyle = color;
    g.beginPath();
    g.arc(w / 2, h / 2, r, from * TAU - Math.PI / 2, to * TAU - Math.PI / 2);
    g.stroke();
  });
  drawSeed(g, w / 2, h / 2, r * 0.9);
}

// ---- the band of light overhead: arrows and Seeds run along it
function ticker() {
  const picture = canvasTexture([2048, 128], (g, w, h) => {
    g.fillStyle = '#191c40';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    for (let i = 0; i < 16; i++) {
      const x = 64 + i * 128;

      if (i % 4 === 1) drawSeed(g, x, h / 2, 70);
      else if (i % 4 === 3) { g.fillStyle = '#8f8aff'; g.beginPath(); g.arc(x, h / 2, 12, 0, TAU); g.fill(); }
      else upArrow(g, x, h / 2, 62, i % 4 === 0 ? '#35e0b8' : '#ffd36b');
    }
  });
  // both ends fade out, so the band has no edge
  const ends = canvasTexture([512, 8], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, w, 0);

    fade.addColorStop(0, '#000');
    fade.addColorStop(0.16, '#fff');
    fade.addColorStop(0.84, '#fff');
    fade.addColorStop(1, '#000');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });

  picture.wrapS = THREE.RepeatWrapping;
  picture.repeat.x = 1;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.24, 128, 1, true, Math.PI - 1.35, 2.7), new THREE.MeshBasicMaterial({ map: picture, alphaMap: ends, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));

  band.position.set(0, 3.0, FLOOR.z);
  band.renderOrder = 4;

  return { band, picture };
}

// ---- the opening bell on its marble stand
function bell() {
  const group = new THREE.Group();
  const gold = standard(0xf2bf2a, 0.25, { metalness: 0.75 });
  const marble = standard(0xf3f1fa, 0.4);
  const swing = new THREE.Group();

  group.add(lathe([[0, 0], [0.36, 0], [0.38, 0.06], [0.27, 0.14], [0.24, 0.82], [0.33, 0.9], [0.36, 0.98], [0, 0.98]], marble));

  // a golden hoop holds the bell
  const hoop = mesh(new THREE.TorusGeometry(0.36, 0.026, 16, 64, Math.PI), gold, 0, 0.98, 0);

  swing.position.set(0, 1.32, 0);
  swing.add(
    lathe([[0, 0], [0.04, 0], [0.08, -0.05], [0.11, -0.16], [0.16, -0.24], [0.17, -0.27], [0, -0.27]].reverse(), gold, 0, 0, 0, 48),
    sphere(0.04, gold, 0, -0.28, 0),
  );
  group.add(hoop, swing, sphere(0.035, gold, 0, 1.33, 0));

  return { group, swing };
}

// ---- the projector: a round pad, a beam of light, and a large Seed turning in it
function projector() {
  const group = new THREE.Group();
  const beamPicture = canvasTexture([8, 256], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, 0, h);

    fade.addColorStop(0, 'rgba(127,180,255,0)');
    fade.addColorStop(1, 'rgba(127,180,255,0.5)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.4, 1.7, 64, 1, true), new THREE.MeshBasicMaterial({ map: beamPicture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const seed = seedMesh(0.62);
  const rings = [0.5, 0.62].map((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 12, 96), lit(i ? 0xffd36b : 0x7fb4ff, 2));

    ring.position.y = 1.08;

    return ring;
  });
  const glow = halo(0.75, 0x9fc4ff, 0.5);
  const light = new THREE.PointLight(0x8fb8ff, 5, 4.5, 1.8);

  beam.position.y = 0.93;
  beam.renderOrder = 5;
  seed.position.y = 1.08;
  seed.castShadow = false;
  glow.position.y = 1.08;
  light.position.y = 1.1;
  group.add(
    cylinder(0.46, 0.5, 0.1, standard(C.slate, 0.45, { metalness: 0.3 }), 0, 0.05, 0),
    mesh(new THREE.TorusGeometry(0.43, 0.03, 12, 96), lit(0x7fb4ff, 2.4), 0, 0.105, 0),
    beam, seed, glow, light, ...rings,
  );
  group.children[1].rotation.x = Math.PI / 2;

  return { group, seed, rings };
}

export function build(scene, { loop, heights, jump, tuck }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;

  set.add(place(floor(), 0, FLOOR.z), shadowCatcher(FLOOR.radius - 0.08, 0.008, FLOOR.z, 0.34));

  // the island's own soft shadow on the page, fading to nothing well inside the frame
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.5, FLOOR.z, 4.15, 4.15, 0));

  // the three screens, in an arc behind the mentors, each floating at its own height
  const screens = [
    { panel: screen(2.05, 1.22, drawCandles), x: 0, y: 2.0, z: -2.75, yaw: 0, phase: 0 },
    { panel: screen(1.3, 0.92, drawBars), x: -1.95, y: 1.72, z: -2.3, yaw: 0.42, phase: 2.1 },
    { panel: screen(1.3, 0.92, drawRing), x: 1.95, y: 1.72, z: -2.3, yaw: -0.42, phase: 4.2 },
  ];

  for (const { panel, x, y, z, yaw } of screens) set.add(place(panel, x, z, yaw, y));

  const { band, picture } = ticker();
  const opening = bell();
  const holo = projector();
  // the screens light the mentors from behind, and the bell has a warm light of its own
  const screenLight = new THREE.PointLight(0x8f8aff, 7, 7, 1.7);
  const bellLight = new THREE.PointLight(0xffd08a, 3, 3.5, 1.8);

  screenLight.position.set(0, 2.0, -2.0);
  bellLight.position.set(BELL.x + 0.2, 1.6, BELL.z + 0.5);
  set.add(band, place(opening.group, BELL.x, BELL.z), place(holo.group, PAD.x, PAD.z), screenLight, bellLight);

  const cast = {
    // Liruf watches the bell, then jumps the highest of all
    liruf: { x: -1.62, z: -0.05, yaw: 0.3, act: {
      hop: jump(1.9, 0.3), tuck: tuck(1.9, 0.9), lean: [[0, 0.04], [1.9, -0.12], [2.5, 0.1], [3.1, 0.04], [L, 0.04]],
      yaw: [[0, -0.5], [1.2, -0.5], [1.9, 0], [4.6, 0], [6, -0.5], [L, -0.5]], pitch: [[0, -0.12], [1.9, -0.32], [2.5, 0], [L, -0.12]],
      roll: [[0, -0.14], [1.9, 0.14], [3.6, -0.14], [L, -0.14]], tilt: [[0, 0], [1.9, -0.1], [2.7, 0], [L, 0]],
    } },
    // Zara throws both arms up, then waves at the reader
    zara: { x: -0.62, z: 0.4, yaw: 0.1, act: {
      hop: jump(2.0, 0.2), tuck: tuck(2.0, 0.6), cheer: [[0, 0], [1.6, 0], [2.0, 1], [2.9, 1], [3.5, 0], [L, 0]], wave: [[0, 0], [3.6, 0], [4.2, 1], [6.2, 1], [6.9, 0], [L, 0]],
      lean: [[0, 0], [2.0, -0.14], [2.8, 0], [L, 0]], roll: [[0, 0.08], [2.0, -0.08], [4.2, 0.14], [6.2, 0.14], [L, 0.08]], pitch: [[0, -0.08], [2.0, -0.25], [2.8, -0.08], [L, -0.08]],
    } },
    // Rho jumps a beat later and lands in a nod
    rho: { x: 0.4, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.15, 0.17), tuck: tuck(2.15, 0.7), lean: [[0, -0.03], [2.15, -0.16], [2.6, 0.08], [3.3, -0.03], [L, -0.03]],
      pitch: [[0, -0.1], [2.15, -0.3], [2.6, 0.14], [3.3, -0.1], [L, -0.1]], roll: [[0, 0.1], [2.15, -0.12], [4, 0.1], [L, 0.1]], tilt: [[0, 0], [2.15, 0.08], [3, 0], [L, 0]],
    } },
    // Dina looks at the Seed turning beside her and rears up
    dina: { x: 1.62, z: 0.0, yaw: -0.5, act: {
      hop: jump(2.3, 0.12), rear: [[0, 0], [1.85, 0], [2.3, 1], [2.9, 0], [L, 0]], pitch: [[0, -0.16], [2.3, -0.4], [3, -0.16], [L, -0.16]],
      roll: [[0, 0.2], [2.3, -0.1], [4, 0.2], [L, 0.2]], yaw: [[0, 0.4], [1.4, 0.4], [2.3, 0.05], [4.8, 0.05], [6.2, 0.4], [L, 0.4]],
    } },
  };
  const actors = Object.entries(cast).map(([name, spot]) => ({ x: spot.x, z: spot.z, height: heights[name], peak: { liruf: 1.9, zara: 2.0, rho: 2.15, dina: 2.3 }[name] }));

  // arrows that rise in front of the screens
  const arrow = canvasTexture([96, 96], (g, s) => { g.lineCap = 'round'; g.lineJoin = 'round'; upArrow(g, s / 2, s / 2, s * 0.62, '#35e0b8'); });
  // rings of sound leaving the bell when it is struck
  const sound = [0, 0.22, 0.44].map((delay) => {
    const ring = sprite(TEXTURES.ring, 0xffe6a3, 7);

    ring.position.set(BELL.x, 1.18, BELL.z + 0.1);
    fx.add(ring);

    return { ring, delay };
  });
  const effects = [
    sparkles(fx, { loop, actors }),
    landings(fx, { actors }),
    confetti(fx, { at: 2.05, x: 0, z: -0.7, spread: 3.2, count: 110, colors: [0xffd36b, 0x35e0b8, 0xffffff, 0x8f8aff, 0xff7aa8, 0xebb806] }),
    rising(fx, { loop, at: { x: 0, y: 1.25, z: -2.45 }, radius: 2.3, height: 1.7, count: 11, color: 0xffffff, size: [0.1, 0.17], texture: arrow, sway: 0.02, depth: 0.12, seed: 9, spin: false }),
    rising(fx, { loop, at: { x: PAD.x, y: 0.2, z: PAD.z }, radius: 0.36, height: 1.7, count: 22, color: [0x9fc4ff, 0xffffff, 0xffd36b], size: [0.02, 0.05], seed: 4 }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.05,
    camera: { y: 2.2, dist: 13.1, lookY: 1.22 },
    update(t) {
      const w = (t / loop) * TAU;
      const since = t - RING_AT;

      for (const { panel, y, phase } of screens) panel.position.y = y + Math.sin(w + phase) * 0.04;

      // the band runs by exactly once per loop
      picture.offset.x = t / loop;

      // the bell: struck once, it swings wide and settles
      opening.swing.rotation.z = since > 0 && since < 3 ? Math.sin(since * 9) * 0.55 * Math.exp(-since * 1.3) : 0;

      for (const { ring, delay } of sound) {
        const u = (since - delay) / 0.9;

        ring.visible = u > 0 && u < 1;
        ring.scale.setScalar(0.3 + u * 1.5);
        ring.material.opacity = 0.8 * (1 - u);
      }

      holo.seed.rotation.y = w * 2;
      holo.seed.position.y = 1.08 + Math.sin(w * 2) * 0.05;
      holo.rings[0].rotation.set(Math.PI / 2 + 0.35, w, 0);
      holo.rings[1].rotation.set(Math.PI / 2 - 0.3, -w, 0.4);

      for (const effect of effects) effect(t);
    },
  };
}
