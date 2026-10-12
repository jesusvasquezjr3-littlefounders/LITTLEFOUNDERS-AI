// The application's own icons (D-054): small pictures in full color that are alive. Each is described here once;
// `npm run icons` turns the descriptions into Lottie files and rest frames (lottie.mjs says how, and states the
// contract).
//
// HOW AN ICON IS DRAWN
//   - On a 48 grid, inside 4 to 44. Shapes filled with color, no outline around anything: a shape is told from its
//     neighbor by its color. A line is drawn only where the thing itself is a line (a check, a smile).
//   - The brand's colors (`P`), a few of them an icon; it must read on the light page, the dark page and the dark
//     sidebar, so nothing is drawn in a color close to either page.
//   - Round shapes: `soft()` rounds the corners of anything with corners.
//   - Back to front, at most fourteen layers. It must still read at 20 px.
//
// HOW AN ICON MOVES
//   - `idle` (2 s, a loop) is the icon alive: the flame burns, the smoke rises, the face blinks. It is what shows
//     that the thing is on.
//   - `hover` (0.6 s) answers a pointer or the keyboard's focus; `select` (0.8 s) plays when what the icon stands
//     for becomes the current thing.
//   - All three start and end in the rest pose. `motion(rest, { idle, hover, select })` builds the keyframes: each
//     list is `[[u, value], ...]` with `u` from 0 to 1 inside its segment; the rest pose is added at both ends.
//   - `root` moves the whole icon at once (a pop, a bob); every layer follows it.
import { SEGMENTS } from './lottie.mjs';

const P = {
  indigo: '#5c55fd', deep: '#4438cf', pale: '#a5a1ff', orange: '#f5820b', red: '#f0452b', gold: '#ffc23d', yellow: '#ffe58a',
  cream: '#fff4d6', sky: '#4b94ff', mint: '#14b8a0', pink: '#ff7fae', white: '#ffffff',
};

function motion(rest, { idle = [], hover = [], select = [] } = {}) {
  const keys = [];

  for (const [name, list] of [['idle', idle], ['hover', hover], ['select', select]]) {
    const [from, to] = SEGMENTS[name];

    keys.push([from, rest], ...list.map(([u, value]) => [Math.round(from + u * (to - from)), value]), [to, rest]);
  }

  return keys;
}

const n = (value) => Math.round(value * 100) / 100;

/** A closed shape through `points` with every corner rounded by `r`. */
function soft(points, r) {
  const corners = points.map((point, i) => {
    const before = points[(i - 1 + points.length) % points.length];
    const after = points[(i + 1) % points.length];
    const toward = (other) => { const d = Math.hypot(other[0] - point[0], other[1] - point[1]); const k = Math.min(r, d / 2) / d; return [point[0] + (other[0] - point[0]) * k, point[1] + (other[1] - point[1]) * k]; };
    const [a, b] = [toward(before), toward(after)];
    const pull = (from) => [from[0] + (point[0] - from[0]) * 0.56, from[1] + (point[1] - from[1]) * 0.56];

    return { a, b, ca: pull(a), cb: pull(b) };
  });
  const turn = ({ a, b, ca, cb }) => `L${n(a[0])} ${n(a[1])} C${n(ca[0])} ${n(ca[1])} ${n(cb[0])} ${n(cb[1])} ${n(b[0])} ${n(b[1])}`;

  return `M${n(corners[0].b[0])} ${n(corners[0].b[1])} ${corners.slice(1).map(turn).join(' ')} ${turn(corners[0])} Z`;
}

/** A small star of four soft points. */
const star = (cx, cy, R) => soft(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const radius = i % 2 ? R * 0.42 : R; return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]; }), R * 0.16);

/** A tongue of flame standing on (cx, base): `w` half as wide, `h` tall, its tip leaning by `lean`. Always four points, so one pose can turn into another. */
function flame(cx, base, w, h, lean) {
  const tip = [cx + lean, base - h];

  return `M${cx} ${base} C${n(cx - w * 0.9)} ${base} ${n(cx - w)} ${n(base - h * 0.14)} ${n(cx - w)} ${n(base - h * 0.36)} `
    + `C${n(cx - w)} ${n(base - h * 0.62)} ${n(tip[0] - w * 0.34)} ${n(base - h * 0.74)} ${n(tip[0])} ${n(tip[1])} `
    + `C${n(tip[0] + w * 0.16)} ${n(base - h * 0.76)} ${n(cx + w)} ${n(base - h * 0.6)} ${n(cx + w)} ${n(base - h * 0.36)} `
    + `C${n(cx + w)} ${n(base - h * 0.14)} ${n(cx + w * 0.9)} ${base} ${cx} ${base} Z`;
}

/** A flame that never holds still: its poses through the idle loop, and the rest pose at every other boundary. */
function burning(poses) {
  const [from, to] = SEGMENTS.idle;
  const keys = poses.map((pose, i) => [Math.round(from + (i / poses.length) * (to - from)), pose]);

  return [...keys, [to, poses[0]], ...['hover', 'select'].flatMap((name) => SEGMENTS[name].map((frame) => [frame, poses[0]]))];
}

const tongue = (w, h, leans, grow = 1) => burning(leans.map((lean, i) => flame(24, 43, w, h * (i % 2 ? grow : 1), lean)));

/** A round burst of `count` rays: a star whose points reach `R` and whose valleys stay at `r`. */
const burst = (cx, cy, R, r, count, round) => soft(Array.from({ length: count * 2 }, (_, i) => { const a = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2; const radius = i % 2 ? r : R; return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]; }), round);

/** A crescent: what is left of the round at `c` (radius `R`) when the round at `bite` (radius `r`) is taken out of it. */
function crescent(c, R, bite, r) {
  const toward = Math.atan2(bite[1] - c[1], bite[0] - c[0]);
  const steps = 48;
  const outer = [];
  const inner = [];

  for (let i = 0; i < steps; i++) {
    const a = toward + (i / steps) * Math.PI * 2;
    const point = [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R];

    if (Math.hypot(point[0] - bite[0], point[1] - bite[1]) > r + 0.4) outer.push(point);
  }

  for (let i = 0; i < steps; i++) {
    const a = toward - (i / steps) * Math.PI * 2;
    const point = [bite[0] + Math.cos(a) * r, bite[1] + Math.sin(a) * r];

    if (Math.hypot(point[0] - c[0], point[1] - c[1]) < R - 0.4) inner.push(point);
  }

  return soft([...outer, ...inner], 1.4);
}

// the whole icon grows a little past its size and settles: the same landing for every icon when it is selected
const POP = [[0.3, [1.14, 1.14]], [0.6, [0.96, 0.96]], [0.82, [1.03, 1.03]]];
const FOOT = [24, 42];

export const ICONS = [
  {
    name: 'streak',
    // a fire that burns: three tongues of flame, each moving on its own, a glow behind and sparks that rise
    root: { pivot: FOOT, scale: motion([1, 1], { hover: [[0.3, [1.06, 1.16]], [0.65, [0.98, 0.98]]], select: [[0.25, [1.12, 1.3]], [0.55, [0.95, 0.94]], [0.8, [1.03, 1.05]]] }) },
    layers: [
      // the light the fire gives: two soft rounds, one inside the other, so it has no edge
      { name: 'glow', fill: '#ffb347', pivot: [24, 29], shapes: [{ circle: [24, 29, 19] }], opacity: motion(0.1, { idle: [[0.25, 0.17], [0.5, 0.09], [0.75, 0.18]], hover: [[0.4, 0.26]], select: [[0.3, 0.36]] }), scale: motion([1, 1], { idle: [[0.25, [1.06, 1.06]], [0.5, [0.95, 0.95]], [0.75, [1.08, 1.08]]] }) },
      { name: 'glow near', fill: '#ffb347', pivot: [24, 30], shapes: [{ circle: [24, 30, 14] }], opacity: motion(0.14, { idle: [[0.3, 0.24], [0.55, 0.12], [0.8, 0.22]], hover: [[0.4, 0.34]], select: [[0.3, 0.46]] }), scale: motion([1, 1], { idle: [[0.3, [1.1, 1.1]], [0.55, [0.94, 0.94]], [0.8, [1.08, 1.08]]] }) },
      { name: 'outer', even: true, gradient: { from: [24, 43], to: [24, 6], stops: [[0, '#ff8a1f'], [0.55, '#f8531f'], [1, '#e8322b']] }, shapes: [{ morph: tongue(13.2, 36, [0, -4.6, 1.8, 4.8, -2.4, 3.2], 0.88) }] },
      { name: 'middle', even: true, fill: '#ffb020', shapes: [{ morph: tongue(9.4, 24, [1.5, 3.6, -3, -0.6, 3.2, -3.4], 1.2) }] },
      { name: 'core', even: true, fill: P.yellow, shapes: [{ morph: tongue(5.4, 13.5, [-0.8, -2.2, 2, 0.4, -2, 1.8], 1.28) }] },
      { name: 'spark one', even: true, fill: '#ffb020', pivot: [15, 16], shapes: [{ circle: [15, 16, 1.5] }], move: motion([0, 6], { idle: [[0.45, [-1.8, -5]], [0.5, [0, 6]], [0.95, [-1.8, -5]]] }), opacity: motion(0, { idle: [[0.08, 1], [0.38, 0], [0.5, 0], [0.58, 1], [0.9, 0]] }) },
      { name: 'spark two', even: true, fill: '#ff8a1f', pivot: [33, 13], shapes: [{ circle: [33, 13, 1.2] }], move: motion([0, 7], { idle: [[0.2, [0, 7]], [0.7, [2, -4]], [0.72, [0, 7]]] }), opacity: motion(0, { idle: [[0.2, 0], [0.3, 1], [0.66, 0]] }) },
    ],
  },
  {
    name: 'home',
    // a house; its chimney smokes, its windows are lit, and its roof lifts like a lid
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'smoke one', even: true, fill: P.pale, pivot: [33, 8], shapes: [{ circle: [33, 8, 2.6] }], move: motion([0, 2], { idle: [[0.5, [2.5, -4.5]], [0.52, [0, 2]]] }), opacity: motion(0, { idle: [[0.1, 0.9], [0.45, 0], [0.52, 0]] }), scale: motion([0.6, 0.6], { idle: [[0.5, [1.25, 1.25]], [0.52, [0.6, 0.6]]] }) },
      { name: 'smoke two', even: true, fill: P.pale, pivot: [33, 8], shapes: [{ circle: [33, 8, 2.2] }], move: motion([0, 2], { idle: [[0.5, [0, 2]], [0.98, [-2, -4.5]]] }), opacity: motion(0, { idle: [[0.5, 0], [0.6, 0.9], [0.95, 0]] }), scale: motion([0.6, 0.6], { idle: [[0.5, [0.6, 0.6]], [0.98, [1.3, 1.3]]] }) },
      { name: 'chimney', fill: P.deep, shapes: [{ rect: [30.4, 10, 5.6, 11, 2.4] }] },
      { name: 'wall', fill: P.gold, pivot: FOOT, shapes: [{ rect: [10.5, 20, 27, 22, 6] }], scale: motion([1, 1], { hover: [[0.3, [1.04, 0.94]], [0.6, [0.98, 1.03]]] }) },
      { name: 'windows', fill: P.cream, shapes: [{ circle: [16, 30.5, 2.6] }, { circle: [32, 30.5, 2.6] }], opacity: motion(1, { idle: [[0.3, 1], [0.36, 0.45], [0.44, 1]] }) },
      { name: 'door', fill: P.deep, pivot: [24, 42], shapes: [{ rect: [20.4, 29.5, 7.2, 12.5, 3.6] }], scale: motion([1, 1], { hover: [[0.35, [1.2, 1.1]], [0.7, [0.96, 0.98]]] }) },
      { name: 'roof', fill: P.indigo, pivot: [24, 22], shapes: [{ path: soft([[24, 5.5], [44, 24], [4, 24]], 4.4) }], move: motion([0, 0], { hover: [[0.3, [0, -3.4]], [0.62, [0, 0.8]]], select: [[0.28, [0, -4]], [0.6, [0, 1]]] }), rotate: motion(0, { hover: [[0.3, -5], [0.62, 2]] }) },
    ],
  },
  {
    name: 'learn',
    // an open book with a star over it; the star turns and twinkles, a page turns
    root: { pivot: [24, 30], scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'cover', fill: P.deep, shapes: [{ rect: [4.5, 16.5, 39, 25.5, 6] }] },
      { name: 'left page', fill: P.cream, shapes: [{ path: 'M24 18 C20 15.2 13.6 14.8 8 16.6 L8 36.6 C13.6 35 20 35.4 24 38 Z' }] },
      { name: 'right page', fill: P.white, pivot: [24, 28], shapes: [{ path: 'M24 18 C28 15.2 34.4 14.8 40 16.6 L40 36.6 C34.4 35 28 35.4 24 38 Z' }], scale: motion([1, 1], { hover: [[0.35, [0.1, 1.04]], [0.7, [1.04, 1]]] }) },
      { name: 'lines', stroke: P.pale, width: 2.4, shapes: [{ path: 'M12 22.4 C14.6 21.6 17.4 21.6 20 22.4' }, { path: 'M12 28 C14.6 27.2 17.4 27.2 20 28' }], draw: motion(1, { select: [[0.2, 0], [0.4, 0]] }) },
      { name: 'star', fill: P.gold, pivot: [24, 8.5], shapes: [{ path: star(24, 8.5, 6) }], rotate: motion(0, { idle: [[0.5, 45]], hover: [[0.5, 90]], select: [[0.5, 180]] }), scale: motion([1, 1], { idle: [[0.25, [1.18, 1.18]], [0.5, [0.86, 0.86]], [0.75, [1.12, 1.12]]], select: [[0.4, [1.6, 1.6]]] }), move: motion([0, 0], { idle: [[0.5, [0, -1.4]]] }) },
      { name: 'glint', fill: P.yellow, pivot: [34, 9], shapes: [{ path: star(34, 9, 2.6) }], scale: motion([0, 0], { idle: [[0.55, [0, 0]], [0.7, [1, 1]], [0.9, [0, 0]]], select: [[0.3, [1.4, 1.4]], [0.7, [0, 0]]] }) },
    ],
  },
  {
    name: 'mentor',
    // a speech bubble with a face: it bobs, blinks and smiles
    root: { pivot: [24, 24], move: motion([0, 0], { idle: [[0.5, [0, -1.6]]] }), rotate: motion(0, { hover: [[0.3, -8], [0.65, 5]] }), scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'bubble', gradient: { from: [24, 6], to: [24, 42], stops: [[0, '#6f69ff'], [1, P.deep]] }, shapes: [{ path: 'M24 6.5 C34.6 6.5 42 13 42 22 C42 31 34.6 37.5 24 37.5 C21.6 37.5 19.2 37.1 17 36.5 L10.4 40.6 C9.4 41.2 8.3 40.3 8.6 39.2 L10.2 33 C7.6 30.2 6 26.4 6 22 C6 13 13.4 6.5 24 6.5 Z' }] },
      { name: 'eyes', fill: P.white, pivot: [24, 20], shapes: [{ circle: [17.8, 20, 3] }, { circle: [30.2, 20, 3] }], scale: motion([1, 1], { idle: [[0.42, [1, 1]], [0.47, [1, 0.1]], [0.53, [1, 1]]], hover: [[0.2, [1, 0.1]], [0.36, [1, 1]]], select: [[0.3, [1.25, 1.25]], [0.6, [1, 0.12]], [0.78, [1, 1]]] }) },
      { name: 'smile', stroke: P.white, width: 2.8, shapes: [{ path: 'M18.6 27 C21.2 30.2 26.8 30.2 29.4 27' }], draw: motion(1, { select: [[0.2, 0], [0.4, 0]] }) },
      { name: 'spark', fill: P.gold, pivot: [39.5, 8], shapes: [{ path: star(39.5, 8, 4.2) }], scale: motion([1, 1], { idle: [[0.3, [0.5, 0.5]], [0.6, [1.2, 1.2]]], select: [[0.35, [1.7, 1.7]]] }), rotate: motion(0, { idle: [[0.6, 45]], select: [[0.5, 90]] }) },
    ],
  },
  {
    name: 'wallet',
    // a wallet with a golden Seed in it; the Seed bobs, and jumps out and back in
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'back', fill: P.pale, pivot: [9, 18], shapes: [{ path: soft([[8, 13], [34, 8], [38, 12], [38, 22], [8, 22]], 3.6) }], rotate: motion(0, { hover: [[0.3, -9], [0.7, -9], [0.9, 1]], select: [[0.25, -11], [0.7, -11], [0.9, 1]] }) },
      { name: 'seed', gradient: { from: [20, 4], to: [20, 22], stops: [[0, P.yellow], [1, P.gold]] }, pivot: [20, 16], shapes: [{ path: 'M20.8 3.6 C24.6 7 26.4 11 26.2 15 C26 19 23.2 21.6 20 21.6 C16.8 21.6 14 19 14 15 C14 11 16.4 7 20.8 3.6 Z' }], move: motion([0, 1.5], { idle: [[0.5, [0, -0.6]]], hover: [[0.4, [0, -4.5]], [0.75, [0, 3]]], select: [[0.35, [0, -7]], [0.7, [0, 3]]] }), rotate: motion(0, { idle: [[0.5, 6]], hover: [[0.4, 12]], select: [[0.35, -16]] }) },
      { name: 'body', gradient: { from: [24, 16], to: [24, 42], stops: [[0, '#6f69ff'], [1, P.deep]] }, pivot: FOOT, shapes: [{ rect: [5.5, 16, 37, 26, 8] }], scale: motion([1, 1], { hover: [[0.3, [1.03, 0.95]], [0.65, [0.99, 1.02]]] }) },
      { name: 'band', fill: '#352baa', shapes: [{ path: soft([[42.5, 24], [42.5, 34], [33, 34], [28, 29], [33, 24]], 3.4) }] },
      { name: 'stud', fill: P.gold, pivot: [34, 29], shapes: [{ circle: [34, 29, 2.5] }], scale: motion([1, 1], { idle: [[0.5, [1.15, 1.15]]], hover: [[0.35, [1.5, 1.5]]], select: [[0.3, [1.7, 1.7]], [0.6, [0.9, 0.9]]] }) },
    ],
  },
  {
    name: 'tasks',
    // a clipboard with a sheet and a check; the check is drawn again and again
    root: { pivot: [24, 25], rotate: motion(0, { hover: [[0.3, -6], [0.65, 3]] }), scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'board', fill: P.sky, shapes: [{ rect: [8, 8, 32, 35, 8] }] },
      { name: 'sheet', fill: P.white, shapes: [{ rect: [12.5, 13.5, 23, 25, 5.5] }] },
      { name: 'clip', fill: P.deep, shapes: [{ rect: [17.5, 4.5, 13, 8, 4] }] },
      { name: 'check', stroke: P.mint, width: 4.4, pivot: [24, 26], shapes: [{ path: 'M17.4 26.4 L22.4 31.2 L31 20.8' }], draw: motion(1, { idle: [[0.5, 1], [0.56, 0], [0.62, 0], [0.82, 1]], hover: [[0.12, 0], [0.3, 0]], select: [[0.12, 0], [0.34, 0]] }), scale: motion([1, 1], { select: [[0.34, [1, 1]], [0.62, [1.25, 1.25]], [0.82, [0.97, 0.97]]] }) },
    ],
  },
  {
    name: 'family',
    // two grown-ups and a child in front of them; they sway, and the child hops
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'left', fill: P.indigo, pivot: [13, 42], shapes: [{ circle: [13.4, 12.4, 6] }, { rect: [5.5, 21, 16, 21, 8] }], rotate: motion(0, { idle: [[0.5, -2.5]], hover: [[0.35, 5], [0.7, -1]], select: [[0.3, 6], [0.6, -2]] }) },
      { name: 'right', fill: P.pink, pivot: [35, 42], shapes: [{ circle: [34.6, 12.4, 6] }, { rect: [26.5, 21, 16, 21, 8] }], rotate: motion(0, { idle: [[0.5, 2.5]], hover: [[0.35, -5], [0.7, 1]], select: [[0.3, -6], [0.6, 2]] }) },
      { name: 'child', fill: P.gold, pivot: FOOT, shapes: [{ circle: [24, 24.4, 4.8] }, { rect: [17.6, 30.6, 12.8, 11.4, 6.2] }], move: motion([0, 0], { idle: [[0.2, [0, 0]], [0.35, [0, -2.6]], [0.5, [0, 0]]], hover: [[0.12, [0, 1]], [0.4, [0, -5]], [0.68, [0, 0.6]]], select: [[0.1, [0, 1.2]], [0.36, [0, -7]], [0.62, [0, 0.8]], [0.8, [0, -1.2]]] }), scale: motion([1, 1], { hover: [[0.12, [1.06, 0.92]], [0.4, [0.96, 1.05]]], select: [[0.1, [1.08, 0.88]], [0.36, [0.94, 1.07]]] }) },
    ],
  },
  {
    name: 'sun',
    // the light theme: a sun whose rays turn slowly around it
    root: { pivot: [24, 24], scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'rays', even: true, fill: '#ffb020', pivot: [24, 24], shapes: [{ path: burst(24, 24, 19.5, 12.4, 8, 2.4) }], rotate: motion(0, { idle: [[0.5, 22.5]], hover: [[0.5, 45]], select: [[0.5, 90]] }), scale: motion([1, 1], { idle: [[0.25, [1.05, 1.05]], [0.75, [0.95, 0.95]]], hover: [[0.4, [1.12, 1.12]]] }) },
      { name: 'disc', gradient: { from: [24, 13], to: [24, 35], stops: [[0, P.yellow], [1, P.gold]] }, pivot: [24, 24], shapes: [{ circle: [24, 24, 10.6] }], scale: motion([1, 1], { idle: [[0.5, [1.04, 1.04]]], hover: [[0.4, [0.92, 0.92]], [0.7, [1.04, 1.04]]] }) },
      { name: 'shine', fill: P.white, pivot: [20.4, 20.2], shapes: [{ circle: [20.4, 20.2, 2.4] }], opacity: motion(0.55, { idle: [[0.5, 0.9]] }) },
    ],
  },
  {
    name: 'moon',
    // the dark theme: a crescent that rocks a little, with two stars that twinkle beside it
    root: { pivot: [24, 26], rotate: motion(0, { idle: [[0.5, -5]], hover: [[0.35, -16], [0.7, 4]] }), scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'crescent', gradient: { from: [18, 8], to: [26, 42], stops: [[0, P.yellow], [1, P.gold]] }, shapes: [{ path: crescent([21.5, 25.5], 16.5, [29.5, 19.5], 13.6) }] },
      { name: 'star', fill: P.pale, pivot: [35.5, 12], shapes: [{ path: star(35.5, 12, 5.2) }], scale: motion([1, 1], { idle: [[0.3, [0.55, 0.55]], [0.6, [1.15, 1.15]]], select: [[0.4, [1.6, 1.6]]] }), rotate: motion(0, { idle: [[0.6, 45]], select: [[0.5, 90]] }) },
      { name: 'small star', fill: P.pale, pivot: [39, 26.5], shapes: [{ path: star(39, 26.5, 3) }], scale: motion([1, 1], { idle: [[0.2, [1.2, 1.2]], [0.55, [0.4, 0.4]], [0.85, [1.1, 1.1]]], hover: [[0.5, [1.5, 1.5]]] }) },
    ],
  },
  {
    name: 'account',
    // a person, head and shoulders; the head nods
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'shoulders', gradient: { from: [24, 26], to: [24, 42], stops: [[0, '#6f69ff'], [1, P.deep]] }, pivot: FOOT, shapes: [{ rect: [7, 25, 34, 17, 8.5] }], scale: motion([1, 1], { hover: [[0.3, [1.04, 0.93]], [0.65, [0.99, 1.03]]] }) },
      { name: 'head', gradient: { from: [24, 6], to: [24, 23], stops: [[0, P.yellow], [1, P.gold]] }, pivot: [24, 23], shapes: [{ circle: [24, 14.6, 8.4] }], move: motion([0, 0], { idle: [[0.5, [0, -1]]], hover: [[0.3, [0, 2.2]], [0.62, [0, -1.4]]], select: [[0.3, [0, -4]], [0.6, [0, 1]]] }), rotate: motion(0, { idle: [[0.25, -4], [0.75, 4]] }) },
    ],
  },
  {
    name: 'signout',
    // leaving: a door, and an arrow that goes out of it
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'door', gradient: { from: [17, 6], to: [17, 42], stops: [[0, '#6f69ff'], [1, P.deep]] }, pivot: [5, 24], shapes: [{ rect: [5, 6, 24, 36, 7] }], scale: motion([1, 1], { hover: [[0.35, [0.9, 1]], [0.7, [1.02, 1]]], select: [[0.3, [0.84, 1]], [0.65, [1.03, 1]]] }) },
      { name: 'knob', fill: P.gold, shapes: [{ circle: [11.5, 24, 2.3] }] },
      { name: 'arrow', fill: P.orange, pivot: [30, 24], shapes: [{ path: soft([[18, 21], [31, 21], [31, 15.5], [43.5, 24], [31, 32.5], [31, 27], [18, 27]], 2.2) }], move: motion([0, 0], { idle: [[0.35, [-2.4, 0]], [0.6, [0.6, 0]]], hover: [[0.25, [-4, 0]], [0.6, [1.2, 0]]], select: [[0.2, [-5, 0]], [0.5, [1.6, 0]], [0.75, [-0.8, 0]]] }) },
    ],
  },
  {
    name: 'mail',
    // an envelope with something new in it; the flap opens. Gold, so it reads on the indigo button it sits in as on a page
    root: { pivot: FOOT, scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'body', gradient: { from: [24, 12], to: [24, 40], stops: [[0, P.yellow], [1, P.gold]] }, pivot: [24, 40], shapes: [{ rect: [4.5, 12, 39, 28, 7] }], scale: motion([1, 1], { hover: [[0.3, [1.03, 0.95]], [0.65, [0.99, 1.02]]] }) },
      { name: 'flap', fill: '#ff9f1c', pivot: [24, 14], shapes: [{ path: soft([[7.5, 14.5], [40.5, 14.5], [24, 29.5]], 3.6) }], scale: motion([1, 1], { hover: [[0.35, [1, 0.25]], [0.7, [1, 1.06]]], select: [[0.3, [1, 0.15]], [0.65, [1, 1.08]]] }) },
      { name: 'new', fill: P.red, pivot: [38.5, 11.5], shapes: [{ circle: [38.5, 11.5, 5] }], scale: motion([1, 1], { idle: [[0.25, [1.25, 1.25]], [0.5, [0.9, 0.9]], [0.75, [1.15, 1.15]]], select: [[0.35, [1.6, 1.6]], [0.7, [0.9, 0.9]]] }) },
    ],
  },
  {
    name: 'warning',
    // something went wrong: a round triangle that shakes, with its mark
    root: { pivot: [24, 40], rotate: motion(0, { idle: [[0.42, 0], [0.5, -5], [0.58, 5], [0.66, 0]], hover: [[0.2, -9], [0.45, 8], [0.7, -4]], select: [[0.2, -10], [0.45, 9], [0.7, -4]] }), scale: motion([1, 1], { select: POP }) },
    layers: [
      { name: 'sign', gradient: { from: [24, 6], to: [24, 40], stops: [[0, '#ffa63d'], [1, P.orange]] }, shapes: [{ path: soft([[24, 5], [43.5, 39.5], [4.5, 39.5]], 6.5) }] },
      { name: 'mark', stroke: P.white, width: 4.6, shapes: [{ path: 'M24 17.5 L24 26.5' }], draw: motion(1, { select: [[0.2, 0], [0.45, 1]] }) },
      { name: 'dot', fill: P.white, pivot: [24, 33], shapes: [{ circle: [24, 33, 2.5] }], scale: motion([1, 1], { idle: [[0.5, [1.3, 1.3]]], hover: [[0.4, [1.5, 1.5]]] }) },
    ],
  },
  {
    name: 'check',
    // The mark of the thing that is chosen, in a menu or a box: a check is a line, so it is drawn as one, and drawn again when it is chosen.
    layers: [
      { name: 'check', stroke: P.mint, width: 5.4, pivot: [24, 25], shapes: [{ path: 'M11.5 25.5 L20 33.5 L36.5 14.5' }], draw: motion(1, { hover: [[0.12, 0], [0.3, 0]], select: [[0.12, 0], [0.34, 0]] }), scale: motion([1, 1], { select: [[0.34, [1, 1]], [0.62, [1.2, 1.2]], [0.82, [0.97, 0.97]]] }) },
    ],
  },
  {
    name: 'chevron',
    // A plain sign, in the text color: it points left (the page turns it for the other directions) and nudges that way.
    layers: [
      { name: 'chevron', ink: 'stroke', width: 4.4, shapes: [{ path: 'M29 11.6 L16.8 24 L29 36.4' }], move: motion([0, 0], { hover: [[0.3, [-4.5, 0]], [0.65, [1.2, 0]]], select: [[0.25, [5, 0]], [0.55, [-3, 0]], [0.8, [0.8, 0]]] }) },
    ],
  },
  {
    name: 'close',
    // A plain sign, in the text color: two strokes that cross; they turn a quarter and come back.
    root: { pivot: [24, 24], rotate: motion(0, { hover: [[0.5, 90]], select: [[0.5, 180]] }), scale: motion([1, 1], { hover: [[0.5, [0.8, 0.8]]], select: [[0.5, [0.7, 0.7]]] }) },
    layers: [
      { name: 'one', ink: 'stroke', width: 4.4, shapes: [{ path: 'M13 13 L35 35' }] },
      { name: 'two', ink: 'stroke', width: 4.4, shapes: [{ path: 'M35 13 L13 35' }] },
    ],
  },
];
