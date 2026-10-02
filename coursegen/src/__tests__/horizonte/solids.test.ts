import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { solids, SOLIDS_CAPABILITIES } from '../../v2/horizonte/solids.js';
import {
  completions, foldNormals, isCubeNet, labelSolutions, SOLID_COUNTS, stackSolutions, stackTotal, viewerMatches,
} from '../../v2/horizonte/solidsGeometry.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const VIEWER = 'geometry.solid-viewer.v2';
const NET = 'geometry.cube-net.v2';
const STACK = 'geometry.cube-stack.v2';
const TYPES = [VIEWER, NET, STACK];

const viewer = (payload: Record<string, unknown>, id = 'seg-viewer', visual = 'solid-viewer') => ({ id, type: VIEWER, visual: { type: visual }, payload });
const net = (payload: Record<string, unknown>, id = 'seg-net', visual = 'cube-net') => ({ id, type: NET, visual: { type: visual }, payload });
const stack = (payload: Record<string, unknown>, id = 'seg-stack', visual = 'cube-stack') => ({ id, type: STACK, visual: { type: visual }, payload });

const noVertices = () => viewer({ solids: ['cube', 'cylinder', 'pyramid'], find: { kind: 'vertices', count: 0 }, report: 'faces' });
const label = (fixed = [{ cell: 2, name: 'front' }, { cell: 3, name: 'right' }]) =>
  net({ mode: 'label', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], fixed, edge: 2 });
const complete = (fixed: number[][] = [[0, 1], [1, 1], [2, 1]]) => net({ mode: 'complete', grid: { cols: 4, rows: 3 }, fixed, edge: 2 });
const staircase = () => stack({ size: 3, start: [[0, 0, 0], [0, 0, 0], [1, 0, 0]], goal: { front: [3, 2, 1], side: [3, 2, 1] }, fewest: true });
const twoByTwo = () => stack({ size: 2, start: [[1, 0], [0, 0]], goal: { front: [2, 2], side: [2, 2], plan: [[1, 0], [0, 1]] }, fewest: false });
const cubes = (count: number) => Array.from({ length: count }, () => 'cube');

const labelKey = { solutions: [{ cell0: ['top'], cell1: ['left'], cell2: ['front'], cell3: ['right'], cell4: ['back'], cell5: ['bottom'] }] };
const completeKey = { solutions: [{ g0x1: ['square'], g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g1x2: ['square'] }] };
const staircaseKey = { solutions: [{ c2r0: cubes(1), c1r1: cubes(2), c0r2: cubes(3) }] };
const twoByTwoKey = { solutions: [{ c0r0: cubes(2), c1r1: cubes(2) }] };

const gates = (...segments: unknown[]) => horizontePieceGates({ segments } as never);
const findings = (segment: { id: string }, key?: unknown) => runSolvabilityGate({ segments: [segment] }, key === undefined ? undefined : { [segment.id]: key });
const codes = (segment: { id: string }, key?: unknown) => findings(segment, key).map((item) => item.code).sort();

describe('solids pack in the Forge (F4.1 viewer, F4.2 nets, F4.3 stacked cubes)', () => {
  it('declares the capability literals and the emitter map spreads them', () => {
    expect(SOLIDS_CAPABILITIES[VIEWER]).toEqual(['visual.solid-viewer.v1', 'operation.fixed-views.v1', 'operation.choose-and-count.v1']);
    expect(SOLIDS_CAPABILITIES[NET]).toEqual(['visual.cube-net.v1', 'operation.place-faces.v1', 'operation.fold-net.v1']);
    expect(SOLIDS_CAPABILITIES[STACK]).toEqual(['visual.cube-stack.v1', 'operation.stack-cubes.v1', 'operation.linked-views.v1']);
    for (const type of TYPES) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(SOLIDS_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(SOLIDS_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(solids);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([VIEWER]).join('\n')).toMatch(/exactly one listed solid/);
    expect(horizonteGuidanceFor([NET]).join('\n')).toMatch(/eleven cube nets/);
    expect(horizonteGuidanceFor([STACK]).join('\n')).toMatch(/row 0 at the back/);
    expect(horizonteGuidanceFor([VIEWER]).join('\n')).not.toMatch(/eleven cube nets/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('registers one solvability checker per type', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining(TYPES));
  });

  describe('the Forge geometry copy', () => {
    it('pins the teaching counts and the one-answer searches', () => {
      expect(SOLID_COUNTS.cube).toEqual({ faces: 6, edges: 12, vertices: 8 });
      expect(SOLID_COUNTS.cylinder).toEqual({ faces: 3, edges: 2, vertices: 0 });
      expect(viewerMatches({ solids: ['cube', 'prism', 'pyramid', 'cylinder'], find: { kind: 'edges', count: 9 }, report: 'vertices' })).toEqual(['prism']);
      expect(viewerMatches({ solids: ['prism', 'pyramid'], find: { kind: 'faces', count: 5 }, report: 'edges' })).toEqual(['prism', 'pyramid']);
    });

    it('folds exactly the eleven cube nets (216 placements on a 5 by 4 grid)', () => {
      const cells: Array<[number, number]> = [];
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 5; col += 1) cells.push([col, row]);
      let folding = 0;
      const pick = (from: number, chosen: Array<[number, number]>): void => {
        if (chosen.length === 6) { if (isCubeNet(chosen)) folding += 1; return; }
        for (let index = from; index < cells.length; index += 1) pick(index + 1, [...chosen, cells[index]!]);
      };
      pick(0, []);
      expect(folding).toBe(216);
      expect(foldNormals([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])).toBeNull();
      expect(isCubeNet([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]])).toBe(false);
    });

    it('names a net one way from two touching names and finds completions', () => {
      const cells: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
      expect(labelSolutions(cells, [{ cell: 2, name: 'front' }, { cell: 3, name: 'right' }])).toHaveLength(1);
      expect(labelSolutions(cells, [{ cell: 2, name: 'front' }])).toHaveLength(4);
      expect(completions([[0, 1], [1, 1], [2, 1]], { cols: 4, rows: 3 }).count).toBeGreaterThan(0);
      expect(completions([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], { cols: 5, rows: 3 }).count).toBe(0);
    });

    it('solves a stack goal exhaustively', () => {
      const solutions = stackSolutions({ front: [3, 2, 1], side: [3, 2, 1] }, 3);
      expect(solutions.length).toBeGreaterThan(1);
      expect(Math.min(...solutions.map(stackTotal))).toBe(6);
      expect(stackSolutions({ front: [1, 1], side: [2, 2], plan: [[1, 1], [1, 1]] }, 2)).toEqual([]);
    });
  });

  describe('piece gates', () => {
    it('accept the well formed boards and a document with no key', () => {
      expect(gates(noVertices(), label(), complete(), staircase(), twoByTwo())).toEqual([]);
      expect(gates(viewer({ solids: ['cube', 'prism', 'pyramid', 'cylinder'], find: { kind: 'edges', count: 9 }, report: 'vertices' }))).toEqual([]);
    });

    it('refuse a malformed viewer, a wrong visual and an ambiguous or empty search', () => {
      expect(gates(viewer({ solids: ['cube'], find: { kind: 'vertices', count: 0 }, report: 'faces' }))[0]?.message).toMatch(/two to 4 different solids|two to four|different solids/);
      expect(gates(viewer({ solids: ['cube', 'sphere'], find: { kind: 'vertices', count: 0 }, report: 'faces' }))).toHaveLength(1);
      expect(gates(viewer({ solids: ['prism', 'pyramid'], find: { kind: 'faces', count: 5 }, report: 'edges' }))[0]).toMatchObject({ gate: 4, segmentId: 'seg-viewer', message: expect.stringMatching(/Exactly one listed solid/) });
      expect(gates(viewer({ solids: ['cube', 'prism'], find: { kind: 'vertices', count: 0 }, report: 'faces' }))[0]?.message).toMatch(/Exactly one listed solid/);
      expect(gates(viewer({ solids: ['cube', 'cylinder'], find: { kind: 'vertices', count: 0 }, report: 'vertices' }))[0]?.message).toMatch(/different thing/);
      expect(gates({ ...noVertices(), visual: { type: 'cube-net' } })[0]?.message).toMatch(/solid-viewer/);
    });

    it('refuse a net that does not fold, an unforced labelling and an impossible completion', () => {
      expect(gates(net({ mode: 'label', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], fixed: [{ cell: 0, name: 'top' }], edge: 2 }))).toHaveLength(1);
      expect(gates(label([{ cell: 2, name: 'front' }]))[0]?.message).toMatch(/exactly one way/);
      expect(gates(label([{ cell: 2, name: 'front' }, { cell: 3, name: 'front' }]))[0]?.message).toMatch(/named once/);
      expect(gates(net({ mode: 'complete', grid: { cols: 5, rows: 3 }, fixed: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], edge: 2 }))[0]?.message).toMatch(/some cube net/);
      expect(gates({ ...complete(), visual: { type: 'solid-viewer' } })[0]?.message).toMatch(/cube-net/);
    });

    it('refuse an unreachable goal, a start that is already the answer and a long prompt', () => {
      expect(gates(stack({ size: 2, start: [[1, 0], [0, 0]], goal: { front: [1, 1], side: [2, 2], plan: [[1, 1], [1, 1]] }, fewest: false }))[0]?.message).toMatch(/Some stack/);
      expect(gates(stack({ size: 2, start: [[2, 0], [0, 2]], goal: { front: [2, 2], side: [2, 2], plan: [[1, 0], [0, 1]] }, fewest: false }))[0]?.message).toMatch(/already be the answer/);
      expect(gates(stack({ size: 2, start: [[1, 0], [0, 0]], goal: {}, fewest: false }))[0]?.message).toMatch(/goal names at least one/);
      expect(gates({ ...twoByTwo(), prompt: Array.from({ length: 30 }, () => 'word').join(' ') })[0]?.message).toMatch(/at most 24 words/);
      expect(gates({ ...twoByTwo(), visual: { type: 'cube-net' } })[0]).toMatchObject({ gate: 4, segmentId: 'seg-stack' });
    });
  });

  describe('solvability checkers', () => {
    it('prove the viewer has one answer and judge the key', () => {
      expect(findings(noVertices(), { solid: 'cylinder', count: '3' })).toEqual([]);
      expect(findings(noVertices())).toEqual([]);
      expect(codes(noVertices(), { solid: 'cube', count: '6' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(noVertices(), { solid: 'cylinder', count: '4' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(viewer({ solids: ['prism', 'pyramid'], find: { kind: 'faces', count: 5 }, report: 'edges' }))).toEqual(['ambiguous-solution']);
      expect(codes(viewer({ solids: ['cube', 'prism'], find: { kind: 'vertices', count: 0 }, report: 'faces' }))).toEqual(['no-solution']);
    });

    it('prove a label net is forced and judge the key', () => {
      expect(findings(label(), labelKey)).toEqual([]);
      expect(findings(label())).toEqual([]);
      expect(codes(label(), { solutions: [{ ...labelKey.solutions[0], cell0: ['bottom'], cell5: ['top'] }] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(label([{ cell: 2, name: 'front' }]))).toEqual(['ambiguous-solution']);
      expect(codes(label([{ cell: 2, name: 'front' }, { cell: 3, name: 'left' }, { cell: 1, name: 'left' }]))).toEqual(['duplicate-id']);
      expect(codes(label(), { solutions: [{ cell0: ['top'] }] })).toEqual(['impossible-state']);
    });

    it('prove a partial net can be finished and judge every key solution on the fold', () => {
      expect(findings(complete(), completeKey)).toEqual([]);
      expect(findings(complete())).toEqual([]);
      expect(codes(complete(), { solutions: [{ g0x1: ['square'], g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g2x0: ['square'] }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(complete(), { solutions: [{ g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g1x2: ['square'], g2x2: ['square'] }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(net({ mode: 'complete', grid: { cols: 5, rows: 3 }, fixed: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], edge: 2 }))).toEqual(['no-solution']);
    });

    it('prove a stack goal can be built and judge the key against the fewest cubes', () => {
      expect(findings(staircase(), staircaseKey)).toEqual([]);
      expect(findings(twoByTwo(), twoByTwoKey)).toEqual([]);
      expect(findings(staircase())).toEqual([]);
      expect(codes(staircase(), { solutions: [{ c2r0: cubes(1), c1r1: cubes(2), c0r2: cubes(3), c0r0: cubes(1) }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(twoByTwo(), { solutions: [{ c0r0: cubes(2), c1r1: cubes(1) }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(stack({ size: 2, start: [[1, 0], [0, 0]], goal: { front: [1, 1], side: [2, 2], plan: [[1, 1], [1, 1]] }, fewest: false }))).toEqual(['no-solution']);
      expect(codes(stack({ size: 2, start: [[2, 0], [0, 2]], goal: { front: [2, 2], side: [2, 2], plan: [[1, 0], [0, 1]] }, fewest: false }))).toEqual(['impossible-state']);
    });

    it('refuse a malformed payload or key without throwing', () => {
      expect(codes({ id: 'seg-bad', type: VIEWER, payload: { solids: [] } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: NET, payload: { mode: 'fold' } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: STACK, payload: { size: 4 } } as never)).toEqual(['impossible-state']);
      expect(codes(noVertices(), 'nope')).toEqual(['impossible-state']);
      expect(codes(label(), { solutions: 'nope' })).toEqual(['impossible-state']);
      expect(codes(staircase(), { solutions: [{ c9r9: cubes(1) }] })).toEqual(['impossible-state']);
    });
  });
});
