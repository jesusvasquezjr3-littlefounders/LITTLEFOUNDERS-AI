// The compositions of the home page (`/home`): the four mentors together doing something, in a setting of its own,
// with effects. A person sees one a day (docs/design/CHARACTER-COMPOSITIONS.md, "home (a family)").
//
// One page draws every composition of the family, chosen by `?scene=`. This file is what they share: the picture's
// size, the camera, the light, the characters and how they act. A composition is a file in home/ that builds its
// setting and says where each character stands and what it does (see `SCENES` below and home/exchange.js for the
// shape of one).
//
// Every composition is transparent: its setting is an island with nothing beyond it, so the picture sits on the
// page's own color in light and in dark and has no border. `window.__render(t)` draws second `t` of the 8-second
// loop; the owner approves a still of each composition before its loop is rendered (D-041).
//
// RULE (owner, 2026-10-10): Rho and Liruf never raise their elbows or hands. `Rig.rot` refuses their arm bones, so
// the rule cannot be broken by a composition. Everything else may move.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { decal, radial, TAU } from './home-kit.js';

// The thirty compositions, by the name of their file in home/.
const SCENES = [
  // finance
  'exchange', 'vault', 'market', 'lemonade', 'piggybank', 'garden', 'startup', 'fair',
  // adventure
  'race', 'space', 'planet', 'jungle', 'sea', 'summit', 'treasure', 'balloon',
  // everyday
  'classroom', 'library', 'kitchen', 'camp', 'beach', 'funfair', 'concert',
  // nods to films and games, always generic (D-053)
  'timetravel', 'dinopark', 'detectives', 'arcade', 'heroes', 'western', 'magic',
];

const params = new URLSearchParams(location.search);
const SCENE = params.get('scene') ?? 'exchange';
const number = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);
const LOOP = 8;
const SCALE = 2;
const OUT_W = 1200;
const OUT_H = 800;

if (!SCENES.includes(SCENE)) throw new Error(`No composition is called "${SCENE}". There are: ${SCENES.join(', ')}`);

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

// ---- light: one bright rig for both color modes. The key light is much the strongest, so every character and
// every piece of the setting throws a soft shadow. A composition may add lights of its own (lamps, screens, a glow).
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd2ff, 0.55));

const key = new THREE.DirectionalLight(0xfff3e2, 3.3);

key.position.set(-3.2, 7.5, 5);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.camera.near = 1;
key.shadow.camera.far = 26;
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

const contact = radial([[0, 'rgba(34,24,110,0.6)'], [0.5, 'rgba(34,24,110,0.26)'], [1, 'rgba(34,24,110,0)']]);

// ---- the characters
// the artist originals for the three bipeds (glb/Rho.glb and glb/Liruf.glb are torn); Dina has no original
const FILES = { zara: 'originals/Zara', rho: 'originals/Rho', liruf: 'originals/Liruf', dina: 'Dina' };
const HEIGHT = { zara: 1.56, rho: 1.4, liruf: 1.4, dina: 1.5 };
const NAMES = ['liruf', 'zara', 'rho', 'dina'];
const NO_ARMS = new Set(['rho', 'liruf']);
const ARM_BONE = /Shoulder|Arm|Hand/;

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** A character at its standing height. `rot` turns one bone on top of its rest pose, in the character's own frame (x left, y up, z forward). */
class Rig {
  constructor(name, gltf, { x, z, yaw, y = 0 }) {
    this.name = name;
    this.height = HEIGHT[name];
    this.model = gltf.scene;
    this.bones = new Map();
    this.model.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });
    this.rest = new Map([...this.bones].map(([bone, o]) => [bone, o.quaternion.clone()]));

    const bounds = new THREE.Box3().setFromObject(this.model);

    this.model.scale.multiplyScalar(HEIGHT[name] / (bounds.max.y - bounds.min.y));
    this.model.updateMatrixWorld(true);

    const fitted = new THREE.Box3().setFromObject(this.model);

    this.model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
    this.footprint = { x: (fitted.max.x - fitted.min.x) / 2, z: (fitted.max.z - fitted.min.z) / 2 };
    this.holder = new THREE.Group();
    this.holder.add(this.model);
    this.holder.rotation.y = yaw;
    this.holder.position.set(x, y, z);
    this.at = { x, z, yaw };
    this.baseY = y;
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
    // the dark spot where the character touches the floor: it shrinks and fades as the character leaves it
    this.spot = decal(contact, x, y + 0.014, z, 1, 1, 3);
    this.spotSize = { x: Math.max(0.42, this.footprint.x * 1.05), z: Math.max(0.3, this.footprint.z * 0.8) };
    scene.add(this.spot);
  }

  /** The head bone, whatever this character's file calls it. */
  get head() {
    return this.bones.get(this.name === 'dina' ? 'head' : 'Head');
  }

  reset() {
    for (const [bone, o] of this.bones) o.quaternion.copy(this.rest.get(bone));

    this.holder.position.set(this.at.x, this.baseY, this.at.z);
    this.holder.rotation.set(0, this.at.yaw, 0, 'YXZ');
  }

  /** Puts the character in or on something that moves (a car, a basket, a board): from then on its frame is that thing's. */
  seatIn(parent, { x = 0, y = 0, z = 0, yaw = 0 }) {
    parent.add(this.holder);
    this.at = { x, z, yaw };
    this.baseY = y;
    this.holder.position.set(x, y, z);
    this.holder.rotation.set(0, yaw, 0, 'YXZ');
    this.holder.updateWorldMatrix(true, false);
    this.frameInverse = this.holder.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.spot.visible = false;
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
 * ACTING. The faces are textures, so what a character feels shows in its body: it bounces, jumps, leans in and tilts
 * its head. A character that only stands and turns its head reads as bored. Rho and Liruf show all of it without
 * their arms.
 *
 * What a composition asks of a body, as curves over the loop (radians, or metres for `hop`, `lift` and `slide`):
 *   yaw, pitch, roll   the head (yaw positive is toward the reader's right, pitch positive is down)
 *   lean               the spine forward (negative: chest out, head back, the look of a cheer)
 *   tilt               the whole body leaning sideways (positive: toward the reader's right)
 *   turn               the whole body turning on the spot, added to where it faces
 *   hop                a jump, never below the floor, and `tuck` the knees folding under it (0 to 1)
 *   lift               the body's height above its floor, for a character that floats; `slide` moves it sideways
 *   cheer              Zara only: both arms up (0 to 1); `wave` her right hand waving beside her head
 *   rear               Dina only: her front lifted off the floor (0 to 1)
 * Every curve ends where it starts, so the loop is seamless. `still` (0 to 1) calms the breath and the small bounce
 * every character has, for a body that floats.
 */
const FLAT = [[0, 0], [LOOP, 0]];

function act(rig, part, t, phase) {
  const value = (channel, lag = 0) => curve(part[channel] ?? FLAT, t, lag);
  const w = (t / LOOP) * TAU;
  const calm = 1 - (part.still ?? 0);
  // a moving hold: a quick breath and a small bounce, in whole cycles of the loop, different for each character
  const breath = Math.sin(w * 4 + phase) * 0.014;
  const drift = Math.sin(w * 2 + phase) * 0.03;
  const lean = value('lean');
  const tuck = value('tuck');
  const up = Math.max(0, value('hop') + Math.abs(Math.sin(w * 4 + phase)) * 0.012 * calm) + value('lift');

  rig.reset();
  rig.holder.position.y = rig.baseY + up;
  rig.holder.position.x = rig.at.x + value('slide');
  rig.holder.rotation.y = rig.at.yaw + value('turn');
  rig.holder.rotation.z = -value('tilt');

  const off = Math.min(1, Math.max(0, up) / 0.3);

  rig.spot.position.x = rig.holder.position.x;
  rig.spot.scale.set(rig.spotSize.x * (1 - off * 0.45), rig.spotSize.z * (1 - off * 0.45), 1);
  rig.spot.material.opacity = 1 - off * 0.55;

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

    rig.rot('earend', X, Math.sin(w * 4 + phase) * 0.1);
    rig.rot('R_earend', X, Math.sin(w * 4 + phase + 1) * 0.1);

    return;
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
    // Her file rests with the arms held out: they come down to her sides. Only she may raise them: both up when she
    // cheers, the right hand waving beside her head when she says hello or points something out.
    const cheer = value('cheer', 0.08);
    const wave = value('wave');
    const swing = wave * Math.sin(w * 12) * 0.25;

    rig.rot('LeftArm', Z, -0.4 + cheer * 1.5);
    rig.rot('LeftArm', X, -0.18);
    rig.rot('LeftForeArm', Z, cheer * 0.7);
    rig.rot('RightArm', Z, 0.4 - Math.max(cheer * 1.5, wave * 0.5));
    rig.rot('RightArm', X, -0.18);
    rig.rot('RightForeArm', Z, -Math.max(cheer * 0.7, wave * 2.1) + swing);
  }
}

// ---- the composition
const tools = {
  loop: LOOP,
  heights: HEIGHT,
  number,
  curve,
  flat: FLAT,
  // the axes of a character's own frame, for `rig.rot(bone, axis, angle)` in a composition's `update`
  X,
  Y,
  Z,
  /** A jump that peaks at `at`: a dip first (anticipation), up, down, and a small settle. */
  jump: (at, height) => [[0, 0], [at - 0.55, 0], [at - 0.32, -0.035], [at, height], [at + 0.3, -0.03], [at + 0.5, 0], [LOOP, 0]],
  tuck: (at, amount) => [[0, 0], [at - 0.3, 0], [at, amount], [at + 0.3, 0], [LOOP, 0]],
};
const composition = (await import(`./home/${SCENE}.js`)).build(scene, tools);
const loader = new GLTFLoader();
const gltfs = await Promise.all(NAMES.map((name) => new Promise((resolve, reject) => loader.load(`/glb/${FILES[name]}.glb`, resolve, undefined, reject))));
const cast = NAMES.map((name, i) => ({ rig: new Rig(name, gltfs[i], composition.cast[name]), part: composition.cast[name].act, phase: i * 1.7 }));
const rigs = Object.fromEntries(cast.map(({ rig }) => [rig.name, rig]));

composition.ready?.(rigs);

// ---- the camera: a long lens a little above eye height, like the product's other scenes
const view = { fov: 20, x: 0, y: 2.3, dist: 12.4, lookX: 0, lookY: 1.02, ...composition.camera };
const camera = new THREE.PerspectiveCamera(number('fov', view.fov), OUT_W / OUT_H, 0.1, 120);

camera.position.set(number('cx', view.x), number('cy', view.y), number('dist', view.dist));
camera.lookAt(number('lx', view.lookX), number('ly', view.lookY), 0);

// ---- the frame
const out = document.createElement('canvas');

out.width = OUT_W;
out.height = OUT_H;

const outContext = out.getContext('2d');
const BAND_X = 48;
const BAND_Y = 40;

window.__render = (time) => {
  const t = ((time % LOOP) + LOOP) % LOOP;

  for (const { rig, part, phase } of cast) act(rig, part, t, phase);

  composition.update?.(t, rigs);

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

// The same frame laid on a page color: a video cannot be transparent in every browser, so each loop is made once per
// color mode, on that mode's page color, from the one transparent render. A still is looked at the same way.
const baked = document.createElement('canvas');

baked.width = OUT_W;
baked.height = OUT_H;

const bakedContext = baked.getContext('2d');

window.__size = { width: OUT_W, height: OUT_H };
// the second of the loop the composition is at its clearest: its still, and later its poster
window.__still = composition.still ?? 2;

window.__frameOn = (color, type = 'image/jpeg', quality = 0.95) => {
  bakedContext.fillStyle = color;
  bakedContext.fillRect(0, 0, OUT_W, OUT_H);
  bakedContext.drawImage(out, 0, 0);

  return baked.toDataURL(type, quality);
};
document.body.dataset.ready = '1';
