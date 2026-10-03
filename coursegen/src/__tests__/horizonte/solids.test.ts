import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { solids, SOLIDS_CAPABILITIES } from '../../v2/horizonte/solids.js';
import {
  completions, foldNormals, isCubeNet, labelSolutions, readNet, SOLID_COUNTS, stackSolutions, stackTotal, surfaceArea, viewerMatches,
} from '../../v2/horizonte/solidsGeometry.js';
import { givenHinges, labelAnswers, readSolidNet, solidArea, solidNetFindings, type SolidComplete, type SolidLabel } from '../../v2/horizonte/solidsNetRules.js';
import { buildNet, buildSolid, completionsOf, layoutExtent, POLY_NETS, unfold } from '../../v2/horizonte/solidsPolynet.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const VIEWER = 'geometry.solid-viewer.v2';
const NET = 'geometry.cube-net.v2';
const SOLID_NET = 'geometry.solid-net.v2';
const STACK = 'geometry.cube-stack.v2';
const TYPES = [VIEWER, NET, SOLID_NET, STACK];

const viewer = (payload: Record<string, unknown>, id = 'seg-viewer', visual = 'solid-viewer') => ({ id, type: VIEWER, visual: { type: visual }, payload });
const net = (payload: Record<string, unknown>, id = 'seg-net', visual = 'cube-net') => ({ id, type: NET, visual: { type: visual }, payload });
const solidNet = (payload: Record<string, unknown>, id = 'seg-solid-net', visual = 'solid-net') => ({ id, type: SOLID_NET, visual: { type: visual }, payload });
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
    expect(SOLIDS_CAPABILITIES[NET]).toEqual(['visual.cube-net.v1', 'operation.place-faces.v1', 'operation.fold-net.v1', 'operation.compute-area.v1']);
    expect(SOLIDS_CAPABILITIES[SOLID_NET]).toEqual(['visual.solid-net.v1', 'operation.place-faces.v1', 'operation.fold-net.v1', 'operation.compute-area.v1']);
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
    expect(horizonteGuidanceFor([NET]).join('\n')).toMatch(/area gives the six squares/);
    expect(horizonteGuidanceFor([NET]).join('\n')).not.toMatch(/the board shows the surface area/);
    expect(horizonteGuidanceFor([SOLID_NET]).join('\n')).toMatch(/rect-prism/);
    expect(horizonteGuidanceFor([SOLID_NET]).join('\n')).toContain('"bottom-front": ["front"]');
    expect(horizonteGuidanceFor([SOLID_NET]).join('\n')).not.toMatch(/eleven cube nets/);
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

const BOX = { kind: 'rect-prism', dims: [4, 3, 2] };
const PRISM = { kind: 'tri-prism', dims: [3, 4, 5] };
const PYRAMID = { kind: 'sq-pyramid', dims: [6, 5] };
const SQUARES = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];

const boxLabel = { mode: 'label', solid: BOX, net: 'cross', fixed: [{ panel: 1, name: 'front' }, { panel: 4, name: 'left' }] };
const boxLabelKey = { solutions: [{ panel0: ['top'], panel1: ['front'], panel2: ['back'], panel3: ['right'], panel4: ['left'], panel5: ['bottom'] }] };
const boxComplete = {
  mode: 'complete', solid: BOX, root: 'bottom',
  fixed: [{ parent: 'bottom', child: 'front' }, { parent: 'bottom', child: 'left' }, { parent: 'bottom', child: 'right' }], sheet: { width: 9, height: 11 },
};
const boxCompleteKey = { solutions: [{ 'bottom-back': ['back'], 'bottom-right': ['right'], 'bottom-front': ['front'], 'bottom-left': ['left'], 'top-front': ['top'] }] };

/** Every solid net fixture of the pack as the Forge sees it: a payload and the key Core stores for it. */
const SOLID_FIXTURES: ReadonlyArray<readonly [string, Record<string, unknown>, unknown]> = [
  ['label box', boxLabel, boxLabelKey],
  ['label prism', { mode: 'label', solid: PRISM, net: 'fan', fixed: [{ panel: 2, name: 'slope' }] },
    { solutions: [{ panel0: ['back'], panel1: ['bottom'], panel2: ['slope'], panel3: ['left'], panel4: ['right'] }] }],
  ['label pyramid', { mode: 'label', solid: PYRAMID, net: 'chain', fixed: [{ panel: 0, name: 'bottom' }, { panel: 1, name: 'front' }] },
    { solutions: [{ panel0: ['bottom'], panel1: ['front'], panel2: ['right'], panel3: ['back'], panel4: ['left'] }] }],
  ['complete box', boxComplete, boxCompleteKey],
  ['complete prism', { mode: 'complete', solid: PRISM, root: 'bottom', fixed: [{ parent: 'bottom', child: 'back' }], sheet: { width: 13, height: 14 } },
    { solutions: [{ 'bottom-right': ['right'], 'bottom-slope': ['slope'], 'bottom-left': ['left'], 'bottom-back': ['back'] }] }],
  ['complete pyramid', { mode: 'complete', solid: PYRAMID, root: 'bottom', fixed: [{ parent: 'bottom', child: 'front' }, { parent: 'bottom', child: 'left' }], sheet: { width: 18, height: 15 } },
    { solutions: [{ 'bottom-right': ['right'], 'bottom-front': ['front'], 'bottom-left': ['left'], 'back-right': ['back'] }] }],
  ['area box', { mode: 'area', solid: BOX, net: 'cross' }, { target: '52' }],
  ['area prism', { mode: 'area', solid: PRISM, net: 'row' }, { target: '72' }],
  ['area pyramid', { mode: 'area', solid: PYRAMID, net: 'star' }, { target: '96' }],
];

describe('solid nets in the Forge (F4.2 beyond the cube)', () => {
  it('reads the three modes and says what is wrong with the rest', () => {
    for (const [, payload] of SOLID_FIXTURES) expect(typeof readSolidNet(payload)).toBe('object');
    expect(readSolidNet(null)).toMatch(/object with a mode/);
    expect(readSolidNet({ ...boxLabel, mode: 'fold' })).toMatch(/label, complete or area/);
    expect(readSolidNet({ ...boxLabel, solid: { kind: 'cube', dims: [2] } })).toMatch(/rect-prism/);
    expect(readSolidNet({ ...boxLabel, solid: { kind: 'tri-prism', dims: [3, 3, 5] } })).toMatch(/hypotenuse/);
    expect(readSolidNet({ ...boxLabel, fixed: [] })).toMatch(/1 to 2 named panels/);
    expect(readSolidNet({ ...boxLabel, fixed: [{ panel: 6, name: 'top' }] })).toMatch(/panel: 0 to 5/);
    expect(readSolidNet({ ...boxLabel, extra: 1 })).toMatch(/exactly/);
    expect(readSolidNet({ ...boxComplete, sheet: { width: 9.5, height: 11 } })).toMatch(/whole lengths/);
    expect(readSolidNet({ ...boxComplete, fixed: [] })).toMatch(/1 to 3 hinges/);
    expect(readSolidNet({ mode: 'area', solid: BOX, net: 'cross', fixed: [] })).toMatch(/exactly/);
  });

  it('accepts every pack fixture, with and without the key', () => {
    for (const [name, payload, key] of SOLID_FIXTURES) {
      const segment = solidNet(payload);
      expect(gates(segment), name).toEqual([]);
      expect(findings(segment), name).toEqual([]);
      expect(findings(segment, key), name).toEqual([]);
      expect(solidNetFindings(readSolidNet(payload) as never), name).toEqual([]);
    }
  });

  it('knows the solids and the area a net covers', () => {
    expect(solidArea(buildSolid({ kind: 'rect-prism', dims: [4, 3, 2] })!)).toBe(52);
    expect(solidArea(buildSolid({ kind: 'tri-prism', dims: [3, 4, 5] })!)).toBe(72);
    expect(solidArea(buildSolid({ kind: 'sq-pyramid', dims: [6, 5] })!)).toBe(96);
    expect(buildSolid({ kind: 'sq-pyramid', dims: [6, 2] })).toBeNull();
    for (const [kind, nets] of Object.entries(POLY_NETS)) {
      const spec = kind === 'rect-prism' ? BOX : kind === 'tri-prism' ? PRISM : PYRAMID;
      for (const def of nets) expect(buildNet(buildSolid(spec as never)!, def.id), `${kind} ${def.id}`).not.toBeNull();
    }
  });

  describe('label mode', () => {
    it('proves one labelling and counts the ways when the names do not force it', () => {
      expect(labelAnswers(readSolidNet(boxLabel) as SolidLabel, buildSolid(BOX as never)!)).toEqual(['top,front,back,right,left,bottom']);
      expect(codes(solidNet({ ...boxLabel, fixed: [{ panel: 1, name: 'front' }] }))).toEqual(['ambiguous-solution']);
      expect(findings(solidNet({ ...boxLabel, fixed: [{ panel: 1, name: 'front' }] }))[0]?.message).toMatch(/2 ways/);
      expect(codes(solidNet({ ...boxLabel, fixed: [{ panel: 0, name: 'slope' }] }))).toEqual(['no-solution']);
      expect(codes(solidNet({ ...boxLabel, fixed: [{ panel: 0, name: 'top' }, { panel: 0, name: 'front' }] }))).toEqual(['duplicate-id']);
      expect(codes(solidNet({ ...boxLabel, fixed: [{ panel: 0, name: 'top' }, { panel: 1, name: 'top' }] }))).toEqual(['duplicate-id']);
      expect(codes(solidNet({ ...boxLabel, net: 'star' }))).toEqual(['impossible-state']);
      expect(codes(solidNet({ ...boxLabel, net: 'nope' }))).toEqual(['impossible-state']);
    });

    it('judges the key against every labelling', () => {
      const swapped = { solutions: [{ ...boxLabelKey.solutions[0], panel0: ['bottom'], panel5: ['top'] }] };
      expect(codes(solidNet(boxLabel), swapped)).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(solidNet(boxLabel), { solutions: [{ panel0: ['top'] }] })).toEqual(['impossible-state']);
      expect(codes(solidNet(boxLabel), { solutions: [{ ...boxLabelKey.solutions[0], panel6: ['top'] }] })).toEqual(['impossible-state']);
      expect(codes(solidNet(boxLabel), { solutions: 'nope' })).toEqual(['impossible-state']);
      expect(codes(solidNet(boxLabel), { solutions: [] })).toEqual(['impossible-state']);
    });

    it('gates a label net that has no single answer', () => {
      expect(gates(solidNet({ ...boxLabel, fixed: [{ panel: 1, name: 'front' }] }))[0]).toMatchObject({ gate: 4, segmentId: 'seg-solid-net', message: expect.stringMatching(/2 ways to name the rest/) });
      expect(gates(solidNet({ ...boxLabel, net: 'star' }))[0]?.message).toMatch(/no net called star/);
    });
  });

  describe('complete mode', () => {
    const complete = (patch: Record<string, unknown>) => solidNet({ ...boxComplete, ...patch });
    const solid = buildSolid(BOX as never)!;
    const given = givenHinges(readSolidNet(boxComplete) as SolidComplete, solid)!;

    it('needs a net that fits the sheet and a sheet that rules one out', () => {
      expect(codes(complete({ sheet: { width: 3, height: 3 } }))).toEqual(['no-solution']);
      expect(codes(complete({ sheet: { width: 20, height: 20 } }))).toEqual(['vacuous-rubric']);
    });

    it('refuses a sheet that ties with a net, so the float fit test never decides', () => {
      expect(codes(complete({ sheet: { width: 8, height: 11 } }))).toEqual(['out-of-bounds']);
      expect(codes(complete({ sheet: { width: 9, height: 10 } }))).toEqual(['out-of-bounds']);
      expect(gates(complete({ sheet: { width: 8, height: 11 } }))[0]?.message).toMatch(/within 0.3/);
    });

    it('keeps a margin of 0.3 on every fixture sheet, measured on every net the given hinges allow', () => {
      for (const [name, payload] of SOLID_FIXTURES) {
        const read = readSolidNet(payload);
        if (typeof read === 'string' || read.mode !== 'complete') continue;
        const built = buildSolid(read.solid)!;
        const start = givenHinges(read, built)!;
        const all = completionsOf(built, start.root, start.hinges, null, 256);
        expect(all.count, name).toBe(all.sets.length);
        for (const tree of all.sets) {
          const extent = layoutExtent(unfold(built, start.root, tree)!);
          expect(Math.abs(extent.width - read.sheet.width), name).toBeGreaterThanOrEqual(0.3);
          expect(Math.abs(extent.height - read.sheet.height), name).toBeGreaterThanOrEqual(0.3);
        }
      }
    });

    it('refuses hinges that cannot be given', () => {
      expect(codes(complete({ fixed: [{ parent: 'bottom', child: 'top' }] }))).toEqual(['impossible-state']);
      expect(codes(complete({ fixed: [{ parent: 'front', child: 'top' }] }))).toEqual(['impossible-state']);
      expect(codes(complete({ fixed: [{ parent: 'bottom', child: 'front' }, { parent: 'left', child: 'front' }] }))).toEqual(['duplicate-id']);
      expect(codes(complete({ root: 'slope' }))).toEqual(['impossible-state']);
      expect(codes(complete({ fixed: [{ parent: 'bottom', child: 'front' }, { parent: 'bottom', child: 'back' }, { parent: 'bottom', child: 'left' }, { parent: 'bottom', child: 'right' }] }))).toEqual(['impossible-state']);
    });

    it('judges every key solution on the geometry', () => {
      const doesNotFit = completionsOf(solid, given.root, given.hinges, null, 256).sets.find((tree) => {
        const extent = layoutExtent(unfold(solid, given.root, tree)!);
        return extent.width > 9 || extent.height > 11;
      })!;
      const slots = Object.fromEntries(doesNotFit.map((hinge) => [[hinge.parent, hinge.child].sort((a, b) => a - b).map((index) => solid.faces[index]!.name).join('-'), [solid.faces[hinge.child]!.name]]));
      expect(codes(complete({}), { solutions: [slots] })).toEqual(['rubric-accepts-invalid']);
      const withoutGiven = Object.fromEntries(Object.entries(boxCompleteKey.solutions[0]!).filter(([slot]) => slot !== 'bottom-front'));
      expect(codes(complete({}), { solutions: [withoutGiven] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(complete({}), { solutions: [{ ...boxCompleteKey.solutions[0], 'top-back': ['top'] }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(complete({}), { solutions: [{ nowhere: ['front'] }] })).toEqual(['rubric-accepts-invalid']);
    });
  });

  describe('area mode', () => {
    it('proves the net exists and judges the key against the computed area', () => {
      const area = solidNet({ mode: 'area', solid: BOX, net: 'cross' });
      expect(codes(area, { target: '53' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(area, { target: 52 })).toEqual(['impossible-state']);
      expect(codes(area, { value: '52' })).toEqual(['impossible-state']);
      expect(codes(solidNet({ mode: 'area', solid: BOX, net: 'row' }))).toEqual(['impossible-state']);
      expect(gates(solidNet({ mode: 'area', solid: BOX, net: 'row' }))[0]?.message).toMatch(/no net called row/);
    });
  });

  it('refuses a malformed solid net payload without throwing, and a wrong visual', () => {
    expect(codes({ id: 'seg-bad', type: SOLID_NET, payload: { mode: 'fold' } } as never)).toEqual(['impossible-state']);
    expect(codes({ id: 'seg-bad', type: SOLID_NET, payload: null } as never)).toEqual(['impossible-state']);
    expect(gates(solidNet(boxLabel, 'seg-solid-net', 'cube-net'))[0]?.message).toMatch(/solid-net/);
    expect(gates(solidNet({ mode: 'area', solid: BOX }))[0]?.message).toMatch(/exactly mode, solid and net/);
  });
});

describe('cube net area mode (F4.2)', () => {
  const area = (patch: Record<string, unknown> = {}) => net({ mode: 'area', cells: SQUARES, edge: 3, ...patch });

  it('reads the area payload and computes the area from the edge', () => {
    expect(readNet({ mode: 'area', cells: SQUARES, edge: 3 })).toMatchObject({ mode: 'area', edge: 3 });
    expect(readNet({ mode: 'area', cells: SQUARES, edge: 3, fixed: [] })).toMatch(/exactly mode, cells/);
    expect(readNet({ mode: 'area', cells: SQUARES.slice(1), edge: 3 })).toMatch(/six different/);
    expect(readNet({ mode: 'area', cells: SQUARES, edge: 21 })).toMatch(/1 to 20/);
    expect(surfaceArea(3)).toBe(54);
    expect(surfaceArea(10)).toBe(600);
  });

  it('accepts a cube net with the key and judges the key against 6 x edge x edge', () => {
    expect(gates(area())).toEqual([]);
    expect(findings(area(), { target: '54' })).toEqual([]);
    expect(findings(area())).toEqual([]);
    expect(codes(area(), { target: '36' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(area(), { target: 54 })).toEqual(['impossible-state']);
    expect(codes(area(), { value: '54' })).toEqual(['impossible-state']);
  });

  it('refuses six squares that do not fold, one that does not fit the grid and an edge too small to label', () => {
    expect(codes(area({ cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] }))).toEqual(['impossible-state']);
    expect(gates(area({ cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] }))[0]?.message).toMatch(/fold into a cube/);
    expect(codes(area({ edge: 1 }))).toEqual(['impossible-state']);
    expect(gates(area({ edge: 1 }))[0]?.message).toMatch(/edge is at least 2/);
    expect(gates(label([{ cell: 2, name: 'front' }, { cell: 3, name: 'right' }]), net({ mode: 'complete', grid: { cols: 4, rows: 3 }, fixed: [[0, 1], [1, 1], [2, 1]], edge: 1 }, 'seg-edge'))).toHaveLength(1);
  });
});

describe('the pinned copy of the net engine', () => {
  it('is the Core engine, line for line, apart from the one type import', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const core = readFileSync(path.resolve(here, '../../../../backend/src/services/horizonte/solids/polynet.ts'), 'utf8').replace(/\r\n/g, '\n');
    const pinned = readFileSync(path.resolve(here, '../../v2/horizonte/solidsPolynet.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(core).toContain("import type { Vec3 } from './model.js';");
    expect(pinned.split('\n').slice(1).join('\n')).toBe(core.replace("import type { Vec3 } from './model.js';", 'type Vec3 = readonly [number, number, number];'));
  });
});
