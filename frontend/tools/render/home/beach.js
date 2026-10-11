// Home composition "beach": the four mentors play on a beach, the moment the beach ball is at the top of its bounce
// in front of them and Rho, who has not taken his eyes off it, follows it up.
//
// The setting is an island of sand whose back is under water, in front of a wide piece of sea and sky: a soft cloud
// that fades to nothing before the frame's borders, with a horizon, three rows of round waves that roll across it,
// the sun in its rays, two clouds and a small sailboat far out. On the sand, from left to right: a sandcastle with
// round towers, shells on its wall, a moat and a flag with a Seed, a bucket and a spade at its foot; behind the
// mentors, in the gap between the two pairs, a striped parasol with a deck chair under it, its pole clear of
// everybody; the ball bouncing in front of that gap, where it touches nobody; and on Dina's side only low things
// in front of her, a surfboard laid on the sand and a starfish. The sea comes up the sand and draws back, and
// throws up drops where it turns. A seagull flies by.
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, mesh, place, radial, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES } from '../home-kit.js';

const SAND = { radius: 3.3, z: -0.6 };
const SHORE = -1.85; // where the sea begins on the island
const CASTLE = { x: -2.6, z: 0.0 };
const BALL = { x: 0.5, z: 1.7, radius: 0.28, height: 1.5 };
const SHADE = { x: 0.035, z: -1.35, height: 2.45 }; // the parasol's foot, and how high its rim is
const SAND_COLOR = 0xf5dfab;
const CASTLE_COLOR = 0xe8c583;
const SEA = 0x3cc6d8;

// ---- the island: dry sand, wet sand along the water, and the sea over its back
function island() {
  const group = new THREE.Group();
  const next = sequence(71);
  const R = SAND.radius;
  // on this picture, across is the island's depth (the sea is on its left) and down is the island's left
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const across = (z) => (((z - SAND.z) / R + 1) / 2) * w;

    g.fillStyle = '#f7e2b0';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 40 + next() * 120;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,246,216,0.5)' : 'rgba(222,186,124,0.3)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 240; i++) {
      g.fillStyle = i % 3 ? 'rgba(196,156,96,0.35)' : 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(next() * w, next() * w, 2 + next() * 4, 0, TAU);
      g.fill();
    }

    // wet sand, then the sea: the shore bends a little, like a bay
    const shore = (offset) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(across(SHORE + offset) - 40, 0);
      g.quadraticCurveTo(across(SHORE + offset) + 60, w / 2, across(SHORE + offset) - 40, w);
      g.lineTo(0, w);
      g.fill();
    };
    const sea = g.createLinearGradient(0, 0, across(SHORE), 0);

    g.fillStyle = '#dcb97c';
    shore(0.42);
    sea.addColorStop(0, '#3cc6d8');
    sea.addColorStop(0.6, '#4fd0d8');
    sea.addColorStop(1, '#9aeade');
    g.fillStyle = sea;
    shore(0);
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0xd9b678, 0.9), standard(0xffffff, 0.9, { map: picture }), standard(0xc9a064, 0.9)], 0, -0.05, 0);
  // the rim: sand around the front, water around the back
  const turn = Math.asin((SHORE - SAND.z + 0.1) / R);
  const rim = (from, length, color) => {
    const arc = mesh(new THREE.TorusGeometry(R - 0.03, 0.08, 14, 128, length), standard(color, 0.9), 0, -0.05, 0);

    arc.rotation.set(Math.PI / 2, 0, from);

    return arc;
  };

  top.castShadow = false;
  group.add(top, rim(turn, Math.PI - turn * 2, 0xe6c98f), rim(Math.PI - turn, Math.PI + turn * 2, SEA), lathe([[0, -0.78], [1.2, -0.72], [2.2, -0.52], [2.9, -0.28], [R - 0.04, -0.1]], standard(0xc9a064, 0.95)));

  return group;
}

/** A line of foam along the shore: a soft white band, bent like the bay. */
function foam() {
  const picture = canvasTexture([512, 64], (g, w, h) => {
    const band = g.createLinearGradient(0, 0, 0, h);

    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band;
    g.fillRect(0, 0, w, h);

    const ends = g.createLinearGradient(0, 0, w, 0);

    ends.addColorStop(0, 'rgba(0,0,0,0)');
    ends.addColorStop(0.12, 'rgba(0,0,0,1)');
    ends.addColorStop(0.88, 'rgba(0,0,0,1)');
    ends.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = ends;
    g.fillRect(0, 0, w, h);
  });
  const geometry = new THREE.PlaneGeometry(5.5, 0.3, 40, 1);
  const at = geometry.attributes.position;

  geometry.rotateX(-Math.PI / 2);

  // the same bend as the shore painted on the sand, with a small ripple along it
  for (let i = 0; i < at.count; i++) at.setZ(i, at.getZ(i) + 0.2 - (at.getX(i) / 2.75) ** 2 * 0.42 + Math.sin(at.getX(i) * 4) * 0.03);

  const line = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: picture, transparent: true, depthWrite: false, toneMapped: false }));

  line.renderOrder = 3;

  return line;
}

// ---- far behind: the piece of sea and sky, with its horizon
function backdrop() {
  const air = sprite(canvasTexture([1024, 612], (g, w, h) => {
    const horizon = h * 0.412;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    const sea = g.createLinearGradient(0, horizon, 0, h);

    sky.addColorStop(0, '#8fcfff');
    sky.addColorStop(1, '#d2efff');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon);
    sea.addColorStop(0, '#2a9fd8');
    sea.addColorStop(0.5, '#33b4da');
    sea.addColorStop(1, '#3cc6d8');
    g.fillStyle = sea;
    g.fillRect(0, horizon, w, h - horizon);

    // a soft line of light along the horizon
    const shine = g.createLinearGradient(0, horizon - 8, 0, horizon + 26);

    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = shine;
    g.fillRect(0, horizon - 8, w, 34);

    // the whole of it is a round cloud that fades to nothing
    g.save();
    g.scale(1, h / w);

    const fade = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.66, 'rgba(0,0,0,0.94)');
    fade.addColorStop(0.86, 'rgba(0,0,0,0.4)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = fade;
    g.fillRect(0, 0, w, w);
    g.restore();
  }), 0xffffff, 0);

  air.position.set(0, 1.13, -8);
  air.scale.set(10.4, 6.2, 1);

  return air;
}

/**
 * A row of round waves across the sea: soft humps side by side, a curl of foam on each. It rolls along by one hump
 * in the loop (`direction` 1 or -1), so the loop closes; the humps shrink to nothing toward the row's two ends.
 */
function waveRow({ z, y, radius, half, color, direction, phase }) {
  const group = new THREE.Group();
  const water = standard(color, 0.5, { emissive: color, emissiveIntensity: 0.22 });
  const white = standard(0xeafcff, 0.6, { emissive: 0xbfe6ff, emissiveIntensity: 0.3 });
  const spacing = radius * 1.25;
  const count = Math.ceil((half * 2) / spacing) + 2;
  const humps = Array.from({ length: count }, (_, i) => {
    const hump = new THREE.Group();
    const body = sphere(radius, water, 0, 0, 0, 0.75);
    const curl = sphere(radius * 0.28, white, -direction * radius * 0.3, radius * 0.62, radius * 0.5, 0.55);

    body.castShadow = false;
    body.receiveShadow = false;
    curl.castShadow = false;
    curl.receiveShadow = false;
    hump.add(body, curl);
    group.add(hump);

    return { hump, curl, i };
  });

  return {
    group,
    update(t, loop) {
      const w = (t / loop) * TAU;

      for (const { hump, curl, i } of humps) {
        const x = -half - spacing + (((i + (direction * t) / loop) % count) + count) % count * spacing;
        const edge = Math.max(0, Math.min(1, (half - Math.abs(x)) / 0.9));
        const swell = Math.sin(w * 2 + i * 1.3 + phase);

        hump.position.set(x, y + swell * 0.05, z);
        hump.scale.setScalar(Math.max(0.001, edge * edge * (3 - 2 * edge)));
        curl.position.y = radius * (0.6 + swell * 0.06);
      }
    },
  };
}

// ---- a cloud: round puffs, white on top and blue underneath
function cloud(scale) {
  const group = new THREE.Group();
  const top = standard(0xf6f8ff, 1, { emissive: 0x9db4ff, emissiveIntensity: 0.22 });
  const under = standard(0x9db0f4, 1, { emissive: 0x7f95e8, emissiveIntensity: 0.3 });

  for (const [x, y, r] of [[-0.5, 0, 0.42], [0.05, 0.14, 0.52], [0.6, 0, 0.38]]) {
    const puff = sphere(r, top, x, y, 0, 0.86);
    const shade = sphere(r * 0.94, under, x, y - r * 0.24, -0.02, 0.6);

    for (const one of [puff, shade]) { one.castShadow = false; one.receiveShadow = false; }

    group.add(shade, puff);
  }

  group.scale.setScalar(scale);

  return group;
}

// ---- the sandcastle: a round wall, four round towers with round battlements, a keep with a dome and a flag,
// shells pressed into the wall and a moat of sea water in front
function castle() {
  const group = new THREE.Group();
  const sand = standard(CASTLE_COLOR, 0.95);
  const dark = standard(0xb98f55, 0.95);
  const tower = (x, z, radius, height) => {
    group.add(lathe([[0, 0], [radius * 1.12, 0], [radius, 0.1], [radius, height - 0.07], [radius * 1.18, height - 0.02], [radius * 1.18, height + 0.05], [0, height + 0.05]], sand, x, 0, z, 40));

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;

      group.add(sphere(radius * 0.32, sand, x + Math.cos(a) * radius * 0.94, height + 0.07, z + Math.sin(a) * radius * 0.94, 0.9));
    }

    group.add(sphere(radius * 0.24, dark, x, height * 0.62, z + radius * 0.94, 1.4));
  };

  // the moat: a round of water a little wider than the castle toward the reader, with a wet bank
  group.add(decal(radial([[0, 'rgba(60,198,216,1)'], [0.8, 'rgba(60,198,216,1)'], [0.86, 'rgba(220,185,124,1)'], [0.96, 'rgba(220,185,124,0.7)'], [1, 'rgba(220,185,124,0)']]), 0, 0.012, 0.12, 0.62, 0.78, 2));
  group.add(lathe([[0, 0], [0.47, 0], [0.47, 0.36], [0.43, 0.43], [0, 0.43]], sand, 0, 0, 0, 48));

  for (const [x, z] of [[-0.36, 0.28], [0.36, 0.28], [-0.36, -0.28], [0.36, -0.28]]) tower(x, z, 0.16, 0.7);

  tower(0, -0.02, 0.24, 1.02);
  group.add(lathe([[0, 0], [0.27, 0], [0.25, 0.1], [0.14, 0.22], [0.05, 0.27], [0, 0.28]], sand, 0, 1.08, -0.02, 40));

  // the gate, and shells along the wall on both sides of it
  const gate = sphere(0.14, dark, 0, 0.1, 0.47, 1.5);

  gate.scale.z = 0.3;
  group.add(gate);

  for (const [a, y, color] of [[-0.38, 0.3, 0xffb3c8], [0.38, 0.3, 0xffffff], [-0.2, 0.37, 0xffd9a0], [0.2, 0.37, 0xffb3c8], [0, 0.39, 0xffffff]]) {
    const shell = sphere(0.045, standard(color, 0.45), Math.sin(a) * 0.47, y, Math.cos(a) * 0.47, 0.9);

    shell.scale.z = 0.5;
    shell.rotation.y = a;
    group.add(shell);
  }

  // the flag: a short pole on the keep and a cloth with a Seed on it
  const picture = canvasTexture([384, 256], (g, w, h) => {
    g.fillStyle = '#5c55fd';
    g.beginPath();
    g.roundRect(0, 0, w, h, [0, 70, 70, 0]);
    g.fill();
    drawSeed(g, w / 2, h / 2, h * 0.66);
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.27, 20, 1), new THREE.MeshStandardMaterial({ map: picture, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }));
  const rest = Float32Array.from(cloth.geometry.attributes.position.array);

  cloth.position.set(0.215, 1.66, -0.02);
  cloth.castShadow = true;
  group.add(cylinder(0.014, 0.016, 0.5, standard(C.wood, 0.7), 0, 1.58, -0.02, 10), sphere(0.03, standard(C.gold, 0.4, { metalness: 0.5 }), 0, 1.84, -0.02), cloth);

  return {
    group,
    wave(w) {
      const at = cloth.geometry.attributes.position;

      for (let i = 0; i < at.count; i++) {
        const along = (rest[i * 3] + 0.2) / 0.4;

        at.setZ(i, Math.sin(along * 5 - w * 4) * 0.04 * along);
      }

      at.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
    },
  };
}

// ---- the parasol: a pole, a round striped top with a soft scalloped rim
function parasol() {
  const group = new THREE.Group();
  const stripes = canvasTexture([512, 64], (g, w, h) => {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#fff1dc' : '#eb7301';
      g.fillRect((k / 8) * w, 0, w / 8 + 1, h);
    }
  });
  const top = new THREE.Group();
  const canopy = lathe([[0.86, 0], [0.84, 0.05], [0.72, 0.2], [0.5, 0.33], [0.24, 0.41], [0.02, 0.43]], standard(0xffffff, 0.7, { map: stripes, side: THREE.DoubleSide }), 0, 0, 0, 64);

  top.add(canopy, sphere(0.05, standard(C.gold, 0.4, { metalness: 0.5 }), 0, 0.45, 0));

  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * TAU;

    top.add(sphere(0.085, standard(Math.floor(i / 2) % 2 ? 0xeb7301 : 0xfff1dc, 0.7), Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85, 0.8));
  }

  top.position.y = SHADE.height;
  top.rotation.z = 0.06;
  group.add(cylinder(0.03, 0.035, SHADE.height + 0.3, standard(0xfff1dc, 0.5), 0, (SHADE.height + 0.3) / 2, 0, 16), top, sphere(0.16, standard(SAND_COLOR, 0.95), 0, 0, 0, 0.4));

  return { group, top };
}

// ---- the deck chair: a low striped seat with a tilted back and a round cushion
function deckChair() {
  const group = new THREE.Group();
  const cloth = standard(0xffffff, 0.8, { map: canvasTexture([256, 64], (g, w, h) => {
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 2 ? '#fff1dc' : '#05a893';
      g.fillRect((k / 6) * w, 0, w / 6 + 1, h);
    }
  }) });
  const wood = standard(C.wood, 0.7);
  const back = box(0.52, 0.09, 0.66, cloth, 0, 0.5, -0.32, 0.045);

  back.rotation.x = -1.0;
  group.add(box(0.52, 0.09, 0.62, cloth, 0, 0.24, 0.12, 0.045), back, sphere(0.11, standard(C.pink, 0.7), 0, 0.72, -0.4, 0.75));

  for (const x of [-0.24, 0.24]) for (const z of [-0.14, 0.36]) group.add(cylinder(0.026, 0.026, 0.22, wood, x, 0.11, z, 10));

  return group;
}

// ---- small things on the sand
function bucket() {
  const group = new THREE.Group();
  const handle = mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 32, Math.PI), standard(0xfff1dc, 0.5), 0, 0.27, 0);
  const spade = new THREE.Group();
  const blade = sphere(0.075, standard(C.sky, 0.5), 0, 0.02, 0);

  blade.scale.set(0.9, 1.2, 0.25);
  spade.add(cylinder(0.014, 0.014, 0.26, standard(C.gold, 0.5), 0, 0.2, 0, 8), blade, sphere(0.028, standard(C.gold, 0.5), 0, 0.34, 0));
  spade.position.set(0.34, 0.03, 0.05);
  spade.rotation.z = -1.25;
  group.add(lathe([[0, 0], [0.11, 0], [0.12, 0.02], [0.155, 0.26], [0.165, 0.28], [0.14, 0.28], [0.13, 0.24], [0, 0.24]], standard(C.red, 0.5)), handle, spade);

  return group;
}

/** A starfish: five round arms around a round middle, nothing pointed. */
function starfish() {
  const group = new THREE.Group();
  const skin = standard(0xff7a59, 0.6);

  group.add(sphere(0.085, skin, 0, 0.03, 0, 0.5));

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const arm = sphere(0.06, skin, Math.sin(a) * 0.11, 0.025, Math.cos(a) * 0.11, 0.45);

    arm.scale.x = 0.75;
    arm.scale.z = 1.5;
    arm.rotation.y = a;
    group.add(arm, sphere(0.014, standard(0xffd9a0, 0.6), Math.sin(a) * 0.1, 0.052, Math.cos(a) * 0.1));
  }

  return group;
}

function surfboard() {
  const group = new THREE.Group();
  const board = sphere(1, standard(C.mint, 0.4), 0, 0.05, 0);
  const stripe = sphere(1, standard(0xfff1dc, 0.4), 0, 0.058, 0);

  board.scale.set(0.6, 0.045, 0.2);
  stripe.scale.set(0.58, 0.045, 0.045);
  group.add(board, stripe);

  return group;
}

// ---- the beach ball: six panels of color and a white cap at each pole
function ball() {
  const picture = canvasTexture([768, 384], (g, w, h) => {
    ['#eb7301', '#fff1dc', '#5c55fd', '#ebb806', '#05a893', '#ff6fa5'].forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect((i / 6) * w, 0, w / 6 + 1, h);
    });
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h * 0.09);
    g.fillRect(0, h * 0.91, w, h * 0.09);
  });
  const one = mesh(new THREE.SphereGeometry(BALL.radius, 48, 32), standard(0xffffff, 0.35, { map: picture }));

  one.receiveShadow = false;

  return one;
}

// ---- the sailboat far out: a round hull and two round-cornered sails
function sailboat() {
  const group = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, Math.PI / 2, Math.PI / 2), standard(C.red, 0.5, { side: THREE.DoubleSide }));
  const deck = mesh(new THREE.CircleGeometry(1, 40), standard(0xfff1dc, 0.6));
  const sail = (width, height, color) => {
    const shape = new THREE.Shape();

    // a quarter of a round shape with every corner rounded off
    shape.moveTo(0.06, 0);
    shape.lineTo(width - 0.1, 0);
    shape.quadraticCurveTo(width, 0, width - 0.04, 0.1);
    shape.quadraticCurveTo(width * 0.5, height * 0.72, 0.1, height - 0.06);
    shape.quadraticCurveTo(0, height, 0, height - 0.1);
    shape.lineTo(0, 0.06);
    shape.quadraticCurveTo(0, 0, 0.06, 0);

    return new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), standard(color, 0.7, { side: THREE.DoubleSide }));
  };
  const main = sail(0.5, 1.0, 0xfff1dc);
  const jib = sail(0.36, 0.76, C.orange);

  hull.scale.set(0.5, 0.2, 0.2);
  deck.rotation.x = -Math.PI / 2;
  deck.scale.set(0.5, 0.2, 1);
  main.position.set(0.03, 0.14, 0);
  jib.position.set(-0.03, 0.14, 0);
  jib.scale.x = -1;
  group.add(hull, deck, cylinder(0.014, 0.014, 1.2, standard(C.wood, 0.7), 0, 0.6, 0, 8), main, jib);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  return group;
}

// ---- a seagull: a round white body, grey wings with darker tips, an orange beak. It flies along +x.
function gull() {
  const group = new THREE.Group();
  const white = standard(0xe4e8fb, 0.6);
  const grey = standard(0x8793c4, 0.6);
  const body = sphere(0.12, white, 0, 0, 0);
  const beak = sphere(0.032, standard(C.orange, 0.5), 0.29, 0.035, 0);
  const tail = sphere(0.07, grey, -0.2, 0.0, 0);
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    const wing = sphere(0.2, grey, 0, 0, side * 0.2);
    const tip = sphere(0.085, standard(0x5a6396, 0.6), -0.02, 0, side * 0.37);

    wing.scale.set(0.55, 0.1, 1);
    tip.scale.set(0.8, 0.12, 0.9);
    hinge.add(wing, tip);
    hinge.position.set(0, 0.04, side * 0.05);
    group.add(hinge);

    return { hinge, side };
  });

  body.scale.set(1.65, 0.8, 0.8);
  beak.scale.set(1.7, 0.7, 0.7);
  tail.scale.set(1.3, 0.25, 0.8);
  group.add(body, sphere(0.075, white, 0.18, 0.05, 0), beak, tail, sphere(0.014, standard(C.ink, 0.4), 0.215, 0.07, 0.06), sphere(0.014, standard(C.ink, 0.4), 0.215, 0.07, -0.06));
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  return { group, wings };
}

/** Stars that twinkle at set places `[x, y, z, size]`: Rho's and Dina's, put by hand beside and above them, never over anybody. */
function twinkles(group, loop, places, peak) {
  const stars = places.map(([x, y, z, size], i) => {
    const star = sprite(TEXTURES.star, [0xffffff, 0xfff0b8][i % 2]);

    star.position.set(x, y, z);
    group.add(star);

    return { star, size, phase: i * 2.1, speed: 1 + (i % 3) };
  });

  return (t) => {
    const near = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - peak) / 1.1);

    for (const { star, size, phase, speed } of stars) {
      const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;

      star.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
      star.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
      star.material.rotation = phase + (t / loop) * TAU * 0.5;
    }
  };
}

export function build(scene, { loop, heights, jump, tuck, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const fort = castle();
  const toy = ball();
  const yacht = sailboat();
  const shade = parasol();
  const lines = [foam(), foam()];
  const rows = [
    waveRow({ z: -4.5, y: -0.115, radius: 0.5, half: 3.8, color: 0x57d4d2, direction: 1, phase: 0 }),
    waveRow({ z: -5.5, y: 0.3, radius: 0.55, half: 4.0, color: 0x40c2dc, direction: -1, phase: 1.7 }),
    waveRow({ z: -6.5, y: 0.69, radius: 0.6, half: 4.2, color: 0x30abdc, direction: 1, phase: 3.1 }),
  ];

  set.add(backdrop(), ...rows.map(({ group }) => group), place(island(), 0, SAND.z), shadowCatcher(SAND.radius - 0.1, 0.008, SAND.z, 0.3));
  set.add(decal(radial([[0, 'rgba(60,60,150,0.3)'], [0.6, 'rgba(60,60,150,0.15)'], [1, 'rgba(60,60,150,0)']]), 0, -0.84, SAND.z, 3.8, 3.5, 0));
  set.add(...lines, place(fort.group, CASTLE.x, CASTLE.z, 0.3), place(bucket(), CASTLE.x + 0.62, CASTLE.z + 1.0, 0.4), toy);
  set.add(place(shade.group, SHADE.x, SHADE.z), place(deckChair(), SHADE.x + 0.6, SHADE.z + 0.2, -0.25));
  set.add(place(surfboard(), 1.95, 1.8, 0.14), place(starfish(), 2.55, 1.05, 1.3), place(starfish(), -1.3, 1.85, 0.4));
  set.add(place(yacht, 4.02, -6.9, 0.2, 1.62), place(cloud(0.55), -3.12, -6, 0, 3.2), place(cloud(0.48), -1.85, -6, 0, 3.5));
  yacht.scale.setScalar(0.8);

  for (const [x, z, r, color] of [[-0.7, 2.25, 0.07, 0xffb3c8], [1.05, 2.3, 0.06, 0xffd9a0], [-1.9, 1.5, 0.05, 0xffffff]]) {
    set.add(sphere(r, standard(color, 0.45), x, r * 0.4, z, 0.6));
  }

  // the sun in its rays: round-ended beams around a round disc, turning slowly
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.45, 64), new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false }));
  const sunGlow = halo(1.3, 0xffc23a, 0.5);
  const rays = sprite(canvasTexture([512, 512], (g, w) => {
    g.translate(w / 2, w / 2);
    g.strokeStyle = 'rgba(255,206,72,0.85)';
    g.lineCap = 'round';

    for (let i = 0; i < 10; i++) {
      g.rotate(TAU / 10);
      g.lineWidth = i % 2 ? 16 : 24;
      g.beginPath();
      g.moveTo(0, w * 0.25);
      g.lineTo(0, w * (i % 2 ? 0.34 : 0.4));
      g.stroke();
    }
  }), 0xffffff, 1);

  sun.position.set(2.36, 2.97, -7);
  sun.renderOrder = 2;
  sunGlow.position.set(2.36, 2.97, -7.1);
  sunGlow.renderOrder = 1;
  rays.position.set(2.36, 2.97, -7.05);
  rays.scale.setScalar(2.5);
  fx.add(sunGlow, rays, sun);

  const bird = gull();

  fx.add(bird.group);

  // glints on the far sea, and drops thrown up along the shore when the sea comes in
  const next = sequence(13);
  const glints = [[-4.6, 1.5], [-3.1, 1.25], [-1.5, 1.55], [0.4, 1.35], [1.9, 1.5], [3.4, 1.2], [4.7, 1.45], [-2.3, 0.6], [1.1, 0.75], [3.9, 0.5], [-4.2, 0.2]].map(([x, y], i) => {
    const glint = sprite(TEXTURES.star, 0xffffff, 3);

    glint.position.set(x, y, -7.6 + (y < 1 ? 1.6 : 0));
    fx.add(glint);

    return { glint, phase: i * 2.3, speed: 2 + (i % 2) };
  });
  const drops = Array.from({ length: 14 }, (_, i) => {
    const drop = sphere(0.05 + next() * 0.03, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xbff3ee, transparent: true, toneMapped: false }), 0, 0, 0);

    drop.castShadow = false;
    fx.add(drop);

    return { drop, x: -2.5 + (i / 13) * 5.0 + (next() - 0.5) * 0.2, height: 0.35 + next() * 0.35, delay: next() * 0.35, drift: (next() - 0.5) * 0.2 };
  });
  // the ball's own soft shadow on the sand, smaller and paler the higher it is
  const under = decal(radial([[0, 'rgba(60,40,120,0.5)'], [0.6, 'rgba(60,40,120,0.2)'], [1, 'rgba(60,40,120,0)']]), BALL.x, 0.014, BALL.z, 1, 1, 3);
  const puff = decal(TEXTURES.ring, BALL.x, 0.02, BALL.z, 1, 1, 3);

  puff.material.color.set(0xfff3dd);
  fx.add(under, puff);

  /** How high the ball is: two bounces in the loop, the top of the first at second 2. */
  const bounce = (t) => Math.abs(Math.sin((t / L) * TAU));
  const watch = (scale, base) => Array.from({ length: 17 }, (_, i) => [i * 0.5, base - bounce(i * 0.5) * scale]);
  const cast = {
    // Liruf stamps about on the sand: two jumps, the second smaller
    liruf: { x: -1.42, z: -0.1, yaw: 0.36, act: {
      hop: [[0, 0], [1.45, 0], [1.68, -0.035], [2.0, 0.3], [2.3, -0.03], [2.5, 0], [5.0, 0], [5.2, -0.03], [5.5, 0.18], [5.8, -0.03], [6.0, 0], [L, 0]], tuck: [[0, 0], [1.7, 0], [2.0, 0.9], [2.3, 0], [5.2, 0], [5.5, 0.6], [5.8, 0], [L, 0]],
      yaw: [[0, 0.3], [2.0, 0.1], [3.6, 0.4], [5.5, 0], [L, 0.3]], pitch: [[0, -0.06], [2.0, -0.28], [2.6, 0], [5.5, -0.2], [6.1, 0], [L, -0.06]],
      lean: [[0, 0.08], [2.0, -0.12], [2.6, 0.1], [5.5, -0.08], [6.1, 0.1], [L, 0.08]], roll: [[0, 0.12], [2.0, -0.12], [4, 0.14], [L, 0.12]], tilt: [[0, 0.05], [2.0, -0.08], [3, 0.05], [L, 0.05]],
    } },
    // Zara jumps with her arms a little out, then dances from one foot to the other, always facing the reader
    zara: { x: -0.5, z: 0.4, yaw: 0.12, act: {
      hop: [[0, 0], [1.5, 0], [1.72, -0.03], [2.0, 0.22], [2.3, 0], [2.9, 0.06], [3.3, 0], [3.7, 0.06], [4.1, 0], [4.5, 0.06], [4.9, 0], [L, 0]], tuck: [[0, 0], [1.72, 0], [2.0, 0.5], [2.3, 0], [L, 0]],
      turn: [[0, 0.2], [1.6, 0.2], [2.3, 0], [2.9, 0.22], [3.7, -0.22], [4.5, 0.22], [5.3, 0], [6.6, 0.2], [L, 0.2]], tilt: [[0, 0], [2.3, 0], [2.9, 0.08], [3.7, -0.08], [4.5, 0.08], [5.3, 0], [L, 0]],
      yaw: [[0, 0.25], [1.6, 0.25], [2.3, 0], [5.4, 0], [6.6, 0.25], [L, 0.25]], lean: [[0, 0], [2.0, -0.1], [2.8, -0.03], [L, 0]],
      roll: [[0, 0.08], [2.0, -0.1], [2.9, 0.12], [3.7, -0.12], [4.5, 0.12], [5.4, 0.08], [L, 0.08]], pitch: [[0, -0.06], [2.0, -0.22], [3, -0.1], [L, -0.06]],
    } },
    // Rho only has eyes for the ball: his head goes up and down with it
    rho: { x: 1.3, z: 0.45, yaw: -0.2, act: {
      turn: [[0, -0.28], [L, -0.28]], yaw: [[0, -0.3], [L, -0.3]], pitch: watch(0.42, 0.26), lean: watch(0.16, 0.1),
      hop: [[0, 0], [3.5, 0], [3.75, -0.03], [4.0, 0.14], [4.3, -0.02], [4.5, 0], [L, 0]], tuck: tuck(4.0, 0.6), roll: [[0, 0.08], [2, -0.08], [4, 0.08], [6, -0.08], [L, 0.08]],
    } },
    // Dina bows to play, front down and tail up, then rears
    dina: { x: 2.54, z: -0.1, yaw: -0.5, act: {
      hop: jump(2.3, 0.12), rear: [[0, 0], [1.85, 0], [2.3, 1], [3.0, 0], [L, 0]], lean: [[0, 0], [0.8, 0.5], [1.6, 0.5], [2.1, 0], [5.0, 0], [5.8, 0.5], [6.8, 0.5], [7.4, 0], [L, 0]],
      yaw: [[0, 0.1], [2.3, -0.2], [4.2, -0.2], [5.4, 0.2], [L, 0.1]], pitch: [[0, -0.1], [0.8, -0.3], [1.6, -0.3], [2.3, -0.42], [3.2, -0.16], [5.8, -0.3], [6.8, -0.3], [L, -0.1]],
      roll: [[0, 0.18], [2.3, -0.1], [5, 0.18], [L, 0.18]],
    } },
  };
  const peaks = { liruf: 2.0, zara: 2.0, rho: 4.0, dina: 2.3 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, name, height: heights[name], peak: peaks[name] }));
  const effects = [
    sparkles(fx, { loop, actors: actors.filter(({ name }) => name === 'liruf'), each: 5, colors: [0xffffff, 0xfff0b8, 0xbfeaff] }),
    twinkles(fx, loop, [[cast.zara.x - 0.45, 1.9, 0.6, 0.15], [cast.rho.x + 0.1, 1.95, 0.6, 0.16], [cast.dina.x + 0.5, 2.15, 0.3, 0.18], [cast.dina.x - 0.3, 2.3, 0.3, 0.14]], 2.1),
    landings(fx, { actors: actors.filter(({ name }) => name !== 'zara'), color: 0xfff3dd }),
  ];

  scene.add(set, fx);

  return {
    cast,
    still: 2.0,
    camera: { y: 2.3, dist: 14.3, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const up = bounce(t);
      // flat for an instant where it hits the sand
      const squash = Math.max(0, 1 - up / 0.12) * 0.22;

      toy.position.set(BALL.x, BALL.radius * (1 - squash) + up * BALL.height, BALL.z);
      toy.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      toy.rotation.set(0.5, w * 2, w);
      under.scale.set(0.42 * (1 - up * 0.45), 0.34 * (1 - up * 0.45), 1);
      under.material.opacity = 1 - up * 0.6;

      const since = ((t + 4) % 4) / 0.6;

      puff.visible = since < 1;
      puff.scale.set(0.4 + since * 0.8, 0.4 + since * 0.8, 1);
      puff.material.opacity = 0.7 * (1 - since);

      // the sea comes up the sand and draws back, twice in the loop
      lines.forEach((line, i) => {
        const reach = Math.sin(w * 2 + i * 2.4);

        line.position.set(0, 0.012 + i * 0.002, SHORE + 0.04 + i * -0.5 + reach * 0.12);
        line.material.opacity = i ? 0.45 + reach * 0.2 : 0.85 + reach * 0.12;
      });

      // and throws up drops where it turns (seconds 1 and 5)
      for (const { drop, x, height, delay, drift } of drops) {
        const u = ((((t - 0.8 - delay) % 4) + 4) % 4) / 0.7;

        drop.visible = u < 1;
        drop.position.set(x + drift * u, 0.04 + Math.sin(u * Math.PI) * height, SHORE + 0.34 - (x / 2.75) ** 2 * 0.42);
        drop.material.opacity = Math.min(1, (1 - u) * 3);
      }

      for (const row of rows) row.update(t, loop);

      for (const { glint, phase, speed } of glints) {
        const twinkle = Math.max(0, Math.sin(w * speed + phase)) ** 3;

        glint.scale.setScalar(0.1 + twinkle * 0.26);
        glint.material.opacity = twinkle;
      }

      yacht.position.y = 1.62 + Math.sin(w * 2) * 0.03;
      yacht.rotation.z = Math.sin(w * 2 + 1) * 0.05;
      fort.wave(w);
      shade.top.rotation.x = Math.sin(w) * 0.025;
      // the rays are ten, so a tenth of a turn brings them back where they were
      rays.material.rotation = w / 10;
      sunGlow.scale.setScalar(2.6 * (1 + Math.sin(w * 2) * 0.05));

      // Zara's arms come a little out from her sides for the jump and stay out while she dances
      const out = Math.max(0, Math.min(1, (t - 1.6) / 0.4)) * Math.max(0, Math.min(1, (5.4 - t) / 0.5));

      rigs.zara.rot('LeftArm', Z, out * 0.22);
      rigs.zara.rot('RightArm', Z, -out * 0.22);

      const a = w + 0.6;

      bird.group.position.set(-2.1 + Math.sin(a) * 0.55, 2.15 + Math.sin(a * 2) * 0.08, -1.6 + Math.cos(a) * 0.45);
      bird.group.rotation.set(0, Math.atan2(Math.sin(a) * 0.45, Math.cos(a) * 0.6), Math.cos(a * 2) * 0.12);

      for (const { hinge, side } of bird.wings) hinge.rotation.x = -side * (0.1 + Math.sin(w * 6) * 0.55);

      for (const effect of effects) effect(t);
    },
  };
}
