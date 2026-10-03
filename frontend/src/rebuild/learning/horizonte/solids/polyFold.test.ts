import { describe, expect, it } from 'vitest';
import type { Vec3 } from './model.generated';
import { POLY_KINDS, POLY_NETS, buildNet, buildSolid, type PolySolidSpec } from './polynet.generated';
import { FOLD_STEPS, cellFoldPanels, foldRig, foldWindow, poseOf, polyFoldPanels, projectPose } from './polyFold';

const SPECS: Record<(typeof POLY_KINDS)[number], PolySolidSpec> = {
  'rect-prism': { kind: 'rect-prism', dims: [4, 3, 2] },
  'tri-prism': { kind: 'tri-prism', dims: [3, 4, 5] },
  'sq-pyramid': { kind: 'sq-pyramid', dims: [6, 5] },
};

const distinct = (corners: readonly Vec3[]) => new Set(corners.map((corner) => corner.map((part) => Math.round(part * 1e5) / 1e5 || 0).join())).size;
const spread = (corners: readonly Vec3[]) => corners.flatMap((first, at) => corners.slice(at + 1).map((second) => Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2])));

describe('fold of a polyhedron net', () => {
  for (const kind of POLY_KINDS) {
    const solid = buildSolid(SPECS[kind])!;
    for (const def of POLY_NETS[kind]) {
      const net = buildNet(solid, def.id)!;
      const rig = foldRig(polyFoldPanels(solid, net.layout));

      it(`${kind} ${def.id}: lies flat at the start`, () => {
        const flat = poseOf(rig, 0);
        flat.forEach((corners, index) => corners.forEach((corner, at) => {
          expect(corner[2]).toBeCloseTo(0, 9);
          expect(corner[0]).toBeCloseTo(net.layout.panels[index]!.points[at]![0], 9);
          expect(corner[1]).toBeCloseTo(net.layout.panels[index]!.points[at]![1], 9);
        }));
      });

      it(`${kind} ${def.id}: closes into the solid, every shared corner meeting`, () => {
        const closed = poseOf(rig, 1);
        const byVertex = new Map<number, Vec3[]>();
        closed.forEach((corners, index) => corners.forEach((corner, at) => {
          const vertex = solid.faces[net.layout.panels[index]!.face]!.vertices[at]!;
          byVertex.set(vertex, [...(byVertex.get(vertex) ?? []), corner]);
        }));
        expect(byVertex.size).toBe(solid.vertices.length);
        for (const corners of byVertex.values()) expect(distinct(corners)).toBe(1);
        expect(distinct(closed.flat())).toBe(solid.vertices.length);
      });

      it(`${kind} ${def.id}: keeps every panel rigid on the way`, () => {
        const flat = poseOf(rig, 0).map(spread);
        for (const t of [0.3, 0.7, 1]) poseOf(rig, t).forEach((corners, index) => spread(corners).forEach((value, at) => expect(value).toBeCloseTo(flat[index]![at]!, 8)));
      });
    }
  }

  it('closes a cube net made of squares on a grid', () => {
    const panels = cellFoldPanels([[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], 3)!;
    expect(panels).toHaveLength(6);
    expect(panels[0]!.parent).toBeNull();
    const closed = poseOf(foldRig(panels), 1);
    expect(distinct(closed.flat())).toBe(8);
    expect(distinct(poseOf(foldRig(panels), 0).flat())).toBeGreaterThan(8);
  });

  it('refuses squares that are not joined edge to edge', () => {
    expect(cellFoldPanels([[0, 0], [2, 0]], 1)).toBeNull();
    expect(cellFoldPanels([], 1)).toBeNull();
  });

  it('draws the far panels first and keeps one window for the whole fold', () => {
    const solid = buildSolid(SPECS['rect-prism'])!;
    const rig = foldRig(polyFoldPanels(solid, buildNet(solid, 'cross')!.layout));
    for (const t of [0, 0.5, 1]) {
      const drawn = projectPose(poseOf(rig, t), t);
      expect(drawn).toHaveLength(6);
      expect(drawn.map((panel) => panel.depth)).toEqual([...drawn.map((panel) => panel.depth)].sort((a, b) => a - b));
    }
    const window = foldWindow(rig);
    for (let step = 0; step <= FOLD_STEPS; step += 1) {
      for (const panel of projectPose(poseOf(rig, step / FOLD_STEPS), step / FOLD_STEPS)) for (const [x, y] of panel.points) {
        expect(x).toBeGreaterThanOrEqual(window.minX - 1e-9);
        expect(x).toBeLessThanOrEqual(window.maxX + 1e-9);
        expect(y).toBeGreaterThanOrEqual(window.minY - 1e-9);
        expect(y).toBeLessThanOrEqual(window.maxY + 1e-9);
      }
    }
  });

  it('shows the outside of every panel while the net is flat', () => {
    const solid = buildSolid(SPECS['sq-pyramid'])!;
    const rig = foldRig(polyFoldPanels(solid, buildNet(solid, 'star')!.layout));
    expect(projectPose(poseOf(rig, 0), 0).every((panel) => panel.outside)).toBe(true);
  });
});
