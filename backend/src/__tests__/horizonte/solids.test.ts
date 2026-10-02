import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { solids } from '../../services/horizonte/solids/index.js';
import { SOLIDS_FIXTURES } from '../../services/horizonte/solids/fixtures.js';
import { readNetPayload, readStackPayload, readViewerPayload, netProblem, stackProblem, viewerProblem } from '../../services/horizonte/solids/rules.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const VIEWER = 'geometry.solid-viewer.v2';
const NET = 'geometry.cube-net.v2';
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
  it('meets the scorer contract for the three segment types', () => {
    expect(() => assertScorerContract(solids, SOLIDS_FIXTURES)).not.toThrow();
  });

  it('keeps every fixture inside the authoring rules', () => {
    for (const entry of SOLIDS_FIXTURES) {
      const segment = entry.segment('en-US');
      const payload = segment.payload;
      if (segment.type === VIEWER) expect(viewerProblem(readViewerPayload(payload)!), entry.id).toBeNull();
      if (segment.type === NET) expect(netProblem(readNetPayload(payload)!), entry.id).toBeNull();
      if (segment.type === STACK) expect(stackProblem(readStackPayload(payload)!), entry.id).toBeNull();
    }
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
  it('opens ages 7-12, 7-12 and 6-12 and refuses the adult pathway', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(VIEWER, '6-9', 6, 9)).not.toBeNull();
    expect(scope(VIEWER, '6-9', 7, 9)).toBeNull();
    expect(scope(NET, '10-12', 10, 12)).toBeNull();
    expect(scope(STACK, '6-9', 6, 9)).toBeNull();
    expect(scope(STACK, '13-17', 13, 17)).not.toBeNull();
    for (const type of [VIEWER, NET, STACK]) expect(scope(type, 'adult', 18, 99), type).not.toBeNull();
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
