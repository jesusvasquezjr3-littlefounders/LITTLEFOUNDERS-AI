import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { golden } from '../../services/horizonte/golden/index.js';
import { GOLDEN_FIXTURES } from '../../services/horizonte/golden/fixtures.js';
import { cellFilled, emptyCells, isTenFrameCounts, respectsRule, targetReachable, tenFrameTotal } from '../../services/horizonte/golden/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

const TYPE = 'math.ten-frame.v2';
const scorer = golden.scorers[TYPE]!;
type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = scorer.grade as unknown as Grade;
const single = GOLDEN_FIXTURES[0]!;
const double = GOLDEN_FIXTURES[1]!;

function lesson(fixture = single, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-6-9', chapter_id: 'horizonte-golden', lesson_id: `hz-golden-${fixture.id}`,
    version_id: 'rev-1', locale, age_band: '6-9', eligibility: fixture.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: fixture.title[locale], required_capabilities: ['visual.ten-frame.v1', 'operation.drag-chips.v1', 'operation.tap-cells.v1'], segments: [fixture.segment(locale)],
  };
}

describe('golden pack: F1.1 ten frame and double ten frame (A03, A04)', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(golden, GOLDEN_FIXTURES)).not.toThrow();
  });

  it('keeps the frame model total', () => {
    expect(isTenFrameCounts([6])).toBe(true);
    expect(isTenFrameCounts([6, 4, 1])).toBe(false);
    expect(isTenFrameCounts([11])).toBe(false);
    expect(isTenFrameCounts([2.5])).toBe(false);
    expect(isTenFrameCounts([3, 4], 1)).toBe(false);
    expect(tenFrameTotal([8, 5])).toBe(13);
    expect(emptyCells([8, 5])).toBe(7);
    expect(cellFilled(3, 2)).toBe(true);
    expect(cellFilled(3, 3)).toBe(false);
    expect(respectsRule([6], [5])).toBe(false);
    expect(respectsRule([8, 5], [10, 3])).toBe(true);
    expect(respectsRule([8, 5], [10, 4])).toBe(false);
    expect(targetReachable([6], [6])).toBe(false);
    expect(targetReachable([6], [10])).toBe(true);
  });

  it('grades one frame against the private target', () => {
    const segment = single.segment('en-US');
    expect(grade(segment, { counts: [10] }, single.rubric).verdict).toBe('met');
    expect(grade(segment, { counts: [8] }, single.rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(grade(segment, { counts: [6] }, single.rubric).verdict).toBe('valid');
    expect(grade(segment, { counts: [4] }, single.rubric).verdict).toBe('invalid');
    expect(grade(segment, { counts: [10, 0] }, single.rubric).verdict).toBe('invalid');
    expect(grade(segment, { counts: [10], extra: 1 }, single.rubric).verdict).toBe('invalid');
  });

  it('grades two frames and keeps the total', () => {
    const segment = double.segment('en-US');
    expect(grade(segment, { counts: [10, 3] }, double.rubric).verdict).toBe('met');
    expect(grade(segment, { counts: [3, 10] }, double.rubric).verdict).toBe('review');
    expect(grade(segment, { counts: [9, 4] }, double.rubric).verdict).toBe('review');
    expect(grade(segment, { counts: [8, 5] }, double.rubric).verdict).toBe('valid');
    expect(grade(segment, { counts: [10, 4] }, double.rubric).verdict).toBe('invalid');
    expect(grade(segment, { counts: [10] }, double.rubric).verdict).toBe('invalid');
  });

  it('refuses an unreachable or unchanged target as a malformed key', () => {
    expect(grade(single.segment('en-US'), { counts: [10] }, { target: [6] }).verdict).toBe('invalid');
    expect(grade(single.segment('en-US'), { counts: [10] }, { target: [4] }).verdict).toBe('invalid');
    expect(grade(double.segment('en-US'), { counts: [10, 3] }, { target: [10, 4] }).verdict).toBe('invalid');
    expect(grade(double.segment('en-US'), { counts: [10, 3] }, { target: [10] }).verdict).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    expect(grade(single.segment('en-US'), { counts: [10] }, undefined).verdict).toBe('valid');
    expect(grade(single.segment('en-US'), { counts: [2] }, undefined).verdict).toBe('invalid');
  });

  it('is open to ages 6-9 only', () => {
    const scope = (band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type: TYPE }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('6-9', 6, 9)).toBeNull();
    expect(scope('10-12', 10, 12)).not.toBeNull();
    expect(scope('13-17', 13, 17)).not.toBeNull();
    expect(scope('adult', 18, 99)).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(single, locale)).success, locale).toBe(true);
    const document = lesson(double);
    const id = double.segment('en-US').id as string;
    const keys = { [id]: double.rubric };
    const expected = { lessonId: document.lesson_id, locale: document.locale };
    expect(validateV2LessonForGrading(document, keys, expected)).not.toBeNull();
    expect(validateV2LessonForGrading(document, { [id]: { target: [8, 5] } }, expected)).toBeNull();
    const parsed = v2PublicLessonSchema.parse(document);
    expect(gradeV2Visual(parsed, keys, id, { counts: [10, 3] })).toMatchObject({ score: 100, correct: true });
    expect(gradeV2Visual(parsed, keys, id, { counts: [9, 4] })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
    expect(gradeV2Visual(parsed, keys, id, { counts: [8, 5] })).toBeNull();
    expect(horizonteGrade({ type: TYPE }, { counts: [10, 3] }, double.rubric)).toBeNull();
    expect(horizonteSampleVerdict(double.segment('en-US') as { type: string }, double.rubric)).toBe('valid');
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson(single);
    const withVisual = (visual: string) => ({ ...base, segments: [{ ...base.segments[0], visual: { type: visual } }] });
    expect(v2PublicLessonSchema.safeParse(withVisual('double-ten-frame')).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], payload: { start: [6], target: [10] } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } }).success).toBe(false);
  });
});
