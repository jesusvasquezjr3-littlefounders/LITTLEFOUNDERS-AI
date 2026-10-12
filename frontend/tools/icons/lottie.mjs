// Turns the description of an icon (definitions.mjs) into the two things the application uses:
//
//   a Lottie animation (the JSON the player runs), and
//   its rest frame as plain SVG shapes, which the page draws at once, before the player has loaded, and which is
//   all a person who asked for less motion ever gets.
//
// An icon is a small picture in full color, drawn on a 48 by 48 grid in layers. A layer has one paint (a color, a
// gradient, or the text color for the few plain signs), a list of shapes, and may move: its position, scale,
// rotation and opacity, how much of a line is drawn, and the very outline of a shape, each as keyframes. Both
// outputs are made from the same description, so the still and the animation cannot drift apart.
//
// THE CONTRACT every icon follows (build.mjs checks it):
//   - 48 by 48, 60 frames a second, no images, no expressions (so the player needs no `eval`, see SECURITY-GUIDE).
//   - Shapes are filled with color and have no outline. A line is used only where the thing drawn is a line (a
//     check mark, a smile), never to draw around a shape.
//   - Frame 0 is the rest pose. `idle` is a loop: the icon alive (a flame burning, smoke rising). `hover` and
//     `select` are played once. Every one starts and ends in the rest pose, so they follow each other without a jump.
//   - Round shapes: a corner is an arc.
export const SIZE = 48;
export const FPS = 60;
export const SEGMENTS = { idle: [0, 120], hover: [140, 176], select: [200, 248] };
export const LAST = 250;

const still = (value) => ({ a: 0, k: value });
// ease in and out of every pose
const EASE = { i: { x: [0.3], y: [1] }, o: { x: [0.5], y: [0] } };
// a loop that must not pause at each key (a flame, a drift) passes through its keys evenly
const EVEN = { i: { x: [0.6], y: [0.6] }, o: { x: [0.4], y: [0.4] } };

/** `[[frame, value], ...]` as Lottie keyframes; a single pair, or none, is a property that does not move. */
function animated(keys, fallback, wrap = (v) => v, ease = EASE) {
  if (!keys || keys.length === 0) return still(wrap(fallback));
  if (keys.length === 1) return still(wrap(keys[0][1]));

  return { a: 1, k: keys.map(([t, value], i) => (i < keys.length - 1 ? { t, s: [].concat(wrap(value)), ...ease } : { t, s: [].concat(wrap(value)) })) };
}

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);

  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.round(v * 1000) / 1000);
}

/** An SVG path of absolute M, L, C and Z commands as Lottie's vertices and tangents. */
export function parsePath(d) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const v = [];
  const i = [];
  const o = [];
  let closed = false;
  let at = 0;
  const number = () => Number(tokens[at++]);

  while (at < tokens.length) {
    const command = tokens[at++];

    if (command === 'M' || command === 'L') {
      v.push([number(), number()]);
      i.push([0, 0]);
      o.push([0, 0]);
    } else if (command === 'C') {
      const [x1, y1, x2, y2, x, y] = [number(), number(), number(), number(), number(), number()];
      const from = v[v.length - 1];

      o[o.length - 1] = [x1 - from[0], y1 - from[1]];
      v.push([x, y]);
      i.push([x2 - x, y2 - y]);
      o.push([0, 0]);
    } else if (command === 'Z') {
      closed = true;
    } else {
      throw new Error(`An icon's path may use M, L, C and Z only: "${d}"`);
    }
  }

  // a closed path whose last point is its first: the two are one vertex
  if (closed && v.length > 1 && Math.hypot(v[0][0] - v.at(-1)[0], v[0][1] - v.at(-1)[1]) < 0.001) {
    i[0] = i.at(-1);
    v.pop();
    i.pop();
    o.pop();
  }

  const round = (list) => list.map((p) => p.map((n) => Math.round(n * 100) / 100));

  return { v: round(v), i: round(i), o: round(o), c: closed };
}

function shapeToLottie(shape) {
  if (shape.circle) { const [x, y, r] = shape.circle; return { ty: 'el', d: 1, p: still([x, y]), s: still([r * 2, r * 2]) }; }
  if (shape.ellipse) { const [x, y, rx, ry] = shape.ellipse; return { ty: 'el', d: 1, p: still([x, y]), s: still([rx * 2, ry * 2]) }; }
  if (shape.rect) { const [x, y, w, h, r] = shape.rect; return { ty: 'rc', d: 1, p: still([x + w / 2, y + h / 2]), s: still([w, h]), r: still(r) }; }
  // an outline that changes: the same number of points in every pose, so each point travels to its next place
  if (shape.morph) return { ty: 'sh', ks: { a: 1, k: shape.morph.map(([t, d], i) => (i < shape.morph.length - 1 ? { t, s: [parsePath(d)], ...(shape.even ? EVEN : EASE) } : { t, s: [parsePath(d)] })) } };

  return { ty: 'sh', ks: still(parsePath(shape.path)) };
}

function shapeToSvg(shape) {
  if (shape.circle) { const [cx, cy, r] = shape.circle; return { tag: 'circle', attrs: { cx, cy, r } }; }
  if (shape.ellipse) { const [cx, cy, rx, ry] = shape.ellipse; return { tag: 'ellipse', attrs: { cx, cy, rx, ry } }; }
  if (shape.rect) { const [x, y, width, height, rx] = shape.rect; return { tag: 'rect', attrs: { x, y, width, height, rx } }; }

  return { tag: 'path', attrs: { d: shape.morph ? shape.morph[0][1] : shape.path } };
}

const first = (keys, fallback) => (keys && keys.length ? keys[0][1] : fallback);

/** What a layer is painted with, for the player. A layer painted in the text color carries a class the page colors. */
function paintOf(layer) {
  if (layer.gradient) {
    const { from, to, stops } = layer.gradient;

    return { ty: 'gf', o: still(100), r: 1, bm: 0, t: 1, s: still(from), e: still(to), g: { p: stops.length, k: still(stops.flatMap(([at, color]) => [at, ...rgb(color)])) } };
  }

  if (layer.stroke || layer.ink === 'stroke') return { ty: 'st', c: still([...rgb(layer.stroke ?? '#000000'), 1]), o: still(100), w: still(layer.width), lc: 2, lj: 2 };

  return { ty: 'fl', c: still([...rgb(layer.fill ?? '#000000'), 1]), o: still(100), r: 1 };
}

/** How a layer (or the whole icon) is placed and moved, around its pivot. */
function transformOf(layer) {
  const pivot = layer.pivot ?? [SIZE / 2, SIZE / 2];
  const ease = layer.even ? EVEN : EASE;

  return {
    o: animated(layer.opacity, 1, (v) => [v * 100], ease),
    r: animated(layer.rotate, 0, (v) => [v], ease),
    p: animated(layer.move, [0, 0], ([x, y]) => [pivot[0] + x, pivot[1] + y, 0], ease),
    a: still([pivot[0], pivot[1], 0]),
    s: animated(layer.scale, [1, 1], (v) => { const [x, y] = [].concat(v).length === 2 ? v : [v, v]; return [x * 100, y * 100, 100]; }, ease),
  };
}

const ROOT = 100;

/** The Lottie animation of one icon. */
export function toLottie(icon) {
  const layers = icon.layers.map((layer, index) => {
    const trim = layer.draw ? [{ ty: 'tm', s: still(0), e: animated(layer.draw, 100, (v) => [v * 100]), o: still(0), m: 1 }] : [];

    return {
      ddd: 0, ind: index + 1, ty: 4, nm: layer.name, ...(layer.ink ? { cl: `ink-${layer.ink}` } : {}), sr: 1, ao: 0, ip: 0, op: LAST, st: 0, bm: 0,
      // every layer follows the icon's root, when it has one
      ...(icon.root ? { parent: ROOT } : {}),
      ks: transformOf(layer),
      shapes: [{
        ty: 'gr', nm: layer.name,
        it: [...layer.shapes.map((shape) => shapeToLottie({ ...shape, even: layer.even })), ...trim, paintOf(layer), { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) }],
      }],
    };
  });

  return {
    v: '5.9.0', fr: FPS, ip: 0, op: LAST, w: SIZE, h: SIZE, nm: icon.name, ddd: 0, assets: [],
    // Lottie draws its first layer on top; an icon is described from the back to the front
    // the root is an empty layer that is never drawn: it only carries the movement of the whole icon
    layers: [...layers.reverse(), ...(icon.root ? [{ ddd: 0, ind: ROOT, ty: 3, nm: 'root', sr: 1, ao: 0, ip: 0, op: LAST, st: 0, bm: 0, ks: transformOf(icon.root) }] : [])],
    markers: Object.entries(SEGMENTS).map(([name, [from, to]]) => ({ tm: from, cm: name, dr: to - from })),
  };
}

/** The rest frame of one icon as SVG shapes, back to front. */
export function toRest(icon) {
  return icon.layers.map((layer) => {
    const pivot = layer.pivot ?? [SIZE / 2, SIZE / 2];
    const [x, y] = first(layer.move, [0, 0]);
    const scale = [].concat(first(layer.scale, [1, 1]));
    const [sx, sy] = scale.length === 2 ? scale : [scale[0], scale[0]];
    const rotate = first(layer.rotate, 0);
    const opacity = first(layer.opacity, 1);
    const draw = first(layer.draw, 1);
    const moved = x || y || rotate || sx !== 1 || sy !== 1;

    return {
      ...(layer.ink ? { ink: layer.ink } : layer.gradient ? { gradient: layer.gradient } : layer.stroke ? { stroke: layer.stroke } : { fill: layer.fill }),
      ...(layer.width ? { width: layer.width } : {}),
      ...(moved ? { transform: `translate(${pivot[0] + x} ${pivot[1] + y}) rotate(${rotate}) scale(${sx} ${sy}) translate(${-pivot[0]} ${-pivot[1]})` } : {}),
      // a layer that is not drawn or not seen at rest is left out of the still by its opacity
      ...(opacity !== 1 || draw === 0 ? { opacity: draw === 0 ? 0 : opacity } : {}),
      figures: layer.shapes.map(shapeToSvg),
    };
  });
}
