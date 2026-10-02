import { describe, expect, it } from 'vitest';
import { COUNT_KINDS, SOLID_COUNTS, SOLID_IDS, countOf, describeSolid, faceCentroid, faceNormal, meshCounts, solidMesh, solidsWithCount } from '../../services/horizonte/solids/model.js';
import {
  ARROW_STEPS, DEFAULT_VIEW, ORTHOGRAPHIC_LENS, PERSPECTIVE_LENS, SCENE_CENTER, VIEW_KEYS, cameraPose, composeScene, labelNames, parseViewKey, projectPoint, stepView, viewBasis, viewKey,
  type SolidView,
} from '../../services/horizonte/solids/projection.js';
import { composeStackScene, frontView, isHeights, matchesGoal, planView, sideView, slotsToStack, solveStack, stackContext, stackToSlots, stackTotal } from '../../services/horizonte/solids/stack.js';
import { FACE_NAMES, OPPOSITE, allLabellings, completions, foldNormals, isCubeNet, labelSolutions, netBounds, surfaceArea, type NetCell } from '../../services/horizonte/solids/net.js';

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const views = (): SolidView[] => VIEW_KEYS.map((key) => parseViewKey(key)!);

describe('solids engine: the four solids', () => {
  it('has meshes whose real counts are the teaching counts', () => {
    for (const id of SOLID_IDS) expect(meshCounts(solidMesh(id)), id).toEqual(SOLID_COUNTS[id]);
  });

  it('obeys Euler for the polyhedra and gives every solid a distinct count profile', () => {
    for (const id of ['cube', 'prism', 'pyramid'] as const) expect(SOLID_COUNTS[id].vertices - SOLID_COUNTS[id].edges + SOLID_COUNTS[id].faces, id).toBe(2);
    for (const kind of COUNT_KINDS) expect(new Set(SOLID_IDS.map((id) => countOf(id, kind))).size, kind).toBe(SOLID_IDS.length - (kind === 'faces' ? 1 : 0));
    expect(solidsWithCount('edges', 9)).toEqual(['prism']);
    expect(solidsWithCount('vertices', 0)).toEqual(['cylinder']);
    expect(solidsWithCount('faces', 5)).toEqual(['prism', 'pyramid']);
  });

  it('winds every face counter-clockwise from outside and stays under the 3D budget', () => {
    for (const id of SOLID_IDS) {
      const mesh = solidMesh(id);
      for (const face of mesh.faces) expect(dot(faceNormal(mesh, face), faceCentroid(mesh, face)), `${id} ${face.key}`).toBeGreaterThan(0);
      const triangles = mesh.faces.reduce((sum, face) => sum + face.corners.length - 2, 0);
      expect(triangles).toBeLessThanOrEqual(10_000);
      for (const edge of mesh.edges) expect(edge.faces[0]).not.toBe(edge.faces[1]);
    }
  });

  it('describes a solid for the table view', () => {
    expect(describeSolid('cylinder')).toMatchObject({ faces: 3, flatFaces: 2, curvedFaces: 1, edges: 2, curvedEdges: 2, vertices: 0 });
    expect(describeSolid('cube')).toMatchObject({ flatFaces: 6, curvedFaces: 0, straightEdges: 12 });
  });
});

describe('solids engine: fixed views and projection', () => {
  it('snaps by one step per arrow key and never leaves the twelve views', () => {
    expect(views()).toHaveLength(12);
    expect(stepView(DEFAULT_VIEW, 'right')).toEqual({ yaw: 1, pitch: 1 });
    expect(stepView({ yaw: 0, pitch: 1 }, 'left')).toEqual({ yaw: 3, pitch: 1 });
    expect(stepView({ yaw: 3, pitch: 0 }, 'right')).toEqual({ yaw: 0, pitch: 0 });
    expect(stepView({ yaw: 2, pitch: 2 }, 'up')).toEqual({ yaw: 2, pitch: 2 });
    expect(stepView({ yaw: 2, pitch: 0 }, 'down')).toEqual({ yaw: 2, pitch: 0 });
    expect(Object.keys(ARROW_STEPS)).toEqual(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
    for (const view of views()) {
      expect(parseViewKey(viewKey(view))).toEqual(view);
      for (const step of ['left', 'right', 'up', 'down'] as const) expect(VIEW_KEYS).toContain(viewKey(stepView(view, step)));
    }
    expect(parseViewKey('level-9')).toBeNull();
    expect(parseViewKey(3)).toBeNull();
  });

  it('keeps an orthonormal right-handed camera basis in every view', () => {
    for (const view of views()) {
      const { right, up, toward } = viewBasis(view);
      for (const axis of [right, up, toward]) expect(Math.hypot(...axis)).toBeCloseTo(1, 9);
      expect(dot(right, up)).toBeCloseTo(0, 9);
      expect(dot(right, toward)).toBeCloseTo(0, 9);
      expect(dot(up, toward)).toBeCloseTo(0, 9);
      const cross = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
      cross.forEach((part, axis) => expect(part).toBeCloseTo(toward[axis]!, 9));
    }
  });

  it('puts the 3D camera where the SVG projection assumes it is', () => {
    for (const view of views()) {
      const pose = cameraPose(view, 6);
      expect(Math.hypot(...pose.position)).toBeCloseTo(6, 9);
      expect(dot(pose.position, pose.up)).toBeCloseTo(0, 9);
      const centre = projectPoint([0, 0, 0], view, PERSPECTIVE_LENS);
      expect(centre.x).toBeCloseTo(SCENE_CENTER, 9);
      expect(centre.y).toBeCloseTo(SCENE_CENTER, 9);
    }
  });

  it('draws a cube from the front as one square and from a corner as three faces', () => {
    const front = composeScene('cube', { yaw: 0, pitch: 0 });
    expect(front.polygons).toHaveLength(1);
    const xs = front.polygons[0]!.points.map((point) => point[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(ORTHOGRAPHIC_LENS.mode === 'orthographic' ? ORTHOGRAPHIC_LENS.scale : 0, 1);
    const corner = composeScene('cube', DEFAULT_VIEW);
    expect(corner.polygons).toHaveLength(3);
    expect(corner.edges.filter((edge) => !edge.hidden)).toHaveLength(9);
    expect(corner.edges.filter((edge) => edge.hidden)).toHaveLength(3);
    expect(composeScene('cube', { yaw: 0, pitch: 2 }).polygons).toHaveLength(1);
  });

  it('draws a cylinder with silhouettes and two circular rims, never a vertex', () => {
    const side = composeScene('cylinder', { yaw: 0, pitch: 0 }, { labels: 'vertices' });
    expect(side.labels).toEqual([]);
    expect(side.edges.some((edge) => edge.kind === 'smooth')).toBe(true);
    expect(composeScene('cylinder', { yaw: 0, pitch: 2 }).polygons).toHaveLength(1);
    expect(composeScene('cylinder', DEFAULT_VIEW).polygons.some((polygon) => polygon.curved)).toBe(true);
  });

  it('labels faces, edges and vertices with stable numbers and letters', () => {
    expect(labelNames('cube', 'faces')).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(labelNames('prism', 'vertices')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(labelNames('cylinder', 'edges')).toHaveLength(2);
    expect(labelNames('cylinder', 'faces')).toHaveLength(3);
    for (const id of SOLID_IDS) for (const mode of ['faces', 'edges', 'vertices'] as const) {
      const names = labelNames(id, mode);
      expect(names).toHaveLength(mode === 'faces' ? SOLID_COUNTS[id].faces : SOLID_COUNTS[id][mode]);
      for (const view of views()) {
        const scene = composeScene(id, view, { labels: mode });
        for (const label of scene.labels) expect(names).toContain(label.text);
        expect(new Set(scene.labels.map((label) => label.text)).size).toBe(scene.labels.length);
      }
    }
  });

  it('is deterministic', () => {
    expect(composeScene('pyramid', { yaw: 2, pitch: 1 }, { labels: 'edges' })).toEqual(composeScene('pyramid', { yaw: 2, pitch: 1 }, { labels: 'edges' }));
  });
});

describe('solids engine: stacked cubes', () => {
  const tower = [[1, 0, 0], [0, 2, 0], [0, 0, 3]];

  it('reads the three views of a stack', () => {
    expect(frontView(tower)).toEqual([1, 2, 3]);
    expect(sideView(tower)).toEqual([3, 2, 1]);
    expect(planView(tower)).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(stackTotal(tower)).toBe(6);
    expect(frontView([[3, 0], [0, 1]])).toEqual([3, 1]);
    expect(sideView([[3, 0], [0, 1]])).toEqual([1, 3]);
  });

  it('finds the fewest cubes for given views, exactly', () => {
    const found = solveStack({ front: [3, 2, 1], side: [3, 2, 1] }, 3);
    expect(found.minimum).toBe(6);
    expect(found.fewest.length).toBeGreaterThan(0);
    for (const stack of found.fewest) expect(matchesGoal(stack, { front: [3, 2, 1], side: [3, 2, 1] })).toBe(true);
    expect(found.maximum!).toBeGreaterThan(found.minimum!);
    expect(solveStack({ front: [3, 0, 0], side: [0, 0, 2] }, 3).count).toBe(0);
    expect(solveStack({ front: [2, 2], side: [2, 2], plan: [[1, 0], [0, 1]] }, 2)).toMatchObject({ minimum: 4, count: 1 });
    expect(solveStack({ front: [2, 2], side: [2, 2], plan: [[1, 1], [1, 1]] }, 2).minimum).toBe(6);
  });

  it('maps stacks to the arrangement slots and back', () => {
    const context = stackContext(3);
    expect(context.slotIds).toHaveLength(9);
    expect(context.capacities.c0r0).toBe(3);
    const slots = stackToSlots(tower);
    expect(slots).toEqual({ c0r0: ['cube'], c1r1: ['cube', 'cube'], c2r2: ['cube', 'cube', 'cube'] });
    expect(slotsToStack(slots, 3)).toEqual(tower);
    expect(slotsToStack({ c5r5: ['cube'] }, 3)).toBeNull();
    expect(slotsToStack({ c0r0: ['sphere'] }, 3)).toBeNull();
    expect(isHeights(tower, 3)).toBe(true);
    expect(isHeights([[1, 0], [0, 4]])).toBe(false);
    expect(isHeights([[1]])).toBe(false);
  });

  it('draws back to front with three faces a cube', () => {
    const scene = composeStackScene(tower);
    expect(scene.cubes).toHaveLength(6);
    expect(scene.cubes[0]!.col + scene.cubes[0]!.row).toBe(0);
    expect(scene.cubes.at(-1)!.level).toBe(2);
    expect(scene.width).toBeGreaterThan(0);
    for (const cube of scene.cubes) for (const face of [cube.top, cube.front, cube.side]) expect(face).toHaveLength(4);
  });
});

describe('solids engine: cube nets', () => {
  const cross: NetCell[] = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
  const grid = Array.from({ length: 20 }, (_, index) => [index % 5, Math.floor(index / 5)] as NetCell);

  const canonical = (cells: readonly NetCell[]): string => {
    const forms: string[] = [];
    for (let turn = 0; turn < 8; turn += 1) {
      let moved = cells.map(([x, y]) => [turn & 1 ? -x : x, y] as NetCell);
      for (let quarter = 0; quarter < (turn >> 1); quarter += 1) moved = moved.map(([x, y]) => [-y, x] as NetCell);
      const minX = Math.min(...moved.map((cell) => cell[0]));
      const minY = Math.min(...moved.map((cell) => cell[1]));
      forms.push(moved.map(([x, y]) => `${x - minX},${y - minY}`).sort().join(';'));
    }
    return forms.sort()[0]!;
  };

  it('knows exactly the eleven cube nets', () => {
    const nets = new Set<string>();
    const pick = (from: number, chosen: NetCell[]) => {
      if (chosen.length === 6) { if (isCubeNet(chosen)) nets.add(canonical(chosen)); return; }
      for (let index = from; index < grid.length; index += 1) pick(index + 1, [...chosen, grid[index]!]);
    };
    pick(0, []);
    expect(nets.size).toBe(11);
  });

  it('refuses a block, a gap and a column that overlaps', () => {
    expect(isCubeNet(cross)).toBe(true);
    expect(isCubeNet([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [3, 0]])).toBe(false);
    expect(isCubeNet([[0, 0], [1, 0], [2, 0], [4, 0], [5, 0], [6, 0]])).toBe(false);
    expect(isCubeNet([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]])).toBe(false);
    expect(foldNormals([[0, 0], [0, 0]])).toBeNull();
  });

  it('folds to six different faces and names them in one of 24 ways', () => {
    const normals = foldNormals(cross)!;
    expect(new Set(normals.map((normal) => normal.join())).size).toBe(6);
    const all = allLabellings(cross);
    expect(all).toHaveLength(24);
    expect(new Set(all.map((labelling) => JSON.stringify(labelling))).size).toBe(24);
    for (const labelling of all) {
      expect(new Set(Object.values(labelling)).size).toBe(6);
      const normalOf = (name: string) => normals[Number(Object.keys(labelling).find((index) => labelling[Number(index)] === name))]!;
      for (const name of FACE_NAMES) expect(dot(normalOf(name), normalOf(OPPOSITE[name]))).toBe(-1);
    }
  });

  it('pins the whole labelling with two fixed neighbours', () => {
    expect(labelSolutions(cross, { 2: 'front', 3: 'right' })).toHaveLength(1);
    expect(labelSolutions(cross, { 2: 'front' })).toHaveLength(4);
    expect(labelSolutions(cross, { 2: 'top', 3: 'bottom' })).toHaveLength(0);
    const only = labelSolutions(cross, { 2: 'front', 3: 'right' })[0]!;
    expect(only[2]).toBe('front');
    expect(only[3]).toBe('right');
  });

  it('counts completions of a partial net and the surface area', () => {
    expect(completions([[1, 1], [2, 1], [3, 1]], { cols: 4, rows: 3 }, 3).count).toBeGreaterThan(0);
    expect(completions([[0, 0], [1, 0], [0, 1], [1, 1]], { cols: 4, rows: 3 }, 2).count).toBe(0);
    expect(completions([[1, 1]], { cols: 3, rows: 3 }, 3).count).toBe(0);
    expect(netBounds(cross)).toEqual({ cols: 4, rows: 3 });
    expect(surfaceArea(3)).toBe(54);
  });
});
