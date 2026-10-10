// The landing's problem section: Liruf waters a seed with a can and a sprout grows while Dina watches it, glad.
// Rendered frame by frame by render-scene.mjs (`window.__render(t)` draws second `t`); it is not part of the
// application bundle. Composition rules: docs/design/CHARACTER-COMPOSITIONS.md.
//
// Staging (the page shows this frame whole, so everything is inside it and nothing touches the edge):
//   the two characters stand on the left and right thirds, turned toward the sprout and a little toward the camera,
//   the sprout is the center of interest on the middle line, the camera is a long lens at eye height of the sprout.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'dark' ? 'dark' : 'light';
const DEBUG = params.has('debug');
const log = (...parts) => { (window.__log ??= []).push(parts.join(' ')); };
const LOOP = 12;
const DARK = MODE === 'dark';

const OUT_W = 1500;
const OUT_H = 900;
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
scene.environmentIntensity = DARK ? 0.4 : 0.5;

const camera = new THREE.PerspectiveCamera(25, OUT_W / OUT_H, 0.1, 60);

camera.position.set(0.1, 1.95, 5.8);
camera.lookAt(0.1, 0.7, 0.1);

// ---- light: the same bright rig in both modes, as the landing does
scene.add(new THREE.HemisphereLight(0xffffff, DARK ? 0x5a5fd0 : 0xc9ccff, DARK ? 0.55 : 0.8));

const key = new THREE.DirectionalLight(0xfff0dc, 2.2);

key.position.set(-3.2, 5.2, 5.0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4.5;
key.shadow.camera.right = 4.5;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -3;
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0004;
key.shadow.radius = 5;
scene.add(key);

const rim = new THREE.DirectionalLight(0x9fb2ff, DARK ? 2.4 : 1.5);

rim.position.set(3.5, 3.0, -4.0);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xffd7b5, 0.9);

fill.position.set(4.0, 1.5, 5.0);
scene.add(fill);

// the sprout lights its own surroundings a little, warm
const glow = new THREE.PointLight(0xffe08a, 0, 3.2, 1.6);

glow.position.set(0.1, 0.55, 0.5);
scene.add(glow);

// ---- the ground: a soft pool of light and a shadow catcher; both fade to nothing, so the scene has no floor edge
function radial(stops) {
  const size = 512;
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

const pool = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
  map: radial(DARK
    ? [[0, 'rgba(120,112,255,0.62)'], [0.4, 'rgba(100,92,235,0.28)'], [0.75, 'rgba(90,82,225,0.08)'], [1, 'rgba(90,82,225,0)']]
    : [[0, 'rgba(130,120,255,0.42)'], [0.45, 'rgba(130,120,255,0.18)'], [0.8, 'rgba(130,120,255,0.05)'], [1, 'rgba(130,120,255,0)']]),
  transparent: true, depthWrite: false, toneMapped: false,
}));

pool.rotation.x = -Math.PI / 2;
pool.scale.set(4.6, 1.9, 1);
pool.position.set(0.05, 0.002, 0.15);
scene.add(pool);

const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.ShadowMaterial({ opacity: DARK ? 0.55 : 0.32, color: DARK ? 0x000010 : 0x2a1f6e }));

catcher.material.depthWrite = false;
catcher.renderOrder = 2;
pool.renderOrder = 1;
catcher.rotation.x = -Math.PI / 2;
catcher.position.y = 0.004;
catcher.receiveShadow = true;
scene.add(catcher);

const contact = radial([[0, DARK ? 'rgba(0,0,12,0.7)' : 'rgba(40,30,120,0.45)'], [0.55, DARK ? 'rgba(0,0,12,0.28)' : 'rgba(40,30,120,0.16)'], [1, 'rgba(0,0,0,0)']]);

function contactShadow(x, z, rx, rz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: contact, transparent: true, depthWrite: false, toneMapped: false }));

  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.set(x, 0.006, z);
  m.renderOrder = 2;
  scene.add(m);
}

// ---- distant lights: soft out-of-focus dots behind the scene give the depth of a lens, kept few and apart
{
  const dot = radial([[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  const spots = [[-3.6, 2.5, -5, 0.55, 0xffc98a], [-2.2, 1.3, -6, 0.4, 0x9fb2ff], [2.4, 2.8, -6, 0.5, 0xffd9a0], [3.8, 1.5, -5, 0.45, 0xb4a8ff], [0.2, 3.1, -7, 0.35, 0xffe9b8], [-4.2, 0.6, -5, 0.35, 0x9fe6d6]];

  for (const [x, y, z, size, color] of DARK ? spots : []) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshBasicMaterial({ map: dot, color, transparent: true, opacity: DARK ? 0.28 : 0.22, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));

    m.position.set(x, y, z);
    scene.add(m);
  }
}

// ---- the soil and the sprout
const SOIL_X = 0.1;
const SOIL_Z = 0.25;
const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.95 });
const soil = new THREE.Group();

{
  const profile = [];

  for (let i = 0; i <= 24; i++) {
    const t = i / 24;

    profile.push(new THREE.Vector2(0.52 * Math.sqrt(1 - t * t) + 0.001, 0.2 * Math.pow(t, 0.75) - 0.0));
  }

  // a dome of earth: radius 0.52 at the ground, height 0.2 at the middle
  const dome = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * (Math.PI / 2); return new THREE.Vector2(0.42 * Math.cos(a) + 0.0001, 0.17 * Math.sin(a)); }), 56), soilMaterial);

  dome.castShadow = true;
  dome.receiveShadow = true;
  soil.add(dome);

  const position = dome.geometry.attributes.position;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump = 0.012 * Math.sin(x * 31 + z * 17) * Math.sin(z * 23 - x * 11);

    position.setXYZ(i, x, y > 0.001 ? y + lump : y, z);
  }

  dome.geometry.computeVertexNormals();

  // a lighter rim of crumbs and a wet dark patch where the water lands
  const crumbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8c5732, roughness: 1 }), 18);
  const m4 = new THREE.Matrix4();

  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
    const r = 0.4 + (i % 2) * 0.05;
    const s = 0.018 + (i % 4) * 0.006;

    m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.012, Math.sin(a) * r * 0.9), new THREE.Quaternion(), new THREE.Vector3(s * 1.4, s, s * 1.2));
    crumbs.setMatrixAt(i, m4);
  }

  soil.add(crumbs);
}

soil.position.set(SOIL_X, 0, SOIL_Z);
scene.add(soil);
contactShadow(SOIL_X, SOIL_Z, 0.58, 0.38);

const wet = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(50,28,12,0.9)'], [0.6, 'rgba(50,28,12,0.5)'], [1, 'rgba(50,28,12,0)']]), transparent: true, opacity: 0, depthWrite: false }));

wet.rotation.x = -Math.PI / 2;
wet.position.set(SOIL_X, 0.165, SOIL_Z);
wet.scale.set(1, 0.8, 1);
scene.add(wet);

// the sprout: a curved stem and three pairs of leaves that unfold as it grows
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2fbf8f, roughness: 0.5, emissive: 0x0b5a44, emissiveIntensity: 0.25, side: THREE.DoubleSide });
const leafMaterialDark = new THREE.MeshStandardMaterial({ color: 0x1fa07a, roughness: 0.5, emissive: 0x08432f, emissiveIntensity: 0.25, side: THREE.DoubleSide });
const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4ccf93, roughness: 0.55 });
const plant = new THREE.Group();

plant.position.set(SOIL_X, 0.16, SOIL_Z);
scene.add(plant);

const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.2, 0), new THREE.Vector3(-0.015, 0.42, 0.01), new THREE.Vector3(0.01, 0.66, 0)]);
const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 24, 0.028, 12), stemMaterial);

stem.castShadow = true;
plant.add(stem);

function leafGeometry(length, width) {
  const shape = new THREE.Shape();

  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.55, length * 0.12, width * 0.6, length * 0.62, 0, length);
  shape.bezierCurveTo(-width * 0.6, length * 0.62, -width * 0.55, length * 0.12, 0, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 18 });
  const p = geometry.attributes.position;

  // a gentle fold along the middle and a droop toward the tip
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);

    p.setZ(i, p.getZ(i) + Math.abs(x) * 0.5 - y * y * 0.18);
  }

  geometry.computeVertexNormals();

  return geometry;
}

const leaves = [];
const LEAF_SPECS = [
  // height on the stem, yaw, length, width, start of its growth (0 to 1), droop
  [0.30, 0.6, 0.34, 0.2, 0.18],
  [0.30, 0.6 + Math.PI, 0.34, 0.2, 0.18],
  [0.5, 1.9, 0.42, 0.25, 0.34],
  [0.5, 1.9 + Math.PI, 0.42, 0.25, 0.34],
  [0.66, 0.25, 0.3, 0.2, 0.55],
  [0.66, 0.25 + Math.PI * 0.62, 0.3, 0.2, 0.55],
  [0.66, 0.25 - Math.PI * 0.62, 0.3, 0.2, 0.55],
];

for (const [height, yaw, length, width, start] of LEAF_SPECS) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(leafGeometry(length, width), start > 0.5 ? leafMaterialDark : leafMaterial);

  mesh.rotation.x = -Math.PI / 2 + 0.2;
  mesh.castShadow = true;
  pivot.add(mesh);
  pivot.position.copy(stemCurve.getPoint(Math.min(1, height / 0.66 * 0.99)));
  pivot.rotation.y = yaw;
  pivot.userData = { yaw, start, length };
  plant.add(pivot);
  leaves.push(pivot);
}

// a small bud at the top
const bud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xffb300, emissiveIntensity: 0.9, roughness: 0.35 }));

bud.position.copy(stemCurve.getPoint(1));
plant.add(bud);

// ---- water drops from the can's spout to the soil, in a fixed arc
const DROPS = 16;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 14, 12), new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.9, emissive: 0x4aa7ff, emissiveIntensity: 0.35 }), DROPS);

drops.frustumCulled = false;
scene.add(drops);

// ---- sparkles around the sprout when it has grown: soft four-point stars that rise and fade, never overlapping the characters
const spark = (() => {
  const c = document.createElement('canvas');

  c.width = c.height = 128;

  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);

  grad.addColorStop(0, 'rgba(255,248,200,1)');
  grad.addColorStop(0.25, 'rgba(255,224,130,0.55)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,250,220,0.9)';
  g.beginPath();
  g.moveTo(64, 4); g.lineTo(70, 58); g.lineTo(124, 64); g.lineTo(70, 70); g.lineTo(64, 124); g.lineTo(58, 70); g.lineTo(4, 64); g.lineTo(58, 58); g.closePath();
  g.fill();

  const t = new THREE.CanvasTexture(c);

  t.colorSpace = THREE.SRGBColorSpace;

  return t;
})();
const SPARKS = 12;
const sparks = [];

for (let i = 0; i < SPARKS; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: spark, transparent: true, opacity: 0, depthWrite: false, blending: DARK ? THREE.AdditiveBlending : THREE.NormalBlending, color: DARK ? 0xffffff : 0xffb21a, toneMapped: false }));

  m.userData = { angle: (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.4, radius: 0.2 + (i % 4) * 0.05, phase: (i * 0.173) % 1, size: 0.08 + (i % 3) * 0.03 };
  scene.add(m);
  sparks.push(m);
}

// ---- the characters
const loader = new GLTFLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
const [liruf, dina, clips] = await Promise.all([load('/glb/Liruf.glb'), load('/glb/Dina.glb'), load('/clips/clips-biped.glb')]);

let holderEnv = 1;

function stand(model, height, x, z, facing, env = 1) {
  holderEnv = env;
  const box = new THREE.Box3().setFromObject(model);
  const k = height / (box.max.y - box.min.y);

  model.scale.multiplyScalar(k);
  model.updateMatrixWorld(true);

  const fitted = new THREE.Box3().setFromObject(model);

  model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);

  const holder = new THREE.Group();

  holder.add(model);
  holder.rotation.y = facing;
  holder.position.set(x, 0, z);
  scene.add(holder);
  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;

      if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();

      if (o.material) {
        o.material.envMapIntensity = holderEnv;

        if (holderEnv < 1) { o.material.color?.setRGB(0.95, 0.6, 0.42); if (o.material.emissive) o.material.emissive.setRGB(0, 0, 0); o.material.specularIntensity = 0.15; o.material.metalness = 0; }
      }
    }
  });

  return holder;
}

const LIRUF_X = -1.3;
const DINA_X = 1.62;
const liHolder = stand(liruf.scene, 1.38, LIRUF_X, 0.1, 0.62);
const diHolder = stand(dina.scene, 1.42, DINA_X, 0.15, -0.72, 0.12);

contactShadow(LIRUF_X, 0.1, 0.55, 0.38);
contactShadow(DINA_X, 0.15, 0.95, 0.5);

if (DEBUG) {
  const names = [];

  liruf.scene.traverse((o) => names.push(o.name));
  log('liruf', names.join(','));
  log('library', clips.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}`).join(' | '));
}

// Liruf's pose: the library's rotations on top of his own rest pose (rotation only, see docs/design/CHARACTER-POSES.md)
const liBones = new Map();

liruf.scene.traverse((o) => { if (o.isBone) liBones.set(o.name, o); });

const library = new Map(clips.animations.map((a) => [a.name, a]));

function additive(name, bones) {
  const source = library.get(name);
  const tracks = source.tracks.filter((t) => t.name.endsWith('.quaternion') && bones.has(t.name.split('.')[0])).map((t) => t.clone());
  const clip = new THREE.AnimationClip(name, source.duration, tracks);

  THREE.AnimationUtils.makeClipAdditive(clip, 0, clip, 30);

  return clip;
}

const liMixer = new THREE.AnimationMixer(liruf.scene);
const idle = liMixer.clipAction(additive('idle', liBones));

idle.blendMode = THREE.AdditiveAnimationBlendMode;
idle.setLoop(THREE.LoopRepeat, Infinity);
idle.play();

// Dina does not walk: her clip is a walk cycle, so it is not played. She stands in her own rest pose and the scene
// moves a few bones by hand: she breathes, her head drops toward the sprout and bobs a little with interest, her tail
// sways slowly and her ears twitch. Rotations are offsets on top of each bone's rest rotation.
const diBones = new Map();

dina.scene.traverse((o) => { if (o.isBone) diBones.set(o.name, o); });

const diRest = new Map([...diBones].map(([name, bone]) => [name, bone.quaternion.clone()]));
const offset = new THREE.Quaternion();
const axis = new THREE.Euler();

function dinaBone(name, x, y, z) {
  const bone = diBones.get(name);

  if (!bone) return;

  axis.set(x, y, z);
  offset.setFromEuler(axis);
  bone.quaternion.copy(diRest.get(name)).multiply(offset);
}

const diMixer = { setTime() {} };

// the arms: set after the clips each frame, so the pose is exact. Angles in radians, in each bone's own space.
const POSE = { arm: new THREE.Euler(0, 0, 0), fore: new THREE.Euler(0, 0, 0), shoulder: new THREE.Euler(0, 0, 0) };
const rest = new Map();

for (const [name, bone] of liBones) rest.set(name, bone.quaternion.clone());

function applyPose(t) {
  const lift = THREE.MathUtils.smoothstep(t % LOOP, 0.0, 1.0);

  void lift;
}

// ---- the watering can, held in Liruf's right hand
const canMaterial = new THREE.MeshStandardMaterial({ color: 0x4f46d8, roughness: 0.38, metalness: 0.15 });
const canTrim = new THREE.MeshStandardMaterial({ color: 0x8c86ff, roughness: 0.3, metalness: 0.2 });
const can = new THREE.Group();

{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 40, 1), canMaterial);

  body.castShadow = true;
  can.add(body);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 40), canTrim);

  lid.position.y = 0.16;
  can.add(lid);

  const rimBottom = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 12, 40), canTrim);

  rimBottom.rotation.x = Math.PI / 2;
  rimBottom.position.y = -0.15;
  can.add(rimBottom);

  const spoutCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.14, -0.1, 0), new THREE.Vector3(0.3, 0.0, 0), new THREE.Vector3(0.45, 0.12, 0), new THREE.Vector3(0.56, 0.2, 0)]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 18, 0.032, 12), canMaterial);

  spout.castShadow = true;
  can.add(spout);

  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.045, 24), canTrim);

  rose.position.set(0.58, 0.215, 0);
  rose.rotation.z = -0.9;
  can.add(rose);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 12, 30, Math.PI * 1.15), canMaterial);

  handle.position.set(-0.17, 0.02, 0);
  handle.rotation.z = Math.PI * 0.42;
  handle.castShadow = true;
  can.add(handle);
}

scene.add(can);

const hand = liBones.get('LeftHand');

// ---- time
const out = document.createElement('canvas');

out.width = OUT_W;
out.height = OUT_H;

const outContext = out.getContext('2d');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SPOUT = new THREE.Vector3();
const CAN_AT = new THREE.Vector3();
const TARGET = new THREE.Vector3(SOIL_X, 0.19, SOIL_Z);
const tmp = new THREE.Matrix4();
const dummy = new THREE.Object3D();

window.__render = (time) => {
  const t = time % LOOP;
  const phase = t / LOOP;

  // growth over the loop: the water falls from 0.5 s, the sprout grows 2 to 7 s, stays, and sinks back at 10.5 to 12 s
  const grow = smooth(2.0, 7.0, t) * (1 - smooth(10.4, 11.9, t));
  const watering = smooth(0.4, 1.2, t) * (1 - smooth(5.6, 6.6, t));

  for (const mixer of [liMixer, diMixer]) mixer.setTime(t);

  {
    const w = (t / LOOP) * Math.PI * 2;

    dinaBone('chest', Math.sin(w * 4) * 0.012, 0, 0);
    dinaBone('head', 0.16 + Math.sin(w * 2) * 0.05, Math.sin(w) * 0.05, 0);
    for (const [k, name] of ['tail', 'tailstart', 'tail1', 'tail2', 'tail3'].entries()) dinaBone(name, 0, Math.sin(w * 2 - k * 0.6) * (0.06 + k * 0.05), 0);
    dinaBone('earend', Math.sin(w * 4) * 0.05, 0, 0);
    dinaBone('R_earend', Math.sin(w * 4 + 1) * 0.05, 0, 0);
  }

  applyPose(t);
  liruf.scene.updateMatrixWorld(true);

  // sprout
  plant.scale.setScalar(Math.max(0.001, 0.2 + grow * 0.8));
  plant.visible = grow > 0.01;
  stem.scale.set(1, Math.max(0.05, grow), 1);

  for (const leaf of leaves) {
    const { start, yaw } = leaf.userData;
    const open = smooth(start, start + 0.3, grow);

    leaf.scale.setScalar(Math.max(0.001, open));
    leaf.children[0].rotation.x = -Math.PI / 2 + 0.2 + (1 - open) * 1.2 + Math.sin(t * 1.3 + yaw) * 0.04 * open;
    leaf.position.y = stemCurve.getPoint(Math.min(1, (start * 0.7 + 0.2) / 0.66 * 0.99)).y * grow;
  }

  bud.position.copy(stemCurve.getPoint(1));
  bud.position.y *= Math.max(0.05, grow);
  bud.scale.setScalar(0.4 + 0.6 * smooth(0.5, 1, grow));
  plant.rotation.z = Math.sin(t * 1.4) * 0.03 * grow;
  glow.intensity = 1.4 * smooth(0.5, 1, grow);
  wet.material.opacity = 0.55 * Math.max(watering, 0.5 * smooth(0, 1, grow));

  // the can follows the hand, tipped to pour toward the soil
  hand.getWorldPosition(CAN_AT);
  can.position.set(CAN_AT.x + 0.1, CAN_AT.y + 0.08, CAN_AT.z + 0.06);
  can.rotation.set(0, 0, -0.5 - 0.08 * Math.sin(t * 2));
  can.scale.setScalar(0.72);

  // water: drops leave the spout, follow an arc and land on the soil
  can.updateWorldMatrix(true, false);
  SPOUT.set(0.6, 0.2, 0).applyMatrix4(can.matrixWorld);

  for (let i = 0; i < DROPS; i++) {
    const u = ((t * 1.35 + i / DROPS) % 1);
    const on = watering > 0.02 ? 1 : 0;
    const x = SPOUT.x + (TARGET.x - SPOUT.x) * u;
    const z = SPOUT.z + (TARGET.z - SPOUT.z) * u;
    const y = SPOUT.y + (TARGET.y - SPOUT.y) * u * u + 0.07 * Math.sin(u * Math.PI) * (1 - u);

    dummy.position.set(x, y, z);
    dummy.scale.setScalar(on * (0.8 + 0.4 * Math.sin(i)) * (u < 0.96 ? 1 : 0.01));
    dummy.updateMatrix();
    drops.setMatrixAt(i, dummy.matrix);
  }

  drops.instanceMatrix.needsUpdate = true;

  // sparkles while it stands
  const shine = smooth(5.5, 7.5, t) * (1 - smooth(10.2, 11.4, t));

  for (const s of sparks) {
    const { angle, radius, phase: p, size } = s.userData;
    const life = (phase * 2 + p) % 1;

    s.position.set(SOIL_X + Math.cos(angle) * radius, 0.35 + life * 0.75, SOIL_Z + Math.sin(angle) * radius * 0.5);
    s.quaternion.copy(camera.quaternion);
    s.scale.setScalar(size * (0.6 + 0.8 * Math.sin(life * Math.PI)));
    s.material.opacity = shine * Math.sin(life * Math.PI) * 0.9;
  }

  tmp.identity();
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
  const bandX = OUT_W * 0.08;
  const bandY = OUT_H * 0.14;

  edge(0, 0, 0, bandY, [0, 0], [OUT_W, bandY]);
  edge(0, OUT_H, 0, OUT_H - bandY, [0, OUT_H - bandY], [OUT_W, bandY]);
  edge(0, 0, bandX, 0, [0, 0], [bandX, OUT_H]);
  edge(OUT_W, 0, OUT_W - bandX, 0, [OUT_W - bandX, 0], [bandX, OUT_H]);

  return true;
};

window.__frame = (type = 'image/jpeg', quality = 0.95) => out.toDataURL(type, quality);
document.body.dataset.ready = '1';
