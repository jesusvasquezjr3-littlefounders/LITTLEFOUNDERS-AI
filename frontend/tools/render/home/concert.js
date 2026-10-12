// Home composition "concert": the four mentors are the band, on a round stage, the moment the song reaches its
// chorus: Zara sings into the microphone with one hand out to the audience, and Liruf, Rho and Dina dance.
//
// The setting is an island: a round stage of pale boards with footlights around its rim. Over its back floats a
// curved truss with five colored spotlights (real lights, with soft beams that sweep and pools of color on the
// boards) and two big round speakers hanging from it. The instruments stand near the mentors, never in their hands:
// a keyboard on its stand on the left, a drum kit on the right beside Dina, the microphone on its stand in front of
// Zara. Notes (drawn shapes, never letters) rise from the instruments in rhythm, rings of sound leave the speakers
// and confetti falls at the chorus. Far behind, a soft cloud of stage haze lets the beams show on the light page
// too, and fades to nothing before the frame's borders.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, confetti, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const STAGE = { radius: 3.3, z: -0.6 };
const TRUSS = { radius: 2.95, y: 3.36, reach: 1.12, drop: 0.36 }; // an arc around the stage's middle, `reach` radians to each side, its ends `drop` lower
const KEYS = { x: -2.84, z: -0.35, yaw: 1.05, scale: 0.9 };
const DRUMS = { x: 2.68, z: -1.25, yaw: -0.35, scale: 0.8 };
const MIC = { x: -1.24, z: 0.72, height: 1.24 };
const CHORUS = 2.1; // the second the chorus starts
const BEAT = 0.5; // seconds: sixteen beats in the loop
const SPOTS = [{ a: -0.92, color: 0xff4f93 }, { a: -0.5, color: 0xffb21f }, { a: 0, color: 0x4b94ff }, { a: 0.5, color: 0x12c9ae }, { a: 0.92, color: 0x9a6bff }];
const SPEAKERS = [-0.25, 0.25];

/** A point of the truss: `a` radians around the stage's middle from straight behind, at height `y`. */
const onTruss = (a, lift = 0) => [Math.sin(a) * TRUSS.radius, TRUSS.y + lift - TRUSS.drop * (a / TRUSS.reach) ** 2, STAGE.z - Math.cos(a) * TRUSS.radius];
/** How hard the beat hits at second `t`: 1 on the beat, falling away after it. */
const hit = (t, every = BEAT) => Math.exp(-5 * ((t % every) / every));

// ---- the stage: pale boards, a painted ring, footlights around the rim
function stage() {
  const group = new THREE.Group();
  const R = STAGE.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;

    g.fillStyle = '#f3d3a4';
    g.fillRect(0, 0, w, w);

    // boards from the back of the stage to its front, each a shade of its own, with thin seams
    for (let i = 0; i < 26; i++) {
      g.fillStyle = ['rgba(255,236,200,0.5)', 'rgba(226,170,110,0.22)', 'rgba(255,255,255,0.18)', 'rgba(214,150,96,0.16)'][(i * 7) % 4];
      g.fillRect(0, (i / 26) * w, w, w / 26);
      g.fillStyle = 'rgba(150,92,48,0.28)';
      g.fillRect(0, (i / 26) * w - 1.5, w, 3);
    }

    // a painted ring where the band stands, and a darker band at the rim
    g.lineWidth = 26;
    g.strokeStyle = 'rgba(92,85,253,0.85)';
    g.beginPath();
    g.arc(half, half, half * 0.5, 0, TAU);
    g.stroke();
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(255,111,165,0.9)';
    g.beginPath();
    g.arc(half, half, half * 0.455, 0, TAU);
    g.stroke();
    g.lineWidth = half * 0.09;
    g.strokeStyle = '#4438cf';
    g.beginPath();
    g.arc(half, half, half * 0.965, 0, TAU);
    g.stroke();
  });
  const disc = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(C.indigoDeep, 0.6), standard(0xffffff, 0.5, { map: picture }), standard(C.indigoDeep, 0.8)], 0, -0.05, 0);
  const glowRing = mesh(new THREE.TorusGeometry(R + 0.005, 0.03, 12, 128), lit(0xff6fa5, 2), 0, -0.15, 0);
  // a second ring of light under the stage, so its underside reads on the dark page too
  const underRing = mesh(new THREE.TorusGeometry(3.02, 0.035, 12, 128), lit(0x7fb4ff, 2.2), 0, -0.275, 0);
  const lamps = [lit(0xffe6a3, 2), lit(0xff8fb8, 2), lit(0x8fc4ff, 2)];

  disc.castShadow = false;
  glowRing.rotation.x = Math.PI / 2;
  glowRing.castShadow = false;
  underRing.rotation.x = Math.PI / 2;
  underRing.castShadow = false;
  group.add(disc, lathe([[0, -0.34], [2.4, -0.33], [2.98, -0.28], [3.2, -0.21], [R, -0.14], [R, -0.08]], standard(C.indigo, 0.6)), glowRing, underRing);

  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    const lamp = sphere(0.062, lamps[i % 3], Math.cos(a) * (R - 0.15), 0.02, Math.sin(a) * (R - 0.15), 0.6);

    lamp.castShadow = false;
    group.add(lamp);
  }

  return { group, lamps, glowRing, underRing };
}

// ---- the truss: two round chords joined by round rungs, floating over the back of the stage
function truss() {
  const group = new THREE.Group();
  const metal = standard(0xd6d9f0, 0.35, { metalness: 0.45 });
  const joint = standard(C.indigo, 0.4);
  const steps = 26;
  const arc = (lift) => Array.from({ length: steps + 1 }, (_, i) => onTruss(-TRUSS.reach + (i / steps) * TRUSS.reach * 2, lift));

  group.add(tube(arc(0), 0.032, metal, 96), tube(arc(0.2), 0.032, metal, 96));

  for (let i = 0; i <= 14; i++) {
    const a = -TRUSS.reach + (i / 14) * TRUSS.reach * 2;
    const [x, y, z] = onTruss(a);

    group.add(cylinder(0.018, 0.018, 0.2, metal, x, y + 0.1, z, 10));

    if (i === 0 || i === 14) group.add(sphere(0.06, joint, x, y, z), sphere(0.06, joint, x, y + 0.2, z));
  }

  return group;
}

/** The light a beam is made of: brightest along its middle and at the lamp, nothing at its edge and at its far end. */
function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tint: { value: new THREE.Vector3(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255) }, power: { value: 1 } },
    vertexShader: 'varying vec3 vNormal; varying vec3 vView; varying vec2 vUv; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); vUv = uv; gl_Position = projectionMatrix * p; }',
    fragmentShader: 'uniform vec3 tint; uniform float power; varying vec3 vNormal; varying vec3 vView; varying vec2 vUv; void main() { float middle = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.7); gl_FragColor = vec4(tint, middle * pow(vUv.y, 1.25) * 0.6 * power); }',
  });
}

// ---- a spotlight: a round can on a yoke under the truss, its lens, its beam
function spot(color) {
  const group = new THREE.Group();
  const head = new THREE.Group();
  const shell = standard(C.slate, 0.4, { metalness: 0.3 });
  const lens = sphere(0.105, lit(color, 2.6), 0, -0.31, 0, 0.35);
  const length = 2.3;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.66, length, 48, 1, true), beamMaterial(color));
  const glow = halo(0.3, color, 0.7);

  lens.castShadow = false;
  beam.position.y = -0.3 - length / 2;
  beam.renderOrder = 5;
  glow.position.y = -0.32;
  head.add(lathe([[0, -0.3], [0.12, -0.3], [0.14, -0.26], [0.13, -0.1], [0.08, -0.02], [0, 0]], shell, 0, 0, 0, 32), mesh(new THREE.TorusGeometry(0.128, 0.018, 10, 32), standard(0xd6d9f0, 0.35, { metalness: 0.45 }), 0, -0.29, 0), lens, beam, glow);
  head.children[1].rotation.x = Math.PI / 2;
  head.position.y = -0.1;
  group.add(cylinder(0.02, 0.02, 0.12, shell, 0, -0.05, 0, 10), sphere(0.045, shell, 0, -0.1, 0), head);

  return { group, head, beam, lens, glow };
}

// ---- a big round speaker hanging from the truss by two rods: a white drum, a dark cone, a ring of light
function speaker(color) {
  const group = new THREE.Group();
  const face = new THREE.Group();
  const white = standard(0xf7f5ff, 0.4);
  const ring = mesh(new THREE.TorusGeometry(0.33, 0.028, 12, 64), lit(color, 2));
  const cone = sphere(0.3, standard(C.slate, 0.7), 0, 0, -0.05, 1);
  const cap = sphere(0.11, standard(0x4a4f78, 0.4), 0, 0, 0.03, 1);
  const drum = lathe([[0, 0], [0.38, 0], [0.44, 0.07], [0.44, 0.31], [0.38, 0.38], [0, 0.38]], white, 0, 0, 0, 64);

  // the drum lies on its side, its face toward the reader
  drum.rotation.x = Math.PI / 2;
  drum.position.z = -0.38;
  cone.scale.z = 0.3;
  cap.scale.z = 0.5;
  ring.castShadow = false;
  face.add(ring, cone, cap);
  face.position.z = 0.012;
  group.add(drum, face);

  for (const side of [-1, 1]) group.add(cylinder(0.016, 0.016, 0.42, standard(0xd6d9f0, 0.35, { metalness: 0.45 }), side * 0.2, 0.58, -0.19, 10));

  return { group, ring, cone, cap };
}

// ---- the keyboard on its stand: a round foot, a column, a red board with keys and three small lights
function keyboard() {
  const group = new THREE.Group();
  const board = new THREE.Group();
  const metal = standard(0xd6d9f0, 0.35, { metalness: 0.45 });
  const keys = canvasTexture([1024, 200], (g, w, h) => {
    g.fillStyle = '#2b3050';
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 21; i++) {
      g.fillStyle = '#fffaf0';
      g.beginPath();
      g.roundRect(6 + i * 48.4, 6, 42, h - 12, 12);
      g.fill();
    }

    // the dark keys, in twos and threes
    for (let i = 0; i < 20; i++) {
      if ([2, 6].includes(i % 7)) continue;

      g.fillStyle = '#2b3050';
      g.beginPath();
      g.roundRect(38 + i * 48.4, 0, 28, h * 0.58, 10);
      g.fill();
    }
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.215), standard(0xffffff, 0.4, { map: keys }));
  const lights = [0x35e0b8, 0xffd36b, 0xff7aa8].map((color, i) => {
    const light = sphere(0.028, lit(color, 2), -0.4 + i * 0.1, 0.05, -0.115, 0.7);

    light.castShadow = false;

    return light;
  });

  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 0.0465, 0.045);
  board.add(box(1.22, 0.09, 0.38, standard(0xe8334a, 0.4), 0, 0, 0, 0.045), top, ...lights, box(0.3, 0.012, 0.05, standard(C.slate, 0.4), 0.3, 0.046, -0.115, 0.006));
  board.position.y = 0.96;
  board.rotation.x = 0.3;
  group.add(
    lathe([[0, 0], [0.3, 0], [0.32, 0.04], [0.2, 0.09], [0.05, 0.14], [0, 0.14]], metal, 0, 0, 0, 40),
    cylinder(0.035, 0.035, 0.78, metal, 0, 0.5, 0, 16),
    box(0.8, 0.05, 0.2, metal, 0, 0.88, 0, 0.025),
    board,
  );
  group.children[2].rotation.x = 0.3;

  return { group, lights };
}

// ---- the drum kit: a bass drum with a Seed on its skin, two toms on it, a floor tom, a snare, two cymbals, a stool
function drums() {
  const group = new THREE.Group();
  const shell = standard(C.sky, 0.35);
  const skin = standard(0xfff6e6, 0.7);
  const gold = standard(0xf2bf2a, 0.25, { metalness: 0.75 });
  const metal = standard(0xd6d9f0, 0.35, { metalness: 0.45 });
  const front = canvasTexture([256, 256], (g, s) => {
    g.fillStyle = '#fff6e6';
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2, 0, TAU);
    g.fill();
    g.strokeStyle = '#ff9fc0';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.4, 0, TAU);
    g.stroke();
    drawSeed(g, s / 2, s / 2, s * 0.5, '#5c55fd', '#fff6e6');
  });
  /** A drum standing upright: its shell, a skin on top, two golden hoops. */
  const drum = (radius, height) => {
    const one = new THREE.Group();

    one.add(cylinder(radius, radius, height, shell, 0, 0, 0, 40), cylinder(radius * 0.96, radius * 0.96, 0.012, skin, 0, height / 2 + 0.004, 0, 40));

    for (const side of [-1, 1]) {
      const hoop = mesh(new THREE.TorusGeometry(radius, 0.014, 10, 40), gold, 0, side * height / 2, 0);

      hoop.rotation.x = Math.PI / 2;
      one.add(hoop);
    }

    return one;
  };
  const stand = (x, z, height) => {
    group.add(cylinder(0.014, 0.014, height, metal, x, height / 2, z, 10), lathe([[0, 0], [0.11, 0], [0.12, 0.02], [0.03, 0.05], [0, 0.05]], metal, x, 0, z, 24));
  };
  const cymbal = (radius, x, y, z, lean) => {
    const plate = sphere(radius, gold, x, y, z, 0.07);

    plate.rotation.set(lean, 0, lean * 0.6);
    group.add(plate, sphere(0.022, metal, x, y + 0.03, z));

    return plate;
  };

  // the bass drum lies on its side and looks at the reader
  const bass = drum(0.32, 0.36);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.3, 48), new THREE.MeshStandardMaterial({ map: front, roughness: 0.7 }));

  bass.rotation.x = Math.PI / 2;
  bass.position.set(0, 0.34, 0);
  head.position.set(0, 0.34, 0.19);
  group.add(bass, head);

  for (const side of [-1, 1]) group.add(sphere(0.045, metal, side * 0.22, 0.04, 0.12, 0.8));

  // two toms over it, leaning toward the stool
  for (const [x, radius] of [[-0.2, 0.14], [0.2, 0.16]]) {
    const tom = drum(radius, 0.17);

    tom.position.set(x, 0.84, -0.02);
    tom.rotation.x = 0.3;
    group.add(tom, cylinder(0.014, 0.014, 0.14, metal, x * 0.7, 0.7, -0.02, 10));
  }

  const floorTom = drum(0.2, 0.3);
  const snare = drum(0.17, 0.11);

  floorTom.position.set(0.5, 0.47, -0.22);
  snare.position.set(-0.48, 0.62, -0.2);
  group.add(floorTom, snare);
  stand(0.5, -0.22, 0.32);
  stand(-0.48, -0.2, 0.56);
  stand(0.45, -0.62, 1.3);
  stand(-0.45, -0.62, 1.22);

  const plates = [cymbal(0.25, 0.45, 1.32, -0.62, 0.2), cymbal(0.22, -0.45, 1.24, -0.62, -0.18)];

  // the stool
  group.add(lathe([[0, 0], [0.16, 0], [0.17, 0.03], [0.04, 0.07], [0.03, 0.42], [0.17, 0.46], [0.19, 0.52], [0.15, 0.57], [0, 0.57]], standard(C.pink, 0.6), 0, 0, -0.62, 32));

  return { group, plates, head };
}

// ---- the microphone on its stand
function microphone() {
  const group = new THREE.Group();
  const metal = standard(0xd6d9f0, 0.35, { metalness: 0.45 });
  const top = new THREE.Group();

  top.add(cylinder(0.02, 0.016, 0.15, standard(C.slate, 0.4), 0, 0.02, 0, 12), sphere(0.048, standard(0xf2bf2a, 0.3, { metalness: 0.6 }), 0, 0.13, 0), mesh(new THREE.TorusGeometry(0.047, 0.008, 8, 24), standard(C.indigo, 0.4), 0, 0.105, 0));
  top.children[2].rotation.x = Math.PI / 2;
  top.position.y = MIC.height - 0.1;
  // the microphone leans toward Zara, who stands to its right and a step back
  top.rotation.set(-0.35, 0, -0.45);
  group.add(lathe([[0, 0], [0.16, 0], [0.17, 0.025], [0.05, 0.06], [0, 0.06]], metal, 0, 0, 0, 32), cylinder(0.011, 0.013, MIC.height - 0.12, metal, 0, (MIC.height - 0.12) / 2 + 0.03, 0, 10), sphere(0.024, metal, 0, MIC.height - 0.09, 0), top);

  return group;
}

/** A drawn note, white on nothing, to be tinted: one with a flag, or two joined by a bar. */
function note(joined) {
  return canvasTexture([128, 128], (g, s) => {
    const headAt = (x, y) => { g.save(); g.translate(x, y); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, TAU); g.fill(); g.restore(); };

    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    if (joined) {
      headAt(34, 98);
      headAt(88, 88);
      g.beginPath();
      g.moveTo(48, 96);
      g.lineTo(48, 34);
      g.lineTo(102, 24);
      g.lineTo(102, 86);
      g.stroke();
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(48, 40);
      g.lineTo(102, 30);
      g.stroke();
    } else {
      headAt(50, 98);
      g.beginPath();
      g.moveTo(64, 96);
      g.lineTo(64, 26);
      g.stroke();
      g.beginPath();
      g.moveTo(64, 26);
      g.bezierCurveTo(70, 46, 98, 46, 90, 72);
      g.stroke();
    }
  });
}

// ---- far behind: the cloud of stage haze
function haze() {
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(40,28,120,0.95)');
    deep.addColorStop(0.5, 'rgba(52,34,146,0.84)');
    deep.addColorStop(0.8, 'rgba(88,56,190,0.3)');
    deep.addColorStop(1, 'rgba(88,56,190,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    for (const [x, y, r, color, alpha] of [[0.3, 0.5, 0.3, '255,79,147', 0.3], [0.7, 0.5, 0.3, '75,148,255', 0.3], [0.5, 0.62, 0.24, '154,107,255', 0.3]]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},${alpha})`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);

  cloud.position.set(0, 1.8, -8);
  cloud.scale.set(10.6, 6.3, 1);

  return cloud;
}

export function build(scene, { loop, heights, curve, X, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const floor = stage();
  const kit = drums();
  const piano = keyboard();
  /** A curve from a function of the second, for moves that repeat on the beat. The function must repeat every loop. */
  const sample = (f) => Array.from({ length: 161 }, (_, i) => [(i / 160) * L, f((i / 160) * L)]);
  const bump = (t, at, width) => Math.exp(-(((t - at) / width) ** 2));
  const bounce = (t, every, offset = 0) => Math.abs(Math.sin((Math.PI * (t - offset)) / every));

  set.add(place(floor.group, 0, STAGE.z), shadowCatcher(STAGE.radius - 0.24, 0.008, STAGE.z, 0.32));

  // the island's own soft shadow on the page, fading to nothing well inside the frame
  set.add(decal(radial([[0, 'rgba(60,50,170,0.3)'], [0.6, 'rgba(60,50,170,0.15)'], [0.86, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.55, STAGE.z, 4.0, 3.6, 0));
  set.add(haze(), truss(), place(piano.group, KEYS.x, KEYS.z, KEYS.yaw), place(kit.group, DRUMS.x, DRUMS.z, DRUMS.yaw), place(microphone(), MIC.x, MIC.z));
  kit.group.scale.setScalar(DRUMS.scale);
  piano.group.scale.setScalar(KEYS.scale);

  // the spotlights: each hangs under the truss, throws a pool of its color on the boards and lights the band from behind
  const spots = SPOTS.map(({ a, color }, i) => {
    const one = spot(color);
    const [x, y, z] = onTruss(a);
    const pool = decal(radial([[0, '#ffffff'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]), x * 0.72, 0.012, z * 0.62 - 0.2, 0.7, 0.5, 3);
    const light = new THREE.PointLight(color, 5, 6, 1.7);

    one.group.position.set(x, y - 0.03, z);
    // the head looks at the middle of the stage, a little forward
    one.group.rotation.y = a;
    pool.material.color.setHex(color);
    pool.material.opacity = 0.4;
    light.position.set(x * 0.8, 2.3, z + 0.9);
    set.add(one.group, pool, light);

    return { ...one, pool, light, a, at: [x, z], phase: i * 1.3 };
  });
  const speakers = SPEAKERS.map((a, i) => {
    const one = speaker(i ? 0x6fc4ff : 0xff7aa8);
    const [x, y, z] = onTruss(a);
    const rings = [0, 0.5].map((delay) => {
      const ring = sprite(TEXTURES.ring, i ? 0x9fd6ff : 0xffa3c4, 4);

      ring.position.set(x, y - 0.8, z + 0.3);
      fx.add(ring);

      return { ring, delay };
    });

    one.group.position.set(x, y - 0.8, z + 0.19);
    one.group.rotation.set(0.12, a, 0);
    set.add(one.group);

    return { ...one, rings };
  });

  const cast = {
    // Liruf dances beside the keyboard: a hop on every beat, his head from side to side, and the big jump at the chorus
    liruf: { x: -1.95, z: -0.05, yaw: 0.3, act: {
      hop: sample((t) => Math.max(bounce(t, 1) ** 1.5 * 0.08, bump(t, CHORUS + 0.05, 0.24) * 0.3)), tuck: sample((t) => bump(t, CHORUS + 0.05, 0.22) * 0.9 + bounce(t, 1) ** 2 * 0.18),
      roll: sample((t) => Math.sin(Math.PI * t) * 0.2), tilt: sample((t) => Math.sin(Math.PI * t) * 0.07), turn: sample((t) => Math.sin((Math.PI * t) / 2) * 0.08 - 0.08),
      lean: sample((t) => 0.05 - bump(t, CHORUS + 0.05, 0.3) * 0.2), pitch: sample((t) => -0.1 - bump(t, CHORUS + 0.05, 0.3) * 0.2 + bounce(t, 1) * 0.08), yaw: [[0, -0.3], [4, 0], [L, -0.3]],
    } },
    // Zara sings: she sways with the song, leans back on the long note of the chorus (her arms are turned in `update`)
    zara: { x: -0.68, z: 0.42, yaw: 0.16, act: {
      tilt: sample((t) => Math.sin((Math.PI * t) / 2) * 0.06), lean: [[0, 0.03], [1.6, 0.06], [CHORUS + 0.2, -0.2], [3.6, -0.16], [4.4, 0.03], [L, 0.03]],
      pitch: [[0, -0.05], [1.6, 0.02], [CHORUS + 0.2, -0.3], [3.6, -0.24], [4.4, -0.05], [L, -0.05]], roll: sample((t) => Math.sin((Math.PI * t) / 2 + 0.6) * 0.1),
      yaw: [[0, -0.1], [2, -0.2], [4.5, -0.05], [6, 0.2], [L, -0.1]], hop: sample((t) => bounce(t, 1, 0.25) ** 2 * 0.025),
    } },
    // Rho nods hard on every beat and hops on the off beat, and jumps just after Liruf at the chorus
    rho: { x: 0.22, z: 0.45, yaw: -0.1, act: {
      hop: sample((t) => Math.max(bounce(t, 1, 0.5) ** 1.5 * 0.06, bump(t, CHORUS + 0.2, 0.22) * 0.2)), tuck: sample((t) => bump(t, CHORUS + 0.2, 0.22) * 0.7 + bounce(t, 1, 0.5) ** 2 * 0.14),
      pitch: sample((t) => -0.12 + bounce(t, 0.5) ** 2 * 0.3 - bump(t, CHORUS + 0.2, 0.3) * 0.2), lean: sample((t) => -0.02 + bounce(t, 0.5) ** 2 * 0.07 - bump(t, CHORUS + 0.2, 0.3) * 0.14),
      roll: sample((t) => Math.sin((Math.PI * t) / 2 + 2) * 0.12), tilt: sample((t) => -Math.sin(Math.PI * t) * 0.05), turn: sample((t) => -Math.sin((Math.PI * t) / 2) * 0.14),
    } },
    // Dina, by the drums, sways her head and her tail in time and rears up at the chorus
    dina: { x: 1.28, z: 0.0, yaw: -0.2, act: {
      hop: sample((t) => Math.max(bounce(t, 1, 0.25) ** 2 * 0.03, bump(t, CHORUS + 0.32, 0.26) * 0.12)), rear: sample((t) => bump(t, CHORUS + 0.32, 0.34)),
      roll: sample((t) => Math.sin(Math.PI * t + 0.5) * 0.24), yaw: sample((t) => 0.25 + Math.sin((Math.PI * t) / 2) * 0.25), pitch: sample((t) => -0.2 - bump(t, CHORUS + 0.32, 0.4) * 0.2 + bounce(t, 1) * 0.06),
      tilt: sample((t) => Math.sin(Math.PI * t + 0.5) * 0.03),
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], clear: name === 'dina' ? 0.8 : 0.5, peak: { liruf: CHORUS + 0.05, rho: CHORUS + 0.2, dina: CHORUS + 0.32 }[name] ?? null }));
  // Zara's arms: the right hand toward the microphone, the left one out to the audience, wider at the chorus
  const reach = [[0, 0.75], [1.6, 0.85], [CHORUS + 0.2, 1], [3.6, 1], [4.6, 0.75], [L, 0.75]];
  const offer = [[0, 0.35], [1.5, 0.3], [CHORUS + 0.2, 1], [3.6, 1], [4.6, 0.45], [6, 0.6], [L, 0.35]];
  const tints = [0xffb21f, 0xff4f93, 0x12c9ae, 0x8f8aff];
  const [single, joined] = [note(false), note(true)];
  const effects = [
    sparkles(fx, { loop, actors, each: 5, seed: 23 }),
    landings(fx, { actors, color: 0xfff0d8 }),
    confetti(fx, { at: CHORUS + 0.1, x: 0, z: -0.9, spread: 3.4, count: 120 }),
    // notes from the keyboard, from the drums and over the speakers
    rising(fx, { loop, at: { x: KEYS.x + 0.1, y: 1.3, z: KEYS.z }, radius: 0.5, height: 1.5, count: 5, color: tints, size: [0.2, 0.28], texture: single, sway: 0.07, depth: 0.2, seed: 3, spin: false }),
    rising(fx, { loop, at: { x: KEYS.x + 0.1, y: 1.3, z: KEYS.z }, radius: 0.5, height: 1.5, count: 3, color: tints, size: [0.24, 0.3], texture: joined, sway: 0.07, depth: 0.2, seed: 8, spin: false }),
    rising(fx, { loop, at: { x: DRUMS.x + 0.1, y: 1.55, z: DRUMS.z }, radius: 0.5, height: 1.4, count: 5, color: tints, size: [0.2, 0.28], texture: single, sway: 0.07, depth: 0.2, seed: 14, spin: false }),
    rising(fx, { loop, at: { x: DRUMS.x + 0.1, y: 1.55, z: DRUMS.z }, radius: 0.5, height: 1.4, count: 3, color: tints, size: [0.24, 0.3], texture: joined, sway: 0.07, depth: 0.2, seed: 21, spin: false }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: CHORUS + 0.15,
    camera: { y: 2.3, dist: 14.6, lookY: 1.33 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const beat = hit(t);
      const bar = hit(t, BEAT * 2);
      // the chorus: everything is brighter from its first beat, and eases back before the loop ends
      const chorus = Math.max(0, Math.min(1, (t - CHORUS + 0.15) / 0.3)) * Math.max(0, Math.min(1, (L - 1 - t) / 1.5));

      // the spotlights sweep, each at its own pace, and pulse on the beat
      for (const { head, beam, lens, glow, pool, light, a, at, phase } of spots) {
        const swing = Math.sin(w * 2 + phase) * 0.26;
        const power = 0.62 + chorus * 0.3 + beat * 0.12;

        head.rotation.set(0.42, 0, swing - a * 0.22);
        beam.material.uniforms.power.value = power;
        lens.material.emissiveIntensity = 1.8 + power * 1.4;
        glow.material.opacity = 0.45 + power * 0.4;
        pool.position.x = at[0] * 0.72 + Math.sin(swing - a * 0.22) * Math.cos(a) * 2.6;
        pool.material.opacity = 0.2 + power * 0.26;
        light.intensity = 3 + power * 4;
      }

      // the speakers: the cone and the ring of light jump on every beat, and a ring of sound leaves on every bar
      for (const { ring, cone, cap, rings } of speakers) {
        ring.material.emissiveIntensity = 1.2 + beat * 2;
        ring.scale.setScalar(1 + beat * 0.05);
        cone.position.z = -0.05 + beat * 0.03;
        cap.position.z = 0.03 + beat * 0.04;

        for (const { ring: sound, delay } of rings) {
          const u = (((t + delay) % 1) + 1) % 1;

          sound.scale.setScalar(0.75 + u * 0.75);
          sound.material.opacity = 0.55 * (1 - u) * (0.5 + chorus * 0.5);
        }
      }

      // the footlights run around the rim, and the ring under them breathes with the bar
      floor.lamps.forEach((lamp, i) => { lamp.emissiveIntensity = 1 + 1.8 * Math.max(0, Math.sin(w * 4 - (i / 3) * TAU)); });
      floor.glowRing.material.emissiveIntensity = 1.4 + bar * 1.2;
      floor.underRing.material.emissiveIntensity = 1.8 + beat * 0.8;

      // the drums play themselves: the cymbals rock, the skin of the bass drum kicks
      kit.plates.forEach((plate, i) => { plate.rotation.x = [0.2, -0.18][i] + Math.sin(w * 8 + i * 2) * 0.09; });
      kit.head.scale.setScalar(1 + bar * 0.03);
      piano.lights.forEach((light, i) => { light.material.emissiveIntensity = 0.6 + 2.4 * Math.max(0, Math.sin(w * 8 - i * 2.1)); });

      // Zara's arms, on top of the pose the scene gives her
      const near = curve(reach, t);
      const out = curve(offer, t);
      const zara = rigs.zara;

      zara.rot('RightArm', X, -near * 0.9);
      zara.rot('RightArm', Z, -near * 0.25);
      zara.rot('RightForeArm', Z, -near * 0.9);
      zara.rot('RightForeArm', X, -near * 0.3);
      zara.rot('LeftArm', Z, out * 0.62);
      zara.rot('LeftArm', X, out * 1.15);
      zara.rot('LeftForeArm', Z, out * 0.25);

      for (const effect of effects) effect(t);
    },
  };
}
