import type { Vec3 } from './model.js';

/**
 * F4.2 nets of the solids that are not cubes: a rectangular prism, a triangular prism and a square pyramid.
 *
 * The cube engine in net.ts works on cells of a grid, which cannot hold a rectangle that is not a square or a triangle. This
 * one works on the solid itself: a solid is a list of faces and the edges they share, a net is a tree of hinges over the
 * faces, and unfolding a tree puts each face flat next to its parent. Everything the learner is asked is then a question
 * about real geometry (do the panels overlap, which face does this panel fold into, what is the area of all of them), so
 * grading never depends on a stored picture.
 *
 * Lengths are whole numbers so that every area is a whole number of square units (or a half unit for one triangle). The
 * only solid that has an irrational edge is the pyramid's slanted edge, which is never asked for.
 */

export const POLY_KINDS = ['rect-prism', 'tri-prism', 'sq-pyramid'] as const;
export type PolyKind = (typeof POLY_KINDS)[number];
export const POLY_FACE_NAMES = ['top', 'bottom', 'front', 'back', 'left', 'right', 'slope'] as const;
export type PolyFaceName = (typeof POLY_FACE_NAMES)[number];

/** The faces of each solid, in the order every id, slot and panel list uses. */
export const POLY_FACES: Readonly<Record<PolyKind, readonly PolyFaceName[]>> = {
  'rect-prism': ['bottom', 'top', 'front', 'back', 'left', 'right'],
  'tri-prism': ['bottom', 'back', 'slope', 'left', 'right'],
  'sq-pyramid': ['bottom', 'back', 'right', 'front', 'left'],
};
export const POLY_EDGE_COUNT: Readonly<Record<PolyKind, number>> = { 'rect-prism': 12, 'tri-prism': 9, 'sq-pyramid': 8 };

export const POLY_LIMITS = { edge: 20, slant: 30, areaMaximum: 9999 } as const;
/** Label mode gives one or two names; complete mode places at least one hinge and leaves at least two faces to attach. */
export const POLY_LABEL_FIXED = { min: 1, max: 2 } as const;
export const polyCompleteFixed = (kind: PolyKind): { min: number; max: number } => ({ min: 1, max: POLY_FACES[kind].length - 3 });

export const isPolyKind = (value: unknown): value is PolyKind => typeof value === 'string' && (POLY_KINDS as readonly string[]).includes(value);
export const isPolyFaceName = (value: unknown): value is PolyFaceName => typeof value === 'string' && (POLY_FACE_NAMES as readonly string[]).includes(value);

/** A solid as a payload carries it. `dims` is [length, width, height] of a prism, [leg, leg, length] of a triangular prism, [base, slant height] of a pyramid. */
export interface PolySolidSpec { kind: PolyKind; dims: number[] }

const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

/** The hypotenuse of a right triangle with these legs when it is a whole number. */
export function hypotenuse(a: number, b: number): number | null {
  const square = a * a + b * b;
  const root = Math.round(Math.sqrt(square));
  return root * root === square ? root : null;
}

export function readSolidSpec(value: unknown): PolySolidSpec | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join() !== 'dims,kind' || !isPolyKind(record.kind) || !Array.isArray(record.dims)) return null;
  const dims = record.dims as unknown[];
  const { edge, slant } = POLY_LIMITS;
  if (record.kind === 'sq-pyramid') {
    if (dims.length !== 2 || !whole(dims[0], 1, edge) || !whole(dims[1], 1, slant) || 2 * dims[1] <= dims[0]) return null;
  } else {
    if (dims.length !== 3 || !dims.every((part) => whole(part, 1, edge))) return null;
    if (record.kind === 'tri-prism' && hypotenuse(dims[0] as number, dims[1] as number) === null) return null;
  }
  return { kind: record.kind, dims: [...dims] as number[] };
}

type V3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): V3 => { const size = length(a); return [a[0] / size, a[1] / size, a[2] / size]; };
const tidy = (value: number): number => Math.round(value * 1e9) / 1e9 || 0;

export type Pt = readonly [number, number];

/** A length the net displays on a panel: an edge between two corners (positions in the face's corner list) or a height from a corner to the opposite edge. */
export type Measure =
  | { type: 'edge'; from: number; to: number; length: number }
  | { type: 'height'; apex: number; from: number; to: number; length: number };

export interface PolyFace {
  name: PolyFaceName;
  /** Indices into the solid's vertices, counter-clockwise seen from outside. */
  vertices: readonly number[];
  normal: Vec3;
  /** Twice the area, a whole number for every solid this file builds. */
  area2: number;
  measures: readonly Measure[];
}
/** An edge shared by two faces (indices in the solid's face order, lower first). */
export interface PolyEdge { id: number; vertices: readonly [number, number]; faces: readonly [number, number] }
export interface PolySolid {
  kind: PolyKind;
  dims: readonly number[];
  vertices: readonly Vec3[];
  faces: readonly PolyFace[];
  edges: readonly PolyEdge[];
}

type Shape = 'rect' | 'right' | 'isosceles';
interface FaceBlueprint { name: PolyFaceName; vertices: number[]; area2: number; shape: Shape; height?: number }

interface Blueprint { vertices: Vec3[]; faces: FaceBlueprint[] }

function blueprint(spec: PolySolidSpec): Blueprint {
  const [p, q, r] = spec.dims as [number, number, number];
  if (spec.kind === 'rect-prism') {
    const [l, w, h] = [p, q, r];
    return {
      vertices: [[0, 0, 0], [l, 0, 0], [l, 0, w], [0, 0, w], [0, h, 0], [l, h, 0], [l, h, w], [0, h, w]],
      faces: [
        { name: 'bottom', vertices: [0, 1, 2, 3], area2: 2 * l * w, shape: 'rect' },
        { name: 'top', vertices: [4, 5, 6, 7], area2: 2 * l * w, shape: 'rect' },
        { name: 'front', vertices: [3, 2, 6, 7], area2: 2 * l * h, shape: 'rect' },
        { name: 'back', vertices: [0, 1, 5, 4], area2: 2 * l * h, shape: 'rect' },
        { name: 'left', vertices: [0, 3, 7, 4], area2: 2 * w * h, shape: 'rect' },
        { name: 'right', vertices: [1, 2, 6, 5], area2: 2 * w * h, shape: 'rect' },
      ],
    };
  }
  if (spec.kind === 'tri-prism') {
    const [a, b, long] = [p, q, r];
    const c = hypotenuse(a, b) ?? 0;
    return {
      vertices: [[0, 0, 0], [0, 0, a], [0, b, 0], [long, 0, 0], [long, 0, a], [long, b, 0]],
      faces: [
        { name: 'bottom', vertices: [0, 1, 4, 3], area2: 2 * a * long, shape: 'rect' },
        { name: 'back', vertices: [0, 3, 5, 2], area2: 2 * b * long, shape: 'rect' },
        { name: 'slope', vertices: [1, 2, 5, 4], area2: 2 * c * long, shape: 'rect' },
        { name: 'left', vertices: [0, 1, 2], area2: a * b, shape: 'right' },
        { name: 'right', vertices: [3, 4, 5], area2: a * b, shape: 'right' },
      ],
    };
  }
  const [base, slant] = [p, q];
  const rise = Math.sqrt(slant * slant - (base * base) / 4);
  return {
    vertices: [[0, 0, 0], [base, 0, 0], [base, 0, base], [0, 0, base], [base / 2, rise, base / 2]],
    faces: [
      { name: 'bottom', vertices: [0, 1, 2, 3], area2: 2 * base * base, shape: 'rect' },
      { name: 'back', vertices: [0, 1, 4], area2: base * slant, shape: 'isosceles', height: slant },
      { name: 'right', vertices: [1, 2, 4], area2: base * slant, shape: 'isosceles', height: slant },
      { name: 'front', vertices: [2, 3, 4], area2: base * slant, shape: 'isosceles', height: slant },
      { name: 'left', vertices: [3, 0, 4], area2: base * slant, shape: 'isosceles', height: slant },
    ],
  };
}

function measuresOf(vertices: readonly Vec3[], corners: readonly number[], shape: Shape, height: number | undefined): Measure[] {
  const at = (position: number): Vec3 => vertices[corners[position % corners.length]!]!;
  const span = (from: number, to: number): number => tidy(length(sub(at(to), at(from))));
  if (shape === 'rect') return [{ type: 'edge', from: 0, to: 1, length: span(0, 1) }, { type: 'edge', from: 1, to: 2, length: span(1, 2) }];
  if (shape === 'right') {
    const right = corners.findIndex((_, position) => Math.abs(dot(sub(at(position + 1), at(position)), sub(at(position + corners.length - 1), at(position)))) < 1e-9);
    const next = (right + 1) % corners.length;
    const before = (right + corners.length - 1) % corners.length;
    return [{ type: 'edge', from: right, to: next, length: span(right, next) }, { type: 'edge', from: before, to: right, length: span(before, right) }];
  }
  const apex = corners.findIndex((index) => index === vertices.length - 1);
  const first = (apex + 1) % corners.length;
  const second = (apex + 2) % corners.length;
  return [{ type: 'edge', from: first, to: second, length: span(first, second) }, { type: 'height', apex, from: first, to: second, length: height ?? 0 }];
}

const solidCache = new Map<string, PolySolid>();

/** The solid for a spec; null when the spec is not a solid this file can build. Cached because grading and search ask for it often. */
export function buildSolid(spec: PolySolidSpec): PolySolid | null {
  const checked = readSolidSpec(spec);
  if (!checked) return null;
  const key = `${checked.kind}:${checked.dims.join('x')}`;
  const cached = solidCache.get(key);
  if (cached) return cached;
  const { vertices, faces: blueprints } = blueprint(checked);
  const middle: V3 = [0, 1, 2].map((axis) => vertices.reduce((total, vertex) => total + vertex[axis]!, 0) / vertices.length) as V3;
  const faces: PolyFace[] = blueprints.map((entry) => {
    const points = entry.vertices.map((index) => vertices[index]!);
    let normal: V3 = [0, 0, 0];
    for (let at = 0; at < points.length; at += 1) {
      const from = points[at]!;
      const to = points[(at + 1) % points.length]!;
      normal = [normal[0] + (from[1] - to[1]) * (from[2] + to[2]), normal[1] + (from[2] - to[2]) * (from[0] + to[0]), normal[2] + (from[0] - to[0]) * (from[1] + to[1])];
    }
    const centre: V3 = [0, 1, 2].map((axis) => points.reduce((total, point) => total + point[axis]!, 0) / points.length) as V3;
    const outward = dot(normal, sub(centre, middle)) >= 0;
    const corners = outward ? entry.vertices : [...entry.vertices].reverse();
    const direction = unit(outward ? normal : [-normal[0], -normal[1], -normal[2]]);
    return {
      name: entry.name, vertices: corners, normal: direction, area2: entry.area2,
      measures: measuresOf(vertices, corners, entry.shape, entry.height),
    };
  });
  const seen = new Map<string, { vertices: [number, number]; faces: number[] }>();
  faces.forEach((face, faceIndex) => {
    face.vertices.forEach((from, at) => {
      const to = face.vertices[(at + 1) % face.vertices.length]!;
      const edgeKey = from < to ? `${from}:${to}` : `${to}:${from}`;
      const entry = seen.get(edgeKey) ?? { vertices: [Math.min(from, to), Math.max(from, to)] as [number, number], faces: [] };
      entry.faces.push(faceIndex);
      seen.set(edgeKey, entry);
    });
  });
  const edges: PolyEdge[] = [...seen.values()].map((entry, id) => ({ id, vertices: entry.vertices, faces: [Math.min(...entry.faces), Math.max(...entry.faces)] as const }));
  const solid: PolySolid = { kind: checked.kind, dims: checked.dims, vertices, faces, edges };
  if (solidCache.size >= 48) solidCache.clear();
  solidCache.set(key, solid);
  return solid;
}

export const faceIndex = (solid: PolySolid, name: unknown): number => solid.faces.findIndex((face) => face.name === name);
export const faceNames = (solid: PolySolid): PolyFaceName[] => solid.faces.map((face) => face.name);

export function edgeBetween(solid: PolySolid, a: number, b: number): PolyEdge | null {
  return solid.edges.find((edge) => (edge.faces[0] === a && edge.faces[1] === b) || (edge.faces[0] === b && edge.faces[1] === a)) ?? null;
}

/** The slot id of a hinge: the two faces it joins in the solid's face order, such as `bottom-front`. */
export const hingeSlot = (solid: PolySolid, edge: PolyEdge): string => `${solid.faces[edge.faces[0]]!.name}-${solid.faces[edge.faces[1]]!.name}`;
export const hingeSlots = (solid: PolySolid): string[] => solid.edges.map((edge) => hingeSlot(solid, edge));

/** The area of the whole solid in square units. Every solid built here has a whole one. */
export const surfaceAreaOf = (solid: PolySolid): number => solid.faces.reduce((total, face) => total + face.area2, 0) / 2;
export const panelSlot = (index: number): string => `panel${index}`;

/** The flat shape of a face in its own plane, counter-clockwise, aligned with `face.vertices`. */
function flatten(solid: PolySolid, index: number): Pt[] {
  const face = solid.faces[index]!;
  const points = face.vertices.map((vertex) => solid.vertices[vertex]!);
  const origin = points[0]!;
  const along = unit(sub(points[1]!, origin));
  const across = cross(face.normal, along);
  return points.map((point) => { const offset = sub(point, origin); return [tidy(dot(offset, along)), tidy(dot(offset, across))] as const; });
}

export interface Hinge { parent: number; child: number }
export interface Panel { face: number; points: Pt[]; parent: number | null }
export interface Layout { panels: Panel[]; overlaps: [number, number][] }

const EPSILON = 1e-7;

/** Two convex polygons overlap when no side of either one separates them; touching along an edge or at a corner is not overlap. */
export function convexOverlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (const polygon of [a, b]) {
    for (let at = 0; at < polygon.length; at += 1) {
      const from = polygon[at]!;
      const to = polygon[(at + 1) % polygon.length]!;
      const axis: Pt = [from[1] - to[1], to[0] - from[0]];
      const reach = (points: readonly Pt[]) => { const spread = points.map((point) => point[0] * axis[0] + point[1] * axis[1]); return [Math.min(...spread), Math.max(...spread)] as const; };
      const [lowA, highA] = reach(a);
      const [lowB, highB] = reach(b);
      const scale = Math.hypot(axis[0], axis[1]);
      if (highA <= lowB + EPSILON * scale || highB <= lowA + EPSILON * scale) return false;
    }
  }
  return true;
}

/**
 * Lays the hinges flat. The root face keeps its own flat shape and every other face lands on the far side of the hinge from
 * its parent, so all of them show their outside. Null when a hinge is not between two faces that share an edge, a parent is
 * not placed yet, or a face is placed twice.
 */
export function unfold(solid: PolySolid, root: number, hinges: readonly Hinge[]): Layout | null {
  if (!solid.faces[root]) return null;
  const panels: Panel[] = [{ face: root, points: flatten(solid, root), parent: null }];
  const slotOf = new Map<number, number>([[root, 0]]);
  for (const hinge of hinges) {
    const parentSlot = slotOf.get(hinge.parent);
    const edge = edgeBetween(solid, hinge.parent, hinge.child);
    if (parentSlot === undefined || slotOf.has(hinge.child) || !edge || !solid.faces[hinge.child]) return null;
    const parentFace = solid.faces[hinge.parent]!;
    const childFace = solid.faces[hinge.child]!;
    const [u, v] = edge.vertices;
    const parentPoints = panels[parentSlot]!.points;
    const local = flatten(solid, hinge.child);
    const pu = parentPoints[parentFace.vertices.indexOf(u)]!;
    const pv = parentPoints[parentFace.vertices.indexOf(v)]!;
    const lu = local[childFace.vertices.indexOf(u)]!;
    const lv = local[childFace.vertices.indexOf(v)]!;
    const turn = Math.atan2(pv[1] - pu[1], pv[0] - pu[0]) - Math.atan2(lv[1] - lu[1], lv[0] - lu[0]);
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    const points = local.map((point) => {
      const dx = point[0] - lu[0];
      const dy = point[1] - lu[1];
      return [tidy(pu[0] + cos * dx - sin * dy), tidy(pu[1] + sin * dx + cos * dy)] as const;
    });
    slotOf.set(hinge.child, panels.length);
    panels.push({ face: hinge.child, points, parent: parentSlot });
  }
  const overlaps: [number, number][] = [];
  for (let first = 0; first < panels.length; first += 1) for (let second = first + 1; second < panels.length; second += 1) if (convexOverlap(panels[first]!.points, panels[second]!.points)) overlaps.push([first, second]);
  return { panels, overlaps };
}

/** Every hinge of a tree, ordered so each parent comes before its children (walking out from the root, lower edge first). Null unless the edges are a spanning tree. */
export function treeHinges(solid: PolySolid, root: number, edgeIds: readonly number[]): Hinge[] | null {
  if (edgeIds.length !== solid.faces.length - 1) return null;
  const hinges: Hinge[] = [];
  const reached = new Set<number>([root]);
  const queue = [root];
  const sorted = [...edgeIds].sort((a, b) => a - b);
  for (let head = 0; head < queue.length; head += 1) {
    const parent = queue[head]!;
    for (const id of sorted) {
      const edge = solid.edges[id];
      if (!edge || !edge.faces.includes(parent)) continue;
      const child = edge.faces[0] === parent ? edge.faces[1] : edge.faces[0];
      if (reached.has(child)) continue;
      reached.add(child);
      hinges.push({ parent, child });
      queue.push(child);
    }
  }
  return reached.size === solid.faces.length ? hinges : null;
}

const netCache = new Map<string, number[][]>();

/**
 * Every spanning tree of the faces that unfolds without overlap, as sorted edge ids: the complete list of nets of this solid
 * with these lengths. Exhaustive (at most 792 trees to try) and cached.
 */
export function validNetEdgeSets(solid: PolySolid): readonly (readonly number[])[] {
  const key = `${solid.kind}:${solid.dims.join('x')}`;
  const cached = netCache.get(key);
  if (cached) return cached;
  const found: number[][] = [];
  const want = solid.faces.length - 1;
  const pick = (from: number, chosen: number[]) => {
    if (chosen.length === want) {
      const hinges = treeHinges(solid, 0, chosen);
      const layout = hinges ? unfold(solid, 0, hinges) : null;
      if (layout && layout.overlaps.length === 0) found.push([...chosen]);
      return;
    }
    for (let id = from; id < solid.edges.length; id += 1) pick(id + 1, [...chosen, id]);
  };
  pick(0, []);
  if (netCache.size >= 48) netCache.clear();
  netCache.set(key, found);
  return found;
}

export const edgeIdOf = (solid: PolySolid, hinge: Hinge): number => edgeBetween(solid, hinge.parent, hinge.child)?.id ?? -1;

/** The hinge slots of a tree with the face that hangs from each. */
export function hingesToSlots(solid: PolySolid, hinges: readonly Hinge[]): Record<string, string[]> {
  const slots: Record<string, string[]> = {};
  for (const hinge of hinges) {
    const edge = edgeBetween(solid, hinge.parent, hinge.child);
    if (edge) slots[hingeSlot(solid, edge)] = [solid.faces[hinge.child]!.name];
  }
  return slots;
}

/**
 * The hinges a response slot map describes: each slot is an edge of the solid and holds the one face that hangs from it, which
 * must be one of the edge's two faces. Null when a slot is not an edge, holds anything but one face of that edge, or the map is empty.
 */
export function slotsToHinges(solid: PolySolid, slots: unknown): Hinge[] | null {
  if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) return null;
  const byName = new Map(solid.edges.map((edge) => [hingeSlot(solid, edge), edge] as const));
  const hinges: Hinge[] = [];
  for (const [slot, held] of Object.entries(slots)) {
    const edge = byName.get(slot);
    if (!edge || !Array.isArray(held) || held.length > 1) return null;
    if (held.length === 0) continue;
    const child = faceIndex(solid, held[0]);
    if (child < 0 || !edge.faces.includes(child)) return null;
    hinges.push({ parent: edge.faces[0] === child ? edge.faces[1] : edge.faces[0], child });
  }
  return hinges.length > 0 ? hinges.sort((a, b) => edgeIdOf(solid, a) - edgeIdOf(solid, b)) : null;
}

export interface Attached { ordered: Hinge[]; orphans: Hinge[] }

/** Splits hinges into those reachable from the root (ordered so each parent comes first) and those hanging from a face that is not attached. */
export function attach(root: number, hinges: readonly Hinge[]): Attached {
  const placed = new Set<number>([root]);
  const ordered: Hinge[] = [];
  let rest = [...hinges];
  for (let progress = true; progress && rest.length > 0;) {
    progress = false;
    const next: Hinge[] = [];
    for (const hinge of rest) {
      if (placed.has(hinge.parent) && !placed.has(hinge.child)) { placed.add(hinge.child); ordered.push(hinge); progress = true; } else next.push(hinge);
    }
    rest = next;
  }
  return { ordered, orphans: rest };
}

export interface PolyCompletions { count: number; sets: Hinge[][] }

/** The page a net must fit on, in the same units as the lengths. The net keeps the turn it is drawn in; it may sit anywhere on the page. */
export interface Sheet { width: number; height: number }
export const SHEET_LIMITS = { min: 3, max: 60 } as const;

export function layoutBounds(layout: Layout): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = layout.panels.flatMap((panel) => panel.points.map((point) => point[0]));
  const ys = layout.panels.flatMap((panel) => panel.points.map((point) => point[1]));
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function layoutExtent(layout: Layout): { width: number; height: number } {
  const box = layoutBounds(layout);
  return { width: box.maxX - box.minX, height: box.maxY - box.minY };
}

export function fitsSheet(layout: Layout, sheet: Sheet | null): boolean {
  if (!sheet) return true;
  const extent = layoutExtent(layout);
  return extent.width <= sheet.width + 1e-6 && extent.height <= sheet.height + 1e-6;
}

/**
 * Every net of the solid, rooted at `root`, that has these hinges (each face hung from the same face) and fits the sheet.
 * The first `limit` come back as hinge lists out from the root.
 */
export function completionsOf(solid: PolySolid, root: number, fixed: readonly Hinge[], sheet: Sheet | null = null, limit = 8): PolyCompletions {
  const wanted = fixed.map((hinge) => edgeIdOf(solid, hinge));
  const result: PolyCompletions = { count: 0, sets: [] };
  if (wanted.some((id) => id < 0)) return result;
  for (const edgeIds of validNetEdgeSets(solid)) {
    if (!wanted.every((id) => edgeIds.includes(id))) continue;
    const hinges = treeHinges(solid, root, edgeIds)!;
    if (!fixed.every((hinge) => hinges.some((entry) => entry.parent === hinge.parent && entry.child === hinge.child))) continue;
    if (sheet && !fitsSheet(unfold(solid, root, hinges)!, sheet)) continue;
    result.count += 1;
    if (result.sets.length < limit) result.sets.push(hinges);
  }
  return result;
}

/** A named net: the face every other face is unfolded from and the hinges in listing order. The panels of the net follow that order. */
export interface PolyNetDef { id: string; root: PolyFaceName; hinges: readonly (readonly [PolyFaceName, PolyFaceName])[] }

export const POLY_NETS: Readonly<Record<PolyKind, readonly PolyNetDef[]>> = {
  'rect-prism': [
    { id: 'cross', root: 'bottom', hinges: [['bottom', 'front'], ['bottom', 'back'], ['bottom', 'left'], ['bottom', 'right'], ['front', 'top']] },
    { id: 'column', root: 'bottom', hinges: [['bottom', 'front'], ['front', 'top'], ['top', 'back'], ['bottom', 'left'], ['bottom', 'right']] },
    { id: 'strip', root: 'front', hinges: [['front', 'right'], ['right', 'back'], ['back', 'left'], ['front', 'top'], ['front', 'bottom']] },
    { id: 'flag', root: 'front', hinges: [['front', 'right'], ['right', 'back'], ['back', 'left'], ['front', 'top'], ['back', 'bottom']] },
  ],
  'tri-prism': [
    { id: 'row', root: 'bottom', hinges: [['bottom', 'back'], ['bottom', 'slope'], ['bottom', 'left'], ['bottom', 'right']] },
    { id: 'fan', root: 'back', hinges: [['back', 'bottom'], ['bottom', 'slope'], ['back', 'left'], ['back', 'right']] },
    { id: 'split', root: 'slope', hinges: [['slope', 'bottom'], ['bottom', 'back'], ['slope', 'left'], ['bottom', 'right']] },
  ],
  'sq-pyramid': [
    { id: 'star', root: 'bottom', hinges: [['bottom', 'front'], ['bottom', 'back'], ['bottom', 'left'], ['bottom', 'right']] },
    { id: 'chain', root: 'bottom', hinges: [['bottom', 'front'], ['front', 'right'], ['right', 'back'], ['back', 'left']] },
    { id: 'pair', root: 'bottom', hinges: [['bottom', 'front'], ['front', 'right'], ['bottom', 'back'], ['bottom', 'left']] },
  ],
};
export const POLY_NET_IDS: readonly string[] = [...new Set(POLY_KINDS.flatMap((kind) => POLY_NETS[kind].map((net) => net.id)))];

export interface PolyNet {
  id: string;
  solid: PolySolid;
  root: number;
  hinges: Hinge[];
  /** The face each panel shows in the reference folding: the root first, then each hinge's child in listing order. */
  faces: number[];
  layout: Layout;
}

/** A catalogue net on a solid. Null when the id is not this solid's, the hinges do not join faces that touch, or they do not cover every face once. */
export function buildNet(solid: PolySolid, id: unknown): PolyNet | null {
  const def = POLY_NETS[solid.kind].find((entry) => entry.id === id);
  if (!def) return null;
  const root = faceIndex(solid, def.root);
  const hinges = def.hinges.map(([parent, child]) => ({ parent: faceIndex(solid, parent), child: faceIndex(solid, child) }));
  if (root < 0 || hinges.some((hinge) => hinge.parent < 0 || hinge.child < 0)) return null;
  const layout = unfold(solid, root, hinges);
  if (!layout || layout.panels.length !== solid.faces.length) return null;
  return { id: def.id, solid, root, hinges, faces: layout.panels.map((panel) => panel.face), layout };
}

export const netOverlaps = (net: PolyNet): boolean => net.layout.overlaps.length > 0;

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

function congruent(points: readonly Pt[], corners: readonly Vec3[]): boolean {
  if (points.length !== corners.length) return false;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const flat = Math.hypot(points[first]![0] - points[second]![0], points[first]![1] - points[second]![1]);
      if (!near(flat, length(sub(corners[first]!, corners[second]!)))) return false;
    }
  }
  return true;
}

export type PolyLabelling = readonly PolyFaceName[];

/**
 * Every way to name the panels of a net so that folding it makes the solid: put the root panel on any face of the solid in any
 * of its turns, then follow each hinge to the face on the other side of the matching edge and require the shapes to match.
 * A rectangular prism whose three lengths differ has four, a cube-shaped one has twenty-four.
 */
export function polyLabellings(net: PolyNet): PolyLabelling[] {
  const { solid, layout, hinges } = net;
  const found = new Map<string, PolyLabelling>();
  const corner = (face: number, position: number): Vec3 => solid.vertices[solid.faces[face]!.vertices[position]!]!;
  const cornersOf = (face: number): Vec3[] => solid.faces[face]!.vertices.map((_, position) => corner(face, position));
  const rootPanel = layout.panels[0]!;
  solid.faces.forEach((target, rootFace) => {
    const size = target.vertices.length;
    if (size !== rootPanel.points.length) return;
    for (let turn = 0; turn < size; turn += 1) {
      const faceOf: number[] = new Array<number>(layout.panels.length).fill(-1);
      const mapped: number[][] = new Array<number[]>(layout.panels.length);
      const rotated = cornersOf(rootFace).map((_, position, all) => all[(position + turn) % size]!);
      if (!congruent(rootPanel.points, rotated)) continue;
      faceOf[0] = rootFace;
      mapped[0] = target.vertices.map((_, position) => target.vertices[(position + turn) % size]!);
      let ok = true;
      for (const hinge of hinges) {
        const parentPanel = net.faces.indexOf(hinge.parent);
        const childPanel = net.faces.indexOf(hinge.child);
        const edge = edgeBetween(solid, hinge.parent, hinge.child)!;
        const [u, v] = edge.vertices;
        const parentCorners = solid.faces[hinge.parent]!.vertices;
        const childCorners = solid.faces[hinge.child]!.vertices;
        const a = mapped[parentPanel]![parentCorners.indexOf(u)]!;
        const b = mapped[parentPanel]![parentCorners.indexOf(v)]!;
        const across = solid.edges.find((entry) => (entry.vertices[0] === a && entry.vertices[1] === b) || (entry.vertices[0] === b && entry.vertices[1] === a));
        const parentFace = faceOf[parentPanel]!;
        if (!across || !across.faces.includes(parentFace)) { ok = false; break; }
        const childFace = across.faces[0] === parentFace ? across.faces[1] : across.faces[0];
        const targetCorners = solid.faces[childFace]!.vertices;
        if (faceOf.includes(childFace) || targetCorners.length !== childCorners.length) { ok = false; break; }
        const start = childCorners.indexOf(u);
        const place = targetCorners.indexOf(a);
        const row = childCorners.map((_, position) => targetCorners[(place + position - start + childCorners.length * 2) % childCorners.length]!);
        if (row[childCorners.indexOf(v)] !== b || !congruent(layout.panels[childPanel]!.points, row.map((vertex) => solid.vertices[vertex]!))) { ok = false; break; }
        faceOf[childPanel] = childFace;
        mapped[childPanel] = row;
      }
      if (!ok || faceOf.includes(-1) || new Set(faceOf).size !== faceOf.length) continue;
      const names = faceOf.map((face) => solid.faces[face]!.name);
      found.set(names.join(), names);
    }
  });
  return [...found.values()];
}

/** The labellings that keep the names already fixed on some panels (panel index to name). */
export function polyLabelSolutions(net: PolyNet, fixed: Readonly<Record<number, PolyFaceName>>): PolyLabelling[] {
  return polyLabellings(net).filter((labelling) => Object.entries(fixed).every(([panel, name]) => labelling[Number(panel)] === name));
}

/** The labelling of the reference folding itself: the name of the face each panel was cut from. */
export const referenceLabelling = (net: PolyNet): PolyLabelling => net.faces.map((face) => net.solid.faces[face]!.name);

export function slotsToPanelNames(slots: unknown, panels: number): PolyLabelling | null {
  if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) return null;
  const names: PolyFaceName[] = [];
  for (let index = 0; index < panels; index += 1) {
    const held = (slots as Record<string, unknown>)[panelSlot(index)];
    if (!Array.isArray(held) || held.length !== 1 || !isPolyFaceName(held[0])) return null;
    names.push(held[0]);
  }
  return names;
}

/** Twice the area of each face of the solid: a whole number for every face, even a triangle of odd leg product. */
export const faceAreas2 = (solid: PolySolid): number[] => solid.faces.map((face) => face.area2);

/**
 * Why a wrong total is wrong, given twice the area of each face: it is the sum of some of the faces but not all of them
 * (`miss`), the whole area plus one more face (`false_alarm`), or neither (`value`). An answer equal to the total is not asked here.
 */
export function areaDiagnosis(areas2: readonly number[], amount: number): 'miss' | 'false_alarm' | 'value' {
  const doubled = amount * 2;
  if (!Number.isFinite(doubled) || Math.abs(doubled - Math.round(doubled)) > 1e-9) return 'value';
  const target = Math.round(doubled);
  const total = areas2.reduce((sum, area) => sum + area, 0);
  if (areas2.some((area) => total + area === target)) return 'false_alarm';
  for (let mask = 1; mask < 2 ** areas2.length - 1; mask += 1) {
    if (areas2.reduce((sum, area, index) => sum + ((mask >> index) & 1 ? area : 0), 0) === target) return 'miss';
  }
  return 'value';
}

/** The amount a number response writes: a decimal or a fraction, the two spellings the number shape accepts. */
export function amountOf(text: string): number | null {
  if (/^-?\d{1,12}(\.\d{1,12})?$/.test(text)) return Number(text);
  const fraction = /^(-?\d{1,12})\/(\d{1,12})$/.exec(text);
  return fraction && Number(fraction[2]) !== 0 ? Number(fraction[1]) / Number(fraction[2]) : null;
}
