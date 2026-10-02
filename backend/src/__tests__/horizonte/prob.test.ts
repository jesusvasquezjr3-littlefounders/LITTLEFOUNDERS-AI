import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { prob } from '../../services/horizonte/prob/index.js';
import { PROB_CAPABILITIES } from '../../services/horizonte/prob/capabilities.js';
import { PROB_FIXTURES } from '../../services/horizonte/prob/fixtures.js';
import {
  askedGroup, isAskable, isChipSet, isRatio, posterior, readChance, treeCounts, treeIsDistinct, treeSolution,
} from '../../services/horizonte/prob/model.js';
import { parseRat, ratText } from '../../services/horizonte/prob/rational.js';
import {
  fitLine, fitOnGrid, isPoints, residualTenths, sseHundredths, tenthsText,
} from '../../services/horizonte/prob/regression.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: string) => prob.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => PROB_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const verdictOf = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric).verdict;

const SCREENING = { population: 1000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 } };

function lesson(entry = PROB_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  const type = segment.type as keyof typeof PROB_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-prob', chapter_id: 'horizonte-prob', lesson_id: `hz-prob-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...PROB_CAPABILITIES[type]], segments: [segment],
  };
}

describe('prob pack: F2.9 probability tree and Bayes, F2.10 regression with residuals', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(prob, PROB_FIXTURES)).not.toThrow();
  });

  it('declares every segment type with a fixture, a rubric and a scope', () => {
    const types = Object.keys(PROB_CAPABILITIES).sort();
    expect(types).toEqual(['prob.bayes.v2', 'prob.regression.v2', 'prob.tree.v2']);
    for (const type of types) expect(PROB_FIXTURES.some((entry) => entry.segment('en-US').type === type), type).toBe(true);
    expect(PROB_FIXTURES).toHaveLength(9);
  });

  it('grows the tree in whole people', () => {
    expect(treeCounts(SCREENING)).toEqual({ has: 10, lacks: 990, hasPos: 9, hasNeg: 1, lacksPos: 99, lacksNeg: 891 });
    expect(treeIsDistinct(treeCounts(SCREENING)!)).toBe(true);
    expect(treeSolution(SCREENING)).toEqual({ has: ['n-10'], lacks: ['n-990'], 'has-pos': ['n-9'], 'has-neg': ['n-1'], 'lacks-pos': ['n-99'], 'lacks-neg': ['n-891'] });
    expect(treeCounts({ ...SCREENING, population: 1001 })).toBeNull();
    expect(treeCounts({ ...SCREENING, hit: { part: 1, whole: 3 } })).toBeNull();
    expect(treeSolution({ population: 1000, prior: { part: 1, whole: 2 }, hit: { part: 1, whole: 2 }, alarm: { part: 1, whole: 2 } })).toBeNull();
    expect(treeCounts({ ...SCREENING, extra: 1 } as never)).toBeNull();
    expect(isRatio({ part: 3, whole: 3 })).toBe(false);
    expect(isRatio({ part: 0, whole: 3 })).toBe(false);
    expect(isRatio({ part: 1, whole: 2 })).toBe(true);
  });

  it('holds the tray to the six counts and a few that tempt', () => {
    expect(isChipSet([1, 9, 10, 99, 891, 990, 100], SCREENING)).toBe(true);
    expect(isChipSet([1, 9, 10, 99, 891, 990], SCREENING)).toBe(false);
    expect(isChipSet([1, 9, 10, 99, 891, 990, 990], SCREENING)).toBe(false);
    expect(isChipSet([1, 9, 10, 99, 891, 990, 5000], SCREENING)).toBe(false);
    expect(isChipSet([1, 9, 10, 99, 891, 100, 200], SCREENING)).toBe(false);
    expect(isChipSet([1, 9, 10, 99, 891, 990, 1, 2, 3, 4, 5], SCREENING)).toBe(false);
  });

  it('reads the asked share exactly', () => {
    expect(ratText(posterior(SCREENING, 'positive')!)).toBe('1/12');
    expect(ratText(posterior(SCREENING, 'negative')!)).toBe('1/892');
    expect(askedGroup(SCREENING, 'positive')).toEqual({ top: 9, bottom: 108 });
    expect(isAskable(SCREENING, 'positive')).toBe(true);
    expect(isAskable(SCREENING, 'negative')).toBe(false);
    expect(posterior(SCREENING, 'maybe' as never)).toBeNull();
  });

  it('normalizes a typed chance in every locale', () => {
    expect(readChance('0.25')).toBe('0.25');
    expect(readChance('0,25')).toBe('0.25');
    expect(readChance(' 25 % ')).toBe('0.25');
    expect(readChance('25%')).toBe('0.25');
    expect(readChance('1/4')).toBe('0.25');
    expect(readChance('1/12')).toBe('1/12');
    expect(readChance('8.3%')).toBe('0.083');
    expect(readChance('1')).toBe('1');
    expect(readChance('0')).toBe('0');
    expect(readChance('100%')).toBe('1');
    expect(readChance('2')).toBeNull();
    expect(readChance('150%')).toBeNull();
    expect(readChance('1/0')).toBeNull();
    expect(readChance('abc')).toBeNull();
    expect(readChance('')).toBeNull();
    expect(readChance('-0.5')).toBeNull();
    expect(readChance(0.5)).toBeNull();
    expect(readChance('1.2.3')).toBeNull();
  });

  it('parses exact number text', () => {
    expect(parseRat('0.25')).toEqual({ n: 1n, d: 4n });
    expect(parseRat('-3')).toEqual({ n: -3n, d: 1n });
    expect(parseRat('1/12')).toEqual({ n: 1n, d: 12n });
    expect(parseRat('1/0')).toBeNull();
    expect(parseRat('1e3')).toBeNull();
    expect(parseRat('')).toBeNull();
    expect(parseRat(5)).toBeNull();
    expect(ratText({ n: 1n, d: 8n })).toBe('0.125');
    expect(ratText({ n: -3n, d: 2n })).toBe('-1.5');
    expect(ratText({ n: 6n, d: 1n })).toBe('6');
    expect(ratText({ n: 1n, d: 3n })).toBe('1/3');
  });

  it('grades the tree against the one arrangement', () => {
    expect(verdictOf('tree-screening', fixture('tree-screening').ladder.met)).toBe('met');
    expect(verdictOf('tree-screening', { slots: { has: ['n-10'] } })).toBe('review');
    expect(verdictOf('tree-screening', { slots: { has: ['n-990'], lacks: ['n-10'] } })).toBe('review');
    expect(verdictOf('tree-screening', { slots: { has: ['n-100'] } })).toBe('review');
    expect(verdictOf('tree-screening', { slots: {} })).toBe('valid');
    expect(verdictOf('tree-screening', { slots: { has: [], lacks: [] } })).toBe('valid');
    expect(verdictOf('tree-screening', { slots: { has: ['n-5'] } })).toBe('invalid');
    expect(verdictOf('tree-screening', { slots: { has: ['n-10'], lacks: ['n-10'] } })).toBe('invalid');
    expect(verdictOf('tree-screening', { slots: { has: ['n-10', 'n-9'] } })).toBe('invalid');
    expect(verdictOf('tree-screening', { slots: { root: ['n-10'] } })).toBe('invalid');
    expect(verdictOf('tree-screening', { slots: [] })).toBe('invalid');
    expect(verdictOf('tree-screening', { slots: {}, extra: 1 })).toBe('invalid');
    expect(grade('prob.tree.v2')(segmentOf('tree-screening'), { slots: { has: ['n-10'] } }, fixture('tree-screening').rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('refuses a tree key that is not the arrangement this population grows', () => {
    const met = fixture('tree-screening').ladder.met;
    expect(verdictOf('tree-screening', met, fixture('tree-filter').rubric)).toBe('invalid');
    expect(verdictOf('tree-screening', met, { solutions: [] })).toBe('invalid');
    expect(verdictOf('tree-screening', met, { solutions: [(fixture('tree-screening').rubric as { solutions: unknown[] }).solutions[0], (fixture('tree-screening').rubric as { solutions: unknown[] }).solutions[0]] })).toBe('invalid');
    expect(verdictOf('tree-screening', met, { solutions: [{ has: ['n-10'] }] })).toBe('invalid');
    expect(verdictOf('tree-screening', met, {})).toBe('invalid');
  });

  it('grades the chance with an exact key and a tight allowance', () => {
    expect(verdictOf('bayes-screening', { value: '1/12' })).toBe('met');
    expect(verdictOf('bayes-screening', { value: '0.083' })).toBe('met');
    expect(verdictOf('bayes-screening', { value: '0.08' })).toBe('met');
    expect(verdictOf('bayes-screening', { value: '0.1' })).toBe('review');
    expect(verdictOf('bayes-screening', { value: '0.9' })).toBe('review');
    expect(verdictOf('bayes-screening', { value: '' })).toBe('valid');
    expect(verdictOf('bayes-screening', { value: '2' })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '-0.1' })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '8,3' })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: 0.08 })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08', extra: 1 })).toBe('invalid');
    expect(verdictOf('bayes-checkup', { value: '5/29' })).toBe('met');
    expect(verdictOf('bayes-checkup', { value: '0.17' })).toBe('met');
    expect(verdictOf('bayes-checkup', { value: '0.1' })).toBe('review');
    expect(verdictOf('bayes-filter', { value: '9/11' })).toBe('met');
    expect(verdictOf('bayes-filter', { value: '0.82' })).toBe('met');
    expect(verdictOf('bayes-filter', { value: '0.9' })).toBe('review');
  });

  it('refuses a chance key that is not the exact share asked for', () => {
    const rubric = (target: string, tolerance = '0.005', review: string | undefined = '0.02') => ({ target, tolerance: { absolute: tolerance }, ...(review ? { review: { absolute: review } } : {}) });
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('1/10'))).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('0.0833'))).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('1/12', '0.05', '0.1'))).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('1/12', '0.005', '0.005'))).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('1/12', '0.005', '0.5'))).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, rubric('1/12', '0.005', undefined))).toBe('met');
    expect(verdictOf('bayes-screening', { value: '0.08' }, { target: '1/12' })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, { target: '1/12', tolerance: { relative_bps: 100 } })).toBe('invalid');
    expect(verdictOf('bayes-screening', { value: '0.08' }, { ...rubric('1/12'), extra: 1 })).toBe('invalid');
  });

  it('fits the least squares line exactly', () => {
    const climb = fixture('regression-climb').segment('en-US').payload as { size: number; points: Array<{ x: number; y: number }> };
    expect(isPoints(climb.points, climb.size)).toBe(true);
    const fit = fitLine(climb.points)!;
    expect(fit.slope).toEqual({ n: 1n, d: 1n });
    expect(fit.intercept).toEqual({ n: 1n, d: 1n });
    expect(fitOnGrid(climb.points)).toEqual({ slope: 10, intercept: 10 });
    expect(sseHundredths(climb.points, { slope: 10, intercept: 10 })).toBe(400);
    expect(sseHundredths(climb.points, { slope: 10, intercept: 11 })).toBeGreaterThan(400);
    expect(sseHundredths(climb.points, { slope: 11, intercept: 10 })).toBeGreaterThan(400);
    expect(residualTenths({ x: 3, y: 5 }, { slope: 10, intercept: 10 })).toBe(10);
    expect(fitLine([{ x: 2, y: 1 }, { x: 2, y: 3 }, { x: 2, y: 4 }])).toBeNull();
    expect(fitOnGrid([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 4 }])).toBeNull();
    expect(isPoints([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }], 8)).toBe(false);
    expect(isPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], 8)).toBe(false);
    expect(isPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 9 }], 8)).toBe(false);
    expect(isPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 3 }], 8)).toBe(false);
    expect(tenthsText(8)).toBe('0.8');
    expect(tenthsText(-30)).toBe('-3');
    expect(tenthsText(0)).toBe('0');
    expect(tenthsText(-15)).toBe('-1.5');
    expect(tenthsText(95)).toBe('9.5');
  });

  it('grades the line against the least squares key', () => {
    const line = (m: string, b: string, family = 'line') => ({ family, params: { m, b } });
    expect(verdictOf('regression-climb', line('1', '1'))).toBe('met');
    expect(verdictOf('regression-climb', line('1.0', '1.00'))).toBe('met');
    expect(verdictOf('regression-climb', line('1.1', '1'))).toBe('review');
    expect(verdictOf('regression-climb', line('0', '5'))).toBe('valid');
    expect(verdictOf('regression-climb', line('4', '1'))).toBe('invalid');
    expect(verdictOf('regression-climb', line('1', '16'))).toBe('invalid');
    expect(verdictOf('regression-climb', line('1', 'x'))).toBe('invalid');
    expect(verdictOf('regression-climb', line('1', '1', 'quadratic'))).toBe('invalid');
    expect(verdictOf('regression-climb', { family: 'line', params: { m: '1' } })).toBe('invalid');
    expect(verdictOf('regression-climb', { family: 'line', params: { m: '1', b: '1', c: '2' } })).toBe('invalid');
    expect(verdictOf('regression-gentle', line('0.5', '3.5'))).toBe('met');
    expect(verdictOf('regression-gentle', line('0.6', '3.5'))).toBe('review');
    expect(verdictOf('regression-fall', line('-1', '9.5'))).toBe('met');
    expect(verdictOf('regression-fall', line('1', '9.5'))).toBe('review');
    expect(grade('prob.regression.v2')(segmentOf('regression-climb'), line('2', '1'), fixture('regression-climb').rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('refuses a line key that is not the least squares line of these points', () => {
    const met = { family: 'line', params: { m: '1', b: '1' } };
    const key = (m: string, b: string, tolerance = '0.05', review: string | undefined = '0.3') => ({
      family: 'line', target: { m, b }, parameter_tolerance: { absolute: tolerance }, ...(review ? { parameter_review: { absolute: review } } : {}),
    });
    expect(verdictOf('regression-climb', met, key('1.1', '1'))).toBe('invalid');
    expect(verdictOf('regression-climb', met, key('1', '1', '0.5', '0.8'))).toBe('invalid');
    expect(verdictOf('regression-climb', met, key('1', '1', '0.05', '0.05'))).toBe('invalid');
    expect(verdictOf('regression-climb', met, key('1', '1', '0.05', '0.9'))).toBe('invalid');
    expect(verdictOf('regression-climb', met, key('1', '1', '0.05', undefined))).toBe('met');
    expect(verdictOf('regression-climb', met, { family: 'line', target: { m: '1', b: '1' } })).toBe('invalid');
    expect(verdictOf('regression-climb', met, { ...key('1', '1'), family: 'quadratic' })).toBe('invalid');
    expect(verdictOf('regression-climb', met, { ...key('1', '1'), extra: 1 })).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const entry of PROB_FIXTURES) {
      const type = entry.segment('en-US').type as string;
      expect(grade(type)(entry.segment('en-US'), entry.ladder.met, undefined).verdict, entry.id).toBe('valid');
      expect(grade(type)(entry.segment('en-US'), entry.ladder.invalid, undefined).verdict, entry.id).toBe('invalid');
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('prob.tree.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('prob.tree.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('prob.tree.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('prob.bayes.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('prob.bayes.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('prob.regression.v2', '13-17', 14, 17)).toBeNull();
    expect(scope('prob.regression.v2', '13-17', 13, 17)).not.toBeNull();
    expect(scope('prob.regression.v2', 'adult', 18, 99)).toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade', () => {
    for (const entry of PROB_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of PROB_FIXTURES) {
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
    const tree = lesson(fixture('tree-screening'));
    const wrong = { 'tree-screening': fixture('tree-filter').rubric };
    expect(validateV2LessonForGrading(tree, wrong, { lessonId: tree.lesson_id, locale: tree.locale })).toBeNull();
    const key = { 'bayes-screening': fixture('bayes-screening').rubric };
    expect(gradeV2Visual(v2PublicLessonSchema.parse(lesson(fixture('bayes-screening'))), key, 'bayes-screening', { value: '0.4' })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
  });

  it('refuses a payload that leaks the answer, a wrong visual, a bad setup and an out-of-scope document', () => {
    const base = lesson(fixture('tree-screening'));
    const withPayload = (payload: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload }] });
    const payload = base.segments[0]!.payload as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, solutions: [] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, population: 1001 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, hit: { part: 9, whole: 9 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, chips: [1, 9, 10, 99, 891, 990] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, chips: [1, 9, 10, 99, 891, 990, 990] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'natural-frequencies' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } }).success).toBe(false);
    const bayes = lesson(fixture('bayes-screening'));
    const asked = bayes.segments[0]!.payload as Record<string, unknown>;
    const withAsk = (extra: unknown) => ({ ...bayes, segments: [{ ...bayes.segments[0], payload: { ...asked, ...(extra as object) } }] });
    expect(v2PublicLessonSchema.safeParse(withAsk({ ask: 'negative' })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withAsk({ ask: 'maybe' })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withAsk({ chips: [1] })).success).toBe(false);
    const regression = lesson(fixture('regression-climb'));
    const plot = regression.segments[0]!.payload as { size: number; points: unknown[]; start: unknown };
    const withPlot = (extra: unknown) => ({ ...regression, segments: [{ ...regression.segments[0], payload: { ...plot, ...(extra as object) } }] });
    expect(v2PublicLessonSchema.safeParse(withPlot({ start: { slope: 10, intercept: 10 } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPlot({ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPlot({ points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 4 }, { x: 5, y: 4 }] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPlot({ size: 5 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPlot({ target: { m: '1', b: '1' } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...regression, age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 } }).success).toBe(false);
  });
});
