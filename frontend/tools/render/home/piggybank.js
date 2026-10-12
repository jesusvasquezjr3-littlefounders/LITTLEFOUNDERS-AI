// Home composition "piggybank": the four mentors beside a giant piggy bank, taller than they are, the moment a huge
// Seed drops into the slot on its back and they all jump.
//
// The setting is an island: a round playroom floor, cream with soft dots of color and a golden rim. The piggy bank
// stands in the middle, turned a little to one side so its whole face shows: a round glossy body the brand's
// indigo, a pink snout and ears, a curly tail, a golden slot across its back. Nobody stands in front of it: Liruf
// and Zara are at its left, Rho and Dina at its right. Over it floats the Seed, in its own light, with small Seeds
// turning around it, and four balloons drift loose high at the sides. When the Seed drops in, the pig squashes and
// bounces, and stars fly out of the slot.
//
// No money is shown anywhere: what is saved is Seeds (CLAUDE.md, rule 8).
import * as THREE from 'three';
import { C, TAU, box, canvasTexture, decal, halo, landings, lathe, mesh, place, radial, rising, seedMesh, sequence, shadowCatcher, sparkles, sphere, sprite, standard, TEXTURES, tube } from '../home-kit.js';

const FLOOR = { radius: 3.25, z: -0.6 };
// its body's half sizes and the height of its middle are as built; `scale` is how much larger it stands in the scene
const PIG = { x: -0.27, z: -2.0, y: 1.05, yaw: -0.45, wide: 0.95, tall: 0.95, long: 1.35, scale: 1.1 };
const HOVER = 2.9; // how high the Seed floats, at its middle
const SEED = 0.8; // how tall it is
const FALLS = 1.7; // the second it lets go
const LANDS = 2.1; // the second it reaches the slot
// the balloons adrift: where each floats and its color
const BALLOONS = [[-2.8, 2.8, -1.2, C.pink], [-2.05, 3.08, -1.7, C.gold], [2.45, 3.02, -1.5, C.sky], [3.05, 2.75, -1.1, 0x35d6b8]];

const glossy = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12 });

// ---- the floor: cream, with soft round dots of color, a golden rim
function floor() {
  const group = new THREE.Group();
  const R = FLOOR.radius;
  const next = sequence(71);
  const top = canvasTexture([1536, 1536], (g, w) => {
    const half = w / 2;
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(half, half, half * r, 0, TAU); g.fill(); };

    ring(1, '#d9a41a');
    ring(0.965, '#fbf3df');
    ring(0.93, '#ff9cc0');
    ring(0.9, '#fbf3df');

    // dots laid on a loose grid, each a little off its place
    const colors = ['#ffd3e2', '#cfeee8', '#ffe7a6', '#d8d6ff', '#cfe2ff'];

    for (let i = -8; i <= 8; i++) {
      for (let j = -8; j <= 8; j++) {
        const x = half + (i + (j % 2 ? 0.5 : 0)) * 88 + (next() - 0.5) * 22;
        const y = half + j * 80 + (next() - 0.5) * 22;
        const r = 17 + next() * 14;

        if (Math.hypot(x - half, y - half) > half * 0.86) { next(); continue; }

        g.fillStyle = colors[Math.floor(next() * colors.length)];
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
    }
  });
  const disc = mesh(new THREE.CylinderGeometry(R, R, 0.08, 128), [standard(0xd9a41a, 0.35, { metalness: 0.5 }), standard(0xffffff, 0.5, { map: top }), standard(C.indigoDeep, 0.8)], 0, -0.04, 0);

  disc.castShadow = false;
  group.add(disc, lathe([[0, -0.44], [2.45, -0.44], [3.03, -0.31], [R - 0.04, -0.14], [R - 0.04, -0.08]], standard(C.indigoDeep, 0.7)));

  return group;
}

// ---- the piggy bank. It is built looking along +z, with its middle at the origin.
function pig() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // everything that squashes and bounces together
  const skin = glossy(0x7a74ff);
  const deep = glossy(0x5a52e6);
  const pink = glossy(0xff8fbd);
  const dark = standard(0x23204a, 0.3);
  const gold = standard(0xf2bf2a, 0.28, { metalness: 0.7 });
  const { wide, tall, long } = PIG;
  /** How far forward the body's surface is at `x`, `y`. */
  const front = (x, y) => long * Math.sqrt(Math.max(0, 1 - (x / wide) ** 2 - (y / tall) ** 2));
  const shell = sphere(1, skin, 0, 0, 0);

  shell.scale.set(wide, tall, long);
  body.add(shell);

  // the snout: a short round drum, two nostrils
  const snout = lathe([[0, 0], [0.3, 0], [0.35, 0.05], [0.36, 0.2], [0.31, 0.27], [0, 0.28]], pink, 0, -0.12, long - 0.08, 48);

  snout.rotation.x = Math.PI / 2;
  body.add(snout);

  for (const side of [-1, 1]) {
    const nostril = sphere(0.055, dark, side * 0.12, -0.11, long + 0.2, 1.3);
    const eye = sphere(0.085, dark, side * 0.42, 0.3, front(0.42, 0.3) - 0.02, 1.15);
    const shine = sphere(0.028, standard(0xffffff, 0.2, { emissive: 0xffffff, emissiveIntensity: 0.6 }), side * 0.42 + 0.03, 0.335, front(0.42, 0.3) + 0.04);
    const cheek = sphere(0.15, standard(0xff9cc0, 0.5), side * 0.63, 0.02, front(0.63, 0.02) - 0.07, 0.8);

    nostril.scale.z = 0.4;
    eye.scale.z = 0.5;
    cheek.scale.z = 0.4;
    body.add(nostril, eye, shine, cheek);
  }

  // the ears: round, leaning forward, pink inside
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    const outer = sphere(0.23, skin, 0, 0.16, 0, 1.05);
    const inner = sphere(0.15, pink, 0, 0.16, 0.05, 1.05);

    outer.scale.z = 0.4;
    inner.scale.z = 0.3;
    ear.add(outer, inner);
    ear.position.set(side * 0.43, 0.66, front(0.43, 0.66) - 0.1);
    ear.rotation.set(0.75, 0, -side * 0.4);
    body.add(ear);

    return { ear, side };
  });

  // the curly tail
  const tail = new THREE.Group();

  tail.add(tube(Array.from({ length: 22 }, (_, i) => { const u = i / 21; const a = u * TAU * 1.6; return [Math.sin(a) * 0.13 * (0.5 + u * 0.5), Math.cos(a) * 0.13 * (0.5 + u * 0.5) - 0.06, -u * 0.34]; }), 0.04, pink, 64), sphere(0.04, pink, Math.sin(TAU * 1.6) * 0.13, Math.cos(TAU * 1.6) * 0.13 - 0.06, -0.34));
  tail.position.set(0, 0.3, -front(0, 0.3) + 0.05);
  body.add(tail);

  // the slot across its back, in a golden rim
  body.add(box(1.0, 0.08, 0.3, gold, 0, tall - 0.035, 0, 0.04), box(0.82, 0.05, 0.13, dark, 0, tall + 0.002, 0, 0.025));

  // four short round legs, darker at the foot
  for (const [x, z] of [[-0.5, 0.72], [0.5, 0.72], [-0.5, -0.72], [0.5, -0.72]]) {
    group.add(
      lathe([[0, 0.06], [0.22, 0.06], [0.27, 0.12], [0.28, 0.4], [0.26, 0.56], [0, 0.56]], skin, x, -PIG.y, z, 32),
      lathe([[0, 0], [0.24, 0], [0.28, 0.04], [0.28, 0.12], [0.22, 0.16], [0, 0.16]], deep, x, -PIG.y, z, 32),
    );
  }

  group.add(body);

  return { group, body, ears, tail };
}

// ---- a balloon that got away: round and glossy, a knot, a short curl of ribbon
function balloon(color) {
  const group = new THREE.Group();

  group.add(
    sphere(0.3, glossy(color), 0, 0, 0, 1.16),
    sphere(0.04, standard(color, 0.5), 0, -0.36, 0, 0.7),
    tube([[0, -0.38, 0], [0.04, -0.47, 0], [-0.03, -0.56, 0.01], [0.03, -0.65, 0]], 0.008, standard(0xffffff, 0.6), 20),
  );

  return group;
}

export function build(scene, { loop, heights, jump, tuck, X, Y, curve }) {
  const set = new THREE.Group();
  const fx = new THREE.Group();
  const L = loop;
  const bank = pig();
  const adrift = BALLOONS.map(([x, y, z, color], i) => {
    const one = balloon(color);

    set.add(one);

    return { one, x, y, z, phase: i * 1.9 };
  });

  set.add(place(floor(), 0, FLOOR.z), shadowCatcher(FLOOR.radius - 0.08, 0.008, FLOOR.z, 0.32));
  set.add(decal(radial([[0, 'rgba(60,50,170,0.30)'], [0.6, 'rgba(60,50,170,0.16)'], [0.85, 'rgba(60,50,170,0.04)'], [1, 'rgba(60,50,170,0)']]), 0, -0.52, FLOOR.z, 4.1, 4.1, 0));
  bank.group.scale.setScalar(PIG.scale);
  set.add(place(bank.group, PIG.x, PIG.z, PIG.yaw, PIG.y * PIG.scale));

  // the Seed over the slot, its light, and the small Seeds that turn around it
  const slot = new THREE.Vector3(PIG.x, (PIG.y + PIG.tall) * PIG.scale, PIG.z);
  const big = seedMesh(SEED);
  const rays = sprite(TEXTURES.star, 0xffe08a, 5);
  const glow = halo(0.8, 0xffd36b, 0.55);
  const light = new THREE.PointLight(0xffd070, 6, 5, 1.8);
  const next = sequence(37);
  const around = Array.from({ length: 6 }, (_, i) => {
    const seed = seedMesh(0.27 + next() * 0.06);

    seed.castShadow = false;
    fx.add(seed);

    return { seed, phase: (i / 6) * TAU, lean: (next() - 0.5) * 1.2 };
  });
  const burst = Array.from({ length: 16 }, (_, i) => {
    const star = sprite(i % 3 ? TEXTURES.star : TEXTURES.dot, [0xfff3c4, 0xffffff, 0xffd36b, 0xffb7d0][i % 4], 9);

    fx.add(star);

    return { star, a: -0.5 + (i / 15) * (Math.PI + 1.0), reach: 0.7 + next() * 0.7, size: 0.13 + next() * 0.14 };
  });
  const rings = [0, 0.22, 0.44].map((delay) => {
    const ring = sprite(TEXTURES.ring, 0xffd36b, 8);

    fx.add(ring);

    return { ring, delay };
  });

  big.castShadow = false;
  fx.add(rays, glow, big, light);

  const cast = {
    // Liruf looks up at the Seed and jumps the highest as it falls
    liruf: { x: -2.68, z: 0.3, yaw: 0.45, act: {
      hop: jump(2.1, 0.3), tuck: tuck(2.1, 0.9), yaw: [[0, 0.5], [1.5, 0.5], [2.1, 0.1], [4.6, 0.1], [6, 0.5], [L, 0.5]],
      pitch: [[0, -0.34], [1.6, -0.34], [2.1, -0.1], [2.6, 0.05], [3.4, -0.1], [6, -0.34], [L, -0.34]], roll: [[0, 0.12], [2.1, -0.14], [4, 0.12], [L, 0.12]],
      lean: [[0, -0.08], [2.1, -0.12], [2.6, 0.1], [3.3, -0.04], [L, -0.08]], tilt: [[0, 0], [2.1, -0.1], [2.9, 0], [L, 0]],
    } },
    // Zara jumps with her arms at her sides, then brings her hands together, delighted
    zara: { x: -1.82, z: 0.55, yaw: 0.2, act: {
      hop: jump(2.2, 0.22), tuck: tuck(2.2, 0.7), lean: [[0, 0], [2.2, -0.12], [3.0, 0.04], [L, 0]],
      roll: [[0, 0.08], [2.2, -0.08], [3.4, 0.16], [5.2, 0.16], [6.2, 0.08], [L, 0.08]], pitch: [[0, -0.14], [2.2, -0.24], [3.0, -0.04], [L, -0.14]],
      tilt: [[0, 0], [3.4, 0.05], [5.2, 0.05], [6, 0], [L, 0]],
    } },
    // Rho jumps a beat later and nods as he lands
    rho: { x: 1.35, z: 0.5, yaw: -0.15, act: {
      hop: jump(2.35, 0.18), tuck: tuck(2.35, 0.7), lean: [[0, -0.05], [2.35, -0.16], [2.8, 0.08], [3.5, -0.03], [L, -0.05]],
      pitch: [[0, -0.2], [2.35, -0.3], [2.8, 0.14], [3.5, -0.1], [L, -0.2]], roll: [[0, 0.1], [2.35, -0.12], [4.2, 0.1], [L, 0.1]], tilt: [[0, 0], [2.35, 0.08], [3.1, 0], [L, 0]],
    } },
    // Dina watches the Seed fall with her head high and rears up when it lands
    dina: { x: 2.5, z: 0.05, yaw: -0.45, act: {
      hop: jump(2.5, 0.13), rear: [[0, 0], [2.0, 0], [2.5, 1], [3.2, 0], [L, 0]], pitch: [[0, -0.3], [2.5, -0.44], [3.3, -0.16], [5.5, -0.3], [L, -0.3]],
      roll: [[0, 0.18], [2.5, -0.1], [4.4, 0.18], [L, 0.18]], yaw: [[0, 0.1], [1.6, 0.1], [2.5, 0.3], [4.8, 0.3], [6.2, 0.1], [L, 0.1]],
    } },
  };
  const peaks = { liruf: 2.1, zara: 2.2, rho: 2.35, dina: 2.5 };
  const actors = Object.entries(cast).map(([name, at]) => ({ x: at.x, z: at.z, height: heights[name], peak: peaks[name] }));
  // Zara's hands: together in front of her from just after she lands
  const clasp = [[0, 0], [2.7, 0], [3.3, 1], [5.2, 1], [5.9, 0], [L, 0]];
  const effects = [
    sparkles(fx, { loop, actors, each: 5, seed: 31 }),
    landings(fx, { actors, color: 0xfff0d2 }),
    // stars that rise all around the pig
    rising(fx, { loop, at: { x: PIG.x, y: 0.4, z: PIG.z + 0.3 }, radius: 2.5, height: 2.6, count: 24, color: [0xffe6a3, 0xffffff, 0xffb7d0, 0xcfd0ff], size: [0.04, 0.1], seed: 16, texture: TEXTURES.star, sway: 0.08, depth: 0.25 }),
  ];
  const ease = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

  scene.add(set, fx);

  return {
    cast,
    still: 2.14,
    camera: { y: 2.3, dist: 14.4, lookY: 1.3 },
    update(t, rigs) {
      const w = (t / loop) * TAU;
      const since = t - LANDS;

      // the Seed: it floats, lets go, reaches the slot and sinks into it; a new one grows in its place later
      const fall = Math.max(0, Math.min(1, (t - FALLS) / (LANDS - FALLS))) ** 2;
      const sink = ease(since / 0.4);
      const rest = slot.y + SEED / 2 - 0.02;
      const fresh = ease((t - 5.4) / 0.7);
      const falling = t < 5.4;
      const y = falling ? HOVER + Math.sin(w * 2) * 0.05 * (1 - fall) - (HOVER - rest) * fall - sink * (SEED + 0.1) : HOVER + Math.sin(w * 2) * 0.05;
      const size = falling ? (since > 0.5 ? 0 : 1) : fresh;

      big.position.set(slot.x, y, slot.z);
      big.rotation.y = falling ? w * 2 * (1 - fall) + PIG.yaw : w * 2 + PIG.yaw;
      big.scale.setScalar(Math.max(0.0001, SEED * size));
      big.visible = size > 0.001;

      // its light stays where it floats, dims while there is no Seed there, and flares when it lands
      const lit = falling ? Math.max(0, 1 - fall * 1.2) : fresh;
      const flare = since > 0 && since < 1.4 ? Math.sin(Math.min(1, since / 0.2) * Math.PI / 2) * (1 - since / 1.4) : 0;

      rays.position.set(slot.x, HOVER, slot.z - 0.1);
      rays.scale.setScalar(2.0 * (0.25 + lit * 0.75));
      rays.material.opacity = 0.7 * lit;
      rays.material.rotation = w;
      glow.position.set(slot.x, falling ? Math.max(y, slot.y + 0.2) : HOVER, slot.z);
      glow.scale.setScalar(1.6 * (0.5 + 0.5 * Math.max(lit, flare)));
      glow.material.opacity = 0.3 + 0.3 * Math.max(lit, flare);
      light.position.set(slot.x, HOVER - 0.3, slot.z + 0.6);
      light.intensity = 3 + 4 * lit + 6 * flare;

      for (const { seed, phase, lean } of around) {
        const a = w + phase;

        seed.position.set(slot.x + Math.cos(a) * 1.25, HOVER + Math.sin(a) * 0.3 + Math.sin(w * 2 + phase) * 0.04, slot.z + Math.sin(a) * 0.5);
        seed.rotation.set(lean * 0.4, Math.sin(w * 2 + phase) * 0.7, lean * 0.5);
      }

      // the pig: a slow breath, and a squash and a bounce when the Seed lands
      const hit = since > 0 && since < 1.4 ? Math.sin(since * 11) * Math.exp(-since * 3.2) : 0;
      const breath = Math.sin(w * 2) * 0.008;

      bank.body.scale.set(1 + hit * 0.05 - breath, 1 - hit * 0.07 + breath, 1 + hit * 0.05 - breath);
      bank.body.position.y = -hit * 0.07 * PIG.tall + Math.max(0, -hit) * 0.1;

      for (const { ear, side } of bank.ears) ear.rotation.x = 0.75 + Math.sin(w * 3 + side) * 0.06 + hit * 0.5;

      bank.tail.rotation.z = Math.sin(w * 4) * 0.25 + hit * 1.5;

      for (const { star, a, reach, size: s } of burst) {
        const u = (since - 0.12) / 1.1;

        star.visible = u > 0 && u < 1;
        star.position.set(slot.x + Math.cos(a) * reach * (1 - (1 - u) ** 2), slot.y + 0.1 + Math.sin(a) * reach * (1 - (1 - u) ** 2) - u * u * 0.25, slot.z + 0.3);
        star.scale.setScalar(s * (1.4 - u * 0.6));
        star.material.opacity = (1 - u) ** 0.7;
        star.material.rotation = a + u * 3;
      }

      for (const { ring, delay } of rings) {
        const u = (since - delay) / 0.9;

        ring.visible = u > 0 && u < 1;
        ring.position.set(slot.x, slot.y + 0.15, slot.z + 0.3);
        ring.scale.set(0.5 + u * 2.4, (0.5 + u * 2.4) * 0.45, 1);
        ring.material.opacity = 0.85 * (1 - u);
      }

      for (const { one, x, y, z, phase } of adrift) {
        one.position.set(x + Math.sin(w + phase) * 0.08, y + Math.sin(w * 2 + phase) * 0.07, z);
        one.rotation.z = Math.sin(w + phase) * 0.12;
      }

      // Zara brings both hands together in front of her chest
      const hands = curve(clasp, t);

      for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        rigs.zara.rot(`${side}Arm`, Y, -sign * hands * 0.55);
        rigs.zara.rot(`${side}ForeArm`, X, -hands * 1.75);
        rigs.zara.rot(`${side}ForeArm`, Y, -sign * hands * 0.38);
      }

      for (const effect of effects) effect(t);
    },
  };
}
