// The Seed of LittleFounders in 3D: a sunflower seed (D-043). The same drawing as the 2D icon
// (src/components/icons/seed.tsx): a pointed teardrop, a deep indigo shell with cream stripes that run from the tip to
// the base, and a golden edge. Any scene that shows Seeds builds them with `seedMesh`, so a Seed looks the same
// everywhere. Sizes are in metres; a real sunflower seed is tiny, so scenes use it large, like a coin.
import * as THREE from 'three';

export const SEED = { shell: '#2d2a4a', stripe: '#fff1cf', gold: '#ebb806', goldDeep: '#c99700' };

let cached = null;

/** The stripes, painted once: `u` runs around the seed and `v` from the round base to the tip, so they meet at the tip. */
function stripes() {
  if (cached) return cached;

  const c = document.createElement('canvas');

  c.width = 512;
  c.height = 512;

  const g = c.getContext('2d');

  g.fillStyle = SEED.shell;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = SEED.stripe;

  // three stripes on the front and three on the back (the texture wraps once around), the middle one widest
  for (const half of [0, 256]) {
    for (const [x, w] of [[50, 20], [114, 30], [190, 20]]) g.fillRect(half + x, 20, w, 420);
  }

  // the golden edges, where the two halves of the shell meet
  g.fillStyle = SEED.gold;
  g.fillRect(0, 0, 12, 512);
  g.fillRect(244, 0, 24, 512);
  g.fillRect(500, 0, 12, 512);

  cached = new THREE.CanvasTexture(c);
  cached.colorSpace = THREE.SRGBColorSpace;
  cached.anisotropy = 8;

  return cached;
}

/** The outline of half a seed, from the round base (y = 0) to the point (y = 1), turned into a solid and flattened. */
function geometry() {
  const profile = [];

  for (let i = 0; i <= 28; i++) {
    const v = i / 28;
    // wide and round low down, drawn to a point at the top
    const r = Math.sin(Math.PI * v ** 0.62) * (1 - v * 0.34) * 0.33;

    profile.push(new THREE.Vector2(Math.max(0.0001, r), v));
  }

  const g = new THREE.LatheGeometry(profile, 48);

  g.translate(0, -0.5, 0);
  g.scale(1, 1, 0.5); // a seed is flat, not round
  g.computeVertexNormals();

  return g;
}

let shared = null;

/** A Seed `height` metres tall, standing on its base with the point up. It glows a little, so it reads in both color modes. */
export function seedMesh(height = 0.3) {
  shared ??= geometry();

  const mesh = new THREE.Mesh(shared, new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.3, metalness: 0.05, emissive: 0x3a3068, emissiveIntensity: 0.5 }));

  mesh.scale.setScalar(height);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
