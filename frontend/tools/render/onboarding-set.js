// The set every onboarding composition is played on: the mentors' studio. A round wooden deck with a rug, a
// chalkboard on an easel, a bookshelf, a floor lamp, a side table with a jar of Seeds, a plant, and a string of warm
// bulbs overhead. It is an island: there are no walls and no floor beyond the deck, so the picture still sits on the
// page's own color with nothing at its borders (docs/design/CHARACTER-COMPOSITIONS.md).
//
// One unit is one metre and everything is sized against the characters (about 1.4 to 1.56 tall): the lamp is 1.95,
// the shelf 1.75, the board's top edge 1.9, the table 0.62, the plant 1.0. Props stand at the back and the sides; the
// front and the middle are the characters' room, so nothing touches anybody.
//
// Two layouts of the same set:
//   wide    the whole studio, for the four mentors together
//   close   the middle of it (board, lamp, plant, bulbs), for one mentor alone
//   seeds   the close layout without the board: the sunflower of the Seeds composition stands there
// A scene that needs its own props (mini-games, Seeds) adds them to this set; it does not build another.
//
// The lamps are real lights: the floor lamp and every bulb warm what is near them, in both color modes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seedMesh } from './seed-model.js';

// The brand's colors (frontend/src/styles/lf-theme.css) and two woods.
const C = {
  wood: 0xdba06a, woodDark: 0xa86a3c, woodPale: 0xf0c796, indigo: 0x5c55fd, indigoPale: 0x8f8aff, indigoDeep: 0x4438cf,
  orange: 0xeb7301, gold: 0xebb806, sky: 0x4b94ff, mint: 0x05a893, mintDeep: 0x018675, red: 0xdb1b2b, ink: 0x23263f,
  slate: 0x2b3050, cream: 0xfff1cf, paper: 0xfbfbff, metal: 0x3a3e5c,
};

const standard = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);

  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;

  return m;
}

const box = (w, h, d, material, x, y, z, radius = 0.03) => mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(radius, w / 2.01, h / 2.01, d / 2.01)), material, x, y, z);
const cylinder = (rTop, rBottom, h, material, x, y, z, segments = 48) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y, z);

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');

  c.width = size[0];
  c.height = size[1];
  draw(c.getContext('2d'), size[0], size[1]);

  const texture = new THREE.CanvasTexture(c);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

/** A soft warm halo around a lamp, always facing the camera. */
function halo(radius, strength) {
  const texture = canvasTexture([256, 256], (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    grad.addColorStop(0, `rgba(255,214,140,${strength})`);
    grad.addColorStop(0.4, `rgba(255,204,120,${strength * 0.35})`);
    grad.addColorStop(1, 'rgba(255,204,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));

  sprite.scale.setScalar(radius * 2);
  sprite.renderOrder = 6;

  return sprite;
}

// ---- the deck and the rug
function deck(radius, rugRadius) {
  const group = new THREE.Group();
  const planks = canvasTexture([1024, 1024], (g, w, h) => {
    g.fillStyle = '#e2a973';
    g.fillRect(0, 0, w, h);

    // planks of slightly different tones, with a thin dark seam between them
    for (let i = 0; i < 16; i++) {
      g.fillStyle = ['#e2a973', '#dba06a', '#e8b27e', '#d6995f'][i % 4];
      g.fillRect(0, i * (h / 16), w, h / 16 - 3);
    }

    g.fillStyle = 'rgba(120,70,30,0.35)';

    for (let i = 0; i < 16; i++) g.fillRect(0, (i + 1) * (h / 16) - 3, w, 3);
  });
  const top = mesh(new THREE.CylinderGeometry(radius, radius, 0.06, 96), [standard(C.wood, 0.75), standard(0xffffff, 0.72, { map: planks }), standard(C.woodDark, 0.8)], 0, -0.03, 0);
  const skirt = cylinder(radius * 0.985, radius * 0.94, 0.12, standard(C.woodDark, 0.85), 0, -0.12, 0, 96);
  const rug = mesh(new THREE.CircleGeometry(rugRadius, 96), standard(0xffffff, 0.95, {
    map: canvasTexture([1024, 1024], (g, w) => {
      const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(w / 2, w / 2, (w / 2) * r, 0, Math.PI * 2); g.fill(); };

      ring(1, '#4f47e6');
      ring(0.93, '#f4f1ff');
      ring(0.88, '#5c55fd');
      ring(0.5, '#6f69ff');
      ring(0.46, '#f4f1ff');
      ring(0.42, '#6f69ff');
    }),
  }), 0, 0.004, 0.15);

  top.castShadow = false;
  rug.rotation.x = -Math.PI / 2;
  rug.castShadow = false;
  group.add(top, skirt, rug);

  return group;
}

// ---- the chalkboard on its easel: drawings only, never words (the page carries the words, in three languages)
function board() {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.7);
  const face = canvasTexture([1024, 720], (g, w, h) => {
    g.fillStyle = '#2b3050';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // a line that climbs, with a dot on each step
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 14;
    g.beginPath();
    [[110, 560], [300, 470], [470, 500], [650, 330], [860, 210]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.fillStyle = '#fff6dd';
    [[110, 560], [300, 470], [470, 500], [650, 330], [860, 210]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill(); });

    // a sprout in the corner: a stem and two leaves
    g.strokeStyle = '#7fe6cf';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(200, 250);
    g.quadraticCurveTo(190, 180, 205, 120);
    g.stroke();
    g.fillStyle = '#7fe6cf';
    g.beginPath();
    g.ellipse(160, 150, 46, 22, -0.6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(250, 130, 46, 22, 0.6, 0, Math.PI * 2);
    g.fill();

    // three Seeds counted in a row: the pointed shape of a sunflower seed, with its stripe
    [600, 690, 780].forEach((x) => {
      g.fillStyle = '#ffd36b';
      g.beginPath();
      g.moveTo(x + 6, 556);
      g.bezierCurveTo(x + 34, 580, x + 30, 630, x, 634);
      g.bezierCurveTo(x - 30, 630, x - 26, 580, x + 6, 556);
      g.fill();
      g.strokeStyle = '#2b3050';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x + 4, 574);
      g.lineTo(x, 620);
      g.stroke();
    });
  });

  group.add(
    box(1.5, 1.05, 0.06, wood, 0, 1.36, 0, 0.03),
    mesh(new THREE.PlaneGeometry(1.36, 0.92), new THREE.MeshStandardMaterial({ map: face, roughness: 0.9 }), 0, 1.36, 0.032),
    box(1.2, 0.05, 0.12, wood, 0, 0.83, 0.06, 0.02),
  );

  // the easel's three legs
  for (const [x, lean] of [[-0.58, 0.06], [0.58, -0.06]]) {
    const leg = box(0.06, 1.95, 0.06, wood, x, 0.97, -0.02, 0.02);

    leg.rotation.z = lean;
    group.add(leg);
  }

  const back = box(0.06, 1.9, 0.06, wood, 0, 0.93, -0.38, 0.02);

  back.rotation.x = 0.36;
  group.add(back);

  return group;
}

// ---- the bookshelf: three shelves of books in the brand's colors, a small plant on top
function bookshelf() {
  const group = new THREE.Group();
  const wood = standard(C.wood, 0.7);
  const W = 1.1;
  const H = 1.6;
  const D = 0.34;

  group.add(box(0.06, H, D, wood, -W / 2, H / 2, 0), box(0.06, H, D, wood, W / 2, H / 2, 0), box(W, 0.03, D - 0.04, standard(C.woodDark, 0.8), 0, H / 2, -D / 2 + 0.02));

  for (const y of [0.04, 0.56, 1.08, 1.58]) group.add(box(W + 0.06, 0.05, D, wood, 0, y, 0, 0.02));

  const colors = [C.orange, C.gold, C.sky, C.mint, C.indigo, C.red, C.indigoPale, C.cream];
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  for (const shelf of [0.065, 0.585, 1.105]) {
    let x = -W / 2 + 0.09;

    while (x < W / 2 - 0.16) {
      const w = 0.05 + random() * 0.05;
      const h = 0.3 + random() * 0.13;

      group.add(box(w, h, 0.22, standard(colors[Math.floor(random() * colors.length)], 0.6), x + w / 2, shelf + h / 2, 0.02, 0.012));
      x += w + 0.008;
    }
  }

  const pot = cylinder(0.11, 0.08, 0.14, standard(C.orange, 0.6), 0.28, 1.675, 0);
  const leaves = mesh(new THREE.SphereGeometry(0.17, 24, 16), standard(C.mint, 0.8), 0.28, 1.86, 0);

  leaves.scale.set(1, 0.85, 1);
  group.add(pot, leaves, box(0.3, 0.07, 0.22, standard(C.sky, 0.6), -0.22, 1.64, 0, 0.012), box(0.26, 0.06, 0.2, standard(C.gold, 0.6), -0.22, 1.705, 0, 0.012));

  return group;
}

// ---- the floor lamp: a real light under a warm shade
function floorLamp() {
  const group = new THREE.Group();
  const metal = standard(C.metal, 0.4, { metalness: 0.3 });
  const shade = new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.8, emissive: 0xffb84d, emissiveIntensity: 1.1, side: THREE.DoubleSide });
  const light = new THREE.PointLight(0xffc880, 9, 6.5, 1.6);
  const glow = halo(0.85, 0.5);

  light.position.set(0, 1.62, 0);
  glow.position.set(0, 1.72, 0);
  group.add(cylinder(0.24, 0.26, 0.04, metal, 0, 0.02, 0), cylinder(0.022, 0.022, 1.62, metal, 0, 0.83, 0, 16), mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.36, 48, 1, true), shade, 0, 1.77, 0), light, glow);

  return group;
}

// ---- the side table with the jar of Seeds
function sideTable() {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.65);
  const glass = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, roughness: 0.1, transparent: true, opacity: 0.25, depthWrite: false });

  group.add(cylinder(0.33, 0.33, 0.045, wood, 0, 0.6, 0), cylinder(0.04, 0.05, 0.58, standard(C.woodDark, 0.8), 0, 0.3, 0, 24), cylinder(0.2, 0.22, 0.035, standard(C.woodDark, 0.8), 0, 0.018, 0));

  const jar = cylinder(0.12, 0.12, 0.26, glass, 0.02, 0.755, 0.02);

  jar.castShadow = false;
  group.add(jar, cylinder(0.125, 0.125, 0.035, standard(C.indigo, 0.5), 0.02, 0.9, 0.02));

  let seed = 3;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  for (let i = 0; i < 26; i++) {
    const a = random() * Math.PI * 2;
    const r = random() * 0.08;
    const s = seedMesh(0.07);

    s.position.set(0.02 + Math.cos(a) * r, 0.65 + random() * 0.13, 0.02 + Math.sin(a) * r);
    s.rotation.set(random() * 6, a, random() * 6);
    s.castShadow = false;
    group.add(s);
  }

  return group;
}

// ---- the plant: a pot and a few big leaves on stems
function plant(height = 1) {
  const group = new THREE.Group();
  const leafShape = new THREE.Shape();

  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.14, 0.06, 0.16, 0.3, 0, 0.42);
  leafShape.bezierCurveTo(-0.16, 0.3, -0.14, 0.06, 0, 0);

  const leafGeometry = new THREE.ExtrudeGeometry(leafShape, { depth: 0.012, bevelEnabled: false });

  group.add(cylinder(0.2, 0.15, 0.3, standard(C.orange, 0.6), 0, 0.15, 0), cylinder(0.18, 0.18, 0.02, standard(0x5a3a22, 0.9), 0, 0.3, 0));

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const out = 0.5 + (i % 3) * 0.14;
    const stem = new THREE.Group();
    const leaf = mesh(leafGeometry, standard(i % 2 ? C.mint : C.mintDeep, 0.75, { side: THREE.DoubleSide }), 0, 0.3 + (i % 3) * 0.1, 0);

    leaf.scale.setScalar(1.05 + (i % 2) * 0.25);
    stem.add(cylinder(0.012, 0.014, 0.34 + (i % 3) * 0.1, standard(C.mintDeep, 0.8), 0, 0.15 + (i % 3) * 0.05, 0, 8), leaf);
    stem.position.y = 0.3;
    stem.rotation.set(0, a, 0);
    stem.rotateZ(-out * 0.75);
    group.add(stem);
  }

  group.scale.setScalar(height);

  return group;
}

// ---- the string of bulbs: two thin posts and a line that hangs between them, every bulb a small warm light
function bulbs(halfWidth, z, height) {
  const group = new THREE.Group();
  const metal = standard(C.metal, 0.5);
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffc56b, emissiveIntensity: 2.4, roughness: 0.4 });
  const sag = halfWidth * 0.2;
  const at = (u) => new THREE.Vector3(-halfWidth + u * halfWidth * 2, height - sag * (1 - (2 * u - 1) ** 2), z);
  const count = Math.round(halfWidth * 4.4);

  for (const x of [-halfWidth, halfWidth]) group.add(cylinder(0.022, 0.03, height, metal, x, height / 2, z, 16), cylinder(0.11, 0.13, 0.03, metal, x, 0.015, z, 24));

  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 21 }, (_, i) => at(i / 20))), 60, 0.007, 6), metal);

  group.add(wire);

  for (let i = 1; i < count; i++) {
    const p = at(i / count);
    const bulb = mesh(new THREE.SphereGeometry(0.05, 16, 12), bulbMaterial, p.x, p.y - 0.07, p.z);
    const glow = halo(0.3, 0.6);

    bulb.castShadow = false;
    glow.position.set(p.x, p.y - 0.07, p.z);
    group.add(bulb, glow);

    // every third bulb lights what is under it; the others only shine (a light per bulb would cost too much)
    if (i % 3 === 1) {
      const light = new THREE.PointLight(0xffd08a, 1.6, 4.5, 1.8);

      light.position.copy(bulb.position);
      group.add(light);
    }
  }

  return group;
}

function place(object, x, z, yaw = 0) {
  object.position.x = x;
  object.position.z = z;
  object.rotation.y = yaw;

  return object;
}

/** Builds the studio in `scene`. `layout` is 'wide' (the four mentors) or 'close' (one mentor). */
export function buildSet(scene, layout) {
  const set = new THREE.Group();

  if (layout === 'wide') {
    set.add(
      place(deck(2.95, 2.0), 0, -0.3),
      place(bulbs(2.55, -1.95, 2.45), 0, 0),
      place(bookshelf(), -1.95, -1.75, 0.3),
      place(board(), 0, -2.05, 0),
      place(sideTable(), 1.2, -1.95),
      place(floorLamp(), 2.15, -1.45),
      place(plant(1), -2.55, -0.55, 0.4),
    );
  } else if (layout === 'seeds') {
    set.add(
      place(deck(1.6, 1.12), 0, -0.2),
      place(bulbs(1.36, -1.2, 2.3), 0, 0),
      place(floorLamp(), 0.55, -1.25),
    );
  } else {
    set.add(
      place(deck(1.6, 1.12), 0, -0.2),
      place(bulbs(1.36, -1.2, 2.3), 0, 0),
      place(board(), -0.66, -1.12, 0.2),
      place(floorLamp(), 1.02, -0.92),
      place(plant(0.72), -1.22, 0.1, 0.4),
    );
  }

  scene.add(set);

  return set;
}
