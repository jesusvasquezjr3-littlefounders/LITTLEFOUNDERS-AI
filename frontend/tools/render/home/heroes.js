// Home composition "heroes": the four mentors, heroes for an evening, stand on a rooftop at dusk as a gust of wind
// lifts their capes and the searchlight draws a Seed on a cloud.
//
// The setting is an island: the round top of a building, with a painted ring on its roof, a parapet, and a band of
// lit round windows on the wall under it. At the back a round skylight glows; at the left edge stands a small vent
// with a spinning cap, and on the right the searchlight on its tall stand, whose beam reaches a cloud high behind
// the mentors. Far behind, a skyline of round-topped buildings with lit windows, one of them with a water tower on
// its roof, stands in a cloud of dusk colors that fades to nothing before the frame's borders. Nothing stands behind
// Dina, who is large, or where her cape flies.
//
// Zara and Dina wear capes: cloth that follows the shoulders and goes the way the wind blows, to the reader's
// left, down and away; Dina's is short and flies over her back. Liruf and Rho, whose bodies hide a cape from this
// side, have a round badge with a Seed instead, glowing over each of them. Dina stands on the left and Liruf on
// the right here, so the wind takes the capes away from the searchlight. The sign on the cloud is a Seed and
// nothing else: no hero that exists has it.
import * as THREE from 'three';
import { C, TAU, canvasTexture, cylinder, decal, drawSeed, halo, landings, lathe, lit, mesh, place, radial, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const ROOF = { radius: 3.2, z: -0.5 };
const SKYLIGHT = { x: 0.05, z: -2.45 };
const VENT = { x: -2.9, z: 0.0 };
const LAMP = { x: 2.86, y: 2.0, z: -1.3 };
const SIGN = { x: -0.3, y: 2.5, z: -4.6 }; // the middle of the cloud the beam lands on
const GUST = 2.0; // the second the wind arrives

// ---- the roof: pale concrete with a painted ring, a parapet around it, and the top of the building's wall below
function roof() {
  const group = new THREE.Group();
  const next = sequence(61);
  const R = ROOF.radius;
  const picture = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;

    g.fillStyle = '#b9b4d6';
    g.fillRect(0, 0, w, w);

    for (let i = 0; i < 80; i++) {
      const x = next() * w;
      const y = next() * w;
      const r = 50 + next() * 140;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);

      patch.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(110,100,160,0.16)');
      patch.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // the painted ring, and a second, thin one inside it
    g.strokeStyle = '#ffb14a';
    g.lineWidth = 44;
    g.beginPath();
    g.arc(half, half * 1.12, half * 0.56, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(255,246,223,0.9)';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(half, half * 1.12, half * 0.47, 0, TAU);
    g.stroke();
  });
  const top = mesh(new THREE.CylinderGeometry(R, R, 0.1, 128), [standard(0x8d6bb8, 0.9), standard(0xffffff, 0.8, { map: picture }), standard(0x6f4f9c, 0.9)], 0, -0.05, 0);
  const parapet = mesh(new THREE.TorusGeometry(R - 0.03, 0.13, 16, 128), standard(0xd98a6a, 0.8), 0, 0.02, 0);
  const wall = standard(0x8b68bd, 0.9);

  top.castShadow = false;
  parapet.rotation.x = Math.PI / 2;
  group.add(top, parapet, lathe([[0, -1.05], [1.6, -1.0], [2.6, -0.86], [3.0, -0.7], [R - 0.05, -0.58], [R - 0.02, -0.48], [R - 0.02, -0.05]], wall));

  // lit round windows around the front of the wall
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.27;
    const pane = cylinder(0.12, 0.12, 0.04, lit(i % 2 ? 0xffe2a0 : 0xffd27a, 1.8), Math.sin(a) * (R - 0.03), -0.31, Math.cos(a) * (R - 0.03), 32);
    const ring = mesh(new THREE.TorusGeometry(0.13, 0.032, 12, 40), standard(0x6a4a9c, 0.8), Math.sin(a) * (R - 0.01), -0.31, Math.cos(a) * (R - 0.01));

    pane.rotation.order = 'YXZ';
    pane.rotation.set(Math.PI / 2, a, 0);
    ring.rotation.y = a;
    pane.castShadow = false;
    group.add(pane, ring);
  }

  return group;
}

// ---- the skylight: a low glass dome that glows from the rooms below
function skylight() {
  const group = new THREE.Group();
  const dome = mesh(new THREE.SphereGeometry(0.62, 48, 20, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd27a, emissiveIntensity: 1.5, roughness: 0.2, transparent: true, opacity: 0.92 }), 0, 0.08, 0);
  const glow = halo(1.0, 0xffd27a, 0.5);
  const light = new THREE.PointLight(0xffd08a, 6, 5, 1.8);

  dome.scale.y = 0.62;
  dome.castShadow = false;
  glow.position.y = 0.4;
  light.position.set(0, 0.9, 0.4);
  group.add(cylinder(0.7, 0.74, 0.12, standard(0x5a5486, 0.6), 0, 0.06, 0, 64), dome, glow, light);

  // four round ribs over the glass
  for (let i = 0; i < 2; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.63, 0.028, 10, 48, Math.PI), standard(0x5a5486, 0.6), 0, 0.08, 0);

    rib.rotation.y = i * (Math.PI / 2);
    rib.scale.y = 0.62;
    group.add(rib);
  }

  return group;
}

// ---- the vent: a short round pipe with a cap of ribs that spins
function vent() {
  const group = new THREE.Group();
  const steel = standard(0xd7d9ea, 0.35, { metalness: 0.5 });
  const cap = new THREE.Group();

  group.add(lathe([[0, 0], [0.18, 0], [0.2, 0.05], [0.15, 0.11], [0.15, 0.36], [0.18, 0.41], [0, 0.41]], steel));
  cap.position.y = 0.58;
  cap.add(sphere(0.21, steel, 0, 0, 0, 0.82));

  for (let i = 0; i < 6; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 32), standard(0x8f93b8, 0.4, { metalness: 0.5 }));

    rib.rotation.y = (i / 6) * Math.PI;
    rib.scale.y = 0.84;
    cap.add(rib);
  }

  group.add(cap, sphere(0.045, steel, 0, 0.78, 0));

  return { group, cap };
}

// ---- the searchlight: a round drum in a yoke on a round foot; `head` is what turns to aim it
function searchlight() {
  const group = new THREE.Group();
  const body = standard(C.indigo, 0.45, { metalness: 0.2 });
  const iron = standard(0x4a4470, 0.5, { metalness: 0.3 });
  const head = new THREE.Group();
  const lens = cylinder(0.27, 0.27, 0.04, lit(0xfff6d0, 3), 0, 0.3, 0, 48);

  lens.castShadow = false;
  head.position.y = LAMP.y;
  // the drum lies along the head's own y axis: that is the way the beam leaves
  head.add(lathe([[0, -0.26], [0.2, -0.26], [0.27, -0.16], [0.31, 0.1], [0.31, 0.26], [0.27, 0.31], [0, 0.31]], body), lens, mesh(new THREE.TorusGeometry(0.29, 0.04, 12, 48), standard(0xf2bf2a, 0.3, { metalness: 0.6 }), 0, 0.3, 0).rotateX(Math.PI / 2));
  group.add(
    // the stand: a round foot and a column tall enough to carry the drum over the mentors' heads
    lathe([[0, 0], [0.21, 0], [0.23, 0.06], [0.16, 0.14], [0.09, 0.24], [0.065, 0.5], [0.055, LAMP.y - 0.6], [0.09, LAMP.y - 0.54], [0, LAMP.y - 0.54]], iron),
    mesh(new THREE.TorusGeometry(0.075, 0.03, 12, 32), standard(0xf2bf2a, 0.3, { metalness: 0.6 }), 0, 0.95, 0).rotateX(Math.PI / 2),
    // the yoke: a round fork that holds the drum by its sides
    tube([[-0.4, LAMP.y, 0], [-0.4, LAMP.y - 0.3, 0], [-0.2, LAMP.y - 0.52, 0], [0, LAMP.y - 0.56, 0], [0.2, LAMP.y - 0.52, 0], [0.4, LAMP.y - 0.3, 0], [0.4, LAMP.y, 0]], 0.04, iron, 40),
    sphere(0.07, iron, -0.4, LAMP.y, 0), sphere(0.07, iron, 0.4, LAMP.y, 0),
    head,
  );

  return { group, head };
}

// ---- the cloud the beam lands on, and the sign: a disc of light with a Seed in it
function signCloud() {
  const group = new THREE.Group();
  const puff = standard(0xfff1f4, 0.95, { emissive: 0xffc9d6, emissiveIntensity: 0.35 });

  for (const [x, y, z, r] of [[-0.95, -0.1, 0, 0.5], [-0.35, 0.12, -0.1, 0.68], [0.4, 0.1, -0.1, 0.72], [1.02, -0.12, 0, 0.5], [0.05, -0.3, 0.1, 0.62], [-0.6, -0.34, 0.12, 0.42], [0.66, -0.36, 0.12, 0.42]]) {
    const one = sphere(r, puff, x, y, z, 0.82);

    one.castShadow = false;
    group.add(one);
  }

  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64), new THREE.MeshBasicMaterial({
    map: canvasTexture([512, 512], (g, s) => {
      const lightDisc = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);

      lightDisc.addColorStop(0, 'rgba(255,250,214,1)');
      lightDisc.addColorStop(0.82, 'rgba(255,238,170,0.96)');
      lightDisc.addColorStop(1, 'rgba(255,226,140,0)');
      g.fillStyle = lightDisc;
      g.fillRect(0, 0, s, s);
      drawSeed(g, s / 2, s / 2, s * 0.62, '#5c55fd', '#fff6df');
    }),
    transparent: true, depthWrite: false, toneMapped: false,
  }));

  sign.position.set(0.02, -0.06, 0.85);
  sign.renderOrder = 4;
  group.add(sign);

  return { group, sign };
}

// ---- far behind: a cloud of dusk colors, two rows of round-topped buildings with lit windows, a few early stars
function dusk(fx, loop) {
  const group = new THREE.Group();
  const next = sequence(37);
  const cloud = sprite(canvasTexture([1024, 640], (g, w, h) => {
    g.save();
    g.scale(1, h / w);

    const violet = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);

    violet.addColorStop(0, 'rgba(120,84,214,0.95)');
    violet.addColorStop(0.55, 'rgba(96,72,200,0.82)');
    violet.addColorStop(0.82, 'rgba(92,78,210,0.3)');
    violet.addColorStop(1, 'rgba(92,78,210,0)');
    g.fillStyle = violet;
    g.fillRect(0, 0, w, w);

    // the last of the sun, low in the middle, and pink above it
    for (const [x, y, r, color, a] of [[0.5, 0.62, 0.34, '255,120,150', 0.75], [0.5, 0.7, 0.24, '255,178,96', 0.9]]) {
      const tint = g.createRadialGradient(w * x, w * y, 0, w * x, w * y, w * r);

      tint.addColorStop(0, `rgba(${color},${a})`);
      tint.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = tint;
      g.fillRect(0, 0, w, w);
    }

    g.restore();
  }), 0xffffff, 0);
  // one row of buildings: round tops, windows in rows, some lit; it fades out at its foot and at both ends
  const row = (seed, body, width, tower) => canvasTexture([2048, 640], (g, w, h) => {
    const pick = sequence(seed);
    let x = 40;

    while (x < w - 120) {
      const bw = 110 + pick() * 120;
      const bh = h * (0.38 + pick() * 0.5);

      g.fillStyle = body;
      g.beginPath();
      g.roundRect(x, h - bh, bw, bh + 80, [Math.min(bw / 2, 30 + pick() * 40), Math.min(bw / 2, 30 + pick() * 40), 0, 0]);
      g.fill();

      for (let wy = h - bh + 56; wy < h - 60; wy += 46) {
        for (let wx = x + 22; wx < x + bw - 34; wx += 36) {
          if (pick() < 0.45) continue;

          g.fillStyle = pick() < 0.75 ? '#ffe08a' : '#ffd0e0';
          g.beginPath();
          g.roundRect(wx, wy, 18, 24, 8);
          g.fill();
        }
      }

      x += bw + 8 + pick() * 26;
    }

    // on one roof of the near row, a water tower: a round tank with a round lid on three legs
    if (tower) {
      const tx = w * 0.725;
      const ty = h * 0.3;

      g.fillStyle = body;
      g.beginPath();
      g.roundRect(tx - 80, ty, 160, h, [34, 34, 0, 0]);
      g.fill();
      g.strokeStyle = body;
      g.lineWidth = 12;
      g.lineCap = 'round';

      for (const dx of [-40, 0, 40]) {
        g.beginPath();
        g.moveTo(tx + dx * 1.2, ty + 4);
        g.lineTo(tx + dx, ty - 62);
        g.stroke();
      }

      g.fillStyle = '#8f7be6';
      g.beginPath();
      g.roundRect(tx - 56, ty - 150, 112, 96, 22);
      g.fill();
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(tx, ty - 150, 66, 26, 0, Math.PI, 0);
      g.fill();
      g.fillRect(tx - 56, ty - 122, 112, 9);
      g.fillRect(tx - 56, ty - 86, 112, 9);
    }

    g.globalCompositeOperation = 'destination-in';

    const down = g.createLinearGradient(0, 0, 0, h);

    down.addColorStop(0, 'rgba(0,0,0,1)');
    down.addColorStop(0.6, 'rgba(0,0,0,1)');
    down.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = down;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';

    const across = g.createLinearGradient(0, 0, w, 0);

    across.addColorStop(0, 'rgba(0,0,0,0)');
    across.addColorStop(width, 'rgba(0,0,0,1)');
    across.addColorStop(1 - width, 'rgba(0,0,0,1)');
    across.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = across;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  });

  cloud.position.set(0, 1.1, -9);
  cloud.scale.set(10.6, 5.2, 1);
  group.add(cloud);

  for (const [seed, body, y, z, wide, tall, order] of [[5, '#7a63d6', 1.5, -8, 9.4, 3.0, 1], [9, '#5a45bd', 1.05, -7, 8.6, 2.7, 2]]) {
    const city = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), new THREE.MeshBasicMaterial({ map: row(seed, body, 0.14, order === 2), transparent: true, depthWrite: false, toneMapped: false }));

    city.position.set(0, y, z);
    city.renderOrder = order;
    group.add(city);
  }

  const updates = [];

  for (let i = 0; i < 22; i++) {
    const star = sprite(i % 4 ? TEXTURES.dot : TEXTURES.star, [0xffffff, 0xfff0b8, 0xffd9e6][i % 3], 1);
    const size = (i % 4 ? 0.05 : 0.2) + next() * 0.06;
    const phase = next() * TAU;
    const speed = 1 + Math.floor(next() * 3);

    star.position.set((next() - 0.5) * 7.6, 2.6 + next() * 0.8, -8.6);
    fx.add(star);
    updates.push((t) => {
      const twinkle = 0.55 + 0.45 * Math.sin((t / loop) * TAU * speed + phase);

      star.scale.setScalar(size * (0.7 + twinkle * 0.5));
      star.material.opacity = twinkle;
    });
  }

  return { group, update: (t) => { for (const update of updates) update(t); } };
}

/*
 * A cape. It is not part of a body: every frame it is hung again from where the mentor's shoulders are, hangs a
 * little way down its back and then goes the way the wind blows, turned so the reader sees its face like a banner's.
 * `top` and `hem` are its widths, `length` how long it is, `wind` the way it is blown and `stream` how far it gives
 * in to that (0 hangs straight down, 1 flies).
 */
const COLS = 8;
const ROWS = 14;

function cape(color, { top, hem, length, wind, stream }) {
  const geometry = new THREE.PlaneGeometry(1, 1, COLS, ROWS);
  const cloth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.12 }));
  const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 1, 6, 16), standard(color, 0.7));
  const at = geometry.attributes.position;
  const blown = new THREE.Vector3(...wind).normalize();
  const center = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const across = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const shoulders = new THREE.Vector3();
  const hang = new THREE.Vector3();

  cloth.castShadow = true;
  cloth.receiveShadow = true;
  cloth.frustumCulled = false;
  roll.castShadow = true;

  return {
    cloth, roll,
    /** `anchor`: the middle of the shoulders, behind the neck. `yaw`: where the mentor faces. `gust`: how hard it blows, 0 to 1. */
    hangFrom(anchor, yaw, w, gust, phase) {
      shoulders.set(Math.cos(yaw), 0, -Math.sin(yaw));
      hang.set(-Math.sin(yaw) * 0.45, -1, -Math.cos(yaw) * 0.45).normalize();
      roll.position.copy(anchor);
      roll.rotation.set(0, yaw, Math.PI / 2);
      roll.scale.set(1, top, 1);

      for (let j = 0; j <= ROWS; j++) {
        const v = j / ROWS;
        // the wind takes hold a little way down
        const e = stream * gust * Math.min(1, v / 0.45) ** 1.3;
        const turned = Math.min(1, v / 0.4);

        dir.copy(hang).multiplyScalar(1 - e).addScaledVector(blown, e).normalize();
        // across the cloth: along the shoulders at the top, then square to the way it goes, as the reader sees it
        facing.set(-dir.y, dir.x, 0).normalize();
        across.copy(shoulders).multiplyScalar(1 - turned).addScaledVector(facing, turned).normalize();
        normal.crossVectors(dir, across).normalize();

        if (j === 0) center.copy(anchor);
        else center.addScaledVector(dir, length / ROWS);

        for (let i = 0; i <= COLS; i++) {
          const u = i / COLS - 0.5;
          const width = top + (hem - top) * v ** 0.7;
          // a round hem: the corners are shorter than the middle
          const short = v > 0.8 ? 1 - ((v - 0.8) / 0.2) ** 2 * (2 * u) ** 2 * 0.5 : 1;
          const wave = Math.sin(v * 7 - w * 4 + u * 2 + phase) * 0.045 * v + Math.sin(v * 3 - w * 2 + phase) * 0.035 * v * gust;
          const k = j * (COLS + 1) + i;

          at.setXYZ(k, center.x + across.x * u * width * short + normal.x * wave, center.y + across.y * u * width * short + normal.y * wave, center.z + across.z * u * width * short + normal.z * wave);
        }
      }

      at.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}

// each cape: its color and size, how the wind takes it, the bone it hangs from, and where the middle of the
// shoulders is from that bone (up, and back from the way the mentor faces)
const SWEPT = { wind: [-0.75, 0.05, -0.4], stream: 0.55 };
const CAPES = {
  zara: { color: C.sky, top: 0.3, hem: 0.46, length: 0.9, ...SWEPT, bone: 'neck', up: 0.0, back: 0.12 },
  dina: { color: C.pink, top: 0.3, hem: 0.62, length: 0.9, wind: [-0.62, 0.45, -0.64], stream: 1, bone: 'chest', up: 0.55, back: 0.03 },
};

/** A round badge that gives light: a ring of `color` around a pale field with a Seed in it. It always faces the reader. */
function badge(color) {
  const group = new THREE.Group();
  const face = sprite(canvasTexture([256, 256], (g, s) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 4, 0, TAU);
    g.fill();
    g.fillStyle = '#fff6df';
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 30, 0, TAU);
    g.fill();
    drawSeed(g, s / 2, s / 2, s * 0.5, '#5c55fd', '#fff6df');
  }), 0xffffff, 8);
  const glow = halo(0.34, new THREE.Color(color).getHex(), 0.55);

  face.scale.setScalar(0.34);
  glow.position.z = -0.05;
  group.add(glow, face);

  return { group, glow };
}

// the badges: over whom, how high, and their ring's color
const BADGES = [['rho', 1.76, '#05a893'], ['liruf', 1.84, '#eb7301']];

export function build(scene, { loop, heights, jump, tuck, curve, number, Z }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const far = dusk(fx, loop);
  const spinner = vent();
  const light = searchlight();
  const signal = signCloud();

  set.add(place(roof(), 0, ROOF.z), shadowCatcher(ROOF.radius - 0.2, 0.008, ROOF.z, 0.34), far.group);
  set.add(decal(radial([[0, 'rgba(60,40,150,0.30)'], [0.6, 'rgba(60,40,150,0.15)'], [1, 'rgba(60,40,150,0)']]), 0, -1.0, ROOF.z, 3.3, 2.0, 0));
  set.add(place(skylight(), SKYLIGHT.x, SKYLIGHT.z), place(spinner.group, VENT.x, VENT.z), place(light.group, LAMP.x, LAMP.z, -0.5));
  signal.group.position.set(SIGN.x, SIGN.y, SIGN.z);
  set.add(signal.group);

  // the beam: a cone of light from the drum to wherever it is aimed, brightest at the lamp and gone at its far end
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.2, 1, 48, 1, true), new THREE.MeshBasicMaterial({
    map: canvasTexture([8, 256], (g, w, h) => {
      const fade = g.createLinearGradient(0, 0, 0, h);

      fade.addColorStop(0, 'rgba(255,240,180,0)');
      fade.addColorStop(0.22, 'rgba(255,240,180,0.24)');
      fade.addColorStop(0.6, 'rgba(255,240,180,0.3)');
      fade.addColorStop(1, 'rgba(255,240,180,0.6)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
    }),
    transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
  }));
  const lampGlow = halo(0.55, 0xfff0b8, 0.7);
  const lampLight = new THREE.PointLight(0xffe2a0, 4, 4.5, 1.8);

  beam.renderOrder = 3;
  lampLight.position.set(LAMP.x - 0.6, LAMP.y - 0.3, LAMP.z + 0.9);
  fx.add(beam, lampGlow);
  set.add(lampLight);

  const cast = {
    // Dina lifts her head into the wind and rears up for a moment
    dina: { x: -1.8, z: -0.1, yaw: 0.5, act: {
      hop: jump(3.2, 0.1), rear: [[0, 0], [2.7, 0], [3.2, 0.7], [3.9, 0], [L, 0]], pitch: [[0, -0.18], [2.0, -0.18], [2.6, -0.36], [3.2, -0.42], [4.0, -0.3], [6.4, -0.3], [L, -0.18]],
      roll: [[0, -0.16], [2.6, 0.08], [4.6, -0.12], [L, -0.16]], yaw: [[0, -0.45], [1.8, -0.45], [2.6, -0.1], [5.6, -0.2], [L, -0.45]],
    } },
    // Rho puffs out his chest, jumps a beat late and lands in a proud nod
    rho: { x: -0.55, z: 0.45, yaw: 0.1, act: {
      hop: jump(2.9, 0.16), tuck: tuck(2.9, 0.6), lean: [[0, -0.06], [2.4, 0.06], [2.9, -0.2], [3.4, 0.04], [4.0, -0.14], [6.6, -0.14], [L, -0.06]],
      pitch: [[0, -0.1], [2.9, -0.3], [3.4, 0.12], [4.0, -0.18], [6.6, -0.18], [L, -0.1]], yaw: [[0, -0.25], [1.8, -0.25], [2.6, 0.2], [5.4, -0.1], [L, -0.25]],
      roll: [[0, -0.08], [2.9, 0.1], [4.6, -0.08], [L, -0.08]], tilt: [[0, 0], [2.9, -0.07], [3.6, 0], [L, 0]],
    } },
    // Zara stands with her hands on her hips and her chin up, and rises on her toes as the wind comes
    zara: { x: 0.65, z: 0.4, yaw: -0.12, act: {
      hop: jump(2.6, 0.1), lean: [[0, -0.05], [2.0, -0.05], [2.6, -0.16], [3.4, -0.1], [6.5, -0.1], [L, -0.05]],
      pitch: [[0, -0.08], [2.0, -0.08], [2.6, -0.26], [6.0, -0.2], [L, -0.08]], yaw: [[0, -0.3], [1.6, -0.3], [2.4, 0.12], [4.6, -0.2], [6.4, 0.1], [L, -0.3]],
      roll: [[0, -0.06], [2.6, 0.08], [4.6, -0.08], [L, -0.06]], tilt: [[0, -0.03], [2.6, 0.03], [5, -0.03], [L, -0.03]],
    } },
    // Liruf lands from a jump with his chest out, looking up at the sign
    liruf: { x: 1.8, z: -0.05, yaw: -0.3, act: {
      hop: jump(2.25, 0.2), tuck: tuck(2.25, 0.8), lean: [[0, -0.06], [1.8, 0.08], [2.25, -0.2], [2.8, -0.02], [3.4, -0.14], [6.4, -0.14], [L, -0.06]],
      pitch: [[0, -0.1], [2.25, -0.34], [3.0, -0.22], [6.4, -0.22], [L, -0.1]], yaw: [[0, 0.3], [1.5, 0.3], [2.4, -0.35], [6.2, -0.35], [7.2, 0.3], [L, 0.3]],
      roll: [[0, 0.1], [2.25, -0.12], [4.4, -0.02], [L, 0.1]], tilt: [[0, 0], [2.25, 0.08], [3, 0], [L, 0]],
    } },
  };
  const names = Object.keys(cast);
  const actors = names.map((name) => ({ x: cast[name].x, z: cast[name].z, height: heights[name], peak: { liruf: 2.25, zara: 2.6, rho: 2.9, dina: 3.2 }[name], clear: { liruf: 0.6, dina: 0.8 }[name] }));

  // the wind: long soft streaks that cross behind the mentors from the right, most of them as the gust arrives
  const next = sequence(43);
  const streaks = Array.from({ length: 12 }, (_, i) => {
    const one = sprite(TEXTURES.dot, 0xffffff, 3);

    fx.add(one);

    return { one, y: 0.5 + next() * 2.1, z: -0.9 - next() * 1.4, delay: next() * 1.6 - 0.5, speed: 5 + next() * 3, long: 0.9 + next() * 0.9, strong: i < 8 };
  });
  // how hard the wind blows: a gust that arrives, holds and dies down
  const blowing = [[0, 0.3], [GUST - 0.4, 0.3], [GUST + 0.3, 1], [5.6, 0.9], [7.2, 0.3], [L, 0.3]];
  // where the beam is aimed: it waits low beside the cloud and swings up to its middle (0 is the middle)
  const aimX = [[0, 1], [1.0, 1], [GUST + 0.1, 0], [6.2, 0], [7.4, 1], [L, 1]];
  const hips = [[0, 1], [L, 1]];
  const effects = [far.update, sparkles(fx, { loop, actors, each: 6, colors: [0xffffff, 0xfff0b8, 0xffd9e6] }), landings(fx, { actors: actors.filter(({ peak }) => peak !== 2.6), color: 0xf2e9ff })];
  const capes = [];
  const badges = BADGES.map(([name, y, color], i) => {
    const one = badge(color);

    fx.add(one.group);

    return { ...one, x: cast[name].x, y, z: cast[name].z, phase: i * 2.4 };
  });
  const anchor = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const from = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  scene.add(set, fx);

  return {
    cast,
    still: 2.6,
    camera: { y: 2.3, dist: 14.3, lookY: 0.84 },
    ready(rigs) {
      for (const name of Object.keys(CAPES)) {
        const spec = CAPES[name];
        const one = cape(spec.color, spec);

        scene.add(one.cloth, one.roll);
        capes.push({ ...one, rig: rigs[name], bone: rigs[name].bones.get(spec.bone), up: number(`${name}u`, spec.up), back: number(`${name}b`, spec.back), phase: capes.length * 1.7 });
      }
    },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const gust = curve(blowing, t);

      // Zara: elbows out, hands on her hips
      const akimbo = curve(hips, t);

      rigs.zara.rot('LeftArm', Z, akimbo * number('za', 0.5));
      rigs.zara.rot('LeftForeArm', Z, akimbo * number('zf', -1.7));
      rigs.zara.rot('RightArm', Z, -akimbo * number('za', 0.5));
      rigs.zara.rot('RightForeArm', Z, -akimbo * number('zf', -1.7));

      for (const { group, glow, x, y, z, phase } of badges) {
        group.position.set(x, y + Math.sin(w * 2 + phase) * 0.05, z);
        group.scale.setScalar(1 + gust * 0.12);
        glow.material.opacity = 0.4 + gust * 0.3 + Math.sin(w * 4 + phase) * 0.06;
      }

      for (const { rig, bone, up, back, phase, hangFrom } of capes) {
        const yaw = rig.holder.rotation.y;

        rig.holder.updateWorldMatrix(true, true);
        bone.getWorldPosition(anchor);
        anchor.set(anchor.x - Math.sin(yaw) * back, anchor.y + up, anchor.z - Math.cos(yaw) * back);
        hangFrom(anchor, yaw, w, gust * (0.9 + 0.1 * Math.sin(w * 3 + phase)), phase);
      }

      // the searchlight: the drum turns to its aim, the beam reaches it, and the sign shows while the beam is on the cloud
      const off = curve(aimX, t);

      from.set(LAMP.x, LAMP.y, LAMP.z);
      aim.set(SIGN.x + off * 1.5, SIGN.y - 0.06 - off * 0.55, SIGN.z + 0.8).sub(from);

      const reach = aim.length();

      aim.normalize();
      light.head.quaternion.setFromUnitVectors(UP, aim);
      light.head.quaternion.premultiply(light.group.quaternion.clone().invert());
      beam.quaternion.setFromUnitVectors(UP, aim);
      beam.scale.set(1, reach - 0.3, 1);
      beam.position.copy(from).addScaledVector(aim, 0.3 + (reach - 0.3) / 2);
      lampGlow.position.copy(from).addScaledVector(aim, 0.36);
      signal.sign.material.opacity = Math.max(0, 1 - off / 0.35) * (0.94 + 0.06 * Math.sin(w * 5));
      signal.group.position.x = SIGN.x + Math.sin(w) * 0.05;

      spinner.cap.rotation.y = w * 4;

      for (const { one, y, z, delay, speed, long, strong } of streaks) {
        // a streak sets off at the gust (the weak ones a loop's half later) and crosses the whole roof
        const u = ((((t - GUST - delay - (strong ? 0 : 4)) % loop) + loop) % loop) / (6.4 / speed);

        one.visible = u < 1;
        one.position.set(3.2 - u * 6.4, y + Math.sin(u * 5 + delay) * 0.08, z);
        one.scale.set(long, 0.035, 1);
        one.material.opacity = Math.sin(Math.min(1, u) * Math.PI) * (strong ? 0.6 : 0.35);
      }

      for (const effect of effects) effect(t);
    },
  };
}
