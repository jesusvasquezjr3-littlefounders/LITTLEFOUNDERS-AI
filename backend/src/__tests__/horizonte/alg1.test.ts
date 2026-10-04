import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { alg1 } from '../../services/horizonte/alg1/index.js';
import { ALG1_FIXTURES } from '../../services/horizonte/alg1/fixtures.js';
import { areaPieces, areaSlots, areaSolutions, areaTex, readArea } from '../../services/horizonte/alg1/area.js';
import { expandSolution } from '../../services/horizonte/alg1/arrange.js';
import { cardPieces, equationTex, faceValue, isolations, readCards, reduceFaces } from '../../services/horizonte/alg1/cards.js';
import { readTileCounts, reducedTiles, tilePieces, tileTex, zeroBalanced } from '../../services/horizonte/alg1/tiles.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const TYPES = ['math.algebra-tiles.v2', 'math.algebra-cards.v2', 'math.area-model.v2'] as const;
const fixture = (id: string) => ALG1_FIXTURES.find((item) => item.id === id)!;
const grade = (type: unknown, segment: unknown, response: unknown, rubric: unknown) => (alg1.scorers[type as string]!.grade as unknown as Grade)(segment, response, rubric);
const payloadOf = (id: string) => fixture(id).segment('en-US').payload;

function lesson(item = ALG1_FIXTURES[0]!, locale: Locale = 'en-US') {
  const segment = item.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${item.ageBand}`, chapter_id: 'horizonte-alg1', lesson_id: `hz-alg1-${item.id}`,
    version_id: 'rev-1', locale, age_band: item.ageBand, eligibility: item.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: item.title[locale], required_capabilities: [...new Set(alg1.capabilities[segment.type as (typeof TYPES)[number]])], segments: [segment],
  };
}

describe('alg1 pack: F2.1 tiles, F2.2 cards, F2.3 area model (D02, B27, D06, D09, D10, D11)', () => {
  it('meets the scorer contract for all three segment types', () => {
    expect(() => assertScorerContract(alg1, ALG1_FIXTURES)).not.toThrow();
    expect(Object.keys(alg1.capabilities).sort()).toEqual([...TYPES].sort());
    for (const type of TYPES) expect(ALG1_FIXTURES.filter((item) => item.segment('en-US').type === type).length).toBeGreaterThanOrEqual(2);
  });

  it('covers every disguise and every area mode with its own fixture', () => {
    const disguises = ALG1_FIXTURES.filter((item) => item.segment('en-US').type === 'math.algebra-cards.v2').map((item) => (item.segment('en-US').payload as { disguise: string }).disguise);
    expect(disguises).toEqual(['picture', 'mixed', 'notation']);
    const fills = ALG1_FIXTURES.filter((item) => item.segment('en-US').type === 'math.area-model.v2').map((item) => (item.segment('en-US').payload as { fill: string }).fill);
    expect(new Set(fills)).toEqual(new Set(['cells', 'edges', 'square']));
  });

  describe('tiles', () => {
    it('keeps the tile model total and sets zero pairs aside', () => {
      const counts = { 'sq-pos': 2, 'sq-neg': 1, 'bar-pos': 3, 'bar-neg': 4, 'unit-pos': 2, 'unit-neg': 2 };
      expect(readTileCounts(counts)).not.toBeNull();
      expect(readTileCounts({ ...counts, 'unit-neg': 0, 'unit-pos': 0, 'sq-neg': 0, 'bar-neg': 0 })).toBeNull();
      expect(readTileCounts({ ...counts, 'sq-pos': 13 })).toBeNull();
      expect(readTileCounts({ ...counts, 'bar-pos': 1.5 })).toBeNull();
      expect(readTileCounts({ ...counts, extra: 1 })).toBeNull();
      expect(readTileCounts({ 'sq-pos': 12, 'sq-neg': 12, 'bar-pos': 1, 'bar-neg': 0, 'unit-pos': 0, 'unit-neg': 0 })).toBeNull();
      expect(tilePieces(readTileCounts(counts)!)).toHaveLength(14);
      expect(reducedTiles(counts)).toEqual({ mat: ['bar-neg', 'sq-pos'], zero: ['bar-neg', 'bar-neg', 'bar-neg', 'bar-pos', 'bar-pos', 'bar-pos', 'sq-neg', 'sq-pos', 'unit-neg', 'unit-neg', 'unit-pos', 'unit-pos'] });
      expect(tileTex(counts)).toBe('2x^2-x^2+3x-4x+2-2');
      expect(zeroBalanced(['unit-pos', 'unit-neg'])).toBe(true);
      expect(zeroBalanced(['unit-pos', 'unit-pos'])).toBe(false);
      expect(zeroBalanced(['sq-pos', 'bar-neg'])).toBe(false);
    });

    it('grades the reduced mat as met, a partial set-aside as review and an unbalanced zero set as invalid', () => {
      const item = fixture('simplify-tiles');
      const segment = item.segment('en-US');
      const type = segment.type;
      expect(grade(type, segment, item.ladder.met, item.rubric).verdict).toBe('met');
      const partial = { slots: { mat: ['sq-pos-2', 'bar-neg-4', 'bar-pos-1', 'bar-neg-1', 'bar-pos-2', 'bar-pos-3', 'bar-neg-2', 'bar-neg-3', 'unit-pos-1', 'unit-pos-2', 'unit-neg-1', 'unit-neg-2'], zero: ['sq-pos-1', 'sq-neg-1'] } };
      expect(grade(type, segment, partial, item.rubric).verdict).toBe('review');
      expect(grade(type, segment, { slots: { mat: ['sq-pos-1'], zero: [] } }, item.rubric).verdict).toBe('invalid');
      expect(grade(type, segment, { slots: { mat: ['sq-pos-1', 'sq-pos-2'], zero: ['sq-neg-1'] } }, item.rubric).verdict).toBe('invalid');
      expect(grade(type, segment, { ...(item.ladder.met as object), extra: 1 }, item.rubric).verdict).toBe('invalid');
    });

    it('is symmetric in the pieces of one kind and refuses a wrong key', () => {
      const item = fixture('simplify-tiles');
      const segment = item.segment('en-US');
      const swapped = { slots: { mat: ['sq-pos-1', 'bar-neg-2'], zero: ['sq-pos-2', 'sq-neg-1', 'bar-pos-1', 'bar-pos-2', 'bar-pos-3', 'bar-neg-1', 'bar-neg-3', 'bar-neg-4', 'unit-pos-1', 'unit-pos-2', 'unit-neg-1', 'unit-neg-2'] } };
      expect(grade(segment.type, segment, swapped, item.rubric).verdict).toBe('met');
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ mat: ['sq-pos'], zero: [] }] }).verdict).toBe('invalid');
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ mat: ['bar-neg', 'sq-pos'], zero: [], bin: [] }] }).verdict).toBe('invalid');
    });

    it('writes the signed-number lesson as units only', () => {
      const item = fixture('signed-zero-pairs');
      const document = lesson(item);
      expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
      const segment = item.segment('en-US');
      const wrong = { ...document, segments: [{ ...segment, visual: { type: 'algebra-tiles' } }] };
      expect(v2PublicLessonSchema.safeParse(wrong).success).toBe(false);
      const withBars = { ...document, segments: [{ ...segment, payload: { counts: { ...(segment.payload as { counts: object }).counts, 'bar-pos': 1 } } }] };
      expect(v2PublicLessonSchema.safeParse(withBars).success).toBe(false);
    });
  });

  describe('cards', () => {
    it('reads faces and cancels opposites', () => {
      expect(faceValue('unk')).toEqual({ unknown: 1, constant: 0 });
      expect(faceValue('neg-4')).toEqual({ unknown: 0, constant: -4 });
      expect(faceValue('pos-0')).toBeNull();
      expect(faceValue('pos-10')).toBeNull();
      expect(reduceFaces(['unk', 'unk-neg', 'pos-3', 'pos-3', 'neg-3', 'unk'])).toEqual(['pos-3', 'unk']);
      expect(reduceFaces(['neg-2', 'pos-2'])).toEqual([]);
    });

    it('derives the isolations from the public cards and refuses an already solved start', () => {
      const picture = readCards(payloadOf('box-picture'))!;
      expect(isolations(picture)).toEqual([{ left: ['unk'], right: ['neg-3', 'pos-7'] }]);
      expect(isolations(readCards(payloadOf('box-mixed'))!)).toEqual([{ left: ['neg-2', 'pos-7'], right: ['unk'] }]);
      expect(isolations(readCards(payloadOf('box-notation'))!)).toEqual([{ left: ['pos-3'], right: ['unk'] }]);
      expect(readCards({ disguise: 'picture', left: ['unk'], right: ['pos-4'], supply: [] })).toBeNull();
      expect(readCards({ disguise: 'picture', left: ['unk', 'pos-3'], right: ['pos-7'], supply: [] })).toBeNull();
      expect(readCards({ disguise: 'picture', left: ['unk', 'pos-3'], right: ['pos-7'], supply: ['neg-3'], extra: 1 })).toBeNull();
      expect(readCards({ disguise: 'costume', left: ['unk', 'pos-3'], right: ['pos-7'], supply: ['neg-3'] })).toBeNull();
      expect(equationTex(picture)).toBe('x+3=7');
    });

    it('grades the isolating state as met and keeps the bin cancelled and the equation true', () => {
      for (const id of ['box-picture', 'box-mixed', 'box-notation']) {
        const item = fixture(id);
        const segment = item.segment('en-US');
        expect(grade(segment.type, segment, item.ladder.met, item.rubric).verdict, id).toBe('met');
        expect(grade(segment.type, segment, item.ladder.valid, item.rubric).verdict, id).toBe('valid');
        expect(grade(segment.type, segment, item.ladder.invalid, item.rubric).verdict, id).toBe('invalid');
      }
      const item = fixture('box-picture');
      const segment = item.segment('en-US');
      const onlyOne = { slots: { left: ['left-1', 'left-2', 'supply-1-a'], right: ['right-1'], tray: ['supply-1-b'] } };
      expect(grade(segment.type, segment, onlyOne, item.rubric).verdict).toBe('invalid');
      const uncancelled = { slots: { left: ['left-1', 'left-2', 'supply-1-a'], right: ['right-1', 'supply-1-b'] } };
      expect(grade(segment.type, segment, uncancelled, item.rubric).verdict).toBe('review');
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ left: ['unk'], right: ['pos-4'] }] }).verdict).toBe('invalid');
    });

    it('refuses the mirror image, since the sides can never swap', () => {
      const item = fixture('box-mixed');
      const segment = item.segment('en-US');
      const mirrored = { slots: { left: ['right-1'], right: ['left-1', 'supply-1-a'], bin: ['right-2', 'supply-1-b'] } };
      expect(grade(segment.type, segment, mirrored, item.rubric).verdict).toBe('invalid');
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ left: ['neg-2', 'pos-7'], right: ['unk'] }, { left: ['unk'], right: ['neg-2', 'pos-7'] }] }).verdict).toBe('invalid');
    });

    it('requires notation after the picture disguise and makes it match the cards', () => {
      const picture = fixture('box-picture');
      expect(v2PublicLessonSchema.safeParse(lesson(picture)).success).toBe(true);
      const mixed = lesson(fixture('box-mixed'));
      expect(v2PublicLessonSchema.safeParse(mixed).success).toBe(true);
      const bare: Record<string, unknown> = { ...(mixed.segments[0] as Record<string, unknown>) };
      delete bare.notation;
      expect(v2PublicLessonSchema.safeParse({ ...mixed, segments: [bare] }).success).toBe(false);
      const lying = { ...mixed, segments: [{ ...mixed.segments[0], notation: { tex: 'x+2=7', spokenText: 'x plus two equals seven' } }] };
      expect(v2PublicLessonSchema.safeParse(lying).success).toBe(false);
    });

    it('places a card piece for every card and two supply copies', () => {
      const pieces = cardPieces(readCards(payloadOf('box-picture'))!);
      expect(pieces.map((piece) => piece.id)).toEqual(['left-1', 'left-2', 'right-1', 'supply-1-a', 'supply-1-b']);
    });
  });

  describe('area model', () => {
    it('derives the right answer from the public problem for every fill', () => {
      expect(areaSolutions(readArea(payloadOf('distribute'))!)).toEqual([{ 'cell-0-0': ['1:3'], 'cell-0-1': ['0:12'] }]);
      expect(areaSolutions(readArea(payloadOf('expand'))!)).toEqual([{ 'cell-0-0': ['2:1'], 'cell-0-1': ['1:3'], 'cell-1-0': ['1:2'], 'cell-1-1': ['0:6'] }]);
      expect(areaSolutions(readArea(payloadOf('factor'))!)).toEqual([{ 'col-0': ['1:1'], 'col-1': ['0:3'], 'row-0': ['1:1'], 'row-1': ['0:2'] }]);
      expect(areaSolutions(readArea(payloadOf('complete-square'))!)).toEqual([{ corner: ['0:9'], constant: ['0:-4'] }]);
      expect(areaTex(readArea(payloadOf('complete-square'))!)).toBe('x^2+6x+5');
      expect(areaTex(readArea(payloadOf('factor'))!)).toBe('x^2+5x+6');
    });

    it('refuses a problem with no answer in the pool, an odd square and a perfect square', () => {
      expect(readArea({ fill: 'cells', rows: ['0:3'], cols: ['1:1', '0:4'], pool: ['0:12', '0:7'] })).toBeNull();
      expect(readArea({ fill: 'square', b: 5, c: 1, pool: ['0:9', '0:3'] })).toBeNull();
      expect(readArea({ fill: 'square', b: 6, c: 9, pool: ['0:9', '0:0'] })).toBeNull();
      expect(readArea({ fill: 'square', b: 6, c: 5, pool: ['0:9'] })).toBeNull();
      expect(readArea({ fill: 'cells', rows: ['2:1'], cols: ['1:1', '0:4'], pool: ['0:12', '0:7'] })).toBeNull();
      expect(readArea({ fill: 'edges', cells: ['2:1', '1:3', '1:2', '0:6'], pool: ['0:1', '0:2', '0:3', '0:6'] })).toBeNull();
    });

    it('accepts every derived solution as met, in any piece of the same face', () => {
      for (const id of ['distribute', 'expand', 'factor', 'complete-square']) {
        const item = fixture(id);
        const segment = item.segment('en-US');
        const area = readArea(segment.payload)!;
        const solutions = areaSolutions(area);
        const response = expandSolution(areaPieces(area), solutions[0]!, areaSlots(area));
        expect(response, id).not.toBeNull();
        expect(grade(segment.type, segment, response, { solutions }).verdict, id).toBe('met');
        expect(grade(segment.type, segment, item.ladder.met, item.rubric).verdict, id).toBe('met');
        expect(grade(segment.type, segment, item.ladder.valid, item.rubric).verdict, id).toBe('valid');
        expect(grade(segment.type, segment, item.ladder.invalid, item.rubric).verdict, id).toBe('invalid');
      }
    });

    it('marks a wrong product as review with a diagnostic and refuses a key the problem cannot reach', () => {
      const item = fixture('expand');
      const segment = item.segment('en-US');
      const wrong = { slots: { 'cell-0-0': ['piece-1'], 'cell-0-1': ['piece-2'], 'cell-1-0': ['piece-4'], 'cell-1-1': ['piece-3'], tray: ['piece-5', 'piece-6'] } };
      expect(grade(segment.type, segment, wrong, item.rubric)).toMatchObject({ verdict: 'review' });
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ 'cell-0-0': ['2:1'], 'cell-0-1': ['1:3'], 'cell-1-0': ['1:2'], 'cell-1-1': ['0:5'] }] }).verdict).toBe('invalid');
      expect(grade(segment.type, segment, item.ladder.met, { solutions: [{ 'cell-0-0': ['2:1'], 'cell-0-1': ['1:3'], 'cell-1-0': ['1:2'], 'cell-1-1': ['0:6'], tray: ['1:5'] }] }).verdict).toBe('invalid');
    });

    it('lets each factor mode answer be checked on the board edges', () => {
      const item = fixture('factor');
      const segment = item.segment('en-US');
      const swapped = { slots: { 'row-0': ['piece-2'], 'row-1': ['piece-3'], 'col-0': ['piece-1'], 'col-1': ['piece-4'], tray: ['piece-5', 'piece-6'] } };
      expect(grade(segment.type, segment, swapped, item.rubric).verdict).toBe('met');
      const transposed = { slots: { 'row-0': ['piece-1'], 'row-1': ['piece-4'], 'col-0': ['piece-2'], 'col-1': ['piece-3'], tray: ['piece-5', 'piece-6'] } };
      expect(grade(segment.type, segment, transposed, item.rubric).verdict).toBe('review');
    });

    it('keeps the notation tied to the picture', () => {
      const document = lesson(fixture('distribute'));
      expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
      const lying = { ...document, segments: [{ ...document.segments[0], notation: { tex: '4(x+4)', spokenText: 'four times the sum of x and four' } }] };
      expect(v2PublicLessonSchema.safeParse(lying).success).toBe(false);
      const wrongVisual = { ...document, segments: [{ ...document.segments[0], visual: { type: 'area-square' } }] };
      expect(v2PublicLessonSchema.safeParse(wrongVisual).success).toBe(false);
    });
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const item of ALG1_FIXTURES) {
      const segment = item.segment('en-US');
      expect(grade(segment.type, segment, item.ladder.met, undefined).verdict, item.id).toBe('valid');
      expect(grade(segment.type, segment, item.ladder.invalid, undefined).verdict, item.id).toBe('invalid');
    }
  });

  it('declares one age scope per type and refuses the others', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(TYPES[0], '10-12', 11, 12)).toBeNull();
    expect(scope(TYPES[0], '10-12', 10, 12)).not.toBeNull();
    expect(scope(TYPES[0], '13-17', 13, 16)).not.toBeNull();
    expect(scope(TYPES[1], '10-12', 10, 12)).toBeNull();
    expect(scope(TYPES[1], '13-17', 13, 14)).toBeNull();
    expect(scope(TYPES[1], '13-17', 13, 15)).not.toBeNull();
    expect(scope(TYPES[2], '13-17', 13, 17)).toBeNull();
    expect(scope(TYPES[2], '10-12', 10, 12)).not.toBeNull();
    for (const type of TYPES) expect(scope(type, 'adult', 18, 99)).not.toBeNull();
  });

  it('plugs into Core: public schema in three locales, answer key and the server grade', () => {
    for (const item of ALG1_FIXTURES) for (const locale of LOCALES) expect(v2PublicLessonSchema.safeParse(lesson(item, locale)).success, `${item.id} ${locale}`).toBe(true);
    for (const item of ALG1_FIXTURES) {
      const document = lesson(item);
      const id = item.segment('en-US').id as string;
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, { [id]: item.rubric }, expected), item.id).not.toBeNull();
      expect(validateV2LessonForGrading(document, { [id]: { solutions: [{ nowhere: ['unit-pos'] }] } }, expected), item.id).toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, { [id]: item.rubric }, id, item.ladder.met), item.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, { [id]: item.rubric }, id, item.ladder.valid), item.id).toBeNull();
      expect(horizonteGrade({ type: item.segment('en-US').type as string },item.ladder.met, item.rubric), item.id).toBeNull();
      expect(horizonteSampleVerdict(item.segment('en-US') as { type: string }, item.rubric), item.id).toBe('valid');
    }
  });

  it('refuses a payload that leaks the answer, a missing capability and an out-of-scope document', () => {
    const base = lesson(fixture('box-picture'));
    const leaked = { ...base, segments: [{ ...base.segments[0], payload: { ...(base.segments[0]!.payload as object), solution: { left: ['unk'] } } }] };
    expect(v2PublicLessonSchema.safeParse(leaked).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, required_capabilities: ['visual.algebra-cards.v1'] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 99 } }).success).toBe(false);
  });
});
