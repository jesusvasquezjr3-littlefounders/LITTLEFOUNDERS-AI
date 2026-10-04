import type { Vec3 } from './model.generated';
import type { Layout, Pt, PolySolid } from './polynet.generated';

/*
 * The fold of a net: every panel hangs from its parent by a hinge, and folding turns each hinge by its angle (how far the two
 * faces bend to meet at the solid's edge). Pose t=0 is the flat net, t=1 the closed solid; a pose in between turns every hinge
 * by the same share, so the learner can scrub through the fold. Pure functions, no DOM.
 */

/** A panel in the flat net: its corners (counter-clockwise, y up), the panel it hangs from, and how far that hinge turns when closed. */
export interface FoldPanel { points: readonly Pt[]; parent: number | null; angle: number }

/** Rotation (row-major 3x3) followed by a translation. */
type Frame = readonly number[];

const IDENTITY: Frame = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const place = (f: Frame, p: Vec3): Vec3 => [
  f[0]! * p[0] + f[1]! * p[1] + f[2]! * p[2] + f[9]!,
  f[3]! * p[0] + f[4]! * p[1] + f[5]! * p[2] + f[10]!,
  f[6]! * p[0] + f[7]! * p[1] + f[8]! * p[2] + f[11]!,
];

/** `a` applied after `b`. */
function compose(a: Frame, b: Frame): Frame {
  const rotation: number[] = [];
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) rotation.push(a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!);
  const shift = place(a, [b[9]!, b[10]!, b[11]!]);
  return [...rotation, ...shift];
}

/** A turn of `angle` around the line through `origin` along the unit vector `axis` (Rodrigues). */
function turn(origin: Vec3, axis: Vec3, angle: number): Frame {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const k = 1 - c;
  const [x, y, z] = axis;
  const rotation = [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  const spun = [0, 1, 2].map((row) => rotation[row * 3]! * origin[0] + rotation[row * 3 + 1]! * origin[1] + rotation[row * 3 + 2]! * origin[2]);
  return [...rotation, origin[0] - spun[0]!, origin[1] - spun[1]!, origin[2] - spun[2]!];
}

const NEAR = 1e-6;

/** The two corners a panel shares with its parent: the hinge line in the flat net. */
function sharedEdge(panel: FoldPanel, parent: FoldPanel): readonly [Pt, Pt] | null {
  const shared = panel.points.filter((point) => parent.points.some((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) < NEAR));
  return shared.length >= 2 ? [shared[0]!, shared[1]!] : null;
}

interface Hinge { origin: Vec3; axis: Vec3; sign: 1 | -1; angle: number }

/** The folding of a net. A panel folds away from the viewer, so the solid ends up behind the flat net. */
export interface FoldRig { panels: readonly FoldPanel[]; hinges: ReadonlyArray<Hinge | null> }

export function foldRig(panels: readonly FoldPanel[]): FoldRig {
  const hinges = panels.map((panel): Hinge | null => {
    const parent = panel.parent === null ? null : panels[panel.parent];
    const edge = parent ? sharedEdge(panel, parent) : null;
    if (!edge) return null;
    const [from, to] = edge;
    const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const axis: Vec3 = [(to[0] - from[0]) / span, (to[1] - from[1]) / span, 0];
    const centre = panel.points.reduce<Pt>((sum, point) => [sum[0] + point[0] / panel.points.length, sum[1] + point[1] / panel.points.length], [0, 0]);
    const side = axis[0] * (centre[1] - from[1]) - axis[1] * (centre[0] - from[0]);
    return { origin: [from[0], from[1], 0], axis, sign: side > 0 ? -1 : 1, angle: panel.angle };
  });
  return { panels, hinges };
}

/** The corners of every panel in 3D when each hinge has turned `t` (0 to 1) of the way to closed. */
export function poseOf(rig: FoldRig, t: number): Vec3[][] {
  const frames: Array<Frame | undefined> = [];
  const frameOf = (index: number): Frame => {
    const known = frames[index];
    if (known) return known;
    const panel = rig.panels[index]!;
    const hinge = rig.hinges[index];
    const parent = panel.parent === null ? IDENTITY : frameOf(panel.parent);
    const frame = hinge ? compose(parent, turn(hinge.origin, hinge.axis, hinge.sign * hinge.angle * t)) : parent;
    frames[index] = frame;
    return frame;
  };
  return rig.panels.map((panel, index) => panel.points.map((point) => place(frameOf(index), [point[0], point[1], 0])));
}

/** How the net is seen: the camera swings by yaw (around the vertical) then pitch (around the horizontal) as the fold closes. */
export interface FoldView { yaw: number; pitch: number }
export const FOLD_VIEW: FoldView = { yaw: -0.6, pitch: 0.5 };
export const FOLD_STEPS = 10;

export interface FoldedPanel {
  index: number;
  /** Corners on the screen (y down), in the units of the net. */
  points: Pt[];
  centre: Pt;
  /** Larger is nearer the viewer. */
  depth: number;
  /** True while the outside of the panel faces the viewer. */
  outside: boolean;
  shade: 0 | 1 | 2 | 3;
}

const LIGHT: Vec3 = [-0.35, 0.55, 0.76];
const norm = Math.hypot(...LIGHT);

/** The panels as drawn at pose `t`, far ones first so a painter can draw them in order. */
export function projectPose(pose: readonly (readonly Vec3[])[], t: number, view: FoldView = FOLD_VIEW): FoldedPanel[] {
  const [cy, sy, cx, sx] = [Math.cos(view.yaw * t), Math.sin(view.yaw * t), Math.cos(view.pitch * t), Math.sin(view.pitch * t)];
  const look = (p: Vec3): Vec3 => {
    const x = p[0] * cy + p[2] * sy;
    const z = -p[0] * sy + p[2] * cy;
    return [x, p[1] * cx - z * sx, p[1] * sx + z * cx];
  };
  return pose.map((corners, index): FoldedPanel => {
    const seen = corners.map(look);
    const [a, b, c] = [seen[0]!, seen[1]!, seen[2]!];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    const normal: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const size = Math.hypot(...normal) || 1;
    const lit = Math.max(0, (normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]) / (size * norm));
    const points = seen.map((p): Pt => [p[0], -p[1]]);
    return {
      index, points,
      centre: [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length],
      depth: seen.reduce((sum, p) => sum + p[2], 0) / seen.length,
      outside: normal[2] > 0,
      shade: Math.min(3, Math.floor(lit * 4)) as 0 | 1 | 2 | 3,
    };
  }).sort((first, second) => first.depth - second.depth);
}

/** One fixed window for the whole fold, so scrubbing never rescales the picture. */
export function foldWindow(rig: FoldRig, view: FoldView = FOLD_VIEW): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let step = 0; step <= FOLD_STEPS; step += 1) {
    for (const panel of projectPose(poseOf(rig, step / FOLD_STEPS), step / FOLD_STEPS, view)) for (const point of panel.points) { xs.push(point[0]); ys.push(point[1]); }
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

/** The panels of an unfolded layout of a solid, each hinge turning by the angle between the two faces' outward normals. */
export function polyFoldPanels(solid: PolySolid, layout: Layout): FoldPanel[] {
  return layout.panels.map((panel) => {
    const parent = panel.parent === null ? null : layout.panels[panel.parent]!;
    const [a, b] = [solid.faces[panel.face]!.normal, parent ? solid.faces[parent.face]!.normal : null];
    return { points: panel.points, parent: panel.parent, angle: b ? Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) : 0 };
  });
}

/**
 * The squares of a cube net on a grid, hung from the first square along shared sides, every hinge a right angle. Panel `i` is
 * cell `i`. Null when the squares are not joined edge to edge.
 */
export function cellFoldPanels(cells: ReadonlyArray<readonly [number, number]>, edge: number): FoldPanel[] | null {
  if (cells.length === 0) return null;
  const parents = new Array<number | null | undefined>(cells.length).fill(undefined);
  parents[0] = null;
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const here = cells[queue[head]!]!;
    cells.forEach((other, index) => {
      if (parents[index] === undefined && Math.abs(other[0] - here[0]) + Math.abs(other[1] - here[1]) === 1) { parents[index] = queue[head]!; queue.push(index); }
    });
  }
  if (parents.some((parent) => parent === undefined)) return null;
  return cells.map(([col, row], index) => {
    const [x, y] = [col * edge, -row * edge];
    return { points: [[x, y - edge], [x + edge, y - edge], [x + edge, y], [x, y]] as const, parent: parents[index]!, angle: Math.PI / 2 };
  });
}
