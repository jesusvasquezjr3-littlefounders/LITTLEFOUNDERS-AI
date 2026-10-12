// The picture at the top of every email: the four characters standing close together, seen from above, each with
// only the head turned up to look at the reader. A still with a transparent background, not a video (mail programs do
// not play video), drawn by
// render-email.mjs; it is not part of the application bundle. Composition rules: docs/design/CHARACTER-COMPOSITIONS.md.
//
// The body of each character stays in its own rest pose. The look up is shared between the neck and the head, as an
// offset from each bone's rest rotation, in the character's own frame (x left, y up, z forward).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const number = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);
const ONLY = params.get('only');

const OUT_W = 1040; // shown 520 px wide at most, so this is 2x
const OUT_H = 640;
const SCALE = 2; // rendered at twice the delivered size and reduced

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });

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
scene.environmentIntensity = 0.5;

// ---- the camera: above the group and in front of it, looking down
const PITCH = (number('pitch', 60) * Math.PI) / 180; // how far below the horizon the camera looks
const DISTANCE = number('dist', 7.3);
const LOOK = new THREE.Vector3(number('lx', 0.14), number('ly', 0.72), number('lz', 0.12));
const camera = new THREE.PerspectiveCamera(number('fov', 22), OUT_W / OUT_H, 0.1, 80);

camera.position.set(LOOK.x, LOOK.y + Math.sin(PITCH) * DISTANCE, LOOK.z + Math.cos(PITCH) * DISTANCE);
camera.lookAt(LOOK);

if (params.get('cam') === 'side') {
  camera.position.set(8.5, 1.2, 0);
  camera.lookAt(0, 0.8, 0);
}

if (params.get('cam') === 'front') {
  camera.position.set(0, 1.2, 8.5);
  camera.lookAt(0, 0.8, 0);
}

// ---- light: one bright rig, from above and in front, so the raised faces are the brightest thing in the picture
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd2ff, 0.95));

const key = new THREE.DirectionalLight(0xfff3e2, 2.5);

key.position.set(-0.6, 10, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
key.shadow.camera.near = 1;
key.shadow.camera.far = 24;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
key.shadow.radius = 9;
key.shadow.blurSamples = 20;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe3ff, 0.9);

fill.position.set(4, 5, 4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xb9c0ff, 1.1);

rim.position.set(1.5, 4, -5);
scene.add(rim);

// ---- there is no floor and no background: the picture is transparent and sits on the email's own color, light or
// dark, the way the scenes sit on the page in the product. Only shadows and a pool of light are drawn under the group,
// and both fade to nothing well inside the frame, so the picture has no edge anywhere.
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16, color: 0x3d32b8 }));

catcher.rotation.x = -Math.PI / 2;
catcher.receiveShadow = true;
catcher.material.depthWrite = false;
catcher.renderOrder = 1;
scene.add(catcher);

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

// the pool of light under the group (the brand's indigo, as in the product's scenes), and a darker spot under each
// character where it touches the floor
const glow = radial([[0, 'rgba(132,124,255,0.30)'], [0.45, 'rgba(132,124,255,0.12)'], [0.8, 'rgba(132,124,255,0.02)'], [1, 'rgba(132,124,255,0)']]);
const contact = radial([[0, 'rgba(50,38,150,0.34)'], [0.55, 'rgba(50,38,150,0.12)'], [1, 'rgba(50,38,150,0)']]);

function disc(texture, x, z, rx, rz, y, order) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));

  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(rx, rz, 1);
  mesh.position.set(x, y, z);
  mesh.renderOrder = order;
  scene.add(mesh);
}

disc(glow, 0.14, 0.2, 2.9, 1.5, 0.001, 0);

// ---- the characters
const loader = new GLTFLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
// the artist originals for the three bipeds (glb/Rho.glb and glb/Liruf.glb are torn); Dina has no original
const [rho, zara, liruf, dina] = await Promise.all(['originals/Rho', 'originals/Zara', 'originals/Liruf', 'Dina'].map((name) => load(`/glb/${name}.glb`)));

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** A character at its standing height, turned by `yaw`; `rot` turns one bone on top of its rest pose. */
class Rig {
  constructor(gltf, { height, x, z, yaw }) {
    this.model = gltf.scene;
    this.bones = new Map();
    this.model.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });

    // standing height in the rest pose, so the scale is the character's (rule 1 in CHARACTER-COMPOSITIONS)
    const box = new THREE.Box3().setFromObject(this.model);
    const k = height / (box.max.y - box.min.y);

    this.model.scale.multiplyScalar(k);
    this.model.updateMatrixWorld(true);

    const fitted = new THREE.Box3().setFromObject(this.model);

    this.model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
    this.footprint = { x: (fitted.max.x - fitted.min.x) / 2, z: (fitted.max.z - fitted.min.z) / 2 };
    this.holder = new THREE.Group();
    this.holder.add(this.model);
    this.holder.rotation.y = yaw;
    this.holder.position.set(x, 0, z);
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
  }

  /** Turns a bone by `angle` about an axis of the character's frame, on top of everything above it. */
  rot(name, axis, angle) {
    const bone = this.bones.get(name);

    if (!bone || !angle) return;

    bone.parent.updateWorldMatrix(true, false);

    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.frameInverse);

    bone.quaternion.copy(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent).multiply(bone.quaternion));
  }
}

/*
 * Where each one stands: a shallow arc that opens toward the reader, close enough that they read as one group and far
 * enough that nobody touches anybody. Liruf and Dina take the ends, a step back; Zara and Rho the middle. Every body
 * is turned a little toward the middle. Dina is a large animal: she stands at the end, where her long body and her
 * tail have room.
 * `up` is how far the face is raised (radians), `turn` and `tilt` keep the four heads from being copies of each other.
 */
const CAST = {
  liruf: { gltf: liruf, height: 1.4, x: -1.42, z: -0.2, yaw: 0.5, neck: 'neck', head: 'Head', up: 0.95, turn: 0.12, tilt: 0.04 },
  zara: { gltf: zara, height: 1.56, x: -0.5, z: 0.62, yaw: 0.16, neck: 'neck', head: 'Head', up: 0.95, turn: 0.05, tilt: 0.05 },
  rho: { gltf: rho, height: 1.4, x: 0.5, z: 0.7, yaw: -0.16, neck: 'neck', head: 'Head', up: 0.95, turn: -0.04, tilt: -0.05 },
  dina: { gltf: dina, height: 1.5, x: 1.6, z: -0.4, yaw: -0.85, neck: 'chest', head: 'head', up: 0.8, turn: 0.2, tilt: -0.04, neckShare: 0.12 },
};

for (const [name, spec] of Object.entries(CAST)) {
  const rig = new Rig(spec.gltf, spec);
  const share = spec.neckShare ?? 0.38;
  const up = number(`up-${name}`, spec.up);

  rig.rot(spec.neck, X, -up * share);
  rig.rot(spec.head, X, -up * (1 - share));
  rig.rot(spec.head, Y, spec.turn);
  rig.rot(spec.head, Z, spec.tilt);
  rig.holder.visible = !ONLY || ONLY === name;
  disc(contact, spec.x, spec.z, Math.max(0.42, rig.footprint.x * 1.05), Math.max(0.36, rig.footprint.z * 0.95), 0.004, 2);
}

// ---- the frame
const out = document.createElement('canvas');

out.width = OUT_W;
out.height = OUT_H;

const outContext = out.getContext('2d');
const BAND_X = 40; // the characters stay clear of these bands
const BAND_Y = 36;

window.__render = () => {
  renderer.render(scene, camera);
  outContext.clearRect(0, 0, OUT_W, OUT_H);
  outContext.imageSmoothingQuality = 'high';
  outContext.drawImage(canvas, 0, 0, OUT_W, OUT_H);

  // whatever shadow or light is left near a border fades to nothing before it, so no edge of the picture ever shows
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

window.__frame = (type = 'image/jpeg', quality = 0.9) => out.toDataURL(type, quality);
document.body.dataset.ready = '1';
