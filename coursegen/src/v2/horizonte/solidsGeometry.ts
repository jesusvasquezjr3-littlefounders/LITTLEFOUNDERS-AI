export const SOLID_IDS = ['cube', 'prism', 'pyramid', 'cylinder'] as const;
export type SolidId = (typeof SOLID_IDS)[number];
export const COUNT_KINDS = ['faces', 'edges', 'vertices'] as const;
export type CountKind = (typeof COUNT_KINDS)[number];

export const SOLID_COUNTS: Readonly<Record<SolidId, Readonly<Record<CountKind, number>>>> = {
  cube: { faces: 6, edges: 12, vertices: 8 },
  prism: { faces: 5, edges: 9, vertices: 6 },
  pyramid: { faces: 5, edges: 8, vertices: 5 },
  cylinder: { faces: 3, edges: 2, vertices: 0 },
};

export const FACE_NAMES = ['top', 'bottom', 'front', 'back', 'left', 'right'] as const;
export type FaceName = (typeof FACE_NAMES)[number];
export const NET_SQUARES = 6;
export const NET_PIECE = 'square';
export const NET_GRID = { minCols: 3, maxCols: 5, minRows: 3, maxRows: 4 } as const;
export const NET_EDGE_LIMIT = 20;
/** Core accepts an edge of 1; the Forge asks for 2 or more because the face names no longer fit on a square of that size on the board. */
export const CUBE_EDGE_MIN = 2;
export const VIEWER_COUNT_LIMIT = 12;
export const LABEL_FIXED = { min: 1, max: 3 } as const;
export const COMPLETE_FIXED = { min: 2, max: 5 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isSolid = (value: unknown): value is SolidId => (SOLID_IDS as readonly unknown[]).includes(value);
const isKind = (value: unknown): value is CountKind => (COUNT_KINDS as readonly unknown[]).includes(value);
const isFace = (value: unknown): value is FaceName => (FACE_NAMES as readonly unknown[]).includes(value);

export interface ViewerPayload { solids: SolidId[]; find: { kind: CountKind; count: number }; report: CountKind }

export function readViewer(value: unknown): ViewerPayload | string {
  if (!isRecord(value) || !exactKeys(value, ['solids', 'find', 'report'])) return 'the viewer payload is exactly solids, find and report';
  const { solids, find, report } = value;
  if (!Array.isArray(solids) || solids.length < 2 || solids.length > SOLID_IDS.length || !solids.every(isSolid) || new Set(solids).size !== solids.length) {
    return `solids lists two to ${SOLID_IDS.length} different solids from ${SOLID_IDS.join(', ')}`;
  }
  if (!isRecord(find) || !exactKeys(find, ['kind', 'count']) || !isKind(find.kind) || !whole(find.count, 0, VIEWER_COUNT_LIMIT)) return `find is a kind (${COUNT_KINDS.join(', ')}) and a count from 0 to ${VIEWER_COUNT_LIMIT}`;
  if (!isKind(report)) return `report is one of ${COUNT_KINDS.join(', ')}`;
  return { solids: [...solids] as SolidId[], find: { kind: find.kind, count: find.count }, report };
}

export const viewerMatches = (payload: ViewerPayload): SolidId[] => payload.solids.filter((solid) => SOLID_COUNTS[solid][payload.find.kind] === payload.find.count);

export type Cell = readonly [number, number];
const cellKey = (cell: Cell): string => `${cell[0]},${cell[1]}`;

function readCells(value: unknown, minimum: number, maximum: number): Cell[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
  const cells: Cell[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || !whole(entry[0], 0, 7) || !whole(entry[1], 0, 7)) return null;
    cells.push([entry[0], entry[1]]);
  }
  return new Set(cells.map(cellKey)).size === cells.length ? cells : null;
}

export interface LabelNet { mode: 'label'; cells: Cell[]; fixed: Array<{ cell: number; name: FaceName }>; edge: number }
export interface CompleteNet { mode: 'complete'; grid: { cols: number; rows: number }; fixed: Cell[]; edge: number }
/** The learner works out the surface area of the cube from the six squares and the edge printed on each. */
export interface AreaNet { mode: 'area'; cells: Cell[]; edge: number }
export type NetPayload = LabelNet | CompleteNet | AreaNet;
export const surfaceArea = (edge: number): number => 6 * edge * edge;

export function readNet(value: unknown): NetPayload | string {
  if (!isRecord(value)) return 'the net payload is an object with a mode';
  if (value.mode === 'label') {
    const cells = readCells(value.cells, NET_SQUARES, NET_SQUARES);
    if (!exactKeys(value, ['mode', 'cells', 'fixed', 'edge']) || !cells || !whole(value.edge, 1, NET_EDGE_LIMIT)) return `a label net is exactly mode, cells (six different [column, row] squares), fixed and edge (1 to ${NET_EDGE_LIMIT})`;
    const fixed: LabelNet['fixed'] = [];
    if (!Array.isArray(value.fixed) || value.fixed.length < LABEL_FIXED.min || value.fixed.length > LABEL_FIXED.max) return `a label net gives ${LABEL_FIXED.min} to ${LABEL_FIXED.max} named squares in fixed`;
    for (const entry of value.fixed) {
      if (!isRecord(entry) || !exactKeys(entry, ['cell', 'name']) || !whole(entry.cell, 0, NET_SQUARES - 1) || !isFace(entry.name)) return `each fixed entry is { cell: 0 to 5, name: ${FACE_NAMES.join(', ')} }`;
      fixed.push({ cell: entry.cell, name: entry.name });
    }
    return { mode: 'label', cells, fixed, edge: value.edge };
  }
  if (value.mode === 'complete') {
    const grid = value.grid;
    if (!exactKeys(value, ['mode', 'grid', 'fixed', 'edge']) || !isRecord(grid) || !exactKeys(grid, ['cols', 'rows'])
      || !whole(grid.cols, NET_GRID.minCols, NET_GRID.maxCols) || !whole(grid.rows, NET_GRID.minRows, NET_GRID.maxRows) || !whole(value.edge, 1, NET_EDGE_LIMIT)) {
      return `a complete net is exactly mode, grid ({ cols ${NET_GRID.minCols}-${NET_GRID.maxCols}, rows ${NET_GRID.minRows}-${NET_GRID.maxRows} }), fixed and edge (1 to ${NET_EDGE_LIMIT})`;
    }
    const fixed = readCells(value.fixed, COMPLETE_FIXED.min, COMPLETE_FIXED.max);
    if (!fixed || !fixed.every((cell) => cell[0] < (grid.cols as number) && cell[1] < (grid.rows as number))) return `a complete net gives ${COMPLETE_FIXED.min} to ${COMPLETE_FIXED.max} different squares inside the grid in fixed`;
    return { mode: 'complete', grid: { cols: grid.cols as number, rows: grid.rows as number }, fixed, edge: value.edge };
  }
  if (value.mode === 'area') {
    const cells = readCells(value.cells, NET_SQUARES, NET_SQUARES);
    if (!exactKeys(value, ['mode', 'cells', 'edge']) || !cells || !whole(value.edge, 1, NET_EDGE_LIMIT)) return `an area net is exactly mode, cells (six different [column, row] squares) and edge (1 to ${NET_EDGE_LIMIT})`;
    return { mode: 'area', cells, edge: value.edge };
  }
  return 'the net mode is label, complete or area';
}

type V = [number, number, number];
const scale = (vector: readonly number[], factor: number): V => [vector[0]! * factor || 0, vector[1]! * factor || 0, vector[2]! * factor || 0];
const plus = (a: readonly number[], b: readonly number[]): V => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];

/** Folds the squares into a cube corner; null when they are not one connected piece or two land on the same face. */
export function foldNormals(cells: readonly Cell[]): V[] | null {
  const at = new Map(cells.map((cell, index) => [cellKey(cell), index] as const));
  const frames = new Map<number, { normal: V; right: V; down: V }>([[0, { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] }]]);
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const frame = frames.get(index)!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = at.get(cellKey([cells[index]![0] + dc, cells[index]![1] + dr]));
      if (next === undefined || frames.has(next)) continue;
      const travel = plus(scale(frame.right, dc), scale(frame.down, dr));
      const away = scale(frame.normal, -1);
      frames.set(next, dc !== 0 ? { normal: travel, right: scale(away, dc), down: frame.down } : { normal: travel, right: frame.right, down: scale(away, dr) });
      queue.push(next);
    }
  }
  if (frames.size !== cells.length) return null;
  const normals = cells.map((_, index) => frames.get(index)!.normal);
  return new Set(normals.map((normal) => normal.join())).size === normals.length ? normals : null;
}

export const isCubeNet = (cells: readonly Cell[]): boolean => cells.length === NET_SQUARES && foldNormals(cells) !== null;

type Matrix = readonly [readonly number[], readonly number[], readonly number[]];
const apply = (m: Matrix, v: readonly number[]): V => [0, 1, 2].map((row) => m[row]![0]! * v[0]! + m[row]![1]! * v[1]! + m[row]![2]! * v[2]!) as V;
const product = (a: Matrix, b: Matrix): Matrix => [0, 1, 2].map((row) => [0, 1, 2].map((col) => a[row]![0]! * b[0]![col]! + a[row]![1]! * b[1]![col]! + a[row]![2]! * b[2]![col]!)) as unknown as Matrix;

const ROTATIONS: readonly Matrix[] = (() => {
  const turnX: Matrix = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  const turnY: Matrix = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
  const found = new Map<string, Matrix>();
  const queue: Matrix[] = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    const key = JSON.stringify(current);
    if (found.has(key)) continue;
    found.set(key, current);
    queue.push(product(turnX, current), product(turnY, current));
  }
  return [...found.values()];
})();

const DIRECTIONS: Readonly<Record<FaceName, readonly number[]>> = { top: [0, 1, 0], bottom: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0] };
const nameOf = (direction: readonly number[]): FaceName => FACE_NAMES.find((name) => DIRECTIONS[name].every((part, axis) => part === (direction[axis] || 0)))!;

/** Every way to name the six squares of a net that keeps the given names, as one name per square. */
export function labelSolutions(cells: readonly Cell[], fixed: ReadonlyArray<{ cell: number; name: FaceName }>): FaceName[][] {
  const normals = foldNormals(cells);
  if (!normals) return [];
  const all = ROTATIONS.map((rotation) => normals.map((normal) => nameOf(apply(rotation, normal))));
  return all.filter((labelling) => fixed.every((entry) => labelling[entry.cell] === entry.name));
}

/** Every set of squares that, added to the fixed ones inside the grid, folds into a cube. */
export function completions(fixed: readonly Cell[], grid: { cols: number; rows: number }, limit = 64): { count: number; sets: Cell[][] } {
  const taken = new Set(fixed.map(cellKey));
  const free: Cell[] = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) if (!taken.has(cellKey([col, row]))) free.push([col, row]);
  const add = NET_SQUARES - fixed.length;
  const out = { count: 0, sets: [] as Cell[][] };
  const pick = (from: number, chosen: Cell[]): void => {
    if (chosen.length === add) {
      if (!isCubeNet([...fixed, ...chosen])) return;
      out.count += 1;
      if (out.sets.length < limit) out.sets.push([...fixed, ...chosen]);
      return;
    }
    for (let index = from; index < free.length; index += 1) pick(index + 1, [...chosen, free[index]!]);
  };
  if (add >= 0) pick(0, []);
  return out;
}

export const STACK_MAX_HEIGHT = 3;
export type Heights = number[][];
export interface StackGoal { front?: number[]; side?: number[]; plan?: number[][] }
export interface StackPayload { size: 2 | 3; start: Heights; goal: StackGoal; fewest: boolean }

const heightRow = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every((cell) => whole(cell, 0, STACK_MAX_HEIGHT));

export function readStack(value: unknown): StackPayload | string {
  if (!isRecord(value) || !exactKeys(value, ['size', 'start', 'goal', 'fewest'])) return 'the stack payload is exactly size, start, goal and fewest';
  const { size, start, goal, fewest } = value;
  if (size !== 2 && size !== 3) return 'size is 2 or 3';
  if (!Array.isArray(start) || start.length !== size || !start.every((row) => heightRow(row, size))) return `start is a ${size} by ${size} list of heights, each 0 to ${STACK_MAX_HEIGHT}`;
  if (!isRecord(goal) || Object.keys(goal).length < 1 || Object.keys(goal).some((key) => key !== 'front' && key !== 'side' && key !== 'plan')) return 'goal names at least one of front, side and plan';
  if (goal.front !== undefined && !heightRow(goal.front, size)) return `goal.front is ${size} heights, each 0 to ${STACK_MAX_HEIGHT}`;
  if (goal.side !== undefined && !heightRow(goal.side, size)) return `goal.side is ${size} heights, each 0 to ${STACK_MAX_HEIGHT}`;
  if (goal.plan !== undefined && !(Array.isArray(goal.plan) && goal.plan.length === size && goal.plan.every((row) => Array.isArray(row) && row.length === size && row.every((cell) => whole(cell, 0, 1))))) {
    return `goal.plan is ${size} rows of ${size} cells, each 0 (empty) or 1 (a column stands)`;
  }
  if (typeof fewest !== 'boolean') return 'fewest is true or false';
  return { size, start: start as Heights, goal: goal as StackGoal, fewest };
}

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);
export const frontView = (heights: Heights): number[] => heights[0]!.map((_, col) => Math.max(...heights.map((row) => row[col]!)));
export const sideView = (heights: Heights): number[] => [...heights].reverse().map((row) => Math.max(...row));
export const planView = (heights: Heights): number[][] => heights.map((row) => row.map((cell) => (cell > 0 ? 1 : 0)));
export const stackTotal = (heights: Heights): number => heights.reduce((sum, row) => sum + row.reduce((inner, cell) => inner + cell, 0), 0);

export function matchesGoal(heights: Heights, goal: StackGoal): boolean {
  return (goal.front === undefined || same(frontView(heights), goal.front))
    && (goal.side === undefined || same(sideView(heights), goal.side))
    && (goal.plan === undefined || planView(heights).every((row, r) => same(row, goal.plan![r]!)));
}

export const stackKey = (heights: Heights): string => heights.map((row) => row.join('')).join('/');

/** Every stack of the grid that matches the goal, exhaustive (at most 4^9 stacks). */
export function stackSolutions(goal: StackGoal, size: number): Heights[] {
  const cells = new Array<number>(size * size).fill(0);
  const found: Heights[] = [];
  const visit = (index: number): void => {
    if (index === cells.length) {
      const heights: Heights = Array.from({ length: size }, (_, row) => cells.slice(row * size, row * size + size));
      if (matchesGoal(heights, goal)) found.push(heights);
      return;
    }
    for (let value = 0; value <= STACK_MAX_HEIGHT; value += 1) { cells[index] = value; visit(index + 1); }
    cells[index] = 0;
  };
  visit(0);
  return found;
}
