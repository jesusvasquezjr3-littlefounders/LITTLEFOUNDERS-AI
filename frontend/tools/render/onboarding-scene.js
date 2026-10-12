// The onboarding's compositions (docs/features/F-003-onboarding.md, docs/design/CHARACTER-COMPOSITIONS.md).
// One page draws every scene of the family, chosen by `?scene=`:
//
//   group-greet    the four mentors together, greeting                      (the first screen of both paths)
//   group-attend   the four together, looking toward what the person fills in
//   <mentor>-look  the chosen mentor alone, looking toward the options, up and down
//   <mentor>-nod   the same mentor, agreeing with a nod
//   <mentor>-lean  the same mentor, leaning in with interest
//   <mentor>-portrait  the mentor from the chest up and nothing else, for the card it is chosen from
//   <mentor>-games     the mentor driving an open sports car flat out on a cut-out piece of race track (onboarding-track.js)
//   <mentor>-seeds     the mentor on the studio as a sunflower drops its Seeds into a jar (onboarding-seeds.js)
//
// All of them are played on one set, the mentors' studio (onboarding-set.js): the whole of it for the four together,
// the middle of it for one mentor alone.
//
// The three single-mentor poses are reused by most screens. The scenes that need a setting and an action of their own
// (mini-games, Seeds) are added here as they are designed.
//
// Every scene is transparent: the studio is an island with no walls and nothing beyond its deck, so the picture sits
// on the page's own color in light and in dark and has no border. `window.__render(t)` draws second
// `t` of the 8-second loop; the owner approves a still of each scene before its loop is rendered.
//
// RULE (owner, 2026-10-10): Rho and Liruf never raise their elbows or hands. Their arm bones are not touched at all
// here, and `Rig.rot` refuses them, so the rule cannot be broken by a later edit. Everything else may move.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSeeds } from './onboarding-seeds.js';
import { buildSet } from './onboarding-set.js';
import { buildTrack } from './onboarding-track.js';
import { buildVfx } from './onboarding-vfx.js';

const params = new URLSearchParams(location.search);
const SCENE = params.get('scene') ?? 'group-greet';
const number = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);
const LOOP = 8;
const TAU = Math.PI * 2;

const SCALE = 2;

const IS_GROUP = SCENE.startsWith('group');
// the four together are a wide picture, one mentor alone a square one (the same sizes as SIZE in StepArt.tsx)
const IS_PORTRAIT = SCENE.endsWith('-portrait');
const [MENTOR, POSE] = IS_GROUP ? [null, SCENE.slice(6)] : SCENE.split('-');
const IS_GAMES = POSE === 'games';
const IS_SEEDS = POSE === 'seeds';
const OUT_W = IS_GROUP ? 1200 : IS_PORTRAIT ? 560 : 900;
const OUT_H = IS_GROUP ? 800 : IS_PORTRAIT ? 560 : 900;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });

renderer.setPixelRatio(1);
renderer.setSize(OUT_W * SCALE, OUT_H * SCALE, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;


// ---- the camera: a long lens a little above eye height, like the product's other scenes
const camera = new THREE.PerspectiveCamera(number('fov', 20), OUT_W / OUT_H, 0.1, 80);
// a portrait is framed on each mentor's own head and shoulders: [height the camera looks at, distance]
const PORTRAIT = { zara: [1.3, 2.9], rho: [1.04, 3.9], liruf: [1.0, 4.1], dina: [0.98, 5.4] };
const LOOK = new THREE.Vector3(number('lx', 0), number('ly', IS_GROUP ? 1.02 : IS_PORTRAIT ? PORTRAIT[MENTOR][0] : IS_GAMES ? 0.75 : 1.05), 0);

camera.position.set(number('cx', 0), number('cy', IS_GROUP ? 2.3 : IS_PORTRAIT ? PORTRAIT[MENTOR][0] + 0.2 : IS_GAMES ? 2.9 : 2.0), number('dist', IS_GROUP ? 12.4 : IS_PORTRAIT ? PORTRAIT[MENTOR][1] : IS_GAMES ? (MENTOR === 'dina' ? 16.8 : MENTOR === 'zara' ? 12.2 : 13.4) : 9.6));
camera.lookAt(LOOK);

// ---- light: one bright rig for both color modes
// The key light is much the strongest, so what it does not reach is clearly in shadow: every character and every
// piece of the set throws a soft shadow on the deck.
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd2ff, 0.55));

const key = new THREE.DirectionalLight(0xfff3e2, 3.3);

key.position.set(-3.2, 7.5, 5);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.camera.near = 1;
key.shadow.camera.far = 24;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
key.shadow.radius = 9;
key.shadow.blurSamples = 20;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe3ff, 0.9);

fill.position.set(4, 3, 5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xb9c0ff, 1.2);

rim.position.set(2, 4, -5);
scene.add(rim);

// ---- the set: the mentors' studio (onboarding-set.js), the same for every scene of the onboarding
if (!IS_PORTRAIT && !IS_GAMES) buildSet(scene, IS_GROUP ? 'wide' : IS_SEEDS ? 'seeds' : 'close');

// the two scenes with a setting of their own
const track = IS_GAMES ? buildTrack(scene, { loop: LOOP, mentor: MENTOR }) : null;
const updateSeeds = IS_SEEDS ? buildSeeds(scene, { loop: LOOP }) : null;

// A second layer of shadow right on the deck, so the shadows stay readable on the bright rug and the pale wood.
const DECK = IS_GROUP ? { radius: 2.95, z: -0.3 } : { radius: 1.6, z: -0.2 };
const shadowLayer = new THREE.Mesh(new THREE.CircleGeometry(DECK.radius, 96), new THREE.ShadowMaterial({ opacity: 0.3, color: 0x2a1f6e }));

shadowLayer.rotation.x = -Math.PI / 2;
shadowLayer.position.set(0, 0.008, DECK.z);
shadowLayer.receiveShadow = true;
shadowLayer.material.depthWrite = false;
shadowLayer.renderOrder = 2;

if (!IS_PORTRAIT && !IS_GAMES) scene.add(shadowLayer);

function radial(stops) {
  const size = 256;
  const c = document.createElement('canvas');

  c.width = c.height = size;

  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

  for (const [at, color] of stops) grad.addColorStop(at, color);

  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(c);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

// the deck's own soft shadow on the page, fading to nothing well inside the frame
const glow = radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]);
const contact = radial([[0, 'rgba(34,24,110,0.6)'], [0.5, 'rgba(34,24,110,0.26)'], [1, 'rgba(34,24,110,0)']]);

function disc(texture, x, z, rx, rz, y, order) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));

  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(rx, rz, 1);
  mesh.position.set(x, y, z);
  mesh.renderOrder = order;
  scene.add(mesh);

  return mesh;
}

if (!IS_PORTRAIT) disc(glow, 0, IS_GROUP ? -0.3 : IS_GAMES ? 0 : -0.25, IS_GROUP ? 3.6 : IS_GAMES ? 4.2 : 2.4, IS_GROUP ? 3.6 : IS_GAMES ? 3.2 : 2.4, IS_GAMES ? -0.4 : -0.19, 0);

// ---- the characters
const loader = new GLTFLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
// the artist originals for the three bipeds (glb/Rho.glb and glb/Liruf.glb are torn); Dina has no original
const FILES = { zara: 'originals/Zara', rho: 'originals/Rho', liruf: 'originals/Liruf', dina: 'Dina' };
const HEIGHT = { zara: 1.56, rho: 1.4, liruf: 1.4, dina: 1.5 };
const NO_ARMS = new Set(['rho', 'liruf']);
const ARM_BONE = /Shoulder|Arm|Hand/;

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** A character at its standing height. `rot` turns one bone on top of its rest pose, in the character's own frame (x left, y up, z forward). */
class Rig {
  constructor(name, gltf, { x, z, yaw }) {
    this.name = name;
    this.model = gltf.scene;
    this.bones = new Map();
    this.model.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });
    this.rest = new Map([...this.bones].map(([bone, o]) => [bone, o.quaternion.clone()]));

    const box = new THREE.Box3().setFromObject(this.model);
    const k = HEIGHT[name] / (box.max.y - box.min.y);

    this.model.scale.multiplyScalar(k);
    this.model.updateMatrixWorld(true);

    const fitted = new THREE.Box3().setFromObject(this.model);

    this.model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
    this.footprint = { x: (fitted.max.x - fitted.min.x) / 2, z: (fitted.max.z - fitted.min.z) / 2 };
    this.holder = new THREE.Group();
    this.holder.add(this.model);
    this.holder.rotation.y = yaw;
    this.holder.position.set(x, 0, z);
    this.at = { x, z, yaw };
    scene.add(this.holder);
    this.holder.updateMatrixWorld(true);
    this.frameInverse = this.holder.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.model.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;

      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;

      if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    // the dark spot where the character touches the deck: it shrinks and fades as the character leaves the floor
    this.spot = disc(contact, x, z, 1, 1, 0.014, 3);
    this.spot.visible = !IS_PORTRAIT && !IS_GAMES;
    this.baseY = 0;
    this.spotSize = { x: Math.max(0.42, this.footprint.x * 1.05), z: Math.max(0.3, this.footprint.z * 0.8) };
  }

  reset() {
    for (const [bone, o] of this.bones) o.quaternion.copy(this.rest.get(bone));

    this.holder.position.y = this.baseY;
    this.holder.rotation.set(0, this.at.yaw, 0, 'YXZ');
  }

  /** Puts the character in something that moves (the car): from then on its frame is that thing's. */
  seatIn(parent, { yaw, y }) {
    parent.add(this.holder);
    this.at = { x: 0, z: 0, yaw };
    this.baseY = y;
    this.holder.position.set(0, y, 0);
    this.holder.rotation.set(0, yaw, 0, 'YXZ');
    this.holder.updateWorldMatrix(true, false);
    this.frameInverse = this.holder.getWorldQuaternion(new THREE.Quaternion()).invert();
  }

  rot(bone, axis, angle) {
    if (NO_ARMS.has(this.name) && ARM_BONE.test(bone)) throw new Error(`${this.name} never raises elbows or hands: ${bone} must not be moved`);

    const o = this.bones.get(bone);

    if (!o || !angle) return;

    o.parent.updateWorldMatrix(true, false);

    const parent = o.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.frameInverse);

    o.quaternion.copy(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent).multiply(o.quaternion));
  }
}

/** A looping curve through [second, value] keys that eases in and out of each; `lag` reads it late (the head follows the body). */
function curve(keys, t, lag = 0) {
  const x = (((t - lag) % LOOP) + LOOP) % LOOP;

  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];

    if (x >= t0 && x <= t1) {
      const u = (x - t0) / (t1 - t0);

      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }

  return keys[0][1];
}

/*
 * ACTING. The mentors are glad the person is here, and it has to show in the body, because the faces are textures:
 * they bounce on their feet, jump, lean toward the person and tilt their heads. A character that only stands and turns
 * its head reads as bored (the owner rejected the first drafts for that). Rho and Liruf show all of it without their
 * arms: with the jump, the knees, the torso and the head.
 *
 * What a pose asks of a body, as curves over the loop (radians, or metres for `hop`):
 *   yaw, pitch, roll   the head (yaw positive is toward the reader's right, pitch positive is down)
 *   lean               the spine forward (negative: chest out, head back, the look of a cheer)
 *   tilt               the whole body leaning sideways (positive: toward the reader's right)
 *   hop                a jump, and `tuck` the knees folding under it (0 to 1)
 *   cheer              Zara only: both arms up (0 to 1); `wave` her right hand waving beside her head
 *   rear               Dina only: her front lifted off the floor (0 to 1)
 * Every curve ends where it starts, so the loop is seamless.
 */
const FLAT = [[0, 0], [LOOP, 0]];
/** A jump that peaks at `at`: a dip first (anticipation), up, down, and a small settle. */
const jump = (at, height) => [[0, 0], [at - 0.55, 0], [at - 0.32, -0.035], [at, height], [at + 0.3, -0.03], [at + 0.5, 0], [LOOP, 0]];
const tuckFor = (at, amount) => [[0, 0], [at - 0.3, 0], [at, amount], [at + 0.3, 0], [LOOP, 0]];
const ACTS = {
  // eager about the options beside it: leans toward them on its toes, reads down them and bounces back up
  look: {
    yaw: [[0, 0.55], [LOOP, 0.55]], pitch: [[0, -0.12], [2.6, -0.12], [3.8, 0.22], [4.8, 0.22], [6, -0.12], [LOOP, -0.12]],
    roll: [[0, 0.16], [2.6, 0.16], [3.8, 0.06], [6, 0.16], [LOOP, 0.16]], lean: [[0, 0.06], [3.8, 0.14], [6, 0.06], [LOOP, 0.06]],
    tilt: [[0, 0.1], [3.8, 0.15], [6, 0.1], [LOOP, 0.1]], hop: jump(1.4, 0.16), tuck: tuckFor(1.4, 0.5), wave: [[0, 0], [0.9, 0], [1.3, 1], [2.6, 1], [3.2, 0], [LOOP, 0]],
  },
  // a happy yes: a jump, landing in a big nod, then a second, smaller one
  nod: {
    yaw: [[0, 0.12], [LOOP, 0.12]], pitch: [[0, -0.1], [1.3, -0.2], [1.75, 0.3], [2.15, -0.08], [2.5, 0.2], [3, -0.1], [LOOP, -0.1]],
    roll: [[0, 0.08], [3, -0.1], [5.5, 0.08], [LOOP, 0.08]], lean: [[0, -0.04], [1.3, -0.12], [1.75, 0.1], [3, -0.04], [LOOP, -0.04]],
    tilt: [[0, 0], [1.3, -0.06], [2.2, 0.06], [3.2, 0], [LOOP, 0]], hop: jump(1.3, 0.22), tuck: tuckFor(1.3, 0.75), cheer: [[0, 0], [0.9, 0], [1.3, 1], [2.1, 1], [2.9, 0], [LOOP, 0]],
  },
  // cannot wait: leans in close with the head tilted, bouncing twice on the spot
  lean: {
    yaw: [[0, 0.32], [LOOP, 0.32]], pitch: [[0, -0.16], [LOOP, -0.16]], roll: [[0, -0.14], [3.2, 0.18], [5.6, 0.18], [LOOP, -0.14]],
    lean: [[0, 0.1], [3.2, 0.26], [5.6, 0.26], [LOOP, 0.1]], tilt: [[0, -0.06], [3.2, 0.1], [5.6, 0.1], [LOOP, -0.06]],
    hop: [[0, 0], [2.7, 0], [2.9, -0.03], [3.2, 0.13], [3.5, 0], [3.8, 0.08], [4.1, 0], [LOOP, 0]], tuck: tuckFor(3.2, 0.4), wave: [[0, 0], [2.8, 0], [3.2, 1], [5.2, 1], [5.8, 0], [LOOP, 0]],
  },
  // the group attends to what the person is filling in, beside and a little below them, shifting with interest
  attend: {
    yaw: [[0, 0.4], [LOOP, 0.4]], pitch: [[0, 0.1], [3, 0.2], [6, 0.1], [LOOP, 0.1]], roll: [[0, 0.12], [3, 0.04], [6, 0.12], [LOOP, 0.12]],
    lean: [[0, 0.1], [3, 0.16], [6, 0.1], [LOOP, 0.1]], tilt: [[0, 0.08], [LOOP, 0.08]],
  },
  // the card: facing the reader with the head a little tilted, bright and still
  portrait: { yaw: [[0, 0.1], [LOOP, 0.1]], pitch: [[0, -0.06], [LOOP, -0.06]], roll: [[0, 0.1], [LOOP, 0.1]], lean: [[0, 0.02], [LOOP, 0.02]] },
  // at the wheel: pressed back by the speed, the head turned toward the reader and swaying with the road
  games: {
    yaw: [[0, -0.34], [LOOP, -0.34]], pitch: [[0, -0.1], [2, -0.02], [4, -0.1], [6, -0.02], [LOOP, -0.1]], roll: [[0, 0.07], [2, -0.07], [4, 0.07], [6, -0.07], [LOOP, 0.07]],
    lean: [[0, -0.1], [LOOP, -0.1]], wave: [[0, 0], [0.8, 1], [3.2, 1], [4, 0], [LOOP, 0]],
  },
  // looking up at the big Seed, and jumping for it
  seeds: {
    yaw: [[0, 0.5], [LOOP, 0.5]], pitch: [[0, -0.34], [LOOP, -0.34]], roll: [[0, 0.12], [3, -0.04], [6, 0.12], [LOOP, 0.12]], lean: [[0, -0.08], [LOOP, -0.08]],
    hop: jump(1.6, 0.24), tuck: tuckFor(1.6, 0.7), cheer: [[0, 0], [1.2, 0], [1.6, 1], [2.4, 1], [3.2, 0], [LOOP, 0]],
  },
  // the group's greeting: everybody jumps for joy, a beat apart, each in its own way (GREET below)
  greet: { yaw: FLAT, pitch: FLAT, roll: FLAT, lean: FLAT },
};
const GREET = {
  zara: { hop: jump(1.9, 0.2), tuck: tuckFor(1.9, 0.6), cheer: [[0, 0], [1.5, 0], [1.9, 1], [2.5, 0], [LOOP, 0]], wave: [[0, 0], [2.4, 0], [3, 1], [5.6, 1], [6.3, 0], [LOOP, 0]], lean: [[0, 0], [1.9, -0.14], [2.6, 0], [LOOP, 0]], roll: [[0, 0.08], [1.9, -0.08], [3, 0.14], [5.6, 0.14], [LOOP, 0.08]], pitch: [[0, -0.08], [1.9, -0.25], [2.6, -0.08], [LOOP, -0.08]] },
  rho: { hop: jump(2.05, 0.17), tuck: tuckFor(2.05, 0.7), lean: [[0, -0.03], [2.05, -0.16], [2.5, 0.08], [3.2, -0.03], [LOOP, -0.03]], pitch: [[0, -0.1], [2.05, -0.3], [2.5, 0.12], [3.2, -0.1], [LOOP, -0.1]], roll: [[0, 0.1], [2.05, -0.12], [4, 0.1], [LOOP, 0.1]], tilt: [[0, 0], [2.05, 0.08], [3, 0], [LOOP, 0]] },
  liruf: { hop: jump(1.8, 0.3), tuck: tuckFor(1.8, 0.9), lean: [[0, 0.04], [1.8, -0.12], [2.4, 0.1], [3, 0.04], [LOOP, 0.04]], pitch: [[0, -0.1], [1.8, -0.32], [2.4, 0], [LOOP, -0.1]], roll: [[0, -0.14], [1.8, 0.14], [3.6, -0.14], [LOOP, -0.14]], tilt: [[0, 0], [1.8, -0.12], [2.6, 0], [LOOP, 0]] },
  dina: { hop: jump(2.15, 0.12), rear: [[0, 0], [1.7, 0], [2.15, 1], [2.7, 0], [LOOP, 0]], pitch: [[0, -0.16], [2.15, -0.4], [2.8, -0.16], [LOOP, -0.16]], roll: [[0, 0.2], [2.15, -0.1], [4, 0.2], [LOOP, 0.2]], yaw: [[0, 0.1], [LOOP, 0.1]] },
};

function act(rig, name, t, phase) {
  const base = ACTS[name];
  const own = name === 'greet' ? GREET[rig.name] : {};
  const value = (channel, lag = 0) => curve(own[channel] ?? base[channel] ?? FLAT, t, lag);
  const w = (t / LOOP) * TAU;
  // a moving hold: a quick breath and a small bounce, in whole cycles of the loop, different for each character
  const breath = Math.sin(w * 4 + phase) * 0.014;
  const drift = Math.sin(w * 2 + phase) * 0.03;
  const lean = value('lean');
  const tuck = value('tuck');

  rig.reset();
  rig.holder.position.y = rig.baseY + Math.max(0, value('hop') + Math.abs(Math.sin(w * 4 + phase)) * 0.012);

  const off = Math.min(1, Math.max(0, rig.holder.position.y - rig.baseY) / 0.3);

  rig.spot.scale.set(rig.spotSize.x * (1 - off * 0.45), rig.spotSize.z * (1 - off * 0.45), 1);
  rig.spot.material.opacity = 1 - off * 0.55;
  rig.holder.rotation.z = -value('tilt');

  if (rig.name === 'dina') {
    // a quadruped on her own rig: she rears up, lifts her head high and wags her tail
    const rear = value('rear');

    rig.holder.rotation.x = -rear * 0.2 - lean * 0.3;
    rig.rot('chest', X, -rear * 0.25 + lean * 0.5 + breath);
    rig.rot('head', X, value('pitch', 0.12) + drift * 0.6);
    rig.rot('head', Y, value('yaw', 0.12) * 0.9);
    rig.rot('head', Z, value('roll', 0.1));

    for (const bone of ['frontleg0', 'R_frontleg0']) rig.rot(bone, X, -rear * 0.5);

    rig.rot('tail', X, -0.25 - rear * 0.2);

    for (const [k, bone] of ['tail', 'tailstart', 'tail1', 'tail2', 'tail3'].entries()) rig.rot(bone, Y, Math.sin(w * 6 + phase - k * 0.6) * (0.08 + k * 0.07));

    // in the car the wind lays her ears back and streams her tail out behind her
    const wind = name === 'games' ? 1 : 0;

    rig.rot('earend', X, Math.sin(w * (4 + wind * 8) + phase) * 0.1 + wind * 0.5);
    rig.rot('R_earend', X, Math.sin(w * (4 + wind * 8) + phase + 1) * 0.1 + wind * 0.5);

    for (const bone of ['tailstart', 'tail1', 'tail2']) rig.rot(bone, X, wind * 0.16);

    return;
  }

  // at the wheel the legs are folded as in a seat, out of sight inside the car
  if (name === 'games') {
    for (const side of ['Left', 'Right']) {
      rig.rot(`${side}UpLeg`, X, -1.35);
      rig.rot(`${side}Leg`, X, 1.3);
    }
  }

  // in the air the knees fold, one a little more than the other
  rig.rot('LeftUpLeg', X, -tuck * 0.75);
  rig.rot('LeftLeg', X, tuck * 1.25);
  rig.rot('RightUpLeg', X, -tuck * 0.45);
  rig.rot('RightLeg', X, tuck * 0.95);
  rig.rot('Spine', X, lean * 0.3 + breath * 0.5);
  rig.rot('Spine01', X, lean * 0.35 + breath);
  rig.rot('Spine02', X, lean * 0.35 + breath);
  rig.rot('neck', X, value('pitch', 0.1) * 0.35 + drift * 0.3);
  rig.rot('Head', X, value('pitch', 0.14) * 0.65 + drift * 0.5);
  rig.rot('neck', Y, value('yaw', 0.1) * 0.35);
  rig.rot('Head', Y, value('yaw', 0.14) * 0.65);
  rig.rot('Head', Z, value('roll', 0.12));

  if (rig.name === 'zara') {
    // Her file rests with the arms held out: they come down to her sides. Only she may raise them, and she does:
    // both up when she cheers, the right hand waving beside her head when she says hello.
    const cheer = value('cheer', 0.08);
    const wave = value('wave');
    const swing = wave * Math.sin(w * 12) * 0.25;
    const tucked = number('tuck', 0.4);

    rig.rot('LeftArm', Z, -tucked + cheer * number('up', 1.5));
    rig.rot('LeftArm', X, -number('fwd', 0.18));
    rig.rot('LeftForeArm', Z, cheer * number('fold', 0.7));
    rig.rot('RightArm', Z, tucked - Math.max(cheer * number('up', 1.5), wave * 0.5));
    rig.rot('RightArm', X, -number('fwd', 0.18));
    rig.rot('RightForeArm', Z, -Math.max(cheer * number('fold', 0.7), wave * 2.1) + swing);
  }
}

// ---- the cast: who is on stage, and where
const names = IS_GROUP ? ['liruf', 'zara', 'rho', 'dina'] : [MENTOR];
const gltfs = await Promise.all(names.map((name) => load(`/glb/${FILES[name]}.glb`)));
// Together: a shallow arc that opens toward the reader; Liruf and Dina at the ends, a step back. Alone: in the middle,
// turned a little toward where the options are.
const SPOTS = IS_GROUP
  ? { liruf: { x: -1.5, z: -0.25, yaw: 0.32 }, zara: { x: -0.5, z: 0.3, yaw: 0.12 }, rho: { x: 0.5, z: 0.35, yaw: -0.12 }, dina: { x: 1.62, z: -0.3, yaw: -0.5 } }
  : { [MENTOR]: { x: IS_PORTRAIT && MENTOR === 'dina' ? -0.2 : IS_SEEDS ? -0.22 : 0, z: IS_SEEDS ? 0.1 : 0, yaw: MENTOR === 'dina' ? number('yaw', 0.55) : number('yaw', 0.22) } };
const cast = names.map((name, i) => ({ rig: new Rig(name, gltfs[i], SPOTS[name]), phase: i * 1.7 }));

// At the wheel: the driver goes in the car's seat, facing its nose, hips where the seat is. Dina is a quadruped: she
// stands in the cockpit on its floor, her body above the doors and her head in the wind, like a dog in an open car.
if (track) {
  const { rig } = cast[0];
  const hips = rig.bones.get('Hips').getWorldPosition(new THREE.Vector3()).y;

  // Zara's legs are long and her body short: she sits on a higher cushion, so her shoulders clear the doors too
  rig.seatIn(track.seat, { yaw: Math.PI / 2, y: track.standing ? 0 : -hips + (MENTOR === 'zara' ? 0.17 : 0) });

  if (track.standing) rig.holder.position.x = number('sx', 0.1);
}

// ---- the effects (onboarding-vfx.js): sparkles, confetti, dust where they land, motes in the lamplight
const PEAK = { look: 1.4, nod: 1.3, lean: 3.2, seeds: 1.6 };
const GREET_PEAK = { zara: 1.9, rho: 2.05, liruf: 1.8, dina: 2.15 };
const updateVfx = IS_PORTRAIT || IS_GAMES ? () => {} : buildVfx(scene, {
  loop: LOOP,
  actors: names.map((name) => ({ x: SPOTS[name].x, z: SPOTS[name].z, height: HEIGHT[name], peak: POSE === 'greet' ? GREET_PEAK[name] : PEAK[POSE] ?? null })),
  cheer: POSE === 'greet' ? 1.95 : POSE === 'nod' ? PEAK.nod : null,
  lamps: IS_GROUP
    ? [{ x: 2.15, y: 1.7, z: -1.45, radius: 0.5, depth: 1.5, count: 26 }, { x: 0, y: 2.15, z: -1.95, radius: 2.4, depth: 0.9, count: 30 }]
    : [{ x: 1.02, y: 1.7, z: -0.92, radius: 0.5, depth: 1.5, count: 22 }, { x: 0, y: 2.05, z: -1.2, radius: 1.25, depth: 0.9, count: 18 }],
  jar: IS_GROUP ? { x: 1.22, y: 0.92, z: -1.93 } : null,
});

// ---- the frame
const out = document.createElement('canvas');

out.width = OUT_W;
out.height = OUT_H;

const outContext = out.getContext('2d');
const BAND_X = 48;
const BAND_Y = 40;

window.__render = (time) => {
  const t = ((time % LOOP) + LOOP) % LOOP;

  for (const { rig, phase } of cast) act(rig, POSE, t, phase);

  updateVfx(t);
  track?.update(t);
  updateSeeds?.(t);

  renderer.render(scene, camera);
  outContext.clearRect(0, 0, OUT_W, OUT_H);
  outContext.imageSmoothingQuality = 'high';
  outContext.drawImage(canvas, 0, 0, OUT_W, OUT_H);

  // whatever shadow or light is left near a border fades to nothing before it
  outContext.globalCompositeOperation = 'destination-out';

  for (const [x0, y0, x1, y1, x, y, w, h] of [
    [0, 0, 0, BAND_Y, 0, 0, OUT_W, BAND_Y], [0, OUT_H, 0, OUT_H - BAND_Y, 0, OUT_H - BAND_Y, OUT_W, BAND_Y],
    [0, 0, BAND_X, 0, 0, 0, BAND_X, OUT_H], [OUT_W, 0, OUT_W - BAND_X, 0, OUT_W - BAND_X, 0, BAND_X, OUT_H],
  ]) {
    const fade = outContext.createLinearGradient(x0, y0, x1, y1);

    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    outContext.fillStyle = fade;
    outContext.fillRect(x, y, w, h);
  }

  outContext.globalCompositeOperation = 'source-over';

  return true;
};

window.__frame = (type = 'image/png', quality = 0.92) => out.toDataURL(type, quality);

// The same frame laid on a page color, for the loops: a video cannot be transparent in every browser, so each loop is
// made once per color mode, on that mode's page color, from the one transparent render.
const baked = document.createElement('canvas');

baked.width = OUT_W;
baked.height = OUT_H;

const bakedContext = baked.getContext('2d');

window.__size = { width: OUT_W, height: OUT_H };

window.__frameOn = (color, type = 'image/jpeg', quality = 0.95) => {
  bakedContext.fillStyle = color;
  bakedContext.fillRect(0, 0, OUT_W, OUT_H);
  bakedContext.drawImage(out, 0, 0);

  return baked.toDataURL(type, quality);
};
document.body.dataset.ready = '1';
