// The effects of the onboarding's compositions, on top of the set and the characters (onboarding-scene.js):
//
//   sparkles   four-pointed stars that twinkle around each character, brightest as it jumps
//   confetti   a burst in the brand's colors when the characters cheer (the greeting, the nod)
//   puffs      a ring of dust where a character lands
//   motes      specks of warm light drifting up through the lamp's glow and under the bulbs
//   seeds      small golden stars rising from the jar of Seeds (the wide set only)
//
// Everything is a function of the second `t` of the loop and completes whole cycles in it, so the loop is seamless
// and any frame can be drawn on its own. Nothing here is random at run time: positions come from a seeded sequence.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const COLORS = [0x5c55fd, 0xeb7301, 0xebb806, 0x4b94ff, 0x05a893, 0xff6fa5, 0xffffff];

function sequence(seed) {
  let s = seed;

  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function texture(size, draw) {
  const c = document.createElement('canvas');

  c.width = c.height = size;
  draw(c.getContext('2d'), size);

  const t = new THREE.CanvasTexture(c);

  t.colorSpace = THREE.SRGBColorSpace;

  return t;
}

// a four-pointed star with a soft glow behind it
const STAR = texture(128, (g, s) => {
  const glow = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);

  glow.addColorStop(0, 'rgba(255,240,190,0.75)');
  glow.addColorStop(0.35, 'rgba(255,225,150,0.22)');
  glow.addColorStop(1, 'rgba(255,225,150,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#fffdf2';
  g.beginPath();

  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? s * 0.07 : s * 0.46;
    const a = (i / 8) * TAU - Math.PI / 2;

    g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }

  g.closePath();
  g.fill();
});
const DOT = texture(64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);

  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});
const RING = texture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s / 2);

  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});

const sprite = (map, color = 0xffffff) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, toneMapped: false }));

  s.renderOrder = 8;

  return s;
};

/**
 * Adds the effects to `scene` and returns `update(t)`. `actors` is one entry per character on stage: where it stands,
 * how tall it is and the second its jump peaks at (null when it does not jump in this scene). `cheer` says whether the
 * scene has a burst of confetti; `lamps` and `jar` are the places on the set the motes and the golden stars come from.
 */
export function buildVfx(scene, { loop, actors, cheer, lamps, jar }) {
  const group = new THREE.Group();
  const updates = [];
  const next = sequence(11);

  // ---- sparkles around each character
  for (const actor of actors) {
    for (let i = 0; i < 9; i++) {
      const s = sprite(STAR, [0xffffff, 0xfff0b8, 0xdcd9ff][i % 3]);
      const a = next() * TAU;
      const r = 0.42 + next() * 0.42;
      const x = actor.x + Math.cos(a) * r * 1.15;
      const y = actor.height * (0.45 + next() * 0.85);
      const z = actor.z + 0.25 + Math.abs(Math.sin(a)) * 0.3;
      const size = 0.1 + next() * 0.14;
      const speed = 1 + Math.floor(next() * 3);
      const phase = next() * TAU;

      group.add(s);
      updates.push((t) => {
        const twinkle = Math.max(0, Math.sin((t / loop) * TAU * speed + phase)) ** 2;
        // brightest in the second around the jump
        const near = actor.peak === null ? 0.55 : 0.4 + 0.6 * Math.max(0, 1 - Math.abs(t - actor.peak) / 1.1);

        s.position.set(x, y + Math.sin((t / loop) * TAU + phase) * 0.05, z);
        s.scale.setScalar(size * (0.25 + twinkle) * (0.6 + near));
        s.material.opacity = Math.min(1, 0.15 + twinkle * near * 1.2);
        s.material.rotation = phase + (t / loop) * TAU * 0.5;
      });
    }

    // ---- a ring of dust where it lands
    if (actor.peak !== null) {
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: RING, color: 0xfff3dd, transparent: true, depthWrite: false, toneMapped: false }));

      ring.rotation.x = -Math.PI / 2;
      ring.position.set(actor.x, 0.02, actor.z);
      ring.renderOrder = 3;
      group.add(ring);
      updates.push((t) => {
        const since = t - (actor.peak + 0.3);
        const u = since / 0.7;

        ring.visible = u >= 0 && u <= 1;
        ring.scale.setScalar(0.5 + u * 1.3);
        ring.material.opacity = 0.75 * (1 - u);
      });
    }
  }

  // ---- confetti: thrown up from behind the characters half a second before they peak, then it falls
  if (cheer !== null) {
    const middle = actors.reduce((sum, a) => sum + a.x, 0) / actors.length;
    const spread = Math.max(0.9, ...actors.map((a) => Math.abs(a.x - middle) + 0.6));

    for (let i = 0; i < 90; i++) {
      const piece = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.045), new THREE.MeshBasicMaterial({ color: COLORS[i % COLORS.length], side: THREE.DoubleSide, transparent: true, toneMapped: false }));
      const x0 = middle + (next() - 0.5) * spread * 1.3;
      const vx = (next() - 0.5) * 1.5;
      const vy = 3.3 + next() * 1.9;
      const vz = (next() - 0.3) * 0.9;
      const spin = 4 + next() * 9;
      const phase = next() * TAU;
      const delay = next() * 0.25;

      piece.renderOrder = 7;
      group.add(piece);
      updates.push((t) => {
        const since = t - (cheer - 0.55 + delay);

        piece.visible = since >= 0 && since < 3.4;

        if (!piece.visible) return;

        // thrown up for three quarters of a second, then drifting down slowly, swaying, until it rests on the deck
        const up = Math.min(since, 0.75);
        const down = Math.max(0, since - 0.75);

        piece.position.set(x0 + vx * since * 0.75 + Math.sin(since * 3 + phase) * 0.08, Math.max(0.03, 0.9 + vy * up - 2.6 * up * up - down * 0.62), -0.5 + vz * since);
        piece.rotation.set(since * spin + phase, since * spin * 0.7, phase);
        piece.material.opacity = Math.min(1, (3.4 - since) / 0.8);
      });
    }
  }

  // ---- motes of warm light around the lamps
  for (const lamp of lamps) {
    for (let i = 0; i < lamp.count; i++) {
      const m = sprite(DOT, 0xffd995);
      const a = next() * TAU;
      const r = next() * lamp.radius;
      const y0 = next();
      const size = 0.018 + next() * 0.03;
      const laps = 1 + Math.floor(next() * 2);
      const phase = next() * TAU;

      group.add(m);
      updates.push((t) => {
        const rise = (y0 + (t / loop) * laps) % 1;

        m.position.set(lamp.x + Math.cos(a) * r + Math.sin((t / loop) * TAU * 2 + phase) * 0.05, lamp.y - lamp.depth + rise * lamp.depth, lamp.z + Math.sin(a) * r * 0.6);
        m.scale.setScalar(size);
        // fades in at the bottom and out at the top, so no speck ever pops
        m.material.opacity = 0.85 * Math.sin(rise * Math.PI);
      });
    }
  }

  // ---- golden stars rising from the jar of Seeds
  if (jar) {
    for (let i = 0; i < 6; i++) {
      const s = sprite(STAR, 0xffd36b);
      const dx = (next() - 0.5) * 0.22;
      const y0 = next();
      const phase = next() * TAU;

      group.add(s);
      updates.push((t) => {
        const rise = (y0 + (t / loop) * 2) % 1;

        s.position.set(jar.x + dx + Math.sin(rise * TAU + phase) * 0.04, jar.y + rise * 0.55, jar.z + 0.05);
        s.scale.setScalar(0.07 + 0.05 * Math.sin(rise * Math.PI));
        s.material.opacity = Math.sin(rise * Math.PI);
        s.material.rotation = phase + rise * 2;
      });
    }
  }

  scene.add(group);

  return (t) => { for (const update of updates) update(t); };
}
