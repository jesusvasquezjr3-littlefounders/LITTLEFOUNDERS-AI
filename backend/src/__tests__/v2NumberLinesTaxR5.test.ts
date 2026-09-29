import { describe, expect, it } from 'vitest';
import { gradeV2Visual, validateV2LessonForGrading, v2PublicLessonSchema } from '../services/v2LessonDocument.js';
import { gradeV2Response, lineUnits, scoreV2Visual } from '../services/v2VisualScorer.js';
import { behaviourSpace } from '../services/forgeV2Behaviour.js';
import { v2ScorerPayload } from '../services/v2ScorerPayload.js';

/*
 * GAP-FIX-R5 learning (Appendix P Part 1 M2, M3, M20; Part 4.6; Part 7.2; B.7
 * part 3). The server grades what Appendix P says it grades:
 *   M2  position error as a share of the line (PAE) within a tolerance; the
 *       order of placed items; bounded 0-10, 0-100, 0-1000 lines only;
 *   M3  placement error; a comparison choice; equivalents land on one point;
 *       a typed decimal is graded as an exact rational;
 *   M20 tax owed, the marginal rate AND the average rate.
 * Every case below would have failed on the old exact-match or three-field
 * scorer (the red team for this checkpoint).
 */

const LINE = { minimum: 0, maximum: 100, step: 1 };
const doc = (segment: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'counting-on', lesson_id: 'lesson-r5-001',
  version_id: 'rev-r5-001', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-number-magnitude'],
  adventure_scene_id: 'diorama-a', title: 'Coins on the line', required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'],
  segments: [{ id: 'line-01', type: 'math.number-line.whole.v2', grading: 'server', prompt: 'Place it.', visual: { type: 'number-line' }, ...segment }], ...extra,
});

describe('M2: PAE within a tolerance, ordered items, bounded lines', () => {
  const rubric = { target: 37, tolerance_share: 0.05 };
  it('meets an estimate within 5% of a 0-100 line, not only the exact integer (the old exact match refused 35)', () => {
    for (const value of ['32', '35', '37', '42']) expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value }, rubric), value).toBe('met');
    for (const value of ['31', '43', '0', '100']) expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value }, rubric), value).toBe('review');
    expect(gradeV2Response('math.number-line.whole.v2', LINE, { value: '35' }, rubric)).toEqual({ verdict: 'met', diagnostic: 'none', pae: 0.02 });
    expect(gradeV2Response('math.number-line.whole.v2', LINE, { value: '50' }, rubric)).toEqual({ verdict: 'review', diagnostic: 'tolerance', pae: 0.13 });
  });

  it('keeps an exact target when the key names no tolerance, and refuses a malformed tolerance', () => {
    expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value: '36' }, { target: 37 })).toBe('review');
    expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value: '37' }, { target: 37 })).toBe('met');
    for (const bad of [{ target: 37, tolerance_share: 0.3 }, { target: 37, tolerance_share: -0.01 }, { target: 37, tolerance_share: 0.00001 },
      { target: 37, tolerance: 5 }, { target: 101 }, { target: 37, tolerance_share: '0.05' }]) {
      expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value: '37' }, bad), JSON.stringify(bad)).toBe('invalid');
    }
  });

  it('counting on keeps its exact landing square: a tolerance there is a malformed key', () => {
    const hops = { ...LINE, initial: 37, hops: [1, 10] };
    expect(scoreV2Visual('math.number-line.whole.v2', hops, { value: '48', hops: [10, 1] }, { target: 50, tolerance_share: 0.05 })).toBe('invalid');
    expect(gradeV2Response('math.number-line.whole.v2', hops, { value: '50', hops: [10, 1, 1, 1] }, { target: 50 })).toMatchObject({ verdict: 'met', pae: 0 });
  });

  const items = { ...LINE, itemIds: ['coins-dina', 'coins-zara', 'coins-liruf'] };
  const itemKey = { targets: { 'coins-dina': 20, 'coins-zara': 45, 'coins-liruf': 80 }, tolerance_share: 0.05 };
  const place = (dina: number, zara: number, liruf: number) => ({ placements: { 'coins-dina': String(dina), 'coins-zara': String(zara), 'coins-liruf': String(liruf) } });
  it('grades the order of placed items first, then each one within the tolerance', () => {
    expect(gradeV2Response('math.number-line.whole.v2', items, place(22, 44, 79), itemKey)).toMatchObject({ verdict: 'met', diagnostic: 'none' });
    // Out of order is a structure error even when two of the three are close.
    expect(gradeV2Response('math.number-line.whole.v2', items, place(20, 82, 80), itemKey)).toMatchObject({ verdict: 'review', diagnostic: 'structure' });
    // In order but one too far away is a tolerance miss; the PAE is the largest error (30 vs 20 on 0-100).
    expect(gradeV2Response('math.number-line.whole.v2', items, place(30, 45, 80), itemKey)).toEqual({ verdict: 'review', diagnostic: 'tolerance', pae: 0.1 });
    // Two items on one point are not ordered.
    expect(gradeV2Response('math.number-line.whole.v2', items, place(45, 45, 80), itemKey)).toMatchObject({ diagnostic: 'structure' });
  });

  it('refuses impossible item states and malformed item keys', () => {
    for (const response of [{ placements: { 'coins-dina': '20', 'coins-zara': '45' } }, { placements: { ...place(20, 45, 80).placements, extra: '1' } },
      place(20, 45, 101), { placements: { ...place(20, 45, 80).placements, 'coins-dina': '20.5' } }, { value: '20' }]) {
      expect(scoreV2Visual('math.number-line.whole.v2', items, response, itemKey), JSON.stringify(response)).toBe('invalid');
    }
    expect(scoreV2Visual('math.number-line.whole.v2', items, place(20, 45, 80), { ...itemKey, targets: { 'coins-dina': 20, 'coins-zara': 20, 'coins-liruf': 80 } })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.whole.v2', items, place(20, 45, 80), { target: 20 })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.whole.v2', LINE, { value: '20' }, itemKey)).toBe('invalid');
  });

  it('enforces the bounded ranges and the item rules in the public contract', () => {
    const ok = (payload: Record<string, unknown>) => v2PublicLessonSchema.safeParse(doc({ payload })).success;
    expect(ok({ minimum: 0, maximum: 10, step: 1, initial: 0 })).toBe(true);
    expect(ok({ minimum: 0, maximum: 1000, step: 10, initial: 0 })).toBe(true);
    for (const payload of [{ minimum: 0, maximum: 20, step: 1, initial: 0 }, { minimum: 5, maximum: 100, step: 1, initial: 5 }, { minimum: 0, maximum: 50, step: 1, initial: 0 }]) {
      expect(ok(payload), JSON.stringify(payload)).toBe(false);
    }
    const labelled = [{ id: 'coins-dina', label: 'Dina' }, { id: 'coins-zara', label: 'Zara' }];
    expect(ok({ ...LINE, initial: 0, items: labelled })).toBe(true);
    expect(ok({ ...LINE, initial: 0, items: [labelled[0], labelled[0]] })).toBe(false);
    expect(ok({ ...LINE, initial: 0, items: labelled, hops: [1] })).toBe(false);
    expect(ok({ ...LINE, initial: 0, items: [labelled[0]] })).toBe(false);
  });

  it('grades the whole document through Core, stores the PAE and refuses a key that does not match the mode', () => {
    const document = doc({ payload: { ...LINE, initial: 0, items: [{ id: 'coins-dina', label: 'Dina' }, { id: 'coins-zara', label: 'Zara' }] } });
    const keys = { 'line-01': { targets: { 'coins-dina': 20, 'coins-zara': 45 }, tolerance_share: 0.05 } };
    const validated = validateV2LessonForGrading(document, keys, { lessonId: 'lesson-r5-001', locale: 'en-US' })!;
    expect(validated).not.toBeNull();
    expect(gradeV2Visual(validated, keys, 'line-01', { placements: { 'coins-dina': '24', 'coins-zara': '47' } })).toMatchObject({ correct: true, diagnostic: 'none', pae: 0.04 });
    expect(validateV2LessonForGrading(document, { 'line-01': { target: 20 } }, { lessonId: 'lesson-r5-001', locale: 'en-US' })).toBeNull();
    expect(v2ScorerPayload(validated.segments[0] as never)).toEqual({ ...LINE, itemIds: ['coins-dina', 'coins-zara'] });
  });

  it('the behaviour gate meets exactly the within-tolerance states (old exact-match would fail it)', () => {
    const space = behaviourSpace({ type: 'math.number-line.whole.v2', payload: { ...LINE, initial: 0 } }, rubric)!;
    const met = space.inRange.filter((response) => space.expectMet!(response as never)).map((response) => (response as { value: string }).value);
    expect(met).toEqual(['32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42']);
  });
});

describe('M3: fractions and decimals, a comparison, equivalents on one point', () => {
  it('reads a fraction or a decimal as snap units on the line', () => {
    expect(lineUnits('3/4', 1, 4)).toBe(3);
    expect(lineUnits('0.75', 1, 4)).toBe(3);
    expect(lineUnits('1.5', 2, 4)).toBe(6);
    expect(lineUnits('0.6', 1, 10)).toBe(6);
    for (const value of ['0.7', '2.25', '5/4', '-0.25', '0,75', '1e0', ' 0.5']) expect(lineUnits(value, 1, 4), value).toBeNull();
  });

  const place = { maximumWhole: 1, divisions: 4 };
  it('grades a typed decimal as an exact rational against the placement key', () => {
    const key = { targetNumerator: 3, targetDenominator: 4, toleranceUnits: 0 };
    expect(gradeV2Response('math.number-line.fraction.v2', place, { value: '0.75' }, key)).toEqual({ verdict: 'met', diagnostic: 'none', pae: 0 });
    expect(gradeV2Response('math.number-line.fraction.v2', place, { value: '0.5' }, key)).toEqual({ verdict: 'review', diagnostic: 'tolerance', pae: 0.25 });
  });

  const compare = { maximumWhole: 1, divisions: 10, compare_values: ['2/5', '0.5'] };
  const compareKey = { choice: 'second', toleranceUnits: 0 };
  it('grades the comparison choice after both numbers are placed', () => {
    const answer = (first: string, second: string, choice: string) => ({ placements: { first, second }, choice });
    expect(gradeV2Response('math.number-line.fraction.v2', compare, answer('4/10', '0.5', 'second'), compareKey)).toMatchObject({ verdict: 'met' });
    expect(gradeV2Response('math.number-line.fraction.v2', compare, answer('2/5', '5/10', 'first'), compareKey)).toMatchObject({ verdict: 'review', diagnostic: 'value' });
    expect(gradeV2Response('math.number-line.fraction.v2', compare, answer('2/5', '7/10', 'second'), compareKey)).toMatchObject({ verdict: 'review', diagnostic: 'partial' });
    expect(gradeV2Response('math.number-line.fraction.v2', compare, answer('1/10', '9/10', 'second'), compareKey)).toMatchObject({ verdict: 'review', diagnostic: 'tolerance' });
    // A key that is not the true comparison is a content defect, never a grade; a missing choice is refused.
    expect(scoreV2Visual('math.number-line.fraction.v2', compare, answer('2/5', '0.5', 'first'), { choice: 'first', toleranceUnits: 0 })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.fraction.v2', compare, { placements: { first: '2/5', second: '0.5' } }, compareKey)).toBe('invalid');
    expect(scoreV2Visual('math.number-line.fraction.v2', compare, answer('2/5', '0.5', 'bigger'), compareKey)).toBe('invalid');
  });

  const equivalents = { maximumWhole: 1, divisions: 10, equivalent_values: ['3/5', '0.6'] };
  it('meets equivalents only when both forms land on one point', () => {
    const answer = (first: string, second: string) => ({ placements: { first, second } });
    expect(gradeV2Response('math.number-line.fraction.v2', equivalents, answer('6/10', '0.6'), { toleranceUnits: 0 })).toMatchObject({ verdict: 'met' });
    expect(gradeV2Response('math.number-line.fraction.v2', equivalents, answer('6/10', '0.5'), { toleranceUnits: 0 })).toMatchObject({ diagnostic: 'partial' });
    // Within a one-unit tolerance each, but not one point: still not met.
    expect(gradeV2Response('math.number-line.fraction.v2', equivalents, answer('5/10', '0.7'), { toleranceUnits: 1 })).toMatchObject({ verdict: 'review', diagnostic: 'partial' });
    expect(gradeV2Response('math.number-line.fraction.v2', equivalents, answer('1/10', '0.2'), { toleranceUnits: 0 })).toMatchObject({ diagnostic: 'tolerance' });
    expect(scoreV2Visual('math.number-line.fraction.v2', { ...equivalents, equivalent_values: ['3/5', '0.5'] }, answer('6/10', '0.6'), { toleranceUnits: 0 })).toBe('invalid');
  });

  it('refuses malformed pairs in the public contract', () => {
    const fractionDoc = (payload: Record<string, unknown>) => ({
      ...doc({}), age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-fraction-magnitude'],
      required_capabilities: ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'],
      segments: [{ id: 'fraction-01', type: 'math.number-line.fraction.v2', grading: 'server', prompt: 'Place them.', visual: { type: 'number-line' },
        payload: { maximumWhole: 1, divisions: 10, initialUnits: 0, spokenText: 'two fifths and one half', ...payload } }],
    });
    const ok = (payload: Record<string, unknown>) => v2PublicLessonSchema.safeParse(fractionDoc(payload)).success;
    expect(ok({ compare_values: ['2/5', '0.5'] })).toBe(true);
    expect(ok({ equivalent_values: ['3/5', '0.6'] })).toBe(true);
    for (const payload of [{ compare_values: ['1/3', '0.5'] }, { equivalent_values: ['3/5', '0.5'] }, { equivalent_values: ['0.6', '0.6'] },
      { compare_values: ['2/5', '0.5'], equivalent_values: ['3/5', '0.6'] }, { compare_values: ['2/5', '1.5'] }, { compare_values: ['2/5', '0,5'] }]) {
      expect(ok(payload), JSON.stringify(payload)).toBe(false);
    }
  });
});

describe('M20: tax owed, the marginal rate and the average rate', () => {
  const payload = { minimumIncomeMinor: 0, maximumIncomeMinor: 60_000, incomeStepMinor: 5_000,
    brackets: [{ upToMinor: 10_000, rateBasisPoints: 1_000 }, { upToMinor: 30_000, rateBasisPoints: 2_000 }, { upToMinor: null, rateBasisPoints: 3_000 }] };
  // 45 000: 1 000 + 4 000 + 4 500 = 9 500 tax; marginal 30%; average 9 500 / 45 000 = 21.11% (2 111 bps).
  const right = { incomeMinor: 45_000, taxMinor: '9500', marginalBps: 3_000, averageBps: 2_111 };
  it('refuses the old three-field answer: the average rate is part of what is graded', () => {
    const old = { incomeMinor: right.incomeMinor, taxMinor: right.taxMinor, marginalBps: right.marginalBps };
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, old, { income_minor: 45_000 })).toBe('invalid');
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, { ...right, averageBps: 10_001 }, { income_minor: 45_000 })).toBe('invalid');
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, { ...right, averageBps: 21.11 }, { income_minor: 45_000 })).toBe('invalid');
  });

  it('meets all three, accepts a whole-percent average within half a point, and returns partial for some of three', () => {
    expect(gradeV2Response('visual.tax-bracket.v2', payload, right, { income_minor: 45_000 })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(gradeV2Response('visual.tax-bracket.v2', payload, { ...right, averageBps: 2_100 }, { income_minor: 45_000 })).toMatchObject({ verdict: 'met' });
    // The misconception M20 exists to teach: the marginal rate given as the average.
    expect(gradeV2Response('visual.tax-bracket.v2', payload, { ...right, averageBps: 3_000 }, { income_minor: 45_000 })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(gradeV2Response('visual.tax-bracket.v2', payload, { ...right, averageBps: 2_100 }, { income_minor: 45_000, average_tolerance_bps: 0 })).toMatchObject({ diagnostic: 'partial' });
    expect(gradeV2Response('visual.tax-bracket.v2', payload, { incomeMinor: 45_000, taxMinor: '1', marginalBps: 1_000, averageBps: 3_000 }, { income_minor: 45_000 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, right, { income_minor: 45_000, average_tolerance_bps: 101 })).toBe('invalid');
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, right, { income_minor: 45_000, extra: 1 })).toBe('invalid');
  });
});
