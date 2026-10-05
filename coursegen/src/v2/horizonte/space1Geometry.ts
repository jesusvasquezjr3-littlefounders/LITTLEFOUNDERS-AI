/*
 * A self-contained copy of the space1 model for the Forge solvability checkers. Forge ships on its own and cannot import Core, so the
 * voxel turns, the Platonic meshes with their plane sections, the market stall and the coin stacks are restated here without the
 * drawing code. The parity of this copy with Core is pinned by the space1 tests, which compare it to the pack fixtures.
 */
type Vec3 = readonly [number, number, number];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

// ── voxels ──
export const BOX = 3;
export const FIGURE_LIMITS = { min: 3, max: 10 } as const;
export const TARGET_LIMITS = { min: 1, max: 3 } as const;
export const TARGET_IDS = ['a', 'b', 'c'] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export type Cell = readonly [number, number, number];
export const ROTATION_AXES = ['up', 'side', 'depth'] as const;
export type RotationAxis = (typeof ROTATION_AXES)[number];
export const ANGLES = [0, 90, 180, 270] as const;
export type Angle = (typeof ANGLES)[number];
export const TURN_ANGLES = [90, 180, 270] as const;

export const isRotationAxis = (value: unknown): value is RotationAxis => typeof value === 'string' && (ROTATION_AXES as readonly string[]).includes(value);
export const isAngle = (value: unknown): value is Angle => typeof value === 'number' && (ANGLES as readonly number[]).includes(value);
export const isTargetId = (value: unknown): value is TargetId => typeof value === 'string' && (TARGET_IDS as readonly string[]).includes(value);

const boxIndex = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BOX;

export const isCell = (value: unknown): value is Cell => Array.isArray(value) && value.length === 3 && value.every(boxIndex);

export const cellKey = (cell: Cell): string => `${cell[0]},${cell[1]},${cell[2]}`;

/** A list of distinct cells of the 3 by 3 by 3 box, between `min` and `max` of them. */
export function isCellList(value: unknown, min: number, max: number): value is Cell[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(isCell) && new Set(value.map((cell) => cellKey(cell as Cell))).size === value.length;
}

/** x runs left to right, y bottom to top, z back to front (z grows toward the viewer). Turns are about the centre of the box. */
const QUARTER: Readonly<Record<RotationAxis, (cell: Cell) => Cell>> = {
  up: ([x, y, z]) => [BOX - 1 - z, y, x],
  side: ([x, y, z]) => [x, z, BOX - 1 - y],
  depth: ([x, y, z]) => [y, BOX - 1 - x, z],
};

/** `quarters` clockwise quarter turns: seen from above (up), from the right (side) or from the front (depth). */
export function turnFigure(cells: readonly Cell[], axis: RotationAxis, quarters: number): Cell[] {
  let turned: Cell[] = cells.map((cell) => [cell[0], cell[1], cell[2]]);
  for (let step = 0; step < ((quarters % 4) + 4) % 4; step += 1) turned = turned.map(QUARTER[axis]);
  return turned;
}

export const mirrorFigure = (cells: readonly Cell[]): Cell[] => cells.map(([x, y, z]) => [BOX - 1 - x, y, z] as Cell);

/** The cells moved to the corner of the box and sorted: two figures are the same shape when these are equal. */
export function normalise(cells: readonly Cell[]): string {
  const low: [number, number, number] = [Infinity, Infinity, Infinity];
  for (const cell of cells) for (let axis = 0; axis < 3; axis += 1) low[axis] = Math.min(low[axis]!, cell[axis]!);
  return cells.map((cell) => cellKey([cell[0] - low[0], cell[1] - low[1], cell[2] - low[2]])).sort().join('|');
}

export const sameShape = (a: readonly Cell[], b: readonly Cell[]): boolean => a.length === b.length && normalise(a) === normalise(b);

/** Face-connected: every cell touches another by a whole face. */
export function isConnected(cells: readonly Cell[]): boolean {
  if (cells.length === 0) return false;
  const present = new Set(cells.map(cellKey));
  const seen = new Set<string>([cellKey(cells[0]!)]);
  const queue: Cell[] = [cells[0]!];
  while (queue.length > 0) {
    const [x, y, z] = queue.pop()!;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      const next: Cell = [x + dx, y + dy, z + dz];
      const key = cellKey(next);
      if (present.has(key) && !seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen.size === cells.length;
}

type Matrix = readonly (readonly number[])[];
const MULTIPLY = (a: Matrix, b: Matrix): Matrix => a.map((row) => [0, 1, 2].map((col) => row.reduce((sum, value, k) => sum + value * b[k]![col]!, 0)));
const UP: Matrix = [[0, 0, -1], [0, 1, 0], [1, 0, 0]];
const SIDE: Matrix = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
const IDENTITY: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** The 24 turns that map a cube onto itself, as matrices about the centre, found by closing the two generating quarter turns. */
function rotationGroup(): Matrix[] {
  const found = new Map<string, Matrix>([[JSON.stringify(IDENTITY), IDENTITY]]);
  const queue: Matrix[] = [IDENTITY];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const generator of [UP, SIDE]) {
      const next = MULTIPLY(generator, current);
      const key = JSON.stringify(next);
      if (!found.has(key)) { found.set(key, next); queue.push(next); }
    }
  }
  return [...found.values()];
}

const GROUP = rotationGroup();

const applyMatrix = (matrix: Matrix, [x, y, z]: Cell): Cell => {
  const relative = [x - 1, y - 1, z - 1];
  const turned = matrix.map((row) => row.reduce((sum, value, k) => sum + value * relative[k]!, 0));
  return [turned[0]! + 1, turned[1]! + 1, turned[2]! + 1];
};

export const ROTATION_COUNT = GROUP.length;

/** True when some turn of the cube (any axis, any amount) carries the figure onto the other, up to a move. */
export const congruentByTurning = (a: readonly Cell[], b: readonly Cell[]): boolean => a.length === b.length && GROUP.some((matrix) => sameShape(a.map((cell) => applyMatrix(matrix, cell)), b));

/** The turns about one axis (in degrees, never 0) after which the figure has the shape of the target. */
export function matchingAngles(figure: readonly Cell[], target: readonly Cell[], axis: RotationAxis): number[] {
  return TURN_ANGLES.filter((angle) => sameShape(turnFigure(figure, axis, angle / 90), target));
}
// ── polyhedra ──

export const PLATONIC_IDS = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'] as const;
export type PlatonicId = (typeof PLATONIC_IDS)[number];
export const ARCHIMEDEAN_IDS = ['truncated-tetrahedron', 'cuboctahedron', 'truncated-octahedron', 'icosidodecahedron', 'truncated-icosahedron'] as const;
export type ArchimedeanId = (typeof ARCHIMEDEAN_IDS)[number];
export const EULER_SOLIDS = [...PLATONIC_IDS, ...ARCHIMEDEAN_IDS] as const;
export type EulerSolid = (typeof EULER_SOLIDS)[number];
export const SECTION_SOLIDS = ['tetrahedron', 'cube', 'octahedron', 'cylinder'] as const;
export type SectionSolid = (typeof SECTION_SOLIDS)[number];

export const isPlatonicId = (value: unknown): value is PlatonicId => typeof value === 'string' && (PLATONIC_IDS as readonly string[]).includes(value);
export const isEulerSolid = (value: unknown): value is EulerSolid => typeof value === 'string' && (EULER_SOLIDS as readonly string[]).includes(value);
export const isSectionSolid = (value: unknown): value is SectionSolid => typeof value === 'string' && (SECTION_SOLIDS as readonly string[]).includes(value);

export interface PolyMesh { vertices: readonly Vec3[]; faces: readonly (readonly number[])[]; edges: readonly (readonly [number, number])[] }
export interface PolyCounts { vertices: number; edges: number; faces: number }

/** V, E, F of each Platonic solid: the numbers the Euler question reads; `polyCounts(mesh)` must agree (tested). */
export const PLATONIC_COUNTS: Readonly<Record<PlatonicId, PolyCounts>> = {
  tetrahedron: { vertices: 4, edges: 6, faces: 4 },
  cube: { vertices: 8, edges: 12, faces: 6 },
  octahedron: { vertices: 6, edges: 12, faces: 8 },
  dodecahedron: { vertices: 20, edges: 30, faces: 12 },
  icosahedron: { vertices: 12, edges: 30, faces: 20 },
};

/** The same counts for the Archimedean solids the Euler question also uses (the meshes live in Core; their counts are pinned against these). */
export const ARCHIMEDEAN_COUNTS: Readonly<Record<ArchimedeanId, PolyCounts>> = {
  'truncated-tetrahedron': { vertices: 12, edges: 18, faces: 8 },
  cuboctahedron: { vertices: 12, edges: 24, faces: 14 },
  'truncated-octahedron': { vertices: 24, edges: 36, faces: 14 },
  icosidodecahedron: { vertices: 30, edges: 60, faces: 32 },
  'truncated-icosahedron': { vertices: 60, edges: 90, faces: 32 },
};
export const EULER_COUNTS: Readonly<Record<EulerSolid, PolyCounts>> = { ...PLATONIC_COUNTS, ...ARCHIMEDEAN_COUNTS };

const EPS = 1e-9;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const centroidOf = (points: readonly Vec3[]): Vec3 => [
  points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length, points.reduce((sum, p) => sum + p[2], 0) / points.length,
];

/** Newell's normal of a face (not normalised), exact for any planar polygon. */
function newell(vertices: readonly Vec3[], face: readonly number[]): Vec3 {
  let x = 0; let y = 0; let z = 0;
  face.forEach((from, at) => {
    const a = vertices[from]!;
    const b = vertices[face[(at + 1) % face.length]!]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return [x, y, z];
}

export const faceNormalOf = (mesh: PolyMesh, face: readonly number[]): Vec3 => {
  const n = newell(mesh.vertices, face);
  const l = length(n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
};

/** Every face wound counter-clockwise seen from outside (the solids here are convex, so the mean of the corners is inside). */
function wound(vertices: readonly Vec3[], faces: readonly (readonly number[])[]): number[][] {
  const inside = centroidOf(vertices);
  return faces.map((face) => (dot(newell(vertices, face), sub(centroidOf(face.map((index) => vertices[index]!)), inside)) < 0 ? [...face].reverse() : [...face]));
}

function deriveEdges(faces: readonly (readonly number[])[]): [number, number][] {
  const seen = new Map<string, [number, number]>();
  for (const face of faces) {
    face.forEach((from, at) => {
      const to = face[(at + 1) % face.length]!;
      seen.set(from < to ? `${from}:${to}` : `${to}:${from}`, [Math.min(from, to), Math.max(from, to)]);
    });
  }
  return [...seen.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function mesh(vertices: Vec3[], faces: number[][]): PolyMesh {
  const oriented = wound(vertices, faces);
  return { vertices, faces: oriented, edges: deriveEdges(oriented) };
}

function tetrahedron(): PolyMesh {
  return mesh([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], [[1, 2, 3], [0, 3, 2], [0, 1, 3], [0, 2, 1]]);
}

function box(width: number, height: number, depth: number): PolyMesh {
  const vertices: Vec3[] = [];
  for (let index = 0; index < 8; index += 1) vertices.push([(index & 1 ? 1 : -1) * width, (index & 2 ? 1 : -1) * height, (index & 4 ? 1 : -1) * depth]);
  const faces: number[][] = [];
  for (const [bit, others] of [[1, [2, 4]], [2, [1, 4]], [4, [1, 2]]] as const) {
    for (const on of [0, bit]) {
      const [first, second] = others;
      faces.push([on, on | first, on | first | second, on | second]);
    }
  }
  return mesh(vertices, faces);
}

function octahedron(): PolyMesh {
  const vertices: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces: number[][] = [];
  for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) faces.push([x, y, z]);
  return mesh(vertices, faces);
}

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedron(): PolyMesh {
  const vertices: Vec3[] = [];
  for (const a of [1, -1]) for (const b of [PHI, -PHI]) vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
  const faces: number[][] = [];
  for (let i = 0; i < vertices.length; i += 1) for (let j = i + 1; j < vertices.length; j += 1) for (let k = j + 1; k < vertices.length; k += 1) {
    const close = (p: number, q: number) => Math.abs(length(sub(vertices[p]!, vertices[q]!)) - 2) < 1e-9;
    if (close(i, j) && close(j, k) && close(i, k)) faces.push([i, j, k]);
  }
  return mesh(vertices, faces);
}

/** The dual of the icosahedron: a corner at the centre of each icosahedron face, a pentagon round each icosahedron corner. */
function dodecahedron(): PolyMesh {
  const ico = icosahedron();
  const vertices: Vec3[] = ico.faces.map((face) => centroidOf(face.map((index) => ico.vertices[index]!)));
  const faces: number[][] = ico.vertices.map((corner, index) => {
    const around = ico.faces.flatMap((face, at) => (face.includes(index) ? [at] : []));
    const axis = corner;
    const helper: Vec3 = Math.abs(axis[0]) < 1 ? [1, 0, 0] : [0, 1, 0];
    const u = cross(axis, helper);
    const v = cross(axis, u);
    const angle = (at: number) => { const p = sub(vertices[at]!, corner); return Math.atan2(dot(p, v), dot(p, u)); };
    return around.sort((a, b) => angle(a) - angle(b));
  });
  return mesh(vertices, faces);
}

const BUILDERS: Readonly<Record<PlatonicId, () => PolyMesh>> = { tetrahedron, cube: () => box(1, 1, 1), octahedron, dodecahedron, icosahedron };

const cache = new Map<PlatonicId, PolyMesh>();
export function platonicMesh(id: PlatonicId): PolyMesh {
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id)!;
}

/** A square pyramid of base `side` and the given height, the apex above the middle of the base; centred on the origin. */
export function pyramidMesh(side: number, height: number): PolyMesh {
  const h = side / 2;
  const low = -height / 2;
  return mesh([[-h, low, h], [h, low, h], [h, low, -h], [-h, low, -h], [0, height / 2, 0]], [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]);
}

/** A square prism (a box) of base `side` and the given height; centred on the origin. */
export function prismMesh(side: number, height: number): PolyMesh {
  return box(side / 2, height / 2, side / 2);
}

export const polyCounts = (solid: PolyMesh): PolyCounts => ({ vertices: solid.vertices.length, edges: solid.edges.length, faces: solid.faces.length });
export const eulerSum = (counts: PolyCounts): number => counts.vertices - counts.edges + counts.faces;

export const COUNT_NAMES = ['vertices', 'edges', 'faces'] as const;
export type CountName = (typeof COUNT_NAMES)[number];
export const isCountName = (value: unknown): value is CountName => typeof value === 'string' && (COUNT_NAMES as readonly string[]).includes(value);

/** The pyramid takes a third of the prism of the same base and height: whole when side squared times height divides by 3. */
export const prismVolume = (side: number, height: number): number => side * side * height;
export const pyramidVolume = (side: number, height: number): number | null => (prismVolume(side, height) % 3 === 0 ? prismVolume(side, height) / 3 : null);

/** A cone takes a third of the cylinder of the same radius and height; both volumes are counted in pi, so the cone's is whole when radius squared times height divides by 3. */
export const cylinderVolume = (radius: number, height: number): number => radius * radius * height;
export const coneVolume = (radius: number, height: number): number | null => (cylinderVolume(radius, height) % 3 === 0 ? cylinderVolume(radius, height) / 3 : null);

export const SHAPES = ['triangle', 'square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'quadrilateral', 'pentagon', 'hexagon', 'polygon', 'circle', 'ellipse'] as const;
export type SectionShape = (typeof SHAPES)[number];
export const isSectionShape = (value: unknown): value is SectionShape => typeof value === 'string' && (SHAPES as readonly string[]).includes(value);

/** Every name that is also true of a shape: a square is a rectangle, so offering both would give the question two answers. */
export const ALSO_TRUE: Readonly<Record<SectionShape, readonly SectionShape[]>> = {
  triangle: ['polygon'],
  square: ['rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'quadrilateral', 'polygon'],
  rectangle: ['parallelogram', 'trapezoid', 'quadrilateral', 'polygon'],
  rhombus: ['parallelogram', 'trapezoid', 'quadrilateral', 'polygon'],
  parallelogram: ['trapezoid', 'quadrilateral', 'polygon'],
  trapezoid: ['quadrilateral', 'polygon'],
  quadrilateral: ['polygon'],
  pentagon: ['polygon'],
  hexagon: ['polygon'],
  polygon: [],
  circle: ['ellipse'],
  ellipse: [],
};

export interface Plane { normal: readonly [number, number, number]; offset: number }
export const PLANE_LIMITS = { normal: 3, offset: 16 } as const;
export const OFFSET_UNIT = 4;

/** The plane n . p = offset / 4. */
const distanceTo = (plane: Plane, point: Vec3): number => dot(plane.normal as Vec3, point) - plane.offset / OFFSET_UNIT;

export interface Crossing { edge: readonly [number, number]; at: number; point: Vec3 }

/** Where the plane meets the edges of the solid: strictly inside an edge (`at` is the fraction from its first corner), or at a corner. */
export function planeCrossings(solid: PolyMesh, plane: Plane): { onCorners: number[]; insideEdges: Crossing[]; sides: { above: number; below: number } } {
  const distances = solid.vertices.map((vertex) => distanceTo(plane, vertex));
  const onCorners = distances.flatMap((distance, index) => (Math.abs(distance) < EPS ? [index] : []));
  const insideEdges: Crossing[] = [];
  for (const edge of solid.edges) {
    const da = distances[edge[0]]!;
    const db = distances[edge[1]]!;
    if (Math.abs(da) < EPS || Math.abs(db) < EPS || da * db > 0) continue;
    const at = da / (da - db);
    const a = solid.vertices[edge[0]]!;
    const b = solid.vertices[edge[1]]!;
    insideEdges.push({ edge, at, point: [a[0] + (b[0] - a[0]) * at, a[1] + (b[1] - a[1]) * at, a[2] + (b[2] - a[2]) * at] });
  }
  return { onCorners, insideEdges, sides: { above: distances.filter((d) => d > EPS).length, below: distances.filter((d) => d < -EPS).length } };
}

/** The corners of the cut, in order round the cut; null when the plane only touches the solid or misses it. */
export function sectionPolygon(solid: PolyMesh, plane: Plane): Vec3[] | null {
  const { onCorners, insideEdges, sides } = planeCrossings(solid, plane);
  if (sides.above === 0 || sides.below === 0) return null;
  const raw: Vec3[] = [...onCorners.map((index) => solid.vertices[index]!), ...insideEdges.map((crossing) => crossing.point)];
  const unique: Vec3[] = [];
  for (const point of raw) if (unique.every((other) => length(sub(point, other)) > 1e-7)) unique.push(point);
  if (unique.length < 3) return null;
  const centre = centroidOf(unique);
  const normal = plane.normal as Vec3;
  const n = length(normal);
  const axis: Vec3 = [normal[0] / n, normal[1] / n, normal[2] / n];
  const helper: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(axis, helper);
  const ul = length(u);
  const e1: Vec3 = [u[0] / ul, u[1] / ul, u[2] / ul];
  const e2 = cross(axis, e1);
  const angle = (point: Vec3) => { const p = sub(point, centre); return Math.atan2(dot(p, e2), dot(p, e1)); };
  const ordered = [...unique].sort((a, b) => angle(a) - angle(b));
  const trimmed = ordered.filter((point, index) => {
    const before = ordered[(index + ordered.length - 1) % ordered.length]!;
    const after = ordered[(index + 1) % ordered.length]!;
    return length(cross(sub(point, before), sub(after, point))) > 1e-7;
  });
  return trimmed.length >= 3 ? trimmed : null;
}

/** The most specific name of a flat shape given by its corners in order. */
export function classifyPolygon(corners: readonly Vec3[]): SectionShape {
  const count = corners.length;
  if (count === 3) return 'triangle';
  if (count === 5) return 'pentagon';
  if (count === 6) return 'hexagon';
  if (count !== 4) return 'polygon';
  const edges = corners.map((corner, index) => sub(corners[(index + 1) % 4]!, corner));
  const lengths = edges.map(length);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-7 * Math.max(1, a, b);
  const parallel = (a: Vec3, b: Vec3) => length(cross(a, b)) < 1e-7 * length(a) * length(b);
  const pairs = [parallel(edges[0]!, edges[2]!), parallel(edges[1]!, edges[3]!)];
  const right = Math.abs(dot(edges[0]!, edges[1]!)) < 1e-7 * lengths[0]! * lengths[1]!;
  const equal = near(lengths[0]!, lengths[1]!) && near(lengths[1]!, lengths[2]!) && near(lengths[2]!, lengths[3]!);
  if (pairs[0] && pairs[1]) {
    if (right) return equal ? 'square' : 'rectangle';
    return equal ? 'rhombus' : 'parallelogram';
  }
  return pairs[0] || pairs[1] ? 'trapezoid' : 'quadrilateral';
}

/** What a plane does to a solid: a named shape, or no clean cut (`clipped` when a cylinder's cut runs into an end cap, else it only touches or misses). */
export interface SectionCut { shape: SectionShape | null; clipped: boolean }

/** The cylinder the plane cuts: radius 1 and height 3, so a cut along its axis is a 2 by 3 rectangle and never a square. */
export const CYLINDER = { radius: 1, half: 1.5 } as const;

/** The cylinder is cut by formula, so its circle, rectangle and ellipse are exact whatever the strips of its drawing are. */
function cylinderCut(plane: Plane): SectionCut {
  const [a, b, c] = plane.normal;
  const reach = plane.offset / OFFSET_UNIT;
  const across = Math.hypot(a, c);
  const none: SectionCut = { shape: null, clipped: false };
  if (a === 0 && c === 0) return Math.abs(reach / b) < CYLINDER.half - EPS ? { shape: 'circle', clipped: false } : none;
  if (b === 0) return Math.abs(reach) / across < CYLINDER.radius - EPS ? { shape: 'rectangle', clipped: false } : none;
  const middle = reach / b;
  const spread = (across * CYLINDER.radius) / Math.abs(b);
  const low = middle - spread;
  const high = middle + spread;
  if (low > -CYLINDER.half + EPS && high < CYLINDER.half - EPS) return { shape: 'ellipse', clipped: false };
  return { shape: null, clipped: high > -CYLINDER.half + EPS && low < CYLINDER.half - EPS };
}

export function sectionCut(solid: SectionSolid, plane: Plane): SectionCut {
  if (solid === 'cylinder') return cylinderCut(plane);
  const polygon = sectionPolygon(platonicMesh(solid), plane);
  return { shape: polygon ? classifyPolygon(polygon) : null, clipped: false };
}

export const sectionShape = (solid: SectionSolid, plane: Plane): SectionShape | null => sectionCut(solid, plane).shape;

/** The lowest and highest offset a plane with this normal can sit at and still be on the slider: just past the solid on both sides. */
export function slideRange(solid: SectionSolid, normal: Plane['normal']): { min: number; max: number } {
  const along = solid === 'cylinder'
    ? [-1, 1].map((sign) => sign * (Math.hypot(normal[0], normal[2]) * CYLINDER.radius + Math.abs(normal[1]) * CYLINDER.half))
    : platonicMesh(solid).vertices.map((vertex) => dot(normal as Vec3, vertex));
  return {
    min: Math.max(-PLANE_LIMITS.offset, Math.floor(Math.min(...along) * OFFSET_UNIT + EPS) - 1),
    max: Math.min(PLANE_LIMITS.offset, Math.ceil(Math.max(...along) * OFFSET_UNIT - EPS) + 1),
  };
}

/** Every shape the plane makes as it slides along its normal over the range of the slider. */
export function slideShapes(solid: SectionSolid, normal: Plane['normal']): Map<number, SectionShape | null> {
  const { min, max } = slideRange(solid, normal);
  const shapes = new Map<number, SectionShape | null>();
  for (let offset = min; offset <= max; offset += 1) shapes.set(offset, sectionShape(solid, { normal, offset }));
  return shapes;
}

// ── coins ──
export const COIN_PIECES = ['coin', 'bill'] as const;
export type CoinPiece = (typeof COIN_PIECES)[number];
/** The teaching thickness of one piece in tenths of a millimetre: a coin is 2 mm, a bill 0.1 mm. */
export const THICKNESS_TENTHS: Readonly<Record<CoinPiece, number>> = { coin: 20, bill: 1 };
export const COIN_LIMITS = {
  value: { min: 1, max: 100_000 },
  total: { max: 10_000_000_000 },
  mm: { max: 100_000 },
  step: { min: 1, max: 10_000 },
  max: { min: 2, max: 100_000 },
  positions: { max: 40 },
} as const;

/** Things of a known height drawn beside the stack so the learner can read the scale; each locale names them in its own copy. */
export const REFERENCE_MARKS = [
  { id: 'phone', mm: 8 },
  { id: 'book', mm: 30 },
  { id: 'desk', mm: 750 },
  { id: 'door', mm: 2000 },
] as const;
export type ReferenceId = (typeof REFERENCE_MARKS)[number]['id'];

/** Values are whole cents; the board prints them in the learner's market currency (pesos, reais, dollars), so the plan stays locale-neutral. */
export type CoinGoal = { kind: 'amount'; total: number } | { kind: 'height'; mm: number };
export interface CoinPayload { piece: CoinPiece; value: number; goal: CoinGoal; step: number; max: number }

export const isCoinPiece = (value: unknown): value is CoinPiece => typeof value === 'string' && (COIN_PIECES as readonly string[]).includes(value);

function readCoinGoal(value: unknown): CoinGoal | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'amount' && exactKeys(value, ['kind', 'total']) && whole(value.total, 1, COIN_LIMITS.total.max)) return { kind: 'amount', total: value.total };
  if (value.kind === 'height' && exactKeys(value, ['kind', 'mm']) && whole(value.mm, 1, COIN_LIMITS.mm.max)) return { kind: 'height', mm: value.mm };
  return null;
}

export function readCoinPayload(value: unknown): CoinPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['piece', 'value', 'goal', 'step', 'max'])) return null;
  const goal = readCoinGoal(value.goal);
  if (!goal || !isCoinPiece(value.piece)) return null;
  if (!whole(value.value, COIN_LIMITS.value.min, COIN_LIMITS.value.max) || !whole(value.step, COIN_LIMITS.step.min, COIN_LIMITS.step.max) || !whole(value.max, COIN_LIMITS.max.min, COIN_LIMITS.max.max)) return null;
  return { piece: value.piece, value: value.value, goal, step: value.step, max: value.max };
}

/** The height of a stack in tenths of a millimetre, and the money in it in cents. */
export const stackTenths = (piece: CoinPiece, count: number): number => count * THICKNESS_TENTHS[piece];
export const stackCents = (payload: Pick<CoinPayload, 'value'>, count: number): number => count * payload.value;

/** The number of pieces the question asks for, or null when the goal does not fall on a whole number of pieces. */
export function coinAnswer(payload: CoinPayload): number | null {
  const thickness = THICKNESS_TENTHS[payload.piece];
  const count = payload.goal.kind === 'amount'
    ? (payload.goal.total % payload.value === 0 ? payload.goal.total / payload.value : null)
    : ((payload.goal.mm * 10) % thickness === 0 ? (payload.goal.mm * 10) / thickness : null);
  return count !== null && Number.isSafeInteger(count) ? count : null;
}

/** The counts the handle can rest on: 0, then every multiple of the step up to the maximum. */
export const coinPositions = (payload: Pick<CoinPayload, 'step' | 'max'>): number[] => Array.from({ length: Math.floor(payload.max / payload.step) + 1 }, (_, index) => index * payload.step);

export function coinProblem(payload: CoinPayload): string | null {
  if (payload.max % payload.step !== 0) return 'The maximum must be a whole number of steps';
  if (payload.max / payload.step > COIN_LIMITS.positions.max) return `The handle may rest on at most ${COIN_LIMITS.positions.max} counts: raise the step`;
  const answer = coinAnswer(payload);
  if (answer === null) return payload.goal.kind === 'amount' ? 'The total must be a whole number of pieces' : 'The height must be a whole number of pieces';
  if (answer < payload.step || answer > payload.max) return 'The answer must be between one step and the maximum';
  if (answer % payload.step !== 0) return 'The answer must be a multiple of the step, so the handle can rest on it';
  return null;
}

// ── stall ──
/** The things a stall may sell: a closed vocabulary, so the payload carries no words and each locale names them in its own copy. */
export const STALL_IDS = ['apple', 'bread', 'juice', 'toy', 'book', 'pen', 'cap', 'kite', 'shell', 'stamp'] as const;
export type StallId = (typeof STALL_IDS)[number];
export const STALL_PIECE = 'item';
export const STALL_LIMITS = {
  items: { min: 2, max: 5 },
  price: { min: 1, max: 2000 },
  stock: { min: 1, max: 9 },
  total: { max: 10_000 },
} as const;

export const isStallId = (value: unknown): value is StallId => typeof value === 'string' && (STALL_IDS as readonly string[]).includes(value);

/** Prices are whole cents; the board prints them in the learner's market currency (pesos, reais, dollars), so the plan stays locale-neutral. */
export interface StallItem { id: StallId; price: number; stock: number }
export type StallGoal =
  | { kind: 'exact'; total: number }
  | { kind: 'change'; paid: number; change: number }
  | { kind: 'most'; budget: number };
export interface StallPayload { items: StallItem[]; goal: StallGoal }
/** How many of each item the basket holds, keyed by item id. */
export type Basket = Readonly<Record<string, number>>;

function readStallGoal(value: unknown): StallGoal | null {
  if (!isRecord(value)) return null;
  const { total } = STALL_LIMITS;
  if (value.kind === 'exact' && exactKeys(value, ['kind', 'total']) && whole(value.total, 1, total.max)) return { kind: 'exact', total: value.total };
  if (value.kind === 'most' && exactKeys(value, ['kind', 'budget']) && whole(value.budget, 1, total.max)) return { kind: 'most', budget: value.budget };
  if (value.kind === 'change' && exactKeys(value, ['kind', 'paid', 'change']) && whole(value.paid, 2, total.max) && whole(value.change, 1, value.paid - 1)) {
    return { kind: 'change', paid: value.paid, change: value.change };
  }
  return null;
}

export function readStallPayload(value: unknown): StallPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['items', 'goal'])) return null;
  const { items } = value;
  if (!Array.isArray(items) || items.length < STALL_LIMITS.items.min || items.length > STALL_LIMITS.items.max) return null;
  const read: StallItem[] = [];
  for (const entry of items) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'price', 'stock']) || !isStallId(entry.id)) return null;
    if (!whole(entry.price, STALL_LIMITS.price.min, STALL_LIMITS.price.max) || !whole(entry.stock, STALL_LIMITS.stock.min, STALL_LIMITS.stock.max)) return null;
    read.push({ id: entry.id, price: entry.price, stock: entry.stock });
  }
  if (new Set(read.map((item) => item.id)).size !== read.length) return null;
  const goal = readStallGoal(value.goal);
  return goal ? { items: read, goal } : null;
}

/** What the basket must come to: the exact total, or the price paid less the change. `most` has no fixed total. */
export const goalTotal = (goal: StallGoal): number | null => (goal.kind === 'exact' ? goal.total : goal.kind === 'change' ? goal.paid - goal.change : null);

export const basketCount = (basket: Basket): number => Object.values(basket).reduce((sum, count) => sum + count, 0);
export const basketCost = (items: readonly StallItem[], basket: Basket): number => items.reduce((sum, item) => sum + item.price * (basket[item.id] ?? 0), 0);

/** The most things the budget buys: cheapest first is optimal when every purchase is one item. */
export function mostItems(items: readonly StallItem[], budget: number): number {
  let left = budget;
  let bought = 0;
  for (const item of [...items].sort((a, b) => a.price - b.price)) {
    const afford = Math.min(item.stock, Math.floor(left / item.price));
    bought += afford;
    left -= afford * item.price;
  }
  return bought;
}

/** The rule every right basket satisfies, so many baskets can be right: the sum hits the total, or it is the biggest bag the budget buys. */
export function basketMeets(payload: StallPayload, basket: Basket): boolean {
  const count = basketCount(basket);
  if (count === 0) return false;
  const cost = basketCost(payload.items, basket);
  const total = goalTotal(payload.goal);
  if (total !== null) return cost === total;
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  return cost <= budget && count === mostItems(payload.items, budget);
}

/** The basket a slot map holds; null for an unknown slot, anything but an item, or more than the stall has. An empty map is an empty basket. */
export function slotsToBasket(slots: unknown, payload: StallPayload): Basket | null {
  if (!isRecord(slots)) return null;
  const stock = new Map(payload.items.map((item) => [item.id as string, item.stock]));
  const basket: Record<string, number> = {};
  for (const [slot, pieces] of Object.entries(slots)) {
    const limit = stock.get(slot);
    if (limit === undefined || !Array.isArray(pieces) || pieces.length > limit || pieces.some((piece) => piece !== STALL_PIECE)) return null;
    if (pieces.length > 0) basket[slot] = pieces.length;
  }
  return basket;
}

export function basketToSlots(basket: Basket): Record<string, string[]> {
  return Object.fromEntries(Object.entries(basket).filter(([, count]) => count > 0).map(([slot, count]) => [slot, Array.from({ length: count }, () => STALL_PIECE)]));
}

/** The arrangement context of the stall: one repeatable piece, a slot per item holding up to its stock. */
export function stallContext(payload: StallPayload): { pieceIds: string[]; slotIds: string[]; capacities: Record<string, number>; repeatable: true } {
  return {
    pieceIds: [STALL_PIECE],
    slotIds: payload.items.map((item) => item.id),
    capacities: Object.fromEntries(payload.items.map((item) => [item.id, item.stock])),
    repeatable: true,
  };
}

/** Every total some basket reaches, found by counting up one item at a time (at most 5 items, 9 each, 10,000 cents). */
export function reachableTotals(items: readonly StallItem[], limit: number): Set<number> {
  let sums = new Set<number>([0]);
  for (const item of items) {
    const next = new Set<number>();
    for (const sum of sums) {
      for (let count = 0; count <= item.stock && sum + count * item.price <= limit; count += 1) next.add(sum + count * item.price);
    }
    sums = next;
  }
  return sums;
}

/** One basket that reaches the total, or null when none does. */
export function basketFor(items: readonly StallItem[], total: number): Basket | null {
  const visit = (index: number, left: number, chosen: Record<string, number>): Record<string, number> | null => {
    if (left === 0) return chosen;
    if (index === items.length) return null;
    const item = items[index]!;
    for (let count = Math.min(item.stock, Math.floor(left / item.price)); count >= 0; count -= 1) {
      const found = visit(index + 1, left - count * item.price, count > 0 ? { ...chosen, [item.id]: count } : chosen);
      if (found) return found;
    }
    return null;
  };
  return total > 0 ? visit(0, total, {}) : null;
}

/** One basket of the biggest size the budget buys, cheapest first. */
export function biggestBasket(items: readonly StallItem[], budget: number): Basket {
  let left = budget;
  const basket: Record<string, number> = {};
  for (const item of [...items].sort((a, b) => a.price - b.price)) {
    const afford = Math.min(item.stock, Math.floor(left / item.price));
    if (afford > 0) basket[item.id] = afford;
    left -= afford * item.price;
  }
  return basket;
}

/** A correct basket for the goal, or null when the question has none. */
export function stallAnswer(payload: StallPayload): Basket | null {
  const total = goalTotal(payload.goal);
  if (total !== null) return basketFor(payload.items, total);
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  const basket = biggestBasket(payload.items, budget);
  return basketCount(basket) > 0 ? basket : null;
}

export function stallProblem(payload: StallPayload): string | null {
  const sold = payload.items.reduce((sum, item) => sum + item.price * item.stock, 0);
  const total = goalTotal(payload.goal);
  if (total !== null) {
    if (total > sold) return 'The stall does not hold enough to reach the total';
    return reachableTotals(payload.items, total).has(total) ? null : 'No basket of these items adds up to the total';
  }
  const { budget } = payload.goal as { kind: 'most'; budget: number };
  if (budget < Math.min(...payload.items.map((item) => item.price))) return 'The budget does not buy even the cheapest item';
  if (budget >= sold) return 'The budget must not cover the whole stall, or there is nothing to choose';
  return null;
}

// ── rotation rules ──

const copyCells = (cells: readonly Cell[]): Cell[] => cells.map((cell) => [cell[0], cell[1], cell[2]] as Cell);

export interface RotationPayload { axis: RotationAxis; figure: Cell[]; targets: Cell[][] }

export function readRotationPayload(value: unknown): RotationPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['axis', 'figure', 'targets'])) return null;
  const { axis, figure, targets } = value;
  if (!isRotationAxis(axis) || !isCellList(figure, FIGURE_LIMITS.min, FIGURE_LIMITS.max)) return null;
  if (!Array.isArray(targets) || targets.length < TARGET_LIMITS.min || targets.length > TARGET_LIMITS.max) return null;
  if (!targets.every((target) => isCellList(target, FIGURE_LIMITS.min, FIGURE_LIMITS.max))) return null;
  return { axis, figure: copyCells(figure), targets: (targets as Cell[][]).map(copyCells) };
}

export interface RotationAnswer { pick: TargetId; angles: number[] }

/** The one target the figure becomes when turned about the axis, and every turn (90, 180, 270) that gets it there; null when not exactly one. */
export function rotationAnswer(payload: RotationPayload): RotationAnswer | null {
  const matches = payload.targets.flatMap((target, index) => {
    const angles = matchingAngles(payload.figure, target, payload.axis);
    return angles.length > 0 ? [{ pick: TARGET_IDS[index]!, angles }] : [];
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** The authoring rules: the answer exists and is unique, a wrong shape is never a turn of the figure, and a turn of 0 is never the answer. */
export function rotationProblem(payload: RotationPayload): string | null {
  if (!isConnected(payload.figure)) return 'The figure must be one piece: each cube touches another by a face';
  if (!payload.targets.every(isConnected)) return 'Each target must be one piece';
  if (payload.targets.some((target) => sameShape(payload.figure, target))) return 'A target must differ from the figure as it stands';
  for (let first = 0; first < payload.targets.length; first += 1) {
    for (let second = first + 1; second < payload.targets.length; second += 1) {
      if (sameShape(payload.targets[first]!, payload.targets[second]!)) return 'The targets must differ from one another';
    }
  }
  const answer = rotationAnswer(payload);
  if (!answer) return payload.targets.length === 1 ? 'The target must be the figure turned about the axis' : 'Exactly one target must be the figure turned about the axis';
  const stray = payload.targets.some((target, index) => TARGET_IDS[index] !== answer.pick && congruentByTurning(payload.figure, target));
  return stray ? 'A wrong target must not be a turn of the figure (use a mirror image or a changed shape)' : null;
}

// ── section rules ──

export const OPTION_LIMITS = { min: 2, max: 4 } as const;
export const VOLUME_LIMITS = { side: { min: 2, max: 12 }, height: { min: 1, max: 12 } } as const;
export const CONE_LIMITS = { radius: { min: 1, max: 12 }, height: { min: 1, max: 12 } } as const;
/** The bounds a typed count or volume must sit in (the prism of the largest case is 1,728 cubic units, the cylinder 1,728 pi). */
export const EULER_BOUNDS = { minimum: '0', maximum: '30' } as const;
export const ARCHIMEDEAN_BOUNDS = { minimum: '0', maximum: '90' } as const;
export const VOLUME_BOUNDS = { minimum: '0', maximum: '1728' } as const;

/** The bounds of a typed count: the Platonic solids top out at 30 edges, the Archimedean ones at 90. */
export const eulerBounds = (solid: EulerSolid): typeof EULER_BOUNDS | typeof ARCHIMEDEAN_BOUNDS => (isPlatonicId(solid) ? EULER_BOUNDS : ARCHIMEDEAN_BOUNDS);

export interface SectionPayload { mode: 'section'; solid: SectionSolid; plane: Plane; options: SectionShape[] }
export interface EulerPayload { mode: 'euler'; solid: EulerSolid; hide: CountName }
export interface VolumePayload { mode: 'volume'; side: number; height: number }
export interface ConePayload { mode: 'cone'; radius: number; height: number }
export interface SlidePayload { mode: 'slide'; solid: SectionSolid; normal: Plane['normal']; start: number; target: SectionShape }
export type SolidSectionPayload = SectionPayload | EulerPayload | VolumePayload | ConePayload | SlidePayload;

function readPlane(value: unknown): Plane | null {
  if (!isRecord(value) || !exactKeys(value, ['normal', 'offset'])) return null;
  const { normal, offset } = value;
  if (!Array.isArray(normal) || normal.length !== 3 || !normal.every((part) => whole(part, -PLANE_LIMITS.normal, PLANE_LIMITS.normal)) || normal.every((part) => part === 0)) return null;
  if (!whole(offset, -PLANE_LIMITS.offset, PLANE_LIMITS.offset)) return null;
  return { normal: [normal[0], normal[1], normal[2]] as [number, number, number], offset };
}

export function readSolidSectionPayload(value: unknown): SolidSectionPayload | null {
  if (!isRecord(value)) return null;
  if (value.mode === 'section') {
    if (!exactKeys(value, ['mode', 'solid', 'plane', 'options']) || !isSectionSolid(value.solid)) return null;
    const plane = readPlane(value.plane);
    const options = value.options;
    if (!plane || !Array.isArray(options) || options.length < OPTION_LIMITS.min || options.length > OPTION_LIMITS.max || !options.every(isSectionShape) || new Set(options).size !== options.length) return null;
    return { mode: 'section', solid: value.solid, plane, options: [...options] as SectionShape[] };
  }
  if (value.mode === 'euler') {
    if (!exactKeys(value, ['mode', 'solid', 'hide']) || !isEulerSolid(value.solid) || !isCountName(value.hide)) return null;
    return { mode: 'euler', solid: value.solid, hide: value.hide };
  }
  if (value.mode === 'volume') {
    if (!exactKeys(value, ['mode', 'side', 'height']) || !whole(value.side, VOLUME_LIMITS.side.min, VOLUME_LIMITS.side.max) || !whole(value.height, VOLUME_LIMITS.height.min, VOLUME_LIMITS.height.max)) return null;
    return { mode: 'volume', side: value.side, height: value.height };
  }
  if (value.mode === 'cone') {
    if (!exactKeys(value, ['mode', 'radius', 'height']) || !whole(value.radius, CONE_LIMITS.radius.min, CONE_LIMITS.radius.max) || !whole(value.height, CONE_LIMITS.height.min, CONE_LIMITS.height.max)) return null;
    return { mode: 'cone', radius: value.radius, height: value.height };
  }
  if (value.mode === 'slide') {
    if (!exactKeys(value, ['mode', 'solid', 'normal', 'start', 'target']) || !isSectionSolid(value.solid) || !isSectionShape(value.target)) return null;
    const plane = readPlane({ normal: value.normal, offset: value.start });
    return plane ? { mode: 'slide', solid: value.solid, normal: plane.normal, start: plane.offset, target: value.target } : null;
  }
  return null;
}

/** The shape the plane cuts from the solid; null when the plane only touches the solid or misses it. */
export const cutShape = (payload: SectionPayload): SectionShape | null => sectionShape(payload.solid, payload.plane);

/** The count the learner types in the Euler question: the hidden one, from V - E + F = 2. */
export const hiddenCount = (payload: EulerPayload): number => EULER_COUNTS[payload.solid][payload.hide];
export const shownCounts = (payload: EulerPayload): CountName[] => COUNT_NAMES.filter((name) => name !== payload.hide);

/** The shape the slide asks for is made by these positions of the plane (none of them the start). */
export const slideSolutions = (payload: SlidePayload): number[] => [...slideShapes(payload.solid, payload.normal)].flatMap(([offset, shape]) => (shape === payload.target ? [offset] : []));

/** The shape the plane makes at `offset`; null when it only touches the solid, misses it or runs into an end cap. */
export const slideCut = (payload: SlidePayload, offset: number): SectionShape | null => sectionShape(payload.solid, { normal: payload.normal, offset });

export type SolidSectionAnswer = { pick: SectionShape } | { target: string };

export function solidSectionAnswer(payload: SolidSectionPayload): SolidSectionAnswer | null {
  if (payload.mode === 'section') {
    const shape = cutShape(payload);
    return shape ? { pick: shape } : null;
  }
  if (payload.mode === 'slide') return { pick: payload.target };
  if (payload.mode === 'euler') return { target: String(hiddenCount(payload)) };
  const volume = payload.mode === 'cone' ? coneVolume(payload.radius, payload.height) : pyramidVolume(payload.side, payload.height);
  return volume === null ? null : { target: String(volume) };
}

function slideProblem(payload: SlidePayload): string | null {
  const shapes = slideShapes(payload.solid, payload.normal);
  const { min, max } = slideRange(payload.solid, payload.normal);
  if (payload.start < min || payload.start > max) return 'The plane must start on the slider';
  if (slideSolutions(payload).length === 0) return 'No position of the plane makes the shape asked for';
  if (shapes.get(payload.start) === payload.target) return 'The plane must not start on the shape asked for';
  const reachable = new Set([...shapes.values()].filter((shape): shape is SectionShape => shape !== null));
  if ([...reachable].some((shape) => shape !== payload.target && ALSO_TRUE[shape].includes(payload.target))) return 'The plane can also make a shape that is the shape asked for (a square is also a rectangle), so one position would be graded two ways';
  return null;
}

export function solidSectionProblem(payload: SolidSectionPayload): string | null {
  if (payload.mode === 'euler') return null;
  if (payload.mode === 'volume') return pyramidVolume(payload.side, payload.height) === null ? 'The base area times the height must divide by 3, so the pyramid has a whole volume' : null;
  if (payload.mode === 'cone') return coneVolume(payload.radius, payload.height) === null ? 'The radius squared times the height must divide by 3, so the cone has a whole volume in pi' : null;
  if (payload.mode === 'slide') return slideProblem(payload);
  const shape = cutShape(payload);
  if (!shape) return sectionCut(payload.solid, payload.plane).clipped ? 'The cut through a cylinder must stay clear of the end caps' : 'The plane must cut through the solid, not just touch it or miss it';
  if (!payload.options.includes(shape)) return 'The options must include the shape of the cut';
  if (payload.options.some((option) => option !== shape && ALSO_TRUE[shape].includes(option))) return 'An option also names the cut (a square is also a rectangle), so the question would have two answers';
  return null;
}
