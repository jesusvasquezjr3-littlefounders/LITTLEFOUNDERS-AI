// The Seeds composition of the onboarding: on the mentors' studio, a tall sunflower drops its seeds one after
// another, they arc across the deck into a big glass jar that is filling up, and one large Seed floats above the jar,
// turning slowly in its own light, so the person sees what a Seed of LittleFounders looks like. The mentor stands
// between the flower and the jar, looking up at it and jumping for joy.
//
// The Seed is the one drawing of seed-model.js. Everything moves as a function of the loop's second.
import * as THREE from 'three';
import { seedMesh } from './seed-model.js';

const TAU = Math.PI * 2;
const standard = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);

  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;

  return m;
}

function sequence(seed) {
  let s = seed;

  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** A sunflower about two metres tall in a pot: a stem with two leaves and a head that leans toward the reader. */
function sunflower() {
  const group = new THREE.Group();
  const green = standard(0x05a893, 0.75);
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.05, 0.9, 0.02), new THREE.Vector3(-0.03, 1.45, 0.06), new THREE.Vector3(0.02, 1.86, 0.16)]);

  group.add(part(new THREE.CylinderGeometry(0.26, 0.2, 0.34, 48), standard(0xeb7301, 0.6), 0, 0.17, 0), part(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 48), standard(0x5a3a22, 0.9), 0, 0.34, 0), part(new THREE.TubeGeometry(stemCurve, 40, 0.035, 12), green));

  const leafShape = new THREE.Shape();

  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.2, 0.06, 0.22, 0.36, 0, 0.5);
  leafShape.bezierCurveTo(-0.22, 0.36, -0.2, 0.06, 0, 0);

  for (const [y, side] of [[0.85, 1], [1.2, -1]]) {
    const leaf = part(new THREE.ExtrudeGeometry(leafShape, { depth: 0.014, bevelEnabled: false }), standard(0x018675, 0.75, { side: THREE.DoubleSide }), 0.02, y, 0.03);

    leaf.rotation.set(0.5, 0, -side * 1.15);
    group.add(leaf);
  }

  // the head: two rings of golden petals around a dark centre, tilted toward the reader
  const head = new THREE.Group();
  const petalShape = new THREE.Shape();

  petalShape.moveTo(0, 0);
  petalShape.bezierCurveTo(0.075, 0.05, 0.07, 0.24, 0, 0.3);
  petalShape.bezierCurveTo(-0.07, 0.24, -0.075, 0.05, 0, 0);

  const petalGeometry = new THREE.ExtrudeGeometry(petalShape, { depth: 0.012, bevelEnabled: false });

  for (const [count, radius, color, back, offset] of [[18, 0.2, 0xebb806, -0.02, 0], [18, 0.17, 0xffd23f, 0.0, TAU / 36]]) {
    for (let i = 0; i < count; i++) {
      const petal = part(petalGeometry, standard(color, 0.55, { side: THREE.DoubleSide, emissive: 0x7a5200, emissiveIntensity: 0.18 }));
      const a = (i / count) * TAU + offset;

      petal.position.set(Math.cos(a) * radius, Math.sin(a) * radius, back);
      petal.rotation.z = a - Math.PI / 2;
      head.add(petal);
    }
  }

  const centre = part(new THREE.SphereGeometry(0.23, 48, 24), standard(0x4a2c17, 0.85), 0, 0, 0.02);

  centre.scale.set(1, 1, 0.3);
  head.add(centre);

  // the seeds still in the head: small Seeds laid in rings, as in a real sunflower
  for (let ring = 0; ring < 3; ring++) {
    const n = 6 + ring * 6;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.4;
      const r = 0.05 + ring * 0.058;
      const seed = seedMesh(0.07);

      seed.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.085 - ring * 0.012);
      seed.rotation.set(Math.PI / 2, 0, 0);
      seed.rotateY(a);
      seed.castShadow = false;
      head.add(seed);
    }
  }

  head.position.set(0.02, 1.92, 0.2);
  head.rotation.x = -0.32;
  head.scale.setScalar(1.25);
  group.add(head);
  group.userData.head = new THREE.Vector3(0.02, 1.86, 0.34);

  return group;
}

/** A big glass jar, more than half full of Seeds. */
function jar(random) {
  const group = new THREE.Group();
  // plain see-through glass: the picture has no background for a refracting material to bend
  // tinted a little and edged top and bottom, so the jar reads on the light page as well as on the dark one
  const glass = new THREE.MeshStandardMaterial({ color: 0xb4c6ff, roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false });
  const body = part(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 64, 1, true), glass, 0, 0.36, 0);
  const rim = part(new THREE.TorusGeometry(0.3, 0.028, 12, 64), standard(0x8f9be6, 0.25), 0, 0.71, 0);
  const foot = part(new THREE.TorusGeometry(0.3, 0.022, 12, 64), standard(0x8f9be6, 0.25), 0, 0.022, 0);

  body.castShadow = false;
  body.material.side = THREE.DoubleSide;
  rim.rotation.x = Math.PI / 2;
  foot.rotation.x = Math.PI / 2;
  group.add(part(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 64), glass, 0, 0.012, 0), body, rim, foot);

  // the Seeds already inside, heaped a little higher in the middle
  for (let i = 0; i < 150; i++) {
    const a = random() * TAU;
    const r = Math.sqrt(random()) * 0.24;
    const seed = seedMesh(0.13);

    seed.position.set(Math.cos(a) * r, 0.05 + random() * 0.46, Math.sin(a) * r);
    seed.rotation.set(random() * TAU, random() * TAU, random() * TAU);
    seed.castShadow = false;
    group.add(seed);
  }

  return group;
}

/** Adds the Seeds props to the studio and returns `update(t)`. `loop` is the loop's length in seconds. */
export function buildSeeds(scene, { loop }) {
  const random = sequence(5);
  const group = new THREE.Group();
  const flower = sunflower();
  const pot = jar(random);
  const FLOWER = { x: -1.0, z: -1.0 };
  const JAR = { x: 0.92, z: 0.28 };

  flower.position.set(FLOWER.x, 0, FLOWER.z);
  flower.rotation.y = 0.35;
  pot.position.set(JAR.x, 0, JAR.z);
  group.add(flower, pot);

  // ---- the large Seed above the jar, in its own light
  const hero = seedMesh(0.62);
  const heroLight = new THREE.PointLight(0xffd36b, 4.5, 3.2, 1.6);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false, toneMapped: false }));

  hero.material = hero.material.clone();
  hero.material.emissiveIntensity = 0.85;
  glow.scale.setScalar(1.5);
  glow.renderOrder = 5;
  group.add(hero, heroLight, glow);

  // ---- the Seeds on their way from the flower to the jar: each follows the same arc, one after another
  const from = new THREE.Vector3(FLOWER.x + 0.12, 1.86, FLOWER.z + 0.36);
  const to = new THREE.Vector3(JAR.x, 0.62, JAR.z);
  const flying = Array.from({ length: 7 }, (_, i) => {
    const seed = seedMesh(0.16);

    seed.castShadow = false;
    group.add(seed);

    return { seed, offset: i / 7, spin: 2 + (i % 3) };
  });

  scene.add(group);

  return (t) => {
    const w = (t / loop) * TAU;

    hero.position.set(JAR.x, 1.62 + Math.sin(w * 2) * 0.05, JAR.z);
    // it shows its face and sways a little to each side, so the stripes are always seen
    hero.rotation.set(0.1, -0.35 + Math.sin(w) * 0.5, -0.2);
    heroLight.position.set(JAR.x, 1.5, JAR.z + 0.4);
    glow.position.copy(hero.position);
    glow.material.opacity = 0.75 + Math.sin(w * 4) * 0.12;

    for (const { seed, offset, spin } of flying) {
      const u = (offset + (t / loop) * 2) % 1;

      // a high arc: up from the flower's head, across, and down into the jar
      seed.position.lerpVectors(from, to, u);
      seed.position.y += Math.sin(u * Math.PI) * 0.75;
      seed.rotation.set(u * TAU * spin, u * TAU, 0.4);
      seed.visible = u > 0.03 && u < 0.97;
    }
  };
}

let halo = null;

function haloTexture() {
  if (halo) return halo;

  const c = document.createElement('canvas');

  c.width = c.height = 256;

  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);

  grad.addColorStop(0, 'rgba(255,220,130,0.75)');
  grad.addColorStop(0.4, 'rgba(255,208,110,0.28)');
  grad.addColorStop(1, 'rgba(255,208,110,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  halo = new THREE.CanvasTexture(c);
  halo.colorSpace = THREE.SRGBColorSpace;

  return halo;
}
