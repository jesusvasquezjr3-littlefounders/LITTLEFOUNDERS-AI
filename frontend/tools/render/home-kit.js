// What every composition of the home page is built with (home-scene.js draws them, home/<name>.js describes each):
// the brand's colors, a few rounded solids, painted textures, glows, and the small effects that repeat from one scene
// to the next. Sizes are in metres and one unit is one metre, as in the onboarding's set.
//
// The platform's shapes are round and soft (the owner's rule), so nothing here has a hard corner: boxes are rounded
// boxes, rocks are squashed spheres, and a prop that would be a slab is a disc.
//
// Nothing is random at run time. Positions come from `sequence(seed)`, and every effect is a function of the second
// `t` of the loop that completes whole cycles in it, so the loop is seamless and any frame can be drawn on its own.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { seedMesh } from './seed-model.js';

export const TAU = Math.PI * 2;

// The brand's colors (frontend/src/styles/lf-theme.css), two woods and a few naturals for the settings.
export const C = {
  wood: 0xdba06a, woodDark: 0xa86a3c, woodPale: 0xf0c796, indigo: 0x5c55fd, indigoPale: 0x8f8aff, indigoDeep: 0x4438cf,
  orange: 0xeb7301, gold: 0xebb806, sky: 0x4b94ff, mint: 0x05a893, mintDeep: 0x018675, red: 0xdb1b2b, pink: 0xff6fa5,
  ink: 0x23263f, slate: 0x2b3050, cream: 0xfff1cf, paper: 0xfbfbff, metal: 0x3a3e5c, white: 0xffffff,
  stone: 0xb9bdd2, stoneDark: 0x8d91ab, moss: 0x4fae5a, leaf: 0x2f9e58, leafDeep: 0x1f7a45, earth: 0x8a5a36, earthDark: 0x5f3c22,
};

export const CONFETTI = [0x5c55fd, 0xeb7301, 0xebb806, 0x4b94ff, 0x05a893, 0xff6fa5, 0xffffff];

export function sequence(seed) {
  let s = seed;

  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export const standard = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

/** A surface that gives its own light, for screens and lamps: it reads the same in both color modes. */
export const lit = (color, intensity = 1.5, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5, ...extra });

export const glass = (color = 0xdfe8ff, opacity = 0.22) => new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);

  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;

  return m;
}

export const box = (w, h, d, material, x, y, z, radius = 0.05) => mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, w / 2.01, h / 2.01, d / 2.01)), material, x, y, z);

export const cylinder = (rTop, rBottom, h, material, x, y, z, segments = 48) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y, z);

export const sphere = (radius, material, x, y, z, squash = 1) => {
  const m = mesh(new THREE.SphereGeometry(radius, 40, 28), material, x, y, z);

  m.scale.y = squash;

  return m;
};

/** A solid turned around the vertical axis from `[radius, height]` points, bottom to top. */
export const lathe = (points, material, x = 0, y = 0, z = 0, segments = 64) => mesh(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), segments), material, x, y, z);

/** A round rod through `[x, y, z]` points. */
export const tube = (points, radius, material, segments = 48) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 10), material);

export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');

  c.width = size[0];
  c.height = size[1];
  draw(c.getContext('2d'), size[0], size[1]);

  const texture = new THREE.CanvasTexture(c);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

/** A round gradient from the middle out: `[[at, cssColor], ...]`. */
export const radial = (stops, size = 256) => canvasTexture([size, size], (g, w) => {
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

  for (const [at, color] of stops) grad.addColorStop(at, color);

  g.fillStyle = grad;
  g.fillRect(0, 0, w, w);
});

/** The outline of a Seed on a 2D canvas (the chalk Seeds of the onboarding's board): centered on `x`, `y`, `s` tall. */
export function drawSeed(g, x, y, s, fill = '#ffd36b', stripe = '#2b3050') {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(x + s * 0.08, y - s * 0.5);
  g.bezierCurveTo(x + s * 0.44, y - s * 0.2, x + s * 0.4, y + s * 0.44, x, y + s * 0.5);
  g.bezierCurveTo(x - s * 0.4, y + s * 0.44, x - s * 0.34, y - s * 0.2, x + s * 0.08, y - s * 0.5);
  g.fill();
  g.strokeStyle = stripe;
  g.lineWidth = s * 0.08;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + s * 0.05, y - s * 0.26);
  g.lineTo(x, y + s * 0.3);
  g.stroke();
}

// ---- sprites: a four-pointed star, a soft dot, a ring
const STAR = canvasTexture([128, 128], (g, s) => {
  const glow = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);

  glow.addColorStop(0, 'rgba(255,255,255,0.75)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#ffffff';
  g.beginPath();

  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? s * 0.07 : s * 0.46;
    const a = (i / 8) * TAU - Math.PI / 2;

    g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }

  g.closePath();
  g.fill();
});
const DOT = radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 64);
const RING = canvasTexture([128, 128], (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s / 2);

  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});

export const TEXTURES = { star: STAR, dot: DOT, ring: RING };

/** A picture that always faces the camera and is not lit: a star, a speck, a glow. */
export function sprite(map, color = 0xffffff, order = 8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, toneMapped: false }));

  s.renderOrder = order;

  return s;
}

/** A soft halo of `color` around something that shines. */
export function halo(radius, color = 0xffd08a, opacity = 0.6) {
  const s = sprite(DOT, color, 6);

  s.scale.setScalar(radius * 2);
  s.material.opacity = opacity;

  return s;
}

/** A flat round picture lying on the floor (a pool of light, a shadow, a marking). */
export function decal(texture, x, y, z, rx, rz = rx, order = 2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));

  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  m.position.set(x, y, z);
  m.renderOrder = order;

  return m;
}

/** A layer that shows only the shadows that fall on it, laid just above a floor so they stay readable on a bright one. */
export function shadowCatcher(radius, y, z = 0, opacity = 0.3) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), new THREE.ShadowMaterial({ opacity, color: 0x2a1f6e }));

  m.rotation.x = -Math.PI / 2;
  m.position.set(0, y, z);
  m.receiveShadow = true;
  m.material.depthWrite = false;
  m.renderOrder = 2;

  return m;
}

export function place(object, x, z, yaw = 0, y = 0) {
  object.position.set(x, y, z);
  object.rotation.y = yaw;

  return object;
}

// ---- effects every scene may use. Each adds to `group` and returns `update(t)`.

/** Stars that twinkle around each actor (`{ x, z, y, height, peak, clear }`), brightest in the second around its jump. `clear` is the half-width kept free of stars (0.5 m unless given; Dina needs more). */
export function sparkles(group, { loop, actors, seed = 11, each = 8, colors = [0xffffff, 0xfff0b8, 0xdcd9ff] }) {
  const next = sequence(seed);
  const updates = [];

  for (const actor of actors) {
    for (let i = 0; i < each; i++) {
      const s = sprite(STAR, colors[i % colors.length]);
      const a = next() * TAU;
      const r = 0.42 + next() * 0.42;
      const up = 0.45 + next() * 0.85;
      // beside the character, never over it: a star is kept at least `clear` to one side, more at the height of the head
      const clear = (actor.clear ?? 0.5) * (up > 0.6 ? 1.3 : 1);
      const side = Math.cos(a) * r * 1.15;
      const x = actor.x + (Math.abs(side) < clear ? Math.sign(side || 1) * clear : side);
      const y = (actor.y ?? 0) + actor.height * up;
      const z = actor.z + 0.25 + Math.abs(Math.sin(a)) * 0.3;
      const size = 0.1 + next() * 0.14;
      const speed = 1 + Math.floor(next() * 3);
      const phase = next() * TAU;

      group.add(s);
      updates.push((t) => {
        const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;
        const near = actor.peak == null ? 0.55 : 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - actor.peak) / 1.1);

        s.position.set(x, y + Math.sin((t / loop) * TAU + phase) * 0.05, z);
        s.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
        s.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
        s.material.rotation = phase + (t / loop) * TAU * 0.5;
      });
    }
  }

  return (t) => { for (const update of updates) update(t); };
}

/** A ring of dust where an actor lands, `after` seconds past the peak of its jump. */
export function landings(group, { actors, after = 0.3, color = 0xfff3dd, lasts = 0.7 }) {
  const updates = [];

  for (const actor of actors) {
    if (actor.peak == null) continue;

    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: RING, color, transparent: true, depthWrite: false, toneMapped: false }));

    ring.rotation.x = -Math.PI / 2;
    ring.position.set(actor.x, (actor.y ?? 0) + 0.02, actor.z);
    ring.renderOrder = 3;
    group.add(ring);
    updates.push((t) => {
      const u = (t - (actor.peak + after)) / lasts;

      ring.visible = u >= 0 && u <= 1;
      ring.scale.setScalar(0.5 + u * 1.3);
      ring.material.opacity = 0.75 * (1 - u);
    });
  }

  return (t) => { for (const update of updates) update(t); };
}

/**
 * Specks that rise through a column and fade in and out at its ends: motes in lamplight, fireflies, bubbles, sparks.
 * `at` is the column's foot, `radius` its width, `height` how far they rise. `spin: false` keeps a picture upright.
 */
export function rising(group, { loop, at, radius, height, count, color = 0xffd995, size = [0.018, 0.048], seed = 5, texture = DOT, sway = 0.05, depth = 0.6, spin = true }) {
  const next = sequence(seed);
  const updates = [];

  for (let i = 0; i < count; i++) {
    const m = sprite(texture, Array.isArray(color) ? color[i % color.length] : color);
    const a = next() * TAU;
    const r = next() * radius;
    const y0 = next();
    const s = size[0] + next() * (size[1] - size[0]);
    const laps = 1 + Math.floor(next() * 2);
    const phase = next() * TAU;

    group.add(m);
    updates.push((t) => {
      const rise = (y0 + (t / loop) * laps) % 1;

      m.position.set(at.x + Math.cos(a) * r + Math.sin((t / loop) * TAU * 2 + phase) * sway, at.y + rise * height, at.z + Math.sin(a) * r * depth);
      m.scale.setScalar(s);
      m.material.opacity = 0.9 * Math.sin(rise * Math.PI);
      m.material.rotation = spin ? phase + rise * 2 : 0;
    });
  }

  return (t) => { for (const update of updates) update(t); };
}

/** A burst of confetti thrown up from behind the characters at second `at`, falling for a few seconds. */
export function confetti(group, { at, x = 0, z = -0.5, spread = 2.4, count = 90, colors = CONFETTI, seed = 23, floor = 0.03 }) {
  const next = sequence(seed);
  const updates = [];

  for (let i = 0; i < count; i++) {
    const piece = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    const x0 = x + (next() - 0.5) * spread * 1.3;
    const vx = (next() - 0.5) * 1.5;
    const vy = 3.3 + next() * 1.9;
    const vz = (next() - 0.3) * 0.9;
    const spin = 4 + next() * 9;
    const phase = next() * TAU;
    const delay = next() * 0.25;

    piece.scale.set(1, 0.6, 1);
    piece.renderOrder = 7;
    group.add(piece);
    updates.push((t) => {
      const since = t - (at - 0.55 + delay);

      piece.visible = since >= 0 && since < 3.4;

      if (!piece.visible) return;

      const up = Math.min(since, 0.75);
      const down = Math.max(0, since - 0.75);

      piece.position.set(x0 + vx * since * 0.75 + Math.sin(since * 3 + phase) * 0.08, Math.max(floor, 0.9 + vy * up - 2.6 * up * up - down * 0.62), z + vz * since);
      piece.rotation.set(since * spin + phase, since * spin * 0.7, phase);
      piece.material.opacity = Math.min(1, (3.4 - since) / 0.8);
    });
  }

  return (t) => { for (const update of updates) update(t); };
}
