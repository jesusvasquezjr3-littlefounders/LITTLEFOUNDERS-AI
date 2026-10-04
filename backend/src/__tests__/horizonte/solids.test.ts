import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { solids } from '../../services/horizonte/solids/index.js';
import { SOLIDS_FIXTURES } from '../../services/horizonte/solids/fixtures.js';
import {
  netProblem, readNetPayload, readSolidNetPayload, readStackPayload, readViewerPayload, solidNetProblem, stackProblem, viewerProblem,
} from '../../services/horizonte/solids/rules.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const VIEWER = 'geometry.solid-viewer.v2';
const NET = 'geometry.cube-net.v2';
const SOLID_NET = 'geometry.solid-net.v2';
const STACK = 'geometry.cube-stack.v2';
const grade = (type: string) => solids.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => SOLIDS_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const run = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric);
const bare = (id: string, response: unknown) => grade(segmentOf(id).type as string)(segmentOf(id), response, undefined);
const withPayload = (id: string, payload: Record<string, unknown>) => ({ ...segmentOf(id), payload });
const squares = (...cells: [number, number][]) => ({ slots: Object.fromEntries(cells.map(([col, row]) => [`g${col}x${row}`, ['square']])) });
const cubes = (counts: Record<string, number>) => ({ slots: Object.fromEntries(Object.entries(counts).map(([slot, count]) => [slot, Array.from({ length: count }, () => 'cube')])) });

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const entry = fixture(id);
  const segment = entry.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-6-9', chapter_id: 'horizonte-solids', lesson_id: `hz-solids-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...solids.capabilities[segment.type as keyof typeof solids.capabilities]], segments: [segment],
  };
}

describe('solids pack: scorer contract', () => {
  it('meets the scorer contract for the four segment types', () => {
    expect(() => assertScorerContract(solids, SOLIDS_FIXTURES)).not.toThrow();
  });

  it('keeps every fixture inside the authoring rules', () => {
    for (const entry of SOLIDS_FIXTURES) {
      const segment = entry.segment('en-US');
      const payload = segment.payload;
      if (segment.type === VIEWER) expect(viewerProblem(readViewerPayload(payload)!), entry.id).toBeNull();
      if (segment.type === NET) expect(netProblem(readNetPayload(payload)!), entry.id).toBeNull();
      if (segment.type === SOLID_NET) expect(solidNetProblem(readSolidNetPayload(payload)!), entry.id).toBeNull();
      if (segment.type === STACK) expect(stackProblem(readStackPayload(payload)!), entry.id).toBeNull();
    }
  });

  it('covers every mode of every net type and the three solids besides the cube', () => {
    const modes = new Set(SOLIDS_FIXTURES.flatMap((entry) => {
      const segment = entry.segment('en-US');
      const payload = segment.payload as { mode?: string; solid?: { kind: string } };
      return segment.type === NET || segment.type === SOLID_NET ? [`${segment.type}:${payload.mode}:${payload.solid?.kind ?? 'cube'}`] : [];
    }));
    for (const kind of ['rect-prism', 'tri-prism', 'sq-pyramid']) for (const mode of ['label', 'complete', 'area']) expect(modes.has(`${SOLID_NET}:${mode}:${kind}`), `${mode} ${kind}`).toBe(true);
    for (const mode of ['label', 'complete', 'area']) expect(modes.has(`${NET}:${mode}:cube`), `${mode} cube`).toBe(true);
  });
});

describe('F4.1 solid viewer: choice plus numeric text', () => {
  it('grades the solid and its count', () => {
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '3' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '2' })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('which-has-no-vertices', { solid: 'cube', count: '3' })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('which-has-no-vertices', { solid: 'cube', count: '6' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('nine-edges', { solid: 'prism', count: '6' }).verdict).toBe('met');
    expect(run('nine-edges', { solid: 'prism', count: '12/2' }).verdict).toBe('met');
  });

  it('treats a blank field as not yet an answer and refuses off-list or out-of-range input', () => {
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '' }).verdict).toBe('valid');
    expect(run('which-has-no-vertices', { solid: '', count: '3' }).verdict).toBe('valid');
    expect(run('which-has-no-vertices', { solid: 'prism', count: '5' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '13' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '-1' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: 'three' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: 3 }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '3', extra: 1 }).verdict).toBe('invalid');
  });

  it('checks the key against the geometry', () => {
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '3' }, { solid: 'cylinder', count: '2' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '3' }, { solid: 'cube', count: '3' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: 'cylinder', count: '3' }, { solid: 'cylinder' }).verdict).toBe('invalid');
    expect(run('which-has-no-vertices', { solid: '', count: '' }, { solid: 'cube', count: '6' }).verdict).toBe('invalid');
  });

  it('never says met without a rubric', () => {
    expect(bare('nine-edges', { solid: 'prism', count: '6' }).verdict).toBe('valid');
    expect(bare('nine-edges', { solid: 'sphere', count: '6' }).verdict).toBe('invalid');
  });

  it('refuses an ambiguous or self-answering question', () => {
    const solved = (payload: unknown) => { const read = readViewerPayload(payload); return read ? viewerProblem(read) : 'malformed'; };
    expect(solved({ solids: ['cube', 'prism'], find: { kind: 'faces', count: 5 }, report: 'edges' })).toBeNull();
    expect(solved({ solids: ['pyramid', 'prism'], find: { kind: 'faces', count: 5 }, report: 'edges' })).not.toBeNull();
    expect(solved({ solids: ['cube', 'prism'], find: { kind: 'faces', count: 6 }, report: 'faces' })).not.toBeNull();
    expect(solved({ solids: ['cube', 'prism'], find: { kind: 'faces', count: 99 }, report: 'edges' })).toBe('malformed');
    expect(solved({ solids: ['cube'], find: { kind: 'faces', count: 6 }, report: 'edges' })).toBe('malformed');
    expect(solved({ solids: ['cube', 'cube'], find: { kind: 'faces', count: 6 }, report: 'edges' })).toBe('malformed');
    expect(horizonteGrade({ type: VIEWER }, { solid: 'cylinder', count: '3' }, fixture('which-has-no-vertices').rubric)).toBeNull();
  });
});

describe('F4.2 cube nets: naming the faces and finishing a net', () => {
  const name = 'name-the-faces';
  const finish = 'finish-the-net';
  const all = { cell0: ['top'], cell1: ['left'], cell2: ['front'], cell3: ['right'], cell4: ['back'], cell5: ['bottom'] };

  it('grades a naming on the geometry of the fold', () => {
    expect(run(name, { slots: all }).verdict).toBe('met');
    expect(run(name, { slots: { cell2: ['front'], cell3: ['right'], cell0: ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(name, { slots: { ...all, cell0: ['bottom'], cell5: ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run(name, { slots: { ...all, cell0: ['bottom'], cell1: ['back'], cell4: ['left'], cell5: ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(name, { slots: { cell2: ['front'], cell3: ['right'], cell0: ['bottom'] } })).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('keeps the given names fixed and each name once', () => {
    expect(run(name, { slots: { ...all, cell2: ['back'], cell4: ['front'] } }).verdict).toBe('invalid');
    expect(run(name, { slots: { cell3: ['right'] } }).verdict).toBe('invalid');
    expect(run(name, { slots: { ...all, cell5: ['top'] } }).verdict).toBe('invalid');
    expect(run(name, { slots: { ...all, cell6: ['top'] } }).verdict).toBe('invalid');
    expect(run(name, { slots: { ...all, cell1: ['top', 'left'] } }).verdict).toBe('invalid');
    expect(run(name, { slots: { ...all, cell1: ['floor'] } }).verdict).toBe('invalid');
  });

  it('refuses a key that is not a labelling of this net', () => {
    expect(run(name, { slots: all }, { solutions: [{ ...all, cell0: ['bottom'], cell5: ['top'] }] }).verdict).toBe('invalid');
    expect(run(name, { slots: all }, { solutions: [{ cell0: ['top'] }] }).verdict).toBe('invalid');
    expect(run(name, { slots: all }, { solutions: [] }).verdict).toBe('invalid');
  });

  it('accepts any six squares that fold into a cube when finishing a net', () => {
    const base: [number, number][] = [[0, 1], [1, 1], [2, 1]];
    expect(run(finish, squares(...base, [3, 1], [1, 0], [1, 2])).verdict).toBe('met');
    expect(run(finish, squares(...base, [0, 0], [3, 1], [2, 2])).verdict).toBe('met');
    expect(run(finish, squares(...base, [0, 0], [1, 0], [2, 0]))).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run(finish, squares(...base, [3, 1], [1, 0]))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(finish, squares(...base, [0, 0], [1, 0], [2, 0], [3, 0]))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run(finish, squares(...base, [0, 0], [1, 0]))).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('keeps the given squares and refuses off-grid or stacked squares', () => {
    expect(run(finish, squares([0, 1], [1, 1], [3, 1], [1, 0], [1, 2], [2, 0])).verdict).toBe('invalid');
    expect(run(finish, { slots: { g0x1: ['square'], g1x1: ['square'], g2x1: ['square', 'square'] } }).verdict).toBe('invalid');
    expect(run(finish, squares([0, 1], [1, 1], [2, 1], [4, 1])).verdict).toBe('invalid');
    expect(run(finish, { slots: { g0x1: ['top'], g1x1: ['square'], g2x1: ['square'] } }).verdict).toBe('invalid');
  });

  it('refuses a key that is not a cube net containing the given squares', () => {
    expect(run(finish, squares([0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]), { solutions: [squares([0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [1, 0]).slots] }).verdict).toBe('invalid');
    expect(run(finish, squares([0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]), { solutions: [squares([0, 1], [1, 1], [3, 1], [1, 0], [1, 2], [2, 0]).slots] }).verdict).toBe('invalid');
  });

  it('refuses a net that cannot work and keeps the surface-area edge bounded', () => {
    const label = (patch: Record<string, unknown>) => { const read = readNetPayload({ ...(segmentOf(name).payload as object), ...patch }); return read ? netProblem(read) : 'malformed'; };
    expect(label({})).toBeNull();
    expect(label({ fixed: [{ cell: 2, name: 'front' }] })).not.toBeNull();
    expect(label({ fixed: [{ cell: 2, name: 'front' }, { cell: 3, name: 'front' }] })).not.toBeNull();
    expect(label({ cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] })).not.toBeNull();
    expect(label({ edge: 0 })).toBe('malformed');
    expect(label({ edge: 21 })).toBe('malformed');
    const complete = (fixed: [number, number][]) => { const read = readNetPayload({ ...(segmentOf(finish).payload as object), fixed }); return read ? netProblem(read) : 'malformed'; };
    expect(complete([[0, 1], [1, 1]])).toBeNull();
    expect(complete([[0, 0], [1, 0], [2, 0], [3, 0]])).not.toBeNull();
    expect(complete([[0, 1]])).toBe('malformed');
  });

  it('never says met without a rubric', () => {
    expect(bare(name, { slots: all }).verdict).toBe('valid');
    expect(bare(finish, squares([0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2])).verdict).toBe('valid');
  });
});

describe('F4.2 area: the learner computes the surface area from the net', () => {
  const area = 'area-of-the-cube';
  const box = 'area-of-the-box';
  const prism = 'area-of-the-prism';
  const pyramid = 'area-of-the-pyramid';
  const value = (text: unknown) => ({ value: text });

  it('grades the number, not the board', () => {
    expect(run(area, value('54'))).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run(area, value('54.0')).verdict).toBe('met');
    expect(run(area, value('108/2')).verdict).toBe('met');
    expect(run(box, value('52')).verdict).toBe('met');
    expect(run(prism, value('72')).verdict).toBe('met');
    expect(run(pyramid, value('96')).verdict).toBe('met');
  });

  it('names what went wrong: some faces, one face too many, or another number', () => {
    expect(run(area, value('9'))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(area, value('45'))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(area, value('63'))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run(area, value('55'))).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(box, value('32'))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(box, value('64'))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run(box, value('53'))).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(pyramid, value('51'))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(pyramid, value('111'))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run(prism, value('35'))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(prism, value('5/2'))).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(prism, value('1/3')).verdict).toBe('invalid');
  });

  it('treats a blank field as not yet an answer and refuses what is not a bounded number', () => {
    expect(run(area, value('')).verdict).toBe('valid');
    for (const text of ['abc', '-1', '0', '10000', '5 4', '1e3', '54 m']) expect(run(area, value(text)).verdict, text).toBe('invalid');
    for (const response of [value(54), { value: '54', extra: 1 }, { slots: {} }, {}, null, undefined, '54']) expect(run(area, response).verdict).toBe('invalid');
  });

  it('never says met without a rubric and refuses a key that is not the area of the net', () => {
    expect(bare(area, value('54')).verdict).toBe('valid');
    expect(bare(box, value('52')).verdict).toBe('valid');
    expect(bare(box, value('abc')).verdict).toBe('invalid');
    expect(run(area, value('54'), { target: '53' }).verdict).toBe('invalid');
    expect(run(area, value(''), { target: '53' }).verdict).toBe('invalid');
    expect(run(box, value('52'), { target: '54' }).verdict).toBe('invalid');
    expect(run(box, value('52'), { target: '52', tolerance: '1' }).verdict).toBe('invalid');
    expect(run(box, value('52'), { solutions: [{}] }).verdict).toBe('invalid');
    expect(run(pyramid, value('96'), { target: '052' }).verdict).toBe('invalid');
  });

  it('refuses an area question about a net that does not fold', () => {
    const row = withPayload(area, { mode: 'area', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], edge: 3 });
    expect(grade(NET)(row, value('54'), fixture(area).rubric).verdict).toBe('invalid');
    const read = readNetPayload({ mode: 'area', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], edge: 3 });
    expect(netProblem(read!)).not.toBeNull();
    expect(netProblem(readNetPayload(segmentOf(area).payload)!)).toBeNull();
    expect(readNetPayload({ mode: 'area', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], edge: 21 })).toBeNull();
    expect(readNetPayload({ mode: 'area', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], edge: 3, fixed: [] })).toBeNull();
  });
});

describe('F4.2 nets of a box, a triangular prism and a pyramid', () => {
  const box = 'name-the-box';
  const prism = 'name-the-prism';
  const pyramid = 'name-the-pyramid';
  const boxAll = { panel0: ['top'], panel1: ['front'], panel2: ['back'], panel3: ['right'], panel4: ['left'], panel5: ['bottom'] };
  const prismAll = { panel0: ['back'], panel1: ['bottom'], panel2: ['slope'], panel3: ['left'], panel4: ['right'] };
  const pyramidAll = { panel0: ['bottom'], panel1: ['front'], panel2: ['right'], panel3: ['back'], panel4: ['left'] };

  it('grades a naming on the geometry of the solid', () => {
    expect(run(box, { slots: boxAll }).verdict).toBe('met');
    expect(run(prism, { slots: prismAll }).verdict).toBe('met');
    expect(run(pyramid, { slots: pyramidAll }).verdict).toBe('met');
    expect(run(box, { slots: { panel1: ['front'], panel4: ['left'], panel0: ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(box, { slots: { ...boxAll, panel0: ['bottom'], panel5: ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run(box, { slots: { panel1: ['front'], panel4: ['left'], panel0: ['bottom'] } })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(pyramid, { slots: { ...pyramidAll, panel2: ['left'], panel4: ['right'] } })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run(prism, { slots: { ...prismAll, panel0: ['bottom'], panel1: ['back'] } })).toEqual({ verdict: 'review', diagnostic: 'partial' });
  });

  it('keeps the given names fixed and each name once', () => {
    expect(run(box, { slots: { ...boxAll, panel1: ['back'], panel2: ['front'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { panel4: ['left'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxAll, panel5: ['top'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxAll, panel6: ['top'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxAll, panel0: ['top', 'back'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxAll, panel0: ['slope'] } }).verdict).toBe('invalid');
    expect(run(prism, { slots: { ...prismAll, panel2: ['bottom'], panel1: ['slope'] } }).verdict).toBe('invalid');
    expect(run(pyramid, { slots: { ...pyramidAll, panel0: ['front'] } }).verdict).toBe('invalid');
    expect(run(pyramid, { slots: { ...pyramidAll, panel4: ['slope'] } }).verdict).toBe('invalid');
  });

  it('refuses a key that is not a labelling of this net', () => {
    expect(run(box, { slots: boxAll }, { solutions: [{ ...boxAll, panel0: ['bottom'], panel5: ['top'] }] }).verdict).toBe('invalid');
    expect(run(box, { slots: boxAll }, { solutions: [{ panel0: ['top'] }] }).verdict).toBe('invalid');
    expect(run(box, { slots: boxAll }, { solutions: [] }).verdict).toBe('invalid');
    expect(run(box, { slots: boxAll }, { target: '52' }).verdict).toBe('invalid');
    expect(run(pyramid, { slots: pyramidAll }, { solutions: [{ ...pyramidAll, panel2: ['back'], panel3: ['right'] }] }).verdict).toBe('invalid');
  });

  it('never says met without a rubric', () => {
    expect(bare(box, { slots: boxAll }).verdict).toBe('valid');
    expect(bare(prism, { slots: prismAll }).verdict).toBe('valid');
    expect(bare(pyramid, { slots: { panel0: ['front'] } }).verdict).toBe('invalid');
  });

  it('refuses a net that cannot work', () => {
    const solved = (id: string, patch: Record<string, unknown>) => { const read = readSolidNetPayload({ ...(segmentOf(id).payload as object), ...patch }); return read ? solidNetProblem(read) : 'malformed'; };
    expect(solved(box, {})).toBeNull();
    expect(solved(box, { fixed: [{ panel: 0, name: 'bottom' }] })).not.toBeNull();
    expect(solved(box, { fixed: [{ panel: 1, name: 'front' }, { panel: 1, name: 'left' }] })).not.toBeNull();
    expect(solved(box, { fixed: [{ panel: 1, name: 'front' }, { panel: 4, name: 'front' }] })).not.toBeNull();
    expect(solved(box, { net: 'star' })).not.toBeNull();
    expect(solved(box, { net: 'nowhere' })).not.toBeNull();
    expect(solved(box, { fixed: [] })).toBe('malformed');
    expect(solved(box, { fixed: [{ panel: 1, name: 'front' }, { panel: 4, name: 'left' }, { panel: 2, name: 'back' }] })).toBe('malformed');
    expect(solved(box, { fixed: [{ panel: 9, name: 'front' }] })).toBe('malformed');
    expect(solved(box, { fixed: [{ panel: 1, name: 'roof' }] })).toBe('malformed');
    expect(solved(box, { solid: { kind: 'rect-prism', dims: [4, 3] } })).toBe('malformed');
    expect(solved(box, { solid: { kind: 'torus', dims: [4, 3, 2] } })).toBe('malformed');
    expect(solved(box, { extra: 1 })).toBe('malformed');
    expect(solved(prism, { solid: { kind: 'tri-prism', dims: [3, 3, 5] } })).toBe('malformed');
    expect(solved(pyramid, { solid: { kind: 'sq-pyramid', dims: [6, 2] } })).toBe('malformed');
    expect(solved(pyramid, { net: 'fan' })).not.toBeNull();
  });
});

describe('F4.2 completing the net of a solid on a sheet', () => {
  const box = 'finish-the-box-net';
  const prism = 'finish-the-prism-net';
  const pyramid = 'finish-the-pyramid-net';
  const three = { 'bottom-front': ['front'], 'bottom-left': ['left'], 'bottom-right': ['right'] };
  const boxMet = { ...three, 'bottom-back': ['back'], 'top-front': ['top'] };
  const solved = (id: string, patch: Record<string, unknown>) => { const read = readSolidNetPayload({ ...(segmentOf(id).payload as object), ...patch }); return read ? solidNetProblem(read) : 'malformed'; };

  it('accepts any completion that folds into the solid and fits the sheet', () => {
    expect(run(box, { slots: boxMet }).verdict).toBe('met');
    expect(run(box, { slots: { ...three, 'bottom-back': ['back'], 'top-back': ['top'] } }).verdict).toBe('met');
    expect(run(box, { slots: { ...three, 'top-front': ['top'], 'top-back': ['back'] } }).verdict).toBe('met');
    expect(run(prism, { slots: { 'bottom-back': ['back'], 'bottom-slope': ['slope'], 'bottom-left': ['left'], 'bottom-right': ['right'] } }).verdict).toBe('met');
    expect(run(prism, { slots: { 'bottom-back': ['back'], 'bottom-slope': ['slope'], 'back-left': ['left'], 'bottom-right': ['right'] } }).verdict).toBe('met');
    expect(run(pyramid, { slots: { 'bottom-front': ['front'], 'bottom-left': ['left'], 'bottom-right': ['right'], 'back-right': ['back'] } }).verdict).toBe('met');
    expect(run(pyramid, { slots: { 'bottom-front': ['front'], 'bottom-left': ['left'], 'back-left': ['back'], 'back-right': ['right'] } }).verdict).toBe('met');
  });

  it('reads the sheet as part of the answer: a net that folds but does not fit is not done', () => {
    expect(run(box, { slots: { ...three, 'bottom-back': ['back'], 'top-right': ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run(pyramid, { slots: { 'bottom-front': ['front'], 'bottom-left': ['left'], 'bottom-right': ['right'], 'bottom-back': ['back'] } })).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run(prism, { slots: { 'bottom-back': ['back'], 'bottom-left': ['left'], 'bottom-right': ['right'], 'slope-right': ['slope'] } })).toEqual({ verdict: 'review', diagnostic: 'structure' });
  });

  it('names a loop of faces that never touch the root as a structure problem', () => {
    const lone = withPayload(box, { ...(segmentOf(box).payload as object), fixed: [{ parent: 'bottom', child: 'front' }] });
    const loop = { 'bottom-front': ['front'], 'bottom-right': ['right'], 'top-left': ['left'], 'top-back': ['top'], 'back-left': ['back'] };
    expect(grade(SOLID_NET)(lone, { slots: loop }, fixture(box).rubric)).toEqual({ verdict: 'review', diagnostic: 'structure' });
  });

  it('says miss while the faces placed can still be finished on the sheet, and value when they cannot', () => {
    expect(run(box, { slots: { ...three, 'bottom-back': ['back'] } })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(box, { slots: { ...three, 'top-front': ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run(box, { slots: { ...three, 'top-right': ['top'] } })).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('keeps the given hinges and refuses faces on edges they do not touch', () => {
    expect(run(box, { slots: { 'bottom-front': ['front'], 'bottom-left': ['left'], 'bottom-back': ['back'], 'top-front': ['top'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'bottom-front': ['back'], 'bottom-back': ['front'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'top-left': ['front'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'bottom-top': ['top'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'top-front': ['bottom'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'top-front': ['top', 'back'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: { ...boxMet, 'top-back': ['top'] } }).verdict).toBe('invalid');
    expect(run(box, { slots: {} }).verdict).toBe('invalid');
    expect(run(prism, { slots: { 'bottom-back': ['left'] } }).verdict).toBe('invalid');
  });

  it('refuses a key that does not fit the sheet, hangs a face on a wrong edge or leaves the given hinges out', () => {
    const key = (solution: Record<string, string[]>) => ({ solutions: [solution] });
    expect(run(box, { slots: boxMet }, key({ ...three, 'bottom-back': ['back'], 'top-right': ['top'] })).verdict).toBe('invalid');
    expect(run(box, { slots: boxMet }, key({ 'bottom-front': ['front'], 'bottom-left': ['left'], 'bottom-back': ['back'], 'top-front': ['top'], 'bottom-right': ['top'] })).verdict).toBe('invalid');
    expect(run(box, { slots: boxMet }, key({ 'bottom-back': ['back'], 'bottom-right': ['right'], 'bottom-front': ['front'], 'top-front': ['top'], 'top-left': ['left'] })).verdict).toBe('invalid');
    expect(run(box, { slots: boxMet }, key(three)).verdict).toBe('invalid');
    expect(run(box, { slots: boxMet }, { target: '52' }).verdict).toBe('invalid');
    expect(run(box, { slots: boxMet }, { solutions: [] }).verdict).toBe('invalid');
  });

  it('never says met without a rubric', () => {
    expect(bare(box, { slots: boxMet }).verdict).toBe('valid');
    expect(bare(box, { slots: { 'bottom-front': ['front'] } }).verdict).toBe('invalid');
  });

  it('refuses a question whose given hinges or sheet cannot work', () => {
    expect(solved(box, {})).toBeNull();
    expect(solved(prism, {})).toBeNull();
    expect(solved(pyramid, {})).toBeNull();
    expect(solved(box, { sheet: { width: 3, height: 3 } })).toBe('The given hinges cannot be completed into a net that fits the sheet');
    expect(solved(box, { sheet: { width: 60, height: 60 } })).toBe('The sheet must rule out at least one net');
    expect(solved(box, { fixed: [{ parent: 'bottom', child: 'top' }] })).toBe('A given hinge must join two faces that share an edge, and the root must be a face of the solid');
    expect(solved(box, { fixed: [{ parent: 'front', child: 'back' }] })).not.toBeNull();
    expect(solved(box, { fixed: [{ parent: 'bottom', child: 'front' }, { parent: 'left', child: 'front' }] })).toBe('A face hangs from one hinge only');
    expect(solved(box, { fixed: [{ parent: 'top', child: 'front' }] })).toBe('Every given hinge must hang from the root face');
    expect(solved(box, { fixed: [] })).toBe('malformed');
    expect(solved(prism, { fixed: [{ parent: 'bottom', child: 'back' }, { parent: 'bottom', child: 'slope' }, { parent: 'bottom', child: 'left' }] })).toBe('malformed');
    expect(solved(box, { sheet: { width: 2, height: 11 } })).toBe('malformed');
    expect(solved(box, { sheet: { width: 9.5, height: 11 } })).toBe('malformed');
    expect(solved(box, { root: 'slope' })).not.toBeNull();
  });
});

describe('F4.3 stacked cubes: counting and views', () => {
  const stair = 'staircase';
  const pair = 'two-by-two';

  it('grades the views and the number of cubes', () => {
    expect(run(stair, cubes({ c2r0: 1, c1r1: 2, c0r2: 3 })).verdict).toBe('met');
    expect(run(stair, cubes({ c2r0: 1, c1r1: 2, c0r2: 3, c1r2: 1 }))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run(stair, cubes({ c0r2: 3, c1r1: 2, c2r1: 1 }))).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run(stair, cubes({ c0r2: 1, c1r2: 1 }))).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run(pair, cubes({ c0r0: 2, c1r1: 2 })).verdict).toBe('met');
    expect(run(pair, cubes({ c0r0: 2, c1r0: 2 }))).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run(pair, cubes({ c0r0: 1, c1r0: 1 }))).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('accepts a non-minimal stack when the fewest is not asked', () => {
    const goal = { size: 2, start: [[1, 0], [0, 0]], goal: { front: [2, 2], side: [2, 2] }, fewest: false };
    const segment = withPayload(pair, goal);
    const key = { solutions: [cubes({ c0r0: 2, c1r1: 2 }).slots] };
    expect(grade(STACK)(segment, cubes({ c0r0: 2, c1r1: 2 }), key).verdict).toBe('met');
    expect(grade(STACK)(segment, cubes({ c0r0: 2, c1r0: 2, c0r1: 2, c1r1: 2 }), key).verdict).toBe('met');
    expect(grade(STACK)({ ...segment, payload: { ...goal, fewest: true } }, cubes({ c0r0: 2, c1r0: 2, c0r1: 2, c1r1: 2 }), key)).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
  });

  it('refuses malformed responses and keys', () => {
    expect(run(stair, cubes({ c0r2: 4 })).verdict).toBe('invalid');
    expect(run(stair, cubes({ c3r0: 1 })).verdict).toBe('invalid');
    expect(run(stair, { slots: { c0r2: ['block'] } }).verdict).toBe('invalid');
    expect(run(stair, { slots: {} }).verdict).toBe('invalid');
    expect(run(pair, cubes({ c2r0: 1 })).verdict).toBe('invalid');
    expect(run(stair, cubes({ c2r0: 1, c1r1: 2, c0r2: 3 }), { solutions: [cubes({ c0r2: 3 }).slots] }).verdict).toBe('invalid');
    expect(run(stair, cubes({ c2r0: 1, c1r1: 2, c0r2: 3 }), { solutions: [cubes({ c2r0: 1, c1r1: 2, c0r2: 3, c1r2: 1 }).slots] }).verdict).toBe('invalid');
  });

  it('never says met without a rubric', () => {
    expect(bare(stair, cubes({ c2r0: 1, c1r1: 2, c0r2: 3 })).verdict).toBe('valid');
  });

  it('refuses a goal nobody can build and a start that is already the answer', () => {
    const solved = (id: string, patch: Record<string, unknown>) => { const read = readStackPayload({ ...(segmentOf(id).payload as object), ...patch }); return read ? stackProblem(read) : 'malformed'; };
    expect(solved(stair, {})).toBeNull();
    expect(solved(stair, { goal: { front: [3, 0, 0], plan: [[0, 1, 0], [0, 0, 0], [0, 0, 0]] } })).toBe('No stack of this grid matches the goal');
    expect(solved(stair, { goal: { plan: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] } })).toBe('The goal must need at least one cube');
    expect(solved(pair, { start: [[2, 0], [0, 2]] })).not.toBeNull();
    expect(solved(pair, { start: [[0, 0], [0, 0]] })).toBe('The start holds at least one cube');
    expect(solved(pair, { size: 4 })).toBe('malformed');
    expect(solved(pair, { goal: {} })).toBe('malformed');
    expect(solved(pair, { goal: { front: [2, 2, 2] } })).toBe('malformed');
  });
});

describe('solids pack: Core integration and age scope', () => {
  it('opens ages 7-12, 7-12, 7-12 and 6-12 and refuses the adult pathway', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(VIEWER, '6-9', 6, 9)).not.toBeNull();
    expect(scope(VIEWER, '6-9', 7, 9)).toBeNull();
    expect(scope(NET, '10-12', 10, 12)).toBeNull();
    expect(scope(SOLID_NET, '6-9', 6, 9)).not.toBeNull();
    expect(scope(SOLID_NET, '6-9', 7, 9)).toBeNull();
    expect(scope(SOLID_NET, '10-12', 10, 12)).toBeNull();
    expect(scope(STACK, '6-9', 6, 9)).toBeNull();
    expect(scope(STACK, '13-17', 13, 17)).not.toBeNull();
    for (const type of [VIEWER, NET, SOLID_NET, STACK]) expect(scope(type, 'adult', 18, 99), type).not.toBeNull();
  });

  it('plugs into Core for every fixture: public schema, answer key and the server grade', () => {
    for (const entry of SOLIDS_FIXTURES) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry.id, locale)).success, `${entry.id} ${locale}`).toBe(true);
      const document = lesson(entry.id);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
  });

  it('rejects a key the geometry contradicts at the grading gate', () => {
    const document = lesson('which-has-no-vertices');
    const id = document.segments[0]!.id as string;
    const expected = { lessonId: document.lesson_id, locale: document.locale };
    expect(validateV2LessonForGrading(document, { [id]: { solid: 'cylinder', count: '2' } }, expected)).toBeNull();
    expect(validateV2LessonForGrading(document, { [id]: { solid: 'cube', count: '6' } }, expected)).toBeNull();
  });

  it('refuses a leaked answer, a wrong visual and an unsolvable payload', () => {
    for (const entry of SOLIDS_FIXTURES) {
      const base = lesson(entry.id);
      const segment = base.segments[0] as Record<string, unknown>;
      expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, payload: { ...(segment.payload as object), solution: 'x' } }] }).success, `${entry.id} leak`).toBe(false);
      expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, visual: { type: 'ten-frame' } }] }).success, `${entry.id} visual`).toBe(false);
    }
    const ambiguous = lesson('which-has-no-vertices');
    const segment = ambiguous.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...ambiguous, segments: [{ ...segment, payload: { solids: ['cube', 'prism'], find: { kind: 'vertices', count: 0 }, report: 'faces' } }] }).success).toBe(false);
    const stack = lesson('staircase');
    const stackSegment = stack.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...stack, segments: [{ ...stackSegment, payload: { ...(stackSegment.payload as object), start: [[3, 2, 1], [0, 0, 0], [0, 0, 0]] } }] }).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...stack, segments: [{ ...stackSegment, payload: { ...(stackSegment.payload as object), goal: { front: [3, 0, 0], side: [2, 0, 0] } } }] }).success).toBe(false);
  });
});
