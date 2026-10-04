import { projectPoint, viewBasis, type Lens, type SolidView } from '../solids/projection.js';
import type { Vec3 } from '../solids/model.js';

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

/** `curved` marks a solid drawn as a ring of flat strips (a cylinder, a cone): the seams between strips are not edges. */
export interface PolyMesh { vertices: readonly Vec3[]; faces: readonly (readonly number[])[]; edges: readonly (readonly [number, number])[]; curved?: boolean }
export interface PolyCounts { vertices: number; edges: number; faces: number }

/** V, E, F of each Platonic solid: the numbers the Euler question reads; `polyCounts(mesh)` must agree (tested). */
export const PLATONIC_COUNTS: Readonly<Record<PlatonicId, PolyCounts>> = {
  tetrahedron: { vertices: 4, edges: 6, faces: 4 },
  cube: { vertices: 8, edges: 12, faces: 6 },
  octahedron: { vertices: 6, edges: 12, faces: 8 },
  dodecahedron: { vertices: 20, edges: 30, faces: 12 },
  icosahedron: { vertices: 12, edges: 30, faces: 20 },
};

/** V, E, F of the Archimedean solids offered to the Euler question; `polyCounts(mesh)` must agree (tested). */
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

/** The corners of a vertex figure in order round the vertex: sorted by angle about the axis from the centre of the solid through it. */
function aroundVertex(vertices: readonly Vec3[], corner: Vec3, members: readonly number[]): number[] {
  const l = length(corner);
  const axis: Vec3 = [corner[0] / l, corner[1] / l, corner[2] / l];
  const u = cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  const v = cross(axis, u);
  const centre = centroidOf(members.map((index) => vertices[index]!));
  const angle = (index: number) => { const p = sub(vertices[index]!, centre); return Math.atan2(dot(p, v), dot(p, u)); };
  return [...members].sort((a, b) => angle(a) - angle(b));
}

/** Every corner cut off a third of the way along each edge: a 2n-gon for each n-gon face and an n-gon for each corner. */
function truncated(base: PolyMesh): PolyMesh {
  const vertices: Vec3[] = [];
  const slot = new Map<string, number>();
  const cut = (from: number, to: number): number => {
    const key = `${from}:${to}`;
    if (!slot.has(key)) {
      const a = base.vertices[from]!;
      const b = base.vertices[to]!;
      slot.set(key, vertices.push([a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[2] + (b[2] - a[2]) / 3]) - 1);
    }
    return slot.get(key)!;
  };
  const faces: number[][] = base.faces.map((face) => face.flatMap((from, at) => { const to = face[(at + 1) % face.length]!; return [cut(from, to), cut(to, from)]; }));
  base.vertices.forEach((corner, index) => {
    const members = base.edges.flatMap(([a, b]) => (a === index ? [cut(index, b)] : b === index ? [cut(index, a)] : []));
    faces.push(aroundVertex(vertices, corner, members));
  });
  return mesh(vertices, faces);
}

/** Every corner cut down to the middle of its edges: the edge midpoints are the corners, with one face for each face and for each corner. */
function rectified(base: PolyMesh): PolyMesh {
  const vertices: Vec3[] = base.edges.map(([a, b]) => centroidOf([base.vertices[a]!, base.vertices[b]!]));
  const slot = new Map(base.edges.map(([a, b], index) => [`${a}:${b}`, index] as const));
  const middle = (a: number, b: number): number => slot.get(a < b ? `${a}:${b}` : `${b}:${a}`)!;
  const faces: number[][] = base.faces.map((face) => face.map((from, at) => middle(from, face[(at + 1) % face.length]!)));
  base.vertices.forEach((corner, index) => {
    const members = base.edges.flatMap(([a, b], at) => (a === index || b === index ? [at] : []));
    faces.push(aroundVertex(vertices, corner, members));
  });
  return mesh(vertices, faces);
}

const BUILDERS: Readonly<Record<EulerSolid, () => PolyMesh>> = {
  tetrahedron,
  cube: () => box(1, 1, 1),
  octahedron,
  dodecahedron,
  icosahedron,
  'truncated-tetrahedron': () => truncated(tetrahedron()),
  cuboctahedron: () => rectified(box(1, 1, 1)),
  'truncated-octahedron': () => truncated(octahedron()),
  icosidodecahedron: () => rectified(icosahedron()),
  'truncated-icosahedron': () => truncated(icosahedron()),
};

const cache = new Map<EulerSolid, PolyMesh>();
export function eulerMesh(id: EulerSolid): PolyMesh {
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id)!;
}
export const platonicMesh = (id: PlatonicId): PolyMesh => eulerMesh(id);

const RING = 48;
const ringOf = (radius: number, y: number): Vec3[] => Array.from({ length: RING }, (_, at) => [radius * Math.cos((2 * Math.PI * at) / RING), y, radius * Math.sin((2 * Math.PI * at) / RING)] as const);

/** A round cylinder of the given radius and height on the y axis, drawn as a ring of 48 flat strips between two flat caps. */
export function cylinderMesh(radius: number, height: number): PolyMesh {
  const vertices = [...ringOf(radius, -height / 2), ...ringOf(radius, height / 2)];
  const faces: number[][] = Array.from({ length: RING }, (_, at) => [at, (at + 1) % RING, RING + ((at + 1) % RING), RING + at]);
  faces.push(Array.from({ length: RING }, (_, at) => at), Array.from({ length: RING }, (_, at) => RING + at));
  return { ...mesh(vertices, faces), curved: true };
}

/** A round cone of the given radius and height on the y axis: a flat base and an apex over its middle. */
export function coneMesh(radius: number, height: number): PolyMesh {
  const vertices = [...ringOf(radius, -height / 2), [0, height / 2, 0] as const];
  const faces: number[][] = Array.from({ length: RING }, (_, at) => [at, (at + 1) % RING, RING]);
  faces.push(Array.from({ length: RING }, (_, at) => at));
  return { ...mesh(vertices, faces), curved: true };
}

/** The cylinder the plane cuts: radius 1 and height 3, so a cut along its axis is a 2 by 3 rectangle and never a square. */
export const CYLINDER = { radius: 1, half: 1.5 } as const;

let cylinderSolid: PolyMesh | null = null;
export function sectionSolidMesh(solid: SectionSolid): PolyMesh {
  if (solid !== 'cylinder') return platonicMesh(solid);
  cylinderSolid ??= cylinderMesh(CYLINDER.radius, CYLINDER.half * 2);
  return cylinderSolid;
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

/** The unit normal of a plane and two unit directions across it. */
function planeFrame(plane: Plane): { axis: Vec3; e1: Vec3; e2: Vec3 } {
  const normal = plane.normal as Vec3;
  const n = length(normal);
  const axis: Vec3 = [normal[0] / n, normal[1] / n, normal[2] / n];
  const helper: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(axis, helper);
  const ul = length(u);
  const e1: Vec3 = [u[0] / ul, u[1] / ul, u[2] / ul];
  return { axis, e1, e2: cross(axis, e1) };
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
  const { e1, e2 } = planeFrame(plane);
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

/** A solid's facing flags and its projected corners for one fixed view: what the SVG board draws. */
export interface PolyScene {
  polygons: { face: number; points: ReadonlyArray<readonly [number, number]>; shade: 0 | 1 | 2 | 3 }[];
  edges: { from: readonly [number, number]; to: readonly [number, number]; hidden: boolean }[];
  corners: ReadonlyArray<readonly [number, number]>;
  cut: { points: ReadonlyArray<readonly [number, number]>; hiddenEdges: boolean[] } | null;
  /** A square of the cutting plane about the solid, so a plane that misses the solid can still be seen; only when asked for. */
  sheet: ReadonlyArray<readonly [number, number]> | null;
  curved: boolean;
}

/** Two strips of a curved solid meet in a seam, not an edge, when their normals differ by less than this. */
const SEAM = Math.cos((15 * Math.PI) / 180);

const round = (value: number): number => Math.round(value * 100) / 100;

export function lensFor(solid: PolyMesh, reach = 96): Lens {
  const radius = Math.max(...solid.vertices.map((vertex) => length(vertex)), 1e-6);
  return { mode: 'orthographic', scale: reach / radius };
}

function shadeOf(normal: Vec3, view: SolidView): 0 | 1 | 2 | 3 {
  const basis = viewBasis(view);
  const light: Vec3 = [0.3 * basis.right[0] + 0.55 * basis.up[0] + 0.78 * basis.toward[0], 0.3 * basis.right[1] + 0.55 * basis.up[1] + 0.78 * basis.toward[1], 0.3 * basis.right[2] + 0.55 * basis.up[2] + 0.78 * basis.toward[2]];
  const l = length(light);
  const lit = dot(normal, [light[0] / l, light[1] / l, light[2] / l]);
  return lit > 0.8 ? 0 : lit > 0.55 ? 1 : lit > 0.3 ? 2 : 3;
}

/**
 * One convex solid in one fixed view (orthographic, scaled so it fills the scene): the faces that face the viewer, the
 * visible and hidden edges, and, when a plane is given, the cut drawn on top with the sides that lie on hidden faces marked.
 */
export function composePolyScene(solid: PolyMesh, view: SolidView, options: { lens?: Lens; plane?: Plane; sheet?: boolean } = {}): PolyScene {
  const lens = options.lens ?? lensFor(solid);
  const basis = viewBasis(view);
  const projected = solid.vertices.map((vertex) => projectPoint(vertex, view, lens));
  const normals = solid.faces.map((face) => faceNormalOf(solid, face));
  const facing = normals.map((normal) => dot(normal, basis.toward) > 1e-6);
  const polygons = solid.faces.flatMap((face, index) => (facing[index] ? [{
    face: index, shade: shadeOf(normals[index]!, view), points: face.map((corner) => [round(projected[corner]!.x), round(projected[corner]!.y)] as const),
  }] : []));
  const faceOfEdge = new Map<string, number[]>();
  solid.faces.forEach((face, index) => face.forEach((from, at) => {
    const to = face[(at + 1) % face.length]!;
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    faceOfEdge.set(key, [...(faceOfEdge.get(key) ?? []), index]);
  }));
  const edges = solid.edges.flatMap(([a, b]) => {
    const owners = faceOfEdge.get(`${a}:${b}`) ?? [];
    const seam = solid.curved === true && owners.length === 2 && dot(normals[owners[0]!]!, normals[owners[1]!]!) > SEAM;
    if (seam && facing[owners[0]!] === facing[owners[1]!]) return [];
    return [{ from: [round(projected[a]!.x), round(projected[a]!.y)] as const, to: [round(projected[b]!.x), round(projected[b]!.y)] as const, hidden: !seam && owners.every((owner) => !facing[owner]) }];
  });
  edges.sort((x, y) => Number(y.hidden) - Number(x.hidden));
  let cut: PolyScene['cut'] = null;
  const polygon = options.plane ? sectionPolygon(solid, options.plane) : null;
  if (polygon) {
    const points = polygon.map((point) => projectPoint(point, view, lens));
    const hiddenEdges = polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      const middle: Vec3 = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2, (point[2] + next[2]) / 2];
      const owner = solid.faces.findIndex((face, at) => Math.abs(dot(normals[at]!, sub(middle, solid.vertices[face[0]!]!))) < 1e-7);
      return owner < 0 ? false : !facing[owner]!;
    });
    cut = { points: points.map((point) => [round(point.x), round(point.y)] as const), hiddenEdges };
  }
  let sheet: PolyScene['sheet'] = null;
  if (options.plane && options.sheet) {
    const { axis, e1, e2 } = planeFrame(options.plane);
    const reach = 0.9 * Math.max(...solid.vertices.map((vertex) => length(vertex)));
    const foot = options.plane.offset / OFFSET_UNIT / length(options.plane.normal as Vec3);
    sheet = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => {
      const point = projectPoint([axis[0] * foot + (e1[0] * x + e2[0] * y) * reach, axis[1] * foot + (e1[1] * x + e2[1] * y) * reach, axis[2] * foot + (e1[2] * x + e2[2] * y) * reach], view, lens);
      return [round(point.x), round(point.y)] as const;
    });
  }
  return { polygons, edges, corners: projected.map((point) => [round(point.x), round(point.y)] as const), cut, sheet, curved: solid.curved === true };
}
