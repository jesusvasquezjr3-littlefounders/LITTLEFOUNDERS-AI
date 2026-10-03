import { even, isRecord, unique, type HzBuilder, type Json } from './shared.js';

interface Pt { x: number; y: number }

const at = (x: number, y: number): Pt => ({ x, y });
const key = (point: Pt): string => `${point.x},${point.y}`;
const wrap = (list: Pt[]): Json => ({ points: list.map((point) => ({ x: point.x, y: point.y })) });
const keysOf = (list: Pt[]): Set<string> => new Set(list.map(key));

const lcg = (seed: number) => {
  let state = seed >>> 0;
  return (bound: number): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) % bound; };
};

function readPoints(response: Json): Pt[] | null {
  if (!isRecord(response) || !Array.isArray(response.points)) return null;
  return response.points.every((point) => isRecord(point) && Number.isInteger(point.x) && Number.isInteger(point.y)) ? response.points : null;
}

function sameAs(response: Json, target: Pt[]): boolean {
  const got = readPoints(response);
  if (!got) return false;
  const wanted = keysOf(target);
  return got.length === target.length && keysOf(got).size === got.length && got.every((point) => wanted.has(key(point)));
}

const malformed = (sample: Pt, off: Pt): Json[] => [
  wrap([off]),
  { points: [{ x: sample.x + 0.5, y: sample.y }] },
  { points: [{ x: String(sample.x), y: sample.y }] },
  { points: [sample, sample] },
  { points: [{ x: sample.x, y: sample.y, z: 0 }] },
  { points: [sample], extra: 1 },
  {},
  { points: null },
  { points: 'none' },
  { points: [null] },
];

const gridOf = (columns: number, rows: number): Pt[] => Array.from({ length: columns * rows }, (_, index) => at(Math.floor(index / rows), index % rows));

function insideOutline(outline: Pt[], column: number, row: number): boolean {
  let crossings = 0;
  outline.forEach((a, index) => {
    const b = outline[(index + 1) % outline.length]!;
    if (a.x === b.x && a.x >= column + 1 && Math.min(a.y, b.y) <= row && row < Math.max(a.y, b.y)) crossings += 1;
  });
  return crossings % 2 === 1;
}

const area: HzBuilder = (p) => {
  const columns = p.columns as number;
  const rows = p.rows as number;
  const grid = gridOf(columns, rows);
  const required = grid.filter((cell) => insideOutline(p.outline as Pt[], cell.x, cell.y));
  if (required.length === 0) return null;
  const inside = keysOf(required);
  const outside = grid.filter((cell) => !inside.has(key(cell)));
  const without = (index: number): Pt[] => required.filter((_, position) => position !== index);
  const xs = (p.outline as Pt[]).map((point) => point.x);
  const ys = (p.outline as Pt[]).map((point) => point.y);
  const states: Pt[][] = [
    ...grid.map((cell) => [cell]),
    required, [...required].reverse(), grid, outside,
    ...required.map((_, index) => without(index)),
    ...outside.map((cell) => [...required, cell]),
    ...required.slice(0, 6).flatMap((_, index) => outside.slice(0, 6).map((cell) => [...without(index), cell])),
    ...required.slice(1).map((_, index) => required.slice(0, index + 1)),
    grid.filter((cell) => cell.x >= Math.min(...xs) && cell.x < Math.max(...xs) && cell.y >= Math.min(...ys) && cell.y < Math.max(...ys)),
    ...Array.from({ length: rows }, (_, row) => grid.filter((cell) => cell.y === row)),
    ...Array.from({ length: columns }, (_, column) => grid.filter((cell) => cell.x === column)),
  ];
  const rand = lcg(columns * 31 + rows);
  for (let draw = 0; draw < 300; draw += 1) states.push(grid.filter(() => rand(2) === 1));
  return {
    inRange: unique(states.filter((cells) => cells.length > 0).map(wrap)),
    invalid: [...malformed(grid[0]!, at(columns, 0)), wrap([at(-1, 0)]), wrap([at(0, rows)]), wrap([...grid, at(columns, rows)])],
    initial: wrap([]),
    expectMet: (response) => sameAs(response, required),
  };
};

type Move = Json;

function imageOf(move: Move, point: Pt): Pt | null {
  if (move.kind === 'translate') return at(point.x + move.dx, point.y + move.dy);
  if (move.kind === 'reflect') {
    if (move.across === 'vertical') return at(2 * move.at - point.x, point.y);
    if (move.across === 'horizontal') return at(point.x, 2 * move.at - point.y);
    if (move.across === 'diagonal') return at(point.y - move.at, point.x + move.at);
    return at(move.at - point.y, move.at - point.x);
  }
  if (move.kind === 'rotate') {
    const dx = point.x - move.about.x;
    const dy = point.y - move.about.y;
    if (move.degrees === 90) return at(move.about.x - dy, move.about.y + dx);
    if (move.degrees === 180) return at(move.about.x - dx, move.about.y - dy);
    return at(move.about.x + dy, move.about.y - dx);
  }
  if (move.kind === 'dilate') {
    const dx = (point.x - move.about.x) * move.num;
    const dy = (point.y - move.about.y) * move.num;
    return dx % move.den === 0 && dy % move.den === 0 ? at(move.about.x + dx / move.den, move.about.y + dy / move.den) : null;
  }
  return null;
}

function figureImage(move: Move, figure: Pt[]): Pt[] | null {
  const moved = figure.map((point) => imageOf(move, point));
  return moved.every((point) => point !== null) ? (moved as Pt[]) : null;
}

function rivalMoves(move: Move): Move[] {
  if (move.kind === 'reflect') {
    return [...['vertical', 'horizontal', 'diagonal', 'anti-diagonal'].flatMap((across) => [{ kind: 'reflect', across, at: move.at }, { kind: 'reflect', across, at: 0 }]),
      { ...move, at: move.at + 1 }, { ...move, at: move.at - 1 }];
  }
  if (move.kind === 'translate') return [{ ...move, dx: -move.dx, dy: -move.dy }, { ...move, dx: move.dy, dy: move.dx }, { ...move, dy: 0 }, { ...move, dx: 0 }];
  if (move.kind === 'rotate') {
    return [90, 180, 270].filter((degrees) => degrees !== move.degrees).map((degrees) => ({ ...move, degrees })).concat([{ ...move, about: at(0, 0) }]);
  }
  return [{ ...move, num: move.den, den: move.num }, { ...move, about: at(0, 0) }, { ...move, num: move.num + 1 }];
}

const transform: HzBuilder = (p) => {
  const extent = p.extent as number;
  const figure = p.figure as Pt[];
  const image = figureImage(p.move, figure);
  if (!image) return null;
  const width = figure.length;
  const universe: Pt[] = [];
  for (let x = -extent; x <= extent; x += 1) for (let y = -extent; y <= extent; y += 1) universe.push(at(x, y));
  const inFrame = (list: Pt[]): boolean => list.every((point) => Math.abs(point.x) <= extent && Math.abs(point.y) <= extent);
  const rand = lcg(extent * 17 + width);
  const subsets: Pt[][] = [];
  for (let mask = 1; mask < 2 ** width; mask += 1) subsets.push(image.filter((_, index) => (mask >> index) & 1));
  const states: Pt[][] = [
    ...universe.map((point) => [point]),
    ...subsets, ...subsets.map((subset) => [...subset].reverse()),
    ...image.flatMap((_, index) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => image.map((point, position) => (position === index ? at(point.x + dx!, point.y + dy!) : point)))),
    ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => image.map((point) => at(point.x + dx!, point.y + dy!))),
    ...rivalMoves(p.move).map((rival) => figureImage(rival, figure)).filter((list): list is Pt[] => list !== null),
    ...Array.from({ length: 2 ** width }, (_, mask) => figure.map((point, index) => ((mask >> index) & 1 ? image[index]! : point))),
    ...subsets.filter((subset) => subset.length < width).map((subset) => [...subset, universe[rand(universe.length)]!]),
  ];
  for (let draw = 0; draw < 250; draw += 1) states.push(Array.from({ length: 1 + rand(width) }, () => universe[rand(universe.length)]!));
  const legal = (list: Pt[]): boolean => list.length >= 1 && list.length <= width && keysOf(list).size === list.length && inFrame(list) && !sameAs(wrap(list), figure);
  return {
    inRange: unique(states.filter(legal).map(wrap)),
    invalid: [
      ...malformed(image[0]!, at(extent + 1, 0)), wrap([at(0, -extent - 1)]), wrap([]),
      wrap([...image, universe.find((point) => !keysOf(image).has(key(point)))!]),
    ],
    initial: wrap(figure),
    expectMet: (response) => sameAs(response, image),
  };
};

const sign = (value: number): number => Math.sign(value);
const turn = (a: Pt, b: Pt, c: Pt): number => sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const between = (a: Pt, b: Pt, c: Pt): boolean => turn(a, b, c) === 0 && Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
const meets = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0) || between(a, b, c) || between(a, b, d) || between(c, d, a) || between(c, d, b);

function twiceArea(poly: Pt[]): number {
  return Math.abs(poly.reduce((sum, point, index) => { const next = poly[(index + 1) % poly.length]!; return sum + point.x * next.y - next.x * point.y; }, 0));
}

function isSimple(poly: Pt[]): boolean {
  const count = poly.length;
  if (count < 3 || keysOf(poly).size !== count || twiceArea(poly) === 0) return false;
  for (let first = 0; first < count; first += 1) {
    for (let second = first + 1; second < count; second += 1) {
      const a = poly[first]!; const b = poly[(first + 1) % count]!; const c = poly[second]!; const d = poly[(second + 1) % count]!;
      if (second === first + 1) { if (between(b, c, a) || between(a, b, d)) return false; }
      else if (first === 0 && second === count - 1) { if (between(c, d, b) || between(a, b, c)) return false; }
      else if (meets(a, b, c, d)) return false;
    }
  }
  return true;
}

const corners = (poly: Pt[]): Pt[] => poly.filter((point, index) => turn(poly[(index + poly.length - 1) % poly.length]!, point, poly[(index + 1) % poly.length]!) !== 0);
const squareLength = (a: Pt, b: Pt): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rightAt = (list: Pt[], index: number): boolean => {
  const previous = list[(index + list.length - 1) % list.length]!; const here = list[index]!; const next = list[(index + 1) % list.length]!;
  return (previous.x - here.x) * (next.x - here.x) + (previous.y - here.y) * (next.y - here.y) === 0;
};

function isShape(poly: Pt[], shape: string): boolean {
  const list = corners(poly);
  if (shape === 'triangle') return list.length === 3;
  if (shape === 'right-triangle') return list.length === 3 && list.some((_, index) => rightAt(list, index));
  if (list.length !== 4 || !['parallelogram', 'rectangle', 'square'].includes(shape)) return false;
  const [a, b, c, d] = list as [Pt, Pt, Pt, Pt];
  const parallelogram = b.x - a.x === c.x - d.x && b.y - a.y === c.y - d.y;
  if (shape === 'parallelogram') return parallelogram;
  if (!parallelogram || !rightAt(list, 0)) return false;
  return shape === 'rectangle' || squareLength(a, b) === squareLength(b, c);
}

const geoboard: HzBuilder = (p, r) => {
  const size = p.size as number;
  const top = size - 1;
  const pegs = gridOf(size, size);
  const rand = lcg(size * 97 + 13);
  const met = (poly: Pt[]): boolean => twiceArea(poly) === r.area2 && (r.shape === undefined || isShape(poly, r.shape));
  const triples: Pt[][] = [];
  for (let i = 0; i < pegs.length; i += 1) for (let j = i + 1; j < pegs.length; j += 1) for (let k = j + 1; k < pegs.length; k += 1) {
    if (turn(pegs[i]!, pegs[j]!, pegs[k]!) !== 0) triples.push([pegs[i]!, pegs[j]!, pegs[k]!]);
  }
  const rects: Pt[][] = [];
  for (let x0 = 0; x0 <= top; x0 += 1) for (let x1 = x0 + 1; x1 <= top; x1 += 1) for (let y0 = 0; y0 <= top; y0 += 1) for (let y1 = y0 + 1; y1 <= top; y1 += 1) {
    rects.push([at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)]);
  }
  const slanted: Pt[][] = [];
  for (let ox = 0; ox <= top; ox += 1) for (let oy = 0; oy <= top; oy += 1) for (let a = 1; a <= top; a += 1) for (let b = 1; b <= top; b += 1) for (let skew = -top; skew <= top; skew += 1) {
    if (skew === 0) continue;
    const poly = [at(ox, oy), at(ox + a, oy), at(ox + a + skew, oy + b), at(ox + skew, oy + b)];
    if (poly.every((point) => point.x >= 0 && point.x <= top && point.y >= 0 && point.y <= top) && isSimple(poly)) slanted.push(poly);
  }
  const random = (count: number, wanted: number): Pt[][] => {
    const found: Pt[][] = [];
    for (let draw = 0; draw < wanted * 40 && found.length < wanted; draw += 1) {
      const chosen: Pt[] = [];
      while (chosen.length < count) { const peg = pegs[rand(pegs.length)]!; if (!keysOf(chosen).has(key(peg))) chosen.push(peg); }
      if (isSimple(chosen)) found.push(chosen);
    }
    return found;
  };
  const withMidpegs = even(rects, 100).map((poly) => poly.flatMap((point, index) => {
    const next = poly[(index + 1) % 4]!;
    const mid = at((point.x + next.x) / 2, (point.y + next.y) / 2);
    return Number.isInteger(mid.x) && Number.isInteger(mid.y) && index % 2 === 0 ? [point, mid] : [point];
  }));
  const everything = [...triples, ...rects, ...slanted];
  const polygons: Pt[][] = [
    ...even(triples, 900), ...even(triples, 150).map((poly) => [...poly].reverse()),
    ...even(rects, 400), ...withMidpegs, ...even(slanted, 300),
    ...random(4, 450), ...random(5, 150), ...random(6, 150),
    ...even(everything.filter(met), 100),
  ];
  return {
    inRange: unique(polygons.filter(isSimple).map(wrap)),
    invalid: [
      wrap([at(0, 0), at(1, 0)]), wrap([at(0, 0), at(1, 0), at(2, 0)]), wrap([at(0, 0), at(2, 2), at(2, 0), at(0, 2)]),
      wrap([at(0, 0), at(2, 0), at(2, 2), at(1, 0)]), wrap([at(0, 0), at(1, 0), at(size, 1)]), wrap([at(0, 0), at(1, 0), at(-1, 1)]),
      wrap([at(0, 0), at(1, 0), at(1, 0), at(0, 1)]),
      { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] },
      { points: [{ x: '0', y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
      { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], extra: 1 },
      {}, { points: null }, { points: 'none' }, { points: [null] },
    ],
    initial: wrap([]),
    expectMet: (response) => { const got = readPoints(response); return got !== null && isSimple(got) && met(got); },
  };
};

const tessellation: HzBuilder = (p) => {
  const floor = p.floor as Pt[];
  const tile = p.tile as Pt[];
  const open = keysOf(floor);
  const cellsOf = (anchor: Pt): string[] => tile.map((cell) => key(at(cell.x + anchor.x, cell.y + anchor.y)));
  const fits = (anchor: Pt): boolean => cellsOf(anchor).every((cell) => open.has(cell));
  const anchors = unique(floor.flatMap((cell) => tile.map((part) => at(cell.x - part.x, cell.y - part.y)))).filter(fits);
  const covering = new Map<string, Pt[]>();
  for (const anchor of anchors) for (const cell of cellsOf(anchor)) covering.set(cell, [...(covering.get(cell) ?? []), anchor]);
  const clash = (a: Pt, b: Pt): boolean => { const mine = new Set(cellsOf(a)); return cellsOf(b).some((cell) => mine.has(cell)); };
  const sorted = [...floor].sort((a, b) => a.x - b.x || a.y - b.y).map(key);

  const covers: Pt[][] = [];
  let budget = 200_000;
  const search = (free: Set<string>, chosen: Pt[]): void => {
    if (covers.length >= 60 || budget <= 0) return;
    budget -= 1;
    const next = sorted.find((cell) => free.has(cell));
    if (next === undefined) { covers.push([...chosen]); return; }
    for (const anchor of covering.get(next) ?? []) {
      const cells = cellsOf(anchor);
      if (!cells.every((cell) => free.has(cell))) continue;
      const rest = new Set(free);
      cells.forEach((cell) => rest.delete(cell));
      search(rest, [...chosen, anchor]);
    }
  };
  search(new Set(sorted), []);

  const rand = lcg(floor.length * 7 + tile.length);
  const packings: Pt[][] = [];
  for (let draw = 0; draw < 150; draw += 1) {
    const order = [...anchors];
    for (let index = order.length - 1; index > 0; index -= 1) { const swap = rand(index + 1); [order[index], order[swap]] = [order[swap]!, order[index]!]; }
    const packed: Pt[] = [];
    const halves: Pt[][] = [];
    for (const anchor of order) if (packed.every((other) => !clash(anchor, other))) { packed.push(anchor); if (packed.length === Math.ceil(floor.length / tile.length / 2)) halves.push([...packed]); }
    packings.push(packed, ...halves);
  }
  const pairs: Pt[][] = [];
  for (let i = 0; i < anchors.length; i += 1) for (let j = i + 1; j < anchors.length; j += 1) if (!clash(anchors[i]!, anchors[j]!)) pairs.push([anchors[i]!, anchors[j]!]);

  const states: Pt[][] = [
    ...anchors.map((anchor) => [anchor]), ...even(pairs, 400),
    ...covers, ...covers.map((cover) => [...cover].reverse()),
    ...covers.slice(0, 6).flatMap((cover) => cover.slice(1).map((_, index) => cover.slice(0, index + 1))),
    ...covers.slice(0, 10).flatMap((cover) => cover.map((_, index) => cover.filter((__, position) => position !== index))),
    ...packings,
  ];
  const frameX = Math.max(1, ...floor.map((cell) => cell.x));
  const frameY = Math.max(1, ...floor.map((cell) => cell.y));
  const spill = [];
  for (let x = 0; x <= frameX; x += 1) for (let y = 0; y <= frameY; y += 1) if (!fits(at(x, y))) spill.push(at(x, y));
  const overlap = anchors.flatMap((a) => anchors.filter((b) => key(a) !== key(b) && clash(a, b)).map((b) => [a, b])).slice(0, 1);
  const copies = floor.length / tile.length;
  return {
    inRange: unique(states.filter((list) => list.length > 0 && list.length <= copies).map(wrap)),
    invalid: [
      ...malformed(anchors[0]!, at(frameX + 1, 0)), wrap([at(-1, 0)]),
      ...spill.slice(0, 1).map((anchor) => wrap([anchor])), ...overlap.map(wrap),
      ...(covers[0] ? [wrap([...covers[0], anchors.find((anchor) => !keysOf(covers[0]!).has(key(anchor))) ?? at(frameX + 1, frameY + 1)])] : []),
    ],
    initial: wrap([]),
    expectMet: (response) => {
      const got = readPoints(response);
      if (!got) return false;
      const used = new Set<string>();
      for (const anchor of got) for (const cell of cellsOf(anchor)) { if (!open.has(cell) || used.has(cell)) return false; used.add(cell); }
      return used.size === floor.length;
    },
  };
};

export const GEOM2_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.area-squares.v2': area,
  'math.geoboard.v2': geoboard,
  'math.tessellation.v2': tessellation,
  'math.transform.v2': transform,
};
