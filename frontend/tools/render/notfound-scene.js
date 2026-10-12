// The 404 page: Rho and Liruf kneel back to back, each facing outward, heads low, sad that they cannot find the page.
// Rendered frame by frame by render-scene.mjs (`window.__render(t)` draws second `t`); it is not part of the
// application bundle. Composition rules: docs/design/CHARACTER-COMPOSITIONS.md.
//
// ACTING. The faces are textures, so the sadness is in the bodies, and each of the two acts a different small story in
// the same 12 seconds, offset from the other so they never move in unison:
//   Rho    looks for it (his head sweeps the floor), breathes in and sighs, then brings his hands to his chest;
//   Liruf  looks around, taps the floor twice with a claw as if it might be under it, then slumps.
// The principles behind it (docs/design/CHARACTER-COMPOSITIONS.md, "Acting"): every move is anticipated (a breath in
// before the sigh); the body leads and the head and the arms follow a few frames later (overlap); every move eases in
// and out; between moves each character is never frozen but holds with a slow breath (a moving hold); and the weight
// sits low: the lean is forward and down.
// Poses are deltas from each bone's rest pose, expressed in the character's own frame (x left, y up, z forward), so they
// do not depend on how each skeleton orients its bones.
//
// CINEMATOGRAPHY, kept simple: a long lens (22 degrees) from a little above eye height, one warm spotlight with a soft
// haze of light, a cool and a warm rim light for the outlines, specks of light that fall slowly, out-of-focus discs in
// front and behind, and a camera that drifts and returns so the loop is seamless. The light is bright in both color
// modes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'dark' ? 'dark' : 'light';
const DEBUG = params.has('debug');
const log = (...parts) => { (window.__log ??= []).push(parts.join(' ')); };
const LOOP = 12;
const TAU = Math.PI * 2;
const DARK = MODE === 'dark';

const OUT_W = 1600;
const OUT_H = 680;
const SCALE = 2;
const BG = DARK ? 0x0b0d1b : 0xf4f5fd; // --v-canvas: the page's own color
const BG_CSS = DARK ? '#0b0d1b' : '#f4f5fd';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });

renderer.setPixelRatio(1);
renderer.setSize(OUT_W * SCALE, OUT_H * SCALE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = DARK ? 1.05 : 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

scene.background = new THREE.Color(BG);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = DARK ? 0.35 : 0.45;

const camera = new THREE.PerspectiveCamera(22, OUT_W / OUT_H, 0.1, 80);
const SIDE = params.get('cam') === 'side';
const LOOK = new THREE.Vector3(0, 0.62, 0);
const CAMERA_AT = new THREE.Vector3(0.15, 1.5, 8.8);

// ---- light
scene.add(new THREE.HemisphereLight(0xffffff, DARK ? 0x5a5fd0 : 0xc9ccff, DARK ? 0.5 : 0.75));

// the key: a warm spotlight above and in front, soft-edged, casting soft shadows
const key = new THREE.SpotLight(0xffe7c4, 300, 0, 0.5, 1, 2);

key.position.set(-1.0, 6.4, 4.6);
key.target.position.set(0, 0.2, 0);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 3;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
key.shadow.radius = 7;
key.shadow.blurSamples = 16;
scene.add(key, key.target);

// edge lights: a cool one from behind on the left, a warm one from behind on the right
const rimCool = new THREE.DirectionalLight(0x8fa4ff, DARK ? 3.0 : 2.1);

rimCool.position.set(-5.5, 3.2, -4.5);
scene.add(rimCool);

const rimWarm = new THREE.DirectionalLight(0xffc48a, DARK ? 2.4 : 1.8);

rimWarm.position.set(5.5, 3.0, -4.5);
scene.add(rimWarm);

const fill = new THREE.DirectionalLight(0xdfe3ff, 0.55);

fill.position.set(0, 1.4, 7);
scene.add(fill);

// ---- textures
function radial(stops, size = 512) {
  const c = document.createElement('canvas');

  c.width = c.height = size;

  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

  for (const [at, color] of stops) grad.addColorStop(at, color);

  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);

  t.colorSpace = THREE.SRGBColorSpace;

  return t;
}

// a lens disc: soft body with a slightly brighter rim, like the out-of-focus highlight of a real lens
const discTexture = radial([[0, 'rgba(255,255,255,0.55)'], [0.78, 'rgba(255,255,255,0.7)'], [0.92, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']], 256);
const speckTexture = radial([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 128);

// ---- the ground: pools of light that fade to nothing, a shadow catcher; there is never a floor edge
const pool = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
  map: radial(DARK
    ? [[0, 'rgba(120,112,255,0.55)'], [0.4, 'rgba(100,92,235,0.26)'], [0.75, 'rgba(90,82,225,0.07)'], [1, 'rgba(90,82,225,0)']]
    : [[0, 'rgba(130,120,255,0.38)'], [0.45, 'rgba(130,120,255,0.16)'], [0.8, 'rgba(130,120,255,0.04)'], [1, 'rgba(130,120,255,0)']]),
  transparent: true, depthWrite: false, toneMapped: false,
}));

pool.rotation.x = -Math.PI / 2;
pool.scale.set(5.6, 2.8, 1);
pool.position.set(0, 0.002, 0);
pool.renderOrder = 1;
scene.add(pool);

// the warm pool the spotlight leaves on the floor, under the group
const warm = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
  map: radial(DARK ? [[0, 'rgba(255,200,130,0.34)'], [0.5, 'rgba(255,190,120,0.12)'], [1, 'rgba(255,190,120,0)']] : [[0, 'rgba(255,196,120,0.4)'], [0.5, 'rgba(255,200,140,0.14)'], [1, 'rgba(255,200,140,0)']]),
  transparent: true, depthWrite: false, toneMapped: false,
}));

warm.rotation.x = -Math.PI / 2;
warm.scale.set(3.0, 1.8, 1);
warm.position.set(0, 0.003, 0);
warm.renderOrder = 1;
scene.add(warm);

const catcher = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), new THREE.ShadowMaterial({ opacity: DARK ? 0.5 : 0.3, color: DARK ? 0x000010 : 0x2a1f6e }));

catcher.material.depthWrite = false;
catcher.renderOrder = 2;
catcher.rotation.x = -Math.PI / 2;
catcher.position.y = 0.004;
catcher.receiveShadow = true;
scene.add(catcher);

const contact = radial([[0, DARK ? 'rgba(0,0,12,0.65)' : 'rgba(40,30,120,0.42)'], [0.55, DARK ? 'rgba(0,0,12,0.26)' : 'rgba(40,30,120,0.15)'], [1, 'rgba(0,0,0,0)']]);

function contactShadow(x, z, rx, rz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: contact, transparent: true, depthWrite: false, toneMapped: false }));

  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.set(x, 0.006, z);
  m.renderOrder = 2;
  scene.add(m);
}

// ---- the beam's haze: a soft warm glow in the air above and behind the group, with no edge anywhere
const haze = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
  map: radial(DARK ? [[0, 'rgba(255,214,160,0.34)'], [0.45, 'rgba(255,200,140,0.12)'], [1, 'rgba(255,200,140,0)']] : [[0, 'rgba(255,214,150,0.42)'], [0.5, 'rgba(255,220,170,0.14)'], [1, 'rgba(255,220,170,0)']]),
  transparent: true, depthWrite: false, toneMapped: false,
}));

haze.position.set(-0.2, 1.0, -2.2);
haze.scale.set(4.4, 2.4, 1);
haze.renderOrder = 0;
scene.add(haze);

// ---- specks of light falling slowly through the beam (every one makes whole cycles in the loop, so it is seamless)
const SPECKS = 80;
const specks = [];
const random = (seed) => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };

for (let i = 0; i < SPECKS; i++) {
  const depth = random(i + 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: speckTexture, transparent: true, opacity: 0.35 + 0.5 * random(i + 9), depthWrite: false, toneMapped: false, color: DARK ? 0xffffff : 0xffa800, blending: DARK ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));

  m.userData = {
    x: (random(i + 2) - 0.5) * 7, z: -2 + depth * 4, y0: random(i + 3) * 4.2, fall: 1 + Math.floor(random(i + 4) * 2), size: 0.018 + random(i + 5) * 0.045,
    sway: 0.05 + random(i + 6) * 0.12, phase: random(i + 7) * TAU, twinkle: 1 + Math.floor(random(i + 8) * 3),
  };
  m.renderOrder = 4;
  scene.add(m);
  specks.push(m);
}

// ---- lens discs: out-of-focus highlights, large and soft, in front of and behind the group; they drift and return
const DISCS = [
  // x, y, z, radius, color (light mode, dark mode), opacity
  [-4.1, 1.7, -4.5, 0.5, 0xffb86b, 0x9fb2ff, 0.2],
  [3.9, 2.0, -5.5, 0.62, 0xb4a8ff, 0xffc98a, 0.18],
  [-1.4, 2.4, -6.5, 0.42, 0xffd36b, 0xb4a8ff, 0.16],
  [2.2, 1.4, -4.0, 0.34, 0xff9ec2, 0xffd9a0, 0.15],
  [4.8, 0.5, -3.0, 0.3, 0x9fe6d6, 0x9fe6d6, 0.14],
  [-4.8, 0.4, -2.5, 0.32, 0xffd9a0, 0xb4a8ff, 0.14],
  [-3.2, 0.15, 4.2, 0.5, 0xffc7a0, 0xffc98a, 0.1],
  [3.6, 1.3, 4.6, 0.75, 0xc9c2ff, 0x9fb2ff, 0.085],
  [-4.3, 1.7, 4.8, 0.6, 0xffe0a0, 0xffc98a, 0.085],
];
const discs = DISCS.map(([x, y, z, radius, light, dark, opacity], i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({
    map: discTexture, transparent: true, opacity, depthWrite: false, toneMapped: false, color: DARK ? dark : light, blending: DARK ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));

  m.position.set(x, y, z);
  m.userData = { x, y, phase: i * 1.7 };
  m.renderOrder = 5;
  scene.add(m);

  return m;
});

// ---- the characters
const loader = new GLTFLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
// the artist originals: glb/Rho.glb and glb/Liruf.glb are torn at the vest and the belly, the originals are clean
const [rho, liruf] = await Promise.all(['Rho', 'Liruf'].map((name) => load(`/glb/originals/${name}.glb`)));

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** A character in a holder that is turned outward; the acting functions set every bone each frame. */
class Rig {
  constructor(gltf, { height, x, z, yaw, env = 1 }) {
    this.model = gltf.scene;
    this.bones = new Map();
    this.model.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });
    this.rest = new Map([...this.bones].map(([name, bone]) => [name, { q: bone.quaternion.clone(), p: bone.position.clone() }]));

    // standing height first, in the rest pose, so the scale is the character's (rule 1 in CHARACTER-COMPOSITIONS)
    const box = new THREE.Box3().setFromObject(this.model);
    const k = height / (box.max.y - box.min.y);

    this.model.scale.multiplyScalar(k);
    this.model.updateMatrixWorld(true);

    const fitted = new THREE.Box3().setFromObject(this.model);

    this.model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
    this.holder = new THREE.Group();
    this.holder.add(this.model);
    this.holder.rotation.y = yaw;
    this.holder.position.set(x, 0, z);
    this.base = { x, z };
    scene.add(this.holder);
    this.holder.updateMatrixWorld(true);
    this.frame = new THREE.Quaternion();
    this.holder.getWorldQuaternion(this.frame);
    this.frameInverse = this.frame.clone().invert();
    this.model.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;

      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;

      if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();

      if (o.material) o.material.envMapIntensity = env;
    });
  }

  reset() {
    for (const [name, bone] of this.bones) {
      const rest = this.rest.get(name);

      bone.quaternion.copy(rest.q);
      bone.position.copy(rest.p);
    }
  }

  /** Turns a bone by `angle` about an axis of the character's frame, on top of everything above it. */
  rot(name, axis, angle) {
    const bone = this.bones.get(name);

    if (!bone || !angle) return;

    bone.parent.updateWorldMatrix(true, false);

    const parent = new THREE.Quaternion();

    bone.parent.getWorldQuaternion(parent);
    parent.premultiply(this.frameInverse);
    bone.quaternion.copy(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent).multiply(bone.quaternion));
  }

  /** The lowest point of the posed body, in world units, so the character can be set down on the floor. */
  floor() {
    this.model.updateMatrixWorld(true);

    return new THREE.Box3().setFromObject(this.model, true).min.y;
  }
}

// ---- animation curves
/**
 * A looping curve through `keys` ([second, value] pairs, the last at LOOP with the first's value): it eases in and out
 * of every key, so each move starts and ends softly. `lag` reads the curve that many seconds late, which is how the
 * head, the arms and the ears follow the body (overlapping action).
 */
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

const FLAT = [[0, 0], [LOOP, 0]];

/*
 * What each character does in the 12 seconds. Every channel is a curve of offsets added to the kneeling pose below:
 *   body   lean of the spine (positive is forward and down); neck and head are the head's own pitch (down), yaw (turn,
 *          positive is to the character's left) and roll;
 *   shrug  both shoulders up (positive);
 *   wipeR  a hand raised toward the face, 0 to 1;
 *   tap    a hand reaching down and forward to the floor, 0 to 1.
 * The breath and the small drift of a moving hold are added on top in the pose functions.
 */
const ACT = {
  rho: {
    body: [[0, 0], [4.3, 0], [5.1, -0.07], [6.4, 0.1], [8.5, 0.05], [LOOP, 0]],
    shrug: [[0, 0], [4.3, 0], [5.1, 0.12], [6.2, -0.05], [8, 0], [LOOP, 0]],
    yaw: [[0, 0], [1.6, -0.42], [2.6, -0.42], [4.4, 0.3], [5.2, 0.3], [6.4, 0], [8.8, 0], [9.8, -0.18], [11, 0.08], [LOOP, 0]],
    pitch: [[0, 0], [4.8, 0], [5.8, 0.16], [7.6, 0.16], [9, 0.02], [LOOP, 0]],
    roll: [[0, 0], [1.6, 0.05], [4.4, -0.05], [7, 0.06], [LOOP, 0]],
    wipeR: [[0, 0], [7.2, 0], [8.1, 1], [9.1, 1], [9.9, 0], [LOOP, 0]],
  },
  liruf: {
    body: [[0, 0], [3.2, 0], [4.0, 0.06], [5.6, 0.02], [7.4, -0.05], [8.6, 0.14], [10.4, 0.1], [LOOP, 0]],
    shrug: [[0, 0], [7.4, 0], [8.0, 0.1], [9, 0], [LOOP, 0]],
    yaw: [[0, 0], [2, 0.25], [3.4, 0.25], [5.5, -0.3], [7, -0.3], [9, 0.1], [LOOP, 0]],
    pitch: [[0, 0], [3.6, 0], [4.4, 0.12], [6.2, 0.05], [8.6, 0.2], [LOOP, 0]],
    roll: [[0, 0], [2, -0.06], [5.5, 0.08], [LOOP, 0]],
    tap: [[0, 0], [3.5, 0], [3.95, 1], [4.3, 0.1], [4.75, 1], [5.2, 0], [LOOP, 0]],
  },
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/*
 * Kneeling, sitting back a little: the thighs slope forward and down, the shins fold back along the floor, the back is
 * rounded and the head hangs. The knee bends 110 degrees, not the 170 of a full heel-sit, so the skin never pinches
 * (a deeper fold collapses these meshes). `tuck` brings the arms in to the body, `arm` and `fore` rest the hands on the
 * thighs; the acting curves move them from there.
 */
function kneelBiped(rig, t, o, act) {
  const w = (t / LOOP) * TAU;
  const breath = Math.sin(w * 4 + o.phase) * 0.012;
  const drift = Math.sin(w * 2 + o.phase) * 0.02;
  const body = curve(act.body, t);
  const lead = (keys, lag) => curve(keys, t, lag);
  const wipeR = act.wipeR ? curve(act.wipeR, t, 0.18) : 0;
  const tap = act.tap ? curve(act.tap, t, 0.1) : 0;
  const shrug = act.shrug ? curve(act.shrug, t, 0.06) : 0;

  rig.reset();
  rig.rot('LeftUpLeg', X, -o.thigh);
  rig.rot('RightUpLeg', X, -o.thigh);
  rig.rot('LeftUpLeg', Y, -o.spread);
  rig.rot('RightUpLeg', Y, o.spread);
  rig.rot('LeftLeg', X, o.knee);
  rig.rot('RightLeg', X, o.knee);
  rig.rot('LeftFoot', X, o.foot);
  rig.rot('RightFoot', X, o.foot);
  rig.rot('Spine02', X, o.lean * 0.4 + body * 0.4 + breath);
  rig.rot('Spine01', X, o.lean * 0.35 + body * 0.35 + breath);
  rig.rot('Spine', X, o.lean * 0.3 + body * 0.25 + breath * 0.5);
  rig.rot('neck', X, o.neck + lead(act.pitch, 0.1) * 0.35 + drift * 0.3);
  rig.rot('Head', X, o.look + lead(act.pitch, 0.14) * 0.65 + drift);
  rig.rot('Head', Z, o.tilt + lead(act.roll, 0.12));
  rig.rot('Head', Y, o.turn + lead(act.yaw, 0.12));
  rig.rot('LeftShoulder', Z, -0.08 - shrug);
  rig.rot('RightShoulder', Z, 0.08 + shrug);
  rig.rot('LeftArm', Z, -o.tuck);
  rig.rot('RightArm', Z, o.tuck);
  rig.rot('LeftArm', X, o.arm);
  rig.rot('RightArm', X, o.arm + wipeR * o.wipe.arm + tap * o.tapArm);
  rig.rot('LeftForeArm', X, o.fore);
  rig.rot('RightForeArm', X, o.fore + wipeR * o.wipe.fore + tap * o.tapFore);
}

// Back to back: each faces outward from one middle point, turned a little toward the camera, close enough that the
// backs touch. `angle` is where each faces, in degrees from straight at the camera.
const R = 0.47;
const at = (angle, spec) => {
  const a = (angle * Math.PI) / 180;

  return { ...spec, x: Math.sin(a) * R, z: Math.cos(a) * R, yaw: a };
};
const cast = {
  rho: new Rig(rho, at(-38, { height: 1.5 })),
  liruf: new Rig(liruf, at(36, { height: 1.3 })),
};

const KNEEL = { thigh: 0.35, knee: 1.92, foot: -0.6, spread: 0.05, turn: 0, tapArm: 0, tapFore: 0, wipe: { arm: 0, fore: 0 } };
const POSES = {
  rho: { ...KNEEL, lean: 0.22, neck: 0.1, look: 0.28, tilt: -0.1, tuck: 0.55, arm: -0.45, fore: -0.7, phase: 0.0, wipe: { arm: -1.45, fore: -1.7 } },
  liruf: { ...KNEEL, lean: 0.42, neck: 0.4, look: 0.72, tilt: 0.08, tuck: 0.3, arm: -0.3, fore: -0.4, phase: 2.2, tapArm: -0.55, tapFore: 0.2 },
};

function pose(t) {
  for (const name of ['rho', 'liruf']) kneelBiped(cast[name], t, POSES[name], ACT[name]);
}

pose(0);

// debug: show one character (`?only=rho`), from the side (`&cam=side`), alone and close (`&close`)
const ONLY = params.get('only');

if (ONLY) for (const [name, rig] of Object.entries(cast)) rig.holder.visible = name === ONLY;

// set each character down on the floor, measured once at the start of the loop
for (const rig of Object.values(cast)) rig.holder.position.y = -rig.floor();

for (const rig of Object.values(cast)) contactShadow(rig.base.x, rig.base.z, 0.8, 0.52);

// ---- time
const out = document.createElement('canvas');

out.width = OUT_W;
out.height = OUT_H;

const outContext = out.getContext('2d');

window.__render = (time) => {
  const t = time % LOOP;
  const w = (t / LOOP) * TAU;

  pose(t);

  // the camera drifts a little and comes back, a slow push and pull (whole cycles, so the loop is seamless)
  const push = 0.5 - 0.5 * Math.cos(w);

  camera.position.set(CAMERA_AT.x + Math.sin(w) * 0.12, CAMERA_AT.y + Math.sin(w * 2) * 0.02, CAMERA_AT.z - push * 0.3);
  camera.lookAt(LOOK.x + Math.sin(w) * 0.03, LOOK.y, LOOK.z);

  if (SIDE) {
    camera.position.set(7.6, 1.5, -0.3);
    camera.lookAt(0, 0.6, -0.3);
  }

  if (ONLY && params.has('close')) {
    const target = cast[ONLY].holder.position;

    camera.position.set(target.x + (SIDE ? 3.2 : 0), 0.9, target.z + (SIDE ? 0 : 3.2));
    camera.lookAt(target.x, 0.5, target.z);
  }

  // specks fall through the beam, sway and twinkle
  for (const s of specks) {
    const { x, z, y0, fall, size, sway, phase, twinkle } = s.userData;
    const y = 4.2 - ((y0 + (1 - t / LOOP) * 4.2 * fall) % 4.2);

    s.position.set(x + Math.sin(w * 2 + phase) * sway, y - 0.1, z);
    s.quaternion.copy(camera.quaternion);
    s.scale.setScalar(size * (0.8 + 0.4 * Math.sin(w * twinkle + phase)));
    s.visible = y > 0.05;
  }

  for (const d of discs) {
    const { x, y, phase } = d.userData;

    d.position.x = x + Math.sin(w + phase) * 0.12;
    d.position.y = y + Math.cos(w + phase) * 0.06;
    d.quaternion.copy(camera.quaternion);
  }

  renderer.render(scene, camera);
  outContext.imageSmoothingQuality = 'high';
  outContext.drawImage(canvas, 0, 0, OUT_W, OUT_H);

  // the frame fades to the page's own color along all four borders, so no edge of the picture is ever visible
  const edge = (x0, y0, x1, y1, from, to) => {
    const g = outContext.createLinearGradient(x0, y0, x1, y1);

    g.addColorStop(0, BG_CSS);
    g.addColorStop(1, BG_CSS + '00');
    outContext.fillStyle = g;
    outContext.fillRect(from[0], from[1], to[0], to[1]);
  };
  const bandX = OUT_W * 0.07;
  const bandY = OUT_H * 0.16;

  edge(0, 0, 0, bandY, [0, 0], [OUT_W, bandY]);
  edge(0, OUT_H, 0, OUT_H - bandY, [0, OUT_H - bandY], [OUT_W, bandY]);
  edge(0, 0, bandX, 0, [0, 0], [bandX, OUT_H]);
  edge(OUT_W, 0, OUT_W - bandX, 0, [OUT_W - bandX, 0], [bandX, OUT_H]);

  return true;
};

if (DEBUG) log('ready');

window.__frame = (type = 'image/jpeg', quality = 0.95) => out.toDataURL(type, quality);
document.body.dataset.ready = '1';
