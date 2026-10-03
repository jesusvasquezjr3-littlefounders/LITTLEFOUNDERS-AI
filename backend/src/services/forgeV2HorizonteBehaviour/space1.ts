import { arrangement, fromKey, nextOf, type Slots } from './arrange.js';
import { add, eq, isZero, mul, q, sub, type Q } from './rational.js';
import { range, type HzBuilder, type HzSpace, type Json } from './shared.js';

const TEXT_MISUSE = (value: string): unknown[] => [
  { value }, { value: 3 }, { value: null }, {}, { value, extra: 1 }, null, [], 'x',
];

/* ── money.coin-stack.v2 ── */

const THICKNESS_TENTHS: Readonly<Record<string, number>> = { coin: 20, bill: 1 };

const coins: HzBuilder = (p) => {
  const thickness = THICKNESS_TENTHS[p.piece];
  if (thickness === undefined) return null;
  const goal = p.goal as Json;
  const answer = goal.kind === 'amount'
    ? (goal.total % p.value === 0 ? goal.total / p.value : null)
    : ((goal.mm * 10) % thickness === 0 ? (goal.mm * 10) / thickness : null);
  if (answer === null) return null;
  const crowded = p.max + p.step;
  return {
    inRange: range(p.step, p.max, p.step).map((count) => ({ value: String(count) })),
    invalid: [
      { value: '' }, { value: '0' }, { value: String(crowded) }, { value: String(p.max + 1) }, ...(p.step > 1 ? [{ value: String(p.step + 1) }] : []),
      { value: '00' }, { value: '01' }, { value: '1.5' }, { value: '-1' }, { value: ' 3' }, { value: '3 ' }, { value: 'abc' }, { value: '1e1' }, { value: '+1' }, { value: '1,0' }, { value: '1'.repeat(7) },
      ...TEXT_MISUSE('1').slice(1),
    ],
    initial: { value: '' },
    expectMet: (response) => Number(response.value) === answer,
    expectDiagnostic: (response) => (Number(response.value) < answer ? 'miss' : 'false_alarm'),
  };
};

/* ── geometry.mental-rotation.v2 ── */

type Cell3 = [number, number, number];

/** Quarter turns about the centre of the 3 by 3 by 3 box, clockwise seen from above (up), from the right (side) and from the front (depth). */
const TURNS: Readonly<Record<string, (cell: Cell3) => Cell3>> = {
  up: ([a, b, c]) => [-c, b, a],
  side: ([a, b, c]) => [a, c, -b],
  depth: ([a, b, c]) => [b, -a, c],
};

const turned = (figure: readonly Cell3[], axis: string, quarters: number): Cell3[] => {
  let cells = figure.map(([x, y, z]): Cell3 => [x - 1, y - 1, z - 1]);
  for (let step = 0; step < quarters; step += 1) cells = cells.map(TURNS[axis]!);
  return cells.map(([a, b, c]): Cell3 => [a + 1, b + 1, c + 1]);
};

const shapeOf = (cells: readonly Cell3[]): string => {
  const low = [0, 1, 2].map((axis) => Math.min(...cells.map((cell) => cell[axis]!)));
  return cells.map((cell) => cell.map((part, axis) => part - low[axis]!).join(',')).sort().join('|');
};

const IDS = ['a', 'b', 'c'];

const rotation: HzBuilder = (p) => {
  const figure = p.figure as Cell3[];
  const targets = p.targets as Cell3[][];
  if (!(p.axis in TURNS)) return null;
  const matches = targets.flatMap((target, index) => {
    const angles = [90, 180, 270].filter((angle) => shapeOf(turned(figure, p.axis, angle / 90)) === shapeOf(target));
    return angles.length > 0 ? [{ pick: IDS[index]!, angles }] : [];
  });
  if (matches.length !== 1) return null;
  const answer = matches[0]!;
  const picks = IDS.slice(0, targets.length);
  const stray = targets.length < IDS.length ? IDS[targets.length]! : 'd';
  return {
    inRange: picks.flatMap((pick) => [90, 180, 270].map((angle) => ({ pick, angle }))),
    invalid: [
      { pick: '', angle: 90 }, { pick: 'a', angle: 0 }, { pick: '', angle: 0 }, { pick: stray, angle: 90 }, { pick: 'A', angle: 90 }, { pick: 'a', angle: 45 }, { pick: 'a', angle: 360 },
      { pick: 'a', angle: -90 }, { pick: 'a', angle: '90' }, { pick: 'a', angle: null }, { pick: 1, angle: 90 }, { pick: null, angle: 90 }, { pick: 'a' }, { angle: 90 },
      { pick: 'a', angle: 90, extra: 1 }, {}, null, [], 'x',
    ],
    initial: { pick: '', angle: 0 },
    expectMet: (response) => response.pick === answer.pick && answer.angles.includes(response.angle),
    expectDiagnostic: (response) => {
      if (response.pick !== answer.pick) return 'value';
      if (answer.angles.includes(response.angle)) return null;
      return targets.length > 1 ? 'partial' : 'value';
    },
  };
};

/* ── geometry.solid-section.v2 ── */

const SOLIDS: Readonly<Record<string, { vertices: number[][]; edge: (a: number[], b: number[]) => boolean }>> = {
  cube: { vertices: range(0, 7).map((index) => [index & 1 ? 1 : -1, index & 2 ? 1 : -1, index & 4 ? 1 : -1]), edge: (a, b) => a.filter((part, axis) => part !== b[axis]).length === 1 },
  tetrahedron: { vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], edge: () => true },
  octahedron: { vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], edge: (a, b) => a.reduce((sum, part, axis) => sum + part * b[axis]!, 0) === 0 },
};

type Point = [Q, Q, Q];
const minus = (a: Point, b: Point): Point => [sub(a[0], b[0]), sub(a[1], b[1]), sub(a[2], b[2])];
const times = (a: Point, b: Point): Point => [sub(mul(a[1], b[2]), mul(a[2], b[1])), sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
const inner = (a: Point, b: Point): Q => add(add(mul(a[0], b[0]), mul(a[1], b[1])), mul(a[2], b[2]));
const flat = (a: Point): boolean => a.every(isZero);
const asFloat = (value: Q): number => Number(value.n) / Number(value.d);

/** The shape the plane 4 n.p = offset cuts from a solid, by exact arithmetic on the edges it crosses; null when it only touches or misses. */
function cutShape(solid: string, normal: number[], offset: number): string | null {
  const body = SOLIDS[solid];
  if (!body) return null;
  const side = body.vertices.map((vertex) => 4 * vertex.reduce((sum, part, axis) => sum + part * normal[axis]!, 0) - offset);
  if (!side.some((distance) => distance > 0) || !side.some((distance) => distance < 0)) return null;
  const spot = (vertex: number[]): Point => vertex.map((part) => q(part)) as Point;
  const points: Point[] = [];
  const keep = (point: Point): void => { if (!points.some((other) => flat(minus(point, other)))) points.push(point); };
  side.forEach((distance, index) => { if (distance === 0) keep(spot(body.vertices[index]!)); });
  for (let first = 0; first < body.vertices.length; first += 1) for (let second = first + 1; second < body.vertices.length; second += 1) {
    if (!body.edge(body.vertices[first]!, body.vertices[second]!) || side[first]! * side[second]! >= 0) continue;
    const from = spot(body.vertices[first]!); const to = spot(body.vertices[second]!);
    const along = q(side[first]!, side[first]! - side[second]!);
    const step = minus(to, from);
    keep([add(from[0], mul(step[0], along)), add(from[1], mul(step[1], along)), add(from[2], mul(step[2], along))]);
  }
  if (points.length < 3) return null;
  const floats = points.map((point) => point.map(asFloat));
  const centre = [0, 1, 2].map((axis) => floats.reduce((sum, point) => sum + point[axis]!, 0) / floats.length);
  const length = Math.hypot(...normal);
  const axis = normal.map((part) => part / length);
  const helper = Math.abs(axis[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (a: number[], b: number[]): number[] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const e1 = cross(axis, helper); const size = Math.hypot(...e1);
  const first = e1.map((part) => part / size); const second = cross(axis, first);
  const dot = (a: number[], b: number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const angle = (index: number): number => { const offsetFromCentre = floats[index]!.map((part, at) => part - centre[at]!); return Math.atan2(dot(offsetFromCentre, second), dot(offsetFromCentre, first)); };
  const order = points.map((_, index) => index).sort((a, b) => angle(a) - angle(b));
  const ring = order.map((index) => points[index]!);
  const corners = ring.filter((point, index) => !flat(times(minus(point, ring[(index + ring.length - 1) % ring.length]!), minus(ring[(index + 1) % ring.length]!, point))));
  if (corners.length < 3) return null;
  if (corners.length === 3) return 'triangle';
  if (corners.length === 5) return 'pentagon';
  if (corners.length === 6) return 'hexagon';
  if (corners.length !== 4) return 'polygon';
  const edges = corners.map((corner, index) => minus(corners[(index + 1) % 4]!, corner));
  const squared = edges.map((edge) => inner(edge, edge));
  const parallel = [flat(times(edges[0]!, edges[2]!)), flat(times(edges[1]!, edges[3]!))];
  const right = isZero(inner(edges[0]!, edges[1]!));
  const equal = eq(squared[0]!, squared[1]!) && eq(squared[1]!, squared[2]!) && eq(squared[2]!, squared[3]!);
  if (parallel[0] && parallel[1]) return right ? (equal ? 'square' : 'rectangle') : equal ? 'rhombus' : 'parallelogram';
  return parallel[0] || parallel[1] ? 'trapezoid' : 'quadrilateral';
}

const SHAPES = ['triangle', 'square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'quadrilateral', 'pentagon', 'hexagon', 'polygon'];

const COUNTS: Readonly<Record<string, { vertices: number; edges: number; faces: number }>> = {
  tetrahedron: { vertices: 4, edges: 6, faces: 4 },
  cube: { vertices: 8, edges: 12, faces: 6 },
  octahedron: { vertices: 6, edges: 12, faces: 8 },
  dodecahedron: { vertices: 20, edges: 30, faces: 12 },
  icosahedron: { vertices: 12, edges: 30, faces: 20 },
};

function typed(answer: number, top: number, structure: number | null): HzSpace {
  const texts = range(0, top).map(String);
  return {
    inRange: texts.map((value) => ({ value })),
    invalid: [
      { value: '' }, { value: String(top + 1) }, { value: '-1' }, { value: '01' }, { value: '1.5' }, { value: ' 5' }, { value: '5 ' }, { value: 'abc' }, { value: '1e2' }, { value: '12345' }, { value: '1/2' },
      ...TEXT_MISUSE('5').slice(1),
    ],
    initial: { value: '' },
    expectMet: (response) => response.value === String(answer),
    expectDiagnostic: (response) => (response.value === String(answer) ? null : structure !== null && response.value === String(structure) ? 'structure' : 'value'),
  };
}

const section: HzBuilder = (p) => {
  if (p.mode === 'section') {
    const shape = cutShape(p.solid, p.plane.normal, p.plane.offset);
    if (shape === null) return null;
    const options = p.options as string[];
    return {
      inRange: options.map((pick) => ({ pick })),
      invalid: [
        { pick: '' }, ...SHAPES.filter((name) => !options.includes(name)).slice(0, 3).map((pick) => ({ pick })), { pick: 'Triangle' }, { pick: ` ${options[0]}` },
        { pick: 3 }, { pick: null }, {}, { pick: options[0], extra: 1 }, { value: options[0] }, null, [], 'x',
      ],
      initial: { pick: '' },
      expectMet: (response) => response.pick === shape,
      expectDiagnostic: (response) => (response.pick === shape ? null : 'value'),
    };
  }
  if (p.mode === 'euler') {
    const counts = COUNTS[p.solid];
    if (!counts || counts.vertices - counts.edges + counts.faces !== 2 || !(p.hide in counts)) return null;
    return typed(counts[p.hide as 'vertices' | 'edges' | 'faces'], 30, null);
  }
  if (p.mode === 'volume') {
    const prism = p.side * p.side * p.height;
    if (prism % 3 !== 0) return null;
    return typed(prism / 3, 1728, prism);
  }
  return null;
};

/* ── money.market-stall.v2 ── */

interface Item { id: string; price: number; stock: number }

const stall: HzBuilder = (p, r) => {
  const items = p.items as Item[];
  const goal = p.goal as Json;
  const total = goal.kind === 'exact' ? goal.total : goal.kind === 'change' ? goal.paid - goal.change : null;
  if (total === null && goal.kind !== 'most') return null;
  const units = items.flatMap((item) => Array.from({ length: item.stock }, () => item.price)).sort((a, b) => a - b);
  let most = 0;
  if (goal.kind === 'most') for (let spent = 0; most < units.length && spent + units[most]! <= goal.budget; most += 1) spent += units[most]!;
  const cost = (counts: readonly number[]): number => counts.reduce((sum, count, index) => sum + count * items[index]!.price, 0);
  const size = (counts: readonly number[]): number => counts.reduce((sum, count) => sum + count, 0);
  const meets = (counts: readonly number[]): boolean => size(counts) > 0 && (total !== null ? cost(counts) === total : cost(counts) <= goal.budget && size(counts) === most);
  const slotsOf = (counts: readonly number[]): Slots => Object.fromEntries(items.flatMap((item, index) => (counts[index]! > 0 ? [[item.id, Array.from({ length: counts[index]! }, () => 'item')]] : [])));
  const countsOf = (slots: Slots): number[] => items.map((item) => slots[item.id]?.length ?? 0);
  const next = nextOf(83);
  const cheapest = Math.min(...items.map((item) => item.price));
  const target = total ?? goal.budget;
  const lists: Record<'met' | 'near' | 'any', number[][]> = { met: [], near: [], any: [] };
  const seen = { met: 0, near: 0, any: 0 };
  const keepers = { met: 150, near: 200, any: 600 };
  const offer = (bucket: 'met' | 'near' | 'any', counts: number[]): void => {
    seen[bucket] += 1;
    if (lists[bucket].length < keepers[bucket]) lists[bucket].push([...counts]);
    else { const slot = next(seen[bucket]); if (slot < keepers[bucket]) lists[bucket][slot] = [...counts]; }
  };
  const counts = new Array<number>(items.length).fill(0);
  const visit = (index: number): void => {
    if (index === items.length) {
      if (size(counts) === 0) return;
      offer('any', counts);
      if (meets(counts)) offer('met', counts);
      else if (Math.abs(cost(counts) - target) <= cheapest) offer('near', counts);
      return;
    }
    for (let count = 0; count <= items[index]!.stock; count += 1) { counts[index] = count; visit(index + 1); }
    counts[index] = 0;
  };
  visit(0);
  const singles = items.flatMap((item, index) => range(1, item.stock).map((count) => items.map((_, at) => (at === index ? count : 0))));
  const stocked = items.map((item) => item.stock);
  const cheapestFirst = (() => {
    const order = items.map((_, index) => index).sort((a, b) => items[a]!.price - items[b]!.price);
    const basket = new Array<number>(items.length).fill(0);
    let left = most;
    for (const index of order) { basket[index] = Math.min(items[index]!.stock, left); left -= basket[index]!; }
    return basket;
  })();
  const states = [...lists.met, ...lists.near, ...lists.any, ...singles, stocked, items.map(() => 1), cheapestFirst].map(slotsOf);
  const first = items[0]!;
  const frame = { pieces: ['item'], slots: items.map((item) => item.id), capacity: (slot: string) => items.find((item) => item.id === slot)!.stock, repeatable: true };
  const space = arrangement(
    frame, slotsOf(lists.met[0] ?? stocked), [...states, ...fromKey(r)], (slots) => meets(countsOf(slots)),
    [{ slots: { [first.id]: ['coin'] } }, { slots: { [first.id]: Array.from({ length: first.stock + 1 }, () => 'item') } }, { slots: {} }],
    { slots: {} },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const held = countsOf(response.slots as Slots);
      if (meets(held)) return null;
      if (total !== null) return cost(held) < total ? 'miss' : 'false_alarm';
      return cost(held) > goal.budget ? 'false_alarm' : size(held) < most ? 'miss' : 'value';
    },
  };
};

export const SPACE1_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'money.coin-stack.v2': coins,
  'geometry.mental-rotation.v2': rotation,
  'geometry.solid-section.v2': section,
  'money.market-stall.v2': stall,
};
