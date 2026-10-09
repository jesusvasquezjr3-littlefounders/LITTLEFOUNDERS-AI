// Reference renders of one character's HEAD from the artist source model, for rebuilding the head as a 2D
// vector avatar (docs/design/CHARACTER-AVATARS.md). Only the triangles that follow the head and neck bones are
// kept; the model is shown at rest, seen from the front through an orthographic camera, on a transparent
// background. `window.__render(pass, height)` returns a PNG data URL.
//
// Passes:
//   albedo  the painted surface with no light and no shading: flat colors, the best source for tracing
//   lit     the same head with the bright light rig of the compositions, for judging likeness
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const CHARACTER = params.get('character') ?? 'Rho';
const HEAD_BONES = new Set(['head', 'head_end', 'headend', 'headfront', 'neck', 'earend', 'r_earend']);
const log = (...parts) => { (window.__log ??= []).push(parts.join(' ')); };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });

renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const gltf = await new Promise((resolve, reject) => new GLTFLoader().load(`/glb/${CHARACTER}.glb`, resolve, undefined, reject));
const scene = new THREE.Scene();

scene.add(gltf.scene);
gltf.scene.updateMatrixWorld(true);

let skinned = null;

gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = o; });
skinned.skeleton.update();
skinned.frustumCulled = false;

// where the neck starts, in world units (from the neck bone, or the head bone when there is no neck)
const bonePosition = (name) => { const bone = skinned.skeleton.bones.find((b) => b.name.toLowerCase() === name); return bone ? bone.getWorldPosition(new THREE.Vector3()) : null; };
const neck = bonePosition('neck') ?? bonePosition('head');
const modelBox = new THREE.Box3().setFromObject(gltf.scene);

log('neck y', neck.y.toFixed(3), 'head y', bonePosition('head')?.y.toFixed(3), 'model y', modelBox.min.y.toFixed(3), modelBox.max.y.toFixed(3));

// keep the triangles whose three vertices are in the head
const geometry = skinned.geometry.clone();
const bones = skinned.skeleton.bones.map((b) => b.name.toLowerCase());
const index = geometry.index;
const skinIndex = geometry.attributes.skinIndex;
const skinWeight = geometry.attributes.skinWeight;
const count = geometry.attributes.position.count;
const keep = new Uint8Array(count);

// Dina is a quadruped and her head is found by her bones; Rho and Liruf are cut by a plane at the neck, so that
// triangles that blend between bones are not lost. Zara's hair follows the head bones and is kept down to her
// shoulders by the plane.
const CUT = { rho: 0.04, liruf: -0.02, zara: -0.16 };
const planeOffset = CUT[CHARACTER.toLowerCase()];
const alsoByBones = CHARACTER.toLowerCase() === 'zara'; // her hair follows the head bones; her body does not
const here = new THREE.Vector3();

for (let v = 0; v < count; v++) {
  if (planeOffset !== undefined) {
    skinned.getVertexPosition(v, here);
    here.applyMatrix4(skinned.matrixWorld);
    keep[v] = here.y >= neck.y + planeOffset ? 1 : 0;

    if (!alsoByBones) continue;
  }

  let weight = 0;

  for (let k = 0; k < 4; k++) if (HEAD_BONES.has(bones[skinIndex.getComponent(v, k)] ?? '')) weight += skinWeight.getComponent(v, k);

  keep[v] = weight >= 0.5 && (planeOffset === undefined || keep[v]) ? 1 : 0;
}

const kept = [];

for (let t = 0; t < index.count; t += 3) {
  const a = index.getX(t); const b = index.getX(t + 1); const c = index.getX(t + 2);

  if (keep[a] && keep[b] && keep[c]) kept.push(a, b, c);
}

geometry.setIndex(kept);
skinned.geometry = geometry;
log('vertices', count, 'kept triangles', kept.length / 3);

// the head's box in world space, from the skinned positions of the kept vertices
const box = new THREE.Box3();
const point = new THREE.Vector3();

for (const i of new Set(kept)) {
  skinned.getVertexPosition(i, point);
  point.applyMatrix4(skinned.matrixWorld);
  box.expandByPoint(point);
}

const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

log('box', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3));

const original = skinned.material;
const albedo = new THREE.MeshBasicMaterial({ map: original.map, side: THREE.DoubleSide });
const lit = new THREE.MeshStandardMaterial({ map: original.map, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });

const lights = new THREE.Group();

lights.add(new THREE.HemisphereLight(0xffffff, 0xcfd2ff, 1.35));

const key = new THREE.DirectionalLight(0xfff1e0, 2.6);

key.position.set(-2.5, 4.5, 4);
lights.add(key);

const fill = new THREE.DirectionalLight(0xffd9b8, 0.8);

fill.position.set(3, 1.5, 4);
lights.add(fill);

const margin = 1.08;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);

camera.position.set(center.x, center.y, center.z + 10);
camera.lookAt(center);

window.__render = (pass, height) => {
  const width = Math.round(height * (size.x / size.y));

  renderer.setSize(width, height, false);
  camera.left = -size.x * margin / 2;
  camera.right = size.x * margin / 2;
  camera.top = size.y * margin / 2;
  camera.bottom = -size.y * margin / 2;
  camera.updateProjectionMatrix();

  if (pass === 'lit') { skinned.material = lit; scene.add(lights); } else { skinned.material = albedo; scene.remove(lights); }

  // the head fills the frame: widen the box by the margin, keep the aspect of the head
  renderer.render(scene, camera);

  return canvas.toDataURL('image/png');
};

document.body.dataset.ready = '1';
