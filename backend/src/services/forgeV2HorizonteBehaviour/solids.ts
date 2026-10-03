import { arrangement, nextOf, shuffle, type Frame, type Next, type Slots } from './arrange.js';
import { eq, fromDecimal, q, type Q } from './rational.js';
import { even, range, unique, type HzBuilder, type Json } from './shared.js';
import { cubeNetArea, SOLIDNET_BEHAVIOUR } from './solidnets.js';

type Cell = readonly [number, number];

/* ── geometry.solid-viewer.v2 ── */

const FACTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  cube: { faces: 6, edges: 12, vertices: 8 },
  prism: { faces: 5, edges: 9, vertices: 6 },
  pyramid: { faces: 5, edges: 8, vertices: 5 },
  cylinder: { faces: 3, edges: 2, vertices: 0 },
};

const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;

function readCount(text: unknown): Q | null {
  if (typeof text !== 'string') return null;
  const plain = fromDecimal(text);
  if (plain) return plain;
  if (text.length > 32 || !FRACTION.test(text)) return null;
  const [top, bottom] = text.split('/');
  return q(BigInt(top!), BigInt(bottom!));
}

const viewer: HzBuilder = (p) => {
  const listed = p.solids as string[];
  const found = listed.filter((name) => FACTS[name]?.[p.find.kind] === p.find.count);
  const report = FACTS[found[0] ?? '']?.[p.report];
  if (found.length !== 1 || p.report === p.find.kind || report === undefined) return null;
  const solid = found[0]!;
  const counts = unique([
    ...range(0, 12).map(String), `${report}.0`, `${report}.00`, `${report * 2}/2`, `${report * 3}/3`, '0.5', '2.5', '11.999', '1/2', '7/3', '0/5', '-0', '-0.0', '12.000000000000',
  ]);
  const right = (response: Json): { solid: boolean; count: boolean } => {
    const value = readCount(response.count);
    return { solid: response.solid === solid, count: value !== null && eq(value, q(report)) };
  };
  const wrong = ['13', '-1', '12.0001', '25/2', 'abc', '1e1', ' 6', '6 ', '6,5', '.5', '5.', '01', '1/0', '0x6', '6.0000000000000', '1/-2', '+6', '6%'];
  const unlisted = Object.keys(FACTS).filter((name) => !listed.includes(name));
  return {
    inRange: listed.flatMap((name) => counts.map((count) => ({ solid: name, count }))),
    invalid: [
      ...wrong.map((count) => ({ solid, count })),
      ...[...unlisted, 'sphere', 'Cube', ` ${solid}`, `${solid} `, 'cone'].map((name) => ({ solid: name, count: String(report) })),
      { solid: '', count: '' }, { solid: '', count: String(report) }, { solid, count: '' },
      { solid, count: report }, { solid: 1, count: String(report) }, { solid: null, count: String(report) }, { solid, count: null }, { solid }, { count: String(report) },
      { solid, count: String(report), extra: 1 }, {}, null, [], 'x',
    ],
    initial: { solid: '', count: '' },
    expectMet: (response) => { const hit = right(response); return hit.solid && hit.count; },
    expectDiagnostic: (response) => { const hit = right(response); return hit.solid && hit.count ? null : hit.solid || hit.count ? 'partial' : 'value'; },
  };
};

/* ── geometry.cube-net.v2 ── */

type Cube<T> = readonly [T, T, T, T, T, T];
type Way = 'east' | 'west' | 'north' | 'south';

/** A cube is [down, up, north, south, east, west]; rolling it one square over the net moves the face under it. */
const ROLL: Readonly<Record<Way, readonly number[]>> = { east: [4, 5, 2, 3, 1, 0], west: [5, 4, 2, 3, 0, 1], north: [2, 3, 1, 0, 4, 5], south: [3, 2, 0, 1, 4, 5] };
const roll = <T,>(cube: Cube<T>, way: Way): Cube<T> => ROLL[way].map((index) => cube[index]!) as unknown as Cube<T>;
/** The net is printed outside the cube, so going right on the paper is rolling west. */
const STEPS: ReadonlyArray<readonly [number, number, Way]> = [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'south'], [0, -1, 'north']];

function underside<T>(cells: readonly Cell[], start: Cube<T>): T[] | null {
  const at = new Map(cells.map((cell, index) => [`${cell[0]},${cell[1]}`, index] as const));
  const cubes = new Map<number, Cube<T>>([[0, start]]);
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const [col, row] = cells[index]!;
    for (const [dc, dr, way] of STEPS) {
      const next = at.get(`${col + dc},${row + dr}`);
      if (next === undefined || cubes.has(next)) continue;
      cubes.set(next, roll(cubes.get(index)!, way));
      queue.push(next);
    }
  }
  return cubes.size === cells.length ? cells.map((_, index) => cubes.get(index)![0]) : null;
}

const cubeNet = (cells: readonly Cell[]): boolean => {
  if (cells.length !== 6) return false;
  const faces = underside(cells, [0, 1, 2, 3, 4, 5]);
  return faces !== null && new Set(faces).size === 6;
};

const FACES = ['top', 'bottom', 'front', 'back', 'left', 'right'];
const ORIENTATIONS: Array<Cube<string>> = (() => {
  const seen = new Map<string, Cube<string>>();
  const queue: Array<Cube<string>> = [['bottom', 'top', 'back', 'front', 'right', 'left']];
  for (let head = 0; head < queue.length; head += 1) {
    const cube = queue[head]!;
    if (seen.has(cube.join())) continue;
    seen.set(cube.join(), cube);
    for (const way of Object.keys(ROLL) as Way[]) queue.push(roll(cube, way));
  }
  return [...seen.values()];
})();

const labellings = (cells: readonly Cell[]): string[][] => ORIENTATIONS.map((start) => underside(cells, start)).filter((names): names is string[] => names !== null);

function choose<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const pick = (from: number, chosen: T[]): void => {
    if (chosen.length === size) { out.push(chosen); return; }
    for (let index = from; index < list.length; index += 1) pick(index + 1, [...chosen, list[index]!]);
  };
  pick(0, []);
  return out;
}

const squareAt = (col: number, row: number): string => `g${col}x${row}`;
const cellKey = (cell: Cell): string => `${cell[0]},${cell[1]}`;

function nameFaces(p: Json): ReturnType<HzBuilder> {
  const cells = p.cells as Cell[];
  const fixed = p.fixed as Array<{ cell: number; name: string }>;
  const answers = labellings(cells).filter((names) => fixed.every(({ cell, name }) => names[cell] === name));
  if (answers.length === 0) return null;
  const slotOf = (index: number): string => `cell${index}`;
  const frame: Frame = { pieces: FACES, slots: cells.map((_, index) => slotOf(index)), capacity: () => 1 };
  const free = cells.map((_, index) => index).filter((index) => !fixed.some((entry) => entry.cell === index));
  const spare = FACES.filter((name) => !fixed.some((entry) => entry.name === name));
  const given: Slots = Object.fromEntries(fixed.map(({ cell, name }) => [slotOf(cell), [name]]));
  const states: Slots[] = [];
  const assign = (position: number, used: string[], chosen: Array<readonly [number, string]>): void => {
    if (position === free.length) {
      if (chosen.length > 0) states.push({ ...given, ...Object.fromEntries(chosen.map(([index, name]) => [slotOf(index), [name]])) });
      return;
    }
    assign(position + 1, used, chosen);
    for (const name of spare) if (!used.includes(name)) assign(position + 1, [...used, name], [...chosen, [free[position]!, name]]);
  };
  assign(0, [], []);
  const nameAt = (slots: Slots, index: number): string | null => (slots[slotOf(index)]?.length === 1 ? slots[slotOf(index)]![0]! : null);
  const whole = answers[0]!;
  const full: Slots = Object.fromEntries(whole.map((name, index) => [slotOf(index), [name]]));
  const moved: unknown[] = fixed.flatMap(({ cell, name }) => [
    { slots: Object.fromEntries(Object.entries(full).filter(([slot]) => slot !== slotOf(cell))) },
    { slots: { ...given, [slotOf(cell)]: [spare[0]!], [slotOf(free[0]!)]: [name] } },
  ]);
  const swapped: unknown[] = fixed.length > 1 ? [{ slots: { ...given, [slotOf(fixed[0]!.cell)]: [fixed[1]!.name], [slotOf(fixed[1]!.cell)]: [fixed[0]!.name], [slotOf(free[0]!)]: [spare[0]!] } }] : [];
  const space = arrangement(
    frame, full, [...states, full],
    (slots) => free.every((index) => nameAt(slots, index) !== null) && answers.some((names) => free.every((index) => names[index] === nameAt(slots, index))),
    [...moved, ...swapped, { slots: given }], { slots: given },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const slots = response.slots as Slots;
      const placed = free.filter((index) => nameAt(slots, index) !== null);
      const best = Math.max(...answers.map((names) => placed.filter((index) => names[index] === nameAt(slots, index)).length));
      if (placed.length === free.length && best === free.length) return null;
      return best === placed.length ? 'miss' : best > 0 ? 'partial' : 'value';
    },
  };
}

const slotCells = (slots: Slots): Cell[] => Object.entries(slots).filter(([, pieces]) => pieces.length > 0).map(([slot]) => {
  const match = /^g(\d)x(\d)$/.exec(slot);
  return [Number(match![1]), Number(match![2])] as const;
});

function completeNet(p: Json): ReturnType<HzBuilder> {
  const grid = p.grid as { cols: number; rows: number };
  const fixed = p.fixed as Cell[];
  const all: Cell[] = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) all.push([col, row]);
  const held = new Set(fixed.map(cellKey));
  const free = all.filter((cell) => !held.has(cellKey(cell)));
  const add = 6 - fixed.length;
  const sixes = choose(free, add).map((chosen) => [...fixed, ...chosen]);
  const nets = sixes.filter(cubeNet);
  const covered = (cells: readonly Cell[]): boolean => nets.some((net) => { const keys = new Set(net.map(cellKey)); return cells.every((cell) => keys.has(cellKey(cell))); });
  const slotsOf = (cells: readonly Cell[]): Slots => Object.fromEntries(cells.map((cell) => [squareAt(cell[0], cell[1]), ['square']]));
  const next = nextOf(41);
  const partial = Array.from({ length: add - 1 }, (_, index) => choose(free, index + 1).map((chosen) => [...fixed, ...chosen])).flat();
  const over = Array.from({ length: 500 }, () => [...fixed, ...shuffle(free, next).slice(0, add + 1 + next(Math.max(1, free.length - add)))]);
  const pool = [
    ...even(nets, 400), ...even(sixes.filter((cells) => !cubeNet(cells)), 800), ...even(partial, 700), ...even(over, 500),
  ].map(slotsOf);
  const frame: Frame = { pieces: ['square'], slots: all.map((cell) => squareAt(cell[0], cell[1])), capacity: () => 1, repeatable: true };
  const start = slotsOf(fixed);
  const base = nets[0] ?? sixes[0] ?? fixed;
  const space = arrangement(
    frame, slotsOf(base), pool, (slots) => { const cells = slotCells(slots); return cells.length === 6 && cubeNet(cells); },
    [
      ...fixed.map((gone) => ({ slots: slotsOf(base.filter((cell) => cellKey(cell) !== cellKey(gone))) })),
      { slots: start }, { slots: { ...start, [squareAt(grid.cols, 0)]: ['square'] } }, { slots: { ...start, [squareAt(0, grid.rows)]: ['square'] } },
      { slots: { ...start, [squareAt(free[0]![0], free[0]![1])]: ['square', 'square'] } }, { slots: { ...start, [squareAt(free[0]![0], free[0]![1])]: ['face'] } },
    ],
    { slots: start },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const cells = slotCells(response.slots as Slots);
      if (cells.length === 6) return cubeNet(cells) ? null : 'structure';
      if (cells.length > 6) return 'false_alarm';
      return covered(cells) ? 'miss' : 'value';
    },
  };
}

const net: HzBuilder = (p, r, segment) => (p.mode === 'label' ? nameFaces(p) : p.mode === 'complete' ? completeNet(p) : p.mode === 'area' ? cubeNetArea(p, r, segment) : null);

/* ── geometry.cube-stack.v2 ── */

type Heights = number[][];
const MOST = 3;
const stackSlot = (col: number, row: number): string => `c${col}r${row}`;
const gridOf = (flat: readonly number[], size: number): Heights => Array.from({ length: size }, (_, row) => flat.slice(row * size, row * size + size));
const stackSlots = (flat: readonly number[], size: number): Slots => Object.fromEntries(flat.flatMap((height, index) => (height > 0 ? [[stackSlot(index % size, Math.floor(index / size)), Array.from({ length: height }, () => 'cube')]] : [])));

function viewsOf(heights: Heights): Record<string, unknown> {
  return {
    front: heights[0]!.map((_, col) => Math.max(...heights.map((row) => row[col]!))),
    side: [...heights].reverse().map((row) => Math.max(...row)),
    plan: heights.map((row) => row.map((cell) => (cell > 0 ? 1 : 0))),
  };
}

const agrees = (heights: Heights, goal: Json, keys: readonly string[]): number => {
  const seen = viewsOf(heights);
  return keys.filter((key) => JSON.stringify(seen[key]) === JSON.stringify(goal[key])).length;
};

interface Matches { count: number; minimum: number | null; sample: number[][]; cheapest: number[][] }

function matching(goal: Json, keys: readonly string[], size: number, keep: number, next: Next): Matches {
  const reach = (index: number): [number, number] => {
    const row = Math.floor(index / size); const col = index % size;
    let high = MOST; let low = 0;
    if (keys.includes('front')) high = Math.min(high, goal.front[col]);
    if (keys.includes('side')) high = Math.min(high, goal.side[size - 1 - row]);
    if (keys.includes('plan')) { if (goal.plan[row][col] === 0) high = 0; else low = 1; }
    return [low, high];
  };
  const ranges = Array.from({ length: size * size }, (_, index) => reach(index));
  const found: Matches = { count: 0, minimum: null, sample: [], cheapest: [] };
  const flat = new Array<number>(size * size).fill(0);
  const visit = (index: number): void => {
    if (index === flat.length) {
      if (agrees(gridOf(flat, size), goal, keys) !== keys.length) return;
      const total = flat.reduce((sum, height) => sum + height, 0);
      found.count += 1;
      if (found.sample.length < keep) found.sample.push([...flat]);
      else { const slot = next(found.count); if (slot < keep) found.sample[slot] = [...flat]; }
      if (found.minimum === null || total < found.minimum) { found.minimum = total; found.cheapest = []; }
      if (total === found.minimum && found.cheapest.length < 60) found.cheapest.push([...flat]);
      return;
    }
    const [low, high] = ranges[index]!;
    for (let height = low; height <= high; height += 1) { flat[index] = height; visit(index + 1); }
    flat[index] = 0;
  };
  if (ranges.every(([low, high]) => low <= high)) visit(0);
  return found;
}

const stack: HzBuilder = (p) => {
  const size = p.size as number;
  const goal = p.goal as Json;
  const keys = ['front', 'side', 'plan'].filter((key) => goal[key] !== undefined);
  const next = nextOf(59);
  const exact = matching(goal, keys, size, 300, next);
  if (exact.count === 0 || exact.minimum === null) return null;
  const least = exact.minimum;
  const cells = size * size;
  const flatStart = (p.start as Heights).flat();
  const subsets = range(1, 2 ** keys.length - 1).map((mask) => keys.filter((_, index) => (mask >> index) & 1)).filter((subset) => subset.length < keys.length);
  const near = [...exact.sample.slice(0, 40), ...exact.cheapest].flatMap((flat) => flat.flatMap((height, index) => range(0, MOST).filter((value) => value !== height).map((value) => flat.map((was, at) => (at === index ? value : was)))));
  const partialMatches = unique(subsets).flatMap((subset) => matching(goal, subset, size, 60, next).sample);
  const random = Array.from({ length: 500 }, () => Array.from({ length: cells }, () => next(MOST + 1)));
  const everything = size === 2 ? range(0, 4 ** cells - 1).map((code) => Array.from({ length: cells }, (_, index) => Math.floor(code / 4 ** index) % 4)) : [];
  const flats = [...everything, ...exact.sample, ...exact.cheapest, ...near, ...partialMatches, ...random];
  const frame: Frame = { pieces: ['cube'], slots: Array.from({ length: cells }, (_, index) => stackSlot(index % size, Math.floor(index / size))), capacity: () => MOST, repeatable: true };
  const heightsOf = (slots: Slots): number[] => Array.from({ length: cells }, (_, index) => slots[stackSlot(index % size, Math.floor(index / size))]?.length ?? 0);
  const total = (flat: readonly number[]): number => flat.reduce((sum, height) => sum + height, 0);
  const space = arrangement(
    frame, stackSlots(exact.cheapest[0]!, size), flats.map((flat) => stackSlots(flat, size)),
    (slots) => { const flat = heightsOf(slots); return agrees(gridOf(flat, size), goal, keys) === keys.length && (!p.fewest || total(flat) === least); },
    [
      { slots: { [stackSlot(size, 0)]: ['cube'] } }, { slots: { [stackSlot(0, size)]: ['cube'] } }, { slots: { [stackSlot(0, 0)]: ['square'] } },
      { slots: { [stackSlot(0, 0)]: ['cube', 'cube', 'cube', 'cube'] } }, { slots: stackSlots(flatStart, size) },
    ],
    { slots: stackSlots(flatStart, size) },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const flat = heightsOf(response.slots as Slots);
      const hit = agrees(gridOf(flat, size), goal, keys);
      if (hit === keys.length) return p.fewest && total(flat) > least ? 'false_alarm' : null;
      return hit > 0 ? 'partial' : 'value';
    },
  };
};

export const SOLIDS_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'geometry.solid-viewer.v2': viewer,
  'geometry.cube-net.v2': net,
  'geometry.cube-stack.v2': stack,
  ...SOLIDNET_BEHAVIOUR,
};
