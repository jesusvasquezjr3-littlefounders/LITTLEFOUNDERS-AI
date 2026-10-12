// Writes the application's icons from their descriptions (definitions.mjs). A developer tool: `npm run icons`.
//
//   src/icons/lottie/<name>.json   the animation the player runs, one small file an icon
//   src/icons/rest.ts              every icon's rest frame as SVG shapes, and the list of names
//
// Both are generated: change definitions.mjs and run this again, never edit them by hand. It then checks every
// icon against the contract (lottie.mjs) and fails if one breaks it.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from './definitions.mjs';
import { FPS, LAST, SEGMENTS, SIZE, parsePath, toLottie, toRest } from './lottie.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../src/icons');
const BUDGET = 24 * 1024;
const MOST_LAYERS = 14;
const problems = [];
const fail = (icon, what) => problems.push(`${icon}: ${what}`);
const BOUNDARIES = Object.values(SEGMENTS).flat();

/** The value of a property at a frame where it must have a keyframe (the ends of a segment). */
function valueAt(property, frame) {
  if (property.a !== 1) return JSON.stringify([].concat(property.k));

  const key = property.k.find((k) => k.t === frame);

  return key ? JSON.stringify(key.s) : null;
}

function check(icon, lottie, bytes) {
  if (!/^[a-z][a-z-]*$/.test(icon.name)) fail(icon.name, 'a name is lowercase words joined by hyphens');
  if (lottie.w !== SIZE || lottie.h !== SIZE || lottie.fr !== FPS) fail(icon.name, 'the grid is 48 by 48 at 60 frames a second');
  if (lottie.assets.length) fail(icon.name, 'no images or nested animations');
  if (icon.layers.length > MOST_LAYERS) fail(icon.name, `at most ${MOST_LAYERS} layers (it has ${icon.layers.length})`);
  if (bytes > BUDGET) fail(icon.name, `the file is ${bytes} bytes, over the budget of ${BUDGET}`);
  // an expression is code the player would have to evaluate: none, ever
  if (/"x":\s*"/.test(JSON.stringify(lottie))) fail(icon.name, 'no expressions');

  for (const layer of icon.layers) {
    const paints = [layer.fill, layer.gradient, layer.stroke, layer.ink].filter(Boolean).length;

    if (paints !== 1) fail(icon.name, `layer "${layer.name}" needs exactly one of fill, gradient, stroke or ink`);
    if ((layer.stroke || layer.ink === 'stroke') && !layer.width) fail(icon.name, `layer "${layer.name}" is a line and needs a width`);
    if (layer.draw && !(layer.stroke || layer.ink === 'stroke')) fail(icon.name, `layer "${layer.name}": only a line can be drawn little by little`);

    for (const shape of layer.shapes) {
      const paths = shape.morph ? shape.morph.map(([, d]) => d) : shape.path ? [shape.path] : [];
      const numbers = shape.circle ?? shape.ellipse ?? shape.rect?.slice(0, 4) ?? paths.flatMap((d) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number));

      if (numbers.some((value) => value < -2 || value > SIZE + 2)) fail(icon.name, `layer "${layer.name}" leaves the 48 grid`);
      if (shape.rect && shape.rect[4] < Math.min(shape.rect[2], shape.rect[3]) * 0.2) fail(icon.name, `layer "${layer.name}" has a rectangle with corners that are not round enough`);

      if (shape.morph) {
        const counts = new Set(paths.map((d) => parsePath(d).v.length));
        const rest = shape.morph[0][1];

        if (counts.size !== 1) fail(icon.name, `layer "${layer.name}": the poses of a shape that changes need the same number of points`);

        for (const frame of BOUNDARIES) {
          if (shape.morph.find(([t]) => t === frame)?.[1] !== rest) fail(icon.name, `layer "${layer.name}": its outline is not in the rest pose at frame ${frame}`);
        }
      }
    }
  }

  if (icon.root && ['move', 'scale', 'rotate', 'opacity'].some((key) => icon.root[key] && JSON.stringify(icon.root[key][0][1]) !== JSON.stringify({ move: [0, 0], scale: [1, 1], rotate: 0, opacity: 1 }[key]))) fail(icon.name, 'the root rests in place, at full size, upright and opaque');

  // every segment starts and ends in the rest pose, so one follows another without a jump
  for (const layer of lottie.layers) {
    const trim = layer.shapes?.[0].it.find((item) => item.ty === 'tm');
    const moving = { opacity: layer.ks.o, rotation: layer.ks.r, position: layer.ks.p, scale: layer.ks.s, ...(trim ? { drawing: trim.e } : {}) };

    for (const [what, property] of Object.entries(moving)) {
      const rest = valueAt(property, 0);

      for (const frame of BOUNDARIES) {
        if (valueAt(property, frame) !== rest) fail(icon.name, `layer "${layer.nm}": its ${what} is not in the rest pose at frame ${frame}`);
      }

      if (property.a === 1) {
        if (property.k.some((k) => k.t < 0 || k.t > LAST)) fail(icon.name, `layer "${layer.nm}": a keyframe of its ${what} is outside the animation`);
        if (property.k.some((k, i) => i > 0 && k.t <= property.k[i - 1].t)) fail(icon.name, `layer "${layer.nm}": the keyframes of its ${what} are not in order`);
      }
    }
  }
}

rmSync(join(out, 'lottie'), { recursive: true, force: true });
mkdirSync(join(out, 'lottie'), { recursive: true });

const names = new Set();
const rest = {};
const sizes = [];

for (const icon of ICONS) {
  if (names.has(icon.name)) fail(icon.name, 'two icons have this name');

  names.add(icon.name);

  const lottie = toLottie(icon);
  const json = JSON.stringify(lottie);

  check(icon, lottie, Buffer.byteLength(json));
  sizes.push(Buffer.byteLength(json));
  writeFileSync(join(out, 'lottie', `${icon.name}.json`), `${json}\n`);
  rest[icon.name] = toRest(icon);
}

const header = `// GENERATED by tools/icons/build.mjs from tools/icons/definitions.mjs (\`npm run icons\`). Do not edit by hand.
//
// The rest frame of every icon of the application, as SVG shapes drawn back to front, and the animation each one
// loads when it is first needed. \`AppIcon\` (components/AppIcon.tsx) draws them.
`;
const body = `export const ICON_SIZE = ${SIZE};

/** Where each named movement of an icon starts and ends, in frames. \`idle\` is a loop; the others play once. */
export const ICON_SEGMENTS = ${JSON.stringify(SEGMENTS)} as const;

export const ICON_NAMES = ${JSON.stringify([...names])} as const;

export type IconName = (typeof ICON_NAMES)[number];

/** One drawn figure of a layer. */
export type IconFigure =
  | { tag: 'path'; attrs: { d: string } }
  | { tag: 'circle'; attrs: { cx: number; cy: number; r: number } }
  | { tag: 'ellipse'; attrs: { cx: number; cy: number; rx: number; ry: number } }
  | { tag: 'rect'; attrs: { x: number; y: number; width: number; height: number; rx: number } };

/** What a layer is painted with: a color, a gradient, a line of a color, or the text color (\`ink\`). */
export type IconLayer = {
  fill?: string;
  gradient?: { from: number[]; to: number[]; stops: (string | number)[][] };
  stroke?: string;
  ink?: 'fill' | 'stroke';
  width?: number;
  transform?: string;
  opacity?: number;
  figures: IconFigure[];
};

export const ICON_REST: Record<IconName, IconLayer[]> = ${JSON.stringify(rest, null, 2)};

/** The animation of an icon: a small file of its own, fetched the first time the icon has to move. */
export const ICON_ANIMATIONS: Record<IconName, () => Promise<{ default: unknown }>> = {
${[...names].map((name) => `  ${/-/.test(name) ? `'${name}'` : name}: () => import('./lottie/${name}.json'),`).join('\n')}
};
`;

writeFileSync(join(out, 'rest.ts'), header + body);

if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(`${names.size} icons written to src/icons (${Math.round(sizes.reduce((a, b) => a + b, 0) / 1024)} KB of animation in all, the largest ${Math.max(...sizes)} bytes); every one follows the contract`);
