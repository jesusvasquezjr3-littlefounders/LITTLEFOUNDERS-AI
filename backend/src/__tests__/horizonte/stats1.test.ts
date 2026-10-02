import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { stats1 } from '../../services/horizonte/stats1/index.js';
import { STATS1_CAPABILITIES } from '../../services/horizonte/stats1/capabilities.js';
import { STATS1_FIXTURES } from '../../services/horizonte/stats1/fixtures.js';
import {
  binomialPmf, binomialShareWithin, erf, isBinomialAnswer, meanPmf, meanSpread, normalBetween, normalWithin, populationMoments, solveBinomial, solveClt, solveNormal, sumPmf,
} from '../../services/horizonte/stats1/distributions.js';
import {
  balancePoint, dotMeasureMet, dotMeasureValue, dotMode, dotTargetReachable, dotsMoved, isAxis, isDots, respectsDotRule, sameDots,
} from '../../services/horizonte/stats1/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: string) => stats1.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => STATS1_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const verdictOf = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric).verdict;

function lesson(entry = STATS1_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  const type = segment.type as keyof typeof STATS1_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-stats', chapter_id: 'horizonte-stats1', lesson_id: `hz-stats1-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...STATS1_CAPABILITIES[type]], segments: [segment],
  };
}

describe('stats1 pack: F1.13 dot plots and the balance point, F1.14 normal, binomial and CLT', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(stats1, STATS1_FIXTURES)).not.toThrow();
  });

  it('declares every segment type with a fixture, a rubric and a scope', () => {
    const types = Object.keys(STATS1_CAPABILITIES).sort();
    expect(types).toEqual(['stats.balance-point.v2', 'stats.binomial.v2', 'stats.clt.v2', 'stats.dot-plot.v2', 'stats.normal.v2']);
    for (const type of types) expect(STATS1_FIXTURES.some((entry) => entry.segment('en-US').type === type), type).toBe(true);
    expect(STATS1_FIXTURES.map((entry) => entry.id)).toHaveLength(8);
  });

  it('keeps the dot model exact and total', () => {
    const axis = { min: 0, max: 10 };
    expect(isAxis(axis)).toBe(true);
    expect(isAxis({ min: 0, max: 2 })).toBe(false);
    expect(isAxis({ min: 0, max: 50 })).toBe(false);
    expect(isAxis({ min: 0, max: 10, extra: 1 })).toBe(false);
    expect(isDots([1, 2, 3], axis)).toBe(true);
    expect(isDots([1, 2], axis)).toBe(false);
    expect(isDots([1, 2, 11], axis)).toBe(false);
    expect(isDots([1, 2, 2.5], axis)).toBe(false);
    expect(sameDots([3, 1, 2], [1, 2, 3])).toBe(true);
    expect(dotsMoved([1, 2, 3], [3, 2, 1])).toBe(0);
    expect(dotsMoved([1, 2, 3], [1, 2, 9])).toBe(1);
    expect(respectsDotRule([1, 2, 3], [1, 2, 9], axis, 1)).toBe(true);
    expect(respectsDotRule([1, 2, 3], [7, 8, 9], axis, 2)).toBe(false);
    expect(respectsDotRule([1, 2, 3], [1, 2], axis, 2)).toBe(false);
    expect(dotMode([1, 2, 2, 3])).toBe(2);
    expect(dotMode([1, 1, 2, 2])).toBeNull();
    expect(dotMeasureValue('median', [1, 2, 3, 4])).toBe(2.5);
    expect(dotMeasureMet('median', [1, 2, 3, 4], 2.5)).toBe(true);
    expect(dotMeasureMet('mean', [1, 2, 2, 5], 2.5)).toBe(true);
    expect(dotMeasureMet('mode', [1, 1, 2, 2], 1)).toBe(false);
    expect(balancePoint([1, 2, 3])).toBe(2);
    expect(balancePoint([1, 2])).toBeNull();
  });

  it('proves a target reachable only when some allowed move reaches it', () => {
    const axis = { min: 0, max: 10 };
    expect(dotTargetReachable([2, 3, 4, 4, 5, 7, 9], axis, 'median', 2, 6)).toBe(true);
    expect(dotTargetReachable([2, 3, 4, 4, 5, 7, 9], axis, 'median', 1, 6)).toBe(false);
    expect(dotTargetReachable([2, 3, 4, 4, 5, 7, 9], axis, 'median', 2, 4)).toBe(false);
    expect(dotTargetReachable([1, 2, 3, 3, 3, 4, 5, 6], { min: 0, max: 8 }, 'mode', 1, 5)).toBe(false);
    expect(dotTargetReachable([1, 2, 3, 3, 3, 4, 5, 6], { min: 0, max: 8 }, 'mode', 2, 5)).toBe(true);
    expect(dotTargetReachable([1, 3, 4, 4, 5, 7], axis, 'mean', 1, 6)).toBe(false);
    expect(dotTargetReachable([1, 3, 4, 4, 5, 7], axis, 'mean', 2, 6)).toBe(true);
    expect(dotTargetReachable([1, 3, 4, 4, 5, 7], axis, 'mean', 2, 99)).toBe(false);
  });

  it('grades the dot plot against the private target', () => {
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9] })).toBe('met');
    expect(grade('stats.dot-plot.v2')(segmentOf('dot-plot-median'), { dots: [2, 3, 4, 5, 5, 7, 9] }, fixture('dot-plot-median').rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(verdictOf('dot-plot-median', { dots: [9, 7, 5, 4, 4, 3, 2] })).toBe('valid');
    expect(verdictOf('dot-plot-median', { dots: [6, 6, 6, 6, 6, 6, 6] })).toBe('invalid');
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9], extra: 1 })).toBe('invalid');
    expect(verdictOf('dot-plot-mode', { dots: [1, 2, 3, 4, 5, 5, 5, 6] })).toBe('met');
    expect(verdictOf('dot-plot-mode', { dots: [1, 2, 3, 3, 4, 5, 5, 6] })).toBe('review');
    expect(verdictOf('dot-plot-mean', { dots: [10, 3, 4, 7, 5, 7] })).toBe('met');
    expect(verdictOf('dot-plot-mean', { dots: [1, 3, 4, 4, 5, 10] })).toBe('review');
  });

  it('refuses a dot plot key nothing can reach, or one the start already meets', () => {
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9] }, { target: 4 })).toBe('invalid');
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9] }, { target: 11 })).toBe('invalid');
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9] }, { target: 'six' })).toBe('invalid');
    expect(verdictOf('dot-plot-median', { dots: [4, 4, 5, 6, 7, 7, 9] }, { target: 6, extra: 1 })).toBe('invalid');
    expect(verdictOf('dot-plot-mean', { dots: [3, 4, 5, 7, 7, 10] }, { target: 6.5 })).toBe('invalid');
  });

  it('grades the balance point and refuses a key that is not the mean', () => {
    expect(verdictOf('balance-level', { pivot: 5 })).toBe('met');
    expect(verdictOf('balance-level', { pivot: 6 })).toBe('review');
    expect(verdictOf('balance-level', { pivot: 3 })).toBe('valid');
    expect(verdictOf('balance-level', { pivot: 13 })).toBe('invalid');
    expect(verdictOf('balance-level', { pivot: 5.5 })).toBe('invalid');
    expect(verdictOf('balance-level', { pivot: 6 }, { target: 6 })).toBe('invalid');
    expect(verdictOf('balance-level', { pivot: 3 }, { target: 3 })).toBe('invalid');
  });

  it('solves the normal band by the 68-95-99.7 rule', () => {
    const axis = { min: 0, max: 100 };
    expect(solveNormal(axis, { rule: 2, low: 40, high: 60 }, 20)).toEqual({ mean: 50, sd: 5 });
    expect(solveNormal(axis, { rule: 1, low: 40, high: 60 }, 20)).toEqual({ mean: 50, sd: 10 });
    expect(solveNormal(axis, { rule: 3, low: 41, high: 59 }, 20)).toEqual({ mean: 50, sd: 3 });
    expect(solveNormal(axis, { rule: 2, low: 41, high: 60 }, 20)).toBeNull();
    expect(solveNormal(axis, { rule: 2, low: 40, high: 62 }, 20)).toBeNull();
    expect(solveNormal(axis, { rule: 2, low: 40, high: 60 }, 4)).toBeNull();
    expect(erf(0)).toBe(0);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 12);
    expect(normalWithin(1)).toBeCloseTo(0.6826894921370859, 12);
    expect(normalWithin(2)).toBeCloseTo(0.9544997361036416, 12);
    expect(normalWithin(3)).toBeCloseTo(0.9973002039367398, 12);
    expect(normalBetween(40, 60, 50, 5)).toBeCloseTo(0.9544997361036416, 12);
  });

  it('grades the normal curve', () => {
    expect(verdictOf('normal-95', { mean: 50, sd: 5 })).toBe('met');
    expect(verdictOf('normal-95', { mean: 50, sd: 10 })).toBe('review');
    expect(verdictOf('normal-95', { mean: 30, sd: 10 })).toBe('valid');
    expect(verdictOf('normal-95', { mean: 50, sd: 25 })).toBe('invalid');
    expect(verdictOf('normal-95', { mean: 50 })).toBe('invalid');
    expect(verdictOf('normal-95', { mean: 50, sd: 5 }, { target: { mean: 50, sd: 10 } })).toBe('invalid');
    expect(verdictOf('normal-68', { mean: 100, sd: 10 })).toBe('met');
    expect(verdictOf('normal-68', { mean: 100, sd: 5 })).toBe('review');
  });

  it('solves the binomial with whole numbers and a unique pair', () => {
    expect(solveBinomial({ mean: 10, variance: 5 }, 40)).toEqual({ n: 20, pct: 50 });
    expect(solveBinomial({ mean: 8, variance: 6 }, 40)).toEqual({ n: 32, pct: 25 });
    expect(solveBinomial({ mean: 12, variance: 9 }, 40)).toBeNull();
    expect(solveBinomial({ mean: 15, variance: 3 }, 40)).toBeNull();
    expect(solveBinomial({ mean: 10, variance: 10 }, 40)).toBeNull();
    expect(solveBinomial({ mean: 10, variance: 3 }, 40)).toBeNull();
    expect(isBinomialAnswer({ n: 20, pct: 50 }, 40)).toBe(true);
    expect(isBinomialAnswer({ n: 20, pct: 52 }, 40)).toBe(false);
    expect(isBinomialAnswer({ n: 41, pct: 50 }, 40)).toBe(false);
    const pmf = binomialPmf(20, 50);
    expect(pmf).toHaveLength(21);
    expect(pmf.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
    expect(pmf[10]).toBeCloseTo(0.17619705200195312, 12);
    expect(binomialShareWithin(20, 50, 2)).toBeGreaterThan(0.9);
  });

  it('grades the binomial', () => {
    expect(verdictOf('binomial-fair', { n: 20, pct: 50 })).toBe('met');
    expect(verdictOf('binomial-fair', { n: 10, pct: 50 })).toBe('review');
    expect(verdictOf('binomial-fair', { n: 10, pct: 30 })).toBe('valid');
    expect(verdictOf('binomial-fair', { n: 20, pct: 52 })).toBe('invalid');
    expect(verdictOf('binomial-fair', { n: 20, pct: 50 }, { target: { n: 10, pct: 50 } })).toBe('invalid');
  });

  it('solves and grades the sampling mean', () => {
    expect(solveClt({ shrink: 3 }, 25)).toEqual({ n: 9 });
    expect(solveClt({ shrink: 5 }, 25)).toEqual({ n: 25 });
    expect(solveClt({ shrink: 5 }, 16)).toBeNull();
    expect(solveClt({ shrink: 1 }, 25)).toBeNull();
    const weights = [6, 1, 1, 1, 1, 6];
    expect(sumPmf(weights, 3).reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
    expect(meanPmf(weights, 4)).toHaveLength(21);
    expect(meanSpread(weights, 9)).toBeCloseTo(populationMoments(weights).sd / 3, 12);
    expect(verdictOf('clt-shrink', { n: 9 })).toBe('met');
    expect(verdictOf('clt-shrink', { n: 8 })).toBe('review');
    expect(verdictOf('clt-shrink', { n: 1 })).toBe('valid');
    expect(verdictOf('clt-shrink', { n: 26 })).toBe('invalid');
    expect(verdictOf('clt-shrink', { n: 9 }, { target: { n: 8 } })).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const entry of STATS1_FIXTURES) {
      const type = entry.segment('en-US').type as string;
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined).verdict, entry.id).toBe('valid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.invalid, undefined).verdict, entry.id).toBe('invalid');
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('stats.dot-plot.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('stats.dot-plot.v2', '13-17', 13, 14)).toBeNull();
    expect(scope('stats.dot-plot.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('stats.dot-plot.v2', '13-17', 13, 17)).not.toBeNull();
    expect(scope('stats.dot-plot.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('stats.balance-point.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('stats.balance-point.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('stats.normal.v2', '13-17', 14, 17)).toBeNull();
    expect(scope('stats.normal.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('stats.normal.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('stats.normal.v2', '13-17', 13, 17)).not.toBeNull();
    expect(scope('stats.binomial.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('stats.clt.v2', '13-17', 14, 17)).toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade', () => {
    for (const entry of STATS1_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of STATS1_FIXTURES) {
      const document = lesson(entry);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteGrade({ type: entry.segment('en-US').type as string }, entry.ladder.met, entry.rubric), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const median = lesson(fixture('dot-plot-median'));
    const key = (target: unknown) => ({ 'dot-plot-median': { target } });
    expect(validateV2LessonForGrading(median, key(4), { lessonId: median.lesson_id, locale: median.locale })).toBeNull();
    expect(gradeV2Visual(v2PublicLessonSchema.parse(median), key(6), 'dot-plot-median', { dots: [2, 3, 4, 5, 5, 7, 9] })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
  });

  it('refuses a payload that leaks the answer, a wrong visual, a bad setup and an out-of-scope document', () => {
    const base = lesson(fixture('dot-plot-median'));
    const withPayload = (payload: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload }] });
    const payload = base.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, target: 6 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, dots: [2, 3, 4, 4, 5, 7, 99] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, axis: { min: 0, max: 2 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, moves: 3 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'balance-point' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 99 } }).success).toBe(false);
    const balance = lesson(fixture('balance-level'));
    const balanced = balance.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...balance, segments: [{ ...balance.segments[0], payload: { ...balanced, pivot: 5 } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...balance, segments: [{ ...balance.segments[0], payload: { ...balanced, dots: [1, 2, 2, 5, 8, 11] } }] }).success).toBe(false);
    const normal = lesson(fixture('normal-95'));
    const curve = normal.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...normal, segments: [{ ...normal.segments[0], payload: { ...curve, band: { rule: 2, low: 41, high: 60 } } }] }).success).toBe(false);
    const binomial = lesson(fixture('binomial-fair'));
    const chance = binomial.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...binomial, segments: [{ ...binomial.segments[0], payload: { ...chance, goal: { mean: 10, variance: 3 } } }] }).success).toBe(false);
  });
});
