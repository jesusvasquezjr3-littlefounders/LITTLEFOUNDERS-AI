// Home composition "detectives": the four mentors, detectives for a night, follow a trail of glowing footprints to
// the golden Seed that went missing. The moment is the one the magnifying glass reaches it.
//
// The setting is an island: a round piece of cobbled street with stone underneath. At the back stands one small
// house front under a round roof: its round door shows whole in the gap the mentors leave between their two
// pairs, the board of clues hangs high on it (drawings joined by red string, never a word) and a small frosted
// round window glows beside the board. A street lamp on the left throws a warm cone of light with motes in it.
// Nothing stands behind Dina, who is large: over her there is only the moon. The trail of prints runs along the
// front of the street, where nobody stands, and round to the Seed on the right; a large magnifying glass glides low
// over its last prints and stands up over the Seed. The moon and a few stars hang in a cloud of night blue that
// fades to nothing before the frame's borders.
//
// Liruf, Zara and Dina wear a round hat that follows the head; Rho keeps his own cap. Nothing here is sinister:
// the mystery is who took the Seed, and it is found every eight seconds.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const STREET = { radius: 3.25, z: -0.5 };
const LAMP = { x: -2.95, z: -1.0, reach: 0.56, height: 2.45 };
const HOUSE = { x: -1.12, z: -2.5, width: 1.92, height: 2.5 };
// on the house's front, from its middle: the door (in the gap between Zara and Rho), the board and the window
const DOOR = { x: 0.58, y: 0.56 };
const BOARD = { x: -0.28, y: 1.9 };
const PANE = { x: 0.64, y: 1.9 };
const LOST = { x: 2.45, y: 0.76, z: 0.55 };
const MOON = { x: 1.95, y: 2.72 };
const FOUND = 2.2; // the second the magnifying glass reaches the Seed
// the trail: prints along the front of the street, on a circle around its middle, by their angle from the front
const TRAIL = { radius: 2.72, angles: [-0.62, -0.44, -0.26, -0.08, 0.1, 0.28, 0.46, 0.64] };
const onTrail = (a, r = TRAIL.radius) => [Math.sin(a) * r, STREET.z + Math.cos(a) * r];
// where the middle of the lens passes: low over the last prints, then up in front of the Seed
const SWEEP = [[...onTrail(0.4, 2.8), 0.2], [...onTrail(0.56, 2.8), 0.2], [...onTrail(0.7, 2.74), 0.3], [2.28, 1.2, 0.66], [2.45, 0.98, 0.9]].map(([x, z, y]) => [x, y, z]);

// ---- the street: round cobbles laid in rings, a kerb around them, stone underneath
function street() {
  const group = new THREE.Group();
  const next = sequence(53);
  const R = STREET.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const tones = ['#8f95bd', '#7d83ad', '#9aa0c8', '#868cb6', '#a3a8cf', '#7479a4'];

    g.fillStyle = '#4c5078';
    g.fillRect(0, 0, w, w);

    for (let ring = 0; ring < 15; ring++) {
      const r = 26 + ring * 51;
      const count = Math.max(1, Math.round((TAU * r) / 56));
      const turn = next() * TAU;

      for (let i = 0; i < (ring ? count : 1); i++) {
        const a = turn + (i / count) * TAU;

        g.save();
        g.translate(half + Math.cos(a) * (ring ? r : 0), half + Math.sin(a) * (ring ? r : 0));
        g.rotate(a + Math.PI / 2);
        g.fillStyle = tones[Math.floor(next() * tones.length)];
        g.beginPath();
        g.roundRect(-24, -21, 48, 42, 17);
        g.fill();
        // a little light on each stone's top
        g.fillStyle = 'rgba(255,255,255,0.13)';
        g.beginPath();
        g.ellipse(-3, -5, 14, 9, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x6b7099, 0.9), standard(0xffffff, 0.62, { map: picture }), standard(0x4a4e78, 0.9)], 0, -0.05, 0);
  const kerb = mesh(new THREE.TorusGeometry(R - 0.02, 0.1, 14, 128), standard(0xa9adcf, 0.85), 0, -0.05, 0);

  top.castShadow = false;
  kerb.rotation.x = Math.PI / 2;
  group.add(top, kerb, lathe([[0, -0.62], [1.2, -0.58], [2.2, -0.44], [2.9, -0.25], [R - 0.04, -0.1]], standard(0x565a86, 0.95)));

  return group;
}

/** A small house front standing on the floor: plaster with a few bricks showing through, under a round roof. */
function front(width, height, color, brick, roof, seed) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const r = 0.24;
  const depth = 0.34;
  const next = sequence(seed);

  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height - r);
  shape.absarc(-width / 2 + r, height - r, r, Math.PI, Math.PI / 2, true);
  shape.lineTo(width / 2 - r, height);
  shape.absarc(width / 2 - r, height - r, r, Math.PI / 2, 0, true);
  shape.lineTo(width / 2, 0);
  shape.closePath();

  const body = mesh(new THREE.ExtrudeGeometry(shape, { depth: depth - 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 6, curveSegments: 24 }), standard(color, 0.88), 0, 0, -depth / 2 + 0.08);

  group.add(body, box(width + 0.12, 0.2, depth + 0.1, standard(brick, 0.9), 0, 0.1, 0, 0.09));

  // the roof: a thick round-edged slab that overhangs the wall, and a round chimney at one end
  group.add(
    box(width + 0.3, 0.34, depth + 0.42, standard(roof, 0.75), 0, height + 0.1, 0.04, 0.17),
    cylinder(0.14, 0.16, 0.36, standard(brick, 0.9), -width * 0.3, height + 0.4, -0.02, 32),
    cylinder(0.19, 0.19, 0.09, standard(roof, 0.75), -width * 0.3, height + 0.6, -0.02, 32),
  );

  // bricks in two or three small patches, never a full grid
  for (const [bx, by, rows] of [[-width * 0.36, height * 0.12, 2], [-width * 0.3, height * 0.42, 1]]) {
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < 2 + Math.floor(next() * 2); i++) {
        group.add(box(0.3, 0.13, 0.08, standard(brick, 0.9), bx + i * 0.34 + (row % 2) * 0.17, by + row * 0.17, depth / 2 + 0.005, 0.05));
      }
    }
  }

  return group;
}

// ---- the clues: cards pinned to the cork, each with one drawing, joined by red string to the Seed in the middle
function drawClues(g, w, h) {
  const cards = [
    { x: 0.5, y: 0.5, s: 1.2, turn: 0.03, draw: (s) => drawSeed(g, 0, 0, s * 1.15, '#ebb806', '#2b3050') },
    { x: 0.16, y: 0.3, s: 1, turn: -0.09, draw: (s) => footprint(g, 0, 0, s, '#5c55fd') },
    { x: 0.84, y: 0.28, s: 1, turn: 0.08, draw: (s) => key(g, s) },
    { x: 0.17, y: 0.74, s: 1, turn: 0.07, draw: (s) => glassIcon(g, s) },
    { x: 0.83, y: 0.73, s: 1, turn: -0.06, draw: (s) => paw(g, s) },
  ];
  const pin = (card) => [card.x * w, card.y * h - 105 * card.s];

  g.lineCap = 'round';
  g.lineJoin = 'round';

  for (const card of cards) {
    const cw = 190 * card.s;
    const ch = 230 * card.s;

    g.save();
    g.translate(card.x * w, card.y * h);
    g.rotate(card.turn);
    g.fillStyle = 'rgba(70,40,20,0.25)';
    g.beginPath();
    g.roundRect(-cw / 2 + 8, -ch / 2 + 10, cw, ch, 26);
    g.fill();
    g.fillStyle = '#fff6df';
    g.beginPath();
    g.roundRect(-cw / 2, -ch / 2, cw, ch, 26);
    g.fill();
    g.translate(0, 14 * card.s);
    card.draw(120 * card.s);
    g.restore();
  }

  // the strings sag a little between two pins
  g.strokeStyle = '#e2283c';
  g.lineWidth = 9;

  for (const card of cards.slice(1)) {
    const [x0, y0] = pin(card);
    const [x1, y1] = pin(cards[0]);

    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 46, x1, y1);
    g.stroke();
  }

  for (const card of cards) {
    const [x, y] = pin(card);

    g.fillStyle = '#b3141f';
    g.beginPath();
    g.arc(x, y + 3, 17, 0, TAU);
    g.fill();
    g.fillStyle = '#ff4a5c';
    g.beginPath();
    g.arc(x, y, 15, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(x - 5, y - 5, 5, 0, TAU);
    g.fill();
  }
}

/** The print of a bare round foot: a heel, the ball of the foot and four round toes, pointing up. */
function footprint(g, x, y, s, color) {
  g.fillStyle = color;
  // the ball of the foot and the heel, one round shape narrower at the heel
  g.beginPath();
  g.ellipse(x, y - s * 0.02, s * 0.2, s * 0.24, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(x, y + s * 0.3, s * 0.15, s * 0.17, 0, 0, TAU);
  g.fill();

  // four round toes in an arc
  for (const [dx, dy, r] of [[-0.21, -0.3, 0.07], [-0.08, -0.4, 0.078], [0.08, -0.4, 0.078], [0.21, -0.3, 0.07]]) {
    g.beginPath();
    g.arc(x + s * dx, y + s * dy, s * r, 0, TAU);
    g.fill();
  }
}

function key(g, s) {
  g.strokeStyle = '#eb7301';
  g.lineWidth = s * 0.13;
  g.beginPath();
  g.arc(0, -s * 0.26, s * 0.2, 0, TAU);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -s * 0.06);
  g.lineTo(0, s * 0.46);
  g.moveTo(0, s * 0.42);
  g.lineTo(s * 0.2, s * 0.42);
  g.moveTo(0, s * 0.2);
  g.lineTo(s * 0.15, s * 0.2);
  g.stroke();
}

function glassIcon(g, s) {
  g.fillStyle = 'rgba(75,148,255,0.25)';
  g.strokeStyle = '#05a893';
  g.lineWidth = s * 0.13;
  g.beginPath();
  g.arc(-s * 0.08, -s * 0.1, s * 0.27, 0, TAU);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(s * 0.13, s * 0.13);
  g.lineTo(s * 0.38, s * 0.4);
  g.stroke();
}

function paw(g, s) {
  g.fillStyle = '#ff6fa5';
  g.beginPath();
  g.ellipse(0, s * 0.16, s * 0.26, s * 0.21, 0, 0, TAU);
  g.fill();

  for (const [x, y] of [[-0.3, -0.1], [-0.11, -0.3], [0.11, -0.3], [0.3, -0.1]]) {
    g.beginPath();
    g.arc(s * x, s * y, s * 0.1, 0, TAU);
    g.fill();
  }
}

function board() {
  const group = new THREE.Group();
  const picture = canvasTexture([1024, 660], drawClues);
  const cards = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.966), new THREE.MeshStandardMaterial({ map: picture, transparent: true, roughness: 0.9 }));

  cards.position.z = 0.075;
  cards.renderOrder = 3;
  group.add(box(1.74, 1.2, 0.09, standard(C.woodDark, 0.7), 0, 0, 0, 0.045), box(1.58, 1.04, 0.05, standard(0xe2b276, 0.95), 0, 0, 0.045, 0.025), cards);
  group.scale.setScalar(0.6);

  return group;
}

// ---- the round door: a mint leaf in a stone ring with a round knob in its middle, on one round step
function door() {
  const group = new THREE.Group();
  const stone = standard(0xf0e3d2, 0.85);
  const leaf = cylinder(0.41, 0.41, 0.1, standard(C.mint, 0.55), 0, 0, 0, 72);

  leaf.rotation.x = Math.PI / 2;
  group.add(
    mesh(new THREE.TorusGeometry(0.42, 0.065, 16, 72), stone, 0, 0, 0.02), leaf,
    mesh(new THREE.TorusGeometry(0.27, 0.026, 12, 64), standard(C.mintDeep, 0.55), 0, 0, 0.05),
    sphere(0.07, standard(0xf2bf2a, 0.25, { metalness: 0.75 }), 0, 0, 0.1),
    cylinder(0.4, 0.45, 0.07, stone, 0, -DOOR.y + 0.035, 0.26, 64),
  );
  group.children.at(-1).scale.z = 0.5;

  return group;
}

// ---- the frosted round window: a pane that glows in a round frame, with one bar across and one down
function pane() {
  const group = new THREE.Group();
  const trim = standard(0xb4563f, 0.75);
  const glass = cylinder(0.2, 0.2, 0.04, lit(0xffdf8a, 2.0), 0, 0, 0, 48);
  const glow = halo(0.45, 0xffd890, 0.5);
  const light = new THREE.PointLight(0xffd9a0, 5, 4.5, 1.8);

  glass.rotation.x = Math.PI / 2;
  glow.position.z = 0.12;
  light.position.z = 0.8;
  group.add(glass, mesh(new THREE.TorusGeometry(0.21, 0.05, 14, 48), trim, 0, 0, 0.01), glow, light, cylinder(0.02, 0.02, 0.4, trim, 0, 0, 0.03, 12), cylinder(0.02, 0.02, 0.4, trim, 0, 0, 0.03, 12).rotateZ(Math.PI / 2));

  return group;
}

// ---- the street lamp: a round foot, a pole that bends over the street, a globe that is a real light, a cone of
// light and its pool
function lamp() {
  const group = new THREE.Group();
  const iron = standard(0x3d4268, 0.5, { metalness: 0.3 });
  const H = LAMP.height;
  const out = LAMP.reach;
  const fall = canvasTexture([8, 256], (g, w, h) => {
    const fade = g.createLinearGradient(0, 0, 0, h);

    fade.addColorStop(0, 'rgba(255,220,140,0.62)');
    fade.addColorStop(0.5, 'rgba(255,220,140,0.26)');
    fade.addColorStop(1, 'rgba(255,220,140,0.03)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.66, H - 0.12, 64, 1, true), new THREE.MeshBasicMaterial({ map: fall, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const globe = sphere(0.19, lit(0xffe6a8, 2.6), out, H, 0);
  const glow = halo(0.62, 0xffd27a, 0.7);
  const light = new THREE.PointLight(0xffcf8a, 9, 6, 1.7);

  cone.position.set(out, (H - 0.12) / 2 + 0.02, 0);
  cone.renderOrder = 5;
  globe.castShadow = false;
  glow.position.set(out, H, 0);
  light.position.set(out + 0.2, H - 0.3, 0.5);
  group.add(
    lathe([[0, 0], [0.2, 0], [0.22, 0.06], [0.12, 0.16], [0.075, 0.3], [0.055, 0.5], [0.05, H - 0.1], [0, H - 0.1]], iron),
    mesh(new THREE.TorusGeometry(0.07, 0.03, 12, 32), iron, 0, 1.25, 0).rotateX(Math.PI / 2),
    // the crook: up, over and down to the globe's cap
    tube([[0, H - 0.2, 0], [0.02, H + 0.3, 0], [out * 0.5, H + 0.52, 0], [out * 0.92, H + 0.42, 0], [out, H + 0.2, 0]], 0.048, iron, 40),
    sphere(0.048, iron, 0, H - 0.2, 0),
    sphere(0.21, iron, out, H + 0.17, 0, 0.36),
    cone, globe, glow, light,
  );

  return { group, cone, glow };
}

// ---- the magnifying glass: a brass ring, a clear lens with a shine, a round wooden handle
function magnifier() {
  const group = new THREE.Group();
  const brass = standard(0xf2bf2a, 0.28, { metalness: 0.7 });
  const R = 0.36;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({
    map: radial([[0, 'rgba(210,255,244,0.10)'], [0.7, 'rgba(190,246,255,0.20)'], [1, 'rgba(160,230,255,0.5)']]), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  const shine = sprite(TEXTURES.dot, 0xffffff, 10);
  const handle = new THREE.Group();

  lens.renderOrder = 8;
  shine.scale.set(0.3, 0.1, 1);
  shine.material.rotation = 0.7;
  shine.material.opacity = 0.85;
  shine.position.set(-0.16, 0.19, 0.02);
  handle.add(cylinder(0.05, 0.045, 0.1, brass, 0, -R - 0.07, 0, 24), cylinder(0.058, 0.066, 0.34, standard(C.woodDark, 0.6), 0, -R - 0.29, 0, 24), sphere(0.066, standard(C.woodDark, 0.6), 0, -R - 0.46, 0));
  group.add(mesh(new THREE.TorusGeometry(R, 0.05, 16, 72), brass), lens, shine, handle);

  return group;
}

/** A round hat with a soft brim and a band, one unit wide at the crown: scaled to each head. */
function hat(color, band) {
  const group = new THREE.Group();

  group.add(
    lathe([[0, 0.02], [1.5, 0], [1.72, 0.03], [1.78, 0.1], [1.66, 0.16], [1.08, 0.2], [1.0, 0.34], [0.97, 0.78], [0.84, 1.0], [0.5, 1.12], [0, 1.16]], standard(color, 0.8)),
    cylinder(1.03, 1.05, 0.2, standard(band, 0.6), 0, 0.33, 0, 48),
  );

  return group;
}

// each hat: the crown's radius, where its brim sits from the head bone (up, and forward along the snout), how far it
// tips back, and how tall its crown is (Dina's has room for her crest)
const HATS = { liruf: [0.17, 0.45, 0.0, -0.1, 1], zara: [0.16, 0.17, 0.0, -0.12, 1], dina: [0.22, 0.26, 0.17, -0.1, 1.4] };

// ---- far behind: a cloud of night blue, a moon, a few stars
function night(fx, loop) {
  const group = new THREE.Group();
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const deep = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    deep.addColorStop(0, 'rgba(24,30,104,0.95)');
    deep.addColorStop(0.55, 'rgba(34,44,132,0.8)');
    deep.addColorStop(0.82, 'rgba(54,66,176,0.28)');
    deep.addColorStop(1, 'rgba(54,66,176,0)');
    g.fillStyle = deep;
    g.fillRect(0, 0, w, w);

    // the lamp's warmth on the left, the moon's cool light on the right
    for (const [x, y, r, color] of [[0.26, 0.5, 0.26, '255,190,110'], [0.6, 0.36, 0.3, '120,190,255']]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},0.22)`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), new THREE.MeshBasicMaterial({ color: 0xfff6d6, toneMapped: false }));
  const shine = halo(1.1, 0xfff0c0, 0.4);

  cloud.position.set(0, 1.05, -8);
  cloud.scale.set(10.0, 4.7, 1);
  moon.position.set(MOON.x, MOON.y, -6.5);
  shine.position.set(MOON.x, MOON.y, -6.6);
  shine.renderOrder = 1;
  group.add(cloud, shine, moon);

  // two round marks on the moon, so it is a moon and not a lamp
  for (const [x, y, r] of [[-0.15, 0.12, 0.11], [0.14, -0.1, 0.08], [0.1, 0.2, 0.05]]) {
    const mark = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0xf0e0b0, toneMapped: false }));

    mark.position.set(MOON.x + x * 0.84, MOON.y + y * 0.84, -6.0);
    group.add(mark);
  }

  const next = sequence(29);
  const updates = [];

  for (let i = 0; i < 34; i++) {
    const a = next() * TAU;
    const r = 0.35 + Math.sqrt(next()) * 0.65;
    const star = sprite(i % 5 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0xfff0b8, 0xdcd9ff][i % 3], 1);
    const size = (i % 5 ? 0.05 : 0.2) + next() * 0.06;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    star.position.set(Math.cos(a) * r * 4.2, 1.6 + Math.abs(Math.sin(a)) * r * 1.45, -7.5);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.55 + 0.45 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = twinkle;
    });
  }

  return { group, update: (t) => { for (const update of updates) update(t); } };
}

export function build(scene, { loop, heights, jump, tuck, curve, number, Y, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const far = night(fx, loop);
  const post = lamp();
  const glassTool = magnifier();
  const clues = board();
  const house = front(HOUSE.width, HOUSE.height, 0xeaa586, 0xcf7d60, 0xb4563f, 7);

  set.add(place(street(), 0, STREET.z), shadowCatcher(STREET.radius - 0.12, 0.008, STREET.z, 0.36), far.group);
  set.add(decal(radial([[0, 'rgba(40,46,130,0.30)'], [0.6, 'rgba(40,46,130,0.15)'], [1, 'rgba(40,46,130,0)']]), 0, -0.7, STREET.z, 3.2, 2.0, 0));

  clues.position.set(BOARD.x, BOARD.y, 0.2);
  house.add(clues, place(door(), DOOR.x, 0.2, 0, DOOR.y), place(pane(), PANE.x, 0.19, 0, PANE.y));
  set.add(place(house, HOUSE.x, HOUSE.z), place(post.group, LAMP.x, LAMP.z));

  // the pool of light under the lamp
  set.add(decal(radial([[0, 'rgba(255,214,130,0.5)'], [0.6, 'rgba(255,214,130,0.2)'], [1, 'rgba(255,214,130,0)']]), LAMP.x + LAMP.reach, 0.012, LAMP.z, 0.95, 0.95, 3));

  // the trail: prints of round bare feet that give their own light, left and right in turn, each turned the way the
  // walker went
  const print = canvasTexture([128, 128], (g, s) => footprint(g, s / 2, s / 2, s * 0.8, '#ffffff'));
  const prints = TRAIL.angles.map((a, i) => {
    const [x, z] = onTrail(a, TRAIL.radius + (i % 2 ? 0.14 : -0.14));
    const mark = decal(print, x, 0.16, z, 0.25, 0.25, 6);
    const pool = decal(radial([[0, 'rgba(143,251,226,0.4)'], [0.6, 'rgba(143,251,226,0.12)'], [1, 'rgba(143,251,226,0)']], 64), x, 0.015, z, 0.26, 0.17, 3);

    // The walker went round toward the Seed: along the circle, the way the angle grows. A print lying on the stones is
    // a thin line from this camera, so each one hovers over its own pool of light, tipped up toward the reader.
    mark.material.color.set(0x7dfbdc);
    mark.rotation.set(-Math.PI / 2 + 0.85, 0, Math.atan2(-Math.cos(a), Math.sin(a)));
    set.add(pool, mark);

    return { mark, pool, at: i / (TRAIL.angles.length - 1) };
  });

  // the lost Seed, golden, turning just above the stones in its own light
  const lost = seedMesh(0.52);
  const lostGlow = halo(0.7, 0xffd36b, 0.6);
  const lostRays = sprite(TEXTURES.star, 0xffe08a, 5);
  const lostLight = new THREE.PointLight(0xffd070, 4, 4, 1.8);

  lost.material = standard(0xf2bf2a, 0.25, { metalness: 0.75, emissive: 0x7a5200, emissiveIntensity: 0.6 });
  lost.castShadow = false;
  lostLight.position.set(LOST.x - 0.3, LOST.y + 0.3, LOST.z + 0.3);
  set.add(lost, lostLight, decal(radial([[0, 'rgba(255,214,110,0.55)'], [0.6, 'rgba(255,214,110,0.2)'], [1, 'rgba(255,214,110,0)']]), LOST.x, 0.014, LOST.z, 0.75, 0.75, 3));
  fx.add(lostGlow, lostRays, glassTool);

  const cast = {
    // Liruf, the farthest from the Seed, jumps the highest to see it over the others
    liruf: { x: -2.18, z: -0.1, yaw: 0.34, act: {
      hop: jump(2.75, 0.22), tuck: tuck(2.75, 0.9), yaw: [[0, -0.45], [1.3, -0.45], [2.2, 0.3], [5.4, 0.3], [6.8, -0.45], [L, -0.45]],
      pitch: [[0, 0.1], [1.3, 0.1], [2.75, -0.22], [3.5, -0.05], [5.4, -0.05], [6.8, 0.1], [L, 0.1]], roll: [[0, -0.12], [2.75, 0.14], [4.6, 0.04], [L, -0.12]],
      lean: [[0, 0.1], [2.2, 0.06], [2.75, -0.1], [3.4, 0.12], [L, 0.1]], tilt: [[0, 0], [2.75, 0.1], [3.5, 0.04], [5.4, 0.04], [L, 0]], turn: [[0, -0.1], [1.4, -0.1], [2.5, 0.05], [5.4, 0.05], [6.8, -0.1], [L, -0.1]],
    } },
    // Zara reads the board over her shoulder, then points at the Seed
    zara: { x: -1.43, z: 0.3, yaw: 0.2, act: {
      hop: jump(2.45, 0.14), tuck: tuck(2.45, 0.5), yaw: [[0, -0.3], [1.5, -0.3], [2.2, 0.55], [5.2, 0.55], [6.4, -0.3], [L, -0.3]],
      pitch: [[0, -0.12], [1.5, -0.12], [2.3, 0.08], [5.2, 0.08], [6.4, -0.12], [L, -0.12]], roll: [[0, -0.1], [2.3, 0.1], [5.2, 0.1], [L, -0.1]],
      lean: [[0, 0], [2.3, 0.1], [5.2, 0.08], [6.4, 0], [L, 0]], tilt: [[0, 0], [2.3, 0.07], [5.2, 0.07], [6.4, 0], [L, 0]], turn: [[0, -0.15], [1.5, -0.15], [2.3, 0.22], [5.2, 0.22], [6.4, -0.15], [L, -0.15]],
    } },
    // Rho studies the stones at his feet, then leans toward the find and jumps a beat late
    rho: { x: 0.46, z: 0.34, yaw: 0.16, act: {
      hop: jump(3.05, 0.17), tuck: tuck(3.05, 0.7), yaw: [[0, 0.1], [0.9, -0.35], [1.8, 0.2], [2.4, 0.6], [5.6, 0.6], [6.8, 0.1], [L, 0.1]],
      pitch: [[0, 0.16], [1.8, 0.16], [2.4, 0.06], [3.05, -0.2], [3.6, 0.1], [5.6, 0.08], [6.8, 0.16], [L, 0.16]], roll: [[0, 0.08], [2.4, 0.12], [3.05, -0.08], [4.2, 0.12], [L, 0.08]],
      lean: [[0, 0.08], [1.8, 0.08], [2.5, 0.2], [3.05, -0.1], [3.6, 0.16], [5.6, 0.12], [L, 0.08]], tilt: [[0, 0], [2.5, 0.09], [5.6, 0.07], [6.8, 0], [L, 0]], turn: [[0, -0.1], [1.8, -0.1], [2.6, 0.3], [5.6, 0.3], [6.8, -0.1], [L, -0.1]],
    } },
    // Dina has had her nose on the trail all along: she sniffs toward the Seed and rears up when it lights
    dina: { x: 1.45, z: -0.15, yaw: 0.1, act: {
      hop: jump(3.3, 0.12), rear: [[0, 0], [2.85, 0], [3.3, 0.6], [3.95, 0], [L, 0]], yaw: [[0, 0.05], [1.2, 0.15], [2.2, 0.22], [5.6, 0.22], [7, 0.05], [L, 0.05]],
      pitch: [[0, 0.22], [0.7, 0.1], [1.4, 0.24], [2.3, 0.14], [3.3, -0.12], [4, 0.1], [L, 0.22]], roll: [[0, 0.12], [2.3, -0.14], [3.3, 0.06], [4.6, -0.12], [L, 0.12]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.75, zara: 2.45, rho: 3.05, dina: 3.3 }[name], clear: { liruf: 0.6, dina: 0.8 }[name] }));

  const next = sequence(71);
  // the stars the Seed throws off when it is found
  const burst = Array.from({ length: 12 }, (_, i) => {
    const star = sprite(TEXTURES.star, [0xffffff, 0xffe08a, 0xfff3c4][i % 3], 9);

    fx.add(star);

    return { star, a: (i / 12) * TAU + next() * 0.3, reach: 0.4 + next() * 0.3, size: 0.14 + next() * 0.12, delay: next() * 0.25 };
  });
  const path = new THREE.CatmullRomCurve3(SWEEP.map((p) => new THREE.Vector3(...p)));
  // how far along its way the magnifying glass is: it sets out, reaches the Seed, stays in front of it and goes back
  const along = [[0, 0], [0.35, 0], [FOUND, 1], [5.6, 1], [7.5, 0], [L, 0]];
  // a pulse of light runs down the whole trail ahead of it
  const pulse = [[0, -0.2], [FOUND - 0.1, 1.2], [L, 1.2]];
  const pointing = [[0, 0], [2.0, 0], [2.5, 1], [5.2, 1], [5.9, 0], [L, 0]];
  const effects = [
    far.update,
    sparkles(fx, { loop, actors, each: 5 }),
    landings(fx, { actors, color: 0xe6e9ff }),
    // motes in the lamp's cone
    rising(fx, { loop, at: { x: LAMP.x + LAMP.reach, y: 0.15, z: LAMP.z }, radius: 0.42, height: 2.3, count: 16, color: [0xfff0c0, 0xffffff], size: [0.03, 0.07], seed: 4, sway: 0.08 }),
  ];
  const hats = [];

  scene.add(set, fx);

  return {
    cast,
    still: 2.75,
    camera: { y: 3.2, dist: 13.8, lookY: 1.13 },
    ready(rigs) {
      const at = new THREE.Vector3();

      // each hat is set on its head once, at rest, and belongs to the head bone from then on
      for (const [name, [radius, up, forward, tip, tall]] of Object.entries(HATS)) {
        const rig = rigs[name];
        const one = hat(0xc98f52, C.indigoDeep);
        const facing = rig.holder.rotation.y;
        const f = number(`${name}f`, forward);

        rig.holder.updateWorldMatrix(true, true);
        rig.head.getWorldPosition(at);
        one.scale.setScalar(number(`${name}r`, radius));
        one.scale.y *= tall;
        one.position.set(at.x + Math.sin(facing) * f, at.y + number(`${name}u`, up), at.z + Math.cos(facing) * f);
        one.rotation.set(number(`${name}t`, tip), facing, 0, 'YXZ');
        scene.add(one);
        one.updateMatrixWorld(true);
        rig.head.attach(one);
        hats.push(one);
      }
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const s = curve(along, t);
      const since = t - FOUND;
      // the Seed's light: low while it is lost, bright from the moment it is found until the glass leaves
      const found = Math.max(0, Math.min(1, (since + 0.25) / 0.35)) * Math.max(0, Math.min(1, (6.2 - t) / 0.8));

      // Zara's left arm comes up and out toward the Seed, her right stays at her side
      const point = curve(pointing, t, 0.06);

      rigs.zara.rot('LeftArm', Z, point * 0.6);
      rigs.zara.rot('LeftArm', Y, point * -1.2);
      rigs.zara.rot('LeftForeArm', Z, point * 0.1);

      // the glass lies flat over the prints and stands up as it reaches the Seed
      const up = Math.max(0, Math.min(1, (s - 0.62) / 0.38));
      const q = curve(pulse, t);

      path.getPoint(s, glassTool.position);
      glassTool.position.y += Math.sin(w * 2) * 0.03;
      glassTool.rotation.set(-1.5 + up * up * (3 - 2 * up) * 1.32, -0.1 + Math.sin(w * 2) * 0.05, -0.5 + Math.sin(w) * 0.06);

      for (const { mark, pool, at } of prints) {
        const lit = Math.exp(-(((q - at) / 0.14) ** 2));

        mark.material.opacity = Math.min(1, 0.85 + 0.15 * lit);
        pool.material.opacity = Math.min(1, 0.45 + 0.55 * lit + found * 0.3);
      }

      lost.position.set(LOST.x, LOST.y + Math.sin(w * 2) * 0.04, LOST.z);
      lost.rotation.y = w * 2;
      lost.material.emissiveIntensity = 0.45 + found * 0.9;
      lostGlow.position.set(LOST.x, lost.position.y, LOST.z - 0.05);
      lostGlow.scale.setScalar(1.0 + found * 0.4);
      lostGlow.material.opacity = 0.4 + found * 0.35;
      lostRays.position.copy(lostGlow.position);
      lostRays.scale.setScalar(0.5 + found * 1.2);
      lostRays.material.opacity = 0.25 + found * 0.55;
      lostRays.material.rotation = w;
      lostLight.intensity = 2 + found * 5;

      for (const { star, a, reach, size, delay } of burst) {
        const u = (since - delay) / 1.5;

        star.visible = u > 0 && u < 1;
        star.position.set(LOST.x + Math.cos(a) * (0.25 + u * reach), LOST.y + 0.1 + Math.sin(a) * (0.25 + u * reach) * 0.8 + u * 0.2, LOST.z + 0.1);
        star.scale.setScalar(size * (0.5 + Math.sin(u * Math.PI)));
        star.material.opacity = Math.sin(u * Math.PI);
        star.material.rotation = a + u * 2;
      }

      post.glow.material.opacity = 0.66 + Math.sin(w * 3) * 0.05;
      post.cone.material.opacity = 0.92 + Math.sin(w * 3) * 0.06;

      for (const effect of effects) effect(t);
    },
  };
}
