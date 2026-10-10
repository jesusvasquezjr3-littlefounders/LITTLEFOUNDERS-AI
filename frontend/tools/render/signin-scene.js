// The sign-in window's scene: Rho and Dina at a table under floating glass screens that are still loading.
// Rendered frame by frame by render-signin.mjs (`window.__render(t)` draws the scene at second `t`); it is not
// part of the application bundle. Composition rules: docs/design/CHARACTER-COMPOSITIONS.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'dark' ? 'dark' : 'light';
const DEBUG = params.has('debug');
const log = (...parts) => { (window.__log ??= []).push(parts.join(' ')); };
const LOOP = 12; // seconds; every motion below completes whole turns or cycles in this time

const WIDTH = 2880;
const HEIGHT = 840; // 1440 x 420 delivered, rendered at 2x
const CANVAS_COLOR = MODE === 'dark' ? 0x0b0d1b : 0xf4f5fd; // --v-canvas: the sign-in window's own color

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });

renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();

scene.background = new THREE.Color(CANVAS_COLOR);

const camera = new THREE.PerspectiveCamera(24, WIDTH / HEIGHT, 0.1, 50);

camera.position.set(0, 1.0, 5.6);
camera.lookAt(0, 0.93, 0);

// ---- light: the same bright rig in both color modes (the landing rule); only the ground tint differs
scene.add(new THREE.HemisphereLight(0xffffff, MODE === 'dark' ? 0x6a6fd8 : 0xcfd2ff, 1.35));

const key = new THREE.DirectionalLight(0xfff1e0, 2.6);

key.position.set(-2.5, 4.5, 4);
scene.add(key);

const rim = new THREE.DirectionalLight(0xa9b4ff, 1.6);

rim.position.set(3, 3, -3);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xffd9b8, 0.8);

fill.position.set(3, 1.5, 4);
scene.add(fill);

// ---- soft radial textures: the ground pool and the contact shadows fade to nothing, so there is no visible edge
function radialTexture(stops) {
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

function softDisc(radiusX, radiusZ, texture, y, order) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));

  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(radiusX, radiusZ, 1);
  mesh.position.y = y;
  mesh.renderOrder = order;
  scene.add(mesh);

  return mesh;
}

const pool = radialTexture(MODE === 'dark'
  ? [[0, 'rgba(110,100,255,0.55)'], [0.45, 'rgba(90,80,230,0.22)'], [1, 'rgba(90,80,230,0)']]
  : [[0, 'rgba(120,110,255,0.34)'], [0.5, 'rgba(120,110,255,0.14)'], [1, 'rgba(120,110,255,0)']]);

softDisc(3.6, 0.8, pool, 0.001, 0);

const blobShade = MODE === 'dark' ? '0,0,10' : '40,30,120';
const blob = radialTexture([[0, `rgba(${blobShade},${MODE === 'dark' ? 0.62 : 0.38})`], [0.6, `rgba(${blobShade},${MODE === 'dark' ? 0.25 : 0.14})`], [1, `rgba(${blobShade},0)`]]);

// ---- the table: a low round table, warm wood
const wood = new THREE.MeshStandardMaterial({ color: 0xd9965b, roughness: 0.55, metalness: 0 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x9a5f33, roughness: 0.6, metalness: 0 });
const table = new THREE.Group();
const TABLE_TOP = 0.42;

{
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 64), wood);

  top.position.y = TABLE_TOP - 0.03;
  table.add(top);

  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 16, 64), wood);

  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = TABLE_TOP - 0.03;
  table.add(rimRing);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, TABLE_TOP - 0.1, 32), woodDark);

  stem.position.y = (TABLE_TOP - 0.1) / 2 + 0.04;
  table.add(stem);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.05, 48), woodDark);

  foot.position.y = 0.025;
  table.add(foot);
}

table.position.set(0, 0, 0.05);
scene.add(table);
softDisc(0.62, 0.36, blob, 0.004, 1).position.set(0, 0.004, 0.05);

// ---- floating glass screens, still loading: shapes and no text
const PANELS = [
  { kind: 'profile', x: -2.4, y: 1.42, w: 0.76, h: 0.53, turns: 1, phase: 0.0, bob: 0.0, hue: 0 },
  { kind: 'chart', x: -0.8, y: 1.66, w: 0.76, h: 0.53, turns: -1, phase: 0.31, bob: 0.25, hue: 1 },
  { kind: 'list', x: 0.35, y: 1.7, w: 0.76, h: 0.53, turns: 1, phase: 0.58, bob: 0.5, hue: 2 },
  { kind: 'cards', x: 2.2, y: 1.5, w: 0.76, h: 0.53, turns: -1, phase: 0.83, bob: 0.75, hue: 0 },
];
const HUES = [['#7a84ff', '#eb7301'], ['#05a893', '#4b94ff'], ['#ebb806', '#7a84ff']];
const FACE = { w: 760, h: 528, m: 26 };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** One screen's face, as a canvas: frosted glass over soft color, with skeleton shapes that shimmer. */
function drawPanel(g, p, shimmer) {
  const { w: W, h: H, m } = FACE;
  const dark = MODE === 'dark';

  g.clearRect(0, 0, W, H);

  // outer glow
  g.save();
  g.shadowColor = dark ? 'rgba(140,150,255,0.55)' : 'rgba(80,70,220,0.5)';
  g.shadowBlur = 22;
  g.fillStyle = dark ? 'rgba(60,64,140,0.6)' : 'rgba(120,110,255,0.5)';
  roundRect(g, m, m, W - 2 * m, H - 2 * m, 44);
  g.fill();
  g.restore();

  // glass body: color blobs seen through frost
  g.save();
  roundRect(g, m, m, W - 2 * m, H - 2 * m, 44);
  g.clip();
  g.fillStyle = dark ? '#1a1d3d' : '#c9ccff';
  g.fillRect(0, 0, W, H);

  const [a, b] = HUES[p.hue];

  for (const [cx, cy, r, color] of [[W * 0.22, H * 0.28, 210, a], [W * 0.82, H * 0.78, 230, b]]) {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);

    grad.addColorStop(0, color + (dark ? 'cc' : 'bb'));
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  const frost = g.createLinearGradient(0, 0, W, H);

  frost.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.50)');
  frost.addColorStop(1, dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)');
  g.fillStyle = frost;
  g.fillRect(0, 0, W, H);

  // skeleton shapes
  const bone = dark ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.88)';
  const boneStrong = dark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.98)';
  const shapes = [];
  const bar = (x, y, w, h, strong) => shapes.push(() => { g.fillStyle = strong ? boneStrong : bone; roundRect(g, x, y, w, h, h / 2); g.fill(); });
  const block = (x, y, w, h, r) => shapes.push(() => { g.fillStyle = bone; roundRect(g, x, y, w, h, r); g.fill(); });
  const disc = (x, y, r) => shapes.push(() => { g.fillStyle = boneStrong; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  const L = 70;

  if (p.kind === 'profile') {
    disc(L + 36, 112, 36); bar(L + 90, 92, 220, 18, true); bar(L + 90, 122, 140, 14);
    block(L, 180, 620, 140, 22);
    bar(L, 346, 540, 16); bar(L, 378, 420, 16); bar(L, 410, 300, 16);
  } else if (p.kind === 'chart') {
    bar(L, 92, 250, 20, true); bar(L, 128, 160, 14);
    [150, 230, 120, 280, 200, 160].forEach((h, i) => block(L + i * 105, 420 - h, 70, h, 14));
  } else if (p.kind === 'list') {
    [0, 1, 2, 3].forEach((i) => { disc(L + 28, 120 + i * 86, 28); bar(L + 76, 100 + i * 86, 330, 18, true); bar(L + 76, 128 + i * 86, 220, 14); block(L + 520, 100 + i * 86, 100, 40, 20); });
  } else {
    bar(L, 92, 220, 20, true);
    [0, 1].forEach((r) => [0, 1].forEach((c) => block(L + c * 320, 140 + r * 150, 290, 126, 22)));
    bar(L, 440, 200, 16);
  }

  for (const draw of shapes) draw();

  // one band of light sweeps across every shape together
  const sweep = -300 + shimmer * (W + 600);

  g.globalCompositeOperation = 'source-atop';

  const band = g.createLinearGradient(sweep - 90, 0, sweep + 90, 0);

  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, dark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.restore();

  // rim: a bright edge on the top-left, a quiet one on the bottom-right
  g.save();
  roundRect(g, m, m, W - 2 * m, H - 2 * m, 44);

  const edge = g.createLinearGradient(m, m, W - m, H - m);

  edge.addColorStop(0, dark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,1)');
  edge.addColorStop(0.5, dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.5)');
  edge.addColorStop(1, dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)');
  g.strokeStyle = edge;
  g.lineWidth = 4;
  g.stroke();
  g.restore();
}

const panels = PANELS.map((p) => {
  const c = document.createElement('canvas');

  c.width = FACE.w;
  c.height = FACE.h;

  const texture = new THREE.CanvasTexture(c);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(p.w * (FACE.w / (FACE.w - 2 * FACE.m)), p.h * (FACE.h / (FACE.h - 2 * FACE.m))),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );

  mesh.renderOrder = 5;
  scene.add(mesh);

  return { p, g: c.getContext('2d'), texture, mesh };
});

// ---- the characters
const loader = new GLTFLoader();
const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
const mixers = [];

function stand(model, height, x, z, facing) {
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
  model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); } });

  return holder;
}

// Rho from the artist original: glb/Rho.glb has gaps along the vest in the rest pose (docs/design/CHARACTER-POSES.md)
const [rhoGltf, dinaGltf, clipsGltf] = await Promise.all([load('/glb/originals/Rho.glb'), load('/glb/Dina.glb'), load('/clips/clips-biped.glb')]);

if (DEBUG) {
  log('dina clips', dinaGltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s ${a.tracks.length}`).join('|'));
  log('library', clipsGltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`).join(' | '));

  const names = [];

  rhoGltf.scene.traverse((o) => names.push(o.name));
  log('rho nodes', names.join(','));
}

const rho = rhoGltf.scene;
const dina = dinaGltf.scene;

// Dina is a large animal: in the files she is small, on screen she stands taller than Rho (owner direction)
stand(rho, 1.2, -1.15, 0.1, 0.7);
stand(dina, 1.45, 1.3, 0.1, -0.6);
softDisc(0.4, 0.22, blob, 0.006, 2).position.set(-1.15, 0.006, 0.1);
softDisc(0.85, 0.36, blob, 0.006, 2).position.set(1.3, 0.006, 0.1);

// Rho: the library's clips are authored on another skeleton's rest pose, so only their rotations are used,
// as offsets from their own first frame, added on top of Rho's own pose (docs/design/CHARACTER-POSES.md).
const library = new Map(clipsGltf.animations.map((a) => [a.name, a]));
const rhoBones = new Set();

rho.traverse((o) => rhoBones.add(o.name));

function additive(name) {
  const source = library.get(name);
  const tracks = source.tracks.filter((t) => t.name.endsWith('.quaternion') && rhoBones.has(t.name.split('.')[0])).map((t) => t.clone());
  const clip = new THREE.AnimationClip(name, source.duration, tracks);

  THREE.AnimationUtils.makeClipAdditive(clip, 0, clip, 30);

  return clip;
}

const rhoMixer = new THREE.AnimationMixer(rho);

mixers.push(rhoMixer);

{
  const idle = rhoMixer.clipAction(additive('idle'));

  idle.blendMode = THREE.AdditiveAnimationBlendMode;
  idle.setLoop(THREE.LoopRepeat, Infinity);
  idle.play();

  for (const [name, at] of [['nod', 2.2], ['point', 6.0]]) {
    const action = rhoMixer.clipAction(additive(name));

    action.blendMode = THREE.AdditiveAnimationBlendMode;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.startAt(at);
    action.play();
  }
}

const dinaMixer = new THREE.AnimationMixer(dina);

mixers.push(dinaMixer);
dinaMixer.clipAction(dinaGltf.animations[0]).play();

// ---- the frame at second t
const out = document.createElement('canvas');

out.width = 1440;
out.height = 420;

const outContext = out.getContext('2d');

window.__render = (t) => {
  const phase = (t % LOOP) / LOOP;

  for (const mixer of mixers) mixer.setTime(t % LOOP);

  for (const { p, g, texture, mesh } of panels) {
    drawPanel(g, p, (t / 3) % 1);
    texture.needsUpdate = true;
    mesh.position.set(p.x, p.y + 0.035 * Math.sin(2 * Math.PI * (phase * 2 + p.bob)), -0.15);
    mesh.rotation.y = p.turns * 2 * Math.PI * phase + p.phase * Math.PI * 2;
  }

  renderer.render(scene, camera);
  outContext.imageSmoothingQuality = 'high';
  outContext.drawImage(canvas, 0, 0, 1440, 420);

  return true;
};

window.__frame = (type = 'image/jpeg', quality = 0.95) => out.toDataURL(type, quality);
document.body.dataset.ready = '1';
