// Home composition "startup": the four mentors in their company's first office, a corner of a garage, the moment
// they have the idea: a big lightbulb switches on over their heads.
//
// The setting is an island: a round floor of pale concrete with a painted orange line near its edge and a round rug
// in its middle (the mentors' room, where nothing else stands). Behind and above them float the two things a garage
// office has on its walls: on the left the whiteboard with their plan in drawings only (a rocket, a line that
// climbs, Seeds, a small lightbulb), on the right the pegboard with its round tools. On the floor, at the left, a
// trestle desk with a laptop showing a chart and a bean bag in front of it; at the right a rocket built out of
// cardboard and tape. The lightbulb floats between the two boards, and round notes with ideas drawn on them drift
// around it.
//
// No money is shown anywhere, only Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.4, z: -0.6 };
const BOARD = { x: -2.02, y: 2.42, z: -2.3, width: 1.75, height: 1.04 };
const PEGS = { x: 2.02, y: 2.42, z: -2.3, width: 1.6, height: 1.0 };
const BULB = { x: 0.05, y: 2.56, z: -0.9 };
const DESK = { x: -2.78, z: -1.2 };
const ROCKET = { x: 2.98, z: -0.85 };
const IDEA = 1.7; // the second the lightbulb switches on

// ---- the floor: pale concrete, a painted orange line near the edge
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };
    let s = 77;
    const next = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    ring(1, '#c9cbdc');
    ring(0.975, '#e3e4ef');

    // the concrete: soft lighter and darker patches, a few specks
    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 140;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(150,154,190,0.18)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 220; i++) {
      g.fillStyle = 'rgba(120,124,165,0.28)';
      g.beginPath();
      g.arc(next() * w, next() * w, 1.5 + next() * 3, 0, TAU);
      g.fill();
    }

    // the painted line, worn in places
    g.strokeStyle = '#f08a1c';
    g.lineWidth = 26;
    g.lineCap = 'round';

    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(half, half, half * 0.9, (i / 12) * TAU, (i / 12) * TAU + 0.36);
      g.stroke();
    }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), standard(0xffffff, 0.7, { map: top }));

  disc.receiveShadow = true;
  group.add(disc, lathe([[0, -0.5], [2.3, -0.5], [2.95, -0.36], [R - 0.04, -0.16], [R, -0.07], [R - 0.01, -0.01]], standard(0x8d91ab, 0.85)));

  // a round edge, so the floor has no sharp rim
  const edge = mesh(new THREE.TorusGeometry(R - 0.035, 0.045, 14, 128), standard(0xc9cbdc, 0.7), 0, -0.04, 0);

  edge.rotation.x = Math.PI / 2;
  group.add(edge);

  return group;
}

// ---- the rug: round, mint with cream rings and a Seed woven in its middle
function rug(radius) {
  const picture = canvasTexture([1024, 1024], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#fff1cf');
    ring(0.95, '#12b39d');
    ring(0.8, '#fff1cf');
    ring(0.76, '#3cc7b3');
    ring(0.42, '#fff1cf');
    ring(0.385, '#12b39d');

    // round dots between the rings
    g.fillStyle = '#fff1cf';

    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;

      g.beginPath();
      g.arc(half + Math.cos(a) * half * 0.875, half + Math.sin(a) * half * 0.875, 12, 0, TAU);
      g.fill();
    }
  });
  const m = mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 96), [standard(0xfff1cf, 0.95), standard(0xffffff, 0.95, { map: picture }), standard(0xfff1cf, 0.95)], 0, 0.015, 0);

  m.castShadow = false;

  return m;
}

function arrowHead(g, x, y, angle, s) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(-s, -s * 0.7);
  g.lineTo(0, 0);
  g.lineTo(-s, s * 0.7);
  g.stroke();
  g.restore();
}

// ---- the whiteboard: the plan, in marker. It floats, like everything the mentors are thinking about.
function whiteboard() {
  const group = new THREE.Group();
  const { width, height } = BOARD;
  const picture = canvasTexture([1280, Math.round((1280 * height) / width)], (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // left: a rocket on its way up, a dotted path behind it
    g.save();
    g.translate(w * 0.17, h * 0.42);
    g.rotate(0.5);
    g.strokeStyle = '#5c55fd';
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(0, -120);
    g.bezierCurveTo(70, -60, 62, 60, 46, 100);
    g.lineTo(-46, 100);
    g.bezierCurveTo(-62, 60, -70, -60, 0, -120);
    g.stroke();
    g.beginPath();
    g.arc(0, -20, 24, 0, TAU);
    g.stroke();
    g.strokeStyle = '#eb7301';
    g.beginPath();
    g.moveTo(-28, 122);
    g.quadraticCurveTo(0, 210, 28, 122);
    g.stroke();
    g.restore();
    g.fillStyle = '#8f8aff';

    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w * 0.1 - i * 16, h * 0.78 + i * 26, 8, 0, TAU); g.fill(); }

    // middle and right: a line that climbs, with a Seed at each step
    const steps = [[0.36, 0.84], [0.48, 0.7], [0.58, 0.74], [0.7, 0.52], [0.8, 0.56], [0.92, 0.26]];

    g.strokeStyle = '#05a893';
    g.lineWidth = 15;
    g.beginPath();
    steps.forEach(([x, y], i) => (i ? g.lineTo(w * x, h * y) : g.moveTo(w * x, h * y)));
    g.stroke();
    arrowHead(g, w * 0.92, h * 0.26, -1.1, 44);
    drawSeed(g, w * 0.48, h * 0.48, 110, '#2d2a4a', '#fff1cf');
    drawSeed(g, w * 0.7, h * 0.3, 126, '#2d2a4a', '#fff1cf');

    // top left: a small lightbulb
    g.strokeStyle = '#ff6fa5';
    g.lineWidth = 11;
    g.beginPath();
    g.arc(w * 0.4, h * 0.2, 40, Math.PI * 0.72, Math.PI * 0.28);
    g.lineTo(w * 0.4 + 16, h * 0.2 + 62);
    g.lineTo(w * 0.4 - 16, h * 0.2 + 62);
    g.closePath();
    g.stroke();

    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;

      g.beginPath();
      g.moveTo(w * 0.4 + Math.cos(a) * 60, h * 0.2 + Math.sin(a) * 60);
      g.lineTo(w * 0.4 + Math.cos(a) * 80, h * 0.2 + Math.sin(a) * 80);
      g.stroke();
    }
  });
  const frame = standard(0x8f93b4, 0.5, { metalness: 0.2 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: picture, roughness: 0.45, emissive: 0xffffff, emissiveMap: picture, emissiveIntensity: 0.35 }));

  face.position.set(0, 0, 0.036);
  face.receiveShadow = true;
  group.add(box(width + 0.14, height + 0.14, 0.06, frame, 0, 0, 0, 0.09), face);

  // a tray for the markers, and three markers on it
  group.add(box(width * 0.5, 0.045, 0.1, frame, 0, -height / 2 - 0.085, 0.07, 0.02));

  for (const [i, color] of [C.indigo, C.orange, C.mint].entries()) {
    const marker = cylinder(0.022, 0.022, 0.2, standard(color, 0.4), -0.3 + i * 0.3, -height / 2 - 0.04, 0.08, 16);

    marker.rotation.z = Math.PI / 2;
    group.add(marker);
  }

  return group;
}

// ---- the desk: a board on two trestles, a laptop showing a chart, a mug
function desk() {
  const group = new THREE.Group();
  const wood = standard(C.woodPale, 0.7);
  const leg = standard(C.wood, 0.75);
  const shell = standard(0xd8daea, 0.35, { metalness: 0.4 });
  const picture = canvasTexture([512, 340], (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);

    sky.addColorStop(0, '#2a2e6a');
    sky.addColorStop(1, '#181a3c');
    g.fillStyle = sky;
    g.beginPath();
    g.roundRect(0, 0, w, h, 40);
    g.fill();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    [0.2, 0.3, 0.26, 0.44, 0.58].forEach((size, i) => {
      g.strokeStyle = i === 4 ? '#ffd36b' : '#7fb4ff';
      g.lineWidth = 46;
      g.beginPath();
      g.moveTo(84 + i * 86, h * 0.82);
      g.lineTo(84 + i * 86, h * (0.84 - size));
      g.stroke();
    });
    g.strokeStyle = '#35e0b8';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(60, h * 0.5);
    g.lineTo(190, h * 0.38);
    g.lineTo(280, h * 0.42);
    g.lineTo(440, h * 0.12);
    g.stroke();
    arrowHead(g, 440, h * 0.12, -0.6, 30);
  });
  const lid = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.37), new THREE.MeshBasicMaterial({ map: picture, transparent: true, toneMapped: false }));
  const glow = new THREE.PointLight(0x8fb8ff, 2.5, 3, 1.8);

  group.add(box(1.12, 0.07, 0.62, wood, 0, 0.74, 0, 0.035));

  for (const x of [-0.38, 0.38]) {
    for (const z of [-1, 1]) group.add(tube([[x, 0.7, z * 0.08], [x, 0.36, z * 0.2], [x, 0.03, z * 0.3]], 0.032, leg, 12), sphere(0.045, leg, x, 0.04, z * 0.3));

    group.add(cylinder(0.026, 0.026, 0.38, leg, x, 0.36, 0, 12));
    group.children[group.children.length - 1].rotation.x = Math.PI / 2;
  }

  // the laptop, open toward the reader
  lid.position.set(-0.14, 0.8, -0.1);
  lid.rotation.x = -0.22;
  screen.position.set(0, 0.215, 0.019);
  lid.add(box(0.62, 0.43, 0.03, shell, 0, 0.215, 0, 0.03), screen);
  glow.position.set(-0.12, 1.0, 0.5);
  group.add(box(0.62, 0.03, 0.42, shell, -0.14, 0.79, 0.1, 0.015), lid, glow);

  // a mug with two pencils in it
  group.add(lathe([[0, 0], [0.06, 0], [0.07, 0.02], [0.07, 0.14], [0.06, 0.15], [0, 0.15]], standard(C.pink, 0.5), 0.36, 0.775, 0.08, 32));

  for (const [dx, lean, color] of [[-0.015, 0.2, C.gold], [0.02, -0.25, C.sky]]) {
    const pencil = cylinder(0.012, 0.012, 0.2, standard(color, 0.5), 0.36 + dx, 0.97, 0.08, 12);

    pencil.rotation.z = lean;
    group.add(pencil, sphere(0.014, standard(C.pink, 0.5), 0.36 + dx - Math.sin(lean) * 0.1, 0.97 + Math.cos(lean) * 0.1, 0.08));
  }

  return group;
}

// ---- a bean bag: a soft round sack with a dent where somebody sat
function beanBag(radius, color) {
  const group = new THREE.Group();
  const cloth = standard(color, 0.85);
  const body = lathe([[0, 0], [radius * 0.8, 0], [radius, radius * 0.2], [radius * 0.98, radius * 0.5], [radius * 0.8, radius * 0.86], [radius * 0.5, radius * 1.02], [radius * 0.25, radius * 1.0], [0, radius * 0.94]], cloth);

  group.add(body, sphere(radius * 0.09, cloth, 0, radius * 1.0, 0, 0.7));

  return group;
}

// ---- the rocket model: cardboard tubes, tape, a paper window, three round fins and paper flames
function rocketModel() {
  const group = new THREE.Group();
  const card = standard(0xd6a26a, 0.9);
  const cardDark = standard(0xbd8750, 0.9);
  const tape = standard(0xf3ead2, 0.6);
  const hatch = new THREE.Group();

  group.add(
    lathe([[0, 0.34], [0.27, 0.34], [0.3, 0.38], [0.3, 1.2], [0.27, 1.26], [0, 1.26]], card),
    lathe([[0.3, 1.24], [0.27, 1.42], [0.2, 1.6], [0.1, 1.74], [0.03, 1.79], [0, 1.8]], cardDark),
    cylinder(0.305, 0.305, 0.06, tape, 0, 1.23, 0, 48),
    cylinder(0.305, 0.305, 0.06, tape, 0, 0.56, 0, 48),
    cylinder(0.18, 0.24, 0.12, cardDark, 0, 0.3, 0, 32),
  );

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const fin = box(0.05, 0.46, 0.26, cardDark, Math.sin(a) * 0.34, 0.25, Math.cos(a) * 0.34, 0.025);

    fin.rotation.y = a;
    group.add(fin);
  }

  // the window: a ring of blue paper stuck on, toward the reader
  hatch.add(mesh(new THREE.TorusGeometry(0.11, 0.03, 12, 40), standard(C.indigo, 0.5)), mesh(new THREE.CircleGeometry(0.1, 32), standard(0x9fd0ff, 0.4)));
  hatch.position.set(Math.sin(-0.3) * 0.3, 0.92, Math.cos(-0.3) * 0.3);
  hatch.rotation.y = -0.3;
  group.add(hatch);

  // paper flames
  for (const [x, z, h, color] of [[0, 0, 0.26, C.orange], [0.08, 0.05, 0.19, C.gold], [-0.08, 0.04, 0.2, C.gold]]) group.add(sphere(0.085, standard(color, 0.7), x, 0.2 - h / 2 + 0.05, z, h / 0.17));

  return group;
}

// ---- the lightbulb: round glass on a ridged base, a filament inside
function lightbulb() {
  const group = new THREE.Group();
  const glassy = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffa800, emissiveIntensity: 0, roughness: 0.15, transparent: true, opacity: 0.7 });
  const metal = standard(0x9a9fc0, 0.3, { metalness: 0.6 });
  const wire = lit(0xff9a2a, 0.2);
  const bulb = lathe([[0.12, 0], [0.13, 0.06], [0.19, 0.17], [0.27, 0.3], [0.29, 0.42], [0.26, 0.54], [0.19, 0.64], [0.1, 0.7], [0, 0.72]], glassy);

  bulb.castShadow = false;
  bulb.renderOrder = 6;
  group.add(
    bulb,
    tube([[-0.07, 0.04, 0], [-0.08, 0.28, 0], [-0.03, 0.4, 0], [0, 0.31, 0], [0.03, 0.4, 0], [0.08, 0.28, 0], [0.07, 0.04, 0]], 0.014, wire, 40),
    cylinder(0.125, 0.11, 0.2, metal, 0, -0.1, 0, 32),
    sphere(0.07, standard(C.slate, 0.5), 0, -0.2, 0, 0.8),
  );

  for (const y of [-0.04, -0.1, -0.16]) {
    const ridge = mesh(new THREE.TorusGeometry(0.122 - (y + 0.04) * -0.1 * 0, 0.02, 10, 40), metal, 0, y, 0);

    ridge.rotation.x = Math.PI / 2;
    group.add(ridge);
  }

  group.children[1].castShadow = false;

  return { group, glassy, wire };
}

// ---- the pegboard of the garage: a round-cornered board full of holes, round tools hanging on it. It floats too.
function pegboard() {
  const group = new THREE.Group();
  const { width, height } = PEGS;
  const holes = canvasTexture([1024, Math.round((1024 * height) / width)], (g, w, h) => {
    g.fillStyle = '#f3d3a4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,96,52,0.55)';

    for (let x = 40; x < w; x += 64) for (let y = 40; y < h; y += 64) { g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
  });
  const steel = standard(0xc9cbdc, 0.3, { metalness: 0.6 });
  const red = standard(C.red, 0.45);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), standard(0xffffff, 0.8, { map: holes }));
  const hung = (x, y, ...parts) => {
    const one = new THREE.Group();

    one.position.set(x, y, 0.07);
    one.add(...parts, sphere(0.022, steel, 0, 0, -0.01));
    group.add(one);

    return one;
  };

  face.position.z = 0.036;
  face.receiveShadow = true;
  group.add(box(width + 0.14, height + 0.14, 0.06, standard(C.wood, 0.6), 0, 0, 0, 0.09), face);

  // a mallet: a round red head on a round handle
  const head = cylinder(0.075, 0.075, 0.24, red, 0, -0.02, 0, 24);
  const ends = [-1, 1].map((side) => { const end = sphere(0.075, red, side * 0.12, -0.02, 0, 1); end.scale.x = 0.5; return end; });

  head.rotation.z = Math.PI / 2;
  hung(-0.52, 0.3, cylinder(0.024, 0.024, 0.42, standard(C.woodDark, 0.6), 0, -0.21, 0, 12), sphere(0.03, standard(C.woodDark, 0.6), 0, -0.42, 0), head, ...ends);

  // a spanner: a ring at each end of a round bar
  hung(-0.12, 0.3, cylinder(0.02, 0.02, 0.36, steel, 0, -0.26, 0, 12), mesh(new THREE.TorusGeometry(0.06, 0.022, 10, 28), steel, 0, -0.06, 0), mesh(new THREE.TorusGeometry(0.045, 0.02, 10, 28), steel, 0, -0.46, 0));

  // two rolls of tape and a coil of cable
  hung(0.28, 0.24, mesh(new THREE.TorusGeometry(0.09, 0.045, 12, 36), standard(C.gold, 0.5), 0, -0.1, 0));
  hung(0.28, -0.12, mesh(new THREE.TorusGeometry(0.07, 0.036, 12, 36), standard(C.sky, 0.5), 0, -0.08, 0));
  hung(0.58, 0.3, mesh(new THREE.TorusGeometry(0.12, 0.022, 10, 40), standard(C.orange, 0.5), 0, -0.13, 0), mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 40), standard(C.orange, 0.5), 0.01, -0.15, 0.03), mesh(new THREE.TorusGeometry(0.085, 0.022, 10, 40), standard(C.orange, 0.5), -0.01, -0.17, 0.05));

  // a round brush, and a Seed kept on a small round ledge
  hung(-0.5, -0.14, cylinder(0.02, 0.02, 0.16, standard(C.mint, 0.5), 0, -0.08, 0, 12), sphere(0.05, standard(C.cream, 0.8), 0, -0.2, 0, 1.3));

  const kept = seedMesh(0.2);

  kept.position.set(-0.02, -0.24, 0.1);
  group.add(box(0.36, 0.035, 0.12, standard(C.wood, 0.6), -0.02, -0.36, 0.09, 0.016), kept);

  return group;
}

// ---- an idea: a round note of colored paper with a drawing on it
function note(color, draw) {
  const picture = canvasTexture([128, 128], (g, s) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 2, 0, TAU);
    g.fill();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    draw(g, s);
  });
  const one = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshStandardMaterial({ map: picture, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: picture, emissiveIntensity: 0.25 }));

  one.castShadow = true;

  return one;
}

// what the notes say, in drawings: a Seed, a line that climbs, a sprout, a small lightbulb
const NOTES = [
  ['#ffd36b', (g, s) => drawSeed(g, s / 2, s / 2, s * 0.56, '#2d2a4a', '#fff1cf')],
  ['#ff9fc4', (g, s) => {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.66);
    g.lineTo(s * 0.44, s * 0.5);
    g.lineTo(s * 0.56, s * 0.58);
    g.lineTo(s * 0.74, s * 0.34);
    g.stroke();
  }],
  ['#7fe0cf', (g, s) => {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(s / 2, s * 0.72);
    g.lineTo(s / 2, s * 0.44);
    g.stroke();
    g.fillStyle = '#ffffff';

    for (const side of [-1, 1]) { g.beginPath(); g.ellipse(s / 2 + side * s * 0.13, s * 0.38, s * 0.14, s * 0.075, side * -0.5, 0, TAU); g.fill(); }
  }],
  ['#9cc9ff', (g, s) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(s / 2, s * 0.44, s * 0.17, 0, TAU);
    g.fill();
    g.beginPath();
    g.roundRect(s * 0.43, s * 0.58, s * 0.14, s * 0.13, 5);
    g.fill();
  }],
];

// ---- stars that twinkle beside the mentors and over their heads, never on them: in each gap between two
// neighbours and above each head, brightest in the second around that mentor's jump
const REACH = { liruf: [0.5, 0.5, 0, 2.0], zara: [0.34, 0.34, 0, 2.15], rho: [0.42, 0.42, 0, 1.92], dina: [0.9, 0.62, -0.42, 2.3] };

function twinkles(group, { loop, cast, peaks, colors = [0xffffff, 0xfff0b8, 0xdcd9ff], top = {} }) {
  const next = sequence(11);
  const names = Object.keys(cast).sort((a, b) => cast[a].x - cast[b].x);
  const stars = [];

  for (const [i, name] of names.entries()) {
    const [, right, head, above] = REACH[name];
    const after = names[i + 1];

    // over the head, a little to each side
    for (const side of [-1, 1]) stars.push([cast[name].x + head + side * (0.12 + next() * 0.2), (top[name] ?? above) + next() * 0.3, cast[name].z + 0.3, peaks[name]]);

    if (!after) continue;

    const from = cast[name].x + right;
    const to = cast[after].x - REACH[after][0];

    // in the gap to the next mentor, if there is one
    if (to - from > 0.14) for (const y of [0.55, 1.05]) stars.push([(from + to) / 2, y + next() * 0.2, Math.max(cast[name].z, cast[after].z) + 0.35, peaks[i % 2 ? after : name]]);
  }

  const updates = stars.map(([x, y, z, peak], i) => {
    const s = sprite(TEXTURES.star, colors[i % colors.length]);
    const size = 0.11 + next() * 0.12;
    const speed = 1 + Math.floor(next() * 3);
    const phase = next() * TAU;

    group.add(s);

    return (t) => {
      const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;
      const near = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 1.1);

      s.position.set(x, y + Math.sin((t / loop) * TAU + phase) * 0.05, z);
      s.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
      s.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
      s.material.rotation = phase + (t / loop) * TAU * 0.5;
    };
  });

  return (t) => { for (const update of updates) update(t); };
}

export function build(scene, tools) {
  const { loop, heights, jump, tuck, curve } = tools;
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const idea = lightbulb();
  const model = rocketModel();

  model.scale.setScalar(0.84);

  set.add(place(floor(), 0, FLOOR.z), place(rug(2.0), 0.15, 0.1), shadowCatcher(FLOOR.radius - 0.08, 0.036, FLOOR.z, 0.32));

  // the island's own soft shadow on the page
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.6, FLOOR.z, 4.1, 3.6, 0));
  set.add(
    place(desk(), DESK.x, DESK.z, 0.35),
    place(beanBag(0.4, C.pink), -2.5, 0.8),
    place(model, ROCKET.x, ROCKET.z),
  );

  // the whiteboard and the pegboard float behind the mentors, above their heads
  const panels = [{ panel: whiteboard(), ...BOARD, yaw: 0.28, phase: 0 }, { panel: pegboard(), ...PEGS, yaw: -0.28, phase: 2.6 }];

  for (const { panel, x, y, z, yaw } of panels) set.add(place(panel, x, z, yaw, y));
  idea.group.scale.setScalar(0.85);
  set.add(idea.group);

  // the light of the idea: a halo, short rays around the glass, a real light on the mentors
  const glow = halo(1.0, 0xffd36b, 0);
  const rays = sprite(canvasTexture([512, 512], (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    g.lineWidth = 20;

    // none straight down, where the base is
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.82 + (i / 8) * Math.PI * 1.36;

      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32);
      g.lineTo(Math.cos(a) * s * (i % 2 ? 0.4 : 0.45), Math.sin(a) * s * (i % 2 ? 0.4 : 0.45));
      g.stroke();
    }
  }), 0xf5b400, 7);
  const light = new THREE.PointLight(0xffd070, 0, 7, 1.6);
  const flash = sprite(TEXTURES.ring, 0xfff0b8, 7);

  fx.add(glow, rays, light, flash);

  const UP = [[0, 0], [1.4, 0], [1.9, 1], [4.4, 1], [5.1, 0], [L, 0]];
  const cast = {
    // Liruf reads the chart on the laptop, then looks up at the light and jumps the highest
    liruf: { x: -1.55, z: -0.05, yaw: 0.3, act: {
      hop: jump(2.15, 0.3), tuck: tuck(2.15, 0.9), yaw: [[0, -0.6], [1.5, -0.6], [2.0, 0.45], [4.6, 0.45], [6, -0.6], [L, -0.6]],
      pitch: [[0, 0.05], [1.5, 0.05], [2.0, -0.4], [4.6, -0.3], [6, 0.05], [L, 0.05]], roll: [[0, -0.14], [2.15, 0.14], [5, -0.14], [L, -0.14]],
      lean: [[0, 0.1], [2.15, -0.14], [2.8, 0.08], [6, 0.1], [L, 0.1]], tilt: [[0, -0.05], [2.15, 0.08], [3, 0], [L, -0.05]],
    } },
    // Zara has the idea: one finger straight up at the lightbulb, the other arm at her side
    zara: { x: -0.62, z: 0.4, yaw: 0.1, act: {
      hop: jump(1.95, 0.2), tuck: tuck(1.95, 0.6), lean: [[0, 0.05], [1.95, -0.12], [2.8, -0.03], [L, 0.05]], pitch: [[0, 0.06], [1.4, 0.1], [1.95, -0.3], [4.4, -0.16], [5.2, 0.06], [L, 0.06]],
      roll: [[0, 0.1], [1.95, -0.06], [4.4, 0.1], [L, 0.1]], tilt: [[0, 0], [1.95, 0.05], [3, 0], [L, 0]],
    } },
    // Rho jumps a beat later and lands in a nod: it is a good idea
    rho: { x: 0.52, z: 0.45, yaw: -0.1, act: {
      hop: jump(2.4, 0.18), tuck: tuck(2.4, 0.7), lean: [[0, -0.03], [2.4, -0.16], [2.85, 0.1], [3.5, -0.03], [L, -0.03]],
      pitch: [[0, -0.08], [1.8, -0.34], [2.4, -0.3], [2.85, 0.16], [3.5, -0.1], [5.2, 0.12], [5.8, -0.08], [L, -0.08]], roll: [[0, 0.1], [2.4, -0.12], [4.2, 0.1], [L, 0.1]], yaw: [[0, 0.2], [1.8, -0.15], [4, 0.1], [L, 0.2]],
    } },
    // Dina sniffs at the notes drifting by, and rears up at the light
    dina: { x: 1.72, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.6, 0.12), rear: [[0, 0], [2.1, 0], [2.6, 1], [3.3, 0], [L, 0]], pitch: [[0, -0.24], [2.6, -0.44], [3.4, -0.2], [5.5, -0.3], [L, -0.24]],
      roll: [[0, 0.2], [2.6, -0.1], [4.4, 0.2], [L, 0.2]], yaw: [[0, -0.2], [2, 0.3], [4, 0.45], [6, 0.0], [L, -0.2]],
    } },
  };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: { liruf: 2.15, zara: 1.95, rho: 2.4, dina: 2.6 }[name] }));
  // the ideas: round notes that drift around the lightbulb, each on its own small path
  const notes = [[-1.05, 3.3, 0.6], [1.15, 3.3, 2.4], [-0.5, 3.6, 4.1], [0.6, 3.62, 5.5]].map(([x, y, phase], i) => {
    const one = note(...NOTES[i]);

    fx.add(one);

    return { one, x, y, phase };
  });
  const effects = [
    twinkles(fx, { loop, cast, peaks: { liruf: 2.15, zara: 1.95, rho: 2.4, dina: 2.6 }, colors: [0xffffff, 0xfff0b8, 0xffd36b] }),
    landings(fx, { actors, color: 0xfff3dd }),
    // sparks of the idea, falling up from the lightbulb, and dust in its light
    rising(fx, { loop, at: { x: BULB.x, y: BULB.y + 0.1, z: BULB.z + 0.2 }, radius: 0.85, height: 0.95, count: 14, color: [0xffe6a3, 0xffffff, 0xffc93a], size: [0.07, 0.14], seed: 12, texture: TEXTURES.star }),
    rising(fx, { loop, at: { x: 0, y: 0.3, z: -0.8 }, radius: 2.8, height: 2.3, count: 24, color: [0xfff2c0, 0xffffff], size: [0.025, 0.055], seed: 6, sway: 0.1, depth: 0.7 }),
  ];
  scene.add(set, fx);

  return {
    cast,
    still: 2.1,
    camera: { y: 2.3, dist: 14.1, lookY: 1.52 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - IDEA;
      // it flickers twice, comes on, and goes out slowly before the loop ends
      const flicker = since < 0 ? 0 : since < 0.08 ? 1 : since < 0.16 ? 0.15 : since < 0.24 ? 1 : since < 0.3 ? 0.3 : 1;
      const on = flicker * Math.max(0, Math.min(1, (L - 0.5 - t) / 1.2));
      const y = BULB.y + Math.sin(w * 2) * 0.05;

      idea.group.position.set(BULB.x, y, BULB.z);
      idea.group.rotation.z = Math.sin(w) * 0.07;
      idea.glassy.emissiveIntensity = on * 0.6;
      idea.glassy.opacity = 0.62 + on * 0.36;
      idea.wire.emissiveIntensity = 0.3 + on * 3;
      glow.position.set(BULB.x, y + 0.34, BULB.z - 0.2);
      glow.material.opacity = on * 0.6;
      rays.position.set(BULB.x, y + 0.36, BULB.z + 0.1);
      rays.scale.setScalar(1.55 * (0.9 + 0.1 * Math.sin(w * 4)) * (0.6 + 0.4 * Math.min(1, Math.max(0, since) / 0.3)));
      rays.material.opacity = on;
      rays.material.rotation = -idea.group.rotation.z;
      light.position.set(BULB.x, y - 0.1, BULB.z + 0.8);
      light.intensity = on * 7;

      const burst = (since - 0.24) / 0.6;

      flash.visible = burst > 0 && burst < 1;
      flash.position.set(BULB.x, y + 0.34, BULB.z + 0.3);
      flash.scale.setScalar(0.7 + burst * 1.8);
      flash.material.opacity = 0.8 * (1 - burst);

      // Zara's right arm goes straight up, a finger at the lightbulb
      const up = curve(UP, t);

      rigs.zara.rot('RightArm', tools.Z, -up * 2.5);
      rigs.zara.rot('RightForeArm', tools.Z, -up * 0.2);

      for (const { panel, y: rest, phase } of panels) panel.position.y = rest + Math.sin(w + phase) * 0.04;

      for (const { one, x, y: rest, phase } of notes) {
        one.position.set(x + Math.sin(w + phase) * 0.07, rest + Math.sin(w * 2 + phase) * 0.06, BULB.z - 0.1);
        one.rotation.set(Math.sin(w * 2 + phase) * 0.25, Math.sin(w + phase) * 0.5, Math.sin(w + phase * 2) * 0.2);
      }

      for (const effect of effects) effect(t);
    },
  };
}
