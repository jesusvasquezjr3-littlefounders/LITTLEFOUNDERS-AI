import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The lesson-complete confetti burst (owner decision OD-28, review item V-12:
 * "Lesson completion gets a confetti burst (reduced-motion static frame)").
 *
 * Built in-house at zero spend (OD-23): no provider, no stock animation, no
 * network. Both files are pure functions of the piece table below and the
 * Bible 02 token colours, so they are reproducible byte for byte:
 *
 *   public/rebuild/motion/lesson-confetti.json        the motion asset (Lottie, 07 §3.1 "Motion of a flat element")
 *   public/rebuild/motion/lesson-confetti-still.svg   its designated static frame (07 §5), the burst's last frame
 *
 *   node scripts/generate-lesson-confetti.mjs          writes both files
 *   node scripts/generate-lesson-confetti.mjs --check  fails if a checked-in file differs
 *
 * The asset gate (`check-rebuild-assets.mjs`, in `spec:check`) imports
 * `synthesize(path)` and runs the same comparison for every manifest row that
 * names this script as its `generator`.
 *
 * The motion (Frontend 04 §2, 07 §5):
 *   - twelve flat pieces (dots and short bars) burst out from one point, the
 *     medal's centre, and land above it, so no piece ever sits on the heading;
 *   - the entrance is the celebration's own timing: --dur-transition plus
 *     --dur-component (630 ms, inside the 700 ms celebration budget) on
 *     --ease-enter, each piece starting a quarter of --dur-instant after the
 *     previous one in its group of four; the file then holds its last frame
 *     until 900 ms, well inside the 3 s ceiling, and plays once (never loops);
 *   - three hues from the token sheet (reward, mint, berry): the accent is the
 *     call to action only and error red never appears in art (02 §4.2, 07 §3).
 *     Hue fills are the same in both modes (02 §5), so one file serves both;
 *   - no text, no raster, no gradient, no expression.
 */

export const WIDTH = 320;
export const HEIGHT = 160;
/** Where the burst starts: the medal's centre, 10 px above the bottom edge of the frame. */
export const ORIGIN = [160, 150];
export const FPS = 60;
export const TOTAL_FRAMES = 54; // 900 ms
const TRAVEL_FRAMES = Math.round((380 + 250) / 1000 * FPS); // --dur-transition + --dur-component = 630 ms
const STAGGER_FRAMES = (80 / 4) / 1000 * FPS; // a quarter of --dur-instant
export const MOTION_TOKENS = ['--dur-transition', '--dur-component', '--dur-instant', '--ease-enter'];

/** Landing offsets from the origin (px), turn (deg), token hue and shape. Every y is negative: above the medal. */
export const PIECES = [
  { x: -150, y: -70, turn: -30, tone: 'mint', shape: 'bar' }, { x: -118, y: -26, turn: 40, tone: 'berry', shape: 'dot' },
  { x: -92, y: -118, turn: 15, tone: 'reward', shape: 'bar' }, { x: -64, y: -34, turn: -55, tone: 'reward', shape: 'bar' },
  { x: -40, y: -96, turn: 70, tone: 'berry', shape: 'dot' }, { x: -18, y: -140, turn: -20, tone: 'mint', shape: 'dot' },
  { x: 20, y: -128, turn: 35, tone: 'berry', shape: 'bar' }, { x: 46, y: -84, turn: -65, tone: 'reward', shape: 'dot' },
  { x: 70, y: -30, turn: 25, tone: 'mint', shape: 'dot' }, { x: 96, y: -112, turn: -40, tone: 'reward', shape: 'bar' },
  { x: 124, y: -22, turn: 55, tone: 'mint', shape: 'bar' }, { x: 148, y: -62, turn: -15, tone: 'berry', shape: 'dot' },
];
const DOT = 10;
const BAR = [6, 14];
const BAR_RADIUS = 2;

const frontendRoot = resolve(import.meta.dirname, '..');
const MOTION_PATH = '/rebuild/motion/lesson-confetti.json';
const STILL_PATH = '/rebuild/motion/lesson-confetti-still.svg';

/** The light token sheet's value for a hue (hue fills do not change with the mode, 02 §5). */
function tokenColours() {
  const sheet = readFileSync(resolve(frontendRoot, 'src/rebuild/design/tokens.css'), 'utf8');
  const light = sheet.slice(0, sheet.indexOf('}'));
  return Object.fromEntries(['reward', 'mint', 'berry'].map((name) => {
    const value = light.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, 'i'))?.[1];
    if (!value) throw new Error(`Token colour --${name} not found`);
    return [name, value.toLowerCase()];
  }));
}

const round = (value, places = 4) => Number(value.toFixed(places));
const rgba = (hex) => [1, 3, 5].map((i) => round(Number.parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);
// --ease-enter is cubic-bezier(0, 0, .2, 1): Lottie writes it as the out tangent of the first key and the in tangent of the next.
const EASE_OUT = { x: [0], y: [0] };
const EASE_IN = { x: [0.2], y: [1] };
const animated = (from, to, start, end) => ({ a: 1, k: [{ t: start, s: from, o: EASE_OUT, i: EASE_IN }, { t: end, s: to }] });
const still = (value) => ({ a: 0, k: value });

function landing(piece) {
  return [ORIGIN[0] + piece.x, ORIGIN[1] + piece.y];
}

/** The Lottie (bodymovin 5.7 schema): one shape layer per piece. */
export function lottie(colours = tokenColours()) {
  const layers = PIECES.map((piece, index) => {
    const start = round(STAGGER_FRAMES * (index % 4), 2);
    const end = start + TRAVEL_FRAMES;
    const [x, y] = landing(piece);
    const shape = piece.shape === 'dot'
      ? { ty: 'el', nm: 'dot', d: 1, s: still([DOT, DOT]), p: still([0, 0]) }
      : { ty: 'rc', nm: 'bar', d: 1, s: still(BAR), p: still([0, 0]), r: still(BAR_RADIUS) };
    return {
      ddd: 0, ind: index + 1, ty: 4, nm: `piece-${index + 1}`, sr: 1, ao: 0, ip: 0, op: TOTAL_FRAMES, st: 0, bm: 0,
      ks: {
        o: { a: 1, k: [{ t: start, s: [0], o: EASE_OUT, i: EASE_IN }, { t: round(start + TRAVEL_FRAMES * 0.3, 2), s: [100] }] },
        r: animated([0], [piece.turn], start, end),
        p: animated([ORIGIN[0], ORIGIN[1], 0], [x, y, 0], start, end),
        a: still([0, 0, 0]),
        s: animated([40, 40, 100], [100, 100, 100], start, end),
      },
      shapes: [{
        ty: 'gr', nm: piece.shape, it: [
          shape,
          { ty: 'fl', nm: 'fill', c: still(rgba(colours[piece.tone])), o: still(100), r: 1 },
          { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100) },
        ],
      }],
    };
  });
  return { v: '5.7.4', nm: 'lesson-confetti', fr: FPS, ip: 0, op: TOTAL_FRAMES, w: WIDTH, h: HEIGHT, ddd: 0, assets: [], layers };
}

/** The static frame: every piece where the burst leaves it (07 §5), plain in-house shapes in token colours. */
export function stillFrame(colours = tokenColours()) {
  const shapes = PIECES.map((piece) => {
    const [x, y] = landing(piece);
    const fill = colours[piece.tone];
    if (piece.shape === 'dot') return `<circle cx="${x}" cy="${y}" r="${DOT / 2}" fill="${fill}"/>`;
    return `<rect x="${x - BAR[0] / 2}" y="${y - BAR[1] / 2}" width="${BAR[0]}" height="${BAR[1]}" rx="${BAR_RADIUS}" fill="${fill}" transform="rotate(${piece.turn} ${x} ${y})"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${shapes.join('')}</svg>\n`;
}

/** The bytes of one generated file, by its manifest path (the asset gate's generator contract). */
export function synthesize(path = MOTION_PATH) {
  if (path === STILL_PATH) return Buffer.from(stillFrame(), 'utf8');
  if (path === MOTION_PATH) return Buffer.from(`${JSON.stringify(lottie())}\n`, 'utf8');
  throw new Error(`generate-lesson-confetti makes ${MOTION_PATH} and ${STILL_PATH}, not ${path}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const check = process.argv.includes('--check');
  const drifted = [];
  for (const path of [MOTION_PATH, STILL_PATH]) {
    const file = resolve(frontendRoot, `public${path}`);
    const bytes = synthesize(path);
    if (check) {
      let current = null;
      try { current = readFileSync(file); } catch { /* missing counts as drift */ }
      if (!current || !current.equals(bytes)) drifted.push(path);
    } else writeFileSync(file, bytes);
  }
  if (drifted.length) throw new Error(`Confetti asset drifted from its generator: ${drifted.join(', ')}. Run node frontend/scripts/generate-lesson-confetti.mjs`);
  console.log(check ? 'Lesson confetti matches its generator (motion asset and static frame).' : `Wrote ${MOTION_PATH} and ${STILL_PATH}.`);
}
