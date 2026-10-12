// The loading window's runner: one character running in place on a transparent ground, for a sprite sheet.
// `window.__render(u)` draws the point `u` (0 to 1) of one seamless stride; `window.__frame()` returns a PNG with alpha.
// Rendered by render-loading.mjs; it is not part of the application bundle. Where the sheets go and why:
// docs/engineering/FRONTEND-GUIDE.md ("The loading window").
//
//   ?c=rho|zara|liruf|dina   the character
//   &mode=dark               the dark-window lighting (a stronger edge light; the figure also gets a faint halo, added by loading-sheets.py)
//   &yaw=1.15                how far the character is turned from facing the camera, in radians (1.57 is a pure profile)
//
// The model files: Rho, Liruf and Zara are loaded from glb/originals/, because glb/Rho.glb and glb/Liruf.glb are torn in the
// rest pose (docs/design/CHARACTER-POSES.md); Dina has no original. There is no cast shadow and no floor: the runner stands on
// a bar in the window, so a shadow would only dirty it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const NAME = params.get('c') ?? 'rho';
const DARK = params.get('mode') === 'dark';
const YAW = Number(params.get('yaw') ?? 1.15);
const W = 960;
const H = 576;
const TAU = Math.PI * 2;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });

renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = DARK ? 0.85 : 0.5;

// a long lens, so the figure is not distorted
const camera = new THREE.PerspectiveCamera(12.5, W / H, 0.1, 60);

camera.position.set(0.15, 0.8, 8.4);
camera.lookAt(0.05, 0.62, 0);

scene.add(new THREE.HemisphereLight(0xffffff, DARK ? 0x7a7fe8 : 0xc9ccff, DARK ? 1.15 : 0.8));

const key = new THREE.DirectionalLight(0xfff0dc, 2.3);

key.position.set(-2.5, 5, 5);
scene.add(key);

const rim = new THREE.DirectionalLight(0x9fb2ff, DARK ? 4.2 : 1.6);

rim.position.set(3.5, 3, -4);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xffd7b5, 0.8);

fill.position.set(3, 1.5, 5);
scene.add(fill);

// dark window: a second edge light from behind-left, so dark clothes and hair keep an outline
if (DARK) {
  const rim2 = new THREE.DirectionalLight(0xffd0a0, 3.0);

  rim2.position.set(-3.5, 2.5, -3.5);
  scene.add(rim2);
}

const loader = new GLTFLoader();
const folder = NAME === 'dina' ? '' : 'originals/';
const gltf = await new Promise((resolve, reject) => loader.load(`/glb/${folder}${NAME[0].toUpperCase()}${NAME.slice(1)}.glb`, resolve, undefined, reject));

// standing height, so the four read at the sizes the product gives them (Dina is a large animal)
const HEIGHT = { rho: 1.3, zara: 1.26, liruf: 1.16, dina: 1.3 }[NAME];
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const model = gltf.scene;
const bones = new Map();

model.traverse((o) => { if (o.isBone) bones.set(o.name, o); });

const rest = new Map([...bones].map(([name, bone]) => [name, { q: bone.quaternion.clone(), p: bone.position.clone() }]));
const box0 = new THREE.Box3().setFromObject(model);

model.scale.multiplyScalar(HEIGHT / (box0.max.y - box0.min.y));
model.updateMatrixWorld(true);

const fitted = new THREE.Box3().setFromObject(model);

model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);

const holder = new THREE.Group();

holder.add(model);
holder.rotation.y = YAW;
scene.add(holder);
holder.updateMatrixWorld(true);

const frameInverse = holder.getWorldQuaternion(new THREE.Quaternion()).invert();

model.traverse((o) => {
  if (!(o.isMesh || o.isSkinnedMesh)) return;

  o.frustumCulled = false;

  if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
});

function reset() {
  for (const [name, bone] of bones) {
    bone.quaternion.copy(rest.get(name).q);
    bone.position.copy(rest.get(name).p);
  }
}

/** Turns a bone about an axis of the character's own frame, on top of everything above it. */
function rot(name, axis, angle) {
  const bone = bones.get(name);

  if (!bone || !angle) return;

  bone.parent.updateWorldMatrix(true, false);

  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(frameInverse);

  bone.quaternion.copy(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent).multiply(bone.quaternion));
}

function floor() {
  model.updateMatrixWorld(true);

  return new THREE.Box3().setFromObject(model, true).min.y;
}

/*
 * One stride of a biped, in the character's frame (x left, y up, z forward; a thigh turned by a negative angle swings forward,
 * an arm turned by a negative angle swings forward). The legs are half a cycle apart, the arms swing against the legs, the
 * knee folds most while the leg swings through, the back leans forward and the head stays level. Returns the bounce: the body
 * is highest twice per cycle, when the legs are apart.
 */
function runBiped(u) {
  const p = u * TAU;
  const s = Math.sin(p);
  const c = Math.cos(p);

  reset();

  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    const sp = sign * s;
    const cp = sign * c;

    rot(`${side}UpLeg`, X, -(0.34 + 0.95 * sp));
    rot(`${side}Leg`, X, 0.3 + 1.25 * Math.max(0, cp) + 0.25 * Math.max(0, -sp));
    rot(`${side}Foot`, X, 0.1 - 0.35 * sp);
    rot(`${side}Arm`, X, -0.25 + 0.7 * sp);
    rot(`${side}Arm`, Z, sign * -0.45);
    rot(`${side}ForeArm`, X, -1.25 - 0.25 * sp);
  }

  rot('Spine02', X, 0.16);
  rot('Spine01', X, 0.13);
  rot('Spine', X, 0.1);
  rot('Head', X, -0.12 + 0.03 * Math.sin(2 * p));
  rot('Head', Y, 0.05 * s);

  return 0.07 * (0.5 - 0.5 * Math.cos(2 * p));
}

// Dina plays her own clip, a walk cycle of one second, stepped through once per stride.
const mixer = NAME === 'dina' ? new THREE.AnimationMixer(model) : null;
const clip = gltf.animations[0];

if (mixer) mixer.clipAction(clip).play();

function trot(u) {
  mixer.setTime(u * clip.duration);

  return 0;
}

// Center the body in the frame: measured over the cycle once, then fixed (the sprite never slides around).
{
  let center = 0;

  for (const u of [0, 0.25, 0.5, 0.75]) {
    if (mixer) trot(u); else runBiped(u);

    model.updateMatrixWorld(true);
    center += new THREE.Box3().setFromObject(model, true).getCenter(new THREE.Vector3()).x / 4;
  }

  holder.position.x = -center;
}

const out = document.createElement('canvas');

out.width = W;
out.height = H;

const context = out.getContext('2d');

window.__render = (u) => {
  const bounce = mixer ? trot(u) : runBiped(u);

  model.updateMatrixWorld(true);
  holder.position.y = -floor() + bounce;
  renderer.render(scene, camera);
  context.clearRect(0, 0, W, H);
  context.drawImage(canvas, 0, 0);

  return true;
};

window.__frame = () => out.toDataURL('image/png');
document.body.dataset.ready = '1';
