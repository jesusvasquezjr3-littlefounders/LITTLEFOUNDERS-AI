import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { numB } from '../../services/horizonte/num-b/index.js';
import { NUM_B_FIXTURES } from '../../services/horizonte/num-b/fixtures.js';
import {
  arrayAreaAnswer, arrayAreaKind, isAreaDivisionPayload, isAreaModelPayload, isArrayPayload, readWholeText, standArray, standAreaDivision, standAreaModel,
} from '../../services/horizonte/num-b/arrayAreaModel.js';
import { circleAnswer, circleKeyProblem, circleOp, circlePayloadProblem, isCirclePayload, standCircle } from '../../services/horizonte/num-b/fractionCirclesModel.js';
import { fractionAnswer, isFractionPayload, keyProblem, standFraction } from '../../services/horizonte/num-b/fractionWallModel.js';
import { isDoubleLinePayload, isRatioTapePayload, ratioAnswer, ratioKind, standRatio } from '../../services/horizonte/num-b/ratioLineModel.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const fixture = (id: string) => NUM_B_FIXTURES.find((item) => item.id === id)!;
const run = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => {
  const item = fixture(id);
  return (numB.scorers[String(item.segment('en-US').type)]!.grade as unknown as Grade)(item.segment('en-US'), response, rubric);
};

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const item = fixture(id);
  const segment = item.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${item.ageBand}`, chapter_id: 'horizonte-num-b', lesson_id: `hz-num-b-${id}`,
    version_id: 'rev-1', locale, age_band: item.ageBand, eligibility: item.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: item.title[locale], required_capabilities: [...numB.capabilities[String(segment.type) as keyof typeof numB.capabilities]], segments: [segment],
  };
}

describe('num-b pack: F1.4 arrays and area model, F1.5 double number line and ratio tape, F1.6 fraction wall and circles', () => {
  it('meets the scorer contract for every fixture of every type', () => {
    expect(() => assertScorerContract(numB, NUM_B_FIXTURES)).not.toThrow();
    expect(Object.keys(numB.capabilities).sort()).toEqual(['math.array-area.v2', 'math.fraction-circles.v2', 'math.fraction-wall.v2', 'math.ratio-line.v2']);
  });

  it('keeps the array and area model total and exact', () => {
    expect(isArrayPayload({ rows: 3, columns: 4 })).toBe(true);
    expect(isArrayPayload({ rows: 0, columns: 4 })).toBe(false);
    expect(isArrayPayload({ rows: 11, columns: 4 })).toBe(false);
    expect(isArrayPayload({ rows: 3, columns: 4, value: 12 })).toBe(false);
    expect(isAreaModelPayload({ across: 14, down: 7 })).toBe(true);
    expect(isAreaModelPayload({ across: 9, down: 7 })).toBe(false);
    expect(isAreaDivisionPayload({ dividend: 156, divisor: 12 })).toBe(true);
    expect(isAreaDivisionPayload({ dividend: 157, divisor: 12 })).toBe(false);
    expect(isAreaDivisionPayload({ dividend: 12, divisor: 12 })).toBe(false);
    expect(arrayAreaKind({ rows: 3, columns: 4 })).toBe('array');
    expect(arrayAreaKind({ dividend: 156, divisor: 12 })).toBe('area-division');
    expect(arrayAreaKind({ across: 14, down: 12 })).toBe('area-model');
    expect(arrayAreaKind(null)).toBeNull();
    expect(arrayAreaAnswer({ rows: 3, columns: 4 })).toBe(12);
    expect(arrayAreaAnswer({ across: 14, down: 7 })).toBe(98);
    expect(arrayAreaAnswer({ dividend: 156, divisor: 12 })).toBe(13);
    expect(readWholeText('12')).toBe(12);
    expect(readWholeText('')).toBe('blank');
    expect(readWholeText('012')).toBeNull();
    expect(readWholeText('-1')).toBeNull();
    expect(readWholeText(12)).toBeNull();
    expect(standArray({ rows: 3, columns: 4 }, { value: '11' })).toBe('wrong');
    expect(standAreaModel({ across: 14, down: 7 }, { split: 0, partials: ['', ''], value: '' })).toBe('incomplete');
  });

  it('accepts any sound split of the multiplication box and refuses an unsound one', () => {
    const segment = { across: 14, down: 7 };
    expect(standAreaModel(segment, { split: 10, partials: ['70', '28'], value: '98' })).toBe('right');
    expect(standAreaModel(segment, { split: 7, partials: ['49', '49'], value: '98' })).toBe('right');
    expect(standAreaModel(segment, { split: 10, partials: ['70', '27'], value: '98' })).toBe('wrong');
    expect(standAreaModel(segment, { split: 10, partials: ['70', '28'], value: '97' })).toBe('wrong');
    expect(standAreaModel(segment, { split: 10, partials: ['28', '70'], value: '98' })).toBe('wrong');
    expect(standAreaModel(segment, { split: 14, partials: ['98', '0'], value: '98' })).toBe('invalid');
    expect(standAreaModel(segment, { split: 10, partials: ['70'], value: '98' })).toBe('invalid');
    expect(standAreaModel(segment, { split: 10, partials: ['70', '28'], value: '98', extra: 1 })).toBe('invalid');
  });

  it('grades the missing-area division by its partial quotients', () => {
    const segment = { dividend: 156, divisor: 12 };
    expect(standAreaDivision(segment, { partials: ['10', '3'], value: '13' })).toBe('right');
    expect(standAreaDivision(segment, { partials: ['6', '7'], value: '13' })).toBe('right');
    expect(standAreaDivision(segment, { partials: ['10', '4'], value: '13' })).toBe('wrong');
    expect(standAreaDivision(segment, { partials: ['13', '0'], value: '13' })).toBe('wrong');
    expect(standAreaDivision(segment, { partials: ['10', '3'], value: '12' })).toBe('wrong');
    expect(standAreaDivision(segment, { partials: ['', ''], value: '' })).toBe('incomplete');
    expect(standAreaDivision(segment, { partials: ['x', ''], value: '' })).toBe('invalid');
  });

  it('keeps the ratio model total and exact', () => {
    const line = { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 12 } };
    expect(isDoubleLinePayload(line)).toBe(true);
    expect(isDoubleLinePayload({ ...line, given: { line: 'top', value: 13 } })).toBe(false);
    expect(isDoubleLinePayload({ ...line, given: { line: 'top', value: 3 } })).toBe(false);
    expect(isDoubleLinePayload({ ...line, units: ['coins', 'coins'] })).toBe(false);
    expect(isDoubleLinePayload({ ...line, units: ['pencils', 'dragons'] })).toBe(false);
    expect(ratioAnswer(line)).toBe(24);
    expect(ratioAnswer({ ...line, given: { line: 'bottom', value: 24 } })).toBe(12);
    const tape = { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'b' };
    expect(isRatioTapePayload(tape)).toBe(true);
    expect(isRatioTapePayload({ ...tape, whole: 31 })).toBe(false);
    expect(isRatioTapePayload({ ...tape, parts: [9, 9] })).toBe(false);
    expect(ratioAnswer(tape)).toBe(12);
    expect(ratioAnswer({ ...tape, ask: 'a' })).toBe(18);
    expect(ratioKind(tape)).toBe('ratio-tape');
    expect(ratioKind({})).toBeNull();
    expect(standRatio(tape, { value: '12' })).toBe('right');
    expect(standRatio(tape, { value: '18' })).toBe('wrong');
    expect(standRatio(tape, { value: '' })).toBe('incomplete');
    expect(standRatio(tape, { value: 12 })).toBe('invalid');
    expect(standRatio(tape, { value: '1.5' })).toBe('invalid');
  });

  it('keeps the fraction model exact for every operation', () => {
    expect(fractionAnswer({ op: 'equivalent', fraction: [1, 2], denominator: 6 })).toEqual({ n: 3, d: 6 });
    expect(fractionAnswer({ op: 'add', left: [1, 2], right: [1, 3] })).toEqual({ n: 5, d: 6 });
    expect(fractionAnswer({ op: 'add', left: [1, 4], right: [1, 4] })).toEqual({ n: 1, d: 2 });
    expect(fractionAnswer({ op: 'subtract', left: [3, 4], right: [1, 3] })).toEqual({ n: 5, d: 12 });
    expect(fractionAnswer({ op: 'multiply', left: [2, 3], right: [3, 4] })).toEqual({ n: 1, d: 2 });
    expect(fractionAnswer({ op: 'divide', left: [5, 6], right: [1, 3] })).toEqual({ n: 5, d: 2 });
    expect(isFractionPayload({ op: 'equivalent', fraction: [1, 2], denominator: 5 })).toBe(false);
    expect(isFractionPayload({ op: 'equivalent', fraction: [1, 2], denominator: 2 })).toBe(false);
    expect(isFractionPayload({ op: 'equivalent', fraction: [2, 2], denominator: 6 })).toBe(false);
    expect(isFractionPayload({ op: 'subtract', left: [1, 3], right: [1, 2] })).toBe(false);
    expect(isFractionPayload({ op: 'subtract', left: [1, 2], right: [1, 2] })).toBe(false);
    expect(isFractionPayload({ op: 'multiply', left: [1, 8], right: [1, 2] })).toBe(false);
    expect(isFractionPayload({ op: 'divide', left: [1, 3], right: [1, 2] })).toBe(false);
    expect(isFractionPayload({ op: 'power', left: [1, 2], right: [1, 3] })).toBe(false);
    expect(fractionAnswer(null)).toBeNull();
  });

  it('asks the asked denominator for an equivalent and any equal form for the other operations', () => {
    const equivalent = { op: 'equivalent', fraction: [1, 2], denominator: 6 };
    expect(standFraction(equivalent, { n: 3, d: 6 })).toBe('right');
    expect(standFraction(equivalent, { n: 1, d: 2 })).toBe('wrong');
    expect(standFraction(equivalent, { n: 0, d: 6 })).toBe('incomplete');
    const sum = { op: 'add', left: [1, 2], right: [1, 3] };
    expect(standFraction(sum, { n: 5, d: 6 })).toBe('right');
    expect(standFraction(sum, { n: 10, d: 12 })).toBe('right');
    expect(standFraction(sum, { n: 2, d: 5 })).toBe('wrong');
    expect(standFraction(sum, { n: 5, d: 1000 })).toBe('invalid');
    expect(standFraction(sum, { n: 5.5, d: 6 })).toBe('invalid');
    expect(standFraction(sum, { n: 5 })).toBe('invalid');
    expect(keyProblem(sum, { n: 10, d: 12 })).toBeNull();
    expect(keyProblem(sum, { n: 5, d: 7 })).not.toBeNull();
    expect(keyProblem(equivalent, { n: 1, d: 2 })).not.toBeNull();
    expect(keyProblem(sum, { n: 0, d: 6 })).not.toBeNull();
  });

  it('keeps the fraction-circles model exact for every operation', () => {
    expect(circleAnswer({ op: 'show', fraction: [3, 4] })).toEqual({ n: 3, d: 4 });
    expect(circleAnswer({ op: 'show', fraction: [2, 4] })).toEqual({ n: 2, d: 4 });
    expect(circleAnswer({ op: 'compare', left: [3, 8], right: [5, 8] })).toEqual({ n: 5, d: 8 });
    expect(circleAnswer({ op: 'compare', left: [6, 8], right: [5, 8] })).toEqual({ n: 3, d: 4 });
    expect(circleAnswer({ op: 'add', left: [1, 8], right: [3, 8] })).toEqual({ n: 1, d: 2 });
    expect(circleAnswer({ op: 'add', left: [2, 5], right: [3, 5] })).toEqual({ n: 1, d: 1 });
    expect(circleAnswer({ op: 'subtract', left: [7, 10], right: [3, 10] })).toEqual({ n: 2, d: 5 });
    expect(circleOp({ op: 'show', fraction: [3, 4] })).toBe('show');
    expect(circleOp({ op: 'multiply' })).toBeNull();
    expect(circleOp(null)).toBeNull();
    expect(isCirclePayload({ op: 'show', fraction: [4, 4] })).toBe(false);
    expect(isCirclePayload({ op: 'show', fraction: [1, 7] })).toBe(false);
    expect(isCirclePayload({ op: 'show', fraction: [1, 2], extra: 1 })).toBe(false);
    expect(isCirclePayload({ op: 'compare', left: [3, 8], right: [3, 8] })).toBe(false);
    expect(isCirclePayload({ op: 'compare', left: [1, 4], right: [1, 8] })).toBe(false);
    expect(isCirclePayload({ op: 'add', left: [3, 4], right: [2, 4] })).toBe(false);
    expect(isCirclePayload({ op: 'subtract', left: [1, 4], right: [2, 4] })).toBe(false);
    expect(isCirclePayload({ op: 'subtract', left: [2, 4], right: [2, 4] })).toBe(false);
    expect(isCirclePayload({ op: 'add', left: [1, 4], right: [1, 4], n: 1 })).toBe(false);
    expect(circlePayloadProblem({ op: 'add', left: [1, 4], right: [1, 4] })).toBeNull();
    expect(circlePayloadProblem(undefined)).not.toBeNull();
    expect(circleAnswer(null)).toBeNull();
  });

  it('asks the exact form for show and any equal form for the other circle operations', () => {
    const show = { op: 'show', fraction: [2, 4] };
    expect(standCircle(show, { n: 2, d: 4 })).toBe('right');
    expect(standCircle(show, { n: 1, d: 2 })).toBe('wrong');
    expect(standCircle(show, { n: 0, d: 4 })).toBe('incomplete');
    expect(standCircle(show, { n: 0, d: 0 })).toBe('incomplete');
    expect(standCircle(show, { n: 2, d: 1000 })).toBe('invalid');
    expect(standCircle(show, { n: 2 })).toBe('invalid');
    expect(standCircle(show, { n: 2, d: 4, extra: 1 })).toBe('invalid');
    expect(standCircle(show, null)).toBe('invalid');
    expect(standCircle({ op: 'show', fraction: [9, 4] }, { n: 2, d: 4 })).toBe('invalid');
    const add = { op: 'add', left: [1, 8], right: [3, 8] };
    expect(standCircle(add, { n: 1, d: 2 })).toBe('right');
    expect(standCircle(add, { n: 4, d: 8 })).toBe('right');
    expect(standCircle(add, { n: 3, d: 8 })).toBe('wrong');
    expect(standCircle({ op: 'compare', left: [3, 8], right: [5, 8] }, { n: 3, d: 8 })).toBe('wrong');
    expect(circleKeyProblem(show, { n: 2, d: 4 })).toBeNull();
    expect(circleKeyProblem(show, { n: 1, d: 2 })).not.toBeNull();
    expect(circleKeyProblem(add, { n: 4, d: 8 })).toBeNull();
    expect(circleKeyProblem(add, { n: 0, d: 8 })).not.toBeNull();
    expect(circleKeyProblem(add, { n: 1, d: 2, extra: 1 })).not.toBeNull();
    expect(circleKeyProblem({ op: 'add', left: [3, 4], right: [3, 4] }, { n: 1, d: 1 })).not.toBeNull();
  });

  it('grades every fixture: met, review, valid and invalid', () => {
    expect(run('array-rows-columns', { value: '12' }).verdict).toBe('met');
    expect(run('array-rows-columns', { value: '7' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('array-rows-columns', { value: '' }).verdict).toBe('valid');
    expect(run('area-box', { split: 10, partials: ['70', '28'], value: '98' }).verdict).toBe('met');
    expect(run('area-box', { split: 10, partials: ['70', '28'], value: '88' }).verdict).toBe('review');
    expect(run('area-box', { split: 0, partials: ['', ''], value: '' }).verdict).toBe('valid');
    expect(run('area-division', { partials: ['10', '3'], value: '13' }).verdict).toBe('met');
    expect(run('area-division', { partials: ['10', '2'], value: '12' }).verdict).toBe('review');
    expect(run('double-line-scale', { value: '24' }).verdict).toBe('met');
    expect(run('double-line-scale', { value: '15' }).verdict).toBe('review');
    expect(run('tape-share', { value: '12' }).verdict).toBe('met');
    expect(run('tape-share', { value: '18' }).verdict).toBe('review');
    expect(run('wall-equivalent', { n: 3, d: 6 }).verdict).toBe('met');
    expect(run('wall-equivalent', { n: 2, d: 6 }).verdict).toBe('review');
    expect(run('wall-equivalent', { n: 0, d: 6 }).verdict).toBe('valid');
    expect(run('bars-add', { n: 10, d: 12 }).verdict).toBe('met');
    expect(run('bars-subtract', { n: 5, d: 12 }).verdict).toBe('met');
    expect(run('bars-subtract', { n: 2, d: 1 }).verdict).toBe('review');
    expect(run('product-grid', { n: 6, d: 12 }).verdict).toBe('met');
    expect(run('measure-fit', { n: 5, d: 2 }).verdict).toBe('met');
    expect(run('measure-fit', { n: 2, d: 5 }).verdict).toBe('review');
    expect(run('circles-show', { n: 3, d: 4 }).verdict).toBe('met');
    expect(run('circles-show', { n: 6, d: 8 }).verdict).toBe('review');
    expect(run('circles-show', { n: 0, d: 4 }).verdict).toBe('valid');
    expect(run('circles-compare', { n: 5, d: 8 }).verdict).toBe('met');
    expect(run('circles-compare', { n: 3, d: 8 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('circles-add', { n: 1, d: 2 }).verdict).toBe('met');
    expect(run('circles-add', { n: 4, d: 8 }).verdict).toBe('met');
    expect(run('circles-add', { n: 3, d: 8 }).verdict).toBe('review');
    expect(run('circles-subtract', { n: 4, d: 10 }).verdict).toBe('met');
    expect(run('circles-subtract', { n: 3, d: 10 }).verdict).toBe('review');
  });

  it('refuses a key nobody can reach, even for an untouched response', () => {
    expect(run('array-rows-columns', { value: '' }, { value: 13 }).verdict).toBe('invalid');
    expect(run('area-box', { split: 0, partials: ['', ''], value: '' }, { value: 99 }).verdict).toBe('invalid');
    expect(run('area-division', { partials: ['', ''], value: '' }, { value: 12 }).verdict).toBe('invalid');
    expect(run('double-line-scale', { value: '' }, { value: 25 }).verdict).toBe('invalid');
    expect(run('tape-share', { value: '' }, { value: 18 }).verdict).toBe('invalid');
    expect(run('wall-equivalent', { n: 0, d: 6 }, { n: 1, d: 2 }).verdict).toBe('invalid');
    expect(run('bars-add', { n: 0, d: 0 }, { n: 5, d: 7 }).verdict).toBe('invalid');
    expect(run('bars-add', { n: 0, d: 0 }, { n: 5, d: 6, extra: 1 }).verdict).toBe('invalid');
    expect(run('circles-show', { n: 0, d: 0 }, { n: 1, d: 2 }).verdict).toBe('invalid');
    expect(run('circles-compare', { n: 0, d: 0 }, { n: 3, d: 8 }).verdict).toBe('invalid');
    expect(run('circles-add', { n: 0, d: 0 }, { n: 1, d: 2, extra: 1 }).verdict).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const item of NUM_B_FIXTURES) {
      const grade = numB.scorers[String(item.segment('en-US').type)]!.grade as unknown as Grade;
      expect(grade(item.segment('en-US'), item.ladder.met, undefined).verdict, item.id).toBe('valid');
      expect(grade(item.segment('en-US'), item.ladder.invalid, undefined).verdict, item.id).toBe('invalid');
    }
  });

  it('refuses a segment whose visual does not match its payload', () => {
    const item = fixture('area-box');
    const grade = numB.scorers['math.array-area.v2']!.grade as unknown as Grade;
    expect(grade({ ...item.segment('en-US'), visual: { type: 'array' } }, item.ladder.met, item.rubric).verdict).toBe('invalid');
    expect(grade({ ...item.segment('en-US'), payload: { across: 9, down: 7 } }, item.ladder.met, item.rubric).verdict).toBe('invalid');
  });

  it('is open to the ages each piece declares and never to the adult pathway', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('math.array-area.v2', '6-9', 8, 9)).toBeNull();
    expect(scope('math.array-area.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.array-area.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('math.fraction-wall.v2', '6-9', 8, 9)).toBeNull();
    expect(scope('math.fraction-wall.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.fraction-circles.v2', '6-9', 8, 9)).toBeNull();
    expect(scope('math.fraction-circles.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.fraction-circles.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('math.ratio-line.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('math.ratio-line.v2', '6-9', 8, 9)).not.toBeNull();
    for (const type of Object.keys(numB.capabilities)) {
      expect(scope(type, '13-17', 13, 17), type).not.toBeNull();
      expect(scope(type, 'adult', 18, 99), type).not.toBeNull();
    }
  });

  it('plugs into Core: public schema, answer key and the server grade, in every locale', () => {
    for (const item of NUM_B_FIXTURES) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(item.id, locale)).success, `${item.id} ${locale}`).toBe(true);
      const document = lesson(item.id);
      const id = item.segment('en-US').id as string;
      const keys = { [id]: item.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), item.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, item.ladder.met), item.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, item.ladder.valid), item.id).toBeNull();
      expect(horizonteSampleVerdict(item.segment('en-US') as { type: string }, item.rubric), item.id).toBe('valid');
    }
    const item = fixture('tape-share');
    expect(horizonteGrade({ type: 'math.ratio-line.v2' }, item.ladder.met, item.rubric)).toBeNull();
    const document = lesson('tape-share');
    const parsed = v2PublicLessonSchema.parse(document);
    expect(gradeV2Visual(parsed, { 'tape-share': item.rubric }, 'tape-share', { value: '18' })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
    expect(validateV2LessonForGrading(document, { 'tape-share': { value: 18 } }, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson('array-rows-columns');
    const segment = base.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, payload: { rows: 3, columns: 4, value: 12 } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, visual: { type: 'area-model' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const wall = lesson('bars-add');
    const wallSegment = wall.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...wall, segments: [{ ...wallSegment, visual: { type: 'fraction-wall' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...wall, segments: [{ ...wallSegment, payload: { op: 'add', left: [1, 2], right: [1, 3], n: 5, d: 6 } }] }).success).toBe(false);
    const circles = lesson('circles-add');
    const circleSegment = circles.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...circles, segments: [{ ...circleSegment, visual: { type: 'fraction-wall' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...circles, segments: [{ ...circleSegment, payload: { op: 'add', left: [1, 8], right: [3, 8], n: 1, d: 2 } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...circles, segments: [{ ...circleSegment, payload: { op: 'add', left: [3, 4], right: [2, 4] } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...circles, segments: [{ ...circleSegment, payload: { op: 'add', left: [1, 4], right: [1, 8] } }] }).success).toBe(false);
  });
});
